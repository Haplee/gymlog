-- ============================================================
-- SEED EJERCICIOS FALTANTES DEL CATÁLOGO PÚBLICO
-- ------------------------------------------------------------
-- Inserta TODOS los ejercicios referenciados en:
--   * 20260804120000_exercise_descriptions.sql
--   * 20260804123000_exercise_descriptions_personal.sql
--   * scripts/seed-rutinas.mjs (CATALOGO_REQUERIDO)
--   * scripts/maintenance/update-routines.mjs
--   * src/features/routine/stores/routineStore.ts (PREDEFINED_ROUTINES)
-- que NO están en 20261120130000_restore_exercises_table.sql
-- Idempotente: WHERE NOT EXISTS (name, user_id IS NULL)
-- Respeta CHECK constraints: muscle_group, equipment, movement, load_type
-- ============================================================

SET local check_function_bodies = off;

-- ============================================================
-- HELPER: Función para normalizar nombres (case-insensitive dedup)
-- ============================================================
-- Los INSERT usan WHERE NOT EXISTS (SELECT 1 FROM public.exercises
-- WHERE name = 'Nombre Exacto' AND user_id IS NULL)
-- así que el nombre EXACTO (con mayúsculas/acentos) debe coincidir.

-- ============================================================
-- PIERNA
-- ============================================================

-- Sentadilla (base)
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla', 'Pierna', 'Barra', 'Sentadilla', true, true, true, 'Sentadilla trasera con barra, bajada controlada y subida explosiva.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla' AND user_id IS NULL);

-- Sentadilla Parcial
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sentadilla Parcial', 'Pierna', 'Barra', 'Sentadilla', true, true, true, 'Sentadilla recortada a un recorrido corto, cargas altas y énfasis en la salida.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sentadilla Parcial' AND user_id IS NULL);

-- Sentadilla frontal (ya existe en migración anterior como 'Sentadilla frontal')
-- Zancadas / Zancada caminando (ya existe 'Zancada caminando')
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Zancadas', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Zancadas alternas estáticas o caminando con mancuernas.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Zancadas' AND user_id IS NULL);

-- Prensa / Prensa de piernas
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Prensa', 'Pierna', 'Máquina', 'Sentadilla', true, true, true, 'Prensa de piernas en máquina, empuje con los pies en plataforma.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Prensa' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Prensa de piernas', 'Pierna', 'Máquina', 'Sentadilla', true, true, true, 'Prensa de piernas en máquina 45°, recorrido completo controlado.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Prensa de piernas' AND user_id IS NULL);

-- Peso muerto rumano (ya existe)
-- Peso muerto rumano a una pierna (ya existe)

-- Curl femoral sentado (ya existe)
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl femoral de pie', 'Pierna', 'Máquina', 'Aislamiento', true, false, true, 'Flexión de rodilla de pie en máquina, isquiotibiales.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl femoral de pie' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl femoral tumbado', 'Pierna', 'Máquina', 'Aislamiento', true, false, true, 'Flexión de rodilla tumbado boca abajo en máquina, isquiotibiales.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl femoral tumbado' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Femoral sentado', 'Pierna', 'Máquina', 'Aislamiento', true, false, true, 'Curl femoral sentado en máquina, isquiotibiales con cadera flexionada.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Femoral sentado' AND user_id IS NULL);

-- Curl Nórdico / Curl femoral nórdico
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl Nórdico', 'Pierna', 'Peso corporal', 'Aislamiento', true, false, true, 'Flexión de rodilla excéntrica con los tobillos fijados, isquiotibiales.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl Nórdico' AND user_id IS NULL);

-- Elevación de gemelos / Gemelos de pie / Gemelos sentado
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Gemelos de pie', 'Pierna', 'Mancuernas', 'Aislamiento', true, false, true, 'Extensión de tobillo de pie con mancuernas, pausa en estiramiento.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Gemelos de pie' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Gemelos sentado', 'Pierna', 'Máquina', 'Aislamiento', true, false, true, 'Extensión de tobillo sentado en máquina, sóleo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Gemelos sentado' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevación de gemelos de pie', 'Pierna', 'Mancuernas', 'Aislamiento', true, false, true, 'Extensión de tobillo de pie con mancuernas o barra, gemelos.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevación de gemelos de pie' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevación gemelos', 'Pierna', 'Mancuernas', 'Aislamiento', true, false, true, 'Extensión de tobillo para gemelos.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevación gemelos' AND user_id IS NULL);

-- Abducción de cadera
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Abducción de cadera', 'Pierna', 'Máquina', 'Aislamiento', false, false, true, 'Abducción de cadera en máquina, glúteo medio y tensor fascia lata.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Abducción de cadera' AND user_id IS NULL);

