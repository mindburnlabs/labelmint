import { Request, Response, NextFunction } from 'express'
import { ProjectService } from '../services/ProjectService.js'
import { logger } from '../utils/logger.js'

export class ProjectController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const { page, limit, status, teamId, search, includeArchived } = req.query

      const result = await ProjectService.list(organizationId, req.user!.id, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        status: status as string | undefined,
        teamId: teamId as string | undefined,
        search: search as string | undefined,
        includeArchived: includeArchived === 'true'
      })

      res.json({
        success: true,
        data: result.projects,
        pagination: result.pagination
      })
    } catch (error) {
      logger.error('Failed to list projects', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId } = req.params
      const project = await ProjectService.getById(organizationId, projectId, req.user!.id)

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        })
        return
      }

      res.json({
        success: true,
        data: project
      })
    } catch (error) {
      logger.error('Failed to get project', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const project = await ProjectService.create(organizationId, req.user!.id, req.body)

      res.status(201).json({
        success: true,
        data: project
      })
    } catch (error) {
      logger.error('Failed to create project', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        userId: req.user?.id,
        payload: req.body
      })
      next(error)
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId } = req.params
      const project = await ProjectService.update(
        organizationId,
        projectId,
        req.user!.id,
        req.body
      )

      res.json({
        success: true,
        data: project
      })
    } catch (error) {
      logger.error('Failed to update project', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id,
        payload: req.body
      })
      next(error)
    }
  }

  static async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId } = req.params
      await ProjectService.archive(organizationId, projectId, req.user!.id)

      res.json({
        success: true,
        message: 'Project archived successfully'
      })
    } catch (error) {
      logger.error('Failed to archive project', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  static async restore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId } = req.params
      await ProjectService.restore(organizationId, projectId, req.user!.id)

      res.json({
        success: true,
        message: 'Project restored successfully'
      })
    } catch (error) {
      logger.error('Failed to restore project', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  static async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId } = req.params
      const member = await ProjectService.addMember(
        organizationId,
        projectId,
        req.user!.id,
        req.body,
        req.user!.id
      )

      res.status(201).json({
        success: true,
        data: member
      })
    } catch (error) {
      logger.error('Failed to add project member', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id,
        payload: req.body
      })
      next(error)
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId, memberId } = req.params
      await ProjectService.removeMember(organizationId, projectId, memberId, req.user!.id)

      res.json({
        success: true,
        message: 'Project member removed successfully'
      })
    } catch (error) {
      logger.error('Failed to remove project member', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id,
        memberId: req.params.memberId
      })
      next(error)
    }
  }

  static async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId } = req.params
      const members = await ProjectService.listMembers(
        organizationId,
        projectId,
        req.user!.id
      )

      res.json({
        success: true,
        data: members
      })
    } catch (error) {
      logger.error('Failed to list project members', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id
      })
      next(error)
    }
  }

  static async analytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId, projectId } = req.params
      const { range } = req.query
      const rangeDays = range ? parseInt(range as string, 10) : undefined

      const analytics = await ProjectService.getAnalytics(
        organizationId,
        projectId,
        req.user!.id,
        rangeDays
      )

      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      logger.error('Failed to get project analytics', {
        error: (error as Error).message,
        organizationId: req.params.organizationId,
        projectId: req.params.projectId,
        userId: req.user?.id
      })
      next(error)
    }
  }
}
