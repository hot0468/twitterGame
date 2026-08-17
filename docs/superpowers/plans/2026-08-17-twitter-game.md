# 트위터 UI 육성 게임 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트위터 UI 턴제 육성 게임 — 트윗/자기계발로 스탯을 키우고 팔로워 1만 도달 시 멀티 엔딩.

**Architecture:** 순수 로직 엔진(engine.js, DOM 무지) + JS 데이터 파일(data/*.js) + 렌더링 전용 UI(ui.js/main.js). 엔진은 Node에서 직접 테스트.

**Tech Stack:** 바닐라 JS, 빌드 도구 없음, 의존성 없음. 테스트는 Node 내장 assert.

## Global Constraints

- 빌드 도구·외부 의존성·프레임워크 금지. `index.html`을 file://로 더블클릭해서 실행 가능해야 함.
- **스펙과의 차이 1건:** 데이터는 `data/*.json`이 아니라 `data/*.js` (전역 `GAME_DATA`에 붙이는 순수 리터럴 + Node용 `module.exports`). 이유: file:// 에서 fetch/모듈이 CORS로 차단됨. 파일 내용은 여전히 순수 데이터 리터럴만 허용 — 로직 금지.
- 코드 식별자는 영어, 게임 텍스트·스탯 키는 한국어 (스탯: `글빨, 유머, 감각, 멘탈, 논란성`).
- 스킬 스탯(엔딩 topStat 비교 대상)은 `글빨, 유머, 감각`만. 멘탈·논란성은 자원 스탯.
- 엔진 파일 패턴: 모든 js는 전역 노출 + `if (typeof module !== "undefined") module.exports = ...` (file://와 Node 겸용).
- 테스트 실행: `node test/engine.test.js` (assert 기반, 프레임워크 없음). 실패 시 throw로 즉시 중단.
- 시작 스탯: `{ 글빨:5, 유머:5, 감각:5, 멘탈:50, 논란성:0 }`, 팔로워 10, day 1. 엔딩 임계값: 팔로워 10000.
- 커밋은 태스크마다 1회.

---

### Task 1: 엔진 코어 유틸 (조건 판정 + 수식 평가)

**Files:**
- Create: `js/engine.js`
- Create: `test/engine.test.js`

**Interfaces:**
- Produces: `Engine._utils.compare(actual, expr)`, `Engine._utils.checkCond(cond, state)`, `Engine._utils.evalFormula(expr, state)` — 이후 태스크의 트리거/효과 계산이 전부 이 셋을 사용.
  - `compare(actual: number, expr: number | string) → boolean` — expr 예: `">=30"`, `"<10"`, `30`(숫자면 >=)
  - `checkCond(cond: object, state) → boolean` — cond 키: 스탯명 | `"팔로워"` | `"topStat"` | `"eventDone"`. `"chance"` 키는 무시(트리거 확률은 호출부 담당).
  - `evalFormula(expr: number | string, state) → number` — `"유머*3 + 글빨"` 같은 스탯 수식을 정수로.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/engine.test.js` 생성:

```js
var assert = require("assert");
var Engine = require("../js/engine.js");
var U = Engine._utils;

function S(overrides) {
  var s = { day: 1, followers: 10,
    stats: { 글빨: 5, 유머: 5, 감각: 5, 멘탈: 50, 논란성: 0 },
    feed: [], tweetLog: [], activeEvents: [], eventHistory: [], ending: null };
  Object.assign(s.stats, (overrides && overrides.stats) || {});
  if (overrides && overrides.followers != null) s.followers = overrides.followers;
  if (overrides && overrides.eventHistory) s.eventHistory = overrides.eventHistory;
  return s;
}

// --- Task 1: utils ---
assert.strictEqual(U.compare(30, ">=30"), true);
assert.strictEqual(U.compare(29, ">=30"), false);
assert.strictEqual(U.compare(5, "<10"), true);
assert.strictEqual(U.compare(10, 10), true, "숫자 expr은 >= 판정");
assert.strictEqual(U.compare(9, 10), false);

assert.strictEqual(U.checkCond({ 논란성: ">=30" }, S({ stats: { 논란성: 30 } })), true);
assert.strictEqual(U.checkCond({ 논란성: ">=30" }, S()), false);
assert.strictEqual(U.checkCond({ 팔로워: ">=100" }, S({ followers: 150 })), true);
assert.strictEqual(U.checkCond({ 글빨: 10, 감각: 10 }, S({ stats: { 글빨: 10, 감각: 9 } })), false, "AND 판정");
assert.strictEqual(U.checkCond({ topStat: "글빨" }, S({ stats: { 글빨: 20 } })), true);
assert.strictEqual(U.checkCond({ topStat: "글빨" }, S({ stats: { 유머: 30, 글빨: 20 } })), false);
assert.strictEqual(U.checkCond({ topStat: "글빨" }, S({ stats: { 글빨: 20, 멘탈: 99 } })), true, "멘탈은 topStat 비교에서 제외");
assert.strictEqual(U.checkCond({ eventDone: "backlash" }, S({ eventHistory: ["backlash"] })), true);
assert.strictEqual(U.checkCond({ eventDone: "backlash" }, S()), false);
assert.strictEqual(U.checkCond({ chance: 0.3, 논란성: ">=0" }, S()), true, "chance 키는 무시");

assert.strictEqual(U.evalFormula("유머*3 + 글빨", S({ stats: { 유머: 4, 글빨: 2 } })), 14);
assert.strictEqual(U.evalFormula(7, S()), 7);
assert.strictEqual(U.evalFormula("팔로워", S({ followers: 42 })), 42);

console.log("Task 1 OK");
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node test/engine.test.js`
Expected: FAIL — `Cannot find module '../js/engine.js'`

- [ ] **Step 3: 최소 구현**

`js/engine.js` 생성:

```js
var Engine = (function () {
  var SKILL_STATS = ["글빨", "유머", "감각"];

  function compare(actual, expr) {
    if (typeof expr === "number") return actual >= expr;
    var m = /^(>=|<=|>|<|==)\s*(-?\d+)$/.exec(expr);
    if (!m) return false;
    var n = Number(m[2]);
    if (m[1] === ">=") return actual >= n;
    if (m[1] === "<=") return actual <= n;
    if (m[1] === ">") return actual > n;
    if (m[1] === "<") return actual < n;
    return actual === n;
  }

  function checkCond(cond, state) {
    for (var key in cond) {
      var v = cond[key];
      if (key === "chance") continue;
      if (key === "topStat") {
        var top = SKILL_STATS[0];
        SKILL_STATS.forEach(function (s) { if (state.stats[s] > state.stats[top]) top = s; });
        if (top !== v) return false;
      } else if (key === "eventDone") {
        if (state.eventHistory.indexOf(v) === -1) return false;
      } else {
        var actual = key === "팔로워" ? state.followers : state.stats[key];
        if (!compare(actual, v)) return false;
      }
    }
    return true;
  }

  function evalFormula(expr, state) {
    if (typeof expr === "number") return expr;
    var names = Object.keys(state.stats).concat(["팔로워"]);
    var vals = names.map(function (n) { return n === "팔로워" ? state.followers : state.stats[n]; });
    // ponytail: new Function 수식 평가 — 로컬 데이터 파일만 입력이므로 충분. 외부 입력 받게 되면 파서로 교체
    return Math.round(Function.apply(null, names.concat("return (" + expr + ")")).apply(null, vals));
  }

  return { _utils: { compare: compare, checkCond: checkCond, evalFormula: evalFormula } };
})();
if (typeof module !== "undefined") module.exports = Engine;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node test/engine.test.js`
Expected: `Task 1 OK`

- [ ] **Step 5: 커밋**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: 엔진 코어 유틸 (조건 판정, 수식 평가)"
```

---

### Task 2: 데이터 파일(행동·NPC) + Engine.create/getActions

**Files:**
- Create: `data/actions.js`
- Create: `data/npcs.js`
- Modify: `js/engine.js` (create 추가)
- Modify: `test/engine.test.js` (테스트 추가)

**Interfaces:**
- Consumes: Task 1의 `checkCond`.
- Produces:
  - `Engine.create(data, savedState?, rng?) → game` — data는 `{ actions, npcs, events, endings, fills }` 병합 객체. rng는 `() => number` (기본 Math.random).
  - `game.getState() → state` (직렬화 가능한 순수 객체 — localStorage 저장은 이걸 JSON.stringify)
  - `game.getActions() → [{ id, label, kind }]` — kind: `"tweet" | "train" | "event"`. requires 미충족 행동은 제외.
- 데이터 파일 패턴 (모든 data/*.js 공통):
  ```js
  var GAME_DATA = GAME_DATA || {};
  GAME_DATA.<키> = <리터럴>;
  if (typeof module !== "undefined") module.exports = GAME_DATA;
  ```
- 액션 스키마: `{ id, type: "tweet"|"train", category?, label, requires?, effects, templates: [string] }` — 템플릿 안 `{밈소재}` 같은 빈칸은 `GAME_DATA.fills`의 배열에서 랜덤 치환.

- [ ] **Step 1: 데이터 파일 작성**

`data/actions.js` 생성:

```js
var GAME_DATA = GAME_DATA || {};
GAME_DATA.fills = {
  "밈소재": ["고양이가 키보드 밟은 썰", "지하철 빌런 목격담", "편의점 신상 리뷰", "오늘자 실트 근황"],
  "떡밥": ["민초 논쟁", "탕수육 부먹찍먹", "티켓팅 대란", "번역기 오역 사건"]
};
GAME_DATA.actions = [
  { id: "tweet_daily", type: "tweet", category: "daily", label: "일상 트윗",
    effects: { "팔로워": "1 + 글빨" },
    templates: ["오늘 하루도 무사히 끝. {밈소재} 때문에 웃었다", "별일 없이 산다. 그게 제일 어렵다"] },
  { id: "tweet_humor", type: "tweet", category: "humor", label: "유머 트윗",
    effects: { "팔로워": "유머*3 + 글빨" },
    templates: ["{밈소재} 실화냐 ㅋㅋㅋㅋ", "방금 {밈소재} 봤는데 아직도 웃고 있음"] },
  { id: "tweet_info", type: "tweet", category: "info", label: "정보글 트윗",
    requires: { "글빨": 10 },
    effects: { "팔로워": "글빨*4" },
    templates: ["[정보] 알아두면 쓸모있는 꿀팁 정리 (1/n)", "이거 모르는 사람 많던데, 정리해드림"] },
  { id: "tweet_bait", type: "tweet", category: "bait", label: "떡밥 참전",
    requires: { "감각": 10 },
    effects: { "팔로워": "감각*5 + 유머*2", "논란성": 5, "멘탈": -5 },
    templates: ["{떡밥}, 제 생각은 좀 다릅니다만", "{떡밥} 이거 다들 잘못 알고 있음"] },
  { id: "train_writing", type: "train", label: "글쓰기 연습", effects: { "글빨": 2 },
    templates: ["오늘은 하루종일 필사했다. 손목 아파"] },
  { id: "train_meme", type: "train", label: "밈 공부", effects: { "유머": 2 },
    templates: ["인터넷 밈 아카이브 정주행 완료"] },
  { id: "train_trend", type: "train", label: "트렌드 조사", effects: { "감각": 2 },
    templates: ["실트 3시간 관찰 일지 작성 중"] },
  { id: "rest", type: "train", label: "휴식", effects: { "멘탈": 15 },
    templates: ["오늘은 폰 끄고 쉼. 내일 봐요"] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
```

`data/npcs.js` 생성:

```js
var GAME_DATA = GAME_DATA || {};
GAME_DATA.npcs = [
  { handle: "@meme_bot99", name: "밈수집가", reactsTo: ["humor", "daily"],
    replies: ["ㅋㅋㅋㅋㅋ 미쳤네", "이거 완전 저장각", "RT 박고 갑니다"] },
  { handle: "@info_hunter", name: "정보사냥꾼", reactsTo: ["info"],
    replies: ["좋은 정보 감사합니다. 알티할게요", "북마크 완료. 늘 잘 보고 있어요"] },
  { handle: "@fire_starter", name: "불씨", reactsTo: ["bait"],
    replies: ["이건 좀 아니지 않나요?", "용기 있는 발언 응원합니다", "어그로 그만 끄세요"] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
```

- [ ] **Step 2: 실패하는 테스트 추가**

`test/engine.test.js` 끝의 `console.log("Task 1 OK")` 뒤에 추가:

```js
// --- Task 2: create / getActions ---
function loadData() {
  var d = {};
  Object.assign(d, require("../data/actions.js"));
  Object.assign(d, require("../data/npcs.js"));
  d.events = d.events || [];
  d.endings = d.endings || { threshold: 10000, list: [] };
  return d;
}
var g = Engine.create(loadData());
assert.strictEqual(g.getState().day, 1);
assert.strictEqual(g.getState().followers, 10);
assert.strictEqual(g.getState().stats.멘탈, 50);

var ids = g.getActions().map(function (a) { return a.id; });
assert.ok(ids.indexOf("tweet_daily") !== -1);
assert.ok(ids.indexOf("tweet_info") === -1, "글빨 10 미만이면 정보글 잠김");
assert.ok(ids.indexOf("tweet_bait") === -1, "감각 10 미만이면 떡밥 잠김");

var g2 = Engine.create(loadData(), null);
g2.getState().stats.글빨 = 10;
assert.ok(g2.getActions().map(function (a) { return a.id; }).indexOf("tweet_info") !== -1, "스탯 충족 시 해금");

var saved = JSON.parse(JSON.stringify(g.getState()));
var g3 = Engine.create(loadData(), saved);
assert.strictEqual(g3.getState().followers, 10, "저장 상태 복원");

console.log("Task 2 OK");
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node test/engine.test.js`
Expected: FAIL — `Engine.create is not a function`

- [ ] **Step 4: 구현**

`js/engine.js`의 `return { _utils: ... }` 줄을 아래로 교체 (create 함수는 그 위에 추가):

```js
  function initialState() {
    return {
      day: 1, followers: 10,
      stats: { 글빨: 5, 유머: 5, 감각: 5, 멘탈: 50, 논란성: 0 },
      feed: [], tweetLog: [], activeEvents: [], eventHistory: [], ending: null
    };
  }

  function create(data, saved, rng) {
    var rand = rng || Math.random;
    var state = saved || initialState();

    function getActions() {
      var list = [];
      state.activeEvents.forEach(function (ae) {
        var ev = data.events.filter(function (e) { return e.id === ae.eventId; })[0];
        ev.stages[ae.stage].choices.forEach(function (c, i) {
          if (!c.requires || checkCond(c.requires, state))
            list.push({ id: "event:" + ev.id + ":" + i, label: c.label, kind: "event" });
        });
      });
      data.actions.forEach(function (a) {
        if (!a.requires || checkCond(a.requires, state))
          list.push({ id: a.id, label: a.label, kind: a.type });
      });
      return list;
    }

    return { getState: function () { return state; }, getActions: getActions };
  }

  return { _utils: { compare: compare, checkCond: checkCond, evalFormula: evalFormula }, create: create };
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node test/engine.test.js`
Expected: `Task 1 OK`, `Task 2 OK`

- [ ] **Step 6: 커밋**

```bash
git add data/actions.js data/npcs.js js/engine.js test/engine.test.js
git commit -m "feat: 행동/NPC 데이터 + Engine.create/getActions"
```

---

### Task 3: advanceTurn — 행동 실행, 트윗 생성, NPC 반응

**Files:**
- Modify: `js/engine.js`
- Modify: `test/engine.test.js`

**Interfaces:**
- Consumes: Task 1 유틸, Task 2 `create` 내부 상태.
- Produces: `game.advanceTurn(actionId) → { feedItems, statChanges, triggeredEvents, ending }`
  - `feedItems: [{ author, name?, text, day, likes?, rts?, kind }]` — kind: `"me" | "reply" | "event" | "system"`. author `"me"`는 플레이어.
  - `statChanges: { [스탯명|"팔로워"]: delta }`
  - `triggeredEvents: [eventId]` (이번 태스크에선 항상 빈 배열)
  - `ending: null` (Task 5까지)
  - 상태 변화: 팔로워/스탯 반영(0 미만 방지), 트윗은 `state.feed` 맨 앞과 `state.tweetLog`에 기록, `state.day` +1.

- [ ] **Step 1: 실패하는 테스트 추가**

`test/engine.test.js` 끝에 추가:

```js
// --- Task 3: advanceTurn ---
function fixedRng() { return 0; } // 항상 0 → 템플릿/리플 첫 항목, 확률 이벤트는 전부 발동
var g4 = Engine.create(loadData(), null, fixedRng);
var r = g4.advanceTurn("tweet_humor");
assert.strictEqual(g4.getState().day, 2);
assert.strictEqual(g4.getState().followers, 10 + (5 * 3 + 5), "유머*3+글빨 = 20 증가");
assert.strictEqual(r.statChanges["팔로워"], 20);
var myTweet = r.feedItems.filter(function (f) { return f.kind === "me"; })[0];
assert.ok(myTweet, "내 트윗이 피드에 있음");
assert.ok(myTweet.text.indexOf("{") === -1, "템플릿 빈칸이 치환됨");
assert.ok(myTweet.likes >= 0 && myTweet.rts >= 0);
assert.strictEqual(g4.getState().tweetLog.length, 1);
assert.strictEqual(g4.getState().feed.length, r.feedItems.length);
var reply = r.feedItems.filter(function (f) { return f.kind === "reply"; })[0];
assert.ok(reply, "humor에 반응하는 NPC 리플 존재");
assert.strictEqual(reply.author, "@meme_bot99");

var g5 = Engine.create(loadData(), null, fixedRng);
var r2 = g5.advanceTurn("train_writing");
assert.strictEqual(g5.getState().stats.글빨, 7);
assert.strictEqual(g5.getState().followers, 10, "자기계발은 팔로워 불변");
assert.ok(r2.feedItems.filter(function (f) { return f.kind === "me"; }).length === 1, "자기계발도 자동 트윗");
assert.strictEqual(r2.feedItems.filter(function (f) { return f.kind === "reply"; }).length, 0, "category 없는 행동엔 리플 없음");

var g6 = Engine.create(loadData(), null, fixedRng);
g6.getState().stats.멘탈 = 3;
g6.getState().stats.감각 = 10;
g6.advanceTurn("tweet_bait");
// 주의: >= 0 로만 검사할 것 — Task 5에서 멘탈 0은 붕괴 처리로 20이 되므로 === 0 검사는 회귀로 깨진다
assert.ok(g6.getState().stats.멘탈 >= 0, "스탯은 0 미만으로 안 떨어짐");

console.log("Task 3 OK");
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node test/engine.test.js`
Expected: FAIL — `g4.advanceTurn is not a function`

- [ ] **Step 3: 구현**

`js/engine.js`의 `create` 함수 안, `return { getState... }` 앞에 추가하고 return에 `advanceTurn: advanceTurn` 포함:

```js
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    function fillTemplate(text) {
      return text.replace(/\{([^}]+)\}/g, function (_, key) {
        return data.fills && data.fills[key] ? pick(data.fills[key]) : key;
      });
    }

    function applyEffects(effects, statChanges) {
      for (var k in effects) {
        var delta = evalFormula(effects[k], state);
        if (k === "팔로워") state.followers = Math.max(0, state.followers + delta);
        else state.stats[k] = Math.max(0, (state.stats[k] || 0) + delta);
        statChanges[k] = (statChanges[k] || 0) + delta;
      }
    }

    function advanceTurn(actionId) {
      var feedItems = [], statChanges = {}, triggeredEvents = [];

      var action = data.actions.filter(function (a) { return a.id === actionId; })[0];
      if (action) {
        applyEffects(action.effects, statChanges);
        var gain = Math.max(0, statChanges["팔로워"] || 0);
        var tweet = {
          author: "me", text: fillTemplate(pick(action.templates)), day: state.day,
          likes: gain * 2 + Math.floor(rand() * 10), rts: Math.floor(gain / 2), kind: "me"
        };
        feedItems.push(tweet);
        state.tweetLog.push(tweet);
        if (action.category) {
          data.npcs.forEach(function (npc) {
            if (npc.reactsTo.indexOf(action.category) !== -1 && rand() < 0.6)
              feedItems.push({ author: npc.handle, name: npc.name, text: pick(npc.replies), day: state.day, kind: "reply" });
          });
        }
      }

      state.feed = feedItems.concat(state.feed);
      state.day += 1;
      return { feedItems: feedItems, statChanges: statChanges, triggeredEvents: triggeredEvents, ending: null };
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node test/engine.test.js`
Expected: Task 1~3 OK

- [ ] **Step 5: 커밋**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: advanceTurn 행동 실행/트윗 생성/NPC 반응"
```

---

### Task 4: 이벤트 시스템 (트리거 + 다단계 선택지)

**Files:**
- Create: `data/events.js`
- Modify: `js/engine.js`
- Modify: `test/engine.test.js`

**Interfaces:**
- Consumes: Task 3 `advanceTurn` 골격, `applyEffects`, `checkCond`.
- Produces:
  - 이벤트 스키마: `{ id, trigger: { ...cond, chance? }, stages: [{ feed: [string], choices: [{ label, requires?, effects, next: number|"end" }] }] }`
  - actionId `"event:<eventId>:<choiceIndex>"` 처리: 효과 적용 후 next가 `"end"`면 activeEvents에서 제거+eventHistory에 추가, 숫자면 해당 스테이지로 이동하며 그 스테이지의 feed를 즉시 노출.
  - 트리거: 매 턴 행동 처리 후, 미발동·미완료 이벤트 중 조건 충족 && `rand() < chance`(기본 1)면 발동 → stage 0 feed가 `kind: "event"`로 노출, `triggeredEvents`에 id 추가.
  - 발동 중인 이벤트가 있어도 일반 행동은 자유 (이벤트 선택지는 getActions 목록 맨 앞에 옴 — Task 2에서 이미 구현됨).

- [ ] **Step 1: 데이터 파일 작성**

`data/events.js` 생성:

```js
var GAME_DATA = GAME_DATA || {};
GAME_DATA.events = [
  { id: "viral_humor",
    trigger: { "유머": ">=15", chance: 0.25 },
    stages: [
      { feed: ["어젯밤 내 유머 트윗이 알고리즘을 타고 퍼지기 시작했다!"],
        choices: [
          { label: "겸손하게 감사 트윗", effects: { "팔로워": 300, "글빨": 1 }, next: "end" },
          { label: "후속 드립 연달아 투척", effects: { "팔로워": "유머*30", "논란성": 3 }, next: "end" }
        ] }
    ] },
  { id: "backlash",
    trigger: { "논란성": ">=20", chance: 0.4 },
    stages: [
      { feed: ["빅계정 불씨(@fire_starter)가 내 트윗을 인용하며 저격했다: \"이 사람 말 다 틀렸음\""],
        choices: [
          { label: "사과문 올리기", effects: { "팔로워": -200, "멘탈": -10, "논란성": -10 }, next: "end" },
          { label: "맞받아치기", requires: { "멘탈": 30 }, effects: { "논란성": 10, "멘탈": -5 }, next: 1 },
          { label: "무시한다", effects: { "팔로워": -50, "논란성": -5 }, next: "end" }
        ] },
      { feed: ["설전이 실시간 트렌드에 올랐다. 구경꾼들이 몰려온다"],
        choices: [
          { label: "논리로 깔끔하게 마무리", requires: { "글빨": 15 }, effects: { "팔로워": 500, "논란성": 5 }, next: "end" },
          { label: "감정적으로 폭발", effects: { "팔로워": 200, "논란성": 20, "멘탈": -15 }, next: "end" }
        ] }
    ] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
```

- [ ] **Step 2: 실패하는 테스트 추가**

`test/engine.test.js`의 `loadData` 함수에서 `d.events = d.events || [];` 줄을 아래로 교체:

```js
  Object.assign(d, require("../data/events.js"));
```

그리고 파일 끝에 추가:

```js
// --- Task 4: events ---
var g7 = Engine.create(loadData(), null, fixedRng); // rand()=0 → chance 항상 통과
g7.getState().stats.유머 = 15;
var r3 = g7.advanceTurn("train_meme");
assert.deepStrictEqual(r3.triggeredEvents, ["viral_humor"], "유머 15 이상 + chance 통과 → 발동");
assert.ok(r3.feedItems.some(function (f) { return f.kind === "event"; }), "이벤트 피드 노출");
assert.strictEqual(g7.getState().activeEvents.length, 1);

var evActs = g7.getActions().filter(function (a) { return a.kind === "event"; });
assert.strictEqual(evActs.length, 2, "이벤트 선택지 2개 노출");
assert.strictEqual(evActs[0].id, "event:viral_humor:0");

var before = g7.getState().followers;
g7.advanceTurn("event:viral_humor:0");
assert.strictEqual(g7.getState().followers, before + 300);
assert.strictEqual(g7.getState().activeEvents.length, 0, "end로 종료");
assert.deepStrictEqual(g7.getState().eventHistory, ["viral_humor"]);

var g8 = Engine.create(loadData(), null, fixedRng);
g8.getState().stats.논란성 = 20;
g8.getState().stats.멘탈 = 40;
g8.advanceTurn("rest"); // backlash 발동
assert.strictEqual(g8.getState().activeEvents.length, 1);
var r4 = g8.advanceTurn("event:backlash:1"); // 맞받아치기 → stage 1
assert.strictEqual(g8.getState().activeEvents[0].stage, 1, "다단계 진행");
assert.ok(r4.feedItems.some(function (f) { return f.kind === "event"; }), "다음 스테이지 피드 즉시 노출");
var stage1Acts = g8.getActions().filter(function (a) { return a.kind === "event"; });
assert.strictEqual(stage1Acts.length, 1, "글빨 15 미만이라 '논리로 마무리' 잠김");

var g9 = Engine.create(loadData(), null, function () { return 0.99; }); // chance 실패
g9.getState().stats.유머 = 15;
var r5 = g9.advanceTurn("train_meme");
assert.deepStrictEqual(r5.triggeredEvents, [], "chance 미통과 시 미발동");

console.log("Task 4 OK");
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node test/engine.test.js`
Expected: FAIL — triggeredEvents가 빈 배열 (deepStrictEqual 불일치)

- [ ] **Step 4: 구현**

`js/engine.js`의 `advanceTurn` 안을 수정. `var action = ...` 블록 앞에 이벤트 선택지 처리를, `state.feed = ...` 앞에 트리거 검사를 넣는다. 전체 advanceTurn:

```js
    function pushEventFeed(ev, stageIdx, feedItems) {
      ev.stages[stageIdx].feed.forEach(function (t) {
        feedItems.push({ author: "@world", name: "타임라인", text: t, day: state.day, kind: "event" });
      });
    }

    function advanceTurn(actionId) {
      var feedItems = [], statChanges = {}, triggeredEvents = [];

      if (actionId.indexOf("event:") === 0) {
        var parts = actionId.split(":");
        var ev = data.events.filter(function (e) { return e.id === parts[1]; })[0];
        var ae = state.activeEvents.filter(function (a) { return a.eventId === parts[1]; })[0];
        var choice = ev.stages[ae.stage].choices[Number(parts[2])];
        applyEffects(choice.effects, statChanges);
        feedItems.push({ author: "me", text: choice.label + " — 을(를) 선택했다", day: state.day, likes: 0, rts: 0, kind: "me" });
        if (choice.next === "end") {
          state.activeEvents = state.activeEvents.filter(function (a) { return a.eventId !== ev.id; });
          state.eventHistory.push(ev.id);
        } else {
          ae.stage = choice.next;
          pushEventFeed(ev, ae.stage, feedItems);
        }
      } else {
        var action = data.actions.filter(function (a) { return a.id === actionId; })[0];
        if (action) {
          applyEffects(action.effects, statChanges);
          var gain = Math.max(0, statChanges["팔로워"] || 0);
          var tweet = {
            author: "me", text: fillTemplate(pick(action.templates)), day: state.day,
            likes: gain * 2 + Math.floor(rand() * 10), rts: Math.floor(gain / 2), kind: "me"
          };
          feedItems.push(tweet);
          state.tweetLog.push(tweet);
          if (action.category) {
            data.npcs.forEach(function (npc) {
              if (npc.reactsTo.indexOf(action.category) !== -1 && rand() < 0.6)
                feedItems.push({ author: npc.handle, name: npc.name, text: pick(npc.replies), day: state.day, kind: "reply" });
            });
          }
        }
      }

      data.events.forEach(function (ev) {
        var done = state.eventHistory.indexOf(ev.id) !== -1;
        var active = state.activeEvents.some(function (a) { return a.eventId === ev.id; });
        if (done || active) return;
        if (checkCond(ev.trigger, state) && rand() < (ev.trigger.chance == null ? 1 : ev.trigger.chance)) {
          state.activeEvents.push({ eventId: ev.id, stage: 0 });
          pushEventFeed(ev, 0, feedItems);
          triggeredEvents.push(ev.id);
        }
      });

      state.feed = feedItems.concat(state.feed);
      state.day += 1;
      return { feedItems: feedItems, statChanges: statChanges, triggeredEvents: triggeredEvents, ending: null };
    }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node test/engine.test.js`
Expected: Task 1~4 OK

- [ ] **Step 6: 커밋**

```bash
git add data/events.js js/engine.js test/engine.test.js
git commit -m "feat: 이벤트 시스템 (트리거, 다단계 선택지)"
```

---

### Task 5: 엔딩 판정 + 멘탈 붕괴

**Files:**
- Create: `data/endings.js`
- Modify: `js/engine.js`
- Modify: `test/engine.test.js`

**Interfaces:**
- Consumes: Task 4까지의 advanceTurn, `checkCond`.
- Produces:
  - 엔딩 스키마: `GAME_DATA.endings = { threshold: number, list: [{ id, title, condition?, text }] }` — list 순서대로 첫 condition 충족(또는 condition 없음)이 당첨. 마지막 항목은 condition 없는 기본 엔딩이어야 함.
  - advanceTurn 반환의 `ending`: `{ id, title, text }` 또는 null. 판정 시 `state.ending = id` 저장. 이미 엔딩난 상태면 재판정 안 함.
  - 멘탈 붕괴: 행동 처리 후 `멘탈 === 0`이면 강제 휴식 — `kind: "system"` 피드 추가, 멘탈 20 회복, day 추가 +1 (턴 손실).

- [ ] **Step 1: 데이터 파일 작성**

`data/endings.js` 생성:

```js
var GAME_DATA = GAME_DATA || {};
GAME_DATA.endings = {
  threshold: 10000,
  list: [
    { id: "cyber_wrecker", title: "사이버렉카", condition: { "논란성": ">=50" },
      text: "당신은 논란을 연료로 달리는 계정이 되었다. 팔로워는 많지만, 절반은 안티다." },
    { id: "author", title: "등단 작가", condition: { topStat: "글빨" },
      text: "출판사에서 DM이 왔다. 트위터 글쟁이에서 진짜 작가로." },
    { id: "comedian", title: "밈 장인", condition: { topStat: "유머" },
      text: "당신의 드립은 이제 초등학생도 쓴다. 인터넷 유머사의 한 페이지가 되었다." },
    { id: "trend_setter", title: "트렌드세터", condition: { topStat: "감각" },
      text: "당신이 언급하면 그게 곧 유행이 된다. 브랜드 협업 제안이 쏟아진다." },
    { id: "influencer", title: "그냥 유명한 사람",
      text: "특별한 건 없지만 어쨌든 유명해졌다. 그것도 재능이다." }
  ]
};
if (typeof module !== "undefined") module.exports = GAME_DATA;
```

- [ ] **Step 2: 실패하는 테스트 추가**

`test/engine.test.js`의 `loadData`에서 `d.endings = d.endings || ...` 줄을 아래로 교체:

```js
  Object.assign(d, require("../data/endings.js"));
```

파일 끝에 추가:

```js
// --- Task 5: endings + mental ---
var g10 = Engine.create(loadData(), null, function () { return 0.99; }); // 이벤트 미발동
g10.getState().followers = 9999;
g10.getState().stats.글빨 = 30;
var r6 = g10.advanceTurn("tweet_info"); // 글빨*4 = 120 증가 → 임계값 돌파
assert.ok(r6.ending, "임계값 도달 시 엔딩");
assert.strictEqual(r6.ending.id, "author", "글빨 최고 → 등단 작가");
assert.strictEqual(g10.getState().ending, "author");

var g11 = Engine.create(loadData(), null, function () { return 0.99; });
g11.getState().followers = 99999;
g11.getState().stats.논란성 = 50;
g11.getState().stats.유머 = 40;
var r7 = g11.advanceTurn("train_meme");
assert.strictEqual(r7.ending.id, "cyber_wrecker", "논란성 조건이 topStat보다 우선(list 순서)");

var g12 = Engine.create(loadData(), null, function () { return 0.99; });
g12.getState().followers = 99999;
var r8 = g12.advanceTurn("rest");
assert.ok(r8.ending, "조건 미달이어도 기본 엔딩은 반드시 나옴");

var g13 = Engine.create(loadData(), null, function () { return 0.99; });
g13.getState().stats.멘탈 = 5;
g13.getState().stats.감각 = 10;
var dayBefore = g13.getState().day;
var r9 = g13.advanceTurn("tweet_bait"); // 멘탈 -5 → 0 → 붕괴
assert.strictEqual(g13.getState().stats.멘탈, 20, "강제 휴식으로 멘탈 20 회복");
assert.strictEqual(g13.getState().day, dayBefore + 2, "턴 손실 (+1 추가)");
assert.ok(r9.feedItems.some(function (f) { return f.kind === "system"; }), "붕괴 안내 피드");

console.log("Task 5 OK");
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node test/engine.test.js`
Expected: FAIL — `r6.ending`이 null

- [ ] **Step 4: 구현**

`js/engine.js`의 `advanceTurn` 안, `state.feed = feedItems.concat(state.feed);` 바로 앞에 추가:

```js
      if (state.stats.멘탈 === 0) {
        state.stats.멘탈 = 20;
        state.day += 1;
        feedItems.push({ author: "@world", name: "시스템", text: "멘탈이 무너졌다… 하루를 통째로 쉬며 회복했다. (멘탈 20)", day: state.day, kind: "system" });
      }

      var ending = null;
      if (!state.ending && state.followers >= data.endings.threshold) {
        var hit = data.endings.list.filter(function (e) { return !e.condition || checkCond(e.condition, state); })[0];
        state.ending = hit.id;
        ending = { id: hit.id, title: hit.title, text: hit.text };
      }
```

그리고 마지막 return을 다음으로 교체:

```js
      return { feedItems: feedItems, statChanges: statChanges, triggeredEvents: triggeredEvents, ending: ending };
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node test/engine.test.js`
Expected: Task 1~5 OK

- [ ] **Step 6: 커밋**

```bash
git add data/endings.js js/engine.js test/engine.test.js
git commit -m "feat: 엔딩 판정 + 멘탈 붕괴"
```

---

### Task 6: 밸런스 시뮬레이션 (test/sim.js)

**Files:**
- Create: `test/sim.js`

**Interfaces:**
- Consumes: Engine 전체 API, data/*.js.
- Produces: `node test/sim.js` — 3가지 전략(랜덤/성장몰빵/어그로)으로 각 500턴 한도 자동 플레이. 어떤 전략이든 엔딩 도달 실패, 스탯 음수, 예외 발생 시 assert로 실패. 전략별 도달 일수·엔딩을 출력.

- [ ] **Step 1: 시뮬레이션 작성**

`test/sim.js` 생성:

```js
var assert = require("assert");
var Engine = require("../js/engine.js");

function loadData() {
  var d = {};
  Object.assign(d, require("../data/actions.js"));
  Object.assign(d, require("../data/npcs.js"));
  Object.assign(d, require("../data/events.js"));
  Object.assign(d, require("../data/endings.js"));
  return d;
}

function mulberry32(seed) { // 시드 고정 RNG — 재현 가능한 시뮬레이션
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var strategies = {
  "랜덤": function (acts, rand) { return acts[Math.floor(rand() * acts.length)]; },
  "성장몰빵": function (acts, rand, state) {
    var ev = acts.filter(function (a) { return a.kind === "event"; })[0];
    if (ev) return ev;
    if (state.stats.멘탈 < 20) return acts.filter(function (a) { return a.id === "rest"; })[0];
    if (state.day % 3 === 0) return acts.filter(function (a) { return a.id === "train_writing"; })[0];
    var info = acts.filter(function (a) { return a.id === "tweet_info"; })[0];
    return info || acts.filter(function (a) { return a.id === "tweet_daily"; })[0];
  },
  "어그로": function (acts, rand, state) {
    var ev = acts.filter(function (a) { return a.kind === "event"; })[0];
    if (ev) return ev;
    if (state.stats.멘탈 < 25) return acts.filter(function (a) { return a.id === "rest"; })[0];
    var bait = acts.filter(function (a) { return a.id === "tweet_bait"; })[0];
    return bait || acts.filter(function (a) { return a.id === "train_trend"; })[0];
  }
};

Object.keys(strategies).forEach(function (name, si) {
  var rand = mulberry32(42 + si);
  var game = Engine.create(loadData(), null, rand);
  var ending = null, turns = 0;
  while (!ending && turns < 500) {
    var acts = game.getActions();
    assert.ok(acts.length > 0, name + ": 가능한 행동이 없음");
    var chosen = strategies[name](acts, rand, game.getState());
    var result = game.advanceTurn(chosen.id);
    var st = game.getState();
    Object.keys(st.stats).forEach(function (k) {
      assert.ok(st.stats[k] >= 0, name + ": 스탯 " + k + " 음수");
    });
    assert.ok(st.followers >= 0, name + ": 팔로워 음수");
    ending = result.ending;
    turns++;
  }
  assert.ok(ending, name + ": 500턴 안에 엔딩 실패 (팔로워 " + game.getState().followers + ")");
  console.log(name + " → " + ending.title + " (" + game.getState().day + "일차, 팔로워 " + game.getState().followers + ")");
});
console.log("sim OK");
```

- [ ] **Step 2: 실행 및 밸런스 확인**

Run: `node test/sim.js`
Expected: 3개 전략 모두 엔딩 출력 + `sim OK`. 실패하면 이건 **밸런스 버그** — 수치 조정은 `data/*.js`의 effects/threshold만 만지고 코드(engine.js)는 건드리지 말 것. (예: 500턴 내 미도달이면 트윗 팔로워 수식 계수를 올린다.)

- [ ] **Step 3: 회귀 확인 및 커밋**

Run: `node test/engine.test.js` — 여전히 전부 OK 확인.

```bash
git add test/sim.js data
git commit -m "test: 자동 플레이 밸런스 시뮬레이션"
```

---

### Task 7: 트위터 UI 셸 (index.html + style.css)

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Produces: ui.js(Task 8)가 사용할 DOM id들 — `#day`, `#followers`, `#feed`, `#compose`, `#action-list`, `#next-day`, `#view-home`, `#view-profile`, `#view-notif`, `#profile-stats`, `#profile-tweets`, `#notif-list`, `#notif-badge`, `#ending-overlay`, `#new-game`. 네비 버튼은 `.nav-btn[data-view]`.

- [ ] **Step 1: index.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>트위터게임</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="app">
    <nav class="sidebar">
      <div class="logo">🐦</div>
      <button class="nav-btn active" data-view="home">🏠 홈</button>
      <button class="nav-btn" data-view="notif">🔔 알림 <span id="notif-badge" class="badge hidden"></span></button>
      <button class="nav-btn" data-view="profile">👤 프로필</button>
      <button id="next-day" class="next-day" disabled>다음 날 →</button>
      <button id="new-game" class="new-game">새 게임</button>
    </nav>

    <main class="main">
      <header class="topbar">
        <span id="day">1일차</span>
        <span id="followers">팔로워 10</span>
      </header>

      <section id="view-home" class="view">
        <div id="compose" class="compose">
          <div class="avatar">😎</div>
          <div class="compose-hint">무슨 일이 일어나고 있나요?</div>
        </div>
        <div id="action-list" class="action-list hidden"></div>
        <div id="feed" class="feed"></div>
      </section>

      <section id="view-profile" class="view hidden">
        <div class="profile-header">
          <div class="avatar big">😎</div>
          <h2>나</h2><span class="handle">@me</span>
        </div>
        <div id="profile-stats" class="profile-stats"></div>
        <h3 class="section-title">내 트윗</h3>
        <div id="profile-tweets" class="feed"></div>
      </section>

      <section id="view-notif" class="view hidden">
        <div id="notif-list" class="feed"></div>
      </section>
    </main>
  </div>

  <div id="ending-overlay" class="overlay hidden"></div>

  <script src="data/actions.js"></script>
  <script src="data/npcs.js"></script>
  <script src="data/events.js"></script>
  <script src="data/endings.js"></script>
  <script src="js/engine.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: style.css 작성**

`css/style.css` 생성 (트위터 다크 테마):

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; color: #e7e9ea; font-family: "Segoe UI", "Malgun Gothic", sans-serif; }
.hidden { display: none !important; }

.app { display: flex; max-width: 900px; margin: 0 auto; min-height: 100vh; }

.sidebar { width: 200px; padding: 12px; border-right: 1px solid #2f3336;
  display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh; }
.logo { font-size: 28px; padding: 8px 12px; }
.nav-btn { background: none; border: none; color: #e7e9ea; font-size: 17px; text-align: left;
  padding: 12px; border-radius: 24px; cursor: pointer; }
.nav-btn:hover { background: #181818; }
.nav-btn.active { font-weight: 700; }
.badge { background: #1d9bf0; border-radius: 10px; padding: 1px 7px; font-size: 12px; }
.next-day { margin-top: 16px; background: #1d9bf0; border: none; color: #fff; font-size: 16px;
  font-weight: 700; padding: 12px; border-radius: 24px; cursor: pointer; }
.next-day:disabled { opacity: 0.4; cursor: default; }
.new-game { margin-top: auto; background: none; border: 1px solid #536471; color: #71767b;
  padding: 8px; border-radius: 24px; cursor: pointer; font-size: 13px; }

.main { flex: 1; border-right: 1px solid #2f3336; min-width: 0; }
.topbar { display: flex; justify-content: space-between; padding: 14px 16px;
  border-bottom: 1px solid #2f3336; font-weight: 700; position: sticky; top: 0;
  background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 5; }

.compose { display: flex; gap: 12px; padding: 16px; border-bottom: 1px solid #2f3336; cursor: pointer; }
.compose:hover { background: #080808; }
.compose-hint { color: #536471; font-size: 20px; align-self: center; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #333;
  display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.avatar.big { width: 64px; height: 64px; font-size: 36px; }

.action-list { border-bottom: 1px solid #2f3336; }
.action-item { padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; }
.action-item:hover { background: #181818; }
.action-item .kind { color: #536471; font-size: 13px; }
.action-item.event { color: #1d9bf0; font-weight: 700; }

.tweet { display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #2f3336; }
.tweet .body { min-width: 0; }
.tweet .who { font-weight: 700; }
.tweet .handle, .tweet .meta { color: #536471; font-size: 13px; }
.tweet .text { margin: 4px 0; white-space: pre-wrap; word-break: break-word; }
.tweet.event { background: #0a1420; }
.tweet.system { background: #1a1006; }

.profile-header { display: flex; gap: 16px; align-items: center; padding: 16px; border-bottom: 1px solid #2f3336; }
.handle { color: #536471; }
.profile-stats { padding: 16px; border-bottom: 1px solid #2f3336; display: grid;
  grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-row { display: flex; justify-content: space-between; padding: 6px 10px;
  background: #16181c; border-radius: 8px; }
.section-title { padding: 12px 16px; border-bottom: 1px solid #2f3336; }

.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100;
  display: flex; align-items: center; justify-content: center; text-align: center; }
.overlay .card { background: #16181c; border: 1px solid #2f3336; border-radius: 16px;
  padding: 40px; max-width: 420px; }
.overlay h1 { color: #1d9bf0; margin-bottom: 12px; }
.overlay p { color: #e7e9ea; line-height: 1.6; margin-bottom: 24px; }
.overlay button { background: #1d9bf0; border: none; color: #fff; font-weight: 700;
  padding: 12px 32px; border-radius: 24px; cursor: pointer; font-size: 16px; }

@media (max-width: 640px) {
  .sidebar { width: 64px; }
  .nav-btn { font-size: 20px; padding: 10px 6px; text-align: center; }
  .nav-btn .label, .next-day .label { display: none; }
}
```

- [ ] **Step 3: 육안 확인**

Run: `start index.html` (Windows)
Expected: 다크 테마 레이아웃 — 좌측 사이드바(홈/알림/프로필/다음 날/새 게임), 상단바(1일차/팔로워 10), 컴포즈 박스. 스크립트가 아직 UI를 채우지 않으므로 피드는 비어 있고 콘솔에 ui.js/main.js 404만 뜨는 게 정상.

- [ ] **Step 4: 커밋**

```bash
git add index.html css/style.css
git commit -m "feat: 트위터 UI 셸 (레이아웃, 다크 테마)"
```

---

### Task 8: UI 렌더링 + 게임 배선 + 저장 (ui.js, main.js)

**Files:**
- Create: `js/ui.js`
- Create: `js/main.js`

**Interfaces:**
- Consumes: Task 7 DOM id들, `Engine.create`, `game.getState/getActions/advanceTurn`, 전역 `GAME_DATA`.
- Produces:
  - `UI.renderAll(state)` — 헤더/피드/프로필/알림 전체 갱신
  - `UI.showActions(actions, onPick)` / `UI.hideActions()`
  - `UI.showEnding(ending, onNewGame)`
  - `UI.setTurnDone(done)` — 다음 날 버튼/컴포즈 활성 토글
  - localStorage 키: `"twitterGame.save"` — `JSON.stringify(state)`. 매 턴 저장, 새 게임 시 삭제.

- [ ] **Step 1: ui.js 작성**

```js
var UI = (function () {
  function $(id) { return document.getElementById(id); }

  function tweetEl(item) {
    var div = document.createElement("div");
    div.className = "tweet " + item.kind;
    var who = item.author === "me" ? "나" : (item.name || item.author);
    var handle = item.author === "me" ? "@me" : item.author;
    var meta = item.kind === "me" ? "  ♥ " + (item.likes || 0) + "  🔁 " + (item.rts || 0) : "";
    div.innerHTML =
      '<div class="avatar">' + (item.author === "me" ? "😎" : item.kind === "event" ? "🌐" : item.kind === "system" ? "⚠️" : "🐤") + "</div>" +
      '<div class="body"><span class="who"></span> <span class="handle"></span>' +
      '<div class="text"></div><span class="meta">' + item.day + "일차" + meta + "</span></div>";
    div.querySelector(".who").textContent = who;
    div.querySelector(".handle").textContent = handle;
    div.querySelector(".text").textContent = item.text;
    return div;
  }

  function renderFeed(el, items) {
    el.innerHTML = "";
    items.forEach(function (it) { el.appendChild(tweetEl(it)); });
  }

  function renderAll(state) {
    $("day").textContent = state.day + "일차";
    $("followers").textContent = "팔로워 " + state.followers.toLocaleString();
    renderFeed($("feed"), state.feed);
    renderFeed($("profile-tweets"), state.tweetLog.slice().reverse());
    var stats = $("profile-stats");
    stats.innerHTML = "";
    Object.keys(state.stats).forEach(function (k) {
      var row = document.createElement("div");
      row.className = "stat-row";
      row.innerHTML = "<span></span><b></b>";
      row.querySelector("span").textContent = k;
      row.querySelector("b").textContent = state.stats[k];
      stats.appendChild(row);
    });
    var notifItems = state.feed.filter(function (f) { return f.kind === "event" || f.kind === "system" || f.kind === "reply"; });
    renderFeed($("notif-list"), notifItems);
    var badge = $("notif-badge");
    var pending = state.activeEvents.length;
    badge.textContent = pending;
    badge.classList.toggle("hidden", pending === 0);
  }

  function showActions(actions, onPick) {
    var list = $("action-list");
    list.innerHTML = "";
    actions.forEach(function (a) {
      var item = document.createElement("div");
      item.className = "action-item" + (a.kind === "event" ? " event" : "");
      var kindLabel = a.kind === "event" ? "⚡ 이벤트 대응" : a.kind === "tweet" ? "트윗" : "자기계발";
      item.innerHTML = '<span class="label"></span><span class="kind">' + kindLabel + "</span>";
      item.querySelector(".label").textContent = a.label;
      item.onclick = function () { onPick(a.id); };
      list.appendChild(item);
    });
    list.classList.remove("hidden");
  }

  function hideActions() { $("action-list").classList.add("hidden"); }

  function setTurnDone(done) {
    $("next-day").disabled = !done;
    $("compose").style.opacity = done ? "0.4" : "1";
    $("compose").style.pointerEvents = done ? "none" : "auto";
  }

  function showEnding(ending, onNewGame) {
    var ov = $("ending-overlay");
    ov.innerHTML = '<div class="card"><h1></h1><p></p><button>새 게임</button></div>';
    ov.querySelector("h1").textContent = "🏆 " + ending.title;
    ov.querySelector("p").textContent = ending.text;
    ov.querySelector("button").onclick = onNewGame;
    ov.classList.remove("hidden");
  }

  function switchView(name) {
    ["home", "profile", "notif"].forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
    });
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === name);
    });
  }

  return { renderAll: renderAll, showActions: showActions, hideActions: hideActions,
    setTurnDone: setTurnDone, showEnding: showEnding, switchView: switchView };
})();
if (typeof module !== "undefined") module.exports = UI;
```

- [ ] **Step 2: main.js 작성**

```js
(function () {
  var SAVE_KEY = "twitterGame.save";

  function load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  }
  function save(state) { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

  var game = Engine.create(GAME_DATA, load());
  var turnDone = false;

  function refresh() {
    UI.renderAll(game.getState());
    UI.setTurnDone(turnDone);
  }

  document.getElementById("compose").onclick = function () {
    if (turnDone) return;
    UI.showActions(game.getActions(), function (actionId) {
      UI.hideActions();
      var result = game.advanceTurn(actionId);
      turnDone = true;
      save(game.getState());
      refresh();
      if (result.ending) {
        UI.showEnding(result.ending, newGame);
      }
    });
  };

  document.getElementById("next-day").onclick = function () {
    turnDone = false;
    refresh();
  };

  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.onclick = function () { UI.switchView(btn.dataset.view); };
  });

  function newGame() {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
  document.getElementById("new-game").onclick = function () {
    if (confirm("저장된 게임을 지우고 새로 시작할까요?")) newGame();
  };

  var st = game.getState();
  if (st.ending) {
    var hit = GAME_DATA.endings.list.filter(function (e) { return e.id === st.ending; })[0];
    UI.showEnding({ id: hit.id, title: hit.title, text: hit.text }, newGame);
  }
  refresh();
})();
```

- [ ] **Step 3: 브라우저 수동 검증**

Run: `start index.html`
체크리스트:
1. 컴포즈 클릭 → 행동 목록 표시 (일상/유머/글쓰기 연습/밈 공부/트렌드 조사/휴식 — 정보글·떡밥은 잠김)
2. 행동 선택 → 피드에 내 트윗(+리플 가능) 추가, 컴포즈 흐려지고 "다음 날" 활성화
3. "다음 날" → 2일차, 컴포즈 재활성
4. 프로필 탭 → 스탯 5종 + 내 트윗 목록
5. 새로고침 → 상태 유지 (localStorage)
6. "새 게임" → confirm 후 초기화
7. (빠른 엔딩 확인) 콘솔에서 `localStorage.removeItem("twitterGame.save"); location.reload()` 후, 콘솔로 저장 데이터를 조작하는 대신 — data/endings.js의 threshold를 잠시 100으로 낮춰 몇 턴 플레이 → 엔딩 오버레이 확인 → **반드시 10000으로 되돌리기**

- [ ] **Step 4: 회귀 확인 및 커밋**

Run: `node test/engine.test.js && node test/sim.js` — 전부 OK 확인.

```bash
git add js/ui.js js/main.js data/endings.js
git commit -m "feat: UI 렌더링, 게임 배선, localStorage 저장"
```

---

### Task 9: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `node test/engine.test.js` → Task 1~5 전부 OK
Run: `node test/sim.js` → 3개 전략 엔딩 도달 + sim OK

- [ ] **Step 2: 브라우저 최종 플레이**

`start index.html` — Task 8 체크리스트 재확인 + 논란성을 올려(떡밥 해금 후 반복) backlash 이벤트가 알림 뱃지·이벤트 선택지로 뜨는지 확인.

- [ ] **Step 3: 최종 커밋**

작업 트리가 깨끗한지 확인 (`git status`). 남은 변경이 있으면 커밋.
