// Webhook handler: auth → size cap → schema → filters → dedupe → rate limit → Telegram (spec §8).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { clientIp, safeEqual, TRADINGVIEW_IPS, verifyHmac } from './auth.ts';
import type { Config } from './config.ts';
import { SlidingWindowLimiter, TtlSet } from './dedupe.ts';
import { buildMessage } from './format.ts';
import type { Logger } from './log.ts';
import { destinationsFor } from './route.ts';
import { idempotencyKey, parseAlert, structureId, type SeamAlert } from './schema.ts';
import type { Sender } from './telegram.ts';

export interface Deps {
  config: Config;
  sender: Sender;
  logger: Logger;
  now?: () => number;
}

export type Outcome =
  | { action: 'queued'; destinations: number }
  | { action: 'dropped'; reason: 'preview' | 'reference' | 'event' | 'ticker' | 'duplicate' | 'rate_limited' };

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data), 'cache-control': 'no-store' });
  res.end(data);
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new HttpError(413, 'body too large'));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        req.off('data', onData);
        req.resume(); // drain and discard the rest
        reject(new HttpError(413, 'body too large'));
        return;
      }
      chunks.push(c);
    };
    req.on('data', onData);
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createHandler(deps: Deps) {
  const { config: cfg, sender, logger } = deps;
  const now = deps.now ?? Date.now;
  const seen = new TtlSet(cfg.dedupeTtlMs);
  const limiter = new SlidingWindowLimiter(cfg.ratePerMin, 60_000);

  // Filters that do not need state, in the order the spec lists them.
  function filter(a: SeamAlert): Outcome | null {
    if (a.preview && !cfg.allowPreview) return { action: 'dropped', reason: 'preview' };
    if (a.grade !== 'formal' && !cfg.allowReference) return { action: 'dropped', reason: 'reference' };
    if (!cfg.events.has(a.event)) return { action: 'dropped', reason: 'event' };
    if (cfg.tickerAllowlist && !cfg.tickerAllowlist.has(a.ticker)) return { action: 'dropped', reason: 'ticker' };
    return null;
  }

  function accept(a: SeamAlert): Outcome {
    const dropped = filter(a);
    if (dropped) return dropped;
    const key = idempotencyKey(a);
    const t = now();
    if (seen.has(key, t)) return { action: 'dropped', reason: 'duplicate' };
    if (!limiter.allow(a.ticker, t)) return { action: 'dropped', reason: 'rate_limited' };
    seen.claim(key, t);

    const text = buildMessage(a);
    const dests = destinationsFor(a, cfg.route);
    for (const d of dests) {
      sender(d, text)
        .then((r) => {
          const fields = { id: structureId(a), event: a.event, dest: d.label, status: r.status };
          if (r.ok) logger.info('sent', fields);
          else logger.error('send failed', { ...fields, description: r.description });
        })
        .catch((e: unknown) => logger.error('send crashed', { id: structureId(a), error: String(e) }));
    }
    return { action: 'queued', destinations: dests.length };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = (req.url ?? '/').split('?')[0] ?? '/';

    if (req.method === 'GET' && path === '/healthz') return send(res, 200, { ok: true });
    if (!path.startsWith('/hook')) return send(res, 404, { ok: false, error: 'not found' });
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' });

    const ip = clientIp(req, cfg.trustProxy);
    if (cfg.tvIpOnly && !TRADINGVIEW_IPS.includes(ip)) {
      logger.warn('rejected ip', { ip });
      return send(res, 403, { ok: false, error: 'forbidden' });
    }

    // Path token: /hook/<token>. Checked before reading the body.
    const tokenPart = path.startsWith('/hook/') ? decodeURIComponent(path.slice('/hook/'.length)) : '';
    const tokenOk = !!cfg.webhookToken && tokenPart !== '' && safeEqual(tokenPart, cfg.webhookToken);
    if (!tokenOk && !cfg.hmacSecret) {
      logger.warn('rejected auth', { ip });
      return send(res, 401, { ok: false, error: 'unauthorized' });
    }

    const body = await readBody(req, cfg.maxBodyBytes);
    if (!tokenOk) {
      const sig = req.headers['x-seam-signature'];
      if (!verifyHmac(body, Array.isArray(sig) ? sig[0] : sig, cfg.hmacSecret ?? '')) {
        logger.warn('rejected auth', { ip });
        return send(res, 401, { ok: false, error: 'unauthorized' });
      }
    }

    const parsed = parseAlert(body.toString('utf8'));
    if (!parsed.ok) {
      logger.warn('invalid payload', { ip, errors: parsed.errors });
      return send(res, 400, { ok: false, errors: parsed.errors });
    }

    const outcome = accept(parsed.alert);
    if (outcome.action === 'dropped') logger.info('dropped', { id: structureId(parsed.alert), event: parsed.alert.event, reason: outcome.reason });
    // 200/202 either way: a dropped event is a correct outcome, not a delivery failure.
    return send(res, outcome.action === 'queued' ? 202 : 200, { ok: true, ...outcome });
  }

  return (req: IncomingMessage, res: ServerResponse): void => {
    handle(req, res).catch((e: unknown) => {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) logger.error('handler error', { error: String(e) });
      if (!res.headersSent) send(res, status, { ok: false, error: e instanceof HttpError ? e.message : 'internal error' });
    });
  };
}
