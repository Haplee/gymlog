# GymLog — Hallazgos de la auditoría legal

- **Fecha:** 26/10/2026
- **Base:** `main` @ `831de27`, árbol de trabajo con cambios sin confirmar
- **Método:** lectura de código y migraciones; contraste documental con BOE y AEPD
- **Fuentes oficiales consultadas el 26/10/2026** (todas respondieron HTTP 200):
  - RGPD — https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807
  - LOPDGDD — https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673
  - LSSI — https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
  - TRLGDCU — https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555
  - Reglamento (UE) 2024/1689 (IA) — https://www.boe.es/buscar/doc.php?id=DOUE-L-2024-81079
  - Reglamento (UE) 2026/1744 (modificación IA) — https://www.boe.es/buscar/doc.php?id=DOUE-L-2026-81147
  - AEPD, guía de cookies — https://www.aepd.es/guias/guia-cookies.pdf
  - AEPD, RAT — https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/actividades-tratamiento
  - AEPD, listas EIPD — https://www.aepd.es/documento/listas-dpia-es-35-4.pdf
  - AEPD, gestión de riesgos y EIPD — https://www.aepd.es/guias/gestion-riesgo-y-evaluacion-impacto-en-tratamientos-datos-personales.pdf

## Cómo leer la columna «Estado»

| Etiqueta                              | Significado                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| **(1) Probado en código**             | Hecho verificable con `archivo:línea`. No implica por sí solo infracción.               |
| **(2) Documentado, no confirmado**    | El propio repositorio lo afirma, pero no se ha verificado contra el tercero.            |
| **(3) Obligación potencial**          | La norma puede aplicar, pero depende de un hecho externo o de calificación jurídica.    |
| **(4) Incumplimiento confirmado**     | Contraste directo entre lo exigido y lo implementado, sin depender de paneles externos. |
| **(5) Requiere revisión profesional** | La calificación exige abogado; la evidencia técnica está probada.                       |

**Gravedad:** rúbrica legal de `mariana-audit` (CRITICAL: obligación fundamental ausente; HIGH: brecha significativa; MEDIUM: documentación; LOW: mejora). Se aplica la regla de escalado por datos sensibles (+1 nivel) ya incorporada en la asignación.

---

## Tabla resumen

| ID   | Hallazgo                                                             | Gravedad | Confianza             | Estado    |
| ---- | -------------------------------------------------------------------- | -------- | --------------------- | --------- |
| F-01 | Política de privacidad no informa de los tratamientos reales         | CRITICAL | PROVEN                | (1) + (4) |
| F-02 | Datos de salud sin condición del art. 9.2 ni base jurídica declarada | CRITICAL | PROVEN                | (1) + (5) |
| F-03 | Borrado de cuenta prometido y no implementado                        | CRITICAL | PROVEN                | (4)       |
| F-04 | Proveedor de IA sin DPA declarado y sin base de transferencia        | CRITICAL | PROVEN (documental)   | (2) + (5) |
| F-05 | Transferencias internacionales no identificadas ni informadas        | HIGH     | PROVEN / NV_DASHBOARD | (3)       |
| F-06 | Registro de actividades de tratamiento no consta                     | HIGH     | PROVEN (ausencia)     | (1) + (3) |
| F-07 | Evaluación de impacto no consta                                      | HIGH     | PROVEN (ausencia)     | (3) + (5) |
| F-08 | Acceso y portabilidad incompletos                                    | HIGH     | PROVEN                | (1) + (5) |
| F-09 | Plazos de conservación no definidos; sin TTL en el entrenador IA     | HIGH     | PROVEN                | (1) + (3) |
| F-10 | Umbral de edad en 13 años frente a los 14 de la LOPDGDD              | HIGH     | PROVEN                | (1) + (5) |
| F-11 | Almacenamiento en terminal sin información; banner inexistente       | MEDIUM   | PROVEN / NV_RUNTIME   | (3) + (5) |
| F-12 | Sin enlaces a privacidad ni términos dentro de la app                | MEDIUM   | PROVEN                | (1) + (3) |
| F-13 | Información del art. 10 LSSI incompleta                              | MEDIUM   | PROVEN                | (3)       |
| F-14 | Cláusulas de modificación unilateral y responsabilidad               | MEDIUM   | PROVEN (texto)        | (5)       |
| F-15 | Token push persiste tras cerrar sesión                               | MEDIUM   | PROVEN                | (1) + (3) |
| F-16 | Caché local persiste tras cerrar sesión                              | MEDIUM   | PROVEN                | (1) + (3) |
| F-17 | iOS sin cadenas de uso de HealthKit                                  | LOW      | PROVEN                | (1) + (5) |
| F-18 | Reglamento de IA: transparencia y marcado                            | MEDIUM   | PROVEN                | (3)       |

