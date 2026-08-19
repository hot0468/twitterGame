# 트윗 속성과 반응 스탯 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NPC 트윗에 속성을 부여하고, 같은 속성 트윗 5개에 반응할 때마다 대응 스탯이 +1 오르게 한다.

**Architecture:** 속성은 계정의 첫 카테고리(`reactsTo[0]`)가 기본값이고 트윗별 예외를 허용한다.
`toggleReaction`이 트윗당 한 번만 `state.reactCount`를 올리고, 5가 차면 스탯 +1 후 0으로 되돌린다.
UI는 트윗 우상단에 속성 아이콘을, 반응한 자리에 게이지 토스트를 그린다.

**Tech Stack:** 바닐라 JS(ES5 스타일), 빌드 도구 없음, 외부 의존성 없음. 테스트는 `node`로 직접 실행.

설계 문서: `docs/superpowers/specs/2026-08-19-tweet-attributes-design.md`

## Global Constraints

- **바닐라 JS, 빌드 도구 없음, 외부 의존성 없음.** `var`와 `function` 사용(기존 코드 스타일).
- **`js/engine.js`는 DOM을 절대 모른다.** Node에서 직접 실행 가능해야 한다.
- **`js/ui.js`에 게임 규칙을 넣지 않는다.** 렌더링·클릭 처리만.
- **이모지 금지.** 아이콘은 `js/icons.js`의 `Icons.svg(name)`으로만.
- **CSS font-size는 `:root`의 `--fs-*` 변수로만.** px/rem 직접 지정 금지(하한 12px이 뚫린다).
- **데이터 파일(`data/*.js`)은 순수 데이터 리터럴만.** 로직 금지.
- **스탯은 정수로 유지한다.** 소수가 새어 나오면 안 된다.
- **반응은 하루를 소모하지 않는다.** `advanceTurn`과 무관한 별도 경로.
- 검증 명령 4종: `node test/engine.test.js` / `node test/sim.js` / `node test/check-css.js` / `node test/check-assets.js`
- 커밋 메시지는 한국어, 기존 형식(`feat:` / `fix:` / `docs:`)을 따른다.

---

### Task 1: 속성 매핑과 노브를 데이터에 추가

카테고리 → 스탯 매핑과 "몇 개마다 +1"인지를 `data/npcs.js`에 둔다.
엔진이 하드코딩하면 밸런스 조정 때 코드를 고쳐야 한다.

**Files:**
- Modify: `data/npcs.js` (`GAME_DATA.timeline` 선언 바로 앞)
- Test: `test/engine.test.js` (파일 끝에 추가)

