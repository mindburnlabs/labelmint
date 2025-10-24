import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import { SlackIntegrationService } from './integrations/SlackIntegrationService.js'
import { TeamsIntegrationService } from './integrations/TeamsIntegrationService.js'
import { JiraIntegrationService } from './integrations/JiraIntegrationService.js'
import { SalesforceIntegrationService } from './integrations/SalesforceIntegrationService.js'

export type IntegrationType = 'slack' | 'teams' | 'jira' | 'salesforce' | 'webhook'

export interface IntegrationConfig {
  type: IntegrationType
  name: string
  enabled: boolean
  config: any
  organizationId: string
  createdAt: Date
  updatedAt: Date
}

export interface WebhookEvent {
  id: string
  type: string
  payload: any
  headers: Record<string, string>
  timestamp: Date
  processed: boolean
  processingAttempts: number
  lastError?: string
}

export class IntegrationManagerService {
  private static instance: IntegrationManagerService
  private activeIntegrations = new Map<string, any>() // integrationId -> service instance
  private webhooks = new Map<string, any>() // webhookId -> webhook handler

  static getInstance(): IntegrationManagerService {
    if (!this.instance) {
      this.instance = new IntegrationManagerService()
    }
    return this.instance
  }

  /**
   * Initialize integration
   */
  async initializeIntegration(integration: IntegrationConfig): Promise<any> {
    try {
      let service: any

      switch (integration.type) {
        case 'slack':
          service = new SlackIntegrationService(integration.config, integration.organizationId)
          break

        case 'teams':
          service = new TeamsIntegrationService(integration.config, integration.organizationId)
          break

        case 'jira':
          service = new JiraIntegrationService(integration.config, integration.organizationId)
          break

        case 'salesforce':
          service = new SalesforceIntegrationService(integration.config, integration.organizationId)
          break

        default:
          throw new Error(`Unsupported integration type: ${integration.type}`)
      }

      // Test the connection
      const testResult = await service.testConnection()
      if (!testResult.success) {
        throw new Error(`Integration test failed: ${testResult.error}`)
      }

      this.activeIntegrations.set(integration.name, service)

      await AuditService.log({
        organizationId: integration.organizationId,
        userId: 'system',
        action: 'INTEGRATION_INITIALIZED',
        resource: 'integration',
        details: {
          type: integration.type,
          name: integration.name,
          success: true
        }
      })

      logger.info('Integration initialized successfully', {
        type: integration.type,
        name: integration.name,
        organizationId: integration.organizationId
      })

      return service
    } catch (error) {
      await AuditService.log({
        organizationId: integration.organizationId,
        userId: 'system',
        action: 'INTEGRATION_INITIALIZED',
        resource: 'integration',
        details: {
          type: integration.type,
          name: integration.name,
          success: false,
          error: error.message
        }
      })

      logger.error('Failed to initialize integration', {
        type: integration.type,
        name: integration.name,
        organizationId: integration.organizationId,
        error: error.message
      })

      throw error
    }
  }

  /**
   * Get integration service
   */
  getIntegration(name: string): any {
    return this.activeIntegrations.get(name)
  }

  /**
   * Get all active integrations
   */
  getActiveIntegrations(): Map<string, any> {
    return new Map(this.activeIntegrations)
  }

  /**
   * Remove integration
   */
  removeIntegration(name: string, organizationId: string): void {
    const service = this.activeIntegrations.get(name)
    if (service) {
      this.activeIntegrations.delete(name)

      AuditService.log({
        organizationId,
        userId: 'system',
        action: 'INTEGRATION_REMOVED',
        resource: 'integration',
        details: {
          name,
          success: true
        }
      })

      logger.info('Integration removed', { name, organizationId })
    }
  }

  /**
   * Test integration
   */
  async testIntegration(integration: IntegrationConfig): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      let service: any

      switch (integration.type) {
        case 'slack':
          service = new SlackIntegrationService(integration.config, integration.organizationId)
          break

        case 'teams':
          service = new TeamsIntegrationService(integration.config, integration.organizationId)
          break

        case 'jira':
          service = new JiraIntegrationService(integration.config, integration.organizationId)
          break

        case 'salesforce':
          service = new SalesforceIntegrationService(integration.config, integration.organizationId)
          break

        default:
          return {
            success: false,
            error: `Unsupported integration type: ${integration.type}`
          }
      }

