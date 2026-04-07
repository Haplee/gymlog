import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoltmipoklizewxdpzfa.supabase.co';
const SB_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_C5dKsRG9DOpZjC5XihhsEA_P0rV4i93';

export const supabase = createClient(SB_URL, SB_KEY);
