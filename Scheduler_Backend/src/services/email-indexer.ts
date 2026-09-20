import { elastic } from '../lib/elasticsearch';
import { env } from '../config/env';

export type EmailRecord = {
  id: string;
  tenant_id: string;
  sender_id: string;
  to_address: string;
  subject: string;
  body_text: string;
  status: string;
  scheduled_at: Date | string;
  sent_at: Date | string | null;
  created_at: Date | string;
};

export async function indexEmail(e: EmailRecord) {
  await elastic.index({
    index: env.ELASTICSEARCH_INDEX,
    id: e.id,
    document: {
      emailId: e.id,
      tenantId: e.tenant_id,
      senderId: e.sender_id,
      to: e.to_address,
      subject: e.subject,
      bodyText: e.body_text,
      status: e.status,
      scheduledAt: e.scheduled_at,
      sentAt: e.sent_at,
      createdAt: e.created_at
    },
    refresh: false
  });
}
