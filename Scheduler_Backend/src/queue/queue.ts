import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { scheduleEmailIndex } from './index-queue';
import { reserveHourly, reserveSpacing } from '../services/rate-limit';

export const EMAIL_QUEUE = 'email-send';

export const emailQueue = new Queue(EMAIL_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 }
  }
});

export const queueEvents = new QueueEvents(EMAIL_QUEUE, { connection: redis });

export async function scheduleEmailJob(emailId: string, scheduledAt: Date | string) {
  const timestamp = new Date(scheduledAt).getTime();
  return emailQueue.add(
    'send-email',
    { emailId },
    {
      jobId: emailId,
      delay: Math.max(0, timestamp - Date.now())
    }
  );
}

async function getEmail(emailId: string) {
  const result = await pool.query(
    `SELECT e.*, s.name AS sender_name, s.email AS sender_email,
            s.host AS sender_host, s.port AS sender_port,
            s.username AS sender_username, s.password AS sender_password,
            s.enabled AS sender_enabled
     FROM emails e
     JOIN senders s ON s.id = e.sender_id
     WHERE e.id = $1
     LIMIT 1`,
    [emailId]
  );
  return result.rows[0] as Record<string, any> | undefined;
}

async function claimEmail(emailId: string) {
  const result = await pool.query(
    `UPDATE emails
     SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW()
     WHERE id = $1 AND status = 'SCHEDULED'
     RETURNING *`,
    [emailId]
  );
  return result.rows[0] as Record<string, any> | undefined;
}

async function delayJob(job: Job, delayMs: number) {
  // The worker token is required by BullMQ when moving the currently active job.
  await job.moveToDelayed(Date.now() + Math.max(1000, delayMs), job.token);
}

export function startWorker() {
  return new Worker(
    EMAIL_QUEUE,
    async (job) => {
      const email = await getEmail(job.data.emailId);
      if (!email) return;
      if (['SENT', 'CANCELLED'].includes(email.status)) return;
      if (email.status === 'FAILED') throw new Error(`Email ${email.id} is permanently failed`);
      if (!email.sender_enabled) throw new Error(`Sender ${email.sender_id} is disabled`);

      const hourly = await reserveHourly(email.sender_id, email.tenant_id);
      if (!hourly.allowed) {
        await delayJob(job, hourly.delayMs);
        return;
      }

      const spacing = await reserveSpacing(email.sender_id);
      if (spacing.delayMs > 0) {
        await delayJob(job, spacing.delayMs);
        return;
      }

      const claimed = await claimEmail(email.id);
      if (!claimed) return;

      try {
        const transport = nodemailer.createTransport({
          host: email.sender_host,
          port: Number(email.sender_port),
          secure: Number(email.sender_port) === 465,
          auth: {
            user: email.sender_username,
            pass: email.sender_password
          }
        });

        const info = await transport.sendMail({
          from: `${email.sender_name} <${email.sender_email}>`,
          to: email.to_address,
          subject: email.subject,
          text: email.body_text,
          html: email.body_html || undefined,
          headers: { 'X-ReachInbox-Email-ID': email.id }
        });

        const result = await pool.query(
          `UPDATE emails
           SET status='SENT', provider_id=$1, sent_at=NOW(), error_message=NULL, updated_at=NOW()
           WHERE id=$2
           RETURNING *`,
          [info.messageId, email.id]
        );
        if (result.rows[0]) {
          void scheduleEmailIndex(email.id).catch((indexError) => {
            console.error(`Could not enqueue Elasticsearch index job for email ${email.id}:`, indexError);
          });
        }
        return info.messageId;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attempts = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade + 1 >= attempts;
        const result = await pool.query(
          `UPDATE emails SET status=$1, error_message=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
          [isFinalAttempt ? 'FAILED' : 'SCHEDULED', message, email.id]
        );
        if (result.rows[0]) {
          void scheduleEmailIndex(email.id).catch((indexError) => {
            console.error(`Could not enqueue Elasticsearch index job for email ${email.id}:`, indexError);
          });
        }
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: env.WORKER_CONCURRENCY,
      autorun: true
    }
  );
}
