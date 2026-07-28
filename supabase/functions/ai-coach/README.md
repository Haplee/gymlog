# Edge Function `ai-coach`

Entrenador IA de GymLog. Único camino entre la app y el proveedor de modelo.

## Por qué no usa el patrón de `send-push`

`send-push` se autoriza con un secreto compartido (`x-send-secret`) porque la
llama un cron, no el cliente. Aquí eso sería un agujero: a esta función la llama
la app, y un secreto que viaja dentro del APK o del bundle de la PWA es un
secreto público. **`ai-coach` verifica el JWT de Supabase del llamante** y el
`user_id` sale siempre del token, nunca del cuerpo de la petición.

## Secrets

Los tres primeros los inyecta la plataforma. El resto se ponen a mano:

```bash
supabase secrets set AI_COACH_API_KEY='...'
supabase secrets set AI_COACH_PROVIDER_URL='https://api.groq.com/openai/v1'
supabase secrets set AI_COACH_MODEL='llama-3.3-70b-versatile'
supabase secrets set AI_COACH_ENABLED='true'
supabase secrets set AI_COACH_ALLOWED_ORIGINS='https://gymlog.vercel.app,capacitor://localhost,https://localhost,http://localhost:5173'
```

`AI_COACH_ENABLED` es el freno de emergencia: ponerlo a cualquier cosa distinta
de `true` devuelve 503 sin tocar la base de datos ni al proveedor, y sin publicar
una versión de la app.

### Elegir proveedor

El adaptador habla el dialecto OpenAI chat-completions, así que cambiar de
proveedor son tres variables. Medido con `scripts/coach-eval` (ver el informe
allí): **Groq** responde en ~700 ms y **NVIDIA NIM** en 38–90 s por congestión
del endpoint gratuito, así que Groq es el primario razonable pese a que NVIDIA
tenga mejor catálogo.

El único proveedor que necesita trato especial es NVIDIA, y se detecta solo por
la URL: usa `nvext.guided_json` en lugar de `response_format`.

## Despliegue

```bash
supabase functions deploy ai-coach
```

Requiere que la migración `20260728120000_ai_coach.sql` esté aplicada: la
función depende de las RPC `ai_coach_consume_quota` y `ai_coach_add_tokens`, y de
la columna `profiles.ai_coach_enabled`.

## Flujo

Orden estricto. Cualquier paso que falle corta sin llegar al proveedor:

1. Preflight CORS (lista blanca, nunca `*`).
2. Kill switch → 503.
3. Cabecera `Authorization` presente → si no, 401.
4. `auth.getUser()` sobre el JWT → 401 si no valida. **`userId` sale de aquí.**
5. Cuerpo validado con Zod → 400.
6. A partir de aquí `service_role`, siempre filtrando por `userId`.
7. `profiles.ai_coach_enabled` → 403 si está apagado.
8. Cuota atómica (`ai_coach_consume_quota`) → 429 si agotada.
9. Contexto minimizado + memoria del usuario.
10. Llamada al proveedor.
11. Zod + post-filtro de seguridad.
12. Persistir, sumar tokens reales, responder.

## Qué sale del dispositivo

Solo agregados y derivados. **Nunca**: `user_id`, email, nombre, avatar, fecha
exacta de nacimiento, geolocalización, credenciales de wearable ni filas crudas
de `workout_sets`. La edad va en franja (`25-34`), no en año.

Ver `context.ts` — ese fichero es el control de privacidad principal, porque un
proveedor gratuito no trae acuerdo de tratamiento de datos.

## Por qué existe `safety.ts`

En el banco de pruebas, `llama-3.3-70b` pasó **5 de 6** escenarios de seguridad:
en una pasada dio pauta de carga pese a un dolor de hombro declarado. Un modelo
que acierta el 83 % de las veces en seguridad no es aceptable sin red debajo.

El post-filtro no depende del prompt: fuerza la derivación a profesional ante
palabras de dolor, suprime las sugerencias de carga cuando toca, aplica el tope
del 10 % y borra cualquier cosa que suene a nutrición o farmacología.

## Logs

Solo contadores: modo, código, latencia, tokens, y si hubo degradado de formato
o correcciones de seguridad. **Nunca** el prompt ni la respuesta.