-- Cajón step lateral
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Cajón step lateral', 'Pierna', 'Peso corporal', 'Pliometría', false, true, true, 'Subida lateral a cajón alternando piernas, potencia y estabilidad.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Cajón step lateral' AND user_id IS NULL);

-- ============================================================
-- Pliometría / Potencia
-- ============================================================

-- Drop Jumps / Salto en profundidad
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Drop Jumps', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Caída desde cajón de 30-40 cm y rebote vertical inmediato minimizando tiempo de contacto.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Drop Jumps' AND user_id IS NULL);

-- Broad Jumps / Salto de longitud
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Broad Jumps', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Salto horizontal máximo con impulso de brazos y aterrizaje estable.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Broad Jumps' AND user_id IS NULL);

-- Pogo Jumps
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Pogo Jumps', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Saltos reactivos continuos usando solo tobillo, rodillas casi bloqueadas.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Pogo Jumps' AND user_id IS NULL);

-- Saltos skater
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Saltos skater', 'Pierna', 'Peso corporal', 'Pliometría', false, true, true, 'Saltos laterales alternos aterrizando a una pierna, tipo patinador.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Saltos skater' AND user_id IS NULL);

-- Salto con carga
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto con carga', 'Pierna', 'Mancuernas', 'Pliometría', true, true, true, 'Jump squat con mancuernas o barra ligera (15-25% 1RM). Salto vertical máximo con reset de 2 seg.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto con carga' AND user_id IS NULL);

-- Salto con gomas
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto con gomas', 'Pierna', 'Bandas', 'Pliometría', true, true, true, 'Salto vertical asistido/resistido con bandas elásticas.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto con gomas' AND user_id IS NULL);

-- Salto lateral a una pierna con frenada
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Salto lateral a una pierna con frenada', 'Pierna', 'Peso corporal', 'Pliometría', false, true, true, 'Salto lateral explosivo de una pierna a otra clavando la recepción 2 segundos.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Salto lateral a una pierna con frenada' AND user_id IS NULL);

-- Sprints cortos 10m
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Sprints cortos 10m', 'Pierna', 'Peso corporal', 'Pliometría', true, true, true, 'Aceleración máxima desde salida parada en 10 metros con recuperación completa.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Sprints cortos 10m' AND user_id IS NULL);

-- ============================================================
-- PECHO
-- ============================================================

-- Press banca (ya existe)
-- Press banca inclinado (ya existe)
-- Press banca declinado (ya existe)

-- Press Banca Parcial
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press Banca Parcial', 'Pecho', 'Barra', 'Empuje', true, true, true, 'Press de banca recortado a la fase superior o media, cargas altas.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press Banca Parcial' AND user_id IS NULL);

-- Press Banca mancuernas / Press banca mancuernas / Press con mancuernas
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press banca mancuernas', 'Pecho', 'Mancuernas', 'Empuje', true, true, true, 'Press de banca plano con mancuernas, mayor rango de movimiento.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press banca mancuernas' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press con mancuernas', 'Pecho', 'Mancuernas', 'Empuje', true, true, true, 'Press plano con mancuernas, recorrido completo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press con mancuernas' AND user_id IS NULL);

-- Press inclinado con mancuernas
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press inclinado con mancuernas', 'Pecho', 'Mancuernas', 'Empuje', true, true, true, 'Press en banco inclinado 30° con mancuernas, pecho superior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press inclinado con mancuernas' AND user_id IS NULL);

-- Press Arnold
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press Arnold', 'Hombro', 'Mancuernas', 'Empuje', true, true, true, 'Press con rotación de agarre (neutro a prono), hombro completo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press Arnold' AND user_id IS NULL);

-- Aperturas / Aperturas con mancuernas / Aperturas en polea
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Aperturas', 'Pecho', 'Mancuernas', 'Aislamiento', true, false, true, 'Aperturas con mancuernas: abre los brazos en arco amplio y vuelve juntándolos.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Aperturas' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Aperturas con mancuernas', 'Pecho', 'Mancuernas', 'Aislamiento', true, false, true, 'Aperturas en banco plano con mancuernas, arco amplio controlado.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Aperturas con mancuernas' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Aperturas en polea', 'Pecho', 'Polea', 'Aislamiento', true, false, true, 'Cruces en poleas altas o bajas, tensión constante en pectoral.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Aperturas en polea' AND user_id IS NULL);

-- Contractora / Contractora Inclinada
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Contractora', 'Pecho', 'Máquina', 'Aislamiento', true, false, true, 'Contractora: juntar los brazos hacia el centro contra la resistencia, foco en pectoral.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Contractora' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Contractora Inclinada', 'Pecho', 'Máquina', 'Aislamiento', true, false, true, 'Contractora en banco inclinado: misma apertura-cierre de brazos en inclinación, parte alta del pecho.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Contractora Inclinada' AND user_id IS NULL);

