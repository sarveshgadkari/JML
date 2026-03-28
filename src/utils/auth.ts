// Authentication utilities for Judge My Lawyer
// Handles Supabase Auth integration

import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { setAuthToken, clearAuthToken } from './api';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, publicAnonKey);

// =====================================================
// AUTHENTICATION
// =====================================================

export async function signUp(data: {
  email: string;
  password: string;
  name: string;
  phone: string;
  userType: 'lawyer' | 'client';
  // Lawyer-specific fields
  barRegistration?: string;
  specialization?: string[];
  courts?: string[];
  experience?: number;
}) {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          user_type: data.userType,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    // Store auth token
    if (authData.session?.access_token) {
      setAuthToken(authData.session.access_token);
    }

    // Best-effort profile bootstrap so admin checks can work without edge APIs.
    try {
      if (data.userType === 'lawyer') {
        await supabase.from('lawyers').upsert({
          user_id: authData.user.id,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          is_verified: false,
          is_admin: false,
        }, { onConflict: 'email' });
      } else {
        await supabase.from('clients').upsert({
          user_id: authData.user.id,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
        }, { onConflict: 'email' });
      }
    } catch (e) {
      console.warn('Profile bootstrap skipped:', e);
    }

    return { user: authData.user, session: authData.session };
  } catch (error: any) {
    console.error('Signup error:', error);
    throw new Error(error.message || 'Signup failed');
  }
}

export async function signIn(email: string, password: string) {
  try {
    console.log('Attempting sign in for:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.session) throw new Error('Login failed');

    console.log('Sign in successful, storing token');
    
    // Store auth token
    setAuthToken(data.session.access_token);
    
    console.log('Token stored, session user:', data.user?.id);

    return { user: data.user, session: data.session };
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Login failed');
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    clearAuthToken();
  } catch (error: any) {
    console.error('Logout error:', error);
    throw new Error(error.message || 'Logout failed');
  }
}

export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    if (!session) return null;

    // Update stored token
    setAuthToken(session.access_token);

    return session;
  } catch (error: any) {
    console.error('Session error:', error);
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    return user;
  } catch (error: any) {
    console.error('Get user error:', error);
    return null;
  }
}

// =====================================================
// PASSWORD RESET
// =====================================================

export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw new Error(error.message || 'Password reset failed');
  }
}

export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Update password error:', error);
    throw new Error(error.message || 'Password update failed');
  }
}

// =====================================================
// AUTH STATE LISTENER
// =====================================================

export function onAuthStateChange(callback: (session: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    if (session?.access_token) {
      setAuthToken(session.access_token);
    } else {
      clearAuthToken();
    }
    
    callback(session);
  });
}

// =====================================================
// ADMIN CHECK (DIRECT, NO EDGE FUNCTION DEPENDENCY)
// =====================================================
export async function checkCurrentUserAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('lawyers')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return false;
    return !!data?.is_admin;
  } catch {
    return false;
  }
}