**Panel de evidencia:** 16 PROVEN (89 %), 2 UNVERIFIABLE (11 %: F-05 en su parte de región contractual y F-11 en su parte de ejecución). Total 18.

---

## F-01 — La política de privacidad no describe los tratamientos reales

- **Gravedad:** CRITICAL
- **Confianza:** PROVEN
- **Estado:** (1) probado en código + (4) incumplimiento confirmado del deber de información
- **Norma:** RGPD arts. 12.1, 13.1.c (destinatarios), 13.1.f (transferencias), 13.2.a (plazos), 13.2.f (derechos); LOPDGDD art. 12
- **Afectados:** todos los usuarios
- **Exposición:** art. 83.5 RGPD — hasta 20 M € o 4 % del volumen de negocios global

**Evidencia**

- La política se declara actualizada en **mayo de 2026** (`public/privacy-policy.html:16`) y enumera únicamente entrenamientos, cuenta y datos técnicos (`:19-53`).
- El entrenador IA (migración de **julio de 2026**) no aparece: `supabase/migrations/20260728100045_ai_coach.sql:33-127`; envío al proveedor en `supabase/functions/ai-coach/context.ts:109-140,183-249`.
- Analítica Vercel y Cloudflare: `src/main.tsx:45-58`.
- Sentry: `src/main.tsx:60-79`; captura en `src/shared/components/ErrorBoundary.tsx:36-40`.
- Google Fonts con petición a terceros: `index.html:17-20`; `public/landing.html:39-41`; `public/tutorial.html:26-28`.
- Google OAuth, además de correo/contraseña: `src/features/auth/stores/authStore.ts:80-113`.
- Push FCM: `src/shared/lib/push.ts:20-30`; tabla `push_tokens` en `20260101000000_remote_schema.sql:176-205`.
- Perfil con `full_name`, `username`, `avatar_url`, `bio`, `height_cm`, `birth_year`, `sex`, `weight_kg`: `20260101000000_remote_schema.sql:21-40`. Solo se mencionan de pasada.
- La política no identifica encargados, países de destino, base jurídica por finalidad, plazos ni categorías del art. 9.

**Por qué es CRITICAL**

El deber de información es la base para que el consentimiento sea válido (art. 4.11) y para el ejercicio de derechos. Una política que omite tratamientos esenciales no es una versión incompleta: describe un producto distinto del que se ejecuta.

**Qué lo cerraría**

Reescribir la política por finalidad y por destinatario, con base jurídica, categorías, plazos, transferencias y derechos. Requiere abogado y decisión previa sobre base jurídica y contratos (ver `ACTION_PLAN.md`, A-01).

---

## F-02 — Datos de salud sin condición del art. 9.2 ni base jurídica declarada

- **Gravedad:** CRITICAL
- **Confianza:** PROVEN
- **Estado:** (1) probado en código + (5) calificación jurídica pendiente
- **Norma:** RGPD arts. 6.1, 9.1, 9.2.a, 13.1.c; considerando 35; LOPDGDD art. 9
- **Afectados:** todos los usuarios que registren medidas o conecten un wearable
- **Exposición:** art. 83.5 RGPD — hasta 20 M € o 4 %

**Evidencia**

