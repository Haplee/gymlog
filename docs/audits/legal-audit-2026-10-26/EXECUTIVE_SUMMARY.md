# GymLog — Auditoría legal preliminar (resumen ejecutivo)

- **Fecha de la auditoría:** 26 de octubre de 2026
- **Código auditado:** `main` @ `831de27`, con cambios del usuario sin confirmar en el árbol de trabajo (37 rutas en el momento de la lectura)
- **Alcance:** RGPD, LOPDGDD, LSSI, normativa de consumo (TRLGDCU), Reglamento de IA de la UE, licencias OSS y permisos móviles
- **Naturaleza:** revisión técnica de evidencias documentales y de código. **No es un dictamen jurídico** y **no declara a GymLog conforme** con ninguna norma.

---

## 1. Qué se ha hecho

1. Integración en el proyecto de siete skills de terceros bajo `.opencode/skills/` (seis de `claude-para-abogados` y `mariana-audit`), con procedencia, commit y licencias registradas en `.opencode/skills/PROVENANCE.md`.
2. Lectura del código y de las migraciones SQL para reconstruir qué datos se tratan, dónde se guardan, quién los recibe y qué controles existen.
3. Contraste con fuentes oficiales (BOE, AEPD) consultadas el **26/10/2026**, verificando fechas de aplicación y vigencia.
4. Revisión de la política de privacidad, los términos de servicio, el inventario de dependencias de producción y los permisos móviles declarados.
5. Emisión de 18 hallazgos con evidencia `archivo:línea`, separando lo probado en código de lo que depende de paneles externos, contratos o calificación jurídica.

**No se ha modificado código funcional, ni configuración, ni documentación legal existente.** No se ha desplegado nada, no se han instalado paquetes y no se ha subido código a terceros.

---

## 2. Panel de evidencia

| Confianza                                    | Hallazgos | %         |
| -------------------------------------------- | --------- | --------- |
| PROVEN (evidencia `archivo:línea`)           | 16        | 89 %      |
| UNVERIFIABLE (`NV_DASHBOARD` / `NV_RUNTIME`) | 2         | 11 %      |
| **Total**                                    | **18**    | **100 %** |

Fuentes de evidencia: lectura de código, lectura de migraciones SQL, metadatos de `npm ls`, consulta HTTP a fuentes oficiales.

Los dos hallazgos no verificables no son sospechas: son cuestiones que **no se pueden resolver leyendo el repositorio** (región contratada de Supabase y acuerdos de tratamiento firmados; comportamiento real de almacenamiento en el navegador). Se indican con la acción externa necesaria.

---

## 3. Top 5 riesgos con evidencia

| #   | Riesgo                                                                                                                                                                                                                                                                       | Gravedad | Evidencia principal                                                                                                                                      | Norma                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | La política de privacidad no describe los tratamientos reales: no menciona entrenador IA, Sentry, Google Fonts, Vercel, Cloudflare, Google OAuth, notificaciones push ni transferencias internacionales; está fechada en mayo de 2026 y el entrenador IA es de julio de 2026 | CRITICAL | `public/privacy-policy.html:16-53`; `src/main.tsx:45-79`; `supabase/functions/ai-coach/context.ts:109-140`; `index.html:17-20`                           | RGPD arts. 13.1.c/f, 13.2.a/f, 14.1.c/d; 12.1                             |
| 2   | Datos de salud (peso, grasa corporal, frecuencia cardiaca, sueño) tratados sin condición del art. 9.2 documentada ni base jurídica declarada para el servicio                                                                                                                | CRITICAL | `supabase/migrations/20260101000000_remote_schema.sql:117-128`; `20260622194522_wearables.sql:35-66`; `android/app/src/main/AndroidManifest.xml:436-447` | RGPD arts. 6.1, 9.1, 9.2.a, 13.1.c                                        |
| 3   | Los términos prometen borrado de cuenta desde la app, pero solo existe cierre de sesión; no hay flujo ni función de supresión                                                                                                                                                | CRITICAL | `public/terms.html:28`; `src/features/auth/pages/SettingsPage.tsx:772-785`; ausencia de `delete_account`/`deleteUser` en `src/` y `supabase/`            | RGPD arts. 5.1.e, 12.3, 17.1.a-b; TRLGDCU art. 20; Ley 3/1991 arts. 5 y 7 |
| 4   | Envío de datos de entrenamiento y salud agregada a Groq/NVIDIA sin acuerdo de tratamiento declarado y sin base para transferencia internacional sistemática; el propio README lo admite                                                                                      | CRITICAL | `supabase/functions/ai-coach/README.md:99-106`; `context.ts:109-140,183-249`; `index.ts:213-224`                                                         | RGPD arts. 28.3, 44, 46.1, 49.1.a (solo ocasional), 13.1.f                |
| 5   | El derecho de acceso/portabilidad se cubre con una exportación parcial: solo entrenamientos y cardio (rutinas en XLSX); quedan fuera medidas corporales, wearables, conversaciones del entrenador y perfil                                                                   | HIGH     | `src/features/stats/utils/exportImport.ts:231-259`; `src/features/stats/hooks/useHistoryTransfer.ts:254-265,303-314`                                     | RGPD arts. 15.1, 15.3, 20.1, 12.3                                         |

