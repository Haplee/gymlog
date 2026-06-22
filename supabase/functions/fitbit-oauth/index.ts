// Edge Function: fitbit-oauth
// Puente seguro con la Fitbit Web API. El cliente NUNCA ve client_secret ni el
// refresh token. Tres acciones (campo `action` del body):
//   - exchange : intercambia el authorization code (PKCE) por tokens y los guarda en Vault.
//   - refresh  : refresca el access token (Fitbit expira a las 8h) y rota en Vault.
//   - sync     : lee datos de Fitbit (actividad, HR, sueño, workouts) y los upserta.
//
// Autenticación: el cliente llama con su JWT de usuario en Authorization. Verificamos
// el usuario con ese JWT y escribimos los datos como ESE usuario (RLS aplica). Los
// tokens (Vault) se manejan con la service_role (wearable_store_tokens / _get_tokens).
//
// Secrets requeridos (supabase secrets set ...):
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY  (inyectados)
//   - FITBIT_CLIENT_ID
//   - FITBIT_CLIENT_SECRET

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PROVIDER = 'fitbit';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const FITBIT_API = 'https://api.fitbit.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

interface FitbitTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  user_id: string;
}

/** Authorization: Basic base64(client_id:client_secret) para el token endpoint. */
function basicAuthHeader(): string {
  const id = env('FITBIT_CLIENT_ID');
  const secret = env('FITBIT_CLIENT_SECRET');
  return 'Basic ' + btoa(`${id}:${secret}`);
}

async function fitbitTokenRequest(params: Record<string, string>): Promise<FitbitTokens> {
  const res = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Fitbit token error: ${JSON.stringify(data)}`);
  }
  return data as FitbitTokens;
}

function expiresAtIso(expiresIn: number): string {
  // Margen de 60s para evitar usar un token a punto de caducar.
  return new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
}

/** Mapea el nombre de actividad Fitbit al enum CardioType del proyecto. */
function mapCardioType(name: string | undefined): string {
  const n = (name || '').toLowerCase();
  if (n.includes('run')) return 'running';
  if (n.includes('bike') || n.includes('cycl') || n.includes('spinning')) return 'cycling';
  if (n.includes('row')) return 'rowing';
  if (n.includes('swim')) return 'swimming';
  if (n.includes('elliptical')) return 'elliptical';
  if (n.includes('walk') || n.includes('hike')) return 'walking';
  if (n.includes('jump') || n.includes('rope')) return 'jump_rope';
  return 'other';
}

function lastNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Devuelve un access token válido, refrescando y rotando en Vault si caducó. */
async function getValidAccessToken(admin: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await admin.rpc('wearable_get_tokens', {
    p_user_id: userId,
    p_provider: PROVIDER,
  });
  if (error) throw new Error(`wearable_get_tokens: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.access_token) throw new Error('no_connection');

  const expired = !row.access_expires_at || new Date(row.access_expires_at).getTime() < Date.now();
  if (!expired) return row.access_token as string;

  // Refrescar
  const refreshed = await fitbitTokenRequest({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token as string,
  });
  const { error: storeErr } = await admin.rpc('wearable_store_tokens', {
    p_user_id: userId,
    p_provider: PROVIDER,
    p_access: refreshed.access_token,
    p_refresh: refreshed.refresh_token ?? row.refresh_token,
    p_expires_at: expiresAtIso(refreshed.expires_in),
    p_scopes: (refreshed.scope || '').split(' ').filter(Boolean),
    p_fitbit_user_id: refreshed.user_id ?? row.fitbit_user_id,
  });
  if (storeErr) throw new Error(`wearable_store_tokens(refresh): ${storeErr.message}`);
  return refreshed.access_token;
}

async function fitbitGet(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${FITBIT_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': 'es_ES' },
  });
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(`Fitbit GET ${path} -> ${res.status}`);
  return res.json();
}

// ---- Acciones --------------------------------------------------------------

async function doExchange(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, string>,
): Promise<Response> {
  const { code, code_verifier, redirect_uri } = body;
  if (!code || !code_verifier || !redirect_uri) {
    return json({ error: 'code, code_verifier y redirect_uri son obligatorios' }, 400);
  }
  const tokens = await fitbitTokenRequest({
    grant_type: 'authorization_code',
    code,
    code_verifier,
    redirect_uri,
  });
  const { error } = await admin.rpc('wearable_store_tokens', {
    p_user_id: userId,
    p_provider: PROVIDER,
    p_access: tokens.access_token,
    p_refresh: tokens.refresh_token,
    p_expires_at: expiresAtIso(tokens.expires_in),
    p_scopes: (tokens.scope || '').split(' ').filter(Boolean),
    p_fitbit_user_id: tokens.user_id,
  });
  if (error) return json({ error: `store: ${error.message}` }, 500);
  return json({ ok: true, scopes: (tokens.scope || '').split(' ').filter(Boolean) });
}

