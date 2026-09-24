# SEAM 민감도 프리셋

PRINCIPLE 7 (No raw numeric playground): 사용자에게 여는 것은 민감도 `loose / normal / strict` 뿐입니다.
피벗 길이 · ATR 배수 · 최소 폭 같은 수치는 아래 표와 `SEAM_Patterns.pine` 2절에만 있습니다.

- 두 곳은 항상 같아야 합니다. `seam/tests/engine` 의 `presets.test.mjs` 가 이 파일의 JSON 과 Pine 2절을 비교합니다.
- 값을 바꿀 때는 이 파일과 Pine 을 같은 커밋에서 바꾸고, `seam/tests/cases.md` 의 실차트 사례를 다시 확인합니다.
- 단위: `ATR` = `ta.atr(14)` 배수, `봉` = 차트 봉 수, 비율은 0~1.

## 스펙 6.1 시작값과의 관계

| 프리셋 | L/R | 최소 폭 | 최소 접점/선 | 최대 선이격 |
|---|---|---|---|---|
| loose | 3/3 | 8 | 2 | 0.35 ATR |
| normal | 5/5 | 12 | 3 | 0.25 ATR |
| strict | 8/8 | 18 | 3 | 0.15 ATR |

위 네 항목은 스펙 값 그대로입니다. 나머지는 구현하면서 정한 시작값이며 백테스트로 조정합니다.
`minHeight` 는 합성 데이터 시험에서 잡음 수준 구조가 formal 로 올라오는 것을 막으려고 스펙 초안보다 높게 잡았습니다.

## 표

```json
{
  "pivLen":    { "loose": 3,    "normal": 5,    "strict": 8,    "desc": "주 피벗 좌우 봉 (ta.pivothigh/low)" },
  "minorLen":  { "loose": 2,    "normal": 3,    "strict": 4,    "desc": "보조 피벗 좌우 봉. 플래그 · 페넌트 후보와 밀착 계산에 사용" },
  "minWidth":  { "loose": 8,    "normal": 12,   "strict": 18,   "desc": "최소 폭 (봉). 60% 미만은 버리고, 60~100% 는 reference(width_short)" },
  "maxWidth":  { "loose": 90,   "normal": 120,  "strict": 150,  "desc": "최대 폭 (봉). 컵은 2배까지" },
  "minTouch":  { "loose": 2,    "normal": 3,    "strict": 3,    "desc": "선당 최소 접점. 플래그 · 페넌트는 max(2, minTouch-1)" },
  "maxGap":    { "loose": 0.35, "normal": 0.25, "strict": 0.15, "desc": "최대 선 이격 (ATR). 접점 판정 허용치이자 밀착 점수의 분모" },
  "minAdh":    { "loose": 0.45, "normal": 0.55, "strict": 0.65, "desc": "formal 최소 밀착 점수" },
  "minHeight": { "loose": 1.2,  "normal": 1.8,  "strict": 2.5,  "desc": "최소 높이 (ATR, 선 두 개 구조의 넓은 쪽). 플래그 · 페넌트는 절반" },
  "maxViol":   { "loose": 2,    "normal": 1,    "strict": 0,    "desc": "형성 구간에서 종가가 선을 관통해도 되는 봉 수. +2 초과면 버림" },
  "brkBuf":    { "loose": 0.08, "normal": 0.05, "strict": 0.03, "desc": "돌파 버퍼 (ATR). 종가 > 잠긴 상단 + 버퍼 = break_up" },
  "maxKeep":   { "loose": 90,   "normal": 70,   "strict": 50,   "desc": "lock 후 미돌파 유지 최대 봉. 반전류는 min(maxKeep, max(minWidth, 형성 폭))" },
  "postKeep":  { "loose": 20,   "normal": 20,   "strict": 20,   "desc": "돌파 후 재시험 · 실패를 추적하는 봉 수" },
  "retestMax": { "loose": 8,    "normal": 6,    "strict": 3,    "desc": "돌파 후 재시험으로 인정하는 봉 수 (스펙 6.5 의 3~8봉)" },
  "flatR":     { "loose": 0.8,  "normal": 0.6,  "strict": 0.45, "desc": "구조 폭 전체에서 선 변화가 이 값(ATR) 이하면 수평" },
  "boxFlatR":  { "loose": 0.5,  "normal": 0.35, "strict": 0.25, "desc": "박스: 두 선 모두 앵커 쌍 가격차가 이 값(ATR) 이하. 채널보다 빡빡" },
  "convRatio": { "loose": 0.85, "normal": 0.75, "strict": 0.65, "desc": "우측 폭 / 좌측 폭 이 값 이하면 수렴 (삼각 · 쐐기 · 페넌트)" },
  "parTol":    { "loose": 0.3,  "normal": 0.2,  "strict": 0.15, "desc": "|우측 폭 - 좌측 폭| / 큰 폭 이 값 이하면 평행 (채널 · 박스 · 플래그)" },
  "apexAtr":   { "loose": 0.15, "normal": 0.15, "strict": 0.15, "desc": "수렴 구조의 남은 폭이 이 값(ATR) 이하면 expired" },
  "poleMin":   { "loose": 2.5,  "normal": 3.0,  "strict": 3.5,  "desc": "깃대 최소 높이 (ATR)" },
  "poleMaxB":  { "loose": 15,   "normal": 12,   "strict": 10,   "desc": "깃대 최대 봉 수" },
  "poleRatio": { "loose": 1.5,  "normal": 1.5,  "strict": 1.5,  "desc": "깃대 높이 >= 깃 높이 * 1.5 (스펙 6.3)" },
  "flagRetr":  { "loose": 0.62, "normal": 0.5,  "strict": 0.38, "desc": "깃이 깃대를 되돌린 비율 상한" },
  "flagMinW":  { "loose": 5,    "normal": 6,    "strict": 8,    "desc": "플래그 · 페넌트 최소 폭 (봉)" },
  "flagMaxW":  { "loose": 30,   "normal": 25,   "strict": 20,   "desc": "플래그 · 페넌트 최대 폭 (봉)" },
  "peakTol":   { "loose": 0.4,  "normal": 0.3,  "strict": 0.2,  "desc": "W/M 두 피벗 가격차 (ATR). peakPct 와 둘 중 엄격한 쪽 적용" },
  "peakPct":   { "loose": 0.018,"normal": 0.012,"strict": 0.008,"desc": "W/M 두 피벗 가격차 (가격 비율, 스펙의 1.2%)" },
  "wmDepth":   { "loose": 1.5,  "normal": 2.0,  "strict": 2.5,  "desc": "W/M 넥라인까지 깊이 (ATR)" },
  "cupDepth":  { "loose": 2.0,  "normal": 2.5,  "strict": 3.0,  "desc": "컵 최소 깊이 (ATR)" },
  "cupMaxPct": { "loose": 0.5,  "normal": 0.4,  "strict": 0.35, "desc": "컵 깊이 / 립 가격 상한. 넘으면 base_too_deep" },
  "lipTol":    { "loose": 0.25, "normal": 0.2,  "strict": 0.15, "desc": "두 립 가격차 / 컵 깊이" },
  "handleMax": { "loose": 0.5,  "normal": 0.5,  "strict": 0.4,  "desc": "핸들 깊이 / 컵 깊이 (스펙 6.3: 50% 이하)" },
  "supMargin": { "loose": 0.1,  "normal": 0.1,  "strict": 0.1,  "desc": "겹친 구조를 새 후보로 교체하는 데 필요한 점수 우위" }
}
```
