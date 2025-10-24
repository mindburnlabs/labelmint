import sharp, { FormatEnum, OutputInfo } from 'sharp';
import crypto from 'crypto';
import path from 'path';

export interface ProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    position?: number | string;
    withoutEnlargement?: boolean;
  };
  quality?: number;
  format?: keyof FormatEnum;
  stripMetadata?: boolean;
  autoRotate?: boolean;
  normalize?: boolean;
  sharpen?: boolean;
  blur?: number;
  crop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  grayscale?: boolean;
  tint?: string;
  composite?: Array<{
    input: Buffer;
    blend?: 'over' | 'in' | 'out' | 'atop' | 'xor' | 'add' | 'saturate' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';
    left?: number;
    top?: number;
  }>;
}

export interface ThumbnailOptions {
  size: {
    width: number;
    height: number;
  };
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ProcessedImage {
  buffer: Buffer;
  info: OutputInfo;
  checksum: string;
  originalSize: number;
  compressionRatio: number;
}

export interface ProcessedThumbnails {
  small?: Buffer;
  medium?: Buffer;
  large?: Buffer;
  info?: {
    small?: OutputInfo;
    medium?: OutputInfo;
    large?: OutputInfo;
  };
}

class ImageProcessor {
  private readonly supportedFormats = ['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'];

