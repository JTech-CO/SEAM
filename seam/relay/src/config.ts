// Environment → validated config. Secrets live only in env (spec §8.2): never in Pine, never in logs.
import { EVENTS, type SeamEvent } from './schema.ts';
import { mergePrefixes, type Market, type RouteConfig } from './route.ts';

export interface Config {
  host: string;
  port: number;
  webhookToken?: string;       // path secret: POST /hook/<token>
  hmacSecret?: string;         // optional: POST /hook with X-Seam-Signature
  botToken: string;
  apiBase: string;
  route: RouteConfig;
  events: Set<SeamEvent>;
  allowReference: boolean;
  allowPreview: boolean;
  tickerAllowlist?: Set<string>;
  ratePerMin: number;
  dedupeTtlMs: number;
  maxBodyBytes: number;
  tvIpOnly: boolean;
  trustProxy: boolean;
  dryRun: boolean;
}

export const DEFAULT_EVENTS: SeamEvent[] = ['lock', 'break_up', 'break_down', 'fail'];

type Env = Record<string, string | undefined>;

// Reads env values; invalid values are collected into `errors` and replaced by the default.
function reader(env: Env, errors: string[]) {
  const str = (k: string): string | undefined => {
    const v = env[k]?.trim();
    return v ? v : undefined;
  };
  return {
    str,
    bool(k: string, def: boolean): boolean {
      const v = str(k)?.toLowerCase();
      if (v === undefined) return def;
      if (['1', 'true', 'yes', 'on'].includes(v)) return true;
      if (['0', 'false', 'no', 'off'].includes(v)) return false;
      errors.push(`${k} must be true/false`);
      return def;
    },
    int(k: string, def: number, min: number, max: number): number {
      const v = str(k);
      if (v === undefined) return def;
      const n = Number(v);
      if (Number.isInteger(n) && n >= min && n <= max) return n;
      errors.push(`${k} must be an integer in [${min}, ${max}]`);
      return def;
    },
    topic(k: string): number | undefined {
      const v = str(k);
      if (v === undefined) return undefined;
      const n = Number(v);
      if (Number.isInteger(n) && n > 0) return n;
      errors.push(`${k} must be a positive integer (message_thread_id)`);
      return undefined;
    },
  };
}

export function loadConfig(env: Env = process.env): Config {
  const errors: string[] = [];
  const r = reader(env, errors);
  const dryRun = r.bool('SEAM_DRY_RUN', false);

  const webhookToken = r.str('SEAM_WEBHOOK_TOKEN');
  const hmacSecret = r.str('SEAM_HMAC_SECRET');
  if (!webhookToken && !hmacSecret) errors.push('SEAM_WEBHOOK_TOKEN (or SEAM_HMAC_SECRET) is required');
  if (webhookToken && !/^[A-Za-z0-9_-]{24,128}$/.test(webhookToken)) errors.push('SEAM_WEBHOOK_TOKEN must be 24-128 chars of [A-Za-z0-9_-]');
  if (hmacSecret && hmacSecret.length < 32) errors.push('SEAM_HMAC_SECRET must be at least 32 chars');

  const botToken = r.str('TELEGRAM_BOT_TOKEN') ?? '';
  if (!dryRun && !/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(botToken)) errors.push('TELEGRAM_BOT_TOKEN missing or malformed');
  const chatId = r.str('TELEGRAM_CHAT_ID') ?? '';
  if (!/^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(chatId)) errors.push('TELEGRAM_CHAT_ID missing or malformed');

  let events = new Set<SeamEvent>(DEFAULT_EVENTS);
  const ev = r.str('SEAM_EVENTS');
  if (ev) {
    const list = ev.split(',').map((s) => s.trim()).filter(Boolean);
    const isEvent = (e: string): e is SeamEvent => (EVENTS as readonly string[]).includes(e);
    const bad = list.filter((e) => !isEvent(e));
    if (bad.length) errors.push(`SEAM_EVENTS has unknown events: ${bad.join(',')}`);
    events = new Set(list.filter(isEvent));
  }

  const topics: Partial<Record<Market, number>> = {};
  for (const m of ['KR', 'US', 'CRYPTO', 'OTHER'] as const) {
    const t = r.topic(`TELEGRAM_TOPIC_${m}`);
    if (t !== undefined) topics[m] = t;
  }
  const confirmedTopic = r.topic('TELEGRAM_TOPIC_CONFIRMED');
  const allow = r.str('SEAM_TICKER_ALLOWLIST');

  const cfg: Config = {
    host: r.str('HOST') ?? '0.0.0.0',
    port: r.int('PORT', 8787, 1, 65535),
    botToken,
    apiBase: (r.str('TELEGRAM_API_BASE') ?? 'https://api.telegram.org').replace(/\/+$/, ''),
    route: { chatId, topics, prefixes: mergePrefixes(r.str('SEAM_MARKET_PREFIXES')) },
    events,
    allowReference: r.bool('SEAM_ALLOW_REFERENCE', false),
    allowPreview: r.bool('SEAM_ALLOW_PREVIEW', false),
    ratePerMin: r.int('SEAM_RATE_PER_MIN', 3, 1, 60),
    dedupeTtlMs: r.int('SEAM_DEDUPE_TTL_HOURS', 72, 1, 24 * 30) * 3600_000,
    maxBodyBytes: r.int('SEAM_MAX_BODY_BYTES', 4096, 512, 65536),
    tvIpOnly: r.bool('SEAM_TV_IP_ONLY', false),
    trustProxy: r.bool('SEAM_TRUST_PROXY', false),
    dryRun,
  };
  if (errors.length) throw new Error(`config invalid:\n - ${errors.join('\n - ')}`);

  if (confirmedTopic !== undefined) cfg.route.confirmedTopic = confirmedTopic;
  if (webhookToken) cfg.webhookToken = webhookToken;
  if (hmacSecret) cfg.hmacSecret = hmacSecret;
  if (allow) cfg.tickerAllowlist = new Set(allow.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  return cfg;
}

export function secretsOf(cfg: Config): string[] {
  return [cfg.botToken, cfg.webhookToken ?? '', cfg.hmacSecret ?? ''].filter(Boolean);
}

// Startup summary without secrets.
export function describe(cfg: Config): Record<string, unknown> {
  return {
    listen: `${cfg.host}:${cfg.port}`,
    auth: [cfg.webhookToken ? 'path-token' : null, cfg.hmacSecret ? 'hmac' : null].filter(Boolean),
    chat: cfg.route.chatId,
    topics: cfg.route.topics,
    confirmedTopic: cfg.route.confirmedTopic ?? null,
    events: [...cfg.events],
    allowReference: cfg.allowReference,
    allowPreview: cfg.allowPreview,
    tickerAllowlist: cfg.tickerAllowlist ? cfg.tickerAllowlist.size : null,
    ratePerMin: cfg.ratePerMin,
    tvIpOnly: cfg.tvIpOnly,
    trustProxy: cfg.trustProxy,
    dryRun: cfg.dryRun,
  };
}
