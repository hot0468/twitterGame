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

// --- Task 2: create / getActions ---
function loadData() {
  var d = {};
  Object.assign(d, require("../data/actions.js"));
  Object.assign(d, require("../data/npcs.js"));
  Object.assign(d, require("../data/events.js"));
  Object.assign(d, require("../data/endings.js"));
  return d;
}
var g = Engine.create(loadData());
assert.strictEqual(g.getState().day, 1);
assert.strictEqual(g.getState().followers, 10);
assert.strictEqual(g.getState().stats.멘탈, 50);

var ids = g.getActions().map(function (a) { return a.id; });
assert.ok(ids.indexOf("daily") !== -1);
assert.ok(ids.indexOf("archive") === -1, "글빨 10 미만이면 자료 정리 잠김");
assert.ok(ids.indexOf("beef_watch") === -1, "감각 10 미만이면 떡밥 잠김");

var g2 = Engine.create(loadData(), null);
g2.getState().stats.글빨 = 10;
assert.ok(g2.getActions().map(function (a) { return a.id; }).indexOf("archive") !== -1, "스탯 충족 시 해금");

var saved = JSON.parse(JSON.stringify(g.getState()));
var g3 = Engine.create(loadData(), saved);
assert.strictEqual(g3.getState().followers, 10, "저장 상태 복원");

// 구버전 세이브 호환: 나중에 추가된 스탯(돈)이 없어도 기본값으로 채워져야 한다.
// 안 채우면 돈을 쓰는 수식이 evalFormula에서 ReferenceError로 터진다.
var legacy = JSON.parse(JSON.stringify(g.getState()));
delete legacy.stats.돈;
var g3b = Engine.create(loadData(), legacy);
assert.strictEqual(g3b.getState().stats.돈, 300000, "빠진 스탯이 기본값으로 채워짐");
assert.strictEqual(g3b.getState().stats.글빨, 5, "기존 값은 덮어쓰지 않음");
g3b.getState().stats.돈 = 250000;
assert.doesNotThrow(function () { g3b.advanceTurn("promo", false); }, "돈 수식이 터지지 않음");

console.log("Task 2 OK");

// --- Task 3: advanceTurn(actionId, doTweet) ---
function fixedRng() { return 0; } // 항상 0 → 템플릿/리플 첫 항목, 확률 이벤트는 전부 발동

// 트윗을 택하면: 행동 효과 + 트윗 효과 둘 다 + 피드에 트윗/리플
var g4 = Engine.create(loadData(), null, fixedRng);
var r = g4.advanceTurn("meme", true);
assert.strictEqual(g4.getState().day, 2);
assert.strictEqual(g4.getState().stats.유머, 7, "행동 효과 유머 +2");
assert.strictEqual(g4.getState().followers, 10 + (7 * 3 + 5), "트윗 효과: (오른 뒤의)유머*3+글빨");
assert.strictEqual(r.statChanges["팔로워"], 26);
var myTweet = r.feedItems.filter(function (f) { return f.kind === "me"; })[0];
assert.ok(myTweet, "내 트윗이 피드에 있음");
assert.ok(myTweet.text.indexOf("{") === -1, "템플릿 빈칸이 치환됨");
assert.ok(myTweet.likes >= 0 && myTweet.rts >= 0);
assert.strictEqual(g4.getState().tweetLog.length, 1);
assert.strictEqual(g4.getState().feed.length, r.feedItems.length);
var reply = r.feedItems.filter(function (f) { return f.kind === "reply"; })[0];
assert.ok(reply, "humor에 반응하는 NPC 리플 존재");
assert.strictEqual(reply.author, "@meme_bot99");

// 트윗을 안 하면: 행동 효과만, 피드는 그대로
var g5 = Engine.create(loadData(), null, fixedRng);
var r2 = g5.advanceTurn("meme", false);
assert.strictEqual(g5.getState().day, 2, "트윗 안 해도 하루는 지난다");
assert.strictEqual(g5.getState().stats.유머, 7, "행동 효과는 트윗 여부와 무관");
assert.strictEqual(g5.getState().followers, 10, "트윗 안 하면 팔로워 불변");
assert.strictEqual(r2.feedItems.length, 0, "트윗 안 하면 피드에 아무것도 안 남는다");
assert.strictEqual(g5.getState().tweetLog.length, 0);

