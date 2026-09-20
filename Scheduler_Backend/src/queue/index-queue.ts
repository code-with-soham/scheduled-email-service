import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { ensureEmailIndex } from '../lib/elasticsearch';
import { indexEmail } from '../services/email-indexer';

const INDEX_QUEUE = 'email-index';

export const emailIndexQueue = new Queue(INDEX_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 100,
    backoff: { type: 'fixed', delay: 30_000 },
    removeOnComplete: { count: 1_000 },
    removeOnFail: { count: 5_000 }
  }
});

/** Indexing is durable but never part of the API or SMTP-send critical path. */
export async function scheduleEmailIndex(emailId: string) {
  return emailIndexQueue.add('index-email', { emailId });
}

export function startIndexWorker() {
  return new Worker(
    INDEX_QUEUE,
    async (job) => {
      await ensureEmailIndex();
      const result = await pool.query('SELECT * FROM emails WHERE id=$1 LIMIT 1', [job.data.emailId]);
      if (!result.rows[0]) return;
      await indexEmail(result.rows[0]);
    },
    { connection: redis, concurrency: Math.max(1, Math.min(5, env.WORKER_CONCURRENCY)) }
  );
}
