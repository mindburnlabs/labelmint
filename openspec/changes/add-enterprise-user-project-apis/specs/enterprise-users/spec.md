## ADDED Requirements

### Requirement: Organization User Lifecycle Management
The enterprise API MUST expose organization-scoped endpoints that let authorized administrators list, invite, update, and deactivate users while respecting tenant isolation and audit logging.

#### Scenario: Admin lists organization users
- **GIVEN** a user with `org_admin` role belongs to organization `org-123`
- **WHEN** they call `GET /api/enterprise/v1/organizations/org-123/users?page=1&limit=25`
- **THEN** the API returns `200 OK` with a paginated list containing user profile, role, status, and last login metadata for `org-123`
- **AND** no users from other organizations are present in the payload

#### Scenario: Admin invites a new user by email
- **GIVEN** a user with `org_admin` role has `user:invite` permission inside organization `org-123`
- **WHEN** they post `{ "email": "analyst@example.com", "role": "viewer" }` to `POST /api/enterprise/v1/organizations/org-123/users`
- **THEN** the API returns `201 Created` with the pending invite record and triggers audit log entry `user.invited`
- **AND** subscription `users` counters are checked before the invite is persisted

#### Scenario: Member without permission cannot manage users
- **GIVEN** a user with `project_manager` role lacks `user:manage` permission
- **WHEN** they call `PATCH /api/enterprise/v1/organizations/org-123/users/user-456` to elevate a role
- **THEN** the API responds with `403 Forbidden` and no audit log entry is written

#### Scenario: Admin deactivates a user
- **GIVEN** organization `org-123` has active user `user-789`
- **WHEN** an `org_admin` posts to `POST /api/enterprise/v1/organizations/org-123/users/user-789/deactivate`
- **THEN** the API returns `200 OK`, sets the member status to `inactive`, revokes active sessions, and logs `user.deactivated`

### Requirement: User Activity Analytics
Authorized administrators MUST be able to retrieve consolidated user activity metrics (task counts, login activity, role distribution, active vs inactive) over a selectable time range.

#### Scenario: Admin fetches user analytics
- **GIVEN** organization `org-123` has activity data captured for the past 30 days
- **WHEN** an `org_admin` calls `GET /api/enterprise/v1/organizations/org-123/users/analytics?range=30d`
- **THEN** the API returns `200 OK` with summary fields (`totals`, `activeUsers`, `roleBreakdown`, `topContributors`, `trend`)
- **AND** the response includes the time window applied and respects organization-level filters.

### Requirement: User Activity Timeline
The API MUST expose an endpoint that returns a chronological activity feed for a specific user, redacting events the caller cannot access.

#### Scenario: Admin views user activity timeline
- **GIVEN** `org_admin` belongs to organization `org-123`
- **WHEN** they call `GET /api/enterprise/v1/organizations/org-123/users/user-456/activity?limit=50`
- **THEN** the API returns `200 OK` with chronological activity entries including event type, timestamp, resource metadata, and location (if captured)
- **AND** entries referencing projects the admin cannot access are omitted.
