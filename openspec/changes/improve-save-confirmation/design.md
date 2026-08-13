## Context

`handleSave` (`WorkoutPage.tsx:337`) recibe `{ onlyCompleted?: boolean }` y usa ese mismo flag para dos cosas distintas que no deberían compartir valor:

1. **Qué series guardar** — se pasa tal cual a `saveWorkout`.
2. **Si hay que preguntar** — el guard `if (!onlyCompleted)` de las líneas 371-379.

Como `false` significa a la vez «guardar todas» y «aún no he preguntado», la confirmación no puede expresar «guardar todas, ya está decidido». De ahí el bucle.

El patrón de memoria a replicar está en `ExerciseLoadType.tsx:11-29`: una clave de `localStorage`, un lector tolerante a fallos (`try/catch` que devuelve el valor neutro) y un escritor que ignora el error si el almacenamiento está lleno.

## Goals / Non-Goals

**Goals:**

- Que «Guardar todas» guarde.
- Preguntar como mucho una vez; después aplicar la elección recordada sin diálogo.
- Que la preferencia se pueda cambiar desde la app.
- No perder series por accidente en ninguna rama.

**Non-Goals:**

- Cambiar la semántica de `onlyCompleted` dentro de `workoutStore.saveWorkout`.
- Persistir la preferencia en Supabase o sincronizarla entre dispositivos.

## Decisions

### D1 — Separar «qué guardar» de «si preguntar»

`handleSave` pasa a recibir un alcance opcional y explícito:

```
type SaveScope = 'all' | 'completed-only';

handleSave(opts?: { scope?: SaveScope })
```

- **`scope` presente** → se guarda con ese alcance, sin pasar por la decisión. Es lo que usan las dos ramas del diálogo, y lo que rompe el bucle.
- **`scope` ausente** → se resuelve:
  1. Si no hay mezcla (cero completadas o cero pendientes con datos) → `'all'`, como hoy.
  2. Si hay mezcla y existe preferencia guardada → esa preferencia, sin diálogo.
  3. Si hay mezcla y no hay preferencia → abrir el diálogo y salir.

La resolución vive en una función pura testeable, separada del componente.

**Alternativa descartada:** añadir un flag `force` al objeto actual. Mantiene el doble significado de `onlyCompleted` y deja el mismo pie para el siguiente bug.

### D2 — La preferencia es de elección única, con «preguntar» como ausencia

`ExerciseLoadType` guarda un **conjunto** de ids confirmados; aquí basta un único valor. Se modela con la ausencia de clave como estado «preguntar»:

```
readSaveScope(): SaveScope | null      // null = preguntar
writeSaveScope(scope: SaveScope): void
clearSaveScope(): void                 // volver a preguntar
```

Clave: `gymlog-save-scope`. Lectura tolerante: cualquier valor no reconocido se trata como `null`, de modo que un `localStorage` corrupto degrada a preguntar y no a perder series.

### D3 — La salida vive en Ajustes → Preferencias

Es donde ya están las preferencias de sesión (tema, unidades, descanso), así que es el sitio que el usuario mirará. Tres opciones excluyentes —Preguntar / Guardar todas / Solo completadas— sobre la misma clave, sin duplicar el estado en `settingsStore`: la fuente de verdad sigue siendo `localStorage`, igual que en `ExerciseLoadType`.

**Alternativa descartada:** pulsación larga sobre «Guardar». No se descubre y no es accesible.

### D4 — El gesto de atrás cierra el diálogo

`registerBackAction('workout-save-dialog', …)` mientras el diálogo esté abierto, igual que `workout-rating` y `workout-plates` (`WorkoutPage.tsx:171-179`). Cerrar por atrás equivale a cancelar: no guarda y no fija preferencia.

## Risks / Trade-offs

- **Guardado silencioso.** Tras la primera elección, «Guardar» actúa sin preguntar y puede descartar series si la preferencia guardada es `'completed-only'`. Mitigación: el aviso de resultado ya indica cuántas series se guardaron, y la preferencia es visible y reversible en Ajustes.
- **Preferencia por dispositivo.** Al vivir en `localStorage`, no viaja entre la PWA y la app nativa. Aceptado: es una preferencia de interacción, no un dato de entrenamiento.

## Migration Plan

Sin migración. La ausencia de la clave equivale al comportamiento actual de preguntar, así que los usuarios existentes ven el diálogo una vez más y luego dejan de verlo.
