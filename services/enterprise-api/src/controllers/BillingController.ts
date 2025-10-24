import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'
import { AuditService } from '../services/AuditService.js'
import { prisma } from '../app.js'

export class BillingController {
  /**
   * Get current subscription
   */
  static async getSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          organizationId,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        include: {
          plan: true,
          usage: {
            where: {
              periodStart: { lte: new Date() },
              periodEnd: { gte: new Date() }
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          paymentMethods: {
            where: { isDeleted: false },
            orderBy: { isDefault: 'desc' }
          }
        }
      })

      if (!subscription) {
        res.json({
          success: true,
          data: {
            subscription: null,
            availablePlans: await this.getAvailablePlans(),
            canTrial: await this.canStartTrial(organizationId)
          }
        })
        return
      }

      res.json({
        success: true,
        data: {
          subscription,
          availablePlans: await this.getAvailablePlans(),
          usage: subscription.usage[0] || null
        }
      })
    } catch (error) {
      logger.error('Failed to get subscription', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Create subscription
   */
  static async createSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const { plan, billingCycle, promoCode, customLimits } = req.body
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      // Check if organization already has active subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          organizationId,
          status: { in: ['active', 'trialing'] }
        }
      })

      if (existingSubscription) {
        res.status(400).json({
          success: false,
          error: 'Organization already has an active subscription'
        })
        return
      }

      // Get plan details
      const planDetails = await this.getPlanDetails(plan, customLimits)
      if (!planDetails) {
        res.status(400).json({
          success: false,
          error: 'Invalid plan'
        })
        return
      }

      // Apply promo code if provided
      let discount = 0
      if (promoCode) {
        const promoDiscount = await this.validatePromoCode(promoCode, organizationId)
        if (promoDiscount === null) {
          res.status(400).json({
            success: false,
            error: 'Invalid or expired promo code'
          })
          return
        }
        discount = promoDiscount
      }

      // Calculate billing amounts
      const amounts = this.calculateBillingAmounts(planDetails, billingCycle, discount)

      // Create subscription
      const subscription = await prisma.subscription.create({
        data: {
          organizationId,
          planId: planDetails.id,
          status: 'active',
          billingCycle,
          currentPeriodStart: new Date(),
          currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
          amount: amounts.total,
          discountedAmount: discount > 0 ? amounts.total - (amounts.total * (discount / 100)) : null,
          limits: planDetails.limits,
          features: planDetails.features,
          promoCode: promoCode || null,
          createdBy: userId
        },
        include: {
          plan: true
        }
      })

      // Create initial usage record
      await prisma.subscriptionUsage.create({
        data: {
          subscriptionId: subscription.id,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd
        }
      })

      // Log audit event
      await AuditService.log({
        organizationId,
        userId: userId || '',
        action: 'billing.subscription_created',
        resourceType: 'subscription',
        resourceId: subscription.id,
        details: { plan, billingCycle, amount: amounts.total }
      })

      logger.info('Subscription created', {
        organizationId,
        subscriptionId: subscription.id,
        plan,
        createdBy: userId
      })

      res.status(201).json({
        success: true,
        data: subscription
      })
    } catch (error) {
      logger.error('Failed to create subscription', {
        organizationId: req.params.organizationId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Update subscription
   */
  static async updateSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, subscriptionId } = req.params
      if (!organizationId || !subscriptionId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID and subscription ID are required'
        })
        return
      }
      if (!organizationId || !subscriptionId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID and subscription ID are required'
        })
        return
      }
      const updates = req.body
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId,
          status: { in: ['active', 'trialing'] }
        }
      })

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found'
        })
        return
      }

      // Handle plan change
      if (updates.plan && updates.plan !== subscription.planId) {
        const newPlanDetails = await this.getPlanDetails(updates.plan, updates.customLimits)
        if (!newPlanDetails) {
          res.status(400).json({
            success: false,
            error: 'Invalid plan'
          })
          return
        }

        // Prorate if changing mid-cycle
        const proratedAmount = await this.calculateProratedAmount(subscription, newPlanDetails, updates.billingCycle)

        updates.planId = newPlanDetails.id
        updates.amount = proratedAmount
        updates.limits = newPlanDetails.limits
        updates.features = newPlanDetails.features
      }

      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          ...updates,
          updatedBy: userId,
          updatedAt: new Date()
        },
        include: {
          plan: true
        }
      })

      // Log audit event
      await AuditService.log({
        organizationId,
        userId: userId || '',
        action: 'billing.subscription_updated',
        resourceType: 'subscription',
        resourceId: subscriptionId,
        details: { updates: Object.keys(updates) }
      })

      res.json({
        success: true,
        data: updatedSubscription
      })
    } catch (error) {
      logger.error('Failed to update subscription', {
        organizationId: req.params.organizationId,
        subscriptionId: req.params.subscriptionId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, subscriptionId } = req.params
      if (!organizationId || !subscriptionId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID and subscription ID are required'
        })
        return
      }
      if (!organizationId || !subscriptionId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID and subscription ID are required'
        })
        return
      }
      const { reason, feedback, immediate = false } = req.body
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          organizationId,
          status: { in: ['active', 'trialing'] }
        }
      })

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found'
        })
        return
      }

      const cancelAt = immediate ? new Date() : subscription.currentPeriodEnd

      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'canceled',
          cancelAt,
          cancelReason: reason,
          cancelFeedback: feedback,
          canceledBy: userId,
          canceledAt: new Date()
        }
      })

      // Log audit event
      await AuditService.log({
        organizationId,
        userId: userId || '',
        action: 'billing.subscription_canceled',
        resourceType: 'subscription',
        resourceId: subscriptionId,
        details: { reason, immediate }
      })

      logger.info('Subscription canceled', {
        organizationId,
        subscriptionId,
        cancelAt,
        canceledBy: userId
      })

      res.json({
        success: true,
        data: {
          subscription: updatedSubscription,
          cancelAt,
          immediate
        }
      })
    } catch (error) {
      logger.error('Failed to cancel subscription', {
        organizationId: req.params.organizationId,
        subscriptionId: req.params.subscriptionId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Get billing usage
   */
  static async getUsage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const { startDate, endDate, metric, groupBy = 'day' } = req.query

      const end = endDate ? new Date(endDate as string) : new Date()
      const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

      const usage = await prisma.subscriptionUsage.findMany({
        where: {
          subscription: {
            organizationId,
            status: { in: ['active', 'trialing', 'past_due'] }
          },
          periodStart: { gte: start },
          periodEnd: { lte: end }
        },
        include: {
          subscription: {
            include: { plan: true }
          }
        },
        orderBy: { periodStart: 'asc' }
      })

      // Group and aggregate usage data
      const aggregatedUsage = this.aggregateUsageData(usage, metric as string, groupBy as string)

      res.json({
        success: true,
        data: {
          period: { start, end },
          metric,
          groupBy,
          usage: aggregatedUsage
        }
      })
    } catch (error) {
      logger.error('Failed to get billing usage', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Get invoices
   */
  static async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const { status, startDate, endDate, limit = 20 } = req.query

      const whereClause: any = {
        subscription: { organizationId }
      }

      if (status) {
        whereClause.status = status
      }

      if (startDate || endDate) {
        whereClause.createdAt = {}
        if (startDate) whereClause.createdAt.gte = new Date(startDate as string)
        if (endDate) whereClause.createdAt.lte = new Date(endDate as string)
      }

      const invoices = await prisma.invoice.findMany({
        where: whereClause,
        include: {
          subscription: {
            include: { plan: true }
          },
          payment: true
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit)
      })

      res.json({
        success: true,
        data: invoices
      })
    } catch (error) {
      logger.error('Failed to get invoices', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Get payment methods
   */
  static async getPaymentMethods(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }

      const paymentMethods = await prisma.paymentMethod.findMany({
        where: {
          organizationId,
          isDeleted: false
        },
        orderBy: { isDefault: 'desc' }
      })

      res.json({
        success: true,
        data: paymentMethods
      })
    } catch (error) {
      logger.error('Failed to get payment methods', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Create payment method
   */
  static async createPaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const { type, nickname, isDefault = false } = req.body
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      // This would integrate with a payment processor like Stripe
      // For now, we'll create a basic record

      // If this is set as default, unset other defaults
      if (isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false }
        })
      }

      const paymentMethod = await prisma.paymentMethod.create({
        data: {
          organizationId,
          type,
          nickname,
          isDefault,
          status: 'active',
          createdBy: userId
          // In production, you'd store tokenized payment details from Stripe/other processor
        }
      })

      await AuditService.log({
        organizationId,
        userId: userId || '',
        action: 'billing.payment_method_created',
        resourceType: 'payment_method',
        resourceId: paymentMethod.id,
        details: { type, isDefault }
      })

      res.status(201).json({
        success: true,
        data: paymentMethod
      })
    } catch (error) {
      logger.error('Failed to create payment method', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  /**
   * Delete payment method
   */
  static async deletePaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, paymentMethodId } = req.params
      if (!organizationId || !paymentMethodId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID and payment method ID are required'
        })
        return
      }
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          organizationId,
          isDeleted: false
        }
      })

      if (!paymentMethod) {
        res.status(404).json({
          success: false,
          error: 'Payment method not found'
        })
        return
      }

      // Soft delete
      await prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: {
          isDeleted: true,
          deletedBy: userId,
          deletedAt: new Date()
        }
      })

      await AuditService.log({
        organizationId,
        userId: userId || '',
        action: 'billing.payment_method_deleted',
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        details: {}
      })

      res.status(204).send()
    } catch (error) {
      logger.error('Failed to delete payment method', {
        organizationId: req.params.organizationId,
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  // Private helper methods

  private static async getAvailablePlans(): Promise<any[]> {
    // This would typically come from a database or configuration
    return [
      {
        id: 'starter',
        name: 'Starter',
        price: { monthly: 29, yearly: 290 },
        limits: {
          users: 5,
          projects: 10,
          storage: 10, // GB
          apiCalls: 10000
        },
        features: ['basic_analytics', 'email_support']
      },
      {
        id: 'professional',
        name: 'Professional',
        price: { monthly: 99, yearly: 990 },
        limits: {
          users: 25,
          projects: 50,
          storage: 100,
          apiCalls: 100000
        },
        features: ['advanced_analytics', 'priority_support', 'workflows', 'sso']
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: { monthly: 299, yearly: 2990 },
        limits: {
          users: 100,
          projects: 200,
          storage: 500,
          apiCalls: 1000000
        },
        features: ['all_features', 'dedicated_support', 'custom_integrations', 'audit_logs']
      }
    ]
  }

  private static async canStartTrial(organizationId: string): Promise<boolean> {
    const hasTrial = await prisma.subscription.findFirst({
      where: {
        organizationId,
        status: 'trialing'
      }
    })

    const hasHadTrial = await prisma.subscription.findFirst({
      where: {
        organizationId,
        status: 'canceled',
        cancelReason: { contains: 'trial' }
      }
    })

    return !hasTrial && !hasHadTrial
  }

  private static async getPlanDetails(planId: string, customLimits?: any): Promise<any> {
    const plans = await this.getAvailablePlans()
    const plan = plans.find(p => p.id === planId)

    if (!plan) return null

    return {
      ...plan,
      limits: customLimits || plan.limits
    }
  }

  private static async validatePromoCode(promoCode: string, organizationId: string): Promise<number | null> {
    // This would validate against a database of promo codes
    // For now, return a fixed discount for demo purposes
    if (promoCode === 'DEMO20') return 20
    if (promoCode === 'WELCOME10') return 10
    return null
  }

  private static calculateBillingAmounts(plan: any, billingCycle: string, discount: number): any {
    const baseAmount = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly
    const discountAmount = baseAmount * (discount / 100)
    const total = baseAmount - discountAmount

    return {
      base: baseAmount,
      discount: discountAmount,
      total
    }
  }

  private static calculatePeriodEnd(billingCycle: string): Date {
    const now = new Date()
    if (billingCycle === 'yearly') {
      const periodEnd = new Date(now)
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      return periodEnd
    } else {
      const periodEnd = new Date(now)
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      return periodEnd
    }
  }

  private static async calculateProratedAmount(subscription: any, newPlan: any, billingCycle: string): Promise<number> {
    const daysRemaining = Math.ceil((subscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

    const newPlanDailyRate = (billingCycle === 'yearly' ? newPlan.price.yearly : newPlan.price.monthly) / 30
    return Math.round(newPlanDailyRate * daysRemaining * 100) / 100
  }

  private static aggregateUsageData(usage: any[], _metric?: string, _groupBy?: string): any[] {
    // This would aggregate usage data based on metric and groupBy parameters
    // For now, return the raw usage data
    return usage.map(record => ({
      date: record.periodStart,
      ...record.metrics,
      limits: record.subscription.plan.limits
    }))
  }
}