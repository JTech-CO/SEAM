import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { signBody } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import type { Destination } from '../src/route.ts';
import { createHandler } from '../src/server.ts';
import { memoryLogger, sample, testConfig, TOKEN } from './fixtures.ts';

const HMAC = 'h'.repeat(40);
const sent: { dest: Destination; text: string }[] = [];
const logger = memoryLogger();
let server: Server;
let base = '';

function start(cfg: Config): Promise<Server> {
  const s = createServer(createHandler({ config: cfg, logger, sender: async (dest, text) => (sent.push({ dest, text }), { ok: true, status: 200 }) }));
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s)));
}

before(async () => {
  server = await start(testConfig({ SEAM_HMAC_SECRET: HMAC, TELEGRAM_TOPIC_US: '12', TELEGRAM_TOPIC_CONFIRMED: '99' }));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'text/plain', ...headers } });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

let lockTs = 1750000000;
const fresh = (over: Record<string, unknown> = {}) => sample({ lock_ts: ++lockTs, bar_ts: lockTs + 3600, ...over });

test('health', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
});

test('valid formal break → queued to market topic + confirmed topic', async () => {
  sent.length = 0;
  const r = await post(`/hook/${TOKEN}`, fresh());
  assert.equal(r.status, 202);
  assert.deepEqual(r.json, { ok: true, action: 'queued', destinations: 2 });
  await new Promise((res) => setImmediate(res));
  assert.deepEqual(sent.map((s) => s.dest.threadId), [12, 99]);
  assert.match(sent[0]!.text, /^SEAM · AAPL 1H\n대칭삼각 상단 돌파 \(종가 확정\)/);
});

test('auth: wrong/missing token → 401, HMAC header accepted', async () => {
  assert.equal((await post('/hook/wrong-token-wrong-token-xx', fresh())).status, 401);
  assert.equal((await post('/hook', fresh())).status, 401);
  const body = JSON.stringify(fresh());
  assert.equal((await post('/hook', body, { 'x-seam-signature': signBody(body, HMAC) })).status, 202);
  assert.equal((await post('/hook', body, { 'x-seam-signature': signBody(body + ' ', HMAC) })).status, 401);
});

test('routing and method errors', async () => {
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/hook/${TOKEN}`)).status, 405);
});

test('size cap → 413, bad JSON / schema → 400 without echoing the body', async () => {
  assert.equal((await post(`/hook/${TOKEN}`, 'x'.repeat(10_000))).status, 413);
  const bad = await post(`/hook/${TOKEN}`, '{"v":1,"secret":"do-not-echo"');
  assert.equal(bad.status, 400);
  assert.doesNotMatch(JSON.stringify(bad.json), /do-not-echo/);
  assert.equal((await post(`/hook/${TOKEN}`, fresh({ key: 'NOPE' }))).status, 400);
});

test('drops preview, reference, disallowed events (200, not an error)', async () => {
  sent.length = 0;
  assert.deepEqual((await post(`/hook/${TOKEN}`, fresh({ preview: true }))).json, { ok: true, action: 'dropped', reason: 'preview' });
  assert.deepEqual((await post(`/hook/${TOKEN}`, fresh({ grade: 'reference', reason: 'too_few_touches' }))).json, { ok: true, action: 'dropped', reason: 'reference' });
  assert.deepEqual((await post(`/hook/${TOKEN}`, fresh({ event: 'expire', phase: 'expired' }))).json, { ok: true, action: 'dropped', reason: 'event' });
  assert.equal(sent.length, 0);
});

test('same id+event is sent once', async () => {
  const a = fresh({ ticker: 'NASDAQ:MSFT' });
  assert.equal((await post(`/hook/${TOKEN}`, a)).status, 202);
  assert.deepEqual((await post(`/hook/${TOKEN}`, a)).json, { ok: true, action: 'dropped', reason: 'duplicate' });
  // a different event of the same structure still goes through
  assert.equal((await post(`/hook/${TOKEN}`, { ...a, event: 'fail', phase: 'failed' })).status, 202);
});

test('rate limit: 3 per ticker per minute', async () => {
  const codes: unknown[] = [];
  for (let i = 0; i < 4; i++) codes.push((await post(`/hook/${TOKEN}`, fresh({ ticker: 'NASDAQ:NVDA' }))).json.action);
  assert.deepEqual(codes, ['queued', 'queued', 'queued', 'dropped']);
  assert.equal((await post(`/hook/${TOKEN}`, fresh({ ticker: 'NASDAQ:AMD' }))).status, 202);
});

test('logs never contain the webhook token', () => {
  assert.ok(logger.lines.length > 0);
  for (const l of logger.lines) assert.ok(!l.includes(TOKEN));
});

test('TradingView IP allowlist when enabled', async () => {
  const s = await start(testConfig({ SEAM_TV_IP_ONLY: 'true' }));
  const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/hook/${TOKEN}`;
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(fresh()) });
  assert.equal(res.status, 403);
  s.close();
});
