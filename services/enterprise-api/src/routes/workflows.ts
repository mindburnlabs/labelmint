import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { WorkflowController } from '../controllers/WorkflowController.js'
import {
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  validateCreateWorkflow,
  validateUpdateWorkflow,
  validateListWorkflowsQuery,
  validateExecuteWorkflow,
  validateWorkflowTemplateQuery,
  validateTemplateIdParam,
  validateCloneWorkflow,
  validateImportWorkflow,
  validateCreateFromTemplate,
  validateListExecutionsQuery
} from '../validators/workflowValidators.js'
import { multiTenantMiddleware } from '../middleware/multiTenant.js'
import { checkSubscriptionLimit } from '../middleware/multiTenant.js'

const router = Router()

const workflowRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many workflow requests, please try again later.'
  }
})

router.use(multiTenantMiddleware)
router.use(workflowRateLimit)

// List workflows for an organization
router.get(
  '/organizations/:organizationId/workflows',
  validateOrganizationIdParam,
  validateListWorkflowsQuery,
  WorkflowController.list
)

// Create a new workflow
router.post(
  '/organizations/:organizationId/workflows',
  validateOrganizationIdParam,
  validateCreateWorkflow,
  checkSubscriptionLimit('workflows'),
  WorkflowController.create
)

// Get a specific workflow
router.get(
  '/organizations/:organizationId/workflows/:workflowId',
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  WorkflowController.get
)

// Update a workflow
router.patch(
  '/organizations/:organizationId/workflows/:workflowId',
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  validateUpdateWorkflow,
  WorkflowController.update
)

// Delete a workflow
router.delete(
  '/organizations/:organizationId/workflows/:workflowId',
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  WorkflowController.delete
)

// Execute a workflow
router.post(
  '/organizations/:organizationId/workflows/:workflowId/execute',
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  validateExecuteWorkflow,
  WorkflowController.execute
)

// Get workflow execution history
router.get(
  '/organizations/:organizationId/workflows/:workflowId/executions',
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  validateListExecutionsQuery,
  WorkflowController.getExecutions
)

// Get workflow templates
router.get(
  '/organizations/:organizationId/workflows/templates',
  validateOrganizationIdParam,
  validateWorkflowTemplateQuery,
  WorkflowController.getTemplates
)

// Create workflow from template
router.post(
  '/organizations/:organizationId/workflows/templates/:templateId',
  validateOrganizationIdParam,
  validateTemplateIdParam,
  validateCreateFromTemplate,
  checkSubscriptionLimit('workflows'),
  WorkflowController.createFromTemplate
)

// Clone a workflow
router.post(
  '/organizations/:organizationId/workflows/:workflowId/clone',
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  validateCloneWorkflow,
  checkSubscriptionLimit('workflows'),
  WorkflowController.clone
)

// Export workflow
router.get(
  '/organizations/:organizationId/workflows/:workflowId/export',
  validateOrganizationIdParam,
  validateWorkflowIdParam,
  WorkflowController.export
)

// Import workflow
router.post(
  '/organizations/:organizationId/workflows/import',
  validateOrganizationIdParam,
  validateImportWorkflow,
  checkSubscriptionLimit('workflows'),
  WorkflowController.import
)

export default router