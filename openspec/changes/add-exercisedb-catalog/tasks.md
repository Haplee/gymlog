> **Nota de implementación:** El tier gratuito de ExerciseDB (`oss.exercisedb.dev/api/v1`)
> solo soporta **búsqueda por texto** (`/exercises/search`), detalle por id y listas de
> opciones. El listado no pagina de forma fiable (siempre devuelve la primera página) y
> **no** hay filtrado server-side por atributo. Por eso el catálogo es **guiado por
> búsqueda** en lugar de un browse paginado con filtros server-side. El filtrado por
> parte del cuerpo/músculo/equipamiento queda como mejora futura (client-side sobre
> resultados) — ver tareas 3.1 y 5.2.

## 1. Configuración y cliente de API

- [x] 1.1 Documentar `VITE_EXERCISEDB_BASE_URL` y `VITE_EXERCISEDB_RAPIDAPI_KEY` en `.env.example` con el default gratuito (OSS)
- [x] 1.2 Confirmar la base URL y rutas del endpoint OSS (`/exercises`, `/exercises/search`, `/exercises/{id}`) — filtros server-side NO disponibles en tier gratuito
- [x] 1.3 Crear `src/features/workout/api/exercisedb.ts`: tipos raw + `searchExercises`, `fetchFeaturedExercises`, `fetchExerciseById`
- [x] 1.4 Añadir headers RapidAPI (`x-rapidapi-key`/`x-rapidapi-host`) solo cuando haya clave; sin auth por defecto
- [ ] 1.5 (Opcional) Validar respuestas con Zod antes de mapear, con fallo controlado — diferido

## 2. Modelo de dominio y hooks

- [x] 2.1 Definir `CatalogExercise` y mapper en `src/features/workout/utils/mapExercise.ts` (defaults seguros para campos opcionales/media ausente)
- [x] 2.2 Crear `hooks/useExerciseCatalog.ts` (TanStack Query, `staleTime` largo, reintentos, debounce de búsqueda)
- [x] 2.3 Crear `useExerciseDetail` (query por id, cacheada) — en `useExerciseCatalog.ts`
- [x] 2.4 Tests unitarios del mapper (record completo, media ausente, campos faltantes)

## 3. UI de catálogo

- [x] 3.1 Componente de lista de catálogo con buscador, touch targets ≥44px, tokens de diseño (chips de filtro server-side no soportados por el tier gratuito → futuro)
- [x] 3.2 Estados de carga (skeleton), vacío y error (con retry), todos vía i18next
- [x] 3.3 Thumbnails con carga lazy y alt descriptivo
- [x] 3.4 Añadir strings i18n (es + en) para todos los textos nuevos

## 4. UI de detalle

- [x] 4.1 Vista de detalle con media (GIF/imagen) lazy y degradación si falta
- [x] 4.2 Reproductor/afordancia de vídeo cuando exista `videoUrl` (enlace externo, sin autoplay)
- [x] 4.3 Renderizar músculos primarios/secundarios, equipamiento e instrucciones como lista ordenada

## 5. Convivencia de fuentes (Supabase + ExerciseDB)

- [x] 5.1 Definir modelo unificado con `source: 'own' | 'public' | 'exercisedb'` y proyectar el catálogo a él
- [x] 5.2 Toggle segmentado "Mis ejercicios" / "Catálogo" en `ExerciseLibraryPage` (Supabase + ExerciseDB conviven)
- [x] 5.3 Badge/indicador visual de origen en cada ítem de la lista (tokens de diseño, i18n)
- [x] 5.4 Verificar sin regresión el alta de ejercicios propios (no se tocó el flujo de Supabase/WorkoutPage)

## 6. Integración con el flujo de entrenamiento

- [x] 6.1 Botón "Usar en entreno" en el detalle del catálogo (setea `customExerciseName` y navega a `/`)
- [x] 6.2 Prefill del nombre del ejercicio en el flujo de workout
- [x] 6.3 Salir sin seleccionar deja el flujo existente sin cambios

## 7. Verificación y calidad

- [x] 7.1 Probar layout en Android WebView — verificado en dispositivo (toggle, badges, búsqueda, lista con GIFs, detalle con media/músculos/instrucciones)
- [x] 7.2 Comprobar comportamiento offline/error de red (estado de error visible con retry, no crash)
- [x] 7.3 Confirmar que crear/editar ejercicios propios sigue funcionando (sin regresión; código no modificado)
- [x] 7.4 `lint && type-check && test` en verde (182 tests)