- `body_measurements` guarda `weight_kg`, `body_fat_pct`, `muscle_mass_kg` (`20260101000000_remote_schema.sql:117-128`).
- `wearable_daily` guarda pasos, distancia, calorías, pulso de reposo, medio y máximo (`20260622194522_wearables.sql:35-49`).
- `wearable_sleep` guarda duración, fases y eficiencia (`:52-66`).
- `health_sessions` importa sesiones del agregador de salud (`20260727224345_health_sessions.sql`).
- Android solicita lectura de pulso, pulso en reposo, sueño y ejercicio, incluido acceso en segundo plano (`android/app/src/main/AndroidManifest.xml:436-447`).

**Análisis**

Peso, grasa corporal, frecuencia cardiaca y sueño son datos relativos a la salud (art. 4.15 y considerando 35 RGPD). El art. 9.1 prohíbe su tratamiento salvo que concurra una condición del art. 9.2. La ejecución de contrato (art. 6.1.b) **no** levanta esa prohibición. Las opciones realistas son el consentimiento explícito (art. 9.2.a) o una base de medicina preventiva (art. 9.2.h), que aquí no encaja con claridad.

El permiso del sistema operativo (Health Connect / HealthKit) **no equivale** al consentimiento del RGPD: es un control de acceso del dispositivo, no una manifestación informada y específica frente al responsable.

**Qué lo cerraría**

Decidir y documentar la condición del art. 9.2 para cada tratamiento de salud; si es consentimiento explícito, implementarlo separado del alta, granular y revocable, con texto propio. Revisión jurídica obligatoria.

---

## F-03 — Borrado de cuenta prometido y no implementado

- **Gravedad:** CRITICAL
- **Confianza:** PROVEN
- **Estado:** (4) incumplimiento confirmado de la promesa contractual y del mecanismo de supresión
- **Norma:** RGPD arts. 5.1.e, 12.3, 12.4, 17.1.a-b; TRLGDCU art. 20; Ley 3/1991 (competencia desleal), arts. 5 y 7
- **Afectados:** todos los usuarios
- **Exposición:** art. 83.5 RGPD; sanciones de consumo (arts. 49 y ss. TRLGDCU)

**Evidencia**

- Los términos afirman: «Puedes eliminar tu cuenta y todos los datos asociados en cualquier momento, desde la app o escribiendo a [correo]» (`public/terms.html:28`).
- En ajustes solo hay cierre de sesión (`src/features/auth/pages/SettingsPage.tsx:772-785`).
- No existe `delete_account`, `deleteUser`, `admin.deleteUser` ni `DELETE FROM auth.users` en `src/` ni en `supabase/migrations/`. La única supresión de un usuario de auth está en un seed de pruebas (`scripts/seed-e2e-user.sql:175`).
- El borrado en cascada existe a nivel de esquema (`REFERENCES auth.users (id) ON DELETE CASCADE`), pero **nada lo dispara desde el producto**.

**Por qué es CRITICAL**

La vía por correo existe, así que el derecho del art. 17 no es inalcanzable. El problema es la **promesa contractual falsa** sobre un canal que no existe y la ausencia de un mecanismo de autoservicio: el usuario que quiere borrar su cuenta en la app no puede, y la app le dice que sí. La rúbrica legal considera CRITICAL la ausencia de endpoint de autoservicio de borrado.

**Qué lo cerraría**

Implementar supresión real (Edge Function con `service_role` que borre el usuario de auth y verifique el arrastre en cascada), o corregir los términos y ofrecer un procedimiento explícito con plazo de un mes. La primera opción es la coherente con la promesa publicada.

---

## F-04 — Proveedor de IA sin DPA declarado y sin base de transferencia

- **Gravedad:** CRITICAL
- **Confianza:** PROVEN (documental) — el propio repositorio lo afirma
- **Estado:** (2) documentado, no confirmado contra el proveedor + (5) revisión jurídica
- **Norma:** RGPD arts. 28.3, 28.4, 44, 46.1, 49.1.a, 13.1.f
- **Afectados:** usuarios que activan el entrenador
- **Exposición:** art. 83.5 (transferencias) y art. 83.4 (encargado) — hasta 20 M € o 4 %

