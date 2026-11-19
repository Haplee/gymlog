# Incident Response Plan

## 1. Detección

- Monitorización: Sentry (errores), logs de Supabase Edge Functions, CI checks.
- Alertas: revisar alertas configuradas en plataformas (Vercel/Supabase).
- Reportes: canal de seguridad definido en SECURITY.md (pendiente completar contactos).

## 2. Clasificación

| Severidad | Criterios                                                         | Tiempo respuesta objetivo |
| --------- | ----------------------------------------------------------------- | ------------------------- |
| Crítica   | Exposición de secretos/clave servicio, RCE, acceso masivo a datos | Inmediato (minutos)       |
| Alta      | Escalada privilegios, bypass auth/RLS, filtración PII             | < 1 hora                  |
| Media     | Vulnerabilidad explotable con auth, configuración insegura        | < 4 horas                 |
| Baja      | Mejora de seguridad, hardening                                    | < 24 horas                |

## 3. Contención

- Revocar/rotar credenciales comprometidas inmediatamente
- Desactivar feature vía kill-switch si aplica (AI_COACH_ENABLED=false)
- Bloquear acceso/IPs si necesario via plataforma
- Aislar/rollback despliegue

## 4. Investigación

- Recopilar logs, trazas, timestamps
- Identificar alcance (usuarios/datos afectados)
- Preservar evidencias

## 5. Erradicación

- Aplicar parche/corrección
- Verificar eliminación de vector
- Escanear/validar

## 6. Recuperación

- Restaurar desde backup verificado si necesario
- Monitorear tras corrección
- Verificar integridad

## 7. Notificación

- Evaluar obligación notificación (RGPD si datos personales)
- Notificar a partes afectadas según requisitos
- Documentar notificaciones

## 8. Lecciones aprendidas

- Post-mortem documentado
- Actualizar controles/procedimientos
- Añadir tests/monitoreo

## Gestión de credenciales comprometidas

1. Identificar credencial comprometida
2. Rotar inmediatamente en plataforma (Supabase secrets, Vercel env vars)
3. Verificar uso en logs
4. Actualizar todos los sistemas que la usen
5. Verificar que no quede expuesta
6. Documentar incidente
