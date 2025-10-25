import { DatabaseService } from '../database/DatabaseService';
import { Logger } from '../utils/logger';
import { AuditService } from './AuditService';
import { GDPRService } from './GDPRService';
import { KYCAMLService } from './KYCAMLService';
import { DataRetentionService } from './DataRetentionService';

interface ComplianceAlert {
  id: string;
  alertType: 'data_breach' | 'policy_violation' | 'security_incident' | 'retention_violation' | 'consent_violation' | 'aml_suspicion' | 'system_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedEntities: Array<{
    type: 'user' | 'transaction' | 'data_record' | 'system_component';
    id: string;
    name?: string;
  }>;
  detectedAt: Date;
  source: 'automated_monitoring' | 'user_report' | 'external_notification' | 'manual_review';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive' | 'escalated';
  assignedTo?: string;
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata: Record<string, any>;
}

interface ComplianceMetric {
  id: string;
  metricType: 'privacy_compliance' | 'security_incidents' | 'data_retention' | 'consent_coverage' | 'aml_compliance' | 'audit_coverage';
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  unit: 'percentage' | 'count' | 'score' | 'days';
  status: 'compliant' | 'warning' | 'non_compliant';
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
  historicalData: Array<{
    date: Date;
    value: number;
  }>;
  thresholds: {
    warning: number;
    critical: number;
  };
}

interface ComplianceReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'ad_hoc';
  period: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  status: 'generating' | 'completed' | 'failed';
  summary: {
    overallScore: number;
    totalAlerts: number;
    criticalAlerts: number;
    resolvedAlerts: number;
    complianceLevel: 'fully_compliant' | 'mostly_compliant' | 'partially_compliant' | 'non_compliant';
  };
  sections: {
    privacy: ComplianceSection;
    security: ComplianceSection;
    aml: ComplianceSection;
    retention: ComplianceSection;
    audit: ComplianceSection;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    description: string;
    actionItems: string[];
    deadline?: Date;
  }>;
  filePath?: string;
}

