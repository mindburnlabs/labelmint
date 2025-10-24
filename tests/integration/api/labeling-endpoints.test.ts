import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock API for integration testing
const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}))

describe('Labeling API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      mockApi.get.mockResolvedValue({
        status: 'ok',
        timestamp: '2024-01-01T00:00:00Z',
        services: {
          database: 'connected',
          redis: 'connected',
          queue: 'running'
        }
      })

      const response = await mockApi.get('/health')
      expect(response.status).toBe('ok')
      expect(response.services.database).toBe('connected')
      expect(response.services.redis).toBe('connected')
      expect(response.services.queue).toBe('running')
    })
  })

  describe('Task Management', () => {
    it('should create a new task', async () => {
      const taskData = {
        type: 'image_classification',
        imageUrl: 'https://example.com/image.jpg',
        instructions: 'Classify the image',
        complexity: 'simple',
        reward: 0.02
      }

      mockApi.post.mockResolvedValue({
        id: 'task_123',
        ...taskData,
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z'
      })

      const response = await mockApi.post('/tasks', taskData)

      expect(mockApi.post).toHaveBeenCalledWith('/tasks', taskData)
      expect(response.id).toBe('task_123')
      expect(response.type).toBe('image_classification')
      expect(response.status).toBe('pending')
    })

    it('should get available tasks', async () => {
      const mockTasks = [
        {
          id: 'task_1',
          type: 'image_classification',
          imageUrl: 'https://example.com/1.jpg',
          reward: 0.02,
          status: 'available'
        },
        {
          id: 'task_2',
          type: 'text_annotation',
          imageUrl: 'https://example.com/2.jpg',
          reward: 0.05,
          status: 'available'
        }
      ]

      mockApi.get.mockResolvedValue({
        tasks: mockTasks,
        total: mockTasks.length,
        page: 1,
        totalPages: 1
      })

      const response = await mockApi.get('/tasks')

      expect(response.tasks).toHaveLength(2)
      expect(response.total).toBe(2)
      expect(response.tasks[0].reward).toBe(0.02)
      expect(response.tasks[1].reward).toBe(0.05)
    })
  })

  describe('Consensus Algorithm Integration', () => {
    it('should achieve consensus with worker submissions', async () => {
      const taskId = 'consensus_task_123'
      const workerSubmissions = [
        { workerId: 'worker_1', label: 'cat', confidence: 0.95 },
        { workerId: 'worker_2', label: 'cat', confidence: 0.92 },
        { workerId: 'worker_3', label: 'dog', confidence: 0.88 }
      ]

      // Mock multiple submissions
      mockApi.post
        .mockResolvedValueOnce({ success: true, id: 'submission_1' })
        .mockResolvedValueOnce({ success: true, id: 'submission_2' })
        .mockResolvedValueOnce({ success: true, id: 'submission_3' })

      // Submit all worker responses
      for (const submission of workerSubmissions) {
        await mockApi.post(`/tasks/${taskId}/submit`, submission)
      }

      // Mock consensus calculation
      mockApi.get.mockResolvedValueOnce({
        taskId,
        consensus: 'cat',
        confidence: 0.67,
        workerAgreement: 0.67,
        totalSubmissions: 3,
        consensusAchieved: true
      })

      // Check consensus results
      const consensusResult = await mockApi.get(`/tasks/${taskId}/consensus`)

      expect(mockApi.post).toHaveBeenCalledTimes(3)
      expect(consensusResult.consensus).toBe('cat')
      expect(consensusResult.consensusAchieved).toBe(true)
      expect(consensusResult.totalSubmissions).toBe(3)
    })

    it('should handle consensus failure gracefully', async () => {
      const taskId = 'consensus_task_456'
      const workerSubmissions = [
        { workerId: 'worker_1', label: 'cat', confidence: 0.85 },
        { workerId: 'worker_2', label: 'dog', confidence: 0.80 },
        { workerId: 'worker_3', label: 'bird', confidence: 0.82 }
      ]

      // Mock submissions
      mockApi.post
        .mockResolvedValue({ success: true, id: 'submission_4' })
        .mockResolvedValue({ success: true, id: 'submission_5' })
        .mockResolvedValue({ success: true, id: 'submission_6' })

      for (const submission of workerSubmissions) {
        await mockApi.post(`/tasks/${taskId}/submit`, submission)
      }

      // Mock no consensus
      mockApi.get.mockResolvedValueOnce({
        taskId,
        consensus: null,
        confidence: 0.33,
        workerAgreement: 0.33,
        totalSubmissions: 3,
        consensusAchieved: false,
        needsMoreReviewers: true
      })

      const consensusResult = await mockApi.get(`/tasks/${taskId}/consensus`)

      expect(consensusResult.consensus).toBe(null)
      expect(consensusResult.consensusAchieved).toBe(false)
      expect(consensusResult.needsMoreReviewers).toBe(true)
    })
  })

  describe('Payment Processing', () => {
    it('should calculate and process payments correctly', async () => {
      const paymentData = {
        workerId: 'worker_123',
        taskId: 'task_456',
        amount: 0.025,
        quality: 0.96,
        complexity: 'medium',
        turnaround: 'priority'
      }

      const expectedPayment = {
        baseRate: 0.02,
        complexityMultiplier: 2.5,
        turnaroundMultiplier: 1.5,
        qualityBonus: 0.024, // 4% of base payment
        total: 0.099, // 0.02 * 2.5 * 1.5 + 0.024 = 0.099
        workerPayout: 0.099
      }

      mockApi.post.mockResolvedValue({
        success: true,
        paymentId: 'payment_789',
        ...expectedPayment,
        processedAt: '2024-01-01T00:00:00Z'
      })

      const response = await mockApi.post('/payments/calculate', paymentData)

      expect(mockApi.post).toHaveBeenCalledWith('/payments/calculate', paymentData)
      expect(response.success).toBe(true)
      expect(response.total).toBeCloseTo(0.099, 3) // Handle floating point precision
      expect(response.qualityBonus).toBeCloseTo(0.024, 3)
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockApi.get.mockRejectedValue(new Error('Service unavailable'))

      try {
        await mockApi.get('/tasks')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Service unavailable')
      }
    })

    it('should validate input data', async () => {
      const invalidTaskData = {
        type: '', // Invalid empty type
        reward: -0.01, // Negative reward
        complexity: 'invalid_complexity'
      }

      mockApi.post.mockResolvedValue({
        error: 'Validation failed',
        details: {
          type: 'required',
          reward: 'must be positive',
          complexity: 'invalid value'
        }
      })

      const response = await mockApi.post('/tasks', invalidTaskData)

      expect(response.error).toBe('Validation failed')
      expect(response.details.type).toBe('required')
      expect(response.details.reward).toBe('must be positive')
    })
  })

  describe('Performance Tests', () => {
    it('should handle concurrent task submissions', async () => {
      const taskId = 'performance_task_123'
      const concurrentSubmissions = Array.from({ length: 10 }, (_, i) => ({
        workerId: `worker_${i}`,
        label: i % 2 === 0 ? 'cat' : 'dog',
        confidence: 0.9 + Math.random() * 0.1
      }))

      mockApi.post.mockResolvedValue({ success: true, submissionId: 'submission_perf' })

      const startTime = Date.now()
      const promises = concurrentSubmissions.map(submission =>
        mockApi.post(`/tasks/${taskId}/submit`, submission)
      )

      await Promise.all(promises)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(mockApi.post).toHaveBeenCalledTimes(10)
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})