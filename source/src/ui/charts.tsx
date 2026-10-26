import { useId, useState } from 'react';
import { fmtDate, fmtNum } from '../lib/util';

function niceTicks(min: number, max: number, count = 4, integer = false): number[] {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = integer ? Math.max(1, span / count) : span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).filter((s) => !integer || Number.isInteger(s)).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function fmtTick(v: number) {
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return fmtNum(v, 1);
}

export interface LinePoint { x: number; y: number; highlight?: boolean }

export function LineChart({ points, height = 180, unit = '', color = 'var(--accent)', compare }: {
  points: LinePoint[]; height?: number; unit?: string; color?: string; compare?: LinePoint[];
}) {
  const id = useId().replace(/:/g, '');
  const [sel, setSel] = useState<number | null>(null);
  const W = 340, H = height, L = 38, R = 10, T = 12, B = 24;
  if (points.length === 0) {
    return <div className="grid place-items-center text-[14px] text-mute" style={{ height }}>No data in this range yet</div>;
  }
  const all = [...points, ...(compare ?? [])];
  const ys = all.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const sx = (x: number) => (xMax === xMin ? L + (W - L - R) / 2 : L + ((x - xMin) / (xMax - xMin)) * (W - L - R));
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${sx(xMax).toFixed(1)},${H - B} L${sx(xMin).toFixed(1)},${H - B} Z`;
  const last = points[points.length - 1];
  const xLabels = points.length === 1 ? [points[0]] : [points[0], points[Math.floor((points.length - 1) / 2)], last];
  const active = sel != null ? points[sel] : null;
  const c = `rgb(${color})`;

  // compare series is drawn on a normalised x so the two periods overlay
  let cmpPath = '';
  if (compare && compare.length > 0) {
    const cx0 = Math.min(...compare.map((p) => p.x)), cx1 = Math.max(...compare.map((p) => p.x));
    const sxc = (x: number) => (cx1 === cx0 ? L + (W - L - R) / 2 : L + ((x - cx0) / (cx1 - cx0)) * (W - L - R));
    cmpPath = compare.map((p, i) => `${i ? 'L' : 'M'}${sxc(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height: 'auto' }}
        onPointerLeave={() => setSel(null)}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let bi = 0, bd = Infinity;
          points.forEach((p, i) => { const d = Math.abs(sx(p.x) - px); if (d < bd) { bd = d; bi = i; } });
          setSel(bi);
        }}
      >
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.28" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray="2 4" />
            <text x={L - 6} y={sy(t) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--mute))" className="tnum">{fmtTick(t)}</text>
          </g>
        ))}
        {xLabels.map((p, i) => (
          <text key={i} x={sx(p.x)} y={H - 6} fontSize="10" fill="rgb(var(--mute))"
            textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>
            {fmtDate(p.x, { day: 'numeric', month: 'short' })}
          </text>
        ))}
        {cmpPath && <path d={cmpPath} fill="none" stroke="rgb(var(--mute))" strokeWidth="1.6" strokeDasharray="4 4" />}
        <path d={area} fill={`url(#g${id})`} />
        <path d={path} fill="none" stroke={c} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => p.highlight && (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" fill="rgb(var(--gold))" stroke="rgb(var(--surface))" strokeWidth="1.5" />
        ))}
        <circle cx={sx(last.x)} cy={sy(last.y)} r="5" fill={c} stroke="rgb(var(--surface))" strokeWidth="2" />
        {active && (
          <g>
            <line x1={sx(active.x)} x2={sx(active.x)} y1={T} y2={H - B} stroke="rgb(var(--mute))" strokeWidth="1" />
            <circle cx={sx(active.x)} cy={sy(active.y)} r="5" fill={c} stroke="rgb(var(--surface))" strokeWidth="2" />
          </g>
        )}
      </svg>
      {active && (
        <div className="pointer-events-none absolute right-1 top-0 rounded-lg bg-raised px-2 py-1 text-[12px] tnum">
          <span className="font-semibold">{fmtNum(active.y)}{unit}</span>
          <span className="ml-1.5 text-mute">{fmtDate(active.x, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
        </div>
      )}
    </div>
  );
}

export function BarChart({ values, labels, height = 150, unit = '', highlightLast = true, format = fmtTick, integer = false }: {
  values: number[]; labels: string[]; height?: number; unit?: string; highlightLast?: boolean; format?: (n: number) => string; integer?: boolean;
}) {
  const W = 340, H = height, L = 30, R = 6, T = 14, B = 22;
  const max = Math.max(1, ...values);
  const ticks = niceTicks(0, max, 3, integer).filter((t) => t >= 0);
  const labelStep = values.length <= 8 ? 1 : values.length <= 16 ? 2 : 3;
  const top = ticks[ticks.length - 1] || 1;
  const bw = (W - L - R) / values.length;
  const sy = (v: number) => T + (1 - v / top) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height: 'auto' }} role="img" aria-label={`Bar chart${unit ? ' in ' + unit : ''}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="rgb(var(--line))" strokeDasharray="2 4" />
          <text x={L - 5} y={sy(t) + 3.5} textAnchor="end" fontSize="10" fill="rgb(var(--mute))">{format(t)}</text>
        </g>
      ))}
      {values.map((v, i) => {
        const isLast = highlightLast && i === values.length - 1;
        const h = Math.max(v > 0 ? 2 : 0, H - B - sy(v));
        return (
          <g key={i}>
            <rect x={L + i * bw + bw * 0.18} y={H - B - h} width={bw * 0.64} height={h} rx={Math.min(4, bw * 0.2)}
              fill={isLast ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.45)'} />
            {(values.length - 1 - i) % labelStep === 0 && (
              <text x={L + i * bw + bw / 2} y={H - 7} textAnchor="middle" fontSize="9.5" fill="rgb(var(--mute))">{labels[i]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
