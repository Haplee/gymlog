# Plan — Migración a "Liquid Glass" + iconos Reicon

> **Estado:** BORRADOR — pendiente de aprobación
> **Fecha:** 2026-08-13
> **Alcance:** cambio de identidad visual de toda la app (PWA + APK Android)
> **Rama propuesta:** `feat/liquid-glass-reicon`
> **Cambio OpenSpec:** `liquid-glass-design-system`

---

## 0. Resumen ejecutivo

Es viable, pero es un proyecto grande con **dos riesgos que hay que resolver ANTES de
migrar nada**: `reicon-react` es un paquete de una semana de vida con un solo
mantenedor, y la app **hoy no usa `backdrop-blur` en ningún sitio** (0 ocurrencias), así
que el Liquid Glass es material nuevo al 100% sobre WebView Android — donde el blur es
el efecto que más jank produce.

**Por eso el plan arranca con una Fase 0 de spikes con puerta de decisión.** Si el spike
de blur no da 60fps en el teléfono real, o si Reicon no cubre los iconos del gimnasio,
cambian las fases siguientes — no tiene sentido planificar 6 semanas sobre supuestos sin
verificar.

**Superficie medida:**

| Métrica                                  | Valor real                                                        |
| ---------------------------------------- | ----------------------------------------------------------------- |
| Ficheros `.tsx` en `src/`                | 114                                                               |
| Ficheros que importan `lucide-react`     | **68**                                                            |
| Iconos lucide distintos en uso           | **97**                                                            |
| Ficheros de iconos custom (SVG propios)  | 3 (`GymIcons` 283 L, `CardioIcons` 272 L, `EquipmentIcons` 102 L) |
| Páginas (rutas) a migrar                 | 15                                                                |
| Primitivas UI en `shared/components/ui/` | 16                                                                |
| Usos de `backdrop-blur` hoy              | **0**                                                             |
| Hex hardcodeados en `.tsx`               | 13 (+ logo Google, legítimo)                                      |
| Emojis usados como icono/símbolo         | ≥ 8 sitios                                                        |
| Ficheros de test unitarios               | 46                                                                |
| Specs e2e Playwright                     | 4                                                                 |

---

## 1. Recursos a usar

### MCPs (ya configurados en `.mcp.json` — nada que pedir)

| MCP          | Uso en este plan                                                                       |
| ------------ | -------------------------------------------------------------------------------------- |
| `mobai`      | Evidencia real: capturas antes/después de las 15 pantallas × 2 temas, medición de jank |
| `reicon`     | Búsqueda de iconos, preview SVG, generación del código `reicon-react`                  |
| `context7`   | Docs vigentes de Tailwind 4 (`@theme`), React 19, Capacitor 8                          |
| `playwright` | Recorrido de la PWA en navegador, capturas deterministas para diff visual              |
| `supabase`   | Solo lectura (no hay cambios de esquema en este trabajo)                               |
| `vercel`     | Comprobar el preview deployment de la rama                                             |

### Skills por fase

- **Fase 1 (auditoría):** `impeccable`, `web-design-guidelines`
- **Fase 2 (sistema):** `apple-design` ← dirección primaria, `emil-design-eng`,
  `ui-ux-pro-max` (estilo `glassmorphism`)
- **Fase 3 (motion):** `find-animation-opportunities`, `animate`, `review-animations`
- **Fase 4-6 (migración):** `openspec-propose`, `openspec-apply-change`
- **Fase 7 (verificación):** `frontend-code-review`, `verify-loop`

> Una sola dirección estética: **`apple-design`**. `high-end-visual-design`,
> `design-taste-frontend` y `gpt-tasteskill` **se descartan** para no mezclar lenguajes.

### Documentos a leer antes de decidir

