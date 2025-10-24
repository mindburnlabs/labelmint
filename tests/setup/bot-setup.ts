import { setup } from './unit-setup'

// Telegram Bot-specific test setup
export function setupBot() {
  const { cleanup: unitCleanup } = setup()

  // Setup bot-specific environment variables
  process.env.BOT_TOKEN = 'test-bot-token'
  process.env.BACKEND_URL = 'http://localhost:3001'
  process.env.PAYMENT_SERVICE_URL = 'http://localhost:3002'
  process.env.NODE_ENV = 'test'

  // Mock Telegram Bot API
  const mockTelegramApi = {
    getMe: vi.fn().mockResolvedValue({
      id: 123456789,
      is_bot: true,
      first_name: 'LabelMint Bot',
      username: 'labelmint_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    }),
    sendMessage: vi.fn().mockResolvedValue({
      message_id: 12345,
      from: {
        id: 123456789,
        is_bot: true,
        first_name: 'LabelMint Bot',
        username: 'labelmint_bot',
      },
      chat: {
        id: 987654321,
        first_name: 'Test User',
        username: 'testuser',
        type: 'private',
      },
      date: Date.now(),
      text: 'Test message',
    }),
    sendPhoto: vi.fn().mockResolvedValue({
      message_id: 12346,
      photo: [
        {
          file_id: 'photo_file_id_123',
          file_unique_id: 'photo_unique_123',
          file_size: 1024,
          width: 800,
          height: 600,
        },
      ],
    }),
    sendChatAction: vi.fn().mockResolvedValue(true),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    editMessageText: vi.fn().mockResolvedValue({
      message_id: 12345,
      text: 'Edited message',
      date: Date.now(),
    }),
    editMessageReplyMarkup: vi.fn().mockResolvedValue({
      message_id: 12345,
      date: Date.now(),
    }),
  }

  // Extend test utilities with bot-specific helpers
  global.testUtils = {
    ...global.testUtils,

    // Bot-specific helpers
    createMockUpdate: (overrides: any = {}) => ({
      update_id: 123456789,
      message: {
        message_id: 12345,
        from: {
          id: 987654321,
          is_bot: false,
          first_name: 'Test User',
          last_name: 'User',
          username: 'testuser',
          language_code: 'en',
        },
        chat: {
          id: 987654321,
          first_name: 'Test User',
          last_name: 'User',
          username: 'testuser',
          type: 'private',
        },
        date: Date.now(),
        text: '/start',
      },
      ...overrides,
    }),

    createMockCallbackQuery: (overrides: any = {}) => ({
      id: 'callback_query_123',
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'Test User',
        username: 'testuser',
        language_code: 'en',
      },
      message: {
        message_id: 12345,
        from: {
          id: 123456789,
          is_bot: true,
          first_name: 'LabelMint Bot',
          username: 'labelmint_bot',
        },
        date: Date.now(),
        chat: {
          id: 987654321,
          first_name: 'Test User',
          username: 'testuser',
          type: 'private',
        },
        text: 'Select an option:',
      },
      chat_instance: '-123456789',
      data: 'button_clicked',
      ...overrides,
    }),

    createMockInlineQuery: (overrides: any = {}) => ({
      id: 'inline_query_123',
      from: {
        id: 987654321,
        is_bot: false,
        first_name: 'Test User',
        username: 'testuser',
        language_code: 'en',
      },
      query: 'test query',
      offset: '',
      ...overrides,
    }),

    createMockUser: (overrides: any = {}) => ({
      id: 987654321,
      is_bot: false,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
      is_premium: false,
      ...overrides,
    }),

    createMockChat: (overrides: any = {}) => ({
      id: 987654321,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      type: 'private',
      ...overrides,
    }),

    // Bot command helpers
    createMockBotCommand: (command: string, description: string) => ({
      command,
      description,
    }),

    // Message helpers
    createMockTextMessage: (text: string, overrides: any = {}) => ({
      message_id: Math.floor(Math.random() * 100000),
      from: global.testUtils.createMockUser(),
      chat: global.testUtils.createMockChat(),
      date: Math.floor(Date.now() / 1000),
      text,
      ...overrides,
    }),

    createMockPhotoMessage: (caption: string = '', overrides: any = {}) => ({
      message_id: Math.floor(Math.random() * 100000),
      from: global.testUtils.createMockUser(),
      chat: global.testUtils.createMockChat(),
      date: Math.floor(Date.now() / 1000),
      photo: [
        {
          file_id: 'photo_file_id_' + Math.random().toString(36),
          file_unique_id: 'photo_unique_' + Math.random().toString(36),
          file_size: 1024,
          width: 800,
          height: 600,
        },
      ],
      caption,
      ...overrides,
    }),

    // Keyboard helpers
    createMockInlineKeyboard: (buttons: Array<{text: string; callback_data: string}[]>) => ({
      inline_keyboard: buttons,
    }),

    createMockReplyKeyboard: (buttons: string[][]) => ({
      keyboard: buttons.map(row => row.map(text => ({ text }))),
      resize_keyboard: true,
      one_time_keyboard: false,
    }),

    // Task-related helpers
    createMockTaskForBot: (overrides: any = {}) => ({
      id: 'task_bot_123',
      type: 'image_classification',
      imageUrl: 'https://example.com/image.jpg',
      instructions: 'Classify the image',
      labels: ['cat', 'dog', 'bird'],
      paymentPerLabel: 0.01,
      timeLimit: 300, // 5 minutes
      ...overrides,
    }),
  }

  // Mock telegraf or your preferred bot framework
  global.bot = {
    start: vi.fn(),
    stop: vi.fn(),
    hear: vi.fn(),
    command: vi.fn(),
    action: vi.fn(),
    on: vi.fn(),
    use: vi.fn(),
    launch: vi.fn(),
  }

  // Setup global telegram API mock
  global.telegramApi = mockTelegramApi

  return {
    cleanup: () => {
      unitCleanup()
      vi.clearAllMocks()
    },
  }
}

// Auto-setup for bot tests
const { cleanup } = setupBot()

export { cleanup }