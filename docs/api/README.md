# 📡 LabelMint API Documentation

Comprehensive API documentation for the LabelMint data labeling platform, covering REST endpoints, WebSocket events, authentication, and integration guidelines.

## 🎯 Quick Start

### Base URLs

| Environment | Base URL | Description |
|-------------|----------|-------------|
| **Development** | `http://localhost:3104/api/v1` | Local development |
| **Staging** | `https://api-staging.labelmint.com/api/v1` | Staging environment |
| **Production** | `https://api.labelmint.com/api/v1` | Live production |

### Authentication

All API requests require authentication using JWT tokens:

```http
Authorization: Bearer <your-jwt-token>
```

**Quick Test:**
```bash
curl -H "Authorization: Bearer <token>" \
     https://api.labelmint.com/api/v1/health
```

## 🔐 Authentication & Security

### JWT Authentication

LabelMint uses JSON Web Tokens (JWT) for API authentication:

```javascript
// Login request
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "secure_password"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "expiresIn": 604800,
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "role": "client"
  }
}
```

### Triple Authentication (API Keys)

For API access, use triple authentication:

1. **API Key** (`X-API-Key`): Your unique API key
2. **Timestamp** (`X-Timestamp`): Unix timestamp (5-minute window)
3. **Signature** (`X-Signature`): HMAC-SHA256 signature

```javascript
const crypto = require('crypto');

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
const response = await fetch('https://api.labelmint.com/api/v1/tasks', {
  method: 'POST',
  headers: {
    'X-API-Key': apiKey,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'Content-Type': 'application/json'
  },
  body: payload
});
```

### Rate Limiting

API requests are rate-limited based on subscription tier:

| Tier | Requests | Window | Headers |
|------|----------|--------|---------|
| **Starter** | 1,000 | 1 hour | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |
| **Professional** | 10,000 | 1 hour | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |
| **Enterprise** | 100,000 | 1 hour | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |

## 📋 API Endpoints

### Core Endpoints Overview

| Service | Endpoints | Description |
|---------|-----------|-------------|
| **Authentication** | `/auth/*` | User authentication and tokens |
| **Projects** | `/projects/*` | Project management operations |
| **Tasks** | `/tasks/*` | Task creation and management |
| **Users** | `/users/*` | User management and profiles |
| **Payments** | `/payments/*` | Payment processing and transactions |
| **Analytics** | `/analytics/*` | Data analytics and reporting |
| **Webhooks** | `/webhooks/*` | Webhook management |

## 🔑 Authentication Endpoints

### User Authentication

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "expiresIn": 604800,
    "user": {
      "id": "user_uuid",
      "email": "user@example.com",
      "role": "client",
      "permissions": ["read:own_projects", "write:own_tasks"]
    }
  }
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

#### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

#### Register (Telegram Users)
```http
POST /api/v1/auth/register-telegram
Content-Type: application/json

{
  "telegramId": 123456789,
  "username": "telegram_username",
  "firstName": "John",
  "lastName": "Doe",
  "role": "worker"
}
```

### API Key Authentication

#### Create API Key
```http
POST /api/v1/auth/api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Production API Key",
  "permissions": ["read:projects", "write:tasks"],
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "key_uuid",
  "name": "Production API Key",
  "apiKey": "labelmint_live_...",
  "apiSecret": "secret_...",
  "permissions": ["read:projects", "write:tasks"],
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

## 📁 Projects Management

### List Projects
```http
GET /api/v1/projects?page=1&limit=20&status=active
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "project_uuid",
        "name": "Image Classification Dataset",
        "description": "Classify images into categories",
        "status": "active",
        "type": "IMG_CLS",
        "totalTasks": 1000,
        "completedTasks": 250,
        "budget": 100.00,
        "spent": 25.50,
        "createdAt": "2024-01-15T10:30:00Z",
        "deadline": "2024-02-15T23:59:59Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### Create Project
