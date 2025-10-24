# Telegram Labeling Platform - API Documentation

## Overview

The Telegram Labeling Platform provides a comprehensive REST API for programmatic dataset labeling with enterprise-grade features including AI-powered tasks, quality control, and real-time webhooks.

## Quick Start

1. **Get API Keys**: Create API keys in your dashboard or via the `/api/keys` endpoint
2. **Authenticate**: Use triple authentication (API Key + Timestamp + HMAC Signature)
3. **Create Project**: Set up your labeling project with categories and guidelines
4. **Submit Tasks**: Upload data for labeling via API
5. **Monitor Progress**: Track labeling progress and receive webhook notifications

## Authentication

The API uses a triple authentication system for security:

1. **API Key** (`X-API-Key`): Your unique API key
2. **Timestamp** (`X-Timestamp`): Unix timestamp (5-minute window)
3. **Signature** (`X-Signature`): HMAC-SHA256 signature of the request payload

### Example Authentication

```javascript
const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'your-api-key';
const apiSecret = 'your-api-secret';
const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({ data: 'your-data' });

// Create signature
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(`${timestamp}${payload}`)
  .digest('hex');

// Make request
const response = await axios.post('https://api.labelmint.it/v1/tasks', payload, {
  headers: {
    'X-API-Key': apiKey,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'Content-Type': 'application/json'
  }
});
```

## Base URL

- **Production**: `https://api.labelmint.it/v1`
- **Development**: `http://localhost:3001/api/v1`

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks` | GET, POST | Manage basic labeling tasks |
| `/enhancedTasks` | GET, POST | Enhanced tasks with AI assistance |
| `/aiTasks` | GET, POST | AI-powered task automation |
| `/projects` | GET, POST, PUT, DELETE | Project management |
| `/keys` | GET, POST, PUT, DELETE | API key management |
| `/payments` | GET, POST | Payment processing |
| `/growth` | GET, POST | Growth automation features |
| `/viral` | GET, POST | Viral marketing features |

### API Reference

- **[OpenAPI 3.0 Specification](./openapi.yaml)** - Complete API specification
- **[Swagger UI](https://api.labelmint.it/docs)** - Interactive API documentation
- **[Postman Collection](./postman-collection.json)** - Import to Postman for testing

## Rate Limiting

API requests are rate-limited based on your subscription tier:

| Tier | Requests | Window |
|------|----------|--------|
| Starter | 1,000 | 1 hour |
| Professional | 10,000 | 1 hour |
| Enterprise | 100,000 | 1 hour |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

## Webhooks

Configure webhooks to receive real-time notifications:

### Task Completed
```json
{
  "event": "task.completed",
  "data": {
    "task_id": "task_123",
    "project_id": 456,
    "label": "spam",
    "confidence": 0.95,
    "worker_id": 789,
    "completed_at": "2024-01-15T10:30:00Z"
  }
}
```

### Project Completed
```json
{
  "event": "project.completed",
  "data": {
    "project_id": 456,
    "total_tasks": 1000,
    "completed_tasks": 1000,
    "accuracy": 0.94,
    "completed_at": "2024-01-15T10:30:00Z"
  }
}
```

## SDKs and Libraries

- **JavaScript/TypeScript**: `npm install labelmint-api-client`
- **Python**: `pip install labelmint-python`
- **cURL**: Native REST API support

## Support

- **Documentation**: [docs.labelmint.it](https://docs.labelmint.it)
- **API Status**: [status.labelmint.it](https://status.labelmint.it)
- **Support Email**: api-support@labelmint.it
- **Community**: [GitHub Discussions](https://github.com/labelmint/labeling-platform/discussions)

## Changelog

### v1.2.0 (2024-01-15)
- Added AI-powered task endpoints
- Enhanced webhook security
- Improved rate limiting controls

### v1.1.0 (2024-01-01)
- Introduced enhanced tasks
- Added batch processing
- Performance improvements

### v1.0.0 (2023-12-01)
- Initial API release
- Core labeling functionality
- Authentication system