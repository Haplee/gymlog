## Context

El cambio `liquid-glass-design-system` dejó el material bien especificado y bien aplicado.
Lo que no dejó resuelto es el **reparto del contraste**: midió el peor caso de los 24
acentos, vio que el texto terciario se caía del AA, y respondió bajando la luz en todas
partes (velo a 0,02 con techo 0,027). Es una optimización local correcta cuyo efecto
global nadie midió: la jerarquía se quedó sin presupuesto.

Mediciones sobre los tokens actuales (`tokens.css`, tema oscuro):

```
canvas   #0a0a0b  L = 0,00306
surface  #141416  L = 0,00707   canvas → surface   1,076:1
surface2 #1c1b1e  L = 0,01120   surface → surface2 1,073:1
surface3 #2a2a2b  L = 0,02315
texto primario sobre canvas                        15,38:1
```

Toda la estructura ocupa el 2,3 % inferior de la escala. Las sombras (`rgba(0,0,0,0.3)`)
son negras sobre un canvas casi negro: no existen. Sin `backdrop-filter`, correctamente.

**El hallazgo que ordena el resto.** Ningún borde ni canto del sistema alcanza el 3:1 que
WCAG 2.2 §1.4.11 (Non-text Contrast) pide a un límite visual que transmite información:

| Token              | Valor                   | Sobre canvas |
| ------------------ | ----------------------- | ------------ |
| `--border-subtle`  | `#232326`               | 1,263:1      |
| `--border-default` | `#3a3a40`               | 1,752:1      |
| `--glass-edge`     | blanco 6 % → `#19191a`  | 1,126:1      |
| `--glass-edge-top` | blanco 18 % → `#363637` | 1,639:1      |

Matiz, para no exagerar el hallazgo: 1.4.11 no obliga a un borde puramente decorativo
cuyo contenido se entiende igual sin él. Pero **sí** obliga en dos casos que aquí se dan.
(1) Los bordes de inputs, botones y controles son componentes de interfaz y están
cubiertos sin discusión — el formulario de login los tiene a 1,26:1. (2) Cuando la
superficie no separa por sí sola (1,076:1), el borde deja de ser decorativo y pasa a ser
la única señal de que ahí hay un objeto. En ambos casos el suelo es 3:1 y no se cumple.

## Goals / Non-Goals

**Goals:**

- Separación canvas → superficie perceptible y medida, sin bajar de AA en el texto **ni en
  el peor de los 24 acentos** (lime `#cbf24c`), en los dos temas.
- Bordes de controles interactivos a ≥3:1 (WCAG 1.4.11).
- Tres capas de material distinguibles entre sí, no solo del fondo.
- Elevación visible en la capa 3 sobre un canvas casi negro.
- Composición revisada en las seis pantallas de más uso: espacios muertos, densidad,
  ritmo tipográfico.
- Un método reproducible: un script que recalcula todos los suelos al tocar un token, para
  que la próxima persona no tenga que rehacer estas cuentas a mano.

**Non-Goals:**

- Cambiar la dirección visual (FitBody, oscuro por defecto, acento elegible). No es un
  reskin nuevo.
- Reintroducir `backdrop-filter`. La decisión de quitarlo se midió dos veces (jank en el
  WebView Android en julio, contraste en la puerta G0) y sigue siendo correcta.
- Tocar `--bg-canvas`. Arrastra `capacitor.config.ts`, `index.html` y el manifest PWA, y
  no hace falta: lo que sube son las superficies, no el fondo.
- Cambiar los 24 presets de `accents.ts`.

## Decisions

### 1. Aclarar `--text-tertiary` es el primer movimiento, no el último

Es contraintuitivo pero es la llave. Con `--text-tertiary` en `#869489`, el techo de
luminancia de una superficie que aún mantenga sus 4,5:1 es **L = 0,02345** — y el suelo
para separarse del canvas a 1,25:1 es **L = 0,01632**. La ventana entera mide 0,0071 de
luminancia: **cabe un nivel de superficie, no tres.** `--bg-surface-3` (#2a2a2b, L =
0,0232) ya está pegado al techo. La escala está saturada; por eso el cambio anterior no
tenía sitio donde poner la jerarquía y acabó gastándolo todo en el canto.

Aclarar el terciario a `#a1afa4` sube el techo a L = 0,05204 y multiplica la ventana por
5 (0,0357). El coste es cero: su contraste sobre el canvas **mejora** de 6,23:1 a 8,65:1.
Es el token que estaba estrangulando el sistema, y estaba estrangulándolo desde el lado
en el que no dolía mirarlo.

### 2. Escala de superficies derivada, no elegida a ojo

La escala se construye **desde arriba**, no desde abajo: el techo lo marca la superficie
más clara, porque es la que tiene que seguir sosteniendo el AA del texto terciario. Con el
terciario en `#a1afa4` ese techo está en L = 0,05204 (≈ `#404040`), y los tres niveles se
reparten por debajo.

Se probaron tres escalas y se llevaron las tres a la puerta G1 con capturas, porque la
diferencia entre ellas no es de corrección —las tres pasan la auditoría entera— sino de
carácter: cuánto deja de ser negro el tema oscuro. **El usuario eligió la C.**

