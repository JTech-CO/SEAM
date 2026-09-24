// SEAM alert payload v1 — Pine `alert()` JSON (spec §5, §8.1).
// Hand-written validator: no runtime dependencies, rejects anything it does not understand.

export const EVENTS = ['lock', 'break_up', 'break_down', 'retest', 'fail', 'expire'] as const;
export const PHASES = ['forming', 'locked', 'break_up', 'break_down', 'hold_retest', 'failed', 'expired'] as const;
export const GRADES = ['formal', 'reference', 'reject'] as const;
export const BIASES = ['up', 'down', 'either'] as const;
export const KEYS = [
  'TRI_ASC', 'TRI_DESC', 'TRI_SYM',
  'WEDGE_RISING', 'WEDGE_FALLING',
  'PENNANT_BULL', 'PENNANT_BEAR',
  'CHANNEL_UP', 'CHANNEL_DN', 'CHANNEL_FLAT',
  'BOX', 'FLAG_BULL', 'FLAG_BEAR',
  'CUP_HANDLE', 'DOUBLE_BOTTOM', 'DOUBLE_TOP',
] as const;

export type SeamEvent = (typeof EVENTS)[number];
export type Phase = (typeof PHASES)[number];
export type Grade = (typeof GRADES)[number];
export type Bias = (typeof BIASES)[number];
export type PatternKey = (typeof KEYS)[number];

export interface SeamAlert {
  v: 1;
  src: 'seam';
  event: SeamEvent;
  ticker: string;        // "EXCHANGE:SYMBOL" (prefix may be absent → routed as OTHER)
  tf: string;            // TradingView timeframe.period ("60", "1D", "1W", ...)
  key: PatternKey;
  grade: Grade;
  phase: Phase;
  lock_ts: number;       // unix seconds of the lock (recognition) bar
  bar_ts?: number;       // unix seconds of the event bar
  upper: number;         // LOCKED upper at lock bar
  lower: number;         // LOCKED lower at lock bar
  upper_now?: number;    // locked line extended to the event bar
  lower_now?: number;
  close: number;
  adhesion: number;      // 0..1
  touches?: [number, number];
  bias?: Bias;
  reason: string | null;
  preview: boolean;
}

export type ParseResult = { ok: true; alert: SeamAlert } | { ok: false; errors: string[] };

const MAX_KEYS = 32;
const TS_MIN = 946684800;   // 2000-01-01
const TS_MAX = 4102444800;  // 2100-01-01
const TICKER_RE = /^([A-Z0-9_]{1,24}:)?[A-Z0-9_.!&-]{1,40}$/i; // EXCHANGE:SYMBOL (prefix optional)
const TF_RE = /^(\d{1,4}[SDWM]?|[SDWM])$/;
const REASON_RE = /^[a-z0-9_]{1,32}$/;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function unixSec(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= TS_MIN && (v as number) <= TS_MAX;
}

export function validateAlert(input: unknown): ParseResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['payload must be a JSON object'] };
  if (Object.keys(input).length > MAX_KEYS) return { ok: false, errors: ['too many keys'] };

  const o = input;
  if (o.v !== 1) errors.push('v must be 1');
  if (o.src !== 'seam') errors.push('src must be "seam"');
  if (!oneOf(EVENTS, o.event)) errors.push('event invalid');
  if (typeof o.ticker !== 'string' || !TICKER_RE.test(o.ticker)) errors.push('ticker invalid');
  if (typeof o.tf !== 'string' || !TF_RE.test(o.tf)) errors.push('tf invalid');
  if (!oneOf(KEYS, o.key)) errors.push('key invalid');
  if (!oneOf(GRADES, o.grade)) errors.push('grade invalid');
  if (!oneOf(PHASES, o.phase)) errors.push('phase invalid');
  if (!unixSec(o.lock_ts)) errors.push('lock_ts must be unix seconds');
  if (o.bar_ts !== undefined && (!unixSec(o.bar_ts) || (unixSec(o.lock_ts) && o.bar_ts < o.lock_ts))) errors.push('bar_ts invalid');
  for (const f of ['upper', 'lower', 'close'] as const) if (!finite(o[f])) errors.push(`${f} must be a finite number`);
  for (const f of ['upper_now', 'lower_now'] as const) if (o[f] !== undefined && !finite(o[f])) errors.push(`${f} must be a finite number`);
  if (finite(o.upper) && finite(o.lower) && o.upper < o.lower) errors.push('upper < lower');
  if (!finite(o.adhesion) || o.adhesion < 0 || o.adhesion > 1) errors.push('adhesion must be 0..1');
  if (o.touches !== undefined) {
    const t = o.touches;
    if (!Array.isArray(t) || t.length !== 2 || !t.every((n) => Number.isInteger(n) && n >= 0 && n <= 999)) errors.push('touches invalid');
  }
  if (o.bias !== undefined && !oneOf(BIASES, o.bias)) errors.push('bias invalid');
  if (o.reason !== null && o.reason !== undefined && (typeof o.reason !== 'string' || !REASON_RE.test(o.reason))) errors.push('reason invalid');
  if (o.preview !== undefined && typeof o.preview !== 'boolean') errors.push('preview must be boolean');

  if (errors.length > 0) return { ok: false, errors };

  const alert: SeamAlert = {
    v: 1,
    src: 'seam',
    event: o.event as SeamEvent,
    ticker: (o.ticker as string).toUpperCase(),
    tf: o.tf as string,
    key: o.key as PatternKey,
    grade: o.grade as Grade,
    phase: o.phase as Phase,
    lock_ts: o.lock_ts as number,
    upper: o.upper as number,
    lower: o.lower as number,
    close: o.close as number,
    adhesion: o.adhesion as number,
    reason: (o.reason as string | null | undefined) ?? null,
    preview: (o.preview as boolean | undefined) ?? false,
  };
  if (o.bar_ts !== undefined) alert.bar_ts = o.bar_ts as number;
  if (o.upper_now !== undefined) alert.upper_now = o.upper_now as number;
  if (o.lower_now !== undefined) alert.lower_now = o.lower_now as number;
  if (o.touches !== undefined) alert.touches = o.touches as [number, number];
  if (o.bias !== undefined) alert.bias = o.bias as Bias;
  return { ok: true, alert };
}

export function parseAlert(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ['body is not valid JSON'] };
  }
  return validateAlert(data);
}

// Structure id per spec §5: `${ticker}|${tf}|${key}|${lockBarTime}`
export function structureId(a: SeamAlert): string {
  return `${a.ticker}|${a.tf}|${a.key}|${a.lock_ts}`;
}

// Idempotency key per spec §8.3: id + event (+ lock_ts, already inside id)
export function idempotencyKey(a: SeamAlert): string {
  return `${structureId(a)}|${a.event}${a.preview ? '|preview' : ''}`;
}
