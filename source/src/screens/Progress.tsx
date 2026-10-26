import { useMemo, useState } from 'react';
import { useExerciseMap, useStore } from '../store';
import { useNav } from '../nav';
import { Segmented, cx, inputCls } from '../ui/kit';
import { BarChart, LineChart } from '../ui/charts';
import { IconBack, IconChevron, IconTrophy } from '../ui/icons';
import { PR_LABEL, exerciseSeries, formatSet, hardSetsByMuscle, prsForWorkout, workoutVolume, type ExPoint } from '../lib/stats';
import { DAY_MS, addDays, fmtDate, fmtNum, startOfWeek } from '../lib/util';
import type { Muscle, Workout } from '../types';

type Range = '4w' | '3m' | '6m' | '1y' | 'all';
const RANGE_DAYS: Record<Range, number> = { '4w': 28, '3m': 91, '6m': 182, '1y': 365, all: 0 };
const BIG4 = [
  { id: 'bench-press', label: 'Bench' },
  { id: 'squat', label: 'Squat' },
  { id: 'deadlift', label: 'Deadlift' },
  { id: 'shoulder-press', label: 'Shoulder press' },
];

function rangeStart(r: Range, workouts: Workout[], now: number) {
  if (r === 'all') return workouts.length ? Math.min(...workouts.map((w) => w.startedAt)) : now - 28 * DAY_MS;
  return now - RANGE_DAYS[r] * DAY_MS;
}

function best(pts: ExPoint[], from: number, to: number) {
  let b = 0;
  for (const p of pts) if (p.ts >= from && p.ts < to) b = Math.max(b, p.e1rm ?? 0);
  return b || null;
}

function Delta({ cur, prev, unit = 'kg' }: { cur: number | null; prev: number | null; unit?: string }) {
  if (cur == null || prev == null) return <span className="text-[12px] text-mute">no prior data</span>;
  const d = cur - prev;
  const pct = prev ? (d / prev) * 100 : 0;
  return (
    <span className={cx('tnum text-[12px] font-semibold', d > 0.05 ? 'text-done' : d < -0.05 ? 'text-danger' : 'text-mute')}>
      {d > 0 ? '▲' : d < 0 ? '▼' : '•'} {fmtNum(Math.abs(d))} {unit} ({pct >= 0 ? '+' : ''}{fmtNum(pct, 1)}%)
    </span>
  );
}

