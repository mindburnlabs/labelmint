import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { DirectoryService, DirectoryConfig } from '../services/DirectoryService.js'
import { logger } from '../utils/logger.js'
import { AuditService } from '../services/AuditService.js'

export class DirectoryController {

  /**
   * Test LDAP connection
   */
  static async testConnection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const config = req.body as DirectoryConfig
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const result = await DirectoryService.testConnection(organizationId, config)

      // Log the test
      await AuditService.log({
        organizationId,
        userId: userId || '',
        resource: 'directory',
        details: {
          provider: config.provider,
          success: result.success,
          url: config.config.url
        }
      })

      res.json({
        success: true,
        data: result,
        message: result.success ? 'Connection test successful' : 'Connection test failed'
      })
    } catch (error) {
      logger.error('Directory connection test error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Authenticate user against directory
   */
  static async authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const { config, username, password } = req.body
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const result = await DirectoryService.authenticateUser(organizationId, config, username, password)

      // Log authentication attempt
      await AuditService.log({
        organizationId,
        userId: userId || '',
        action: 'DIRECTORY_AUTHENTICATION',
        resource: 'directory',
        details: {
          username,
          success: result.success,
          provider: config.provider
        }
      })

      res.json({
        success: true,
        data: result,
        message: result.success ? 'Authentication successful' : 'Authentication failed'
      })
    } catch (error) {
      logger.error('Directory authentication error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Sync users from directory
   */
  static async syncUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const config = req.body as DirectoryConfig
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      const result = await DirectoryService.syncUsers(organizationId, config)

      // Log sync operation
      await AuditService.log({
        organizationId,
        userId,
        action: 'DIRECTORY_SYNC',
        resource: 'directory',
        details: {
          synced: result.synced,
          errors: result.errors.length,
          provider: config.provider
        }
      })

      res.json({
        success: true,
        data: result,
        message: `Sync completed: ${result.synced} users synced`
      })
    } catch (error) {
      logger.error('Directory sync error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Start automatic sync
   */
  static async startAutoSync(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const config = req.body as DirectoryConfig
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      DirectoryService.startAutoSync(organizationId, config)

      // Log auto sync start
      await AuditService.log({
        organizationId,
        userId,
        action: 'DIRECTORY_AUTO_SYNC_START',
        resource: 'directory',
        details: {
          interval: config.config.syncInterval,
          provider: config.provider
        }
      })

      res.json({
        success: true,
        message: 'Automatic sync started'
      })
    } catch (error) {
      logger.error('Start auto sync error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Stop automatic sync
   */
  static async stopAutoSync(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const userId = req.user?.id

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        })
        return
      }

      DirectoryService.stopAutoSync(organizationId)

      // Log auto sync stop
      await AuditService.log({
        organizationId,
        userId,
        action: 'DIRECTORY_AUTO_SYNC_STOP',
        resource: 'directory',
        details: {}
      })

      res.json({
        success: true,
        message: 'Automatic sync stopped'
      })
    } catch (error) {
      logger.error('Stop auto sync error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }

      const status = await DirectoryService.getSyncStatus(organizationId)

      res.json({
        success: true,
        data: status,
        message: 'Sync status retrieved successfully'
      })
    } catch (error) {
      logger.error('Get sync status error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Search directory users
   */
  static async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }
      const { config, query, limit = 50 } = req.body

      const users = await DirectoryService.searchUsers(organizationId, config, query, limit)

      res.json({
        success: true,
        data: {
          users,
          count: users.length
        },
        message: 'Directory users retrieved successfully'
      })
    } catch (error) {
      logger.error('Search directory users error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get directory user count
   */
  static async getUserCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID is required'
        })
        return
      }

      // This would require a database query to count directory users
      // For now, return a placeholder implementation
      const userCount = 0 // Would be implemented with actual database query

      res.json({
        success: true,
        data: { userCount },
        message: 'Directory user count retrieved successfully'
      })
    } catch (error) {
      logger.error('Get directory user count error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Get directory configuration template
   */
  static async getConfigTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params

      let template: DirectoryConfig

      switch (provider) {
        case 'active-directory':
          template = {
            provider: 'ldap',
            enabled: true,
            config: {
              url: '',
              bindDN: '',
              bindCredentials: '',
              searchBase: '',
              searchFilter: '(sAMAccountName={{username}})',
              attributes: ['mail', 'givenName', 'sn', 'displayName', 'memberOf', 'userPrincipalName'],
              attributeMapping: {
                email: 'mail',
                firstName: 'givenName',
                lastName: 'sn',
                displayName: 'displayName',
                username: 'sAMAccountName',
                groups: 'memberOf'
              },
              secureLDAP: true,
              port: 636,
              connectionTimeout: 5000,
              pageSize: 1000,
              syncInterval: 3600000, // 1 hour
              groupSearchBase: '',
              groupSearchFilter: '(objectClass=group)',
              groupMemberAttribute: 'member'
            }
          }
          break

        case 'openldap':
          template = {
            provider: 'ldap',
            enabled: true,
            config: {
              url: '',
              bindDN: '',
              bindCredentials: '',
              searchBase: '',
              searchFilter: '(uid={{username}})',
              attributes: ['mail', 'givenName', 'sn', 'cn', 'memberOf'],
              attributeMapping: {
                email: 'mail',
                firstName: 'givenName',
                lastName: 'sn',
                displayName: 'cn',
                username: 'uid',
                groups: 'memberOf'
              },
              secureLDAP: false,
              port: 389,
              connectionTimeout: 5000,
              pageSize: 1000,
              syncInterval: 3600000
            }
          }
          break

        default:
          res.status(400).json({
            success: false,
            error: 'Invalid provider. Supported providers: active-directory, openldap'
          })
          return
      }

      res.json({
        success: true,
        data: template,
        message: 'Directory configuration template retrieved successfully'
      })
    } catch (error) {
      logger.error('Get directory config template error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }

  /**
   * Validate directory configuration
   */
  static async validateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = req.body as DirectoryConfig

      const errors: string[] = []

      if (!config.config.url) errors.push('LDAP URL is required')
      if (!config.config.bindDN) errors.push('Bind DN is required')
      if (!config.config.bindCredentials) errors.push('Bind credentials are required')
      if (!config.config.searchBase) errors.push('Search base is required')
      if (!config.config.searchFilter) errors.push('Search filter is required')
      if (!config.config.attributes || config.config.attributes.length === 0) {
        errors.push('At least one attribute must be specified')
      }

      // Validate URL format
      try {
        new URL(config.config.secureLDAP ? `ldaps://${config.config.url}` : `ldap://${config.config.url}`)
      } catch {
        errors.push('Invalid LDAP URL format')
      }

      // Validate search filter format
      if (config.config.searchFilter && !config.config.searchFilter.includes('{{username}}')) {
        errors.push('Search filter must include {{username}} placeholder')
      }

      res.json({
        success: errors.length === 0,
        data: {
          valid: errors.length === 0,
          errors
        },
        message: errors.length === 0 ? 'Configuration is valid' : 'Configuration validation failed'
      })
    } catch (error) {
      logger.error('Validate directory config error', { error: error instanceof Error ? error.message : String(error) })
      next(error)
    }
  }
}