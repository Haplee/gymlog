/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El aviso de terceros es un documento de distribución, no documentación
 * interna: si desaparece o se queda sin los textos de licencia, la app y el APK
 * distribuyen código MIT/Apache sin su aviso. Este test fija las invariantes que
 * no deben romperse al regenerarlo.
 */
const notices = readFileSync(resolve(process.cwd(), 'public/third-party-notices.txt'), 'utf8');

describe('terceros: avisos de licencia', () => {
  it('incluye el texto completo de MIT y Apache 2.0', () => {
    expect(notices).toContain('Permission is hereby granted, free of charge');
    expect(notices).toContain('Apache License');
    expect(notices).toContain('Version 2.0, January 2004');
  });

  it('atribuye las dependencias clave del runtime', () => {
    for (const name of ['react@', '@supabase/supabase-js@', '@tanstack/react-query@', 'exceljs@']) {
      expect(notices).toContain(name);
    }
  });

  it('deja constancia de la elección MIT para jszip', () => {
    expect(notices).toContain('jszip@');
    expect(notices).toContain('GymLog lo usa bajo MIT');
  });

  it('no oculta el paquete sin licencia declarada', () => {
    expect(notices).toContain('buffers@0.1.1');
    expect(notices).toContain('PAQUETES SIN LICENCIA DECLARADA');
  });

  it('no afirma que se distribuya código AGPL o GPL-only', () => {
    expect(notices).not.toContain('GNU AFFERO');
    expect(notices).not.toMatch(/Paquetes bajo GPL/);
  });

  it('documenta el contenido que no cubre el inventario npm', () => {
    expect(notices).toContain('ExerciseDB');
    expect(notices).toMatch(/SIL Open Font\s+License/);
    expect(notices).toContain('Binarios nativos');
  });

  it('se puede leer desde la app y no tiene caracteres corruptos', () => {
    expect(notices).not.toContain('\uFFFD');
    expect(notices.length).toBeGreaterThan(20_000);
  });
});
