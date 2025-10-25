import { Router, Request, Response } from 'express';
import { DatabaseService } from '../../../services/database/DatabaseService';
import { ComplianceMonitoringService } from '../../../services/compliance/ComplianceMonitoringService';
import { requireAuth } from '../../../middleware/auth';
import { requireAdmin } from '../../../middleware/adminAuth';
import { auditService } from '../../../services/compliance/AuditService';

const router = Router();

/**
 * Initialize compliance monitoring service
 */
function getComplianceMonitoringService(): ComplianceMonitoringService {
  const db = DatabaseService.getInstance();
  return new ComplianceMonitoringService(db);
}

/**
 * @route GET /api/v1/compliance-monitoring/dashboard
 * @desc Get compliance monitoring dashboard data
 * @access Admin
 */
router.get('/dashboard', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const complianceService = getComplianceMonitoringService();
    const dashboardData = await complianceService.getComplianceDashboard();

    res.json({
      success: true,
      data: dashboardData
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'view_compliance_dashboard',
      resourceType: 'compliance_dashboard'
    });
  } catch (error: any) {
    console.error('Error fetching compliance dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance dashboard',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/v1/compliance-monitoring/check
 * @desc Run comprehensive compliance check
 * @access Admin
 */
router.post('/check', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const complianceService = getComplianceMonitoringService();
    const checkResults = await complianceService.runComplianceCheck();

    res.json({
      success: true,
      data: checkResults
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'run_compliance_check',
      resourceType: 'compliance_check',
      metadata: {
        alertsFound: checkResults.alerts.length,
        overallScore: checkResults.overallScore
      }
    });
  } catch (error: any) {
    console.error('Error running compliance check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run compliance check',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/v1/compliance-monitoring/reports
 * @desc Generate compliance report
 * @access Admin
 */
router.post('/reports', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportType, period } = req.body;

    if (!reportType || !period) {
      return res.status(400).json({
        success: false,
        error: 'reportType and period are required'
      });
    }

    const { startDate, endDate } = period;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range'
      });
    }

    const complianceService = getComplianceMonitoringService();
    const report = await complianceService.generateComplianceReport(
      reportType,
      { startDate: start, endDate: end },
      req.auth!.payload.userId
    );

    res.json({
      success: true,
      data: report
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'generate_compliance_report',
      resourceType: 'compliance_report',
      resourceId: report.id,
      metadata: {
        reportType,
        period,
        overallScore: report.summary.overallScore
      }
    });
  } catch (error: any) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/compliance-monitoring/reports
 * @desc Get list of compliance reports
 * @access Admin
 */
