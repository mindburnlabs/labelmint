import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface CompliancePolicy {
  id: string
  name: string
  type: 'gdpr' | 'soc2' | 'hipaa' | 'pci-dss' | 'custom'
  description: string
  requirements: ComplianceRequirement[]
  enabled: boolean
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

export interface ComplianceRequirement {
  id: string
  name: string
  description: string
  category: 'data-protection' | 'access-control' | 'audit-logging' | 'encryption' | 'retention' | 'consent'
  mandatory: boolean
  implementation: 'implemented' | 'partial' | 'not-implemented'
  lastReviewed: Date
  nextReview: Date
  evidence: string[]
  owner: string
}

export interface DataProcessingRecord {
  id: string
  organizationId: string
  dataSubjectId?: string
  dataTypes: string[]
  processingPurpose: string
  legalBasis: 'consent' | 'contract' | 'legal-obligation' | 'vital-interests' | 'public-task' | 'legitimate-interests'
  processingActivities: string[]
  dataController: string
  dataProcessor?: string
  retentionPeriod: number
  deletionDate?: Date
  consentDetails?: {
    givenAt: Date
    withdrawnAt?: Date
    method: string
    version: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface AuditTrail {
  id: string
  organizationId: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'access' | 'modification' | 'deletion' | 'export' | 'system' | 'security'
  complianceTags: string[]
}

export interface DataSubjectRequest {
  id: string
  organizationId: string
  dataSubjectId: string
  type: 'access' | 'portability' | 'rectification' | 'erasure' | 'restriction'
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  requestDetails: string
  evidence: string[]
  processedAt?: Date
  processedBy?: string
  response?: string
  createdAt: Date
  updatedAt: Date
}

export class ComplianceService {
  /**
   * Create compliance policy
   */
  static async createPolicy(organizationId: string, policy: Omit<CompliancePolicy, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<CompliancePolicy> {
    try {
      const compliancePolicy = await prisma.compliancePolicy.create({
        data: {
          ...policy,
          organizationId,
          requirements: {
            create: policy.requirements.map(req => ({
              name: req.name,
              description: req.description,
              category: req.category,
              mandatory: req.mandatory,
              implementation: req.implementation,
              lastReviewed: req.lastReviewed,
              nextReview: req.nextReview,
              evidence: req.evidence,
              owner: req.owner
            }))
          }
        },
        include: {
          requirements: true
        }
      })

      await AuditService.log({
        organizationId,
        userId: 'system',
        action: 'COMPLIANCE_POLICY_CREATED',
        resource: 'compliance',
        resourceId: compliancePolicy.id,
        details: {
          policyName: policy.name,
          policyType: policy.type,
          requirementCount: policy.requirements.length
        }
      })

      logger.info('Compliance policy created', {
        organizationId,
        policyId: compliancePolicy.id,
        policyName: policy.name
      })

      return compliancePolicy
    } catch (error) {
      logger.error('Failed to create compliance policy', {
        organizationId,
        policyName: policy.name,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get compliance policies for organization
   */
  static async getPolicies(organizationId: string, type?: string): Promise<CompliancePolicy[]> {
    try {
      const policies = await prisma.compliancePolicy.findMany({
        where: {
          organizationId,
          ...(type && { type: type as any })
        },
        include: {
          requirements: true
        },
        orderBy: { createdAt: 'desc' }
      })

      return policies.map(policy => ({
        ...policy,
        requirements: policy.requirements || []
      }))
    } catch (error) {
      logger.error('Failed to get compliance policies', {
        organizationId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Update compliance policy
   */
  static async updatePolicy(organizationId: string, policyId: string, updates: Partial<CompliancePolicy>): Promise<CompliancePolicy> {
    try {
      const policy = await prisma.compliancePolicy.update({
        where: {
          id: policyId,
          organizationId
        },
        data: {
          ...updates,
          updatedAt: new Date()
        },
        include: {
          requirements: true
        }
      })

      await AuditService.log({
        organizationId,
        userId: 'system',
        action: 'COMPLIANCE_POLICY_UPDATED',
        resource: 'compliance',
        resourceId: policyId,
        details: {
          policyName: policy.name,
          updates: Object.keys(updates)
        }
      })

      return policy
    } catch (error) {
      logger.error('Failed to update compliance policy', {
        organizationId,
        policyId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get compliance score
   */
  static async getComplianceScore(organizationId: string): Promise<{
    overall: number
    byCategory: Record<string, number>
    byPolicy: Record<string, number>
    criticalIssues: Array<{
      policyId: string
      requirementId: string
      description: string
      severity: 'high' | 'critical'
    }>
  }> {
    try {
      const policies = await this.getPolicies(organizationId)
      const categoryScores: Record<string, { total: number; implemented: number }> = {}
      const policyScores: Record<string, number> = {}
      const criticalIssues: any[] = []

      for (const policy of policies) {
        let policyScore = 0
        let totalRequirements = 0
        let implementedRequirements = 0

        for (const requirement of policy.requirements) {
          totalRequirements++

          if (requirement.implementation === 'implemented') {
            implementedRequirements++
          } else if (requirement.mandatory && requirement.implementation !== 'implemented') {
            criticalIssues.push({
              policyId: policy.id,
              requirementId: requirement.id,
              description: requirement.description,
              severity: requirement.mandatory ? 'critical' : 'high'
            })
          }

          // Track category scores
          if (!categoryScores[requirement.category]) {
            categoryScores[requirement.category] = { total: 0, implemented: 0 }
          }
          categoryScores[requirement.category].total++
          if (requirement.implementation === 'implemented') {
            categoryScores[requirement.category].implemented++
          }
        }

        policyScore = totalRequirements > 0 ? (implementedRequirements / totalRequirements) * 100 : 0
        policyScores[policy.id] = policyScore
      }

      // Calculate category percentages
      const categoryPercentages: Record<string, number> = {}
      for (const [category, scores] of Object.entries(categoryScores)) {
        categoryPercentages[category] = scores.total > 0 ? (scores.implemented / scores.total) * 100 : 0
      }

      // Calculate overall score
      const overallScore = Object.values(policyScores).length > 0
        ? Object.values(policyScores).reduce((sum, score) => sum + score, 0) / Object.values(policyScores).length
        : 0

      return {
        overall: Math.round(overallScore * 100) / 100,
        byCategory: categoryPercentages,
        byPolicy: policyScores,
        criticalIssues
      }
    } catch (error) {
      logger.error('Failed to get compliance score', {
        organizationId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Create data processing record
   */
  static async createDataProcessingRecord(organizationId: string, record: Omit<DataProcessingRecord, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<DataProcessingRecord> {
    try {
      const processingRecord = await prisma.dataProcessingRecord.create({
        data: {
          ...record,
          organizationId,
          dataTypes: record.dataTypes,
          processingActivities: record.processingActivities,
          consentDetails: record.consentDetails ? {
            create: record.consentDetails
          } : undefined
        }
      })

      await AuditService.log({
        organizationId,
        userId: 'system',
        action: 'DATA_PROCESSING_RECORD_CREATED',
        resource: 'compliance',
        resourceId: processingRecord.id,
        details: {
          dataSubjectId: record.dataSubjectId,
          dataTypes: record.dataTypes,
          legalBasis: record.legalBasis
        }
      })

      logger.info('Data processing record created', {
        organizationId,
        recordId: processingRecord.id,
        dataSubjectId: record.dataSubjectId
      })

      return processingRecord
    } catch (error) {
      logger.error('Failed to create data processing record', {
        organizationId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Create data subject request
   */
  static async createDataSubjectRequest(organizationId: string, request: Omit<DataSubjectRequest, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<DataSubjectRequest> {
    try {
      const subjectRequest = await prisma.dataSubjectRequest.create({
        data: {
          ...request,
          organizationId,
          evidence: request.evidence || []
        }
      })

      await AuditService.log({
        organizationId,
        userId: 'system',
        action: 'DATA_SUBJECT_REQUEST_CREATED',
        resource: 'compliance',
        resourceId: subjectRequest.id,
        details: {
          dataSubjectId: request.dataSubjectId,
          requestType: request.type,
          requestDetails: request.requestDetails
        }
      })

      logger.info('Data subject request created', {
        organizationId,
        requestId: subjectRequest.id,
        dataSubjectId: request.dataSubjectId,
        requestType: request.type
      })

      return subjectRequest
    } catch (error) {
      logger.error('Failed to create data subject request', {
        organizationId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Process data subject request
   */
  static async processDataSubjectRequest(organizationId: string, requestId: string, processorId: string, response: string, evidence: string[] = []): Promise<DataSubjectRequest> {
    try {
      const subjectRequest = await prisma.dataSubjectRequest.update({
        where: {
          id: requestId,
          organizationId
        },
        data: {
          status: 'completed',
          processedAt: new Date(),
          processedBy: processorId,
          response,
          evidence,
          updatedAt: new Date()
        }
      })

      await AuditService.log({
        organizationId,
        userId: processorId,
        action: 'DATA_SUBJECT_REQUEST_PROCESSED',
        resource: 'compliance',
        resourceId: requestId,
        details: {
          requestType: subjectRequest.type,
          dataSubjectId: subjectRequest.dataSubjectId,
          processorId,
          evidenceCount: evidence.length
        }
      })

      logger.info('Data subject request processed', {
        organizationId,
        requestId,
        processorId,
        requestType: subjectRequest.type
      })

      return subjectRequest
    } catch (error) {
      logger.error('Failed to process data subject request', {
        organizationId,
        requestId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(organizationId: string, reportType: 'gdpr' | 'soc2' | 'full' = 'full'): Promise<{
    id: string
    organizationId: string
    reportType: string
    generatedAt: Date
    data: any
    filePath: string
  }> {
    try {
      const reportId = crypto.randomUUID()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `compliance-report-${reportType}-${timestamp}.json`
      const filePath = path.join(process.env.REPORTS_PATH || './reports', fileName)

      // Ensure reports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      const complianceScore = await this.getComplianceScore(organizationId)
      const policies = await this.getPolicies(organizationId)
      const auditTrail = await this.getAuditTrail(organizationId, { days: 90 })

      const reportData = {
        metadata: {
          reportId,
          organizationId,
          reportType,
          generatedAt: new Date().toISOString(),
          version: '1.0'
        },
        summary: {
          overallScore: complianceScore.overall,
          totalPolicies: policies.length,
          criticalIssues: complianceScore.criticalIssues.length,
          auditEvents: auditTrail.length
        },
        complianceScore,
        policies: policies.map(policy => ({
          id: policy.id,
          name: policy.name,
          type: policy.type,
          enabled: policy.enabled,
          requirementCount: policy.requirements.length,
          implementedRequirements: policy.requirements.filter(req => req.implementation === 'implemented').length
        })),
        criticalIssues: complianceScore.criticalIssues,
        auditTrail: auditTrail.slice(0, 100), // Limit to recent events
        recommendations: this.generateRecommendations(complianceScore)
      }

      // Write report to file
      await fs.writeFile(filePath, JSON.stringify(reportData, null, 2))

      // Save report record to database
      const report = await prisma.complianceReport.create({
        data: {
          id: reportId,
          organizationId,
          reportType,
          filePath,
          generatedAt: new Date(),
          data: reportData
        }
      })

      await AuditService.log({
        organizationId,
        userId: 'system',
        action: 'COMPLIANCE_REPORT_GENERATED',
        resource: 'compliance',
        resourceId: reportId,
        details: {
          reportType,
          filePath,
          overallScore: complianceScore.overall
        }
      })

      logger.info('Compliance report generated', {
        organizationId,
        reportId,
        reportType,
        filePath
      })

      return report
    } catch (error) {
      logger.error('Failed to generate compliance report', {
        organizationId,
        reportType,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get audit trail
   */
  static async getAuditTrail(organizationId: string, filters: {
    days?: number
    category?: string
    severity?: string
    userId?: string
    action?: string
    limit?: number
    offset?: number
  } = {}): Promise<AuditTrail[]> {
    try {
      const whereClause: any = { organizationId }

      if (filters.category) {
        whereClause.category = filters.category as any
      }

      if (filters.severity) {
        whereClause.severity = filters.severity as any
      }

      if (filters.userId) {
        whereClause.userId = filters.userId
      }

      if (filters.action) {
        whereClause.action = { contains: filters.action }
      }

      if (filters.days) {
        const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000)
        whereClause.timestamp = { gte: since }
      }

      const auditRecords = await prisma.auditTrail.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 1000,
        skip: filters.offset || 0
      })

      return auditRecords
    } catch (error) {
      logger.error('Failed to get audit trail', {
        organizationId,
        filters,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Anonymize personal data
   */
  static async anonymizePersonalData(organizationId: string, dataSubjectId: string, reason: string, performedBy: string): Promise<void> {
    try {
      // Find all records containing personal data for this data subject
      const processingRecords = await prisma.dataProcessingRecord.findMany({
        where: {
          organizationId,
          dataSubjectId
        }
      })

      // Anonymize data in each record
      for (const record of processingRecords) {
        await prisma.dataProcessingRecord.update({
          where: { id: record.id },
          data: {
            dataSubjectId: null, // Remove personal identifier
            dataTypes: ['anonymized'],
            updatedAt: new Date()
          }
        })
      }

      // Log the anonymization action
      await AuditService.log({
        organizationId,
        userId: performedBy,
        action: 'DATA_ANONYMIZED',
        resource: 'compliance',
        details: {
          dataSubjectId,
          reason,
          recordsAffected: processingRecords.length
        },
        severity: 'high',
        category: 'deletion'
      })

      logger.info('Personal data anonymized', {
        organizationId,
        dataSubjectId,
        reason,
        performedBy,
        recordsAffected: processingRecords.length
      })
    } catch (error) {
      logger.error('Failed to anonymize personal data', {
        organizationId,
        dataSubjectId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Generate recommendations based on compliance score
   */
  private static generateRecommendations(complianceScore: any): string[] {
    const recommendations: string[] = []

    if (complianceScore.overall < 70) {
      recommendations.push('Overall compliance score is below 70%. Prioritize implementing mandatory requirements.')
    }

    for (const [category, score] of Object.entries(complianceScore.byCategory)) {
      if (score < 80) {
        switch (category) {
          case 'data-protection':
            recommendations.push('Data protection measures need improvement. Consider implementing encryption and access controls.')
            break
          case 'access-control':
            recommendations.push('Access control systems require attention. Review and strengthen user permissions.')
            break
          case 'audit-logging':
            recommendations.push('Audit logging is insufficient. Implement comprehensive logging for all critical operations.')
            break
          case 'encryption':
            recommendations.push('Encryption policies need strengthening. Ensure data is encrypted at rest and in transit.')
            break
          case 'retention':
            recommendations.push('Data retention policies need review. Implement automated data deletion processes.')
            break
          case 'consent':
            recommendations.push('Consent management requires improvement. Implement proper consent collection and tracking.')
            break
        }
      }
    }

    if (complianceScore.criticalIssues.length > 0) {
      recommendations.push(`${complianceScore.criticalIssues.length} critical compliance issues need immediate attention.`)
    }

    if (recommendations.length === 0) {
      recommendations.push('Compliance posture is strong. Continue monitoring and regular reviews.')
    }

    return recommendations
  }

  /**
   * Check data retention compliance
   */
  static async checkDataRetentionCompliance(organizationId: string): Promise<{
    compliant: boolean
    expiredRecords: Array<{
      id: string
      dataTypes: string[]
      retentionPeriod: number
      deletionDate: Date
      daysOverdue: number
    }>
    }> {
    try {
      const now = new Date()
      const expiredRecords: any[] = []

      const processingRecords = await prisma.dataProcessingRecord.findMany({
        where: {
          organizationId,
          retentionPeriod: { not: null }
        }
      })

      for (const record of processingRecords) {
        const retentionDate = new Date(record.createdAt.getTime() + record.retentionPeriod * 24 * 60 * 60 * 1000)

        if (retentionDate < now && !record.deletionDate) {
          expiredRecords.push({
            id: record.id,
            dataTypes: record.dataTypes,
            retentionPeriod: record.retentionPeriod,
            deletionDate: retentionDate,
            daysOverdue: Math.floor((now.getTime() - retentionDate.getTime()) / (24 * 60 * 60 * 1000))
          })
        }
      }

      return {
        compliant: expiredRecords.length === 0,
        expiredRecords
      }
    } catch (error) {
      logger.error('Failed to check data retention compliance', {
        organizationId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Export data for data subject request
   */
  static async exportSubjectData(organizationId: string, dataSubjectId: string): Promise<{
    data: any
    exportDate: Date
    format: string
  }> {
    try {
      const processingRecords = await prisma.dataProcessingRecord.findMany({
        where: {
          organizationId,
          dataSubjectId
        },
        include: {
          consentDetails: true
        }
      })

      const exportData = {
        metadata: {
          dataSubjectId,
          organizationId,
          exportDate: new Date().toISOString(),
          format: 'json',
          version: '1.0'
        },
        dataProcessingRecords: processingRecords.map(record => ({
          id: record.id,
          dataTypes: record.dataTypes,
          processingPurpose: record.processingPurpose,
          legalBasis: record.legalBasis,
          processingActivities: record.processingActivities,
          retentionPeriod: record.retentionPeriod,
          createdAt: record.createdAt,
          consentDetails: record.consentDetails
        })),
        summary: {
          totalRecords: processingRecords.length,
          dataTypes: [...new Set(processingRecords.flatMap(r => r.dataTypes))],
          legalBases: [...new Set(processingRecords.map(r => r.legalBasis))],
          purposes: [...new Set(processingRecords.map(r => r.processingPurpose))]
        }
      }

      await AuditService.log({
        organizationId,
        userId: 'system',
        action: 'DATA_SUBJECT_EXPORT',
        resource: 'compliance',
        details: {
          dataSubjectId,
          recordCount: processingRecords.length
        },
        severity: 'medium',
        category: 'export'
      })

      return {
        data: exportData,
        exportDate: new Date(),
        format: 'json'
      }
    } catch (error) {
      logger.error('Failed to export subject data', {
        organizationId,
        dataSubjectId,
        error: error.message
      })
      throw error
    }
  }
}