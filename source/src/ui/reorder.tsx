import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../lib/hooks';
import { cx } from './kit';

const HOLD_MS = 380;
const MOVE_TOLERANCE = 10;
const ROW_H = 60;

/**
 * Long-press detector. Holding still for HOLD_MS fires onHold with the
 * pointer's clientY; moving or lifting earlier cancels (so normal scrolling
 * and taps keep working).
 */
export function useLongPress(onHold: (clientY: number, index: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; start.current = null; };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, a')) return;
      start.current = { x: e.clientX, y: e.clientY };
      const y = e.clientY;
      const idx = Number((e.currentTarget as HTMLElement).dataset.index ?? 0);
      timer.current = setTimeout(() => { timer.current = null; haptic(20); onHold(y, idx); }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current || !timer.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export interface ReorderItem { key: string; title: string; subtitle?: string; accent?: string }

interface DragState { from: number; to: number; y: number }

/**
 * Full-screen compact list for reordering. Opens mid-gesture from a long
 * press (initialIndex + initialY), follows the same finger, and calls
 * onDone(from, to) on release. Rows can also be dragged again afterwards
 * until "Done" is tapped.
 */
export function ReorderOverlay({ items, initialIndex, initialY, onMove, onClose }: {
  items: ReorderItem[]; initialIndex: number; initialY: number;
  onMove: (from: number, to: number) => void; onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>({ from: initialIndex, to: initialIndex, y: initialY });
  const [listTop, setListTop] = useState<number | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const firstGesture = useRef(true);

  // Position the list so the held row starts right under the finger.
  useEffect(() => {
    const vh = window.innerHeight;
    const total = items.length * ROW_H;
    let top = initialY - initialIndex * ROW_H - ROW_H / 2;
    top = Math.min(Math.max(top, 90), Math.max(90, vh - total - 110));
    setListTop(top);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const indexAt = useCallback((y: number) => {
    const top = listRef.current?.getBoundingClientRect().top ?? 0;
    return Math.max(0, Math.min(items.length - 1, Math.floor((y - top) / ROW_H)));
  }, [items.length]);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const to = indexAt(e.clientY);
      if (to !== d.to) haptic(8);
      setDrag({ ...d, to, y: e.clientY });
    };
    const up = () => {
      const d = dragRef.current;
      if (d && d.from !== d.to) onMove(d.from, d.to);
      setDrag(null);
      if (firstGesture.current) { firstGesture.current = false; onClose(); }
    };
    // Block page scroll while dragging (needs a non-passive listener on iOS).
    const block = (e: TouchEvent) => e.preventDefault();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.addEventListener('touchmove', block, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('touchmove', block);
    };
  }, [drag != null, indexAt, onMove, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = listTop ?? 90;
  const shift = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -ROW_H;
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return ROW_H;
    return 0;
  };

  return createPortal(
    <div className="anim-fade fixed inset-0 z-[85] bg-bg/92 backdrop-blur-sm" style={{ touchAction: 'none' }}>
      <div className="gutter pt-safe absolute inset-x-0 top-0 z-20 flex h-[76px] items-end justify-between bg-bg pb-3">
        <div className="font-display text-[20px] font-semibold tracking-wide">Reorder</div>
        <button onClick={onClose} className="h-10 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">Done</button>
      </div>
      <div ref={listRef} className="gutter absolute inset-x-0" style={{ top }}>
        <div className="relative mx-auto max-w-[560px]" style={{ height: items.length * ROW_H }}>
          {items.map((it, i) => {
            const isDrag = drag?.from === i;
            const y = isDrag ? drag!.y - top - ROW_H / 2 : i * ROW_H + shift(i);
            return (
              <div key={it.key}
                onPointerDown={(e) => { firstGesture.current = false; setDrag({ from: i, to: i, y: e.clientY }); haptic(10); }}
                className={cx('absolute inset-x-0 flex select-none items-center gap-3 rounded-2xl px-4',
                  isDrag ? 'z-10 scale-[1.03] bg-raised shadow-2xl shadow-black/50 ring-2 ring-accent' : 'bg-surface transition-transform duration-150')}
                style={{ height: ROW_H - 8, transform: `translateY(${y}px)${isDrag ? ' scale(1.03)' : ''}`, touchAction: 'none' }}>
                {it.accent && <span className="h-7 w-[3px] rounded-full" style={{ background: `rgb(${it.accent})` }} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{it.title}</div>
                  {it.subtitle && <div className="truncate text-[12px] text-mute">{it.subtitle}</div>}
                </div>
                <GripIcon />
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center text-[13px] text-mute">Drag to reorder · let go to drop</div>
      </div>
    </div>,
    document.body,
  );
}

function GripIcon(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-mute" fill="currentColor">
      {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  );
}

/** Move an array element and drop superset links that are no longer adjacent pairs. */
export function moveItem<T extends { supersetId?: string }>(arr: T[], from: number, to: number) {
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
  // A superset group must stay contiguous; unlink anything that got separated.
  const seen = new Map<string, number>();
  arr.forEach((e, i) => {
    if (!e.supersetId) return;
    const last = seen.get(e.supersetId);
    if (last != null && last !== i - 1) e.supersetId = undefined;
    else seen.set(e.supersetId, i);
  });
  const counts = new Map<string, number>();
  arr.forEach((e) => e.supersetId && counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1));
  arr.forEach((e) => { if (e.supersetId && counts.get(e.supersetId) === 1) e.supersetId = undefined; });
}
