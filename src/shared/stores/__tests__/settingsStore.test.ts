// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  changeLanguage: vi.fn<(language: string) => void>(),
  getSystemDark: vi.fn<() => Promise<boolean>>(),
  onSystemDarkChange: vi.fn<(listener: (dark: boolean) => void) => () => void>(),
  syncNativeTheme: vi.fn<(theme: string, chrome: string) => void>(),
  setStyle: vi.fn<(options: { style: string }) => Promise<void>>(),
  setBackgroundColor: vi.fn<(options: { color: string }) => Promise<void>>(),
  isNativePlatform: vi.fn<() => boolean>(),
}));

let systemThemeListener: ((dark: boolean) => void) | null = null;

vi.mock('@shared/lib/i18n', () => ({
  default: { changeLanguage: mocks.changeLanguage },
}));

vi.mock('@shared/lib/systemTheme', () => ({
  getSystemDark: mocks.getSystemDark,
  onSystemDarkChange: mocks.onSystemDarkChange,
  syncNativeTheme: mocks.syncNativeTheme,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: mocks.setStyle,
    setBackgroundColor: mocks.setBackgroundColor,
  },
  Style: { Light: 'LIGHT', Dark: 'DARK' },
}));

import { resolveTheme, useSettingsStore } from '../settingsStore';
import { DEFAULT_QUIET_HOURS, DEFAULT_REMINDER_TIMES } from '@shared/lib/reminderTimes';
import {
  DEFAULT_DUMBBELL_STEP_KG,
  DEFAULT_MACHINE_STEP_KG,
  STARTER_DUMBBELL_STEPS_KG,
  STARTER_MACHINE_STEPS_KG,
} from '@shared/lib/loadStep';

type SettingsState = ReturnType<typeof useSettingsStore.getState>;

const defaults: Pick<
  SettingsState,
  | 'biometricEnabled'
  | 'notificationsEnabled'
  | 'trainingReminders'
  | 'reminderTimes'
  | 'quietHours'
  | 'sound'
  | 'language'
  | 'theme'
  | 'systemDark'
  | 'unitSystem'
  | 'showWarmupSets'
  | 'restAutoStart'
  | 'restDuration'
  | 'restByExercise'
  | 'autoFillWeights'
  | 'wearablesSyncOnOpen'
  | 'keepScreenAwake'
  | 'guideSeen'
  | 'accentColor'
  | 'appIcon'
  | 'availablePlatesKg'
  | 'dumbbellStepKg'
  | 'machineStepKg'
  | 'dumbbellStepsKg'
  | 'machineStepsKg'
> = {
  biometricEnabled: false,
  notificationsEnabled: true,
  trainingReminders: true,
  reminderTimes: DEFAULT_REMINDER_TIMES,
  quietHours: DEFAULT_QUIET_HOURS,
  sound: true,
  language: 'es',
  theme: 'dark',
  systemDark: false,
  unitSystem: 'kg',
  showWarmupSets: true,
  restAutoStart: false,
  restDuration: 90,
  restByExercise: true,
  autoFillWeights: true,
  wearablesSyncOnOpen: true,
  keepScreenAwake: true,
  guideSeen: false,
  accentColor: 'yellow',
  appIcon: 'yellow',
  availablePlatesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
  dumbbellStepKg: DEFAULT_DUMBBELL_STEP_KG,
  machineStepKg: DEFAULT_MACHINE_STEP_KG,
  dumbbellStepsKg: [...STARTER_DUMBBELL_STEPS_KG],
  machineStepsKg: [...STARTER_MACHINE_STEPS_KG],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useSettingsStore.persist.clearStorage();
  useSettingsStore.setState(defaults);
  document.documentElement.className = '';
  document.documentElement.style.cssText = '';
  document.body.style.backgroundColor = '';
  document.querySelector('meta[name="theme-color"]')?.remove();

  mocks.getSystemDark.mockResolvedValue(true);
  mocks.onSystemDarkChange.mockImplementation((listener) => {
    systemThemeListener = listener;
    return () => undefined;
  });
  mocks.isNativePlatform.mockReturnValue(false);
  mocks.setStyle.mockResolvedValue(undefined);
  mocks.setBackgroundColor.mockResolvedValue(undefined);
  systemThemeListener = null;
});

