import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthenticatedRequest extends Request {
  user?: {
    id?: string
    email?: string
    organizationId?: string
    role?: string
  }
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { message: 'Access token required' }
    })
    return
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured')
    }

    const decoded = jwt.verify(token, jwtSecret) as any
    req.user = {
      id: decoded.id,
      email: decoded.email,
      organizationId: decoded.organizationId,
      role: decoded.role
    }

    next()
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' }
    })
  }
}