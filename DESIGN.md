---
version: alpha
name: gymlog-fitbody
description: >-
  GymLog — PWA y app Android de registro de entrenamiento. Sistema "FitBody":
  oscuro por defecto con modo claro completo, acento que elige el usuario entre
  24 presets, y material de 3 capas SIN backdrop-filter. Mobile-first, AAC.
# Este documento NO lleva los valores. La fuente de verdad son los ficheros de
# abajo, y este fichero es el que explica para qué sirve cada uno. Duplicar aquí
# los hex, los cuerpos o los radios solo serviría para que se quedaran
# desfasados en silencio: nada obliga a que dos copias coincidan, y el que lea
# el valor equivocado no se va a entera de comprobarlo.
#
#   src/shared/styles/tokens.css          → color, radio, espacio, elevación
#   src/shared/constants/accents.ts       → los 24 pares de acento (es y dark)
#   src/index.css                         → @theme, escala tipográfica, primitivas
#   .claude/CLAUDE.md                     → reglas del proyecto, con las medidas
#   openspec/changes/recalibrate-fitbody-hierarchy/ → presupuesto de jerarquía
#
# Para cambiar un valor se edita su fichero. Para cambiar una regla, aquí.
tokens:
  color: src/shared/styles/tokens.css
  accents: src/shared/constants/accents.ts
  typography: src/index.css
  shape: src/shared/styles/tokens.css
  spacing: src/shared/styles/tokens.css
  elevation: src/shared/styles/tokens.css
  rules: .claude/CLAUDE.md
---

# GymLog — sistema visual "FitBody"

> **Fuente de verdad: `src/shared/styles/tokens.css`.** Este documento no define
> valores: los describe. Los hex del front matter y los pasos de la escala
> tipográfica son un espejo para poder leer el sistema de un vistazo; el sitio
> donde se edita es el CSS. `src/index.css` es el puente: su bloque `@theme
inline` convierte cada `--token` en una utilidad Tailwind (`--bg-surface` →
> `bg-surface`, `--text-tertiary` → `text-fg-subtle`, `--border-interactive` →
> `border-line-interactive`).

## Overview

Una app de gimnasio que se usa con una mano, de pie, con el móvil sucio y sin
tiempo. Todo lo que no ayude a registrar la siguiente serie sobra.

Tres zooming levels, de fuera adentro:

1. **Primero el acento.** Hay un único acento en pantalla y marca la acción
   principal. Si dos cosas compiten por él, ninguna es principal.
2. **Luego la forma.** Radios generosos y coherentes (píldora en controles,
   tarjeta en superficies). Es lo que hace que dos pantallas parezcan la misma.
3. **Luego el texto.** Cuatro niveles y ninguno más. El terciario se usa solo
   para lo que se puede no leer.

Tono: español de tú, frases cortas, sin jerga de producto. Un estado vacío dice
vacío dice qué hacer, no que no hay nada. Cero emojis como iconos — se dibujan
con la fuente del sistema, no siguen al acento y se ven distintos en dos
dispositivos.

El acento **lo elige el usuario** entre 24 presets. `#ffd93d` es solo el valor
por defecto. El peor caso de contraste de todo el sistema es `lime #cbf24c`, el
más claro de los 24: cualquier color nuevo se mide contra él, no contra el
amarillo.

## Colors

Cuatro rampas, cada una con su trabajo. No se mezclan.

**Superficies (fondo).** Cuatro pasos: `canvas` (la página) · `surface` (una
tarjeta) · `surface-2` (una tarjeta elevada, el interior de un input) ·
`surface-3` (lo más alto: hover, un estado pulsado). En oscuro suben; en claro,
`canvas` es gris y las superficies son casi blancas. La separación la lleva la
superficie, no el borde: hay tres niveles de escalón porque `--text-tertiary`
necesita cuatro niveles por debajo y sigue dando AA.

**Texto.** `primary` para lo que se lee · `secondary` para lo que acompaña ·
`tertiary` para metadatos y lo que se puede no leer · `inverse` para texto
ENCIMA del acento. `tertiary` es el token que fija el techo de toda la escala de
superficies: subir una superficie por encima de su límite rompe su AA. Es el
token con más alcance del sistema, así que es el último que se toca.

**Acento.** `--interactive-primary` como relleno con `--interactive-primary-fg`
encima, y también como color de texto y como canto. En oscuro el acento es
claro y el texto encima es casi negro; en claro es al revés: un amarillo-oliva
oscuro con texto blanco. **No se derivan uno de otro**: cada uno de los 24
presets trae su pareja explícita (`accents.ts`), porque el mismo tono no puede
ser relleno legible y texto legible sobre blanco a la vez.

