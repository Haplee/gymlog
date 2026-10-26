# delete-account — borrado de cuenta desde la app

Borra la cuenta del usuario autenticado y todo lo que cuelga de ella.

## Por qué existe

La política de privacidad prometía borrar la cuenta desde Ajustes y no había
ninguna forma de hacerlo. El cliente no puede borrar su fila de `auth.users` (ni
debe poder), así que el borrado lo ejecuta esta función con `service_role`,
pero **solo después de verificar el JWT de quien llama**. No acepta un `userId`
en el cuerpo: el id sale del token.

## Qué borra

1. Los objetos del bucket `avatars` bajo `{userId}/` (Storage no se borra en
   cascada).
2. `auth.users` con `admin.deleteUser`. Todas las tablas de usuario tienen
   `REFERENCES auth.users(id) ON DELETE CASCADE`, así que se vacían solas:
   perfil, entrenos, series, récords, medidas, cardio, salud, wearables,
   rutinas, tokens push y las tablas del entrenador.

## Estado

**Preparada, no desplegada.** Desplegarla es un cambio de infraestructura y
requiere decisión del responsable.

## Despliegue

```bash
supabase functions deploy delete-account
```

Los secretos `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
los inyecta la plataforma; no hay que configurar ninguno propio.

Para invocarla desde local:

```bash
supabase functions serve delete-account
```

## Respuestas

| Código | Cuerpo                              | Cuándo                                       |
| ------ | ----------------------------------- | -------------------------------------------- |
| 200    | `{ "deleted": true }`               | Cuenta borrada, o ya no existía              |
| 401    | `{ "error": "unauthorized" }`       | Sin `Authorization: Bearer` o token inválido |
| 405    | `{ "error": "method_not_allowed" }` | Método distinto de POST/OPTIONS              |
| 500    | `{ "error": "delete_failed" }`      | Auth no pudo borrar por un motivo real       |

## Comprobaciones posteriores (manuales, no ejecutadas)

- En Storage, `avatars/{userId}/` debe quedar vacío.
- `select count(*)` sobre `workouts`, `body_measurements` y `wearable_daily`
  para ese id debe dar 0.
- Un segundo POST con el mismo token debe responder 401: el token ya no
  identifica a ningún usuario.
- Los logs de la función no deben contener correo ni nombre, solo el id. El
  correo no se registra a propósito.
