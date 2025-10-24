// ============================================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

/**
 * Supabase client configuration
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey?: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
      storage?: Storage;
      storageKey?: string;
    };
    db?: {
      schema?: string;
    };
    realtime?: {
      params?: Record<string, string>;
    };
    global?: {
      headers?: Record<string, string>;
    };
  };
}

/**
 * Default Supabase configuration
 */
const defaultConfig: SupabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  serviceKey: process.env.SUPABASE_SERVICE_KEY,
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'labelmint-auth-token'
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: '10'
      }
    },
    global: {
      headers: {
        'x-application-name': 'labelmint'
      }
    }
  }
};

/**
 * Supabase client wrapper class
 */
export class SupabaseClientWrapper {
  private client: SupabaseClient<Database>;
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig = defaultConfig) {
    this.config = config;
    this.validateConfig();

    this.client = createClient<Database>(
      config.url,
      config.anonKey,
      config.options
    );
  }

  /**
   * Validate Supabase configuration
   */
  private validateConfig(): void {
    if (!this.config.url) {
      throw new Error('Supabase URL is required');
    }
    if (!this.config.anonKey) {
      throw new Error('Supabase anon key is required');
    }
  }

  /**
   * Get the underlying Supabase client
   */
  getClient(): SupabaseClient<Database> {
    return this.client;
  }

  /**
   * Create service role client (for server-side operations)
   */
  static createServiceRoleClient(): SupabaseClient<Database> {
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      throw new Error('Supabase service key is required for service role client');
    }

    return createClient<Database>(
      defaultConfig.url,
      serviceKey,
      {
        ...defaultConfig.options,
        auth: {
          ...defaultConfig.options?.auth,
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    const { data: { user }, error } = await this.client.auth.getUser();
    if (error) {
      throw error;
    }
    return user;
  }

  /**
   * Get current session
   */
  async getCurrentSession() {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) {
      throw error;
    }
    return session;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, options?: {
    emailRedirectTo?: string;
    data?: Record<string, any>;
  }) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options
    });
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'github' | 'discord', options?: {
    redirectTo?: string;
    scopes?: string;
    queryParams?: Record<string, string>;
  }) {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options
    });
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string, redirectTo?: string) {
    const { data, error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo
    });
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Update user
   */
  async updateUser(attributes: {
    email?: string;
    password?: string;
    data?: Record<string, any>;
  }) {
    const { data, error } = await this.client.auth.updateUser(attributes);
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED', session: any) => void) {
    return this.client.auth.onAuthStateChange(callback);
  }

  /**
   * Subscribe to real-time events
   */
  subscribe(channel: string, callback: (payload: any) => void) {
    return this.client.channel(channel).on('postgres_changes', { event: '*', schema: 'public' }, callback).subscribe();
  }

  /**
   * Subscribe to table changes
   */
  subscribeToTable(table: string, callback: (payload: any) => void, filter?: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    schema?: string;
    filter?: string;
  }) {
    return this.client.channel(`table-${table}`).on('postgres_changes', {
      event: filter?.event || '*',
      schema: filter?.schema || 'public',
      table,
      filter: filter?.filter
    }, callback).subscribe();
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel: string) {
    return this.client.removeChannel(channel);
  }

  /**
   * Execute RPC function
   */
  async rpc<T = any>(fnName: string, params?: any): Promise<T> {
    const { data, error } = await this.client.rpc(fnName, params);
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Upload file to storage
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: File | ArrayBuffer | Uint8Array,
    options?: {
      cacheControl?: string;
      contentType?: string;
      upsert?: boolean;
    }
  ) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(path, file, options);

    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Download file from storage
   */
  async downloadFile(bucket: string, path: string) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .download(path);

    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Get public URL for file
   */
  getPublicUrl(bucket: string, path: string) {
    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(bucket: string, paths: string | string[]) {
    const { data, error } = await this.client.storage
      .from(bucket)
      .remove(Array.isArray(paths) ? paths : [paths]);

    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Health check - test connection to Supabase
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('users')
        .select('id')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      url: this.config.url.replace(/\/[^/]*$/, '/***'), // Hide sensitive parts
      hasServiceKey: !!this.config.serviceKey,
      options: this.config.options
    };
  }
}

/**
 * Create default Supabase client
 */
export function createSupabaseClient(config?: SupabaseConfig): SupabaseClientWrapper {
  return new SupabaseClientWrapper(config);
}

/**
 * Default Supabase client instance
 */
export const supabase = createSupabaseClient();

/**
 * Service role Supabase client (for server-side operations)
 */
export const supabaseService = SupabaseClientWrapper.createServiceRoleClient();

export default supabase;