import { vi } from 'vitest'

export interface MockTask {
  id: string
  projectId: string
  title: string
  description: string
  instructions: string
  type: string
  status: string
  priority: string
  assignedTo: number | null
  createdAt: Date
  updatedAt: Date
  deadline: Date | null
  metadata: Record<string, any>
  dataUrl?: string
  labelData?: any
}

export interface MockProject {
  id: string
  name: string
  description: string
  clientId: number
  status: string
  totalTasks: number
  completedTasks: number
  paymentPerTask: number
  createdAt: Date
  updatedAt: Date
}

export class MockTaskService {
  private tasks: Map<string, MockTask> = new Map()
  private projects: Map<string, MockProject> = new Map()
  private taskCounter = 1

  constructor() {
    this.initializeTestData()
  }

  private initializeTestData(): void {
    // Create sample projects
    const project1: MockProject = {
      id: 'proj_1',
      name: 'Image Classification Project',
      description: 'Classify images for AI training',
      clientId: 1,
      status: 'active',
      totalTasks: 100,
      completedTasks: 25,
      paymentPerTask: 5,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    }

    const project2: MockProject = {
      id: 'proj_2',
      name: 'Text Labeling Project',
      description: 'Label text sentiment analysis',
      clientId: 2,
      status: 'active',
      totalTasks: 50,
      completedTasks: 10,
      paymentPerTask: 3,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date()
    }

    this.projects.set(project1.id, project1)
    this.projects.set(project2.id, project2)

    // Create sample tasks
    this.createTaskForProject(project1.id, 'image_classification', 10)
    this.createTaskForProject(project1.id, 'image_classification', 15)
    this.createTaskForProject(project1.id, 'sentiment_analysis', 5)

    this.createTaskForProject(project2.id, 'text_labeling', 8)
    this.createTaskForProject(project2.id, 'text_labeling', 12)
  }

  private createTaskForProject(projectId: string, type: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const task: MockTask = {
        id: `task_${this.taskCounter++}`,
        projectId,
        title: `${type.replace('_', ' ')} task ${this.taskCounter}`,
        description: `Sample ${type} task for testing`,
        instructions: `Please complete the ${type} task carefully`,
        type,
        status: 'pending',
        priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
        assignedTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          difficulty: 'medium',
          estimatedTime: 300 // 5 minutes
        },
        dataUrl: type === 'image_classification' ? `https://example.com/image_${this.taskCounter}.jpg` : undefined
      }

