# GymLog — CLAUDE.md

> PWA + app Android nativa (Capacitor) para registro de entrenamiento de fuerza y cardio.
> Autor: Francisco Vidal Mateo (GitHub: Haplee) · Repo: github.com/Haplee/gymlog

---

> **Commits: todos los commits los realiza el usuario, ninguno tú.**

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
- **Charts:** Recharts 3 · **Animaciones:** Framer Motion 12 · **Iconos:** lucide-react
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
npm run commit           # commitizen (conventional commits) — lo usa el usuario
npm run release          # standard-version — lo usa el usuario
```

## Arquitectura

```
src/
├── app/                  # Layout (header + bottom nav), providers, queryClient
├── features/
│   ├── auth/             # AuthPage, AuthCallback, SettingsPage, authStore
│   ├── cardio/           # CardioPage, cardioStore (timer de sesión)
│   ├── routine/          # RoutinePage, routineStore, useWorkoutReminder
│   ├── stats/            # StatsPage, HistoryPage, UserStatsPage, charts, KPIs
│   └── workout/          # WorkoutPage (ruta /), stores, mutations, componentes
│       └── cada feature: pages/ components/ stores/ hooks/ (y api/, utils/, types/)
├── shared/
│   ├── api/queries.ts    # queries TanStack compartidas
│   ├── components/       # EmptyStates, ErrorBoundary, MuscleIcons, ui/ (primitivas)
│   ├── hooks/ lib/       # utilidades (cálculos, formatters, validators, i18n)
│   ├── stores/           # useUiStore, persistAuthToken
│   └── styles/tokens.css # design tokens (fuente única de verdad)
├── types/database.types.ts  # GENERADO por gen:types — nunca editar a mano
├── db/migrations/        # SQL espejo (las reales están en supabase/migrations/)
├── index.css             # @import tailwindcss + tokens.css, @theme, keyframes
└── main.tsx / App.tsx    # entrada + router
```

- Aliases de import: `@` (src), `@app`, `@features`, `@shared` — definidos en
  `tsconfig.app.json` **y** `vite.config.ts`; si añades uno, sincroniza ambos.
- Rutas: `/` (WorkoutPage), `/routines`, `/stats`, `/history`, `/settings`,
  `/cardio`, `/user-stats`, `/login`, `/auth/callback`.

## Sistema de diseño

- **Tema oscuro único**: base `#080808`, superficie `#111111`, acento lima `#c8ff00`.
  No hay modo claro; no añadas uno sin que lo pida el usuario.
- **Tokens**: `src/shared/styles/tokens.css` define las CSS vars (`--bg-*`,
  `--text-*`, `--interactive-*`, `--accent-*`, `--radius-*`, `--shadow-*`,
  `--space-*`). El bloque `@theme inline` de `src/index.css` las mapea a
  utilidades Tailwind (`bg-surface`, `text-fg-muted`, `border-line`, `bg-accent`,
  `rounded-pill`, `shadow-card`…).
- **Nunca hardcodees colores hex** en componentes. Excepción: las paletas de
  charts en `src/features/stats/constants.ts` (Recharts no resuelve `var()` en
  `fill` SVG de forma fiable — por eso son literales TS).
- **Elevación (3 niveles):** plano = sin sombra; elevado = `shadow-card`;
  flotante (FABs, overlays) = `shadow-lg` / `shadow-fab`.
- **Tipografía:** DM Sans (display) + Geist Mono (contadores/números). `:root`
  es 15px. Usa la escala con nombre (`text-sm`, `text-base`, `text-lg`…), no
  valores arbitrarios `text-[…]`.
- Estilos inline `style={{}}` solo para valores genuinamente dinámicos
  (porcentajes, colores por índice de chart, props de framer-motion).

## Convenciones

- **Strings de usuario via i18next** — nada de texto literal en JSX.
- Stores Zustand por feature, co-locados en `features/<x>/stores/`.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `style:`, `chore:`, `docs:`).
- No commits directos a `main`: ramas `feat/`, `fix/`, `docs/`.
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
- No añadas dependencias nuevas sin preguntar.
- No edites `src/types/database.types.ts` a mano (usa `npm run gen:types`).
- Cambios de esquema BD → migración en `supabase/migrations/` (idempotente).
- No instales nada global sin avisar.
- `versiones/`, `coverage/`, `dev-dist/` están fuera de git (artefactos locales).

## Contexto de desarrollo

- Entorno: Windows 11 + Ubuntu (dual boot)
- Despliegue: Vercel (web) + GitHub Actions (`android-build.yml` compila APK, `ci.yml` lint/test)
- `diary.md` en la raíz: diario de desarrollo con decisiones — consúltalo para contexto histórico.
- `landing.html` y `tutorial.html` en la raíz son páginas estáticas independientes (landing de descarga del APK y tutorial); no forman parte del bundle Vite.
