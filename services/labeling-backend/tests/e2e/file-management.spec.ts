import { test, expect, request } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('File Management E2E Tests', () => {
  let apiContext: APIRequestContext;
  const testFiles = {
    image: path.join(__dirname, '../fixtures/test-image.png'),
    pdf: path.join(__dirname, '../fixtures/test-document.pdf'),
    large: path.join(__dirname, '../fixtures/large-file.jpg'),
  };

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    });

    // Create test fixtures directory
    const fixturesDir = path.dirname(testFiles.image);
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Create test image (1x1 pixel PNG)
    const testImagePng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x18, 0xDD, 0x8D, 0xB4, 0x1C, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testFiles.image, testImagePng);

    // Create test PDF header
    const testPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000079 00000 n\n0000000173 00000 n\n0000000301 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n398\n%%EOF');
    fs.writeFileSync(testFiles.pdf, testPdf);

    // Create larger test file (5MB)
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024);
    largeBuffer.fill('A');
    fs.writeFileSync(testFiles.large, largeBuffer);
  });

  test.afterAll(async () => {
    await apiContext.dispose();

    // Clean up test files
    Object.values(testFiles).forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  test('should upload single file via API', async () => {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFiles.image), 'test.png');
    formData.append('folder', 'e2e-tests');

    const response = await apiContext.post('/api/files/upload', {
      multipart: formData,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.file.name).toBe('test.png');
    expect(data.file.type).toBe('image/png');
  });

  test('should upload multiple files via API', async () => {
    const formData = new FormData();
    formData.append('files', fs.createReadStream(testFiles.image), 'image1.png');
    formData.append('files', fs.createReadStream(testFiles.pdf), 'doc1.pdf');
    formData.append('folder', 'e2e-batch');

    const response = await apiContext.post('/api/files/upload/multiple', {
      multipart: formData,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.uploaded).toHaveLength(2);
    expect(data.summary.successful).toBe(2);
  });

  test('should get presigned upload URL', async () => {
    const response = await apiContext.get('/api/files/upload/url', {
      params: {
        fileName: 'presigned-test.png',
        contentType: 'image/png',
        folder: 'presigned',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.uploadUrl).toContain('amazonaws.com');
    expect(data.key).toContain('presigned-test.png');
  });

  test('should list uploaded files', async () => {
    const response = await apiContext.get('/api/files/list', {
      params: {
        prefix: 'e2e-tests/',
        maxKeys: 10,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.files)).toBe(true);
  });

  test('should reject oversized file', async () => {
    // Temporarily set max size to 1MB
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFiles.large), 'large.jpg');

    const response = await apiContext.post('/api/files/upload', {
      multipart: formData,
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('File too large');
  });

  test('should reject dangerous file types', async () => {
    const dangerousFile = path.join(__dirname, '../fixtures/malware.exe');
    fs.writeFileSync(dangerousFile, Buffer.from('fake exe content'));

    const formData = new FormData();
    formData.append('file', fs.createReadStream(dangerousFile), 'malware.exe');

    const response = await apiContext.post('/api/files/upload', {
      multipart: formData,
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('not allowed');

    fs.unlinkSync(dangerousFile);
  });

  test('should process image with different formats', async () => {
    // First upload an image
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFiles.image), 'process-test.png');
    formData.append('folder', 'processing');

    const uploadResponse = await apiContext.post('/api/files/upload', {
      multipart: formData,
    });

    expect(uploadResponse.ok()).toBeTruthy();
    const uploadData = await uploadResponse.json();

    // Process the uploaded image
    const processResponse = await apiContext.post(`/api/files/process/${uploadData.file.key}`, {
      data: {
        format: 'webp',
        quality: 90,
        width: 50,
        height: 50,
        stripMetadata: true,
      },
    });

    expect(processResponse.ok()).toBeTruthy();
    const processData = await processResponse.json();
    expect(processData.success).toBe(true);
    expect(processData.original.key).toBe(uploadData.file.key);
    expect(processData.processed.format).toBe('webp');
    expect(processData.processing.compressionRatio).toBeGreaterThan(0);
  });

  test('should handle file deletion', async () => {
    // Upload a file first
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFiles.image), 'delete-test.png');
    formData.append('folder', 'delete-test');

    const uploadResponse = await apiContext.post('/api/files/upload', {
      multipart: formData,
    });

    expect(uploadResponse.ok()).toBeTruthy();
    const uploadData = await uploadResponse.json();

    // Delete the file
    const deleteResponse = await apiContext.delete(`/api/files/${uploadData.file.key}`);
    expect(deleteResponse.ok()).toBeTruthy();
    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);

    // Verify file is deleted
    const getInfoResponse = await apiContext.get(`/api/files/info/${uploadData.file.key}`);
    expect(getInfoResponse.status()).toBe(404);
  });

  test('should create and complete multipart upload', async () => {
    // Create multipart upload
    const createResponse = await apiContext.post('/api/files/upload/multipart/create', {
      data: {
        fileName: 'multipart-test.mp4',
        contentType: 'video/mp4',
        folder: 'multipart',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    expect(createData.success).toBe(true);
    expect(createData.upload.uploadId).toBeDefined();
    expect(createData.upload.partUrls).toHaveLength(10);

    // Complete multipart upload (mock completion)
    const completeResponse = await apiContext.post('/api/files/upload/multipart/complete', {
      data: {
        uploadId: createData.upload.uploadId,
        key: createData.upload.key,
        parts: [
          { PartNumber: 1, ETag: 'etag1' },
          { PartNumber: 2, ETag: 'etag2' },
        ],
      },
    });

    expect(completeResponse.ok()).toBeTruthy();
    const completeData = await completeResponse.json();
    expect(completeData.success).toBe(true);
    expect(completeData.file.key).toBe(createData.upload.key);
  });

  test('should handle concurrent uploads', async () => {
    const uploadPromises = Array.from({ length: 5 }, async (_, i) => {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFiles.image), `concurrent-${i}.png`);
      formData.append('folder', 'concurrent');

      return apiContext.post('/api/files/upload', {
        multipart: formData,
      });
    });

    const responses = await Promise.all(uploadPromises);

    // All uploads should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });

    const data = await Promise.all(responses.map(r => r.json()));
    data.forEach(d => {
      expect(d.success).toBe(true);
      expect(d.file.name).toMatch(/^concurrent-\d+\.png$/);
    });
  });
});