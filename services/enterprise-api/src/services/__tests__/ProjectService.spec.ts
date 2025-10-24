import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../app.js', () => {
  const fn = vi.fn
  return {
    prisma: {
      organizationMember: {
        findUnique: fn()
      },
      team: {
        findUnique: fn()
      },
      project: {
        create: fn()
      }
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

import { prisma } from '../../app.js'
import { ProjectService } from '../ProjectService.js'

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when actor lacks permission to create projects', async () => {
    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      status: 'active',
      role: 'member',
      permissions: []
    })

    await expect(
      ProjectService.create('org-1', 'user-1', {
        teamId: 'team-1',
        name: 'Test Project'
      })
    ).rejects.toThrow(/Insufficient permissions/)
  })

  it('creates project for authorized actor', async () => {
    prisma.organizationMember.findUnique.mockResolvedValueOnce({
      status: 'active',
      role: 'admin',
      permissions: ['project:create']
    })

    prisma.team.findUnique.mockResolvedValueOnce({
      id: 'team-1',
      organizationId: 'org-1'
    })

    prisma.project.create.mockResolvedValueOnce({
      id: 'proj-1',
      organizationId: 'org-1',
      teamId: 'team-1',
      name: 'Test Project',
      description: null,
      type: 'custom',
      status: 'active',
      workflowId: null,
      settings: {},
      metadata: {},
      budget: {},
      timeline: {},
      tags: [],
      isPrivate: false,
      archivedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      team: {
        id: 'team-1',
        name: 'Core Team'
      }
    })

    const project = await ProjectService.create('org-1', 'user-1', {
      teamId: 'team-1',
      name: 'Test Project'
    })

    expect(project.id).toBe('proj-1')
    expect(prisma.project.create).toHaveBeenCalled()
  })
})
