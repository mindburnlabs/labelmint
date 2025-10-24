import { query } from '../database/connection';

interface FreeTierInfo {
  userId: number;
  freeLabelsRemaining: number;
  freeLabelsUsed: number;
  trialStartedAt: Date;
  trialExpiresAt: Date;
  isExpired: boolean;
  daysRemaining: number;
  conversionEmailsSent: number;
  convertedToPaid: boolean;
}

interface ConversionEmail {
  template: string;
  subject: string;
  trigger: number; // Labels remaining trigger
}

export class FreeTierService {
  private static readonly FREE_LABELS_COUNT = 100;
  private static readonly TRIAL_DURATION_DAYS = 30;

  private conversionEmails: ConversionEmail[] = [
    {
      template: 'halfway_email',
      subject: 'You\'re halfway through your free trial!',
      trigger: 50
    },
    {
      template: 'low_labels_email',
      subject: 'Only 20 labels left - upgrade now!',
      trigger: 20
    },
    {
      template: 'last_labels_email',
      subject: 'Your free labels are running out',
      trigger: 5
    },
    {
      template: 'expired_email',
      subject: 'Your free trial has expired',
      trigger: 0
    }
  ];

  async initializeFreeTier(userId: number, campaignSource?: string): Promise<FreeTierInfo> {
    // Check if already exists
    const existing = await query(
      'SELECT * FROM free_tier_accounts WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length > 0) {
      return this.mapToFreeTierInfo(existing.rows[0]);
    }

    // Create new free tier account
    await query(`
      INSERT INTO free_tier_accounts
      (user_id, free_labels_remaining, trial_started_at, trial_expires_at, initial_campaign_source)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '${this.TRIAL_DURATION_DAYS} days', $3)
    `, [userId, this.FREE_LABELS_COUNT, campaignSource]);

    // Track analytics
    await query(`
      INSERT INTO analytics_events (event_type, user_id, properties, created_at)
      VALUES ('free_trial_started', $1, $2, NOW())
    `, [userId, JSON.stringify({
      free_labels: this.FREE_LABELS_COUNT,
      campaign_source: campaignSource
    })]);

    const result = await query(
      'SELECT * FROM free_tier_accounts WHERE user_id = $1',
      [userId]
    );

    return this.mapToFreeTierInfo(result.rows[0]);
  }

  async useFreeLabels(userId: number, labelsToUse: number): Promise<{
    success: boolean;
    labelsUsed: number;
    remaining: number;
    isExpired: boolean;
    message?: string;
  }> {
    const freeTier = await this.getFreeTierInfo(userId);

    if (!freeTier) {
      return {
        success: false,
        labelsUsed: 0,
        remaining: 0,
        isExpired: false,
        message: 'Free tier not found'
      };
    }

    if (freeTier.isExpired) {
      return {
        success: false,
        labelsUsed: 0,
        remaining: 0,
        isExpired: true,
        message: 'Free trial has expired'
      };
    }

    if (freeTier.freeLabelsRemaining < labelsToUse) {
      return {
        success: false,
        labelsUsed: 0,
        remaining: freeTier.freeLabelsRemaining,
        isExpired: false,
        message: `Not enough free labels. Only ${freeTier.freeLabelsRemaining} remaining.`
      };
    }

    // Update usage
    await query(`
      UPDATE free_tier_accounts
      SET free_labels_used = free_labels_used + $1,
          free_labels_remaining = free_labels_remaining - $1,
          updated_at = NOW()
      WHERE user_id = $2
    `, [labelsToUse, userId]);

    // Check for conversion email triggers
    await this.checkConversionEmailTriggers(userId, freeTier.freeLabelsRemaining - labelsToUse);

    // Track usage
    await query(`
      INSERT INTO analytics_events (event_type, user_id, properties, created_at)
      VALUES ('free_labels_used', $1, $2, NOW())
    `, [userId, JSON.stringify({
      labels_used: labelsToUse,
      remaining: freeTier.freeLabelsRemaining - labelsToUse
    })]);

    const updated = await this.getFreeTierInfo(userId);

    return {
      success: true,
      labelsUsed,
      remaining: updated!.freeLabelsRemaining,
      isExpired: updated!.isExpired
    };
  }

  async getFreeTierInfo(userId: number): Promise<FreeTierInfo | null> {
    const result = await query(
      'SELECT * FROM free_tier_accounts WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToFreeTierInfo(result.rows[0]);
  }

  private mapToFreeTierInfo(row: any): FreeTierInfo {
    const now = new Date();
    const expiresAt = new Date(row.trial_expires_at);
    const isExpired = now > expiresAt;
    const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      userId: row.user_id,
      freeLabelsRemaining: row.free_labels_remaining,
      freeLabelsUsed: row.free_labels_used,
      trialStartedAt: row.trial_started_at,
      trialExpiresAt: row.trial_expires_at,
      isExpired,
      daysRemaining,
      conversionEmailsSent: row.conversion_emails_sent,
      convertedToPaid: row.converted_to_paid
    };
  }