| Token            | Antes     | A          | B          | **C (aplicada)** |
| ---------------- | --------- | ---------- | ---------- | ---------------- |
| `--bg-canvas`    | `#0a0a0b` | sin cambio | sin cambio | sin cambio       |
| `--bg-surface`   | `#141416` | `#1c1c1f`  | `#232327`  | **`#26262b`**    |
| `--bg-surface-2` | `#1c1b1e` | `#26262a`  | `#2e2e33`  | **`#313137`**    |
| `--bg-surface-3` | `#2a2a2b` | `#323237`  | `#3a3a40`  | **`#3c3c42`**    |
| canvas → surface | 1,076:1   | 1,164:1    | 1,264:1    | **1,314:1**      |

Con la C los saltos consecutivos quedan en 1,314 / 1,165 / 1,180, y el texto terciario
sobre la superficie más clara aún da 4,79:1 contra un suelo de 4,50. Sigue habiendo
margen, pero poco: la siguiente vuelta ya no cabe sin volver a tocar el terciario.

Aun así **la superficie no es el único portador de la jerarquía**: el borde tiene que
acompañarla. Esa es la decisión 3.

### 3. El canto sube a 3:1 donde es funcional, y se queda donde es decorativo

La regla heredada «la luz se gasta en el canto, no en el área» era correcta y se mantiene.
Lo que se corrige es haberla leído como «solo en el canto», con el canto además puesto
demasiado bajo para verse.

- **Bordes de controles** (inputs, botones secundarios, chips, switches, campos de
  formulario): suelo duro de 3:1. Sobre el canvas eso es blanco al ~35 % (`#606060`);
  sobre `--bg-surface` nuevo, ~`#676767`. Se introduce `--border-interactive` para esto,
  en vez de subir `--border-default` y arrastrar con él bordes que no lo necesitan.
- **Canto del material** (`--glass-edge`, `--glass-edge-top`): sube, pero no a 3:1. Aquí
  el borde acompaña a una superficie que ya separa, así que su trabajo es definir la
  forma, no probar que existe. Valor a fijar en la fase de medición, con el peor acento
  por debajo.

### 4. Sobre negro, la elevación no la da la sombra: la da el halo

Una sombra negra sobre `#0a0a0b` es matemáticamente invisible; no hay nada más oscuro que
poner. Para la capa 3 (header, bottom nav, FAB, modales, sheets) la profundidad se
construye al revés: un **halo de contacto claro** en el canto superior más un
oscurecimiento del contenido que pasa por debajo — que es justo lo que ya hace
`--glass-fade`, hoy infrautilizado. La sombra negra se conserva solo en el tema claro,
donde sí funciona.

### 5. La composición se audita con la app en marcha, no leyendo JSX

Los problemas que el usuario nota —tercio inferior vacío en el login, densidad, ritmo—
no son visibles en el código. Esta parte del trabajo **depende de tener sesión**: todas
las rutas salvo `/login` están tras `ProtectedRoute` (`App.tsx:117`). Requiere
`E2E_EMAIL` / `E2E_PASSWORD` en `.env.local`. Hasta entonces la fase 3 no puede empezar,
y las fases 1 y 2 sí.

### 6. Un script, no una hoja de cálculo mental

Todas las cifras de este documento salen de la misma aritmética WCAG. Se deja en
`scripts/contrast-audit.mjs`, ejecutable con `npm run audit:contrast`, leyendo los tokens
reales de `tokens.css` y los 24 presets de `accents.ts`, y devolviendo exit ≠ 0 si algún
suelo se rompe. Así el próximo cambio de tokens no vuelve a requerir un análisis a mano
para saber si rompió algo.

## Risks / Trade-offs

- **Aclarar las superficies sube el consumo en pantallas OLED.** Real pero pequeño: el
  canvas, que es la mayor parte del área, no se toca. Solo suben las tarjetas.
- **Un tema oscuro con superficies más claras se percibe como «menos negro».** Es
  exactamente el cambio que se busca, pero es un cambio de carácter y hay que verlo antes
  de darlo por bueno. Por eso las fases 1-2 se aprueban con capturas antes de tocar la
  composición.
- **El peor acento manda sobre el resto.** Optimizar para lime `#cbf24c` deja los 23
  restantes con margen de sobra, es decir, más apagados de lo que podrían estar. Es el
  precio de que el acento sea elegible; la alternativa (suelos por acento) multiplica la
  complejidad del sistema por 24 y no se contempla.
- **`--text-tertiary` toca muchísimos sitios.** Es el token de más alcance del cambio. El
  riesgo no es de contraste (mejora en todos los casos) sino de peso visual: texto
  secundario que hoy se retira del paso pasará a pedir algo más de atención. Hay que
  mirarlo en las pantallas densas (historial, estadísticas), no solo en las vacías.
- **El emulador miente sobre el brillo y el color.** El fallo original es justo del tipo
  que un emulador a brillo máximo esconde. La verificación final va en el dispositivo
  real (`R9TR308HG0J`, la Galaxy Tab que ya se usó para medir la franja de scroll).
