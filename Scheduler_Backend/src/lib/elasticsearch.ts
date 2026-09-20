import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export const elastic = new Client({ node: env.ELASTICSEARCH_URL });

export async function ensureEmailIndex() {
  const exists = await elastic.indices.exists({ index: env.ELASTICSEARCH_INDEX });
  if (!exists) {
    await elastic.indices.create({
      index: env.ELASTICSEARCH_INDEX,
      mappings: {
        properties: {
          emailId: { type: 'keyword' },
          tenantId: { type: 'keyword' },
          senderId: { type: 'keyword' },
          to: { type: 'text' },
          subject: { type: 'text' },
          bodyText: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          createdAt: { type: 'date' }
        }
      }
    });
  }
}
