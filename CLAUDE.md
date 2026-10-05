# SEAM — 에이전트 작업 규칙

SEAM Pattern Engine: TradingView 패턴 작도 + 봉마감 확정 + 텔레그램 알림.
기준 문서는 `SEAM-pattern-engine-spec.md` (스펙), 원칙은 `seam/docs/PRINCIPLES.md`.

## 반드시 지킬 것

1. **원본 제품명 · 카피 금지.** 스펙 1절 · 11절에 적힌 다른 제품명, 배지, 채널, 마케팅 문구를 코드 · UI · 텔레그램 · 문서에 쓰지 않습니다. `node seam/tests/check-brand.mjs` 로 확인.
2. **upper / lower lock 이후 재피팅 금지.** `Seam` 의 `upper lower us ls lockBar lockTime` 은 `Seam.new(...)` 에서만 정합니다. 이후 이 필드에 대입하는 코드를 추가하지 마세요. 더 나은 선은 새 구조(새 id)로 잠급니다.
3. **alert 는 formal + 확정봉만.** 확정 이벤트는 `if barstate.isconfirmed` 안에서만. 봉마감 전 알림은 `preview:true` 로만, 기본 off.
4. **새 패턴은 시험 전까지 formal 게이트에 넣지 않습니다.** `seam/tests/engine/scenarios.mjs` 에 시나리오를 추가해 통과시키고, `seam/tests/cases.md` 실차트 사례 3개를 채우기 전까지 reference 로만 둡니다.
5. **수치 입력을 늘리지 않습니다 (PRINCIPLE 7).** 새 수치는 Pine 2절 프리셋과 `seam/pine/presets.json.md` 에 같은 커밋으로 넣습니다 (`presets.test.mjs` 가 대조).
6. **알림은 사실만 (PRINCIPLE 8).** 매수 · 매도 권유, 목표가, 수익 표현 금지. 텔레그램 마지막 줄은 `정보일 뿐 주문 아님`.
7. **시크릿은 릴레이 env 에만.** Pine · 알림 JSON · 로그 · 커밋에 토큰을 넣지 않습니다.

## 구조

```
seam/pine/SEAM_Patterns.pine   Pine v6 지표 (엔진 전부)
seam/pine/presets.json.md      민감도 프리셋 표 (Pine 2절과 동일해야 함)
seam/relay/                    TypeScript 웹훅 → 텔레그램 릴레이 (런타임 의존성 0)
seam/docs/                     PRINCIPLES · PATTERNS · DISCLAIMER · SCANNER (v1.1 설계)
seam/tests/engine/             오프라인 Pine 엔진(piner, resin)으로 지표를 돌리는 회귀 시험
seam/tests/engine/replay.mjs   거래소 봉으로 지표를 돌려 확정 로그 형식으로 출력 · TradingView 로그와 대조
seam/tests/engine/candidates.mjs  여러 종목 · TF 에서 키마다 사례 후보를 뽑아 tests/real/candidates.md 로
seam/tests/real/               TradingView 로그 옮긴 파일(*.tv.json) + 같은 구간 봉(*.klines.json)
seam/tests/cases.md            실차트 수동 사례 + 스펙 11절 체크리스트
seam/tests/check-brand.mjs     금지 명칭 · 주문형 문구 검사
seam/demo/                     GitHub Pages 데모: build.mjs 가 지표를 봉마다 돌려 site/data.js 생성, site/ 는 뷰어
```

## 명령

```bash
# 릴레이 (Node 22.18+)
cd seam/relay && npm ci && npm run typecheck && npm test && npm run build

# Pine 엔진 회귀 시험
cd seam/tests/engine && npm ci && npm test

# 브랜드 검사
node seam/tests/check-brand.mjs

# 실차트 대조 (인터넷 필요, seam/tests/real/README.md)
cd seam/tests/engine && node replay.mjs --expect ../real/btcusdt-1m-2026-09-28.tv.json --save ../real/btcusdt-1m-2026-09-28.klines.json

# 데모 데이터 (엔진 시험 의존성 설치 후)
node seam/demo/build.mjs
```

## Pine 작업 메모

- Pine v6. 함수 안에서 전역 변수에 `:=` 대입 불가 (배열 · 객체 필드 변경은 가능). 전역 변수는 쓰기 전에 선언되어 있어야 합니다.
- 오프라인 엔진은 TradingView 컴파일러가 아닙니다. 두 엔진 모두 통과해도 TradingView 에서 "차트에 추가" 로 최종 확인이 필요합니다. 확인하면 `seam/tests/cases.md` 0절에 날짜 · 종목 · 결과를 한 줄 남깁니다.
- `seam/tests/real/` 대조 시험은 오프라인 엔진이 TradingView 와 같은 결과를 내는지 봅니다 (BTC 1분 · 1시간, ETH 1시간, BCH · ZEC 1시간 이전 판, BCH · ZEC · AAVE 1시간 `SEAM 26.10.05` — 8건 모두 일치). 판정을 바꾸는 수정으로 깨지면 TradingView 로그를 새로 찍어 `*.tv.json` 을 바꾸고, 엔진 출력으로 덮어쓰지 않습니다.
- 오프라인 엔진(piner)은 `math.round_to_mintick` · `format.mintick` 을 항상 0.01 단위로 반올림합니다. 판정 로직에는 이 함수들을 쓰지 않습니다 (TradingView 와 결과가 갈라짐). `syminfo.mintick` 값 자체는 맞습니다.
- piner 의 `ta.pivothigh` · `ta.pivotlow` 는 같은 값이 양쪽 어디에 있어도 피벗을 막지만, TradingView 는 왼쪽 동률을 허용합니다. `harness.mjs` 가 TradingView 규칙으로 고쳐 쓰므로 piner 는 항상 `harness.mjs` 를 거쳐 씁니다 (`seam/tests/real/README.md`).
- 패널 머리글에 코드 판 `REV` 가 보입니다 (`SEAM 26.10.05`). 판정 · 표시를 바꾸면 `REV` 를 그날 날짜로 바꿉니다. TradingView 확인 기록과 `*.tv.json` 의 `pine` 칸은 화면에 보인 판으로 적습니다.
- 알림 페이로드 필드를 바꾸면 `seam/relay/src/schema.ts` 도 같이 바꾸고, `engine.test.mjs` 의 contract 시험이 통과해야 합니다.
- 합성 시나리오는 스윙을 선 위에 두기 때문에 잡음으로 첫 lock 이 가짜 돌파할 수 있습니다. 시험은 "같은 키의 어떤 lock 이 고전 방향 돌파를 내는가" 로 봅니다.
