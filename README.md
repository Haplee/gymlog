<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=3ECF8E&height=120&section=header&text=GymLog%20v4.1&fontSize=50&fontColor=ffffff&animation=fadeIn" alt="Header animated wave" />

  <br>

  <img src="./public/gimnasia.svg" alt="GymLog App Logo" width="130" />

  <br>

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=3000&pause=1000&color=3ECF8E&center=true&vCenter=true&width=600&lines=Hipertrofia+y+Sobrecarga+Progresiva;Cardio+con+Cron%C3%B3metro+en+Vivo;Anal%C3%ADticas+Avanzadas+de+Entrenamiento;Arquitectura+Offline-First+Robusta" alt="Typing SVG" /></a>

  <p>PWA + app nativa Android/iOS para el registro y análisis de entrenamientos de <b>fuerza</b> y <b>cardio</b>. Diseñada con enfoque <b>offline-first</b>, autenticación con Google, notificaciones inteligentes y experiencia nativa real con Capacitor 8.</p>

  <p align="center">
    <a href="https://gymlog.vercel.app"><img src="https://img.shields.io/badge/APP_Vercel-LIVE_DEMO-3ECF8E?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
    <a href="https://Haplee.github.io/gymlog/"><img src="https://img.shields.io/badge/APK_Download-Landing_Page-3ECF8E?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" /></a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/github/actions/workflow/status/Haplee/gymlog/android-build.yml?style=flat-square&label=Android%20Build" />
    <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Tailwind-4.2-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" />
    <img src="https://img.shields.io/badge/Capacitor-8.3-646CFF?style=flat-square&logo=capacitor&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-DB+Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  </p>
  <br>
  <img src="https://visitor-badge.laobi.icu/badge?page_id=Haplee.gymlog&left_color=black&right_color=%233ECF8E&left_text=Visitantes" alt="Visitor Badge" />
</div>

<br>

## Core Features

<table>
  <tr>
    <td align="center" width="50%">
      <b>Registro de Fuerza</b>
      <p>Series con peso × reps, validación Zod, detección automática de PRs con fórmula Brzycki, confetti, temporizador de descanso con alarma y referencia de sesión anterior.</p>
    </td>
    <td align="center" width="50%">
      <b>Módulo Cardio</b>
      <p>Cronómetro en vivo con pausa/reanudar para 8 tipos de actividad (running, cycling, swimming...), registro de distancia, calorías y notas. Estadísticas semanales.</p>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Analíticas Premium</b>
      <p>Dashboard con KPIs, gráficos de volumen semanal, distribución muscular, progresión por ejercicio, análisis de fatiga neuromuscular y calculadora 1RM integrada.</p>
    </td>
    <td align="center" width="50%">
      <b>Experiencia Nativa</b>
      <p>Edge-to-Edge real, haptics (Taptic/Haptic), acceso biométrico (Face ID / huella), deep links, notificaciones push y locales, compartir entrenamientos y soporte multiidioma (ES/EN).</p>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Rutinas Semanales</b>
      <p>Planes predefinidos (PPL, Full Body...) y rutinas personalizadas. Planificación diaria L-D con sugerencia automática de ejercicios del día en la pantalla principal.</p>
    </td>
    <td align="center" width="50%">
      <b>Offline-First</b>
      <p>Outbox en IndexedDB con reintentos + descarte inteligente. Caché de queries persistida. La app funciona sin conexión y sincroniza al recuperar red.</p>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Wearables</b>
      <p>Integración con Health Connect (Android) / HealthKit (iOS) vía plugin Capacitor propio HealthBridge. Pasos, FC, sueño, workouts de Amazfit, Samsung, Garmin, Apple Watch.</p>
    </td>
    <td align="center" width="50%">
      <b>Export / Import Excel</b>
      <p>Libro .xlsx de 3 hojas (Entrenamientos, Cardio, Rutinas) con round-trip sin pérdida. Importa tanto formato exportado como hojas hechas a mano.</p>
    </td>
  </tr>
