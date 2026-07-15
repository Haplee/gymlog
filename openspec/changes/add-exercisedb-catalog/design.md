## Context

GymLog es una PWA + app Android (React 19 + TS strict + Vite 6, Zustand + TanStack Query, Supabase backend). Hoy la biblioteca de ejercicios (`src/features/workout/pages/ExerciseLibraryPage.tsx`) se alimenta de una tabla `exercises` en Supabase mediante `fetchExerciseLibrary` (`src/shared/api/queries.ts`), con un modelo pobre (`LibraryExercise`) y guía visual mínima.

ExerciseDB ya no es un repo self-hosteable: su GitHub solo contiene `LICENSE` (AGPL-3.0) y `README`. Se consume como **API remota**. Existen dos vías: un endpoint gratuito open-source sin clave (`v2.exercisedb.io` / `oss.exercisedb.dev`) y RapidAPI (`exercisedb.p.rapidapi.com`) con `x-rapidapi-key`. El objetivo es integrar su catálogo (11.000+ ejercicios con GIF/imagen/vídeo e instrucciones) sin acoplar la app al shape crudo ni a un proveedor concreto.

## Goals / Non-Goals

**Goals:**

- Cliente ExerciseDB configurable por env, con endpoint gratuito por defecto y RapidAPI opcional.
- Búsqueda y filtrado por parte del cuerpo, músculo objetivo y equipamiento.
- Detalle con media (GIF/imagen/vídeo) e instrucciones.
- Modelo de dominio normalizado; UI desacoplada de la API.
- Caché/estado con TanStack Query, i18n y tokens de diseño.
- Poder seleccionar un ejercicio del catálogo al registrar un entrenamiento.

**Non-Goals:**

- Reemplazar o migrar la tabla `exercises` de Supabase (el catálogo ExerciseDB es fuente adicional, no sustituta).
- Persistir/redistribuir el dataset ExerciseDB localmente (licencia AGPL/RapidAPI).
- Soporte offline completo del catálogo remoto (más allá de la caché de TanStack Query en memoria/persistida existente).
- Modo claro u otros cambios de diseño.

## Decisions

- **Endpoint gratuito por defecto, RapidAPI opcional vía env.**
  `VITE_EXERCISEDB_BASE_URL` (default: endpoint OSS) + `VITE_EXERCISEDB_RAPIDAPI_KEY` (opcional). Si hay key, se añaden `x-rapidapi-key`/`x-rapidapi-host`; si no, sin auth. _Alternativa descartada:_ forzar RapidAPI → requiere clave en el bundle y plan de pago; peor DX y riesgo de secreto expuesto.

- **Capa de mapeo (`utils/mapExercise.ts`) a un modelo interno estable.**
  Un `CatalogExercise { id, name, mediaUrl, videoUrl?, bodyParts[], targetMuscles[], secondaryMuscles[], equipment[], instructions[] }`. La UI solo depende de este tipo. _Alternativa descartada:_ usar el JSON crudo en componentes → frágil ante cambios de la API y difícil de mockear en tests.

- **TanStack Query con `staleTime` largo + reintentos.**
  El catálogo es casi estático; `staleTime` de horas y `gcTime` amplio reducen red. Se reutiliza el `queryClient`/persister ya existentes. _Alternativa descartada:_ fetch manual con estado en Zustand → reinventaría caché/reintentos que Query ya da.

- **Ubicación en el feature `workout`.**
  `src/features/workout/api/exercisedb.ts` (fetch + tipos raw), `utils/mapExercise.ts`, `hooks/useExerciseCatalog.ts` + `useExerciseDetail.ts`, y componentes de UI co-locados. Coherente con la arquitectura por-feature del repo.

- **Convivencia de fuentes con modelo común y origen etiquetado.**
  Los ejercicios de Supabase (`exercises`: propios `user_id` + públicos) y los de ExerciseDB se proyectan a un modelo unificado con un campo `source: 'own' | 'public' | 'exercisedb'`. La UI de exploración lista ambas fuentes y las distingue visualmente (badge). _Alternativa descartada:_ dos pantallas separadas → peor UX y duplica buscador/filtros.

- **Creación de ejercicios propios intacta.**
  Se preserva el flujo actual (tabla `exercises` con `user_id`, RPC `get_exercises_with_usage`). ExerciseDB es de solo lectura; no se escribe el catálogo remoto en Supabase salvo que el usuario "guarde" explícitamente un ejercicio del catálogo como propio (fuera de alcance inicial). _Alternativa descartada:_ sincronizar/importar todo ExerciseDB a Supabase → coste, licencia y mantenimiento innecesarios.

- **Validación ligera opcional con Zod (ya instalado).**
  Se valida/parsea la respuesta antes de mapear para fallar de forma controlada. Sin dependencias nuevas.

- **Sin secretos en cliente por defecto.**
  Con el endpoint gratuito no hay clave en el bundle. Si el usuario configura RapidAPI, la clave viaja como env de build (documentar el trade-off en `.env.example`).

## Risks / Trade-offs

- **CORS / estabilidad del endpoint gratuito** → Mitigación: base URL configurable para cambiar a RapidAPI; manejar error state con retry en la UI.
- **Clave RapidAPI expuesta en bundle si se activa** → Mitigación: documentar que para producción con clave conviene un proxy/edge function; por defecto no se usa clave.
- **Rate limits del tier gratuito** → Mitigación: debounce de búsqueda, `staleTime` largo, cachear detalle por id.
- **Media pesada (GIF/vídeo) en móvil/Android WebView** → Mitigación: carga lazy, `object-contain`, thumbnails; vídeo bajo demanda, no autoplay.
- **PWA offline:** el service worker no cachea la API externa → el catálogo requiere red; se acepta como Non-Goal, la UI muestra estado offline/error.
- **Cumplimiento de licencia (AGPL/RapidAPI ToS)** → Mitigación: consumir como servicio remoto, no redistribuir datos; atribución si aplica.

## Migration Plan

1. Añadir cliente, tipos, mapeo y hooks (sin tocar UI existente).
2. Añadir componentes de catálogo/detalle y ruta o entrada desde el flujo de workout, detrás del env por defecto (gratuito).
3. Documentar envs en `.env.example`.
4. Rollback: la feature es aditiva; retirar la entrada de UII deja intacta la `ExerciseLibraryPage` basada en Supabase.

## Resolved Decisions

- **Convivencia (no reemplazo):** ExerciseDB convive con la biblioteca de Supabase. El usuario sigue creando y gestionando sus ejercicios propios sin cambios. Ambas fuentes se unifican en la UI de exploración, distinguidas por `source`/badge.
- **Proveedor por defecto:** endpoint gratuito open-source **sin clave** — lo mejor para el proyecto (sin coste, sin secreto en el bundle, sin plan de pago; encaja con PWA/AGPL). RapidAPI queda como override opcional por env de build.

## Open Questions

- URL base y rutas exactas del endpoint OSS a fijar como default (confirmar `v2.exercisedb.io` vs `oss.exercisedb.dev` y paths `/exercises`, `/bodyParts`, etc.). — se valida en la tarea 1.2.
- (Futuro, fuera de alcance) ¿Permitir "guardar como propio" un ejercicio del catálogo, copiándolo a la tabla `exercises`?
