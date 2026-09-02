import { Capacitor, registerPlugin } from '@capacitor/core';
import { devError } from './devtools';

/** Lo que los widgets de la pantalla de inicio necesitan saber. */
export interface WidgetPayload {
  streak: number;
  /** Ejercicios del último entreno, ya resumidos. */
  lastLabel: string;
  accent?: string;
  fg?: string;
  /**
   * Plan de la semana: 7 casillas con el nombre de la rutina de cada día
   * (cadena vacía = descanso), indexadas por la convención de Capacitor
   * (posición 0 = domingo … posición 6 = sábado).
   *
   * Viaja entero en vez de resuelto a "lo de hoy" a propósito: es lo que
   * permite al widget cambiar de día por su cuenta al cruzar la medianoche. Si
   * se mandara ya resuelto, seguiría mostrando lo de ayer hasta que el usuario
   * volviera a abrir la app.
   */
  weekPlan?: string[];
  trainedToday?: boolean;
}

interface WidgetBridgePlugin {
  update(opts: WidgetPayload): Promise<{ ok: boolean }>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

/** Casilla vacía para los días sin rutina. */
const EMPTY_WEEK: string[] = ['', '', '', '', '', '', ''];

/**
 * Convierte los días de rutina (weekday 1..7) en el array de 7 casillas que
 * espera el widget. Un weekday fuera de rango se ignora en vez de desplazar el
 * resto de la semana.
 */
export function buildWeekPlan(days: { weekday: number; routineName: string }[]): string[] {
  const plan = [...EMPTY_WEEK];
  for (const { weekday, routineName } of days) {
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) continue;
    plan[weekday - 1] = routineName;
  }
  return plan;
}

/**
 * Envía el estado a los widgets Android.
 * No-op en web/iOS o si el plugin nativo no está disponible.
 */
export async function updateWidget(payload: WidgetPayload): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.update(payload);
  } catch (err) {
    // plugin no disponible (p.ej. iOS) — no romper, pero dejar rastro en dev.
    devError('[widget] update failed:', err);
  }
}
