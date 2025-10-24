import { Request } from 'express';
import { Logger } from './logger';

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
  fields?: string[];
}

interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrevious: boolean;
    nextPageCursor?: string;
    prevPageCursor?: string;
  };
}

interface PaginationLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
  self: string;
}

export class PaginationHelper {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;
  private static readonly MIN_LIMIT = 1;
  private static readonly DEFAULT_SORT = 'createdAt';
  private static readonly CURSOR_SEPARATOR = '::';

  /**
   * Parse and validate pagination options
   */
  static parseOptions(req: Request): PaginationOptions {
    const {
      page: pageStr,
      limit: limitStr,
      sort,
      order,
      cursor,
      fields
    } = req.query;

    const options: PaginationOptions = {};

    // Parse limit
    const limit = parseInt(limitStr) || this.DEFAULT_LIMIT;
    options.limit = Math.min(Math.max(limit, this.MIN_LIMIT), this.MAX_LIMIT);

    // Parse page (for page-based pagination)
    if (pageStr && !cursor) {
      const page = parseInt(pageStr) || 1;
      options.page = Math.max(page, 1);
    }

    // Parse sort order
    if (order) {
      options.sortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';
    }

    // Parse sort field with validation
    if (sort) {
      // Whitelist of allowed sort fields to prevent SQL injection
      const allowedSortFields = ['id', 'createdAt', 'updatedAt', 'name', 'email', 'priority', 'status', 'rating', 'createdAt'];

      // Sanitize sort field
      const sanitizedSort = sort.replace(/[^a-zA-Z0-9_]/g, '');

      if (allowedSortFields.includes(sanitizedSort)) {
        options.sortBy = sanitizedSort;
      }
    }

    // Parse cursor
    if (cursor) {
      // Validate cursor format (basic validation)
      if (typeof cursor === 'string' && cursor.length < 1000) {
        options.cursor = cursor;
      }
    }

    // Parse fields
    if (fields && Array.isArray(fields)) {
      // Validate and sanitize field names
      const allowedFields = ['id', 'name', 'email', 'status', 'priority', 'rating', 'tags', 'category', 'dueDate'];
      options.fields = fields
        .map(field => String(field).trim())
        .filter(field =>
          field.length > 0 &&
          field.length < 50 &&
          allowedFields.includes(field)
        )
        .slice(0, 10); // Max 10 fields
    }

    return options;
  }