`.claude/CLAUDE.md` · `src/shared/styles/tokens.css` (181 L) · `src/index.css` (716 L) ·
`src/shared/constants/{accents,muscleColors}.ts` · `src/features/stats/constants.ts` ·
`FitBodyShowcasePage.tsx` · `docs/design/stitch_screens/` · `docs/audits/` ·
`docs/PLAN_DE_MEJORA_INTEGRAL_GYMLOG.md` · `docs/TODO-MAESTRO.md` · `diary.md` ·
`https://reicon.dev/llms-full.txt` y `llms-icons.txt`

---

## 2. Riesgos identificados (leer antes de aprobar)

### 🔴 R1 — `reicon-react` es un paquete muy joven

```
reicon-react@1.2.0 · MIT · publicado hace 1 semana · 13 versiones
1 mantenedor · 25.0 MB sin comprimir · 0 dependencias
```

Cambiar los iconos de toda la app a una librería con una semana de vida y un solo
mantenedor mete una dependencia de cadena de suministro en el camino crítico de la UI.
Si el paquete se abandona o se despublica, quedan 68 ficheros rotos.

**No es un bloqueo** (es MIT, sin dependencias, y los SVG se pueden vendorizar), pero
la mitigación es obligatoria:

- Pinnear versión **exacta** (`"reicon-react": "1.2.0"`, sin `^`).
- Envolver **todos** los iconos en una capa propia `src/shared/components/icons/` que
  reexporte desde `reicon-react`. Los 114 ficheros importan de la capa, nunca del
  paquete. Cambiar de librería después = tocar 1 fichero, no 68.
- Verificar el impacto real en el bundle tras el tree-shaking (`npm run analyze`).
  25 MB sin comprimir es mucho: si el tree-shaking falla, es un bloqueo duro.

### 🔴 R2 — El blur es material nuevo sobre WebView Android

La app no usa `backdrop-blur` en ningún sitio hoy. El riesgo es concreto y localizado:

- Listas largas con scroll (`ExerciseLibraryPage`, `HistoryPage`, `WorkoutSetList`)
- Headers y bottom nav **fijos** con blur sobre contenido en movimiento — el peor caso
- Recharts (`StatsPage`, `UserStatsPage`) bajo capas translúcidas
- `framer-motion` animando elementos que también hacen blur

**Regla de diseño derivada:** el blur se reserva para superficies **estáticas o
efímeras** (headers, bottom nav, modales, sheets, FAB). Las **tarjetas dentro de listas
scrollables usan glass falso**: `bg-surface/95` + borde luminoso 1px + sombra, sin
`backdrop-filter`. Visualmente son casi idénticas y cuestan 0.

### 🟡 R3 — Los iconos custom del gimnasio no van a estar en Reicon

`GymIcons.tsx` (283 L), `CardioIcons.tsx` (272 L) y `EquipmentIcons.tsx` (102 L) son SVG
dibujados para el dominio: máquinas, equipamiento, símbolos ♂/♀ del onboarding, tipos de
cardio. Una librería generalista de 2.674 iconos no los cubre.

**Decisión propuesta:** se **mantienen** como excepción documentada, pero se
**re-dibujan al grid 24×24 y trazo 1.5px de Reicon** para que sean de la misma familia.
Es lo que hace que el set se sienta coherente, no el origen del fichero.

### 🟡 R4 — Modo claro + glass es donde se rompe el contraste AA

Sobre fondo claro (`--bg-canvas: #f3f5f3`) una superficie translúcida deja pasar
cualquier cosa que haya debajo, y el texto `--text-secondary: #404943` puede caer por
debajo de 4.5:1 según el contenido. El acento claro (`#6b5200`) ya está muy ajustado.

**Mitigación:** en claro el glass es **mucho más opaco** (85-92% vs 60-72% en oscuro), y
todo texto sobre glass se valida con medición, no a ojo.

### 🟡 R5 — 46 tests unitarios + 4 e2e pueden depender de los iconos

Muchos tests localizan elementos por nombre accesible o `data-testid`. Cambiar los
iconos puede romperlos en masa. Se audita antes de migrar (Fase 1.4) y, si hace falta,
se añaden `data-testid` estables **antes** de tocar iconos, en un commit aparte.

