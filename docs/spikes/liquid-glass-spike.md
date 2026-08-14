# Spike — Liquid Glass + iconos Reicon (Fase 0)

> **Fecha:** 2026-08-13, ampliado el 2026-08-14 · **Rama:** `spike/liquid-glass`
> **Plan de referencia:** `docs/PLAN_LIQUID_GLASS_REICON.md`
> **Estado:** Fase 0 completada. 0.3/0.4 medidos el 14-ago en una Galaxy Tab A7.

---

## Decisión de la puerta G0 (2026-08-13)

| Punto    | Decisión                                                  |
| -------- | --------------------------------------------------------- |
| Material | **Ámbar confirmado** — Liquid Glass sin `backdrop-filter` |
| Iconos   | **`reicon-react` como dependencia real**, no vendorizado  |

Sobre los iconos, la decisión va contra la recomendación del spike y se toma a
sabiendas: se prefiere la dependencia mantenida (actualizaciones e iconos nuevos
gratis) al SVG congelado en el repo.

**El criterio de «< 40 KB gzip» queda anulado**, porque se fijó sin línea base. La
línea base medida es **1.031 KB gzip en 88 chunks** (`excel` solo son 265 KB). El
+53 KB es **+5,1 % del JS total**, y además no cae entero en la carga inicial: los
iconos viven en 68 ficheros que Vite reparte por los chunks lazy de cada ruta.

Criterio que lo sustituye, a verificar en la Fase 6: **el chunk de entrada no crece
más de 25 KB gzip**. Ahí sí duele, porque es lo que se descarga siempre.

---

## Recomendación (previa a la decisión)

**Puerta G0 → ⚠️ ÁMBAR, y por un motivo distinto al previsto.**

El plan esperaba que el blur cayera por rendimiento. Cae antes: **por contraste**. En el
tema oscuro, un velo blanco translúcido no alcanza AA sobre el acento amarillo a
_ningún_ nivel de opacidad. No es ajustable — es aritmética de composición alpha.

Y la segunda sorpresa: **el paquete `reicon-react` no cabe en el presupuesto de bundle**
(+53 KB gzip frente al límite de 40). Vendorizar deja de ser una mitigación opcional del
riesgo de suministro y pasa a ser obligatorio; hecho así, el delta baja a +22 KB.

---

## Correcciones a las cifras del plan

El plan se escribió sobre estimaciones. Lo medido:

| Métrica                     | Plan decía | Real          | Nota                                           |
| --------------------------- | ---------- | ------------- | ---------------------------------------------- |
| Iconos lucide distintos     | 97         | **82**        | 2 de ellos son el tipo `LucideIcon`, no iconos |
| Ficheros con `lucide-react` | 68         | **68**        | ✅ correcto                                    |
| Usos de `backdrop-blur`     | 0          | **1**         | `BottomSheet.tsx` — ver abajo                  |
| Ficheros `.tsx`             | 114        | **114**       | ✅ correcto                                    |
| Primitivas en `ui/`         | 16         | **18**        |                                                |
| Edad de `reicon-react`      | «1 semana» | **3,5 meses** | creado 2026-05-03, 13 versiones                |

**El dato que más cambia el análisis:** `reicon-react` no es un paquete de una semana. Se
publicó el 2026-05-03 y ha tenido 13 versiones con cadencia regular hasta el 2026-08-06.
Lo que tiene una semana es la versión 1.2.0. El riesgo R1 sigue existiendo (un solo
mantenedor) pero está mal calibrado en el plan.

---

## 0.1 — Instalación ✅

`reicon-react@1.2.0` pinneado sin `^`. Instala limpio, 0 dependencias, `sideEffects: false`,
cada icono en su propio módulo (`icons/*.js`, 2.674 iconos). `npm run type-check` sigue en
verde. 36 MB en `node_modules`, pero eso no llega al bundle (ver 0.5).

## 0.5 — Bundle ❌ FALLA con el paquete tal cual

