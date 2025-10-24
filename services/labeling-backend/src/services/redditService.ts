import { query } from '../database/connection';
import fetch from 'node-fetch';

interface RedditConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username: string;
  password: string;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  created_utc: number;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
}

interface RedditComment {
  id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
}

export class RedditService {
  private config: RedditConfig;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor() {
    this.config = {
      clientId: process.env.REDDIT_CLIENT_ID || '',
      clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
      userAgent: process.env.REDDIT_USER_AGENT || 'labelmint-growth-bot/1.0',
      username: process.env.REDDIT_USERNAME || '',
      password: process.env.REDDIT_PASSWORD || ''
    };

    if (!this.config.clientId) {
      console.warn('⚠️ Reddit credentials not configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.config.userAgent
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error('Failed to get Reddit access token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 minute early

    return this.accessToken;
  }

  private async makeRequest(url: string): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': this.config.userAgent
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    return response.json();
  }

  async monitorSubreddits(): Promise<void> {
    console.log('🤖 Starting Reddit monitoring...');

    const subreddits = [
      'MachineLearning',
      'deeplearning',
      'MachineLearningJobs',
      'learnmachinelearning',
      'DataScience',
      'MLQuestions',
      'compsci',
      'artificial'
    ];

    const keywords = [
      'data labeling',
      'data annotation',
      'label data',
      'annotate data',
      'training data',
      'dataset',
      'labeled dataset',
      'data annotation tools',
      'crowdsourcing',
      'data labeling service',
      'need labeled data',
      'where to get labeled data',
      'how to label data',
      'dataset creation',
      'ml dataset',
      'supervised learning data'
    ];

    for (const subreddit of subreddits) {
      await this.monitorSubreddit(subreddit, keywords);
    }
  }

  private async monitorSubreddit(subreddit: string, keywords: string[]): Promise<void> {
    try {
      // Get recent posts
      const url = `https://oauth.reddit.com/r/${subreddit}/new?limit=100`;
      const data = await this.makeRequest(url);

      if (!data.data?.children) {
        return;
      }

      let postsProcessed = 0;
      let dmsSent = 0;

      for (const post of data.data.children) {
        const redditPost: RedditPost = post.data;

        // Skip if older than 24 hours
        if (Date.now() / 1000 - redditPost.created_utc > 86400) {
          continue;
        }

        // Check if already processed
        const exists = await query(
          'SELECT id FROM social_engagements WHERE platform_id = $1',
          [redditPost.id]
        );

        if (exists.rows.length > 0) {
          continue;
        }

        // Check for keywords
        const text = (redditPost.title + ' ' + redditPost.selftext).toLowerCase();
        const matchedKeywords = keywords.filter(keyword => text.includes(keyword));

        if (matchedKeywords.length === 0) {
          continue;
        }

        // Save post
        await query(`
          INSERT INTO social_engagements
          (platform, platform_id, author_handle, content, keywords_matched, status, scraped_at)
          VALUES ($1, $2, $3, $4, $5, 'identified', NOW())
        `, [
          'reddit',
          redditPost.id,
          redditPost.author,
          redditPost.title + '\n\n' + redditPost.selftext,
          matchedKeywords
        ]);

        // Send DM if appropriate
        if (this.shouldSendDM(redditPost, matchedKeywords)) {
          const dmSent = await this.sendDirectMessage(redditPost.author, matchedKeywords);
          if (dmSent) {
            dmsSent++;
            await this.createLeadFromReddit(redditPost, matchedKeywords);
          }
        }

        postsProcessed++;
      }

      // Also monitor comments
      await this.monitorComments(subreddit, keywords);

      console.log(`Reddit monitoring for r/${subreddit}: ${postsProcessed} posts processed, ${dmsSent} DMs sent`);

    } catch (error) {
      console.error(`Error monitoring r/${subreddit}:`, error);
    }
  }

  private async monitorComments(subreddit: string, keywords: string[]): Promise<void> {
    try {
      const url = `https://oauth.reddit.com/r/${subreddit}/comments.json?limit=100`;
      const data = await this.makeRequest(url);

      if (!data.data?.children) {
        return;
      }

      for (const comment of data.data.children) {
        const redditComment: RedditComment = comment.data;

        // Skip if older than 24 hours
        if (Date.now() / 1000 - redditComment.created_utc > 86400) {
          continue;
        }

        // Check for keywords
        const text = redditComment.body.toLowerCase();
        const matchedKeywords = keywords.filter(keyword => text.includes(keyword));

        if (matchedKeywords.length === 0) {
          continue;
        }

        // Skip if already processed
        const exists = await query(
          'SELECT id FROM social_engagements WHERE platform_id = $1',
          [redditComment.id]
        );

        if (exists.rows.length > 0) {
          continue;
        }

        // Save comment
        await query(`
          INSERT INTO social_engagements
          (platform, platform_id, author_handle, content, keywords_matched, status, scraped_at)
          VALUES ($1, $2, $3, $4, $5, 'identified', NOW())
        `, [
          'reddit',
          redditComment.id,
          redditComment.author,
          redditComment.body,
          matchedKeywords
        ]);

        // Send DM for high-value comments
        if (redditComment.score > 5 && matchedKeywords.length > 1) {
          const dmSent = await this.sendDirectMessage(redditComment.author, matchedKeywords);
          if (dmSent) {
            await this.createLeadFromComment(redditComment, matchedKeywords);
          }
        }
      }
    } catch (error) {
      console.error(`Error monitoring comments in r/${subreddit}:`, error);
    }
  }

  private shouldSendDM(post: RedditPost, keywords: string[]): boolean {
    const text = (post.title + ' ' + post.selftext).toLowerCase();

    // Don't DM if it's a job post or self-promotion
    if (text.includes('hiring') || text.includes('we are hiring') || text.includes('job opening')) {
      return false;
    }

    // Don't DM if it's from a competitor
    if (text.includes('scale ai') || text.includes('labelbox') || text.includes('supervise')) {
      return false;
    }

    // Send DM if:
    // 1. Post has good engagement (score > 5 or > 2 comments)
    // 2. Contains specific high-intent keywords
    const hasEngagement = post.score > 5 || post.num_comments > 2;
    const hasHighIntent = keywords.some(k =>
      k.includes('need') || k.includes('looking for') || k.includes('where to')
    );

    return hasEngagement || hasHighIntent;
  }

  private async sendDirectMessage(username: string, keywords: string[]): Promise<boolean> {
    try {
      // Get best DM template
      const templateResult = await query(`
        SELECT template_content
        FROM reply_templates
        WHERE platform = 'reddit'
          AND template_type = 'helpful_dm'
          && keywords && $1
        ORDER BY success_rate DESC
        LIMIT 1
      `, [keywords]);

      if (templateResult.rows.length === 0) {
        return false;
      }

      const message = templateResult.rows[0].template_content;

      // Reddit's API doesn't support DMs via app-only auth
      // For now, we'll save the DM to be sent manually or via OAuth flow
      await query(`
        INSERT INTO email_sequences (campaign_id, lead_id, sequence_step, template_name, subject, content, status, scheduled_at)
        VALUES (
          (SELECT id FROM campaigns WHERE type = 'reddit' LIMIT 1),
          (SELECT id FROM leads WHERE source_details->>'reddit_username' = $1),
          1,
          'reddit_dm',
          'Data Labeling Solution',
          $2,
          'scheduled',
          NOW()
        )
      `, [username, message]);

      console.log(`DM queued for @${username}: ${message.substring(0, 50)}...`);
      return true;

    } catch (error) {
      console.error(`Error sending DM to ${username}:`, error);
      return false;
    }
  }

  private async createLeadFromReddit(post: RedditPost, keywords: string[]): Promise<void> {
    // Check if lead already exists
    const existingLead = await query(
      'SELECT id FROM leads WHERE source = $1 AND source_details->>\'reddit_username\' = $2',
      ['reddit', post.author]
    );

    if (existingLead.rows.length > 0) {
      return;
    }

    // Create new lead
    await query(`
      INSERT INTO leads (email, name, company, source, source_details, lead_score, status, tags, first_contact_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      `${post.author}@reddit.com`, // Placeholder email
      post.author,
      null, // Company unknown
      'reddit',
      JSON.stringify({
        reddit_username: post.author,
        reddit_id: post.id,
        subreddit: post.subreddit,
        score: post.score,
        comments: post.num_comments,
        keywords_matched: keywords,
        post_url: `https://reddit.com${post.permalink}`,
        has_ml_terms: keywords.some(k => k.includes('ml') || k.includes('machine learning'))
      }),
      25, // Base score for Reddit
      'contacted',
      ['reddit', 'social', 'dm_sent']
    ]);
  }

  private async createLeadFromComment(comment: RedditComment, keywords: string[]): Promise<void> {
    await query(`
      INSERT INTO leads (email, name, company, source, source_details, lead_score, status, tags, first_contact_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (email) DO NOTHING
    `, [
      `${comment.author}@reddit.com`,
      comment.author,
      null,
      'reddit',
      JSON.stringify({
        reddit_username: comment.author,
        reddit_id: comment.id,
        score: comment.score,
        keywords_matched: keywords,
        comment_url: `https://reddit.com${comment.permalink}`,
        source_type: 'comment'
      }),
      20,
      'contacted',
      ['reddit', 'comment', 'social']
    ]);
  }

  async getAnalytics(): Promise<any> {
    const result = await query(`
      SELECT
        COUNT(*) as total_posts_found,
        COUNT(*) FILTER (WHERE status = 'replied') as dms_sent,
        COUNT(DISTINCT author_handle) as unique_authors,
        AVG(CASE WHEN engagement_data->>'score' IS NOT NULL
          THEN (engagement_data->>'score')::INTEGER
          ELSE 0 END) as avg_score,
        COUNT(DISTINCT lead_id) as leads_created
      FROM social_engagements
      WHERE platform = 'reddit'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    const topSubreddits = await query(`
      SELECT
        source_details->>'subreddit' as subreddit,
        COUNT(*) as count
      FROM social_engagements
      WHERE platform = 'reddit'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND source_details->>'subreddit' IS NOT NULL
      GROUP BY source_details->>'subreddit'
      ORDER BY count DESC
      LIMIT 5
    `);

    return {
      weekly: result.rows[0],
      top_subreddits: topSubreddits.rows
    };
  }
}

export default RedditService;