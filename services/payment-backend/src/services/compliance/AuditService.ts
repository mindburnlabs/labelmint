import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database/DatabaseService';
import { v4 as uuidv4 } from 'uuid';
import { GDPRService } from './GDPRService';

interface AuditMiddlewareOptions {
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  excludePaths?: string[];
  excludeSensitiveFields?: string[];
  logOnlyErrors?: boolean;
}

export class AuditService {
  private db: DatabaseService;
  private gdprService: GDPRService;
  private defaultOptions: AuditMiddlewareOptions = {
    logRequestBody: false,
    logResponseBody: false,
    excludePaths: ['/health', '/metrics', '/favicon.ico'],
    excludeSensitiveFields: ['password', 'token', 'secret', 'key', 'authorization'],
    logOnlyErrors: false
  };

  constructor(db: DatabaseService) {
    this.db = db;
    this.gdprService = new GDPRService(db);
  }

  /**
   * Express middleware for comprehensive API audit logging
   */
  auditMiddleware(options: Partial<AuditMiddlewareOptions> = {}) {
    const opts = { ...this.defaultOptions, ...options };

    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string || uuidv4();

      // Add request ID to response headers
      res.setHeader('X-Request-ID', requestId);

      // Skip logging for excluded paths
      if (opts.excludePaths?.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Store original res methods
      const originalSend = res.send;
      let responseBody: any;
      let logged = false;

      // Override res.send to capture response
      res.send = function (body: any) {
        responseBody = body;
        return originalSend.call(this, body);
      } as any;

      // Listen for response finish
      res.on('finish', async () => {
        if (logged) return;

        const duration = Date.now() - startTime;
        const isError = res.statusCode >= 400;

        // Skip successful responses if logOnlyErrors is true
        if (opts.logOnlyErrors && !isError) {
          return;
        }

        try {
          // Prepare audit data
          const auditData = {
            requestId,
            category: 'api_call',
            severity: this.getSeverityFromStatus(res.statusCode),
            userId: this.extractUserId(req),
            sessionId: this.extractSessionId(req),
            ipAddress: this.extractIpAddress(req),
            userAgent: req.headers['user-agent'],
            action: `${req.method} ${req.route?.path || req.path}`,
            endpoint: req.path,
            httpMethod: req.method,
            responseStatus: res.statusCode,
            durationMs: duration,
            metadata: {
              query: req.query,
              params: req.params,
              headers: this.sanitizeHeaders(req.headers, opts.excludeSensitiveFields || [])
            }
          };

          // Add request body if enabled
          if (opts.logRequestBody && req.body && Object.keys(req.body).length > 0) {
            (auditData.metadata as any).requestBody = this.sanitizeObject(
              req.body,
              opts.excludeSensitiveFields || []
            );
          }

          // Add response body if enabled
          if (opts.logResponseBody && responseBody) {
            try {
              const parsedBody = typeof responseBody === 'string'
                ? JSON.parse(responseBody)
                : responseBody;
              (auditData.metadata as any).responseBody = this.sanitizeObject(
                parsedBody,
                opts.excludeSensitiveFields || []
              );
            } catch {
              // If not JSON, store as string if not too large
              if (responseBody.length < 1000) {
                (auditData.metadata as any).responseBody = responseBody;
              }
            }
          }

          // Add error details if present
          if (isError && res.locals.error) {
            auditData.errorMessage = res.locals.error.message;
            auditData.stackTrace = res.locals.error.stack;
          }

          await this.gdprService.logAuditEvent(auditData);
          logged = true;

        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      });

      // Handle uncaught errors
      res.on('error', async (error) => {
        if (logged) return;

        try {
          await this.gdprService.logAuditEvent({
            requestId,
            category: 'api_call',
            severity: 'high',
            userId: this.extractUserId(req),
            sessionId: this.extractSessionId(req),
            ipAddress: this.extractIpAddress(req),
            userAgent: req.headers['user-agent'],
            action: `${req.method} ${req.path}`,
            endpoint: req.path,
            httpMethod: req.method,
            responseStatus: 500,
            durationMs: Date.now() - startTime,
            errorMessage: error.message,
            stackTrace: error.stack,
            metadata: { unhandledError: true }
          });
          logged = true;
        } catch (logError) {
          console.error('Error audit logging failed:', logError);
        }
      });

      next();
    };
  }

  /**
   * Log user actions (non-API actions)
   */
  async logUserAction(params: {
    userId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }) {
    await this.gdprService.logAuditEvent({
      category: 'user_action',
      severity: 'low',
      ...params
    });
  }

  /**
   * Log admin actions
   */
  async logAdminAction(params: {
    userId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    targetUserId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const metadata = {
      ...params.metadata,
      targetUserId: params.targetUserId,
      isAdminAction: true
    };

    await this.gdprService.logAuditEvent({
      category: 'admin_action',
      severity: 'medium',
      ...params,
      metadata
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(params: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    accessedData?: string[];
    purpose?: string;
    metadata?: Record<string, any>;
  }) {
    const metadata = {
      ...params.metadata,
      accessedData: params.accessedData,
      purpose: params.purpose
    };

    await this.gdprService.logAuditEvent({
      category: 'data_access',
      severity: 'medium',
      ...params,
      metadata
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(params: {
    action: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
    threatType?: string;
    blocked?: boolean;
  }) {
    const metadata = {
      ...params.details,
      threatType: params.threatType,
      blocked: params.blocked,
      isSecurityEvent: true
    };

    await this.gdprService.logAuditEvent({
      category: 'security_event',
      severity: params.severity,
      ...params,
      metadata
    });
  }

  /**
   * Log system changes
   */
  async logSystemChange(params: {
    action: string;
    resourceType: string;
    resourceId?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    userId?: string;
    metadata?: Record<string, any>;
  }) {
    await this.gdprService.logAuditEvent({
      category: 'system_change',
      severity: 'high',
      ...params
    });
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(filters: {
    userId?: string;
    category?: string;
    action?: string;
    resourceType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    searchTerm?: string;
  }) {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }

    if (filters.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.action) {
      query += ` AND action ILIKE $${paramIndex++}`;
      params.push(`%${filters.action}%`);
    }

    if (filters.resourceType) {
      query += ` AND resource_type = $${paramIndex++}`;
      params.push(filters.resourceType);
    }

    if (filters.severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(filters.severity);
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.searchTerm) {
      query += ` AND (action ILIKE $${paramIndex++} OR metadata::text ILIKE $${paramIndex++})`;
      params.push(`%${filters.searchTerm}%`, `%${filters.searchTerm}%`);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await this.db.query(query, params);

    // Parse JSON fields
    return result.rows.map(row => ({
      ...row,
      metadata: row.metadata || {},
      oldValues: row.old_values || {},
      newValues: row.new_values || {}
    }));
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(filters: {
    userId?: string;
    days?: number;
  } = {}) {
    const days = filters.days || 30;

    const result = await this.db.query(`
      SELECT
        category,
        severity,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users,
        DATE_TRUNC('day', created_at) as date
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      ${filters.userId ? 'AND user_id = $1' : ''}
      GROUP BY category, severity, DATE_TRUNC('day', created_at)
      ORDER BY date DESC, count DESC
    `, filters.userId ? [filters.userId] : []);

    return result.rows;
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(req: Request): string | undefined {
    // Check auth payload
    if (req.auth?.payload?.userId) {
      return req.auth.payload.userId;
    }

    // Check API auth
    if (req.apiAuth?.userId) {
      return req.apiAuth.userId;
    }

    // Check custom user property
    if (req.user?.id) {
      return req.user.id;
    }

    return undefined;
  }

  /**
   * Extract session ID from request
   */
  private extractSessionId(req: Request): string | undefined {
    return req.headers['x-session-id'] as string ||
           req.sessionID ||
           req.cookies?.sessionId ||
           req.headers['authorization']?.substring(0, 20);
  }

  /**
   * Extract IP address from request
   */
  private extractIpAddress(req: Request): string | undefined {
    return req.ip ||
           req.headers['x-forwarded-for'] as string ||
           req.headers['x-real-ip'] as string ||
           req.connection?.remoteAddress;
  }

  /**
   * Get severity based on HTTP status code
   */
  private getSeverityFromStatus(status: number): string {
    if (status >= 500) return 'critical';
    if (status >= 400) return 'high';
    if (status >= 300) return 'medium';
    return 'low';
  }

  /**
   * Sanitize headers by removing sensitive fields
   */
  private sanitizeHeaders(headers: Record<string, any>, excludeFields: string[]): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = excludeFields.some(field => lowerKey.includes(field));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize object by removing sensitive fields
   */
  private sanitizeObject(obj: any, excludeFields: string[]): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, excludeFields));
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = excludeFields.some(field => lowerKey.includes(field));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value, excludeFields);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Export audit logs to CSV
   */
  async exportAuditLogs(filters: {
    startDate: Date;
    endDate: Date;
    category?: string;
    userId?: string;
  }): Promise<string> {
    const logs = await this.queryAuditLogs({
      ...filters,
      limit: 10000
    });

    const headers = [
      'event_id', 'category', 'severity', 'user_id', 'action',
      'resource_type', 'resource_id', 'ip_address', 'created_at',
      'metadata'
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map(log => {
        const row = headers.map(header => {
          const value = log[header] || '';
          const stringValue = typeof value === 'object'
            ? JSON.stringify(value).replace(/"/g, '""')
            : String(value).replace(/"/g, '""');
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        });
        return row.join(',');
      })
    ];

    return csvRows.join('\n');
  }
}

// Singleton instance
export let auditService: AuditService;

export function initializeAuditService(db: DatabaseService): AuditService {
  auditService = new AuditService(db);
  return auditService;
}