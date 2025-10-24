import type { Task } from '@shared/types/database';

// Pre-defined test tasks for consistent testing
export const testTasks: Record<string, Task> = {
  imageClassification: {
    id: 'task-image-001',
    projectId: 'project-001',
    title: 'Classify Vehicle Images',
    description: 'Identify the type of vehicle in each image',
    instructions: 'Look at the image and select the correct vehicle type: car, truck, motorcycle, or bus',
    type: 'image_classification',
    status: 'pending',
    priority: 'medium',
    assignedTo: null,
    createdBy: 'user-requester-001',
    labelsRequired: 3,
    labelsReceived: 0,
    consensusThreshold: 2,
    finalLabel: null,
    confidence: null,
    reward: 0.5,
    timeLimit: 300,
    estimatedTime: 60,
    metadata: {
      imageUrl: 'https://example.com/images/vehicle1.jpg',
      categories: ['car', 'truck', 'motorcycle', 'bus'],
      difficulty: 'easy',
      domain: 'automotive',
    },
    createdAt: new Date('2024-01-15T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date('2024-02-15T00:00:00Z'),
  },

  textLabeling: {
    id: 'task-text-001',
    projectId: 'project-002',
    title: 'Label Product Categories',
    description: 'Categorize product descriptions into appropriate categories',
    instructions: 'Read the product description and select the most appropriate category from the list',
    type: 'text_labeling',
    status: 'assigned',
    priority: 'high',
    assignedTo: 'user-worker-001',
    createdBy: 'user-requester-001',
    labelsRequired: 3,
    labelsReceived: 0,
    consensusThreshold: 2,
    finalLabel: null,
    confidence: null,
    reward: 0.75,
    timeLimit: 600,
    estimatedTime: 120,
    metadata: {
      text: 'Premium wireless headphones with noise cancellation and 20-hour battery life',
      categories: ['electronics', 'audio', 'headphones', 'accessories'],
      difficulty: 'medium',
      domain: 'retail',
    },
    createdAt: new Date('2024-01-14T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    assignedAt: new Date('2024-01-15T08:00:00Z'),
    startedAt: null,
    completedAt: null,
    expiresAt: new Date('2024-02-14T00:00:00Z'),
  },

  boundingBox: {
    id: 'task-bbox-001',
    projectId: 'project-003',
    title: 'Draw Bounding Boxes Around Objects',
    description: 'Identify and draw bounding boxes around all cars in the image',
    instructions: 'Draw tight bounding boxes around each car visible in the image',
    type: 'bounding_box',
    status: 'in_progress',
    priority: 'medium',
    assignedTo: 'user-worker-002',
    createdBy: 'user-requester-001',
    labelsRequired: 3,
    labelsReceived: 1,
    consensusThreshold: 2,
    finalLabel: null,
    confidence: null,
    reward: 1.0,
    timeLimit: 900,
    estimatedTime: 180,
    metadata: {
      imageUrl: 'https://example.com/images/street1.jpg',
      objectTypes: ['car'],
      difficulty: 'medium',
      domain: 'automotive',
    },
    createdAt: new Date('2024-01-13T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    assignedAt: new Date('2024-01-14T10:00:00Z'),
    startedAt: new Date('2024-01-15T09:00:00Z'),
    completedAt: null,
    expiresAt: new Date('2024-02-13T00:00:00Z'),
  },

  sentimentAnalysis: {
    id: 'task-sentiment-001',
    projectId: 'project-004',
    title: 'Analyze Review Sentiment',
    description: 'Determine if the product review is positive, negative, or neutral',
    instructions: 'Read the review carefully and select the overall sentiment',
    type: 'sentiment_analysis',
    status: 'review',
    priority: 'low',
    assignedTo: null,
    createdBy: 'user-requester-001',
    labelsRequired: 3,
    labelsReceived: 3,
    consensusThreshold: 2,
    finalLabel: null,
    confidence: null,
    reward: 0.3,
    timeLimit: 180,
    estimatedTime: 45,
    metadata: {
      text: 'The product quality is excellent and shipping was fast. Highly recommend!',
      categories: ['positive', 'negative', 'neutral'],
      difficulty: 'easy',
      domain: 'retail',
    },
    createdAt: new Date('2024-01-12T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date('2024-02-12T00:00:00Z'),
  },

  transcription: {
    id: 'task-transcription-001',
    projectId: 'project-005',
    title: 'Transcribe Audio Recording',
    description: 'Convert speech from audio file to text',
    instructions: 'Listen to the audio and type exactly what is being said',
    type: 'transcription',
    status: 'completed',
    priority: 'medium',
    assignedTo: 'user-worker-003',
    createdBy: 'user-requester-001',
    labelsRequired: 1,
    labelsReceived: 1,
    consensusThreshold: 1,
    finalLabel: 'Hello, this is a test transcription',
    confidence: 0.95,
    reward: 1.5,
    timeLimit: 1200,
    estimatedTime: 300,
    metadata: {
      audioUrl: 'https://example.com/audio/test1.mp3',
      language: 'en',
      difficulty: 'medium',
      domain: 'general',
    },
    createdAt: new Date('2024-01-10T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    assignedAt: new Date('2024-01-12T14:00:00Z'),
    startedAt: new Date('2024-01-12T14:05:00Z'),
    completedAt: new Date('2024-01-15T11:30:00Z'),
    expiresAt: new Date('2024-02-10T00:00:00Z'),
  },

  honeypotTask: {
    id: 'task-honeypot-001',
    projectId: 'project-honeypot',
    title: 'Identify Animal Type',
    description: 'Simple animal identification task',
    instructions: 'Look at the image and select the correct animal',
    type: 'image_classification',
    status: 'pending',
    priority: 'medium',
    assignedTo: null,
    createdBy: 'user-admin-001',
    labelsRequired: 1,
    labelsReceived: 0,
    consensusThreshold: 1,
    finalLabel: null,
    confidence: null,
    reward: 0.2,
    timeLimit: 60,
    estimatedTime: 15,
    metadata: {
      imageUrl: 'https://example.com/images/cat1.jpg',
      categories: ['cat', 'dog', 'bird', 'fish'],
      difficulty: 'easy',
      domain: 'general',
      isHoneypot: true,
    },
    createdAt: new Date('2024-01-15T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date('2024-02-15T00:00:00Z'),
  },

  urgentTask: {
    id: 'task-urgent-001',
    projectId: 'project-001',
    title: 'Urgent: Emergency Vehicle Classification',
    description: 'Identify emergency vehicles in surveillance footage',
    instructions: 'Mark all emergency vehicles (ambulance, fire truck, police car) in the image',
    type: 'bounding_box',
    status: 'pending',
    priority: 'urgent',
    assignedTo: null,
    createdBy: 'user-requester-001',
    labelsRequired: 5,
    labelsReceived: 0,
    consensusThreshold: 4,
    finalLabel: null,
    confidence: null,
    reward: 3.0,
    timeLimit: 180,
    estimatedTime: 90,
    metadata: {
      imageUrl: 'https://example.com/images/emergency1.jpg',
      objectTypes: ['ambulance', 'fire_truck', 'police_car'],
      difficulty: 'hard',
      domain: 'emergency',
      requiresAccuracy: 0.95,
    },
    createdAt: new Date('2024-01-15T12:00:00Z'),
    updatedAt: new Date('2024-01-15T12:00:00Z'),
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date('2024-01-16T12:00:00Z'),
  },
};

// Helper to get tasks by status
export const getTasksByStatus = (status: Task['status']): Task[] => {
  return Object.values(testTasks).filter(task => task.status === status);
};

// Helper to get tasks by type
export const getTasksByType = (type: Task['type']): Task[] => {
  return Object.values(testTasks).filter(task => task.type === type);
};

// Helper to get pending tasks sorted by priority
export const getPendingTasksByPriority = (): Task[] => {
  return Object.values(testTasks)
    .filter(task => task.status === 'pending')
    .sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
};

// Helper to get tasks needing labels
export const getTasksNeedingLabels = (): Task[] => {
  return Object.values(testTasks).filter(
    task => task.status === 'pending' || task.status === 'assigned' || task.status === 'in_progress'
  );
};

// Helper to get honeypot tasks
export const getHoneypotTasks = (): Task[] => {
  return Object.values(testTasks).filter(
    task => task.metadata?.isHoneypot === true
  );
};