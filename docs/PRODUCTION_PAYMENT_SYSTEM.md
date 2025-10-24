# Production Payment System Deployment Guide

This document provides comprehensive instructions for deploying the production-ready TON payment system with monitoring, fee optimization, and backup payment methods.

## Overview

The production payment system includes:

1. **Mainnet TON Integration** - Real fund transactions on TON blockchain
2. **Payment Monitoring** - Real-time failure detection and alerting
3. **Automatic Fee Optimization** - Dynamic gas fee adjustment based on network conditions
4. **Admin Analytics Dashboard** - Comprehensive payment analytics and management
5. **Backup Payment Methods** - Fallback options (Stripe, PayPal, Bank Transfer)

## Prerequisites

### Required Environment Variables

```bash
# TON Configuration
TON_API_KEY=your_toncenter_api_key
TON_MASTER_KEY=encrypted_master_wallet_key
PAYMENT_PROCESSOR_ADDRESS=your_payment_processor_contract

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379

# Security
JWT_SECRET=your_jwt_secret
API_KEYS=encrypted_api_keys

# Backup Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_secret

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PAYMENT_ALERT_EMAIL=alerts@yourcompany.com

# AWS Configuration
AWS_REGION=us-east-1
SSL_CERTIFICATE_ARN=arn:aws:acm:...
```

### System Requirements

- **Node.js** 18+
- **Docker** & Docker Compose
- **AWS CLI** configured
- **Terraform** 1.5+
- **PostgreSQL** 14+
- **Redis** 6+

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│   Load Balancer  │───▶│  API Gateway    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐             │
                       │ Admin Dashboard │◄────────────┤
                       └─────────────────┘             │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Monitoring     │◄───│  Payment Service │───▶│   TON Mainnet   │
│   Service       │    │   (ECS/Fargate)  │    │   Network       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudWatch    │◄───│   Fee Optimizer  │◄───│  Gas Price API  │
│   Alarms        │    │     Service      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌──────────────────┐
│   Backup        │◄───│  Backup Payment  │
│   Methods       │    │     Service      │
│ (Stripe,PayPal) │    │                 │
└─────────────────┘    └──────────────────┘
```

## Deployment Steps

### 1. Prepare for Deployment

```bash
# Clone the repository
git clone <repository-url>
cd labelmint.it

# Install dependencies
npm install

# Copy environment templates
cp .env.example .env.production
# Fill in all required variables
```

### 2. Test on Testnet First

```bash
# Deploy to testnet for testing
npm run deploy:testnet

# Run payment tests
npm run test:payments

# Verify all transactions work correctly
npm run verify:testnet-payments
```

### 3. Deploy to Production

Run the deployment script:

```bash
# Make the script executable
chmod +x scripts/deploy-mainnet-payments.sh

# Run deployment (requires confirmation)
./scripts/deploy-mainnet-payments.sh
```

The script will:
1. Verify all prerequisites
2. Build and push Docker images
3. Deploy infrastructure via Terraform
4. Configure mainnet settings
5. Setup monitoring and alerts
6. Run health checks

### 4. Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# 1. Deploy infrastructure
cd infrastructure/terraform
terraform init
terraform plan -var-file="variables.tfvars" -var-file="variables-payments.tfvars"
terraform apply

# 2. Build and deploy services
cd ../..
npm run build:production
docker build -f backend/Dockerfile.payments -t labelmint/payments:latest backend/

# 3. Update ECS service
aws ecs update-service --cluster labelmint-production --service labelmint-payments-service --force-new-deployment
```

## Configuration

### Mainnet Configuration

Edit `backend/src/config/ton-mainnet.ts` to adjust:

- **Gas limits** - Maximum fees per transaction
- **Transaction limits** - Min/max amounts
- **Monitoring thresholds** - Alert triggers
- **Security settings** - Multi-sig requirements

### Monitoring Configuration

The monitoring system tracks:

1. **Transaction Success Rate** - Alerts if < 95%
2. **Pending Transactions** - Alerts if > 100
3. **Gas Prices** - Alerts if unusually high
4. **Failed Transactions** - Tracks error patterns
5. **Suspicious Activity** - Multiple failed attempts

### Fee Optimization

Automatic optimization adjusts fees based on:

- Network congestion (0-100%)
- Target confirmation time
- Transaction priority
- Historical fee data

## Security Considerations

### 1. Multi-Signature Requirements

- Transactions > 1M USDT require multi-sig
- Daily volume limit: 10M USDT
- Suspicious activity triggers after 10 failures

### 2. Key Management

