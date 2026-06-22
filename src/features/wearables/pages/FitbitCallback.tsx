import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageSkeleton } from '@shared/components/ui/Skeleton';
import { devError } from '@shared/lib/devtools';
import { completeFitbitExchange } from '../api/fitbit';

/** Ruta web /auth/fitbit-callback: recibe ?code&state de Fitbit y completa OAuth. */
export default function FitbitCallback() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      if (!code || !state) {
        navigate('/wearables', { replace: true });
        return;
      }
      try {
        await completeFitbitExchange(code, state);
        toast.success(t('wearables.connect_ok'));
        navigate('/wearables', { replace: true });
      } catch (e) {
        devError('[FitbitCallback] exchange failed:', e);
        setError(t('wearables.connect_error'));
        toast.error(t('wearables.connect_error'));
        setTimeout(() => navigate('/wearables', { replace: true }), 1500);
      }
    };
    void run();
  }, [navigate, t]);

  return (
    <div className="min-h-dvh bg-base flex items-center justify-center">
      {error ? (
        <div className="text-sm text-error px-6 text-center">{error}</div>
      ) : (
        <PageSkeleton />
      )}
    </div>
  );
}
