import { query } from '../database/connection';
import fetch from 'node-fetch';

interface TwitterConfig {
  bearerToken: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface Tweet {
  id: string;
  text: string;
  author: {
    id: string;
    username: string;
    name: string;
    followers_count: number;
    verified: boolean;
  };
  created_at: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}

interface SearchQuery {
  query: string;
  keywords: string[];
  exclude?: string[];
  minFollowers?: number;
  verifiedOnly?: boolean;
  lang?: string;
}

export class TwitterService {
  private config: TwitterConfig;
  private rateLimitReset = 0;
  private remainingRequests = 300;

  constructor() {
    this.config = {
      bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
      apiKey: process.env.TWITTER_API_KEY || '',
      apiSecret: process.env.TWITTER_API_SECRET || '',
      accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || ''
    };

    if (!this.config.bearerToken) {
      console.warn('⚠️ Twitter credentials not configured');
    }
  }

  private async makeRequest(url: string): Promise<any> {
    if (this.remainingRequests <= 1 && Date.now() < this.rateLimitReset) {
      const waitTime = this.rateLimitReset - Date.now();
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 429) {
      const resetTime = parseInt(response.headers.get('x-rate-limit-reset') || '0') * 1000;
      this.rateLimitReset = resetTime;
      this.remainingRequests = 0;
      throw new Error('Rate limited');
    }

    this.remainingRequests = parseInt(response.headers.get('x-rate-limit-remaining') || '0');

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async searchTweets(searchQuery: SearchQuery): Promise<Tweet[]> {
    try {
      const { query, keywords, exclude = [], minFollowers = 100, verifiedOnly = false, lang = 'en' } = searchQuery;

      // Build search query
      let fullQuery = keywords.join(' OR ');

      if (exclude.length > 0) {
        fullQuery += ` -${exclude.join(' -')}`;
      }

      if (verifiedOnly) {
        fullQuery += ' filter:verified';
      }

      fullQuery += ` lang:${lang} -is:retweet`;

      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(fullQuery)}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=public_metrics,verified&max_results=100`;

      const data = await this.makeRequest(url);

      if (!data.data || !data.includes?.users) {
        return [];
      }

      // Filter by follower count
      const users = new Map(data.includes.users.map((user: any) => [user.id, user]));

      return data.data
        .filter((tweet: any) => {
          const author = users.get(tweet.author_id);
          return author && author.public_metrics?.followers_count >= minFollowers;
        })
        .map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          author: {
            id: tweet.author_id,
            username: users.get(tweet.author_id)?.username || '',
            name: users.get(tweet.author_id)?.name || '',
            followers_count: users.get(tweet.author_id)?.public_metrics?.followers_count || 0,
            verified: users.get(tweet.author_id)?.verified || false
          },
          created_at: tweet.created_at,
          public_metrics: tweet.public_metrics
        }));
    } catch (error) {
      console.error('Error searching tweets:', error);
      return [];
    }
  }

  async replyToTweet(tweetId: string, replyText: string): Promise<{ success: boolean; replyId?: string; error?: string }> {
    try {
      const url = 'https://api.twitter.com/2/tweets';

      const payload = {
        text: replyText,
        reply: {
          in_reply_to_tweet_id: tweetId
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.bearerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.detail || 'Failed to post reply'
        };
      }

      const data = await response.json();
      return {
        success: true,
        replyId: data.data?.id
      };
    } catch (error: any) {
      console.error('Error replying to tweet:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async monitorKeywords(): Promise<void> {
    console.log('🐦 Starting Twitter monitoring...');

    const searchQueries: SearchQuery[] = [
      {
        query: 'data labeling needs',
        keywords: [
          'need labeled data',
          'looking for data labelers',
          'need data annotation',
          'seeking data annotators',
          'dataset labeling help',
          'training data labeling',
          'ml data labeling',
          'ai dataset labeling'
        ],
        exclude: ['porn', 'adult', 'spam'],
        minFollowers: 500,
        verifiedOnly: false
      },
      {
        query: 'ml dataset creation',
        keywords: [
          'creating ml dataset',
          'building training data',
          'prepare dataset for ml',
          'need training data',
          'ml model data',
          'ai model training',
          'supervised learning data'
        ],
        exclude: ['job', 'career', 'hiring'],
        minFollowers: 1000,
        verifiedOnly: false
      }
    ];

    for (const searchQuery of searchQueries) {
      await this.processSearchQuery(searchQuery);
    }
  }

  private async processSearchQuery(searchQuery: SearchQuery): Promise<void> {
    try {
      // Check if already processed recent tweets
      const lastProcessed = await query(
        'SELECT last_tweet_id FROM twitter_monitoring_queue WHERE search_query = $1',
        [searchQuery.query]
      );

      const tweets = await this.searchTweets(searchQuery);
      console.log(`Found ${tweets.length} tweets for query: ${searchQuery.query}`);

      let newLeads = 0;
      let repliesSent = 0;

      for (const tweet of tweets) {
        // Check if already processed
        const exists = await query(
          'SELECT id FROM social_engagements WHERE platform_id = $1',
          [tweet.id]
        );

        if (exists.rows.length > 0) {
          continue;
        }

        // Save to database
        await query(`
          INSERT INTO social_engagements
          (platform, platform_id, author_handle, author_followers, content, keywords_matched, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'identified')
        `, [
          'twitter',
          tweet.id,
          tweet.author.username,
          tweet.author.followers_count,
          tweet.text,
          searchQuery.keywords
        ]);

        // Generate reply
        const reply = await this.generateReply(tweet, searchQuery.keywords);

        if (reply) {
          // Post reply with delay to avoid rate limits
          setTimeout(async () => {
            const result = await this.replyToTweet(tweet.id, reply);

            if (result.success) {
              await query(`
                UPDATE social_engagements
                SET our_reply = $1, reply_id = $2, status = 'replied', replied_at = NOW()
                WHERE platform_id = $3
              `, [reply, result.replyId, tweet.id]);

              // Create lead
              await this.createLeadFromTweet(tweet);
              repliesSent++;
            } else {
              console.error(`Failed to reply to tweet ${tweet.id}:`, result.error);
            }
          }, Math.random() * 5000 + 2000); // 2-7 second delay

          newLeads++;
        }
      }

      // Update monitoring queue
      await query(`
        INSERT INTO twitter_monitoring_queue (search_query, last_tweet_id, matches_found, replies_sent, last_run_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (search_query)
        UPDATE SET
          last_tweet_id = EXCLUDED.last_tweet_id,
          matches_found = EXCLUDED.matches_found,
          replies_sent = EXCLUDED.replies_sent,
          last_run_at = EXCLUDED.last_run_at
      `, [searchQuery.query, tweets[0]?.id || '', tweets.length, repliesSent]);

      console.log(`Twitter monitoring complete: ${newLeads} new leads, ${repliesSent} replies sent`);

    } catch (error) {
      console.error(`Error processing search query ${searchQuery.query}:`, error);
    }
  }

  private async generateReply(tweet: Tweet, keywords: string[]): Promise<string | null> {
    // Get best template based on keywords
    const templateResult = await query(`
      SELECT template_content, success_rate
      FROM reply_templates
      WHERE platform = 'twitter'
        AND is_active = true
        && keywords && $1
      ORDER BY success_rate DESC, usage_count ASC
      LIMIT 1
    `, [keywords]);

    if (templateResult.rows.length === 0) {
      return null;
    }

    let template = templateResult.rows[0].template_content;

    // Personalize if possible
    if (tweet.author.verified) {
      template = `Hi @${tweet.author.username}! ` + template;
    }

    // Check if tweet mentions specific pain points
    const text = tweet.text.toLowerCase();
    if (text.includes('expensive') || text.includes('cost')) {
      template = template.replace('99%+ accuracy', '40% cost savings while maintaining 99%+ accuracy');
    }

    if (text.includes('time') || text.includes('slow')) {
      template = template.replace('Our platform provides', 'Our platform speeds up data labeling 3x while maintaining');
    }

    // Update template usage
    await query(`
      UPDATE reply_templates
      SET usage_count = usage_count + 1
      WHERE template_content = $1
    `, [templateResult.rows[0].template_content]);

    return template;
  }

  private async createLeadFromTweet(tweet: Tweet): Promise<void> {
    // Check if lead already exists
    const existingLead = await query(
      'SELECT id FROM leads WHERE source = $1 AND source_details->>\'twitter_handle\' = $2',
      ['twitter', tweet.author.username]
    );

    if (existingLead.rows.length > 0) {
      return;
    }

    // Create new lead
    await query(`
      INSERT INTO leads (email, name, company, source, source_details, lead_score, status, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      `${tweet.author.username}@twitter.com`, // Placeholder email
      tweet.author.name,
      null, // Company unknown
      'twitter',
      JSON.stringify({
        twitter_handle: tweet.author.username,
        twitter_id: tweet.author.id,
        followers: tweet.author.followers_count,
        verified: tweet.author.verified,
        tweet_id: tweet.id,
        tweet_text: tweet.text,
        has_ai_terms: tweet.text.match(/\b(ai|ml|machine learning|artificial intelligence|neural|dataset)\b/i) !== null,
        engagement: tweet.public_metrics
      }),
      tweet.author.verified ? 30 : 20,
      'new',
      ['twitter', 'social']
    ]);
  }

  async getAnalytics(): Promise<any> {
    const result = await query(`
      SELECT
        COUNT(*) as total_tweets_found,
        COUNT(*) FILTER (WHERE status = 'replied') as replies_sent,
        COUNT(DISTINCT author_handle) as unique_authors,
        AVG(author_followers) as avg_followers,
        COUNT(DISTINCT lead_id) as leads_created,
        COUNT(*) FILTER (WHERE status = 'responded') as responses_received
      FROM social_engagements
      WHERE platform = 'twitter'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    const topPerforming = await query(`
      SELECT keywords_matched, COUNT(*) as count
      FROM social_engagements
      WHERE platform = 'twitter'
        AND status = 'replied'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY keywords_matched
      ORDER BY count DESC
      LIMIT 5
    `);

    return {
      weekly: result.rows[0],
      top_keywords: topPerforming.rows
    };
  }
}

export default TwitterService;