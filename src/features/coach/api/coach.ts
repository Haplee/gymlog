import { supabase, SB_URL } from '@shared/lib/supabase';
import { CoachError, type CoachErrorCode, type CoachMode, type CoachOutput } from '../types';
import type { CoachMemoryFact } from '../types';

/**
 * Llama a la Edge Function `ai-coach`.
 *
 * Se usa `fetch` en lugar de `supabase.functions.invoke` porque aquí el código
 * de estado ES la información: 403 (falta consentimiento), 429 (cuota agotada)
 * y 503 (proveedor caído o coach apagado) llevan a mensajes distintos, y
 * `invoke` los aplana en un error genérico.
 */
export async function callCoach(
  mode: CoachMode,
  opts: { message?: string; exerciseName?: string } = {},
): Promise<CoachOutput> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CoachError('unauthorized');

  let res: Response;
  try {
    res = await fetch(`${SB_URL}/functions/v1/ai-coach`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        message: opts.message,
        exercise_name: opts.exerciseName,
      }),
    });
  } catch {
    throw new CoachError('network');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new CoachError((body?.error as CoachErrorCode) ?? 'unknown');
  }

  return (await res.json()) as CoachOutput;
}

/* ------------------------------------------------------------------ */
/* Consentimiento                                                      */
/* ------------------------------------------------------------------ */

/** Versión del texto de consentimiento. Subirla obliga a volver a aceptar. */
export const CONSENT_VERSION = 1;

/** Estado real del consentimiento, leído del servidor (fuente de verdad). */
export async function fetchCoachConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('ai_coach_enabled, ai_coach_consent_version')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return false;
  // Si el texto de consentimiento ha cambiado, el coach queda inactivo hasta
  // que el usuario vuelva a aceptar: no se hereda un "sí" a otra cosa.
  return Boolean(data.ai_coach_enabled) && data.ai_coach_consent_version >= CONSENT_VERSION;
}

export async function grantCoachConsent(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ai_coach_enabled: true,
      ai_coach_consent_at: new Date().toISOString(),
      ai_coach_consent_version: CONSENT_VERSION,
    })
    .eq('id', userId);
  if (error) throw error;

  await supabase
    .from('ai_coach_audit')
    .insert({ user_id: userId, event: 'consent_given', consent_version: CONSENT_VERSION });
}

/**
 * Revocar borra de verdad: memoria, mensajes y sugerencias, en una transacción
 * del servidor. Apagar el flag sin borrar sería mentirle al usuario.
 */
export async function revokeCoachConsent(): Promise<void> {
  const { error } = await supabase.rpc('ai_coach_purge');
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Sugerencias                                                         */
/* ------------------------------------------------------------------ */

/**
 * Marca la decisión del usuario sobre una sugerencia.
 *
 * «Aplicada» significa que el usuario la aceptó y se le llevó a la pantalla
 * donde se hace el cambio — no que la app haya tocado nada por su cuenta. El
 * coach propone; quien edita la rutina es siempre la persona.
 */
export async function markSuggestion(id: string, status: 'applied' | 'dismissed'): Promise<void> {
  const { error } = await supabase.from('ai_coach_suggestions').update({ status }).eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Memoria                                                             */
/* ------------------------------------------------------------------ */

export async function fetchCoachMemory(userId: string): Promise<CoachMemoryFact[]> {
  const { data, error } = await supabase
    .from('ai_coach_memory')
    .select('id, category, fact, confidence, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CoachMemoryFact[];
}

export async function deleteCoachMemoryFact(id: string): Promise<void> {
  const { error } = await supabase.from('ai_coach_memory').delete().eq('id', id);
  if (error) throw error;
}
