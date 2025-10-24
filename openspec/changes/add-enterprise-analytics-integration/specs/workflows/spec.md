## MODIFIED Requirements

### Requirement: Workflow Metadata Enrichment
Workflow endpoints MUST include creator information, linked projects, and execution statistics so downstream analytics and integrations can reuse consistent metadata.

#### Scenario: Workflow detail includes integrations
- **WHEN** an org admin calls `GET /api/enterprise/v1/organizations/org-123/workflows/wf-789`
- **THEN** the API returns `200 OK` with workflow details including creator profile (id/email/name), associated project ids, latest execution summary, and cached analytics snapshot.

### Requirement: Workflow Permission Checks
Workflow mutations MUST reuse user/project service permission checks to ensure only authorized members (owners/admins or project collaborators) can create/update/delete workflows.

#### Scenario: Unauthorized user cannot update workflow
- **GIVEN** user `user-456` lacks workflow manage permission
- **WHEN** they call `PATCH /api/enterprise/v1/organizations/org-123/workflows/wf-789`
- **THEN** the API responds with `403 Forbidden` without touching the workflow record.

### Requirement: Workflow Execution Metrics Publishing
Workflow execution endpoints MUST persist execution results (status, duration, node errors) so analytics endpoints can aggregate totals and average durations.

#### Scenario: Workflow execution records metrics
- **WHEN** `POST /api/enterprise/v1/organizations/org-123/workflows/wf-789/execute` completes successfully
- **THEN** the API stores an execution row with status `SUCCESS`, duration, triggeredBy user, and links to associated project if provided
- **AND** the analytics service can include this execution in workflow analytics queries.
