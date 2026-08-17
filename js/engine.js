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

  function initialState() {
    return {
      day: 1, followers: 10,
      stats: { 글빨: 5, 유머: 5, 감각: 5, 멘탈: 50, 논란성: 0 },
      feed: [], tweetLog: [], activeEvents: [], eventHistory: [], ending: null
    };
  }

  function create(data, saved, rng) {
    var rand = rng || Math.random;
    var state = saved || initialState();

    function getActions() {
      var list = [];
      state.activeEvents.forEach(function (ae) {
        var ev = data.events.filter(function (e) { return e.id === ae.eventId; })[0];
        ev.stages[ae.stage].choices.forEach(function (c, i) {
          if (!c.requires || checkCond(c.requires, state))
            list.push({ id: "event:" + ev.id + ":" + i, label: c.label, kind: "event" });
        });
      });
      data.actions.forEach(function (a) {
        if (!a.requires || checkCond(a.requires, state))
          list.push({ id: a.id, label: a.label, kind: "action", effects: a.effects });
      });
      return list;
    }

    // "이걸 트윗할까?"를 물어보기 전에 UI가 결과를 보여줄 수 있도록 수식을 미리 계산해준다.
    // 읽기 전용 — 상태를 바꾸지 않는다.
    function previewAction(actionId) {
      var action = data.actions.filter(function (a) { return a.id === actionId; })[0];
      if (!action) return null;

      function evaluated(effects, against) {
        var out = {};
        Object.keys(effects || {}).forEach(function (k) { out[k] = evalFormula(effects[k], against); });
        return out;
      }
      var effects = evaluated(action.effects, state);

      // 트윗 수식은 "행동 효과가 적용된 뒤"의 스탯으로 계산해야 실제 적용값과 일치한다.
      // (advanceTurn이 행동 효과 → 트윗 효과 순으로 적용하므로)
      var after = { followers: state.followers, stats: {} };
      Object.keys(state.stats).forEach(function (k) { after.stats[k] = state.stats[k]; });
      Object.keys(effects).forEach(function (k) {
        if (k === "팔로워") after.followers = Math.max(0, after.followers + effects[k]);
        else after.stats[k] = Math.max(0, (after.stats[k] || 0) + effects[k]);
      });

      return { id: action.id, label: action.label, effects: effects,
        tweetEffects: evaluated(action.tweet && action.tweet.effects, after) };
    }

    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    function fillTemplate(text) {
      return text.replace(/{([^}]+)}/g, function (_, key) {
        return data.fills && data.fills[key] ? pick(data.fills[key]) : key;
      });
    }

    function applyEffects(effects, statChanges) {
      for (var k in effects) {
        var delta = evalFormula(effects[k], state);
        if (k === "팔로워") state.followers = Math.max(0, state.followers + delta);
        else state.stats[k] = Math.max(0, (state.stats[k] || 0) + delta);
        statChanges[k] = (statChanges[k] || 0) + delta;
      }
    }

    function pushEventFeed(ev, stageIdx, feedItems) {
      ev.stages[stageIdx].feed.forEach(function (t) {
        feedItems.push({ author: "@world", name: "타임라인", text: t, day: state.day, kind: "event" });
      });
    }

    // doTweet: 행동을 트윗으로 올릴지. 행동 효과는 무조건, 트윗 효과는 doTweet일 때만 적용된다.
    // 이벤트 선택지("event:…")는 그 자체가 대응이라 doTweet를 보지 않는다.
    function advanceTurn(actionId, doTweet) {
      var feedItems = [], statChanges = {}, triggeredEvents = [];

      if (actionId.indexOf("event:") === 0) {
        var parts = actionId.split(":");
        var ev = data.events.filter(function (e) { return e.id === parts[1]; })[0];
        var ae = state.activeEvents.filter(function (a) { return a.eventId === parts[1]; })[0];
        var choice = ev.stages[ae.stage].choices[Number(parts[2])];
        applyEffects(choice.effects, statChanges);
        feedItems.push({ author: "me", text: choice.label + " — 을(를) 선택했다", day: state.day, likes: 0, rts: 0, kind: "me" });
        if (choice.next === "end") {
          state.activeEvents = state.activeEvents.filter(function (a) { return a.eventId !== ev.id; });
          state.eventHistory.push(ev.id);
        } else {
          ae.stage = choice.next;
          pushEventFeed(ev, ae.stage, feedItems);
        }
      } else {
        var action = data.actions.filter(function (a) { return a.id === actionId; })[0];
        if (action) {
          applyEffects(action.effects, statChanges);
          if (doTweet && action.tweet) {
            applyEffects(action.tweet.effects, statChanges);
            var gain = Math.max(0, statChanges["팔로워"] || 0);
            var tweet = {
              author: "me", text: fillTemplate(pick(action.tweet.templates)), day: state.day,
              likes: gain * 2 + Math.floor(rand() * 10), rts: Math.floor(gain / 2), kind: "me"
            };
            feedItems.push(tweet);
            state.tweetLog.push(tweet);
            data.npcs.forEach(function (npc) {
              if (npc.reactsTo.indexOf(action.tweet.category) !== -1 && rand() < 0.6)
                feedItems.push({ author: npc.handle, name: npc.name, text: pick(npc.replies), day: state.day, kind: "reply" });
            });
          }
        }
      }

      data.events.forEach(function (ev) {
        var done = state.eventHistory.indexOf(ev.id) !== -1;
        var active = state.activeEvents.some(function (a) { return a.eventId === ev.id; });
        if (done || active) return;
        if (checkCond(ev.trigger, state) && rand() < (ev.trigger.chance == null ? 1 : ev.trigger.chance)) {
          state.activeEvents.push({ eventId: ev.id, stage: 0 });
          pushEventFeed(ev, 0, feedItems);
          triggeredEvents.push(ev.id);
        }
      });

      if (state.stats.멘탈 === 0) {
        state.stats.멘탈 = 20;
        feedItems.push({ author: "@world", name: "시스템", text: "멘탈이 무너졌다… 하루를 통째로 쉬며 회복했다. (멘탈 20)", day: state.day, kind: "system" });
        state.day += 1;
      }

      var ending = null;
      if (!state.ending && state.followers >= data.endings.threshold) {
        var hit = data.endings.list.filter(function (e) { return !e.condition || checkCond(e.condition, state); })[0];
        state.ending = hit.id;
        ending = { id: hit.id, title: hit.title, text: hit.text };
      }

      state.feed = feedItems.concat(state.feed);
      state.day += 1;
      return { feedItems: feedItems, statChanges: statChanges, triggeredEvents: triggeredEvents, ending: ending };
    }
    return { getState: function () { return state; }, getActions: getActions,
      previewAction: previewAction, advanceTurn: advanceTurn };
  }

  return { _utils: { compare: compare, checkCond: checkCond, evalFormula: evalFormula }, create: create };
})();
if (typeof module !== "undefined") module.exports = Engine;

