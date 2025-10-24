import { Router } from 'express';
import {
  getContractStatus,
  getContractInfo,
  sendDeposit,
  withdraw,
  createChannel,
  sendChannelPayment,
  closeChannel,
  getChannelInfo,
  registerContract,
  monitorEvents
} from './smartContractsController';
import { authenticateAdmin, authenticateUser } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Validation schemas
const depositValidation = [
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('recipient').isEthereumAddress().withMessage('Invalid recipient address'),
  body('message').optional().isString().withMessage('Message must be a string')
];

const withdrawValidation = [
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('recipient').isEthereumAddress().withMessage('Invalid recipient address')
];

const createChannelValidation = [
  body('participant').isEthereumAddress().withMessage('Invalid participant address'),
  body('capacity').isNumeric().withMessage('Capacity must be numeric'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer')
];

const channelPaymentValidation = [
  body('channelId').isInt({ min: 1 }).withMessage('Channel ID must be a positive integer'),
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('recipient').isEthereumAddress().withMessage('Invalid recipient address')
];

const closeChannelValidation = [
  body('channelId').isInt({ min: 1 }).withMessage('Channel ID must be a positive integer')
];

const registerContractValidation = [
  body('address').isEthereumAddress().withMessage('Invalid contract address'),
  body('network').isIn(['mainnet', 'testnet']).withMessage('Network must be mainnet or testnet'),
  body('type').isString().withMessage('Contract type is required'),
  body('version').isString().withMessage('Version is required'),
  body('deployedAt').isISO8601().withMessage('Invalid deployment date'),
  body('ownerAddress').isEthereumAddress().withMessage('Invalid owner address')
];

const monitorEventsValidation = [
  body('fromBlock').optional().isInt({ min: 0 }).withMessage('From block must be a non-negative integer'),
  body('contractType').optional().isString().withMessage('Contract type must be a string')
];

const networkParamValidation = [
  param('network').isIn(['mainnet', 'testnet']).withMessage('Network must be mainnet or testnet')
];

const channelIdParamValidation = [
  param('channelId').isInt({ min: 1 }).withMessage('Channel ID must be a positive integer')
];

/**
 * Public routes (read-only)
 */
router.get('/status', getContractStatus);

router.get('/contracts/:network/:type/info',
  networkParamValidation,
  validateRequest,
  getContractInfo
);

router.get('/contracts/:network/channels/:channelId',
  [...networkParamValidation, ...channelIdParamValidation],
  validateRequest,
  getChannelInfo
);

/**
 * User routes (require authentication)
 */
router.post('/contracts/:network/deposit',
  [...networkParamValidation, ...depositValidation],
  authenticateUser,
  validateRequest,
  sendDeposit
);

/**
 * Admin routes (require admin authentication)
 */
router.post('/contracts/:network/withdraw',
  [...networkParamValidation, ...withdrawValidation],
  authenticateAdmin,
  validateRequest,
  withdraw
);

router.post('/contracts/:network/create-channel',
  [...networkParamValidation, ...createChannelValidation],
  authenticateAdmin,
  validateRequest,
  createChannel
);

router.post('/contracts/:network/channel-payment',
  [...networkParamValidation, ...channelPaymentValidation],
  authenticateAdmin,
  validateRequest,
  sendChannelPayment
);

router.post('/contracts/:network/close-channel',
  [...networkParamValidation, ...closeChannelValidation],
  authenticateAdmin,
  validateRequest,
  closeChannel
);

router.post('/contracts/register',
  registerContractValidation,
  authenticateAdmin,
  validateRequest,
  registerContract
);

router.post('/contracts/:network/monitor-events',
  [...networkParamValidation, ...monitorEventsValidation],
  authenticateAdmin,
  validateRequest,
  monitorEvents
);

export default router;