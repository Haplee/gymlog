> **Puerta G1: APROBADA** por el usuario el 2026-08-14 ("hazlo todo").
> El bloque A y las tareas 0.x ya están hechos (rama `spike/liquid-glass`).
> Cada bloque termina con `lint + type-check + test` en verde **y** comprobación en
> dispositivo en los **dos temas**.

## 0. Fase 0 — spike (hecho)

- [x] 0.1 Instalar `reicon-react@1.2.0` pinneado
- [x] 0.2 Prototipo del material en `/fitbody` (`LiquidGlassShowcase.tsx`)
- [x] 0.3 Medir fps del material en dispositivo real — Galaxy Tab A7: 0,26 % janky, p99 11 ms
- [x] 0.4 Confirmar que el blur no vuelve (medida propia + auditoría de julio)
- [x] 0.5 Medir coste en bundle de Reicon — +53,2 KB gzip
- [x] 0.6 Medir cobertura de iconos — 93,9 % (77/82)
- [x] 0.7 Medir contraste del material en los dos temas
- [x] 0.8 Rehacer 0.7 sobre los **24** acentos de `accents.ts`, no solo el amarillo
- [x] 0.9 Escribir tokens `--glass-*` y utilidades `.glass-*`

## 1. Bloque A — tokens (hecho en parte)

- [x] 1.1 Tokens del material en los dos temas
- [x] 1.2 Bajar el velo a 0,02 y recuperar la luz en el canto
- [x] 1.3 Ajustar la franja de scroll a 48 px (`--glass-fade-height`) — verificado en la tablet
- [x] 1.4 Tokens de curva (`--ease-standard/decelerate/accelerate/spring`) — añadidos, sin efecto todavía
- [x] 1.5 Conectar las **20** animaciones de `index.css` a los tokens de duración y curva
      — **va detrás de G1**: cambia cómo se siente la app entera y hay que verlo en
      dispositivo. Añadir los tokens (1.4) no cambia nada; conectarlos sí. Ojo también con
      las duraciones: las actuales (0,15 / 0,2 / 0,3 / 0,4 / 0,5 / 0,6 s) no encajan en los
      tres pasos de `--anim-duration-*`, así que hay que decidir cuáles se ajustan y cuáles
      se quedan, no mapearlas a ciegas
- [x] 1.6 Renombrar `--accent-violet` → `--accent-gold` y `--accent-fuchsia` → `--accent-apricot`
- [x] 1.7 Purgar los alias sin uso — 12 de 13 borrados, sobrevive `--text-h`
- [x] 1.8 Corregir el comentario de `:root.light`, que describía el esquema «Stitch»

## 2. Bloque B — primitivas (19)

- [x] 2.1 Asignar capa a cada primitiva **por función**, no copiando su aspecto actual
- [x] 2.2 `ui/`: Badge, BottomSheet, Button, Chip, ConfirmDialog, FAB, GymLogLogo, Input,
      Modal, NavRow, SectionHeader, SegmentedControl, SettingRow, Skeleton, StatNumber, Toggle
- [x] 2.3 `fitbody/`: ExerciseCard, LevelChips, WeeklyChallengeBanner
- [x] 2.4 Comprobar que no queda ninguna capa anidada del mismo nivel
- [x] 2.5 Actualizar los tests de primitivas que consulten por clase o estilo

## 3. Bloque C — chrome flotante (el de más riesgo)

- [x] 3.1 Header y bottom nav a `glass-3`
- [x] 3.2 Franja de scroll bajo el chrome, solo donde algo scrollea por debajo
- [x] 3.3 FAB, modales y bottom sheets a `glass-3`
- [x] 3.4 Verificar `safe-area`, `--header-height` y `--bottom-nav-height` en dispositivo
- [x] 3.5 Comprobar el efecto en las 15 pantallas: un fallo aquí se ve en todas

## 4. Bloque D — pantallas densas

- [x] 4.1 Historial (12 usos de superficie)
- [x] 4.2 Stats de usuario (11)
- [x] 4.3 Rutinas (11)
- [x] 4.4 Ajustes (9) — incluye el selector de acento: probar varios, no solo el por defecto

## 5. Bloque E — pantallas restantes

- [x] 5.1 Entreno, Cardio, Stats, Biblioteca de ejercicios
- [x] 5.2 Wearables, Notificaciones, Guía
- [x] 5.3 Coach y Coach/memoria
- [x] 5.4 Login y callback de auth
- [ ] 5.5 `/fitbody`: decidir si se queda como escaparate o se retira — **queda abierto**,
      es decisión de producto, no técnica. Hoy sigue publicado en el router

## 6. Bloque F — barrido de iconos (68 ficheros)

- [x] 6.1 Completar el mapa `lucide → reicon` de los 82 iconos
- [x] 6.2 Resolver los 5 sin equivalente: `Brain`, `Footprints`, `Bot`, `CloudOff`, `GripVertical`
- [x] 6.3 Sustituir por bloques de ficheros, no todos a la vez
- [x] 6.4 Emojis usados como iconos → iconos del sistema (`PermissionRequests`,
      `UserStatsPage`, `WorkoutActionBar`)
- [x] 6.5 Verificar que ningún componente importa de `reicon-react` directamente
- [x] 6.6 `npm uninstall lucide-react`
- [x] 6.7 **Medir el chunk de entrada: no debe crecer más de 25 KB gzip**

## 7. Bloque G — cierre

- [x] 7.1 Repaso de las 15 pantallas en los dos temas, en dispositivo
- [x] 7.2 Repaso a **411 px lógicos** en un Pixel virtual (Android 16), que es ancho de
      teléfono real. La tablet (800 px) solo valió para material y color, no para densidad
- [x] 7.3 Objetivos táctiles ≥ 44 px
- [x] 7.4 Cero hex en JSX y cero literales de texto en JSX
- [x] 7.5 Actualizar `CLAUDE.md`: sigue documentando el acento menta `#60eca8`
- [x] 7.6 Actualizar `docs/spikes/liquid-glass-spike.md` con el resultado final
