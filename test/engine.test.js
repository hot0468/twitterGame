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
  Object.assign(d, require("../data/economy.js"));
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

// 구버전 세이브 보정: "없었던 필드"는 기본값을 채우기 전에 기록해야 한다.
// saved와 state는 같은 객체라, 채운 뒤에 saved.x === undefined로 물으면 영원히 거짓이다.
var legacy3 = { day: 40, followers: 5000,
  stats: { 글빨: 20, 유머: 20, 감각: 20, 멘탈: 50, 돈: 300000, 논란성: 5 },
  tweetSeq: 3,
  feed: [{ kind: "like", actors: [{ handle: "@a", name: "a" }], others: 5, text: "", day: 39 },
    { kind: "follow", actors: [{ handle: "@b", name: "b" }], others: 2, text: "", day: 38 }],
  tweetLog: [{ id: "tw1", author: "me", text: "옛 트윗", day: 39, views: 9999, kind: "me" }],
  activeEvents: [], eventHistory: [], ending: null };
var g3d = Engine.create(loadData(), legacy3);
assert.strictEqual(g3d.getState().lastSettleDay, 40,
  "정산 기준일이 없던 세이브는 '지금부터' 센다 (1로 두면 옛 트윗을 몰아서 정산한다)");
assert.strictEqual(g3d.getState().notifSeen, 2,
  "알림 읽음 기준이 없던 세이브는 지금까지를 다 읽은 것으로 본다");
// 그 다음 턴에 옛 트윗(9999회)이 정산에 섞이지 않는다
assert.strictEqual(g3d.advanceTurn("write", true).settlement, null,
  "보정 직후엔 정산이 바로 터지지 않는다");

// 반대로 값이 있는 세이브는 건드리지 않는다
var keep = JSON.parse(JSON.stringify(legacy3));
keep.lastSettleDay = 36; keep.notifSeen = 1;
var g3e = Engine.create(loadData(), keep);
assert.strictEqual(g3e.getState().lastSettleDay, 36, "있는 값은 덮어쓰지 않는다");
assert.strictEqual(g3e.getState().notifSeen, 1, "있는 값은 덮어쓰지 않는다");

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
assert.strictEqual(gFlat.advanceTurn("write", false).feedItems.filter(function (f) {
  return f.kind === "follow";
}).length, 0, "팔로워 변동이 없으면 팔로우 알림도 없다");

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
assert.strictEqual(gNoTweet.advanceTurn("meme", false).feedItems.filter(function (f) {
  return f.kind === "like" || f.kind === "retweet";
}).length, 0, "트윗 안 하면 좋아요·리트윗 알림도 안 생긴다");

// 트윗을 안 하면: 행동 효과만, 피드는 그대로
var g5 = Engine.create(loadData(), null, fixedRng);
var r2 = g5.advanceTurn("meme", false);
assert.strictEqual(g5.getState().day, 2, "트윗 안 해도 하루는 지난다");
assert.strictEqual(g5.getState().stats.유머, 7, "행동 효과는 트윗 여부와 무관");
assert.strictEqual(g5.getState().followers, 10, "트윗 안 하면 팔로워 불변");
assert.strictEqual(r2.feedItems.filter(function (f) {
  return f.kind !== "npc";
}).length, 0, "트윗 안 하면 내 흔적은 피드에 안 남는다 (NPC 트윗은 계속 흐른다)");
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

// 돈: 벌고 / 쓰고 / 부족하면 잠긴다. 하루가 지나면 생활비가 무조건 나간다.
var LIVING = loadData().economy.livingCost;
var gm = Engine.create(loadData(), null, fixedRng);
assert.strictEqual(gm.getState().stats.돈, 300000, "시작 돈 300,000원");
gm.advanceTurn("parttime", false);
assert.strictEqual(gm.getState().stats.돈, 380000 - LIVING, "알바 +80,000원, 생활비 -10,000원");
assert.strictEqual(gm.getState().stats.멘탈, 46, "알바는 멘탈 -4");