-- Pájaros
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Pájaros', 'Pecho', 'Mancuernas', 'Aislamiento', true, false, true, 'Aperturas inversas en banco inclinado o plano, foco en pectoral y deltoides posterior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Pájaros' AND user_id IS NULL);

-- ============================================================
-- ESPALDA
-- ============================================================

-- Dominadas / Dominada cerradas
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Dominadas', 'Espalda', 'Peso corporal', 'Tirón', true, true, true, 'Cuelga de la barra, sube hasta que la barbilla pase la barra.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Dominadas' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Dominada cerradas', 'Espalda', 'Peso corporal', 'Tirón', true, true, true, 'Dominadas con agarre cerrado (supino/neutro), mayor implicación de bíceps.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Dominada cerradas' AND user_id IS NULL);

-- Jalón al pecho (ya existe)
-- Jalón al pecho cerrado
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Jalón al pecho cerrado', 'Espalda', 'Máquina', 'Tirón', true, true, true, 'Jalón al pecho con agarre cerrado (neutro/supino), dorsales y bíceps.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Jalón al pecho cerrado' AND user_id IS NULL);

-- Jalón abierto / Jalón abierto (máquina )
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Jalón abierto', 'Espalda', 'Máquina', 'Tirón', true, true, true, 'Jalón en máquina con agarre ancho, barra al pecho, dorsales.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Jalón abierto' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Jalón abierto (máquina )', 'Espalda', 'Máquina', 'Tirón', true, true, true, 'Jalón en máquina con agarre ancho, barra al pecho.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Jalón abierto (máquina )' AND user_id IS NULL);

-- Jalón cerrado (polea) / jalón cerrado (polea)
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Jalón cerrado (polea)', 'Espalda', 'Polea', 'Tirón', true, true, true, 'Jalón en polea alta con agarre cerrado, barra al pecho.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Jalón cerrado (polea)' AND user_id IS NULL);

-- Jalones cueda
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Jalones cueda', 'Espalda', 'Polea', 'Tirón', true, true, true, 'Jalones en polea con cuerda: tira hacia el pecho separando las puntas al final.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Jalones cueda' AND user_id IS NULL);

-- Remo con barra (ya existe)
-- Remo a una mano (ya existe)

-- Remo con mancuerna
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo con mancuerna', 'Espalda', 'Mancuernas', 'Tirón', false, true, true, 'Remo a una mano apoyado en banco con mancuerna.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo con mancuerna' AND user_id IS NULL);

-- Remo de pie / Remo de pie bilateral
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo de pie', 'Espalda', 'Barra', 'Tirón', true, true, true, 'Remo de pie con barra, torso inclinado 45°, tirón a cadera.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo de pie' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo de pie bilateral', 'Espalda', 'Barra', 'Tirón', true, true, true, 'Remo de pie con ambos brazos, tira la barra al abdomen.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo de pie bilateral' AND user_id IS NULL);

-- Remo en polea baja
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo en polea baja', 'Espalda', 'Polea', 'Tirón', true, true, true, 'Remo sentado en polea baja, agarre neutro, tirón al abdomen.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo en polea baja' AND user_id IS NULL);

-- Remo máquina
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo máquina', 'Espalda', 'Máquina', 'Tirón', true, true, true, 'Remo en máquina de pecho apoyado, tirón horizontal.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo máquina' AND user_id IS NULL);

-- Remo unilat / Remo unilateral / Remo unilateral máquina
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo unilat', 'Espalda', 'Mancuernas', 'Tirón', false, true, true, 'Remo unilateral con mancuerna apoyado en banco.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo unilat' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo unilateral', 'Espalda', 'Mancuernas', 'Tirón', false, true, true, 'Remo unilateral apoyado en banco, un brazo por serie.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo unilateral' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Remo unilateral máquina', 'Espalda', 'Máquina', 'Tirón', false, true, true, 'Remo unilateral en máquina, trabaja un lado a la vez con agarre neutro.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Remo unilateral máquina' AND user_id IS NULL);

-- Pull Over / Pull Over en polea alta
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Pull Over', 'Espalda', 'Mancuernas', 'Aislamiento', true, false, true, 'Pull over con mancuerna: tumbado en banco, lleva la carga por encima de la cabeza hasta detrás del pecho.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Pull Over' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Pull Over en polea alta', 'Espalda', 'Polea', 'Aislamiento', true, false, true, 'Pull over en polea alta: brazos semi-extendidos, llevando la barra/cuerda hacia los muslos.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Pull Over en polea alta' AND user_id IS NULL);

-- Polea tras-nuca
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Polea tras-nuca', 'Espalda', 'Polea', 'Tirón', true, true, true, 'Jalón en polea alta llevando la barra detrás de la cabeza, espalda alta.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Polea tras-nuca' AND user_id IS NULL);

-- Power Clean / Power Snatch (ya existen)

