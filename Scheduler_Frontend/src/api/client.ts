const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

let accessToken: string | null = sessionStorage.getItem('reachinbox_google_id_token');

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem('reachinbox_google_id_token', token);
  else sessionStorage.removeItem('reachinbox_google_id_token');
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const contentType = response.headers.get('content-type') || '';
  const body: unknown = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function apiUrl(path: string) { return `${API_BASE_URL}${path}`; }
