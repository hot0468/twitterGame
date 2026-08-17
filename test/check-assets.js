// 계정마다 프로필 사진이 실제로 있는지 검사한다.
// 파일명 규칙(핸들에서 @를 뗀 것)이 코드가 아니라 관례라서, 빠뜨려도 브라우저를 열기 전엔 모른다.
var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var dir = path.join(root, "assets", "avatars");
var npcs = require(path.join(root, "data", "npcs.js")).npcs;

function has(name) { return fs.existsSync(path.join(dir, name + ".svg")); }

// 플레이어
assert.ok(has("me"), "me.svg가 없다 — 내 아바타가 전부 깨진다");

// NPC 전원
var missing = npcs.filter(function (n) { return !has(n.handle.replace("@", "")); });
assert.strictEqual(missing.length, 0,
  "아바타 없는 계정: " + missing.map(function (n) { return n.handle; }).join(", ") +
  "\n  assets/avatars/README.md의 curl 한 줄로 받으면 된다");

// 반대로 쓰이지 않는 사진이 쌓이는 것도 잡아준다(계정을 지웠을 때)
var used = npcs.map(function (n) { return n.handle.replace("@", "") + ".svg"; }).concat("me.svg");
var orphans = fs.readdirSync(dir).filter(function (f) {
  return f.endsWith(".svg") && used.indexOf(f) === -1;
});
assert.strictEqual(orphans.length, 0, "쓰이지 않는 아바타: " + orphans.join(", "));

// 계정은 고정 목록(tweets)이나 생성기(tweetGen) 중 하나는 있어야 타임라인에 나타난다
function hasFixed(n) { return n.tweets && n.tweets.length; }
function hasGen(n) { return n.tweetGen && n.tweetGen.fragments && n.tweetGen.fragments.length; }
var silent = npcs.filter(function (n) { return !hasFixed(n) && !hasGen(n); });
assert.strictEqual(silent.length, 0,
  "올릴 트윗이 없는 계정: " + silent.map(function (n) { return n.handle; }).join(", "));

// 생성기 조각은 minLength 이상이어야 한다 — 가장 짧은 조각이 트윗의 실제 최소 길이를 정한다
var gen = require(path.join(root, "data", "npcs.js")).timeline.gen;
npcs.filter(hasGen).forEach(function (n) {
  var short = n.tweetGen.fragments.filter(function (f) { return f.length < gen.minLength; });
  assert.strictEqual(short.length, 0, n.handle + ": " + gen.minLength +
    "자보다 짧은 조각이 있다 → " + short.join(" / "));
  var long = n.tweetGen.fragments.filter(function (f) { return f.length > gen.maxLength; });
  assert.strictEqual(long.length, 0, n.handle + ": " + gen.maxLength + "자를 넘는 조각이 있다");
  assert.strictEqual(new Set(n.tweetGen.fragments).size, n.tweetGen.fragments.length,
    n.handle + ": 중복된 조각이 있다");
  // 조각이 상한(max)보다 적으면 긴 트윗을 채울 재료가 부족해진다
  assert.ok(n.tweetGen.fragments.length >= 20,
    n.handle + ": 조각이 너무 적다(" + n.tweetGen.fragments.length + "개)");
});

// 프로필 페이지가 채워지는지 — bio나 followers가 없으면 남의 프로필이 빈칸으로 뜬다
var noBio = npcs.filter(function (n) { return !n.bio; });
assert.strictEqual(noBio.length, 0,
  "소개글(bio)이 없는 계정: " + noBio.map(function (n) { return n.handle; }).join(", "));
var noFollowers = npcs.filter(function (n) { return typeof n.followers !== "number"; });
assert.strictEqual(noFollowers.length, 0,
  "팔로워 수가 없는 계정: " + noFollowers.map(function (n) { return n.handle; }).join(", "));

// 같은 트윗 문구를 두 계정이 쓰면 컨셉이 겹친 것 — 계정별 전용이 아니게 된다
var seen = {}, dup = [];
npcs.filter(hasFixed).forEach(function (n) {
  n.tweets.forEach(function (t) {
    if (seen[t]) dup.push(seen[t] + " / " + n.handle + ": " + t);
    seen[t] = n.handle;
  });
});
assert.strictEqual(dup.length, 0, "여러 계정이 같은 트윗을 쓴다:\n  " + dup.join("\n  "));

console.log("assets OK — 계정 " + npcs.length + "개, 아바타 " + (npcs.length + 1) +
  "개, 고정 트윗 " + Object.keys(seen).length + "개, 생성형 계정 " + npcs.filter(hasGen).length + "개");
