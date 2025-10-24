# Environment Configuration

This directory contains centralized environment configuration for the LabelMint platform.

## Files Overview

- `.env.development` - Development environment configuration
- `.env.production` - Production environment configuration (uses variable substitution)
- `.env.testing` - Testing environment configuration
- `load-env.sh` - Script to load environment configurations

## Usage

### Loading Environment Configuration

Use the provided script to load environment-specific configuration:

```bash
# Load development environment
./config/environment/load-env.sh development

# Load production environment
./config/environment/load-env.sh production

# Load testing environment
./config/environment/load-env.sh testing
```

### Exporting to Current Shell

To export environment variables to your current shell session:

```bash
source config/environment/load-env.sh development
```

### Using in Scripts

Source the environment loader in your scripts:

```bash
#!/bin/bash
source "$(dirname "$0")/../config/environment/load-env.sh" production

# Now all environment variables are available
echo "Database: $DATABASE_URL"
echo "Redis: $REDIS_URL"
```

## Environment Variables

### Core Application Variables

- `NODE_ENV` - Node.js environment (development/production/test)
- `ENVIRONMENT` - Application environment name
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `APP_VERSION` - Application version
- `BUILD_DATE` - Build timestamp
- `GIT_BRANCH` - Git branch name
- `GIT_SHA` - Git commit SHA

### Database Configuration

- `POSTGRES_DB` - PostgreSQL database name
- `POSTGRES_USER` - PostgreSQL username
- `POSTGRES_PASSWORD` - PostgreSQL password
- `POSTGRES_PORT` - PostgreSQL port
- `DATABASE_URL` - Full database connection string

### Redis Configuration

- `REDIS_PASSWORD` - Redis password
- `REDIS_PORT` - Redis port
- `REDIS_BOTS_PORT` - Redis port for bot services
- `REDIS_URL` - Redis connection string
- `REDIS_BOTS_URL` - Redis connection string for bots

### Authentication & Security

- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - JWT token expiration
- `SESSION_SECRET` - Session signing secret
- `BCRYPT_ROUNDS` - bcrypt hashing rounds

### TON Blockchain Configuration

- `TON_API_KEY` - TON API key
- `TON_RPC_ENDPOINT` - TON RPC endpoint
- `TON_MERCHANT_ADDRESS` - TON merchant address
- `USDT_MASTER_CONTRACT` - USDT contract address

### Telegram Bot Configuration

- `TELEGRAM_BOT_TOKEN_CLIENT` - Client bot token
- `TELEGRAM_BOT_TOKEN_WORKER` - Worker bot token
- `CLIENT_BOT_TOKEN` - Client bot token (alias)
- `WORKER_BOT_TOKEN` - Worker bot token (alias)

### Application URLs

- `WEB_APP_URL` - Main web application URL
- `NEXT_PUBLIC_API_URL` - Public API URL
- `NEXT_PUBLIC_WS_URL` - WebSocket URL
- `LABELING_API_URL` - Labeling API URL
- `PAYMENT_API_URL` - Payment API URL

### Service Ports

- `WEB_PORT` - Web application port
- `API_GATEWAY_PORT` - API Gateway port
- `LABELING_BACKEND_PORT` - Labeling backend port
- `PAYMENT_BACKEND_PORT` - Payment backend port
- `CLIENT_BOT_PORT` - Client bot port
- `WORKER_BOT_PORT` - Worker bot port

### Storage Configuration (MinIO/S3)

- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `MINIO_ENDPOINT` - MinIO endpoint
- `MINIO_REGION` - Storage region
- `MINIO_BUCKET` - Storage bucket name

### Monitoring Configuration

- `PROMETHEUS_PORT` - Prometheus port
- `GRAFANA_PORT` - Grafana port
- `GRAFANA_USER` - Grafana username
- `GRAFANA_PASSWORD` - Grafana password
- `LOKI_PORT` - Loki port
- `TEMPO_PORT` - Tempo port

## Security Guidelines

### Development Environment

- Use weak, easy-to-remember passwords for local development
- Enable debug tools and verbose logging
- Use testnet/sandbox for external services

### Production Environment

- Use strong, unique passwords for all services
- Enable all security features
- Use production endpoints for external services
- Monitor and audit all access
- Regularly rotate secrets

### Testing Environment

- Use predictable, test-friendly values
- Disable unnecessary services
- Use mock services when possible
- Clean up test data after runs

## Environment-Specific Notes

### Development

- Debug tools are enabled
- Verbose logging
- Hot reload enabled
- Source maps enabled
- Local services only

### Production

- Optimized for performance
- Security features enabled
- Monitoring and alerting enabled
- SSL/TLS required
- External service integrations

### Testing

- Minimal logging to reduce noise
- Mock services preferred
- Predictable test data
- Isolated test databases
- Automated cleanup

## Migration from Old Configuration

This centralized configuration replaces scattered environment variables in:

- ❌ Individual scripts with hardcoded values
- ❌ Multiple .env files across the repository
- ❌ Docker compose files with embedded variables
- ❌ Service-specific configuration files

Update your deployment scripts to use the centralized configuration:

```bash
# Before
export POSTGRES_PASSWORD=old_password
export REDIS_PASSWORD=old_redis_password

# After
source config/environment/load-env.sh production
```

## Troubleshooting

### Missing Variables

If required variables are missing, the loader will display a warning:

```bash
⚠️  Warning: Missing required environment variables:
  - TON_API_KEY
  - TELEGRAM_BOT_TOKEN_CLIENT
```

### Invalid Environment

The script validates the environment name:

```bash
Error: Invalid environment 'staging'
Valid environments: development, production, testing
```

### File Not Found

If the environment file doesn't exist:

```bash
Error: Environment file not found: config/environment/.env.staging
```

## Best Practices

1. **Never commit actual secrets** to version control
2. **Use different values** for each environment
3. **Rotate secrets regularly** in production
4. **Document variable requirements** for each service
5. **Test configuration changes** in development first
6. **Use environment variable substitution** in production
7. **Implement validation** for required variables
8. **Monitor configuration changes** and their impact