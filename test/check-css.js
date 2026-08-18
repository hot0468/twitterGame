// 글씨 12px 하한이 뚫리지 않았는지 검사한다. 의존성 없음: node test/check-css.js
//
// 하한은 :root의 --fs-* 변수가 전부 max(--fs-min, …) 형태라는 데서 나온다.
// 규칙에 font-size를 px/rem으로 직접 쓰면 그 요소만 하한을 우회하므로, 그걸 잡는 게 이 검사의 목적.
var assert = require("assert");
var fs = require("fs");
var css = fs.readFileSync(__dirname + "/../css/style.css", "utf8");

// 1) 하한값이 12px인지
assert.ok(/--fs-min:\s*12px/.test(css), "--fs-min이 12px로 정의돼 있어야 함");

// 2) --fs-* 변수(--fs-min 제외)는 모두 max(var(--fs-min), …)로 감싸져 있어야 함
var defs = css.match(/--fs-(?!min)[\w-]+:[^;]+;/g) || [];
assert.ok(defs.length >= 5, "--fs-* 변수가 정의돼 있어야 함 (찾은 개수: " + defs.length + ")");
defs.forEach(function (d) {
  assert.ok(/max\(\s*var\(--fs-min\)/.test(d), "하한 누락: " + d.trim());
});

// 3) 실제 규칙의 font-size는 var(--fs-*)만 쓸 수 있다.
//    예외는 html의 스케일 노브(%)와 :root의 --fs-* 정의 자체.
var offenders = [];
css.split("\n").forEach(function (line, i) {
  var m = /(^|[;{\s])font-size:\s*([^;]+);/.exec(line);
  if (!m) return;
  var value = m[2].trim();
  if (/^var\(--fs-/.test(value)) return;      // 정상
  if (/^\d+(\.\d+)?%$/.test(value)) return;   // html 스케일 노브
  offenders.push((i + 1) + ": font-size: " + value);
});
assert.deepStrictEqual(offenders, [],
  "font-size는 var(--fs-*)로만 지정해야 함 (12px 하한 우회). 위반:\n  " + offenders.join("\n  "));

// 정의 안 된 var()는 그 선언을 통째로 무효로 만든다 — 테두리가 조용히 사라진다(실제로 겪음).
// 브라우저가 에러를 안 내므로 눈으로는 "왜 안 보이지"로만 보인다.
var defined = {};
(css.match(/^\s*--[\w-]+\s*:/gm) || []).forEach(function (m) {
  defined[m.trim().replace(/\s*:$/, "")] = true;
});
var undef = [];
(css.match(/var\((--[\w-]+)\)/g) || []).forEach(function (m) {
  var name = m.slice(4, -1);
  if (!defined[name] && undef.indexOf(name) === -1) undef.push(name);
});
assert.deepStrictEqual(undef, [],
  ":root에 없는 변수를 쓰면 그 선언이 통째로 무효가 된다. 없는 변수: " + undef.join(", "));

console.log("css OK — 글씨 하한 12px, font-size 직접 지정 " + offenders.length + "건, " +
  "정의 안 된 변수 0건");
