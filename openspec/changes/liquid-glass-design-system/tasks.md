> **Puerta G1:** los bloques B–G no empiezan hasta que el usuario apruebe `design.md`.
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
- [ ] 1.4 Tokens de curva (`--ease-standard/decelerate/accelerate/spring`)
- [ ] 1.5 Conectar las ~16 animaciones de `index.css` a los tokens de duración y curva
- [ ] 1.6 Renombrar `--accent-violet` y `--accent-fuchsia` por su función real
- [ ] 1.7 Purgar los alias de compatibilidad sin uso (verificar con grep antes de borrar)
- [ ] 1.8 Corregir el comentario de `:root.light`, que describe el esquema «Stitch»

## 2. Bloque B — primitivas (19)

- [ ] 2.1 Asignar capa a cada primitiva **por función**, no copiando su aspecto actual
- [ ] 2.2 `ui/`: Badge, BottomSheet, Button, Chip, ConfirmDialog, FAB, GymLogLogo, Input,
      Modal, NavRow, SectionHeader, SegmentedControl, SettingRow, Skeleton, StatNumber, Toggle
- [ ] 2.3 `fitbody/`: ExerciseCard, LevelChips, WeeklyChallengeBanner
- [ ] 2.4 Comprobar que no queda ninguna capa anidada del mismo nivel
- [ ] 2.5 Actualizar los tests de primitivas que consulten por clase o estilo

## 3. Bloque C — chrome flotante (el de más riesgo)

- [ ] 3.1 Header y bottom nav a `glass-3`
- [ ] 3.2 Franja de scroll bajo el chrome, solo donde algo scrollea por debajo
- [ ] 3.3 FAB, modales y bottom sheets a `glass-3`
- [ ] 3.4 Verificar `safe-area`, `--header-height` y `--bottom-nav-height` en dispositivo
- [ ] 3.5 Comprobar el efecto en las 15 pantallas: un fallo aquí se ve en todas

## 4. Bloque D — pantallas densas

- [ ] 4.1 Historial (12 usos de superficie)
- [ ] 4.2 Stats de usuario (11)
- [ ] 4.3 Rutinas (11)
- [ ] 4.4 Ajustes (9) — incluye el selector de acento: probar varios, no solo el por defecto

## 5. Bloque E — pantallas restantes

- [ ] 5.1 Entreno, Cardio, Stats, Biblioteca de ejercicios
- [ ] 5.2 Wearables, Notificaciones, Guía
- [ ] 5.3 Coach y Coach/memoria
- [ ] 5.4 Login y callback de auth
- [ ] 5.5 `/fitbody`: decidir si se queda como escaparate o se retira

## 6. Bloque F — barrido de iconos (68 ficheros)

- [ ] 6.1 Completar el mapa `lucide → reicon` de los 82 iconos
- [ ] 6.2 Resolver los 5 sin equivalente: `Brain`, `Footprints`, `Bot`, `CloudOff`, `GripVertical`
- [ ] 6.3 Sustituir por bloques de ficheros, no todos a la vez
- [ ] 6.4 Emojis usados como iconos → iconos del sistema (`PermissionRequests`,
      `UserStatsPage`, `WorkoutActionBar`)
- [ ] 6.5 Verificar que ningún componente importa de `reicon-react` directamente
- [ ] 6.6 `npm uninstall lucide-react`
- [ ] 6.7 **Medir el chunk de entrada: no debe crecer más de 25 KB gzip**

## 7. Bloque G — cierre

- [ ] 7.1 Repaso de las 15 pantallas en los dos temas, en dispositivo
- [ ] 7.2 **Repaso a ~390 px en un teléfono** — la tablet no sirve para juzgar densidad
- [ ] 7.3 Objetivos táctiles ≥ 44 px
- [ ] 7.4 Cero hex en JSX y cero literales de texto en JSX
- [ ] 7.5 Actualizar `CLAUDE.md`: sigue documentando el acento menta `#60eca8`
- [ ] 7.6 Actualizar `docs/spikes/liquid-glass-spike.md` con el resultado final
