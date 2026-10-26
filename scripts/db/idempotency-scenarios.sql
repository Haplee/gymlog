-- Escenarios secuenciales del contrato de idempotencia.
--
-- Se ejecuta después de las migraciones, con un PostgreSQL limpio. Cada bloque
-- comprueba el efecto en las tablas, no solo el valor devuelto: la garantía es
-- que no aparezcan filas de más.

\set ON_ERROR_STOP on

-- Usuarios y catálogo base ------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'b@example.test');

INSERT INTO public.exercises (id, name, muscle_group, user_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Press banca', 'Pecho', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sentadilla', 'Pierna', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Remo privado de B', 'Espalda', '22222222-2222-4222-8222-222222222222'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Dominada pública', 'Espalda', NULL);

-- Clave 1: dos series del mismo ejercicio.
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

DO $test$
DECLARE
  v_id_1 uuid;
  v_id_2 uuid;
BEGIN
  SELECT public.save_workout_with_sets(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '2026-10-01T10:00:00Z',
    '2026-10-01T11:00:00Z',
    '[{"set_num":1,"reps":5,"weight":100},{"set_num":2,"reps":5,"weight":105}]'::jsonb,
    'nota original',
    4,
    'e0000000-0000-4000-8000-000000000001'
  ) INTO v_id_1;

  -- Reintento idéntico: misma clave, misma carga.
  SELECT public.save_workout_with_sets(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '2026-10-01T10:00:00Z',
    '2026-10-01T11:00:00Z',
    '[{"set_num":1,"reps":5,"weight":100},{"set_num":2,"reps":5,"weight":105}]'::jsonb,
    'nota original',
    4,
    'e0000000-0000-4000-8000-000000000001'
  ) INTO v_id_2;

  ASSERT v_id_1 = v_id_2, 'el reintento debe devolver el mismo entreno';
  ASSERT (SELECT count(*) FROM public.workouts) = 1, 'el reintento no puede crear otro entreno';
  ASSERT (SELECT count(*) FROM public.workout_sets) = 2, 'el reintento no puede duplicar series';
  RAISE NOTICE 'OK reintento_idempotente';
END;
$test$;

-- Misma clave, contenido distinto: error explícito y sin escrituras.
DO $test$
BEGIN
  BEGIN
    PERFORM public.save_workout_with_sets(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-10-01T10:00:00Z',
      '2026-10-01T11:00:00Z',
      '[{"set_num":1,"reps":5,"weight":999}]'::jsonb,
      'nota original',
      4,
      'e0000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'se esperaba idempotency_conflict';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'idempotency_conflict', 'mensaje inesperado: ' || SQLERRM;
  END;

  ASSERT (SELECT count(*) FROM public.workouts) = 1, 'el conflicto no puede crear entrenos';
  ASSERT (SELECT count(*) FROM public.workout_sets) = 2, 'el conflicto no puede tocar series';
  RAISE NOTICE 'OK conflicto_misma_clave_otra_carga';
END;
$test$;

-- Clave distinta: operación nueva, sin bloquearse con la anterior.
DO $test$
DECLARE
  v_id uuid;
BEGIN
  SELECT public.save_workout_with_sets(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '2026-10-02T10:00:00Z',
    '2026-10-02T11:00:00Z',
    '[{"set_num":1,"reps":8,"weight":90}]'::jsonb,
    NULL,
    NULL,
    'e0000000-0000-4000-8000-000000000002'
  ) INTO v_id;

  ASSERT v_id IS NOT NULL;
  ASSERT (SELECT count(*) FROM public.workouts) = 2, 'una clave nueva sí crea su entreno';
  RAISE NOTICE 'OK operacion_independiente';
END;
$test$;

-- Importación: un día entero (varios ejercicios) en una sola transacción.
DO $test$
DECLARE
  v_id uuid;
BEGIN
  SELECT public.save_workout_with_sets(
    '11111111-1111-4111-8111-111111111111',
    NULL,
    '2026-10-03',
    NULL,
    '[
      {"exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","set_num":1,"reps":10,"weight":80},
      {"exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","set_num":2,"reps":8,"weight":80},
      {"exercise_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","set_num":1,"reps":6,"weight":0}
    ]'::jsonb,
    NULL,
    NULL,
    'e0000000-0000-4000-8000-000000000003'
  ) INTO v_id;

  ASSERT v_id IS NOT NULL;
  ASSERT (SELECT count(*) FROM public.workout_sets WHERE workout_id = v_id) = 3,
    'las tres series del día deben entrar juntas';
  ASSERT (SELECT count(DISTINCT exercise_id) FROM public.workout_sets WHERE workout_id = v_id) = 2,
    'cada serie conserva su ejercicio';
  ASSERT (SELECT started_at::date FROM public.workouts WHERE id = v_id) = '2026-10-03'::date;

  -- Reintento de la importación completa: no duplica nada.
  PERFORM public.save_workout_with_sets(
    '11111111-1111-4111-8111-111111111111',
    NULL,
    '2026-10-03',
    NULL,
    '[
      {"exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","set_num":1,"reps":10,"weight":80},
      {"exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","set_num":2,"reps":8,"weight":80},
      {"exercise_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","set_num":1,"reps":6,"weight":0}
    ]'::jsonb,
    NULL,
    NULL,
    'e0000000-0000-4000-8000-000000000003'
  );

  ASSERT (SELECT count(*) FROM public.workout_sets WHERE workout_id = v_id) = 3,
    'reintentar el lote no puede duplicar series';
  RAISE NOTICE 'OK importacion_multiejercicio_atomica';
