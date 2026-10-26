import { useState } from 'react';
import { useStore, useExerciseMap } from '../store';
import { EQUIPMENT, MUSCLES, type Equipment, type Exercise, type Muscle, type TrackingType } from '../types';
import { Button, Field, Segmented, cx, inputCls } from '../ui/kit';
import { uid } from '../lib/util';
import { useNav } from '../nav';

function MusclePicker({ value, onChange, exclude = [] }: { value: Muscle[]; onChange: (m: Muscle[]) => void; exclude?: Muscle[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MUSCLES.filter((m) => !exclude.includes(m)).map((m) => {
        const on = value.includes(m);
        return (
          <button type="button" key={m} onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])}
            className={cx('h-9 rounded-full px-3 text-[14px] font-semibold', on ? 'bg-accent text-white' : 'bg-raised text-mute')}>
            {m}
          </button>
        );
      })}
    </div>
  );
}

/** Create or edit an exercise. Calls onDone(id) on save, onDone(null) on cancel. */
export function ExerciseForm({ initial, onDone }: { initial: Exercise | null; onDone: (id: string | null) => void }) {
  const upsert = useStore((s) => s.upsertExercise);
  const exMap = useExerciseMap();
  const toast = useNav((s) => s.showToast);
  const [name, setName] = useState(initial?.name ?? '');
  const [primary, setPrimary] = useState<Muscle[]>(initial?.primary ?? []);
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondary ?? []);
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'Barbell');
  const [tracking, setTracking] = useState<TrackingType>(initial?.tracking ?? 'weight');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const save = () => {
    const n = name.trim();
    if (!n) { toast('Give the exercise a name'); return; }
    if (!primary.length) { toast('Pick at least one primary muscle'); return; }
    const dupe = [...exMap.values()].find((e) => e.name.toLowerCase() === n.toLowerCase() && e.id !== initial?.id);
    if (dupe) { toast('An exercise with that name already exists'); return; }
    const id = initial?.id ?? `custom-${uid()}`;
    upsert({ id, name: n, primary, secondary: secondary.filter((m) => !primary.includes(m)), equipment, tracking, notes: notes.trim() || undefined, custom: initial ? initial.custom : true, updatedAt: Date.now() });
    toast(initial ? 'Exercise updated' : 'Exercise created');
    onDone(id);
  };

  return (
    <div className="flex flex-col gap-5">
      <Field label="Name">
        <input id="ex-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weighted Chin-up" />
      </Field>
      <Field label="Tracking">
        <Segmented value={tracking} onChange={setTracking} options={[
          { value: 'weight', label: 'Weight × reps' },
          { value: 'bodyweight', label: 'Bodyweight' },
          { value: 'duration', label: 'Duration' },
        ]} />
      </Field>
      {tracking === 'bodyweight' && <div className="-mt-3 text-[13px] text-mute">Logs reps, with an optional +kg column for added load (belt, vest, dumbbell).</div>}
      <div className="flex flex-col gap-1.5"><span className="label">Primary muscles</span><MusclePicker value={primary} onChange={setPrimary} /></div>
      <div className="flex flex-col gap-1.5"><span className="label">Secondary muscles</span><MusclePicker value={secondary} onChange={setSecondary} exclude={primary} /></div>
      <Field label="Equipment">
        <select id="ex-equipment" className={inputCls} value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
          {EQUIPMENT.map((e) => <option key={e}>{e}</option>)}
        </select>
      </Field>
      <Field label="Notes">
        <textarea id="ex-notes" className={cx(inputCls, 'min-h-[84px] py-3')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seat height, grip, cues…" />
      </Field>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => onDone(null)}>Cancel</Button>
        <Button className="flex-[2]" onClick={save}>{initial ? 'Save' : 'Create exercise'}</Button>
      </div>
    </div>
  );
}
