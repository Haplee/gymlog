# Auditoría de persistencia de rutinas

> Bloque 5 del plan de mejora integral. Verificado el 31 de julio de 2026 contra
> el esquema real del proyecto Supabase y el código de `src/features/routine/`.

## Conclusión

**La sincronización ya existe y funciona.** El plan partía de la sospecha de que
las rutinas vivían solo en el dispositivo; no es el caso. Lo que sí ha aparecido
son tres cosas: una plantilla nueva no llegaba a quien ya tenía la app instalada
(corregido), una política RLS duplicada que puede morder en el futuro (migración
escrita, sin aplicar) y un hueco menor de restauración (documentado abajo).

## Lo que hay

### Esquema

La tabla no se llama `routines` ni hay `routine_exercises`, como asumía el plan.
Es **una sola tabla** con la rutina entera en JSON:

```
public.user_routines
  user_id     uuid   -> auth.users
  routine     jsonb  -> { routines: Routine[], activeRoutineId, lastBackup }
  updated_at  timestamptz
```

El `upsert` va con `onConflict: 'user_id'`, así que hay una fila por usuario.
Solo se suben las rutinas propias (`isCustom`); las plantillas no se guardan
porque salen del código.

### RLS

Está activada, y la fila solo es visible y escribible por su dueño:

```sql
routines_own  FOR ALL  USING (auth.uid() = user_id)  WITH CHECK (auth.uid() = user_id)
```

### Estrategia local-first

Es exactamente la que pedía el punto 5.2, y ya estaba implementada:

- El estado vive en `localStorage` vía `zustand/persist` — la app funciona
  entera sin conexión.
- `saveToDb` sube tras **cada** cambio (crear, clonar, borrar, editar días,
  reordenar ejercicios) y también antes de cerrar sesión.
- `loadFromDb` hace un **merge no destructivo**: lo local manda y lo remoto solo
  restaura lo que falta. Una rutina cuyo guardado falló no desaparece al
  recargar, y si detecta rutinas locales que la nube no conoce, las vuelve a
  subir sola.
- `checkAndBackup` fuerza copia si han pasado más de 3 días.
- Hay guardas contra carreras: `loadFromDb` espera a que termine un `saveToDb`
  en vuelo antes de leer, para no revertir con datos viejos.

## Lo que se ha corregido

### Las plantillas nuevas no llegaban a nadie

`persist` sustituye el estado inicial por el guardado en disco, y el guardado
incluía la lista de plantillas tal como estaba el día de la instalación. Efecto:
**una plantilla añadida al código solo la veía quien instalase de cero.** Quien
ya usaba GymLog no la recibía nunca — incluida la rutina de balonmano del bloque
4, que habría sido invisible para el único usuario que la pidió.

Corregido con un `merge` en el `persist` del store: las plantillas se reinyectan
desde el código en cada arranque y del disco solo se conservan las rutinas
propias. Es seguro porque las plantillas no se pueden editar (editarlas clona) ni
borrar (el botón de borrar solo sale en las propias).

Cubierto por un test que falla si se quita el `merge`.

## Lo que queda pendiente de decisión

### 1. Política RLS duplicada (migración escrita, NO aplicada)

`user_routines` tiene dos políticas permissive FOR ALL con la misma condición:
`routines_all` y `routines_own`. Hoy son equivalentes y **no hay fuga**: las dos
exigen `auth.uid() = user_id`.

La trampa es futura. Las políticas permissive se combinan con OR, así que si
algún día se endurece `routines_own`, `routines_all` seguiría concediendo el
acceso antiguo por su cuenta y el endurecimiento no haría nada — sin error ni
aviso.

Migración lista en
`supabase/migrations/20260731120000_dedupe_user_routines_policies.sql`.
**Está sin aplicar a propósito**: toca las políticas de la base de producción y
esa decisión es del dueño del proyecto.

### 2. La restauración solo ocurre si visitas Rutinas

`loadFromDb` se llama únicamente al montar `RoutinePage`. En una instalación
nueva, quien no entre a la pestaña de Rutinas no recupera sus rutinas de la nube,
aunque estén guardadas. `checkAndBackup` (que sí corre también desde Inicio)
solo sube, no baja.

No es urgente porque el caso real —abrir Rutinas para usarlas— pasa por ahí de
todos modos. Si se quiere cerrar, el sitio natural es la tarea de sesión que ya
existe en `src/app/sessionTasks.ts`.

### 3. Un dato corrupto en el historial

Fuera del alcance de este bloque, pero conviene saberlo: hay series de «Curl
bíceps mancuerna» registradas con 125 kg, lo que produce un 1RM estimado de
175 kg. Eso contamina las marcas personales y cualquier cálculo de progresión.
