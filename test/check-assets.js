// 계정 데이터가 실제로 굴러갈 수 있는 상태인지 검사한다.
// 파일명 규칙·조각 규칙은 코드가 아니라 관례라서, 어겨도 브라우저를 열기 전엔 모른다.
var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var dir = path.join(root, "assets", "avatars");
// 데이터 파일마다 자기 GAME_DATA를 export하므로(브라우저에선 전역을 공유하지만
// Node의 require에선 모듈마다 독립이다) 합쳐서 써야 한다 — 다른 테스트들과 같은 방식이다.
var data = {};
Object.assign(data, require(path.join(root, "data", "npcs.js")));
Object.assign(data, require(path.join(root, "data", "ads.js")));   // 광고 계정도 아바타를 쓴다
var npcs = data.npcs;
var gen = data.timeline.gen;

// 아바타는 확장자가 둘이다 — 대부분 open-peeps 일러스트(.svg), 일부 계정만 실사 사진(.jpg).
// 어느 쪽이든 있으면 통과이고, 어느 쪽인지는 ui.js의 PHOTO_PFP와 대조한다(아래).
var EXTS = [".svg", ".jpg"];
function extOf(name) {
  for (var i = 0; i < EXTS.length; i++) {
    if (fs.existsSync(path.join(dir, name + EXTS[i]))) return EXTS[i];
  }
  return null;
}
function has(name) { return extOf(name) !== null; }
function isAvatarFile(f) { return EXTS.some(function (e) { return f.endsWith(e); }); }

// ── ui.js가 표기용으로 복제한 GAIN_MAX/ATTR_STAT가 data/npcs.js의 reaction과 맞는지 ──
// js/ui.js는 DOM 없이 require는 되지만 GAIN_MAX·ATTR_STAT는 export되지 않는 클로저 변수라
// (check-css.js가 이미 쓰는 관례대로) 소스를 텍스트로 읽어 값을 뽑아 대조한다.
// 한쪽만 바꾸면 게이지 칸 수나 배지 색이 조용히 어긋나므로 테스트로 묶어둔다.
var uiSrc = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");

var gainMaxMatch = /GAIN_MAX\s*=\s*(\d+)/.exec(uiSrc);
assert.ok(gainMaxMatch, "js/ui.js에서 GAIN_MAX를 못 찾았다");
assert.strictEqual(Number(gainMaxMatch[1]), data.reaction.perPoint,
  "ui.js의 GAIN_MAX(" + gainMaxMatch[1] + ")가 data/npcs.js의 reaction.perPoint(" +
  data.reaction.perPoint + ")와 다르다 — 게이지 칸 수가 어긋난다");

var attrStatMatch = /ATTR_STAT\s*=\s*\{([^}]*)\}/.exec(uiSrc);
assert.ok(attrStatMatch, "js/ui.js에서 ATTR_STAT을 못 찾았다");
var uiAttrStat = {};
attrStatMatch[1].split(",").forEach(function (pair) {
  var m = /"?(\w+)"?\s*:\s*"([^"]+)"/.exec(pair);
  if (m) uiAttrStat[m[1]] = m[2];
});
assert.deepStrictEqual(uiAttrStat, data.reaction.attrStat,
  "ui.js의 ATTR_STAT이 data/npcs.js의 reaction.attrStat과 다르다 — 배지 색이 어긋난다");

// 트윗 항목은 문자열이거나 { t: 본문, a: 속성 } 객체다
function tweetText(raw) { return typeof raw === "string" ? raw : raw.t; }

// ── 프로필 사진 ──
assert.ok(has("me"), "me.svg가 없다 — 내 아바타가 전부 깨진다");

var missing = npcs.filter(function (n) { return !has(n.handle.replace("@", "")); });
assert.strictEqual(missing.length, 0,
  "아바타 없는 계정: " + missing.map(function (n) { return n.handle; }).join(", ") +
  "\n  assets/avatars/README.md의 curl 한 줄로 받으면 된다");