Medición con esbuild (bundle + minify, React externalizado), set **completo** de la app:

|                          | raw      | gzip        | por icono |
| ------------------------ | -------- | ----------- | --------- |
| lucide-react (77 iconos) | 23,0 KB  | **7,6 KB**  | 101 B     |
| reicon-react (77 iconos) | 196,7 KB | **60,8 KB** | 808 B     |

**Delta: +53,2 KB gzip. Criterio: < 40 KB. ❌**

El tree-shaking _sí_ funciona (196 KB, no 36 MB). El problema es que cada icono Reicon
pesa 8× más que su equivalente lucide, por dos causas concretas:

1. Cada módulo lleva **los dos pesos** (Outline + Filled) aunque solo se use uno.
2. Las rutas tienen **precisión de 5 decimales** (`M4.97475 6.25H5.02525…`) sobre un
   grid de 24×24 px. Los decimales 3.º a 5.º son ruido: describen cambios de
   0,0001 px.

### Qué recupera vendorizar

| Variante                           | raw      | gzip    | delta vs lucide |     |
| ---------------------------------- | -------- | ------- | --------------- | --- |
| Paquete tal cual                   | 193,1 KB | 60,7 KB | +53,1 KB        | ❌  |
| Vendorizado, solo Outline          | 116,5 KB | 40,4 KB | +32,8 KB        | ✅  |
| Vendorizado, Outline a 2 decimales | 90,2 KB  | 29,7 KB | **+22,1 KB**    | ✅  |
| Vendorizado, Outline a 1 decimal   | 77,0 KB  | 23,4 KB | +15,8 KB        | ✅  |

**Recomendación: vendorizar con 2 decimales.** A 24 px, 0,01 px es 1/100 de píxel:
invisible incluso en pantallas 3×. Y resuelve R1 de paso — sin dependencia en el camino
crítico de la UI.

## 0.6 — Cobertura de iconos ✅ PASA

**93,9 %** (77 de 82) con equivalente directo en el catálogo de Reicon. Criterio: ≥ 80 %.

Sin equivalente (5, todos de bajo impacto):

| Icono          | Ficheros | Sustituto propuesto            |
| -------------- | -------- | ------------------------------ |
| `Brain`        | 2        | dibujo propio (feature coach)  |
| `Footprints`   | 2        | `Walk`                         |
| `Bot`          | 1        | `Cpu` o dibujo propio          |
| `CloudOff`     | 1        | `CloudCross`                   |
| `GripVertical` | 1        | dibujo propio (asa de dnd-kit) |

Nombres que **no** coinciden literalmente y hay que mapear a mano: `Pencil`→`Edit`,
`X`→`Xmark`, `Trash2`→`Trash`, `TrendingUp`→`TrendUp`, `Loader2`→`Loader`,
`BarChart3`→`ChartBar`, `Bike`→`Bicycle`, `WavesLadder`→`Swimming`, `SportShoe`→`Run`.

## 0.7 — Contraste ❌ FALLA en oscuro — **este es el hallazgo que decide G0**

Los valores de vidrio que propone el plan, compuestos sobre el fondo real y medidos:

**Tema oscuro, vidrio quieto sobre el canvas:** todo pasa (5,4–14,3:1). Sin problema.

**Tema oscuro, con el acento `#ffd93d` pasando por debajo al hacer scroll** — que es
exactamente lo que el blur existe para mostrar:

| Capa                    | text-primary | text-secondary | text-tertiary |
| ----------------------- | ------------ | -------------- | ------------- |
| `glass-1` (blanco 4 %)  | 1,06:1 ❌    | 1,25:1 ❌      | 2,33:1 ❌     |
| `glass-2` (blanco 7 %)  | 1,05:1 ❌    | 1,26:1 ❌      | 2,35:1 ❌     |
| `glass-3` (blanco 10 %) | 1,04:1 ❌    | 1,28:1 ❌      | 2,37:1 ❌     |

Un velo blanco al 4 % _es_ lo que tenga debajo. No hay margen de ajuste.

