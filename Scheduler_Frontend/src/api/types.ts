export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Sender { id: string; name: string; email: string }

/** Exact response shape produced by the backend's mapEmail helper. */
export interface EmailRecord {
  id: string; tenantId: string; idempotencyKey: string; senderId: string; to: string;
  subject: string; bodyText: string; bodyHtml: string | null; scheduledAt: string;
  status: EmailStatus; attempts: number; providerId: string | null; errorMessage: string | null;
  sentAt: string | null; createdAt: string; updatedAt: string;
  sender?: Sender;
}

/** Exact POST /api/emails request body. Delay and hourly limit are not backend fields. */
export interface CreateEmailRequest {
  idempotencyKey: string; senderId: string; to: string; subject: string;
  bodyText: string; bodyHtml?: string; scheduledAt: string;
}

export interface SlackStatus { connected: boolean; teamName: string | null }
export interface ApiErrorBody { error?: string }

export interface GoogleUser { name: string; email: string; picture?: string; idToken: string }