router.get('/reports', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportType, limit = 20, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (reportType) {
      whereClause += ` AND report_type = $${paramIndex++}`;
      params.push(reportType);
    }

    params.push(parseInt(limit as string), parseInt(offset as string));

    const db = DatabaseService.getInstance();
    const result = await db.query(`
      SELECT id, report_type, period_start, period_end, generated_at, generated_by, status,
             (summary_data->>'overallScore') as overall_score,
             (summary_data->>'complianceLevel') as compliance_level
      FROM compliance_reports
      WHERE ${whereClause}
      ORDER BY generated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, params);

    res.json({
      success: true,
      data: {
        reports: result.rows,
        filters: { reportType, limit, offset }
      }
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'view_compliance_reports',
      resourceType: 'compliance_reports'
    });
  } catch (error: any) {
    console.error('Error fetching compliance reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance reports',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/compliance-monitoring/reports/:reportId/download
 * @desc Download compliance report
 * @access Admin
 */
router.get('/reports/:reportId/download', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const db = DatabaseService.getInstance();
    const result = await db.query(`
      SELECT * FROM compliance_reports WHERE id = $1
    `, [reportId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const report = result.rows[0];

    if (report.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Report is not ready for download',
        status: report.status
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${reportId}.json"`);

    // Send report data
    res.send(JSON.stringify(report.summary_data, null, 2));

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'download_compliance_report',
      resourceType: 'compliance_report',
      resourceId: reportId
    });
  } catch (error: any) {
    console.error('Error downloading compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download compliance report',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/compliance-monitoring/alerts
 * @desc Get compliance alerts
 * @access Admin
 */
router.get('/alerts', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      alertType,
      severity,
      status,
      limit = 50,
      offset = 0
    } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (alertType) {
      whereClause += ` AND alert_type = $${paramIndex++}`;
      params.push(alertType);
    }

    if (severity) {
      whereClause += ` AND severity = $${paramIndex++}`;
      params.push(severity);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    params.push(parseInt(limit as string), parseInt(offset as string));

    const db = DatabaseService.getInstance();
    const result = await db.query(`
      SELECT * FROM compliance_alerts
      WHERE ${whereClause}
      ORDER BY detected_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, params);

    const alerts = result.rows.map(row => ({
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

    res.json({
      success: true,
      data: {
        alerts,
        filters: { alertType, severity, status, limit, offset }
      }
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'view_compliance_alerts',
      resourceType: 'compliance_alerts'
    });
  } catch (error: any) {
    console.error('Error fetching compliance alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance alerts',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/v1/compliance-monitoring/alerts/:alertId/resolve
 * @desc Resolve compliance alert
 * @access Admin
 */
router.post('/alerts/:alertId/resolve', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolutionNotes } = req.body;

    const db = DatabaseService.getInstance();
    const result = await db.query(`
      UPDATE compliance_alerts
      SET status = 'resolved', resolved_at = NOW(), resolved_by = $1, resolution_notes = $2
      WHERE id = $3 AND status = 'open'
      RETURNING *
    `, [req.auth!.payload.userId, resolutionNotes, alertId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved'
      });
    }

    const alert = result.rows[0];

    res.json({
      success: true,
      data: {
        id: alert.id,
        status: alert.status,
        resolvedAt: alert.resolved_at,
        resolvedBy: alert.resolved_by,
        resolutionNotes: alert.resolution_notes
      }
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'resolve_compliance_alert',
      resourceType: 'compliance_alert',
      resourceId: alertId,
      metadata: { resolutionNotes }
    });
  } catch (error: any) {
    console.error('Error resolving compliance alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve compliance alert',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/v1/compliance-monitoring/alerts
 * @desc Create compliance alert
 * @access Admin
 */
router.post('/alerts', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      alertType,
      severity,
      title,
      description,
      affectedEntities,
      metadata = {}
    } = req.body;

    if (!alertType || !severity || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'alertType, severity, title, and description are required'
      });
    }

    const complianceService = getComplianceMonitoringService();
    const alert = await complianceService.createComplianceAlert({
      alertType,
      severity,
      title,
      description,
      affectedEntities: affectedEntities || [],
      source: 'manual_review',
      metadata
    });

    res.json({
      success: true,
      data: alert
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'create_compliance_alert',
      resourceType: 'compliance_alert',
      resourceId: alert.id,
      metadata: {
        alertType,
        severity,
        title
      }
    });
  } catch (error: any) {
    console.error('Error creating compliance alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create compliance alert',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/compliance-monitoring/metrics
 * @desc Get compliance metrics
 * @access Admin
 */
router.get('/metrics', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { metricType, period = '30' } = req.query;

    const complianceService = getComplianceMonitoringService();
    const dashboardData = await complianceService.getComplianceDashboard();

    let metrics = dashboardData.metrics;

    if (metricType) {
      metrics = metrics.filter(metric => metric.metricType === metricType);
    }

    res.json({
      success: true,
      data: {
        metrics,
        period,
        lastUpdated: dashboardData.overview.lastCheck
      }
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'view_compliance_metrics',
      resourceType: 'compliance_metrics',
      metadata: { metricType, period }
    });
  } catch (error: any) {
    console.error('Error fetching compliance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance metrics',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/compliance-monitoring/rules
 * @desc Get compliance rules
 * @access Admin
 */
router.get('/rules', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { category, enabled } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (enabled !== undefined) {
      whereClause += ` AND enabled = $${paramIndex++}`;
      params.push(enabled === 'true');
    }

    const db = DatabaseService.getInstance();
    const result = await db.query(`
      SELECT * FROM compliance_rules
      WHERE ${whereClause}
      ORDER BY category, name
    `, params);

    const rules = result.rows.map(row => ({
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

    res.json({
      success: true,
      data: {
        rules,
        filters: { category, enabled }
      }
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'view_compliance_rules',
      resourceType: 'compliance_rules'
    });
  } catch (error: any) {
    console.error('Error fetching compliance rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance rules',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route PUT /api/v1/compliance-monitoring/rules/:ruleId
 * @desc Update compliance rule
 * @access Admin
 */
router.put('/rules/:ruleId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const { enabled, parameters } = req.body;

    const db = DatabaseService.getInstance();
    const result = await db.query(`
      UPDATE compliance_rules
      SET enabled = $1, parameters = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [enabled, JSON.stringify(parameters), ruleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    const rule = result.rows[0];

    res.json({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        parameters: JSON.parse(rule.parameters),
        updatedAt: rule.updated_at
      }
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'update_compliance_rule',
      resourceType: 'compliance_rule',
      resourceId: ruleId,
      metadata: { enabled, parameters }
    });
  } catch (error: any) {
    console.error('Error updating compliance rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update compliance rule',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;