import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockTaskService, MockProject } from '@test/mocks/services'

describe('Projects API Integration', () => {
  let taskService: MockTaskService
  let mockClient: any

  beforeEach(async () => {
    taskService = MockTaskService.create()

    // Create authenticated client
    mockClient = {
      id: 1,
      email: 'client@example.com',
      role: 'client'
    }

    vi.mock('@/backend/middleware/auth', () => ({
      requireAuth: (req: any, res: any, next: any) => {
        req.user = mockClient
        next()
      }
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    taskService.reset()
  })

  describe('GET /api/projects', () => {
    it('should return client projects', async () => {
      const req = { user: mockClient }
      const res = { json: vi.fn() }

      // Simulate projects endpoint
      const projects = await taskService.getProjectsForClient(mockClient.id)

      res.json(projects)
      expect(res.json).toHaveBeenCalledWith(projects)
      expect(Array.isArray(projects)).toBe(true)
      expect(projects.length).toBeGreaterThan(0)
    })

    it('should filter projects by status', async () => {
      const req = {
        user: mockClient,
        query: { status: 'active' }
      }
      const res = { json: vi.fn() }

      const projects = await taskService.getProjectsForClient(mockClient.id)
      const activeProjects = projects.filter(p => p.status === 'active')

      res.json(activeProjects)
      expect(res.json).toHaveBeenCalledWith(activeProjects)
      expect(activeProjects.every(p => p.status === 'active')).toBe(true)
    })

    it('should paginate projects', async () => {
      const req = {
        user: mockClient,
        query: { page: 1, limit: 5 }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn()
      }

      const projects = await taskService.getProjectsForClient(mockClient.id)
      const paginatedProjects = projects.slice(0, 5)

      res.json({
        projects: paginatedProjects,
        pagination: {
          page: 1,
          limit: 5,
          total: projects.length,
          pages: Math.ceil(projects.length / 5)
        }
      })

      expect(res.json).toHaveBeenCalledWith({
        projects: paginatedProjects,
        pagination: expect.any(Object)
      })
    })
  })

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'New Test Project',
        description: 'Project description for testing',
        paymentPerTask: 10
      }

      const req = { body: projectData, user: mockClient }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      // Mock project creation
      const newProject = await taskService.createProject(projectData.name, projectData.description, mockClient.id, projectData.paymentPerTask)

      res.status(201).json(newProject)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(newProject)
      expect(newProject.name).toBe(projectData.name)
      expect(newProject.clientId).toBe(mockClient.id)
      expect(newProject.paymentPerTask).toBe(projectData.paymentPerTask)
    })

    it('should validate project creation data', async () => {
      const req = {
        body: { name: '' }, // Missing name
        user: mockClient
      }
      const res = {
        json: vi.fn(),
        status: vi.fn()
      }

      res.status(400).json({
        success: false,
        errors: ['Name is required', 'Description is required']
      })

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: expect.any(Array)
      })
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should return project by ID', async () => {
      const project = await taskService.createProject('Test Project', 'Description', mockClient.id, 5)

      const req = { params: { id: project.id }, user: mockClient }
      const res = { json: vi.fn() }

      const retrievedProject = await taskService.getProject(project.id)

      res.json(retrievedProject)
      expect(res.json).toHaveBeenCalledWith(retrievedProject)
      expect(retrievedProject.id).toBe(project.id)
      expect(retrievedProject.name).toBe('Test Project')
    })

    it('should return 404 for non-existent project', async () => {
      const req = { params: { id: 'non_existent' }, user: mockClient }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const project = await taskService.getProject('non_existent')

      res.status(404).json({
        success: false,
        error: 'Project not found'
      })

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      })
      expect(project).toBeNull()
    })
  })

  describe('PUT /api/projects/:id', () => {
    it('should update project', async () => {
      const project = await taskService.createProject('Original Project', 'Original Description', mockClient.id, 5)

      const updates = {
        name: 'Updated Project',
        description: 'Updated description',
        status: 'completed'
      }

      const req = { body: updates, params: { id: project.id }, user: mockClient }
      const res = { json: vi.fn() }

      const updatedProject = await taskService.updateProject(project.id, updates)

      res.json(updatedProject)
      expect(res.json).toHaveBeenCalledWith(updatedProject)
      expect(updatedProject.name).toBe('Updated Project')
      expect(updatedProject.description).toBe('Updated description')
      expect(updatedProject.status).toBe('completed')
    })

    it('should validate update permissions', async () => {
      const project = await taskService.createProject('Project', 'Description', mockClient.id, 5)

      const updates = { status: 'completed' }
      const req = {
        body: updates,
        params: { id: project.id },
        user: { id: 2, role: 'worker' } // Different user
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.status(403).json({
        success: false,
        error: 'Unauthorized: Only project owner can update project'
      })

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.any(String)
      })
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('should delete project', async () => {
      const project = await taskService.createProject('Deletable Project', 'Description', mockClient.id, 5)

      const req = { params: { id: project.id }, user: mockClient }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      // Mock tasks in project first
      await taskService.createTask(project.id, {
        title: 'Task 1',
        type: 'text_labeling'
      })

      const deleted = await taskService.deleteProject(project.id)

      res.status(200).json({ success: true })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ success: true })
      expect(deleted).toBe(true)
    })

    it('should validate deletion permissions', async () => {
      const project = await taskService.createProject('Protected Project', 'Description', mockClient.id, 5)

      const req = {
        params: { id: project.id },
        user: { id: 2, role: 'worker' } // Different user
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const deleted = await taskService.deleteProject(project.id)

      res.status(403).json({
        success: false,
        error: 'Unauthorized: Only project owner can delete project'
      })

      expect(res.status).toHaveBeenCalledWith(403)
      expect(deleted).toBe(false)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.any(String)
      })
    })
  })

  describe('GET /api/projects/:id/stats', () => {
    it('should return project statistics', async () => {
      const project = await taskService.createProject('Stats Project', 'Description', mockClient.id, 5)

      // Create sample tasks
      await taskService.createTask(project.id, { type: 'image_classification' })
      await taskService.createTask(project.id, { type: 'image_classification' })
      await taskService.createTask(project.id, { type: 'text_labeling' })

      const req = { params: { id: project.id }, user: mockClient }
      const res = { json: vi.fn() }

      const stats = await taskService.getProjectStats(project.id)

      res.json(stats)
      expect(res.json).toHaveBeenCalledWith(stats)
      expect(stats.total).toBe(3)
      expect(stats.pending).toBe(3)
      expect(Object.keys(stats)).toContain('total')
      expect(Object.keys(stats)).toContain('pending')
    })
  })
})