import { useCallback, useState } from 'react';
import { grantHealthConsent, hasHealthConsent } from '../consent/healthConsent';

/**
 * Puerta de consentimiento para las escrituras de datos de salud.
 *
 * La forma es deliberada: en vez de un `if` repetido en cada pantalla, la
 * acción se pasa como callback. Si ya hay consentimiento se ejecuta en el acto
 * (sin parpadeo ni diálogo); si no, se guarda y se ejecuta al aceptar. Cancelar
 * la descarta: no se guarda nada a medias.
 *
 * El estado inicial se lee una vez, en el primer render, no en cada llamada:
 * `localStorage` es síncrono y leerlo en cada clic no aporta nada.
 */
export function useHealthConsentGate(userId: string | undefined) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [granted, setGranted] = useState(() => (userId ? hasHealthConsent(userId) : false));

  const requireConsent = useCallback(
    (action: () => void) => {
      if (userId && hasHealthConsent(userId)) {
        action();
        return;
      }
      // Envolver en función: `setState` con una función la trataría como
      // actualizador y la ejecutaría al renderizar.
      setPendingAction(() => action);
    },
    [userId],
  );

  const accept = useCallback(() => {
    if (userId) grantHealthConsent(userId);
    setGranted(true);
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction, userId]);

  const cancel = useCallback(() => setPendingAction(null), []);

  return {
    requireConsent,
    isDialogOpen: pendingAction !== null,
    hasConsent: granted,
    accept,
    cancel,
  };
}
