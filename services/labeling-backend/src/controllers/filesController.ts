import { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import S3Service, { S3Config, UploadOptions } from '../services/s3Service';
import VirusScanner from '../services/virusScanner';
import FileValidator, { FileValidationConfig, ImageOptimizationRule, DocumentSecurityRule } from '../services/fileValidator';
import ImageProcessor from '../services/imageProcessor';
import path from 'path';

interface FileManagementConfig {
  s3: S3Config;
  virusScanner?: {
    enabled: boolean;
    config?: any;
  };
  validator: FileValidationConfig;
  imageProcessing?: {
    enabled: boolean;
    autoOptimize: boolean;
    generateThumbnails: boolean;
    thumbnailSizes: {
      small: { width: number; height: number };
      medium: { width: number; height: number };
      large: { width: number; height: number };
    };
  };
}

class FilesController {
  private s3Service: S3Service;
  private virusScanner?: VirusScanner;
  private fileValidator: FileValidator;
  private imageProcessor: ImageProcessor;
  private config: FileManagementConfig;
  private upload: multer.Multer;

  constructor(config: FileManagementConfig) {
    this.config = config;
    this.s3Service = new S3Service(config.s3);
    this.fileValidator = new FileValidator(config.validator);
    this.imageProcessor = new ImageProcessor();

    // Initialize virus scanner if enabled
    if (config.virusScanner?.enabled) {
      this.virusScanner = new VirusScanner(config.virusScanner.config);
    }

    // Initialize multer for file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: config.validator.maxFileSize || 50 * 1024 * 1024, // 50MB default
      },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = config.validator.allowedExtensions || ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx'];

        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`File extension ${ext} not allowed`));
        }
      },
    });

    // Add custom validation rules
    this.fileValidator.addCustomRule(ImageOptimizationRule);
    this.fileValidator.addCustomRule(DocumentSecurityRule);
  }

  /**
   * Get middleware for handling file uploads
   */
  getUploadMiddleware() {
    return this.upload;
  }

  /**
   * Upload a single file
   */
  uploadSingle = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const file = req.file;
      const folder = req.body.folder || 'uploads';
      const processing = JSON.parse(req.body.processing || '{}');

      // Validate file
      const validation = await this.fileValidator.validateFile(file.buffer, file.originalname);

      if (!validation.valid) {
        res.status(400).json({
          error: 'File validation failed',
          details: validation.errors,
          warnings: validation.warnings,
        });
        return;
      }

      // Virus scan if enabled
      let scanResult;
      if (this.virusScanner) {
        try {
          scanResult = await this.virusScanner.scanBuffer(file.buffer, file.originalname);

          if (scanResult.isInfected) {
            res.status(403).json({
              error: 'File contains malware',
              threats: scanResult.threats,
            });
            return;
          }
        } catch (scanError) {
          console.error('Virus scan failed:', scanError);
          res.status(500).json({
            error: 'Virus scan failed',
            message: 'Unable to scan file for malware',
          });
          return;
        }
      }

      // Prepare upload options
      const uploadOptions: UploadOptions = {
        folder,
        maxSize: this.config.validator.maxFileSize,
        allowedTypes: this.config.validator.allowedMimeTypes,
      };

      // Add image processing if enabled and file is an image
      if (this.config.imageProcessing?.enabled && file.mimetype.startsWith('image/')) {
        let imageProcessing: any = {
          stripMetadata: true,
        };

        // Auto-optimize if enabled
        if (this.config.imageProcessing.autoOptimize) {
          const optimized = await this.imageProcessor.optimizeForWeb(file.buffer, file.mimetype);
          file.buffer = optimized.buffer;
          imageProcessing = {
            ...imageProcessing,
            quality: this.imageProcessor.calculateOptimalQuality(file.buffer),
          };
        }

        // Generate thumbnails if enabled
        if (this.config.imageProcessing.generateThumbnails) {
          imageProcessing.generateThumbnail = true;
          imageProcessing.thumbnailSize = this.config.imageProcessing.thumbnailSizes.medium;
        }

        uploadOptions.imageProcessing = imageProcessing;
      }

      // Upload to S3
      const uploadResult = await this.s3Service.uploadBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        uploadOptions
      );

      // Generate additional thumbnails if needed
      let thumbnails: any = {};
      if (this.config.imageProcessing?.generateThumbnails && file.mimetype.startsWith('image/')) {
        const { small, medium, large } = this.config.imageProcessing.thumbnailSizes;

        if (small || medium || large) {
          const generated = await this.imageProcessor.generateThumbnails(file.buffer, {
            small: small ? { size: small, quality: 70, format: 'jpeg' } : undefined,
            medium: medium ? { size: medium, quality: 75, format: 'jpeg' } : undefined,
            large: large ? { size: large, quality: 80, format: 'jpeg' } : undefined,
          });

          // Upload thumbnails to S3
          if (generated.small) {
            const smallKey = `thumbnails/${path.basename(uploadResult.key, path.extname(uploadResult.key))}_small.jpg`;
            await this.s3Service.uploadBuffer(
              generated.small,
              `thumb_small_${file.originalname}`,
              'image/jpeg',
              { folder: path.dirname(uploadResult.key).replace('uploads', 'thumbnails') }
            );
            thumbnails.small = this.s3Service.getObjectUrl(smallKey);
          }

          if (generated.medium) {
            const mediumKey = `thumbnails/${path.basename(uploadResult.key, path.extname(uploadResult.key))}_medium.jpg`;
            await this.s3Service.uploadBuffer(
              generated.medium,
              `thumb_medium_${file.originalname}`,
              'image/jpeg',
              { folder: path.dirname(uploadResult.key).replace('uploads', 'thumbnails') }
            );
            thumbnails.medium = this.s3Service.getObjectUrl(mediumKey);
          }

          if (generated.large) {
            const largeKey = `thumbnails/${path.basename(uploadResult.key, path.extname(uploadResult.key))}_large.jpg`;
            await this.s3Service.uploadBuffer(
              generated.large,
              `thumb_large_${file.originalname}`,
              'image/jpeg',
              { folder: path.dirname(uploadResult.key).replace('uploads', 'thumbnails') }
            );
            thumbnails.large = this.s3Service.getObjectUrl(largeKey);
          }
        }
      }

      // Return success response
      res.status(200).json({
        success: true,
        file: {
          ...uploadResult,
          name: file.originalname,
          mimetype: file.mimetype,
          validation: {
            warnings: validation.warnings,
          },
          scanResult: scanResult ? {
            clean: !scanResult.isInfected,
            threats: scanResult.threats,
            signature: scanResult.signature,
          } : undefined,
          thumbnails,
        },
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        error: 'File upload failed',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Upload multiple files
   */
  uploadMultiple = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
      }

      const files = req.files;
      const folder = req.body.folder || 'uploads';
      const results: any[] = [];
      const errors: any[] = [];

      for (const file of files) {
        try {
          // Validate file
          const validation = await this.fileValidator.validateFile(file.buffer, file.originalname);

          if (!validation.valid) {
            errors.push({
              file: file.originalname,
              error: 'Validation failed',
              details: validation.errors,
            });
            continue;
          }

          // Virus scan if enabled
          let scanResult;
          if (this.virusScanner) {
            scanResult = await this.virusScanner.scanBuffer(file.buffer, file.originalname);

            if (scanResult.isInfected) {
              errors.push({
                file: file.originalname,
                error: 'Malware detected',
                threats: scanResult.threats,
              });
              continue;
            }
          }

          // Upload to S3
          const uploadResult = await this.s3Service.uploadBuffer(
            file.buffer,
            file.originalname,
            file.mimetype,
            { folder }
          );

          results.push({
            ...uploadResult,
            name: file.originalname,
            mimetype: file.mimetype,
            scanResult: scanResult ? {
              clean: !scanResult.isInfected,
              threats: scanResult.threats,
            } : undefined,
          });
        } catch (error) {
          errors.push({
            file: file.originalname,
            error: (error as Error).message,
          });
        }
      }

      res.status(200).json({
        success: true,
        uploaded: results,
        errors,
        summary: {
          total: files.length,
          successful: results.length,
          failed: errors.length,
        },
      });
    } catch (error) {
      console.error('Multiple file upload error:', error);
      res.status(500).json({
        error: 'Multiple file upload failed',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Create multipart upload
   */
  createMultipartUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fileName, contentType, folder } = req.body;

      if (!fileName || !contentType) {
        res.status(400).json({ error: 'fileName and contentType are required' });
        return;
      }

      const result = await this.s3Service.createMultipartUpload(fileName, contentType, { folder });

      res.status(200).json({
        success: true,
        upload: result,
      });
    } catch (error) {
      console.error('Multipart upload creation error:', error);
      res.status(500).json({
        error: 'Failed to create multipart upload',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Complete multipart upload
   */
  completeMultipartUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { uploadId, key, parts } = req.body;

      if (!uploadId || !key || !parts) {
        res.status(400).json({ error: 'uploadId, key, and parts are required' });
        return;
      }

      const result = await this.s3Service.completeMultipartUpload(uploadId, key, parts);

      res.status(200).json({
        success: true,
        file: result,
      });
    } catch (error) {
      console.error('Multipart upload completion error:', error);
      res.status(500).json({
        error: 'Failed to complete multipart upload',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Get presigned upload URL
   */
  getPresignedUploadUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { fileName, contentType, folder } = req.query;

      if (!fileName || !contentType) {
        res.status(400).json({ error: 'fileName and contentType are required' });
        return;
      }

      const result = await this.s3Service.getPresignedUploadUrl(
        fileName as string,
        contentType as string,
        { folder: folder as string }
      );

      res.status(200).json({
        success: true,
        uploadUrl: result.url,
        key: result.key,
      });
    } catch (error) {
      console.error('Presigned URL generation error:', error);
      res.status(500).json({
        error: 'Failed to generate presigned upload URL',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Get presigned download URL
   */
  getPresignedDownloadUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key, expiresIn } = req.query;

      if (!key) {
        res.status(400).json({ error: 'File key is required' });
        return;
      }

      const url = await this.s3Service.getPresignedDownloadUrl(
        key as string,
        expiresIn ? parseInt(expiresIn as string) : 3600
      );

      res.status(200).json({
        success: true,
        downloadUrl: url,
      });
    } catch (error) {
      console.error('Download URL generation error:', error);
      res.status(500).json({
        error: 'Failed to generate download URL',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Get file info
   */
  getFileInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;

      if (!key) {
        res.status(400).json({ error: 'File key is required' });
        return;
      }

      const info = await this.s3Service.getObjectInfo(key);

      if (!info) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      res.status(200).json({
        success: true,
        file: info,
      });
    } catch (error) {
      console.error('File info error:', error);
      res.status(500).json({
        error: 'Failed to get file info',
        message: (error as Error).message,
      });
    }
  };

  /**
   * List files
   */
  listFiles = async (req: Request, res: Response): Promise<void> => {
    try {
      const { prefix, maxKeys } = req.query;

      const files = await this.s3Service.listObjects(
        prefix as string,
        maxKeys ? parseInt(maxKeys as string) : 100
      );

      res.status(200).json({
        success: true,
        files,
        count: files.length,
      });
    } catch (error) {
      console.error('List files error:', error);
      res.status(500).json({
        error: 'Failed to list files',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Delete file
   */
  deleteFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;

      if (!key) {
        res.status(400).json({ error: 'File key is required' });
        return;
      }

      await this.s3Service.deleteObject(key);

      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('File deletion error:', error);
      res.status(500).json({
        error: 'Failed to delete file',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Process existing image
   */
  processImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const { format, quality, width, height, stripMetadata } = req.body;

      if (!key) {
        res.status(400).json({ error: 'File key is required' });
        return;
      }

      // Get file info
      const fileInfo = await this.s3Service.getObjectInfo(key);
      if (!fileInfo) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      if (!fileInfo.type.startsWith('image/')) {
        res.status(400).json({ error: 'File is not an image' });
        return;
      }

      // Get download URL
      const downloadUrl = await this.s3Service.getPresignedDownloadUrl(key, 300); // 5 minutes

      // Fetch image
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        res.status(500).json({ error: 'Failed to download image' });
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Process image
      const options: any = {};
      if (format) options.format = format;
      if (quality) options.quality = parseInt(quality);
      if (stripMetadata !== undefined) options.stripMetadata = stripMetadata;
      if (width || height) {
        options.resize = {};
        if (width) options.resize.width = parseInt(width);
        if (height) options.resize.height = parseInt(height);
      }

      const processed = await this.imageProcessor.processImage(buffer, options);

      // Upload processed image
      const ext = path.extname(key);
      const baseName = path.basename(key, ext);
      const newKey = `${baseName}_processed.${options.format || 'jpg'}`;

      const uploadResult = await this.s3Service.uploadBuffer(
        processed.buffer,
        path.basename(newKey),
        `image/${options.format || 'jpeg'}`,
        { folder: path.dirname(key) }
      );

      res.status(200).json({
        success: true,
        original: fileInfo,
        processed: uploadResult,
        processing: {
          originalSize: processed.originalSize,
          newSize: processed.info.size,
          compressionRatio: processed.compressionRatio,
        },
      });
    } catch (error) {
      console.error('Image processing error:', error);
      res.status(500).json({
        error: 'Failed to process image',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Get ClamAV status
   */
  getScannerStatus = async (req: Request, res: Response): Promise<void> => {
    if (!this.virusScanner) {
      res.status(503).json({
        error: 'Virus scanner not available',
        enabled: false,
      });
      return;
    }

    try {
      const status = await this.virusScanner.checkClamAVStatus();

      res.status(200).json({
        enabled: true,
        ...status,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to check scanner status',
        message: (error as Error).message,
      });
    }
  };

  /**
   * Update virus database
   */
  updateVirusDatabase = async (req: Request, res: Response): Promise<void> => {
    if (!this.virusScanner) {
      res.status(503).json({
        error: 'Virus scanner not available',
        enabled: false,
      });
      return;
    }

    try {
      const result = await this.virusScanner.updateDatabase();

      res.status(200).json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update virus database',
        message: (error as Error).message,
      });
    }
  };
}

export default FilesController;