END;
$test$;

-- Propiedad: A no puede escribir como B; B no puede usar ejercicios de A.
DO $test$
BEGIN
  SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

  BEGIN
    PERFORM public.save_workout_with_sets(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-10-04T10:00:00Z',
      NULL,
      '[{"set_num":1,"reps":5,"weight":100}]'::jsonb,
      NULL, NULL,
      'e0000000-0000-4000-8000-000000000004'
    );
    RAISE EXCEPTION 'se esperaba unauthorized';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'unauthorized', 'mensaje inesperado: ' || SQLERRM;
  END;

  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  BEGIN
    PERFORM public.save_workout_with_sets(
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '2026-10-04T10:00:00Z',
      NULL,
      '[{"set_num":1,"reps":5,"weight":100}]'::jsonb,
      NULL, NULL,
      'e0000000-0000-4000-8000-000000000005'
    );
    RAISE EXCEPTION 'se esperaba invalid_exercise';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'invalid_exercise', 'mensaje inesperado: ' || SQLERRM;
  END;

  RAISE NOTICE 'OK propiedad_y_ejercicios';
END;
$test$;

-- Misma clave en otro usuario: cada uno tiene su propio espacio.
DO $test$
DECLARE
  v_id uuid;
BEGIN
  SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
  SELECT public.save_workout_with_sets(
    '22222222-2222-4222-8222-222222222222',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '2026-10-05T10:00:00Z',
    NULL,
    '[{"set_num":1,"reps":5,"weight":50}]'::jsonb,
    NULL, NULL,
    'e0000000-0000-4000-8000-000000000001'
  ) INTO v_id;

  ASSERT v_id IS NOT NULL, 'la misma clave de otro usuario no debe chocar';
  ASSERT (SELECT count(*) FROM public.workouts WHERE user_id = '22222222-2222-4222-8222-222222222222') = 1;
  ASSERT (SELECT count(*) FROM public.workouts WHERE user_id = '11111111-1111-4111-8111-111111111111') = 3,
    'las filas de A no cambian';
  RAISE NOTICE 'OK aislamiento_entre_usuarios';
END;
$test$;

-- Cardio: guardado idempotente ---------------------------------------------
-- La clave identifica la operación; el contenido se compara aparte. Un
-- reintento de la misma operación devuelve la sesión original, no otra.
DO $test$
DECLARE
  v_id_1 uuid;
  v_id_2 uuid;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  SELECT public.save_cardio_session(
    '11111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000001',
    'running',
    '2026-10-20T08:00:00Z',
    1800,
    5.00,
    300,
    '  suave  '
  ) INTO v_id_1;

  SELECT public.save_cardio_session(
    '11111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000001',
    'running',
    '2026-10-20T08:00:00Z',
    1800,
    5.00,
    300,
    'suave'
  ) INTO v_id_2;

  ASSERT v_id_1 = v_id_2, 'el reintento debe devolver la misma sesión de cardio';
  ASSERT (SELECT count(*) FROM public.cardio_sessions) = 1,
    'el reintento no puede crear otra sesión';
  ASSERT (SELECT notes FROM public.cardio_sessions WHERE id = v_id_1) = 'suave',
    'la nota debe guardarse normalizada';
  ASSERT (SELECT client_id IS NOT NULL AND idempotency_hash IS NOT NULL
            FROM public.cardio_sessions WHERE id = v_id_1),
    'la sesión debe conservar su clave y su huella';
  RAISE NOTICE 'OK cardio_idempotente';
