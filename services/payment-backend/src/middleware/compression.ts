import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import compression from 'compression';
import zlib from 'zlib';

interface CompressionOptions {
  level?: number;
  threshold?: number;
  chunkSize?: number;
  windowBits?: number;
  memLevel?: number;
  strategy?: number;
  filter?: (req: Request, res: Response) => boolean;
}

interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  totalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
  averageCompressionTime: number;
}

export class CompressionMiddleware {
  private logger: Logger;
  private metrics: MetricsCollector;
  private defaultOptions: CompressionOptions;
  private stats: CompressionStats;

  constructor(options: CompressionOptions = {}) {
    this.logger = new Logger('CompressionMiddleware');
    this.metrics = new MetricsCollector('compression');
    this.defaultOptions = {
      level: 6, // Default compression level (1-9, 6 is balanced)
      threshold: 1024, // Only compress responses larger than 1KB
      chunkSize: 16 * 1024, // 16KB chunks
      windowBits: 15,
      memLevel: 8,
      strategy: zlib.constants.Z_DEFAULT_STRATEGY,
      ...options
    };

    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      totalBytes: 0,
      compressedBytes: 0,
      compressionRatio: 0,
      averageCompressionTime: 0
    };
  }

  /**
   * Main compression middleware
   */
  middleware() {
    return compression({
      filter: this.shouldCompress.bind(this),
      level: this.defaultOptions.level,
      threshold: this.defaultOptions.threshold,
      chunkSize: this.defaultOptions.chunkSize,
      windowBits: this.defaultOptions.windowBits,
      memLevel: this.defaultOptions.memLevel,
      strategy: this.defaultOptions.strategy
    });
  }

  /**
   * Advanced compression middleware with custom logic
   */
  advancedMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalWrite = res.write;
      const originalEnd = res.end;
      let shouldCompressResponse = false;
      let responseBody: Buffer[] = [];
      let totalSize = 0;

      // Check if we should compress this response
      shouldCompressResponse = this.shouldCompress(req, res);

      if (shouldCompressResponse) {
        // Set compression headers
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');

        // Override res.write to capture response data
        res.write = function (chunk: any, encoding?: any) {
          if (Buffer.isBuffer(chunk)) {
            responseBody.push(chunk);
            totalSize += chunk.length;
          } else {
            const buffer = Buffer.from(chunk, encoding);
            responseBody.push(buffer);
            totalSize += buffer.length;
          }
          return true;
        };

        // Override res.end to compress and send final response
        res.end = function (chunk?: any, encoding?: any) {
          if (chunk) {
            if (Buffer.isBuffer(chunk)) {
              responseBody.push(chunk);
              totalSize += chunk.length;
            } else {
              const buffer = Buffer.from(chunk, encoding);
              responseBody.push(buffer);
              totalSize += buffer.length;
            }
          }

          // Combine all response chunks
          const fullResponse = Buffer.concat(responseBody);

          // Compress the response
          if (totalSize >= (this.defaultOptions.threshold || 1024)) {
            const compressionStart = Date.now();
            zlib.gzip(fullResponse, {
              level: this.defaultOptions.level,
              windowBits: this.defaultOptions.windowBits,
              memLevel: this.defaultOptions.memLevel,
              strategy: this.defaultOptions.strategy
            }, (err, compressed) => {
              const compressionTime = Date.now() - compressionStart;

              if (err) {
                this.logger.error('Compression error', err);
                // Send uncompressed response on error
                originalEnd.call(res, fullResponse);
                return;
              }

              // Update statistics
              this.updateStats(totalSize, compressed.length, compressionTime);

              // Set compressed content length
              res.setHeader('Content-Length', compressed.length);

              // Send compressed response
              originalEnd.call(res, compressed);
            });
          } else {
            // Response too small to compress
            res.setHeader('Content-Length', fullResponse.length);
            originalEnd.call(res, fullResponse);
          }
        }.bind(this);
      } else {
        // Don't compress, use original methods
        next();
      }
    };
  }

  /**
   * Brotli compression middleware (better compression ratio)
   */
  brotliMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if client supports Brotli
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const supportsBrotli = acceptEncoding.includes('br');

      if (supportsBrotli && this.shouldCompress(req, res)) {
        res.setHeader('Content-Encoding', 'br');
        res.setHeader('Vary', 'Accept-Encoding');

        // Use Brotli compression
        const originalWrite = res.write;
        const originalEnd = res.end;
        let responseBody: Buffer[] = [];

        res.write = function (chunk: any, encoding?: any) {
          responseBody.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
          return true;
        };

        res.end = function (chunk?: any, encoding?: any) {
          if (chunk) {
            responseBody.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
          }

          const fullResponse = Buffer.concat(responseBody);

          // Use Brotli compression
          zlib.brotliCompress(fullResponse, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: this.defaultOptions.level || 6,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: fullResponse.length
            }
          }, (err, compressed) => {
            if (err) {
              this.logger.error('Brotli compression error', err);
              originalEnd.call(res, fullResponse);
              return;
            }

            res.setHeader('Content-Length', compressed.length);
            originalEnd.call(res, compressed);
          });
        };
      } else {
        next();
      }
    };
  }

  /**
   * Adaptive compression middleware (adjusts based on content type)
   */
  adaptiveMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentType = res.getHeader('Content-Type') as string || '';

      // Different compression strategies for different content types
      let compressionLevel = this.defaultOptions.level || 6;
      let useBrotli = false;

      // Check if client supports Brotli
      const acceptEncoding = req.headers['accept-encoding'] || '';

      switch (true) {
        case contentType.includes('text/html'):
        case contentType.includes('text/css'):
        case contentType.includes('application/json'):
          // High compression for text content
          compressionLevel = 9;
          useBrotli = acceptEncoding.includes('br');
          break;

        case contentType.includes('text/javascript'):
        case contentType.includes('application/javascript'):
          // Medium-high compression for JavaScript
          compressionLevel = 7;
          useBrotli = acceptEncoding.includes('br');
          break;

        case contentType.includes('image/svg+xml'):
          // Light compression for SVG
          compressionLevel = 3;
          break;

        case contentType.includes('application/xml'):
        case contentType.includes('text/xml'):
          // Medium compression for XML
          compressionLevel = 6;
          break;

        case contentType.includes('text/plain'):
          // High compression for plain text
          compressionLevel = 9;
          break;

        default:
          // Default compression for other types
          compressionLevel = this.defaultOptions.level || 6;
      }

      // Apply compression with adaptive settings
      if (this.shouldCompress(req, res)) {
        const compressionOptions = {
          level: compressionLevel,
          threshold: this.defaultOptions.threshold,
          chunkSize: this.defaultOptions.chunkSize,
          windowBits: this.defaultOptions.windowBits,
          memLevel: this.defaultOptions.memLevel,
          strategy: this.getOptimalStrategy(contentType)
        };

        if (useBrotli) {
          res.setHeader('Content-Encoding', 'br');
          // Use Brotli with adaptive settings
          this.applyBrotliCompression(req, res, compressionOptions);
        } else {
          res.setHeader('Content-Encoding', 'gzip');
          // Use gzip with adaptive settings
          compression({
            ...compressionOptions,
            filter: () => true
          })(req, res, next);
          return;
        }
      } else {
        next();
      }
    };
  }

  /**
   * Determine if response should be compressed
   */
  private shouldCompress(req: Request, res: Response): boolean {
    const type = res.getHeader('Content-Type') as string;

    // Don't compress if already compressed
    if (res.getHeader('Content-Encoding')) {
      return false;
    }

    // Don't compress if no content type
    if (!type) {
      return false;
    }

    // Don't compress if client doesn't accept encoding
    const acceptEncoding = req.headers['accept-encoding'];
    if (!acceptEncoding || !acceptEncoding.includes('gzip')) {
      return false;
    }

    // Compress only specific content types
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'image/svg+xml',
      'application/vnd.api+json'
    ];

    return compressibleTypes.some(compressibleType =>
      type.includes(compressibleType)
    );
  }

  /**
   * Get optimal compression strategy based on content type
   */
  private getOptimalStrategy(contentType: string): number {
    if (contentType.includes('text/html')) {
      return zlib.constants.Z_DEFAULT_STRATEGY;
    } else if (contentType.includes('application/json')) {
      return zlib.constants.Z_FILTERED;
    } else if (contentType.includes('text/')) {
      return zlib.constants.Z_DEFAULT_STRATEGY;
    } else {
      return zlib.constants.Z_DEFAULT_STRATEGY;
    }
  }

  /**
   * Apply Brotli compression with custom options
   */
  private applyBrotliCompression(
    req: Request,
    res: Response,
    options: CompressionOptions
  ): void {
    const originalWrite = res.write;
    const originalEnd = res.end;
    let responseBody: Buffer[] = [];

    res.write = function (chunk: any, encoding?: any) {
      responseBody.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return true;
    };

    res.end = function (chunk?: any, encoding?: any) {
      if (chunk) {
        responseBody.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }

      const fullResponse = Buffer.concat(responseBody);

      zlib.brotliCompress(fullResponse, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: options.level || 6,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: fullResponse.length
        }
      }, (err, compressed) => {
        if (err) {
          this.logger.error('Brotli compression error', err);
          originalEnd.call(res, fullResponse);
          return;
        }

        res.setHeader('Content-Length', compressed.length);
        originalEnd.call(res, compressed);
      });
    };
  }

  /**
   * Update compression statistics
   */
  private updateStats(originalSize: number, compressedSize: number, compressionTime: number): void {
    this.stats.totalRequests++;
    this.stats.compressedRequests++;
    this.stats.totalBytes += originalSize;
    this.stats.compressedBytes += compressedSize;
    this.stats.compressionRatio =
      ((this.stats.totalBytes - this.stats.compressedBytes) / this.stats.totalBytes) * 100;
    this.stats.averageCompressionTime =
      (this.stats.averageCompressionTime * (this.stats.compressedRequests - 1) + compressionTime) /
      this.stats.compressedRequests;

    // Record metrics
    this.metrics.histogram('compression_ratio', this.stats.compressionRatio);
    this.metrics.histogram('compression_time', compressionTime);
    this.metrics.increment('compressed_responses');
    this.metrics.histogram('original_size', originalSize);
    this.metrics.histogram('compressed_size', compressedSize);
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset compression statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      totalBytes: 0,
      compressedBytes: 0,
      compressionRatio: 0,
      averageCompressionTime: 0
    };
  }

  /**
   * Create compression middleware preset for different use cases
   */
  static createPreset(preset: 'default' | 'performance' | 'size' | 'adaptive'): CompressionMiddleware {
    switch (preset) {
      case 'performance':
        return new CompressionMiddleware({
          level: 1, // Fastest compression
          threshold: 512, // Compress smaller responses
          chunkSize: 32 * 1024 // Larger chunks for performance
        });

      case 'size':
        return new CompressionMiddleware({
          level: 9, // Maximum compression
          threshold: 256, // Compress very small responses
          strategy: zlib.constants.Z_DEFAULT_STRATEGY
        });

      case 'adaptive':
        return new CompressionMiddleware({
          level: 6,
          threshold: 1024,
          strategy: zlib.constants.Z_DEFAULT_STRATEGY
        });

      case 'default':
      default:
        return new CompressionMiddleware();
    }
  }
}

export default CompressionMiddleware;
export { CompressionOptions, CompressionStats };