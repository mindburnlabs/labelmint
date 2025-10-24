import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { Bot } from 'grammy';

export interface WebSocketMessage {
  type: 'task_completed' | 'project_updated' | 'payment_received' | 'worker_assigned' | 'quality_alert';
  data: any;
  userId?: string;
  projectId?: string;
  timestamp: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private bot: Bot;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private subscriptions: Map<string, Set<string>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(process.env.WS_URL || 'ws://localhost:3001');

      this.ws.on('open', () => {
        logger.info('WebSocket connection established');
        this.reconnectAttempts = 0;
        this.startPing();

        // Resubscribe to all previous subscriptions
        this.resubscribeAll();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`WebSocket connection closed: ${code} - ${reason}`);
        this.stopPing();
        this.handleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });

    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private handleMessage(message: WebSocketMessage) {
    logger.info(`Received WebSocket message: ${message.type}`, message.data);

    switch (message.type) {
      case 'task_completed':
        this.handleTaskCompleted(message);
        break;
      case 'project_updated':
        this.handleProjectUpdated(message);
        break;
      case 'payment_received':
        this.handlePaymentReceived(message);
        break;
      case 'worker_assigned':
        this.handleWorkerAssigned(message);
        break;
      case 'quality_alert':
        this.handleQualityAlert(message);
        break;
    }
  }

  private async handleTaskCompleted(message: WebSocketMessage) {
    const { task, project } = message.data;

    // Notify project owner
    if (message.userId) {
      const completionRate = ((project.completed_tasks || 0) / (project.total_tasks || 1) * 100).toFixed(1);

      await this.bot.api.sendMessage(
        message.userId,
        `✅ *Task Completed!*\n\n` +
        `📊 Project: ${project.name}\n` +
        `✅ Completed: ${project.completed_tasks}/${project.total_tasks} (${completionRate}%)\n` +
        `⏱️ Time taken: ${task.time_spent}s\n` +
        `👤 Worker: @${task.worker_username || 'Unknown'}\n\n` +
        `Keep up the great work!`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📊 View Project', callback_data: `project_status_${project.id}` },
              { text: '📈 Analytics', callback_data: 'view_analytics' }
            ]]
          }
        }
      );
    }
  }

  private async handleProjectUpdated(message: WebSocketMessage) {
    const { project, updateType } = message.data;

    if (message.userId) {
      let updateMessage = '';

      switch (updateType) {
        case 'data_uploaded':
          updateMessage = `📁 *Data Uploaded*\n\n` +
            `📊 Project: ${project.name}\n` +
            `📝 New tasks: ${project.new_tasks_count}\n` +
            `💰 Cost: $${project.cost.toFixed(2)}\n\n` +
            `Your data is being processed!`;
          break;
        case 'project_completed':
          updateMessage = `🎉 *Project Completed!*\n\n` +
            `📊 Project: ${project.name}\n` +
            `✅ All tasks completed!\n` +
            `📈 Average accuracy: ${(project.accuracy * 100).toFixed(1)}%\n\n` +
            `View your results now!`;
          break;
        default:
          updateMessage = `📊 *Project Updated*\n\n` +
            `📊 Project: ${project.name}\n` +
            `Status: ${project.status}`;
      }

      await this.bot.api.sendMessage(
        message.userId,
        updateMessage,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📊 View Status', callback_data: `project_status_${project.id}` },
              { text: '📥 Download Results', callback_data: `project_results_${project.id}` }
            ]]
          }
        }
      );
    }
  }

  private async handlePaymentReceived(message: WebSocketMessage) {
    const { amount, transaction, balance } = message.data;

    if (message.userId) {
      await this.bot.api.sendMessage(
        message.userId,
        `💰 *Payment Received!*\n\n` +
        `💳 Amount: $${amount.toFixed(2)}\n` +
        `📅 Date: ${new Date(transaction.created_at).toLocaleDateString()}\n` +
        `💵 Current Balance: $${balance.toFixed(2)}\n\n` +
        `Thank you for your payment!`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '💳 View Billing', callback_data: 'view_billing' },
              { text: '📊 Projects', callback_data: 'view_projects' }
            ]]
          }
        }
      );
    }
  }

  private async handleWorkerAssigned(message: WebSocketMessage) {
    const { project, workerCount } = message.data;

    if (message.userId) {
      await this.bot.api.sendMessage(
        message.userId,
        `👥 *Workers Assigned!*\n\n` +
        `📊 Project: ${project.name}\n` +
        `👤 Active workers: ${workerCount}\n` +
        `📝 Tasks in progress: ${project.in_progress_tasks}\n\n` +
        `Your project is being actively worked on!`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📊 View Status', callback_data: `project_status_${project.id}` }
            ]]
          }
        }
      );
    }
  }

  private async handleQualityAlert(message: WebSocketMessage) {
    const { project, issue, accuracy } = message.data;

    if (message.userId) {
      await this.bot.api.sendMessage(
        message.userId,
        `⚠️ *Quality Alert*\n\n` +
        `📊 Project: ${project.name}\n` +
        `📉 Current accuracy: ${(accuracy * 100).toFixed(1)}%\n` +
        `⚠️ Issue: ${issue}\n\n` +
        `Consider reviewing your guidelines or quality requirements.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📊 View Analytics', callback_data: 'analytics_quality' },
              { text: '⚙️ Project Settings', callback_data: `edit_project_${project.id}` }
            ]]
          }
        }
      );
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      logger.error('Max reconnection attempts reached. WebSocket connection failed.');
    }
  }

  public subscribe(userId: string, projectId?: string) {
    const key = projectId ? `project:${projectId}` : 'user';

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    this.subscriptions.get(key)!.add(userId);

    // Send subscription message to server
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        userId,
        projectId
      }));
    }
  }

  public unsubscribe(userId: string, projectId?: string) {
    const key = projectId ? `project:${projectId}` : 'user';

    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!.delete(userId);

      if (this.subscriptions.get(key)!.size === 0) {
        this.subscriptions.delete(key);
      }
    }

    // Send unsubscribe message to server
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        userId,
        projectId
      }));
    }
  }

  private resubscribeAll() {
    for (const [key, users] of this.subscriptions.entries()) {
      const projectId = key.startsWith('project:') ? key.split(':')[1] : undefined;

      for (const userId of users) {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'subscribe',
            userId,
            projectId
          }));
        }
      }
    }
  }

  public close() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  public getStatus() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      state: this.ws?.readyState,
      subscriptions: Array.from(this.subscriptions.entries()).map(([key, users]) => ({
        key,
        userCount: users.size
      }))
    };
  }
}