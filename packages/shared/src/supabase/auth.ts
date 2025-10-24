// ============================================================================
// SUPABASE AUTH HELPERS
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { TelegramWebAppData } from '../types/auth';

export interface AuthUser {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  email?: string;
  role: 'admin' | 'project_manager' | 'labeler' | 'quality_controller' | 'client';
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  is_verified: boolean;
  verification_level: number;
  avatar_url?: string;
  bio?: string;
  rating?: number;
  total_earnings: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

/**
 * Auth helper class for Supabase authentication
 */
export class SupabaseAuthHelper {
  private client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /**
   * Sign in with Telegram Web App data
   */
  async signInWithTelegram(telegramData: TelegramWebAppData): Promise<AuthSession> {
    if (!telegramData.user) {
      throw new Error('Invalid Telegram data: user not found');
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await this.client
      .from('users')
      .select('*')
      .eq('telegram_id', telegramData.user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let user: AuthUser;

    if (existingUser) {
      // Update last login
      const { data: updatedUser } = await this.client
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', existingUser.id)
        .select()
        .single();

      user = updatedUser as AuthUser;
    } else {
      // Create new user
      const { data: newUser } = await this.client
        .from('users')
        .insert({
          telegram_id: telegramData.user.id,
          first_name: telegramData.user.first_name,
          last_name: telegramData.user.last_name,
          username: telegramData.user.username,
          language_code: telegramData.user.language_code,
          is_verified: false,
          verification_level: 0,
          role: 'labeler',
          status: 'active',
          total_earnings: 0,
          completed_tasks: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      user = newUser as AuthUser;
    }

    // Create session (this would normally use proper JWT tokens)
    const session: AuthSession = {
      access_token: `telegram_${user.id}_${Date.now()}`,
      refresh_token: `refresh_${user.id}_${Date.now()}`,
      expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      user
    };

    // Store session in database
    await this.client.from('user_sessions').insert({
      user_id: user.id,
      telegram_id: user.telegram_id,
      refresh_token: session.refresh_token,
      access_token: session.access_token,
      expires_at: new Date(session.expires_at).toISOString(),
      last_activity: new Date().toISOString(),
      is_active: true
    });

    return session;
  }

  /**
   * Sign out user
   */
  async signOut(userId?: string): Promise<void> {
    if (!userId) {
      const currentUser = await this.getCurrentUser();
      userId = currentUser?.id;
    }

    if (userId) {
      // Deactivate sessions
      await this.client
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId);
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    // This would normally validate the JWT token
    // For now, we'll return null
    return null;
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<AuthSession | null> {
    // This would normally validate the JWT token
    // For now, we'll return null
    return null;
  }

  /**
   * Validate session token
   */
  async validateSessionToken(token: string): Promise<AuthSession | null> {
    const { data: session, error } = await this.client
      .from('user_sessions')
      .select(`
        *,
        users:user_id (*)
      `)
      .eq('access_token', token)
      .eq('is_active', true)
      .single();

    if (error || !session || !session.users) {
      return null;
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Deactivate expired session
      await this.client
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', session.id);
      return null;
    }

    // Update last activity
    await this.client
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', session.id);

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: new Date(session.expires_at).getTime(),
      user: session.users as AuthUser
    };
  }

  /**
   * Refresh session token
   */
  async refreshSession(refreshToken: string): Promise<AuthSession | null> {
    const { data: session, error } = await this.client
      .from('user_sessions')
      .select(`
        *,
        users:user_id (*)
      `)
      .eq('refresh_token', refreshToken)
      .eq('is_active', true)
      .single();

    if (error || !session || !session.users) {
      return null;
    }

    // Generate new tokens
    const newAccessToken = `refreshed_${session.user_id}_${Date.now()}`;
    const newRefreshToken = `refresh_${session.user_id}_${Date.now()}`;
    const newExpiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

    // Update session with new tokens
    const { data: updatedSession } = await this.client
      .from('user_sessions')
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: newExpiresAt.toISOString(),
        last_activity: new Date().toISOString()
      })
      .eq('id', session.id)
      .select(`
        *,
        users:user_id (*)
      `)
      .single();

    if (!updatedSession || !updatedSession.users) {
      return null;
    }

    return {
      access_token: updatedSession.access_token,
      refresh_token: updatedSession.refresh_token,
      expires_at: new Date(updatedSession.expires_at).getTime(),
      user: updatedSession.users as AuthUser
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<Omit<AuthUser, 'id' | 'telegram_id' | 'created_at' | 'updated_at'>>): Promise<AuthUser> {
    const { data, error } = await this.client
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as AuthUser;
  }

  /**
   * Check if user has specific role
   */
  async hasRole(userId: string, role: AuthUser['role']): Promise<boolean> {
    const { data, error } = await this.client
      .from('users')
      .select('role')
      .eq('id', userId)
      .eq('role', role)
      .single();

    return !error && !!data;
  }

  /**
   * Check if user is project member
   */
  async isProjectMember(userId: string, projectId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('project_members')
      .select('id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('status', 'active')
      .single();

    return !error && !!data;
  }

  /**
   * Get user's projects
   */
  async getUserProjects(userId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('project_members')
      .select(`
        project_id,
        role,
        projects:project_id (*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Get user's assigned tasks
   */
  async getUserTasks(userId: string, status?: string): Promise<any[]> {
    let query = this.client
      .from('tasks')
      .select(`
        *,
        projects:project_id (name, status)
      `)
      .eq('assigned_to', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(userId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Get user's wallet balance
   */
  async getUserWalletBalance(userId: string): Promise<Record<string, number>> {
    const { data, error } = await this.client
      .from('user_wallets')
      .select('currency, balance')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const balances: Record<string, number> = {};
    for (const wallet of data || []) {
      balances[wallet.currency] = wallet.balance;
    }

    return balances;
  }
}

/**
 * Create auth helper
 */
export function createAuthHelper(client: SupabaseClient<Database>): SupabaseAuthHelper {
  return new SupabaseAuthHelper(client);
}