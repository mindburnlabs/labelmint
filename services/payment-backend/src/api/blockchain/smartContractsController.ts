import { Request, Response } from 'express';
import { smartContractService } from '../../services/blockchain/SmartContractService';
import { Logger } from '../../utils/logger';
import { authenticateAdmin } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';

const logger = new Logger('SmartContractsController');

/**
 * GET /api/blockchain/contracts/status
 * Get smart contract service status
 */
export const getContractStatus = async (req: Request, res: Response) => {
  try {
    const status = await smartContractService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get contract status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contract status',
      message: error.message
    });
  }
};

/**
 * GET /api/blockchain/contracts/:network/:type/info
 * Get contract information
 */
export const getContractInfo = async (req: Request, res: Response) => {
  try {
    const { network, type } = req.params;

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    const info = await smartContractService.getContractInfo(network, type);
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    logger.error('Failed to get contract info', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contract info',
      message: error.message
    });
  }
};

/**
 * POST /api/blockchain/contracts/:network/deposit
 * Send deposit to payment processor
 */
export const sendDeposit = async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { amount, recipient, message } = req.body;
    const signerAddress = req.user?.address; // From authenticated user

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    if (!amount || !recipient) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, recipient'
      });
    }

    const result = await smartContractService.sendDeposit(network, {
      amount,
      recipient,
      message
    }, signerAddress);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Deposit sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Deposit failed',
        message: result.error
      });
    }
  } catch (error) {
    logger.error('Failed to send deposit', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send deposit',
      message: error.message
    });
  }
};

/**
 * POST /api/blockchain/contracts/:network/withdraw
 * Withdraw funds from payment processor
 */
export const withdraw = async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { amount, recipient } = req.body;
    const signerAddress = req.user?.address; // From authenticated admin

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    if (!amount || !recipient) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, recipient'
      });
    }

    const result = await smartContractService.withdraw(network, {
      amount,
      recipient
    }, signerAddress);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Withdrawal sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Withdrawal failed',
        message: result.error
      });
    }
  } catch (error) {
    logger.error('Failed to withdraw', error);
    res.status(500).json({
      success: false,
      error: 'Failed to withdraw',
      message: error.message
    });
  }
};

/**
 * POST /api/blockchain/contracts/:network/create-channel
 * Create payment channel
 */
export const createChannel = async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { participant, capacity, duration } = req.body;
    const signerAddress = req.user?.address; // From authenticated admin

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    if (!participant || !capacity || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: participant, capacity, duration'
      });
    }

    const result = await smartContractService.createChannel(network, {
      participant,
      capacity,
      duration
    }, signerAddress);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Channel created successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Channel creation failed',
        message: result.error
      });
    }
  } catch (error) {
    logger.error('Failed to create channel', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create channel',
      message: error.message
    });
  }
};

/**
 * POST /api/blockchain/contracts/:network/channel-payment
 * Send payment through channel
 */
export const sendChannelPayment = async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { channelId, amount, recipient } = req.body;
    const signerAddress = req.user?.address; // From authenticated admin

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    if (channelId === undefined || !amount || !recipient) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: channelId, amount, recipient'
      });
    }

    const result = await smartContractService.sendChannelPayment(network, {
      channelId,
      amount,
      recipient
    }, signerAddress);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Channel payment sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Channel payment failed',
        message: result.error
      });
    }
  } catch (error) {
    logger.error('Failed to send channel payment', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send channel payment',
      message: error.message
    });
  }
};

/**
 * POST /api/blockchain/contracts/:network/close-channel
 * Close payment channel
 */
export const closeChannel = async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { channelId } = req.body;
    const signerAddress = req.user?.address; // From authenticated admin

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    if (channelId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: channelId'
      });
    }

    const result = await smartContractService.closeChannel(network, channelId, signerAddress);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Channel closed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Channel closure failed',
        message: result.error
      });
    }
  } catch (error) {
    logger.error('Failed to close channel', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close channel',
      message: error.message
    });
  }
};

/**
 * GET /api/blockchain/contracts/:network/channels/:channelId
 * Get channel information
 */
export const getChannelInfo = async (req: Request, res: Response) => {
  try {
    const { network, channelId } = req.params;

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    const channelInfo = await smartContractService.getChannelInfo(network, parseInt(channelId));

    if (channelInfo) {
      res.json({
        success: true,
        data: channelInfo
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
  } catch (error) {
    logger.error('Failed to get channel info', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get channel info',
      message: error.message
    });
  }
};

/**
 * POST /api/blockchain/contracts/register
 * Register new contract deployment (admin only)
 */
export const registerContract = async (req: Request, res: Response) => {
  try {
    const { address, network, type, version, deployedAt, ownerAddress } = req.body;

    if (!address || !network || !type || !version || !deployedAt || !ownerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: address, network, type, version, deployedAt, ownerAddress'
      });
    }

    await smartContractService.registerContract({
      address,
      network,
      type,
      version,
      deployedAt: new Date(deployedAt),
      ownerAddress
    });

    res.json({
      success: true,
      message: 'Contract registered successfully'
    });
  } catch (error) {
    logger.error('Failed to register contract', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register contract',
      message: error.message
    });
  }
};

/**
 * POST /api/blockchain/contracts/:network/monitor-events
 * Monitor contract events (admin only)
 */
export const monitorEvents = async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { fromBlock, contractType = 'PaymentProcessor' } = req.body;

    if (!['mainnet', 'testnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be mainnet or testnet'
      });
    }

    // Start monitoring (this would typically be a WebSocket or long-polling endpoint)
    await smartContractService.monitorContractEvents(network, contractType, fromBlock, (event) => {
      logger.info('Contract event detected:', event);
      // In production, you'd emit this via WebSocket or store in database
    });

    res.json({
      success: true,
      message: 'Event monitoring started'
    });
  } catch (error) {
    logger.error('Failed to monitor events', error);
    res.status(500).json({
      success: false,
      error: 'Failed to monitor events',
      message: error.message
    });
  }
};