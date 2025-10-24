import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const correlationId = (req: Request, res: Response, next: NextFunction): void => {
  // Check if correlation ID exists in headers
  let cid = req.get('X-Correlation-ID') || req.get('x-correlation-id');

  // Generate new correlation ID if not exists
  if (!cid) {
    cid = uuidv4();
  }

  // Add to request object
  (req as any).correlationId = cid;

  // Add to response headers
  res.setHeader('X-Correlation-ID', cid);

  next();
};