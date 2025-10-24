import { describe, it, expect } from 'vitest'

// Payment calculation utilities with proper floating point precision
function roundToDecimals(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

function calculatePayment(baseRate: number, complexity: string, turnaround: string, quality: number): PaymentResult {
  const complexityMultiplierss = {
    simple: 1.0,
    medium: 2.5,
    complex: 7.5,
    expert: 37.5
  }

  const turnaroundMultiplierss = {
    standard: 1.0,
    priority: 1.5,
    urgent: 2.5
  }

  const basePayment = baseRate * (complexityMultiplierss[complexity] || 1.0) * (turnaroundMultiplierss[turnaround] || 1.0)

  // Calculate quality bonus (capped at 20%)
  const qualityBonus = Math.max(0, Math.min(0.2, quality - 0.95)) * basePayment

  const total = roundToDecimals(basePayment + qualityBonus, 2)

  return {
    baseRate: roundToDecimals(baseRate, 2),
    complexityMultipliers: complexityMultipliers[complexity] || 1.0,
    turnaroundMultipliers: turnaroundMultipliers[turnaround] || 1.0,
    qualityBonus: roundToDecimals(qualityBonus, 2),
    total
  }
}

interface PaymentResult {
  baseRate: number
  complexityMultiplier: number
  turnaroundMultiplier: number
  qualityBonus: number
  total: number
}

describe('Payment Calculations', () => {
  describe('roundToDecimals', () => {
    it('should round to 2 decimal places correctly', () => {
      expect(roundToDecimals(0.020000000000000004, 2)).toBe(0.02)
      expect(roundToDecimals(0.025, 2)).toBe(0.03)
      expect(roundToDecimals(0.024, 2)).toBe(0.02)
      expect(roundToDecimals(1.999, 2)).toBe(2.00)
    })

    it('should handle edge cases', () => {
      expect(roundToDecimals(0, 2)).toBe(0)
      expect(roundToDecimals(0.004, 2)).toBe(0)
      expect(roundToDecimals(0.005, 2)).toBe(0.01)
      expect(roundToDecimals(-1.234, 2)).toBe(-1.23)
    })

    it('should work with different decimal places', () => {
      expect(roundToDecimals(1.234567, 3)).toBe(1.235)
      expect(roundToDecimals(1.234567, 4)).toBe(1.2346)
      expect(roundToDecimals(1.234567, 0)).toBe(1)
    })
  })

  describe('calculatePayment', () => {
    it('should calculate simple task payment', () => {
      const result = calculatePayment(0.02, 'simple', 'standard', 0.95)

      expect(result.baseRate).toBe(0.02)
      expect(result.complexityMultipliers).toBe(1.0)
      expect(result.turnaroundMultipliers).toBe(1.0)
      expect(result.qualityBonus).toBe(0) // No bonus at exactly 95% quality
      expect(result.total).toBe(0.02)
    })

    it('should calculate medium priority task with quality bonus', () => {
      const result = calculatePayment(0.02, 'medium', 'priority', 0.99)

      expect(result.baseRate).toBe(0.02)
      expect(result.complexityMultipliers).toBe(2.5)
      expect(result.turnaroundMultipliers).toBe(1.5)
      expect(result.qualityBonus).toBe(0.02) // (0.99-0.95)*0.02*2.5*1.5 = 0.03, capped at 20%
      expect(result.total).toBe(roundToDecimals(0.02 * 2.5 * 1.5, 2) + 0.02) // 0.075 + 0.02 = 0.095
    })

    it('should calculate expert urgent task payment', () => {
      const result = calculatePayment(0.02, 'expert', 'urgent', 1.0)

      expect(result.baseRate).toBe(0.02)
      expect(result.complexityMultipliers).toBe(37.5)
      expect(result.turnaroundMultipliers).toBe(2.5)
      expect(result.qualityBonus).toBe(roundToDecimals(0.02 * 37.5 * 2.5 * 0.2, 2)) // Max 20% bonus
      expect(result.total).toBe(roundToDecimals(0.02 * 37.5 * 2.5 * 1.2, 2)) // 1.875 + 0.375 = 2.25
    })

    it('should cap quality bonus at 20%', () => {
      const perfectQuality = calculatePayment(1.00, 'simple', 'standard', 1.0)
      expect(perfectQuality.qualityBonus).toBe(roundToDecimals(1.00 * 0.2, 2)) // Capped at 20%

      const veryHighQuality = calculatePayment(1.00, 'simple', 'standard', 0.99)
      expect(veryHighQuality.qualityBonus).toBe(roundToDecimals(1.00 * 0.2, 2)) // Capped at 20%
    })

    it('should handle zero quality bonus for low accuracy', () => {
      const result = calculatePayment(0.05, 'medium', 'standard', 0.90)

      expect(result.qualityBonus).toBe(0) // Below 95% threshold
      expect(result.total).toBe(roundToDecimals(0.05 * 2.5, 2)) // 0.125
    })

    it('should handle floating point precision correctly', () => {
      const scenarios = [
        { base: 0.01, complexity: 'simple', turnaround: 'standard', quality: 1.0, expected: 0.01 },
        { base: 0.033333333333, complexity: 'simple', turnaround: 'standard', quality: 0.95, expected: 0.03 },
        { base: 0.05, complexity: 'medium', turnaround: 'priority', quality: 0.97, expected: 0.20 },
        { base: 0.025, complexity: 'simple', turnaround: 'standard', quality: 0.98, expected: 0.03 }
      ]

      scenarios.forEach(({ base, complexity, turnaround, quality, expected }) => {
        const result = calculatePayment(base, complexity, turnaround, quality)
        expect(result.total).toBe(expected)
      })
    })
  })

  describe('Complex Payment Scenarios', () => {
    it('should calculate batch payments correctly', () => {
      const tasks = [
        { base: 0.02, complexity: 'simple', turnaround: 'standard', quality: 0.95 },
        { base: 0.05, complexity: 'medium', turnaround: 'priority', quality: 0.97 },
        { base: 0.15, complexity: 'complex', turnaround: 'urgent', quality: 0.99 }
      ]

      const results = tasks.map(task =>
        calculatePayment(task.base, task.complexity, task.turnaround, task.quality)
      )

      const total = results.reduce((sum, result) => sum + result.total, 0)
      expect(roundToDecimals(total, 2)).toBeGreaterThan(0.01)
    })

    it('should handle payment ranges correctly', () => {
      const simplePayment = calculatePayment(0.02, 'simple', 'standard', 0.95)
      const expertPayment = calculatePayment(0.02, 'expert', 'urgent', 1.0)

      expect(expertPayment.total).toBeGreaterThan(simplePayment.total * 10)
    })

    it('should validate payment bounds', () => {
      const minPayment = calculatePayment(0.01, 'simple', 'standard', 0.90)
      const maxPayment = calculatePayment(0.10, 'expert', 'urgent', 1.0)

      expect(minPayment.total).toBeGreaterThanOrEqual(0.01)
      expect(maxPayment.total).toBeLessThanOrEqual(10.00) // Reasonable upper bound
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero and negative values', () => {
      expect(() => calculatePayment(0, 'simple', 'standard', 0.95)).not.toThrow()
      expect(() => calculatePayment(-0.01, 'simple', 'standard', 0.95)).not.toThrow()
    })

    it('should handle invalid complexity and turnaround', () => {
      const result = calculatePayment(0.02, 'invalid', 'invalid', 0.95)

      expect(result.complexityMultipliers).toBe(1.0) // Fallback to 1.0
      expect(result.turnaroundMultipliers).toBe(1.0) // Fallback to 1.0
      expect(result.total).toBe(0.02) // Base rate only
    })

    it('should handle extreme quality scores', () => {
      const zeroQuality = calculatePayment(0.05, 'simple', 'standard', 0.0)
      const negativeQuality = calculatePayment(0.05, 'simple', 'standard', -1.0)
      const aboveOneQuality = calculatePayment(0.05, 'simple', 'standard', 2.0)

      expect(zeroQuality.qualityBonus).toBe(0)
      expect(negativeQuality.qualityBonus).toBe(0)
      expect(aboveOneQuality.qualityBonus).toBe(roundToDecimals(0.05 * 0.2, 2)) // Capped at 20%
    })
  })
})