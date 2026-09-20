import { useEffect, useState } from 'react';
import type { GoogleUser } from '../api/types';
import { GoogleIcon } from './icons';

declare global {
  interface Window { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void; prompt: () => void } } } }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const previewEnabled = import.meta.env.VITE_ENABLE_DEV_PREVIEW === 'true';
const previewUser: GoogleUser = { name: 'Oliver Brown', email: 'oliver.brown@domain.io', idToken: '' };

function decodeGoogleUser(idToken: string): GoogleUser {
  const [, payload] = idToken.split('.');
  const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { name?: string; email: string; picture?: string };
  return { name: data.name || data.email, email: data.email, picture: data.picture, idToken };
}

export function LoginView({ onLogin }: { onLogin: (user: GoogleUser) => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!googleClientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => window.google?.accounts.id.initialize({ client_id: googleClientId, callback: ({ credential }) => onLogin(decodeGoogleUser(credential)) });
    document.head.appendChild(script);
    return () => script.remove();
  }, [onLogin]);

  function signInWithGoogle() {
    if (!googleClientId) { setMessage('Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.'); return; }
    window.google?.accounts.id.prompt();
  }

  function submitEmailPassword() {
    if (!email || !password) { setMessage('Enter an email and password, or continue with Google.'); return; }
    setMessage('This workspace signs in with Google only — please use “Login with Google” above.');
  }

  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <section className="w-full max-w-sm rounded-2xl border border-border p-8">
        <h1 className="text-center text-[26px] font-bold text-ink">Login</h1>

        <button onClick={signInWithGoogle} className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-mint py-3 text-sm font-medium text-ink transition hover:bg-emerald/15">
          <GoogleIcon /> Login with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-border" />
          or sign up through email
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email ID"
            className="w-full rounded-xl bg-panel px-4 py-3 text-sm text-ink outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald/20"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Password"
            className="w-full rounded-xl bg-panel px-4 py-3 text-sm text-ink outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald/20"
          />
        </div>

        <button onClick={submitEmailPassword} className="mt-5 w-full rounded-xl bg-emerald py-3 text-sm font-semibold text-white transition hover:bg-emerald-dark">
          Login
        </button>

        {message && <p className="mt-3 text-center text-xs text-amber-700">{message}</p>}

        {previewEnabled && (
          <button className="mt-5 block w-full text-center text-xs font-semibold text-emerald underline" onClick={() => onLogin(previewUser)}>
            Open isolated UI preview
          </button>
        )}
      </section>
    </main>
  );
}
