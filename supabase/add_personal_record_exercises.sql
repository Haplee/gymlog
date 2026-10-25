-- ============================================================================
--  GymLog · Añadir los ejercicios con marca personal a las rutinas
-- ============================================================================
--
--  QUÉ HACE
--  Añade a tus rutinas los ejercicios en los que tienes marca personal
--  registrada, pero SOLO los que ya tienen sentido en esa rutina: los que
--  trabajan un grupo muscular que esa rutina ya entrena.
--
--  POR QUÉ ASÍ
--  No se añade a lo bruto. Meter un peso muerto en un día de empuje porque
--  tienes marca de peso muerto rompe la rutina. El criterio es el grupo
--  muscular: si la rutina ya entrena ese grupo, el ejercicio encaja; si no,
--  se deja fuera.
--
--  CÓMO SE USA
--  1. PASO 0 (diagnóstico) y mira el resultado. No cambia nada.
--  2. PASO 1 (el cambio). Va en transacción: o entra todo, o no entra nada.
--  3. PASO 2 (verificación).
--
--  ANTES: guarda el resultado de 0.3. Es tu copia de seguridad.
-- ============================================================================


-- ============================================================================
--  PASO 0 · DIAGNÓSTICO  (no cambia nada)
-- ============================================================================

-- 0.1 Tus marcas personales y a qué ejercicio corresponden.
select
  pr.exercise_id,
  e.name          as ejercicio,
  e.muscle_group  as grupo_muscular,
  e.equipment     as material,
  pr.weight       as marca_kg,
  pr.reps         as reps,
  pr.achieved_at  as lograda
from public.personal_records pr
join public.exercises e on e.id = pr.exercise_id
where pr.user_id = auth.uid()
order by e.muscle_group, e.name;


-- 0.2 Cada rutina y los grupos musculares que ya entrena.
--     Esto es lo que decide si un ejercicio encaja.
select
  rut.value->>'name' as rutina,
  rut.value->>'id'   as routine_id,
  (
    select array_agg(distinct ex.muscle_group)
    from jsonb_each(rut.value->'days') as dia
    cross join lateral jsonb_array_elements(
      coalesce(dia.value->'exercises', '[]'::jsonb)
    ) as ej
    join public.exercises ex on lower(ex.name) = lower(ej.value->>'name')
    where dia.value->>'name' <> 'Descanso'
      and ex.muscle_group is not null
  ) as grupos_que_entrena
from public.user_routines r
cross join lateral jsonb_array_elements(r.routine->'routines') as rut
where r.user_id = auth.uid()
order by rut.value->>'name';


-- 0.3 COPIA DE SEGURIDAD · ejecútalo y GUARDA EL RESULTADO EN UN FICHERO.
select routine as copia_de_seguridad, now() as copiada_el
from public.user_routines
where user_id = auth.uid();


-- ============================================================================
--  PASO 1 · EL CAMBIO
-- ============================================================================

begin;

-- Qué ejercicio entra en qué rutina, y en qué día.
-- Regla: el grupo muscular del ejercicio con marca tiene que ser uno de los
-- grupos que esa rutina ya entrena.
create temp table _plan as
with
grupos_por_rutina as (
  select
    rut.value->>'id'                    as routine_id,
    array_agg(distinct ex.muscle_group) as grupos
  from public.user_routines r
  cross join lateral jsonb_array_elements(r.routine->'routines') as rut
  cross join lateral jsonb_each(rut.value->'days') as dia
  cross join lateral jsonb_array_elements(
    coalesce(dia.value->'exercises', '[]'::jsonb)
  ) as ej
  join public.exercises ex on lower(ex.name) = lower(ej.value->>'name')
  where r.user_id = auth.uid()
    and dia.value->>'name' <> 'Descanso'
    and ex.muscle_group is not null
  group by rut.value->>'id'
),
ya_presentes as (
  select
    rut.value->>'id'                             as routine_id,
    array_agg(distinct lower(ej.value->>'name')) as nombres
  from public.user_routines r
  cross join lateral jsonb_array_elements(r.routine->'routines') as rut
  cross join lateral jsonb_each(rut.value->'days') as dia
  cross join lateral jsonb_array_elements(
    coalesce(dia.value->'exercises', '[]'::jsonb)
  ) as ej
  where r.user_id = auth.uid()
  group by rut.value->>'id'
),
candidatos as (
  -- Un ejercicio puede tener varias filas de marca (la tabla tiene
  -- UNIQUE (user_id, exercise_id), pero hay datos antiguos que lo incumplen:
  -- el mismo ejercicio aparece a 8 reps y a 10). Se agrupa por ejercicio y se
  -- toma la marca de más repeticiones, para no añadirlo dos veces.
  select
    g.routine_id,
    e.name          as exercise_name,
    e.muscle_group,
    greatest(5, least(15, max(pr.reps))) as reps_objetivo
  from public.personal_records pr
  join public.exercises e on e.id = pr.exercise_id
  join grupos_por_rutina g on e.muscle_group = any (g.grupos)
  left join ya_presentes yp on yp.routine_id = g.routine_id
  where pr.user_id = auth.uid()
    and e.muscle_group is not null
    and pr.weight > 0
    and pr.reps > 0
    and not (lower(e.name) = any (coalesce(yp.nombres, array[]::text[])))
  group by g.routine_id, e.name, e.muscle_group
),
-- Día destino: el primero de la semana que ya entrena ese grupo muscular.
con_dia as (
  select
    c.*,
    (
      select dia.key
      from public.user_routines r
      cross join lateral jsonb_array_elements(r.routine->'routines') as rut
      cross join lateral jsonb_each(rut.value->'days') as dia
      where r.user_id = auth.uid()
        and rut.value->>'id' = c.routine_id
        and dia.value->>'name' <> 'Descanso'
        and exists (
          select 1
          from jsonb_array_elements(
            coalesce(dia.value->'exercises', '[]'::jsonb)
          ) as ej
          join public.exercises ex on lower(ex.name) = lower(ej.value->>'name')
          where ex.muscle_group = c.muscle_group
        )
      order by case dia.key
        when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3
        when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6
        when 'sunday' then 7 else 8 end
      limit 1
    ) as dia_destino
  from candidatos c
)
select * from con_dia where dia_destino is not null;

