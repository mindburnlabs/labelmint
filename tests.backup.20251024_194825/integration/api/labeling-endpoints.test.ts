import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { testDb } from '../../test/setup';
import { createTestUser, createTestProject, createTestTask } from '../../test/fixtures/factories';
import { UserRole, TaskStatus } from '@prisma/client';

// Import the actual API routes
import { taskRoutes } from '../../../services/labeling-backend/src/routes/tasks';
import { projectRoutes } from '../../../services/labeling-backend/src/routes/projects';

// Mock external services
const server = setupServer(
  rest.post('https://api.telegram.org/bot:token/sendMessage', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: { message_id: 123 }
      })
    );
  })
);

describe('Labeling API Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let workerUser: any;
  let clientUser: any;

  beforeAll(async () => {
    // Start MSW server
    server.listen();

    // Create Express app
    app = express();
    app.use(express.json());

    // Add authentication middleware
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        req.user = { userId: parseInt(authHeader.split(' ')[1]) };
      }
      next();
    });

    // Mount routes
    app.use('/api/tasks', taskRoutes);
    app.use('/api/projects', projectRoutes);
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(async () => {
    // Clean database
    await testDb.task.deleteMany();
    await testDb.project.deleteMany();
    await testDb.user.deleteMany();

    // Create test users
    workerUser = await createTestUser({
      role: UserRole.WORKER,
      telegramId: 1001
    });

    clientUser = await createTestUser({
      role: UserRole.CLIENT,
      telegramId: 1002
    });

    authToken = `Bearer ${workerUser.id}`;
  });

  afterEach(async () => {
    await testDb.task.deleteMany();
    await testDb.project.deleteMany();
    await testDb.user.deleteMany();
  });

  describe('GET /api/tasks', () => {
    it('should return available tasks for authenticated worker', async () => {
      // Create some test tasks
      const project = await createTestProject(clientUser.id);
      await createTestTask(project.id, { status: TaskStatus.AVAILABLE });
      await createTestTask(project.id, { status: TaskStatus.AVAILABLE });
      await createTestTask(project.id, { status: TaskStatus.IN_PROGRESS });

      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(2);
      expect(response.body.data.tasks.every((t: any) => t.status === 'AVAILABLE')).toBe(true);
    });

    it('should paginate tasks correctly', async () => {
      const project = await createTestProject(clientUser.id);

      // Create 15 tasks
      for (let i = 0; i < 15; i++) {
        await createTestTask(project.id, { status: TaskStatus.AVAILABLE });
      }

      const response = await request(app)
        .get('/api/tasks?page=1&limit=10')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.tasks).toHaveLength(10);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.total).toBe(15);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });

    it('should filter tasks by category', async () => {
      const project = await createTestProject(clientUser.id);

      await createTestTask(project.id, {
        category: 'image_classification',
        status: TaskStatus.AVAILABLE
      });

      await createTestTask(project.id, {
        category: 'text_annotation',
        status: TaskStatus.AVAILABLE
      });

      const response = await request(app)
        .get('/api/tasks?category=image_classification')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].category).toBe('image_classification');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('POST /api/tasks/:taskId/assign', () => {
    it('should assign task to worker', async () => {
      const project = await createTestProject(clientUser.id);
      const task = await createTestTask(project.id, {
        status: TaskStatus.AVAILABLE
      });

      const response = await request(app)
        .post(`/api/tasks/${task.id}/assign`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.task.status).toBe(TaskStatus.IN_PROGRESS);
      expect(response.body.data.task.assignedWorkers).toContain(workerUser.id);
    });

    it('should not assign already assigned task', async () => {
      const otherWorker = await createTestUser({ role: UserRole.WORKER });
      const project = await createTestProject(clientUser.id);
      const task = await createTestTask(project.id, {
        status: TaskStatus.IN_PROGRESS,
        assignedWorkers: [otherWorker.id]
      });

      const response = await request(app)
        .post(`/api/tasks/${task.id}/assign`)
        .set('Authorization', authToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already assigned');
    });

    it('should not assign task to clients', async () => {
      const clientAuthToken = `Bearer ${clientUser.id}`;
      const project = await createTestProject(clientUser.id);
      const task = await createTestTask(project.id);

      const response = await request(app)
        .post(`/api/tasks/${task.id}/assign`)
        .set('Authorization', clientAuthToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Workers only');
    });
  });

  describe('POST /api/tasks/:taskId/submit', () => {
    beforeEach(async () => {
      const project = await createTestProject(clientUser.id);
      const task = await createTestTask(project.id, {
        status: TaskStatus.IN_PROGRESS,
        assignedWorkers: [workerUser.id]
      });
    });

    it('should submit labels for task', async () => {
      const task = await testDb.task.findFirst();

      const submission = {
        labels: ['cat', 'dog'],
        confidence: 95,
        timeSpent: 120
      };

      const response = await request(app)
        .post(`/api/tasks/${task.id}/submit`)
        .set('Authorization', authToken)
        .send(submission)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check label was created
      const label = await testDb.label.findFirst({
        where: {
          taskId: task.id,
          workerId: workerUser.id
        }
      });
      expect(label).toBeDefined();
      expect(label.labels).toEqual(['cat', 'dog']);
    });

    it('should validate label format', async () => {
      const task = await testDb.task.findFirst();

      const submission = {
        labels: 'invalid_format',
        confidence: 95
      };

      const response = await request(app)
        .post(`/api/tasks/${task.id}/submit`)
        .set('Authorization', authToken)
        .send(submission)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Labels must be an array');
    });

    it('should not submit labels for unassigned task', async () => {
      const otherTask = await createTestTask(1);

      const submission = {
        labels: ['cat'],
        confidence: 95
      };

      const response = await request(app)
        .post(`/api/tasks/${otherTask.id}/submit`)
        .set('Authorization', authToken)
        .send(submission)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/projects', () => {
    const clientAuthToken = `Bearer ${clientUser.id}`;

    it('should create new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for data labeling',
        instructions: 'Label the images correctly',
        categoryId: 1,
        budget: 1000.0,
        totalTasks: 100,
        tasksPerWorker: 5,
        consensusRequired: 3,
        paymentPerTask: 10.0,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['test', 'image-labeling'],
        difficulty: 'EASY'
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', clientAuthToken)
        .send(projectData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.project.name).toBe('Test Project');
      expect(response.body.data.project.clientId).toBe(clientUser.id);

      // Check project exists in database
      const dbProject = await testDb.project.findUnique({
        where: { id: response.body.data.project.id }
      });
      expect(dbProject).toBeDefined();
    });

    it('should validate project data', async () => {
      const invalidData = {
        name: '', // Empty name
        budget: -100 // Negative budget
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', clientAuthToken)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Project name is required');
      expect(response.body.errors).toContain('Budget must be positive');
    });

    it('should restrict project creation to clients', async () => {
      const projectData = {
        name: 'Test Project',
        budget: 1000.0,
        totalTasks: 100
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', authToken) // Worker token
        .send(projectData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Clients only');
    });
  });

  describe('GET /api/projects/:projectId', () => {
    it('should return project details', async () => {
      const project = await createTestProject(clientUser.id);

      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.project.id).toBe(project.id);
      expect(response.body.data.project.name).toBe(project.name);
    });

    it('should include project statistics', async () => {
      const project = await createTestProject(clientUser.id);

      // Create tasks for the project
      await createTestTask(project.id, { status: TaskStatus.COMPLETED });
      await createTestTask(project.id, { status: TaskStatus.COMPLETED });
      await createTestTask(project.id, { status: TaskStatus.AVAILABLE });

      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.totalTasks).toBe(3);
      expect(response.body.data.statistics.completedTasks).toBe(2);
      expect(response.body.data.statistics.availableTasks).toBe(1);
    });
  });

  describe('WebSocket Integration', () => {
    it('should notify workers of new tasks', async () => {
      const WebSocket = require('ws');
      const ws = new WebSocket('ws://localhost:3001');

      // Wait for connection
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Create project and task
      const project = await createTestProject(clientUser.id);
      await createTestTask(project.id);

      // Wait for WebSocket message
      const message = await new Promise(resolve => {
        ws.on('message', resolve);
      });

      const notification = JSON.parse(message);
      expect(notification.type).toBe('NEW_TASK');
      expect(notification.data.taskId).toBeDefined();

      ws.close();
    });

    it('should update task status in real-time', async () => {
      const WebSocket = require('ws');
      const ws1 = new WebSocket('ws://localhost:3001');
      const ws2 = new WebSocket('ws://localhost:3001');

      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      // Assign task to worker
      const project = await createTestProject(clientUser.id);
      const task = await createTestTask(project.id);

      await request(app)
        .post(`/api/tasks/${task.id}/assign`)
        .set('Authorization', authToken);

      // Both clients should receive update
      const messages = await Promise.all([
        new Promise(resolve => ws1.on('message', resolve)),
        new Promise(resolve => ws2.on('message', resolve))
      ]);

      messages.forEach(message => {
        const notification = JSON.parse(message);
        expect(notification.type).toBe('TASK_UPDATED');
        expect(notification.data.status).toBe(TaskStatus.IN_PROGRESS);
      });

      ws1.close();
      ws2.close();
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit task submissions', async () => {
      const project = await createTestProject(clientUser.id);
      const task = await createTestTask(project.id, {
        status: TaskStatus.IN_PROGRESS,
        assignedWorkers: [workerUser.id]
      });

      // Submit multiple labels quickly
      const submissions = Array(11).fill(null).map(() =>
        request(app)
          .post(`/api/tasks/${task.id}/submit`)
          .set('Authorization', authToken)
          .send({
            labels: ['test'],
            confidence: 95
          })
      );

      const responses = await Promise.all(submissions);

      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should allow reasonable submission rate', async () => {
      const project = await createTestProject(clientUser.id);

      const responses = [];
      for (let i = 0; i < 5; i++) {
        const task = await createTestTask(project.id, {
          status: TaskStatus.IN_PROGRESS,
          assignedWorkers: [workerUser.id]
        });

        const response = await request(app)
          .post(`/api/tasks/${task.id}/submit`)
          .set('Authorization', authToken)
          .send({
            labels: [`label-${i}`],
            confidence: 95
          });

        responses.push(response);

        // Small delay between submissions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});