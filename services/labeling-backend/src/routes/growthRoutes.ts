import { Router } from 'express';
import { query } from '../database/connection';
import TwitterService from '../services/twitterService';
import RedditService from '../services/redditService';
import EmailService from '../services/emailService';
import FreeTierService from '../services/freeTierService';

const router = Router();
const twitterService = new TwitterService();
const redditService = new RedditService();
const emailService = new EmailService();
const freeTierService = new FreeTierService();

// POST /api/growth/free-tier/init - Initialize free tier for user
router.post('/free-tier/init', async (req, res) => {
  try {
    const { user_id, campaign_source } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const freeTier = await freeTierService.initializeFreeTier(user_id, campaign_source);

    res.json({
      success: true,
      free_tier: {
        free_labels_remaining: freeTier.freeLabelsRemaining,
        free_labels_used: freeTier.freeLabelsUsed,
        trial_expires_at: freeTier.trialExpiresAt,
        days_remaining: freeTier.daysRemaining
      }
    });
  } catch (error: any) {
    console.error('Error initializing free tier:', error);
    res.status(500).json({ error: 'Failed to initialize free tier' });
  }
});

// POST /api/growth/free-tier/use - Use free labels
router.post('/free-tier/use', async (req, res) => {
  try {
    const { user_id, labels_to_use } = req.body;

    if (!user_id || !labels_to_use) {
      return res.status(400).json({ error: 'user_id and labels_to_use are required' });
    }

    const result = await freeTierService.useFreeLabels(user_id, labels_to_use);

    res.json({
      success: result.success,
      labels_used: result.labelsUsed,
      remaining: result.remaining,
      is_expired: result.isExpired,
      message: result.message
    });
  } catch (error: any) {
    console.error('Error using free labels:', error);
    res.status(500).json({ error: 'Failed to use free labels' });
  }
});

// GET /api/growth/free-tier/:userId - Get free tier info
router.get('/free-tier/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const freeTier = await freeTierService.getFreeTierInfo(userId);

    if (!freeTier) {
      return res.status(404).json({ error: 'Free tier not found' });
    }

    res.json({
      success: true,
      free_tier: freeTier
    });
  } catch (error: any) {
    console.error('Error getting free tier info:', error);
    res.status(500).json({ error: 'Failed to get free tier info' });
  }
});

// POST /api/growth/free-tier/extend - Extend free trial
router.post('/free-tier/extend', async (req, res) => {
  try {
    const { user_id, days } = req.body;

    if (!user_id || !days) {
      return res.status(400).json({ error: 'user_id and days are required' });
    }

    await freeTierService.extendFreeTrial(user_id, days);

    const updated = await freeTierService.getFreeTierInfo(user_id);

    res.json({
      success: true,
      message: `Trial extended by ${days} days`,
      new_expiry: updated?.trialExpiresAt
    });
  } catch (error: any) {
    console.error('Error extending trial:', error);
    res.status(500).json({ error: 'Failed to extend trial' });
  }
});