```http
POST /api/v1/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Image Classification Dataset",
  "description": "Classify images into categories",
  "type": "IMG_CLS",
  "categories": ["cat", "dog", "bird", "fish"],
  "instructions": "Select the correct category for each image",
  "paymentPerTask": 0.05,
  "totalBudget": 100.00,
  "deadline": "2024-02-15T23:59:59Z",
  "qualityThreshold": 0.85,
  "consensusRequired": 3,
  "goldTaskPercentage": 15
}
```

### Get Project Details
```http
GET /api/v1/projects/{projectId}
Authorization: Bearer <token>
```

### Update Project
```http
PUT /api/v1/projects/{projectId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Project Name",
  "status": "paused"
}
```

### Delete Project
```http
DELETE /api/v1/projects/{projectId}
Authorization: Bearer <token>
```

### Project Analytics
```http
GET /api/v1/projects/{projectId}/analytics?period=7d
Authorization: Bearer <token>
```

## 📝 Tasks Management

### Get Available Tasks
```http
GET /api/v1/tasks/available?limit=10&type=IMG_CLS
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task_uuid",
        "projectId": "project_uuid",
        "type": "IMG_CLS",
        "data": {
          "imageUrl": "https://storage.labelmint.com/tasks/image1.jpg",
          "categories": ["cat", "dog", "bird", "fish"]
        },
        "paymentAmount": 0.05,
        "timeLimit": 300,
        "difficulty": "medium",
        "goldTask": false
      }
    ]
  }
}
```

### Reserve Task
```http
POST /api/v1/tasks/{taskId}/reserve
Authorization: Bearer <token>
```

### Submit Task Answer
```http
POST /api/v1/tasks/{taskId}/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "answer": "cat",
  "timeSpent": 45,
  "confidence": 0.95,
  "metadata": {
    "userAgent": "Mozilla/5.0...",
    "screenResolution": "1920x1080"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "task_uuid",
    "submissionId": "submission_uuid",
    "status": "submitted",
    "isCorrect": true,
    "paymentAmount": 0.05,
    "bonusAmount": 0.01,
    "totalEarned": 0.06,
    "userAccuracy": 0.92,
    "nextTasksAvailable": 5
  }
}
```

### Skip Task
```http
POST /api/v1/tasks/{taskId}/skip
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "unclear_image"
}
```

### Get Task History
```http
GET /api/v1/tasks/history?page=1&limit=20&status=completed
Authorization: Bearer <token>
```

### Create Batch Tasks
```http
POST /api/v1/tasks/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "project_uuid",
  "tasks": [
    {
      "type": "IMG_CLS",
      "data": {
        "imageUrl": "https://storage.labelmint.com/batch/image1.jpg",
        "categories": ["cat", "dog"]
      }
    },
    {
      "type": "IMG_CLS",
      "data": {
        "imageUrl": "https://storage.labelmint.com/batch/image2.jpg",
        "categories": ["cat", "dog"]
      }
    }
  ]
}
```

## 👥 Users Management

### Get User Profile
```http
GET /api/v1/users/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "email": "user@example.com",
    "username": "john_doe",
    "role": "worker",
    "status": "active",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://storage.labelmint.com/avatars/user.jpg",
      "timezone": "UTC",
      "language": "en"
    },
    "stats": {
      "completedTasks": 1250,
      "totalEarned": 62.50,
      "averageAccuracy": 0.94,
      "level": 15,
      "reputation": 4.8
    },
    "preferences": {
      "notifications": true,
      "autoAssignTasks": false,
      "preferredCategories": ["IMG_CLS", "TXT_CLS"]
    }
  }
}
```

### Update User Profile
```http
PUT /api/v1/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "timezone": "America/New_York",
    "language": "en"
  },
  "preferences": {
    "notifications": true,
    "autoAssignTasks": false
  }
}
```

### Get User Statistics
```http
GET /api/v1/users/me/stats?period=30d
Authorization: Bearer <token>
```

### Get User Earnings
```http
GET /api/v1/users/me/earnings?period=7d
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "totalEarned": 12.45,
    "dailyEarnings": [
      {
        "date": "2024-01-15",
        "earned": 2.15,
        "tasksCompleted": 43
      },
      {
        "date": "2024-01-14",
        "earned": 1.85,
        "tasksCompleted": 37
      }
    ],
    "breakdown": {
      "taskPayments": 11.20,
      "bonuses": 0.85,
      "adjustments": -0.60
    },
    "pendingWithdrawals": 5.00,
    "availableBalance": 7.45
  }
}
```

