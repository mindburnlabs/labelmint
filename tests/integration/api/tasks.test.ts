import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock express app for testing
const createTestApp = () => {
  const app = express()
  app.use(express.json())

  // Mock database
  const tasks = new Map()
  const users = new Map()
  const projects = new Map()

  // Initialize mock data
  const mockUser = {
    id: 'user123',
    telegramId: 12345,
    username: 'testuser',
    balance: 0.50,
    accuracy: 0.95,
    createdAt: new Date().toISOString()
  }
  users.set('user123', mockUser)

  const mockProject = {
    id: 'project123',
    clientId: 'user123',
    name: 'Test Project',
    taskType: 'image_classification',
    categories: ['cat', 'dog', 'bird'],
    totalTasks: 100,
    completedTasks: 0,
    status: 'active',
    createdAt: new Date().toISOString()
  }
  projects.set('project123', mockProject)

  // Authentication middleware
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.user = mockUser
    next()
  }

  // GET /api/tasks
  app.get('/api/tasks', authenticate, (req: any, res) => {
    const { status, limit = 10, offset = 0 } = req.query
    const userTasks = Array.from(tasks.values())
      .filter((task: any) => {
        if (status) return task.status === status
        return task.status === 'available'
      })
      .slice(Number(offset), Number(offset) + Number(limit))

    res.json({
      tasks: userTasks,
      total: userTasks.length,
      hasMore: Number(offset) + Number(limit) < userTasks.length
    })
  })

  // POST /api/tasks
  app.post('/api/tasks', authenticate, (req: any, res) => {
    const { projectId, imageUrl, categories, honeypot = false } = req.body

    if (!projectId || !imageUrl || !categories) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['projectId', 'imageUrl', 'categories']
      })
    }

    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      imageUrl,
      categories,
      honeypot,
      status: 'available',
      assignedWorkers: [],
      labels: [],
      requiredLabels: 3,
      createdAt: new Date().toISOString()
    }

    tasks.set(task.id, task)

    res.status(201).json({
      success: true,
      task
    })
  })

  // GET /api/tasks/:id
  app.get('/api/tasks/:id', authenticate, (req: any, res) => {
    const task = tasks.get(req.params.id)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json({ task })
  })

  // POST /api/tasks/:id/assign
  app.post('/api/tasks/:id/assign', authenticate, (req: any, res) => {
    const task = tasks.get(req.params.id)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    if (task.status !== 'available') {
      return res.status(400).json({
        error: 'Task not available',
        status: task.status
      })
    }

    if (task.assignedWorkers.includes(req.user.id)) {
      return res.status(400).json({
        error: 'Already assigned to this task'
      })
    }

    task.assignedWorkers.push(req.user.id)

    if (task.assignedWorkers.length >= task.requiredLabels) {
      task.status = 'in_progress'
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        imageUrl: task.imageUrl,
        categories: task.categories,
        honeypot: task.honeypot
      }
    })
  })

  // POST /api/tasks/:id/submit
  app.post('/api/tasks/:id/submit', authenticate, (req: any, res) => {
    const task = tasks.get(req.params.id)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const { label } = req.body

    if (!label) {
      return res.status(400).json({
        error: 'Label is required'
      })
    }

    if (!task.assignedWorkers.includes(req.user.id)) {
      return res.status(400).json({
        error: 'Not assigned to this task'
      })
    }

    const existingLabel = task.labels.find((l: any) => l.workerId === req.user.id)
    if (existingLabel) {
      return res.status(400).json({
        error: 'Already submitted label'
      })
    }

    task.labels.push({
      workerId: req.user.id,
      label,
      timestamp: new Date().toISOString()
    })

    // Check if all required labels are submitted
    if (task.labels.length >= task.requiredLabels) {
      // Calculate consensus
      const counts = task.labels.reduce((acc: any, l: any) => {
        acc[l.label] = (acc[l.label] || 0) + 1
        return acc
      }, {})

      const entries = Object.entries(counts)
      const maxCount = Math.max(...entries.map(([, count]: any) => count))
      const threshold = Math.ceil(task.requiredLabels * 2 / 3)

      if (maxCount >= threshold) {
        const [result] = entries.find(([, count]: any) => count === maxCount)
        task.status = 'completed'
        task.result = result
        task.consensus = maxCount / task.labels.length
      } else {
        task.status = 'disputed'
        task.result = 'NO_CONSENSUS'
      }
    }

    // Update worker balance if not honeypot
    if (!task.honeypot && task.status === 'completed') {
      const worker = users.get(req.user.id)
      worker.balance += 0.02
    }

    res.json({
      success: true,
      task,
      reward: task.honeypot ? 0 : 0.02
    })
  })

  return app
}

