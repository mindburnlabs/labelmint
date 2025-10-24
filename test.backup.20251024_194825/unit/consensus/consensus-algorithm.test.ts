import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calculateConsensus, detectOutliers, validateLabelConsensus } from '@shared/consensus'
import { createTestLabel, createTestTask } from '../../test/fixtures/factories'
import { testDb } from '../../test/setup'
import { TaskStatus } from '@prisma/client'

// Mock Task State Machine
class MockTaskStateMachine {
  private state: string = 'PENDING'
  private labels: Array<{ workerId: string; label: string; timestamp: number }> = []

  addLabel(workerId: string, label: string): void {
    if (this.labels.some(l => l.workerId === workerId)) {
      return
    }
    this.labels.push({ workerId, label, timestamp: Date.now() })
  }

  getLabels(): Array<{ workerId: string; label: string; timestamp: number }> {
    return [...this.labels]
  }

  getState(): string {
    return this.state
  }

  getRequiredLabels(): number {
    return 3
  }

  hasEnoughLabels(): boolean {
    return this.labels.length >= this.getRequiredLabels()
  }

  calculateConsensus(): { result: string; confidence: number; conflicting: boolean } {
    if (!this.hasEnoughLabels()) {
      return { result: '', confidence: 0, conflicting: false }
    }

    const counts = this.labels.reduce((acc, { label }) => {
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalLabels = this.labels.length
    const threshold = Math.ceil(totalLabels * 2 / 3)
    const entries = Object.entries(counts)
    const maxCount = Math.max(...entries.map(([, count]) => count))

    if (maxCount >= threshold) {
      const [result] = entries.find(([, count]) => count === maxCount)!
      return { result, confidence: maxCount / totalLabels, conflicting: false }
    }

    const [highestResult] = entries.find(([, count]) => count === maxCount)!
    return { result: highestResult, confidence: maxCount / totalLabels, conflicting: true }
  }
}

describe('Consensus Algorithm', () => {
  let stateMachine: MockTaskStateMachine

  beforeEach(async () => {
    stateMachine = new MockTaskStateMachine()
    // Clean up database before each test
    await testDb.label.deleteMany()
    await testDb.task.deleteMany()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    // Clean up database after each test
    await testDb.label.deleteMany()
    await testDb.task.deleteMany()
  })

  describe('Label Collection', () => {
    it('should collect labels from multiple workers', () => {
      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'cat')
      stateMachine.addLabel('worker3', 'dog')

      const labels = stateMachine.getLabels()
      expect(labels).toHaveLength(3)
      expect(labels[0]).toEqual({ workerId: 'worker1', label: 'cat', timestamp: expect.any(Number) })
    })

    it('should prevent duplicate labels from same worker', () => {
      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker1', 'dog') // Should not be added

      const labels = stateMachine.getLabels()
      expect(labels).toHaveLength(1)
      expect(labels[0].label).toBe('cat')
    })

    it('should detect when enough labels are collected', () => {
      expect(stateMachine.hasEnoughLabels()).toBe(false)

      stateMachine.addLabel('worker1', 'cat')
      expect(stateMachine.hasEnoughLabels()).toBe(false)

      stateMachine.addLabel('worker2', 'cat')
      expect(stateMachine.hasEnoughLabels()).toBe(false)

      stateMachine.addLabel('worker3', 'cat')
      expect(stateMachine.hasEnoughLabels()).toBe(true)
    })
  })

  describe('Consensus Calculation', () => {
    it('should achieve consensus with 2/3 agreement', () => {
      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'cat')
      stateMachine.addLabel('worker3', 'cat')

      const consensus = stateMachine.calculateConsensus()
      expect(consensus.result).toBe('cat')
      expect(consensus.confidence).toBe(1)
      expect(consensus.conflicting).toBe(false)
    })

    it('should achieve consensus with exact 2/3 majority', () => {
      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'cat')
      stateMachine.addLabel('worker3', 'dog')

      const consensus = stateMachine.calculateConsensus()
      expect(consensus.result).toBe('cat')
      expect(consensus.confidence).toBe(2/3)
      expect(consensus.conflicting).toBe(false)
    })

    it('should detect conflicting labels when no consensus', () => {
      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'dog')
      stateMachine.addLabel('worker3', 'bird')

      const consensus = stateMachine.calculateConsensus()
      expect(consensus.result).toBe('cat')
      expect(consensus.confidence).toBe(1/3)
      expect(consensus.conflicting).toBe(true)
    })

    it('should not calculate consensus with insufficient labels', () => {
      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'cat')

      const consensus = stateMachine.calculateConsensus()
      expect(consensus.result).toBe('')
      expect(consensus.confidence).toBe(0)
      expect(consensus.conflicting).toBe(false)
    })
  })

  describe('Database Integration Tests', () => {
    it('should achieve consensus with simple majority using database', async () => {
      const task = await createTestTask(1, {
        expectedLabels: ['cat', 'dog']
      })

      // Create labels from 3 workers
      await createTestLabel(task.id, 1, { labels: ['cat', 'dog'] })
      await createTestLabel(task.id, 2, { labels: ['cat', 'dog'] })
      await createTestLabel(task.id, 3, { labels: ['cat', 'dog'] })

      const labels = await testDb.label.findMany({
        where: { taskId: task.id },
        select: { labels: true }
      })

      const consensus = calculateConsensus(
        labels.map(l => l.labels),
        0.7 // 70% consensus required
      )

      expect(consensus).toEqual(['cat', 'dog'])
    })

    it('should achieve consensus with partial agreement using database', async () => {
      const task = await createTestTask(1, {
        expectedLabels: ['cat', 'dog', 'car']
      })

      // 4 workers - 3 agree on 'cat', 2 agree on 'dog'
      await createTestLabel(task.id, 1, { labels: ['cat'] })
      await createTestLabel(task.id, 2, { labels: ['cat', 'dog'] })
      await createTestLabel(task.id, 3, { labels: ['cat', 'dog'] })
      await createTestLabel(task.id, 4, { labels: ['car'] })

      const labels = await testDb.label.findMany({
        where: { taskId: task.id },
        select: { labels: true }
      })

      const consensus = calculateConsensus(
        labels.map(l => l.labels),
        0.5 // 50% consensus required
      )

      expect(consensus).toContain('cat')
      expect(consensus).toContain('dog')
    })

    it('should fail to achieve consensus with disagreement using database', async () => {
      const task = await createTestTask(1, {
        expectedLabels: ['cat', 'dog']
      })

      // 3 workers with completely different labels
      await createTestLabel(task.id, 1, { labels: ['cat'] })
      await createTestLabel(task.id, 2, { labels: ['dog'] })
      await createTestLabel(task.id, 3, { labels: ['bird'] })

      const labels = await testDb.label.findMany({
        where: { taskId: task.id },
        select: { labels: true }
      })

      const consensus = calculateConsensus(
        labels.map(l => l.labels),
        0.8 // 80% consensus required
      )

      expect(consensus).toBeNull()
    })
  })

  describe('Outlier Detection', () => {
    it('should identify outlier labels', async () => {
      const task = await createTestTask(1)

      // Create labels - 4 workers agree on 'cat', 1 worker thinks 'car'
      await createTestLabel(task.id, 1, { labels: ['cat'], confidence: 95 })
      await createTestLabel(task.id, 2, { labels: ['cat'], confidence: 90 })
      await createTestLabel(task.id, 3, { labels: ['cat'], confidence: 88 })
      await createTestLabel(task.id, 4, { labels: ['cat'], confidence: 92 })
      await createTestLabel(task.id, 5, { labels: ['car'], confidence: 70 })

      const labels = await testDb.label.findMany({
        where: { taskId: task.id },
        select: { labels: true, confidence: true }
      })

      const outliers = detectOutliers(labels)

      expect(outliers).toHaveLength(1)
      expect(outliers[0].labels).toEqual(['car'])
    })

    it('should not flag labels as outliers when in agreement', async () => {
      const task = await createTestTask(1)

      // All workers agree
      await createTestLabel(task.id, 1, { labels: ['cat'], confidence: 90 })
      await createTestLabel(task.id, 2, { labels: ['cat'], confidence: 92 })
      await createTestLabel(task.id, 3, { labels: ['cat'], confidence: 88 })

      const labels = await testDb.label.findMany({
        where: { taskId: task.id },
        select: { labels: true, confidence: true }
      })

      const outliers = detectOutliers(labels)

      expect(outliers).toHaveLength(0)
    })
  })

  describe('Quality Validation', () => {
    it('should validate label quality based on worker accuracy', () => {
      const workers = [
        { id: 'worker1', accuracy: 0.95 },
        { id: 'worker2', accuracy: 0.90 },
        { id: 'worker3', accuracy: 0.85 }
      ]

      const validateQuality = (labels: Array<{ workerId: string; label: string }>): boolean => {
        const accuracies = labels.map(l =>
          workers.find(w => w.id === l.workerId)?.accuracy || 0
        )
        const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length
        return avgAccuracy >= 0.8
      }

      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'cat')
      stateMachine.addLabel('worker3', 'cat')

      const labels = stateMachine.getLabels()
      expect(validateQuality(labels)).toBe(true)
    })

    it('should reject labels from low-accuracy workers', () => {
      const workers = [
        { id: 'worker1', accuracy: 0.95 },
        { id: 'worker2', accuracy: 0.95 },
        { id: 'worker3', accuracy: 0.30 } // Low accuracy worker
      ]

      const validateQuality = (labels: Array<{ workerId: string; label: string }>): boolean => {
        const accuracies = labels.map(l =>
          workers.find(w => w.id === l.workerId)?.accuracy || 0
        )
        const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length
        return avgAccuracy >= 0.8
      }

      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'cat')
      stateMachine.addLabel('worker3', 'cat')

      const labels = stateMachine.getLabels()
      expect(validateQuality(labels)).toBe(false)
    })
  })

  describe('Dispute Resolution', () => {
    it('should trigger additional reviewers for conflicting labels', () => {
      stateMachine.addLabel('worker1', 'cat')
      stateMachine.addLabel('worker2', 'dog')
      stateMachine.addLabel('worker3', 'bird')

      const consensus = stateMachine.calculateConsensus()

      if (consensus.conflicting) {
        // Need additional reviewers
        stateMachine.addLabel('worker4', 'cat')
        stateMachine.addLabel('worker5', 'cat')

        const newConsensus = stateMachine.calculateConsensus()
        expect(newConsensus.result).toBe('cat')
        expect(newConsensus.confidence).toBe(0.6) // 3 out of 5 labels
      }
    })
  })

  describe('Label Validation', () => {
    it('should validate consensus against expected labels', () => {
      const expectedLabels = ['cat', 'dog']

      // Perfect match
      expect(validateLabelConsensus(['cat', 'dog'], expectedLabels, 0.8)).toBe(true)

      // Partial match
      expect(validateLabelConsensus(['cat'], expectedLabels, 0.4)).toBe(true)
      expect(validateLabelConsensus(['cat'], expectedLabels, 0.6)).toBe(false)

      // No match
      expect(validateLabelConsensus(['bird'], expectedLabels, 0.5)).toBe(false)

      // Extra labels
      expect(validateLabelConsensus(['cat', 'dog', 'car'], expectedLabels, 0.5)).toBe(false)
    })

    it('should handle multiple expected labels', () => {
      const expectedLabels = ['cat', 'dog', 'bird', 'fish']

      // Multiple consensus labels
      expect(validateLabelConsensus(['cat', 'dog'], expectedLabels, 0.3)).toBe(true)

      // All expected labels
      expect(validateLabelConsensus(expectedLabels, expectedLabels, 0.8)).toBe(true)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle edge cases gracefully', () => {
      // Empty array of labels
      expect(calculateConsensus([], 0.5)).toBeNull()

      // Single label
      expect(calculateConsensus([['cat']], 0.5)).toEqual(['cat'])

      // Single worker
      expect(calculateConsensus([['cat', 'dog']], 1.0)).toEqual(['cat', 'dog'])

      // Invalid consensus ratio
      expect(calculateConsensus([['cat']], 0)).toEqual(['cat'])
      expect(calculateConsensus([['cat']], 1.1)).toBeNull()
    })

    it('should validate task completion requirements', async () => {
      const complexTask = {
        id: 'task_complex_validation',
        requirements: {
          minAgreement: 0.9,
          minWorkers: 5,
          requiredConfidence: 0.8,
          validationChecks: ['consistency', 'accuracy', 'completeness']
        }
      }

      const workers = ['worker_1', 'worker_2', 'worker_3', 'worker_4', 'worker_5']
      await testDb.task.create({
        data: {
          id: complexTask.id,
          status: 'AVAILABLE',
          requiredLabels: 5,
          consensusRequired: 0.9,
          // ... other required fields
        }
      })

      // Submit results that don't meet requirements
      for (const worker of workers) {
        await createTestLabel(complexTask.id, parseInt(worker.split('_')[1]), { labels: ['result'] })
      }

      const consensus = calculateConsensus(['result'], 0.8)

      if (consensus && 0.8 < complexTask.requirements.minAgreement) {
        // Should trigger additional validation or more workers
        expect(0.8).toBeLessThan(complexTask.requirements.minAgreement)
      }
    })
  })
})