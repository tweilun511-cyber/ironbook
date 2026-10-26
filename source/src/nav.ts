import { create } from 'zustand';

export type Tab = 'home' | 'workouts' | 'history' | 'progress' | 'settings';

export type Screen =
  | { kind: 'template'; id: string }
  | { kind: 'templateEdit'; id: string | null }
  | { kind: 'exercise'; id: string }
  | { kind: 'exerciseEdit'; id: string | null }
  | { kind: 'workout'; id: string }
  | { kind: 'workoutEdit'; id: string }
  | { kind: 'summary'; id: string };

interface Nav {
  tab: Tab;
  stack: Screen[];
  toast: string | null;
  setTab(t: Tab): void;
  push(s: Screen): void;
  pop(): void;
  replace(s: Screen): void;
  clear(): void;
  showToast(msg: string): void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useNav = create<Nav>((set) => ({
  tab: 'home',
  stack: [],
  toast: null,
  setTab: (tab) => set({ tab, stack: [] }),
  push: (s) => set((st) => ({ stack: [...st.stack, s] })),
  pop: () => set((st) => ({ stack: st.stack.slice(0, -1) })),
  replace: (s) => set((st) => ({ stack: [...st.stack.slice(0, -1), s] })),
  clear: () => set({ stack: [] }),
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2200);
  },
}));