**Evidencia**

- `supabase/functions/ai-coach/README.md:105-106`: «un proveedor gratuito no trae acuerdo de tratamiento de datos».
- Proveedor primario Groq y alternativo NVIDIA (`supabase/functions/ai-coach/index.ts:213-224`), ambos con sede en EE. UU.
- Datos enviados: objetivo, días por semana, material, peso redondeado, franja de edad, sexo, agregados de entrenamiento, media de sueño y pulso en reposo (`context.ts:109-140,183-249`).
- El consentimiento del usuario existe y está versionado (`src/features/coach/api/coach.ts:48-87`), pero el consentimiento **no es un mecanismo de transferencia** para un flujo sistemático.

**Análisis**

El art. 28 exige un contrato de encargo con garantías suficientes. El art. 44 exige que toda transferencia internacional se base en decisión de adecuación (art. 45), garantías (art. 46) o excepción (art. 49). La excepción del art. 49.1.a es para transferencias **ocasionales** y no puede sostener un tratamiento continuado. Un proveedor gratuito sin DPA deja al responsable sin base documentada.

**Qué lo cerraría**

Contratar un proveedor con DPA y SCC (o uno con decisión de adecuación), documentar la evaluación de impacto de la transferencia (TIA) y reflejarlo en la política. Mientras no exista, valorar desactivar el entrenador o limitarlo a un proveedor con garantías.

---

## F-05 — Transferencias internacionales no identificadas ni informadas

- **Gravedad:** HIGH
- **Confianza:** PROVEN en la ausencia de información; NV_DASHBOARD en la región contratada
- **Estado:** (3) obligación potencial, pendiente de inventario
- **Norma:** RGPD arts. 13.1.f, 44, 45, 46
- **Afectados:** todos los usuarios
- **Exposición:** art. 83.5 — hasta 20 M € o 4 %

**Evidencia**

- No existe `supabase/config.toml`; la región del proyecto no se puede deducir del repositorio.
- Terceros con posible acceso o recepción: Supabase, Vercel, Cloudflare, Sentry (ingest EU en CSP: `vercel.json:31-32`), Google (OAuth y Fonts), Groq/NVIDIA y FCM/APNs.
- La política no menciona ninguno (`public/privacy-policy.html:19-53`).

**Por qué HIGH y no CRITICAL**

La existencia de transferencia está probada para Groq/NVIDIA y Google; para el resto depende de la región y del contrato. No se puede afirmar «transferencia ilícita» sin ese inventario, pero la ausencia de información sí está probada.

**Qué lo cerraría**

Inventario de proveedores con región, rol (responsable/encargado), DPA, mecanismo de transferencia y fecha. Publicarlo en la política. Acción externa: panel de Supabase y contratos.

---

## F-06 — Registro de actividades de tratamiento no consta

- **Gravedad:** HIGH
- **Confianza:** PROVEN (ausencia en el repositorio)
- **Estado:** (1) + (3) obligación potencial (puede existir fuera del repo)
- **Norma:** RGPD art. 30.1; art. 30.5 (exención); AEPD, guía del RAT
- **Afectados:** todos
- **Exposición:** art. 83.4 — hasta 10 M € o 2 %

**Evidencia**

- Antes de esta auditoría no existía RAT en `docs/` ni en ningún otro directorio del proyecto.
- El único documento existente ahora es la **propuesta** `docs/audits/legal-audit-2026-10-26/DATA_PROCESSING_REGISTER.md`, elaborada en esta revisión y **no validada ni firmada** por el responsable.
- La exención del art. 30.5 exige que el tratamiento no sea habitual, no implique riesgo y no incluya categorías especiales. Aquí hay datos de salud y tratamiento continuado: **la exención no aplica**.

**Qué lo cerraría**

Adoptar el RAT propuesto en `DATA_PROCESSING_REGISTER.md`, validarlo con el responsable y mantenerlo actualizado con fecha y versión.

---

## F-07 — Evaluación de impacto no consta

