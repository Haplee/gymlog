# Security Hardening Report

## Medidas implementadas (ya existentes, verificadas)

- **Secrets en bundle**: `scripts/check-bundle-secrets.mjs` integrado en CI (`.github/workflows/ci.yml`) - bloquea claves proveedor, `AI_COACH_*`, `x-send-secret`, y JWT con rol distinto a `anon`.
- **AI Coach**: verificación JWT, user_id del token, CORS por origen, kill switch, cuotas diarias/mensuales, post-filtro de seguridad, sin clave en cliente.
- **Delete Account**: identidad desde JWT, limpieza de avatars en Storage, borrado via service_role con logging.
- **Send Push**: autenticación por `x-send-secret` compartido.
- **Service Worker**: sin runtimeCaching de API (evita fuga entre cuentas). Limpieza de caches obsoletas.
- **Cambio de cuenta**: `adoptAccount` limpia datos locales al detectar cambio de dueño; `userDataCleanup` resetea stores, limpia storage, caches.
- **RLS**: habilitado en tablas principales con políticas por usuario; migración `20261028140000_privacy_hardening.sql` bloquea tablas `backup_*` (RLS sin políticas + sin grants) y limpia secretos Vault de wearables al borrar conexión.
- **Storage avatars**: políticas por carpeta de usuario (`auth.uid() = foldername`), bucket público para lectura pero escritura/actualización/borrado restringidos.
- **Headers de seguridad**: configurados en `vercel.json` (HSTS, X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrictivo, CSP).
- **Auth**: Google OAuth con deep links nativos, sesión persistida con autoRefreshToken, limpieza al signOut.

## Archivos modificados

Ninguno en esta fase de documentación/validación inicial (trabajo en progreso).

## Justificación

Se documenta estado actual antes de implementar mejoras adicionales.

## Resultados

Pendiente tras implementación de mejoras.
