# GymLog — Propuesta de Registro de Actividades de Tratamiento (RAT)

- **Base normativa:** RGPD art. 30.1; modelo y FAQ de la AEPD
  - https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/actividades-tratamiento
  - https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/FAQ-0250-como-elaborar-el-rat
- **Consulta:** 26/10/2026
- **Estado:** **propuesta técnica** elaborada a partir del código. No es el RAT oficial hasta que el responsable lo valide, complete los campos `[PENDIENTE]` y lo firme con fecha y versión.

## Nota sobre la exención del art. 30.5

El art. 30.5 RGPD exime a organizaciones de menos de 250 empleados solo si el tratamiento **no es habitual**, **no entraña riesgo** y **no incluye categorías especiales**. GymLog trata datos de salud de forma continuada, así que **la exención no es aplicable**. El registro es obligatorio con independencia del tamaño.

## Datos del responsable

| Campo                           | Valor                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsable                     | Francisco Vidal Mateo                                                                                                                                                  |
| NIF                             | `[PENDIENTE — verificación externa]`                                                                                                                                   |
| Domicilio                       | `[PENDIENTE — verificación externa]`                                                                                                                                   |
| Correo de privacidad            | `[PENDIENTE — verificación externa]`                                                                                                                                   |
| Delegado de Protección de Datos | No consta. La designación no parece obligatoria por el momento (no hay gran escala de categorías especiales ni autoridad pública), pero debe decidirse y documentarse. |
| Encargado principal             | Supabase (autenticación y base de datos). DPA y región: `[PENDIENTE — panel de Supabase]`                                                                              |
| Autoridad de control            | AEPD (España)                                                                                                                                                          |

---

## RAT-01 — Cuenta y autenticación

| Campo                        | Contenido                                                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidad**                | Crear y autenticar la cuenta; mantener la sesión; prevenir abuso                                                                                           |
| **Base jurídica (art. 6.1)** | Ejecución de contrato (art. 6.1.b)                                                                                                                         |
| **Condición art. 9**         | No aplica por sí sola (el perfil asociado sí puede contener salud)                                                                                         |
| **Interesados**              | Usuarios registrados                                                                                                                                       |
| **Datos**                    | Correo electrónico; contraseña (hash gestionado por Supabase Auth); identificador de usuario; proveedor OAuth (Google); metadatos de sesión; fecha de alta |
| **Origen**                   | El propio interesado; Google si usa OAuth                                                                                                                  |
| **Destinatarios**            | Supabase (encargado); Google (responsable independiente del flujo OAuth)                                                                                   |
| **Transferencias**           | `[PENDIENTE — región de Supabase]`; Google: EE. UU. con mecanismo `[PENDIENTE — verificar marco vigente]`                                                  |
| **Conservación**             | Mientras la cuenta exista. Tras supresión: `[PENDIENTE — definir plazo de logs]`                                                                           |
| **Medidas**                  | TLS; sesión en localStorage (`gymlog-auth`, `src/shared/lib/supabase.ts:11-17`); RLS en `profiles`; política de contraseñas de Supabase                    |
| **Evidencia**                | `src/features/auth/stores/authStore.ts:80-113`; `src/shared/lib/supabase.ts:11-17`; `20260101000000_remote_schema.sql:21-40`                               |
| **Observaciones**            | No hay verificación de edad ni supresión de cuenta (F-03, F-10)                                                                                            |

## RAT-02 — Perfil de usuario

