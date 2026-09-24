import type { Config } from '../src/config.ts';
import { loadConfig } from '../src/config.ts';
import type { Logger } from '../src/log.ts';

export const TOKEN = 'test-webhook-token-0123456789abcdef';
export const BOT = '123456789:AAHtestTokenValue_abcdefghijklmnopqrstu';

// Shape the Pine script emits (seam/pine/SEAM_Patterns.pine f_json)
export function sample(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    src: 'seam',
    event: 'break_up',
    ticker: 'NASDAQ:AAPL',
    tf: '60',
    key: 'TRI_SYM',
    grade: 'formal',
    phase: 'break_up',
    lock_ts: 1750000000,
    bar_ts: 1750036000,
    upper: 221.4,
    lower: 214.1,
    upper_now: 220.9,
    lower_now: 215.3,
    close: 222,
    adhesion: 0.74,
    touches: [3, 3],
    bias: 'either',
    reason: null,
    preview: false,
    ...over,
  };
}

export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({
    SEAM_WEBHOOK_TOKEN: TOKEN,
    TELEGRAM_BOT_TOKEN: BOT,
    TELEGRAM_CHAT_ID: '-1001234567890',
    ...env,
  });
}

export function memoryLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  const push = (level: string) => (msg: string, f?: Record<string, unknown>) => {
    lines.push(JSON.stringify({ level, msg, ...f }));
  };
  return { lines, info: push('info'), warn: push('warn'), error: push('error') };
}
