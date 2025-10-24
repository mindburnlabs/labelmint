import { logger } from '../../utils/logger.js'
import { AuditService } from '../AuditService.js'
import axios from 'axios'
import crypto from 'crypto'

export interface SalesforceConfig {
  instanceUrl: string
  consumerKey: string
  consumerSecret: string
  username: string
  password: string
  securityToken?: string
  sandbox?: boolean
}

export interface SalesforceObject {
  type: string
  fields: Record<string, any>
}

export interface SalesforceQuery {
  soql: string
  limit?: number
  offset?: number
}

export interface SalesforceWebhook {
  name: string
  url: string
  active: boolean
  object: string
  events: string[]
}

export class SalesforceIntegrationService {
  private config: SalesforceConfig
  private organizationId: string
  private accessToken: string | null = null
  private tokenExpiry: number | null = null

  constructor(config: SalesforceConfig, organizationId: string) {
    this.config = config
    this.organizationId = organizationId
  }

  /**
   * Get Salesforce access token using OAuth 2.0 Password Flow
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.consumerKey,
        client_secret: this.config.consumerSecret,
        username: this.config.username,
        password: this.config.password + (this.config.securityToken || '')
      })

      const response = await axios.post(
        `${this.config.instanceUrl}/services/oauth2/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      this.accessToken = response.data.access_token
      // Set expiry to 5 minutes before actual expiry to be safe
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000

      return this.accessToken
    } catch (error) {
      logger.error('Failed to get Salesforce access token', { error: error.message })
      throw new Error('Failed to authenticate with Salesforce')
    }
  }

  /**
   * Make authenticated request to Salesforce API
   */
  private async makeRequest(method: string, endpoint: string, data?: any, params?: any): Promise<any> {
    try {
      const token = await this.getAccessToken()
      const url = `${this.config.instanceUrl}/services/data/v56.0${endpoint}`

      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data,
        params
      })