-- ============================================================
-- HOMBRO
-- ============================================================

-- Press militar (ya existe)
-- Press de hombro a un brazo (ya existe)

-- Press Pallof / Pallof Press (ya existe como 'Press Pallof')
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Pallof Press', 'Core', 'Polea', 'Core', false, false, true, 'Empuje horizontal contra la rotación de la polea, antirrotación de core.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Pallof Press' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Press pallof gomas', 'Core', 'Bandas', 'Core', false, false, true, 'Pallof press con banda elástica, antirrotación.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Press pallof gomas' AND user_id IS NULL);

-- Elevaciones laterales (ya existe)
-- Elevaciones frontales
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevaciones frontales', 'Hombro', 'Mancuernas', 'Aislamiento', true, false, true, 'Elevación frontal con mancuernas, deltoides anterior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevaciones frontales' AND user_id IS NULL);

-- Elevaciones disco / Elevaciones
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevaciones disco', 'Hombro', 'Otro', 'Aislamiento', true, false, true, 'Elevación frontal con un disco sujeto con ambas manos, deltoides anterior.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevaciones disco' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevaciones', 'Hombro', 'Mancuernas', 'Aislamiento', true, false, true, 'Elevaciones laterales o frontales con mancuernas.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevaciones' AND user_id IS NULL);

-- Face Pull / Face pull (ya existe como 'Face Pull')
-- Rotación externa con goma / Rotación externa de hombro en polea
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Rotación externa de hombro en polea', 'Hombro', 'Polea', 'Aislamiento', false, false, true, 'Rotación externa del hombro en polea a 90° abducción, manguito rotador.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Rotación externa de hombro en polea' AND user_id IS NULL);

-- Levantamiento balón medicinal / Lanzamientos
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Lanzamiento balón', 'Core', 'Otro', 'Empuje', false, false, true, 'Lanzamiento de balón medicinal con empuje de pecho o por encima de la cabeza.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Lanzamiento balón' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Lanzamiento balón medicinal pecho', 'Pierna', 'Otro', 'Empuje', true, true, true, 'Pase de pecho explosivo contra pared con balón de 4-5 kg.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Lanzamiento balón medicinal pecho' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Lanzamiento balón medicinal unilateral', 'Pierna', 'Otro', 'Empuje', false, true, true, 'Lanzamiento explosivo a una mano simulando gesto de tiro.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Lanzamiento balón medicinal unilateral' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Lanzamiento con goma y peso', 'Pierna', 'Bandas', 'Empuje', false, true, true, 'Extiende el hombro o empuja contra la banda con carga adicional.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Lanzamiento con goma y peso' AND user_id IS NULL);

-- ============================================================
-- BRAZOS - BÍCEPS
-- ============================================================

-- Curl bíceps (ya existe como 'Curl bíceps')
-- Curl bíceps barra / Curl bíceps barra sentado / Curl con barra Z
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl bíceps barra', 'Bíceps', 'Barra', 'Aislamiento', true, false, true, 'Curl de bíceps con barra recta, agarre supino.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl bíceps barra' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl bíceps barra sentado', 'Bíceps', 'Barra', 'Aislamiento', true, false, true, 'Curl de bíceps con barra sentado: codos apoyados o libres, sube sin balanceo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl bíceps barra sentado' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl con barra Z', 'Bíceps', 'Barra', 'Aislamiento', true, false, true, 'Curl de bíceps con barra Z (EZ), agarre ergonómico para muñecas.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl con barra Z' AND user_id IS NULL);

-- Curl bíceps mancuerna / Curl Bíceps mancuerna (ya existe como 'Curl bíceps')
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl bíceps mancuerna', 'Bíceps', 'Mancuernas', 'Aislamiento', true, false, true, 'Curl de bíceps con mancuernas: codos fijos al cuerpo, supinación al subir.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl bíceps mancuerna' AND user_id IS NULL);

-- Curl Bíceps Polea Cuerda / Curl en polea baja
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl Bíceps Polea Cuerda', 'Bíceps', 'Polea', 'Aislamiento', true, false, true, 'Curl de bíceps en polea baja con cuerda: codos fijos, sube y separa las puntas.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl Bíceps Polea Cuerda' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl en polea baja', 'Bíceps', 'Polea', 'Aislamiento', true, false, true, 'Curl de bíceps en polea baja con barra o cuerda, tensión constante.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl en polea baja' AND user_id IS NULL);

-- Curl Bíceps maquina
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl Bíceps maquina', 'Bíceps', 'Máquina', 'Aislamiento', true, false, true, 'Curl de bíceps en máquina: siéntate, apoya los codos y flexiona contra la resistencia.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl Bíceps maquina' AND user_id IS NULL);

