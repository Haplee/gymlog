# GymLog — Revisión de la documentación legal

- **Documentos revisados:**
  - `public/privacy-policy.html` — «Política de Privacidad», última actualización **mayo de 2026**
  - `public/terms.html` — «Condiciones del Servicio», última actualización **julio de 2026**
- **Fecha de revisión:** 26/10/2026
- **Referencias:** RGPD (https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807), LOPDGDD (https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673), LSSI (https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758), TRLGDCU (https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555)
- **Consulta:** 26/10/2026

> Esta revisión comprueba **presencia y coherencia** de la información exigible. No sustituye la redacción jurídica ni valida la base jurídica elegida.

---

## 1. Resumen

| Documento                   | Estado                       | Problema principal                                                                                                                                                                                        |
| --------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Política de privacidad      | **Insuficiente**             | Describe un producto anterior al entrenador IA y omite destinatarios, transferencias, base jurídica y plazos. Contiene al menos una afirmación contradicha por el código (notificaciones «solo locales»). |
| Condiciones del Servicio    | **Deficiente**               | Ofrece un borrado «desde la app» que no existe; incluye modificación unilateral y una limitación de responsabilidad que puede ser abusiva.                                                                |
| Aviso legal / art. 10 LSSI  | **Incompleto o inexistente** | No hay página de aviso legal; faltan domicilio y NIF. Aplicabilidad discutible.                                                                                                                           |
| Enlaces desde la app        | **Ausente**                  | No hay ningún enlace a privacidad ni a términos en `src/`.                                                                                                                                                |
| Registro de consentimientos | **Parcial**                  | Solo el entrenador IA tiene consentimiento versionado; no hay consentimiento explícito de salud ni de cookies.                                                                                            |

---

## 2. Política de privacidad — contraste con el art. 13 RGPD

### 2.1. Checklist del art. 13.1 y 13.2

| Elemento exigido                                   | Artículo        | ¿Presente?  | Evidencia / observación                                                                                                                       |
| -------------------------------------------------- | --------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidad y datos de contacto del responsable      | 13.1.a          | **Parcial** | `:17` nombra a Francisco Vidal Mateo; `:52-53` da un correo. Falta domicilio o medio de contacto completo.                                    |
| Fines del tratamiento                              | 13.1.c          | **Parcial** | `:27-32` enumera tres fines genéricos; no aparecen entrenador IA, analítica, errores, push, wearables, cardio ni medidas corporales.          |
| Base jurídica de cada fin                          | 13.1.c          | **No**      | No se cita el art. 6 ni el art. 9. Sin base jurídica, el consentimiento no es informado (art. 4.11).                                          |
| Destinatarios o categorías                         | 13.1.e          | **No**      | `:38-41` solo menciona Supabase. Omite Vercel, Cloudflare, Sentry, Google (OAuth y Fonts), Groq/NVIDIA, FCM/APNs y ExerciseDB.                |
| Transferencias internacionales y garantías         | 13.1.f          | **No**      | No se menciona ningún país ni mecanismo.                                                                                                      |
| Plazo de conservación o criterios                  | 13.1.f / 13.2.a | **No**      | No hay plazo para ninguna categoría.                                                                                                          |
| Derechos y cómo ejercerlos                         | 13.2.b          | **Parcial** | `:43-44` menciona eliminación y exportación, pero no acceso, rectificación, oposición, limitación ni portabilidad; no hay plazo de respuesta. |
| Derecho a retirar el consentimiento                | 13.2.c          | **No**      | No se explica, pese a que el entrenador IA se basa en consentimiento.                                                                         |
| Derecho a reclamar ante la AEPD                    | 13.2.d          | **No**      | No se identifica la autoridad de control.                                                                                                     |
| Carácter obligatorio o facultativo de los datos    | 13.2.e          | **No**      | No se distingue qué datos son necesarios para el servicio.                                                                                    |
| Decisiones automatizadas y elaboración de perfiles | 13.2.f          | **No**      | El entrenador IA genera recomendaciones; no se describe el tratamiento ni su lógica.                                                          |
| Origen de los datos no obtenidos del interesado    | 14.2.f          | **No**      | Aplica a Google OAuth, Health Connect/HealthKit y datos de wearables.                                                                         |

