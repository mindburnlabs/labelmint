import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Telegram Labeling Platform API',
      version: '1.0.0',
      description: 'Enterprise API for programmatic dataset labeling',
      contact: {
        name: 'API Support',
        email: 'support@labelmint.it',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'https://api.labelmint.it/v1',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication',
        },
        timestampAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Timestamp',
          description: 'Unix timestamp for request (5-minute window)',
        },
        signatureAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Signature',
          description: 'HMAC-SHA256 signature of the request payload',
        },
      },
      schemas: {
        Project: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Project identifier',
            },
            name: {
              type: 'string',
              description: 'Project name',
              maxLength: 100,
            },
            description: {
              type: 'string',
              description: 'Project description',
              maxLength: 1000,
            },
            type: {
              type: 'string',
              enum: ['image', 'text'],
              description: 'Type of labeling task',
            },
            categories: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 2,
              maxItems: 10,
              description: 'Available labeling categories',
            },
            status: {
              type: 'string',
              enum: ['pending', 'active', 'completed', 'paused'],
              description: 'Current project status',
            },
            config: {
              type: 'object',
              properties: {
                instruction: {
                  type: 'string',
                  description: 'Instructions for labelers',
                },
                guidelines: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'Labeling guidelines',
                },
                required_accuracy: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Minimum required accuracy (0-1)',
                },
                quality_check: {
                  type: 'boolean',
                  description: 'Enable quality checks',
                },
              },
            },
            webhooks: {
              type: 'object',
              properties: {
                task_completed: {
                  type: 'string',
                  format: 'uri',
                  description: 'Webhook URL for task completion notifications',
                },
                project_completed: {
                  type: 'string',
                  format: 'uri',
                  description: 'Webhook URL for project completion notifications',
                },
              },
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Project creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['name', 'type', 'categories'],
        },
        Pricing: {
          type: 'object',
          properties: {
            cost_per_label: {
              type: 'number',
              description: 'Cost per label in USD',
              example: 0.04,
            },
            estimated_total: {
              type: 'number',
              description: 'Estimated total cost',
              example: 40.00,
            },
            discount: {
              type: 'string',
              description: 'Discount applied',
              example: '20%',
            },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'API key identifier',
            },
            name: {
              type: 'string',
              description: 'API key name',
            },
            key: {
              type: 'string',
              description: 'API key value (only returned on creation)',
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'API key permissions',
            },
            rate_limit: {
              type: 'object',
              properties: {
                requests: {
                  type: 'integer',
                  description: 'Number of requests allowed',
                },
                window: {
                  type: 'integer',
                  description: 'Time window in minutes',
                },
              },
            },
            description: {
              type: 'string',
              description: 'API key description',
            },
            is_active: {
              type: 'boolean',
              description: 'Whether the API key is active',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Key creation timestamp',
            },
            last_used: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp',
            },
            request_count: {
              type: 'integer',
              description: 'Total number of requests made',
            },
          },
        },
        TaskResult: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task identifier',
            },
            title: {
              type: 'string',
              description: 'Task title',
            },
            data: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    image_url: {
                      type: 'string',
                      format: 'uri',
                    },
                    original_data: {
                      type: 'object',
                    },
                  },
                },
                {
                  type: 'object',
                  properties: {
                    text: {
                      type: 'string',
                    },
                    original_data: {
                      type: 'object',
                    },
                  },
                },
              ],
            },
            label: {
              type: 'string',
              description: 'Assigned label',
            },
            is_correct: {
              type: 'boolean',
              description: 'Whether the label was verified as correct',
            },
            time_spent: {
              type: 'integer',
              description: 'Time spent in seconds',
            },
            labeled_at: {
              type: 'string',
              format: 'date-time',
              description: 'Labeling timestamp',
            },
            worker: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                },
                name: {
                  type: 'string',
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Error code',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
          required: ['error'],
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
          },
        },
      },
    },
    security: [
      {
        apiKeyAuth: [],
        timestampAuth: [],
        signatureAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/api/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);