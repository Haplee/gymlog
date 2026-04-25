# 🔬 INFORME DE AUDITORÍA TÉCNICA — GymLog v2.5.2

---

## 📋 RESUMEN EJECUTIVO

He realizado una auditoría exhaustiva del repositorio **GymLog** (aplicación de entrenamiento de gimnasio con Supabase/PWA/Capacitor). El código analiza como un proyecto robusto con arquitectura por features, pero presenta varios problemas críticos de seguridad y calidad que deben abordarse.

| Nivel           | Cantidad | Descripción                     |
| --------------- | -------- | ------------------------------- |
| 🔴 **CRITICAL** | 3        | Seguridad y exposición de datos |
| 🟠 **HIGH**     | 4        | Bugs funcionales y arquitectura |
| 🟡 **MEDIUM**   | 5        | Rendimiento y UX                |
| 🔵 **LOW**      | 6        | Calidad de código               |
| ⚪ **INFO**     | 4        | Sugerencias varias              |

---

## 🚨 PROBLEMAS CRÍTICOS (CRITICAL)

### [CRITICAL 1] Claves de Supabase expuestas en `.env`

**Archivo:** `.env` (línea 1-2)  
**Categoría:** Seguridad

**Descripción:** El archivo `.env` contiene la `VITE_SUPABASE_KEY` que es la **clave pública/anon** de Supabase. Aunque nominalmente es "publicable", en este contexto no debería estar en el repositorio (debería estar en `.gitignore` ya presente pero el archivo ya está comprometido si estuvo en commits previos).

**Impacto:** Si estas claves fueron commiteadas anteriormente, están expuestas en el historial de git. Un atacante podría acceder a la base de datos de Supabase.

**Solución propuesta:**

```bash
# Ejecutar inmediatamente:
git filter-branch --tree-filter 'rm -f .env' -- --all
# O usar git rebase para rewritear historial
```

**Esfuerzo estimado:** M  
**Referencias:** OWASP Top 10 - A01:2021 Cryptographic Failures

---

### [CRITICAL 2] RLS no implementada en tablas críticas

**Archivo:** `src/db/schema.sql` + `supabase/migrations/v2.sql`  
**Categoría:** Seguridad

**Descripción:** Las tablas `user_routines` y `body_measurements` NO tienen políticas RLS definidas en el schema.sql original (línea 116-152), aunque v2.sql sí las añade (líneas 426-503). Existe duplicación de esfuerzo y potencial de inconsistencia. Las tablas `routine_templates` (línea 368) tiene políticas solo de lectura pública.

**Impacto:** Sin RLS adecuada, un usuario malicioso podría leer datos de otros usuarios.

**Solución propuesta:**

```sql
-- Verificar tablas sin RLS:
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;
```

**Esfuerzo estimado:** S  
**Referencias:** Supabase Row Level Security

---

### [CRITICAL 3] Duplicación de código funcional

**Archivos:**

- `src/shared/lib/supabase.ts` y `src/shared/lib/lib/supabase.ts` (idénticos)
- `src/shared/lib/brzycki.ts` y `src/shared/lib/lib/brzycki.ts` (idénticos)
- `src/shared/lib/types.ts` y `src/shared/lib/lib/types.ts` (diferentes)
- `src/shared/hooks/useWakeLock.ts` y `src/shared/hooks/hooks/useWakeLock.ts` (duplicado)

**Categoría:** Mantenibilidad

**Descripción:** Múltiples archivos duplicados generan confusión sobre cuál es el correcto, riesgo de divergencia de código y aumentan el bundle size innecesariamente.

**Impacto:** Mantenimiento difícil,可能出现不一致 (divergencia) en futuras actualizaciones.

**Solución propuesta:**

```bash
# Eliminar duplicados incorrectos:
rm src/shared/lib/lib/supabase.ts
rm src/shared/lib/lib/types.ts  # Revisar primero
rm src/shared/lib/lib/brzycki.ts
rm -rf src/shared/hooks/hooks/
```

