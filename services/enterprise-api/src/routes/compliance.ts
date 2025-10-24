import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, param, query } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { checkPermission } from '../middleware/permissions';
import { ComplianceEngine } from '../services/ComplianceEngine';
import { AuditLogger } from '../utils/audit';
import { logger } from '../utils/logger';

const router = Router();
const complianceEngine = new ComplianceEngine();

// Get audit logs
router.get('/audit-logs',
  authMiddleware,
  param('id').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('resourceType').optional().isString(),
  query('action').optional().isString(),
  query('userId').optional().isUUID(),
  validateRequest,
  checkPermission('canViewAuditLogs'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const {
        page = 1,
        limit = 100,
        startDate,
        endDate,
        resourceType,
        action,
        userId
      } = req.query;

      // Build where clause
      const where: any = {
        organizationId: id
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      if (resourceType) where.resourceType = resourceType;
      if (action) where.action = action;
      if (userId) where.userId = userId;

      // Fetch audit logs
      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        db.auditLog.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Failed to fetch audit logs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Generate compliance report
router.post('/reports',
  authMiddleware,
  param('id').isUUID(),
  body('reportType').isIn(['AUDIT_LOGS', 'DATA_RETENTION', 'ACCESS_CONTROL', 'COMPLIANCE_SUMMARY', 'SECURITY_REPORT']),
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('filters').optional().isObject(),
  body('format').optional().isIn(['json', 'csv', 'pdf']),
  body('schedule').optional().isObject(),
  validateRequest,
  checkPermission('canGenerateReports'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const userId = (req as any).user.id;
      const {
        reportType,
        title,
        description,
        filters = {},
        format = 'json',
        schedule
      } = req.body;

      // Generate report content based on type
      let content: any;
      switch (reportType) {
        case 'AUDIT_LOGS':
          content = await complianceEngine.generateAuditReport(id, filters);
          break;
        case 'DATA_RETENTION':
          content = await complianceEngine.generateDataRetentionReport(id, filters);
          break;
        case 'ACCESS_CONTROL':
          content = await complianceEngine.generateAccessControlReport(id, filters);
          break;
        case 'COMPLIANCE_SUMMARY':
          content = await complianceEngine.generateComplianceSummary(id, filters);
          break;
        case 'SECURITY_REPORT':
          content = await complianceEngine.generateSecurityReport(id, filters);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid report type'
          });
      }

      // Create compliance report
      const report = await db.complianceReport.create({
        data: {
          organizationId: id,
          reportType,
          title,
          description,
          status: 'PENDING',
          content,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          createdBy: userId
        }
      });

      // Process report in background
      complianceEngine.processReport(report.id, format, filters);

      await AuditLogger.log({
        organizationId: id,
        userId,
        resourceType: 'COMPLIANCE_REPORT',
        resourceId: report.id,
        action: 'CREATE',
        details: { reportType, title }
      }, db);

      res.status(201).json({
        success: true,
        data: { report }
      });
    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get compliance reports
router.get('/reports',
  authMiddleware,
  param('id').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('reportType').optional().isString(),
  query('status').optional().isIn(['PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'EXPIRED']),
  validateRequest,
  checkPermission('canViewReports'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const {
        page = 1,
        limit = 20,
        reportType,
        status
      } = req.query;

      const where: any = {
        organizationId: id
      };

      if (reportType) where.reportType = reportType;
      if (status) where.status = status;

      const [reports, total] = await Promise.all([
        db.complianceReport.findMany({
          where,
          include: {
            creator: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        db.complianceReport.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Failed to fetch compliance reports:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get compliance dashboard
router.get('/dashboard',
  authMiddleware,
  param('id').isUUID(),
  validateRequest,
  checkPermission('canViewCompliance'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;

      // Get comprehensive compliance data
      const [
        auditLogCounts,
        reportCounts,
        recentViolations,
        userAccessSummary,
        dataRetentionStatus,
        securityScore,
        complianceFrameworks
      ] = await Promise.all([
        // Audit log summary
        db.auditLog.groupBy({
          by: ['action'],
          where: {
            organizationId: id,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          _count: {
            action: true
          }
        }),
        // Report status summary
        db.complianceReport.groupBy({
          by: ['status'],
          where: {
            organizationId: id,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          _count: {
            status: true
          }
        }),
        // Recent compliance violations
        db.auditLog.findMany({
          where: {
            organizationId: id,
            action: { in: ['ACCESS_VIOLATION', 'DATA_BREACH', 'POLICY_VIOLATION'] },
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }),
        // User access summary
        db.organizationUser.aggregate({
          where: {
            organizationId: id,
            isActive: true
          },
          by: ['role'],
          _count: {
            role: true
          }
        }),
        // Data retention status
        complianceEngine.getDataRetentionStatus(id),
        // Security score calculation
        complianceEngine.calculateSecurityScore(id),
        // Compliance frameworks status
        complianceEngine.getComplianceFrameworksStatus(id)
      ]);

      const dashboard = {
        auditSummary: {
          totalLogs: auditLogCounts.reduce((sum, item) => sum + item._count, 0),
          last30Days: auditLogCounts,
          criticalEvents: auditLogCounts.filter(item =>
            ['DELETE', 'ACCESS_DENIED', 'SECURITY_BREACH'].includes(item.action)
          ).reduce((sum, item) => sum + item._count, 0)
        },
        reportSummary: {
          total: reportCounts.reduce((sum, item) => sum + item._count, 0),
          byStatus: reportCounts,
          pending: reportCounts.find(r => r.status === 'PENDING')?._count || 0,
          failed: reportCounts.find(r => r.status === 'FAILED')?._count || 0
        },
        violations: {
          recent: recentViolations,
          total: recentViolations.length,
          severityBreakdown: recentViolations.reduce((acc, v) => {
            acc[v.severity || 'medium'] = (acc[v.severity || 'medium'] || 0) + 1;
            return acc;
          }, {})
        },
        userAccess: {
          totalUsers: userAccessSummary.reduce((sum, item) => sum + item._count, 0),
          byRole: userAccessSummary,
          highPrivilege: userAccessSummary.filter(u =>
            ['OWNER', 'ADMIN'].includes(u.role)
          ).reduce((sum, item) => sum + item._count, 0)
        },
        dataRetention: dataRetentionStatus,
        securityScore: {
          overall: securityScore.overall,
          breakdown: securityScore.breakdown,
          trends: securityScore.trends,
          recommendations: securityScore.recommendations
        },
        complianceFrameworks: complianceFrameworks,
        lastScan: new Date()
      };

      res.json({
        success: true,
        data: { dashboard }
      });
    } catch (error) {
      logger.error('Failed to fetch compliance dashboard:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Handle data retention settings
router.post('/data-retention',
  authMiddleware,
  param('id').isUUID(),
  body('retentionPeriods').isObject(),
  body('autoDelete').optional().isBoolean(),
  body('anonymizationRules').optional().isArray(),
  validateRequest,
  checkPermission('canManageCompliance'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const { retentionPeriods, autoDelete, anonymizationRules } = req.body;
      const userId = (req as any).user.id;

      // Update organization settings
      const organization = await db.organization.update({
        where: { id },
        data: {
          settings: {
            compliance: {
              dataRetention: {
                retentionPeriods,
                autoDelete: autoDelete || false,
                anonymizationRules: anonymizationRules || [],
                lastUpdated: new Date().toISOString()
              }
            }
          }
        }
      });

      // Schedule data cleanup if auto-delete is enabled
      if (autoDelete) {
        complianceEngine.scheduleDataCleanup(id, retentionPeriods);
      }

      await AuditLogger.log({
        organizationId: id,
        userId,
        resourceType: 'COMPLIANCE_SETTINGS',
        resourceId: id,
        action: 'UPDATE',
        details: { retentionPeriods, autoDelete }
      }, db);

      res.json({
        success: true,
        data: { organization }
      });
    } catch (error) {
      logger.error('Failed to update data retention settings:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Export data for GDPR/CCPA compliance
router.post('/export-data',
  authMiddleware,
  param('id').isUUID(),
  body('userId').optional().isUUID(),
  body('dataTypes').isArray(),
  body('format').optional().isIn(['json', 'csv']),
  validateRequest,
  checkPermission('canExportData'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const userId = (req as any).user.id;
      const { userId: targetUserId, dataTypes = ['profile', 'activity', 'projects'], format = 'json' } = req.body;

      // Validate permissions for data export
      if (targetUserId && targetUserId !== userId) {
        // Only admins can export other users' data
        const requester = await db.organizationUser.findFirst({
          where: {
            organizationId: id,
            userId,
            role: { in: ['OWNER', 'ADMIN'] }
          }
        });

        if (!requester) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions to export user data'
          });
        }
      }

      // Compile user data
      const exportData = await complianceEngine.compileUserData(
        id,
        targetUserId || userId,
        dataTypes
      );

      // Create export record for audit
      await db.auditLog.create({
        data: {
          organizationId: id,
          userId,
          resourceType: 'DATA_EXPORT',
          action: 'EXPORT',
          details: {
            targetUser: targetUserId,
            dataTypes,
            format
          }
        }
      });

      // Generate export file
      const exportId = await complianceEngine.generateExportFile(
        exportData,
        format,
        `data-export-${Date.now()}`
      );

      res.json({
        success: true,
        data: {
          exportId,
          downloadUrl: `/api/enterprise/v1/compliance/download-export/${exportId}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });
    } catch (error) {
      logger.error('Failed to export data:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Handle right to be forgotten
router.post('/forget-me',
  authMiddleware,
  param('id').isUUID(),
  body('userId').isUUID(),
  body('confirmation').isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const { userId, confirmation } = req.body;
      const requestingUserId = (req as any).user.id;

      // Verify user is requesting their own data or has admin rights
      if (userId !== requestingUserId) {
        const adminUser = await db.organizationUser.findFirst({
          where: {
            organizationId: id,
            userId: requestingUserId,
            role: { in: ['OWNER', 'ADMIN'] }
          }
        });

        if (!adminUser) {
          return res.status(403).json({
            success: false,
            error: 'Can only delete own data or need admin permissions'
          });
        }
      }

      if (!confirmation) {
        return res.status(400).json({
          success: false,
          error: 'Confirmation is required'
        });
      }

      // Begin data deletion process
      const deletionId = await complianceEngine.initiateDataDeletion({
        organizationId: id,
        userId,
        requestedBy: requestingUserId
      });

      res.json({
        success: true,
        message: 'Data deletion process initiated',
        data: {
          deletionId,
          estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      });
    } catch (error) {
      logger.error('Failed to initiate data deletion:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;