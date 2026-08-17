# 트위터 UI 육성 게임

트위터 UI 기반 턴제 육성 게임. 하루=1턴, 팔로워 임계값 도달 시 스탯·이벤트 이력으로 멀티 엔딩 판정.
전체 설계는 `docs/superpowers/specs/2026-08-17-twitter-game-design.md` — **구조 질문이 생기면 코드 탐색 전에 이 문서부터 읽을 것.**

## 아키텍처 규칙 (불변)

- **바닐라 JS, 빌드 도구 없음, 외부 의존성 없음.** 브라우저에서 index.html을 바로 연다.
- `js/engine.js` — 순수 게임 로직. **DOM을 절대 모름.** Node에서 직접 실행 가능해야 함.
- `js/ui.js` — 렌더링·클릭 처리만. 게임 규칙을 넣지 말 것.
- `js/main.js` — 초기화, 데이터 로드, localStorage 저장.
- `js/icons.js` — lucide 아이콘 SVG path 모음 + `Icons.svg(name, size)` / `Icons.mount()`.
- `data/*.js` — 모든 게임 콘텐츠(행동·NPC·이벤트·엔딩). 순수 데이터 리터럴만, 로직 금지. **콘텐츠 추가/밸런스 조정은 코드가 아니라 여기서.** (json이 아닌 이유: file:// 에서 fetch가 CORS로 막힘)
- 엔진 공개 인터페이스는 `advanceTurn(actionId)` 하나. 반환: `{ feedItems, statChanges, triggeredEvents, ending | null }`.

## UI 규칙 (불변)

- **이모지 금지.** 아이콘이 필요하면 lucide(https://unpkg.com/lucide-static@1.31.0/icons/<name>.svg)에서 받아 `js/icons.js`의 PATHS에 추가하고 `Icons.svg()`로 쓴다.
- **라이트 테마 단일.** 흰 배경이 기본이고 다크모드 대응은 하지 않는다. 색은 `css/style.css`의 `:root` 변수로만.
- 14px 같은 작은 크기에 쓸 아이콘은 path 2~3개짜리 단순한 것만 고른다(복잡한 건 뭉개짐).
- 스탯 패널은 사이드바 하단(새 게임 버튼 위)에 상주. 프로필 화면은 실제 X 구조(배너→겹친 아바타→소개→탭)만 담는다.
- 프로필 탭은 실제 데이터가 있는 것만 만든다(현재 게시물·답글 2개). 빈 탭·죽은 버튼을 모양 때문에 추가하지 말 것.

## 작업 효율 (토큰 절약)

- 게임 규칙·수치 관련 작업은 해당 `data/*.js` 파일만 읽으면 됨. js 전체를 읽지 말 것.
- UI 스타일 작업은 `css/style.css`만, 렌더링 버그는 `ui.js`만 보면 됨.
- 검증: `node test/engine.test.js` + `node test/sim.js` (자동 플레이 시뮬레이션). 브라우저 열기 전 이걸로 로직 확인.
- 스탯 5종: 글빨, 유머, 감각, 멘탈, 논란성. 이름·역할은 설계 문서 2절 참고.

## 언어

코드 식별자는 영어, 게임 콘텐츠 텍스트와 사용자 대화는 한국어.
