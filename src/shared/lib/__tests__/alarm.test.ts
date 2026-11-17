// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn<() => boolean>(),
  vibrate: vi.fn<(options: { duration: number }) => Promise<void>>(),
  devError: vi.fn<(...args: unknown[]) => void>(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: { vibrate: mocks.vibrate },
}));

vi.mock('@shared/lib/devtools', () => ({
  devError: mocks.devError,
}));

interface FakeOscillator {
  type: string;
  frequency: { value: number };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  throwOnStop: boolean;
}

interface FakeGain {
  connect: ReturnType<typeof vi.fn>;
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {};
  oscillators: FakeOscillator[] = [];
  throwOnCreateOscillator = false;

  resume = vi.fn(async () => {
    this.state = 'running';
  });

  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });

  createOscillator = vi.fn(() => {
    if (this.throwOnCreateOscillator) throw new Error('Web Audio no disponible');

    const oscillator: FakeOscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(() => {
        if (oscillator.throwOnStop) throw new Error('ya estaba detenido');
      }),
      onended: null,
      throwOnStop: false,
    };
    this.oscillators.push(oscillator);
    return oscillator;
  });

  createGain = vi.fn((): FakeGain => ({
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  }));
}

let audioContexts: FakeAudioContext[] = [];
let audioContextState: AudioContextState = 'running';
let throwOnCreateOscillator = false;

class TrackingAudioContext extends FakeAudioContext {
  constructor() {
    super();
    this.state = audioContextState;
    this.throwOnCreateOscillator = throwOnCreateOscillator;
    audioContexts.push(this);
  }
}

function installAudioContext(): void {
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: TrackingAudioContext,
  });
  Object.defineProperty(window, 'webkitAudioContext', {
    configurable: true,
    writable: true,
    value: TrackingAudioContext,
  });
}

async function loadAlarm() {
  vi.resetModules();
  return import('../alarm');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  audioContexts = [];
  audioContextState = 'running';
  throwOnCreateOscillator = false;
  installAudioContext();
  mocks.isNativePlatform.mockReturnValue(true);
  mocks.vibrate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(window, 'webkitAudioContext', {
    configurable: true,
    writable: true,
    value: undefined,
  });
});

describe('alarm', () => {
  it('inicia un ciclo de tres notas, vibra y no se duplica', async () => {
    const { startAlarm, stopAlarm } = await loadAlarm();

    startAlarm();

    expect(audioContexts).toHaveLength(1);
    expect(audioContexts[0]?.createOscillator).toHaveBeenCalledTimes(3);
    expect(mocks.vibrate).toHaveBeenCalledWith({ duration: 600 });

    startAlarm();
    expect(audioContexts[0]?.createOscillator).toHaveBeenCalledTimes(3);

    stopAlarm();
  });

  it('encadena otro ciclo y libera los osciladores al parar', async () => {
    const { startAlarm, stopAlarm } = await loadAlarm();
    startAlarm();

    const firstOscillator = audioContexts[0]?.oscillators[0];
    firstOscillator?.onended?.();
    vi.advanceTimersByTime(1500);

    expect(audioContexts[0]?.createOscillator).toHaveBeenCalledTimes(6);
    expect(audioContexts[0]?.suspend).not.toHaveBeenCalled();

    stopAlarm();
    expect(audioContexts[0]?.suspend).toHaveBeenCalledOnce();
    expect(
      audioContexts[0]?.oscillators.every((oscillator) => oscillator.stop.mock.calls.length > 0),
    ).toBe(true);
  });

  it('tolera que un oscilador ya esté detenido', async () => {
    const { startAlarm, stopAlarm } = await loadAlarm();
    startAlarm();
    const oscillator = audioContexts[0]?.oscillators[0];
    if (oscillator) oscillator.throwOnStop = true;

    expect(() => stopAlarm()).not.toThrow();
  });

  it('se detiene automáticamente al alcanzar el corte de seguridad', async () => {
    const { startAlarm } = await loadAlarm();
    startAlarm({ sound: false });

    expect(mocks.vibrate).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(mocks.vibrate).toHaveBeenCalledTimes(201);

    startAlarm({ sound: false });
    expect(mocks.vibrate).toHaveBeenCalledTimes(202);
  });

  it('registra un error si Web Audio falla', async () => {
    throwOnCreateOscillator = true;
    const { startAlarm, stopAlarm } = await loadAlarm();

    startAlarm();

    expect(mocks.devError).toHaveBeenCalledWith(
      '[Alarm] No se pudo iniciar el audio:',
      expect.any(Error),
    );
    stopAlarm();
  });

  it('funciona sin AudioContext disponible', async () => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const { startAlarm, stopAlarm } = await loadAlarm();

    expect(() => startAlarm()).not.toThrow();
    expect(mocks.devError).not.toHaveBeenCalled();
    stopAlarm();
  });

  it('acepta el constructor webkit cuando AudioContext no existe', async () => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const { startAlarm, stopAlarm } = await loadAlarm();

    startAlarm();

    expect(audioContexts).toHaveLength(1);
    expect(audioContexts[0]?.createOscillator).toHaveBeenCalledTimes(3);
    stopAlarm();
  });

  it('solo vibra cuando la plataforma es nativa', async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const { startAlarm, stopAlarm } = await loadAlarm();

    startAlarm();

    expect(mocks.vibrate).not.toHaveBeenCalled();
    stopAlarm();
  });

  it('puede vibrar sin sonido y tolera un fallo de haptics', async () => {
    mocks.vibrate.mockRejectedValueOnce(new Error('sin vibrador'));
    const { startAlarm, stopAlarm } = await loadAlarm();

    expect(() => startAlarm({ sound: false })).not.toThrow();
    expect(audioContexts).toHaveLength(0);
    expect(mocks.vibrate).toHaveBeenCalledWith({ duration: 600 });
    stopAlarm();
  });

  it('reanuda el tono cuando la alarma sigue activa', async () => {
    const { startAlarm, stopAlarm, resumeIfRinging } = await loadAlarm();
    startAlarm();
    const context = audioContexts[0];
    if (context) context.state = 'suspended';

    resumeIfRinging();

    expect(context?.resume).toHaveBeenCalledOnce();
    stopAlarm();
  });

  it('no reanuda una alarma que ya está detenida', async () => {
    const { resumeIfRinging } = await loadAlarm();

    resumeIfRinging();

    expect(audioContexts).toHaveLength(0);
  });

  it('reproduce los chimes de éxito y de ajustes y suspende al terminar', async () => {
    audioContextState = 'suspended';
    const { playSuccessChime, playSettingsChime } = await loadAlarm();

    playSuccessChime();
    const context = audioContexts[0];
    expect(context?.createOscillator).toHaveBeenCalledTimes(2);
    expect(context?.resume).toHaveBeenCalledOnce();

    playSettingsChime();
    expect(context?.createOscillator).toHaveBeenCalledTimes(5);
    expect(context?.oscillators.map((oscillator) => oscillator.frequency.value)).toEqual([
      660, 880, 1200, 1500, 1800,
    ]);

    vi.advanceTimersByTime(1000);
    expect(context?.suspend).toHaveBeenCalledOnce();
  });

  it('crea un contexto nuevo si el anterior está cerrado', async () => {
    const { startAlarm, stopAlarm } = await loadAlarm();
    startAlarm();
    const firstContext = audioContexts[0];
    if (firstContext) firstContext.state = 'closed';
    stopAlarm();

    startAlarm();

    expect(audioContexts).toHaveLength(2);
    stopAlarm();
  });
});