      this.tasks.set(task.id, task)
    }
  }

  // Task CRUD operations
  async createTask(projectId: string, taskData: Partial<MockTask>): Promise<MockTask> {
    const task: MockTask = {
      id: `task_${this.taskCounter++}`,
      projectId,
      title: taskData.title || 'New Task',
      description: taskData.description || 'Task description',
      instructions: taskData.instructions || 'Complete this task',
      type: taskData.type || 'general',
      status: 'pending',
      priority: taskData.priority || 'medium',
      assignedTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deadline: taskData.deadline || null,
      metadata: taskData.metadata || {},
      dataUrl: taskData.dataUrl
    }

    this.tasks.set(task.id, task)
    return task
  }

  async getTask(taskId: string): Promise<MockTask | null> {
    return this.tasks.get(taskId) || null
  }

  async getTasksForProject(projectId: string): Promise<MockTask[]> {
    return Array.from(this.tasks.values()).filter(task => task.projectId === projectId)
  }

  async getTasksForUser(userId: number): Promise<MockTask[]> {
    return Array.from(this.tasks.values()).filter(task => task.assignedTo === userId)
  }

  async updateTask(taskId: string, updates: Partial<MockTask>): Promise<MockTask | null> {
    const task = this.tasks.get(taskId)
    if (!task) return null

    const updatedTask = { ...task, ...updates, updatedAt: new Date() }
    this.tasks.set(taskId, updatedTask)
    return updatedTask
  }

  async assignTask(taskId: string, userId: number): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'pending') return false

    task.assignedTo = userId
    task.status = 'assigned'
    task.updatedAt = new Date()

    this.tasks.set(taskId, task)
    return true
  }

  async completeTask(taskId: string, result: any): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'assigned') return false

    task.status = 'completed'
    task.labelData = result
    task.updatedAt = new Date()

    this.tasks.set(taskId, task)

    // Update project completion count
    const projectTasks = Array.from(this.tasks.values()).filter(t => t.projectId === task.projectId)
    const completedTasks = projectTasks.filter(t => t.status === 'completed')
    const project = this.projects.get(task.projectId)
    if (project) {
      project.completedTasks = completedTasks.length
      project.updatedAt = new Date()
      this.projects.set(task.projectId, project)
    }

    return true
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const deleted = this.tasks.delete(taskId)
    if (deleted) {
      // Update project task count
      const task = this.tasks.get(taskId)
      if (task) {
        const project = this.projects.get(task.projectId)
        if (project && project.totalTasks > 0) {
          project.totalTasks--
          project.updatedAt = new Date()
          this.projects.set(task.projectId, project)
        }
      }
    }
    return deleted
  }

  // Project operations
  async getProject(projectId: string): Promise<MockProject | null> {
    return this.projects.get(projectId) || null
  }

  async getProjectsForClient(clientId: number): Promise<MockProject[]> {
    return Array.from(this.projects.values()).filter(project => project.clientId === clientId)
  }

  async getProjectStats(projectId: string): Promise<any> {
    const tasks = Array.from(this.tasks.values()).filter(task => task.projectId === projectId)
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      expired: tasks.filter(t => t.status === 'expired').length
    }
    return stats
  }

  // Project CRUD operations
  async createProject(name: string, description: string, clientId: number, paymentPerTask: number): Promise<MockProject> {
    const project: MockProject = {
      id: `proj_${this.taskCounter++}`,
      name,
      description,
      clientId,
      status: 'active',
      totalTasks: 0,
      completedTasks: 0,
      paymentPerTask,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.projects.set(project.id, project)
    return project
  }

  async updateProject(projectId: string, updates: Partial<MockProject>): Promise<MockProject | null> {
    const project = this.projects.get(projectId)
    if (!project) return null

    const updatedProject = { ...project, ...updates, updatedAt: new Date() }
    this.projects.set(projectId, updatedProject)
    return updatedProject
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const project = this.projects.get(projectId)
    if (!project) return false

    // Delete associated tasks
    const projectTasks = Array.from(this.tasks.values()).filter(task => task.projectId === projectId)
    projectTasks.forEach(task => this.tasks.delete(task.id))

    this.projects.delete(projectId)
    return true
  }

  // Search and filtering
  async searchTasks(query: string, filters: any = {}): Promise<MockTask[]> {
    let tasks = Array.from(this.tasks.values())

    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase()
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(lowerQuery) ||
        task.description.toLowerCase().includes(lowerQuery)
      )
    }

    // Apply filters
    if (filters.status) {
      tasks = tasks.filter(task => task.status === filters.status)
    }
    if (filters.type) {
      tasks = tasks.filter(task => task.type === filters.type)
    }
    if (filters.priority) {
      tasks = tasks.filter(task => task.priority === filters.priority)
    }

    return tasks
  }

  // Test helpers
  static create(): MockTaskService {
    return new MockTaskService()
  }

  reset(): void {
    this.tasks.clear()
    this.projects.clear()
    this.taskCounter = 1
    this.initializeTestData()
  }

  // Test data setup
  setupTestData(projects: MockProject[], tasks: MockTask[]): void {
    this.projects.clear()
    this.tasks.clear()

    projects.forEach(project => this.projects.set(project.id, project))
    tasks.forEach(task => this.tasks.set(task.id, task))
  }
}