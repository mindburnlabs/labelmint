import { prisma } from '../app.js'
import { logger } from '../utils/logger.js'
import { AuditService } from './AuditService.js'
import * as ldap from 'ldapjs'
import { SSOConfig } from './SSOService.js'

export interface DirectoryConfig extends SSOConfig {
  provider: 'ldap'
  config: {
    url: string
    bindDN: string
    bindCredentials: string
    searchBase: string
    searchFilter: string
    attributes: string[]
    attributeMapping: Record<string, string>
    secureLDAP?: boolean
    port?: number
    connectionTimeout?: number
    pageSize?: number
    syncInterval?: number
    groupSearchBase?: string
    groupSearchFilter?: string
    groupMemberAttribute?: string
  }
}

export interface DirectoryUser {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  displayName?: string
  department?: string
  title?: string
  phone?: string
  groups: string[]
  isActive: boolean
  lastSyncAt?: Date
  externalId: string
}

export interface DirectoryGroup {
  id: string
  name: string
  description?: string
  members: string[]
  dn: string
  lastSyncAt?: Date
}

export class DirectoryService {
  private static clients = new Map<string, ldap.Client>()
  private static syncIntervals = new Map<string, NodeJS.Timeout>()

  /**
   * Create and configure LDAP client
   */
  private static createClient(config: DirectoryConfig): ldap.Client {
    const clientUrl = config.config.secureLDAP
      ? `ldaps://${config.config.url}:${config.config.port || 636}`
      : `ldap://${config.config.url}:${config.config.port || 389}`

    const client = ldap.createClient({
      url: clientUrl,
      timeout: config.config.connectionTimeout || 5000,
      connectTimeout: config.config.connectionTimeout || 5000,
      tlsOptions: config.config.secureLDAP ? {
        rejectUnauthorized: false // Allow self-signed certs
      } : undefined
    })

    return client
  }