var gm2 = Engine.create(loadData(), null, fixedRng);
gm2.advanceTurn("promo", false);
assert.strictEqual(gm2.getState().stats.돈, 50000 - LIVING, "홍보 -250,000원");
assert.strictEqual(gm2.getState().followers, 260, "홍보로 팔로워 +250");
assert.ok(gm2.getActions().map(function (a) { return a.id; }).indexOf("promo") === -1,
  "돈 250,000원 미만이면 홍보가 잠긴다");

var gm3 = Engine.create(loadData(), null, fixedRng);
assert.ok(gm3.getActions().map(function (a) { return a.id; }).indexOf("sponsor") === -1,
  "팔로워 500 미만이면 협찬이 잠긴다");
gm3.getState().followers = 1000;
assert.ok(gm3.getActions().map(function (a) { return a.id; }).indexOf("sponsor") !== -1, "팔로워 충족 시 해금");
gm3.advanceTurn("sponsor", false);
assert.strictEqual(gm3.getState().stats.돈, 300000 - LIVING, "협찬은 트윗을 올려야 돈이 들어온다");
var gm4 = Engine.create(loadData(), null, fixedRng);
gm4.getState().followers = 1000;
gm4.advanceTurn("sponsor", true);
assert.strictEqual(gm4.getState().stats.돈, 300000 + 150000 + 2000 - LIVING, "협찬 트윗: 150000 + 팔로워*2");
assert.strictEqual(gm4.getState().stats.논란성, 4, "협찬은 논란성 +4가 대가");

// ── 프리미엄 경제: 생활비 / 주간 정산 / 마이너스 통장 ──
// 생활비는 행동과 무관한 고정 지출이라 statChanges에 안 들어간다(미리보기와 1:1로 맞아야 하므로)
var gLiv = Engine.create(loadData(), null, function () { return 0.99; });
var rLiv = gLiv.advanceTurn("rest", false);
assert.strictEqual(rLiv.statChanges.돈, undefined, "생활비는 행동 효과가 아니다");
assert.strictEqual(gLiv.getState().stats.돈, 300000 - LIVING, "그래도 돈에서는 빠져나간다");

// 멘탈 붕괴로 이틀이 지나면 생활비도 이틀 치
var gLiv2 = Engine.create(loadData(), null, function () { return 0.99; });
gLiv2.getState().stats.멘탈 = 5;
gLiv2.getState().stats.감각 = 10;
gLiv2.advanceTurn("beef_watch", true); // 멘탈 -5 → 0 → 붕괴로 하루 더
assert.strictEqual(gLiv2.getState().day, 3, "붕괴로 이틀이 지난다");
assert.ok(gLiv2.getState().stats.돈 <= 300000 - LIVING * 2, "이틀 살았으면 생활비도 이틀 치");

// 7일이 지나면 정산: 그 주에 올린 트윗의 조회수 합 × 단가 - 프리미엄 요금
var eco = loadData().economy;
var gSet = Engine.create(loadData(), null, function () { return 0.99; });
gSet.getState().followers = 50000;
var settleResult = null, weekViews = 0;
for (var d = 0; d < eco.settleEvery; d++) {
  var rs = gSet.advanceTurn("write", true);
  weekViews += rs.feedItems.filter(function (f) { return f.kind === "me"; })[0].views;
  if (rs.settlement) settleResult = rs.settlement;
}
assert.ok(settleResult, eco.settleEvery + "일차에 정산이 나온다");
assert.strictEqual(gSet.getState().day, eco.settleEvery + 1);
assert.strictEqual(settleResult.views, weekViews, "정산 조회수 = 그 주 트윗 조회수 합");
assert.strictEqual(settleResult.payout,
  Math.round(weekViews * eco.payoutPer1000Views / 1000), "정산금 = 조회수/1000 × 단가");
assert.strictEqual(settleResult.net, settleResult.payout - eco.premiumFee,
  "순수입 = 정산금 - 프리미엄 결제료");
assert.deepStrictEqual([settleResult.from, settleResult.to], [1, eco.settleEvery],
  "정산 구간은 1~7일차");
assert.ok(gSet.getState().feed.some(function (f) { return f.kind === "settlement"; }),
  "정산은 피드에 남는다");
