import type { Transition } from 'framer-motion';

/**
 * Vocabulario de movimiento para framer-motion.
 *
 * Las cuatro curvas ya existían en `tokens.css` y el CSS las usa desde hace
 * tiempo (`index.css` las pasa a `slide-up`, `fade-in`, `scale-in` y compañía).
 * Lo que faltaba era la otra mitad: cada transición de framer-motion escribía su
 * propio muelle a mano. Con once muelles repartidos por la app había nueve
 * valores distintos de `damping` para cinco de rigidez (22, 24, 25, 26, 28, 32,
 * 35, 36 y 38), y `ease: 'easeOut'` escrito en otros nueve sitios. Ninguno de
 * esos números era una decisión: eran el resultado de afinar a ojo un muelle
 * cada vez que se añadía una animación.
 *
 * Aquí se nombran los cuatro usos que el propio `tokens.css` documenta, para que
 * el CSS y el JS digan lo mismo:
 *   MUELLE     responde al dedo (hojas, swipe, píldora de pestaña). Con rebote.
 *   APARECE    entra en escena: rápido y se posa.
 *   SE_MUEVE   cambia de sitio dentro de la pantalla, sin entrar ni salir.
 *   SE_VA      desaparece: arranca suave y se va.
 *
 * La regla que el token deja escrita, y que aquí se respeta: lo que responde al
 * dedo usa muelle; lo que solo informa usa curva.
 *
 * Los cubic-bezier son los mismos números que `tokens.css`, no una copia
 * aproximada, así que una animación CSS y una de framer-motion con la misma
 * intención se mueven igual.
 */

/** Responde al dedo. Rigidez alta y poco rebote: se siente firme, no elástico. */
export const MUELLE: Transition = { type: 'spring', stiffness: 500, damping: 32 };

/** Entra en escena: `--ease-decelerate`. */
export const APARECE: Transition = { duration: 0.2, ease: [0, 0, 0.2, 1] };

/** Cambia de sitio: `--ease-standard`. */
export const SE_MUEVE: Transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };

/** Se va: `--ease-accelerate`. Más corto, porque salir no necesita lucirse. */
export const SE_VA: Transition = { duration: 0.16, ease: [0.4, 0, 1, 1] };

/**
 * Igual que `APARECE` pero con retardo, para listas que entran escalonadas.
 * El paso es de 40 ms: por debajo se lee como un solo bloque, y por encima de
 * 60 ms la última tarjeta de una lista de seis llega tarde y molesta.
 */
export const aparecenEscalonados = (indice: number): Transition => ({
  ...APARECE,
  delay: indice * 0.04,
});