  /**
   * Test LDAP connection
   */
  static async testConnection(organizationId: string, config: DirectoryConfig): Promise<{ success: boolean; error?: string; details?: any }> {
    let client: ldap.Client | null = null

    try {
      client = this.createClient(config)

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => resolve())
        client.on('error', reject)
        client.bind(config.config.bindDN, config.config.bindCredentials, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      // Test search
      const searchResult = await this.performSearch(client, {
        base: config.config.searchBase,
        filter: config.config.searchFilter.replace('{{username}}', 'test'),
        attributes: config.config.attributes,
        scope: 'sub'
      })

      await this.unbindClient(client)

      return {
        success: true,
        details: {
          connected: true,
          searchResults: searchResult.length,
          baseDN: config.config.searchBase
        }
      }
    } catch (error) {
      if (client) {
        try { await this.unbindClient(client) } catch {}
      }

      logger.error('LDAP connection test failed', {
        organizationId,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Authenticate user against LDAP
   */
  static async authenticateUser(
    organizationId: string,
    config: DirectoryConfig,
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: DirectoryUser; error?: string }> {
    let client: ldap.Client | null = null

    try {
      client = this.createClient(config)

      // First bind with service account
      await this.bindClient(client, config.config.bindDN, config.config.bindCredentials)

      // Search for user
      const searchResults = await this.performSearch(client, {
        base: config.config.searchBase,
        filter: config.config.searchFilter.replace('{{username}}', username),
        attributes: ['dn', ...config.config.attributes],
        scope: 'sub'
      })

      if (searchResults.length === 0) {
        return { success: false, error: 'User not found' }
      }

      const userEntry = searchResults[0]
      const userDN = userEntry.dn

      // Rebind as the user to verify credentials
      await this.bindClient(client, userDN, password)

      // Convert to DirectoryUser
      const user = this.mapLdapUser(userEntry, config.config.attributeMapping)

      await this.unbindClient(client)

      return { success: true, user }
    } catch (error) {
      if (client) {
        try { await this.unbindClient(client) } catch {}
      }

      logger.error('LDAP authentication failed', {
        organizationId,
        username,
        error: error.message
      })

      return { success: false, error: error.message }
    }
  }

  /**
   * Sync users from LDAP
   */
  static async syncUsers(organizationId: string, config: DirectoryConfig): Promise<{ synced: number; errors: string[] }> {
    let client: ldap.Client | null = null
    const errors: string[] = []
    let synced = 0

    try {
      client = this.createClient(config)
      await this.bindClient(client, config.config.bindDN, config.config.bindCredentials)

      // Get all users
      const searchResults = await this.performSearch(client, {
        base: config.config.searchBase,
        filter: config.config.searchFilter.replace('{{username}}', '*'),
        attributes: ['dn', ...config.config.attributes],
        scope: 'sub',
        paged: true,
        pageSize: config.config.pageSize || 1000
      })

      logger.info(`Found ${searchResults.length} users in LDAP for organization ${organizationId}`)

      for (const userEntry of searchResults) {
        try {
          const user = this.mapLdapUser(userEntry, config.config.attributeMapping)

          // Update or create user in database
          await this.upsertDirectoryUser(organizationId, user)
          synced++

        } catch (error) {
          errors.push(`Failed to sync user ${userEntry.dn}: ${error.message}`)
        }
      }

      // Sync groups if configured
      if (config.config.groupSearchBase) {
        await this.syncGroups(organizationId, config, client)
      }

      await this.unbindClient(client)

      // Update last sync timestamp
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          metadata: {
            ...JSON.parse('{}'),
            lastLdapSync: new Date().toISOString()
          }
        }
      })

      logger.info(`LDAP sync completed for organization ${organizationId}`, {
        synced,
        errors: errors.length
      })

    } catch (error) {
      if (client) {
        try { await this.unbindClient(client) } catch {}
      }
      errors.push(`LDAP sync failed: ${error.message}`)
    }

    return { synced, errors }
  }

  /**
   * Start automatic sync
   */
  static startAutoSync(organizationId: string, config: DirectoryConfig): void {
    const interval = config.config.syncInterval || 3600000 // 1 hour default

    // Clear existing interval
    if (this.syncIntervals.has(organizationId)) {
      clearInterval(this.syncIntervals.get(organizationId)!)
    }

    // Set up new interval
    const syncInterval = setInterval(async () => {
      try {
        await this.syncUsers(organizationId, config)
      } catch (error) {
        logger.error('Auto sync failed', { organizationId, error: error.message })
      }
    }, interval)

    this.syncIntervals.set(organizationId, syncInterval)

    logger.info(`Started auto sync for organization ${organizationId}`, {
      interval: interval / 1000 / 60 // minutes
    })
  }

  /**
   * Stop automatic sync
   */
  static stopAutoSync(organizationId: string): void {
    if (this.syncIntervals.has(organizationId)) {
      clearInterval(this.syncIntervals.get(organizationId)!)
      this.syncIntervals.delete(organizationId)
      logger.info(`Stopped auto sync for organization ${organizationId}`)
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(organizationId: string): Promise<{
    lastSync?: string
    autoSyncEnabled: boolean
    userCount: number
  }> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { metadata: true }
    })

    const metadata = organization?.metadata ? JSON.parse(organization.metadata as string) : {}
    const userCount = await prisma.directoryUser.count({
      where: { organizationId }
    })

    return {
      lastSync: metadata.lastLdapSync,
      autoSyncEnabled: this.syncIntervals.has(organizationId),
      userCount
    }
  }

  /**
   * Search LDAP users
   */
  static async searchUsers(
    organizationId: string,
    config: DirectoryConfig,
    query: string,
    limit: number = 50
  ): Promise<DirectoryUser[]> {
    let client: ldap.Client | null = null
    const users: DirectoryUser[] = []

    try {
      client = this.createClient(config)
      await this.bindClient(client, config.config.bindDN, config.config.bindCredentials)

      // Create search filter for query
      const searchFilter = `(&${config.config.searchFilter.replace('{{username}}', '*')}(|(uid=*${query}*)(cn=*${query}*)(mail=*${query}*)))`

      const searchResults = await this.performSearch(client, {
        base: config.config.searchBase,
        filter: searchFilter,
        attributes: ['dn', ...config.config.attributes],
        scope: 'sub',
        sizeLimit: limit
      })

      for (const userEntry of searchResults) {
        const user = this.mapLdapUser(userEntry, config.config.attributeMapping)
        users.push(user)
      }

      await this.unbindClient(client)

      return users
    } catch (error) {
      if (client) {
        try { await this.unbindClient(client) } catch {}
      }
      logger.error('LDAP user search failed', { organizationId, query, error: error.message })
      throw error
    }
  }

