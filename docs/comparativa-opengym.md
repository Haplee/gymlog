# GymLog vs. openGym — comparativa y plan de mejora

> Fecha del análisis: **25 de agosto de 2026**
> Repositorio analizado: `arvids-unavailable/openGym` (fork/espejo de
> `DuarteSantos8/openGym`) — 4.407 estrellas, 803 forks, creado el 3-ago-2026.
> Análisis hecho sobre un clon local que ya se ha borrado.

---

## 0. Aviso de licencia (leer antes de tocar nada)

| Proyecto    | Licencia     |
| ----------- | ------------ |
| **GymLog**  | **MIT**      |
| **openGym** | **AGPL-3.0** |

**No se puede copiar código de openGym a GymLog.** La AGPL es vírica: cualquier
fichero derivado obligaría a relicenciar GymLog entero bajo AGPL y a publicar el
código de la instancia desplegada. Todo lo que sigue se plantea como
**inspiración funcional**: leer qué problema resuelven y reimplementarlo con
código propio en TypeScript sobre la arquitectura de GymLog.

Lo único directamente reutilizable sin fricción es el **dataset de ejercicios**
que openGym consume (`hasaneyldrm/exercises-dataset`), que tiene sus propios
términos — conviene revisarlos antes de empaquetarlo.

---

## 1. Los dos proyectos de un vistazo

|                        | **GymLog**                                        | **openGym**                                                                     |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Modelo                 | SaaS personal (Supabase)                          | **Self-hosted** (`docker compose up`)                                           |
| Stack front            | React 19 + **TypeScript** + Vite 6 + Tailwind v4  | React 19 + **JavaScript** + Vite + CSS a mano                                   |
| Estado                 | Zustand 5 + TanStack Query                        | Zustand                                                                         |
| Backend                | Supabase (Postgres + Auth + RPC + Edge Functions) | Node **sin framework**, 1 dependencia, **JSON en ficheros**                     |
| Auth                   | Google OAuth                                      | **Passkeys (WebAuthn)** + perfiles locales                                      |
| Móvil                  | PWA + APK Android (Capacitor 8)                   | PWA + APK Android (Capacitor), sin tienda                                       |
| Catálogo de ejercicios | **API remota** ExerciseDB (online)                | **1.324 ejercicios empaquetados en local** + media descargada una vez (~140 MB) |
| Idiomas                | 2 (español + inglés)                              | **12** de UI, instrucciones en 10                                               |
| Tests                  | Vitest + Testing Library + MSW + Playwright       | Vitest sobre funciones puras                                                    |
| Licencia               | MIT                                               | AGPL-3.0                                                                        |

Son proyectos con la **misma superficie funcional y filosofías opuestas de
infraestructura**: GymLog apuesta por backend gestionado y funcionalidad «de
arriba» (IA, wearables, analítica); openGym apuesta por cero dependencias
externas y profundidad en la **mecánica del entrenamiento**.

---

## 2. Qué tiene openGym que GymLog no tiene

Ordenado por lo que de verdad aporta a quien entrena.

### 2.1 Mecánica de entrenamiento (lo más valioso)

| Funcionalidad                          | Qué es                                                                                                                                                                                                                                                                               | Dónde vive en openGym                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **Políticas de progresión con nombre** | `off` / lineal / **Greyskull LP** / doble progresión / añadir tiempo. Se elige una por rutina y se puede sobrescribir por ejercicio                                                                                                                                                  | `lib/progression.js`                        |
| **El «por qué» de cada número**        | Cada peso propuesto viene con su frase: «cada repetición la última vez → +2,5 kg», «fallaste 3 sesiones → descarga a 60 kg»                                                                                                                                                          | `nextPrescription()` devuelve `{kind, why}` |
| **Nada se escribe en el historial**    | La prescripción se **deriva** del log cada vez; no hay contadores guardados. Corriges una serie mal tecleada y el siguiente objetivo se recalcula solo                                                                                                                               | cabecera de `progression.js`                |
| **Lectura honesta de la sesión**       | Serie sin marcar = fallo. Menos series de las prescritas = fallo. Una sesión que se cayó nunca sube la carga                                                                                                                                                                         | `readSession()`                             |
| **Superseries**                        | Se construyen y se registran seguidas, con descanso solo tras el par                                                                                                                                                                                                                 | `history.js`, `Workout.jsx`                 |
| **Ejercicios por tiempo**              | Planchas, isométricos, paseos del granjero: se registran en segundos, con **cronómetro de trabajo** distinto del de descanso, y pueden llevar peso                                                                                                                                   | `modeOf()` = `time`                         |
| **Repeticiones por lado**              | Unilaterales: registras el total (16), la app muestra «8 por lado» y el objetivo sube de dos en dos para que nunca quede impar                                                                                                                                                       | `isPerSide`, `repStep`                      |
| **Peso corporal como categoría real**  | ~300 ejercicios saben que no llevan carga: no hay columna de peso. Con cinturón de lastre vuelven a progresar por peso; sin él suben repeticiones y, pasado un techo, **añaden una serie** en vez de una repetición (hasta 6), momento en el que la recomendación honesta es lastrar | bloque `w <= 0` de `progression.js`         |
| **1RM estimado con criterio**          | Epley / Brzycki / Lombardi, **se niega a estimar por encima de 12 reps**, y dice de qué serie salió el número («142,5 kg desde 100×10»)                                                                                                                                              | `lib/onerm.js`                              |
| **Pantalla encendida al entrenar**     | Wake Lock re-adquirido en cada `visibilitychange`, liberado al terminar, conmutable en ajustes                                                                                                                                                                                       | `lib/wakelock.js`                           |