  /**
   * Process image with Sharp
   */
  async processImage(
    buffer: Buffer,
    options: ProcessingOptions = {}
  ): Promise<ProcessedImage> {
    const originalSize = buffer.length;
    let pipeline = sharp(buffer);

    try {
      // Auto-rotate based on EXIF orientation
      if (options.autoRotate !== false) {
        pipeline = pipeline.rotate();
      }

      // Strip metadata (EXIF, XMP, etc.)
      if (options.stripMetadata !== false) {
        pipeline = pipeline.withoutMetadata();
      }

      // Crop if specified
      if (options.crop) {
        pipeline = pipeline.extract({
          left: options.crop.left,
          top: options.crop.top,
          width: options.crop.width,
          height: options.crop.height,
        });
      }

      // Resize if specified
      if (options.resize) {
        pipeline = pipeline.resize(
          options.resize.width,
          options.resize.height,
          {
            fit: options.resize.fit || 'inside',
            position: options.resize.position || 'center',
            withoutEnlargement: options.resize.withoutEnlargement || false,
          }
        );
      }

      // Normalize if requested
      if (options.normalize) {
        pipeline = pipeline.normalize();
      }

      // Grayscale if requested
      if (options.grayscale) {
        pipeline = pipeline.greyscale();
      }

      // Tint if specified
      if (options.tint) {
        pipeline = pipeline.tint(options.tint);
      }

      // Blur if specified
      if (options.blur && options.blur > 0) {
        pipeline = pipeline.blur(options.blur);
      }

      // Sharpen if requested
      if (options.sharpen) {
        pipeline = pipeline.sharpen();
      }

      // Composite if specified
      if (options.composite && options.composite.length > 0) {
        pipeline = pipeline.composite(options.composite);
      }

      // Set format and quality
      if (options.format) {
        switch (options.format) {
          case 'jpeg':
            pipeline = pipeline.jpeg({
              quality: options.quality || 80,
              progressive: true,
            });
            break;
          case 'png':
            pipeline = pipeline.png({
              quality: options.quality || 80,
              progressive: true,
              compressionLevel: 9,
            });
            break;
          case 'webp':
            pipeline = pipeline.webp({
              quality: options.quality || 80,
              effort: 6,
            });
            break;
          case 'gif':
            pipeline = pipeline.gif({
              effort: 10,
            });
            break;
          case 'tiff':
            pipeline = pipeline.tiff({
              quality: options.quality || 80,
              compression: 'jpeg',
            });
            break;
          case 'avif':
            pipeline = pipeline.avif({
              quality: options.quality || 80,
              effort: 6,
            });
            break;
          default:
            pipeline = pipeline.jpeg({ quality: options.quality || 80 });
        }
      } else {
        // Default to JPEG with 80% quality if no format specified
        pipeline = pipeline.jpeg({
          quality: options.quality || 80,
          progressive: true,
        });
      }

      // Process the image
      const { data, info } = await pipeline.toBuffer({
        resolveWithObject: true,
      });

      // Calculate compression ratio
      const compressionRatio = originalSize > 0 ? originalSize / data.length : 1;

      // Generate checksum
      const checksum = this.generateChecksum(data);

      return {
        buffer: data,
        info,
        checksum,
        originalSize,
        compressionRatio,
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate multiple thumbnail sizes
   */
  async generateThumbnails(
    buffer: Buffer,
    sizes: {
      small?: ThumbnailOptions;
      medium?: ThumbnailOptions;
      large?: ThumbnailOptions;
    }
  ): Promise<ProcessedThumbnails> {
    const thumbnails: ProcessedThumbnails = {};
    const info: ProcessedThumbnails['info'] = {};

    // Generate small thumbnail
    if (sizes.small) {
      const result = await this.generateThumbnail(buffer, sizes.small);
      thumbnails.small = result.buffer;
      info.small = result.info;
    }

    // Generate medium thumbnail
    if (sizes.medium) {
      const result = await this.generateThumbnail(buffer, sizes.medium);
      thumbnails.medium = result.buffer;
      info.medium = result.info;
    }

    // Generate large thumbnail
    if (sizes.large) {
      const result = await this.generateThumbnail(buffer, sizes.large);
      thumbnails.large = result.buffer;
      info.large = result.info;
    }

    thumbnails.info = info;
    return thumbnails;
  }

  /**
   * Generate a single thumbnail
   */
  private async generateThumbnail(
    buffer: Buffer,
    options: ThumbnailOptions
  ): Promise<{ buffer: Buffer; info: OutputInfo }> {
    let pipeline = sharp(buffer);

    // Auto-rotate based on EXIF
    pipeline = pipeline.rotate();

    // Strip metadata
    pipeline = pipeline.withoutMetadata();

    // Resize
    pipeline = pipeline.resize(options.size.width, options.size.height, {
      fit: options.fit || 'cover',
      position: 'center',
      withoutEnlargement: true,
    });

    // Set format and quality
    switch (options.format) {
      case 'png':
        pipeline = pipeline.png({
          quality: options.quality || 70,
          progressive: true,
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({
          quality: options.quality || 70,
          effort: 4,
        });
        break;
      default:
        pipeline = pipeline.jpeg({
          quality: options.quality || 70,
          progressive: true,
        });
    }

    return await pipeline.toBuffer({ resolveWithObject: true });
  }

  /**
   * Optimize image for web
   */
  async optimizeForWeb(buffer: Buffer, mimeType: string): Promise<ProcessedImage> {
    let options: ProcessingOptions = {
      stripMetadata: true,
      autoRotate: true,
    };

    // Determine optimal format and settings based on image characteristics
    const metadata = await sharp(buffer).metadata();

    // For PNG with transparency, consider WebP
    if (mimeType === 'image/png' && metadata.hasAlpha) {
      options.format = 'webp';
      options.quality = 80;
    }
    // For JPEG, optimize quality
    else if (mimeType === 'image/jpeg') {
      options.format = 'jpeg';
      options.quality = 85;
    }
    // For other formats, convert to WebP
    else {
      options.format = 'webp';
      options.quality = 80;
    }

    // Resize if image is too large
    if (metadata.width && metadata.width > 2048) {
      options.resize = {
        width: 2048,
        height: 2048,
        fit: 'inside',
        withoutEnlargement: true,
      };
    }

    return this.processImage(buffer, options);
  }

  /**
   * Extract EXIF data before stripping
   */
  async extractMetadata(buffer: Buffer): Promise<{
    exif?: any;
    iptc?: any;
    xmp?: any;
    format: string;
    size: { width: number; height: number };
    orientation?: number;
    hasAlpha?: boolean;
    channels?: number;
    density?: number;
  }> {
    const metadata = await sharp(buffer).metadata();

    return {
      format: metadata.format,
      size: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
      orientation: metadata.orientation,
      hasAlpha: metadata.hasAlpha,
      channels: metadata.channels,
      density: metadata.density,
      exif: metadata.exif ? this.parseExif(metadata.exif) : undefined,
      iptc: metadata.iptc ? this.parseIPTC(metadata.iptc) : undefined,
      xmp: metadata.xmp ? this.parseXMP(metadata.xmp) : undefined,
    };
  }

  /**
   * Parse EXIF data (simplified)
   */
  private parseExif(exifBuffer: Buffer): any {
    // In production, you'd use a proper EXIF parser like exifr
    try {
      // This is a simplified example
      const exifStr = exifBuffer.toString('utf8', 0, Math.min(1024, exifBuffer.length));
      return { raw: exifStr };
    } catch {
      return { error: 'Failed to parse EXIF' };
    }
  }

  /**
   * Parse IPTC data (simplified)
   */
  private parseIPTC(iptcBuffer: Buffer): any {
    try {
      const iptcStr = iptcBuffer.toString('utf8', 0, Math.min(1024, iptcBuffer.length));
      return { raw: iptcStr };
    } catch {
      return { error: 'Failed to parse IPTC' };
    }
  }

  /**
   * Parse XMP data (simplified)
   */
  private parseXMP(xmpBuffer: Buffer): any {
    try {
      const xmpStr = xmpBuffer.toString('utf8', 0, Math.min(1024, xmpBuffer.length));
      return { raw: xmpStr };
    } catch {
      return { error: 'Failed to parse XMP' };
    }
  }

  /**
   * Apply watermark to image
   */
  async applyWatermark(
    imageBuffer: Buffer,
    watermarkBuffer: Buffer,
    options: {
      position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      opacity?: number;
      scale?: number;
    } = {}
  ): Promise<ProcessedImage> {
    const opacity = options.opacity || 0.5;
    const scale = options.scale || 0.2;

    // Get image dimensions
    const imageMeta = await sharp(imageBuffer).metadata();
    const watermarkMeta = await sharp(watermarkBuffer).metadata();

    if (!imageMeta.width || !imageMeta.height || !watermarkMeta.width || !watermarkMeta.height) {
      throw new Error('Unable to determine image or watermark dimensions');
    }

    // Calculate watermark size and position
    const watermarkWidth = Math.floor(imageMeta.width * scale);
    const watermarkHeight = Math.floor((watermarkMeta.height / watermarkMeta.width) * watermarkWidth);

    let left = 0;
    let top = 0;

    switch (options.position) {
      case 'center':
        left = Math.floor((imageMeta.width - watermarkWidth) / 2);
        top = Math.floor((imageMeta.height - watermarkHeight) / 2);
        break;
      case 'top-right':
        left = imageMeta.width - watermarkWidth - 20;
        top = 20;
        break;
      case 'bottom-left':
        left = 20;
        top = imageMeta.height - watermarkHeight - 20;
        break;
      case 'bottom-right':
        left = imageMeta.width - watermarkWidth - 20;
        top = imageMeta.height - watermarkHeight - 20;
        break;
      default: // top-left
        left = 20;
        top = 20;
    }

    // Resize watermark
    const resizedWatermark = await sharp(watermarkBuffer)
      .resize(watermarkWidth, watermarkHeight)
      .png()
      .toBuffer();

    // Composite watermark
    const pipeline = sharp(imageBuffer)
      .composite([{
        input: resizedWatermark,
        left,
        top,
        blend: 'over',
      }]);

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      info,
      checksum: this.generateChecksum(data),
      originalSize: imageBuffer.length,
      compressionRatio: imageBuffer.length / data.length,
    };
  }

  /**
   * Convert image to specified format
   */
  async convertFormat(
    buffer: Buffer,
    targetFormat: keyof FormatEnum,
    quality: number = 80
  ): Promise<ProcessedImage> {
    const options: ProcessingOptions = {
      format: targetFormat,
      quality,
      stripMetadata: true,
      autoRotate: true,
    };

    return this.processImage(buffer, options);
  }

  /**
   * Generate SHA-256 checksum
   */
  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if format is supported
   */
  isFormatSupported(format: string): boolean {
    return this.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Calculate optimal quality based on file size and dimensions
   */
  calculateOptimalQuality(buffer: Buffer): number {
    const sizeInMB = buffer.length / (1024 * 1024);

    if (sizeInMB > 10) {
      return 60; // Lower quality for large files
    } else if (sizeInMB > 5) {
      return 70;
    } else if (sizeInMB > 1) {
      return 80;
    } else {
      return 90; // Higher quality for small files
    }
  }

  /**
   * Create placeholder image
   */
  async createPlaceholder(
    width: number,
    height: number,
    options: {
      color?: string;
      text?: string;
      textColor?: string;
    } = {}
  ): Promise<Buffer> {
    const color = options.color || '#f0f0f0';
    const textColor = options.textColor || '#999999';
    const text = options.text || `${width}×${height}`;

    // Create SVG for placeholder
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${color}"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em"
              font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 10}"
              fill="${textColor}">${text}</text>
      </svg>
    `;

    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }
}

export default ImageProcessor;