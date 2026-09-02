/* ── Horarios de los avisos ─────────────────────────────────────────
   Hasta ahora las horas eran constantes de módulo en notifications.ts, así que
   quien entrena a las siete de la mañana recibía el recordatorio a las 18:30 y
   no tenía dónde cambiarlo. Aquí viven el modelo, sus defectos y la validación;
   el store solo los persiste y notifications.ts solo los lee.

   Todo son funciones puras a propósito: es la parte que sí puede cubrir un test
   sin un dispositivo delante. */

/** Hora local de un aviso, en formato 24h. */
export interface ReminderTime {
  hour: number;
  minute: number;
}

/** Aviso semanal: además de la hora, qué día. */
export interface WeeklyReminderTime extends ReminderTime {
  /** Convención Capacitor: 1=domingo, 2=lunes … 7=sábado. */
  weekday: number;
}

export interface ReminderTimes {
  /** Recordatorio de la rutina del día. */
  routine: ReminderTime;
  /** Alerta de racha en peligro. */
  streak: ReminderTime;
  /** Resumen de la semana. */
  summary: WeeklyReminderTime;
}

/** Rango en el que no se emite ningún aviso. Puede cruzar la medianoche. */
export interface QuietHours {
  enabled: boolean;
  start: ReminderTime;
  end: ReminderTime;
}

/** Los valores que estaban escritos a fuego en notifications.ts. Se conservan
    como defecto para que quien no toque nada no note ningún cambio. */
export const DEFAULT_REMINDER_TIMES: ReminderTimes = {
  routine: { hour: 18, minute: 30 },
  streak: { hour: 20, minute: 0 },
  summary: { weekday: 2, hour: 9, minute: 0 }, // lunes
};

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: { hour: 23, minute: 0 },
  end: { hour: 7, minute: 0 },
};

const clampInt = (value: number, min: number, max: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

/**
 * Normaliza una hora recibida de la UI o de un store persistido antiguo.
 * Nunca lanza: una hora inválida cae al valor por defecto en vez de dejar el
 * aviso sin programar, que es un fallo silencioso.
 */
export function normalizeTime(value: Partial<ReminderTime> | undefined, fallback: ReminderTime) {
  return {
    hour: clampInt(value?.hour ?? NaN, 0, 23, fallback.hour),
    minute: clampInt(value?.minute ?? NaN, 0, 59, fallback.minute),
  };
}

export function normalizeWeekly(
  value: Partial<WeeklyReminderTime> | undefined,
  fallback: WeeklyReminderTime,
): WeeklyReminderTime {
  return {
    ...normalizeTime(value, fallback),
    weekday: clampInt(value?.weekday ?? NaN, 1, 7, fallback.weekday),
  };
}

/** Minutos desde medianoche. Sirve para comparar horas sin construir fechas. */
export const toMinutes = (t: ReminderTime): number => t.hour * 60 + t.minute;

/** "18:30" para pintar en Ajustes y en los logs. */
export const formatTime = (t: ReminderTime): string =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

/**
 * ¿Cae `at` dentro del rango de silencio?
 *
 * El rango cruza la medianoche con normalidad (23:00 → 07:00), que es
 * justamente el caso de uso: comparar `inicio <= t < fin` a secas daría
 * siempre falso ahí. Los extremos: el inicio entra en el silencio, el final no
 * —a las 07:00 ya se puede avisar—.
 */
export function isWithinQuietHours(quiet: QuietHours, at: Date = new Date()): boolean {
  if (!quiet.enabled) return false;

  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  const now = at.getHours() * 60 + at.getMinutes();

  // Un rango de ancho cero no silencia nada: si silenciara 24 h, el usuario se
  // quedaría sin avisos sin haberlo pedido.
  if (start === end) return false;

  return start < end ? now >= start && now < end : now >= start || now < end; // cruza la medianoche
}
