import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fhvdvyvlzempvcqtpqbm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZodmR2eXZsemVtcHZjcXRwcWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1NzYzNzEsImV4cCI6MjA2OTE1MjM3MX0.KWnFlG4B47kH9yBh0RAjbi5qCI9OKSbkNIPAMHpS0VY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDatabase() {
    console.log('='.repeat(80));
    console.log('INSPECTING SUPABASE DATABASE');
    console.log('='.repeat(80));

    try {
        // 1. Check current user session
        console.log('\n1. CURRENT USER SESSION:');
        console.log('-'.repeat(80));
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.log('❌ Error getting session:', sessionError.message);
        } else if (session) {
            console.log('✅ Logged in as:', session.user.email);
            console.log('   User ID:', session.user.id);
        } else {
            console.log('⚠️  No active session (not logged in)');
        }

        // 2. Try to query expenses table
        console.log('\n2. EXPENSES TABLE - Sample Data:');
        console.log('-'.repeat(80));
        const { data: expenses, error: expensesError } = await supabase
            .from('expenses')
            .select('*')
            .limit(3);

        if (expensesError) {
            console.log('❌ Error querying expenses:', expensesError.message);
            console.log('   Code:', expensesError.code);
            console.log('   Details:', expensesError.details);
        } else {
            console.log(`✅ Found ${expenses?.length || 0} expenses (showing first 3)`);
            if (expenses && expenses.length > 0) {
                console.log('\nSample expense structure:');
                const sample = expenses[0];
                Object.keys(sample).forEach(key => {
                    const value = sample[key];
                    const type = typeof value;
                    const preview = type === 'object' ? JSON.stringify(value) : value;
                    console.log(`   ${key}: ${preview} (${type})`);
                });
            }
        }

        // 3. Try to query payment_details table
        console.log('\n3. PAYMENT_DETAILS TABLE - Sample Data:');
        console.log('-'.repeat(80));
        const { data: payments, error: paymentsError } = await supabase
            .from('payment_details')
            .select('*')
            .limit(3);

        if (paymentsError) {
            console.log('❌ Error querying payment_details:', paymentsError.message);
            console.log('   Code:', paymentsError.code);
        } else {
            console.log(`✅ Found ${payments?.length || 0} payment details (showing first 3)`);
            if (payments && payments.length > 0) {
                console.log('\nSample payment_details structure:');
                const sample = payments[0];
                Object.keys(sample).forEach(key => {
                    const value = sample[key];
                    const type = typeof value;
                    const preview = type === 'object' ? JSON.stringify(value) : value;
                    console.log(`   ${key}: ${preview} (${type})`);
                });
            }
        }

        // 4. Try to query categories table
        console.log('\n4. CATEGORIES TABLE - Sample Data:');
        console.log('-'.repeat(80));
        const { data: categories, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .limit(5);

        if (categoriesError) {
            console.log('❌ Error querying categories:', categoriesError.message);
            console.log('   Code:', categoriesError.code);
        } else {
            console.log(`✅ Found ${categories?.length || 0} categories`);
            if (categories && categories.length > 0) {
                console.log('\nSample category structure:');
                const sample = categories[0];
                Object.keys(sample).forEach(key => {
                    const value = sample[key];
                    const type = typeof value;
                    console.log(`   ${key}: ${value} (${type})`);
                });
            }
        }

        // 5. Count records per table
        console.log('\n5. RECORD COUNTS:');
        console.log('-'.repeat(80));

        const { count: expensesCount, error: countError1 } = await supabase
            .from('expenses')
            .select('*', { count: 'exact', head: true });
        console.log(`Expenses: ${countError1 ? '❌ Error' : expensesCount}`);

        const { count: paymentsCount, error: countError2 } = await supabase
            .from('payment_details')
            .select('*', { count: 'exact', head: true });
        console.log(`Payment Details: ${countError2 ? '❌ Error' : paymentsCount}`);

        const { count: categoriesCount, error: countError3 } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true });
        console.log(`Categories: ${countError3 ? '❌ Error' : categoriesCount}`);

        // 6. Check for user_id field issues
        console.log('\n6. USER_ID FIELD ANALYSIS:');
        console.log('-'.repeat(80));

        // Check expenses with NULL user_id
        const { data: nullUserExpenses, error: nullError1 } = await supabase
            .from('expenses')
            .select('id, name, user_id')
            .is('user_id', null)
            .limit(5);

        if (!nullError1) {
            console.log(`Expenses with user_id = NULL: ${nullUserExpenses?.length || 0}`);
            if (nullUserExpenses && nullUserExpenses.length > 0) {
                console.log('  Sample records:');
                nullUserExpenses.forEach(e => {
                    console.log(`    - ${e.name} (id: ${e.id.substring(0, 8)}...)`);
                });
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('INSPECTION COMPLETE');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Unexpected error:', error);
    }
}

inspectDatabase();
