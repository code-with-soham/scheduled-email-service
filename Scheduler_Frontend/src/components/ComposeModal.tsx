import { useRef, useState } from 'react';
import { emailApi } from '../api/emailApi';
import type { Sender } from '../api/types';
import { parseLeads } from '../lib/csv';
import { Button, Input, Modal, Textarea } from './ui';

type Props = { senders: Sender[]; onClose: () => void; onScheduled: (count: number) => void };

export function ComposeModal({ senders, onClose, onScheduled }: Props) {
  const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [leadText, setLeadText] = useState('');
  const [startTime, setStartTime] = useState(() => new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16));
  const [delaySeconds, setDelaySeconds] = useState(120); const [hourlyLimit, setHourlyLimit] = useState(200); const [senderId, setSenderId] = useState('');
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null); const input = useRef<HTMLInputElement>(null);
  const parsed = parseLeads(leadText); const selectedSender = senderId || senders[0]?.id || '';

  async function readFile(file?: File) { if (file) setLeadText(await file.text()); }
  async function schedule() {
    if (!subject.trim() || !body.trim() || !parsed.emails.length || !selectedSender) { setError(!selectedSender ? 'Choose a sender before scheduling.' : 'Add a subject, email body, and at least one valid recipient.'); return; }
    const start = new Date(startTime); if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) { setError('Choose a future start time.'); return; }
    setSubmitting(true); setError(null);
    try {
      await Promise.all(parsed.emails.map((to, index) => emailApi.create({ idempotencyKey: crypto.randomUUID(), senderId: selectedSender, to, subject: subject.trim(), bodyText: body.trim(), scheduledAt: new Date(start.getTime() + index * delaySeconds * 1000).toISOString() })));
      onScheduled(parsed.emails.length); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Scheduling failed. Please try again.'); }
    finally { setSubmitting(false); }
  }

  return <Modal title="Compose new email" onClose={onClose}><div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-ink">From<select value={selectedSender} onChange={(event) => setSenderId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald"><option value="">Select sender</option>{senders.map((sender) => <option value={sender.id} key={sender.id}>{sender.name} · {sender.email}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold text-ink">Start time<Input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label></div>
    <label className="grid gap-2 text-sm font-semibold text-ink">Subject<Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A thoughtful subject line" maxLength={998} /></label>
    <label className="grid gap-2 text-sm font-semibold text-ink">Email body<Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="Write your message…" /></label>
    <section className="rounded-2xl border border-dashed border-emerald/40 bg-mint/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-ink">Recipients</p><p className="mt-1 text-xs text-slate-500">Upload a CSV or text file, or paste email addresses.</p></div><Button type="button" variant="secondary" onClick={() => input.current?.click()}>Upload file</Button><input ref={input} className="hidden" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => readFile(event.target.files?.[0])} /></div><Textarea className="mt-3 bg-white" rows={4} value={leadText} onChange={(event) => setLeadText(event.target.value)} placeholder="alex@example.com, sam@example.com" /><p className="mt-2 text-xs font-semibold text-emerald">{parsed.emails.length} unique email{parsed.emails.length === 1 ? '' : 's'} detected{parsed.invalidCount ? ` · ${parsed.invalidCount} invalid value${parsed.invalidCount === 1 ? '' : 's'} ignored` : ''}</p></section>
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-ink">Delay between emails (seconds)<Input type="number" min="0" value={delaySeconds} onChange={(event) => setDelaySeconds(Math.max(0, Number(event.target.value)))} /></label><label className="grid gap-2 text-sm font-semibold text-ink">Hourly limit<Input type="number" min="1" value={hourlyLimit} onChange={(event) => setHourlyLimit(Math.max(1, Number(event.target.value)))} /><span className="text-xs font-normal text-slate-500">Displayed for campaign planning. The current API enforces its server-side hourly limit.</span></label></div>
    {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={submitting}>{submitting ? 'Scheduling…' : `Schedule ${parsed.emails.length || ''} email${parsed.emails.length === 1 ? '' : 's'}`}</Button></div>
  </div></Modal>;
}
