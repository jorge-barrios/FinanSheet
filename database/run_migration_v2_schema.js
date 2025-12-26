import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Missing VITE_SUPABASE_URL or SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runMigration() {
    console.log('='.repeat(80));
    console.log('RUNNING FINANSHEET V2 SCHEMA MIGRATION');
    console.log('='.repeat(80));

    try {
        // Read the SQL file
        const sqlPath = path.resolve(__dirname, 'migration_v2_schema.sql');
        console.log(`\n📄 Reading SQL from: ${sqlPath}`);

        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL file not found: ${sqlPath}`);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`✅ SQL file loaded (${sql.length} characters)\n`);

        // Split SQL into individual statements (simple split by semicolon)
        // Note: This is a simple approach. For complex SQL, consider using a proper parser
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

        // Execute each statement
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const preview = statement.substring(0, 100).replace(/\n/g, ' ');

            console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

            try {
                const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

                if (error) {
                    // Try direct execution if RPC fails
                    const { error: directError } = await supabase
                        .from('_temp')
                        .select('*')
                        .limit(0); // This is a hack; Supabase JS doesn't support raw SQL easily

                    // For now, we'll use a different approach
                    throw new Error(`Statement failed: ${error.message}`);
                }

                successCount++;
                console.log(`   ✅ Success`);
            } catch (err) {
                errorCount++;
                console.error(`   ❌ Error: ${err.message}`);
                // Continue with other statements
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('MIGRATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        console.log('='.repeat(80));

        if (errorCount > 0) {
            console.log('\n⚠️  Some statements failed. Please review errors above.');
            console.log('💡 Tip: Execute migration_v2_schema.sql directly in Supabase SQL Editor for better error messages.');
        } else {
            console.log('\n🎉 Migration completed successfully!');
        }

    } catch (error) {
        console.error('\n❌ Unexpected error:', error);
        process.exit(1);
    }
}

console.log('⚠️  IMPORTANT: This script has limitations with complex SQL.');
console.log('📝 RECOMMENDED APPROACH:');
console.log('   1. Open Supabase Dashboard → SQL Editor');
console.log('   2. Copy content from database/migration_v2_schema.sql');
console.log('   3. Paste and run in SQL Editor');
console.log('');
console.log('Do you want to continue with automatic execution? (This may have errors)');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

// Wait 5 seconds before proceeding
setTimeout(() => {
    runMigration();
}, 5000);
