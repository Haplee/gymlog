import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuthStore();
  const { theme } = useSettingsStore();
  const location = useLocation();

  const tabs = [
    { path: '/', label: '🏋️ Entrenar', id: 'train' },
    { path: '/stats', label: '📊 Stats', id: 'stats' },
    { path: '/history', label: '📋 Historial', id: 'history' },
    { path: '/settings', label: '⚙️ Ajustes', id: 'settings' },
  ];

  const bgMain = theme === 'light' ? '#ffffff' : '#0a0a0c';
  const bgCard = theme === 'light' ? '#f4f3ec' : '#141418';
  const bgHeader = theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(10,10,12,0.95)';
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const textPrimary = theme === 'light' ? '#08060d' : '#fafafa';
  const textMuted = theme === 'light' ? '#a0a0a8' : '#606068';
  const accent = '#c8ff00';

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col" style={{ backgroundColor: bgMain }}>
      <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-100 safe-area-top" style={{ backgroundColor: bgHeader, borderColor }}>
        <div className="flex items-center gap-3">
          <img src="/gimnasia.png" className="w-8 h-8 rounded-lg object-contain border" style={{ backgroundColor: bgCard, borderColor: accent }} alt="logo" />
          <div>
            <div className="text-[1.1rem] font-extrabold" style={{ color: textPrimary }}>
              Gym<span style={{ color: accent }}>Log</span>
            </div>
            <div className="text-[0.85rem]" style={{ color: textMuted }}>
              {user?.email?.split('@')[0]}
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b" style={{ backgroundColor: bgCard, borderColor }}>
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex-1 py-4 px-2 text-[0.85rem] sm:text-[1rem] text-center cursor-pointer font-semibold border-b-2 transition-colors`}
            style={{
              color: location.pathname === tab.path ? accent : textMuted,
              borderColor: location.pathname === tab.path ? accent : 'transparent'
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
