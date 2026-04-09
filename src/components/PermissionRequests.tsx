import { useState } from 'react';

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
    description: 'Te avisaremos cuando termine el descanso',
    icon: '🔔'
  }
];

export function PermissionRequests() {
  const [showModal, setShowModal] = useState(() => {
    const hasSeen = localStorage.getItem('gymlog_permissions_seen');
    return !hasSeen && 'Notification' in window && Notification.permission === 'default';
  });
  const [requested, setRequested] = useState<string[]>([]);

  const requestPermission = async (key: string) => {
    if (key === 'notifications' && 'Notification' in window) {
      await Notification.requestPermission();
    }
    setRequested(prev => [...prev, key]);
  };

  const handleContinue = () => {
    localStorage.setItem('gymlog_permissions_seen', 'true');
    setShowModal(false);
  };

  const allRequested = PERMISSIONS.every(p => requested.includes(p.key));

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
      <div className="bg-[#1c1c22] border border-[rgba(255,255,255,0.12)] rounded-2xl p-6 max-w-[340px] w-full">
        <div className="text-[1.4rem] font-bold text-white mb-2">¡Bienvenido!</div>
        <div className="text-[#a0a0a8] text-[0.95rem] mb-6">
          Para mejorar tu experiencia, puedes activar estas funciones:
        </div>

        <div className="space-y-4 mb-6">
          {PERMISSIONS.map(p => (
            <div key={p.key} className="flex items-center gap-3 p-3 bg-[#141418] rounded-xl">
              <span className="text-2xl">{p.icon}</span>
              <div className="flex-1">
                <div className="text-white font-semibold text-[0.95rem]">{p.title}</div>
                <div className="text-[#606068] text-[0.8rem]">{p.description}</div>
              </div>
              {requested.includes(p.key) ? (
                <span className="text-[#c8ff00] text-sm">✓</span>
              ) : (
                <button
                  onClick={() => requestPermission(p.key)}
                  className="text-[#c8ff00] text-sm font-semibold bg-transparent border-none cursor-pointer"
                >
                  Activar
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleContinue}
          className="w-full py-3 bg-[#c8ff00] text-black rounded-xl font-bold cursor-pointer"
        >
          {allRequested ? '¡Gracias!' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}