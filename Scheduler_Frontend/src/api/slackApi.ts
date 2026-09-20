import { apiUrl, request } from './client';
import type { SlackStatus } from './types';
export const slackApi = {
  status: () => request<SlackStatus>('/slack/status'),
  disconnect: () => request<{ ok: boolean }>('/slack/disconnect', { method: 'POST' }),
  connectUrl: () => apiUrl('/slack/connect')
};