// 리스크는 트윗 쪽에만 있다 (떡밥: 논란성 +5, 멘탈 -5)
var g5b = Engine.create(loadData(), null, fixedRng);
g5b.getState().stats.감각 = 10;
g5b.advanceTurn("beef_watch", false);
assert.strictEqual(g5b.getState().stats.논란성, 0, "트윗 안 하면 논란성 안 오름");
assert.strictEqual(g5b.getState().stats.멘탈, 50, "트윗 안 하면 멘탈 안 깎임");
var g5c = Engine.create(loadData(), null, fixedRng);
g5c.getState().stats.감각 = 10;
g5c.advanceTurn("beef_watch", true);
assert.strictEqual(g5c.getState().stats.논란성, 5, "트윗하면 논란성 +5");
assert.strictEqual(g5c.getState().stats.멘탈, 45, "트윗하면 멘탈 -5");

// previewAction: 상태를 바꾸지 않고, 실제 적용될 값과 정확히 일치해야 한다
var g5d = Engine.create(loadData(), null, fixedRng);
var pv = g5d.previewAction("meme");
assert.strictEqual(pv.label, "밈 공부");
assert.deepStrictEqual(pv.effects, { 유머: 2 });
// 유머 5→7이 먼저 적용된 뒤 트윗 수식이 계산된다: 7*3+5 = 26
assert.strictEqual(pv.tweetEffects["팔로워"], 7 * 3 + 5, "트윗 수식은 행동 효과 적용 후 스탯 기준");
assert.strictEqual(g5d.getState().stats.유머, 5, "미리보기는 상태를 바꾸지 않는다");
assert.strictEqual(g5d.getState().day, 1);
assert.strictEqual(g5d.previewAction("없는행동"), null);

// 미리보기 = 실제 적용값 (어긋나면 플레이어가 잘못된 정보로 선택하게 된다)
["meme", "write", "rest", "daily"].forEach(function (id) {
  var a = Engine.create(loadData(), null, fixedRng);
  var p = a.previewAction(id);
  var applied = a.advanceTurn(id, true).statChanges;
  var expected = {};
  Object.keys(p.effects).forEach(function (k) { expected[k] = (expected[k] || 0) + p.effects[k]; });
  Object.keys(p.tweetEffects).forEach(function (k) { expected[k] = (expected[k] || 0) + p.tweetEffects[k]; });
  assert.deepStrictEqual(applied, expected, id + ": 미리보기와 실제 적용값이 달라짐");
});

// 돈: 벌고 / 쓰고 / 부족하면 잠긴다
var gm = Engine.create(loadData(), null, fixedRng);
assert.strictEqual(gm.getState().stats.돈, 300000, "시작 돈 300,000원");
gm.advanceTurn("parttime", false);
assert.strictEqual(gm.getState().stats.돈, 380000, "알바 +80,000원");
assert.strictEqual(gm.getState().stats.멘탈, 46, "알바는 멘탈 -4");

var gm2 = Engine.create(loadData(), null, fixedRng);
gm2.advanceTurn("promo", false);
assert.strictEqual(gm2.getState().stats.돈, 50000, "홍보 -250,000원");
assert.strictEqual(gm2.getState().followers, 260, "홍보로 팔로워 +250");
assert.ok(gm2.getActions().map(function (a) { return a.id; }).indexOf("promo") === -1,
  "돈 250,000원 미만이면 홍보가 잠긴다");

var gm3 = Engine.create(loadData(), null, fixedRng);
assert.ok(gm3.getActions().map(function (a) { return a.id; }).indexOf("sponsor") === -1,
  "팔로워 500 미만이면 협찬이 잠긴다");
gm3.getState().followers = 1000;
assert.ok(gm3.getActions().map(function (a) { return a.id; }).indexOf("sponsor") !== -1, "팔로워 충족 시 해금");
gm3.advanceTurn("sponsor", false);
assert.strictEqual(gm3.getState().stats.돈, 300000, "협찬은 트윗을 올려야 돈이 들어온다");
var gm4 = Engine.create(loadData(), null, fixedRng);
gm4.getState().followers = 1000;
gm4.advanceTurn("sponsor", true);
assert.strictEqual(gm4.getState().stats.돈, 300000 + 120000 + 40000, "협찬 트윗: 120000 + 팔로워*40");
assert.strictEqual(gm4.getState().stats.논란성, 4, "협찬은 논란성 +4가 대가");

// 돈은 스킬 스탯이 아니다 — topStat(엔딩 판정)에 끼면 안 된다
assert.strictEqual(U.checkCond({ topStat: "글빨" }, S({ stats: { 글빨: 20, 돈: 999 } })), true,
  "돈은 topStat 비교에서 제외");

