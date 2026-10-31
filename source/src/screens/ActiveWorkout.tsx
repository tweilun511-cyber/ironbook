import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../nav';
import { Button, Confirm, IconButton, Sheet, cx, inputCls } from '../ui/kit';
import { IconDown, IconTimer } from '../ui/icons';
import { Elapsed, WorkoutLogger } from './WorkoutLogger';
import { ringBell, haptic, primeAudio, useNow, useWakeLock } from '../lib/hooks';
import { fmtClock, fmtDate } from '../lib/util';

export function ActiveWorkout() {
  const active = useStore((s) => s.data.active);
  const open = useStore((s) => s.workoutOpen);
  const setOpen = useStore((s) => s.setWorkoutOpen);
  const updateActive = useStore((s) => s.updateActive);
  const finishActive = useStore((s) => s.finishActive);
  const discardActive = useStore((s) => s.discardActive);
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const toast = useNav((s) => s.showToast);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [timerSheet, setTimerSheet] = useState(false);

  useWakeLock(!!active && open);

  if (!active || !open) return null;

  const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  const finish = () => {
    const w = finishActive();
    if (w) {
      setTab('history');
      push({ kind: 'summary', id: w.id });
    }
  };

  return (
    <div className="anim-sheet fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="gutter pt-safe shrink-0 border-b border-line/60">
        <div className="flex h-14 items-center gap-2">
          <IconButton label="Minimise workout" onClick={() => setOpen(false)} className="-ml-2 text-mute"><IconDown /></IconButton>
          <button onClick={() => { primeAudio(); setTimerSheet(true); }} className="flex h-10 items-center gap-1.5 rounded-xl bg-raised px-3 text-[15px] font-semibold active:bg-line" aria-label="Rest timer">
            <IconTimer size={18} /> Timer
          </button>
          <div className="flex-1 text-center">
            <Elapsed since={active.startedAt} className="font-display text-[20px] font-semibold tracking-wide" />
          </div>
          <Button variant="done" className="min-h-[40px] rounded-xl px-5" onClick={() => setConfirmFinish(true)}>Finish</Button>
        </div>
      </header>
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto pt-4">
        <WorkoutLogger
          workout={active}
          mode="active"
          onChange={updateActive}
          header={
            <div className="mb-6">
              <textarea id="workout-name" aria-label="Workout name" value={active.name} rows={1}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                onChange={(e) => updateActive((w) => { w.name = e.target.value.replace(/\n/g, ' '); })}
                className="block w-full resize-none overflow-hidden bg-transparent font-display text-[28px] font-bold leading-[1.15] tracking-wide outline-none" />
              <div className="mt-1 flex items-center gap-3 text-[14px] text-mute">
                <span>{fmtDate(active.startedAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span>·</span>
                <span className="tnum">{done}/{total} sets</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full bg-done transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </div>
            </div>
          }
          footer={<Button variant="danger" className="mt-3 w-full" onClick={() => setConfirmDiscard(true)}>Cancel workout</Button>}
        />
      </main>
      <RestBar />
      <TimerSheet open={timerSheet} onClose={() => setTimerSheet(false)} />
      <Confirm
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title={done ? 'Finish workout?' : 'No sets completed'}
        body={done
          ? (done < total ? `${done} of ${total} sets are ticked. The ${total - done} unticked set${total - done > 1 ? 's' : ''} won't be saved.` : `All ${total} sets done. Nice work.`)
          : 'Tick at least one set to save this workout, or cancel it.'}
        confirmLabel={done ? 'Save workout' : 'Keep logging'}
        onConfirm={() => { if (done) finish(); else toast('Tick the ✓ on each set you complete'); }}
      />
      <Confirm open={confirmDiscard} onClose={() => setConfirmDiscard(false)} danger title="Cancel this workout?"
        body="Everything logged in this session will be discarded." confirmLabel="Discard workout"
        onConfirm={() => { discardActive(); toast('Workout discarded'); }} />
    </div>
  );
}

/** Floating rest countdown, persisted by end time so a locked phone doesn't break it. */
export function RestBar({ compact = false }: { compact?: boolean }) {
  const rest = useStore((s) => s.rest);
  const sound = useStore((s) => s.data.settings.sound);
  const adjust = useStore((s) => s.adjustRest);
  const stop = useStore((s) => s.stopRest);
  const now = useNow(250, !!rest);
  const fired = useRef<number | null>(null);
  const left = rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (rest && left <= 0 && fired.current !== rest.endsAt) {
      fired.current = rest.endsAt;
      if (sound) ringBell();
      haptic(300);
      stop();
    }
  }, [rest, left, sound, stop]);

  if (!rest || left <= 0) return null;
  const pct = Math.max(0, Math.min(1, left / rest.total));
  return (
    <div className={cx('pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-3', compact ? 'bottom-[calc(76px+env(safe-area-inset-bottom,0px))]' : 'bottom-[calc(12px+env(safe-area-inset-bottom,0px))]')}>
      <div className="anim-sheet pointer-events-auto relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/40" role="timer" aria-live="off">
        <div className="absolute inset-y-0 left-0 bg-accent/20 transition-[width] duration-300 ease-linear" style={{ width: `${pct * 100}%` }} />
        <div className="relative flex items-center gap-2 p-2">
          <button onClick={() => adjust(-15)} className="h-11 rounded-xl bg-raised px-3 text-[15px] font-semibold active:bg-line" aria-label="Subtract 15 seconds">−15</button>
          <div className="min-w-0 flex-1 text-center">
            <div className="tnum font-display text-[26px] font-bold leading-none">{fmtClock(left)}</div>
            <div className="truncate text-[12px] text-mute">Rest{rest.label ? ` · ${rest.label}` : ''}</div>
          </div>
          <button onClick={() => adjust(15)} className="h-11 rounded-xl bg-raised px-3 text-[15px] font-semibold active:bg-line" aria-label="Add 15 seconds">+15</button>
          <button onClick={stop} className="h-11 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white active:brightness-90">Skip</button>
        </div>
      </div>
    </div>
  );
}

function TimerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const startRest = useStore((s) => s.startRest);
  const settings = useStore((s) => s.data.settings);
  const update = useStore((s) => s.updateSettings);
  const [custom, setCustom] = useState('');
  const presets = [60, 90, 120, 150, 180, 240];
  return (
    <Sheet open={open} onClose={onClose} title="Rest timer" z={70}>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => (
          <button key={p} onClick={() => { startRest(p); onClose(); }} className="tnum h-14 rounded-xl bg-raised font-display text-[22px] font-semibold active:bg-line">{fmtClock(p)}</button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input id="custom-rest" inputMode="numeric" placeholder="Custom seconds" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} className={inputCls} />
        <Button onClick={() => { const n = Number(custom); if (n > 0) { startRest(n); onClose(); } }}>Start</Button>
      </div>
      <label className="mt-5 flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-raised px-4">
        <span className="text-[16px]">Auto-start after each set</span>
        <input id="auto-rest" type="checkbox" checked={settings.autoRest} onChange={(e) => update({ autoRest: e.target.checked })} className="h-6 w-6 accent-[rgb(var(--accent))]" />
      </label>
      <div className="mt-2 text-[13px] text-mute">Default rest is {fmtClock(settings.defaultRestSec)}. Each exercise can override it from its ••• menu.</div>
    </Sheet>
  );
}
