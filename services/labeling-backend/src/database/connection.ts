import { Pool, PoolClient } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'telegram_labeling',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function getDb(): Promise<PoolClient> {
  return pool.connect();
}

export async function query(text: string, params?: any[]): Promise<any> {
  const client = await getDb();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Redis connection
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD,
});

export async function initRedis(): Promise<void> {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected');
  } catch (error) {
    console.error('❌ Redis connection error:', error);
  }
}

export { redisClient };

// Database initialization with task distribution schema
export async function initDatabase(): Promise<void> {
  try {
    // Run migration if it exists
    try {
      const migrationPath = join(__dirname, '../../migrations/add_task_distribution.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      await query(migrationSQL);
      console.log('✅ Task distribution migration applied');
    } catch (err) {
      console.log('ℹ️ Migration already applied or not needed');
    }

    // Create base tables (simplified version for backend)
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'client',
        language_code VARCHAR(10),
        is_premium BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        trust_score DECIMAL(3,2) DEFAULT 1.00 CHECK (trust_score >= 0 AND trust_score <= 1),
        tasks_completed INTEGER DEFAULT 0,
        honeypot_failed INTEGER DEFAULT 0,
        total_earned DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        data JSONB NOT NULL,
        options TEXT[],
        correct_answer TEXT,
        points INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'pending',
        reserved_by INTEGER REFERENCES users(id),
        reserved_at TIMESTAMP WITH TIME ZONE,
        is_honeypot BOOLEAN DEFAULT FALSE,
        consensus_label TEXT,
        consensus_count INTEGER DEFAULT 0,
        completion_status VARCHAR(50) DEFAULT 'pending' CHECK (completion_status IN ('pending', 'in_progress', 'completed', 'review')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        answer TEXT NOT NULL,
        is_correct BOOLEAN,
        points INTEGER,
        time_spent INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS task_seen (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(task_id, worker_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        balance DECIMAL(10,2) DEFAULT 0.00,
        total_deposited DECIMAL(10,2) DEFAULT 0.00,
        total_spent DECIMAL(10,2) DEFAULT 0.00,
        total_earned DECIMAL(10,2) DEFAULT 0.00,
        total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
        frozen_balance DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_reserved_by ON tasks(reserved_by)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_reserved_at ON tasks(reserved_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_is_honeypot ON tasks(is_honeypot)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_completion_status ON tasks(completion_status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_responses_user_id ON responses(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_responses_task_id ON responses(task_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_seen_task_id ON task_seen(task_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_seen_worker_id ON task_seen(worker_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)`);

    // Create updated_at trigger function
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Apply triggers
    const tables = ['users', 'projects', 'tasks', 'wallets'];
    for (const table of tables) {
      await query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
      `);
    }

    // Create function to release expired reservations
    await query(`
      CREATE OR REPLACE FUNCTION release_expired_reservations()
      RETURNS void AS $$
      BEGIN
        UPDATE tasks
        SET reserved_by = NULL,
            reserved_at = NULL,
            completion_status = 'pending'
        WHERE reserved_at < NOW() - INTERVAL '30 seconds'
          AND completion_status = 'in_progress';
      END;
      $$ LANGUAGE plpgsql
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// Helper function to run database migrations
export async function runMigrations(): Promise<void> {
  try {
    // Release expired reservations
    await query('SELECT release_expired_reservations()');
  } catch (error) {
    console.error('Migration error:', error);
  }
}