function Spark({ pts }: { pts: number[] }) {
  if (pts.length < 2) return <div className="h-8" />;
  const min = Math.min(...pts), max = Math.max(...pts);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <path d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Progress() {
  const workouts = useStore((s) => s.data.workouts);
  const bw = useStore((s) => s.data.settings.bodyweight);
  const exMap = useExerciseMap();
  const push = useNav((s) => s.push);
  const [range, setRange] = useState<Range>('3m');
  const [compare, setCompare] = useState(true);
  const [exId, setExId] = useState(() => {
    const has = (id: string) => workouts.some((w) => w.exercises.some((e) => e.exerciseId === id));
    if (has('bench-press')) return 'bench-press';
    const counts = new Map<string, number>();
    workouts.forEach((w) => w.exercises.forEach((e) => counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'bench-press';
  });
  const [metric, setMetric] = useState<'e1rm' | 'best' | 'volume'>('e1rm');
  const [weekOffset, setWeekOffset] = useState(0);

  const now = Date.now();
  const from = rangeStart(range, workouts, now);
  const span = now - from;
  const prevFrom = from - span;

  const usedIds = useMemo(() => {
    const m = new Map<string, number>();
    workouts.forEach((w) => w.exercises.forEach((e) => m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [workouts]);

  const seriesCache = useMemo(() => {
    const m = new Map<string, ExPoint[]>();
    [...new Set([...BIG4.map((b) => b.id), exId])].forEach((id) => m.set(id, exerciseSeries(id, workouts, exMap, bw)));
    return m;
  }, [workouts, exMap, bw, exId]);

  const allPrs = useMemo(() => {
    const out: { w: Workout; setId: string; exerciseId: string; kinds: string[] }[] = [];
    workouts.forEach((w) => prsForWorkout(w, workouts, exMap, bw).forEach((h) => out.push({ w, ...h })));
    return out.sort((a, b) => b.w.startedAt - a.w.startedAt);
  }, [workouts, exMap, bw]);
  const prWorkoutsForEx = useMemo(() => new Set(allPrs.filter((p) => p.exerciseId === exId).map((p) => p.w.id)), [allPrs, exId]);

  const series = seriesCache.get(exId) ?? [];
  const val = (p: ExPoint) => (metric === 'e1rm' ? p.e1rm : metric === 'best' ? p.best : p.volume) ?? 0;
  const cur = series.filter((p) => p.ts >= from).map((p) => ({ x: p.ts, y: val(p), highlight: prWorkoutsForEx.has(p.workoutId) })).filter((p) => p.y > 0);
  const prev = series.filter((p) => p.ts >= prevFrom && p.ts < from).map((p) => ({ x: p.ts, y: val(p) })).filter((p) => p.y > 0);
  const curBest = cur.length ? Math.max(...cur.map((p) => p.y)) : null;
  const prevBest = prev.length ? Math.max(...prev.map((p) => p.y)) : null;

  // Buckets: weekly up to 6 months, monthly beyond.
  const monthly = range === '1y' || (range === 'all' && span > 200 * DAY_MS);
  const buckets = useMemo(() => {
    const list: { start: number; end: number; label: string; vol: number; n: number }[] = [];
    if (monthly) {
      const d = new Date(from); d.setDate(1); d.setHours(0, 0, 0, 0);
      while (d.getTime() <= now) {
        const s = d.getTime(); const e = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
        list.push({ start: s, end: e, label: fmtDate(s, { month: 'narrow' }), vol: 0, n: 0 });
        d.setMonth(d.getMonth() + 1);
      }
    } else {
      const weeks = Math.min(26, Math.max(8, Math.ceil(span / (7 * DAY_MS))));
      const tw = startOfWeek(now);
      for (let i = weeks - 1; i >= 0; i--) {
        const s = addDays(tw, -7 * i);
        list.push({ start: s, end: addDays(s, 7), label: fmtDate(s, { day: 'numeric', month: 'numeric' }), vol: 0, n: 0 });
      }
    }
    for (const w of workouts) {
      const b = list.find((x) => w.startedAt >= x.start && w.startedAt < x.end);
      if (b) { b.vol += workoutVolume(w, exMap, bw); b.n += 1; }
    }
    return list;
  }, [workouts, from, now, span, monthly, exMap, bw]);

  const weekStart = addDays(startOfWeek(now), -7 * weekOffset);
  const muscleSets = useMemo(() => hardSetsByMuscle(workouts, weekStart, addDays(weekStart, 7), exMap), [workouts, weekStart, exMap]);
  const muscleAvg = useMemo(() => {
    const m = hardSetsByMuscle(workouts, addDays(weekStart, -28), weekStart, exMap);
    m.forEach((v, k) => m.set(k, v / 4));
    return m;
  }, [workouts, weekStart, exMap]);
  const muscles = ([...new Set([...muscleSets.keys(), ...muscleAvg.keys()])] as Muscle[])
    .sort((a, b) => (muscleSets.get(b) ?? 0) - (muscleSets.get(a) ?? 0) || (muscleAvg.get(b) ?? 0) - (muscleAvg.get(a) ?? 0));
  const maxSets = Math.max(20, ...muscles.map((m) => Math.max(muscleSets.get(m) ?? 0, muscleAvg.get(m) ?? 0)));

  const exOptions = [...new Set([...BIG4.map((b) => b.id), ...usedIds])].filter((id) => exMap.has(id));
  const rangePrs = allPrs.filter((p) => p.w.startedAt >= from);

  return (
    <div className="gutter pb-8 pt-4">
      <h1 className="font-display text-[34px] font-bold leading-none tracking-wide">Progress</h1>
      <Segmented className="mt-4" value={range} onChange={setRange} options={[
        { value: '4w', label: '4W' }, { value: '3m', label: '3M' }, { value: '6m', label: '6M' }, { value: '1y', label: '1Y' }, { value: 'all', label: 'All' },
      ]} />
      <label className="mt-3 flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-[15px]">Compare with previous {range === 'all' ? 'period' : range.toUpperCase()}</span>
        <input id="compare" type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-6 w-6 accent-[rgb(var(--accent))]" />
      </label>

      {workouts.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-5 text-[15px] text-mute">
          Charts fill in automatically as you finish workouts. Log your first session and come back.
        </div>
      )}

      <section className="mt-6">
        <h2 className="font-display text-[22px] font-semibold tracking-wide">Main lifts · e1RM</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {BIG4.map((b) => {
            const pts = seriesCache.get(b.id) ?? [];
            const c = best(pts, from, now + 1);
            const p = best(pts, prevFrom, from);
            const spark = pts.filter((x) => x.ts >= from && x.e1rm).map((x) => x.e1rm!);
            return (
              <button key={b.id} onClick={() => { setExId(b.id); setMetric('e1rm'); document.getElementById('ex-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className={cx('rounded-2xl bg-surface p-3.5 text-left active:bg-raised', exId === b.id && 'ring-2 ring-accent')}>
                <div className="label">{b.label}</div>
                <div className="tnum mt-1 font-display text-[26px] font-bold leading-none">{c ? `${fmtNum(c)}` : '–'}<span className="ml-1 text-[14px] font-medium text-mute">kg</span></div>
                <div className="mt-1 h-4">{compare ? <Delta cur={c} prev={p} /> : null}</div>
                <Spark pts={spark} />
              </button>
            );
          })}
        </div>
      </section>

      <section id="ex-chart" className="mt-8 scroll-mt-4">
        <h2 className="font-display text-[22px] font-semibold tracking-wide">Exercise progress</h2>
        <div className="mt-3 rounded-2xl bg-surface p-4">
          <select id="ex-select" aria-label="Exercise" value={exId} onChange={(e) => setExId(e.target.value)} className={cx(inputCls, 'mb-3 font-semibold')}>
            {exOptions.map((id) => <option key={id} value={id}>{exMap.get(id)?.name}</option>)}
          </select>
          <Segmented value={metric} onChange={setMetric} className="mb-3" options={[
            { value: 'e1rm', label: 'Est. 1RM' }, { value: 'best', label: 'Top weight' }, { value: 'volume', label: 'Volume' },
          ]} />
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <div className="tnum font-display text-[24px] font-bold">{curBest ? `${fmtNum(curBest)} kg` : '–'}</div>
            {compare && <Delta cur={curBest} prev={prevBest} />}
          </div>
          <LineChart points={cur} compare={compare ? prev : undefined} unit=" kg" />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-mute">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-accent" /> This period</span>
            {compare && <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-mute" /> Previous period</span>}
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gold" /> PR session</span>
          </div>
          <button onClick={() => push({ kind: 'exercise', id: exId })} className="mt-3 text-[15px] font-semibold text-accent">Full exercise history →</button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-[22px] font-semibold tracking-wide">Training volume</h2>
        <div className="mt-3 rounded-2xl bg-surface p-4">
          <div className="mb-1 text-[13px] text-mute">kg lifted per {monthly ? 'month' : 'week'} (working sets)</div>
          <BarChart values={buckets.map((b) => b.vol)} labels={buckets.map((b) => b.label)} unit="kg" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-[22px] font-semibold tracking-wide">Frequency</h2>
        <div className="mt-3 rounded-2xl bg-surface p-4">
          <div className="mb-1 text-[13px] text-mute">Workouts per {monthly ? 'month' : 'week'}</div>
          <BarChart values={buckets.map((b) => b.n)} labels={buckets.map((b) => b.label)} format={(n) => String(Math.round(n))} integer />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[22px] font-semibold tracking-wide">Hard sets per muscle</h2>
        </div>
        <div className="mt-3 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <button aria-label="Previous week" onClick={() => setWeekOffset((w) => w + 1)} className="grid h-10 w-10 place-items-center rounded-lg bg-raised"><IconBack size={18} /></button>
            <div className="text-center">
              <div className="text-[15px] font-semibold">{weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Last week' : `Week of ${fmtDate(weekStart, { day: 'numeric', month: 'short' })}`}</div>
              <div className="text-[12px] text-mute">{fmtDate(weekStart, { day: 'numeric', month: 'short' })} – {fmtDate(addDays(weekStart, 6), { day: 'numeric', month: 'short' })}</div>
            </div>
            <button aria-label="Next week" disabled={weekOffset === 0} onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} className="grid h-10 w-10 place-items-center rounded-lg bg-raised disabled:opacity-30"><IconChevron size={18} /></button>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {muscles.map((m) => {
              const v = muscleSets.get(m) ?? 0;
              const a = muscleAvg.get(m) ?? 0;
              return (
                <div key={m} className="grid grid-cols-[92px_1fr_36px] items-center gap-2">
                  <div className="truncate text-[13px] font-semibold">{m}</div>
                  <div className="relative h-5 rounded-md bg-raised">
                    <div className="absolute inset-y-0 rounded-md bg-accent/10" style={{ left: `${(10 / maxSets) * 100}%`, width: `${(10 / maxSets) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-md bg-accent" style={{ width: `${(v / maxSets) * 100}%` }} />
                    {a > 0 && <div className="absolute inset-y-[-3px] w-[2px] rounded bg-fg/70" style={{ left: `calc(${(a / maxSets) * 100}% - 1px)` }} title={`4-week average ${fmtNum(a)}`} />}
                  </div>
                  <div className="tnum text-right text-[14px] font-semibold">{fmtNum(v)}</div>
                </div>
              );
            })}
            {muscles.length === 0 && <div className="py-4 text-center text-[14px] text-mute">No hard sets logged this week.</div>}
          </div>
          <div className="mt-4 text-[12px] leading-relaxed text-mute">
            Counts completed working sets with RIR ≤ 3 (or no RIR logged). Primary muscle = 1 set, secondary = ½. Shaded band marks 10–20 sets; the tick is your previous 4-week average.
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-[22px] font-semibold tracking-wide">Personal records</h2>
        <div className="mt-3 flex flex-col gap-2">
          {rangePrs.slice(0, 15).map((p) => {
            const ex = exMap.get(p.exerciseId);
            const s = p.w.exercises.flatMap((e) => e.sets).find((x) => x.id === p.setId);
            return (
              <button key={p.setId} onClick={() => push({ kind: 'workout', id: p.w.id })} className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 text-left active:bg-raised">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold"><IconTrophy size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{ex?.name}</div>
                  <div className="tnum truncate text-[13px] text-mute">{s ? formatSet(s, ex) : ''} · {p.kinds.map((k) => PR_LABEL[k as keyof typeof PR_LABEL]).join(', ')}</div>
                </div>
                <div className="shrink-0 text-[12px] text-mute">{fmtDate(p.w.startedAt, { day: 'numeric', month: 'short' })}</div>
              </button>
            );
          })}
          {rangePrs.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-[15px] text-mute">PRs appear when you beat a previous best weight, e1RM, set volume or rep count.</div>}
        </div>
      </section>
    </div>
  );
}