### 2.2. Categorías de datos realmente tratadas que la política no describe

| Categoría                                                                             | Tabla / código                                                                | ¿En la política?                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| Medidas corporales (peso, grasa, masa muscular)                                       | `body_measurements` (`20260101000000_remote_schema.sql:117-128`)              | **No**                          |
| Cardio con FC media/máxima y calorías                                                 | `cardio_sessions` (`:152-164`)                                                | **No**                          |
| Pasos, distancia, calorías, pulso, sueño                                              | `wearable_daily`, `wearable_sleep` (`20260622194522_wearables.sql:35-66`)     | **No**                          |
| Sesiones importadas de salud                                                          | `health_sessions` (`20260727224345_health_sessions.sql`)                      | **No**                          |
| Perfil ampliado (nombre, usuario, avatar, bio, altura, año de nacimiento, sexo, peso) | `profiles` (`:21-40`)                                                         | **No** (solo «datos de cuenta») |
| Conversaciones y memoria del entrenador                                               | `ai_coach_*` (`20260728100045_ai_coach.sql`)                                  | **No**                          |
| Token push                                                                            | `push_tokens` (`:176-205`)                                                    | **No**                          |
| Eventos de analítica y errores                                                        | `src/main.tsx:45-79`                                                          | **No**                          |
| IP y metadatos por Google Fonts / ExerciseDB                                          | `index.html:17-20`; `public/landing.html:39-41`; `public/tutorial.html:26-28` | **No**                          |

### 2.3. Afirmaciones de la política contradichas por el código

| Afirmación                                                                       | Línea    | Realidad en código                                                                                                                                                                                                                         | Gravedad              |
| -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| «Notificaciones locales… No se envían datos fuera del dispositivo para este fin» | `:24`    | Existe push remoto FCM: el token se sube a `push_tokens` y `send-push` envía notificaciones (`src/shared/lib/push.ts:20-30`; `supabase/functions/send-push/index.ts`). La afirmación es falsa en cuanto al canal remoto.                   | **Alta**              |
| «Los datos se almacenan en Supabase»                                             | `:36`    | Además se envían a Sentry, Vercel, Cloudflare, Google, Groq/NVIDIA y FCM/APNs; y se cachean localmente en IndexedDB y service worker (`src/app/providers.tsx:59`; `vite.config.ts:99-107`).                                                | **Alta**              |
| «Terceros: Supabase»                                                             | `:38-41` | Lista incompleta; ver tabla anterior.                                                                                                                                                                                                      | **Alta**              |
| «Puedes exportar tus datos desde la app»                                         | `:44`    | La exportación cubre entrenamientos y cardio (+ rutinas en XLSX), no medidas, wearables, perfil ni entrenador (`exportImport.ts:231-259`; `useHistoryTransfer.ts:254-265,303-314`).                                                        | **Media**             |
| «Contraseña cifrada»                                                             | `:22`    | Supabase Auth almacena un hash, no un cifrado reversible. Es una imprecisión técnica, no un riesgo por sí sola.                                                                                                                            | **Baja**              |
| «Datos biométricos… nunca salen del dispositivo»                                 | `:23`    | El manifiesto declara `USE_BIOMETRIC`, pero no se ha verificado que la app use autenticación biométrica. Si no la usa, la política describe un tratamiento inexistente; si la usa, hay que confirmar que el dato no es accesible a la app. | **Media / pendiente** |
| «El uso continuado… implica la aceptación de la nueva política»                  | `:49-50` | La aceptación tácita no es una base válida para cambiar finalidades; un cambio de finalidad exige nueva base e información (arts. 6, 7, 13).                                                                                               | **Media**             |
| «No vendemos ni compartimos… con fines publicitarios»                            | `:33`    | Cierto en lo literal, pero puede inducir a error: sí se comparten datos con encargados para el servicio.                                                                                                                                   | **Baja**              |

### 2.4. Menores

