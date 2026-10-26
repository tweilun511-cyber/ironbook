import { useEffect, type ReactNode } from 'react';
import { IconBack, IconX } from './icons';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'done';
export function Button({ variant = 'primary', className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent text-white active:brightness-90',
    done: 'bg-done text-white active:brightness-90',
    soft: 'bg-accent/15 text-accent active:bg-accent/25',
    ghost: 'bg-raised text-fg active:bg-line',
    danger: 'bg-danger/15 text-danger active:bg-danger/25',
  };
  return (
    <button
      {...p}
      className={cx('min-h-[48px] rounded-2xl px-4 font-semibold text-[16px] transition-[filter,background] disabled:opacity-40', v[variant], className)}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, children, label, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} {...p} className={cx('grid h-11 w-11 place-items-center rounded-xl text-fg active:bg-raised', className)}>
      {children}
    </button>
  );
}

/** Full-screen page pushed over the tabs. */
export function Page({ title, onBack, right, children, footer, back = 'back' }: {
  title?: ReactNode; onBack: () => void; right?: ReactNode; children: ReactNode; footer?: ReactNode; back?: 'back' | 'close';
}) {
  return (
    <div className="anim-page fixed inset-0 z-40 flex flex-col bg-bg">
      <header className="gutter pt-safe shrink-0 border-b border-line/60 bg-bg/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2">
          <IconButton label={back === 'close' ? 'Close' : 'Back'} onClick={onBack} className="-ml-2 text-accent">
            {back === 'close' ? <IconX /> : <IconBack />}
          </IconButton>
          <div className="min-w-0 flex-1 truncate font-display text-[20px] font-semibold tracking-wide">{title}</div>
          {right}
        </div>
      </header>
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</main>
      {footer && <div className="gutter pb-safe shrink-0 border-t border-line/60 bg-bg pt-3"><div className="pb-3">{footer}</div></div>}
    </div>
  );
}

/** Bottom sheet modal. */
export function Sheet({ open, onClose, title, children, z = 60 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; z?: number }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: z }}>
      <div className="anim-fade absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="anim-sheet relative max-h-[88%] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-surface pb-safe no-scrollbar">
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" />
          {title && <div className="gutter pt-3 pb-1 font-display text-[22px] font-semibold tracking-wide">{title}</div>}
        </div>
        <div className="gutter pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

export interface Action { label: string; onClick: () => void; danger?: boolean; icon?: ReactNode; hint?: string }
export function ActionSheet({ open, onClose, title, actions }: { open: boolean; onClose: () => void; title?: ReactNode; actions: Action[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} z={70}>
      <div className="flex flex-col gap-1">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => { onClose(); a.onClick(); }}
            className={cx('flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-left text-[17px] active:bg-raised', a.danger ? 'text-danger' : 'text-fg')}
          >
            {a.icon && <span className="opacity-80">{a.icon}</span>}
            <span className="flex-1">{a.label}</span>
            {a.hint && <span className="text-sm text-mute">{a.hint}</span>}
          </button>
        ))}
        <Button variant="ghost" className="mt-2" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

export function Confirm({ open, title, body, confirmLabel, danger, onConfirm, onClose, extra }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void; extra?: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} z={80}>
      {body && <div className="mb-4 text-[15px] leading-relaxed text-mute">{body}</div>}
      <div className="flex flex-col gap-2">
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onClose(); onConfirm(); }}>{confirmLabel}</Button>
        {extra}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('flex rounded-xl bg-raised p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-[36px] flex-1 rounded-lg px-2 text-[14px] font-semibold transition-colors', value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-mute')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = 'min-h-[48px] w-full rounded-xl bg-raised px-3.5 text-[16px] text-fg placeholder:text-mute/70 outline-none focus:ring-2 focus:ring-accent';

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, suffix }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-raised p-1">
      <button aria-label="Decrease" className="grid h-10 w-10 place-items-center rounded-lg text-xl font-semibold active:bg-line" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <div className="tnum min-w-[3ch] flex-1 text-center text-[17px] font-semibold">{value}{suffix}</div>
      <button aria-label="Increase" className="grid h-10 w-10 place-items-center rounded-lg text-xl font-semibold active:bg-line" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="font-display text-[20px] font-semibold">{title}</div>
      {body && <div className="max-w-[30ch] text-[15px] text-mute">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
