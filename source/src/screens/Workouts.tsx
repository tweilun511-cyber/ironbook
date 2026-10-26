import { useMemo, useState } from 'react';
import { useExerciseMap, useStore } from '../store';
import { useNav } from '../nav';
import { ActionSheet, Button, Confirm, Page, Segmented, cx, inputCls, type Action } from '../ui/kit';
import { IconChevron, IconCopy, IconDots, IconEdit, IconPlus, IconSearch, IconTrash } from '../ui/icons';
import { lastPerformed } from './Home';
import { fmtRelative, fmtClock } from '../lib/util';
import type { Muscle, Template } from '../types';
import { MuscleChips, matchExercise } from './ExercisePicker';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function Workouts() {
  const [seg, setSeg] = useState<'routines' | 'exercises'>(() => {
    try { return (sessionStorage.getItem('ib.seg') as 'routines' | 'exercises') || 'routines'; } catch { return 'routines'; }
  });
  const change = (v: 'routines' | 'exercises') => { setSeg(v); try { sessionStorage.setItem('ib.seg', v); } catch { /* ignore */ } };
  return (
    <div className="gutter pb-8 pt-4">
      <h1 className="font-display text-[34px] font-bold leading-none tracking-wide">Workouts</h1>
      <Segmented className="mt-4" value={seg} onChange={change} options={[{ value: 'routines', label: 'Routines' }, { value: 'exercises', label: 'Exercises' }]} />
      {seg === 'routines' ? <Routines /> : <Library />}
    </div>
  );
}

function Routines() {
  const templates = useStore((s) => s.data.templates);
  const workouts = useStore((s) => s.data.workouts);
  const active = useStore((s) => s.data.active);
  const start = useStore((s) => s.startWorkout);
  const del = useStore((s) => s.deleteTemplate);
  const dup = useStore((s) => s.duplicateTemplate);
  const push = useNav((s) => s.push);
  const toast = useNav((s) => s.showToast);
  const exMap = useExerciseMap();
  const [menu, setMenu] = useState<Template | null>(null);
  const [confirmDel, setConfirmDel] = useState<Template | null>(null);

  const sorted = useMemo(() => [...templates].sort((a, b) => {
    const da = a.day ? DAY_ORDER.indexOf(a.day) : 99, db = b.day ? DAY_ORDER.indexOf(b.day) : 99;
    return da - db || a.createdAt - b.createdAt;
  }), [templates]);

  const actions: Action[] = menu ? [
    { label: 'Edit routine', icon: <IconEdit size={20} />, onClick: () => push({ kind: 'templateEdit', id: menu.id }) },
    { label: 'Duplicate', icon: <IconCopy size={20} />, onClick: () => { dup(menu.id); toast('Routine duplicated'); } },
    { label: 'Delete', danger: true, icon: <IconTrash size={20} />, onClick: () => setConfirmDel(menu) },
  ] : [];

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => push({ kind: 'templateEdit', id: null })}><span className="inline-flex items-center gap-1.5"><IconPlus size={18} /> New routine</span></Button>
        <Button variant="ghost" disabled={!!active} onClick={() => start(null)}>Empty workout</Button>
      </div>
      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="font-display text-[22px] font-semibold tracking-wide">My routines</h2>
        <span className="tnum text-[14px] text-mute">{templates.length}</span>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {sorted.map((t) => {
          const lp = lastPerformed(t.id, workouts);
          return (
            <div key={t.id} className="relative rounded-2xl bg-surface active:bg-raised">
              <button className="block w-full p-4 pr-14 text-left" onClick={() => push({ kind: 'template', id: t.id })}>
                {t.day && <div className="label text-accent">{t.day}</div>}
                <div className="mt-0.5 font-display text-[21px] font-semibold leading-tight tracking-wide">{t.name}</div>
                <div className="mt-1.5 line-clamp-2 text-[14px] leading-snug text-mute">
                  {t.exercises.map((e) => exMap.get(e.exerciseId)?.name.replace(/ \(.*\)/, '')).join(', ') || 'No exercises yet'}
                </div>
                <div className="mt-2 text-[13px] text-mute">{t.exercises.length} exercises · {lp ? fmtRelative(lp) : 'Never done'}</div>
              </button>
              <button aria-label={`${t.name} options`} onClick={() => setMenu(t)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                <IconDots size={20} />
              </button>
            </div>
          );
        })}
      </div>
      <ActionSheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name} actions={actions} />
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} danger title="Delete routine?"
        body={`“${confirmDel?.name}” will be removed. Workouts you've already logged from it stay in your history.`}
        confirmLabel="Delete routine" onConfirm={() => { if (confirmDel) { del(confirmDel.id); toast('Routine deleted'); } }} />
    </div>
  );
}

