import type { Project } from '@shared/types/database';

// Pre-defined test projects for consistent testing
export const testProjects: Record<string, Project> = {
  automotiveImageClassification: {
    id: 'project-001',
    name: 'Automotive Image Classification',
    description: 'Classify various types of vehicles and automotive parts in images',
    instructions: 'Carefully examine each image and select the most accurate category. If multiple items are present, focus on the main object in the center.',
    status: 'active',
    ownerId: 'user-requester-001',
    budget: 5000.00,
    budgetSpent: 1250.50,
    taskReward: 0.5,
    totalTasks: 1000,
    completedTasks: 250,
    labelsPerTask: 3,
    consensusThreshold: 2,
    category: 'image',
    metadata: {
      domain: 'automotive',
      difficulty: 'intermediate',
      tags: ['computer-vision', 'automotive', 'classification'],
      requirements: {
        minAccuracy: 0.85,
        minReputation: 50,
        languages: ['en', 'es'],
        timezone: 'America/New_York',
      },
      examples: [
        {
          input: 'Image of a red sedan',
          output: 'sedan',
          explanation: 'Four-door passenger car',
        },
        {
          input: 'Image of a delivery truck',
          output: 'truck',
          explanation: 'Commercial vehicle for deliveries',
        },
      ],
    },
    settings: {
      autoAssignment: true,
      allowMultipleWorkers: true,
      requireVerification: false,
      enableHoneypots: true,
      honeypotPercentage: 10,
      maxLabelsPerWorker: 100,
      timeLimitPerTask: 300,
      gracePeriod: 60,
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    publishedAt: new Date('2024-01-05T00:00:00Z'),
    completedAt: null,
    archivedAt: null,
  },

  retailSentimentAnalysis: {
    id: 'project-002',
    name: 'Product Review Sentiment Analysis',
    description: 'Analyze customer reviews to determine sentiment and extract key insights',
    instructions: 'Read each review carefully and determine if the sentiment is positive, negative, or neutral. Consider the overall tone, specific language used, and context.',
    status: 'active',
    ownerId: 'user-requester-001',
    budget: 3000.00,
    budgetSpent: 750.00,
    taskReward: 0.3,
    totalTasks: 2000,
    completedTasks: 500,
    labelsPerTask: 3,
    consensusThreshold: 2,
    category: 'text',
    metadata: {
      domain: 'retail',
      difficulty: 'beginner',
      tags: ['nlp', 'sentiment', 'retail', 'customer-feedback'],
      requirements: {
        minAccuracy: 0.8,
        minReputation: 30,
        languages: ['en'],
        timezone: 'UTC',
      },
      examples: [
        {
          input: 'This product exceeded my expectations! Great quality and fast shipping.',
          output: 'positive',
          explanation: 'Positive language and satisfaction indicators',
        },
        {
          input: 'The item arrived damaged and customer service was unhelpful.',
          output: 'negative',
          explanation: 'Clear dissatisfaction with product and service',
        },
      ],
    },
    settings: {
      autoAssignment: true,
      allowMultipleWorkers: true,
      requireVerification: false,
      enableHoneypots: true,
      honeypotPercentage: 15,
      maxLabelsPerWorker: 200,
      timeLimitPerTask: 180,
      gracePeriod: 30,
    },
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-14T00:00:00Z'),
    publishedAt: new Date('2024-01-06T00:00:00Z'),
    completedAt: null,
    archivedAt: null,
  },

  medicalImageSegmentation: {
    id: 'project-003',
    name: 'Medical Image Segmentation',
    description: 'Segment medical images to identify specific anatomical structures',
    instructions: 'Carefully outline the specified anatomical structures in each medical image. Precision is critical for medical applications.',
    status: 'paused',
    ownerId: 'user-admin-001',
    budget: 10000.00,
    budgetSpent: 2000.00,
    taskReward: 2.0,
    totalTasks: 500,
    completedTasks: 100,
    labelsPerTask: 5,
    consensusThreshold: 4,
    category: 'image',
    metadata: {
      domain: 'medical',
      difficulty: 'expert',
      tags: ['medical', 'segmentation', 'healthcare', 'expert-only'],
      requirements: {
        minAccuracy: 0.95,
        minReputation: 90,
        languages: ['en'],
        timezone: 'UTC',
        certification: 'medical-training',
      },
      examples: [
        {
          input: 'X-ray image of chest',
          output: 'lung segmentation',
          explanation: 'Outline the lung boundaries accurately',
        },
      ],
    },
    settings: {
      autoAssignment: false,
      allowMultipleWorkers: false,
      requireVerification: true,
      enableHoneypots: false,
      honeypotPercentage: 0,
      maxLabelsPerWorker: 50,
      timeLimitPerTask: 1800,
      gracePeriod: 300,
    },
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-13T00:00:00Z'),
    publishedAt: new Date('2024-01-07T00:00:00Z'),
    completedAt: null,
    archivedAt: null,
  },

  ecommerceProductCategorization: {
    id: 'project-004',
    name: 'E-commerce Product Categorization',
    description: 'Categorize e-commerce products into hierarchical categories',
    instructions: 'Review product information and assign the most appropriate category from the provided hierarchy. Consider product description, images, and specifications.',
    status: 'active',
    ownerId: 'user-requester-001',
    budget: 2500.00,
    budgetSpent: 875.00,
    taskReward: 0.75,
    totalTasks: 1500,
    completedTasks: 350,
    labelsPerTask: 3,
    consensusThreshold: 2,
    category: 'mixed',
    metadata: {
      domain: 'ecommerce',
      difficulty: 'intermediate',
      tags: ['ecommerce', 'categorization', 'retail', 'products'],
      requirements: {
        minAccuracy: 0.88,
        minReputation: 60,
        languages: ['en', 'es', 'fr'],
        timezone: 'America/New_York',
      },
      examples: [
        {
          input: 'Wireless Bluetooth Earbuds with Charging Case',
          output: 'Electronics > Audio > Headphones > Earbuds',
          explanation: 'Hierarchical categorization starting from broad to specific',
        },
      ],
    },
    settings: {
      autoAssignment: true,
      allowMultipleWorkers: true,
      requireVerification: false,
      enableHoneypots: true,
      honeypotPercentage: 12,
      maxLabelsPerWorker: 150,
      timeLimitPerTask: 240,
      gracePeriod: 60,
    },
    createdAt: new Date('2024-01-04T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    publishedAt: new Date('2024-01-08T00:00:00Z'),
    completedAt: null,
    archivedAt: null,
  },

  contentModeration: {
    id: 'project-005',
    name: 'Social Media Content Moderation',
    description: 'Review and moderate user-generated content for policy compliance',
    instructions: 'Review content (text, images, or videos) and determine if it violates community guidelines. Consider context, intent, and severity.',
    status: 'completed',
    ownerId: 'user-admin-001',
    budget: 4000.00,
    budgetSpent: 4000.00,
    taskReward: 0.4,
    totalTasks: 3000,
    completedTasks: 3000,
    labelsPerTask: 2,
    consensusThreshold: 2,
    category: 'mixed',
    metadata: {
      domain: 'social-media',
      difficulty: 'advanced',
      tags: ['moderation', 'safety', 'policy', 'social-media'],
      requirements: {
        minAccuracy: 0.9,
        minReputation: 75,
        languages: ['en', 'es', 'fr', 'de'],
        timezone: 'UTC',
      },
      examples: [
        {
          input: 'User post with promotional spam',
          output: 'spam',
          explanation: 'Unsolicited promotional content',
        },
      ],
    },
    settings: {
      autoAssignment: true,
      allowMultipleWorkers: true,
      requireVerification: true,
      enableHoneypots: true,
      honeypotPercentage: 20,
      maxLabelsPerWorker: 500,
      timeLimitPerTask: 120,
      gracePeriod: 30,
    },
    createdAt: new Date('2023-12-01T00:00:00Z'),
    updatedAt: new Date('2024-01-10T00:00:00Z'),
    publishedAt: new Date('2023-12-05T00:00:00Z'),
    completedAt: new Date('2024-01-10T00:00:00Z'),
    archivedAt: null,
  },
};

// Helper to get projects by status
export const getProjectsByStatus = (status: Project['status']): Project[] => {
  return Object.values(testProjects).filter(project => project.status === status);
};

// Helper to get projects by owner
export const getProjectsByOwner = (ownerId: string): Project[] => {
  return Object.values(testProjects).filter(project => project.ownerId === ownerId);
};

// Helper to get active projects sorted by budget
export const getActiveProjectsByBudget = (): Project[] => {
  return Object.values(testProjects)
    .filter(project => project.status === 'active')
    .sort((a, b) => b.budget - a.budget);
};

// Helper to get projects needing workers
export const getProjectsNeedingWorkers = (): Project[] => {
  return Object.values(testProjects).filter(
    project => project.status === 'active' && project.completedTasks < project.totalTasks
  );
};

// Helper to get projects by difficulty
export const getProjectsByDifficulty = (difficulty: string): Project[] => {
  return Object.values(testProjects).filter(
    project => project.metadata.difficulty === difficulty
  );
};