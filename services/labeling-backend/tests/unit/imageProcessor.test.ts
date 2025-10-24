import ImageProcessor from '../../src/services/imageProcessor';
import { createTestImageBuffer } from '../setup';
import sharp from 'sharp';

// Mock sharp to avoid dependency on system libraries
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    withoutMetadata: jest.fn().mockReturnThis(),
    extract: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    greyscale: jest.fn().mockReturnThis(),
    tint: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    composite: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    gif: jest.fn().mockReturnThis(),
    tiff: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue({
      data: Buffer.from('processed image'),
      info: {
        format: 'jpeg',
        width: 100,
        height: 100,
        size: 1000,
        channels: 3,
        premultiplied: false,
      },
    }),
  }));

  // Mock metadata function
  (mockSharp as any).metadata = jest.fn().mockResolvedValue({
    format: 'png',
    width: 100,
    height: 100,
    channels: 4,
    hasAlpha: true,
  });

  return mockSharp;
});

describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  let testImageBuffer: Buffer;

  beforeAll(async () => {
    processor = new ImageProcessor();
    testImageBuffer = await createTestImageBuffer(200, 200);
  });

  describe('processImage', () => {
    it('should process an image with default options', async () => {
      const result = await processor.processImage(testImageBuffer);

      expect(result.buffer).toBeDefined();
      expect(result.info).toBeDefined();
      expect(result.checksum).toBeDefined();
      expect(result.originalSize).toBe(testImageBuffer.length);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should process image with resize options', async () => {
      const options = {
        resize: {
          width: 150,
          height: 150,
          fit: 'inside' as const,
        },
      };

      const result = await processor.processImage(testImageBuffer, options);

      expect(result.buffer).toBeDefined();
      expect(sharp).toHaveBeenCalledWith(testImageBuffer);
    });

    it('should process image with different format', async () => {
      const options = {
        format: 'webp' as const,
        quality: 90,
      };

      const result = await processor.processImage(testImageBuffer, options);

      expect(result.buffer).toBeDefined();
      expect(result.checksum).toBeDefined();
    });

    it('should process image with grayscale filter', async () => {
      const options = {
        grayscale: true,
      };

      const result = await processor.processImage(testImageBuffer, options);

      expect(result.buffer).toBeDefined();
    });

    it('should handle processing errors gracefully', async () => {
      // Mock sharp to throw an error
      (sharp as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Processing failed');
      });

      await expect(processor.processImage(testImageBuffer)).rejects.toThrow(
        'Image processing failed'
      );
    });
  });

  describe('generateThumbnails', () => {
    it('should generate multiple thumbnail sizes', async () => {
      const sizes = {
        small: { size: { width: 50, height: 50 }, quality: 70, format: 'jpeg' as const },
        medium: { size: { width: 100, height: 100 }, quality: 75, format: 'jpeg' as const },
        large: { size: { width: 150, height: 150 }, quality: 80, format: 'jpeg' as const },
      };

      const result = await processor.generateThumbnails(testImageBuffer, sizes);

      expect(result.small).toBeDefined();
      expect(result.medium).toBeDefined();
      expect(result.large).toBeDefined();
      expect(result.info).toBeDefined();
    });

    it('should generate only requested thumbnail sizes', async () => {
      const sizes = {
        medium: { size: { width: 100, height: 100 }, quality: 75, format: 'jpeg' as const },
      };

      const result = await processor.generateThumbnails(testImageBuffer, sizes);

      expect(result.medium).toBeDefined();
      expect(result.small).toBeUndefined();
      expect(result.large).toBeUndefined();
    });
  });

  describe('optimizeForWeb', () => {
    it('should optimize PNG for web', async () => {
      const pngBuffer = Buffer.from('fake png with alpha');
      const result = await processor.optimizeForWeb(pngBuffer, 'image/png');

      expect(result.buffer).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should optimize JPEG for web', async () => {
      const jpegBuffer = Buffer.from('fake jpeg');
      const result = await processor.optimizeForWeb(jpegBuffer, 'image/jpeg');

      expect(result.buffer).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should convert other formats to WebP', async () => {
      const genericBuffer = Buffer.from('fake image');
      const result = await processor.optimizeForWeb(genericBuffer, 'image/tiff');

      expect(result.buffer).toBeDefined();
    });
  });

  describe('extractMetadata', () => {
    it('should extract image metadata', async () => {
      const result = await processor.extractMetadata(testImageBuffer);

      expect(result.format).toBe('png');
      expect(result.size.width).toBe(100);
      expect(result.size.height).toBe(100);
      expect(result.hasAlpha).toBe(true);
    });
  });

  describe('applyWatermark', () => {
    it('should apply watermark to image', async () => {
      const watermarkBuffer = Buffer.from('fake watermark');
      const result = await processor.applyWatermark(testImageBuffer, watermarkBuffer, {
        position: 'center',
        opacity: 0.5,
      });

      expect(result.buffer).toBeDefined();
      expect(result.checksum).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should apply watermark at different positions', async () => {
      const watermarkBuffer = Buffer.from('fake watermark');
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

      for (const position of positions) {
        const result = await processor.applyWatermark(testImageBuffer, watermarkBuffer, {
          position,
        });
        expect(result.buffer).toBeDefined();
      }
    });
  });

  describe('convertFormat', () => {
    it('should convert image to WebP format', async () => {
      const result = await processor.convertFormat(testImageBuffer, 'webp', 85);

      expect(result.buffer).toBeDefined();
      expect(result.info.format).toBe('webp');
    });

    it('should convert image to JPEG format', async () => {
      const result = await processor.convertFormat(testImageBuffer, 'jpeg', 90);

      expect(result.buffer).toBeDefined();
      expect(result.info.format).toBe('jpeg');
    });
  });

  describe('utility functions', () => {
    it('should check if format is supported', () => {
      expect(processor.isFormatSupported('jpeg')).toBe(true);
      expect(processor.isFormatSupported('png')).toBe(true);
      expect(processor.isFormatSupported('webp')).toBe(true);
      expect(processor.isFormatSupported('unknown')).toBe(false);
    });

    it('should get supported formats', () => {
      const formats = processor.getSupportedFormats();
      expect(formats).toContain('jpeg');
      expect(formats).toContain('png');
      expect(formats).toContain('webp');
    });

    it('should calculate optimal quality based on file size', () => {
      const smallBuffer = Buffer.alloc(500 * 1024); // 500KB
      const mediumBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB

      expect(processor.calculateOptimalQuality(smallBuffer)).toBe(90);
      expect(processor.calculateOptimalQuality(mediumBuffer)).toBe(80);
      expect(processor.calculateOptimalQuality(largeBuffer)).toBe(60);
    });

    it('should create placeholder image', async () => {
      const placeholder = await processor.createPlaceholder(300, 200, {
        color: '#ff0000',
        text: 'Test Placeholder',
      });

      expect(placeholder).toBeInstanceOf(Buffer);
      expect(placeholder.length).toBeGreaterThan(0);
    });
  });
});