| Campo                | Contenido                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidad**        | Personalizar la experiencia; mostrar identidad en la app; adaptar recomendaciones                                                                                                                 |
| **Base jurídica**    | Ejecución de contrato (art. 6.1.b)                                                                                                                                                                |
| **Condición art. 9** | El peso y, en su caso, el sexo combinado con otros datos pueden revelar salud. `[PENDIENTE — decisión: separar peso del perfil o aplicar art. 9.2.a]`                                             |
| **Interesados**      | Usuarios registrados                                                                                                                                                                              |
| **Datos**            | `full_name`, `username`, `avatar_url`, `bio`, `height_cm`, `birth_year`, `sex`, `weight_kg`, `goal`, `days_per_week`, `equipment_available`, `weight_unit`, `notifications_enabled`, `ai_coach_*` |
| **Origen**           | El interesado; el avatar se sube a un bucket                                                                                                                                                      |
| **Destinatarios**    | Supabase (encargado); proveedor de IA si el entrenador está activo (solo agregados)                                                                                                               |
| **Transferencias**   | Igual que RAT-01 y RAT-07                                                                                                                                                                         |
| **Conservación**     | Mientras la cuenta exista                                                                                                                                                                         |
| **Medidas**          | RLS; bucket de avatares con políticas (`20260706215331_avatars_bucket.sql`)                                                                                                                       |
| **Evidencia**        | `20260101000000_remote_schema.sql:21-40`; `20260728100045_ai_coach.sql` (columnas de consentimiento)                                                                                              |
| **Observaciones**    | La política no describe estos campos (F-01)                                                                                                                                                       |

## RAT-03 — Entrenamientos, series, rutinas y récords

| Campo                | Contenido                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Finalidad**        | Registrar el entrenamiento; calcular estadísticas, progresión y récords; mostrar historial                                                                                                                                           |
| **Base jurídica**    | Ejecución de contrato (art. 6.1.b)                                                                                                                                                                                                   |
| **Condición art. 9** | Los datos de esfuerzo, lesiones anotadas o limitaciones pueden revelar salud. `[PENDIENTE — revisar notas libres]`                                                                                                                   |
| **Interesados**      | Usuarios registrados                                                                                                                                                                                                                 |
| **Datos**            | `workouts`, `workout_sets` (peso, reps, RIR/RPE, notas), `user_routines`, `routine_templates`, `personal_records`, `exercise_goals`, `exercise_notes`, `cardio_sessions`, `lift_analyses`, `exercise_progression`, `progression_log` |
| **Origen**           | El interesado; catálogo de ejercicios de ExerciseDB                                                                                                                                                                                  |
| **Destinatarios**    | Supabase (encargado); proveedor de IA si el entrenador está activo (agregados)                                                                                                                                                       |
| **Transferencias**   | Igual que RAT-01 y RAT-07                                                                                                                                                                                                            |
| **Conservación**     | Mientras la cuenta exista; no hay purga por antigüedad                                                                                                                                                                               |
| **Medidas**          | RLS en todas las tablas; claves foráneas con `ON DELETE CASCADE`                                                                                                                                                                     |
| **Evidencia**        | `20260101000000_remote_schema.sql:59-175`; `20260731130000_lift_analyses.sql:38`; `20260805130000_exercise_progression.sql:78-79`                                                                                                    |
| **Observaciones**    | La exportación cubre esta actividad (F-08)                                                                                                                                                                                           |

## RAT-04 — Medidas corporales (categoría especial)

| Campo                  | Contenido                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidad**          | Seguimiento de composición corporal y progreso                                                                                                        |
| **Base jurídica**      | Ejecución de contrato (art. 6.1.b)                                                                                                                    |
| **Condición art. 9.2** | **No documentada.** Opciones: consentimiento explícito (art. 9.2.a) o medicina preventiva (art. 9.2.h, discutible). `[PENDIENTE — decisión jurídica]` |
| **Interesados**        | Usuarios que registran medidas                                                                                                                        |
| **Datos**              | `weight_kg`, `body_fat_pct`, `muscle_mass_kg`, fecha, notas                                                                                           |
| **Origen**             | El interesado o báscula conectada                                                                                                                     |
| **Destinatarios**      | Supabase (encargado); proveedor de IA solo si el entrenador está activo y en forma agregada                                                           |
| **Transferencias**     | Igual que RAT-01                                                                                                                                      |
| **Conservación**       | Mientras la cuenta exista; sin plazo específico                                                                                                       |
| **Medidas**            | RLS (`20260101000000_remote_schema.sql:695`)                                                                                                          |
| **Evidencia**          | `20260101000000_remote_schema.sql:117-128`                                                                                                            |
| **Observaciones**      | **Riesgo principal del proyecto** (F-02): son datos del art. 9 sin condición declarada                                                                |

## RAT-05 — Cardio

