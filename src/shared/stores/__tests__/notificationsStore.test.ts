// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  migrateNotifications,
  selectUnreadCount,
  useNotificationsStore,
  type NotificationItem,
} from '../notificationsStore';

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'notification-1',
    title: 'Entreno listo',
    body: 'Tu rutina empieza a las 18:30',
    at: 1_700_000_000_000,
    read: false,
    type: 'routine',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  useNotificationsStore.persist.clearStorage();
  useNotificationsStore.setState({ items: [] });
});

describe('migrateNotifications', () => {
  it('devuelve una lista vacía para estados inválidos', () => {
    expect(migrateNotifications(undefined)).toEqual({ items: [] });
    expect(migrateNotifications({})).toEqual({ items: [] });
    expect(migrateNotifications({ items: 'no-es-una-lista' })).toEqual({ items: [] });
  });

  it('descarta entradas que no son objetos', () => {
    const result = migrateNotifications({ items: [null, 'texto', 42, item()] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('notification-1');
  });

  it('normaliza campos ausentes y conserva los válidos', () => {
    const result = migrateNotifications({
      items: [
        {
          id: 'válido',
          title: 'Récord',
          body: 'Nuevo PR',
          at: 123,
          read: true,
          type: 'pr',
          url: '/stats',
        },
        { title: 'Antiguo' },
      ],
    });

    expect(result.items[0]).toEqual({
      id: 'válido',
      title: 'Récord',
      body: 'Nuevo PR',
      at: 123,
      read: true,
      type: 'pr',
      url: '/stats',
    });
    expect(result.items[1]?.id).toMatch(/^\d+-[a-z0-9]{1,6}$/);
    expect(result.items[1]?.title).toBe('Antiguo');
    expect(result.items[1]?.body).toBe('');
    expect(result.items[1]?.at).toBeGreaterThan(0);
    expect(result.items[1]?.read).toBe(false);
    expect(result.items[1]?.type).toBe('generic');
    expect(result.items[1]?.url).toBeUndefined();
  });

  it('usa generic para categorías desconocidas', () => {
    const result = migrateNotifications({ items: [{ ...item(), type: 'inventada' }] });

    expect(result.items[0]?.type).toBe('generic');
  });

  it('acepta todas las categorías válidas', () => {
    const types = ['routine', 'streak', 'summary', 'pr', 'timer', 'generic'] as const;
    const result = migrateNotifications({
      items: types.map((type, index) => item({ id: String(index), type })),
    });

    expect(result.items.map((entry) => entry.type)).toEqual(types);
  });

  it('conserva como máximo cincuenta entradas', () => {
    const result = migrateNotifications({
      items: Array.from({ length: 70 }, (_, index) => item({ id: String(index) })),
    });

    expect(result.items).toHaveLength(50);
    expect(result.items[0]?.id).toBe('0');
  });
});

describe('notificationsStore', () => {
  it('añade avisos al principio con categoría y enlace opcionales', () => {
    useNotificationsStore.getState().add('Récord', 'Press banca', {
      type: 'pr',
      url: '/stats',
    });

    const [notification] = useNotificationsStore.getState().items;
    expect(notification?.title).toBe('Récord');
    expect(notification?.body).toBe('Press banca');
    expect(notification?.type).toBe('pr');
    expect(notification?.url).toBe('/stats');
    expect(notification?.read).toBe(false);
  });

  it('usa generic cuando no se indica categoría', () => {
    useNotificationsStore.getState().add('Aviso', 'Sin categoría');

    expect(useNotificationsStore.getState().items[0]?.type).toBe('generic');
  });

  it('no conserva más de cincuenta avisos', () => {
    for (let index = 0; index < 55; index += 1) {
      useNotificationsStore.getState().add(`Aviso ${index}`, 'body');
    }

    const items = useNotificationsStore.getState().items;
    expect(items).toHaveLength(50);
    expect(items[0]?.title).toBe('Aviso 54');
    expect(items.at(-1)?.title).toBe('Aviso 5');
  });

  it('marca uno y todos como leídos', () => {
    useNotificationsStore.setState({ items: [item({ id: 'a' }), item({ id: 'b' })] });

    useNotificationsStore.getState().markRead('a');
    expect(useNotificationsStore.getState().items[0]?.read).toBe(true);
    expect(useNotificationsStore.getState().items[1]?.read).toBe(false);

    useNotificationsStore.getState().markAllRead();
    expect(useNotificationsStore.getState().items.every((entry) => entry.read)).toBe(true);
  });

  it('elimina un aviso y puede vaciar todo el historial', () => {
    useNotificationsStore.setState({ items: [item({ id: 'a' }), item({ id: 'b' })] });

    useNotificationsStore.getState().remove('a');
    expect(useNotificationsStore.getState().items.map((entry) => entry.id)).toEqual(['b']);

    useNotificationsStore.getState().clear();
    expect(useNotificationsStore.getState().items).toEqual([]);
  });

  it('cuenta únicamente los avisos no leídos', () => {
    useNotificationsStore.setState({
      items: [item({ id: 'a', read: false }), item({ id: 'b', read: true })],
    });

    expect(selectUnreadCount(useNotificationsStore.getState())).toBe(1);
  });

  it('persiste el historial y lo recupera al rehidratar', async () => {
    useNotificationsStore.getState().add('Persistido', 'body', { type: 'summary' });
    const stored = localStorage.getItem('gymlog-notifications');

    useNotificationsStore.setState({ items: [] });
    localStorage.setItem('gymlog-notifications', stored ?? '{}');
    await useNotificationsStore.persist.rehydrate();

    expect(useNotificationsStore.getState().items[0]?.title).toBe('Persistido');
    expect(useNotificationsStore.getState().items[0]?.type).toBe('summary');
  });
});
