# Security Assessment - Estado Inicial

## Fecha

2026-11-02

## Metodología

- Revisión estática de código, configuración, migraciones, Edge Functions, CI/CD.
- Mapeo de superficie de ataque, activos, autenticación/autorización, API, BD/RLS, secretos, headers, logging.

## Arquitectura general

- SPA PWA + nativo (Capacitor). Comunicación directa cliente-Supabase con RLS. Lógica sensible en Edge Functions con verificación JWT / secretos compartidos según caso.
- AI Coach: diseño correcto (clave proveedor solo en servidor, user_id del token, CORS por origen, kill switch, cuotas, post-filtro, memoria filtrada por usuario).
- Delete Account: correcto (identidad desde JWT, limpieza storage, deleteUser con service_role).
- Send Push: protegido con `x-send-secret` compartido (adecuado si solo llama backend/funciones autorizadas).

## Hallazgos iniciales (pre-hardening)

### Críticos

- (Pendiente validar tras revisión completa)

### Altos

- Ver `risk-register.md`

### Medios/Bajos/Informativos

- Ver `risk-register.md`

## Superficie de ataque identificada

- Endpoints Supabase (Auth, REST, RPC, Storage) con RLS - validar cobertura completa.
- Edge Functions expuestas públicamente con controles propios.
- Deep links nativos `com.franvi.gymlog://auth/callback`.
- OAuth Google.
- Subidas/descargas (avatars en Storage).
- Webhooks/funciones internas.
- Cliente bundle público.

## Notas

- Hay `check-bundle-secrets.mjs` en CI que bloquea claves de proveedor/roles no-anon en bundle - buen control.
- SW sin runtime caching de API (mitiga fuga entre cuentas) - buen control.
- Manejo cuidadoso de cambio de cuenta/limpieza local (`userDataCleanup`, `adoptAccount`) - buen control.
- Migración `20261028140000_privacy_hardening.sql` bloquea tablas backup expuestas y limpia secretos Vault en borrado - buen control.
