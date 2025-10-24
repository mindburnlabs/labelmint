import { Request, Response } from 'express';
import { MultiChainService } from '../../services/payment/MultiChainService';
import { ScheduledPaymentService } from '../../services/payment/ScheduledPaymentService';
import { ReferralService } from '../../services/payment/ReferralService';
import { EscrowService } from '../../services/payment/EscrowService';
import { StakingService } from '../../services/payment/StakingService';
import { validate, schemas } from '../../middleware/validation';
import { authenticateToken } from '../../middleware/auth';

// Initialize services
const multiChainService = new MultiChainService();
const scheduledPaymentService = new ScheduledPaymentService();
const referralService = new ReferralService();
const escrowService = new EscrowService();
const stakingService = new StakingService();

// Multi-chain endpoints
export const getSupportedChains = async (req: Request, res: Response) => {
  try {
    const chains = await multiChainService.getSupportedChains();
    res.json({ success: true, chains });
  } catch (error) {
    console.error('Get supported chains error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported chains'
    });
  }
};

export const getUserWallets = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const wallets = await multiChainService.getUserWallets(userId);
      res.json({ success: true, wallets });
    } catch (error) {
      console.error('Get user wallets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user wallets'
      });
    }
  }
];

export const addOrUpdateWallet = [
  authenticateToken,
  validate({
    body: {
      chain: schemas.uuid,
      address: schemas.uuid.required(),
      label: schemas.uuid.optional(),
      isDefault: schemas.uuid.optional()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { chain, address, label, isDefault } = req.body;

      const wallet = await multiChainService.addOrUpdateWallet(
        userId,
        chain,
        address,
        label,
        isDefault
      );

      res.json({
        success: true,
        message: 'Wallet added/updated successfully',
        wallet
      });
    } catch (error) {
      console.error('Add wallet error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add wallet'
      });
    }
  }
];

export const getChainBalance = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { chain } = req.params;

      const balance = await multiChainService.getChainBalance(userId, chain);

      res.json({
        success: true,
        balance
      });
    } catch (error) {
      console.error('Get chain balance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch balance'
      });
    }
  }
];

export const convertToUSDT = [
  authenticateToken,
  validate({
    body: {
      fromChain: schemas.uuid.required(),
      fromCurrency: schemas.uuid.required(),
      fromAmount: schemas.uuid.required(),
      toAddress: schemas.uuid.required()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const conversionData = req.body;

      const txHash = await multiChainService.convertToUSDT({
        userId,
        ...conversionData
      });

      res.json({
        success: true,
        message: 'Conversion initiated successfully',
        txHash
      });
    } catch (error) {
      console.error('Convert to USDT error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to convert to USDT'
      });
    }
  }
];

export const getConversionHistory = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;

      const history = await multiChainService.getUserConversionHistory(userId, limit);

      res.json({
        success: true,
        history
      });
    } catch (error) {
      console.error('Get conversion history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversion history'
      });
    }
  }
];

export const getTransactionStatus = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { txHash } = req.params;
      const { chain } = req.query;

      const status = await multiChainService.getTransactionStatus(txHash, chain as string);

      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Get transaction status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction status'
      });
    }
  }
];

// Scheduled payments endpoints
export const createScheduledPayment = [
  authenticateToken,
  validate({
    body: {
      recipientId: schemas.uuid.required(),
      amount: schemas.uuid.required(),
      currency: schemas.uuid.optional(),
      frequency: schemas.uuid.required(),
      startDate: schemas.uuid.optional(),
      endDate: schemas.uuid.optional(),
      metadata: schemas.uuid.optional()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const paymentData = req.body;

      const scheduledPayment = await scheduledPaymentService.createScheduledPayment({
        userId,
        ...paymentData
      });

      res.json({
        success: true,
        message: 'Scheduled payment created successfully',
        scheduledPayment
      });
    } catch (error) {
      console.error('Create scheduled payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create scheduled payment'
      });
    }
  }
];

