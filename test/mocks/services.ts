import { vi } from 'vitest'

// Centralized mock services for consistent testing across the application

export const mockAuthService = {
  generateToken: vi.fn().mockReturnValue('mock-jwt-token'),
  verifyToken: vi.fn().mockImplementation((token: string) => {
    if (token === 'valid-token') {
      return {
        userId: 'user_test_123',
        email: 'test@example.com',
        role: 'annotator',
      }
    }
    if (token === 'admin-token') {
      return {
        userId: 'admin_test_123',
        email: 'admin@example.com',
        role: 'admin',
      }
    }
    throw new Error('Invalid token')
  }),
  hashPassword: vi.fn().mockReturnValue('hashed-password-mock'),
  comparePassword: vi.fn().mockImplementation((plain: string, hashed: string) => {
    return plain === 'correct-password' && hashed.includes('hashed-password')
  }),
  refreshToken: vi.fn().mockReturnValue('refreshed-mock-token'),
  revokeToken: vi.fn().mockResolvedValue(true),
  validatePassword: vi.fn().mockImplementation((password: string) => {
    return {
      isValid: password.length >= 8,
      errors: password.length < 8 ? ['Password must be at least 8 characters'] : [],
    }
  }),
}

export const mockPaymentService = {
  createPayment: vi.fn().mockResolvedValue({
    id: 'payment_123',
    userId: 'user_test_123',
    amount: 100,
    currency: 'USDT',
    status: 'pending',
    type: 'task_payment',
    metadata: {
      taskId: 'task_123',
      completedAt: new Date(),
    },
    createdAt: new Date(),
  }),
  processPayment: vi.fn().mockResolvedValue({
    id: 'payment_123',
    status: 'completed',
    transactionHash: '0x1234567890abcdef',
    networkFee: 0.001,
    completedAt: new Date(),
  }),
  confirmPayment: vi.fn().mockResolvedValue({
    id: 'payment_123',
    status: 'confirmed',
    confirmedAt: new Date(),
  }),
  rejectPayment: vi.fn().mockResolvedValue({
    id: 'payment_123',
    status: 'rejected',
    reason: 'Insufficient funds',
    rejectedAt: new Date(),
  }),
  getUserBalance: vi.fn().mockResolvedValue({
    userId: 'user_test_123',
    usdtBalance: 1000.50,
    tonBalance: 5.25,
    totalEarned: 1250.75,
    totalWithdrawn: 250.25,
    lastUpdated: new Date(),
  }),
  withdrawFunds: vi.fn().mockResolvedValue({
    id: 'withdrawal_123',
    userId: 'user_test_123',
    amount: 100,
    currency: 'USDT',
    address: 'EQWithdrawalAddress123456789',
    status: 'processing',
    networkFee: 0.5,
    createdAt: new Date(),
  }),
  getTransactionHistory: vi.fn().mockResolvedValue({
    transactions: [
      {
        id: 'payment_1',
        type: 'earning',
        amount: 0.01,
        currency: 'USDT',
        status: 'completed',
        taskId: 'task_123',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        id: 'withdrawal_1',
        type: 'withdrawal',
        amount: 100,
        currency: 'USDT',
        status: 'completed',
        address: 'EQWithdrawalAddress123456789',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
  }),
  calculateEarnings: vi.fn().mockResolvedValue({
    totalEarnings: 1250.75,
    thisMonth: 150.25,
    lastMonth: 200.50,
    today: 15.00,
    taskCount: 1250,
    averagePerTask: 1.00,
  }),
}

export const mockTaskService = {
  getAvailableTasks: vi.fn().mockResolvedValue({
    tasks: [
      {
        id: 'task_1',
        type: 'image_classification',
        projectId: 'project_123',
        imageUrl: 'https://example.com/tasks/123.jpg',
        instructions: 'Classify the image',
        expectedLabels: ['cat', 'dog', 'bird'],
        paymentPerLabel: 0.01,
        timeLimit: 300,
        difficulty: 'medium',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      {
        id: 'task_2',
        type: 'text_annotation',
        projectId: 'project_123',
        text: 'This is a sample text for annotation.',
        instructions: 'Annotate the text sentiment',
        expectedLabels: ['positive', 'negative', 'neutral'],
        paymentPerLabel: 0.02,
        timeLimit: 600,
        difficulty: 'easy',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    },
  }),
  getTaskById: vi.fn().mockImplementation((taskId: string) => {
    if (taskId === 'task_1') {
      return {
        id: 'task_1',
        type: 'image_classification',
        projectId: 'project_123',
        imageUrl: 'https://example.com/tasks/123.jpg',
        instructions: 'Classify the image',
        expectedLabels: ['cat', 'dog', 'bird'],
        paymentPerLabel: 0.01,
        timeLimit: 300,
        difficulty: 'medium',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
    }
    return null
  }),
  assignTask: vi.fn().mockResolvedValue({
    taskId: 'task_1',
    userId: 'user_test_123',
    assignedAt: new Date(),
    timeLimit: 300,
    expiresAt: new Date(Date.now() + 300 * 1000),
  }),
  submitTask: vi.fn().mockResolvedValue({
    submissionId: 'submission_123',
    taskId: 'task_1',
    userId: 'user_test_123',
    labels: ['cat'],
    confidence: 95,
    timeSpent: 120,
    submittedAt: new Date(),
    status: 'submitted',
  }),
  getUserTaskHistory: vi.fn().mockResolvedValue({
    tasks: [
      {
        id: 'task_1',
        type: 'image_classification',
        status: 'completed',
        submittedAt: new Date(Date.now() - 60 * 60 * 1000),
        earnedAmount: 0.01,
        labels: ['cat'],
        confidence: 95,
        timeSpent: 120,
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  }),
  validateSubmission: vi.fn().mockImplementation((submission: any) => {
    const isValid = submission.labels && submission.labels.length > 0
    return {
      isValid,
      errors: isValid ? [] : ['At least one label is required'],
    }
  }),
}

export const mockTelegramBotService = {
  sendMessage: vi.fn().mockResolvedValue({
    message_id: 12345,
    chat: { id: 987654321 },
    text: 'Test message',
    date: Math.floor(Date.now() / 1000),
  }),
  sendPhoto: vi.fn().mockResolvedValue({
    message_id: 12346,
    chat: { id: 987654321 },
    photo: [
      {
        file_id: 'photo_file_123',
        file_unique_id: 'photo_unique_123',
        file_size: 1024,
        width: 800,
        height: 600,
      },
    ],
    date: Math.floor(Date.now() / 1000),
  }),
  sendDocument: vi.fn().mockResolvedValue({
    message_id: 12347,
    chat: { id: 987654321 },
    document: {
      file_id: 'doc_file_123',
      file_unique_id: 'doc_unique_123',
      file_size: 2048,
      file_name: 'document.pdf',
    },
    date: Math.floor(Date.now() / 1000),
  }),
  sendChatAction: vi.fn().mockResolvedValue(true),
  answerCallbackQuery: vi.fn().mockResolvedValue(true),
  editMessageText: vi.fn().mockResolvedValue({
    message_id: 12345,
    text: 'Edited message',
    date: Math.floor(Date.now() / 1000),
  }),
  editMessageReplyMarkup: vi.fn().mockResolvedValue({
    message_id: 12345,
    date: Math.floor(Date.now() / 1000),
  }),
  getChat: vi.fn().mockResolvedValue({
    id: 987654321,
    first_name: 'Test User',
    username: 'testuser',
    type: 'private',
  }),
  getFileLink: vi.fn().mockResolvedValue('https://api.telegram.org/file/bot<token>/photo.jpg'),
  getUserProfilePhotos: vi.fn().mockResolvedValue({
    total_count: 1,
    photos: [
      [
        {
          file_id: 'profile_photo_123',
          file_size: 1024,
          width: 200,
          height: 200,
        },
      ],
    ],
  }),
}

export const mockTONService = {
  createWallet: vi.fn().mockResolvedValue({
    address: 'EQDemoAddress123456789',
    publicKey: 'public_key_demo_123',
    mnemonic: ['word1', 'word2', 'word3', 'word4', 'word5', 'word6', 'word7', 'word8', 'word9', 'word10', 'word11', 'word12'],
    walletConfig: {
      workchain: 0,
      subwalletId: 0,
    },
  }),
  getBalance: vi.fn().mockResolvedValue({
    address: 'EQDemoAddress123456789',
    tonBalance: '5.5',
    usdtBalance: '1000.5',
    totalBalanceUSD: 1055.00,
    lastUpdated: new Date(),
  }),
  sendTransaction: vi.fn().mockResolvedValue({
    hash: 'transaction_hash_1234567890abcdef',
    lt: 1234567890,
    success: true,
    fromAddress: 'EQFromAddress123456789',
    toAddress: 'EQToAddress123456789',
    amount: '1000000000', // in nanoTON
    fee: '10000000', // in nanoTON
    timestamp: new Date(),
  }),
  validateAddress: vi.fn().mockImplementation((address: string) => {
    // Simple validation for testing
    return {
      isValid: address.startsWith('EQ') && address.length >= 66,
      error: address.startsWith('EQ') ? null : 'Invalid TON address format',
    }
  }),
  getTransactionHistory: vi.fn().mockResolvedValue({
    transactions: [
      {
        hash: 'tx_hash_123',
        lt: 1234567890,
        type: 'incoming',
        amount: '1000000000',
        fromAddress: 'EQSenderAddress123456789',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        message: 'Payment received',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  }),
  usdtTransfer: vi.fn().mockResolvedValue({
    transactionHash: 'usdt_tx_hash_1234567890',
    fromAddress: 'EQFromAddress123456789',
    toAddress: 'EQToAddress123456789',
    amount: '100000000', // USDT is 6 decimal places
    fee: '1000000',
    success: true,
    timestamp: new Date(),
  }),
}

export const mockProjectService = {
  getProjects: vi.fn().mockResolvedValue({
    projects: [
      {
        id: 'project_1',
        name: 'Image Classification Dataset',
        description: 'Classify various images into predefined categories',
        type: 'image_classification',
        status: 'active',
        totalTasks: 10000,
        completedTasks: 7500,
        expectedLabels: ['cat', 'dog', 'bird', 'car', 'person'],
        paymentPerTask: 0.01,
        difficulty: 'medium',
        requirements: {
          minAccuracy: 0.8,
          timePerTask: 300,
          qualifications: ['basic_training'],
        },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  }),
  getProjectById: vi.fn().mockImplementation((projectId: string) => {
    if (projectId === 'project_1') {
      return {
        id: 'project_1',
        name: 'Image Classification Dataset',
        description: 'Classify various images into predefined categories',
        type: 'image_classification',
        status: 'active',
        totalTasks: 10000,
        completedTasks: 7500,
        expectedLabels: ['cat', 'dog', 'bird', 'car', 'person'],
        paymentPerTask: 0.01,
        difficulty: 'medium',
        requirements: {
          minAccuracy: 0.8,
          timePerTask: 300,
          qualifications: ['basic_training'],
        },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      }
    }
    return null
  }),
  createProject: vi.fn().mockResolvedValue({
    id: 'project_new_123',
    name: 'New Test Project',
    description: 'New project description',
    type: 'text_annotation',
    status: 'draft',
    createdAt: new Date(),
  }),
}

export const mockAnalyticsService = {
  getDashboardData: vi.fn().mockResolvedValue({
    overview: {
      totalTasks: 10000,
      completedTasks: 7500,
      activeWorkers: 150,
      totalPayments: 75000,
      averageAccuracy: 0.92,
      averageTimePerTask: 180,
    },
    trends: {
      daily: [
        { date: '2024-01-01', tasks: 500, earnings: 5.00, workers: 45 },
        { date: '2024-01-02', tasks: 750, earnings: 7.50, workers: 52 },
        { date: '2024-01-03', tasks: 600, earnings: 6.00, workers: 48 },
      ],
      weekly: [
        { week: '2024-W01', tasks: 3500, earnings: 35.00, workers: 150 },
        { week: '2024-W02', tasks: 4000, earnings: 40.00, workers: 165 },
      ],
      monthly: [
        { month: '2024-01', tasks: 15000, earnings: 150.00, workers: 120 },
        { month: '2024-02', tasks: 18000, earnings: 180.00, workers: 135 },
      ],
    },
  }),
  getWorkerStats: vi.fn().mockResolvedValue({
    workerId: 'user_test_123',
    stats: {
      totalTasks: 1250,
      completedTasks: 1200,
      rejectedTasks: 50,
      averageAccuracy: 0.96,
      averageTimePerTask: 165,
      totalEarnings: 1250.00,
      rating: 4.8,
      level: 'expert',
    },
    history: [
      {
        date: '2024-01-01',
        tasksCompleted: 25,
        earnings: 25.00,
        averageAccuracy: 0.95,
      },
    ],
  }),
  getProjectAnalytics: vi.fn().mockResolvedValue({
    projectId: 'project_1',
    analytics: {
      totalSubmissions: 7500,
      approvedSubmissions: 7000,
      rejectedSubmissions: 500,
      averageAccuracy: 0.93,
      consensusRate: 0.87,
      averageTimePerTask: 175,
      totalCost: 75000.00,
      averageCostPerTask: 10.00,
    },
    workerDistribution: [
      { level: 'beginner', count: 45, accuracy: 0.82 },
      { level: 'intermediate', count: 75, accuracy: 0.91 },
      { level: 'expert', count: 30, accuracy: 0.97 },
    ],
  }),
}

// Utility function to reset all mocks
export function resetAllMocks() {
  mockAuthService.generateToken.mockClear()
  mockAuthService.verifyToken.mockClear()
  mockAuthService.hashPassword.mockClear()
  mockAuthService.comparePassword.mockClear()

  mockPaymentService.createPayment.mockClear()
  mockPaymentService.processPayment.mockClear()
  mockPaymentService.getUserBalance.mockClear()
  mockPaymentService.withdrawFunds.mockClear()

  mockTaskService.getAvailableTasks.mockClear()
  mockTaskService.getTaskById.mockClear()
  mockTaskService.assignTask.mockClear()
  mockTaskService.submitTask.mockClear()

  mockTelegramBotService.sendMessage.mockClear()
  mockTelegramBotService.sendPhoto.mockClear()
  mockTelegramBotService.answerCallbackQuery.mockClear()

  mockTONService.createWallet.mockClear()
  mockTONService.getBalance.mockClear()
  mockTONService.sendTransaction.mockClear()

  mockProjectService.getProjects.mockClear()
  mockProjectService.getProjectById.mockClear()

  mockAnalyticsService.getDashboardData.mockClear()
  mockAnalyticsService.getWorkerStats.mockClear()
}

// Export all services as a single object for easy importing
export const mockServices = {
  auth: mockAuthService,
  payment: mockPaymentService,
  task: mockTaskService,
  telegramBot: mockTelegramBotService,
  ton: mockTONService,
  project: mockProjectService,
  analytics: mockAnalyticsService,
  resetAll: resetAllMocks,
}