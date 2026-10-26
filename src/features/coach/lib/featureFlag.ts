/**
 * Interruptor de la interfaz del entrenador.
 *
 * El entrenador manda datos de entrenamiento y salud a proveedores externos de
 * modelos. Mientras no haya contratos de encargo, evaluación de transferencias
 * y una base jurídica revisada, la interfaz queda apagada por defecto: el
 * código sigue ahí, las tablas no se tocan y volver a encenderlo es cambiar
 * `VITE_AI_COACH_UI_ENABLED=true`, sin desplegar código nuevo.
 *
 * Apagado significa: ni entrada en el menú, ni tarjeta en Inicio, ni sección en
 * Ajustes, ni rutas `/coach`. El usuario que ya lo tuviera activado conserva sus
 * datos; simplemente deja de ver la puerta. Y la Edge Function sigue siendo
 * invocable por HTTP: esto es contención de producto, no un kill-switch de
 * servidor. Para eso hay que desplegar la función con `--no-verify-jwt` o
 * retirarla; está documentado en el informe de remediación.
 */
export const COACH_UI_ENABLED = import.meta.env.VITE_AI_COACH_UI_ENABLED === 'true';
