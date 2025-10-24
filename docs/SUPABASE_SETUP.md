# Supabase Database Setup Guide

This guide explains how to set up and manage the Deligate.it database using Supabase.

## Prerequisites

1. **Install Supabase CLI**
   ```bash
   # macOS
   brew install supabase/tap/supabase

   # Other platforms
   # Visit: https://supabase.com/docs/guides/cli
   ```

2. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project reference and API keys

## Environment Configuration

Add the following to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_DB_URL=postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres
```

## Quick Start

### 1. Initialize Project

```bash
# Initialize Supabase locally
npm run supabase:init

# Or using the script directly
./scripts/supabase-setup.sh init
```

### 2. Start Local Development

```bash
# Start local Supabase
npm run supabase:start

# Or using the script
./scripts/supabase-setup.sh start
```

This starts:
- PostgreSQL database on port 54322
- API server on port 54321
- Studio on port 54323

### 3. Apply Database Migrations

```bash
# Reset database and apply all migrations
npm run db:reset

# Or apply migrations individually
npm run db:push
```

### 4. Generate TypeScript Types

```bash
# Generate database types
npm run db:generate

# Or using script
npm run supabase:types
```

## Database Management

### Creating Migrations

```bash
# Create a new migration
npm run supabase:migrate [migration_name]

# Example
npm run supabase:migrate add_user_preferences
```

### Pushing to Production

```bash
# WARNING: This pushes to production!
npm run supabase:push

# Or with confirmation
./scripts/supabase-setup.sh push
```

### Pulling Remote Schema

```bash
# Pull latest schema from remote
./scripts/supabase-setup.sh pull
```

### Database Seeding

```bash
# Seed local database with test data
npm run db:seed
```

## Script Commands

### Using supabase-setup.sh

```bash
# Initialize project
./scripts/supabase-setup.sh init

# Start/stop local
./scripts/supabase-setup.sh start
./scripts/supabase-setup.sh stop

# Migration management
./scripts/supabase-setup.sh migrate [name]
./scripts/supabase-setup.sh push
./scripts/supabase-setup.sh pull

# Utility commands
./scripts/supabase-setup.sh status
./scripts/supabase-setup.sh seed
./scripts/supabase-setup.sh backup [filename]
./scripts/supabase-setup.sh restore [filename]
```

### Using Node.js Script

```bash
# More advanced management
node scripts/supabase-remote-management.js [command]

# Available commands:
# init, start, stop, migrate, apply, push, pull, types, seed, backup, restore, status, branch, sync
```

## Database Schema

The database includes these main tables:

### Core Tables
- `users` - User accounts and profiles
- `user_sessions` - Authentication sessions
- `user_api_keys` - API authentication keys

### Blockchain Tables
- `user_wallets` - TON wallet information
- `transactions` - Transaction records
- `ton_network_configs` - Network configurations
- `token_contracts` - Token contract addresses

### Application Tables
- `file_uploads` - File storage metadata
- `transaction_categories` - Transaction categorization
- `storage_configs` - Storage configuration

## Row Level Security (RLS)

All user data is protected with RLS policies:
- Users can only access their own data
- Service role has full access
- Public files can be accessed by anyone

## Real-time Subscriptions

The application uses Supabase real-time for:

```typescript
// Subscribe to wallet updates
const subscription = supabaseService.subscribeToWalletUpdates(
  walletId,
  (payload) => {
    console.log('Wallet updated:', payload);
  }
);

// Subscribe to transactions
const txSubscription = supabaseService.subscribeToTransactions(
  walletIds,
  (payload) => {
    console.log('New transaction:', payload);
  }
);
```

## Functions and Stored Procedures

The database includes these helper functions:

### User Management
- `create_user_with_profile()` - Create user with validation
- `cleanup_old_sessions()` - Remove expired sessions

### Wallet Management
- `create_user_wallet()` - Create wallet for user
- `update_wallet_balance()` - Update wallet balance
- `get_wallet_statistics()` - Get wallet stats

### Transaction Management
- `record_transaction()` - Record new transaction
- `validate_transaction()` - Validate transaction
- `get_user_transactions()` - Get user transaction history

## Development Workflow

### 1. Local Development
```bash
# Start local Supabase
npm run supabase:start

# Generate types
npm run db:generate

# Run migrations
npm run db:reset

# Seed data
npm run db:seed

# Start application
npm run dev
```

### 2. Making Changes
```bash
# 1. Make schema changes in Supabase Studio
# 2. Generate migration
npm run supabase:migrate describe_changes

# 3. Test locally
npm run db:reset

# 4. Push to production when ready
npm run supabase:push
```

### 3. CI/CD Integration

The GitHub Actions workflow automatically:
- Starts local Supabase for tests
- Runs integration tests
- Pushes migrations to production
- Deploys application

## Troubleshooting

### Port Conflicts
If ports are already in use:
```bash
# Stop existing services
npm run supabase:stop

# Or use different ports
supabase start --db-port 54323 --api-port 54322 --studio-port 54324
```

### Migration Issues
If migrations fail:
```bash
# Reset to clean state
npm run db:reset

# Or check migration status
supabase migration list
```

### Permission Errors
Ensure you have the correct permissions:
```bash
# Check current user
whoami

# Fix permissions if needed
sudo chown -R $(whoami) ./supabase
```

## Best Practices

1. **Always test migrations locally** before pushing to production
2. **Use TypeScript types** generated from database schema
3. **Implement RLS policies** for all user data
4. **Use stored procedures** for complex operations
5. **Monitor performance** with Supabase dashboard
6. **Regular backups** using the backup script
7. **Keep secrets secure** - never commit API keys

## Monitoring

### Health Check
```bash
# Check Supabase status
./scripts/supabase-setup.sh status

# Check application health
curl http://localhost:3000/health
```

### Logs
```bash
# View Supabase logs
supabase logs

# View application logs
tail -f logs/app.log
```

## Production Deployment

1. **Configure Environment Variables**
   - Set all required Supabase variables
   - Update production secrets

2. **Run Migrations**
   ```bash
   npm run supabase:push
   ```

3. **Deploy Application**
   - The CI/CD pipeline handles deployment
   - Or use the deployment script

4. **Verify Deployment**
   ```bash
   # Check health
   curl https://your-domain.com/health

   # Run smoke tests
   npm run test:e2e
   ```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [TON Documentation](https://docs.ton.org/)
- [Database Schema Reference](./DATABASE_SCHEMA.md)
- [API Documentation](./API.md)