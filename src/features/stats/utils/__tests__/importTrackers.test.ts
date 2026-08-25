import { describe, it, expect } from 'vitest';
import { parseCsv, parseTrackerCsv, TrackerFormatError } from '../importTrackers';
import { parseImportedWorkouts } from '../importSchema';

/* ----------------------------------------------------------------- CSV ---- */

describe('parseCsv', () => {
  it('respeta las comas dentro de un campo entrecomillado', () => {
    const filas = parseCsv('a,b\n"Press banca, agarre cerrado",5');
    expect(filas[1]).toEqual(['Press banca, agarre cerrado', '5']);
  });

  it('entiende las comillas dobladas', () => {
    const filas = parseCsv('a\n"dijo ""vale"" y siguió"');
    expect(filas[1][0]).toBe('dijo "vale" y siguió');
  });

  it('admite saltos de línea dentro de un campo', () => {
    const filas = parseCsv('nota,reps\n"linea1\nlinea2",8');
    expect(filas).toHaveLength(2);
    expect(filas[1][0]).toBe('linea1\nlinea2');
    expect(filas[1][1]).toBe('8');
  });

  it('se come el BOM y los CRLF', () => {
    const filas = parseCsv('﻿Date,Reps\r\n2026-01-01,10\r\n');
    expect(filas[0][0]).toBe('Date');
    expect(filas[1]).toEqual(['2026-01-01', '10']);
  });

  it('descarta las líneas totalmente vacías', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toHaveLength(2);
  });
});

/* ------------------------------------------------------------- ficheros --- */

const STRONG = [
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
  '"2026-08-10 18:30:00",Push A,1h 5m,Bench Press,1,80,8,,,,,8',
  '"2026-08-10 18:30:00",Push A,1h 5m,Bench Press,2,80,7,,,,,9',
  '"2026-08-10 18:30:00",Push A,1h 5m,"Dips, weighted",1,0,12,,,,,',
].join('\n');

const HEVY = [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  'Pull A,2026-08-12T17:00:00Z,2026-08-12T18:00:00Z,,Deadlift,,,0,warmup,60,5,,,',
  'Pull A,2026-08-12T17:00:00Z,2026-08-12T18:00:00Z,,Deadlift,,,1,normal,140,5,,,8',
  'Pull A,2026-08-12T17:00:00Z,2026-08-12T18:00:00Z,,Running,,,0,normal,,,5,1800,',
].join('\n');

const FITNOTES = [
  'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment',
  '2026-08-14,Squat,Legs,225,lbs,5,,,,buena técnica',
  '2026-08-14,Squat,Legs,225,lbs,5,,,,',
  '2026-08-14,Pull Up,Back,0,lbs,10,,,,',
].join('\n');

describe('parseTrackerCsv — Strong', () => {
  const r = parseTrackerCsv(STRONG);

  it('detecta la app', () => {
    expect(r.tracker).toBe('strong');
  });

  it('agrupa las series del día en un entreno', () => {
    expect(r.workouts).toHaveLength(1);
    expect(r.sets).toBe(3);
  });

  it('numera las series por ejercicio', () => {
    const bench = r.workouts[0].sets.filter((s) => s.exercise === 'Bench Press');
    expect(bench.map((s) => s.set_num)).toEqual([1, 2]);
  });

  it('conserva el RPE', () => {
    expect(r.workouts[0].sets[0].rpe).toBe('8');
    expect(r.workouts[0].sets[1].rpe).toBe('9');
  });

  it('no pierde un nombre de ejercicio con coma', () => {
    expect(r.exerciseNames).toContain('Dips, weighted');
  });

  it('mantiene las series a peso corporal en vez de descartarlas', () => {
    const dips = r.workouts[0].sets.find((s) => s.exercise === 'Dips, weighted');
    expect(dips).toBeDefined();
    expect(dips?.weight).toBe(0);
    expect(dips?.reps).toBe(12);
  });
});

describe('parseTrackerCsv — Hevy', () => {
  const r = parseTrackerCsv(HEVY);

  it('detecta la app', () => {
    expect(r.tracker).toBe('hevy');
  });

  it('marca el calentamiento', () => {
    const sets = r.workouts[0].sets;
    expect(sets[0].is_warmup).toBe(true);
    expect(sets[1].is_warmup).toBe(false);
  });

  it('numera desde 1 aunque el fichero cuente desde 0', () => {
    expect(r.workouts[0].sets.map((s) => s.set_num)).toEqual([1, 2]);
  });

  it('cuenta aparte la fila de cardio en vez de colarla con reps 0', () => {
    expect(r.sets).toBe(2);
    expect(r.skippedRows).toBe(1);
    expect(r.exerciseNames).not.toContain('Running');
  });
});

describe('parseTrackerCsv — FitNotes', () => {
  const r = parseTrackerCsv(FITNOTES);

  it('detecta la app', () => {
    expect(r.tracker).toBe('fitnotes');
  });

  it('convierte las libras a kilos', () => {
    // 225 lb = 102.06 kg
    expect(r.workouts[0].sets[0].weight).toBeCloseTo(102.06, 1);
  });

  it('conserva el comentario de la serie', () => {
    expect(r.workouts[0].sets[0].notes).toBe('buena técnica');
  });

  it('importa las dominadas sin lastre', () => {
    const pullUp = r.workouts[0].sets.find((s) => s.exercise === 'Pull Up');
    expect(pullUp?.weight).toBe(0);
    expect(pullUp?.reps).toBe(10);
  });
});

/* -------------------------------------------------------------- errores --- */

describe('parseTrackerCsv — ficheros que no valen', () => {
  it('rechaza un fichero sin cabecera reconocible', () => {
    expect(() => parseTrackerCsv('hola,que,tal\n1,2,3')).toThrow(TrackerFormatError);
  });

  it('rechaza un fichero sin filas de datos', () => {
    expect(() => parseTrackerCsv('Date,Exercise,Reps')).toThrow(TrackerFormatError);
  });

  it('no se traga un CSV con ejercicio pero sin fecha', () => {
    expect(() => parseTrackerCsv('Exercise,Reps\nSquat,5')).toThrow(TrackerFormatError);
  });
});

/* ------------------------------------------------------------- tubería ---- */

describe('encaje con la tubería de importación existente', () => {
  it('la salida la acepta parseImportedWorkouts sin descartar nada', () => {
    for (const csv of [STRONG, HEVY, FITNOTES]) {
      const { workouts } = parseTrackerCsv(csv);
      const parsed = parseImportedWorkouts(workouts);
      expect(parsed.droppedSets).toBe(0);
      expect(parsed.droppedWorkouts).toBe(0);
      expect(parsed.workouts.length).toBe(workouts.length);
    }
  });

  it('agrupa por ejercicio, que es como guarda la RPC', () => {
    const { workouts } = parseTrackerCsv(STRONG);
    const [w] = parseImportedWorkouts(workouts).workouts;
    expect([...w.byExercise.keys()].sort()).toEqual(['Bench Press', 'Dips, weighted']);
    expect(w.byExercise.get('Bench Press')).toHaveLength(2);
  });

  it('la fecha del entreno no se va al día anterior por el huso horario', () => {
    const { workouts } = parseTrackerCsv(FITNOTES);
    const [w] = parseImportedWorkouts(workouts).workouts;
    expect(w.date).toBe('2026-08-14');
  });
});
