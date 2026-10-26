export function uid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && 'randomUUID' in c) {
    try { return c.randomUUID(); } catch { /* fall through */ }
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const DAY_MS = 86400000;

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function fmtKg(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}t`;
  return `${Math.round(n).toLocaleString()} kg`;
}

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '–';
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(r);
}

export function fmtDate(ts: number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(ts).toLocaleDateString('en-GB', opts);
}

export function fmtRelative(ts: number, now = Date.now()): string {
  const a = startOfDay(now);
  const b = startOfDay(ts);
  const days = Math.round((a - b) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return fmtDate(ts);
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday-based week start */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

export function parseNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