| Campo                | Contenido                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Finalidad**        | Registrar sesiones de cardio y estadísticas asociadas                                                         |
| **Base jurídica**    | Ejecución de contrato (art. 6.1.b)                                                                            |
| **Condición art. 9** | Frecuencia cardiaca media/máxima y calorías pueden revelar salud. `[PENDIENTE — misma decisión que RAT-04]`   |
| **Interesados**      | Usuarios que registran cardio                                                                                 |
| **Datos**            | Tipo, duración, distancia, calorías, FC media/máxima, notas, fecha                                            |
| **Origen**           | El interesado; wearable                                                                                       |
| **Destinatarios**    | Supabase (encargado)                                                                                          |
| **Transferencias**   | Igual que RAT-01                                                                                              |
| **Conservación**     | Mientras la cuenta exista                                                                                     |
| **Medidas**          | RLS (`20260101000000_remote_schema.sql:698`)                                                                  |
| **Evidencia**        | `20260101000000_remote_schema.sql:152-164`; exportación en `src/features/stats/utils/exportImport.ts:231-259` |
| **Observaciones**    | La política no menciona FC ni calorías                                                                        |

## RAT-06 — Wearables y datos de salud

| Campo                  | Contenido                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidad**          | Importar pasos, actividad, pulso y sueño para estadísticas y recomendaciones                                                                                                                                |
| **Base jurídica**      | Ejecución de contrato (art. 6.1.b)                                                                                                                                                                          |
| **Condición art. 9.2** | **No documentada.** El permiso del sistema operativo no equivale a consentimiento RGPD. `[PENDIENTE — consentimiento explícito específico]`                                                                 |
| **Interesados**        | Usuarios que conectan Health Connect o HealthKit                                                                                                                                                            |
| **Datos**              | `wearable_connections` (metadatos de conexión); `wearable_daily` (pasos, distancia, calorías, FC reposo/media/máx); `wearable_sleep` (duración, fases, eficiencia); `health_sessions` (sesiones importadas) |
| **Origen**             | Health Connect (Android), HealthKit (iOS)                                                                                                                                                                   |
| **Destinatarios**      | Supabase (encargado); proveedor de IA solo medias agregadas                                                                                                                                                 |
| **Transferencias**     | Igual que RAT-01                                                                                                                                                                                            |
| **Conservación**       | Mientras la cuenta exista; sin TTL                                                                                                                                                                          |
| **Medidas**            | RLS (`20260622194522_wearables.sql:95-97`; `20260727224345_health_sessions.sql:41`); permisos granulares en Android (`AndroidManifest.xml:436-447`)                                                         |
| **Evidencia**          | `20260622194522_wearables.sql:35-66`; `20260727224345_health_sessions.sql`; `src/shared/lib/healthBridge.ts`                                                                                                |
| **Observaciones**      | iOS no declara cadenas de HealthKit (F-17); falta información en la política (F-01)                                                                                                                         |

## RAT-07 — Entrenador IA

| Campo                  | Contenido                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Finalidad**          | Generar recomendaciones personalizadas de entrenamiento mediante un modelo de lenguaje                                                                                                                                                                       |
| **Base jurídica**      | Consentimiento del interesado (art. 6.1.a), limitado a esta finalidad; el consentimiento está versionado y es revocable (`coach.ts:48-87`)                                                                                                                   |
| **Condición art. 9.2** | Consentimiento explícito (art. 9.2.a) para los agregados de salud (sueño, pulso, peso). **Debe constar por separado del consentimiento general.**                                                                                                            |
| **Interesados**        | Usuarios que activan el entrenador                                                                                                                                                                                                                           |
| **Datos**              | Contexto: objetivo, días/semana, material, peso redondeado, franja de edad, sexo, agregados de entrenamiento, media de sueño, pulso en reposo. Persistidos: memoria (máx. 200 caracteres por hecho, 50 por usuario), mensajes, sugerencias, cuota, auditoría |
| **Origen**             | Datos del usuario y cálculos del servidor                                                                                                                                                                                                                    |
| **Destinatarios**      | Groq (principal) y NVIDIA (respaldo); Supabase Edge Functions (encargado)                                                                                                                                                                                    |
| **Transferencias**     | EE. UU. `[PENDIENTE — verificar DPA, SCC y TIA. El README afirma que el proveedor gratuito no trae DPA]`                                                                                                                                                     |
| **Conservación**       | Hasta revocación; **sin TTL**. La purga borra memoria, mensajes y sugerencias, pero conserva `ai_coach_usage` y `ai_coach_audit` (`20260728100045_ai_coach.sql:157-187`)                                                                                     |
| **Medidas**            | Seudonimización (sin `user_id` en el esquema del modelo); RLS; consentimiento versionado; purga; límite de cuota; filtro de salida                                                                                                                           |
| **Evidencia**          | `supabase/functions/ai-coach/context.ts:109-140,183-249`; `index.ts:213-224`; `README.md:99-106`; `20260728100045_ai_coach.sql:33-187`                                                                                                                       |
| **Observaciones**      | **Riesgo crítico** (F-04, F-09). El consentimiento no resuelve la transferencia sistemática                                                                                                                                                                  |

