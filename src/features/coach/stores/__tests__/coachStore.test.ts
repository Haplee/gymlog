import { beforeEach, describe, it, expect, vi } from 'vitest';

// El consentimiento es el interruptor que decide si datos de salud salen del
// dispositivo. Lo que se fija aquí es que ese interruptor no se pueda encender
// por accidente y que apagarlo borre de verdad.

const fetchCoachConsent = vi.fn(async (_userId: string) => false);
const grantCoachConsent = vi.fn(async (_userId: string) => {});
const revokeCoachConsent = vi.fn(async () => {});

vi.mock('../../api/coach', () => ({
  fetchCoachConsent: (userId: string) => fetchCoachConsent(userId),
  grantCoachConsent: (userId: string) => grantCoachConsent(userId),
  revokeCoachConsent: () => revokeCoachConsent(),
}));

const { useCoachStore } = await import('../coachStore');

beforeEach(() => {
  vi.clearAllMocks();
  useCoachStore.setState({ enabled: false, syncing: false });
});

describe('coachStore', () => {
  it('arranca apagado: nada sale del dispositivo sin que el usuario lo encienda', () => {
    expect(useCoachStore.getState().enabled).toBe(false);
  });

  it('el servidor gana al espejo local', async () => {
    // El usuario revocó el consentimiento desde otro dispositivo: aunque el
    // valor persistido diga que sí, al sincronizar debe quedar apagado.
    useCoachStore.setState({ enabled: true });
    fetchCoachConsent.mockResolvedValueOnce(false);

    await useCoachStore.getState().sync('u1');

    expect(fetchCoachConsent).toHaveBeenCalledWith('u1');
    expect(useCoachStore.getState().enabled).toBe(false);
  });

  it('si no se puede confirmar el consentimiento, se apaga', async () => {
    useCoachStore.setState({ enabled: true });
    fetchCoachConsent.mockRejectedValueOnce(new Error('sin red'));

    await useCoachStore.getState().sync('u1');

    // Ante la duda no se manda nada: el fallo cierra, no abre.
    expect(useCoachStore.getState().enabled).toBe(false);
    expect(useCoachStore.getState().syncing).toBe(false);
  });

  it('encender pasa siempre por registrar el consentimiento', async () => {
    await useCoachStore.getState().enable('u1');

    expect(grantCoachConsent).toHaveBeenCalledWith('u1');
    expect(useCoachStore.getState().enabled).toBe(true);
  });

  it('si el consentimiento no se puede registrar, el coach no se enciende', async () => {
    grantCoachConsent.mockRejectedValueOnce(new Error('fallo de red'));

    await expect(useCoachStore.getState().enable('u1')).rejects.toThrow();
    expect(useCoachStore.getState().enabled).toBe(false);
  });

  it('apagar dispara la purga en el servidor, no solo el flag local', async () => {
    useCoachStore.setState({ enabled: true });

    await useCoachStore.getState().disable();

    expect(revokeCoachConsent).toHaveBeenCalled();
    expect(useCoachStore.getState().enabled).toBe(false);
  });

  it('si la purga falla, el coach sigue encendido: apagarlo sin borrar seria mentir', async () => {
    useCoachStore.setState({ enabled: true });
    revokeCoachConsent.mockRejectedValueOnce(new Error('fallo de red'));

    await expect(useCoachStore.getState().disable()).rejects.toThrow();
    expect(useCoachStore.getState().enabled).toBe(true);
  });
});
