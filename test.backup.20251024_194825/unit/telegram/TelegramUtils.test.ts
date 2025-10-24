import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Telegram Bot API types
interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

interface TelegramMessage {
  message_id: number
  from: TelegramUser
  chat: { id: number; type: 'private' | 'group' | 'supergroup' }
  text?: string
  photo?: string[]
  document?: { file_id: string; file_name: string }
  caption?: string
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data: string
}

describe('Telegram Utils', () => {
  describe('User Validation', () => {
    describe('validateTelegramUser', () => {
      it('should validate Telegram user data', () => {
        const validateTelegramUser = (user: Partial<TelegramUser>): boolean => {
          return !!(
            user &&
            typeof user.id === 'number' &&
            user.id > 0 &&
            typeof user.first_name === 'string' &&
            user.first_name.length > 0
          )
        }

        // Valid users
        expect(validateTelegramUser({
          id: 12345,
          first_name: 'John',
          username: 'john_doe'
        })).toBe(true)

        expect(validateTelegramUser({
          id: 67890,
          first_name: 'Alice',
          last_name: 'Smith',
          language_code: 'en'
        })).toBe(true)

        // Invalid users
        expect(validateTelegramUser({})).toBe(false)
        expect(validateTelegramUser({ id: -1, first_name: 'Test' })).toBe(false)
        expect(validateTelegramUser({ id: 12345 })).toBe(false)
        expect(validateTelegramUser({ first_name: 'Test' })).toBe(false)
      })
    })

    describe('generateUserHash', () => {
      it('should generate unique user hashes', () => {
        const generateUserHash = (userId: number, botToken: string): string => {
          const data = `${userId}:${botToken}`
          let hash = 0
          for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // Convert to 32-bit integer
          }
          return Math.abs(hash).toString(16)
        }

        const hash1 = generateUserHash(12345, 'bot_token_1')
        const hash2 = generateUserHash(67890, 'bot_token_1')
        const hash3 = generateUserHash(12345, 'bot_token_2')

        expect(hash1).not.toBe(hash2)
        expect(hash1).not.toBe(hash3)
        expect(generateUserHash(12345, 'bot_token_1')).toBe(hash1) // Deterministic
      })
    })

    describe('formatUserName', () => {
      it('should format user names correctly', () => {
        const formatUserName = (user: TelegramUser): string => {
          if (user.username) {
            return `@${user.username}`
          }
          if (user.last_name) {
            return `${user.first_name} ${user.last_name}`
          }
          return user.first_name
        }

        expect(formatUserName({
          id: 123,
          first_name: 'John',
          username: 'john_doe'
        })).toBe('@john_doe')

        expect(formatUserName({
          id: 123,
          first_name: 'John',
          last_name: 'Smith'
        })).toBe('John Smith')

        expect(formatUserName({
          id: 123,
          first_name: 'Alice'
        })).toBe('Alice')
      })
    })
  })

  describe('Message Parsing', () => {
    describe('parseCommand', () => {
      it('should parse Telegram commands', () => {
        const parseCommand = (text: string): { command: string; args: string[] } | null => {
          const match = text.match(/^\/([a-zA-Z0-9_]+)(?:\s+(.+))?$/)
          if (!match) return null

          const command = match[1]
          const argsString = match[2] || ''
          const args = argsString.split(/\s+/).filter(Boolean)

          return { command, args }
        }

        expect(parseCommand('/start')).toEqual({ command: 'start', args: [] })
        expect(parseCommand('/task image')).toEqual({ command: 'task', args: ['image'] })
        expect(parseCommand('/submit cat dog bird')).toEqual({ command: 'submit', args: ['cat', 'dog', 'bird'] })
        expect(parseCommand('Hello world')).toBeNull()
        expect(parseCommand('')).toBeNull()
      })
    })

    describe('extractTaskId', () => {
      it('should extract task IDs from messages', () => {
        const extractTaskId = (text: string): string | null => {
          const patterns = [
            /#task(\d+)/,
            /task[:\s]+(\d+)/i,
            /ID:\s*(\d+)/i,
            /^(\d{6,})$/
          ]

          for (const pattern of patterns) {
            const match = text.match(pattern)
            if (match) return match[1]
          }

          return null
        }

        expect(extractTaskId('#task123456')).toBe('123456')
        expect(extractTaskId('Task: 789012')).toBe('789012')
        expect(extractTaskId('ID: 345678')).toBe('345678')
        expect(extractTaskId('1234567')).toBe('1234567')
        expect(extractTaskId('No task here')).toBeNull()
      })
    })

    describe('parseCallbackData', () => {
      it('should parse callback query data', () => {
        const parseCallbackData = (data: string): Record<string, string> | null => {
          try {
            const parts = data.split(':')
            if (parts.length < 2) return null

            const result: Record<string, string> = { action: parts[0] }

            for (let i = 1; i < parts.length; i++) {
              const [key, value] = parts[i].split('=')
              if (key && value) {
                result[key] = value
              }
            }

            return result
          } catch {
            return null
          }
        }

        expect(parseCallbackData('label:task=123:answer=cat')).toEqual({
          action: 'label',
          task: '123',
          answer: 'cat'
        })

        expect(parseCallbackData('skip:task=456')).toEqual({
          action: 'skip',
          task: '456'
        })

        expect(parseCallbackData('invalid')).toBeNull()
      })
    })
  })

  describe('Keyboard Layouts', () => {
    describe('createTaskKeyboard', () => {
      it('should create inline keyboards for tasks', () => {
        const createTaskKeyboard = (options: string[], columns: number = 2) => {
          const keyboard: Array<Array<{ text: string; callback_data: string }>> = []

          for (let i = 0; i < options.length; i += columns) {
            const row = options.slice(i, i + columns).map(option => ({
              text: option,
              callback_data: `answer:${option}`
            }))
            keyboard.push(row)
          }

          return { inline_keyboard: keyboard }
        }

        const keyboard = createTaskKeyboard(['Cat', 'Dog', 'Bird', 'Fish'], 2)

        expect(keyboard.inline_keyboard).toHaveLength(2)
        expect(keyboard.inline_keyboard[0]).toEqual([
          { text: 'Cat', callback_data: 'answer:Cat' },
          { text: 'Dog', callback_data: 'answer:Dog' }
        ])
        expect(keyboard.inline_keyboard[1]).toEqual([
          { text: 'Bird', callback_data: 'answer:Bird' },
          { text: 'Fish', callback_data: 'answer:Fish' }
        ])
      })
    })

    describe('createNavigationKeyboard', () => {
      it('should create navigation keyboards', () => {
        const createNavigationKeyboard = (currentPage: number, totalPages: number) => {
          const keyboard = []

          if (currentPage > 1) {
            keyboard.push({ text: '⬅️ Previous', callback_data: `page:${currentPage - 1}` })
          }

          keyboard.push({ text: `${currentPage}/${totalPages}`, callback_data: 'current' })

          if (currentPage < totalPages) {
            keyboard.push({ text: 'Next ➡️', callback_data: `page:${currentPage + 1}` })
          }

          return { inline_keyboard: [keyboard] }
        }

        const nav1 = createNavigationKeyboard(1, 5)
        expect(nav1.inline_keyboard[0]).toEqual([
          { text: '1/5', callback_data: 'current' },
          { text: 'Next ➡️', callback_data: 'page:2' }
        ])

        const nav3 = createNavigationKeyboard(3, 5)
        expect(nav3.inline_keyboard[0]).toEqual([
          { text: '⬅️ Previous', callback_data: 'page:2' },
          { text: '3/5', callback_data: 'current' },
          { text: 'Next ➡️', callback_data: 'page:4' }
        ])
      })
    })
  })

  describe('Media Handling', () => {
    describe('getFileUrl', () => {
      it('should construct file URLs from Telegram file info', () => {
        const getFileUrl = (fileId: string, botToken: string): string => {
          return `https://api.telegram.org/file/bot${botToken}/${fileId}`
        }

        expect(getFileUrl('ABC123', 'bot_token_xyz'))
          .toBe('https://api.telegram.org/file/botbot_token_xyz/ABC123')
      })
    })

    describe('detectFileType', () => {
      it('should detect file types from file names', () => {
        const detectFileType = (fileName: string): 'image' | 'video' | 'document' | 'audio' => {
          const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
          const videoExts = ['.mp4', '.avi', '.mov', '.mkv']
          const audioExts = ['.mp3', '.wav', '.ogg', '.m4a']

          const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))

          if (imageExts.includes(ext)) return 'image'
          if (videoExts.includes(ext)) return 'video'
          if (audioExts.includes(ext)) return 'audio'
          return 'document'
        }

        expect(detectFileType('image.jpg')).toBe('image')
        expect(detectFileType('video.mp4')).toBe('video')
        expect(detectFileType('audio.mp3')).toBe('audio')
        expect(detectFileType('document.pdf')).toBe('document')
        expect(detectFileType('IMAGE.PNG')).toBe('image') // Case insensitive
      })
    })

    describe('formatFileSize', () => {
      it('should format file sizes in human readable format', () => {
        const formatFileSize = (bytes: number): string => {
          const units = ['B', 'KB', 'MB', 'GB']
          let size = bytes
          let unitIndex = 0

          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
          }

          return `${size.toFixed(1)} ${units[unitIndex]}`
        }

        expect(formatFileSize(500)).toBe('500.0 B')
        expect(formatFileSize(1024)).toBe('1.0 KB')
        expect(formatFileSize(1536)).toBe('1.5 KB')
        expect(formatFileSize(1048576)).toBe('1.0 MB')
        expect(formatFileSize(1073741824)).toBe('1.0 GB')
      })
    })
  })

  describe('Rate Limiting', () => {
    describe('checkRateLimit', () => {
      it('should enforce rate limits per user', () => {
        const userRequests = new Map<number, number[]>()

        const checkRateLimit = (
          userId: number,
          maxRequests: number = 5,
          windowMs: number = 60000 // 1 minute
        ): boolean => {
          const now = Date.now()
          const requests = userRequests.get(userId) || []

          // Remove old requests outside window
          const validRequests = requests.filter(timestamp =>
            now - timestamp < windowMs
          )

          if (validRequests.length >= maxRequests) {
            return false
          }

          validRequests.push(now)
          userRequests.set(userId, validRequests)
          return true
        }

        const userId = 12345

        // First 5 requests should pass
        for (let i = 0; i < 5; i++) {
          expect(checkRateLimit(userId)).toBe(true)
        }

        // 6th request should fail
        expect(checkRateLimit(userId)).toBe(false)

        // Different user should still pass
        expect(checkRateLimit(67890)).toBe(true)
      })
    })

    describe('getUserCooldown', () => {
      it('should calculate cooldown times for users', () => {
        const getUserCooldown = (
          lastAction: number,
          baseCooldown: number = 1000, // 1 second
          userLevel: number = 1
        ): number => {
          const cooldownMultiplier = Math.max(0.5, 1 - (userLevel - 1) * 0.1)
          const adjustedCooldown = baseCooldown * cooldownMultiplier
          const timeSinceLastAction = 1000 - lastAction // Fixed current time for deterministic test

          return Math.max(0, adjustedCooldown - timeSinceLastAction)
        }

        const now = 1000 // Fixed timestamp for deterministic tests

        expect(getUserCooldown(now - 500, 1000, 1)).toBe(500)
        expect(getUserCooldown(now - 500, 1000, 5)).toBe(100) // Higher level = less cooldown
        expect(getUserCooldown(now - 2000, 1000, 1)).toBe(0) // No cooldown needed
      })
    })
  })

  describe('Localization', () => {
    describe('getLocalizedMessage', () => {
      it('should return messages in user language', () => {
        const messages = {
          en: {
            welcome: 'Welcome to LabelMint!',
            task_completed: 'Task completed successfully',
            error: 'An error occurred'
          },
          es: {
            welcome: '¡Bienvenido a LabelMint!',
            task_completed: 'Tarea completada con éxito',
            error: 'Ocurrió un error'
          },
          ru: {
            welcome: 'Добро пожаловать в LabelMint!',
            task_completed: 'Задание успешно выполнено',
            error: 'Произошла ошибка'
          }
        }

        const getMessage = (key: string, language: string = 'en'): string => {
          return messages[language]?.[key] || messages.en[key] || key
        }

        expect(getMessage('welcome', 'en')).toBe('Welcome to LabelMint!')
        expect(getMessage('welcome', 'es')).toBe('¡Bienvenido a LabelMint!')
        expect(getMessage('welcome', 'ru')).toBe('Добро пожаловать в LabelMint!')
        expect(getMessage('unknown', 'en')).toBe('unknown') // Fallback
        expect(getMessage('welcome', 'fr')).toBe('Welcome to LabelMint!') // Default to English
      })
    })

    describe('formatNumber', () => {
      it('should format numbers according to locale', () => {
        const formatNumber = (
          num: number,
          locale: string = 'en-US'
        ): string => {
          try {
            return new Intl.NumberFormat(locale).format(num)
          } catch {
            return num.toString()
          }
        }

        expect(formatNumber(1234.56, 'en-US')).toBe('1,234.56')
        expect(formatNumber(1234.56, 'de-DE')).toBe('1.234,56')
        expect(formatNumber(1234, 'en-US')).toBe('1,234')
      })
    })
  })

  describe('Error Handling', () => {
    describe('handleTelegramError', () => {
      it('should categorize and handle Telegram API errors', () => {
        const handleTelegramError = (error: any): { retryable: boolean; message: string } => {
          if (error.code === 429) {
            return { retryable: true, message: 'Rate limited, retry later' }
          }
          if (error.code === 403) {
            return { retryable: false, message: 'Bot was blocked by user' }
          }
          if (error.code >= 500) {
            return { retryable: true, message: 'Telegram server error' }
          }
          if (error.code === 400) {
            return { retryable: false, message: 'Bad request' }
          }
          return { retryable: true, message: 'Unknown error' }
        }

        expect(handleTelegramError({ code: 429 })).toEqual({
          retryable: true,
          message: 'Rate limited, retry later'
        })

        expect(handleTelegramError({ code: 403 })).toEqual({
          retryable: false,
          message: 'Bot was blocked by user'
        })

        expect(handleTelegramError({ code: 502 })).toEqual({
          retryable: true,
          message: 'Telegram server error'
        })
      })
    })
  })
})