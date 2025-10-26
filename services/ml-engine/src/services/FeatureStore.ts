/**
 * Feature Store Service
 * Centralized feature storage and retrieval for ML models
 */

import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { mlConfig } from '@/config/ml.config';
import { logger } from '@/utils/logger';
import { FeatureStore as IFeatureStore } from '@/types/ml.types';

export class FeatureStoreService {
  private redis: Redis;
  private prisma: PrismaClient;
  private cache: Map<string, { value: any; expires: number }> = new Map();
  private readonly cacheTTL = mlConfig.featureStore.cacheTTL * 1000; // Convert to ms

  constructor() {
    this.redis = new Redis({
      host: mlConfig.redis.host,
      port: mlConfig.redis.port,
      password: mlConfig.redis.password,
      db: mlConfig.redis.db,
      maxRetriesPerRequest: mlConfig.redis.maxRetriesPerRequest,
      enableOfflineQueue: mlConfig.redis.enableOfflineQueue,
    });

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `postgresql://${mlConfig.database.username}:${mlConfig.database.password}@${mlConfig.database.host}:${mlConfig.database.port}/${mlConfig.database.database}`,
        },
      },
    });

    // Clean up expired cache entries periodically
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Get features for an entity
   */
  async getFeatures(
    entityId: string,
    entityType: string,
    featureNames: string[]
  ): Promise<Record<string, any>> {
    const cacheKey = this.getCacheKey(entityId, entityType, featureNames);

    // Check memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Check Redis cache
    if (mlConfig.featureStore.cacheTTL > 0) {
      try {
        const redisCached = await this.redis.get(cacheKey);
        if (redisCached) {
          const features = JSON.parse(redisCached);
          this.cache.set(cacheKey, { value: features, expires: Date.now() + this.cacheTTL });
          return features;
        }
      } catch (error) {
        logger.warn('Redis cache read failed, falling back to database', { error, entityId, entityType });
      }
    }

    // Fetch from database
    const features = await this.fetchFeaturesFromDB(entityId, entityType, featureNames);

    // Cache the result
    if (mlConfig.featureStore.cacheTTL > 0) {
      try {
        await this.redis.setex(
          cacheKey,
          mlConfig.featureStore.cacheTTL,
          JSON.stringify(features)
        );
      } catch (error) {
        logger.warn('Redis cache write failed', { error, entityId, entityType });
      }
    }

    this.cache.set(cacheKey, { value: features, expires: Date.now() + this.cacheTTL });

    return features;
  }

  /**
   * Update features for an entity
   */
  async updateFeatures(
    entityId: string,
    entityType: string,
    features: Record<string, any>,
    isRealTime: boolean = false
  ): Promise<void> {
    const timestamp = new Date();
    const updates: Array<{
      feature_name: string;
      feature_value: any;
      feature_type: string;
      is_real_time: boolean;
      updated_at: Date;
      version: number;
    }> = [];

    for (const [featureName, value] of Object.entries(features)) {
      const featureType = this.inferFeatureType(value);

      updates.push({
        feature_name: featureName,
        feature_value: value,
        feature_type: featureType,
        is_real_time: isRealTime,
        updated_at: timestamp,
        version: 1, // Will be incremented in database
      });
    }

    try {
      // Use upsert operation for each feature
      await Promise.all(
        updates.map(update =>
          this.prisma.$executeRaw`
            INSERT INTO feature_store (
              entity_id, entity_type, feature_name, feature_value,
              feature_type, is_real_time, updated_at, version
            ) VALUES (
              ${entityId}, ${entityType}, ${update.feature_name},
              ${JSON.stringify(update.feature_value)}, ${update.feature_type},
              ${update.is_real_time}, ${update.updated_at},
              COALESCE((SELECT MAX(version) FROM feature_store
                       WHERE entity_id = ${entityId}
                       AND entity_type = ${entityType}
                       AND feature_name = ${update.feature_name}), 0) + 1
            )
            ON CONFLICT (entity_id, entity_type, feature_name)
            DO UPDATE SET
              feature_value = EXCLUDED.feature_value,
              feature_type = EXCLUDED.feature_type,
              is_real_time = EXCLUDED.is_real_time,
              updated_at = EXCLUDED.updated_at,
              version = EXCLUDED.version
          `
        )
      );

      // Invalidate cache for this entity
      await this.invalidateCache(entityId, entityType);

      logger.info('Features updated successfully', {
        entityId,
        entityType,
        featureCount: updates.length,
        isRealTime,
      });

    } catch (error) {
      logger.error('Failed to update features', {
        error,
        entityId,
        entityType,
        features: Object.keys(features),
      });
      throw error;
    }
  }

  /**
   * Get historical features for time-series analysis
   */
  async getHistoricalFeatures(
    entityId: string,
    entityType: string,
    featureNames: string[],
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{ timestamp: Date; features: Record<string, any> }>> {
    try {
      const results = await this.prisma.$queryRaw<Array<{
        timestamp: Date;
        feature_name: string;
        feature_value: any;
      }>>`
        SELECT
          DATE_TRUNC(${interval}, updated_at) as timestamp,
          feature_name,
          feature_value
        FROM feature_store
        WHERE entity_id = ${entityId}
          AND entity_type = ${entityType}
          AND feature_name = ANY(${featureNames})
          AND updated_at BETWEEN ${startDate} AND ${endDate}
        ORDER BY timestamp, feature_name
      `;

      // Group by timestamp
      const grouped = new Map<Date, Record<string, any>>();

      for (const row of results) {
        const timestamp = new Date(row.timestamp);
        if (!grouped.has(timestamp)) {
          grouped.set(timestamp, {});
        }
        const features = grouped.get(timestamp)!;
        features[row.feature_name] = JSON.parse(row.feature_value as string);
      }

      return Array.from(grouped.entries()).map(([timestamp, features]) => ({
        timestamp,
        features,
      }));

    } catch (error) {
      logger.error('Failed to fetch historical features', {
        error,
        entityId,
        entityType,
        featureNames,
        startDate,
        endDate,
      });
      throw error;
    }
  }

  /**
   * Get feature statistics for monitoring
   */
  async getFeatureStatistics(
    entityType: string,
    featureName: string,
    timeWindow: number = 24 // hours
  ): Promise<{
    count: number;
    null_count: number;
    numeric_stats?: {
      min: number;
      max: number;
      mean: number;
      std_dev: number;
      median: number;
      q25: number;
      q75: number;
    };
    categorical_stats?: {
      unique_values: number;
      top_values: Array<{ value: string; count: number; percentage: number }>;
    };
    last_updated: Date;
  }> {
    try {
      const startDate = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

      const features = await this.prisma.$queryRaw<Array<{
        feature_value: string;
        updated_at: Date;
      }>>`
        SELECT feature_value, updated_at
        FROM feature_store
        WHERE entity_type = ${entityType}
          AND feature_name = ${featureName}
          AND updated_at >= ${startDate}
      `;

      if (features.length === 0) {
        return {
          count: 0,
          null_count: 0,
          last_updated: new Date(),
        };
      }

      const values = features.map((f: any) => {
        try {
          return JSON.parse(f.feature_value);
        } catch {
          return f.feature_value;
        }
      });

      const nullCount = values.filter((v: any) => v === null || v === undefined).length;
      const validValues = values.filter((v: any) => v !== null && v !== undefined);

      // Determine if feature is numeric or categorical
      const numericValues = validValues.filter((v: any) => typeof v === 'number') as number[];
      const isNumeric = numericValues.length > validValues.length * 0.8;

      let stats: any = {
        count: features.length,
        null_count: nullCount,
        last_updated: new Date(Math.max(...features.map((f: any) => f.updated_at.getTime()))),
      };

      if (isNumeric && numericValues.length > 0) {
        numericValues.sort((a: number, b: number) => a - b);
        const mean = numericValues.reduce((sum: number, v: number) => sum + v, 0) / numericValues.length;
        const variance = numericValues.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / numericValues.length;

        stats.numeric_stats = {
          min: numericValues[0],
          max: numericValues[numericValues.length - 1],
          mean,
          std_dev: Math.sqrt(variance),
          median: numericValues[Math.floor(numericValues.length / 2)],
          q25: numericValues[Math.floor(numericValues.length * 0.25)],
          q75: numericValues[Math.floor(numericValues.length * 0.75)],
        };
      } else {
        // Categorical statistics
        const valueCounts = new Map<string, number>();
        for (const value of validValues) {
          const key = String(value);
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        }

        const sortedValues = Array.from(valueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([value, count]) => ({
            value,
            count,
            percentage: (count / validValues.length) * 100,
          }));

        stats.categorical_stats = {
          unique_values: valueCounts.size,
          top_values: sortedValues,
        };
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get feature statistics', {
        error,
        entityType,
        featureName,
        timeWindow,
      });
      throw error;
    }
  }

  /**
   * Batch update features for multiple entities
   */
  async batchUpdateFeatures(
    updates: Array<{
      entityId: string;
      entityType: string;
      features: Record<string, any>;
      isRealTime?: boolean;
    }>
  ): Promise<void> {
    const batchSize = mlConfig.featureStore.batchSize;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      await Promise.all(
        batch.map(update =>
          this.updateFeatures(
            update.entityId,
            update.entityType,
            update.features,
            update.isRealTime || false
          )
        )
      );
    }

    logger.info('Batch feature update completed', {
      totalUpdates: updates.length,
      batchSize,
    });
  }

  /**
   * Delete old features based on retention policy
   */
  async cleanupOldFeatures(): Promise<number> {
    const retentionDate = new Date(
      Date.now() - mlConfig.featureStore.retentionDays * 24 * 60 * 60 * 1000
    );

    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM feature_store
        WHERE updated_at < ${retentionDate}
        RETURNING id
      `;

      const deletedCount = Array.isArray(result) ? result.length : 0;

      logger.info('Feature cleanup completed', {
        deletedCount,
        retentionDate,
      });

      return deletedCount;

    } catch (error) {
      logger.error('Feature cleanup failed', { error, retentionDate });
      throw error;
    }
  }

  /**
   * Get feature drift metrics
   */
  async getFeatureDrift(
    entityType: string,
    featureName: string,
    referencePeriod: number = 7, // days
    currentPeriod: number = 1 // day
  ): Promise<{
    drift_score: number;
    population_stability_index: number;
    kl_divergence?: number;
    reference_stats: any;
    current_stats: any;
  }> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - currentPeriod * 24 * 60 * 60 * 1000);
    const referenceStart = new Date(now.getTime() - (referencePeriod + currentPeriod) * 24 * 60 * 60 * 1000);
    const referenceEnd = new Date(now.getTime() - currentPeriod * 24 * 60 * 60 * 1000);

    const [referenceStats, currentStats] = await Promise.all([
      this.getFeatureStatistics(entityType, featureName, referencePeriod * 24),
      this.getFeatureStatistics(entityType, featureName, currentPeriod * 24),
    ]);

    // Calculate Population Stability Index (PSI)
    let psi = 0;
    if (referenceStats.numeric_stats && currentStats.numeric_stats) {
      // For numeric features, use bins
      const bins = this.createNumericBins(referenceStats.numeric_stats);
      psi = this.calculatePSI(
        this.binValues(referenceStats.numeric_stats, bins),
        this.binValues(currentStats.numeric_stats, bins)
      );
    } else if (referenceStats.categorical_stats && currentStats.categorical_stats) {
      // For categorical features
      psi = this.calculateCategoricalPSI(
        referenceStats.categorical_stats.top_values,
        currentStats.categorical_stats.top_values
      );
    }

    return {
      drift_score: Math.min(psi / 0.25, 1), // Normalize to 0-1, 0.25 is significant drift
      population_stability_index: psi,
      reference_stats: referenceStats,
      current_stats: currentStats,
    };
  }

  /**
   * Create cache key for features
   */
  private getCacheKey(entityId: string, entityType: string, featureNames: string[]): string {
    const featuresHash = featureNames.sort().join(',');
    return `features:${entityType}:${entityId}:${Buffer.from(featuresHash).toString('base64')}`;
  }

  /**
   * Invalidate cache for an entity
   */
  private async invalidateCache(entityId: string, entityType: string): Promise<void> {
    try {
      const pattern = `features:${entityType}:${entityId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.warn('Failed to invalidate cache', { error, entityId, entityType });
    }

    // Clear memory cache
    for (const key of this.cache.keys()) {
      if (key.includes(`:${entityType}:${entityId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Fetch features from database
   */
  private async fetchFeaturesFromDB(
    entityId: string,
    entityType: string,
    featureNames: string[]
  ): Promise<Record<string, any>> {
    try {
      const features = await this.prisma.$queryRaw<Array<{
        feature_name: string;
        feature_value: string;
        updated_at: Date;
        version: number;
      }>>`
        SELECT feature_name, feature_value, updated_at, version
        FROM feature_store
        WHERE entity_id = ${entityId}
          AND entity_type = ${entityType}
          AND feature_name = ANY(${featureNames})
        ORDER BY version DESC
      `;

      const result: Record<string, any> = {};
      const seenFeatures = new Set<string>();

      for (const feature of features) {
        if (!seenFeatures.has(feature.feature_name)) {
          try {
            result[feature.feature_name] = JSON.parse(feature.feature_value);
            seenFeatures.add(feature.feature_name);
          } catch (error) {
            // Handle non-JSON values
            result[feature.feature_name] = feature.feature_value;
            seenFeatures.add(feature.feature_name);
          }
        }
      }

      return result;

    } catch (error) {
      logger.error('Failed to fetch features from database', {
        error,
        entityId,
        entityType,
        featureNames,
      });
      throw error;
    }
  }

  /**
   * Infer feature type from value
   */
  private inferFeatureType(value: any): string {
    if (value === null || value === undefined) return 'unknown';
    if (typeof value === 'number') return 'numeric';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'timestamp';
    if (typeof value === 'string') {
      // Try to detect if it's a JSON string
      try {
        JSON.parse(value);
        return 'text';
      } catch {
        return 'categorical';
      }
    }
    if (typeof value === 'object') return 'text';
    return 'unknown';
  }

  /**
   * Clean up expired memory cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expires <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Create numeric bins for PSI calculation
   */
  private createNumericBins(stats: any): number[] {
    const { min, max, q25, median, q75 } = stats;
    return [min, q25, median, q75, max];
  }

  /**
   * Bin values using provided bin edges
   */
  private binValues(stats: any, bins: number[]): number[] {
    // This is a simplified binning - in production you'd want more sophisticated binning
    const { min, max } = stats;
    const binSize = (max - min) / (bins.length - 1);
    return bins.map((_, i) => 1 / bins.length); // Equal distribution for simplicity
  }

  /**
   * Calculate Population Stability Index
   */
  private calculatePSI(expected: number[], actual: number[]): number {
    let psi = 0;
    for (let i = 0; i < expected.length; i++) {
      const e = expected[i];
      const a = actual[i];

      if (e === 0 && a === 0) continue;

      // Add small constant to avoid log(0)
      const eSmooth = Math.max(e, 0.0001);
      const aSmooth = Math.max(a, 0.0001);

      psi += (aSmooth - eSmooth) * Math.log(aSmooth / eSmooth);
    }
    return psi;
  }

  /**
   * Calculate PSI for categorical features
   */
  private calculateCategoricalPSI(
    reference: Array<{ value: string; percentage: number }>,
    current: Array<{ value: string; percentage: number }>
  ): number {
    const refMap = new Map(reference.map(r => [r.value, r.percentage / 100]));
    const currMap = new Map(current.map(c => [c.value, c.percentage / 100]));

    const allValues = new Set([...refMap.keys(), ...currMap.keys()]);
    let psi = 0;

    for (const value of allValues) {
      const e = refMap.get(value) || 0;
      const a = currMap.get(value) || 0;

      if (e === 0 && a === 0) continue;

      const eSmooth = Math.max(e, 0.0001);
      const aSmooth = Math.max(a, 0.0001);

      psi += (aSmooth - eSmooth) * Math.log(aSmooth / eSmooth);
    }

    return psi;
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.redis.quit();
    await this.prisma.$disconnect();
  }
}

// Singleton instance
export const featureStore = new FeatureStoreService();