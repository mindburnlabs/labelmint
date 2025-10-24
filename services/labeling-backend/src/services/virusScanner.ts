import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'crypto';
import path from 'path';
import { promisify } from 'util';

export interface ScanResult {
  isInfected: boolean;
  threats: string[];
  signature: string;
  scanTime: Date;
  fileSize: number;
  fileType: string;
  checksum: string;
}

export interface ScannerConfig {
  clamavPath?: string;
  socketPath?: string;
  host?: string;
  port?: number;
  timeout?: number;
  maxFileSize?: number;
  skipScan?: string[];
}

class VirusScanner {
  private config: ScannerConfig;
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly defaultMaxFileSize = 100 * 1024 * 1024; // 100MB

  constructor(config: ScannerConfig = {}) {
    this.config = {
      clamavPath: config.clamavPath || 'clamscan',
      socketPath: config.socketPath,
      host: config.host || 'localhost',
      port: config.port || 3310,
      timeout: config.timeout || this.defaultTimeout,
      maxFileSize: config.maxFileSize || this.defaultMaxFileSize,
      skipScan: config.skipScan || [],
    };
  }

  /**
   * Scan file buffer for viruses
   */
  async scanBuffer(buffer: Buffer, filename: string): Promise<ScanResult> {
    const startTime = new Date();
    const checksum = this.generateChecksum(buffer);
    const fileType = await this.getFileType(buffer);

    // Check if file is too large
    if (buffer.length > (this.config.maxFileSize || this.defaultMaxFileSize)) {
      throw new Error(`File too large for virus scanning. Maximum size: ${this.config.maxFileSize} bytes`);
    }

    // Check if file type should be skipped
    const ext = path.extname(filename).toLowerCase();
    if (this.config.skipScan?.includes(ext) || this.config.skipScan?.includes(fileType)) {
      return {
        isInfected: false,
        threats: [],
        signature: 'Skipped by configuration',
        scanTime: startTime,
        fileSize: buffer.length,
        fileType,
        checksum,
      };
    }

    try {
      // Create temporary file for scanning
      const tempFilePath = `/tmp/scan_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      require('fs').writeFileSync(tempFilePath, buffer);

      // Perform scan
      const result = await this.scanFile(tempFilePath);

      // Clean up temp file
      require('fs').unlinkSync(tempFilePath);

      return {
        ...result,
        scanTime: startTime,
        fileSize: buffer.length,
        fileType,
        checksum,
      };
    } catch (error) {
      throw new Error(`Virus scan failed: ${(error as Error).message}`);
    }
  }

  /**
   * Scan file path for viruses using ClamAV
   */
  private async scanFile(filePath: string): Promise<Omit<ScanResult, 'scanTime' | 'fileSize' | 'fileType' | 'checksum'>> {
    return new Promise((resolve, reject) => {
      const args = ['--no-summary', filePath];

      // Use socket if configured
      if (this.config.socketPath) {
        args.push(`--fdpass`, `--stream=${this.config.socketPath}`);
      } else if (this.config.host && this.config.port) {
        // Use TCP socket
        args.push(`--stream=${this.config.host}:${this.config.port}`);
      }

      const clamscan = spawn(this.config.clamavPath || 'clamscan', args);

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        clamscan.kill();
        reject(new Error('Virus scan timeout'));
      }, this.config.timeout);

      clamscan.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      clamscan.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      clamscan.on('close', (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          // Clean file
          resolve({
            isInfected: false,
            threats: [],
            signature: 'Clean',
          });
        } else if (code === 1) {
          // Virus found
          const threats = this.parseThreats(stdout);
          resolve({
            isInfected: true,
            threats,
            signature: threats.join(', ') || 'Unknown threat',
          });
        } else {
          // Error occurred
          reject(new Error(`ClamAV error (code ${code}): ${stderr || stdout}`));
        }
      });

      clamscan.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start ClamAV: ${error.message}`));
      });
    });
  }

  /**
   * Parse threat information from ClamAV output
   */
  private parseThreats(output: string): string[] {
    const threats: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('FOUND')) {
        const match = line.match(/^(.*)\s+:\s+(.+?)\s+FOUND$/);
        if (match) {
          threats.push(`${match[2]} in ${match[1]}`);
        }
      }
    }

    return threats;
  }

  /**
   * Get file type from buffer
   */
  private async getFileType(buffer: Buffer): Promise<string> {
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      return fileType?.mime || 'application/octet-stream';
    } catch {
      return 'application/octet-stream';
    }
  }

  /**
   * Generate SHA-256 checksum
   */
  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if ClamAV is available and updated
   */
  async checkClamAVStatus(): Promise<{ available: boolean; version?: string; databaseVersion?: string }> {
    return new Promise((resolve) => {
      const clamscan = spawn(this.config.clamavPath || 'clamscan', ['--version']);

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        clamscan.kill();
        resolve({ available: false });
      }, 5000);

      clamscan.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      clamscan.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      clamscan.on('close', (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          const versionMatch = stdout.match(/ClamAV ([0-9.]+)/);
          const dbMatch = stdout.match(/Build time: ([0-9.]+)/) || stdout.match(/Database version: ([0-9.]+)/);

          resolve({
            available: true,
            version: versionMatch?.[1],
            databaseVersion: dbMatch?.[1],
          });
        } else {
          resolve({ available: false });
        }
      });

      clamscan.on('error', () => {
        clearTimeout(timeout);
        resolve({ available: false });
      });
    });
  }

  /**
   * Update ClamAV virus database
   */
  async updateDatabase(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const freshclam = spawn('freshclam');

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        freshclam.kill();
        resolve({ success: false, message: 'Database update timeout' });
      }, 60000); // 1 minute timeout

      freshclam.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      freshclam.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      freshclam.on('close', (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          resolve({
            success: true,
            message: 'Database updated successfully'
          });
        } else {
          resolve({
            success: false,
            message: `Update failed: ${stderr || stdout}`
          });
        }
      });

      freshclam.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          message: `Failed to run freshclam: ${error.message}`
        });
      });
    });
  }

  /**
   * Quick scan using clamd (if available) - faster than clamscan
   */
  async quickScanBuffer(buffer: Buffer, filename: string): Promise<ScanResult> {
    const startTime = new Date();
    const checksum = this.generateChecksum(buffer);
    const fileType = await this.getFileType(buffer);

    try {
      const result = await this.scanWithClamd(buffer);

      return {
        ...result,
        scanTime: startTime,
        fileSize: buffer.length,
        fileType,
        checksum,
      };
    } catch (error) {
      // Fallback to regular scan
      return this.scanBuffer(buffer, filename);
    }
  }

  /**
   * Scan with clamd via TCP socket or Unix socket
   */
  private async scanWithClamd(buffer: Buffer): Promise<Omit<ScanResult, 'scanTime' | 'fileSize' | 'fileType' | 'checksum'>> {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const socket = new net.Socket();

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('clamd scan timeout'));
      }, this.config.timeout);

      socket.setTimeout(this.config.timeout || this.defaultTimeout);

      socket.on('connect', () => {
        // Send INSTREAM command
        socket.write('zINSTREAM\0');

        // Send file in chunks
        const chunkSize = 8192;
        let offset = 0;

        const sendChunk = () => {
          if (offset >= buffer.length) {
            socket.write(Buffer([0, 0, 0, 0])); // End of stream
            return;
          }

          const chunk = buffer.slice(offset, offset + chunkSize);
          const sizeHeader = Buffer.alloc(4);
          sizeHeader.writeUInt32BE(chunk.length, 0);

          socket.write(Buffer.concat([sizeHeader, chunk]));
          offset += chunk.length;

          setImmediate(sendChunk);
        };

        sendChunk();
      });

      socket.on('data', (data) => {
        clearTimeout(timeout);
        socket.destroy();

        const response = data.toString().trim();

        if (response === 'stream: OK') {
          resolve({
            isInfected: false,
            threats: [],
            signature: 'Clean',
          });
        } else if (response.includes('FOUND')) {
          const threats = this.parseClamdThreats(response);
          resolve({
            isInfected: true,
            threats,
            signature: threats.join(', ') || 'Unknown threat',
          });
        } else {
          reject(new Error(`clamd error: ${response}`));
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`clamd connection error: ${error.message}`));
      });

      socket.on('timeout', () => {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error('clamd connection timeout'));
      });

      // Connect to clamd
      if (this.config.socketPath) {
        socket.connect(this.config.socketPath);
      } else {
        socket.connect(this.config.port || 3310, this.config.host || 'localhost');
      }
    });
  }

  /**
   * Parse threat information from clamd output
   */
  private parseClamdThreats(output: string): string[] {
    const threats: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('FOUND')) {
        const match = line.match(/^stream: (.+) FOUND$/);
        if (match) {
          threats.push(match[1]);
        }
      }
    }

    return threats;
  }
}

export default VirusScanner;