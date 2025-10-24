import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import { Logger } from '../../utils/logger';
import crypto from 'crypto';

interface AuditEvent {
  id?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  details?: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failure' | 'warning';
  metadata?: Record<string, any>;
}

interface ComplianceEvent extends AuditEvent {
  complianceType: 'PCI_DSS' | 'GDPR' | 'SOX' | 'HIPAA' | 'CCPA';
  retentionPeriod: number; // days
  requiresNotification: boolean;
}

export class AuditService {
  private prisma: PrismaClient;
  private logger: Logger;
  private static instance: AuditService;

  constructor() {
    this.prisma = new PrismaClient();
    this.logger = new Logger('AuditService');
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Log a security audit event
   */
  async logSecurityEvent(event: AuditEvent): Promise<void> {
    try {
      const eventId = crypto.randomUUID();

      // Create hash of sensitive data for privacy
      const sensitiveFields = ['password', 'token', 'key', 'secret', 'ssn', 'creditCard'];
      const sanitizedDetails = this.sanitizeData(event.details || {}, sensitiveFields);

      // Store in database
      await this.prisma.auditLog.create({
        data: {
          id: eventId,
          userId: event.userId,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          timestamp: event.timestamp,
          details: JSON.stringify(sanitizedDetails),
          riskLevel: event.riskLevel,
          status: event.status,
          metadata: JSON.stringify(event.metadata || {}),
          category: 'SECURITY'
        }
      });

      // Log to structured logger
      this.logger.info('Security audit event', {
        eventId,
        action: event.action,
        resource: event.resource,
        userId: event.userId,
        riskLevel: event.riskLevel,
        status: event.status,
        ipAddress: event.ipAddress
      });

      // Handle high-risk events
      if (event.riskLevel === 'high' || event.riskLevel === 'critical') {
        await this.handleHighRiskEvent(eventId, event);
      }

    } catch (error) {
      this.logger.error('Failed to log audit event', error);
      // Fallback to file logging if database fails
      this.logger.error('AUDIT_FALLBACK', {
        event,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Log a compliance event with specific retention requirements
   */
  async logComplianceEvent(event: ComplianceEvent): Promise<void> {
    try {
      const eventId = crypto.randomUUID();

      await this.prisma.complianceLog.create({
        data: {
          id: eventId,
          userId: event.userId,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          timestamp: event.timestamp,
          details: JSON.stringify(event.details || {}),
          riskLevel: event.riskLevel,
          status: event.status,
          complianceType: event.complianceType,
          retentionPeriod: event.retentionPeriod,
          requiresNotification: event.requiresNotification,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent
        }
      });

      // Special handling for different compliance types
      switch (event.complianceType) {
        case 'PCI_DSS':
          await this.handlePCICompliance(eventId, event);
          break;
        case 'GDPR':
          await this.handleGDPRCompliance(eventId, event);
          break;
        case 'CCPA':
          await this.handleCCPACompliance(eventId, event);
          break;
      }

      this.logger.info('Compliance audit event', {
        eventId,
        complianceType: event.complianceType,
        action: event.action,
        userId: event.userId
      });

    } catch (error) {
      this.logger.error('Failed to log compliance event', error);
    }
  }

  /**
   * Log data access events for GDPR/CCPA compliance
   */
  async logDataAccess({
    userId,
    dataAccessed,
    purpose,
    legalBasis,
    requestId
  }: {
    userId: string;
    dataAccessed: string[];
    purpose: string;
    legalBasis: string;
    requestId: string;
  }): Promise<void> {
    await this.logComplianceEvent({
      userId,
      action: 'DATA_ACCESS',
      resource: 'USER_DATA',
      timestamp: new Date(),
      details: {
        dataAccessed,
        purpose,
        legalBasis,
        requestId
      },
      riskLevel: 'medium',
      status: 'success',
      complianceType: 'GDPR',
      retentionPeriod: 2555, // 7 years for GDPR
      requiresNotification: false
    });
  }

  /**
   * Log payment events for PCI DSS compliance
   */
  async logPaymentEvent({
    userId,
    paymentId,
    amount,
    currency,
    paymentMethod,
    status,
    failureReason
  }: {
    userId: string;
    paymentId: string;
    amount: string;
    currency: string;
    paymentMethod: string;
    status: string;
    failureReason?: string;
  }): Promise<void> {
    await this.logComplianceEvent({
      userId,
      action: 'PAYMENT_PROCESSING',
      resource: 'PAYMENT',
      resourceId: paymentId,
      timestamp: new Date(),
      details: {
        amount: this.maskAmount(amount),
        currency,
        paymentMethod,
        status,
        failureReason
      },
      riskLevel: status === 'failure' ? 'high' : 'medium',
      status: status === 'success' ? 'success' : 'failure',
      complianceType: 'PCI_DSS',
      retentionPeriod: 3650, // 10 years for PCI DSS
      requiresNotification: status === 'failure'
    });
  }

  /**
   * Log authentication events
   */
  async logAuthEvent({
    userId,
    action,
    success,
    ipAddress,
    userAgent,
    failureReason,
    mfaUsed
  }: {
    userId?: string;
    action: 'LOGIN' | 'LOGOUT' | 'MFA_CHALLENGE' | 'PASSWORD_CHANGE' | 'TOKEN_REFRESH';
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    failureReason?: string;
    mfaUsed?: boolean;
  }): Promise<void> {
    await this.logSecurityEvent({
      userId,
      action,
      resource: 'AUTHENTICATION',
      timestamp: new Date(),
      details: {
        failureReason,
        mfaUsed
      },
      riskLevel: this.calculateAuthRisk(action, success, failureReason),
      status: success ? 'success' : 'failure',
      ipAddress,
      userAgent,
      metadata: {
        sessionId: crypto.randomUUID()
      }
    });
  }

  /**
   * Search audit logs with filters
   */
  async searchAuditLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    riskLevel?: string[];
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.resource) where.resource = { contains: filters.resource, mode: 'insensitive' };
    if (filters.riskLevel?.length) where.riskLevel = { in: filters.riskLevel };
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return { logs, total };
  }

  /**
   * Generate audit report for compliance
   */
  async generateComplianceReport({
    complianceType,
    startDate,
    endDate,
    format = 'json'
  }: {
    complianceType: string;
    startDate: Date;
    endDate: Date;
    format?: 'json' | 'csv' | 'pdf';
  }): Promise<any> {
    const logs = await this.prisma.complianceLog.findMany({
      where: {
        complianceType,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    const report = {
      metadata: {
        complianceType,
        generatedAt: new Date(),
        period: { startDate, endDate },
        totalEvents: logs.length,
        generatedBy: 'AuditService'
      },
      summary: this.generateSummary(logs),
      events: logs
    };

    if (format === 'csv') {
      return this.convertToCSV(report);
    }

    return report;
  }

  /**
   * Delete old audit logs based on retention policies
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      const retentionDays = {
        SECURITY: 365, // 1 year
        PCI_DSS: 3650, // 10 years
        GDPR: 2555, // 7 years
        SOX: 2555, // 7 years
        HIPAA: 3650, // 10 years
        CCPA: 1825 // 5 years
      };

      for (const [category, days] of Object.entries(retentionDays)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        if (category === 'SECURITY') {
          await this.prisma.auditLog.deleteMany({
            where: {
              category,
              timestamp: { lt: cutoffDate }
            }
          });
        } else {
          await this.prisma.complianceLog.deleteMany({
            where: {
              complianceType: category,
              timestamp: { lt: cutoffDate }
            }
          });
        }

        this.logger.info(`Cleaned up old ${category} logs`, {
          cutoffDate: cutoffDate.toISOString(),
          retentionDays: days
        });
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old logs', error);
    }
  }

  // Private helper methods

  private sanitizeData(data: any, sensitiveFields: string[]): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key], sensitiveFields);
      }
    }

    return sanitized;
  }

  private maskAmount(amount: string): string {
    // Mask amount but preserve first and last digits
    if (amount.length <= 4) return '****';
    return amount[0] + '*'.repeat(amount.length - 2) + amount[amount.length - 1];
  }

  private calculateAuthRisk(
    action: string,
    success: boolean,
    failureReason?: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (!success) {
      if (failureReason?.includes('password') || failureReason?.includes('invalid')) {
        return 'high';
      }
      if (action === 'PASSWORD_CHANGE') {
        return 'critical';
      }
      return 'medium';
    }

    if (action === 'MFA_CHALLENGE') return 'low';
    if (action === 'LOGIN') return 'medium';
    return 'low';
  }

  private async handleHighRiskEvent(eventId: string, event: AuditEvent): Promise<void> {
    // Send immediate alert to security team
    await this.notifySecurityTeam({
      eventId,
      riskLevel: event.riskLevel,
      action: event.action,
      userId: event.userId,
      timestamp: event.timestamp,
      details: event.details
    });

    // Check for automated response
    if (event.riskLevel === 'critical') {
      await this.triggerAutomatedResponse(event);
    }
  }

  private async notifySecurityTeam(alert: any): Promise<void> {
    // Integration with alert system (Slack, PagerDuty, etc.)
    this.logger.warn('SECURITY ALERT', alert);

    // Store alert for dashboard
    await this.prisma.securityAlert.create({
      data: {
        eventId: alert.eventId,
        severity: alert.riskLevel,
        message: `High-risk event: ${alert.action}`,
        details: JSON.stringify(alert),
        status: 'OPEN',
        createdAt: new Date()
      }
    });
  }

  private async triggerAutomatedResponse(event: AuditEvent): Promise<void> {
    // Implement automated responses like:
    // - Block IP address
    // - Suspend user account
    // - Require additional authentication
    this.logger.info('Triggering automated response', { eventId: event.id });
  }

  private async handlePCICompliance(eventId: string, event: ComplianceEvent): Promise<void> {
    // PCI DSS specific handling
    // - Ensure cardholder data is encrypted
    // - Track all access to cardholder data
    // - Maintain secure audit trail
  }

  private async handleGDPRCompliance(eventId: string, event: ComplianceEvent): Promise<void> {
    // GDPR specific handling
    // - Record lawful basis for processing
    // - Track data subject requests
    // - Maintain right to erasure logs
  }

  private async handleCCPACompliance(eventId: string, event: ComplianceEvent): Promise<void> {
    // CCPA specific handling
    // - Track opt-out requests
    // - Record data sales
    // - Maintain "Do Not Sell" logs
  }

  private generateSummary(logs: any[]): any {
    const summary = {
      totalEvents: logs.length,
      byRiskLevel: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
      topUsers: [] as any[],
      failureRate: 0
    };

    for (const log of logs) {
      // Count by risk level
      summary.byRiskLevel[log.riskLevel] = (summary.byRiskLevel[log.riskLevel] || 0) + 1;

      // Count by status
      summary.byStatus[log.status] = (summary.byStatus[log.status] || 0) + 1;

      // Count by action
      summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
    }

    // Calculate failure rate
    const failures = (summary.byStatus.failure || 0);
    summary.failureRate = logs.length > 0 ? (failures / logs.length) * 100 : 0;

    return summary;
  }

  private convertToCSV(report: any): string {
    // Convert report to CSV format
    const headers = ['timestamp', 'userId', 'action', 'resource', 'riskLevel', 'status'];
    const rows = report.events.map((event: any) => [
      event.timestamp,
      event.userId || '',
      event.action,
      event.resource,
      event.riskLevel,
      event.status
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const auditService = AuditService.getInstance();