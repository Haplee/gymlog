# Security Documentation - GymLog

## Alcance del hardening

Este documento recoge el proceso de Security Hardening realizado sobre el repositorio GymLog conforme a los marcos SOC 2 (TSC) y ISO/IEC 27001:2022 / ISO/IEC 27002:2022, siguiendo metodología basada en ISO/IEC 27005.

## Arquitectura de seguridad (descubierta)

- **Frontend**: React 19 + TypeScript + Vite (PWA). Capacitor 8 para Android/iOS.
- **Backend/Auth/DB**: Supabase (Postgres con RLS, Auth, Storage, Edge Functions Deno).
- **Edge Functions**: `ai-coach` (verifica JWT, obtiene user_id del token, usa service_role filtrando por userId, CORS restringido por origen, cuota/rate-limiting, post-filtro de seguridad), `send-push` (autorización por `x-send-secret` compartido), `delete-account` (borra cuenta del usuario del JWT, limpia storage avatars, usa service_role).
- **Datos sensibles**: Perfiles, entrenamientos, métricas, wearables (tokens OAuth en Vault), coach IA (mensajes/sugerencias/memoria), tokens push.
- **Almacenamiento cliente**: IndexedDB (TanStack Query persist), localStorage (stores Zustand con persist), Service Worker (precache solo; sin runtime caching de API por fuga entre cuentas).
- **Configuración**: Variables `VITE_*` públicas (Supabase anon key es pública por diseño, protegida por RLS). Secretos del servidor solo en Supabase Edge Function secrets (nunca `VITE_*`).

## Estado

Ver documentos individuales para hallazgos, controles, riesgos y evidencias.