function Library() {
  const exercises = useStore((s) => s.data.exercises);
  const push = useNav((s) => s.push);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'All'>('All');
  const list = useMemo(() => exercises.filter((e) => matchExercise(e, q, muscle)).sort((a, b) => a.name.localeCompare(b.name)), [exercises, q, muscle]);
  return (
    <div className="mt-5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" size={18} />
          <input id="lib-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${exercises.length} exercises`} className={cx(inputCls, 'pl-10')} />
        </div>
        <Button className="px-3" aria-label="New exercise" onClick={() => push({ kind: 'exerciseEdit', id: null })}><IconPlus /></Button>
      </div>
      <div className="mt-2"><MuscleChips value={muscle} onChange={setMuscle} /></div>
      <div className="mt-2 flex flex-col">
        {list.map((e) => (
          <button key={e.id} onClick={() => push({ kind: 'exercise', id: e.id })} className="flex min-h-[60px] items-center gap-3 border-b border-line/50 text-left active:bg-raised">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold">{e.name}{e.custom && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-bold uppercase text-accent">Custom</span>}</div>
              <div className="truncate text-[13px] text-mute">{e.primary.join(', ')} · {e.equipment}</div>
            </div>
            <IconChevron size={18} className="text-mute" />
          </button>
        ))}
        {list.length === 0 && <div className="py-10 text-center text-mute">No matches</div>}
      </div>
    </div>
  );
}

export function TemplateDetail({ id }: { id: string }) {
  const t = useStore((s) => s.data.templates.find((x) => x.id === id));
  const workouts = useStore((s) => s.data.workouts);
  const active = useStore((s) => s.data.active);
  const start = useStore((s) => s.startWorkout);
  const defaultRest = useStore((s) => s.data.settings.defaultRestSec);
  const { pop, push } = useNav();
  const exMap = useExerciseMap();
  if (!t) return <Page title="Routine" onBack={pop}><div className="gutter py-10 text-mute">This routine was deleted.</div></Page>;
  const lp = lastPerformed(t.id, workouts);
  return (
    <Page title={t.name} onBack={pop} back="close"
      right={<button className="px-2 text-[16px] font-semibold text-accent" onClick={() => push({ kind: 'templateEdit', id: t.id })}>Edit</button>}
      footer={<Button className="w-full text-[17px]" onClick={() => { start(t.id); pop(); }}>{active ? 'Resume current workout' : 'Start workout'}</Button>}>
      <div className="gutter py-4">
        <div className="text-[15px] text-mute">{t.day ? `${t.day} · ` : ''}Last performed: {lp ? fmtRelative(lp).toLowerCase() : 'never'}</div>
        <div className="mt-3 flex flex-col">
          {t.exercises.map((te) => {
            const ex = exMap.get(te.exerciseId);
            return (
              <button key={te.uid} onClick={() => push({ kind: 'exercise', id: te.exerciseId })} className="flex min-h-[64px] items-center gap-3 border-b border-line/50 text-left">
                <div className="tnum w-12 shrink-0 font-display text-[22px] font-bold text-accent">{te.sets}×</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{ex?.name ?? 'Deleted exercise'}</div>
                  <div className="truncate text-[13px] text-mute">
                    {te.repMin === te.repMax ? te.repMin : `${te.repMin}–${te.repMax}`} {ex?.tracking === 'duration' ? 'sec' : 'reps'} · rest {fmtClock(te.restSec ?? defaultRest)}
                    {te.warmups ? ` · ${te.warmups} warm-up` : ''}{te.supersetId ? ' · superset' : ''}{te.notes ? ` · ${te.notes}` : ''}
                  </div>
                </div>
                <IconChevron size={18} className="text-mute" />
              </button>
            );
          })}
          {t.exercises.length === 0 && <div className="py-8 text-mute">No exercises. Tap Edit to add some.</div>}
        </div>
      </div>
    </Page>
  );
}
