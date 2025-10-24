import { describe, it, expect, beforeEach } from 'vitest'

describe('Performance Utils', () => {
  describe('Memoization', () => {
    let computeCount = 0

    beforeEach(() => {
      computeCount = 0
    })

    it('should cache expensive computations', () => {
      const memoize = <T, U>(fn: (arg: T) => U): ((arg: T) => U) => {
        const cache = new Map<T, U>()

        return (arg: T): U => {
          if (cache.has(arg)) {
            return cache.get(arg)!
          }

          const result = fn(arg)
          cache.set(arg, result)
          return result
        }
      }

      const expensive = (n: number): number => {
        computeCount++
        // Simulate expensive computation
        let result = 1
        for (let i = 0; i < n * 1000; i++) {
          result = (result + 1) % 1000
        }
        return result
      }

      const memoized = memoize(expensive)

      // First call should compute
      expect(memoized(10)).toBe(expensive(10))
      expect(computeCount).toBe(1)

      // Second call should use cache
      expect(memoized(10)).toBe(expensive(10))
      expect(computeCount).toBe(1) // Should not increase

      // Different argument should recompute
      expect(memoized(20)).toBe(expensive(20))
      expect(computeCount).toBe(2)
    })
  })
})