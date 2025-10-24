import { vi } from 'vitest'

export interface MockUser {
  id: number
  email: string
  username: string
  telegramId: number
  role: 'worker' | 'client' | 'admin'
  trustScore: number
  balance: number
  isActive: boolean
  createdAt: Date
  lastLogin?: Date
  permissions: string[]
  preferences: Record<string, any>
}

export interface MockSession {
  token: string
  userId: number
  expiresAt: Date
  permissions: string[]
}

export class MockAuthService {
  private users: Map<number, MockUser> = new Map()
  private sessions: Map<string, MockSession> = new Map()
  private userCounter = 1

  constructor() {
    this.initializeUsers()
  }

  private initializeUsers(): void {
    const users: MockUser[] = [
      {
        id: 1,
        email: 'worker@example.com',
        username: 'worker1',
        telegramId: 123456789,
        role: 'worker',
        trustScore: 0.95,
        balance: 1000,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastLogin: new Date(),
        permissions: ['tasks:read', 'tasks:write'],
        preferences: { notifications: true, theme: 'dark' }
      },
      {
        id: 2,
        email: 'client@example.com',
        username: 'client1',
        telegramId: 987654321,
        role: 'client',
        trustScore: 1.0,
        balance: 5000,
        isActive: true,
        createdAt: new Date('2024-01-15'),
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
        permissions: ['projects:read', 'projects:write', 'projects:manage'],
        preferences: { notifications: false, theme: 'light' }
      },
      {
        id: 3,
        email: 'admin@example.com',
        username: 'admin',
        telegramId: 555555555,
        role: 'admin',
        trustScore: 1.0,
        balance: 0,
        isActive: true,
        createdAt: new Date('2023-12-01'),
        lastLogin: new Date(),
        permissions: ['*'], // All permissions
        preferences: { notifications: true, theme: 'auto' }
      }
    ]

    users.forEach(user => this.users.set(user.id, user))
  }

