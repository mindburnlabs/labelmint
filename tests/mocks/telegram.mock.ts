import { rest } from 'msw';

// Telegram Bot API mocks
export const telegramMocks = [
  // Mock getMe endpoint
  rest.get('https://api.telegram.org/bot:token/getMe', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          id: 123456789,
          is_bot: true,
          first_name: 'LabelMint',
          username: 'labelmint_bot',
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: false
        }
      })
    );
  }),

  // Mock sendMessage endpoint
  rest.post('https://api.telegram.org/bot:token/sendMessage', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 10000),
          from: {
            id: 123456789,
            is_bot: true,
            first_name: 'LabelMint',
            username: 'labelmint_bot'
          },
          chat: {
            id: req.body.chat_id,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000),
          text: req.body.text
        }
      })
    );
  }),

  // Mock sendPhoto endpoint
  rest.post('https://api.telegram.org/bot:token/sendPhoto', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 10000),
          from: {
            id: 123456789,
            is_bot: true,
            first_name: 'LabelMint',
            username: 'labelmint_bot'
          },
          chat: {
            id: req.body.chat_id,
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000),
          photo: [
            {
              file_id: 'AgADBAADFbk0Gz8cVQ_ABKJ8s9a',
              file_size: 12345,
              width: 800,
              height: 600
            }
          ]
        }
      })
    );
  }),

  // Mock sendDocument endpoint
  rest.post('https://api.telegram.org/bot:token/sendDocument', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 10000),
          from: {
            id: 123456789,
            is_bot: true,
            first_name: 'LabelMint',
            username: 'labelmint_bot'
          },
          chat: {
            id: req.body.chat_id,
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000),
          document: {
            file_id: 'BQADBAADFbk0Gz8cVQ_ABKJ8s9a',
            file_size: 12345,
            file_name: 'document.pdf',
            mime_type: 'application/pdf'
          }
        }
      })
    );
  }),

  // Mock answerCallbackQuery endpoint
  rest.post('https://api.telegram.org/bot:token/answerCallbackQuery', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: true
      })
    );
  }),

  // Mock editMessageText endpoint
  rest.post('https://api.telegram.org/bot:token/editMessageText', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          message_id: req.body.message_id || Math.floor(Math.random() * 10000),
          from: {
            id: 123456789,
            is_bot: true,
            first_name: 'LabelMint',
            username: 'labelmint_bot'
          },
          chat: {
            id: req.body.chat_id,
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000),
          text: req.body.text,
          reply_markup: req.body.reply_markup
        }
      })
    );
  }),

  // Mock getUserProfilePhotos endpoint
  rest.get('https://api.telegram.org/bot:token/getUserProfilePhotos', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          total_count: 1,
          photos: [
            [
              {
                file_id: 'AgADBAADFbk0Gz8cVQ_ABKJ8s9b',
                file_size: 8902,
                width: 160,
                height: 160
              }
            ]
          ]
        }
      })
    );
  }),

  // Mock chat member info
  rest.get('https://api.telegram.org/bot:token/getChatMember', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          user: {
            id: req.url.split('user_id=')[1] || 123456789,
            is_bot: false,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
          },
          status: 'member'
        }
      })
    );
  }),

  // Mock getChat endpoint
  rest.get('https://api.telegram.org/bot:token/getChat', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          id: req.url.split('chat_id=')[1] || 123456789,
          type: 'private',
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser'
        }
      })
    );
  })
];

// Telegram Mini App specific mocks
export const miniAppMocks = [
  // Mock initData validation
  rest.post('https://api.telegram.org/bot:token/checkWebapp', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          user: {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'en'
          },
          query_id: 'TEST_QUERY_ID',
          auth_date: Date.now()
        }
      })
    );
  }),

  // Mock Cloudflare Turnstile verification
  rest.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        'error-codes': [],
        challenge_ts: new Date().toISOString(),
        hostname: 'labelmint.mindburn.org'
      })
    );
  })
];

// Mock Telegram updates
export const createMockUpdate = (type: 'message' | 'callback_query' = 'message', overrides: any = {}) => {
  const base = {
    update_id: Math.floor(Math.random() * 1000000)
  };

  switch (type) {
    case 'message':
      return {
        ...base,
        message: {
          message_id: Math.floor(Math.random() * 10000),
          from: {
            id: Math.floor(Math.random() * 1000000),
            is_bot: false,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
          },
          chat: {
            id: Math.floor(Math.random() * 1000000),
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            type: 'private'
          },
          date: Math.floor(Date.now() / 1000),
          text: 'Test message',
          ...overrides
        }
      };

    case 'callback_query':
      return {
        ...base,
        callback_query: {
          id: Math.floor(Math.random() * 1000000),
          from: {
            id: Math.floor(Math.random() * 1000000),
            is_bot: false,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
          },
          message: {
            message_id: Math.floor(Math.random() * 10000),
            from: {
              id: 123456789,
              is_bot: true,
              first_name: 'LabelMint',
              username: 'labelmint_bot'
            },
            chat: {
              id: Math.floor(Math.random() * 1000000),
              type: 'private'
            },
            date: Math.floor(Date.now() / 1000),
            text: 'Previous message'
          },
          data: 'test_callback',
          ...overrides
        }
      };

    default:
      return base;
  }
};

// Mock inline keyboard
export const createMockInlineKeyboard = (buttons: Array<{ text: string; callback_data: string }>[]) => {
  return {
    inline_keyboard: buttons.map(button => ([{
      text: button.text,
      callback_data: button.callback_data
    }]))
  };
};

// Mock reply keyboard
export const createMockReplyKeyboard = (buttons: Array<string>, options: any = {}) => {
  return {
    keyboard: buttons.map(button => ([{ text: button }])),
    resize_keyboard: true,
    one_time_keyboard: false,
    selective: false,
    ...options
  };
};