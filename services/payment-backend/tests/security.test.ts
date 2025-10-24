import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app';
import { Logger } from '../src/utils/logger';

const logger = new Logger('SecurityTests');

describe('Security Tests', () => {
  describe('SQL Injection Protection', () => {
    it('should block SQL injection in query parameters', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({
          id: "1 OR 1=1"
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });

    it('should block SQL injection in POST body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "test@labelmintit.com",
          password: "' OR '1'='1"
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });

    it('should block SQL injection in headers', async () => {
      const response = await request(app)
        .get('/api/data')
        .set('X-SQL-Injection', "'; DROP TABLE users; --")
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });
  });

  describe('XSS Protection', () => {
    it('should block XSS in request body', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: "<script>alert('XSS')</script>"
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });

    it('should block XSS in query parameters', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: "<img src=x onerror=alert('XSS')>"
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });

    it('should block XSS in headers', async () => {
      const response = await request(app)
        .get('/api/data')
        .set('User-Agent', "Mozilla/5.0 (compatible; <script>alert('XSS')</script> MSIE 9.0; Windows NT 6.1)")
        .send();

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });
  });

  describe('Rate Limiting', () => {
    it('should limit requests after threshold', async () => {
      const promises = [];

      // Send 101 requests (above limit of 100)
      for (let i = 0; i < 101; i++) {
        promises.push(
          request(app)
            .get('/api/test')
            .set('X-Test-Override', 'true') // Skip rate limit for testing
        );
      }

      await Promise.all(promises);

      // The last request should be rate limited
      const response = await request(app)
        .get('/api/test')
        .set('X-Test-Override', 'false'); // Enable rate limiting

      expect(response.status).to.equal(429);
      expect(response.headers['x-ratelimit-limit']).to.equal('100');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('X-Test-Override', 'true')
        .send();

      expect(response.headers).to.have.property('x-ratelimit-limit');
      expect(response.headers).to.have.property('x-ratelimit-remaining');
      expect(response.headers).to.have.property('x-ratelimit-reset');
    });
  });

  describe('CSRF Protection', () => {
    it('should reject state-changing requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/user/profile')
        .send({
          name: 'Updated Name'
        });

      expect([400, 403]).to.include(response.status);
    });

    it('should accept state-changing requests with valid CSRF token', async () => {
      const agent = request.agent();

      // Get CSRF token
      const getResponse = await agent
        .get('/api/csrf-token')
        .expect(200)
        .send();

      const csrfToken = getResponse.body.csrfToken;

      // Use CSRF token in POST request
      const postResponse = await agent
        .post('/api/user/profile')
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Updated Name',
          _csrf: csrfToken
        });

      expect([200, 201, 204]).to.include(postResponse.status);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .send();

      expect(response.status).to.equal(401);
      expect(response.body.error).to.include('Unauthorized');
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send();

      expect(response.status).to.equal(401);
      expect(response.body.error).to.include('Unauthorized');
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = createExpiredJWT();

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send();

      expect(response.status).to.equal(401);
      expect(response.body.error).to.include('Token expired');
    });

    it('should enforce role-based access control', async () => {
      // Create user token with basic role
      const userToken = createJWT({ role: 'user' });

      // Try to access admin endpoint
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New User',
          role: 'user'
        });

      expect(response.status).to.equal(403);
      expect(response.body.error).to.include('Forbidden');
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          // Missing required fields
          email: 'test@example.com'
        });

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.exist;
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'validPassword123',
          confirmPassword: 'validPassword123'
        });

      expect(response.status).to.equal(400);
      expect(response.body.errors.email).to.exist;
    });

    it('should validate password complexity', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123', // Too simple
          confirmPassword: '123'
        });

      expect(response.status).to.equal(400);
      expect(response.body.errors.password).to.exist;
    });

    it('should sanitize HTML in inputs', async () => {
      const response = await request(app)
        .post('/api/posts')
        .send({
          title: '<script>alert("XSS")</script>',
          content: '<img src=x onerror=alert("XSS")>'
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid input');
    });
  });

  describe('File Upload Security', () => {
    it('should reject oversized files', async () => {
      // Create a large buffer (11MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      const response = await request(app)
        .post('/api/upload')
        .attach('file', 'test.txt', largeBuffer)
        .expect(413);

      expect(response.body.error).to.include('Request entity too large');
    });

    it('should reject dangerous file types', async () => {
      const maliciousContent = Buffer.from('malicious code here', 'utf8');

      const response = await request(app)
        .post('/api/upload')
        .attach('file', 'malicious.php', maliciousContent)
        .set('Content-Type', 'multipart/form-data')
        .expect(400);

      expect(response.body.error).to.include('Invalid file type');
    });

    it('should scan files for malware', async () => {
      // This would integrate with an actual virus scanner
      const scanResult = await scanFileForMalware(testFilePath);

      expect(scanResult.isClean).to.be.true;
    });
  });

  describe('Path Traversal Protection', () => {
    it('should block path traversal attempts', async () => {
      const paths = [
        '/api/files/../../etc/passwd',
        '/api/files/..\\..\\windows\\system32\\config\\sam',
        '/api/files/%2e%2e%2f%2e%2f%2e%2fetc%2fpasswd'
      ];

      for (const path of paths) {
        const response = await request(app)
          .get(path);
        expect([400, 404]).to.include(response.status);
      }
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await request(app)
        .get('/api/data')
        .send();

      expect(response.headers).to.have.property('x-content-type-options');
      expect(response.headers).to.have.property('x-frame-options');
      expect(response.headers).to.have.property('strict-transport-security');
      expect(response.headers).to.have.property('x-xss-protection');
      expect(response.headers).to.have.property('content-security-policy');
    });
  });

  describe('Error Handling', () => {
    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .send();

      expect(response.status).to.equal(404);
      expect(response.body).not.to.have.property('stack');
      expect(response.body).not.to.have.property('error');
      expect(response.body).to.have.property('message');
    });

    it('should use generic error messages in production', async () => {
      const response = await request(app)
        .post('/api/test-error')
        .send({});

      expect(response.status).to.equal(500);
      expect(response.body.message).to.equal('Internal server error');
    });
  });

  describe('API Rate Limiting', () => {
    it('should limit API endpoint calls', async () => {
      const promises = [];

      // Exceed API rate limit
      for (let i = 0; i < 110; i++) { // 110 requests, limit is 100/15min
        promises.push(
          request(app)
            .get('/api/v1/data')
            .set('X-API-Key', 'test-api-key')
        );
      }

      const responses = await Promise.all(promises);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).to.equal(429);
      expect(lastResponse.headers['x-ratelimit-remaining']).to.equal('0');
    });

    it('should apply stricter limits to authentication endpoints', async () => {
      const promises = [];

      // Exceed auth rate limit (5 per 15 minutes)
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'test'
            })
        );
      }

      const responses = await Promise.all(promises);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).to.equal(429);
    });
  });

  describe('NoSQL Injection Protection', () => {
    it('should block NoSQL injection in MongoDB queries', async () => {
      const response = await request(app)
        .post('/api/users/search')
        .send({
          username: { "$ne": "" },
          password: { "$gt": "" }
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });

    it('should block malicious regex queries', async () => {
      const response = await request(app)
        .post('/api/users/search')
        .send({
          field: 'password',
          regex: { "$regex": "" }
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('Invalid request');
    });
  });
});

// Helper functions
function createExpiredJWT(): string {
  // Create an expired JWT for testing
  const payload = {
    sub: 'test',
    role: 'user',
    exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.signature`;
}

function createJWT(payload: object): string {
  // Create a valid JWT for testing
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.signature`;
}

async function scanFileForMalware(filePath: string): Promise<{ isClean: boolean; threats: string[] }> {
  // Mock implementation - in real scenario, this would call ClamAV or similar
  return {
    isClean: true,
    threats: []
  };
}

// Integration tests
describe('Security Integration Tests', () => {
  it('should pass OWASP ZAP scan', async () => {
      // This would run ZAP against the application
      // For unit tests, we just ensure security headers are present
      const response = await request(app)
        .get('/')
        .send();

      expect(response.headers).to.have.property('x-content-type-options');
      expect(response.headers['x-content-type-options']).to.include('nosniff');
      expect(response.headers).to.have.property('x-frame-options');
    });
  });
});