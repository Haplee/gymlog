-- ═══════════════════════════════════════════════════════════════════
--  Siembra de la cuenta de pruebas (e2e + capturas de UI)
--  Creada el 2026-08-14.
--
--  QUÉ ES: una cuenta propia en el Supabase de producción, aislada de
--  las cuentas reales, con historial suficiente para que las pantallas
--  de estadísticas, historial y rutinas no salgan vacías.
--
--  POR QUÉ EXISTE: todas las rutas de la app salvo `/login` están tras
--  `ProtectedRoute` (src/App.tsx). Sin sesión no se puede auditar la UI
--  ni ejecutar `e2e/workout-session.spec.ts`.
--
--  CREDENCIALES: en `.env.local` (fuera de git), como E2E_EMAIL y
--  E2E_PASSWORD. Nunca en el repo — es público.
--
--  CÓMO SE CREÓ EL USUARIO (no lo hace este script, porque GoTrue debe
--  crear las filas de auth.users y auth.identities correctamente):
--    1. POST {SUPABASE_URL}/auth/v1/signup con apikey publishable
--    2. update auth.users set email_confirmed_at = now() where id = ...
--
--  CÓMO USARLO: sustituye :uid por el id del usuario y ejecuta. Es
--  repetible: borra primero con el bloque del final si quieres partir
--  de cero.
-- ═══════════════════════════════════════════════════════════════════

-- Sustituye por el id que devuelva el signup (o búscalo en auth.users por email).
\set uid '00000000-0000-0000-0000-000000000000'

-- ── Perfil ────────────────────────────────────────────────────────
-- Ojo con los CHECK: goal solo admite volume | strength | endurance | fat_loss.
insert into public.profiles (
  id, email, full_name, username, weight_unit, goal, days_per_week,
  equipment_available, onboarding_completed, weight_kg, height_cm,
  birth_year, sex, notifications_enabled, ai_coach_enabled
) values (
  :'uid', 'REEMPLAZAR@ejemplo.com', 'Cuenta de pruebas', 'qa-e2e', 'kg',
  'volume', 3, array['barbell','dumbbell','machine','cable'], true,
  78.5, 178, 1995, 'male', false, false
)
on conflict (id) do update set
  onboarding_completed = true,
  goal = excluded.goal,
  days_per_week = excluded.days_per_week;

-- ── 30 entrenos: 3 por semana durante 10 semanas ──────────────────
-- El offset en días coloca las sesiones en días alternos dentro de
-- cada semana y hace que la última caiga hoy, para que la racha viva.
insert into public.workouts (
  user_id, name, status, started_at, finished_at,
  duration_min, duration_seconds, rating
)
select
  :'uid',
  case s % 3 when 0 then 'Empuje' when 1 then 'Tirón' else 'Pierna' end,
  'completed',
  now() - make_interval(days => ((9 - s/3) * 7 + (4 - (s % 3) * 2)), hours => 8),
  now() - make_interval(days => ((9 - s/3) * 7 + (4 - (s % 3) * 2)), hours => 8)
       + make_interval(mins => 58 + (s % 7)),
  58 + (s % 7),
  (58 + (s % 7)) * 60,
  3 + (s % 3)
from generate_series(0, 29) as s;

-- ── 270 series con progresión lineal por semana ───────────────────
-- La semana sale del row_number dentro de cada tipo de día, así que
-- el peso sube de forma coherente a lo largo del historial.
-- NOTA: un trigger de la base crea los personal_records solos al
-- insertar aquí. No hay que sembrarlos a mano.
with w as (
  select id, name, started_at,
         (row_number() over (partition by name order by started_at) - 1) as semana
  from public.workouts where user_id = :'uid'
), plan as (
  select * from (values
    ('Empuje', 1, '35bb7dd8-9f6c-446d-96e8-7c183287dc4e'::uuid,  60.0, 2.50,  8), -- Press banca
    ('Empuje', 2, '610e1679-cf17-468c-848e-1f94d9888ae1'::uuid,  35.0, 1.25,  9), -- Press militar
    ('Empuje', 3, 'fd33bab7-fbe2-4d59-ac14-d481140123ce'::uuid,  10.0, 0.50, 12), -- Elevaciones laterales
    ('Tirón',  1, 'aa3fc770-6b71-4982-8d1e-e9332ecc1323'::uuid,  90.0, 5.00,  6), -- Peso muerto
    ('Tirón',  2, '91be2ad3-9a2a-4b28-aa17-2402c2c66ea4'::uuid,  50.0, 2.50,  9), -- Remo con barra
    ('Tirón',  3, '6649cf2c-65e2-45c2-a08e-9b626430f8cf'::uuid,  55.0, 2.50, 10), -- Jalón al pecho
    ('Pierna', 1, 'd2f9f61b-2e0f-41c0-95d5-9563671b48af'::uuid, 120.0, 5.00, 10), -- Prensa de piernas
    ('Pierna', 2, '236f1dbf-5c3a-460c-bd75-91715ea8d94b'::uuid,  45.0, 2.50, 12), -- Extensiones de cuádriceps
    ('Pierna', 3, '8927e03c-3187-4a98-85c3-da954f3ed474'::uuid,  70.0, 5.00, 10)  -- Hip thrust
  ) as t(dia, orden, ejercicio, peso_base, incremento, reps_base)
)
insert into public.workout_sets (
  workout_id, exercise_id, set_num, weight, reps, rir,
  is_warmup, set_type, created_at
)
select
  w.id, p.ejercicio, sn.set_num,
  p.peso_base + (w.semana * p.incremento),
  greatest(4, p.reps_base - (sn.set_num - 1)),
  case sn.set_num when 3 then 0 else 2 end,
  false, 'normal',
  w.started_at + make_interval(mins => (p.orden - 1) * 18 + (sn.set_num - 1) * 4)
