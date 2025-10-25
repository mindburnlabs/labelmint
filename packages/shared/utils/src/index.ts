/**
 * LabelMint Shared Utilities
 * Consolidated utility functions for use across all LabelMint applications
 */

// Core UI utilities
export * from './ui/cn';

// Formatting utilities
export * from './format/currency';
export * from './format/date';
export * from './format/number';
export * from './format/relative-time';
export * from './format/bytes';

// Async utilities
export * from './async/debounce';
export * from './async/throttle';

// DOM utilities
export * from './dom/viewport';
export * from './dom/scroll';
export * from './dom/clipboard';
export * from './dom/download';
export * from './dom/cookies';

// Device utilities
export * from './device/detection';
export * from './device/viewport';

// String utilities
export * from './string/truncate';
export * from './string/generate-id';

// Math utilities
export * from './math/percentage';

// Logger utilities
export * from './logger';

// Re-export status colors for backward compatibility
export const statusColors = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  pending: '#6b7280',
  processing: '#8b5cf6',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#6b7280'
};