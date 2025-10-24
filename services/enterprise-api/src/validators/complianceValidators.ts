import { body, param, query } from 'express-validator'

// Compliance Policy Validators
export const validateCreatePolicy = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  body('name').isLength({ min: 1, max: 255 }).withMessage('Policy name is required and must be less than 255 characters'),
  body('type').isIn(['gdpr', 'soc2', 'hipaa', 'pci-dss', 'custom']).withMessage('Invalid policy type'),
  body('description').isLength({ min: 1, max: 1000 }).withMessage('Description is required and must be less than 1000 characters'),
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  body('requirements').isArray().withMessage('Requirements must be an array'),
  body('requirements.*.name').isLength({ min: 1, max: 255 }).withMessage('Requirement name is required'),
  body('requirements.*.description').isLength({ min: 1, max: 500 }).withMessage('Requirement description is required'),
  body('requirements.*.category').isIn(['data-protection', 'access-control', 'audit-logging', 'encryption', 'retention', 'consent']).withMessage('Invalid requirement category'),
  body('requirements.*.mandatory').isBoolean().withMessage('Mandatory must be a boolean'),
  body('requirements.*.implementation').isIn(['implemented', 'partial', 'not-implemented']).withMessage('Invalid implementation status'),
  body('requirements.*.owner').isLength({ min: 1, max: 255 }).withMessage('Requirement owner is required')
]

export const validateUpdatePolicy = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  param('policyId').isUUID().withMessage('Invalid policy ID'),
  body('name').optional().isLength({ min: 1, max: 255 }).withMessage('Policy name must be less than 255 characters'),
  body('description').optional().isLength({ min: 1, max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  body('requirements').optional().isArray().withMessage('Requirements must be an array')
]

// Data Processing Record Validators
export const validateCreateDataProcessingRecord = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  body('dataSubjectId').optional().isLength({ min: 1, max: 255 }).withMessage('Data subject ID must be less than 255 characters'),
  body('dataTypes').isArray({ min: 1 }).withMessage('At least one data type is required'),
  body('dataTypes.*').isLength({ min: 1, max: 100 }).withMessage('Data type must be less than 100 characters'),
  body('processingPurpose').isLength({ min: 1, max: 500 }).withMessage('Processing purpose is required'),
  body('legalBasis').isIn(['consent', 'contract', 'legal-obligation', 'vital-interests', 'public-task', 'legitimate-interests']).withMessage('Invalid legal basis'),
  body('processingActivities').isArray({ min: 1 }).withMessage('At least one processing activity is required'),
  body('processingActivities.*').isLength({ min: 1, max: 200 }).withMessage('Processing activity must be less than 200 characters'),
  body('dataController').isLength({ min: 1, max: 255 }).withMessage('Data controller is required'),
  body('dataProcessor').optional().isLength({ min: 1, max: 255 }).withMessage('Data processor must be less than 255 characters'),
  body('retentionPeriod').optional().isInt({ min: 1, max: 3650 }).withMessage('Retention period must be between 1 and 3650 days')
]

// Data Subject Request Validators
export const validateCreateDataSubjectRequest = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  body('dataSubjectId').isLength({ min: 1, max: 255 }).withMessage('Data subject ID is required'),
  body('type').isIn(['access', 'portability', 'rectification', 'erasure', 'restriction']).withMessage('Invalid request type'),
  body('requestDetails').isLength({ min: 1, max: 1000 }).withMessage('Request details are required'),
  body('evidence').optional().isArray().withMessage('Evidence must be an array'),
  body('evidence.*').optional().isURL().withMessage('Evidence must be valid URLs')
]

export const validateProcessDataSubjectRequest = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  param('requestId').isUUID().withMessage('Invalid request ID'),
  body('response').isLength({ min: 1, max: 2000 }).withMessage('Response is required'),
  body('evidence').optional().isArray().withMessage('Evidence must be an array'),
  body('evidence.*').optional().isURL().withMessage('Evidence must be valid URLs')
]

// Compliance Report Validators
export const validateGenerateComplianceReport = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  query('reportType').optional().isIn(['gdpr', 'soc2', 'full']).withMessage('Invalid report type')
]

// Audit Trail Validators
export const validateGetAuditTrail = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  query('category').optional().isIn(['access', 'modification', 'deletion', 'export', 'system', 'security']).withMessage('Invalid category'),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  query('userId').optional().isUUID().withMessage('Invalid user ID'),
  query('action').optional().isLength({ min: 1, max: 100 }).withMessage('Action filter must be less than 100 characters'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
]

// Data Anonymization Validators
export const validateAnonymizePersonalData = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  body('dataSubjectId').isLength({ min: 1, max: 255 }).withMessage('Data subject ID is required'),
  body('reason').isLength({ min: 1, max: 500 }).withMessage('Reason is required')
]

// Data Subject Request Query Validators
export const validateGetDataSubjectRequests = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'rejected']).withMessage('Invalid status'),
  query('type').optional().isIn(['access', 'portability', 'rectification', 'erasure', 'restriction']).withMessage('Invalid request type'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
]

// Compliance Dashboard Validators
export const validateGetComplianceDashboard = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
]

// Export Data Validators
export const validateExportSubjectData = [
  param('organizationId').isUUID().withMessage('Invalid organization ID'),
  query('dataSubjectId').isLength({ min: 1, max: 255 }).withMessage('Data subject ID is required')
]