- `:46-47`: «no está dirigida a menores de 13 años».
- LOPDGDD art. 7 fija el consentimiento válido en **14 años**. Entre 13 y 14 el consentimiento sería inválido.
- No hay verificación de edad en el alta (`src/features/auth/pages/AuthPage.tsx`; `authStore.ts:80-113`).
- **Riesgo:** registro de menores con datos de salud sin base válida. Ver F-10.

### 2.5. Derechos

- `:43-44` solo menciona eliminación y exportación, y remite a correo.
- Faltan: acceso, rectificación, supresión (detallada), limitación, oposición, portabilidad y retirada del consentimiento.
- No se indica el plazo de un mes (art. 12.3) ni la posibilidad de reclamar ante la AEPD.
- No hay formulario ni procedimiento; el correo es válido, pero la información es incompleta.
- **Contradicción:** los términos (`terms.html:28`) dicen que el borrado se puede hacer «desde la app»; la política (`:44`) solo por correo. Al menos uno de los dos miente.

---

## 3. Condiciones del Servicio

### 3.1. Checklist de información precontractual (TRLGDCU arts. 60, 97; LSSI art. 10)

| Elemento                             | ¿Presente?       | Evidencia                                                           |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------- |
| Identidad del prestador              | **Sí**           | `:19`                                                               |
| Domicilio y NIF                      | **No**           | Solo nombre y correo (`:56`)                                        |
| Características del servicio         | **Sí**           | `:22`                                                               |
| Precio                               | **Sí, gratuito** | `:22`                                                               |
| Duración y condiciones de resolución | **Parcial**      | `:43-44` permite discontinuar; no hay derecho de salida del usuario |
| Procedimiento de reclamaciones       | **No**           | No hay hoja de reclamaciones ni vía de consumo                      |
| Ley aplicable y jurisdicción         | **Parcial**      | `:55-56` ley española; sin fuero del consumidor                     |
| Enlace a privacidad                  | **Sí**           | `:38`                                                               |
| Idioma y accesibilidad               | **Parcial**      | Solo español; sin versión accesible                                 |

### 3.2. Cláusulas que requieren revisión

| Cláusula                                                                                       | Línea    | Problema                                                                                            | Norma                                                    |
| ---------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Borrado «desde la app»                                                                         | `:28`    | La función no existe (`SettingsPage.tsx:772-785`); el correo sí existe, pero la promesa es inexacta | TRLGDCU art. 20; Ley 3/1991 arts. 5 y 7; RGPD art. 5.1.a |
| «El uso continuado… implica su aceptación»                                                     | `:52-53` | Modificación unilateral sin motivos tasados, preaviso ni derecho de salida                          | TRLGDCU art. 85.3                                        |
| Modificar, suspender o discontinuar «en cualquier momento»                                     | `:43-44` | Facultad discrecional; solo se promete «intentar avisar»                                            | TRLGDCU arts. 85.3, 87.3                                 |
| «En la máxima medida permitida por la ley… no será responsable de daños… incluyendo… lesiones» | `:46-47` | La exclusión de responsabilidad por muerte o lesiones es abusiva                                    | TRLGDCU art. 86.2                                        |
| «Tal cual» y «según disponibilidad», sin garantías                                             | `:44`    | Frente a consumidores, no puede vaciar el contenido esencial del contrato                           | TRLGDCU arts. 82, 86.1                                   |
| Suspensión/cancelación de cuentas                                                              | `:49-50` | No hay procedimiento, plazo ni derecho de réplica                                                   | TRLGDCU art. 87; RGPD art. 17                            |
| Aviso de salud                                                                                 | `:34-35` | Redacción razonable; no sustituye la información de riesgos del servicio                            | —                                                        |

**Matiz:** si el servicio es gratuito y no hay ánimo de lucro, la aplicación del TRLGDCU como relación de consumo puede discutirse. La calificación corresponde a un abogado; la auditoría registra el texto y el riesgo.

### 3.3. Coherencia con la política

