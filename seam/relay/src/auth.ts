// Webhook authentication (spec §8.3).
// TradingView cannot send custom headers, so the primary secret travels in the URL path
// (/hook/<SEAM_WEBHOOK_TOKEN>) over HTTPS. An HMAC header is accepted for non-TradingView senders.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

// TradingView webhook source addresses (TradingView docs). Secondary check only.
export const TRADINGVIEW_IPS = ['52.89.214.238', '34.212.75.30', '54.218.53.128', '52.32.178.7'];

// Constant-time compare that does not leak length: compares SHA-256 digests.
export function safeEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  return timingSafeEqual(da, db);
}

// Header format: "sha256=<hex>" over the raw request body.
export function verifyHmac(body: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m || !m[1]) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return safeEqual(m[1].toLowerCase(), expected);
}

export function signBody(body: string | Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

// With trustProxy, use the address appended by our own reverse proxy (the LAST X-Forwarded-For entry).
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff.join(',') : xff;
    const last = raw?.split(',').map((s) => s.trim()).filter(Boolean).pop();
    if (last) return normalizeIp(last);
  }
  return normalizeIp(req.socket.remoteAddress ?? '');
}

function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
