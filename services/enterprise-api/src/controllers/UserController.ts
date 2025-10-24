import { Request, Response, NextFunction } from 'express'
import { UserService } from '../services/UserService.js'
import { logger } from '../utils/logger.js'

export class UserController {
  /**
   * List users for organization
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { page, limit, search, status, role } = req.query

      const result = await UserService.list(organizationId, req.user!.id, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        search: search as string | undefined,
        status: status as string | undefined,
        role: role as string | undefined
      })

      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination
      })
    } catch (error) {
      logger.error('Failed to list organization users', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  /**
   * Get single user
   */
  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, userId } = req.params

      const user = await UserService.get(organizationId, userId, req.user!.id)

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        })
        return
      }

      res.json({
        success: true,
        data: user
      })
    } catch (error) {
      logger.error('Failed to get organization user', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        targetUserId: req.params.userId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  /**
   * Invite or add user
   */
  static async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const payload = req.body

      const user = await UserService.invite(organizationId, req.user!.id, payload)

      res.status(201).json({
        success: true,
        data: user
      })
    } catch (error) {
      logger.error('Failed to invite organization user', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        userId: req.user?.id,
        payload: req.body
      })
      next(error)
    }
  }

  /**
   * Update user membership
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, userId } = req.params
      const payload = req.body

      const user = await UserService.update(
        organizationId,
        userId,
        req.user!.id,
        payload
      )

      res.json({
        success: true,
        data: user
      })
    } catch (error) {
      logger.error('Failed to update organization user', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        targetUserId: req.params.userId,
        userId: req.user?.id,
        payload: req.body
      })
      next(error)
    }
  }

  /**
   * Activate user
   */
  static async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, userId } = req.params

      const user = await UserService.activate(organizationId, userId, req.user!.id)

      res.json({
        success: true,
        data: user
      })
    } catch (error) {
      logger.error('Failed to activate organization user', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        targetUserId: req.params.userId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  /**
   * Deactivate user
   */
  static async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, userId } = req.params
      const { reason } = req.body

      const user = await UserService.deactivate(
        organizationId,
        userId,
        req.user!.id,
        reason
      )

      res.json({
        success: true,
        data: user
      })
    } catch (error) {
      logger.error('Failed to deactivate organization user', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        targetUserId: req.params.userId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  /**
   * Organization user analytics
   */
  static async analytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { range } = req.query
      const rangeDays = range ? parseInt(range as string, 10) : undefined

      const analytics = await UserService.getAnalytics(
        organizationId,
        req.user!.id,
        rangeDays
      )

      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      logger.error('Failed to get user analytics', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  /**
   * User activity timeline
   */
  static async activity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, userId } = req.params
      const { limit, cursor } = req.query

      const result = await UserService.getActivity(
        organizationId,
        userId,
        req.user!.id,
        {
          limit: limit ? parseInt(limit as string, 10) : undefined,
          cursor: cursor as string | undefined
        }
      )

      res.json({
        success: true,
        data: result.items,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor
        }
      })
    } catch (error) {
      logger.error('Failed to get user activity', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        targetUserId: req.params.userId,
        userId: req.user?.id
      })
      next(error)
    }
  }
}