**Interfaces:**
- Produces: `GAME_DATA.reaction = { perPoint: 5, attrStat: { humor, info, daily, bait } }`
  — Task 2~4가 `data.reaction`으로 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/engine.test.js` 파일 **끝**에 추가:

```js
// --- 트윗 속성: 데이터 노브 ---
var rx = loadData().reaction;
assert.ok(rx, "GAME_DATA.reaction이 있어야 한다");
assert.strictEqual(rx.perPoint, 5, "5개마다 스탯 +1");
assert.strictEqual(rx.attrStat.humor, "유머");
assert.strictEqual(rx.attrStat.info, "글빨");
assert.strictEqual(rx.attrStat.daily, "감각");
assert.strictEqual(rx.attrStat.bait, "논란성");
// 모든 계정의 첫 카테고리가 매핑에 있어야 한다 — 없으면 그 계정 트윗은 스탯을 못 준다
loadData().npcs.forEach(function (n) {
  assert.ok(rx.attrStat[n.reactsTo[0]],
    n.handle + "의 첫 카테고리 " + n.reactsTo[0] + "가 attrStat에 없다");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test/engine.test.js`
Expected: FAIL — `GAME_DATA.reaction이 있어야 한다`

- [ ] **Step 3: 데이터를 추가한다**

`data/npcs.js`에서 `GAME_DATA.timeline = {` 선언 **바로 앞**에 추가:

```js
// 남의 트윗에 반응하면 오르는 스탯. 트윗의 속성(계정 카테고리 또는 트윗별 지정)이
// 어느 스탯으로 가는지, 몇 개를 모아야 +1인지를 정한다.
//
// bait가 논란성으로 가는 게 핵심이다 — 떡밥 계정을 챙겨보면 논란성이 쌓인다.
// 반응이 순수한 이득이 아니라 선택이 되고, 논란성 이벤트가 실제로 반응한다.
//
// perPoint: 같은 속성 트윗 몇 개에 반응해야 그 스탯이 +1인가.
//   소수(+0.2)를 누적하지 않는 이유는 스탯이 여태 정수만 다뤄왔기 때문이다 —
//   소수를 들이면 스탯 패널이 "글빨 7.0"처럼 전부 소수점을 달게 된다.
//   이 값을 바꾸면 js/ui.js의 GAIN_MAX도 같이 맞춰야 게이지 칸 수가 안 어긋난다.
GAME_DATA.reaction = {
  perPoint: 5,
  attrStat: { humor: "유머", info: "글빨", daily: "감각", bait: "논란성" }
};
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node test/engine.test.js`
Expected: PASS (에러 없이 끝남)

- [ ] **Step 5: 커밋**

```bash
git add data/npcs.js test/engine.test.js
git commit -m "feat: 트윗 속성 → 스탯 매핑 데이터 추가"
```

---

### Task 2: 트윗 속성 결정 — 문자열/객체 혼용 파싱

`tweets` 배열의 항목이 문자열이면 계정 기본 속성을, `{ t, a }` 객체면 지정 속성을 쓴다.
보관함에 넣을 때 트윗마다 `attr`을 기록한다.

**Files:**
- Modify: `js/engine.js` (`addTweets` 함수, 약 296행)
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: `data.reaction.attrStat` (Task 1)
- Produces: 보관함 트윗 객체에 `attr` 필드(`"humor"` 등 카테고리 문자열).
  `src`는 계속 **치환 전 원문 문자열**이라 중복 판정이 그대로 동작한다.
  Task 3이 `t.attr`을 읽고, Task 4가 `item.attr`로 배지를 그린다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/engine.test.js` 끝에 추가:

```js
// --- 트윗 속성: 계정 기본값과 트윗별 예외 ---
// 모든 보관함 트윗이 유효한 속성을 갖는다
var gAttr = Engine.create(loadData());
var sAttr = gAttr.getState();
var attrStatMap = loadData().reaction.attrStat;
Object.keys(sAttr.npcTweets).forEach(function (h) {
  sAttr.npcTweets[h].forEach(function (t) {
    assert.ok(t.attr, h + "의 트윗에 attr이 없다: " + t.text);
    assert.ok(attrStatMap[t.attr], "알 수 없는 attr: " + t.attr);
  });
});

// 객체 표기 { t, a }가 계정 기본값을 덮어쓴다
var dOverride = loadData();
dOverride.npcs = [{ handle: "@t_attr", name: "테스트", bio: "b", followers: 100,
  reactsTo: ["humor"], replies: ["r"],
  tweets: [{ t: "떡밥으로 지정한 트윗입니다", a: "bait" }] }];
dOverride.timeline = Object.assign({}, dOverride.timeline, { startFollowing: 1 });
var gOv = Engine.create(dOverride);
var boxOv = gOv.getState().npcTweets["@t_attr"];
assert.ok(boxOv && boxOv.length, "보관함이 채워져야 한다");
assert.strictEqual(boxOv[0].attr, "bait", "객체 표기가 계정 기본값(humor)을 덮어쓴다");
assert.strictEqual(boxOv[0].text, "떡밥으로 지정한 트윗입니다", "text에 표기가 새어나오면 안 된다");
assert.strictEqual(boxOv[0].src, "떡밥으로 지정한 트윗입니다", "src도 본문 문자열이다");
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test/engine.test.js`
Expected: FAIL — `...의 트윗에 attr이 없다`

- [ ] **Step 3: 헬퍼 두 개를 추가한다**

`js/engine.js`의 `addTweets` 함수 **바로 앞**에 추가:

```js
    // 트윗 데이터는 문자열이거나 { t: 본문, a: 속성 } 객체다.
    // 객체는 계정 기본 속성과 다르게 잡은 예외를 위한 것이고, 거의 쓰지 않는다.
    function tweetText(raw) { return typeof raw === "string" ? raw : raw.t; }

    // 속성 결정: 트윗에 지정돼 있으면 그것, 없으면 그 계정의 첫 카테고리.
    // "계정 하나 = 컨셉 하나"라 계정 카테고리가 기본값인 게 자연스럽다.
    function tweetAttr(raw, npc) {
      if (typeof raw !== "string" && raw.a) return raw.a;
      return npc.reactsTo[0];
    }
```

- [ ] **Step 4: `addTweets`의 트윗 생성 부분을 고친다**

`js/engine.js`의 `addTweets` 안에서 아래 블록을 찾는다:

```js
        var used = {};
        box.concat(made).forEach(function (t) { used[t.src || t.text] = true; });
        var free = npc.tweets.filter(function (t) { return !used[t]; });
        if (!free.length) break; // 낼 새 트윗이 없으면 그 날은 안 올린다
        var src = pick(free);
        // id는 내 트윗과 같은 seq를 쓴다 — 겹치지 않아야 상세 페이지가 엉키지 않는다.
        // 보관함에만 있는 트윗도 상세로 열 수 있어야 하므로 전부 id를 받는다.
        var t = { id: "tw" + ++state.tweetSeq, src: src,
          author: npc.handle, name: npc.name, kind: "npc",
          text: fillTemplate(src), day: dayOf(i) };
```

아래로 교체한다:

```js
        var used = {};
        box.concat(made).forEach(function (t) { used[t.src || t.text] = true; });
        // 트윗은 문자열이거나 { t, a } 객체다 — 객체는 속성을 계정 기본값과 다르게 잡은 예외다.
        // 중복 판정은 본문 문자열로 하므로 표기와 무관하게 같은 트윗은 한 번만 나온다.
        var free = npc.tweets.filter(function (t) { return !used[tweetText(t)]; });
        if (!free.length) break; // 낼 새 트윗이 없으면 그 날은 안 올린다
        var raw = pick(free);
        var src = tweetText(raw);
        // id는 내 트윗과 같은 seq를 쓴다 — 겹치지 않아야 상세 페이지가 엉키지 않는다.
        // 보관함에만 있는 트윗도 상세로 열 수 있어야 하므로 전부 id를 받는다.
        var t = { id: "tw" + ++state.tweetSeq, src: src,
          author: npc.handle, name: npc.name, kind: "npc",
          text: fillTemplate(src), day: dayOf(i), attr: tweetAttr(raw, npc) };
```

- [ ] **Step 5: 통과를 확인한다**

Run: `node test/engine.test.js`
Expected: PASS

- [ ] **Step 6: 계정 검사가 깨지지 않았는지 확인한다**

Run: `node test/check-assets.js`
Expected: PASS.

FAIL이면 `check-assets.js`가 `tweets` 항목을 문자열로 단정하는 곳이 있다는 뜻이다.
그 파일에서 `npc.tweets`를 훑는 부분을 찾아, 본문을 꺼내는 헬퍼를 파일 상단에 추가하고

```js
// 트윗 항목은 문자열이거나 { t: 본문, a: 속성 } 객체다
function tweetText(raw) { return typeof raw === "string" ? raw : raw.t; }
```

`t` 대신 `tweetText(t)`를 쓰도록 고친다(길이 검사·중복 검사·치환 검사 전부).

- [ ] **Step 7: 커밋**

```bash
git add js/engine.js test/engine.test.js test/check-assets.js
git commit -m "feat: 트윗 속성 결정 - 계정 기본값과 트윗별 예외"
```

---

### Task 3: 반응 카운터와 스탯 상승

`toggleReaction`이 트윗당 한 번만 카운터를 올리고, 5가 차면 스탯 +1.

**Files:**
- Modify: `js/engine.js` (`initialState` 약 59행, `create`의 보정 블록 약 128행, `toggleReaction` 약 544행)
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: `t.attr` (Task 2), `data.reaction` (Task 1)
- Produces: `toggleReaction(id, kind)` 반환값 —
  `{ id, kind, on, gain }`. `gain`은 `{ stat: "유머", count: 3, leveled: false }` 또는 `null`.
  `count`는 반응 후 카운터(0~4, 방금 올랐으면 0), `leveled`는 이번에 스탯이 올랐는지.
  이미 센 트윗이면 `gain`은 `null`. Task 5(UI)가 `UI.showGain(gain, x, y)`로 받는다.
- Produces: `state.reactCount = { 글빨: n, 유머: n, 감각: n, 논란성: n }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/engine.test.js` 끝에 추가:

```js
// --- 반응 카운터와 스탯 상승 ---
// 트윗이 전부 humor인 계정 하나만 두고 시작한다 — 카운터를 정확히 셀 수 있다
function reactData(handle, cat, prefix) {
  var d = loadData();
  d.npcs = [{ handle: handle, name: "테스트", bio: "b", followers: 100,
    reactsTo: [cat], replies: ["r"],
    tweets: [prefix + " 첫번째 트윗입니다", prefix + " 두번째 트윗입니다",
             prefix + " 세번째 트윗입니다", prefix + " 네번째 트윗입니다",
             prefix + " 다섯번째 트윗입니다", prefix + " 여섯번째 트윗입니다"] }];
  d.timeline = Object.assign({}, d.timeline,
    { startFollowing: 1, gen: Object.assign({}, d.timeline.gen, { seed: 6, max: 6 }) });
  return d;
}
function reactGame() { return Engine.create(reactData("@t_react", "humor", "가")); }

var gR = reactGame();
var boxR = gR.getState().npcTweets["@t_react"];
assert.strictEqual(boxR.length, 6, "보관함에 6개");

// 첫 반응: 카운터 1, 스탯은 아직 그대로
var humor0 = gR.getState().stats.유머;
var r1 = gR.toggleReaction(boxR[0].id, "like");
assert.strictEqual(r1.gain.stat, "유머");
assert.strictEqual(r1.gain.count, 1);
assert.strictEqual(r1.gain.leveled, false);
assert.strictEqual(gR.getState().stats.유머, humor0, "1개로는 안 오른다");

// 같은 트윗을 리트윗해도 추가로 세지 않는다 (트윗당 1회)
var r2 = gR.toggleReaction(boxR[0].id, "rt");
assert.strictEqual(r2.gain, null, "이미 센 트윗은 gain이 null");
assert.strictEqual(gR.getState().reactCount.유머, 1, "카운터가 안 늘어야 한다");

// 취소해도 되돌리지 않는다
gR.toggleReaction(boxR[0].id, "like");
assert.strictEqual(gR.getState().reactCount.유머, 1, "취소해도 카운터 유지");
// 다시 눌러도 추가되지 않는다 — 없으면 켜고 끄기로 무한 증식한다
gR.toggleReaction(boxR[0].id, "like");
assert.strictEqual(gR.getState().reactCount.유머, 1, "재반응해도 카운터 유지");

// 5개를 채우면 +1, 카운터는 0으로
for (var iR = 1; iR < 5; iR++) gR.toggleReaction(boxR[iR].id, "like");
assert.strictEqual(gR.getState().stats.유머, humor0 + 1, "5개 채우면 +1");
assert.strictEqual(gR.getState().reactCount.유머, 0, "카운터는 0으로");
assert.strictEqual(gR.getState().stats.유머 % 1, 0, "스탯은 정수");

// 5번째 반응의 gain이 leveled를 알린다
var gR2 = reactGame();
var boxR2 = gR2.getState().npcTweets["@t_react"];
for (var jR = 0; jR < 4; jR++) gR2.toggleReaction(boxR2[jR].id, "like");
var r5 = gR2.toggleReaction(boxR2[4].id, "like");
assert.strictEqual(r5.gain.leveled, true, "5번째는 leveled");
assert.strictEqual(r5.gain.count, 0, "오른 직후 카운터는 0");

// 반응은 하루를 소모하지 않는다
assert.strictEqual(gR2.getState().day, 1, "반응해도 날짜가 안 넘어간다");

// bait 속성은 논란성을 올린다
var gB = Engine.create(reactData("@t_bait", "bait", "나"));
var boxB = gB.getState().npcTweets["@t_bait"];
var con0 = gB.getState().stats.논란성;
for (var kR = 0; kR < 5; kR++) gB.toggleReaction(boxB[kR].id, "like");
assert.strictEqual(gB.getState().stats.논란성, con0 + 1, "bait는 논란성을 올린다");

// 모르는 입력은 null
assert.strictEqual(gR.toggleReaction("없는id", "like"), null);
assert.strictEqual(gR.toggleReaction(boxR[0].id, "이상한kind"), null);

// 옛 세이브에 reactCount가 없어도 채워진다
var savedOld = JSON.parse(JSON.stringify(reactGame().getState()));
delete savedOld.reactCount;
var gOld = Engine.create(reactData("@t_react", "humor", "가"), savedOld);
assert.ok(gOld.getState().reactCount, "reactCount가 채워져야 한다");
assert.strictEqual(gOld.getState().reactCount.유머, 0);

// 옛 세이브의 트윗에 attr이 채워진다 — 없으면 그 트윗은 영영 스탯을 안 준다
var savedNoAttr = JSON.parse(JSON.stringify(reactGame().getState()));
Object.keys(savedNoAttr.npcTweets).forEach(function (h) {
  savedNoAttr.npcTweets[h].forEach(function (t) { delete t.attr; });
});
var gNoAttr = Engine.create(reactData("@t_react", "humor", "가"), savedNoAttr);
var boxNA = gNoAttr.getState().npcTweets["@t_react"];
assert.strictEqual(boxNA[0].attr, "humor", "옛 세이브 트윗에 계정 기본 속성이 채워진다");
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test/engine.test.js`
Expected: FAIL — `r1.gain`이 `undefined`라 `Cannot read properties of undefined (reading 'stat')`

- [ ] **Step 3: `initialState`에 `reactCount`를 추가한다**

`js/engine.js`의 `initialState()`에 아래 줄이 있다(여러 필드가 한 줄에 모여 있다):

```js
      npcTweets: {}, npcSeen: {}, reacted: {}, following: {}, dms: {},
```

그 줄 **바로 아래**에 추가한다:

```js
      // 속성별 반응 카운터. perPoint(5)가 차면 그 스탯 +1하고 0으로 돌아간다.
      // 스탯을 정수로 유지하려고 소수 대신 카운터를 쓴다.
      reactCount: { 글빨: 0, 유머: 0, 감각: 0, 논란성: 0 },
```

`create()`의 `missing` 맵이 최상위 필드를 자동으로 채우므로
(`Object.keys(blank).forEach(...)`), 옛 세이브 보정은 따로 안 해도 된다.

- [ ] **Step 4: 옛 세이브의 트윗에 `attr`을 채운다**

`js/engine.js`의 `create()`에서 `setCounts` 보정 블록(`state.feed.forEach(function (f) { ... setCounts ... });`)
**바로 뒤**에 추가:

```js
    // 옛 세이브의 트윗에는 attr이 없다 — 없으면 그 트윗은 영영 스탯을 안 준다.
    // 계정 기본 속성(첫 카테고리)으로 채운다. 보관함과 피드 양쪽 다 훑어야 한다.
    Object.keys(state.npcTweets).forEach(function (h) {
      var npcA = npcHandles[h];
      state.npcTweets[h].forEach(function (t) {
        if (!t.attr && npcA) t.attr = npcA.reactsTo[0];
      });
    });
    state.feed.forEach(function (f) {
      var npcF = npcHandles[f.author];
      if (f.kind === "npc" && !f.attr && npcF) f.attr = npcF.reactsTo[0];
    });
```

- [ ] **Step 5: 트윗 조회 헬퍼를 추가한다**

`js/engine.js`의 `toggleReaction` 함수 **바로 앞**에 추가:

```js
    // 반응 대상 트윗을 찾는다. 보관함에만 있고 feed에는 없는 과거 트윗도 대상이라
    // 양쪽을 다 뒤진다(저장/복원 뒤 서로 다른 객체다).
    function findNpcTweet(id) {
      var found = null;
      Object.keys(state.npcTweets).forEach(function (h) {
        state.npcTweets[h].forEach(function (t) { if (t.id === id) found = t; });
      });
      if (found) return found;
      state.feed.forEach(function (f) { if (f.kind === "npc" && f.id === id) found = f; });
      return found;
    }
```

- [ ] **Step 6: `toggleReaction`을 교체한다**

`js/engine.js`의 `toggleReaction` 함수 전체를 아래로 교체:

```js
    // 남의 트윗 좋아요/리트윗. 하루를 소모하지 않고 advanceTurn을 거치지 않는다.
    //
    // 트윗 하나는 카운터를 정확히 한 번만 올린다(gained). 좋아요든 리트윗이든 먼저 누른
    // 쪽에서 오르고, 취소해도 되돌리지 않으며 다시 눌러도 추가되지 않는다 —
    // 안 그러면 켜고 끄기를 반복해 무한히 스탯을 뽑을 수 있다.
    function toggleReaction(tweetId, kind) {
      if (!tweetId || (kind !== "like" && kind !== "rt")) return null;
      var t = findNpcTweet(tweetId);
      if (!t) return null;
      var r = state.reacted[tweetId] || (state.reacted[tweetId] = {});
      r[kind] = !r[kind];
      // 리트윗한 날을 남긴다 — 내 타임라인에 그 날짜로 꽂히는 근거다.
      // 취소하면 지운다: 다시 리트윗하면 그날로 새로 올라와야 한다.
      if (kind === "rt") { if (r.rt) r.rtDay = state.day; else delete r.rtDay; }

      var gain = null;
      // 켤 때만, 그리고 이 트윗을 아직 안 셌을 때만 카운터가 오른다.
      if (r[kind] && !r.gained) {
        r.gained = true;
        var rules = data.reaction, stat = rules && rules.attrStat[t.attr];
        if (stat) {
          var n = (state.reactCount[stat] || 0) + 1, leveled = false;
          if (n >= rules.perPoint) {
            n = 0;
            leveled = true;
            state.stats[stat] = clampStat(stat, state.stats[stat] + 1);
          }
          state.reactCount[stat] = n;
          gain = { stat: stat, count: n, leveled: leveled };
        }
      }
      return { id: tweetId, kind: kind, on: r[kind], gain: gain };
    }
```

- [ ] **Step 7: 통과를 확인한다**

Run: `node test/engine.test.js`
Expected: PASS

- [ ] **Step 8: 전체 검증**

```bash
node test/engine.test.js && node test/sim.js && node test/check-assets.js
```

Expected: 셋 다 PASS. `sim.js`의 네 전략이 전부 100만에 도달해야 한다
(시뮬레이션은 반응을 안 하므로 도달 일수가 변하면 안 된다 — 변했다면 카운터가
`advanceTurn` 경로로 새어 들어간 것이다).

- [ ] **Step 9: 커밋**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: 반응 카운터 - 같은 속성 5개마다 스탯 +1"
```

---

### Task 4: 트윗 우상단 속성 아이콘 + 날짜 이동

**Files:**
- Modify: `js/icons.js` (PATHS에 `trending-up` 추가)
- Modify: `js/ui.js` (`STAT_STYLE` 아래, `tweetEl` 약 143행)
- Modify: `css/style.css`
- Test: `node test/check-css.js` + 브라우저 육안 확인

**Interfaces:**
- Consumes: `item.attr` (Task 2), `reactedNow[id].gained` (Task 3)
- Produces: `ATTR_STAT` (ui.js 내부), `.attr-badge` 요소 —
  Task 5의 토스트가 같은 `STAT_STYLE` 아이콘·tone을 쓴다.

- [ ] **Step 1: 기존 아이콘 표기 형식을 확인한다**

Run: `grep -n "flame\|laugh\|feather" js/icons.js`

`trending-up`을 PATHS에 추가할 때 **그 형식에 맞춘다**. lucide `trending-up`의 path는:

```
<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
```

기존 항목이 문자열 하나면 문자열로, 배열이면 배열로 넣는다. 키에 하이픈이 있으므로
`"trending-up":` 처럼 따옴표로 감싼다.

- [ ] **Step 2: `ATTR_STAT` 매핑을 ui.js에 추가한다**

`js/ui.js`의 `STAT_STYLE` 선언 **바로 아래**에 추가:

```js
  // 트윗 속성 → 스탯. data/npcs.js의 reaction.attrStat과 같은 값이다
  // (ui.js는 표기만 담당하고 규칙은 엔진에 있다).
  var ATTR_STAT = { humor: "유머", info: "글빨", daily: "감각", bait: "논란성" };
```

- [ ] **Step 3: 배지 헬퍼를 추가한다**

`js/ui.js`의 `tweetEl` 함수 **바로 앞**에 추가:

```js
  // 남의 트윗 우상단 속성 배지. 내 트윗·답글·이벤트엔 붙지 않는다(NPC 트윗만 반응 대상).
  // 이미 센 트윗(gained)은 반투명 — 정보는 남으면서 아직 얻을 게 있는 트윗이 눈에 띈다.
  function attrBadge(item) {
    if (item.kind !== "npc" || !item.attr) return "";
    var stat = ATTR_STAT[item.attr];
    if (!stat) return "";
    var style = STAT_STYLE[stat] || { icon: "trending-up", tone: "ink" };
    var done = (reactedNow[item.id] || {}).gained ? " done" : "";
    return '<span class="attr-badge tone-' + style.tone + done + '" title="' + stat + '">' +
      Icons.svg(style.icon) + "</span>";
  }
```

- [ ] **Step 4: `tweetEl`의 마크업을 교체한다**

`js/ui.js`의 `tweetEl`에서 아래 블록을 찾는다:

```js
    div.innerHTML =
      '<div class="avatar"' + avatarAttr(item) + ">" + avatarInner(item) + "</div>" +
      '<div class="body">' + rtLabel + '<span class="who"></span> <span class="handle"></span>' +
      '<div class="text"></div><div class="meta"><span>' + shortDate(item.day) + "</span>" + metrics +
      "</div>" + reactRow(item) + "</div>";
```

아래로 교체한다. 날짜가 이름·핸들 옆으로 오고, `.meta`에는 내 트윗의 수치만 남는다:

```js
    // 속성 배지: 무엇이 오를지 누르기 전에 보인다.
    // 날짜는 이름·핸들 옆에 둔다(실제 X 구조). .meta에는 내 트윗의 수치만 남는다.
    div.innerHTML =
      '<div class="avatar"' + avatarAttr(item) + ">" + avatarInner(item) + "</div>" +
      '<div class="body">' + rtLabel + attrBadge(item) +
      '<span class="who"></span> <span class="handle"></span>' +
      '<span class="stamp">· ' + shortDate(item.day) + "</span>" +
      '<div class="text"></div>' +
      (metrics ? '<div class="meta">' + metrics + "</div>" : "") +
      reactRow(item) + "</div>";
```

- [ ] **Step 5: 쓰는 CSS 변수가 실제로 있는지 확인한다**

```bash
grep -n "\-\-muted\|\-\-fs-sm\|\-\-line\|\-\-bg" css/style.css | head -8
grep -n "tone-hot\|tone-warm\|tone-ink\|tone-violet" css/style.css | head -8
```

`:root`에 없는 변수를 쓰면 그 선언이 통째로 무효가 되어 조용히 사라진다
(`check-css.js`가 잡는다). 없는 이름은 실제로 있는 이름으로 바꿔서 쓴다.
`tone-*`가 이미 정의돼 있으면 색은 그대로 물려받는다.

- [ ] **Step 6: CSS를 추가한다**

`css/style.css`에 추가한다. **font-size는 `--fs-*` 변수로만** 쓴다:

```css
/* 트윗 우상단 속성 배지. 무엇이 오를지 누르기 전에 보여준다. */
.tweet .body { position: relative; }
.attr-badge {
  position: absolute; top: 0; right: 0;
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.5rem; height: 1.5rem;
  opacity: 0.85;
}
.attr-badge .icon { width: 1rem; }
/* 이미 스탯을 준 트윗은 흐리게 — 아직 얻을 게 있는 트윗이 눈에 띈다 */
.attr-badge.done { opacity: 0.25; }

/* 이름·핸들 옆 날짜 (실제 X 구조) */
.tweet .stamp { color: var(--muted); font-size: var(--fs-sm); }
```

Step 5에서 `--muted`/`--fs-sm`이 없었다면 그 자리에 실제 이름을 넣는다.

- [ ] **Step 7: CSS 검사를 돌린다**

Run: `node test/check-css.js`
Expected: PASS — 실패하면 정의 안 된 `var()`나 raw font-size가 있다는 뜻이다.

- [ ] **Step 8: 브라우저에서 눈으로 확인한다**

`index.html`을 연다. 첫 화면은 빈 타임라인이므로(`startFollowing: 0`)
**먼저 한 턴을 돌려 계정을 만나야 한다**. 그 뒤 확인:

- NPC 트윗 우상단에 속성 아이콘이 뜬다
- 내 트윗·이벤트·정산 카드에는 배지가 없다
- 날짜가 이름·핸들 옆에 있다
- 내 트윗의 조회수·좋아요·리트윗은 여전히 본문 아래에 있다
- 좋아요를 누르면 그 트윗 배지가 흐려진다
- 좁은 창(≤640px)에서 배지가 본문을 가리지 않는다

- [ ] **Step 9: 커밋**

```bash
git add js/icons.js js/ui.js css/style.css
git commit -m "feat: 트윗 속성 아이콘 + 날짜를 계정명 옆으로"
```

---

### Task 5: 반응 게이지 토스트

반응한 자리 근처에 게이지가 뜨고, 연타하면 위치만 옮기며 이어서 찬다.
5칸이 차면 터지는 연출.

**Files:**
- Modify: `index.html` (토스트 컨테이너 추가)
- Modify: `js/ui.js` (`showGain` 추가 + 공개 객체에 등록)
- Modify: `js/main.js` (클릭 핸들러 두 곳: 약 129행 `rtDo`, 약 167행 `react`)
- Modify: `css/style.css`
- Test: `node test/check-css.js` + 브라우저 육안 확인

**Interfaces:**
- Consumes: `toggleReaction`의 반환값 `.gain` (Task 3), `ATTR_STAT`·`STAT_STYLE` (Task 4)
- Produces: `UI.showGain(gain, x, y)` — `gain`이 `null`이면 아무것도 안 한다.
  `x`/`y`는 클릭 이벤트의 `clientX`/`clientY`.

- [ ] **Step 1: 토스트 컨테이너를 `index.html`에 추가한다**

`</body>` **바로 앞**(다른 오버레이들과 같은 위치)에 추가:

```html
  <div id="gain-toast" class="gain-toast" hidden></div>
```

피드 바깥에 둬야 `refresh()`가 다시 그려도 토스트가 안 지워진다.

- [ ] **Step 2: `GAIN_MAX`를 추가한다**

`js/ui.js`의 `ATTR_STAT` 선언 **바로 아래**에 추가:

```js
  // 게이지 칸 수. data/npcs.js의 reaction.perPoint와 같아야 한다(표기용 복제).
  var GAIN_MAX = 5;
```

- [ ] **Step 3: `showGain`을 추가한다**

`js/ui.js`의 `renderAll` 선언 **바로 앞**에 추가:

```js
  // 반응 게이지 토스트. 누른 자리 근처에 떠서 5칸 중 몇 칸이 찼는지 보여준다.
  // 게이지를 상시로 두면 화면이 지저분하고, 없으면 진행이 안 보인다 — 누른 순간에만.
  var gainTimer = null;

  function showGain(gain, x, y) {
    if (!gain) return; // 이미 센 트윗은 아무 일도 안 일어났으니 띄우지 않는다
    var el = $("gain-toast");
    var style = STAT_STYLE[gain.stat] || { icon: "trending-up", tone: "ink" };
    // leveled면 게이지가 꽉 찬 상태로 보여준다 — count는 이미 0으로 돌아갔다
    var filled = gain.leveled ? GAIN_MAX : gain.count;
    var cells = "";
    for (var i = 0; i < GAIN_MAX; i++)
      cells += '<span class="cell' + (i < filled ? " on" : "") + '"></span>';
    el.className = "gain-toast tone-" + style.tone + (gain.leveled ? " leveled" : "");
    el.innerHTML = Icons.svg(style.icon) +
      '<span class="gain-bar">' + cells + "</span>" +
      '<span class="gain-label">' + gain.stat + (gain.leveled ? " +1" : "") + "</span>";
    el.hidden = false;

    // 위치는 클릭 지점 근처. 화면 밖으로 나가지 않게 안쪽으로 밀어 넣는다.
    // hidden을 푼 뒤에 재야 offsetWidth가 0이 아니다.
    var pad = 8, w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.min(Math.max(pad, x - w / 2), window.innerWidth - w - pad);
    var top = y - h - 12;
    if (top < pad) top = y + 20; // 위가 좁으면 아래로 편다
    el.style.left = left + "px";
    el.style.top = top + "px";

    // 연타하면 새로 만들지 않고 이 하나를 옮긴다 — 여러 장이 쌓이면 화면을 덮는다.
    if (gainTimer) clearTimeout(gainTimer);
    gainTimer = setTimeout(function () { el.hidden = true; },
      gain.leveled ? 1600 : 1000); // 스탯이 오른 순간은 조금 더 머문다
  }
```

- [ ] **Step 4: 공개 객체에 등록한다**

`js/ui.js` 파일 끝의 `return { ... }`에 추가:

```js
    showGain: showGain,
```

- [ ] **Step 5: CSS를 추가한다**

`css/style.css`에 추가:

```css
/* 반응 게이지 토스트. 누른 자리 근처에 잠깐 떴다 사라진다. */
.gain-toast {
  position: fixed; z-index: 60;
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.6rem; border-radius: 999px;
  background: var(--bg); border: 1px solid var(--line);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  font-size: var(--fs-xs); white-space: nowrap;
  pointer-events: none;
}
.gain-toast .icon { width: 1.1rem; }
.gain-bar { display: inline-flex; gap: 0.15rem; }
.gain-bar .cell {
  width: 0.7rem; height: 0.3rem; border-radius: 999px;
  background: var(--line);
}
.gain-bar .cell.on { background: currentColor; }
.gain-label { color: var(--muted); }

/* 5칸이 다 차면 터진다 */
.gain-toast.leveled { animation: gain-pop 0.4s ease-out; }
.gain-toast.leveled .gain-label { color: currentColor; font-weight: 700; }
@keyframes gain-pop {
  0% { transform: scale(0.8); }
  45% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
```

`z-index: 60`은 하단 독바보다 위여야 한다. 독바의 z-index를 확인하고
그보다 낮으면 올린다: `grep -n "z-index" css/style.css`

- [ ] **Step 6: `js/main.js`의 리트윗 핸들러를 고친다**

`js/main.js`에서 아래 블록을 찾는다:

```js
    var rtDo = e.target.closest("[data-rt-do]");
    if (rtDo) {
      game.toggleReaction(rtDo.dataset.rtId, "rt");
      UI.closeRtMenu();
      save(game.getState());
      refresh();
      return;
    }
```

아래로 교체한다:

```js
    var rtDo = e.target.closest("[data-rt-do]");
    if (rtDo) {
      var rtRes = game.toggleReaction(rtDo.dataset.rtId, "rt");
      UI.closeRtMenu();
      save(game.getState());
      refresh();
      // 렌더 뒤에 띄운다 — 토스트는 피드 바깥(#gain-toast)이라 지워지진 않지만
      // 배지의 흐려짐과 순서를 맞춘다.
      if (rtRes) UI.showGain(rtRes.gain, e.clientX, e.clientY);
      return;
    }
```

- [ ] **Step 7: `js/main.js`의 좋아요 핸들러를 고친다**

아래 블록을 찾는다:

```js
    var react = e.target.closest("[data-react]");
    if (react) {
      game.toggleReaction(react.dataset.reactId, react.dataset.react);
      save(game.getState());
      refresh();
      return;
    }
```

아래로 교체한다:

```js
    var react = e.target.closest("[data-react]");
    if (react) {
      var res = game.toggleReaction(react.dataset.reactId, react.dataset.react);
      save(game.getState());
      refresh();
      if (res) UI.showGain(res.gain, e.clientX, e.clientY);
      return;
    }
```

- [ ] **Step 8: CSS 검사를 돌린다**

Run: `node test/check-css.js`
Expected: PASS

- [ ] **Step 9: 브라우저에서 확인한다**

`index.html`을 열고 한 턴 이상 돌려 NPC 트윗을 만든 뒤:

- 좋아요를 누르면 누른 자리 근처에 게이지 토스트가 뜬다
- 연달아 누르면 토스트가 **새 위치로 옮겨가며** 칸이 하나씩 찬다(새 토스트가 쌓이지 않는다)
- 5번째에 게이지가 꽉 차고 터지는 연출 + `유머 +1`
- 스탯 패널의 그 스탯이 실제로 1 올랐다
- 이미 누른 트윗을 다시 누르면 토스트가 **안 뜬다**
- 화면 오른쪽 끝·맨 위 트윗에서 눌러도 토스트가 잘리지 않는다
- 모바일 폭(≤640px)에서 하단 독바에 안 가린다
- 리트윗 메뉴에서 재게시를 눌러도 토스트가 뜬다

- [ ] **Step 10: 커밋**

```bash
git add index.html js/ui.js js/main.js css/style.css
git commit -m "feat: 반응 게이지 토스트 - 누른 자리에 뜨고 5칸 차면 터진다"
```

---

### Task 6: 문서 갱신과 전체 검증

**Files:**
- Modify: `CLAUDE.md` ("남의 트윗에 반응" 절, 엔진 API 절, 트윗 데이터 절)
- Test: 검증 4종 전부

- [ ] **Step 1: "남의 트윗에 반응" 절의 첫 항목을 고친다**

`CLAUDE.md`에서 아래 줄을 찾는다:

```
- **스탯·팔로워에 영향이 없다.** 트윗 448개에 전부 누를 수 있어서, 팔로워를 주면 공짜 성장 경로가 된다. 친밀도 같은 걸 붙이려면 그 남용 경로를 먼저 막아야 한다.
```

아래로 교체한다:

```
- **팔로워엔 영향이 없다. 스탯은 트윗당 딱 한 번 센다.** 트윗마다 속성(`attr`)이 있고, 같은 속성 트윗 `reaction.perPoint`(5)개에 반응할 때마다 그 스탯이 +1 오른다. 팔로워를 주면 공짜 성장 경로가 되므로 팔로워는 여전히 안 준다.
  - 속성은 **계정의 첫 카테고리(`reactsTo[0]`)가 기본값**이고, `tweets`에 `{ t, a }` 객체로 적은 트윗만 예외로 덮어쓴다. 예외는 거의 안 쓴다.
  - 매핑은 `data/npcs.js`의 `reaction.attrStat`: humor→유머 / info→글빨 / daily→감각 / **bait→논란성**. 떡밥 계정을 챙겨보면 논란성이 쌓인다 — 반응이 순수한 이득이 아니라 **선택**이 되고, 이게 무제한 연타의 자정 장치다.
  - **트윗 하나는 카운터를 한 번만 올린다**(`state.reacted[id].gained`). 좋아요든 리트윗이든 먼저 누른 쪽에서 오르고, **취소해도 되돌리지 않으며 다시 눌러도 추가되지 않는다** — 안 그러면 켜고 끄기로 무한 증식한다.
  - **스탯은 정수로 유지한다.** 소수(+0.2)를 누적하면 스탯 패널이 `글빨 7.0`처럼 전부 소수점을 단다. 그래서 `state.reactCount`(속성별 0~4)에 세고 5가 찰 때 +1한다. 하루 한도는 없다 — 트윗당 1회가 상한이다.
  - 진행은 **반응한 자리에 뜨는 게이지 토스트**가 보여준다(`UI.showGain`). 연타하면 새로 만들지 않고 하나를 옮기며 이어서 채운다. 이미 센 트윗은 `gain`이 `null`이라 아예 안 뜬다.
  - 트윗 우상단 **속성 배지**는 스탯 패널과 같은 아이콘·tone을 쓴다(`ATTR_STAT` + `STAT_STYLE`). 이미 센 트윗은 반투명(`.done`). `GAIN_MAX`·`ATTR_STAT`은 `data/npcs.js`의 값을 표기용으로 복제한 것이라 노브를 바꾸면 같이 맞춰야 한다.
```

- [ ] **Step 2: 엔진 API 절을 고친다**

아래 줄을 찾는다:

```
  - `toggleReaction(tweetId, kind)` — 남의 트윗 좋아요/리트윗 토글. `kind`는 `"like"`/`"rt"`. **하루를 소모하지 않고 스탯도 안 건드린다**(위 "남의 트윗에 반응" 참고). 모르는 입력은 `null`.
```

아래로 교체한다:

```
  - `toggleReaction(tweetId, kind)` — 남의 트윗 좋아요/리트윗 토글. `kind`는 `"like"`/`"rt"`. **하루를 소모하지 않는다**(위 "남의 트윗에 반응" 참고). 반환값 `{ id, kind, on, gain }`의 `gain`은 `{ stat, count, leveled }`이거나 `null`(이미 센 트윗·모르는 속성). 모르는 입력은 `null`.
```

- [ ] **Step 3: 트윗 데이터 표기 규칙을 추가한다**

"### 트윗 (`tweets`) — 전 계정 공통" 절에서 **"트윗은 통째로 하나씩 저장한다"** 문단 뒤,
`- **보관함(...)**`으로 시작하는 첫 항목 **바로 앞**에 추가:

```
- **트윗 항목은 문자열이거나 `{ t: 본문, a: 속성 }` 객체다.** 객체는 그 트윗만 계정 기본 속성과 다르게 잡을 때 쓰고, 거의 안 쓴다. 중복 판정의 `src`는 **본문 문자열**이라 표기와 무관하게 같은 트윗은 한 번만 나온다.
```

- [ ] **Step 4: 검증 4종을 전부 돌린다**

```bash
node test/engine.test.js && node test/sim.js && node test/check-css.js && node test/check-assets.js
```

Expected: 넷 다 PASS. `sim.js`의 네 전략이 전부 100만에 도달해야 한다.

- [ ] **Step 5: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: 트윗 속성과 반응 스탯 규칙 반영"
```

---

## 참고: 밸런스 조정

`sim.js`는 반응을 시뮬레이션하지 않으므로 도달 일수가 변하지 않는다.
반응으로 얻는 실제 영향은 수동 플레이로 재야 한다.

조정이 필요하면 `data/npcs.js`의 `reaction.perPoint`만 바꾼다
(올리면 느려지고 내리면 빨라진다). `js/ui.js`의 `GAIN_MAX`도 같은 값으로 맞춰야
게이지 칸 수가 어긋나지 않는다.

수식의 실질 상한(`Math.min(감각, 40)` / `Math.min(유머, 40)`)이 폭주를 막고 있으므로
반응만으로 게임이 깨지진 않는다. 16계정을 전부 발견하면 320개가 열려
카테고리당 최대 +12~13이 되지만, 전탐색은 지루한 노동인 데다 `bait`에서 논란성이 함께 쌓인다.
