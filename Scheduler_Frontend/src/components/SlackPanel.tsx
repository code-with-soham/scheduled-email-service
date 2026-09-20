import { useEffect, useState } from 'react';
import { slackApi } from '../api/slackApi';
import { Button } from './ui';

export function SlackPanel() {
  const [connected, setConnected] = useState<boolean | null>(null); const [team, setTeam] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { slackApi.status().then((status) => { setConnected(status.connected); setTeam(status.teamName); }).catch(() => setConnected(null)); }, []);
  async function disconnect() { setBusy(true); try { await slackApi.disconnect(); setConnected(false); setTeam(null); } finally { setBusy(false); } }
  if (connected === null) return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card"><p className="text-sm font-bold text-ink">Slack alerts</p><p className="mt-1 text-xs text-slate-500">Connection status will be available when the backend is running.</p></div>;
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-ink">Slack alerts</p><p className="mt-1 text-xs text-slate-500">{connected ? `Connected${team ? ` to ${team}` : ''}` : 'Get a message when a sender reaches its limit.'}</p></div><span className={`mt-1 h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald' : 'bg-slate-300'}`} /></div>{connected ? <Button className="mt-4 w-full" variant="ghost" disabled={busy} onClick={disconnect}>{busy ? 'Disconnecting…' : 'Disconnect Slack'}</Button> : <><Button className="mt-4 w-full" variant="secondary" onClick={() => setNotice(`Slack connection will redirect to ${slackApi.connectUrl()} after the backend provides an authenticated redirect/session bridge.`)}>Connect Slack</Button><p className="mt-2 text-[11px] leading-4 text-slate-400">The current protected backend endpoint requires a Bearer header, which browser redirects cannot carry.</p>{notice && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">{notice}</p>}</>}</div>;
}
