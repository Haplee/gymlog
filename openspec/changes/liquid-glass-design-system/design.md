# Diseño — Liquid Glass

> **Estado:** borrador para la puerta **G1**. Nada de esto se aplica a una pantalla de
> producción hasta que el usuario lo apruebe.
> **Base medida:** `docs/spikes/liquid-glass-spike.md` (Fase 0).
> **Lo medido y lo estimado van separados** — ver §10.

---

## 1. Qué es el material

Un vidrio no se reconoce porque deje ver lo que hay detrás. Se reconoce por **cómo le da
la luz**: un canto que brilla arriba, una caída de luz hacia abajo, y un borde que define
sin encerrar. Lo de «ver a través» es la parte cara y, resulta, la prescindible.

Ese es todo el argumento del sistema. El material se construye con:

| Ingrediente          | Token                  | Qué hace                          |
| -------------------- | ---------------------- | --------------------------------- |
| Base casi opaca      | `--glass-1/2/3`        | Da cuerpo. 88–96 % en oscuro      |
| Canto superior       | `--glass-edge-top`     | La luz entra por arriba           |
| Canto lateral        | `--glass-edge`         | Define sin encerrar               |
| Brillo interior      | `--glass-sheen`        | 1 px de luz por dentro del borde  |
| Caída de luz         | `--glass-veil`         | Degradado que evita el rectángulo |
| Sombra por capa      | `--glass-shadow-1/2/3` | Separa del fondo                  |
| Difuminado de scroll | `--glass-fade`         | Lo que sustituye al blur          |

Todos existen ya en `src/shared/styles/tokens.css`, en los dos temas, y las utilidades
`.glass-1/2/3` en `src/index.css`.

**El canto es asimétrico a propósito.** El borde superior va al 18 % y los laterales al
6 %. Un canto uniforme se lee como caja; uno asimétrico se lee como material con una
fuente de luz. Es la diferencia entre un rectángulo con borde y algo que parece tener
grosor.

---

## 2. Las tres capas: cuándo usar cada una

La pregunta que el sistema tiene que responder sin consultar otro componente es «¿qué
capa le toca a esto?». La respuesta es siempre **por función, nunca por aspecto**:

| Capa      | Función                                | Ejemplos                                        | Sombra  |
| --------- | -------------------------------------- | ----------------------------------------------- | ------- |
| `glass-1` | Contenido. Agrupa, no eleva.           | Fondos de sección, contenedores de lista        | Ninguna |
| `glass-2` | Elevado. Es una unidad que se toca.    | Tarjetas de ejercicio, KPIs, filas de ajustes   | Mínima  |
| `glass-3` | Flotante. Va **encima** del contenido. | Header, bottom nav, FAB, modales, bottom sheets | Marcada |

**Regla dura: no se anidan capas del mismo nivel.** Una tarjeta `glass-2` dentro de otra
`glass-2` es la señal de que la jerarquía está mal, no de que haga falta una capa nueva.
Si hace falta separar dentro de una tarjeta, se usa un borde o espaciado, no otra capa.

**Regla dura: `glass-3` es la única capa por la que pasa contenido por debajo.** Las
otras dos se apoyan en el fondo. Esto importa para el contraste (§4).

---

## 3. Por qué no hay `backdrop-filter`

No es una renuncia estética, es el resultado de dos medidas que se refuerzan.

**Contraste.** Con el acento pasando por debajo de una superficie translúcida, un velo
blanco **no alcanza AA a ningún nivel de opacidad**. No es ajustable: es aritmética de
composición alpha. Para que el texto sobreviva hace falta subir el velo al 85 %, y a esa
opacidad el blur que hay detrás ya no se ve — pero sigue costando frames en cada uno.

**Rendimiento.** Este proyecto ya probó el blur en Android en julio, midió el jank y lo
quitó (`BottomSheet.tsx:8-13`). El plan original proponía reintroducirlo en header y
bottom nav _fijos_, que es un caso peor que el ya descartado: esos elementos están en
pantalla siempre, no solo al abrir un sheet.

**Y el material sin blur no cuesta nada.** Medido en una Galaxy Tab A7 (Android 12, gama
media-baja de 2020): 384 frames, **1 janky (0,26 %)**, p99 11 ms.

**Excepción única permitida:** superficies efímeras **sin texto encima** —el velo oscuro
detrás de un modal— vía `@supports`, como mejora progresiva. Nunca bajo texto, nunca en
chrome permanente.

---

## 4. El presupuesto de luz: canto sí, área no

Esta es la regla que más decisiones resuelve, y sale de una medición concreta.

El acento **lo elige el usuario**: `accents.ts` define 24. Medido el peor caso sobre los
24 × 3 capas, con el degradado aplicado:

| Velo blanco | Peor contraste | AA 4,5 |
| ----------- | -------------- | ------ |
| 0,05        | 4,20:1         | ❌     |
| **0,02**    | **4,59:1**     | ✅     |

