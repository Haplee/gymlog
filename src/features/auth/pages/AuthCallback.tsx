import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@shared/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = url.hash.substring(1);
        const urlSearchParams = new URLSearchParams(hashParams);
        const accessToken = urlSearchParams.get('access_token');
        const refreshToken = urlSearchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError(sessionError.message);
            setLoading(false);
            return;
          }
        } else if (urlSearchParams.get('error_description') || urlSearchParams.get('error')) {
          setError(urlSearchParams.get('error_description') || urlSearchParams.get('error'));
          setLoading(false);
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        if (session) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } catch {
        setError('Error al procesar la autenticación');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
          <p className="text-accent">Verificando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg text-fg mb-2">Error en la autenticación</p>
          <p className="text-sm text-fg-muted">{error}</p>
          <a href="/login" className="text-accent text-sm mt-4 block">
            Volver a iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  return null;
}
