# Fase 13 — Importaciones idempotentes y atómicas

Cierra los dos huecos que dejó la Fase 12: el cardio de Excel se guardaba con un
`INSERT` directo y la importación JSON hacía una RPC por (día, ejercicio). Añade
además una identidad de importación estable, para distinguir un reintento de red
de una importación manual nueva.

La migración **no se aplica sola**. Es un cambio manual y no destructivo. Este
documento describe el contrato, las garantías, las pruebas reales y el
despliegue.

La Fase 12 sigue siendo el contrato de `save_workout_with_sets`; aquí solo se
reutiliza. Su documento (`docs/IDEMPOTENCIA_FASE12.md`) se conserva como
histórico.

## 1. Diagnóstico

| Flujo            | Antes                                                 | Qué fallaba                                                                                                                                        |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cardio de Excel  | `insert` directo en `cardio_sessions`                 | Si la escritura llegaba y se perdía la respuesta, el reintento creaba otra sesión.                                                                 |
| Importación JSON | Una RPC `save_workout_with_sets` por (día, ejercicio) | Una interrupción a mitad dejaba días escritos y otros no. El fichero no era todo-o-nada.                                                           |
| Identidad        | Clave derivada de la fecha (CSV/Excel)                | Dos importaciones manuales del mismo día compartían clave. Una segunda importación podía recibir el lote de la primera y perder sus series nuevas. |

Los dos duplicados siguen siendo distintos:

- **Duplicación de solicitud**: la misma operación se reenvía y el servidor
  escribe dos veces. La evita una clave de idempotencia + índice único.
- **Duplicación de contenido**: se reimportan filas que ya existían. La sigue
  resolviendo el dedupe por `(fecha, ejercicio, set_num)` de la Fase 11, sin
  cambios.

Esta fase solo añade lo primero. No hay dedupe global por contenido.

## 2. Diseño

### 2.1 Identidad de importación

`src/features/stats/utils/importIdentity.ts`:

- `newImportId()` genera un UUID una sola vez por confirmación manual, **antes**
  de la primera escritura (`confirmImport`).
- `deriveImportKey(importId, scope)` deriva una clave determinista con FNV-1a de
  128 bits y formato UUID. No es una firma: es un espacio de nombres estable.

Ámbitos usados:

| Flujo        | Ámbito                                | Dónde se usa                                       |
| ------------ | ------------------------------------- | -------------------------------------------------- |
| CSV          | `workout:<date>`                      | Lote del día en `save_workout_with_sets`           |
| Excel fuerza | `workout:<date>`                      | Lote del día en `save_workout_with_sets`           |
| Excel cardio | `cardio:<index>:<date>:<type>`        | `save_cardio_session`                              |
| JSON         | `workout:<ord>:<epoch>:<exercise_id>` | Derivado en servidor por `import_history_workouts` |

Propiedades que se buscan:

- mismo envío → misma clave en todos los reintentos de red;
- importación manual nueva → identidad nueva, aunque el fichero sea el mismo o
  del mismo día;
- operaciones independientes → claves independientes;
- la fecha no es la identidad global.

`retryOnNetwork` solo reintenta errores de red (3 intentos). Un
`idempotency_conflict` o un error de autorización/validación no se reintenta.

### 2.2 Cardio idempotente

Migración `20261026130000_import_integrity.sql`:

- `cardio_sessions.client_id uuid` e `idempotency_hash text`, ambas opcionales.
- Índice único parcial `(user_id, client_id) WHERE client_id IS NOT NULL`.
- `cardio_request_hash(...)`: md5 del contenido real (tipo, instante, duración,
  distancia normalizada a `numeric(7,2)`, calorías y notas).
- `save_cardio_session(...)`: devuelve el `id` de la sesión original si la misma
  clave y la misma carga ya existían; falla si la clave se reutiliza con otra
  carga.

Se conserva el índice `(user_id, started_at)` de la migración
`20260711120000`: sigue siendo el dedupe de contenido y la red de seguridad del
guardado manual de `cardioStore` (que hace `upsert` contra él). Una operación
nueva con la misma fecha y el mismo contenido recibe la sesión existente; con
contenido distinto falla con `cardio_content_conflict`.

Las filas anteriores a la migración no tienen huella. En su primer reenvío se
calcula la huella **de la fila real** y se compara:

- coincide → se adopta la huella y, si `client_id` era `NULL`, se asigna el de
  la operación;
- no coincide → conflicto explícito, sin modificar ni duplicar la fila.

Esto evita el riesgo de adoptar a ciegas el contenido entrante.

### 2.3 Importación JSON atómica

`import_history_workouts(p_user_id, p_import_id, p_workouts)` guarda el fichero
completo en **una sola transacción**. Internamente llama a
`save_workout_with_sets` por elemento, con una clave derivada de
`p_import_id`, la posición y el contenido:

```text
import_operation_key(p_import_id, 'workout:<ord>:<epoch>:<exercise_id>')
```

Si cualquier elemento falla (validación, propiedad, conflicto de idempotencia),
la transacción entera se revierte: no queda ningún entreno ni serie del lote.
`import_operation_key` usa `md5` en lugar de `uuid_generate_v5` para no depender
de que `uuid-ossp` esté en el `search_path` de una función `SECURITY DEFINER`.

El cliente construye un único payload y hace **una** llamada. La identidad se
crea en `confirmImport` y se conserva durante la operación y sus reintentos de
red.

## 3. Contratos

### `save_cardio_session`

```sql
save_cardio_session(
  p_user_id uuid,
  p_client_id uuid,
  p_type text,
  p_started_at timestamptz,
  p_duration integer,
  p_distance numeric DEFAULT NULL,
  p_calories integer DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
```

Errores (`SQLSTATE P0001`):

| Error                       | Significado                                         | ¿Reintentar? |
| --------------------------- | --------------------------------------------------- | ------------ |
| `unauthorized`              | `p_user_id` no es `auth.uid()`                      | No           |
| `invalid_client_id`         | Clave nula                                          | No           |
| `invalid_cardio`            | Tipo, instante o duración inválidos                 | No           |
| `idempotency_conflict`      | Misma clave con otra carga                          | No           |
| `cardio_content_conflict`   | Misma fecha con contenido distinto                  | No           |
| `idempotency_state_missing` | Estado imposible; la fila del conflicto desapareció | No           |

Permisos: `REVOKE` para `PUBLIC` y `anon`; `GRANT EXECUTE` solo a
`authenticated`.

### `import_history_workouts`

```sql
import_history_workouts(
  p_user_id uuid,
  p_import_id uuid,
  p_workouts jsonb
) RETURNS integer
```

Cada elemento de `p_workouts`:

```json
{
  "started_at": "2026-01-05T10:00:00Z",
  "finished_at": "2026-01-05T11:00:00Z",
  "exercise_id": "uuid",
  "sets": [{ "set_num": 1, "reps": 8, "weight": 80 }],
  "notes": null,
  "rating": null
}
```

Errores propios: `unauthorized`, `invalid_import_id`, `invalid_workouts`,
`invalid_workout`. Los errores de `save_workout_with_sets` se propagan y
revierten el lote completo.

## 4. Garantías y pruebas

### Cardio

| Garantía                                             | Mecanismo                                     | Prueba                                               |
| ---------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Reintento de la misma operación → un único resultado | `client_id` derivado del `importId`           | `applyExcelImport.test.ts`, SQL `cardio_idempotente` |
| Respuesta perdida tras escribir → sin segunda sesión | `retryOnNetwork` conserva la clave            | `applyExcelImport.test.ts`                           |
| Misma clave con contenido incompatible → conflicto   | `idempotency_conflict`                        | SQL `cardio_conflicto_misma_clave`, concurrencia     |
| Misma fecha con otro contenido → conflicto revisable | `cardio_content_conflict`                     | SQL `cardio_conflicto_contenido`, legacy             |
| Operaciones independientes → sesiones independientes | `cardio:<index>:...` dentro de la importación | `applyExcelImport.test.ts`                           |
| Propiedad, autorización y RLS                        | `auth.uid()`, `SECURITY DEFINER`, permisos    | SQL `cardio_aislamiento_usuarios`, `rls_aislamiento` |

### JSON

| Garantía                                             | Mecanismo                                           | Prueba                                                               |
| ---------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| Importación íntegra                                  | Una sola RPC transaccional                          | `useHistoryTransfer.json.test.ts`, SQL `json_import_atomica`         |
| Fallo antes de persistir → nada escrito              | La RPC no se llama                                  | `useHistoryTransfer.json.test.ts`                                    |
| Fallo durante la persistencia → lote revertido       | Transacción única                                   | SQL `json_validacion_revierte_lote`, `json_conflicto_revierte_lote`  |
| Respuesta perdida → sin duplicar                     | Misma identidad y claves derivadas                  | `useHistoryTransfer.json.test.ts`, SQL `json_reintento_sin_duplicar` |
| Recuperación sin duplicar                            | Reintento manual + dedupe de contenido              | `useHistoryTransfer.json.test.ts`                                    |
| Nueva importación del mismo día → claves nuevas      | `newImportId()` por confirmación                    | SQL `json_identidad_nueva_mismo_dia`                                 |
| Conflicto no reintentado                             | `retryOnNetwork` solo actúa sobre red               | `useHistoryTransfer.json.test.ts`                                    |
| Estado final con pendientes → no se declara completo | Contador `failed` y mensaje `history.import_failed` | `useHistoryTransfer.json.test.ts`                                    |