</table>

---

## Stack Tecnológico

| Capa               | Tecnología               | Función                                                                   |
| :----------------- | :----------------------- | :------------------------------------------------------------------------ |
| **Mobile Runtime** | Capacitor 8              | Puente nativo: haptics, biometría, notificaciones, deep links, share      |
| **Frontend**       | React 19, TypeScript 5.7 | UI reactiva con lazy loading y transiciones animadas (Framer Motion)      |
| **Estilos**        | Tailwind CSS 4           | Sistema de diseño con design tokens y responsive                          |
| **Data Flow**      | TanStack Query v5        | Estado del servidor, caché, invalidación y sincronización con Supabase    |
| **Global Store**   | Zustand 5                | Estado local persistido: workout activo, rutinas, cardio, ajustes         |
| **Gráficos**       | Recharts 3               | Volumen semanal, distribución muscular, progresión por ejercicio          |
| **Validación**     | Zod 3                    | Validación de series (reps/peso) con mensajes tipados                     |
| **i18n**           | i18next + react-i18next  | Multiidioma ES/EN con detección automática y persistencia                 |
| **Backend**        | Supabase                 | PostgreSQL, Auth (Google OAuth), RLS, tipos auto-generados                |
| **PWA**            | vite-plugin-pwa          | Service worker, instalable, offline-first, prompt de actualización in-app |
| **Persistencia**   | TanStack Persist + idb   | Caché de queries en IndexedDB para arranque sin red                       |
| **Drag & Drop**    | dnd-kit                  | Reordenar ejercicios de rutina por arrastre                               |
| **Errores**        | Sentry                   | Captura y reporte de errores en producción                                |
| **Wearables**      | HealthBridge (nativo)    | Plugin Capacitor propio — Health Connect + HealthKit                      |
| **Excel**          | exceljs                  | Export/import .xlsx de fuerza, cardio y rutinas (carga diferida)          |
| **Testing**        | Vitest + Playwright      | Tests unitarios colocalizados + E2E mobile-first                          |
| **CI/CD**          | GitHub Actions           | Lint/tests, build APK Android, smoke test iOS                             |
| **Bundler**        | Vite 6                   | Dev server HMR + build optimizado con chunk splitting                     |

---

## Funcionalidades Detalladas

### 🏋️ Workout — Registro en Vivo

- **Selector de ejercicios** con buscador, filtros por grupo muscular y equipamiento
- **Ejercicios personalizados**: crea los tuyos propios además del catálogo predefinido
- **Series**: peso × reps con validación en tiempo real (Zod)
- **Series de calentamiento**: toggle para marcar warmup sets (no cuentan en volumen)
- **Detección automática de PRs**: calcula 1RM con Brzycki → confetti + vibración si se supera el récord
- **Temporizador de descanso**: cronómetro configurable con alarma sonora (Web Audio API) + notificación nativa
- **Auto-inicio de descanso**: el timer arranca solo al añadir una serie (configurable)
- **Referencia de última sesión**: muestra las series anteriores del mismo ejercicio con opción de copiarlas
- **Notas por ejercicio**: CRUD de notas técnicas asociadas a cada ejercicio
- **Persistencia de sesión**: si cierras la app, puedes retomar el entrenamiento hasta 12h después
- **Compartir entrenamiento**: comparte resumen vía Web Share API o clipboard
- **Rutina del día**: muestra automáticamente los ejercicios programados si hay rutina activa

### 🏃 Cardio — Cronómetro en Vivo

- **8 tipos de actividad**: running, cycling, walking, rowing, swimming, elliptical, jump rope, other
- **Cronómetro** con pausa / reanudar / terminar
- **Datos opcionales al finalizar**: distancia (km), calorías y notas
- **Estadísticas semanales**: sesiones, tiempo total y distancia
- **Historial** con eliminación individual
- **Sincronización** bidireccional con Supabase

### 📊 Estadísticas — Dashboard Analítico

