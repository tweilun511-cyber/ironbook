import type { Exercise, Muscle, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { startOfWeek, addDays } from './util';

/** Epley estimate; reps above 15 aren't predictive so we ignore them. */
export function e1rm(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps > 0) || reps > 15) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Load actually moved for a set (bodyweight exercises add bodyweight if known). */
export function setLoad(s: WorkoutSet, ex: Exercise | undefined, bodyweight: number | null): number | null {
  if (!ex) return s.weight;
  if (ex.tracking === 'duration') return null;
  if (ex.tracking === 'bodyweight') {
    const bw = bodyweight ?? 0;
    const add = s.weight ?? 0;
    const total = bw + add;
    return total > 0 ? total : null;
  }
  return s.weight;
}

export function setVolume(s: WorkoutSet, ex: Exercise | undefined, bw: number | null): number {
  if (!s.done || s.type === 'warmup') return 0;
  const load = setLoad(s, ex, bw);
  return load && s.reps ? load * s.reps : 0;
}

export function setE1rm(s: WorkoutSet, ex: Exercise | undefined, bw: number | null): number | null {
  if (!s.done || s.type === 'warmup' || ex?.tracking === 'duration') return null;
  const load = setLoad(s, ex, bw);
  return load && s.reps ? e1rm(load, s.reps) : null;
}

export function workoutVolume(w: Workout, exMap: Map<string, Exercise>, bw: number | null): number {
  let v = 0;
  for (const we of w.exercises) for (const s of we.sets) v += setVolume(s, exMap.get(we.exerciseId), bw);
  return v;
}

export function workoutSetCount(w: Workout): number {
  return w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done && s.type !== 'warmup').length, 0);
}

export function workoutDuration(w: Workout): number {
  return (w.endedAt ?? Date.now()) - w.startedAt;
}

export function sortedWorkouts(ws: Workout[]): Workout[] {
  return [...ws].sort((a, b) => b.startedAt - a.startedAt);
}

/** Most recent finished workout's sets for an exercise (excluding a workout id). */
export function previousFor(exerciseId: string, workouts: Workout[], beforeTs = Infinity, excludeId?: string): { workout: Workout; ex: WorkoutExercise } | null {
  let best: { workout: Workout; ex: WorkoutExercise } | null = null;
  for (const w of workouts) {
    if (w.id === excludeId || w.startedAt >= beforeTs) continue;
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done));
    if (ex && (!best || w.startedAt > best.workout.startedAt)) best = { workout: w, ex };
  }
  return best;
}

/** Match a set to the previous session's set of the same type and position. */
export function previousSet(prev: WorkoutExercise | undefined, sets: WorkoutSet[], index: number): WorkoutSet | undefined {
  if (!prev) return undefined;
  const type = sets[index].type;
  const pos = sets.slice(0, index).filter((s) => s.type === type).length;
  const pool = prev.sets.filter((s) => s.type === type && s.done);
  return pool[pos] ?? (type === 'normal' ? pool[pool.length - 1] : undefined);
}

export type PrKind = 'e1rm' | 'weight' | 'reps' | 'volume';
export interface PrHit { setId: string; exerciseId: string; kinds: PrKind[] }

/**
 * PRs a workout set at the time it happened, compared against all earlier
 * workouts. weight = heaviest load, e1rm = best estimate, volume = best single
 * set load×reps, reps = most reps (bodyweight / duration exercises).
 */
export function prsForWorkout(w: Workout, all: Workout[], exMap: Map<string, Exercise>, bw: number | null): PrHit[] {
  const earlier = all.filter((x) => x.id !== w.id && x.startedAt < w.startedAt);
  const hits: PrHit[] = [];
  for (const we of w.exercises) {
    const ex = exMap.get(we.exerciseId);
    const best = { e1rm: 0, weight: 0, reps: 0, volume: 0 };
    let hasHistory = false;
    for (const o of earlier) for (const oe of o.exercises) {
      if (oe.exerciseId !== we.exerciseId) continue;
      for (const s of oe.sets) {
        if (!s.done || s.type === 'warmup') continue;
        hasHistory = true;
        best.e1rm = Math.max(best.e1rm, setE1rm(s, ex, bw) ?? 0);
        best.weight = Math.max(best.weight, setLoad(s, ex, bw) ?? 0);
        best.reps = Math.max(best.reps, s.reps ?? 0);
        best.volume = Math.max(best.volume, setVolume(s, ex, bw));
      }
    }
    if (!hasHistory) continue; // first time isn't a PR, it's a baseline
    // Only the top set per category within this workout gets the badge.
    const cand: Record<PrKind, { id: string; v: number } | null> = { e1rm: null, weight: null, reps: null, volume: null };
    for (const s of we.sets) {
      if (!s.done || s.type === 'warmup') continue;
      const vals: Record<PrKind, number> = {
        e1rm: setE1rm(s, ex, bw) ?? 0,
        weight: ex?.tracking === 'duration' ? 0 : setLoad(s, ex, bw) ?? 0,
        reps: ex?.tracking === 'weight' ? 0 : s.reps ?? 0,
        volume: setVolume(s, ex, bw),
      };
      (Object.keys(vals) as PrKind[]).forEach((k) => {
        if (vals[k] > best[k] + 1e-9 && (!cand[k] || vals[k] > cand[k]!.v)) cand[k] = { id: s.id, v: vals[k] };
      });
    }
    const bySet = new Map<string, PrKind[]>();
    (Object.keys(cand) as PrKind[]).forEach((k) => {
      const c = cand[k];
      if (c) bySet.set(c.id, [...(bySet.get(c.id) ?? []), k]);
    });
    bySet.forEach((kinds, setId) => hits.push({ setId, exerciseId: we.exerciseId, kinds }));
  }
  return hits;
}

