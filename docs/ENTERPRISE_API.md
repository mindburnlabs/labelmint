# LabelMint Enterprise API Documentation

## Overview

The LabelMint Enterprise API provides comprehensive features for enterprise-grade data labeling operations, including organization management, team collaboration, workflow automation, analytics, and SSO integration.

## Base URL

```
https://your-domain.com/api/enterprise/v1
```

## Authentication

All API requests (except SSO endpoints) require authentication using JWT tokens or enterprise SSO sessions.

### JWT Authentication

```
Authorization: Bearer <jwt-token>
```

### SSO Authentication

```
Cookie: sso_token=<sso-token>
```

## Organization Management

### Create Organization

```http
POST /api/enterprise/v1/organizations
Content-Type: application/json

{
  "name": "Acme Corp",
  "description": "Data labeling for AI models",
  "settings": {
    "timezone": "America/New_York",
    "workingHours": {
      "start": "09:00",
      "end": "17:00"
    }
  },
  "billing": {
    "plan": "ENTERPRISE",
    "paymentMethodId": "pm_123456789"
  }
}
```

### Get Organization

```http
GET /api/enterprise/v1/organizations/:organizationId
```

### Update Organization

```http
PUT /api/enterprise/v1/organizations/:organizationId
Content-Type: application/json

{
  "name": "Acme Corp Updated",
  "settings": {
    "timezone": "America/Los_Angeles"
  }
}
```

### Add Member

```http
POST /api/enterprise/v1/organizations/:organizationId/members
Content-Type: application/json

{
  "email": "user@example.com",
  "role": "MEMBER",
  "permissions": {
    "canManageProjects": true,
    "canViewAnalytics": true
  }
}
```

### Invite Member

```http
POST /api/enterprise/v1/organizations/:organizationId/invitations
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "MEMBER",
  "permissions": {
    "canManageProjects": false,
    "canViewAnalytics": true
  },
  "message": "Join our labeling team!"
}
```

## Team Management

### Create Team

```http
POST /api/enterprise/v1/organizations/:organizationId/teams
Content-Type: application/json

{
  "name": "Image Annotation Team",
  "description": "Specializes in image labeling",
  "members": ["user_id_1", "user_id_2"],
  "permissions": {
    "canAccessAllProjects": true,
    "canCreateProjects": false
  }
}
```

### Get Teams

```http
GET /api/enterprise/v1/organizations/:organizationId/teams
```

### Add Team Member

```http
POST /api/enterprise/v1/organizations/:organizationId/teams/:teamId/members
Content-Type: application/json

{
  "userId": "user_id_123",
  "role": "MEMBER"
}
```

## SSO Configuration

### Create SSO Configuration

```http
POST /api/enterprise/v1/organizations/:organizationId/sso/config
Content-Type: application/json

{
  "provider": "saml",
  "enabled": true,
  "config": {
    "entryPoint": "https://idp.example.com/saml",
    "issuer": "https://your-domain.com",
    "cert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "nameIdFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress",
    "attributeMapping": {
      "Email": "email",
      "FirstName": "firstName",
      "LastName": "lastName"
    }
  }
}
```

### Get SSO Configuration

```http
GET /api/enterprise/v1/organizations/:organizationId/sso/config
```

### Test SSO Configuration

```http
POST /api/enterprise/v1/organizations/:organizationId/sso/test
Content-Type: application/json

{
  "provider": "saml",
  "config": {
    "entryPoint": "https://idp.example.com/saml",
    "issuer": "https://your-domain.com"
  }
}
```

### Initiate SSO Login

```http
GET /api/sso/organizations/:organizationId/login?relayState=/dashboard
```

This redirects to the configured identity provider.

### Handle SSO Response

```http
POST /api/sso/organizations/:organizationId/acs
Content-Type: application/x-www-form-urlencoded

SAMLResponse=encoded_saml_response&RelayState=relay_state
```

## Workflow Management

### Create Workflow