- **KPIs principales**: racha actual/máxima, volumen semanal (con tendencia %), frecuencia (30d), duración media
- **KPIs secundarios**: volumen total histórico, mejor 1RM estimado, PRs totales, notas de series
- **Volumen semanal**: gráfico filtrable por período (4 sem / 3 mes / 6 mes / 1 año), vista bar o area
- **Distribución muscular**: gráfico de volumen por grupo muscular
- **Progresión por ejercicio**: evolución temporal filtrable por métrica (1RM / peso máx / volumen)
- **Análisis de fatiga**: estado de recuperación por grupo muscular + sugerencia de qué entrenar hoy
- **Sección cardio**: KPIs de cardio + breakdown por tipo de actividad con barras animadas
- **Calculadora 1RM**: cálculo rápido de repetición máxima estimada (Brzycki)

### 📗 Historial — Export / Import

- **Exportar a Excel (.xlsx)**: libro de 3 hojas — Entrenamientos (grid de secciones por grupo muscular × fecha, celda `pesoxreps`), Cardio y Rutinas
- **Exportar a JSON**: backup completo de workouts + cardio
- **Importar Excel**: reconstruye fuerza, cardio y rutinas; acepta el formato exportado y hojas manuales con pesos en texto libre y fechas por sección
- **Importar CSV / JSON**: compatibilidad con el formato antiguo
- **Web y app idénticas**: en nativo se comparte el fichero (Share), en web se descarga (Blob) — mismo resultado

### 📅 Rutinas — Planificación Semanal

- **Rutinas predefinidas** (Push/Pull/Legs, Full Body, etc.)
- **Rutinas personalizadas**: CRUD completo
- **Planificación diaria** (L-D): asignar ejercicios a cada día con series × reps sugeridos
- **Vista "hoy"**: destaca los ejercicios que corresponden al día actual
- **Backup automático** y persistencia en Supabase

### ⌚ Wearables — Dispositivos de Salud

- **Health Connect (Android) / HealthKit (iOS)**: plugin Capacitor propio HealthBridge; por aquí entran Amazfit (vía Zepp), Samsung, Garmin, Apple Watch…
- **Datos importados**: pasos, distancia, calorías, frecuencia cardíaca (media/máx/reposo), sueño por fases y workouts (se integran en el historial de cardio)
- **Sync al abrir** configurable + botón de sincronización manual

### 🔐 Autenticación y Seguridad

- **Google OAuth** vía Supabase Auth
- **Deep Links** para callback OAuth en nativo (`com.franvi.gymlog://auth/callback`)
- **Onboarding**: al primer login pide objetivo de entrenamiento y días por semana
- **Acceso biométrico**: huella o Face ID (plugin Capacitor custom BiometricPlugin)
- **Row Level Security** (RLS) en todas las tablas de Supabase

### ⚙️ Ajustes

- **Idioma**: español / inglés con persistencia
- **Unidad de peso**: kg / lb con conversión automática en toda la app
- **Sonido**: feedback sonoro on/off
- **Notificaciones push**: nativas (Capacitor) + web (Service Worker)
- **Recordatorios de entreno**: avisa si llevas 2+ días sin entrenar
- **Series de calentamiento**: toggle global para mostrar/ocultar warmup
- **Auto-inicio de descanso**: activa el timer automáticamente al añadir serie
- **Biometría**: activar/desactivar acceso con huella o Face ID
- **Descarga APK**: botón directo en la versión web

---

## Notificaciones Inteligentes

| Tipo                        | Cuándo                               | Contenido                               |
| :-------------------------- | :----------------------------------- | :-------------------------------------- |
| **Resumen semanal**         | Lunes a las 9:00                     | "X sesiones · Y kg movidos · Z récords" |
| **Racha en riesgo**         | Racha ≥3 días y hoy no has entrenado | Aviso para no perder la racha           |
| **Alarma de descanso**      | Timer de descanso termina            | Notificación + sonido                   |
| **Recordatorio de entreno** | 2+ días sin entrenar (configurable)  | Recordatorio motivacional               |
| **Actualización PWA**       | Nueva versión disponible             | Toast con botón "Actualizar"            |

