import { redis } from '../lib/redis';
import { env } from '../config/env';
import { sendSlackRateLimitNotice } from './slack';

const reserveHourlyScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
if count <= tonumber(ARGV[2]) then return 1 else return 0 end
`;

const reserveSpacingScript = `
local last = redis.call('GET', KEYS[1])
local now = tonumber(ARGV[1])
local gap = tonumber(ARGV[2])
local slot = now
if last then slot = math.max(now, tonumber(last) + gap) end
redis.call('SET', KEYS[1], slot)
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return slot
`;

export async function reserveHourly(senderId: string, tenantId: string) {
  const window = Math.floor(Date.now() / 1000 / env.RATE_LIMIT_WINDOW_SECONDS);
  const key = `rate:${senderId}:${window}`;
  const count = Number(await redis.eval(
    reserveHourlyScript,
    1,
    key,
    env.RATE_LIMIT_WINDOW_SECONDS,
    env.MAX_EMAILS_PER_HOUR
  ));

  if (count === 1) return { allowed: true, delayMs: 0 };

  const nextWindow = (window + 1) * env.RATE_LIMIT_WINDOW_SECONDS * 1000;
  const notifyKey = `rate-notified:${senderId}:${window}`;
  const firstNotifier = await redis.set(
    notifyKey,
    '1',
    'EX',
    env.RATE_LIMIT_WINDOW_SECONDS,
    'NX'
  );

  if (firstNotifier === 'OK') {
    try {
      await sendSlackRateLimitNotice(tenantId, senderId);
    } catch (error) {
      console.error('Slack rate-limit notification failed:', error);
    }
  }

  return { allowed: false, delayMs: Math.max(1000, nextWindow - Date.now()) };
}

export async function reserveSpacing(senderId: string) {
  const now = Date.now();
  const slot = Number(await redis.eval(
    reserveSpacingScript,
    1,
    `spacing:${senderId}`,
    now,
    env.MIN_DELAY_MS,
    env.MIN_DELAY_MS + env.RATE_LIMIT_WINDOW_SECONDS * 1000
  ));
  return { slot, delayMs: Math.max(0, slot - now) };
}