- **Gravedad:** HIGH
- **Confianza:** PROVEN (ausencia)
- **Estado:** (3) obligación potencial + (5) calificación
- **Norma:** RGPD art. 35.1, 35.3.b-c, 35.4, 35.7, 36; AEPD, listas de EIPD
- **Afectados:** todos
- **Exposición:** art. 83.4 — hasta 10 M € o 2 %

**Evidencia**

- No hay EIPD en el repositorio.
- Concurren indicios: datos del art. 9, seguimiento sistemático de hábitos y salud, uso de tecnología nueva (wearables + IA) y evaluación de aspectos personales.
- La lista de la AEPD incluye tratamientos con datos de salud a gran escala y evaluaciones/profiling; la concurrencia exacta depende de volumen y contexto.

**Por qué no se afirma «EIPD obligatoria»**

El art. 35.1 exige «alto riesgo» y el 35.3 menciona «gran escala» para varias categorías. El repositorio no revela número de usuarios ni alcance. La conclusión honesta es: **probable, pendiente de confirmar escala**.

**Qué lo cerraría**

Decisión documentada sobre la necesidad; si procede, EIPD con la metodología de la AEPD y consulta previa si el riesgo residual es alto.

---

## F-08 — Acceso y portabilidad incompletos

- **Gravedad:** HIGH
- **Confianza:** PROVEN
- **Estado:** (1) probado + (5) depende de cómo se atiendan las solicitudes
- **Norma:** RGPD arts. 15.1, 15.3, 20.1, 12.3
- **Afectados:** todos
- **Exposición:** art. 83.5 — hasta 20 M € o 4 %

**Evidencia**

- La exportación JSON incluye solo entrenamientos y cardio (`src/features/stats/utils/exportImport.ts:231-259`), invocada en `src/features/stats/hooks/useHistoryTransfer.ts:303-314`.
- La exportación XLSX añade rutinas (`src/features/stats/utils/excelExport.ts:138-142`; construcción en `useHistoryTransfer.ts:254-265`).
- Quedan fuera: medidas corporales, wearables, conversaciones y memoria del entrenador, perfil, tokens push, historial de consentimientos.
- No hay endpoint ni flujo de acceso completo; el ejercicio de derechos se remite a correo.

**Matiz**

El derecho de acceso puede satisfacerse manualmente por correo. Lo que el código prueba es que **la herramienta de autoservicio no cubre el conjunto de datos**; si el correo tampoco lo cubre, habrá incumplimiento. La brecha de portabilidad es más clara: el art. 20 alcanza los datos facilitados por el usuario y los observados, en formato estructurado.

**Qué lo cerraría**

Ampliar la exportación a todas las tablas con datos del usuario y documentar el procedimiento de correo con plazo y verificación de identidad.

---

## F-09 — Plazos de conservación no definidos; sin TTL en el entrenador IA

- **Gravedad:** HIGH
- **Confianza:** PROVEN
- **Estado:** (1) + (3)
- **Norma:** RGPD arts. 5.1.e, 13.2.a, 17.1.a
- **Afectados:** usuarios del entrenador y, en general, todos
- **Exposición:** art. 83.5 — hasta 20 M € o 4 %

**Evidencia**

- `ai_coach_purge()` borra memoria, mensajes y sugerencias, desactiva el entrenador y conserva `ai_coach_usage` y `ai_coach_audit` (`supabase/migrations/20260728100045_ai_coach.sql:157-187`).
- La purga se ejecuta **al revocar**, no por antigüedad: no hay TTL, cron ni índice de caducidad para conversaciones.
- `ai_coach_usage` y `ai_coach_audit` no tienen plazo declarado.
- La política no publica plazos para ninguna categoría.

**Qué lo cerraría**

Tabla de conservación por categoría (con justificación), TTL para conversaciones y memoria, política de limpieza de auditoría y mención expresa en la política.

---

## F-10 — Umbral de edad en 13 años frente a los 14 de la LOPDGDD