describe('settingsStore: tema y persistencia', () => {
  it('resuelve el tema del sistema solo cuando el tema lo delega', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('espeja el estado de notificaciones en localStorage', () => {
    const state = useSettingsStore.getState();

    state.setNotificationsEnabled(false);
    expect(localStorage.getItem('notif_disabled')).toBe('true');

    state.setNotificationsEnabled(true);
    expect(localStorage.getItem('notif_disabled')).toBeNull();
  });

  it('persiste los cambios y los vuelve a cargar', async () => {
    useSettingsStore.getState().setRestDuration(135);
    useSettingsStore.getState().setUnitSystem('lb');

    const stored = JSON.parse(localStorage.getItem('gymlog-settings') ?? '{}') as {
      state: { restDuration: number; unitSystem: string };
    };
    expect(stored.state.restDuration).toBe(135);
    expect(stored.state.unitSystem).toBe('lb');

    useSettingsStore.getState().setRestDuration(60);
    localStorage.setItem('gymlog-settings', JSON.stringify(stored));
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().restDuration).toBe(135);
    expect(useSettingsStore.getState().unitSystem).toBe('lb');
  });

  it('migra horarios, quiet hours y tablas ausentes o inválidos', async () => {
    localStorage.setItem(
      'gymlog-settings',
      JSON.stringify({
        state: {
          notificationsEnabled: false,
          reminderTimes: {
            routine: { hour: 99, minute: -1 },
            streak: { hour: 7, minute: 5 },
          },
          quietHours: { enabled: true, start: { hour: 99, minute: 99 } },
          dumbbellStepsKg: [20, 5, 20, 0, -2],
        },
        version: 0,
      }),
    );

    await useSettingsStore.persist.rehydrate();

    const state = useSettingsStore.getState();
    expect(state.reminderTimes.routine).toEqual({ hour: 23, minute: 0 });
    expect(state.reminderTimes.streak).toEqual({ hour: 7, minute: 5 });
    expect(state.reminderTimes.summary).toEqual(DEFAULT_REMINDER_TIMES.summary);
    expect(state.quietHours).toEqual({
      enabled: true,
      start: { hour: 23, minute: 59 },
      end: { hour: 7, minute: 0 },
    });
    expect(state.dumbbellStepsKg).toEqual([5, 20]);
    expect(state.machineStepsKg).toEqual([]);
    expect(localStorage.getItem('notif_disabled')).toBe('true');
  });

  it('aplica el tema, el acento y el color de chrome al documento', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);

    useSettingsStore.getState().setTheme('light');
    useSettingsStore.getState().setAccentColor('cyan');

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--interactive-primary')).toBe(
      '#05628a',
    );
    expect(meta.getAttribute('content')).toBe('#e9ebe8');
    expect(document.body.style.backgroundColor).toBe('rgb(233, 235, 232)');
  });

  it('sincroniza el tema del sistema y responde a cambios posteriores', async () => {
    useSettingsStore.getState().setTheme('system');

    await vi.waitFor(() => expect(useSettingsStore.getState().systemDark).toBe(true));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    systemThemeListener?.(false);
    expect(useSettingsStore.getState().systemDark).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('sincroniza el tema nativo y la barra de estado', async () => {
    mocks.isNativePlatform.mockReturnValue(true);

    useSettingsStore.getState().applyTheme();

    await vi.waitFor(() => expect(mocks.syncNativeTheme).toHaveBeenCalledWith('dark', '#0a0a0b'));
    await vi.waitFor(() => expect(mocks.setStyle).toHaveBeenCalledWith({ style: 'DARK' }));
    expect(mocks.setBackgroundColor).toHaveBeenCalledWith({ color: '#0a0a0b' });
  });

  it('cambia el idioma mediante el módulo de traducción', async () => {
    useSettingsStore.getState().setLanguage('en');

    expect(useSettingsStore.getState().language).toBe('en');
    await vi.waitFor(() => expect(mocks.changeLanguage).toHaveBeenCalledWith('en'));
  });
});

