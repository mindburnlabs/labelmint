import { logger } from '../../utils/logger.js'
import { AuditService } from '../AuditService.js'
import axios from 'axios'
import { Client } from '@microsoft/microsoft-graph-client'

export interface TeamsConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  redirectUri: string
  scope?: string[]
}

export interface TeamsMessage {
  chatId?: string
  channelId?: string
  teamId?: string
  subject?: string
  body: {
    contentType: 'text' | 'html'
    content: string
  }
  importance?: 'low' | 'normal' | 'high'
  mentions?: Array<{
    id: number
    mentionText: string
    mentioned: {
      user: {
        displayName: string
        id: string
      }
    }
  }>
  attachments?: Array<{
    id: string
    contentType: string
    name: string
    contentUrl?: string
    content?: string
  }>
}

export class TeamsIntegrationService {
  private config: TeamsConfig
  private organizationId: string
  private accessToken: string | null = null

  constructor(config: TeamsConfig, organizationId: string) {
    this.config = config
    this.organizationId = organizationId
  }

  /**
   * Get Microsoft Graph access token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken
    }

    try {
      const response = await axios.post(`https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: this.config.scope?.join(' ') || 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      this.accessToken = response.data.access_token
      return this.accessToken
    } catch (error) {
      logger.error('Failed to get Microsoft Graph access token', { error: error.message })
      throw new Error('Failed to authenticate with Microsoft Graph')
    }
  }

  /**
   * Get Microsoft Graph client
   */
  private async getGraphClient(): Promise<Client> {
    const token = await this.getAccessToken()
    return Client.init({
      authProvider: {
        getAccessToken: async () => token
      }
    })
  }

  /**
   * Send message to Teams chat
   */
  async sendChatMessage(chatId: string, message: Omit<TeamsMessage, 'chatId'>): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()

      const response = await graphClient.api(`/chats/${chatId}/messages`)
        .post({
          ...message,
          body: {
            contentType: message.body.contentType,
            content: message.body.content
          }
        })

