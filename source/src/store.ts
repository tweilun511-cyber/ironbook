import { create } from 'zustand';
import { useMemo } from 'react';
import type { AppData, Exercise, RestTimer, Settings, Template, Workout, WorkoutExercise, WorkoutSet } from './types';
import { SEED_EXERCISES } from './data/exercises';
import { seedTemplates } from './data/templates';
import { repo } from './storage/repository';
import { deepClone, uid } from './lib/util';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  defaultRestSec: 120,
  autoRest: true,
  sound: true,
  bodyweight: null,
  theme: 'dark',
  showRir: true,
};

export function freshData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    exercises: SEED_EXERCISES.map((e) => ({ ...e })),
    templates: seedTemplates(),
    workouts: [],
    active: null,
    settings: { ...DEFAULT_SETTINGS },
    deleted: [],
  };
}

/** Validate + upgrade any loaded/imported blob into current AppData. */
export function normalize(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Not an Ironbook backup');
  const r = raw as Partial<AppData>;
  if (!Array.isArray(r.workouts) || !Array.isArray(r.templates) || !Array.isArray(r.exercises)) {
    throw new Error('Backup is missing workouts, templates or exercises');
  }
  // Ensure seed exercises exist (new library entries in future versions get added).
  const byId = new Map(r.exercises.map((e) => [e.id, e]));
  for (const s of SEED_EXERCISES) if (!byId.has(s.id)) byId.set(s.id, { ...s });
  return {
    schemaVersion: SCHEMA_VERSION,
    exercises: [...byId.values()],
    templates: r.templates,
    workouts: r.workouts.filter((w) => w && w.id && Array.isArray(w.exercises)),
    active: r.active ?? null,
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
    deleted: r.deleted ?? [],
  };
}

function newSet(type: WorkoutSet['type'] = 'normal'): WorkoutSet {
  return { id: uid(), type, weight: null, reps: null, rir: null, done: false };
}

export function makeSet(type: WorkoutSet['type'] = 'normal') {
  return newSet(type);
}

export function workoutFromTemplate(t: Template | null): Workout {
  const now = Date.now();
  return {
    id: uid(),
    name: t?.name ?? 'Workout',
    templateId: t?.id,
    startedAt: now,
    exercises: (t?.exercises ?? []).map<WorkoutExercise>((te) => ({
      uid: uid(),
      exerciseId: te.exerciseId,
      notes: te.notes,
      supersetId: te.supersetId,
      restSec: te.restSec,
      repMin: te.repMin,
      repMax: te.repMax,
      sets: [
        ...Array.from({ length: te.warmups }, () => newSet('warmup')),
        ...Array.from({ length: te.sets }, () => newSet('normal')),
      ],
    })),
    updatedAt: now,
  };
}

const REST_KEY = 'ironbook.rest';
function loadRest(): RestTimer | null {
  try {
    const r = JSON.parse(localStorage.getItem(REST_KEY) || 'null') as RestTimer | null;
    return r && r.endsAt > Date.now() ? r : null;
  } catch { return null; }
}
function saveRest(r: RestTimer | null) {
  try { r ? localStorage.setItem(REST_KEY, JSON.stringify(r)) : localStorage.removeItem(REST_KEY); } catch { /* ignore */ }
}

interface Store {
  ready: boolean;
  data: AppData;
  rest: RestTimer | null;
  workoutOpen: boolean;
  lastSavedAt: number | null;
  saveError: boolean;

  init(): Promise<void>;
  setWorkoutOpen(open: boolean): void;

  upsertExercise(e: Exercise): void;
  deleteExercise(id: string): boolean;

  upsertTemplate(t: Template): void;
  deleteTemplate(id: string): void;
  duplicateTemplate(id: string): string | null;

  startWorkout(templateId: string | null): void;
  updateActive(fn: (w: Workout) => void): void;
  finishActive(): Workout | null;
  discardActive(): void;

  upsertWorkout(w: Workout): void;
  deleteWorkout(id: string): void;

  updateSettings(p: Partial<Settings>): void;
  replaceAll(d: AppData): void;
  resetAll(): void;

  startRest(sec: number, label?: string): void;
  adjustRest(delta: number): void;
  stopRest(): void;
}