- **Gravedad:** HIGH
- **Confianza:** PROVEN
- **Estado:** (1) + (5)
- **Norma:** RGPD art. 8.1; LOPDGDD art. 7; RGPD arts. 6, 9, 13
- **Afectados:** menores de 13–14 años
- **Exposición:** art. 83.5 — hasta 20 M € o 4 %

**Evidencia**

- La política fija el umbral en 13 años (`public/privacy-policy.html`, sección de menores).
- La LOPDGDD art. 7 permite el consentimiento del menor a partir de **14 años**; por debajo se exige titularidad parental o tutelar.
- No hay verificación de edad en el alta (`src/features/auth/pages/AuthPage.tsx`; `authStore.ts:80-113`).

**Análisis**

Un menor de 13–14 años podría registrarse y consentir tratamientos de salud sin intervención parental. El consentimiento sería inválido y el tratamiento ilícito. Además, el tratamiento de datos de salud de menores agrava el riesgo y refuerza la necesidad de EIPD.

**Qué lo cerraría**

Alinear el umbral a 14, declarar el procedimiento parental y decidir si se bloquea el registro por debajo de la edad o se exige confirmación. Revisión jurídica del mecanismo.

---

## F-11 — Almacenamiento en terminal sin información; banner inexistente

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN en la ausencia de información; NV_RUNTIME en el inventario real
- **Estado:** (3) obligación potencial + (5)
- **Norma:** LSSI art. 22.2; RGPD arts. 13, 5.1.a; AEPD, guía de cookies (mayo 2024)
- **Afectados:** usuarios web
- **Exposición:** art. 39 LSSI (sanciones administrativas graduadas)

**Evidencia**

- No hay banner ni centro de preferencias: búsqueda de `cookie`, `consent` y similares en `src/` y `public/` sin resultados de consentimiento.
- Analítica: Vercel (`src/main.tsx:47`) y Cloudflare (`:49-57`), ambas sin cookies según su integración.
- Service worker con `NetworkFirst` sobre la API de Supabase, 60 s (`vite.config.ts:99-107`).
- Persistencia de TanStack Query en IndexedDB durante 24 h (`src/app/providers.tsx:59`; `src/app/queryPersister.ts:8-36`).

**Matiz importante**

Vercel y Cloudflare son cookieless: por sí solos **no** exigen consentimiento del art. 22.2. La conclusión no es «falta banner = incumplimiento». Lo que sí falta es **información** sobre el almacenamiento propio (service worker e IndexedDB) y una base para el acceso a datos ya almacenados. La verificación real requiere navegador (`NV_RUNTIME`).

**Qué lo cerraría**

Inventario de almacenamiento en producción; aviso informativo (no necesariamente banner) para el almacenamiento técnico y, si se añade analítica con cookies o publicidad, consentimiento previo con rechazo equivalente.

---

## F-12 — Sin enlaces a privacidad ni términos dentro de la app

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN
- **Estado:** (1) + (3)
- **Norma:** RGPD art. 12.1 y 13; LSSI art. 10.1; TRLGDCU art. 97
- **Afectados:** todos
- **Exposición:** art. 83.5 RGPD; art. 39 LSSI

**Evidencia**

- No hay ninguna referencia a `privacy-policy` ni `terms.html` en `src/` (búsqueda exhaustiva en `.ts`/`.tsx`).
- Las páginas públicas solo se enlazan entre sí (`public/privacy-policy.html:55`; `public/terms.html:58`).
- Los términos están fechados en julio de 2026; la política en mayo de 2026.

**Qué lo cerraría**

Enlace permanente y accesible en ajustes y en el alta, con versión y fecha. No requiere abogado para el enlace, sí para el contenido.

---

## F-13 — Información del art. 10 LSSI incompleta

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN (texto) — aplicabilidad discutible
- **Estado:** (3) obligación potencial
- **Norma:** LSSI art. 10.1.a, 10.1.b, 10.1.e
- **Afectados:** usuarios del servicio
- **Exposición:** art. 39 LSSI

**Evidencia**

