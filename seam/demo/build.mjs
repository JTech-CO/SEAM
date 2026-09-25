#!/usr/bin/env node
// Builds the static demo data (seam/demo/site/data.js).
//
// Runs seam/pine/SEAM_Patterns.pine bar by bar on the synthetic scenarios with the offline engine
// used by seam/tests/engine, records how every line and label changes, and renders each alert with
// the relay's own Telegram formatter. The page itself only reads the result; no engine ships to it.
//
//   (cd seam/tests/engine && npm ci) && node seam/demo/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBars, randomWalk, run, stepRun } from '../tests/engine/harness.mjs';
import { expectedBreak, scenarios } from '../tests/engine/scenarios.mjs';
import { buildMessage, KEY_NAMES } from '../relay/src/format.ts';
import { validateAlert } from '../relay/src/schema.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'site', 'data.js');

// Same settings a new user starts with, plus retest/expire alerts so the log shows every published event.
const INPUTS = { retest: true, expire: true };
const SEED = 1;

const FAMILY = {
  TRI_ASC: '수축류', TRI_DESC: '수축류', TRI_SYM: '수축류', WEDGE_RISING: '수축류', WEDGE_FALLING: '수축류',
  PENNANT_BULL: '수축류', PENNANT_BEAR: '수축류',
  CHANNEL_UP: '평행류', CHANNEL_DN: '평행류', BOX: '평행류', FLAG_BULL: '평행류', FLAG_BEAR: '평행류',
  DOUBLE_BOTTOM: '반전류', DOUBLE_TOP: '반전류', CUP_HANDLE: '반전류',
};

const NOTE = {
  TRI_SYM: '고점은 낮아지고 저점은 높아지며 수렴한 뒤 위로 빠지는 차트입니다.',
  TRI_ASC: '같은 높이의 고점과 높아지는 저점이 만든 수렴 뒤 위로 빠집니다.',
  TRI_DESC: '같은 높이의 저점과 낮아지는 고점이 만든 수렴 뒤 아래로 빠집니다.',
  WEDGE_RISING: '두 선이 모두 오르며 좁아진 뒤 아래로 빠집니다. 삼각과 따로 분류됩니다.',
  WEDGE_FALLING: '두 선이 모두 내리며 좁아진 뒤 위로 빠집니다.',
  BOX: '같은 두 가격 사이를 오간 뒤 위로 빠집니다.',
  CHANNEL_UP: '평행한 두 선을 따라 오르다 아래로 이탈합니다.',
  CHANNEL_DN: '평행한 두 선을 따라 내리다 위로 이탈합니다.',
  FLAG_BULL: '급등 뒤 짧게 쉬는 깃발 모양, 이어서 위로 빠집니다.',
  FLAG_BEAR: '급락 뒤 짧게 쉬는 깃발 모양, 이어서 아래로 빠집니다.',
  PENNANT_BULL: '급등 뒤 짧은 수렴, 이어서 위로 빠집니다.',
  PENNANT_BEAR: '급락 뒤 짧은 수렴, 이어서 아래로 빠집니다.',
  DOUBLE_BOTTOM: '비슷한 두 저점 뒤 넥라인을 위로 넘습니다.',
  DOUBLE_TOP: '비슷한 두 고점 뒤 넥라인을 아래로 깹니다.',
  CUP_HANDLE: '둥근 바닥과 얕은 핸들 뒤 립을 위로 넘습니다.',
};

const r4 = (v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);

// Colors the indicator uses by default → roles the page themes (seam/pine/SEAM_Patterns.pine §1 색)
function role(obj) {
  const p = obj.props;
  const hex = String(p.color ?? '').toUpperCase();
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) : 255;
  if (alpha === 0) return 'hidden';
  const rgb = hex.slice(0, 7);
  if (obj.type === 'label' && p.style === 'diamond') return rgb === '#E0A526' ? 'lock-2' : rgb === '#9C6ADE' ? 'lock-3' : 'lock-1';
  if (obj.type === 'label') return rgb === '#2E7D32' ? 'up' : rgb === '#C62828' ? 'down' : 'event';
  if (p.style === 'dotted') return 'forming';
  if (rgb === '#8B93A7') return 'reference';
  return rgb === '#E0A526' ? 'formal-2' : rgb === '#9C6ADE' ? 'formal-3' : 'formal-1';
}

