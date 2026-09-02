import { describe, it, expect } from 'vitest';
import { migrateNotifications } from '@shared/stores/notificationsStore';

describe('migrateNotifications', () => {
  it('clasifica como genérico lo guardado antes de existir el campo type', () => {
    // Es el caso real: todo el historial de quien ya usaba la app llega así.
    const antiguo = {
      items: [
        { id: 'a', title: 'Hoy toca entrenar', body: 'Push te espera', at: 1000, read: false },
      ],
    };

    const { items } = migrateNotifications(antiguo);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('generic');
    expect(items[0].url).toBeUndefined();
    // Lo que ya existía no se toca.
    expect(items[0].title).toBe('Hoy toca entrenar');
    expect(items[0].at).toBe(1000);
    expect(items[0].read).toBe(false);
  });

  it('conserva un tipo válido ya guardado', () => {
    const { items } = migrateNotifications({
      items: [{ id: 'a', title: 't', body: 'b', at: 1, read: true, type: 'pr', url: '/stats' }],
    });
    expect(items[0].type).toBe('pr');
    expect(items[0].url).toBe('/stats');
    expect(items[0].read).toBe(true);
  });

  it('degrada a genérico un tipo desconocido en vez de esconder el aviso', () => {
    const { items } = migrateNotifications({
      items: [{ id: 'a', title: 't', body: 'b', at: 1, read: false, type: 'inventado' }],
    });
    expect(items[0].type).toBe('generic');
  });

  it('no explota con un estado vacío, nulo o corrupto', () => {
    expect(migrateNotifications(undefined).items).toEqual([]);
    expect(migrateNotifications({}).items).toEqual([]);
    expect(migrateNotifications({ items: 'no soy un array' }).items).toEqual([]);
    expect(migrateNotifications({ items: [null, 42, 'x'] }).items).toEqual([]);
  });

  it('repara una fecha inválida para que el agrupado por día no se rompa', () => {
    const antes = Date.now();
    const { items } = migrateNotifications({
      items: [{ id: 'a', title: 't', body: 'b', at: 'ayer', read: false }],
    });
    expect(items[0].at).toBeGreaterThanOrEqual(antes);
  });

  it('inventa un id solo si falta, para no romper el key de la lista', () => {
    const { items } = migrateNotifications({ items: [{ title: 't', body: 'b', at: 5 }] });
    expect(typeof items[0].id).toBe('string');
    expect(items[0].id.length).toBeGreaterThan(0);
  });

  it('respeta el tope de 50 items', () => {
    const muchos = Array.from({ length: 80 }, (_, i) => ({
      id: `id-${i}`,
      title: 't',
      body: 'b',
      at: i,
      read: false,
    }));
    expect(migrateNotifications({ items: muchos }).items).toHaveLength(50);
  });

  it('trata read ausente como no leída', () => {
    const { items } = migrateNotifications({ items: [{ id: 'a', title: 't', body: 'b', at: 1 }] });
    expect(items[0].read).toBe(false);
  });
});