## RAT-08 — Notificaciones push

| Campo                | Contenido                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidad**        | Enviar recordatorios de entrenamiento y avisos del servicio                                                                       |
| **Base jurídica**    | Consentimiento (art. 6.1.a) para notificaciones; ejecución de contrato para avisos esenciales `[PENDIENTE — separar]`             |
| **Condición art. 9** | No aplica si el contenido no revela salud. **Riesgo:** el texto de la notificación puede revelar hábitos o datos de entrenamiento |
| **Interesados**      | Usuarios que activan notificaciones                                                                                               |
| **Datos**            | Token FCM/APNs, plataforma, `user_id`, fecha; preferencias horarias                                                               |
| **Origen**           | El dispositivo                                                                                                                    |
| **Destinatarios**    | FCM (Google) y APNs (Apple); Supabase Edge Function `send-push`                                                                   |
| **Transferencias**   | EE. UU. `[PENDIENTE — DPA y mecanismo]`                                                                                           |
| **Conservación**     | Mientras el token exista. **No se borra al cerrar sesión** (F-15)                                                                 |
| **Medidas**          | RLS; el token se registra solo si el usuario acepta; `send-push` usa `service_role`                                               |
| **Evidencia**        | `src/shared/lib/push.ts:20-30,84-96`; `20260101000000_remote_schema.sql:176-205`; `supabase/functions/send-push/index.ts`         |
| **Observaciones**    | El contenido de la notificación debe evitar datos de salud en la pantalla de bloqueo                                              |

## RAT-09 — Analítica web y seguimiento de errores

| Campo                | Contenido                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finalidad**        | Medir uso agregado; detectar y corregir errores                                                                                                                               |
| **Base jurídica**    | Interés legítimo (art. 6.1.f) `[PENDIENTE — ponderación documentada]`; para almacenamiento no técnico, consentimiento (LSSI art. 22.2)                                        |
| **Condición art. 9** | No aplica si no se envían datos de salud. **Riesgo:** las trazas pueden contener texto libre                                                                                  |
| **Interesados**      | Usuarios web y de app                                                                                                                                                         |
| **Datos**            | Vercel Analytics: eventos agregados sin cookies. Cloudflare: beacon sin cookies. Sentry: excepción, `componentStack`, metadatos técnicos; `sendDefaultPii: false`; sin replay |
| **Origen**           | Navegador/app                                                                                                                                                                 |
| **Destinatarios**    | Vercel, Cloudflare, Sentry (encargados)                                                                                                                                       |
| **Transferencias**   | Sentry con ingest EU en CSP (`vercel.json:31-32`); Vercel y Cloudflare `[PENDIENTE — región/DPA]`                                                                             |
| **Conservación**     | `[PENDIENTE — panel de cada proveedor]`                                                                                                                                       |
| **Medidas**          | Sin PII por defecto; sin replay; CSP restringe destinos                                                                                                                       |
| **Evidencia**        | `src/main.tsx:45-79`; `src/shared/components/ErrorBoundary.tsx:36-40`; `vercel.json:31-32`                                                                                    |
| **Observaciones**    | Falta información en la política (F-01) y valorar si el interés legítimo está documentado                                                                                     |

