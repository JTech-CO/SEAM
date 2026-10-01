# SEAM 검증 사례와 체크리스트

두 층으로 검증합니다.

1. **자동 (`seam/tests/engine`)** — 오프라인 Pine 엔진으로 `SEAM_Patterns.pine` 을 합성 OHLC 에 돌려 스펙 11절 불변식을 확인합니다. CI 에서 매 커밋 실행.
2. **수동 (이 문서 3절)** — TradingView 실차트에서 패턴마다 3개씩 손으로 확인합니다 (스펙 10절). 기대 lock 가격은 **차트를 보고 직접** 적습니다.

오프라인 엔진은 TradingView 가 아닙니다. 최종 컴파일 확인은 TradingView 의 "차트에 추가" 입니다.

## 0. TradingView 확인 기록

Pine 을 고친 뒤 TradingView 에서 "차트에 추가" 로 확인하면 한 줄씩 남깁니다.

| 날짜 | 코드 | 종목 · TF | 결과 | 본 것 · 후속 |
|---|---|---|---|---|
| 2026-09-28 | v1 (PR #1) | BINANCE:BTCUSDT · 1분 | 컴파일 · 실행 정상 | 패턴 선 · 잠금 · 돌파 라벨 · 패널 · 로그 표시. 로그 시각이 거래소 시간(UTC)이라 차트(한국시간)와 달라 보임, 재시험 라벨이 돌파 라벨과 겹침, 패널 · 로그 글자가 작음 → 다음 변경에서 수정 |
| 2026-09-28 | 로그 시간대 · 글자 크기 · 라벨 위치 변경 (PR #3) | BINANCE:BTCUSDT · 1분 | 컴파일 · 실행 정상 | 로그 시각이 한국시간으로 차트(UTC+9)와 일치, 패널 · 로그 `보통` 크기로 읽기 좋아짐, 4칸 로그 표와 UP/DOWN 색 정상, `TRI_DESC 재시험` 라벨이 `↓` 라벨 반대쪽(봉 위)에 붙음. 지표가 두 번 추가돼 있었음 → 하나만 두기 |

## 1. 자동 시험 실행

```bash
cd seam/tests/engine
npm ci
npm test
```

| 시험 | 확인하는 것 |
|---|---|
| script compiles | piner 로 컴파일 진단 0 |
| independent compiler | resin 으로도 컴파일 |
| `<KEY>` 시나리오 16개 | 패턴별 합성 차트에서 formal lock 후, 고전 방향 돌파가 잠긴 선 기준 종가로 발생 (시드 3개) |
| Pine ↔ relay contract | 모든 알림 JSON 이 릴레이 스키마 통과 |
| replay prefix | 봉을 덜 넣고 돌린 결과가 전체 결과의 앞부분과 정확히 같음 (과거가 바뀌지 않음) |
| locked values | 한 구조의 모든 이벤트가 같은 잠금 상/하단을 실음 |
| show ≠ signal | 알림은 formal 뿐, reference 표시 on/off 와 무관 |
| toggles | 알림 off → 0개, 가족 off → 해당 키 없음, 이벤트 토글 반영 |
| confirm-on-close | 봉 중간 돌파는 알림 없음(미리보기 켠 경우 `preview:true` 1회), 종가 확정 봉에서만 `break_up` |
| noise | 랜덤워크에서 formal lock 빈도가 과하지 않음 |
| presets | `presets.json.md` 와 Pine 2절 프리셋이 같음 |
| replay | 저장한 봉으로 돌린 결과와 옮겨 적은 로그의 대조 (가격 · 누락 · 추가) |
| parity | `seam/tests/real/` 의 TradingView 로그와 같은 봉으로 돌린 결과가 일치 (봉 파일이 있을 때만) |

## 2. 스펙 11절 체크리스트

`자동` = 위 시험이 확인. `수동` = TradingView 에서 눈으로 확인 후 체크.

리페인트

- [x] lock 이후 상·하단 plot이 과거로 수정되지 않음 — 자동 (replay prefix, locked values)
- [x] replay 시 같은 봉에서 같은 lock — 자동 (replay prefix)
- [ ] 미확정봉 미리보기가 확정 후 사라져도 과거 lock은 남음 — 수동 (Bar Replay 로 확인)

품질

- [ ] 접점 부족한 예쁜 삼각은 reference 또는 없음 — 수동 (3절 사례)
- [ ] 떠 있는 선(가격 미접촉) formal 아님 — 수동
- [x] 쐐기 하단 이탈 / 상승삼각 상단 돌파가 라벨 키와 일치 — 자동 (시나리오)
- [ ] 한 화면에 formal이 설정 N개를 넘지 않음 — 수동 (표시 개수 1/2/3 바꿔 보기)

알림

- [x] reference에서 alert 없음 — 자동
- [x] preview 기본 미전송 — 자동 (Pine 기본 off, 릴레이 기본 drop)
- [x] 텔레그램에 주문형 문구 없음 — 자동 (`relay/test/format.test.ts`)
- [x] 동일 이벤트 재전송 없음 — 자동 (`relay/test/server.test.ts`)

브랜드

- [x] 코드/UI/텔레그램에 경쟁사 명칭 없음 — 자동 (`seam/tests/check-brand.mjs`)
- [x] 차용 문구 없음 — 자동 (같은 스크립트)

## 3. 실차트 사례 (수동)

작성 방법

0. (선택) 후보 찾기: `seam/tests/engine/candidates.mjs` 가 Binance 봉에서 키마다 남은 칸만큼 formal 잠금 후보를 뽑습니다. 최신 목록은 [`real/candidates.md`](real/candidates.md). 후보는 출발점일 뿐이고, 아래 1~3을 TradingView 에서 해야 한 줄이 됩니다.
   - 무료 요금제는 과거 봉을 볼 수 있는 범위가 짧습니다 (2026-10-01 기준 1시간봉은 08-20 05:00 이후). 후보는 `SYMBOL@TF@SINCE` 로 그 범위 안에서만 뽑습니다.
   - 호가 단위가 0.01 보다 작은 종목(XRP · AVAX · LINK 등)은 오프라인 엔진이 출력 가격을 0.01 로 반올림해서 툴팁과 비교할 수 없으므로 후보에서 뺍니다.
1. TradingView 에서 `SEAM Patterns` 를 차트에 추가, 민감도 `normal`, 표시 개수 1.
2. 확정 로그(차트 오른쪽 아래)나 잠금 다이아몬드 툴팁에서 `LOCK #번호`, 상/하 잠금가를 읽습니다.
3. Bar Replay 로 잠금 봉 이전부터 다시 재생해 **같은 봉에서 같은 값으로 잠기는지** 확인합니다. 무료 요금제는 바 리플레이가 일봉 이상만 되므로, 1시간 · 4시간은 "TradingView 잠금가 = 엔진 잠금가(후보 표)" 로 대신하고 `재생 동일` 칸에 `엔진 일치` 라고 적습니다.
4. 아래 표에 채웁니다. 기대값은 재생 전에 눈으로 그린 선의 대략치입니다.

| key | 종목 | TF | 구간 (시작 ~ 잠금 봉) | 기대 잠금 상 / 하 | 실제 잠금 상 / 하 | 등급 | 이후 이벤트 | 재생 동일 | 메모 |
|---|---|---|---|---|---|---|---|---|---|
| TRI_ASC | BINANCE:BTCUSDT | 1H | 26-08-31 01:00 ~ 26-09-01 16:00 | 79183.33 / 78410.29 (엔진 후보 1) | 79183.33 / 78410.29 | formal | DOWN 09-01 17:00 | 엔진 일치 | 툴팁 값 일치, 선 밀착 양호 (2026-10-01 확인) |
| TRI_ASC |  |  |  |  |  |  |  |  |  |
| TRI_ASC |  |  |  |  |  |  |  |  |  |
| TRI_DESC |  |  |  |  |  |  |  |  |  |
| TRI_DESC |  |  |  |  |  |  |  |  |  |
| TRI_DESC |  |  |  |  |  |  |  |  |  |
| TRI_SYM | BINANCE:ETHUSDT | 1H | 26-09-06 23:00 ~ 26-09-08 03:00 | 2499.93 / 2484.31 (엔진 후보 9) | 2499.93 / 2484.31 | formal | DOWN 09-08 07:00 → FAIL 08:00 | 엔진 일치 | 툴팁 값 일치 · 선 확인 (ETH 1H 일괄 확인 2026-10-01) |
| TRI_SYM |  |  |  |  |  |  |  |  |  |
| TRI_SYM |  |  |  |  |  |  |  |  |  |
| WEDGE_RISING | BINANCE:ETHUSDT | 1H | 26-08-23 04:00 ~ 26-08-24 11:00 | 2492.30 / 2435.37 (엔진 후보 11) | 2492.30 / 2435.37 | formal | DOWN 08-24 12:00 → RETEST 13:00 → FAIL 21:00 | 엔진 일치 | 툴팁 값 일치 · 선 확인 (ETH 1H 일괄 확인 2026-10-01) |
| WEDGE_RISING |  |  |  |  |  |  |  |  |  |
| WEDGE_RISING |  |  |  |  |  |  |  |  |  |
| WEDGE_FALLING | BINANCE:ETHUSDT | 1H | 26-09-07 11:00 ~ 26-09-08 20:00 | 2497.25 / 2460.37 (엔진 후보 13) | 2497.25 / 2460.37 | formal | UP 09-09 00:00 → RETEST 01:00 | 엔진 일치 | 툴팁 값 일치 · 선 확인 (ETH 1H 일괄 확인 2026-10-01) |
| WEDGE_FALLING |  |  |  |  |  |  |  |  |  |
| WEDGE_FALLING |  |  |  |  |  |  |  |  |  |
| PENNANT_BULL | BINANCE:ETHUSDT | 1H | 26-09-12 14:00 ~ 26-09-13 13:00 | 2522.95 / 2519.35 (엔진 후보 17) | 2522.95 / 2519.35 | formal | UP 09-13 14:00 → FAIL 15:00 | 엔진 일치 | 툴팁 값 일치 · 선 확인 (ETH 1H 일괄 확인 2026-10-01) |
| PENNANT_BULL |  |  |  |  |  |  |  |  |  |
| PENNANT_BULL |  |  |  |  |  |  |  |  |  |
| PENNANT_BEAR |  |  |  |  |  |  |  |  |  |
| PENNANT_BEAR |  |  |  |  |  |  |  |  |  |
| PENNANT_BEAR |  |  |  |  |  |  |  |  |  |
| CHANNEL_UP | BINANCE:ETHUSDT | 1H | 26-09-28 09:00 ~ 26-09-30 06:00 | 2759.87 / 2673.07 (엔진 후보 22) | 2759.87 / 2673.07 | formal | DOWN 09-30 09:00 → RETEST 10:00 | 엔진 일치 | 툴팁 · 로그 값 일치, 선 밀착 양호 (2026-10-01 확인) |
| CHANNEL_UP |  |  |  |  |  |  |  |  |  |
| CHANNEL_UP |  |  |  |  |  |  |  |  |  |
| CHANNEL_DN |  |  |  |  |  |  |  |  |  |
| CHANNEL_DN |  |  |  |  |  |  |  |  |  |
| CHANNEL_DN |  |  |  |  |  |  |  |  |  |
| CHANNEL_FLAT |  |  |  |  |  |  |  |  |  |
| CHANNEL_FLAT |  |  |  |  |  |  |  |  |  |
| CHANNEL_FLAT |  |  |  |  |  |  |  |  |  |
| BOX |  |  |  |  |  |  |  |  |  |
| BOX |  |  |  |  |  |  |  |  |  |
| BOX |  |  |  |  |  |  |  |  |  |
| FLAG_BULL | BINANCE:ETHUSDT | 1H | 26-08-27 14:00 ~ 26-08-28 13:00 | 2535.53 / 2484.04 (엔진 후보 34) | 2535.53 / 2484.04 | formal | DOWN 08-29 00:00 | 엔진 일치 | 툴팁 값 일치 · 선 확인 (ETH 1H 일괄 확인 2026-10-01) |
| FLAG_BULL |  |  |  |  |  |  |  |  |  |
| FLAG_BULL |  |  |  |  |  |  |  |  |  |
| FLAG_BEAR | BINANCE:ETHUSDT | 1H | 26-09-26 10:00 ~ 26-09-27 08:00 | 2700.68 / 2688.75 (엔진 후보 37) | 2700.68 / 2688.75 | formal | UP 09-27 14:00 → FAIL 23:00 | 엔진 일치 | 로그 값 일치, 후보 22 와 같은 스크린샷에서 선 확인 (2026-10-01) |
| FLAG_BEAR |  |  |  |  |  |  |  |  |  |
| FLAG_BEAR |  |  |  |  |  |  |  |  |  |
| DOUBLE_BOTTOM |  |  |  |  |  |  |  |  |  |
| DOUBLE_BOTTOM |  |  |  |  |  |  |  |  |  |
| DOUBLE_BOTTOM |  |  |  |  |  |  |  |  |  |
| DOUBLE_TOP |  |  |  |  |  |  |  |  |  |
| DOUBLE_TOP |  |  |  |  |  |  |  |  |  |
| DOUBLE_TOP |  |  |  |  |  |  |  |  |  |
| CUP_HANDLE | BINANCE:ETHUSDT | 1H | 26-09-15 05:00 ~ 26-09-19 15:00 | 2646.00 / 2602.94 (엔진 후보 41) | 2646.00 / 2602.94 | formal | UP 09-20 01:00 → RETEST 02:00 → FAIL 11:00 | 엔진 일치 | 툴팁 값 일치 · 선 확인 (ETH 1H 일괄 확인 2026-10-01) |
| CUP_HANDLE |  |  |  |  |  |  |  |  |  |
| CUP_HANDLE |  |  |  |  |  |  |  |  |  |

CLAUDE.md 규칙: 새 패턴은 이 표 3개와 자동 시나리오를 통과하기 전까지 formal 게이트에 넣지 않습니다.
