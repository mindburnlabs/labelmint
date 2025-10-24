# API Rate Limiting Documentation

## Overview

The Telegram Labeling Platform API implements rate limiting to ensure fair usage, maintain system stability, and prevent abuse. Rate limits are applied per API key and vary based on your subscription tier.

## Rate Limit Tiers

### Subscription-Based Limits

| Tier | Requests/Hour | Requests/Minute | Requests/Second | Burst Limit |
|------|---------------|-----------------|-----------------|-------------|
| **Starter** | 1,000 | 100 | 2 | 5 |
| **Professional** | 10,000 | 500 | 10 | 20 |
| **Enterprise** | 100,000 | 2,000 | 50 | 100 |
| **Custom** | Unlimited | Negotiated | Negotiated | Negotiated |

### Endpoint-Specific Limits

Some endpoints have additional restrictions:

| Endpoint | Additional Limits | Rationale |
|----------|-------------------|-----------|
| `POST /tasks` | 10 requests/second | Prevent spam task creation |
| `POST /tasks/batch` | 1 request/second | Heavy processing required |
| `POST /aiTasks` | 5 requests/second | AI model costs |
| `POST /projects` | 10 requests/minute | Prevent spam projects |
| `POST /keys` | 5 requests/hour | Security limitation |
| `GET /analytics` | 100 requests/hour | Data processing costs |

## Rate Limit Headers

All API responses include rate limit information in the headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705123200
X-RateLimit-Retry-After: 60
X-RateLimit-Policy: fixed-window
X-RateLimit-Scope: api-key
```

### Header Descriptions

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests in current window | `1000` |
| `X-RateLimit-Remaining` | Remaining requests in window | `999` |
| `X-RateLimit-Reset` | Unix timestamp when window resets | `1705123200` |
| `X-RateLimit-Retry-After` | Seconds to wait before retry (429 only) | `60` |
| `X-RateLimit-Policy` | Rate limiting algorithm used | `fixed-window` |
| `X-RateLimit-Scope` | Scope of rate limit | `api-key` |

## Rate Limiting Algorithms

### Fixed Window Counter

The default algorithm uses fixed time windows:

- **Window**: 1 hour (3600 seconds)
- **Reset**: At the top of each hour (e.g., 14:00, 15:00)
- **Tracking**: Per API key

### Sliding Window (Premium Tiers)

Enterprise and custom plans may use sliding windows:

- **Window**: Last 60 minutes continuously
- **More flexible**: Allows burst usage within limits
- **Fairer**: Prevents last-minute surges

## Handling Rate Limits

### Detecting Rate Limits

```javascript
async function makeRequest(url, options) {
  const response = await fetch(url, options);

  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
  const reset = parseInt(response.headers.get('X-RateLimit-Reset'));

  if (remaining <= 10) {
    console.warn(`Low rate limit: ${remaining} requests remaining`);
    console.log(`Reset at: ${new Date(reset * 1000)}`);
  }

  return response;
}
```

### Exponential Backoff

Recommended strategy for handling 429 responses:

```javascript
async function makeRequestWithRetry(url, options, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('X-RateLimit-Retry-After')) || 60;
      const delay = Math.min(retryAfter * Math.pow(2, attempt - 1), 300); // Max 5 minutes

      console.log(`Rate limited. Retrying in ${delay} seconds...`);
      await sleep(delay * 1000);
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

### Request Queuing

For high-volume applications, implement a request queue:

```javascript
class RateLimitedQueue {
  constructor(apiKey, rateLimit) {
    this.apiKey = apiKey;
    this.rateLimit = rateLimit; // requests per hour
    this.requests = [];
    this.processing = false;
  }

  async add(request) {
    return new Promise((resolve, reject) => {
      this.requests.push({ request, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.requests.length > 0) {
      const now = Date.now();
      const windowStart = now - 3600000; // 1 hour ago
      const recentRequests = this.requests.filter(r => r.timestamp > windowStart);

      if (recentRequests.length < this.rateLimit) {
        const { request, resolve, reject } = this.requests.shift();
        try {
          const response = await fetch(request.url, request.options);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      } else {
        // Wait until we can make a request
        const oldestRequest = Math.min(...recentRequests.map(r => r.timestamp));
        const waitTime = oldestRequest + 3600000 - Date.now();
        await sleep(waitTime);
      }
    }

    this.processing = false;
  }
}
```

## Best Practices

### 1. Monitor Rate Limits

Always check rate limit headers:

```python
import requests
import time

def make_api_request(url, headers):
    response = requests.get(url, headers=headers)

    # Check rate limit status
    remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
    reset_time = int(response.headers.get('X-RateLimit-Reset', 0))

    if remaining < 10:
        wait_time = max(0, reset_time - time.time())
        if wait_time > 0:
            print(f"Rate limit low. Waiting {wait_time} seconds...")
            time.sleep(wait_time)

    return response
```

