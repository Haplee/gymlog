# Plan — Igualar la app a las capturas del README

> STATUS: EN CURSO
> Objetivo: que Workout, Cardio y Stats se vean como `public/screens/*.png`, sin
> perder funcionalidad. Motivo: las capturas del README prometen una interfaz que
> la app no tiene, y eso engaña a quien la descarga.

## Referencia

Los tres PNG de `public/screens/` (1200×2600 ≈ viewport 390 px a 3x). El HTML que
los generó **no está en el repo** (se hizo para el landing). No usar
`docs/design/stitch_screens/*.html`: son del tema menta anterior al reskin.

| Mockup        | Página          | Fichero                                                   |
| ------------- | --------------- | --------------------------------------------------------- |
| `workout.png` | Workout en vivo | `src/features/workout/pages/WorkoutPage.tsx` (950 líneas) |
| `cardio.png`  | Cardio          | `src/features/cardio/pages/CardioPage.tsx` (104)          |
| `stats.png`   | Dashboard       | `src/features/stats/pages/StatsPage.tsx` (1043)           |
| los tres      | Chrome global   | `src/app/components/Layout.tsx` (327)                     |

## Regla de desempate

- **A** — está en la app y se ve distinto → cambiar.
- **B** — está en la app y no sale en el mockup → **conservar**, reubicado.
- **C** — sale en el mockup y no existe → no inventar; anotar.

---

## Fase 1 — Chrome global (Layout)

Aparece en los tres mockups, así que va primero.

| Elemento del mockup                           | Estado actual                                          | Clase                                         |
| --------------------------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| Hamburguesa arriba izquierda                  | No existe                                              | C → se implementa como cajón de lo desplazado |
| Wordmark `GYM`+`LOG` centrado (LOG en acento) | Título de pantalla a la izquierda en acento            | A                                             |
| Icono de usuario arriba derecha               | Avatar en círculo de acento                            | A                                             |
| Borde inferior de cabecera                    | Sin borde                                              | A                                             |
| Nav inferior oscura con borde superior        | Nav **rellena de acento**, esquinas `rounded-t-[20px]` | A                                             |
| Etiquetas de texto en las pestañas            | Solo `aria-label`, sin texto visible                   | A                                             |
| Pestaña activa en acento + barra superior     | Píldora oscura (`layoutId`) tras el icono              | A                                             |
| Pestañas: INICIO·RUTINAS·CARDIO·STATS·AJUSTES | INICIO·RUTINAS·CARDIO·**HISTORIAL**·AJUSTES            | A + ruta                                      |
| Icono de cardio = onda de pulso               | `IconShoe` (zapatilla)                                 | A                                             |

Rutas: la pestaña 4 pasa de `/history` a `/stats`. Ambas existen en `App.tsx`.
**`/history` no puede quedar huérfano** → entra en el cajón (regla B).

Desplazados a `.../AppDrawer.tsx` (regla B, nada se pierde):
búsqueda (lupa), notificaciones + contador de no leídas, historial, biblioteca
de ejercicios, mis medidas, wearables, guía, entrenador.

Invariantes que NO se tocan:

- `--header-height` (56px) y `--bottom-nav-height` (52px) — cambiarlos exige
  verificación en Android (CLAUDE.md). El contenido nuevo cabe dentro.
- `var(--inset-top/--inset-bottom)`: la barra de estado del dispositivo sigue
  respetada aunque los mockups no la dibujen.
- El scroller sigue siendo un `<main>` plano (framer-motion rompía `sticky`).

### Desviación consciente

Los iconos del set propio son **siluetas rellenas** por decisión documentada
(legibilidad a 20 px). Los del mockup son de **trazo**. Se mantiene el relleno:
redibujar el set entero es otro trabajo y arriesga legibilidad. Pendiente de
decisión del usuario.

## Fase 2 — Cardio

| Elemento del mockup                                                          | Estado actual                          | Clase                    |
| ---------------------------------------------------------------------------- | -------------------------------------- | ------------------------ |
| Fila KPI: SESIONES / TIEMPO / DISTANCIA sin tarjeta                          | `WeeklyStats` (a revisar)              | A                        |
| 5 tipos en fila (CORRER·BICI·NADAR·MONTAÑA·HIIT), activo con borde de acento | Rejilla de **8** tipos, `bg-surface-2` | A/B — los 8 se conservan |
| `GRABANDO` + cronómetro gigante con décimas en acento                        | `ActiveSessionCard`                    | A                        |
| PAUSAR (relleno) + TERMINAR (contorno)                                       | idem                                   | A                        |
| ACTIVIDAD RECIENTE con separadores punteados                                 | `SessionHistoryItem`                   | A                        |

## Fase 3 — Workout

Cronómetro de sesión + REANUDAR · título rutina·día · ejercicio + SERIE n ·
campos KG/REPS gigantes con subrayado + botón de check en acento · lista de
series con badges CALENT./PR y separadores punteados · chips CALC. DISCOS / 1RM /
NOTAS · píldora flotante del descanso con barra de progreso.

Lo que hoy existe y **no** sale en el mockup (regla B, conservar): selector de
ejercicio, biblioteca, `LastSessionCard`, `NextSessionCard` (autorregulación),
notas por ejercicio, `HealthMetricsCard`, `CoachSuggestionBanner`, tarjeta de
rutina de hoy, valoración de sesión, borrar todas las series, peso corporal.

## Fase 4 — Stats

`RENDIMIENTO` + rango de fechas · RACHA / VOLUMEN gigantes · VOL. SEMANAL con
barras L-M-X-J-V-S y la de hoy en acento · 1RM estimado en línea de acento sobre
rejilla de puntos · MAPA DE ACTIVIDAD en cuadrícula.

## Fase 5 — Verificación

`npm run lint && npm run type-check && npm run test` + revisión en los **dos
temas** a ~390 px. Pendiente: verificación en dispositivo Android.

## Riesgos

1. **Pérdida de funcionalidad** por perseguir el pixel. Mitigación: regla B.
2. **Modo claro**: los mockups son oscuros; el acento en claro es `#6b5200`.
   Nada de hex en JSX, todo por tokens.
3. **Nav sin `/history`**: si el cajón no se implementa bien, se pierde acceso.
