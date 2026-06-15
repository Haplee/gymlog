// Edge Function: send-push
// Envía una notificación push remota (FCM HTTP v1) a todos los dispositivos de
// un usuario. Usa service_role para leer push_tokens (bypassa RLS).
//
// Secrets requeridos (supabase secrets set ...):
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (inyectados por la plataforma)
//   - FIREBASE_PROJECT_ID                        (id del proyecto Firebase)
//   - FIREBASE_CLIENT_EMAIL                      (service account)
//   - FIREBASE_PRIVATE_KEY                       (service account, con \n escapados)
//   - SEND_PUSH_SECRET                           (cabecera x-send-secret para autorizar)
//
// Body: { userId: string, title: string, body: string, url?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  url?: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-send-secret',
};

/** Lee una variable de entorno obligatoria o lanza. */
function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Mint a Google OAuth access token for FCM via service account JWT (RS256). */
async function getAccessToken(): Promise<string> {
  const clientEmail = env('FIREBASE_CLIENT_EMAIL');
  const privateKey = env('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token error: ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Autorización por secreto compartido
  if (req.headers.get('x-send-secret') !== env('SEND_PUSH_SECRET')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId, title, body, url } = (await req.json()) as PushPayload;
    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: 'userId, title y body son obligatorios' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);
    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'sin tokens' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken();
    const projectId = env('FIREBASE_PROJECT_ID');
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    const stale: string[] = [];
    for (const { token } of tokens) {
      const fcmRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: url ? { url } : undefined,
            android: { priority: 'high' },
          },
        }),
      });
      if (fcmRes.ok) sent++;
      else if (fcmRes.status === 404 || fcmRes.status === 400) stale.push(token);
    }

    // Limpieza de tokens inválidos/expirados
    if (stale.length > 0) {
      await supabase.from('push_tokens').delete().in('token', stale);
    }

    return new Response(JSON.stringify({ sent, removed: stale.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