---

## 3. Fases

### Fase 0 — Spikes y puerta de decisión ⛔ BLOQUEANTE

**Objetivo:** validar los dos supuestos que sostienen todo el plan. Nada se migra hasta
pasar esta puerta.

| #   | Tarea                                                                                                          | Criterio de éxito                            |
| --- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 0.1 | Rama `spike/liquid-glass`. Instalar `reicon-react@1.2.0` (pin exacto)                                          | Instala limpio                               |
| 0.2 | Prototipo glass en `/fitbody`: header + bottom nav + 3 tarjetas + 1 sheet, ambos temas                         | Renderiza en dev                             |
| 0.3 | **Medir en el teléfono real (`mobai`)**: scroll de lista larga con header glass, apertura de sheet, tab switch | **≥ 55 fps sostenidos**, sin tearing visible |
| 0.4 | Repetir 0.3 con la variante fallback (`bg-surface/95` sin `backdrop-filter`)                                   | Comparativa documentada                      |
| 0.5 | Bundle: importar 20 iconos Reicon, `npm run analyze`                                                           | **Delta < 40 KB gzip** vs lucide             |
| 0.6 | Cobertura: mapear a mano 15 iconos representativos de los 97 contra `llms-icons.txt`                           | ≥ 80 % con equivalente directo               |
| 0.7 | Contraste: medir texto sobre glass en claro y oscuro                                                           | Todo ≥ 4.5:1 (texto), ≥ 3:1 (UI)             |

**🚦 PUERTA G0 — decisión explícita del usuario:**

- ✅ **Verde** (0.3 y 0.5 y 0.6 pasan) → seguir con el plan completo.
- ⚠️ **Ámbar** (0.3 falla, resto pasa) → Liquid Glass **sin `backdrop-filter`**: glass
  por capas de opacidad + bordes luminosos + gradientes. Se conserva el 80 % del efecto
  visual con 0 riesgo de rendimiento. **Esta es la salida más probable.**
- ❌ **Rojo** (0.5 o 0.6 fallan) → replantear los iconos: vendorizar solo los SVG usados
  desde Reicon en vez de depender del paquete.

**Entregable:** `docs/spikes/liquid-glass-spike.md` con capturas, fps medidos y
recomendación.

---

### Fase 1 — Auditoría con evidencia real

| #   | Tarea                                                                                      | Entregable                         |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| 1.1 | Capturas `mobai` de las 15 pantallas × 2 temas (30 capturas)                               | `docs/design/before/{dark,light}/` |
| 1.2 | Capturas de los estados no navegables: modales, sheets, empty, error, loading, FAB abierto | `docs/design/before/states/`       |
| 1.3 | Inventario de dispersión por pantalla                                                      | Tabla en `audit.md`                |
| 1.4 | **Auditoría de tests**: qué tests localizan por icono/aria-label                           | Lista de tests en riesgo           |
| 1.5 | **Mapa completo de los 97 iconos lucide → Reicon** vía MCP `reicon`                        | `docs/design/icon-map.md`          |
| 1.6 | Inventario de emojis usados como icono (≥8 sitios: 🔔 ✓ ✕ 📊 ♂ ♀)                          | Filas en `icon-map.md`             |
| 1.7 | Inventario de los 13 hex en `.tsx` → destino (token nuevo o `constants.ts`)                | Filas en `audit.md`                |

**Dispersión ya detectada sin abrir el teléfono:**

- 97 iconos lucide + 3 sets custom + emojis como iconos = **3 lenguajes gráficos** mezclados
- `--accent-violet: #ffd93d` y `--accent-fuchsia: #ffb74d` son mentiras semánticas
  (heredadas del reskin): el nombre no corresponde al color
- Bloque `:root.light` documentado como "espejo tonal M3 del esquema Stitch" — comentario
  obsoleto, describe el sistema anterior
- Mapeo backward-compat (`--bg`, `--bg-main`, `--bg-card`, `--text-h`, `--accent-bg`…):
  ~14 alias de la etapa Stitch, presumiblemente con usos residuales
