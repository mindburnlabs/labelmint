# LabelMint API Gateway

Enterprise-grade API Gateway for LabelMint services with comprehensive security, monitoring, and management features.

## Features

- 🔐 **Authentication & Authorization**
  - JWT token validation
  - API key management
  - OAuth 2.0 support
  - Role-based access control (RBAC)
  - Permission-based access control

- 🚦 **Rate Limiting & Throttling**
  - Multi-level rate limiting (global, user, API key, endpoint)
  - Redis-backed distributed limiting
  - Adaptive rate limiting by request method
  - Custom rate limit per API key

- 🛡️ **Security**
  - Request validation and sanitization
  - CORS configuration
  - Security headers (Helmet)
  - XSS protection
  - SQL injection prevention
  - Request size limits

- 📊 **Monitoring & Observability**
  - Structured logging with correlation IDs
  - Prometheus metrics
  - Request/response time tracking
  - Error rate monitoring
  - Health checks for all services

- 💾 **Caching**
  - Redis-backed response caching
  - Configurable TTL per endpoint
  - Cache invalidation strategies
  - Cache hit rate optimization

- 📚 **API Documentation**
  - OpenAPI 3.0 specification
  - Interactive Swagger UI
  - Auto-generated documentation
  - API changelog management

- 🔧 **Service Management**
  - Service discovery
  - Health monitoring
  - Circuit breaker pattern
  - Automatic failover
  - Load balancing

## Quick Start

### Prerequisites

- Node.js 18+
- Redis (optional, for distributed features)
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd labelmint/services/api-gateway

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start in development mode
npm run dev
```

### Docker Deployment

```bash
# Development with all services
docker-compose up -d

# With monitoring tools
docker-compose --profile monitoring up -d

# With Redis Commander
docker-compose --profile tools up -d

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## Configuration

The gateway can be configured through environment variables. See `.env.example` for all available options.

### Key Configuration Options

```env
# Basic Configuration
GATEWAY_PORT=3002
NODE_ENV=development

# Service URLs
LABELING_SERVICE_URL=http://localhost:3001
PAYMENT_SERVICE_URL=http://localhost:3000

# Redis (for caching and rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_ENABLED=true

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_AUDIENCE=labelmint
JWT_ISSUER=labelmint-api

# Logging
LOG_LEVEL=info
LOG_FILE_ENABLED=true
```

## API Endpoints

### Gateway Management

- `GET /health` - Health check
- `GET /gateway/info` - Gateway information
- `GET /metrics` - Prometheus metrics
- `GET /docs` - Interactive API documentation
- `GET /docs.json` - OpenAPI specification

### Internal Management (Admin only)

- `GET /internal/management/stats` - Gateway statistics
- `POST /internal/management/cache/invalidate` - Invalidate cache
- `POST /internal/management/services/recheck` - Trigger health checks
- `GET /internal/management/logs` - Recent logs
- `GET /internal/management/metrics/export` - Export metrics

### Service Routes

The gateway routes requests to backend services:

- `/api/v1/labeling/*` → Labeling Service (port 3001)
- `/api/v1/payment/*` → Payment Service (port 3000)
- `/api/v1/public/*` → Public endpoints (no auth required)

## Authentication

### JWT Authentication

```bash
curl -H "Authorization: Bearer <jwt-token>" \
     http://localhost:3002/api/v1/labeling/projects
```

### API Key Authentication

```bash
curl -H "X-API-Key: <api-key>" \
     http://localhost:3002/api/v1/payment/balance
```

## Rate Limiting

Rate limiting is applied at multiple levels:

- **Global**: 100 requests per minute per IP
- **User**: Based on authenticated user ID
- **API Key**: Custom limits per API key
- **Endpoint**: Specific limits per endpoint

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Monitoring

### Prometheus Metrics

Access metrics at `http://localhost:3002/metrics`

Key metrics:
- `http_request_duration_seconds` - Request duration
- `http_requests_total` - Total requests
- `http_errors_total` - Total errors
- `active_connections` - Active connections

### Logging

Structured logs include:
- Correlation ID for request tracing
- Request/response details
- Error stack traces
- Performance metrics

Example log entry:

```json
{
  "level": "info",
  "message": "HTTP Request",
  "method": "GET",
  "url": "/api/v1/labeling/projects",
  "statusCode": 200,
  "duration": "45ms",
  "correlationId": "abc-123-def-456",
  "service": "labeling"
}
```

## Development

### Scripts

```bash
npm run dev        # Start in development mode
npm run build      # Build for production
npm start          # Start production build
npm test           # Run tests
npm run lint       # Lint code
npm run lint:fix   # Fix linting issues
```

### Project Structure

```
src/
├── middleware/          # Custom middleware
│   ├── auth/           # Authentication
│   ├── cache/          # Caching
│   ├── logging/        # Logging
│   ├── rateLimit/      # Rate limiting
│   └── validation/     # Request validation
├── routes/             # Route definitions
│   ├── internal/       # Management routes
│   ├── v1/            # API v1 routes
│   └── v2/            # API v2 routes
├── services/           # Core services
│   ├── health.ts      # Health checking
│   ├── metrics.ts     # Metrics collection
│   └── registry.ts    # Service registry
├── utils/              # Utilities
├── config/             # Configuration
├── types/              # TypeScript types
└── gateway.ts          # Main application
```

## Security Best Practices

1. **Use HTTPS in production**
2. **Rotate JWT secrets regularly**
3. **Use strong API keys**
4. **Implement proper CORS policies**
5. **Monitor and alert on suspicious activity**
6. **Keep dependencies updated**
7. **Use environment variables for secrets**

## Production Deployment

### Requirements

- Docker 20.10+
- Docker Compose 2.0+
- SSL certificates
- Load balancer (optional)

### Deployment Steps

1. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Build and deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Verify deployment**
   ```bash
   curl http://localhost/health
   ```

4. **Set up monitoring**
   - Grafana: http://localhost:3000
   - Prometheus: http://localhost:9091

## Troubleshooting

### Common Issues

1. **Redis connection failed**
   - Check Redis is running
   - Verify connection settings
   - Check firewall rules

2. **High memory usage**
   - Monitor cache size
   - Adjust TTL values
   - Check for memory leaks

3. **Slow responses**
   - Check service health
   - Monitor network latency
   - Review rate limiting settings

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: `/docs`
- Health Check: `/health`
- Issues: Create an issue in the repository
- Email: support@labelmint.com