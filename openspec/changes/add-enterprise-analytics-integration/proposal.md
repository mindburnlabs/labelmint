## Why
- Enterprise customers need actionable analytics for users, projects, and workflows; current routes are skeletal and reference non-existent persistence, providing no usable insights.
- Workflow endpoints lack integration with the newly implemented user/project services, leaving permission checks, metadata enrichment, and usage metrics inconsistent.

## What Changes
- Implement analytics controllers/services that compute organization-scoped metrics (overview, user, project, workflow trends) from existing Prisma models and cache results.
- Add validation, routing, and tests for analytics endpoints while pruning unimplemented routes to match delivered functionality.
- Integrate workflows with user/project services so permissions, attribution, and analytics leverage shared business logic.
- Provide basic CSV export for analytics snapshots to unblock reporting, with tests covering caching and aggregation.

## Impact
- API consumers (admin, dashboards) get reliable metrics without hitting other services directly.
- Shared services (user/project/workflow) align on tenant-aware access checks and reuse caching layers, reducing duplication.
- Requires careful Prisma usage and caching to avoid heavy queries; regression tests will be added to guard core flows.
