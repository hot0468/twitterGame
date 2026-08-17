var Engine = (function () {
  var SKILL_STATS = ["글빨", "유머", "감각"];

  function compare(actual, expr) {
    if (typeof expr === "number") return actual >= expr;
    var m = /^(>=|<=|>|<|==)\s*(-?\d+)$/.exec(expr);
    if (!m) return false;
    var n = Number(m[2]);
    if (m[1] === ">=") return actual >= n;
    if (m[1] === "<=") return actual <= n;
    if (m[1] === ">") return actual > n;
    if (m[1] === "<") return actual < n;
    return actual === n;
  }

  function checkCond(cond, state) {
    for (var key in cond) {
      var v = cond[key];
      if (key === "chance") continue;
      if (key === "topStat") {
        var top = SKILL_STATS[0];
        SKILL_STATS.forEach(function (s) { if (state.stats[s] > state.stats[top]) top = s; });
        if (top !== v) return false;
      } else if (key === "eventDone") {
        if (state.eventHistory.indexOf(v) === -1) return false;
      } else {
        var actual = key === "팔로워" ? state.followers : state.stats[key];
        if (!compare(actual, v)) return false;
      }
    }
    return true;
  }

  function evalFormula(expr, state) {
    if (typeof expr === "number") return expr;
    var names = Object.keys(state.stats).concat(["팔로워"]);
    var vals = names.map(function (n) { return n === "팔로워" ? state.followers : state.stats[n]; });
    // ponytail: new Function 수식 평가 — 로컬 데이터 파일만 입력이므로 충분. 외부 입력 받게 되면 파서로 교체
    return Math.round(Function.apply(null, names.concat("return (" + expr + ")")).apply(null, vals));
  }

  return { _utils: { compare: compare, checkCond: checkCond, evalFormula: evalFormula } };
})();
if (typeof module !== "undefined") module.exports = Engine;
