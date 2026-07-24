-- Amplía la biblioteca pública de ejercicios: más compuestos, variantes
-- unilaterales y una nueva categoría de movimiento para pliometría.
-- Idempotente: cada INSERT usa WHERE NOT EXISTS (name, user_id IS NULL) porque
-- el UNIQUE (name, user_id) no protege duplicados cuando user_id es NULL
-- (dos NULL nunca chocan en Postgres).

-- 1) Nuevo valor de movement para ejercicios pliométricos -------------------
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_movement_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_movement_check
  CHECK (movement IN ('Empuje','Tirón','Sentadilla','Bisagra','Aislamiento','Core','Pliometría','Otro'));

-- 2) Ejercicios compuestos adicionales ---------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Peso muerto rumano', 'Pierna', 'Barra', 'Bisagra', true, true, true, 'Bisagra de cadera con piernas semi-rígidas, énfasis en isquiotibiales y glúteo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Peso muerto rumano' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo con barra', 'Espalda', 'Barra', 'Tirón', true, true, true, 'Tirón horizontal con barra, torso inclinado, para dorsal y espalda media.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo con barra' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press militar', 'Hombro', 'Barra', 'Empuje', true, true, true, 'Press vertical con barra de pie o sentado, hombro y tríceps.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press militar' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Hip thrust', 'Glúteo', 'Barra', 'Bisagra', true, true, true, 'Extensión de cadera con barra apoyada en banco, glúteo mayor.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Hip thrust' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Clean and press', 'Hombro', 'Barra', 'Empuje', true, true, true, 'Cargada de la barra al hombro seguida de press, movimiento olímpico completo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Clean and press' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla frontal', 'Pierna', 'Barra', 'Sentadilla', true, true, true, 'Sentadilla con la barra en posición frontal, mayor énfasis en cuádriceps.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla frontal' AND user_id IS NULL);

-- 3) Variantes unilaterales ---------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla búlgara', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Sentadilla a una pierna con el pie trasero elevado en banco.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla búlgara' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Zancada caminando', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Zancadas alternas avanzando con mancuernas a los lados.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Zancada caminando' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo a una mano', 'Espalda', 'Mancuernas', 'Tirón', false, true, true, 'Remo unilateral apoyado en banco, un brazo por serie.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo a una mano' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press de hombro a un brazo', 'Hombro', 'Mancuernas', 'Empuje', false, true, true, 'Press vertical unilateral con mancuerna, exige estabilidad de core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press de hombro a un brazo' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Step-up con mancuerna', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Subida a banco o cajón con mancuernas, una pierna impulsa el ascenso.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Step-up con mancuerna' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Peso muerto rumano a una pierna', 'Pierna', 'Mancuernas', 'Bisagra', false, true, true, 'RDL a una pierna, equilibrio y activación unilateral de isquiotibiales.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Peso muerto rumano a una pierna' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevación lateral unilateral', 'Hombro', 'Mancuernas', 'Aislamiento', false, false, true, 'Elevación lateral con un brazo, aísla el deltoides medio.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevación lateral unilateral' AND user_id IS NULL);

-- 4) Pliometría ---------------------------------------------------------------
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto al cajón', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Salto explosivo a un cajón o plataforma, ambas piernas.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto al cajón' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto al cajón lateral', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Salto lateral a un cajón, trabaja estabilizadores de cadera.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto al cajón lateral' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla con salto', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Sentadilla con salto vertical al final del recorrido, potencia de tren inferior.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla con salto' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto de longitud', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Salto horizontal a máxima distancia desde parado, potencia y aterrizaje.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto de longitud' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Saltos skater', 'Pierna', 'Peso corporal', 'Pliometría', false, true, true, 'Saltos laterales alternos aterrizando a una pierna, tipo patinador.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Saltos skater' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto en profundidad', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Caída desde un cajón seguida de salto vertical inmediato, pliometría avanzada.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto en profundidad' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Burpees', 'Cardio', 'Peso corporal', 'Pliometría', true, true, true, 'Sentadilla, plancha, flexión y salto vertical encadenados, cardio de alta intensidad.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Burpees' AND user_id IS NULL);
