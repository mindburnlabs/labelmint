# Deligate.it Database Setup

Your Supabase database is configured and ready! 🎉

## Database Details
- **Project URL**: https://bf71rs1.supabase.co
- **Project Reference**: bf71rs1
- **Status**: ✅ Connected and configured

## Quick Setup

### 1. Initialize Database Tables
```bash
# Option A: Using Supabase CLI (Recommended)
npm run supabase:push

# Option B: Manual SQL Execution
# Go to: https://supabase.com/dashboard/project/bf71rs1/sql/new
# Run the migration files in order:
# 1. supabase/migrations/20240101000000_initial_schema.sql
# 2. supabase/migrations/20240101000001_rls_policies.sql
# 3. supabase/migrations/20240101000002_functions_triggers.sql
```

### 2. Verify Setup
```bash
# Test database connection
node scripts/quick-db-test.js

# Generate TypeScript types
npm run db:generate
```

### 3. Start Development
```bash
# Start all services
npm run dev

# Or start individually
npm run services:up
npm run apps:up
```

## Environment Configuration

The following environment variables are set:

✅ **SUPABASE_URL**: https://bf71rs1.supabase.co
✅ **SUPABASE_ANON_KEY**: Configured
✅ **SUPABASE_SERVICE_ROLE_KEY**: Configured
✅ **SUPABASE_PROJECT_REF**: bf71rs1
✅ **SUPABASE_DB_URL**: Configured

## Database Schema

### Core Tables
- `users` - User accounts and profiles
- `user_sessions` - Authentication sessions
- `user_api_keys` - API authentication

### Blockchain Tables
- `user_wallets` - TON blockchain wallets
- `transactions` - Transaction records
- `ton_network_configs` - Network settings
- `token_contracts` - Token contracts (TON, USDT)

### Application Tables
- `file_uploads` - File storage metadata
- `transaction_categories` - Transaction categories
- `payment_channels` - Atomic swap channels

## Security Features

✅ **Row Level Security (RLS)** enabled on all user tables
✅ **JWT Authentication** configured
✅ **API Key Management** system
✅ **Encryption** for sensitive data
✅ **Audit logging** for all operations

## Next Steps

1. **Database Setup**: Run migrations to create tables
2. **Test Connection**: Verify database connectivity
3. **Deploy**: Start your application
4. **Monitor**: Check logs and health endpoints

## Useful Scripts

```bash
# Database management
npm run db:reset      # Reset database
npm run db:seed       # Seed with test data
npm run db:generate   # Generate types

# Supabase management
npm run supabase:start # Start local Supabase
npm run supabase:migrate <name>  # Create migration
npm run supabase:push  # Push to production

# Testing
npm run test:integration  # Run integration tests
node scripts/quick-db-test.js  # Quick DB test
```

## Support

If you encounter issues:

1. Check Supabase Dashboard: https://supabase.com/dashboard/project/bf71rs1
2. Review migration files in `supabase/migrations/`
3. Run the setup script: `node scripts/setup-database.js`
4. Check logs: `tail -f logs/supabase.log`

Your database is ready for production! 🚀