function snapshot(obj) {
  const p = obj.props;
  if (obj.type === 'line') return { r: role(obj), x1: p.x1, y1: r4(p.y1), x2: p.x2, y2: r4(p.y2), w: p.width, d: p.style === 'dotted' ? 1 : 0 };
  return { r: role(obj), x: p.x, y: r4(p.y), t: p.text ?? '', at: p.yloc, tip: p.tooltip ?? '' };
}

async function record(bars) {
  const objects = new Map(); // id → { k, born, died, frames: [[bar, changes]] }
  const last = new Map();    // id → last snapshot
  const eng = await stepRun(bars, INPUTS, (i, e) => {
    const alive = new Set();
    for (const d of e.drawings) {
      if (d.type !== 'line' && d.type !== 'label') continue;
      alive.add(d.id);
      const snap = snapshot(d);
      const prev = last.get(d.id);
      if (!prev) {
        objects.set(d.id, { k: d.type === 'line' ? 'L' : 'B', born: i, died: null, frames: [[i, snap]] });
      } else {
        const diff = {};
        for (const [key, v] of Object.entries(snap)) if (prev[key] !== v) diff[key] = v;
        if (Object.keys(diff).length) objects.get(d.id).frames.push([i, diff]);
      }
      last.set(d.id, snap);
    }
    for (const [id, o] of objects) if (o.died === null && !alive.has(id)) {
      o.died = i;
      last.delete(id);
    }
  });
  const alerts = eng.outputs.alerts.map((a) => ({ bar: a.bar, raw: a.message }));
  return { objects: [...objects.values()], alerts };
}

function event(a) {
  const parsed = validateAlert(JSON.parse(a.raw));
  if (!parsed.ok) throw new Error(`payload failed the relay schema: ${a.raw} → ${parsed.errors.join(', ')}`);
  const x = parsed.alert;
  return {
    bar: a.bar, event: x.event, key: x.key, lock: x.lock_ts, upper: x.upper, lower: x.lower,
    upperNow: x.upper_now, lowerNow: x.lower_now, close: x.close, adhesion: x.adhesion,
    touches: x.touches, message: buildMessage(x),
  };
}

async function build(id, bars, meta) {
  const rec = await record(bars);
  // Stepping must give the same alerts as a normal full run (it is the same engine, bar by bar).
  const full = await run(bars, INPUTS);
  if (JSON.stringify(full.raw.map((a) => [a.bar, a.message])) !== JSON.stringify(rec.alerts.map((a) => [a.bar, a.raw]))) {
    throw new Error(`${id}: stepped run differs from full run`);
  }
  return {
    id,
    ...meta,
    ticker: `DEMO:${id}`,
    bars: bars.map((b) => [r4(b.open), r4(b.high), r4(b.low), r4(b.close)]),
    objects: rec.objects,
    events: rec.alerts.map(event),
  };
}

const out = [];
for (const [key, wp] of Object.entries(scenarios)) {
  const s = await build(key, makeBars(wp, { seed: SEED }), {
    title: KEY_NAMES[key], family: FAMILY[key], note: NOTE[key], expect: expectedBreak[key],
  });
  if (!s.events.some((e) => e.key === key && e.event === 'lock')) throw new Error(`${key}: no formal lock in the demo run`);
  out.push(s);
}
for (const [i, seed] of [[1, 101], [2, 202]]) {
  out.push(await build(`RANDOM_${i}`, randomWalk(480, seed), {
    title: `무작위 차트 ${i}`, family: '무작위',
    note: '패턴을 일부러 넣지 않은 차트입니다. normal 기준으로 formal 구조는 드물게만 잠깁니다.', expect: null,
  }));
}

const data = {
  builtAt: new Date().toISOString(),
  settings: '민감도 normal · 표시 개수 1 · reference 표시 · retest/expire 알림 켬',
  stepMs: 3600e3,
  t0: Date.UTC(2026, 0, 5),
  scenarios: out,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `// Generated by seam/demo/build.mjs — do not edit.\nwindow.SEAM_DEMO = ${JSON.stringify(data)};\n`);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`demo data: ${out.length} scenarios, ${out.reduce((n, s) => n + s.events.length, 0)} events, ${kb} KB → ${path.relative(process.cwd(), OUT)}`);
