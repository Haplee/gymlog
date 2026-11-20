-- ============================================================
-- AMPLIACIÓN DEL CATÁLOGO PÚBLICO: 129 EJERCICIOS ADICIONALES
-- ------------------------------------------------------------
-- Incluye:
--   1. Extensiones unaccent + pg_trgm
--   2. Función public.f_unaccent IMMUTABLE PARALLEL SAFE STRICT
--   3. Columna aliases text[] NOT NULL DEFAULT '{}'
--   4. Columna generada search_text + índice GIN gin_trgm_ops
--   5. Ampliación CHECK equipment con valores granulares
--   6. 129 ejercicios públicos nuevos con aliases técnicos
--   7. Backfill exercise_muscles
--   8. Actualización get_exercises_with_usage (incluye aliases)
--   9. Sincronización is_bodyweight / load_type
--   10. NOTIFY pgrst, 'reload schema'
-- Idempotente: WHERE NOT EXISTS (lower(public.f_unaccent(name))) + ON CONFLICT
-- ============================================================

SET local check_function_bodies = off;

-- ============================================================
-- 1) EXTENSIONES Y FUNCIÓN DE NORMALIZACIÓN
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Función IMMUTABLE PARALLEL SAFE STRICT para uso en índices/columnas generadas
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1);
$$;

COMMENT ON FUNCTION public.f_unaccent(text) IS
  'Wrapper inmutable de unaccent para uso en índices y columnas generadas.';

-- ============================================================
-- 2) COLUMNA ALIASES EN PUBLIC.EXERCISES
-- ============================================================
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.exercises.aliases IS
  'Nombres alternativos, sinónimos y variantes ortográficas para búsqueda fuzzy.';

-- ============================================================
-- 3) COLUMNA GENERADA SEARCH_TEXT + ÍNDICE GIN TRGM
-- ============================================================
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    lower(public.f_unaccent(coalesce(name, '') || ' ' || coalesce(array_to_string(aliases, ' '), '')))
  ) STORED;

CREATE INDEX IF NOT EXISTS exercises_search_text_gin
  ON public.exercises USING gin (search_text gin_trgm_ops);

-- ============================================================
-- 4) AMPLIACIÓN CHECK EQUIPMENT (valores granulares)
-- ============================================================
-- Eliminar constraint existente y recrear con valores extendidos
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_equipment_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_equipment_check
  CHECK (equipment IN (
    'Barra','Mancuernas','Máquina','Polea','Peso corporal','Bandas','Kettlebell',
    'Máquina Smith','Anillas / TRX','Landmine','Balón medicinal','Trineo',
    'Cajón pliométrico','Vallas','Comba','Cuerdas','Otro'
  ));

-- ============================================================
-- 5) ACTUALIZACIÓN RPC GET_EXERCISES_WITH_USAGE (incluye aliases)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_exercises_with_usage(uuid);
CREATE FUNCTION public.get_exercises_with_usage(p_user_id uuid)
 RETURNS TABLE(
   id uuid,
   name text,
   muscle_group text,
   user_id uuid,
   created_at timestamp with time zone,
   usage_count bigint,
   is_bodyweight boolean,
   load_type text,
   equipment text,
   description text,
   media_url text,
   movement text,
   muscle_detail text,
   is_bilateral boolean,
   is_compound boolean,
   is_public boolean,
   aliases text[]
 )
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    e.id,
    e.name,
    e.muscle_group,
    e.user_id,
    e.created_at,
    COALESCE(u.usage_count, 0) AS usage_count,
    e.is_bodyweight,
    e.load_type,
    e.equipment,
    e.description,
    e.media_url,
    e.movement,
    e.muscle_detail,
    e.is_bilateral,
    e.is_compound,
    e.is_public,
    e.aliases
  FROM exercises e
  LEFT JOIN (
    SELECT ws.exercise_id, COUNT(*)::BIGINT AS usage_count
    FROM workout_sets ws
    JOIN workouts w ON w.id = ws.workout_id
    WHERE w.user_id = p_user_id
    GROUP BY ws.exercise_id
  ) u ON u.exercise_id = e.id
  WHERE e.user_id = p_user_id OR e.user_id IS NULL
  ORDER BY COALESCE(u.usage_count, 0) DESC, e.name;
$function$;

REVOKE ALL ON FUNCTION public.get_exercises_with_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exercises_with_usage(uuid) TO authenticated;