// 광고 계정은 NPC 목록에 없지만 아바타는 쓴다 — 타임라인의 광고 카드에 뜬다.
// (data/ads.js를 따로 두는 이유는 CLAUDE.md "광고 상품" 참고)
var adHandle = data.ads && data.ads.handle && data.ads.handle.replace("@", "");
if (adHandle) {
  assert.ok(has(adHandle),
    "광고 계정 아바타가 없다: " + adHandle + ".svg — 광고 카드의 사진이 깨진다");
}

// 계정을 지웠을 때 쓰이지 않는 사진이 쌓이는 것도 잡아준다
var usedBases = npcs.map(function (n) { return n.handle.replace("@", ""); }).concat("me");
if (adHandle) usedBases.push(adHandle);
var used = usedBases.map(function (b) { return b + (extOf(b) || ".svg"); });
var orphans = fs.readdirSync(dir).filter(function (f) {
  return isAvatarFile(f) && used.indexOf(f) === -1;
});
assert.strictEqual(orphans.length, 0, "쓰이지 않는 아바타: " + orphans.join(", "));

// ── ui.js의 PHOTO_PFP가 실제 .jpg 파일과 일치하는가 ──
// pfpSrc()는 이 목록으로 확장자를 고른다. 목록에만 있고 파일이 없으면 그 계정 아바타가
// 깨지고, 파일만 있고 목록에 없으면 .svg를 찾다가 역시 깨진다. 둘 다 브라우저를 열기
// 전엔 모르는 종류의 사고라(`<img>`는 조용히 실패한다) 여기서 묶어둔다.
var photoListMatch = /PHOTO_PFP\s*=\s*\[([^\]]*)\]/.exec(uiSrc);
assert.ok(photoListMatch, "js/ui.js에서 PHOTO_PFP를 못 찾았다 — 이름이 바뀌었으면 이 테스트도 같이 고칠 것");
var photoList = (photoListMatch[1].match(/"([^"]+)"/g) || []).map(function (q) { return q.slice(1, -1); }).sort();
var jpgFiles = fs.readdirSync(dir).filter(function (f) { return f.endsWith(".jpg"); })
  .map(function (f) { return f.slice(0, -4); }).sort();
assert.deepStrictEqual(photoList, jpgFiles,
  "ui.js의 PHOTO_PFP와 실제 .jpg 파일이 다르다." +
  "\n  PHOTO_PFP: " + photoList.join(", ") +
  "\n  실제 파일: " + jpgFiles.join(", "));

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

// { t, a } 예외 표기의 a가 attrStat에 없는 값이면(오타·새 카테고리 누락) 그 트윗은
// toggleReaction에서 gain을 영영 못 만든다(Important 3과 결합해 조용히 트윗을 태운다).
var attrStatMap = data.reaction.attrStat;
var badAttr = [];
npcs.forEach(function (n) {
  n.tweets.forEach(function (raw) {
    if (typeof raw !== "string" && !attrStatMap[raw.a])
      badAttr.push(n.handle + ": 알 수 없는 a(" + raw.a + ") → " + raw.t);
  });
});
assert.strictEqual(badAttr.length, 0, "attrStat에 없는 속성 예외:\n  " + badAttr.join("\n  "));

var owner = {}, cross = [], lengths = [];
npcs.forEach(function (n) {
  var t = n.tweets.map(tweetText);

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
// 아바타는 실제 파일 수를 센다 — npcs.length + 1로 계산하면 광고 계정처럼
// NPC 목록 밖에서 쓰는 아바타를 놓친다(위에서 이미 누락·고아 검사는 끝났다)
var avatarCount = fs.readdirSync(dir).filter(isAvatarFile).length;
console.log("assets OK — 계정 " + npcs.length + "개, 아바타 " + avatarCount +
  "개, 트윗 " + total + "개 (계정당 " + Math.round(total / npcs.length) + "개)");
