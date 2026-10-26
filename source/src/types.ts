// Core data model. Every record has a stable id + updatedAt so a future
// cloud sync layer can merge per-record (last-write-wins) without a migration.

export type Muscle =
  | 'Chest' | 'Back' | 'Lats' | 'Traps' | 'Front Delts' | 'Side Delts' | 'Rear Delts'
  | 'Biceps' | 'Triceps' | 'Forearms' | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves'
  | 'Abs' | 'Obliques' | 'Lower Back' | 'Adductors' | 'Full Body' | 'Cardio';

export const MUSCLES: Muscle[] = [
  'Chest', 'Back', 'Lats', 'Traps', 'Front Delts', 'Side Delts', 'Rear Delts',
  'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves',
  'Abs', 'Obliques', 'Lower Back', 'Adductors', 'Full Body', 'Cardio',
];

export type Equipment =
  | 'Barbell' | 'Dumbbell' | 'Machine' | 'Smith Machine' | 'Cable' | 'Bodyweight'
  | 'Kettlebell' | 'Band' | 'EZ Bar' | 'Other';

export const EQUIPMENT: Equipment[] = [
  'Barbell', 'Dumbbell', 'Machine', 'Smith Machine', 'Cable', 'Bodyweight',
  'Kettlebell', 'Band', 'EZ Bar', 'Other',
];

/** weight = kg × reps; bodyweight = optional added kg × reps; duration = seconds */
export type TrackingType = 'weight' | 'bodyweight' | 'duration';

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  tracking: TrackingType;
  notes?: string;
  custom?: boolean;
  updatedAt: number;
}

export interface TemplateExercise {
  uid: string;
  exerciseId: string;
  sets: number;
  warmups: number;
  repMin: number;
  repMax: number;
  restSec?: number; // overrides default rest
  notes?: string;
  supersetId?: string;
}

export interface Template {
  id: string;
  name: string;
  day?: string; // e.g. "Monday" — label only
  exercises: TemplateExercise[];
  updatedAt: number;
  createdAt: number;
}

export type SetType = 'normal' | 'warmup';

export interface WorkoutSet {
  id: string;
  type: SetType;
  weight: number | null; // kg; for bodyweight = added kg
  reps: number | null; // for duration = seconds
  rir: number | null;
  done: boolean;
}

export interface WorkoutExercise {
  uid: string;
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  supersetId?: string;
  restSec?: number;
  repMin?: number;
  repMax?: number;
}

export interface Workout {
  id: string;
  name: string;
  templateId?: string;
  startedAt: number;
  endedAt?: number; // set when finished
  exercises: WorkoutExercise[];
  notes?: string;
  updatedAt: number;
}

export interface Settings {
  defaultRestSec: number;
  autoRest: boolean;
  sound: boolean;
  bodyweight: number | null; // used for bodyweight volume / e1RM
  theme: 'dark' | 'light';
  showRir: boolean;
}

export interface RestTimer {
  endsAt: number;
  total: number;
  label?: string;
}

export interface AppData {
  schemaVersion: number;
  exercises: Exercise[];
  templates: Template[];
  workouts: Workout[]; // finished workouts only
  active: Workout | null; // in-progress workout (persisted, survives reloads)
  settings: Settings;
  deleted: { id: string; at: number }[]; // tombstones for future sync
}
