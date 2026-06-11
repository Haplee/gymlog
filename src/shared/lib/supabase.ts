import { createClient } from '@supabase/supabase-js';
import { devWarn } from '@shared/lib/devtools';

export const SB_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SB_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

if (!SB_URL || !SB_KEY) {
  devWarn('[GymLog] Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_KEY');
}

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'gymlog-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
  },
});
