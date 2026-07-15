## Why

La biblioteca de ejercicios actual (`ExerciseLibraryPage`) depende de una tabla `exercises` en Supabase con datos limitados y sin guía visual rica (solo un `media_url` opcional). ExerciseDB expone 11.000+ ejercicios con GIFs, imágenes, vídeos e instrucciones paso a paso, filtrables por parte del cuerpo, músculo objetivo y equipamiento. Integrarlo da a los usuarios una guía visual real al elegir y ejecutar ejercicios, sin que el equipo mantenga el dataset a mano.

## What Changes

- Nuevo cliente de API para ExerciseDB en `src/features/workout/api/`, apuntando por defecto al endpoint gratuito open-source (`v2.exercisedb.io` / `oss.exercisedb.dev`) **sin clave**, con override opcional a RapidAPI mediante variables de entorno Vite (`VITE_EXERCISEDB_BASE_URL`, `VITE_EXERCISEDB_RAPIDAPI_KEY`).
- Búsqueda y filtrado de ejercicios por nombre, parte del cuerpo, músculo objetivo y equipamiento contra el catálogo ExerciseDB.
- Vista de detalle de ejercicio con GIF/imagen/vídeo, músculos primarios y secundarios, equipamiento e instrucciones paso a paso.
- Capa de mapeo que normaliza la respuesta de ExerciseDB al modelo de dominio de GymLog, de modo que la UI no dependa del shape crudo de la API.
- Caché y estados de carga/error vía TanStack Query (con reintentos y `staleTime` largos por la naturaleza estática del catálogo).
- Selección de un ejercicio del catálogo al registrar un entrenamiento, rellenando nombre/músculo/equipamiento en el flujo existente de `WorkoutPage`.
- **Convivencia de fuentes:** los ejercicios propios/públicos de Supabase (tabla `exercises`) y el catálogo ExerciseDB se muestran de forma unificada en la UI, distinguidos visualmente (p. ej. badge "Mío" vs "Catálogo").
- **Creación de ejercicios propios preservada:** el usuario sigue pudiendo crear y gestionar sus ejercicios propios exactamente como hoy (sin regresión en el flujo de Supabase).
- i18n de todos los strings nuevos (español) y respeto de los tokens de diseño y touch targets ≥44px.

## Capabilities

### New Capabilities

- `exercise-catalog`: Acceso al catálogo externo de ExerciseDB — cliente de API con configuración de endpoint/clave, búsqueda y filtrado por parte del cuerpo / músculo / equipamiento, normalización al modelo de dominio, y caché con TanStack Query.
- `exercise-catalog-ui`: Interfaz para explorar el catálogo (buscador, chips de filtro, lista) y ver el detalle de un ejercicio con su media (GIF/imagen/vídeo) e instrucciones, además de seleccionarlo para un entrenamiento.

### Modified Capabilities

<!-- No existen specs previos en openspec/specs/. La biblioteca actual basada en Supabase (ejercicios propios + públicos, con creación de propios) se CONSERVA sin regresión; ExerciseDB se añade como fuente adicional y ambas se unifican en la UI de exploración. -->

## Impact

- **Código nuevo:** `src/features/workout/api/exercisedb.ts` (cliente + tipos), `src/features/workout/utils/mapExercise.ts` (normalización), hooks `useExerciseCatalog` / `useExerciseDetail`, y componentes de UI de catálogo/detalle.
- **Código modificado:** flujo de alta de ejercicio en `WorkoutPage` para permitir elegir del catálogo; posible enlace desde `ExerciseLibraryPage`.
- **Configuración:** nuevas variables de entorno Vite documentadas en `.env.example`; sin secretos en el bundle por defecto (endpoint gratuito sin clave).
- **Dependencias:** ninguna nueva (se usa `fetch` + TanStack Query ya presentes). Si se decide validar respuestas, se reutiliza Zod ya instalado.
- **Red/PWA:** llamadas a dominio externo; considerar comportamiento offline (el service worker no cachea la API por defecto) y CORS del endpoint gratuito.
- **Licencia:** ExerciseDB es AGPL-3.0 y el uso de datos vía RapidAPI está sujeto a sus términos; se consume como servicio remoto, sin redistribuir el dataset.
