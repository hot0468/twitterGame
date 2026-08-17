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

- **이모지 금지.** 아이콘이 필요하면 lucide(https://unpkg.com/lucide-static@1.31.0/icons/<name>.svg)에서 받아 `js/icons.js`의 PATHS에 추가하고 `Icons.svg(name)`로 쓴다.
- **라이트 테마 단일.** 흰 배경이 기본이고 다크모드 대응은 하지 않는다. 색은 `css/style.css`의 `:root` 변수로만.
- **글씨 최소 12px (하한 불변).** 글씨 크기는 `:root`의 `--fs-xs`~`--fs-xxl`로만 지정한다. 전부 `max(--fs-min, …)`으로 감싸져 있어 스케일 노브를 낮춰도 12px 밑으로 안 내려간다. 규칙에 px/rem font-size를 직접 쓰면 이 하한이 뚫린다 — 새 크기가 필요하면 변수를 추가할 것.
- **스케일 노브는 `html { font-size }`** (`css/style.css` 첫 줄). 크기 조절 요청은 이 값 하나만 바꾼다. 아이콘·아바타·배너도 rem이라 같이 움직인다.
- 검증: `node test/check-css.js` — 하한값·변수 형태·raw font-size 유입을 잡는다. CSS를 만졌으면 이걸 돌릴 것.
- **아이콘 크기도 CSS가 정한다** (`.icon { width: 1.35em }` + 필요한 곳만 rem 오버라이드). `Icons.svg()`에 크기 인자는 없다.
- 작은 크기(13px 내외)에 쓸 아이콘은 path 2~3개짜리 단순한 것만 고른다(brain·dumbbell처럼 복잡한 건 뭉개짐).
- 스탯 패널은 사이드바 하단(새 게임 버튼 위)에 상주. 프로필 화면은 실제 X 구조(배너→겹친 아바타→소개→탭)만 담는다.
- **모바일(≤640px)은 실제 X 앱 구조**: 사이드바 → 하단 고정 탭바, 다음 날 → 우하단 FAB, 스탯 → 타임라인 위 칩 스트립. 사이드바를 좁히는 방식으로 돌아가지 말 것.
- 스탯 마운트 지점이 둘(`[data-stats]` 두 곳)인 이유: 데스크톱은 사이드바 하단, 모바일은 상단 스트립인데 CSS로는 DOM 부모를 옮길 수 없다. ui.js가 두 곳에 같이 렌더하고 CSS가 하나만 보여준다.
- 함정: sticky였던 요소를 모바일에서 `position: fixed; bottom: 0`으로 바꿀 때 `top: auto`를 반드시 같이 준다. 데스크톱의 `top: 0`이 남으면 위아래로 늘어나 화면 전체를 덮고 클릭을 먹는다(실제로 겪음).
- 프로필 탭은 실제 데이터가 있는 것만 만든다(현재 게시물·답글 2개). 빈 탭·죽은 버튼을 모양 때문에 추가하지 말 것.

## 작업 효율 (토큰 절약)

- 게임 규칙·수치 관련 작업은 해당 `data/*.js` 파일만 읽으면 됨. js 전체를 읽지 말 것.
- UI 스타일 작업은 `css/style.css`만, 렌더링 버그는 `ui.js`만 보면 됨.
- 검증: `node test/engine.test.js` + `node test/sim.js` (자동 플레이 시뮬레이션) + `node test/check-css.js` (글씨 하한). 브라우저 열기 전 이걸로 확인.
- 스탯 5종: 글빨, 유머, 감각, 멘탈, 논란성. 이름·역할은 설계 문서 2절 참고.

## 언어

코드 식별자는 영어, 게임 콘텐츠 텍스트와 사용자 대화는 한국어.
