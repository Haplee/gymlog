## Contexto y decisiones

### Qué significa "que aprenda de cada usuario"

Descartado el fine-tuning por usuario: coste, volumen de datos y beneficio no
cuadran para un usuario con decenas de sesiones. Lo que sí produce personalización
real es la combinación de tres cosas:

1. **Features deterministas por usuario** calculadas en el cliente (volumen por
   grupo, tendencia de e1RM, RIR/RPE medio por ejercicio, adherencia, recuperación).
2. **Contexto compacto por usuario** inyectado en cada llamada al modelo.
3. **Memoria persistente y revisable** (`ai_coach_memory`) que el modelo escribe y
   lee: "hombro derecho molesta en press militar", "solo entrena 3 días",
   "no tiene barra en casa". Esto es lo que hace que la segunda conversación sea
   mejor que la primera.

También descartada la inferencia on-device (Gemini Nano / MediaPipe): dentro de un
WebView de Capacitor implica tamaño de APK, solo Android y calidad insuficiente
para consejo de entrenamiento. Se menciona para dejar constancia de que se evaluó.

### Por qué la Capa 0 va primero

El 70% de "va ajustando todo" no necesita LLM. Con RIR y RPE ya guardados por serie
se puede hacer autorregulación clásica de forma determinista, gratis, offline y
testeable. Además da al LLM un contexto mucho mejor: el modelo razona sobre
conclusiones ya calculadas, no sobre filas crudas, lo que reduce tokens y errores
aritméticos.

---

## Arquitectura

```
Cliente (React/Capacitor)                 Supabase                    Proveedor LLM
─────────────────────────                 ─────────                   ─────────────
Capa 0  motor determinista  ─┐
  utils puros, offline       │  (nada sale del dispositivo)
                             │
Capa 1  consentimiento ──────┼──▶ profiles.ai_coach_enabled
  settingsStore + modal      │    profiles.ai_coach_consent_at
                             │    ai_coach_audit
                             │
Capa 2  useCoach() ──────────┴──▶ Edge Function `ai-coach`  ──────▶ POST /chat/completions
  fetch con JWT del usuario         · verifica JWT (getUser)          proveedor gratuito
                                    · comprueba consent + kill switch  (Groq por defecto,
                                    · consume cuota (RPC atómica)       intercambiable)
                                    · construye contexto (service_role,
                                      acotado a ese user_id)
                                    · valida salida (Zod) ◀──────────
                                    · registra uso, no el contenido
                             ┌──▶ ai_coach_messages / ai_coach_suggestions
Capa 3  memoria ─────────────┴──▶ ai_coach_memory  (tool call con esquema estricto)
```

**Regla estructural:** el cliente nunca habla con el proveedor. El único camino es
la Edge Function, y esa función nunca acepta un `user_id` del cuerpo de la petición:
lo deriva siempre del JWT.

---

## Modelo de amenazas y controles

| #   | Amenaza                                                                        | Control                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | Clave de API extraída del APK/bundle                                           | La clave vive solo en `Deno.env` de la Edge Function. Ningún `VITE_*` la toca. Verificación en CI: la clave no aparece en `dist/`.                                                                                 |
| T2  | Endpoint abierto usado como proxy de LLM gratis                                | Verificación obligatoria del JWT de Supabase + cuota por usuario + tope global mensual + CORS restringido a orígenes conocidos.                                                                                    |
| T3  | Copiar el patrón de `send-push` (secreto compartido `x-send-secret`)           | **Prohibido explícitamente.** Un secreto que viaja en el cliente es público. `ai-coach` usa `supabase.auth.getUser(jwt)`.                                                                                          |
| T4  | Usuario A lee datos del coach de usuario B                                     | RLS `auth.uid() = user_id` en las 5 tablas nuevas + toda consulta del servidor filtra por el `user_id` del JWT, nunca por uno del body.                                                                            |
| T5  | Fuga de datos de salud hacia el proveedor del LLM                              | Minimización: se envían agregados y derivados, nunca filas crudas ni identificadores. Nada de email, nombre, avatar ni `user_id`. Fecha de nacimiento → franja de edad. Ver "Minimización" abajo.                  |
| T6  | Inyección de prompt vía texto del propio usuario (notas, nombres de ejercicio) | Texto de usuario delimitado y etiquetado como no confiable; el modelo no tiene ninguna herramienta privilegiada; los tool calls solo escriben en `ai_coach_memory` del usuario y el `user_id` lo pone el servidor. |
| T7  | Consejo peligroso (diagnóstico, dieta, entrenar con lesión)                    | Reglas duras en el system prompt + post-filtro determinista de banderas rojas + descargo visible + confirmación humana para cualquier cambio.                                                                      |
| T8  | El coach modifica rutinas/pesos por su cuenta                                  | Las sugerencias se guardan en `ai_coach_suggestions` con estado `pending`. Aplicarlas es una mutación del cliente disparada por el usuario.                                                                        |
| T9  | Salida malformada o inyección en el render                                     | Salida estructurada (`output_config.format`) + validación Zod en servidor y en cliente. Se renderiza como texto plano, nunca `dangerouslySetInnerHTML`.                                                            |
| T10 | Coste descontrolado                                                            | Cuota por usuario (día/mes), tope global, `max_tokens` acotado, caché de prompt, y `AI_COACH_ENABLED=false` como freno de emergencia sin release.                                                                  |
| T11 | Datos que sobreviven a la revocación del consentimiento                        | Desactivar purga `ai_coach_memory`, `ai_coach_messages` y `ai_coach_suggestions` del usuario en una RPC transaccional; queda solo el registro en `ai_coach_audit` (sin contenido).                                 |
| T12 | Logs con datos personales                                                      | Se registran contadores (tokens, latencia, `stop_reason`) y nunca prompt ni respuesta.                                                                                                                             |

