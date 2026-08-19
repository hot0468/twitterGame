# 괴담계 스토리 DM + 산책 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@old_records`가 조건을 충족한 플레이어에게 먼저 DM을 보내고, 산책하기 행동으로 폐교에 가서 한 선택이 갈래를 정하는 스토리를 만든다.

**Architecture:** 기존 DM(선택지 풀)과 분리된 `GAME_DATA.dm.stories` 갈래를 만든다.
노드 그래프를 `state.dmStory`가 따라가고, 지연 답장은 `pending: { to, day }`로 예약한다.
산책하기는 상시 행동이고, 폐교 이벤트는 `trigger.action` + `trigger.dmStory`로 그 행동·그 노드에서만 발동한다.

**Tech Stack:** 바닐라 JS(ES5 스타일), 빌드 도구 없음, 외부 의존성 없음. 테스트는 `node`로 직접 실행.

설계 문서: `docs/superpowers/specs/2026-08-19-ghost-story-dm-design.md`

## Global Constraints

- **바닐라 JS, 빌드 도구 없음, 외부 의존성 없음.** `var`와 `function` 사용(기존 코드 스타일).
- **`js/engine.js`는 DOM을 절대 모른다.** Node에서 직접 실행 가능해야 한다.
- **`js/ui.js`에 게임 규칙을 넣지 않는다.** 렌더링·클릭 처리만. 규칙은 엔진이 안다.
- **데이터 파일(`data/*.js`)은 순수 데이터 리터럴만.** 로직 금지.
- **DM은 하루를 안 쓰고 스탯도 안 건드린다.** 하루를 쓰는 건 산책이라는 행동 하나뿐이다.
- **이모지 금지.** 아이콘은 `Icons.svg(name)`으로만.
- **CSS font-size는 `:root`의 `--fs-*` 변수로만.** `:root`에 없는 변수 금지.
- **스탯은 정수 유지. 돈만 음수 허용**(`clampStat`).
- 게임 콘텐츠 텍스트와 주석은 한국어, 코드 식별자는 영어.
- 검증 4종: `node test/engine.test.js` / `node test/sim.js` / `node test/check-css.js` / `node test/check-assets.js`
- 커밋 메시지는 한국어, 기존 형식(`feat:` / `fix:` / `test:` / `docs:`)을 따른다.
- 브랜치는 `feat/tweet-attributes`다(반응 스탯 기능과 같은 브랜치).

## 이 코드베이스에서 미리 알아야 할 것

- **`dmRoom(handle)`이 `data.dm.accounts[handle]`을 확인한다** — 그 목록에 없으면 방을 못 만든다.
  스토리 계정(`@old_records`)은 `accounts`에 없으므로 이 함수를 반드시 손봐야 한다.
- **`js/ui.js`의 `renderDm`이 `accounts.indexOf(dmHandle)`으로 방 여부를 판단한다**(약 542행).
  스토리 계정도 포함되게 해야 대화방이 열린다.
- `state.reacted`엔 트윗 id만 있다 — 어느 계정 트윗인지는 보관함(`state.npcTweets`)을 봐야 안다.
- `create()`의 `missing` 맵이 **최상위 필드를 자동으로 채운다**(`Object.keys(blank).forEach`).
  `initialState()`에 넣기만 하면 옛 세이브 보정은 따로 필요 없다.
- 이벤트 선택지는 `getActions()`가 `"event:<id>:<idx>"` 형식으로 내보내고,
  `advanceTurn`이 그 접두로 분기한다(약 370행).

---

### Task 1: 산책하기 행동

스토리와 무관한 상시 행동을 먼저 넣는다. 이것만으로 독립적으로 동작해야 한다.

**Files:**
- Modify: `data/actions.js` (`rest` 행동 뒤)
- Test: `test/engine.test.js` (파일 끝)

**Interfaces:**
- Produces: 행동 id `"walk"` — Task 4의 폐교 이벤트가 `trigger.action: "walk"`로 건다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/engine.test.js` 파일 **끝**에 추가:

```js
// --- 산책하기 ---
var gWalk = Engine.create(loadData());
var walkIds = gWalk.getActions().map(function (a) { return a.id; });
assert.ok(walkIds.indexOf("walk") !== -1, "산책하기는 처음부터 고를 수 있다");

var beforeWalk = gWalk.getState().stats;
var m0 = beforeWalk.멘탈, s0 = beforeWalk.감각;
gWalk.advanceTurn("walk", false);
var afterWalk = gWalk.getState().stats;
assert.strictEqual(afterWalk.멘탈, Math.min(m0 + 8, m0 + 8), "산책은 멘탈 +8");
assert.strictEqual(afterWalk.감각, s0 + 1, "산책은 감각 +1");
assert.strictEqual(gWalk.getState().day, 2, "산책도 하루를 쓴다");