export const getScheduledPayments = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { status } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await scheduledPaymentService.getUserScheduledPayments(
        userId,
        status as string,
        page,
        limit
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get scheduled payments error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch scheduled payments'
      });
    }
  }
];

export const updateScheduledPayment = [
  authenticateToken,
  validate({
    params: { id: schemas.uuid },
    body: {
      amount: schemas.uuid.optional(),
      frequency: schemas.uuid.optional(),
      endDate: schemas.uuid.optional()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      const scheduledPayment = await scheduledPaymentService.updateScheduledPayment(
        parseInt(id),
        userId,
        updates
      );

      res.json({
        success: true,
        message: 'Scheduled payment updated successfully',
        scheduledPayment
      });
    } catch (error) {
      console.error('Update scheduled payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update scheduled payment'
      });
    }
  }
];

export const pauseScheduledPayment = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await scheduledPaymentService.pauseScheduledPayment(parseInt(id), userId);

      res.json({
        success: true,
        message: 'Scheduled payment paused successfully'
      });
    } catch (error) {
      console.error('Pause scheduled payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to pause scheduled payment'
      });
    }
  }
];

export const resumeScheduledPayment = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await scheduledPaymentService.resumeScheduledPayment(parseInt(id), userId);

      res.json({
        success: true,
        message: 'Scheduled payment resumed successfully'
      });
    } catch (error) {
      console.error('Resume scheduled payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to resume scheduled payment'
      });
    }
  }
];

export const cancelScheduledPayment = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await scheduledPaymentService.cancelScheduledPayment(parseInt(id), userId);

      res.json({
        success: true,
        message: 'Scheduled payment cancelled successfully'
      });
    } catch (error) {
      console.error('Cancel scheduled payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel scheduled payment'
      });
    }
  }
];

export const getPaymentStats = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const stats = await scheduledPaymentService.getPaymentStats(userId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get payment stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment statistics'
      });
    }
  }
];

// Referral system endpoints
export const createReferral = [
  authenticateToken,
  validate({
    body: {
      referralCode: schemas.uuid.required()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { referralCode } = req.body;

      const referral = await referralService.getReferralByCode(referralCode);

      if (!referral) {
        return res.status(404).json({
          success: false,
          error: 'Invalid referral code'
        });
      }

      const newReferral = await referralService.createReferral(referral.referrerId, userId);

      res.json({
        success: true,
        message: 'Referral created successfully',
        referral: newReferral
      });
    } catch (error) {
      console.error('Create referral error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create referral'
      });
    }
  }
];

export const getReferralStats = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const stats = await referralService.getReferralStats(userId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get referral stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch referral statistics'
      });
    }
  }
];

export const getReferredUsers = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await referralService.getReferredUsers(userId, page, limit);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get referred users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch referred users'
      });
    }
  }
];

export const getUserPaymentSplits = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await referralService.getUserPaymentSplits(userId, page, limit);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get payment splits error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment splits'
      });
    }
  }
];

// Escrow endpoints
export const createEscrow = [
  authenticateToken,
  validate({
    body: {
      taskId: schemas.uuid.required(),
      payeeId: schemas.uuid.required(),
      amount: schemas.uuid.required(),
      currency: schemas.uuid.optional(),
      releaseConditions: schemas.uuid.optional(),
      expiresInDays: schemas.uuid.optional()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const escrowData = req.body;

      const escrow = await escrowService.createEscrow({
        payerId: userId,
        ...escrowData
      });

      res.json({
        success: true,
        message: 'Escrow created successfully',
        escrow
      });
    } catch (error) {
      console.error('Create escrow error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create escrow'
      });
    }
  }
];

export const fundEscrow = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const txHash = await escrowService.fundEscrow(parseInt(id), userId);

      res.json({
        success: true,
        message: 'Escrow funded successfully',
        txHash
      });
    } catch (error) {
      console.error('Fund escrow error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fund escrow'
      });
    }
  }
];

