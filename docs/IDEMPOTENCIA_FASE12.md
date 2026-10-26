# Fase 12 — Idempotencia de guardado e importaciones

> Documento histórico de la Fase 12. Los riesgos residuales que aparecen al final
> (cardio de Excel y JSON incremental) se cierran en
> [`IMPORTACIONES_FASE13.md`](./IMPORTACIONES_FASE13.md).

Contrato de servidor para que un reintento no duplique un entreno, y pasos para
desplegarlo. La migración **no se aplica sola**: es un cambio manual y no
destructivo.

## Qué problema cierra

Hay dos duplicados distintos y no se arreglan igual:

| Tipo                         | Ejemplo                                                                     | Quién lo evita                                          |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| Duplicación de **solicitud** | Se pierde la respuesta, el cliente reintenta y el servidor escribe otra vez | Clave de idempotencia + índice único en PostgreSQL      |
| Duplicación de **contenido** | Se reimporta el mismo CSV y las mismas series ya existían                   | Dedupe por `(fecha, ejercicio, set_num)` del importador |

Esta fase añade lo primero. El dedupe de contenido de la Fase 11 sigue siendo el
único que decide si dos series son «la misma serie»: no hay dedupe global por
contenido. Una reimportación manual es una operación nueva, con clave nueva; si
sus filas ya estaban, las descarta el dedupe de contenido.

## Contrato del servidor

`public.save_workout_with_sets(...)` mantiene la firma y gana dos garantías:

1. **Reintento con la misma clave y el mismo contenido** devuelve el `id` del
   entreno original. No crea otro, no vuelve a insertar series.
2. **Misma clave con contenido distinto** falla con `idempotency_conflict`
   (`SQLSTATE P0001`) en vez de devolver un éxito falso. Es un rechazo
   definitivo: el cliente no lo reintenta.

La clave es `p_client_id`, ligada al usuario autenticado por el índice único
`(user_id, client_id)`. La función valida `p_user_id = auth.uid()`, así que una
clave de otro usuario no colisiona ni se puede consultar.

### Huella canónica

`public.workout_request_hash(...)` calcula un md5 del contenido que acompañó a
la clave: usuario, ejercicio, fechas, notas, rating y cada serie.

- Normaliza números (`'80'` y `'80.0'` producen la misma huella) y usa
  `extract(epoch ...)` para no depender del huso de la sesión.
- Conserva el orden de las series: un reenvío envía el mismo orden.
- No es una firma de seguridad, es una huella de integridad para detectar una
  clave reutilizada.

### Filas anteriores a la migración

`workouts.idempotency_hash` empieza en `NULL` para las filas históricas. En su
primer reenvío se adopta la huella recibida y se devuelve el entreno original;
después de eso ya se detecta el conflicto. Un reintento que cruce el despliegue
no se rompe.

### Series con ejercicio propio

La función acepta `exercise_id` dentro de cada elemento de `p_sets`. Sin ese
campo, el ejercicio sigue saliendo de `p_exercise_id`, como antes. Esto permite
meter un día completo de una importación (varios ejercicios) en **una**
transacción. La comprobación de propiedad se hace dentro: la función es
`SECURITY DEFINER` y se salta RLS.

Permisos: `REVOKE` para `PUBLIC` y `anon`, `GRANT EXECUTE` solo a
`authenticated`.

## Claves por flujo

| Flujo           | Clave                               | Reintento                            |
| --------------- | ----------------------------------- | ------------------------------------ |
| Guardado normal | `clientId` persistido en el entreno | Misma clave en los 3 intentos de red |
| Outbox          | `w.id` de la entrada encolada       | La misma entrada conserva su id      |
| Rutina          | `clientId` por ejercicio            | Misma clave al reencolar             |
| CSV             | Una clave por fecha (lote del día)  | Misma clave en el reintento del lote |
| Excel           | Una clave por fecha (lote del día)  | Misma clave en el reintento del lote |
| JSON            | Una clave por (día, ejercicio)      | Misma clave en el reintento          |

