import { vi } from 'vitest';

// Mock Telegram Bot API
export const createMockTelegramBot = () => ({
  api: {
    sendMessage: vi.fn().mockResolvedValue({
      message_id: 123,
      text: 'Message sent',
    }),
    editMessageText: vi.fn().mockResolvedValue({
      message_id: 123,
      text: 'Message edited',
    }),
    editMessageReplyMarkup: vi.fn().mockResolvedValue({
      message_id: 123,
    }),
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
    sendChatAction: vi.fn().mockResolvedValue({}),
    getChat: vi.fn().mockResolvedValue({
      id: 123456789,
      type: 'private',
      first_name: 'Test',
      username: 'testuser',
    }),
    getUserProfilePhotos: vi.fn().mockResolvedValue({
      total_count: 1,
      photos: [[{
        file_id: 'photo123',
        file_unique_id: 'unique123',
        width: 200,
        height: 200,
      }]],
    }),
  },
  bot: {
    info: {
      id: 987654321,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'testbot',
    },
  },
});

// Mock WebSocket connection
export const createMockWebSocket = () => ({
  id: 'socket-123',
  userId: 'user-123',
  connected: true,
  emit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  to: vi.fn().mockReturnValue({
    emit: vi.fn(),
  }),
  disconnect: vi.fn(),
});

// Mock HTTP client (Axios)
export const createMockAxios = () => ({
  get: vi.fn().mockResolvedValue({
    data: { success: true },
    status: 200,
  }),
  post: vi.fn().mockResolvedValue({
    data: { success: true },
    status: 201,
  }),
  put: vi.fn().mockResolvedValue({
    data: { success: true },
    status: 200,
  }),
  delete: vi.fn().mockResolvedValue({
    data: { success: true },
    status: 200,
  }),
  patch: vi.fn().mockResolvedValue({
    data: { success: true },
    status: 200,
  }),
});

// Mock TonConnect
export const createMockTonConnect = () => ({
  connect: vi.fn().mockResolvedValue({
    account: {
      address: 'EQTestAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      chain: 'TESTNET',
    },
    wallet: {
      device: 'Test Device',
    },
  }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  sendTransaction: vi.fn().mockResolvedValue({
    boc: 'base64boc123456789',
  }),
  restoreConnection: vi.fn(),
  onStatusChange: vi.fn(),
  onConnectionError: vi.fn(),
});

// Mock TON wallet
export const createMockTonWallet = () => ({
  address: 'EQTestAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  balance: vi.fn().mockResolvedValue('1000000000'), // in nanotons
  seqno: vi.fn().mockResolvedValue(1),
  getTransactions: vi.fn().mockResolvedValue([
    {
      hash: 'txhash123456789',
      lt: '123456789',
      transaction: {
        id: { hash: 'txhash123456789' },
        now: 1640995200,
        out_msgs: [],
        in_msg: { source: 'EQSenderAddress' },
      },
    },
  ]),
  send: vi.fn().mockResolvedValue({
    hash: 'newtxhash123456789',
    lt: '123456790',
  }),
  deploy: vi.fn().mockResolvedValue({
    hash: 'deployhash123456789',
    lt: '123456791',
  }),
  createExternalMessage: vi.fn().mockReturnValue({
    cell: 'base64cell123456789',
    address: 'EQTestAddress',
  }),
});

// Mock USDT contract
export const createMockUSDTContract = () => ({
  getBalance: vi.fn().mockResolvedValue('100000000'), // in wei
  transfer: vi.fn().mockResolvedValue({
    hash: 'usdttexhash123456789',
    lt: '123456800',
  }),
  approve: vi.fn().mockResolvedValue({
    hash: 'usdtapprovehash123456789',
    lt: '123456801',
  }),
  transferFrom: vi.fn().mockResolvedValue({
    hash: 'usdttransferfromhash123456789',
    lt: '123456802',
  }),
  allowance: vi.fn().mockResolvedValue('1000000000'),
  totalSupply: vi.fn().mockResolvedValue('1000000000000000000'),
  decimals: vi.fn().mockResolvedValue(6),
  symbol: vi.fn().mockResolvedValue('USDT'),
  name: vi.fn().mockResolvedValue('Tether USD'),
});

// Mock Redis client
export const createMockRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-1),
  incr: vi.fn().mockResolvedValue(1),
  incrby: vi.fn().mockResolvedValue(5),
  decr: vi.fn().mockResolvedValue(1),
  decrby: vi.fn().mockResolvedValue(5),
  hget: vi.fn().mockResolvedValue(null),
  hset: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),
  hdel: vi.fn().mockResolvedValue(1),
  hexists: vi.fn().mockResolvedValue(0),
  hkeys: vi.fn().mockResolvedValue([]),
  hvals: vi.fn().mockResolvedValue([]),
  hlen: vi.fn().mockResolvedValue(0),
  hincrby: vi.fn().mockResolvedValue(1),
  lpush: vi.fn().mockResolvedValue(1),
  rpush: vi.fn().mockResolvedValue(1),
  lpop: vi.fn().mockResolvedValue('value'),
  rpop: vi.fn().mockResolvedValue('value'),
  lrange: vi.fn().mockResolvedValue(['value1', 'value2']),
  llen: vi.fn().mockResolvedValue(0),
  lindex: vi.fn().mockResolvedValue(null),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  sismember: vi.fn().mockResolvedValue(0),
  smembers: vi.fn().mockResolvedValue([]),
  scard: vi.fn().mockResolvedValue(0),
  sinter: vi.fn().mockResolvedValue([]),
  sunion: vi.fn().mockResolvedValue([]),
  sdiff: vi.fn().mockResolvedValue([]),
  keys: vi.fn().mockResolvedValue([]),
  flushdb: vi.fn().mockResolvedValue('OK'),
  ping: vi.fn().mockResolvedValue('PONG'),
  quit: vi.fn().mockResolvedValue('OK'),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
});