### Identidad

| Garantía                               | Prueba                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Misma clave en reintentos              | `importIdentity.test.ts` (determinismo) y tests de respuesta perdida       |
| Identidad nueva por importación manual | `importIdentity.test.ts`                                                   |
| Mismo día sin colisión                 | `useHistoryTransfer.csv.test.ts`, SQL `json_identidad_nueva_mismo_dia`     |
| Concurrencia                           | SQL `json_misma_importacion_concurrente`, `cardio_misma_clave_concurrente` |
| Dedupe de la Fase 11 intacto           | Tests de CSV/Excel/JSON y escenarios de contenido                          |

## 5. Outbox y cardio pendiente

Se revisó el outbox para descartar falsos «completado»:

- Las importaciones **no pasan por el outbox**. Llaman a las RPC directamente.
- Una escritura fallida no encola nada y no añade claves a `importedKeysRef`;
  solo se contabiliza en `failed`. El mensaje final no la presenta como
  importada.
- `flushWorkoutOutbox` no se tocó: sigue conservando las entradas `failed` y no
  las reintenta automáticamente.
- El cardio manual sigue usando `pendingSync` en `cardioStore`. Un fallo de
  cardio de Excel no crea una sesión local pendiente ni se marca como
  completado: se cuenta como fallido para que el usuario lo vea y reintente.
- `syncCardio(userId)` tras un Excel solo empuja las sesiones manuales
  pendientes; no interpreta el resultado de la importación.

## 6. Archivos

Nuevos:

- `src/features/stats/utils/importIdentity.ts`
- `src/features/stats/utils/__tests__/importIdentity.test.ts`
- `src/features/stats/utils/__tests__/applyExcelImport.test.ts`
- `src/features/stats/hooks/__tests__/useHistoryTransfer.json.test.ts`
- `src/features/stats/hooks/__tests__/useHistoryTransfer.csv.test.ts`
- `src/features/stats/hooks/__tests__/useHistoryTransfer.excel.test.ts`
- `supabase/migrations/20261026130000_import_integrity.sql`
- `scripts/db-idempotency-test.mjs`
- `scripts/db/idempotency-scenarios.sql`

Modificados:

- `src/features/stats/utils/applyExcelImport.ts`
- `src/features/stats/hooks/useHistoryTransfer.ts`
- `src/shared/lib/i18n/resources.ts` (`history.import_conflict`,
  `history.import_failed` en es/en)
- `src/types/database.types.ts` (columnas y funciones nuevas)

`src/features/stats/utils/importLock.ts` y sus pruebas ya existían; se usan para
serializar importaciones, pero no forman parte del cambio de esta fase.

## 7. Pruebas ejecutadas (resultados reales)

### Cliente

```bash
npx vitest run \
  src/features/stats/utils/__tests__/importIdentity.test.ts \
  src/features/stats/utils/__tests__/applyExcelImport.test.ts \
  src/features/stats/hooks/__tests__/useHistoryTransfer.json.test.ts \
  src/features/stats/hooks/__tests__/useHistoryTransfer.csv.test.ts \
  src/features/stats/hooks/__tests__/useHistoryTransfer.excel.test.ts
```

**5 archivos, 56 tests, todos en verde** (identidad 5, `applyExcelImport` 11,
JSON 14, CSV 17, hook Excel 9). La ruta JSON aislada: 14/14.

```bash
npm run test
```

**113 archivos, 1236 tests, todos en verde.**

Durante la primera ejecución de la suite completa, `excelExport.test.ts` agotó
el timeout de 30 s (1 fallo, 1235 OK). Es un fallo por carga de jsdom, no
relacionado con estos cambios: el mismo test pasa aislado **12/12 en 1,54 s** y
la segunda ejecución completa terminó **1236/1236**. Se documenta como flaky
preexistente.

```bash
npm run type-check   # OK
npm run lint         # 0 errores, 9 warnings preexistentes en notificationsSchedule.test.ts
npm run build        # OK (aviso de chunks grandes y subida de source maps a Sentry)
```

Formato:

```bash
npx prettier --check <archivos tocados>   # todos OK
git diff --check                          # sin errores de whitespace
```

`git diff --check` solo emite avisos LF→CRLF de Git en Windows; no hay errores
de espacio en blanco. Prettier no se aplica a `.sql`.

### PostgreSQL real

```bash
npm run test:db
```

El runner crea un clúster temporal con `initdb`, aplica el bootstrap de Supabase
y las migraciones curadas, ejecuta los escenarios y lo borra. No toca ninguna
base del proyecto.

