# 트위터 UI 육성 게임

트위터 UI 기반 턴제 육성 게임. 하루=1턴, 팔로워 임계값 도달 시 스탯·이벤트 이력으로 멀티 엔딩 판정.
전체 설계는 `docs/superpowers/specs/2026-08-17-twitter-game-design.md` — **구조 질문이 생기면 코드 탐색 전에 이 문서부터 읽을 것.**

## 아키텍처 규칙 (불변)

- **바닐라 JS, 빌드 도구 없음, 외부 의존성 없음.** 브라우저에서 index.html을 바로 연다.
- `js/engine.js` — 순수 게임 로직. **DOM을 절대 모름.** Node에서 직접 실행 가능해야 함.
- `js/ui.js` — 렌더링·클릭 처리만. 게임 규칙을 넣지 말 것.
- `js/main.js` — 초기화, 데이터 로드, localStorage 저장.
- `data/*.json` — 모든 게임 콘텐츠(행동·NPC·이벤트·엔딩). **콘텐츠 추가/밸런스 조정은 코드가 아니라 여기서.**
- 엔진 공개 인터페이스는 `advanceTurn(actionId)` 하나. 반환: `{ feedItems, statChanges, triggeredEvents, ending | null }`.

## 작업 효율 (토큰 절약)

- 게임 규칙·수치 관련 작업은 해당 `data/*.json` 파일만 읽으면 됨. js 전체를 읽지 말 것.
- UI 스타일 작업은 `css/style.css`만, 렌더링 버그는 `ui.js`만 보면 됨.
- 검증: `node test/sim.js` (자동 플레이 시뮬레이션). 브라우저 열기 전 이걸로 로직 확인.
- 스탯 5종: 글빨, 유머, 감각, 멘탈, 논란성. 이름·역할은 설계 문서 2절 참고.

## 언어

코드 식별자는 영어, 게임 콘텐츠(JSON 텍스트)와 사용자 대화는 한국어.
