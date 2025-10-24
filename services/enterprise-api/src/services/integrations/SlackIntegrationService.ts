import { logger } from '../../utils/logger.js'
import { AuditService } from '../AuditService.js'
import axios from 'axios'

export interface SlackConfig {
  botToken: string
  signingSecret: string
  clientId: string
  clientSecret: string
  verificationToken?: string
  teamId?: string
}

export interface SlackMessage {
  channel: string
  text?: string
  blocks?: any[]
  attachments?: any[]
  thread_ts?: string
  reply_broadcast?: boolean
}

export interface SlackEvent {
  type: string
  user?: string
  channel?: string
  text?: string
  ts?: string
  thread_ts?: string
  team?: string
  event_ts?: string
}

export class SlackIntegrationService {
  private config: SlackConfig
  private organizationId: string

  constructor(config: SlackConfig, organizationId: string) {
    this.config = config
    this.organizationId = organizationId
  }

  /**
   * Send message to Slack channel
   */
  async sendMessage(message: SlackMessage): Promise<any> {
    try {
      const response = await axios.post('https://slack.com/api/chat.postMessage',
        {
          ...message,
          channel: message.channel.startsWith('#') ? message.channel : `#${message.channel}`
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.ok) {
        await this.logIntegrationEvent('message_sent', {
          channel: message.channel,
          messageId: response.data.ts,
          success: true
        })
        return response.data
      } else {
        throw new Error(response.data.error || 'Failed to send Slack message')
      }
    } catch (error) {
      await this.logIntegrationEvent('message_sent', {
        channel: message.channel,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Update message in Slack
   */
  async updateMessage(channel: string, ts: string, message: Partial<SlackMessage>): Promise<any> {
    try {
      const response = await axios.post('https://slack.com/api/chat.update',
        {
          channel,
          ts,
          ...message
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.ok) {
        await this.logIntegrationEvent('message_updated', {
          channel,
          ts,
          success: true
        })
        return response.data
      } else {
        throw new Error(response.data.error || 'Failed to update Slack message')
      }
    } catch (error) {
      await this.logIntegrationEvent('message_updated', {
        channel,
        ts,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Delete message from Slack
   */
  async deleteMessage(channel: string, ts: string): Promise<any> {
    try {
      const response = await axios.post('https://slack.com/api/chat.delete',
        {
          channel,
          ts
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.ok) {
        await this.logIntegrationEvent('message_deleted', {
          channel,
          ts,
          success: true
        })
        return response.data
      } else {
        throw new Error(response.data.error || 'Failed to delete Slack message')
      }
    } catch (error) {
      await this.logIntegrationEvent('message_deleted', {
        channel,
        ts,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get channel information
   */
  async getChannelInfo(channel: string): Promise<any> {
    try {
      const response = await axios.get('https://slack.com/api/conversations.info', {
        params: { channel },
        headers: {
          'Authorization': `Bearer ${this.config.botToken}`
        }
      })

      if (response.data.ok) {
        return response.data.channel
      } else {
        throw new Error(response.data.error || 'Failed to get Slack channel info')
      }
    } catch (error) {
      logger.error('Failed to get Slack channel info', { error: error.message, channel })
      throw error
    }
  }

  /**
   * List channels
   */
  async listChannels(types: string = 'public_channel,private_channel'): Promise<any[]> {
    try {
      const response = await axios.get('https://slack.com/api/conversations.list', {
        params: { types, exclude_archived: true },
        headers: {
          'Authorization': `Bearer ${this.config.botToken}`
        }
      })

      if (response.data.ok) {
        return response.data.channels
      } else {
        throw new Error(response.data.error || 'Failed to list Slack channels')
      }
    } catch (error) {
      logger.error('Failed to list Slack channels', { error: error.message })
      throw error
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(userId: string): Promise<any> {
    try {
      const response = await axios.get('https://slack.com/api/users.info', {
        params: { user: userId },
        headers: {
          'Authorization': `Bearer ${this.config.botToken}`
        }
      })

      if (response.data.ok) {
        return response.data.user
      } else {
        throw new Error(response.data.error || 'Failed to get Slack user info')
      }
    } catch (error) {
      logger.error('Failed to get Slack user info', { error: error.message, userId })
      throw error
    }
  }

  /**
   * Create a channel
   */
  async createChannel(name: string, isPrivate: boolean = false): Promise<any> {
    try {
      const response = await axios.post('https://slack.com/api/conversations.create',
        {
          name,
          is_private: isPrivate
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.ok) {
        await this.logIntegrationEvent('channel_created', {
          channelName: name,
          isPrivate,
          channelId: response.data.channel.id,
          success: true
        })
        return response.data.channel
      } else {
        throw new Error(response.data.error || 'Failed to create Slack channel')
      }
    } catch (error) {
      await this.logIntegrationEvent('channel_created', {
        channelName: name,
        isPrivate,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Invite users to channel
   */
  async inviteToChannel(channel: string, users: string[]): Promise<any> {
    try {
      const response = await axios.post('https://slack.com/api/conversations.invite',
        {
          channel,
          users: users.join(',')
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.ok) {
        await this.logIntegrationEvent('users_invited', {
          channel,
          userCount: users.length,
          success: true
        })
        return response.data
      } else {
        throw new Error(response.data.error || 'Failed to invite users to Slack channel')
      }
    } catch (error) {
      await this.logIntegrationEvent('users_invited', {
        channel,
        userCount: users.length,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Upload file to Slack
   */
  async uploadFile(file: Buffer | string, filename: string, channel?: string, title?: string): Promise<any> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', filename)

      if (channel) {
        formData.append('channels', channel)
      }

      if (title) {
        formData.append('title', title)
      }

      const response = await axios.post('https://slack.com/api/files.upload',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      if (response.data.ok) {
        await this.logIntegrationEvent('file_uploaded', {
          filename,
          channel,
          fileId: response.data.file.id,
          success: true
        })
        return response.data.file
      } else {
        throw new Error(response.data.error || 'Failed to upload file to Slack')
      }
    } catch (error) {
      await this.logIntegrationEvent('file_uploaded', {
        filename,
        channel,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Test Slack connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${this.config.botToken}`
        }
      })

      if (response.data.ok) {
        return {
          success: true,
          details: {
            team: response.data.team,
            user: response.data.user,
            teamId: response.data.team_id,
            userId: response.data.user_id
          }
        }
      } else {
        return {
          success: false,
          error: response.data.error || 'Authentication failed'
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
   * Verify Slack webhook signature
   */
  verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
    const crypto = require('crypto')

    const time = Math.floor(new Date().getTime() / 1000)
    if (Math.abs(time - parseInt(timestamp)) > 300) {
      return false // Request is older than 5 minutes
    }

    const hmac = crypto.createHmac('sha256', this.config.signingSecret)
    hmac.update(`${timestamp}:${body}`)
    const expectedSignature = `v0=${hmac.digest('hex')}`

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(): Promise<any> {
    try {
      const response = await axios.get('https://slack.com/api/team.info', {
        headers: {
          'Authorization': `Bearer ${this.config.botToken}`
        }
      })

      if (response.data.ok) {
        return response.data.team
      } else {
        throw new Error(response.data.error || 'Failed to get Slack workspace info')
      }
    } catch (error) {
      logger.error('Failed to get Slack workspace info', { error: error.message })
      throw error
    }
  }

  /**
   * Send direct message to user
   */
  async sendDirectMessage(userId: string, message: Omit<SlackMessage, 'channel'>): Promise<any> {
    try {
      // Open DM channel
      const channelResponse = await axios.post('https://slack.com/api/conversations.open',
        {
          users: userId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!channelResponse.data.ok) {
        throw new Error(channelResponse.data.error || 'Failed to open DM channel')
      }

      // Send message to DM channel
      const response = await this.sendMessage({
        ...message,
        channel: channelResponse.data.channel.id
      })

      return response
    } catch (error) {
      await this.logIntegrationEvent('dm_sent', {
        userId,
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Schedule message (requires premium Slack account)
   */
  async scheduleMessage(channel: string, text: string, postAt: number): Promise<any> {
    try {
      const response = await axios.post('https://slack.com/api/chat.scheduleMessage',
        {
          channel,
          text,
          post_at: postAt
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.ok) {
        await this.logIntegrationEvent('message_scheduled', {
          channel,
          scheduledFor: new Date(postAt * 1000).toISOString(),
          messageId: response.data.scheduled_message_id,
          success: true
        })
        return response.data
      } else {
        throw new Error(response.data.error || 'Failed to schedule Slack message')
      }
    } catch (error) {
      await this.logIntegrationEvent('message_scheduled', {
        channel,
        scheduledFor: new Date(postAt * 1000).toISOString(),
        success: false,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Log integration events
   */
  private async logIntegrationEvent(action: string, details: any): Promise<void> {
    try {
      await AuditService.log({
        organizationId: this.organizationId,
        userId: 'system', // Integration actions are system-initiated
        action: `SLACK_INTEGRATION_${action.toUpperCase()}`,
        resource: 'integration',
        details: {
          platform: 'slack',
          ...details
        }
      })
    } catch (error) {
      logger.error('Failed to log Slack integration event', {
        action,
        error: error.message
      })
    }
  }

  /**
   * Get integration usage statistics
   */
  async getUsageStats(days: number = 30): Promise<{
    messagesSent: number
    filesUploaded: number
    channelsCreated: number
    apiCalls: number
    errors: number
  }> {
    // This would typically query a database table that logs integration usage
    // For now, return mock data
    return {
      messagesSent: Math.floor(Math.random() * 1000),
      filesUploaded: Math.floor(Math.random() * 100),
      channelsCreated: Math.floor(Math.random() * 10),
      apiCalls: Math.floor(Math.random() * 5000),
      errors: Math.floor(Math.random() * 50)
    }
  }
}