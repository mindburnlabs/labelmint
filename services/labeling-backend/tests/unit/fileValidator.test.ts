import FileValidator from '../../src/services/fileValidator';
import { createTestImageBuffer, createTestPDFBuffer } from '../setup';

describe('FileValidator', () => {
  let validator: FileValidator;

  beforeEach(() => {
    validator = new FileValidator({
      maxFileSize: 1024 * 1024, // 1MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
      blockedExtensions: ['.exe', '.bat'],
    });
  });

  describe('validateFile', () => {
    it('should validate a valid PNG image', async () => {
      const buffer = await createTestImageBuffer(100, 100);
      const result = await validator.validateFile(buffer, 'test.png');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo.type).toBe('image/png');
      expect(result.fileInfo.ext).toBe('.png');
    });

    it('should validate a valid PDF file', async () => {
      const buffer = createTestPDFBuffer();
      const result = await validator.validateFile(buffer, 'document.pdf');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo.type).toBe('application/pdf');
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB
      const result = await validator.validateFile(largeBuffer, 'large.png');

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('File too large')
      );
    });

    it('should reject files with blocked extensions', async () => {
      const buffer = Buffer.from('fake executable');
      const result = await validator.validateFile(buffer, 'malware.exe');

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('File extension .exe is not allowed')
      );
    });

    it('should reject files with disallowed MIME types', async () => {
      const buffer = Buffer.from('fake video');
      const result = await validator.validateFile(buffer, 'video.mp4');

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('MIME type video/mp4 is not allowed')
      );
    });

    it('should warn about MIME type and extension mismatch', async () => {
      const buffer = await createTestImageBuffer(100, 100);
      const result = await validator.validateFile(buffer, 'fake.jpg');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('doesn\'t match detected type')
      );
    });

    it('should generate checksum when required', async () => {
      validator.updateConfig({ requireChecksum: true });
      const buffer = Buffer.from('test content');
      const result = await validator.validateFile(buffer, 'test.txt');

      expect(result.valid).toBe(true);
      expect(result.checksum).toBeDefined();
      expect(result.checksum).toHaveLength(64); // SHA-256 hex length
    });

    it('should reject empty files', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await validator.validateFile(emptyBuffer, 'empty.png');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should apply custom validation rules', async () => {
      const customRule = {
        name: 'Test Rule',
        validate: async () => ({
          valid: false,
          error: 'Custom validation failed',
        }),
      };

      validator.addCustomRule(customRule);
      const buffer = await createTestImageBuffer(100, 100);
      const result = await validator.validateFile(buffer, 'test.png');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Test Rule: Custom validation failed');
    });
  });

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      const result = (validator as any).validateFileSize(500000); // 500KB
      expect(result.valid).toBe(true);
    });

    it('should reject files exceeding size limit', () => {
      const result = (validator as any).validateFileSize(2 * 1024 * 1024); // 2MB
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateExtension', () => {
    it('should accept allowed extensions', () => {
      const result = (validator as any).validateExtension('.png', 'image/png');
      expect(result.valid).toBe(true);
    });

    it('should reject blocked extensions', () => {
      const result = (validator as any).validateExtension('.exe', 'application/x-executable');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update validator configuration', () => {
      validator.updateConfig({
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedExtensions: ['.txt'],
      });

      const config = (validator as any).config;
      expect(config.maxFileSize).toBe(5 * 1024 * 1024);
      expect(config.allowedExtensions).toContain('.txt');
    });
  });
});