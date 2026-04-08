import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface LayoutProps {
  children: ReactNode;
}

const colors = {
  bgMain: '#0a0a0c',
  bgCard: '#141418',
  textPrimary: '#fafafa',
  textMuted: '#606068',
  accent: '#c8ff00',
};

export function Layout({ children }: LayoutProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  const tabs = [
    { path: '/', label: '🏋️', id: 'train' },
    { path: '/stats', label: '📊', id: 'stats' },
    { path: '/history', label: '📜', id: 'history' },
    { path: '/settings', label: '⚙️', id: 'settings' },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col" style={{ backgroundColor: colors.bgMain }}>
      <header className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 scale-in">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105" style={{ backgroundColor: colors.accent }}>
              <span className="text-lg font-bold" style={{ color: '#0a0a0c' }}>G</span>
            </div>
            <div>
              <div className="text-[1.15rem] font-bold" style={{ color: colors.textPrimary }}>
                Gym<span style={{ color: colors.accent }}>Log</span>
              </div>
              {user && (
                <div className="text-[0.75rem]" style={{ color: colors.textMuted }}>
                  {user.email?.split('@')[0]}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="flex px-2 gap-1 overflow-x-auto">
        {tabs.map((tab, index) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex-1 py-3 px-1 text-[0.8rem] text-center font-medium whitespace-nowrap transition-all rounded-lg ${isActive ? 'scale-in' : 'fade-in-up'}`}
              style={{
                color: isActive ? colors.bgMain : colors.textMuted,
                backgroundColor: isActive ? colors.accent : 'transparent',
                animationDelay: `${index * 0.05}s`,
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 px-4 pt-4 pb-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