---

## Minimización: qué sale exactamente del dispositivo

Solo con el coach activado, y solo esto:

**Se envía** (todo agregado o derivado, construido en el servidor desde la BD):

- Perfil de entrenamiento: objetivo, días/semana, material disponible, unidades.
- Franja de edad (`<25 / 25-34 / 35-44 / 45-54 / 55+`), sexo, peso redondeado a kg.
- Por ejercicio de las últimas 8 semanas: nombre, nº de sesiones, mejor e1RM,
  tendencia, RIR/RPE medio, series por semana.
- Volumen por grupo muscular y estado de recuperación (salida de la Capa 0).
- Racha, adherencia 30 d, PRs recientes.
- Si hay wearable y está conectado: media de sueño y FC de reposo de 7 días
  (números, no series temporales).
- Hechos de `ai_coach_memory` del propio usuario.
- El mensaje que el usuario escribe, si es el modo chat.

**No se envía nunca:** `user_id`, email, nombre, avatar, fecha exacta de
nacimiento, coordenadas, tokens de wearable, filas individuales de
`workout_sets`, ni notas libres de otros usuarios (evidentemente) ni las propias
salvo que el usuario esté preguntando explícitamente por ellas.

La pantalla de consentimiento muestra esta lista textualmente. Si la lista cambia,
cambia la versión de consentimiento y se vuelve a pedir.

---

## Edge Function `ai-coach`: flujo obligatorio

Orden estricto; cualquier paso que falle corta con el código correspondiente y sin
llegar a Anthropic.

1. `OPTIONS` → CORS. **CORS restringido**: `Access-Control-Allow-Origin` se resuelve
   contra `AI_COACH_ALLOWED_ORIGINS` (lista separada por comas), no `*`.
   Capacitor manda `Origin: https://localhost` o `capacitor://localhost`; ambos van
   en la lista.
2. Kill switch: si `Deno.env.get('AI_COACH_ENABLED') !== 'true'` → `503`.
3. `Authorization: Bearer <jwt>` presente → si no, `401`.
4. `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization } } })`
   y `auth.getUser()`. Sin usuario válido → `401`. **`userId` = `user.id`, siempre
   desde aquí.**
5. Validar el body con Zod: `{ mode: 'weekly'|'chat'|'exercise', message?: string(<=1000), exerciseId?: uuid }`.
   Body inválido → `400`. Longitud máxima estricta para acotar el coste.
6. Cliente `service_role` **solo a partir de aquí**, y toda consulta con
   `.eq('user_id', userId)`.
7. Consentimiento: `profiles.ai_coach_enabled === true` → si no, `403`.
8. Cuota: RPC atómica `ai_coach_consume_quota(userId, mode)` (`SECURITY DEFINER`,
   `INSERT … ON CONFLICT DO UPDATE` con comprobación en la misma sentencia).
   Excedida → `429` con `Retry-After`.