export const useStore = create<Store>((set, get) => {
  const touch = (fn: (d: AppData) => void) => {
    const d = { ...get().data };
    fn(d);
    set({ data: d });
  };
  const tomb = (d: AppData, id: string) => {
    d.deleted = [...d.deleted, { id, at: Date.now() }].slice(-500);
  };

  return {
    ready: false,
    data: freshData(),
    rest: null,
    workoutOpen: false,
    lastSavedAt: null,
    saveError: false,

    async init() {
      let data: AppData;
      try {
        const loaded = await repo.load();
        data = loaded ? normalize(loaded) : freshData();
      } catch {
        data = freshData();
      }
      set({ data, ready: true, rest: loadRest(), workoutOpen: !!data.active });
      if (!data.active) saveRest(null);
    },

    setWorkoutOpen(open) { set({ workoutOpen: open }); },

    upsertExercise(e) {
      touch((d) => {
        const ex = { ...e, updatedAt: Date.now() };
        const i = d.exercises.findIndex((x) => x.id === e.id);
        d.exercises = i >= 0 ? d.exercises.map((x, j) => (j === i ? ex : x)) : [...d.exercises, ex];
      });
    },

    deleteExercise(id) {
      const d = get().data;
      const used = d.workouts.some((w) => w.exercises.some((e) => e.exerciseId === id))
        || d.templates.some((t) => t.exercises.some((e) => e.exerciseId === id))
        || d.active?.exercises.some((e) => e.exerciseId === id);
      if (used) return false;
      touch((dd) => { dd.exercises = dd.exercises.filter((e) => e.id !== id); tomb(dd, id); });
      return true;
    },

    upsertTemplate(t) {
      touch((d) => {
        const tt = { ...t, updatedAt: Date.now() };
        const i = d.templates.findIndex((x) => x.id === t.id);
        d.templates = i >= 0 ? d.templates.map((x, j) => (j === i ? tt : x)) : [...d.templates, tt];
      });
    },

    deleteTemplate(id) {
      touch((d) => { d.templates = d.templates.filter((t) => t.id !== id); tomb(d, id); });
    },

    duplicateTemplate(id) {
      const t = get().data.templates.find((x) => x.id === id);
      if (!t) return null;
      const copy: Template = {
        ...deepClone(t), id: uid(), name: `${t.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now(),
      };
      copy.exercises = copy.exercises.map((e) => ({ ...e, uid: uid() }));
      get().upsertTemplate(copy);
      return copy.id;
    },

    startWorkout(templateId) {
      const d = get().data;
      if (d.active) { set({ workoutOpen: true }); return; }
      const t = templateId ? d.templates.find((x) => x.id === templateId) ?? null : null;
      touch((dd) => { dd.active = workoutFromTemplate(t); });
      set({ workoutOpen: true });
    },

    updateActive(fn) {
      const a = get().data.active;
      if (!a) return;
      const w = deepClone(a);
      fn(w);
      w.updatedAt = Date.now();
      touch((d) => { d.active = w; });
    },

    finishActive() {
      const a = get().data.active;
      if (!a) return null;
      const w = deepClone(a);
      w.endedAt = Date.now();
      w.updatedAt = Date.now();
      // Keep only completed sets; drop exercises with nothing logged.
      w.exercises = w.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0);
      touch((d) => { d.workouts = [...d.workouts, w]; d.active = null; });
      set({ workoutOpen: false, rest: null });
      saveRest(null);
      return w;
    },

    discardActive() {
      touch((d) => { d.active = null; });
      set({ workoutOpen: false, rest: null });
      saveRest(null);
    },

    upsertWorkout(w) {
      touch((d) => {
        const ww = { ...w, updatedAt: Date.now() };
        const i = d.workouts.findIndex((x) => x.id === w.id);
        d.workouts = i >= 0 ? d.workouts.map((x, j) => (j === i ? ww : x)) : [...d.workouts, ww];
      });
    },

    deleteWorkout(id) {
      touch((d) => { d.workouts = d.workouts.filter((w) => w.id !== id); tomb(d, id); });
    },

    updateSettings(p) {
      touch((d) => { d.settings = { ...d.settings, ...p }; });
    },

    replaceAll(data) {
      set({ data, rest: null, workoutOpen: false });
      saveRest(null);
    },

    resetAll() {
      set({ data: freshData(), rest: null, workoutOpen: false });
      saveRest(null);
    },

    startRest(sec, label) {
      const r = { endsAt: Date.now() + sec * 1000, total: sec, label };
      set({ rest: r });
      saveRest(r);
    },
    adjustRest(delta) {
      const r = get().rest;
      if (!r) return;
      const endsAt = r.endsAt + delta * 1000;
      if (endsAt <= Date.now()) { get().stopRest(); return; }
      const nr = { ...r, endsAt, total: Math.max(1, r.total + delta) };
      set({ rest: nr });
      saveRest(nr);
    },
    stopRest() { set({ rest: null }); saveRest(null); },
  };
});

// ---- Persistence: debounced save on every data change, flush on hide ----
let timer: ReturnType<typeof setTimeout> | null = null;
let lastData: AppData | null = null;

useStore.subscribe((s) => {
  if (!s.ready || s.data === lastData) return;
  lastData = s.data;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    try {
      await repo.save(useStore.getState().data);
      useStore.setState({ lastSavedAt: Date.now(), saveError: !repo.idbOk && !repo.lsOk });
    } catch {
      useStore.setState({ saveError: true });
    }
  }, 250);
});

function flush() {
  const s = useStore.getState();
  if (!s.ready) return;
  repo.saveNow(s.data);
  void repo.save(s.data);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

export function useExerciseMap() {
  const exercises = useStore((s) => s.data.exercises);
  return useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
}
