# GymLog — CLAUDE.md

> PWA + app Android nativa (Capacitor) para registro de entrenamiento de fuerza y cardio.
> Autor: Francisco Vidal Mateo (GitHub: Haplee) · Repo: github.com/Haplee/gymlog

---

> **Commits: puedes hacerlos tú**, respetando las convenciones de abajo
> (conventional commits, nunca directo a `main`, sin saltarte los hooks) y
> verificando antes con `lint` + `type-check` + `test`.
> **Push, PR, merge, tag y release: solo cuando el usuario lo pida** — son
> acciones de cara al exterior y difíciles de deshacer.

## Descripción del proyecto

GymLog registra entrenamientos de fuerza (ejercicios, series, reps, peso), sesiones
de cardio con temporizador, rutinas semanales, historial y analítica avanzada
(volumen, PRs, rachas, fatiga muscular, heatmap de consistencia). Funciona como
PWA instalable y como app Android nativa vía Capacitor. Backend en Supabase
(auth Google OAuth + Postgres + RPC). Desplegada en Vercel; APK generado por
GitHub Actions.

---

## Stack técnico

- **UI:** React 19 + TypeScript 5.7 (strict) + Vite 6
- **Estilos:** Tailwind CSS v4 (CSS-first vía `@tailwindcss/vite`; **no hay `tailwind.config.js`** — el theme vive en CSS)
- **Estado:** Zustand 5 (stores por feature) + TanStack Query 5 (estado servidor)
- **Routing:** React Router 7 (lazy-loaded pages)
- **Charts:** Recharts 3 · **Animaciones:** Framer Motion 12 · **Iconos:** reicon-react
- **i18n:** i18next + react-i18next (español)
- **Backend:** Supabase (auth, Postgres, RPC) · **Validación:** Zod
- **Móvil:** Capacitor 8 (Android/iOS) + vite-plugin-pwa
- **Tests:** Vitest + Testing Library + MSW (unit) · Playwright (e2e en `e2e/`)
- **Calidad:** ESLint 9 + Prettier + husky + lint-staged · commitizen (conventional commits)

## Comandos esenciales

```bash
npm run dev              # servidor de desarrollo Vite
npm run build            # tsc -b && vite build (incluye PWA)
npm run preview          # servir el build
npm run lint             # eslint .          (lint:fix para autofix)
npm run type-check       # tsc --noEmit
npm run test             # vitest run        (test:watch, test:coverage)
npx playwright test      # e2e (e2e/auth.spec.ts, e2e/workout-exercises.spec.ts)
npm run build:android    # build + npx cap sync android
npm run open:android     # abrir Android Studio
npm run gen:types        # regenerar src/types/database.types.ts desde Supabase
npm run analyze          # build con visualizador de bundle
npm run commit           # commitizen (conventional commits) — interactivo, para el usuario
npm run release          # standard-version — lo usa el usuario
```

## Arquitectura

```
src/
├── app/                  # Layout, PermissionRequests, providers, queryClient, queryPersister
├── assets/               # hero.png (imágenes estáticas)
├── features/
│   ├── auth/             # AuthPage, AuthCallback, SettingsPage, authStore
│   ├── cardio/           # CardioPage, cardioStore (timer de sesión)
│   ├── coach/            # entrenador IA opt-in (api/ components/ pages/ stores/ types/)
│   ├── fitbody/          # FitBodyShowcasePage: escaparate del reskin (ruta /fitbody)
│   ├── guide/            # GuidePage: guía de uso en la app (ruta /guide)
│   ├── routine/          # RoutinePage, routineStore, useWorkoutReminder
│   ├── stats/            # StatsPage, HistoryPage, UserStatsPage, charts, KPIs, constants.ts
│   ├── wearables/        # integración wearables (api/ components/ hooks/ pages/ stores/ types/)
│   └── workout/          # WorkoutPage (ruta /), stores, mutations, componentes
│       └── cada feature: pages/ components/ stores/ hooks/ (y api/, utils/, types/)
├── shared/
│   ├── api/queries.ts    # queries TanStack compartidas
│   ├── components/       # EmptyStates, ErrorBoundary, CardioIcons, SwipeToDelete, ui/ (primitivas)
│   ├── constants/        # accents.ts, muscleColors.ts (paletas: hex literal permitido)
│   ├── hooks/ lib/       # utilidades (cálculos, formatters, validators, i18n)
│   ├── stores/           # outboxStore, settingsStore
│   └── styles/tokens.css # design tokens (fuente única de verdad)
├── types/                # database.types.ts (GENERADO por gen:types — nunca editar), global.d.ts
├── index.css             # @import tailwindcss + tokens.css, @theme, keyframes
└── main.tsx / App.tsx    # entrada + router
```

- Aliases de import: `@` (src), `@app`, `@features`, `@shared` — definidos en
  `tsconfig.app.json` **y** `vite.config.ts`; si añades uno, sincroniza ambos.
