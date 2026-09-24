// Spec §11 checklist, automated where an offline engine can check it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Engine, ArrayFeed } from '@heyphat/piner';
import { validateAlert } from '../../relay/src/schema.ts';
import { getCompiled, makeBars, randomWalk, run, RUN } from './harness.mjs';
import { expectedBreak, scenarios } from './scenarios.mjs';

const SEEDS = [1, 2, 3];
const idOf = (a) => `${a.key}|${a.lock_ts}`;

test('script compiles without diagnostics', () => {
  const c = getCompiled();
  assert.deepEqual(c.diagnostics ?? [], []);
});

// Synthetic swings sit on the lines, so noise can fake an early break of the first lock; a later,
// better lock of the same key then carries the classic break. Assert on the key, not the first lock.
for (const [key, wp] of Object.entries(scenarios)) {
  test(`${key}: formal lock, then the built-in ${expectedBreak[key]} on the locked lines`, async () => {
    for (const seed of SEEDS) {
      const { alerts } = await run(makeBars(wp, { seed }));
      const locks = new Map(alerts.filter((a) => a.key === key && a.event === 'lock').map((a) => [idOf(a), a]));
      assert.ok(locks.size > 0, `seed ${seed}: no ${key} lock in ${JSON.stringify(alerts.map((a) => `${a.event}:${a.key}`))}`);
      for (const l of locks.values()) assert.equal(l.grade, 'formal');
      const brk = alerts.find((a) => locks.has(idOf(a)) && a.event === expectedBreak[key]);
      assert.ok(brk, `seed ${seed}: ${key} locked but no ${expectedBreak[key]}: ${JSON.stringify(alerts.map((a) => `${a.bar}:${a.event}:${a.key}`))}`);
      assert.ok(brk.bar > locks.get(idOf(brk)).bar);
      // the break is decided by the close against the LOCKED line extended to that bar
      if (brk.event === 'break_up') assert.ok(brk.close > brk.upper_now, 'close above locked upper');
      else assert.ok(brk.close < brk.lower_now, 'close below locked lower');
    }
  });
}

test('every payload matches the relay schema (Pine ↔ relay contract)', async () => {
  const bars = randomWalk(1500, 7);
  const { raw } = await run(bars, { '표시 개수': 3, retest: true, expire: true });
  assert.ok(raw.length > 0);
  for (const a of raw) {
    const r = validateAlert(JSON.parse(a.message));
    assert.ok(r.ok, `${a.message} → ${JSON.stringify(r.ok ? '' : r.errors)}`);
  }
});

test('PRINCIPLE 2: replay gives the same locks — history never changes when more bars arrive', async () => {
  for (const seed of [101, 202]) {
    const bars = randomWalk(1500, seed);
    const full = await run(bars);
    assert.ok(full.alerts.length > 0);
    for (const cut of [600, 1100, 1497]) {
      const part = await run(bars.slice(0, cut));
      assert.deepEqual(part.alerts, full.alerts.filter((a) => a.bar < cut), `seed ${seed} cut ${cut}`);
    }
  }
});

test('PRINCIPLE 2: every event of a structure carries the same locked upper/lower', async () => {
  const { alerts } = await run(randomWalk(3000, 303), { '표시 개수': 3, retest: true, expire: true });
  const locked = new Map();
  for (const a of alerts) {
    const v = `${a.upper}|${a.lower}`;
    if (locked.has(idOf(a))) assert.equal(locked.get(idOf(a)), v, idOf(a));
    locked.set(idOf(a), v);
    assert.ok(a.bar_ts >= a.lock_ts);
  }
});

test('PRINCIPLE 4: alerts are formal only; reference display does not change them', async () => {
  const bars = randomWalk(3000, 404);
  const on = await run(bars);
  const off = await run(bars, { '미달 구조 흐리게 표시 (reference)': false });
  assert.ok(on.alerts.every((a) => a.grade === 'formal' && a.reason === null && a.preview === false));
  assert.deepEqual(on.alerts, off.alerts);
});

test('toggles: alerts off → silent; family off → none of its keys', async () => {
  const bars = randomWalk(2000, 505);
  assert.equal((await run(bars, { '확정 알림 (formal · 봉마감만)': false })).alerts.length, 0);
  const noC = await run(bars, { '수축류 (삼각 · 쐐기 · 페넌트)': false, '표시 개수': 3 });
  assert.ok(noC.alerts.every((a) => !/^(TRI|WEDGE|PENNANT)/.test(a.key)));
  const onlyLocks = await run(bars, { break: false, fail: false });
  assert.ok(onlyLocks.alerts.every((a) => a.event === 'lock'));
});

test('PRINCIPLE 1: confirm-on-close — intrabar crossings do nothing, the break fires on the closing tick', async () => {
  const bars = makeBars(scenarios.TRI_SYM, { seed: 11 });
  const H = 126; // TRI_SYM locks around bar 116 and is still inside at 125
  for (const preview of [false, true]) {
    const eng = new Engine(getCompiled(), new ArrayFeed(bars.slice(0, H)), { inputs: { '봉마감 전 미리보기 알림 (비권장)': preview } });
    await eng.run(RUN);
    const lock = eng.outputs.alerts.map((a) => JSON.parse(a.message)).find((a) => a.event === 'lock');
    assert.ok(lock);
    const n0 = eng.outputs.alerts.length;
    const since = () => eng.outputs.alerts.slice(n0).map((a) => JSON.parse(a.message));
    const o = bars[H - 1].close;
    const up = lock.upper_now + 3;
    const t = bars[H].time;
    // piner drops alerts of rolled-back ticks; TradingView delivers them when fired, so read right after the tick.
    eng.tick({ time: t, open: o, high: o + 0.1, low: o - 0.1, close: o, volume: 1 }, false); // bar opens inside
    eng.tick({ time: t, open: o, high: up + 0.1, low: o - 0.2, close: up, volume: 1 }, false); // above, not closed
    const intrabar = since();
    assert.equal(intrabar.length, preview ? 1 : 0);
    assert.ok(intrabar.every((a) => a.preview === true && a.event === 'break_up'), 'intrabar crossing is preview only');
    eng.tick({ time: t, open: o, high: up + 0.1, low: o - 0.3, close: o - 0.1, volume: 1 }, true); // closes inside
    assert.ok(since().every((a) => a.preview === true), 'no confirmed event from an intrabar crossing');
    const t2 = t + 3600e3;
    eng.tick({ time: t2, open: o, high: up + 1, low: o, close: up + 0.8, volume: 1 }, true); // closes above
    const confirmed = since().filter((a) => !a.preview);
    assert.deepEqual(confirmed.map((a) => a.event), ['break_up']);
    assert.equal(confirmed[0].lock_ts, lock.lock_ts);
  }
});

test('stays quiet on noise: formal locks per 1000 random-walk bars (normal, 1 slot)', async () => {
  let locks = 0;
  for (const seed of [11, 22, 33]) locks += (await run(randomWalk(3000, seed))).alerts.filter((a) => a.event === 'lock').length;
  const per1000 = (locks / 9000) * 1000;
  assert.ok(per1000 > 0.5 && per1000 < 15, `locks per 1000 bars = ${per1000.toFixed(1)}`);
});

test('a second, independent Pine compiler also accepts the script', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { PINE_PATH } = await import('./harness.mjs');
  const bin = fileURLToPath(new URL('./node_modules/@nullarch/resin/bin/resin.mjs', import.meta.url));
  const out = execFileSync(process.execPath, [bin, 'check', PINE_PATH], { encoding: 'utf8' });
  assert.match(out, /1\/1 compiled/);
});
