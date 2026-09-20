import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool';
import { scheduleEmailJob } from '../queue/queue';
import { elastic } from '../lib/elasticsearch';
import { env } from '../config/env';
import { scheduleEmailIndex } from '../queue/index-queue';

const createSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
  senderId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  bodyText: z.string().min(1),
  bodyHtml: z.string().optional(),
  scheduledAt: z.coerce.date()
});

function mapEmail(row: Record<string, any>) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    idempotencyKey: row.idempotency_key,
    senderId: row.sender_id,
    to: row.to_address,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    scheduledAt: row.scheduled_at,
    status: row.status,
    attempts: row.attempts,
    providerId: row.provider_id,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sender: row.sender_id ? {
      id: row.sender_id,
      name: row.sender_name,
      email: row.sender_email
    } : undefined
  };
}

export async function listSenders(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT s.id, s.name, s.email FROM senders s
     JOIN sender_tenants st ON st.sender_id=s.id
     WHERE s.enabled=TRUE AND st.tenant_id=$1 ORDER BY s.created_at ASC`,
    [req.tenantId!]
  );
  res.json(result.rows);
}

export async function createEmail(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const tenantId = req.tenantId!;
  const data = parsed.data;
  if (data.scheduledAt.getTime() < Date.now() - 1000) {
    return res.status(400).json({ error: 'scheduledAt must be in the future' });
  }

  const senderResult = await pool.query(
    `SELECT s.id, s.name, s.email FROM senders s
     JOIN sender_tenants st ON st.sender_id=s.id
     WHERE s.id=$1 AND s.enabled=TRUE AND st.tenant_id=$2 LIMIT 1`,
    [data.senderId, tenantId]
  );
  if (!senderResult.rows[0]) return res.status(404).json({ error: 'Sender not found or disabled' });

  const existing = await pool.query(
    `SELECT e.*, s.name AS sender_name, s.email AS sender_email
     FROM emails e JOIN senders s ON s.id=e.sender_id
     WHERE e.tenant_id=$1 AND e.idempotency_key=$2 LIMIT 1`,
    [tenantId, data.idempotencyKey]
  );
  if (existing.rows[0]) return res.status(200).json(mapEmail(existing.rows[0]));

  const id = randomUUID();
  const insert = await pool.query(
    `INSERT INTO emails
      (id, tenant_id, idempotency_key, sender_id, to_address, subject, body_text, body_html, scheduled_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SCHEDULED')
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
     RETURNING *`,
    [id, tenantId, data.idempotencyKey, data.senderId, data.to, data.subject, data.bodyText, data.bodyHtml ?? null, data.scheduledAt]
  );

  let email = insert.rows[0];
  let created = true;
  if (!email) {
    const race = await pool.query(
      `SELECT e.*, s.name AS sender_name, s.email AS sender_email
       FROM emails e JOIN senders s ON s.id=e.sender_id
       WHERE e.tenant_id=$1 AND e.idempotency_key=$2 LIMIT 1`,
      [tenantId, data.idempotencyKey]
    );
    email = race.rows[0];
    created = false;
  }

  if (!email) return res.status(500).json({ error: 'Could not create email' });

  if (created) {
    await scheduleEmailJob(email.id, email.scheduled_at);
    void scheduleEmailIndex(email.id).catch((error) => {
      console.error(`Could not enqueue Elasticsearch index job for email ${email.id}:`, error);
    });
  }

  return res.status(created ? 201 : 200).json(mapEmail(email));
}

export async function listEmails(req: Request, res: Response) {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const values: unknown[] = [req.tenantId!];
  let statusClause = '';
  if (status) {
    values.push(status);
    statusClause = ` AND e.status=$${values.length}`;
  }

  const result = await pool.query(
    `SELECT e.*, s.name AS sender_name, s.email AS sender_email
     FROM emails e JOIN senders s ON s.id=e.sender_id
     WHERE e.tenant_id=$1${statusClause}
     ORDER BY e.scheduled_at ASC
     LIMIT 200`,
    values
  );
  res.json(result.rows.map(mapEmail));
}

export async function searchEmails(req: Request, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'q required' });

  const result = await elastic.search({
    index: env.ELASTICSEARCH_INDEX,
    query: {
      bool: {
        must: { multi_match: { query: q, fields: ['subject^3', 'to^2', 'bodyText'] } },
        filter: [{ term: { tenantId: req.tenantId! } }]
      }
    },
    size: 100
  });

  res.json((result.hits.hits || []).map((hit: any) => hit._source));
}