`retryOnNetwork` solo reintenta errores de red (3 intentos, esperas de 250 y
500 ms). Un error del servidor o un conflicto no se reintentan porque repetirlos
daría el mismo resultado.

## Despliegue manual

La migración es
`supabase/migrations/20261026120000_workout_idempotency_contract.sql`.
No borra ni migra filas; solo añade una columna y reemplaza funciones.

1. Revisar el SQL en el repo y hacer copia de seguridad del proyecto (o al menos
   de `workouts`).
2. Aplicar en el entorno de staging primero:

   ```bash
   supabase db push
   ```

   o pegar el contenido en el SQL Editor del proyecto. No hace falta reiniciar
   nada.

3. Comprobar que quedó aplicada:

   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'workouts'
     AND column_name = 'idempotency_hash';

   SELECT proname, prosecdef
   FROM pg_proc
   WHERE proname IN ('save_workout_with_sets', 'workout_request_hash');
   ```

4. Repetir en producción. Los clientes antiguos siguen funcionando: no envían
   `exercise_id` por serie ni cambian la firma, y sin `p_client_id` no hay
   deduplicación de solicitud, exactamente como antes.
5. Verificación funcional mínima: guardar un entreno, repetir la petición con la
   misma clave (debe devolver el mismo `id`) y con otra carga (debe fallar con
   `idempotency_conflict`).

No hay migración de vuelta necesaria: la columna nueva es opcional y la función
anterior puede restaurarse desde su migración original
(`20260814115041_save_workout_idempotent.sql`) sin tocar datos.

## Pruebas

### Cliente (Vitest)

```bash
npm run test
```

Resultado real de la fase: **105 archivos, 1176 tests, todos en verde**. Cubren,
entre otros:

- reintento de red con la misma clave en guardado normal, outbox y rutina;
- conflicto de idempotencia como fallo definitivo (sin reintento ni encolado);
- CSV/Excel con una RPC por día y respuesta perdida;
- reimportación sin series nuevas;
- dos importaciones simultáneas turnándose.

```bash
npm run type-check   # OK
npm run lint         # 0 errores, 9 warnings preexistentes en notificationsSchedule.test.ts
npm run build        # OK
```

### PostgreSQL real

```bash
npm run test:db
```

El runner crea un clúster temporal con `initdb`, aplica el bootstrap de Supabase
y las migraciones curadas, ejecuta los escenarios y lo borra. No toca ninguna
base de datos del proyecto.

Resultado real: **7 escenarios secuenciales + 5 pruebas de concurrencia con dos
conexiones simultáneas**, todo OK:

- reintento idempotente y conflicto con otra carga;
- operaciones independientes y claves aisladas entre usuarios;
- importación multiejercicio atómica;
- propiedad de ejercicios y RLS;
- misma clave y misma carga concurrente (una sola fila);
- misma clave y otra carga concurrente (un conflicto);
- claves distintas concurrentes (dos filas);
- importación multiejercicio concurrente;
- normalización de números en la huella.

Los mocks del cliente no sustituyen esta prueba: la garantía de concurrencia la
da el índice único de PostgreSQL y se comprueba con conexiones reales.

## Riesgos residuales

- **Cardio de Excel** sigue con `insert` directo, sin idempotencia. Un reintento
  tras perder la respuesta puede duplicar una sesión de cardio.
- **JSON** es incremental por (día, ejercicio): si falla un ejercicio, el resto
  del fichero puede haberse guardado. Cada llamada es idempotente por separado.
- **`idempotency_hash` no está en `database.types.ts`**. No lo usa el cliente;
  añadirlo obliga a regenerar los tipos.
- **Claves por fecha en CSV/Excel**: si dos importaciones distintas del mismo
  día se solapan, cada una tiene su clave y el dedupe de contenido es lo que
  evita series repetidas.
- El outbox marca el conflicto como fallido y lo conserva para revisión; no lo
  borra automáticamente.
