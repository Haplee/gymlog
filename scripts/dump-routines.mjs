import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const userId = process.env.GYMLOG_USER_ID || '690a78f5-8888-4996-bc67-f21dd5b85f6f';

const supabase = createClient(supabaseUrl, supabaseKey);

async function dump() {
  const { data, error } = await supabase
    .from('user_routines')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

dump();