// 정산은 주 1회뿐 — 다음 턴에 또 나오면 안 된다
assert.strictEqual(gSet.advanceTurn("write", true).settlement, null, "정산은 주 1회");

// 트윗을 한 번도 안 올린 주는 조회수 0 → 요금만 빠진다
var gIdle = Engine.create(loadData(), null, function () { return 0.99; });
var idleSettle = null;
for (var i = 0; i < eco.settleEvery; i++) {
  idleSettle = gIdle.advanceTurn("rest", false).settlement || idleSettle;
}
assert.strictEqual(idleSettle.views, 0, "안 올렸으면 조회수 0");
assert.strictEqual(idleSettle.net, -eco.premiumFee, "정산금 0이어도 프리미엄 요금은 나간다");

// 돈은 마이너스로 내려간다 (파산 = 게임 오버가 아니라 회생 대상)
var gDebt = Engine.create(loadData(), null, function () { return 0.99; });
gDebt.getState().stats.돈 = 5000;
gDebt.advanceTurn("rest", false);
assert.strictEqual(gDebt.getState().stats.돈, -5000, "생활비를 못 내면 마이너스로 간다");
assert.strictEqual(gDebt.getState().ending, null, "빚을 져도 게임이 끝나지 않는다");
gDebt.advanceTurn("rest", false);
assert.ok(gDebt.getState().stats.돈 < -5000, "계속 살면 빚이 더 깊어진다");
// 돈만 예외다 — 다른 스탯은 여전히 0이 바닥
var gFloor = Engine.create(loadData(), null, function () { return 0.99; });
gFloor.getState().stats.논란성 = 2;
gFloor.getState().stats.감각 = 10;
gFloor.advanceTurn("beef_watch", false); // 논란성을 깎는 경로는 이벤트뿐이라 값만 확인
assert.ok(gFloor.getState().stats.논란성 >= 0, "논란성은 0 미만으로 안 내려간다");
assert.ok(gFloor.getState().stats.돈 < 300000, "같은 턴에 돈은 생활비만큼 줄었다");

// 마이너스 통장이 대출 이벤트를 부른다 (그 자체가 컨텐츠)
var gLoan = Engine.create(loadData(), null, fixedRng); // rand()=0 → chance 무시
gLoan.getState().stats.돈 = -100;
var rLoan = gLoan.advanceTurn("rest", false);
assert.ok(rLoan.triggeredEvents.indexOf("loan_offer") !== -1,
  "돈이 마이너스면 대부업체 DM이 온다: " + rLoan.triggeredEvents.join(","));
var loanChoices = gLoan.getActions().filter(function (a) { return a.kind === "event"; });
assert.strictEqual(loanChoices.length, 3, "대출 선택지 3개");
var moneyBefore = gLoan.getState().stats.돈, moraleBefore = gLoan.getState().stats.멘탈;
gLoan.advanceTurn("event:loan_offer:0", false); // 급전 대출
assert.strictEqual(gLoan.getState().stats.돈, moneyBefore + 800000 - LIVING, "대출금이 들어온다");
assert.strictEqual(gLoan.getState().stats.멘탈, moraleBefore - 12, "이자 압박으로 멘탈 -12");

// 빚이 깊어지면 독촉 이벤트
var gDeep = Engine.create(loadData(), null, fixedRng);
gDeep.getState().stats.돈 = -600000;
gDeep.getState().eventHistory.push("loan_offer"); // 1단계는 이미 지났다고 보고
assert.ok(gDeep.advanceTurn("rest", false).triggeredEvents.indexOf("debt_deep") !== -1,
  "50만원 넘게 빚지면 독촉이 온다");

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
// 목표는 100만 팔로워
var GOAL = loadData().endings.threshold;
assert.strictEqual(GOAL, 1000000, "엔딩 임계값 = 100만 팔로워");

var g10 = Engine.create(loadData(), null, function () { return 0.99; }); // 이벤트 미발동
g10.getState().followers = GOAL - 1;
g10.getState().stats.글빨 = 30;
var r6 = g10.advanceTurn("archive", true); // 트윗 시 글빨*4 + 팔로워*4% → 임계값 돌파
assert.ok(r6.ending, "임계값 도달 시 엔딩");
assert.strictEqual(r6.ending.id, "author", "글빨 최고 → 등단 작가");
assert.strictEqual(g10.getState().ending, "author");

