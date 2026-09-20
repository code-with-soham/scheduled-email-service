import type { EmailRecord, GoogleUser } from '../api/types';
import { Avatar, IconButton } from './ui';
import { ArchiveIcon, BackArrowIcon, ChevronDownIcon, StarIcon, TrashIcon } from './icons';

function formatFull(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

const avatarPalette = ['#17a85a', '#2563eb', '#db2777', '#d97706', '#7c3aed'];
function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % avatarPalette.length;
  return avatarPalette[hash];
}

type Props = {
  email: EmailRecord;
  user: GoogleUser;
  onBack: () => void;
  starred: boolean;
  onToggleStar: () => void;
};

export function EmailDetail({ email, user, onBack, starred, onToggleStar }: Props) {
  const senderName = email.sender?.name || email.sender?.email || 'Sender';
  const senderEmail = email.sender?.email || 'sender@example.com';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <IconButton aria-label="Back" onClick={onBack}><BackArrowIcon className="h-[18px] w-[18px]" /></IconButton>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
          {email.subject} <span className="mx-1 font-normal text-slate-300">|</span>
          <span className="font-normal text-slate-400">{email.id.slice(0, 8).toUpperCase()}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton aria-label="Star" onClick={onToggleStar}><StarIcon filled={starred} className={starred ? 'h-[18px] w-[18px] text-amber-400' : 'h-[18px] w-[18px]'} /></IconButton>
          <IconButton aria-label="Archive"><ArchiveIcon className="h-[18px] w-[18px]" /></IconButton>
          <IconButton aria-label="Delete"><TrashIcon className="h-[18px] w-[18px]" /></IconButton>
          <Avatar name={user.name} picture={user.picture} className="ml-1" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: colorFor(senderEmail) }}>
              {senderName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{senderName} <span className="font-normal text-slate-400">&lt;{senderEmail}&gt;</span></p>
              <button className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                to {email.to} <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{formatFull(email.status === 'SENT' || email.status === 'FAILED' ? email.sentAt : email.scheduledAt)}</span>
        </div>

        <div className="mt-6 max-w-2xl text-sm leading-6 text-slate-700">
          {email.bodyHtml
            ? <div dangerouslySetInnerHTML={{ __html: email.bodyHtml }} />
            : email.bodyText.split(/\n{2,}/).map((para, i) => <p key={i} className="mb-4 whitespace-pre-wrap last:mb-0">{para}</p>)}
        </div>

        {email.status === 'FAILED' && email.errorMessage && (
          <div className="mt-6 max-w-2xl rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <strong>Delivery failed:</strong> {email.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
