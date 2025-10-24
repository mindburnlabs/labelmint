import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { BillingController } from '../controllers/BillingController.js'
import {
  validateOrganizationIdParam,
  validateSubscriptionIdParam,
  validateCreateSubscription,
  validateUpdateSubscription,
  validateCreatePaymentMethod,
  validateBillingQuery,
  validateUsageQuery,
  validateInvoiceQuery,
  validateCancelSubscription,
  validatePaymentMethodIdParam
} from '../validators/billingValidators.js'
import { multiTenantMiddleware } from '../middleware/multiTenant.js'

const router = Router()

const billingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many billing requests, please try again later.'
  }
})

router.use(multiTenantMiddleware)
router.use(billingRateLimit)

// Get current subscription
router.get(
  '/organizations/:organizationId/billing/subscription',
  validateOrganizationIdParam,
  BillingController.getSubscription
)

// Create subscription
router.post(
  '/organizations/:organizationId/billing/subscription',
  validateOrganizationIdParam,
  validateCreateSubscription,
  BillingController.createSubscription
)

// Update subscription
router.patch(
  '/organizations/:organizationId/billing/subscription/:subscriptionId',
  validateOrganizationIdParam,
  validateSubscriptionIdParam,
  validateUpdateSubscription,
  BillingController.updateSubscription
)

// Cancel subscription
router.post(
  '/organizations/:organizationId/billing/subscription/:subscriptionId/cancel',
  validateOrganizationIdParam,
  validateSubscriptionIdParam,
  validateCancelSubscription,
  BillingController.cancelSubscription
)

// Get usage metrics
router.get(
  '/organizations/:organizationId/billing/usage',
  validateOrganizationIdParam,
  validateUsageQuery,
  BillingController.getUsage
)

// Get invoices
router.get(
  '/organizations/:organizationId/billing/invoices',
  validateOrganizationIdParam,
  validateInvoiceQuery,
  BillingController.getInvoices
)

// Download invoice
router.get(
  '/organizations/:organizationId/billing/invoices/:invoiceId/download',
  validateOrganizationIdParam,
  validateInvoiceIdParam,
  BillingController.downloadInvoice
)

// Get payment methods
router.get(
  '/organizations/:organizationId/billing/payment-methods',
  validateOrganizationIdParam,
  BillingController.getPaymentMethods
)

// Add payment method
router.post(
  '/organizations/:organizationId/billing/payment-methods',
  validateOrganizationIdParam,
  validateCreatePaymentMethod,
  BillingController.createPaymentMethod
)

// Delete payment method
router.delete(
  '/organizations/:organizationId/billing/payment-methods/:paymentMethodId',
  validateOrganizationIdParam,
  validatePaymentMethodIdParam,
  BillingController.deletePaymentMethod
)

export default router