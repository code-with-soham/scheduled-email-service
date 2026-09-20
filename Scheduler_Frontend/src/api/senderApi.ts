import { request } from './client';
import type { Sender } from './types';
export const senderApi = { list: () => request<Sender[]>('/senders') };
