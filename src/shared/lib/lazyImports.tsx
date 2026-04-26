import { useState, useEffect } from 'react';

export function useCanvasConfetti() {
  const [confettiFn, setConfettiFn] = useState<((options?: object) => void) | null>(null);

  useEffect(() => {
    import('canvas-confetti').then((mod) => {
      setConfettiFn(() => mod.default || mod);
    });
  }, []);

  return confettiFn;
}
