import { DatabaseService } from '../database/DatabaseService';
import { PoolClient } from 'pg';

interface AnalyticsEvent {
  eventName: string;
  eventType: string;
  userId?: string;
  sessionId?: string;
  eventData: Record<string, any>;
  userProperties?: Record<string, any>;
  platform?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ABTestVariant {
  weight: number;
  config?: Record<string, any>;
}

interface ABTestConfig {
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  trafficPercentage: number;
  variants: Record<string, ABTestVariant>;
  targetingRules?: Record<string, any>;
  successMetrics: string[];
  startDate?: Date;
  endDate?: Date;
}

export class AnalyticsService {
  private db: DatabaseService;
  private ga4MeasurementId: string;
  private ga4ApiSecret: string;

  constructor(db: DatabaseService) {
    this.db = db;
    this.ga4MeasurementId = process.env.GA4_MEASUREMENT_ID || '';
    this.ga4ApiSecret = process.env.GA4_API_SECRET || '';
  }

  /**
   * Track custom analytics event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Store in database
      const result = await this.db.query(`
        INSERT INTO analytics_events (
          event_name, event_type, user_id, session_id,
          event_data, user_properties, platform,
          ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        event.eventName,
        event.eventType,
        event.userId,
        event.sessionId,
        JSON.stringify(event.eventData),
        JSON.stringify(event.userProperties || {}),
        event.platform || 'web',
        event.ipAddress,
        event.userAgent
      ]);

      // Send to GA4 if configured
      if (this.ga4MeasurementId && this.ga4ApiSecret) {
        await this.sendToGA4(event);
      }

      // Mark as processed after successful send
      await this.db.query(`
        UPDATE analytics_events
        SET processed = true, processed_at = NOW()
        WHERE id = $1
      `, [result.rows[0].id]);

    } catch (error) {
      console.error('Error tracking analytics event:', error);
      // Still store event even if GA4 fails
      await this.db.query(`
        INSERT INTO analytics_events (
          event_name, event_type, user_id, session_id,
          event_data, user_properties, platform,
          ip_address, user_agent, processed, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)
      `, [
        event.eventName,
        event.eventType,
        event.userId,
        event.sessionId,
        JSON.stringify(event.eventData || {}),
        JSON.stringify(event.userProperties || {}),
        event.platform || 'web',
        event.ipAddress,
        event.userAgent,
        error.message
      ]);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(params: {
    userId?: string;
    sessionId?: string;
    page: string;
    title?: string;
    referrer?: string;
    platform?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.trackEvent({
      eventName: 'page_view',
      eventType: 'navigation',
      userId: params.userId,
      sessionId: params.sessionId,
      eventData: {
        page: params.page,
        title: params.title,
        referrer: params.referrer
      },
      platform: params.platform,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Track user interaction (clicks, form submissions, etc.)
   */
  async trackInteraction(params: {
    userId?: string;
    sessionId?: string;
    elementType: string;
    elementId?: string;
    elementText?: string;
    action: string;
    page: string;
    platform?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.trackEvent({
      eventName: 'user_interaction',
      eventType: 'engagement',
      userId: params.userId,
      sessionId: params.sessionId,
      eventData: {
        elementType: params.elementType,
        elementId: params.elementId,
        elementText: params.elementText,
        action: params.action,
        page: params.page
      },
      platform: params.platform,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Track conversion event
   */
  async trackConversion(params: {
    userId?: string;
    sessionId?: string;
    conversionType: string;
    value?: number;
    currency?: string;
    items?: any[];
    metadata?: Record<string, any>;
    platform?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.trackEvent({
      eventName: 'conversion',
      eventType: 'conversion',
      userId: params.userId,
      sessionId: params.sessionId,
      eventData: {
        conversionType: params.conversionType,
        value: params.value,
        currency: params.currency || 'USD',
        items: params.items || []
      },
      userProperties: params.metadata,
      platform: params.platform,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Track task completion for funnel analysis
   */
  async trackTaskCompletion(params: {
    userId: string;
    sessionId?: string;
    taskId: string;
    taskType: string;
    timeSpent?: number;
    quality?: number;
    platform?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.trackEvent({
      eventName: 'task_completed',
      eventType: 'performance',
      userId: params.userId,
      sessionId: params.sessionId,
      eventData: {
        taskId: params.taskId,
        taskType: params.taskType,
        timeSpent: params.timeSpent,
        quality: params.quality
      },
      platform: params.platform,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Track error events
   */
  async trackError(params: {
    userId?: string;
    sessionId?: string;
    errorType: string;
    errorMessage: string;
    stack?: string;
    page?: string;
    platform?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.trackEvent({
      eventName: 'error',
      eventType: 'error',
      userId: params.userId,
      sessionId: params.sessionId,
      eventData: {
        errorType: params.errorType,
        errorMessage: params.errorMessage,
        stack: params.stack,
        page: params.page
      },
      platform: params.platform,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Create or update A/B test
   */
  async createABTest(config: ABTestConfig, createdBy: string): Promise<any> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO ab_tests (
          name, description, status, traffic_percentage,
          variants, targeting_rules, success_metrics,
          start_date, end_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        config.name,
        config.description,
        config.status,
        config.trafficPercentage,
        JSON.stringify(config.variants),
        JSON.stringify(config.targetingRules || {}),
        config.successMetrics,
        config.startDate,
        config.endDate,
        createdBy
      ]);

      const test = result.rows[0];

      await client.query('COMMIT');

      return test;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get A/B test assignment for user
   */
  async getABTestAssignment(
    userId: string,
    testName: string,
    userProperties: Record<string, any> = {}
  ): Promise<string | null> {
    const client = await this.db.getClient();

    try {
      // Check if user already has an assignment
      const existingResult = await client.query(`
        SELECT variant FROM ab_test_assignments
        WHERE test_id = (SELECT id FROM ab_tests WHERE name = $1)
        AND user_id = $2
      `, [testName, userId]);

      if (existingResult.rows.length) {
        return existingResult.rows[0].variant;
      }

      // Get test configuration
      const testResult = await client.query(`
        SELECT * FROM ab_tests
        WHERE name = $1 AND status = 'running'
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date > NOW())
      `, [testName]);

      if (!testResult.rows.length) {
        return null;
      }

      const test = testResult.rows[0];
      const variants = JSON.parse(test.variants as string);

      // Check targeting rules
      if (test.targeting_rules) {
        const rules = JSON.parse(test.targeting_rules as string);
        if (!this.matchesTargetingRules(userProperties, rules)) {
          return null;
        }
      }

      // Check if user is in traffic percentage
      const userHash = this.hashUserForTest(userId, test.id);
      if (userHash > (test.traffic_percentage / 100)) {
        return null;
      }

      // Assign variant based on weights
      const variant = this.selectVariantByWeight(variants);

      // Store assignment
      await client.query(`
        INSERT INTO ab_test_assignments (test_id, user_id, variant)
        VALUES ($1, $2, $3)
      `, [test.id, userId, variant]);

      return variant;
    } finally {
      client.release();
    }
  }

  /**
   * Track A/B test conversion
   */
  async trackABTestConversion(
    userId: string,
    testName: string,
    metric: string,
    value: number = 1
  ): Promise<void> {
    const client = await this.db.getClient();

    try {
      await client.query(`
        UPDATE ab_test_assignments
        SET converted = true, converted_at = NOW()
        WHERE test_id = (SELECT id FROM ab_tests WHERE name = $1)
        AND user_id = $2
        AND NOT converted
      `, [testName, userId]);

      // Track conversion event
      await this.trackEvent({
        eventName: 'ab_test_conversion',
        eventType: 'experiment',
        userId,
        eventData: {
          testName,
          metric,
          value,
          variant: await this.getABTestAssignment(userId, testName)
        }
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<any> {
    const client = await this.db.getClient();

    try {
      const [testResult, assignmentsResult] = await Promise.all([
        client.query('SELECT * FROM ab_tests WHERE id = $1', [testId]),
        client.query(`
          SELECT
            variant,
            COUNT(*) as total_users,
            COUNT(*) FILTER (WHERE converted = true) as conversions,
            AVG(EXTRACT(EPOCH FROM (converted_at - assigned_at))/3600/24) as avg_conversion_days
          FROM ab_test_assignments
          WHERE test_id = $1
          GROUP BY variant
        `, [testId])
      ]);

      if (!testResult.rows.length) {
        return null;
      }

      const test = testResult.rows[0];
      const assignments = assignmentsResult.rows;

      // Calculate conversion rates
      const results = assignments.map(assignment => ({
        variant: assignment.variant,
        totalUsers: parseInt(assignment.total_users),
        conversions: parseInt(assignment.conversions),
        conversionRate: (parseInt(assignment.conversions) / parseInt(assignment.total_users)) * 100,
        avgConversionDays: parseFloat(assignment.avg_conversion_days) || 0
      }));

      return {
        test,
        results,
        totalParticipants: results.reduce((sum, r) => sum + r.totalUsers, 0),
        totalConversions: results.reduce((sum, r) => sum + r.conversions, 0)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get funnel analytics
   */
  async getFunnelAnalysis(
    steps: Array<{ name: string; eventCondition: string }>,
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<any> {
    const whereClause = userId ? 'AND user_id = $3' : '';
    const params: any[] = [startDate, endDate];
    if (userId) params.push(userId);

    const stepQueries = steps.map(step => `
      (
        SELECT COUNT(DISTINCT user_id)
        FROM analytics_events
        WHERE created_at BETWEEN $1 AND $2
        ${whereClause}
        AND ${step.eventCondition}
      ) as ${step.name}
    `).join(', ');

    const query = `
      SELECT ${stepQueries}
    `;

    const result = await this.db.query(query, params);
    const row = result.rows[0];

    const funnel = steps.map((step, index) => ({
      step: step.name,
      users: parseInt(row[step.name] || '0'),
      dropoff: index > 0 ? parseInt(row[steps[index - 1].name] || '0') - parseInt(row[step.name] || '0') : 0,
      conversionRate: index > 0 && parseInt(row[steps[0].name] || '0') > 0
        ? (parseInt(row[step.name] || '0') / parseInt(row[steps[0].name] || '0')) * 100
        : 100
    }));

    return {
      funnel,
      totalUsers: funnel[0]?.users || 0,
      period: { startDate, endDate }
    };
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehaviorAnalytics(
    userId: string,
    days: number = 30
  ): Promise<any> {
    const result = await this.db.query(`
      SELECT
        event_name,
        event_type,
        COUNT(*) as event_count,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence
      FROM analytics_events
      WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY event_name, event_type
      ORDER BY event_count DESC
    `, [userId]);

    return {
      userId,
      period: `${days} days`,
      events: result.rows,
      totalEvents: result.rows.reduce((sum, row) => sum + parseInt(row.event_count), 0)
    };
  }

  /**
   * Send event to Google Analytics 4
   */
  private async sendToGA4(event: AnalyticsEvent): Promise<void> {
    try {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.ga4MeasurementId}&api_secret=${this.ga4ApiSecret}`;

      const payload = {
        client_id: event.sessionId || event.userId || 'anonymous',
        user_id: event.userId,
        events: [{
          name: event.eventName,
          parameters: {
            ...event.eventData,
            engagement_time_msec: 100,
            session_id: event.sessionId
          }
        }]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`GA4 API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending to GA4:', error);
      throw error;
    }
  }

  /**
   * Hash user ID for consistent A/B test assignment
   */
  private hashUserForTest(userId: string, testId: string): number {
    const hash = this.simpleHash(userId + testId);
    return hash / 0xFFFFFFFF; // Normalize to 0-1
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & 0xFFFFFFFF; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Select variant based on weight
   */
  private selectVariantByWeight(variants: Record<string, ABTestVariant>): string {
    const totalWeight = Object.values(variants).reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const [name, variant] of Object.entries(variants)) {
      random -= variant.weight;
      if (random <= 0) {
        return name;
      }
    }

    return Object.keys(variants)[0]; // Fallback to first variant
  }

  /**
   * Check if user properties match targeting rules
   */
  private matchesTargetingRules(
    userProperties: Record<string, any>,
    rules: Record<string, any>
  ): boolean {
    for (const [key, rule] of Object.entries(rules)) {
      if (!(key in userProperties)) {
        return false;
      }

      const userValue = userProperties[key];
      const ruleValue = rule;

      if (Array.isArray(ruleValue)) {
        if (!ruleValue.includes(userValue)) {
          return false;
        }
      } else if (typeof ruleValue === 'object' && ruleValue !== null) {
        if (ruleValue.min && userValue < ruleValue.min) return false;
        if (ruleValue.max && userValue > ruleValue.max) return false;
        if (ruleValue.equals && userValue !== ruleValue.equals) return false;
      } else if (userValue !== ruleValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process pending analytics events
   */
  async processPendingEvents(): Promise<number> {
    const result = await this.db.query(`
      SELECT * FROM analytics_events
      WHERE processed = false
      ORDER BY created_at ASC
      LIMIT 100
    `);

    let processed = 0;

    for (const row of result.rows) {
      try {
        const event: AnalyticsEvent = {
          eventName: row.event_name,
          eventType: row.event_type,
          userId: row.user_id,
          sessionId: row.session_id,
          eventData: row.event_data || {},
          userProperties: row.user_properties || {},
          platform: row.platform,
          ipAddress: row.ip_address,
          userAgent: row.user_agent
        };

        // Resend to GA4 if it failed before
        if (this.ga4MeasurementId && this.ga4ApiSecret) {
          await this.sendToGA4(event);
        }

        await this.db.query(`
          UPDATE analytics_events
          SET processed = true, processed_at = NOW()
          WHERE id = $1
        `, [row.id]);

        processed++;
      } catch (error) {
        console.error(`Error processing event ${row.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Cleanup old analytics events
   */
  async cleanupOldEvents(retentionDays: number = 90): Promise<number> {
    const result = await this.db.query(`
      DELETE FROM analytics_events
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
      RETURNING id
    `);

    return result.rows.length;
  }
}

// Singleton instance
export let analyticsService: AnalyticsService;

export function initializeAnalyticsService(db: DatabaseService): AnalyticsService {
  analyticsService = new AnalyticsService(db);
  return analyticsService;
}