# Secure Development Policy

## Reglas de desarrollo seguro

- Nunca commitear secretos/credenciales
- Usar variables de entorno correctamente (`VITE_*` solo para valores públicos)
- Secretos de servidor solo en plataformas (Supabase/Vercel secrets)
- Validación de inputs con Zod/schemas
- Nunca confiar en validación cliente únicamente
- Aplicar principio mínimo privilegio
- RLS obligatorio en tablas con datos usuario
- Revisar dependencias antes de añadirlas

## Gestión de dependencias

- Revisar `npm audit` regularmente
- Actualizar con criterio (evitar breaking changes sin validar)
- Usar `npm ci` en CI
- Revisar licencias

## Revisión de código

- Revisar cambios de seguridad
- Ejecutar lint/type-check/tests
- Verificar `check-bundle-secrets` pasa
- No exponer información sensible en logs

## Gestión de secretos

- Rotación periódica
- Almacenamiento seguro
- Acceso restringido
- Nunca en logs/código/commits
- Usar `.env.example` sin valores reales
