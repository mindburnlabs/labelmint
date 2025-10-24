import { logger } from '../../utils/logger.js'
import { AuditService } from '../AuditService.js'
import axios from 'axios'
import crypto from 'crypto'

export interface JiraConfig {
  baseUrl: string
  username: string
  apiToken: string
  email?: string
  cloud?: boolean
}

export interface JiraIssue {
  summary: string
  description?: string
  issueType: string
  priority?: string
  assignee?: string
  reporter?: string
  labels?: string[]
  components?: string[]
  fixVersions?: string[]
  dueDate?: string
  customFields?: Record<string, any>
}

export interface JiraProject {
  key: string
  name: string
  description?: string
  lead?: string
  issueTypes?: string[]
}

export interface JiraComment {
  body: string
  author?: string
  visibility?: {
    type: string
    value: string
  }
}

export class JiraIntegrationService {
  private config: JiraConfig
  private organizationId: string
  private authHeader: string

  constructor(config: JiraConfig, organizationId: string) {
    this.config = config
    this.organizationId = organizationId

    // Jira Cloud uses email for authentication, Server uses username
    const userIdentifier = config.cloud ? config.email : config.username
    this.authHeader = Buffer.from(`${userIdentifier}:${config.apiToken}`).toString('base64')
  }

  /**
   * Make authenticated request to Jira API
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    try {
      const url = `${this.config.baseUrl}/rest/api/3${endpoint}`

      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Basic ${this.authHeader}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data
      })

      return response.data
    } catch (error) {
      if (error.response) {
        const jiraError = error.response.data
        logger.error('Jira API error', {
          status: error.response.status,
          statusText: error.response.statusText,
          errors: jiraError.errors || jiraError.errorMessages,
          endpoint
        })
        throw new Error(`Jira API error: ${jiraError.errorMessages?.[0] || jiraError.errors || 'Unknown error'}`)
      }
      throw error
    }
  }

  /**
   * Create issue
   */
  async createIssue(projectKey: string, issue: JiraIssue): Promise<any> {
    try {
      const payload = {
        fields: {
          project: { key: projectKey },
          summary: issue.summary,
          description: issue.description ? {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: issue.description
              }]
            }]
          } : undefined,
          issuetype: { name: issue.issueType },
          priority: issue.priority ? { name: issue.priority } : undefined,
          assignee: issue.assignee ? { name: issue.assignee } : undefined,
          reporter: issue.reporter ? { name: issue.reporter } : undefined,
          labels: issue.labels,
          components: issue.components?.map(name => ({ name })),
          fixVersions: issue.fixVersions?.map(name => ({ name })),
          duedate: issue.dueDate,
          ...issue.customFields
        }
      }

      const response = await this.makeRequest('POST', '/issue', payload)

      await this.logIntegrationEvent('issue_created', {
        projectKey,
        issueKey: response.key,
        issueId: response.id,
        summary: issue.summary,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('issue_created', {
        projectKey,
        summary: issue.summary,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get issue
   */
  async getIssue(issueKeyOrId: string): Promise<any> {
    try {
      const response = await this.makeRequest('GET', `/issue/${issueKeyOrId}`)
      return response
    } catch (error) {
      logger.error('Failed to get Jira issue', { error: error.message, issueKeyOrId })
      throw error
    }
  }

  /**
   * Update issue
   */
  async updateIssue(issueKeyOrId: string, update: Partial<JiraIssue>): Promise<any> {
    try {
      const payload: any = {}

      if (update.summary) {
        payload.summary = update.summary
      }

      if (update.description) {
        payload.description = {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: update.description
            }]
          }]
        }
      }

      if (update.priority) {
        payload.priority = { name: update.priority }
      }

      if (update.assignee) {
        payload.assignee = update.assignee ? { name: update.assignee } : null
      }

      if (update.labels) {
        payload.labels = update.labels
      }

      if (update.components) {
        payload.components = update.components.map(name => ({ name }))
      }

      if (update.dueDate) {
        payload.duedate = update.dueDate
      }

      const response = await this.makeRequest('PUT', `/issue/${issueKeyOrId}`, { fields: payload })

      await this.logIntegrationEvent('issue_updated', {
        issueKeyOrId,
        update,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('issue_updated', {
        issueKeyOrId,
        update,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Add comment to issue
   */
  async addComment(issueKeyOrId: string, comment: JiraComment): Promise<any> {
    try {
      const payload = {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: comment.body
            }]
          }]
        },
        visibility: comment.visibility
      }

      const response = await this.makeRequest('POST', `/issue/${issueKeyOrId}/comment`, payload)

      await this.logIntegrationEvent('comment_added', {
        issueKeyOrId,
        commentId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('comment_added', {
        issueKeyOrId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Transition issue (change status)
   */
  async transitionIssue(issueKeyOrId: string, transitionName: string, comment?: string): Promise<any> {
    try {
      // Get available transitions
      const transitions = await this.makeRequest('GET', `/issue/${issueKeyOrId}/transitions`)
      const transition = transitions.transitions.find((t: any) => t.name === transitionName)

      if (!transition) {
        throw new Error(`Transition '${transitionName}' not available for issue ${issueKeyOrId}`)
      }

      const payload: any = {
        transition: { id: transition.id }
      }

      if (comment) {
        payload.update = {
          comment: [{
            add: {
              body: {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{
                    type: 'text',
                    text: comment
                  }]
                }]
              }
            }
          }]
        }
      }

      const response = await this.makeRequest('POST', `/issue/${issueKeyOrId}/transitions`, payload)

      await this.logIntegrationEvent('issue_transitioned', {
        issueKeyOrId,
        transition: transitionName,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('issue_transitioned', {
        issueKeyOrId,
        transition: transitionName,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Search issues
   */
  async searchIssues(jql: string, startAt: number = 0, maxResults: number = 50): Promise<any> {
    try {
      const payload = {
        jql,
        startAt,
        maxResults,
        fields: ['summary', 'status', 'assignee', 'priority', 'created', 'updated', 'project']
      }

      const response = await this.makeRequest('POST', '/search', payload)
      return response
    } catch (error) {
      logger.error('Failed to search Jira issues', { error: error.message, jql })
      throw error
    }
  }

  /**
   * Get projects
   */
  async getProjects(): Promise<JiraProject[]> {
    try {
      const response = await this.makeRequest('GET', '/project')
      return response
    } catch (error) {
      logger.error('Failed to get Jira projects', { error: error.message })
      throw error
    }
  }

  /**
   * Get project details
   */
  async getProject(projectKey: string): Promise<JiraProject> {
    try {
      const response = await this.makeRequest('GET', `/project/${projectKey}`)
      return response
    } catch (error) {
      logger.error('Failed to get Jira project', { error: error.message, projectKey })
      throw error
    }
  }

  /**
   * Get users
   */
  async getUsers(startAt: number = 0, maxResults: number = 50): Promise<any[]> {
    try {
      const response = await this.makeRequest('GET', `/users/search?startAt=${startAt}&maxResults=${maxResults}`)
      return response
    } catch (error) {
      logger.error('Failed to get Jira users', { error: error.message })
      throw error
    }
  }

  /**
   * Create project
   */
  async createProject(project: {
    key: string
    name: string
    description?: string
    lead: string
    issueTypeScheme?: string
    workflowScheme?: string
  }): Promise<any> {
    try {
      const payload = {
        key: project.key,
        name: project.name,
        description: project.description,
        lead: { name: project.lead },
        type: 'software',
        projectTypeKey: 'software'
      }

      const response = await this.makeRequest('POST', '/project', payload)

      await this.logIntegrationEvent('project_created', {
        projectKey: project.key,
        projectName: project.name,
        projectId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('project_created', {
        projectKey: project.key,
        projectName: project.name,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get issue types
   */
  async getIssueTypes(projectKey?: string): Promise<any[]> {
    try {
      const endpoint = projectKey ? `/project/${projectKey}/statuses` : '/issuetype'
      const response = await this.makeRequest('GET', endpoint)
      return projectKey ? response : response.issueTypes
    } catch (error) {
      logger.error('Failed to get Jira issue types', { error: error.message, projectKey })
      throw error
    }
  }

  /**
   * Get priorities
   */
  async getPriorities(): Promise<any[]> {
    try {
      const response = await this.makeRequest('GET', '/priority')
      return response
    } catch (error) {
      logger.error('Failed to get Jira priorities', { error: error.message })
      throw error
    }
  }

  /**
   * Add attachment to issue
   */
  async addAttachment(issueKeyOrId: string, fileName: string, fileContent: Buffer, contentType?: string): Promise<any> {
    try {
      const url = `${this.config.baseUrl}/rest/api/3/issue/${issueKeyOrId}/attachments`

      const formData = new FormData()
      const blob = new Blob([fileContent], { type: contentType || 'application/octet-stream' })
      formData.append('file', blob, fileName)

      const response = await axios.post(url, formData, {
        headers: {
          'Authorization': `Basic ${this.authHeader}`,
          'X-Atlassian-Token': 'no-check'
        }
      })

      await this.logIntegrationEvent('attachment_added', {
        issueKeyOrId,
        fileName,
        fileSize: fileContent.length,
        success: true
      })

      return response.data
    } catch (error) {
      await this.logIntegrationEvent('attachment_added', {
        issueKeyOrId,
        fileName,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get worklogs for issue
   */
  async getWorklogs(issueKeyOrId: string): Promise<any> {
    try {
      const response = await this.makeRequest('GET', `/issue/${issueKeyOrId}/worklog`)
      return response
    } catch (error) {
      logger.error('Failed to get Jira worklogs', { error: error.message, issueKeyOrId })
      throw error
    }
  }

  /**
   * Add worklog to issue
   */
  async addWorklog(issueKeyOrId: string, worklog: {
    timeSpent: string
    comment?: string
    started?: string
  }): Promise<any> {
    try {
      const payload = {
        timeSpent: worklog.timeSpent,
        comment: worklog.comment ? {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: worklog.comment
            }]
          }]
        } : undefined,
        started: worklog.started
      }

      const response = await this.makeRequest('POST', `/issue/${issueKeyOrId}/worklog`, payload)

      await this.logIntegrationEvent('worklog_added', {
        issueKeyOrId,
        timeSpent: worklog.timeSpent,
        worklogId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('worklog_added', {
        issueKeyOrId,
        timeSpent: worklog.timeSpent,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Test Jira connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const response = await this.makeRequest('GET', '/myself')
      return {
        success: true,
        details: {
          user: response.displayName,
          email: response.emailAddress,
          timezone: response.timeZone
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get integration usage statistics
   */
  async getUsageStats(days: number = 30): Promise<{
    issuesCreated: number
    commentsAdded: number
    attachmentsUploaded: number
    worklogsAdded: number
    projectsCreated: number
    apiCalls: number
    errors: number
  }> {
    // This would typically query a database table that logs integration usage
    // For now, return mock data
    return {
      issuesCreated: Math.floor(Math.random() * 200),
      commentsAdded: Math.floor(Math.random() * 500),
      attachmentsUploaded: Math.floor(Math.random() * 150),
      worklogsAdded: Math.floor(Math.random() * 100),
      projectsCreated: Math.floor(Math.random() * 3),
      apiCalls: Math.floor(Math.random() * 2000),
      errors: Math.floor(Math.random() * 25)
    }
  }

  /**
   * Generate webhook URL
   */
  generateWebhookUrl(secret: string): string {
    const timestamp = Date.now()
    const signature = crypto.createHmac('sha256', secret)
      .update(`${timestamp}`)
      .digest('hex')

    return `${process.env.BASE_URL}/api/v1/integrations/jira/webhook?timestamp=${timestamp}&signature=${signature}`
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(timestamp: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(timestamp)
      .digest('hex')

    // Check if timestamp is within 5 minutes
    const timeDiff = Math.abs(Date.now() - parseInt(timestamp))
    if (timeDiff > 5 * 60 * 1000) {
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Log integration events
   */
  private async logIntegrationEvent(action: string, details: any): Promise<void> {
    try {
      await AuditService.log({
        organizationId: this.organizationId,
        userId: 'system',
        action: `JIRA_INTEGRATION_${action.toUpperCase()}`,
        resource: 'integration',
        details: {
          platform: 'jira',
          ...details
        }
      })
    } catch (error) {
      logger.error('Failed to log Jira integration event', {
        action,
        error: error.message
      })
    }
  }
}