Lo que rompe el AA **no es la translucidez** — esa misma capa sin velo da 4,93:1 — sino
aclarar el área. Y el único texto en riesgo es `--text-tertiary`, que nace justo en el
filo del AA (6,23:1 sobre el canvas); `primary` y `secondary` van por encima de 7,9:1.

**De ahí la regla: la luz se gasta en el canto, no en el área.** Aclarar 1 px de borde no
toca el contraste porque nadie pone texto sobre 1 px de borde; aclarar toda la superficie
sí. Por eso el velo bajó a 0,02 y esa luz se recuperó en `edge-top` (0,18) y `sheen`
(0,11).

**Consecuencia operativa:** cualquier acento nuevo en `accents.ts` obliga a rehacer esta
cuenta. El techo es 0,027.

### Texto sobre vidrio

| Texto              | Sobre `glass-1/2/3`                | Nota                                               |
| ------------------ | ---------------------------------- | -------------------------------------------------- |
| `--text-primary`   | Libre                              | ≥10,4:1 en el peor caso                            |
| `--text-secondary` | Libre                              | ≥7,9:1                                             |
| `--text-tertiary`  | **Permitido pero es el que manda** | 4,59:1. Cualquier cambio del velo lo rompe primero |

En **tema claro** el peor caso de los 24 es 5,63:1 y no requiere restricción.

---

## 5. El difuminado de borde de scroll

Es la pieza que sustituye perceptualmente al blur, y la única del sistema que **no se
juzga en una captura**: hay que hacer scroll para verla.

Cuando el contenido pasa por debajo del chrome flotante, en vez de cortarse en seco se
disuelve en una franja. Esa disolución es la señal que da el `backdrop-filter` —«hay algo
ahí abajo»— pero pintada **una sola vez** en lugar de remuestrear el backdrop en cada
frame.

**Corrección pendiente del prototipo:** la franja mide hoy `--space-6` (24 px) y en la
tablet **apenas se lee**. La estimación es que necesita el doble, ~48 px, para hacer su
trabajo. Se ajusta y se vuelve a mirar en dispositivo antes de fijar el valor.

Va en el **borde de scroll**, no en el borde del elemento: solo donde algo se desplaza por
debajo de algo. Un contenedor que no scrollea no lleva franja.

---

## 6. Iconos

**Un único punto de import: `@shared/components/icons`.** Ningún componente vuelve a
importar de `reicon-react` ni de `lucide-react` directamente. Es lo que convierte «cambiar
de librería de iconos» en tocar un fichero en vez de 68 — y es la salida si algún día hay
que vendorizar.

Conviven dos familias a propósito:

- **Reicon** para todo lo generalista. Outline por defecto; Filled (`weight`) solo para
  estado activo, seleccionado o destacado. 24 px estándar, 20 px en chips y filas densas.
- **`Icon*` propios** para lo de dominio (máquinas, equipamiento, ♂/♀). Ninguna librería
  generalista los cubre. Se redibujan al grid 24×24 / trazo 1,5 px de Reicon para que se
  lean como la misma familia.

Cobertura medida: **93,9 %** (77 de 82) con equivalente directo. Los 5 sin equivalente
(`Brain`, `Footprints`, `Bot`, `CloudOff`, `GripVertical`) afectan a 7 ficheros y se
resuelven con sustituto o dibujo propio.

**Presupuesto:** el criterio original de «< 40 KB gzip» quedó anulado en G0 por haberse
fijado sin línea base. Lo sustituye: **el chunk de entrada no crece más de 25 KB gzip**,
que es lo que se descarga siempre. A verificar en el bloque F.

**Emojis usados como iconos** (`PermissionRequests.tsx`, `UserStatsPage.tsx`,
`WorkoutActionBar.tsx`) pasan a iconos del sistema: un emoji lo dibuja la fuente del
sistema, así que ni respeta el acento ni se ve igual en dos dispositivos.

---

## 7. Movimiento

`prefers-reduced-motion` **ya está bien resuelto** (`App.tsx` con `reducedMotion="user"`
para Framer Motion, más dos bloques CSS). No se toca.

Lo que falta son las **curvas**: hay ~16 animaciones con nombre en `index.css` y todas
usan `ease-out` pelado con la duración escrita a mano en el shorthand, sin pasar por los
`--anim-duration-*` que ya existen.

Se añaden tokens de curva y se conectan las duraciones existentes:

| Token               | Uso                                       |
| ------------------- | ----------------------------------------- |
| `--ease-standard`   | Lo que entra y sale dentro de la pantalla |
| `--ease-decelerate` | Lo que aparece (entra rápido, se posa)    |
| `--ease-accelerate` | Lo que desaparece (sale de escena)        |
| `--ease-spring`     | Lo que responde al dedo (sheets, swipe)   |

Regla: **lo que responde al dedo usa muelle; lo que solo informa usa curva.** Un bottom
sheet arrastrable se mueve como algo con masa; un toast que aparece, no.

---

## 8. Deuda del reskin que se limpia aquí

