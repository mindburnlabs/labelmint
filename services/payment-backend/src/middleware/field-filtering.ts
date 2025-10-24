import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

interface FieldFilterOptions {
  maxFields?: number;
  allowedFields?: string[];
  defaultFields?: string[];
  strictMode?: boolean;
  cache?: boolean;
}

interface FieldFilterConfig {
  [key: string]: FieldFilterOptions;
}

interface FilterResult {
  fields: string[];
  hasWildcard: boolean;
  isNested: boolean;
  nestedFields: Map<string, Set<string>>;
}

interface FieldStats {
  totalRequests: number;
  filteredRequests: number;
  averageFieldCount: number;
  mostRequestedFields: Map<string, number>;
  cacheHits: number;
  cacheMisses: number;
}

export class FieldFilterMiddleware {
  private logger: Logger;
  private metrics: MetricsCollector;
  private config: FieldFilterConfig;
  private fieldCache: Map<string, FilterResult>;
  private stats: FieldStats;

  constructor(config: FieldFilterConfig = {}) {
    this.logger = new Logger('FieldFilterMiddleware');
    this.metrics = new MetricsCollector('field_filter');
    this.config = config;
    this.fieldCache = new Map();
    this.stats = {
      totalRequests: 0,
      filteredRequests: 0,
      averageFieldCount: 0,
      mostRequestedFields: new Map(),
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Main field filtering middleware
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      try {
        // Get route-specific config
        const routeKey = this.getRouteKey(req);
        const options = this.config[routeKey] || this.getDefaultOptions();

        // Parse fields from query parameter
        const fieldsQuery = req.query.fields as string;
        if (!fieldsQuery) {
          // Apply default fields if specified
          if (options.defaultFields) {
            req.filteredFields = options.defaultFields;
          }
          this.recordMetrics(Date.now() - startTime, false, options.defaultFields?.length || 0);
          next();
          return;
        }

        // Parse and validate field selection
        const filterResult = this.parseFields(fieldsQuery);

        // Validate against allowed fields if strict mode is enabled
        if (options.strictMode && options.allowedFields) {
          this.validateFields(filterResult.fields, options.allowedFields);
        }

        // Check field count limit
        if (options.maxFields && filterResult.fields.length > options.maxFields) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Too many fields requested. Maximum allowed: ${options.maxFields}`,
            requested: filterResult.fields.length,
            allowed: options.maxFields
          });
          return;
        }

        // Attach filtered fields to request object
        req.filteredFields = filterResult.fields;
        req.filterResult = filterResult;

        // Record statistics
        this.stats.filteredRequests++;
        this.stats.averageFieldCount =
          (this.stats.averageFieldCount * (this.stats.filteredRequests - 1) + filterResult.fields.length) /
          this.stats.filteredRequests;

        filterResult.fields.forEach(field => {
          const count = this.stats.mostRequestedFields.get(field) || 0;
          this.stats.mostRequestedFields.set(field, count + 1);
        });

        this.recordMetrics(Date.now() - startTime, true, filterResult.fields.length);

        this.logger.debug(`Field filtering applied: ${fieldsQuery} -> [${filterResult.fields.join(', ')}]`);
        next();
      } catch (error) {
        this.logger.error('Field filtering error', error);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid fields parameter',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
  }

  /**
   * GraphQL field filtering middleware
   */
  graphqlMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // For GraphQL, field selection is handled in the resolver
      // This middleware just parses and validates the query
      const query = req.body.query;
      if (!query) {
        next();
        return;
      }

      try {
        // Extract field selections from GraphQL query
        const extractedFields = this.extractGraphQLFields(query);

        // Attach to request for use in resolvers
        req.graphqlFields = extractedFields;

        this.logger.debug(`GraphQL fields extracted: ${JSON.stringify(extractedFields)}`);
        next();
      } catch (error) {
        this.logger.error('GraphQL field extraction error', error);
        next(); // Don't block the request, just log the error
      }
    };
  }

  /**
   * Apply field filtering to data objects
   */
  applyFilter<T extends Record<string, any>>(
    data: T | T[],
    fields: string[] | undefined
  ): T | T[] {
    if (!fields || fields.length === 0) {
      return data;
    }

    const filterObject = (obj: Record<string, any>): Record<string, any> => {
      const filtered: Record<string, any> = {};

      for (const field of fields) {
        if (field.includes('.')) {
          // Handle nested field selection
          const [parentField, ...nestedPath] = field.split('.');
          if (obj[parentField]) {
            if (!filtered[parentField]) {
              filtered[parentField] = typeof obj[parentField] === 'object' ? {} : obj[parentField];
            }
            if (typeof filtered[parentField] === 'object') {
              filtered[parentField] = this.setNestedValue(
                filtered[parentField],
                nestedPath,
                this.getNestedValue(obj[parentField], nestedPath)
              );
            }
          }
        } else if (obj.hasOwnProperty(field)) {
          filtered[field] = obj[field];
        }
      }

      return filtered;
    };

    if (Array.isArray(data)) {
      return data.map(item => filterObject(item)) as T[];
    } else {
      return filterObject(data) as T;
    }
  }

  /**
   * Parse fields query string into structured result
   */
  private parseFields(fieldsQuery: string): FilterResult {
    // Check cache first
    const cacheKey = fieldsQuery;
    const cached = this.fieldCache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;

    const fields = fieldsQuery.split(',').map(field => field.trim()).filter(field => field.length > 0);
    const hasWildcard = fields.some(field => field === '*');
    const isNested = fields.some(field => field.includes('.'));
    const nestedFields = new Map<string, Set<string>>();

    for (const field of fields) {
      if (field.includes('.') && !field.startsWith('*')) {
        const [parentField, ...nestedPath] = field.split('.');
        if (!nestedFields.has(parentField)) {
          nestedFields.set(parentField, new Set());
        }
        nestedFields.get(parentField)!.add(nestedPath.join('.'));
      }
    }

    const result: FilterResult = {
      fields,
      hasWildcard,
      isNested,
      nestedFields
    };

    // Cache the result (limit cache size)
    if (this.fieldCache.size < 1000) {
      this.fieldCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Validate fields against allowed fields
   */
  private validateFields(requestedFields: string[], allowedFields: string[]): void {
    const invalidFields = requestedFields.filter(field => {
      // Check if field is in allowed fields
      if (allowedFields.includes(field)) {
        return false;
      }

      // Check nested fields
      if (field.includes('.')) {
        const [parentField, ...nestedPath] = field.split('.');
        const parentAllowed = allowedFields.some(allowed =>
          allowed === parentField || allowed.startsWith(`${parentField}.`)
        );
        return !parentAllowed;
      }

      return true;
    });

    if (invalidFields.length > 0) {
      throw new Error(`Invalid fields requested: ${invalidFields.join(', ')}`);
    }
  }

  /**
   * Extract fields from GraphQL query
   */
  private extractGraphQLFields(query: string): Record<string, string[]> {
    const fields: Record<string, string[]> = {};

    // Simple regex-based field extraction
    // In production, use a proper GraphQL parser
    const fieldRegex = /\{([^}]+)\}/g;
    const matches = query.matchAll(fieldRegex);

    for (const match of matches) {
      const fieldSelection = match[1];
      const fieldList = fieldSelection
        .split(/\s+/)
        .map(field => field.trim().replace(/[{}(),]/g, ''))
        .filter(field => field.length > 0 && !field.includes('query') && !field.includes('mutation'));

      if (fieldList.length > 0) {
        fields.root = fieldList;
      }
    }

    return fields;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string[]): any {
    let current = obj;
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string[], value: any): any {
    if (path.length === 0) {
      return value;
    }

    const [key, ...remaining] = path;
    if (!obj[key]) {
      obj[key] = remaining.length > 0 ? {} : value;
    }

    if (remaining.length > 0) {
      obj[key] = this.setNestedValue(obj[key], remaining, value);
    } else {
      obj[key] = value;
    }

    return obj;
  }

  /**
   * Get route key for configuration lookup
   */
  private getRouteKey(req: Request): string {
    const route = req.route?.path || req.path;
    const method = req.method.toLowerCase();
    return `${method}:${route}`;
  }

  /**
   * Get default field filter options
   */
  private getDefaultOptions(): FieldFilterOptions {
    return {
      maxFields: 20,
      strictMode: false,
      cache: true
    };
  }

  /**
   * Record metrics
   */
  private recordMetrics(duration: number, filtered: boolean, fieldCount: number): void {
    this.metrics.histogram('filter_duration', duration);
    this.metrics.increment(filtered ? 'filtered_requests' : 'unfiltered_requests');
    this.metrics.histogram('field_count', fieldCount);
  }

  /**
   * Get field filtering statistics
   */
  getStats(): FieldStats {
    return {
      ...this.stats,
      mostRequestedFields: new Map(this.stats.mostRequestedFields)
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      filteredRequests: 0,
      averageFieldCount: 0,
      mostRequestedFields: new Map(),
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Clear field cache
   */
  clearCache(): void {
    this.fieldCache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: FieldFilterConfig): void {
    this.config = { ...this.config, ...config };
    this.clearCache(); // Clear cache when config changes
  }

  /**
   * Create field filter preset for different entity types
   */
  static createPresets(): FieldFilterConfig {
    return {
      // User entity fields
      'get:/api/users': {
        allowedFields: ['id', 'email', 'name', 'role', 'status', 'createdAt', 'updatedAt'],
        defaultFields: ['id', 'email', 'name', 'status'],
        maxFields: 10,
        strictMode: true
      },
      'get:/api/users/:id': {
        allowedFields: ['id', 'email', 'name', 'role', 'status', 'profile', 'preferences', 'createdAt', 'updatedAt'],
        defaultFields: ['id', 'email', 'name', 'role', 'status', 'profile'],
        maxFields: 15,
        strictMode: true
      },

      // Task entity fields
      'get:/api/tasks': {
        allowedFields: ['id', 'title', 'status', 'priority', 'assigneeId', 'projectId', 'dueDate', 'createdAt', 'updatedAt'],
        defaultFields: ['id', 'title', 'status', 'priority'],
        maxFields: 12,
        strictMode: true
      },
      'get:/api/tasks/:id': {
        allowedFields: ['id', 'title', 'description', 'status', 'priority', 'assigneeId', 'creatorId', 'projectId', 'tags', 'dueDate', 'createdAt', 'updatedAt', 'assignee', 'creator', 'project'],
        defaultFields: ['id', 'title', 'description', 'status', 'priority', 'assignee', 'project'],
        maxFields: 20,
        strictMode: true
      },

      // Project entity fields
      'get:/api/projects': {
        allowedFields: ['id', 'name', 'status', 'ownerId', 'createdAt', 'updatedAt'],
        defaultFields: ['id', 'name', 'status'],
        maxFields: 10,
        strictMode: true
      },

      // Analytics fields
      'get:/api/analytics/*': {
        allowedFields: ['id', 'metric', 'value', 'timestamp', 'period', 'filters'],
        defaultFields: ['metric', 'value', 'timestamp'],
        maxFields: 8,
        strictMode: true
      },

      // Comment fields
      'get:/api/comments': {
        allowedFields: ['id', 'content', 'authorId', 'taskId', 'parentId', 'createdAt', 'updatedAt'],
        defaultFields: ['id', 'content', 'authorId', 'createdAt'],
        maxFields: 10,
        strictMode: true
      }
    };
  }
}

export default FieldFilterMiddleware;
export { FieldFilterOptions, FieldFilterConfig, FilterResult, FieldStats };