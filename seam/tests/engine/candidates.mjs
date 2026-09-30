#!/usr/bin/env node
// Case candidates for seam/tests/cases.md §3: runs the indicator on recent Binance candles for several
// symbol@tf series and lists up to --per formal structures per pattern key, newest first, spread across series.
// Candidates are only a starting point: each one is confirmed on TradingView before it goes into cases.md.
//
//   node candidates.mjs BINANCE:BTCUSDT@60 BINANCE:ETHUSDT@60 BINANCE:BTCUSDT@240 BINANCE:ETHUSDT@240 --out ../real/candidates.md
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { KEYS } from '../../relay/src/schema.ts';
import { KEY_NAMES, formatTf } from '../../relay/src/format.ts';
import { digitsOf, fetchCandles, runReplay } from './replay.mjs';

const STEP = { 1: 60e3, 5: 300e3, 15: 900e3, 60: 3600e3, 240: 14400e3, D: 86400e3 };
const TZ = 'Asia/Seoul';

function fmt(ms, withYear) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return `${withYear ? `${p.year}-` : ''}${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// Newest first, but take one per series before taking a second from any series.
function pick(list, per) {
  const out = [];
  const used = new Set();
  for (const s of list) if (out.length < per && !used.has(s.series)) (out.push(s), used.add(s.series));
  for (const s of list) if (out.length < per && !out.includes(s)) out.push(s);
  return out.sort((a, b) => b.lockMs - a.lockMs);
}

async function main() {
  const { values: o, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      bars: { type: 'string', default: '5000' }, warm: { type: 'string', default: '300' },
      per: { type: 'string', default: '3' }, sens: { type: 'string', default: 'normal' },
      out: { type: 'string' },
    },
  });
  if (!positionals.length) throw new Error('give one or more SYMBOL@TF, e.g. BINANCE:BTCUSDT@60');
  const inputs = { 민감도: o.sens, '표시 개수': 1 };
  const found = [];
  const series = [];
  for (const arg of positionals) {
    const [symbol, tf] = arg.split('@');
    if (!STEP[tf]) throw new Error(`unsupported tf in ${arg}`);
    const c = await fetchCandles({ symbol, tf, startMs: Date.now() - Number(o.bars) * STEP[tf], endMs: Date.now() });
    const events = await runReplay(c, inputs);
    const warmEnd = c.bars[Math.min(Number(o.warm), c.bars.length - 1)][0];
    const byId = new Map();
    for (const e of events) {
      const id = `${e.key}|${e.lockMs}`;
      if (!byId.has(id)) byId.set(id, { series: arg, symbol: c.symbol, tf: c.tf, key: e.key, lockMs: e.lockMs, digits: digitsOf(c.mintick), events: [] });
      byId.get(id).events.push(e);
    }
    const list = [...byId.values()].filter((s) => s.events[0].code === 'LOCK' && s.lockMs >= warmEnd);
    series.push(`${c.symbol} ${formatTf(c.tf)} · 봉 ${c.bars.length}개 ${fmt(c.bars[0][0], true)} ~ ${fmt(c.bars.at(-1)[0], true)} · 구조 ${list.length}`);
    found.push(...list);
  }
  found.sort((a, b) => b.lockMs - a.lockMs);

  const per = Number(o.per);
  const lines = [];
  const counts = [];
  let n = 0;
  for (const key of KEYS) {
    const all = found.filter((s) => s.key === key);
    counts.push(`| \`${key}\` ${KEY_NAMES[key]} | ${all.length} |`);
    for (const s of pick(all, per)) {
      const [lock, ...after] = s.events;
      const px = (v) => v.toFixed(s.digits);
      const chain = after.length ? after.map((e) => `${e.code} ${fmt(e.barMs, false)}`).join(' → ') : '추적 중';
      lines.push(`| ${++n} | \`${key}\` | ${s.symbol.split(':')[1]} ${formatTf(s.tf)} | ${fmt(s.lockMs, true)} | ${px(lock.px[0])} / ${px(lock.px[1])} | ${chain} | |`);
    }
    if (all.length < per) lines.push(`|  | \`${key}\` | 후보 ${all.length}개뿐 — 종목 · 기간을 늘려 다시 찾기 |  |  |  |  |`);
  }

  const md = `# 사례 후보 (TradingView 확인 전)

오프라인 엔진이 Binance 봉에서 찾은 formal 구조입니다. **아직 사례가 아닙니다.** TradingView 에서 확인한 것만 \`cases.md\` 3절에 옮깁니다.

- 만든 날: ${fmt(Date.now(), true)} 한국시간 · 민감도 \`${o.sens}\` · 표시 개수 1 · 키마다 최신순 ${per}개 (종목 · TF 를 섞어서)
- 명령: \`node candidates.mjs ${positionals.join(' ')}\` (seam/tests/engine, 인터넷 필요)
- 시각은 한국시간, 봉 시작 시각입니다. 차트 시간대를 UTC+9 로 두면 그대로 찾을 수 있습니다.

${series.map((s) => `- ${s}`).join('\n')}

## 확인 방법

1. TradingView 에서 같은 차트(예: \`BINANCE:BTCUSDT\`, 1시간)에 SEAM 을 하나만 붙입니다. 민감도 normal, 표시 개수 1.
2. 날짜로 이동(Alt+G)해 잠금 봉으로 갑니다. 잠금 다이아몬드에 마우스를 올려 툴팁의 잠금가가 아래 표와 같은지 봅니다.
3. 선이 가격에 제대로 붙었는지(접점 · 밀착) 눈으로 판단합니다.
4. 확인 칸에 \`OK\` / \`NG\` 와 한 줄 메모를 적어 알려 주시면 \`cases.md\` 3절로 옮깁니다. 스크린샷이 있으면 더 좋습니다.

무료 요금제의 바 리플레이는 일봉 이상만 됩니다. 1시간 · 4시간 후보는 리플레이 대신 "TradingView 잠금가 = 엔진 잠금가" 로 같은 봉 · 같은 값을 확인합니다 (과거 선은 다시 그려지지 않고, 엔진 대조는 \`seam/tests/real\` 시험이 확인).

## 후보

| # | 키 | 종목 · TF | 잠금 봉 | 잠금 상 / 하 | 이후 이벤트 | 확인 |
|---|---|---|---|---|---|---|
${lines.join('\n')}

## 키별로 찾은 수

한쪽으로 몰리거나 거의 안 나오는 키는 프리셋 조정 후보입니다 (사례 확인 뒤 판단).

| 키 | 구조 수 |
|---|---|
${counts.join('\n')}
`;
  if (o.out) fs.writeFileSync(o.out, md);
  else process.stdout.write(md);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(2);
});
