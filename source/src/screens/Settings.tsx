import { useEffect, useRef, useState } from 'react';
import { normalize, useStore } from '../store';
import { useNav } from '../nav';
import { Button, Confirm, Segmented, Sheet, Stepper, cx, inputCls } from '../ui/kit';
import { repo, requestPersistentStorage } from '../storage/repository';
import { primeAudio, ringBell } from '../lib/hooks';
import { fmtClock, fmtDate, parseNum } from '../lib/util';
import type { AppData } from '../types';

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-line/50 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-[16px]">{label}</div>
        {sub && <div className="text-[13px] text-mute">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cx('relative h-8 w-[52px] rounded-full transition-colors', checked ? 'bg-done' : 'bg-line')}>
      <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left]', checked ? 'left-[24px]' : 'left-1')} />
    </button>
  );
}

const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

export function Settings() {
  const data = useStore((s) => s.data);
  const update = useStore((s) => s.updateSettings);
  const replaceAll = useStore((s) => s.replaceAll);
  const resetAll = useStore((s) => s.resetAll);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const toast = useNav((s) => s.showToast);
  const s = data.settings;
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pending, setPending] = useState<AppData | null>(null);
  const [paste, setPaste] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [bwText, setBwText] = useState(s.bodyweight == null ? '' : String(s.bodyweight));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void requestPersistentStorage().then(setPersisted); }, []);

  const json = exportOpen ? JSON.stringify({ app: 'ironbook', exportedAt: new Date().toISOString(), ...data }, null, 1) : '';
  const fileName = `ironbook-backup-${new Date().toISOString().slice(0, 10)}.json`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(json); toast('Backup copied to clipboard'); }
    catch {
      const ta = document.getElementById('export-json') as HTMLTextAreaElement | null;
      ta?.focus(); ta?.select();
      toast('Copy blocked here. Text is selected, use Copy from the menu.');
    }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { toast('Download blocked. Use Copy instead.'); }
  };

  const parse = (text: string) => {
    try {
      const d = normalize(JSON.parse(text));
      setPending(d);
    } catch (e) {
      toast(e instanceof Error ? `Import failed: ${e.message}` : 'Import failed');
    }
  };

  return (
    <div className="gutter pb-10 pt-4">
      <h1 className="font-display text-[34px] font-bold leading-none tracking-wide">Settings</h1>

      <h2 className="label mt-6">Workout</h2>
      <div className="mt-2 rounded-2xl bg-surface px-4">
        <Row label="Default rest" sub={fmtClock(s.defaultRestSec)}>
          <div className="w-40"><Stepper value={s.defaultRestSec} step={15} min={15} max={600} onChange={(v) => update({ defaultRestSec: v })} /></div>
        </Row>
        <Row label="Auto-start rest timer" sub="After ticking a set"><Toggle id="set-autorest" checked={s.autoRest} onChange={(v) => update({ autoRest: v })} /></Row>
        <Row label="Ring bell" sub="Ding-ding-ding when rest ends (ringer on)">
          <div className="flex items-center gap-2">
            <button onClick={() => { primeAudio(); ringBell(); }} className="h-9 rounded-lg bg-raised px-3 text-[14px] font-semibold active:bg-line">Test</button>
            <Toggle id="set-sound" checked={s.sound} onChange={(v) => update({ sound: v })} />
          </div>
        </Row>
        <Row label="Show RIR column"><Toggle id="set-rir" checked={s.showRir} onChange={(v) => update({ showRir: v })} /></Row>
        <Row label="Bodyweight (kg)" sub="Adds to pull-up/dip load for e1RM & volume">
          <input id="set-bw" inputMode="decimal" placeholder="—" value={bwText}
            onChange={(e) => { const t = e.target.value.replace(/[^0-9.,]/g, ''); setBwText(t); update({ bodyweight: parseNum(t) }); }}
            className="tnum h-11 w-20 rounded-xl bg-raised text-center text-[17px] font-semibold outline-none focus:ring-2 focus:ring-accent" />
        </Row>
      </div>

      <h2 className="label mt-6">Appearance</h2>
      <div className="mt-2 rounded-2xl bg-surface p-3">
        <Segmented value={s.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
      </div>

      <h2 className="label mt-6">Data & backup</h2>
      <div className="mt-2 rounded-2xl bg-surface px-4">
        <Row label="Stored in" sub={repo.describe()}><span className="text-[13px] text-mute">{lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</span></Row>
        <Row label="Protected from cleanup" sub="Browser persistent-storage grant">
          <span className={cx('text-[14px] font-semibold', persisted ? 'text-done' : 'text-mute')}>{persisted == null ? 'Unknown' : persisted ? 'Yes' : 'No'}</span>
        </Row>
        <Row label="On this device" sub={`${data.workouts.length} workouts · ${data.templates.length} routines · ${data.exercises.filter((e) => e.custom).length} custom exercises`}><span /></Row>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button onClick={() => setExportOpen(true)}>Export backup</Button>
        <Button variant="ghost" onClick={() => setImportOpen(true)}>Import backup</Button>
      </div>
      <div className="mt-4 rounded-2xl border border-warm/40 bg-warm/10 p-4 text-[14px] leading-relaxed">
        <div className="font-semibold text-warm">Your data lives only in this browser</div>
        <p className="mt-1 text-fg/90">
          Workouts are saved on this device (IndexedDB, with a localStorage copy). Nothing syncs between your phone and other devices or browsers.
          Clearing Safari website data, using Private Browsing, or iOS removing data for a site you haven’t opened in a while can erase it.
          Export a backup regularly and keep the file in iCloud Drive or Notes.
        </p>
      </div>

      <h2 className="label mt-6">Danger zone</h2>
      <Button variant="danger" className="mt-2 w-full" onClick={() => setConfirmReset(true)}>Erase all data</Button>
      <div className="mt-8 text-center text-[12px] text-mute">Ironbook v1 · data schema {data.schemaVersion}</div>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Export backup" z={70}>
        <div className="text-[14px] text-mute">Full backup: workouts, routines, custom exercises and settings. Paste it into Import on any device to restore.</div>
        <div className={cx('mt-3 grid gap-2', embedded ? 'grid-cols-1' : 'grid-cols-2')}>
          <Button onClick={copy}>Copy JSON</Button>
          {!embedded && <Button variant="ghost" onClick={download}>Download file</Button>}
        </div>
        <div className="mt-2 text-[12px] text-mute">{embedded ? 'Paste it into a note or a file in iCloud Drive to keep it safe.' : 'Save the file to iCloud Drive or Files.'}</div>
        <textarea id="export-json" readOnly value={json} className={cx(inputCls, 'tnum mt-3 h-40 py-2 font-mono text-[11px]')} />
      </Sheet>

      <Sheet open={importOpen} onClose={() => { setImportOpen(false); setPaste(''); }} title="Import backup" z={70}>
        <div className="text-[14px] text-mute">Importing replaces everything currently on this device. Export first if you want to keep it.</div>
        <input ref={fileRef} id="import-file" type="file" accept="application/json,.json,text/plain" className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) parse(await f.text()); e.target.value = ''; }} />
        <Button className="mt-3 w-full" onClick={() => fileRef.current?.click()}>Choose backup file</Button>
        <div className="my-3 text-center text-[13px] text-mute">or paste the JSON</div>
        <textarea id="import-paste" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"app":"ironbook", …}'
          onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t) { e.preventDefault(); setPaste(t); } }}
          className={cx(inputCls, 'h-32 py-2 font-mono text-[12px]')} />
        <Button variant="ghost" className="mt-2 w-full" disabled={!paste.trim()} onClick={() => parse(paste)}>Import pasted text</Button>
      </Sheet>

      <Confirm open={!!pending} onClose={() => setPending(null)} danger title="Replace all data?"
        body={pending ? `This backup has ${pending.workouts.length} workouts (latest ${pending.workouts.length ? fmtDate(Math.max(...pending.workouts.map((w) => w.startedAt))) : '—'}) and ${pending.templates.length} routines. Current data on this device will be replaced.` : ''}
        confirmLabel="Replace with backup"
        onConfirm={() => { if (pending) { replaceAll(pending); setBwText(pending.settings.bodyweight == null ? '' : String(pending.settings.bodyweight)); setImportOpen(false); setPaste(''); toast('Backup restored'); } }} />
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} danger title="Erase everything?"
        body="All workouts, routines and custom exercises on this device will be deleted and the five starter routines restored. This can't be undone without a backup."
        confirmLabel="Erase all data" onConfirm={() => { resetAll(); setBwText(''); toast('All data erased'); }} />
    </div>
  );
}
