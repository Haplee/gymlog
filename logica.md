# Lógica Detallada del Repositorio — GymLog v2.0

Este documento detalla la estructura lógica, el flujo de datos y las reglas de negocio de la aplicación para facilitar su mantenimiento y evolución.

## 1. Resumen del Proyecto

**GymLog v2.0** es una PWA (Progressive Web App) para el seguimiento de entrenamientos. Su arquitectura está diseñada para ser rápida (Vite + React 19), segura (Supabase RLS) y funcional sin conexión (PWA).

---

## 2. Arquitectura de Software

El proyecto utiliza una estructura **Feature-based** para mantener el código desacoplado y escalable.

### Directorios Clave

- `src/app/`: Punto de entrada, configuración de rutas y proveedores globales.
- `src/features/`: Contiene los módulos de negocio principales:
  - **auth**: Gestión de sesiones con Supabase Auth.
  - **workout**: Lógica de registro de series, repeticiones y pesos.
  - **routine**: Gestión de plantillas de entrenamiento y recordatorios.
  - **stats**: Visualización de progreso mediante gráficos (Recharts).
- `src/shared/`: Recursos reutilizables:
  - **api/queries.ts**: Capa de abstracción para todas las llamadas a Supabase.
  - **lib/brzycki.ts**: Lógica matemática para el cálculo del 1RM estimado.
  - \*\*stores/`: Estados globales simples (ajustes, UI).

---

## 3. Modelo de Datos y Relaciones (Supabase)

La base de datos PostgreSQL en Supabase es el motor de persistencia. La integridad lógica se mantiene mediante relaciones de clave foránea y **RLS (Row Level Security)**.

### Diagrama Lógico de Tablas

1. **`profiles`**: Almacena datos del usuario (objetivos, avatar, onboarding).
2. **`exercises`**: Catálogo maestro. Los ejercicios globales tienen `user_id = NULL`, los personalizados tienen el `user_id` del creador.
   - _Lógica_: Un usuario solo puede editar/borrar sus propios ejercicios, pero puede ver los globales.
3. **`workouts`**: Cabecera de cada sesión de entrenamiento (fecha inicio/fin, duración, notas globales).
4. **`workout_sets`**: El núcleo del sistema. Relaciona un `workout_id` con un `exercise_id`.
   - _Campos_: `weight`, `reps`, `rpe`, `is_warmup`.
5. **`personal_records`**: Tabla de "High Scores". Se actualiza reactivamente cuando un usuario bate su récord personal estimado.
6. **`exercise_notes`**: Notas persistentes vinculadas a la combinación Usuario + Ejercicio.

---

## 4. Lógica de Negocio Principal

### A. Registro de Entrenamiento (`WorkoutPage.tsx`)

- **Estado Efímero**: Se gestiona mediante `useWorkoutStore` (Zustand). Permite añadir/quitar series rápidamente antes de persistir.
- **Predicción de PR**: Al ingresar peso/reps, el sistema ejecuta `calcular1RM` (Fórmula de Brzycki: `Peso / (1.0278 - (0.0278 * Reps))`). Si el resultado supera el valor en `personal_records`, se activa un feedback visual (Icono Trophy) y efectos (confeti) al guardar.
- **Flujo de Guardado**:
  1. Se valida que haya un ejercicio seleccionado y al menos una serie con datos.
  2. Se crea un registro en `workouts`.
  3. Se insertan todas las series en `workout_sets` vinculadas al ID del workout recién creado.
  4. Se invalidan las cachés de TanStack Query para refrescar el historial y las estadísticas.

### B. Sistema de Rutinas (`routineStore.ts`)

- Mapea el día de la semana actual con una lista de ejercicios predefinida.
- Si hay una rutina activa para "Hoy", se inyecta automáticamente en la vista de entrenamiento para guiar al usuario.

### C. Estadísticas y Gráficos

- **Volumen Muscular**: Se calcula sumando `peso * reps` agrupado por `muscle_group`.
- **RadarChart**: Visualiza qué grupos musculares están recibiendo más atención.

---

## 5. Puntos de Mejora Identificados (Lógica a Refactorizar)

1. **Persistencia del Workout Activo**: Si el usuario recarga la página a mitad de un entrenamiento, el estado de Zustand se pierde. Debería implementarse `persist` en el store para guardar en `localStorage` o sincronizar estados intermedios en la DB.
2. **Gestión de Sesiones**: Actualmente, el cierre de sesión no limpia agresivamente las cachés de TanStack Query, lo que podría llevar a breves parpadeos de datos del usuario anterior en entornos compartidos.
3. **Cálculo de Volumen**: La lógica de agregación de volumen para el gráfico de radar se realiza en el cliente. Para historiales largos (>500 entrenamientos), esto debería delegarse a una **RPC** (Remote Procedure Call) en Supabase para mejorar el rendimiento.
4. **Validación de Tipos**: Reducir el uso de `unknown` en los mapeos de la API (`src/shared/api/queries.ts`) mediante esquemas generados por la CLI de Supabase.

---

## 6. Comandos y Operaciones Frecuentes

- **Añadir Migración**: Editar `supabase/migrations/v2.sql` y ejecutar en el dashboard.
- **Sincronización PWA**: El sistema utiliza `Stale-While-Revalidate`. Para forzar actualización, hay un botón de "Update" que limpia el service worker.
