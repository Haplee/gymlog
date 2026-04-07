import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signUp } = useAuthStore();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!email || !password) {
      setError('Completa los campos');
      return;
    }

    if (isSignUp) {
      const result = await signUp(email, password);
      if (result.error) {
        setError(result.error.message);
      } else if (result.needsVerification) {
        setMessage('¡Verifica tu email!');
      }
    } else {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
      <div className="w-full max-w-[320px] text-center">
        <div className="text-[2.5rem] font-extrabold tracking-[-2px] mb-2">
          Gym<span className="text-[#c8ff00]">Log</span>
        </div>
        <div className="text-[#606068] mb-8">
          {isSignUp ? 'Crea tu cuenta' : 'Inicia sesión'}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="text-left mb-4">
            <label className="text-[0.85rem] font-semibold text-[#a0a0a8] block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-4 outline-none"
            />
          </div>

          <div className="text-left mb-4">
            <label className="text-[0.85rem] font-semibold text-[#a0a0a8] block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#141418] border border-[rgba(255,255,255,0.12)] rounded-xl text-white text-[1.1rem] p-4 outline-none"
            />
          </div>

          {error && <div className="text-[#ff5252] text-sm mb-4">{error}</div>}
          {message && <div className="text-[#c8ff00] text-sm mb-4">{message}</div>}

          <button
            type="submit"
            className="w-full py-[1.1rem] bg-[#c8ff00] text-[#0a0a0c] border-none rounded-xl text-[1.1rem] font-bold cursor-pointer"
          >
            {isSignUp ? 'Registrarse' : 'Entrar'}
          </button>
        </form>

        <div
          className="mt-4 text-[#a0a0a8] text-sm cursor-pointer underline"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? '¿Ya tienes cuenta? Entra' : '¿No tienes cuenta? Regístrate'}
        </div>
      </div>
    </div>
  );
}
