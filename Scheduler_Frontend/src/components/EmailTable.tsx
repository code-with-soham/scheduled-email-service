import type { EmailRecord } from '../api/types';
import { Badge, EmptyState, ErrorState, LoadingState } from './ui';

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'; }

export function EmailTable({ emails, mode, loading, error, onRetry }: { emails: EmailRecord[]; mode: 'scheduled' | 'sent'; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) return <LoadingState label={`Loading ${mode} emails…`} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!emails.length) return <EmptyState title={mode === 'scheduled' ? 'Nothing scheduled yet' : 'No sent emails yet'} detail={mode === 'scheduled' ? 'Compose a campaign to see upcoming sends here.' : 'Completed and failed sends will appear here.'} />;
  return <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left"><thead className="border-b border-slate-100 text-[11px] uppercase tracking-[.14em] text-slate-400"><tr><th className="px-5 py-4 font-semibold">Recipient</th><th className="px-5 py-4 font-semibold">Subject</th><th className="px-5 py-4 font-semibold">{mode === 'scheduled' ? 'Scheduled time' : 'Sent time'}</th><th className="px-5 py-4 font-semibold">Status</th></tr></thead><tbody>{emails.map((email) => <tr className="border-b border-slate-50 text-sm last:border-0" key={email.id}><td className="px-5 py-4 font-medium text-ink">{email.to}</td><td className="max-w-xs truncate px-5 py-4 text-slate-600">{email.subject}</td><td className="px-5 py-4 text-slate-500">{formatDate(mode === 'scheduled' ? email.scheduledAt : email.sentAt)}</td><td className="px-5 py-4"><Badge status={email.status} /></td></tr>)}</tbody></table></div>;
}