---

## Arquitectura del Repositorio

Organización vertical basada en **feature slices**. Cada dominio es autocontenido y no importa de otros features; todo lo compartido va por la capa `@shared/`.

```
src/
├── app/                      # Wiring global
│   ├── components/           #   Layout, PermissionRequests
│   ├── providers.tsx         #   QueryClient, Toaster, notificaciones
│   ├── queryClient.ts        #   TanStack Query config
│   └── queryPersister.ts     #   IDB persister para query cache
├── features/                 # Dominios autocontenidos
│   ├── auth/                 # Login (Google OAuth), onboarding, settings, biometría
│   │   ├── components/       #   OnboardingModal
│   │   ├── hooks/            #   useProfile
│   │   ├── pages/            #   AuthPage, AuthCallback, SettingsPage
│   │   └── stores/           #   authStore
│   ├── cardio/               # Cronómetro en vivo, historial, estadísticas cardio
│   │   ├── components/       #   ActiveSessionCard, WeeklyStats, SessionHistoryItem
│   │   ├── pages/            #   CardioPage
│   │   └── stores/           #   cardioStore
│   ├── routine/              # Rutinas semanales, planificación diaria
│   │   ├── components/       #   SortableExerciseList
│   │   ├── hooks/            #   useWorkoutReminder
│   │   ├── pages/            #   RoutinePage
│   │   └── stores/           #   routineStore
│   ├── stats/                # Dashboard analítico completo
│   │   ├── components/       #   Charts, KPICards, HistoryRows, FatigueAnalysis, userStats/
│   │   ├── hooks/            #   useFatigueSuggestion
│   │   ├── pages/            #   StatsPage, HistoryPage, UserStatsPage
│   │   └── utils/            #   kpiCalculations, statsData, tips, historyHelpers, ...tests/
│   ├── wearables/            # Health Connect / HealthKit
│   │   ├── api/              #   healthAggregator, wearablesQueries
│   │   ├── components/       #   ConnectionCard, SleepCard, WearablesSummary
│   │   ├── hooks/            #   useWearableConnections, useWearableSync
│   │   ├── pages/            #   WearablesPage
│   │   ├── stores/           #   wearableStore
│   │   └── types/            #   index.ts
│   └── workout/              # Registro en vivo
│       ├── api/              #   workoutMutations
│       ├── components/       #   ExerciseSelector, RestTimer, WorkoutSetList, PlatesCalculator...
│       ├── hooks/            #   useExerciseSearch
│       ├── pages/            #   WorkoutPage, ExerciseLibraryPage
│       ├── stores/           #   workoutStore, restTimerStore
│       └── types/            #   index.ts
├── shared/                   # Infraestructura compartida entre features
│   ├── api/                  #   queries.ts (llamadas a Supabase)
│   ├── components/           #   ErrorBoundary, EmptyStates, SwipeToDelete, icons, ui/
│   │   └── ui/               #   Button, Input, Modal, Skeleton, Badge, BottomSheet...
│   ├── constants/            #   muscleColors
│   ├── hooks/                #   useWeight, useWakeLock, useRateLimit, useBackgroundNotifications
│   ├── lib/                  #   brzycki, supabase, i18n, duration, formatDate, haptics...
│   ├── stores/               #   settingsStore, outboxStore
│   └── styles/               #   tokens.css
├── types/                    # database.types.ts (auto-generado por Supabase)
├── assets/                   # hero.png
```

### Path Aliases

| Alias       | Ruta             |
| :---------- | :--------------- |
| `@`         | `./src`          |
| `@features` | `./src/features` |
| `@shared`   | `./src/shared`   |
| `@app`      | `./src/app`      |

Definidos en `vite.aliases.ts` (fuente única) y sincronizados en `tsconfig.app.json`.

