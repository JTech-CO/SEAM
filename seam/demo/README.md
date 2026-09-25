# SEAM 데모 (GitHub Pages)

`SEAM_Patterns.pine` 을 합성 차트에 **한 봉씩** 돌린 결과를 재생해 보는 정적 페이지입니다.
서버가 필요 없고, 실시간 알림을 받지 않습니다.

## 무엇을 보여 주나

- 봉마다 지표가 그린 선 · 잠금 다이아몬드 · 돌파 라벨을 그대로 재생합니다. 잠긴 선은 오른쪽으로 연장만 되고 다시 움직이지 않습니다.
- 확정 로그와 각 이벤트의 텔레그램 메시지. 메시지는 릴레이의 `relay/src/format.ts` 로 만든 실제 문구입니다.
- 시나리오: 패턴 15개 (`seam/tests/engine/scenarios.mjs` 와 같은 합성 차트) + 패턴을 넣지 않은 무작위 차트 2개.
- 설정: 민감도 normal, 표시 개수 1, reference 표시, retest / expire 알림 켬.

## 구조

| 파일 | 역할 |
|---|---|
| `build.mjs` | 오프라인 Pine 엔진(piner)으로 지표를 봉마다 실행하고, 선 · 라벨의 변화와 알림을 `site/data.js` 로 저장 |
| `site/index.html` · `style.css` · `app.js` | 저장된 결과를 읽어 SVG 로 그리는 뷰어. 외부 라이브러리 없음 |

엔진은 빌드할 때만 쓰고 페이지에는 싣지 않습니다. 페이지에는 계산 결과(JSON)만 들어갑니다.
빌드는 같은 차트를 한 번에 돌린 결과와 봉마다 돌린 결과가 같은지, 모든 알림이 릴레이 스키마를 통과하는지 확인하고, 다르면 실패합니다.

## 로컬에서 보기

```bash
(cd seam/tests/engine && npm ci)
node seam/demo/build.mjs
cd seam/demo/site && python3 -m http.server 8000
# http://localhost:8000
```

`index.html` 을 파일로 바로 열어도 동작합니다 (`data.js` 를 스크립트로 읽음).

## GitHub Pages 배포

`.github/workflows/pages.yml` 이 main 에 지표 · 데모 · 엔진 시험 · 릴레이 문구가 바뀔 때마다 다시 빌드해서 배포합니다.
PR 에서는 빌드만 합니다.

처음 한 번만 설정이 필요합니다.

1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
2. **Actions → Demo (GitHub Pages) → Run workflow** 로 한 번 실행합니다 (또는 main 에 관련 변경을 push).
3. 주소: `https://<계정>.github.io/<저장소>/` (이 저장소는 `https://jtech-co.github.io/SEAM/`).

## 한계

- 합성 데이터이며 TradingView 가 아닙니다. 실제 차트에서의 모습은 TradingView 에 지표를 올려 확인합니다.
- 형성 중 미리보기(점선)는 지표 규칙대로 마지막 봉에서만 보입니다.
- 상태 패널(오른쪽 위 표)은 싣지 않았습니다. 대신 확정 로그와 메시지를 옆에 보여 줍니다.
