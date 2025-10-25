
import { z } from 'zod';

// Common validation schemas
export const schemas = {
  // User input validation
  userRegistration: z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/)
  }),

  // Project validation
  projectCreate: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    budget: z.number().min(0).max(1000000)
  }),

  // Payment validation
  paymentRequest: z.object({
    amount: z.number().min(0.01).max(10000),
    recipient: z.string().length(64), // TON address
    description: z.string().max(255)
  }),

  // API query validation
  apiQuery: z.object({
    limit: z.number().min(1).max(100).default(10),
    offset: z.number().min(0).default(0),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  })
};

// Validation middleware factory
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
  };
}

// Input sanitization
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/javascript:/gi, '') // Remove JavaScript protocol
    .replace(/data:.*base64/gi, '') // Remove base64 data
    .trim();
}