-- 1.1 ¿Qué se va a añadir? Revísalo antes de seguir.
select routine_id, dia_destino, exercise_name, muscle_group, reps_objetivo
from _plan
order by routine_id, dia_destino, exercise_name;

-- Si la tabla saliera vacía, no hay nada que añadir y puedes parar aquí
-- (haz ROLLBACK y termina).

-- 1.2 El añadido. Se reconstruye el array de rutinas: a la rutina que toca se
--     le mete el ejercicio en su día, y las demás se dejan igual.
--     El ejercicio entra con 3 series, como el resto de la rutina.
update public.user_routines r
set
  routine = jsonb_set(
    r.routine,
    '{routines}',
    (
      select jsonb_agg(
        case
          when rut.value->>'id' = a.routine_id
            then jsonb_set(
              rut.value,
              array['days', a.dia_destino, 'exercises'],
              coalesce(rut.value->'days'->a.dia_destino->'exercises', '[]'::jsonb)
                || a.nuevos
            )
          else rut.value
        end
      )
      from jsonb_array_elements(r.routine->'routines') as rut
      left join (
        -- Un solo registro por rutina, con todos sus ejercicios nuevos juntos
        -- en un array. Sin esto, el join multiplicaría las filas del array de
        -- rutinas y lo corrompería.
        select
          routine_id,
          -- El primer día de la semana (no el alfabéticamente menor) entre
          -- los destinos del plan. min() sobre texto daría 'friday' antes que
          -- 'monday', que no es lo que queremos.
          (array_agg(
            dia_destino
            order by case dia_destino
              when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3
              when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6
              when 'sunday' then 7 else 8 end
          ))[1] as dia_destino,
          jsonb_agg(
            jsonb_build_object(
              'name', exercise_name,
              'sets', 3,
              'reps', reps_objetivo::text
            )
          ) as nuevos
        from _plan
        group by routine_id
      ) a on a.routine_id = rut.value->>'id'
    )
  ),
  updated_at = now()
where r.user_id = auth.uid();

commit;


-- ============================================================================
--  PASO 2 · VERIFICACIÓN  (no cambia nada)
-- ============================================================================

-- 2.1 Todo lo que hay ahora en cada rutina.
select
  rut.value->>'name' as rutina,
  dia.key            as dia,
  ej.value->>'name'  as ejercicio,
  ej.value->>'sets'  as series,
  ej.value->>'reps'  as reps
from public.user_routines r
cross join lateral jsonb_array_elements(r.routine->'routines') as rut
cross join lateral jsonb_each(rut.value->'days') as dia
cross join lateral jsonb_array_elements(
  coalesce(dia.value->'exercises', '[]'::jsonb)
) as ej
where r.user_id = auth.uid()
order by rut.value->>'name', dia.key, ej.value->>'name';

-- 2.2 Control: tus marcas y si su grupo muscular encaja en alguna rutina.
with grupos_por_rutina as (
  select
    rut.value->>'id'                    as routine_id,
    array_agg(distinct ex.muscle_group) as grupos
  from public.user_routines r
  cross join lateral jsonb_array_elements(r.routine->'routines') as rut
  cross join lateral jsonb_each(rut.value->'days') as dia
  cross join lateral jsonb_array_elements(
    coalesce(dia.value->'exercises', '[]'::jsonb)
  ) as ej
  join public.exercises ex on lower(ex.name) = lower(ej.value->>'name')
  where r.user_id = auth.uid()
  group by rut.value->>'id'
)
select
  e.name         as ejercicio_con_marca,
  e.muscle_group as grupo,
  case
    when exists (
      select 1 from grupos_por_rutina g where e.muscle_group = any (g.grupos)
    ) then 'encaja en alguna rutina'
    else 'NO encaja: ninguna rutina entrena ese grupo'
  end as situacion
from public.personal_records pr
join public.exercises e on e.id = pr.exercise_id
where pr.user_id = auth.uid()
order by situacion, e.muscle_group, e.name;
