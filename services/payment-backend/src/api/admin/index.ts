import { Router } from 'express';
import * as adminController from './admin';
import { authenticateToken } from '../../middleware/auth';
import {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  Permission
} from '../../middleware/rbac';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Dashboard and Statistics
router.get('/dashboard/stats',
  requireAnyPermission([
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.VIEW_USERS,
    Permission.VIEW_PROJECTS
  ]),
  adminController.getDashboardStats
);

router.get('/system/health',
  requirePermission(Permission.VIEW_SYSTEM_HEALTH),
  adminController.getSystemHealth
);

router.get('/activity/log',
  requirePermission(Permission.VIEW_ACTIVITY_LOGS),
  adminController.getActivityLog
);

// User Management
router.get('/users',
  requirePermission(Permission.VIEW_USERS),
  adminController.getUsers
);

router.put('/users/:id',
  requirePermission(Permission.MANAGE_USERS),
  adminController.updateUser
);

router.post('/users/bulk-action',
  requirePermission(Permission.MANAGE_USERS),
  adminController.bulkUserAction
);

router.get('/users/export',
  requireAllPermissions([Permission.VIEW_USERS, Permission.EXPORT_USERS]),
  adminController.exportUsers
);

// Project Moderation
router.get('/projects/pending',
  requirePermission(Permission.VIEW_PROJECTS),
  adminController.getPendingProjects
);

router.post('/projects/:id/moderate',
  requirePermission(Permission.MODERATE_PROJECTS),
  adminController.moderateProject
);

export default router;