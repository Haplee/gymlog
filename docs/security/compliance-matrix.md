# Compliance Matrix - SOC 2 / ISO 27001 / ISO 27002

## SOC 2 Trust Services Criteria (TSC) - Evaluación inicial

| Criterio                          | Aplicable | Estado  | Evidencia                             | Riesgo | Remediación                                  |
| --------------------------------- | --------- | ------- | ------------------------------------- | ------ | -------------------------------------------- |
| CC1 - Control Environment         | Sí        | Parcial | Governance docs limitados             | Medio  | Documentar políticas de seguridad/desarrollo |
| CC2 - Communication & Information | Sí        | Parcial | README, SECURITY.md básico            | Medio  | Mejorar documentación                        |
| CC3 - Risk Assessment             | Sí        | Parcial | Este hardening in progress            | Medio  | Completar risk-register con evidencias       |
| CC4 - Monitoring Activities       | Sí        | Parcial | Sentry, logs en Edge Functions        | Medio  | Mejorar logging estructurado y alertas       |
| CC5 - Control Activities          | Sí        | Parcial | RLS, auth, headers, checks            | Medio  | Fortalecer controles                         |
| CC6 - Logical & Physical Access   | Sí        | Parcial | Auth, RLS, funciones con auth/secreto | Medio  | Revisar políticas RLS exhaustivamente        |
| CC7 - System Operations           | Sí        | Parcial | CI, build checks                      | Medio  | Añadir más checks de seguridad               |
| CC8 - Change Management           | Sí        | Parcial | Git, CI                               | Medio  | Documentar proceso                           |
| CC9 - Risk Mitigation             | Sí        | Parcial | En progreso                           | Medio  | Completar                                    |

## ISO/IEC 27001:2022 - Claúsulas

| Cláusula        | Aplicable | Estado         | Evidencia                   | Riesgo | Remediación                      |
| --------------- | --------- | -------------- | --------------------------- | ------ | -------------------------------- |
| 4 Contexto      | Sí        | Parcial        | README, arquitectura        | Medio  | Documentar contexto organizativo |
| 5 Liderazgo     | Sí        | No verificable | Sin evidencia               | Medio  | Requiere contexto organizativo   |
| 6 Planificación | Sí        | Parcial        | Risk assessment en progreso | Medio  | Completar análisis de riesgos    |
| 7 Apoyo         | Sí        | Parcial        | Docs parciales              | Medio  | Fortalecer                       |
| 8 Operación     | Sí        | Parcial        | Controles técnicos          | Medio  | Documentar procedimientos        |
| 9 Evaluación    | Sí        | Parcial        | Tests, CI                   | Medio  | Añadir revisiones                |
| 10 Mejora       | Sí        | Parcial        | Proceso iterativo           | Medio  | Documentar                       |

## ISO/IEC 27002:2022 - Controles relevantes (verificados)

