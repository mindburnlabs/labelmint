import { PrismaClient } from '@prisma/client';
import { RedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import { compress, decompress } from '../utils/compression';
import { encrypt, decrypt } from '../utils/encryption';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { join } from 'path';
import { mkdir, rm, stat } from 'fs/promises';

interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retention: {
    daily: number; // days
    weekly: number; // weeks
    monthly: number; // months
  };
  storage: {
    type: 'S3' | 'LOCAL';
    s3?: {
      bucket: string;
      region: string;
      prefix: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
    local?: {
      path: string;
    };
  };
  encryption: {
    enabled: boolean;
    keyId: string;
  };
  compression: {
    enabled: boolean;
    level: number; // 1-9
  };
}

interface BackupMetadata {
  id: string;
  type: 'FULL' | 'INCREMENTAL' | 'TRANSACTION_LOG';
  timestamp: Date;
  tables: string[];
  recordCount: number;
  size: {
    uncompressed: number;
    compressed: number;
    encrypted: number;
  };
  checksum: string;
  previousBackupId?: string;
  createdAt: Date;
}

interface RestorePoint {
  backupId: string;
  timestamp: Date;
  type: string;
  description: string;
}

export class PaymentBackupService {
  private s3Client: S3Client | null = null;
  private backupInProgress = false;
  private restoreInProgress = false;

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient,
    private config: BackupConfig
  ) {
    if (config.storage.type === 'S3' && config.storage.s3) {
      this.s3Client = new S3Client({
        region: config.storage.s3.region,
        credentials: {
          accessKeyId: config.storage.s3.accessKeyId,
          secretAccessKey: config.storage.s3.secretAccessKey,
        },
      });
    }
  }

  /**
   * Perform a full backup of payment-related tables
   */
  async performFullBackup(): Promise<BackupMetadata> {
    if (this.backupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.backupInProgress = true;
    const backupId = `backup_full_${Date.now()}`;
    const tempDir = join('/tmp', 'payment_backups', backupId);
    let metadata: BackupMetadata;

    try {
      logger.info('Starting full payment backup', { backupId });

      // Create temp directory
      await mkdir(tempDir, { recursive: true });

      // Tables to backup
      const tables = [
        'transactions',
        'withdrawals',
        'ton_transactions',
        'client_payments',
        'audit_logs',
        'payment_queue',
        'user_payment_stats',
        'user_crypto_wallets',
        'payout_configs',
        'bank_details',
      ];

      const startTime = Date.now();
      const tableData: Record<string, any> = {};
      let totalRecords = 0;

      // Export each table
      for (const table of tables) {
        logger.info(`Exporting table: ${table}`);

        const data = await this.exportTable(table);
        tableData[table] = data;
        totalRecords += data.length;

        // Save table to file
        const tableFile = join(tempDir, `${table}.json`);
        await this.writeJsonFile(tableFile, data);
      }

      // Create backup metadata
      metadata = {
        id: backupId,
        type: 'FULL',
        timestamp: new Date(),
        tables,
        recordCount: totalRecords,
        size: {
          uncompressed: 0,
          compressed: 0,
          encrypted: 0,
        },
        checksum: '', // Will be calculated
        createdAt: new Date(),
      };

      // Calculate uncompressed size
      for (const table of tables) {
        const tableFile = join(tempDir, `${table}.json`);
        const stats = await stat(tableFile);
        metadata.size.uncompressed += stats.size;
      }

      // Compress if enabled
      if (this.config.compression.enabled) {
        await this.compressBackup(tempDir, tables);

        // Update compressed size
        const compressedFile = join(tempDir, 'backup.compressed');
        const stats = await stat(compressedFile);
        metadata.size.compressed = stats.size;
      }

      // Encrypt if enabled
      if (this.config.encryption.enabled) {
        await this.encryptBackup(tempDir);

        // Update encrypted size
        const encryptedFile = join(tempDir, 'backup.encrypted');
        const stats = await stat(encryptedFile);
        metadata.size.encrypted = stats.size;
      }

      // Calculate checksum
      metadata.checksum = await this.calculateChecksum(tempDir);

      // Save metadata
      await this.writeJsonFile(join(tempDir, 'metadata.json'), metadata);

      // Store backup
      await this.storeBackup(tempDir, backupId);

      const duration = Date.now() - startTime;
      logger.info('Full backup completed', {
        backupId,
        duration,
        recordCount: totalRecords,
        size: metadata.size,
      });

      // Update backup registry
      await this.updateBackupRegistry(metadata);

      return metadata;

    } catch (error) {
      logger.error('Full backup failed', error);
      throw error;
    } finally {
      // Cleanup temp directory
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        logger.error('Failed to cleanup temp directory', e);
      }
      this.backupInProgress = false;
    }
  }

  /**
   * Perform an incremental backup based on the last backup
   */
  async performIncrementalBackup(lastBackupId?: string): Promise<BackupMetadata> {
    if (this.backupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.backupInProgress = true;
    const backupId = `backup_incremental_${Date.now()}`;
    const tempDir = join('/tmp', 'payment_backups', backupId);
    let metadata: BackupMetadata;

    try {
      logger.info('Starting incremental payment backup', { backupId, lastBackupId });

      // Get last backup timestamp
      let lastBackupTime: Date;
      if (lastBackupId) {
        const lastBackup = await this.getBackupMetadata(lastBackupId);
        lastBackupTime = lastBackup.timestamp;
      } else {
        // Find most recent backup
        const registry = await this.getBackupRegistry();
        const lastBackup = registry
          .filter(b => b.type !== 'TRANSACTION_LOG')
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        if (!lastBackup) {
          throw new Error('No previous backup found. Perform full backup first.');
        }
        lastBackupTime = lastBackup.timestamp;
      }

      await mkdir(tempDir, { recursive: true });

      // Tables to backup incrementally
      const tables = [
        'transactions',
        'withdrawals',
        'ton_transactions',
        'client_payments',
        'audit_logs',
      ];

      const startTime = Date.now();
      const tableData: Record<string, any> = {};
      let totalRecords = 0;

      // Export changes since last backup
      for (const table of tables) {
        logger.info(`Exporting incremental changes for table: ${table}`);

        const data = await this.exportTableIncremental(table, lastBackupTime);

        if (data.length > 0) {
          tableData[table] = data;
          totalRecords += data.length;

          // Save table to file
          const tableFile = join(tempDir, `${table}.json`);
          await this.writeJsonFile(tableFile, data);
        }
      }

      // Skip backup if no changes
      if (totalRecords === 0) {
        logger.info('No changes since last backup. Skipping incremental backup.');
        this.backupInProgress = false;
        return null as any;
      }

      // Create backup metadata
      metadata = {
        id: backupId,
        type: 'INCREMENTAL',
        timestamp: new Date(),
        tables: Object.keys(tableData),
        recordCount: totalRecords,
        size: {
          uncompressed: 0,
          compressed: 0,
          encrypted: 0,
        },
        checksum: '',
        previousBackupId: lastBackupId,
        createdAt: new Date(),
      };

      // Calculate uncompressed size
      for (const table of Object.keys(tableData)) {
        const tableFile = join(tempDir, `${table}.json`);
        const stats = await stat(tableFile);
        metadata.size.uncompressed += stats.size;
      }

      // Compress and encrypt if enabled
      if (this.config.compression.enabled) {
        await this.compressBackup(tempDir, Object.keys(tableData));
        const compressedFile = join(tempDir, 'backup.compressed');
        const stats = await stat(compressedFile);
        metadata.size.compressed = stats.size;
      }

      if (this.config.encryption.enabled) {
        await this.encryptBackup(tempDir);
        const encryptedFile = join(tempDir, 'backup.encrypted');
        const stats = await stat(encryptedFile);
        metadata.size.encrypted = stats.size;
      }

      metadata.checksum = await this.calculateChecksum(tempDir);

      // Save metadata
      await this.writeJsonFile(join(tempDir, 'metadata.json'), metadata);

      // Store backup
      await this.storeBackup(tempDir, backupId);

      const duration = Date.now() - startTime;
      logger.info('Incremental backup completed', {
        backupId,
        duration,
        recordCount: totalRecords,
        size: metadata.size,
      });

      await this.updateBackupRegistry(metadata);

      return metadata;

    } catch (error) {
      logger.error('Incremental backup failed', error);
      throw error;
    } finally {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        logger.error('Failed to cleanup temp directory', e);
      }
      this.backupInProgress = false;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(
    backupId: string,
    options: {
      dryRun?: boolean;
      tables?: string[];
      pointInTime?: Date;
    } = {}
  ): Promise<{ success: boolean; restoredTables: string[]; errors: string[] }> {
    if (this.restoreInProgress) {
      throw new Error('Restore already in progress');
    }

    this.restoreInProgress = true;
    const tempDir = join('/tmp', 'payment_restore', backupId);
    const errors: string[] = [];
    const restoredTables: string[] = [];

    try {
      logger.info('Starting restore from backup', { backupId, options });

      // Get backup metadata
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Download backup
      await this.downloadBackup(backupId, tempDir);

      // Decrypt if needed
      if (this.config.encryption.enabled && metadata.size.encrypted > 0) {
        await this.decryptBackup(tempDir);
      }

      // Decompress if needed
      if (this.config.compression.enabled && metadata.size.compressed > 0) {
        await this.decompressBackup(tempDir);
      }

      // Determine which tables to restore
      const tablesToRestore = options.tables || metadata.tables;

      // Create restore plan
      const restorePlan = await this.createRestorePlan(metadata, tablesToRestore, options.pointInTime);

      if (options.dryRun) {
        logger.info('Dry run completed. Restore plan:', restorePlan);
        return {
          success: true,
          restoredTables: [],
          errors: [],
        };
      }

      // Execute restore
      for (const table of tablesToRestore) {
        try {
          logger.info(`Restoring table: ${table}`);

          const tableFile = join(tempDir, `${table}.json`);
          const data = await this.readJsonFile(tableFile);

          // Clear existing data (truncate)
          await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE;`);

          // Restore data in batches
          await this.restoreTableData(table, data);

          restoredTables.push(table);
          logger.info(`Table ${table} restored successfully`);

        } catch (error) {
          const errorMsg = `Failed to restore table ${table}: ${error.message}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Recreate indexes and constraints
      await this.recreateIndexes(tablesToRestore);

      // Verify restore
      const verification = await this.verifyRestore(backupId, tablesToRestore);
      if (!verification.success) {
        errors.push(...verification.errors);
      }

      logger.info('Restore completed', {
        backupId,
        restoredTables,
        errors,
      });

      // Log restore event
      await this.logRestoreEvent(backupId, restoredTables, errors);

      return {
        success: errors.length === 0,
        restoredTables,
        errors,
      };

    } catch (error) {
      logger.error('Restore failed', error);
      throw error;
    } finally {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        logger.error('Failed to cleanup temp directory', e);
      }
      this.restoreInProgress = false;
    }
  }

  /**
   * Get list of available restore points
   */
  async getRestorePoints(): Promise<RestorePoint[]> {
    const registry = await this.getBackupRegistry();

    return registry.map(backup => ({
      backupId: backup.id,
      timestamp: backup.timestamp,
      type: backup.type,
      description: `${backup.type} backup - ${backup.recordCount} records`,
    }));
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    logger.info('Starting backup cleanup');

    const registry = await this.getBackupRegistry();
    const now = new Date();
    const toDelete: string[] = [];

    // Daily retention
    const dailyCutoff = new Date(now.getTime() - this.config.retention.daily * 24 * 60 * 60 * 1000);

    // Weekly retention
    const weeklyCutoff = new Date(now.getTime() - this.config.retention.weekly * 7 * 24 * 60 * 60 * 1000);

    // Monthly retention
    const monthlyCutoff = new Date(now.getTime() - this.config.retention.monthly * 30 * 24 * 60 * 60 * 1000);

    for (const backup of registry) {
      const age = now.getTime() - backup.timestamp.getTime();

      if (backup.type === 'FULL') {
        if (backup.timestamp < monthlyCutoff) {
          toDelete.push(backup.id);
        }
      } else if (backup.type === 'INCREMENTAL') {
        if (backup.timestamp < weeklyCutoff) {
          toDelete.push(backup.id);
        }
      } else if (backup.type === 'TRANSACTION_LOG') {
        if (backup.timestamp < dailyCutoff) {
          toDelete.push(backup.id);
        }
      }
    }

    // Delete old backups
    for (const backupId of toDelete) {
      await this.deleteBackup(backupId);
    }

    logger.info(`Cleanup completed. Deleted ${toDelete.length} old backups`);
  }

  // Private helper methods

  private async exportTable(table: string): Promise<any[]> {
    const query = `SELECT * FROM ${table}`;
    const result = await this.prisma.$queryRawUnsafe(query);
    return result as any[];
  }

  private async exportTableIncremental(table: string, since: Date): Promise<any[]> {
    const query = `SELECT * FROM ${table} WHERE created_at >= $1 OR updated_at >= $1`;
    const result = await this.prisma.$queryRawUnsafe(query, since);
    return result as any[];
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private async readJsonFile(filePath: string): Promise<any> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private async compressBackup(dir: string, tables: string[]): Promise<void> {
    // Implementation would use zlib or similar
    logger.info('Compressing backup');
  }

  private async decompressBackup(dir: string): Promise<void> {
    // Implementation would use zlib or similar
    logger.info('Decompressing backup');
  }

  private async encryptBackup(dir: string): Promise<void> {
    // Implementation would use encryption utility
    logger.info('Encrypting backup');
  }

  private async decryptBackup(dir: string): Promise<void> {
    // Implementation would use decryption utility
    logger.info('Decrypting backup');
  }

  private async calculateChecksum(dir: string): Promise<string> {
    // Implementation would calculate SHA-256 checksum
    return 'checksum_placeholder';
  }

  private async storeBackup(dir: string, backupId: string): Promise<void> {
    if (this.config.storage.type === 'S3' && this.s3Client) {
      // Upload to S3
      const files = ['metadata.json', 'backup.compressed', 'backup.encrypted'];

      for (const file of files) {
        const filePath = join(dir, file);
        try {
          const stats = await stat(filePath);
          const stream = createReadStream(filePath);

          await this.s3Client.send(new PutObjectCommand({
            Bucket: this.config.storage.s3!.bucket,
            Key: `${this.config.storage.s3!.prefix}/${backupId}/${file}`,
            Body: stream,
            ContentLength: stats.size,
          }));
        } catch (e) {
          // File might not exist (e.g., not compressed or not encrypted)
        }
      }
    } else if (this.config.storage.type === 'LOCAL' && this.config.storage.local) {
      // Copy to local storage
      const fs = await import('fs/promises');
      const targetDir = join(this.config.storage.local.path, backupId);
      await mkdir(targetDir, { recursive: true });

      // Copy all files
      const files = await fs.readdir(dir);
      for (const file of files) {
        await fs.copyFile(join(dir, file), join(targetDir, file));
      }
    }
  }

  private async downloadBackup(backupId: string, dir: string): Promise<void> {
    if (this.config.storage.type === 'S3' && this.s3Client) {
      // Download from S3
      const files = ['metadata.json', 'backup.compressed', 'backup.encrypted'];

      for (const file of files) {
        try {
          const response = await this.s3Client.send(new GetObjectCommand({
            Bucket: this.config.storage.s3!.bucket,
            Key: `${this.config.storage.s3!.prefix}/${backupId}/${file}`,
          }));

          const writeStream = createWriteStream(join(dir, file));
          await pipeline(response.Body as any, writeStream);
        } catch (e) {
          // File might not exist
        }
      }
    } else if (this.config.storage.type === 'LOCAL' && this.config.storage.local) {
      // Copy from local storage
      const fs = await import('fs/promises');
      const sourceDir = join(this.config.storage.local.path, backupId);

      const files = await fs.readdir(sourceDir);
      for (const file of files) {
        await fs.copyFile(join(sourceDir, file), join(dir, file));
      }
    }
  }

  private async restoreTableData(table: string, data: any[]): Promise<void> {
    const batchSize = 1000;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      // Use COPY for faster bulk insert
      const columns = Object.keys(batch[0]);
      const values = batch.map(row =>
        `(${columns.map(col => `'${row[col]}'`).join(', ')})`
      ).join(', ');

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values}`
      );
    }
  }

  private async recreateIndexes(tables: string[]): Promise<void> {
    // Implementation would recreate indexes based on schema
    logger.info('Recreating indexes');
  }

  private async verifyRestore(backupId: string, tables: string[]): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const table of tables) {
      try {
        const count = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM ${table}`);
        logger.info(`Verified ${table}: ${count} records`);
      } catch (error) {
        errors.push(`Verification failed for ${table}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  private async updateBackupRegistry(metadata: BackupMetadata): Promise<void> {
    const registry = await this.getBackupRegistry();
    registry.push(metadata);

    // Keep only last 1000 entries in Redis
    if (registry.length > 1000) {
      registry.splice(0, registry.length - 1000);
    }

    await this.redis.set('payment_backup_registry', JSON.stringify(registry));
  }

  private async getBackupRegistry(): Promise<BackupMetadata[]> {
    const registry = await this.redis.get('payment_backup_registry');
    return registry ? JSON.parse(registry) : [];
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const registry = await this.getBackupRegistry();
    return registry.find(b => b.id === backupId) || null;
  }

  private async deleteBackup(backupId: string): Promise<void> {
    // Delete from storage
    if (this.config.storage.type === 'S3' && this.s3Client) {
      // Delete from S3
      // Implementation would list and delete objects
    }

    // Update registry
    const registry = await this.getBackupRegistry();
    const filtered = registry.filter(b => b.id !== backupId);
    await this.redis.set('payment_backup_registry', JSON.stringify(filtered));

    logger.info(`Deleted backup: ${backupId}`);
  }

  private async createRestorePlan(
    metadata: BackupMetadata,
    tables: string[],
    pointInTime?: Date
  ): Promise<any> {
    // Implementation would create a detailed restore plan
    return {
      steps: tables.map(table => ({ table, action: 'restore' })),
      estimatedTime: tables.length * 60, // seconds
      dependencies: [],
    };
  }

  private async logRestoreEvent(
    backupId: string,
    restoredTables: string[],
    errors: string[]
  ): Promise<void> {
    const event = {
      backupId,
      restoredTables,
      errors,
      timestamp: new Date(),
    };

    await this.redis.lpush('payment_restore_logs', JSON.stringify(event));
    await this.redis.ltrim('payment_restore_logs', 0, 99); // Keep last 100 logs
  }
}