export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error']
const environmentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel
const thresholdIndex = LEVEL_ORDER.indexOf(environmentLevel) >= 0
  ? LEVEL_ORDER.indexOf(environmentLevel)
  : LEVEL_ORDER.indexOf('info')

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER.indexOf(level) >= thresholdIndex
}

function serializePayload(message: any, meta?: Record<string, any>) {
  if (meta && Object.keys(meta).length > 0) {
    if (typeof message === 'string') {
      return { message, ...meta }
    }
    return { ...message, ...meta }
  }

  return message
}

function write(level: LogLevel, message: any, meta?: Record<string, any>) {
  if (!shouldLog(level)) return

  const payload = serializePayload(message, meta)
  const timestamp = new Date().toISOString()
  const entry = {
    level,
    timestamp,
    ...(
      typeof payload === 'object' && payload !== null
        ? payload
        : { message: payload }
    )
  }

  const output = JSON.stringify(entry)

  switch (level) {
    case 'debug':
      console.debug(output)
      break
    case 'info':
      console.info(output)
      break
    case 'warn':
      console.warn(output)
      break
    case 'error':
    default:
      console.error(output)
      break
  }
}

export const logger = {
  debug(message: any, meta?: Record<string, any>) {
    write('debug', message, meta)
  },
  info(message: any, meta?: Record<string, any>) {
    write('info', message, meta)
  },
  warn(message: any, meta?: Record<string, any>) {
    write('warn', message, meta)
  },
  error(message: any, meta?: Record<string, any>) {
    write('error', message, meta)
  },
  child(childMeta: Record<string, any>) {
    return {
      debug(message: any, meta?: Record<string, any>) {
        write('debug', message, { ...childMeta, ...meta })
      },
      info(message: any, meta?: Record<string, any>) {
        write('info', message, { ...childMeta, ...meta })
      },
      warn(message: any, meta?: Record<string, any>) {
        write('warn', message, { ...childMeta, ...meta })
      },
      error(message: any, meta?: Record<string, any>) {
        write('error', message, { ...childMeta, ...meta })
      }
    }
  }
}

export default logger
