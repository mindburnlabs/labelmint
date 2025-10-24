import { Router } from 'express';
import { authenticateWorker, AuthenticatedRequest } from '../middleware/auth';
import ViralService from '../services/viralService';
import { query } from '../database/connection';

const router = Router();
const viralService = new ViralService();

// GET /api/viral/leaderboard - Get public leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const {
      type = 'earnings',
      period = 'all_time',
      limit = 50,
      user_id
    } = req.query;

    const leaderboard = await viralService.getLeaderboard(
      type as any,
      period as any,
      parseInt(limit as string)
    );

    // Mark current user if provided
    if (user_id) {
      const userId = parseInt(user_id as string);
      leaderboard.forEach(entry => {
        if (entry.user_id === userId) {
          entry.is_you = true;
        }
      });
    }

    // Return without sensitive info for public view
    const publicLeaderboard = leaderboard.map(entry => ({
      rank: entry.rank,
      username: entry.username,
      level_name: entry.level_name,
      tasks_completed: entry.tasks_completed,
      total_earned: entry.total_earned,
      current_streak: entry.current_streak,
      achievements_count: entry.achievements_count,
      is_you: entry.is_you
    }));

    res.json({
      success: true,
      leaderboard: publicLeaderboard,
      type,
      period,
      total: leaderboard.length
    });
  } catch (error: any) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /api/viral/leaderboard/personal - Get personalized leaderboard
router.get('/leaderboard/personal', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { type = 'earnings', period = 'weekly' } = req.query;

    const leaderboard = await viralService.getLeaderboard(
      type as any,
      period as any,
      20
    );

    // Mark current user
    leaderboard.forEach(entry => {
      if (entry.user_id === req.user.id) {
        entry.is_you = true;
      }
    });

    // Find user's rank
    const userRank = leaderboard.find(entry => entry.is_you)?.rank || 0;

    res.json({
      success: true,
      leaderboard,
      your_rank: userRank,
      total_participants: leaderboard.length
    });
  } catch (error: any) {
    console.error('Error getting personal leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /api/viral/achievements - Get user achievements
router.get('/achievements', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const achievements = await viralService.getUserAchievements(req.user.id);

    res.json({
      success: true,
      achievements,
      total_unlocked: achievements.filter(a => a.unlocked).length,
      total_available: achievements.length
    });
  } catch (error: any) {
    console.error('Error getting achievements:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

// GET /api/viral/level - Get user level and progress
router.get('/level', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const level = await viralService.getUserLevel(req.user.id);

    res.json({
      success: true,
      level
    });
  } catch (error: any) {
    console.error('Error getting user level:', error);
    res.status(500).json({ error: 'Failed to get level' });
  }
});

// GET /api/viral/streak - Get user streak info
router.get('/streak', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const streak = await viralService.getUserStreak(req.user.id);

    res.json({
      success: true,
      streak
    });
  } catch (error: any) {
    console.error('Error getting streak:', error);
    res.status(500).json({ error: 'Failed to get streak' });
  }
});

// POST /api/viral/streak/update - Update daily activity streak
router.post('/streak/update', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await viralService.updateActivityStreak(req.user.id);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error updating streak:', error);
    res.status(500).json({ error: 'Failed to update streak' });
  }
});

// GET /api/viral/referral - Get user referral info
router.get('/referral', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const referral = await viralService.createReferral(req.user.id);

    res.json({
      success: true,
      referral
    });
  } catch (error: any) {
    console.error('Error getting referral:', error);
    res.status(500).json({ error: 'Failed to get referral' });
  }
});

// POST /api/viral/referral/process - Process a referral
router.post('/referral/process', async (req, res) => {
  try {
    const { referral_code, user_id, ip_address } = req.body;

    if (!referral_code || !user_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['referral_code', 'user_id']
      });
    }

    const result = await viralService.processReferral(referral_code, parseInt(user_id), ip_address);

    res.json(result);
  } catch (error: any) {
    console.error('Error processing referral:', error);
    res.status(500).json({ error: 'Failed to process referral' });
  }
});

// POST /api/viral/referral/complete - Complete referral (after first task)
router.post('/referral/complete', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { referral_code } = req.body;

    if (!referral_code) {
      return res.status(400).json({ error: 'referral_code is required' });
    }

    await viralService.completeReferral(referral_code, req.user.id);

    res.json({
      success: true,
      message: 'Referral completed! Rewards have been distributed.'
    });
  } catch (error: any) {
    console.error('Error completing referral:', error);
    res.status(500).json({ error: 'Failed to complete referral' });
  }
});

// POST /api/viral/milestone/create - Create shareable milestone
router.post('/milestone/create', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { milestone_type, value } = req.body;

    if (!milestone_type || !value) {
      return res.status(400).json({
        error: 'milestone_type and value are required'
      });
    }

    const milestone = await viralService.createMilestoneShare(
      req.user.id,
      milestone_type,
      value
    );

    res.json({
      success: true,
      milestone
    });
  } catch (error: any) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// POST /api/viral/milestone/:id/share - Share milestone
router.post('/milestone/:id/share', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const milestoneId = parseInt(req.params.id);
    const { platform } = req.body;

    if (!platform || !['twitter', 'linkedin', 'internal'].includes(platform)) {
      return res.status(400).json({
        error: 'Platform must be twitter, linkedin, or internal'
      });
    }

    const result = await viralService.shareMilestone(
      milestoneId,
      platform
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error sharing milestone:', error);
    res.status(500).json({ error: 'Failed to share milestone' });
  }
});

