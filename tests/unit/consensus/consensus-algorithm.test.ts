import { describe, it, expect, vi } from 'vitest'

// Simple consensus algorithm implementation for testing
function calculateConsensus(labels: string[], threshold = 0.7): string | null {
  if (labels.length === 0) return null

  const counts = labels.reduce((acc, label) => {
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const total = labels.length
  const majority = Math.ceil(total * threshold)

  for (const [label, count] of Object.entries(counts)) {
    if (count >= majority) {
      return label
    }
  }

  return null
}

// Mock task state machine
interface TaskState {
  id: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed'
  labels: string[]
  consensus: string | null
}

class MockTaskStateMachine {
  private state: TaskState

  constructor(taskId: string) {
    this.state = {
      id: taskId,
      status: 'pending',
      labels: [],
      consensus: null
    }
  }

  assign(): void {
    this.state.status = 'assigned'
  }

  start(): void {
    if (this.state.status !== 'assigned') {
      throw new Error('Task must be assigned first')
    }
    this.state.status = 'in_progress'
  }

  addLabel(label: string): void {
    if (this.state.status !== 'in_progress') {
      throw new Error('Task must be in progress')
    }
    this.state.labels.push(label)

    // Calculate consensus
    this.state.consensus = calculateConsensus(this.state.labels)

    // Auto-complete if consensus reached
    if (this.state.consensus) {
      this.state.status = 'completed'
    }
  }

  getState(): TaskState {
    // Return a deep copy to ensure immutability
    return {
      id: this.state.id,
      status: this.state.status,
      labels: [...this.state.labels],
      consensus: this.state.consensus
    }
  }
}

describe('Consensus Algorithm', () => {
  describe('calculateConsensus', () => {
    it('should calculate consensus with majority agreement', () => {
      const labels = ['cat', 'cat', 'cat']
      const result = calculateConsensus(labels, 0.7)

      expect(result).toBe('cat') // 3/3 = 100% >= ceil(3 * 0.7) = 3
    })

    it('should return null with no consensus', () => {
      const labels = ['cat', 'dog', 'bird']
      const result = calculateConsensus(labels, 0.7)

      expect(result).toBe(null)
    })

    it('should handle empty label array', () => {
      const result = calculateConsensus([], 0.7)

      expect(result).toBe(null)
    })

    it('should work with different thresholds', () => {
      const labels = ['cat', 'cat', 'dog', 'dog']

      expect(calculateConsensus(labels, 0.5)).toBe('cat') // 2/4 >= ceil(0.5 * 4) = 2, but cat appears first
      expect(calculateConsensus(labels, 0.4)).toBe('cat') // 2/4 >= ceil(0.4 * 4) = 2
    })

    it('should handle edge cases', () => {
      expect(calculateConsensus(['cat'], 0.7)).toBe('cat')
      expect(calculateConsensus(['cat', 'cat'], 0.7)).toBe('cat')
      expect(calculateConsensus(['cat', 'cat', 'cat', 'dog'], 0.7)).toBe('cat')
    })
  })

  describe('MockTaskStateMachine', () => {
    it('should transition through states correctly', () => {
      const task = new MockTaskStateMachine('task-123')

      expect(task.getState().status).toBe('pending')

      task.assign()
      expect(task.getState().status).toBe('assigned')

      task.start()
      expect(task.getState().status).toBe('in_progress')
    })

    it('should validate state transitions', () => {
      const task = new MockTaskStateMachine('task-123')

      expect(() => task.start()).toThrow('Task must be assigned first')

      task.assign()
      task.start()

      expect(() => task.assign()).not.toThrow() // Allow re-assignment
    })

    it('should calculate consensus and auto-complete', () => {
      const task = new MockTaskStateMachine('task-123')

      task.assign()
      task.start()

      expect(task.getState().status).toBe('in_progress')
      expect(task.getState().labels).toHaveLength(0)
      expect(task.getState().consensus).toBe(null)

      // Add labels
      task.addLabel('cat')
      expect(task.getState().labels).toHaveLength(1)
      expect(task.getState().consensus).toBe('cat') // 1/1 >= 0.7
      expect(task.getState().status).toBe('completed')
    })

    it('should handle consensus with multiple labels', () => {
      const task = new MockTaskStateMachine('task-123')

      task.assign()
      task.start()

      task.addLabel('cat')  // 1/1 = 100% > 70%
      expect(task.getState().consensus).toBe('cat')

      const task2 = new MockTaskStateMachine('task-124')
      task2.assign()
      task2.start()

      task2.addLabel('cat')   // labels: ['cat'], consensus: 'cat' (1/1 = 100% >= 1) - task completes
      expect(() => task2.addLabel('dog')).toThrow('Task must be in progress') // Can't add to completed task
    })

    it('should prevent adding labels to completed tasks', () => {
      const task = new MockTaskStateMachine('task-123')

      task.assign()
      task.start()
      task.addLabel('cat') // This should complete the task

      expect(task.getState().status).toBe('completed')
      expect(() => task.addLabel('dog')).toThrow('Task must be in progress')
    })

    it('should provide immutable state snapshots', () => {
      const task = new MockTaskStateMachine('task-123')

      const state1 = task.getState()
      const state2 = task.getState()

      expect(state1).toEqual(state2)
      expect(state1).not.toBe(state2) // Should be different objects

      // Verify state immutability
      state1.labels.push('test')
      expect(task.getState().labels).toHaveLength(0) // Original should be unchanged
    })
  })

  describe('Integration Tests', () => {
    it('should handle complex multi-label consensus scenarios', () => {
      const scenarios = [
        { labels: ['cat', 'cat', 'cat'], expected: 'cat' }, // 3/3 = 100% >= ceil(3 * 0.7) = 3
        { labels: ['cat', 'cat', 'dog', 'dog'], expected: null }, // 2/4 = 50% < 70% threshold, so no consensus
        { labels: ['cat', 'dog', 'bird'], expected: null }, // 1/3 each, no majority
        { labels: ['cat', 'cat', 'cat', 'dog'], expected: 'cat' }, // 3/4 = 75% >= ceil(4 * 0.7) = 3
        { labels: ['cat', 'cat', 'dog', 'dog', 'bird'], expected: null } // 2/5 = 40% < 70%
      ]

      scenarios.forEach(({ labels, expected }) => {
        const result = calculateConsensus(labels, 0.7)
        expect(result).toBe(expected)
      })
    })

    it('should simulate complete task workflow', async () => {
      const task = new MockTaskStateMachine('workflow-test')

      // Initial state
      expect(task.getState().status).toBe('pending')

      // Assignment
      task.assign()
      expect(task.getState().status).toBe('assigned')

      // Start work
      task.start()
      expect(task.getState().status).toBe('in_progress')

      // Add labels until consensus
      task.addLabel('image_a')
      expect(task.getState().consensus).toBe('image_a')
      expect(task.getState().status).toBe('completed')

      // Final state verification
      const finalState = task.getState()
      expect(finalState.labels).toEqual(['image_a'])
      expect(finalState.consensus).toBe('image_a')
      expect(finalState.status).toBe('completed')
    })
  })
})