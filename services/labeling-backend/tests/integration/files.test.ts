import request from 'supertest';
import express from 'express';
import createFilesRoutes, { FileManagementConfig } from '../../src/routes/files';
import FilesController from '../../src/controllers/filesController';
import { createTestImageBuffer, createTestPDFBuffer } from '../setup';

describe('Files API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let config: FileManagementConfig;

  beforeAll(async () => {
    // Configure test environment
    config = {
      s3: {
        region: 'us-east-1',
        bucket: 'test-bucket',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      },
      virusScanner: {
        enabled: false, // Disable for tests
      },
      validator: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
      },
      imageProcessing: {
        enabled: true,
        autoOptimize: false,
        generateThumbnails: true,
        thumbnailSizes: {
          small: { width: 150, height: 150 },
          medium: { width: 300, height: 300 },
          large: { width: 600, height: 600 },
        },
      },
    };

    app = express();
    app.use(express.json());
    app.use('/api/files', createFilesRoutes(config));

    // Add error handling
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });

    server = app.listen(0); // Random port
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('POST /api/files/upload', () => {
    it('should upload a PNG image successfully', async () => {
      const imageBuffer = await createTestImageBuffer(200, 200);

      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', imageBuffer, 'test.png')
        .field('folder', 'test-uploads')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeDefined();
      expect(response.body.file.name).toBe('test.png');
      expect(response.body.file.type).toBe('image/png');
      expect(response.body.file.validation.warnings).toBeDefined();
    });

    it('should upload a PDF successfully', async () => {
      const pdfBuffer = createTestPDFBuffer();

      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', pdfBuffer, 'document.pdf')
        .field('folder', 'documents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeDefined();
      expect(response.body.file.name).toBe('document.pdf');
      expect(response.body.file.type).toBe('application/pdf');
    });

    it('should reject file with disallowed extension', async () => {
      const exeBuffer = Buffer.from('fake executable');

      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', exeBuffer, 'malware.exe')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('File extension .exe not allowed');
    });

    it('should reject files exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB

      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', largeBuffer, 'large.png')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('File too large');
    });

    it('should return error when no file provided', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .expect(400);

      expect(response.body.error).toBe('No file provided');
    });
  });

  describe('POST /api/files/upload/multiple', () => {
    it('should upload multiple files successfully', async () => {
      const imageBuffer = await createTestImageBuffer(100, 100);
      const pdfBuffer = createTestPDFBuffer();

      const response = await request(app)
        .post('/api/files/upload/multiple')
        .attach('files', imageBuffer, 'image1.png')
        .attach('files', pdfBuffer, 'doc1.pdf')
        .field('folder', 'batch-upload')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.uploaded).toHaveLength(2);
      expect(response.body.summary.total).toBe(2);
      expect(response.body.summary.successful).toBe(2);
      expect(response.body.summary.failed).toBe(0);
    });

    it('should handle mixed success and failure', async () => {
      const imageBuffer = await createTestImageBuffer(100, 100);
      const exeBuffer = Buffer.from('fake executable');

      const response = await request(app)
        .post('/api/files/upload/multiple')
        .attach('files', imageBuffer, 'image2.png')
        .attach('files', exeBuffer, 'bad.exe')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.uploaded).toHaveLength(1);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.summary.successful).toBe(1);
      expect(response.body.summary.failed).toBe(1);
    });
  });

  describe('GET /api/files/upload/url', () => {
    it('should generate presigned upload URL', async () => {
      const response = await request(app)
        .get('/api/files/upload/url')
        .query({
          fileName: 'test.png',
          contentType: 'image/png',
          folder: 'presigned',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.uploadUrl).toBeDefined();
      expect(response.body.key).toBeDefined();
    });

    it('should return error when missing required parameters', async () => {
      const response = await request(app)
        .get('/api/files/upload/url')
        .query({ fileName: 'test.png' })
        .expect(400);

      expect(response.body.error).toContain('contentType are required');
    });
  });

  describe('GET /api/files/download/url', () => {
    it('should generate presigned download URL', async () => {
      const response = await request(app)
        .get('/api/files/download/url')
        .query({
          key: 'uploads/test.png',
          expiresIn: 3600,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.downloadUrl).toBeDefined();
    });

    it('should return error when key is missing', async () => {
      const response = await request(app)
        .get('/api/files/download/url')
        .expect(400);

      expect(response.body.error).toContain('File key is required');
    });
  });

  describe('POST /api/files/upload/multipart/create', () => {
    it('should create multipart upload', async () => {
      const response = await request(app)
        .post('/api/files/upload/multipart/create')
        .send({
          fileName: 'large-video.mp4',
          contentType: 'video/mp4',
          folder: 'videos',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.upload).toBeDefined();
      expect(response.body.upload.uploadId).toBeDefined();
      expect(response.body.upload.key).toBeDefined();
      expect(response.body.upload.partUrls).toBeDefined();
    });
  });

  describe('POST /api/files/upload/multipart/complete', () => {
    it('should complete multipart upload', async () => {
      const response = await request(app)
        .post('/api/files/upload/multipart/complete')
        .send({
          uploadId: 'test-upload-id',
          key: 'uploads/test.mp4',
          parts: [
            { PartNumber: 1, ETag: 'etag1' },
            { PartNumber: 2, ETag: 'etag2' },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeDefined();
    });
  });

  describe('GET /api/files/info/:key', () => {
    it('should get file information', async () => {
      const response = await request(app)
        .get('/api/files/info/uploads/test.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.file).toBeDefined();
      expect(response.body.file.key).toBe('uploads/test.png');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/api/files/info/non-existent/file.png')
        .expect(404);

      expect(response.body.error).toBe('File not found');
    });
  });

  describe('GET /api/files/list', () => {
    it('should list files in bucket', async () => {
      const response = await request(app)
        .get('/api/files/list')
        .query({ prefix: 'uploads/', maxKeys: 50 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toBeDefined();
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.count).toBeDefined();
    });
  });

  describe('DELETE /api/files/:key', () => {
    it('should delete file successfully', async () => {
      const response = await request(app)
        .delete('/api/files/uploads/test.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('File deleted successfully');
    });
  });

  describe('POST /api/files/process/:key', () => {
    it('should process existing image', async () => {
      const response = await request(app)
        .post('/api/files/process/uploads/test.png')
        .send({
          format: 'webp',
          quality: 85,
          width: 150,
          height: 150,
          stripMetadata: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.original).toBeDefined();
      expect(response.body.processed).toBeDefined();
      expect(response.body.processing).toBeDefined();
      expect(response.body.processing.compressionRatio).toBeGreaterThan(0);
    });

    it('should return error for non-image file', async () => {
      const response = await request(app)
        .post('/api/files/process/uploads/document.pdf')
        .send({ format: 'jpeg' })
        .expect(400);

      expect(response.body.error).toBe('File is not an image');
    });
  });

  describe('GET /api/files/scanner/status', () => {
    it('should return scanner status when disabled', async () => {
      const response = await request(app)
        .get('/api/files/scanner/status')
        .expect(503);

      expect(response.body.enabled).toBe(false);
      expect(response.body.error).toContain('Virus scanner not available');
    });
  });

  describe('POST /api/files/scanner/update-database', () => {
    it('should return error when scanner is disabled', async () => {
      const response = await request(app)
        .post('/api/files/scanner/update-database')
        .expect(503);

      expect(response.body.enabled).toBe(false);
      expect(response.body.error).toContain('Virus scanner not available');
    });
  });
});