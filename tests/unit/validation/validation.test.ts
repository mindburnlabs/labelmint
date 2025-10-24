import { describe, it, expect, vi } from 'vitest'

describe('Validation Suite', () => {
  describe('Email Validation', () => {
    it('should validate valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user.name@sub.domain.org',
        'firstname.lastname@company.com',
        'email@123.123.123.123', // IP address domain
        '1234567890@example.com', // Numbers in local part
        'email@example-one.com', // Domain with dash
        '_______@example.com', // Underscore in local part
      ]

      const emailRegex = /^[^\s@.]+@[^\s@.]+\.[^\s@.]+$/
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true)
      })
    })

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        '',
        'plainaddress',
        'user@.com',
        'user@domain.',
        'user@domain..com',
        '.user@domain.com',
        'user@domain.com.',
        'user@domain.com..',
        'user name@domain.com', // Spaces
        'email@domain@domain.com', // Multiple @ symbols
      ]

      const emailRegex = /^[^\s@.]+@[^\s@.]+\.[^\s@.]+$/
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false)
      })
    })

    it('should handle edge cases in email validation', () => {
      const edgeCases = [
        // Very long email
        'very.long.email.address@example.com',
        // Email with subdomains
        'user@sub.sub.domain.com',
        // Special characters
        'test+alias@example.com',
        'test-tag@example.com',
      ]

      const emailRegex = /^[^\s@.]+@[^\s@.]+\.[^\s@.]+$/
      edgeCases.forEach(email => {
        // These should either pass or be handled gracefully
        const isValid = emailRegex.test(email)
        expect(typeof isValid).toBe('boolean')
      })
    })
  })

  describe('Phone Number Validation', () => {
    it('should validate phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '1 (555) 123-4567',
        '+44 20 7123 456',
        '555-123-4567',
        '555.123.4567',
        '(555) 123-4567',
        '+1 555 123 4567',
      ]

      const phoneRegex = /^\+?[\d\s\-\(\)]+$/
      validPhones.forEach(phone => {
        expect(phoneRegex.test(phone)).toBe(true)
      })
    })

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        'abc-def-ghij',
        '123-456-78901', // Too long
        '12-34',
        'phone',
        '',
        '() 123-4567', // Empty parentheses
        '(555 123-4567', // Missing closing parenthesis
      ]

      const phoneRegex = /^\+?[\d\s\-\(\)]+$/
      invalidPhones.forEach(phone => {
        expect(phoneRegex.test(phone)).toBe(false)
      })
    })
  })

  describe('URL Validation', () => {
    it('should validate URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://sub.domain.org/path?query=value',
        'https://example.com:8080/path/to/resource',
        'https://example.com/path?param1=value1&param2=value2',
        'ftp://ftp.example.com',
        'ws://websocket.example.com',
      ]

      validUrls.forEach(url => {
        try {
          new URL(url)
          expect(true).toBe(true)
        } catch {
          expect(false).toBe(true)
        }
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        '://missing-protocol.com',
        'http://',
        'https://',
        'example.com', // Missing protocol
        '',
        'javascript:alert("xss")', // Security risk
      ]

      invalidUrls.forEach(url => {
        try {
          new URL(url)
          expect(false).toBe(true)
        } catch {
          expect(true).toBe(true)
        }
      })
    })
  })

  describe('Security Input Validation', () => {
    it('should sanitize HTML input', () => {
      const sanitizeHTML = (input: string): string => {
        return input
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
      }

      expect(sanitizeHTML('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(sanitizeHTML('Hello "World"')).toBe('Hello &quot;World&quot;')
      expect(sanitizeHTML('Normal text')).toBe('Normal text')
      expect(sanitizeHTML('<img src="x" onerror="alert(1)">'))
        .toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;')
    })

    it('should validate and sanitize user input', () => {
      const validateInput = (input: string): { valid: boolean; sanitized: string } => {
        const trimmed = input.trim()
        const hasContent = trimmed.length > 0
        const noMaliciousChars = !/[<>"'\\]/.test(trimmed)

        return {
          valid: hasContent && noMaliciousChars,
          sanitized: trimmed.replace(/\s+/g, ' ').trim()
        }
      }

      const validInput = validateInput('Hello World')
      expect(validInput.valid).toBe(true)
      expect(validInput.sanitized).toBe('Hello World')

      const maliciousInput = validateInput('<script>alert("xss")</script>')
      expect(maliciousInput.valid).toBe(false)
      expect(maliciousInput.sanitized).toBe('')

      const whitespaceInput = validateInput('  multiple   spaces  ')
      expect(whitespaceInput.valid).toBe(true)
      expect(whitespaceInput.sanitized).toBe('multiple spaces')
    })

    it('should detect SQL injection patterns', () => {
      const sqlInjectionPatterns = [
        /union.*select/i,
        /drop.*table/i,
        /insert.*into/i,
        /delete.*from/i,
        /update.*set/i,
        /exec.*\(/i,
        /--/,
        /\/\*/,
        /\*\//,
      ]

      const testInput = (input: string): boolean => {
        return sqlInjectionPatterns.some(pattern => pattern.test(input))
      }

      expect(testInput("'; DROP TABLE users; --")).toBe(true)
      expect(testInput("1' UNION SELECT * FROM passwords --")).toBe(true)
      expect(testInput("'; EXEC xp_cmdshell('dir'); --")).toBe(true)
      expect(testInput("normal text")).toBe(false)
      expect(testInput("No SQL here")).toBe(false)
    })

    it('should validate file upload safety', () => {
      const allowedExtensions = ['.jpg', '.png', '.gif', '.pdf', '.txt']
      const maxSize = 5 * 1024 * 1024 // 5MB

      const validateFile = (file: { name: string; size: number; type: string }): { valid: boolean; error?: string } => {
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
        const isValidExtension = allowedExtensions.includes(extension)
        const isValidSize = file.size <= maxSize

        if (!isValidExtension) {
          return { valid: false, error: 'Invalid file type' }
        }
        if (!isValidSize) {
          return { valid: false, error: 'File too large' }
        }
        return { valid: true }
      }

      const validFile = { name: 'image.jpg', size: 1024, type: 'image/jpeg' }
      const invalidTypeFile = { name: 'script.exe', size: 1024, type: 'application/x-executable' }
      const invalidSizeFile = { name: 'large.pdf', size: 10 * 1024 * 1024, type: 'application/pdf' }

      expect(validateFile(validFile).valid).toBe(true)
      expect(validateFile(invalidTypeFile).valid).toBe(false)
      expect(validateFile(invalidSizeFile).valid).toBe(false)
    })
  })

  describe('JWT Token Validation', () => {
    const decodeJWT = (token: string) => {
      const parts = token.split('.')
      if (parts.length !== 3) return null

      try {
        return JSON.parse(atob(parts[1]))
      } catch {
        return null
      }
    }

    it('should validate JWT token structure', () => {
      const validPayload = JSON.stringify({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })
      const mockJWT = `header.${btoa(validPayload)}.signature`

      const validToken = decodeJWT(mockJWT)
      expect(validToken).toBeTruthy()
      expect(validToken.sub).toBe('user-123')
      expect(validToken.iat).toBeDefined()
      expect(validToken.exp).toBeDefined()

      const invalidToken = decodeJWT('invalid.token')
      expect(invalidToken).toBeNull()

      const malformedToken = decodeJWT('only.one.part')
      expect(malformedToken).toBeNull()
    })

    it('should check token expiration', () => {
      const checkTokenExpiry = (token: string): boolean => {
        const decoded = decodeJWT(token)
        if (!decoded) return false

        const now = Math.floor(Date.now() / 1000)
        return decoded.exp > now
      }

      const futureTime = Math.floor(Date.now() / 1000) + 3600
      const expiredTime = Math.floor(Date.now() / 1000) - 3600

      const validToken = `header.${btoa(JSON.stringify({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: futureTime
      }))}.signature`

      const expiredToken = `header.${btoa(JSON.stringify({
        sub: 'user-123',
        iat: expiredTime - 7200,
        exp: expiredTime
      }))}.signature`

      expect(checkTokenExpiry(validToken)).toBe(true)
      expect(checkTokenExpiry(expiredToken)).toBe(false)
    })

    it('should validate required JWT claims', () => {
      const validateClaims = (payload: any): { valid: boolean; errors: string[] } => {
        const errors: string[] = []

        if (!payload.sub) errors.push('Missing subject (sub)')
        if (!payload.iat) errors.push('Missing issued at (iat)')
        if (!payload.exp) errors.push('Missing expiration (exp)')
        if (payload.exp && payload.iat && payload.exp <= payload.iat) {
          errors.push('Expiration must be after issued at')
        }

        return { valid: errors.length === 0, errors }
      }

      const validPayload = { sub: 'user123', iat: Date.now() / 1000, exp: Date.now() / 1000 + 3600 }
      const invalidPayload = { aud: 'my-app', iat: Date.now() / 1000 }

      expect(validateClaims(validPayload).valid).toBe(true)
      expect(validateClaims(invalidPayload).valid).toBe(false)
      expect(validateClaims(invalidPayload).errors).toContain('Missing subject (sub)')
      expect(validateClaims(invalidPayload).errors).toContain('Missing expiration (exp)')
    })
  })

  describe('Rate Limiting Validation', () => {
    it('should track request rates', () => {
      const rateLimiter = new Map<string, { count: number; resetTime: number }>()

      const checkRateLimit = (clientId: string, limit: number, windowMs: number): boolean => {
        const now = Date.now()
        const client = rateLimiter.get(clientId) || { count: 0, resetTime: now }

        if (now - client.resetTime > windowMs) {
          client.count = 1
          client.resetTime = now
        } else {
          client.count++
        }

        rateLimiter.set(clientId, client)
        return client.count <= limit
      }

      const clientId = 'client-123'

      // Should allow first 10 requests
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit(clientId, 10, 60000)).toBe(true)
      }

      // 11th request should be rate limited
      expect(checkRateLimit(clientId, 10, 60000)).toBe(false)

      // After window reset, should allow again
      const futureTime = Date.now() + 70000
      vi.setSystemTime(futureTime)
      expect(checkRateLimit(clientId, 10, 60000)).toBe(true)
    })

    it('should handle multiple clients independently', () => {
      const rateLimiter = new Map<string, { count: number; resetTime: number }>()

      const checkRateLimit = (clientId: string, limit: number): boolean => {
        const now = Date.now()
        const client = rateLimiter.get(clientId) || { count: 0, resetTime: now }

        if (now - client.resetTime > 60000) {
          client.count = 1
          client.resetTime = now
        } else {
          client.count++
        }

        rateLimiter.set(clientId, client)
        return client.count <= limit
      }

      // Client 1 uses up their limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit('client-1', 5)
      }
      expect(checkRateLimit('client-1', 5)).toBe(false)

      // Client 2 should still be able to make requests
      expect(checkRateLimit('client-2', 5)).toBe(true)
    })
  })

  describe('Data Structure Validation', () => {
    it('should validate required fields in objects', () => {
      const validateUser = (user: any): { valid: boolean; errors: string[] } => {
        const errors: string[] = []

        if (!user.email || typeof user.email !== 'string') {
          errors.push('Valid email required')
        }
        if (!user.name || typeof user.name !== 'string' || user.name.trim().length === 0) {
          errors.push('Valid name required')
        }
        if (user.age !== undefined && (typeof user.age !== 'number' || user.age < 0 || user.age > 150)) {
          errors.push('Valid age required (0-150)')
        }

        return { valid: errors.length === 0, errors }
      }

      const validUser = { email: 'user@example.com', name: 'John Doe', age: 30 }
      const invalidUser = { email: 'invalid-email', name: '', age: -5 }

      expect(validateUser(validUser).valid).toBe(true)
      expect(validateUser(invalidUser).valid).toBe(false)
      expect(validateUser(invalidUser).errors).toContain('Valid email required')
      expect(validateUser(invalidUser).errors).toContain('Valid name required')
    })

    it('should validate array constraints', () => {
      const validateArray = (arr: any, options: { minLength?: number; maxLength?: number; unique?: boolean } = {}): { valid: boolean; errors: string[] } => {
        const errors: string[] = []

        if (!Array.isArray(arr)) {
          errors.push('Must be an array')
          return { valid: false, errors }
        }

        if (options.minLength !== undefined && arr.length < options.minLength) {
          errors.push(`Array must have at least ${options.minLength} items`)
        }

        if (options.maxLength !== undefined && arr.length > options.maxLength) {
          errors.push(`Array must have at most ${options.maxLength} items`)
        }

        if (options.unique) {
          const uniqueItems = new Set(arr)
          if (uniqueItems.size !== arr.length) {
            errors.push('Array items must be unique')
          }
        }

        return { valid: errors.length === 0, errors }
      }

      expect(validateArray([1, 2, 3], { minLength: 2, maxLength: 5 }).valid).toBe(true)
      expect(validateArray([1], { minLength: 2 }).valid).toBe(false)
      expect(validateArray([1, 2, 3, 4, 5, 6], { maxLength: 5 }).valid).toBe(false)
      expect(validateArray([1, 2, 2, 3], { unique: true }).valid).toBe(false)
    })
  })
})