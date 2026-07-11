-- Fix definitivo: los perfiles nunca se creaban.
-- `handle_new_user` insertaba una columna `created_at` que NO existe en
-- public.profiles → el INSERT fallaba siempre y el EXCEPTION lo tragaba con un
-- WARNING. Resultado: 0 filas en profiles, y los UPDATE de nombre/avatar desde
-- la app afectaban a 0 filas sin dar error ("se guardaba" en cache pero se
-- perdía al recargar). Idempotente: CREATE OR REPLACE + backfill con ON CONFLICT.

-- 0. Columna que el cliente (SettingsPage) lee y escribe pero que nunca
--    existió en la tabla: su ausencia hacía fallar también el SELECT de
--    ajustes (nombre y avatar ni se cargaban) y el toggle de notificaciones.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false;

-- 1. Función corregida: sin created_at; añade email y el avatar/nombre que
--    trae Google en raw_user_meta_data (full_name/name, avatar_url/picture).
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No abortar el alta de usuario si el perfil falla; el cliente hace upsert
  -- defensivo al editar el perfil.
  RAISE WARNING 'Error creando profile para user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- 2. Backfill: crear el perfil de todos los usuarios existentes que se
--    quedaron sin fila por el bug.
INSERT INTO public.profiles (id, email, full_name, username, avatar_url, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
