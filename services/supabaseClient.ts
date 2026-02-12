
import { createClient } from '@supabase/supabase-js';

// V2 Database types - minimal type for Supabase client
// Full types are defined in types.v2.ts

// These variables should be provided via an environment setup (e.g., .env file)
// and will be picked up by the build process.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Only create a client if the configuration is provided. This prevents the app from
// crashing at startup if environment variables are missing.
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Fix for HMR/Reload: Only detect session if hash contains token
    // This prevents false "SIGNED_OUT" events when reloading clean URLs
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage
  }
}) : null;

// Debug log for client creation (helps trace HMR issues)
if (isSupabaseConfigured) {
  console.log('[Supabase] 🚀 Client initialized', {
    hasUrl: !!supabaseUrl,
    detectSessionInUrl: typeof window !== 'undefined' && window.location.hash.includes('access_token')
  });
}

// Test function to verify Supabase connection using v2 tables
export async function testSupabaseConnection() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  try {
    const { data, error } = await supabase
      .from('commitments')
      .select('id')
      .limit(1);

    if (error) throw error;

    console.log('Supabase connection verified successfully!');
    return data;
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    throw error;
  }
}