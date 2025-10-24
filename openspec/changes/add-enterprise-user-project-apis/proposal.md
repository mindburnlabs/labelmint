## Why
- Critical enterprise API routes for managing users and projects are missing, blocking enterprise onboarding and preventing frontend teams from integrating the admin console.
- Subscription enforcement cannot audit storage consumption today, so tenant limits are ineffective and overages go unbilled.
- Commented route registrations and incomplete middleware create drift between documented and actual platform capabilities.

## What Changes
- Deliver user management APIs that cover lifecycle operations (invite, activate/deactivate, role updates, activity metrics) with RBAC checks and audit logging.
- Deliver project management APIs that support CRUD, membership management, workflow linkage, and analytics snapshots scoped to an organization.
- Wire new route modules into the enterprise API router and expose them via OpenAPI metadata so clients can discover the endpoints.
- Extend multi-tenant middleware to calculate real storage usage by aggregating project artifact sizes (datasets, attachments, exports) and surface the value for downstream limit checks.
- Add automated tests for the new endpoints, permission guards, and subscription enforcement to prevent regressions.

## Impact
- Enables enterprise customers to self-serve user and project administration via API instead of manual database changes.
- Restores consistency between documented subscription limits and runtime enforcement by reporting accurate storage usage.
- Introduces additional Prisma queries and cross-service lookups; we must monitor query plans and cache heavy aggregations where necessary.
- No breaking changes to existing endpoints, but tenants will now be blocked once they reach storage quotas.
