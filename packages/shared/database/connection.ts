// ============================================================================
// DATABASE CONNECTION MANAGER
// ============================================================================

import { Pool, PoolClient, PoolConfig } from 'pg'
import { Logger } from '../utils/logger'

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
  pool?: {
    min: number
    max: number
    idleTimeoutMillis: number
    connectionTimeoutMillis: number
  }
}

export class DatabaseConnection {
  private pool: Pool
  private logger: Logger
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
    this.logger = new Logger('database')

    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      min: config.pool?.min || 2,
      max: config.pool?.max || 10,
      idleTimeoutMillis: config.pool?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.pool?.connectionTimeoutMillis || 2000,
    }

    this.pool = new Pool(poolConfig)

    // Handle pool events
    this.pool.on('connect', (client) => {
      this.logger.debug('New database client connected')
    })

    this.pool.on('error', (err) => {
      this.logger.error('Database pool error', err)
    })

    this.pool.on('remove', (client) => {
      this.logger.debug('Database client removed')
    })
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const start = Date.now()

    try {
      const result = await this.pool.query(sql, params)
      const duration = Date.now() - start

      this.logger.debug('Query executed', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        params,
        rowCount: result.rowCount,
        duration: `${duration}ms`
      })

      return result.rows
    } catch (error) {
      const duration = Date.now() - start
      this.logger.error('Query failed', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        params,
        error: error instanceof Error ? error.message : error,
        duration: `${duration}ms`
      })
      throw error
    }
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      const result = await callback(client)

      await client.query('COMMIT')

      this.logger.debug('Transaction committed')
      return result
    } catch (error) {
      await client.query('ROLLBACK')

      this.logger.error('Transaction rolled back', { error: error instanceof Error ? error.message : error })
      throw error
    } finally {
      client.release()
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1')
      return true
    } catch (error) {
      this.logger.error('Database health check failed', error)
      return false
    }
  }

  async getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
    this.logger.info('Database connection pool closed')
  }

  // Migration helpers
  async runMigrations(migrationFiles: string[]): Promise<void> {
    this.logger.info('Running database migrations')

    // Create migrations table if not exists
    await this.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get executed migrations
    const executedMigrations = await this.query<{ filename: string }>(
      'SELECT filename FROM migrations ORDER BY filename'
    )
    const executedFilenames = new Set(executedMigrations.map(m => m.filename))

    // Run pending migrations
    for (const filename of migrationFiles) {
      if (!executedFilenames.has(filename)) {
        this.logger.info(`Running migration: ${filename}`)

        // Here you would load and execute the migration file
        // const migration = await import(`./migrations/${filename}`)
        // await this.query(migration.up)

        await this.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        )

        this.logger.info(`Migration completed: ${filename}`)
      }
    }
  }

  // Seed data helper
  async seedData(seedFunction: (client: PoolClient) => Promise<void>): Promise<void> {
    this.logger.info('Seeding database data')

    await this.transaction(async (client) => {
      await seedFunction(client)
    })

    this.logger.info('Database seeding completed')
  }
}

// Singleton instance
let databaseInstance: DatabaseConnection | null = null

export function initializeDatabase(config: DatabaseConfig): DatabaseConnection {
  if (!databaseInstance) {
    databaseInstance = new DatabaseConnection(config)
  }
  return databaseInstance
}

export function getDatabase(): DatabaseConnection {
  if (!databaseInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return databaseInstance
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (databaseInstance) {
    await databaseInstance.close()
    process.exit(0)
  }
})

process.on('SIGTERM', async () => {
  if (databaseInstance) {
    await databaseInstance.close()
    process.exit(0)
  }
})