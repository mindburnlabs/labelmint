# LabelMint ML Engine

A comprehensive machine learning engine for fraud detection, anomaly monitoring, and predictive analytics integrated into the LabelMint data labeling platform.

## Overview

The ML Engine provides real-time fraud detection, user behavior analysis, anomaly detection, and predictive analytics capabilities specifically designed for LabelMint's blockchain-powered payment system and data labeling workflows.

## Core Features

### 🔍 **Fraud Detection System**
- Real-time transaction fraud scoring with neural network models
- Multi-dimensional risk analysis (transaction patterns, behavioral anomalies, geographic analysis)
- Configurable risk thresholds and alerting
- Cached scoring for optimal performance

### 📊 **Predictive Analytics**
- **Churn Prediction**: Identify users at risk of leaving the platform
- **Revenue Forecasting**: Predict future revenue streams
- **Quality Prediction**: Estimate task quality and outcomes
- Batch processing capabilities for large-scale predictions

### 🚨 **Anomaly Detection**
- User behavior anomaly detection using Isolation Forest
- Transaction pattern monitoring with statistical methods
- System performance anomaly detection
- Real-time alerting and investigation workflows

### 📈 **Model Monitoring**
- Performance tracking and drift detection
- Automated model retraining based on performance degradation
- Comprehensive alerting system
- Model health dashboards

### 🗄️ **Feature Store**
- Centralized feature storage and retrieval
- Real-time and batch feature updates
- Feature drift analysis
- Optimized caching for ML workloads

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ML Engine API                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Fraud     │  │ Predictive  │  │    Anomaly          │   │
│  │ Detection   │  │ Analytics   │  │    Detection        │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                 Model Monitoring Service                      │
├─────────────────────────────────────────────────────────────┤
│                    Feature Store                             │
├─────────────────────────────────────────────────────────────┤
│  Redis Cache    │   PostgreSQL    │   TensorFlow/ML     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
# Navigate to the ML engine directory
cd services/ml-engine

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Start the ML engine
pnpm run dev
```

### Environment Configuration

Create a `.env` file with the following configuration:

```bash
# Database Configuration
ML_DB_HOST=localhost
ML_DB_PORT=5432
ML_DB_NAME=labelmint_ml
ML_DB_USER=postgres
ML_DB_PASSWORD=your_password

# Redis Configuration
ML_REDIS_HOST=localhost
ML_REDIS_PORT=6379
ML_REDIS_PASSWORD=your_redis_password

# API Configuration
ML_API_PORT=3003
ML_API_HOST=0.0.0.0
ML_JWT_SECRET=your_jwt_secret_here

# Model Storage
ML_MODEL_STORAGE_TYPE=local
ML_MODEL_STORAGE_PATH=./models

# TensorFlow Configuration
ML_TF_BACKEND=tensorflow
ML_TF_GPU_MEMORY_FRACTION=0.8
```

### Running the Services

```bash
# Start all ML services
pnpm run start

# Start individual services
pnpm run start:fraud-detection
pnpm run start:predictive-analytics
pnpm run start:anomaly-detection
pnpm run start:monitoring

# Run tests
pnpm run test
pnpm run test:coverage
```

## API Documentation

### Fraud Detection Endpoints

#### Score a Transaction
```http
POST /api/v1/fraud-detection/score
Content-Type: application/json

{
  "transaction_id": "tx_123456",
  "user_id": "user_789",
  "transaction_data": {
    "amount": 1000,
    "currency": "USDT",
    "wallet_address": "EQD...",
    "hour_of_day": 14,
    "device_risk_score": 0.3,
    "ip_risk_score": 0.2
  },
  "user_data": {
    "account_age_days": 60,
    "transaction_count": 25,
    "avg_transaction_amount": 500
  }
}
```

#### Batch Score Transactions
```http
POST /api/v1/fraud-detection/batch-score
Content-Type: application/json

{
  "transactions": [
    {
      "transaction_id": "tx_1",
      "user_id": "user_1",
      "transaction_data": { ... }
    },
    {
      "transaction_id": "tx_2",
      "user_id": "user_2",
      "transaction_data": { ... }
    }
  ]
}
```

### Predictive Analytics Endpoints

#### Make Prediction
```http
POST /api/v1/predictive-analytics/predict
Content-Type: application/json

{
  "model_type": "churn",
  "entity_id": "user_123",
  "entity_type": "user",
  "features": {
    "account_age_days": 60,
    "login_frequency_24h": 5,
    "task_completion_rate": 0.85,
    "total_earned": 2500
  },
  "include_feature_importance": true
}
```

#### Batch Predictions
```http
POST /api/v1/predictive-analytics/batch-predict
Content-Type: application/json

{
  "model_type": "churn",
  "entity_ids": ["user_1", "user_2", "user_3"],
  "priority": "normal"
}
```

### Anomaly Detection Endpoints

#### Analyze User Behavior
```http
POST /api/v1/anomaly-detection/analyze-user
Content-Type: application/json

{
  "userId": "user_123",
  "features": {
    "account_age_days": 60,
    "login_frequency_24h": 5,
    "task_completion_rate": 0.85,
    "total_earned": 2500,
    "rejection_rate": 0.05
  }
}
```

## Model Training

### Train Fraud Detection Model
```bash
# Train with default configuration
pnpm run train:fraud

