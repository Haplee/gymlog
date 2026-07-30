import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import { devError } from '@shared/lib/devtools';

/**
 * Alarma del temporizador de descanso: tono repetitivo en bucle que solo para
 * con una acción explícita del usuario (a diferencia del pitido único anterior,
 * que se perdía si estabas distraído).
 *
 * El sonido se sintetiza con Web Audio (sin assets ni descargas) y se re-arma
 * por ciclos: cada ciclo programa sus osciladores con `start/stop` absolutos, y
 * un timer encadena el siguiente. Así no queda ningún oscilador sonando si el
 * proceso muere de forma abrupta.
 *
 * Fuera de foco (app en background / pantalla bloqueada) los WebView suspenden
 * el AudioContext: ese caso lo cubre la notificación local nativa programada en
 * `scheduleTimerNotification` (canal `timer`, importancia máxima, con sonido y
 * vibración del sistema). Al volver a foreground, si la alarma sigue activa,
 * `resumeIfRinging` reanuda el tono.
 */

/** Duración de un ciclo: 3 pitidos + silencio. */
const CYCLE_MS = 1500;
/** Corte de seguridad: si nadie la para, deja de sonar tras 5 minutos. */
const MAX_RINGING_MS = 5 * 60 * 1000;

interface ChimeNote {
  freq: number;
  /** Desplazamiento desde el inicio del chime, en segundos. */
  at: number;
  dur: number;
  gain: number;
}

/** Confirmación de entreno guardado: dos notas ascendentes. */
const SUCCESS_CHIME: readonly ChimeNote[] = [
  { freq: 660, at: 0, dur: 0.15, gain: 0.5 },
  { freq: 880, at: 0.12, dur: 0.2, gain: 0.5 },
];

/** Prueba del toggle de sonido en Ajustes: tres notas, algo más brillante. */
const SETTINGS_CHIME: readonly ChimeNote[] = [
  { freq: 1200, at: 0, dur: 0.25, gain: 0.9 },
  { freq: 1500, at: 0.15, dur: 0.25, gain: 0.9 },
  { freq: 1800, at: 0.3, dur: 0.35, gain: 0.9 },
];

/** Margen tras la última nota antes de suspender el contexto. */
const CHIME_TAIL_MS = 120;

const BEEP_OFFSETS = [0, 0.22, 0.44];
const BEEP_FREQS = [880, 1046, 1318];
const BEEP_DURATION = 0.16;
const BEEP_GAIN = 0.45;

let ctx: AudioContext | null = null;
let cycleTimer: ReturnType<typeof setInterval> | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
let hapticTimer: ReturnType<typeof setInterval> | null = null;
let ringing = false;
/** Nodos del ciclo en curso: se paran uno a uno al silenciar. */
let liveNodes: OscillatorNode[] = [];

export const isAlarmRinging = (): boolean => ringing;

function getContext(): AudioContext | null {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx || ctx.state === 'closed') ctx = new AudioCtx();
  return ctx;
}

/** Programa un ciclo de pitidos a partir de `now`. */
function playCycle(): void {
  const audio = getContext();
  if (!audio) return;

  // Tras un gesto del usuario o al volver de background el contexto puede estar
  // suspendido: sin este resume no sonaría nada.
  if (audio.state === 'suspended') void audio.resume();

  const t0 = audio.currentTime;

  BEEP_OFFSETS.forEach((offset, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);

    osc.type = 'square';
    osc.frequency.value = BEEP_FREQS[i];

    const start = t0 + offset;
    gain.gain.setValueAtTime(BEEP_GAIN, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + BEEP_DURATION);

    osc.start(start);
    osc.stop(start + BEEP_DURATION);
    osc.onended = () => {
      liveNodes = liveNodes.filter((n) => n !== osc);
    };
    liveNodes.push(osc);
  });
}

/** Arranca la alarma en bucle. Idempotente: llamarla dos veces no la duplica. */
export function startAlarm(options: { sound?: boolean; haptics?: boolean } = {}): void {
  const { sound = true, haptics = true } = options;
  if (ringing) return;
  ringing = true;

  if (sound) {
    try {
      playCycle();
      cycleTimer = setInterval(playCycle, CYCLE_MS);
    } catch (e) {
      devError('[Alarm] No se pudo iniciar el audio:', e);
    }
  }

  if (haptics && Capacitor.isNativePlatform()) {
    const buzz = () => {
      void Haptics.vibrate({ duration: 600 }).catch(() => {});
    };
    buzz();
    hapticTimer = setInterval(buzz, CYCLE_MS);
  }

  safetyTimer = setTimeout(stopAlarm, MAX_RINGING_MS);
}

/** Silencia la alarma y libera todos los recursos de audio. */
export function stopAlarm(): void {
  ringing = false;

  if (cycleTimer !== null) clearInterval(cycleTimer);
  if (hapticTimer !== null) clearInterval(hapticTimer);
  if (safetyTimer !== null) clearTimeout(safetyTimer);
  cycleTimer = null;
  hapticTimer = null;
  safetyTimer = null;

  // Corta en seco los pitidos ya programados del ciclo en curso.
  for (const osc of liveNodes) {
    try {
      osc.stop();
    } catch {
      // ya parado
    }
  }
  liveNodes = [];

  // Suspender (no cerrar): reabrir un AudioContext es caro y en móvil puede
  // fallar; suspendido no consume CPU y se reanuda al instante.
  if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
}

/**
 * Reanuda el tono al volver a foreground si la alarma seguía activa (el WebView
 * suspende el AudioContext en background y los pitidos quedan mudos).
 */
export function resumeIfRinging(): void {
  if (!ringing || !ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/**
 * Toca una secuencia corta de notas y suspende el contexto al acabar.
 *
 * Los chimes viven en este módulo para compartir su `AudioContext` único: antes
 * cada sitio que necesitaba un pitido creaba uno nuevo y no lo cerraba jamás. El
 * WebView topa en ~6 contextos simultáneos, así que el sonido acababa muriendo
 * en silencio, y hasta entonces cada contexto vivo mantenía despierto el
 * pipeline de audio del dispositivo.
 */
function playChime(notes: readonly ChimeNote[]): void {
  const audio = getContext();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();

  const t0 = audio.currentTime;

  for (const note of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);

    osc.type = 'square';
    osc.frequency.value = note.freq;

    const start = t0 + note.at;
    gain.gain.setValueAtTime(note.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + note.dur);

    osc.start(start);
    osc.stop(start + note.dur);
  }

  // Un AudioContext en `running` mantiene vivo el reloj de audio: en cuanto el
  // chime acaba, se suspende (salvo que la alarma lo esté usando).
  const last = notes[notes.length - 1];
  const tailMs = last ? (last.at + last.dur) * 1000 + CHIME_TAIL_MS : CHIME_TAIL_MS;
  window.setTimeout(() => {
    if (!ringing && ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
  }, tailMs);
}

/** Confirmación de entreno guardado. */
export function playSuccessChime(): void {
  playChime(SUCCESS_CHIME);
}

/** Prueba del sonido al activar el toggle en Ajustes. */
export function playSettingsChime(): void {
  playChime(SETTINGS_CHIME);
}
