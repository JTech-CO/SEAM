#!/usr/bin/env node
// seam-scanner: watchlist.json series × SEAM_Patterns.pine on Binance closed bars → Telegram (seam/docs/SCANNER.md).
//
//   npm start            run forever (systemd: deploy/seam-scanner.service)
//   npm run ping         send one test message to TELEGRAM_CHAT_ID
//   npm run chat-id      list the chats that wrote to the bot (to find TELEGRAM_CHAT_ID)
//   npm run show         print, not send, the messages of the last 48 closed bars
import { parseArgs } from 'node:util';
import { DISCLAIMER_LINE, formatTf, formatTicker } from '../../relay/src/format.ts';
import { createLogger } from '../../relay/src/log.ts';
import { createDryRunSender, createTelegramSender } from '../../relay/src/telegram.ts';
import { loadEnv, loadWatchlist } from './config.mjs';
import { loadScript } from './engine.mjs';
import { Scanner } from './scanner.mjs';

const { values: o } = parseArgs({
  options: {
    ping: { type: 'boolean' },
    'chat-id': { type: 'boolean' },
    show: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
});

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

// Chats that sent a message to the bot. The token stays out of the output.
async function chatIds(token, apiBase) {
  if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token ?? '')) fail('TELEGRAM_BOT_TOKEN missing or malformed in .env');
  const res = await fetch(`${apiBase}/bot${token}/getUpdates`, { signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) fail(`getUpdates failed: ${res.status} ${data.description ?? ''}`);
  const chats = new Map();
  for (const u of data.result ?? []) {
    const c = (u.message ?? u.channel_post ?? u.my_chat_member)?.chat;
    if (c) chats.set(c.id, `${c.type} ${c.username ? `@${c.username}` : (c.title ?? c.first_name ?? '')}`.trim());
  }
  if (!chats.size) fail('no messages yet: open the bot in Telegram, send it any message, then run this again');
  for (const [id, who] of chats) process.stdout.write(`TELEGRAM_CHAT_ID=${id}   (${who})\n`);
}

const apiBase = (process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/+$/, '');
if (o['chat-id']) {
  await chatIds(process.env.TELEGRAM_BOT_TOKEN?.trim(), apiBase);
  process.exit(0);
}

let env;
let script;
let watchlist;
try {
  env = loadEnv(o['dry-run'] || o.show ? { ...process.env, SEAM_DRY_RUN: 'true' } : process.env);
  script = loadScript();
  watchlist = loadWatchlist(script.inputs);
} catch (e) {
  fail(e.message);
}

const logger = createLogger([env.botToken]);
const sender = env.dryRun
  ? o.show
    ? async (_dest, text) => (process.stdout.write(`\n${text}\n`), { ok: true, status: 200 })
    : createDryRunSender(logger)
  : createTelegramSender({ token: env.botToken, apiBase: env.apiBase, logger });
const names = watchlist.series.map((s) => `${formatTicker(s.symbol)} ${formatTf(s.tf)}`).join(' · ');

if (o.ping) {
  const text = `SEAM 스캐너 연결 확인\n코드 판 ${script.rev} · 감시 ${names}\n${DISCLAIMER_LINE}`;
  const r = await sender({ chatId: env.chatId, label: 'PING' }, text);
  if (!r.ok) fail(`send failed: ${r.status} ${r.description ?? ''}`);
  process.stdout.write('sent\n');
  process.exit(0);
}

const show = o.show === undefined ? 0 : Number(o.show);
if (o.show !== undefined && !(Number.isInteger(show) && show > 0 && show <= 1000)) fail('--show needs a bar count 1..1000');

const scanner = new Scanner({
  script,
  watchlist,
  events: env.events,
  chatId: env.chatId,
  sender,
  logger,
  statePath: show ? null : env.statePath, // show mode leaves the state file alone
  backfillBars: show,
});

logger.info('seam-scanner starting', { rev: script.rev, series: names, inputs: watchlist.inputs, events: [...env.events], dryRun: env.dryRun, state: show ? null : env.statePath });
try {
  await scanner.start();
} catch (e) {
  fail(`start failed: ${e.message}`);
}
if (show) process.exit(0);

let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => {
    // state is written atomically after every bar, so stopping here loses nothing
    logger.info('shutting down', { signal: sig });
    stopping = true;
    process.exit(0);
  });
}
await scanner.run({ stop: () => stopping });
