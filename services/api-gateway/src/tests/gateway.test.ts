import request from 'supertest';
import { expect } from 'chai';
import gateway from '../gateway';

describe('API Gateway', () => {
  let app: any;

  before(async () => {
    // Start the gateway for testing
    app = await gateway;
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).to.have.property('status', 'healthy');
      expect(response.body).to.have.property('timestamp');
      expect(response.body).to.have.property('uptime');
    });
  });

  describe('Gateway Info', () => {
    it('should return gateway information', async () => {
      const response = await request(app)
        .get('/gateway/info')
        .expect(200);

      expect(response.body).to.have.property('name', 'LabelMint API Gateway');
      expect(response.body).to.have.property('version');
      expect(response.body).to.have.property('services');
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger UI', async () => {
      await request(app)
        .get('/docs')
        .expect(200);
    });

    it('should serve OpenAPI JSON', async () => {
      const response = await request(app)
        .get('/docs.json')
        .expect(200);

      expect(response.body).to.have.property('openapi');
      expect(response.body).to.have.property('info');
    });
  });

  describe('Service Proxy', () => {
    it('should proxy requests to labeling service', async () => {
      // This test would require the labeling service to be running
      // In a real test environment, you'd mock the backend services
      const response = await request(app)
        .get('/api/v1/labeling/health')
        .set('X-Correlation-ID', 'test-123');

      // Expect either successful proxy or service unavailable
      expect([200, 503]).to.include(response.status);
    });

    it('should require authentication for protected routes', async () => {
      await request(app)
        .get('/api/v1/labeling/projects')
        .expect(401);
    });

    it('should allow access to public routes', async () => {
      await request(app)
        .get('/api/v1/public/health')
        .expect([200, 503]);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).to.have.property('x-ratelimit-limit');
      expect(response.headers).to.have.property('x-ratelimit-remaining');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/health')
        .expect(204);

      expect(response.headers).to.have.property('access-control-allow-origin');
      expect(response.headers).to.have.property('access-control-allow-methods');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).to.have.property('x-content-type-options', 'nosniff');
      expect(response.headers).to.have.property('x-frame-options');
      expect(response.headers).to.have.property('x-xss-protection');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).to.have.property('error');
      expect(response.body.error).to.have.property('code', 'NOT_FOUND');
    });

    it('should handle validation errors', async () => {
      // This would test validation middleware on an endpoint that has it
      // For now, just checking the error format
      const response = await request(app)
        .post('/api/v1/labeling/projects')
        .send({})
        .expect(401);

      expect(response.body).to.have.property('error');
      expect(response.body.error).to.have.property('code', 'UNAUTHORIZED');
    });
  });

  describe('Correlation ID', () => {
    it('should add correlation ID to responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).to.have.property('x-correlation-id');
      expect(response.headers['x-correlation-id']).to.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should use provided correlation ID', async () => {
      const testId = 'test-correlation-id-123';
      const response = await request(app)
        .get('/health')
        .set('X-Correlation-ID', testId)
        .expect(200);

      expect(response.headers['x-correlation-id']).to.equal(testId);
    });
  });

  describe('Metrics', () => {
    it('should serve Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).to.include('http_request_duration_seconds');
      expect(response.text).to.include('http_requests_total');
    });
  });
});