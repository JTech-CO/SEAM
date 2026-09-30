# 실차트 대조 자료

TradingView 에서 본 확정 로그를 옮겨 적은 파일(`*.tv.json`)과, 같은 구간의 거래소 봉(`*.klines.json`)을 둡니다.
오프라인 엔진이 같은 봉으로 **같은 잠금값 · 같은 이벤트**를 내는지 보는 자료이며, 스캐너 설계(`seam/docs/SCANNER.md`)의 전제를 확인하는 데 씁니다.

| 파일 | 내용 |
|---|---|
| `btcusdt-1m-2026-09-28.tv.json` | BINANCE:BTCUSDT 1분, 2026-09-28 12:23~13:54 한국시간 확정 로그 8줄 (스크린샷에서 옮김) |
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
- 받은 `klines.json` 을 커밋하면 이후 `npm test` 가 인터넷 없이 같은 대조를 자동으로 돌립니다.

## 후보 찾기 (cases.md 3절)

```bash
node replay.mjs --symbol BINANCE:ETHUSDT --tf 60 --from 2026-09-01T00:00+09:00 --to 2026-09-30T00:00+09:00
```

출력되는 `LOCK` 줄이 후보입니다. TradingView 에서 그 시각으로 가서 같은 잠금이 보이는지, 선이 가격에 제대로 붙었는지 확인한 뒤 `cases.md` 3절에 적습니다. 오프라인 결과만으로 표를 채우지 않습니다.

## 새 대조 자료 추가

1. TradingView 확정 로그를 스크린샷으로 남깁니다 (차트 시각이 보이게).
2. 같은 형식으로 `<심볼>-<TF>-<날짜>.tv.json` 을 만듭니다. `at` 은 봉 시작 시각(ISO, 시간대 포함), `px` 는 로그의 가격 칸 순서 그대로(LOCK 은 상 · 하), `until` 은 스크린샷 시각입니다.
3. 위 명령으로 `klines.json` 을 받아 둘 다 커밋합니다.

## 지표를 고친 뒤 대조가 깨지면

대조 자료는 **그 로그를 찍은 코드**의 TradingView 동작입니다 (`*.tv.json` 의 `pine`).
판정을 바꾸는 수정(프리셋 조정 등)을 하면 대조가 깨지는 것이 정상일 수 있습니다. 그때는 고친 코드로 TradingView 로그를 다시 찍어 `*.tv.json` 을 바꿉니다. 엔진 출력으로 `*.tv.json` 을 덮어쓰지 않습니다.
