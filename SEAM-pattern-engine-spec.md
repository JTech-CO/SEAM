# SEAM Pattern Engine — Claude Code 개발 브리프

가칭 **SEAM** (선이 가격에 붙어야 선이다).  
목표: TradingView 패턴 작도 + 봉마감 확정 + 텔레그램 알림.  
금지: Lazy Alpha / Lazy Alpha Pattern Finder / LA 배지 / Discord 루프 / SEPA / 카피 문구의 복제.

이 문서는 “원본 클론”이 아니라 **같은 문제(리페인트 작도, 교과서 패턴, 신호 과잉)를 다른 제품으로 푸는 스펙**이다.

---

## 0. 한 줄 정의

피벗으로 후보 구조를 찾고, **인식 봉에서 상·하단을 잠그고**, 이후 봉은 그 잠긴 값으로만 돌파·실패·만료를 판정하는 작도 엔진.  
정식 구조만 알림을 보내고, 미달 구조는 흐리게만 그린다. 배포 채널은 **텔레그램**이다.

---

## 1. 원본과 의도적으로 다르게 갈 것

| 차원 | 하지 말 것 | SEAM이 하는 것 |
|---|---|---|
| 브랜드 | Lazy Alpha, Pattern Finder, LA 배지, 학습모드라는 이름 | SEAM / 결선 / Lockdraft 등 별도 이름 |
| 채널 | Discord 일일 루프, Whop 카피 | Telegram Bot API + 토픽/그룹 |
| 범위 | 진입·청산 올인원 + SEPA 5축 + PEG + 시황 브리핑을 한 방에 | **v1은 패턴 작도만.** 추세 시그널 지표는 후속 |
| UX | “차트에 남는 건 진입과 청산 두 개” | 패턴 경계 + 상태 칩 + 확정 로그 |
| 설정 | 민감도만 열고 나머진 숨김을 그대로 복제 | 민감도 프리셋 + **패턴 on/off** + 확정만/미리보기 |
| 카피 | 교과서 패턴 열다섯을 같은 순서·같은 별칭으로 | 아래 분류명 사용. 영문 코드는 `SEAM_*` |

법적 메모: 삼각형·쐐기·컵핸들은 공공 도메인의 차트 기법이다. 베끼는 것은 **문구, 패널 문장, 배지 연동, invite-only 소스**다.

---

## 2. 설계 원칙 (코드에 상수로 박을 것)

원칙은 주석과 `// PRINCIPLE:` 로 남긴다. 구현 중 충돌하면 아래 순서로 이긴다.

1. **Confirm-on-close**  
   인식·돌파·실패·만료는 `barstate.isconfirmed` 에서만 확정.  
   진행 중 봉의 미리보기는 점선/반투명, `alert()` 기본 off.

2. **Lock-on-recognize**  
   구조를 인정한 봉의 상단가·하단가·인식시각을 구조 객체에 고정.  
   이후 고저가 바뀌어도 선을 다시 피팅하지 않는다.  
   다시 그리는 것은 “새 후보”이지 “같은 구조의 수정”이 아니다.

3. **Touch or it is not a line**  
   추세선·채널선은 최소 접점 수와 최대 이격(ATR 또는 %)를 통과해야 한다.  
   가격을 한 번도 건드리지 않은 선은 `grade=reject` 또는 표시 금지.

4. **Show ≠ Signal**  
   `grade=formal` : 실선 + 알림 가능.  
   `grade=reference` : 흐린 선, 알림 없음.  
   미달 이유는 패널 한 줄 (`too_few_touches`, `line_float`, `base_too_deep`, `origin_mismatch`, `rr_lt_1`).

5. **Pick adhesion, not size or speed**  
   한 구간에 후보가 겹치면 1순위는 **선-가격 밀착 점수**.  
   2순위(옵션): 가장 오래 형성된 큰 구조.  
   3순위(옵션): 가장 좁은 구조.  
   “먼저 끝난 것”을 자동 1순위로 두지 않는다.

6. **Wedge ≠ triangle**  
   쐐기는 기울기 방향과 **반대 방향으로 깨지는** 고전 정의로 분리.  
   삼각형과 같은 버킷에 넣지 않는다.

7. **No raw numeric playground in v1 UI**  
   사용자 입력: 민감도 `{loose, normal, strict}`, 표시 개수 `{1,2,3}`, 패턴 토글, 알림 토글.  
   피벗 길이·ATR 배수·최소 폭은 프리셋 테이블에만 존재.

