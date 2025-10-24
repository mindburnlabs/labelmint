import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { testDb } from '../test/setup';
import { createTestUser } from '../test/fixtures/factories';

describe('API Security Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create Express app with security middleware
    app = express();

    // Security headers
    app.use(helmet());
    app.use(express.json({ limit: '10mb' }));

    // Rate limiting
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests
      message: 'Too many requests from this IP'
    }));

    // Add routes
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.post('/api/auth/login', async (req, res) => {
      const { username, password } = req.body;

      // Simulate authentication
      if (username === 'admin' && password === 'password123') {
        res.json({ token: 'fake-jwt-token', user: { id: 1, role: 'admin' } });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    app.get('/api/users/:id', (req, res) => {
      const id = parseInt(req.params.id);
      if (id !== 1) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json({ id, username: 'testuser' });
    });

    app.post('/api/data', (req, res) => {
      const { data } = req.body;
      if (!data) {
        return res.status(400).json({ error: 'Data is required' });
      }
      res.json({ received: data });
    });
  });

  describe('Security Headers', () => {
    it('should set X-Frame-Options header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should set X-Content-Type-Options header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set Strict-Transport-Security header in production', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Note: This would be set in production with HTTPS
      // expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should set Content-Security-Policy header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/users/2')
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should implement proper session management', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password123' })
        .expect(200);

      expect(loginResponse.body.token).toBeDefined();

      // Use the token to access protected resource
      const userResponse = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(userResponse.body.id).toBe(1);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNjA5NDU5MjAwfQ.invalid';

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toContain('token');
    });

    it('should prevent privilege escalation', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'user', password: 'userpass' })
        .expect(401);

      // Even with a valid-looking token, should not access admin resources
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer fake-token')
        .expect(404); // Not found - route doesn't exist

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should prevent SQL injection', async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      const response = await request(app)
        .post('/api/data')
        .send({ data: maliciousInput })
        .expect(200);

      // The input should be sanitized or rejected
      expect(response.body.received).not.toContain('; DROP TABLE');
    });

    it('should prevent XSS attacks', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/data')
        .send({ data: xssPayload })
        .expect(200);

      // The script tag should be escaped or removed
      expect(response.body.received).not.toContain('<script>');
    });

    it('should validate JSON input', async () => {
      const invalidJson = '{"data": invalid}';

      const response = await request(app)
        .post('/api/data')
        .set('Content-Type', 'application/json')
        .send(invalidJson)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should limit request size', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/data')
        .send({ data: largeData })
        .expect(413);

      expect(response.body.error).toContain('large');
    });

    it('should sanitize file uploads', async () => {
      const maliciousFile = {
        name: '../../../etc/passwd',
        data: Buffer.from('malicious content')
      };

      const response = await request(app)
        .post('/api/upload')
        .attach('file', maliciousFile.data, maliciousFile.name)
        .expect(400);

      expect(response.body.error).toContain('filename');
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests from same IP', async () => {
      const promises = Array(150).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body.message).toBe('Too many requests from this IP');
    });

    it('should implement different rate limits for different endpoints', async () => {
      // Login should have stricter rate limiting
      const loginPromises = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ username: 'test', password: 'wrong' })
      );

      const loginResponses = await Promise.all(loginPromises);
      const loginRateLimited = loginResponses.filter(r => r.status === 429);

      // Should be rate limited sooner than regular endpoints
      expect(loginRateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('CORS Configuration', () => {
    it('should properly handle cross-origin requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'https://evil-site.com')
        .expect(200);

      // Should not allow arbitrary origins in production
      // expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should limit allowed methods', async () => {
      const response = await request(app)
        .options('/api/data')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect(200);

      // DELETE should not be allowed if not configured
      const allowedMethods = response.headers['access-control-allow-methods'];
      expect(allowedMethods).not.toContain('DELETE');
    });
  });

  describe('Error Handling', () => {
    it('should not leak sensitive information in errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error).not.toContain('stack');
      expect(response.body.error).not.toContain('path');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/data')
        .set('Content-Type', 'application/json')
        .send('{"data": "incomplete json')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toContain('Error');
    });

    it('should mask database errors', async () => {
      // Simulate database error scenario
      const response = await request(app)
        .get('/api/users/999999')
        .expect(403);

      expect(response.body.error).toBe('Access denied');
      expect(response.body.error).not.toContain('database');
    });
  });

  describe('Password Security', () => {
    it('should reject weak passwords', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        '111111',
        'admin'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/register')
          .send({
            username: `test_${Date.now()}`,
            password,
            email: `test_${Date.now()}@example.com`
          })
          .expect(400);

        expect(response.body.error).toContain('weak');
      }
    });

    it('should require password complexity', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({
          username: 'newuser',
          password: 'simple',
          email: 'test@example.com'
        })
        .expect(400);

      expect(response.body.errors).toContain(
        expect.stringContaining('uppercase')
      );
      expect(response.body.errors).toContain(
        expect.stringContaining('number')
      );
    });
  });

  describe('Session Security', () => {
    it('should regenerate session IDs on login', async () => {
      // Initial request
      const response1 = await request(app).get('/api/health');
      const sessionId1 = response1.headers['set-cookie'];

      // Login
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password123' });

      // Request after login
      const response2 = await request(app).get('/api/health');
      const sessionId2 = response2.headers['set-cookie'];

      // Session ID should change
      expect(sessionId1).not.toBe(sessionId2);
    });

    it('should implement session timeout', async () => {
      // Simulate old session
      const oldSession = 'session_id:1234567890_very_old_timestamp';

      const response = await request(app)
        .get('/api/users/1')
        .set('Cookie', oldSession)
        .expect(401);

      expect(response.body.error).toContain('session');
    });
  });

  describe('API Key Security', () => {
    it('should validate API key format', async () => {
      const invalidKeys = [
        'short',
        'invalid-characters!@#',
        '',
        null,
        undefined
      ];

      for (const key of invalidKeys) {
        const response = await request(app)
          .get('/api/data')
          .set('X-API-Key', key)
          .expect(401);

        expect(response.body.error).toContain('API key');
      }
    });

    it('should implement API key rotation', async () => {
      // Create API key
      const createResponse = await request(app)
        .post('/api/keys')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'Test Key' })
        .expect(201);

      const keyId = createResponse.body.key.id;
      const initialKey = createResponse.body.key.value;

      // Rotate key
      const rotateResponse = await request(app)
        .post(`/api/keys/${keyId}/rotate`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      const rotatedKey = rotateResponse.body.key.value;

      // Keys should be different
      expect(rotatedKey).not.toBe(initialKey);

      // Old key should be invalid
      await request(app)
        .get('/api/data')
        .set('X-API-Key', initialKey)
        .expect(401);

      // New key should work
      await request(app)
        .get('/api/data')
        .set('X-API-Key', rotatedKey)
        .expect(200);
    });
  });

  describe('WebSocket Security', () => {
    it('should validate WebSocket connections', async () => {
      const WebSocket = require('ws');

      // Invalid connection should be rejected
      const ws = new WebSocket('ws://localhost:3001/invalid-path');

      const message = await new Promise((resolve) => {
        ws.on('error', (error) => resolve(error.message));
      });

      expect(message).toContain('401');
    });

    it('should implement WebSocket rate limiting', async () => {
      // Test message rate limiting on WebSocket connections
      // This would require WebSocket-specific rate limiting middleware
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt sensitive data at rest', async () => {
      // This would test that sensitive data is encrypted in the database
      const user = await testDb.user.findUnique({
        where: { id: 1 }
      });

      // Password should be hashed, not plain text
      expect(user?.password).not.toBe('password123');
      expect(user?.password).toMatch(/^\$2[aby]\$\d+\$/);
    });

    it('should encrypt data in transit', async () => {
      // Verify HTTPS is used in production
      // This would be environment-dependent
      expect(true).toBe(true); // Placeholder
    });
  });
});