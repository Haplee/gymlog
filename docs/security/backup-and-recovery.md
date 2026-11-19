# Backup and Recovery

## Estrategia de copias

- **Base de datos Supabase**: gestionar backups según plan de Supabase (Point-in-time recovery / backups programados). Verificar configuración en proyecto.
- **Storage**: revisar estrategia de backups de buckets (avatars).
- **Código**: repositorio Git (fuente de verdad).
- **Configuración**: variables de entorno/secrets documentados, no en repo.

## Recuperación

- Procedimiento: restaurar desde backup más reciente verificado
- Validar integridad tras restauración
- Probar funcionalidad crítica

## RTO/RPO

- **RTO** (Recovery Time Objective): Pendiente definir según requisitos negocio
- **RPO** (Recovery Point Objective): Pendiente definir según requisitos negocio

**Nota**: No se afirma que los backups funcionan hasta haber probado restauración en entorno seguro.
