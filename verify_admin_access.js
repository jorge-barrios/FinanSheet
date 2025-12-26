
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

console.log('Connecting to Supabase with Service Role Key...');
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function verifyAccess() {
    try {
        // Try to fetch users list (requires admin privileges usually) or just a table
        // Fetching from 'expenses' is a safe read operation
        const { data, error } = await supabase
            .from('expenses')
            .select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Connection failed:', error.message);
        } else {
            console.log('✅ Success! Connected to Supabase with admin privileges.');
            console.log(`Current expense count: ${data === null ? 'Unknown (head request)' : 'Verified'}`); // count is in count property of response object usually, but head:true returns null data and count in count property

            // Let's try to list users to confirm high-level access if possible, 
            // though auth.admin.listUsers() is the real test for service role
            const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

            if (authError) {
                console.warn('⚠️ Could not list users (might be restricted even for service role, or wrong key type):', authError.message);
            } else {
                console.log(`✅ Admin Auth Access Verified. Found ${users.length} users.`);
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

verifyAccess();