async function doSync(
  admin: SupabaseClient,
  user: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 30);
  const accessToken = await getValidAccessToken(admin, userId);

  const dailyRows: Record<string, unknown>[] = [];
  const sleepRows: Record<string, unknown>[] = [];

  for (const date of lastNDates(days)) {
    // Actividad diaria
    try {
      const act = (await fitbitGet(`/1/user/-/activities/date/${date}.json`, accessToken)) as {
        summary?: {
          steps?: number;
          caloriesOut?: number;
          distances?: { activity: string; distance: number }[];
        };
      };
      const total = act.summary?.distances?.find((d) => d.activity === 'total')?.distance;
      // HR de reposo
      let restingHr: number | undefined;
      try {
        const hr = (await fitbitGet(
          `/1/user/-/activities/heart/date/${date}/1d.json`,
          accessToken,
        )) as { 'activities-heart'?: { value?: { restingHeartRate?: number } }[] };
        restingHr = hr['activities-heart']?.[0]?.value?.restingHeartRate;
      } catch {
        /* HR opcional */
      }

      if (act.summary) {
        dailyRows.push({
          date,
          source: PROVIDER,
          steps: act.summary.steps ?? null,
          distance_km: total ?? null,
          calories: act.summary.caloriesOut ?? null,
          resting_hr: restingHr ?? null,
        });
      }
    } catch (e) {
      if (String(e).includes('rate_limited')) return json({ error: 'rate_limited' }, 429);
    }

    // Sueño
    try {
      const sleep = (await fitbitGet(`/1.2/user/-/sleep/date/${date}.json`, accessToken)) as {
        summary?: {
          totalMinutesAsleep?: number;
          stages?: { deep?: number; light?: number; rem?: number; wake?: number };
        };
      };
      const s = sleep.summary;
      if (s && (s.totalMinutesAsleep || s.stages)) {
        sleepRows.push({
          date,
          source: PROVIDER,
          duration_min: s.totalMinutesAsleep ?? null,
          deep_min: s.stages?.deep ?? null,
          light_min: s.stages?.light ?? null,
          rem_min: s.stages?.rem ?? null,
          awake_min: s.stages?.wake ?? null,
        });
      }
    } catch {
      /* sueño opcional */
    }
  }

  // Workouts recientes
  const workoutRows: Record<string, unknown>[] = [];
  try {
    const afterDate = lastNDates(days)[days - 1];
    const list = (await fitbitGet(
      `/1/user/-/activities/list.json?afterDate=${afterDate}&sort=asc&limit=50&offset=0`,
      accessToken,
    )) as {
      activities?: {
        logId: number;
        activityName?: string;
        startTime: string;
        duration?: number; // ms
        distance?: number; // km
        calories?: number;
        averageHeartRate?: number;
      }[];
    };
    for (const a of list.activities ?? []) {
      workoutRows.push({
        external_id: `fitbit:${a.logId}`,
        source: PROVIDER,
        type: mapCardioType(a.activityName),
        started_at: a.startTime,
        duration: a.duration ? Math.round(a.duration / 1000) : 0,
        distance: a.distance ?? null,
        calories: a.calories ?? null,
        avg_hr: a.averageHeartRate ?? null,
      });
    }
  } catch {
    /* workouts opcional */
  }

  // Upsert como el usuario (RLS aplica; auth.uid() = userId)
  const result = { daily: 0, sleep: 0, workouts: 0 };
  if (dailyRows.length) {
    const { data, error } = await user.rpc('upsert_wearable_daily', {
      p_user_id: userId,
      p_rows: dailyRows,
    });
    if (error) return json({ error: `upsert_daily: ${error.message}` }, 500);
    result.daily = (data as number) ?? dailyRows.length;
  }
  if (sleepRows.length) {
    const { data, error } = await user.rpc('upsert_wearable_sleep', {
      p_user_id: userId,
      p_rows: sleepRows,
    });
    if (error) return json({ error: `upsert_sleep: ${error.message}` }, 500);
    result.sleep = (data as number) ?? sleepRows.length;
  }
  if (workoutRows.length) {
    const { data, error } = await user.rpc('import_wearable_workouts', {
      p_user_id: userId,
      p_rows: workoutRows,
    });
    if (error) return json({ error: `import_workouts: ${error.message}` }, 500);
    result.workouts = (data as number) ?? workoutRows.length;
  }

  // Marca last_sync_at
  await user
    .from('wearable_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('provider', PROVIDER);

  return json({ ok: true, ...result });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const url = env('SUPABASE_URL');
    // Cliente como el usuario (verifica JWT + escribe con RLS)
    const userClient = createClient(url, env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    // Cliente service_role (Vault)
    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? '');

    switch (action) {
      case 'exchange':
        return await doExchange(admin, userId, body as Record<string, string>);
      case 'sync':
        return await doSync(admin, userClient, userId, body);
      case 'refresh': {
        // Fuerza refresh; útil para diagnóstico.
        await getValidAccessToken(admin, userId);
        return json({ ok: true });
      }
      default:
        return json({ error: 'action inválida (exchange|sync|refresh)' }, 400);
    }
  } catch (e) {
    const msg = String(e);
    const status = msg.includes('rate_limited') ? 429 : msg.includes('no_connection') ? 404 : 500;
    return json({ error: msg }, status);
  }
});