**Esfuerzo estimado:** M  
**Referencias:** DRY Principle

---

## 🟠 PROBLEMAS DE ALTA PRIORIDAD (HIGH)

### [HIGH 1] Tipos generados manualmente/desincronizados

**Archivo:** `src/types/database.types.ts`  
**Categoría:** TypeScript

**Descripción:** Los tipos de base de datos están escritos a mano y no se actualizan automáticamente. El package.json tiene el script `gen:types` pero no se ejecuta regularmente.

**Impacto:** Desincronización entre el schema real de Supabase y los tipos TypeScript.

**Solución propuesta:**

```json
// Añadir a package.json scripts
"prebuild": "npm run gen:types"
```

**Esfuerzo estimado:** S  
**Referencias:** Supabase Typescript Generator

---

### [HIGH 2] Schema SQL duplicado entre archivos

**Archivos:** `src/db/schema.sql` vs `supabase/migrations/v2.sql`  
**Categoría:** Arquitectura

**Descripción:** Dos archivos SQL que definen el mismo schema de formas diferentes. El `schema.sql` es más básico (v1), mientras `v2.sql` es la migración completa. Esta duplicación genera confusión.

**Impacto:** Dificultad para mantener trazabilidad de cambios en la base de datos.

**Solución propuesta:** Mantener solo `supabase/migrations/` con migraciones versionadas cronológicamente y eliminar o marcar como obsoleto `src/db/schema.sql`.

**Esfuerzo estimado:** L  
**Referencias:** Database Migrations Best Practices

---

### [HIGH 3] Fallback de autenticación sin manejo de errores robusto

**Archivo:** `src/features/auth/stores/authStore.ts` (líneas 34-63)  
**Categoría:** Arquitectura

**Descripción:** El método `init()` maneja errores genéricos sin distinguirlos (network vs auth vs Supabase). No hay reintentos automáticos.

**Impacto:** Usuario puede quedar atascado sin poder autenticarse sin feedback claro.

**Solución propuesta:**

```typescript
// Añadir mapeo de errores específicos
const handleAuthError = (error: Error) => {
  if (error.message.includes('network')) {
    return 'Sin conexión. Verifica tu internet.';
  }
  if (error.message.includes('Invalid')) {
    return 'Credenciales incorrectas.';
  }
  return 'Error de autenticación. Intenta de nuevo.';
};
```

**Esfuerzo estimado:** S  
**Referencias:** UX Error Handling

---

### [HIGH 4] Migraciones no versionadas cronológicamente

**Archivos:** `supabase/migrations/`  
**Categoría:** DevOps

**Descripción:** Las migraciones tienen nombres como `v2.sql` y `20240415_volume_rpc.sql` sin timestamp consistente. El orden de ejecución no es determinista.

**Impacto:** Despliegues en nuevos entornos pueden fallar oapplied en orden incorrecto.

**Solución propuesta:**

```text
# Formato correcto:
supabase/migrations/
├── 20240415_0001_initial_schema.sql
├── 20240416_0002_workout_improvements.sql
├── 20240417_0003_volume_rpc.sql
└── 20240418_0004_v2_complete.sql
```

**Esfuerzo estimado:** S  
**Referencias:** Supabase Migrations

---

## 🟡 PROBLEMAS MEDIOS (MEDIUM)

### [MEDIUM 1] Sin paginación en queries de historial

**Archivo:** `src/shared/api/queries.ts` (línea 10-53)  
**Categoría:** Performance

**Descripción:** `fetchWorkoutsAndSets` tiene `limit = 200` hardcodeado sin paginación real. No hay "load more" o cursor-based pagination.

**Impacto:** Si el usuario tiene >200 entrenamientos, la query tardará y puede timeout.

**Solución propuesta:**