describe('settingsStore: preferencias y material del gimnasio', () => {
  it('actualiza las preferencias booleanas y numéricas', () => {
    const state = useSettingsStore.getState();

    state.setBiometricEnabled(true);
    state.setTrainingReminders(false);
    state.setSound(false);
    state.setUnitSystem('lb');
    state.setShowWarmupSets(false);
    state.setRestAutoStart(true);
    state.setRestDuration(120);
    state.setRestByExercise(false);
    state.setAutoFillWeights(false);
    state.setWearablesSyncOnOpen(false);
    state.setKeepScreenAwake(false);
    state.setGuideSeen(true);
    state.setAppIcon('blue');
    state.setSystemDark(true);

    const updated = useSettingsStore.getState();
    expect(updated.biometricEnabled).toBe(true);
    expect(updated.trainingReminders).toBe(false);
    expect(updated.sound).toBe(false);
    expect(updated.unitSystem).toBe('lb');
    expect(updated.showWarmupSets).toBe(false);
    expect(updated.restAutoStart).toBe(true);
    expect(updated.restDuration).toBe(120);
    expect(updated.restByExercise).toBe(false);
    expect(updated.autoFillWeights).toBe(false);
    expect(updated.wearablesSyncOnOpen).toBe(false);
    expect(updated.keepScreenAwake).toBe(false);
    expect(updated.guideSeen).toBe(true);
    expect(updated.appIcon).toBe('blue');
    expect(updated.systemDark).toBe(true);
  });

  it('normaliza los horarios de los tres avisos', () => {
    const state = useSettingsStore.getState();

    state.setRoutineReminderTime({ hour: 99, minute: 70 });
    state.setStreakReminderTime({ hour: -1, minute: 5 });
    state.setSummaryReminderTime({ weekday: 99, hour: 25, minute: -2 });

    expect(useSettingsStore.getState().reminderTimes).toEqual({
      routine: { hour: 23, minute: 59 },
      streak: { hour: 0, minute: 5 },
      summary: { weekday: 7, hour: 23, minute: 0 },
    });
  });

  it('fusiona y normaliza el rango de silencio', () => {
    useSettingsStore.getState().setQuietHours({ enabled: true, start: { hour: 22, minute: 15 } });

    expect(useSettingsStore.getState().quietHours).toEqual({
      enabled: true,
      start: { hour: 22, minute: 15 },
      end: { hour: 7, minute: 0 },
    });
  });

  it('ordena las placas y elimina duplicados', () => {
    useSettingsStore.getState().setAvailablePlatesKg([20, 25, 20, 10]);

    expect(useSettingsStore.getState().availablePlatesKg).toEqual([25, 20, 10]);
  });

  it('rechaza saltos inválidos y conserva los válidos', () => {
    const state = useSettingsStore.getState();

    state.setDumbbellStepKg(2.5);
    state.setDumbbellStepKg(0);
    state.setDumbbellStepKg(Number.NaN);
    state.setMachineStepKg(5);
    state.setMachineStepKg(-1);

    expect(useSettingsStore.getState().dumbbellStepKg).toBe(2.5);
    expect(useSettingsStore.getState().machineStepKg).toBe(5);
  });

  it('añade y quita peldaños sin duplicados ni valores imposibles', () => {
    const state = useSettingsStore.getState();

    state.addEquipmentStep('dumbbell', 3);
    state.addEquipmentStep('dumbbell', 3);
    state.addEquipmentStep('dumbbell', 0);
    state.addEquipmentStep('machine', 5);
    state.removeEquipmentStep('dumbbell', 3);
    state.removeEquipmentStep('machine', 5);

    expect(useSettingsStore.getState().dumbbellStepsKg).not.toContain(3);
    expect(useSettingsStore.getState().machineStepsKg).not.toContain(5);
  });
});