-- Curl Bíceps barra+Antebrazos
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl Bíceps barra+Antebrazos', 'Bíceps', 'Barra', 'Aislamiento', true, false, true, 'Curl de bíceps con barra incluyendo la musculatura del antebrazo en el recorrido.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl Bíceps barra+Antebrazos' AND user_id IS NULL);

-- Curl martillo / Curl martillo polea / Martillo
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl martillo', 'Bíceps', 'Mancuernas', 'Aislamiento', true, false, true, 'Curl martillo con mancuernas: agarre neutro, sube sin rotar, bíceps y braquiorradial.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl martillo' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl martillo polea', 'Bíceps', 'Polea', 'Aislamiento', true, false, true, 'Curl martillo en polea: agarre neutro, sube la cuerda o barra sin rotar.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl martillo polea' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Martillo', 'Bíceps', 'Mancuernas', 'Aislamiento', true, false, true, 'Curl martillo con mancuernas: agarre neutro, sube sin rotar, trabaja bíceps y braquiorradial.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Martillo' AND user_id IS NULL);

-- Curl predicador
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Curl predicador', 'Bíceps', 'Máquina', 'Aislamiento', true, false, true, 'Curl predicador: apoya el tríceps en el banco, flexiona el codo sin levantar el brazo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Curl predicador' AND user_id IS NULL);

-- ============================================================
-- BRAZOS - TRÍCEPS
-- ============================================================

-- Extensiones tríceps / Extensión tríceps / Tríceps polea
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Extensiones tríceps', 'Tríceps', 'Polea', 'Aislamiento', true, false, true, 'Extensiones de tríceps en polea alta: codos pegados, extiende hacia abajo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Extensiones tríceps' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Extensión tríceps', 'Tríceps', 'Polea', 'Aislamiento', true, false, true, 'Extensión de tríceps en polea alta con barra o cuerda.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Extensión tríceps' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Tríceps polea', 'Tríceps', 'Polea', 'Aislamiento', true, false, true, 'Extensión de tríceps en polea alta con agarre prono o neutro.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Tríceps polea' AND user_id IS NULL);

-- Extensión de tríceps en polea / Extensión de tríceps tras-nuca
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Extensión de tríceps en polea', 'Tríceps', 'Polea', 'Aislamiento', true, false, true, 'Con cuerda o agarre V, codos pegados al torso, extiende hacia abajo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Extensión de tríceps en polea' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Extensión de tríceps tras-nuca', 'Tríceps', 'Mancuernas', 'Aislamiento', true, false, true, 'Extensión de tríceps por detrás de la cabeza: codos fijos apuntando arriba.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Extensión de tríceps tras-nuca' AND user_id IS NULL);

-- Tríceps cuerda
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Tríceps cuerda', 'Tríceps', 'Polea', 'Aislamiento', true, false, true, 'Tríceps con cuerda: en polea alta, extiende y separa las puntas al final.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Tríceps cuerda' AND user_id IS NULL);

-- Tríceps en poleas Plano / Tríceps en poleas V
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Tríceps en poleas Plano', 'Tríceps', 'Polea', 'Aislamiento', true, false, true, 'Tríceps en polea con barra plana: codos pegados, extiende los antebrazos hacia abajo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Tríceps en poleas Plano' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Tríceps en poleas V', 'Tríceps', 'Polea', 'Aislamiento', true, false, true, 'Tríceps en polea con barra en V: codos pegados, extiende hacia abajo con agarre cerrado.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Tríceps en poleas V' AND user_id IS NULL);

-- Tríceps tras-nuca
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Tríceps tras-nuca', 'Tríceps', 'Mancuernas', 'Aislamiento', true, false, true, 'Extensión de tríceps por detrás de la cabeza con mancuerna o barra.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Tríceps tras-nuca' AND user_id IS NULL);

-- Patada de tríceps / Patada trasera en polea
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Patada de tríceps', 'Tríceps', 'Mancuernas', 'Aislamiento', false, false, true, 'Patada de tríceps a una mano: codo fijo, extiende el brazo hacia atrás.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Patada de tríceps' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Patada trasera en polea', 'Tríceps', 'Polea', 'Aislamiento', false, false, true, 'Patada de tríceps en polea baja, codo fijo al cuerpo.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Patada trasera en polea' AND user_id IS NULL);

-- Press francés (ya existe)
-- Fondos en paralelas / Fondos en banco
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Fondos en paralelas', 'Tríceps', 'Peso corporal', 'Empuje', true, true, true, 'Fondos en paralelas: baja hasta 90° y sube, tríceps y pecho inferior.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Fondos en paralelas' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Fondos en banco', 'Tríceps', 'Peso corporal', 'Empuje', true, true, true, 'Fondos en banco: manos en el borde, baja flexionando codos y sube.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Fondos en banco' AND user_id IS NULL);

