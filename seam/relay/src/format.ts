// Telegram message text (spec §8.2). Plain text only — no parse_mode, so nothing needs escaping.
// PRINCIPLE 8: alerts are facts, not orders. Never add buy/sell wording here.
import type { PatternKey, SeamAlert, SeamEvent } from './schema.ts';

export const KEY_NAMES: Record<PatternKey, string> = {
  TRI_ASC: '상승삼각',
  TRI_DESC: '하락삼각',
  TRI_SYM: '대칭삼각',
  WEDGE_RISING: '상승쐐기',
  WEDGE_FALLING: '하락쐐기',
  PENNANT_BULL: '불 페넌트',
  PENNANT_BEAR: '베어 페넌트',
  CHANNEL_UP: '상승채널',
  CHANNEL_DN: '하락채널',
  CHANNEL_FLAT: '횡보채널',
  BOX: '박스',
  FLAG_BULL: '불 플래그',
  FLAG_BEAR: '베어 플래그',
  CUP_HANDLE: '컵앤핸들',
  DOUBLE_BOTTOM: '이중바닥 W',
  DOUBLE_TOP: '이중천장 M',
};

export const EVENT_TEXT: Record<SeamEvent, string> = {
  lock: '조건 충족 · 경계 고정',
  break_up: '상단 돌파 (종가 확정)',
  break_down: '하단 이탈 (종가 확정)',
  retest: '돌파선 재시험 (종가 확정)',
  fail: '반대 경계 이탈 · 구조 무효 (종가 확정)',
  expire: '만료 · 추적 종료',
};

export const DISCLAIMER_LINE = '정보일 뿐 주문 아님';

// "60" → 1H, "240" → 4H, "15" → 15m, "D"/"1D" → 1D, "W" → 1W, "M" → 1M, "30S" → 30s
export function formatTf(tf: string): string {
  const m = /^(\d*)([SDWM]?)$/.exec(tf);
  if (!m) return tf;
  const n = m[1] === '' ? 1 : Number(m[1]);
  const unit = m[2];
  if (unit === 'S') return `${n}s`;
  if (unit === 'D' || unit === 'W' || unit === 'M') return `${n}${unit}`;
  if (n % 60 === 0) return `${n / 60}H`;
  return `${n}m`;
}

export function formatTicker(ticker: string): string {
  const i = ticker.indexOf(':');
  return i >= 0 ? ticker.slice(i + 1) : ticker;
}

// One format per message so the prices line up: all integers (KRW) → no decimals,
// otherwise 2 decimals for values >= 1 and 4 significant digits below 1 (small crypto).
export function priceFormatter(values: number[]): (v: number) => string {
  const allInt = values.every((v) => Number.isInteger(v));
  return (v) => {
    if (allInt) return String(v);
    if (Math.abs(v) >= 1) return v.toFixed(2);
    return Number(v.toPrecision(4)).toString();
  };
}

export function formatPrice(v: number): string {
  return priceFormatter([v])(v);
}

function differs(a: number | undefined, b: number): a is number {
  return a !== undefined && Math.abs(a - b) > Math.max(Math.abs(b) * 1e-4, 1e-12);
}

export function buildMessage(a: SeamAlert): string {
  const head = `SEAM · ${formatTicker(a.ticker)} ${formatTf(a.tf)}${a.preview ? ' · 미리보기(봉 미확정)' : ''}`;
  const what = `${KEY_NAMES[a.key]} ${EVENT_TEXT[a.event]}`;
  const px = priceFormatter([a.upper, a.lower, a.close, a.upper_now ?? a.upper, a.lower_now ?? a.lower]);
  const lines = [head, what, `잠금가 상 ${px(a.upper)} / 하 ${px(a.lower)}`];
  // Sloped structures: the locked line extended to this bar is what the close was compared against.
  if (a.event !== 'lock' && (differs(a.upper_now, a.upper) || differs(a.lower_now, a.lower))) {
    lines.push(`현재선 상 ${px(a.upper_now ?? a.upper)} / 하 ${px(a.lower_now ?? a.lower)}`);
  }
  const touches = a.touches ? ` · 접점 ${a.touches[0]}/${a.touches[1]}` : '';
  lines.push(`밀착 ${a.adhesion.toFixed(2)}${touches} · ${a.grade} · 종가 ${px(a.close)}`);
  lines.push(DISCLAIMER_LINE);
  return lines.join('\n');
}