### Convenciones de Código

- **i18n**: todo string visible va por `useTranslation()` / `t()` — nunca literales en JSX
- **Tipos**: `import type` obligatorio, `any` prohibido (forzado por ESLint)
- **Barrel files**: solo donde existen (`@shared/components/ui`, `@features/workout/types/`)
- **Lazy loading**: todas las páginas cargan con `lazy()` en `App.tsx`
- **Tests**: Vitest con `__tests__/` colocalizado, `*.test.ts*` (no `.spec.*`), mock con path alias

---

## Modelo de Datos

PostgreSQL (Supabase) con Row Level Security:

| Tabla                  | Descripción                                                              |
| :--------------------- | :----------------------------------------------------------------------- |
| `profiles`             | Perfil de usuario: nombre, avatar, objetivo, días/semana, notificaciones |
| `exercises`            | Catálogo de ejercicios: grupo muscular, equipamiento, bilateral          |
| `workouts`             | Sesiones de entrenamiento: timestamps, volumen, duración, notas, rating  |
| `workout_sets`         | Series individuales: peso, reps, RPE, warmup, notas                      |
| `workout_exercises`    | Relación workout↔exercise con orden y notas                              |
| `personal_records`     | PRs por ejercicio: peso, reps, 1RM estimado, rep band                    |
| `exercise_notes`       | Notas técnicas por ejercicio                                             |
| `user_routines`        | Rutinas semanales con config JSON                                        |
| `cardio_sessions`      | Sesiones de cardio: tipo, duración, distancia, calorías                  |
| `body_measurements`    | Mediciones corporales: peso, % grasa, masa muscular                      |
| `exercise_goals`       | Objetivos de 1RM por ejercicio                                           |
| `routine_templates`    | Plantillas de rutina predefinidas                                        |
| `push_tokens`          | Tokens de dispositivo para notificaciones FCM                            |
| `wearable_connections` | Conexiones por proveedor (health_connect / healthkit)                    |
| `wearable_daily`       | Métricas diarias: pasos, calorías, FC media/máx/reposo                   |
| `wearable_sleep`       | Sueño por fases: duración, profundo, ligero, REM                         |

---

## Despliegue & DevOps

### 1. Entorno de Desarrollo

```bash
npm install          # Instalar dependencias
npm run dev          # Dev server con HMR (http://localhost:5173)
npm run lint         # ESLint estricto + Prettier
npm run type-check   # tsc --noEmit
npm run test         # Tests Vitest (153 tests)
```

### 2. Build de Producción

```bash
npm run build               # tsc -b + vite build → dist/
npm run build:android       # Build web + cap sync android
npm run apk                 # Build completo + APK firmado
npm run build:ios           # Build web + cap sync ios
```

### 3. CI/CD (GitHub Actions)

| Workflow            | Disparo               | Qué hace                                 |
| :------------------ | :-------------------- | :--------------------------------------- |
| `ci.yml`            | push / PR (main)      | Lint, type-check, tests (Vitest) y build |
| `android-build.yml` | push a main / tags v* | Build web + cap sync + APK firmado       |
| `ios-build.yml`     | manual / push         | Smoke test iOS sin firmar (macOS runner) |
| `react-doctor.yml`  | manual                | Diagnóstico del proyecto React           |

### 4. Utilidades

```bash
npm run gen:types    # Regenerar tipos de Supabase (no tocar a mano)
npm run analyze      # Visualizar bundle (rollup-plugin-visualizer)
npm run coverage     # Tests con cobertura V8
npm run commit       # Commit convencional (Commitizen)
npm run release      # Release + CHANGELOG (standard-version)
npm run icons        # Generar iconos PWA/Android
```

### 5. Variables de Entorno

```bash
VITE_SUPABASE_URL=<url>
VITE_SUPABASE_KEY=<anon-key>
VITE_SENTRY_DSN=<dsn>    # opcional
```

Crear `.env.local` con estos valores. Sin Supabase la app arranca en pantalla negra.

