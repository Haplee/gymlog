// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  readSaveScope,
  writeSaveScope,
  clearSaveScope,
  resolveSaveScope,
} from '../saveScopePreference';

describe('resolveSaveScope', () => {
  it('sin series marcadas guarda todo sin preguntar', () => {
    expect(resolveSaveScope({ completedCount: 0, pendingCount: 3, stored: null })).toBe('all');
  });

  it('con todas las series marcadas guarda todo sin preguntar', () => {
    expect(resolveSaveScope({ completedCount: 3, pendingCount: 0, stored: null })).toBe('all');
  });

  it('con mezcla y sin preferencia, pregunta', () => {
    expect(resolveSaveScope({ completedCount: 1, pendingCount: 1, stored: null })).toBe('ask');
  });

  it('con mezcla y preferencia guardada, la aplica sin preguntar', () => {
    expect(resolveSaveScope({ completedCount: 2, pendingCount: 1, stored: 'all' })).toBe('all');
    expect(resolveSaveScope({ completedCount: 2, pendingCount: 1, stored: 'completed-only' })).toBe(
      'completed-only',
    );
  });

  it('la preferencia no fuerza descartar cuando no hay nada pendiente', () => {
    // Con 'completed-only' guardado pero sin series sin marcar, no hay dilema.
    expect(resolveSaveScope({ completedCount: 3, pendingCount: 0, stored: 'completed-only' })).toBe(
      'all',
    );
  });
});

describe('persistencia de la preferencia', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin preferencia guardada devuelve null', () => {
    expect(readSaveScope()).toBeNull();
  });

  it('guarda y recupera la elección', () => {
    writeSaveScope('completed-only');
    expect(readSaveScope()).toBe('completed-only');

    writeSaveScope('all');
    expect(readSaveScope()).toBe('all');
  });

  it('volver a preguntar borra la preferencia', () => {
    writeSaveScope('all');
    clearSaveScope();
    expect(readSaveScope()).toBeNull();
  });

  it('un valor no reconocido se trata como preguntar, no como un alcance', () => {
    localStorage.setItem('gymlog-save-scope', 'sí');
    expect(readSaveScope()).toBeNull();
    expect(resolveSaveScope({ completedCount: 1, pendingCount: 1, stored: readSaveScope() })).toBe(
      'ask',
    );
  });

  it('si localStorage falla se vuelve a preguntar en vez de romper', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('almacenamiento no disponible');
    });
    expect(readSaveScope()).toBeNull();
  });

  it('si no se puede escribir no se lanza el error al usuario', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('lleno');
    });
    expect(() => writeSaveScope('all')).not.toThrow();
  });
});
