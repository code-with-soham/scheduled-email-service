import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool';
import { buildSlackAuthorizeUrl, exchangeSlackCode, parseState } from '../services/slack';

export async function connectSlack(req: Request, res: Response) {
  try {
    res.redirect(await buildSlackAuthorizeUrl(req.tenantId!));
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function slackCallback(req: Request, res: Response) {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const data = parseState(state);
  if (!code || !data) return res.status(400).send('Invalid Slack OAuth state');

  const token = await exchangeSlackCode(code);
  if (!token.ok || !token.access_token) {
    return res.status(400).send(`Slack OAuth failed: ${token.error || 'unknown error'}`);
  }

  await pool.query(
    `INSERT INTO slack_connections (id, tenant_id, bot_token, team_id, team_name, status)
     VALUES ($1, $2, $3, $4, $5, 'CONNECTED')
     ON CONFLICT (tenant_id) DO UPDATE SET
       bot_token=EXCLUDED.bot_token,
       team_id=EXCLUDED.team_id,
       team_name=EXCLUDED.team_name,
       status='CONNECTED',
       updated_at=NOW()`,
    [randomUUID(), data.tenantId, token.access_token, token.team?.id ?? null, token.team?.name ?? null]
  );

  res.send('<h2>Slack connected</h2><p>You can close this window and return to the dashboard.</p>');
}

export async function disconnectSlack(req: Request, res: Response) {
  await pool.query(
    `UPDATE slack_connections SET status='DISCONNECTED', updated_at=NOW() WHERE tenant_id=$1`,
    [req.tenantId!]
  );
  res.json({ ok: true });
}

export async function slackStatus(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT status, team_name FROM slack_connections WHERE tenant_id=$1 LIMIT 1`,
    [req.tenantId!]
  );
  const row = result.rows[0];
  res.json({ connected: row?.status === 'CONNECTED', teamName: row?.team_name || null });
}
