
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
          category: string;
          totalAmount: number;
          type: string;
          startDate: StartDate;
          installments: number;
          paymentFrequency: string;
          isImportant: boolean;
          dueDate: number;
          created_at?: string;
        };
        Insert: {
          id: string;
          name: string;
          category: string;
          totalAmount: number;
          type: string;
          startDate: StartDate;
          installments: number;
          paymentFrequency: string;
          isImportant: boolean;
          dueDate: number;
        };
        Update: {
          name?: string;
          category?: string;
          totalAmount?: number;
          type?: string;
          startDate?: StartDate;
          installments?: number;
          paymentFrequency?: string;
          isImportant?: boolean;
          dueDate?: number;
        };
      };
      payment_status: {
        Row: {
          expense_id: string;
          date_key: string;
          details: PaymentDetailsDb;
          created_at?: string;
        };
        Insert: {
          expense_id: string;
          date_key: string;
          details: PaymentDetailsDb;
        };
        Update: {
          details?: PaymentDetailsDb;
        };
      };
      categories: {
        Row: {
          name: string;
          created_at?: string;
        };
        Insert: {
          name: string;
        };
        Update: {
          name?: string;
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
export const supabase = isSupabaseConfigured ? createClient<Database>(supabaseUrl!, supabaseAnonKey!) : null;

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