END;
$test$;

-- Otra clave, mismo instante y misma carga: dedupe de contenido, no duplicado.
DO $test$
DECLARE
  v_id_1 uuid;
  v_id_2 uuid;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  SELECT id INTO v_id_1
  FROM public.cardio_sessions
  WHERE user_id = '11111111-1111-4111-8111-111111111111'
    AND started_at = '2026-10-20T08:00:00Z'::timestamptz;

  SELECT public.save_cardio_session(
    '11111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000002',
    'running',
    '2026-10-20T08:00:00Z',
    1800,
    5.0,
    300,
    'suave'
  ) INTO v_id_2;

  ASSERT v_id_1 = v_id_2, 'la misma sesión con otra clave debe devolver la existente';
  ASSERT (SELECT count(*) FROM public.cardio_sessions) = 1,
    'el dedupe de contenido no puede duplicar cardio';
  RAISE NOTICE 'OK cardio_dedupe_contenido';
END;
$test$;

-- Misma clave, contenido distinto: conflicto definitivo y sin escrituras.
DO $test$
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  BEGIN
    PERFORM public.save_cardio_session(
      '11111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001',
      'running',
      '2026-10-20T08:00:00Z',
      1801,
      5.00,
      300,
      'suave'
    );
    RAISE EXCEPTION 'se esperaba idempotency_conflict';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'idempotency_conflict', 'mensaje inesperado: ' || SQLERRM;
  END;

  ASSERT (SELECT count(*) FROM public.cardio_sessions) = 1,
    'el conflicto de clave no puede crear sesiones';
  ASSERT (SELECT duration FROM public.cardio_sessions) = 1800,
    'el conflicto no puede modificar la sesión original';
  RAISE NOTICE 'OK cardio_conflicto_misma_clave';
END;
$test$;

-- Clave distinta, mismo instante, contenido distinto: conflicto revisable.
DO $test$
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  BEGIN
    PERFORM public.save_cardio_session(
      '11111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000003',
      'running',
      '2026-10-20T08:00:00Z',
      1801,
      5.00,
      300,
      'suave'
    );
    RAISE EXCEPTION 'se esperaba cardio_content_conflict';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'cardio_content_conflict', 'mensaje inesperado: ' || SQLERRM;
  END;

  ASSERT (SELECT count(*) FROM public.cardio_sessions) = 1,
    'el conflicto de contenido no puede duplicar cardio';
  RAISE NOTICE 'OK cardio_conflicto_contenido';
END;
$test$;

-- Fila anterior a la migración: sin huella. El primer reenvío la adopta.
DO $test$
DECLARE
  v_legacy uuid;
  v_returned uuid;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  INSERT INTO public.cardio_sessions
    (user_id, type, started_at, duration, distance, calories, notes)
  VALUES
    ('11111111-1111-4111-8111-111111111111', 'cycling',
     '2026-10-21T08:00:00Z', 1200, 10.50, 200, 'legacy')
  RETURNING id INTO v_legacy;

  SELECT public.save_cardio_session(
    '11111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000004',
    'cycling',
    '2026-10-21T08:00:00Z',
    1200,
    10.5,
    200,
    'legacy'
  ) INTO v_returned;

  ASSERT v_returned = v_legacy, 'el reenvío debe adoptar la fila anterior, no duplicarla';
  ASSERT (SELECT idempotency_hash IS NOT NULL FROM public.cardio_sessions WHERE id = v_legacy),
    'la fila anterior debe quedar con huella tras el primer reenvío';
  ASSERT (SELECT client_id = 'c0000000-0000-4000-8000-000000000004'
            FROM public.cardio_sessions WHERE id = v_legacy),
    'la fila adoptada debe quedar ligada a la operación para el siguiente reintento';
  ASSERT (SELECT count(*) FROM public.cardio_sessions
           WHERE started_at = '2026-10-21T08:00:00Z'::timestamptz) = 1,
    'la adopción no puede duplicar la sesión anterior';
  RAISE NOTICE 'OK cardio_fila_legacy';
