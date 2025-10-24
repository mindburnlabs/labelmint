import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import path from 'path';

export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export interface UploadOptions {
  folder?: string;
  maxSize?: number;
  allowedTypes?: string[];
  requireVirusScan?: boolean;
  generateThumbnails?: boolean;
  imageProcessing?: ImageProcessingOptions;
}

export interface ImageProcessingOptions {
  resize?: { width: number; height: number };
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  stripMetadata?: boolean;
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
}

export interface FileInfo {
  key: string;
  url: string;
  size: number;
  type: string;
  name: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
  thumbnailUrl?: string;
}

export interface MultipartUpload {
  uploadId: string;
  key: string;
  partUrls: string[];
}

class S3Service {
  private client: S3Client;
  private bucket: string;
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    });
  }

  /**
   * Generate a unique file key with optional folder prefix
   */
  private generateFileKey(originalName: string, folder?: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const name = path.basename(originalName, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_');

    const key = `${sanitizedName}_${timestamp}_${uuid}${ext}`;
    return folder ? `${folder}/${key}` : key;
  }

  /**
   * Create a multipart upload
   */
  async createMultipartUpload(
    fileName: string,
    contentType: string,
    options: UploadOptions = {}
  ): Promise<MultipartUpload> {
    const key = this.generateFileKey(fileName, options.folder);

    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        originalName: fileName,
        uploadId: uuidv4(),
      },
    });

    const response = await this.client.send(command);
    const uploadId = response.UploadId!;

    // Generate presigned URLs for each part
    const partUrls: string[] = [];
    const numberOfParts = 10; // Default to 10 parts

    for (let partNumber = 1; partNumber <= numberOfParts; partNumber++) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
      });

      const url = await getSignedUrl(this.client, uploadPartCommand, {
        expiresIn: 3600, // 1 hour
      });

      partUrls.push(url);
    }

    return {
      uploadId,
      key,
      partUrls,
    };
  }

  /**
   * Complete a multipart upload
   */
  async completeMultipartUpload(
    uploadId: string,
    key: string,
    parts: Array<{ PartNumber: number; ETag: string }>
  ): Promise<FileInfo> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });

    const response = await this.client.send(command);

    // Get object info
    const headCommand = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const headResponse = await this.client.send(headCommand);

    return {
      key,
      url: this.getObjectUrl(key),
      size: headResponse.ContentLength || 0,
      type: headResponse.ContentType || 'application/octet-stream',
      name: path.basename(key),
      etag: headResponse.ETag?.replace(/"/g, ''),
      lastModified: headResponse.LastModified,
      metadata: headResponse.Metadata,
    };
  }

  /**
   * Abort a multipart upload
   */
  async abortMultipartUpload(uploadId: string, key: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });

    await this.client.send(command);
  }

  /**
   * Generate a presigned URL for direct upload
   */
  async getPresignedUploadUrl(
    fileName: string,
    contentType: string,
    options: UploadOptions = {}
  ): Promise<{ url: string; key: string; fields?: Record<string, string> }> {
    const key = this.generateFileKey(fileName, options.folder);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: 3600, // 1 hour
    });

    return { url, key };
  }

  /**
   * Process image buffer with Sharp
   */
  private async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    let pipeline = sharp(buffer);

    // Strip metadata if requested
    if (options.stripMetadata !== false) {
      pipeline = pipeline.rotate(); // Auto-orient based on EXIF
      pipeline = pipeline.withoutMetadata();
    }

    // Resize if specified
    if (options.resize) {
      pipeline = pipeline.resize(options.resize.width, options.resize.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Set format and quality
    if (options.format) {
      switch (options.format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: options.quality || 80 });
          break;
        case 'png':
          pipeline = pipeline.png({ quality: options.quality || 80 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: options.quality || 80 });
          break;
      }
    }

    return await pipeline.toBuffer({ resolveWithObject: true });
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(
    buffer: Buffer,
    size: { width: number; height: number }
  ): Promise<Buffer> {
    return await sharp(buffer)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  /**
   * Upload a file from buffer with optional processing
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    options: UploadOptions = {}
  ): Promise<FileInfo> {
    // Validate file type
    if (options.allowedTypes) {
      const fileType = await fileTypeFromBuffer(buffer);
      if (!fileType || !options.allowedTypes.includes(fileType.mime)) {
        throw new Error(`File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`);
      }
    }

    let processedBuffer = buffer;
    let thumbnailUrl: string | undefined;

    // Process image if needed
    if (options.imageProcessing && contentType.startsWith('image/')) {
      const { buffer: imgBuffer, info } = await this.processImage(buffer, options.imageProcessing);
      processedBuffer = imgBuffer;

      // Generate thumbnail if requested
      if (options.imageProcessing.generateThumbnail && options.imageProcessing.thumbnailSize) {
        const thumbnailBuffer = await this.generateThumbnail(
          buffer,
          options.imageProcessing.thumbnailSize
        );

        const thumbnailKey = this.generateFileKey(
          `thumb_${fileName}`,
          options.folder ? `${options.folder}/thumbnails` : 'thumbnails'
        );

        await this.client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        }));

        thumbnailUrl = this.getObjectUrl(thumbnailKey);
      }
    }

    const key = this.generateFileKey(fileName, options.folder);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: processedBuffer,
      ContentType: contentType,
      Metadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
        processed: options.imageProcessing ? 'true' : 'false',
      },
    });

    await this.client.send(command);

    // Get object info
    const headCommand = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const headResponse = await this.client.send(headCommand);

    return {
      key,
      url: this.getObjectUrl(key),
      size: headResponse.ContentLength || processedBuffer.length,
      type: headResponse.ContentType || contentType,
      name: path.basename(key),
      etag: headResponse.ETag?.replace(/"/g, ''),
      lastModified: headResponse.LastModified,
      metadata: headResponse.Metadata,
      thumbnailUrl,
    };
  }

  /**
   * Get object URL
   */
  private getObjectUrl(key: string): string {
    if (this.config.endpoint) {
      // Custom endpoint (e.g., MinIO)
      const baseUrl = this.config.endpoint.replace(/\/$/, '');
      return this.config.forcePathStyle
        ? `${baseUrl}/${this.bucket}/${key}`
        : `${baseUrl}/${key}`;
    }

    // AWS S3
    return `https://${this.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Generate presigned URL for download
   */
  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Delete an object
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * List objects in folder
   */
  async listObjects(prefix?: string, maxKeys: number = 1000): Promise<FileInfo[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await this.client.send(command);
    const files: FileInfo[] = [];

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key) {
          files.push({
            key: object.Key,
            url: this.getObjectUrl(object.Key),
            size: object.Size || 0,
            name: path.basename(object.Key),
            lastModified: object.LastModified,
            etag: object.ETag?.replace(/"/g, ''),
          });
        }
      }
    }

    return files;
  }

  /**
   * Get object info
   */
  async getObjectInfo(key: string): Promise<FileInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        key,
        url: this.getObjectUrl(key),
        size: response.ContentLength || 0,
        type: response.ContentType || 'application/octet-stream',
        name: path.basename(key),
        etag: response.ETag?.replace(/"/g, ''),
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate checksum for file integrity
   */
  generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

export default S3Service;