```http
POST /api/workflows/workflows
Content-Type: application/json

{
  "name": "Image Classification Workflow",
  "description": "Multi-step image classification",
  "organizationId": "org_123",
  "definition": {
    "nodes": [
      {
        "id": "trigger",
        "type": "trigger",
        "config": {
          "eventType": "project.created"
        }
      },
      {
        "id": "validate",
        "type": "validation",
        "config": {
          "rules": ["hasLabels", "minAnnotations:5"]
        }
      }
    ],
    "edges": [
      {
        "from": "trigger",
        "to": "validate"
      }
    ]
  }
}
```

### Execute Workflow

```http
POST /api/workflows/workflows/:workflowId/execute
Content-Type: application/json

{
  "data": {
    "projectId": "project_123",
    "userId": "user_456"
  },
  "options": {
    "async": true
  }
}
```

## Analytics

### Get Project Analytics

```http
GET /api/analytics/projects/:projectId/analytics?startDate=2024-01-01&endDate=2024-01-31
```

### Get Quality Metrics

```http
GET /api/analytics/quality/overview?organizationId=org_123
```

### Get Performance Metrics

```http
GET /api/analytics/performance/team/:teamId
```

### Generate Report

```http
POST /api/analytics/reports
Content-Type: application/json

{
  "type": "project_summary",
  "filters": {
    "organizationId": "org_123",
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  },
  "format": "pdf"
}
```

## Collaboration

### Join Project Session

```http
POST /api/collaboration/projects/:projectId/join
```

### Send Message

```http
POST /api/collaboration/messages
Content-Type: application/json

{
  "projectId": "project_123",
  "type": "message",
  "content": "Check this annotation",
  "metadata": {
    "annotationId": "anno_456"
  }
}
```

### Get Active Users

```http
GET /api/collaboration/projects/:projectId/users
```

## White Label Configuration

### Create Tenant Configuration

```http
POST /api/white-label/tenants
Content-Type: application/json

{
  "organizationId": "org_123",
  "domain": "labeling.acme.com",
  "branding": {
    "logo": "https://cdn.example.com/logo.png",
    "primaryColor": "#0066cc",
    "secondaryColor": "#ffffff",
    "customCSS": ".custom-class { color: red; }"
  },
  "settings": {
    "customHeader": true,
    "hideBranding": true,
    "customFooter": "© 2024 Acme Corp"
  }
}
```

### Get Tenant Configuration

```http
GET /api/white-label/tenants/:tenantId
```

## Error Handling

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid format"
    }
  }
}
```

## Rate Limiting

- **API endpoints**: 100 requests per minute
- **SSO endpoints**: 10 requests per minute
- **Upload endpoints**: 5 requests per minute

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Configure Webhook

```http
POST /api/enterprise/v1/organizations/:organizationId/webhooks
Content-Type: application/json

{
  "url": "https://your-webhook-endpoint.com/events",
  "events": [
    "project.created",
    "task.completed",
    "user.invited"
  ],
  "secret": "webhook_secret_key"
}
```

## SDKs and Libraries

### TypeScript/JavaScript

```bash
npm install @labelmint/enterprise-sdk
```

```typescript
import { LabelMintEnterprise } from '@labelmint/enterprise-sdk'

const client = new LabelMintEnterprise({
  baseURL: 'https://your-domain.com/api/enterprise/v1',
  token: 'your-jwt-token'
})

const org = await client.organizations.create({
  name: 'My Organization',
  description: 'Enterprise labeling team'
})
```

### Python

```bash
pip install labelmint-enterprise
```

```python
from labelmint_enterprise import LabelMintEnterprise

client = LabelMintEnterprise(
    base_url='https://your-domain.com/api/enterprise/v1',
    token='your-jwt-token'
)

org = client.organizations.create(
    name='My Organization',
    description='Enterprise labeling team'
)
```

## Support

For enterprise support, contact:
- Email: enterprise@labelmint.com
- Documentation: https://docs.labelmint.com/enterprise
- Status Page: https://status.labelmint.com