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

// --- Task 4: events ---
var g7 = Engine.create(loadData(), null, fixedRng); // rand()=0 → chance 무시 항상 발동
g7.getState().stats.유머 = 15;
var r3 = g7.advanceTurn("train_meme");
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
g8.advanceTurn("rest"); // backlash 발동
assert.strictEqual(g8.getState().activeEvents.length, 1);
var r4 = g8.advanceTurn("event:backlash:1"); // 보상 리플 선택 → stage 1
assert.strictEqual(g8.getState().activeEvents[0].stage, 1, "다단계 진행됨");
assert.ok(r4.feedItems.some(function (f) { return f.kind === "event"; }), "다음 단계 피드 추가됨");
var stage1Acts = g8.getActions().filter(function (a) { return a.kind === "event"; });
assert.strictEqual(stage1Acts.length, 1, "글빨 15 미만이라 '글로 반박' 선택지만");

var g9 = Engine.create(loadData(), null, function () { return 0.99; }); // chance 무시함
g9.getState().stats.유머 = 15;
var r5 = g9.advanceTurn("train_meme");
assert.deepStrictEqual(r5.triggeredEvents, [], "chance 넘음 → 발동 안 함");

console.log("Task 4 OK");



