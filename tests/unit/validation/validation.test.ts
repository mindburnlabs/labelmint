import { describe, it, expect, vi } from 'vitest'

// Email validation function
function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmedEmail = email.trim()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/
  return emailRegex.test(trimmedEmail) && trimmedEmail === email
}

// Phone validation function
function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/
  const digits = phone.replace(/\D/g, '')
  return phoneRegex.test(phone) && digits.length >= 10 && digits.length <= 15
}

// URL validation function
function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmedUrl = url.trim()
  if (trimmedUrl !== url) return false // No leading/trailing spaces allowed
  try {
    new URL(trimmedUrl)
    return true
  } catch {
    return false
  }
}

// HTML sanitization function
function sanitizeHTML(html: string): string {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// JWT token validation (mock)
function validateJWT(token: string): { valid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required' }
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format' }
  }

  try {
    // Mock decode header and payload
    const header = JSON.parse(atob(parts[0]))
    const payload = JSON.parse(atob(parts[1]))

    if (!header.alg || !payload.exp) {
      return { valid: false, error: 'Missing required claims' }
    }

    if (payload.exp < Date.now() / 1000) {
      return { valid: false, error: 'Token expired' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'Invalid token encoding' }
  }
}

describe('Validation Tests', () => {
  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
        'a@b.co'
      ]

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true)
      })
    })

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid',
        'user@',
        '@domain.com',
        'user@domain',
        'user..name@example.com',
        'user@.domain.com',
        'user@domain.',
        'user name@domain.com',
        'user@domain..com'
      ]

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false)
      })
    })

    it('should handle edge cases', () => {
      expect(validateEmail('a@b.c')).toBe(true)
      expect(validateEmail('test@localhost')).toBe(false) // No TLD
      expect(validateEmail('test@127.0.0.1')).toBe(false)
    })
  })

  describe('Phone Validation', () => {
    it('should validate correct phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '+1 (234) 567-8901',
        '2345678901',
        '+44 20 7946 0958',
        '(123) 456-7890',
        '+86 10 8888 8888'
      ]

      validPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(true)
      })
    })

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '',
        '123',
        'abc123',
        '123-abc-456',
        '+',
        '()',
        '12345678901234567890' // Too long
      ]

      invalidPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(false)
      })
    })

    it('should handle minimum digit requirement', () => {
      expect(validatePhone('1234567890')).toBe(true) // Exactly 10 digits
      expect(validatePhone('123456789')).toBe(false) // Only 9 digits
      expect(validatePhone('+1 234567890')).toBe(true) // 11 with country code
    })
  })

  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://sub.domain.co.uk/path',
        'ftp://files.example.net',
        'https://example.com/path?query=value&other=123',
        'https://example.com/path#section'
      ]

      validUrls.forEach(url => {
        expect(validateUrl(url)).toBe(true)
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        '',
        'not-a-url',
        'http://',
        'https://',
        'example.com', // Missing protocol
        '://missing-protocol.com',
        'http://invalid url with spaces'
      ]

      invalidUrls.forEach(url => {
        expect(validateUrl(url)).toBe(false)
      })
    })
  })

  describe('HTML Sanitization', () => {
    it('should sanitize dangerous HTML elements', () => {
      const dangerousHTML = '<script>alert("xss")</script><div onclick="alert()">Click me</div>'
      const sanitized = sanitizeHTML(dangerousHTML)

      expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&lt;div onclick=&quot;alert()&quot;&gt;Click me&lt;/div&gt;')
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('onclick=')
    })

    it('should handle special characters', () => {
      const htmlWithSpecialChars = '<p>"Hello" & \'World\'</p>'
      const sanitized = sanitizeHTML(htmlWithSpecialChars)

      expect(sanitized).toBe('&lt;p&gt;&quot;Hello&quot; &amp; &#x27;World&#x27;&lt;/p&gt;')
    })

    it('should handle empty and simple strings', () => {
      expect(sanitizeHTML('')).toBe('')
      expect(sanitizeHTML('plain text')).toBe('plain text')
      expect(sanitizeHTML('<strong>bold</strong>')).toBe('&lt;strong&gt;bold&lt;/strong&gt;')
    })
  })

  describe('JWT Token Validation', () => {
    it('should validate well-formed tokens', () => {
      // Create a mock JWT token
      const header = { alg: 'HS256', typ: 'JWT' }
      const payload = { sub: '1234567890', exp: Math.floor(Date.now() / 1000) + 3600 }

      const token = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.signature`

      const result = validateJWT(token)
      expect(result.valid).toBe(true)
    })

    it('should reject malformed tokens', () => {
      const invalidTokens = [
        '',
        'invalid.token',
        'only.one.part',
        'too.many.parts.here'
      ]

      invalidTokens.forEach(token => {
        const result = validateJWT(token)
        expect(result.valid).toBe(false)
      })
    })

    it('should reject expired tokens', () => {
      const header = { alg: 'HS256', typ: 'JWT' }
      const payload = { sub: '1234567890', exp: Math.floor(Date.now() / 1000) - 3600 } // Expired 1 hour ago

      const token = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.signature`

      const result = validateJWT(token)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('expired')
    })

    it('should reject tokens without required claims', () => {
      const header = { typ: 'JWT' } // Missing alg
      const payload = { sub: '1234567890' } // Missing exp

      const token = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.signature`

      const result = validateJWT(token)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Missing required claims')
    })
  })

  describe('Input Security Tests', () => {
    it('should prevent SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "admin' /*",
        "' OR 1=1#"
      ]

      sqlInjectionAttempts.forEach(attempt => {
        // In a real application, these would be properly parameterized
        expect(validateEmail(attempt)).toBe(false)
        expect(validatePhone(attempt)).toBe(false)
        expect(sanitizeHTML(attempt)).not.toContain(attempt)
      })
    })

    it('should handle XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<svg onload=alert("xss")>'
      ]

      xssAttempts.forEach(attempt => {
        const sanitized = sanitizeHTML(attempt)
        expect(sanitized).not.toContain('<script>')
        expect(sanitized).not.toContain('onerror=')
        expect(sanitized).not.toContain('javascript:')
        expect(sanitized).not.toContain('onload=')
      })
    })

    it('should validate maximum lengths', () => {
      const longString = 'a'.repeat(1000)

      // These should fail basic validation for being too long
      expect(validateEmail(longString + '@example.com')).toBe(false)
      expect(validatePhone('+' + longString)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(() => validateEmail(null as any)).not.toThrow()
      expect(() => validateEmail(undefined as any)).not.toThrow()
      expect(() => validatePhone(null as any)).not.toThrow()
      expect(() => validatePhone(undefined as any)).not.toThrow()
      expect(() => validateUrl(null as any)).not.toThrow()
      expect(() => validateUrl(undefined as any)).not.toThrow()
    })

    it('should handle non-string inputs', () => {
      expect(validateEmail(123 as any)).toBe(false)
      expect(validateEmail({} as any)).toBe(false)
      expect(validateEmail([] as any)).toBe(false)

      expect(validatePhone(123 as any)).toBe(false)
      expect(validatePhone({} as any)).toBe(false)
      expect(validatePhone([] as any)).toBe(false)
    })

    it('should handle whitespace correctly', () => {
      expect(validateEmail('  test@example.com  ')).toBe(false) // Should not allow leading/trailing spaces
      expect(validatePhone('  1234567890  ')).toBe(true) // Phone validation should handle spaces
      expect(validateUrl('  https://example.com  ')).toBe(false) // URL validation should reject spaces
    })
  })
})