- `DayFrequencyChart.tsx:49` hardcodea `#ffd93d` / `#ffa93d` / `#38bdf8` en JSX
  (viola la regla de CLAUDE.md, y `#ffa93d` no existe en ningún token)

---

### Fase 2 — Diseño del sistema Liquid Glass

**Nueva capa de tokens en `tokens.css`** (los actuales no se borran; se reorganizan):

```
/* ── Material vidrio ── */
--glass-bg-1            /* capa base translúcida        */
--glass-bg-2            /* capa elevada                 */
--glass-bg-3            /* capa flotante (FAB, modal)   */
--glass-blur-sm/md/lg   /* 8px / 16px / 28px            */
--glass-border          /* borde luminoso 1px           */
--glass-highlight       /* reflejo superior (inset)     */
--glass-shadow-1/2/3    /* profundidad por capa         */
--glass-tint-accent     /* amarillo lima dentro del vidrio */
--glass-fallback-1/2/3  /* variante SIN backdrop-filter */
```

**Valores de partida (a ajustar con la medición de contraste):**

| Token               | Oscuro                                  | Claro                                   |
| ------------------- | --------------------------------------- | --------------------------------------- |
| `--glass-bg-1`      | `rgb(255 255 255 / 0.04)`               | `rgb(255 255 255 / 0.72)`               |
| `--glass-bg-2`      | `rgb(255 255 255 / 0.07)`               | `rgb(255 255 255 / 0.85)`               |
| `--glass-bg-3`      | `rgb(255 255 255 / 0.10)`               | `rgb(255 255 255 / 0.92)`               |
| `--glass-border`    | `rgb(255 255 255 / 0.10)`               | `rgb(255 255 255 / 0.90)`               |
| `--glass-highlight` | `inset 0 1px 0 rgb(255 255 255 / 0.08)` | `inset 0 1px 0 rgb(255 255 255 / 0.95)` |

**Reglas del material** (esto es lo que hace que se sienta Apple y no "una card con blur"):

1. **Borde luminoso 1px siempre.** Sin él, el vidrio no tiene canto y parece suciedad.
2. **Highlight superior interior.** La luz entra por arriba. Coherente en toda la app.
3. **Tres capas, no más.** Base (contenido) → elevado (tarjetas) → flotante (nav, FAB,
   modales). Cada capa sube opacidad y blur, no solo sombra.
4. **El acento no es una capa de vidrio.** Los botones primarios amarillos son
   **sólidos**; el vidrio es el contexto, el acento es la acción. Mezclarlos mata la
   jerarquía y el contraste.
5. **El blur solo sobre lo que se mueve por debajo.** Si nada se mueve detrás, es coste
   sin beneficio → fallback.

**Motion (`apple-design`):** spring, no ease. Entradas de tarjeta con
`opacity` + `translateY` + `blur(4px→0)`. Nunca animar `width`/`height`/`backdrop-filter`
(animar el blur es lo más caro que existe). `prefers-reduced-motion` desactiva el
translate y el blur, conserva el fade.

**Capa de iconos:**

```tsx
// src/shared/components/icons/index.ts — ÚNICO punto de import de reicon-react
export { ChevronRight, Plus, ... } from 'reicon-react'   // Outline por defecto
export { StarFilled, HeartFilled, ... } from 'reicon-react' // estado activo
export * from './GymIcons'      // custom, re-dibujados al grid 24×24 / 1.5px
export * from './CardioIcons'
export * from './EquipmentIcons'
```

Regla de peso: **Outline** para estado normal, **Filled** para activo/seleccionado/
destacado. Tamaño estándar 24px; 20px solo dentro de chips y filas densas.

**Entregables:** `openspec/changes/liquid-glass-design-system/{proposal,design,tasks}.md`

**🚦 PUERTA G1:** el usuario aprueba `design.md` y ve el prototipo de `/fitbody`
en el teléfono antes de que se toque una sola pantalla de producción.

