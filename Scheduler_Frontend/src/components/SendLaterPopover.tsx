import { useState } from 'react';
import { Button } from './ui';
import { CalendarIcon } from './icons';

function atTomorrow(hour?: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  if (hour === undefined) { date.setHours(9, 0, 0, 0); } else { date.setHours(hour, minute, 0, 0); }
  return date;
}

const quickOptions: { label: string; get: () => Date }[] = [
  { label: 'Tomorrow', get: () => atTomorrow() },
  { label: 'Tomorrow, 10:00 AM', get: () => atTomorrow(10) },
  { label: 'Tomorrow, 11:00 AM', get: () => atTomorrow(11) },
  { label: 'Tomorrow, 3:00 PM', get: () => atTomorrow(15) }
];

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SendLaterPopover({ onCancel, onDone }: { onCancel: () => void; onDone: (date: Date) => void }) {
  const [custom, setCustom] = useState('');

  function pick(date: Date) { onDone(date); }
  function confirmCustom() {
    if (!custom) return;
    const date = new Date(custom);
    if (!Number.isNaN(date.getTime())) onDone(date);
  }

  return (
    <div className="absolute right-0 top-12 z-20 w-72 rounded-2xl border border-border bg-white p-4 shadow-popover">
      <p className="text-sm font-bold text-ink">Send Later</p>
      <label className="mt-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-slate-500 focus-within:border-emerald">
        <input
          type="datetime-local"
          value={custom}
          min={toLocalInputValue(new Date())}
          onChange={(event) => setCustom(event.target.value)}
          className="w-full bg-transparent text-sm text-ink outline-none [color-scheme:light]"
          placeholder="Pick date & time"
        />
        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
      </label>

      <div className="mt-3 flex flex-col">
        {quickOptions.map((option) => (
          <button
            key={option.label}
            onClick={() => pick(option.get())}
            className="rounded-lg px-2 py-2 text-left text-sm text-slate-600 transition hover:bg-panel hover:text-ink"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-end gap-3 border-t border-border pt-3">
        <button className="text-sm font-medium text-slate-500" onClick={onCancel}>Cancel</button>
        <Button variant="outline" className="px-4 py-1.5" onClick={confirmCustom} disabled={!custom}>Done</Button>
      </div>
    </div>
  );
}
