// ============================================================================
// SHARED PACKAGE MAIN EXPORTS
// ============================================================================

// Simple working exports
export const VERSION = '1.0.0';

// Basic type definitions
export interface ApiError {
  code: string;
  message: string;
  timestamp: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Basic utility functions
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Basic error class
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function createError(message: string, code?: string): AppError {
  return new AppError(message, code);
}