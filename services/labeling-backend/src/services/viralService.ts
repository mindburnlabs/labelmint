import { query } from '../database/connection';
import crypto from 'crypto';

export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  reward_points: number;
  reward_labels: number;
  unlocked?: boolean;
  unlocked_at?: Date;
  progress?: number;
}

export interface UserLevel {
  level: number;
  name: string;
  badge_color: string;
  bonus_multiplier: number;
  rewards: any;
  progress: number;
  next_level?: {
    level: number;
    name: string;
    points_needed: number;
  };
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  consecutive_days: number;
  total_days_active: number;
  streak_multiplier: number;
  today_active: boolean;
}

export interface ReferralInfo {
  referral_code: string;
  referral_url: string;
  referrals_count: number;
  pending_referrals: number;
  converted_referrals: number;
  total_earned: number;
}

export interface MilestoneShare {
  id: number;
  type: string;
  value: number;
  message: string;
  image_url?: string;
  share_text: string;
  twitter_url?: string;
  linkedin_url?: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  first_name: string;
  level: number;
  level_name: string;
  tasks_completed: number;
  total_earned: number;
  accuracy_rate: number;
  current_streak: number;
  achievements_count: number;
  is_you?: boolean;
}

export class ViralService {
  // Generate unique referral code
  generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createReferral(userId: number): Promise<ReferralInfo> {
    // Check if user already has referral code
    const existing = await query(
      'SELECT referral_code FROM referrals WHERE referrer_id = $1 LIMIT 1',
      [userId]
    );

    if (existing.rows.length > 0) {
      const code = existing.rows[0].referral_code;
      const stats = await this.getReferralStats(userId, code);
      return {
        referral_code: code,
        referral_url: `https://labelmint.it/join?ref=${code}`,
        ...stats
      };
    }

    // Create new referral code
    const code = this.generateReferralCode();

    // Ensure uniqueness
    const exists = await query('SELECT 1 FROM referrals WHERE referral_code = $1', [code]);
    if (exists.rows.length > 0) {
      return this.createReferral(userId); // Recursive call with new code
    }

    // Save referral code
    await query(`
      INSERT INTO referrals (referrer_id, referral_code, status)
      VALUES ($1, $2, 'pending')
    `, [userId, code]);

    const stats = await this.getReferralStats(userId, code);

    return {
      referral_code: code,
      referral_url: `https://labelmint.it/join?ref=${code}`,
      ...stats
    };
  }

  private async getReferralStats(userId: number, code: string) {
    const result = await query(`
      SELECT
        COUNT(*) as total_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
        COUNT(*) FILTER (WHERE status = 'converted') as converted_referrals,
        COALESCE(SUM(CASE WHEN reward_given = true THEN reward_amount ELSE 0 END), 0) as total_earned
      FROM referrals
      WHERE referrer_id = $1 AND referral_code = $2
    `, [userId, code]);

    return result.rows[0];
  }

  async processReferral(referralCode: string, referredUserId: number, ipAddress?: string): Promise<{
    success: boolean;
    message: string;
    reward?: { labels: number; amount: number };
  }> {
    // Check if referral code exists
    const referralResult = await query(
      'SELECT * FROM referrals WHERE referral_code = $1',
      [referralCode]
    );

    if (referralResult.rows.length === 0) {
      return { success: false, message: 'Invalid referral code' };
    }

    const referral = referralResult.rows[0];

    // Check if self-referral
    if (referral.referrer_id === referredUserId) {
      return { success: false, message: 'Cannot refer yourself' };
    }

    // Update referral status
    await query(`
      UPDATE referrals
      SET referred_id = $1,
          status = 'signed_up',
          ip_address = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [referredUserId, ipAddress, referral.id]);

    // Give bonus to referred user
    await query(`
      INSERT INTO free_tier_accounts (user_id, free_labels_remaining, trial_started_at, initial_campaign_source)
      VALUES ($1, 150, NOW(), 'referral')
      ON CONFLICT (user_id) DO UPDATE SET
        free_labels_remaining = free_labels_remaining + 50,
        updated_at = NOW()
    `, [referredUserId]);

    // Track referral event
    await query(`
      INSERT INTO viral_events (user_id, event_type, event_data, reward_given, reward_type, reward_value)
      VALUES ($1, 'referral_signup', $2, true, 'labels', 50)
    `, [referredUserId, JSON.stringify({
      referrer_id: referral.referrer_id,
      referral_code: referralCode
    })]);

    return {
      success: true,
      message: 'Referral successful! You received 50 bonus labels.',
      reward: { labels: 50, amount: 0 }
    };
  }

  async completeReferral(referralCode: string, userId: number): Promise<void> {
    const referral = await query(
      'SELECT * FROM referrals WHERE referral_code = $1 AND referred_id = $2',
      [referralCode, userId]
    );

    if (referral.rows.length === 0 || referral.rows[0].reward_given) {
      return;
    }

    const refData = referral.rows[0];

    // Give reward to referrer
    const rewardLabels = 100;
    const rewardAmount = 5.00;

    await query(`
      UPDATE wallets
      SET balance = balance + $1,
          total_earned = total_earned + $1
      WHERE user_id = $2
    `, [rewardAmount, refData.referrer_id]);

    // Mark referral as complete
    await query(`
      UPDATE referrals
      SET status = 'converted',
          reward_given = true,
          reward_amount = $1,
          reward_labels = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [rewardAmount, rewardLabels, refData.id]);

    // Create viral event
    await query(`
      INSERT INTO viral_events (user_id, event_type, event_data, reward_given, reward_type, reward_value)
      VALUES ($1, 'referral_converted', $2, true, 'labels_and_cash', $3)
    `, [refData.referrer_id, JSON.stringify({
      referred_user: userId,
      referral_code: referralCode
    }), rewardLabels]);
  }