// Mock Email service
export const createMockEmailService = () => ({
  sendEmail: vi.fn().mockResolvedValue({
    messageId: 'msg-123',
    accepted: ['test@example.com'],
    rejected: [],
  }),
  sendWelcomeEmail: vi.fn().mockResolvedValue({
    messageId: 'welcome-123',
  }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({
    messageId: 'reset-123',
  }),
  sendVerificationEmail: vi.fn().mockResolvedValue({
    messageId: 'verify-123',
  }),
  sendNotificationEmail: vi.fn().mockResolvedValue({
    messageId: 'notif-123',
  }),
});

// Mock Cloud Storage (S3)
export const createMockS3 = () => ({
  upload: vi.fn().mockReturnValue({
    promise: vi.fn().mockResolvedValue({
      Location: 'https://bucket.s3.amazonaws.com/file.jpg',
      ETag: '"etag123456"',
      Bucket: 'bucket',
      Key: 'file.jpg',
    }),
  }),
  getObject: vi.fn().mockReturnValue({
    promise: vi.fn().mockResolvedValue({
      Body: Buffer.from('file content'),
      ContentType: 'image/jpeg',
      ContentLength: 1024,
    }),
  }),
  deleteObject: vi.fn().mockReturnValue({
    promise: vi.fn().mockResolvedValue({}),
  }),
  getSignedUrl: vi.fn().mockResolvedValue(
    'https://bucket.s3.amazonaws.com/file.jpg?signature=123'
  ),
  listObjectsV2: vi.fn().mockReturnValue({
    promise: vi.fn().mockResolvedValue({
      Contents: [
        {
          Key: 'file1.jpg',
          Size: 1024,
          LastModified: new Date(),
          ETag: '"etag123"',
        },
      ],
    }),
  }),
});

// Mock Payment processor
export const createMockPaymentProcessor = () => ({
  processPayment: vi.fn().mockResolvedValue({
    success: true,
    transactionId: 'txn-123',
    amount: 100,
    fee: 0.5,
    currency: 'TON',
    status: 'completed',
  }),
  refundPayment: vi.fn().mockResolvedValue({
    success: true,
    refundId: 'refund-123',
    amount: 100,
    status: 'processed',
  }),
  getPaymentStatus: vi.fn().mockResolvedValue({
    status: 'completed',
    confirmedAt: new Date(),
    blockNumber: 12345,
  }),
  calculateFee: vi.fn().mockResolvedValue(0.5),
  validateAddress: vi.fn().mockReturnValue(true),
  createInvoice: vi.fn().mockResolvedValue({
    invoiceId: 'inv-123',
    amount: 100,
    currency: 'TON',
    address: 'EQInvoiceAddress',
    expiresAt: new Date(Date.now() + 3600000),
  }),
});

// Mock AI service
export const createMockAIService = () => ({
  classifyImage: vi.fn().mockResolvedValue({
    label: 'cat',
    confidence: 0.95,
    categories: [
      { label: 'cat', confidence: 0.95 },
      { label: 'dog', confidence: 0.04 },
      { label: 'bird', confidence: 0.01 },
    ],
  }),
  generateLabels: vi.fn().mockResolvedValue([
    { label: 'positive', confidence: 0.88 },
    { label: 'review', confidence: 0.75 },
    { label: 'product', confidence: 0.65 },
  ]),
  analyzeSentiment: vi.fn().mockResolvedValue({
    sentiment: 'positive',
    score: 0.87,
    emotions: {
      joy: 0.75,
      anger: 0.05,
      sadness: 0.05,
      fear: 0.02,
      surprise: 0.13,
    },
  }),
  extractText: vi.fn().mockResolvedValue({
    text: 'Extracted text from image',
    confidence: 0.92,
    language: 'en',
  }),
  moderateContent: vi.fn().mockResolvedValue({
    safe: true,
    categories: {
      violence: 0.01,
      adult: 0.00,
      spam: 0.02,
      hate: 0.00,
    },
  }),
});

// Create global mocks
vi.mock('grammy', () => ({
  Bot: vi.fn(() => createMockTelegramBot()),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => createMockRedis()),
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => createMockEmailService()),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3: vi.fn(() => createMockS3()),
}));

vi.mock('@ton/ton', () => ({
  TonClient: vi.fn(() => ({
    open: vi.fn(() => createMockTonWallet()),
  })),
}));

vi.mock('@ton/crypto', () => ({
  mnemonicNew: vi.fn().mockResolvedValue(['word1', 'word2', 'word3']),
  mnemonicToPrivateKey: vi.fn().mockResolvedValue({ publicKey: 'pubkey', secretKey: 'seckey' }),
}));

// Export mock creators
export {
  vi,
};