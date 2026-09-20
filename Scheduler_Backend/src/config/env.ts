import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('emails'),
  BULL_BOARD_PATH: z.string().default('/admin/queues'),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  BULL_BOARD_USERNAME: z.string().min(1).optional(),
  BULL_BOARD_PASSWORD: z.string().min(16).optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  ETHEREAL_SENDERS: z.string().min(1),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().optional(),
  SLACK_SCOPES: z.string().default('chat:write,channels:read,groups:read'),
  SLACK_STATE_SECRET: z.string().min(16).default('change-me-in-production')
});

export const env = schema.parse(process.env);

export type SenderConfig = {
  id: string;
  name: string;
  email: string;
  host: string;
  port: number;
  user: string;
  pass: string;
};

export const senderConfigs: SenderConfig[] = JSON.parse(env.ETHEREAL_SENDERS);

export type SenderTenantAssignment = { senderId: string; tenantId: string };

// Provisioned by an operator, never supplied by an API caller.
export const senderTenantAssignments: SenderTenantAssignment[] = JSON.parse(
  process.env.SENDER_TENANT_ASSIGNMENTS || '[]'
);
