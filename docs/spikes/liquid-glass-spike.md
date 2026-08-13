# Spike — Liquid Glass + iconos Reicon (Fase 0)

> **Fecha:** 2026-08-13 · **Rama:** `spike/liquid-glass`
> **Plan de referencia:** `docs/PLAN_LIQUID_GLASS_REICON.md`
> **Estado:** completado salvo 0.3/0.4 (requieren teléfono conectado)

---

## Recomendación

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

## 0.3 / 0.4 — Rendimiento ⏸️ NO EJECUTADO

Requiere teléfono Android conectado. En el momento del spike: `adb devices` vacío y el
daemon de MobAI (`127.0.0.1:8686`) sin responder.

**Pero el proyecto ya tiene la respuesta medida, de julio.** `docs/audits/ANALISIS_LOGICA.md`
§9.4 documenta el problema y `AUDIT_REPORT_2026-07-11.md` línea 98 lo clasifica como
🟡 Media:

> **Backdrop-blur lento en Android:** el uso de `backdrop-filter: blur(4px)` en el fondo
> de los BottomSheets causa pérdidas de frames y retrasos al animar la apertura y cierre
> en WebViews de Android de gama media/baja.

El fix ya está aplicado en `src/shared/components/ui/BottomSheet.tsx:8-13`: en Android se
desactiva el blur y se compensa con un fondo más opaco. Es decir, **este proyecto ya
probó el blur en Android, lo midió, y lo quitó.** El plan proponía volver a introducirlo
en headers y bottom nav fijos, que es un caso peor que el que ya se descartó.

Aun así, conviene ejecutar 0.3/0.4 cuando haya teléfono, para tener la cifra propia.
No cambia la recomendación; la confirmaría.

---

## Qué implica para las fases siguientes

1. **El material se define sin `backdrop-filter`.** Capas de opacidad, bordes luminosos,
   highlight superior interior y gradientes. Se conserva el lenguaje visual; se elimina
   la propiedad cara. `@supports` como mejora progresiva solo en superficies **efímeras
   y sin texto encima** (el velo del modal, por ejemplo) — nunca bajo texto.
2. **Los tokens `--glass-bg-*` de oscuro del plan hay que rehacerlos.** Los valores
   0,04/0,07/0,10 con velo blanco no son usables. En oscuro el velo tiene que ser
   **oscuro** y alto (≥ 85 %), no blanco y bajo.
3. **Iconos: vendorizar, no depender del paquete.** Script de extracción que tome los
   ~80 SVG usados, se quede con el peso Outline y redondee a 2 decimales. La capa
   `shared/components/icons/` sigue siendo la buena idea del plan.
4. **`reicon-react` se puede desinstalar** al terminar: solo hace falta como fuente de
   los SVG durante la extracción, no en runtime.
5. **La Fase 1 (auditoría con capturas) sigue bloqueada** por el teléfono, pero no
   bloquea el diseño del sistema.

---

## Reproducir estas mediciones

Los scripts están en el scratchpad de la sesión, no en el repo. Para rehacerlos:
bundle con `esbuild` (bundle+minify, React externalizado) comparando los mismos N
iconos de cada librería; contraste componiendo alpha sobre el fondo y aplicando la
fórmula WCAG 2.1 de luminancia relativa.
