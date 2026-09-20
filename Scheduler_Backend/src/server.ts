import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { router } from './routes';
import { bullBoardAuth, tenantMiddleware } from './middleware/tenant';
import { ensureEmailIndex } from './lib/elasticsearch';
import { startWorker, emailQueue, queueEvents } from './queue/queue';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { pool } from './db/pool';
import { emailIndexQueue, startIndexWorker } from './queue/index-queue';
import { slackCallback } from './controllers/slack';

async function main() {
  await pool.query('SELECT 1');
  try {
    await ensureEmailIndex();
  } catch (error) {
    console.error('Elasticsearch unavailable at startup; API and email delivery will continue. Index jobs will retry.', error);
  }

  const worker = startWorker();
  const indexWorker = startIndexWorker();
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  // Slack redirects cannot carry our Authorization header; their signed state is verified by the callback.
  app.get('/api/slack/oauth/callback', slackCallback);
  app.use('/api', tenantMiddleware, router);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(env.BULL_BOARD_PATH);
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter
  });
  app.use(env.BULL_BOARD_PATH, bullBoardAuth, serverAdapter.getRouter());

  app.get('/', (_req, res) => res.json({
    service: 'ReachInbox Email Scheduler',
    health: '/api/health',
    queueDashboard: env.BULL_BOARD_PATH
  }));

  // Global error handler: catch unhandled exceptions from async route handlers.
  // Express 5 automatically forwards rejected promises here.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const code = (err as { code?: string }).code;
    // Log the full error server-side, but only return a safe message to the client.
    console.error('Unhandled route error:', err);
    // Map known infrastructure errors to appropriate status codes.
    if (code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'A required service is unavailable. Please try again later.' });
    }
    res.status(500).json({ error: message });
  });

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
    console.log(`Bull Board: http://localhost:${env.PORT}${env.BULL_BOARD_PATH}`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    await worker.close();
    await indexWorker.close();
    await queueEvents.close();
    await emailQueue.close();
    await emailIndexQueue.close();
    await pool.end();
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
