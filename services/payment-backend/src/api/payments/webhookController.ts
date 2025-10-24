import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { paymentMonitor } from '../../services/payment/PaymentMonitorService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const prisma = new PrismaClient();

/**
 * Secure Stripe webhook handler with signature verification
 * and idempotency support
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!sig) {
    console.error('No Stripe signature provided');
    return res.status(400).json({ error: 'No signature provided' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  // Check for duplicate events (idempotency)
  const eventId = event.id;
  const existingEvent = await prisma.stripeEvent.findUnique({
    where: { eventId }
  });

  if (existingEvent) {
    console.log(`Duplicate event received: ${eventId}`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    // Store the event first for idempotency
    await prisma.stripeEvent.create({
      data: {
        eventId,
        type: event.type,
        processed: false,
        data: JSON.stringify(event.data.object),
        createdAt: new Date()
      }
    });

    // Handle the event based on type
    await processWebhookEvent(event);

    // Mark event as processed
    await prisma.stripeEvent.update({
      where: { eventId },
      data: { processed: true, processedAt: new Date() }
    });

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook event:', error);

    // Mark event as failed but don't return error to prevent retries
    await prisma.stripeEvent.update({
      where: { eventId },
      data: {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({ error: 'Failed to process webhook' });
  }
};

async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  const data = event.data.object as Stripe.PaymentIntent | Stripe.Charge | Stripe.Customer;

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(data as Stripe.PaymentIntent);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailed(data as Stripe.PaymentIntent);
      break;

    case 'payment_intent.requires_action':
      await handlePaymentRequiresAction(data as Stripe.PaymentIntent);
      break;

    case 'charge.succeeded':
      await handleChargeSucceeded(data as Stripe.Charge);
      break;

    case 'charge.failed':
      await handleChargeFailed(data as Stripe.Charge);
      break;

    case 'charge.dispute.created':
      await handleDisputeCreated(data as Stripe.Charge);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionEvent(event.type, data as Stripe.Subscription);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    // Update payment record in database
    await prisma.payment.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: {
          stripeReceiptUrl: paymentIntent.charges.data[0]?.receipt_url,
          paymentMethod: paymentIntent.payment_method_types[0]
        }
      }
    });

    // Record success metric
    paymentMonitor.recordMetric({
      timestamp: new Date(),
      type: 'success',
      transactionId: paymentIntent.id,
      userId: paymentIntent.metadata.userId,
      amount: (paymentIntent.amount / 100).toString(),
      fee: (paymentIntent.application_fee_amount || 0).toString(),
      confirmationTime: Date.now() - new Date(paymentIntent.created * 1000).getTime()
    });

    // Update user balance if applicable
    if (paymentIntent.metadata.userId && paymentIntent.metadata.creditAmount) {
      await prisma.user.update({
        where: { id: paymentIntent.metadata.userId },
        data: {
          balance: {
            increment: parseFloat(paymentIntent.metadata.creditAmount)
          }
        }
      });
    }

    console.log(`Payment succeeded: ${paymentIntent.id}`);
  } catch (error) {
    console.error('Error handling payment success:', error);
    throw error;
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    // Update payment record
    await prisma.payment.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        metadata: {
          failureReason: paymentIntent.last_payment_error?.message,
          declineCode: paymentIntent.last_payment_error?.decline_code
        }
      }
    });

    // Record failure metric
    paymentMonitor.recordMetric({
      timestamp: new Date(),
      type: 'failure',
      transactionId: paymentIntent.id,
      userId: paymentIntent.metadata.userId,
      amount: (paymentIntent.amount / 100).toString(),
      error: paymentIntent.last_payment_error?.message || 'Payment failed'
    });

    console.log(`Payment failed: ${paymentIntent.id} - ${paymentIntent.last_payment_error?.message}`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
    throw error;
  }
}

async function handlePaymentRequiresAction(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    // Update payment record
    await prisma.payment.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'REQUIRES_ACTION',
        nextAction: paymentIntent.next_action?.type,
        updatedAt: new Date()
      }
    });

    console.log(`Payment requires action: ${paymentIntent.id} - ${paymentIntent.next_action?.type}`);
  } catch (error) {
    console.error('Error handling payment requires action:', error);
    throw error;
  }
}

async function handleChargeSucceeded(charge: Stripe.Charge): Promise<void> {
  try {
    // Update charge record if exists
    await prisma.stripeCharge.upsert({
      where: { chargeId: charge.id },
      update: {
        status: 'succeeded',
        receiptUrl: charge.receipt_url,
        balanceTransaction: charge.balance_transaction as string
      },
      create: {
        chargeId: charge.id,
        paymentIntentId: charge.payment_intent as string,
        status: 'succeeded',
        amount: (charge.amount / 100).toString(),
        currency: charge.currency,
        receiptUrl: charge.receipt_url,
        balanceTransaction: charge.balance_transaction as string
      }
    });

    console.log(`Charge succeeded: ${charge.id}`);
  } catch (error) {
    console.error('Error handling charge success:', error);
    throw error;
  }
}

async function handleChargeFailed(charge: Stripe.Charge): Promise<void> {
  try {
    // Update charge record
    await prisma.stripeCharge.upsert({
      where: { chargeId: charge.id },
      update: {
        status: 'failed',
        failureCode: charge.failure_code,
        failureMessage: charge.failure_message
      },
      create: {
        chargeId: charge.id,
        paymentIntentId: charge.payment_intent as string,
        status: 'failed',
        amount: (charge.amount / 100).toString(),
        currency: charge.currency,
        failureCode: charge.failure_code,
        failureMessage: charge.failure_message
      }
    });

    console.log(`Charge failed: ${charge.id} - ${charge.failure_message}`);
  } catch (error) {
    console.error('Error handling charge failure:', error);
    throw error;
  }
}

async function handleDisputeCreated(charge: Stripe.Charge): Promise<void> {
  try {
    // Create dispute record
    await prisma.paymentDispute.create({
      data: {
        chargeId: charge.id,
        paymentIntentId: charge.payment_intent as string,
        amount: (charge.amount / 100).toString(),
        currency: charge.currency,
        reason: 'unknown', // Will be updated with actual dispute data
        status: 'needs_response',
        createdAt: new Date()
      }
    });

    // Send alert for new dispute
    paymentMonitor.alert({
      type: 'critical',
      message: `Payment dispute created: ${charge.id}`,
      metrics: [{
        timestamp: new Date(),
        type: 'failure',
        transactionId: charge.id,
        amount: (charge.amount / 100).toString(),
        error: 'Payment dispute created'
      }],
      threshold: 0,
      currentValue: 1
    });

    console.log(`Dispute created: ${charge.id}`);
  } catch (error) {
    console.error('Error handling dispute creation:', error);
    throw error;
  }
}

async function handleSubscriptionEvent(eventType: string, subscription: Stripe.Subscription): Promise<void> {
  try {
    const status = eventType.includes('deleted') ? 'canceled' : subscription.status;

    await prisma.stripeSubscription.upsert({
      where: { subscriptionId: subscription.id },
      update: {
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date()
      },
      create: {
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });

    console.log(`Subscription ${eventType}: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription event:', error);
    throw error;
  }
}