9. Construir contexto (minimizado, ver arriba) + leer `ai_coach_memory`.
10. Llamar al proveedor de modelo (ver abajo).
11. Validar respuesta y post-filtro de seguridad.
12. Persistir mensaje/sugerencias, actualizar uso real de tokens, responder.

---

## Elección de proveedor: gratis primero, y coste cero en el dispositivo

Requisito del proyecto: **ni el usuario ni el proyecto pagan inferencia**, y el
dispositivo hace el mínimo trabajo posible.

### Coste en el dispositivo

- La Capa 0 es aritmética sobre unos cientos de series: microsegundos. Aun así se
  memoiza (`useMemo` con las mismas claves que ya usan las queries de stats) para
  que no se recalcule en cada render.
- La inferencia **nunca** ocurre en el móvil: no hay modelo local, no hay WASM, no
  hay descarga de pesos. El dispositivo solo hace un `fetch` y pinta texto.
- Las respuestas del coach se cachean en TanStack Query y se persisten en
  `ai_coach_messages`: reabrir la pantalla no vuelve a llamar al modelo.

### Adaptador de proveedor

Todos los proveedores gratuitos viables hablan el dialecto **OpenAI
chat-completions**, así que la función usa un único adaptador
(`providers/openaiCompat.ts`) parametrizado por `baseUrl`, `apiKey` y `model`.
Cambiar de proveedor es cambiar tres variables de entorno, sin tocar código.

La distinción que importa no es "gratis o no", sino **si la cuota se renueva**:

| Proveedor                       | Endpoint                                                   | Modelo de gratuidad                                                          | Notas                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Groq** (primario recomendado) | `https://api.groq.com/openai/v1`                           | **Recurrente**: ~30 req/min, ~14.400 req/día, ~30K tok/min                   | Cuota que se renueva a diario: es lo que necesita una app que vive años. Latencia muy baja. Llama, Qwen, DeepSeek-R1.                                                         |
| **Cerebras** (respaldo)         | `https://api.cerebras.ai/v1`                               | **Recurrente**: ~1M tok/día y ~14.400 req/día por modelo                     | Contexto limitado a 8K en el free tier — obliga a mantener el prompt corto, cosa que este diseño ya hace.                                                                     |
| **Google Gemini**               | `https://generativelanguage.googleapis.com/v1beta/openai/` | **Recurrente**: ~500 req/día, RPM bajo                                       | Catálogo Flash/Pro amplio; los 429 llegan pronto si se abusa.                                                                                                                 |
| **NVIDIA NIM**                  | `https://integrate.api.nvidia.com/v1`                      | **Pozo finito**: 1.000 créditos al alta (hasta 5.000 a petición), 40 req/min | Clave ya disponible y el catálogo más amplio (80+ modelos). Los créditos **no se renuevan solos**: sirve para desarrollar y comparar modelos, no como primario a largo plazo. |
| **OpenRouter**                  | `https://openrouter.ai/api/v1`                             | Modelos con sufijo `:free`                                                   | Una sola clave para comparar proveedores durante la elección de modelo.                                                                                                       |
| **Cloudflare Workers AI**       | compatible OpenAI                                          | Cuota diaria gratuita                                                        | Solo interesante si algún día se mueve la función a Workers.                                                                                                                  |

Configuración: `AI_COACH_PROVIDER_URL`, `AI_COACH_API_KEY`, `AI_COACH_MODEL`, y
opcionalmente `AI_COACH_FALLBACK_*` con la misma terna para un segundo proveedor.
Si el primario devuelve 429 o 5xx, se reintenta **una vez** con el de respaldo.

Los límites concretos cambian con el tiempo: antes de fijar la cuota de
`ai_coach_usage` hay que confirmarlos en la consola de la cuenta real, y dejar la
cuota de la app **por debajo** del límite del proveedor, nunca al ras.

### Consecuencias de usar niveles gratuitos (asumidas explícitamente)

1. **Límites de tasa agresivos.** Por eso la cuota por usuario de la Capa 2 no es
   opcional: sin ella, tres usuarios activos agotan el free tier. Ante 429 del
   proveedor la UI muestra "vuelve a intentarlo en un rato", nunca un error crudo.
2. **Garantías de datos más débiles.** Los niveles gratuitos suelen reservarse el
   derecho a usar las peticiones para mejorar sus servicios, y no traen acuerdo de
   tratamiento de datos. Con datos de salud (RGPD art. 9) esto **no es un detalle**:
   - la pantalla de consentimiento nombra al proveedor concreto y advierte de que
     es un servicio gratuito sin acuerdo de tratamiento;
   - la minimización deja de ser buena práctica y pasa a ser el control principal:
     sin identificadores, sin fechas exactas, solo agregados;
   - si algún día hay usuarios distintos del autor, hay que revisar esto antes.
