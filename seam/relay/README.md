# seam-relay

TradingView `alert()` JSON → 검증 → 중복 · 과다 차단 → 텔레그램.
런타임 의존성 없음 (Node 내장 `http` · `crypto` · `fetch`). TypeScript 는 타입 검사와 빌드에만 씁니다.

```
TradingView (SEAM Patterns, Any alert() function call)
   │  POST https://<도메인>/hook/<SEAM_WEBHOOK_TOKEN>   body = 지표가 만든 JSON
   ▼
seam-relay  인증 → 크기 제한 → 스키마 → preview/reference/이벤트/종목 필터 → 중복 → 종목당 분당 3개
   │  Telegram Bot API sendMessage (plain text)
   ▼
Telegram  DM 또는 슈퍼그룹 토픽 (KR / US / CRYPTO / OTHER + confirmed-only)
```

## 1. 텔레그램 준비

1. `@BotFather` → `/newbot` → 토큰을 받습니다 (`TELEGRAM_BOT_TOKEN`).
2. 받을 곳을 정합니다.
   - **개인 DM**: 봇에게 아무 메시지나 보낸 뒤 `https://api.telegram.org/bot<토큰>/getUpdates` 에서 `message.chat.id` (숫자).
   - **슈퍼그룹 + 토픽**: 그룹 설정에서 토픽(Topics)을 켜고 `#patterns-kr` `#patterns-us` `#patterns-crypto` `#confirmed-only` 토픽을 만든 뒤 봇을 초대해 메시지 보내기 권한을 줍니다.
     각 토픽에 메시지를 하나씩 쓰고 `getUpdates` 에서 `message.chat.id` (`-100...`) 와 `message.message_thread_id` 를 읽습니다.
3. 브라우저 주소창에 토큰이 들어간 URL 을 쓴 뒤에는 기록을 지우고, 토큰이 새면 BotFather `/revoke` 로 바꿉니다.

## 2. 설정

```bash
cp .env.example .env
# SEAM_WEBHOOK_TOKEN 생성
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

필수: `SEAM_WEBHOOK_TOKEN` (또는 `SEAM_HMAC_SECRET`), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
나머지는 `.env.example` 주석 참고. 잘못된 값이 있으면 시작하지 않고 문제를 모두 출력합니다.

| 변수 | 기본 | 설명 |
|---|---|---|
| `TELEGRAM_TOPIC_KR/US/CRYPTO/OTHER` | 없음 | 거래소 접두어로 시장을 나눠 토픽으로 보냄. 없으면 채팅 본문 |
| `TELEGRAM_TOPIC_CONFIRMED` | 없음 | `break_up` / `break_down` 을 이 토픽에도 한 번 더 |
| `SEAM_EVENTS` | `lock,break_up,break_down,fail` | 보낼 이벤트 |
| `SEAM_ALLOW_REFERENCE` / `SEAM_ALLOW_PREVIEW` | false | 미달 구조 · 봉마감 전 미리보기를 보낼지 |
| `SEAM_TICKER_ALLOWLIST` | 없음 | 이 종목만 (`EXCHANGE:SYMBOL`, 쉼표) |
| `SEAM_RATE_PER_MIN` | 3 | 종목당 분당 최대 |
| `SEAM_TV_IP_ONLY` | false | TradingView 웹훅 IP 만 허용 (보조). 프록시 뒤면 `SEAM_TRUST_PROXY=true` |
| `SEAM_DRY_RUN` | false | 텔레그램 대신 로그에만 출력 |

시장 분류 (접두어): KR = `KRX` 등, US = `NASDAQ` `NYSE` `AMEX` `CME` 등, CRYPTO = `BINANCE` `UPBIT` `BYBIT` 등 (`src/route.ts`). 목록에 없는 접두어는 `SEAM_MARKET_PREFIXES=KR=NXT;CRYPTO=LBANK` 식으로 더합니다.

## 3. 로컬 실행 · 시험

Node 22.18 이상 (TypeScript 를 빌드 없이 바로 실행).

```bash
npm ci
npm test            # 47개 시험
npm run typecheck
SEAM_DRY_RUN=true npm run dev
```

다른 터미널에서:

```bash
curl -s -X POST "http://127.0.0.1:8787/hook/$SEAM_WEBHOOK_TOKEN" \
  -d '{"v":1,"src":"seam","event":"lock","ticker":"NASDAQ:AAPL","tf":"60","key":"TRI_SYM","grade":"formal","phase":"locked","lock_ts":1750000000,"upper":221.4,"lower":214.1,"close":218.2,"adhesion":0.74,"reason":null,"preview":false}'