8. **Alerts are facts, not orders**  
   알림 문구: “조건 충족 / 경계 고정 / 상단 돌파(종가)”.  
   “매수하세요” 금지. 텔레그램에도 면책 한 줄.

---

## 3. 제품 구성 (v1 범위)

```
[TradingView Pine v5]  SEAM Patterns
        | alert() JSON
        v
[Worker]  seam-relay  (Node or Python)
        | Telegram Bot API
        v
[Telegram]  개인 DM 또는 슈퍼그룹 토픽
              #patterns-kr  #patterns-us  #patterns-crypto
              #confirmed-only
```

v1에 넣지 말 것: 회원 결제, Whop, Discord, SEPA 점수, 뉴스/옵션 LLM, 자동매매 주문.

v1.1 후보: 워치리스트 스캐너(자체 OHLC로 동일 규칙 재실행). TradingView 알림 한도를 우회하려면 이때 간다.

---

## 4. 패턴 카탈로그 (코드 키)

표시 이름은 한글, 내부 enum은 영문. 원본 마케팅 별칭을 쓰지 말 것.

### 4.1 수축·돌파 (선 두 개)

| key | 한글 | 잠그는 것 | 고전 기대 |
|---|---|---|---|
| `TRI_ASC` | 상승삼각 | 수평 저항 + 상승 지지 | 상단 돌파 |
| `TRI_DESC` | 하락삼각 | 수평 지지 + 하락 저항 | 하단 이탈 |
| `TRI_SYM` | 대칭삼각 | 하락 저항 + 상승 지지 | 어느 쪽이든 돌파, 방향 예측 안 함 |
| `WEDGE_RISING` | 상승쐐기 | 둘 다 상승, 수렴 | 하단 이탈이 고전 |
| `WEDGE_FALLING` | 하락쐐기 | 둘 다 하락, 수렴 | 상단 돌파가 고전 |
| `PENNANT_BULL` | 불 페넌트 | 급등 깃대 후 작은 삼각 | 상단 돌파 |
| `PENNANT_BEAR` | 베어 페넌트 | 급락 깃대 후 작은 삼각 | 하단 이탈 |

### 4.2 평행·박스

| key | 한글 | 잠그는 것 |
|---|---|---|
| `CHANNEL_UP` | 상승채널 | 평행 상승 두 선 |
| `CHANNEL_DN` | 하락채널 | 평행 하락 두 선 |
| `CHANNEL_FLAT` | 횡보채널 | 거의 수평 평행 |
| `BOX` | 박스 | 수평 상·하단 (채널보다 기울기 허용 더 빡셈) |
| `FLAG_BULL` | 불 플래그 | 급등 깃대 + 약한 하락/횡보 평행 |
| `FLAG_BEAR` | 베어 플래그 | 급락 깃대 + 약한 상승/횡보 평행 |

### 4.3 반전 피벗

| key | 한글 | 잠그는 것 |
|---|---|---|
| `CUP_HANDLE` | 컵앤핸들 | 컵 립 고점, 핸들 하단, 립 라인 |
| `DOUBLE_BOTTOM` | 이중바닥 W | 두 저점, 넥라인 |
| `DOUBLE_TOP` | 이중천장 M | 두 고점, 넥라인 |

v1에서 빼도 되는 것: 헤드앤숄더, 하모닉. 피벗 정의가 달라 오탐이 많다. v2.

---

## 5. 데이터 모델

Pine과 relay가 같은 필드를 쓴다.

```ts
type Grade = "formal" | "reference" | "reject";
type Phase =
  | "forming"      // 아직 잠그기 전, 미리보기만
  | "locked"       // 인식 확정, 경계 고정
  | "break_up"     // 잠긴 상단을 확정 종가가 돌파
  | "break_down"
  | "hold_retest"  // 돌파 후 잠긴 선 재시험
  | "failed"       // 반대 경계 확정 이탈 또는 무효 조건
  | "expired";     // 최대 봉 수 또는 수렴 과다

interface SeamStructure {
  id: string;            // `${ticker}|${tf}|${key}|${lockBarTime}`
  key: string;
  grade: Grade;
  phase: Phase;
  lockBarTime: number;   // unix, 인식 확정봉
  upper: number;         // LOCKED
  lower: number;         // LOCKED
  upperSlope?: number;   // 삼각/쐐기용, lock 시점 기울기 고정
  lowerSlope?: number;
  touchesUpper: number;
  touchesLower: number;
  adhesion: number;      // 0~1, 선-가격 밀착
  widthBars: number;
  heightAtr: number;
  poleBars?: number;     // flag/pennant
  rejectReason?: string;
  classicBias: "up" | "down" | "either";
  rrHint: number;        // 저항까지 / 지지까지
}
```