// POST /api/growth/leads/create - Create new lead
router.post('/leads/create', async (req, res) => {
  try {
    const { email, name, company, source, source_details, tags } = req.body;

    if (!email || !source) {
      return res.status(400).json({ error: 'email and source are required' });
    }

    // Check if lead exists
    const existing = await query(
      'SELECT id FROM leads WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Lead already exists' });
    }

    // Create lead
    const result = await query(`
      INSERT INTO leads (email, name, company, source, source_details, tags, lead_score, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      email,
      name,
      company,
      source,
      JSON.stringify(source_details || {}),
      tags || [],
      10, // Default score
      'new'
    ]);

    // Track event
    await query(`
      INSERT INTO analytics_events (event_type, lead_id, properties, created_at)
      VALUES ('lead_created', $1, $2, NOW())
    `, [result.rows[0].id, JSON.stringify({ source, tags })]);

    res.json({
      success: true,
      lead: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// GET /api/growth/leads - Get leads with filters
router.get('/leads', async (req, res) => {
  try {
    const {
      status,
      source,
      limit = 50,
      offset = 0,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (source) {
      whereClause += ` AND source = $${paramIndex++}`;
      params.push(source);
    }

    const result = await query(`
      SELECT *,
        CASE
          WHEN updated_at > created_at THEN updated_at
          ELSE created_at
        END as last_activity
      FROM leads
      WHERE ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, parseInt(limit as string), parseInt(offset as string)]);

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM leads
      WHERE ${whereClause}
    `, params);

    res.json({
      success: true,
      leads: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: (parseInt(offset as string) + parseInt(limit as string)) < parseInt(countResult.rows[0].total)
      }
    });
  } catch (error: any) {
    console.error('Error getting leads:', error);
    res.status(500).json({ error: 'Failed to get leads' });
  }
});

// PUT /api/growth/leads/:id/update - Update lead
router.put('/leads/:id/update', async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const { status, notes, tags, lead_score } = req.body;

    const updateFields = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    if (tags !== undefined) {
      updateFields.push(`tags = $${paramIndex++}`);
      params.push(tags);
    }

    if (lead_score !== undefined) {
      updateFields.push(`lead_score = $${paramIndex++}`);
      params.push(lead_score);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(leadId);

    await query(`
      UPDATE leads
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `, params);

    // Track event
    if (status) {
      await query(`
        INSERT INTO analytics_events (event_type, lead_id, properties, created_at)
        VALUES ('lead_status_updated', $1, $2, NOW())
      `, [leadId, JSON.stringify({ new_status: status })]);
    }

    res.json({
      success: true,
      message: 'Lead updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// POST /api/growth/campaigns/create - Create new campaign
router.post('/campaigns/create', async (req, res) => {
  try {
    const { name, type, settings, start_date, end_date, daily_limit } = req.body;

    if (!name || !type || !settings) {
      return res.status(400).json({ error: 'name, type, and settings are required' });
    }

    const result = await query(`
      INSERT INTO campaigns (name, type, settings, start_date, end_date, daily_limit)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, type, JSON.stringify(settings), start_date, end_date || null, daily_limit || 50]);

    res.json({
      success: true,
      campaign: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /api/growth/campaigns - Get all campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*,
        COUNT(es.id) as emails_sent,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted') as conversions
      FROM campaigns c
      LEFT JOIN email_sequences es ON es.campaign_id = c.id
      LEFT JOIN leads l ON l.id = es.lead_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json({
      success: true,
      campaigns: result.rows
    });
  } catch (error: any) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

// POST /api/growth/automations/twitter/run - Run Twitter automation
router.post('/automations/twitter/run', async (req, res) => {
  try {
    await twitterService.monitorKeywords();

    res.json({
      success: true,
      message: 'Twitter monitoring completed'
    });
  } catch (error: any) {
    console.error('Error running Twitter automation:', error);
    res.status(500).json({ error: 'Failed to run Twitter automation' });
  }
});

// POST /api/growth/automations/reddit/run - Run Reddit automation
router.post('/automations/reddit/run', async (req, res) => {
  try {
    await redditService.monitorSubreddits();

    res.json({
      success: true,
      message: 'Reddit monitoring completed'
    });
  } catch (error: any) {
    console.error('Error running Reddit automation:', error);
    res.status(500).json({ error: 'Failed to run Reddit automation' });
  }
});

// POST /api/growth/automations/email/run - Run email campaign
router.post('/automations/email/run', async (req, res) => {
  try {
    await emailService.processEmailCampaign();

    res.json({
      success: true,
      message: 'Email campaign processed'
    });
  } catch (error: any) {
    console.error('Error running email campaign:', error);
    res.status(500).json({ error: 'Failed to run email campaign' });
  }
});

// POST /api/growth/automations/email/followups - Send follow-up emails
router.post('/automations/email/followups', async (req, res) => {
  try {
    await emailService.sendFollowUpEmails();

    res.json({
      success: true,
      message: 'Follow-up emails processed'
    });
  } catch (error: any) {
    console.error('Error sending follow-ups:', error);
    res.status(500).json({ error: 'Failed to send follow-ups' });
  }
});

// POST /api/growth/automations/scrape/startups - Scrape startups from Crunchbase
router.post('/automations/scrape/startups', async (req, res) => {
  try {
    await emailService.scrapeCrunchbaseStartups();

    res.json({
      success: true,
      message: 'Startup scraping completed'
    });
  } catch (error: any) {
    console.error('Error scraping startups:', error);
    res.status(500).json({ error: 'Failed to scrape startups' });
  }
});

// GET /api/growth/analytics/overview - Get growth analytics overview
router.get('/analytics/overview', async (req, res) => {
  try {
    const period = req.query.period || '7'; // days

    // Lead funnel metrics
    const funnelResult = await query(`
      SELECT *
      FROM lead_funnel
    `);

    // Free tier metrics
    const freeTierResult = await freeTierService.getFreeTierAnalytics();

    // Social media metrics
    const [twitterResult, redditResult] = await Promise.all([
      twitterService.getAnalytics(),
      redditService.getAnalytics()
    ]);

    // Email metrics
    const emailResult = await emailService.getEmailAnalytics();

    // Campaign performance
    const campaignResult = await query(`
      SELECT *
      FROM campaign_performance
      WHERE status != 'completed'
        AND start_date >= CURRENT_DATE - INTERVAL '${period} days'
    `);

    // Conversion metrics
    const conversionResult = await query(`
      SELECT
        COUNT(*) as total_conversions,
        AVG(CASE
          WHEN converted_at IS NOT NULL AND first_contact_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (converted_at - first_contact_at))/86400
          ELSE NULL
        END) as avg_days_to_convert,
        source,
        COUNT(*) FILTER (WHERE status = 'converted') as conversions
      FROM leads
      WHERE first_contact_at >= CURRENT_DATE - INTERVAL '${period} days'
      GROUP BY source
      ORDER BY conversions DESC
    `);

    res.json({
      success: true,
      period: `${period} days`,
      funnel: funnelResult.rows[0],
      free_tier: freeTierResult,
      social_media: {
        twitter: twitterResult.weekly,
        reddit: redditResult.weekly
      },
      email: emailResult.weekly,
      campaigns: campaignResult.rows,
      conversions: conversionResult.rows
    });
  } catch (error: any) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// GET /api/growth/analytics/social - Get social media analytics
router.get('/analytics/social', async (req, res) => {
  try {
    const [twitterAnalytics, redditAnalytics] = await Promise.all([
      twitterService.getAnalytics(),
      redditService.getAnalytics()
    ]);

    res.json({
      success: true,
      twitter: twitterAnalytics,
      reddit: redditAnalytics
    });
  } catch (error: any) {
    console.error('Error getting social analytics:', error);
    res.status(500).json({ error: 'Failed to get social analytics' });
  }
});

// GET /api/growth/analytics/email - Get email analytics
router.get('/analytics/email', async (req, res) => {
  try {
    const analytics = await emailService.getEmailAnalytics();

    res.json({
      success: true,
      ...analytics
    });
  } catch (error: any) {
    console.error('Error getting email analytics:', error);
    res.status(500).json({ error: 'Failed to get email analytics' });
  }
});

// GET /api/growth/analytics/free-tier - Get free tier analytics
router.get('/analytics/free-tier', async (req, res) => {
  try {
    const analytics = await freeTierService.getFreeTierAnalytics();

    res.json({
      success: true,
      ...analytics
    });
  } catch (error: any) {
    console.error('Error getting free tier analytics:', error);
    res.status(500).json({ error: 'Failed to get free tier analytics' });
  }
});

// POST /api/growth/track/event - Track custom analytics event
router.post('/track/event', async (req, res) => {
  try {
    const { event_type, user_id, lead_id, campaign_id, properties, utm_source, utm_medium, utm_campaign } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    await query(`
      INSERT INTO analytics_events
      (event_type, user_id, lead_id, campaign_id, properties, utm_source, utm_medium, utm_campaign, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      event_type,
      user_id || null,
      lead_id || null,
      campaign_id || null,
      JSON.stringify(properties || {}),
      utm_source || null,
      utm_medium || null,
      utm_campaign || null
    ]);

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// POST /api/growth/webhook/convert - Handle conversion webhook (e.g., from Stripe)
router.post('/webhook/convert', async (req, res) => {
  try {
    const { user_id, plan_id, amount } = req.body;

    if (!user_id || !plan_id) {
      return res.status(400).json({ error: 'user_id and plan_id are required' });
    }

    // Convert free tier
    await freeTierService.convertToPaid(user_id, plan_id);

    // Update lead status if exists
    await query(`
      UPDATE leads
      SET status = 'converted', converted_at = NOW()
      WHERE source_details->>'telegram_id' = $1
    `, [user_id]);

    // Track conversion
    await query(`
      INSERT INTO analytics_events (event_type, user_id, properties, created_at)
      VALUES ('conversion', $1, $2, NOW())
    `, [user_id, JSON.stringify({ plan_id, amount })]);

    res.json({
      success: true,
      message: 'Conversion tracked successfully'
    });
  } catch (error: any) {
    console.error('Error handling conversion webhook:', error);
    res.status(500).json({ error: 'Failed to handle conversion' });
  }
});

export default router;