      return await service.testConnection()
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get integration templates
   */
  getIntegrationTemplates(): Record<IntegrationType, {
    name: string
    description: string
    icon: string
    category: string
    configSchema: any
    requiredFields: string[]
  }> {
    return {
      slack: {
        name: 'Slack',
        description: 'Send messages, create channels, and manage team communication',
        icon: '💬',
        category: 'Communication',
        configSchema: {
          type: 'object',
          properties: {
            botToken: { type: 'string', description: 'Bot User OAuth Token' },
            signingSecret: { type: 'string', description: 'Signing Secret for webhooks' },
            clientId: { type: 'string', description: 'Client ID' },
            clientSecret: { type: 'string', description: 'Client Secret' }
          },
          required: ['botToken', 'signingSecret']
        },
        requiredFields: ['botToken', 'signingSecret']
      },

      teams: {
        name: 'Microsoft Teams',
        description: 'Send messages, create teams, and manage Microsoft Teams workspace',
        icon: '👥',
        category: 'Communication',
        configSchema: {
          type: 'object',
          properties: {
            clientId: { type: 'string', description: 'Application (client) ID' },
            clientSecret: { type: 'string', description: 'Client secret value' },
            tenantId: { type: 'string', description: 'Directory (tenant) ID' },
            redirectUri: { type: 'string', description: 'Redirect URI' }
          },
          required: ['clientId', 'clientSecret', 'tenantId']
        },
        requiredFields: ['clientId', 'clientSecret', 'tenantId']
      },

      jira: {
        name: 'Jira',
        description: 'Create issues, manage projects, and track development work',
        icon: '🎯',
        category: 'Project Management',
        configSchema: {
          type: 'object',
          properties: {
            baseUrl: { type: 'string', description: 'Jira instance URL' },
            username: { type: 'string', description: 'Username or email' },
            apiToken: { type: 'string', description: 'API token' },
            cloud: { type: 'boolean', description: 'Is Jira Cloud instance' }
          },
          required: ['baseUrl', 'username', 'apiToken']
        },
        requiredFields: ['baseUrl', 'username', 'apiToken']
      },

      salesforce: {
        name: 'Salesforce',
        description: 'Manage CRM data, create leads, and track customer relationships',
        icon: '☁️',
        category: 'CRM',
        configSchema: {
          type: 'object',
          properties: {
            instanceUrl: { type: 'string', description: 'Salesforce instance URL' },
            consumerKey: { type: 'string', description: 'Consumer Key' },
            consumerSecret: { type: 'string', description: 'Consumer Secret' },
            username: { type: 'string', description: 'Username' },
            password: { type: 'string', description: 'Password' },
            securityToken: { type: 'string', description: 'Security Token' },
            sandbox: { type: 'boolean', description: 'Is sandbox instance' }
          },
          required: ['instanceUrl', 'consumerKey', 'consumerSecret', 'username', 'password']
        },
        requiredFields: ['instanceUrl', 'consumerKey', 'consumerSecret', 'username', 'password']
      },

      webhook: {
        name: 'Webhook',
        description: 'Receive webhooks from external services',
        icon: '🔗',
        category: 'Integration',
        configSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Webhook URL' },
            secret: { type: 'string', description: 'Webhook secret for signature verification' },
            events: { type: 'array', items: { type: 'string' }, description: 'Events to listen for' }
          },
          required: ['url']
        },
        requiredFields: ['url']
      }
    }
  }

  /**
   * Get available integration types
   */
  getAvailableIntegrations(): Array<{
    type: IntegrationType
    name: string
    description: string
    icon: string
    category: string
    features: string[]
  }> {
    const templates = this.getIntegrationTemplates()

    return Object.entries(templates).map(([type, template]) => ({
      type: type as IntegrationType,
      name: template.name,
      description: template.description,
      icon: template.icon,
      category: template.category,
      features: this.getIntegrationFeatures(type as IntegrationType)
    }))
  }

  /**
   * Get integration features
   */
  private getIntegrationFeatures(type: IntegrationType): string[] {
    const features: Record<IntegrationType, string[]> = {
      slack: [
        'Send messages',
        'Create channels',
        'Upload files',
        'User management',
        'Webhook support'
      ],
      teams: [
        'Send chat messages',
        'Create teams and channels',
        'Online meetings',
        'File sharing',
        'User management'
      ],
      jira: [
        'Create and update issues',
        'Project management',
        'Work logging',
        'File attachments',
        'Custom workflows'
      ],
      salesforce: [
        'CRM object management',
        'Lead and contact creation',
        'Opportunity tracking',
        'Custom objects',
        'Report generation'
      ],
      webhook: [
        'Event reception',
        'Signature verification',
        'Custom processing',
        'Retry mechanisms',
        'Event filtering'
      ]
    }

    return features[type] || []
  }

  /**
   * Get integration usage statistics
   */
  async getUsageStats(organizationId: string, days: number = 30): Promise<{
    totalIntegrations: number
    activeIntegrations: number
    totalApiCalls: number
    totalErrors: number
    integrations: Array<{
      type: IntegrationType
      name: string
      apiCalls: number
      errors: number
      lastUsed: Date
    }>
  }> {
    const integrationStats = []

    for (const [name, service] of this.activeIntegrations) {
      try {
        const stats = await service.getUsageStats(days)
        integrationStats.push({
          type: this.detectIntegrationType(service),
          name,
          apiCalls: stats.apiCalls,
          errors: stats.errors,
          lastUsed: new Date() // This would come from actual usage tracking
        })
      } catch (error) {
        logger.error('Failed to get integration usage stats', {
          name,
          error: error.message
        })
      }
    }

    const totalApiCalls = integrationStats.reduce((sum, stat) => sum + stat.apiCalls, 0)
    const totalErrors = integrationStats.reduce((sum, stat) => sum + stat.errors, 0)

    return {
      totalIntegrations: this.activeIntegrations.size,
      activeIntegrations: this.activeIntegrations.size,
      totalApiCalls,
      totalErrors,
      integrations: integrationStats
    }
  }

  /**
   * Detect integration type from service instance
   */
  private detectIntegrationType(service: any): IntegrationType {
    if (service instanceof SlackIntegrationService) return 'slack'
    if (service instanceof TeamsIntegrationService) return 'teams'
    if (service instanceof JiraIntegrationService) return 'jira'
    if (service instanceof SalesforceIntegrationService) return 'salesforce'
    return 'webhook'
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      // Find matching webhook handlers
      const matchingWebhooks = Array.from(this.webhooks.values()).filter(webhook =>
        webhook.event === event.type && webhook.enabled
      )

      for (const webhook of matchingWebhooks) {
        try {
          await webhook.handler(event.payload, event.headers)

          await AuditService.log({
            organizationId: webhook.organizationId,
            userId: 'system',
            action: 'WEBHOOK_PROCESSED',
            resource: 'webhook',
            details: {
              eventId: event.id,
              type: event.type,
              webhookId: webhook.id,
              success: true
            }
          })
        } catch (error) {
          await AuditService.log({
            organizationId: webhook.organizationId,
            userId: 'system',
            action: 'WEBHOOK_PROCESSED',
            resource: 'webhook',
            details: {
              eventId: event.id,
              type: event.type,
              webhookId: webhook.id,
              success: false,
              error: error.message
            }
          })
        }
      }

      // Mark event as processed
      event.processed = true
    } catch (error) {
      logger.error('Failed to process webhook event', {
        eventId: event.id,
        error: error.message
      })
    }
  }

  /**
   * Register webhook handler
   */
  registerWebhook(id: string, config: {
    event: string
    handler: (payload: any, headers: Record<string, string>) => Promise<void>
    organizationId: string
    enabled: boolean
  }): void {
    this.webhooks.set(id, config)
    logger.info('Webhook handler registered', { id, event: config.event })
  }

  /**
   * Remove webhook handler
   */
  removeWebhook(id: string): void {
    this.webhooks.delete(id)
    logger.info('Webhook handler removed', { id })
  }

  /**
   * Health check for all integrations
   */
  async healthCheck(): Promise<{
    healthy: boolean
    integrations: Array<{
      name: string
      type: IntegrationType
      status: 'healthy' | 'unhealthy'
      lastCheck: Date
      error?: string
    }>
  }> {
    const results = []
    let overallHealthy = true

    for (const [name, service] of this.activeIntegrations) {
      try {
        const testResult = await service.testConnection()
        results.push({
          name,
          type: this.detectIntegrationType(service),
          status: testResult.success ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          error: testResult.success ? undefined : testResult.error
        })

        if (!testResult.success) {
          overallHealthy = false
        }
      } catch (error) {
        results.push({
          name,
          type: this.detectIntegrationType(service),
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error.message
        })
        overallHealthy = false
      }
    }

    return {
      healthy: overallHealthy,
      integrations: results
    }
  }
}

export const integrationManager = IntegrationManagerService.getInstance()