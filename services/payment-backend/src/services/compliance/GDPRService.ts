import { DatabaseService } from '../database/DatabaseService';
import { PoolClient } from 'pg';
import crypto from 'crypto';
import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';

interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: string;
  status: string;
  granted_at: Date | null;
  withdrawn_at: Date | null;
  privacy_policy_version: string;
  metadata: Record<string, any>;
}

interface DSARRequest {
  id: string;
  user_id: string;
  request_type: 'export' | 'deletion' | 'rectification' | 'portability' | 'restriction';
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'requires_identity_verification';
  request_data: Record<string, any>;
  response_data: Record<string, any>;
  processed_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
}

interface UserDataExport {
  user: Record<string, any>;
  tasks: Record<string, any>[];
  responses: Record<string, any>[];
  payments: Record<string, any>[];
  consents: ConsentRecord[];
  api_usage: Record<string, any>[];
  audit_logs: Record<string, any>[];
}

export class GDPRService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Record or update user consent
   */
  async recordConsent(
    userId: string,
    consentType: string,
    status: 'granted' | 'denied' | 'withdrawn',
    ipAddress?: string,
    userAgent?: string,
    metadata: Record<string, any> = {}
  ): Promise<ConsentRecord> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Get current privacy policy version
      const policyResult = await client.query(
        'SELECT id, version FROM privacy_policy_versions WHERE is_current = true'
      );

      if (!policyResult.rows.length) {
        throw new Error('No current privacy policy version found');
      }

      const policyVersion = policyResult.rows[0];

      // Upsert consent record
      const consentResult = await client.query(`
        INSERT INTO user_consents (
          user_id, consent_type, status, granted_at, withdrawn_at,
          ip_address, user_agent, privacy_policy_version_id, metadata
        )
        VALUES ($1, $2, $3,
          CASE WHEN $3 = 'granted' THEN NOW() ELSE granted_at END,
          CASE WHEN $3 = 'withdrawn' THEN NOW() ELSE NULL END,
          $4, $5, $6, $7)
        ON CONFLICT (user_id, consent_type) DO UPDATE SET
          status = EXCLUDED.status,
          granted_at = CASE WHEN EXCLUDED.status = 'granted'
            THEN COALESCE(user_consents.granted_at, NOW())
            ELSE user_consents.granted_at END,
          withdrawn_at = CASE WHEN EXCLUDED.status = 'withdrawn'
            THEN NOW()
            ELSE user_consents.withdrawn_at END,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          updated_at = NOW(),
          metadata = EXCLUDED.metadata
        RETURNING *,
          (SELECT version FROM privacy_policy_versions WHERE id = privacy_policy_version_id) as privacy_policy_version
      `, [userId, consentType, status, ipAddress, userAgent, policyVersion.id, metadata]);

      await client.query('COMMIT');

      // Log consent change
      await this.logAuditEvent({
        category: 'compliance_event',
        severity: 'low',
        userId,
        action: 'consent_updated',
        resourceType: 'user_consent',
        metadata: {
          consentType,
          status,
          ipAddress,
          userAgent,
          policyVersion: policyVersion.version
        }
      }, client);

      return consentResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all user consents
   */
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const result = await this.db.query(`
      SELECT uc.*, ppv.version as privacy_policy_version
      FROM user_consents uc
      LEFT JOIN privacy_policy_versions ppv ON uc.privacy_policy_version_id = ppv.id
      WHERE uc.user_id = $1
      ORDER BY uc.created_at DESC
    `, [userId]);

    return result.rows;
  }

  /**
   * Check if user has given specific consent
   */
  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const result = await this.db.query(`
      SELECT status FROM user_consents
      WHERE user_id = $1 AND consent_type = $2
      ORDER BY created_at DESC LIMIT 1
    `, [userId]);

    if (!result.rows.length) return false;
    const record = result.rows[0];
    return record.status === 'granted';
  }

  /**
   * Create a Data Subject Access Request (DSAR)
   */
  async createDSAR(
    userId: string,
    requestType: DSARRequest['request_type'],
    requestData: Record<string, any> = {}
  ): Promise<DSARRequest> {
    const result = await this.db.query(`
      INSERT INTO data_subject_requests (user_id, request_type, request_data)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, requestType, requestData]);

    const request = result.rows[0];

    // Log DSAR creation
    await this.logAuditEvent({
      category: 'compliance_event',
      severity: 'medium',
      userId,
      action: 'dsar_created',
      resourceType: 'data_subject_request',
      resourceId: request.id,
      metadata: { requestType, requestData }
    });

    return request;
  }

  /**
   * Process data export request
   */
  async exportUserData(userId: string, requestId?: string): Promise<string> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Update request status if provided
      if (requestId) {
        await client.query(`
          UPDATE data_subject_requests
          SET status = 'processing', updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `, [requestId, userId]);
      }

      // Gather all user data
      const userData: UserDataExport = {
        user: {},
        tasks: [],
        responses: [],
        payments: [],
        consents: [],
        api_usage: [],
        audit_logs: []
      };

      // Get basic user info
      const userResult = await client.query(`
        SELECT id, telegram_id, username, first_name, last_name,
               language_code, role, trust_score, created_at, updated_at,
               -- Exclude sensitive fields
               '' as password_hash
        FROM users WHERE id = $1
      `, [userId]);

      if (userResult.rows.length) {
        userData.user = userResult.rows[0];
      }

      // Get user's tasks
      const tasksResult = await client.query(`
        SELECT id, project_id, type, status, task_data, quality_score,
               created_at, updated_at
        FROM tasks
        WHERE worker_id = $1 OR created_by = $1
        ORDER BY created_at DESC
      `, [userId]);
      userData.tasks = tasksResult.rows;

      // Get user's responses
      const responsesResult = await client.query(`
        SELECT id, task_id, response_data, quality_score, is_approved,
               created_at, updated_at
        FROM responses
        WHERE worker_id = $1
        ORDER BY created_at DESC
      `, [userId]);
      userData.responses = responsesResult.rows;

      // Get payment records
      const paymentsResult = await client.query(`
        SELECT id, amount, currency, status, type, metadata, created_at
        FROM client_payments
        WHERE client_id = $1 OR worker_id = $1
        ORDER BY created_at DESC
      `, [userId]);
      userData.payments = paymentsResult.rows;

      // Get consent records
      userData.consents = await this.getUserConsents(userId);

      // Get API usage (last 90 days)
      const apiUsageResult = await client.query(`
        SELECT endpoint, method, response_status, request_size,
               response_size, duration_ms, created_at
        FROM api_usage
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
        ORDER BY created_at DESC
        LIMIT 1000
      `, [userId]);
      userData.api_usage = apiUsageResult.rows;

      // Get recent audit logs (last 30 days)
      const auditResult = await client.query(`
        SELECT event_id, category, action, resource_type,
               created_at, metadata
        FROM audit_logs
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 500
      `, [userId]);
      userData.audit_logs = auditResult.rows;

      // Create JSON export
      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        data: userData
      };

      const jsonExport = JSON.stringify(exportData, null, 2);

      // Create ZIP file with JSON and CSV versions
      const zip = new JSZip();
      zip.file('user_data.json', jsonExport);

      // Add CSV versions for easier reading
      zip.file('user_info.csv', this.convertToCSV([userData.user]));
      zip.file('tasks.csv', this.convertToCSV(userData.tasks));
      zip.file('responses.csv', this.convertToCSV(userData.responses));
      zip.file('payments.csv', this.convertToCSV(userData.payments));
      zip.file('consents.csv', this.convertToCSV(userData.consents));

      // Generate export file
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const filename = `user_export_${userId}_${Date.now()}.zip`;
      const filepath = path.join(process.cwd(), 'exports', filename);

      // Ensure exports directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, zipBuffer);

      // Update request status
      if (requestId) {
        await client.query(`
          UPDATE data_subject_requests
          SET status = 'completed', processed_at = NOW(),
              response_data = $2::jsonb
          WHERE id = $1
        `, [requestId, JSON.stringify({ filename, filepath, size: zipBuffer.length })]);
      }

      await client.query('COMMIT');

      // Log successful export
      await this.logAuditEvent({
        category: 'data_access',
        severity: 'medium',
        userId,
        action: 'data_exported',
        resourceType: 'user_data',
        metadata: { filename, requestId, size: zipBuffer.length }
      }, client);

      return filepath;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process user deletion request (GDPR right to be forgotten)
   */
  async deleteUserData(userId: string, requestId?: string): Promise<void> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Update request status
      if (requestId) {
        await client.query(`
          UPDATE data_subject_requests
          SET status = 'processing', updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `, [requestId, userId]);
      }

      // Log before deletion
      await this.logAuditEvent({
        category: 'compliance_event',
        severity: 'critical',
        userId,
        action: 'user_deletion_started',
        resourceType: 'user',
        metadata: { requestId }
      }, client);

      // Anonymize user data instead of hard delete for data integrity
      const anonymizedId = crypto.randomUUID();
      const anonymizedEmail = `deleted_${anonymizedId}@deleted.com`;

      // Update user table with anonymized data
      await client.query(`
        UPDATE users SET
          telegram_id = NULL,
          username = 'DELETED_USER',
          first_name = 'Deleted',
          last_name = 'User',
          email = $2,
          phone = NULL,
          bio = NULL,
          avatar_url = NULL,
          language_code = NULL,
          is_active = false,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [userId, anonymizedEmail]);

      // Anonymize sensitive data in related tables
      await client.query(`
        UPDATE responses SET
          response_data = jsonb_set(
            jsonb_set(response_data, '{worker_id}', '"DELETED"'),
            '{notes}', '"DELETED"'
          ),
          updated_at = NOW()
        WHERE worker_id = $1
      `, [userId]);

      // Mark consents as withdrawn
      await client.query(`
        UPDATE user_consents SET
          status = 'withdrawn',
          withdrawn_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      // Archive rather than delete for audit purposes
      await client.query(`
        INSERT INTO audit_logs (category, severity, user_id, action,
                               resource_type, metadata)
        VALUES ('compliance_event', 'critical', $1, 'user_deleted',
                'user', $2::jsonb)
      `, [userId, JSON.stringify({ deletedAt: new Date().toISOString(), requestId })]);

      // Update request status
      if (requestId) {
        await client.query(`
          UPDATE data_subject_requests
          SET status = 'completed', processed_at = NOW(),
              notes = 'User data anonymized per GDPR right to deletion'
          WHERE id = $1
        `, [requestId]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update privacy policy and mark users as requiring re-consent
   */
  async updatePrivacyPolicy(
    version: string,
    content: string,
    effectiveDate: Date
  ): Promise<void> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Mark previous versions as not current
      await client.query(`
        UPDATE privacy_policy_versions
        SET is_current = false
      `);

      // Insert new version
      const result = await client.query(`
        INSERT INTO privacy_policy_versions (version, content, effective_date, is_current)
        VALUES ($1, $2, $3, true)
        RETURNING id
      `, [version, content, effectiveDate]);

      const newVersionId = result.rows[0].id;

      // Mark all active users as requiring re-consent
      await client.query(`
        INSERT INTO user_consents (user_id, consent_type, status, metadata, privacy_policy_version_id)
        SELECT id, 'policy_update', 'pending',
               json_build_object('required_version', $1),
               $2
        FROM users
        WHERE is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM user_consents
          WHERE user_id = users.id
          AND consent_type = 'policy_update'
          AND metadata->>'required_version' = $1
        )
      `, [version, newVersionId]);

      await client.query('COMMIT');

      // Log policy update
      await this.logAuditEvent({
        category: 'system_change',
        severity: 'high',
        action: 'privacy_policy_updated',
        resourceType: 'privacy_policy',
        resourceId: newVersionId,
        metadata: { version, effectiveDate }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current privacy policy
   */
  async getCurrentPrivacyPolicy(): Promise<any> {
    const result = await this.db.query(`
      SELECT * FROM privacy_policy_versions
      WHERE is_current = true
      ORDER BY effective_date DESC
      LIMIT 1
    `);

    return result.rows[0] || null;
  }

  /**
   * Check if user needs to consent to policy update
   */
  async needsPolicyConsent(userId: string): Promise<boolean> {
    const result = await this.db.query(`
      SELECT 1 FROM user_consents
      WHERE user_id = $1 AND consent_type = 'policy_update' AND status = 'pending'
      LIMIT 1
    `, [userId]);

    return result.rows.length > 0;
  }

  /**
   * Convert array of objects to CSV
   */
  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(obj =>
      headers.map(header => {
        const value = obj[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Log audit event (can be called from other services)
   */
  async logAuditEvent(
    event: {
      category: string;
      severity?: string;
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      action: string;
      resourceType?: string;
      resourceId?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      metadata?: Record<string, any>;
      errorMessage?: string;
      stackTrace?: string;
      requestId?: string;
      endpoint?: string;
      httpMethod?: string;
      responseStatus?: number;
      durationMs?: number;
    },
    client?: PoolClient
  ): Promise<void> {
    const query = `
      INSERT INTO audit_logs (
        category, severity, user_id, session_id, ip_address, user_agent,
        action, resource_type, resource_id, old_values, new_values,
        metadata, error_message, stack_trace, request_id, endpoint,
        http_method, response_status, duration_ms
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
    `;

    const values = [
      event.category,
      event.severity || 'medium',
      event.userId,
      event.sessionId,
      event.ipAddress,
      event.userAgent,
      event.action,
      event.resourceType,
      event.resourceId,
      event.oldValues ? JSON.stringify(event.oldValues) : null,
      event.newValues ? JSON.stringify(event.newValues) : null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.errorMessage,
      event.stackTrace,
      event.requestId,
      event.endpoint,
      event.httpMethod,
      event.responseStatus,
      event.durationMs
    ];

    if (client) {
      await client.query(query, values);
    } else {
      await this.db.query(query, values);
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0,
    category?: string
  ): Promise<any[]> {
    let query = `
      SELECT * FROM audit_logs
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += `
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Cleanup old audit logs (retention policy)
   */
  async cleanupAuditLogs(retentionDays: number = 365): Promise<number> {
    const result = await this.db.query(`
      DELETE FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
      AND category NOT IN ('security_event', 'compliance_event')
      RETURNING id
    `);

    return result.rows.length;
  }
}