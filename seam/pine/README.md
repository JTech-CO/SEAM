# SEAM Patterns P0

파일: `SEAM_Patterns.pine`

TradingView → Pine Editor → 붙여넣기 → Add to chart.  
알림: 이 지표 선택 → condition **Any alert() function call**.

## P0가 하는 것

- 민감도 `loose / normal / strict`만 연 입력
- 확정 피벗으로 `BOX`, `TRI_SYM` 후보
- 인식 봉에서 `upper / lower / slope` 고정. 이후 재피팅 없음
- 판정은 잠긴 선을 시간으로 연장한 값과 **종가**만 비교
- `formal`만 `alert()` JSON
- reference는 흐린 선, 알림 없음
- forming은 점선 미리보기. 미리보기 알림 기본 off

## P0가 안 하는 것

삼각 상승/하락, 쐐기, 채널, 플래그, W/M, 컵, 텔레그램 릴레이.

## 불변식

```
liveUpper(t) = upper + upperSlope * (t - lockBar)
liveLower(t) = lower + lowerSlope * (t - lockBar)
```

`lockBar` 이후 `upper`, `lower`, `upperSlope`, `lowerSlope`를 다시 계산하는 코드를 넣지 말 것.

## 알림 JSON

```json
{"v":1,"src":"seam","event":"lock|break_up|break_down|fail|forming","ticker":"...","tf":"...","key":"BOX|TRI_SYM","grade":"formal|reference","phase":"...","lock_ts":0,"upper":0,"lower":0,"close":0,"adhesion":0,"preview":false}
```
