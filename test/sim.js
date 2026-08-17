var assert = require("assert");
var Engine = require("../js/engine.js");

function loadData() {
  var d = {};
  Object.assign(d, require("../data/economy.js"));
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

Object.keys(strategies).forEach(function (name, si) {
  var rand = mulberry32(42 + si);
  var game = Engine.create(loadData(), null, rand);
  var ending = null, turns = 0, worst = 0;
  while (!ending && turns < 500) {
    var acts = game.getActions();
    assert.ok(acts.length > 0, name + ": 가능한 행동이 없음");
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
  console.log(name + " → " + ending.title + " (" + st.day + "일차, 팔로워 " +
    st.followers.toLocaleString() + ", 돈 " + st.stats.돈.toLocaleString() +
    ", 최저 " + worst.toLocaleString() + ")");
});
console.log("sim OK");