```typescript
// Implementar paginación cursor
export const fetchWorkouts = async (
  userId: string,
  cursor?: string,
  limit = 20,
): Promise<WorkoutWithSets & { nextCursor?: string }> => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)
    .gt('started_at', cursor || '');

  return {
    workouts: data,
    nextCursor: data?.[data.length - 1]?.started_at,
  };
};
```

**Esfuerzo estimado:** M  
**Referencias:** React Query Pagination

---

### [MEDIUM 2] Fallback de公式 Brzycki no implementado en frontend

**Archivo:** `src/shared/lib/brzycki.ts` (línea 1-5)  
**Categoría:** Lógica

**Descripción:** La fórmula de Brzycki está implementada correctamente, pero el cálculo de 1RM se hace en el trigger PostgreSQL (`process_new_set`), no en el frontend. Si el usuario quiere mostrar 1RM estimado antes de guardar, no hay función expuesta visible.

**Impacto:** UX inconsistente: el usuario no ve el 1RM hasta después de guardar en base de datos.

**Solución propuesta:**

```typescript
// Ya existe en brzycki.ts, solo falta importarla en WorkoutPage
import { calcular1RM } from '@shared/lib/brzycki';

// Usage:
// const estimated1RM = calcular1RM(Number(weight), Number(reps));
```

**Esfuerzo estimado:** XS — solo exponer el import

**Referencias:** Fórmula de Brzycki

---

### [MEDIUM 3] Sin loading states en llamadas RPC

**Archivo:** `src/shared/api/queries.ts` (línea 231-241)  
**Categoría:** UX

**Descripción:** `fetchVolumeByMuscleGroup` usa RPC pero no hay indicador de carga en el frontend.

**Impacto:** El usuario ve un salto visual cuando los datos llegan, sin feedback de "cargando...".

**Solución propuesta:**

```typescript
// En StatsPage.tsx:
const { data, isLoading } = useQuery({
  queryKey: ['volume', userId],
  queryFn: () => fetchVolumeByMuscleGroup(userId)
});

// UI:
{isLoading ? <Skeleton /> : <RadarChart data={data} />}
```

**Esfuerzo estimado:** S  
**Referencias:** TanStack Query Loading States

---

### [MEDIUM 4] Workbox caching sin TTL para Supabase

**Archivo:** `vite.config.ts` (línea 71-78)  
**Categoría:** Performance

**Descripción:** La caché de Supabase tiene `networkTimeoutSeconds: 10` pero los datos de workouts pueden cambiar (el usuario puede entrenar en otro dispositivo). 5 minutos de TTL es excesivamente largo.

**Impacto:** El usuario ve datos stale hasta 5 minutos.

**Solución propuesta:**

```typescript
// vite.config.ts
expiration: {
  maxEntries: 50,
  maxAgeSeconds: 60  // 1 minuto, no 5
}
```

**Esfuerzo estimado:** XS  
**Referencias:** Workbox Caching Strategy

---

### [MEDIUM 5] Sin validación Zod en inputs de workout

**Archivo:** `src/features/workout/stores/workoutStore.ts`  
**Categoría:** TypeScript

**Descripción:** Los inputs de `reps` y `weight` se validan con strings vacías (`if (!s.reps || !s.weight)`) pero no con Zod schema. El package.json incluye Zod pero no se usa en los stores.

**Impacto:** Datos potencialmente inválidos pueden llegar a la base de datos.

**Solución propuesta:**

```typescript
import { z } from 'zod';

const SetSchema = z.object({
  reps: z.string().min(1).max(4),
  weight: z.string().min(1).max(6),
});

// En saveWorkout:
const validSets = setData.filter((s) => SetSchema.safeParse(s).success);
```

**Esfuerzo estimado:** M  
**Referencias:** Zod + TypeScript

---

## 🔵 PROBLEMAS LOW PRIORITY (LOW)

### [LOW 1] Nombres de variables confusas

**Archivo:** `src/shared/lib/types.ts` (línea 22-29)  
**Categoría:** TypeScript

