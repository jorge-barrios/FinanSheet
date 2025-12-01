import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fhvdvyvlzempvcqtpqbm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZodmR2eXZsemVtcHZjcXRwcWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1NzYzNzEsImV4cCI6MjA2OTE1MjM3MX0.KWnFlG4B47kH9yBh0RAjbi5qCI9OKSbkNIPAMHpS0VY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runQuery(name, query) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${name}`);
    console.log('='.repeat(80));

    try {
        const { data, error } = await supabase.rpc('exec_sql', { query_text: query });

        if (error) {
            // If RPC doesn't exist, try direct query
            console.log('❌ Error:', error.message);
            console.log('   Note: Some queries may require direct SQL Editor access');
            return null;
        }

        if (data && data.length > 0) {
            console.log(`✅ Found ${data.length} result(s):\n`);
            console.table(data);
            return data;
        } else {
            console.log('✅ Query executed successfully (no results)');
            return [];
        }
    } catch (err) {
        console.log('❌ Exception:', err.message);
        return null;
    }
}

async function analyzeDatabase() {
    console.log('\n' + '█'.repeat(80));
    console.log('COMPLETE DATABASE ANALYSIS FOR MULTI-USER SUPPORT');
    console.log('█'.repeat(80));

    // Since we can't execute arbitrary SQL via RPC without creating the function first,
    // let's use the Supabase client API to gather as much info as possible

    // 1. Test multi-table access
    console.log('\n' + '='.repeat(80));
    console.log('1. TABLE ACCESSIBILITY TEST');
    console.log('='.repeat(80));

    const tables = ['expenses', 'payment_details', 'categories'];
    for (const table of tables) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.log(`❌ ${table}: ${error.message} (Code: ${error.code})`);
            } else {
                console.log(`✅ ${table}: Accessible (${count} records)`);
            }
        } catch (err) {
            console.log(`❌ ${table}: ${err.message}`);
        }
    }

    // 2. Analyze user_id distribution
    console.log('\n' + '='.repeat(80));
    console.log('2. USER_ID DISTRIBUTION ANALYSIS');
    console.log('='.repeat(80));

    for (const table of tables) {
        console.log(`\n📊 ${table.toUpperCase()}:`);
        console.log('-'.repeat(80));

        try {
            // Get all records to analyze user_id locally
            const { data, error } = await supabase
                .from(table)
                .select('user_id');

            if (error) {
                console.log(`   ❌ Error: ${error.message}`);
                continue;
            }

            if (!data || data.length === 0) {
                console.log('   ℹ️  No records found');
                continue;
            }

            // Count by user_id
            const userCounts = {};
            let nullCount = 0;

            data.forEach(row => {
                if (row.user_id === null || row.user_id === undefined) {
                    nullCount++;
                } else {
                    userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1;
                }
            });

            console.log(`   Total records: ${data.length}`);
            console.log(`   Records with NULL user_id: ${nullCount}`);
            console.log(`   Unique users: ${Object.keys(userCounts).length}`);

            if (Object.keys(userCounts).length > 0) {
                console.log('\n   Distribution by user:');
                Object.entries(userCounts).forEach(([userId, count]) => {
                    const shortId = userId.substring(0, 8);
                    console.log(`   - ${shortId}...: ${count} records`);
                });
            }

            if (nullCount > 0) {
                console.log(`\n   ⚠️  WARNING: ${nullCount} records have NULL user_id!`);
                console.log('   These records may not be visible with RLS enabled.');
            }

        } catch (err) {
            console.log(`   ❌ Exception: ${err.message}`);
        }
    }

    // 3. Test insert capability (will fail if RLS blocks it)
    console.log('\n' + '='.repeat(80));
    console.log('3. INSERT TEST (Testing user_id auto-assignment)');
    console.log('='.repeat(80));

    console.log('\n⚠️  Skipping actual insert test to avoid modifying data.');
    console.log('   In production, the trigger should auto-assign user_id on INSERT.');

    // 4. Check for common RLS issues
    console.log('\n' + '='.repeat(80));
    console.log('4. RLS CONFIGURATION CHECK');
    console.log('='.repeat(80));

    console.log('\nChecking if records are accessible without authentication...');

    // Try to access data without session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        console.log('✅ Currently NOT authenticated (testing as anonymous user)');

        // If we can read data without auth, RLS might not be properly configured
        for (const table of tables) {
            const { data, error } = await supabase
                .from(table)
                .select('id')
                .limit(1);

            if (error) {
                if (error.code === 'PGRST301' || error.message.includes('RLS')) {
                    console.log(`✅ ${table}: RLS is enforcing policies (good!)`);
                } else {
                    console.log(`⚠️  ${table}: Error - ${error.message}`);
                }
            } else if (data && data.length > 0) {
                console.log(`⚠️  ${table}: Data accessible without auth! RLS may not be configured.`);
            } else {
                console.log(`ℹ️  ${table}: No data returned (could be empty table or RLS working)`);
            }
        }
    } else {
        console.log(`ℹ️  Currently authenticated as: ${session.user.email}`);
        console.log('   Cannot test anonymous access while logged in.');
    }

    // 5. Check for specific field existence
    console.log('\n' + '='.repeat(80));
    console.log('5. FIELD STRUCTURE VERIFICATION');
    console.log('='.repeat(80));

    const expectedFields = {
        expenses: ['id', 'name', 'category', 'total_amount', 'amount_in_clp', 'type',
                   'start_date', 'installments', 'payment_frequency', 'is_important',
                   'due_date', 'due_date_old_text', 'expense_date', 'original_amount',
                   'original_currency', 'exchange_rate', 'parent_id', 'version_date',
                   'end_date', 'is_active', 'user_id', 'created_at'],
        payment_details: ['id', 'expense_id', 'date_key', 'paid', 'payment_date',
                          'overridden_amount', 'overridden_due_date', 'user_id', 'created_at'],
        categories: ['name', 'created_at', 'normalized_name', 'user_id']
    };

    for (const [table, fields] of Object.entries(expectedFields)) {
        console.log(`\n📋 ${table.toUpperCase()}:`);
        console.log('-'.repeat(80));

        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .limit(1);

            if (error) {
                console.log(`   ❌ Cannot verify fields: ${error.message}`);
                continue;
            }

            if (!data || data.length === 0) {
                console.log('   ℹ️  Table is empty, cannot verify field structure');
                continue;
            }

            const actualFields = Object.keys(data[0]);
            const missingFields = fields.filter(f => !actualFields.includes(f));
            const extraFields = actualFields.filter(f => !fields.includes(f));

            console.log(`   Expected fields: ${fields.length}`);
            console.log(`   Actual fields: ${actualFields.length}`);

            if (missingFields.length > 0) {
                console.log(`   ⚠️  Missing fields: ${missingFields.join(', ')}`);
            }

            if (extraFields.length > 0) {
                console.log(`   ℹ️  Extra fields: ${extraFields.join(', ')}`);
            }

            if (missingFields.length === 0 && extraFields.length === 0) {
                console.log('   ✅ All expected fields present and no extras!');
            }

            // Check if user_id exists
            if (actualFields.includes('user_id')) {
                console.log('   ✅ user_id field exists');
            } else {
                console.log('   ❌ user_id field is MISSING!');
            }

        } catch (err) {
            console.log(`   ❌ Exception: ${err.message}`);
        }
    }

    // 6. Summary and recommendations
    console.log('\n' + '█'.repeat(80));
    console.log('ANALYSIS COMPLETE - SUMMARY');
    console.log('█'.repeat(80));

    console.log('\n📌 KEY FINDINGS:');
    console.log('   Run this script to see:');
    console.log('   - Table accessibility status');
    console.log('   - User ID distribution across all tables');
    console.log('   - RLS configuration effectiveness');
    console.log('   - Field structure verification');

    console.log('\n📝 NEXT STEPS:');
    console.log('   1. Review any warnings or errors above');
    console.log('   2. Check for NULL user_id records');
    console.log('   3. Verify RLS policies are properly configured');
    console.log('   4. Ensure triggers are working for auto-assignment');

    console.log('\n' + '█'.repeat(80));
}

analyzeDatabase().catch(console.error);