  /**
   * Create pagination metadata for response
   */
  static createMetadata<T>(
    data: T[],
    totalItems: number,
    options: PaginationOptions
  ): PaginationResult<T>['pagination'] {
    const { page, limit, sortBy, sortOrder } = options;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      currentPage: page || 1,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNext: page < totalPages,
      hasPrevious: (page || 1) > 1
    };
  }

  /**
   * Generate pagination links for page-based pagination
   */
  static generateLinks(
    req: Request,
    totalPages: number,
    currentPage: number,
    options: PaginationOptions
  ): PaginationLinks {
    const { limit, sortBy, sortOrder, fields } = options;
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;

    const links: PaginationLinks = {
      first: `${baseUrl}?limit=${limit}&page=1${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`,
      last: `${baseUrl}?limit=${limit}&page=${totalPages}${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`,
      self: `${baseUrl}?limit=${limit}&page=${currentPage}${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`
    };

    if (currentPage < totalPages) {
      links.next = `${baseUrl}?limit=${limit}&page=${currentPage + 1}${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`;
    }

    if (currentPage > 1) {
      links.prev = `${baseUrl}?limit=${limit}&page=${currentPage - 1}${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`;
    }

    return links;
  }

  /**
   * Create cursor-based pagination metadata
   */
  static createCursorMetadata<T>(
    data: T[],
    hasNext: boolean,
    options: PaginationOptions
  ): PaginationResult<T>['pagination'] {
    const { limit } = options;
    const hasPrevious = data.length > 0 && options.cursor !== null;

    // Extract cursor values from data
    const firstItem = data[0];
    const lastItem = data[data.length - 1];

    let nextPageCursor: string | undefined;
    if (hasNext && lastItem && typeof lastItem === 'object' && lastItem.id) {
      // Create next page cursor from last item
      nextPageCursor = Buffer.from(`${lastItem.id}${this.CURSOR_SEPARATOR}${lastItem.createdAt?.getTime() || Date.now()}`).toString('base64');
    }

    return {
      currentPage: 1, // Cursor-based doesn't use traditional pages
      totalPages: 1,
      totalItems: data.length,
      itemsPerPage: limit,
      hasNext,
      hasPrevious,
      nextPageCursor
    };
  }

  /**
   * Generate cursor-based pagination links
   */
  static generateCursorLinks(
    req: Request,
    hasNext: boolean,
    nextPageCursor?: string,
    prevPageCursor?: string,
    options: PaginationOptions
  ): Partial<PaginationLinks> {
    const { limit, sortBy, sortOrder, fields } = options;
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;

    const links: Partial<PaginationLinks> = {
      first: `${baseUrl}?limit=${limit}${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`,
      self: baseUrl
    };

    if (hasNext && nextPageCursor) {
      links.next = `${baseUrl}?cursor=${encodeURIComponent(nextPageCursor)}&limit=${limit}${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`;
    }

    if (prevPageCursor) {
      links.prev = `${baseUrl}?cursor=${encodeURIComponent(prevPageCursor)}&limit=${limit}${sortBy ? `&sort=${sortBy}` : ''}${sortOrder ? `&order=${sortOrder}` : ''}${fields?.length ? `&fields=${fields.join(',')}` : ''}`;
    }

    return links;
  }

  /**
   * Apply pagination to a Mongoose query
   */
  static applyMongoosePagination(query: any, options: PaginationOptions) {
    const { page, limit, sortBy, sortOrder } = options;

    // Apply sorting if specified
    if (sortBy) {
      const sortObj: any = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      query.sort(sortObj);
    }

    // Apply pagination
    if (page) {
      const skip = (page - 1) * limit;
      query.skip(skip).limit(limit);
    } else {
      query.limit(limit);
    }

    return query;
  }

  /**
   * Apply field selection to a Mongoose query
   */
  static applyMongooseFields(query: any, fields: string[] = []) {
    if (fields && fields.length > 0) {
      // Create select object from field array
      const selectFields = fields.reduce((acc: any, field) => {
        if (typeof field === 'string') {
          // Handle nested fields (e.g., "profile.name")
          const nestedFields = field.split('.');
          const [lastField, ...prevFields] = nestedFields;

          let current = acc;
          for (const f of prevFields) {
            if (!current[f]) {
              current[f] = 1;
            } else {
              current[f] = {
                ...current[f],
                [lastField]: 1
              };
            }
          }

          current[lastField] = 1;
        }
        return acc;
      }, {});

      query.select(selectFields);
    }

    return query;
  }

  /**
   * Parse GraphQL pagination arguments
   */
  static parseGraphQLPagination(args: any) {
    const {
      first,
      last,
      after,
      before,
      skip,
      take
    } = args;

    const options: PaginationOptions = {};

    // Handle first/last (cursor-based)
    if (first || last || after || before) {
      options.limit = Math.min(Math.max(parseInt(first) || parseInt(take), this.MIN_LIMIT), this.MAX_LIMIT);
      options.cursor = after || before;
    }

    // Handle skip/take (offset-based)
    if (skip !== undefined || take !== undefined) {
      options.limit = Math.min(Math.max(parseInt(skip) || parseInt(take), this.MIN_LIMIT), this.MAX_LIMIT);
      options.page = Math.floor((parseInt(skip) || 0) / (parseInt(take) || this.DEFAULT_LIMIT)) + 1;
    }

    return options;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(options: PaginationOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate limit
    if (options.limit !== undefined) {
      if (typeof options.limit !== 'number' || options.limit < this.MIN_LIMIT || options.limit > this.MAX_LIMIT) {
        errors.push(`Limit must be between ${this.MIN_LIMIT} and ${this.MAX_LIMIT}`);
      }
    }

    // Validate page
    if (options.page !== undefined) {
      if (typeof options.page !== 'number' || options.page < 1) {
        errors.push('Page must be a positive integer');
      }
    }

    // Validate sortBy
    if (options.sortBy !== undefined) {
      if (typeof options.sortBy !== 'string' || options.sortBy.length === 0) {
        errors.push('Sort field must be a non-empty string');
      }
    }

    // Validate sortOrder
    if (options.sortOrder !== undefined) {
      if (!['asc', 'desc'].includes(options.sortOrder)) {
        errors.push('Sort order must be "asc" or "desc"');
      }
    }

    // Validate fields
    if (options.fields !== undefined) {
      if (!Array.isArray(options.fields)) {
        errors.push('Fields must be an array');
      } else if (options.fields.length === 0 || options.fields.length > 10) {
        errors.push('Fields array must contain 1 to 10 items');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create pagination meta for header (JSON:API)
   */
  static createHeaderMeta<T>(result: PaginationResult<T>) {
    return {
      'X-Pagination-Total-Count': result.pagination.totalItems.toString(),
      'X-Pagination-Page-Count': result.pagination.totalPages.toString(),
      'X-Pagination-Current-Page': result.pagination.currentPage.toString(),
      'X-Pagination-Per-Page': result.pagination.itemsPerPage.toString(),
      'X-Pagination-Has-Next': result.pagination.hasNext.toString(),
      'X-Pagination-Has-Prev': result.pagination.hasPrevious.toString(),
    };
  }

  /**
   * Get pagination summary for debugging
   */
  static getPaginationSummary<T>(result: PaginationResult<T>): string {
    const { pagination } = result;
    return `Page ${pagination.currentPage} of ${pagination.totalPages}, showing ${result.data.length} of ${pagination.totalItems} items`;
  }
}

export default PaginationHelper;
export { PaginationOptions, PaginationResult, PaginationLinks };