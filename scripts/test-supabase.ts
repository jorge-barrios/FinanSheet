import { testSupabaseConnection } from '../services/supabaseClient';

async function main() {
    try {
        const data = await testSupabaseConnection();
        console.log('Test successful! Retrieved data:', data);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

main();
