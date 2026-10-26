# Ironbook

Personal, mobile-first workout tracker (React 18 + TypeScript + Tailwind CSS + Vite). Builds to a single self-contained `index.html`.

## Run / build

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + bundle to dist/index.html (one file, ~290 KB)
```

## Put it on your iPhone

1. Host `dist/index.html` anywhere static (GitHub Pages works: push it as `index.html` in a repo with Pages enabled).
2. Open the URL in Safari → Share → **Add to Home Screen**. It launches full-screen like an app.

## Where data lives (read this)

- Saved in the browser on this device: IndexedDB as the primary store, mirrored to localStorage. Saves happen ~250 ms after every change and again when the app is backgrounded, so an in-progress workout survives closing the tab.
- **Nothing syncs between devices or browsers.** The Home Screen app, Safari, and the Claude app each have separate storage.
- Data can be lost if you clear Safari website data, use Private Browsing, or iOS evicts storage for a site you haven't opened in weeks. The app asks for persistent storage (Settings shows whether it was granted).
- **Settings → Export backup** gives you the full JSON (copy or download). **Import backup** restores it on any device, replacing what's there.

## Structure

```
src/
  types.ts                 data model (ids + updatedAt on every record, tombstones in AppData.deleted)
  storage/repository.ts    Repository interface + LocalRepository (IndexedDB + localStorage)
  store.ts                 zustand store: all mutations, debounced persistence, import/normalize
  lib/stats.ts             e1RM (Epley), volume, previous-set lookup, PR detection, weekly + muscle aggregation
  data/                    exercise library seed, 5 starter routines
  screens/                 Home, Workouts (routines + library), ActiveWorkout, WorkoutLogger,
                           History, Progress, Settings, editors
  ui/                      kit components, icons, SVG charts
```

### Adding cloud sync + auth later

All reads/writes go through `Repository`. To add sync, implement a `CloudRepository` (e.g. Supabase or Firebase) with the same `load/save` contract, or wrap `LocalRepository` so local stays the offline source of truth and changes push in the background. Records already carry stable ids, `updatedAt`, and deletion tombstones, so a per-record last-write-wins merge needs no migration.

## Definitions used

- **e1RM**: Epley, `w × (1 + reps/30)`; sets above 15 reps are ignored. For bodyweight exercises, bodyweight (Settings) + added kg.
- **Volume**: load × reps for completed working sets (warm-ups excluded).
- **Hard set**: completed working set with RIR ≤ 3, or with no RIR logged. Primary muscle counts 1, secondary ½.
- **PR**: a set that beats every earlier workout for that exercise on e1RM, heaviest load, single-set volume, or reps (reps only for bodyweight/duration). A first-ever session is a baseline, not a PR.
