import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { MUSCLES, type Exercise, type Muscle } from '../types';
import { Button, Sheet, cx, inputCls } from '../ui/kit';
import { IconCheck, IconPlus, IconSearch } from '../ui/icons';
import { ExerciseForm } from './ExerciseForm';

export function matchExercise(e: Exercise, q: string, muscle: Muscle | 'All') {
  if (muscle !== 'All' && !e.primary.includes(muscle) && !e.secondary.includes(muscle)) return false;
  if (!q) return true;
  const hay = `${e.name} ${e.equipment} ${e.primary.join(' ')}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

export function MuscleChips({ value, onChange }: { value: Muscle | 'All'; onChange: (m: Muscle | 'All') => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {(['All', ...MUSCLES] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)}
          className={cx('h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold', value === m ? 'bg-fg text-bg' : 'bg-raised text-mute')}>
          {m}
        </button>
      ))}
    </div>
  );
}

export function ExercisePicker({ open, onClose, onPick, multi = true, title = 'Add exercises' }: {
  open: boolean; onClose: () => void; onPick: (ids: string[]) => void; multi?: boolean; title?: string;
}) {
  const exercises = useStore((s) => s.data.exercises);
  const workouts = useStore((s) => s.data.workouts);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'All'>('All');
  const [sel, setSel] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    workouts.forEach((w) => w.exercises.forEach((e) => m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1)));
    return m;
  }, [workouts]);

  const list = useMemo(() => exercises
    .filter((e) => matchExercise(e, q, muscle))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name)), [exercises, q, muscle, usage]);

  const close = () => { setSel([]); setQ(''); onClose(); };
  const commit = (ids: string[]) => { onPick(ids); close(); };

  return (
    <>
      <Sheet open={open} onClose={close} title={title} z={65}>
        <div className="relative mb-2">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" size={18} />
          <input id="picker-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className={cx(inputCls, 'pl-10')} />
        </div>
        <MuscleChips value={muscle} onChange={setMuscle} />
        <button onClick={() => setCreating(true)} className="mt-2 flex min-h-[48px] w-full items-center gap-2 rounded-xl px-2 font-semibold text-accent active:bg-raised">
          <IconPlus size={20} /> Create custom exercise
        </button>
        <div className="mt-1 flex flex-col">
          {list.map((e) => {
            const on = sel.includes(e.id);
            return (
              <button key={e.id}
                onClick={() => multi ? setSel((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id])) : commit([e.id])}
                className={cx('flex min-h-[58px] items-center gap-3 rounded-xl px-2 text-left active:bg-raised', on && 'bg-accent/10')}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{e.name}</div>
                  <div className="truncate text-[13px] text-mute">{e.primary.join(', ')} · {e.equipment}{usage.get(e.id) ? ` · ${usage.get(e.id)}×` : ''}</div>
                </div>
                {multi && (
                  <span className={cx('grid h-7 w-7 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-white' : 'border-line')}>
                    {on && <IconCheck size={15} />}
                  </span>
                )}
              </button>
            );
          })}
          {list.length === 0 && <div className="py-8 text-center text-mute">No exercises match. Create a custom one above.</div>}
        </div>
        {multi && sel.length > 0 && (
          <div className="sticky bottom-0 -mx-4 mt-2 bg-surface px-4 pb-1 pt-2">
            <Button className="w-full" onClick={() => commit(sel)}>Add {sel.length} exercise{sel.length > 1 ? 's' : ''}</Button>
          </div>
        )}
      </Sheet>
      <Sheet open={creating} onClose={() => setCreating(false)} title="New exercise" z={75}>
        <ExerciseForm initial={null} onDone={(id) => { setCreating(false); if (id) { if (multi) setSel((s) => [...s, id]); else commit([id]); } }} />
      </Sheet>
    </>
  );
}