- Rutas: `/` (WorkoutPage), `/routines`, `/stats`, `/history`, `/settings`,
  `/cardio`, `/user-stats`, `/exercises`, `/wearables`, `/notifications`,
  `/guide`, `/coach`, `/coach/memory`, `/fitbody`, `/login`, `/auth/callback`.

## Sistema de diseño

- **Sistema "FitBody"**, por defecto oscuro: base `#0a0a0b`, superficie `#26262b`,
  acento amarillo lima `#ffd93d` (`--interactive-primary`), texto sobre acento
  `#241c00`. Sustituyó al sistema anterior «Stitch» de acento menta `#60eca8`
  (los documentos que lo mencionen en verde son de esa etapa).
- **El acento lo elige el usuario.** `#ffd93d` es solo el valor por defecto:
  `src/shared/constants/accents.ts` define **24 presets**, cada uno con su pareja
  clara y oscura. Nunca asumas el amarillo al medir contraste — el peor caso es
  `lime #cbf24c`, que es más claro. En Android el icono del lanzador también
  sigue al acento (`ic_fg_*.xml` + `AppIconPlugin.kt`).
- **Sí hay modo claro** y está completo: Ajustes → Preferencias → Tema (OSCURO /
  CLARO), en `settingsStore.theme` + el bloque `:root.light` de `tokens.css`. No lo
  rompas ni lo elimines: al tocar tokens o estilos, comprueba **los dos temas**.
  El tema de la app es independiente del modo claro/oscuro del **sistema**.
- **Tokens**: `src/shared/styles/tokens.css` define las CSS vars (`--bg-*`,
  `--text-*`, `--interactive-*`, `--accent-*`, `--radius-*`, `--shadow-*`,
  `--space-*`). El bloque `@theme inline` de `src/index.css` las mapea a
  utilidades Tailwind (`bg-surface`, `text-fg-muted`, `border-line`, `bg-accent`,
  `rounded-pill`, `shadow-card`…).
- **Nunca hardcodees colores hex** en componentes. La regla aplica a componentes:
  los ficheros de paleta son la excepción, y viven en dos sitios concretos —
  `src/features/stats/constants.ts` (Recharts no resuelve `var()` en `fill` SVG
  de forma fiable) y `src/shared/constants/` (`accents.ts`, `muscleColors.ts`).
  Si necesitas un color literal nuevo, va a uno de esos ficheros, nunca al JSX.
- **Material «Liquid Glass», 3 capas.** Se elige **por función, nunca por
  aspecto**: `glass-1` contenido (agrupa, sin sombra) · `glass-2` elevado (una
  unidad que se toca: tarjetas, filas) · `glass-3` flotante (va encima del
  contenido: header, bottom nav, FAB, modales, sheets). Para chrome a sangre,
  `glass-flush` + `glass-flush-b/t/r`: un borde de 4 lados en algo que cruza la
  pantalla dibuja hairlines verticales en los bordes.
  - **No se anidan capas del mismo nivel.** Una `glass-2` dentro de otra `glass-2`
    es señal de jerarquía mal puesta, no de que falte una capa.
  - **Sin `backdrop-filter`.** Decidido sobre medidas, no por gusto: con el acento
    por debajo ningún velo translúcido alcanza AA, y el blur ya se midió y se
    quitó en julio por jank en el WebView de Android. La señal de profundidad la
    da el difuminado de borde de scroll (`glass-scroll-fade`, lo enciende
    `Layout` según `scrollTop`).
  - **La luz se gasta en el canto, pero el canto no puede ir solo.** Aclarar 1px
    de borde no toca el contraste del texto y aclarar el _velo_ sí, así que el
    velo sigue teniendo techo. Lo que **no** vale es que el canto sea la única
    señal: leído así, el reskin acabó con canvas→superficie a 1,076:1 —una
    tarjeta indistinguible de su fondo— y con los bordes de los inputs a 1,75:1,
    por debajo del 3:1 que exige WCAG 1.4.11. Las superficies también separan, y
    su techo lo marca el AA de `--text-tertiary`.
  - **Antes de dar por bueno un cambio de color, `npm run audit:contrast`.** Lee
    los tokens reales y los 24 acentos, comprueba texto, jerarquía, bordes y
    vidrio en los dos temas, y falla con código ≠ 0. También valida que los
    comentarios del CSS estén bien cerrados: un `*/` huérfano no rompe el
    servidor de desarrollo pero sí el build, y eso solo se ve en la APK.
  - **En oscuro no hay sombras, hay halos.** Sobre `--bg-canvas` un negro al 30 %
    da 1,0175:1 y al 60 % da 1,036, por debajo del umbral de percepción (~1,05):
    una sombra negra no se ve y aun así se pinta. La capa 3 usa halo claro; en
    tema claro sí se conservan las sombras, que ahí funcionan.
  - Detalle y mediciones: `openspec/changes/liquid-glass-design-system/design.md`
    y `openspec/changes/recalibrate-fitbody-hierarchy/design.md`.
