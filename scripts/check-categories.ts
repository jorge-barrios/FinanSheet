import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  // Check categories_v2 structure
  const { data: categories } = await supabase
    .from('categories_v2')
    .select('id, name, base_category_key, is_global')
    .limit(10);
  
  console.log('=== Categories in DB ===');
  console.log(JSON.stringify(categories, null, 2));

  // Check a commitment with its category
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, name, category:categories_v2(id, name, base_category_key)')
    .limit(3);
  
  console.log('\n=== Commitments with categories ===');
  console.log(JSON.stringify(commitments, null, 2));
}

main();
