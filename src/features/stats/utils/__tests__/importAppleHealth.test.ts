import { describe, it, expect, vi } from 'vitest';
import {
  parseAppleHealthExport,
  extraerPesosDeFragmento,
  fechaLocalDe,
  AppleHealthFormatError,
} from '../importAppleHealth';

/** Un `<Record>` de peso como los que escribe Salud. */
const registroPeso = (fecha: string, valor: string, unidad = 'kg') =>
  `<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Báscula de Paco" ` +
  `sourceVersion="1.0" unit="${unidad}" creationDate="${fecha}" startDate="${fecha}" ` +
  `endDate="${fecha}" value="${valor}"/>`;

/** Ruido: los miles de registros que no son peso y hay que ignorar. */
const registroPasos = (fecha: string) =>
  `<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" ` +
  `creationDate="${fecha}" startDate="${fecha}" endDate="${fecha}" value="1234"/>`;

const envolver = (cuerpo: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<HealthData locale="es_ES">\n${cuerpo}\n</HealthData>`;

/** Blob con el tamaño y el slice() reales que usa el lector. */
const comoFichero = (texto: string) => new Blob([texto], { type: 'application/xml' });

describe('fechaLocalDe', () => {
  it('se queda con el día local, no con el UTC', () => {
    // 00:30 en España (+0200) es el día anterior en UTC. Debe ganar el local.
    expect(fechaLocalDe('2026-08-25 00:30:00 +0200')).toBe('2026-08-25');
  });

  it('devuelve null si no hay fecha reconocible', () => {
    expect(fechaLocalDe('ayer por la tarde')).toBeNull();
  });
});

describe('extraerPesosDeFragmento', () => {
  it('ignora los registros que no son de peso', () => {
    const { pesos } = extraerPesosDeFragmento(
      registroPasos('2026-08-01 10:00:00 +0200') + registroPeso('2026-08-01 08:00:00 +0200', '80'),
    );
    expect(pesos).toEqual([{ date: '2026-08-01', weightKg: 80 }]);
  });

  it('convierte libras a kilos', () => {
    const { pesos } = extraerPesosDeFragmento(
      registroPeso('2026-08-01 08:00:00 +0200', '180', 'lb'),
    );
    expect(pesos[0].weightKg).toBeCloseTo(81.65, 1);
  });

  it('convierte stones', () => {
    const { pesos } = extraerPesosDeFragmento(
      registroPeso('2026-08-01 08:00:00 +0200', '12', 'st'),
    );
    expect(pesos[0].weightKg).toBeCloseTo(76.2, 1);
  });

  it('descarta lo que no puede ser un peso humano', () => {
    const { pesos, descartados } = extraerPesosDeFragmento(
      registroPeso('2026-08-01 08:00:00 +0200', '0.5') +
        registroPeso('2026-08-02 08:00:00 +0200', '900'),
    );
    expect(pesos).toHaveLength(0);
    expect(descartados).toBe(2);
  });

  it('lee los atributos por nombre, no por posición', () => {
    const desordenado =
      `<Record value="77.5" unit="kg" startDate="2026-08-03 07:00:00 +0200" ` +
      `type="HKQuantityTypeIdentifierBodyMass"/>`;
    const { pesos } = extraerPesosDeFragmento(desordenado);
    expect(pesos).toEqual([{ date: '2026-08-03', weightKg: 77.5 }]);
  });
});

describe('parseAppleHealthExport', () => {
  it('deja un peso por día, el último del día', async () => {
    const xml = envolver(
      [
        registroPeso('2026-08-01 07:00:00 +0200', '80'),
        registroPeso('2026-08-01 21:00:00 +0200', '81.2'),
        registroPeso('2026-08-02 07:00:00 +0200', '80.5'),
      ].join('\n'),
    );
    const r = await parseAppleHealthExport(comoFichero(xml));
    expect(r.weights).toEqual([
      { date: '2026-08-01', weightKg: 81.2 },
      { date: '2026-08-02', weightKg: 80.5 },
    ]);
  });

  it('devuelve los días ordenados de antiguo a nuevo', async () => {
    const xml = envolver(
      [
        registroPeso('2026-08-10 07:00:00 +0200', '79'),
        registroPeso('2026-08-01 07:00:00 +0200', '80'),
        registroPeso('2026-08-05 07:00:00 +0200', '79.5'),
      ].join('\n'),
    );
    const r = await parseAppleHealthExport(comoFichero(xml));
    expect(r.weights.map((w) => w.date)).toEqual(['2026-08-01', '2026-08-05', '2026-08-10']);
  });

  it('no pierde ni duplica registros al partir el fichero en trozos', async () => {
    // 3.000 días de peso: obliga a varias pasadas del lector por trozos y pone
    // registros justo en las fronteras, que es donde un lector ingenuo falla.
    const dias = Array.from({ length: 3000 }, (_, i) => {
      const d = new Date(Date.UTC(2018, 0, 1) + i * 86400000);
      const fecha = d.toISOString().slice(0, 10) + ' 07:00:00 +0200';
      return registroPeso(fecha, String(70 + (i % 100) / 10));
    });
    const xml = envolver(dias.join('\n'));
    expect(xml.length).toBeGreaterThan(600_000);

    const r = await parseAppleHealthExport(comoFichero(xml));
    expect(r.weights).toHaveLength(3000);
    // Si el solape releyera registros, este contador saldría inflado.
    expect(r.registrosLeidos).toBe(3000);
    expect(r.descartados).toBe(0);
  });

  it('informa del avance para poder mover una barra', async () => {
    const xml = envolver(registroPeso('2026-08-01 07:00:00 +0200', '80'));
    const avances: number[] = [];
    await parseAppleHealthExport(comoFichero(xml), (f) => avances.push(f));
    expect(avances.length).toBeGreaterThan(0);
    expect(avances[avances.length - 1]).toBe(1);
  });

  it('un export sin registros de peso no es un error, es cero pesos', async () => {
    const xml = envolver(registroPasos('2026-08-01 10:00:00 +0200'));
    const r = await parseAppleHealthExport(comoFichero(xml));
    expect(r.weights).toHaveLength(0);
  });

  it('rechaza un fichero que no es de Apple Health', async () => {
    await expect(parseAppleHealthExport(comoFichero('hola, soy un csv\n1,2,3'))).rejects.toThrow(
      AppleHealthFormatError,
    );
  });

  it('no se traga el fichero entero de golpe', async () => {
    const xml = envolver(registroPeso('2026-08-01 07:00:00 +0200', '80'));
    const blob = comoFichero(xml);
    const sliceSpy = vi.spyOn(blob, 'slice');
    await parseAppleHealthExport(blob);
    // Lee por trozos: si alguien cambiara esto por un readAsText del fichero
    // completo, un export real de cientos de megas tumbaría la pestaña.
    expect(sliceSpy).toHaveBeenCalled();
  });
});