interface ComplianceSection {
  score: number;
  status: 'compliant' | 'warning' | 'non_compliant';
  metrics: ComplianceMetric[];
  alerts: ComplianceAlert[];
  findings: string[];
  recommendations: string[];
}

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'privacy' | 'security' | 'aml' | 'retention' | 'audit';
  ruleType: 'threshold' | 'pattern' | 'frequency' | 'absence' | 'presence';
  parameters: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ComplianceMonitoringService {
  private db: DatabaseService;
  private auditService: AuditService;
  private gdprService: GDPRService;
  private kycAmlService: KYCAMLService;
  private dataRetentionService: DataRetentionService;
  private logger: Logger;

  constructor(db: DatabaseService) {
    this.db = db;
    this.auditService = new AuditService(db);
    this.gdprService = new GDPRService(db);
    this.kycAmlService = new KYCAMLService(db);
    this.dataRetentionService = new DataRetentionService(db);
    this.logger = new Logger('ComplianceMonitoringService');
  }

  /**
   * Initialize compliance monitoring
   */
  async initializeMonitoring(): Promise<void> {
    try {
      // Initialize default compliance rules
      await this.initializeDefaultRules();

      // Start automated monitoring
      await this.startAutomatedMonitoring();

      this.logger.info('Compliance monitoring initialized');
    } catch (error) {
      this.logger.error('Failed to initialize compliance monitoring', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Run comprehensive compliance check
   */
  async runComplianceCheck(): Promise<{
    alerts: ComplianceAlert[];
    metrics: ComplianceMetric[];
    overallScore: number;
  }> {
    try {
      const alerts: ComplianceAlert[] = [];
      const metrics: ComplianceMetric[] = [];

      // Privacy compliance checks
      const privacyResults = await this.checkPrivacyCompliance();
      alerts.push(...privacyResults.alerts);
      metrics.push(...privacyResults.metrics);

      // Security compliance checks
      const securityResults = await this.checkSecurityCompliance();
      alerts.push(...securityResults.alerts);
      metrics.push(...securityResults.metrics);

      // AML compliance checks
      const amlResults = await this.checkAMLCompliance();
      alerts.push(...amlResults.alerts);
      metrics.push(...amlResults.metrics);

      // Data retention checks
      const retentionResults = await this.checkDataRetentionCompliance();
      alerts.push(...retentionResults.alerts);
      metrics.push(...retentionResults.metrics);

      // Calculate overall score
      const overallScore = this.calculateOverallScore(metrics);

      // Store results
      await this.storeComplianceCheckResults(alerts, metrics, overallScore);

      this.logger.info('Compliance check completed', {
        alertsFound: alerts.length,
        metricsCollected: metrics.length,
        overallScore
      });

      return { alerts, metrics, overallScore };
    } catch (error) {
      this.logger.error('Failed to run compliance check', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    reportType: ComplianceReport['reportType'],
    period: { startDate: Date; endDate: Date },
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      const reportId = this.generateId();
      const now = new Date();

      const report: ComplianceReport = {
        id: reportId,
        reportType,
        period,
        generatedAt: now,
        generatedBy,
        status: 'generating',
        summary: {
          overallScore: 0,
          totalAlerts: 0,
          criticalAlerts: 0,
          resolvedAlerts: 0,
          complianceLevel: 'fully_compliant'
        },
        sections: {
          privacy: { score: 0, status: 'compliant', metrics: [], alerts: [], findings: [], recommendations: [] },
          security: { score: 0, status: 'compliant', metrics: [], alerts: [], findings: [], recommendations: [] },
          aml: { score: 0, status: 'compliant', metrics: [], alerts: [], findings: [], recommendations: [] },
          retention: { score: 0, status: 'compliant', metrics: [], alerts: [], findings: [], recommendations: [] },
          audit: { score: 0, status: 'compliant', metrics: [], alerts: [], findings: [], recommendations: [] }
        },
        recommendations: []
      };

      // Generate report sections
      await this.generateReportSection('privacy', report, period);
      await this.generateReportSection('security', report, period);
      await this.generateReportSection('aml', report, period);
      await this.generateReportSection('retention', report, period);
      await this.generateReportSection('audit', report, period);

      // Calculate summary
      report.summary = this.calculateReportSummary(report);

      // Generate recommendations
      report.recommendations = this.generateRecommendations(report);

      // Save report
      await this.saveComplianceReport(report);

      this.logger.info('Compliance report generated', {
        reportId,
        reportType,
        period,
        overallScore: report.summary.overallScore
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate compliance report', {
        reportType,
        period,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create compliance alert
   */
  async createComplianceAlert(alertData: Omit<ComplianceAlert, 'id' | 'detectedAt' | 'status'>): Promise<ComplianceAlert> {
    try {
      const alert: ComplianceAlert = {
        ...alertData,
        id: this.generateId(),
        detectedAt: new Date(),
        status: 'open'
      };

      await this.db.query(`
        INSERT INTO compliance_alerts
        (id, alert_type, severity, title, description, affected_entities, detected_at,
         source, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        alert.id,
        alert.alertType,
        alert.severity,
        alert.title,
        alert.description,
        JSON.stringify(alert.affectedEntities),
        alert.detectedAt,
        alert.source,
        alert.status,
        JSON.stringify(alert.metadata)
      ]);

      // Log alert creation
      await this.auditService.logSecurityEvent({
        action: 'compliance_alert_created',
        severity: alert.severity,
        details: {
          alertId: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          title: alert.title
        }
      });

      // Send notifications for high/critical alerts
      if (alert.severity === 'high' || alert.severity === 'critical') {
        await this.sendCriticalAlertNotification(alert);
      }

      this.logger.warn('Compliance alert created', {
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity
      });

      return alert;
    } catch (error) {
      this.logger.error('Failed to create compliance alert', {
        alertType: alertData.alertType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(): Promise<{
    overview: {
      overallScore: number;
      complianceLevel: string;
      totalAlerts: number;
      criticalAlerts: number;
      openAlerts: number;
      lastCheck: Date;
    };
    metrics: ComplianceMetric[];
    recentAlerts: ComplianceAlert[];
    upcomingTasks: Array<{
      task: string;
      dueDate: Date;
      priority: string;
    }>;
  }> {
    try {
      // Get latest compliance check results
      const latestCheck = await this.getLatestComplianceCheck();

      // Get current metrics
      const metrics = await this.getCurrentMetrics();

      // Get recent alerts
      const recentAlerts = await this.getRecentAlerts(10);

      // Get upcoming compliance tasks
      const upcomingTasks = await this.getUpcomingTasks();

      const overview = {
        overallScore: latestCheck?.overallScore || 0,
        complianceLevel: this.getComplianceLevel(latestCheck?.overallScore || 0),
        totalAlerts: await this.getAlertCount(),
        criticalAlerts: await this.getAlertCount('critical'),
        openAlerts: await this.getAlertCount('open'),
        lastCheck: latestCheck?.createdAt || new Date()
      };

      return {
        overview,
        metrics,
        recentAlerts,
        upcomingTasks
      };
    } catch (error) {
      this.logger.error('Failed to get compliance dashboard', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async initializeDefaultRules(): Promise<void> {
    const defaultRules: Omit<ComplianceRule, 'id' | 'triggerCount' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Data Retention Compliance',
        description: 'Alert when data exceeds retention periods',
        category: 'retention',
        ruleType: 'threshold',
        parameters: { maxRetentionDays: 2555 },
        severity: 'high',
        enabled: true,
        createdBy: 'system'
      },
      {
        name: 'High-Risk Transaction Detection',
        description: 'Detect suspicious transaction patterns',
        category: 'aml',
        ruleType: 'pattern',
        parameters: { maxTransactionAmount: 10000, frequencyThreshold: 5 },
        severity: 'critical',
        enabled: true,
        createdBy: 'system'
      },
      {
        name: 'Consent Coverage Monitoring',
        description: 'Monitor user consent coverage rates',
        category: 'privacy',
        ruleType: 'threshold',
        parameters: { minConsentRate: 95 },
        severity: 'medium',
        enabled: true,
        createdBy: 'system'
      },
      {
        name: 'Failed Authentication Attempts',
        description: 'Detect potential brute force attacks',
        category: 'security',
        ruleType: 'frequency',
        parameters: { maxAttempts: 5, timeWindowMinutes: 15 },
        severity: 'high',
        enabled: true,
        createdBy: 'system'
      },
      {
        name: 'Audit Log Coverage',
        description: 'Ensure comprehensive audit logging',
        category: 'audit',
        ruleType: 'absence',
        parameters: { requiredEvents: ['user_login', 'data_access', 'payment_processed'] },
        severity: 'medium',
        enabled: true,
        createdBy: 'system'
      }
    ];

    for (const rule of defaultRules) {
      await this.db.query(`
        INSERT INTO compliance_rules
        (id, name, description, category, rule_type, parameters, severity, enabled, trigger_count, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `, [
        this.generateId(),
        rule.name,
        rule.description,
        rule.category,
        rule.ruleType,
        JSON.stringify(rule.parameters),
        rule.severity,
        rule.enabled,
        0,
        rule.createdBy
      ]);
    }
  }

  private async startAutomatedMonitoring(): Promise<void> {
    // This would start background monitoring processes
    // For now, we'll simulate with periodic checks

    setInterval(async () => {
      try {
        await this.runAutomatedChecks();
      } catch (error) {
        this.logger.error('Automated monitoring check failed', { error: error.message });
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  private async runAutomatedChecks(): Promise<void> {
    // Get enabled compliance rules
    const rules = await this.getEnabledRules();

    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (error) {
        this.logger.error('Failed to evaluate compliance rule', {
          ruleId: rule.id,
          error: error.message
        });
      }
    }
  }

  private async evaluateRule(rule: ComplianceRule): Promise<void> {
    // This would implement rule evaluation logic
    // For now, we'll simulate with basic checks

    switch (rule.category) {
      case 'retention':
        await this.evaluateRetentionRule(rule);
        break;
      case 'aml':
        await this.evaluateAMLRule(rule);
        break;
      case 'privacy':
        await this.evaluatePrivacyRule(rule);
        break;
      case 'security':
        await this.evaluateSecurityRule(rule);
        break;
      case 'audit':
        await this.evaluateAuditRule(rule);
        break;
    }
  }

  private async evaluateRetentionRule(rule: ComplianceRule): Promise<void> {
    const complianceResult = await this.dataRetentionService.checkRetentionCompliance();

    if (complianceResult.expiredRecords.length > 0) {
      await this.createComplianceAlert({
        alertType: 'retention_violation',
        severity: rule.severity,
        title: 'Data Retention Violation',
        description: `${complianceResult.expiredRecords.length} records exceed retention periods`,
        affectedEntities: complianceResult.expiredRecords.map(record => ({
          type: 'data_record',
          id: record.recordId
        })),
        source: 'automated_monitoring',
        metadata: {
          ruleId: rule.id,
          expiredRecords: complianceResult.expiredRecords
        }
      });
    }
  }

  private async evaluateAMLRule(rule: ComplianceRule): Promise<void> {
    // This would check for AML violations
    // For now, we'll simulate with basic pattern matching
  }

  private async evaluatePrivacyRule(rule: ComplianceRule): Promise<void> {
    // This would check for privacy compliance
    // For now, we'll simulate with consent coverage checks
  }

  private async evaluateSecurityRule(rule: ComplianceRule): Promise<void> {
    // This would check for security issues
    // For now, we'll simulate with authentication failure checks
  }

  private async evaluateAuditRule(rule: ComplianceRule): Promise<void> {
    // This would check audit log coverage
    // For now, we'll simulate with basic checks
  }

  private async checkPrivacyCompliance(): Promise<{ alerts: ComplianceAlert[]; metrics: ComplianceMetric[] }> {
    const alerts: ComplianceAlert[] = [];
    const metrics: ComplianceMetric[] = [];

    // Check consent coverage
    const consentCoverage = await this.calculateConsentCoverage();
    metrics.push({
      id: this.generateId(),
      metricType: 'consent_coverage',
      name: 'User Consent Coverage',
      description: 'Percentage of users with valid consent',
      currentValue: consentCoverage,
      targetValue: 95,
      unit: 'percentage',
      status: consentCoverage >= 95 ? 'compliant' : consentCoverage >= 85 ? 'warning' : 'non_compliant',
      trend: 'stable',
      lastUpdated: new Date(),
      historicalData: [],
      thresholds: { warning: 85, critical: 70 }
    });

    if (consentCoverage < 85) {
      alerts.push(await this.createComplianceAlert({
        alertType: 'consent_violation',
        severity: 'medium',
        title: 'Low Consent Coverage',
        description: `Only ${consentCoverage}% of users have valid consent`,
        affectedEntities: [],
        source: 'automated_monitoring',
        metadata: { consentCoverage }
      }));
    }

    return { alerts, metrics };
  }

  private async checkSecurityCompliance(): Promise<{ alerts: ComplianceAlert[]; metrics: ComplianceMetric[] }> {
    const alerts: ComplianceAlert[] = [];
    const metrics: ComplianceMetric[] = [];

    // Check for security incidents
    const recentSecurityIncidents = await this.getRecentSecurityIncidents(7); // last 7 days
    metrics.push({
      id: this.generateId(),
      metricType: 'security_incidents',
      name: 'Security Incidents',
      description: 'Number of security incidents in the last 7 days',
      currentValue: recentSecurityIncidents,
      targetValue: 0,
      unit: 'count',
      status: recentSecurityIncidents === 0 ? 'compliant' : recentSecurityIncidents <= 2 ? 'warning' : 'non_compliant',
      trend: 'stable',
      lastUpdated: new Date(),
      historicalData: [],
      thresholds: { warning: 1, critical: 3 }
    });

    return { alerts, metrics };
  }

  private async checkAMLCompliance(): Promise<{ alerts: ComplianceAlert[]; metrics: ComplianceMetric[] }> {
    const alerts: ComplianceAlert[] = [];
    const metrics: ComplianceMetric[] = [];

    // Check for high-risk transactions
    const highRiskTransactions = await this.getHighRiskTransactions(7); // last 7 days
    metrics.push({
      id: this.generateId(),
      metricType: 'aml_compliance',
      name: 'High-Risk Transactions',
      description: 'Number of high-risk transactions flagged in the last 7 days',
      currentValue: highRiskTransactions,
      targetValue: 5,
      unit: 'count',
      status: highRiskTransactions <= 5 ? 'compliant' : highRiskTransactions <= 10 ? 'warning' : 'non_compliant',
      trend: 'stable',
      lastUpdated: new Date(),
      historicalData: [],
      thresholds: { warning: 5, critical: 15 }
    });

    return { alerts, metrics };
  }

  private async checkDataRetentionCompliance(): Promise<{ alerts: ComplianceAlert[]; metrics: ComplianceMetric[] }> {
    const alerts: ComplianceAlert[] = [];
    const metrics: ComplianceMetric[] = [];

    const retentionResult = await this.dataRetentionService.checkRetentionCompliance();

    metrics.push({
      id: this.generateId(),
      metricType: 'data_retention',
      name: 'Retention Compliance',
      description: 'Number of records exceeding retention periods',
      currentValue: retentionResult.expiredRecords.length,
      targetValue: 0,
      unit: 'count',
      status: retentionResult.expiredRecords.length === 0 ? 'compliant' : 'non_compliant',
      trend: 'stable',
      lastUpdated: new Date(),
      historicalData: [],
      thresholds: { warning: 10, critical: 50 }
    });

    if (retentionResult.expiredRecords.length > 0) {
      alerts.push(...retentionResult.expiredRecords.map(record => ({
        alertType: 'retention_violation' as const,
        severity: 'medium' as const,
        title: 'Data Retention Violation',
        description: `Record ${record.recordId} exceeds retention period`,
        affectedEntities: [{
          type: 'data_record' as const,
          id: record.recordId
        }],
        source: 'automated_monitoring' as const,
        metadata: record
      })));
    }

    return { alerts, metrics };
  }

  private async checkAuditCompliance(): Promise<{ alerts: ComplianceAlert[]; metrics: ComplianceMetric[] }> {
    const alerts: ComplianceAlert[] = [];
    const metrics: ComplianceMetric[] = [];

    // Check audit log coverage
    const auditCoverage = await this.calculateAuditCoverage();
    metrics.push({
      id: this.generateId(),
      metricType: 'audit_coverage',
      name: 'Audit Log Coverage',
      description: 'Percentage of critical events logged',
      currentValue: auditCoverage,
      targetValue: 100,
      unit: 'percentage',
      status: auditCoverage >= 95 ? 'compliant' : auditCoverage >= 85 ? 'warning' : 'non_compliant',
      trend: 'stable',
      lastUpdated: new Date(),
      historicalData: [],
      thresholds: { warning: 90, critical: 75 }
    });

    return { alerts, metrics };
  }

  private calculateOverallScore(metrics: ComplianceMetric[]): number {
    if (metrics.length === 0) return 0;

    const totalScore = metrics.reduce((sum, metric) => {
      const score = (metric.currentValue / metric.targetValue) * 100;
      return sum + Math.min(score, 100);
    }, 0);

    return Math.round(totalScore / metrics.length);
  }

  private async storeComplianceCheckResults(alerts: ComplianceAlert[], metrics: ComplianceMetric[], overallScore: number): Promise<void> {
    const checkId = this.generateId();

    await this.db.query(`
      INSERT INTO compliance_checks
      (id, overall_score, total_alerts, critical_alerts, check_date, metadata)
      VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      checkId,
      overallScore,
      alerts.length,
      alerts.filter(a => a.severity === 'critical').length,
      JSON.stringify({ alertsCount: alerts.length, metricsCount: metrics.length })
    ]);
  }

  private async getLatestComplianceCheck(): Promise<any> {
    const result = await this.db.query(`
      SELECT * FROM compliance_checks
      ORDER BY check_date DESC
      LIMIT 1
    `);

    return result.rows[0] || null;
  }

  private async getCurrentMetrics(): Promise<ComplianceMetric[]> {
    // This would return current compliance metrics
    // For now, return empty array
    return [];
  }

  private async getRecentAlerts(limit: number): Promise<ComplianceAlert[]> {
    const result = await this.db.query(`
      SELECT * FROM compliance_alerts
      ORDER BY detected_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      affectedEntities: JSON.parse(row.affected_entities),
      detectedAt: row.detected_at,
      source: row.source,
      status: row.status,
      assignedTo: row.assigned_to,
      resolutionNotes: row.resolution_notes,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      metadata: JSON.parse(row.metadata)
    }));
  }

  private async getUpcomingTasks(): Promise<Array<{ task: string; dueDate: Date; priority: string }>> {
    // This would return upcoming compliance tasks
    // For now, return empty array
    return [];
  }

  private getComplianceLevel(score: number): string {
    if (score >= 95) return 'fully_compliant';
    if (score >= 80) return 'mostly_compliant';
    if (score >= 60) return 'partially_compliant';
    return 'non_compliant';
  }

  private async generateReportSection(section: string, report: ComplianceReport, period: { startDate: Date; endDate: Date }): Promise<void> {
    // This would generate report sections
    // For now, we'll implement basic structure
  }

  private calculateReportSummary(report: ComplianceReport): ComplianceReport['summary'] {
    const sectionScores = [
      report.sections.privacy.score,
      report.sections.security.score,
      report.sections.aml.score,
      report.sections.retention.score,
      report.sections.audit.score
    ];

    const overallScore = sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length;

    const totalAlerts = Object.values(report.sections).reduce((sum, section) => sum + section.alerts.length, 0);
    const criticalAlerts = Object.values(report.sections).reduce((sum, section) =>
      sum + section.alerts.filter(alert => alert.severity === 'critical').length, 0);

    return {
      overallScore,
      totalAlerts,
      criticalAlerts,
      resolvedAlerts: 0, // Would be calculated from resolved alerts
      complianceLevel: this.getComplianceLevel(overallScore)
    };
  }

  private generateRecommendations(report: ComplianceReport): ComplianceReport['recommendations'] {
    const recommendations: ComplianceReport['recommendations'] = [];

    // Analyze each section and generate recommendations
    Object.entries(report.sections).forEach(([sectionName, section]) => {
      if (section.status === 'non_compliant' || section.status === 'warning') {
        recommendations.push({
          priority: section.status === 'non_compliant' ? 'high' : 'medium',
          category: sectionName,
          description: `Improve ${sectionName} compliance from current status`,
          actionItems: section.recommendations,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        });
      }
    });

    return recommendations;
  }

  private async saveComplianceReport(report: ComplianceReport): Promise<void> {
    await this.db.query(`
      INSERT INTO compliance_reports
      (id, report_type, period_start, period_end, generated_at, generated_by, status, summary_data, file_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      report.id,
      report.reportType,
      report.period.startDate,
      report.period.endDate,
      report.generatedAt,
      report.generatedBy,
      report.status,
      JSON.stringify(report),
      report.filePath
    ]);
  }

  private async sendCriticalAlertNotification(alert: ComplianceAlert): Promise<void> {
    // This would send notifications for critical alerts
    // For now, we'll just log it
    this.logger.error('Critical compliance alert', {
      alertId: alert.id,
      title: alert.title,
      description: alert.description
    });
  }

  private async getEnabledRules(): Promise<ComplianceRule[]> {
    const result = await this.db.query(`
      SELECT * FROM compliance_rules
      WHERE enabled = true
    `);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      ruleType: row.rule_type,
      parameters: JSON.parse(row.parameters),
      severity: row.severity,
      enabled: row.enabled,
      lastTriggered: row.last_triggered,
      triggerCount: row.trigger_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  // Helper methods for metric calculations
  private async calculateConsentCoverage(): Promise<number> {
    const result = await this.db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'granted' THEN 1 END) as users_with_consent
      FROM user_consents
      WHERE consent_type = 'data_processing'
    `);

    const row = result.rows[0];
    return row.total_users > 0 ? (row.users_with_consent / row.total_users) * 100 : 100;
  }

  private async getRecentSecurityIncidents(days: number): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count
      FROM compliance_alerts
      WHERE alert_type = 'security_incident'
      AND detected_at > NOW() - INTERVAL '${days} days'
    `);

    return parseInt(result.rows[0].count);
  }

  private async getHighRiskTransactions(days: number): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count
      FROM aml_transactions
      WHERE risk_score >= 80
      AND created_at > NOW() - INTERVAL '${days} days'
    `);

    return parseInt(result.rows[0].count);
  }

  private async calculateAuditCoverage(): Promise<number> {
    // This would calculate audit log coverage
    // For now, return a mock value
    return 95;
  }

  private async getAlertCount(severity?: string): Promise<number> {
    let whereClause = 'status = $1';
    const params = ['open'];

    if (severity) {
      whereClause += ' AND severity = $2';
      params.push(severity);
    }

    const result = await this.db.query(`
      SELECT COUNT(*) as count
      FROM compliance_alerts
      WHERE ${whereClause}
    `, params);

    return parseInt(result.rows[0].count);
  }

  private generateId(): string {
    return 'cm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}