// 트윗으로 올릴 수도 있다
var gWalk2 = Engine.create(loadData());
var pv = gWalk2.previewAction("walk");
assert.ok(pv, "산책하기에 미리보기가 있다");
assert.strictEqual(pv.effects.멘탈, 8);
assert.ok(pv.tweetEffects, "트윗 효과가 있다");
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test/engine.test.js`
Expected: FAIL — `산책하기는 처음부터 고를 수 있다`

- [ ] **Step 3: 행동을 추가한다**

`data/actions.js`에서 `rest` 행동(`{ id: "rest", label: "휴식",` 로 시작하는 블록) **바로 뒤**에 추가:

```js
  // 산책. 휴식(멘탈 +15)보다 회복이 약한 대신 감각이 붙는다 — 걸으면서 바깥을 보는 행동이다.
  // 스토리 이벤트(폐교)가 이 행동에 걸리지만, 그것과 무관하게 상시 쓰는 행동이다.
  { id: "walk", label: "산책하기",
    effects: { "멘탈": 8, "감각": 1 },
    tweet: { category: "daily", effects: { "팔로워": "1 + 감각 + 팔로워*0.01" },
      templates: ["동네 한 바퀴 돌고 옴. 날씨가 좋았다", "걷다 보면 생각이 정리된다. 오늘은 좀 걸었다"] } },
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node test/engine.test.js`
Expected: PASS

- [ ] **Step 5: 전체 검증**

Run: `node test/engine.test.js && node test/sim.js && node test/check-assets.js`
Expected: 셋 다 PASS. `sim.js`의 다섯 전략이 전부 100만에 도달해야 한다.
(행동이 하나 늘어 `ids[0]` 폴백이 달라질 수 있으므로 도달 일수는 변할 수 있다. 도달 자체가 중요하다.)

- [ ] **Step 6: 커밋**

```bash
git add data/actions.js test/engine.test.js
git commit -m "feat: 산책하기 행동 추가 (멘탈 +8, 감각 +1)"
```

---

### Task 2: 계정별 반응 수 세기

스토리 시작 조건에 "그 계정 트윗에 반응 5개"가 있다. `state.reacted`엔 트윗 id만 있으므로
보관함을 훑어 계정별로 세는 함수가 필요하다.

**Files:**
- Modify: `js/engine.js` (`toggleReaction` 근처)
- Test: `test/engine.test.js`

**Interfaces:**
- Produces: `reactionsOn(handle)` → 그 계정 트윗 중 `gained`가 찍힌 수(정수).
  Task 3의 시작 조건이 쓴다. 엔진 내부 함수이고 공개 API는 아니다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/engine.test.js` 끝에 추가:

```js
// --- 계정별 반응 수 ---
// 트윗이 전부 있는 계정 하나만 두고 센다
function countData() {
  var d = loadData();
  d.npcs = [{ handle: "@t_count", name: "카운트", bio: "b", followers: 100,
    reactsTo: ["info"], replies: ["r"],
    tweets: ["가 첫번째 트윗입니다", "가 두번째 트윗입니다", "가 세번째 트윗입니다",
             "가 네번째 트윗입니다", "가 다섯번째 트윗입니다", "가 여섯번째 트윗입니다"] }];
  d.timeline = Object.assign({}, d.timeline,
    { startFollowing: 1, gen: Object.assign({}, d.timeline.gen, { seed: 6, max: 6 }) });
  return d;
}
var gCount = Engine.create(countData());
var boxCount = gCount.getState().npcTweets["@t_count"];
assert.strictEqual(gCount._reactionsOn("@t_count"), 0, "처음엔 0");
gCount.toggleReaction(boxCount[0].id, "like");
gCount.toggleReaction(boxCount[1].id, "rt");
assert.strictEqual(gCount._reactionsOn("@t_count"), 2, "좋아요와 리트윗을 합산");
// 같은 트윗을 또 눌러도 한 번만 센다
gCount.toggleReaction(boxCount[0].id, "rt");
assert.strictEqual(gCount._reactionsOn("@t_count"), 2, "트윗당 1회");
// 취소해도 줄지 않는다 (gained가 남는다)
gCount.toggleReaction(boxCount[0].id, "like");
assert.strictEqual(gCount._reactionsOn("@t_count"), 2, "취소해도 유지");
// 모르는 핸들은 0
assert.strictEqual(gCount._reactionsOn("@없는계정"), 0);
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test/engine.test.js`
Expected: FAIL — `gCount._reactionsOn is not a function`

- [ ] **Step 3: 함수를 추가한다**

`js/engine.js`의 `toggleReaction` 함수 **바로 뒤**에 추가:

```js
    // 그 계정 트윗 중 내가 반응해서 카운트된 수. 좋아요·리트윗 합산이고 트윗당 1회다
    // (gained가 그 기준이다 — toggleReaction과 같은 기준을 쓴다).
    // state.reacted엔 트윗 id만 있어서 어느 계정 것인지는 보관함을 봐야 안다.
    function reactionsOn(handle) {
      var box = state.npcTweets[handle];
      if (!box) return 0;
      var n = 0;
      box.forEach(function (t) {
        if ((state.reacted[t.id] || {}).gained) n++;
      });
      return n;
    }
```

- [ ] **Step 4: 공개 객체에 등록한다**

`js/engine.js`의 반환 객체(`return { getState: ...`로 시작하는 블록)에 추가한다.
**`_` 접두를 붙여 테스트 전용임을 표시한다** — 공개 API 4개(`getActions`/`previewAction`/`advanceTurn`/`toggleReaction`)와 구분한다:

```js
      _reactionsOn: reactionsOn,
```

- [ ] **Step 5: 통과를 확인한다**

Run: `node test/engine.test.js`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: 계정별 반응 수 세기 (스토리 조건용)"
```

---

### Task 3: 스토리 데이터와 엔진 진행

이야기 데이터를 넣고 엔진이 노드를 따라가게 한다. 아직 폐교 이벤트는 없으므로
s2에서 멈춘 채로 끝난다 — 그 상태까지가 이 태스크의 산출물이다.

**Files:**
- Modify: `data/dms.js` (파일 끝, `GAME_DATA.dm` 밖)
- Modify: `js/engine.js` (`initialState`, `dmRoom`, `advanceTurn`, 공개 객체)
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: `reactionsOn(handle)` (Task 2)
- Produces:
  - `GAME_DATA.dm.stories` — Task 4의 이벤트가 `"@핸들:노드"`로 가리킨다
  - `state.dmStory = { "@h": { node, pending: {to, day}|null, done } }`
  - `storyChoices(handle)` → `[{ idx, say }]` (대기·끝이면 빈 배열) — Task 5의 UI가 쓴다
  - `sendStory(handle, idx)` → `{ handle, msgs }` 또는 `null` — Task 5의 UI가 쓴다

- [ ] **Step 1: 스토리 데이터를 넣는다**

`data/dms.js` **파일 끝**(`GAME_DATA.dm = { ... };` 블록이 닫힌 **뒤**)에 추가한다.
`GAME_DATA.dm.stories`로 붙이므로 `GAME_DATA.dm` 리터럴 안에 넣지 않는다:

```js
// ── 스토리 DM ──────────────────────────────────────────────
// 기존 accounts(선택지 풀)와 다른 갈래다. 저쪽은 순서가 없고 이쪽은 순서가 전부라
// 같은 구조에 넣으면 규칙이 엉킨다.
//
// requires: 이 조건이 전부 맞는 턴에 확정으로 첫 DM이 온다(확률 없음).
//   reactions는 그 계정 트윗에 반응한 수(좋아요·리트윗 합산, 트윗당 1회).
// nodes: 노드 하나 = 상대의 말 + 내가 고를 선택지. choices의 to가 다음 노드를 가리킨다.
//   choices가 비면 대기(무언가 다른 것이 진행시킨다) 또는 끝(end: true).
//   delay: N이면 그 노드의 답장은 N일 뒤에 도착한다. 침묵이 이 이야기의 연출이다.
GAME_DATA.dm.stories = {

  // 「명단에 없는 이름」 — 사료 기록체를 유지하되 사적인 자리라 조금 더 무너진다.
  // s2에서 멈추고, 산책하기로 폐교에 가야(events.js의 old_school) s4a/s4b로 이어진다.
  "@old_records": {
    requires: { reactions: 5, "감각": ">=12", "글빨": "<20" },
    start: "s1",
    nodes: {
      "s1": {
        text: "제 기록을 계속 보고 계신 것 같아 실례를 무릅쓰고 씁니다.\n확인을 부탁드릴 것이 하나 있습니다.",
        choices: [
          { say: "무슨 일이신가요", to: "s2" },
          { say: "제가 도울 게 있나요", to: "s2" }
        ] },

      // 선택지 없음 = 대기. 폐교 이벤트가 s4a/s4b로 진행시킨다.
      "s2": {
        text: "작년에 폐교 명단을 정리하다 없는 이름을 하나 봤다고 적은 적이 있습니다.\n그 학교가 선생님 동네에 있습니다.\n지나는 길에 정문 앞 게시판만 한 번 봐주실 수 있겠습니까.\n\n게시판에 졸업생 명단이 붙어 있을 겁니다. 열두 번째 줄만 봐주십시오.\n저는 그 동네에 못 갑니다. 이유는 적지 않겠습니다.\n사진은 찍지 마시고 눈으로만 보십시오.",
        choices: [] },

      // 어긴 쪽. 이틀 침묵 뒤 상대가 한 번 무너졌다 수습한다 —
      // 이 계정이 감정을 드러내는 유일한 순간이다.
      "s4a": {
        text: "찍지 말라고 했습니다.\n\n…아니요, 제가 예민했습니다. 사진은 잘 받았습니다.\n열두 번째 줄에 뭐라고 적혀 있었습니까.",
        delay: 2,
        choices: [
          { say: "이름이 하나 적혀 있었어요", to: "s5" },
          { say: "글씨가 번져서 잘 안 보였어요", to: "s5" }
        ] },

      "s4b": {
        text: "감사합니다. 그렇게 해주십시오.\n열두 번째 줄에 뭐라고 적혀 있었습니까.",
        choices: [
          { say: "이름이 하나 적혀 있었어요", to: "s5" },
          { say: "글씨가 번져서 잘 안 보였어요", to: "s5" }
        ] },

      "s5": {
        text: "그 이름이 제가 본 것과 같습니다.\n그런데 선생님, 명단은 스물세 명이었습니까.",
        choices: [
          { say: "세어보진 않았어요", to: "s6" },
          { say: "스물세 명 맞았어요", to: "s6" }
        ] },

      // 사흘. 숫자가 어긋났다는 걸 확인하러 간 시간이라 침묵에 이유가 있다.
      "s6": {
        text: "제가 가진 기록에는 스물두 명입니다.\n십오 년 전에 제가 직접 세었습니다.\n\n하나 여쭙겠습니다. 게시판 앞에 선생님 말고 다른 사람이 있었습니까.",
        delay: 3,
        choices: [
          { say: "아무도 없었어요", to: "s7a" },
          { say: "한 사람 있었던 것 같아요", to: "s7b" }
        ] },

      // 닫히는 끝.
      "s7a": {
        text: "그렇습니까. 다행입니다.\n\n이 기록은 여기서 닫겠습니다. 도와주셔서 감사합니다.\n앞으로 그 동네 이야기가 올라오거든, 저에게는 알리지 말아주십시오.\n\n확인된 것은 여기까지입니다.",
        choices: [], end: true },

      // 열린 채 남는 끝. "사실 여부는 판단하지 않습니다"라는 계정 컨셉과 맞물린다.
      "s7b": {
        text: "그 사람 얼굴을 기억하십니까.\n\n…아닙니다. 대답하지 않으셔도 됩니다.\n십오 년 전에도 저는 혼자가 아니었습니다.\n\n명단은 앞으로도 한 명씩 늘 겁니다. 세지 마십시오.\n이 기록은 닫지 않겠습니다.",
        delay: 1,
        choices: [], end: true }
    } }
};
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`test/engine.test.js` 끝에 추가:

```js
// --- 괴담계 스토리 DM ---
// 조건을 갖춘 상태를 만든다: @old_records를 만나고, 트윗 5개에 반응하고, 감각 12 / 글빨 5
function storyGame(overrides) {
  var d = loadData();
  var g = Engine.create(d);
  var s = g.getState();
  // 계정을 만난 것으로 하고 보관함을 채운다
  s.npcSeen["@old_records"] = 1;
  g.advanceTurn("rest", false);   // 보관함이 채워진다
  s = g.getState();
  Object.assign(s.stats, { 감각: 12, 글빨: 5 }, (overrides && overrides.stats) || {});
  var box = s.npcTweets["@old_records"] || [];
  var n = overrides && overrides.reactions != null ? overrides.reactions : 5;
  for (var i = 0; i < n && i < box.length; i++) g.toggleReaction(box[i].id, "like");
  return g;
}

// 조건을 다 갖추면 그 턴에 확정으로 첫 DM이 온다
var gS = storyGame();
assert.ok(!gS.getState().dmStory["@old_records"], "아직 시작 전");
gS.advanceTurn("rest", false);
var st = gS.getState().dmStory["@old_records"];
assert.ok(st, "조건 충족 턴에 스토리가 시작된다");
assert.strictEqual(st.node, "s1");
var msgs = gS.getState().dms["@old_records"].msgs;
assert.strictEqual(msgs.length, 1, "첫 인사 한 통");
assert.strictEqual(msgs[0].me, false, "상대가 보낸 것");

// 반응이 모자라면 시작 안 함
var gLow = storyGame({ reactions: 4 });
gLow.advanceTurn("rest", false);
assert.ok(!gLow.getState().dmStory["@old_records"], "반응 4개로는 시작 안 함");

// 감각이 낮으면 시작 안 함
var gDull = storyGame({ stats: { 감각: 11 } });
gDull.advanceTurn("rest", false);
assert.ok(!gDull.getState().dmStory["@old_records"], "감각 11로는 시작 안 함");

// 글빨이 높으면 시작 안 함
var gSharp = storyGame({ stats: { 글빨: 20 } });
gSharp.advanceTurn("rest", false);
assert.ok(!gSharp.getState().dmStory["@old_records"], "글빨 20이면 시작 안 함");

// 선택지를 고르면 다음 노드로 간다
var ch = gS.storyChoices("@old_records");
assert.strictEqual(ch.length, 2, "s1의 선택지 2개");
gS.sendStory("@old_records", 0);
assert.strictEqual(gS.getState().dmStory["@old_records"].node, "s2");
assert.strictEqual(gS.getState().day, gS.getState().day, "스토리 선택은 하루를 안 쓴다");

// s2는 대기 — 선택지가 없다
assert.deepStrictEqual(gS.storyChoices("@old_records"), [], "s2는 대기라 선택지 없음");

// 대기 중에는 확률 DM도 안 온다(스토리 계정은 후보에서 빠진다)
var beforeCount = gS.getState().dms["@old_records"].msgs.length;
for (var w = 0; w < 20; w++) gS.advanceTurn("rest", false);
assert.strictEqual(gS.getState().dms["@old_records"].msgs.length, beforeCount,
  "스토리 진행 중엔 잡담 DM이 안 온다");

// 지연 답장: goStory로 s6에 가면 3일 뒤에 도착한다
var gD = storyGame();
gD.advanceTurn("rest", false);
gD._goStory("@old_records", "s5");
var lenBefore = gD.getState().dms["@old_records"].msgs.length;
gD.sendStory("@old_records", 0);          // s5 → s6 (delay 3)
assert.strictEqual(gD.getState().dmStory["@old_records"].node, "s5",
  "지연 중엔 노드가 아직 안 옮겨진다");
assert.ok(gD.getState().dmStory["@old_records"].pending, "pending이 잡힌다");
gD.advanceTurn("rest", false);
gD.advanceTurn("rest", false);
assert.strictEqual(gD.getState().dmStory["@old_records"].node, "s5", "2일째엔 아직");
gD.advanceTurn("rest", false);
assert.strictEqual(gD.getState().dmStory["@old_records"].node, "s6", "3일째에 도착");
assert.ok(gD.getState().dms["@old_records"].msgs.length > lenBefore, "답장이 쌓였다");

// 끝에 도달하면 done이 되고 다시 시작 안 함
var gE = storyGame();
gE.advanceTurn("rest", false);
gE._goStory("@old_records", "s7a");
assert.strictEqual(gE.getState().dmStory["@old_records"].done, true, "끝 노드면 done");
assert.deepStrictEqual(gE.storyChoices("@old_records"), [], "끝나면 선택지 없음");
```

- [ ] **Step 3: 실패를 확인한다**

Run: `node test/engine.test.js`
Expected: FAIL — `gS.storyChoices is not a function` 또는 시작 단언에서 실패

- [ ] **Step 4: `initialState`에 `dmStory`를 추가한다**

`js/engine.js`의 `initialState()`에서 `dms: {},`가 들어 있는 줄을 찾아 그 **바로 아래**에 추가:

```js
      // 스토리 DM 진행 상태. { "@h": { node, pending: {to, day}|null, done } }
      // 기존 dms(대화 내용)와 별개다 — 저쪽은 말풍선, 이쪽은 어디까지 왔는가다.
      dmStory: {},
```

`create()`의 `missing` 맵이 최상위 필드를 자동으로 채우므로 옛 세이브 보정은 따로 안 해도 된다.

- [ ] **Step 5: `dmRoom`이 스토리 계정도 열게 한다**

`js/engine.js`의 `dmRoom`을 교체한다. 지금은 `data.dm.accounts[handle]`만 보므로
스토리 계정의 방을 못 만든다:

```js
    // 대화방. accounts(선택지 풀) 계정과 stories(스토리) 계정 둘 다 방을 갖는다.
    function dmRoom(handle) {
      if (!data.dm) return null;
      var known = data.dm.accounts[handle] ||
        (data.dm.stories && data.dm.stories[handle]);
      if (!known) return null;
      return state.dms[handle] ||
        (state.dms[handle] = { msgs: [], used: [], opened: [], seen: 0 });
    }
```

- [ ] **Step 6: 스토리 함수들을 추가한다**

`js/engine.js`의 `unreadDms` 함수 **바로 뒤**에 추가:

```js
    // ── 스토리 DM ────────────────────────────────────────────
    // 기존 DM(선택지 풀)과 다른 갈래다. 순서가 있고, 한 번 지나간 노드로 돌아가지 않는다.
    function storyDef(handle) {
      return (data.dm && data.dm.stories && data.dm.stories[handle]) || null;
    }
    function storyState(handle) { return state.dmStory[handle] || null; }

    // 그 노드로 옮기고 상대의 말을 방에 넣는다. 끝 노드면 done을 찍는다.
    function goStory(handle, nodeId) {
      var def = storyDef(handle);
      if (!def || !def.nodes[nodeId]) return null;
      var node = def.nodes[nodeId];
      var st = state.dmStory[handle] ||
        (state.dmStory[handle] = { node: null, pending: null, done: false });
      dmRoom(handle);
      st.node = nodeId;
      st.pending = null;
      pushDm(handle, false, node.text);
      if (node.end) st.done = true;
      return st;
    }

    // 내가 고를 수 있는 말. 대기(choices 없음)·끝·지연 중이면 빈 배열이다.
    function storyChoices(handle) {
      var def = storyDef(handle), st = storyState(handle);
      if (!def || !st || st.done || st.pending) return [];
      var node = def.nodes[st.node];
      if (!node || !node.choices) return [];
      return node.choices.map(function (c, i) { return { idx: i, say: c.say }; });
    }

    // 스토리 선택. 하루를 안 쓰고 스탯도 안 건드린다(기존 DM과 같은 규칙).
    // 다음 노드에 delay가 있으면 그 날짜로 예약만 하고 답장은 나중에 온다.
    function sendStory(handle, idx) {
      var def = storyDef(handle), st = storyState(handle);
      if (!def || !st || st.done || st.pending) return null;
      var node = def.nodes[st.node];
      if (!node || !node.choices) return null;
      var choice = node.choices[idx];
      if (!choice) return null;
      var room = dmRoom(handle);
      pushDm(handle, true, choice.say);
      var next = def.nodes[choice.to];
      if (next && next.delay > 0) st.pending = { to: choice.to, day: state.day + next.delay };
      else goStory(handle, choice.to);
      room.seen = room.msgs.length; // 보고 있는 방이라 바로 읽음
      return { handle: handle, msgs: room.msgs };
    }

    // 시작 조건. reactions는 그 계정 트윗에 반응한 수, 나머지는 스탯 비교식이다.
    function storyReady(handle) {
      var def = storyDef(handle);
      if (!def || state.dmStory[handle]) return false;      // 이미 시작했으면 안 한다
      if (state.npcSeen[handle] == null) return false;      // 만나야 온다
      var req = def.requires || {};
      if (req.reactions != null && reactionsOn(handle) < req.reactions) return false;
      var rest = {};
      Object.keys(req).forEach(function (k) { if (k !== "reactions") rest[k] = req[k]; });
      return checkCond(rest, state);
    }

    // 턴마다: 조건이 맞으면 시작하고, 예약된 지연 답장이 오늘이면 도착시킨다.
    function tickStories() {
      if (!data.dm || !data.dm.stories) return;
      Object.keys(data.dm.stories).forEach(function (h) {
        if (storyReady(h)) { goStory(h, data.dm.stories[h].start); return; }
        var st = state.dmStory[h];
        if (st && st.pending && state.day >= st.pending.day) goStory(h, st.pending.to);
      });
    }

    // 스토리가 진행 중(아직 안 끝난)인 계정. 확률 DM 후보에서 빼는 근거다 —
    // 이야기 중간에 잡담이 끼면 안 된다.
    function inStory(handle) {
      var st = state.dmStory[handle];
      return !!(st && !st.done);
    }
```

- [ ] **Step 7: `advanceTurn`이 스토리를 돌리게 한다**

`js/engine.js`의 `advanceTurn`에서 확률 DM 블록을 찾는다:

```js
      if (data.dm && rand() < (data.dm.chance || 0)) {
        var callers = dmAccounts().filter(function (h) { return unusedOpens(h).length; });
```

그 블록을 아래로 교체한다(스토리 계정 제외 + 그 뒤에 `tickStories()` 호출):

```js
      if (data.dm && rand() < (data.dm.chance || 0)) {
        // 스토리가 도는 계정은 뺀다 — 이야기 중간에 잡담이 끼면 안 된다
        var callers = dmAccounts().filter(function (h) {
          return unusedOpens(h).length && !inStory(h);
        });
```

그리고 그 `if` 블록이 **닫힌 직후**에 한 줄 추가:

```js
      // 스토리 DM: 조건이 맞으면 시작하고, 예약된 지연 답장이 오늘이면 도착한다.
      // npcSeen 기록 뒤에 와야 한다 — 오늘 처음 만난 계정도 조건을 볼 수 있어야 하기 때문이다.
      tickStories();
```

**중요:** `tickStories()`는 `npcSeen`을 기록하는 블록(`feedItems.forEach(...)`) **뒤**에 있어야 한다.
확률 DM 블록이 이미 그 뒤에 있으므로 그 자리에 넣으면 된다.

- [ ] **Step 8: 공개 객체에 등록한다**

`js/engine.js`의 반환 객체에 추가:

```js
      storyChoices: storyChoices, sendStory: sendStory,
      _goStory: goStory,
```

`_goStory`는 테스트가 특정 노드로 점프하는 데 쓴다(`_` 접두 = 테스트 전용).

- [ ] **Step 9: 통과를 확인한다**

Run: `node test/engine.test.js`
Expected: PASS

- [ ] **Step 10: 전체 검증**

Run: `node test/engine.test.js && node test/sim.js && node test/check-assets.js`
Expected: 셋 다 PASS.

- [ ] **Step 11: 커밋**

```bash
git add data/dms.js js/engine.js test/engine.test.js
git commit -m "feat: 괴담계 스토리 DM - 노드 진행과 지연 답장"
```

---

### Task 4: 폐교 이벤트

산책 중, 스토리가 s2일 때만 발동하는 확정 이벤트. 여기서 고른 것이 분기 1이다.

**Files:**
- Modify: `data/events.js` (파일 끝, 배열 안)
- Modify: `js/engine.js` (이벤트 발동 조건, 이벤트 선택지 처리)
- Test: `test/engine.test.js`

**Interfaces:**
- Consumes: `GAME_DATA.dm.stories`의 노드 id, 행동 id `"walk"` (Task 1, 3)
- Produces: `trigger.action` / `trigger.dmStory` / 선택지의 `story` 필드 —
  범용 노브라 나중에 다른 스토리·행동에도 쓸 수 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/engine.test.js` 끝에 추가:

```js
// --- 폐교 이벤트 ---
// 스토리가 s2일 때 산책하면 발동한다
var gW = storyGame();
gW.advanceTurn("rest", false);              // 스토리 시작 (s1)
gW.sendStory("@old_records", 0);            // s2 (대기)
assert.strictEqual(gW.getState().dmStory["@old_records"].node, "s2");
var r1 = gW.advanceTurn("walk", false);
assert.ok(r1.triggeredEvents.indexOf("old_school") !== -1, "산책하면 폐교 이벤트가 뜬다");
var evActs = gW.getActions().filter(function (a) { return a.kind === "event"; });
assert.strictEqual(evActs.length, 2, "선택지 2개(사진/눈으로만)");

// 다른 행동에선 안 뜬다
var gW2 = storyGame();
gW2.advanceTurn("rest", false);
gW2.sendStory("@old_records", 0);
var r2 = gW2.advanceTurn("rest", false);
assert.strictEqual(r2.triggeredEvents.indexOf("old_school"), -1, "휴식으로는 안 뜬다");

// 스토리가 s2가 아니면 산책해도 안 뜬다
var gW3 = storyGame();
gW3.advanceTurn("rest", false);             // s1에 머문다
var r3 = gW3.advanceTurn("walk", false);
assert.strictEqual(r3.triggeredEvents.indexOf("old_school"), -1, "s1에선 안 뜬다");

// 스토리가 아예 없으면 산책해도 안 뜬다
var gW4 = Engine.create(loadData());
var r4 = gW4.advanceTurn("walk", false);
assert.strictEqual(r4.triggeredEvents.indexOf("old_school"), -1, "스토리 없으면 안 뜬다");

// 선택지가 스토리를 진행시킨다 — 사진(s4a, delay 2)
var photoIdx = -1;
gW.getActions().forEach(function (a, i) {
  if (a.kind === "event" && a.label.indexOf("사진") !== -1) photoIdx = i;
});
assert.ok(photoIdx >= 0, "사진 선택지를 찾았다");
var photoId = gW.getActions()[photoIdx].id;
gW.advanceTurn(photoId, false);
var stW = gW.getState().dmStory["@old_records"];
assert.ok(stW.pending, "delay 2라 예약된다");
assert.strictEqual(stW.pending.to, "s4a");
gW.advanceTurn("rest", false);
assert.strictEqual(gW.getState().dmStory["@old_records"].node, "s4a", "2일 뒤 도착");

// 눈으로만은 즉시 s4b
var gV = storyGame();
gV.advanceTurn("rest", false);
gV.sendStory("@old_records", 0);
gV.advanceTurn("walk", false);
var eyeId = null;
gV.getActions().forEach(function (a) {
  if (a.kind === "event" && a.label.indexOf("눈으로") !== -1) eyeId = a.id;
});
assert.ok(eyeId, "눈으로만 선택지를 찾았다");
gV.advanceTurn(eyeId, false);
assert.strictEqual(gV.getState().dmStory["@old_records"].node, "s4b", "즉시 도착");
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node test/engine.test.js`
Expected: FAIL — `산책하면 폐교 이벤트가 뜬다`

- [ ] **Step 3: 이벤트 데이터를 추가한다**

`data/events.js`의 배열 **마지막 항목 뒤**(닫는 `];` 앞)에 추가한다.
앞 항목 끝에 쉼표가 필요하다:

```js
  // ── 스토리 이벤트 ──
  // 기존 이벤트는 전부 확률로 알아서 발동하는데(chance), 이건 행동에 걸린 확정 이벤트다.
  //   action:   그 행동을 한 턴에만
  //   dmStory:  "핸들:노드" — 그 스토리가 그 노드에 있을 때만
  // 선택지의 story가 DM 스토리를 그 노드로 진행시킨다. 셋 다 범용 노브다.
  { id: "old_school",
    trigger: { action: "walk", dmStory: "@old_records:s2" },
    stages: [
      { feed: ["산책하다 문 닫힌 학교 앞을 지났다.\n녹슨 정문 옆 게시판에 빛바랜 졸업생 명단이 붙어 있다"],
        choices: [
          { label: "사진을 찍어둔다", story: "@old_records:s4a", next: "end" },
          { label: "눈으로만 확인한다", story: "@old_records:s4b", next: "end" }
        ] }
    ] }
