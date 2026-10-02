# 사례 후보 (TradingView 확인 전)

오프라인 엔진이 Binance 봉에서 찾은 formal 구조입니다. **아직 사례가 아닙니다.** TradingView 에서 확인한 것만 `cases.md` 3절에 옮깁니다.

- 만든 날: 26-10-01 20:31 한국시간 · 민감도 `normal` · 표시 개수 1
- 기록된 사례 9 / 48 · 키마다 `cases.md` 에 남은 칸만큼, 최신순으로 종목 · TF 를 섞어서 골랐습니다. 이미 기록한 구조는 뺐습니다.
- 명령: `node candidates.mjs BINANCE:BTCUSDT@60@2026-08-20T05:00+09:00 BINANCE:BTCUSDT@240@2026-08-20T05:00+09:00 BINANCE:BTCUSDT@D BINANCE:ETHUSDT@60@2026-08-20T05:00+09:00 BINANCE:ETHUSDT@240@2026-08-20T05:00+09:00 BINANCE:ETHUSDT@D BINANCE:SOLUSDT@60@2026-08-20T05:00+09:00 BINANCE:SOLUSDT@240@2026-08-20T05:00+09:00 BINANCE:SOLUSDT@D BINANCE:BNBUSDT@60@2026-08-20T05:00+09:00 BINANCE:BNBUSDT@240@2026-08-20T05:00+09:00 BINANCE:BNBUSDT@D BINANCE:LTCUSDT@60@2026-08-20T05:00+09:00 BINANCE:LTCUSDT@240@2026-08-20T05:00+09:00 BINANCE:LTCUSDT@D BINANCE:BCHUSDT@60@2026-08-20T05:00+09:00 BINANCE:BCHUSDT@240@2026-08-20T05:00+09:00 BINANCE:BCHUSDT@D` (seam/tests/engine, 인터넷 필요)
- 시각은 한국시간, 봉 시작 시각입니다. 차트 시간대를 UTC+9 로 두면 그대로 찾을 수 있습니다.

- BINANCE:BTCUSDT 1H · 봉 1023개 26-08-20 05:00 ~ 26-10-01 19:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 14
- BINANCE:BTCUSDT 4H · 봉 255개 26-08-20 05:00 ~ 26-10-01 13:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 2
- BINANCE:BTCUSDT 1D · 봉 3332개 17-08-17 09:00 ~ 26-09-30 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 44
- BINANCE:ETHUSDT 1H · 봉 1023개 26-08-20 05:00 ~ 26-10-01 19:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 5
- BINANCE:ETHUSDT 4H · 봉 255개 26-08-20 05:00 ~ 26-10-01 13:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 4
- BINANCE:ETHUSDT 1D · 봉 3332개 17-08-17 09:00 ~ 26-09-30 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 53
- BINANCE:SOLUSDT 1H · 봉 1023개 26-08-20 05:00 ~ 26-10-01 19:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 18
- BINANCE:SOLUSDT 4H · 봉 255개 26-08-20 05:00 ~ 26-10-01 13:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 2
- BINANCE:SOLUSDT 1D · 봉 2242개 20-08-11 09:00 ~ 26-09-30 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 32
- BINANCE:BNBUSDT 1H · 봉 1023개 26-08-20 05:00 ~ 26-10-01 19:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 16
- BINANCE:BNBUSDT 4H · 봉 255개 26-08-20 05:00 ~ 26-10-01 13:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 7
- BINANCE:BNBUSDT 1D · 봉 3251개 17-11-06 09:00 ~ 26-09-30 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 40
- BINANCE:LTCUSDT 1H · 봉 1023개 26-08-20 05:00 ~ 26-10-01 19:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 13
- BINANCE:LTCUSDT 4H · 봉 255개 26-08-20 05:00 ~ 26-10-01 13:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 3
- BINANCE:LTCUSDT 1D · 봉 3214개 17-12-13 09:00 ~ 26-09-30 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 35
- BINANCE:BCHUSDT 1H · 봉 1023개 26-08-20 05:00 ~ 26-10-01 19:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 10
- BINANCE:BCHUSDT 4H · 봉 255개 26-08-20 05:00 ~ 26-10-01 13:00 · TradingView 와 같은 첫 봉에서 시작 · 미기록 구조 8
- BINANCE:BCHUSDT 1D · 봉 2499개 19-11-28 09:00 ~ 26-09-30 09:00 · 앞 300봉은 워밍업으로 제외 · 미기록 구조 40