END;
$test$;

-- Fila anterior con contenido distinto: no se adopta a ciegas.
DO $test$
DECLARE
  v_legacy uuid;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  INSERT INTO public.cardio_sessions
    (user_id, type, started_at, duration, distance, calories, notes)
  VALUES
    ('11111111-1111-4111-8111-111111111111', 'rowing',
     '2026-10-21T12:00:00Z', 600, 2.00, 100, 'real')
  RETURNING id INTO v_legacy;

  BEGIN
    PERFORM public.save_cardio_session(
      '11111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000099',
      'rowing',
      '2026-10-21T12:00:00Z',
      900,
      2.00,
      100,
      'real'
    );
    RAISE EXCEPTION 'se esperaba cardio_content_conflict';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'cardio_content_conflict', 'mensaje inesperado: ' || SQLERRM;
  END;

  ASSERT (SELECT duration = 600 AND notes = 'real' AND idempotency_hash IS NULL
            FROM public.cardio_sessions WHERE id = v_legacy),
    'el conflicto no puede modificar ni adoptar la fila anterior';
  ASSERT (SELECT count(*) FROM public.cardio_sessions
           WHERE started_at = '2026-10-21T12:00:00Z'::timestamptz) = 1,
    'el conflicto no puede duplicar la sesión anterior';
  RAISE NOTICE 'OK cardio_legacy_conflicto_contenido';
END;
$test$;

-- Misma clave en otro usuario: espacios separados. A no puede escribir como B.
DO $test$
DECLARE
  v_id uuid;
BEGIN
  SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

  SELECT public.save_cardio_session(
    '22222222-2222-4222-8222-222222222222',
    'c0000000-0000-4000-8000-000000000001',
    'walking',
    '2026-10-22T08:00:00Z',
    600,
    NULL,
    NULL,
    NULL
  ) INTO v_id;

  ASSERT v_id IS NOT NULL, 'la misma clave de otro usuario no debe chocar';
  ASSERT (SELECT count(*) FROM public.cardio_sessions
           WHERE user_id = '22222222-2222-4222-8222-222222222222') = 1;
  ASSERT (SELECT count(*) FROM public.cardio_sessions
           WHERE user_id = '11111111-1111-4111-8111-111111111111') = 3,
    'las sesiones de A no cambian';

  BEGIN
    PERFORM public.save_cardio_session(
      '11111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000005',
      'running',
      '2026-10-23T08:00:00Z',
      600,
      NULL,
      NULL,
      NULL
    );
    RAISE EXCEPTION 'se esperaba unauthorized';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'unauthorized', 'mensaje inesperado: ' || SQLERRM;
  END;

  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
  RAISE NOTICE 'OK cardio_aislamiento_usuarios';
END;
$test$;