**불변식:** `lockBarTime` 이후 `upper`/`lower`(및 slope)를 재계산하지 않는다.  
현재가와의 관계는 “잠긴 선을 시간축으로 연장한 값”과만 비교한다.

```
liveUpper(t) = upper + upperSlope * (t - lockBarTime)
liveLower(t) = lower + lowerSlope * (t - lockBarTime)
```

수평 패턴은 slope = 0.

---

## 6. 작도 파이프라인

매 확정봉:

```
1. pivots = confirmed swing high/low (프리셋 길이)
2. candidates = enumerate pairs/triples of pivots per pattern family
3. geometry filters
     - min/max width (bars)
     - min height (ATR)
     - convergence for triangles/wedges
     - parallelism for channels/flags
     - pole existence + pole/flag size ratio for flag/pennant
     - peak equality tolerance for W/M
     - cup depth + handle depth for cup
4. touch + adhesion score
5. grade = formal if all quality gates else reference or drop
6. if new formal/reference and not overlapping same family:
     LOCK bounds at this bar
7. for each locked structure still active:
     evaluate close vs liveUpper/liveLower
     transition phase
     emit alert only if grade=formal and event in allowlist
8. expire
9. select up to N structures to draw (adhesion desc, then age, then tightness)
```

### 6.1 피벗

- `ta.pivothigh(high, L, R)`, `ta.pivotlow(low, L, R)`
- 민감도 프리셋 예 (v1 시작값, 백테스트로 조정):

| 프리셋 | L/R | 최소 폭 | 최소 접점/선 | 최대 선이격 |
|---|---|---|---|---|
| loose | 3/3 | 8 | 2 | 0.35 ATR |
| normal | 5/5 | 12 | 3 | 0.25 ATR |
| strict | 8/8 | 18 | 3 | 0.15 ATR |

피벗은 오른쪽 `R`봉이 닫혀야 확정. forming 미리보기는 미확정 스윙을 점선으로만.

### 6.2 밀착 점수 adhesion

각 선에 대해, 구간의 고가(저항선) 또는 저가(지지선)와 선 사이 거리의 중앙값 / ATR을 구하고 뒤집는다.

```
gap = median(|price_extreme - line| / ATR)
adhesion = clamp(1 - gap / maxGap, 0, 1)
```

구조 점수 = 두 선의 adhesion 평균 + 접점 보너스.  
1순위 선택 키.

### 6.3 품질 게이트 → formal

모두 참이어야 formal:

- 접점 >= 프리셋
- adhesion >= 0.55 (normal 기준)
- 폭, 높이 범위
- 쐐기/삼각: 수렴 중 (최근 폭 < 초반 폭)
- 플래그: 깃대 높이 >= 깃 높이 * 1.5
- W/M: 두 피벗 가격차 <= 0.3 ATR (또는 1.2%)
- 컵: 핸들 깊이 <= 컵 깊이의 50%
- 시작점 어긋남 없음 (첫 피벗이 구조 밖에 크게 벗어남)

하나라도 실패하면 reference로 그리거나, 심각하면 reject하고 그리지 않음.  
패널에 `rejectReason` 한글 짧은 코드.

### 6.4 겹침

같은 가족(삼각류 / 채널류 / 반전류) 안에서 구간이 50% 이상 겹치면 점수 높은 것만 formal.  
나머지는 끄거나 reference.

표시 개수 설정:

- 1: adhesion 최고
- 2: + 가장 오래된(폭 큰) 것
- 3: + 가장 좁은 것

색은 사용자 입력 3색.

### 6.5 국면 전이 (잠긴 뒤)

종가 기준. 기본 버퍼 = `0.05 * ATR` (프리셋에 묶음).

