import { Request, Response } from 'express';
import { query } from '../../database/connection.js';
import { AuthenticatedRequest } from '../../middleware/apiAuth.js';
import { PaymentService } from '../../services/payments.js';
import { DatasetParser } from '../../services/datasetParser.js';

// Enterprise pricing: $0.04 per label (20% discount from $0.05)
const ENTERPRISE_COST_PER_LABEL = 0.04;
const ENTERPRISE_WORKER_EARNING = 0.02; // Workers still earn $0.02

interface CreateProjectRequest {
  name: string;
  description?: string;
  type: 'image' | 'text';
  categories: string[];
  config?: {
    instruction?: string;
    guidelines?: string[];
    required_accuracy?: number;
    quality_check?: boolean;
  };
  webhooks?: {
    task_completed?: string;
    project_completed?: string;
  };
}

interface BatchUploadRequest {
  data: Array<{
    id?: string;
    data: string | { [key: string]: any };
    label?: string;
  }>;
  format?: 'json' | 'csv' | 'txt';
}

export class ProjectsController {
  // POST /api/v1/projects
  static async createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        type,
        categories,
        config,
        webhooks
      }: CreateProjectRequest = req.body;

      // Validation
      if (!name || !type || !categories || categories.length < 2 || categories.length > 10) {
        res.status(400).json({
          error: 'Invalid request',
          details: {
            name: 'Required',
            type: 'Required (image or text)',
            categories: 'Required (2-10 categories)'
          }
        });
        return;
      }

      // Create project
      const projectResult = await query(
        `INSERT INTO projects (name, description, owner_id, type, status, config, webhooks, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          name,
          description || '',
          req.client!.id,
          type,
          'pending', // Pending data upload
          JSON.stringify(config || {}),
          JSON.stringify(webhooks || {})
        ]
      );

      const project = projectResult.rows[0];

      // Calculate price for enterprise
      const estimatedLabels = 1000; // Default estimate
      const totalPrice = estimatedLabels * ENTERPRISE_COST_PER_LABEL;

      res.status(201).json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          categories: categories,
          status: project.status,
          config: config || {},
          webhooks: webhooks || {},
          pricing: {
            cost_per_label: ENTERPRISE_COST_PER_LABEL,
            estimated_total: totalPrice,
            discount: '20%'
          },
          created_at: project.created_at
        },
        message: 'Project created successfully. Use /upload endpoint to add data.'
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'PROJECT_CREATION_FAILED'
      });
    }
  }

  // POST /api/v1/projects/:id/upload
  static async uploadData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id);
      const { data, format = 'json' }: BatchUploadRequest = req.body;

      if (!projectId || !data || !Array.isArray(data) || data.length === 0) {
        res.status(400).json({
          error: 'Invalid request',
          details: {
            project_id: 'Required',
            data: 'Required (array of objects)',
            format: 'Optional (json, csv, txt)'
          }
        });
        return;
      }

      // Verify project ownership
      const projectResult = await query(
        'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
        [projectId, req.client!.id]
      );

      if (projectResult.rows.length === 0) {
        res.status(404).json({
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
        return;
      }

      const project = projectResult.rows[0];

      // Calculate total cost
      const totalCost = data.length * ENTERPRISE_COST_PER_LABEL;

      // Check if client has sufficient balance
      const wallet = await PaymentService.getWallet(req.client!.id);
      if (wallet.balance < totalCost) {
        res.status(402).json({
          error: 'Insufficient balance',
          details: {
            required: totalCost,
            current_balance: wallet.balance,
            shortfall: totalCost - wallet.balance
          },
          code: 'INSUFFICIENT_BALANCE'
        });
        return;
      }

      // Deduct payment
      await PaymentService.updateWalletBalance(req.client!.id, totalCost, 'spend');
      await PaymentService.createTransaction(
        req.client!.id,
        'payment',
        totalCost,
        `API upload - ${data.length} labels for project ${projectId}`,
        { projectId, itemCount: data.length, source: 'api' },
        'system'
      );

      // Process and insert tasks
      const taskValues: any[] = [];

      data.forEach((item, index) => {
        const taskData = project.type === 'image'
          ? { image_url: typeof item.data === 'string' ? item.data : item.data.image_url, original_data: item }
          : { text: typeof item.data === 'string' ? item.data : item.data.text, original_data: item };

        taskValues.push([
          projectId,
          item.id || `item_${index + 1}`,
          `Label item ${index + 1}`,
          project.type,
          JSON.stringify(taskData),
          project.categories || [],
          1, // 1 point per task
          'pending'
        ]);
      });

      // Insert tasks in batch
      if (taskValues.length > 0) {
        await query(
          `INSERT INTO tasks (project_id, title, description, type, data, options, points, status)
           VALUES ${taskValues.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}`,
          taskValues.flat()
        );
      }

      // Update project status
      await query(
        `UPDATE projects
         SET status = 'active', updated_at = NOW()
         WHERE id = $1`,
        [projectId]
      );

      // Trigger webhook if configured
      if (project.webhooks) {
        const webhooks = JSON.parse(project.webhooks);
        if (webhooks.project_completed) {
          try {
            await fetch(webhooks.project_completed, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'project_completed',
                project_id: projectId,
                total_tasks: data.length,
                total_cost: totalCost
              })
            });
          } catch (webhookError) {
            console.error('Webhook error:', webhookError);
          }
        }
      }

      res.json({
        success: true,
        message: 'Data uploaded successfully',
        summary: {
          project_id: projectId,
          tasks_created: data.length,
          total_cost: totalCost,
          cost_per_label: ENTERPRISE_COST_PER_LABEL,
          status: 'active'
        }
      });
    } catch (error) {
      console.error('Error uploading data:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'UPLOAD_FAILED'
      });
    }
  }

  // GET /api/v1/projects/:id/status
  static async getProjectStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id);

      // Get project with task statistics
      const projectResult = await query(
        `SELECT p.*,
                COUNT(t.id) as total_tasks,
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
                COUNT(CASE WHEN r.id IS NOT NULL THEN 1 END) as responses_count,
                COALESCE(SUM(CASE WHEN r.is_correct = true THEN 1 END), 0) as correct_responses
         FROM projects p
         LEFT JOIN tasks t ON p.id = t.project_id
         LEFT JOIN responses r ON t.id = r.task_id
         WHERE p.id = $1
         GROUP BY p.id`,
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        res.status(404).json({
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
        return;
      }

      const project = projectResult.rows[0];
      const stats = {
        total_tasks: parseInt(project.total_tasks || 0),
        completed_tasks: parseInt(project.completed_tasks || 0),
        in_progress_tasks: parseInt(project.in_progress_tasks || 0),
        responses_count: parseInt(project.responses_count || 0),
        correct_responses: parseInt(project.correct_responses || 0),
        accuracy: project.responses_count > 0
          ? Math.round((project.correct_responses / project.responses_count) * 100)
          : 0,
        progress: project.total_tasks > 0
          ? Math.round((project.completed_tasks / project.total_tasks) * 100)
          : 0
      };

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          type: project.type,
          status: project.status,
          created_at: project.created_at,
          updated_at: project.updated_at
        },
        statistics: stats,
        pricing: {
          cost_per_label: ENTERPRISE_COST_PER_LABEL,
          total_paid: stats.total_tasks * ENTERPRISE_COST_PER_LABEL,
          potential_earnings: stats.total_tasks * ENTERPRISE_WORKER_EARNING
        }
      });
    } catch (error) {
      console.error('Error getting project status:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'STATUS_FETCH_FAILED'
      });
    }
  }

  // GET /api/v1/projects/:id/results
  static async getResults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id);
      const format = req.query.format as string || 'json';
      const include_metadata = req.query.include_metadata === 'true';
      const limit = parseInt(req.query.limit as string) || 10000;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      // Verify project ownership
      const projectResult = await query(
        'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
        [projectId, req.client!.id]
      );

      if (projectResult.rows.length === 0) {
        res.status(404).json({
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
        return;
      }

      const project = projectResult.rows[0];

      // Build query based on parameters
      let whereClause = 'WHERE t.project_id = $1';
      const queryParams: any[] = [projectId];

      if (status) {
        whereClause += ' AND t.status = $2';
        queryParams.push(status);
      }

      let results: any;

      if (format === 'json') {
        // Get results with responses
        const queryStr = `
          SELECT t.*,
                 r.answer as label,
                 r.is_correct as is_correct,
                 r.time_spent,
                 r.created_at as labeled_at,
                 u.first_name as worker_name,
                 r.user_id as worker_id
          FROM tasks t
          LEFT JOIN responses r ON t.id = r.task_id
          LEFT JOIN users u ON r.user_id = u.id
          ${whereClause}
          ORDER BY t.id
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const resultsData = await query(queryStr, [...queryParams, limit, offset]);

        results = resultsData.rows.map(row => ({
          id: row.id,
          title: row.title,
          data: JSON.parse(row.data),
          options: row.options,
          label: row.label,
          is_correct: row.is_correct,
          time_spent: row.time_spent,
          labeled_at: row.labeled_at,
          worker: {
            id: row.worker_id,
            name: row.worker_name
          },
          metadata: include_metadata ? JSON.parse(row.data) : undefined
        }));
      } else if (format === 'csv') {
        // CSV format
        const csvData = await query(`
          SELECT t.id, t.title, t.data,
                 COALESCE(r.answer, '') as label,
                 COALESCE(r.is_correct, false) as is_correct,
                 COALESCE(r.time_spent, 0) as time_spent
          FROM tasks t
          LEFT JOIN responses r ON t.id = r.task_id
          ${whereClause}
          ORDER BY t.id
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `, [...queryParams, limit, offset]);

        const headers = ['id', 'title', 'data', 'label', 'is_correct', 'time_spent'];
        const csvContent = [
          headers.join(','),
          ...csvData.rows.map(row => [
            row.id,
            `"${row.title}"`,
            `"${row.data}"`,
            row.label || '',
            row.is_correct,
            row.time_spent
          ])
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="project_${projectId}_results.csv"`);
        res.send(csvContent);
        return;
      } else {
        res.status(400).json({
          error: 'Unsupported format',
          code: 'UNSUPPORTED_FORMAT',
          supported: ['json', 'csv']
        });
        return;
      }

      // Get statistics
      const statsQuery = await query(
        `SELECT
          COUNT(*) as total_labels,
          COUNT(CASE WHEN r.id IS NOT NULL THEN 1 END) as labeled_count,
          COUNT(CASE WHEN r.is_correct = true THEN 1 END) as correct_count,
          AVG(CASE WHEN r.time_spent > 0 THEN r.time_spent END) as avg_time_spent
         FROM tasks t
         LEFT JOIN responses r ON t.id = r.task_id
         WHERE t.project_id = $1`,
        [projectId]
      );

      const stats = statsQuery.rows[0];

      res.json({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          type: project.type,
          categories: project.categories
        },
        format,
        pagination: {
          limit,
          offset,
          total: stats.total_labels,
          returned: results.length
        },
        statistics: {
          total_labels: parseInt(stats.total_labels || 0),
          labeled_count: parseInt(stats.labeled_count || 0),
          correct_count: parseInt(stats.correct_count || 0),
          accuracy: stats.labeled_count > 0
            ? Math.round((stats.correct_count / stats.labeled_count) * 100) / 100
            : 0,
          avg_time_spent: parseFloat(stats.avg_time_spent || 0)
        },
        results
      });
    } catch (error) {
      console.error('Error fetching results:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'RESULTS_FETCH_FAILED'
      });
    }
  }
}