var assert = require("assert");
var Engine = require("../js/engine.js");

function loadData() {
  var d = {};
  Object.assign(d, require("../data/economy.js"));
  Object.assign(d, require("../data/actions.js"));
  Object.assign(d, require("../data/npcs.js"));
  Object.assign(d, require("../data/dms.js"));
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

// 전략은 { id, tweet }을 고른다 — 행동을 뭘 할지 + 그걸 트윗할지
var strategies = {
  "랜덤": function (acts, rand) {
    return { id: acts[Math.floor(rand() * acts.length)].id, tweet: rand() < 0.5 };
  },
  "성장몰빵": function (acts, rand, state) {
    var ev = acts.filter(function (a) { return a.kind === "event"; })[0];
    if (ev) return { id: ev.id, tweet: false };
    if (state.stats.멘탈 < 20) return { id: "rest", tweet: false };
    // 글빨을 먼저 쌓고, 자료 정리가 열리면 트윗으로 환전한다
    var archive = acts.filter(function (a) { return a.id === "archive"; })[0];
    return archive ? { id: "archive", tweet: true } : { id: "write", tweet: false };
  },
  "어그로": function (acts, rand, state) {
    var ev = acts.filter(function (a) { return a.kind === "event"; })[0];
    if (ev) return { id: ev.id, tweet: false };
    if (state.stats.멘탈 < 25) return { id: "rest", tweet: false };
    // 떡밥은 트윗해야 팔로워가 붙는다 (그리고 논란성·멘탈을 대가로 낸다)
    var beef = acts.filter(function (a) { return a.id === "beef_watch"; })[0];
    return beef ? { id: "beef_watch", tweet: true } : { id: "trend", tweet: false };
  },
  // 돈 관리 경로가 성립하는지 확인한다: 쪼들리면 벌고(알바·협찬), 여유가 생기면 성장에 쓴다.
  // 홍보는 정액이라 계정이 커지면 알아서 퇴장한다 — 계속 사면 42,495에서 멈춘다(실제로 확인).
  "돈벌이": function (acts, rand, state) {
    var has = function (id) { return acts.some(function (a) { return a.id === id; }); };
    var ev = acts.filter(function (a) { return a.kind === "event"; })[0];
    if (ev) return { id: ev.id, tweet: false };
    if (state.stats.멘탈 < 20) return { id: "rest", tweet: false };
    // 빚이 깊으면 현금부터 — 협찬이 알바보다 크다
    if (state.stats.돈 < 0) {
      if (has("sponsor")) return { id: "sponsor", tweet: true };
      return { id: "parttime", tweet: true };
    }
    // 홍보가 아직 남는 장사인 구간에서만 팔로워를 산다
    if (has("promo") && state.followers < 5000) return { id: "promo", tweet: true };
    return { id: has("trend") ? "trend" : "meme", tweet: true };
  }
};

// 반응 그라인딩 전략(Critical 2 회귀 테스트). 매 턴 가능한 만큼 남의 트윗에 좋아요를
// 눌러 dailyCap을 계속 두드린다 — 한도가 없다면 논란성이 폭증해 topStat 엔딩이
// 전부 막혀야 정상인데, 한도가 있으면 100만에 도달하되 논란성으로 고정되지 않아야 한다.
//
// bait 트윗을 **우선** 훑는다 — 떡밥 계정 프로필을 둘러보며 좋아요를 누르는 건 자연스러운
// 플레이이고, 이 시나리오가 검증해야 할 실제 위험은 "bait를 챙겨 누르면 얼마나 쌓이는가"다.
// (Object.keys 순회 순서 그대로 훑으면 하루 슬롯이 앞쪽 계정에서 다 소진돼 bait 트윗에
// 아예 도달하지 못하고, 그러면 이 테스트가 아무 위험도 검증하지 않는 채로 통과해버린다.)
//
// 이미 반응(좋아요)한 트윗은 건너뛴다 — toggleReaction은 토글이라 이미 켠 걸 다시 부르면
// 꺼버린다. 실제 플레이는 한 번 누른 트윗을 다시 눌러 취소하지 않으므로 매 턴 전부를
// 무조건 다시 호출하면 좋아요 수가 껐다 켰다 진동하는 비현실적인 모델이 된다.
function grindReactions(game) {
  var state = game.getState();
  var all = [];
  Object.keys(state.npcTweets).forEach(function (h) {
    all = all.concat(state.npcTweets[h]);
  });
  all.sort(function (a, b) {
    var aBait = a.attr === "bait" ? 0 : 1;
    var bBait = b.attr === "bait" ? 0 : 1;
    return aBait - bBait;
  });
  // 한도(dailyCap)보다 넉넉히 시도한다 — 한도를 넘는 시도가 전부 정상 처리되는지도 같이 본다.
  for (var i = 0; i < all.length; i++) {
    var already = state.reacted[all[i].id];
    if (already && already.like) continue;
    game.toggleReaction(all[i].id, "like");
  }
}

strategies["반응그라인딩"] = function (acts, rand, state) {
  var has = function (id) { return acts.some(function (a) { return a.id === id; }); };
  var ev = acts.filter(function (a) { return a.kind === "event"; })[0];
  if (ev) return { id: ev.id, tweet: false };
  if (state.stats.멘탈 < 20) return { id: "rest", tweet: false };
  // 성장몰빵과 같은 뼈대(글빨을 쌓고 자료 정리로 환전) — 반응 자체의 효과만 측정하려는 것이라
  // 행동 선택은 이미 검증된 전략을 그대로 쓴다.
  var archive = acts.filter(function (a) { return a.id === "archive"; })[0];
  return archive ? { id: "archive", tweet: true } : { id: "write", tweet: false };
};

Object.keys(strategies).forEach(function (name, si) {
  var rand = mulberry32(42 + si);
  var game = Engine.create(loadData(), null, rand);
  var ending = null, turns = 0, worst = 0;
  while (!ending && turns < 500) {
    var acts = game.getActions();
    assert.ok(acts.length > 0, name + ": 가능한 행동이 없음");
    // 반응은 하루를 소모하지 않으므로 advanceTurn 전에 그 날의 반응을 다 눌러본다
    // (실제 플레이도 이 순서다 — 타임라인을 보다가 반응하고, 그다음 오늘의 행동을 고른다).
    if (name === "반응그라인딩") grindReactions(game);
    var chosen = strategies[name](acts, rand, game.getState());
    var result = game.advanceTurn(chosen.id, chosen.tweet);
    var st = game.getState();
    Object.keys(st.stats).forEach(function (k) {
      // 돈은 마이너스가 정상이다(빚). 나머지 스탯은 0이 바닥.
      if (k !== "돈") assert.ok(st.stats[k] >= 0, name + ": 스탯 " + k + " 음수");
    });
    if (st.stats.돈 < worst) worst = st.stats.돈;
    assert.ok(st.followers >= 0, name + ": 팔로워 음수");
    ending = result.ending;
    turns++;
  }
  assert.ok(ending, name + ": 500턴 안에 엔딩 실패 (팔로워 " + game.getState().followers + ")");
  var st = game.getState();
  if (name === "반응그라인딩") {
    // dailyCap이 없다면 논란성이 폭증해 사이버렉카(논란성>=200)로 무조건 고정된다(실측: bait 우선
    // 그라인딩은 dailyCap 아래에서 논란성 149 근처가 상한 — 어그로 전략의 740에는 못 미친다).
    // 한도가 있으면 논란성이 그 정도로 안 쌓여야 하고, topStat 엔딩 3종 중 하나가 나와야 한다.
    assert.notStrictEqual(ending.id, "cyber_wrecker",
      "반응그라인딩: dailyCap이 논란성 폭주를 막지 못했다 (논란성 " + st.stats.논란성 + ")");
  }
  console.log(name + " → " + ending.title + " (" + st.day + "일차, 팔로워 " +
    st.followers.toLocaleString() + ", 돈 " + st.stats.돈.toLocaleString() +
    ", 최저 " + worst.toLocaleString() + ")");
});
console.log("sim OK");
