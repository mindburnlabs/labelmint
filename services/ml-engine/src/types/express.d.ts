/**
 * Express Type Extensions
 * Custom type definitions for Express.js
 */

import { Request } from 'express';
import { User } from '@/types/ml.types';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};