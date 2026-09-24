## SEAM Pattern Engine

**선이 가격에 붙어야 선이다.**
TradingView 패턴 작도 + 봉마감 확정 + 텔레그램 알림. 주식 · 암호화폐 공통.

피벗으로 후보 구조를 찾고, 인식 봉에서 상 · 하단을 **잠그고**, 이후 봉은 그 잠긴 값과 **확정 종가**로만 돌파 · 실패 · 만료를 판정합니다.
정식(formal) 구조만 알림을 보내고, 미달(reference) 구조는 흐리게만 그립니다.

```
[TradingView]  SEAM Patterns (Pine v6)
      │  alert() JSON  (formal · 봉마감 확정)
      ▼
[seam-relay]   인증 · 스키마 · 중복/과다 차단 · 토픽 라우팅
      │  Telegram Bot API
      ▼
[Telegram]     DM 또는 슈퍼그룹 토픽  #patterns-kr  #patterns-us  #patterns-crypto  #confirmed-only
```

### 패턴 (16개 키)

| 가족 | 키 |
|---|---|
| 수축류 | `TRI_ASC` `TRI_DESC` `TRI_SYM` `WEDGE_RISING` `WEDGE_FALLING` `PENNANT_BULL` `PENNANT_BEAR` |
| 평행류 | `CHANNEL_UP` `CHANNEL_DN` `CHANNEL_FLAT` `BOX` `FLAG_BULL` `FLAG_BEAR` |
| 반전류 | `CUP_HANDLE` `DOUBLE_BOTTOM` `DOUBLE_TOP` |

정의와 판정 규칙: [`seam/docs/PATTERNS.md`](seam/docs/PATTERNS.md)

### 빠른 시작

1. **지표**: [`seam/pine/SEAM_Patterns.pine`](seam/pine/SEAM_Patterns.pine) 를 TradingView Pine Editor 에 붙여넣고 차트에 추가. 사용법은 [`seam/pine/README.md`](seam/pine/README.md).
2. **릴레이**: [`seam/relay`](seam/relay) 를 HTTPS 서버에 배포 (Docker 포함). 설정은 [`seam/relay/README.md`](seam/relay/README.md).
3. **알림**: TradingView 알림 → 조건 "Any alert() function call" → Webhook URL `https://<도메인>/hook/<SEAM_WEBHOOK_TOKEN>`.

### 저장소

| 경로 | 내용 |
|---|---|
| `SEAM-pattern-engine-spec.md` | 개발 브리프 (스펙) |
| `seam/pine/` | 지표 · 프리셋 표 |
| `seam/relay/` | TradingView → 텔레그램 릴레이 (TypeScript, 런타임 의존성 0) |
| `seam/docs/` | [원칙](seam/docs/PRINCIPLES.md) · [패턴](seam/docs/PATTERNS.md) · [면책](seam/docs/DISCLAIMER.md) |
| `seam/tests/` | 오프라인 엔진 회귀 시험 · 실차트 사례 · 브랜드 검사 ([cases.md](seam/tests/cases.md)) |
| `CLAUDE.md` | 에이전트 작업 규칙 |

### 면책

패턴 인식은 기하 조건의 충족을 표시할 뿐 가격을 예측하지 않습니다. 신호는 주문이 아닙니다. 투자 판단과 손익은 이용자 책임입니다.
