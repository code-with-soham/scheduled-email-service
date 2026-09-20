import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const googleClient = new OAuth2Client();

function bearerToken(req: Request) {
  const authorization = req.header('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined;
}

/** Tenant identity comes only from an audience-checked Google-issued ID token. */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google authentication is not configured' });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Bearer token required' });

  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ error: 'Verified Google email required' });
    }

    req.tenantId = `google:${payload.sub}`;
    req.user = { googleSubject: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired Google ID token' });
  }
}

/** Bull Board is a server-admin surface and is never public. */
export function bullBoardAuth(req: Request, res: Response, next: NextFunction) {
  if (!env.BULL_BOARD_USERNAME || !env.BULL_BOARD_PASSWORD) {
    return res.status(503).json({ error: 'Bull Board authentication is not configured' });
  }

  const authorization = req.header('authorization');
  const expected = `Basic ${Buffer.from(`${env.BULL_BOARD_USERNAME}:${env.BULL_BOARD_PASSWORD}`).toString('base64')}`;
  const matches = authorization && authorization.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
  if (!matches) {
    res.setHeader('WWW-Authenticate', 'Basic realm="ReachInbox queue dashboard"');
    return res.status(401).send('Authentication required');
  }
  next();
}
