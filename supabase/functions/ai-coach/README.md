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

Opcionales:

```bash
# Respaldo. Si el primario da 429/5xx/timeout, un único intento contra este.
# Sin los tres puestos, no hay respaldo y el error sale tal cual.
supabase secrets set AI_COACH_FALLBACK_PROVIDER_URL='https://integrate.api.nvidia.com/v1'
supabase secrets set AI_COACH_FALLBACK_API_KEY='...'
supabase secrets set AI_COACH_FALLBACK_MODEL='meta/llama-3.3-70b-instruct'

# Tope global del mes en tokens, sumando a TODOS los usuarios. 0 o sin poner = sin tope.
# La cuota diaria protege a un usuario de otro; esto protege la cuenta del proveedor.
supabase secrets set AI_COACH_MONTHLY_TOKEN_CAP='2000000'
```

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
8. Tope global del mes (`ai_coach_month_tokens`) → 503. Va antes de la cuota
   diaria: si el mes está agotado, el usuario no debe perder además su día.
9. Cuota atómica (`ai_coach_consume_quota`) → 429 si agotada.
10. Contexto minimizado + memoria del usuario.
11. Llamada al proveedor; si falla por congestión, un intento al respaldo.
12. Zod; si no valida, un único reintento de reparación con el error delante.
13. Post-filtro de seguridad.
14. Persistir mensajes, memoria y sugerencias, sumar tokens reales, responder.

## Memoria: por qué no es un tool call

El plan original pedía una herramienta `remember_fact`. Se implementó como un
campo `remember` del mismo JSON de salida, y la razón es de medición: con estos
proveedores ya cuesta arrancar salida estructurada (llama-3.3-70b rechaza
`json_schema` con 400 y hay que degradar a `json_object`), y mezclar `tools` con
`response_format` obliga a una segunda vuelta al proveedor **en cada mensaje** —
el doble de latencia y de cuota para escribir una frase.

Lo que se conserva íntegro es la propiedad que importaba: **`user_id` no está en
el esquema que ve el modelo**. Lo pone el servidor desde el JWT, en
`memory.ts`, que además trunca a 200 caracteres, descarta duplicados y aplica el
tope de 50 hechos por usuario (cae el de menor confianza y, a igualdad, el más
antiguo).

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