## RAT-10 — Fuentes y contenido de terceros

| Campo                | Contenido                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Finalidad**        | Mostrar tipografías y catálogo de ejercicios                                                                                                                       |
| **Base jurídica**    | Interés legítimo (art. 6.1.f) / ejecución de contrato `[PENDIENTE — ponderación]`                                                                                  |
| **Condición art. 9** | No aplica                                                                                                                                                          |
| **Interesados**      | Visitantes y usuarios                                                                                                                                              |
| **Datos**            | Dirección IP y metadatos HTTP al solicitar `fonts.googleapis.com`, `fonts.gstatic.com` y `oss.exercisedb.dev`                                                      |
| **Origen**           | El navegador                                                                                                                                                       |
| **Destinatarios**    | Google, ExerciseDB                                                                                                                                                 |
| **Transferencias**   | Google: EE. UU. `[PENDIENTE — mecanismo]`; ExerciseDB: `[PENDIENTE — verificar operador y región]`                                                                 |
| **Conservación**     | Logs del tercero; no controlado por GymLog                                                                                                                         |
| **Medidas**          | `preconnect`; CSP permite ambos dominios                                                                                                                           |
| **Evidencia**        | `index.html:17-20`; `public/landing.html:39-41`; `public/tutorial.html:26-28`; `vercel.json:31-32`                                                                 |
| **Observaciones**    | Alternativa: autoalojar fuentes para eliminar la transferencia de IP. La licencia del contenido de ExerciseDB es una cuestión aparte (ver `OSS_LICENSE_REVIEW.md`) |

## RAT-11 — Derechos, reclamaciones y comunicaciones

| Campo                | Contenido                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Finalidad**        | Atender derechos y consultas; dejar constancia de consentimientos                                              |
| **Base jurídica**    | Obligación legal (art. 6.1.c)                                                                                  |
| **Condición art. 9** | La información de la solicitud puede contener salud; acceso restringido                                        |
| **Interesados**      | Usuarios que ejercen derechos                                                                                  |
| **Datos**            | Correo, contenido de la solicitud, copia de la respuesta, verificación de identidad, eventos de consentimiento |
| **Origen**           | El interesado                                                                                                  |
| **Destinatarios**    | Proveedor de correo `[PENDIENTE — identificar]`                                                                |
| **Transferencias**   | `[PENDIENTE]`                                                                                                  |
| **Conservación**     | `[PENDIENTE — recomendado: 3 años para acreditar cumplimiento]`                                                |
| **Medidas**          | Acceso restringido; no hay flujo automatizado                                                                  |
| **Evidencia**        | `public/privacy-policy.html` (contacto); `src/features/coach/api/coach.ts:64-87` (evento de consentimiento)    |
| **Observaciones**    | No hay plazo publicado ni procedimiento (F-03, F-08)                                                           |

---

## Tratamientos que no constan (y no deben inventarse)

| Tratamiento                | Estado                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Facturación y pagos        | No existe: la app es gratuita y no hay pasarela en el código                                                                                   |
| Marketing y newsletter     | No consta                                                                                                                                      |
| Perfilado publicitario     | No consta                                                                                                                                      |
| Geolocalización            | No consta; el README lo niega para el entrenador                                                                                               |
| Biometría de autenticación | `USE_BIOMETRIC` está declarado en Android, pero el uso `[PENDIENTE — verificar si se usa realmente]`; si se usa, es dato biométrico del art. 9 |
| Menores                    | No hay tratamiento específico ni verificación de edad; ver F-10                                                                                |

## Campos que el responsable debe completar antes de aprobar el RAT

1. NIF, domicilio y correo de privacidad.
2. Región y plan de Supabase; DPAs de todos los proveedores.
3. Mecanismo de transferencia por proveedor y fecha de la TIA.
4. Plazos de conservación por categoría, con justificación.
5. Decisión sobre la condición del art. 9.2 para salud.
6. Decisión sobre el uso real de biometría.
7. Volumen de usuarios y si hay menores, para la EIPD.
8. Fecha, versión y firma del responsable.

> Este RAT es una propuesta técnica. No acredita cumplimiento por sí solo.