- La política identifica a Francisco Vidal Mateo y un correo, pero **no** un domicilio postal ni NIF (`public/privacy-policy.html:17`).
- No hay aviso legal separado.
- No consta inscripción registral (probablemente innecesaria para un particular).

**Matiz**

El art. 10 se dirige a «prestadores de servicios de la sociedad de la información». Un servicio gratuito y no lucrativo puede quedar fuera del ámbito si no constituye actividad económica. **No se afirma incumplimiento**: se registra como obligación potencial que depende del modelo de explotación.

**Qué lo cerraría**

Decisión de negocio sobre el carácter del servicio; si es prestador, completar nombre, domicilio, correo y NIF en un aviso legal accesible.

---

## F-14 — Cláusulas de modificación unilateral y responsabilidad

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN (texto); calificación jurídica pendiente
- **Estado:** (5) requiere revisión profesional
- **Norma:** TRLGDCU arts. 82, 85.3, 86.2, 87, 89; Directiva 93/13/CEE
- **Afectados:** consumidores
- **Exposición:** nulidad de la cláusula (art. 83 TRLGDCU) y sanciones de consumo

**Evidencia**

- `public/terms.html`: facultad de modificar las condiciones unilateralmente y limitación de responsabilidad, sin especificar motivos válidos ni mecanismo de aceptación.
- El art. 85.3 TRLGDCU considera abusivas las cláusulas que reservan al empresario facultades de modificación unilateral sin motivos válidos especificados.
- El art. 86.2 limita la responsabilidad del empresario por daños en servicios que no impliquen obligación de resultado cuando no se prueba negligencia; su redacción concreta debe examinarse.

**Qué lo cerraría**

Revisión por abogado de consumo; introducir motivos tasados, preaviso y derecho de salida, y ajustar la responsabilidad a la normativa imperativa.

---

## F-15 — Token push persiste tras cerrar sesión

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN
- **Estado:** (1) + (3)
- **Norma:** RGPD arts. 5.1.f, 32.1; considerando 39
- **Afectados:** usuarios en dispositivos compartidos
- **Exposición:** art. 83.4 — hasta 10 M € o 2 %

**Evidencia**

- `unregisterPushToken()` existe (`src/shared/lib/push.ts:84-96`), pero solo se invoca al desactivar notificaciones (`src/features/auth/pages/SettingsPage.tsx:244`).
- No hay tarea de cierre de sesión que borre el token; el registro de tareas (`src/app/sessionTasks.ts`) no incluye push.
- La tabla `push_tokens` vincula token y `user_id` (`20260101000000_remote_schema.sql:176-205`).

**Riesgo**

Tras cerrar sesión, el dispositivo sigue asociado al usuario anterior. Si otra persona inicia sesión en el mismo dispositivo, o si el token se reutiliza, pueden llegar notificaciones con datos del usuario anterior.

**Qué lo cerraría**

Borrar el token en la fase `pre-signout` y desregistrar el dispositivo del proveedor; probar el flujo con dos cuentas.

---

## F-16 — Caché local persiste tras cerrar sesión

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN
- **Estado:** (1) + (3)
- **Norma:** RGPD arts. 5.1.f, 32.1
- **Afectados:** usuarios en dispositivos compartidos
- **Exposición:** art. 83.4 — hasta 10 M € o 2 %

**Evidencia**

- `queryClient.clear()` vacía la memoria (`src/features/auth/stores/authStore.ts:136`).
- La persistencia en IndexedDB tiene `maxAge` de 24 h (`src/app/providers.tsx:59`).
- `removeClient` está definido pero **nunca se llama** (`src/app/queryPersister.ts:34`).
- La limpieza de cachés del service worker solo ocurre en nativo (`src/main.tsx:24-38`); en web no se borran.
- Las claves de consulta incluyen `userId`, lo que reduce el riesgo de mezcla, pero no elimina los datos del dispositivo.

**Qué lo cerraría**

Llamar a `removeClient` y borrar las cachés del SW en el cierre de sesión web; verificar con dos cuentas.

---

## F-17 — iOS sin cadenas de uso de HealthKit

