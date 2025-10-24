import { postgresDb } from './database';

export interface Worker {
  id: string;
  name: string;
  email: string;
  tonAddress?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkerService {
  async createWorker(worker: Omit<Worker, 'id' | 'createdAt' | 'updatedAt'>): Promise<Worker> {
    const result = await postgresDb.query(
      `INSERT INTO workers (name, email, ton_address, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [worker.name, worker.email, worker.tonAddress, worker.isActive]
    );

    return this.mapRowToWorker(result.rows[0]);
  }

  async getWorkerById(id: string): Promise<Worker | null> {
    const result = await postgresDb.query(
      'SELECT * FROM workers WHERE id = $1',
      [id]
    );

    return result.rows[0] ? this.mapRowToWorker(result.rows[0]) : null;
  }

  async getWorkerByEmail(email: string): Promise<Worker | null> {
    const result = await postgresDb.query(
      'SELECT * FROM workers WHERE email = $1',
      [email]
    );

    return result.rows[0] ? this.mapRowToWorker(result.rows[0]) : null;
  }

  async updateWorker(id: string, updates: Partial<Worker>): Promise<Worker> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        setClause.push(`${this.camelToSnake(key)} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const result = await postgresDb.query(
      `UPDATE workers SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      throw new Error('Worker not found');
    }

    return this.mapRowToWorker(result.rows[0]);
  }

  async getAllWorkers(page = 1, limit = 20): Promise<{ workers: Worker[]; total: number }> {
    const offset = (page - 1) * limit;

    const [workersResult, countResult] = await Promise.all([
      postgresDb.query(
        'SELECT * FROM workers ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      postgresDb.query('SELECT COUNT(*) FROM workers')
    ]);

    return {
      workers: workersResult.rows.map(row => this.mapRowToWorker(row)),
      total: parseInt(countResult.rows[0].count)
    };
  }

  async deleteWorker(id: string): Promise<void> {
    const result = await postgresDb.query(
      'DELETE FROM workers WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new Error('Worker not found');
    }
  }

  private mapRowToWorker(row: any): Worker {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      tonAddress: row.ton_address,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export const workerService = new WorkerService();