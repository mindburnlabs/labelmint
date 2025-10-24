import { z } from 'zod'

// ============================================================================
// AUTHENTICATION VALIDATION SCHEMAS
// ============================================================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional()
})

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase, one lowercase, and one number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  languageCode: z.string().length(2, 'Invalid language code').optional(),
  referralCode: z.string().optional()
})

export const TelegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string()
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase, one lowercase, and one number'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase, one lowercase, and one number')
})

export const TwoFactorSetupSchema = z.object({
  token: z.string().length(6, '2FA token must be 6 digits')
})

export const TwoFactorEnableSchema = z.object({
  token: z.string().length(6, '2FA token must be 6 digits'),
  password: z.string().min(1, 'Password is required')
})

export const TwoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required')
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

// ============================================================================
// JWT TOKEN SCHEMAS
// ============================================================================

export const JwtPayloadSchema = z.object({
  sub: z.string(), // user ID
  email: z.string().email().optional(),
  role: z.enum(['WORKER', 'CLIENT', 'ADMIN', 'SUPER_ADMIN']),
  telegramId: z.number().optional(),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string()
})

export const ApiKeySchema = z.object({
  key: z.string().min(32, 'API key must be at least 32 characters'),
  name: z.string().min(1, 'API key name is required'),
  permissions: z.array(z.string()),
  expiresAt: z.date().optional()
})

// ============================================================================
// SESSION SCHEMAS
// ============================================================================

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deviceInfo: z.object({
    deviceId: z.string(),
    deviceType: z.enum(['mobile', 'tablet', 'desktop', 'bot']),
    platform: z.string(),
    browser: z.string().optional(),
    version: z.string().optional(),
    trusted: z.boolean()
  }),
  ipAddress: z.string().ip(),
  userAgent: z.string(),
  isActive: z.boolean(),
  lastAccessedAt: z.date(),
  expiresAt: z.date()
})

export const CreateSessionSchema = z.object({
  deviceInfo: z.object({
    deviceType: z.enum(['mobile', 'tablet', 'desktop', 'bot']),
    platform: z.string(),
    browser: z.string().optional(),
    version: z.string().optional(),
    trusted: z.boolean().default(false)
  }),
  userAgent: z.string().optional()
})

// ============================================================================
// SECURITY SCHEMAS
// ============================================================================

export const SecurityEventSchema = z.object({
  type: z.enum([
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'PASSWORD_CHANGE',
    '2FA_ENABLED',
    '2FA_DISABLED',
    'SESSION_REVOKED',
    'SUSPICIOUS_ACTIVITY',
    'API_KEY_CREATED',
    'API_KEY_REVOKED'
  ]),
  userId: z.string().uuid().optional(),
  ipAddress: z.string().ip(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export const RateLimitSchema = z.object({
  windowMs: z.number().min(1000, 'Window must be at least 1 second'),
  max: z.number().min(1, 'Max requests must be at least 1'),
  message: z.string().optional(),
  standardHeaders: z.boolean().default(true),
  legacyHeaders: z.boolean().default(false)
})

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export const validatePassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
  return passwordRegex.test(password)
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validateUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

export const validateTelegramAuth = (data: any, botToken: string): boolean => {
  // This is a simplified version - in production, you'd verify the hash
  const { hash, ...authData } = data
  const secretKey = crypto.createHash('sha256').update(botToken).digest()

  const checkString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n')

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex')

  return hash === signature
}

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '')
}

export const validateFileUpload = (file: any): boolean => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

  if (file.size > maxSize) return false
  if (!allowedTypes.includes(file.mimetype)) return false

  return true
}