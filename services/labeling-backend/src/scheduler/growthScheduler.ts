import cron from 'node-cron';
import TwitterService from '../services/twitterService';
import RedditService from '../services/redditService';
import EmailService from '../services/emailService';
import { query } from '../database/connection';

class GrowthScheduler {
  private twitterService: TwitterService;
  private redditService: RedditService;
  private emailService: EmailService;

  constructor() {
    this.twitterService = new TwitterService();
    this.redditService = new RedditService();
    this.emailService = new EmailService();
  }

  start() {
    console.log('📅 Starting growth automation scheduler...');

    // Run Twitter monitoring every hour
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ Running scheduled Twitter monitoring...');
      try {
        await this.twitterService.monitorKeywords();
        await this.logAutomationRun('twitter_monitoring', true);
      } catch (error) {
        console.error('Twitter monitoring error:', error);
        await this.logAutomationRun('twitter_monitoring', false, error.message);
      }
    });

    // Run Reddit monitoring every 2 hours
    cron.schedule('0 */2 * * *', async () => {
      console.log('⏰ Running scheduled Reddit monitoring...');
      try {
        await this.redditService.monitorSubreddits();
        await this.logAutomationRun('reddit_monitoring', true);
      } catch (error) {
        console.error('Reddit monitoring error:', error);
        await this.logAutomationRun('reddit_monitoring', false, error.message);
      }
    });

    // Send email campaign daily at 9 AM UTC
    cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Running scheduled email campaign...');
      try {
        await this.emailService.processEmailCampaign();
        await this.logAutomationRun('email_campaign', true);
      } catch (error) {
        console.error('Email campaign error:', error);
        await this.logAutomationRun('email_campaign', false, error.message);
      }
    });

    // Send follow-up emails daily at 2 PM UTC
    cron.schedule('0 14 * * *', async () => {
      console.log('⏰ Running scheduled follow-ups...');
      try {
        await this.emailService.sendFollowUpEmails();
        await this.logAutomationRun('email_followups', true);
      } catch (error) {
        console.error('Follow-up emails error:', error);
        await this.logAutomationRun('email_followups', false, error.message);
      }
    });

    // Scrape new startups weekly on Monday at 10 AM UTC
    cron.schedule('0 10 * * 1', async () => {
      console.log('⏰ Running scheduled startup scraping...');
      try {
        await this.emailService.scrapeCrunchbaseStartups();
        await this.logAutomationRun('startup_scraping', true);
      } catch (error) {
        console.error('Startup scraping error:', error);
        await this.logAutomationRun('startup_scraping', false, error.message);
      }
    });

    // Cleanup old analytics data monthly
    cron.schedule('0 2 1 * *', async () => {
      console.log('⏰ Running scheduled analytics cleanup...');
      try {
        await this.cleanupOldAnalytics();
        await this.logAutomationRun('analytics_cleanup', true);
      } catch (error) {
        console.error('Analytics cleanup error:', error);
        await this.logAutomationRun('analytics_cleanup', false, error.message);
      }
    });

    console.log('✅ Growth automation scheduler started successfully!');
    console.log('\nScheduled Tasks:');
    console.log('  • Twitter monitoring: Every hour');
    console.log('  • Reddit monitoring: Every 2 hours');
    console.log('  • Email campaign: Daily at 9 AM UTC');
    console.log('  • Follow-up emails: Daily at 2 PM UTC');
    console.log('  • Startup scraping: Mondays at 10 AM UTC');
    console.log('  • Analytics cleanup: 1st of month at 2 AM UTC');
  }

  private async logAutomationRun(task: string, success: boolean, error?: string): Promise<void> {
    try {
      await query(`
        INSERT INTO analytics_events (event_type, properties, created_at)
        VALUES ($1, $2, NOW())
      `, [task, JSON.stringify({
        success,
        error,
        timestamp: new Date().toISOString()
      })]);
    } catch (e) {
      console.error('Failed to log automation run:', e);
    }
  }

  private async cleanupOldAnalytics(): Promise<void> {
    try {
      // Delete analytics events older than 90 days
      await query(`
        DELETE FROM analytics_events
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

      // Delete old email sequences (keep last 30 days)
      await query(`
        DELETE FROM email_sequences
        WHERE created_at < NOW() - INTERVAL '30 days'
          AND status IN ('sent', 'failed')
      `);

      console.log('Analytics cleanup completed');
    } catch (error) {
      console.error('Error during analytics cleanup:', error);
    }
  }

  async runAllManually(): Promise<void> {
    console.log('🔄 Running all automations manually...');

    const tasks = [
      { name: 'Twitter Monitoring', fn: () => this.twitterService.monitorKeywords() },
      { name: 'Reddit Monitoring', fn: () => this.redditService.monitorSubreddits() },
      { name: 'Email Campaign', fn: () => this.emailService.processEmailCampaign() },
      { name: 'Follow-up Emails', fn: () => this.emailService.sendFollowUpEmails() },
      { name: 'Startup Scraping', fn: () => this.emailService.scrapeCrunchbaseStartups() }
    ];

    for (const task of tasks) {
      try {
        console.log(`Running ${task.name}...`);
        await task.fn();
        console.log(`✅ ${task.name} completed`);
      } catch (error) {
        console.error(`❌ ${task.name} failed:`, error);
      }
    }
  }

  async getSchedulerStats(): Promise<any> {
    try {
      const result = await query(`
        SELECT
          event_type,
          COUNT(*) as total_runs,
          COUNT(*) FILTER (WHERE properties->>'success' = 'true') as successful_runs,
          MAX(created_at) as last_run
        FROM analytics_events
        WHERE event_type IN ('twitter_monitoring', 'reddit_monitoring', 'email_campaign', 'email_followups', 'startup_scraping')
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY event_type
        ORDER BY last_run DESC
      `);

      return {
        tasks: result.rows,
        uptime: process.uptime(),
        next_runs: {
          twitter: this.getNextRunTime('0 * * * *'),
          reddit: this.getNextRunTime('0 */2 * * *'),
          email_campaign: this.getNextRunTime('0 9 * * *'),
          followups: this.getNextRunTime('0 14 * * *'),
          scraping: this.getNextRunTime('0 10 * * 1')
        }
      };
    } catch (error) {
      console.error('Error getting scheduler stats:', error);
      return null;
    }
  }

  private getNextRunTime(cronExpression: string): string {
    // Simple implementation - in production use a proper cron parser
    const now = new Date();
    const next = new Date(now.getTime() + 3600000); // Placeholder
    return next.toISOString();
  }
}

export default GrowthScheduler;