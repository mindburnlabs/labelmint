import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, param, query } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { checkPermission } from '../middleware/permissions';
import { slugify } from '../utils/slugify';
import { generateApiKey } from '../utils/apiKeys';
import { sendInviteEmail } from '../utils/email';
import { AuditLogger } from '../utils/audit';

// Custom domain validator
const isDomain = (value: string) => {
  if (!value) return true; // Optional field
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(value);
};

const router = Router();

// Get all organizations for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db: PrismaClient = (req as any).db;
    const userId = (req as any).user.id;

    const organizations = await db.organization.findMany({
      where: {
        users: {
          some: {
            userId,
            isActive: true
          }
        }
      },
      include: {
        users: {
          where: { isActive: true },
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
        },
        teams: {
          include: {
            _count: {
              select: {
                members: true
              }
            }
          }
        },
        _count: {
          select: {
            projects: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: {
        organizations: organizations.map(org => ({
          ...org,
          memberRole: org.users.find(u => u.userId === userId)?.role,
          permissions: org.users.find(u => u.userId === userId)?.permissions
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get organization details
router.get('/:id',
  authMiddleware,
  param('id').isUUID(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const userId = (req as any).user.id;

      const organization = await db.organization.findFirst({
        where: {
          id,
          users: {
            some: {
              userId,
              isActive: true
            }
          }
        },
        include: {
          teams: {
            include: {
              _count: {
                select: { members: true }
              }
            }
          },
          projects: {
            where: {
              archivedAt: null
            },
            include: {
              _count: {
                select: { tasks: true }
              }
            }
          },
          workflows: {
            where: { isActive: true }
          },
          subscriptions: {
            where: {
              status: 'ACTIVE'
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 50
          },
          _count: {
            select: {
              users: true,
              apiKeys: true
            }
          }
        }
      });

      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found'
        });
      }

      res.json({
        success: true,
        data: { organization }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Create new organization
router.post('/',
  authMiddleware,
  body('name').trim().isLength({ min: 3, max: 100 }),
  body('domain').trim().optional().custom(isDomain),
  body('description').trim().optional().isLength({ max: 500 }),
  body('plan').isIn(['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { name, domain, description, plan } = req.body;
      const userId = (req as any).user.id;

      // Check if user already has an organization (for paid plans)
      if (plan !== 'TRIAL') {
        const existingOrg = await db.organizationUser.findFirst({
          where: {
            userId,
            organization: {
              isActive: true
            }
          }
        });

        if (existingOrg) {
          return res.status(400).json({
            success: false,
            error: 'User already has an active organization'
          });
        }
      }

      // Create organization slug
      const slug = slugify(name);
      const existingSlug = await db.organization.findFirst({
        where: { slug }
      });

      if (existingSlug) {
        return res.status(400).json({
          success: false,
          error: 'Organization name already taken'
        });
      }

      const organization = await db.organization.create({
        data: {
          name,
          slug,
          domain,
          subscriptionPlan: plan || 'TRIAL',
          billingEmail: (req as any).user.email || req.body.billingEmail,
          credits: plan === 'TRIAL' ? 100 : 0,
          maxUsers: getMaxUsersForPlan(plan),
          maxProjects: getMaxProjectsForPlan(plan),
          trialEndsAt: plan === 'TRIAL' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
          settings: {
            description,
            requireApproval: plan === 'ENTERPRISE',
            defaultTeamSize: 5,
            workflowQuota: getWorkflowQuotaForPlan(plan)
          }
        }
      });

      // Add creator as owner
      await db.organizationUser.create({
        data: {
          organizationId: organization.id,
          userId,
          role: 'OWNER',
          permissions: {
            canManageOrg: true,
            canManageUsers: true,
            canManageBilling: true,
            canManageIntegrations: true,
            canManageSettings: true,
            canDeleteOrg: true
          }
        }
      });

      // Create default team
      const defaultTeam = await db.team.create({
        data: {
          organizationId: organization.id,
          name: 'General',
          description: 'Default team for all members',
          leadUserId: userId
        }
      });

      // Add owner to default team
      await db.teamMember.create({
        data: {
          teamId: defaultTeam.id,
          userId,
          role: 'LEAD'
        }
      });

      // Log creation
      await AuditLogger.log({
        organizationId: organization.id,
        userId,
        resourceType: 'ORGANIZATION',
        resourceId: organization.id,
        action: 'CREATE',
        details: { name, plan }
      }, db);

      res.status(201).json({
        success: true,
        data: { organization }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Update organization
router.put('/:id',
  authMiddleware,
  param('id').isUUID(),
  body('name').trim().optional().isLength({ min: 3, max: 100 }),
  body('logo').optional().isURL(),
  body('settings').optional().isObject(),
  validateRequest,
  checkPermission('canManageOrg'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const userId = (req as any).user.id;
      const { name, logo, settings } = req.body;

      // Verify user has access to organization
      const orgUser = await db.organizationUser.findFirst({
        where: {
          organizationId: id,
          userId,
          isActive: true
        }
      });

      if (!orgUser) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const updateData: any = {};
      if (name) {
        const slug = slugify(name);
        const existingSlug = await db.organization.findFirst({
          where: {
            slug,
            id: { not: id }
          }
        });

        if (existingSlug) {
          return res.status(400).json({
            success: false,
            error: 'Organization name already taken'
          });
        }
        updateData.name = name;
        updateData.slug = slug;
      }

      if (logo) updateData.logo = logo;
      if (settings) updateData.settings = settings;

      const organization = await db.organization.update({
        where: { id },
        data: updateData,
        include: {
          users: {
            where: { isActive: true }
          }
        }
      });

      await AuditLogger.log({
        organizationId: id,
        userId,
        resourceType: 'ORGANIZATION',
        resourceId: id,
        action: 'UPDATE',
        details: updateData
      }, db);

      res.json({
        success: true,
        data: { organization }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Invite team member
router.post('/:id/invite',
  authMiddleware,
  param('id').isUUID(),
  body('email').isEmail(),
  body('role').isIn(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  body('teams').optional().isArray(),
  body('message').optional().isLength({ max: 500 }),
  validateRequest,
  checkPermission('canManageUsers'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const userId = (req as any).user.id;
      const { email, role, teams, message } = req.body;

      // Verify user has permission
      const inviter = await db.organizationUser.findFirst({
        where: {
          organizationId: id,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
          isActive: true
        }
      });

      if (!inviter) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check if user is already invited
      const existingUser = await db.organizationUser.findFirst({
        where: {
          organizationId: id,
          user: {
            email
          },
          isActive: true
        },
        include: { user: true }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User is already a member of this organization'
        });
      }

      // Check organization capacity
      const memberCount = await db.organizationUser.count({
        where: {
          organizationId: id,
          isActive: true
        }
      });

      const org = await db.organization.findUnique({
        where: { id }
      });

      if (memberCount >= org.maxUsers) {
        return res.status(400).json({
          success: false,
          error: 'Organization has reached maximum user limit'
        });
      }

      // Create or find user
      let user = await db.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Create placeholder user for the invite
        user = await db.user.create({
          data: {
            email,
            firstName: email.split('@')[0],
            settings: { pendingInvite: true }
          }
        });
      }

      // Create organization user with invited status
      const orgUser = await db.organizationUser.create({
        data: {
          organizationId: id,
          userId: user.id,
          role,
          permissions: getDefaultPermissions(role),
          isActive: false, // Not active until invitation accepted
          invitedBy: userId
        }
      });

      // Add to teams if specified
      if (teams && teams.length > 0) {
        for (const teamId of teams) {
          await db.teamMember.create({
            data: {
              teamId,
              userId: user.id,
              role: 'MEMBER',
              isActive: false
            }
          });
        }
      }

      // Send invitation email
      const inviteToken = generateInviteToken(orgUser.id);
      await sendInviteEmail(email, {
        organizationName: org.name,
        inviterName: `${inviter.user.firstName} ${inviter.user.lastName}`,
        role,
        inviteToken,
        message,
        trialPlan: org.subscriptionPlan === 'TRIAL'
      });

      await AuditLogger.log({
        organizationId: id,
        userId,
        resourceType: 'ORGANIZATION_USER',
        resourceId: orgUser.id,
        action: 'INVITE',
        details: { email, role, teams }
      }, db);

      res.status(201).json({
        success: true,
        message: 'Invitation sent successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get organization members
router.get('/:id/members',
  authMiddleware,
  param('id').isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  query('team').optional().isUUID(),
  query('search').optional().trim(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const userId = (req as any).user.id;
      const { page = 1, limit = 20, role, team, search } = req.query;

      // Verify access
      const orgUser = await db.organizationUser.findFirst({
        where: {
          organizationId: id,
          userId,
          isActive: true
        }
      });

      if (!orgUser) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const where: any = {
        organizationId: id
      };

      if (role) where.role = role;
      if (search) {
        where.user = {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } }
          ]
        };
      }

      const [members, total] = await Promise.all([
        db.organizationUser.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                username: true,
                avatar: true,
                createdAt: true
              }
            },
            teams: {
              include: {
                team: {
                  select: { id: true, name: true }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        db.organizationUser.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          members: members,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Update member permissions
router.put('/:id/members/:userId',
  authMiddleware,
  param('id').isUUID(),
  param('userId').isUUID(),
  body('role').isIn(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  body('permissions').optional().isObject(),
  validateRequest,
  checkPermission('canManageUsers'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id, userId: targetUserId } = req.params;
      const userId = (req as any).user.id;
      const { role, permissions } = req.body;

      // Cannot change owner role
      const targetMember = await db.organizationUser.findFirst({
        where: {
          organizationId: id,
          userId: targetUserId
        },
        include: { user: true }
      });

      if (targetMember.role === 'OWNER') {
        return res.status(400).json({
          success: false,
          error: 'Cannot modify owner permissions'
        });
      }

      // Cannot promote to owner
      if (role === 'OWNER') {
        return res.status(403).json({
          success: false,
          error: 'Cannot assign owner role'
        });
      }

      const updateData: any = { role };
      if (permissions) updateData.permissions = permissions;

      const updatedMember = await db.organizationUser.update({
        where: {
          organizationId: id,
          userId: targetUserId
        },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      });

      await AuditLogger.log({
        organizationId: id,
        userId,
        resourceType: 'ORGANIZATION_USER',
        resourceId: updatedMember.id,
        action: 'UPDATE',
        details: {
          targetUser: targetMember.user.email,
          oldRole: targetMember.role,
          newRole: role
        }
      }, db);

      res.json({
        success: true,
        data: { member: updatedMember }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Deactivate organization
router.delete('/:id',
  authMiddleware,
  param('id').isUUID(),
  validateRequest,
  checkPermission('canDeleteOrg'),
  async (req: Request, res: Response) => {
    try {
      const db: PrismaClient = (req as any).db;
      const { id } = req.params;
      const userId = (req as any).user.id;

      // Verify user is owner
      const orgUser = await db.organizationUser.findFirst({
        where: {
          organizationId: id,
          userId,
          role: 'OWNER',
          isActive: true
        }
      });

      if (!orgUser) {
        return res.status(403).json({
          success: false,
          error: 'Only organization owners can delete organizations'
        });
      }

      // Soft delete
      await db.organization.update({
        where: { id },
        data: {
          isActive: false
        }
      });

      await AuditLogger.log({
        organizationId: id,
        userId,
        resourceType: 'ORGANIZATION',
        resourceId: id,
        action: 'DELETE',
        details: { reason: req.body.reason || 'User initiated deletion' }
      }, db);

      res.json({
        success: true,
        message: 'Organization deactivated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Helper functions
function getMaxUsersForPlan(plan: string): number {
  const plans = {
    TRIAL: 5,
    STARTER: 10,
    PROFESSIONAL: 50,
    ENTERPRISE: 1000
  };
  return plans[plan] || 5;
}

function getMaxProjectsForPlan(plan: string): number {
  const plans = {
    TRIAL: 3,
    STARTER: 10,
    PROFESSIONAL: 100,
    ENTERPRISE: 1000
  };
  return plans[plan] || 3;
}

function getWorkflowQuotaForPlan(plan: string): number {
  const plans = {
    TRIAL: 5,
    STARTER: 20,
    PROFESSIONAL: 100,
    ENTERPRISE: -1 // Unlimited
  };
  return plans[plan] || 5;
}

function getDefaultPermissions(role: string): object {
  const permissions = {
    OWNER: {
      canManageOrg: true,
      canManageUsers: true,
      canManageBilling: true,
      canManageIntegrations: true,
      canManageSettings: true,
      canDeleteOrg: true,
      canCreateProjects: true,
      canManageProjects: true,
      canCreateWorkflows: true,
      canManageWorkflows: true
    },
    ADMIN: {
      canManageOrg: true,
      canManageUsers: true,
      canManageBilling: true,
      canManageIntegrations: true,
      canManageSettings: false,
      canDeleteOrg: false,
      canCreateProjects: true,
      canManageProjects: true,
      canCreateWorkflows: true,
      canManageWorkflows: true
    },
    MEMBER: {
      canManageOrg: false,
      canManageUsers: false,
      canManageBilling: false,
      canManageIntegrations: false,
      canManageSettings: false,
      canDeleteOrg: false,
      canCreateProjects: true,
      canManageProjects: false,
      canCreateWorkflows: true,
      canManageWorkflows: false
    },
    VIEWER: {
      canManageOrg: false,
      canManageUsers: false,
      canManageBilling: false,
      canManageIntegrations: false,
      canManageSettings: false,
      canDeleteOrg: false,
      canCreateProjects: false,
      canManageProjects: false,
      canCreateWorkflows: false,
      canManageWorkflows: false
    }
  };

  return permissions[role] || {};
}

function generateInviteToken(orgUserId: string): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { orgUserId, type: 'invite' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export default router;