### 2. Use Webhooks Instead of Polling

Replace frequent polling with webhooks:

```javascript
// Bad: Polling every 5 seconds
setInterval(async () => {
  const tasks = await api.getTasks();
  checkForCompletedTasks(tasks);
}, 5000);

// Good: Use webhooks
await api.configureWebhook({
  url: 'https://your-app.com/webhook',
  events: ['task.completed']
});
```

### 3. Batch Requests

Use batch endpoints when possible:

```javascript
// Bad: Multiple individual requests
for (const item of items) {
  await api.createTask(item);
}

// Good: Single batch request
await api.createBatchTasks(items);
```

### 4. Cache Responses

Cache non-volatile data:

```javascript
class CachedAPI {
  constructor(apiClient, cacheTime = 300) { // 5 minutes
    this.api = apiClient;
    this.cache = new Map();
    this.cacheTime = cacheTime * 1000;
  }

  async getProject(id) {
    const cacheKey = `project_${id}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTime) {
      return cached.data;
    }

    const project = await this.api.getProject(id);
    this.cache.set(cacheKey, {
      data: project,
      timestamp: Date.now()
    });

    return project;
  }
}
```

## Rate Limit Increase Requests

### Eligibility

Rate limit increases are available for:
- Enterprise plans
- High-volume legitimate use cases
- Special events or campaigns

### Request Process

1. **Contact Support**: Email api-support@labelmint.it
2. **Provide Details**:
   - Current API key
   - Expected usage pattern
   - Business justification
   - Duration of increased limit

3. **Review**: 1-2 business days
4. **Implementation**: Temporary or permanent increase

### Temporary Increases

For short-term needs (events, campaigns):

```javascript
// Request temporary increase
const response = await fetch('https://api.labelmint.it/v1/limits/request', {
  method: 'POST',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    requested_limit: 50000,
    duration_hours: 24,
    reason: 'Product launch campaign'
  })
});
```

## Monitoring and Analytics

### Rate Limit Dashboard

Monitor your API usage in real-time:
- Current request rate
- Remaining quota
- Historical usage patterns
- Limit breach alerts

### Alerts Configuration

Set up alerts for rate limit thresholds:

```javascript
// Configure alerts
await api.configureAlerts({
  email: 'devops@yourcompany.com',
  thresholds: {
    warning: 80,  // Alert at 80% of limit
    critical: 95  // Alert at 95% of limit
  },
  webhook: 'https://your-monitoring.com/alerts'
});
```

## Common Pitfalls

### 1. Ignoring 429 Responses

Never ignore rate limit errors:

```javascript
// Bad
try {
  const response = await api.createTask(data);
} catch (error) {
  // Continue without retry
}

// Good
try {
  const response = await api.createTask(data);
} catch (error) {
  if (error.status === 429) {
    await retryWithBackoff(() => api.createTask(data));
  }
}
```

### 2. Burst Requests Without Spacing

Space out requests to avoid hitting burst limits:

```javascript
// Bad
for (const task of tasks) {
  api.createTask(task); // All at once
}

// Good
for (const task of tasks) {
  api.createTask(task);
  await sleep(100); // 100ms between requests
}
```

### 3. Not Sharing Limits Across Services

Coordinate API usage across your services:

```javascript
// Use shared rate limit tracker
class SharedRateLimit {
  constructor(redisClient, key) {
    this.redis = redisClient;
    this.key = key;
  }

  async checkLimit() {
    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])

      redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
      local count = redis.call('ZCARD', key)

      if count < limit then
        redis.call('ZADD', key, now, now)
        return {1, limit - count - 1}
      else
        return {0, 0}
      end
    `;

    return this.redis.eval(script, 1, this.key, 1000, 3600, Date.now());
  }
}
```

## Getting Help

- **Documentation**: [docs.labelmint.it/rate-limiting](https://docs.labelmint.it/rate-limiting)
- **Status Page**: [status.labelmint.it](https://status.labelmint.it)
- **Support**: api-support@labelmint.it
- **Increase Request**: [labelmint.it/rate-limit-request](https://labelmint.it/rate-limit-request)

## Rate Limit API

### Check Current Limits

```bash
curl -H "X-API-Key: your-key" \
     https://api.labelmint.it/v1/limits/current
```

Response:
```json
{
  "tier": "Professional",
  "limits": {
    "hourly": 10000,
    "minute": 500,
    "second": 10
  },
  "usage": {
    "current_hour": 234,
    "current_minute": 12,
    "current_second": 0
  },
  "reset_times": {
    "hourly": 1705123200,
    "minute": 1705123260,
    "second": 1705123201
  }
}
```

### Request Increase

```bash
curl -X POST \
     -H "X-API-Key: your-key" \
     -H "Content-Type: application/json" \
     -d '{
       "requested_limit": 50000,
       "duration_hours": 24,
       "reason": "Marketing campaign"
     }' \
     https://api.labelmint.it/v1/limits/request
```