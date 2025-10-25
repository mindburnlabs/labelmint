export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel
const thresholdIndex = LEVELS.includes(configuredLevel)
  ? LEVELS.indexOf(configuredLevel)
  : LEVELS.indexOf('info')

const shouldLog = (level: LogLevel) => LEVELS.indexOf(level) >= thresholdIndex

const normalizePayload = (message: any, meta?: Record<string, unknown>) => {
  if (meta && Object.keys(meta).length > 0) {
    if (typeof message === 'string') {
      return { message, ...meta }
    }
    return { ...meta, ...message }
  }

  return message
}

const write = (level: LogLevel, message: any, meta?: Record<string, unknown>) => {
  if (!shouldLog(level)) return

  const payload = normalizePayload(message, meta)
  const timestamp = new Date().toISOString()
  const entry =
    typeof payload === 'object' && payload !== null
      ? { level, timestamp, ...payload }
      : { level, timestamp, message: payload }

  const serialized = JSON.stringify(entry)

  switch (level) {
    case 'debug':
      console.debug(serialized)
      break
    case 'info':
      console.info(serialized)
      break
    case 'warn':
      console.warn(serialized)
      break
    case 'error':
    default:
      console.error(serialized)
      break
  }
}

export const logger = {
  debug(message: any, meta?: Record<string, unknown>) {
    write('debug', message, meta)
  },
  info(message: any, meta?: Record<string, unknown>) {
    write('info', message, meta)
  },
  warn(message: any, meta?: Record<string, unknown>) {
    write('warn', message, meta)
  },
  error(message: any, meta?: Record<string, unknown>) {
    write('error', message, meta)
  },
  child(childMeta: Record<string, unknown>) {
    return {
      debug(message: any, meta?: Record<string, unknown>) {
        write('debug', message, { ...childMeta, ...meta })
      },
      info(message: any, meta?: Record<string, unknown>) {
        write('info', message, { ...childMeta, ...meta })
      },
      warn(message: any, meta?: Record<string, unknown>) {
        write('warn', message, { ...childMeta, ...meta })
      },
      error(message: any, meta?: Record<string, unknown>) {
        write('error', message, { ...childMeta, ...meta })
      }
    }
  }
}

export default logger
