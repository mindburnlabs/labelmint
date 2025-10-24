import { postgresDb } from '../database';
import { TonWalletService } from '../ton/TonWalletService';
import { STAKING_CONFIG, STAKING_STATUS } from '../../config/payment-chains';
import cron from 'node-cron';

export interface StakingPool {
  id: number;
  poolName: string;
  description: string;
  apy: number;
  minStake: number;
  maxStake?: number;
  lockPeriodDays: number;
  totalStaked: number;
  isActive: boolean;
  createdAt: Date;
}

export interface UserStake {
  id: number;
  userId: number;
  poolId: number;
  amount: number;
  currency: string;
  status: 'active' | 'unstaking' | 'completed' | 'penalized';
  stakeAt: Date;
  unlockAt: Date;
  rewardsEarned: number;
  lastRewardCalculated: Date;
  penaltyAmount: number;
  completedAt?: Date;
  createdAt: Date;
}

export interface RewardDistribution {
  id: number;
  poolId: number;
  userId: number;
  stakeId: number;
  rewardAmount: number;
  currency: string;
  apyUsed: number;
  periodStart: Date;
  periodEnd: Date;
  txHash?: string;
  createdAt: Date;
}

export class StakingService {
  private tonService: TonWalletService;

  constructor() {
    this.tonService = new TonWalletService();
    this.startRewardCalculator();
  }

  /**
   * Start the reward calculation scheduler
   */
  private startRewardCalculator() {
    // Calculate rewards every hour
    cron.schedule('0 * * * *', async () => {
      await this.calculateAllRewards();
    });
  }

  /**
   * Get all active staking pools
   */
  async getActivePools(): Promise<StakingPool[]> {
    const query = `
      SELECT * FROM staking_pools
      WHERE is_active = true
      ORDER BY apy DESC
    `;

    const result = await postgresDb.query(query);
    return result.rows;
  }

  /**
   * Get staking pool by ID
   */
  async getPool(poolId: number): Promise<StakingPool | null> {
    const query = 'SELECT * FROM staking_pools WHERE id = $1';
    const result = await postgresDb.query(query, [poolId]);
    return result.rows[0] || null;
  }

