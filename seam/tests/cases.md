# SEAM 검증 사례와 체크리스트

두 층으로 검증합니다.

1. **자동 (`seam/tests/engine`)** — 오프라인 Pine 엔진으로 `SEAM_Patterns.pine` 을 합성 OHLC 에 돌려 스펙 11절 불변식을 확인합니다. CI 에서 매 커밋 실행.
2. **수동 (이 문서 3절)** — TradingView 실차트에서 패턴마다 3개씩 손으로 확인합니다 (스펙 10절). 기대 lock 가격은 **차트를 보고 직접** 적습니다.

오프라인 엔진은 TradingView 가 아닙니다. 최종 컴파일 확인은 TradingView 의 "차트에 추가" 입니다.

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

1. TradingView 에서 `SEAM Patterns` 를 차트에 추가, 민감도 `normal`, 표시 개수 1.
2. 확정 로그(차트 오른쪽 아래)나 잠금 다이아몬드 툴팁에서 `LOCK #번호`, 상/하 잠금가를 읽습니다.
3. Bar Replay 로 잠금 봉 이전부터 다시 재생해 **같은 봉에서 같은 값으로 잠기는지** 확인합니다.
4. 아래 표에 채웁니다. 기대값은 재생 전에 눈으로 그린 선의 대략치입니다.

| key | 종목 | TF | 구간 (시작 ~ 잠금 봉) | 기대 잠금 상 / 하 | 실제 잠금 상 / 하 | 등급 | 이후 이벤트 | 재생 동일 | 메모 |
|---|---|---|---|---|---|---|---|---|---|
| TRI_ASC |  |  |  |  |  |  |  |  |  |
| TRI_ASC |  |  |  |  |  |  |  |  |  |
| TRI_ASC |  |  |  |  |  |  |  |  |  |
| TRI_DESC |  |  |  |  |  |  |  |  |  |
| TRI_DESC |  |  |  |  |  |  |  |  |  |
| TRI_DESC |  |  |  |  |  |  |  |  |  |
| TRI_SYM |  |  |  |  |  |  |  |  |  |
| TRI_SYM |  |  |  |  |  |  |  |  |  |
| TRI_SYM |  |  |  |  |  |  |  |  |  |
| WEDGE_RISING |  |  |  |  |  |  |  |  |  |
| WEDGE_RISING |  |  |  |  |  |  |  |  |  |
| WEDGE_RISING |  |  |  |  |  |  |  |  |  |
| WEDGE_FALLING |  |  |  |  |  |  |  |  |  |
| WEDGE_FALLING |  |  |  |  |  |  |  |  |  |
| WEDGE_FALLING |  |  |  |  |  |  |  |  |  |
| PENNANT_BULL |  |  |  |  |  |  |  |  |  |
| PENNANT_BULL |  |  |  |  |  |  |  |  |  |
| PENNANT_BULL |  |  |  |  |  |  |  |  |  |
| PENNANT_BEAR |  |  |  |  |  |  |  |  |  |
| PENNANT_BEAR |  |  |  |  |  |  |  |  |  |
| PENNANT_BEAR |  |  |  |  |  |  |  |  |  |
| CHANNEL_UP |  |  |  |  |  |  |  |  |  |
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
| FLAG_BULL |  |  |  |  |  |  |  |  |  |
| FLAG_BULL |  |  |  |  |  |  |  |  |  |
| FLAG_BULL |  |  |  |  |  |  |  |  |  |
| FLAG_BEAR |  |  |  |  |  |  |  |  |  |
| FLAG_BEAR |  |  |  |  |  |  |  |  |  |
| FLAG_BEAR |  |  |  |  |  |  |  |  |  |
| DOUBLE_BOTTOM |  |  |  |  |  |  |  |  |  |
| DOUBLE_BOTTOM |  |  |  |  |  |  |  |  |  |
| DOUBLE_BOTTOM |  |  |  |  |  |  |  |  |  |
| DOUBLE_TOP |  |  |  |  |  |  |  |  |  |
| DOUBLE_TOP |  |  |  |  |  |  |  |  |  |
| DOUBLE_TOP |  |  |  |  |  |  |  |  |  |
| CUP_HANDLE |  |  |  |  |  |  |  |  |  |
| CUP_HANDLE |  |  |  |  |  |  |  |  |  |
| CUP_HANDLE |  |  |  |  |  |  |  |  |  |

CLAUDE.md 규칙: 새 패턴은 이 표 3개와 자동 시나리오를 통과하기 전까지 formal 게이트에 넣지 않습니다.