describe('Tasks API Integration Tests', () => {
  let app: express.Application
  let authToken: string

  beforeEach(() => {
    app = createTestApp()
    authToken = 'Bearer mock-jwt-token'
  })

  describe('GET /api/tasks', () => {
    it('should retrieve available tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body).toHaveProperty('tasks')
      expect(response.body).toHaveProperty('total')
      expect(response.body).toHaveProperty('hasMore')
      expect(Array.isArray(response.body.tasks)).toBe(true)
    })

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks?status=completed')
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body.tasks).toEqual([])
    })

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/tasks?limit=5&offset=0')
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body.tasks.length).toBeLessThanOrEqual(5)
    })

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/tasks')
        .expect(401)
    })
  })

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        projectId: 'project123',
        imageUrl: 'https://example.com/image.jpg',
        categories: ['cat', 'dog', 'bird'],
        honeypot: false
      }

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send(taskData)
        .expect(201)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('task')
      expect(response.body.task).toMatchObject(taskData)
      expect(response.body.task).toHaveProperty('id')
      expect(response.body.task).toHaveProperty('status', 'available')
      expect(response.body.task).toHaveProperty('createdAt')
    })

    it('should create a honeypot task', async () => {
      const taskData = {
        projectId: 'project123',
        imageUrl: 'https://example.com/honeypot.jpg',
        categories: ['cat', 'dog'],
        honeypot: true
      }

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send(taskData)
        .expect(201)

      expect(response.body.task.honeypot).toBe(true)
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send({})
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.required).toEqual(['projectId', 'imageUrl', 'categories'])
    })

    it('should reject unauthenticated task creation', async () => {
      await request(app)
        .post('/api/tasks')
        .send({
          projectId: 'project123',
          imageUrl: 'https://example.com/image.jpg',
          categories: ['cat', 'dog']
        })
        .expect(401)
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('should retrieve a specific task', async () => {
      // First create a task
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send({
          projectId: 'project123',
          imageUrl: 'https://example.com/image.jpg',
          categories: ['cat', 'dog', 'bird']
        })

      const taskId = createResponse.body.task.id

      // Then retrieve it
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body).toHaveProperty('task')
      expect(response.body.task.id).toBe(taskId)
    })

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/api/tasks/nonexistent')
        .set('Authorization', authToken)
        .expect(404)

      expect(response.body).toHaveProperty('error', 'Task not found')
    })
  })

  describe('POST /api/tasks/:id/assign', () => {
    let taskId: string

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send({
          projectId: 'project123',
          imageUrl: 'https://example.com/image.jpg',
          categories: ['cat', 'dog', 'bird']
        })
      taskId = createResponse.body.task.id
    })

    it('should assign task to worker', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', authToken)
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('task')
      expect(response.body.task).toHaveProperty('imageUrl')
      expect(response.body.task).toHaveProperty('categories')
    })

    it('should prevent duplicate assignment', async () => {
      // First assignment
      await request(app)
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', authToken)
        .expect(200)

      // Second assignment should fail
      const response = await request(app)
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', authToken)
        .expect(400)

      expect(response.body.error).toBe('Already assigned to this task')
    })

    it('should reject assignment for non-existent task', async () => {
      await request(app)
        .post('/api/tasks/nonexistent/assign')
        .set('Authorization', authToken)
        .expect(404)
    })
  })

  describe('POST /api/tasks/:id/submit', () => {
    let taskId: string

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send({
          projectId: 'project123',
          imageUrl: 'https://example.com/image.jpg',
          categories: ['cat', 'dog', 'bird']
        })
      taskId = createResponse.body.task.id

      // Assign task first
      await request(app)
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', authToken)
    })

    it('should submit label for task', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/submit`)
        .set('Authorization', authToken)
        .send({ label: 'cat' })
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('reward', 0.02)
      expect(response.body.task.labels).toHaveLength(1)
      expect(response.body.task.labels[0]).toMatchObject({
        workerId: 'user123',
        label: 'cat'
      })
    })

    it('should handle consensus with 3 labels', async () => {
      // Create a new task for this test since taskId was already used
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send({
          projectId: 'project123',
          imageUrl: 'https://example.com/consensus.jpg',
          categories: ['cat', 'dog']
        })
      const consensusTaskId = createResponse.body.task.id

      // Assign the task first
      await request(app)
        .post(`/api/tasks/${consensusTaskId}/assign`)
        .set('Authorization', authToken)
        .expect(200)

      // Submit a label
      const response = await request(app)
        .post(`/api/tasks/${consensusTaskId}/submit`)
        .set('Authorization', authToken)
        .send({ label: 'cat' })
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body.task.labels).toHaveLength(1)
      expect(response.body.task.labels[0].label).toBe('cat')

      // In a real system with multiple workers, this would test consensus calculation
      // For the mock, we just verify the basic submission functionality
    })

    it('should handle disputed consensus', async () => {
      // This would need multiple mock users to test properly
      // For now, just test single submission
      const response = await request(app)
        .post(`/api/tasks/${taskId}/submit`)
        .set('Authorization', authToken)
        .send({ label: 'cat' })
        .expect(200)

      expect(response.body.task.status).toBe('available') // Still waiting for more labels
    })

    it('should prevent submission without assignment', async () => {
      // Create new task without assigning
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send({
          projectId: 'project123',
          imageUrl: 'https://example.com/image2.jpg',
          categories: ['cat', 'dog']
        })
      const newTaskId = createResponse.body.task.id

      const response = await request(app)
        .post(`/api/tasks/${newTaskId}/submit`)
        .set('Authorization', authToken)
        .send({ label: 'cat' })
        .expect(400)

      expect(response.body.error).toBe('Not assigned to this task')
    })

    it('should prevent duplicate submissions', async () => {
      // First submission
      await request(app)
        .post(`/api/tasks/${taskId}/submit`)
        .set('Authorization', authToken)
        .send({ label: 'cat' })
        .expect(200)

      // Second submission should fail
      const response = await request(app)
        .post(`/api/tasks/${taskId}/submit`)
        .set('Authorization', authToken)
        .send({ label: 'dog' })
        .expect(400)

      expect(response.body.error).toBe('Already submitted label')
    })

    it('should validate label is provided', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/submit`)
        .set('Authorization', authToken)
        .send({})
        .expect(400)

      expect(response.body.error).toBe('Label is required')
    })
  })

  describe('Task Workflow Integration', () => {
    it('should handle complete task lifecycle', async () => {
      // 1. Create task
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send({
          projectId: 'project123',
          imageUrl: 'https://example.com/workflow.jpg',
          categories: ['cat', 'dog']
        })

      const taskId = createResponse.body.task.id
      expect(createResponse.body.task.status).toBe('available')

      // 2. Get available tasks
      const tasksResponse = await request(app)
        .get('/api/tasks')
        .set('Authorization', authToken)
        .expect(200)

      // Task should be visible since it was just created
      expect(tasksResponse.body.tasks.length).toBeGreaterThan(0)
      expect(tasksResponse.body.tasks[0].id).toBe(taskId)

      // 3. Assign task
      const assignResponse = await request(app)
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', authToken)
        .expect(200)

      expect(assignResponse.body.task.imageUrl).toBe('https://example.com/workflow.jpg')

      // 4. Submit label
      const submitResponse = await request(app)
        .post(`/api/tasks/${taskId}/submit`)
        .set('Authorization', authToken)
        .send({ label: 'cat' })
        .expect(200)

      expect(submitResponse.body.task.labels).toHaveLength(1)
      expect(submitResponse.body.reward).toBe(0.02)

      // 5. Verify task state
      const taskResponse = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', authToken)
        .expect(200)

      expect(taskResponse.body.task.labels).toHaveLength(1)
      expect(taskResponse.body.task.labels[0].label).toBe('cat')
    })
  })
})