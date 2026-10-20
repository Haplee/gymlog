/**
 * Qué papel juega un bloque en la pantalla.
 *
 * Nace de un problema medido, no de una preferencia: en las pantallas de datos
 * había 147 `rounded-card` escritas a mano y todas usaban la misma receta. Con
 * todo dibujado igual, nada pesa más que nada y la vista no sabe dónde
 * apoyarse. Es el patrón que `SectionHeader` ya había identificado por el lado
 * del color («cinco secciones por pantalla significaban cinco manchas de
 * acento») pero que seguía intacto por el lado de la superficie.
 *
 * Los tres papeles, y la regla para elegir:
 *   surface  lo que se toca o tiene estado (una tarjeta, una fila accionable).
 *   band     contenido sobre el lienzo, separado por un hilo fino. No es caja.
 *   focus    la cifra que manda en la pantalla. Sin caja y sin hilo.
 *
 * La regla, en una línea: si no se toca ni tiene estado, no es una caja.
 */
export type CardVariant = 'surface' | 'band' | 'focus';

const VARIANTE: Record<CardVariant, string> = {
  surface: 'rounded-card border border-line bg-surface shadow-card p-4',
  band: 'hairline-separator py-4',
  focus: 'pt-2 pb-5',
};

/**
 * La receta de superficie, para quien necesite ponerla en otro elemento.
 *
 * Vive fuera de `Card.tsx` por dos motivos: `react-refresh` solo puede
 * refrescar un fichero que exporte únicamente componentes, y además hay sitios
 * que animan la entrada con `m.div` y no pueden cambiar su etiqueta por
 * `<Card>`. Sin esta función tendrían que volver a escribir la receta a mano,
 * que es justo el problema que la primitiva viene a cerrar.
 */
export const cardClass = (variant: CardVariant = 'surface', className = ''): string =>
  className ? `${VARIANTE[variant]} ${className}` : VARIANTE[variant];
