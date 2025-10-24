/**
 * TON Mainnet Configuration for Production
 */

export const TON_MAINNET_CONFIG = {
  // Mainnet endpoints
  endpoints: [
    'https://toncenter.com/api/v2/jsonRPC',
    'https://mainnet-v4.tonhubapi.com',
    'https://toncenter.com/api/v2/jsonRPC?api_key=' + process.env.TON_API_KEY
  ],

  // Contract addresses on mainnet
  contracts: {
    usdt: 'EQCxE6mUtQJKFnGfaROTKOt1lEZb9ATg-TFoM3BzO5dYQfTj',
    paymentProcessor: process.env.PAYMENT_PROCESSOR_ADDRESS || '',
    bridge: process.env.BRIDGE_ADDRESS || ''
  },

  // Gas configuration for mainnet
  gas: {
    // Base fees in nanoTON
    transferFee: '60000000', // 0.06 TON
    usdtTransferFee: '100000000', // 0.1 TON
    contractDeployFee: '500000000', // 0.5 TON
    maxFeePerTx: '200000000', // 0.2 TON
  },

  // Production limits
  limits: {
    maxTransactionAmount: '1000000000000', // 1M USDT
    minTransactionAmount: '1000000', // 1 USDT
    maxRetries: 5,
    retryDelay: 30000, // 30 seconds
    confirmationTimeout: 180000, // 3 minutes
    maxPendingTransactions: 1000
  },

  // Monitoring thresholds
  monitoring: {
    gasPriceThreshold: '150000000', // Alert if gas > 0.15 TON
    failureRateThreshold: 0.05, // Alert if failure rate > 5%
    pendingTxThreshold: 100, // Alert if pending > 100
    balanceThreshold: '1000000000' // Alert if wallet balance < 1 TON
  },

  // Security settings
  security: {
    requireMultisig: true,
    multisigThreshold: '1000000000000', // 1M USDT requires multisig
    maxDailyVolume: '10000000000000', // 10M USDT daily limit
    suspiciousActivityThreshold: 10 // Alert on 10+ failed attempts
  }
};

// Environment validation
export function validateMainnetConfig(): void {
  const required = [
    'TON_API_KEY',
    'TON_MASTER_KEY',
    'PAYMENT_PROCESSOR_ADDRESS'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required mainnet environment variables: ${missing.join(', ')}`);
  }
}

// Get current network state
export function getMainnetNetworkState() {
  return {
    isMainnet: true,
    networkId: -239, // Mainnet ID
    workchain: 0,
    configHash: process.env.MAINNET_CONFIG_HASH
  };
}