3. **Sin caché de prompt.** Los free tiers no la ofrecen: el prompt se mantiene
   pequeño por diseño (contexto ya agregado por la Capa 0) en vez de compensar con
   caché.
4. **Calidad y formato variables.** Un Llama 3.3 70B no es un modelo frontera. De
   ahí que el post-filtro determinista y la validación con Zod sean obligatorios, y
   que el reintento con reparación de JSON esté previsto.

### Parámetros de la llamada

- Salida estructurada, **con dos dialectos que el adaptador debe conocer**:
  - Estándar (Groq, Cerebras, Gemini, OpenRouter):
    `response_format: { type: "json_schema", json_schema: { strict: true, schema } }`.
  - **NVIDIA NIM**: usa su extensión propia `nvext: { guided_json: schema }`. No es
    intercambiable con `response_format`, así que el adaptador lleva un flag de
    dialecto por proveedor.
  - Degradado común si ninguno se acepta: `{ type: "json_object" }` + el esquema
    escrito en el system prompt, y validación Zod como red de seguridad.
- El catálogo real de la cuenta se consulta con `GET /v1/models` sobre el mismo
  `baseUrl`: es la fuente de verdad, no la documentación pública.
- `temperature: 0.3` — aquí sí se acepta y conviene: consejo estable, no creativo.
- `max_tokens: 800`. La respuesta es deliberadamente corta y los free tiers cobran
  en límites de tasa, no en dinero.
- Sin streaming: complica el post-filtro (habría que filtrar sobre texto parcial) y
  no aporta con respuestas de 800 tokens.
- **Reparación de JSON:** si la respuesta no valida contra Zod, un único reintento
  con el error de validación adjunto. Si vuelve a fallar, error controlado y no se
  persiste nada.
- Timeout de 20 s con `AbortController`: un free tier lento no puede dejar colgada
  la Edge Function.

### Esquema de salida (json_schema, `strict: true`)

`additionalProperties: false` y `required` en todos los niveles — varios proveedores
rechazan el esquema si falta, y los que no lo rechazan lo cumplen peor:

```jsonc
{
  "summary": "string (<= 400 chars)",
  "insights": [{ "title": "string", "body": "string", "severity": "info|success|warning" }],
  "suggestions": [
    {
      "kind": "load|volume|frequency|deload|rest|exercise_swap",
      "exercise_name": "string|null",
      "action": "string (<= 200 chars)",
      "rationale": "string (<= 300 chars)",
      "confidence": "low|medium|high",
    },
  ],
  "needs_professional": "boolean",
}
```

`needs_professional: true` hace que la UI muestre el aviso de consultar a un
profesional y **suprime todas las sugerencias de carga** de esa respuesta.

### Post-filtro determinista (no confiar solo en el prompt)

En el servidor, antes de persistir:

- Rechazar la respuesta si alguna sugerencia implica un salto de carga > 10% sobre
  el último peso registrado de ese ejercicio (el motor de la Capa 0 tiene el dato).
- Rechazar menciones a suplementos, fármacos, calorías o macros: fuera de alcance.
- Si el mensaje del usuario contiene términos de dolor/lesión (lista en
  `redFlags.ts`), forzar `needs_professional = true` sea cual sea la salida del
  modelo.
- Truncar cualquier campo que exceda su longitud declarada en vez de confiar en el
  modelo.

---

## Inyección de prompt

El texto libre del usuario (notas de series, nombres de ejercicios propios) entra
en el contexto. Mitigación por diseño, no por súplica al modelo:

1. **Sin superficie que atacar.** El modelo dispone de una única herramienta,
   `remember_fact`, que escribe en `ai_coach_memory`. No hay herramienta de lectura
   arbitraria, de borrado, de red ni de escritura en `workouts` o `routines`. El
   peor caso de una inyección exitosa es guardar un hecho falso en la memoria del
   propio usuario, que el propio usuario ve y borra desde Ajustes.
2. **`user_id` fuera del alcance del modelo.** El servidor lo pone al insertar; el
   esquema de la herramienta ni siquiera lo incluye.