- Master wallet key encrypted at rest
- API keys stored in AWS Secrets Manager
- Regular key rotation recommended

### 3. Monitoring

- Real-time alerts for anomalies
- Daily security audit cron job
- Transaction pattern analysis

## Backup Payment Methods

The system automatically falls back to backup methods when:

1. TON network is congested
2. Gas prices exceed threshold
3. Transaction fails after retries

### Supported Methods

1. **Stripe** (Priority 1)
   - Fee: 2.9% + $0.30
   - Max: $100,000
   - Instant processing

2. **PayPal** (Priority 2)
   - Fee: 2.9% + $0.30
   - Max: $100,000
   - International: +0.5%

3. **Bank Transfer** (Priority 3)
   - Fee: $5 flat
   - Max: $1,000,000
   - 1-3 business days

## Monitoring and Alerting

### CloudWatch Metrics

- `Deligate/Payments/TransactionCount`
- `Deligate/Payments/SuccessRate`
- `Deligate/Payments/PendingTransactions`
- `Deligate/Payments/TotalVolume`
- `Deligate/Payments/GasPrice`

### Alert Channels

1. **Email** - Immediate alerts
2. **Slack** - Real-time notifications
3. **PagerDuty** - Critical incidents

### Dashboard Access

The admin dashboard provides:

- Real-time payment metrics
- Transaction history
- Error analysis
- Fee optimization status
- Backup payment tracking

Access at: `https://admin.yourdomain.com/payments`

## Maintenance

### Daily Tasks

1. Review payment metrics
2. Check alert notifications
3. Monitor gas price trends
4. Verify backup payments

### Weekly Tasks

1. Audit large transactions
2. Review security logs
3. Update fee optimization parameters
4. Test backup payment methods

### Monthly Tasks

1. Rotate API keys
2. Update dependencies
3. Review monitoring thresholds
4. Generate compliance reports

## Troubleshooting

### Common Issues

#### 1. High Transaction Failure Rate

**Symptoms:**
- Success rate < 95%
- Many timeout errors

**Solutions:**
1. Check TON network status
2. Verify gas price settings
3. Review fee optimization logs
4. Consider enabling backup payments

#### 2. Stuck Transactions

**Symptoms:**
- Transactions pending > 3 minutes
- No confirmation received

**Solutions:**
1. Check transaction on TON explorer
2. Verify gas fee was sufficient
3. Check network congestion
4. Use admin panel to retry/cancel

#### 3. Backup Payment Failures

**Symptoms:**
- Stripe/PayPal returns errors
- Users not redirected properly

**Solutions:**
1. Verify API keys are valid
2. Check webhook endpoints
3. Review payment method configuration
4. Test with small amounts

### Emergency Procedures

#### 1. Network Congestion

If TON network is severely congested:

1. Increase failure threshold in monitoring
2. Lower priority fee multiplier
3. Enable automatic backup payments
4. Notify users of delays

#### 2. Security Incident

If suspicious activity detected:

1. Immediately pause payments
2. Rotate all API keys
3. Review audit logs
4. Report to security team

#### 3. Service Outage

If payment service is down:

1. Check ECS service status
2. Review CloudWatch logs
3. Trigger manual rollback if needed
4. Enable maintenance mode

## Rollback

To rollback to previous version:

```bash
# Run rollback script
./scripts/rollback-mainnet.sh

# Or manually
aws ecs update-service \
  --cluster labelmint-production \
  --service labelmint-payments-service \
  --task-definition <previous-task-definition-arn>
```

## Support

For production issues:

1. **Emergency**: PagerDuty alert
2. **Urgent**: Slack #production-alerts
3. **Normal**: Create GitHub issue
4. **Documentation**: Check this guide first

## Compliance

The system maintains:

- **Audit Trail** - All transactions logged
- **AML/KYC** - Integration available
- **Data Retention** - 7 years default
- **GDPR** - User data protection
- **SOC2** - Security controls in place

## Performance Benchmarks

### Target Metrics

- **Transaction Success Rate**: > 99%
- **Average Confirmation Time**: < 60 seconds
- **API Response Time**: < 200ms
- **System Uptime**: > 99.9%

### Scaling

The system auto-scales based on:

- CPU utilization (> 70% scale up)
- Pending transactions (> 50 scale up)
- Memory usage (> 80% scale up)

Maximum capacity: 10 ECS tasks

---

⚠️ **Important**: This is a production system handling real funds. Always test thoroughly on testnet before deploying to mainnet. Monitor the system closely for the first 24 hours after deployment.