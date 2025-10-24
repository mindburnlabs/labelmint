import { Router, Request, Response } from 'express';
import { DatabaseService } from '../../../services/database/DatabaseService';
import { GDPRService } from '../../../services/compliance/GDPRService';
import { auditService } from '../../../services/compliance/AuditService';
import { requireAuth } from '../../../middleware/auth';
import { requireAdmin } from '../../../middleware/adminAuth';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * Initialize GDPR service
 */
function getGDPRService(): GDPRService {
  const db = DatabaseService.getInstance();
  return new GDPRService(db);
}

/**
 * @route GET /api/v1/compliance/consents
 * @desc Get user's consent records
 * @access Private
 */
router.get('/consents', requireAuth, async (req: Request, res: Response) => {
  try {
    const gdprService = getGDPRService();
    const userId = req.auth!.payload.userId;

    const consents = await gdprService.getUserConsents(userId);

    res.json({
      success: true,
      data: {
        consents,
        needsPolicyConsent: await gdprService.needsPolicyConsent(userId)
      }
    });

    await auditService.logUserAction({
      userId,
      action: 'view_consents',
      resourceType: 'user_consents',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } catch (error: any) {
    console.error('Error fetching consents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch consents',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/v1/compliance/consents
 * @desc Update or create user consent
 * @access Private
 */
router.post('/consents', requireAuth, async (req: Request, res: Response) => {
  try {
    const gdprService = getGDPRService();
    const userId = req.auth!.payload.userId;

    const { consentType, status, metadata = {} } = req.body;

    if (!consentType || !status) {
      return res.status(400).json({
        success: false,
        error: 'consentType and status are required'
      });
    }

    if (!['granted', 'denied', 'withdrawn'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    const consent = await gdprService.recordConsent(
      userId,
      consentType,
      status,
      req.ip,
      req.headers['user-agent'],
      metadata
    );

    res.json({
      success: true,
      data: consent
    });

    await auditService.logUserAction({
      userId,
      action: 'update_consent',
      resourceType: 'user_consent',
      metadata: { consentType, status }
    });
  } catch (error: any) {
    console.error('Error updating consent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update consent',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/compliance/privacy-policy
 * @desc Get current privacy policy
 * @access Public
 */
router.get('/privacy-policy', async (req: Request, res: Response) => {
  try {
    const gdprService = getGDPRService();
    const policy = await gdprService.getCurrentPrivacyPolicy();

    res.json({
      success: true,
      data: policy
    });
  } catch (error: any) {
    console.error('Error fetching privacy policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch privacy policy'
    });
  }
});

/**
 * @route POST /api/v1/compliance/data-export
 * @desc Request data export (GDPR right of access)
 * @access Private
 */
router.post('/data-export', requireAuth, async (req: Request, res: Response) => {
  try {
    const gdprService = getGDPRService();
    const userId = req.auth!.payload.userId;

    // Create DSAR record
    const dsar = await gdprService.createDSAR(userId, 'export', {
      requestedAt: new Date().toISOString(),
      format: 'json_zip',
      ipAddress: req.ip
    });

    // Process export asynchronously
    processExport(gdprService, userId, dsar.id).catch(error => {
      console.error('Error processing data export:', error);
    });

    res.json({
      success: true,
      message: 'Data export request received. You will be notified when ready.',
      data: {
        requestId: dsar.id,
        status: dsar.status
      }
    });

    await auditService.logUserAction({
      userId,
      action: 'request_data_export',
      resourceType: 'data_subject_request',
      resourceId: dsar.id,
      metadata: { requestId: dsar.id }
    });
  } catch (error: any) {
    console.error('Error creating data export request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create data export request'
    });
  }
});

/**
 * @route GET /api/v1/compliance/data-export/:requestId/download
 * @desc Download exported data
 * @access Private
 */
router.get('/data-export/:requestId/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const gdprService = getGDPRService();
    const userId = req.auth!.payload.userId;
    const { requestId } = req.params;

    // Check if request exists and belongs to user
    const dsarResult = await gdprService['db'].query(`
      SELECT * FROM data_subject_requests
      WHERE id = $1 AND user_id = $2 AND request_type = 'export'
    `, [requestId, userId]);

    if (!dsarResult.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Export request not found'
      });
    }

    const dsar = dsarResult.rows[0];

    if (dsar.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Export not ready',
        status: dsar.status
      });
    }

    const filepath = dsar.response_data?.filepath;
    if (!filepath || !fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'Export file not found'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="user_export_${userId}.zip"`);

    // Stream file to response
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    await auditService.logUserAction({
      userId,
      action: 'download_data_export',
      resourceType: 'data_subject_request',
      resourceId: requestId,
      metadata: { filepath }
    });
  } catch (error: any) {
    console.error('Error downloading export:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download export'
    });
  }
});

/**
 * @route POST /api/v1/compliance/data-deletion
 * @desc Request account deletion (GDPR right to be forgotten)
 * @access Private
 */
router.post('/data-deletion', requireAuth, async (req: Request, res: Response) => {
  try {
    const gdprService = getGDPRService();
    const userId = req.auth!.payload.userId;

    // Create DSAR record
    const dsar = await gdprService.createDSAR(userId, 'deletion', {
      requestedAt: new Date().toISOString(),
      confirmation: req.body.confirmation,
      ipAddress: req.ip
    });

    // Process deletion asynchronously
    processDeletion(gdprService, userId, dsar.id).catch(error => {
      console.error('Error processing data deletion:', error);
    });

    res.json({
      success: true,
      message: 'Account deletion request received. This action is irreversible.',
      data: {
        requestId: dsar.id,
        status: dsar.status
      }
    });

    await auditService.logUserAction({
      userId,
      action: 'request_data_deletion',
      resourceType: 'data_subject_request',
      resourceId: dsar.id,
      metadata: { requestId: dsar.id }
    });
  } catch (error: any) {
    console.error('Error creating deletion request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create deletion request'
    });
  }
});

/**
 * @route GET /api/v1/compliance/requests
 * @desc Get user's data subject requests
 * @access Private
 */
router.get('/requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const gdprService = getGDPRService();
    const userId = req.auth!.payload.userId;

    const result = await gdprService['db'].query(`
      SELECT id, request_type, status, request_data, created_at,
             processed_at, notes
      FROM data_subject_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: result.rows
    });

    await auditService.logUserAction({
      userId,
      action: 'view_dsar_requests',
      resourceType: 'data_subject_request'
    });
  } catch (error: any) {
    console.error('Error fetching DSAR requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests'
    });
  }
});

/**
 * @route GET /api/v1/admin/compliance/audit-logs
 * @desc Get audit logs (admin only)
 * @access Admin
 */
router.get('/admin/compliance/audit-logs', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      category,
      action,
      severity,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
      searchTerm
    } = req.query;

    const filters: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    if (userId) filters.userId = userId;
    if (category) filters.category = category;
    if (action) filters.action = action;
    if (severity) filters.severity = severity;
    if (searchTerm) filters.searchTerm = searchTerm;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const logs = await auditService.queryAuditLogs(filters);

    res.json({
      success: true,
      data: {
        logs,
        filters,
        total: logs.length
      }
    });

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'view_audit_logs',
      resourceType: 'audit_logs',
      metadata: filters
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

/**
 * @route GET /api/v1/admin/compliance/audit-logs/export
 * @desc Export audit logs to CSV (admin only)
 * @access Admin
 */
router.get('/admin/compliance/audit-logs/export', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category, userId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const csv = await auditService.exportAuditLogs({
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      category: category as string,
      userId: userId as string
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
    res.send(csv);

    await auditService.logAdminAction({
      userId: req.auth!.payload.userId,
      action: 'export_audit_logs',
      resourceType: 'audit_logs',
      metadata: { startDate, endDate, category, userId }
    });
  } catch (error: any) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs'
    });
  }
});