-- Kaz Press
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Kaz Press', 'Tríceps', 'Barra', 'Empuje', true, true, true, 'Kaz press: press de hombros por encima de la cabeza con barra, foco en tríceps y hombro.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Kaz Press' AND user_id IS NULL);

-- ============================================================
-- CORE
-- ============================================================

-- Plancha / Plancha lateral (ya existen)
-- Crunch abdominal / Crunches / Crunch polea
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Crunch abdominal', 'Core', 'Peso corporal', 'Core', true, false, true, 'Crunches: tumbado boca arriba, eleva los hombros contrayendo el abdomen.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Crunch abdominal' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Crunches', 'Core', 'Peso corporal', 'Core', true, false, true, 'Crunches: tumbado boca arriba, eleva los hombros contrayendo el abdomen, espalda baja pegada al suelo.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Crunches' AND user_id IS NULL);

INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Crunch polea', 'Core', 'Polea', 'Core', true, false, true, 'Crunch en polea alta: arrodilla y flexiona el tronco contra la resistencia.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Crunch polea' AND user_id IS NULL);

-- Oblicuos
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Oblicuos', 'Core', 'Peso corporal', 'Core', true, false, true, 'Ejercicios para oblicuos: rotaciones, plancha lateral, etc.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Oblicuos' AND user_id IS NULL);

-- Rueda abdominal
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Rueda abdominal', 'Core', 'Otro', 'Core', true, false, true, 'Extensión de tronco con rueda abdominal manteniendo retroversión pélvica.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Rueda abdominal' AND user_id IS NULL);

-- Russian twist
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Russian twist', 'Core', 'Mancuernas', 'Core', true, false, true, 'Rotación de tronco sentado con mancuerna o balón medicinal, oblicuos.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Russian twist' AND user_id IS NULL);

-- Leñador en polea (ya existe)

-- Paseo del granjero
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Paseo del granjero', 'Core', 'Mancuernas', 'Core', true, true, true, 'Caminata pesada con mancuernas o kettlebells, postura erguida y agarre firme.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Paseo del granjero' AND user_id IS NULL);

-- Haka
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Haka', 'Core', 'Peso corporal', 'Core', true, true, true, 'Haka: zancadas amplias con braceo rítmico, activación de cadena posterior y core.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Haka' AND user_id IS NULL);

-- Elevación de piernas
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Elevación de piernas', 'Core', 'Peso corporal', 'Core', true, false, true, 'Elevación de piernas colgado en barra o en paralelas, core inferior.', true, 'bodyweight'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Elevación de piernas' AND user_id IS NULL);

-- ============================================================
-- ANTEBRAZO
-- ============================================================

-- Antebrazo Polea
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Antebrazo Polea', 'Antebrazo', 'Polea', 'Aislamiento', true, false, true, 'Flexión de muñeca en polea baja: apoya el antebrazo y sube la muñeca contra la resistencia.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Antebrazo Polea' AND user_id IS NULL);

-- ============================================================
-- GLÚTEO
-- ============================================================

-- Hip Thrust / Hip thrust (ya existe como 'Hip thrust')

-- ============================================================
-- CARDIO / OTROS
-- ============================================================

-- Búlgaras (Sentadilla búlgara ya existe)
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Búlgaras', 'Pierna', 'Mancuernas', 'Sentadilla', false, true, true, 'Sentadilla búlgara: una pierna delante y el pie trasero apoyado en banco.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Búlgaras' AND user_id IS NULL);

-- Push Press
INSERT INTO public.exercises (name, muscle_group, equipment, movement, is_bilateral, is_compound, is_public, description, is_bodyweight, load_type)
SELECT 'Push Press', 'Pierna', 'Barra', 'Empuje', true, true, true, 'Ligero impulso de rodilla y cadera para acelerar la barra por encima de la cabeza.', false, 'external'
WHERE NOT EXISTS (SELECT 1 FROM public.exercises WHERE name = 'Push Press' AND user_id IS NULL);

-- ============================================================
-- BACKFILL: exercise_muscles (primary 100% para nuevos ejercicios)
-- ============================================================
INSERT INTO public.exercise_muscles (exercise_id, muscle_group, role, weight)
SELECT e.id, e.muscle_group, 'primary', 100
FROM public.exercises e
LEFT JOIN public.exercise_muscles em ON em.exercise_id = e.id
WHERE em.id IS NULL
  AND e.user_id IS NULL;

