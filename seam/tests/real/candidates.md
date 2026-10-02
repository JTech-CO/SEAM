# 사례 후보 (TradingView 확인 전)

오프라인 엔진이 Binance 봉에서 찾은 formal 구조입니다. **아직 사례가 아닙니다.** TradingView 에서 확인한 것만 `cases.md` 3절에 옮깁니다.

- 만든 날: 26-10-02 15:39 한국시간 · 민감도 `normal` · 표시 개수 1
- 기록된 사례 44 / 48 · 키마다 `cases.md` 에 남은 칸만큼, 최신순으로 종목 · TF 를 섞어서 골랐습니다. 이미 기록한 구조는 뺐습니다.
- 명령: `node candidates.mjs BINANCE:BTCUSDT@60@2026-08-20T05:00+09:00 BINANCE:BTCUSDT@240@2026-08-20T05:00+09:00 BINANCE:BTCUSDT@D BINANCE:ETHUSDT@60@2026-08-20T05:00+09:00 BINANCE:ETHUSDT@240@2026-08-20T05:00+09:00 BINANCE:ETHUSDT@D BINANCE:SOLUSDT@60@2026-08-20T05:00+09:00 BINANCE:SOLUSDT@240@2026-08-20T05:00+09:00 BINANCE:SOLUSDT@D BINANCE:BNBUSDT@60@2026-08-20T05:00+09:00 BINANCE:BNBUSDT@240@2026-08-20T05:00+09:00 BINANCE:BNBUSDT@D BINANCE:LTCUSDT@60@2026-08-20T05:00+09:00 BINANCE:LTCUSDT@240@2026-08-20T05:00+09:00 BINANCE:LTCUSDT@D BINANCE:BCHUSDT@60@2026-08-20T05:00+09:00 BINANCE:BCHUSDT@240@2026-08-20T05:00+09:00 BINANCE:BCHUSDT@D BINANCE:AAVEUSDT@60@2026-08-20T05:00+09:00 BINANCE:AAVEUSDT@240@2026-08-20T05:00+09:00 BINANCE:AAVEUSDT@D BINANCE:ETCUSDT@60@2026-08-20T05:00+09:00 BINANCE:ETCUSDT@240@2026-08-20T05:00+09:00 BINANCE:ETCUSDT@D BINANCE:ZECUSDT@60@2026-08-20T05:00+09:00 BINANCE:ZECUSDT@240@2026-08-20T05:00+09:00 BINANCE:ZECUSDT@D BINANCE:COMPUSDT@60@2026-08-20T05:00+09:00 BINANCE:COMPUSDT@240@2026-08-20T05:00+09:00 BINANCE:COMPUSDT@D` (seam/tests/engine, 인터넷 필요)
- 시각은 한국시간, 봉 시작 시각입니다. 차트 시간대를 UTC+9 로 두면 그대로 찾을 수 있습니다.

- BINANCE:BTCUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 12
- BINANCE:BTCUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 1
- BINANCE:BTCUSDT 1D · 봉 3333개 17-08-17 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 46
- BINANCE:ETHUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 5
- BINANCE:ETHUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 2
- BINANCE:ETHUSDT 1D · 봉 3333개 17-08-17 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 57
- BINANCE:SOLUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 18
- BINANCE:SOLUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 0
- BINANCE:SOLUSDT 1D · 봉 2243개 20-08-11 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 34
- BINANCE:BNBUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 10
- BINANCE:BNBUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 6
- BINANCE:BNBUSDT 1D · 봉 3252개 17-11-06 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 42
- BINANCE:LTCUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 10
- BINANCE:LTCUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 3
- BINANCE:LTCUSDT 1D · 봉 3215개 17-12-13 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 35
- BINANCE:BCHUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 9
- BINANCE:BCHUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 5
- BINANCE:BCHUSDT 1D · 봉 2500개 19-11-28 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 42
- BINANCE:AAVEUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 19
- BINANCE:AAVEUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 2
- BINANCE:AAVEUSDT 1D · 봉 2178개 20-10-15 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 30
- BINANCE:ETCUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 18
- BINANCE:ETCUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 2
- BINANCE:ETCUSDT 1D · 봉 3034개 18-06-12 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 42
- BINANCE:ZECUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 14
- BINANCE:ZECUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 4
- BINANCE:ZECUSDT 1D · 봉 2752개 19-03-21 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 36
- BINANCE:COMPUSDT 1H · 봉 1042개 26-08-20 05:00 ~ 26-10-02 14:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 13
- BINANCE:COMPUSDT 4H · 봉 260개 26-08-20 05:00 ~ 26-10-02 09:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 3
- BINANCE:COMPUSDT 1D · 봉 2290개 20-06-25 09:00 ~ 26-10-01 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 39

