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

/**
 * Boxing/wrestling ring bell: "ding-ding-ding".
 * Each strike = inharmonic bell partials with exponential decay + a short
 * metallic click from filtered noise, run through a compressor for punch.
 */
const PARTIALS: [ratio: number, gain: number, decay: number][] = [
  [1, 1.0, 2.4],
  [2.0, 0.45, 1.6],
  [2.76, 0.6, 1.2],
  [4.07, 0.32, 0.8],
  [5.4, 0.22, 0.55],
  [6.8, 0.12, 0.35],
];

export function ringBell(strikes = 3) {
  try {
    if (!ctx) primeAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const c = ctx;
    const out = c.createDynamicsCompressor();
    out.threshold.value = -14;
    out.ratio.value = 6;
    const master = c.createGain();
    master.gain.value = 0.9;
    out.connect(master).connect(c.destination);

    const noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);

    const base = 830;
    const gap = 0.3;
    for (let s = 0; s < strikes; s++) {
      const t = c.currentTime + 0.02 + s * gap;
      const last = s === strikes - 1;
      // a quick ring is cut short by the next strike, the last one rings out
      const tail = last ? 1 : 0.55;
      for (const [ratio, gain, decay] of PARTIALS) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(base * ratio * (1 + (Math.random() - 0.5) * 0.002), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain * 0.32, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay * tail);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + decay * tail + 0.05);
      }
      const n = c.createBufferSource();
      n.buffer = noiseBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3800;
      bp.Q.value = 1.2;
      const ng = c.createGain();
      ng.gain.value = 0.5;
      n.connect(bp).connect(ng).connect(out);
      n.start(t);
    }
  } catch { /* ignore */ }
}

/** @deprecated kept for compatibility */
export const beep = () => ringBell();

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* iOS Safari has no vibrate */ }
}