-- ============================================================
-- 6) INSERCIÓN DE 129 EJERCICIOS PÚBLICOS NUEVOS
-- ============================================================
-- Formato: INSERT ... WHERE NOT EXISTS (SELECT 1 FROM public.exercises
-- WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Nombre')) AND user_id IS NULL)

-- ------------------------------------------------------------
-- PECHO Y EMPUJE HORIZONTAL (8)
-- ------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press plano en máquina Smith', 'Pecho', 'Máquina Smith', 'Empuje', true, true, true,
  'Press de banca plano guiado en Multipower/Smith: trayectoria fija, permite cargas altas con seguridad.', false, 'external',
  ARRAY['Press Multipower','Smith Bench Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press plano en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press inclinado en máquina Smith', 'Pecho', 'Máquina Smith', 'Empuje', true, true, true,
  'Press en banco inclinado (30-45°) en Multipower: foco en porción clavicular del pectoral mayor.', false, 'external',
  ARRAY['Press inclinado Multipower','Smith Incline Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press inclinado en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press declinado en máquina Smith', 'Pecho', 'Máquina Smith', 'Empuje', true, true, true,
  'Press en banco declinado en Multipower: énfasis en porción esternal/inferior del pectoral.', false, 'external',
  ARRAY['Decline Smith Bench Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press declinado en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press de banca con agarre cerrado en Multipower', 'Pecho', 'Máquina Smith', 'Empuje', true, true, true,
  'Press en Multipower con agarre estrecho: mayor reclutamiento de tríceps y porción interna del pectoral.', false, 'external',
  ARRAY['Close Grip Smith Bench Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press de banca con agarre cerrado en Multipower')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press de pecho unilateral con mancuerna en banco', 'Pecho', 'Mancuernas', 'Empuje', false, true, true,
  'Press unilaterar con mancuerna en banco plano: corrige asimetrías y exige estabilidad escapular.', false, 'external',
  ARRAY['Offset Single-arm Chest Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press de pecho unilateral con mancuerna en banco')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexiones de brazos', 'Pecho', 'Peso corporal', 'Empuje', true, true, true,
  'Flexión clásica: manos a ancho de hombros, cuerpo recto, descenso controlado hasta rozar el suelo.', true, 'bodyweight_loaded',
  ARRAY['Push-ups','Lagartijas']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexiones de brazos')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexiones en anillas', 'Pecho', 'Anillas / TRX', 'Empuje', true, true, true,
  'Flexiones con anillas/TRX: inestabilidad controlada, mayor reclutamiento de estabilizadores escapulares.', true, 'bodyweight_loaded',
  ARRAY['Ring Push-Ups']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexiones en anillas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexión inclinada con TRX', 'Pecho', 'Anillas / TRX', 'Empuje', true, true, true,
  'Press de pecho en suspensión TRX: pies elevados o manos en straps, ángulo ajustable de dificultad.', true, 'bodyweight',
  ARRAY['TRX Chest Press','Flexiones en suspensión']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexión inclinada con TRX')) AND user_id IS NULL);

-- ------------------------------------------------------------
-- ESPALDA, DORSALES Y TRAPECIO (18)
-- ------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo en barra en T con apoyo para pecho', 'Espalda', 'Máquina', 'Tirón', true, true, true,
  'T-Bar Row con apoyo de pecho: elimina fatiga lumbar, aísla dorsal ancho y romboides.', false, 'external',
  ARRAY['T-Bar Row','Remo T']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo en barra en T con apoyo para pecho')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo en banco inclinado con mancuernas', 'Espalda', 'Mancuernas', 'Tirón', true, true, true,
  'Seal Row / Remo con pecho apoyado en banco inclinado: tirón horizontal estricto sin momentum.', false, 'external',
  ARRAY['Seal Row','Remo pecho apoyado']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo en banco inclinado con mancuernas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo sentado en polea con agarre ancho', 'Espalda', 'Polea', 'Tirón', true, true, true,
  'Remo en polea baja sentado con agarre ancho (estilo Gironda): foco en trapecio medio, romboides y deltoides posterior.', false, 'external',
  ARRAY['Seated Cable Wide Grip Row','Gironda ancho']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo sentado en polea con agarre ancho')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo con pecho apoyado en máquina a un brazo', 'Espalda', 'Máquina', 'Tirón', false, true, true,
  'Remo unilateral en máquina con apoyo de pecho: aísla dorsal ancho sin compensaciones.', false, 'external',
  ARRAY['One-Arm Chest Supported Row']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo con pecho apoyado en máquina a un brazo')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo con pecho apoyado en polea', 'Espalda', 'Polea', 'Tirón', true, true, true,
  'Remo horizontal en polea con pecho apoyado en banco: tensión constante, dorsal y grosor de espalda media.', false, 'external',
  ARRAY['Chest-Supported Cable Row']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo con pecho apoyado en polea')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo inclinado en máquina Smith', 'Espalda', 'Máquina Smith', 'Tirón', true, true, true,
  'Remo con barra guiada en Multipower: trayectoria fija, permite cargas altas con seguridad lumbar.', false, 'external',
  ARRAY['Smith Machine Bent Over Row']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo inclinado en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo Landmine a una mano', 'Espalda', 'Landmine', 'Tirón', false, true, true,
  'Remo unilateral con barra en landmine: arco natural, dorsal ancho y core anti-rotación.', false, 'external',
  ARRAY['One-Arm Landmine Row','Remo punta barra']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo Landmine a una mano')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Jalón al pecho con un brazo en polea', 'Espalda', 'Polea', 'Tirón', false, true, true,
  'Jalón vertical unilateral en polea alta: corrige asimetrías, mayor rango de movimiento.', false, 'external',
  ARRAY['One-Arm Lat Pulldown']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Jalón al pecho con un brazo en polea')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Jalón con brazos rectos en polea con cuerda', 'Espalda', 'Polea', 'Aislamiento', true, false, true,
  'Pullover en polea con cuerda: brazos semi-extendidos, bajada controlada activando dorsal ancho aislado.', false, 'external',
  ARRAY['Straight-Arm Rope Pulldown','Pullover cuerda']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Jalón con brazos rectos en polea con cuerda')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Jalón unilateral con brazo recto en polea', 'Espalda', 'Polea', 'Aislamiento', false, false, true,
  'Pullover unilateral en polea: un brazo a la vez, máxima conexión mente-músculo con dorsal.', false, 'external',
  ARRAY['One-Arm Straight-Arm Pulldown']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Jalón unilateral con brazo recto en polea')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Encogimiento de hombros en máquina Smith', 'Espalda', 'Máquina Smith', 'Aislamiento', true, false, true,
  'Encogimientos (shrugs) en Multipower: trayectoria vertical guiada, trapecio superior puro.', false, 'external',
  ARRAY['Smith Shoulder Shrug','Trapecios Smith']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Encogimiento de hombros en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo bajo en TRX', 'Espalda', 'Anillas / TRX', 'Tirón', true, true, true,
  'Remo horizontal en suspensión: pies adelantados para mayor dificultad, dorsal y romboides.', true, 'bodyweight',
  ARRAY['TRX Low Row','Remo en suspensión']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo bajo en TRX')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo en anillas', 'Espalda', 'Anillas / TRX', 'Tirón', true, true, true,
  'Ring Row / Australiana en anillas: cuerpo recto, tirón a pecho, inestabilidad controlada.', true, 'bodyweight_loaded',
  ARRAY['Ring Row','Australiana en anillas']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo en anillas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Dominadas en anillas', 'Espalda', 'Anillas / TRX', 'Tirón', true, true, true,
  'Ring Pull-Ups: agarre neutro rotante, menor estrés articular, dorsal y bíceps.', true, 'bodyweight_loaded',
  ARRAY['Ring Pull-Ups']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Dominadas en anillas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Dominadas escapulares', 'Espalda', 'Peso corporal', 'Tirón', true, false, true,
  'Scapular Pull-Ups: solo depresión/retracción escapular sin flexión de codo, trapecio inferior y serrato.', true, 'bodyweight',
  ARRAY['Scapular Pull-Ups']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Dominadas escapulares')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Gorilla Row con kettlebells', 'Espalda', 'Kettlebell', 'Tirón', false, true, true,
  'Remo alterno con kettlebells en posición de bisagra: dorsal, espalda media y agarre potente.', false, 'external',
  ARRAY['Remo gorila alterno']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Gorilla Row con kettlebells')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo renegado con kettlebells', 'Espalda', 'Kettlebell', 'Tirón', false, true, true,
  'Renegade Row: plancha alta + remo alterno, anti-rotación core extremo y dorsal unilateral.', false, 'external',
  ARRAY['Renegade Row']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo renegado con kettlebells')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Skin the cat en anillas', 'Espalda', 'Anillas / TRX', 'Tirón', true, true, true,
  'Vuelta completa en anillas: movilidad escapulohumeral extrema, dorsal, hombro y core.', true, 'bodyweight',
  ARRAY['Vuelta en anillas']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Skin the cat en anillas')) AND user_id IS NULL);

-- ------------------------------------------------------------
-- HOMBROS Y MANGUITO ROTADOR (21)
-- ------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press de hombros sentado en máquina Smith', 'Hombro', 'Máquina Smith', 'Empuje', true, true, true,
  'Press militar guiado en Multipower sentado: deltoides anterior y medio, trayectoria segura.', false, 'external',
  ARRAY['Smith Shoulder Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press de hombros sentado en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press tras nuca sentado en Multipower', 'Hombro', 'Máquina Smith', 'Empuje', true, true, true,
  'Behind-the-neck press en Smith: deltoides medio y anterior, requiere movilidad escapular previa.', false, 'external',
  ARRAY['Behind Neck Smith Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press tras nuca sentado en Multipower')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Remo vertical en máquina Smith', 'Hombro', 'Máquina Smith', 'Tirón', true, true, true,
  'Upright Row en Multipower: barra al mentón, deltoides lateral y trapecio superior.', false, 'external',
  ARRAY['Smith Upright Row','Remo al mentón']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Remo vertical en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press frontal con barra sentado con respaldo', 'Hombro', 'Barra', 'Empuje', true, true, true,
  'Overhead press sentado con barra y respaldo: deltoides anterior y tríceps, base estable.', false, 'external',
  ARRAY['Seated Barbell Overhead Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press frontal con barra sentado con respaldo')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press de hombro con kettlebell a una rodilla', 'Hombro', 'Kettlebell', 'Empuje', false, true, true,
  'Half-kneeling KB press: media rodilla, press unilateral, core anti-rotación y estabilidad escapular.', false, 'external',
  ARRAY['Half-Kneeling KB Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press de hombro con kettlebell a una rodilla')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Landmine Press de pie', 'Hombro', 'Landmine', 'Empuje', false, true, true,
  'Press con barra en landmine de pie: arco diagonal, deltoides anterior y haz clavicular pectoral.', false, 'external',
  ARRAY['Press mina terrestre']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Landmine Press de pie')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Landmine Press media rodilla', 'Hombro', 'Landmine', 'Empuje', false, true, true,
  'Half-kneeling landmine press: estabilidad escapular y core, press unilateral controlado.', false, 'external',
  ARRAY['Half-Kneeling Landmine Press']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Landmine Press media rodilla')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Elevaciones laterales en polea baja', 'Hombro', 'Polea', 'Aislamiento', false, false, true,
  'Lateral raise en polea: tensión constante en deltoides lateral, rango completo sin puntos muertos.', false, 'external',
  ARRAY['Cable Lateral Raise']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Elevaciones laterales en polea baja')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Elevaciones laterales acostado de lado', 'Hombro', 'Mancuernas', 'Aislamiento', false, false, true,
  'Side-lying lateral raise: elimina momentum, aísla deltoides lateral y supraespinoso.', false, 'external',
  ARRAY['Side-Lying Lateral Raise']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Elevaciones laterales acostado de lado')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Elevaciones laterales con Landmine', 'Hombro', 'Landmine', 'Aislamiento', false, false, true,
  'Landmine lateral raise: arco único, deltoides lateral con tensión excéntrica prolongada.', false, 'external',
  ARRAY['Landmine Lateral Raise']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Elevaciones laterales con Landmine')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Elevaciones frontales en polea baja', 'Hombro', 'Polea', 'Aislamiento', false, false, true,
  'Front raise en polea baja: tensión constante deltoides anterior, rango completo.', false, 'external',
  ARRAY['Cable Front Raise']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Elevaciones frontales en polea baja')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Elevaciones frontales sentado agarre supino', 'Hombro', 'Mancuernas', 'Aislamiento', true, false, true,
  'Front raise sentado con agarre supino: deltoides anterior + haz clavicular pectoral mayor.', false, 'external',
  ARRAY['Seated Supinated Front Raise']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Elevaciones frontales sentado agarre supino')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Pájaro en polea', 'Hombro', 'Polea', 'Aislamiento', true, false, true,
  'Rear delt fly en poleas: apertura horizontal inversa, deltoides posterior y trapecio inferior.', false, 'external',
  ARRAY['Cable Rear Delt Fly','Aperturas inversas en polea']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Pájaro en polea')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Y-fly en TRX', 'Hombro', 'Anillas / TRX', 'Tirón', true, true, true,
  'Apertura en Y en suspensión: deltoides posterior, trapecio inferior y serrato anterior.', true, 'bodyweight',
  ARRAY['Apertura posterior en Y en suspensión']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Y-fly en TRX')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexión en pica', 'Hombro', 'Peso corporal', 'Empuje', true, true, true,
  'Pike Push-Up: cadera alta, empuje vertical, deltoides anterior y tríceps, progresión a HSPU.', true, 'bodyweight',
  ARRAY['Pike Push-Up']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexión en pica')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexión haciendo el pino', 'Hombro', 'Peso corporal', 'Empuje', true, true, true,
  'Handstand Push-Up (HSPU): empuje vertical completo invertido, deltoides completo y tríceps.', true, 'bodyweight_loaded',
  ARRAY['Handstand Push-Up','HSPU']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexión haciendo el pino')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Kettlebell Halo', 'Hombro', 'Kettlebell', 'Aislamiento', true, false, true,
  'Círculos de kettlebell alrededor de la cabeza: movilidad escapulohumeral, core y estabilidad.', false, 'external',
  ARRAY['Círculos alrededor de la cabeza']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Kettlebell Halo')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Rotación externa con banda elástica a 45°/90°', 'Hombro', 'Bandas', 'Aislamiento', false, false, true,
  'Rotación externa de hombro con banda a 45-90° abducción: infraespinoso y redondo menor.', false, 'external',
  ARRAY['External Rotation Band']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Rotación externa con banda elástica a 45°/90°')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Rotación interna con banda elástica', 'Hombro', 'Bandas', 'Aislamiento', false, false, true,
  'Rotación interna con banda: subescapular, equilibra rotadores externos.', false, 'external',
  ARRAY['Internal Rotation Band']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Rotación interna con banda elástica')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Elevación en el plano de la escápula', 'Hombro', 'Bandas', 'Aislamiento', true, false, true,
  'Scaption (30-45° anterior al plano frontal): supraespinoso y deltoides, patrón funcional.', false, 'external',
  ARRAY['Scaption con banda o mancuerna']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Elevación en el plano de la escápula')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Movimientos pendulares de hombro', 'Hombro', 'Peso corporal', 'Aislamiento', false, false, true,
  'Péndulo de Codman: oscilaciones pasivas relajadas, descarga articular y movilidad temprana.', true, 'bodyweight',
  ARRAY['Péndulo de Codman']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Movimientos pendulares de hombro')) AND user_id IS NULL);

-- ------------------------------------------------------------
-- BÍCEPS, TRÍCEPS, ANTEBRAZOS Y AGARRE (21)
-- ------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl Bayesian en polea baja', 'Bíceps', 'Polea', 'Aislamiento', false, false, true,
  'Bayesian Cable Curl: polea baja detrás del cuerpo, estiramiento máximo de cabeza larga bíceps.', false, 'external',
  ARRAY['Bayesian Cable Curl']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl Bayesian en polea baja')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl de bíceps en banco inclinado con mancuernas', 'Bíceps', 'Mancuernas', 'Aislamiento', true, false, true,
  'Incline Dumbbell Curl (45-60°): máximo estiramiento de cabeza larga en posición inicial.', false, 'external',
  ARRAY['Incline Dumbbell Curl']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl de bíceps en banco inclinado con mancuernas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl de bíceps concentrado con mancuerna', 'Bíceps', 'Mancuernas', 'Aislamiento', false, false, true,
  'Concentration Curl: codo apoyado en muslo, supinación máxima, bíceps braquial y braquial.', false, 'external',
  ARRAY['Concentration Curl']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl de bíceps concentrado con mancuerna')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl de bíceps sentado con mancuernas', 'Bíceps', 'Mancuernas', 'Aislamiento', true, false, true,
  'Seated Biceps Curl: elimina balanceo lumbar, foco en flexión de codo estricta.', false, 'external',
  ARRAY['Seated Biceps Curl']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl de bíceps sentado con mancuernas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl de bíceps con barra en pronación', 'Bíceps', 'Barra', 'Aislamiento', true, false, true,
  'Reverse Curl con barra: agarre pronado, braquiorradial y braquial anterior predominantes.', false, 'external',
  ARRAY['Curl inverso con barra']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl de bíceps con barra en pronación')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl de bíceps en suspensión', 'Bíceps', 'Anillas / TRX', 'Aislamiento', true, true, true,
  'TRX Biceps Curl: cuerpo inclinado, tirón supino, bíceps y core anti-extensión.', true, 'bodyweight',
  ARRAY['TRX Biceps Curl']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl de bíceps en suspensión')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Press JM en máquina Smith', 'Tríceps', 'Máquina Smith', 'Empuje', true, true, true,
  'JM Press en Multipower: híbrido press/extensión, fuerza de bloqueo y tríceps pesado.', false, 'external',
  ARRAY['JM Press Smith']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Press JM en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Extensión de tríceps en polea alta agarre supino', 'Tríceps', 'Polea', 'Aislamiento', true, false, true,
  'Reverse Grip Pushdown: agarre supino, énfasis en vasto interno / cabeza medial tríceps.', false, 'external',
  ARRAY['Reverse Grip Cable Pushdown']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Extensión de tríceps en polea alta agarre supino')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Extensión vertical alternada de tríceps con mancuerna', 'Tríceps', 'Mancuernas', 'Aislamiento', false, false, true,
  'Overhead extension a un brazo: estiramiento máximo de porción larga, corrección asimetrías.', false, 'external',
  ARRAY['One-Arm Overhead Extension']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Extensión vertical alternada de tríceps con mancuerna')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Extensión de tríceps en suspensión', 'Tríceps', 'Anillas / TRX', 'Aislamiento', true, true, true,
  'TRX Triceps Extension: cuerpo inclinado, extensión de codo, cabeza larga y lateral tríceps.', true, 'bodyweight',
  ARRAY['TRX Triceps Extension']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Extensión de tríceps en suspensión')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Fondos en anillas', 'Tríceps', 'Anillas / TRX', 'Empuje', true, true, true,
  'Ring Dips: inestabilidad extrema, tríceps, pectoral inferior y estabilidad escapular total.', true, 'bodyweight_loaded',
  ARRAY['Ring Dips']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Fondos en anillas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexión de muñeca con barra en supinación', 'Antebrazo', 'Barra', 'Aislamiento', true, false, true,
  'Wrist Curl supino: flexores del carpo, agarre supino, rango completo.', false, 'external',
  ARRAY['Curl de muñecas supino']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexión de muñeca con barra en supinación')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Extensión de muñeca con barra en pronación', 'Antebrazo', 'Barra', 'Aislamiento', true, false, true,
  'Reverse Wrist Curl: extensores del carpo, agarre pronado, equilibrio flexores/extensores.', false, 'external',
  ARRAY['Curl invertido de muñecas']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Extensión de muñeca con barra en pronación')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexión de muñeca unilateral con mancuerna', 'Antebrazo', 'Mancuernas', 'Aislamiento', false, false, true,
  'Dumbbell Wrist Curl unilateral: flexores de muñeca, corrección asimetrías.', false, 'external',
  ARRAY['Dumbbell Wrist Curl']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexión de muñeca unilateral con mancuerna')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Extensión de muñeca unilateral con mancuerna', 'Antebrazo', 'Mancuernas', 'Aislamiento', false, false, true,
  'Reverse Dumbbell Wrist Curl unilateral: extensores de muñeca, un brazo a la vez.', false, 'external',
  ARRAY['Reverse Dumbbell Wrist Curl']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Extensión de muñeca unilateral con mancuerna')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Desviación radial y cubital de muñeca', 'Antebrazo', 'Mancuernas', 'Aislamiento', false, false, true,
  'Radial/Ulnar Deviation con mancuerna: estabilizadores laterales del carpo, salud articular.', false, 'external',
  ARRAY['Radial / Ulnar Deviation']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Desviación radial y cubital de muñeca')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Pronación y supinación de antebrazo con mancuerna', 'Antebrazo', 'Mancuernas', 'Aislamiento', false, false, true,
  'Forearm Pronation/Supination: pronador redondo y supinador, control rotacional completo.', false, 'external',
  ARRAY['Forearm Pronation/Supination']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Pronación y supinación de antebrazo con mancuerna')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Rodillo de muñeca', 'Antebrazo', 'Barra', 'Aislamiento', true, false, true,
  'Wrist Roller: enroscamiento/desenroscamiento de barra con cuerda y peso, flexores y extensores completos.', false, 'external',
  ARRAY['Wrist Roller','Enroscamiento de barra']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Rodillo de muñeca')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Suspensión en barra', 'Antebrazo', 'Peso corporal', 'Aislamiento', true, false, true,
  'Dead Hang: colgado pasivo, resistencia de agarre, descompresión espinal y movilidad escapular.', true, 'bodyweight_loaded',
  ARRAY['Dead Hang','Colgarse de barra']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Suspensión en barra')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Pinzamiento de discos', 'Antebrazo', 'Barra', 'Aislamiento', true, false, true,
  'Plate Pinch: pinza de discos lisos, agarre en pinza y extensores de dedos, fuerza de pinza.', false, 'external',
  ARRAY['Plate Pinch']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Pinzamiento de discos')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Extensión de dedos con goma', 'Antebrazo', 'Bandas', 'Aislamiento', false, false, true,
  'Rubber Band Finger Extension: banda alrededor de dedos, apertura contra resistencia, extensores.', false, 'external',
  ARRAY['Rubber Band Finger Extension']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Extensión de dedos con goma')) AND user_id IS NULL);

-- ------------------------------------------------------------
-- TREN INFERIOR: CUÁDRICEPS, ISQUIOS, GLÚTEOS, ADUCTORES Y TIBIAL (22)
-- ------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla Hack en máquina', 'Pierna', 'Máquina', 'Sentadilla', true, true, true,
  'Hack Squat / Jaca: máquina con respaldo, cuádriceps dominante, menor carga espinal.', false, 'external',
  ARRAY['Jaca','Hack Squat']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla Hack en máquina')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla Pendular en máquina', 'Pierna', 'Máquina', 'Sentadilla', true, true, true,
  'Pendulum Squat: arco de movimiento natural, cuádriceps profundo con apoyo lumbar.', false, 'external',
  ARRAY['Pendulum Squat']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla Pendular en máquina')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Belt Squat', 'Pierna', 'Máquina', 'Sentadilla', true, true, true,
  'Sentadilla con cinturón/carga en caderas: cuádriceps y glúteos sin carga axial espinal.', false, 'external',
  ARRAY['Sentadilla con cinturón']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Belt Squat')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sissy Squat en máquina', 'Pierna', 'Máquina', 'Aislamiento', true, false, true,
  'Sissy Squat: rodillas adelante, torso atrás, recto femoral y cuádriceps en estiramiento extremo.', true, 'bodyweight_loaded',
  ARRAY['Sentadilla Sissy']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sissy Squat en máquina')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl Nórdico Inverso', 'Pierna', 'Peso corporal', 'Aislamiento', true, false, true,
  'Reverse Nordic: desde rodillas, caer hacia atrás controlando con cuádriceps, excéntrico puro.', true, 'bodyweight_loaded',
  ARRAY['Reverse Nordic']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl Nórdico Inverso')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla Goblet', 'Pierna', 'Kettlebell', 'Sentadilla', true, true, true,
  'Goblet Squat: kettlebell a altura de pecho, postura erguida, cuádriceps y técnica postural.', false, 'external',
  ARRAY['Goblet Squat']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla Goblet')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla en máquina Smith', 'Pierna', 'Máquina Smith', 'Sentadilla', true, true, true,
  'Smith Squat / Sentadilla Multipower: guiada, permite fallo muscular seguro, cuádriceps y glúteos.', false, 'external',
  ARRAY['Smith Squat','Sentadilla Multipower']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla Frontal en máquina Smith', 'Pierna', 'Máquina Smith', 'Sentadilla', true, true, true,
  'Smith Front Squat: barra en posición frontal guiada, cuádriceps dominante, core exigido.', false, 'external',
  ARRAY['Smith Front Squat']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla Frontal en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla Sumo en Multipower', 'Pierna', 'Máquina Smith', 'Sentadilla', true, true, true,
  'Sumo Squat en Smith: stance ancho, mayor aductores/glúteos, menor cuádriceps.', false, 'external',
  ARRAY['Sumo Squat Smith']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla Sumo en Multipower')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla Zercher en máquina Smith', 'Pierna', 'Máquina Smith', 'Sentadilla', true, true, true,
  'Zercher Squat en Smith: barra en el pliegue del codo, cuádriceps, glúteos y espalda alta.', false, 'external',
  ARRAY['Smith Zercher Squat']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla Zercher en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Prensa de piernas vertical en máquina Smith', 'Pierna', 'Máquina Smith', 'Sentadilla', true, true, true,
  'Vertical Leg Press en Smith: tumbado, empuje vertical de piernas, cuádriceps/isquios/glúteos.', false, 'external',
  ARRAY['Vertical Leg Press Smith']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Prensa de piernas vertical en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Buenos días', 'Pierna', 'Barra', 'Bisagra', true, true, true,
  'Good Morning: bisagra de cadera con barra en espalda, isquiotibiales, glúteos y erectores.', false, 'external',
  ARRAY['Good Morning con barra o Smith']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Buenos días')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Pistol Squat', 'Pierna', 'Peso corporal', 'Sentadilla', false, true, true,
  'Sentadilla a una pierna (pistol): cuádriceps y glúteo unilateral, movilidad tobillo/cadera extrema.', true, 'bodyweight_loaded',
  ARRAY['Sentadilla a una pierna']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Pistol Squat')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Zancada lateral con mancuernas', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true,
  'Lateral Lunge: paso lateral amplio, cadera atrás, aductores, glúteo medio y cuádriceps.', false, 'external',
  ARRAY['Lateral Lunge']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Zancada lateral con mancuernas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Sentadilla Cosaco con Landmine', 'Pierna', 'Landmine', 'Sentadilla', false, true, true,
  'Cossack Squat con landmine: carga contralateral, aductores, cuádriceps y movilidad de cadera.', false, 'external',
  ARRAY['Cossack Squat Landmine']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Sentadilla Cosaco con Landmine')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Zancada trasera en Multipower', 'Pierna', 'Máquina Smith', 'Sentadilla', false, true, true,
  'Smith Rear Lunge: zancada hacia atrás guiada, glúteo y cuádriceps unilateral seguro.', false, 'external',
  ARRAY['Smith Rear Lunge']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Zancada trasera en Multipower')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Zancada con kettlebell sobre la cabeza', 'Pierna', 'Kettlebell', 'Sentadilla', false, true, true,
  'Overhead KB Lunge: kettlebell overhead, core y estabilidad escapular, cuádriceps/glúteo unilateral.', false, 'external',
  ARRAY['Overhead KB Lunge']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Zancada con kettlebell sobre la cabeza')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Puente de glúteos elevado en banco', 'Glúteo', 'Mancuernas', 'Bisagra', true, true, true,
  'Elevated Glute Bridge: hombros en banco, empuje cadera, glúteo mayor e isquiotibiales.', false, 'external',
  ARRAY['Elevated Glute Bridge']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Puente de glúteos elevado en banco')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Patada de glúteos en máquina Smith', 'Glúteo', 'Máquina Smith', 'Aislamiento', false, false, true,
  'Smith Machine Glute Kickback: extensión de cadera unilateral guiada, glúteo mayor puro.', false, 'external',
  ARRAY['Smith Machine Glute Kickback']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Patada de glúteos en máquina Smith')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Extensión de espalda en máquina / banco 45°', 'Pierna', 'Máquina', 'Bisagra', true, true, true,
  'Back Extension / Hiperextensión 45°: glúteos, isquios y erectores, cadena posterior completa.', true, 'bodyweight_loaded',
  ARRAY['Back Extension','Hiperextensión']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Extensión de espalda en máquina / banco 45°')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Aducción de cadera en máquina', 'Pierna', 'Máquina', 'Aislamiento', true, false, true,
  'Aductores sentado: aducción de muslos contra resistencia, aductores mayor/largo/breve.', false, 'external',
  ARRAY['Aductores sentado']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Aducción de cadera en máquina')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexión dorsal de tobillo con banda o polea', 'Pierna', 'Bandas', 'Aislamiento', false, false, true,
  'Tibial Anterior / Ankle Flexion: dorsiflexión resistida, prevención periostitis tibial.', false, 'external',
  ARRAY['Tibial anterior','Ankle Flexion']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexión dorsal de tobillo con banda o polea')) AND user_id IS NULL);

-- ------------------------------------------------------------
-- CORE FUNCIONAL (10)
-- ------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Dead Bug', 'Core', 'Peso corporal', 'Core', false, false, true,
  'Dead Bug / Bicho muerto: anti-extensión lumbar, transverso y disociación cadera-hombro.', true, 'bodyweight',
  ARRAY['Bicho muerto']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Dead Bug')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Bird Dog', 'Core', 'Peso corporal', 'Core', false, false, true,
  'Bird Dog / Perro-pájaro: cuadrupedia, extensión contralateral, estabilidad lumbar y anti-rotación.', true, 'bodyweight',
  ARRAY['Perro-pájaro']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Bird Dog')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Curl-up modificado', 'Core', 'Peso corporal', 'Core', true, false, true,
  'McGill Curl-up: flexión cervical/torácica mínima, recto abdominal sin estrés lumbar.', true, 'bodyweight',
  ARRAY['McGill Curl-up']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Curl-up modificado')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Plancha Copenhagen', 'Core', 'Peso corporal', 'Core', false, true, true,
  'Copenhagen Plank: plancha lateral con pierna superior en banco, oblicuos y aductores intensos.', true, 'bodyweight',
  ARRAY['Copenhagen Plank']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Plancha Copenhagen')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Paseo de la maleta', 'Core', 'Mancuernas', 'Core', false, true, true,
  'Suitcase Carry / Acarreo unilateral: anti-flexión lateral, cuadrado lumbar y oblicuos.', false, 'external',
  ARRAY['Suitcase Carry','Acarreo unilateral']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Paseo de la maleta')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Rotación con Landmine', 'Core', 'Landmine', 'Core', true, true, true,
  'Landmine Twist / Rotation: barra en landmine, rotación controlada, oblicuos y control rotacional.', false, 'external',
  ARRAY['Landmine Twist','Landmine Rotation']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Rotación con Landmine')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Roll-out oblicuo con Landmine', 'Core', 'Landmine', 'Core', false, true, true,
  'Landmine Oblique Rollout: rodillas, barra landmine, anti-extensión + oblicuos dinámicos.', false, 'external',
  ARRAY['Landmine Oblique Rollout']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Roll-out oblicuo con Landmine')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'L-sit en anillas o paralelas', 'Core', 'Anillas / TRX', 'Core', true, true, true,
  'L-sit / Escuadra isométrica: recto abdominal, flexores cadera, compresión total, anillas/paralelas.', true, 'bodyweight',
  ARRAY['Escuadra isométrica']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('L-sit en anillas o paralelas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Plancha con pies en TRX y rodillas al pecho', 'Core', 'Anillas / TRX', 'Core', true, true, true,
  'TRX Knee Tuck / Pike: plancha pies en straps, rodillas al pecho (tuck) o pike, anti-extensión + flexión cadera.', true, 'bodyweight',
  ARRAY['TRX Knee Tuck','TRX Pike']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Plancha con pies en TRX y rodillas al pecho')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Elevación de cadera de pie para cuadrado lumbar', 'Core', 'Peso corporal', 'Core', false, false, true,
  'QL Hip Hike: pie en step, elevación cadera contralateral, cuadrado lumbar y glúteo medio.', true, 'bodyweight_loaded',
  ARRAY['QL Hip Hike']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Elevación de cadera de pie para cuadrado lumbar')) AND user_id IS NULL);

-- ------------------------------------------------------------
-- PLIOMETRÍA, BALÓN MEDICINAL, OLÍMPICOS, KETTLEBELLS Y ACONDICIONAMIENTO (29)
-- ------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Salto al cajón a una pierna', 'Pierna', 'Cajón pliométrico', 'Pliometría', false, true, true,
  'Single-Leg Box Jump: potencia unilateral, aterrizaje controlado, cuádriceps/glúteo reactivos.', true, 'bodyweight',
  ARRAY['Single-Leg Box Jump']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Salto al cajón a una pierna')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Salto vertical a una pierna', 'Pierna', 'Peso corporal', 'Pliometría', false, true, true,
  'Single-Leg Hop: reactividad unilateral, SSC tobillo-rodilla-cadera, prevención asimetrías.', true, 'bodyweight',
  ARRAY['Single-Leg Hop']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Salto vertical a una pierna')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Saltos de rana', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true,
  'Frog Jump: salto horizontal bilateral desde cuclillas, potencia horizontal y movilidad cadera.', true, 'bodyweight',
  ARRAY['Frog Jump']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Saltos de rana')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Saltos continuos sobre vallas', 'Pierna', 'Vallas', 'Pliometría', true, true, true,
  'Hurdle Hops: saltos reactivos continuos sobre vallas, rigidez reactiva y ciclo acortamiento-estiramiento.', true, 'bodyweight',
  ARRAY['Hurdle Hops','Saltos de vallas']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Saltos continuos sobre vallas')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Multisaltos horizontales alternos', 'Pierna', 'Peso corporal', 'Pliometría', false, true, true,
  'Bounding / Zancadas pliométricas: zancadas explosivas alternas, potencia horizontal y coordinación.', true, 'bodyweight',
  ARRAY['Bounding','Zancadas pliométricas']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Multisaltos horizontales alternos')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Salto lateral con balón medicinal', 'Pierna', 'Balón medicinal', 'Pliometría', false, true, true,
  'Lateral Med Ball Hop: salto lateral con balón, potencia frontal y frenada excéntrica unilateral.', false, 'external',
  ARRAY['Lateral Med Ball Hop']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Salto lateral con balón medicinal')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Salto con rodillas al pecho en TRX', 'Pierna', 'Anillas / TRX', 'Pliometría', true, true, true,
  'TRX Tuck Jump: salto asistido por straps, rodillas al pecho, potencia vertical con asistencia.', true, 'bodyweight',
  ARRAY['TRX Tuck Jump']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Salto con rodillas al pecho en TRX')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Salto a la comba', 'Pierna', 'Comba', 'Pliometría', true, false, true,
  'Jump Rope: reactividad tobillo, ritmo, coordinación y acondicionamiento cardiovascular.', true, 'bodyweight',
  ARRAY['Jump Rope','Saltar a la cuerda']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Salto a la comba')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Flexiones pliométricas con palmada', 'Pecho', 'Peso corporal', 'Pliometría', true, true, true,
  'Explosive Push-Up / Clap Push-Up: empuje explosivo con palmada, potencia de empuje superior.', true, 'bodyweight',
  ARRAY['Explosive Push-Up']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Flexiones pliométricas con palmada')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Azote con balón medicinal', 'Pierna', 'Balón medicinal', 'Pliometría', true, true, true,
  'Medicine Ball Slam: azote overhead a suelo, dorsal, core y potencia triple extensión.', false, 'external',
  ARRAY['Medicine Ball Slam','Slam ball']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Azote con balón medicinal')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Wall Ball', 'Pierna', 'Balón medicinal', 'Pliometría', true, true, true,
  'Wall Ball: sentadilla + lanzamiento a target en pared, piernas, hombros y cardio metabólico.', false, 'external',
  ARRAY['Sentadilla con lanzamiento a pared']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Wall Ball')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Lanzamiento lateral rotacional a pared', 'Core', 'Balón medicinal', 'Pliometría', false, true, true,
  'Med Ball Rotational Throw: rotación explosiva de tronco contra pared, oblicuos y potencia rotacional.', false, 'external',
  ARRAY['Med Ball Rotational Throw']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Lanzamiento lateral rotacional a pared')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Lanzamiento por encima de la cabeza con balón medicinal', 'Pierna', 'Balón medicinal', 'Pliometría', true, true, true,
  'Overhead Med Ball Throw: extensión triple (tobillo-rodilla-cadera) + lanzamiento overhead.', false, 'external',
  ARRAY['Overhead Med Ball Throw']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Lanzamiento por encima de la cabeza con balón medicinal')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Med Ball Clean and Jerk', 'Pierna', 'Balón medicinal', 'Pliometría', true, true, true,
  'Cargada y envión con balón: patrón olímpico simplificado, triple extensión y recepción.', false, 'external',
  ARRAY['Cargada y envión con balón']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Med Ball Clean and Jerk')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Hang Power Snatch', 'Pierna', 'Barra', 'Pliometría', true, true, true,
  'Arrancada colgante de potencia: desde hang, recepción en semi-sentadilla, potencia olímpica.', false, 'external',
  ARRAY['Arrancada colgante de potencia']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Hang Power Snatch')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Snatch Pull', 'Espalda', 'Barra', 'Bisagra', true, true, true,
  'Snatch Pull: tirón de arrancada hasta extensión completa, fuerza de tirón olímpico sin recepción.', false, 'external',
  ARRAY['Tirón de arrancada']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Snatch Pull')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Snatch Balance', 'Hombro', 'Barra', 'Sentadilla', true, true, true,
  'Snatch Balance: caída bajo barra con agarre ancho, velocidad de recepción y overhead stability.', false, 'external',
  ARRAY['Equilibrio de arrancada']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Snatch Balance')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Overhead Squat', 'Pierna', 'Barra', 'Sentadilla', true, true, true,
  'Sentadilla sobre la cabeza: movilidad overhead, estabilidad escapular, core y cadena posterior.', false, 'external',
  ARRAY['Sentadilla sobre la cabeza']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Overhead Squat')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Swing ruso con kettlebell', 'Pierna', 'Kettlebell', 'Bisagra', true, true, true,
  'Russian KB Swing: bisagra balística de cadera, glúteos/isquios explosivos, core y agarre.', false, 'external',
  ARRAY['Russian Kettlebell Swing']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Swing ruso con kettlebell')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Kettlebell Snatch', 'Pierna', 'Kettlebell', 'Pliometría', false, true, true,
  'KB Snatch: arrancada con pesa rusa, flujo continuo, potencia y gasto energético extremo.', false, 'external',
  ARRAY['Arrancada con pesa rusa']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Kettlebell Snatch')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Kettlebell Clean and Jerk', 'Pierna', 'Kettlebell', 'Empuje', false, true, true,
  'KB Clean & Jerk: cargada al rack + envión overhead, fuerza y potencia unilateral.', false, 'external',
  ARRAY['Cargada y envión con pesa rusa']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Kettlebell Clean and Jerk')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Levantamiento turco', 'Core', 'Kettlebell', 'Core', false, true, true,
  'Turkish Get-Up (TGU): secuencia suelo-pie-suelo con KB overhead, estabilidad hombro y core total.', false, 'external',
  ARRAY['Turkish Get-Up','TGU']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Levantamiento turco')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Kettlebell Windmill', 'Core', 'Kettlebell', 'Bisagra', false, true, true,
  'KB Windmill: molino con pesa rusa, movilidad cadera/hombro, estabilidad lateral y core.', false, 'external',
  ARRAY['Molino con pesa rusa']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Kettlebell Windmill')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Devil''s Press', 'Pierna', 'Kettlebell', 'Pliometría', true, true, true,
  'Devil''s Press: burpee + snatch/press KB alterno, potencia y acondicionamiento metabólico brutal.', false, 'external',
  ARRAY['Burpee con press sobre la cabeza']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Devil''s Press')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Empuje de trineo', 'Pierna', 'Trineo', 'Empuje', true, true, true,
  'Sled Push / Prowler: empuje horizontal de bajo impacto, cuádriceps/glúteos, acondicionamiento.', false, 'external',
  ARRAY['Sled Push','Prowler']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Empuje de trineo')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Arrastre de trineo', 'Pierna', 'Trineo', 'Tirón', true, true, true,
  'Sled Pull / Backward Drag: arrastre hacia atrás (cuádriceps) o hacia adelante (dorsal), tracción.', false, 'external',
  ARRAY['Sled Pull','Backward Sled Drag']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Arrastre de trineo')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Cuerdas de combate', 'Hombro', 'Cuerdas', 'Otro', true, true, true,
  'Battle Ropes: ondas/azotes/battling ropes, resistencia anaeróbica hombro/core, HIIT.', false, 'external',
  ARRAY['Battle Ropes']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Cuerdas de combate')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Muscle-Up', 'Espalda', 'Peso corporal', 'Tirón', true, true, true,
  'Muscle-Up: dominada explosiva + transición + fondo en barra/anillas, pulling + pushing power.', true, 'bodyweight_loaded',
  ARRAY['Muscle-Up en barra o anillas']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Muscle-Up')) AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type, aliases)
SELECT 'Inchworms', 'Core', 'Peso corporal', 'Core', true, true, true,
  'Inchworms / Oruga: pie-mano-pie, movilidad cadena posterior, core y shoulders, calentamiento dinámico.', true, 'bodyweight',
  ARRAY['Oruga']
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE lower(public.f_unaccent(name)) = lower(public.f_unaccent('Inchworms')) AND user_id IS NULL);

-- ============================================================
-- 7) BACKFILL EXERCISE_MUSCLES (primary 100% para nuevos ejercicios)
-- ============================================================
INSERT INTO public.exercise_muscles (exercise_id, muscle_group, role, weight)
SELECT e.id, e.muscle_group, 'primary', 100
FROM public.exercises e
LEFT JOIN public.exercise_muscles em ON em.exercise_id = e.id
WHERE em.id IS NULL
  AND e.user_id IS NULL;

-- ============================================================
-- 8) SINCRONIZACIÓN IS_BODYWEIGHT / LOAD_TYPE (idempotente)
-- ============================================================
-- bodyweight: ejercicios de peso corporal puro
UPDATE public.exercises
SET load_type = 'bodyweight', is_bodyweight = true
WHERE load_type = 'external'
  AND equipment IN ('Peso corporal', 'Anillas / TRX', 'Comba', 'Vallas', 'Cajón pliométrico')
  AND user_id IS NULL;

-- bodyweight_loaded: peso corporal con carga añadida o alta intensidad
UPDATE public.exercises
SET load_type = 'bodyweight_loaded', is_bodyweight = true
WHERE load_type = 'external'
  AND (
    name ILIKE '%lastre%' OR name ILIKE '%weighted%' OR name ILIKE '%con carga%'
    OR name IN ('Flexiones de brazos','Flexiones en anillas','Fondos en anillas',
                'Dominadas en anillas','Pistol Squat','Sissy Squat en máquina',
                'Curl Nórdico Inverso','Extensión de espalda en máquina / banco 45°',
                'Suspensión en barra','Muscle-Up','Flexión haciendo el pino')
  )
  AND user_id IS NULL;

-- Corrección general coherencia
UPDATE public.exercises
SET is_bodyweight = (load_type <> 'external')
WHERE is_bodyweight <> (load_type <> 'external')
  AND user_id IS NULL;

-- ============================================================
-- 9) NOTIFICAR A POSTGREST PARA RECARGA DE ESQUEMA
-- ============================================================
NOTIFY pgrst, 'reload schema';