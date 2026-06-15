# send-push — Push remoto FCM

Envía notificaciones push (FCM HTTP v1) a todos los dispositivos de un usuario.

## Requisitos previos (fuera del repo)

1. **Proyecto Firebase** con Cloud Messaging habilitado.
2. **Service account** de Firebase (Configuración → Cuentas de servicio → Generar
   clave privada). De ese JSON salen `project_id`, `client_email`, `private_key`.
3. **`google-services.json`** colocado en `android/app/` (lo usa el plugin nativo
   `@capacitor/push-notifications`).
4. En `android/app/build.gradle` aplicar el plugin de Google Services y en
   `android/build.gradle` añadir el classpath `com.google.gms:google-services`.
   Tras ello: `npm run build:android` (`vite build && cap sync android`).

## Activar el registro en el cliente

El registro push está **desactivado por defecto** para no crashear la app cuando
falta `google-services.json` (`PushNotifications.register()` lanza
`Default FirebaseApp is not initialized`, un crash nativo no capturable).

Una vez tengas Firebase + `google-services.json` + el plugin gradle aplicados,
activa el registro con la variable de entorno (build web / Vercel):

```
VITE_PUSH_ENABLED=true
```

Mientras esté a `false` (o ausente), el plugin queda instalado pero inerte.

## Secrets de la edge function

```bash
supabase secrets set FIREBASE_PROJECT_ID="tu-project-id"
supabase secrets set FIREBASE_CLIENT_EMAIL="...@....iam.gserviceaccount.com"
supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
supabase secrets set SEND_PUSH_SECRET="$(openssl rand -hex 32)"
# SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta la plataforma.
```

> `FIREBASE_PRIVATE_KEY` debe conservar los `\n` escapados (tal cual viene en el JSON).

## Deploy

```bash
supabase functions deploy send-push
```

## Uso

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "x-send-secret: $SEND_PUSH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","title":"¡A entrenar!","body":"Tu rutina de hoy te espera","url":"/"}'
```

Respuesta: `{ "sent": <n>, "removed": <tokens inválidos eliminados> }`.

## Notas

- La tabla `push_tokens` (migración `20260615_push_tokens.sql`) guarda los tokens
  con RLS por usuario; esta función los lee con `service_role`.
- El cliente registra/actualiza su token en cada arranque vía
  `src/shared/lib/push.ts` (`registerPushNotifications`), respetando el toggle de
  notificaciones.
- Los tokens que FCM rechaza (404/400) se eliminan automáticamente.
