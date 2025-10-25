// Re-export logger from shared utils package
export {
  Logger,
  LogLevel,
  PerformanceLogger,
  logger,
  createLogger,
  createRequestLogger,
  measurePerformance
} from '../../../../packages/shared/utils/logger';

export type { LogEntry } from '../../../../packages/shared/utils/logger';