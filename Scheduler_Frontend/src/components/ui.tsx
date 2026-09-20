import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, TextareaHTMLAttributes } from 'react';

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' }) {
  const styles = { primary: 'bg-emerald text-white hover:bg-green-700', secondary: 'bg-mint text-emerald hover:bg-emerald hover:text-white', ghost: 'bg-transparent text-slate-600 hover:bg-slate-100', danger: 'bg-red-50 text-red-600 hover:bg-red-100', outline: 'border border-emerald text-emerald hover:bg-emerald hover:text-white' };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props} />;
}

export function IconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-ink disabled:opacity-50 ${className}`} type="button" {...props} />;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald focus:ring-4 focus:ring-emerald/10 ${className}`} {...props} />; }
export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={`w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald focus:ring-4 focus:ring-emerald/10 ${className}`} {...props} />; }

export function Badge({ status }: { status: string }) {
  const style = status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : status === 'FAILED' ? 'bg-red-50 text-red-600' : status === 'PROCESSING' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700';
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${style}`}>{status}</span>;
}

export function Avatar({ name, picture, className = '' }: { name: string; picture?: string; className?: string }) {
  return picture ? <img className={`h-9 w-9 rounded-full object-cover ${className}`} src={picture} alt="" /> : <span className={`grid h-9 w-9 place-items-center rounded-full bg-emerald text-sm font-bold text-white ${className}`}>{name.slice(0, 1).toUpperCase()}</span>;
}

export function Modal({ children, onClose, title }: PropsWithChildren<{ onClose: () => void; title: string }>) {
  return <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
    <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
      <div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald">Campaign composer</p><h2 className="mt-1 text-2xl font-bold text-ink">{title}</h2></div><Button variant="ghost" aria-label="Close" onClick={onClose}>✕</Button></div>
      {children}
    </section>
  </div>;
}

export function LoadingState({ label = 'Loading emails…' }: { label?: string }) { return <div className="grid min-h-64 place-items-center gap-3 text-sm text-slate-500"><span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald border-t-transparent" />{label}</div>; }
export function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="grid min-h-64 place-items-center px-6 text-center"><div><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-mint text-xl">✉</div><h3 className="font-bold text-ink">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{detail}</p></div></div>; }
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="grid min-h-64 place-items-center px-6 text-center"><div><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-xl">!</div><h3 className="font-bold text-ink">Couldn’t load this view</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>{onRetry && <Button className="mt-4" variant="secondary" onClick={onRetry}>Try again</Button>}</div></div>; }

export function Toast({ message, tone = 'success', onClose }: { message: string; tone?: 'success' | 'error'; onClose: () => void }) {
  return <div className={`fixed bottom-5 right-5 z-40 flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${tone === 'success' ? 'bg-ink text-white' : 'bg-red-600 text-white'}`}><span>{tone === 'success' ? '✓' : '!'}</span><span>{message}</span><button className="ml-2 opacity-70" onClick={onClose}>✕</button></div>;
}