```

- [ ] **Step 4: 이벤트 발동 조건을 고친다**

`js/engine.js`의 `advanceTurn`에서 이벤트 발동 블록을 찾는다:

```js
      data.events.forEach(function (ev) {
        var done = state.eventHistory.indexOf(ev.id) !== -1;
        var active = state.activeEvents.some(function (a) { return a.eventId === ev.id; });
        if (done || active) return;
        if (checkCond(ev.trigger, state) && rand() < (ev.trigger.chance == null ? 1 : ev.trigger.chance)) {
```

아래로 교체한다:

```js
      data.events.forEach(function (ev) {
        var done = state.eventHistory.indexOf(ev.id) !== -1;
        var active = state.activeEvents.some(function (a) { return a.eventId === ev.id; });
        if (done || active) return;
        // action: 그 행동을 한 턴에만. dmStory: "핸들:노드"가 지금 그 노드일 때만.
        // 스토리 이벤트는 chance가 없어서 조건만 맞으면 확정으로 뜬다.
        if (ev.trigger.action && ev.trigger.action !== actionId) return;
        if (ev.trigger.dmStory && !atStoryNode(ev.trigger.dmStory)) return;
        if (checkCond(ev.trigger, state) && rand() < (ev.trigger.chance == null ? 1 : ev.trigger.chance)) {
```

그리고 `checkCond`가 새 키를 스탯으로 오해하지 않도록, `js/engine.js`의 `checkCond`에서
`if (key === "chance") continue;` 줄을 찾아 아래로 교체한다:

```js
      // chance는 확률, action·dmStory는 스토리 이벤트 전용 조건이라 스탯 비교가 아니다
      if (key === "chance" || key === "action" || key === "dmStory") continue;
```

- [ ] **Step 5: `atStoryNode` 헬퍼를 추가한다**

`js/engine.js`의 `inStory` 함수 **바로 뒤**에 추가:

```js
    // "@핸들:노드" 형식으로 지금 그 스토리가 그 노드에 있는지 본다.
    // 지연 답장을 기다리는 중(pending)이면 아직 그 노드가 아니다.
    function atStoryNode(spec) {
      var at = String(spec).split(":");
      var st = state.dmStory[at[0]];
      return !!(st && !st.done && !st.pending && st.node === at[1]);
    }
```

- [ ] **Step 6: 이벤트 선택지가 스토리를 진행시키게 한다**

`js/engine.js`의 `advanceTurn`에서 이벤트 선택지 처리 블록을 찾는다:

```js
        applyEffects(choice.effects, statChanges);
        feedItems.push({ author: "me", text: choice.label + " — 을(를) 선택했다", day: state.day, likes: 0, rts: 0, kind: "me" });
```

그 **두 줄 사이**(applyEffects 뒤, feedItems.push 앞)에 추가:

```js
        // 스토리 이벤트: 고른 것이 DM 스토리를 진행시킨다.
        // 다음 노드에 delay가 있으면 예약만 하고 답장은 나중에 온다.
        if (choice.story) {
          var sp = String(choice.story).split(":");
          var sdef = storyDef(sp[0]), sst = state.dmStory[sp[0]];
          var snode = sdef && sdef.nodes[sp[1]];
          if (sst && snode) {
            if (snode.delay > 0) sst.pending = { to: sp[1], day: state.day + snode.delay };
            else goStory(sp[0], sp[1]);
          }
        }
```

- [ ] **Step 7: 통과를 확인한다**

Run: `node test/engine.test.js`
Expected: PASS

- [ ] **Step 8: 전체 검증**

Run: `node test/engine.test.js && node test/sim.js && node test/check-assets.js`
Expected: 셋 다 PASS. `sim.js`의 다섯 전략이 전부 100만에 도달해야 한다.

- [ ] **Step 9: 커밋**

```bash
git add data/events.js js/engine.js test/engine.test.js
git commit -m "feat: 폐교 이벤트 - 산책 중 스토리 분기"
```

---

### Task 5: UI — 스토리 대화방

기존 대화방에 스토리 선택지를 그린다. 대기 중이면 아무것도 안 그린다.

**Files:**
- Modify: `js/ui.js` (`renderDm` 약 542행, 선택지 바 약 586행)
- Modify: `js/main.js` (DM 클릭 핸들러)
- Test: 브라우저 육안 확인 + `node test/check-css.js`

**Interfaces:**
- Consumes: `storyChoices(handle)` → `[{ idx, say }]`, `sendStory(handle, idx)` (Task 3)
- Produces: `[data-story-to]` / `[data-story-idx]` 속성 — `main.js`의 클릭 위임이 잡는다

- [ ] **Step 1: 스토리 계정도 대화방 목록에 뜨게 한다**

`js/ui.js`의 `renderDm`(538행)은 이렇게 시작한다:

```js
  function renderDm(state) {
    var accounts = gameNow ? gameNow.dmAccounts() : [];
    var rooms = state.dms || {};
```

`var rooms = ...` 줄 **바로 뒤**에 추가한다:

```js
    // 스토리가 시작된 계정도 대화방이 있다. dmAccounts()는 accounts(선택지 풀)만 세므로
    // state.dms에 방이 있는 계정을 합친다 — 스토리 계정은 goStory가 방을 만든다.
    Object.keys(rooms).forEach(function (h) {
      if (accounts.indexOf(h) === -1) accounts.push(h);
    });
```

- [ ] **Step 1b: 프로필의 쪽지 버튼도 스토리 계정에 뜨게 한다**

`js/ui.js` 732행에 프로필 우상단 쪽지 버튼 조건이 있다:

```js
    var canDm = !!npc && gameNow && gameNow.dmAccounts().indexOf(handle) !== -1;
```

아래로 교체한다. 안 고치면 괴담계 프로필에서 쪽지 버튼이 안 보인다:

```js
    // 스토리가 시작된 계정도 방이 있다 — state.dms에 방이 생겼으면 들어갈 수 있다
    var canDm = !!npc && gameNow &&
      (gameNow.dmAccounts().indexOf(handle) !== -1 || !!(state.dms || {})[handle]);
```

**주의:** 이 함수 안에서 `state`에 접근 가능한지 확인할 것.
안 되면 함수 인자를 보고 맞는 이름을 쓴다(`grep -n "function renderProfile" js/ui.js`).

- [ ] **Step 2: 선택지 바에 스토리 선택지를 그린다**

`js/ui.js`의 선택지 바 렌더 부분을 찾는다:

```js
    var ch = $("dm-choices");
    ...
    var choices = gameNow ? gameNow.getDmChoices(dmHandle) : [];
```

`choices`를 얻는 줄을 아래로 교체한다:

```js
    // 스토리 계정이면 스토리 선택지를, 아니면 기존 선택지 풀을 쓴다.
    // 대기 중(행동을 기다리는 중)이면 스토리 쪽이 빈 배열을 주고, 그러면 아무것도 안 그린다 —
    // "기다리는 중" 같은 표시를 넣지 말 것. 침묵이 이 이야기의 연출이다.
    var story = gameNow ? gameNow.storyChoices(dmHandle) : [];
    var isStory = story.length > 0;
    var choices = isStory ? story : (gameNow ? gameNow.getDmChoices(dmHandle) : []);
```

그리고 버튼을 만드는 부분(`js/ui.js` 599~600행)은 지금 이렇다:

```js
      b.dataset.dmSay = c.idx;
      b.dataset.dmTo = dmHandle;
```

아래로 교체한다. **스토리일 때는 `dmSay`를 달지 않는다** — 달면 `main.js`의 기존
`[data-dm-say]` 핸들러가 잡아서 `sendDm`으로 새어나간다:

```js
      // 스토리 선택은 dmSay 대신 storyIdx를 단다 — 기존 sendDm 핸들러로 새면 안 된다
      if (isStory) b.dataset.storyIdx = c.idx;
      else b.dataset.dmSay = c.idx;
      b.dataset.dmTo = dmHandle;
```

기존 선택지와 스토리 선택지 **둘 다 `{ idx, say }` 형식**이라 버튼 라벨 코드는 그대로 동작한다
(`storyChoices`가 그 형식으로 돌려주도록 Task 3에서 만들었다).

- [ ] **Step 3: `main.js`가 스토리 선택을 처리하게 한다**

`js/main.js` 145행에 기존 DM 선택 핸들러가 있다:

```js
    var dmSay = e.target.closest("[data-dm-say]");
    if (dmSay) {
      game.sendDm(dmSay.dataset.dmTo, Number(dmSay.dataset.dmSay));
```

그 블록 **바로 앞**에 스토리 처리를 추가한다:

```js
    // 스토리 선택. 기존 dm-say와 같은 data-dm-to를 쓰지만 속성이 달라 서로 안 겹친다.
    // 하루를 안 쓰므로 resolveTurn을 거치지 않는다(기존 DM과 같다).
    var storyBtn = e.target.closest("[data-story-idx]");
    if (storyBtn) {
      game.sendStory(storyBtn.dataset.dmTo, Number(storyBtn.dataset.storyIdx));
      save(game.getState());
      refresh();
      return;
    }
```

- [ ] **Step 4: 검증을 돌린다**

Run: `node test/check-css.js && node test/engine.test.js`
Expected: 둘 다 PASS

- [ ] **Step 5: 브라우저에서 확인한다**

브라우저가 없으면 이 단계를 건너뛰고 보고서에 미확인으로 남긴다.
있으면 확인할 것:

- 스토리가 시작되면 쪽지 목록에 `옛기록보관`이 뜬다
- 대화방에 첫 인사가 보이고 선택지 2개가 뜬다
- 고르면 내 말과 상대 답이 이어서 뜬다
- s2에서는 **선택지 바가 비어 있다**(문구도 없다)
- 산책 후 폐교 이벤트에서 고르면 이야기가 이어진다
- 지연 중에는 방이 열려 있고 답이 없다
- 모바일(≤640px)에서 선택지 바가 하단 독바에 안 가린다

- [ ] **Step 6: 커밋**

```bash
git add js/ui.js js/main.js
git commit -m "feat: 스토리 대화방 UI - 선택지와 침묵"
```

---

### Task 6: 문서 갱신과 전체 검증

**Files:**
- Modify: `CLAUDE.md` (디엠 절)
- Test: 검증 4종

- [ ] **Step 1: `CLAUDE.md`의 디엠 절에 스토리 규칙을 추가한다**

`CLAUDE.md`의 "## 디엠 (불변)" 절 **끝**(다음 `##` 절이 시작되기 전)에 추가:

```
### 스토리 DM (불변)

`GAME_DATA.dm.stories`는 **순서가 있는 이야기**다. 기존 `accounts`(선택지 풀)와 다른 갈래이고
섞지 않는다 — 저쪽은 순서가 없고 이쪽은 순서가 전부라 같은 구조에 넣으면 규칙이 엉킨다.
현재 `@old_records`(괴담계) 하나뿐이다.

- **시작은 `requires`가 전부 맞는 턴에 확정으로** 온다(확률 없음). `reactions`는 그 계정 트윗에
  반응한 수(좋아요·리트윗 합산, 트윗당 1회 — `reactionsOn()`), 나머지는 스탯 비교식이다.
  현재 조건은 반응 5 + 감각 >= 12 + 글빨 < 20 — **"감각은 챙겼고 글빨은 안 챙긴"** 플레이어를 고른다.
  괴담계는 검증하려 드는 사람이 아니라 덥석 믿어주는 사람을 찾는다.
- 상태는 `state.dmStory = { "@h": { node, pending, done } }`. `node`가 지금 위치,
  `pending: { to, day }`가 예약된 지연 답장, `done`이 끝났는가다.
- **`choices`가 비면 대기 또는 끝이다.** 가르는 건 `end: true` — 없으면 대기(무언가 다른 것이
  진행시킨다), 있으면 종료다. 현재 `s2`가 대기이고 폐교 이벤트가 진행시킨다.
- **`delay: N`이면 답장이 N일 뒤 도착한다.** 기다리는 동안 방은 열려 있고 **아무 표시도 없다** —
  "기다리는 중" 같은 문구를 넣지 말 것. 침묵이 연출이라 시스템이 설명하면 죽는다.
- **스토리 진행 중인 계정은 확률 DM 후보에서 뺀다**(`inStory()`). 이야기 중간에 잡담이 끼면 안 된다.
- **스토리 선택도 하루를 안 쓰고 스탯도 안 건드린다**(기존 DM과 같은 규칙).
  이 이야기에서 하루를 쓰는 건 **산책하기 행동 한 번**뿐이다.
- `dmRoom()`은 `accounts`와 `stories` **양쪽**을 본다. 한쪽만 보면 스토리 계정의 방을 못 만든다.

### 행동에 걸린 이벤트 (불변)

기존 이벤트는 전부 확률로 알아서 발동하는데(`chance`), 스토리 이벤트는 **행동에 걸린 확정 이벤트**다.
`data/events.js`의 `trigger`에 두 키가 더 있다:

- **`action: "walk"`** — 그 행동을 한 턴에만
- **`dmStory: "@핸들:노드"`** — 그 스토리가 그 노드에 있을 때만(`atStoryNode()`)

선택지의 **`story: "@핸들:노드"`** 가 DM 스토리를 그 노드로 진행시킨다. 셋 다 범용 노브다 —
나중에 다른 계정 이야기도 다른 행동에 걸 수 있다.
**`checkCond`에서 `action`·`dmStory`를 건너뛰어야 한다** — 안 그러면 스탯 이름으로 오해한다.
```

- [ ] **Step 2: 행동 목록 관련 서술을 확인한다**

`grep -n "행동" CLAUDE.md | head -20`으로 행동 개수를 적은 곳이 있는지 본다.
있으면 산책하기를 반영한다. 없으면 넘어간다.

- [ ] **Step 3: 검증 4종을 전부 돌린다**

```bash
node test/engine.test.js && node test/sim.js && node test/check-css.js && node test/check-assets.js
```

Expected: 넷 다 PASS. `sim.js`의 다섯 전략이 전부 100만에 도달해야 한다.

- [ ] **Step 4: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: 스토리 DM과 행동 이벤트 규칙 반영"
```

---

## 참고: 이야기를 더 쓸 때

- 노드를 추가하려면 `data/dms.js`의 `nodes`에 넣고 `choices.to`로 잇기만 하면 된다.
- 다른 계정 이야기를 쓰려면 `stories`에 항목을 추가하고 `requires`를 정한다.
- 다른 행동에 이벤트를 걸려면 `trigger.action`을 그 행동 id로 바꾼다.
- **분기를 늘리면 분량이 배로 뛴다.** 지금은 두 곳에서 갈라지고 `s5`에서 합류해 분량을 억제한다.
