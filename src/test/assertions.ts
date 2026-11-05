/**
 * Devuelve `value` garantizando que no es `null` ni `undefined`.
 *
 * Sustituye a la aserción no nula (`!`) en los tests: si el valor falta, el
 * test falla con un mensaje claro en vez de propagar un `undefined` y romper
 * más tarde con un error confuso.
 */
export function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Se esperaba un valor definido, pero llegó ' + String(value));
  }
  return value;
}