-- Importación JSON: un lote completo en una sola transacción ----------------
-- Tres elementos (dos días, dos ejercicios) entran juntos y un reintento de la
-- misma identidad no duplica. Las claves se derivan del id de importación.
DO $test$
DECLARE
  v_import uuid := 'a1000000-0000-4000-8000-000000000001';
  v_payload jsonb := '[
    {"started_at":"2026-11-01T10:00:00Z","finished_at":"2026-11-01T11:00:00Z",
     "exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
     "sets":[{"set_num":1,"reps":10,"weight":80},{"set_num":2,"reps":8,"weight":80}]},
    {"started_at":"2026-11-01T10:00:00Z","finished_at":"2026-11-01T11:00:00Z",
     "exercise_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
     "sets":[{"set_num":1,"reps":6,"weight":0}]},
    {"started_at":"2026-11-02T10:00:00Z","finished_at":"2026-11-02T11:00:00Z",
     "exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
     "sets":[{"set_num":1,"reps":5,"weight":90}]}
  ]'::jsonb;
  v_count integer;
  v_key uuid;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  SELECT public.import_history_workouts(
    '11111111-1111-4111-8111-111111111111', v_import, v_payload
  ) INTO v_count;

  ASSERT v_count = 3, 'deben importarse los tres elementos';
  ASSERT (SELECT count(*) FROM public.workouts
           WHERE started_at::date IN ('2026-11-01', '2026-11-02')) = 3,
    'el lote debe dejar tres entrenos';
  ASSERT (SELECT count(*)
            FROM public.workout_sets s
            JOIN public.workouts w ON w.id = s.workout_id
           WHERE w.started_at::date IN ('2026-11-01', '2026-11-02')) = 4,
    'el lote debe dejar todas las series, sin duplicarlas';

  v_key := public.import_operation_key(
    v_import,
    format(
      'workout:1:%s:%s',
      extract(EPOCH FROM '2026-11-01T10:00:00Z'::timestamptz)::text,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
  );
  ASSERT EXISTS (
    SELECT 1 FROM public.workouts
     WHERE user_id = '11111111-1111-4111-8111-111111111111'
       AND client_id = v_key
  ), 'la clave derivada debe coincidir con la del servidor';

  RAISE NOTICE 'OK json_import_atomica';
END;
$test$;

-- Reintento del mismo lote: misma identidad, cero duplicados.
DO $test$
DECLARE
  v_import uuid := 'a1000000-0000-4000-8000-000000000001';
  v_payload jsonb := '[
    {"started_at":"2026-11-01T10:00:00Z","finished_at":"2026-11-01T11:00:00Z",
     "exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
     "sets":[{"set_num":1,"reps":10,"weight":80},{"set_num":2,"reps":8,"weight":80}]},
    {"started_at":"2026-11-01T10:00:00Z","finished_at":"2026-11-01T11:00:00Z",
     "exercise_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
     "sets":[{"set_num":1,"reps":6,"weight":0}]},
    {"started_at":"2026-11-02T10:00:00Z","finished_at":"2026-11-02T11:00:00Z",
     "exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
     "sets":[{"set_num":1,"reps":5,"weight":90}]}
  ]'::jsonb;
  v_count integer;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  SELECT public.import_history_workouts(
    '11111111-1111-4111-8111-111111111111', v_import, v_payload
  ) INTO v_count;

  ASSERT v_count = 3, 'el reintento debe devolver el mismo número de elementos';
  ASSERT (SELECT count(*) FROM public.workouts
           WHERE started_at::date IN ('2026-11-01', '2026-11-02')) = 3,
    'el reintento no puede crear entrenos';
  ASSERT (SELECT count(*)
            FROM public.workout_sets s
            JOIN public.workouts w ON w.id = s.workout_id
           WHERE w.started_at::date IN ('2026-11-01', '2026-11-02')) = 4,
    'el reintento no puede duplicar series';
  RAISE NOTICE 'OK json_reintento_sin_duplicar';
END;
$test$;

-- Misma identidad y contenido distinto: conflicto y rollback de todo el lote.
DO $test$
DECLARE
  v_import uuid := 'a1000000-0000-4000-8000-000000000001';
  v_before integer;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
  SELECT count(*) INTO v_before FROM public.workouts;

  BEGIN
    PERFORM public.import_history_workouts(
      '11111111-1111-4111-8111-111111111111',
      v_import,
      '[
        {"started_at":"2026-11-03T10:00:00Z",
         "exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
         "sets":[{"set_num":1,"reps":5,"weight":90}]},
        {"started_at":"2026-11-01T10:00:00Z",
         "exercise_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
         "sets":[{"set_num":1,"reps":99,"weight":99}]}
      ]'::jsonb
    );
    RAISE EXCEPTION 'se esperaba idempotency_conflict';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'idempotency_conflict', 'mensaje inesperado: ' || SQLERRM;
  END;

  ASSERT (SELECT count(*) FROM public.workouts) = v_before,
    'el conflicto debe revertir también el elemento válido anterior';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.workouts WHERE started_at::date = '2026-11-03'
  ), 'el elemento válido anterior no puede quedar escrito';
  RAISE NOTICE 'OK json_conflicto_revierte_lote';
END;
$test$;

