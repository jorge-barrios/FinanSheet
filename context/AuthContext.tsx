import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Check if supabase is configured
    if (!supabase) {
      console.warn('Supabase not configured. Authentication disabled.');
      setLoading(false);
      return;
    }

    console.log('[AuthContext] 🔄 Initializing auth listener...');

    // Check for auth code in URL (Google OAuth redirect)
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('code');
    const hasAuthCode = !!authCode;

    // Listen for auth changes
    // onAuthStateChange fires immediately with the current session (INITIAL_SESSION)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthContext] 🔐 Auth event: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id
      });

      setSession(session);
      setUser(session?.user ?? null);

      // LOGIC: If we found an auth code in URL but no session yet, 
      // keep loading true until the manual exchange finishes or fails.
      // This prevents "Login" screen flash while processing the redirect.
      if (hasAuthCode && !session && event !== 'SIGNED_OUT') {
        console.log('[AuthContext] ⏳ Keeping loading state active while exchanging code...');
      } else {
        setLoading(false);
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
    });

    // Manually handle OAuth Code Exchange (Option B)
    // This ensures reliable login even if the auto-detect fails
    if (hasAuthCode) {
      console.log('[AuthContext] 🔄 Detected OAuth code in URL, attempting manual exchange...');
      supabase.auth.exchangeCodeForSession(authCode).then(({ data, error }) => {
        if (error) {
          console.error('[AuthContext] ❌ Error exchanging code for session:', error);
          // If exchange failed, stop loading so user sees login screen (and error potentially)
          setLoading(false);
        } else if (data.session) {
          console.log('[AuthContext] ✅ OAuth session established successfully from code');
          // Clean URL (remove ?code=... from address bar) without reload
          window.history.replaceState({}, document.title, window.location.pathname);
          // Note: onAuthStateChange will have fired with SIGNED_IN event, setting loading=false
        }
      });
    }

    return () => {
      console.log('[AuthContext] 🧹 Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') as AuthError };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') as AuthError };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') as AuthError };
    }

    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') as AuthError };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') as AuthError };
    }

    console.log('[Auth] Google Sign In - Redirecting to:', window.location.origin);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured') as AuthError };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      setIsPasswordRecovery(false);
    }
    return { error };
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const value = {
    user,
    session,
    loading,
    isPasswordRecovery,
    signUp,
    signIn,
    signOut,
    resetPassword,
    signInWithGoogle,
    updatePassword,
    clearPasswordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
