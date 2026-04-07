import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://eoltmipoklizewxdpzfa.supabase.co';
const SB_KEY = 'sb_publishable_C5dKsRG9DOpZjC5XihhsEA_P0rV4i93';

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'gymlog-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
  },
});