  // Private helper methods

  private static async bindClient(client: ldap.Client, dn: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(dn, password, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  private static async unbindClient(client: ldap.Client): Promise<void> {
    return new Promise((resolve) => {
      client.unbind(() => resolve())
    })
  }

  private static async performSearch(client: ldap.Client, options: {
    base: string
    filter: string
    attributes: string[]
    scope: string
    paged?: boolean
    pageSize?: number
    sizeLimit?: number
  }): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = []

      const searchOptions: any = {
        filter: options.filter,
        attributes: options.attributes,
        scope: options.scope,
        sizeLimit: options.sizeLimit
      }

      if (options.paged) {
        searchOptions.paged = {
          pageSize: options.pageSize || 1000
        }
      }

      const search = client.search(options.base, searchOptions, (err, res) => {
        if (err) {
          reject(err)
          return
        }

        res.on('searchEntry', (entry) => {
          results.push(entry.object)
        })

        res.on('error', (err) => {
          reject(err)
        })

        res.on('end', () => {
          resolve(results)
        })
      })
    })
  }

  private static mapLdapUser(entry: any, attributeMapping: Record<string, string>): DirectoryUser {
    const getValue = (attr: string): string => {
      const value = entry[attr]
      return Array.isArray(value) ? value[0] : (value || '')
    }

    const getValues = (attr: string): string[] => {
      const value = entry[attr]
      if (!value) return []
      return Array.isArray(value) ? value : [value]
    }

    return {
      id: entry.dn,
      username: getValue(attributeMapping.username || 'uid'),
      email: getValue(attributeMapping.email || 'mail'),
      firstName: getValue(attributeMapping.firstName || 'givenName'),
      lastName: getValue(attributeMapping.lastName || 'sn'),
      displayName: getValue(attributeMapping.displayName || 'cn'),
      department: getValue(attributeMapping.department || 'department'),
      title: getValue(attributeMapping.title || 'title'),
      phone: getValue(attributeMapping.phone || 'telephoneNumber'),
      groups: getValues(attributeMapping.groups || 'memberOf'),
      isActive: true, // Could be determined from userAccountControl for AD
      externalId: entry.dn
    }
  }

  private static async upsertDirectoryUser(organizationId: string, user: DirectoryUser): Promise<void> {
    await prisma.directoryUser.upsert({
      where: {
        organizationId_externalId: {
          organizationId,
          externalId: user.externalId
        }
      },
      update: {
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        department: user.department,
        title: user.title,
        phone: user.phone,
        groups: user.groups,
        isActive: user.isActive,
        lastSyncAt: new Date()
      },
      create: {
        organizationId,
        externalId: user.externalId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        department: user.department,
        title: user.title,
        phone: user.phone,
        groups: user.groups,
        isActive: user.isActive,
        lastSyncAt: new Date()
      }
    })
  }

  private static async syncGroups(organizationId: string, config: DirectoryConfig, client: ldap.Client): Promise<void> {
    if (!config.config.groupSearchBase || !config.config.groupSearchFilter) {
      return
    }

    try {
      const searchResults = await this.performSearch(client, {
        base: config.config.groupSearchBase,
        filter: config.config.groupSearchFilter,
        attributes: ['dn', 'cn', 'description', config.config.groupMemberAttribute || 'member'],
        scope: 'sub'
      })

      for (const groupEntry of searchResults) {
        const group = {
          id: groupEntry.dn,
          name: groupEntry.cn?.[0] || '',
          description: groupEntry.description?.[0],
          members: groupEntry[config.config.groupMemberAttribute || 'member'] || [],
          dn: groupEntry.dn,
          lastSyncAt: new Date()
        }

        await prisma.directoryGroup.upsert({
          where: {
            organizationId_externalId: {
              organizationId,
              externalId: group.id
            }
          },
          update: group,
          create: {
            organizationId,
            externalId: group.id,
            ...group
          }
        })
      }

      logger.info(`Synced ${searchResults.length} groups for organization ${organizationId}`)
    } catch (error) {
      logger.error('Group sync failed', { organizationId, error: error.message })
    }
  }
}