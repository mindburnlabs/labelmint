import { describe, it, expect } from 'vitest'

describe('Shared Helpers', () => {
  describe('String Helpers', () => {
    it('should capitalize first letter', () => {
      const capitalize = (str: string) =>
        str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()

      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('WORLD')).toBe('World')
      expect(capitalize('')).toBe('')
    })

    it('should truncate text', () => {
      const truncate = (text: string, maxLength: number) =>
        text.length <= maxLength ? text : text.slice(0, maxLength) + '...'

      expect(truncate('short text', 20)).toBe('short text')
      expect(truncate('this is a very long text', 10)).toBe('this is a ...')
      expect(truncate('', 5)).toBe('')
    })

    it('should generate slugs', () => {
      const slugify = (text: string) =>
        text.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')

      expect(slugify('Hello World!')).toBe('hello-world')
      expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
      expect(slugify('Café & Restaurant')).toBe('caf-restaurant')
    })
  })

  describe('Array Helpers', () => {
    it('should chunk arrays', () => {
      const chunk = <T>(array: T[], size: number): T[][] => {
        const chunks: T[][] = []
        for (let i = 0; i < array.length; i += size) {
          chunks.push(array.slice(i, i + size))
        }
        return chunks
      }

      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
      expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]])
      expect(chunk([], 3)).toEqual([])
    })

    it('should remove duplicates', () => {
      const unique = <T>(array: T[]): T[] => [...new Set(array)]

      expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3])
      expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
      expect(unique([])).toEqual([])
    })
  })

  describe('Date Helpers', () => {
    it('should format dates', () => {
      const formatDate = (date: Date) =>
        date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })

      const testDate = new Date('2024-01-15')
      expect(formatDate(testDate)).toBe('January 15, 2024')
    })

    it('should calculate relative time', () => {
      const timeAgo = (date: Date): string => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

        if (seconds < 60) return `${seconds}s ago`
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        return `${Math.floor(seconds / 86400)}d ago`
      }

      const oneHourAgo = new Date(Date.now() - 3600 * 1000)
      expect(timeAgo(oneHourAgo)).toBe('1h ago')

      const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000)
      expect(timeAgo(twoDaysAgo)).toBe('2d ago')
    })
  })
})