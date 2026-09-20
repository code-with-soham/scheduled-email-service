import { useCallback, useEffect, useRef, useState } from 'react';
import { authApi } from './api/authApi';
import { emailApi } from './api/emailApi';
import { senderApi } from './api/senderApi';
import type { EmailRecord, GoogleUser, Sender } from './api/types';
import { ComposeView } from './components/ComposeView';
import { EmailList } from './components/EmailList';
import { EmailDetail } from './components/EmailDetail';
import { Sidebar } from './components/Sidebar';
import { Button, Toast } from './components/ui';

declare global {
  interface Window { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void; prompt: () => void } } } }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const previewEnabled = import.meta.env.VITE_ENABLE_DEV_PREVIEW === 'true';
const previewUser: GoogleUser = { name: 'Olivia Hart', email: 'olivia@example.com', idToken: '' };

function decodeGoogleUser(idToken: string): GoogleUser {
  const [, payload] = idToken.split('.');
  const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { name?: string; email: string; picture?: string };
  return { name: data.name || data.email, email: data.email, picture: data.picture, idToken };
}

/** Module-level flag: google.accounts.id.initialize() must be called exactly once. */
let gsiInitialized = false;

function Login({ onLogin }: { onLogin: (user: GoogleUser) => void }) {
  const [message, setMessage] = useState<string | null>(null);
  // Store onLogin in a ref so the useEffect has no dependency on callback identity.
  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;
  useEffect(() => {
    if (!googleClientId || gsiInitialized) return;
    function initGsi() {
      if (gsiInitialized) return;
      gsiInitialized = true;
      window.google?.accounts.id.initialize({ client_id: googleClientId!, callback: ({ credential }) => onLoginRef.current(decodeGoogleUser(credential)) });
    }
    // If the GSI script is already loaded (e.g. HMR re-mount), just initialize.
    if (window.google?.accounts?.id) { initGsi(); return; }
    // Avoid adding duplicate script elements.
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      script.onload = initGsi;
      document.head.appendChild(script);
    }
  }, []);
  function signIn() { if (!googleClientId) { setMessage('Set VITE_GOOGLE_CLIENT_ID to enable real Google sign-in.'); return; } window.google?.accounts.id.prompt(); }
  return (
    <main className="grid min-h-screen place-items-center bg-white p-5">
      <section className="w-full max-w-[460px] rounded-[24px] border border-slate-100 bg-white px-10 py-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h1 className="text-[32px] font-bold text-[#1F1F1F]">Login</h1>
        <button 
          onClick={signIn}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-[#F0F8F1] py-3.5 text-[15px] font-medium text-[#1F1F1F] transition hover:bg-[#e4f1e5]"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
          Login with Google
        </button>
        <div className="my-8 flex items-center gap-4 text-[13px] text-[#A0A0A0]">
          <span className="h-[1px] flex-1 bg-[#F0F0F0]" />
          or sign up through email
          <span className="h-[1px] flex-1 bg-[#F0F0F0]" />
        </div>
        <div className="space-y-4">
          <input 
            type="email" 
            placeholder="Email ID" 
            className="w-full rounded-lg bg-[#F5F6F5] px-4 py-3.5 text-[15px] text-[#1F1F1F] outline-none placeholder:text-[#A0A0A0]"
            disabled
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full rounded-lg bg-[#F5F6F5] px-4 py-3.5 text-[15px] text-[#1F1F1F] outline-none placeholder:text-[#A0A0A0]"
            disabled
          />
        </div>
        <button className="mt-8 w-full rounded-lg bg-[#00A843] py-3.5 text-[15px] font-medium text-white transition hover:bg-[#00963c]">
          Login
        </button>
        {message && <p className="mt-4 text-xs text-amber-700">{message}</p>}
        {previewEnabled && <button className="mt-4 text-xs font-semibold text-[#00A843] underline" onClick={() => onLogin(previewUser)}>Open isolated UI preview</button>}
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<GoogleUser | null>(() => authApi.restoreGoogleSession());
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentView, setCurrentView] = useState<'list' | 'compose' | 'detail'>('list');
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  
  const [search, setSearch] = useState('');
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!user?.idToken) return;
    setLoading(true); setError(null);
    try {
      const [all, availableSenders] = await Promise.all([emailApi.list(), senderApi.list()]);
      setEmails(all); setSenders(availableSenders);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the API.');
    } finally {
      setLoading(false);
    }
  }, [user?.idToken]);
  
  useEffect(() => { void load(); }, [load]);
  
  const login = useCallback((nextUser: GoogleUser) => {
    if (!nextUser.idToken && !previewEnabled) return;
    if (nextUser.idToken) authApi.saveGoogleSession(nextUser);
    setUser(nextUser);
  }, []);
  
  if (!user) return <Login onLogin={login} />;
  
  const visibleEmails = emails.filter((email) => {
    if (search && !email.subject.toLowerCase().includes(search.toLowerCase()) && !email.to.toLowerCase().includes(search.toLowerCase())) return false;
    return tab === 'scheduled' ? ['SCHEDULED', 'PROCESSING'].includes(email.status) : ['SENT', 'FAILED'].includes(email.status);
  });
  
  return (
    <div className="flex h-screen bg-canvas overflow-hidden font-sans">
      <Sidebar
        user={user}
        tab={tab}
        onTabChange={(newTab) => { setTab(newTab); setCurrentView('list'); setSelectedEmail(null); }}
        scheduledCount={emails.filter((item) => ['SCHEDULED', 'PROCESSING'].includes(item.status)).length}
        sentCount={emails.filter((item) => ['SENT', 'FAILED'].includes(item.status)).length}
        onCompose={() => setCurrentView('compose')}
        onLogout={() => { authApi.logout(); setUser(null); }}
      />
      <main className="flex-1 overflow-hidden bg-white">
        {currentView === 'compose' ? (
          <ComposeView
            senders={senders}
            onClose={() => setCurrentView('list')}
            onScheduled={(count) => { setToast({ message: `${count} email${count === 1 ? '' : 's'} scheduled.`, tone: 'success' }); setCurrentView('list'); void load(); }}
          />
        ) : currentView === 'detail' && selectedEmail ? (
          <EmailDetail
            email={selectedEmail}
            user={user}
            onBack={() => setCurrentView('list')}
            starred={starred.has(selectedEmail.id)}
            onToggleStar={() => {
              const next = new Set(starred);
              if (next.has(selectedEmail.id)) next.delete(selectedEmail.id);
              else next.add(selectedEmail.id);
              setStarred(next);
            }}
          />
        ) : (
          <EmailList
            emails={visibleEmails}
            mode={tab}
            loading={loading}
            error={error}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => void load()}
            onSelect={(email) => { setSelectedEmail(email); setCurrentView('detail'); }}
            starred={starred}
            onToggleStar={(id) => {
              const next = new Set(starred);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              setStarred(next);
            }}
          />
        )}
      </main>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
