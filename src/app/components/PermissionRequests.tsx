import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { requestPermission as requestNotifPermission } from '@shared/lib/notifications';

const PERMISSIONS_SEEN_KEY = 'gymlog_permissions_seen';

interface PermissionRequest {
  key: string;
  title: string;
  description: string;
  icon: string;
}

const PERMISSIONS: PermissionRequest[] = [
  {
    key: 'notifications',
    title: 'Notificaciones',
    description: 'Fin del descanso, rutina del día y rachas',
    icon: '🔔',
  },
];

export function PermissionRequests() {
  const [showModal, setShowModal] = useState(() => {
    const hasSeen = localStorage.getItem(PERMISSIONS_SEEN_KEY);
    // Si estamos en web y ya está concedido o denegado, no mostramos
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default' && !hasSeen) {
      localStorage.setItem(PERMISSIONS_SEEN_KEY, 'true');
      return false;
    }
    return !hasSeen;
  });
  const [requested, setRequested] = useState<string[]>([]);

  // El modal no tiene botón de cierre (X); en Android muchos usuarios lo
  // descartan con el botón/gesto atrás, que nunca llega a handleContinue.
  // Sin esto, `gymlog_permissions_seen` no se guarda y el modal reaparece en
  // cada apertura. Se persiste también al pulsar atrás o pasar a segundo plano.
  useEffect(() => {
    if (!showModal || !Capacitor.isNativePlatform()) return;
    let backHandle: { remove: () => void } | undefined;
    let stateHandle: { remove: () => void } | undefined;

    void CapApp.addListener('backButton', () => {
      localStorage.setItem(PERMISSIONS_SEEN_KEY, 'true');
      setShowModal(false);
    }).then((h) => {
      backHandle = h;
    });

    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) localStorage.setItem(PERMISSIONS_SEEN_KEY, 'true');
    }).then((h) => {
      stateHandle = h;
    });

    return () => {
      backHandle?.remove();
      stateHandle?.remove();
    };
  }, [showModal]);

  const requestPermission = async (key: string) => {
    if (key === 'notifications') {
      const granted = await requestNotifPermission();
      if (granted) {
        setRequested((prev) => [...prev, key]);
      }
    } else {
      setRequested((prev) => [...prev, key]);
    }
  };

  const handleContinue = () => {
    localStorage.setItem(PERMISSIONS_SEEN_KEY, 'true');
    setShowModal(false);
  };

  const allRequested = PERMISSIONS.every((p) => requested.includes(p.key));

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[var(--z-modal)] flex items-center justify-center p-4">
      <div className="bg-surface border border-line-strong rounded-card shadow-lg p-6 max-w-[340px] w-full">
        <div className="text-xl font-bold text-fg mb-2">¡Bienvenido!</div>
        <div className="text-fg-muted text-base mb-6">
          Para mejorar tu experiencia, puedes activar estas funciones:
        </div>

        <div className="space-y-4 mb-6">
          {PERMISSIONS.map((p) => (
            <div key={p.key} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl">
              <span className="text-2xl">{p.icon}</span>
              <div className="flex-1">
                <div className="text-fg font-semibold text-base">{p.title}</div>
                <div className="text-fg-subtle text-sm">{p.description}</div>
              </div>
              {requested.includes(p.key) ? (
                <span className="text-accent text-sm">✓</span>
              ) : (
                <button
                  type="button"
                  onClick={() => requestPermission(p.key)}
                  className="text-accent text-sm font-semibold bg-transparent border-none cursor-pointer min-h-11 px-2"
                >
                  Activar
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="w-full py-3 bg-accent text-accent-fg rounded-xl font-bold cursor-pointer shadow-btn-accent transition-transform active:scale-[0.98]"
        >
          {allRequested ? '¡Gracias!' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
