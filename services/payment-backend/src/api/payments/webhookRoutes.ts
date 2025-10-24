import { Router } from 'express';
import { handleStripeWebhook } from './webhookController';
import { rateLimit } from 'express-rate-limit';
import { requestLogger } from '../../middleware/logging';

const router = Router();

// Configure strict rate limiting for webhook endpoints
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    error: 'Too many webhook requests',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply logging and rate limiting
router.use(requestLogger);
router.use(webhookRateLimit);

/**
 * POST /api/payments/webhooks/stripe
 * Stripe webhook endpoint with signature verification
 */
router.post('/stripe', handleStripeWebhook);

export default router;