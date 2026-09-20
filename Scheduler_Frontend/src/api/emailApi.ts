import { request } from './client';
import type { CreateEmailRequest, EmailRecord } from './types';

export const emailApi = {
  list: (status?: string) => request<EmailRecord[]>(`/emails${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  create: (payload: CreateEmailRequest) => request<EmailRecord>('/emails', { method: 'POST', body: JSON.stringify(payload) }),
  search: (query: string) => request<EmailRecord[]>(`/emails/search?q=${encodeURIComponent(query)}`)
};