## 확인 방법

1. TradingView 에서 같은 차트(예: `BINANCE:BTCUSDT`, 1시간)에 SEAM 을 하나만 붙입니다. 민감도 normal, 표시 개수 1.
2. 날짜로 이동(Alt+G)해 잠금 봉으로 갑니다. 잠금 다이아몬드에 마우스를 올려 툴팁의 잠금가가 아래 표와 같은지 봅니다.
3. 선이 가격에 제대로 붙었는지(접점 · 밀착) 눈으로 판단합니다.
4. 확인 칸에 `OK` / `NG` 와 한 줄 메모를 적어 알려 주시면 `cases.md` 3절로 옮깁니다. 스크린샷이 있으면 더 좋습니다.

무료 요금제의 바 리플레이는 일봉 이상만 됩니다. 1시간 · 4시간 후보는 리플레이 대신 "TradingView 잠금가 = 엔진 잠금가" 로 같은 봉 · 같은 값을 확인합니다 (과거 선은 다시 그려지지 않고, 엔진 대조는 `seam/tests/real` 시험이 확인). 일봉 후보는 바 리플레이로 잠금 봉 전부터 재생해 같은 봉 · 같은 값으로 잠기는지까지 볼 수 있습니다.

## 후보

| # | 키 | 종목 · TF | 잠금 봉 | 잠금 상 / 하 | 이후 이벤트 | 확인 |
|---|---|---|---|---|---|---|
| 1 | `TRI_ASC` | BNBUSDT 1H | 26-09-15 03:00 | 728.10 / 717.99 | DOWN 09-15 15:00 → RETEST 09-15 19:00 | OK 10-02 → cases.md |
| 2 | `TRI_ASC` | BNBUSDT 1D | 26-01-11 09:00 | 923.28 / 842.92 | UP 01-13 09:00 → RETEST 01-14 09:00 → FAIL 01-30 09:00 | OK 10-02 → cases.md |
| 3 | `TRI_DESC` | BNBUSDT 1H | 26-09-27 02:00 | 775.40 / 770.21 | DOWN 09-27 05:00 → FAIL 09-27 15:00 | OK 10-02 → cases.md |
| 4 | `TRI_DESC` | BCHUSDT 1H | 26-09-21 07:00 | 251.8 / 244.7 | UP 09-21 08:00 → RETEST 09-21 10:00 | OK 10-02 → cases.md |
| 5 | `TRI_DESC` | LTCUSDT 1D | 25-06-18 09:00 | 91.35 / 81.34 | DOWN 06-21 09:00 → RETEST 06-22 09:00 → FAIL 06-29 09:00 | OK 10-02 → cases.md |
| 6 | `TRI_SYM` | BTCUSDT 1H | 26-09-30 03:00 | 84502.01 / 83105.03 | DOWN 09-30 13:00 → RETEST 09-30 15:00 → FAIL 09-30 21:00 | OK 10-02 → cases.md |
| 7 | `TRI_SYM` | ETHUSDT 4H | 26-09-28 01:00 | 2700.11 / 2686.34 | DOWN 09-28 05:00 → RETEST 09-28 09:00 | OK 10-02 → cases.md |
| 8 | `WEDGE_RISING` | BTCUSDT 1H | 26-09-25 21:00 | 85035.77 / 83949.49 | DOWN 09-25 22:00 → RETEST 09-25 23:00 | OK 10-02 → cases.md |
| 9 | `WEDGE_RISING` | SOLUSDT 4H | 26-09-23 01:00 | 121.80 / 116.45 | DOWN 09-23 13:00 → RETEST 09-23 17:00 | OK 10-02 → cases.md |
| 10 | `WEDGE_FALLING` | LTCUSDT 1H | 26-10-01 18:00 | 67.54 / 65.85 | 이후 이벤트 없음 (추적 중이거나 더 나은 구조로 교체됨) | OK 10-02 → cases.md |
| 11 | `WEDGE_FALLING` | BNBUSDT 1H | 26-09-30 07:00 | 764.48 / 749.41 | UP 09-30 14:00 → RETEST 09-30 18:00 | OK 10-02 → cases.md |
| 12 | `PENNANT_BULL` | LTCUSDT 4H | 26-09-27 17:00 | 75.08 / 71.63 | DOWN 09-27 21:00 | OK 10-02 → cases.md |
| 13 | `PENNANT_BULL` | BCHUSDT 4H | 26-09-26 17:00 | 343.5 / 330.1 | UP 09-27 13:00 → RETEST 09-27 17:00 → FAIL 09-27 21:00 | OK 10-02 → cases.md |
| 14 | `PENNANT_BEAR` | LTCUSDT 1H | 26-09-27 18:00 | 72.30 / 71.21 | DOWN 09-27 23:00 → RETEST 09-28 00:00 | OK 10-02 → cases.md |
| 15 | `PENNANT_BEAR` | BCHUSDT 1H | 26-09-27 08:00 | 337.7 / 332.2 | DOWN 09-27 12:00 → RETEST 09-27 13:00 → FAIL 09-27 15:00 | OK 10-02 → cases.md |
| 16 | `PENNANT_BEAR` | BCHUSDT 4H | 26-09-15 17:00 | 229.1 / 219.0 | DOWN 09-16 01:00 → RETEST 09-16 05:00 → FAIL 09-17 21:00 | OK 10-02 → cases.md |
| 17 | `CHANNEL_UP` | SOLUSDT 1H | 26-10-01 03:00 | 123.07 / 118.11 | DOWN 10-01 04:00 → RETEST 10-01 05:00 | OK 10-02 → cases.md |
| 18 | `CHANNEL_UP` | BNBUSDT 1H | 26-09-19 17:00 | 781.21 / 763.60 | DOWN 09-19 19:00 → RETEST 09-20 00:00 | OK 10-02 → cases.md |
| 19 | `CHANNEL_DN` | BCHUSDT 1H | 26-09-30 11:00 | 311.1 / 301.8 | UP 09-30 19:00 → RETEST 09-30 20:00 | OK 10-02 → cases.md |
| 20 | `CHANNEL_DN` | BNBUSDT 4H | 26-09-17 13:00 | 728.25 / 701.70 | UP 09-18 01:00 | OK 10-02 → cases.md |
| 21 | `CHANNEL_DN` | BNBUSDT 1H | 26-09-15 22:00 | 721.83 / 712.75 | UP 09-16 02:00 → FAIL 09-16 10:00 | OK 10-02 → cases.md |
| 22 | `CHANNEL_FLAT` | BCHUSDT 1D | 20-12-28 09:00 | 382.7 / 269.1 | UP 01-03 09:00 → RETEST 01-04 09:00 | OK 10-02 → cases.md |
|  | `CHANNEL_FLAT` | 후보 1개뿐 (필요 3) — 종목 · TF 를 늘려 다시 찾기 |  |  |  |  |
| 23 | `BOX` | BTCUSDT 1D | 20-08-30 09:00 | 12095.41 / 11121.32 | DOWN 09-03 09:00 | OK 10-02 → cases.md |
|  | `BOX` | 후보 1개뿐 (필요 3) — 종목 · TF 를 늘려 다시 찾기 |  |  |  |  |
| 24 | `FLAG_BULL` | LTCUSDT 1H | 26-09-25 20:00 | 71.45 / 69.67 | DOWN 09-26 01:00 → FAIL 09-26 03:00 | OK 10-02 → cases.md |
| 25 | `FLAG_BULL` | SOLUSDT 1H | 26-09-19 21:00 | 111.90 / 110.03 | UP 09-19 23:00 → RETEST 09-20 00:00 | OK 10-02 → cases.md |
| 26 | `FLAG_BEAR` | ETHUSDT 1H | 26-09-26 21:00 | 2697.30 / 2679.84 | DOWN 09-27 05:00 → FAIL 09-27 10:00 | OK 10-02 → cases.md |
| 27 | `FLAG_BEAR` | BNBUSDT 1H | 26-09-17 02:00 | 715.66 / 708.33 | UP 09-17 04:00 | OK 10-02 → cases.md |
| 28 | `CUP_HANDLE` | ETHUSDT 4H | 26-09-21 05:00 | 2668.00 / 2564.33 | UP 09-21 17:00 | OK 10-02 → cases.md |
| 29 | `CUP_HANDLE` | BNBUSDT 4H | 26-09-21 05:00 | 773.76 / 745.90 | UP 09-21 09:00 → RETEST 09-21 17:00 | OK 10-02 → cases.md |
| 30 | `DOUBLE_BOTTOM` | BCHUSDT 1H | 26-09-29 09:00 | 316.3 / 305.0 | DOWN 09-29 11:00 → RETEST 09-29 12:00 | OK 10-02 → cases.md |
| 31 | `DOUBLE_BOTTOM` | LTCUSDT 1H | 26-09-15 03:00 | 54.60 / 53.36 | DOWN 09-15 08:00 | OK 10-02 → cases.md |
| 32 | `DOUBLE_BOTTOM` | BCHUSDT 4H | 26-09-15 01:00 | 234.5 / 219.4 | DOWN 09-16 01:00 → RETEST 09-16 05:00 → FAIL 09-18 09:00 | OK 10-02 → cases.md |
| 33 | `DOUBLE_TOP` | LTCUSDT 1H | 26-09-13 01:00 | 54.33 / 52.85 | EXPIRE 09-13 23:00 | OK 10-02 → cases.md |
| 34 | `DOUBLE_TOP` | BTCUSDT 4H | 26-08-29 05:00 | 81478.87 / 77632.58 | DOWN 08-29 09:00 → RETEST 08-29 13:00 | OK 10-02 → cases.md |
| 35 | `DOUBLE_TOP` | SOLUSDT 4H | 26-08-26 09:00 | 103.08 / 91.34 | UP 08-27 17:00 | OK 10-02 → cases.md |