/**
 * @route GET /api/v1/admin/compliance/stats
 * @desc Get compliance statistics (admin only)
 * @access Admin
 */
router.get('/admin/compliance/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;

    const [consentStats, dsarStats, auditStats] = await Promise.all([
      // Consent statistics
      getGDPRService()['db'].query(`
        SELECT
          consent_type,
          status,
          COUNT(*) as count,
          DATE_TRUNC('day', created_at) as date
        FROM user_consents
        WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY consent_type, status, DATE_TRUNC('day', created_at)
        ORDER BY date DESC
      `),

      // DSAR statistics
      getGDPRService()['db'].query(`
        SELECT
          request_type,
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (processed_at - created_at))/3600) as avg_processing_hours
        FROM data_subject_requests
        WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY request_type, status
      `),

      // Audit statistics
      auditService.getAuditStats({ days: parseInt(days as string) })
    ]);

    res.json({
      success: true,
      data: {
        consentStats: consentStats.rows,
        dsarStats: dsarStats.rows,
        auditStats,
        period: `${days} days`
      }
    });
  } catch (error: any) {
    console.error('Error fetching compliance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * Asynchronous function to process data export
 */
async function processExport(gdprService: GDPRService, userId: string, requestId: string) {
  try {
    await gdprService.exportUserData(userId, requestId);
  } catch (error) {
    console.error('Failed to process data export:', error);
    // Update request with error
    await gdprService['db'].query(`
      UPDATE data_subject_requests
      SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
      WHERE id = $1
    `, [requestId, error.message]);
  }
}

/**
 * Asynchronous function to process data deletion
 */
async function processDeletion(gdprService: GDPRService, userId: string, requestId: string) {
  try {
    await gdprService.deleteUserData(userId, requestId);
  } catch (error) {
    console.error('Failed to process data deletion:', error);
    // Update request with error
    await gdprService['db'].query(`
      UPDATE data_subject_requests
      SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
      WHERE id = $1
    `, [requestId, error.message]);
  }
}

export default router;