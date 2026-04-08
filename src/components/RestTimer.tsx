import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useRestTimerStore } from '../stores/restTimerStore';

export function RestTimer() {
  const intervalRef = useRef<number | null>(null);
  const { vibration, sound } = useSettingsStore();
  const { seconds, isRunning, setSeconds, stopRest } = useRestTimerStore();

  const notifyTimerEnd = useCallback(() => {
    if (vibration && 'vibrate' in navigator) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }
    if (sound) playBeep();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('GymLog', { body: '⏱️ Descanso terminado', icon: '/gimnasia.png' });
    }
  }, [vibration, sound]);

  const startRest = (sec: number) => {
    useRestTimerStore.getState().startRest(sec);
  };

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = window.setInterval(() => {
        const current = useRestTimerStore.getState().seconds;
        if (current <= 1) {
          stopRest();
          if (sound) playBeep();
          notifyTimerEnd();
        } else {
          setSeconds(current - 1);
        }
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, seconds, sound, notifyTimerEnd, stopRest, setSeconds]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ backgroundColor: '#1c1c22' }}>
      <button onClick={() => startRest(60)} className="py-2 px-3 text-[0.9rem] bg-transparent border rounded-lg cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#a0a0a8' }}>1m</button>
      <button onClick={() => startRest(90)} className="py-2 px-3 text-[0.9rem] bg-transparent border rounded-lg cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#a0a0a8' }}>1:30</button>
      <button onClick={() => startRest(120)} className="py-2 px-3 text-[0.9rem] bg-transparent border rounded-lg cursor-pointer" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#a0a0a8' }}>2m</button>
      <div className="flex-1 text-center text-[1.3rem] font-bold min-w-[50px]" style={{ color: '#c8ff00' }}>
        {isRunning ? formatTime(seconds) : '--'}
      </div>
      <button onClick={stopRest} className="w-10 h-10 bg-transparent border rounded-lg cursor-pointer text-xl flex items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#606068' }}>×</button>
    </div>
  );
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const playFreq = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.8, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.25);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.25);
    };
    playFreq(1200, 0);
    playFreq(1500, 0.15);
    playFreq(1800, 0.30);
  } catch (e) {}
}
