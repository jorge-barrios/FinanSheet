import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function verifySchema() {
    console.log('='.repeat(80));
    console.log('VERIFYING V2 SCHEMA');
    console.log('='.repeat(80));

    const expectedTables = [
        'profiles',
        'categories_v2',
        'commitments',
        'terms',
        'payments',
        'exchange_rates'
    ];

    console.log('\n1. CHECKING TABLES:');
    console.log('-'.repeat(80));

    for (const table of expectedTables) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.log(`❌ ${table}: NOT FOUND (${error.message})`);
            } else {
                console.log(`✅ ${table}: EXISTS`);
            }
        } catch (err) {
            console.log(`❌ ${table}: ERROR (${err.message})`);
        }
    }

    console.log('\n2. CHECKING RLS POLICIES:');
    console.log('-'.repeat(80));
    console.log('ℹ️  RLS verification requires checking pg_policies table');
    console.log('   Run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log('   SELECT schemaname, tablename, policyname');
    console.log('   FROM pg_policies');
    console.log('   WHERE tablename IN (\'profiles\', \'categories_v2\', \'commitments\', \'terms\', \'payments\', \'exchange_rates\');');
    console.log('');

    console.log('\n3. CHECKING FUNCTIONS:');
    console.log('-'.repeat(80));
    console.log('ℹ️  Function verification requires checking pg_proc table');
    console.log('   Expected functions:');
    console.log('   - update_updated_at_column()');
    console.log('   - normalize_category_name()');
    console.log('   - calculate_amount_in_base()');
    console.log('   - get_active_term()');
    console.log('   - get_exchange_rate()');
    console.log('');

    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(80));
    console.log('\n💡 For full verification, use Supabase SQL Editor');
}

verifySchema();