**¿Y si se sube la opacidad hasta que pase?** Alpha mínimo para que los tres textos
aguanten ≥ 4,5:1 sobre el acento:

| Velo              | Alpha mínimo                    |
| ----------------- | ------------------------------- |
| Blanco            | **imposible a cualquier alpha** |
| Negro             | 81 %                            |
| Canvas `#0a0a0b`  | 85 %                            |
| Surface `#141416` | 89 %                            |

Al 85 % ya no es vidrio: es una superficie opaca con un tinte. **El blur que hay detrás
es invisible y sigue costando frames.** Ese es el argumento, y no depende de qué
teléfono se use para medirlo.

**Tema claro:** mucho mejor. `glass-3` (92 %) pasa todo; `glass-1` y `glass-2` fallan
solo en `text-tertiary` sobre el peor caso (3,29:1 y 4,44:1). Regla derivada: en claro,
`text-tertiary` no se pone nunca sobre `glass-1`/`glass-2`.

## 0.3 / 0.4 — Rendimiento ✅ PASA (medido el 2026-08-14)

**Dispositivo:** Samsung Galaxy Tab A7 (SM-T505), Android 12, WebView 151, 1200×2000 @
240 dpi. Es gama media-baja de 2020, o sea el hardware que motivó quitar el blur en julio:
si el material aguanta aquí, aguanta en cualquier cosa más nueva.

**Método:** `dumpsys gfxinfo com.android.chrome reset`, 16 swipes de scroll sobre el
prototipo `/fitbody` con las tres capas en pantalla, y volcado al terminar.

| Métrica        | Medido         | Criterio |
| -------------- | -------------- | -------- |
| Frames         | 384            | —        |
| Janky          | **1 (0,26 %)** | < 5 %    |
| p50            | 6 ms           | —        |
| p90            | 7 ms           | —        |
| p99            | **11 ms**      | < 16,7   |
| Missed Vsync   | 1              | —        |
| Slow UI thread | 0              | —        |

El histograma se concentra entre 5 y 7 ms (358 de 384 frames). **El vidrio sin
`backdrop-filter` no cuesta un solo frame**: hay un único frame de 40 ms en toda la
tanda, compatible con el arranque del gesto.

Esto confirma la decisión de G0 por el lado del rendimiento, que era el que faltaba.
La decisión ya se sostenía sola por contraste (0.7), pero ahora hay cifra propia.

**Lo que NO prueba esta medición:** que el blur habría ido mal. No se midió la variante
con `backdrop-filter` porque el ámbar ya estaba decidido y el blur descartado por
contraste. Para eso sigue valiendo la medida de julio, abajo.

**El proyecto ya tenía la respuesta, de julio.** `docs/audits/ANALISIS_LOGICA.md`
§9.4 documenta el problema y `AUDIT_REPORT_2026-07-11.md` línea 98 lo clasifica como
🟡 Media:

> **Backdrop-blur lento en Android:** el uso de `backdrop-filter: blur(4px)` en el fondo
> de los BottomSheets causa pérdidas de frames y retrasos al animar la apertura y cierre
> en WebViews de Android de gama media/baja.

El fix ya está aplicado en `src/shared/components/ui/BottomSheet.tsx:8-13`: en Android se
desactiva el blur y se compensa con un fondo más opaco. Es decir, **este proyecto ya
probó el blur en Android, lo midió, y lo quitó.** El plan proponía volver a introducirlo
en headers y bottom nav fijos, que es un caso peor que el que ya se descartó.

## 0.8 — El acento no es uno, son 24 ❗ corrige a 0.7 (2026-08-14)

**Todo 0.7 se midió contra `#ffd93d`, y eso era insuficiente.** El acento lo elige el
usuario en Ajustes: `src/shared/constants/accents.ts` define **24 presets**, y varios son
más claros que el amarillo. El peor no es el amarillo sino `lime #cbf24c` (luminancia
0,767 frente a 0,712).

