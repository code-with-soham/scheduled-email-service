import type { EmailRecord } from '../api/types';
import { EmptyState, ErrorState, IconButton, LoadingState } from './ui';
import { FilterIcon, RefreshIcon, SearchIcon, StarIcon } from './icons';

function formatTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(date);
  return `${day} ${time}`;
}

function bodyPreview(email: EmailRecord) {
  const text = email.bodyText || '';
  return text.length > 70 ? `${text.slice(0, 70)}…` : text || 'No preview available';
}

function recipientLabel(email: EmailRecord) {
  const at = email.to.indexOf('@');
  return at > 0 ? email.to.slice(0, at) : email.to;
}

type Props = {
  emails: EmailRecord[];
  mode: 'scheduled' | 'sent';
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (email: EmailRecord) => void;
  starred: Set<string>;
  onToggleStar: (id: string) => void;
};

export function EmailList({ emails, mode, loading, error, search, onSearchChange, onRefresh, onSelect, starred, onToggleStar }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex flex-1 items-center gap-2.5 rounded-xl bg-panel px-4 py-2.5">
          <SearchIcon className="h-[18px] w-[18px] text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
          />
        </div>
        <IconButton aria-label="Filter"><FilterIcon className="h-[18px] w-[18px]" /></IconButton>
        <IconButton aria-label="Refresh" onClick={onRefresh}><RefreshIcon className="h-[18px] w-[18px]" /></IconButton>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState label={`Loading ${mode} emails…`} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRefresh} />
        ) : !emails.length ? (
          <EmptyState
            title={mode === 'scheduled' ? 'Nothing scheduled yet' : 'No sent emails yet'}
            detail={mode === 'scheduled' ? 'Compose a campaign to see upcoming sends here.' : 'Completed and failed sends will appear here.'}
          />
        ) : (
          emails.map((email) => (
            <button
              key={email.id}
              onClick={() => onSelect(email)}
              className="flex w-full items-center gap-4 border-b border-border px-6 py-4 text-left transition hover:bg-panel"
            >
              <span className="w-40 shrink-0 truncate text-sm font-semibold text-ink">To: {recipientLabel(email)}</span>
              {mode === 'scheduled' ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-peach px-2.5 py-1 text-[11px] font-semibold text-peach-text">
                  {formatTime(email.scheduledAt)}
                </span>
              ) : (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${email.status === 'FAILED' ? 'bg-red-50 text-red-600' : 'bg-sent-bg text-sent-text'}`}>
                  {email.status === 'FAILED' ? 'Failed' : 'Sent'}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                <span className="font-medium text-ink">{email.subject}</span> · {bodyPreview(email)}
              </span>
              <span
                role="button"
                tabIndex={-1}
                onClick={(event) => { event.stopPropagation(); onToggleStar(email.id); }}
                className="shrink-0 text-slate-300 transition hover:text-amber-400"
              >
                <StarIcon filled={starred.has(email.id)} className={`h-[18px] w-[18px] ${starred.has(email.id) ? 'text-amber-400' : ''}`} />
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
