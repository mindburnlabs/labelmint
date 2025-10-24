## ADDED Requirements

### Requirement: Analytics Overview Endpoint
Enterprise admins MUST be able to fetch an overview snapshot containing user, project, workflow, and storage metrics for an organization, with optional date filters and Redis caching.

#### Scenario: Admin retrieves overview snapshot
- **GIVEN** organization `org-123` with active projects and workflows
- **WHEN** an authenticated org admin calls `GET /api/enterprise/v1/organizations/org-123/analytics/overview?startDate=2025-01-01&endDate=2025-01-31`
- **THEN** the API returns `200 OK` with counts for users (total/active), projects (total/active), workflows (total/executed), and storage usage
- **AND** subsequent requests within 15 minutes read from cache (indicated via `cached: true`)

### Requirement: User Analytics Endpoint
The analytics API MUST surface user adoption metrics, including new members, active members, role distribution, and activity trends grouped by day.

#### Scenario: Admin queries user analytics
- **WHEN** an org admin calls `GET /api/enterprise/v1/organizations/org-123/analytics/users?startDate=2025-01-01&endDate=2025-01-31`
- **THEN** the API returns `200 OK` with arrays representing daily new member counts, active member counts, and role distribution for the range
- **AND** metrics respect tenant isolation and ignore inactive users unless `includeInactive=true`

### Requirement: Project Analytics Endpoint
Project analytics MUST report counts by status, team ownership, and recent throughput (created/updated), allowing optional status filters.

#### Scenario: Admin queries project analytics
- **WHEN** an admin calls `GET /api/enterprise/v1/organizations/org-123/analytics/projects?startDate=2025-01-01&endDate=2025-01-31&status=active`
- **THEN** the response includes counts per status, per team, and recent creation/completion trends limited to active projects

### Requirement: Workflow Analytics Endpoint
Workflow analytics MUST expose execution totals, success/failure counts, and average durations derived from `workflow_executions`, scoped to the organization.

#### Scenario: Admin requests workflow analytics
- **WHEN** an admin calls `GET /api/enterprise/v1/organizations/org-123/analytics/workflows?startDate=2025-01-01&endDate=2025-01-31`
- **THEN** the API returns `200 OK` with execution counts grouped by status and average execution duration for the specified range

### Requirement: Custom Metric Endpoint
Authorized admins MUST be able to request a single named metric (e.g., `users_active`, `projects_active`, `workflows_executed`) via `GET /analytics/metric`, receiving a numeric value and timestamp.

#### Scenario: Admin fetches active user metric
- **WHEN** `GET /api/enterprise/v1/organizations/org-123/analytics/metric?metric=users_active&startDate=2025-01-01&endDate=2025-01-31` is called
- **THEN** the API returns `200 OK` with `{ metric: 'users_active', value: <number>, calculatedAt: <iso> }`
- **AND** the value reflects the same logic used by overview analytics.

### Requirement: Analytics Export
The API MUST allow CSV export of the overview snapshot and main metrics for the requested date range.

#### Scenario: Admin exports analytics CSV
- **WHEN** an admin posts to `POST /api/enterprise/v1/organizations/org-123/analytics/export` with `{ startDate, endDate, metrics: ['overview','users','projects'] }`
- **THEN** the API streams a CSV file with at least overview totals and aggregated per-day user/project entries for the requested metrics.