Detalle completo, con gravedad, confianza y obligación concreta: `FINDINGS.md`.

---

## 4. Resumen por bloque

### 4.1. Protección de datos

- **Tratamientos reales identificados:** cuenta y perfil, entrenamientos y series, rutinas, récords, medidas corporales, cardio, datos de wearables (pasos, distancia, calorías, pulso, sueño), entrenador IA (contexto agregado, memoria, mensajes, sugerencias, cuota y auditoría), tokens push, analítica y errores.
- **Datos del art. 9 RGPD:** peso, grasa corporal, masa muscular, frecuencia cardiaca, sueño y, por inferencia, información de salud derivada del entrenamiento. Son la categoría de mayor riesgo del proyecto.
- **Base jurídica:** no está declarada en la política ni documentada en el repositorio. La ejecución de contrato (art. 6.1.b) puede cubrir el servicio, pero **no levanta la prohibición del art. 9.1**: hace falta una condición del art. 9.2 y, si se elige el consentimiento explícito, debe ser informado y granular.
- **Transparencia:** la política omite destinatarios, transferencias, plazos y tratamientos esenciales. Es un fallo de información, no una cuestión estética.
- **Derechos:** no hay borrado de cuenta; la exportación es parcial; el ejercicio de derechos se remite a correo sin plazo ni procedimiento publicado.
- **Menores:** la política fija el umbral en 13 años; la LOPDGDD lo sitúa en 14 (art. 7). El consentimiento de 13–14 años quedaría potencialmente inválido.
- **Registro de actividades (RAT) y EIPD:** no constan en el repositorio. La exención del art. 30.5 no es aplicable porque se tratan datos de salud. La EIPD es **probable** por la naturaleza de los datos y el seguimiento sistemático, pero la necesidad final depende de escala y contexto que el repositorio no revela.

### 4.2. Cookies y almacenamiento en terminal

- Vercel Analytics y Cloudflare Web Analytics son **sin cookies** según su configuración de integración; por sí solos no activan automáticamente el art. 22.2 LSSI.
- **No se ha podido verificar en ejecución** qué almacena el navegador. El service worker cachea respuestas de la API de Supabase (`vite.config.ts:99-107`) y TanStack Query persiste en IndexedDB 24 h (`src/app/providers.tsx:59`), lo que sí es almacenamiento en terminal y exige información.
- **Conclusión matizada:** la ausencia de banner no es por sí sola un incumplimiento, pero tampoco hay información sobre almacenamiento propio. Falta verificarlo en un navegador real (`NV_RUNTIME`).

### 4.3. Documentación legal

- La política de privacidad es un texto breve, genérico y desactualizado respecto al producto.
- Los términos contienen una promesa de borrado no implementada, una facultad de modificación unilateral y una limitación de responsabilidad que requieren revisión jurídica (TRLGDCU arts. 82, 85.3, 86.2).
- **No hay ningún enlace a privacidad ni a términos dentro de la aplicación**; solo se enlazan entre sí desde las páginas públicas.
- La información del art. 10 LSSI está incompleta (falta domicilio postal y NIF). Su aplicabilidad es discutible si el servicio es gratuito y no lucrativo, por lo que se clasifica como **obligación potencial**, no como incumplimiento confirmado.

### 4.4. Entrenador IA y Reglamento de IA

