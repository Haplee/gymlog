// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  HEALTH_CONSENT_VERSION,
  grantHealthConsent,
  hasHealthConsent,
  healthConsentKey,
  readHealthConsent,
  revokeHealthConsent,
} from '../healthConsent';

const USER = 'user-1';
const OTHER = 'user-2';

beforeEach(() => {
  localStorage.clear();
});

describe('consentimiento de salud', () => {
  it('empieza sin consentimiento', () => {
    expect(readHealthConsent(USER)).toBeNull();
    expect(hasHealthConsent(USER)).toBe(false);
  });

  it('guarda versión e instante, no datos de salud', () => {
    grantHealthConsent(USER, new Date('2026-10-26T09:00:00.000Z'));
    const record = readHealthConsent(USER);

    expect(record).toEqual({
      version: HEALTH_CONSENT_VERSION,
      acceptedAt: '2026-10-26T09:00:00.000Z',
    });
    expect(localStorage.getItem(healthConsentKey(USER))).not.toContain('peso');
    expect(hasHealthConsent(USER)).toBe(true);
  });

  it('separa usuarios en el mismo dispositivo', () => {
    grantHealthConsent(USER);
    expect(hasHealthConsent(USER)).toBe(true);
    expect(hasHealthConsent(OTHER)).toBe(false);
  });

  it('vuelve a pedir si la versión del texto cambia', () => {
    localStorage.setItem(
      healthConsentKey(USER),
      JSON.stringify({
        version: HEALTH_CONSENT_VERSION - 1,
        acceptedAt: '2025-01-01T00:00:00.000Z',
      }),
    );
    expect(readHealthConsent(USER)?.version).toBe(HEALTH_CONSENT_VERSION - 1);
    expect(hasHealthConsent(USER)).toBe(false);
  });

  it('trata un registro corrupto como ausencia de consentimiento', () => {
    localStorage.setItem(healthConsentKey(USER), '{no es json');
    expect(readHealthConsent(USER)).toBeNull();
    expect(hasHealthConsent(USER)).toBe(false);

    localStorage.setItem(healthConsentKey(USER), JSON.stringify({ version: 'uno' }));
    expect(readHealthConsent(USER)).toBeNull();
  });

  it('revoca solo al usuario indicado', () => {
    grantHealthConsent(USER);
    grantHealthConsent(OTHER);
    revokeHealthConsent(USER);

    expect(hasHealthConsent(USER)).toBe(false);
    expect(hasHealthConsent(OTHER)).toBe(true);
  });
});