## 키별 현황

`미기록 구조` 는 위 구간에서 엔진이 찾은 formal 구조 중 아직 기록하지 않은 수입니다. 한쪽으로 몰리거나 거의 안 나오는 키는 프리셋 조정 후보입니다 (사례 확인 뒤 판단).

| 키 | 기록 | 남은 칸 | 미기록 구조 |
|---|---|---|---|
| `TRI_ASC` 상승삼각 | 1 | 2 | 8 |
| `TRI_DESC` 하락삼각 | 0 | 3 | 19 |
| `TRI_SYM` 대칭삼각 | 1 | 2 | 38 |
| `WEDGE_RISING` 상승쐐기 | 1 | 2 | 22 |
| `WEDGE_FALLING` 하락쐐기 | 1 | 2 | 29 |
| `PENNANT_BULL` 불 페넌트 | 1 | 2 | 28 |
| `PENNANT_BEAR` 베어 페넌트 | 0 | 3 | 48 |
| `CHANNEL_UP` 상승채널 | 1 | 2 | 35 |
| `CHANNEL_DN` 하락채널 | 0 | 3 | 15 |
| `CHANNEL_FLAT` 횡보채널 | 0 | 3 | 1 |
| `BOX` 박스 | 0 | 3 | 1 |
| `FLAG_BULL` 불 플래그 | 1 | 2 | 22 |
| `FLAG_BEAR` 베어 플래그 | 1 | 2 | 32 |
| `CUP_HANDLE` 컵앤핸들 | 1 | 2 | 26 |
| `DOUBLE_BOTTOM` 이중바닥 W | 0 | 3 | 11 |
| `DOUBLE_TOP` 이중천장 M | 0 | 3 | 11 |
