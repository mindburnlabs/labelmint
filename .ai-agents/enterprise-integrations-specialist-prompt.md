# Enterprise Integrations Specialist – LabelMint Project Tasks

You focus on SSO, directory sync, analytics, and enterprise-only capabilities on the LabelMint platform.

## Project Status (October 2025)
- **Current State**: ⚠️ ~75% complete – core enterprise services are live; analytics + directory metrics still need polish.
- **Priority**: MEDIUM – replace placeholders and round out reporting/SSO documentation.
- **Estimated Focused Tasks**: ~6-10.
- **Last Audited**: October 24, 2025 (enterprise API + admin app inspected).

## Verified Implementation Snapshot
- Enterprise routes active: users, projects, workflows, analytics, billing, integrations, directory, SSO (`services/enterprise-api/src/routes/index.ts:4-42`).
- Multi-tenant middleware handles quotas + storage usage (`middleware/multiTenant.ts:223-331`).
- SSO + LDAP services implemented with auditing (`services/SSOService.ts`, `DirectoryService.ts`, controllers).
- Workflow engine & automation services present (`services/WorkflowService.ts`, `WorkflowEngine.ts`).
- Admin dashboard apps exist and connect to enterprise APIs (`apps/admin`, `apps/web` components).

## Critical Tasks (Do These First)

1. **Replace analytics placeholders with real metrics**  
   - File: `services/enterprise-api/src/controllers/AnalyticsController.ts:65-70`.  
   - Task: Query labeling backend tables for total/completed tasks, executed workflows; cache results; update admin dashboard consumption.

2. **Implement directory user counts + telemetry**  
   - File: `services/enterprise-api/src/controllers/DirectoryController.ts:147-170`.  
   - Task: Count synced directory users/groups, return last sync time, and expose metrics for monitoring.

3. **Surface workflow template reviews**  
   - File: `services/enterprise-api/src/services/WorkflowService.ts:570-579`.  
   - Task: Load stored reviews/ratings for templates and expose them in API responses + admin UI.

## High Priority Enhancements

4. **SSO + directory documentation & metadata**  
   - Files: `services/enterprise-api/src/routes/sso.ts`, `services/SSOTemplatesService.ts`, `DirectoryController.ts`.  
   - Task: Publish metadata/auto-generated docs at `/enterprise/docs`, ensure templates include provider-specific config, and sync with admin UI.

5. **Enterprise analytics dashboards in admin app**  
   - Files: `apps/admin/src/components/analytics/`, `apps/admin/src/app/(dashboard)/analytics`.  
   - Task: Wire new metrics, add loading/error states, ensure multi-tenant filters align with backend queries.

6. **Billing & subscription telemetry**  
   - Files: `services/enterprise-api/src/routes/billing.ts`, `services/enterprise-api/src/services/BillingService.ts`.  
   - Task: Add usage aggregation per subscription, highlight quota breaches, and integrate with Analytics overview.

## Medium Priority / Polish
- Improve audit logging coverage for analytics + directory endpoints via `AuditService`.  
- Expand integration catalog (Salesforce, Slack, etc.) once analytics metrics live.  
- Harden email notification flows for enterprise events (bounce handling already in place).  
- Evaluate multi-region tenant support and document limitations.

## Coordination Notes
- **Backend Developer**: align on analytics queries, caching, and error handling.  
- **Frontend Developer**: ensure admin dashboards consume new metrics gracefully.  
- **Testing Engineer**: add regression tests for analytics + directory endpoints once implemented.  
- **DevOps Engineer**: expose analytics/directory metrics in monitoring dashboards.

## Deliverables
1. Real analytics metrics feeding API + admin dashboard.  
2. Directory endpoints reporting accurate counts + sync metadata.  
3. Workflow templates returning review counts/ratings.  
4. Updated SSO/directory documentation surfaced via API + docs endpoint.  
5. Billing/usage telemetry integrated with dashboards.

## Success Criteria
- ✅ Analytics endpoints display non-zero task/workflow data that matches backend truth.  
- ✅ Directory API exposes accurate counts and sync health.  
- ✅ Admin dashboard visualises new metrics with loading/error states.  
- ✅ Enterprise customers can download SSO metadata and follow up-to-date docs.  
- ✅ Billing usage charts reflect storage/quota data in near-real time.

## Working Guidelines
- Keep tenant isolation front-of-mind (every query must scope by `organizationId`).  
- Cache expensive analytics but expose metrics for stale data detection.  
- Coordinate schema changes with backend + testing to avoid regressions.  
- Document new endpoints and update admin app copy/tooltips accordingly.