---

### Fase 3 — Fundamentos (sin tocar pantallas)

| #   | Tarea                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1 | Tokens glass en `tokens.css` (oscuro + claro) + mapeo en `@theme` de `index.css`                                                                       |
| 3.2 | Limpiar la deuda detectada: renombrar `--accent-violet`/`--accent-fuchsia`, purgar los alias backward-compat sin uso, actualizar comentarios obsoletos |
| 3.3 | Utilidades `.glass-1/2/3` con `@supports (backdrop-filter: blur(1px))` + fallback                                                                      |
| 3.4 | Tokens de motion + variantes framer-motion compartidas                                                                                                 |
| 3.5 | Instalar `reicon-react@1.2.0` (pin) + crear la capa `shared/components/icons/`                                                                         |
| 3.6 | Añadir `data-testid` a los elementos que los tests localizan por icono — **commit aparte, antes de migrar**                                            |

_Verificación:_ `lint` + `type-check` + `test` en verde. La app se ve **idéntica** al
terminar esta fase (los tokens existen pero nadie los usa todavía).

---

### Fase 4 — Migración de primitivas (16 componentes)

Se migran las primitivas antes que las pantallas: cada primitiva arrastra decenas de
usos. Es donde el trabajo rinde más.

`Button` · `Badge` · `Chip` · `Input` · `Toggle` · `Modal` · `BottomSheet` ·
`ConfirmDialog` · `FAB` · `NavRow` · `SettingRow` · `SectionHeader` · `SegmentedControl` ·
`Skeleton` · `StatNumber` · `GymLogLogo`

Más los tres contenedores estructurales: `Layout` (header) · bottom nav · `AppDrawer`.

_Verificación por primitiva:_ tests unitarios en verde + captura `mobai` en ambos temas.

---

### Fase 5 — Migración de pantallas (15 rutas, por bloques)

Bloques ordenados por riesgo creciente. Cada bloque = 1 commit + capturas antes/después.

| Bloque | Pantallas                               | Riesgo                                       |
| ------ | --------------------------------------- | -------------------------------------------- |
| A      | `/fitbody` (escaparate, ya prototipado) | Bajo                                         |
| B      | `/settings`, `/notifications`, `/guide` | Bajo — listas estáticas                      |
| C      | `/login`, `/auth/callback`              | Bajo — pantalla aislada                      |
| D      | `/` (Workout), `/exercises`             | **Alto** — pantalla principal, listas largas |
| E      | `/routines`, `/cardio`                  | Medio — dnd-kit y timers                     |
| F      | `/history`, `/stats`, `/user-stats`     | **Alto** — Recharts + virtualización         |
| G      | `/coach`, `/coach/memory`, `/wearables` | Medio                                        |

**Cuidado especial en F:** Recharts no resuelve `var()` en `fill` SVG de forma fiable —
por eso existe `src/features/stats/constants.ts`. Los colores de gráfico siguen ahí; lo
que cambia es el **contenedor** del gráfico, no las series.

---

### Fase 6 — Barrido de iconos y limpieza final

| #   | Tarea                                                                          |
| --- | ------------------------------------------------------------------------------ |
| 6.1 | Los 97 iconos lucide migrados según `icon-map.md`                              |
| 6.2 | Emojis-como-icono sustituidos (🔔 ✓ ✕ 📊 ♂ ♀ …)                                |
| 6.3 | `GymIcons`/`CardioIcons`/`EquipmentIcons` re-dibujados al grid 24×24 / 1.5px   |
| 6.4 | **`npm uninstall lucide-react`** + `grep -r "lucide-react" src` = 0 resultados |
| 6.5 | Los 13 hex en `.tsx` movidos a token o a `constants.ts`                        |
| 6.6 | Empty / error / loading unificados en toda la app                              |
| 6.7 | `npm run analyze` — comparar bundle antes/después                              |

---

### Fase 7 — Verificación

**Automática:**

