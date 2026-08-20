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
      // chance는 확률, action·dmStory는 스토리 이벤트 전용 조건이라 스탯 비교가 아니다
      if (key === "chance" || key === "action" || key === "dmStory") continue;
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
      // npcTweets: 계정별 트윗 보관함 { "@handle": [트윗] }. 그 계정의 프로필이 이걸 그린다.
      // npcSeen: 그 계정을 처음 본 날 { "@handle": day }. 보관함이 이 날부터 자란다.
      // reacted: 내가 좋아요·리트윗한 남의 트윗 { "tw12": { like: true, rt: true, gained: true, rtDay: n } }.
      // gained: 이 트윗이 이미 반응 스탯을 줬는지. 취소·재반응으로 무한히 스탯을 뽑는 걸 막는다.
      // 보관함은 max로 오래된 트윗을 밀어내지만 밀려난 트윗의 reacted 항목은 지우지 않는다 —
      // 의도된 것이다. gained를 유지해야 하므로 지우면 그 트윗이 보관함에 다시 들어왔을 때
      // (같은 id로는 안 돌아오지만) 재획득 경로가 열릴 위험이 있다. 장기 플레이에서도
      // 수천 개 수준이라 실제 메모리 문제는 아니다.
      // following: 내가 팔로우한 계정 { "@handle": true }. 발견(npcSeen)과 별개다 —
      // 만난 계정이라도 팔로우해야 그 트윗이 홈 타임라인에 흐른다.
      // dms: 계정별 대화방 { "@h": { msgs: [{me,text,day}], used: [주제idx], opened: [인사idx], seen: n } }.
      // feed와 별개다 — 실제 X도 DM은 알림이 아니라 자기 뱃지를 쓴다.
      npcTweets: {}, npcSeen: {}, reacted: {}, following: {}, dms: {},
      // 산 광고 상품 { "keyboard": true }. 상품마다 한 번만 살 수 있고,
      // 산 것은 광고 후보에서 빠진다 — 반복 구매를 허용하면 "알바 → 구매" 루프가 생긴다.
      bought: {},
      // 스토리 DM 진행 상태. { "@h": { node, pending: {to, day}|null, done } }
      // 기존 dms(대화 내용)와 별개다 — 저쪽은 말풍선, 이쪽은 어디까지 왔는가다.
      dmStory: {},
      // 속성별 반응 카운터. perPoint(5)가 차면 그 스탯 +1하고 0으로 돌아간다.
      // 스탯을 정수로 유지하려고 소수 대신 카운터를 쓴다.
      reactCount: { 글빨: 0, 유머: 0, 감각: 0, 논란성: 0 },
      // 오늘 카운터가 오른 반응 수 { day, used }. dailyCap을 넘으면 반응은 여전히 되지만
      // 카운터는 안 오른다(gained도 안 찍는다) — 검색 화면이 보관함 전체를 모아주므로
      // 하루 상한이 없으면 무제한 그라인딩으로 밸런스가 무너진다.
      reactDay: { day: 1, used: 0 },
      feed: [], tweetLog: [], activeEvents: [], eventHistory: [], ending: null,
      // 이벤트 선택지가 남기는 표식. 스토리 시작 조건(requires.flags)이 읽는다.
      // "겪었나"(eventHistory)가 아니라 "무엇을 골랐나"를 기억해야 할 때 쓴다 —
      // 길고양이를 만나고 그냥 지나친 것과 트윗한 것은 다르다.
      flags: {}
    };
  }

  function create(data, saved, rng) {
    var rand = rng || Math.random;
    var state = saved || initialState();
    // 핸들 → 계정. 발견 기록은 실제 NPC만 남긴다(@world 같은 시스템 작성자는 계정이 아니다).
    var npcHandles = {};
    data.npcs.forEach(function (n) { npcHandles[n.handle] = n; });

    // 남의 트윗 반응 수. 그 계정의 팔로워 규모에 비례하게 만들 때 한 번만 뽑아 저장한다 —
    // 렌더할 때마다 뽑으면 숫자가 매번 바뀐다.
    function setCounts(t, npc) {
      var f = (npc && npc.followers) || 1000;
      t.likes = Math.round(f * (0.003 + rand() * 0.009));
      t.rts = Math.round(t.likes * (0.06 + rand() * 0.18));
    }

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
    // 팔로우가 없던 세이브는 이미 발견한 계정을 전부 팔로우 중으로 본다 —
    // 그전엔 발견이 곧 팔로우였으므로, 안 채우면 켜자마자 타임라인이 텅 빈다.
    if (missing.following)
      Object.keys(state.npcSeen).forEach(function (h) { state.following[h] = true; });

    // 남의 트윗에 반응 버튼이 생기면서 좋아요·리트윗 수가 필요해졌다.
    // 옛 세이브의 트윗에는 없으므로 여기서 채운다 — 안 채우면 전부 0으로 보인다.
    // 보관함과 피드는 저장/복원 뒤 서로 다른 객체라 양쪽 다 훑어야 한다.
    Object.keys(state.npcTweets).forEach(function (h) {
      state.npcTweets[h].forEach(function (t) {
        if (typeof t.likes !== "number") setCounts(t, npcHandles[h]);
      });
    });
    state.feed.forEach(function (f) {
      if (f.kind === "npc" && typeof f.likes !== "number") setCounts(f, npcHandles[f.author]);
    });

    // 옛 세이브의 트윗에는 attr이 없다 — 없으면 그 트윗은 영영 스탯을 안 준다.
    // 계정 기본 속성(첫 카테고리)으로 채운다. 보관함과 피드 양쪽 다 훑어야 한다.
    Object.keys(state.npcTweets).forEach(function (h) {
      var npcA = npcHandles[h];
      state.npcTweets[h].forEach(function (t) {
        if (!t.attr && npcA) t.attr = npcA.reactsTo[0];
      });
    });
    state.feed.forEach(function (f) {
      var npcF = npcHandles[f.author];
      if (f.kind === "npc" && !f.attr && npcF) f.attr = npcF.reactsTo[0];
    });

    // 옛 세이브의 반응 기록에는 author가 없다 — reactionsOn()이 그걸로 계정을 가린다.
    // 아직 남아 있는 트윗에서 채운다. 이미 보관함에서 밀려난 것은 되살릴 수 없지만
    // 그건 이 보정이 없을 때와 같은 수준이라 더 나빠지지 않는다.
    Object.keys(state.npcTweets).forEach(function (h) {
      state.npcTweets[h].forEach(function (t) {
        var r = state.reacted[t.id];
        if (r && r.gained && !r.author) r.author = h;
      });
    });
    state.feed.forEach(function (f) {
      var rf = f.id && state.reacted[f.id];
      if (f.kind === "npc" && rf && rf.gained && !rf.author) rf.author = f.author;
    });

    // 새 계정이어도 첫 화면이 빈 타임라인이면 안 된다. 가입할 때 몇 계정을 팔로우한 셈으로
    // 시작하고(발견일 = 1일차), 그들의 최근 트윗을 첫 타임라인에 깔아준다.
    // 새 게임에서만 — 세이브를 이어받을 때 하면 옛 타임라인 위에 덧칠하게 된다.
    if (!saved && genRules()) {
      var tl = data.timeline;
      var opening = [];
      drawFrom(genAccounts(), tl.startFollowing || 0).forEach(function (npc) {
        state.npcSeen[npc.handle] = state.day;
        state.following[npc.handle] = true;
        ensureBox(npc);
        // 보관함은 과거→최신 순이라 뒤에서 잘라야 "최근" 트윗이 나온다
        opening = opening.concat(state.npcTweets[npc.handle].slice(-(tl.openingTweets || 0)));
      });
      opening.sort(function (a, b) { return b.day - a.day; }); // feed는 최신순
      state.feed = opening;
    }

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
      return data.npcs.filter(function (n) { return n.tweets && n.tweets.length; });
    }

    // 보관함이 없으면 "발견 전 과거 트윗"으로 채운다. 발견한 날 직전 seed일치가 깔린다.
    // 이 트윗들은 feed에 넣지 않는다 — 홈 타임라인이 한 번에 20개로 도배되면 안 된다.
    function ensureBox(npc) {
      if (state.npcTweets[npc.handle]) return;
      var gen = genRules(), seenDay = state.npcSeen[npc.handle];
      addTweets(npc, gen.seed, function (i) { return seenDay - gen.seed + i; });
    }

    // count개를 골라 보관함에 넣고 방금 넣은 것만 돌려준다.
    // dayOf(i)로 날짜를 받는 이유: 과거 트윗은 날짜가 하루씩 다르고, 오늘 몫은 전부 오늘이다.
    //
    // 트윗은 통째로 하나를 고른다 — 문장을 조합하지 않는다. 조합하면 같은 문장이
    // 길이만 다른 트윗으로 계속 재등장해서 타임라인이 지루해진다(실제로 그랬다).
    // 보관함에 이미 있는 트윗은 후보에서 뺀다 → 한 프로필에 같은 트윗이 두 번 안 뜬다.
    // 그래서 계정의 트윗 수가 max보다 많아야 매일 새 트윗이 나온다(check-assets.js가 검사).
    // 트윗 데이터는 문자열이거나 { t: 본문, a: 속성 } 객체다.
    // 객체는 계정 기본 속성과 다르게 잡은 예외를 위한 것이고, 거의 쓰지 않는다.
    function tweetText(raw) { return typeof raw === "string" ? raw : raw.t; }

    // 속성 결정: 트윗에 지정돼 있으면 그것, 없으면 그 계정의 첫 카테고리.
    // "계정 하나 = 컨셉 하나"라 계정 카테고리가 기본값인 게 자연스럽다.
    function tweetAttr(raw, npc) {
      if (typeof raw !== "string" && raw.a) return raw.a;
      return npc.reactsTo[0];
    }

    function addTweets(npc, count, dayOf) {
      var gen = genRules();
      var box = state.npcTweets[npc.handle] || (state.npcTweets[npc.handle] = []);
      var made = [];
      for (var i = 0; i < count; i++) {
        // src(치환 전 원문)로 중복을 본다 — text는 {떡밥}이 치환돼 원문과 다르다.
        var used = {};
        box.concat(made).forEach(function (t) { used[t.src || t.text] = true; });
        // 트윗은 문자열이거나 { t, a } 객체다 — 객체는 속성을 계정 기본값과 다르게 잡은 예외다.
        // 중복 판정은 본문 문자열로 하므로 표기와 무관하게 같은 트윗은 한 번만 나온다.
        var free = npc.tweets.filter(function (t) { return !used[tweetText(t)]; });
        if (!free.length) break; // 낼 새 트윗이 없으면 그 날은 안 올린다
        var raw = pick(free);
        var src = tweetText(raw);
        // id는 내 트윗과 같은 seq를 쓴다 — 겹치지 않아야 상세 페이지가 엉키지 않는다.
        // 보관함에만 있는 트윗도 상세로 열 수 있어야 하므로 전부 id를 받는다.
        var t = { id: "tw" + ++state.tweetSeq, src: src,
          author: npc.handle, name: npc.name, kind: "npc",
          text: fillTemplate(src), day: dayOf(i), attr: tweetAttr(raw, npc) };
        setCounts(t, npc);
        made.push(t);
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
        // 선택지가 표식을 남긴다. 스토리 시작 조건이 이걸 본다.
        if (choice.flag) state.flags[choice.flag] = state.day;
        // 스토리 이벤트: 고른 것이 DM 스토리를 진행시킨다.
        // 다음 노드에 delay가 있으면 예약만 하고 답장은 나중에 온다.
        //
        // 예약일에 +1을 더하는 이유: 여기는 advanceTurn 맨 앞이라 state.day가 아직
        // "오늘"인데, 이 턴이 끝나면서 날짜가 넘어가고 곧바로 tickStories()가 돈다.
        // 그냥 day+delay로 잡으면 그 한 턴이 이미 지나간 것으로 세어져 delay 2가 1일로
        // 작동한다(실측). sendStory는 하루를 안 쓰는 경로라 이 보정이 필요 없다 —
        // 이벤트 선택만 하루를 소모하기 때문에 생기는 차이다.
        if (choice.story) {
          var sp = String(choice.story).split(":");
          var sdef = storyDef(sp[0]), sst = state.dmStory[sp[0]];
          var snode = sdef && sdef.nodes[sp[1]];
          if (sst && snode) {
            if (snode.delay > 0) sst.pending = { to: sp[1], day: state.day + snode.delay + 1 };
            else goStory(sp[0], sp[1]);
          }
        }
        feedItems.push({ author: "me", text: choice.label + " — 을(를) 선택했다", day: state.day, likes: 0, rts: 0, kind: "me" });
        if (choice.next === "end") {
          state.activeEvents = state.activeEvents.filter(function (a) { return a.eventId !== ev.id; });
          state.eventHistory.push(ev.id);
        } else {
          ae.stage = choice.next;
          pushEventFeed(ev, ae.stage, feedItems);
        }
      } else if (actionId.indexOf("quote:") === 0) {
        // 인용. 좋아요·리트윗과 달리 하루를 쓴다 — 내 트윗을 새로 쓰는 일이기 때문이다.
        // 그래서 별도 경로가 아니라 advanceTurn 안의 분기다. 이 아래 정산·이벤트·엔딩
        // 판정을 그대로 지나가야 한다(따로 만들면 그 전부를 복제하게 된다).
        var qt = findNpcTweet(actionId.slice(6));
        if (qt) {
          var qrules = data.quote || {};
          var qeff = (qrules.byAttr && qrules.byAttr[qt.attr]) || qrules.fallback;
          applyEffects(qeff, statChanges);
          tweetCategory = qt.attr;
          // 팔로워 변동이 적용된 뒤에 반응을 잰다(일반 트윗과 같은 순서)
          var qeng = engagement();
          var qtweet = {
            id: "tw" + ++state.tweetSeq,
            author: "me", text: "", day: state.day,
            likes: qeng.likes, rts: qeng.rts, views: qeng.views, kind: "me",
            // 인용한 원본. 렌더는 이 사본을 그린다 — 원본이 보관함에서 밀려나도
            // 내 인용 카드는 남아야 하기 때문이다(id만 들고 있으면 빈 카드가 된다).
            quoted: { id: qt.id, author: qt.author, text: qt.text, day: qt.day }
          };
          feedItems.push(qtweet);
          state.tweetLog.push(qtweet);
          if (qeng.likes > 0) {
            feedItems.push(reactionNotif("like", qt.attr,
              qeng.likes <= 2 ? qeng.likes : 1, qeng.likes, qt.text));
          }
          if (qeng.rts > 0) {
            feedItems.push(reactionNotif("retweet", qt.attr, 1, qeng.rts, qt.text));
          }
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
      //   2) 그중 "팔로우한" 계정 몇 곳의 오늘 트윗만 내 홈 타임라인에 흐른다.
      // 보관함은 팔로우와 무관하게 자란다 — 실제 트위터도 내가 안 팔로우해도 그 계정은 계속 쓴다.
      // 전원을 타임라인에 띄우면 하루에 30개가 쏟아진다. 못 본 트윗은 프로필에서 본다 —
      // 실제 트위터에서도 팔로잉 전원의 트윗을 다 보지는 않는다.
      var gen = genRules();
      if (gen) {
        var perDay = (data.timeline && data.timeline.npcTweetsPerDay) || 0;
        var today = {};
        var live = genAccounts().filter(function (n) { return state.npcSeen[n.handle] != null; });
        live.forEach(function (npc) {
          ensureBox(npc);
          today[npc.handle] = addTweets(npc, gen.perDay, function () { return state.day; });
        });
        // drawFrom으로 뽑으므로 같은 계정이 하루에 두 번 타임라인에 뜨지 않는다
        var followed = live.filter(function (n) { return state.following[n.handle]; });
        drawFrom(followed, perDay).forEach(function (npc) {
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

      // 광고. 아직 안 산 상품 중 하나가 타임라인에 흐른다.
      // 돈이 모자라도 뜬다 — 살 수 있는 것만 보여주면 "나중에 사야지"가 안 되고,
      // 버튼이 비활성으로 보이는 게 목표가 된다(UI가 그 상태를 그린다).
      if (data.ads && rand() < (data.ads.chance || 0)) {
        var canShow = data.ads.items.filter(function (it) { return !state.bought[it.id]; });
        if (canShow.length) {
          var ad = pick(canShow);
          feedItems.push({ author: data.ads.handle, name: data.ads.name,
            text: ad.text, day: state.day, kind: "ad",
            adId: ad.id, label: ad.label, price: ad.price, effects: ad.effects });
        }
      }

      // 디엠 도착. 이미 만난 DM 계정 중 인사말이 남은 곳에서 하루 한 통까지.
      // 팔로우와 무관하다 — 안 팔로우해도 DM은 온다(실제 X와 동일).
      if (data.dm && rand() < (data.dm.chance || 0)) {
        // 스토리가 도는 계정은 뺀다 — 이야기 중간에 잡담이 끼면 안 된다
        var callers = dmAccounts().filter(function (h) {
          return unusedOpens(h).length && !inStory(h);
        });
        if (callers.length) {
          var who = pick(callers), oi = pick(unusedOpens(who));
          state.dms[who].opened.push(oi);
          pushDm(who, false, data.dm.accounts[who].opens[oi]);
        }
      }

      data.events.forEach(function (ev) {
        var done = state.eventHistory.indexOf(ev.id) !== -1;
        var active = state.activeEvents.some(function (a) { return a.eventId === ev.id; });
        if (done || active) return;
        // action: 그 행동을 한 턴에만. dmStory: "핸들:노드"가 지금 그 노드일 때만.
        // 스토리 이벤트는 chance가 없어서 조건만 맞으면 확정으로 뜬다.
        if (ev.trigger.action && ev.trigger.action !== actionId) return;
        if (ev.trigger.dmStory && !atStoryNode(ev.trigger.dmStory)) return;
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

      // 스토리 DM: 조건이 맞으면 시작하고, 예약된 지연 답장이 오늘이면 도착한다.
      // npcSeen 기록 뒤(위)이자 날짜가 넘어간 뒤에 와야 한다 — pending.day는 "그날이 되면"
      // 도착하는 예약이라, 날짜 증가 전에 검사하면 하루 늦게 도착한다.
      tickStories();

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
    // 남의 트윗에 좋아요·리트윗. **하루를 소모하지 않는다** — 날짜를 넘기는 건 advanceTurn뿐이다.
    // 좋아요 한 번에 하루가 가면 못 쓸 기능이 된다. 스탯에도 영향을 주지 않는다(반응은 448개
    // 트윗에 다 누를 수 있어서, 팔로워를 주면 공짜 성장 경로가 된다).
    // ── 디엠 ────────────────────────────────────────────
    // 방은 처음 쓸 때 만든다. data.dm에 없는 계정은 DM 자체가 없다.
    // accounts(선택지 풀) 계정과 stories(스토리) 계정 둘 다 방을 갖는다.
    function dmRoom(handle) {
      if (!data.dm) return null;
      var known = data.dm.accounts[handle] ||
        (data.dm.stories && data.dm.stories[handle]);
      if (!known) return null;
      return state.dms[handle] ||
        (state.dms[handle] = { msgs: [], used: [], opened: [], seen: 0 });
    }
    function pushDm(handle, me, text) {
      state.dms[handle].msgs.push({ me: me, text: text, day: state.day });
    }
    // 아직 안 쓴 인사말의 인덱스. 다 쓴 계정은 더 이상 먼저 말을 걸지 않는다.
    function unusedOpens(handle) {
      var room = dmRoom(handle), out = [];
      data.dm.accounts[handle].opens.forEach(function (_, i) {
        if (room.opened.indexOf(i) === -1) out.push(i);
      });
      return out;
    }

    // DM이 열린 계정 = 이미 만난 DM 계정. 만나기 전엔 대화방이 아예 없다.
    function dmAccounts() {
      if (!data.dm) return [];
      return Object.keys(data.dm.accounts).filter(function (h) {
        return state.npcSeen[h] != null;
      });
    }
    // 내가 고를 수 있는 말. 이미 쓴 건 안 나오고, 다 떨어지면 빈 배열이다.
    function getDmChoices(handle) {
      var room = dmRoom(handle);
      if (!room) return [];
      var out = [];
      // 잡담 데이터가 없는 계정(스토리 전용)은 빈 배열이다 — 예전엔 여기서 터졌다.
      var acc = data.dm.accounts && data.dm.accounts[handle];
      if (!acc || !acc.topics) return out;
      acc.topics.forEach(function (t, i) {
        if (room.used.indexOf(i) === -1) out.push({ idx: i, label: t.say });
      });
      return out.slice(0, data.dm.choices || 3);
    }
    // 말을 건다. 하루를 안 쓰고 스탯도 안 건드린다 — 팔로우·반응과 같은 부류다.
    function sendDm(handle, idx) {
      var room = dmRoom(handle);
      if (!room) return null;
      var topics = data.dm.accounts[handle].topics, topic = topics[idx];
      if (!topic || room.used.indexOf(idx) !== -1) return null;
      room.used.push(idx);
      pushDm(handle, true, topic.say);
      pushDm(handle, false, topic.back);
      // 고를 말이 다 떨어지면 그 계정이 대화를 닫는다
      if (room.used.length === topics.length) pushDm(handle, false, data.dm.accounts[handle].close);
      room.seen = room.msgs.length; // 보고 있는 방이라 바로 읽음
      return { handle: handle, msgs: room.msgs };
    }
    function markDmRead(handle) {
      var room = dmRoom(handle);
      if (room) room.seen = room.msgs.length;
    }
    // 안 읽은 DM 수. 어느 방을 열었는지는 UI가 알지만 셈은 여기가 안다.
    function unreadDms() {
      return Object.keys(state.dms).reduce(function (n, h) {
        return n + Math.max(0, state.dms[h].msgs.length - state.dms[h].seen);
      }, 0);
    }

    // ── 스토리 DM ────────────────────────────────────────────
    // 기존 DM(선택지 풀)과 다른 갈래다. 순서가 있고, 한 번 지나간 노드로 돌아가지 않는다.
    function storyDef(handle) {
      return (data.dm && data.dm.stories && data.dm.stories[handle]) || null;
    }
    function storyState(handle) { return state.dmStory[handle] || null; }

    // 그 노드로 옮기고 상대의 말을 방에 넣는다. 끝 노드면 done을 찍는다.
    function goStory(handle, nodeId) {
      var def = storyDef(handle);
      if (!def || !def.nodes[nodeId]) return null;
      var node = def.nodes[nodeId];
      var st = state.dmStory[handle] ||
        (state.dmStory[handle] = { node: null, pending: null, done: false });
      dmRoom(handle);
      st.node = nodeId;
      st.pending = null;
      pushDm(handle, false, node.text);
      // 노드 보상. DM은 스탯을 안 건드린다는 규칙의 유일한 예외다 —
      // 대사를 고르는 게 아니라 긴 이야기를 완주해야 한 번 받는 것이라
      // 남용 경로가 없다(끝 노드는 done이 찍혀 다시 지나가지 않는다).
      if (node.reward) applyEffects(node.reward, {});
      if (node.end) st.done = true;
      return st;
    }

    // 내가 고를 수 있는 말. 대기(choices 없음)·끝·지연 중이면 빈 배열이다.
    function storyChoices(handle) {
      var def = storyDef(handle), st = storyState(handle);
      if (!def || !st || st.done || st.pending) return [];
      var node = def.nodes[st.node];
      if (!node || !node.choices) return [];
      // 형식은 getDmChoices와 같은 { idx, label }이다 — 같은 선택지 바에 그려지므로
      // 다르게 두면 UI가 분기해야 하고, 한쪽만 고치면 버튼이 빈칸으로 나온다(실제로 겪음).
      return node.choices.map(function (c, i) { return { idx: i, label: c.say }; });
    }

    // 이 계정이 스토리 계정인가. UI가 "선택지가 비었는가"로 판단하면 안 된다 —
    // 대기·지연 중에도 빈 배열이라, 그걸로 가르면 기존 getDmChoices로 넘어가
    // accounts에 없는 계정에서 터진다(실제로 겪음).
    // **정의가 있는가가 아니라 지금 돌고 있는가**를 본다. 한 계정이 잡담(accounts)과
    // 스토리(stories)를 둘 다 가질 수 있기 때문이다 — @mutuals_only가 그렇다.
    // 정의만으로 가르면 스토리가 시작되기 훨씬 전부터(팔로워 3000 조건이다)
    // 그 계정 잡담이 통째로 막힌다: UI가 storyChoices()를 쓰는데 빈 배열이라
    // 선택지 바가 비어버린다(실측).
    //
    // 끝난 뒤(done)에도 true다 — 끝 노드의 마지막 대사가 방에 남아 있어야 하고,
    // 이야기를 끝낸 계정과 다시 잡담을 시작하면 그 이야기가 없던 일처럼 읽힌다.
    function isStoryAccount(handle) {
      if (!storyDef(handle)) return false;
      // 이야기가 돌고 있으면(끝난 뒤에도) 스토리 계정이다.
      if (state.dmStory[handle]) return true;
      // 아직 시작 전이면, 잡담 데이터가 없는 계정만 스토리 계정으로 본다 —
      // @old_records처럼 stories에만 있는 계정은 getDmChoices가 topics에서 터진다.
      return !(data.dm.accounts && data.dm.accounts[handle]);
    }

    // 스토리 선택. 하루를 안 쓰고 스탯도 안 건드린다(기존 DM과 같은 규칙).
    // 다음 노드에 delay가 있으면 그 날짜로 예약만 하고 답장은 나중에 온다.
    function sendStory(handle, idx) {
      var def = storyDef(handle), st = storyState(handle);
      if (!def || !st || st.done || st.pending) return null;
      var node = def.nodes[st.node];
      if (!node || !node.choices) return null;
      var choice = node.choices[idx];
      if (!choice) return null;
      var room = dmRoom(handle);
      pushDm(handle, true, choice.say);
      var next = def.nodes[choice.to];
      if (next && next.delay > 0) st.pending = { to: choice.to, day: state.day + next.delay };
      else goStory(handle, choice.to);
      room.seen = room.msgs.length; // 보고 있는 방이라 바로 읽음
      return { handle: handle, msgs: room.msgs };
    }

    // 시작 조건. reactions는 그 계정 트윗에 반응한 수, flags는 이벤트에서 고른 선택지,
    // chance는 확률, 나머지는 스탯 비교식이다.
    //
    // reactions·flags·chance는 checkCond에 넘기기 전에 **반드시 걸러내야 한다** —
    // 안 그러면 스탯 이름으로 오해한다(action·dmStory와 같은 함정).
    function storyReady(handle) {
      var def = storyDef(handle);
      if (!def || state.dmStory[handle]) return false;      // 이미 시작했으면 안 한다
      if (state.npcSeen[handle] == null) return false;      // 만나야 온다
      var req = def.requires || {};
      if (req.reactions != null && reactionsOn(handle) < req.reactions) return false;
      // 표식이 전부 찍혀 있어야 한다. "만났다"가 아니라 "그 선택을 했다"가 조건이다.
      if (req.flags && req.flags.some(function (f) { return !state.flags[f]; })) return false;
      var rest = {};
      Object.keys(req).forEach(function (k) {
        if (k !== "reactions" && k !== "flags" && k !== "chance") rest[k] = req[k];
      });
      if (!checkCond(rest, state)) return false;
      // 확률은 마지막에 잰다 — 다른 조건이 다 맞은 턴에만 주사위를 굴려야
      // 조건이 안 맞는 턴에 확률만 소모되지 않는다.
      // **없으면 확정이다**(기존 두 스토리가 그대로 동작해야 한다).
      return req.chance == null || rand() < req.chance;
    }

    // 턴마다: 조건이 맞으면 시작하고, 예약된 지연 답장이 오늘이면 도착시킨다.
    function tickStories() {
      if (!data.dm || !data.dm.stories) return;
      Object.keys(data.dm.stories).forEach(function (h) {
        if (storyReady(h)) { goStory(h, data.dm.stories[h].start); return; }
        var st = state.dmStory[h];
        if (st && st.pending && state.day >= st.pending.day) goStory(h, st.pending.to);
      });
    }

    // 스토리가 진행 중(아직 안 끝난)인 계정. 확률 DM 후보에서 빼는 근거다 —
    // 이야기 중간에 잡담이 끼면 안 된다.
    function inStory(handle) {
      var st = state.dmStory[handle];
      return !!(st && !st.done);
    }

    // "@핸들:노드" 형식으로 지금 그 스토리가 그 노드에 있는지 본다.
    // 지연 답장을 기다리는 중(pending)이면 아직 그 노드가 아니다.
    function atStoryNode(spec) {
      var at = String(spec).split(":");
      var st = state.dmStory[at[0]];
      return !!(st && !st.done && !st.pending && st.node === at[1]);
    }

    // 팔로우 토글. 반응과 같은 부류다 — 하루를 안 쓰고 스탯도 안 건드린다.
    // 바꾸는 건 "내 홈 타임라인에 누가 흐르는가" 하나뿐이다.
    function toggleFollow(handle) {
      if (!handle || !npcHandles[handle]) return null;
      if (state.following[handle]) delete state.following[handle];
      else state.following[handle] = true;
      return { handle: handle, on: !!state.following[handle] };
    }

    // 반응 대상 트윗을 찾는다. 보관함에만 있고 feed에는 없는 과거 트윗도 대상이라
    // 양쪽을 다 뒤진다(저장/복원 뒤 서로 다른 객체다).
    function findNpcTweet(id) {
      var found = null;
      Object.keys(state.npcTweets).forEach(function (h) {
        state.npcTweets[h].forEach(function (t) { if (t.id === id) found = t; });
      });
      if (found) return found;
      state.feed.forEach(function (f) { if (f.kind === "npc" && f.id === id) found = f; });
      return found;
    }

    // 인용할 수 있는 트윗인가. 남의 트윗(kind "npc")이고 id가 있어야 한다 —
    // 답글은 자기 id가 없고(replyTo만 있다) 내 트윗은 인용 대상이 아니다.
    function canQuote(tweetId) { return !!(tweetId && findNpcTweet(tweetId)); }

    // 인용 미리보기. previewAction과 같은 성격의 읽기 전용 함수다 —
    // 확인 팝업이 "이걸 인용하면 뭐가 오르는가"를 보여줄 때 쓴다.
    function previewQuote(tweetId) {
      var t = findNpcTweet(tweetId);
      if (!t) return null;
      var qrules = data.quote || {};
      var eff = (qrules.byAttr && qrules.byAttr[t.attr]) || qrules.fallback;
      var out = {};
      // 실제 적용과 같은 수식·clamp를 지나야 미리보기가 안 어긋난다
      Object.keys(eff || {}).forEach(function (k) {
        out[k] = evalEffect(k, eff[k], state);
      });
      return { attr: t.attr, author: t.author, text: t.text, effects: out };
    }

    // 내 트윗을 지운다. **하루를 안 쓴다** — 반응·팔로우·디엠과 같은 부류다.
    //
    // tweetLog에서 통째로 지우므로 그 트윗 조회수가 정산에서 자동으로 빠진다
    // (정산은 tweetLog를 훑어 계산한다). 그래서 정산 로직은 건드릴 게 없다.
    // 묘비(deleted 표시)를 남기지 않는다 — 완전 삭제다.
    function deleteTweet(tweetId) {
      if (!tweetId) return null;
      var idx = -1;
      state.tweetLog.forEach(function (t, i) { if (t.id === tweetId) idx = i; });
      if (idx === -1) return null;
      var gone = state.tweetLog[idx];
      state.tweetLog.splice(idx, 1);
      // 피드에서도 뺀다. 그 트윗에 달린 답글도 같이 지운다 — 원본이 없는 답글이
      // 남으면 상세를 열 수 없는 유령 스레드가 된다.
      state.feed = state.feed.filter(function (f) {
        return f.id !== tweetId && f.replyTo !== tweetId;
      });

      var rules = data.deleteTweet || {};
      var changes = {};
      if (rules["논란성"]) applyEffects({ "논란성": rules["논란성"] }, changes);

      // 박제. 지웠는데 캡처가 돌아서 논란성이 오히려 더 오른다.
      // 이게 없으면 삭제가 순수한 이득이라 그냥 눌러야 하는 버튼이 된다.
      var busted = rand() < (rules.bustedChance || 0);
      if (busted && rules.bustedMood) {
        applyEffects({ "논란성": rules.bustedMood }, changes);
      }
      return { id: tweetId, views: gone.views || 0, busted: busted, statChanges: changes };
    }

    // 남의 트윗 좋아요/리트윗. 하루를 소모하지 않고 advanceTurn을 거치지 않는다.
    //
    // 트윗 하나는 카운터를 정확히 한 번만 올린다(gained). 좋아요든 리트윗이든 먼저 누른
    // 쪽에서 오르고, 취소해도 되돌리지 않으며 다시 눌러도 추가되지 않는다 —
    // 안 그러면 켜고 끄기를 반복해 무한히 스탯을 뽑을 수 있다.
    function toggleReaction(tweetId, kind) {
      if (!tweetId || (kind !== "like" && kind !== "rt")) return null;
      var t = findNpcTweet(tweetId);
      if (!t) return null;
      var r = state.reacted[tweetId] || (state.reacted[tweetId] = {});
      r[kind] = !r[kind];
      // 리트윗한 날을 남긴다 — 내 타임라인에 그 날짜로 꽂히는 근거다.
      // 취소하면 지운다: 다시 리트윗하면 그날로 새로 올라와야 한다.
      if (kind === "rt") { if (r.rt) r.rtDay = state.day; else delete r.rtDay; }

      // 날짜가 바뀌었으면 하루 반응 한도를 리셋한다. day가 다르면 새 날로 본다 —
      // 멘탈 붕괴로 날짜가 건너뛰어도(lived=2) 그냥 "어제와 다른 날"이라 정상 리셋된다.
      if (state.reactDay.day !== state.day) state.reactDay = { day: state.day, used: 0 };

      var gain = null;
      // 켤 때만, 그리고 이 트윗을 아직 안 셌을 때만 카운터가 오른다.
      if (r[kind] && !r.gained) {
        var rules = data.reaction, stat = rules && rules.attrStat[t.attr];
        var cap = rules && rules.dailyCap;
        // 하루 한도를 넘으면 반응(좋아요/리트윗) 자체는 정상 동작하지만 카운터는 안 오른다.
        // gained도 안 찍는다 — 안 찍어야 오늘 넘치게 누른 트윗을 내일 다시 눌러 셀 수 있다.
        var underCap = cap == null || state.reactDay.used < cap;
        // stat을 실제로 셀 수 있을 때만 gained를 찍는다. attrStat에 없는 속성(오타·누락)이면
        // 찍지 않아야 매핑을 고친 뒤 같은 트윗에 다시 반응해서 셀 수 있다 — 안 그러면
        // 데이터 오타 하나로 그 트윗이 영영 스탯을 못 주는 채로 세이브에 굳어버린다.
        if (stat && underCap) {
          r.gained = true;
          // 어느 계정 트윗이었는지 함께 남긴다. 보관함은 max를 넘으면 오래된 것부터
          // 밀려나므로, 나중에 보관함을 훑어 세면 반응 기록이 하루 2개씩 사라진다
          // (실제로 겪음 — 몰아서 좋아요하면 스토리 시작 조건이 영영 안 열렸다).
          r.author = t.author;
          state.reactDay.used++;
          var n = (state.reactCount[stat] || 0) + 1, leveled = false;
          if (n >= rules.perPoint) {
            n = 0;
            leveled = true;
            state.stats[stat] = clampStat(stat, state.stats[stat] + 1);
          }
          state.reactCount[stat] = n;
          gain = { stat: stat, count: n, leveled: leveled };
        }
      }
      return { id: tweetId, kind: kind, on: r[kind], gain: gain };
    }

    // 광고 상품 구매. 하루를 안 쓴다 — 반응·팔로우·DM과 같은 부류다.
    // 상품마다 한 번만 살 수 있고(state.bought), 돈이 모자라면 안 산다.
    // 돈은 유일하게 음수를 허용하는 스탯이지만 여기서는 빚을 내서 사지 못하게 막는다 —
    // 광고는 여윳돈으로 사는 물건이고, 빚으로 스탯을 사면 그게 최적 전략이 된다.
    function buyItem(itemId) {
      if (!data.ads || !itemId) return null;
      var item = data.ads.items.filter(function (i) { return i.id === itemId; })[0];
      if (!item || state.bought[itemId]) return null;
      if (state.stats.돈 < item.price) return null;
      state.bought[itemId] = true;
      var changes = {};
      applyEffects({ "돈": -item.price }, changes);
      applyEffects(item.effects, changes);
      return { id: itemId, label: item.label, price: item.price, statChanges: changes };
    }

    // 그 상품을 살 수 있는가. UI가 구매 버튼을 비활성으로 그릴 근거다 —
    // 왜 못 사는지도 같이 알려준다(돈이 모자란 건지 이미 산 건지).
    function canBuy(itemId) {
      if (!data.ads || !itemId) return { ok: false, reason: "unknown" };
      var item = data.ads.items.filter(function (i) { return i.id === itemId; })[0];
      if (!item) return { ok: false, reason: "unknown" };
      if (state.bought[itemId]) return { ok: false, reason: "bought" };
      if (state.stats.돈 < item.price) return { ok: false, reason: "money" };
      return { ok: true, reason: null };
    }

    // 그 계정 트윗 중 내가 반응해서 카운트된 수. 좋아요·리트윗 합산이고 트윗당 1회다
    // (gained가 그 기준이다 — toggleReaction과 같은 기준을 쓴다).
    // state.reacted엔 트윗 id만 있어서 어느 계정 것인지는 보관함을 봐야 안다.
    // 보관함이 아니라 반응 기록에서 센다. 보관함은 오래된 트윗을 밀어내므로
    // 거기서 세면 반응 기록이 하루 2개씩 증발한다(실제로 겪음).
    function reactionsOn(handle) {
      var n = 0;
      Object.keys(state.reacted).forEach(function (id) {
        var r = state.reacted[id];
        if (r.gained && r.author === handle) n++;
      });
      return n;
    }

    return { getState: function () { return state; }, getActions: getActions,
      previewAction: previewAction, advanceTurn: advanceTurn,
      toggleReaction: toggleReaction, toggleFollow: toggleFollow,
      dmAccounts: dmAccounts, getDmChoices: getDmChoices, sendDm: sendDm,
      markDmRead: markDmRead, unreadDms: unreadDms,
      storyChoices: storyChoices, sendStory: sendStory, isStoryAccount: isStoryAccount,
      buyItem: buyItem, canBuy: canBuy,
      canQuote: canQuote, previewQuote: previewQuote, deleteTweet: deleteTweet,
      _goStory: goStory,
      _reactionsOn: reactionsOn };
  }

  return { _utils: { compare: compare, checkCond: checkCond, evalFormula: evalFormula,
    evalEffect: evalEffect },
    create: create };
})();
if (typeof module !== "undefined") module.exports = Engine;

