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

// 컨셉당 전용 트윗이 실제로 들어 있는지 (없으면 그 계정은 타임라인에 안 나타난다)
var noTweets = npcs.filter(function (n) { return !n.tweets || !n.tweets.length; });
assert.strictEqual(noTweets.length, 0,
  "전용 트윗이 없는 계정: " + noTweets.map(function (n) { return n.handle; }).join(", "));

// 같은 트윗 문구를 두 계정이 쓰면 컨셉이 겹친 것 — 계정별 전용이 아니게 된다
var seen = {}, dup = [];
npcs.forEach(function (n) {
  n.tweets.forEach(function (t) {
    if (seen[t]) dup.push(seen[t] + " / " + n.handle + ": " + t);
    seen[t] = n.handle;
  });
});
assert.strictEqual(dup.length, 0, "여러 계정이 같은 트윗을 쓴다:\n  " + dup.join("\n  "));

console.log("assets OK — 계정 " + npcs.length + "개, 아바타 " + (npcs.length + 1) +
  "개, 전용 트윗 " + Object.keys(seen).length + "개");
