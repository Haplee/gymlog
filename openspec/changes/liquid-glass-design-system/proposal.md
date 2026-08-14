## Why

GymLog tiene hoy dos sistemas visuales conviviendo sin que ninguno esté escrito. El
reskin «FitBody» (julio) cambió el acento y los radios, pero dejó rastros del esquema
anterior «Stitch»: `--accent-violet` vale `#ffd93d` y `--accent-fuchsia` vale `#ffb74d`
—nombres que mienten sobre su color—, el comentario del bloque `:root.light` sigue
describiendo un esquema menta que ya no existe, y hay ~14 alias de compatibilidad hacia
atrás que nadie ha vuelto a mirar. `CLAUDE.md` documenta un acento menta `#60eca8` que se
sustituyó hace un mes.

El resultado práctico: **no hay forma de responder «¿qué elevación le toca a esto?» sin
leer otro componente y copiarlo.** Las superficies se resuelven caso por caso
—`bg-surface`, `bg-card`, `shadow-card`, `rounded-card` aparecen en **90 ficheros**— y
cada pantalla nueva hereda las decisiones de la que se copió, no de un sistema.

Al mismo tiempo hay dos deudas concretas que conviene resolver en el mismo movimiento:

- **Iconos.** 82 iconos distintos de `lucide-react` repartidos por 68 ficheros, importados
  directamente en cada uno. Cambiar de librería hoy es tocar 68 ficheros.
- **Movimiento.** Las duraciones viven en tokens (`--anim-duration-*`) pero las curvas no,
  y Framer Motion se usa con valores sueltos por componente.

## What Changes

- **Un material con nombre: «Liquid Glass», en tres capas.** `glass-1` contenido,
  `glass-2` elevado, `glass-3` flotante. Sustituye a la mezcla actual de `bg-surface` +
  `shadow-card` decidida a ojo. Los tokens ya están escritos y medidos en
  `tokens.css`; esta propuesta los adopta como sistema.
- **Sin `backdrop-filter`.** Decidido en la puerta G0 sobre medidas, no sobre gusto: en
  oscuro ningún velo blanco alcanza AA con el acento por debajo, y el blur que quedaría
  detrás de una superficie opaca es invisible pero sigue costando frames. El efecto de
  «hay algo pasando por debajo» se consigue con un **difuminado de borde de scroll**.
- **La luz se gasta en el canto, no en el área.** Regla derivada de una medición: aclarar
  1 px de borde no toca el contraste del texto; aclarar toda la superficie sí, y con los
  24 acentos de `accents.ts` rompe el AA.
- **Un único punto de import de iconos.** `@shared/components/icons` reexporta Reicon y
  los SVG propios de dominio. Ningún componente vuelve a importar de la librería.
  `lucide-react` se desinstala al terminar.
- **Tokens de movimiento.** Curvas y duraciones con nombre, y respeto de
  `prefers-reduced-motion` en un solo sitio en vez de por componente.
- **Limpieza de la deuda del reskin.** Renombrar los tokens que mienten, purgar los alias
  sin uso, corregir el comentario obsoleto de `:root.light` y actualizar `CLAUDE.md`.

## Capabilities

### New Capabilities

- `liquid-glass-material`: Sistema de superficies en tres capas con canto luminoso y
  difuminado de borde de scroll, sin `backdrop-filter`, que cumple WCAG AA en los dos
  temas y con cualquiera de los acentos elegibles.

## Impact

- **Código:** `src/shared/styles/tokens.css`, `src/index.css`, las **16 primitivas** de
  `src/shared/components/ui/` y las **3** de `src/shared/components/fitbody/`, los 68
  ficheros que importan `lucide-react`, y las **15 pantallas** de la app.
- **Superficie real de la migración:** 90 ficheros usan clases de superficie.
- **Dependencias:** entra `reicon-react@1.2.0` (pinneado), sale `lucide-react`. Ninguna más.
- **Sin cambios de esquema BD**, sin tocar `database.types.ts`, sin tocar el service worker.
- **Riesgo principal:** es un cambio transversal que toca casi toda la UI. Se mitiga
  migrando por bloques verificables (ver `tasks.md`), no de una vez.

## Non-goals

- **No se rediseña ninguna pantalla.** Cambia el material, no la disposición ni la
  jerarquía. El rediseño de la pantalla de entreno es `redesign-workout-screen`, aparte.
- **No se toca el modo claro como decisión de producto.** Se mantiene completo y se
  verifica en cada bloque; no se degrada a «tema secundario».
- **No se cambia la paleta de acentos** ni se quitan opciones de `accents.ts`.
- **No se introduce ninguna dependencia de animación** nueva: Framer Motion ya está.
