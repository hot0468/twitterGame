// 계정 데이터가 실제로 굴러갈 수 있는 상태인지 검사한다.
// 파일명 규칙·조각 규칙은 코드가 아니라 관례라서, 어겨도 브라우저를 열기 전엔 모른다.
var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var dir = path.join(root, "assets", "avatars");
var data = require(path.join(root, "data", "npcs.js"));
var npcs = data.npcs;
var gen = data.timeline.gen;

function has(name) { return fs.existsSync(path.join(dir, name + ".svg")); }

// ── 프로필 사진 ──
assert.ok(has("me"), "me.svg가 없다 — 내 아바타가 전부 깨진다");

var missing = npcs.filter(function (n) { return !has(n.handle.replace("@", "")); });
assert.strictEqual(missing.length, 0,
  "아바타 없는 계정: " + missing.map(function (n) { return n.handle; }).join(", ") +
  "\n  assets/avatars/README.md의 curl 한 줄로 받으면 된다");

// 계정을 지웠을 때 쓰이지 않는 사진이 쌓이는 것도 잡아준다
var used = npcs.map(function (n) { return n.handle.replace("@", "") + ".svg"; }).concat("me.svg");
var orphans = fs.readdirSync(dir).filter(function (f) {
  return f.endsWith(".svg") && used.indexOf(f) === -1;
});
assert.strictEqual(orphans.length, 0, "쓰이지 않는 아바타: " + orphans.join(", "));

// ── 프로필 내용 ──
var noBio = npcs.filter(function (n) { return !n.bio; });
assert.strictEqual(noBio.length, 0,
  "소개글(bio)이 없는 계정: " + noBio.map(function (n) { return n.handle; }).join(", "));
var noFollowers = npcs.filter(function (n) { return typeof n.followers !== "number"; });
assert.strictEqual(noFollowers.length, 0,
  "팔로워 수가 없는 계정: " + noFollowers.map(function (n) { return n.handle; }).join(", "));
var noReplies = npcs.filter(function (n) { return !n.replies || !n.replies.length; });
assert.strictEqual(noReplies.length, 0,
  "답글이 없는 계정: " + noReplies.map(function (n) { return n.handle; }).join(", "));

// ── 트윗 조각 ──
// 모든 계정이 생성기를 쓴다. 고정 목록(tweets)은 없앴으므로 남아 있으면 죽은 데이터다.
var leftover = npcs.filter(function (n) { return n.tweets; });
assert.strictEqual(leftover.length, 0,
  "tweets(고정 목록)가 남아 있다 — 이제 엔진이 안 읽는다: " +
  leftover.map(function (n) { return n.handle; }).join(", "));

var silent = npcs.filter(function (n) {
  return !n.tweetGen || !n.tweetGen.fragments || !n.tweetGen.fragments.length;
});
assert.strictEqual(silent.length, 0,
  "조각이 없는 계정(트윗을 못 올린다): " + silent.map(function (n) { return n.handle; }).join(", "));

var owner = {}, cross = [];
npcs.forEach(function (n) {
  var frags = n.tweetGen.fragments;

  var short = frags.filter(function (f) { return f.length < gen.minLength; });
  assert.strictEqual(short.length, 0, n.handle + ": " + gen.minLength +
    "자보다 짧은 조각 → " + short.map(function (f) { return f + "(" + f.length + ")"; }).join(" / "));
  var long = frags.filter(function (f) { return f.length > gen.maxLength; });
  assert.strictEqual(long.length, 0, n.handle + ": " + gen.maxLength + "자를 넘는 조각이 있다");

  assert.strictEqual(new Set(frags).size, frags.length, n.handle + ": 계정 안에 중복된 조각이 있다");
  // 조각이 적으면 긴 트윗을 채울 재료가 부족해 목표 길이에 못 닿는다
  assert.ok(frags.length >= 18, n.handle + ": 조각이 너무 적다(" + frags.length + "개, 18개 이상)");

  // 길이가 한쪽으로 몰리면 짧은 트윗이나 긴 트윗 한쪽이 안 나온다
  assert.ok(Math.min.apply(null, frags.map(function (f) { return f.length; })) <= 16,
    n.handle + ": 짧은 조각(16자 이하)이 없어 짧은 트윗을 만들 수 없다");

  frags.forEach(function (f) {
    if (owner[f] && owner[f] !== n.handle) cross.push(owner[f] + " / " + n.handle + ": " + f);
    owner[f] = n.handle;
  });
});
// 계정 간에 같은 문구를 쓰면 컨셉이 겹친다 — 전용 트윗이 아니게 된다
assert.strictEqual(cross.length, 0, "여러 계정이 같은 조각을 쓴다:\n  " + cross.join("\n  "));

var total = npcs.reduce(function (a, n) { return a + n.tweetGen.fragments.length; }, 0);
console.log("assets OK — 계정 " + npcs.length + "개, 아바타 " + (npcs.length + 1) +
  "개, 조각 " + total + "개 (계정당 평균 " + Math.round(total / npcs.length) + "개)");