### 2.2 Datos y portabilidad

| Funcionalidad                  | Detalle                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Importadores de otras apps** | FitNotes (Android e iOS), Strong y Hevy — incluido el RPE que registran — y peso corporal desde un export de Apple Health (XML de cientos de MB, escaneado sin construir DOM). Parser CSV real (comillas, comas embebidas, BOM, CRLF) y mapa **por cabecera**, no por posición |
| **Nada se descarta**           | Los nombres no reconocidos se convierten en ejercicios propios en lugar de perderse                                                                                                                                                                                            |
| **Compartir un plan**          | Rutinas + calendario semanal como fichero pequeño (sin entrenamientos ni pesajes), o impreso como **PDF**. Al importar **fusiona**, nunca sobrescribe                                                                                                                          |
| **Catálogo offline**           | Los 1.324 ejercicios van en el bundle; la media se descarga una sola vez                                                                                                                                                                                                       |
| **Ejercicios propios**         | Nombre + parte del cuerpo basta; se comportan como los nativos en todas partes                                                                                                                                                                                                 |
| **Filtro por equipamiento**    | Las opciones se adaptan a lo ya elegido, así que ninguna combinación en pantalla da cero resultados                                                                                                                                                                            |

### 2.3 Visualización

| Funcionalidad                 | Detalle                                                                                                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mapa muscular**             | Silueta frontal y trasera sombreada por trabajo acumulado (semana / mes / histórico). Nombra los músculos que **no** has entrenado, previsualiza qué golpea una rutina mientras la construyes y muestra lo que acabas de entrenar al terminar. Figura masculina o femenina |
| **Normalización de músculos** | 19 nombres primarios y 40 secundarios del dataset colapsan sobre 18 músculos dibujables; lo no dibujable (manos, tobillos, «sistema cardiovascular») se descarta en vez de adivinarse                                                                                      |
| **Heatmap anual**             | Estilo GitHub, sombreado por tiempo entrenado                                                                                                                                                                                                                              |

### 2.4 Infraestructura y producto

- **Passkeys** (Face ID / huella) en lugar de contraseñas, con perfiles independientes.
- **Panel de administración** opcional: quién entrena ahora, historial por usuario, desactivar cuentas, registro solo por invitación.
- **12 idiomas**, con instrucciones de ejercicio cargadas bajo demanda.
- **Modo invitado** y **demo en vivo** que corre entera en el navegador con datos de ejemplo.
- **Sin telemetría**; un `docker compose up` y listo.
- README y CHANGELOG de nivel comercial: es buena parte de por qué tiene 4.400 estrellas en tres semanas.

---

## 3. Qué tiene GymLog que openGym no tiene

Esto no es un repositorio al que «haya que alcanzar»: en varias áreas GymLog va por delante.

