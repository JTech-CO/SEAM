#!/usr/bin/env node
// Spec §11 브랜드 · 알림 체크: 코드 · UI · 텔레그램 문구 · 문서에 다른 제품 명칭이나 차용 문구가 없는지 검사.
// 금지어는 스펙 1절 · 11절 목록이며, 이 파일 자체에 이름이 그대로 남지 않도록 base64 로 둔다.
// 원본 브리프(SEAM-pattern-engine-spec.md)는 금지 대상을 설명하는 문서라서 검사하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const BRAND = [
  'bGF6eSBhbHBoYQ==', 'bGF6eWFscGhh', 'cGF0dGVybiBmaW5kZXI=', 'bHV4YWxnbw==', 'c2VwYQ==',
  'd2hvcA==', 'ZGlzY29yZA==', '7ZWZ7Iq1IOuqqOuTnA==', '7ZWZ7Iq166qo65Oc', '7Jik64qY7J2YIOyLnOq3uOuEkA==',
].map((b) => Buffer.from(b, 'base64').toString('utf8'));

// 주문형 문구 (PRINCIPLE 8) — 사용자에게 나가는 문자열이 있는 코드에서만 검사
const ORDER = ['매수하세요', '매도하세요', '지금 사', '지금 파', 'buy now', 'sell now'];

const SCAN = ['README.md', 'CLAUDE.md', 'seam'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
const SKIP_FILES = new Set([path.join(ROOT, 'seam/tests/check-brand.mjs')]);
const TEXT = /\.(pine|md|ts|mjs|js|json|example|yml|yaml)$|Dockerfile$/;
const CODE = /\.(pine|ts)$/;

function* walk(p) {
  const st = fs.statSync(p, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) if (!SKIP_DIRS.has(e)) yield* walk(path.join(p, e));
  } else if (TEXT.test(p) && !SKIP_FILES.has(p)) yield p;
}

const hits = [];
for (const rel of SCAN) {
  for (const file of walk(path.join(ROOT, rel))) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const low = line.toLowerCase();
      for (const term of BRAND) {
        const re = /^[a-z ]+$/.test(term) ? new RegExp(`\\b${term}\\b`) : null;
        if (re ? re.test(low) : low.includes(term)) hits.push(`${path.relative(ROOT, file)}:${i + 1}: brand term`);
      }
      if (CODE.test(file) && !file.includes(`${path.sep}test${path.sep}`)) {
        for (const term of ORDER) if (low.includes(term)) hits.push(`${path.relative(ROOT, file)}:${i + 1}: order wording "${term}"`);
      }
    });
  }
}

if (hits.length) {
  console.error(`check-brand: ${hits.length} hit(s)\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('check-brand: ok');