- `close > liveUpper + buf` → `break_up`
- `close < liveLower - buf` → `break_down`
- 돌파 후 3~8봉 안에 잠긴 선으로 돌아와 종가가 다시 안쪽이면 `hold_retest` 후 유지/실패
- 반대 경계가 먼저 깨지면 `failed` (특히 쐐기 고전 방향과 반대 돌파는 failed가 아니라 그냥 break — 고전 bias는 라벨에만)
- `widthBars > maxKeep` 또는 폭이 ATR의 극소(수렴 만료) → `expired`

리페인트 금지: phase를 과거 봉 라벨에서 지우지 않는다. 새 봉에 새 라벨.

---

## 7. 화면

최소 UI. LuxAlgo/원본 패널을 베끼지 말 것.

차트:

- formal: 실선 2개 + 잠금 점(작은 다이아몬드) at lock bar
- reference: 같은 선 15~25% opacity, 알림 아이콘 없음
- 돌파 봉: 짧은 라벨 `TRI_SYM ↑` 형식. 문장형 장문 금지
- forming: 점선, 잠금 점 없음

패널 (4줄 이내):

```
모양  대칭삼각 · 상단까지 0.4ATR
고전  방향 미정
거리  위/아래 = 0.8
상태  LOCK #14 · 접점 3/3 · 밀착 0.72
주의  지지 기울기 급함          (있을 때만)
미달  접점 부족                  (reference일 때)
```

학습용 장문은 설정 `explain=true` 일 때만 tooltip. 기본 off.

---

## 8. 알림과 텔레그램

### 8.1 Pine `alert()` 페이로드

하나의 `alert()` 조건, JSON.

```json
{
  "v": 1,
  "src": "seam",
  "event": "lock | break_up | break_down | retest | fail | expire",
  "ticker": "NASDAQ:AAPL",
  "tf": "60",
  "key": "TRI_SYM",
  "grade": "formal",
  "phase": "break_up",
  "lock_ts": 1750000000,
  "upper": 221.4,
  "lower": 214.1,
  "close": 222.0,
  "adhesion": 0.74,
  "reason": null
}
```

기본 on: `lock`, `break_up`, `break_down`, `fail`  
기본 off: `forming`, `expire`, 봉마감 전 미리보기

미리보기 알림을 켜면 페이로드에 `"preview": true`. 릴레이는 기본으로 preview를 버린다.

### 8.2 텔레그램 동작

- Bot token / chat id 는 서버 env. Pine에 시크릿 넣지 않음.
- 메시지 템플릿 (단문):

```
SEAM · AAPL 1H
대칭삼각 상단 돌파 (종가 확정)
잠금가 상 221.40 / 하 214.10
밀착 0.74 · formal
정보일 뿐 주문 아님
```

- 레이트리밋: 같은 `id+event` 중복 드롭. 종목당 분당 3개.
- 세션 라우팅: 거래소로 KR / US / CRYPTO 토픽 분리. 설정 파일.

### 8.3 릴레이 보안 (security-first)

- 웹훅 엔드포인트: HMAC 또는 shared secret 헤더. TradingView IP만 허용하는 것은 보조.
- Body size cap, JSON schema 검증, ticker allowlist(옵션).
- 토큰·챗ID는 `.env`. 로그에 토큰 마스킹.
- Rate limit + idempotency key = `id+event+lock_ts`.

---

## 9. 레포 구조 (Claude Code가 만들 것)

```
seam/
  pine/
    SEAM_Patterns.pine          # 메인
    presets.json.md             # 프리셋 테이블 주석용
  relay/
    src/index.ts
    src/schema.ts
    src/telegram.ts
    src/dedupe.ts
    .env.example
  docs/
    PRINCIPLES.md               # 이 문서 2절 복사
    PATTERNS.md                 # 4절
    DISCLAIMER.md
  CLAUDE.md                     # 에이전트 작업 규칙
```

`CLAUDE.md`에 넣을 규칙:

- 원본 제품명·카피 금지
- upper/lower lock 이후 재피팅 금지
- alert는 formal + 확정봉만
- 새 패턴 추가 시 테스트 체크리스트 통과 전까지 formal 게이트에 넣지 말 것

---

## 10. 구현 순서 (Claude Code 작업 단위)

### P0 — 골격 (1차 커밋)

1. 피벗 + 미리보기 점선
2. `BOX` 와 `TRI_SYM` 만
3. lock / break / expire 상태머신
4. formal vs reference
5. `alert()` JSON
6. 민감도 프리셋 3개