| Funcionalidad                                  | Detalle                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entrenador IA opt-in**                       | Edge Function `ai-coach` con la clave solo en `Deno.env`, verificación de JWT, post-filtro determinista (`safety.ts`), memoria del coach, y una capa 0 local que sigue funcionando con el coach apagado |
| **Autorregulación por esfuerzo**               | `autoregulation.ts` decide la carga desde el RIR/RPE registrado, no solo desde las repeticiones alcanzadas: estancamiento por e1RM (sesiones **y** días), descarga, y dato caducado a los 14 días       |
| **Cadena de frenos única**                     | `loadAdvisor.ts`: motor de esfuerzo → estancamiento → volumen semanal del grupo muscular → recuperación del día (wearable). Ningún freno puede subir carga, solo bajarla o dejarla quieta               |
| **Integración con wearables**                  | Health Connect / Fitbit: sueño y pulso modulan la recomendación del día                                                                                                                                 |
| **Cardio con temporizador de sesión**          | Feature propia con su store, no un modo de registro                                                                                                                                                     |
| **Analítica avanzada**                         | Fatiga muscular por recuperación, proyección de volumen, comparación de periodos, comparador de ejercicios, KPIs, consejos                                                                              |
| **Sistema de diseño medido**                   | «Liquid Glass» de 3 capas, 24 acentos con pareja clara/oscura, temas claro **y** oscuro completos, y `npm run audit:contrast` que falla si el contraste WCAG se rompe                                   |
| **TypeScript estricto**                        | openGym es JavaScript sin tipos                                                                                                                                                                         |
| **Calidad de proceso**                         | ESLint 9 + Prettier + husky + lint-staged + commitizen + Playwright e2e + CI que compila la APK                                                                                                         |
| **Offline con outbox**                         | `outboxStore` + persistencia de TanStack Query                                                                                                                                                          |
| **Export/Import Excel y CSV**                  | Historial completo con esquema validado por Zod                                                                                                                                                         |
| **Calculadora de discos**                      | `PlatesCalculator.tsx`                                                                                                                                                                                  |
| **Icono del lanzador que sigue al acento**     | En Android, vía `AppIconPlugin.kt`                                                                                                                                                                      |
| **Landing pública, tutorial y guía en la app** | `public/landing.html`, `public/tutorial.html`, `/guide`                                                                                                                                                 |

---

## 4. Las diferencias que de verdad importan

1. **openGym es más profundo en la mecánica del gimnasio; GymLog es más profundo
   en la inteligencia sobre los datos.** openGym sabe qué es una superserie, una
   plancha y un ejercicio unilateral. GymLog sabe si has dormido mal esta semana
   y si el volumen de pecho se ha disparado, pero lo registra todo como
   peso × repeticiones.

2. **openGym no depende de nadie; GymLog depende de Supabase y de ExerciseDB.**
   El catálogo de GymLog viene de una API remota cuyo tier gratuito ni siquiera
   pagina bien (está documentado en `exercisedb.ts`). Sin red, no hay catálogo.

3. **Los dos explican sus números, y GymLog lo hace con más matiz.** Al ir a
   implementarlo se comprobó que ya existía: `LoadSuggestion.reasonKey` con 18
   motivos distintos más la causa del estancamiento, pintado en
   `SessionExerciseCard`, `NextSessionCard` y `DeloadCard`. openGym tiene el
   mismo patrón con menos casos.

4. **openGym te deja traerte tu historial de otra app; GymLog no.** Es la barrera
   de entrada número uno para cualquiera que lleve dos años en Strong o Hevy.

---

## 5. Plan de implementación propuesto

Cinco fases ordenadas por **retorno / esfuerzo**. Cada una es independiente y se
puede parar en cualquier punto. Los tamaños son estimaciones sobre la
arquitectura actual de GymLog (S = horas, M = un día, L = varios días).

### Fase 1 — Barato y de efecto inmediato (1-2 días)

| #   | Tarea                                      | Esfuerzo | Notas de implementación                                                                                                                                                                                                           |
| --- | ------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **Wake Lock durante el entrenamiento**     | S        | Hook `useWakeLock(enabled)` en `@shared/hooks`. La clave es re-adquirir en `visibilitychange`, no una sola petición. Interruptor en Ajustes → Preferencias. Verificar en la APK, no solo en Chrome de escritorio                  |
| 1.2 | ~~El «por qué» de cada carga sugerida~~    | —        | **Ya estaba hecho.** `LoadSuggestion.reasonKey` + 18 textos en `coach.reason.*`, pintados en `SessionExerciseCard`, `NextSessionCard` y `DeloadCard`. Tarea retirada                                                              |
| 1.3 | **Aviso de fiabilidad en el 1RM estimado** | S        | **No se puede capar `calcular1RM`**: lo usan 14 sitios, incluidas la detección de estancamiento (`autoregulation.ts`) y la de récords. El umbral se añade como `es1RMFiable()` y lo aplica **quien pinta el número**, no el motor |

### Fase 2 — Cerrar el hueco de mecánica (3-5 días)