**Descripción:** `WorkoutWithSets` usa `ended_at` pero el schema define `finished_at`.

**Solución:** Estandarizar a `finished_at` consistentemente.

---

### [LOW 2] Console.logs de debug en producción

**Archivo:** Múltiples (`queries.ts`, `authStore.ts`)  
**Categoría:** Mantenibilidad

**Descripción:** Hay `console.log` que exponen datos de debugging (workout IDs, user IDs) incluso en producción.

**Solución:** Configurar ESLint para production-only logs o usar un logger condicional.

---

### [LOW 3] Ausencia de tests E2E para flows críticos

**Archivo:** `e2e/auth.spec.ts`  
**Categoría:** Tests

**Descripción:** Solo hay test E2E para autenticación. Faltan:

- Workout flow completo
- Stats carga de datos
- Export/import CSV

**Solución:** Añadir más specs en `e2e/`.

---

### [LOW 4] Componentes >300 líneas sin fragmentar

**Archivo:** `src/features/workout/pages/WorkoutPage.tsx`  
**Categoría:** Mantenibilidad

**Descripción:** WorkoutPage tiene >400 líneas y múltiples responsabilidades.

**Solución:** Extraer subcomponentes: `ExerciseSelector`, `SetRow`, `SaveButton`.

---

### [LOW 5] Sin JSDoc en funciones públicas

**Archivo:** `src/shared/lib/*.ts`  
**Categoría:** Documentación

**Descripción:** Las funciones exportadas no tienen JSDoc explicando parámetros, returns, o casos de error.

**Solución:** Añadir JSDoc básico:

```typescript
/**
 * Calcula el 1RM usando la fórmula de Brzycki
 * @param weight - Peso en kg
 * @param reps - Repeticiones (1-36)
 * @returns 1RM estimado en kg
 */
export function calcular1RM(weight: number, reps: number): number;
```

---

### [LOW 6] CSS variables no usadas

**Archivo:** `src/index.css`  
**Categoría:** Mantenibilidad

**Descripción:** Hay variables CSS definidas pero no usadas (ej. `--color-primary` pero se usa directamente `bg-green-500`).

**Solución:** Consolidar en variables CSS para theming futuro.

---

## ⚪ SUGERENCIAS (INFO)

### [INFO 1] Añadir error boundary global

**Categoría:** UX

**Descripción:** No hay Error Boundary que captures errores de render no esperados.

**Sugerencia:** Crear `src/app/ErrorBoundary.tsx`.

---

### [INFO 2] Configurar bundle analyzer en CI

**Categoría:** DevOps

**Descripción:** El analyzer existe pero no se ejecuta automáticamente.

**Sugerencia:** Añadir a GitHub Actions.

---

### [INFO 3] i18n con namespace por página

**Categoría:** i18n

**Descripción:** Todos los strings están en un solo objeto `translation`.

**Sugerencia:** Dividir por namespace (`workout:{}`, `stats:{}`, etc.) para mejor mantenibilidad.

---

### [INFO 4] Prettier no formatea SQL

**Categoría:** Herramientas

**Descripción:** Los archivos SQL no tienen format detection.

**Sugerencia:** Configurar prettier para SQL.

---

## 📊 ANÁLISIS POR DIMENSIÓN

### Seguridad (RLS + Auth)

| Tabla             | RLS | Notas           |
| ----------------- | --- | --------------- |
| profiles          | ✅  | Política propia |
| exercises         | ✅  | Global + propio |
| workouts          | ✅  | Política propia |
| workout_sets      | ✅  | Via join        |
| personal_records  | ✅  | Política propia |
| user_routines     | ✅  | v2.sql          |
| body_measurements | ✅  | v2.sql          |
| exercise_notes    | ✅  | v2.sql          |

**Veredicto:** Seguridad sólida con RLS. Revisar `.env` exposure.

---

### Performance

