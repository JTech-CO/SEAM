#!/usr/bin/env node
// Case candidates for seam/tests/cases.md §3: runs the indicator on recent Binance candles for several
// SYMBOL@TF[@SINCE] series and lists, per pattern key, as many formal structures as cases.md still needs
// (--per minus the rows already recorded), newest first, spread across series. Structures already recorded
// are skipped. SINCE (ISO time) is the first bar the TradingView plan lets you scroll to: only structures locked
// from there are listed. The run itself starts --lead bars earlier, because TradingView computes the indicator on
// far more history than it shows (free plan, 1h: scroll from 08-20, structure ids say the run starts ~2026-01-01).
// Without SINCE the run uses --bars of history and skips the first --warm bars.
// Candidates are only a starting point: each one is confirmed on TradingView before it goes into cases.md.
//
//   node candidates.mjs BINANCE:BTCUSDT@60@2026-08-20T05:00+09:00 BINANCE:BTCUSDT@240@2026-08-20T05:00+09:00 BINANCE:BTCUSDT@D --out ../real/candidates.md
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { KEYS } from '../../relay/src/schema.ts';
import { KEY_NAMES, formatTf } from '../../relay/src/format.ts';
import { PINE_PATH } from './harness.mjs';
import { digitsOf, fetchCandles, runReplay, tickWarning } from './replay.mjs';

const CASES = new URL('../cases.md', import.meta.url);
// Code revision the candidates come from; the TradingView panel header shows the same string ("SEAM 26.10.05").
const REV = fs.readFileSync(PINE_PATH, 'utf8').match(/const string REV = "([^"]+)"/)?.[1] ?? '?';

const STEP = { 1: 60e3, 5: 300e3, 15: 900e3, 60: 3600e3, 240: 14400e3, D: 86400e3 };
const TZ = 'Asia/Seoul';