  // Authentication methods
  async authenticate(email: string, password: string): Promise<{ success: boolean; user?: MockUser; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 100)) // Simulate DB query

    const user = Array.from(this.users.values()).find(u => u.email === email)

    if (!user || user.isActive === false) {
      return { success: false, error: 'Invalid credentials' }
    }

    // Simple password check for testing (in production, use proper hashing)
    const validPasswords = ['password123', 'test123', 'admin123']
    if (!validPasswords.includes(password)) {
      return { success: false, error: 'Invalid credentials' }
    }

    // Update last login
    user.lastLogin = new Date()
    this.users.set(user.id, user)

    return { success: true, user }
  }

  async authenticateByTelegram(telegramId: number): Promise<{ success: boolean; user?: MockUser; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 100))

    const user = Array.from(this.users.values()).find(u => u.telegramId === telegramId)

    if (!user || user.isActive === false) {
      return { success: false, error: 'User not found' }
    }

    user.lastLogin = new Date()
    this.users.set(user.id, user)

    return { success: true, user }
  }

  async createToken(userId: number, permissions: string[] = []): Promise<string> {
    const user = this.users.get(userId)
    if (!user) throw new Error('User not found')

    const token = `token_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    this.sessions.set(token, {
      token,
      userId,
      expiresAt,
      permissions: permissions.length > 0 ? permissions : user.permissions
    })

    return token
  }

  async validateToken(token: string): Promise<{ valid: boolean; user?: MockUser; error?: string }> {
    const session = this.sessions.get(token)

    if (!session) {
      return { valid: false, error: 'Invalid token' }
    }

    if (session.expiresAt < new Date()) {
      this.sessions.delete(token)
      return { valid: false, error: 'Token expired' }
    }

    const user = this.users.get(session.userId)
    if (!user || user.isActive === false) {
      this.sessions.delete(token)
      return { valid: false, error: 'User not found or inactive' }
    }

    return { valid: true, user }
  }

  async refreshToken(token: string): Promise<string | null> {
    const session = this.sessions.get(token)
    if (!session) return null

    const user = this.users.get(session.userId)
    if (!user) return null

    // Check if token is close to expiry (within 1 hour)
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now()
    if (timeUntilExpiry > 60 * 60 * 1000) {
      return null // Not ready for refresh
    }

    // Create new token
    this.sessions.delete(token)
    return this.createToken(session.userId, session.permissions)
  }

  async logout(token: string): Promise<boolean> {
    const session = this.sessions.get(token)
    if (!session) return false

    this.sessions.delete(token)
    return true
  }

  async logoutAll(userId: number): Promise<boolean> {
    let loggedOut = 0
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token)
        loggedOut++
      }
    }
    return loggedOut > 0
  }

  // User management
  async createUser(userData: Partial<MockUser>): Promise<MockUser> {
    const newUser: MockUser = {
      id: this.userCounter++,
      email: userData.email || `user${this.userCounter}@example.com`,
      username: userData.username || `user${this.userCounter}`,
      telegramId: userData.telegramId || Math.floor(100000000 + Math.random() * 900000000),
      role: userData.role || 'worker',
      trustScore: userData.trustScore || 0.5,
      balance: userData.balance || 0,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: new Date(),
      lastLogin: undefined,
      permissions: userData.permissions || ['tasks:read'],
      preferences: userData.preferences || {}
    }

    this.users.set(newUser.id, newUser)
    return newUser
  }

  async updateUser(userId: number, updates: Partial<MockUser>): Promise<MockUser | null> {
    const user = this.users.get(userId)
    if (!user) return null

    const updatedUser = { ...user, ...updates }
    this.users.set(userId, updatedUser)
    return updatedUser
  }

  async deleteUser(userId: number): Promise<boolean> {
    const deleted = this.users.delete(userId)

    if (deleted) {
      // Clean up sessions for this user
      for (const [token, session] of this.sessions.entries()) {
        if (session.userId === userId) {
          this.sessions.delete(token)
        }
      }
    }

    return deleted
  }

  // Authorization methods
  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const user = this.users.get(userId)
    if (!user || !user.isActive) return false

    return user.permissions.includes('*') || user.permissions.includes(permission)
  }

  async hasAnyPermission(userId: number, permissions: string[]): Promise<boolean> {
    const user = this.users.get(userId)
    if (!user || !user.isActive) return false

    return user.permissions.includes('*') || permissions.some(p => user.permissions.includes(p))
  }

  // Utility methods
  getUser(userId: number): MockUser | null {
    return this.users.get(userId) || null
  }

  getUserByEmail(email: string): MockUser | null {
    return Array.from(this.users.values()).find(u => u.email === email) || null
  }

  getUserByTelegram(telegramId: number): MockUser | null {
    return Array.from(this.users.values()).find(u => u.telegramId === telegramId) || null
  }

  getAllUsers(): MockUser[] {
    return Array.from(this.users.values())
  }

  getActiveSessions(): MockSession[] {
    return Array.from(this.sessions.values()).filter(s => s.expiresAt > new Date())
  }

  // Test helpers
  static create(): MockAuthService {
    return new MockAuthService()
  }

  reset(): void {
    this.users.clear()
    this.sessions.clear()
    this.userCounter = 1
    this.initializeUsers()
  }

  // Test setup methods
  createTestUser(overrides: Partial<MockUser> = {}): MockUser {
    const user = {
      id: this.userCounter++,
      email: overrides.email || `test${this.userCounter}@example.com`,
      username: overrides.username || `testuser${this.userCounter}`,
      telegramId: overrides.telegramId || Math.floor(100000000 + Math.random() * 900000000),
      role: overrides.role || 'worker',
      trustScore: overrides.trustScore || 0.8,
      balance: overrides.balance || 100,
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
      createdAt: new Date(),
      lastLogin: new Date(),
      permissions: overrides.permissions || ['tasks:read'],
      preferences: overrides.preferences || {}
    }

    this.users.set(user.id, user)
    return user
  }

  createTestSession(userId: number, permissions?: string[]): string {
    return this.createToken(userId, permissions)
  }
}