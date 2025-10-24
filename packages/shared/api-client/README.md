# @labelmint/api-client

A robust, feature-rich API client library for LabelMint services that provides consistent error handling, retry logic, circuit breakers, and monitoring across all microservices.

## Features

- 🔄 **Automatic Retries** with exponential backoff and jitter
- ⚡ **Circuit Breaker** to prevent cascading failures
- 📝 **Structured Error Handling** with proper categorization
- 🏷️ **Correlation IDs** for request tracing
- 📊 **Request/Response Logging** with sensitive data masking
- 🚦 **Health Checks** for external services
- 💾 **Response Caching** with TTL support
- 🔌 **Interceptors** for request/response middleware
- ⏱️ **Timeouts** with AbortSignal support
- 📈 **Metrics** and monitoring support

## Installation

```bash
npm install @labelmint/api-client
# or
yarn add @labelmint/api-client
```

## Quick Start

```typescript
import { createApiClient } from '@labelmint/api-client';

// Create a client for external APIs
const api = createApiClient({
  baseURL: 'https://api.example.com',
  apiKey: process.env.API_KEY,
  timeout: 10000,
  retries: 3
});

// Make requests with automatic error handling
const response = await api.get('/users');
if (response.success) {
  console.log(response.data);
} else {
  console.error('Error:', response.error);
}
```

## Usage Examples

### Basic API Client

```typescript
import { createApiClient } from '@labelmint/api-client';

const client = createApiClient({
  baseURL: 'https://api.labelmint.io',
  apiKey: 'your-api-key',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000
  }
});

// GET request
const users = await client.get('/users');

// POST request
const newUser = await client.post('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
const updated = await client.put('/users/123', {
  name: 'Jane Doe'
});

// DELETE request
await client.delete('/users/123');
```

### External API Client (Stripe, Claude, etc.)

```typescript
import { createExternalApiClient } from '@labelmint/api-client';

const stripeClient = createExternalApiClient({
  baseURL: 'https://api.stripe.com/v1',
  apiKey: process.env.STRIPE_SECRET_KEY,
  headers: {
    'Stripe-Version': '2023-10-16'
  }
});
```

### Internal Service Client

```typescript
import { createInternalApiClient } from '@labelmint/api-client';

const paymentService = createInternalApiClient({
  baseURL: 'http://payment-service:3001',
  timeout: 5000,
  retries: 2
});
```

### Custom Interceptors

```typescript
import { ApiClient, AuthInterceptor, RequestLoggingInterceptor } from '@labelmint/api-client';

const client = new ApiClient({
  baseURL: 'https://api.example.com'
});

// Add authentication
client.addInterceptor(new AuthInterceptor('your-api-key', 'Bearer'));

// Add request logging
client.addInterceptor(new RequestLoggingInterceptor(logger));

// Custom interceptor
client.addInterceptor({
  onRequest: (config) => {
    // Modify request before sending
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Service-Version': '1.0.0'
      }
    };
  },
  onResponse: (response) => {
    // Transform response
    return {
      ...response,
      data: transformData(response.data)
    };
  }
});
```

### Error Handling

```typescript
import { ApiErrorHandler } from '@labelmint/api-client';

try {
  const response = await client.get('/data');
  if (response.success) {
    // Handle success
    console.log(response.data);
  } else {
    // Handle API error
    console.error('API Error:', response.error);

    if (response.error.retryable) {
      // Implement retry logic
    }
  }
} catch (error) {
  // Handle network/unknown errors
  console.error('Request failed:', error);
}
```

### Circuit Breaker Monitoring

```typescript
// Get circuit breaker metrics
const metrics = client.getCircuitBreakerMetrics();
console.log('Circuit breaker state:', metrics.state);
console.log('Failure count:', metrics.failureCount);

// Manually control circuit breaker
if (maintenanceMode) {
  client.openCircuitBreaker(); // Stop all requests
} else {
  client.closeCircuitBreaker(); // Allow requests
}
```

### Health Checks

```typescript
// Check service health
const health = await client.healthCheck('/health');
if (health.healthy) {
  console.log(`Service is healthy (${health.latency}ms)`);
} else {
  console.error('Service is unhealthy:', health.error);
}
```

### Caching

```typescript
// GET requests are automatically cached for 5 minutes
const cachedData = await client.get('/expensive-data');

// Clear cache
client.clearCache();
```

## Configuration Options

```typescript
interface ApiClientConfig {
  baseURL: string;                    // Base URL for all requests
  timeout?: number;                   // Request timeout in ms (default: 30000)
  apiKey?: string;                    // API key for authentication
  retries?: number;                   // Number of retry attempts (default: 3)
  retryDelay?: number;                // Base delay between retries in ms (default: 1000)
  circuitBreaker?: {
    failureThreshold?: number;        // Failures before opening circuit (default: 5)
    resetTimeout?: number;           // Time to wait before retrying (default: 60000)
    monitoringPeriod?: number;       // Time window for failure counting (default: 10000)
  };
  headers?: Record<string, string>;   // Default headers for all requests
  logger?: Logger;                    // Custom logger instance
}
```

## Response Format

All API responses follow a consistent format:

```typescript
interface ApiResponse<T> {
  success: boolean;                   // Whether the request was successful
  data?: T;                          // Response data (if successful)
  error?: {
    code: string;                    // Error code
    message: string;                 // Error message
    details?: any;                   // Additional error details
    statusCode?: number;             // HTTP status code
    retryable?: boolean;             // Whether the error is retryable
  };
  metadata?: {
    requestId: string;               // Unique request identifier
    timestamp: Date;                 // Response timestamp
    duration: number;                // Request duration in ms
    attempts: number;                // Number of attempts made
    correlationId?: string;          // Correlation ID for tracing
    fromCache?: boolean;             // Whether response came from cache
  };
}
```

## Error Codes

The library provides standardized error codes:

- `NETWORK_ERROR` - Network connectivity issues
- `TIMEOUT` - Request timed out
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMIT` - Too many requests
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable
- `CIRCUIT_BREAKER_OPEN` - Circuit breaker is open
- `INTERNAL_ERROR` - Unexpected server error

## Best Practices

1. **Use appropriate client types**:
   - `createApiClient()` for general use
   - `createExternalApiClient()` for third-party APIs
   - `createInternalApiClient()` for microservices

2. **Implement proper error handling**:
   - Always check `response.success`
   - Handle `retryable` errors appropriately
   - Log errors with correlation IDs

3. **Monitor circuit breaker state**:
   - Track failure counts
   - Implement alerting for circuit opening
   - Use health checks before critical operations

4. **Use interceptors for cross-cutting concerns**:
   - Authentication/authorization
   - Request/response logging
   - Metrics collection
   - Data transformation

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build library
npm run build

# Watch mode for development
npm run dev
```

## License

MIT © LabelMint Team