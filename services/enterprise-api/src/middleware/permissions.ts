import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth'

export type Permission =
  | 'org:read'
  | 'org:write'
  | 'org:admin'
  | 'project:read'
  | 'project:write'
  | 'project:admin'
  | 'user:read'
  | 'user:write'
  | 'user:admin'
  | 'workflow:read'
  | 'workflow:write'
  | 'workflow:admin'

export function checkPermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      })
      return
    }

    const userRole = req.user.role || 'user'

    // Role-based permission mapping
    const rolePermissions: Record<string, Permission[]> = {
      admin: [
        'org:read', 'org:write', 'org:admin',
        'project:read', 'project:write', 'project:admin',
        'user:read', 'user:write', 'user:admin',
        'workflow:read', 'workflow:write', 'workflow:admin'
      ],
      manager: [
        'org:read', 'org:write',
        'project:read', 'project:write', 'project:admin',
        'user:read', 'user:write',
        'workflow:read', 'workflow:write'
      ],
      user: [
        'org:read',
        'project:read',
        'workflow:read'
      ]
    }

    const permissions = rolePermissions[userRole] || rolePermissions.user

    if (!permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' }
      })
      return
    }

    next()
  }
}

export function hasPermission(userRole: string, permission: Permission): boolean {
  const rolePermissions: Record<string, Permission[]> = {
    admin: [
      'org:read', 'org:write', 'org:admin',
      'project:read', 'project:write', 'project:admin',
      'user:read', 'user:write', 'user:admin',
      'workflow:read', 'workflow:write', 'workflow:admin'
    ],
    manager: [
      'org:read', 'org:write',
      'project:read', 'project:write', 'project:admin',
      'user:read', 'user:write',
      'workflow:read', 'workflow:write'
    ],
    user: [
      'org:read',
      'project:read',
      'workflow:read'
    ]
  }

  const permissions = rolePermissions[userRole] || rolePermissions.user
  return permissions.includes(permission)
}