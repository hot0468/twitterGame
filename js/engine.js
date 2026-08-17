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

  // 멘탈 = 컨디션 배수. 지쳐 있으면 같은 글을 써도 덜 먹힌다.
  // 50이 기준점(×1.0)이라 기존 밸런스는 그대로고, 관리하면 최대 ×1.2 / 방치하면 ×0.4까지 떨어진다.
  function morale(mental) {
    return Math.max(0.4, Math.min(1.2, (mental || 0) / 50));
  }

  // 팔로워 "증가"만 컨디션을 탄다(감소는 그대로 — 지쳤다고 덜 빠지진 않는다).
  // preview와 실제가 반드시 같은 함수를 거쳐야 팝업 숫자와 적용값이 어긋나지 않는다.
  function evalEffect(key, expr, against) {
    var v = evalFormula(expr, against);
    return key === "팔로워" && v > 0 ? Math.round(v * morale(against.stats.멘탈)) : v;
  }

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // 생성형 계정의 트윗 목표 길이. minLength~maxLength에 "고르게" 흩어져야 하는데,
  // 난수로 뽑으면 뭉친다(20개 뽑으면 짧은 것만 몰리는 일이 생긴다). 그래서 사다리를 놓고
  // rungs와 서로소인 보폭으로 칸을 밟는다 — 한 바퀴(rungs개) 동안 모든 칸을 정확히 한 번 지난다.
  function targetLength(seq, gen) {
    var rungs = Math.max(2, gen.max);
    var stride = 17;
    while (gcd(stride, rungs) !== 1) stride++; // max를 바꿔도 분포가 깨지지 않게
    var slot = ((seq % rungs) * stride) % rungs;
    return Math.round(gen.minLength + (gen.maxLength - gen.minLength) * slot / (rungs - 1));
  }

  // 조각을 목표 길이에 닿을 때까지 이어 붙인다. 한 트윗에 같은 조각을 두 번 쓰지 않는다.
  // 조각은 전부 그 자체로 완결된 문장이라 공백으로만 이으면 문장이 된다.
  function composeTweet(fragments, target, pickFn) {
    var rest = fragments.slice(), parts = [], len = 0;
    while (rest.length) {
      var gap = parts.length ? 1 : 0;             // 앞 문장과 띄울 한 칸
      var fits = rest.filter(function (f) { return f.length <= target - len - gap; });
      if (!fits.length) break;
      var piece = pickFn(fits);
      rest.splice(rest.indexOf(piece), 1);
      parts.push(piece);
      len += piece.length + gap;
    }
    // 목표가 제일 짧은 조각보다도 작을 때 — 빈 트윗을 내보내지 않는다.
    // 그래서 실제 최소 길이는 "가장 짧은 조각"이 정한다. 조각을 10자 이상으로 쓰는 이유다.
    if (!parts.length) {
      parts.push(fragments.reduce(function (a, b) { return b.length < a.length ? b : a; }));
    }
    return parts.join(" ");
  }

  // 돈만 마이너스를 허용한다 — 빚을 져도 능력으로 회생할 수 있어야 하고,
  // 그 마이너스가 대출·대부 이벤트를 부르는 트리거다. 나머지 스탯은 0이 바닥.
  function clampStat(key, v) { return key === "돈" ? v : Math.max(0, v); }

  function initialState() {
    return {
      day: 1, followers: 10,
      // 돈만 원 단위(정수 원). 표기는 ui.js가 천 단위 구분 + "원"을 붙인다.
      stats: { 글빨: 5, 유머: 5, 감각: 5, 멘탈: 50, 돈: 300000, 논란성: 0 },
      // tweetSeq: 트윗 id 발급용. 답글이 어느 트윗에 달렸는지(replyTo) 가리키는 근거.
      tweetSeq: 0,
      // lastSettleDay: 아직 정산하지 않은 주의 첫날. 날짜가 건너뛰어도 한 주를 빠뜨리지 않는 근거.
      lastSettleDay: 1,
      // notifSeen: 이미 확인한 알림 수. 안 읽은 개수를 세는 기준(어느 kind가 알림인지는 ui.js가 안다).
      notifSeen: 0,
      // npcTweets: 생성형 계정의 트윗 보관함 { "@handle": [트윗] }. 그 계정의 프로필이 이걸 그린다.
      // npcSeq: 계정별 누적 생성 수. 보관함이 상한에서 밀려도 목표 길이 사다리는 계속 진행해야 한다.
      // npcSeen: 그 계정을 처음 본 날 { "@handle": day }. 보관함이 이 날부터 자란다.
      npcTweets: {}, npcSeq: {}, npcSeen: {},
      feed: [], tweetLog: [], activeEvents: [], eventHistory: [], ending: null
    };
  }

  function create(data, saved, rng) {
    var rand = rng || Math.random;
    var state = saved || initialState();
    // 발견 기록은 실제 NPC 핸들만 남긴다 (@world 같은 시스템 작성자는 계정이 아니다)
    var npcHandles = {};
    data.npcs.forEach(function (n) { npcHandles[n.handle] = true; });

    // 구버전 세이브 호환: 나중에 추가된 스탯을 기본값으로 채운다.
    // 안 채우면 그 스탯을 쓰는 수식이 evalFormula에서 ReferenceError로 터진다.
    var blank = initialState();
    Object.keys(blank.stats).forEach(function (k) {
      if (typeof state.stats[k] !== "number") state.stats[k] = blank.stats[k];
    });
    // 나중에 추가된 최상위 필드(tweetSeq 등)도 같이 채운다.
    // 어느 필드가 없었는지는 채우기 전에 기록해둬야 한다 — saved와 state는 같은 객체라
    // 채운 뒤에 saved.x === undefined로 물으면 이미 값이 들어가 있어 영원히 거짓이다(실제로 겪음).
    var missing = {};
    Object.keys(blank).forEach(function (k) {
      if (state[k] === undefined) { missing[k] = true; state[k] = blank[k]; }
    });
    // id 없이 저장된 옛 트윗에 id를 붙여준다 — 없으면 상세 페이지를 열 수 없다
    state.tweetLog.concat(state.feed).forEach(function (t) {
      if (t.kind === "me" && !t.id) t.id = "tw" + ++state.tweetSeq;
    });
    // 정산 기준일이 없던 세이브는 "지금부터" 한 주를 센다.
    // 기본값 1을 그대로 쓰면 옛 트윗 수십 일 치를 한 번에 정산해버린다.
    if (missing.lastSettleDay) state.lastSettleDay = state.day;
    // 알림 읽음 기준이 없던 세이브는 지금까지를 다 읽은 것으로 본다 — 켜자마자 수십 개가 안 읽음으로
    // 뜨면 안 된다. feed.length는 알림 종류만 센 게 아니라 넉넉하지만 안 읽은 수는 0으로 잘려 안전하다.
    if (missing.notifSeen) state.notifSeen = state.feed.length;

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
        Object.keys(effects || {}).forEach(function (k) { out[k] = evalEffect(k, effects[k], against); });
        return out;
      }
      var effects = evaluated(action.effects, state);

      // 트윗 수식은 "행동 효과가 적용된 뒤"의 스탯으로 계산해야 실제 적용값과 일치한다.
      // (advanceTurn이 행동 효과 → 트윗 효과 순으로 적용하므로)
      var after = { followers: state.followers, stats: {} };
      Object.keys(state.stats).forEach(function (k) { after.stats[k] = state.stats[k]; });
      Object.keys(effects).forEach(function (k) {
        if (k === "팔로워") after.followers = Math.max(0, after.followers + effects[k]);
        else after.stats[k] = clampStat(k, (after.stats[k] || 0) + effects[k]);
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
        var delta = evalEffect(k, effects[k], state);
        if (k === "팔로워") state.followers = Math.max(0, state.followers + delta);
        else state.stats[k] = clampStat(k, (state.stats[k] || 0) + delta);
        statChanges[k] = (statChanges[k] || 0) + delta;
      }
    }

    // 트윗 반응 = 노출 → 좋아요 → 리트윗. 전부 스탯·팔로워에서 계산되고 난수는 쓰지 않는다.
    // 실제 트위터처럼 계정이 커지면 반응률(좋아요/노출)이 아니라 절대 수치가 자란다.
    function engagement() {
      var s = state.stats;
      // 노출: 팔로워가 기본, 감각이 타이밍을 잡아 알고리즘 확산을 늘린다
      var views = Math.round(state.followers * (1 + Math.min(s.감각, 40) * 0.06));
      // 반응률: 글빨이 올리지만 체감 감소 (0.012 → 최대 약 0.037). 컨디션이 나쁘면 그만큼 덜 먹힌다
      var likes = Math.round(views * (0.012 + 0.03 * s.글빨 / (s.글빨 + 20)) * morale(s.멘탈));
      // 리트윗은 좋아요의 일부. 확산성은 유머가 끌어올린다
      var rts = Math.round(likes * (0.08 + Math.min(s.유머, 40) * 0.004));
      return { views: views, likes: likes, rts: rts };
    }

    function drawFrom(pool, count) {
      var out = [], rest = pool.slice();
      while (out.length < count && rest.length) {
        out.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
      }
      return out;
    }

    // 반응할 계정을 중복 없이 고른다. 카테고리가 맞는 계정을 먼저 쓰고, 부족하면 나머지에서 채운다.
    function pickActors(category, count) {
      var matching = [], others = [];
      data.npcs.forEach(function (n) {
        (n.reactsTo.indexOf(category) !== -1 ? matching : others).push(n);
      });
      var picked = drawFrom(matching, count);
      return picked.length < count
        ? picked.concat(drawFrom(others, count - picked.length))
        : picked;
    }

    // 실제 트위터 알림 형태: 이름 1~2개 + "외 N명". total은 전체 좋아요/리트윗 수.
    function reactionNotif(kind, category, namedCount, total, text) {
      var actors = pickActors(category, namedCount).map(function (n) {
        return { handle: n.handle, name: n.name };
      });
      return { kind: kind, actors: actors, others: total - actors.length,
        text: text, day: state.day };
    }

    // 주간 정산: 지난 한 주에 올린 트윗의 조회수를 합쳐 정산금을 받고 프리미엄 요금을 낸다.
    // 트윗을 안 올린 주는 조회수 0 → 정산금 0이고 요금만 나간다. 그게 프리미엄 구독의 대가다.
    // 날짜 대신 일차로만 기록한다 — "3월 2일" 표기는 ui.js 몫이다.
    function settle(feedItems) {
      var eco = data.economy, from = state.lastSettleDay, to = state.day - 1;
      var views = state.tweetLog.reduce(function (sum, t) {
        return t.day >= from && t.day <= to ? sum + (t.views || 0) : sum;
      }, 0);
      var payout = Math.round(views * eco.payoutPer1000Views / 1000);
      var net = payout - eco.premiumFee;
      state.stats.돈 += net;
      state.lastSettleDay = state.day;
      var item = { kind: "settlement", author: "@XPayouts", name: "크리에이터 정산",
        from: from, to: to, views: views, payout: payout, fee: eco.premiumFee, net: net,
        day: to, text: "" };
      feedItems.push(item);
      return item;
    }

    // ── 생성형 계정의 트윗 보관함 ────────────────────────────────
    function genRules() { return (data.timeline && data.timeline.gen) || null; }

    function genAccounts() {
      return data.npcs.filter(function (n) { return n.tweetGen && n.tweetGen.fragments; });
    }

    // count개를 만들어 보관함에 넣고 방금 넣은 것만 돌려준다.
    // dayOf(i)로 날짜를 받는 이유: 과거 20개는 날짜가 하루씩 다르고, 오늘 몫은 전부 오늘이다.
    function addTweets(npc, count, dayOf) {
      var gen = genRules();
      var box = state.npcTweets[npc.handle] || (state.npcTweets[npc.handle] = []);
      var made = [];
      for (var i = 0; i < count; i++) {
        var seq = state.npcSeq[npc.handle] || 0;
        state.npcSeq[npc.handle] = seq + 1;
        // 치환은 조합 "전"에 해야 한다 — {떡밥}(4자)이 "번역기 오역 사건"(9자)으로 늘어나므로
        // 조합 후에 치환하면 목표 길이를 넘어 140자를 뚫는다(실제로 145자가 나왔다).
        var filled = npc.tweetGen.fragments.map(fillTemplate);
        // id는 내 트윗과 같은 seq를 쓴다 — 겹치지 않아야 상세 페이지가 엉키지 않는다.
        // 보관함에만 있는 트윗도 상세로 열 수 있어야 하므로 전부 id를 받는다.
        made.push({ id: "tw" + ++state.tweetSeq,
          author: npc.handle, name: npc.name, kind: "npc",
          text: composeTweet(filled, targetLength(seq, gen), pick),
          day: dayOf(i) });
      }
      box.push.apply(box, made);
      if (box.length > gen.max) box.splice(0, box.length - gen.max); // 오래된 것부터 밀려난다
      return made;
    }

    function pushEventFeed(ev, stageIdx, feedItems) {
      ev.stages[stageIdx].feed.forEach(function (t) {
        feedItems.push({ author: "@world", name: "타임라인", text: t, day: state.day, kind: "event" });
      });
    }

    // doTweet: 행동을 트윗으로 올릴지. 행동 효과는 무조건, 트윗 효과는 doTweet일 때만 적용된다.
    // 이벤트 선택지("event:…")는 그 자체가 대응이라 doTweet를 보지 않는다.
    function advanceTurn(actionId, doTweet) {
      var feedItems = [], statChanges = {}, triggeredEvents = [], tweetCategory = null;

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
            tweetCategory = action.tweet.category;
            applyEffects(action.tweet.effects, statChanges);
            // 팔로워 변동이 이미 적용된 뒤에 반응을 잰다 — 새로 들어온 사람도 이 트윗을 본다
            var eng = engagement();
            var tweet = {
              id: "tw" + ++state.tweetSeq,
              author: "me", text: fillTemplate(pick(action.tweet.templates)), day: state.day,
              likes: eng.likes, rts: eng.rts, views: eng.views, kind: "me"
            };
            feedItems.push(tweet);
            state.tweetLog.push(tweet);

            // 좋아요·리트윗은 타임라인이 아니라 알림에만 뜬다 (실제 트위터와 동일)
            if (eng.likes > 0) {
              feedItems.push(reactionNotif("like", action.tweet.category,
                eng.likes <= 2 ? eng.likes : 1, eng.likes, tweet.text));
            }
            if (eng.rts > 0) {
              feedItems.push(reactionNotif("retweet", action.tweet.category, 1, eng.rts, tweet.text));
            }

            // 답글은 좋아요의 일부(실제 트위터도 답글이 훨씬 적다). NPC 수가 스레드 길이의 상한.
            // replyTo로 원본 트윗을 가리켜야 상세 페이지에서 줄줄이 볼 수 있다.
            var replyCount = Math.min(Math.round(eng.likes * 0.12), data.npcs.length);
            pickActors(action.tweet.category, replyCount).forEach(function (npc) {
              feedItems.push({ author: npc.handle, name: npc.name, text: pick(npc.replies),
                day: state.day, kind: "reply", replyTo: tweet.id });
            });
          }
        }
      }

      // 팔로잉 타임라인. 두 단계로 갈린다:
      //   1) 발견한 계정은 전부 매일 보관함을 채운다 → 그 계정 프로필에 쌓인다.
      //   2) 그중 몇 계정의 오늘 트윗만 내 홈 타임라인에 흐른다.
      // 전원을 타임라인에 띄우면 하루에 30개가 쏟아진다. 못 본 트윗은 프로필에서 본다 —
      // 실제 트위터에서도 팔로잉 전원의 트윗을 다 보지는 않는다.
      var gen = genRules();
      if (gen) {
        var perDay = (data.timeline && data.timeline.npcTweetsPerDay) || 0;
        var today = {};
        var live = genAccounts().filter(function (n) { return state.npcSeen[n.handle] != null; });
        live.forEach(function (npc) {
          if (!state.npcTweets[npc.handle]) {
            // 발견 전의 과거 트윗. 보관함에만 넣는다 — 홈 타임라인이 한 번에 20개로 도배되면 안 된다.
            var seenDay = state.npcSeen[npc.handle];
            addTweets(npc, gen.seed, function (i) { return seenDay - gen.seed + i; });
          }
          today[npc.handle] = addTweets(npc, gen.perDay, function () { return state.day; });
        });
        // drawFrom으로 뽑으므로 같은 계정이 하루에 두 번 타임라인에 뜨지 않는다
        drawFrom(live, perDay).forEach(function (npc) {
          feedItems.push(pick(today[npc.handle]));
        });
      }

      // 팔로워가 늘면 알림에도 뜬다. 트윗·홍보·이벤트 어디서 늘어도 여기 한 곳을 지난다.
      // (tweetCategory가 null이면 pickActors가 아무 NPC나 뽑는다 — 홍보·이벤트 유입)
      var gained = statChanges["팔로워"] || 0;
      if (gained > 0) {
        feedItems.push(reactionNotif("follow", tweetCategory, gained <= 2 ? gained : 1, gained, ""));
      }

      // 계정을 처음 본 날을 기록한다 — 생성형 계정의 보관함이 이 날부터 자란다.
      // 트윗·답글·좋아요·팔로우 어느 경로로 등장했든 여기 한 곳을 지난다.
      feedItems.forEach(function (f) {
        (f.actors ? f.actors.map(function (a) { return a.handle; }) : [f.author])
          .forEach(function (h) {
            if (npcHandles[h] && state.npcSeen[h] == null) state.npcSeen[h] = state.day;
          });
      });

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

      // ── 하루 마감 ─────────────────────────────────────────────
      // 멘탈이 바닥나면 하루를 더 태운다. 그래도 생활비는 이틀 치가 나간다.
      var lived = 1;
      if (state.stats.멘탈 === 0) {
        state.stats.멘탈 = 20;
        feedItems.push({ author: "@world", name: "시스템", text: "멘탈이 무너졌다… 하루를 통째로 쉬며 회복했다. (멘탈 20)", day: state.day, kind: "system" });
        lived = 2;
      }
      state.day += lived;

      // 생활비는 행동과 무관한 고정 지출이라 statChanges에 넣지 않는다.
      // (statChanges는 "이 행동이 바꾼 것"이고 미리보기와 1:1로 맞아야 한다)
      state.stats.돈 -= data.economy.livingCost * lived;

      // 정산 주기가 지났으면 정산한다. 기준일과의 차이로 재므로 날짜가 건너뛰어도 안 빠뜨린다.
      var settlement = null;
      if (state.day - state.lastSettleDay >= data.economy.settleEvery) settlement = settle(feedItems);

      var ending = null;
      if (!state.ending && state.followers >= data.endings.threshold) {
        var hit = data.endings.list.filter(function (e) { return !e.condition || checkCond(e.condition, state); })[0];
        state.ending = hit.id;
        ending = { id: hit.id, title: hit.title, text: hit.text };
      }

      state.feed = feedItems.concat(state.feed);
      return { feedItems: feedItems, statChanges: statChanges, triggeredEvents: triggeredEvents,
        ending: ending, settlement: settlement };
    }
    return { getState: function () { return state; }, getActions: getActions,
      previewAction: previewAction, advanceTurn: advanceTurn };
  }

  return { _utils: { compare: compare, checkCond: checkCond, evalFormula: evalFormula,
    evalEffect: evalEffect, targetLength: targetLength, composeTweet: composeTweet },
    create: create };
})();
if (typeof module !== "undefined") module.exports = Engine;

