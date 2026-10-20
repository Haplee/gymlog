/**
 * Enlaces compartibles de rutina.
 *
 * El plan **entero viaja dentro del enlace** (JSON comprimido a base64url), no un
 * id que apunte a un servidor. Es una decisión, no una limitación: así compartir
 * una rutina no exige publicarla en ningún sitio, no hay nada que caduque, y el
 * enlace se puede seguir usando con el móvil en modo avión. Lo que viaja es solo
 * el plan —igual que el fichero de `shareRoutine`—: ni pesos levantados ni
 * pesajes.
 *
 * Se usa base64url (sin `+`, `/` ni `=`) porque el valor va en un parámetro de
 * URL: con base64 normal, un `+` se convierte en espacio al pasar por según qué
 * mensajeros y el enlace llega roto.
 */

import { buildSharedRoutine, parseSharedRoutine, type SharedRoutine } from './shareRoutine';
import type { Routine } from '@features/routine/stores/routineStore';

/** Host del enlace con esquema propio: `com.franvi.gymlog://routine?d=…`. */
export const ROUTINE_LINK_HOST = 'routine';

/**
 * Base del enlace web: `https://app.gymlog.dpdns.org/r?d=…`.
 *
 * Se usa `https` (y no solo el esquema propio) porque un `com.franvi.gymlog://`
 * pegado en un chat no es pulsable en la mayoría de mensajeros. El enlace https
 * al menos abre la app web, que sabe importar la rutina igual.
 */
export const ROUTINE_WEB_ORIGIN = 'https://app.gymlog.dpdns.org';
/** Ruta corta del importador web. */
export const ROUTINE_WEB_PATH = '/r';

/** Parámetro donde viaja el plan. */
const PARAM = 'd';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(texto: string): Uint8Array | null {
  try {
    const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    // Un `d` manipulado no es un enlace válido; quien llama decide qué hacer.
    return null;
  }
}

/** El plan de la rutina en un parámetro de URL. */
export function encodeRoutineParam(routine: Routine, now?: Date): string {
  const json = JSON.stringify(buildSharedRoutine(routine, now));
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/**
 * Lee el parámetro y devuelve la rutina compartida, o `null` si no es algo que
 * este GymLog pueda importar. Pasa por `parseSharedRoutine`, así que un enlace
 * manipulado recibe el mismo trato que un fichero manipulado: se recorta y se
 * valida, no se confía en él.
 */
export function decodeRoutineParam(valor: string | null | undefined): SharedRoutine | null {
  if (!valor) return null;
  const bytes = base64UrlToBytes(valor);
  if (!bytes) return null;
  try {
    const json = new TextDecoder().decode(bytes);
    return parseSharedRoutine(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Enlace con esquema propio, el que abre la app instalada. */
export function buildRoutineAppLink(routine: Routine, now?: Date): string {
  return `com.franvi.gymlog://${ROUTINE_LINK_HOST}?${PARAM}=${encodeRoutineParam(routine, now)}`;
}

/** Enlace https, el que se puede pegar en un chat y abrir en cualquier navegador. */
export function buildRoutineWebLink(routine: Routine, now?: Date): string {
  return `${ROUTINE_WEB_ORIGIN}${ROUTINE_WEB_PATH}?${PARAM}=${encodeRoutineParam(routine, now)}`;
}

/** Texto listo para la hoja de compartir: el nombre y un enlace. */
export function buildRoutineShareText(routine: Routine, now?: Date): string {
  return `${routine.name}\n${buildRoutineWebLink(routine, now)}`;
}

/**
 * Saca la rutina de una URL entrante (esquema propio o enlace web).
 *
 * Acepta las dos formas para que el mismo manejador sirva al `appUrlOpen` nativo
 * y a la ruta web `/r`: `com.franvi.gymlog://routine?d=…` y
 * `https://…/r?d=…`. Cualquier otra cosa devuelve `null`.
 */
export function routineFromUrl(url: string): SharedRoutine | null {
  let parseada: URL;
  try {
    parseada = new URL(url);
  } catch {
    return null;
  }

  const esEsquemaPropio = parseada.protocol === 'com.franvi.gymlog:';
  const esRutaWeb = parseada.pathname === ROUTINE_WEB_PATH;

  if (esEsquemaPropio) {
    if (parseada.hostname !== ROUTINE_LINK_HOST) return null;
  } else if (!esRutaWeb) {
    return null;
  }

  return decodeRoutineParam(parseada.searchParams.get(PARAM));
}
