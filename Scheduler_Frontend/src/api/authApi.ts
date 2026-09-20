import { setAccessToken } from './client';
import type { GoogleUser } from './types';

/** The backend has no login endpoint: it verifies a Google-issued ID token per request. */
export const authApi = {
  saveGoogleSession: (user: GoogleUser) => { setAccessToken(user.idToken); sessionStorage.setItem('reachinbox_user', JSON.stringify(user)); },
  restoreGoogleSession: (): GoogleUser | null => {
    const raw = sessionStorage.getItem('reachinbox_user');
    try { return raw ? JSON.parse(raw) as GoogleUser : null; } catch { return null; }
  },
  logout: () => { setAccessToken(null); sessionStorage.removeItem('reachinbox_user'); }
};
