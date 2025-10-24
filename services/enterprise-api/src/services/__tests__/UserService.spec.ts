import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../app.js', () => {
  const fn = vi.fn
  return {
    prisma: {
      organizationMember: {
        findUnique: fn(),
        findMany: fn(),
        count: fn(),
        upsert: fn(),
        update: fn()
      },
      user: {
        findUnique: fn(),
        update: fn(),
        create: fn()
      },
      $transaction: fn(async (promises: any[]) => Promise.all(promises))
    },
    redis: {
      get: fn(),
      setex: fn()
    }
  }
})

vi.mock('../AuditService.js', () => ({
  AuditService: {
    log: vi.fn()
  }
}))

vi.mock('../EmailService.js', () => ({
  EmailService: {
    sendInvitation: vi.fn()
  }
}))

import { prisma } from '../../app.js'
import { UserService } from '../UserService.js'

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when requester is not an active member', async () => {
    prisma.organizationMember.findUnique.mockResolvedValueOnce(null)

    await expect(UserService.list('org-1', 'user-1')).rejects.toThrow(/Access denied/)
  })

  it('returns paginated user list for active member', async () => {
    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      status: 'active',
      role: 'admin',
      permissions: ['organization:manage_members']
    })

    prisma.organizationMember.findMany.mockResolvedValueOnce([
      {
        organizationId: 'org-1',
        userId: 'user-2',
        role: 'member',
        status: 'active',
        permissions: [],
        joinedAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        user: {
          id: 'user-2',
          email: 'member@example.com',
          username: 'member',
          fullName: 'Test Member',
          avatar: null,
          lastLoginAt: null,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-02T00:00:00Z'),
          status: 'active',
          title: null,
          department: null
        }
      }
    ])
    prisma.organizationMember.count.mockResolvedValueOnce(1)

    const result = await UserService.list('org-1', 'user-1', { page: 1, limit: 10 })

    expect(result.users).toHaveLength(1)
    expect(result.pagination.total).toBe(1)
    expect(result.users[0].email).toBe('member@example.com')
  })

  it('prevents deactivating the last active owner', async () => {
    prisma.organizationMember.findUnique
      .mockResolvedValueOnce({
        status: 'active',
        role: 'admin',
        permissions: ['organization:manage_members']
      })
      .mockResolvedValueOnce({
        status: 'active',
        role: 'owner'
      })

    prisma.organizationMember.count.mockResolvedValueOnce(1)

    await expect(
      UserService.deactivate('org-1', 'target-user', 'actor-user')
    ).rejects.toThrow('Organization must have at least one active owner')
  })
})
