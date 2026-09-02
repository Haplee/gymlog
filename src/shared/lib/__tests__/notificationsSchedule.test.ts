import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Forma mínima de lo que el módulo pasa al plugin, para que el mock quede
    tipado y el typecheck pueda leer `mock.calls[n][0].notifications`. */
interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  schedule: {
    at?: Date;
    every?: string;
    repeats?: boolean;
    on?: { weekday?: number; hour?: number; minute?: number };
  };
}
type ScheduleArg = { notifications: ScheduledNotification[] };

const cap = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => true) }));
const plugin = vi.hoisted(() => ({
  cancel: vi.fn(async (_opts: { notifications: { id: number }[] }) => undefined),
  schedule: vi.fn(async (_opts: { notifications: Record<string, unknown>[] }) => undefined),
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  createChannel: vi.fn(async () => undefined),
  addListener: vi.fn(async () => ({ remove: vi.fn() })),
}));

/** Argumento de la llamada n a `schedule`, ya tipado. */
const scheduleArg = (n: number): ScheduleArg =>
  plugin.schedule.mock.calls[n]![0] as unknown as ScheduleArg;

vi.mock('@capacitor/core', () => ({ Capacitor: cap }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@shared/lib/devtools', () => ({ devError: vi.fn(), devLog: vi.fn() }));
vi.mock('@shared/stores/notificationsStore', () => ({
  useNotificationsStore: { getState: () => ({ add: vi.fn() }) },
}));

/* La config de vitest no fija environment (corre en Node): el módulo lee
   localStorage para el flag `notif_disabled`, así que se stubea a mano. */
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

const { syncRoutineReminders, notify } = await import('@shared/lib/notifications');
const { useSettingsStore } = await import('@shared/stores/settingsStore');
const { DEFAULT_REMINDER_TIMES } = await import('@shared/lib/reminderTimes');

const DAYS = [
  { weekday: 2, routineName: 'Push' },
  { weekday: 5, routineName: 'Pull' },
];

beforeEach(() => {
  vi.clearAllMocks();
  cap.isNativePlatform.mockReturnValue(true);
  plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
  localStorage.clear();
  // Las horas son estado compartido entre tests: sin esto, el que las cambia
  // contamina a los siguientes.
  useSettingsStore.setState({ reminderTimes: DEFAULT_REMINDER_TIMES });
});

describe('syncRoutineReminders', () => {
  it('NO cancela los recordatorios si no va a poder reprogramarlos', async () => {
    // Regresión: antes cancelaba los 7 ids y solo después comprobaba el permiso,
    // así que un permiso revocado dejaba al usuario sin ningún recordatorio.
    plugin.checkPermissions.mockResolvedValue({ display: 'denied' });
    await syncRoutineReminders(DAYS);
    expect(plugin.cancel).not.toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('cancela y reprograma cuando hay permiso', async () => {
    await syncRoutineReminders(DAYS);
    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(plugin.schedule).toHaveBeenCalledTimes(1);
    expect(scheduleArg(0).notifications).toHaveLength(2);
  });

  it('con la lista vacía sí cancela: es el camino de desactivar', async () => {
    await syncRoutineReminders([]);
    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('el día ya entrenado no se programa: decirle "hoy toca" a quien ya entrenó es ruido', async () => {
    // Con `on` no se puede saltar una repetición suelta, así que el día se
    // omite entero y vuelve en la siguiente reconciliación.
    const todayWeekday = new Date().getDay() + 1;
    const otroDia = (todayWeekday % 7) + 1;

    await syncRoutineReminders(
      [
        { weekday: todayWeekday, routineName: 'Hoy' },
        { weekday: otroDia, routineName: 'Otro' },
      ],
      true,
    );

    const programados = scheduleArg(0).notifications;
    expect(programados).toHaveLength(1);
    expect(programados[0]!.schedule.on?.weekday).toBe(otroDia);
  });

  it('programa con `on` y no con una fecha absoluta', async () => {
    // `on` declara la intención civil ("los martes a las 18:30"); una fecha
    // absoluta habría que recalcularla y arrastra la duda del cambio de hora.
    await syncRoutineReminders(DAYS);
    for (const n of scheduleArg(0).notifications) {
      expect(n.schedule.on).toBeDefined();
      expect(n.schedule.at).toBeUndefined();
      expect(n.schedule.repeats).toBe(true);
    }
  });

  it('usa la hora elegida por el usuario, no una constante', async () => {
    useSettingsStore.getState().setRoutineReminderTime({ hour: 7, minute: 5 });
    await syncRoutineReminders(DAYS);

    const primera = scheduleArg(0).notifications[0]!.schedule.on;
    expect(primera).toMatchObject({ hour: 7, minute: 5 });

    // El weekday sigue siendo el del día de rutina, no el de hoy.
    expect(scheduleArg(0).notifications[0]!.schedule.on?.weekday).toBe(DAYS[0]!.weekday);
  });

  it('por defecto mantiene las 18:30 que había a fuego', async () => {
    await syncRoutineReminders(DAYS);
    expect(scheduleArg(0).notifications[0]!.schedule.on).toMatchObject({ hour: 18, minute: 30 });
  });
});

describe('notify — ids de avisos inmediatos', () => {
  it('dos avisos seguidos usan ids distintos y no se pisan', async () => {
    // Regresión: ambos usaban NOTIF_IDS.GENERIC, así que el segundo reemplazaba
    // al primero y el usuario solo veía uno.
    await notify('Uno', { body: 'a' });
    await notify('Dos', { body: 'b' });
    expect(scheduleArg(0).notifications[0]!.id).not.toBe(scheduleArg(1).notifications[0]!.id);
  });

  it('respeta un id explícito cuando el llamador lo indica', async () => {
    await notify('Fijo', { body: 'x', id: 123456 });
    expect(scheduleArg(0).notifications[0]!.id).toBe(123456);
  });
});
