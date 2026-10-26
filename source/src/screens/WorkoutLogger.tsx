import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { makeSet, useExerciseMap, useStore } from '../store';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { previousFor, previousSet } from '../lib/stats';
import { fmtClock, parseNum, uid } from '../lib/util';
import { haptic, primeAudio, useNow } from '../lib/hooks';
import { ActionSheet, Button, Sheet, Stepper, cx, inputCls, type Action } from '../ui/kit';
import { IconCheck, IconDots, IconDown, IconLink, IconNote, IconPlus, IconTimer, IconTrash, IconUp } from '../ui/icons';
import { ExercisePicker } from './ExercisePicker';
import { useNav } from '../nav';

const SS_COLORS = ['var(--accent)', 'var(--warm)', 'var(--done)', 'var(--gold)', 'var(--danger)'];

/** Numeric input that keeps its own text while typing (so "82." survives). */
function NumInput({ value, onChange, placeholder, mode, id, ariaLabel, className, done }: {
  value: number | null; onChange: (n: number | null) => void; placeholder?: string; mode: 'decimal' | 'numeric'; id: string; ariaLabel: string; className?: string; done?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      inputMode={mode}
      enterKeyHint="next"
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
      onBlur={() => { focused.current = false; setText(value == null ? '' : String(value)); }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, '');
        setText(t);
        const n = parseNum(t);
        if (t === '' || n != null) onChange(n);
      }}
      className={cx(
        'tnum h-11 w-full min-w-0 rounded-[10px] text-center text-[17px] font-semibold outline-none placeholder:font-medium placeholder:text-mute/60 focus:ring-2 focus:ring-accent',
        done ? 'bg-done/20 text-fg' : 'bg-raised text-fg',
        className,
      )}
    />
  );
}

