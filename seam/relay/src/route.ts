// Topic routing by exchange prefix (spec §8.2): KR / US / CRYPTO topics + optional confirmed-only topic.
import type { SeamAlert } from './schema.ts';

export type Market = 'KR' | 'US' | 'CRYPTO' | 'OTHER';

export const DEFAULT_PREFIXES: Record<Exclude<Market, 'OTHER'>, string[]> = {
  KR: ['KRX', 'KOSDAQ', 'KOSPI', 'NXT'],
  US: [
    'NASDAQ', 'NYSE', 'AMEX', 'NYSEARCA', 'ARCA', 'BATS', 'CBOE', 'OTC', 'IEX',
    'CME', 'CME_MINI', 'CBOT', 'CBOT_MINI', 'COMEX', 'NYMEX',
  ],
  CRYPTO: [
    'BINANCE', 'BINANCEUS', 'BYBIT', 'OKX', 'COINBASE', 'KRAKEN', 'BITSTAMP', 'BITFINEX',
    'UPBIT', 'BITHUMB', 'KORBIT', 'COINONE', 'BITGET', 'KUCOIN', 'GATEIO', 'MEXC', 'HTX',
    'HUOBI', 'GEMINI', 'POLONIEX', 'DERIBIT', 'BITMEX', 'PHEMEX', 'COINEX', 'WHITEBIT',
    'BINGX', 'BITVAVO', 'CRYPTOCOM', 'CRYPTO', 'CRYPTOCAP',
  ],
};

export interface Destination {
  chatId: string;
  threadId?: number;
  label: string;
}

export interface RouteConfig {
  chatId: string;
  topics: Partial<Record<Market, number>>;
  confirmedTopic?: number;
  prefixes: Record<Exclude<Market, 'OTHER'>, string[]>;
}

export function marketOf(ticker: string, prefixes: RouteConfig['prefixes']): Market {
  const prefix = ticker.split(':')[0]?.toUpperCase() ?? '';
  for (const m of ['KR', 'US', 'CRYPTO'] as const) {
    if (prefixes[m].includes(prefix)) return m;
  }
  return 'OTHER';
}

// "KR=NXT,KOSPI200;CRYPTO=LBANK" → merged into the defaults (additive only).
export function mergePrefixes(extra: string | undefined): RouteConfig['prefixes'] {
  const out = {
    KR: [...DEFAULT_PREFIXES.KR],
    US: [...DEFAULT_PREFIXES.US],
    CRYPTO: [...DEFAULT_PREFIXES.CRYPTO],
  };
  if (!extra) return out;
  for (const part of extra.split(';')) {
    const [m, list] = part.split('=');
    const market = m?.trim().toUpperCase();
    if (market !== 'KR' && market !== 'US' && market !== 'CRYPTO') continue;
    for (const p of (list ?? '').split(',')) {
      const v = p.trim().toUpperCase();
      if (/^[A-Z0-9_]{1,24}$/.test(v) && !out[market].includes(v)) out[market].push(v);
    }
  }
  return out;
}

export function destinationsFor(a: SeamAlert, cfg: RouteConfig): Destination[] {
  const market = marketOf(a.ticker, cfg.prefixes);
  const main: Destination = { chatId: cfg.chatId, label: market };
  const topic = cfg.topics[market];
  if (topic !== undefined) main.threadId = topic;
  const out = [main];
  const confirmed = a.event === 'break_up' || a.event === 'break_down';
  if (confirmed && cfg.confirmedTopic !== undefined && cfg.confirmedTopic !== main.threadId) {
    out.push({ chatId: cfg.chatId, threadId: cfg.confirmedTopic, label: 'CONFIRMED' });
  }
  return out;
}