- El entrenador envía agregados (objetivo, días, material, franja de edad, sexo, peso redondeado, series por semana, sueño medio, pulso en reposo). **No envía** identificadores directos, correo, nombre ni fecha exacta de nacimiento.
- El consentimiento está implementado con versión, fecha, evento de auditoría y purga al revocar (`src/features/coach/api/coach.ts:48-87`; `20260728100045_ai_coach.sql:157-187`). Es un control real y verificable.
- El proveedor gratuito no trae DPA, según el propio README (`:105-106`). Eso es un problema de encargado (art. 28) y de transferencia (arts. 44-46), no solo de información.
- **Reglamento de IA:** el caso parece de riesgo mínimo. La transparencia del art. 50.1 está aparentemente cubierta por la etiqueta «Entrenador IA» y el aviso «Análisis de tus datos con IA». El marcado legible por máquina del art. 50.2 puede aplicar desde el **2 de diciembre de 2026** si el sistema se introdujo antes del 2 de agosto de 2026 (prórroga del Reglamento (UE) 2026/1744). Requiere confirmación jurídica.

### 4.5. Licencias OSS

- **564 rutas únicas** de dependencias de producción, **536** `nombre@versión`, **520** nombres.
- Mayoría permisiva: 475 MIT, 46 ISC, 9 Apache-2.0, 8 BSD-3, 8 BlueOak, 5 BSD-2, 2 MPL-2.0.
- Sin AGPL ni GPL-only. `jszip` es dual MIT/GPL y se puede usar bajo MIT.
- Riesgos menores: `lightningcss` (MPL-2.0, obligaciones por archivo), `caniuse-lite` (CC-BY-4.0, atribución), `buffers@0.1.1` (sin licencia declarada, transitiva de `exceljs`), ausencia de archivo de avisos de terceros.
- **No se ha revisado** la licencia del contenido de ExerciseDB (GIFs e instrucciones) ni de las fuentes servidas por Google Fonts; son cuestiones distintas del software.

### 4.6. Móvil y permisos

- Android declara permisos de Health Connect para pasos, distancia, calorías, pulso, sueño y ejercicio, incluido acceso en segundo plano (`AndroidManifest.xml:436-447`).
- **iOS no declara cadenas de uso de HealthKit** en `ios/App/App/Info.plist`, mientras el puente de salud existe. Es una inconsistencia de plataforma que puede afectar a la revisión de App Store y a la transparencia.
- El token push no se elimina al cerrar sesión: solo al desactivar notificaciones (`src/shared/lib/push.ts:84-96`; `SettingsPage.tsx:244`). En un dispositivo compartido, el nuevo usuario podría recibir avisos del anterior.

---

## 5. Lo que no se ha podido verificar

| Cuestión                                                                                    | Motivo                                              | Acción externa necesaria                                         |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Región de Supabase y plan contratado                                                        | No hay `supabase/config.toml`; depende del panel    | Revisar proyecto en Supabase; documentar región y transferencias |
| Contratos de encargo (Supabase, Vercel, Cloudflare, Sentry, Groq, NVIDIA, Google, FCM/APNs) | No están en el repositorio                          | Recopilar DPAs y registrar subencargados                         |
| Existencia real de RAT y EIPD fuera del repo                                                | Documentos internos                                 | Confirmar con el responsable                                     |
| Cookies/almacenamiento real en navegador                                                    | Requiere ejecución (`NV_RUNTIME`)                   | Auditar con DevTools en producción                               |
| Declaraciones de Data Safety / App Privacy en las tiendas                                   | Paneles de Google Play y App Store (`NV_DASHBOARD`) | Revisar y alinear con esta auditoría                             |
| Carácter comercial del servicio y condición de consumidor                                   | Depende del modelo de explotación                   | Decisión de negocio + revisión jurídica                          |
| Volumen de usuarios y menores                                                               | No consta                                           | Métricas internas                                                |

---

## 6. Conclusión

GymLog trata datos de salud y los envía a varios terceros, incluido un proveedor de IA sin DPA declarado, con una política de privacidad que no los describe y sin borrado de cuenta pese a prometerlo. **No existe base para afirmar que la app sea conforme con el RGPD, la LOPDGDD, la LSSI o la normativa de consumo.**

Los controles técnicos existen en varios puntos (RLS en las 26 tablas, consentimiento versionado del entrenador, Sentry sin PII por defecto, purga al revocar), pero **los controles técnicos no sustituyen la base jurídica, la información ni los contratos**.

Las acciones de mayor impacto están en `ACTION_PLAN.md`. Las que requieren abogado están marcadas como tales y no deben resolverse copiando texto de plantilla.

> Aviso: este documento es una auditoría técnica preliminar. No constituye asesoramiento jurídico, no acredita cumplimiento y no sustituye la revisión de un profesional del Derecho.