      return response.data
    } catch (error) {
      if (error.response) {
        logger.error('Salesforce API error', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          endpoint
        })
        throw new Error(`Salesforce API error: ${error.response.data[0]?.message || 'Unknown error'}`)
      }
      throw error
    }
  }

  /**
   * Execute SOQL query
   */
  async query(soql: string, limit?: number): Promise<any> {
    try {
      const limitedSoql = limit ? soql + ` LIMIT ${limit}` : soql
      const response = await this.makeRequest('GET', `/query?q=${encodeURIComponent(limitedSoql)}`)
      return response
    } catch (error) {
      logger.error('Failed to execute Salesforce query', { error: error.message, soql })
      throw error
    }
  }

  /**
   * Create Salesforce object
   */
  async createObject(objectType: string, data: Record<string, any>): Promise<any> {
    try {
      const response = await this.makeRequest('POST', `/sobjects/${objectType}`, data)

      await this.logIntegrationEvent('object_created', {
        objectType,
        objectId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('object_created', {
        objectType,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get Salesforce object
   */
  async getObject(objectType: string, objectId: string, fields?: string[]): Promise<any> {
    try {
      const fieldList = fields ? fields.join(',') : ''
      const endpoint = `/sobjects/${objectType}/${objectId}${fieldList ? `?fields=${fieldList}` : ''}`
      const response = await this.makeRequest('GET', endpoint)
      return response
    } catch (error) {
      logger.error('Failed to get Salesforce object', { error: error.message, objectType, objectId })
      throw error
    }
  }

  /**
   * Update Salesforce object
   */
  async updateObject(objectType: string, objectId: string, data: Record<string, any>): Promise<any> {
    try {
      const response = await this.makeRequest('PATCH', `/sobjects/${objectType}/${objectId}`, data)

      await this.logIntegrationEvent('object_updated', {
        objectType,
        objectId,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('object_updated', {
        objectType,
        objectId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Delete Salesforce object
   */
  async deleteObject(objectType: string, objectId: string): Promise<any> {
    try {
      const response = await this.makeRequest('DELETE', `/sobjects/${objectType}/${objectId}`)

      await this.logIntegrationEvent('object_deleted', {
        objectType,
        objectId,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('object_deleted', {
        objectType,
        objectId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Upsert Salesforce object (update or insert)
   */
  async upsertObject(objectType: string, externalIdField: string, externalId: string, data: Record<string, any>): Promise<any> {
    try {
      const response = await this.makeRequest('PATCH', `/sobjects/${objectType}/${externalIdField}/${externalId}`, data)

      await this.logIntegrationEvent('object_upserted', {
        objectType,
        externalIdField,
        externalId,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('object_upserted', {
        objectType,
        externalIdField,
        externalId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(objectType: string): Promise<any> {
    try {
      const response = await this.makeRequest('GET', `/sobjects/${objectType}/describe`)
      return response
    } catch (error) {
      logger.error('Failed to get Salesforce object metadata', { error: error.message, objectType })
      throw error
    }
  }

  /**
   * Get organization information
   */
  async getOrganizationInfo(): Promise<any> {
    try {
      const response = await this.makeRequest('GET', '/query?q=SELECT+Name,InstanceName,OrganizationType,+TimeZoneSidKey+FROM+Organization')
      return response.records[0]
    } catch (error) {
      logger.error('Failed to get Salesforce organization info', { error: error.message })
      throw error
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<any> {
    try {
      const response = await this.makeRequest('GET', '/query?q=SELECT+Id,Username,Email,Name,TimeZone+FROM+User+WHERE+Username+=+\'${this.config.username}\'')
      return response.records[0]
    } catch (error) {
      logger.error('Failed to get Salesforce user info', { error: error.message })
      throw error
    }
  }

  /**
   * Create lead
   */
  async createLead(lead: {
    FirstName?: string
    LastName?: string
    Email?: string
    Phone?: string
    Company?: string
    Title?: string
    LeadSource?: string
    Status?: string
    Description?: string
    customFields?: Record<string, any>
  }): Promise<any> {
    const leadData = {
      FirstName: lead.FirstName,
      LastName: lead.LastName || 'Unknown',
      Email: lead.Email,
      Phone: lead.Phone,
      Company: lead.Company,
      Title: lead.Title,
      LeadSource: lead.LeadSource || 'Web',
      Status: lead.Status || 'New',
      Description: lead.Description,
      ...lead.customFields
    }

    return this.createObject('Lead', leadData)
  }

  /**
   * Create contact
   */
  async createContact(contact: {
    FirstName?: string
    LastName?: string
    Email?: string
    Phone?: string
    AccountId?: string
    Title?: string
    Description?: string
    customFields?: Record<string, any>
  }): Promise<any> {
    const contactData = {
      FirstName: contact.FirstName,
      LastName: contact.LastName || 'Unknown',
      Email: contact.Email,
      Phone: contact.Phone,
      AccountId: contact.AccountId,
      Title: contact.Title,
      Description: contact.Description,
      ...contact.customFields
    }

    return this.createObject('Contact', contactData)
  }

  /**
   * Create account
   */
  async createAccount(account: {
    Name: string
    Type?: string
    Industry?: string
    Phone?: string
    Website?: string
    Description?: string
    BillingStreet?: string
    BillingCity?: string
    BillingState?: string
    BillingPostalCode?: string
    BillingCountry?: string
    customFields?: Record<string, any>
  }): Promise<any> {
    const accountData = {
      Name: account.Name,
      Type: account.Type,
      Industry: account.Industry,
      Phone: account.Phone,
      Website: account.Website,
      Description: account.Description,
      BillingStreet: account.BillingStreet,
      BillingCity: account.BillingCity,
      BillingState: account.BillingState,
      BillingPostalCode: account.BillingPostalCode,
      BillingCountry: account.BillingCountry,
      ...account.customFields
    }

    return this.createObject('Account', accountData)
  }

  /**
   * Create opportunity
   */
  async createOpportunity(opportunity: {
    Name: string
    AccountId: string
    StageName: string
    Amount?: number
    CloseDate?: string
    Description?: string
    customFields?: Record<string, any>
  }): Promise<any> {
    const opportunityData = {
      Name: opportunity.Name,
      AccountId: opportunity.AccountId,
      StageName: opportunity.StageName,
      Amount: opportunity.Amount,
      CloseDate: opportunity.CloseDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Description: opportunity.Description,
      ...opportunity.customFields
    }

    return this.createObject('Opportunity', opportunityData)
  }

  /**
   * Create case
   */
  async createCase(case_: {
    Subject: string
    Description?: string
    Origin?: string
    Status?: string
    Priority?: string
    ContactId?: string
    AccountId?: string
    customFields?: Record<string, any>
  }): Promise<any> {
    const caseData = {
      Subject: case_.Subject,
      Description: case_.Description,
      Origin: case_.Origin || 'Web',
      Status: case_.Status || 'New',
      Priority: case_.Priority || 'Medium',
      ContactId: case_.ContactId,
      AccountId: case_.AccountId,
      ...case_.customFields
    }

    return this.createObject('Case', caseData)
  }

  /**
   * Get recently viewed items
   */
  async getRecentlyViewed(limit: number = 10): Promise<any[]> {
    try {
      const response = await this.makeRequest('GET', `/query/recent?limit=${limit}`)
      return response.recentItems
    } catch (error) {
      logger.error('Failed to get Salesforce recently viewed items', { error: error.message })
      throw error
    }
  }

  /**
   * Search records
   */
  async search(sosl: string): Promise<any> {
    try {
      const response = await this.makeRequest('GET', `/search?q=${encodeURIComponent(sosl)}`)
      return response
    } catch (error) {
      logger.error('Failed to search Salesforce records', { error: error.message, sosl })
      throw error
    }
  }

  /**
   * Create webhook subscription
   */
  async createWebhook(webhook: {
    name: string
    url: string
    active: boolean
    object: string
    events: string[]
  }): Promise<any> {
    try {
      const webhookData = {
        Name: webhook.name,
        EndpointUrl: webhook.url,
        IsActive: webhook.active,
        EntityId: webhook.object,
        Events: webhook.events.map(event => event.toLowerCase())
      }

      const response = await this.makeRequest('POST', '/sobjects/PushTopic', webhookData)

      await this.logIntegrationEvent('webhook_created', {
        webhookName: webhook.name,
        object: webhook.object,
        events: webhook.events,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('webhook_created', {
        webhookName: webhook.name,
        object: webhook.object,
        events: webhook.events,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get available objects
   */
  async getObjects(): Promise<any[]> {
    try {
      const response = await this.makeRequest('GET', '/sobjects/')
      return response.sobjects
    } catch (error) {
      logger.error('Failed to get Salesforce objects', { error: error.message })
      throw error
    }
  }

  /**
   * Upload file (attachment)
   */
  async uploadFile(parentId: string, fileName: string, fileContent: Buffer, contentType?: string): Promise<any> {
    try {
      const token = await this.getAccessToken()
      const url = `${this.config.instanceUrl}/services/data/v56.0/sobjects/Attachment/`

      const formData = new FormData()
      const blob = new Blob([fileContent], { type: contentType || 'application/octet-stream' })
      formData.append('ParentId', parentId)
      formData.append('Name', fileName)
      formData.append('Body', blob)

      const response = await axios.post(url, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      })

      await this.logIntegrationEvent('file_uploaded', {
        parentId,
        fileName,
        fileSize: fileContent.length,
        success: true
      })

      return response.data
    } catch (error) {
      await this.logIntegrationEvent('file_uploaded', {
        parentId,
        fileName,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Test Salesforce connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const orgInfo = await this.getOrganizationInfo()
      const userInfo = await this.getUserInfo()

      return {
        success: true,
        details: {
          organization: orgInfo.Name,
          instance: orgInfo.InstanceName,
          user: userInfo.Name,
          email: userInfo.Email
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
    objectsCreated: number
    objectsUpdated: number
    filesUploaded: number
    queriesExecuted: number
    webhooksCreated: number
    apiCalls: number
    errors: number
  }> {
    // This would typically query a database table that logs integration usage
    // For now, return mock data
    return {
      objectsCreated: Math.floor(Math.random() * 150),
      objectsUpdated: Math.floor(Math.random() * 300),
      filesUploaded: Math.floor(Math.random() * 50),
      queriesExecuted: Math.floor(Math.random() * 800),
      webhooksCreated: Math.floor(Math.random() * 8),
      apiCalls: Math.floor(Math.random() * 2500),
      errors: Math.floor(Math.random() * 20)
    }
  }

  /**
   * Generate webhook signature
   */
  generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex')
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateWebhookSignature(payload, secret)
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
        action: `SALESFORCE_INTEGRATION_${action.toUpperCase()}`,
        resource: 'integration',
        details: {
          platform: 'salesforce',
          ...details
        }
      })
    } catch (error) {
      logger.error('Failed to log Salesforce integration event', {
        action,
        error: error.message
      })
    }
  }
}