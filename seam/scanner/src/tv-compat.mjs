// Makes the offline Pine engine (piner) behave like TradingView where the two were found to differ on real
// charts (seam/tests/real/README.md). Used by the scanner and by the engine tests, so both run the same rules.
//
// ta.pivothigh / ta.pivotlow: TradingView lets a bar equal to the candidate on the left stand, but one on the
// right vetoes it, so of two equal highs the later one is the pivot. piner vetoes on both sides. Equal highs are
// common on coarse-tick symbols (ETCUSDT 1h: 0.01 tick at ~9 USD), and there the strict rule found other
// structures than the TradingView log.
function tvPivot(isHigh) {
  return function (src, left, right, site) {
    const s = this.st(site, () => ({ buf: [] }));
    s.buf.push(src);
    const win = left + right + 1;
    while (s.buf.length > win) s.buf.shift();
    if (s.buf.length < win) return NaN;
    const center = s.buf[left];
    for (let i = 0; i < win; i++) {
      if (i === left) continue;
      const v = s.buf[i];
      const beyond = isHigh ? (i < left ? v > center : v >= center) : (i < left ? v < center : v <= center);
      if (beyond) return NaN;
    }
    return center;
  };
}

// Patches the given piner module once (its Ta prototype is shared by every engine it creates).
export function applyTradingViewRules({ compile, Engine, ArrayFeed }) {
  const Ta = Object.getPrototypeOf(new Engine(compile('//@version=6\nindicator("ta")\nplot(close)'), new ArrayFeed([])).ctx?.ta ?? {});
  if (typeof Ta.pivothigh !== 'function' || typeof Ta.pivotlow !== 'function' || typeof Ta.st !== 'function') {
    throw new Error('piner layout changed: ta.pivothigh not found, redo the TradingView pivot patch in seam/scanner/src/tv-compat.mjs');
  }
  if (Ta.pivothigh.seamTv) return;
  Ta.pivothigh = Object.assign(tvPivot(true), { seamTv: true });
  Ta.pivotlow = Object.assign(tvPivot(false), { seamTv: true });
}

// piner reads syminfo.mintick correctly but math.round_to_mintick / format.mintick always round to 0.01.
// Detection does not use them (only the alert JSON / tooltip / log text does), so the structures are the same as
// TradingView. Below 0.01 the printed prices are rounded away and cannot be compared; above 0.01 (BCH 0.1) they
// carry extra decimals and are rounded back to the tick before use (seam/docs/SCANNER.md 3.1).
export const ENGINE_PRICE_STEP = 0.01;
export function tickWarning(mintick) {
  return mintick < ENGINE_PRICE_STEP - 1e-12
    ? `호가 단위 ${mintick} < ${ENGINE_PRICE_STEP}: 오프라인 엔진이 출력 가격을 ${ENGINE_PRICE_STEP} 단위로 반올림합니다 (구조 판정은 같음, 가격 비교는 불가)`
    : '';
}