var g11 = Engine.create(loadData(), null, function () { return 0.99; });
g11.getState().followers = GOAL;
g11.getState().stats.논란성 = 50;
g11.getState().stats.유머 = 40;
var r7 = g11.advanceTurn("meme", false);
assert.strictEqual(r7.ending.id, "cyber_wrecker", "논란성 조건이 topStat보다 우선(list 순서)");

// 빚을 진 채로 100만을 찍으면 빚쟁이 엔딩 (파산은 게임 오버가 아니다)
var g11b = Engine.create(loadData(), null, function () { return 0.99; });
g11b.getState().followers = GOAL;
g11b.getState().stats.돈 = -1000000;
g11b.getState().stats.유머 = 40;
assert.strictEqual(g11b.advanceTurn("meme", false).ending.id, "debt_star",
  "마이너스 통장으로 목표 달성 → 빚쟁이 스타");

var g12 = Engine.create(loadData(), null, function () { return 0.99; });
g12.getState().followers = GOAL;
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

// --- Task 6: 생성형 계정 (보관함 + 길이 분포) ---
var GEN = loadData().timeline.gen;
var genNpc = loadData().npcs.filter(function (n) { return n.tweetGen; })[0];
assert.ok(genNpc, "생성형 계정이 하나 있다");

// 목표 길이는 min~max를 고르게 덮는다 — 한 바퀴(max개) 동안 모든 칸을 정확히 한 번 지난다
var slots = [];
for (var s = 0; s < GEN.max; s++) slots.push(U.targetLength(s, GEN));
assert.strictEqual(new Set(slots).size, GEN.max,
  "목표 길이가 " + GEN.max + "칸 전부를 한 번씩 지나야 한다 (실제 " + new Set(slots).size + "종)");
assert.strictEqual(Math.min.apply(null, slots), GEN.minLength, "최단 목표 = minLength");
assert.strictEqual(Math.max.apply(null, slots), GEN.maxLength, "최장 목표 = maxLength");
// 사다리를 순서대로 밟지 않는다 (그러면 초반에 짧은 트윗만 몰린다)
assert.ok(slots[0] !== Math.min.apply(null, slots.slice(0, 5)) ||
  slots[1] > slots[0] + 10, "목표 길이가 단조 증가하면 분포가 한쪽으로 몰린다");

// 실제로 생성된 트윗이 전부 10~140자 안에 들고, 범위를 고르게 채운다
var lengths = [];
for (var k = 0; k < GEN.max; k++) {
  lengths.push(U.composeTweet(genNpc.tweetGen.fragments, U.targetLength(k, GEN),
    function (arr) { return arr[(k * 7) % arr.length]; }).length);
}
assert.ok(Math.min.apply(null, lengths) >= GEN.minLength,
  "10자 미만 트윗이 나왔다: " + Math.min.apply(null, lengths));
assert.ok(Math.max.apply(null, lengths) <= GEN.maxLength,
  "140자 초과 트윗이 나왔다: " + Math.max.apply(null, lengths));
// 4구간(10~42/43~75/76~107/108~140)에 모두 걸쳐야 "골고루"라 할 수 있다
var buckets = [0, 0, 0, 0], span = (GEN.maxLength - GEN.minLength) / 4;
lengths.forEach(function (L) {
  buckets[Math.min(3, Math.floor((L - GEN.minLength) / span))]++;
});
assert.ok(buckets.every(function (b) { return b >= 5; }),
  "길이가 한쪽으로 몰렸다 (구간별 개수: " + buckets.join("/") + ")");

// 조각을 두 번 쓰지 않는다
var longTweet = U.composeTweet(genNpc.tweetGen.fragments, GEN.maxLength, function (a) { return a[0]; });
var sentences = longTweet.split(" ").length;
assert.ok(longTweet.length <= GEN.maxLength, "목표를 넘지 않는다: " + longTweet.length);
assert.ok(sentences > 1, "긴 목표는 문장 여러 개로 채운다");