> **Propuesta escrita y pendiente de aprobación**: `openspec/changes/add-logging-modes/`.
> Al investigar el esquema, tres suposiciones de esta tabla resultaron falsas —
> `duration_seconds` y `is_bilateral` ya existen, y las rutinas son una columna
> `Json` que no necesita migración—. El bloqueo real es `reps NOT NULL`.

| #   | Tarea                                                          | Esfuerzo | Notas                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **Modo de registro por ejercicio: `reps` / `time` / `cardio`** | **L**    | Es el cambio estructural de la fase y condiciona 2.2 y 2.3. Requiere migración idempotente en `supabase/migrations/` (columna `mode`, ausente = `reps`) y que todo lo que lee series lo tolere. Nada de migrar datos existentes: la ausencia del campo debe seguir leyéndose como `reps` |
| 2.2 | **Ejercicios por tiempo** con cronómetro de trabajo            | M        | Encima de 2.1. Usar `restTimerStore` como referencia pero con store propio: el cronómetro de trabajo y el de descanso no pueden compartir estado                                                                                                                                         |
| 2.3 | **Repeticiones por lado (unilateral)**                         | S        | Bandera `perSide` sobre el modo, no un modo nuevo. Se registra el total; la UI deriva «8 por lado»; el paso del objetivo pasa a 2                                                                                                                                                        |
| 2.4 | **Superseries**                                                | M        | Agrupación en la rutina y descanso solo al final del grupo. Toca `routineStore` y `RoutineSession`                                                                                                                                                                                       |
| 2.5 | **Peso corporal como categoría de primera**                    | M        | Ya existe `workout/utils/bodyweight.ts`: extenderlo para que la progresión suba repeticiones y, pasado un techo, añada una serie hasta un máximo — a partir de ahí la recomendación honesta es lastrar                                                                                   |

### Fase 3 — Portabilidad de datos (2-4 días)

| #   | Tarea                                   | Esfuerzo | Notas                                                                                                                                                                                                                                            |
| --- | --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1 | **Importador desde Strong y Hevy**      | M        | La infraestructura está: `excelImport.ts` + `importSchema.ts` con Zod. Falta un parser CSV serio (comillas, comas embebidas, BOM, CRLF) y un **mapa por cabecera**, no por posición. Los nombres no reconocidos se crean como ejercicios propios |
| 3.2 | **Importador FitNotes**                 | S        | Una vez existe 3.1, es añadir alias de cabecera                                                                                                                                                                                                  |
| 3.3 | **Peso corporal desde Apple Health**    | S/M      | Escanear el XML por streaming: un export real ronda cientos de MB y no cabe en un DOM                                                                                                                                                            |
| 3.4 | **Compartir rutina como fichero + PDF** | M        | Solo rutinas y calendario, nunca entrenamientos ni pesajes. Al importar, **fusionar**. El PDF puede salir de `window.print()` con una hoja de estilos dedicada antes que añadir una dependencia                                                  |

### Fase 4 — Visualización y catálogo (3-5 días)

| #   | Tarea                                         | Esfuerzo | Notas                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | **Mapa muscular (silueta frontal y trasera)** | **L**    | Los datos ya existen: `muscleDistribution.ts`, `fatigueAnalysis.ts`, `muscleColors.ts`. Falta el SVG y la tabla de alias que normaliza los nombres del catálogo. **Dibujar paths propios**: los de openGym son AGPL. Debe respetar los dos temas y los 24 acentos |
| 4.2 | **Catálogo de ejercicios offline**            | M        | Hoy depende de ExerciseDB en remoto. Empaquetar un dataset local (revisando su licencia) y dejar la API como enriquecimiento opcional. Ojo al tamaño del bundle: carga bajo demanda, no en el arranque                                                            |
| 4.3 | **Filtro por equipamiento adaptativo**        | S        | Que las opciones se recalculen sobre el conjunto ya filtrado, para que ninguna combinación dé cero resultados                                                                                                                                                     |
| 4.4 | **Ejercicios propios de usuario**             | M        | Nombre y grupo muscular; que se comporten como los nativos en rutinas, historial y analítica                                                                                                                                                                      |

#### Estado de la Fase 4 (25 de agosto de 2026)

