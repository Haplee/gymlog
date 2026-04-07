import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuthStore();
  const location = useLocation();

  const tabs = [
    { path: '/', label: '🏋️ Entrenar', id: 'train' },
    { path: '/stats', label: '📊 Stats', id: 'stats' },
    { path: '/history', label: '📋 Historial', id: 'history' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-[rgba(10,10,12,0.95)] border-b border-[rgba(255,255,255,0.06)] sticky top-0 z-100">
        <div className="flex items-center gap-3">
          <img src="/gimnasia.png" className="w-8 h-8 rounded-lg object-contain bg-[#141418] border border-[#c8ff00]" alt="logo" />
          <div>
            <div className="text-[1.1rem] font-extrabold">
              Gym<span className="text-[#c8ff00]">Log</span>
            </div>
            <div className="text-[0.85rem] text-[#a0a0a8]">
              {user?.email?.split('@')[0]}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="py-2 px-3 text-[0.8rem] bg-transparent border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] cursor-pointer"
        >
          Salir
        </button>
      </div>

      <div className="flex bg-[#141418] border-b border-[rgba(255,255,255,0.06)]">
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex-1 py-4 px-2 text-[1rem] text-center cursor-pointer font-semibold border-b-2 transition-colors ${
              location.pathname === tab.path
                ? 'text-[#c8ff00] border-b-[#c8ff00]'
                : 'text-[#606068] border-b-transparent'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