-- Importación manual nueva del mismo día: identidad nueva, sin colisión.
DO $test$
DECLARE
  v_import uuid := 'a1000000-0000-4000-8000-000000000002';
  v_before integer;
  v_count integer;
  v_key uuid;
  v_old_key uuid;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

  SELECT count(*) INTO v_before FROM public.workouts
   WHERE started_at::date = '2026-11-01';

  SELECT public.import_history_workouts(
    '11111111-1111-4111-8111-111111111111',
    v_import,
    '[
      {"started_at":"2026-11-01T10:00:00Z",
       "exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
       "sets":[{"set_num":1,"reps":10,"weight":80}]}
    ]'::jsonb
  ) INTO v_count;

  v_key := public.import_operation_key(
    v_import,
    format(
      'workout:1:%s:%s',
      extract(EPOCH FROM '2026-11-01T10:00:00Z'::timestamptz)::text,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
  );
  v_old_key := public.import_operation_key(
    'a1000000-0000-4000-8000-000000000001',
    format(
      'workout:1:%s:%s',
      extract(EPOCH FROM '2026-11-01T10:00:00Z'::timestamptz)::text,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )
  );

  ASSERT v_count = 1;
  ASSERT v_key <> v_old_key, 'otra importación no puede reutilizar la clave anterior';
  ASSERT EXISTS (
    SELECT 1 FROM public.workouts
     WHERE user_id = '11111111-1111-4111-8111-111111111111'
       AND client_id = v_key
  ), 'la importación nueva debe tener su propia clave';
  ASSERT (SELECT count(*) FROM public.workouts
           WHERE started_at::date = '2026-11-01') = v_before + 1,
    'una importación nueva sí puede añadir un entreno del mismo día';
  RAISE NOTICE 'OK json_identidad_nueva_mismo_dia';
END;
$test$;

-- Error de validación o de propiedad en mitad del lote: no queda nada escrito.
DO $test$
DECLARE
  v_before integer;
BEGIN
  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
  SELECT count(*) INTO v_before FROM public.workouts;

  BEGIN
    PERFORM public.import_history_workouts(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000003',
      '[
        {"started_at":"2026-11-04T10:00:00Z",
         "exercise_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
         "sets":[{"set_num":1,"reps":5,"weight":80}]},
        {"started_at":"2026-11-04T11:00:00Z",
         "exercise_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
         "sets":[{"set_num":1,"reps":5,"weight":80}]}
      ]'::jsonb
    );
    RAISE EXCEPTION 'se esperaba invalid_exercise';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'invalid_exercise', 'mensaje inesperado: ' || SQLERRM;
  END;

  ASSERT (SELECT count(*) FROM public.workouts) = v_before,
    'el error de validación debe revertir el lote completo';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.workouts WHERE started_at::date = '2026-11-04'
  ), 'el elemento válido anterior no puede quedar escrito';

  BEGIN
    PERFORM public.import_history_workouts(
      '11111111-1111-4111-8111-111111111111',
      NULL,
      '[]'::jsonb
    );
    RAISE EXCEPTION 'se esperaba invalid_import_id';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'invalid_import_id', 'mensaje inesperado: ' || SQLERRM;
  END;

  SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
  BEGIN
    PERFORM public.import_history_workouts(
      '11111111-1111-4111-8111-111111111111',
      'a1000000-0000-4000-8000-000000000004',
      '[]'::jsonb
    );
    RAISE EXCEPTION 'se esperaba unauthorized';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM = 'unauthorized', 'mensaje inesperado: ' || SQLERRM;
  END;

  SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
  RAISE NOTICE 'OK json_validacion_revierte_lote';
END;
$test$;

-- RLS: con el rol de usuario, B solo ve lo suyo.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.workouts TO authenticated;
GRANT SELECT ON public.workout_sets TO authenticated;
GRANT SELECT ON public.cardio_sessions TO authenticated;

SET ROLE authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

DO $test$
BEGIN
  ASSERT (SELECT count(*) FROM public.workouts) = 1, 'RLS debe ocultar los entrenos de A';
  ASSERT (SELECT count(*) FROM public.workouts WHERE user_id = '11111111-1111-4111-8111-111111111111') = 0,
    'RLS no puede dejar leer a A';
  ASSERT (SELECT count(*) FROM public.workout_sets) = 1, 'RLS debe filtrar también las series';
  ASSERT (SELECT count(*) FROM public.cardio_sessions) = 1,
    'RLS debe ocultar las sesiones de cardio de A';
  ASSERT (SELECT count(*) FROM public.cardio_sessions
           WHERE user_id = '11111111-1111-4111-8111-111111111111') = 0,
    'RLS no puede dejar leer el cardio de A';
  RAISE NOTICE 'OK rls_aislamiento';
END;
$test$;

RESET ROLE;
