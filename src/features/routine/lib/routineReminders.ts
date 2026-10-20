import {
  useRoutineStore,
  DAY_ORDER,
  weekStartOf,
  type DayOfWeek,
  type DayRoutine,
  type Routine,
  type WeekPlan,
} from '@features/routine/stores/routineStore';
import type { ReminderDay } from '@shared/lib/notifications';

/** JS DayOfWeek → weekday Capacitor (1=domingo … 7=sábado) */
const DAY_TO_WEEKDAY: Record<DayOfWeek, number> = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
  saturday: 7,
};

/**
 * Próxima vez que cae `weekday` (getDay(): 0 = domingo), contando desde `from`.
 *
 * Si hoy ya es ese día devuelve hoy: el aviso del lunes sigue siendo del lunes
 * cuando el lunes ha empezado. Se trabaja con la fecha local a medianoche para
 * que el cambio de hora no desplace el día.
 */
export function nextWeekdayDate(from: Date, weekday: number): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (weekday - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + delta);
  return base;
}

/**
 * Estado del que sale la resolución de un día, sin tocar el store.
 *
 * Es un retrato plano de lo que decide qué se entrena ese día: la rutina activa,
 * el catálogo, el calendario y la reorganización semanal. Sacarlo como tipo es
 * lo que permite probar la resolución con fechas futuras sin montar el store.
 */
export interface ReminderContext {
  activeRoutineId: string | null;
  routines: Routine[];
  schedule: Record<string, string>;
  lastScheduledApply: string | null;
  weekPlan: WeekPlan | null;
}

/**
 * Qué día de rutina toca en `day` si la fecha en la que sonará es `on`.
 *
 * `on` no es un adorno: los avisos se programan con días de antelación, así que
 * el día que se resuelve casi nunca es hoy. Eso obliga a tres cosas que la
 * rutina activa sola no puede dar:
 *
 * - **El calendario manda**, pero solo desde su fecha. Un bloque del 25 no
 *   decide nada el día 19.
 * - **Una entrada ya aplicada no vuelve a mandar**: si el bloque era del 18 y
 *   ya se aplicó, el 20 sigue rigiendo la rutina activa.
 * - **El plan de la semana solo vale en su semana**: la reorganización del lunes
 *   no puede reordenar el martes de la semana que viene.
 *
 * Devuelve `null` cuando no hay nada que anunciar (sin rutina, o un día que el
 * plan dejó libre), y el día con `exercises` vacío cuando es descanso: son dos
 * casos distintos y el aviso no puede tratarlos igual.
 */
export function reminderDayRoutine(
  ctx: ReminderContext,
  day: DayOfWeek,
  on: Date,
): DayRoutine | null {
  const onDay = localDayOf(on);

  // El calendario vigente para esa fecha: la entrada más reciente ya vencida y
  // que no esté sellada como aplicada (mismo criterio que `dueScheduleEntry`,
  // que trabaja contra hoy).
  let scheduled: string | null = null;
  for (const [routineId, date] of Object.entries(ctx.schedule ?? {})) {
    if (date > onDay) continue;
    if (ctx.lastScheduledApply !== null && date <= ctx.lastScheduledApply) continue;
    if (scheduled === null) {
      scheduled = routineId;
      continue;
    }
    const best = ctx.schedule[scheduled];
    if (date > best || (date === best && routineId < scheduled)) scheduled = routineId;
  }

  let routine: Routine | null = null;
  if (scheduled !== null) routine = ctx.routines.find((r) => r.id === scheduled) ?? null;
  if (!routine && ctx.activeRoutineId) {
    routine = ctx.routines.find((r) => r.id === ctx.activeRoutineId) ?? null;
  }
  if (!routine) return null;

  // El plan solo pesa si la fecha cae en su semana; si no, cada día muestra lo suyo.
  const plan = ctx.weekPlan && ctx.weekPlan.weekStart === weekStartOf(on) ? ctx.weekPlan : null;
  const source = plan ? plan.map[day] : day;
  if (!source) return null;

  return routine.days[source] ?? null;
}

/** Hoy en yyyy-mm-dd local, para comparar con las fechas del calendario. */
function localDayOf(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Días con rutina (ejercicios > 0) de la rutina activa, en formato
 * recordatorio. Vive en el feature de rutina porque lee su store: los módulos
 * de @shared (recordatorios, notificaciones) lo reciben como argumento en vez
 * de importar el store directamente.
 */
export function getRoutineReminderDays(now: Date = new Date()): ReminderDay[] {
  const store = useRoutineStore.getState();
  if (!store.getActiveRoutine()) return [];

  const ctx: ReminderContext = {
    activeRoutineId: store.activeRoutineId,
    routines: store.routines,
    schedule: store.schedule,
    lastScheduledApply: store.lastScheduledApply,
    weekPlan: store.getWeekPlan(),
  };

  // Se resuelve dia a dia contra la PROXIMA vez que cae ese dia, no contra hoy:
  // el aviso del viernes tiene que anunciar lo que de verdad se entrena el
  // viernes. Asi la reorganizacion de la semana solo toca a los dias que aun
  // faltan (incluido hoy, cuya proxima vez es hoy mismo).
  return DAY_ORDER.flatMap((day: DayOfWeek) => {
    const routine = reminderDayRoutine(ctx, day, nextWeekdayDate(now, DAY_TO_WEEKDAY[day] - 1));
    if (!routine || routine.exercises.length === 0) return [];
    return [{ weekday: DAY_TO_WEEKDAY[day], routineName: routine.name }];
  });
}
