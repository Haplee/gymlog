# Edge Function: `fitbit-oauth`

Puente seguro con la Fitbit Web API. El cliente nunca ve `client_secret` ni el
refresh token; los tokens se cifran en **Supabase Vault** y solo la `service_role`
los descifra dentro de esta función.

## Acciones (body JSON, campo `action`)

| action     | body extra                              | qué hace                                                              |
| ---------- | --------------------------------------- | --------------------------------------------------------------------- |
| `exchange` | `code`, `code_verifier`, `redirect_uri` | Cambia el authorization code (PKCE) por tokens y los guarda en Vault. |
| `sync`     | `days` (opcional, 1–30, def. 7)         | Lee actividad/HR/sueño/workouts y upserta en la BD.                   |
| `refresh`  | —                                       | Fuerza refresco del access token (diagnóstico).                       |

Todas requieren `Authorization: Bearer <jwt-de-usuario>` (la función verifica el
usuario y escribe los datos como ese usuario, con RLS).

## Secrets (configúralos antes de desplegar)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` los inyecta la
plataforma. Faltan los de Fitbit:

```bash
supabase secrets set FITBIT_CLIENT_ID="<client id>"
supabase secrets set FITBIT_CLIENT_SECRET="<client secret>"
```

## Despliegue

```bash
supabase functions deploy fitbit-oauth
```

## Registro de la app en Fitbit (acción manual del usuario)

1. Entra en https://dev.fitbit.com/apps/new
2. **OAuth 2.0 Application Type**: _Client_ (PKCE, sin secret en cliente — el
   secret vive solo aquí en el servidor).
3. **Redirect URL**: añade ambas:
   - Web/PWA: `https://<tu-dominio-vercel>/auth/fitbit-callback`
   - App nativa: `com.franvi.gymlog://fitbit-callback`
4. **Default Access Type**: _Read-Only_.
5. **Scopes** usados por la app: `activity heartrate sleep profile`.
6. Copia `OAuth 2.0 Client ID` → ponlo en el front (`VITE_FITBIT_CLIENT_ID`) y
   `Client Secret` → `supabase secrets set FITBIT_CLIENT_SECRET`.

## Notas

- El access token de Fitbit caduca a las **8h**; `sync`/`refresh` lo renuevan y
  rotan automáticamente en Vault.
- Endpoints Fitbit consumidos: `/1/user/-/activities/date/{date}.json`,
  `/1/user/-/activities/heart/date/{date}/1d.json`,
  `/1.2/user/-/sleep/date/{date}.json`,
  `/1/user/-/activities/list.json`.
- Límite Fitbit: 150 req/h por usuario → `sync` por defecto 7 días.
