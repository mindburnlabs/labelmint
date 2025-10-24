import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { IntegrationController } from '../controllers/IntegrationController.js'
import {
  validateOrganizationIdParam,
  validateIntegrationIdParam,
  validateCreateIntegration,
  validateUpdateIntegration,
  validateIntegrationQuery,
  validateCreateWebhook,
  validateUpdateWebhook,
  validateWebhookQuery,
  validateWebhookIdParam,
  validateTestIntegration,
  validateTestWebhook
} from '../validators/integrationsValidators.js'
import { multiTenantMiddleware } from '../middleware/multiTenant.js'

const router = Router()

const integrationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many integration requests, please try again later.'
  }
})

router.use(multiTenantMiddleware)
router.use(integrationRateLimit)

// List organization integrations
router.get(
  '/organizations/:organizationId/integrations',
  validateOrganizationIdParam,
  validateIntegrationQuery,
  IntegrationController.listIntegrations
)

// Create integration
router.post(
  '/organizations/:organizationId/integrations',
  validateOrganizationIdParam,
  validateCreateIntegration,
  IntegrationController.createIntegration
)

// Get specific integration
router.get(
  '/organizations/:organizationId/integrations/:integrationId',
  validateOrganizationIdParam,
  validateIntegrationIdParam,
  IntegrationController.getIntegration
)

// Update integration
router.patch(
  '/organizations/:organizationId/integrations/:integrationId',
  validateOrganizationIdParam,
  validateIntegrationIdParam,
  validateUpdateIntegration,
  IntegrationController.updateIntegration
)

// Delete integration
router.delete(
  '/organizations/:organizationId/integrations/:integrationId',
  validateOrganizationIdParam,
  validateIntegrationIdParam,
  IntegrationController.deleteIntegration
)

// Test integration connection
router.post(
  '/organizations/:organizationId/integrations/:integrationId/test',
  validateOrganizationIdParam,
  validateIntegrationIdParam,
  validateTestIntegration,
  IntegrationController.testIntegration
)

// Get webhook configurations
router.get(
  '/organizations/:organizationId/webhooks',
  validateOrganizationIdParam,
  validateWebhookQuery,
  IntegrationController.listWebhooks
)

// Create webhook
router.post(
  '/organizations/:organizationId/webhooks',
  validateOrganizationIdParam,
  validateCreateWebhook,
  IntegrationController.createWebhook
)

// Get webhook
router.get(
  '/organizations/:organizationId/webhooks/:webhookId',
  validateOrganizationIdParam,
  validateWebhookIdParam,
  IntegrationController.getWebhook
)

// Update webhook
router.patch(
  '/organizations/:organizationId/webhooks/:webhookId',
  validateOrganizationIdParam,
  validateWebhookIdParam,
  validateUpdateWebhook,
  IntegrationController.updateWebhook
)

// Delete webhook
router.delete(
  '/organizations/:organizationId/webhooks/:webhookId',
  validateOrganizationIdParam,
  validateWebhookIdParam,
  IntegrationController.deleteWebhook
)

// Test webhook
router.post(
  '/organizations/:organizationId/webhooks/:webhookId/test',
  validateOrganizationIdParam,
  validateWebhookIdParam,
  validateTestWebhook,
  IntegrationController.testWebhook
)

export default router