3. **Delimitación.** El texto de usuario va en un bloque
   `<user_text_untrusted>…</user_text_untrusted>` con instrucción explícita de
   tratarlo como datos, nunca como instrucciones.
4. **Validación de salida** independiente del prompt (esquema estricto + post-filtro).

---

## Consentimiento, revocación y RGPD

- `profiles.ai_coach_enabled` (default `false`) es la **fuente de verdad de
  servidor**. `settingsStore.aiCoachEnabled` es espejo de cliente para la UI, igual
  que se hace hoy con `notificationsEnabled` ↔ `localStorage['notif_disabled']`.
  Si discrepan, gana el servidor.
- `profiles.ai_coach_consent_at` + `ai_coach_consent_version`: si la versión del
  texto de consentimiento sube, el coach queda inactivo hasta reaceptar.
- **Activar** exige un modal con: qué datos salen (lista literal de arriba), a qué
  proveedor, que no sustituye a un profesional, y que se puede desactivar y borrar
  cuando quiera. Botón primario "Activar" nunca preseleccionado.
- **Desactivar** llama a la RPC `ai_coach_purge(userId)`: borra memoria, mensajes y
  sugerencias en una transacción, pone `ai_coach_enabled = false` y deja un registro
  sin contenido en `ai_coach_audit`.
- `ai_coach_audit` guarda solo `{user_id, event, consent_version, created_at}` —
  ningún dato de salud. Sirve para demostrar el consentimiento, no para analítica.
- Todas las tablas cuelgan de `auth.users … ON DELETE CASCADE`: borrar la cuenta
  borra el coach.

---

## Rate limiting y coste

Con proveedor gratuito el recurso escaso no es el dinero: son los límites de tasa.
La cuota protege el free tier de que un solo usuario lo agote para todos.

`ai_coach_usage` con clave `(user_id, day)`:

| Modo       | Límite        | Motivo                               |
| ---------- | ------------- | ------------------------------------ |
| `weekly`   | 2/día, 10/mes | Es un resumen; más no aporta         |
| `chat`     | 20/día        | Uso conversacional razonable         |
| `exercise` | 30/día        | Consultas puntuales, respuesta corta |

Además: tope global diario de peticiones en `AI_COACH_DAILY_REQUEST_CAP`, ajustado
por debajo del límite real del proveedor; al superarlo la función responde `503` y
la UI lo explica. La cuota se consume **antes** de llamar al proveedor (para que un
fallo no permita reintentos infinitos) y se corrige después con los tokens reales.

Coste monetario objetivo: **0 €**. Si algún día se agota el free tier, el degradado
es a la Capa 0, que sigue funcionando entera y gratis.

---

## UI

- Nueva sección "Entrenador" en Ajustes (opt-in + gestión de memoria + borrado).
- Página `/coach` con el resumen semanal y el chat, cargada perezosamente como el
  resto de rutas.
- Con el coach apagado, `UserStatsPage` sigue mostrando los tips actuales más las
  sugerencias deterministas de la Capa 0. **La app no pierde nada por no activar la
  IA** — condición del usuario.
- Cada sugerencia se muestra con su botón "Aplicar", que abre el flujo normal de
  edición con los valores prerrellenados. Nunca se aplica sola.
- Reglas de la casa: todos los strings vía i18next (incluido el texto legal del
  consentimiento), sin hex hardcodeados, touch targets ≥44px, comprobado a 390px y
  **en tema claro y oscuro**.

## Alternativas descartadas

- **Secreto compartido tipo `send-push`**: inseguro para un endpoint llamado desde
  el cliente (T3).
- **Llamar al proveedor desde el cliente con la clave en el bundle**: filtra la
  clave en la PWA y en el APK, y cualquiera puede gastar el free tier.
- **API de pago (Claude, GPT) como opción por defecto**: descartada por el requisito
  de coste cero. El adaptador es compatible con OpenAI, así que enchufar una de
  pago más adelante es cambiar tres variables de entorno.
- **Inferencia on-device (Gemini Nano, MediaPipe, WebLLM)**: sería "gratis" en
  dinero pero carísima para el usuario — cientos de MB de pesos, batería, y solo
  Android. Contradice directamente el requisito de coste mínimo en el dispositivo.
- **Aplicar cambios automáticamente en rutinas**: incompatible con "solo si el
  usuario quiere" y con la seguridad física.
- **SDK del proveedor en la Edge Function**: añade dependencia y peso de arranque en
  Deno para una única llamada HTTP compatible con OpenAI.