**Semánticos.** `success` / `warning` / `error` / `info`. Son los únicos colores
que no cambian con el acento, y existen para que un error se lea como error
aunque el acento del usuario sea rojo. Un tipo de aviso se señala por el icono
y por el canto, nunca pintando la superficie entera de color.

**Bordes, dos familias.** `--border-subtle` / `--border-default` para separadores
decorativos: pueden ser discretos. `--border-interactive` para los límites de
un control (input, botón secundario, chip, switch) y solo ahí: WCAG 1.4.11 pide
3:1 a un límite que transmite información, y los otros dos no llegan.

## Typography

Inter para el cuerpo, Space Grotesk para titulares y **cualquier número**, con
cifras tabulares (`tabular`) en datos, contadores y temporizadores: un reloj que
cambia de ancho a cada segundo se lee como reloj roto.

La raíz es 15px. `:root { line-height: 160% }`.

Solo pasos con nombre. Nada de `text-[…]`: un tamaño arbitrario no sube por la
escala y rompe el ritmo en cuanto otro pantalla lo usa.

| Paso                            | Uso                                                                      |
| ------------------------------- | ------------------------------------------------------------------------ |
| `text-2xs` `xs` `sm`            | Metadatos, captions, rótulos de navegación. El límite real está en `sm`. |
| `text-base`                     | Cuerpo y etiquetas de control. El paso por defecto.                      |
| `text-lg` `xl`                  | Subtítulos y títulos de pantalla.                                        |
| `text-2xl`                      | Un titular por pantalla, como mucho.                                     |
| `text-display` / `display-huge` | Números protagonistas: un campo de KG o de reps. Uno por pantalla.       |

`display-huge` se reserva para un contador. Es el paso más grande de la escala y
en un móvil de 360 px ocupa el ancho entero, así que solo cabe uno por pantalla.
No es un título grande: es un dato grande.

## Layout

Rejilla de 4px. `--space-*` va de 4 a 48 y es la única forma de medir espacio;
las utilidades `p-4`, `gap-3`, `space-y-6` salen de ahí porque `--spacing: 4px`
está declarado en el `@theme` (`p-4` son 16px, no los 15px que saldrían del
`0.25rem` por defecto de Tailwind con una raíz de 15px).

**Mobile-first, y el móvil es de 360 a 390px.** Se prueba ahí. En tablet
aparece una columna más, nunca un `min-width` que obligue a hacer scroll
horizontal.

**Objetivo táctil: 44px.** Es un suelo, no una altura de botón. Un control
pequeño que se toca en movimiento lleva la clase `tap-44`, que añade un
pseudo-elemento transparente de 44×44 sin engordar la caja: el círculo de los
`+15 s` sigue midiendo 36px y ocupa 44 para el dedo. Solo para controles con
hueco alrededor — dos `tap-44` a menos de 44px se solapan.

**Aire entre secciones: `--space-10` o más.** Una pantalla con tres bloques
separados por 16px se lee como una lista densa; separados por 40px se lee como
tres cosas. El aire es lo que hace que la pantalla parezca sencilla.

**Ritmo de una pantalla:** título de pantalla → bajada de una línea → contenido.
La bajada dice qué es esto y qué puedes hacer aquí; si necesita dos frases,
probablemente sobra un bloque.

## Elevation & Depth

Material de **3 capas, elegidas por función, nunca por aspecto**:

- `glass-1` — **contenido**: agrupa, no se toca. Sin sombra.
- `glass-2` — **elevado**: una unidad que se toca. Tarjetas, filas.
- `glass-3` — **flotante**: va ENCIMA del contenido. Header, bottom nav, FAB,
  modales, sheets. `glass-3-solid` para lo que tapa en vez de flotar (el cajón).

**No se anidan capas del mismo nivel.** Una `glass-2` dentro de otra `glass-2` es
jerarquía mal puesta, no que falte una capa.

**Sin `backdrop-filter`, y no es una preferencia.** Con el acento por debajo,
ningún velo translúcido alcanza AA; y el blur ya se midió y se quitó en julio por
jank en el WebView de Android. Lo que hace de vidrio el material es base casi
opaca (`--glass-1..3`, ≥88% de opacidad) + canto luminoso asimétrico arriba
(`--glass-edge-top`, la luz entra por arriba) + degradado interno de caída de
luz (`--glass-veil`, con techo medido en 0.027). Quita una de las tres y deja de
leerse como vidrio.