-- ============================================================
-- DESCRIPCIONES IDEMPOTENTES (de migraciones previas)
-- ============================================================
-- 20260804120000_exercise_descriptions.sql
UPDATE public.exercises SET description = 'Aperturas: con mancuernas o poleas, abre los brazos en arco amplio y vuelve juntándolos, foco en pectoral.' WHERE name = 'Aperturas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Aperturas con mancuernas: en banco plano, abre los brazos en arco controlado y vuelve a juntarlos.' WHERE name = 'Aperturas con mancuernas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Aperturas en polea: cruces de polea alta a baja, tensión constante en pectoral.' WHERE name = 'Aperturas en polea' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Crunches: tumbado boca arriba, eleva los hombros contrayendo el abdomen, espalda baja pegada al suelo.' WHERE name = 'Crunches' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Elevaciones disco: eleva un disco frente al pecho o hacia los lados trabajando hombro y antebrazo.' WHERE name = 'Elevaciones disco' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Tríceps cuerda: en polea alta con cuerda, extiende los antebrazos hacia abajo y separa las puntas al final.' WHERE name = 'Tríceps cuerda' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl martillo con mancuernas: agarre neutro, sube sin rotar, trabaja bíceps y braquiorradial.' WHERE name = 'Martillo' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo de pie: tira de la barra o polea hacia el abdomen de pie, torso ligeramente inclinado, espalda y dorsal.' WHERE name = 'Remo de pie' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press banca declinado (Decline): banco en declive, bajada al pecho bajo y empuje hacia arriba, foco en pecho inferior.' WHERE name = 'Press banca Decline' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press inclinado: press con mancuernas o barra en banco inclinado, foco en la parte alta del pecho.' WHERE name = 'Press inclinado' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensiones de cuádriceps en máquina: extiende la rodilla contra la resistencia sin levantar la cadera.' WHERE name = 'Extensiones cuádriceps' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensiones de cuádriceps en máquina: extiende la rodilla contra la resistencia sin levantar la cadera.' WHERE name = 'Extensiones de cuádriceps' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensión de tríceps en polea: con cuerda o agarre V, codos pegados al torso.' WHERE name = 'Extensión de tríceps en polea' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensión de tríceps tras-nuca: estiramiento completo de la cabeza larga del tríceps.' WHERE name = 'Extensión de tríceps tras-nuca' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Face Pull: tirón hacia la frente con rotación externa final para deltoides posterior y manguito.' WHERE name = 'Face Pull' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press banca parcial: recorre solo la fase media o superior del press, carga mayor o recuperación.' WHERE name = 'Press Banca Parcial' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Pull over: tumbado en banco, lleva la carga por encima de la cabeza hasta detrás del pecho, dorsal y pecho.' WHERE name = 'Pull over' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Pull over: tumbado en banco, lleva la carga por encima de la cabeza hasta detrás del pecho, dorsal y pecho.' WHERE name = 'Pull Over' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Peso muerto rumano: bisagra de cadera con piernas semi-rígidas, énfasis en isquiotibiales y glúteo.' WHERE name = 'Peso muerto rumano' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Zancadas: zancadas alternas con mancuernas, una pierna cada paso.' WHERE name = 'Zancadas' AND (description IS NULL OR description = '');