  async getUserAchievements(userId: number): Promise<Achievement[]> {
    const result = await query(`
      SELECT
        a.*,
        ua.unlocked_at,
        ua.progress,
        CASE WHEN ua.id IS NOT NULL THEN true ELSE false END as unlocked
      FROM achievements a
      LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
      WHERE a.is_active = true
      ORDER BY a.category, a.requirement_value
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      requirement_type: row.requirement_type,
      requirement_value: row.requirement_value,
      reward_points: row.reward_points,
      reward_labels: row.reward_labels,
      unlocked: row.unlocked,
      unlocked_at: row.unlocked_at,
      progress: row.progress || 0
    }));
  }

  async getUserLevel(userId: number): Promise<UserLevel> {
    // Get user's current level
    const result = await query(`
      SELECT
        u.*,
        l.name as level_name,
        l.badge_color,
        l.bonus_multiplier,
        l.rewards
      FROM users u
      JOIN levels l ON l.level = u.level
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    const points = user.total_earned || 0;

    // Get next level
    const nextLevelResult = await query(`
      SELECT level, name, min_points
      FROM levels
      WHERE min_points > $1
      ORDER BY level
      LIMIT 1
    `, [points]);

    const nextLevel = nextLevelResult.rows[0];

    // Calculate progress
    const currentLevelMin = await query(
      'SELECT min_points FROM levels WHERE level = $1',
      [user.level]
    );

    const minPoints = currentLevelMin.rows[0]?.min_points || 0;
    const maxPoints = nextLevel?.min_points || minPoints + 1000;
    const progress = Math.min(100, ((points - minPoints) / (maxPoints - minPoints)) * 100);

    return {
      level: user.level,
      name: user.level_name,
      badge_color: user.badge_color,
      bonus_multiplier: parseFloat(user.bonus_multiplier) || 1.0,
      rewards: user.rewards,
      progress: Math.round(progress),
      next_level: nextLevel ? {
        level: nextLevel.level,
        name: nextLevel.name,
        points_needed: nextLevel.min_points - points
      } : undefined
    };
  }

  async getUserStreak(userId: number): Promise<StreakInfo> {
    const result = await query(`
      SELECT *
      FROM user_streaks
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Create initial streak record
      await query(`
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, total_days_active)
        VALUES ($1, 0, 0, NULL, 0)
      `, [userId]);

      return {
        current_streak: 0,
        longest_streak: 0,
        consecutive_days: 0,
        total_days_active: 0,
        streak_multiplier: 1.0,
        today_active: false
      };
    }

    const streak = result.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const todayActive = streak.last_activity_date === today;

    return {
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      consecutive_days: streak.consecutive_days,
      total_days_active: streak.total_days_active,
      streak_multiplier: parseFloat(streak.streak_multiplier) || 1.0,
      today_active
    };
  }

  async updateActivityStreak(userId: number): Promise<{
    streak_updated: boolean;
    new_multiplier: number;
    daily_bonus_earned: boolean;
  }> {
    // Update streak
    const multiplierResult = await query('SELECT update_user_streak($1) as multiplier', [userId]);
    const newMultiplier = parseFloat(multiplierResult.rows[0].multiplier);

    // Check for daily bonus
    const today = new Date().toISOString().split('T')[0];
    const bonusResult = await query(`
      SELECT id FROM daily_bonuses
      WHERE user_id = $1 AND date = $2 AND is_claimed = false
    `, [userId, today]);

    const bonusEarned = bonusResult.rows.length > 0;

    return {
      streak_updated: true,
      new_multiplier,
      daily_bonus_earned: bonusEarned
    };
  }

  async createMilestoneShare(userId: number, milestoneType: string, value: number): Promise<MilestoneShare> {
    const user = await query('SELECT username, first_name FROM users WHERE id = $1', [userId]);
    const userName = user.rows[0]?.first_name || user.rows[0]?.username || 'Anonymous';

    let message = '';
    let shareText = '';

    switch (milestoneType) {
      case 'labels_completed':
        message = `I just completed ${value.toLocaleString()} labels on labelmint.it! 🎯`;
        if (value >= 1000000) {
          message = `We just labeled ${value.toLocaleString()} images! 🚀 Powered by labelmint.it`;
          shareText = `Help us label the next million! 🚀 #DataLabeling #MachineLearning #AI #TechForGood`;
        }
        break;
      case 'earnings':
        message = `I've earned $${value.toFixed(2)} on labelmint.it! 💰`;
        shareText = `Making money from home with AI data labeling. Join me! 💰 #RemoteWork #SideHustle #AI`;
        break;
      case 'accuracy':
        message = `Achieved ${value}% accuracy on labelmint.it! 🎪`;
        shareText = `Precision matters in AI! Achieved ${value}% accuracy in data labeling. #Quality #AI #ML`;
        break;
      default:
        message = `Milestone achieved on labelmint.it! ✨`;
    }

