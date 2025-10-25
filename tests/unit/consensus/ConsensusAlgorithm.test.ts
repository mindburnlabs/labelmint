// Consensus Algorithm Unit Tests
// ===============================
// Comprehensive tests for quality consensus system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsensusAlgorithm } from '@shared/consensus/src/ConsensusAlgorithm'
import { ConsensusStrategy } from '@shared/consensus/src/ConsensusStrategy'
import { MajorityVotingStrategy } from '@shared/consensus/src/strategies/MajorityVotingStrategy'
import { WeightedVotingStrategy } from '@shared/consensus/src/strategies/WeightedVotingStrategy'
import { createMockTask, createMockSubmission, createMockUser } from '@test/factories'

describe('ConsensusAlgorithm', () => {
  let consensusAlgorithm: ConsensusAlgorithm
  let mockDatabase: any

  beforeEach(() => {
    mockDatabase = {
      submission: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      consensusReview: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
    }

    consensusAlgorithm = new ConsensusAlgorithm({
      database: mockDatabase,
      strategies: [
        new MajorityVotingStrategy({ minVotes: 3, threshold: 0.7 }),
        new WeightedVotingStrategy({ minVotes: 3, weightByReputation: true }),
      ],
      defaultStrategy: 'majority-voting',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Task Submission Review', () => {
    it('should achieve consensus with majority voting', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({
          id: 'sub1',
          data: { labels: ['cat'] },
          userId: 'user1',
        }),
        createMockSubmission({
          id: 'sub2',
          data: { labels: ['cat'] },
          userId: 'user2',
        }),
        createMockSubmission({
          id: 'sub3',
          data: { labels: ['dog'] },
          userId: 'user3',
        }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
        createMockUser({ id: 'user3', reputation: 60 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(result.consensusReached).toBe(true)
      expect(result.consensusData.labels).toEqual(['cat'])
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.participatingUsers).toHaveLength(3)
    })

    it('should achieve consensus with weighted voting', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({
          id: 'sub1',
          data: { labels: ['cat'] },
          userId: 'user1', // High reputation
        }),
        createMockSubmission({
          id: 'sub2',
          data: { labels: ['dog'] },
          userId: 'user2', // Medium reputation
        }),
        createMockSubmission({
          id: 'sub3',
          data: { labels: ['dog'] },
          userId: 'user3', // Low reputation
        }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 95 }), // Very high weight
        createMockUser({ id: 'user2', reputation: 70 }),
        createMockUser({ id: 'user3', reputation: 50 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'weighted-voting')

      expect(result.consensusReached).toBe(true)
      // High reputation user should influence result despite being minority
      expect(result.consensusData.labels).toEqual(['cat'])
      expect(result.weightedScores).toBeDefined()
    })

    it('should fail to achieve consensus with insufficient votes', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({ id: 'sub1', data: { labels: ['cat'] }, userId: 'user1' }),
        createMockSubmission({ id: 'sub2', data: { labels: ['dog'] }, userId: 'user2' }),
        // Only 2 submissions, below minVotes: 3
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(result.consensusReached).toBe(false)
      expect(result.reason).toContain('Insufficient votes')
    })

    it('should handle edge case with perfect agreement', async () => {
      const task = createMockTask({ type: 'text_annotation' })
      const submissions = [
        createMockSubmission({ id: 'sub1', data: { text: 'positive' }, userId: 'user1' }),
        createMockSubmission({ id: 'sub2', data: { text: 'positive' }, userId: 'user2' }),
        createMockSubmission({ id: 'sub3', data: { text: 'positive' }, userId: 'user3' }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
        createMockUser({ id: 'user3', reputation: 70 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(result.consensusReached).toBe(true)
      expect(result.confidence).toBe(1.0)
      expect(result.consensusData.text).toBe('positive')
      expect(result.unanimous).toBe(true)
    })

    it('should handle multi-label classification', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({
          id: 'sub1',
          data: { labels: ['cat', 'animal'] },
          userId: 'user1',
        }),
        createMockSubmission({
          id: 'sub2',
          data: { labels: ['cat', 'pet'] },
          userId: 'user2',
        }),
        createMockSubmission({
          id: 'sub3',
          data: { labels: ['cat', 'animal'] },
          userId: 'user3',
        }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
        createMockUser({ id: 'user3', reputation: 70 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(result.consensusReached).toBe(true)
      expect(result.consensusData.labels).toContain('cat')
      expect(result.labelBreakdown).toBeDefined()
      expect(result.labelBreakdown.cat.votes).toBe(3)
    })
  })

  describe('User Reputation Management', () => {
    it('should update user reputation based on consensus accuracy', async () => {
      const user = createMockUser({ id: 'user1', reputation: 75 })
      const consensusResult = {
        consensusReached: true,
        consensusData: { labels: ['cat'] },
        participatingUsers: ['user1', 'user2', 'user3'],
        userAccuracies: { user1: 1.0, user2: 0.0, user3: 0.0 },
      }

      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockDatabase.user.update.mockResolvedValue({ ...user, reputation: 80 })

      const updatedReputation = await consensusAlgorithm.updateUserReputation(
        'user1',
        consensusResult
      )

      expect(updatedReputation).toBeGreaterThan(75)
      expect(mockDatabase.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: expect.objectContaining({
          reputation: expect.any(Number),
        }),
      })
    })

    it('should decrease reputation for consistently inaccurate submissions', async () => {
      const user = createMockUser({ id: 'user1', reputation: 60 })
      const consensusResult = {
        consensusReached: true,
        consensusData: { labels: ['cat'] },
        participatingUsers: ['user1', 'user2', 'user3'],
        userAccuracies: { user1: 0.0, user2: 1.0, user3: 1.0 },
      }

      mockDatabase.user.findUnique.mockResolvedValue(user)
      mockDatabase.user.update.mockResolvedValue({ ...user, reputation: 55 })

      const updatedReputation = await consensusAlgorithm.updateUserReputation(
        'user1',
        consensusResult
      )

      expect(updatedReputation).toBeLessThan(60)
    })

    it('should handle reputation bounds (min: 0, max: 100)', async () => {
      // Test upper bound
      const highReputationUser = createMockUser({ id: 'user1', reputation: 99 })
      mockDatabase.user.findUnique.mockResolvedValue(highReputationUser)
      mockDatabase.user.update.mockResolvedValue({ ...highReputationUser, reputation: 100 })

      const maxReputation = await consensusAlgorithm.updateUserReputation('user1', {
        consensusReached: true,
        userAccuracies: { user1: 1.0 },
      } as any)

      expect(maxReputation).toBeLessThanOrEqual(100)

      // Test lower bound
      const lowReputationUser = createMockUser({ id: 'user2', reputation: 1 })
      mockDatabase.user.findUnique.mockResolvedValue(lowReputationUser)
      mockDatabase.user.update.mockResolvedValue({ ...lowReputationUser, reputation: 0 })

      const minReputation = await consensusAlgorithm.updateUserReputation('user2', {
        consensusReached: true,
        userAccuracies: { user2: 0.0 },
      } as any)

      expect(minReputation).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Quality Metrics', () => {
    it('should calculate consensus quality metrics', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({
          id: 'sub1',
          data: { labels: ['cat'] },
          userId: 'user1',
          timeSpent: 120,
        }),
        createMockSubmission({
          id: 'sub2',
          data: { labels: ['cat'] },
          userId: 'user2',
          timeSpent: 95,
        }),
        createMockSubmission({
          id: 'sub3',
          data: { labels: ['dog'] },
          userId: 'user3',
          timeSpent: 30 }, // Suspiciously fast
        ),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
        createMockUser({ id: 'user3', reputation: 60 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(result.qualityMetrics).toBeDefined()
      expect(result.qualityMetrics.averageTimeSpent).toBeGreaterThan(0)
      expect(result.qualityMetrics.participationRate).toBe(1.0)
      expect(result.qualityMetrics.agreementLevel).toBeGreaterThan(0.5)
    })

    it('should flag suspicious submissions', async () => {
      const task = createMockTask({ type: 'text_annotation' })
      const suspiciousSubmission = createMockSubmission({
        id: 'sub1',
        data: { text: 'abc' }, // Too short, low effort
        userId: 'user1',
        timeSpent: 5, // Very fast
      })

      const normalSubmissions = [
        suspiciousSubmission,
        createMockSubmission({
          id: 'sub2',
          data: { text: 'This is a well-thought-out response.' },
          userId: 'user2',
          timeSpent: 120,
        }),
        createMockSubmission({
          id: 'sub3',
          data: { text: 'I think this is positive based on the context.' },
          userId: 'user3',
          timeSpent: 95,
        }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
        createMockUser({ id: 'user3', reputation: 70 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(normalSubmissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(result.flaggedSubmissions).toBeDefined()
      expect(result.flaggedSubmissions).toContain('sub1')
      expect(result.qualityMetrics.suspiciousActivityRate).toBeGreaterThan(0)
    })
  })

  describe('Dispute Resolution', () => {
    it('should handle disputed submissions with additional reviewers', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const originalSubmissions = [
        createMockSubmission({ id: 'sub1', data: { labels: ['cat'] }, userId: 'user1' }),
        createMockSubmission({ id: 'sub2', data: { labels: ['dog'] }, userId: 'user2' }),
        createMockSubmission({ id: 'sub3', data: { labels: ['bird'] }, userId: 'user3' }),
      ] // No consensus

      const reviewSubmissions = [
        createMockSubmission({ id: 'sub4', data: { labels: ['cat'] }, userId: 'reviewer1' }),
        createMockSubmission({ id: 'sub5', data: { labels: ['cat'] }, userId: 'reviewer2' }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
        createMockUser({ id: 'user3', reputation: 70 }),
        createMockUser({ id: 'reviewer1', reputation: 95 }),
        createMockUser({ id: 'reviewer2', reputation: 90 }),
      ]

      // Mock initial evaluation (no consensus)
      mockDatabase.submission.findMany
        .mockResolvedValueOnce(originalSubmissions)
        .mockResolvedValueOnce(reviewSubmissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const initialResult = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')
      expect(initialResult.consensusReached).toBe(false)

      // Mock additional reviews
      const finalResult = await consensusAlgorithm.resolveDispute(task.id, 'majority-voting')

      expect(finalResult.consensusReached).toBe(true)
      expect(finalResult.consensusData.labels).toEqual(['cat'])
      expect(finalResult.requiredAdditionalReviews).toBe(true)
    })

    it('should escalate unresolved disputes to admins', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({ id: 'sub1', data: { labels: ['cat'] }, userId: 'user1' }),
        createMockSubmission({ id: 'sub2', data: { labels: ['dog'] }, userId: 'user2' }),
        createMockSubmission({ id: 'sub3', data: { labels: ['bird'] }, userId: 'user3' }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
        createMockUser({ id: 'user3', reputation: 70 }),
      ]

      // Mock multiple rounds of reviews with no consensus
      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const result = await consensusAlgorithm.resolveDispute(task.id, 'majority-voting')

      expect(result.consensusReached).toBe(false)
      expect(result.escalated).toBe(true)
      expect(result.reason).toContain('Unable to achieve consensus')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large numbers of submissions efficiently', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissionCount = 100
      const submissions = Array.from({ length: submissionCount }, (_, i) =>
        createMockSubmission({
          id: `sub${i}`,
          data: { labels: i % 3 === 0 ? 'cat' : 'dog' },
          userId: `user${i}`,
        })
      )

      const users = Array.from({ length: submissionCount }, (_, i) =>
        createMockUser({
          id: `user${i}`,
          reputation: 50 + (i % 50),
        })
      )

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)

      const startTime = performance.now()
      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
      expect(result.consensusReached).toBe(true)
      expect(result.participatingUsers).toHaveLength(submissionCount)
    })

    it('should handle concurrent consensus evaluations', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask({ id: `task${i}`, type: 'image_classification' })
      )

      const submissions = tasks.map((task, taskIndex) =>
        Array.from({ length: 5 }, (_, i) =>
          createMockSubmission({
            id: `sub${taskIndex}-${i}`,
            data: { labels: taskIndex % 2 === 0 ? 'cat' : 'dog' },
            userId: `user${taskIndex}-${i}`,
          })
        )
      )

      const users = Array.from({ length: 50 }, (_, i) =>
        createMockUser({ id: `user${i}`, reputation: 50 + (i % 50) })
      )

      mockDatabase.submission.findMany.mockResolvedValue(submissions.flat())
      mockDatabase.user.findMany.mockResolvedValue(users)

      const concurrentEvaluations = tasks.map(task =>
        consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')
      )

      const results = await Promise.all(concurrentEvaluations)

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.consensusReached).toBe(true)
      })
    })
  })

  describe('Consensus Strategy Selection', () => {
    it('should select appropriate strategy based on task type', async () => {
      const imageTask = createMockTask({ type: 'image_classification' })
      const textTask = createMockTask({ type: 'text_annotation' })
      const audioTask = createMockTask({ type: 'audio_transcription' })

      expect(consensusAlgorithm.selectStrategy(imageTask)).toBe('majority-voting')
      expect(consensusAlgorithm.selectStrategy(textTask)).toBe('weighted-voting')
      expect(consensusAlgorithm.selectStrategy(audioTask)).toBe('majority-voting')
    })

    it('should fallback to default strategy for unknown task types', async () => {
      const unknownTask = createMockTask({ type: 'unknown_task_type' })

      const strategy = consensusAlgorithm.selectStrategy(unknownTask)
      expect(strategy).toBe('majority-voting') // Default strategy
    })
  })

  describe('Data Integrity and Validation', () => {
    it('should validate submission data structure', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const invalidSubmissions = [
        { id: 'sub1', data: null, userId: 'user1' }, // Missing data
        { id: 'sub2', data: { labels: [] }, userId: 'user2' }, // Empty labels
        { id: 'sub3', userId: 'user3' }, // No data property
      ]

      mockDatabase.submission.findMany.mockResolvedValue(invalidSubmissions)

      await expect(
        consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')
      ).rejects.toThrow('Invalid submission data')
    })

    it('should handle malformed user data gracefully', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({ id: 'sub1', data: { labels: ['cat'] }, userId: 'user1' }),
      ]

      const invalidUsers = [
        { id: 'user1' }, // Missing reputation
        { id: 'user2', reputation: 'invalid' }, // Invalid reputation type
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(invalidUsers)

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(result.consensusReached).toBe(false)
      expect(result.errors).toContain('Invalid user data')
    })
  })

  describe('Audit Trail and Logging', () => {
    it('should maintain audit trail for consensus decisions', async () => {
      const task = createMockTask({ type: 'image_classification' })
      const submissions = [
        createMockSubmission({ id: 'sub1', data: { labels: ['cat'] }, userId: 'user1' }),
        createMockSubmission({ id: 'sub2', data: { labels: ['cat'] }, userId: 'user2' }),
      ]

      const users = [
        createMockUser({ id: 'user1', reputation: 80 }),
        createMockUser({ id: 'user2', reputation: 75 }),
      ]

      mockDatabase.submission.findMany.mockResolvedValue(submissions)
      mockDatabase.user.findMany.mockResolvedValue(users)
      mockDatabase.consensusReview.create.mockResolvedValue({ id: 'review1' })

      const result = await consensusAlgorithm.evaluateSubmissions(task.id, 'majority-voting')

      expect(mockDatabase.consensusReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: task.id,
          consensusData: expect.any(Object),
          participatingUsers: expect.any(Array),
          metadata: expect.objectContaining({
            strategy: 'majority-voting',
            timestamp: expect.any(Date),
          }),
        })
      )
    })
  })
})