function prevLabel(s: WorkoutSet | undefined, ex: Exercise | undefined) {
  if (!s) return '—';
  if (ex?.tracking === 'duration') return `${s.reps ?? 0}s`;
  if (ex?.tracking === 'bodyweight') return s.weight ? `+${s.weight}×${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
  return `${s.weight ?? 0}×${s.reps ?? 0}`;
}

interface RowProps {
  set: WorkoutSet; index: number; number: number; ex: Exercise | undefined; prev: WorkoutSet | undefined; carryWeight: number | null;
  showRir: boolean; target: string; uidKey: string;
  onPatch: (p: Partial<WorkoutSet>) => void; onToggle: () => void; onMenu: () => void;
}
const SetRow = memo(function SetRow({ set, number, ex, prev, carryWeight, showRir, target, uidKey, onPatch, onToggle, onMenu }: RowProps) {
  const isDur = ex?.tracking === 'duration';
  const isBw = ex?.tracking === 'bodyweight';
  return (
    <div className={cx('grid items-center gap-1.5 rounded-xl px-1 py-1 transition-colors', set.done && 'bg-done/10')}
      style={{ gridTemplateColumns: `34px minmax(0,1fr) ${isDur ? '' : '62px '}58px ${showRir ? '42px ' : ''}44px` }}>
      <button onClick={onMenu} aria-label={`Set ${number} options`}
        className={cx('tnum h-9 rounded-lg text-[15px] font-bold', set.type === 'warmup' ? 'bg-warm/20 text-warm' : 'bg-raised text-fg')}>
        {set.type === 'warmup' ? 'W' : number}
      </button>
      <button
        className="tnum truncate text-center text-[14px] text-mute active:text-fg"
        onClick={() => prev && onPatch({ weight: prev.weight, reps: prev.reps })}
        aria-label="Copy previous set"
      >
        {prevLabel(prev, ex)}
      </button>
      {!isDur && (
        <NumInput id={`w-${uidKey}-${set.id}`} ariaLabel="Weight in kg" mode="decimal" value={set.weight} done={set.done}
          placeholder={prev?.weight != null ? String(prev.weight) : carryWeight != null ? String(carryWeight) : isBw ? '0' : ''}
          onChange={(n) => onPatch({ weight: n })} />
      )}
      <NumInput id={`r-${uidKey}-${set.id}`} ariaLabel={isDur ? 'Seconds' : 'Reps'} mode="numeric" value={set.reps} done={set.done}
        placeholder={prev?.reps != null ? String(prev.reps) : target}
        onChange={(n) => onPatch({ reps: n == null ? null : Math.round(n) })} />
      {showRir && (
        <NumInput id={`i-${uidKey}-${set.id}`} ariaLabel="Reps in reserve" mode="numeric" value={set.rir} done={set.done}
          placeholder={prev?.rir != null ? String(prev.rir) : '–'} className="text-[15px]"
          onChange={(n) => onPatch({ rir: n == null ? null : Math.min(10, Math.round(n)) })} />
      )}
      <button onClick={onToggle} aria-label={set.done ? 'Mark set not done' : 'Complete set'} aria-pressed={set.done}
        className={cx('grid h-11 w-11 place-items-center rounded-[10px] transition-colors', set.done ? 'anim-pop bg-done text-white' : 'bg-raised text-mute active:bg-line')}>
        <IconCheck size={20} />
      </button>
    </div>
  );
});

export function WorkoutLogger({ workout, mode, onChange, header, footer }: {
  workout: Workout; mode: 'active' | 'edit';
  onChange: (fn: (w: Workout) => void) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const exMap = useExerciseMap();
  const workouts = useStore((s) => s.data.workouts);
  const settings = useStore((s) => s.data.settings);
  const startRest = useStore((s) => s.startRest);
  const toast = useNav((s) => s.showToast);
  const [picker, setPicker] = useState<{ replace?: string } | null>(null);
  const [menu, setMenu] = useState<{ title: string; actions: Action[] } | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});

  const prevMap = useMemo(() => {
    const m = new Map<string, WorkoutExercise | undefined>();
    for (const we of workout.exercises) {
      if (!m.has(we.exerciseId)) m.set(we.exerciseId, previousFor(we.exerciseId, workouts, mode === 'edit' ? workout.startedAt : Infinity, workout.id)?.ex);
    }
    return m;
  }, [workout.exercises, workouts, workout.id, workout.startedAt, mode]);

  const ssColor = useMemo(() => {
    const ids = [...new Set(workout.exercises.map((e) => e.supersetId).filter(Boolean))] as string[];
    return new Map(ids.map((id, i) => [id, SS_COLORS[i % SS_COLORS.length]]));
  }, [workout.exercises]);

  const carryWeight = (sets: WorkoutSet[], si: number) => {
    for (let k = si - 1; k >= 0; k--) if (sets[k].type === sets[si].type && sets[k].weight != null) return sets[k].weight;
    return null;
  };

  const patchSet = (ei: number, si: number, p: Partial<WorkoutSet>) =>
    onChange((w) => { Object.assign(w.exercises[ei].sets[si], p); });

  const toggleSet = (ei: number, si: number) => {
    primeAudio();
    const we = workout.exercises[ei];
    const s = we.sets[si];
    const ex = exMap.get(we.exerciseId);
    if (s.done) { patchSet(ei, si, { done: false }); return; }
    const prev = previousSet(prevMap.get(we.exerciseId), we.sets, si);
    const weight = s.weight ?? prev?.weight ?? carryWeight(we.sets, si);
    const reps = s.reps ?? prev?.reps ?? null;
    if (reps == null) { toast(ex?.tracking === 'duration' ? 'Enter the seconds first' : 'Enter reps first'); document.getElementById(`r-${we.uid}-${s.id}`)?.focus(); return; }
    if (ex?.tracking === 'weight' && weight == null) { toast('Enter the weight first'); document.getElementById(`w-${we.uid}-${s.id}`)?.focus(); return; }
    const rir = s.rir ?? null;
    onChange((w) => { Object.assign(w.exercises[ei].sets[si], { weight, reps, rir, done: true }); });
    haptic();
    if (mode === 'active' && settings.autoRest) {
      // In a superset, only rest after the last exercise of the round.
      const next = workout.exercises[ei + 1];
      const midSuperset = we.supersetId && next && next.supersetId === we.supersetId;
      if (!midSuperset) {
        const base = we.restSec ?? settings.defaultRestSec;
        startRest(s.type === 'warmup' ? Math.min(60, base) : base, ex?.name);
      }
    }
  };

  const setMenuFor = (ei: number, si: number) => {
    const s = workout.exercises[ei].sets[si];
    setMenu({
      title: `Set ${si + 1}`,
      actions: [
        { label: s.type === 'warmup' ? 'Make working set' : 'Make warm-up set', onClick: () => patchSet(ei, si, { type: s.type === 'warmup' ? 'normal' : 'warmup' }) },
        { label: 'Duplicate set', onClick: () => onChange((w) => { w.exercises[ei].sets.splice(si + 1, 0, { ...s, id: uid(), done: false }); }) },
        { label: 'Delete set', danger: true, icon: <IconTrash size={20} />, onClick: () => onChange((w) => { w.exercises[ei].sets.splice(si, 1); }) },
      ],
    });
  };

  const addSet = (ei: number, type: WorkoutSet['type']) => onChange((w) => {
    const sets = w.exercises[ei].sets;
    const ns = makeSet(type);
    if (type === 'warmup') {
      const lastW = sets.map((x) => x.type).lastIndexOf('warmup');
      sets.splice(lastW + 1, 0, ns);
    } else {
      const last = [...sets].reverse().find((x) => x.type === 'normal');
      if (last) { ns.weight = last.weight; ns.reps = null; }
      sets.push(ns);
    }
  });

  const exMenu = (ei: number) => {
    const we = workout.exercises[ei];
    const ex = exMap.get(we.exerciseId);
    const next = workout.exercises[ei + 1];
    const inSS = !!we.supersetId;
    const actions: Action[] = [
      { label: we.notes != null || notesOpen[we.uid] ? 'Edit note' : 'Add note', icon: <IconNote size={20} />, onClick: () => { setNotesOpen((n) => ({ ...n, [we.uid]: true })); setTimeout(() => document.getElementById(`note-${we.uid}`)?.focus(), 50); } },
      { label: 'Add warm-up set', icon: <IconPlus size={20} />, onClick: () => addSet(ei, 'warmup') },
      { label: 'Rest timer', icon: <IconTimer size={20} />, hint: fmtClock(we.restSec ?? settings.defaultRestSec), onClick: () => setRestFor(we.uid) },
    ];
    if (next) actions.push({
      label: next.supersetId && next.supersetId === we.supersetId ? 'Unlink from next' : 'Superset with next', icon: <IconLink size={20} />,
      onClick: () => onChange((w) => {
        const a = w.exercises[ei], b = w.exercises[ei + 1];
        if (b.supersetId && b.supersetId === a.supersetId) { b.supersetId = undefined; }
        else { const id = a.supersetId ?? uid(); a.supersetId = id; b.supersetId = id; }
        // clean up singletons
        const counts = new Map<string, number>();
        w.exercises.forEach((e) => e.supersetId && counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1));
        w.exercises.forEach((e) => { if (e.supersetId && counts.get(e.supersetId) === 1) e.supersetId = undefined; });
      }),
    });
    if (inSS) actions.push({ label: 'Remove from superset', icon: <IconLink size={20} />, onClick: () => onChange((w) => {
      w.exercises[ei].supersetId = undefined;
      const counts = new Map<string, number>();
      w.exercises.forEach((e) => e.supersetId && counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1));
      w.exercises.forEach((e) => { if (e.supersetId && counts.get(e.supersetId) === 1) e.supersetId = undefined; });
    }) });
    if (ei > 0) actions.push({ label: 'Move up', icon: <IconUp size={20} />, onClick: () => onChange((w) => { const [x] = w.exercises.splice(ei, 1); w.exercises.splice(ei - 1, 0, x); }) });
    if (next) actions.push({ label: 'Move down', icon: <IconDown size={20} />, onClick: () => onChange((w) => { const [x] = w.exercises.splice(ei, 1); w.exercises.splice(ei + 1, 0, x); }) });
    actions.push({ label: 'Replace exercise', onClick: () => setPicker({ replace: we.uid }) });
    actions.push({ label: 'Remove exercise', danger: true, icon: <IconTrash size={20} />, onClick: () => onChange((w) => { w.exercises.splice(ei, 1); }) });
    setMenu({ title: ex?.name ?? 'Exercise', actions });
  };

  const restTarget = workout.exercises.find((e) => e.uid === restFor);

  return (
    <div className="gutter pb-40">
      {header}
      <div className="flex flex-col gap-7">
        {workout.exercises.map((we, ei) => {
          const ex = exMap.get(we.exerciseId);
          const prevEx = prevMap.get(we.exerciseId);
          const target = we.repMin ? (we.repMin === we.repMax ? `${we.repMin}` : `${we.repMin}-${we.repMax}`) : '';
          const color = we.supersetId ? ssColor.get(we.supersetId) : undefined;
          const ssPrev = ei > 0 && we.supersetId && workout.exercises[ei - 1].supersetId === we.supersetId;
          let n = 0;
          const isDur = ex?.tracking === 'duration';
          const doneCount = we.sets.filter((s) => s.done).length;
          return (
            <section key={we.uid} className={cx('relative', ssPrev && '-mt-4')} style={color ? { paddingLeft: 10 } : undefined}>
              {color && <div className="absolute bottom-0 left-0 top-1 w-[3px] rounded-full" style={{ background: `rgb(${color})` }} />}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 pt-1">
                  {color && !ssPrev && <div className="label mb-0.5" style={{ color: `rgb(${color})` }}>Superset</div>}
                  <h3 className="font-display text-[21px] font-semibold leading-tight tracking-wide text-accent">{ex?.name ?? 'Deleted exercise'}</h3>
                  <div className="mt-0.5 text-[13px] text-mute">
                    {target && <>Target {we.sets.filter((s) => s.type === 'normal').length} × {target}{isDur ? 's' : ''} · </>}
                    Rest {fmtClock(we.restSec ?? settings.defaultRestSec)}
                    {doneCount > 0 && <> · <span className="text-done">{doneCount}/{we.sets.length} done</span></>}
                  </div>
                </div>
                <button aria-label="Exercise options" onClick={() => exMenu(ei)} className="grid h-10 w-11 place-items-center rounded-xl bg-accent/15 text-accent active:bg-accent/25">
                  <IconDots size={20} />
                </button>
              </div>
              {ex?.notes && <div className="mt-1.5 text-[13px] italic text-mute">{ex.notes}</div>}
              {(we.notes != null && we.notes !== '') || notesOpen[we.uid] ? (
                <textarea id={`note-${we.uid}`} value={we.notes ?? ''} placeholder="Note for this session"
                  onChange={(e) => onChange((w) => { w.exercises[ei].notes = e.target.value; })}
                  className={cx(inputCls, 'mt-2 min-h-[44px] resize-none py-2.5 text-[15px]')} rows={2} />
              ) : null}
              <div className="mt-3 grid items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[.08em] text-mute"
                style={{ gridTemplateColumns: `34px minmax(0,1fr) ${isDur ? '' : '62px '}58px ${settings.showRir ? '42px ' : ''}44px` }}>
                <div className="text-center">Set</div>
                <div className="text-center">Previous</div>
                {!isDur && <div className="text-center">{ex?.tracking === 'bodyweight' ? '+kg' : 'kg'}</div>}
                <div className="text-center">{isDur ? 'Sec' : 'Reps'}</div>
                {settings.showRir && <div className="text-center">RIR</div>}
                <div className="grid place-items-center"><IconCheck size={14} /></div>
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {we.sets.map((s, si) => {
                  if (s.type === 'normal') n += 1;
                  return (
                    <SetRow key={s.id} set={s} index={si} number={n} ex={ex} uidKey={we.uid}
                      prev={previousSet(prevEx, we.sets, si)} carryWeight={carryWeight(we.sets, si)} showRir={settings.showRir} target={target}
                      onPatch={(p) => patchSet(ei, si, p)} onToggle={() => toggleSet(ei, si)} onMenu={() => setMenuFor(ei, si)} />
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => addSet(ei, 'normal')} className="h-11 flex-1 rounded-xl bg-raised text-[15px] font-semibold active:bg-line">+ Add set</button>
                <button onClick={() => addSet(ei, 'warmup')} className="h-11 rounded-xl bg-warm/15 px-4 text-[15px] font-semibold text-warm active:bg-warm/25">+ Warm-up</button>
              </div>
            </section>
          );
        })}
      </div>

      <Button variant="soft" className="mt-8 w-full" onClick={() => setPicker({})}>
        <span className="inline-flex items-center gap-2"><IconPlus size={20} /> Add exercise</span>
      </Button>
      {footer}

      <ExercisePicker open={!!picker} onClose={() => setPicker(null)} multi={!picker?.replace} title={picker?.replace ? 'Replace exercise' : 'Add exercises'}
        onPick={(ids) => onChange((w) => {
          if (picker?.replace) {
            const e = w.exercises.find((x) => x.uid === picker.replace);
            if (e) { e.exerciseId = ids[0]; e.sets.forEach((s) => { s.done = false; }); }
          } else {
            ids.forEach((id) => w.exercises.push({ uid: uid(), exerciseId: id, sets: [makeSet(), makeSet(), makeSet()] }));
          }
        })} />
      <ActionSheet open={!!menu} onClose={() => setMenu(null)} title={menu?.title} actions={menu?.actions ?? []} />
      <Sheet open={!!restTarget} onClose={() => setRestFor(null)} title="Rest timer" z={70}>
        {restTarget && (
          <div className="flex flex-col gap-4">
            <div className="text-[15px] text-mute">Rest after each set of {exMap.get(restTarget.exerciseId)?.name}.</div>
            <Stepper value={restTarget.restSec ?? settings.defaultRestSec} step={15} min={0} max={600} suffix="s"
              onChange={(v) => onChange((w) => { const e = w.exercises.find((x) => x.uid === restFor); if (e) e.restSec = v; })} />
            <div className="text-center font-display text-[28px] font-semibold tnum">{fmtClock(restTarget.restSec ?? settings.defaultRestSec)}</div>
            <Button onClick={() => setRestFor(null)}>Done</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Elapsed timer for the header. */
export function Elapsed({ since, className }: { since: number; className?: string }) {
  const now = useNow(1000);
  return <span className={cx('tnum', className)}>{fmtClock((now - since) / 1000)}</span>;
}
