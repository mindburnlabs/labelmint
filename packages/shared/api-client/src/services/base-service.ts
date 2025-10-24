/**
 * Base API Service
 * Provides common CRUD operations and utilities for all services
 */

import { ApiClient } from '../client';
import { ApiResponse } from '../types';

export abstract class BaseService {
  protected client: ApiClient;
  protected basePath: string;

  constructor(client: ApiClient, basePath: string) {
    this.client = client;
    this.basePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  }

  /**
   * Find multiple resources with optional filtering
   */
  async find<T>(filters?: Record<string, any>): Promise<ApiResponse<T[]>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const url = params.toString() ? `${this.basePath}?${params}` : this.basePath;
    return this.client.get<T[]>(url);
  }

  /**
   * Find a single resource by ID
   */
  async findById<T>(id: string): Promise<ApiResponse<T>> {
    return this.client.get<T>(`${this.basePath}/${id}`);
  }

  /**
   * Create a new resource
   */
  async create<T>(data: any): Promise<ApiResponse<T>> {
    return this.client.post<T>(this.basePath, data);
  }

  /**
   * Update an existing resource
   */
  async update<T>(id: string, data: any): Promise<ApiResponse<T>> {
    return this.client.put<T>(`${this.basePath}/${id}`, data);
  }

  /**
   * Partially update a resource
   */
  async patch<T>(id: string, data: any): Promise<ApiResponse<T>> {
    return this.client.patch<T>(`${this.basePath}/${id}`, data);
  }

  /**
   * Delete a resource
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Perform a custom action on a resource
   */
  async action<T>(id: string, action: string, data?: any): Promise<ApiResponse<T>> {
    return this.client.post<T>(`${this.basePath}/${id}/${action}`, data);
  }

  /**
   * Get service health status
   */
  async health(): Promise<ApiResponse<{ status: string }>> {
    return this.client.get<{ status: string }>(`${this.basePath}/health`);
  }
}