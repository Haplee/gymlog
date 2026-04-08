import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SB_KEY = import.meta.env.VITE_SUPABASE_KEY as string;

if (!SB_URL || !SB_KEY) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY en las variables de entorno');
}

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'gymlog-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
  },
});
