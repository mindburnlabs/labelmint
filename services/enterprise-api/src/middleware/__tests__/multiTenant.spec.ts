import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../app.js', () => {
  return {
    prisma: {
      $queryRaw: vi.fn()
    },
    redis: {
      get: vi.fn(),
      setex: vi.fn()
    }
  }
})

vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { prisma, redis } from '../../app.js'
import {
  __storageUtils,
  BYTES_IN_GIGABYTE,
  __setTenantTestClients,
  __resetTenantTestClients,
  __debugTenantClients
} from '../multiTenant.js'

const toSql = (query: any) => {
  if (!query) return ''
  if (Array.isArray(query.strings)) {
    return query.strings.join('')
  }
  return String(query)
}

describe('multiTenant storage usage calculation', () => {
  beforeAll(() => {
    __setTenantTestClients({ prisma, redis })
    expect(__debugTenantClients.getPrisma()).toBe(prisma)
  })

  afterAll(() => {
    __resetTenantTestClients()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    ;(redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(redis.setex as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockReset()
    expect(__debugTenantClients.getPrisma().$queryRaw).toBe(prisma.$queryRaw)
  })

  it('returns cached storage usage when available', async () => {
    redis.get.mockResolvedValueOnce('2.5')

    const value = await __storageUtils.calculateStorageUsage('org-123')

    expect(value).toBe(2.5)
    expect(redis.setex).not.toHaveBeenCalled()
  })

  it('persists calculated usage to cache when not cached', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async () => [{ exists: true }])
      .mockImplementationOnce(async () => [{ total: 1024 * 1024 }])

    const usage = await __storageUtils.calculateStorageUsage('org-456')

    expect(redis.setex).toHaveBeenCalledWith(
      'org:org-456:storage-usage',
      expect.any(Number),
      usage.toString()
    )
  })

  it('returns 0 when table does not exist', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockImplementation(async (query: any) => {
      const sql = toSql(query)
      if (sql.includes('information_schema.tables')) {
        return [{ exists: false }]
      }
      return [{ total: 0 }]
    })

    const bytes = await __storageUtils.sumStorageFromSource(
      {
        table: 'missing_table',
        sizeColumn: 'size_bytes',
        organizationColumn: 'organization_id'
      },
      'org-789'
    )

    expect(bytes).toBe(0)
  })

  it('falls back to zero when query fails', async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async () => [{ exists: true }])
      .mockImplementationOnce(async () => {
        throw new Error('boom')
      })

    const bytes = await __storageUtils.sumStorageFromSource(
      {
        table: 'dataset_files',
        sizeColumn: 'file_size_bytes',
        organizationColumn: 'organization_id'
      },
      'org-987'
    )

    expect(bytes).toBe(0)
  })

})
