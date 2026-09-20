import { useRef, useState } from 'react';
import { emailApi } from '../api/emailApi';
import type { Sender } from '../api/types';
import { parseLeads } from '../lib/csv';
import { SendLaterPopover } from './SendLaterPopover';
import { Button, IconButton, Input } from './ui';
import {
  AlignCenterIcon, BackArrowIcon, BoldIcon, ChevronDownIcon, ClockIcon, ExpandIcon,
  IndentIcon, ItalicIcon, OrderedListIcon, OutdentIcon, PaperclipIcon, ParagraphIcon,
  QuoteIcon, RedoIcon, StrikeIcon, UnderlineIcon, UndoIcon, UnorderedListIcon, UploadIcon, CloseIcon
} from './icons';

type Props = { senders: Sender[]; onClose: () => void; onScheduled: (count: number) => void };

function exec(command: string, value?: string) { document.execCommand(command, false, value); }

export function ComposeView({ senders, onClose, onScheduled }: Props) {
  const [senderId, setSenderId] = useState(senders[0]?.id ?? '');
  const [senderMenuOpen, setSenderMenuOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [subject, setSubject] = useState('');
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [hourlyLimit, setHourlyLimit] = useState<number>(0);
  const [attachment, setAttachment] = useState<{ name: string; size: string; dataUrl: string } | null>(null);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [sendAt, setSendAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const selectedSender = senders.find((s) => s.id === senderId) ?? senders[0];

  function addRecipientsFromText(text: string) {
    const { emails } = parseLeads(text);
    if (!emails.length) return;
    setRecipients((prev) => Array.from(new Set([...prev, ...emails])));
  }

  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      event.preventDefault();
      addRecipientsFromText(recipientDraft);
      setRecipientDraft('');
    } else if (event.key === 'Backspace' && !recipientDraft && recipients.length) {
      setRecipients((prev) => prev.slice(0, -1));
    }
  }

  async function handleUploadList(file?: File) {
    if (!file) return;
    addRecipientsFromText(await file.text());
  }

  async function handleAttach(file?: File) {
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setAttachment({ name: file.name, size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, dataUrl });
  }

  async function schedule() {
    const body = bodyRef.current?.innerHTML.trim() ?? '';
    const plainText = bodyRef.current?.innerText.trim() ?? '';
    if (!selectedSender) { setError('Choose a sender before scheduling.'); return; }
    if (!subject.trim() || !plainText || !recipients.length) { setError('Add a subject, a message, and at least one recipient.'); return; }

    const start = sendAt ?? new Date(Date.now() + 5_000);
    if (start.getTime() <= Date.now() && sendAt) { setError('Choose a future date & time.'); return; }

    const finalHtml = attachment ? `${body}<br/><img src="${attachment.dataUrl}" alt="${attachment.name}" style="max-width:320px;border-radius:8px;margin-top:8px" />` : body;

    setSubmitting(true); setError(null);
    try {
      await Promise.all(recipients.map((to, index) => emailApi.create({
        idempotencyKey: crypto.randomUUID(),
        senderId: selectedSender.id,
        to,
        subject: subject.trim(),
        bodyText: plainText,
        bodyHtml: finalHtml,
        scheduledAt: new Date(start.getTime() + index * delaySeconds * 1000).toISOString()
      })));
      onScheduled(recipients.length);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scheduling failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, 3);
  const overflowCount = recipients.length - visibleRecipients.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <IconButton aria-label="Back" onClick={onClose}><BackArrowIcon className="h-[18px] w-[18px]" /></IconButton>
        <h2 className="flex-1 text-[17px] font-semibold text-ink">Compose New Email</h2>

        <button className="relative flex items-center gap-1 text-emerald" onClick={() => attachInput.current?.click()} aria-label="Attach file">
          <PaperclipIcon className="h-[18px] w-[18px]" />
          {attachment && <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald text-[10px] font-bold text-white">1</span>}
        </button>
        <input ref={attachInput} type="file" accept="image/*" className="hidden" onChange={(event) => handleAttach(event.target.files?.[0])} />

        <div className="relative">
          <button className="text-emerald" onClick={() => setSendLaterOpen((v) => !v)} aria-label="Send later">
            <ClockIcon className="h-[18px] w-[18px]" />
          </button>
          {sendLaterOpen && (
            <SendLaterPopover
              onCancel={() => setSendLaterOpen(false)}
              onDone={(date) => { setSendAt(date); setSendLaterOpen(false); }}
            />
          )}
        </div>

        <Button variant={sendAt ? 'outline' : 'primary'} onClick={schedule} disabled={submitting}>
          {submitting ? 'Sending…' : sendAt ? 'Send Later' : 'Send'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-4 border-b border-border py-3 text-sm">
          <span className="w-16 shrink-0 text-slate-400">From</span>
          <div className="relative">
            <button className="flex items-center gap-1.5 rounded-full bg-panel px-3 py-1.5 font-medium text-ink" onClick={() => setSenderMenuOpen((v) => !v)}>
              {selectedSender ? selectedSender.email : 'Select sender'} <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {senderMenuOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-white shadow-popover">
                {senders.length === 0 && <p className="px-3.5 py-2.5 text-sm text-slate-400">No senders available</p>}
                {senders.map((sender) => (
                  <button key={sender.id} className="block w-full px-3.5 py-2.5 text-left text-sm text-ink hover:bg-panel" onClick={() => { setSenderId(sender.id); setSenderMenuOpen(false); }}>
                    {sender.name} · {sender.email}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-4 border-b border-border py-3 text-sm">
          <span className="mt-1.5 w-16 shrink-0 text-slate-400">To</span>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {visibleRecipients.map((email) => (
              <span key={email} className="flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-xs font-medium text-emerald-dark">
                {email}
                <button onClick={() => setRecipients((prev) => prev.filter((e) => e !== email))} aria-label={`Remove ${email}`}><CloseIcon className="h-3 w-3" /></button>
              </span>
            ))}
            {overflowCount > 0 && (
              <button className="rounded-full bg-panel px-2.5 py-1 text-xs font-medium text-slate-500" onClick={() => setShowAllRecipients(true)}>+{overflowCount}</button>
            )}
            <input
              value={recipientDraft}
              onChange={(event) => setRecipientDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              onBlur={() => { if (recipientDraft) { addRecipientsFromText(recipientDraft); setRecipientDraft(''); } }}
              placeholder={recipients.length ? '' : 'recipient@example.com'}
              className="min-w-[140px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
            />
          </div>
          <button className="flex shrink-0 items-center gap-1 text-sm font-medium text-emerald" onClick={() => fileInput.current?.click()}>
            <UploadIcon className="h-4 w-4" /> Upload List
          </button>
          <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(event) => handleUploadList(event.target.files?.[0])} />
        </div>

        <div className="flex items-center gap-4 border-b border-border py-3 text-sm">
          <span className="w-16 shrink-0 text-slate-400">Subject</span>
          <Input className="flex-1 border-none px-0 py-0 shadow-none focus:ring-0" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
        </div>

        <div className="flex flex-wrap items-center gap-6 border-b border-border py-3 text-sm">
          <label className="flex items-center gap-2 text-slate-500">
            Delay between 2 emails
            <input type="number" min={0} value={delaySeconds} onChange={(event) => setDelaySeconds(Math.max(0, Number(event.target.value)))} className="w-14 rounded-lg border border-border px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-emerald" />
          </label>
          <label className="flex items-center gap-2 text-slate-500">
            Hourly Limit
            <input type="number" min={0} value={hourlyLimit} onChange={(event) => setHourlyLimit(Math.max(0, Number(event.target.value)))} className="w-14 rounded-lg border border-border px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-emerald" />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-1 rounded-lg bg-panel px-2 py-1.5 text-slate-500" onMouseDown={(event) => event.preventDefault()}>
          <IconButton className="h-7 w-7" onClick={() => exec('undo')} aria-label="Undo"><UndoIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('redo')} aria-label="Redo"><RedoIcon className="h-4 w-4" /></IconButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <button className="flex items-center gap-0.5 rounded px-1.5 py-1 text-sm font-medium hover:bg-white">Tt <ChevronDownIcon className="h-3.5 w-3.5" /></button>
          <span className="mx-1 h-5 w-px bg-border" />
          <IconButton className="h-7 w-7" onClick={() => exec('bold')} aria-label="Bold"><BoldIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('italic')} aria-label="Italic"><ItalicIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('underline')} aria-label="Underline"><UnderlineIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('justifyCenter')} aria-label="Align center"><AlignCenterIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" aria-label="Expand"><ExpandIcon className="h-4 w-4" /></IconButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <IconButton className="h-7 w-7" onClick={() => exec('insertOrderedList')} aria-label="Ordered list"><OrderedListIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('insertUnorderedList')} aria-label="Unordered list"><UnorderedListIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('indent')} aria-label="Indent"><IndentIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('outdent')} aria-label="Outdent"><OutdentIcon className="h-4 w-4" /></IconButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <IconButton className="h-7 w-7" onClick={() => exec('formatBlock', 'blockquote')} aria-label="Quote"><QuoteIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('formatBlock', 'p')} aria-label="Paragraph"><ParagraphIcon className="h-4 w-4" /></IconButton>
          <IconButton className="h-7 w-7" onClick={() => exec('strikeThrough')} aria-label="Strikethrough"><StrikeIcon className="h-4 w-4" /></IconButton>
        </div>

        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Type Your Reply…"
          className="rte-body mt-3 min-h-[220px] rounded-b-lg bg-panel px-4 py-4 text-sm text-ink"
        />

        {attachment && (
          <div className="relative mt-4 inline-block">
            <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-28 rounded-xl object-cover" />
            <button onClick={() => setAttachment(null)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-white shadow"><CloseIcon className="h-3.5 w-3.5" /></button>
            <p className="mt-1 max-w-[7rem] truncate text-xs text-slate-500">{attachment.name} · {attachment.size}</p>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
