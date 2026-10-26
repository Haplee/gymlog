// Edge Function: delete-account
//
// Borra la cuenta del usuario que llama. No acepta un `userId` en el cuerpo a
// propósito: el identificador sale siempre del JWT verificado, así que nadie
// puede borrar la cuenta de otra persona enviando su id.
//
// Qué hace, en orden:
//   1. Verifica el JWT con `auth.getUser`.
//   2. Borra los objetos del bucket `avatars` que cuelgan de `{userId}/`. El
//      borrado de `auth.users` no toca Storage: sin esto quedaría la foto
//      pública de una cuenta que ya no existe.
//   3. `admin.deleteUser`, que arrastra por `ON DELETE CASCADE` todas las
//      tablas de usuario (entrenos, medidas, salud, wearables, entrenador…).
//
// Secretos: los inyecta la plataforma (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_ANON_KEY). No hay ninguno propio.
//
// DESPLIEGUE: no se ha desplegado. Ver README.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // El token se valida contra Auth, no se decodifica a mano: firma, caducidad y
  // usuario existente los comprueba el servidor.
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

  const userId = userData.user.id;

  try {
    // Best-effort: si el listado falla, la cuenta se borra igual. Un avatar
    // huérfano es un problema menor que impedir el ejercicio del derecho.
    try {
      const { data: files } = await admin.storage.from('avatars').list(userId, { limit: 100 });
      if (files && files.length > 0) {
        await admin.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (storageError) {
      console.error(
        JSON.stringify({
          fn: 'delete-account',
          event: 'storage_cleanup_failed',
          userId,
          storageError: String(storageError),
        }),
      );
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      // `deleteUser` sobre un id inexistente devuelve error. Si el usuario ya
      // no está, el resultado que pidió el cliente es el mismo: su cuenta no
      // existe. Se responde 200 para que un reintento tras una respuesta
      // perdida no muestre un fallo que no lo es.
      const missing = /not found|does not exist/i.test(deleteError.message);
      if (!missing) {
        console.error(
          JSON.stringify({
            fn: 'delete-account',
            event: 'delete_failed',
            userId,
            message: deleteError.message,
          }),
        );
        return json({ error: 'delete_failed' }, 500);
      }
    }

    // Log de auditoría de una operación correcta, no un fallo: va por `log` a
    // propósito, igual que en `ai-coach`. Solo el id, sin correo ni nombre.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ fn: 'delete-account', event: 'deleted', userId }));
    return json({ deleted: true });
  } catch (e) {
    console.error(JSON.stringify({ fn: 'delete-account', event: 'unhandled', message: String(e) }));
    return json({ error: 'internal_error' }, 500);
  }
});