El **canto no puede ir solo.** Aclarar 1px de borde no toca el contraste del
texto; aclarar la superficie entera sí. Por eso el velo tiene techo y el canto
está libre — y por eso la luz de la capa 3 va al halo, no al velo.

**En oscuro no hay sombras: hay halos.** Sobre `--bg-canvas`, un negro al 30%
da 1,0175:1 y al 60% da 1,036, por debajo del umbral de percepción (~1,05). Una
sombra negra ahí no se ve y aun así se pinta en cada frame. La capa 3 usa halo
claro. En tema claro sí se conservan las sombras, y ahí funcionan.

**Chrome a sangre: `glass-flush` + `glass-flush-b/t/r`.** Un borde de cuatro
lados en algo que cruza la pantalla dibuja dos hairlines verticales en los
bordes del móvil.

## Shapes

Cinco pasos, con nombre y valor en `tokens.css`: `sm` · `md` · `card` · `xl` ·
`pill`. El nombre es lo que se escribe en el componente (`rounded-card`,
`rounded-pill`); el número no se escribe nunca a mano.

- **Píldora en todo control**: botón, chip, switch, tab, input, FAB. Un
  interruptor cuadrado se lee como casilla, no como interruptor — lo que dice
  "esto se desliza" es la forma del thumb dentro de una pista redonda.
- **`card` en superficie**: tarjeta, lista, hoja.
- **Círculo en lo que contiene un icono**: `--icon-bg-accent` (14% de acento).

Coherencia por encima de la elección: si un radio se cambia en un sitio, se
cambia en el sistema, no en el componente.

## Components

- **Botón.** Tres variantes de verdad: `primary` (relleno de acento — una sola
  por pantalla), `secondary` (superficie), `ghost` (sin fondo). `danger` solo
  para borrar. Alturas 36 / 44 / 48; 44 es el suelo táctil, `sm` solo para
  acciones terciarias dentro de una tarjeta.
- **Input.** Caja con borde `line-interactive` (3:1), píldora, etiqueta fuera
  arriba. El `underline` es para búsqueda y formularios en línea, no el defecto.
- **Chip / SegmentedControl.** Rellenos, nunca en contorno: el activo con
  acento, el inactivo con superficie. Si un grupo de opciones cabe en una
  píldora (2–4), es un `SegmentedControl`, no una fila de chips.
- **Fila de lista** (`NavRow` / `SettingRow`). Icono de 36px en círculo de
  acento, etiqueta, control a la derecha. Comparten `px-4 py-3.5` a propósito:
  conviven en la misma tarjeta y tienen que leerse como una sola lista.
- **Estado vacío.** Icono de 32px, título, una línea que explica qué hacer, y
  **un** botón primario (dos como mucho). Sin más de un CTA, la descripción no
  repite el título, y el CTA es verbo + sustantivo — nunca "Get Started".
  "Get Started" no dice a dónde lleva; "Crear primera rutina" sí.
- **Iconos.** Todo entra por `@shared/components/icons`. Ningún componente
  importa de `reicon-react` directamente — ese barril es lo que hace que cambiar
  de librería sea tocar un fichero y no 68.

## Do's and Don'ts

**Haz**

- Mide un color nuevo contra `lime #cbf24c` y en los dos temas antes de
  devolverlo. `npm run audit:contrast` es el juez.
- Deja respirar. Un `space-y-6` entre bloques, `--space-10` entre secciones.
- Una acción principal por pantalla, y que se vea sin leer.
- Texto de usuario por i18next, en español de tú.

**No hagas**

- **Ni un hex en un componente.** Si hace falta un color literal, va a
  `tokens.css` o a los ficheros de paleta permitidos
  (`shared/constants/accents.ts`, `shared/constants/muscleColors.ts`,
  `features/stats/constants.ts` — este último solo porque Recharts no resuelve
  `var()` en el `fill` de SVG).
- **No anides capas de vidrio del mismo nivel**, ni añadas `backdrop-filter`.
- No uses `text-[…]`, ni tamaños de paso sueltos.
- No escales tipografía con `vw`, no quites los `--inset-*` de safe-area, y no
  toques `--header-height` / `--bottom-nav-height` sin verificar en Android.
- No inventes una capa de tokens nueva para un caso de uno: si hace falta, es que
  falta una regla de las tres.
- No asumas el amarillo. **El acento lo elige el usuario**, y el peor caso es
  `lime`.
