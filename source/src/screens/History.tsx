import { useMemo, useState } from 'react';
import { useExerciseMap, useStore, workoutFromTemplate } from '../store';
import { useNav } from '../nav';
import { Button, Confirm, Field, Page, Segmented, cx, inputCls } from '../ui/kit';
import { IconBack, IconChevron, IconSearch, IconTrophy } from '../ui/icons';
import { WorkoutRow } from './Home';
import { PR_LABEL, formatSet, prsForWorkout, sortedWorkouts, workoutDuration, workoutSetCount, workoutVolume } from '../lib/stats';
import { deepClone, fmtDate, fmtDuration, startOfDay, uid } from '../lib/util';
import { WorkoutLogger } from './WorkoutLogger';
import type { Template, Workout } from '../types';

export function History() {
  const workouts = useStore((s) => s.data.workouts);
  const push = useNav((s) => s.push);
  const exMap = useExerciseMap();
  const [seg, setSeg] = useState<'workouts' | 'exercises'>('workouts');
  const [q, setQ] = useState('');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); });
  const [day, setDay] = useState<number | null>(null);

  const sorted = useMemo(() => sortedWorkouts(workouts), [workouts]);
  const byDay = useMemo(() => {
    const m = new Map<number, number>();
    sorted.forEach((w) => { const d = startOfDay(w.startedAt); m.set(d, (m.get(d) ?? 0) + 1); });
    return m;
  }, [sorted]);

  const ql = q.trim().toLowerCase();
  const filtered = sorted.filter((w) => {
    if (day != null && startOfDay(w.startedAt) !== day) return false;
    if (!ql) return true;
    return w.name.toLowerCase().includes(ql) || w.exercises.some((e) => exMap.get(e.exerciseId)?.name.toLowerCase().includes(ql));
  });

  const exStats = useMemo(() => {
    const m = new Map<string, { n: number; last: number }>();
    sorted.forEach((w) => w.exercises.forEach((e) => {
      const cur = m.get(e.exerciseId) ?? { n: 0, last: 0 };
      m.set(e.exerciseId, { n: cur.n + 1, last: Math.max(cur.last, w.startedAt) });
    }));
    return [...m.entries()].map(([id, v]) => ({ id, ...v, ex: exMap.get(id) }))
      .filter((r) => !ql || r.ex?.name.toLowerCase().includes(ql))
      .sort((a, b) => b.last - a.last);
  }, [sorted, exMap, ql]);

  // calendar grid (Mon-first)
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1).getTime())];
  const monthCount = sorted.filter((w) => w.startedAt >= month && w.startedAt < new Date(first.getFullYear(), first.getMonth() + 1, 1).getTime()).length;
  const today = startOfDay(Date.now());

  return (
    <div className="gutter pb-8 pt-4">
      <h1 className="font-display text-[34px] font-bold leading-none tracking-wide">History</h1>

      <div className="mt-4 rounded-2xl bg-surface p-3">
        <div className="flex items-center justify-between">
          <button aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-lg active:bg-raised" onClick={() => { setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1).getTime()); setDay(null); }}><IconBack size={20} /></button>
          <div className="text-center">
            <div className="font-display text-[19px] font-semibold tracking-wide">{fmtDate(month, { month: 'long', year: 'numeric' })}</div>
            <div className="text-[12px] text-mute">{monthCount} workout{monthCount === 1 ? '' : 's'}</div>
          </div>
          <button aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-lg active:bg-raised" onClick={() => { setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1).getTime()); setDay(null); }}><IconChevron size={20} /></button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="text-[11px] font-semibold text-mute">{d}</div>)}
          {cells.map((c, i) => c == null ? <div key={i} /> : (
            <button key={i} onClick={() => setDay(day === c ? null : c)} disabled={!byDay.has(c)}
              aria-label={fmtDate(c)}
              className={cx('tnum relative grid aspect-square place-items-center rounded-full text-[14px] font-semibold',
                day === c ? 'bg-fg text-bg' : byDay.has(c) ? 'bg-accent text-white' : c === today ? 'text-fg ring-1 ring-accent' : 'text-mute')}>
              {new Date(c).getDate()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" size={18} />
        <input id="history-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workouts or exercises" className={cx(inputCls, 'pl-10')} />
      </div>
      <Segmented className="mt-3" value={seg} onChange={setSeg} options={[{ value: 'workouts', label: 'Workouts' }, { value: 'exercises', label: 'By exercise' }]} />

      {seg === 'workouts' ? (
        <div className="mt-4 flex flex-col gap-2">
          {day != null && (
            <button onClick={() => setDay(null)} className="self-start rounded-full bg-raised px-3 py-1.5 text-[13px] font-semibold">
              {fmtDate(day, { weekday: 'short', day: 'numeric', month: 'short' })} ✕
            </button>
          )}
          {filtered.map((w) => <WorkoutRow key={w.id} w={w} onClick={() => push({ kind: 'workout', id: w.id })} />)}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-5 text-[15px] text-mute">
              {sorted.length === 0 ? 'No workouts yet. Start one from Home or Workouts.' : 'Nothing matches that search.'}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col">
          {exStats.map((r) => (
            <button key={r.id} onClick={() => push({ kind: 'exercise', id: r.id })} className="flex min-h-[60px] items-center gap-3 border-b border-line/50 text-left active:bg-raised">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{r.ex?.name ?? 'Deleted exercise'}</div>
                <div className="text-[13px] text-mute">{r.n} session{r.n === 1 ? '' : 's'} · last {fmtDate(r.last, { day: 'numeric', month: 'short' })}</div>
              </div>
              <IconChevron size={18} className="text-mute" />
            </button>
          ))}
          {exStats.length === 0 && <div className="py-8 text-center text-mute">No logged exercises yet.</div>}
        </div>
      )}
    </div>
  );
}

export function WorkoutDetail({ id, celebrate = false }: { id: string; celebrate?: boolean }) {
  const w = useStore((s) => s.data.workouts.find((x) => x.id === id));
  const workouts = useStore((s) => s.data.workouts);
  const bw = useStore((s) => s.data.settings.bodyweight);
  const active = useStore((s) => s.data.active);
  const del = useStore((s) => s.deleteWorkout);
  const upsertTemplate = useStore((s) => s.upsertTemplate);
  const exMap = useExerciseMap();
  const { pop, push, replace, showToast } = useNav();
  const [confirmDel, setConfirmDel] = useState(false);
  const prs = useMemo(() => (w ? prsForWorkout(w, workouts, exMap, bw) : []), [w, workouts, exMap, bw]);
  if (!w) return <Page title="Workout" onBack={pop}><div className="gutter py-10 text-mute">This workout was deleted.</div></Page>;
  const prBySet = new Map(prs.map((p) => [p.setId, p.kinds]));

  const saveAsRoutine = () => {
    const t: Template = {
      id: uid(), name: w.name, createdAt: Date.now(), updatedAt: Date.now(),
      exercises: w.exercises.map((e) => {
        const working = e.sets.filter((s) => s.type === 'normal');
        const reps = working.map((s) => s.reps ?? 0).filter(Boolean);
        return {
          uid: uid(), exerciseId: e.exerciseId, sets: Math.max(1, working.length), warmups: e.sets.length - working.length,
          repMin: e.repMin ?? (reps.length ? Math.min(...reps) : 8), repMax: e.repMax ?? (reps.length ? Math.max(...reps) : 12),
          restSec: e.restSec, supersetId: e.supersetId,
        };
      }),
    };
    upsertTemplate(t);
    showToast('Saved as a new routine');
  };

  const repeat = () => {
    if (active) { showToast('Finish or cancel the current workout first'); return; }
    const nw = workoutFromTemplate(null);
    nw.name = w.name;
    nw.templateId = w.templateId;
    nw.exercises = w.exercises.map((e) => ({ ...deepClone(e), uid: uid(), notes: undefined, sets: e.sets.map((s) => ({ ...s, id: uid(), done: false, weight: null, reps: null, rir: null })) }));
    useStore.setState((st) => ({ data: { ...st.data, active: nw }, workoutOpen: true }));
  };

  return (
    <Page title={celebrate ? 'Workout saved' : w.name} onBack={pop} back={celebrate ? 'close' : 'back'}
      right={<button className="px-2 text-[16px] font-semibold text-accent" onClick={() => push({ kind: 'workoutEdit', id: w.id })}>Edit</button>}>
      <div className="gutter py-4 pb-16">
        {celebrate && (
          <div className="mb-5 rounded-3xl bg-done/15 p-5">
            <div className="label text-done">Session complete</div>
            <div className="mt-1 font-display text-[28px] font-bold leading-tight tracking-wide">{w.name}</div>
            <div className="mt-1 text-[15px] text-mute">
              {prs.length ? `${prs.length} personal record${prs.length > 1 ? 's' : ''} this session.` : 'Saved to history. Progress charts are updated.'}
            </div>
          </div>
        )}
        {!celebrate && <div className="text-[15px] text-mute">{fmtDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {new Date(w.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat label="Time" value={fmtDuration(workoutDuration(w))} />
          <Stat label="Sets" value={String(workoutSetCount(w))} />
          <Stat label="Vol kg" value={(() => { const v = workoutVolume(w, exMap, bw); return v >= 10000 ? `${(v / 1000).toFixed(1)}t` : Math.round(v).toLocaleString(); })()} />
          <Stat label="PRs" value={String(prs.length)} gold={prs.length > 0} />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {w.exercises.map((e) => {
            const ex = exMap.get(e.exerciseId);
            let n = 0;
            return (
              <div key={e.uid} className="rounded-2xl bg-surface p-4">
                <button className="text-left font-display text-[19px] font-semibold tracking-wide text-accent" onClick={() => push({ kind: 'exercise', id: e.exerciseId })}>
                  {ex?.name ?? 'Deleted exercise'}{e.supersetId && <span className="ml-2 text-[12px] font-sans font-semibold uppercase text-mute">superset</span>}
                </button>
                {e.notes && <div className="mt-1 text-[14px] italic text-mute">{e.notes}</div>}
                <div className="mt-2 flex flex-col gap-1.5">
                  {e.sets.map((s) => {
                    if (s.type === 'normal') n++;
                    const kinds = prBySet.get(s.id);
                    return (
                      <div key={s.id} className="tnum flex items-center gap-3 text-[15px]">
                        <span className={cx('w-6 text-center text-[13px] font-bold', s.type === 'warmup' ? 'text-warm' : 'text-mute')}>{s.type === 'warmup' ? 'W' : n}</span>
                        <span className="flex-1">{formatSet(s, ex, true)}</span>
                        {kinds && <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[12px] font-bold text-gold"><IconTrophy size={13} />{kinds.map((k) => PR_LABEL[k]).join(' · ')}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {w.exercises.length === 0 && <div className="text-mute">No sets in this workout.</div>}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {celebrate && <Button onClick={() => replace({ kind: 'workout', id: w.id })}>Done</Button>}
          <Button variant="ghost" onClick={repeat}>Repeat this workout</Button>
          <Button variant="ghost" onClick={saveAsRoutine}>Save as routine</Button>
          <Button variant="danger" onClick={() => setConfirmDel(true)}>Delete workout</Button>
        </div>
      </div>
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} danger title="Delete workout?" body="It will be removed from history and progress charts."
        confirmLabel="Delete workout" onConfirm={() => { del(w.id); showToast('Workout deleted'); pop(); }} />
    </Page>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-3 text-center">
      <div className={cx('tnum truncate font-display text-[19px] font-bold leading-none', gold && 'text-gold')}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">{label}</div>
    </div>
  );
}

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function WorkoutEdit({ id }: { id: string }) {
  const original = useStore((s) => s.data.workouts.find((x) => x.id === id));
  const upsert = useStore((s) => s.upsertWorkout);
  const { pop, showToast } = useNav();
  const [draft, setDraft] = useState<Workout | null>(() => (original ? deepClone(original) : null));
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!original || !draft) return <Page title="Edit workout" onBack={pop}><div className="gutter py-10 text-mute">Workout not found.</div></Page>;
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const durMin = Math.round(((draft.endedAt ?? draft.startedAt) - draft.startedAt) / 60000);

  const save = () => {
    const w = deepClone(draft);
    // In edit mode a set with reps entered counts as done.
    w.exercises = w.exercises
      .map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: s.done || s.reps != null })).filter((s) => s.done) }))
      .filter((e) => e.sets.length);
    upsert(w);
    showToast('Workout updated');
    pop();
  };

  return (
    <Page title="Edit workout" back="close" onBack={() => (dirty ? setConfirmLeave(true) : pop())}
      right={<button className="px-2 text-[16px] font-semibold text-accent" onClick={save}>Save</button>}>
      <div className="pt-4">
        <WorkoutLogger workout={draft} mode="edit"
          onChange={(fn) => setDraft((d) => { if (!d) return d; const n = deepClone(d); fn(n); return n; })}
          header={
            <div className="mb-6 flex flex-col gap-3">
              <Field label="Name">
                <input id="edit-name" className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <Field label="Started">
                  <input id="edit-start" type="datetime-local" className={inputCls} value={toLocalInput(draft.startedAt)}
                    onChange={(e) => { const t = new Date(e.target.value).getTime(); if (!Number.isNaN(t)) setDraft({ ...draft, startedAt: t, endedAt: t + durMin * 60000 }); }} />
                </Field>
                <Field label="Minutes">
                  <input id="edit-dur" inputMode="numeric" className={inputCls} value={durMin}
                    onChange={(e) => { const m = Number(e.target.value.replace(/\D/g, '')) || 0; setDraft({ ...draft, endedAt: draft.startedAt + m * 60000 }); }} />
                </Field>
              </div>
              <div className="text-[13px] text-mute">Sets with reps entered are saved; empty sets are dropped.</div>
            </div>
          }
          footer={<Button className="mt-3 w-full" onClick={save}>Save changes</Button>}
        />
      </div>
      <Confirm open={confirmLeave} onClose={() => setConfirmLeave(false)} danger title="Discard changes?" confirmLabel="Discard changes" onConfirm={pop} />
    </Page>
  );
}

