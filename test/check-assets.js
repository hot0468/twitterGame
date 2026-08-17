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

// ── 트윗 ──
// 트윗은 통째로 하나씩 저장한다(조각 조합 아님). 보관함에 있는 건 후보에서 빠지므로
// 계정의 트윗 수가 max보다 많아야 매일 새 트윗이 나온다.
var leftover = npcs.filter(function (n) { return n.tweetGen; });
assert.strictEqual(leftover.length, 0,
  "tweetGen(조각 조합)이 남아 있다 — 이제 엔진이 안 읽는다: " +
  leftover.map(function (n) { return n.handle; }).join(", "));

var silent = npcs.filter(function (n) { return !n.tweets || !n.tweets.length; });
assert.strictEqual(silent.length, 0,
  "올릴 트윗이 없는 계정: " + silent.map(function (n) { return n.handle; }).join(", "));

var owner = {}, cross = [], lengths = [];
npcs.forEach(function (n) {
  var t = n.tweets;

  var short = t.filter(function (x) { return x.length < gen.minLength; });
  assert.strictEqual(short.length, 0, n.handle + ": " + gen.minLength +
    "자보다 짧은 트윗 → " + short.map(function (x) { return x + "(" + x.length + ")"; }).join(" / "));
  var long = t.filter(function (x) { return x.length > gen.maxLength; });
  assert.strictEqual(long.length, 0, n.handle + ": " + gen.maxLength + "자를 넘는 트윗 → " +
    long.map(function (x) { return x.slice(0, 18) + "…(" + x.length + ")"; }).join(" / "));

  assert.strictEqual(new Set(t).size, t.length, n.handle + ": 계정 안에 중복된 트윗이 있다");

  // 여유분이 없으면 보관함이 찬 뒤 그 계정은 새 트윗을 못 올린다
  assert.ok(t.length > gen.max, n.handle + ": 트윗이 " + t.length + "개인데 max가 " + gen.max +
    "다 — max보다 많아야 매일 새 트윗이 나온다");

  // 길이가 한쪽으로 몰리면 타임라인이 심심하거나 벽처럼 보인다
  var lens = t.map(function (x) { return x.length; });
  assert.ok(Math.min.apply(null, lens) <= 25, n.handle + ": 짧은 트윗(25자 이하)이 없다");
  assert.ok(Math.max.apply(null, lens) >= 90, n.handle + ": 긴 트윗(90자 이상)이 없다 (최장 " +
    Math.max.apply(null, lens) + "자)");
  lengths = lengths.concat(lens);

  t.forEach(function (x) {
    if (owner[x] && owner[x] !== n.handle) cross.push(owner[x] + " / " + n.handle + ": " + x);
    owner[x] = n.handle;
  });
});
// 계정 간에 같은 트윗을 쓰면 컨셉이 겹친다
assert.strictEqual(cross.length, 0, "여러 계정이 같은 트윗을 쓴다:\n  " + cross.join("\n  "));

// 전체 길이 분포 — 네 구간에 모두 걸쳐야 골고루라 할 수 있다
var span = (gen.maxLength - gen.minLength) / 4, buckets = [0, 0, 0, 0];
lengths.forEach(function (L) { buckets[Math.min(3, Math.floor((L - gen.minLength) / span))]++; });
// 네 구간이 모두 채워져 있어야 한다(한쪽만 있으면 타임라인이 심심하거나 벽이 된다).
// 완전히 균등할 필요는 없다 — 실제 트윗도 짧은 쪽이 많다. 다만 긴 쪽이 비면 안 된다.
buckets.forEach(function (b, i) {
  var range = [[10, 42], [43, 75], [76, 107], [108, 140]][i];
  assert.ok(b >= 3, range[0] + "~" + range[1] + "자 트윗이 " + b + "개뿐이다 (3개 이상 필요)");
});
console.log("  길이 분포 " + buckets.join(" / ") + " (10~42 / 43~75 / 76~107 / 108~140자)");
var total = npcs.reduce(function (a, n) { return a + n.tweets.length; }, 0);
console.log("assets OK — 계정 " + npcs.length + "개, 아바타 " + (npcs.length + 1) +
  "개, 트윗 " + total + "개 (계정당 " + Math.round(total / npcs.length) + "개)");