- **Gravedad:** LOW
- **Confianza:** PROVEN
- **Estado:** (1) + (5)
- **Norma:** RGPD arts. 13, 5.1.a; requisitos de App Store (no es una norma jurídica, pero afecta a la publicación)
- **Afectados:** usuarios iOS
- **Exposición:** rechazo de la app o información incompleta; no sanción directa identificada

**Evidencia**

- `ios/App/App/Info.plist` no contiene `NSHealthShareUsageDescription` ni `NSHealthUpdateUsageDescription`.
- El puente de salud y los permisos de Android existen (`src/shared/lib/healthBridge.ts`; `AndroidManifest.xml:436-447`).
- `README.md:326-327` anuncia HealthKit.

**Qué lo cerraría**

Añadir las cadenas si se lee salud en iOS, o retirar la funcionalidad del binario iOS y corregir el README.

---

## F-18 — Reglamento de IA: transparencia y marcado

- **Gravedad:** MEDIUM
- **Confianza:** PROVEN (funcionalidad y textos); aplicación jurídica pendiente
- **Estado:** (3) obligación potencial
- **Norma:** Reglamento (UE) 2024/1689 arts. 50.1, 50.2, 113; Reglamento (UE) 2026/1744 (prórroga del 50.2)
- **Afectados:** usuarios del entrenador
- **Exposición:** art. 99 del Reglamento de IA (multas por incumplimiento de obligaciones de transparencia)

**Evidencia**

- El sistema se presenta como «Entrenador IA» y con el aviso «Análisis de tus datos con IA» (`src/shared/lib/i18n/resources.ts:118-119,161-183`).
- El art. 50.1 exige informar de que se interactúa con un sistema de IA; parece cumplido.
- El art. 50.2 exige marcado legible por máquina de las salidas generadas por IA. El Reglamento 2026/1744 introduce una prórroga: los sistemas introducidos antes del 2 de agosto de 2026 tienen hasta el **2 de diciembre de 2026**.
- El sistema no parece de alto riesgo (no evalúa acceso a empleo, crédito, educación, etc.). La calificación final requiere revisión.

**Qué lo cerraría**

Confirmar la fecha de puesta en servicio del entrenador; si es anterior al 2/08/2026, implementar marcado antes del 2/12/2026. Documentar la calificación de riesgo.

---

## Hallazgos descartados o degradados (para evitar falsos positivos)

| Afirmación                                    | Por qué no se sostiene                                                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «Falta banner de cookies, luego incumple»     | Vercel y Cloudflare son cookieless; el art. 22.2 LSSI no se activa solo por analítica sin cookies. Falta información, no necesariamente consentimiento.                                                             |
| «Sentry envía datos personales»               | `sendDefaultPii: false` y captura limitada a excepción + `componentStack` (`src/main.tsx:60-79`; `ErrorBoundary.tsx:36-40`). El riesgo es de información y contrato, no de configuración.                           |
| «El entrenador IA envía el email y el nombre» | El contexto excluye identificadores directos y usa franja de edad (`context.ts:109-140`; `README.md:99-104`).                                                                                                       |
| «No hay RLS»                                  | Las 26 tablas declaradas en migraciones tienen RLS habilitada (`20260101000000_remote_schema.sql:689-700`; `20260622194522_wearables.sql:95-97`; `20260728100045_ai_coach.sql:123-127`; y migraciones posteriores). |
| «El export XLSX incluye todo»                 | Incluye entrenamientos, cardio y rutinas; no medidas, wearables, perfil ni entrenador.                                                                                                                              |
| «Supabase está en EE. UU.»                    | La región no consta en el repositorio. Es `NV_DASHBOARD`, no un hecho probado.                                                                                                                                      |

---

## Limitaciones

- No se ha ejecutado la app ni se ha inspeccionado el navegador en producción.
- No se han abierto paneles de Supabase, Vercel, Cloudflare, Sentry, Google Play ni App Store.
- No se han revisado contratos, DPAs, RAT ni EIPD fuera del repositorio.
- La calificación jurídica de los hechos probados requiere abogado. Este documento no la sustituye.