```bash
npm run lint && npm run type-check && npm run test
npx playwright test
npm run build && npm run analyze
```

**Manual en el teléfono (`mobai`):**

- Recorrido completo de las 15 pantallas × 2 temas → `docs/design/after/`
- Diff visual antes/después pantalla a pantalla
- **Rendimiento:** scroll en las tres listas largas, sheets, tab switch, timer de cardio
  corriendo (es el peor caso: animación continua + posible blur)
- Modo avión (estados offline) y safe-area en el dispositivo real
- `prefers-reduced-motion` activado en Ajustes de Android

**Accesibilidad:** contraste medido en cada superficie glass, ambos temas; foco visible
sobre vidrio; touch targets ≥ 44px; `eslint-plugin-jsx-a11y` sin warnings nuevos.

---

## 4. Criterios de aceptación

- [ ] Una sola identidad Liquid Glass en las 15 pantallas, ambos temas
- [ ] `grep -r "lucide-react" src/` → **0 resultados**; `lucide-react` fuera de `package.json`
- [ ] Ningún emoji usado como icono
- [ ] Todos los iconos vienen de la capa `shared/components/icons/`, peso coherente
- [ ] Cero hex nuevos en `.tsx` (solo los `constants.ts` documentados + logo Google)
- [ ] Contraste AA medido, no estimado, en las dos variantes de tema
- [ ] Sin jank perceptible en el teléfono real; fallbacks aplicados donde tocaba
- [ ] `lint` + `type-check` + `test` + e2e en verde
- [ ] Delta de bundle documentado y justificado
- [ ] `/fitbody` refleja el sistema nuevo completo
- [ ] `CLAUDE.md` actualizado con el sistema Liquid Glass (**y de paso corregir la
      sección de diseño, que sigue describiendo el acento menta `#60eca8` del sistema
      Stitch anterior**)

---

## 5. Reglas duras que el plan NO toca

- Modo claro **completo y premium** — no se degrada ni se abandona
- Strings vía i18next, en español — cero literales en JSX
- `src/types/database.types.ts` no se edita a mano
- Sin cambios de esquema BD
- Sin dependencias nuevas salvo `reicon-react` (ya decidido) y la baja de `lucide-react`
- Touch targets ≥ 44px, layout verificado a ~390px, safe-area intacta
- Si cambia `--bg-base`: actualizar también `index.html`, `capacitor.config.ts` y el
  manifest PWA en `vite.config.ts`
- Service worker (`vite-plugin-pwa`) intacto
- Commits convencionales, rama `feat/liquid-glass-reicon`, nunca directo a `main`
- Push / PR / release solo cuando el usuario lo pida

---

## 6. Orden de ejecución

```
F0 spikes ──⛔ G0 ──► F1 auditoría ──► F2 sistema ──⛔ G1 ──► F3 fundamentos
   │                                                              │
   └─ decide si hay blur real o solo fallback                     ▼
                                              F4 primitivas ──► F5 pantallas (A→G)
                                                                    │
                                              F7 verificación ◄── F6 iconos + limpieza
```

**Puertas bloqueantes:** G0 (viabilidad técnica) y G1 (aprobación del diseño).
Es deliberado: son los dos puntos donde un "no" ahorra semanas.

---

## 7. Lo que hay que decidir antes de empezar

1. **¿Se acepta el riesgo de `reicon-react`** (1 semana de vida, 1 mantenedor) con la
   mitigación de pin + capa de abstracción? ¿O se prefiere vendorizar los SVG?
2. **Si el spike de blur falla** (escenario probable): ¿vale el Liquid Glass sin
   `backdrop-filter` — capas, bordes y gradientes — o se prefiere blur real solo en
   modales y sheets, aceptando algo de jank?
3. **Iconos custom del gimnasio:** ¿re-dibujarlos al estilo Reicon (recomendado) o
   dejarlos tal cual?
4. **¿Un PR grande o siete PRs por bloque?** Recomiendo siete: revisables, y si un
   bloque sale mal se revierte solo ese.
