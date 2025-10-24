import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { ComplianceService } from '../services/ComplianceService.js'
import { logger } from '../utils/logger.js'
import { prisma } from '../app.js'

export class ComplianceController {

  /**
   * Create compliance policy
   */
  static async createPolicy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const policyData = req.body

      const policy = await ComplianceService.createPolicy(organizationId, policyData)

      res.status(201).json({
        success: true,
        data: policy,
        message: 'Compliance policy created successfully'
      })
    } catch (error) {
      logger.error('Create compliance policy error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get compliance policies
   */
  static async getPolicies(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { type } = req.query

      const policies = await ComplianceService.getPolicies(organizationId, type as string)

      res.json({
        success: true,
        data: policies,
        message: 'Compliance policies retrieved successfully'
      })
    } catch (error) {
      logger.error('Get compliance policies error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Update compliance policy
   */
  static async updatePolicy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, policyId } = req.params
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const updates = req.body

      const policy = await ComplianceService.updatePolicy(organizationId, policyId, updates)

      res.json({
        success: true,
        data: policy,
        message: 'Compliance policy updated successfully'
      })
    } catch (error) {
      logger.error('Update compliance policy error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get compliance score
   */
  static async getComplianceScore(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params

      const score = await ComplianceService.getComplianceScore(organizationId)

      res.json({
        success: true,
        data: score,
        message: 'Compliance score retrieved successfully'
      })
    } catch (error) {
      logger.error('Get compliance score error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Create data processing record
   */
  static async createDataProcessingRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const recordData = req.body

      const record = await ComplianceService.createDataProcessingRecord(organizationId, recordData)

      res.status(201).json({
        success: true,
        data: record,
        message: 'Data processing record created successfully'
      })
    } catch (error) {
      logger.error('Create data processing record error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Create data subject request
   */
  static async createDataSubjectRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const requestData = req.body

      const request = await ComplianceService.createDataSubjectRequest(organizationId, requestData)

      res.status(201).json({
        success: true,
        data: request,
        message: 'Data subject request created successfully'
      })
    } catch (error) {
      logger.error('Create data subject request error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Process data subject request
   */
  static async processDataSubjectRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, requestId } = req.params
      if (!organizationId || !requestId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID and request ID are required'
        })
        return
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const userId = req.user?.id

      const { response, evidence } = req.body

      const request = await ComplianceService.processDataSubjectRequest(
        organizationId,
        requestId,
        userId,
        response,
        evidence
      )

      res.json({
        success: true,
        data: request,
        message: 'Data subject request processed successfully'
      })
    } catch (error) {
      logger.error('Process data subject request error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { reportType } = req.query

      const report = await ComplianceService.generateComplianceReport(
        organizationId,
        reportType as 'gdpr' | 'soc2' | 'full'
      )

      res.json({
        success: true,
        data: report,
        message: 'Compliance report generated successfully'
      })
    } catch (error) {
      logger.error('Generate compliance report error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get audit trail
   */
  static async getAuditTrail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const filters: {
        days?: number;
        category?: string;
        severity?: string;
        userId?: string;
        action?: string;
        limit?: number;
        offset?: number;
      } = {
        ...(req.query.days && { days: parseInt(req.query.days as string) }),
        ...(req.query.category && { category: req.query.category as string }),
        ...(req.query.severity && { severity: req.query.severity as string }),
        ...(req.query.userId && { userId: req.query.userId as string }),
        ...(req.query.action && { action: req.query.action as string }),
        ...(req.query.limit && { limit: parseInt(req.query.limit as string) }),
        ...(req.query.offset && { offset: parseInt(req.query.offset as string) })
      }

      const auditTrail = await ComplianceService.getAuditTrail(organizationId, filters)

      res.json({
        success: true,
        data: auditTrail,
        message: 'Audit trail retrieved successfully'
      })
    } catch (error) {
      logger.error('Get audit trail error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Anonymize personal data
   */
  static async anonymizePersonalData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const { dataSubjectId, reason } = req.body
      const userId = req.user?.id || ''

      await ComplianceService.anonymizePersonalData(organizationId, dataSubjectId, reason, userId)

      res.json({
        success: true,
        message: 'Personal data anonymized successfully'
      })
    } catch (error) {
      logger.error('Anonymize personal data error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Check data retention compliance
   */
  static async checkDataRetentionCompliance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params

      const compliance = await ComplianceService.checkDataRetentionCompliance(organizationId)

      res.json({
        success: true,
        data: compliance,
        message: 'Data retention compliance check completed'
      })
    } catch (error) {
      logger.error('Check data retention compliance error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Export subject data
   */
  static async exportSubjectData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { dataSubjectId } = req.query

      if (!dataSubjectId) {
        res.status(400).json({
          success: false,
          error: 'Data subject ID is required'
        })
        return
      }

      const exportData = await ComplianceService.exportSubjectData(organizationId, dataSubjectId as string)

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="subject-data-${dataSubjectId}.json"`)

      res.json({
        success: true,
        data: exportData,
        message: 'Subject data exported successfully'
      })
    } catch (error) {
      logger.error('Export subject data error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get data subject requests
   */
  static async getDataSubjectRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { status, type, limit = 50, offset = 0 } = req.query

      const whereClause: any = { organizationId }
      if (status) whereClause.status = status as string
      if (type) whereClause.type = type as string

      const requests = await prisma.dataSubjectRequest.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      })

      res.json({
        success: true,
        data: requests,
        message: 'Data subject requests retrieved successfully'
      })
    } catch (error) {
      logger.error('Get data subject requests error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get compliance dashboard data
   */
  static async getComplianceDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { days = 30 } = req.query

      // Get multiple compliance metrics in parallel
      const [complianceScore, retentionCompliance, auditTrail, subjectRequests] = await Promise.all([
        ComplianceService.getComplianceScore(organizationId),
        ComplianceService.checkDataRetentionCompliance(organizationId),
        ComplianceService.getAuditTrail(organizationId, { days: parseInt(days as string) }),
        prisma.dataSubjectRequest.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ])

      const dashboardData = {
        overview: {
          overallScore: complianceScore.overall,
          criticalIssues: complianceScore.criticalIssues.length,
          totalPolicies: Object.keys(complianceScore.byPolicy).length,
          retentionCompliant: retentionCompliance.compliant
        },
        categoryScores: complianceScore.byCategory,
        recentAuditEvents: auditTrail.slice(0, 20),
        recentSubjectRequests: subjectRequests,
        expiredRecords: retentionCompliance.expiredRecords.length,
        recommendations: this.generateDashboardRecommendations(complianceScore, retentionCompliance)
      }

      res.json({
        success: true,
        data: dashboardData,
        message: 'Compliance dashboard data retrieved successfully'
      })
    } catch (error) {
      logger.error('Get compliance dashboard error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Generate dashboard recommendations
   */
  private static generateDashboardRecommendations(complianceScore: any, retentionCompliance: any): string[] {
    const recommendations: string[] = []

    if (complianceScore.overall < 80) {
      recommendations.push('Overall compliance score needs improvement')
    }

    if (!retentionCompliance.compliant) {
      recommendations.push(`${retentionCompliance.expiredRecords.length} records have exceeded retention period`)
    }

    if (complianceScore.criticalIssues.length > 0) {
      recommendations.push(`${complianceScore.criticalIssues.length} critical issues require immediate attention`)
    }

    // Check specific categories
    for (const [category, score] of Object.entries(complianceScore.byCategory || {})) {
      const numericScore = typeof score === 'number' ? score : Number(score)
      if (numericScore < 75) {
        recommendations.push(`${category.replace('-', ' ')} needs improvement (${Math.round(numericScore)}%)`)
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Compliance posture is strong - continue regular monitoring')
    }

    return recommendations
  }
}