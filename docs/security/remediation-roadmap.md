# Remediation Roadmap

## Acciones completadas

- Documentación inicial de seguridad creada
- Inventario y evaluación inicial realizados
- Verificación de controles existentes

## Acciones pendientes (Prioritarias)

### CRITICAL

- [ ] Revisar vulnerabilidades críticas de npm audit (3 críticas) - evaluar si afectan runtime/producción
- [ ] Verificar configuración real de CORS/secrets en Supabase (AI_COACH_ALLOWED_ORIGINS, SEND_PUSH_SECRET)

### HIGH

- [ ] Auditar RLS en todas las tablas - verificar políticas completas
- [ ] Revisar CSP en vercel.json - intentar endurecer sin romper funcionalidad
- [ ] Configurar rate-limiting adicional si posible
- [ ] Completar SECURITY.md con contactos de reporte

### MEDIUM

- [ ] Revisar logs para asegurar sin PII
- [ ] Añadir SAST/SCA al CI (Semgrep/Gitleaks/Trivy) si compatible
- [ ] Documentar procedimientos operativos
- [ ] Definir RTO/RPO

### LOW

- [ ] Mejorar documentación organizativa para ISO 27001
- [ ] Añadir tests de seguridad básicos