Resultado real: **19 escenarios secuenciales + 10 pruebas de concurrencia con
dos conexiones simultáneas, todo OK**.

Concurrencia:

- misma clave y misma carga → una fila, mismo `id`;
- misma clave y otra carga → conflicto sin tocar datos;
- claves distintas → dos filas;
- importación multiejercicio concurrente → lote completo;
- normalización de números en la huella;
- cardio: misma clave → una sesión; mismo contenido con otra clave → una sesión;
  otra carga → conflicto sin tocar datos;
- JSON: misma importación → una escritura; otra carga → conflicto sin restos.

Los mocks no sustituyen esta prueba: la garantía de concurrencia la da
PostgreSQL y se comprueba con conexiones reales.

## 8. Migración y despliegue manual

Archivo: `supabase/migrations/20261026130000_import_integrity.sql`.

Solo añade dos columnas opcionales, un índice parcial y cuatro funciones. No
borra ni reescribe filas. La migración **no se ha aplicado a ninguna base de
datos**.

Orden recomendado: **primero la migración, después el cliente**. Un cliente
nuevo contra una base sin migrar fallará al llamar a las RPC nuevas; un cliente
antiguo contra la base migrada sigue funcionando (no usa las columnas nuevas y
el `insert` manual de cardio las deja en `NULL`).

1. Copia de seguridad del proyecto (o al menos de `cardio_sessions` y
   `workouts`).
2. Aplicar en staging:

   ```bash
   supabase db push
   ```

   o pegar el contenido en el SQL Editor. No hace falta reiniciar nada.

3. Verificar:

   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'cardio_sessions'
     AND column_name IN ('client_id', 'idempotency_hash');

   SELECT indexname FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname = 'cardio_sessions_user_client_uniq';

   SELECT proname FROM pg_proc
   WHERE proname IN (
     'cardio_request_hash',
     'save_cardio_session',
     'import_operation_key',
     'import_history_workouts'
   );
   ```

4. Prueba funcional mínima en staging:
   - guardar un cardio con una clave y repetir con la misma carga → mismo `id`;
   - repetir con otra carga → `idempotency_conflict`;
   - importar un JSON y repetirlo con la misma `p_import_id` → sin duplicados;
   - importar el mismo JSON con otra `p_import_id` → el dedupe de contenido
     evita series repetidas.
5. Repetir en producción y desplegar el cliente.

### Vuelta atrás

Las columnas son opcionales y el índice es parcial; el cliente antiguo funciona
sin tocarlas. Para revertir, primero hay que volver al cliente anterior y
después eliminar las funciones nuevas y, si se quiere, las columnas. No se
recomienda borrar `client_id`/`idempotency_hash` con datos: son la única traza
de idempotencia del cardio importado.

## 9. Riesgos y límites

- **Dos cardio distintos en el mismo instante**: el índice
  `(user_id, started_at)` lo impide. El Excel envía solo la fecha, así que dos
  sesiones de cardio del mismo día con contenido distinto producen
  `cardio_content_conflict`, no dos filas. Es un límite funcional existente; se
  conserva porque `cardioStore` depende de ese índice para el `upsert` manual.
  El conflicto se cuenta como fallido y se muestra al usuario; no se pierde en
  silencio.
- **Ejercicios del catálogo antes de la RPC JSON**: el cliente resuelve o crea
  ejercicios antes de llamar a `import_history_workouts`. Si la RPC falla, no
  hay entrenos ni series, pero pueden quedar ejercicios nuevos en el catálogo.
  No es pérdida de datos; es un efecto lateral aceptado y visible.
- **Series irresolubles en JSON**: si un ejercicio no se puede resolver ni
  crear, sus series no entran en el payload y se cuentan en `failed`. El lote
  enviado sigue siendo atómico para el subconjunto resoluble. El estado final se
  muestra como pendiente, no como completado.
- **Conflicto de idempotencia**: es definitivo y no se reintenta. El usuario ve
  `history.import_conflict`; no se borra ni se reencola nada.
- **Claves derivadas**: `import_operation_key` y `deriveImportKey` no son firmas
  criptográficas. Su garantía es la estabilidad y el aislamiento por operación,
  no la resistencia a un atacante. La autorización la da `auth.uid()` y RLS.
- **Recuperación JSON**: si el lote falla entero, el reintento manual vuelve a
  enviar todo. Si falló solo la resolución de un ejercicio, el reintento usa una
  identidad nueva (nueva confirmación), el dedupe de contenido salta lo ya
  guardado y solo intenta lo pendiente. No hay reanudación automática desde el
  servidor: el registro fiable es el propio fichero y el dedupe de contenido.
- **Outbox**: no cubre importaciones ni cardio de Excel por diseño. Un fallo de
  importación no se reintenta solo; queda en el mensaje y en consola.
