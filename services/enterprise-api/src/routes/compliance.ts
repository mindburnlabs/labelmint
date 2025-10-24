import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../middleware/auth.js'
import { tenantMiddleware } from '../middleware/tenant.js'
import { ComplianceController } from '../controllers/ComplianceController.js'
import * as validators from '../validators/complianceValidators.js'

const router = Router()

const complianceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many compliance requests, please try again later.'
  }
})

router.use(authMiddleware)
router.use(tenantMiddleware)
router.use(complianceRateLimit)

// Compliance Policy Routes

/**
 * @route   POST /organizations/:organizationId/compliance/policies
 * @desc    Create compliance policy
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/compliance/policies',
  validators.validateCreatePolicy,
  ComplianceController.createPolicy
)

/**
 * @route   GET /organizations/:organizationId/compliance/policies
 * @desc    Get compliance policies
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/compliance/policies',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  ComplianceController.getPolicies
)

/**
 * @route   PATCH /organizations/:organizationId/compliance/policies/:policyId
 * @desc    Update compliance policy
 * @access  Private (requires organization:manage permission)
 */
router.patch(
  '/organizations/:organizationId/compliance/policies/:policyId',
  validators.validateUpdatePolicy,
  ComplianceController.updatePolicy
)

// Compliance Score Routes

/**
 * @route   GET /organizations/:organizationId/compliance/score
 * @desc    Get compliance score
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/compliance/score',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  ComplianceController.getComplianceScore
)

/**
 * @route   GET /organizations/:organizationId/compliance/dashboard
 * @desc    Get compliance dashboard data
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/compliance/dashboard',
  validators.validateGetComplianceDashboard,
  ComplianceController.getComplianceDashboard
)

// Data Processing Records Routes

/**
 * @route   POST /organizations/:organizationId/compliance/data-processing-records
 * @desc    Create data processing record
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/compliance/data-processing-records',
  validators.validateCreateDataProcessingRecord,
  ComplianceController.createDataProcessingRecord
)

// Data Subject Request Routes

/**
 * @route   POST /organizations/:organizationId/compliance/data-subject-requests
 * @desc    Create data subject request
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/compliance/data-subject-requests',
  validators.validateCreateDataSubjectRequest,
  ComplianceController.createDataSubjectRequest
)

/**
 * @route   POST /organizations/:organizationId/compliance/data-subject-requests/:requestId/process
 * @desc    Process data subject request
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/compliance/data-subject-requests/:requestId/process',
  validators.validateProcessDataSubjectRequest,
  ComplianceController.processDataSubjectRequest
)

/**
 * @route   GET /organizations/:organizationId/compliance/data-subject-requests
 * @desc    Get data subject requests
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/compliance/data-subject-requests',
  validators.validateGetDataSubjectRequests,
  ComplianceController.getDataSubjectRequests
)

// Audit Trail Routes

/**
 * @route   GET /organizations/:organizationId/compliance/audit-trail
 * @desc    Get audit trail
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/compliance/audit-trail',
  validators.validateGetAuditTrail,
  ComplianceController.getAuditTrail
)

// Compliance Reports Routes

/**
 * @route   POST /organizations/:organizationId/compliance/reports
 * @desc    Generate compliance report
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/compliance/reports',
  validators.validateGenerateComplianceReport,
  ComplianceController.generateComplianceReport
)

// Data Protection Routes

/**
 * @route   POST /organizations/:organizationId/compliance/anonymize-data
 * @desc    Anonymize personal data
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/compliance/anonymize-data',
  validators.validateAnonymizePersonalData,
  ComplianceController.anonymizePersonalData
)

/**
 * @route   GET /organizations/:organizationId/compliance/data-retention-check
 * @desc    Check data retention compliance
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/compliance/data-retention-check',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  ComplianceController.checkDataRetentionCompliance
)

/**
 * @route   GET /organizations/:organizationId/compliance/export-subject-data
 * @desc    Export subject data
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/compliance/export-subject-data',
  validators.validateExportSubjectData,
  ComplianceController.exportSubjectData
)

export default router