# Train with custom data
tsx src/scripts/train-fraud-models.ts --data-path ./data/fraud_training.csv
```

### Train Predictive Models
```bash
# Train churn prediction model
pnpm run train:churn

# Train revenue prediction model
pnpm run train:revenue

# Train quality prediction model
pnpm run train:quality
```

### Deploy Models
```bash
# Deploy all trained models
pnpm run deploy:models

# Deploy specific model
tsx src/scripts/deploy-models.ts --model fraud-detection --version v1.2.0
```

## Configuration

### Fraud Detection Configuration
```typescript
{
  fraudDetection: {
    enabled: true,
    modelPath: './models/fraud',
    threshold: 0.7,
    realtimeScoring: true,
    batchSize: 100,
    alertThresholds: {
      medium: 50,
      high: 70,
      critical: 90
    }
  }
}
```

### Predictive Analytics Configuration
```typescript
{
  prediction: {
    enabled: true,
    models: {
      churn: {
        enabled: true,
        horizonDays: 30,
        updateFrequency: 'daily',
        features: ['account_age_days', 'login_frequency', 'task_completion_rate']
      },
      revenue: {
        enabled: true,
        horizonDays: 90,
        updateFrequency: 'weekly'
      }
    }
  }
}
```

## Monitoring and Observability

### Health Checks
```bash
# Overall service health
curl http://localhost:3003/health

# Individual service health
curl http://localhost:3003/api/v1/fraud-detection/health
curl http://localhost:3003/api/v1/predictive-analytics/health
curl http://localhost:3003/api/v1/anomaly-detection/health
```

### Model Statistics
```bash
# Get fraud detection model stats
curl http://localhost:3003/api/v1/fraud-detection/stats

# Get predictive analytics models
curl http://localhost:3003/api/v1/predictive-analytics/models

# Get anomaly detection models
curl http://localhost:3003/api/v1/anomaly-detection/models
```

### Monitoring Dashboard
Access the monitoring dashboard at:
- Grafana Dashboard: `http://localhost:3001` (if configured)
- Prometheus Metrics: `http://localhost:9090/metrics`

## Testing

### Run All Tests
```bash
# Run unit tests
pnpm run test

# Run integration tests
pnpm run test:integration

# Run tests with coverage
pnpm run test:coverage

# Run specific test files
pnpm run test fraud-detection
pnpm run test predictive-analytics
pnpm run test anomaly-detection
pnpm run test integration
```

### Test Coverage Reports
Coverage reports are generated in `./coverage/` and include:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

## Performance

### Benchmarks
- **Fraud Scoring**: <100ms average latency
- **Predictions**: <50ms average latency
- **Anomaly Detection**: <75ms average latency
- **Throughput**: 10,000+ concurrent predictions
- **Cache Hit Rate**: >90% for frequent requests

### Scaling
- **Horizontal Scaling**: Multiple API instances with load balancing
- **Model Scaling**: A/B testing and gradual rollout
- **Data Scaling**: Redis clustering and database sharding support

## Security

### Authentication
- JWT-based authentication with configurable expiry
- API key authentication for service-to-service communication
- Rate limiting and DDoS protection

### Data Protection
- Encrypted model storage
- Secure feature store access
- Audit logging for all predictions

### Model Security
- Model versioning and rollback capabilities
- Input validation and sanitization
- Adversarial attack detection

## Deployment

### Docker Deployment
```bash
# Build Docker image
docker build -t labelmint/ml-engine .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f ml-engine
```

### Kubernetes Deployment
```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=ml-engine

# Scale deployment
kubectl scale deployment ml-engine --replicas=3
```

## Troubleshooting

### Common Issues

#### Model Training Fails
```bash
# Check training logs
pnpm run train:fraud --verbose

# Validate data format
tsx src/scripts/validate-training-data.ts

# Check system resources
free -h && nvidia-smi
```

#### High Latency
```bash
# Check model performance
curl http://localhost:3003/api/v1/fraud-detection/stats

# Monitor system resources
top -p $(pgrep ml-engine)

# Check Redis cache
redis-cli info memory
```

#### Memory Issues
```bash
# Check memory usage
curl http://localhost:3003/health

# Monitor TensorFlow memory
python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"

# Clear caches
curl -X POST http://localhost:3003/api/v1/admin/clear-cache
```

### Debug Mode
Enable debug logging:
```bash
DEBUG=ml-engine:* pnpm run dev
```

## Contributing

### Development Workflow
1. Create feature branch from `develop`
2. Implement changes with tests
3. Run `pnpm run lint` and `pnpm run type-check`
4. Submit PR with comprehensive description

### Code Standards
- TypeScript with strict type checking
- ESLint and Prettier formatting
- Comprehensive test coverage (>90%)
- Documentation for all public APIs

### Testing Requirements
- Unit tests for all models and services
- Integration tests for API endpoints
- Performance tests for latency benchmarks
- Security tests for authentication and validation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [Internal Wiki](https://wiki.labelmint.it/ml-engine)
- Issues: [GitHub Issues](https://github.com/labelmint/ml-engine/issues)
- Slack: `#ml-engine` channel
- Email: ml-engine@labelmint.it

## Changelog

### v1.0.0 (2024-01-26)
- Initial release with fraud detection, predictive analytics, and anomaly detection
- RESTful API with comprehensive endpoints
- Real-time model monitoring and drift detection
- Feature store with caching capabilities
- Comprehensive test suite and documentation