var g6 = Engine.create(loadData(), null, fixedRng);
g6.getState().stats.멘탈 = 3;
g6.getState().stats.감각 = 10;
g6.advanceTurn("beef_watch", true);
// 주의: >= 0 로만 검사할 것 — Task 5에서 멘탈 0은 붕괴 처리로 20이 되므로 === 0 검사는 회귀로 깨진다
assert.ok(g6.getState().stats.멘탈 >= 0, "스탯은 0 미만으로 안 떨어짐");

console.log("Task 3 OK");

// --- Task 4: events ---
var g7 = Engine.create(loadData(), null, fixedRng); // rand()=0 → chance 무시 항상 발동
g7.getState().stats.유머 = 15;
var r3 = g7.advanceTurn("meme", false);
assert.deepStrictEqual(r3.triggeredEvents, ["viral_humor"], "유머 15 충족 + chance 무시 → 발동");
assert.ok(r3.feedItems.some(function (f) { return f.kind === "event"; }), "이벤트 피드 추가됨");
assert.strictEqual(g7.getState().activeEvents.length, 1);

var evActs = g7.getActions().filter(function (a) { return a.kind === "event"; });
assert.strictEqual(evActs.length, 2, "이벤트 선택지 2개 추가됨");
assert.strictEqual(evActs[0].id, "event:viral_humor:0");

var before = g7.getState().followers;
g7.advanceTurn("event:viral_humor:0");
assert.strictEqual(g7.getState().followers, before + 300);
assert.strictEqual(g7.getState().activeEvents.length, 0, "end로 종료됨");
assert.deepStrictEqual(g7.getState().eventHistory, ["viral_humor"]);

var g8 = Engine.create(loadData(), null, fixedRng);
g8.getState().stats.논란성 = 20;
g8.getState().stats.멘탈 = 40;
g8.advanceTurn("rest", false); // backlash 발동
assert.strictEqual(g8.getState().activeEvents.length, 1);
var r4 = g8.advanceTurn("event:backlash:1"); // 보상 리플 선택 → stage 1
assert.strictEqual(g8.getState().activeEvents[0].stage, 1, "다단계 진행됨");
assert.ok(r4.feedItems.some(function (f) { return f.kind === "event"; }), "다음 단계 피드 추가됨");
var stage1Acts = g8.getActions().filter(function (a) { return a.kind === "event"; });
assert.strictEqual(stage1Acts.length, 1, "글빨 15 미만이라 '글로 반박' 선택지만");

var g9 = Engine.create(loadData(), null, function () { return 0.99; }); // chance 무시함
g9.getState().stats.유머 = 15;
var r5 = g9.advanceTurn("meme", false);
assert.deepStrictEqual(r5.triggeredEvents, [], "chance 넘음 → 발동 안 함");

console.log("Task 4 OK");

// --- Task 5: endings + mental ---
var g10 = Engine.create(loadData(), null, function () { return 0.99; }); // 이벤트 미발동
g10.getState().followers = 9999;
g10.getState().stats.글빨 = 30;
var r6 = g10.advanceTurn("archive", true); // 글빨 30→31, 트윗 시 글빨*4 = 124 증가 → 임계값 돌파
assert.ok(r6.ending, "임계값 도달 시 엔딩");
assert.strictEqual(r6.ending.id, "author", "글빨 최고 → 등단 작가");
assert.strictEqual(g10.getState().ending, "author");

var g11 = Engine.create(loadData(), null, function () { return 0.99; });
g11.getState().followers = 99999;
g11.getState().stats.논란성 = 50;
g11.getState().stats.유머 = 40;
var r7 = g11.advanceTurn("meme", false);
assert.strictEqual(r7.ending.id, "cyber_wrecker", "논란성 조건이 topStat보다 우선(list 순서)");

var g12 = Engine.create(loadData(), null, function () { return 0.99; });
g12.getState().followers = 99999;
var r8 = g12.advanceTurn("rest", false);
assert.ok(r8.ending, "조건 미달이어도 기본 엔딩은 반드시 나옴");

var g13 = Engine.create(loadData(), null, function () { return 0.99; });
g13.getState().stats.멘탈 = 5;
g13.getState().stats.감각 = 10;
var dayBefore = g13.getState().day;
var r9 = g13.advanceTurn("beef_watch", true); // 트윗 시 멘탈 -5 → 0 → 붕괴
assert.strictEqual(g13.getState().stats.멘탈, 20, "강제 휴식으로 멘탈 20 회복");
assert.strictEqual(g13.getState().day, dayBefore + 2, "턴 손실 (+1 추가)");
assert.ok(r9.feedItems.some(function (f) { return f.kind === "system"; }), "붕괴 안내 피드");

console.log("Task 5 OK");

