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

  const isLight = theme === 'light';
  
  const colors = isLight ? {
    bgMain: '#f5f5f5',
    bgCard: '#ffffff',
    bgHeader: '#ffffff',
    border: '#e0e0e0',
    textPrimary: '#1a1a1a',
    textSecondary: '#666666',
    textMuted: '#999999',
    accent: '#10b981',
    accentText: '#ffffff',
    inputBg: '#f5f5f5',
  } : {
    bgMain: '#0a0a0c',
    bgCard: '#141418',
    bgHeader: 'rgba(10,10,12,0.95)',
    border: 'rgba(255,255,255,0.06)',
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#606068',
    accent: '#c8ff00',
    accentText: '#0a0a0c',
    inputBg: '#141418',
  };

  const tabs = [
    { path: '/', label: '🏋️', id: 'train' },
    { path: '/stats', label: '📊', id: 'stats' },
    { path: '/history', label: '📋', id: 'history' },
    { path: '/settings', label: '⚙️', id: 'settings' },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col" style={{ backgroundColor: colors.bgMain }}>
      <div 
        className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-100 safe-area-top"
        style={{ backgroundColor: colors.bgHeader, borderColor: colors.border }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm"
            style={{ backgroundColor: colors.accent, color: colors.accentText }}
          >
            G
          </div>
          <div>
            <div className="text-[1.1rem] font-extrabold" style={{ color: colors.textPrimary }}>
              Gym<span style={{ color: colors.accent }}>Log</span>
            </div>
            <div className="text-[0.85rem]" style={{ color: colors.textMuted }}>
              {user?.email?.split('@')[0]}
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b" style={{ backgroundColor: colors.bgCard, borderColor: colors.border }}>
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className="flex-1 py-4 px-2 text-[0.85rem] sm:text-[1rem] text-center cursor-pointer font-semibold border-b-2 transition-colors"
            style={{
              color: location.pathname === tab.path ? colors.accent : colors.textMuted,
              borderColor: location.pathname === tab.path ? colors.accent : 'transparent'
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
