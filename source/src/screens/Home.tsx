import { useMemo } from 'react';
import { useExerciseMap, useStore } from '../store';
import { useNav } from '../nav';
import { Button, cx } from '../ui/kit';
import { IconChevron, IconPlus } from '../ui/icons';
import { Elapsed } from './WorkoutLogger';
import { prsForWorkout, sortedWorkouts, workoutDuration, workoutSetCount, workoutVolume } from '../lib/stats';
import { addDays, fmtDate, fmtDuration, fmtKg, fmtRelative, startOfDay, startOfWeek } from '../lib/util';
import type { Template, Workout } from '../types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function lastPerformed(templateId: string, workouts: Workout[]) {
  let t = 0;
  for (const w of workouts) if (w.templateId === templateId && w.startedAt > t) t = w.startedAt;
  return t || null;
}

export function WorkoutRow({ w, onClick }: { w: Workout; onClick: () => void }) {
  const exMap = useExerciseMap();
  const workouts = useStore((s) => s.data.workouts);
  const bw = useStore((s) => s.data.settings.bodyweight);
  const prs = useMemo(() => prsForWorkout(w, workouts, exMap, bw).length, [w, workouts, exMap, bw]);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left active:bg-raised">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-raised">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-mute">{fmtDate(w.startedAt, { month: 'short' })}</span>
        <span className="tnum font-display text-[20px] font-bold leading-none">{new Date(w.startedAt).getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold">{w.name}</div>
        <div className="tnum truncate text-[13px] text-mute">
          {fmtDuration(workoutDuration(w))} · {workoutSetCount(w)} sets · {fmtKg(workoutVolume(w, exMap, bw))}
        </div>
      </div>
      {prs > 0 && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[12px] font-bold text-gold">{prs} PR</span>}
      <IconChevron size={18} className="text-mute" />
    </button>
  );
}

export function Home() {
  const data = useStore((s) => s.data);
  const start = useStore((s) => s.startWorkout);
  const setOpen = useStore((s) => s.setWorkoutOpen);
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const exMap = useExerciseMap();
  const now = Date.now();
  const today = DAYS[new Date(now).getDay()];
  const workouts = useMemo(() => sortedWorkouts(data.workouts), [data.workouts]);

  const todays = data.templates.find((t) => t.day === today);
  const doneToday = todays && workouts.some((w) => w.templateId === todays.id && startOfDay(w.startedAt) === startOfDay(now));
  const nextUp: { t: Template; day: string } | null = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
      const d = DAYS[(new Date(now).getDay() + i) % 7];
      const t = data.templates.find((x) => x.day === d);
      if (t) return { t, day: i === 1 ? 'Tomorrow' : d };
    }
    return null;
  }, [data.templates, now]);

  const wk = startOfWeek(now);
  const weekWs = workouts.filter((w) => w.startedAt >= wk);
  const weekVol = weekWs.reduce((v, w) => v + workoutVolume(w, exMap, data.settings.bodyweight), 0);
  const weekSets = weekWs.reduce((v, w) => v + workoutSetCount(w), 0);
  const trainedDays = new Set(weekWs.map((w) => startOfDay(w.startedAt)));

  const hero = todays && !doneToday ? todays : null;

  return (
    <div className="gutter pb-8 pt-4">
      <div className="label">{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <h1 className="mt-1 font-display text-[34px] font-bold leading-none tracking-wide">Ironbook</h1>

      {data.active && (
        <button onClick={() => setOpen(true)} className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-done/15 p-4 text-left active:bg-done/25">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-done opacity-60" /><span className="relative h-3 w-3 rounded-full bg-done" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold uppercase tracking-wider text-done">Workout in progress</div>
            <div className="truncate text-[17px] font-semibold">{data.active.name}</div>
          </div>
          <Elapsed since={data.active.startedAt} className="font-display text-[22px] font-semibold" />
        </button>
      )}

      {!data.active && (
        <div className="mt-5 overflow-hidden rounded-3xl bg-surface">
          {hero ? (
            <div className="p-5">
              <div className="label text-accent">Today · {today}</div>
              <div className="mt-1 font-display text-[28px] font-bold leading-tight tracking-wide">{hero.name}</div>
              <div className="mt-2 text-[14px] leading-relaxed text-mute">
                {hero.exercises.map((e) => exMap.get(e.exerciseId)?.name.replace(/ \(.*\)/, '')).join(' · ')}
              </div>
              <div className="mt-1 text-[13px] text-mute">
                {(() => { const lp = lastPerformed(hero.id, workouts); return lp ? `Last done ${fmtRelative(lp).toLowerCase()}` : 'Not done yet'; })()}
              </div>
              <Button className="mt-4 w-full text-[17px]" onClick={() => start(hero.id)}>Start workout</Button>
            </div>
          ) : (
            <div className="p-5">
              <div className="label">{doneToday ? 'Done for today' : `Today · ${today}`}</div>
              <div className="mt-1 font-display text-[26px] font-bold tracking-wide">{doneToday ? 'Session logged' : 'Rest day'}</div>
              {nextUp && (
                <button onClick={() => push({ kind: 'template', id: nextUp.t.id })} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-raised p-3.5 text-left active:bg-line">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-mute">Next · {nextUp.day}</div>
                    <div className="truncate text-[16px] font-semibold">{nextUp.t.name}</div>
                  </div>
                  <IconChevron size={18} className="text-mute" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => { if (data.active) setOpen(true); else setTab('workouts'); }}>Choose routine</Button>
        <Button variant="ghost" onClick={() => start(null)} disabled={!!data.active}>
          <span className="inline-flex items-center gap-1.5"><IconPlus size={18} /> Empty workout</span>
        </Button>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[22px] font-semibold tracking-wide">This week</h2>
          <span className="tnum text-[14px] text-mute">{weekWs.length} workout{weekWs.length === 1 ? '' : 's'}</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(wk, i);
            const on = trainedDays.has(d);
            const isToday = d === startOfDay(now);
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={cx('text-[11px] font-semibold uppercase', isToday ? 'text-fg' : 'text-mute')}>{fmtDate(d, { weekday: 'narrow' })}</span>
                <span className={cx('grid h-9 w-9 place-items-center rounded-full text-[14px] font-semibold tnum',
                  on ? 'bg-accent text-white' : isToday ? 'border-2 border-accent text-fg' : 'bg-raised text-mute')}>
                  {new Date(d).getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-4">
            <div className="label">Working sets</div>
            <div className="tnum mt-1 font-display text-[30px] font-bold leading-none">{weekSets}</div>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <div className="label">Volume</div>
            <div className="tnum mt-1 font-display text-[30px] font-bold leading-none">{fmtKg(weekVol)}</div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[22px] font-semibold tracking-wide">Recent</h2>
          {workouts.length > 0 && <button className="text-[15px] font-semibold text-accent" onClick={() => setTab('history')}>See all</button>}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {workouts.slice(0, 3).map((w) => <WorkoutRow key={w.id} w={w} onClick={() => push({ kind: 'workout', id: w.id })} />)}
          {workouts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-5 text-[15px] text-mute">
              Finished workouts show up here with duration, sets, volume and any PRs.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
