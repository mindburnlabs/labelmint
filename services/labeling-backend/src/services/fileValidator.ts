import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import crypto from 'crypto';

export interface ValidationRule {
  name: string;
  validate: (buffer: Buffer, info: FileInfo) => Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  ext: string;
}

export interface FileValidationConfig {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  requireChecksum?: boolean;
  customRules?: ValidationRule[];
}

class FileValidator {
  private config: FileValidationConfig;
  private readonly defaultMaxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly defaultAllowedMimeTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Text
    'text/plain',
    'text/csv',
    'text/markdown',

    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',

    // Video
    'video/mp4',
    'video/webm',
    'video/quicktime',

    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ];

  private readonly dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.ps1', '.sh', '.app', '.deb', '.pkg', '.dmg', '.rpm', '.msi',
    '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl'
  ];

  constructor(config: FileValidationConfig = {}) {
    this.config = {
      maxFileSize: config.maxFileSize || this.defaultMaxFileSize,
      allowedMimeTypes: config.allowedMimeTypes || this.defaultAllowedMimeTypes,
      allowedExtensions: config.allowedExtensions,
      blockedExtensions: config.blockedExtensions || this.dangerousExtensions,
      requireChecksum: config.requireChecksum || false,
      customRules: config.customRules || [],
    };
  }

  /**
   * Validate file buffer against all configured rules
   */
  async validateFile(buffer: Buffer, originalName: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    fileInfo: FileInfo;
    checksum?: string;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get file information
    const fileType = await fileTypeFromBuffer(buffer);
    const fileInfo: FileInfo = {
      name: originalName,
      size: buffer.length,
      type: fileType?.mime || 'application/octet-stream',
      ext: path.extname(originalName).toLowerCase(),
    };

    // Validate file size
    const sizeValidation = this.validateFileSize(buffer.length);
    if (!sizeValidation.valid) {
      errors.push(sizeValidation.error!);
    }

    // Validate file extension
    const extValidation = this.validateExtension(fileInfo.ext, fileInfo.type);
    if (!extValidation.valid) {
      errors.push(extValidation.error!);
    }

    // Validate MIME type
    const mimeValidation = this.validateMimeType(fileInfo.type);
    if (!mimeValidation.valid) {
      errors.push(mimeValidation.error!);
    }

    // Check for MIME type and extension mismatch
    if (fileType && fileInfo.ext && fileType.ext !== fileInfo.ext.substring(1)) {
      warnings.push(`File extension ${fileInfo.ext} doesn't match detected type ${fileType.ext}`);
    }

    // Validate file signature (magic bytes)
    const signatureValidation = await this.validateFileSignature(buffer, fileInfo.type);
    if (!signatureValidation.valid) {
      errors.push(signatureValidation.error!);
    }

    // Check for embedded scripts in images
    if (fileInfo.type.startsWith('image/')) {
      const scriptValidation = this.validateImageScripts(buffer);
      if (!scriptValidation.valid) {
        errors.push(scriptValidation.error!);
      }
    }

    // Check for zip bombs or malicious archives
    if (['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'].includes(fileInfo.type)) {
      const archiveValidation = this.validateArchive(buffer);
      if (!archiveValidation.valid) {
        errors.push(archiveValidation.error!);
      }
    }

    // Validate content-based rules
    const contentValidation = this.validateContent(buffer);
    if (!contentValidation.valid) {
      errors.push(contentValidation.error!);
    }

    // Run custom validation rules
    for (const rule of this.config.customRules || []) {
      try {
        const result = await rule.validate(buffer, fileInfo);
        if (!result.valid && result.error) {
          errors.push(`${rule.name}: ${result.error}`);
        }
        if (result.warning) {
          warnings.push(`${rule.name}: ${result.warning}`);
        }
      } catch (error) {
        warnings.push(`${rule.name}: Validation rule failed - ${(error as Error).message}`);
      }
    }

    // Generate checksum if required
    let checksum: string | undefined;
    if (this.config.requireChecksum) {
      checksum = this.generateChecksum(buffer);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileInfo,
      checksum,
    };
  }

  /**
   * Validate file size
   */
  private validateFileSize(size: number): ValidationResult {
    const maxSize = this.config.maxFileSize || this.defaultMaxFileSize;

    if (size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${this.formatBytes(maxSize)}, got ${this.formatBytes(size)}`,
      };
    }

    if (size === 0) {
      return {
        valid: false,
        error: 'File is empty',
      };
    }

    return { valid: true };
  }

  /**
   * Validate file extension
   */
  private validateExtension(ext: string, mimeType: string): ValidationResult {
    // Check blocked extensions
    if (this.config.blockedExtensions?.includes(ext)) {
      return {
        valid: false,
        error: `File extension ${ext} is not allowed`,
      };
    }

    // Check allowed extensions if specified
    if (this.config.allowedExtensions && !this.config.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension ${ext} is not in allowed list`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate MIME type
   */
  private validateMimeType(mimeType: string): ValidationResult {
    const allowedTypes = this.config.allowedMimeTypes || this.defaultAllowedMimeTypes;

    if (!allowedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `MIME type ${mimeType} is not allowed`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate file signature (magic bytes)
   */
  private async validateFileSignature(buffer: Buffer, expectedMimeType: string): Promise<ValidationResult> {
    try {
      const detectedType = await fileTypeFromBuffer(buffer);

      if (!detectedType) {
        return {
          valid: false,
          error: 'Unable to determine file type from content',
        };
      }

      // Check if detected MIME matches expected
      if (expectedMimeType !== 'application/octet-stream' && detectedType.mime !== expectedMimeType) {
        return {
          valid: false,
          error: `File signature mismatch. Expected ${expectedMimeType}, detected ${detectedType.mime}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to validate file signature: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Validate images for embedded scripts
   */
  private validateImageScripts(buffer: Buffer): ValidationResult {
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));

    // Check for common script patterns in image files
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        return {
          valid: false,
          error: 'Image contains potentially dangerous script content',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate archives for zip bombs or malicious content
   */
  private validateArchive(buffer: Buffer): ValidationResult {
    // Simple check for extremely high compression ratios (zip bomb indicator)
    if (buffer.length > 0) {
      // Look for ZIP file signatures
      if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
        // This is a basic check - in production, you'd want more sophisticated analysis
        const header = buffer.slice(0, 30).toString('utf8');

        // Check for suspicious patterns
        if (header.includes('../') || header.includes('..\\')) {
          return {
            valid: false,
            error: 'Archive contains potentially dangerous path traversal',
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate content for suspicious patterns
   */
  private validateContent(buffer: Buffer): ValidationResult {
    const content = buffer.toString('utf8', 0, Math.min(8192, buffer.length));

    // Check for malicious patterns
    const maliciousPatterns = [
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /passthru\s*\(/gi,
      /shell_exec\s*\(/gi,
      /<\?php/gi,
      /<%/g,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        return {
          valid: false,
          error: 'File contains potentially dangerous code patterns',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Generate SHA-256 checksum
   */
  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Add custom validation rule
   */
  addCustomRule(rule: ValidationRule): void {
    if (!this.config.customRules) {
      this.config.customRules = [];
    }
    this.config.customRules.push(rule);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FileValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Predefined validation rules
export const ImageOptimizationRule: ValidationRule = {
  name: 'Image Optimization',
  validate: async (buffer: buffer, info: FileInfo) => {
    if (!info.type.startsWith('image/')) {
      return { valid: true };
    }

    // Check if image is excessively large for its dimensions
    const sizeInMB = buffer.length / (1024 * 1024);
    if (sizeInMB > 10) {
      return {
        valid: true,
        warning: `Large image file (${sizeInMB.toFixed(2)}MB). Consider compressing or resizing.`,
      };
    }

    return { valid: true };
  },
};

export const DocumentSecurityRule: ValidationRule = {
  name: 'Document Security',
  validate: async (buffer: buffer, info: FileInfo) => {
    if (!['application/pdf', 'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(info.type)) {
      return { valid: true };
    }

    // Check for PDF password protection or encryption
    if (info.type === 'application/pdf') {
      const header = buffer.slice(0, 1024).toString('latin1');
      if (header.includes('/Encrypt')) {
        return {
          valid: false,
          error: 'Encrypted PDFs are not allowed',
        };
      }
    }

    return { valid: true };
  },
};

export default FileValidator;