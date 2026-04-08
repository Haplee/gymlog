import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { error } = await supabase.auth.getSession();

      if (error) {
        setError(error.message);
        return;
      }

      navigate('/');
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[1.1rem] text-white mb-2">Error en la autenticación</p>
          <p className="text-sm text-[#a0a0a8]">{error}</p>
          <a href="/login" className="text-[#c8ff00] text-sm mt-4 block">
            Volver a iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-[#c8ff00]">Verificando...</div>
    </div>
  );
}