- **Tipografía:** Inter (cuerpo) + Space Grotesk (display y contadores/números,
  con cifras tabulares). `:root` es 15px. Usa la escala con nombre (`text-sm`,
  `text-base`, `text-lg`…), no valores arbitrarios `text-[…]`.
- **Iconos: un único punto de import.** Todo sale de `@shared/components/icons`;
  ningún componente importa de `reicon-react` directamente. Ese barril es lo que
  hace que cambiar de librería sea tocar un fichero y no 68. Conviven Reicon
  (generalista, outline por defecto) y los `Icon*` propios de dominio (máquinas,
  equipamiento, ♂/♀, cerebro del entrenador). **Nada de emojis como iconos**: los
  dibuja la fuente del sistema, así que no siguen al acento ni se ven igual en
  dos dispositivos.
- Estilos inline `style={{}}` solo para valores genuinamente dinámicos
  (porcentajes, colores por índice de chart, props de framer-motion).

## Convenciones

- **Strings de usuario via i18next** — nada de texto literal en JSX.
- Stores Zustand por feature, co-locados en `features/<x>/stores/`.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `style:`, `chore:`, `docs:`).
  `npm run commit` (commitizen) es interactivo: un agente usa `git commit -F -` con
  un heredoc. Explica en el cuerpo **por qué**, no solo qué.
- No commits directos a `main`: ramas `feat/`, `fix/`, `docs/` (o `release/vX.Y.Z`).
- husky + lint-staged ejecutan eslint+prettier en cada commit — no los saltes.
- `eslint-plugin-jsx-a11y` activo: respeta aria-\*, roles y contraste WCAG AA.

## Móvil / Capacitor — reglas duras

- Mobile-first. Touch targets **≥44px**. Prueba el layout a ~390px de ancho.
- No toques las utilidades de safe-area (`env(safe-area-inset-*)`) ni
  `--header-height` / `--bottom-nav-height` sin verificar en Android.
- `capacitor.config.ts`: splash y status bar usan el fondo base — si cambias
  `--bg-base`, actualiza también `index.html` (estilo inline + theme-color) y el
  manifest PWA en `vite.config.ts` (`theme_color`, `background_color`).
- Cuidado con `backdrop-blur` en WebView Android: si hay jank, fallback a
  `bg-surface/95`.
- No rompas la config del service worker (vite-plugin-pwa) en `vite.config.ts`.

## Reglas de comportamiento para Claude

- Antes de dar trabajo por terminado: `npm run lint && npm run type-check && npm run test`.
- Puedes commitear tu propio trabajo, pero **verifica antes de commitear**, no después.
- No añadas dependencias nuevas sin preguntar.
- No edites `src/types/database.types.ts` a mano (usa `npm run gen:types`).
- Cambios de esquema BD → migración en `supabase/migrations/` (idempotente).
- No instales nada global sin avisar.
- `versiones/`, `coverage/`, `dev-dist/` están fuera de git (artefactos locales).

## Entrenador IA — reglas duras

- **La clave del proveedor JAMÁS va al cliente.** Vive solo en `Deno.env` de la
  Edge Function `ai-coach`. Ningún `VITE_*` la toca.
- **No copies la autorización de `send-push`** (secreto compartido
  `x-send-secret`) en endpoints que llame la app: un secreto dentro del APK o
  del bundle es público. `ai-coach` verifica el JWT y saca el `user_id` del
  token, nunca del cuerpo de la petición.
- Apagado por defecto (`profiles.ai_coach_enabled`). El servidor es la fuente de
  verdad; el store del cliente es un espejo.
- **El coach propone, el usuario aplica.** Nada modifica rutinas, pesos ni
  series sin confirmación.
- `supabase/functions/ai-coach/safety.ts` es post-filtro determinista: no lo
  debilites apoyándote en que el prompt ya lo dice. Se midió que no basta.
- La capa 0 (`features/stats/utils/autoregulation.ts`) no manda nada fuera del
  dispositivo y debe seguir funcionando con el entrenador apagado.
- **Nunca guardes claves en ficheros del repo** (es público). `.env.local` o
  `supabase secrets set`.

## Contexto de desarrollo

- Entorno: Windows 11 + Ubuntu (dual boot)
- Despliegue: Vercel (web) + GitHub Actions (`android-build.yml` compila APK, `ci.yml` lint/test)
- `diary.md` en la raíz: diario de desarrollo con decisiones — consúltalo para contexto histórico.
- `public/landing.html` y `public/tutorial.html` son páginas estáticas independientes (landing de descarga del APK y tutorial); Vite las copia tal cual a `dist/`, no forman parte del bundle.
