import { DatabaseService } from '../database/DatabaseService';
import { Logger } from '../utils/logger';
import { GDPRService } from './GDPRService';

interface RetentionPolicy {
  id: string;
  dataType: string;
  retentionPeriod: number; // in days
  retentionType: 'fixed' | 'event_based' | 'indefinite';
  legalBasis?: string;
  businessRequirement?: string;
  autoDelete: boolean;
  reviewRequired: boolean;
  lastReviewed: Date;
  nextReview: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DataClassification {
  category: 'personal' | 'sensitive' | 'financial' | 'health' | 'business' | 'system';
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresEncryption: boolean;
  requiresAccessControl: boolean;
  requiresAuditLog: boolean;
  retentionDays: number;
  legalHoldApplicable: boolean;
  gdprApplicable: boolean;
  ccpaApplicable: boolean;
}

interface LegalHold {
  id: string;
  caseId: string;
  caseType: 'litigation' | 'investigation' | 'regulatory';
  description: string;
  affectedDataTypes: string[];
  affectedUsers?: string[];
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'expired' | 'lifted';
  requestedBy: string;
  approvedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DeletionRequest {
  id: string;
  userId?: string;
  dataType: string;
  recordId: string;
  reason: 'retention_expired' | 'user_request' | 'legal_requirement' | 'system_cleanup';
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  processedAt?: Date;
  processedBy?: string;
  failureReason?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export class DataRetentionService {
  private db: DatabaseService;
  private gdprService: GDPRService;
  private logger: Logger;

  constructor(db: DatabaseService) {
    this.db = db;
    this.gdprService = new GDPRService(db);
    this.logger = new Logger('DataRetentionService');
  }

  /**
   * Initialize default retention policies
   */
  async initializeDefaultPolicies(): Promise<void> {
    try {
      const defaultPolicies: Omit<RetentionPolicy, 'id' | 'lastReviewed' | 'nextReview' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
        {
          dataType: 'user_profile',
          retentionPeriod: 2555, // 7 years (GDPR recommendation)
          retentionType: 'event_based',
          legalBasis: 'legitimate_interest',
          businessRequirement: 'User account management and service delivery',
          autoDelete: true,
          reviewRequired: true
        },
        {
          dataType: 'authentication_logs',
          retentionPeriod: 365, // 1 year
          retentionType: 'fixed',
          legalBasis: 'legal_obligation',
          businessRequirement: 'Security monitoring and incident response',
          autoDelete: true,
          reviewRequired: false
        },
        {
          dataType: 'transaction_records',
          retentionPeriod: 2555, // 7 years (financial regulations)
          retentionType: 'fixed',
          legalBasis: 'legal_obligation',
          businessRequirement: 'Financial compliance and audit trails',
          autoDelete: true,
          reviewRequired: true
        },
        {
          dataType: 'kyc_documents',
          retentionPeriod: 2555, // 7 years after account closure
          retentionType: 'event_based',
          legalBasis: 'legal_obligation',
          businessRequirement: 'AML compliance and regulatory requirements',
          autoDelete: true,
          reviewRequired: true
        },
        {
          dataType: 'communication_logs',
          retentionPeriod: 730, // 2 years
          retentionType: 'fixed',
          legalBasis: 'legitimate_interest',
          businessRequirement: 'Customer service and dispute resolution',
          autoDelete: true,
          reviewRequired: false
        },
        {
          dataType: 'analytics_data',
          retentionPeriod: 365, // 1 year
          retentionType: 'fixed',
          legalBasis: 'legitimate_interest',
          businessRequirement: 'Business analytics and service improvement',
          autoDelete: true,
          reviewRequired: false
        },
        {
          dataType: 'audit_logs',
          retentionPeriod: 2555, // 7 years
          retentionType: 'fixed',
          legalBasis: 'legal_obligation',
          businessRequirement: 'Compliance and security auditing',
          autoDelete: true,
          reviewRequired: true
        },
        {
          dataType: 'consent_records',
          retentionPeriod: 2555, // 7 years after withdrawal
          retentionType: 'event_based',
          legalBasis: 'legal_obligation',
          businessRequirement: 'GDPR compliance and consent management',
          autoDelete: true,
          reviewRequired: true
        },
        {
          dataType: 'error_logs',
          retentionPeriod: 90, // 3 months
          retentionType: 'fixed',
          legalBasis: 'legitimate_interest',
          businessRequirement: 'System maintenance and debugging',
          autoDelete: true,
          reviewRequired: false
        },
        {
          dataType: 'session_data',
          retentionPeriod: 30, // 1 month
          retentionType: 'fixed',
          legalBasis: 'legitimate_interest',
          businessRequirement: 'User session management',
          autoDelete: true,
          reviewRequired: false
        }
      ];

      for (const policy of defaultPolicies) {
        await this.createRetentionPolicy(policy, 'system');
      }

      this.logger.info('Default retention policies initialized', {
        policiesCount: defaultPolicies.length
      });
    } catch (error) {
      this.logger.error('Failed to initialize default retention policies', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create retention policy
   */
  async createRetentionPolicy(policy: Omit<RetentionPolicy, 'id' | 'lastReviewed' | 'nextReview' | 'createdBy' | 'createdAt' | 'updatedAt'>, createdBy: string): Promise<RetentionPolicy> {
    try {
      const now = new Date();
      const nextReview = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from now

      const retentionPolicy: RetentionPolicy = {
        ...policy,
        id: this.generateId(),
        lastReviewed: now,
        nextReview,
        createdBy,
        createdAt: now,
        updatedAt: now
      };

      await this.db.query(`
        INSERT INTO retention_policies
        (id, data_type, retention_period, retention_type, legal_basis, business_requirement,
         auto_delete, review_required, last_reviewed, next_review, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        retentionPolicy.id,
        retentionPolicy.dataType,
        retentionPolicy.retentionPeriod,
        retentionPolicy.retentionType,
        retentionPolicy.legalBasis,
        retentionPolicy.businessRequirement,
        retentionPolicy.autoDelete,
        retentionPolicy.reviewRequired,
        retentionPolicy.lastReviewed,
        retentionPolicy.nextReview,
        retentionPolicy.createdBy,
        retentionPolicy.createdAt,
        retentionPolicy.updatedAt
      ]);

      this.logger.info('Retention policy created', {
        policyId: retentionPolicy.id,
        dataType: retentionPolicy.dataType,
        retentionPeriod: retentionPolicy.retentionPeriod,
        createdBy
      });

      return retentionPolicy;
    } catch (error) {
      this.logger.error('Failed to create retention policy', {
        dataType: policy.dataType,
        createdBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check for data ready for deletion
   */
  async checkRetentionCompliance(): Promise<{
    expiredRecords: Array<{
      dataType: string;
      recordId: string;
      userId?: string;
      retentionDate: Date;
      daysOverdue: number;
    }>;
    policiesNeedingReview: RetentionPolicy[];
    totalRecords: number;
  }> {
    try {
      const expiredRecords: Array<{
        dataType: string;
        recordId: string;
        userId?: string;
        retentionDate: Date;
        daysOverdue: number;
      }> = [];

      // Get all active retention policies
      const policies = await this.getActiveRetentionPolicies();
      const now = new Date();

      for (const policy of policies) {
        if (!policy.autoDelete) continue; // Skip policies that don't auto-delete

        // Check each data type for expired records
        const records = await this.getExpiredRecordsForType(policy.dataType, policy.retentionPeriod);

        for (const record of records) {
          // Check if record is under legal hold
          const isUnderHold = await this.isRecordUnderLegalHold(record.recordId, policy.dataType);

          if (!isUnderHold) {
            const daysOverdue = Math.floor((now.getTime() - record.retentionDate.getTime()) / (24 * 60 * 60 * 1000));

            expiredRecords.push({
              dataType: policy.dataType,
              recordId: record.recordId,
              userId: record.userId,
              retentionDate: record.retentionDate,
              daysOverdue
            });
          }
        }
      }

      // Check for policies needing review
      const policiesNeedingReview = policies.filter(policy =>
        policy.reviewRequired && policy.nextReview <= now
      );

      this.logger.info('Retention compliance check completed', {
        expiredRecords: expiredRecords.length,
        policiesNeedingReview: policiesNeedingReview.length,
        totalPolicies: policies.length
      });

      return {
        expiredRecords,
        policiesNeedingReview,
        totalRecords: expiredRecords.length
      };
    } catch (error) {
      this.logger.error('Failed to check retention compliance', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Schedule deletion of expired records
   */
  async scheduleDeletion(expiredRecords: Array<{
    dataType: string;
    recordId: string;
    userId?: string;
  }>, scheduledBy: string): Promise<DeletionRequest[]> {
    try {
      const deletionRequests: DeletionRequest[] = [];
      const scheduledFor = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Schedule for tomorrow

      for (const record of expiredRecords) {
        const deletionRequest: DeletionRequest = {
          id: this.generateId(),
          userId: record.userId,
          dataType: record.dataType,
          recordId: record.recordId,
          reason: 'retention_expired',
          scheduledFor,
          status: 'pending',
          metadata: {
            scheduledBy,
            originalRetentionDate: new Date().toISOString()
          },
          createdAt: new Date()
        };

        await this.db.query(`
          INSERT INTO deletion_requests
          (id, user_id, data_type, record_id, reason, scheduled_for, status, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          deletionRequest.id,
          deletionRequest.userId,
          deletionRequest.dataType,
          deletionRequest.recordId,
          deletionRequest.reason,
          deletionRequest.scheduledFor,
          deletionRequest.status,
          JSON.stringify(deletionRequest.metadata),
          deletionRequest.createdAt
        ]);

        deletionRequests.push(deletionRequest);
      }

      this.logger.info('Deletion requests scheduled', {
        requestCount: deletionRequests.length,
        scheduledBy,
        scheduledFor
      });

      return deletionRequests;
    } catch (error) {
      this.logger.error('Failed to schedule deletion', {
        recordCount: expiredRecords.length,
        scheduledBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process scheduled deletions
   */
  async processScheduledDeletions(): Promise<{
    processed: number;
    failed: number;
    errors: Array<{ requestId: string; error: string }>;
  }> {
    try {
      const pendingRequests = await this.getPendingDeletionRequests();
      let processed = 0;
      let failed = 0;
      const errors: Array<{ requestId: string; error: string }> = [];

      for (const request of pendingRequests) {
        try {
          // Check if request is still valid (not under legal hold)
          const isUnderHold = await this.isRecordUnderLegalHold(request.recordId, request.dataType);

          if (isUnderHold) {
            // Cancel deletion request due to legal hold
            await this.updateDeletionRequest(request.id, 'cancelled', undefined, 'Record under legal hold');
            this.logger.info('Deletion cancelled due to legal hold', {
              requestId: request.id,
              recordId: request.recordId
            });
            continue;
          }

          // Perform the deletion
          await this.executeDeletion(request);
          await this.updateDeletionRequest(request.id, 'completed', 'system');
          processed++;

          this.logger.info('Record deleted successfully', {
            requestId: request.id,
            dataType: request.dataType,
            recordId: request.recordId
          });

        } catch (error) {
          failed++;
          errors.push({
            requestId: request.id,
            error: error.message
          });

          await this.updateDeletionRequest(request.id, 'failed', undefined, error.message);

          this.logger.error('Failed to delete record', {
            requestId: request.id,
            recordId: request.recordId,
            error: error.message
          });
        }
      }

      this.logger.info('Scheduled deletions processed', {
        processed,
        failed,
        total: pendingRequests.length
      });

      return { processed, failed, errors };
    } catch (error) {
      this.logger.error('Failed to process scheduled deletions', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Place data on legal hold
   */
  async placeLegalHold(legalHold: Omit<LegalHold, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<LegalHold> {
    try {
      const now = new Date();
      const hold: LegalHold = {
        ...legalHold,
        id: this.generateId(),
        status: 'active',
        createdAt: now,
        updatedAt: now
      };

      await this.db.query(`
        INSERT INTO legal_holds
        (id, case_id, case_type, description, affected_data_types, affected_users,
         start_date, end_date, status, requested_by, approved_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        hold.id,
        hold.caseId,
        hold.caseType,
        hold.description,
        JSON.stringify(hold.affectedDataTypes),
        hold.affectedUsers ? JSON.stringify(hold.affectedUsers) : null,
        hold.startDate,
        hold.endDate,
        hold.status,
        hold.requestedBy,
        hold.approvedBy,
        hold.createdAt,
        hold.updatedAt
      ]);

      // Cancel any pending deletion requests for affected data
      await this.cancelDeletionsForLegalHold(hold);

      this.logger.info('Legal hold placed', {
        holdId: hold.id,
        caseId: hold.caseId,
        caseType: hold.caseType,
        affectedDataTypes: hold.affectedDataTypes.length
      });

      return hold;
    } catch (error) {
      this.logger.error('Failed to place legal hold', {
        caseId: legalHold.caseId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update legal hold
   */
  async updateLegalHold(holdId: string, updates: Partial<Pick<LegalHold, 'endDate' | 'status' | 'description'>>): Promise<LegalHold> {
    try {
      const existing = await this.getLegalHold(holdId);
      if (!existing) {
        throw new Error('Legal hold not found');
      }

      const updated: LegalHold = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      await this.db.query(`
        UPDATE legal_holds
        SET end_date = $1, status = $2, description = $3, updated_at = $4
        WHERE id = $5
      `, [
        updated.endDate,
        updated.status,
        updated.description,
        updated.updatedAt,
        holdId
      ]);

      this.logger.info('Legal hold updated', {
        holdId,
        updates: Object.keys(updates)
      });

      return updated;
    } catch (error) {
      this.logger.error('Failed to update legal hold', {
        holdId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get data retention report
   */
  async getRetentionReport(filters: {
    dataType?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    includeUnderHold?: boolean;
  } = {}): Promise<{
    summary: {
      totalRecords: number;
      expiredRecords: number;
      recordsUnderHold: number;
      upcomingDeletions: number;
      policiesNeedingReview: number;
    };
    details: Array<{
      dataType: string;
      totalRecords: number;
      expiredRecords: number;
      averageAge: number;
      oldestRecord: Date;
      newestRecord: Date;
      underHold: number;
    }>;
  }> {
    try {
      const summary = {
        totalRecords: 0,
        expiredRecords: 0,
        recordsUnderHold: 0,
        upcomingDeletions: 0,
        policiesNeedingReview: 0
      };

      const details: Array<{
        dataType: string;
        totalRecords: number;
        expiredRecords: number;
        averageAge: number;
        oldestRecord: Date;
        newestRecord: Date;
        underHold: number;
      }> = [];

      // Get all data types with retention policies
      const policies = await this.getActiveRetentionPolicies();

      for (const policy of policies) {
        const stats = await this.getDataTypeStatistics(policy.dataType, filters);

        details.push({
          dataType: policy.dataType,
          ...stats
        });

        summary.totalRecords += stats.totalRecords;
        summary.expiredRecords += stats.expiredRecords;
        summary.recordsUnderHold += stats.underHold;
      }

      // Get upcoming deletions
      const upcomingDeletions = await this.getUpcomingDeletions();
      summary.upcomingDeletions = upcomingDeletions.length;

      // Get policies needing review
      const policiesNeedingReview = policies.filter(policy =>
        policy.reviewRequired && policy.nextReview <= new Date()
      );
      summary.policiesNeedingReview = policiesNeedingReview.length;

      return { summary, details };
    } catch (error) {
      this.logger.error('Failed to generate retention report', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private async getActiveRetentionPolicies(): Promise<RetentionPolicy[]> {
    const result = await this.db.query(`
      SELECT * FROM retention_policies
      WHERE auto_delete = true
      ORDER BY data_type
    `);

    return result.rows.map(row => ({
      id: row.id,
      dataType: row.data_type,
      retentionPeriod: row.retention_period,
      retentionType: row.retention_type,
      legalBasis: row.legal_basis,
      businessRequirement: row.business_requirement,
      autoDelete: row.auto_delete,
      reviewRequired: row.review_required,
      lastReviewed: row.last_reviewed,
      nextReview: row.next_review,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  private async getExpiredRecordsForType(dataType: string, retentionPeriod: number): Promise<Array<{
    recordId: string;
    userId?: string;
    retentionDate: Date;
  }>> {
    // This is a mock implementation - in production, you would query the actual tables
    // based on the data type and calculate retention dates
    const retentionDate = new Date(Date.now() - (retentionPeriod * 24 * 60 * 60 * 1000));

    const result = await this.db.query(`
      SELECT
        id as record_id,
        user_id,
        created_at as retention_date
      FROM ${this.getTableNameForDataType(dataType)}
      WHERE created_at < $1
      AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1000
    `, [retentionDate]);

    return result.rows.map(row => ({
      recordId: row.record_id,
      userId: row.user_id,
      retentionDate: row.retention_date
    }));
  }

  private async isRecordUnderLegalHold(recordId: string, dataType: string): Promise<boolean> {
    const result = await this.db.query(`
      SELECT 1 FROM legal_holds lh
      WHERE lh.status = 'active'
      AND (lh.end_date IS NULL OR lh.end_date > NOW())
      AND ($1 = ANY(lh.affected_data_types) OR lh.affected_data_types @> ARRAY[$1]::text[])
      LIMIT 1
    `, [dataType]);

    return result.rows.length > 0;
  }

  private async getPendingDeletionRequests(): Promise<DeletionRequest[]> {
    const result = await this.db.query(`
      SELECT * FROM deletion_requests
      WHERE status = 'pending'
      AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC
      LIMIT 100
    `);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      dataType: row.data_type,
      recordId: row.record_id,
      reason: row.reason,
      scheduledFor: row.scheduled_for,
      status: row.status,
      processedAt: row.processed_at,
      processedBy: row.processed_by,
      failureReason: row.failure_reason,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at
    }));
  }

  private async executeDeletion(request: DeletionRequest): Promise<void> {
    // This would implement the actual deletion logic based on data type
    // For now, we'll simulate it with a soft delete

    await this.db.query(`
      UPDATE ${this.getTableNameForDataType(request.dataType)}
      SET deleted_at = NOW(), deletion_reason = $1
      WHERE id = $2
    `, [request.reason, request.recordId]);

    // Log the deletion
    await this.gdprService.logAuditEvent({
      category: 'data_deletion',
      severity: 'medium',
      userId: request.userId,
      action: 'automatic_data_deletion',
      resourceType: request.dataType,
      resourceId: request.recordId,
      metadata: {
        reason: request.reason,
        requestId: request.id
      }
    });
  }

  private async updateDeletionRequest(requestId: string, status: string, processedBy?: string, failureReason?: string): Promise<void> {
    await this.db.query(`
      UPDATE deletion_requests
      SET status = $1, processed_at = NOW(), processed_by = $2, failure_reason = $3
      WHERE id = $4
    `, [status, processedBy, failureReason, requestId]);
  }

  private async cancelDeletionsForLegalHold(legalHold: LegalHold): Promise<void> {
    for (const dataType of legalHold.affectedDataTypes) {
      await this.db.query(`
        UPDATE deletion_requests dr
        SET status = 'cancelled', failure_reason = 'Legal hold placed'
        WHERE dr.status = 'pending'
        AND dr.data_type = $1
        AND dr.record_id IN (
          SELECT id FROM ${this.getTableNameForDataType(dataType)}
          WHERE user_id = ANY($2) OR $2 IS NULL
        )
      `, [dataType, legalHold.affectedUsers ? JSON.stringify(legalHold.affectedUsers) : null]);
    }
  }

  private async getLegalHold(holdId: string): Promise<LegalHold | null> {
    const result = await this.db.query(`
      SELECT * FROM legal_holds WHERE id = $1
    `, [holdId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      caseId: row.case_id,
      caseType: row.case_type,
      description: row.description,
      affectedDataTypes: JSON.parse(row.affected_data_types),
      affectedUsers: row.affected_users ? JSON.parse(row.affected_users) : undefined,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      requestedBy: row.requested_by,
      approvedBy: row.approved_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private async getUpcomingDeletions(): Promise<DeletionRequest[]> {
    const result = await this.db.query(`
      SELECT * FROM deletion_requests
      WHERE status = 'pending'
      AND scheduled_for > NOW()
      AND scheduled_for <= NOW() + INTERVAL '7 days'
      ORDER BY scheduled_for ASC
    `);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      dataType: row.data_type,
      recordId: row.record_id,
      reason: row.reason,
      scheduledFor: row.scheduled_for,
      status: row.status,
      processedAt: row.processed_at,
      processedBy: row.processed_by,
      failureReason: row.failure_reason,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at
    }));
  }

  private async getDataTypeStatistics(dataType: string, filters: any): Promise<{
    totalRecords: number;
    expiredRecords: number;
    averageAge: number;
    oldestRecord: Date;
    newestRecord: Date;
    underHold: number;
  }> {
    const tableName = this.getTableNameForDataType(dataType);
    let whereClause = 'deleted_at IS NULL';
    const params: any[] = [];

    if (filters.userId) {
      whereClause += ' AND user_id = $' + (params.length + 1);
      params.push(filters.userId);
    }

    const result = await this.db.query(`
      SELECT
        COUNT(*) as total_records,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as avg_age,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record,
        COUNT(CASE WHEN created_at < NOW() - INTERVAL '7 years' THEN 1 END) as expired_records
      FROM ${tableName}
      WHERE ${whereClause}
    `, params);

    const underHoldResult = await this.db.query(`
      SELECT COUNT(*) as under_hold
      FROM legal_holds lh
      WHERE lh.status = 'active'
      AND (lh.end_date IS NULL OR lh.end_date > NOW())
      AND $1 = ANY(lh.affected_data_types)
    `, [dataType]);

    return {
      totalRecords: parseInt(result.rows[0].total_records),
      expiredRecords: parseInt(result.rows[0].expired_records),
      averageAge: parseFloat(result.rows[0].avg_age) || 0,
      oldestRecord: result.rows[0].oldest_record,
      newestRecord: result.rows[0].newest_record,
      underHold: parseInt(underHoldResult.rows[0].under_hold)
    };
  }

  private getTableNameForDataType(dataType: string): string {
    const tableMap: Record<string, string> = {
      'user_profile': 'users',
      'authentication_logs': 'auth_logs',
      'transaction_records': 'transactions',
      'kyc_documents': 'kyc_requests',
      'communication_logs': 'communication_logs',
      'analytics_data': 'analytics_events',
      'audit_logs': 'audit_logs',
      'consent_records': 'user_consents',
      'error_logs': 'error_logs',
      'session_data': 'user_sessions'
    };

    return tableMap[dataType] || 'unknown_table';
  }

  private generateId(): string {
    return 'dr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}