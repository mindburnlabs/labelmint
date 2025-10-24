import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
process.env.VIRUS_SCANNER_ENABLED = 'false';
process.env.IMAGE_PROCESSING_ENABLED = 'true';

// Mock external services
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  CreateMultipartUploadCommand: jest.fn(),
  UploadPartCommand: jest.fn(),
  CompleteMultipartUploadCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
  HeadObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-signed-url.com'),
}));

// Global test helpers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidFile(): R;
      toBeValidImage(): R;
      toBeSecure(): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidFile(received) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => `Expected ${received} to be a valid file object`,
        pass: false,
      };
    }

    const hasRequiredFields = received.key && received.url && received.size && received.type;

    return {
      message: () => `Expected ${received} to be a valid file with required fields`,
      pass: !!hasRequiredFields,
    };
  },

  toBeValidImage(received) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => `Expected ${received} to be a valid image object`,
        pass: false,
      };
    }

    const isImageType = received.type && received.type.startsWith('image/');

    return {
      message: () => `Expected ${received} to be a valid image`,
      pass: !!isImageType,
    };
  },

  toBeSecure(received) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => `Expected ${received} to be secure`,
        pass: false,
      };
    }

    const hasNoThreats = !received.isInfected || received.isInfected === false;

    return {
      message: () => `Expected ${received} to have no security threats`,
      pass: hasNoThreats,
    };
  },
});

// Test utilities
export const createMockFile = (
  buffer: Buffer,
  originalname: string,
  mimetype: string
) => ({
  fieldname: 'file',
  originalname,
  encoding: '7bit',
  mimetype,
  size: buffer.length,
  buffer,
  destination: undefined,
  filename: undefined,
  path: undefined,
  stream: null,
  truncate: false,
  limit: false,
});

export const createTestImageBuffer = async (width = 100, height = 100) => {
  // Create a simple test image
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer('image/png');
};

export const createTestPDFBuffer = () => {
  // Simple PDF header for testing
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n');
};

// Clean up after tests
afterAll(async () => {
  // Close database connections, clear mocks, etc.
  jest.clearAllMocks();
});