---

## Experiencia Nativa (Capacitor 8)

- **Haptic Feedback**: vibraciones al completar series, guardar y batir PRs
- **Acceso Biométrico**: Face ID (iOS) / huella (Android) — plugin BiometricPlugin propio
- **True Full-Screen**: edge-to-edge con WindowInsets
- **Notificaciones**: locales (alarma descanso, recordatorios) + push remotas (FCM)
- **Deep Links**: `com.franvi.gymlog://workout/new`, `com.franvi.gymlog://history`
- **Compartir**: resumen de entrenamiento vía Web Share API
- **Iconos Adaptativos**: Android 14+, splash screen con branding
- **iOS**: plugins nativos en `ios-custom/` (BiometricPlugin, HealthBridgePlugin) — el directorio `ios/` se regenera con `npx cap add ios`

### Descargar APK

Último APK en **[GitHub Releases](https://github.com/Haplee/gymlog/releases/latest)** o desde la [Landing Page](https://Haplee.github.io/gymlog/).

---

## iOS

El código nativo iOS está en `ios-custom/`:

- `BiometricPlugin.swift` — Face ID / Touch ID vía LocalAuthentication
- `HealthBridgePlugin.swift` — HealthKit (pasos, FC, sueño, workouts)
- `Info.plist.patch.sh` — inyecta URL scheme + NSFaceIDUsageDescription
- `add-plugin-to-target.rb` — registra ficheros en Xcode

El directorio `ios/` es efímero (generado por `npx cap add ios`) y no se versiona.

---

## Changelog reciente

### v4.1

- **Refactor por features**: código reorganizado en features/ autocontenidos, splits de componentes >800 líneas (CardioPage, UserStatsPage, HistoryPage, StatsPage, WorkoutPage)
- **Cardio**: componentes extraídos (ActiveSessionCard, WeeklyStats, SessionHistoryItem)
- **Tests**: 153 tests, estructura `__tests__/` colocalizada
- **Gobernanza**: AGENTS.md canónico con reglas de arquitectura para agentes IA

### v3.1 → v4.0

- Overhaul visual Stitch (Swiss-Athletic): tema oscuro único, design tokens, DM Sans + Geist Mono
- Export/Import Excel (.xlsx) con round-trip verificado
- Offline-first: outbox en IndexedDB con reintentos
- Wearables: Health Connect / HealthKit (plugin HealthBridge propio)
- Avatares en Supabase Storage
- CI iOS + CI de calidad

### v3.0

- Notificaciones push remotas (FCM)
- Biblioteca de ejercicios ampliada
- Calculadora de discos (plates)
- Medidas corporales con seguimiento temporal
- Objetivos de 1RM + proyección de volumen
- Reordenar ejercicios (dnd-kit)
- Persistencia de queries (IndexedDB)
- Captura de errores con Sentry

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=3ECF8E&height=100&section=footer" alt="Footer animated wave" />
</div>

## Autoría y Conexión

<div align="center">
  <br>

  <img src="https://github-readme-stats.vercel.app/api?username=Haplee&show_icons=true&theme=radical&hide_border=true&bg_color=0D1117&icon_color=3ECF8E&text_color=FFFFFF&title_color=3ECF8E" alt="Haplee's GitHub Stats" />

  <br>

  <img src="https://github-readme-streak-stats.herokuapp.com/?user=Haplee&theme=radical&hide_border=true&background=0D1117&ring=3ECF8E&fire=3ECF8E&currStreakNum=FFFFFF" alt="GitHub Streaks" />

<br><br>

<a href="https://github.com/Haplee"><img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://x.com/FranVidalMateo"><img src="https://img.shields.io/badge/Twitter-000000?style=for-the-badge&logo=x&logoColor=white" /></a>
<a href="https://www.instagram.com/franvidalmateo"><img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" /></a>

<br><br>
<b>GymLog v4.1</b> • Diseñado por <a href="https://github.com/Haplee">Haplee</a>

</div>
