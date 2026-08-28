/**
 * Repeticiones «por lado».
 *
 * No es un modo de registro sino una **bandera sobre el modo**: «por lado» es
 * igualmente cierto de una serie de repeticiones y de un isométrico a una
 * pierna. Por eso vive aparte de `setShape.ts` y no dentro de él.
 *
 * **Lo que se guarda es siempre el total.** Una cifra que a veces significa un
 * lado y a veces los dos es justo lo que hace ilegible el historial a los seis
 * meses: al mirar «12» dentro de medio año no habrá forma de saber si fueron 12
 * o 24. La lectura por lado se deriva al pintar, que es reversible; el dato
 * guardado no lo es.
 */

/**
 * Paso del objetivo de repeticiones.
 *
 * **2 para un ejercicio por lado.** Sumar 1 pondría una repetición en un lado y
 * no en el otro: 16 → 17 significa 8 en una pierna y 9 en la otra, que no es un
 * objetivo que nadie se plantee. La progresión va 16 → 18 → 20.
 */
export function repStep(cfg: { perSide?: boolean } | null | undefined): 1 | 2 {
  return cfg?.perSide === true ? 2 : 1;
}

/**
 * Total a partir de lo que dice el plan.
 *
 * El plan se escribe **por lado** —es lo que el usuario teclea y lo que se
 * imprime: «3 × 12 por lado»— y lo que se registra es el total. La conversión
 * vive aquí y en un solo sitio para que las dos convenciones no se crucen.
 */
export function totalFromPerSide(porLado: number, perSide?: boolean): number {
  return perSide === true ? porLado * 2 : porLado;
}

/**
 * Repeticiones por lado a partir del total, o `null` si el ejercicio no va por
 * lado.
 *
 * **Un total impar da un decimal y eso es correcto**: 15 son 7,5 por lado, que
 * es la forma de decir «los dos lados no fueron iguales». Redondear escondería
 * información real; que salga un «,5» es la señal.
 */
export function perSideCount(total: number, perSide?: boolean): number | null {
  if (perSide !== true) return null;
  if (!Number.isFinite(total)) return null;
  return total / 2;
}

/**
 * Sube un objetivo de repeticiones respetando el paso.
 *
 * Se redondea **hacia arriba** al múltiplo del paso: un objetivo que ya venía
 * impar (porque lo escribió una versión anterior, o porque el ejercicio pasó a
 * ser por lado después) se corrige en la primera subida en vez de arrastrar el
 * impar para siempre.
 */
export function nextRepTarget(actual: number, cfg?: { perSide?: boolean } | null): number {
  const paso = repStep(cfg);
  if (paso === 1) return actual + 1;
  return Math.ceil((actual + 1) / paso) * paso;
}