      await this.logIntegrationEvent('chat_message_sent', {
        chatId,
        messageId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('chat_message_sent', {
        chatId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Send message to Teams channel
   */
  async sendChannelMessage(teamId: string, channelId: string, message: Omit<TeamsMessage, 'teamId' | 'channelId'>): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()

      const response = await graphClient.api(`/teams/${teamId}/channels/${channelId}/messages`)
        .post({
          ...message,
          body: {
            contentType: message.body.contentType,
            content: message.body.content
          }
        })

      await this.logIntegrationEvent('channel_message_sent', {
        teamId,
        channelId,
        messageId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('channel_message_sent', {
        teamId,
        channelId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get user's chats
   */
  async getUserChats(): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient.api('/me/chats').get()
      return response.value
    } catch (error) {
      logger.error('Failed to get Teams chats', { error: error.message })
      throw error
    }
  }

  /**
   * Get teams
   */
  async getTeams(): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient.api('/me/joinedTeams').get()
      return response.value
    } catch (error) {
      logger.error('Failed to get Teams', { error: error.message })
      throw error
    }
  }

  /**
   * Get channels in a team
   */
  async getChannels(teamId: string): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient.api(`/teams/${teamId}/channels`).get()
      return response.value
    } catch (error) {
      logger.error('Failed to get Teams channels', { error: error.message, teamId })
      throw error
    }
  }

  /**
   * Create a new channel
   */
  async createChannel(teamId: string, displayName: string, description?: string, isPrivate: boolean = false): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()

      const response = await graphClient.api(`/teams/${teamId}/channels`)
        .post({
          displayName,
          description,
          membershipType: isPrivate ? 'private' : 'standard'
        })

      await this.logIntegrationEvent('channel_created', {
        teamId,
        displayName,
        isPrivate,
        channelId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('channel_created', {
        teamId,
        displayName,
        isPrivate,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get channel messages
   */
  async getChannelMessages(teamId: string, channelId: string, limit: number = 50): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient
        .api(`/teams/${teamId}/channels/${channelId}/messages`)
        .top(limit)
        .get()
      return response.value
    } catch (error) {
      logger.error('Failed to get Teams channel messages', { error: error.message, teamId, channelId })
      throw error
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(userId: string): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient.api(`/users/${userId}`).get()
      return response
    } catch (error) {
      logger.error('Failed to get Teams user info', { error: error.message, userId })
      throw error
    }
  }

  /**
   * Search for users
   */
  async searchUsers(query: string): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient
        .api(`/users`)
        .filter(`displayName ge '${query}' or mail ge '${query}'`)
        .top(20)
        .get()
      return response.value
    } catch (error) {
      logger.error('Failed to search Teams users', { error: error.message, query })
      throw error
    }
  }

  /**
   * Create a team
   */
  async createTeam(displayName: string, description?: string, isPrivate: boolean = false): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()

      const teamTemplate = {
        'template@odata.bind': "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
        displayName,
        description,
        visibility: isPrivate ? 'Private' : 'Public',
        members: [
          {
            '@odata.type': '#microsoft.graph.aadUserConversationMember',
            roles: ['owner'],
            'user@odata.bind': `https://graph.microsoft.com/v1.0/me`
          }
        ]
      }

      const response = await graphClient.api('/teams').post(teamTemplate)

      await this.logIntegrationEvent('team_created', {
        displayName,
        isPrivate,
        teamId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('team_created', {
        displayName,
        isPrivate,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Add member to team
   */
  async addTeamMember(teamId: string, userId: string, roles: string[] = ['member']): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()

      const member = {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles,
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${userId}`
      }

      const response = await graphClient.api(`/teams/${teamId}/members`).post(member)

      await this.logIntegrationEvent('team_member_added', {
        teamId,
        userId,
        roles,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('team_member_added', {
        teamId,
        userId,
        roles,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get online meetings
   */
  async getOnlineMeetings(): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient.api('/me/onlineMeetings').get()
      return response.value
    } catch (error) {
      logger.error('Failed to get Teams online meetings', { error: error.message })
      throw error
    }
  }

  /**
   * Create online meeting
   */
  async createOnlineMeeting(subject: string, startDateTime: string, endDateTime: string, participants?: any): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()

      const meeting = {
        subject,
        startDateTime,
        endDateTime,
        participants
      }

      const response = await graphClient.api('/me/onlineMeetings').post(meeting)

      await this.logIntegrationEvent('online_meeting_created', {
        subject,
        startDateTime,
        endDateTime,
        meetingId: response.id,
        success: true
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('online_meeting_created', {
        subject,
        startDateTime,
        endDateTime,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Send file to chat/channel
   */
  async sendFile(chatId: string, channelId: string, teamId: string, fileName: string, fileContent: Buffer): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()

      let uploadUrl: string
      if (chatId) {
        // Upload to chat
        const uploadSession = await graphClient.api(`/chats/${chatId}/messages/attachments/createUploadSession`)
          .post({
            attachmentItem: {
              '@odata.type': '#microsoft.graph.chatMessageAttachmentItem',
              attachmentType: 'file',
              name: fileName,
              size: fileContent.length
            }
          })
        uploadUrl = uploadSession.uploadUrl
      } else if (teamId && channelId) {
        // Upload to channel
        const uploadSession = await graphClient.api(`/teams/${teamId}/channels/${channelId}/messages/attachments/createUploadSession`)
          .post({
            attachmentItem: {
              '@odata.type': '#microsoft.graph.chatMessageAttachmentItem',
              attachmentType: 'file',
              name: fileName,
              size: fileContent.length
            }
          })
        uploadUrl = uploadSession.uploadUrl
      } else {
        throw new Error('Either chatId or both teamId and channelId must be provided')
      }

      // Upload file in chunks
      const chunkSize = 1024 * 1024 * 4 // 4MB chunks
      let uploadedBytes = 0

      while (uploadedBytes < fileContent.length) {
        const chunk = fileContent.slice(uploadedBytes, uploadedBytes + chunkSize)
        const end = uploadedBytes + chunk.length - 1

        await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Length': chunk.length.toString(),
            'Content-Range': `bytes ${uploadedBytes}-${end}/${fileContent.length}`
          }
        })

        uploadedBytes += chunk.length
      }

      const fileAttachment = await axios.get(uploadUrl)

      await this.logIntegrationEvent('file_uploaded', {
        fileName,
        chatId,
        channelId,
        teamId,
        success: true
      })

      return fileAttachment.data
    } catch (error) {
      await this.logIntegrationEvent('file_uploaded', {
        fileName,
        chatId,
        channelId,
        teamId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Test Teams connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient.api('/me').get()

      return {
        success: true,
        details: {
          user: response.displayName,
          email: response.mail,
          id: response.id
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
   * Get presence information
   */
  async getPresence(userId: string): Promise<any> {
    try {
      const graphClient = await this.getGraphClient()
      const response = await graphClient.api(`/users/${userId}/presence`).get()
      return response
    } catch (error) {
      logger.error('Failed to get Teams presence', { error: error.message, userId })
      throw error
    }
  }

  /**
   * Get integration usage statistics
   */
  async getUsageStats(days: number = 30): Promise<{
    messagesSent: number
    filesUploaded: number
    teamsCreated: number
    channelsCreated: number
    meetingsCreated: number
    apiCalls: number
    errors: number
  }> {
    // This would typically query a database table that logs integration usage
    // For now, return mock data
    return {
      messagesSent: Math.floor(Math.random() * 800),
      filesUploaded: Math.floor(Math.random() * 80),
      teamsCreated: Math.floor(Math.random() * 5),
      channelsCreated: Math.floor(Math.random() * 15),
      meetingsCreated: Math.floor(Math.random() * 25),
      apiCalls: Math.floor(Math.random() * 3000),
      errors: Math.floor(Math.random() * 30)
    }
  }

  /**
   * Log integration events
   */
  private async logIntegrationEvent(action: string, details: any): Promise<void> {
    try {
      await AuditService.log({
        organizationId: this.organizationId,
        userId: 'system',
        action: `TEAMS_INTEGRATION_${action.toUpperCase()}`,
        resource: 'integration',
        details: {
          platform: 'teams',
          ...details
        }
      })
    } catch (error) {
      logger.error('Failed to log Teams integration event', {
        action,
        error: error.message
      })
    }
  }
}