  private async checkConversionEmailTriggers(userId: number, remainingLabels: number): Promise<void> {
    const freeTier = await this.getFreeTierInfo(userId);
    if (!freeTier || freeTier.convertedToPaid) return;

    for (const email of this.conversionEmails) {
      if (remainingLabels <= email.trigger && remainingLabels > email.trigger - 5) {
        // Check if already sent
        const alreadySent = await query(`
          SELECT 1 FROM email_sequences
          WHERE lead_id = $1
            AND template_name LIKE $2
            AND status != 'failed'
        `, [userId, `%${email.template}%`]);

        if (alreadySent.rows.length === 0) {
          await this.sendConversionEmail(userId, email);
        }
      }
    }

    // Check for expiration
    if (freeTier.daysRemaining <= 3 && freeTier.daysRemaining > 2) {
      const alreadySent = await query(`
        SELECT 1 FROM email_sequences
        WHERE lead_id = $1
          AND template_name = 'expiration_warning'
          AND sent_at > NOW() - INTERVAL '7 days'
      `, [userId]);

      if (alreadySent.rows.length === 0) {
        await this.sendExpirationWarning(userId);
      }
    }
  }

  private async sendConversionEmail(userId: number, email: ConversionEmail): Promise<void> {
    const templates = {
      halfway_email: {
        subject: email.subject,
        content: `
          <h2>You're halfway through your free trial! 🎯</h2>
          <p>Hi there!</p>
          <p>You've used 50 of your 100 free labels on labelmint.it. Great progress!</p>
          <p>How's your experience been so far? We'd love to hear your feedback.</p>
          <p>Ready to continue scaling? Use code <strong>FREELABELS50</strong> for 50% off your first paid month.</p>
          <p><a href="https://labelmint.it/pricing" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Pricing Plans</a></p>
          <p>Best,<br>Team labelmint.it</p>
        `
      },
      low_labels_email: {
        subject: email.subject,
        content: `
          <h2>Only 20 free labels remaining ⏰</h2>
          <p>Hi!</p>
          <p>You're running low on free labels. Don't let your ML progress slow down!</p>
          <p>Our paid plans start at just $49/month and include:</p>
          <ul>
            <li>Unlimited labeling tasks</li>
            <li>AI-assisted labeling (40% cost savings)</li>
            <li>99%+ accuracy guarantee</li>
            <li>Priority support</li>
          </ul>
          <p><a href="https://labelmint.it/upgrade?user=${userId}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Now</a></p>
          <p>Questions? Just reply to this email!</p>
          <p>Cheers,<br>labelmint.it Team</p>
        `
      },
      last_labels_email: {
        subject: email.subject,
        content: `
          <h2>Last chance - Your free labels are almost gone! 🔥</h2>
          <p>Hi!</p>
          <p>You have only 5 free labels left. After that, your labeling will pause.</p>
          <p>Don't lose momentum on your ML projects! Upgrade now and keep the training data flowing.</p>
          <p><strong>Limited time offer:</strong> Get 2 months at 50% off with code <strong>KEEPGOING50</strong></p>
          <p><a href="https://labelmint.it/upgrade?user=${userId}&code=KEEPGOING50" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Claim Your Discount</a></p>
          <p>This offer expires in 48 hours!</p>
          <p>Best,<br>labelmint.it</p>
        `
      },
      expired_email: {
        subject: email.subject,
        content: `
          <h2>Your free trial has expired</h2>
          <p>Hi!</p>
          <p>Your 100 free labels on labelmint.it have been used up.</p>
          <p>Ready to continue? We have a special welcome offer for you:</p>
          <ul>
            <li>First month 50% off</li>
            <li>Free setup assistance</li>
            <li>Personal onboarding call</li>
          </ul>
          <p><a href="https://labelmint.it/reactivate?user=${userId}" style="background: #6f42c1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reactivate Your Account</a></p>
          <p>We'd love to have you back!</p>
          <p>Warmly,<br>labelmint.it Team</p>
        `
      }
    };

    const template = templates[email.template as keyof typeof templates];
    if (!template) return;

    // Get user email
    const userResult = await query(`
      SELECT u.email, u.first_name, u.telegram_id
      FROM users u
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];

    // Save email to queue (would be sent by email service)
    await query(`
      INSERT INTO email_sequences
      (lead_id, template_name, subject, content, status, scheduled_at)
      VALUES ($1, $2, $3, $4, 'scheduled', NOW())
    `, [userId, email.template, template.subject, template.content]);

    // Update conversion emails count
    await query(`
      UPDATE free_tier_accounts
      SET conversion_emails_sent = conversion_emails_sent + 1,
          last_conversion_email_at = NOW()
      WHERE user_id = $1
    `, [userId]);

    // Track event
    await query(`
      INSERT INTO analytics_events (event_type, user_id, properties, created_at)
      VALUES ('conversion_email_sent', $1, $2, NOW())
    `, [userId, JSON.stringify({
      template: email.template,
      remaining_labels: email.trigger
    })]);
  }

  private async sendExpirationWarning(userId: number): Promise<void> {
    const userResult = await query(
      'SELECT first_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];

    await query(`
      INSERT INTO email_sequences
      (lead_id, template_name, subject, content, status, scheduled_at)
      VALUES ($1, 'expiration_warning', $2, $3, 'scheduled', NOW())
    `, [userId,
      'Your free trial expires in 3 days',
      `<h2>Trial Expiration Notice</h2>
       <p>Hi ${user.first_name || 'there'}!</p>
       <p>Your free trial on labelmint.it expires in 3 days.</p>
       <p>You've used ${this.FREE_LABELS_COUNT} free labels so far. Ready to continue?</p>
       <p><a href="https://labelmint.it/upgrade?user=${userId}">Upgrade Now</a></p>`
    ]);
  }

  async convertToPaid(userId: number, planId: string): Promise<void> {
    await query(`
      UPDATE free_tier_accounts
      SET converted_to_paid = true,
          converted_at = NOW()
      WHERE user_id = $1
    `, [userId]);

    // Track conversion
    await query(`
      INSERT INTO analytics_events (event_type, user_id, properties, created_at)
      VALUES ('free_trial_converted', $1, $2, NOW())
    `, [userId, JSON.stringify({
      plan_id: planId,
      free_labels_used: (await query('SELECT free_labels_used FROM free_tier_accounts WHERE user_id = $1', [userId])).rows[0]?.free_labels_used || 0
    })]);
  }

  async getFreeTierAnalytics(): Promise<any> {
    const result = await query(`
      SELECT
        COUNT(*) as total_free_trials,
        COUNT(*) FILTER (WHERE converted_to_paid = true) as converted,
        COUNT(*) FILTER (WHERE trial_expires_at > NOW() AND converted_to_paid = false) as active_trials,
        COUNT(*) FILTER (WHERE trial_expires_at <= NOW() AND converted_to_paid = false) as expired_trials,
        AVG(free_labels_used) as avg_labels_used,
        SUM(free_labels_used) as total_labels_used,
        COUNT(*) FILTER (WHERE conversion_emails_sent >= 3) as high_engagement_users
      FROM free_tier_accounts
      WHERE trial_started_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const conversionRate = result.rows[0].total_free_trials > 0
      ? (result.rows[0].converted / result.rows[0].total_free_trials * 100).toFixed(2)
      : 0;

    const campaignSources = await query(`
      SELECT
        initial_campaign_source,
        COUNT(*) as signups,
        COUNT(*) FILTER (WHERE converted_to_paid = true) as conversions,
        AVG(free_labels_used) as avg_usage
      FROM free_tier_accounts
      WHERE initial_campaign_source IS NOT NULL
        AND trial_started_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY initial_campaign_source
      ORDER BY conversions DESC
    `);

    return {
      ...result.rows[0],
      conversion_rate: parseFloat(conversionRate),
      campaign_sources: campaignSources.rows
    };
  }

  async extendFreeTrial(userId: number, days: number): Promise<void> {
    await query(`
      UPDATE free_tier_accounts
      SET trial_expires_at = trial_expires_at + INTERVAL '${days} days',
          updated_at = NOW()
      WHERE user_id = $1
    `, [userId]);

    // Track extension
    await query(`
      INSERT INTO analytics_events (event_type, user_id, properties, created_at)
      VALUES ('free_trial_extended', $1, $2, NOW())
    `, [userId, JSON.stringify({ days_extended: days })]);
  }

  async addBonusLabels(userId: number, bonusLabels: number): Promise<void> {
    await query(`
      UPDATE free_tier_accounts
      SET free_labels_remaining = free_labels_remaining + $1,
          updated_at = NOW()
      WHERE user_id = $1 AND converted_to_paid = false
    `, [userId, bonusLabels]);

    // Track bonus
    await query(`
      INSERT INTO analytics_events (event_type, user_id, properties, created_at)
      VALUES ('bonus_labels_added', $1, $2, NOW())
    `, [userId, JSON.stringify({ bonus_labels })]);
  }
}

export default FreeTierService;