| Tema          | Términos                            | Política                  | Coherencia                |
| ------------- | ----------------------------------- | ------------------------- | ------------------------- |
| Borrado       | «desde la app o por correo» (`:28`) | Solo por correo (`:44`)   | **No**                    |
| Exportación   | «desde la app» (`:38`)              | «desde la app» (`:44`)    | Sí, pero ambas parciales  |
| Entrenador IA | No se menciona                      | No se menciona            | **Omisión compartida**    |
| Menores       | No se menciona                      | 13 años                   | **Omisión en términos**   |
| Cambios       | Aceptación tácita (`:53`)           | Aceptación tácita (`:50`) | Sí, pero ilícita en ambos |

---

## 4. LSSI — información del art. 10

| Requisito                      | ¿Presente?               | Evidencia                                    |
| ------------------------------ | ------------------------ | -------------------------------------------- |
| Nombre o denominación          | **Sí**                   | `privacy-policy.html:17`; `terms.html:19`    |
| Residencia o domicilio         | **No**                   | —                                            |
| Correo electrónico             | **Sí**                   | `privacy-policy.html:53`; `terms.html:56`    |
| Datos de inscripción registral | **No consta**            | Probablemente innecesario para un particular |
| Autorización administrativa    | **No aplica**            | —                                            |
| Profesión regulada             | **No aplica**            | —                                            |
| NIF                            | **No**                   | —                                            |
| Precios                        | **No aplica** (gratuito) | `terms.html:22`                              |
| Códigos de conducta            | **No aplica**            | —                                            |

**Conclusión:** si GymLog se considera prestador de servicios de la sociedad de la información, el art. 10.1.a y e está incompleto. La aplicabilidad depende de si existe actividad económica. Se clasifica como **obligación potencial** (F-13), no como incumplimiento confirmado.

---

## 5. Enlaces y accesibilidad de la información

- La política y los términos existen como páginas públicas y se enlazan entre sí (`privacy-policy.html:55`; `terms.html:58`).
- **No hay ningún enlace desde la aplicación**: búsqueda de `privacy-policy` y `terms.html` en `src/` sin resultados.
- El art. 12.1 RGPD exige información «de forma concisa, transparente, inteligible y de fácil acceso». Una página huérfana que solo se alcanza escribiendo la URL no cumple el «fácil acceso».
- El art. 10.1 LSSI exige acceso «permanente, fácil, directo y gratuito». Tampoco se cumple si no hay enlace.
- **Acción:** enlace visible en ajustes, en el alta y en el pie de la landing. No requiere abogado.

---

## 6. Qué falta y quién debe hacerlo

| Pieza                            | Redacción     | Revisión jurídica | Comentario                                             |
| -------------------------------- | ------------- | ----------------- | ------------------------------------------------------ |
| Política de privacidad completa  | Abogado + dev | **Sí**            | Debe partir del RAT y de la decisión sobre el art. 9.2 |
| Términos revisados               | Abogado       | **Sí**            | Eliminar promesa falsa y cláusulas abusivas            |
| Aviso legal (si aplica)          | Abogado       | **Sí**            | Domicilio y NIF son decisión del responsable           |
| Texto de consentimiento de salud | Abogado + dev | **Sí**            | Separado del alta, granular y revocable                |
| Aviso de cookies/almacenamiento  | Dev + abogado | Recomendada       | No necesariamente banner                               |
| Enlaces en la app                | Dev           | No                | Cambio de UI                                           |
| Procedimiento de derechos        | Dev + abogado | **Sí**            | Plazo, verificación de identidad y registro            |
| Política de retención            | Abogado + dev | **Sí**            | Debe ser ejecutable (TTL, cron)                        |

---

## 7. Limitaciones

- No se ha revisado la versión desplegada en producción; se ha revisado el HTML del repositorio.
- No se ha verificado el texto legal contra la web en vivo (`app.gymlog.dpdns.org`), por lo que podría existir una versión más reciente.
- No se ha evaluado la accesibilidad web del documento (contraste, lector de pantalla); el objeto era el contenido jurídico.
- La calificación de abusividad y la aplicabilidad del TRLGDCU/LSSI requieren abogado.

> Este documento no es asesoramiento jurídico ni acredita que la documentación sea conforme.
