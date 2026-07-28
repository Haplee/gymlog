## Why

GymLog ya tiene una capa de consejo determinista (`tips.ts`, `fatigueAnalysis.ts`,
métricas de progresión) que funciona bien pero es genérica: dice lo mismo a todo el
mundo ante los mismos números y no recuerda nada del usuario. Los datos que ya
guardamos —series con **RIR (0–5) y RPE (1–10)**, volumen, PRs, rutinas, sueño y
FC de reposo de wearables— permiten dar consejo realmente personalizado y ajustar
la progresión sesión a sesión.

El objetivo es un **entrenador que aprenda de cada usuario, aconseje y vaya
ajustando la carga**, cumpliendo dos condiciones no negociables:

1. **Solo si el usuario quiere.** Opt-in explícito, apagado por defecto, revocable
   en un toque y con borrado real de los datos del coach.
2. **Seguro.** Los datos de entrenamiento cruzados con peso, sexo, año de
   nacimiento, sueño y frecuencia cardiaca son **datos de salud (categoría especial,
   RGPD art. 9)**: exigen consentimiento explícito, minimización y borrado. Y el
   consejo toca salud física: nunca puede diagnosticar, prescribir dieta ni
   sustituir a un profesional.

## What Changes

Cuatro capas, cada una útil por sí sola y desplegable de forma independiente:

- **Capa 0 — Motor determinista (sin IA, sin dependencias nuevas).** Autorregulación
  real a partir de RIR/RPE: sugerencia de peso/reps para la próxima sesión de cada
  ejercicio, detección de estancamiento, aviso de deload, y ajuste por sueño/FC de
  reposo si hay wearable. Funciones puras en `src/features/stats/utils/`, offline,
  gratis y testeadas con Vitest. **Se activa para todo el mundo** porque no manda
  nada fuera del dispositivo.
- **Capa 1 — Consentimiento y kill switch.** `ai_coach_enabled` en `profiles`
  (default `false`) + `settingsStore`, pantalla de consentimiento que enumera
  exactamente qué sale del dispositivo, y desactivación que purga todos los datos
  del coach.
- **Capa 2 — Coach LLM tras Edge Function.** Función `ai-coach` en Deno que
  **verifica el JWT de Supabase del llamante** (no el secreto compartido de
  `send-push`, que sería extraíble del APK), construye el contexto desde la BD con
  `service_role` acotado a ese usuario, llama a la API de Claude con la clave solo
  en `Deno.env`, valida la salida con Zod y la devuelve. Cuota y rate limit por
  usuario en servidor.
- **Capa 3 — Memoria del coach.** Tabla `ai_coach_memory` con hechos aprendidos
  (lesiones, preferencias, restricciones de material, objetivos), escritos por el
  modelo vía tool-calling con esquema estricto, **visibles y borrables uno a uno
  desde Ajustes**. Esto es el "aprende de cada usuario" sin fine-tuning.

Transversal a todo: **el coach propone, el usuario aplica**. Ninguna sugerencia
modifica una rutina, un peso o una serie sin confirmación explícita.

## Capabilities

### New Capabilities

- `ai-coach-consent`: Opt-in explícito y revocable del entrenador IA — flag
  persistido en `profiles` y en el store de ajustes, pantalla de consentimiento con
  el detalle de los datos enviados, revocación con purga completa, y kill switch de
  servidor para desactivar la función sin publicar versión.
- `ai-coach-engine`: Motor determinista de autorregulación — sugerencia de carga
  por ejercicio a partir de RIR/RPE, detección de estancamiento y deload, y
  modulación por sueño y FC de reposo. Puro, offline, sin envío de datos.
- `ai-coach-llm`: Endpoint servidor `ai-coach` con verificación de JWT, contexto
  agregado y minimizado, llamada a Claude con clave solo en servidor, salida
  estructurada validada, cuota/rate limit por usuario y barreras de seguridad de
  contenido (nada de diagnóstico ni prescripción).
- `ai-coach-memory`: Memoria persistente y auditable por usuario — hechos escritos
  por el modelo con esquema estricto, acotados por RLS al propietario, listables,
  editables y borrables desde Ajustes.

### Modified Capabilities

<!-- No hay specs previos en openspec/specs/ para stats ni ajustes. La capa
determinista actual (tips.ts, fatigueAnalysis.ts) se CONSERVA sin regresión: el
motor nuevo la extiende, no la sustituye, y sigue funcionando con el coach IA
desactivado. -->

## Impact

- **BD:** migración idempotente en `supabase/migrations/` — 2 columnas nuevas en
  `profiles` (`ai_coach_enabled`, `ai_coach_consent_at`) y 5 tablas nuevas
  (`ai_coach_memory`, `ai_coach_messages`, `ai_coach_suggestions`,
  `ai_coach_usage`, `ai_coach_audit`), todas con RLS `auth.uid() = user_id` y
  `ON DELETE CASCADE`. Tipos regenerados con `npm run gen:types` (nunca a mano).
- **Servidor:** nueva Edge Function `supabase/functions/ai-coach/`. Secretos nuevos:
  `AI_COACH_API_KEY`, `AI_COACH_PROVIDER_URL`, `AI_COACH_MODEL`, `AI_COACH_ENABLED`,
  `AI_COACH_ALLOWED_ORIGINS`. Ninguno toca el bundle del cliente.
- **Código nuevo:** `src/features/coach/` (páginas, componentes, store, api, hooks)
  y utilidades deterministas en `src/features/stats/utils/`.
- **Código modificado:** `SettingsPage` (sección Entrenador IA), `settingsStore`
  (flag + purga), `UserStatsPage` (sugerencias deterministas junto a los tips
  actuales), y `useFatigueSuggestion` (arreglar de paso sus strings en español
  hardcodeados, que hoy incumplen la regla de i18next).
- **Dependencias:** **cero nuevas** — la Edge Function habla el dialecto
  OpenAI chat-completions con `fetch`, sin SDK.
- **Coste: 0 €.** Proveedor gratuito con adaptador compatible con OpenAI; por
  defecto **NVIDIA NIM** (`integrate.api.nvidia.com`), con Groq/Gemini/Cerebras como
  respaldo intercambiable por variables de entorno. El recurso escaso son los
  límites de tasa del free tier, no el dinero: de ahí la cuota por usuario y el tope
  global diario. Si el free tier se agota, la app degrada a la Capa 0, que sigue
  entera.
- **Coste en el dispositivo:** nulo. No hay modelo local ni inferencia en el móvil;
  el cliente hace un `fetch` y pinta texto. La Capa 0 es aritmética sobre unos
  cientos de series y va memoizada.
- **Riesgo residual asumido:** el texto libre del usuario (notas de series, nombres
  de ejercicios) entra en el prompt; se trata como dato no confiable (ver
  `design.md`, sección de inyección de prompt).
