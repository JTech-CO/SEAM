// PRINCIPLE 7: presets live in two places (Pine §2 and presets.json.md). They must match.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { PINE_PATH } from './harness.mjs';

const MD_PATH = new URL('../../pine/presets.json.md', import.meta.url);

function presetsFromPine() {
  const src = fs.readFileSync(PINE_PATH, 'utf8');
  const block = src.slice(src.indexOf('// 2. 프리셋'), src.indexOf('float atr = ta.atr('));
  const out = {};
  for (const line of block.split('\n')) {
    const code = line.split('//')[0].trim();
    let m = /^(?:int|float)\s+(\w+)\s*=\s*iSens == "loose" \?\s*([\d.]+)\s*: iSens == "strict" \?\s*([\d.]+)\s*:\s*([\d.]+)$/.exec(code);
    if (m) {
      out[m[1]] = { loose: +m[2], normal: +m[4], strict: +m[3] };
      continue;
    }
    m = /^(?:int|float)\s+(\w+)\s*=\s*iSens == "loose" \?\s*([\d.]+)\s*:\s*([\d.]+)$/.exec(code);
    if (m) {
      out[m[1]] = { loose: +m[2], normal: +m[3], strict: +m[3] };
      continue;
    }
    m = /^(?:int|float)\s+(\w+)\s*=\s*([\d.]+)$/.exec(code);
    if (m) out[m[1]] = { loose: +m[2], normal: +m[2], strict: +m[2] };
  }
  return out;
}

function presetsFromMd() {
  const md = fs.readFileSync(MD_PATH, 'utf8');
  const json = /```json\n([\s\S]*?)```/.exec(md)?.[1];
  assert.ok(json, 'json block in presets.json.md');
  const data = JSON.parse(json);
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { loose: v.loose, normal: v.normal, strict: v.strict }]));
}

test('presets.json.md matches SEAM_Patterns.pine §2 exactly', () => {
  const pine = presetsFromPine();
  const md = presetsFromMd();
  assert.ok(Object.keys(pine).length >= 30, `parsed ${Object.keys(pine).length} presets from Pine`);
  assert.deepEqual(md, pine);
});