# {"ok":true,"action":"queued","destinations":1}
```

## 4. 배포

TradingView 웹훅은 **80/443 포트의 URL** 만 받습니다. HTTPS 뒤에 두세요.

### Docker + Caddy (VPS 한 대)

```bash
docker build -t seam-relay .
docker run -d --name seam-relay --restart unless-stopped --env-file .env -p 127.0.0.1:8787:8787 seam-relay
```

`/etc/caddy/Caddyfile`

```
relay.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

Caddy 뒤에서 IP 제한을 쓰려면 `.env` 에 `SEAM_TV_IP_ONLY=true`, `SEAM_TRUST_PROXY=true`.

### PaaS (Render · Fly.io · Railway 등)

Dockerfile 로 배포하고 환경 변수를 콘솔에 넣습니다. 헬스체크 경로는 `/healthz`. **인스턴스는 하나만** 둡니다 (중복 차단 기록이 메모리에 있음).

### TradingView

알림 동작 → Webhook URL: `https://relay.example.com/hook/<SEAM_WEBHOOK_TOKEN>`. 메시지 칸은 비워 둡니다.

## 5. HTTP

| 요청 | 응답 |
|---|---|
| `GET /healthz` | 200 `{"ok":true}` |
| `POST /hook/<token>` (또는 `POST /hook` + `X-Seam-Signature: sha256=<hex>`) | 202 `queued` · 200 `dropped` (`preview` `reference` `event` `ticker` `duplicate` `rate_limited`) |
| 인증 실패 | 401 |
| IP 제한 위반 | 403 |
| 본문 과대 | 413 |
| JSON · 스키마 오류 | 400 (본문은 되돌려 보내지 않음) |

`dropped` 는 오류가 아니라 정상 처리 결과라서 200 입니다.

## 6. 보안 메모

- TradingView 는 커스텀 헤더를 못 보내므로 비밀은 URL 경로에 둡니다. HTTPS 에서는 경로도 암호화됩니다. 토큰은 24자 이상, 상수 시간 비교.
- HMAC 헤더는 TradingView 가 아닌 발신자(향후 스캐너 등)용입니다.
- 시크릿은 `.env` 에만. 로그는 봇 토큰 · 웹훅 토큰 · HMAC 비밀을 `***` 로 가립니다.
- 본문 4KB 제한, 스키마 밖 값 거절, 텔레그램은 plain text 전송(HTML 해석 없음).
- 중복 차단 키 = `ticker|tf|key|lock_ts|event`. 기록은 메모리에만 있으므로 재시작하면 초기화됩니다.

## 7. 파일

| 파일 | 역할 |
|---|---|
| `src/index.ts` | 진입점, 서버 · 종료 처리 |
| `src/server.ts` | 요청 처리 순서 |
| `src/schema.ts` | 페이로드 v1 스키마 · 구조 id · 중복 키 |
| `src/format.ts` | 텔레그램 문구 (스펙 8.2 템플릿) |
| `src/route.ts` | 시장 분류 · 토픽 라우팅 |
| `src/dedupe.ts` | 중복 차단 · 종목당 분당 제한 |
| `src/telegram.ts` | 전송 · 채팅별 간격 · 429/5xx 재시도 |
| `src/auth.ts` | 경로 토큰 · HMAC · IP |
| `src/config.ts` | 환경 변수 검증 |
| `src/log.ts` | JSON 로그 · 시크릿 가림 |
