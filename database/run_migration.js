import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fhvdvyvlzempvcqtpqbm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZodmR2eXZsemVtcHZjcXRwcWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1NzYzNzEsImV4cCI6MjA2OTE1MjM3MX0.KWnFlG4B47kH9yBh0RAjbi5qCI9OKSbkNIPAMHpS0VY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runMigration() {
    try {
        console.log('Reading migration file...');
        const migrationPath = join(__dirname, 'migration_add_expense_linking.sql');
        const sql = readFileSync(migrationPath, 'utf8');

        console.log('Running migration...');
        console.log('SQL:', sql);

        // Split by semicolon and run each statement separately
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement.toLowerCase().includes('comment on')) {
                console.log('Skipping COMMENT statement (not supported via anon key):', statement.substring(0, 50) + '...');
                continue;
            }

            console.log('\nExecuting statement:', statement.substring(0, 100) + '...');

            const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

            if (error) {
                // Try alternative method using supabase.from() for simple queries
                console.log('RPC method failed, error:', error.message);

                // For ALTER TABLE and CREATE INDEX, we need service role key or direct database access
                console.warn('This statement requires database admin access. Please run manually in Supabase SQL Editor.');
                console.log('Statement:', statement);
                continue;
            }

            console.log('Success!');
        }

        console.log('\n✅ Migration completed!');
        console.log('\nNote: If any statements failed, please run them manually in the Supabase SQL Editor:');
        console.log('https://supabase.com/dashboard/project/fhvdvyvlzempvcqtpqbm/sql');

    } catch (error) {
        console.error('❌ Error running migration:', error);
        console.log('\nPlease run the migration manually in Supabase SQL Editor:');
        console.log('https://supabase.com/dashboard/project/fhvdvyvlzempvcqtpqbm/sql');
        console.log('\nCopy the contents of database/migration_add_expense_linking.sql');
    }
}

runMigration();
