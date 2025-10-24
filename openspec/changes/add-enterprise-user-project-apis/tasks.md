## 1. Enterprise User APIs
- [ ] Scaffold controllers, services, validators, and router for organization-scoped user lifecycle endpoints.
- [ ] Enforce RBAC and membership checks aligned with organization permissions and emit audit events.
- [ ] Implement analytics endpoints for user activity, including pagination, filters, and summary metrics.
- [ ] Add unit/integration tests covering happy paths, permission failures, and validation errors.

## 2. Enterprise Project APIs
- [ ] Implement project CRUD routes with workflow linkage, membership assignment, and project-level analytics.
- [ ] Wire project membership management (invite/remove/update roles) and ensure tenant isolation middleware is used.
- [ ] Cover project routes with automated tests (CRUD, membership, analytics, pagination).

## 3. Route Registration & Docs
- [ ] Mount the new routers in `routes/index.ts` and update API documentation helpers/openapi generator to list endpoints.
- [ ] Extend audit logging and rate limiting middleware where necessary for the new resource paths.

## 4. Storage Usage Enforcement
- [ ] Implement storage usage aggregation in `multiTenant.ts` by summing dataset assets, attachments, and exports per organization.
- [ ] Add a caching strategy (Redis) to reduce expensive recalculations and include tests for limit enforcement.
- [ ] Update subscription usage reporting to surface the new storage figures.

## 5. Validation
- [ ] Run `openspec validate add-enterprise-user-project-apis --strict` and address any reported issues before requesting review.
