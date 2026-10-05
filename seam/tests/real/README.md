# 실차트 대조 자료

TradingView 에서 본 확정 로그를 옮겨 적은 파일(`*.tv.json`)과, 같은 구간의 거래소 봉(`*.klines.json`)을 둡니다.
오프라인 엔진이 같은 봉으로 **같은 잠금값 · 같은 이벤트**를 내는지 보는 자료이며, 스캐너 설계(`seam/docs/SCANNER.md`)의 전제를 확인하는 데 씁니다.

| 파일 | 내용 |
|---|---|
| `btcusdt-1m-2026-09-28.tv.json` | BINANCE:BTCUSDT 1분, 2026-09-28 12:23~13:54 한국시간 확정 로그 8줄 (스크린샷에서 옮김) |
| `ethusdt-1h-2026-09-30.tv.json` | BINANCE:ETHUSDT 1시간, 2026-09-27 05:00~09-30 10:00 확정 로그 8줄 (10-01 18:12 스크린샷, 이후 17:00 봉까지 추가 이벤트 없음) |
| `ethusdt-1h-2026-09-30.klines.json` | 같은 구간 Binance 1시간 봉 3109개. 2026-10-01 대조 8/8 일치 |
| `btcusdt-1h-2026-10-02.tv.json` | BINANCE:BTCUSDT 1시간, 2026-09-25 21:00~10-02 13:00 확정 로그 7줄 (PR #13 이전 판, 10-02 14:59 스크린샷. 가격이 가려진 맨 아래 줄은 뺌) |
| `btcusdt-1h-2026-10-02.klines.json` | 같은 구간 Binance 1시간 봉 3161개. 2026-10-02 대조 7/7 일치 |
| `bchusdt-1h-2026-10-03.tv.json` · `.klines.json` | BINANCE:BCHUSDT 1시간, 09-29 11:00~10-03 03:00 확정 로그 8줄 (PR #13 이전 판, 호가 0.1) + 봉. 8/8 일치 |
| `zecusdt-1h-2026-10-03.tv.json` · `.klines.json` | BINANCE:ZECUSDT 1시간, 09-26 21:00~10-03 03:00 확정 로그 8줄 (PR #13 이전 판) + 봉. 8/8 일치 |
| `bchusdt-1h-2026-10-05.tv.json` · `.klines.json` | BINANCE:BCHUSDT 1시간, 09-30 19:00~10-05 22:00 확정 로그 8줄 (`SEAM 26.10.05`, 접점 2개 박스 #973 포함) + 봉. 8/8 일치 |
| `zecusdt-1h-2026-10-05.tv.json` · `.klines.json` | BINANCE:ZECUSDT 1시간, 09-27 19:00~10-05 22:00 확정 로그 8줄 (`SEAM 26.10.05`) + 봉. 8/8 일치 |
| `aaveusdt-1h-2026-10-05.tv.json` · `.klines.json` | BINANCE:AAVEUSDT 1시간, 09-27 23:00~10-05 22:00 확정 로그 8줄 (`SEAM 26.10.05`) + 봉. 8/8 일치. 맨 아래 줄과 같은 봉의 이벤트 하나는 화면 밖(9번째 줄) |
| `candidates.md` | 사례 후보 목록 (TradingView 확인 전). `candidates.mjs` 로 다시 만듦 |
| `btcusdt-1m-2026-09-28.klines.json` | 같은 구간 Binance 1분 봉 3092개 (로그 첫 줄 3000봉 전부터). 2026-09-30 대조 8/8 일치 |

## 대조 실행 (인터넷 되는 PC, Node 22.18+)

```bash
cd seam/tests/engine
npm ci
node replay.mjs --expect ../real/btcusdt-1m-2026-09-28.tv.json --save ../real/btcusdt-1m-2026-09-28.klines.json
```

- 봉은 Binance 현물 공개 시세(`data-api.binance.vision`, 막히면 `api.binance.com`)에서 받습니다. 키가 필요 없습니다.
- 프록시를 거치는 환경(회사망 · 클라우드 개발 환경)에서는 앞에 `NODE_USE_ENV_PROXY=1` 을 붙입니다.
- 로그 첫 줄보다 3000봉 앞부터 받아 워밍업합니다 (`--warmup` 으로 조정).
- 마지막 줄이 `결과: TradingView 로그와 일치` 면 통과입니다. `PRICE` 는 값 차이, `MISSING` 은 엔진에 없는 이벤트, `EXTRA` 는 로그에 없는 엔진 이벤트입니다.
- 로그는 최근 8줄만 보이므로 `EXTRA` 는 로그 맨 아래 줄 다음에 나온 엔진 이벤트만 셉니다. 같은 봉이라도 맨 아래 줄보다 먼저 나온 이벤트는 화면 밖으로 잘린 것이라 세지 않습니다.
- 받은 `klines.json` 을 커밋하면 이후 `npm test` 가 인터넷 없이 같은 대조를 자동으로 돌립니다.

## 후보 찾기 (cases.md 3절)

```bash
# 여러 종목 · TF 에서 cases.md 에 남은 칸만큼 → candidates.md
# @SINCE = TradingView 에서 스크롤되는 첫 봉 (무료 요금제 분 · 시간봉). 그 뒤 잠금만 뽑고, 계산은 3000봉 앞부터(--lead).
W=2026-08-20T05:00+09:00
A=""; for s in BTCUSDT ETHUSDT SOLUSDT BNBUSDT LTCUSDT BCHUSDT AAVEUSDT ETCUSDT ZECUSDT COMPUSDT; do A="$A BINANCE:$s@60@$W BINANCE:$s@240@$W BINANCE:$s@D"; done
node candidates.mjs $A --out ../real/candidates.md
# 한 종목 · 구간의 이벤트 전체
node replay.mjs --symbol BINANCE:ETHUSDT --tf 60 --from 2026-09-01T00:00+09:00 --to 2026-09-30T00:00+09:00
```

`cases.md` 에 이미 기록한 구조는 자동으로 빠집니다. 호가 단위가 0.01 보다 작은 종목은 `제외` 로 표시됩니다 (`SCANNER.md` 3.1).

`candidates.md` 의 줄, `replay.mjs` 출력의 `LOCK` 줄이 후보입니다. TradingView 에서 그 시각으로 가서 같은 잠금이 보이는지, 선이 가격에 제대로 붙었는지 확인한 뒤 `cases.md` 3절에 적습니다. 오프라인 결과만으로 표를 채우지 않습니다.

## 새 대조 자료 추가

1. TradingView 확정 로그를 스크린샷으로 남깁니다 (차트 시각이 보이게).
2. 같은 형식으로 `<심볼>-<TF>-<날짜>.tv.json` 을 만듭니다. `at` 은 봉 시작 시각(ISO, 시간대 포함), `px` 는 로그의 가격 칸 순서 그대로(LOCK 은 상 · 하), `until` 은 스크린샷 시각입니다.
3. 위 명령으로 `klines.json` 을 받아 둘 다 커밋합니다.

## TradingView 와 오프라인 엔진의 차이 (2026-10-05 확인)

10-03 BCH · ETC · ZEC 1시간 로그로 찾은 두 가지입니다.

1. **피벗 동률 규칙.** TradingView 의 `ta.pivothigh` · `ta.pivotlow` 는 후보와 같은 값이 왼쪽(과거)에 있으면 허용하고 오른쪽(이후)에 있으면 피벗이 아닙니다. 같은 고가가 두 봉이면 뒤 봉이 피벗입니다. piner 는 양쪽 모두 막습니다. 호가가 거친 종목(ETCUSDT: 9달러에 0.01)은 같은 고가 · 저가가 흔해서 결과가 갈렸습니다. 같은 이전 판 코드로 ETC 로그가 엄격 규칙에서는 2/8, TradingView 규칙에서는 8/8 입니다. `harness.mjs` 가 piner 를 TradingView 규칙으로 고쳐 쓰고, `engine.test.mjs` 의 pivots 시험이 이 규칙을 고정합니다.
2. **계산 시작점.** 무료 요금제 1시간봉은 08-20 까지만 스크롤되지만, 지표는 훨씬 앞부터 계산합니다. 로그의 구조 번호(`#877` 등)가 2026-01-01 00:00 UTC 시작일 때 맞습니다 (BTC #877 · ZEC #905 같음, BCH · ETC 1~2 차이). 확정 이벤트는 시작점에 거의 영향을 받지 않아서(`parity survives a later start` 시험) 대조는 3000봉 워밍업으로 충분합니다. 후보도 `candidates.mjs` 가 SINCE 앞 3000봉부터 계산합니다.

이 과정에서 10-02 · 10-03 확인 때 차트에 붙어 있던 코드가 PR #13 이전 판이었다는 것도 드러났습니다. ZEC 1시간 09-23 07:00 박스(접점 2/2)는 새 판에서만 formal 이라 차트에 없었던 것이 맞습니다. ETC 로그는 이전 판에서만 8/8 이고, 현재 판에서는 박스 점수가 올라 09-30 21:00 횡보 채널 교체가 일어나지 않습니다. 그래서 대조 자료에 넣지 않고 현재 판 로그를 다시 찍어 넣습니다.

`*.tv.json` 의 `pine` 칸에는 그 로그를 찍은 코드 판을 적습니다. 2026-10-05 부터 패널 머리글에 판이 보입니다 (`SEAM 26.10.05`, Pine 의 `REV`).

## 지표를 고친 뒤 대조가 깨지면

대조 자료는 **그 로그를 찍은 코드**의 TradingView 동작입니다 (`*.tv.json` 의 `pine`).
판정을 바꾸는 수정(프리셋 조정 등)을 하면 대조가 깨지는 것이 정상일 수 있습니다. 그때는 고친 코드로 TradingView 로그를 다시 찍어 `*.tv.json` 을 바꿉니다. 엔진 출력으로 `*.tv.json` 을 덮어쓰지 않습니다.
