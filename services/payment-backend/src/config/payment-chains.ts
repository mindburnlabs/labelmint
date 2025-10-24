// Multi-chain payment configuration
export const PAYMENT_CHAINS = {
  TON: {
    name: 'ton',
    chainId: -1,
    nativeCurrency: 'TON',
    decimals: 9,
    fee: 0.001,
    speed: 2, // Average confirmation time in seconds
    explorerUrl: 'https://tonscan.org',
    rpcEndpoints: [
      'https://toncenter.com/api/v2/jsonRPC',
      'https://tonapi.io/v2'
    ],
    contracts: {
      USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs' // Mainnet USDT
    },
    gasLimits: {
      transfer: 10000000, // 0.01 TON
      tokenTransfer: 20000000, // 0.02 TON
      contractDeploy: 50000000 // 0.05 TON
    }
  },
  SOLANA: {
    name: 'solana',
    chainId: 101,
    nativeCurrency: 'SOL',
    decimals: 9,
    fee: 0.00025,
    speed: 1,
    explorerUrl: 'https://solscan.io',
    rpcEndpoints: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana'
    ],
    contracts: {
      USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT on Solana
    },
    gasLimits: {
      transfer: 5000, // Lamports
      tokenTransfer: 10000,
      contractDeploy: 2000000
    }
  },
  POLYGON: {
    name: 'polygon',
    chainId: 137,
    nativeCurrency: 'MATIC',
    decimals: 18,
    fee: 0.01,
    speed: 5,
    explorerUrl: 'https://polygonscan.com',
    rpcEndpoints: [
      'https://polygon-rpc.com',
      'https://rpc-mainnet.maticvigil.com',
      'https://polygon-mainnet.public.blastapi.io'
    ],
    contracts: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' // USDT on Polygon
    },
    gasLimits: {
      transfer: 21000,
      tokenTransfer: 65000,
      contractDeploy: 2000000
    }
  },
  ARBITRUM: {
    name: 'arbitrum',
    chainId: 42161,
    nativeCurrency: 'ETH',
    decimals: 18,
    fee: 0.1,
    speed: 3,
    explorerUrl: 'https://arbiscan.io',
    rpcEndpoints: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-mainnet.infura.io/v3',
      'https://rpc.ankr.com/arbitrum'
    ],
    contracts: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' // USDT on Arbitrum
    },
    gasLimits: {
      transfer: 21000,
      tokenTransfer: 65000,
      contractDeploy: 2500000
    }
  }
} as const;

// Exchange rate providers
export const EXCHANGE_PROVIDERS = {
  COINGECKO: {
    name: 'coingecko',
    baseUrl: 'https://api.coingecko.com/api/v3',
    rateLimit: 50, // requests per minute
    supported: ['USD', 'EUR', 'GBP', 'BTC', 'ETH']
  },
  BINANCE: {
    name: 'binance',
    baseUrl: 'https://api.binance.com/api/v3',
    rateLimit: 1200,
    supported: ['USD', 'BTC', 'ETH', 'USDT', 'BUSD']
  },
  CRYPTOCOMPARE: {
    name: 'cryptocompare',
    baseUrl: 'https://min-api.cryptocompare.com/data',
    rateLimit: 100,
    supported: ['USD', 'EUR', 'BTC', 'ETH']
  }
};

// Staking pool configurations
export const STAKING_CONFIG = {
  MIN_STAKE_AMOUNT: 100, // Minimum 100 USDT
  MAX_STAKE_AMOUNT: 1000000, // Maximum 1M USDT
  REWARDS_FREQUENCY: 3600, // Calculate rewards every hour (seconds)
  EARLY_UNSTAKE_PENALTY: 0.1, // 10% penalty for early unstaking
  REFERRAL_BONUS_RATE: 0.05, // 5% referral bonus
  ESCROW_TIMEOUT_DAYS: 30, // Escrow expires after 30 days
  MIN_SCHEDULED_PAYMENT: 10, // Minimum 10 USDT for scheduled payments
  CONVERSION_FEE_RATE: 0.005, // 0.5% fee for crypto-to-USDT conversion
  AUTO_CONVERSION_THRESHOLD: 1000 // Auto-convert crypto when balance exceeds 1000 USD equivalent
};

// Payment status constants
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
} as const;

// Escrow status constants
export const ESCROW_STATUS = {
  PENDING: 'pending',
  FUNDED: 'funded',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
  EXPIRED: 'expired'
} as const;

// Staking status constants
export const STAKING_STATUS = {
  ACTIVE: 'active',
  UNSTAKING: 'unstaking',
  COMPLETED: 'completed',
  PENALIZED: 'penalized'
} as const;