// GET /api/viral/milestone/:id - Get milestone details
router.get('/milestone/:id', async (req, res) => {
  try {
    const milestoneId = parseInt(req.params.id);

    const result = await query(`
      SELECT
        sm.*,
        u.username,
        u.first_name,
        l.name as level_name,
        l.badge_color
      FROM shareable_milestones sm
      JOIN users u ON u.id = sm.user_id
      LEFT JOIN levels l ON l.level = u.level
      WHERE sm.id = $1
    `, [milestoneId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Increment view count
    await query(
      'UPDATE shareable_milestones SET views_count = views_count + 1 WHERE id = $1',
      [milestoneId]
    );

    res.json({
      success: true,
      milestone: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error getting milestone:', error);
    res.status(500).json({ error: 'Failed to get milestone' });
  }
});

// GET /api/viral/watermark - Get watermark settings for user
router.get('/watermark', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const settings = await viralService.getWatermarkSettings(req.user.id);

    res.json({
      success: true,
      ...settings
    });
  } catch (error: any) {
    console.error('Error getting watermark settings:', error);
    res.status(500).json({ error: 'Failed to get watermark settings' });
  }
});

// POST /api/viral/watermark/view - Track watermark view
router.post('/watermark/view', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    await viralService.trackWatermarkView(req.user.id, parseInt(project_id));

    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Error tracking watermark view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
});

// POST /api/viral/watermark/click - Track watermark click
router.post('/watermark/click', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    await viralService.trackWatermarkClick(req.user.id, parseInt(project_id));

    res.json({
      success: true
    });
  } catch (error: any) {
    console.error('Error tracking watermark click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// GET /api/viral/stats - Get user's viral stats
router.get('/stats', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const stats = await viralService.getViralStats(req.user.id);

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error getting viral stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/viral/dashboard - Get comprehensive viral dashboard
router.get('/dashboard', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get all viral data in parallel
    const [level, streak, achievements, referral, watermark, stats] = await Promise.all([
      viralService.getUserLevel(req.user.id),
      viralService.getUserStreak(req.user.id),
      viralService.getUserAchievements(req.user.id),
      viralService.createReferral(req.user.id),
      viralService.getWatermarkSettings(req.user.id),
      viralService.getViralStats(req.user.id)
    ]);

    // Get weekly leaderboard
    const weeklyLeaderboard = await viralService.getLeaderboard('earnings', 'weekly', 10);

    // Mark user's rank
    weeklyLeaderboard.forEach(entry => {
      if (entry.user_id === req.user.id) {
        entry.is_you = true;
      }
    });

    res.json({
      success: true,
      dashboard: {
        level,
        streak,
        achievements: {
          total: achievements.length,
          unlocked: achievements.filter(a => a.unlocked).length,
          recent: achievements.filter(a => a.unlocked).slice(-5)
        },
        referral,
        watermark,
        stats,
        weekly_leaderboard: weeklyLeaderboard.slice(0, 5),
        your_weekly_rank: weeklyLeaderboard.find(e => e.is_you)?.rank || null
      }
    });
  } catch (error: any) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// POST /api/viral/daily-bonus/claim - Claim daily bonus
router.post('/daily-bonus/claim', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if bonus already claimed
    const existing = await query(`
      SELECT id FROM daily_bonuses
      WHERE user_id = $1 AND date = $2 AND is_claimed = true
    `, [req.user.id, today]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'Daily bonus already claimed',
        next_claim_date: new Date(Date.now() + 86400000).toISOString().split('T')[0]
      });
    }

    // Check if eligible
    const eligible = await query(`
      SELECT id FROM daily_bonuses
      WHERE user_id = $1 AND date = $2 AND labels_completed >= 10
    `, [req.user.id, today]);

    if (eligible.rows.length === 0) {
      return res.status(400).json({
        error: 'Not eligible for daily bonus',
        requirement: 'Complete 10 labels today'
      });
    }

    // Claim bonus
    const bonusAmount = await query(`
      SELECT u.level, l.bonus_multiplier
      FROM users u
      JOIN levels l ON l.level = u.level
      WHERE u.id = $1
    `, [req.user.id]);

    const multiplier = parseFloat(bonusAmount.rows[0]?.bonus_multiplier) || 1.0;
    const baseBonus = 5; // Base 5 labels
    const finalBonus = Math.floor(baseBonus * multiplier);

    // Add bonus to wallet
    await query(`
      UPDATE wallets
      SET balance = balance + $1
      WHERE user_id = $2
    `, [finalBonus, req.user.id]);

    // Mark as claimed
    await query(`
      UPDATE daily_bonuses
      SET is_claimed = true,
          claimed_at = NOW(),
          bonus_value = $1
      WHERE user_id = $2 AND date = $3
    `, [finalBonus, req.user.id, today]);

    res.json({
      success: true,
      bonus_claimed: finalBonus,
      multiplier,
      next_claim_date: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    });
  } catch (error: any) {
    console.error('Error claiming daily bonus:', error);
    res.status(500).json({ error: 'Failed to claim bonus' });
  }
});

export default router;