## 1. Analytics Foundations
- [ ] Audit existing analytics routes/controllers and remove or rewrite unsupported endpoints.
- [ ] Build `AnalyticsService` with overview, user, project, workflow metric aggregation and optional caching.
- [ ] Implement controller logic (overview/users/projects/workflows/custom metric/export) using the service and proper error handling.
- [ ] Add request validators or reuse existing ones, trimming expectations to delivered functionality.
- [ ] Create unit tests covering service aggregation, caching, and controller responses (Vitest with mocked Prisma/Redis).

## 2. Workflow Integration
- [ ] Update workflow controller/service to reuse user/project services for permission checks, metadata enrichment, and analytics hooks.
- [ ] Expose workflow execution summaries that analytics can consume (counts by status, durations).
- [ ] Add tests ensuring workflow endpoints respect tenant membership and surface integrated metadata.

## 3. Documentation & Spec
- [ ] Update OpenSpec delta files describing analytics and workflow requirements/scenarios.
- [ ] Run `openspec validate add-enterprise-analytics-integration --strict` and resolve issues.
- [ ] Document new endpoints (README or API docs) and note caching strategy.
