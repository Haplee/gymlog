import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { devError } from '@shared/lib/devtools';

/**
 * Mantiene la pantalla encendida mientras dura una sesión de entrenamiento.
 *
 * El problema que resuelve: entre serie y serie el móvil se bloquea solo, y al
 * volver hay que desbloquearlo y buscar por dónde ibas. Con las manos llenas de
 * magnesio eso es exactamente la fricción que hace que la gente deje de
 * registrar las series.
 *
 * **El navegador suelta el bloqueo por su cuenta** en cuanto el documento deja
 * de ser visible (cambio de pestaña, app al segundo plano, pantalla bloqueada a
 * mano). Una petición única funciona una sola vez y luego muere en silencio, así
 * que aquí se guarda la *intención* (`queremos`) y se vuelve a pedir el bloqueo
 * cada vez que la app recupera visibilidad.
 *
 * Se escuchan dos señales, igual que en `useVisibilityPausedInterval` y por el
 * mismo motivo: en el WebView de Android `visibilitychange` no siempre llega al
 * pausarse la Activity, y sin el `appStateChange` de Capacitor volveríamos del
 * segundo plano sin bloqueo y sin enterarnos.
 */

/** ¿Soporta este dispositivo la Screen Wake Lock API? */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Estado a nivel de módulo, no del hook.
 *
 * Va fuera a propósito: si dos pantallas montan el hook a la vez (la sesión de
 * rutina y el temporizador de descanso, por ejemplo), un estado por componente
 * pediría dos bloqueos y el primero en desmontarse apagaría la pantalla con el
 * entrenamiento todavía en marcha.
 */
let sentinel: WakeLockSentinel | null = null;
/** ¿Queremos la pantalla encendida ahora mismo? */
let queremos = false;
/** Hay una petición en vuelo: no apilar una segunda. */
let pidiendo = false;
/** Cuántos consumidores tienen el bloqueo pedido (ver nota de arriba). */
let consumidores = 0;

async function pedirBloqueo(): Promise<void> {
  if (!queremos || sentinel || pidiendo || !isWakeLockSupported()) return;
  // request() rechaza sobre un documento oculto; no es un error, es que no toca.
  if (document.visibilityState !== 'visible') return;

  pidiendo = true;
  try {
    const nuevo = await navigator.wakeLock.request('screen');
    // Puede haberse soltado mientras esperábamos al await.
    if (!queremos) {
      void nuevo.release().catch(() => {});
      return;
    }
    sentinel = nuevo;
    nuevo.addEventListener('release', () => {
      if (sentinel === nuevo) sentinel = null;
    });
  } catch (error) {
    // iOS lo rechaza en modo de bajo consumo y algunos navegadores con la
    // batería baja. No hay nada que el usuario pueda hacer al respecto, así que
    // no se le molesta: se reintenta la próxima vez que la app sea visible.
    sentinel = null;
    devError('[wakeLock] no se pudo activar', error);
  } finally {
    pidiendo = false;
  }
}

function soltarBloqueo(): void {
  const actual = sentinel;
  sentinel = null;
  if (actual) void actual.release().catch(() => {});
}

/**
 * Olvida el bloqueo sin intentar soltarlo, porque el navegador ya lo ha soltado
 * al ocultarse el documento.
 *
 * Existe para no depender del evento `release` del sentinel: si un WebView no lo
 * dispara, nuestra referencia se quedaría apuntando a un bloqueo muerto y
 * `pedirBloqueo` saldría de vacío para siempre — la pantalla se apagaría a
 * mitad de sesión y no habría forma de recuperarla.
 */
function olvidarBloqueo(): void {
  sentinel = null;
}

/**
 * Mantiene la pantalla encendida mientras `enabled` sea true.
 *
 * Se cuenta cuántos consumidores lo tienen pedido: el bloqueo solo se suelta
 * cuando lo suelta el último.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !isWakeLockSupported()) return;

    consumidores += 1;
    queremos = true;

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') void pedirBloqueo();
      else olvidarBloqueo();
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    // En nativo, `appStateChange` es la señal fiable; el listener se registra de
    // forma asíncrona, así que se guarda la promesa para poder quitarlo bien.
    const nativo = Capacitor.isNativePlatform()
      ? CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void pedirBloqueo();
          else olvidarBloqueo();
        })
      : null;

    void pedirBloqueo();

    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      void nativo?.then((h) => h.remove());

      consumidores = Math.max(0, consumidores - 1);
      if (consumidores === 0) {
        queremos = false;
        soltarBloqueo();
      }
    };
  }, [enabled]);
}

/** Solo para los tests: devuelve el estado interno a cero entre casos. */
export function __resetWakeLockForTests(): void {
  sentinel = null;
  queremos = false;
  pidiendo = false;
  consumidores = 0;
}
