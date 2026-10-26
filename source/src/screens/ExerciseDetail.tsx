import { useMemo, useState } from 'react';
import { useExerciseMap, useStore } from '../store';
import { useNav } from '../nav';
import { Confirm, Page, Segmented, Button, cx } from '../ui/kit';
import { LineChart } from '../ui/charts';
import { exerciseSeries, formatSet, prsForWorkout, setE1rm, setLoad, setVolume, sortedWorkouts } from '../lib/stats';
import { fmtDate, fmtNum } from '../lib/util';
import { ExerciseForm } from './ExerciseForm';
import { IconTrophy } from '../ui/icons';

export function ExerciseDetail({ id }: { id: string }) {
  const exMap = useExerciseMap();
  const ex = exMap.get(id);
  const workouts = useStore((s) => s.data.workouts);
  const bw = useStore((s) => s.data.settings.bodyweight);
  const delEx = useStore((s) => s.deleteExercise);
  const { pop, push, showToast } = useNav();
  const [metric, setMetric] = useState<'e1rm' | 'best' | 'volume' | 'reps'>(ex?.tracking === 'weight' ? 'e1rm' : 'reps');
  const [confirmDel, setConfirmDel] = useState(false);

  const series = useMemo(() => exerciseSeries(id, workouts, exMap, bw), [id, workouts, exMap, bw]);
  const sessions = useMemo(() => sortedWorkouts(workouts).filter((w) => w.exercises.some((e) => e.exerciseId === id)), [workouts, id]);
  const prSets = useMemo(() => {
    const s = new Set<string>();
    sessions.forEach((w) => prsForWorkout(w, workouts, exMap, bw).forEach((h) => h.exerciseId === id && s.add(h.setId)));
    return s;
  }, [sessions, workouts, exMap, bw, id]);

  const records = useMemo(() => {
    let e = 0, w = 0, v = 0, r = 0;
    let eSet = '', wSet = '', vSet = '', rSet = '';
    for (const wo of workouts) for (const we of wo.exercises) {
      if (we.exerciseId !== id) continue;
      for (const s of we.sets) {
        if (!s.done || s.type === 'warmup') continue;
        const se = setE1rm(s, ex, bw) ?? 0, sl = setLoad(s, ex, bw) ?? 0, sv = setVolume(s, ex, bw), sr = s.reps ?? 0;
        if (se > e) { e = se; eSet = formatSet(s, ex); }
        if (sl > w) { w = sl; wSet = formatSet(s, ex); }
        if (sv > v) { v = sv; vSet = formatSet(s, ex); }
        if (sr > r) { r = sr; rSet = formatSet(s, ex); }
      }
    }
    return { e, w, v, r, eSet, wSet, vSet, rSet };
  }, [workouts, id, ex, bw]);

  if (!ex) return <Page title="Exercise" onBack={pop}><div className="gutter py-10 text-mute">This exercise no longer exists.</div></Page>;

  const pts = series.map((p) => ({ x: p.ts, y: (metric === 'e1rm' ? p.e1rm : metric === 'best' ? p.best : metric === 'volume' ? p.volume : p.reps) ?? 0 })).filter((p) => p.y > 0);
  const unit = metric === 'reps' ? (ex.tracking === 'duration' ? 's' : ' reps') : ' kg';
  const opts = ex.tracking === 'duration'
    ? [{ value: 'reps' as const, label: 'Longest' }]
    : ex.tracking === 'bodyweight' && !bw
      ? [{ value: 'reps' as const, label: 'Reps' }, { value: 'best' as const, label: 'Added kg' }]
      : [{ value: 'e1rm' as const, label: 'e1RM' }, { value: 'best' as const, label: 'Heaviest' }, { value: 'volume' as const, label: 'Volume' }, { value: 'reps' as const, label: 'Reps' }];

  return (
    <Page title={ex.name} onBack={pop}
      right={<button className="px-2 text-[16px] font-semibold text-accent" onClick={() => push({ kind: 'exerciseEdit', id: ex.id })}>Edit</button>}>
      <div className="gutter py-4 pb-16">
        <div className="flex flex-wrap gap-1.5">
          {ex.primary.map((m) => <span key={m} className="rounded-full bg-accent/15 px-2.5 py-1 text-[13px] font-semibold text-accent">{m}</span>)}
          {ex.secondary.map((m) => <span key={m} className="rounded-full bg-raised px-2.5 py-1 text-[13px] font-semibold text-mute">{m}</span>)}
          <span className="rounded-full bg-raised px-2.5 py-1 text-[13px] font-semibold text-mute">{ex.equipment}</span>
        </div>
        {ex.notes && <p className="mt-3 text-[15px] text-mute">{ex.notes}</p>}

        {ex.tracking !== 'duration' && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {ex.tracking === 'weight' || bw ? (
              <>
                <Rec label="Best e1RM" value={records.e ? `${fmtNum(records.e)} kg` : '–'} sub={records.eSet} />
                <Rec label="Heaviest" value={records.w ? `${fmtNum(records.w)} kg` : '–'} sub={records.wSet} />
              </>
            ) : (
              <>
                <Rec label="Most reps" value={records.r ? String(records.r) : '–'} sub={records.rSet} />
                <Rec label="Most added" value={records.w ? `+${fmtNum(records.w)} kg` : '–'} sub={records.wSet} />
              </>
            )}
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-surface p-4">
          {opts.length > 1 && <Segmented value={metric} onChange={setMetric} options={opts} className="mb-3" />}
          <LineChart points={pts} unit={unit} />
        </div>

        <h2 className="mt-8 font-display text-[22px] font-semibold tracking-wide">History</h2>
        <div className="mt-3 flex flex-col gap-2">
          {sessions.map((w) => (
            <button key={w.id} onClick={() => push({ kind: 'workout', id: w.id })} className="rounded-2xl bg-surface p-4 text-left active:bg-raised">
              <div className="flex items-baseline justify-between gap-2">
                <div className="truncate text-[15px] font-semibold">{w.name}</div>
                <div className="shrink-0 text-[13px] text-mute">{fmtDate(w.startedAt)}</div>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets).map((s, i) => (
                  <div key={s.id} className="tnum flex items-center gap-2 text-[15px]">
                    <span className={cx('w-6 text-center text-[13px] font-bold', s.type === 'warmup' ? 'text-warm' : 'text-mute')}>{s.type === 'warmup' ? 'W' : i + 1}</span>
                    <span>{formatSet(s, ex, true)}</span>
                    {prSets.has(s.id) && <IconTrophy size={15} className="text-gold" />}
                  </div>
                ))}
              </div>
            </button>
          ))}
          {sessions.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-[15px] text-mute">No sessions logged for this exercise yet.</div>}
        </div>
        {ex.custom && (
          <Button variant="danger" className="mt-8 w-full" onClick={() => setConfirmDel(true)}>Delete exercise</Button>
        )}
      </div>
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} danger title="Delete exercise?" confirmLabel="Delete"
        body="Only possible when no routine or logged workout uses it."
        onConfirm={() => { if (delEx(ex.id)) { showToast('Exercise deleted'); pop(); } else showToast('It’s used in a routine or workout, so it was kept'); }} />
    </Page>
  );
}

function Rec({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="label">{label}</div>
      <div className="tnum mt-1 font-display text-[26px] font-bold leading-none">{value}</div>
      {sub && <div className="tnum mt-1 text-[13px] text-mute">{sub}</div>}
    </div>
  );
}

export function ExerciseEditPage({ id }: { id: string | null }) {
  const ex = useStore((s) => (id ? s.data.exercises.find((e) => e.id === id) ?? null : null));
  const { pop, replace } = useNav();
  return (
    <Page title={id ? 'Edit exercise' : 'New exercise'} onBack={pop} back="close">
      <div className="gutter py-4 pb-16">
        <ExerciseForm initial={ex} onDone={(nid) => { if (nid && !id) replace({ kind: 'exercise', id: nid }); else pop(); }} />
      </div>
    </Page>
  );
}
