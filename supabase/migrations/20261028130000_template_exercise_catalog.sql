-- Completa el catálogo público con los ejercicios que usan las rutinas
-- predefinidas (PREDEFINED_ROUTINES) y que todavía no existían. Los nombres
-- repetidos de la plantilla se han alineado antes con su fila canónica
-- («Remo unilateral» → «Remo a una mano», «Prensa» → «Prensa de piernas»…),
-- así que aquí solo entran los que no tienen equivalente.
-- Idempotente: cada INSERT usa WHERE NOT EXISTS (name, user_id IS NULL) porque
-- el UNIQUE (name, user_id) no protege duplicados cuando user_id es NULL
-- (dos NULL nunca chocan en Postgres).

-- 1) Pierna -------------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl femoral sentado', 'Pierna', 'Máquina', 'Aislamiento', true, false, true, 'Flexión de rodilla sentado en máquina, isquiotibiales con la cadera flexionada.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl femoral sentado' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla parcial', 'Pierna', 'Barra', 'Sentadilla', true, true, true, 'Sentadilla recortada a un recorrido corto, cargas altas y énfasis en la salida.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla parcial' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl nórdico', 'Pierna', 'Peso corporal', 'Aislamiento', true, false, true, 'Flexión de rodilla excéntrica con los tobillos fijados, isquiotibiales.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl nórdico' AND user_id IS NULL);

-- 2) Hombro -------------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevaciones disco', 'Hombro', 'Otro', 'Aislamiento', true, false, true, 'Elevación frontal con un disco sujeto con ambas manos, deltoides anterior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevaciones disco' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Rotación externa con goma', 'Hombro', 'Bandas', 'Aislamiento', false, false, true, 'Rotación externa del hombro contra banda, manguito rotador.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Rotación externa con goma' AND user_id IS NULL);

-- 3) Espalda ------------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Power Clean', 'Espalda', 'Barra', 'Bisagra', true, true, true, 'Cargada de potencia: la barra sube del suelo al hombro en un tirón explosivo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Power Clean' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Power Snatch', 'Espalda', 'Barra', 'Bisagra', true, true, true, 'Arrancada de potencia: la barra sube del suelo por encima de la cabeza en un tirón.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Power Snatch' AND user_id IS NULL);

-- 4) Core ---------------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Plancha lateral', 'Core', 'Peso corporal', 'Core', false, false, true, 'Plancha sobre un antebrazo, oblicuos y estabilidad lateral de cadera.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Plancha lateral' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press Pallof', 'Core', 'Polea', 'Core', false, false, true, 'Empuje horizontal contra la rotación de la polea, antirrotación de core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press Pallof' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Leñador en polea', 'Core', 'Polea', 'Core', false, false, true, 'Rotación de tronco de arriba abajo en polea, oblicuos y core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Leñador en polea' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Lanzamiento de balón medicinal', 'Core', 'Otro', 'Pliometría', false, false, true, 'Lanzamiento explosivo de balón medicinal, potencia rotacional de core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Lanzamiento de balón medicinal' AND user_id IS NULL);
