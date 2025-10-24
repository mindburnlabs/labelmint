import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export enum Permission {
  // User management
  VIEW_USERS = 'view_users',
  MANAGE_USERS = 'manage_users',
  EXPORT_USERS = 'export_users',

  // Project management
  VIEW_PROJECTS = 'view_projects',
  MANAGE_PROJECTS = 'manage_projects',
  MODERATE_PROJECTS = 'moderate_projects',

  // Financial operations
  VIEW_TRANSACTIONS = 'view_transactions',
  MANAGE_WITHDRAWALS = 'manage_withdrawals',
  VIEW_FINANCIAL_REPORTS = 'view_financial_reports',

  // System administration
  VIEW_SYSTEM_HEALTH = 'view_system_health',
  MANAGE_SYSTEM_CONFIG = 'manage_system_config',
  VIEW_ACTIVITY_LOGS = 'view_activity_logs',

  // API management
  MANAGE_API_KEYS = 'manage_api_keys',
  VIEW_API_USAGE = 'view_api_usage'
}

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    Permission.VIEW_USERS,
    Permission.MANAGE_USERS,
    Permission.EXPORT_USERS,
    Permission.VIEW_PROJECTS,
    Permission.MANAGE_PROJECTS,
    Permission.MODERATE_PROJECTS,
    Permission.VIEW_TRANSACTIONS,
    Permission.MANAGE_WITHDRAWALS,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.VIEW_SYSTEM_HEALTH,
    Permission.MANAGE_SYSTEM_CONFIG,
    Permission.VIEW_ACTIVITY_LOGS,
    Permission.MANAGE_API_KEYS,
    Permission.VIEW_API_USAGE
  ],
  moderator: [
    Permission.VIEW_USERS,
    Permission.VIEW_PROJECTS,
    Permission.MODERATE_PROJECTS,
    Permission.VIEW_TRANSACTIONS,
    Permission.VIEW_ACTIVITY_LOGS
  ],
  support: [
    Permission.VIEW_USERS,
    Permission.VIEW_PROJECTS,
    Permission.VIEW_TRANSACTIONS,
    Permission.VIEW_ACTIVITY_LOGS
  ],
  viewer: [
    Permission.VIEW_USERS,
    Permission.VIEW_PROJECTS,
    Permission.VIEW_TRANSACTIONS,
    Permission.VIEW_SYSTEM_HEALTH,
    Permission.VIEW_ACTIVITY_LOGS,
    Permission.VIEW_API_USAGE
  ]
};

/**
 * Check if user has required permission
 */
export const requirePermission = (permission: Permission) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (!userPermissions.includes(permission)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        userRole,
        userPermissions
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has any of the required permissions
 */
export const requireAnyPermission = (permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    const hasPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        userRole,
        userPermissions
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has all required permissions
 */
export const requireAllPermissions = (permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    const hasAllPermissions = permissions.every(p => userPermissions.includes(p));

    if (!hasAllPermissions) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        userRole,
        userPermissions
      });
      return;
    }

    next();
  };
};

/**
 * Get user permissions for request context
 */
export const getUserPermissions = (req: AuthRequest): Permission[] => {
  if (!req.user) return [];
  return ROLE_PERMISSIONS[req.user.role] || [];
};

/**
 * Check if user can access resource based on ownership or role
 */
export const requireOwnershipOrRole = (
  getResourceOwner: (req: AuthRequest) => Promise<string | null>,
  allowedRoles: string[] = ['admin']
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Admins can access everything
    if (allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    // Check ownership
    const resourceOwnerId = await getResourceOwner(req);
    if (resourceOwnerId && resourceOwnerId === req.user.id) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Access denied: Not the resource owner or insufficient role'
    });
  };
};