## 확인 방법

1. TradingView 에서 **후보 줄의 종목 · TF 차트**로 바꿉니다 (예: `BCHUSDT 1H` → `BINANCE:BCHUSDT`, 1시간). 다른 종목 차트에서는 그 후보가 보이지 않습니다. SEAM 은 하나만, 민감도 normal, 표시 개수 1.
2. 날짜로 이동(Alt+G)해 잠금 봉으로 갑니다. 잠금 다이아몬드에 마우스를 올려 툴팁의 잠금가가 아래 표와 같은지 봅니다.
3. 선이 가격에 제대로 붙었는지(접점 · 밀착) 눈으로 판단합니다.
4. 확인 칸에 `OK` / `NG` 와 한 줄 메모를 적어 알려 주시면 `cases.md` 3절로 옮깁니다. 스크린샷이 있으면 더 좋습니다.

무료 요금제의 바 리플레이는 일봉 이상만 됩니다. 1시간 · 4시간 후보는 리플레이 대신 "TradingView 잠금가 = 엔진 잠금가" 로 같은 봉 · 같은 값을 확인합니다 (과거 선은 다시 그려지지 않고, 엔진 대조는 `seam/tests/real` 시험이 확인). 일봉 후보는 바 리플레이로 잠금 봉 전부터 재생해 같은 봉 · 같은 값으로 잠기는지까지 볼 수 있습니다.

## 후보

| # | 키 | 종목 · TF | 잠금 봉 | 잠금 상 / 하 | 이후 이벤트 | 확인 |
|---|---|---|---|---|---|---|
| 1 | `CHANNEL_FLAT` | BCHUSDT 1H | 26-10-02 01:00 | 310.4 / 303.4 | UP 10-02 13:00 | |
|  | `CHANNEL_FLAT` | 후보 1개뿐 (필요 2) — 종목 · TF 를 늘려 다시 찾기 |  |  |  |  |
| 2 | `BOX` | ETCUSDT 1H | 26-09-30 07:00 | 9.35 / 8.96 | DOWN 10-01 02:00 | |
| 3 | `BOX` | ZECUSDT 1H | 26-09-23 07:00 | 1568.13 / 1444.55 | UP 09-23 08:00 | |

## 키별 현황

`미기록 구조` 는 위 구간에서 엔진이 찾은 formal 구조 중 아직 기록하지 않은 수입니다. 한쪽으로 몰리거나 거의 안 나오는 키는 프리셋 조정 후보입니다 (사례 확인 뒤 판단).

| 키 | 기록 | 남은 칸 | 미기록 구조 |
|---|---|---|---|
| `TRI_ASC` 상승삼각 | 3 | 0 | 17 |
| `TRI_DESC` 하락삼각 | 3 | 0 | 21 |
| `TRI_SYM` 대칭삼각 | 3 | 0 | 59 |
| `WEDGE_RISING` 상승쐐기 | 3 | 0 | 32 |
| `WEDGE_FALLING` 하락쐐기 | 3 | 0 | 51 |
| `PENNANT_BULL` 불 페넌트 | 3 | 0 | 40 |
| `PENNANT_BEAR` 베어 페넌트 | 3 | 0 | 76 |
| `CHANNEL_UP` 상승채널 | 3 | 0 | 52 |
| `CHANNEL_DN` 하락채널 | 3 | 0 | 29 |
| `CHANNEL_FLAT` 횡보채널 | 1 | 2 | 1 |
| `BOX` 박스 | 1 | 2 | 44 |
| `FLAG_BULL` 불 플래그 | 3 | 0 | 28 |
| `FLAG_BEAR` 베어 플래그 | 3 | 0 | 50 |
| `CUP_HANDLE` 컵앤핸들 | 3 | 0 | 31 |
| `DOUBLE_BOTTOM` 이중바닥 W | 3 | 0 | 16 |
| `DOUBLE_TOP` 이중천장 M | 3 | 0 | 12 |