## 💳 Payments & Withdrawals

### Get Balance
```http
GET /api/v1/payments/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "availableBalance": 45.67,
    "pendingBalance": 12.30,
    "totalEarned": 57.97,
    "totalWithdrawn": 12.30,
    "currency": "USDT",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### Request Withdrawal
```http
POST /api/v1/payments/withdrawals
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 25.00,
  "address": "EQD...your-ton-address",
  "currency": "USDT",
  "network": "TON"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "withdrawalId": "withdrawal_uuid",
    "amount": 25.00,
    "fee": 1.00,
    "netAmount": 24.00,
    "address": "EQD...your-ton-address",
    "status": "pending",
    "estimatedProcessingTime": "2024-01-15T12:00:00Z",
    "transactionHash": null
  }
}
```

### Get Withdrawal History
```http
GET /api/v1/payments/withdrawals?page=1&limit=20
Authorization: Bearer <token>
```

### Get Transaction History
```http
GET /api/v1/payments/transactions?page=1&limit=20&type=task_payment
Authorization: Bearer <token>
```

## 📊 Analytics & Reporting

### Platform Analytics
```http
GET /api/v1/analytics/platform?period=30d&metrics=tasks,users,earnings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "metrics": {
      "tasks": {
        "total": 15420,
        "completed": 14890,
        "pending": 530,
        "completionRate": 0.966
      },
      "users": {
        "total": 2840,
        "active": 1250,
        "new": 180,
        "retentionRate": 0.78
      },
      "earnings": {
        "totalPaid": 1245.67,
        "averagePerTask": 0.083,
        "totalFees": 62.28
      }
    },
    "trends": [
      {
        "date": "2024-01-15",
        "tasksCompleted": 485,
        "activeUsers": 125,
        "earnings": 42.15
      }
    ]
  }
}
```

### Project Analytics
```http
GET /api/v1/analytics/projects/{projectId}?period=7d
Authorization: Bearer <token>
```

### User Analytics
```http
GET /api/v1/analytics/users/{userId}?period=30d
Authorization: Bearer <token>
```

### Quality Metrics
```http
GET /api/v1/analytics/quality?period=7d&projectId={projectId}
Authorization: Bearer <token>
```

## 🔌 Webhooks

### Create Webhook
```http
POST /api/v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/labelmint",
  "events": ["task.completed", "payment.received", "project.completed"],
  "secret": "your-webhook-secret",
  "active": true
}
```

### List Webhooks
```http
GET /api/v1/webhooks
Authorization: Bearer <token>
```

### Update Webhook
```http
PUT /api/v1/webhooks/{webhookId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/labelmint-updated",
  "events": ["task.completed", "payment.received"],
  "active": true
}
```

### Delete Webhook
```http
DELETE /api/v1/webhooks/{webhookId}
Authorization: Bearer <token>
```

### Webhook Events

#### Task Completed
```json
{
  "event": "task.completed",
  "data": {
    "taskId": "task_uuid",
    "projectId": "project_uuid",
    "userId": "user_uuid",
    "submissionId": "submission_uuid",
    "answer": "cat",
    "isCorrect": true,
    "paymentAmount": 0.05,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "signature": "webhook_signature_here"
}
```

#### Project Completed
```json
{
  "event": "project.completed",
  "data": {
    "projectId": "project_uuid",
    "totalTasks": 1000,
    "completedTasks": 1000,
    "accuracy": 0.94,
    "totalSpent": 50.00,
    "completedAt": "2024-01-15T10:30:00Z"
  },
  "signature": "webhook_signature_here"
}
```

## 🔌 WebSocket API

### Connection
```javascript
const socket = io('wss://api.labelmint.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Authentication
```javascript
socket.emit('authenticate', { token: 'your-jwt-token' });

socket.on('authenticated', (data) => {
  console.log('Authenticated:', data.user);
});

socket.on('authentication_error', (error) => {
  console.error('Authentication failed:', error);
});
```

### Real-time Events

#### Task Assignment
```javascript
socket.on('task_assigned', (task) => {
  console.log('New task assigned:', task);
  // Handle task assignment
});

socket.on('task_available', (notification) => {
  console.log('Tasks available:', notification.count);
  // Update UI with available tasks count
});
```

#### Payment Notifications
```javascript
socket.on('payment_received', (payment) => {
  console.log('Payment received:', payment);
  // Update user balance
});

socket.on('withdrawal_processed', (withdrawal) => {
  console.log('Withdrawal processed:', withdrawal);
  // Update withdrawal status
});
```

#### Project Updates
```javascript
socket.on('project_update', (update) => {
  console.log('Project updated:', update);
  // Refresh project data
});

socket.on('project_completed', (project) => {
  console.log('Project completed:', project);
  // Handle project completion
});
```

#### System Notifications
```javascript
socket.on('notification', (notification) => {
  console.log('System notification:', notification);
  // Display notification to user
});

socket.on('maintenance_scheduled', (info) => {
  console.log('Maintenance scheduled:', info);
  // Show maintenance notice
});
```

### Joining Rooms
```javascript
// Join project-specific room
socket.emit('join_project', { projectId: 'project_uuid' });

// Join user-specific room
socket.emit('join_user', { userId: 'user_uuid' });

// Listen to room-specific events
socket.on('project_update', (update) => {
  // Updates for joined project
});
```

## 🎯 Task Types

### Image Classification (IMG_CLS)
```json
{
  "type": "IMG_CLS",
  "data": {
    "imageUrl": "https://storage.labelmint.com/tasks/image1.jpg",
    "categories": ["cat", "dog", "bird", "fish"],
    "allowMultiple": false,
    "showLabels": true
  },
  "instructions": "Select the correct category for the image"
}
```

### Text Classification (TXT_CLS)
```json
{
  "type": "TXT_CLS",
  "data": {
    "text": "This is a sample text to classify",
    "categories": ["spam", "ham", "promotion"],
    "maxLength": 500
  },
  "instructions": "Classify the text into the appropriate category"
}
```

### Bounding Box (BBOX)
```json
{
  "type": "BBOX",
  "data": {
    "imageUrl": "https://storage.labelmint.com/tasks/image2.jpg",
    "objectClasses": ["car", "person", "bicycle"],
    "minBoxes": 1,
    "maxBoxes": 10
  },
  "instructions": "Draw bounding boxes around the specified objects"
}
```

### RLHF Comparison (RLHF_PAIR)
```json
{
  "type": "RLHF_PAIR",
  "data": {
    "prompt": "What is the capital of France?",
    "responseA": "The capital of France is Paris.",
    "responseB": "France's capital city is Paris.",
    "modelA": "gpt-4",
    "modelB": "claude-3"
  },
  "instructions": "Choose the better response or select 'tie'"
}
```

## 🚨 Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "The requested task was not found",
    "details": {
      "taskId": "invalid_task_id",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  },
  "requestId": "req_uuid"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Handling Errors
```javascript
try {
  const response = await fetch('/api/v1/tasks/available', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!data.success) {
    console.error('API Error:', data.error);
    // Handle error based on error code
    switch (data.error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        break;
      case 'RATE_LIMITED':
        // Wait and retry
        break;
      default:
        // Show generic error message
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## 🧪 API Testing

### Using curl
```bash
# Health check
curl https://api.labelmint.com/api/v1/health

# Get available tasks
curl -H "Authorization: Bearer <token>" \
     https://api.labelmint.com/api/v1/tasks/available

# Submit task
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"answer":"cat","timeSpent":45}' \
     https://api.labelmint.com/api/v1/tasks/task_uuid/submit
```

### Using Postman
Import the LabelMint API collection:
1. Download [Postman Collection](./labelmint-api-postman-collection.json)
2. Import into Postman
3. Set environment variables for authentication
4. Test endpoints

### Using JavaScript SDK
```javascript
import LabelMintAPI from '@labelmint/api-client';

const api = new LabelMintAPI({
  baseURL: 'https://api.labelmint.com/api/v1',
  token: 'your-jwt-token'
});

// Get available tasks
const tasks = await api.tasks.getAvailable();

// Submit task
const result = await api.tasks.submit(taskId, {
  answer: 'cat',
  timeSpent: 45
});

// WebSocket connection
const socket = api.websocket.connect();
socket.on('task_assigned', handleTaskAssignment);
```

## 📈 Rate Limiting & Usage

### Rate Limits by Endpoint

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `POST /auth/login` | 5/minute | 1 minute |
| `GET /tasks/available` | 100/minute | 1 minute |
| `POST /tasks/{id}/submit` | 60/minute | 1 minute |
| `POST /payments/withdrawals` | 3/hour | 1 hour |
| `GET /analytics/*` | 30/minute | 1 minute |

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

### Handling Rate Limits
```javascript
async function makeRequest(url, options) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    const waitTime = resetTime ? resetTime * 1000 - Date.now() : 60000;

    console.log(`Rate limited. Waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    return makeRequest(url, options); // Retry
  }

  return response;
}
```

## 🔍 Monitoring & Debugging

### Request ID
Every API request includes a unique request ID for debugging:
```http
X-Request-ID: req_1234567890abcdef
```

### Health Check
```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.2.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "blockchain": "healthy"
  },
  "uptime": 86400
}
```

### API Status
```http
GET /api/v1/status
```

## 📚 SDKs & Libraries

### Official SDKs

| Language | Package | Installation |
|----------|---------|-------------|
| **JavaScript/TypeScript** | `@labelmint/api-client` | `npm install @labelmint/api-client` |
| **Python** | `labelmint-python` | `pip install labelmint-python` |
| **PHP** | `labelmint-php` | `composer require labelmint/php` |
| **Go** | `github.com/labelmint/go-sdk` | `go get github.com/labelmint/go-sdk` |

### Community Libraries

- **Ruby**: `labelmint-ruby` (community maintained)
- **Java**: `labelmint-java` (community maintained)
- **C#**: `LabelMint.Net` (community maintained)

## 🔄 Versioning & Changelog

### API Versioning
- Current version: `v1`
- Version in URL: `/api/v1/`
- Backward compatibility maintained within major versions
- Deprecation notices sent 3 months before removal

### Recent Changes

#### v1.2.0 (2024-01-15)
- Added AI-powered task endpoints
- Enhanced webhook security with signatures
- Improved rate limiting controls
- New analytics endpoints

#### v1.1.0 (2024-01-01)
- Introduced batch task creation
- Added WebSocket real-time events
- Enhanced payment processing
- Performance improvements

#### v1.0.0 (2023-12-01)
- Initial API release
- Core labeling functionality
- Authentication system
- Payment processing

## 🆘 Support & Troubleshooting

### Common Issues

#### Authentication Failures
```bash
# Check token validity
curl -H "Authorization: Bearer <token>" \
     https://api.labelmint.com/api/v1/users/me
```

#### Rate Limiting
- Check rate limit headers in responses
- Implement exponential backoff
- Use WebSocket for real-time updates

#### WebSocket Connection Issues
- Verify token is valid and not expired
- Check network connectivity
- Ensure WebSocket is supported in your environment

### Getting Help

- **API Documentation**: [docs.labelmint.com/api](https://docs.labelmint.com/api)
- **Status Page**: [status.labelmint.com](https://status.labelmint.com)
- **Support Email**: api-support@labelmint.com
- **GitHub Issues**: [github.com/labelmint/labeling-platform/issues](https://github.com/labelmint/labeling-platform/issues)
- **Community Forum**: [community.labelmint.com](https://community.labelmint.com)

### Best Practices

1. **Authentication**: Store tokens securely, refresh before expiry
2. **Rate Limiting**: Implement proper backoff strategies
3. **Error Handling**: Handle all error codes gracefully
4. **Webhooks**: Verify webhook signatures
5. **Pagination**: Use pagination for large datasets
6. **Caching**: Cache static data to reduce API calls
7. **Monitoring**: Track API usage and performance

---

**📡 Built with ❤️ by the LabelMint Team**

For robust, scalable, and developer-friendly API integration.