-- 20260804123000_exercise_descriptions_personal.sql
UPDATE public.exercises SET description = 'Flexión de muñeca en polea baja: apoya el antebrazo y sube la muñeca contra la resistencia, trabaja el antebrazo.' WHERE name = 'Antebrazo Polea' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Sentadilla búlgara: una pierna delante y el pie trasero apoyado en banco, baja en vertical y sube con la pierna delantera.' WHERE name = 'Búlgaras' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Contractora: juntar los brazos hacia el centro contra la resistencia, foco en pectoral.' WHERE name = 'Contractora' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Contractora en banco inclinado: misma apertura-cierre de brazos en inclinación, parte alta del pecho.' WHERE name = 'Contractora Inclinada' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl de bíceps con barra sentado: codos apoyados o libres, sube la barra sin balanceo y baja controlado.' WHERE name = 'Curl Bíceps barra sentado' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl de bíceps con barra incluyendo la musculatura del antebrazo en el recorrido.' WHERE name = 'Curl Bíceps barra+Antebrazos' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl de bíceps con mancuernas: codos fijos al cuerpo, supinación al subir.' WHERE name = 'Curl Bíceps mancuerna' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl de bíceps en máquina: siéntate, apoya los codos y flexiona contra la resistencia.' WHERE name = 'Curl Bíceps maquina' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl de bíceps en polea baja con cuerda: codos fijos, sube y separa las puntas apretando el bíceps.' WHERE name = 'Curl Bíceps Polea Cuerda' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl martillo en polea: agarre neutro, sube la cuerda o barra sin rotar, bíceps y antebrazo.' WHERE name = 'Curl martillo polea' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Curl predicador: apoya el tríceps en el banco, flexiona el codo contra la resistencia sin levantar el brazo.' WHERE name = 'Curl predicador' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Dominadas con agarre cerrado: sube con las manos juntas, mayor implicación de bíceps.' WHERE name = 'Dominada cerradas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Elevaciones: sube los brazos hacia los lados o al frente con mancuernas o disco, hombro.' WHERE name = 'Elevaciones' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Haka: zancadas amplias con braceo rítmico, activación de cadena posterior y core.' WHERE name = 'Haka' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Jalón en máquina de polea alta: agarre ancho, baja la barra al pecho llevando los codos a los costados.' WHERE name = 'Jalón abierto (máquina )' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Jalón al pecho con agarre cerrado: baja la barra al pecho con los codos pegados al cuerpo.' WHERE name = 'Jalón al pecho cerrado' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Jalón en polea alta con agarre cerrado: baja la barra al pecho, espalda y dorsal.' WHERE name = 'jalón cerrado (polea)' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Jalones en polea con cuerda: tira de la cuerda hacia el pecho separando las puntas al final.' WHERE name = 'Jalones cueda' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Kaz press: press de hombros por encima de la cabeza con barra, foco en tríceps y hombro.' WHERE name = 'Kaz Press' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Lanzamiento de balón medicinal: lanza el balón con empuje de pecho o por encima de la cabeza, potencia.' WHERE name = 'Lanzamiento balón' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Lanzamiento con goma y peso: extiende el hombro o empuja contra la banda con carga adicional.' WHERE name = 'Lanzamiento con goma y peso' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Polea tras-nuca: jalón en polea alta llevando la barra detrás de la cabeza, espalda alta.' WHERE name = 'Polea tras-nuca' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press de banca con mancuernas: tumbado, baja las mancuernas al pecho y empuja hacia arriba.' WHERE name = 'Press Banca mancuernas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press de banca con mancuernas: tumbado, baja las mancuernas al pecho y empuja hacia arriba.' WHERE name = 'Press banca mancuernas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo de pie con ambos brazos: tira la barra o polea al abdomen de pie, espalda y dorsal.' WHERE name = 'Remo de pie bilateral' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo en máquina: sentado, tira del agarre hacia el abdomen con el pecho apoyado, dorsal.' WHERE name = 'Remo máquina' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo unilateral: tira con un brazo apoyado en banco, dorsal y espalda media.' WHERE name = 'Remo unilat' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo unilateral en máquina: trabaja un lado a la vez con agarre neutro, dorsal.' WHERE name = 'Remo unilateral máquina' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Tríceps en polea con barra plana: codos pegados, extiende los antebrazos hacia abajo.' WHERE name = 'Tríceps en poleas Plano' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Tríceps en polea con barra en V: codos pegados, extiende hacia abajo con agarre cerrado.' WHERE name = 'Tríceps en poleas V' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensión de tríceps por detrás de la cabeza: codos fijos apuntando arriba, baja la carga tras la nuca y extiende.' WHERE name = 'Tríceps tras-nuca' AND (description IS NULL OR description = '');

-- ============================================================
-- SYNC load_type / is_bodyweight coherentes
-- ============================================================
UPDATE public.exercises
SET load_type = 'bodyweight', is_bodyweight = true
WHERE load_type = 'external'
  AND (
    LOWER(name) LIKE '%dominad%' OR LOWER(name) LIKE '%pull%up%' OR LOWER(name) LIKE '%chin%up%'
    OR LOWER(name) LIKE '%muscle%up%' OR LOWER(name) LIKE '%fondo%' OR LOWER(name) LIKE '%flexion%'
    OR LOWER(name) LIKE '%flexión%' OR LOWER(name) LIKE '%push%up%' OR LOWER(name) LIKE '%plancha%'
    OR LOWER(name) LIKE '%abdominal%' OR LOWER(name) LIKE '%crunch%' OR LOWER(name) LIKE '%burpee%'
    OR LOWER(name) LIKE '%l-sit%' OR LOWER(name) LIKE '%elevación de piernas%' OR LOWER(name) LIKE '%elevacion de piernas%'
    OR LOWER(name) LIKE '%salto%' OR LOWER(name) LIKE '%sentadilla con salto%' OR LOWER(name) LIKE '%salto al caj%'
    OR LOWER(name) LIKE '%curl nórdico%' OR LOWER(name) LIKE '%plancha lateral%' OR LOWER(name) LIKE '%drop jump%'
    OR LOWER(name) LIKE '%broad jump%' OR LOWER(name) LIKE '%pogo jump%' OR LOWER(name) LIKE '%skater%'
    OR LOWER(name) LIKE '%sprint%' OR LOWER(name) LIKE '%rueda abdominal%' OR LOWER(name) LIKE '%russian twist%'
    OR LOWER(name) LIKE '%haka%' OR LOWER(name) LIKE '%elevación de piernas%' OR LOWER(name) LIKE '%oblicuos%'
  );

UPDATE public.exercises
SET is_bodyweight = (load_type <> 'external')
WHERE is_bodyweight <> (load_type <> 'external');

-- ============================================================
-- NOTIFICAR A POSTGREST
-- ============================================================
NOTIFY pgrst, 'reload schema';