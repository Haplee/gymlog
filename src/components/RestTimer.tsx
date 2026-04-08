import { useState, useEffect, useRef, useCallback } from 'react';

export function RestTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const notifyTimerEnd = useCallback(async () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('GymLog', {
        body: '⏱️ Descanso terminado — ¡Siguiente serie!',
        icon: '/gimnasia.png',
        badge: '/gimnasia.png'
      });
    }
  }, []);

  const startRest = (sec: number) => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    stopRest();
    setSeconds(sec);
    setIsRunning(true);
  };

  const stopRest = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setSeconds(0);
  };

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = window.setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            stopRest();
            playBeep();
            notifyTimerEnd();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, notifyTimerEnd]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 mb-4 p-3 bg-[#1c1c22] rounded-xl">
      <button onClick={() => startRest(60)} className="py-2 px-3 text-[0.9rem] bg-transparent border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] cursor-pointer">
        1m
      </button>
      <button onClick={() => startRest(90)} className="py-2 px-3 text-[0.9rem] bg-transparent border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] cursor-pointer">
        1:30
      </button>
      <button onClick={() => startRest(120)} className="py-2 px-3 text-[0.9rem] bg-transparent border border-[rgba(255,255,255,0.12)] rounded-lg text-[#a0a0a8] cursor-pointer">
        2m
      </button>
      <div className="flex-1 text-center text-[1.3rem] text-[#c8ff00] font-bold min-w-[50px]">
        {isRunning ? formatTime(seconds) : '--'}
      </div>
      <button
        onClick={stopRest}
        className="w-10 h-10 bg-transparent border border-[rgba(255,255,255,0.06)] text-[#606068] rounded-lg cursor-pointer text-xl flex items-center justify-center"
      >
        ×
      </button>
    </div>
  );
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}
