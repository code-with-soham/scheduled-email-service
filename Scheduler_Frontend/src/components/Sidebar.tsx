import { useEffect, useState } from 'react';
import { slackApi } from '../api/slackApi';
import type { GoogleUser } from '../api/types';
import { Avatar } from './ui';
import { ChevronDownIcon, ClockIcon, PlaneIcon } from './icons';

type Props = {
  user: GoogleUser;
  tab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  scheduledCount: number;
  sentCount: number;
  onCompose: () => void;
  onLogout: () => void;
};

export function Sidebar({ user, tab, onTabChange, scheduledCount, sentCount, onCompose, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState<boolean | null>(null);
  const [slackTeam, setSlackTeam] = useState<string | null>(null);
  const [slackBusy, setSlackBusy] = useState(false);

  useEffect(() => {
    slackApi.status().then((status) => { setSlackConnected(status.connected); setSlackTeam(status.teamName); }).catch(() => setSlackConnected(null));
  }, []);

  async function disconnectSlack() {
    setSlackBusy(true);
    try { await slackApi.disconnect(); setSlackConnected(false); setSlackTeam(null); } finally { setSlackBusy(false); }
  }

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border bg-white px-5 py-6">
      <div className="select-none text-[26px] font-black italic tracking-tight text-ink">ONB</div>

      <div className="relative mt-6">
        <button className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1 text-left hover:bg-slate-50" onClick={() => setMenuOpen((v) => !v)}>
          <Avatar name={user.name} picture={user.picture} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <ChevronDownIcon className={`h-4 w-4 shrink-0 text-slate-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-white shadow-popover">
            <div className="border-b border-border px-3.5 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Slack alerts</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {slackConnected === null ? 'Unavailable' : slackConnected ? `Connected${slackTeam ? ` · ${slackTeam}` : ''}` : 'Get notified when a sender hits its limit'}
              </p>
              {slackConnected === false && (
                <a href={slackApi.connectUrl()} className="mt-1.5 inline-block text-xs font-semibold text-emerald">Connect Slack</a>
              )}
              {slackConnected === true && (
                <button disabled={slackBusy} onClick={disconnectSlack} className="mt-1.5 text-xs font-semibold text-red-500">
                  {slackBusy ? 'Disconnecting…' : 'Disconnect'}
                </button>
              )}
            </div>
            <button className="block w-full px-3.5 py-2.5 text-left text-sm text-ink hover:bg-slate-50" onClick={() => { setMenuOpen(false); onLogout(); }}>Log out</button>
          </div>
        )}
      </div>

      <button onClick={onCompose} className="mt-5 w-full rounded-full border border-emerald py-2.5 text-sm font-semibold text-emerald transition hover:bg-mint">
        Compose
      </button>

      <p className="mt-7 px-1 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400">Core</p>
      <nav className="mt-2 flex flex-col gap-1">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${tab === 'scheduled' ? 'bg-mint text-ink' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <span className="flex items-center gap-2.5"><ClockIcon className="h-[17px] w-[17px]" /> Scheduled</span>
          <span className={`text-xs font-semibold ${tab === 'scheduled' ? 'text-ink' : 'text-slate-400'}`}>{scheduledCount}</span>
        </button>
        <button
          onClick={() => onTabChange('sent')}
          className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${tab === 'sent' ? 'bg-mint text-ink' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <span className="flex items-center gap-2.5"><PlaneIcon className="h-[17px] w-[17px]" /> Sent</span>
          <span className={`text-xs font-semibold ${tab === 'sent' ? 'text-ink' : 'text-slate-400'}`}>{sentCount}</span>
        </button>
      </nav>
    </aside>
  );
}
