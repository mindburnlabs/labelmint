import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  verifyTwoFactor,
  refreshToken,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  logout,
  getSessions,
  revokeSession,
  trustDevice,
  changePassword,
  requestPasswordReset,
  resetPassword,
  getSecurityEvents,
  getCSRFToken
} from './authController';
import { rateLimit } from '../../middleware/enhancedAuth';

const router = Router();

// Public routes (no authentication required)
router.post('/register', rateLimit(5, 600000, 'ip'), register); // 5 attempts per 10 minutes
router.post('/login', rateLimit(5, 900000, 'ip'), login); // 5 attempts per 15 minutes
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', rateLimit(3, 3600000, 'ip'), requestPasswordReset); // 3 attempts per hour
router.post('/reset-password', resetPassword);
router.post('/refresh-token', rateLimit(10, 60000, 'ip'), refreshToken); // 10 attempts per minute
router.post('/2fa/verify', rateLimit(5, 300000, 'ip'), verifyTwoFactor); // 5 attempts per 5 minutes

// Protected routes (authentication required)
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', revokeSession);
router.post('/trust-device', trustDevice);
router.post('/change-password', rateLimit(3, 900000, 'user'), changePassword); // 3 attempts per 15 minutes
router.post('/2fa/setup', setupTwoFactor);
router.post('/2fa/enable', enableTwoFactor);
router.post('/2fa/disable', disableTwoFactor);
router.post('/logout', logout);
router.get('/security-events', rateLimit(10, 60000, 'user'), getSecurityEvents);
router.get('/csrf-token', getCSRFToken);

export default router;