| Qué                                                     | Por qué ahora                                              |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `--accent-violet: #ffd93d`, `--accent-fuchsia: #ffb74d` | Los nombres mienten. Se renombran por su función           |
| Comentario de `:root.light` describiendo «Stitch» verde | Documenta un esquema que no existe desde julio             |
| ~14 alias de compatibilidad hacia atrás                 | Se purgan los que no tengan uso real (verificado con grep) |
| `CLAUDE.md` dice acento menta `#60eca8`                 | Es el acento de antes del reskin                           |

Se hace en este cambio porque tocar los tokens sin limpiarlos deja el fichero peor: la
mitad renombrada y la mitad no.

---

## 9. Orden de migración y estimación

**Principio: por bloques verificables, no de una vez.** Cada bloque termina con
`lint + type-check + test` en verde y comprobación en dispositivo en los dos temas.

| Bloque | Qué                                                             | Ficheros aprox. | Tamaño estimado | Riesgo   |
| ------ | --------------------------------------------------------------- | --------------- | --------------- | -------- |
| **A**  | Tokens: limpieza + curvas de movimiento                         | 3               | Pequeño         | Bajo     |
| **B**  | Las 16 primitivas de `ui/` + 3 de `fitbody/`                    | 19              | **Grande**      | Medio    |
| **C**  | Chrome: header, bottom nav, FAB, modales, sheets                | ~6              | Mediano         | **Alto** |
| **D**  | Pantallas densas: Historial, Stats de usuario, Rutinas, Ajustes | 4               | **Grande**      | Medio    |
| **E**  | Pantallas restantes (11)                                        | ~11             | Mediano         | Bajo     |
| **F**  | Barrido de iconos + desinstalar `lucide-react`                  | 68              | **Grande**      | Medio    |
| **G**  | Verificación final, `CLAUDE.md`, bundle                         | —               | Pequeño         | Bajo     |

**Estimación global: 7 bloques, de los cuales 3 son grandes.** El orden no es negociable
en dos puntos:

- **B antes que C/D/E.** Migrar pantallas antes que primitivas obliga a repasarlas
  después, porque la primitiva cambia debajo.
- **F al final.** El barrido de iconos toca 68 ficheros; hacerlo antes significa
  resolver conflictos con todos los bloques posteriores.

**El bloque C es el de más riesgo** aunque sea de los pequeños: header y bottom nav son
`glass-3` fijos en todas las pantallas, tocan `safe-area` y `--header-height` /
`--bottom-nav-height`, y un fallo ahí se ve en las 15 pantallas a la vez.

### Qué puede desviar la estimación

1. **Los 90 ficheros con clases de superficie.** El recuento por pantalla es de la
   auditoría parcial; la dispersión real por pantalla no está hecha (Fase 1 incompleta).
2. **La densidad móvil no está verificada.** Ver §10.
3. **Las 5 sustituciones de iconos sin equivalente** pueden requerir dibujar SVG, que es
   trabajo de otro tipo al del resto del barrido.

---

## 10. Qué está medido y qué es estimación

Esta separación importa para saber de qué fiarse.

**Medido, con cifra y método:**

- Rendimiento del material sin blur: 0,26 % janky, p99 11 ms (Galaxy Tab A7, `gfxinfo`).
- Contraste sobre los 24 acentos × 3 capas × 2 temas (fórmula WCAG 2.1).
- Cobertura de iconos: 93,9 % (77/82).
- Coste en bundle de Reicon: +53,2 KB gzip frente a lucide.
- Recuentos: 82 iconos, 68 ficheros, 16 + 3 primitivas, 15 pantallas, 90 ficheros con
  clases de superficie.

**Estimación, no verificado:**

- El tamaño de cada bloque de §9 y el orden de riesgo.
- Que la franja de scroll necesita ~48 px en vez de 24.
- El crecimiento del chunk de entrada (< 25 KB gzip) — se comprueba en el bloque F.
- Que las 5 sustituciones de iconos «son de bajo impacto»: es un juicio por número de
  ficheros, no por importancia de la pantalla.

**No verificado y con un límite conocido:** la única pantalla real vista en dispositivo es
el prototipo `/fitbody`, y **en una tablet a 800 px lógicos, no a los ~390 px del móvil**.
El material (color, capas, canto) se juzga bien ahí; **la densidad, los objetivos táctiles
y el ajuste a 390 px, no**. Antes de dar por buena la migración hace falta pasar por un
teléfono.

---

## 11. Cómo se verifica cada bloque

1. `npm run lint && npm run type-check && npm run test` en verde.
2. Comprobación en dispositivo **en los dos temas** — el modo claro es requisito, no
   añadido.
3. Objetivos táctiles ≥ 44 px y layout a ~390 px de ancho.
4. `safe-area`, `--header-height` y `--bottom-nav-height` intactos.
5. Cero hex en JSX (las excepciones siguen siendo `stats/constants.ts` y
   `shared/constants/`).
6. Cero literales de texto en JSX: todo por i18next.