  /**
   * Create a new staking position
   */
  async createStake(
    userId: number,
    poolId: number,
    amount: number,
    currency: string = 'USDT'
  ): Promise<UserStake> {
    // Get pool details
    const pool = await this.getPool(poolId);
    if (!pool) {
      throw new Error('Staking pool not found');
    }

    if (!pool.isActive) {
      throw new Error('Staking pool is not active');
    }

    if (amount < pool.minStake) {
      throw new Error(`Minimum stake amount is ${pool.minStake} ${currency}`);
    }

    if (pool.maxStake && amount > pool.maxStake) {
      throw new Error(`Maximum stake amount is ${pool.maxStake} ${currency}`);
    }

    // Check user's balance
    const wallet = await this.tonService.getUserWallet(userId, 'mainnet');
    const balance = currency === 'USDT' ? wallet.balance_usdt : wallet.balance_ton;

    if (balance < amount) {
      throw new Error('Insufficient balance for staking');
    }

    // Calculate unlock date
    const stakeAt = new Date();
    const unlockAt = new Date(stakeAt);
    unlockAt.setDate(unlockAt.getDate() + pool.lockPeriodDays);

    // Create stake record
    const query = `
      INSERT INTO user_stakes (
        user_id, pool_id, amount, currency, stake_at, unlock_at,
        last_reward_calculated
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const result = await postgresDb.query(query, [
      userId,
      poolId,
      amount,
      currency,
      stakeAt,
      unlockAt
    ]);

    // Transfer funds to staking contract
    await this.transferToStaking(userId, amount, currency, result.rows[0].id);

    // Update pool total staked
    await postgresDb.query(
      'UPDATE staking_pools SET total_staked = total_staked + $1 WHERE id = $2',
      [amount, poolId]
    );

    return result.rows[0];
  }

  /**
   * Transfer funds to staking contract
   */
  private async transferToStaking(
    userId: number,
    amount: number,
    currency: string,
    stakeId: number
  ): Promise<void> {
    // Get staking wallet
    const stakingWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = 1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const stakingWalletResult = await postgresDb.query(stakingWalletQuery);

    if (!stakingWalletResult.rows[0]) {
      throw new Error('Staking wallet not configured');
    }

    // Transfer to staking contract
    const txHash = await this.tonService.sendTransaction(userId, {
      toAddress: stakingWalletResult.rows[0].wallet_address,
      amount: amount.toString(),
      tokenType: currency === 'USDT' ? 'USDT' : 'TON',
      message: `Stake deposit #${stakeId}`
    }, 'mainnet');

    // Record transaction
    await postgresDb.query(`
      INSERT INTO staking_transactions (stake_id, transaction_type, amount, tx_hash, created_at)
      VALUES ($1, 'stake', $2, $3, NOW())
    `, [stakeId, amount, txHash]);
  }

  /**
   * Unstake funds
   */
  async unstake(userId: number, stakeId: number): Promise<string> {
    const stakeQuery = `
      SELECT * FROM user_stakes
      WHERE id = $1 AND user_id = $2
    `;
    const stakeResult = await postgresDb.query(stakeQuery, [stakeId, userId]);

    if (!stakeResult.rows[0]) {
      throw new Error('Stake not found');
    }

    const stake = stakeResult.rows[0];

    if (stake.status !== STAKING_STATUS.ACTIVE) {
      throw new Error('Stake is not in active status');
    }

    const now = new Date();

    // Check if lock period has passed
    if (now < stake.unlockAt) {
      // Early unstaking - apply penalty
      const penaltyAmount = stake.amount * STAKING_CONFIG.EARLY_UNSTAKE_PENALTY;
      const netAmount = stake.amount - penaltyAmount;

      await postgresDb.query(`
        UPDATE user_stakes
        SET
          status = 'penalized',
          penalty_amount = $1,
          completed_at = NOW()
        WHERE id = $2
      `, [penaltyAmount, stakeId]);

      // Return net amount after penalty
      return await this.transferFromStaking(userId, netAmount, stake.currency, stakeId, 'early_unstake');
    }

    // Normal unstaking
    await postgresDb.query(`
      UPDATE user_stakes
      SET
        status = 'unstaking',
        completed_at = NOW()
      WHERE id = $1
    `, [stakeId]);

    // Return full amount plus rewards
    const totalAmount = stake.amount + stake.rewardsEarned;
    return await this.transferFromStaking(userId, totalAmount, stake.currency, stakeId, 'unstake');
  }

  /**
   * Transfer funds from staking contract
   */
  private async transferFromStaking(
    userId: number,
    amount: number,
    currency: string,
    stakeId: number,
    type: 'unstake' | 'early_unstake' | 'reward'
  ): Promise<string> {
    // Get user's wallet
    const userWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const userWalletResult = await postgresDb.query(userWalletQuery, [userId]);

    if (!userWalletResult.rows[0]) {
      throw new Error('User wallet not found');
    }

    // Transfer from staking contract
    const txHash = await this.tonService.sendTransaction(1, {
      toAddress: userWalletResult.rows[0].wallet_address,
      amount: amount.toString(),
      tokenType: currency === 'USDT' ? 'USDT' : 'TON',
      message: `Staking ${type} #${stakeId}`
    }, 'mainnet');

    // Record transaction
    await postgresDb.query(`
      INSERT INTO staking_transactions (stake_id, transaction_type, amount, tx_hash, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [stakeId, amount, txHash, type]);

    return txHash;
  }

  /**
   * Get user's staking positions
   */
  async getUserStakes(
    userId: number,
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ stakes: UserStake[]; total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE us.user_id = $1';
    const params = [userId];

    if (status) {
      whereClause += ` AND us.status = $2`;
      params.push(status);
    }

    const countQuery = `
      SELECT COUNT(*) FROM user_stakes us ${whereClause}
    `;
    const countResult = await postgresDb.query(countQuery, params);

    params.push(limit, offset);

    const stakesQuery = `
      SELECT
        us.*,
        sp.pool_name,
        sp.apy,
        sp.lock_period_days
      FROM user_stakes us
      JOIN staking_pools sp ON us.pool_id = sp.id
      ${whereClause}
      ORDER BY us.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const stakesResult = await postgresDb.query(stakesQuery, params);

    return {
      stakes: stakesResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Calculate rewards for all active stakes
   */
  async calculateAllRewards(): Promise<void> {
    const query = `
      SELECT
        us.*,
        sp.apy
      FROM user_stakes us
      JOIN staking_pools sp ON us.pool_id = sp.id
      WHERE us.status = 'active'
      AND us.last_reward_calculated < NOW() - INTERVAL '1 hour'
    `;

    const result = await postgresDb.query(query);

    for (const stake of result.rows) {
      try {
        await this.calculateStakeRewards(stake);
      } catch (error) {
        console.error(`Failed to calculate rewards for stake ${stake.id}:`, error);
      }
    }
  }

  /**
   * Calculate rewards for a single stake
   */
  private async calculateStakeRewards(stake: UserStake & { apy: number }): Promise<void> {
    const now = new Date();
    const lastCalculated = new Date(stake.lastRewardCalculated);
    const hoursElapsed = (now.getTime() - lastCalculated.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < 1) {
      return; // Less than 1 hour elapsed
    }

    // Calculate hourly reward
    const hourlyRate = stake.apy / 365 / 24;
    const rewardAmount = stake.amount * hourlyRate * hoursElapsed;

    // Update stake rewards
    await postgresDb.query(`
      UPDATE user_stakes
      SET
        rewards_earned = rewards_earned + $1,
        last_reward_calculated = NOW()
      WHERE id = $2
    `, [rewardAmount, stake.id]);

    // Record reward distribution
    await postgresDb.query(`
      INSERT INTO reward_distributions (
        pool_id, user_id, stake_id, reward_amount,
        currency, apy_used, period_start, period_end
      )
      VALUES ($1, $2, $3, $4, 'USDT', $5, $6, NOW())
    `, [
      stake.poolId,
      stake.userId,
      stake.id,
      rewardAmount,
      stake.apy,
      lastCalculated
    ]);

    // Update pool statistics
    await postgresDb.query(`
      UPDATE staking_pools
      SET total_rewards_distributed = COALESCE(total_rewards_distributed, 0) + $1
      WHERE id = $2
    `, [rewardAmount, stake.poolId]);

    console.log(`Reward of ${rewardAmount} USDT calculated for stake ${stake.id}`);
  }

  /**
   * Get user's reward history
   */
  async getRewardHistory(
    userId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<{ rewards: RewardDistribution[]; total: number }> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) FROM reward_distributions WHERE user_id = $1
    `;
    const countResult = await postgresDb.query(countQuery, [userId]);

    const rewardsQuery = `
      SELECT
        rd.*,
        sp.pool_name
      FROM reward_distributions rd
      JOIN staking_pools sp ON rd.pool_id = sp.id
      WHERE rd.user_id = $1
      ORDER BY rd.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const rewardsResult = await postgresDb.query(rewardsQuery, [userId, limit, offset]);

    return {
      rewards: rewardsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Get staking statistics for user
   */
  async getUserStakingStats(userId: number): Promise<any> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE us.status = 'active') as active_stakes,
        COUNT(*) FILTER (WHERE us.status = 'completed') as completed_stakes,
        COALESCE(SUM(us.amount) FILTER (WHERE us.status = 'active'), 0) as total_staked,
        COALESCE(SUM(us.rewards_earned), 0) as total_rewards_earned,
        COALESCE(SUM(us.amount + us.rewards_earned) FILTER (WHERE us.status = 'completed'), 0) as total_withdrawn,
        COALESCE(AVG(sp.apy) FILTER (WHERE us.status = 'active'), 0) as average_apy
      FROM user_stakes us
      JOIN staking_pools sp ON us.pool_id = sp.id
      WHERE us.user_id = $1
    `;

    const result = await postgresDb.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get global staking statistics
   */
  async getGlobalStakingStats(): Promise<any> {
    const query = `
      SELECT
        COUNT(DISTINCT us.user_id) as total_stakers,
        COUNT(*) FILTER (WHERE us.status = 'active') as active_stakes,
        COALESCE(SUM(us.amount) FILTER (WHERE us.status = 'active'), 0) as total_staked,
        COALESCE(SUM(us.rewards_earned), 0) as total_rewards_paid,
        COUNT(*) FILTER (WHERE sp.is_active = true) as active_pools,
        COALESCE(AVG(sp.apy) FILTER (WHERE sp.is_active = true), 0) as average_apy
      FROM user_stakes us
      JOIN staking_pools sp ON us.pool_id = sp.id
    `;

    const result = await postgresDb.query(query);
    return result.rows[0];
  }

  /**
   * Claim rewards without unstaking
   */
  async claimRewards(userId: number, stakeId: number): Promise<string> {
    const stakeQuery = `
      SELECT * FROM user_stakes
      WHERE id = $1 AND user_id = $2 AND status = 'active'
    `;
    const stakeResult = await postgresDb.query(stakeQuery, [stakeId, userId]);

    if (!stakeResult.rows[0]) {
      throw new Error('Active stake not found');
    }

    const stake = stakeResult.rows[0];

    if (stake.rewardsEarned <= 0) {
      throw new Error('No rewards to claim');
    }

    // Calculate final rewards
    await this.calculateStakeRewards(stake as UserStake & { apy: number });

    // Get updated stake
    const updatedStakeResult = await postgresDb.query(
      'SELECT * FROM user_stakes WHERE id = $1',
      [stakeId]
    );
    const updatedStake = updatedStakeResult.rows[0];

    // Transfer rewards
    const txHash = await this.transferFromStaking(
      userId,
      updatedStake.rewardsEarned,
      updatedStake.currency,
      stakeId,
      'reward'
    );

    // Reset rewards earned
    await postgresDb.query(
      'UPDATE user_stakes SET rewards_earned = 0 WHERE id = $1',
      [stakeId]
    );

    return txHash;
  }

  /**
   * Create a new staking pool (admin only)
   */
  async createPool(poolData: {
    poolName: string;
    description: string;
    apy: number;
    minStake: number;
    maxStake?: number;
    lockPeriodDays: number;
  }): Promise<StakingPool> {
    const query = `
      INSERT INTO staking_pools (
        pool_name, description, apy, min_stake, max_stake, lock_period_days
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await postgresDb.query(query, [
      poolData.poolName,
      poolData.description,
      poolData.apy,
      poolData.minStake,
      poolData.maxStake,
      poolData.lockPeriodDays
    ]);

    return result.rows[0];
  }

  /**
   * Update staking pool (admin only)
   */
  async updatePool(
    poolId: number,
    updates: Partial<StakingPool>
  ): Promise<StakingPool> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id' && key !== 'createdAt') {
        setClause.push(`${this.camelToSnake(key)} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(poolId);

    const query = `
      UPDATE staking_pools
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await postgresDb.query(query, values);

    if (!result.rows[0]) {
      throw new Error('Staking pool not found');
    }

    return result.rows[0];
  }

  /**
   * Helper method to convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}