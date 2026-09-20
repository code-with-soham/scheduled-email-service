import crypto from 'node:crypto';
import { env } from '../config/env';
import { pool } from '../db/pool';

export function slackConfigured() {
  return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.SLACK_REDIRECT_URI);
}

export function makeState(tenantId: string) {
  const payload = Buffer.from(JSON.stringify({ tenantId, exp: Date.now() + 10 * 60_000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', env.SLACK_STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseState(state: string) {
  try {
    const [payload, signature] = state.split('.');
    if (!payload || !signature) return null;
    const expected = crypto.createHmac('sha256', env.SLACK_STATE_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { tenantId: string; exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export async function buildSlackAuthorizeUrl(tenantId: string) {
  if (!slackConfigured()) throw new Error('Slack OAuth is not configured');
  const state = makeState(tenantId);
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID!,
    scope: env.SLACK_SCOPES,
    redirect_uri: env.SLACK_REDIRECT_URI!,
    state
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code: string) {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID!,
      client_secret: env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI!
    })
  });
  return await response.json() as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string; name?: string };
  };
}

export async function sendSlackRateLimitNotice(tenantId: string, senderId: string) {
  const result = await pool.query(
    `SELECT bot_token, status FROM slack_connections WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const connection = result.rows[0] as { bot_token?: string; status?: string } | undefined;
  if (!connection || connection.status !== 'CONNECTED' || !connection.bot_token) return;

  // Use the installed bot's team/general channel if available through Slack's conversations API.
  const conversations = await fetch('https://slack.com/api/conversations.list?limit=100', {
    headers: { Authorization: `Bearer ${connection.bot_token}` }
  });
  const conversationsJson = await conversations.json() as {
    ok?: boolean;
    channels?: Array<{ id: string; name: string; is_member?: boolean }>;
    error?: string;
  };
  if (!conversationsJson.ok) throw new Error(`Slack conversations.list failed: ${conversationsJson.error || 'unknown error'}`);

  const channel = conversationsJson.channels?.find((c) => c.is_member) || conversationsJson.channels?.[0];
  if (!channel) return;

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.bot_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: channel.id,
      text: `ReachInbox hourly rate limit reached for sender ${senderId}. Scheduled jobs are being deferred to the next hour.`
    })
  });
  const json = await response.json() as { ok?: boolean; error?: string };
  if (!json.ok) throw new Error(`Slack notification failed: ${json.error || 'unknown error'}`);
}