| Control ID | Categoría    | Requisito (ISO/IEC 27002:2022)                                    | Aplicabilidad | Estado  | Evidencia técnica                                                        | Evidencia organizativa              | Riesgo | Acción correctiva                                      |
| ---------- | ------------ | ----------------------------------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------ | ----------------------------------- | ------ | ------------------------------------------------------ |
| A.5.9      | Organizativo | Inventory of information and other associated assets              | Sí            | Parcial | `docs/security/security-assessment.md`, inventario en código/migraciones | Pendiente (aprobación organizativa) | Medio  | Completar inventario con propietarios y ubicación      |
| A.5.12     | Organizativo | Classification of information                                     | Sí            | Parcial | Clasificación implícita (datos usuario, PII, secretos)                   | Pendiente                           | Medio  | Definir esquema de clasificación formal                |
| A.5.15     | Organizativo | Access control                                                    | Sí            | Parcial | RLS en tablas, auth Supabase, políticas                                  | Pendiente                           | Alto   | Auditar cobertura RLS completa (ver sección auditoría) |
| A.5.16     | Organizativo | Identity management                                               | Sí            | Parcial | Supabase Auth (Google OAuth), gestión usuarios                           | Pendiente                           | Alto   | Documentar ciclo vida identidades                      |
| A.5.17     | Organizativo | Authentication information                                        | Sí            | Parcial | Gestión sesiones Supabase, tokens                                        | Pendiente                           | Alto   | Verificar rotación/revocación y configuración cookies  |
| A.5.18     | Organizativo | Access rights                                                     | Sí            | Parcial | RLS + roles (anon/authenticated/service_role)                            | Pendiente                           | Alto   | Revisar privilegios mínimos y revisiones periódicas    |
| A.8.2      | Tecnológico  | Privileged access rights                                          | Sí            | Parcial | `service_role` solo en Edge Functions, `SECURITY DEFINER` limitado       | Pendiente                           | Alto   | Auditar todos los SECURITY DEFINER y uso service_role  |
| A.8.3      | Tecnológico  | Information access restriction                                    | Sí            | Parcial | RLS por usuario, Storage con políticas por carpeta                       | Pendiente                           | Alto   | Verificar aislamiento entre usuarios                   |
| A.8.5      | Tecnológico  | Secure authentication                                             | Sí            | Parcial | OAuth, gestión sesiones, renovación tokens                               | Pendiente                           | Alto   | Verificar configuración Supabase Auth                  |
| A.8.9      | Tecnológico  | Configuration management                                          | Sí            | Parcial | `vercel.json`, `vite.config.ts`, CI, migraciones                         | Pendiente                           | Medio  | Documentar baseline de configuración segura            |
| A.8.15     | Tecnológico  | Logging                                                           | Sí            | Parcial | Logs estructurados en Edge Functions, Sentry                             | Pendiente                           | Medio  | Auditar logs sin PII/secrets                           |
| A.8.16     | Tecnológico  | Monitoring activities                                             | Sí            | Parcial | Sentry, CI checks                                                        | Pendiente                           | Medio  | Definir alertas críticas                               |
| A.8.24     | Tecnológico  | Use of cryptography                                               | Sí            | Parcial | TLS (plataforma), sin crypto propio                                      | Pendiente                           | Medio  | Verificar algoritmos/TLS                               |
| A.8.26     | Tecnológico  | Application security requirements                                 | Sí            | Parcial | Validación Zod, checks bundle secrets                                    | Pendiente                           | Medio  | Documentar requisitos seguridad app                    |
| A.8.28     | Tecnológico  | Secure coding                                                     | Sí            | Parcial | Linting, validación, patrones seguros                                    | Pendiente                           | Medio  | Reforzar guías secure coding                           |
| A.8.31     | Tecnológico  | Separation of development, test and production environments       | Sí            | Parcial | Entornos separados (dev/staging/prod)                                    | Pendiente                           | Medio  | Documentar separación formal                           |
| A.8.32     | Tecnológico  | Change management                                                 | Sí            | Parcial | Git, CI, PRs                                                             | Pendiente                           | Medio  | Documentar proceso change management                   |
| A.5.24     | Organizativo | Information security incident management planning and preparation | Sí            | Parcial | `incident-response-plan.md` creado                                       | Pendiente                           | Alto   | Completar con contactos/responsables                   |
| A.5.25     | Organizativo | Assessment and decision on information security events            | Sí            | Parcial | Definido en plan                                                         | Pendiente                           | Alto   | Formalizar clasificación                               |
| A.5.26     | Organizativo | Response to information security incidents                        | Sí            | Parcial | Procedimiento definido                                                   | Pendiente                           | Alto   | Validar procedimiento                                  |
| A.5.27     | Organizativo | Learning from information security incidents                      | Sí            | Parcial | Post-mortem definido                                                     | Pendiente                           | Medio  | Formalizar registro lecciones aprendidas               |
| A.5.28     | Organizativo | Collection of evidence                                            | Sí            | Parcial | Logging/auditoría parcial                                                | Pendiente                           | Medio  | Definir procedimiento evidencias                       |
| A.5.29     | Organizativo | Information security during disruption                            | Sí            | Parcial | `backup-and-recovery.md`                                                 | Pendiente                           | Alto   | Definir RTO/RPO y probar restauración                  |
| A.5.30     | Organizativo | ICT readiness for business continuity                             | Sí            | Parcial | Parcial                                                                  | Pendiente                           | Alto   | Completar plan continuidad                             |