| #   | Estado                        | Qué se encontró                                                                                                                                                                                                                            |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | **Pendiente**                 | Es la de verdad grande. Los paths hay que dibujarlos desde cero (los de openGym son AGPL) y auditarlos con `audit:contrast` contra los 24 acentos en los dos temas                                                                         |
| 4.2 | **Pendiente — decisión tuya** | No es trabajo de código sino de licencia: hay que elegir un dataset y comprobar que su licencia permite empaquetarlo en una app MIT. Es justo el terreno que pediste no pisar a la ligera, así que no se ha elegido ninguno por ti         |
| 4.3 | **Hecho**                     | Añadido el filtro por equipamiento y hechos adaptativos los dos: las opciones de cada uno se calculan sobre lo que dejan los demás, así que ningún chip pulsable lleva a cero resultados. 6 tests sobre esa propiedad                      |
| 4.4 | **Ya estaba**                 | `createCustomExercise` + `resolveOrCreateExercise` con `user_id` e índice único `(user_id, lower(name))`, y el catálogo ya ofrece crearlos. Se comportan como los nativos porque son filas de la misma tabla. Esta tabla lo daba por hacer |

#### Estado de la Fase 5

Sigue siendo opcional y estratégica, con una corrección medida:

- **5.4 (medidas corporales) tiene más contenido del que decía la tabla.**
  `userStats/BodyMeasurements.tsx` existe, pero solo cubre **peso y % de grasa**.
  Cintura, brazo, pecho y muslo no están en ninguna parte, ni en la UI ni en el
  esquema: añadirlas es una migración, no un formulario.
- El resto (5.1, 5.2, 5.3, 5.5) son decisiones de producto, no tareas: a qué
  público te diriges, cuántos idiomas quieres mantener sincronizados y si te
  interesa el usuario que no quiere sus datos en Supabase.

### Fase 5 — Opcional / estratégico

| #   | Tarea                                                                           | Comentario                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | **Políticas de progresión con nombre** (lineal, Greyskull LP, doble progresión) | GymLog ya tiene un motor **mejor** (autorregulación por esfuerzo). Esto sería ofrecer al usuario elegir un programa clásico en lugar del motor. Merece la pena solo para atraer al público de 5×5 / Greyskull; si no, es duplicar la decisión |
| 5.2 | **Tercer idioma**                                                               | El inglés **ya existe** en `resources.ts` (bloque `en`). Añadir un tercero es replicar el bloque; el coste real es mantenerlos sincronizados                                                                                                  |
| 5.3 | **Passkeys**                                                                    | Alternativa o complemento a Google OAuth. Supabase soporta WebAuthn y ya hay dominio HTTPS estable (`app.gymlog.dpdns.org`)                                                                                                                   |
| 5.4 | **Medidas corporales** (cintura, brazo…)                                        | Ya existe `userStats/BodyMeasurements.tsx` — comprobar qué cubre antes de plantear nada                                                                                                                                                       |
| 5.5 | **Modo self-hosted**                                                            | Cambio de modelo de producto, no una funcionalidad. Solo si interesa el público que no quiere sus datos en Supabase                                                                                                                           |

### Orden recomendado

```
Fase 1  ─▶  Fase 3  ─▶  Fase 2  ─▶  Fase 4  ─▶  Fase 5
(2 días)    (quita la    (mecánica:   (visual)    (estratégico)
            barrera de   el cambio
            entrada)     estructural)
```

La Fase 3 va antes que la 2 porque **importar historial es lo que hace que
alguien pruebe la app**, mientras que las superseries las echa de menos quien ya
la usa. La Fase 2 es la que toca el esquema, así que conviene abordarla con el
resto estable.

---

## 6. Riesgos y cosas que vigilar

- **Licencia (crítico).** Nada de copiar y pegar de openGym: ni paths SVG, ni
  tablas de alias, ni funciones. Leer, entender, reimplementar.
- **La migración de `mode` (Fase 2.1) toca el esquema.** Según las reglas del
  proyecto eso exige plan aprobado antes de escribir código, y la migración debe
  ser idempotente.
- **El catálogo offline puede engordar el bundle.** El de openGym son 888 KB de
  JavaScript solo de datos. Carga bajo demanda o se resiente el arranque de la APK.
- **El mapa muscular hay que auditarlo con `npm run audit:contrast`** en los dos
  temas y contra los 24 acentos: el peor caso no es el amarillo por defecto, es
  `lime #cbf24c`.
- **El Wake Lock miente en escritorio.** Verificar en la APK sobre el Pixel, que
  es donde importa.

---

## 7. Qué NO copiar

- **Ficheros JSON planos como base de datos.** Funciona en openGym porque no hay
  concurrencia real; GymLog tiene Supabase con RLS y no gana nada.
- **Node sin framework.** Las Edge Functions ya cubren ese hueco.
- **Perder los tipos.** openGym es JavaScript; retroceder ahí sería un paso atrás.
- **El panel de administración.** GymLog es de un usuario, no multi-inquilino.
