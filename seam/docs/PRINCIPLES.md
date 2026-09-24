# SEAM 설계 원칙

스펙(`SEAM-pattern-engine-spec.md`) 2절 그대로입니다. 구현 중 원칙끼리 충돌하면 번호가 앞선 것이 이깁니다.
코드에는 `// PRINCIPLE:` 주석으로 남아 있습니다.

1. **Confirm-on-close**
   인식·돌파·실패·만료는 `barstate.isconfirmed` 에서만 확정.
   진행 중 봉의 미리보기는 점선/반투명, `alert()` 기본 off.

2. **Lock-on-recognize**
   구조를 인정한 봉의 상단가·하단가·인식시각을 구조 객체에 고정.
   이후 고저가 바뀌어도 선을 다시 피팅하지 않는다.
   다시 그리는 것은 "새 후보"이지 "같은 구조의 수정"이 아니다.

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
   "먼저 끝난 것"을 자동 1순위로 두지 않는다.

6. **Wedge ≠ triangle**
   쐐기는 기울기 방향과 **반대 방향으로 깨지는** 고전 정의로 분리.
   삼각형과 같은 버킷에 넣지 않는다.

7. **No raw numeric playground in v1 UI**
   사용자 입력: 민감도 `{loose, normal, strict}`, 표시 개수 `{1,2,3}`, 패턴 토글, 알림 토글.
   피벗 길이·ATR 배수·최소 폭은 프리셋 테이블에만 존재.

8. **Alerts are facts, not orders**
   알림 문구: "조건 충족 / 경계 고정 / 상단 돌파(종가)".
   "매수하세요" 금지. 텔레그램에도 면책 한 줄.

---

## 코드에서 지키는 자리

| 원칙 | Pine (`seam/pine/SEAM_Patterns.pine`) | 릴레이 · 테스트 |
|---|---|---|
| 1 | 피벗 기록 · 국면 전이 · 후보 탐지 · 확정 알림 전부 `if barstate.isconfirmed` 안 (15절). 미리보기 점선과 `preview:true` 알림만 진행 중 봉에서 (16절) | 릴레이는 `preview` 를 기본으로 버림. `engine.test.mjs` 의 confirm-on-close 시험 |
| 2 | `upper/lower/us/ls/lockBar/lockTime` 은 `Seam.new(...)` 에서 한 번만 정해짐. 이후 대입 없음. 선 좌표는 `f_liveU/f_liveL` (잠긴 식)으로만 계산. 더 나은 겹침 후보는 기존 구조를 **고치지 않고** 추적을 끝낸 뒤 새 id 로 잠금 (`f_admit`). 같은 앵커 조합은 다시 잠그지 않음 (`sigs`) | replay prefix 시험 · 구조별 잠금값 불변 시험 |
| 3 | `f_lineStats` (접점 · 종가 관통), `f_adhesion` (밀착). 접점 부족은 reference, 관통 과다 · 밀착 0.15 미만은 아예 버림 | — |
| 4 | 알림 · 로그 · 돌파 라벨은 `grade == "formal"` 이고 화면 슬롯에 있던(또는 이미 알린) 구조만. reference 는 78% 투명 선, 끝나면 지움 | reference 표시 on/off 에 알림이 같은지 시험. 릴레이도 reference 를 기본으로 버림 |
| 5 | 같은 가족 50% 이상 겹침(또는 가족이 달라도 경계가 사실상 같은 선)은 점수가 `supMargin` 이상 높을 때만 교체. 표시 슬롯: 1 점수 최고 · 2 폭 최대 · 3 높이 최소 | — |
| 6 | `f_classify` 에서 쐐기는 두 선이 같은 방향으로 기울어 수렴할 때만. 고전 방향(`bias`)은 라벨 · 패널 · 페이로드 정보일 뿐 판정에 쓰지 않음 | 시나리오 시험에서 WEDGE_* 가 TRI_* 로 잡히지 않음 |
| 7 | 입력은 민감도 · 표시 개수 · 가족/패턴 토글 · 알림 토글 · 색뿐. 수치는 2절 프리셋 표에만 | `presets.test.mjs` 가 `presets.json.md` 와 대조 |
| 8 | 라벨은 `TRI_SYM ↑` 같은 짧은 사실. 패널 · 로그 툴팁에 면책 | `format.test.ts` 가 모든 키 × 이벤트 문구에서 주문형 단어를 검사. `check-brand.mjs` |