export const releaseEscrow = [
  authenticateToken,
  validate({
    body: {
      reason: schemas.uuid.optional()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { reason } = req.body;

      const txHash = await escrowService.releaseEscrow(parseInt(id), userId, reason);

      res.json({
        success: true,
        message: 'Escrow released successfully',
        txHash
      });
    } catch (error) {
      console.error('Release escrow error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to release escrow'
      });
    }
  }
];

export const refundEscrow = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { reason } = req.body;

      const txHash = await escrowService.refundEscrow(parseInt(id), userId, reason);

      res.json({
        success: true,
        message: 'Escrow refunded successfully',
        txHash
      });
    } catch (error) {
      console.error('Refund escrow error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to refund escrow'
      });
    }
  }
];

export const createDispute = [
  authenticateToken,
  validate({
    body: {
      reason: schemas.uuid.required()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { reason } = req.body;

      await escrowService.createDispute(parseInt(id), userId, reason);

      res.json({
        success: true,
        message: 'Dispute created successfully'
      });
    } catch (error) {
      console.error('Create dispute error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create dispute'
      });
    }
  }
];

export const getUserEscrows = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { role, status } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await escrowService.getUserEscrows(
        userId,
        role as 'payer' | 'payee' | 'both',
        status as string,
        page,
        limit
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get user escrows error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch escrow accounts'
      });
    }
  }
];

// Staking endpoints
export const getStakingPools = async (req: Request, res: Response) => {
  try {
    const pools = await stakingService.getActivePools();
    res.json({ success: true, pools });
  } catch (error) {
    console.error('Get staking pools error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staking pools'
    });
  }
};

export const createStake = [
  authenticateToken,
  validate({
    body: {
      poolId: schemas.uuid.required(),
      amount: schemas.uuid.required(),
      currency: schemas.uuid.optional()
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { poolId, amount, currency } = req.body;

      const stake = await stakingService.createStake(
        userId,
        parseInt(poolId),
        amount,
        currency
      );

      res.json({
        success: true,
        message: 'Stake created successfully',
        stake
      });
    } catch (error) {
      console.error('Create stake error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create stake'
      });
    }
  }
];

export const getUserStakes = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { status } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await stakingService.getUserStakes(userId, status as string, page, limit);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get user stakes error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user stakes'
      });
    }
  }
];

export const unstake = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const txHash = await stakingService.unstake(userId, parseInt(id));

      res.json({
        success: true,
        message: 'Unstake initiated successfully',
        txHash
      });
    } catch (error) {
      console.error('Unstake error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to unstake'
      });
    }
  }
];

export const claimRewards = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const txHash = await stakingService.claimRewards(userId, parseInt(id));

      res.json({
        success: true,
        message: 'Rewards claimed successfully',
        txHash
      });
    } catch (error) {
      console.error('Claim rewards error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to claim rewards'
      });
    }
  }
];

export const getRewardHistory = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await stakingService.getRewardHistory(userId, page, limit);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get reward history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reward history'
      });
    }
  }
];

export const getStakingStats = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const stats = await stakingService.getUserStakingStats(userId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get staking stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch staking statistics'
      });
    }
  }
];

// Analytics endpoint
export const getPaymentAnalytics = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const analytics = await multiChainService.getPaymentAnalytics(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        analytics
      });
    } catch (error) {
      console.error('Get payment analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment analytics'
      });
    }
  }
];

// Admin endpoints
export const resolveDispute = [
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { resolution, action } = req.body;

      const txHash = await escrowService.resolveDispute(
        parseInt(id),
        userId,
        resolution,
        action
      );

      res.json({
        success: true,
        message: 'Dispute resolved successfully',
        txHash
      });
    } catch (error) {
      console.error('Resolve dispute error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to resolve dispute'
      });
    }
  }
];

export const getGlobalStakingStats = async (req: Request, res: Response) => {
  try {
    const stats = await stakingService.getGlobalStakingStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get global staking stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch global staking statistics'
    });
  }
};