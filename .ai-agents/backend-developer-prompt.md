# Backend Developer – LabelMint Project Tasks

## Project Status (October 2025)
- **Current State**: ✅ ~85% complete – core services are running with rich feature coverage.
- **Priority**: MEDIUM – unblock TON payout helpers and analytics placeholders, then harden enterprise metrics.
- **Estimated Focused Tasks**: ~8-12.
- **Last Audited**: October 24, 2025 (code inspection of `services/*` and shared packages).

## Verified Implementation Snapshot
- Enterprise API routes are active (`services/enterprise-api/src/routes/index.ts:4-42`) with organizations, teams, SSO, workflows, analytics, billing, integrations, and directory endpoints mounted.
- Multi-tenant storage quotas are implemented and cached (`services/enterprise-api/src/middleware/multiTenant.ts:223-331`).
- Payment backend exposes wallet + payment routes under `/api/payments` (`services/payment-backend/src/api/payments/index.ts:5-34`) and is wired through `app.ts`.
- Authentication, RBAC, audit logging, and SSO/LDAP services are implemented (`services/enterprise-api/src/services/SSOService.ts`, `DirectoryService.ts`).
- Rich background jobs, caching, monitoring, and metrics exist across services.

## Critical Tasks (Do These First)

1. **Finish TON payout verification helpers**  
   - File: `services/labeling-backend/src/services/tonPaymentService.optimized.ts:732-739`  
   - Status: `checkBlockchainTransaction` and `sendWithdrawalTransaction` still return `{ success: false, error: 'Not implemented' }`.  
   - Deliverable: Implement actual TON lookup + withdrawal execution using existing TON client utilities, log outcomes, and surface deterministic errors for retries.

2. **Replace enterprise analytics placeholders**  
   - File: `services/enterprise-api/src/controllers/AnalyticsController.ts:65-70`  
   - Status: Task/project/workflow statistics are hard-coded to zero; needs aggregation from real tables.  
   - Deliverable: Query task execution data (labeling backend tables) and workflow execution history, cache results, and maintain existing response structure.

3. **Expose real directory metrics**  
   - File: `services/enterprise-api/src/controllers/DirectoryController.ts:147-170`  
   - Status: `getUserCount` returns `0` regardless of synced users.  
   - Deliverable: Query `directoryUser`/`organizationMember` data, include last sync timestamp, and add coverage in tests.

4. **Wire frontend API bootstrap support** (backend side)  
   - Files: `services/payment-backend/src/app.ts`, `services/api-gateway`  
   - Need: ensure CORS + auth middleware settings align with upcoming frontend calls and document required headers so `initializeApiService` can succeed.

## High-Priority Follow-Ups

5. **NotificationService – Telegram channel integration**  
   - File: `services/payment-backend/src/services/notifications/NotificationService.ts:200-233`  
   - Task: Replace log placeholder with real Telegram bot call (shared secrets already supported). Provide retries and failure alerts.

6. **Enterprise documentation endpoint**  
   - File: `services/enterprise-api/src/routes/index.ts:34-41` (`documentation: ${basePath}/docs // TODO`)  
   - Task: Serve generated OpenAPI docs or proxy to documentation service.

7. **Workflow template review loading**  
   - File: `services/enterprise-api/src/services/WorkflowService.ts:570-579` (`reviews: [] // TODO`)  
   - Task: Join review records, return counts/ratings, and update API docs.

## Medium Priority / Polish

- **Analytics caching strategy**: ensure invalidation when new data arrives; add metrics instrumentation.  
- **Rate limiting + auth middleware**: replace placeholder auth in `services/payment-backend/src/app.ts` with JWT verification shared across services.  
- **OpenAPI/Swagger generation**: produce specs for enterprise + payment APIs and publish via docs endpoint.  
- **General performance review**: profile heavy queries (analytics, workflow, TON history) and add indexes where needed.

## Coordination Notes
- **Blockchain Dev**: align on payout helper implementation and contract expectations.  
- **Frontend Dev**: provide the exact headers/base URLs required for `initializeApiService` and wallet endpoints.  
- **Testing Engineer**: add integration tests once payout helpers & analytics metrics are implemented.  
- **DevOps**: confirm monitoring captures new payout/analytics metrics.

## Deliverables
1. TON payout helper methods returning real results with logging + error handling.  
2. Enterprise analytics endpoints providing accurate counts.  
3. Directory metrics endpoints reporting live data.  
4. NotificationService capable of email + Telegram alerts.  
5. Documentation endpoints serving up-to-date API specs.

## Success Criteria
- ✅ `checkBlockchainTransaction`/`sendWithdrawalTransaction` return success data and pass integration tests.  
- ✅ Analytics endpoints populated with real counts (validated via tests + dashboards).  
- ✅ Directory metrics reflect synced users/groups.  
- ✅ NotificationService sends alerts across configured channels.  
- ✅ API documentation accessible via `/enterprise/docs` (or equivalent).

## Working Guidelines
- Keep changes TypeScript-first with strong typing and Prisma safety checks.  
- Ensure new queries are covered by automated tests (`tests/integration`, `tests/e2e`).  
- Use caching + retries judiciously to avoid hammering TON/node resources.  
- Document new environment variables and config changes.
