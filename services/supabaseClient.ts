
import { createClient } from '@supabase/supabase-js';

// Define types locally to avoid complex dependencies that can cause TS errors.
// These should mirror the structures in `types.ts` but are self-contained.
export type StartDate = { month: number; year: number };

export type PaymentDetailsDb = {
  paid: boolean;
  paymentDate?: number; // timestamp
  overriddenAmount?: number;
  overriddenDueDate?: number; // Day of month, 1-31
};

export type Database = {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string;
          name: string;
          category: string | null; // Legacy TEXT field (kept for backward compatibility)
          category_id: string; // NEW: UUID reference to categories.id
          total_amount: number;
          amount_in_clp: number;
          type: string;
          start_date: StartDate;
          installments: number;
          payment_frequency: string;
          is_important: boolean;
          due_date: string; // DATE field (YYYY-MM-DD)
          due_date_old_text: number; // Legacy INTEGER field (1-31)
          expense_date: string;
          original_amount: number;
          original_currency: string;
          exchange_rate: number;
          parent_id?: string | null;
          version_date?: string | null;
          end_date?: string | null;
          is_active: boolean;
          user_id: string;
          created_at?: string;
        };
        Insert: {
          name: string;
          category_id: string; // UUID reference to categories
          total_amount: number;
          amount_in_clp: number;
          type: string;
          start_date: StartDate;
          installments: number;
          payment_frequency: string;
          is_important: boolean;
          due_date: string;
          due_date_old_text: number;
          expense_date: string;
          original_amount: number;
          original_currency: string;
          exchange_rate: number;
          parent_id?: string | null;
          version_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          user_id?: string | null; // Optional because trigger sets it
        };
        Update: {
          name?: string;
          category_id?: string;
          total_amount?: number;
          amount_in_clp?: number;
          type?: string;
          start_date?: StartDate;
          installments?: number;
          payment_frequency?: string;
          is_important?: boolean;
          due_date?: string;
          due_date_old_text?: number;
          expense_date?: string;
          original_amount?: number;
          original_currency?: string;
          exchange_rate?: number;
          parent_id?: string | null;
          version_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          user_id?: string | null;
        };
      };
      payment_details: {
        Row: {
          id: string;
          expense_id: string;
          date_key: string;
          paid: boolean;
          payment_date?: string | null;
          overridden_amount?: number | null;
          overridden_due_date?: number | null;
          user_id: string;
          created_at?: string;
        };
        Insert: {
          expense_id: string;
          date_key: string;
          paid: boolean;
          payment_date?: string | null;
          overridden_amount?: number | null;
          overridden_due_date?: number | null;
          user_id?: string | null; // Optional because trigger sets it
        };
        Update: {
          paid?: boolean;
          payment_date?: string | null;
          overridden_amount?: number | null;
          overridden_due_date?: number | null;
          user_id?: string | null;
        };
      };
      categories: {
        Row: {
          id: string; // UUID PRIMARY KEY
          name: string;
          normalized_name?: string | null;
          user_id: string;
          created_at?: string;
        };
        Insert: {
          name: string;
          normalized_name?: string | null;
          user_id?: string | null; // Optional because trigger sets it
        };
        Update: {
          name?: string;
          normalized_name?: string | null;
          user_id?: string | null;
        };
      };
    };
    Views: {
      [key: string]: never;
    };
    Functions: {
      [key: string]: never;
    };
    Enums: {
      [key: string]: never;
    };
    CompositeTypes: {
      [key: string]: never;
    };
  };
};


// These variables should be provided via an environment setup (e.g., .env file)
// and will be picked up by the build process.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Only create a client if the configuration is provided. This prevents the app from
// crashing at startup if environment variables are missing.
export const supabase = isSupabaseConfigured ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
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

// Test function to verify Supabase connection
export async function testSupabaseConnection() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .limit(1);

    if (error) throw error;

    console.log('Supabase connection verified successfully!');
    return data;
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    throw error;
  }
}