function fmt(ms, withYear) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return `${withYear ? `${p.year}-` : ''}${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// Rows already filled in cases.md §3: "| KEY | BINANCE:SYM | 1H | start ~ lock | ...".
function recorded() {
  const rows = fs.readFileSync(CASES, 'utf8').split('\n').map((l) => l.split('|').map((c) => c.trim()));
  return rows
    .filter((c) => KEYS.includes(c[1]) && c[2])
    .map((c) => ({ key: c[1], symbol: c[2], tf: c[3], lock: (c[4].split('~')[1] ?? '').trim() }));
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
      bars: { type: 'string', default: '5000' }, warm: { type: 'string', default: '300' }, lead: { type: 'string', default: '3000' },
      per: { type: 'string', default: '3' }, sens: { type: 'string', default: 'normal' },
      out: { type: 'string' },
    },
  });
  if (!positionals.length) throw new Error('give one or more SYMBOL@TF, e.g. BINANCE:BTCUSDT@60');
  const inputs = { 민감도: o.sens, '표시 개수': 1 };
  const found = [];
  const series = [];
  const done = recorded();
  const isDone = (s) => done.some((d) => d.key === s.key && d.symbol === s.symbol && d.tf === formatTf(s.tf) && d.lock === fmt(s.lockMs, true));
  for (const arg of positionals) {
    const [symbol, tf, since] = arg.split('@');
    if (since && Number.isNaN(Date.parse(since))) throw new Error(`bad SINCE in ${arg}`);
    if (!STEP[tf]) throw new Error(`unsupported tf in ${arg}`);
    const startMs = since ? Date.parse(since) - Number(o.lead) * STEP[tf] : Date.now() - Number(o.bars) * STEP[tf];
    const c = await fetchCandles({ symbol, tf, startMs, endMs: Date.now() });
    if (tickWarning(c.mintick)) {
      // TradingView shows the true tick, the engine prints 0.01 steps: the lock prices could not be compared.
      series.push(`${c.symbol} ${formatTf(c.tf)} · 제외 — ${tickWarning(c.mintick)}`);
      continue;
    }
    const events = await runReplay(c, inputs);
    // listed: locks from SINCE (first visible bar), or after the warm-up when there is no SINCE
    const from = since ? Date.parse(since) : c.bars[Math.min(Number(o.warm), c.bars.length - 1)][0];
    const byId = new Map();
    for (const e of events) {
      const id = `${e.key}|${e.lockMs}`;
      if (!byId.has(id)) byId.set(id, { series: arg, symbol: c.symbol, tf: c.tf, key: e.key, lockMs: e.lockMs, digits: digitsOf(c.mintick), events: [] });
      byId.get(id).events.push(e);
    }
    const list = [...byId.values()].filter((s) => s.events[0].code === 'LOCK' && s.lockMs >= from && !isDone(s));
    series.push(`${c.symbol} ${formatTf(c.tf)} · 봉 ${c.bars.length}개 ${fmt(c.bars[0][0], true)} ~ ${fmt(c.bars.at(-1)[0], true)}${since ? ` · ${fmt(Date.parse(since), true)} 부터 잠긴 구조만 (그 앞 ${o.lead}봉은 워밍업)` : ` · 앞 ${o.warm}봉은 워밍업으로 제외`} · 미기록 구조 ${list.length}`);
    found.push(...list);
  }
  found.sort((a, b) => b.lockMs - a.lockMs);

  const per = Number(o.per);
  const lines = [];
  const counts = [];
  let n = 0;
  for (const key of KEYS) {
    const all = found.filter((s) => s.key === key);
    const have = done.filter((d) => d.key === key).length;
    const need = Math.max(0, per - have);
    counts.push(`| \`${key}\` ${KEY_NAMES[key]} | ${have} | ${need} | ${all.length} |`);
    for (const s of pick(all, need)) {
      const [lock, ...after] = s.events;
      const px = (v) => v.toFixed(s.digits);
      const chain = after.length ? after.map((e) => `${e.code} ${fmt(e.barMs, false)}`).join(' → ') : '이후 이벤트 없음 (추적 중이거나 더 나은 구조로 교체됨)';
      lines.push(`| ${++n} | \`${key}\` | ${s.symbol.split(':')[1]} ${formatTf(s.tf)} | ${fmt(s.lockMs, true)} | ${px(lock.px[0])} / ${px(lock.px[1])} | ${chain} | |`);
    }
    if (all.length < need) lines.push(`|  | \`${key}\` | 후보 ${all.length}개뿐 (필요 ${need}) — 종목 · TF 를 늘려 다시 찾기 |  |  |  |  |`);
  }

  const md = `# 사례 후보 (TradingView 확인 전)

오프라인 엔진이 Binance 봉에서 찾은 formal 구조입니다. **아직 사례가 아닙니다.** TradingView 에서 확인한 것만 \`cases.md\` 3절에 옮깁니다.

- 만든 날: ${fmt(Date.now(), true)} 한국시간 · 코드 판 \`${REV}\` · 민감도 \`${o.sens}\` · 표시 개수 1
- 기록된 사례 ${done.length} / ${KEYS.length * per} · 키마다 \`cases.md\` 에 남은 칸만큼, 최신순으로 종목 · TF 를 섞어서 골랐습니다. 이미 기록한 구조는 뺐습니다.
- 명령: \`node candidates.mjs ${positionals.join(' ')}\` (seam/tests/engine, 인터넷 필요)
- 시각은 한국시간, 봉 시작 시각입니다. 차트 시간대를 UTC+9 로 두면 그대로 찾을 수 있습니다.

${series.map((s) => `- ${s}`).join('\n')}

## 확인 방법

0. TradingView 패널 머리글이 \`SEAM ${REV}\` 인지 봅니다. 다르면 차트의 SEAM 이 다른 판의 코드입니다. 저장소의 \`seam/pine/SEAM_Patterns.pine\` 을 Pine 편집기에 붙여 넣고 저장한 뒤 "차트에 추가" 합니다.
1. TradingView 에서 **후보 줄의 종목 · TF 차트**로 바꿉니다 (예: \`BCHUSDT 1H\` → \`BINANCE:BCHUSDT\`, 1시간). 다른 종목 차트에서는 그 후보가 보이지 않습니다. SEAM 은 하나만, 민감도 normal, 표시 개수 1.
2. 날짜로 이동(Alt+G)해 잠금 봉으로 갑니다. 잠금 다이아몬드에 마우스를 올려 툴팁의 잠금가가 아래 표와 같은지 봅니다.
3. 선이 가격에 제대로 붙었는지(접점 · 밀착) 눈으로 판단합니다.
4. 확인 칸에 \`OK\` / \`NG\` 와 한 줄 메모를 적어 알려 주시면 \`cases.md\` 3절로 옮깁니다. 스크린샷이 있으면 더 좋습니다.

무료 요금제의 바 리플레이는 일봉 이상만 됩니다. 1시간 · 4시간 후보는 리플레이 대신 "TradingView 잠금가 = 엔진 잠금가" 로 같은 봉 · 같은 값을 확인합니다 (과거 선은 다시 그려지지 않고, 엔진 대조는 \`seam/tests/real\` 시험이 확인). 일봉 후보는 바 리플레이로 잠금 봉 전부터 재생해 같은 봉 · 같은 값으로 잠기는지까지 볼 수 있습니다.

## 후보

| # | 키 | 종목 · TF | 잠금 봉 | 잠금 상 / 하 | 이후 이벤트 | 확인 |
|---|---|---|---|---|---|---|
${lines.join('\n')}

## 키별 현황

\`미기록 구조\` 는 위 구간에서 엔진이 찾은 formal 구조 중 아직 기록하지 않은 수입니다. 한쪽으로 몰리거나 거의 안 나오는 키는 프리셋 조정 후보입니다 (사례 확인 뒤 판단).

| 키 | 기록 | 남은 칸 | 미기록 구조 |
|---|---|---|---|
${counts.join('\n')}
`;
  if (o.out) fs.writeFileSync(o.out, md);
  else process.stdout.write(md);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(2);
});
