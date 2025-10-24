## ADDED Requirements

### Requirement: Storage Usage Aggregation
The multi-tenant middleware MUST compute current storage usage for an organization by summing persisted file sizes for all project datasets, attachments, workflow exports, and archived assets owned by that organization.

#### Scenario: Aggregate storage from multiple artifact sources
- **GIVEN** organization `org-123` owns datasets totaling 8 GB, attachments totaling 1 GB, and exports totaling 0.5 GB across its projects
- **WHEN** a request passes through the subscription limit middleware with `limitType=storage`
- **THEN** the middleware queries the artifact stores, totals the sizes (9.5 GB), caches the result, and populates `req.usage = { type: 'storage', current: 9750, limit: <plan limit> }` in MB

### Requirement: Storage Limit Enforcement
Storage subscription limits MUST be enforced using the aggregated usage so that calls exceeding the plan threshold return a descriptive error.

#### Scenario: Organization hits storage limit
- **GIVEN** organization `org-123` plan allows 10 GB and current usage is 9.8 GB
- **WHEN** a user attempts to upload a new dataset that would exceed the limit
- **THEN** the middleware detects the projected usage exceeds 10 GB and responds with `429 Too Many Requests` (limit reached) before the upload is persisted
- **AND** the response body includes `current`, `limit`, and the impacted plan name.

### Requirement: Storage Usage Reporting
The API MUST expose a subscription usage endpoint that surfaces the latest storage calculation alongside user/project counts.

#### Scenario: Admin retrieves subscription usage
- **WHEN** an `org_admin` calls `GET /api/enterprise/v1/organizations/org-123/subscription/usage`
- **THEN** the API returns `200 OK` with `storage` usage reflecting the cached aggregation, including `unit`, `currentValue`, `limit`, and `lastCalculatedAt`.
