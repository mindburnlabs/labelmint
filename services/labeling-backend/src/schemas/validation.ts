import { z } from 'zod';

// User validation schemas
export const userSchemas = {
  register: z.object({
    email: z.string().email('Invalid email format'),
    username: z.string().min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be less than 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    telegramId: z.string().optional(),
    role: z.enum(['client', 'worker']).default('client')
  }),

  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required')
  }),

  updateProfile: z.object({
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
    telegramId: z.string().optional()
  }).partial(),

  createApiKey: z.object({
    keyName: z.string().min(1, 'Key name is required')
      .max(100, 'Key name must be less than 100 characters'),
    permissions: z.array(z.string()).optional()
  })
};

// Project validation schemas
export const projectSchemas = {
  create: z.object({
    name: z.string().min(1, 'Project name is required')
      .max(255, 'Project name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    category: z.string().min(1, 'Category is required'),
    instructions: z.string().min(1, 'Instructions are required'),
    datasetUrl: z.string().url('Invalid dataset URL').optional(),
    categories: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional()
    })).min(1, 'At least one category is required'),
    budget: z.number().positive('Budget must be positive').optional(),
    pricePerLabel: z.number().positive('Price per label must be positive')
      .max(1, 'Price per label cannot exceed $1')
  }),

  update: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    instructions: z.string().optional(),
    isActive: z.boolean().optional(),
    categories: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional()
    })).optional()
  }).partial()
};

// Task validation schemas
export const taskSchemas = {
  create: z.object({
    projectId: z.string().uuid('Invalid project ID'),
    type: z.enum(['image_classification', 'text_classification', 'bounding_box', 'transcription']),
    dataUrl: z.string().url('Invalid data URL'),
    metadata: z.record(z.any()).optional(),
    priority: z.number().int().min(1).max(5).default(1)
  }),

  submit: z.object({
    taskId: z.string().uuid('Invalid task ID'),
    answer: z.any(), // Would be more specific based on task type
    timeSpent: z.number().int().positive().optional()
  }),

  assign: z.object({
    workerId: z.string().uuid('Invalid worker ID'),
    expiresAt: z.string().datetime().optional()
  })
};

// Payment validation schemas
export const paymentSchemas = {
  createTransaction: z.object({
    projectId: z.string().uuid('Invalid project ID'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['TON', 'USDT']).default('USDT')
  }),

  withdraw: z.object({
    amount: z.number().positive('Amount must be positive')
      .max(10000, 'Withdrawal amount too large'),
    address: z.string().min(1, 'Address is required')
      .regex(/^[\w\-]{40,50}$/, 'Invalid address format'),
    currency: z.enum(['TON', 'USDT']).default('USDT')
  }),

  verifyPayment: z.object({
    transactionId: z.string().min(1, 'Transaction ID is required')
  })
};

// Workflow validation schemas
export const workflowSchemas = {
  create: z.object({
    name: z.string().min(1, 'Workflow name is required')
      .max(255, 'Name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    category: z.string().optional(),
    definition: z.object({
      nodes: z.array(z.object({
        id: z.string(),
        type: z.string(),
        position: z.object({
          x: z.number(),
          y: z.number()
        }),
        data: z.record(z.any()).optional()
      })),
      edges: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        condition: z.object({
          expression: z.string()
        }).optional()
      }))
    }),
    variables: z.array(z.object({
      name: z.string(),
      type: z.string(),
      defaultValue: z.any().optional(),
      description: z.string().optional()
    })).optional(),
    settings: z.object({
      errorHandling: z.object({
        strategy: z.enum(['stop', 'continue', 'retry']),
        maxRetries: z.number().int().min(0).max(10).default(3)
      }),
      timeout: z.number().int().positive().default(300000) // 5 minutes
    }).optional()
  }),

  execute: z.object({
    input: z.record(z.any()),
    context: z.object({
      environment: z.record(z.string()).optional(),
      secrets: z.record(z.string()).optional(),
      metadata: z.object({
        organizationId: z.string().optional(),
        userId: z.string().optional(),
        projectId: z.string().optional()
      }).optional()
    }).optional()
  })
};

// Admin validation schemas
export const adminSchemas = {
  updateUser: z.object({
    role: z.enum(['admin', 'moderator', 'support', 'viewer']).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
    telegramId: z.string().optional(),
    tonWalletAddress: z.string().optional()
  }).partial(),

  bulkUserAction: z.object({
    userIds: z.array(z.string().uuid()).min(1, 'At least one user ID required'),
    action: z.enum(['activate', 'deactivate', 'suspend', 'delete']),
    reason: z.string().optional()
  }),

  moderateProject: z.object({
    action: z.enum(['approve', 'reject', 'request_changes']),
    reason: z.string().optional(),
    feedback: z.string().optional()
  })
};

// Query parameter validation schemas
export const querySchemas = {
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    offset: z.coerce.number().int().min(0).optional()
  }),

  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }),

  filters: z.object({
    status: z.string().optional(),
    type: z.string().optional(),
    category: z.string().optional(),
    userId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional()
  }),

  sorting: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  })
};

// Combined schemas for complex queries
export const querySchemasCombined = {
  users: querySchemas.pagination.merge(querySchemas.filters).merge(querySchemas.sorting),
  transactions: querySchemas.pagination.merge(querySchemas.dateRange).merge(querySchemas.filters).merge(querySchemas.sorting),
  tasks: querySchemas.pagination.merge(querySchemas.filters).merge(querySchemas.sorting),
  projects: querySchemas.pagination.merge(querySchemas.filters).merge(querySchemas.sorting)
};

// File upload validation
export const fileSchemas = {
  imageUpload: z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB'),
    buffer: z.instanceof(Buffer)
  }),

  csvUpload: z.object({
    fieldname: z.string(),
    originalname: z.string().regex(/\.csv$/i, 'File must be a CSV'),
    encoding: z.string(),
    mimetype: z.enum(['text/csv', 'application/vnd.ms-excel']),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
    buffer: z.instanceof(Buffer)
  })
};

// Export all schemas
export const validationSchemas = {
  user: userSchemas,
  project: projectSchemas,
  task: taskSchemas,
  payment: paymentSchemas,
  workflow: workflowSchemas,
  admin: adminSchemas,
  query: querySchemasCombined,
  file: fileSchemas
};