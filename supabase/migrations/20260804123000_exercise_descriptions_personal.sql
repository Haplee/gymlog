-- ============================================================
-- Descripciones de ejercicios personales del usuario
-- ------------------------------------------------------------
-- Nombres exactos (con mayúsculas, acentos, espacios y
-- paréntesis) que no coincidían con la migración previa.
-- Idempotente: solo toca filas con description vacía/NULL.
-- Se omiten los ejercicios de prueba (E2E Test, Triviales,
-- Máquina Rara).
-- ============================================================

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
UPDATE public.exercises SET description = 'Press de banca con mancuernas: tumbado, baja las mancuernas al pecho y empuja hacia arriba.' WHERE name = 'Press banca mancuernas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press de banca con mancuernas: tumbado, baja las mancuernas al pecho y empuja hacia arriba.' WHERE name = 'Press Banca mancuernas' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Press de banca parcial: recorre solo la fase media o superior del press, carga mayor o recuperación.' WHERE name = 'Press Banca Parcial' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Pull over: tumbado en banco, lleva la carga por encima de la cabeza hasta detrás del pecho, dorsal y pecho.' WHERE name = 'Pull over' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Pull over: tumbado en banco, lleva la carga por encima de la cabeza hasta detrás del pecho, dorsal y pecho.' WHERE name = 'Pull Over' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo de pie con ambos brazos: tira la barra o polea al abdomen de pie, espalda y dorsal.' WHERE name = 'Remo de pie bilateral' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo en máquina: sentado, tira del agarre hacia el abdomen con el pecho apoyado, dorsal.' WHERE name = 'Remo máquina' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo unilateral: tira con un brazo apoyado en banco, dorsal y espalda media.' WHERE name = 'Remo unilat' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Remo unilateral en máquina: trabaja un lado a la vez con agarre neutro, dorsal.' WHERE name = 'Remo unilateral máquina' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Tríceps en polea con barra plana: codos pegados, extiende los antebrazos hacia abajo.' WHERE name = 'Tríceps en poleas Plano' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Tríceps en polea con barra en V: codos pegados, extiende hacia abajo con agarre cerrado.' WHERE name = 'Tríceps en poleas V' AND (description IS NULL OR description = '');
UPDATE public.exercises SET description = 'Extensión de tríceps por detrás de la cabeza: codos fijos apuntando arriba, baja la carga tras la nuca y extiende.' WHERE name = 'Tríceps tras-nuca' AND (description IS NULL OR description = '');