from w
join plan p on p.dia = w.name
cross join generate_series(1, 3) as sn(set_num);

-- ── Agregados de cada entreno ─────────────────────────────────────
with agg as (
  select ws.workout_id, sum(ws.weight * ws.reps) as vol, count(*) as n
  from public.workout_sets ws
  join public.workouts w on w.id = ws.workout_id
  where w.user_id = :'uid'
  group by ws.workout_id
)
update public.workouts w
set total_volume = agg.vol, total_volume_kg = agg.vol, total_sets = agg.n
from agg where w.id = agg.workout_id;

-- ── Rutina activa (3 días) ────────────────────────────────────────
insert into public.user_routines (user_id, routine)
values (:'uid', jsonb_build_object(
  'routines', jsonb_build_array(jsonb_build_object(
    'id','e2e-full-body',
    'name','Full body · 3 días',
    'isCustom', true,
    'createdAt', to_char(now() - interval '70 days','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'description','Rutina de la cuenta de pruebas. Tres días alternos: empuje, tirón y pierna.',
    'days', jsonb_build_object(
      'monday', jsonb_build_object('name','Empuje','exercises', jsonb_build_array(
        jsonb_build_object('name','Press banca','reps','8','sets',3),
        jsonb_build_object('name','Press militar','reps','9','sets',3),
        jsonb_build_object('name','Elevaciones laterales','reps','12','sets',3))),
      'tuesday',   jsonb_build_object('name','Descanso','exercises', jsonb_build_array()),
      'wednesday', jsonb_build_object('name','Tirón','exercises', jsonb_build_array(
        jsonb_build_object('name','Peso muerto','reps','6','sets',3),
        jsonb_build_object('name','Remo con barra','reps','9','sets',3),
        jsonb_build_object('name','Jalón al pecho','reps','10','sets',3))),
      'thursday',  jsonb_build_object('name','Descanso','exercises', jsonb_build_array()),
      'friday', jsonb_build_object('name','Pierna','exercises', jsonb_build_array(
        jsonb_build_object('name','Prensa de piernas','reps','10','sets',3),
        jsonb_build_object('name','Extensiones de cuádriceps','reps','12','sets',3),
        jsonb_build_object('name','Hip thrust','reps','10','sets',3))),
      'saturday',  jsonb_build_object('name','Descanso','exercises', jsonb_build_array()),
      'sunday',    jsonb_build_object('name','Descanso','exercises', jsonb_build_array())
    ))),
  'lastBackup', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'activeRoutineId','e2e-full-body'
));

-- ── Cardio y medidas corporales ───────────────────────────────────
insert into public.cardio_sessions (
  user_id, type, started_at, duration, distance, calories, source, avg_hr, max_hr
)
select :'uid',
       (array['running','cycling','walking'])[1 + (s % 3)],
       now() - make_interval(days => (s * 5 + 2), hours => 10),
       (28 + (s % 5) * 6) * 60,
       round((4.5 + (s % 5) * 1.2)::numeric, 2),
       260 + (s % 5) * 45,
       'manual', 138 + (s % 7), 162 + (s % 9)
from generate_series(0, 11) as s;

insert into public.body_measurements (user_id, date, weight_kg, body_fat_pct, muscle_mass_kg)
select :'uid', (current_date - (s * 7))::date,
       round((78.5 + s * 0.18)::numeric, 1),
       round((16.4 + s * 0.09)::numeric, 1),
       round((36.2 - s * 0.05)::numeric, 1)
from generate_series(0, 9) as s;


-- ═══════════════════════════════════════════════════════════════════
--  LIMPIEZA — descomenta para borrar todos los datos de la cuenta.
--  Los workout_sets y personal_records caen en cascada con workouts.
-- ═══════════════════════════════════════════════════════════════════
-- delete from public.body_measurements where user_id = :'uid';
-- delete from public.cardio_sessions   where user_id = :'uid';
-- delete from public.user_routines     where user_id = :'uid';
-- delete from public.personal_records  where user_id = :'uid';
-- delete from public.workouts          where user_id = :'uid';
-- delete from public.profiles          where id      = :'uid';
-- -- y por último, el usuario: delete from auth.users where id = :'uid';
