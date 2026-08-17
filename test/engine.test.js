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

// 구버전 세이브: 최상위 필드(tweetSeq)와 트윗 id도 채워져야 상세 페이지가 열린다
var legacy2 = { day: 5, followers: 500,
  stats: { 글빨: 8, 유머: 8, 감각: 8, 멘탈: 50, 돈: 300000, 논란성: 0 },
  feed: [{ author: "me", text: "id 없는 옛 트윗", day: 4, likes: 3, rts: 0, kind: "me" }],
  tweetLog: [{ author: "me", text: "id 없는 옛 트윗", day: 4, likes: 3, rts: 0, kind: "me" }],
  activeEvents: [], eventHistory: [], ending: null };
var g3c = Engine.create(loadData(), legacy2);
assert.strictEqual(typeof g3c.getState().tweetSeq, "number", "빠진 최상위 필드가 채워짐");
assert.ok(/^tw\d+$/.test(g3c.getState().tweetLog[0].id), "id 없던 옛 트윗에 id가 붙는다");
assert.doesNotThrow(function () { g3c.advanceTurn("meme", true); }, "구버전 세이브에서 트윗이 정상 동작");
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
assert.strictEqual(g4.getState().tweetLog.length, 1);
assert.strictEqual(g4.getState().feed.length, r.feedItems.length);
assert.ok(/^tw\d+$/.test(myTweet.id), "트윗에 id가 붙는다: " + myTweet.id);
// 팔로워 36명 계정의 첫 트윗은 좋아요 2개 → 답글 0개 (실제 트위터도 이 규모면 답글이 안 달린다)
assert.strictEqual(r.feedItems.filter(function (f) { return f.kind === "reply"; }).length, 0,
  "작은 계정 트윗엔 답글이 안 달린다");

// 반응(노출·좋아요·리트윗)은 난수가 아니라 스탯·팔로워에서 결정된다
function tweetOnce(overrides) {
  var a = Engine.create(loadData(), null, fixedRng);
  Object.assign(a.getState().stats, overrides || {});
  return a.advanceTurn("meme", true).feedItems.filter(function (f) { return f.kind === "me"; })[0];
}
function reactionOf(t) { return { likes: t.likes, rts: t.rts, views: t.views }; }
var base = tweetOnce();
assert.deepStrictEqual(reactionOf(tweetOnce()), reactionOf(base), "같은 조건이면 같은 반응 (난수 없음)");
assert.ok(tweetOnce({ 글빨: 30 }).likes > base.likes, "글빨이 높으면 좋아요가 늘어난다");
assert.ok(tweetOnce({ 감각: 30 }).views > base.views, "감각이 높으면 노출이 늘어난다");
var humorous = tweetOnce({ 유머: 35 });
assert.ok(humorous.rts / humorous.likes > base.rts / base.likes, "유머가 높으면 리트윗 비율이 오른다");
assert.ok(base.rts <= base.likes, "리트윗은 좋아요를 넘지 않는다");

// 팔로워가 많아지면 절대 수치는 커지되 반응률(좋아요/노출)은 스탯이 결정한다
var gBig = Engine.create(loadData(), null, fixedRng);
gBig.getState().followers = 8000;
var bigTweet = gBig.advanceTurn("meme", true).feedItems.filter(function (f) { return f.kind === "me"; })[0];
assert.ok(bigTweet.likes > base.likes * 50, "팔로워 8000이면 좋아요가 훨씬 많다: " + bigTweet.likes);

// 좋아요·리트윗은 알림 항목으로 남고, 타임라인 트윗이 아니다
var likeNotif = gBig.getState().feed.filter(function (f) { return f.kind === "like"; })[0];
var rtNotif = gBig.getState().feed.filter(function (f) { return f.kind === "retweet"; })[0];
assert.ok(likeNotif, "좋아요 알림이 생성됨");
assert.ok(rtNotif, "리트윗 알림이 생성됨");
assert.ok(likeNotif.actors.length >= 1 && likeNotif.actors.length <= 2, "이름은 1~2명만 표기");
assert.strictEqual(likeNotif.actors.length + likeNotif.others, bigTweet.likes,
  "이름 수 + 외 N명 = 실제 좋아요 수");
assert.strictEqual(rtNotif.actors.length + rtNotif.others, bigTweet.rts);
assert.strictEqual(likeNotif.text, bigTweet.text, "알림에 원본 트윗 내용이 붙는다");
assert.ok(likeNotif.actors[0].name && likeNotif.actors[0].handle, "알림 배우에 이름·핸들이 있다");