    // Save milestone
    const result = await query(`
      INSERT INTO shareable_milestones (user_id, milestone_type, milestone_value, message)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `, [userId, milestoneType, value, message]);

    const milestone = result.rows[0];

    // Generate share URLs
    const baseUrl = 'https://labelmint.it';
    const shareUrl = `${baseUrl}/milestone/${milestone.id}`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

    return {
      id: milestone.id,
      type: milestoneType,
      value,
      message,
      share_text: shareText,
      twitter_url: twitterUrl,
      linkedin_url: linkedinUrl,
      share_url: shareUrl
    };
  }

  async shareMilestone(milestoneId: number, platform: 'twitter' | 'linkedin' | 'internal'): Promise<{
    success: boolean;
    reward?: { points: number; labels: number };
  }> {
    // Update milestone share status
    const updateField = platform === 'twitter' ? 'shared_on_twitter' :
                      platform === 'linkedin' ? 'shared_on_linkedin' : 'shared_internally';

    await query(`
      UPDATE shareable_milestones
      SET ${updateField} = true
      WHERE id = $1
    `, [milestoneId]);

    // Get milestone details
    const milestone = await query(
      'SELECT * FROM shareable_milestones WHERE id = $1',
      [milestoneId]
    );

    if (milestone.rows.length === 0) {
      return { success: false };
    }

    // Give reward for first share
    const existingShare = await query(`
      SELECT 1 FROM viral_events
      WHERE user_id = $1 AND event_type = 'milestone_shared'
      LIMIT 1
    `, [milestone.rows[0].user_id]);

    if (existingShare.rows.length === 0) {
      // Award share bonus
      await query(`
        INSERT INTO viral_events (user_id, event_type, event_data, reward_given, reward_type, reward_value)
        VALUES ($1, 'milestone_shared', $2, true, 'labels', 25)
      `, [milestone.rows[0].user_id, JSON.stringify({
        milestone_id: milestoneId,
        platform
      })]);

      return {
        success: true,
        reward: { points: 25, labels: 25 }
      };
    }

    return { success: true };
  }

  async getLeaderboard(type: 'earnings' | 'labels' | 'accuracy' | 'streak' = 'earnings', period: 'daily' | 'weekly' | 'monthly' | 'all_time' = 'all_time', limit: number = 50): Promise<LeaderboardEntry[]> {
    let orderBy = 'total_earned DESC';
    let selectFields = 'u.total_earned as score, u.total_earned as earnings';

    switch (type) {
      case 'labels':
        orderBy = 'u.tasks_completed DESC';
        selectFields = 'u.tasks_completed as score, u.total_earned as earnings';
        break;
      case 'accuracy':
        orderBy = 'u.accuracy_rate DESC, u.tasks_completed DESC';
        selectFields = 'u.accuracy_rate as score, u.total_earned as earnings';
        break;
      case 'streak':
        selectFields = 'COALESCE(us.current_streak, 0) as score, u.total_earned as earnings';
        break;
    }

    // Add time filter for periods
    let timeFilter = '';
    if (period === 'daily') {
      timeFilter = 'AND r.created_at >= CURRENT_DATE';
    } else if (period === 'weekly') {
      timeFilter = 'AND r.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
    } else if (period === 'monthly') {
      timeFilter = 'AND r.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    const result = await query(`
      SELECT
        u.id as user_id,
        u.username,
        u.first_name,
        u.level,
        l.name as level_name,
        ${selectFields},
        u.tasks_completed,
        u.accuracy_rate,
        COALESCE(us.current_streak, 0) as current_streak,
        COALESCE(ua_count, 0) as achievements_count,
        ROW_NUMBER() OVER (ORDER BY ${orderBy}) as rank
      FROM users u
      LEFT JOIN levels l ON l.level = u.level
      LEFT JOIN user_streaks us ON us.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as ua_count
        FROM user_achievements
        GROUP BY user_id
      ) ua_count ON ua_count.user_id = u.id
      WHERE u.is_active = true AND u.role = 'worker' ${timeFilter}
      ORDER BY ${orderBy}
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      rank: row.rank,
      user_id: row.user_id,
      username: row.username,
      first_name: row.first_name,
      level: row.level,
      level_name: row.level_name,
      tasks_completed: row.tasks_completed,
      total_earned: parseFloat(row.earnings) || 0,
      accuracy_rate: parseFloat(row.accuracy_rate) || 0,
      current_streak: row.current_streak,
      achievements_count: row.achievements_count
    }));
  }

  async getWatermarkSettings(userId: number): Promise<{
    show_watermark: boolean;
    watermark_text: string;
    display_count: number;
  }> {
    // Check if user is on free tier
    const freeTier = await query(`
      SELECT 1 FROM free_tier_accounts
      WHERE user_id = $1 AND converted_to_paid = false
    `, [userId]);

    const isFreeTier = freeTier.rows.length > 0;

    if (isFreeTier) {
      return {
        show_watermark: true,
        watermark_text: 'Powered by labelmint.it',
        display_count: 0
      };
    }

    return {
      show_watermark: false,
      watermark_text: '',
      display_count: 0
    };
  }

  async trackWatermarkView(userId: number, projectId: number): Promise<void> {
    await query(`
      INSERT INTO viral_watermarks (user_id, project_id, display_count)
      VALUES ($1, $2, 1)
      ON CONFLICT (user_id, project_id)
      UPDATE SET display_count = display_count + 1
    `, [userId, projectId]);
  }

  async trackWatermarkClick(userId: number, projectId: number): Promise<void> {
    await query(`
      UPDATE viral_watermarks
      SET click_count = click_count + 1
      WHERE user_id = $1 AND project_id = $2
    `, [userId, projectId]);

    // Track conversion event
    await query(`
      INSERT INTO viral_events (user_id, event_type, event_data)
      VALUES ($1, 'watermark_clicked', $2)
    `, [userId, JSON.stringify({ project_id: projectId })]);
  }

  async getViralStats(userId: number): Promise<{
    shares_count: number;
    referral_earnings: number;
    achievements_count: number;
    level: number;
    streak_multiplier: number;
    watermark_clicks: number;
  }> {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM shareable_milestones WHERE user_id = $1 AND (shared_on_twitter = true OR shared_on_linkedin = true)) as shares_count,
        (SELECT COALESCE(SUM(reward_amount), 0) FROM referrals WHERE referrer_id = $1 AND reward_given = true) as referral_earnings,
        (SELECT COUNT(*) FROM user_achievements WHERE user_id = $1) as achievements_count,
        u.level,
        COALESCE(us.streak_multiplier, 1.0) as streak_multiplier,
        COALESCE(SUM(vw.click_count), 0) as watermark_clicks
      FROM users u
      LEFT JOIN user_streaks us ON us.user_id = u.id
      LEFT JOIN viral_watermarks vw ON vw.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, us.streak_multiplier
    `, [userId]);

    return result.rows[0] || {
      shares_count: 0,
      referral_earnings: 0,
      achievements_count: 0,
      level: 1,
      streak_multiplier: 1.0,
      watermark_clicks: 0
    };
  }
}

export default ViralService;