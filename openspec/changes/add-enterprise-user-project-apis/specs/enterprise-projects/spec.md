## ADDED Requirements

### Requirement: Project CRUD and Workflow Association
The enterprise API MUST allow authorized users to create, read, update, archive, and restore projects within their organization, including attaching workflow definitions and metadata.

#### Scenario: Project manager creates a project
- **GIVEN** a user with `project_manager` role belongs to organization `org-123` and has `project:create` permission
- **WHEN** they post `{ "name": "QA Pilot", "teamId": "team-9", "workflowId": "wf-42", "settings": { "qualityThreshold": 0.92 } }` to `POST /api/enterprise/v1/organizations/org-123/projects`
- **THEN** the API returns `201 Created` with the persisted project record, associated workflow metadata, and audit action `project.created`
- **AND** subscription limits for `projects` are checked before persistence

#### Scenario: Project metadata update
- **GIVEN** project `proj-555` exists under `org-123`
- **WHEN** an authorized manager sends `PATCH /api/enterprise/v1/organizations/org-123/projects/proj-555` with `{ "description": "Updated scope", "settings": { "consensusSize": 5 } }`
- **THEN** the API responds `200 OK`, persists the changes, bumps `updatedAt`, and emits audit action `project.updated`

#### Scenario: Archive and restore project
- **WHEN** an `org_admin` calls `DELETE /api/enterprise/v1/organizations/org-123/projects/proj-555`
- **THEN** the API sets `archivedAt` on the project, returns `200 OK`, and soft-deletes associated caches
- **AND** calling `POST /api/enterprise/v1/organizations/org-123/projects/proj-555/restore` brings the project back with previous settings

### Requirement: Project Membership Management
Authorized users MUST be able to manage project collaborators, assign roles, and remove access using organization-scoped endpoints.

#### Scenario: Add collaborator to project
- **GIVEN** project `proj-555` belongs to organization `org-123`
- **WHEN** an `org_admin` posts `{ "userId": "user-456", "role": "reviewer" }` to `POST /api/enterprise/v1/organizations/org-123/projects/proj-555/members`
- **THEN** the API returns `201 Created`, links the user to the project, provisions default permissions, and queues notification email

#### Scenario: Remove collaborator missing permissions
- **GIVEN** a user lacking `project:manage_members` tries to remove a collaborator
- **WHEN** they call `DELETE /api/enterprise/v1/organizations/org-123/projects/proj-555/members/user-456`
- **THEN** the API responds with `403 Forbidden` and logs an access denial event

### Requirement: Project Analytics & Reporting
The API MUST expose endpoints that summarize project performance (tasks, quality, throughput, spend) and support date range, status, and team filters.

#### Scenario: Fetch project analytics summary
- **WHEN** an `org_admin` calls `GET /api/enterprise/v1/organizations/org-123/projects/proj-555/analytics?range=last_7_days`
- **THEN** the API responds `200 OK` with metrics including `tasksCreated`, `tasksCompleted`, `averageAccuracy`, `budgetUsage`, and `throughput`
- **AND** all metrics are scoped to `org-123` and exclude archived data unless `includeArchived=true` is supplied.
