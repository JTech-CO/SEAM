# seam-scanner

TradingView 요금제와 상관없이 같은 규칙으로 같은 알림을 보내는 워치리스트 스캐너입니다. 설계는 [`seam/docs/SCANNER.md`](../docs/SCANNER.md).

```
Binance 현물 닫힌 봉 ─▶ SEAM_Patterns.pine (오프라인 엔진) ─▶ 릴레이 코어 (검증 · 중복 차단 · 문구) ─▶ 텔레그램 DM
```

- TradingView 가 돌리는 것과 **같은 `.pine` 파일**을 돌립니다. 지표를 고치면 스캐너도 같이 바뀝니다.
- 받는 서버가 없습니다. 나가는 연결(Binance · Telegram)만 쓰므로 공인 IP · 도메인 · 인증서가 필요 없습니다.
- 감시 대상은 [`watchlist.json`](watchlist.json) 입니다 (지금: BTCUSDT · ETHUSDT 1시간, 민감도 normal, 표시 개수 1).

## 1. 동작

- 시작하면 종목마다 최근 3000봉을 받아 **워밍업**합니다. 이 구간의 이벤트는 과거라서 보내지 않습니다.
- 봉이 닫히고 **3초 뒤**에 새로 닫힌 봉을 받아 창 전체를 다시 돌리고, 그 봉에서 생긴 이벤트만 보냅니다. 거래소가 봉을 아직 안 주면 5초마다 다시 받습니다 (최대 1분).
- 보내는 이벤트는 지표 알림 기본값과 같습니다: 잠금 · 돌파 · 이탈 · 실패 (formal 만).
- 보낸 것은 `scanner-state.json` 에 적습니다. 재시작해도 다시 보내지 않고, 꺼져 있던 동안 닫힌 봉은 **최근 3봉까지만** 따라잡습니다.
- 문구는 릴레이와 같고 마지막 줄은 항상 `정보일 뿐 주문 아님` 입니다.
- 알림 경로는 하나만 켭니다. TradingView 웹훅 + 릴레이를 같이 켜면 같은 알림이 두 번 옵니다.

## 2. 준비 (Raspberry Pi 5 · Ubuntu Server 24.04 64비트)

```bash
sudo apt update && sudo apt install -y ca-certificates curl git
# Node 22 (Ubuntu 기본 패키지는 버전이 낮음)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v            # v22.18 이상이어야 합니다
timedatectl        # "System clock synchronized: yes" 인지 확인 (봉마감 시각 판정에 씀)
```

```bash
git clone https://github.com/JTech-CO/SEAM.git ~/SEAM
cd ~/SEAM/seam/scanner
npm ci
```

## 3. 텔레그램 봇

1. 텔레그램에서 `@BotFather` → `/newbot` → 이름을 정하면 **봇 토큰**을 줍니다.
2. 만든 봇과 대화를 열고 아무 메시지나 한 번 보냅니다 (봇은 먼저 말을 걸 수 없습니다).
3. 설정 파일을 만듭니다. 토큰은 이 파일에만 둡니다.

```bash
cp .env.example .env
chmod 600 .env
nano .env          # TELEGRAM_BOT_TOKEN= 뒤에 토큰
npm run chat-id    # TELEGRAM_CHAT_ID=... 줄이 나옵니다 → .env 에 붙여 넣기
npm run ping       # 텔레그램에 "SEAM 스캐너 연결 확인" 이 오면 성공
```

## 4. 미리 보기 (보내지 않음)

```bash
npm run show       # 최근 48봉 동안 나갔을 알림을 화면에 출력. 상태 파일은 건드리지 않습니다
npm test           # 녹화한 봉으로 스캐너 루프 시험 (인터넷 불필요)
```

## 5. 상시 실행 (systemd)

[`deploy/seam-scanner.service`](deploy/seam-scanner.service) 는 사용자 `ubuntu`, 저장소 `~/SEAM` 을 가정합니다. 다르면 파일의 `User` 와 경로 두 곳을 고칩니다.

```bash
sudo cp deploy/seam-scanner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now seam-scanner    # 부팅 때 자동 시작 + 지금 시작
systemctl status seam-scanner               # active (running)
journalctl -u seam-scanner -f               # 로그 (봉마다 "bar closed" 한 줄)
```

로그는 JSON 한 줄씩이고 토큰은 `***` 로 가려집니다.

## 6. 업데이트

```bash
cd ~/SEAM && git pull
cd seam/scanner && npm ci
sudo systemctl restart seam-scanner
npm run ping       # 메시지의 "코드 판" 이 TradingView 패널의 SEAM 26.10.05 형식과 같은지 확인
```

## 7. 설정

| 위치 | 내용 |
|---|---|
| `watchlist.json` | `series`: `{ "symbol": "BINANCE:<PAIR>", "tf": "60" }` 목록. `inputs`: 지표 입력 (TradingView 설정 화면의 이름 그대로) |
| `.env` | `TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID` (필수), `SEAM_DRY_RUN` · `SEAM_EVENTS` · `SEAM_STATE_FILE` (선택) |

- TF: `1 3 5 15 30 60 120 240 D W`. 알림용으로는 5분봉 이상을 권장합니다 (1분봉은 잠금 직후 돌파가 잦음).
- 호가 단위가 0.01 보다 작은 종목(XRP 등)은 시작할 때 거부합니다. 0.01 보다 큰 종목(BCH 0.1 등)은 가격을 호가 단위로 맞춰 보냅니다.
- 입력 이름을 잘못 쓰면 시작할 때 바로 오류로 알려 줍니다.

## 8. 라이선스

스캐너는 오프라인 Pine 엔진 `@heyphat/piner` (AGPL-3.0) 를 실행에 씁니다. 본인 기기에서 본인이 쓰는 것은 문제없습니다. 스캐너를 배포하거나 다른 사람에게 서비스로 제공하려면 그 전에 라이선스를 다시 정합니다 (`SCANNER.md` 3.1).
