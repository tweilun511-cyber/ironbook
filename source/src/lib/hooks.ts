import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [intervalMs, enabled]);
  return now;
}

/** Keep the screen on during a workout where the browser allows it. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    type WL = { release: () => Promise<void> };
    let lock: WL | null = null;
    let cancelled = false;
    const req = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WL> } };
        if (nav.wakeLock && document.visibilityState === 'visible') {
          lock = await nav.wakeLock.request('screen');
          if (cancelled) void lock.release();
        }
      } catch { /* not allowed — fine */ }
    };
    void req();
    const onVis = () => { if (document.visibilityState === 'visible') void req(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}); };
  }, [enabled]);
}

let ctx: AudioContext | null = null;
/** Must be called from a user gesture once so iOS allows later beeps. */
export function primeAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === 'suspended') void ctx.resume();
  } catch { /* ignore */ }
}

export function beep(times = 3) {
  try {
    if (!ctx) return;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = i === times - 1 ? 1320 : 880;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.2);
    }
  } catch { /* ignore */ }
}

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* iOS Safari has no vibrate */ }
}