완료 조건: 히스토리에서 선이 미래에 다시 움직이지 않는다. 봉을 재생해도 lock 가격이 같다.

### P1 — 패턴 확대

7. TRI_ASC, TRI_DESC  
8. WEDGE_RISING, WEDGE_FALLING (삼각과 분류 분리 테스트)  
9. CHANNEL_*, BOX 구분  
10. FLAG_*, PENNANT_* (깃대 탐지가 핵심)  
11. DOUBLE_TOP/BOTTOM  
12. CUP_HANDLE  

패턴마다 `tests/cases.md`에 종목·타임프레임·기대 lock 가격 대략치를 손으로 3개씩.

### P2 — 텔레그램 릴레이

13. 웹훅 서버 + 스키마  
14. 텔레그램 전송 + 중복 제거  
15. preview 드롭  
16. 토픽 라우팅  

### P3 — 다듬기

17. 겹침 선택 1/2/3  
18. 패널 4줄  
19. 색/표시 개수 입력  
20. 면책 및 알림 문구 점검  

---

## 11. 검증 체크리스트

리페인트

- [ ] lock 이후 상·하단 plot이 과거로 수정되지 않음
- [ ] replay 시 같은 봉에서 같은 lock
- [ ] 미확정봉 미리보기가 확정 후 사라져도 과거 lock은 남음

품질

- [ ] 접점 부족한 예쁜 삼각은 reference 또는 없음
- [ ] 떠 있는 선(가격 미접촉) formal 아님
- [ ] 쐐기 하단 이탈 / 상승삼각 상단 돌파가 라벨 키와 일치
- [ ] 한 화면에 formal이 설정 N개를 넘지 않음

알림

- [ ] reference에서 alert 없음
- [ ] preview 기본 미전송
- [ ] 텔레그램에 주문형 문구 없음
- [ ] 동일 이벤트 재전송 없음

브랜드

- [ ] 코드/UI/텔레그램에 경쟁사 명칭 없음
- [ ] “학습 모드” “SEPA” “오늘의 시그널” 같은 차용 문구 없음

---

## 12. 차별 포인트 (후원 카피가 아니라 구현)

원본과 같은 카테고리여도 제품이 달라 보이게 하는 실제 차이.

1. **확정 로그**  
   패널이 아니라 옵션 테이블: `LOCK 09:00 상 221.4` 처럼 최근 8개 이벤트를 차트 코너에 고정. 자동매매·검증용 소스 오브 트루스.

2. **텔레그램 스레드가 차트보다 조용**  
   기본 채널은 `lock`과 `break_*`만. 시황 문장 없음.

3. **패턴 가족 분리 토글**  
   수축류 / 평행류 / 반전류를 한 지표에서 꺼서 화면을 비울 수 있음.

4. **adhesion을 숫자로 노출**  
   “예쁜 작도”가 아니라 밀착 점수. 사용자에게 선택 이유를 숨기지 않음.

5. **v1에 추세 올인원 안 넣음**  
   패턴 엔진이 독립 제품. 나중에 별도 추세 지표를 붙여도 배지 이름·프로토콜은 SEAM 쪽 고유 JSON.

---

## 13. 면책 (Pine 하단 + 텔레그램 + 사이트)

패턴 인식은 기하 조건의 충족을 표시할 뿐 가격을 예측하지 않는다.  
신호는 주문이 아니다. 투자 판단과 손익은 이용자 책임이다.  
불특정 다수에게 동일 규칙을 적용하는 도구이며 개별 투자 권유가 아니다.

한국에서 유료 배포 시: 이용약관, 개인정보 처리방침, 결제/환불, 투자자문업 해당 여부 검토는 출전 전 별도.

---

## 14. Claude Code에게 주는 첫 프롬프트 (복붙)

```
SEAM-pattern-engine-spec.md 를 읽고 pine/SEAM_Patterns.pine 부터 구현해.
v1 P0만: BOX + TRI_SYM, lock-on-recognize, confirm-on-close,
formal/reference, alert JSON.
upper/lower를 lock 이후 재계산하지 말 것.
경쟁사 이름·문구 쓰지 말 것.
민감도는 loose/normal/strict 프리셋만.
완료 후 리페인트 불변식을 어떻게 지켰는지 짧게 설명하고,
다음에 넣을 패턴 순서를 스펙 10절대로 제안해.
```
