/**
 * Consentimiento para el tratamiento de datos de salud.
 *
 * Peso, grasa corporal, medidas, frecuencia cardiaca, sueño y sesiones
 * importadas de Health Connect o Salud son datos de la categoría especial del
 * art. 9 RGPD. El permiso del sistema operativo no es consentimiento del RGPD:
 * autoriza a la app a *leer* del agregador, pero no dice nada sobre la base
 * jurídica para tratarlos ni sobre su finalidad. Son dos cosas distintas y
 * hasta ahora solo existía la primera.
 *
 * Qué guarda: la versión del texto aceptado y el instante. Nada más — ni el
 * texto, ni el identificador del dispositivo. Vive en `localStorage` porque es
 * una prueba local de la aceptación, no un dato de la cuenta: si el usuario
 * borra los datos del navegador, se le vuelve a preguntar, que es el lado
 * seguro del error.
 *
 * Qué NO es: no sustituye al consentimiento del entrenador (que se gestiona en
 * el servidor, en `profiles.ai_coach_consent_at`) ni al permiso del sistema.
 * Son tres consentimientos distintos para tres tratamientos distintos.
 */

export const HEALTH_CONSENT_VERSION = 1;

const KEY_PREFIX = 'gymlog-health-consent-v1:';

export interface HealthConsentRecord {
  version: number;
  acceptedAt: string;
}

export function healthConsentKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Navegación privada en algunos navegadores lanza al tocar `localStorage`.
    return null;
  }
}

/** Registro guardado, o `null` si no hay o está corrupto. */
export function readHealthConsent(userId: string): HealthConsentRecord | null {
  const raw = storage()?.getItem(healthConsentKey(userId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { version, acceptedAt } = parsed as Partial<HealthConsentRecord>;
    if (typeof version !== 'number' || typeof acceptedAt !== 'string') return null;
    return { version, acceptedAt };
  } catch {
    return null;
  }
}

/**
 * Solo vale la versión vigente. Si el texto cambia de forma sustancial se sube
 * `HEALTH_CONSENT_VERSION` y se vuelve a pedir: un consentimiento para un texto
 * que ya no existe no es consentimiento.
 */
export function hasHealthConsent(userId: string): boolean {
  return readHealthConsent(userId)?.version === HEALTH_CONSENT_VERSION;
}

export function grantHealthConsent(userId: string, now: Date = new Date()): void {
  const record: HealthConsentRecord = {
    version: HEALTH_CONSENT_VERSION,
    acceptedAt: now.toISOString(),
  };
  storage()?.setItem(healthConsentKey(userId), JSON.stringify(record));
}

export function revokeHealthConsent(userId: string): void {
  storage()?.removeItem(healthConsentKey(userId));
}