export const PR_LABEL: Record<PrKind, string> = { e1rm: 'e1RM', weight: 'Weight', reps: 'Reps', volume: 'Volume' };

/** Per-session series for one exercise. */
export interface ExPoint { ts: number; e1rm: number | null; best: number | null; volume: number; reps: number; workoutId: string }
export function exerciseSeries(exerciseId: string, workouts: Workout[], exMap: Map<string, Exercise>, bw: number | null): ExPoint[] {
  const ex = exMap.get(exerciseId);
  const pts: ExPoint[] = [];
  for (const w of workouts) {
    let e = 0, b = 0, v = 0, r = 0, found = false;
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done || s.type === 'warmup') continue;
        found = true;
        e = Math.max(e, setE1rm(s, ex, bw) ?? 0);
        b = Math.max(b, setLoad(s, ex, bw) ?? 0);
        v += setVolume(s, ex, bw);
        r = Math.max(r, s.reps ?? 0);
      }
    }
    if (found) pts.push({ ts: w.startedAt, e1rm: e || null, best: b || null, volume: v, reps: r, workoutId: w.id });
  }
  return pts.sort((a, b) => a.ts - b.ts);
}

export interface WeekBucket { start: number; workouts: number; volume: number; sets: number }
export function weeklyBuckets(workouts: Workout[], weeks: number, exMap: Map<string, Exercise>, bw: number | null, now = Date.now()): WeekBucket[] {
  const thisWeek = startOfWeek(now);
  const out: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ start: addDays(thisWeek, -7 * i), workouts: 0, volume: 0, sets: 0 });
  for (const w of workouts) {
    const ws = startOfWeek(w.startedAt);
    const b = out.find((x) => x.start === ws);
    if (!b) continue;
    b.workouts += 1;
    b.volume += workoutVolume(w, exMap, bw);
    b.sets += workoutSetCount(w);
  }
  return out;
}

/**
 * Hard sets = completed working sets with RIR ≤ 3 (or RIR not logged).
 * Primary muscles get 1 set, secondary muscles 0.5.
 */
export function hardSetsByMuscle(workouts: Workout[], from: number, to: number, exMap: Map<string, Exercise>): Map<Muscle, number> {
  const m = new Map<Muscle, number>();
  for (const w of workouts) {
    if (w.startedAt < from || w.startedAt >= to) continue;
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter((s) => s.done && s.type !== 'warmup' && (s.rir == null || s.rir <= 3)).length;
      if (!n) continue;
      ex.primary.forEach((mu) => m.set(mu, (m.get(mu) ?? 0) + n));
      ex.secondary.forEach((mu) => m.set(mu, (m.get(mu) ?? 0) + n * 0.5));
    }
  }
  return m;
}

export function bestSetLabel(we: WorkoutExercise, ex: Exercise | undefined, bw: number | null): string {
  let best: WorkoutSet | null = null;
  let bestScore = -1;
  for (const s of we.sets) {
    if (!s.done || s.type === 'warmup') continue;
    const score = ex?.tracking === 'weight' ? (setE1rm(s, ex, bw) ?? (s.weight ?? 0)) : (s.weight ?? 0) * 1000 + (s.reps ?? 0);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best ? formatSet(best, ex) : '–';
}

export function formatSet(s: Pick<WorkoutSet, 'weight' | 'reps' | 'rir'>, ex: Exercise | undefined, withRir = false): string {
  const rir = withRir && s.rir != null ? ` @${s.rir}` : '';
  if (ex?.tracking === 'duration') return `${s.reps ?? 0}s${rir}`;
  if (ex?.tracking === 'bodyweight') {
    return s.weight ? `+${s.weight} kg × ${s.reps ?? 0}${rir}` : `${s.reps ?? 0} reps${rir}`;
  }
  return `${s.weight ?? 0} kg × ${s.reps ?? 0}${rir}`;
}
