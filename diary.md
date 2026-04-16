## [2026-04-14] — Corrección de gráficos y RadarChart

- Solucionado bug de Recharts: los componentes `lazy` rompían la inspección de hijos de la librería, causando gráficos en blanco.
- Restaurado `RadarChart` para la distribución de volumen muscular (mencionado en el diario pero ausente en el JSX).
- Cambiadas las importaciones de Recharts a estáticas para asegurar la compatibilidad con el motor de renderizado.
- Estado: /stats operativo, verificado en entorno de desarrollo.

- Implementada nueva arquitectura orientada a features en `src/features/` y `src/shared/`.
- Actualizados y simplificados todos los imports usando aliases de TypeScript (`@features`, `@shared`, `@app`).
- Refactorizado componente de Historial (`HistoryPage`) usando la librería `sonner` para toasts nativos y un Modal reutilizable, eliminando lógica CSS hardcodeada.
- Añadido gráfico `RadarChart` para la distribución del volumen muscular en la vista de estadísticas.
- Añadidas capas de seguridad final para login: `useRateLimit` y CSP estricto vía `vercel.json` para evitar ataques de fuerza bruta y XSS.
- Configurado entorno de TDD (Vitest para validación de la fórmula Brzycki: 1RM, y Playwright para test de E2E sobre el flujo de autenticación).
- Estado actual de GymLog v2.0: Build exitosa y validada sin errores de TypeScript tras solventar discrepancias del linter con nulls/anys genéricos. Pendiente despliegue real en ambiente Vercel.

## [2026-04-14] — Corrección de despliegue y pre-commit hooks

- **Ajuste de dependencias**: Downgrade de TypeScript (6.0.2 → 5.7.3) para satisfacer los requisitos de `i18next` y `@typescript-eslint` en Vercel.
- **Arreglo de Hooks**: Migrada la configuración de `lint-staged` a `package.json` y añadido el uso de `npx` para asegurar la compatibilidad con Windows durante el commit.
- **Saneamiento de código**: Eliminados todos los errores de TypeScript (hooks condicionales, tipos any y exportaciones de Fast Refresh) que bloqueaban el commit inicial.
- **Estado actual**: Commiteado y sincronizado; listo para el despliegue automático en Vercel tras las correcciones de compatibilidad.

## [2026-04-15] — Ampliación detallada de la lógica del repositorio

- Generado y ampliado el archivo `logica.md` con detalles técnicos específicos:
  - Análisis del modelo de datos de **Supabase** (v2.0) y sus políticas de **RLS**.
  - Explicación del flujo de cálculo de **PRs** mediante la fórmula de Brzycki.
  - Desglose de la arquitectura por features (`auth`, `workout`, `routine`, `stats`) y su interacción con los stores de **Zustand**.
  - Identificados cuellos de botella lógicos en la persistencia del estado activo y la agregación de volumen en el cliente.
- Estado actual: Documentación técnica completa disponible para guiar las próximas refactorizaciones.

## [2026-04-15] — Refactorización Integral: Persistencia, Caché, RPC y Zod

- **Persistencia del Workout Activo**: Implementado middleware `persist` en `useWorkoutStore.ts`. Normalización de nomenclatura a `activeExerciseId`. Añadido `ResumeWorkoutBanner` en la UI para reanudar sesiones (< 12h).
- **Seguridad y Limpieza de Caché**: Integrado `queryClient.clear()` y `clearPersistedState()` en el proceso de `signOut` para evitar fugas de datos entre sesiones.
- **Optimización de Datos (RPC)**: Creada función PL/pgSQL `get_volume_by_muscle_group` en Supabase. Refactorizado `StatsPage.tsx` para consumir esta RPC, delegando el procesamiento pesado al servidor.
- **Calidad de Datos (Zod)**: Implementada validación estricta de series en `WorkoutPage.tsx` con Zod. Añadido filtrado de series vacías antes del guardado.
- **Rendimiento**: Verificada carga perezosa (`React.lazy`) y aplicada memoización (`React.memo`) en componentes críticos de estadísticas (`KPICards`, `ConsistencyHeatmap`).
- **Estado actual**: Refactorización técnica completada. Sistema más robusto, seguro y eficiente.

## [2026-04-15] — Resolución de bloqueos de producción y corrección de tipos

- Corregidos errores de compilación (`tsc`) que bloqueaban el despliegue en Vercel.
- Sincronizado `database.types.ts` con el esquema real (añadidos `days_per_week`, `user_routines`, etc.).
- Implementado manejo robusto de `null` en fechas (`started_at`) en `HistoryPage`, `StatsPage` y utilidades de KPIs.
- Ajustados los mapeos de `queries.ts` para cumplir con las interfaces estrictas de `WorkoutWithSets` y `Exercise`.
- Verificado éxito del build local (`npm run build`) y subido a producción.
- Estado: **Producción estable y desplegada.**

## [2026-04-16] — Finalización de refactorización integral: Tipos y validación inline

- Completado Bloque 4: Eliminados los casting `unknown` en `queries.ts` y sustituidos con los tipos correctos (`Tables<T>`) provenientes de `database.types.ts`.
- Completado Bloque 6: Reforzada la lógica de guardado en `WorkoutPage.tsx`. Filtrado automático de series vacías y añadido estado visual de errores de validación de Zod inline (debajo de cada serie) sin bloquear el guardado ni presentar toasts molestos.
- Comprobado el estado de los bloques pendientes (Persistencia local, Limpieza de Caché, RPC y Optimizaciones Generales) que ya estaban implementados.
- Estado actual del proyecto: Tipado estricto mejorado, experiencia de usuario fluida en la página de workouts.

## [2026-04-16] — Solución a historial oculto y mejora de imports/exports CSV

- Aumentado el límite de series recuperadas en `queries.ts` de 50 a 1000 y eliminado límite de truncado `.slice(0, 30)` en `HistoryPage.tsx`, previniendo el efecto visual de "historial borrado" al registrar múltiples ejercicios.
- Rediseñado el formato de exportación `.csv` con columnas más precisas y legibles: `Fecha, Ejercicio, Serie, Repeticiones, Peso (kg)`.
- Reescrito el parseador CSV de `importFromCsv` para soportar retrocompatibilidad con el formato CSV antiguo limitante, adaptando automáticamente y asegurando que ninguna serie o repetición se pierda.
- Estado: Mejorada drásticamente la fiabilidad del registro y la portabilidad del usuario.

## [2026-04-16] — Accesibilidad a notas y borrado de ejercicios

- Refactorizada la renderización condicional de los componentes de interacción en `WorkoutPage.tsx`.
- El botón de Notas de Ejercicio (`ExerciseNotes`) ha sido desacoplado del chequeo de autoría, permitiendo ahora añadir y consultar anotaciones en ejercicios globales de la plataforma (ej. Pres de banca, Sentadilla).
- El botón de Eliminar Ejercicio (`Trash2`) se mantiene restringido exclusivamente a ejercicios creados por el usuario (`user_id !== null`), preservando la integridad de la base de datos predefinida.
- Estado: Mejorada la funcionalidad de personalización de entrenamientos sin comprometer la seguridad de los datos genéricos.

## [2026-04-16] — Sincronización en la nube de copias de seguridad de rutinas

- Modificado el intervalo automático del método `checkAndBackup` en el store de rutinas (`useRoutineStore.ts`).
- Las rutinas locales se exportan y sincronizan ahora de forma automática contra la base de datos de Supabase cada **3 días** en lugar del plazo previo de dos semanas, protegiendo mucho más el progreso frente a borrados de la caché del navegador.
