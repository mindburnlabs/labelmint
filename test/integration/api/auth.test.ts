import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockAuthService } from '@test/mocks/services'

describe('Authentication API Integration', () => {
  let authService: MockAuthService

  beforeEach(() => {
    authService = MockAuthService.create()
  })

  afterEach(() => {
    vi.clearAllMocks()
    authService.reset()
  })

  describe('POST /api/auth/login', () => {
    it('should authenticate with email and password', async () => {
      const req = {
        body: {
          email: 'worker@example.com',
          password: 'password123'
        }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await authService.authenticate(req.body.email, req.body.password)

      res.json({
        success: result.success,
        user: result.user,
        token: result.success ? await authService.createToken(result.user!.id) : null
      })

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          id: 1,
          email: 'worker@example.com',
          role: 'worker'
        }),
        token: expect.any(String)
      })
    })

    it('should reject invalid credentials', async () => {
      const req = {
        body: {
          email: 'worker@example.com',
          password: 'wrongpassword'
        }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await authService.authenticate(req.body.email, req.body.password)

      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials'
      })
    })

    it('should reject inactive users', async () => {
      const req = {
        body: {
          email: 'worker@example.com',
          password: 'password123'
        }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      // Deactivate user
      await authService.updateUser(1, { isActive: false })
      const result = await authService.authenticate(req.body.email, req.body.password)

      res.status(401).json({
        success: false,
        error: 'Account is inactive'
      })

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Account is inactive'
      })
    })
  })

  describe('POST /api/auth/telegram', () => {
    it('should authenticate with telegram ID', async () => {
      const req = {
        body: { telegramId: 123456789 }
      }
      const res = { json: vi.fn() }

      const result = await authService.authenticateByTelegram(req.body.telegramId)

      res.json({
        success: result.success,
        user: result.user,
        token: result.success ? await authService.createToken(result.user!.id) : null
      })

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          id: 1,
          telegramId: 123456789,
          role: 'worker'
        }),
        token: expect.any(String)
      })
    })

    it('should reject unknown telegram ID', async () => {
      const req = {
        body: { telegramId: 999999999 }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await authService.authenticateByTelegram(req.body.telegramId)

      res.status(401).json({
        success: false,
        error: 'User not found'
      })

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found'
      })
    })
  })

  describe('POST /api/auth/register', () => {
    it('should register new user', async () => {
      const req = {
        body: {
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'password123',
          role: 'worker'
        }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const user = await authService.createUser(req.body)
      const token = await authService.createToken(user.id)

      res.status(201).json({
        success: true,
        user: expect.objectContaining({
          id: expect.any(Number),
          email: 'newuser@example.com',
          username: 'newuser',
          role: 'worker'
        }),
        token
      })

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          email: 'newuser@example.com',
          username: 'newuser',
          role: 'worker',
          isActive: true
        }),
        token: expect.any(String)
      })
    })

    it('should validate user data', async () => {
      const req = {
        body: {
          email: 'invalid-email',
          username: '',
          password: '123' // Too short
        }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.status(400).json({
        success: false,
        errors: [
          'Email must be valid',
          'Username is required',
          'Password must be at least 6 characters'
        ]
      })

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: expect.any(Array)
      })
    })
  })

  describe('POST /api/auth/validate', () => {
    it('should validate valid token', async () => {
      const token = await authService.createTestSession(1, ['tasks:read'])
      const req = { headers: { authorization: `Bearer ${token}` } }
      const res = { json: vi.fn() }

      const result = await authService.validateToken(token)

      res.json({
        success: result.valid,
        user: result.user,
        permissions: result.user!.permissions
      })

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          id: 1,
          role: 'worker'
        }),
        permissions: ['tasks:read']
      })
    })

    it('should reject invalid token', async () => {
      const req = {
        headers: { authorization: 'Bearer invalid_token' }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await authService.validateToken('invalid_token')

      res.status(401).json({
        success: false,
        error: 'Invalid token'
      })

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token'
      })
    })

    it('should reject expired token', async () => {
      // Create expired token
      const expiredToken = authService.createTestSession(1)
      authService['sessions'].get(expiredToken)!.expiresAt = new Date(Date.now() - 1000)

      const req = {
        headers: { authorization: `Bearer ${expiredToken}` }
      }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      const result = await authService.validateToken(expiredToken)

      res.status(401).json({
        success: false,
        error: 'Token expired'
      })

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired'
      })
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout user', async () => {
      const token = await authService.createTestSession(1)
      const req = { headers: { authorization: `Bearer ${token}` }, user: { id: 1 } }
      const res = { json: vi.fn() }

      const result = await authService.logout(token)

      res.json({ success: result })

      expect(res.json).toHaveBeenCalledWith({ success: true })
      expect(result).toBe(true)
    })

    it('should clear all user sessions', async () => {
      const token1 = await authService.createTestSession(1)
      const token2 = await authService.createTestSession(1)
      const req = { headers: { authorization: `Bearer ${token1}` }, user: { id: 1 } }
      const res = { json: vi.fn() }

      const result = await authService.logoutAll(1)

      res.json({ success: result })

      expect(res.json).toHaveBeenCalledWith({ success: true })
      expect(result).toBe(true)

      // Both tokens should be invalid
      expect(await authService.validateToken(token1)).toEqual({
        success: false,
        error: 'Token not found'
      })
      expect(await authService.validateToken(token2)).toEqual({
        success: false,
        error: 'Token not found'
      })
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const token = await authService.createTestSession(1)
      const req = {
        headers: { authorization: `Bearer ${token}` },
        user: { id: 1 }
      }
      const res = { json: vi.fn() }

      const user = authService.getUser(1)
      res.json({
        success: true,
        user
      })

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          id: 1,
          email: 'worker@example.com',
          role: 'worker',
          isActive: true
        })
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      const req = { headers: {} }
      const res = {
        json: vi.fn(),
        status: vi.fn(() => res) // Return `res` for method chaining
      }

      res.status(401).json({
        success: false,
        error: 'Authentication required'
      })

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      })
    })
  })
})