Además, 0.7 midió las capas **sin contar el degradado del `::before`**, que en el
material construido va encima y aclara la superficie. Con el velo aplicado, el peor
caso real sobre los 24 acentos × 3 capas:

| Velo blanco | Peor contraste | AA 4,5 |
| ----------- | -------------- | ------ |
| 0,05        | **4,20:1**     | ❌     |
| 0,02        | **4,59:1**     | ✅     |

El techo para mantener 4,5:1 es **0,027**. Se fija en 0,02 para dejar margen.

Dos cosas que conviene no confundir:

1. **El problema no es la translucidez, es el velo.** Esa misma capa sin degradado da
   4,93:1. Lo que rompe el AA es aclarar el área, no dejar pasar el fondo.
2. **El único texto en riesgo es `--text-tertiary`.** Nace justo en el filo del AA
   (6,23:1 sobre el canvas), así que cualquier aclarado lo hunde. `--text-primary` y
   `--text-secondary` se quedan en 10,4:1 y 7,9:1 — no se acercan al límite.

**Regla de diseño que sale de aquí:** el presupuesto de luz se gasta en el **canto**
(`--glass-edge-top`, `--glass-sheen`), no en el **área** (`--glass-veil`). Aclarar 1 px
de borde no toca el contraste del texto; aclarar toda la superficie sí. Por eso al bajar
el velo de 0,05 a 0,02 se subieron edge-top (0,14 → 0,18) y sheen (0,08 → 0,11): el
material conserva la lectura de vidrio sin pagarla en legibilidad. Comprobado en la
tablet con el acento `lavender` puesto.

**Tema claro: no necesita cambio.** Ahí el velo blanco al 60 % lava el acento hacia el
blanco y el texto es oscuro, así que el peor caso de los 24 queda en **5,63:1** (`rose`).

Aplicado en `tokens.css`. Cualquier acento nuevo que se añada a `accents.ts` tiene que
volver a pasar esta cuenta.

---

## Qué implica para las fases siguientes

1. **El material se define sin `backdrop-filter`.** Capas de opacidad, bordes luminosos,
   highlight superior interior y gradientes. Se conserva el lenguaje visual; se elimina
   la propiedad cara. `@supports` como mejora progresiva solo en superficies **efímeras
   y sin texto encima** (el velo del modal, por ejemplo) — nunca bajo texto.
2. **Los tokens `--glass-bg-*` de oscuro del plan hay que rehacerlos.** Los valores
   0,04/0,07/0,10 con velo blanco no son usables. En oscuro el velo tiene que ser
   **oscuro** y alto (≥ 85 %), no blanco y bajo.
3. **Iconos: `reicon-react` como dependencia real.** ~~Vendorizar~~ — la recomendación
   de vendorizar queda **descartada por decisión de la puerta G0** (ver arriba). La capa
   `shared/components/icons/` sigue siendo la buena idea del plan, y es lo que permitiría
   cambiar de opinión más adelante tocando un solo fichero.
4. ~~`reicon-react` se puede desinstalar~~ — no: se queda en runtime.
5. **La Fase 1 (auditoría con capturas) ya no está bloqueada:** hay tablet conectada
   (Galaxy Tab A7 vía adb). Ojo con una diferencia: la tablet da 800 px lógicos de ancho,
   no los ~390 px del móvil, así que las capturas de la Fase 1 no valen tal cual para
   juzgar la densidad móvil.
6. **El velo del vidrio depende de `accents.ts`.** Ver 0.8: 24 acentos, no uno. Si se
   añade un acento más claro que `lime #cbf24c`, hay que recalcular.

---

## Reproducir estas mediciones

Los scripts están en el scratchpad de la sesión, no en el repo. Para rehacerlos:
bundle con `esbuild` (bundle+minify, React externalizado) comparando los mismos N
iconos de cada librería; contraste componiendo alpha sobre el fondo y aplicando la
fórmula WCAG 2.1 de luminancia relativa.
