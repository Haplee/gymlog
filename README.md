# GymLog

> Registro de entrenamientos enfocado en fiabilidad, privacidad y experiencia nativa. Diseñado para levantar pesas, no para luchar contra la app.

![GymLog banner](https://capsule-render.vercel.app/api?type=waving&color=ffd93d&height=200&section=header&text=GymLog&fontSize=70&fontAlignY=35&desc=Registro%20de%20entrenamientos%20nativo%2C%20privado%20y%20sin%20ruido&descAlignY=55&descAlign=50)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Capacitor](https://img.shields.io/badge/Platform-Capacitor-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-1563%20passing-brightgreen)](https://github.com/Haplee/gymlog/actions)

---

## Qué ofrece GymLog

### Sesiones de fuerza

- **Entrenamiento guiado** serie a serie con descansos, RPE/RIR y notas por serie.
- **Rutinas predefinidas** (Full Body, PPL, Hipertrofia, Fuerza 5×5, Upper/Lower, 5/3/1, Balonmano+Fuerza, Pivote 5 días) y **rutinas personalizadas** con arrastrar-y-soltar.
- **Progresión automática** por escalones de carga, calentamiento y peso de trabajo.
- **Registros personales** por banda de repeticiones (1–3, 4–6, 7–10, 11–15, 16+).
- **Historial navegable** con filtros por ejercicio, músculo, fecha y banda de repeticiones.

### Catálogo de ejercicios ampliado (v5.15.5+)

- **200+ ejercicios públicos** con nombres, grupos musculares, equipamiento, patrón de movimiento, bilateralidad, composición, descripciones técnicas y **aliases** (sinónimos/variantes ortográficas).
- **129 ejercicios nuevos** añadidos: variantes de máquinas (Smith, Landmine), anillas/TRX, kettlebells, balón medicinal, trineo, pliometría (cajón, vallas, comba, cuerdas), olímpicos (Snatch, Clean & Jerk), core funcional (Dead Bug, Bird Dog, Copenhagen, Landmine rotations), manguito rotador, agarre/antebrazo y cuerpo libre avanzado (Muscle-Up, HSPU, Pistol Squat).
- **10 nuevos tipos de equipamiento**: `Máquina Smith`, `Anillas / TRX`, `Landmine`, `Balón medicinal`, `Trineo`, `Cajón pliométrico`, `Vallas`, `Comba`, `Cuerdas` (además de `Barra`, `Mancuernas`, `Máquina`, `Polea`, `Peso corporal`, `Bandas`, `Kettlebell`, `Otro`).
- **Búsqueda tolerante a tildes y erratas**: columna generada `search_text` con índice GIN `pg_trgm` + función `public.f_unaccent` + hook `useExerciseSearch` con normalización NFD (elimina diacríticos) y puntuación fuzzy (coincidencia exacta → prefijo → subsecuencia) sobre `name` y `aliases`.
- **RPC `get_exercises_with_usage` actualizada** devuelve `aliases[]` junto con todas las columnas del ejercicio y `usage_count`.

### Cardio y salud

- **Sesiones de cardio** (correr, bici, natación, remo, elíptica, caminata) con distancia, tiempo, FC media/máx, RPE y notas.
- **Integración Health Connect (Android) / HealthKit (iOS)**: pasos, FC, sueño, entrenamientos.
- **Métricas wearables** (sueño, HRV, recuperación, carga) sincronizadas en segundo plano.

### Progresión y análisis

- **Fatiga aguda/crónica** (ACWR), monótonía, strain.
- **Readiness** diario combinando sueño, HRV, fatiga y enfermedad.
- **Volumen semanal por grupo muscular** y **último entrenamiento por músculo**.
- **Proyección 1RM** (Epley/Brzycki) y **e1RM por banda de repeticiones**.

### Experiencia de usuario

- **Modo oscuro/claro/sistema** con persistencia y transiciones suaves.
- **Temporizadores de descanso** con cuenta atrás, vibración y sonido configurable.
- **Wake Lock** opcional para mantener la pantalla encendida.
- **Accesibilidad**: etiquetas ARIA, contraste AA, navegación por teclado, `prefers-reduced-motion`.
- **PWA instalable** con Service Worker y sincronización en segundo plano (Workbox + IndexedDB outbox).

### Sincronización y privacidad

- **Supabase (PostgreSQL + Auth + Realtime)**: datos en la nube del usuario, cifrados en tránsito y en reposo.
- **RLS por usuario** en todas las tablas; catálogo público (`is_public = true`) legible por todos.
- **Outbox local** para escrituras offline-first con reintento exponencial.
- **Exportación/importación JSON** completa de entrenamientos, rutinas, ejercicios personales y ajustes.
- **Eliminación de cuenta** con purga cascada (RGPD Art. 17).

---

## Arquitectura técnica

### Stack

| Capa                 | Tecnología                                             |
| -------------------- | ------------------------------------------------------ |
| UI                   | React 19 + TypeScript + Vite 6                         |
| Estilos              | Tailwind CSS 4 (CSS-first, `@theme`)                   |
| Estado               | Zustand (stores) + TanStack Query v5 (server state)    |
| Formularios          | React Hook Form + Zod                                  |
| Internacionalización | i18next (ES/EN)                                        |
| Animaciones          | Framer Motion (layout, shared layout, AnimatePresence) |
| Notificaciones       | Sonner (toasts)                                        |
| Base de datos        | Supabase (PostgreSQL 16)                               |
| Auth                 | Supabase Auth (email/password, OAuth, MFA)             |
| Realtime             | Supabase Realtime (cambios de rutinas/entrenamientos)  |
| Storage              | Supabase Storage (avatares, medios de ejercicios)      |
| Edge Functions       | Deno (webhooks, tareas programadas, Health sync)       |
| Mobile               | Capacitor 6 (iOS/Android)                              |
| CI/CD                | GitHub Actions (lint, type-check, test, build, deploy) |

### Base de datos — tablas clave

| Tabla                | Propósito                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercises`          | Catálogo público + personales (`user_id` nullable). Columnas: `id`, `name`, `muscle_group`, `muscle_detail`, `equipment`, `movement`, `is_bilateral`, `user_id`, `created_at`, `is_compound`, `description`, `is_public`, `media_url`, `is_bodyweight`, `load_type`, `aliases text[]`, `search_text` (generated). Índices: `search_text` GIN `pg_trgm`, `user_id`, `muscle_group`, `is_public`, `exercises_user_lower_name_uniq` (partial unique `lower(name)` por usuario). |
| `exercise_muscles`   | Músculos ponderados por ejercicio (`exercise_id`, `muscle_group`, `role` primary/secondary, `weight 0–100`). RLS vía ejercicio padre.                                                                                                                                                                                                                                                                                                                                        |
| `exercise_favorites` | Favoritos por usuario (`user_id`, `exercise_id`).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `workouts`           | Cabecera de entrenamiento (`id`, `user_id`, `started_at`, `finished_at`, `routine_id`, `notes`, `rating`, `hash`).                                                                                                                                                                                                                                                                                                                                                           |
| `workout_sets`       | Series (`id`, `workout_id`, `exercise_id`, `set_index`, `weight`, `reps`, `rir`, `weight_unit`, `is_warmup`, `is_completed`, `hash`).                                                                                                                                                                                                                                                                                                                                        |
| `personal_records`   | PRs por banda de repeticiones (`user_id`, `exercise_id`, `rep_band`, `weight`, `reps`, `one_rm`, `achieved_at`). Único `(user_id, exercise_id, rep_band)`.                                                                                                                                                                                                                                                                                                                   |
| `user_routines`      | Rutinas del usuario (JSONB versionado + `active_routine_id`).                                                                                                                                                                                                                                                                                                                                                                                                                |
| `profiles`           | Perfil público/privado (`id`, `username`, `avatar_url`, `preferences` JSONB).                                                                                                                                                                                                                                                                                                                                                                                                |
| `cardio_sessions`    | Sesiones cardio (`user_id`, `type`, `started_at`, `duration`, `distance`, `hr_avg`, `hr_max`, `rpe`, `notes`, `hash`).                                                                                                                                                                                                                                                                                                                                                       |
| `health_sessions`    | Datos Health Connect/HealthKit normalizados.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wearable_*`         | Métricas wearables (daily, sleep, connections).                                                                                                                                                                                                                                                                                                                                                                                                                              |

### RPC destacadas

| Función                                    | Descripción                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `get_exercises_with_usage(p_user_id uuid)` | Devuelve ejercicios (propios + públicos) con `usage_count` y **`aliases[]`**. Orden: uso descendente, nombre. |
| `save_workout_with_sets(...)`              | Upsert idempotente de entrenamiento + series (hash por fila).                                                 |
| `save_cardio_session(...)`                 | Upsert idempotente de cardio.                                                                                 |
| `import_health_sessions(uuid, jsonb)`      | Ingesta Health Connect/HealthKit con deduplicación.                                                           |
| `import_wearable_workouts(uuid, jsonb)`    | Ingesta wearables.                                                                                            |

---

## Desarrollo local

### Requisitos

- Node.js 20+ (`.nvmrc`)
- pnpm 9+
- Docker Desktop / Docker Engine (para Supabase local)
- Supabase CLI (`pnpm dlx supabase` o `npm i -g supabase`)

### Puesta en marcha

```bash
# 1. Clonar e instalar
git clone https://github.com/Haplee/gymlog.git
cd gymlog
pnpm install

# 2. Variables de entorno
cp .env.example .env.local
# Rellenar VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (o usar `supabase start`)

# 3. Supabase local (opcional)
pnpm dlx supabase start
# Aplica migraciones y expone: API http://127.0.0.1:54321, Studio http://127.0.0.1:54323

# 4. Desarrollo
pnpm dev          # Vite dev server (http://localhost:5173)
pnpm test         # Vitest (unit + integration)
pnpm typecheck    # tsc --noEmit
pnpm lint         # ESLint + Prettier
pnpm build        # Build producción (dist/)

# 5. Mobile (Capacitor)
pnpm cap sync
pnpm cap open ios     # Xcode
pnpm cap open android # Android Studio
```

### Migraciones

```bash
# Crear nueva migración
pnpm dlx supabase migration new nombre_descriptivo

# Aplicar local
pnpm dlx supabase db reset    # reset + apply all
pnpm dlx supabase db push     # apply pending

# Subir a remoto (producción)
pnpm dlx supabase db push --remote --yes
```

### Tests

```bash
pnpm test              # watch mode
pnpm test -- --run     # CI mode (1563 tests)
pnpm test -- --coverage
```

---

## Despliegue

### Web (Vercel/Netlify/Cloudflare Pages)

- Build command: `pnpm build`
- Output: `dist/`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA fallback: `index.html`

### Mobile (Capacitor)

- iOS: `pnpm cap build ios` → Archive en Xcode → TestFlight / App Store
- Android: `pnpm cap build android` → Bundle/APK en Android Studio → Play Console
- **Auto-deploy**: GitHub Actions en push a `main` (build + test + deploy web + artifacts mobile)

### Supabase (Producción)

- Proyecto vinculado: `gymlog (eoltmipoklizewxdpzfa)`
- Migraciones aplicadas vía `supabase db push --remote`
- Edge Functions: `supabase functions deploy <name> --project-ref <ref>`
- Secrets: `supabase secrets set KEY=value --project-ref <ref>`

---

## Variables de entorno

| Variable                    | Descripción                  | Requerida    |
| --------------------------- | ---------------------------- | ------------ |
| `VITE_SUPABASE_URL`         | URL del proyecto Supabase    | Sí           |
| `VITE_SUPABASE_ANON_KEY`    | Clave anónima (cliente)      | Sí           |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (scripts/admin) | Solo scripts |
| `GYMLOG_USER_ID`            | UUID usuario para seeds      | Solo seeds   |

---

## Scripts útiles

```bash
# Seed catálogo + rutinas predefinidas (requiere SUPABASE_SERVICE_ROLE_KEY)
pnpm dlx tsx scripts/seed-rutinas.mjs

# Actualizar rutinas en remoto
pnpm dlx tsx scripts/maintenance/update-routines.mjs

# Lint-staged (pre-commit)
pnpm lint-staged

# Type-check estricto
pnpm typecheck
```

---

## Contribuir

1. Fork → rama `feat/descripcion-corta` o `fix/descripcion-corta`
2. Commits convencionales (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
3. `pnpm lint && pnpm typecheck && pnpm test -- --run` en verde
4. PR a `main` con descripción y capturas si hay cambios visuales
5. Revisión: al menos una aprobación + CI verde → merge squash

---

## Licencia

MIT — ver [LICENSE](./LICENSE).

---

## Changelog

El registro completo se encuentra en **[CHANGELOG.md](./CHANGELOG.md)**.

### v5.15.5 — Catálogo de ejercicios ampliado y búsqueda inteligente

- **Catálogo público**: +129 ejercicios (200+ total) con variantes de máquinas Smith, Landmine, anillas/TRX, kettlebells, balón medicinal, trineo, pliometría avanzada, olímpicos, core funcional, manguito rotador, agarre/antebrazo y cuerpo libre avanzado.
- **Equipamiento**: 10 nuevos tipos (`Máquina Smith`, `Anillas / TRX`, `Landmine`, `Balón medicinal`, `Trineo`, `Cajón pliométrico`, `Vallas`, `Comba`, `Cuerdas`).
- **Búsqueda tolerante a tildes/erratas**: `unaccent` + `pg_trgm`, columna generada `search_text` con índice GIN, función `public.f_unaccent` IMMUTABLE, hook `useExerciseSearch` con normalización NFD y fuzzy scoring sobre `name` + `aliases[]`.
- **RPC `get_exercises_with_usage`** ahora devuelve `aliases[]` para autocompletado enriquecido.
- **Migraciones**: `20261120150000_seed_additional_catalog_exercises.sql` (idempotente, `WHERE NOT EXISTS` con `lower(public.f_unaccent(name))`).

### v5.15.4 — Fiabilidad y progresión del entrenamiento

- **Validación consistente de series:** evita diferencias entre la pantalla y el almacenamiento que puedan descartar datos introducidos correctamente.
- **Ejercicios sin carga externa:** compatibilidad con series de `0 kg` cuando el ejercicio no requiere lastre.
- **Finalización de rutinas:** identificación persistente de las operaciones guardadas para impedir duplicados en los reintentos.
- **Errores por fila:** mensajes de validación asociados a las series que necesitan corrección.
- **Progresión adaptada al material:** configuración de escalones de carga para recomendar pesos disponibles en el gimnasio.
- **Calentamiento progresivo:** representación de los escalones de aproximación y del peso de trabajo.
- **Recordatorios:** planificación de avisos según la fecha y la hora en que deben ejecutarse.
- **Mejoras de experiencia:** mayor claridad sobre el plan de cada serie y los ajustes manuales de carga.
  Para consultar los cambios específicos y sus commits:
- [Historial de commits](https://github.com/Haplee/gymlog/commits/main/)
- [Releases de GymLog](https://github.com/Haplee/gymlog/releases)
- [Changelog completo](./CHANGELOG.md)

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=ffd93d&height=100&section=footer" alt="GymLog footer" />
</div>
## Autoría
<div align="center">
  <img src="https://github-readme-stats.vercel.app/api?username=Haplee&show_icons=true&theme=radical&hide_border=true&bg_color=0D1117&icon_color=ffd93d&text_color=FFFFFF&title_color=ffd93d" alt="GitHub Stats" />
  <br>
  <img src="https://github-readme-streak-stats.herokuapp.com/?user=Haplee&theme=radical&hide_border=true&background=0D1117&ring=ffd93d&fire=ffd93d&currStreakNum=FFFFFF" alt="GitHub Streak" />
<br><br>
<a href="https://github.com/Haplee"><img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" /></a>
<a href="https://x.com/FranVidalMateo"><img src="https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white" alt="X" /></a>
<a href="https://www.instagram.com/franvidalmateo"><img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram" /></a>
<br><br>
<b>GymLog v5.15.5</b> — <a href="https://github.com/Haplee">Francisco Vidal Mateo</a>
</div>
