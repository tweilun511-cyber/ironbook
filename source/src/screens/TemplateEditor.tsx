import { useState } from 'react';
import { useExerciseMap, useStore } from '../store';
import { useNav } from '../nav';
import { Button, Confirm, Field, Page, Stepper, cx, inputCls } from '../ui/kit';
import { IconLink, IconPlus, IconTrash } from '../ui/icons';
import { ExercisePicker } from './ExercisePicker';
import { ReorderOverlay, moveItem, useLongPress } from '../ui/reorder';
import type { Template, TemplateExercise } from '../types';
import { deepClone, parseNum, uid } from '../lib/util';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function SmallNum({ id, value, onChange, label }: { id: string; value: number; onChange: (n: number) => void; label: string }) {
  const [t, setT] = useState(String(value));
  return (
    <input id={id} aria-label={label} inputMode="numeric" value={t}
      onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setT(v); const n = parseNum(v); if (n != null) onChange(n); }}
      onBlur={() => setT(String(value))}
      className="tnum h-11 w-14 rounded-[10px] bg-raised text-center text-[17px] font-semibold outline-none focus:ring-2 focus:ring-accent" />
  );
}

export function TemplateEditor({ id }: { id: string | null }) {
  const existing = useStore((s) => (id ? s.data.templates.find((x) => x.id === id) : undefined));
  const upsert = useStore((s) => s.upsertTemplate);
  const del = useStore((s) => s.deleteTemplate);
  const defaultRest = useStore((s) => s.data.settings.defaultRestSec);
  const { pop, replace, showToast } = useNav();
  const exMap = useExerciseMap();
  const [draft, setDraft] = useState<Template>(() => existing ? deepClone(existing) : { id: uid(), name: '', exercises: [], createdAt: Date.now(), updatedAt: Date.now() });
  const [picker, setPicker] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reorder, setReorder] = useState<{ index: number; y: number } | null>(null);
  const press = useLongPress((y, index) => setReorder({ index, y }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(existing ?? { id: draft.id, name: '', exercises: [], createdAt: draft.createdAt, updatedAt: draft.updatedAt });
  const edit = (fn: (t: Template) => void) => setDraft((d) => { const n = deepClone(d); fn(n); return n; });
  const editEx = (i: number, p: Partial<TemplateExercise>) => edit((t) => { Object.assign(t.exercises[i], p); });

  const save = () => {
    if (!draft.name.trim()) { showToast('Name the routine first'); document.getElementById('tpl-name')?.focus(); return; }
    const t = { ...draft, name: draft.name.trim(), exercises: draft.exercises.map((e) => ({ ...e, repMax: Math.max(e.repMin, e.repMax) })) };
    upsert(t);
    showToast('Routine saved');
    if (existing) pop(); else replace({ kind: 'template', id: t.id });
  };

  const cleanSupersets = (t: Template) => {
    const counts = new Map<string, number>();
    t.exercises.forEach((e) => e.supersetId && counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1));
    t.exercises.forEach((e) => { if (e.supersetId && counts.get(e.supersetId) === 1) e.supersetId = undefined; });
  };

  return (
    <Page title={existing ? 'Edit routine' : 'New routine'} back="close"
      onBack={() => (dirty ? setConfirmLeave(true) : pop())}
      right={<button className="px-2 text-[16px] font-semibold text-accent" onClick={save}>Save</button>}>
      <div className="gutter flex flex-col gap-4 py-4 pb-24">
        <Field label="Name">
          <input id="tpl-name" className={inputCls} value={draft.name} placeholder="e.g. Upper Body A" onChange={(e) => edit((t) => { t.name = e.target.value; })} />
        </Field>
        <Field label="Day (optional)">
          <select id="tpl-day" className={inputCls} value={draft.day ?? ''} onChange={(e) => edit((t) => { t.day = e.target.value || undefined; })}>
            {DAYS.map((d) => <option key={d} value={d}>{d || 'Any day'}</option>)}
          </select>
        </Field>

        {draft.exercises.length > 1 && <div className="-mb-2 mt-1 text-[13px] text-mute">Hold an exercise name to drag it into a new order.</div>}
        <div className="mt-2 flex flex-col gap-3">
          {draft.exercises.map((te, i) => {
            const ex = exMap.get(te.exerciseId);
            const linkedNext = !!te.supersetId && draft.exercises[i + 1]?.supersetId === te.supersetId;
            return (
              <div key={te.uid} className={cx('rounded-2xl bg-surface p-4', te.supersetId && 'border-l-[3px] border-accent')}>
                <div className="flex select-none items-start gap-2" data-index={i} {...press}>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[19px] font-semibold leading-tight tracking-wide">{ex?.name ?? 'Deleted exercise'}</div>
                    <div className="text-[13px] text-mute">{ex?.primary.join(', ')}</div>
                  </div>
                  <button aria-label="Remove" onClick={() => edit((t) => { t.exercises.splice(i, 1); cleanSupersets(t); })} className="grid h-10 w-10 place-items-center rounded-lg bg-danger/15 text-danger"><IconTrash size={18} /></button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><div className="label mb-1">Working sets</div><Stepper value={te.sets} min={1} max={20} onChange={(v) => editEx(i, { sets: v })} /></div>
                  <div><div className="label mb-1">Warm-ups</div><Stepper value={te.warmups} min={0} max={10} onChange={(v) => editEx(i, { warmups: v })} /></div>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <div className="label mb-1">{ex?.tracking === 'duration' ? 'Seconds' : 'Rep range'}</div>
                    <div className="flex items-center gap-2">
                      <SmallNum id={`min-${te.uid}`} label="Minimum" value={te.repMin} onChange={(n) => editEx(i, { repMin: n })} />
                      <span className="text-mute">–</span>
                      <SmallNum id={`max-${te.uid}`} label="Maximum" value={te.repMax} onChange={(n) => editEx(i, { repMax: n })} />
                    </div>
                  </div>
                  <div className="min-w-[150px] flex-1">
                    <div className="label mb-1">Rest (sec)</div>
                    <Stepper value={te.restSec ?? defaultRest} step={15} min={0} max={600} onChange={(v) => editEx(i, { restSec: v })} />
                  </div>
                </div>
                <input id={`note-${te.uid}`} className={cx(inputCls, 'mt-3 text-[15px]')} placeholder="Note (e.g. per leg, seat 4)" value={te.notes ?? ''}
                  onChange={(e) => editEx(i, { notes: e.target.value || undefined })} />
                {i < draft.exercises.length - 1 && (
                  <button onClick={() => edit((t) => {
                    const a = t.exercises[i], b = t.exercises[i + 1];
                    if (linkedNext) b.supersetId = undefined; else { const sid = a.supersetId ?? uid(); a.supersetId = sid; b.supersetId = sid; }
                    cleanSupersets(t);
                  })} className={cx('mt-3 flex h-10 items-center gap-2 rounded-lg px-3 text-[14px] font-semibold', linkedNext ? 'bg-accent/15 text-accent' : 'bg-raised text-mute')}>
                    <IconLink size={16} /> {linkedNext ? 'Supersetted with next · tap to unlink' : 'Superset with next'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <Button variant="soft" onClick={() => setPicker(true)}><span className="inline-flex items-center gap-2"><IconPlus size={20} /> Add exercises</span></Button>
        <Button onClick={save}>Save routine</Button>
        {existing && <Button variant="danger" onClick={() => setConfirmDel(true)}>Delete routine</Button>}
      </div>
      {reorder && (
        <ReorderOverlay initialIndex={reorder.index} initialY={reorder.y}
          items={draft.exercises.map((e) => ({ key: e.uid, title: exMap.get(e.exerciseId)?.name ?? 'Deleted exercise', subtitle: `${e.sets} × ${e.repMin}–${e.repMax}`, accent: e.supersetId ? 'var(--accent)' : undefined }))}
          onMove={(from, to) => edit((t) => moveItem(t.exercises, from, to))}
          onClose={() => setReorder(null)} />
      )}
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(ids) => edit((t) => {
        ids.forEach((exerciseId) => t.exercises.push({ uid: uid(), exerciseId, sets: 3, warmups: 0, repMin: 8, repMax: 12 }));
      })} />
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} danger title="Delete routine?" body="Logged workouts stay in your history."
        confirmLabel="Delete routine" onConfirm={() => { del(draft.id); showToast('Routine deleted'); pop(); }} />
      <Confirm open={confirmLeave} onClose={() => setConfirmLeave(false)} danger title="Discard changes?" body="Your edits to this routine haven't been saved."
        confirmLabel="Discard changes" onConfirm={pop} />
    </Page>
  );
}
