import AWS from 'aws-sdk';
import { SecretsManager, GetSecretValueCommand, UpdateSecretCommand, RotateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { KMS, GenerateDataKeyCommand, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { Logger } from '../utils/logger';
import crypto from 'crypto';

interface SecretMetadata {
  name: string;
  version?: string;
  stage?: string;
  description?: string;
  lastRotatedAt?: Date;
  nextRotationDate?: Date;
  rotationRule?: {
    automaticallyAfterDays?: number;
  };
}

interface SecretRotationConfig {
  rotationDays: number;
  autoRotate: boolean;
  notificationEmail: string;
}

class SecretsManagerService {
  private secretsManager: SecretsManager;
  private kms: KMS;
  private logger: Logger;
  private cache: Map<string, { value: any; timestamp: number; ttl: number }>;
  private rotationCache: Map<string, Date>;
  private encryptionKeyId?: string;

  constructor(
    region: string = 'us-east-1',
    encryptionKeyId?: string
  ) {
    this.secretsManager = new SecretsManager({ region });
    this.kms = new KMS({ region });
    this.logger = new Logger('SecretsManager');
    this.cache = new Map();
    this.rotationCache = new Map();
    this.encryptionKeyId = encryptionKeyId;
  }

  // Get secret from AWS Secrets Manager
  async getSecret(
    secretName: string,
    versionId?: string,
    stage?: string
  ): Promise<any> {
    const cacheKey = `${secretName}:${versionId || 'latest'}:${stage || 'AWSCURRENT'}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
        VersionId: versionId,
        VersionStage: stage
      });

      const response = await this.secretsManager.send(command);

      let secretValue;
      if (response.SecretString) {
        // Handle JSON secrets
        try {
          secretValue = JSON.parse(response.SecretString);
        } catch {
          secretValue = response.SecretString;
        }
      } else if (response.SecretBinary) {
        // Handle binary secrets
        if (this.encryptionKeyId) {
          // Decrypt using KMS
          const decryptCommand = new DecryptCommand({
            CiphertextBlob: response.SecretBinary,
            KeyId: this.encryptionKeyId
          });
          const decryptResponse = await this.kms.send(decryptCommand);
          const secretString = Buffer.from(decryptResponse.Plaintext as Uint8Array).toString('utf8');
          secretValue = JSON.parse(secretString);
        } else {
          secretValue = response.SecretBinary;
        }
      }

      // Cache the secret
      this.cache.set(cacheKey, {
        value: secretValue,
        timestamp: Date.now(),
        ttl: 300000 // 5 minutes
      });

      this.logger.debug(`Retrieved secret: ${secretName}`, {
        versionId: response.VersionId,
        versionStages: response.VersionStages
      });

      return secretValue;
    } catch (error) {
      this.logger.error(`Failed to retrieve secret: ${secretName}`, error);
      throw error;
    }
  }

  // Create or update a secret
  async setSecret(
    secretName: string,
    secretValue: any,
    description?: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      let secretString: string;
      let secretBinary: Uint8Array | undefined;

      if (this.encryptionKeyId) {
        // Encrypt the secret
        const valueString = typeof secretValue === 'string' ?
          secretValue : JSON.stringify(secretValue);

        const encryptCommand = new EncryptCommand({
          KeyId: this.encryptionKeyId,
          Plaintext: Buffer.from(valueString)
        });

        const encryptResponse = await this.kms.send(encryptCommand);
        secretBinary = encryptResponse.CiphertextBlob;
      } else {
        secretString = typeof secretValue === 'string' ?
          secretValue : JSON.stringify(secretValue);
      }

      const command = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: this.encryptionKeyId ? undefined : secretString,
        SecretBinary: this.encryptionKeyId ? secretBinary : undefined,
        Description: description,
        ClientRequestToken: this.generateClientToken(),
        ForceOverwriteReplicaSecretVersion: true
      });

      const response = await this.secretsManager.send(command);

      // Invalidate cache
      this.invalidateCache(secretName);

      this.logger.info(`Updated secret: ${secretName}`, {
        versionId: response.VersionId,
        arn: response.ARN
      });

      return response.ARN || response.SecretId || secretName;
    } catch (error) {
      this.logger.error(`Failed to set secret: ${secretName}`, error);
      throw error;
    }
  }

  // Rotate a secret
  async rotateSecret(
    secretName: string,
    rotationConfig?: SecretRotationConfig
  ): Promise<void> {
    try {
      const secretValue = await this.getSecret(secretName);
      const rotatedValue = this.rotateSecretValue(secretValue);

      // Update with new version
      await this.setSecret(
        secretName,
        rotatedValue,
        `Rotated on ${new Date().toISOString()}`,
        {
          ...metadata,
          rotatedBy: 'SecretsManagerService',
          rotationVersion: new Date().toISOString()
        }
      );

      // Update rotation cache
      this.rotationCache.set(secretName, new Date());

      // Send notification
      if (rotationConfig?.notificationEmail) {
        await this.sendRotationNotification(secretName, rotationConfig.notificationEmail);
      }

      // Track rotation metrics
      await this.trackRotation(secretName, true);

      this.logger.info(`Successfully rotated secret: ${secretName}`);
    } catch (error) {
      this.logger.error(`Failed to rotate secret: ${secretName}`, error);
      await this.trackRotation(secretName, false);
      throw error;
    }
  }

  // Auto-rotate secrets based on schedule
  async autoRotateSecrets(secretNames: string[]): Promise<void> {
    const results = await Promise.allSettled(
      secretNames.map(async (secretName) => {
        try {
          const metadata = await this.getSecretMetadata(secretName);

          if (metadata.rotationRule?.automaticallyAfterDays) {
            const lastRotated = this.rotationCache.get(secretName);
            const shouldRotate = !lastRotated ||
              (Date.now() - lastRotated.getTime()) >
              metadata.rotationRule.automaticallyAfterDays * 24 * 60 * 60 * 1000;

            if (shouldRotate) {
              await this.rotateSecret(secretName, {
                rotationDays: metadata.rotationRule.automaticallyAfterDays,
                autoRotate: true
              });
            }
          }

          return { secretName, success: true };
        } catch (error) {
          this.logger.error(`Failed to check rotation for: ${secretName}`, error);
          return { secretName, success: false, error };
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected' || !r.value?.success);
    if (failures.length > 0) {
      this.logger.error(`Failed to rotate ${failures.length} secrets`, failures);
    }
  }

  // Get all secrets metadata
  async listSecrets(filter?: string): Promise<SecretMetadata[]> {
    try {
      const secrets = await this.secretsManager.send({
        IncludePlannedDeletion: false,
        Filters: filter ? [{
          Key: 'name',
          Values: [filter]
        }] : []
      });

      return secrets.SecretList?.map(secret => ({
        name: secret.Name!,
        arn: secret.ARN!,
        lastRotatedAt: secret.LastRotatedDate ? new Date(secret.LastRotatedDate) : undefined,
        nextRotationDate: secret.NextRotationDate ? new Date(secret.NextRotationDate) : undefined,
        rotationRule: secret.RotationRules,
        description: secret.Description
      })) || [];
    } catch (error) {
      this.logger.error('Failed to list secrets', error);
      throw error;
    }
  }

  // Delete a secret
  async deleteSecret(
    secretName: string,
    forceDeleteWithoutRecovery: boolean = false,
    recoveryWindowInDays: number = 30
  ): Promise<void> {
    try {
      await this.secretsManager.send({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: forceDeleteWithoutRecovery,
        RecoveryWindowInDays: forceDeleteWithoutRecovery ? 0 : recoveryWindowInDays
      });

      // Invalidate cache
      this.invalidateCache(secretName);
      this.rotationCache.delete(secretName);

      this.logger.info(`Scheduled deletion for secret: ${secretName}`, {
        forceDeleteWithoutRecovery,
        recoveryWindowInDays
      });
    } catch (error) {
      this.logger.error(`Failed to delete secret: ${secretName}`, error);
      throw error;
    }
  }

  // Generate a data key for client-side encryption
  async generateDataKey(): Promise<{
    plaintextKey: string;
    encryptedKey: Buffer;
    keyId: string;
  }> {
    if (!this.encryptionKeyId) {
      throw new Error('KMS key ID is required for data key generation');
    }

    try {
      const command = new GenerateDataKeyCommand({
        KeyId: this.encryptionKeyId,
        KeySpec: 'AES_256'
      });

      const response = await this.kms.send(command);

      return {
        plaintextKey: Buffer.from(response.Plaintext as Uint8Array).toString('base64'),
        encryptedKey: Buffer.from(response.CiphertextBlob as Uint8Array),
        keyId: response.KeyId!
      };
    } catch (error) {
      this.logger.error('Failed to generate data key', error);
      throw error;
    }
  }

  // Batch get multiple secrets
  async getSecretsBatch(secretNames: string[]): Promise<Map<string, any>> {
    const secrets = new Map<string, any>();

    await Promise.all(
      secretNames.map(async (name) => {
        try {
          const value = await this.getSecret(name);
          secrets.set(name, value);
        } catch (error) {
          this.logger.error(`Failed to get secret in batch: ${name}`, error);
          secrets.set(name, null);
        }
      })
    );

    return secrets;
  }

  // Cache management
  private invalidateCache(secretName: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(secretName)) {
        this.cache.delete(key);
      }
    }
  }

  private generateClientToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private rotateSecretValue(currentValue: any): any {
    // This should be customized based on the secret type
    if (typeof currentValue === 'object') {
      const rotated = { ...currentValue };

      // Rotate passwords
      if (rotated.password) {
        rotated.password = this.generateStrongPassword();
      }

      // Rotate tokens
      if (rotated.apiKey) {
        rotated.apiKey = this.generateApiKey();
      }

      if (rotated.jwtSecret) {
        rotated.jwtSecret = crypto.randomBytes(64).toString('hex');
      }

      return rotated;
    }

    return typeof currentValue === 'string' ?
      this.generateStrongPassword() : currentValue;
  }

  private generateStrongPassword(): string {
    const length = 32;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
  }

  private generateApiKey(): string {
    return `labelmintit_${crypto.randomBytes(32).toString('hex')}_${Date.now()}`;
  }

  private async sendRotationNotification(
    secretName: string,
    email: string
  ): Promise<void> {
    // Implementation would use your email service
    this.logger.info(`Rotation notification sent for ${secretName} to ${email}`);
  }

  private async trackRotation(secretName: string, success: boolean): Promise<void> {
    // Implementation would track metrics
    await fetch('http://localhost:9090/api/v1/metrics/job/secret_rotation/instance', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: `secret_rotation{secret_name="${secretName}",success="${success}"} 1\n`
    });
  }

  private async getSecretMetadata(secretName: string): Promise<SecretMetadata> {
    // Implementation would fetch secret metadata
    // For now, return default
    return {
      name: secretName,
      rotationRule: {
        automaticallyAfterDays: 90
      }
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();

    try {
      await this.secretsManager.send({ MaxResults: 1 });
      return {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start
      };
    }
  }

  // Cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      rotationCacheSize: this.rotationCache.size
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    this.rotationCache.clear();
  }
}

// Create singleton instance
export const SecretsService = new SecretsManagerService(
  process.env.AWS_REGION,
  process.env.KMS_ENCRYPTION_KEY_ID
);

export default SecretsService;