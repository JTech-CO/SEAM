import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTelegramSender } from '../src/telegram.ts';
import { BOT, memoryLogger } from './fixtures.ts';

type Reply = { status: number; body: unknown };

function fakeFetch(replies: Reply[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const r = replies.shift() ?? { status: 200, body: { ok: true } };
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

const noSleep = async () => {};

test('sends plain text with topic and no link preview', async () => {
  const f = fakeFetch([{ status: 200, body: { ok: true } }]);
  const send = createTelegramSender({ token: BOT, logger: memoryLogger(), fetchImpl: f.impl, sleep: noSleep });
  const r = await send({ chatId: '-100', threadId: 7, label: 'US' }, 'hello');
  assert.equal(r.ok, true);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0]!.url, /\/bot123456789:.+\/sendMessage$/);
  assert.deepEqual(f.calls[0]!.body, { chat_id: '-100', text: 'hello', link_preview_options: { is_disabled: true }, message_thread_id: 7 });
  assert.equal('parse_mode' in f.calls[0]!.body, false);
});

test('retries 429 (retry_after) and 5xx, not 4xx', async () => {
  const waits: number[] = [];
  const sleep = async (ms: number) => void waits.push(ms);
  const f = fakeFetch([
    { status: 429, body: { ok: false, parameters: { retry_after: 2 } } },
    { status: 502, body: {} },
    { status: 200, body: { ok: true } },
  ]);
  const send = createTelegramSender({ token: BOT, logger: memoryLogger(), fetchImpl: f.impl, sleep, minGapMs: 0 });
  const r = await send({ chatId: '-100', label: 'US' }, 'x');
  assert.equal(r.ok, true);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(waits.slice(0, 2), [2000, 2000]);

  const g = fakeFetch([{ status: 400, body: { ok: false, description: 'Bad Request: chat not found' } }]);
  const send2 = createTelegramSender({ token: BOT, logger: memoryLogger(), fetchImpl: g.impl, sleep: noSleep });
  const r2 = await send2({ chatId: '-100', label: 'US' }, 'x');
  assert.equal(r2.ok, false);
  assert.equal(r2.description, 'Bad Request: chat not found');
  assert.equal(g.calls.length, 1);
});

test('messages to one chat go out in order', async () => {
  const f = fakeFetch([]);
  const send = createTelegramSender({ token: BOT, logger: memoryLogger(), fetchImpl: f.impl, sleep: noSleep });
  await Promise.all(['1', '2', '3'].map((t) => send({ chatId: '-100', label: 'US' }, t)));
  assert.deepEqual(f.calls.map((c) => c.body.text), ['1', '2', '3']);
});
