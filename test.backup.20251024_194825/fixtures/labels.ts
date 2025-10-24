import type { Label } from '@shared/types/database';

// Pre-defined test labels for consistent testing
export const testLabels: Record<string, Label> = {
  imageClassificationCorrect: {
    id: 'label-image-001',
    taskId: 'task-image-001',
    userId: 'user-worker-001',
    value: 'car',
    confidence: 0.95,
    timeSpent: 45,
    type: 'classification',
    metadata: {
      coordinates: null,
      points: null,
      selections: ['car'],
      notes: 'Clearly a sedan car in the image',
      alternatives: ['sedan', 'vehicle'],
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-15T10:30:00Z'),
    verifiedBy: 'system',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
  },

  imageClassificationSecond: {
    id: 'label-image-002',
    taskId: 'task-image-001',
    userId: 'user-worker-002',
    value: 'car',
    confidence: 0.92,
    timeSpent: 52,
    type: 'classification',
    metadata: {
      coordinates: null,
      points: null,
      selections: ['car'],
      notes: 'Confident it is a car',
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-15T11:00:00Z'),
    verifiedBy: 'system',
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T11:00:00Z'),
  },

  boundingBoxAnnotation: {
    id: 'label-bbox-001',
    taskId: 'task-bbox-001',
    userId: 'user-worker-002',
    value: 'car',
    confidence: 0.88,
    timeSpent: 180,
    type: 'bounding_box',
    metadata: {
      coordinates: {
        x: 120,
        y: 80,
        width: 200,
        height: 120,
      },
      points: null,
      selections: null,
      notes: 'Tight bounding box around the red car',
      objectAttributes: {
        color: 'red',
        model: 'sedan',
        confidence: 0.88,
      },
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-15T14:00:00Z'),
    verifiedBy: 'user-validator-001',
    createdAt: new Date('2024-01-15T12:00:00Z'),
    updatedAt: new Date('2024-01-15T14:00:00Z'),
  },

  sentimentPositive: {
    id: 'label-sentiment-001',
    taskId: 'task-sentiment-001',
    userId: 'user-worker-001',
    value: 'positive',
    confidence: 0.97,
    timeSpent: 30,
    type: 'classification',
    metadata: {
      coordinates: null,
      points: null,
      selections: ['positive'],
      notes: 'Review uses positive language: "exceeded expectations", "great quality"',
      keywords: ['excellent', 'fast shipping', 'highly recommend'],
      sentimentScore: 0.97,
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-15T16:00:00Z'),
    verifiedBy: 'system',
    createdAt: new Date('2024-01-15T15:30:00Z'),
    updatedAt: new Date('2024-01-15T16:00:00Z'),
  },

  sentimentNegative: {
    id: 'label-sentiment-002',
    taskId: 'task-sentiment-001',
    userId: 'user-worker-002',
    value: 'negative',
    confidence: 0.85,
    timeSpent: 42,
    type: 'classification',
    metadata: {
      coordinates: null,
      points: null,
      selections: ['negative'],
      notes: 'User seems unhappy with the service',
      keywords: ['slow', 'disappointing'],
      sentimentScore: -0.65,
    },
    isCorrect: false,
    verifiedAt: new Date('2024-01-15T16:30:00Z'),
    verifiedBy: 'system',
    createdAt: new Date('2024-01-15T15:45:00Z'),
    updatedAt: new Date('2024-01-15T16:30:00Z'),
  },

  transcriptionCorrect: {
    id: 'label-transcript-001',
    taskId: 'task-transcription-001',
    userId: 'user-worker-003',
    value: 'Hello, this is a test transcription',
    confidence: 0.95,
    timeSpent: 295,
    type: 'text',
    metadata: {
      coordinates: null,
      points: null,
      selections: null,
      notes: 'Clear audio, native speaker',
      audioQuality: 'excellent',
      speakerAccent: 'american',
      timestamps: [
        { word: 'Hello', start: 0.5, end: 0.8 },
        { word: 'this', start: 0.9, end: 1.1 },
        { word: 'is', start: 1.2, end: 1.3 },
        { word: 'a', start: 1.4, end: 1.5 },
        { word: 'test', start: 1.6, end: 1.9 },
        { word: 'transcription', start: 2.0, end: 2.8 },
      ],
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-15T11:35:00Z'),
    verifiedBy: 'system',
    createdAt: new Date('2024-01-15T11:30:00Z'),
    updatedAt: new Date('2024-01-15T11:35:00Z'),
  },

  polygonSegmentation: {
    id: 'label-polygon-001',
    taskId: 'task-segment-001',
    userId: 'user-worker-001',
    value: 'road',
    confidence: 0.91,
    timeSpent: 420,
    type: 'polygon',
    metadata: {
      coordinates: null,
      points: [
        { x: 50, y: 200 },
        { x: 150, y: 195 },
        { x: 280, y: 205 },
        { x: 350, y: 210 },
        { x: 350, y: 280 },
        { x: 280, y: 275 },
        { x: 150, y: 265 },
        { x: 50, y: 270 },
      ],
      selections: null,
      notes: 'Carefully traced the road boundary',
      segmentationQuality: 'high',
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-14T10:00:00Z'),
    verifiedBy: 'user-validator-002',
    createdAt: new Date('2024-01-14T09:00:00Z'),
    updatedAt: new Date('2024-01-14T10:00:00Z'),
  },

  honeypotCorrect: {
    id: 'label-honeypot-001',
    taskId: 'task-honeypot-001',
    userId: 'user-worker-001',
    value: 'cat',
    confidence: 0.99,
    timeSpent: 12,
    type: 'classification',
    metadata: {
      coordinates: null,
      points: null,
      selections: ['cat'],
      notes: 'Obvious cat image',
      isHoneypot: true,
      expectedLabel: 'cat',
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-15T17:00:00Z'),
    verifiedBy: 'system',
    createdAt: new Date('2024-01-15T16:58:00Z'),
    updatedAt: new Date('2024-01-15T17:00:00Z'),
  },

  honeypotIncorrect: {
    id: 'label-honeypot-002',
    taskId: 'task-honeypot-002',
    userId: 'user-worker-003',
    value: 'dog',
    confidence: 0.85,
    timeSpent: 8,
    type: 'classification',
    metadata: {
      coordinates: null,
      points: null,
      selections: ['dog'],
      notes: 'Thought it was a dog',
      isHoneypot: true,
      expectedLabel: 'cat',
    },
    isCorrect: false,
    verifiedAt: new Date('2024-01-15T17:15:00Z'),
    verifiedBy: 'system',
    createdAt: new Date('2024-01-15T17:12:00Z'),
    updatedAt: new Date('2024-01-15T17:15:00Z'),
  },

  multiLabelSelection: {
    id: 'label-multi-001',
    taskId: 'task-multi-001',
    userId: 'user-worker-002',
    value: 'car,truck',
    confidence: 0.78,
    timeSpent: 95,
    type: 'classification',
    metadata: {
      coordinates: null,
      points: null,
      selections: ['car', 'truck'],
      notes: 'Multiple vehicles visible, selected the two most prominent',
      allLabels: ['car', 'truck', 'motorcycle', 'bus'],
      selectedCount: 2,
    },
    isCorrect: true,
    verifiedAt: new Date('2024-01-15T18:00:00Z'),
    verifiedBy: 'user-validator-001',
    createdAt: new Date('2024-01-15T17:45:00Z'),
    updatedAt: new Date('2024-01-15T18:00:00Z'),
  },
};

// Helper to get labels by task
export const getLabelsByTask = (taskId: string): Label[] => {
  return Object.values(testLabels).filter(label => label.taskId === taskId);
};

// Helper to get labels by user
export const getLabelsByUser = (userId: string): Label[] => {
  return Object.values(testLabels).filter(label => label.userId === userId);
};

// Helper to get correct labels
export const getCorrectLabels = (): Label[] => {
  return Object.values(testLabels).filter(label => label.isCorrect);
};

// Helper to get incorrect labels
export const getIncorrectLabels = (): Label[] => {
  return Object.values(testLabels).filter(label => !label.isCorrect);
};

// Helper to get honeypot labels
export const getHoneypotLabels = (): Label[] => {
  return Object.values(testLabels).filter(
    label => label.metadata?.isHoneypot === true
  );
};

// Helper to calculate consensus for a task
export const calculateConsensus = (taskId: string): {
  agreedLabel: string | null;
  confidence: number;
  totalLabels: number;
  consensusReached: boolean;
} => {
  const labels = getLabelsByTask(taskId);
  if (labels.length === 0) {
    return {
      agreedLabel: null,
      confidence: 0,
      totalLabels: 0,
      consensusReached: false,
    };
  }

  // Count occurrences of each label value
  const counts: Record<string, number> = {};
  labels.forEach(label => {
    counts[label.value] = (counts[label.value] || 0) + 1;
  });

  // Find the most common label
  const sortedLabels = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topLabel, topCount] = sortedLabels[0];

  // Calculate confidence
  const confidence = topCount / labels.length;

  return {
    agreedLabel: topLabel,
    confidence,
    totalLabels: labels.length,
    consensusReached: confidence >= 0.66 && labels.length >= 3,
  };
};

// Helper to get user accuracy
export const calculateUserAccuracy = (userId: string): number => {
  const userLabels = getLabelsByUser(userId);
  if (userLabels.length === 0) return 0;

  const correctCount = userLabels.filter(label => label.isCorrect).length;
  return correctCount / userLabels.length;
};