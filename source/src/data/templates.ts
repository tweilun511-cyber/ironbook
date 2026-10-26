import type { Template, TemplateExercise } from '../types';
import { uid } from '../lib/util';

type T = [exerciseId: string, sets: number, repMin: number, repMax: number, restSec?: number, notes?: string];

function te([exerciseId, sets, repMin, repMax, restSec, notes]: T): TemplateExercise {
  return { uid: uid(), exerciseId, sets, warmups: 0, repMin, repMax, restSec, notes };
}

function tpl(id: string, name: string, day: string, list: T[]): Template {
  return { id, name, day, exercises: list.map(te), createdAt: 0, updatedAt: 0 };
}

export function seedTemplates(): Template[] {
  return [
    tpl('tpl-mon', 'Chest & Back Strength', 'Monday', [
      ['bench-press', 3, 4, 6, 180],
      ['pull-up', 3, 5, 8, 150],
      ['dip', 2, 6, 10, 120],
    ]),
    tpl('tpl-wed', 'Shoulders, Arms & Leg Accessories', 'Wednesday', [
      ['shoulder-press', 3, 5, 8, 150],
      ['cable-cuff-lateral-raise', 3, 12, 20, 75],
      ['incline-db-curl', 3, 8, 12, 90],
      ['tricep-pushdown', 3, 10, 15, 90],
      ['single-leg-press', 2, 10, 12, 90, 'Reps are per leg'],
      ['leg-extension', 2, 12, 15, 90],
      ['calf-press-leg-press', 3, 10, 15, 75],
    ]),
    tpl('tpl-thu', 'Chest & Back Hypertrophy', 'Thursday', [
      ['incline-smith-press', 3, 8, 12, 120],
      ['lat-pulldown', 3, 10, 12, 120],
      ['dip', 2, 8, 12, 120],
      ['face-pull', 2, 15, 20, 75],
    ]),
    tpl('tpl-fri', 'Heavy Legs', 'Friday', [
      ['squat', 3, 4, 6, 210],
      ['deadlift', 2, 3, 5, 210],
      ['leg-curl', 3, 10, 15, 90],
      ['calf-press-leg-press', 3, 10, 15, 75],
      ['hanging-leg-raise', 3, 10, 15, 75],
    ]),
    tpl('tpl-sat', 'Shoulders, Arms & Abs', 'Saturday', [
      ['cable-cuff-lateral-raise', 3, 12, 20, 75],
      ['cable-rear-delt-fly', 3, 12, 20, 75],
      ['preacher-curl', 3, 8, 12, 90],
      ['overhead-cable-tricep', 3, 10, 15, 90],
      ['cable-crunch', 3, 10, 15, 75],
    ]),
  ];
}
