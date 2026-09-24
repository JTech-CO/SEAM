// Telegram Bot API sender: sendMessage with per-chat pacing and bounded retries.
// The bot token is only ever placed in the request URL and is masked by the logger.
import type { Destination } from './route.ts';
import type { Logger } from './log.ts';

export interface SendResult {
  ok: boolean;
  status: number;
  description?: string;
}

export type Sender = (dest: Destination, text: string) => Promise<SendResult>;

export interface TelegramOptions {
  token: string;
  apiBase?: string;
  logger: Logger;
  fetchImpl?: typeof fetch;
  minGapMs?: number;      // pacing per chat (Telegram: ~1 msg/s per chat, 20/min per group)
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createTelegramSender(opts: TelegramOptions): Sender {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? delay;
  const minGap = opts.minGapMs ?? 1100;
  const maxAttempts = opts.maxAttempts ?? 4;
  const url = `${opts.apiBase ?? 'https://api.telegram.org'}/bot${opts.token}/sendMessage`;
  const lanes = new Map<string, Promise<unknown>>(); // chatId → tail of its send chain

  async function attempt(dest: Destination, text: string): Promise<SendResult & { retryAfterMs?: number }> {
    const body: Record<string, unknown> = {
      chat_id: dest.chatId,
      text,
      link_preview_options: { is_disabled: true },
    };
    if (dest.threadId !== undefined) body.message_thread_id = dest.threadId;
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; parameters?: { retry_after?: number } };
      const out: SendResult & { retryAfterMs?: number } = { ok: res.ok && data.ok === true, status: res.status };
      if (data.description) out.description = data.description;
      if (res.status === 429) out.retryAfterMs = Math.min(60, data.parameters?.retry_after ?? 1) * 1000;
      return out;
    } catch (e) {
      return { ok: false, status: 0, description: (e as Error).name };
    }
  }

  async function sendNow(dest: Destination, text: string): Promise<SendResult> {
    let last: SendResult = { ok: false, status: 0 };
    for (let i = 1; i <= maxAttempts; i++) {
      const r = await attempt(dest, text);
      if (r.ok) return r;
      last = r;
      const retryable = r.status === 429 || r.status === 0 || r.status >= 500;
      if (!retryable || i === maxAttempts) break;
      const wait = r.retryAfterMs ?? 1000 * 2 ** (i - 1);
      opts.logger.warn('telegram retry', { status: r.status, attempt: i, waitMs: wait, dest: dest.label });
      await sleep(wait);
    }
    return last;
  }

  return (dest, text) => {
    const prev = lanes.get(dest.chatId) ?? Promise.resolve();
    const run = prev.then(() => sendNow(dest, text));
    const tail = run.then(() => sleep(minGap)).catch(() => undefined);
    lanes.set(dest.chatId, tail);
    tail.then(() => {
      if (lanes.get(dest.chatId) === tail) lanes.delete(dest.chatId);
    });
    return run;
  };
}

// SEAM_DRY_RUN=true: log the message instead of calling Telegram.
export function createDryRunSender(logger: Logger): Sender {
  return async (dest, text) => {
    logger.info('dry-run message', { dest, text });
    return { ok: true, status: 200 };
  };
}
