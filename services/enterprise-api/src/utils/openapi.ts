import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Application } from 'express'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LabelMint Enterprise API',
      version: '1.0.0',
      description: `
        # LabelMint Enterprise API Documentation

        This API provides advanced enterprise features for LabelMint including:
        - Single Sign-On (SSO) with SAML, OIDC, OAuth2, and LDAP support
        - Organization management with role-based permissions
        - Email service integration
        - Billing and subscription management
        - Analytics and reporting
        - White-label customization options

        ## Authentication
        Most endpoints require Bearer token authentication. Include your API token in the Authorization header:
        \`Authorization: Bearer <your-token>\`

        ## Rate Limiting
        API requests are rate-limited to ensure fair usage. Current limits:
        - 1000 requests per hour for authenticated users
        - 100 requests per hour for unauthenticated requests
      `,
      contact: {
        name: 'LabelMint Support',
        email: 'enterprise-support@labelmint.io',
        url: 'https://labelmint.io/support'
      },
      license: {
        name: 'Enterprise License',
        url: 'https://labelmint.io/license'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'https://api.labelmint.io/v1',
        description: 'Production server'
      },
      {
        url: 'https://staging-api.labelmint.io/v1',
        description: 'Staging server'
      },
      {
        url: 'http://localhost:3001/v1',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token'
        },
        ApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for programmatic access'
        }
      },
      schemas: {
        Organization: {
          type: 'object',
          required: ['name', 'domain'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Organization unique identifier'
            },
            name: {
              type: 'string',
              description: 'Organization name',
              example: 'Acme Corporation'
            },
            domain: {
              type: 'string',
              description: 'Organization domain for SSO',
              example: 'acme.corp'
            },
            settings: {
              $ref: '#/components/schemas/OrganizationSettings'
            },
            subscription: {
              $ref: '#/components/schemas/Subscription'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Organization creation date'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update date'
            }
          }
        },
        OrganizationSettings: {
          type: 'object',
          properties: {
            branding: {
              $ref: '#/components/schemas/BrandingSettings'
            },
            security: {
              $ref: '#/components/schemas/SecuritySettings'
            },
            notifications: {
              $ref: '#/components/schemas/NotificationSettings'
            },
            integrations: {
              $ref: '#/components/schemas/IntegrationSettings'
            }
          }
        },
        BrandingSettings: {
          type: 'object',
          properties: {
            logo: {
              type: 'string',
              description: 'Logo URL'
            },
            primaryColor: {
              type: 'string',
              description: 'Primary brand color',
              example: '#0066CC'
            },
            secondaryColor: {
              type: 'string',
              description: 'Secondary brand color',
              example: '#666666'
            },
            customCSS: {
              type: 'string',
              description: 'Custom CSS for white-labeling'
            },
            customDomain: {
              type: 'string',
              description: 'Custom domain for white-labeling',
              example: 'labeling.acme.com'
            }
          }
        },
        SecuritySettings: {
          type: 'object',
          properties: {
            mfaRequired: {
              type: 'boolean',
              description: 'Whether MFA is required',
              default: false
            },
            sessionTimeout: {
              type: 'integer',
              description: 'Session timeout in minutes',
              default: 480
            },
            passwordPolicy: {
              type: 'object',
              properties: {
                minLength: {
                  type: 'integer',
                  default: 8
                },
                requireUppercase: {
                  type: 'boolean',
                  default: true
                },
                requireLowercase: {
                  type: 'boolean',
                  default: true
                },
                requireNumbers: {
                  type: 'boolean',
                  default: true
                },
                requireSpecialChars: {
                  type: 'boolean',
                  default: true
                }
              }
            }
          }
        },
        NotificationSettings: {
          type: 'object',
          properties: {
            emailNotifications: {
              type: 'boolean',
              default: true
            },
            webhookUrl: {
              type: 'string',
              description: 'Webhook URL for notifications'
            },
            events: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Events to trigger notifications for'
            }
          }
        },
        IntegrationSettings: {
          type: 'object',
          properties: {
            slack: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean'
                },
                webhookUrl: {
                  type: 'string'
                },
                channelId: {
                  type: 'string'
                }
              }
            },
            github: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean'
                },
                repositoryUrl: {
                  type: 'string'
                },
                accessToken: {
                  type: 'string'
                }
              }
            }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            plan: {
              type: 'string',
              enum: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'],
              description: 'Subscription plan'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID'],
              description: 'Subscription status'
            },
            limits: {
              $ref: '#/components/schemas/SubscriptionLimits'
            },
            currentUsage: {
              $ref: '#/components/schemas/CurrentUsage'
            },
            billingInfo: {
              $ref: '#/components/schemas/BillingInfo'
            }
          }
        },
        SubscriptionLimits: {
          type: 'object',
          properties: {
            users: {
              type: 'integer',
              description: 'Maximum number of users'
            },
            projects: {
              type: 'integer',
              description: 'Maximum number of projects'
            },
            storage: {
              type: 'integer',
              description: 'Storage limit in GB'
            },
            apiCalls: {
              type: 'integer',
              description: 'Monthly API call limit'
            }
          }
        },
        CurrentUsage: {
          type: 'object',
          properties: {
            users: {
              type: 'integer',
              description: 'Current number of users'
            },
            projects: {
              type: 'integer',
              description: 'Current number of projects'
            },
            storage: {
              type: 'integer',
              description: 'Current storage usage in GB'
            },
            apiCalls: {
              type: 'integer',
              description: 'Current month API calls'
            }
          }
        },
        BillingInfo: {
          type: 'object',
          properties: {
            address: {
              $ref: '#/components/schemas/Address'
            },
            taxId: {
              type: 'string',
              description: 'Tax identification number'
            },
            paymentMethod: {
              type: 'string',
              enum: ['CARD', 'BANK_TRANSFER', 'INVOICE'],
              description: 'Payment method'
            }
          }
        },
        Address: {
          type: 'object',
          required: ['line1', 'city', 'country'],
          properties: {
            line1: {
              type: 'string',
              description: 'Address line 1'
            },
            line2: {
              type: 'string',
              description: 'Address line 2 (optional)'
            },
            city: {
              type: 'string',
              description: 'City'
            },
            state: {
              type: 'string',
              description: 'State/Province'
            },
            postalCode: {
              type: 'string',
              description: 'Postal/ZIP code'
            },
            country: {
              type: 'string',
              description: 'Country code (ISO 3166-1 alpha-2)',
              example: 'US'
            }
          }
        },
        SSOConfig: {
          type: 'object',
          required: ['provider', 'enabled'],
          properties: {
            provider: {
              type: 'string',
              enum: ['saml', 'oidc', 'oauth2', 'ldap'],
              description: 'SSO provider type'
            },
            enabled: {
              type: 'boolean',
              description: 'Whether SSO is enabled'
            },
            config: {
              type: 'object',
              description: 'Provider-specific configuration'
            }
          }
        },
        Team: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              description: 'Team name'
            },
            description: {
              type: 'string',
              description: 'Team description'
            },
            leadId: {
              type: 'string',
              format: 'uuid',
              description: 'Team lead user ID'
            },
            members: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/TeamMember'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        TeamMember: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            },
            role: {
              type: 'string',
              enum: ['LEAD', 'MEMBER', 'VIEWER']
            },
            joinedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Role: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              description: 'Role name'
            },
            description: {
              type: 'string',
              description: 'Role description'
            },
            permissions: {
              type: 'object',
              description: 'Permission mapping'
            },
            isSystem: {
              type: 'boolean',
              description: 'Whether this is a system role',
              default: false
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            firstName: {
              type: 'string'
            },
            lastName: {
              type: 'string'
            },
            username: {
              type: 'string'
            },
            role: {
              type: 'string',
              enum: ['OWNER', 'ADMIN', 'MEMBER']
            },
            isActive: {
              type: 'boolean'
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ApiError: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: {
              type: 'string',
              description: 'Error code'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            },
            requestId: {
              type: 'string',
              description: 'Request ID for tracking'
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            pagination: {
              $ref: '#/components/schemas/Pagination'
            },
            requestId: {
              type: 'string',
              description: 'Request ID for tracking'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number'
            },
            limit: {
              type: 'integer',
              description: 'Items per page'
            },
            total: {
              type: 'integer',
              description: 'Total number of items'
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              },
              example: {
                error: 'UNAUTHORIZED',
                message: 'Invalid or missing authentication token',
                requestId: 'req_123456'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              },
              example: {
                error: 'FORBIDDEN',
                message: 'You do not have permission to perform this action',
                requestId: 'req_123456'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              },
              example: {
                error: 'NOT_FOUND',
                message: 'The requested resource was not found',
                requestId: 'req_123456'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              },
              example: {
                error: 'VALIDATION_ERROR',
                message: 'Invalid request parameters',
                details: {
                  field: 'email',
                  message: 'Invalid email format'
                },
                requestId: 'req_123456'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              },
              example: {
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'API rate limit exceeded. Please try again later.',
                details: {
                  limit: 1000,
                  remaining: 0,
                  resetAt: '2024-01-01T00:00:00Z'
                },
                requestId: 'req_123456'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiError'
              },
              example: {
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                requestId: 'req_123456'
              }
            }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      },
      {
        ApiKey: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication and SSO management'
      },
      {
        name: 'Organizations',
        description: 'Organization management operations'
      },
      {
        name: 'Users',
        description: 'User management operations'
      },
      {
        name: 'Teams',
        description: 'Team management operations'
      },
      {
        name: 'Roles',
        description: 'Role and permission management'
      },
      {
        name: 'Billing',
        description: 'Billing and subscription operations'
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting'
      },
      {
        name: 'Email',
        description: 'Email service operations'
      },
      {
        name: 'Webhooks',
        description: 'Webhook management'
      },
      {
        name: 'White-Label',
        description: 'White-label customization options'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
}

export const specs = swaggerJsdoc(options)

export function setupSwaggerDocs(app: Application): void {
  app.use('/api-docs', swaggerUi.serve)
  app.get('/api-docs', swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'LabelMint Enterprise API Documentation'
  }))

  // Serve OpenAPI JSON spec
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(specs)
  })
}