import { useEffect } from 'react';
import { useStore } from './store';
import { useNav, type Screen, type Tab } from './nav';
import { cx } from './ui/kit';
import { IconCalendar, IconChart, IconDumbbell, IconGear, IconHome } from './ui/icons';
import { Home } from './screens/Home';
import { TemplateDetail, Workouts } from './screens/Workouts';
import { TemplateEditor } from './screens/TemplateEditor';
import { ExerciseDetail, ExerciseEditPage } from './screens/ExerciseDetail';
import { History, WorkoutDetail, WorkoutEdit } from './screens/History';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { ActiveWorkout, RestBar } from './screens/ActiveWorkout';
import { Elapsed } from './screens/WorkoutLogger';

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'home', label: 'Home', Icon: IconHome },
  { id: 'workouts', label: 'Workouts', Icon: IconDumbbell },
  { id: 'history', label: 'History', Icon: IconCalendar },
  { id: 'progress', label: 'Progress', Icon: IconChart },
  { id: 'settings', label: 'Settings', Icon: IconGear },
];

function renderScreen(s: Screen) {
  switch (s.kind) {
    case 'template': return <TemplateDetail id={s.id} />;
    case 'templateEdit': return <TemplateEditor id={s.id} />;
    case 'exercise': return <ExerciseDetail id={s.id} />;
    case 'exerciseEdit': return <ExerciseEditPage id={s.id} />;
    case 'workout': return <WorkoutDetail id={s.id} />;
    case 'summary': return <WorkoutDetail id={s.id} celebrate />;
    case 'workoutEdit': return <WorkoutEdit id={s.id} />;
  }
}

export function App() {
  const ready = useStore((s) => s.ready);
  const theme = useStore((s) => s.data.settings.theme);
  const active = useStore((s) => s.data.active);
  const workoutOpen = useStore((s) => s.workoutOpen);
  const setOpen = useStore((s) => s.setWorkoutOpen);
  const { tab, setTab, stack, toast } = useNav();

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'light' ? '#f3f5f8' : '#0d1117');
  }, [theme]);

  useEffect(() => { document.getElementById('tab-scroll')?.scrollTo(0, 0); }, [tab]);

  if (!ready) return <div className="grid h-full place-items-center text-mute">Loading…</div>;

  const top = stack[stack.length - 1];

  return (
    <div className="flex h-full flex-col bg-bg">
      <main id="tab-scroll" className="no-scrollbar pt-safe min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[560px]">
          {tab === 'home' && <Home />}
          {tab === 'workouts' && <Workouts />}
          {tab === 'history' && <History />}
          {tab === 'progress' && <Progress />}
          {tab === 'settings' && <Settings />}
        </div>
      </main>

      {active && !workoutOpen && (
        <button onClick={() => setOpen(true)} className="gutter flex h-14 shrink-0 items-center gap-3 border-t border-line bg-surface text-left">
          <span className="h-2.5 w-2.5 rounded-full bg-done" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{active.name}</span>
          <Elapsed since={active.startedAt} className="font-display text-[18px] font-semibold text-done" />
        </button>
      )}

      <nav className="gutter pb-safe shrink-0 border-t border-line/70 bg-bg/95 backdrop-blur" aria-label="Main">
        <div className="mx-auto flex max-w-[560px]">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={cx('flex h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold', tab === id ? 'text-accent' : 'text-mute')}>
              <Icon size={24} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {top && <div key={stack.length}>{renderScreen(top)}</div>}
      <ActiveWorkout />
      {!workoutOpen && active && <RestBar compact />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+12px)] z-[90] flex justify-center px-4">
          <div className="anim-fade max-w-[90%] rounded-full bg-fg px-4 py-2.5 text-center text-[14px] font-semibold text-bg shadow-lg" role="status">{toast}</div>
        </div>
      )}
    </div>
  );
}
