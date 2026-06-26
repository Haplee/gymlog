import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@shared/lib/supabase';
import { devError } from '@shared/lib/devtools';
import type { WearableSyncResult } from '../types';

// Flujo OAuth2 Authorization Code + PKCE contra Fitbit. El intercambio del code
// por tokens y el sync ocurren en la edge function `fitbit-oauth` (el client_secret
// y los tokens nunca tocan el cliente).

const FITBIT_AUTHORIZE = 'https://www.fitbit.com/oauth2/authorize';
const SCOPES = ['activity', 'heartrate', 'sleep', 'profile'];
const STORAGE_VERIFIER = 'fitbit_pkce_verifier';
const STORAGE_STATE = 'fitbit_oauth_state';

const CLIENT_ID = import.meta.env.VITE_FITBIT_CLIENT_ID as string;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** redirect_uri según plataforma; debe estar registrado en la app de Fitbit. */
export function fitbitRedirectUri(): string {
  return isNative()
    ? 'com.franvi.gymlog://fitbit-callback'
    : `${window.location.origin}/auth/fitbit-callback`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr).slice(0, len);
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Inicia el flujo: genera PKCE + state, abre la pantalla de consentimiento Fitbit. */
export async function startFitbitConnect(): Promise<void> {
  if (!CLIENT_ID) throw new Error('VITE_FITBIT_CLIENT_ID no configurado');

  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = randomString(24);
  sessionStorage.setItem(STORAGE_VERIFIER, verifier);
  sessionStorage.setItem(STORAGE_STATE, state);

  const url = new URL(FITBIT_AUTHORIZE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('redirect_uri', fitbitRedirectUri());
  url.searchParams.set('state', state);

  if (isNative()) {
    await Browser.open({ url: url.toString() });
  } else {
    window.location.href = url.toString();
  }
}

/** Completa el intercambio del code (valida state CSRF). Lanza si falla. */
export async function completeFitbitExchange(code: string, state: string): Promise<void> {
  const expectedState = sessionStorage.getItem(STORAGE_STATE);
  const verifier = sessionStorage.getItem(STORAGE_VERIFIER);
  if (!expectedState || state !== expectedState) throw new Error('state_mismatch');
  if (!verifier) throw new Error('missing_verifier');

  const { data, error } = await supabase.functions.invoke('fitbit-oauth', {
    body: {
      action: 'exchange',
      code,
      code_verifier: verifier,
      redirect_uri: fitbitRedirectUri(),
    },
  });
  sessionStorage.removeItem(STORAGE_STATE);
  sessionStorage.removeItem(STORAGE_VERIFIER);
  if (error || (data as { error?: string })?.error) {
    devError('[Fitbit] exchange failed:', error ?? data);
    throw new Error('exchange_failed');
  }
  if (isNative()) await Browser.close().catch(() => {});
}

/** Lanza una sincronización de los últimos `days` días en Fitbit. */
export async function syncFitbit(days = 7): Promise<WearableSyncResult> {
  const { data, error } = await supabase.functions.invoke('fitbit-oauth', {
    body: { action: 'sync', days },
  });
  const payload = data as (WearableSyncResult & { error?: string }) | null;
  if (error || payload?.error) {
    devError('[Fitbit] sync failed:', error ?? payload);
    throw new Error('sync_failed');
  }
  return {
    daily: payload?.daily ?? 0,
    sleep: payload?.sleep ?? 0,
    workouts: payload?.workouts ?? 0,
  };
}

/** Desconecta: borra la fila de conexión (RLS permite al dueño). */
export async function disconnectFitbit(userId: string): Promise<void> {
  const { error } = await supabase
    .from('wearable_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'fitbit');
  if (error) {
    devError('[Fitbit] disconnect failed:', error.message);
    throw new Error('disconnect_failed');
  }
}