// 팔로우 알림: 팔로워가 는 만큼, 늘어난 턴에만
var followNotif = gBig.getState().feed.filter(function (f) { return f.kind === "follow"; })[0];
assert.ok(followNotif, "팔로워가 늘면 팔로우 알림이 생긴다");
assert.strictEqual(followNotif.actors.length + followNotif.others, gBig.getState().followers - 8000,
  "이름 수 + 외 N명 = 실제 늘어난 팔로워 수");
assert.strictEqual(followNotif.text, "", "팔로우 알림엔 인용할 트윗이 없다");
// 트윗 없이 팔로워를 사는 홍보도 알림을 남긴다 (트윗 경로 전용이 아님)
var gPromo = Engine.create(loadData(), null, fixedRng);
assert.strictEqual(gPromo.advanceTurn("promo", false).feedItems.filter(function (f) {
  return f.kind === "follow";
}).length, 1, "홍보로 산 팔로워도 알림에 뜬다");
// 팔로워가 안 늘면 알림도 없다
var gFlat = Engine.create(loadData(), null, fixedRng);
assert.strictEqual(gFlat.advanceTurn("write", false).feedItems.length, 0,
  "팔로워 변동이 없으면 팔로우 알림도 없다");

// 답글은 규모가 커지면 줄줄이 달리고, 전부 원본 트윗을 가리킨다 (상세 페이지의 근거)
var npcCount = loadData().npcs.length;
var bigReplies = gBig.getState().feed.filter(function (f) { return f.kind === "reply"; });
assert.strictEqual(bigReplies.length, Math.min(Math.round(bigTweet.likes * 0.12), npcCount),
  "답글 수 = min(좋아요×0.12, NPC 수), 실제: " + bigReplies.length);
assert.ok(bigReplies.length >= 3, "큰 계정 트윗엔 답글이 줄줄이 달린다: " + bigReplies.length);
bigReplies.forEach(function (f) {
  assert.strictEqual(f.replyTo, bigTweet.id, "모든 답글이 원본 트윗 id를 가리킨다");
});
var handles = bigReplies.map(function (f) { return f.author; });
assert.strictEqual(new Set(handles).size, handles.length, "한 스레드에 같은 계정이 중복되지 않는다");
assert.strictEqual(bigReplies[0].author, "@meme_bot99", "humor 카테고리 NPC가 먼저 답글을 단다");

// 두 트윗의 답글이 섞이지 않는다
var g2t = Engine.create(loadData(), null, fixedRng);
g2t.getState().followers = 8000;
g2t.advanceTurn("meme", true);
g2t.advanceTurn("meme", true);
var ids = g2t.getState().tweetLog.map(function (t) { return t.id; });
assert.strictEqual(new Set(ids).size, 2, "트윗 id는 중복되지 않는다: " + ids.join(","));
ids.forEach(function (id) {
  var mine = g2t.getState().feed.filter(function (f) { return f.kind === "reply" && f.replyTo === id; });
  assert.ok(mine.length > 0, id + "의 답글이 따로 남아 있다");
});

// 트윗을 안 하면 반응 알림도 없다
var gNoTweet = Engine.create(loadData(), null, fixedRng);
gNoTweet.getState().followers = 8000;
assert.strictEqual(gNoTweet.advanceTurn("meme", false).feedItems.length, 0,
  "트윗 안 하면 좋아요·리트윗 알림도 안 생긴다");

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

// 멘탈 = 컨디션 배수. 50이 기준점(×1.0)이라 위 테스트들의 수치가 그대로 유지된다.
var gMo = Engine.create(loadData(), null, fixedRng);
gMo.getState().stats.멘탈 = 100;
assert.strictEqual(gMo.previewAction("meme").tweetEffects["팔로워"], Math.round(26 * 1.2),
  "멘탈 100이면 팔로워 증가 ×1.2 (상한)");
var gMo2 = Engine.create(loadData(), null, fixedRng);
gMo2.getState().stats.멘탈 = 10; // 10/50 = 0.2 → 하한 0.4로 잘린다
var pMo = gMo2.previewAction("meme");
assert.strictEqual(pMo.tweetEffects["팔로워"], Math.round(26 * 0.4), "멘탈이 바닥이면 ×0.4 (하한)");
assert.strictEqual(gMo2.advanceTurn("meme", true).statChanges["팔로워"], pMo.tweetEffects["팔로워"],
  "컨디션 배수도 미리보기와 실제가 같아야 한다");
// 팔로워 감소와 다른 스탯은 배수를 타지 않는다
var tired = { followers: 100, stats: { 멘탈: 10, 글빨: 5 } };
assert.strictEqual(U.evalEffect("팔로워", -200, tired), -200, "팔로워 감소는 컨디션과 무관");
assert.strictEqual(U.evalEffect("돈", 80000, tired), 80000, "팔로워 외 스탯은 컨디션과 무관");

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