// 보관함은 "발견한 날"부터 자란다 — 만나기 전엔 아무것도 없다
var gBox = Engine.create(loadData(), null, function () { return 0.99; }); // 이벤트 미발동
assert.deepStrictEqual(gBox.getState().npcTweets, {}, "시작 시엔 보관함이 비어 있다");
assert.deepStrictEqual(gBox.getState().npcSeen, {}, "시작 시엔 발견 기록도 없다");

// 발견을 강제한다 (실제로는 답글·좋아요로 등장한다)
var seenOn = 5;
gBox.getState().npcSeen[genNpc.handle] = seenOn;
gBox.getState().day = seenOn + 1;
var rBox = gBox.advanceTurn("rest", false);
var box = gBox.getState().npcTweets[genNpc.handle];
assert.strictEqual(box.length, GEN.seed + GEN.perDay,
  "발견 후 첫 턴에 과거 " + GEN.seed + "개 + 오늘 " + GEN.perDay + "개");
// 과거 트윗은 발견한 날 이전 날짜로 깔린다
var past = box.slice(0, GEN.seed).map(function (t) { return t.day; });
assert.deepStrictEqual([Math.min.apply(null, past), Math.max.apply(null, past)],
  [seenOn - GEN.seed, seenOn - 1], "과거 트윗은 발견일 직전까지의 날짜를 쓴다");
// 과거 트윗은 내 타임라인에 흐르지 않는다 (첫날부터 20개로 도배되면 안 된다)
assert.strictEqual(rBox.feedItems.filter(function (f) {
  return f.kind === "npc" && f.author === genNpc.handle;
}).length, GEN.perDay, "타임라인에는 오늘 몫만 흐른다");

// 그 다음부터 하루 perDay개씩
gBox.advanceTurn("rest", false);
assert.strictEqual(box.length, GEN.seed + GEN.perDay * 2, "하루 " + GEN.perDay + "개씩 늘어난다");

// 상한에서 멈추고, 오래된 것부터 밀려난다
var oldestBefore;
for (var t2 = 0; t2 < 40; t2++) {
  if (box.length >= GEN.max) { oldestBefore = box[0].text; }
  gBox.advanceTurn("rest", false);
}
assert.strictEqual(box.length, GEN.max, "보관함은 " + GEN.max + "개를 넘지 않는다: " + box.length);
assert.notStrictEqual(box[0].text, oldestBefore, "상한에 닿으면 오래된 것부터 밀려난다");
// 밀려나도 길이 사다리는 계속 진행한다 (같은 길이만 반복되면 안 된다)
assert.ok(gBox.getState().npcSeq[genNpc.handle] > GEN.max,
  "누적 생성 수는 상한과 무관하게 계속 늘어난다");
var lateLengths = box.map(function (t) { return t.text.length; });
assert.ok(new Set(lateLengths).size > 10,
  "보관함 안 길이가 다양해야 한다 (실제 " + new Set(lateLengths).size + "종)");

// 만나지 않은 계정은 계속 조용하다
var gQuiet = Engine.create(loadData(), null, function () { return 0.99; });
gQuiet.advanceTurn("rest", false);
gQuiet.advanceTurn("rest", false);
assert.strictEqual(gQuiet.getState().npcTweets[genNpc.handle], undefined,
  "발견하지 않은 계정은 보관함이 생기지 않는다");

// 발견 기록은 등장 경로와 무관하게 남는다 (답글·좋아요·팔로우·트윗)
var gSeen = Engine.create(loadData(), null, function () { return 0; }); // 모든 NPC가 반응
gSeen.getState().followers = 8000;
gSeen.advanceTurn("meme", true);
var seenList = Object.keys(gSeen.getState().npcSeen);
assert.ok(seenList.length > 3, "트윗 한 번에 여러 계정을 만난다: " + seenList.length);
seenList.forEach(function (h) {
  assert.strictEqual(gSeen.getState().npcSeen[h], 1, h + ": 처음 본 날이 1일차로 기록된다");
});
assert.ok(seenList.indexOf("@world") === -1, "@world는 계정이 아니라서 기록하지 않는다");

console.log("Task 6 OK");