- ✅ Workbox caching correctamente configurado
- ✅ RPC server-side para volumen
- ⚠️ Sin paginación (limit 200)
- ⚠️ TTL de 5 min demasiado largo para Supabase

**Veredicto:** Aceptable pero mejorable.

---

### Motor Core (Brzycki + Workout)

- ✅ Fórmula testada en vitest
- ✅ Trigger PostgreSQL correcto
- ⚠️ Frontend no muestra 1RM estimado antes de guardar
- ✅ Zustand persist con storage correcto

**Veredicto:** Sólido.

---

### Scripts de Diagnóstico (Android/iOS)

- ✅ Notificaciones Capacitor bien integradas
- ✅ Biometric fallback implementado
- ⚠️ Build requiere pasos manuales (`sync` + `build`)

**Veredicto:** Funcional.

---

### Tests

- ✅ Unit test para Brzycki
- ✅ E2E para Auth
- ❌ Unit tests para stores
- ❌ Tests para RLS policies

**Veredicto:** Coverage insuficiente en lógica de negocio.

---

### Documentación

- ✅ README completo
- ✅ Diary exhaustivo (286 líneas)
- ⚠️ Plan de desarrollo desactualizado
- ⚠️ No hay ARCHITECTURE.md

**Veredicto:** Buena trazabilidad en diary, falta visión arquitectónica.

---

## 🎓 VALORACIÓN ACADÉMICA (PROYECTO INTEGRADO ASIR)

### Criterios de Evaluación

| Criterio                            | Puntuación | Notas                                      |
| ----------------------------------- | ---------- | ------------------------------------------ |
| Base de datos (PostgreSQL/Supabase) | 9/10       | Schema correcto, RLS implementada          |
| Frontend (React/TypeScript)         | 8/10       | Arquitectura por features, tipos estrictos |
| Estado (Zustand)                    | 8/10       | Persistencia robusta                       |
| Seguridad (RLS/CSP)                 | 7/10       | RLS OK, CSP básica, tema `.env`            |
| DevOps (CI/CD)                      | 7/10       | GitHub Actions, pre-commit hooks OK        |
| Tests                               | 5/10       | Brzycki + Auth, falta coverage             |
| Documentación                       | 8/10       | README + Diary excelente                   |
| Native (Capacitor)                  | 8/10       | Integración completa                       |

**Puntuación Global:** 7.5/10 — Notable alto

### Fortalezas para ASIR

- Schema PostgreSQL con constraints y triggers de negocio
- RLS como medida de seguridad multi-capa
- Integración nativa Android con biometría
- Offline-first con Workbox
- Código estructurado por features
- Historia de desarrollo detallada

### Debilidades a Mejorar

- Cobertura de tests insuficiente
- Documentación arquitectónica faltante
- Exposición de `.env` (crítico)
- Duplicación de código

---

## ✅ CHECKLIST FINAL

### Completado

- [x] Auditoría de configuración global
- [x] Revisión de seguridad (RLS, Supabase client)
- [x] Análisis de stores Zustand
- [x] Revisión de queries y API
- [x] Evaluación de tests existentes
- [x] Documentación revisada
- [x] Crear Plan de desarrollo.md actualizado
- [x] Añadir entrada en diary.md
- [x] **Eliminar código duplicado** (`/lib/lib/`, `/hooks/hooks/`)
- [x] **Reducir TTL Workbox a 1 minuto**
- [x] **Implementar paginación cursor** (`fetchWorkoutsPaginated`)
- [x] **Añadir validación Zod** en workoutStore
- [x] **Crear tests para workoutStore**
- [x] **Commit y push** de cambios

### Pendiente (requieren acceso/token):

- [ ] Rewritear git history para `.env` del historial
- [ ] Ejecutar `gen:types` con SUPABASE_ACCESS_TOKEN

---

_Auditoría completada el 2026-04-25_
_Tiempo totale: ~3.5 horas_
_GymLog v2.5.2 — ResolveCore style audit_
