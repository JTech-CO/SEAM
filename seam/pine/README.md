# SEAM Patterns (TradingView 지표)

파일: `SEAM_Patterns.pine` (Pine Script v6, overlay 지표)

피벗으로 후보 구조를 찾고, **인식 봉에서 상·하단을 잠그고**, 이후 봉은 그 잠긴 값과 **확정 종가**로만 돌파 · 실패 · 만료를 판정합니다.
정식(formal) 구조만 알림을 보내고, 미달(reference) 구조는 흐리게만 그립니다.

## 설치

1. TradingView → Pine Editor → 새 지표 → `SEAM_Patterns.pine` 전체 붙여넣기 → 저장 → 차트에 추가.
2. 알림: 알림 만들기 → 조건 **SEAM Patterns** → **Any alert() function call** → 알림 동작에서 Webhook URL 에
   `https://<릴레이 도메인>/hook/<SEAM_WEBHOOK_TOKEN>` 입력 (릴레이 설정은 `seam/relay/README.md`).
   메시지 칸은 비워 둡니다. 지표가 JSON 을 직접 만듭니다.
3. 알림은 **만든 시점의 입력값**으로 동작합니다. 민감도 · 토글을 바꾸면 알림을 다시 만드세요.

## 입력

| 그룹 | 입력 | 기본 |
|---|---|---|
| SEAM | 민감도 `loose / normal / strict` | normal |
|  | 표시 개수 `1 / 2 / 3` — 1: 밀착 최고, 2: + 가장 넓은 구조, 3: + 가장 좁은 구조 | 1 |
|  | 미달 구조 흐리게 표시 | on |
|  | 형성 중 미리보기 (점선) | on |
|  | 설명 툴팁 (잠금 다이아몬드에 긴 설명) | off |
| 패턴 가족 | 수축류 / 평행류 / 반전류 | 모두 on |
| 패턴 개별 | 16개 키 각각 | 모두 on |
| 알림 | 확정 알림 (formal · 봉마감만) | on |
|  | lock · break · fail | on |
|  | retest · expire | off |
|  | 봉마감 전 미리보기 알림 (비권장) | off |
| 화면 | 상태 패널 · 확정 로그 | on |
| 색 | 슬롯 1/2/3, 상단 돌파, 하단 이탈, reference, forming | — |

피벗 길이 · ATR 배수 · 최소 폭 같은 수치 입력은 없습니다 (PRINCIPLE 7). 값은 `presets.json.md`.

## 화면

- **formal**: 슬롯 색 실선 2개 + 잠금 봉의 작은 다이아몬드. 툴팁에 `LOCK #번호`, 잠금가, 밀착, 접점.
- **reference**: 같은 선을 흐리게 (알림 없음). 추적이 끝나면 지웁니다.
- **돌파 봉**: `TRI_SYM ↑` / `TRI_SYM ↓` 짧은 라벨. 재시험 · 실패 · 만료도 같은 형식.
- **forming**: 마지막 봉에서만, 아직 오른쪽 봉이 다 닫히지 않은 스윙을 점선으로. 잠금 · 알림 없음.
- **패널 (오른쪽 위)**: 모양 · 고전 · 거리 · 상태 4줄, 필요할 때 주의 / 미달 한 줄.

```
모양  대칭삼각 · 상단까지 0.4ATR
고전  방향 미정
거리  위/아래 = 0.8
상태  LOCK #14 · 접점 3/3 · 밀착 0.72
```

- **확정 로그 (오른쪽 아래)**: 최근 8개 확정 이벤트. 예: `LOCK 03-14 09:00 #14 TRI_SYM 상 221.40 하 214.10`.

## 리페인트 불변식

```
liveUpper(x) = upper + us * (x - lockBar)
liveLower(x) = lower + ls * (x - lockBar)
```

- `upper / lower / us / ls / lockBar` 는 `Seam.new(...)` 에서 한 번만 정해집니다. 이후 대입하는 코드가 없습니다.
- 선 좌표와 돌파 판정은 위 식으로만 계산합니다. 새 피벗이 생겨 더 나은 선이 보이면 **새 구조**로 잠그고 기존 구조는 값을 고치지 않은 채 추적만 끝냅니다.
- 피벗 기록 · 후보 탐지 · 국면 전이 · 확정 알림은 모두 `barstate.isconfirmed` 안에서만 일어납니다.
- 과거 라벨과 formal 선은 지우거나 옮기지 않습니다. 새 이벤트는 새 봉에 새 라벨로 남깁니다.
- 히스토리 로드 시작점이 달라도 워밍업(피벗 몇 개) 뒤에는 같은 봉에서 같은 값으로 잠깁니다.

자동 검증: `seam/tests/engine` (replay prefix · 잠금값 불변 · confirm-on-close 시험).

## 알림 JSON (v1)

"Any alert() function call" 로 한 봉에 여러 이벤트가 있으면 이벤트마다 한 통씩 보냅니다.

```json
{"v":1,"src":"seam","event":"break_up","ticker":"NASDAQ:AAPL","tf":"60","key":"TRI_SYM","grade":"formal","phase":"break_up","lock_ts":1750000000,"bar_ts":1750036000,"upper":221.4,"lower":214.1,"upper_now":220.9,"lower_now":215.3,"close":222,"adhesion":0.74,"touches":[3,3],"bias":"either","reason":null,"preview":false}
```

| 필드 | 뜻 |
|---|---|
| `event` | `lock` `break_up` `break_down` `retest` `fail` `expire` |
| `phase` | 이벤트 뒤 국면: `locked` `break_up` `break_down` `hold_retest` `failed` `expired` |
| `lock_ts` | 잠금 봉 시각 (unix 초). 구조 id = `ticker|tf|key|lock_ts` |
| `bar_ts` | 이벤트 봉 시각 (unix 초) |
| `upper` `lower` | **잠긴 값** (잠금 봉 기준). 구조가 끝날 때까지 모든 이벤트에서 같음 |
| `upper_now` `lower_now` | 잠긴 선을 이벤트 봉까지 연장한 값. 종가를 이것과 비교함 |
| `adhesion` `touches` | 밀착 점수 (0~1), 선별 접점 수 |
| `bias` | 고전 기대 방향 (라벨 정보) |
| `preview` | `true` 면 봉마감 전 미리보기 (기본 꺼짐, 릴레이 기본 drop) |

알림이 나가는 조건: `grade == formal` 이고, lock 은 표시 슬롯에 있을 때, 이후 이벤트는 슬롯에 있거나 이미 lock 을 알린 구조일 때. 시크릿은 JSON 에 없습니다.

## 한계

- TradingView 알림은 종목 · 타임프레임마다 하나씩 만들어야 합니다 (워치리스트 스캐너는 v1.1 후보).
- 오프라인 엔진 두 개(piner · resin)로 컴파일과 동작을 확인했지만 TradingView 컴파일러는 아닙니다. 처음 붙일 때 경고 · 오류가 보이면 그 메시지로 알려 주세요.
- 합성 데이터로 맞춘 시작값입니다. 실차트 사례(`seam/tests/cases.md`)로 조정합니다.
