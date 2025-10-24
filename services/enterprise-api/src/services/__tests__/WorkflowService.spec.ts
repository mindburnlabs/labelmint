import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../app.js', () => {
  const fn = vi.fn
  return {
    prisma: {
      workflow: {
        findFirst: fn(),
        update: fn()
      },
      workflowExecution: {
        create: fn(),
        update: fn(),
        findMany: fn(),
        count: fn()
      }
    }
  }
})

vi.mock('../WorkflowEngine.js', () => ({
  workflowEngine: {
    execute: vi.fn()
  }
}))

const { prisma } = await import('../../app.js')
const { workflowEngine } = await import('../WorkflowEngine.js')
const { WorkflowService } = await import('../WorkflowService.js')

describe('WorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns detailed workflow metadata', async () => {
    prisma.workflow.findFirst.mockResolvedValueOnce({
      id: 'wf-1',
      name: 'My Workflow',
      description: 'Test',
      definition: { nodes: [], edges: [] },
      version: 2,
      isActive: true,
      category: null,
      tags: [],
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-02T00:00:00Z'),
      createdBy: 'user-1',
      creator: {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User'
      },
      executions: [
        {
          id: 'exec-1',
          status: 'COMPLETED',
          startTime: new Date('2025-01-05T00:00:00Z'),
          endTime: new Date('2025-01-05T00:10:00Z'),
          duration: 600000,
          error: null
        }
      ]
    })

    const detail = await WorkflowService.getDetailedWorkflow('wf-1', 'org-1')

    expect(detail?.creator?.email).toBe('user@example.com')
    expect(detail?.recentExecutions).toHaveLength(1)
    expect(detail?.recentExecutions[0].status).toBe('completed')
  })

  it('records execution lifecycle and returns enriched result', async () => {
    prisma.workflow.findFirst.mockResolvedValueOnce({
      id: 'wf-1',
      organizationId: 'org-1',
      isActive: true,
      definition: { nodes: [], edges: [] },
      version: 1
    })

    prisma.workflowExecution.create.mockResolvedValueOnce({
      id: 'exec-1'
    })
    prisma.workflowExecution.update.mockResolvedValue()

    workflowEngine.execute.mockResolvedValueOnce({
      output: { success: true },
      logs: []
    })

    const result = await WorkflowService.execute('wf-1', 'org-1', { foo: 'bar' }, 'user-1')

    expect(prisma.workflowExecution.create).toHaveBeenCalled()
    expect(prisma.workflowExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        output: { success: true }
      })
    })
    expect(result.id).toBe('exec-1')
    expect(result.status).toBe('completed')
  })

  it('marks execution as failed when engine throws', async () => {
    prisma.workflow.findFirst.mockResolvedValueOnce({
      id: 'wf-1',
      organizationId: 'org-1',
      isActive: true,
      definition: { nodes: [], edges: [] },
      version: 1
    })

    prisma.workflowExecution.create.mockResolvedValueOnce({
      id: 'exec-1'
    })
    prisma.workflowExecution.update.mockResolvedValue()

    workflowEngine.execute.mockRejectedValueOnce(new Error('Engine error'))

    await expect(
      WorkflowService.execute('wf-1', 'org-1', {}, 'user-1')
    ).rejects.toThrow('Engine error')
    expect(prisma.workflowExecution.update).toHaveBeenLastCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'Engine error'
      })
    })
  })
})
