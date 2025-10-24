import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { Bot } from 'grammy';

export interface WebSocketMessage {
  type: 'new_task' | 'task_approved' | 'payment_received' | 'achievement_unlocked' | 'rank_changed';
  data: any;
  userId?: string;
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
      case 'new_task':
        this.handleNewTask(message);
        break;
      case 'task_approved':
        this.handleTaskApproved(message);
        break;
      case 'payment_received':
        this.handlePaymentReceived(message);
        break;
      case 'achievement_unlocked':
        this.handleAchievementUnlocked(message);
        break;
      case 'rank_changed':
        this.handleRankChanged(message);
        break;
    }
  }

  private async handleNewTask(message: WebSocketMessage) {
    const { task, isHighPriority } = message.data;

    if (message.userId) {
      const priorityText = isHighPriority ? '🔥 *HIGH PRIORITY*\n\n' : '';
      const quickBonus = isHighPriority ? '\n💰 *2x bonus available!*' : '';

      await this.bot.api.sendMessage(
        message.userId,
        `${priorityText}📋 *New Task Available!*\n\n` +
        `📝 ${task.title}\n` +
        `💰 Payment: $${task.payment.toFixed(4)}\n` +
        `⏱️ Time: ${task.estimated_time || 'N/A'} minutes\n` +
        `🏷️ ${task.categories.join(', ')}${quickBonus}\n\n` +
        `Be quick before it's taken!`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Accept Task', callback_data: `accept_task_${task.id}` },
              { text: '📋 View Details', callback_data: `task_details_${task.id}` }
            ]]
          }
        }
      );
    }
  }

  private async handleTaskApproved(message: WebSocketMessage) {
    const { task, earned, bonus, accuracy } = message.data;

    if (message.userId) {
      let messageText = `✅ *Task Approved!*\n\n` +
                       `💰 Base Earned: $${earned.toFixed(4)}`;

      if (bonus > 0) {
        messageText += `\n🎁 Bonus: $${bonus.toFixed(4)}`;
      }

      messageText += `\n📊 Accuracy: ${(accuracy * 100).toFixed(1)}%\n` +
                    `💵 Total: $${(earned + bonus).toFixed(4)}\n\n` +
                    `Great work! Keep it up! 🎉`;

      await this.bot.api.sendMessage(
        message.userId,
        messageText,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 Next Task', callback_data: 'next_task' },
              { text: '💰 View Earnings', callback_data: 'my_earnings' }
            ]]
          }
        }
      );
    }
  }

  private async handlePaymentReceived(message: WebSocketMessage) {
    const { amount, method, balance, transactionId } = message.data;

    if (message.userId) {
      await this.bot.api.sendMessage(
        message.userId,
        `💸 *Payment Received!*\n\n` +
        `💰 Amount: $${amount.toFixed(4)}\n` +
        `🏦 Method: ${method}\n` +
        `🆔 Transaction: ${transactionId}\n` +
        `💵 New Balance: $${balance.toFixed(4)}\n\n` +
        `Thank you for your hard work! 🎊`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '💰 My Earnings', callback_data: 'my_earnings' },
              { text: '📋 Find More Tasks', callback_data: 'available_tasks' }
            ]]
          }
        }
      );
    }
  }

  private async handleAchievementUnlocked(message: WebSocketMessage) {
    const { achievement, reward } = message.data;

    if (message.userId) {
      await this.bot.api.sendMessage(
        message.userId,
        `🏆 *Achievement Unlocked!*\n\n` +
        `${achievement.icon} *${achievement.title}*\n` +
        `${achievement.description}\n\n` +
        `${reward > 0 ? `🎁 *Bonus Reward*: $${reward.toFixed(4)}\n\n` : ''}` +
        `Congratulations on your achievement! 🎉`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '🏆 View All Achievements', callback_data: 'achievements' },
              { text: '📋 Continue Working', callback_data: 'available_tasks' }
            ]]
          }
        }
      );
    }
  }

  private async handleRankChanged(message: WebSocketMessage) {
    const { oldRank, newRank, benefits } = message.data;

    if (message.userId) {
      await this.bot.api.sendMessage(
        message.userId,
        `🎉 *Rank Up!*\n\n` +
        `${oldRank.icon} → ${newRank.icon}\n` +
        `New Rank: *${newRank.name}*\n\n` +
        `🎁 *New Benefits:*\n` +
        benefits.map((b: string) => `• ${b}`).join('\n') + '\n\n' +
        `Congratulations on your promotion! 🎊`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '👤 View Profile', callback_data: 'my_profile' },
              { text: '📊 Leaderboard', callback_data: 'leaderboard' }
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

  public subscribe(userId: string) {
    const key = 'worker';

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    this.subscriptions.get(key)!.add(userId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        userId,
        role: 'worker'
      }));
    }
  }

  public unsubscribe(userId: string) {
    const key = 'worker';

    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)!.delete(userId);

      if (this.subscriptions.get(key)!.size === 0) {
        this.subscriptions.delete(key);
      }
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        userId,
        role: 'worker'
      }));
    }
  }

  private resubscribeAll() {
    for (const [key, users] of this.subscriptions.entries()) {
      for (const userId of users) {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'subscribe',
            userId,
            role: 'worker'
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