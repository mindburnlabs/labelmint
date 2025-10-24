import { Pool, PoolClient } from 'pg';
import { execSync } from 'child_process';
import { join } from 'path';

// Test database configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'labelmint_test',
  user: process.env.TEST_DB_USER || 'test',
  password: process.env.TEST_DB_PASSWORD || 'test',
};

let testPool: Pool;

/**
 * Initialize test database connection pool
 */
export async function initializeTestDatabase(): Promise<Pool> {
  if (testPool) return testPool;

  testPool = new Pool(TEST_DB_CONFIG);

  // Test connection
  try {
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }

  return testPool;
}

/**
 * Get test database pool
 */
export function getTestDatabase(): Pool {
  if (!testPool) {
    throw new Error('Test database not initialized. Call initializeTestDatabase() first.');
  }
  return testPool;
}

/**
 * Create test database schema
 */
export async function createTestSchema(): Promise<void> {
  const pool = getTestDatabase();
  const client = await pool.connect();

  try {
    // Read migration files and execute them
    const migrationsPath = join(__dirname, '../../migrations');

    // Create tables
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        telegram_id VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(100),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        role VARCHAR(20) NOT NULL DEFAULT 'worker',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        ton_wallet_address VARCHAR(100),
        reputation INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        accuracy DECIMAL(3,2) DEFAULT 0,
        average_time_per_task INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_active_at TIMESTAMP WITH TIME ZONE,
        email_verified_at TIMESTAMP WITH TIME ZONE,
        kyc_status VARCHAR(20) DEFAULT 'pending',
        kyc_submitted_at TIMESTAMP WITH TIME ZONE,
        timezone VARCHAR(50),
        language VARCHAR(10) DEFAULT 'en',
        referral_code VARCHAR(20) UNIQUE,
        referred_by UUID REFERENCES users(id)
      );

      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        instructions TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        owner_id UUID NOT NULL REFERENCES users(id),
        budget DECIMAL(12,2) NOT NULL DEFAULT 0,
        budget_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
        task_reward DECIMAL(8,2) NOT NULL DEFAULT 0,
        total_tasks INTEGER NOT NULL DEFAULT 0,
        completed_tasks INTEGER NOT NULL DEFAULT 0,
        labels_per_task INTEGER NOT NULL DEFAULT 3,
        consensus_threshold INTEGER NOT NULL DEFAULT 2,
        category VARCHAR(50),
        metadata JSONB,
        settings JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        published_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        archived_at TIMESTAMP WITH TIME ZONE
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        instructions TEXT,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        assigned_to UUID REFERENCES users(id),
        created_by UUID NOT NULL REFERENCES users(id),
        labels_required INTEGER NOT NULL DEFAULT 3,
        labels_received INTEGER NOT NULL DEFAULT 0,
        consensus_threshold INTEGER NOT NULL DEFAULT 2,
        final_label VARCHAR(255),
        confidence DECIMAL(3,2),
        reward DECIMAL(8,2) NOT NULL DEFAULT 0,
        time_limit INTEGER,
        estimated_time INTEGER,
        metadata JSONB,
        is_honeypot BOOLEAN DEFAULT FALSE,
        expected_label VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        assigned_at TIMESTAMP WITH TIME ZONE,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE
      );

      -- Labels table
      CREATE TABLE IF NOT EXISTS labels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id),
        user_id UUID NOT NULL REFERENCES users(id),
        value TEXT NOT NULL,
        confidence DECIMAL(3,2),
        time_spent INTEGER,
        type VARCHAR(50) NOT NULL DEFAULT 'text',
        metadata JSONB,
        is_correct BOOLEAN,
        verified_at TIMESTAMP WITH TIME ZONE,
        verified_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(task_id, user_id)
      );

      -- Transactions table
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        amount DECIMAL(12,2) NOT NULL,
        fee DECIMAL(8,2) NOT NULL DEFAULT 0,
        method VARCHAR(20) NOT NULL,
        from_address VARCHAR(255),
        to_address VARCHAR(255),
        tx_hash VARCHAR(255) UNIQUE,
        block_number INTEGER,
        block_hash VARCHAR(255),
        gas_used INTEGER,
        gas_price BIGINT,
        confirmations INTEGER,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        failed_at TIMESTAMP WITH TIME ZONE,
        cancelled_at TIMESTAMP WITH TIME ZONE
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

      CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);

      CREATE INDEX IF NOT EXISTS idx_labels_task_id ON labels(task_id);
      CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(user_id);

      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
    `);

    console.log('✅ Test database schema created');
  } catch (error) {
    console.error('❌ Failed to create test schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clean all tables (truncate)
 */
export async function cleanDatabase(): Promise<void> {
  const pool = getTestDatabase();
  const client = await pool.connect();

  try {
    // Disable foreign key constraints temporarily
    await client.query('SET session_replication_role = replica;');

    // Truncate all tables in correct order
    const tables = [
      'labels',
      'transactions',
      'tasks',
      'projects',
      'users',
    ];

    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
    }

    // Re-enable foreign key constraints
    await client.query('SET session_replication_role = DEFAULT;');

    console.log('✅ Database cleaned');
  } catch (error) {
    console.error('❌ Failed to clean database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Insert test data
 */
export async function insertTestData(data: {
  users?: any[];
  projects?: any[];
  tasks?: any[];
  labels?: any[];
  transactions?: any[];
}): Promise<void> {
  const pool = getTestDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert users
    if (data.users?.length) {
      for (const user of data.users) {
        const fields = Object.keys(user).join(', ');
        const placeholders = Object.keys(user).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(user);

        await client.query(
          `INSERT INTO users (${fields}) VALUES (${placeholders}) ON CONFLICT (telegram_id) DO NOTHING`,
          values
        );
      }
    }

    // Insert projects
    if (data.projects?.length) {
      for (const project of data.projects) {
        const fields = Object.keys(project).join(', ');
        const placeholders = Object.keys(project).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(project);

        await client.query(
          `INSERT INTO projects (${fields}) VALUES (${placeholders})`,
          values
        );
      }
    }

    // Insert tasks
    if (data.tasks?.length) {
      for (const task of data.tasks) {
        const fields = Object.keys(task).join(', ');
        const placeholders = Object.keys(task).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(task);

        await client.query(
          `INSERT INTO tasks (${fields}) VALUES (${placeholders})`,
          values
        );
      }
    }

    // Insert labels
    if (data.labels?.length) {
      for (const label of data.labels) {
        const fields = Object.keys(label).join(', ');
        const placeholders = Object.keys(label).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(label);

        await client.query(
          `INSERT INTO labels (${fields}) VALUES (${placeholders}) ON CONFLICT (task_id, user_id) DO NOTHING`,
          values
        );
      }
    }

    // Insert transactions
    if (data.transactions?.length) {
      for (const transaction of data.transactions) {
        const fields = Object.keys(transaction).join(', ');
        const placeholders = Object.keys(transaction).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(transaction);

        await client.query(
          `INSERT INTO transactions (${fields}) VALUES (${placeholders})`,
          values
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ Test data inserted');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to insert test data:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close test database connection
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    console.log('✅ Test database connection closed');
  }
}

/**
 * Execute a query in a transaction
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getTestDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a single record
 */
export async function findOne<T>(
  table: string,
  where: Record<string, any>
): Promise<T | null> {
  const pool = getTestDatabase();
  const client = await pool.connect();

  try {
    const whereClause = Object.keys(where)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(' AND ');
    const values = Object.values(where);

    const result = await client.query(
      `SELECT * FROM ${table} WHERE ${whereClause}`,
      values
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Get multiple records
 */
export async function findMany<T>(
  table: string,
  where: Record<string, any> = {},
  options: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}
): Promise<T[]> {
  const pool = getTestDatabase();
  const client = await pool.connect();

  try {
    let query = `SELECT * FROM ${table}`;
    const values: any[] = [];
    let paramIndex = 1;

    if (Object.keys(where).length > 0) {
      const whereClause = Object.keys(where)
        .map((key) => `${key} = $${paramIndex++}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(where));
    }

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }

    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      values.push(options.offset);
    }

    const result = await client.query(query, values);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Count records
 */
export async function count(
  table: string,
  where: Record<string, any> = {}
): Promise<number> {
  const pool = getTestDatabase();
  const client = await pool.connect();

  try {
    let query = `SELECT COUNT(*) FROM ${table}`;
    const values: any[] = [];

    if (Object.keys(where).length > 0) {
      const whereClause = Object.keys(where)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(where));
    }

    const result = await client.query(query, values);
    return parseInt(result.rows[0].count);
  } finally {
    client.release();
  }
}