var UI = (function () {
  function $(id) { return document.getElementById(id); }

  // 스탯별 아이콘·색조. 프레젠테이션 전용 — 엔진은 스탯 이름만 안다.
  // 논란성만 위험색(hot)인 건 의도: 성장 가속 페달이자 리스크라는 걸 색으로 알린다.
  // 1일차 = 2026년 3월 2일(월). 엔진은 날짜를 모르고 day만 센다 — 표기는 UI 몫.
  var START = { year: 2026, monthIndex: 2, date: 2 };
  var WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

  function dayToDate(day) {
    return new Date(START.year, START.monthIndex, START.date + (day - 1));
  }

  // 요일까지 붙는 긴 표기 — 날짜 자체가 주인공인 곳(상단바·주급날 팝업)에 쓴다
  function dateLabel(day) {
    var d = dayToDate(day);
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + WEEKDAY[d.getDay()] + ")";
  }

  // 트윗·알림의 타임스탬프. 실제 X처럼 "3월 10일"까지만 — 요일은 군더더기다
  function shortDate(day) {
    var d = dayToDate(day);
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일";
  }

  var STAT_STYLE = {
    "글빨": { icon: "feather", tone: "ink" },
    "유머": { icon: "laugh", tone: "warm" },
    "감각": { icon: "trending-up", tone: "violet" },
    "멘탈": { icon: "battery-medium", tone: "calm" },
    "돈": { icon: "wallet", tone: "money" },
    "논란성": { icon: "flame", tone: "hot" }
  };

  // 실제 트위터처럼 답글은 홈 타임라인에 안 뜬다 — 알림에서 보거나 트윗 상세로 들어가야 한다
  // 정산은 주 1회뿐이고 이 게임의 심장이라 타임라인·알림 양쪽에 남긴다
  var TIMELINE_KINDS = ["me", "event", "system", "settlement"];
  var NOTIF_KINDS = ["like", "retweet", "follow", "reply", "event", "system", "settlement"];

  function avatarIcon(item) {
    if (item.author === "me") return "circle-user";
    if (item.kind === "event") return "globe";
    if (item.kind === "system") return "triangle-alert";
    return "circle-user"; // 답글은 사람이 쓴 것 — 알림 아바타와 같은 아이콘
  }

  // data-value에 최종 수치를 남긴다 — 카운트업이 textContent를 덮어써도 목표치를 잃지 않는다
  function metricEl(icon, n) {
    n = n || 0;
    return '<span class="metric">' + Icons.svg(icon) +
      '<span class="num" data-value="' + n + '">' + n.toLocaleString() + "</span></span>";
  }

  function tweetEl(item, opts) {
    opts = opts || {};
    var div = document.createElement("div");
    div.className = "tweet " + item.kind + (opts.detail ? " detail" : "");
    // 클릭하면 상세로: 내 트윗은 자기 스레드, 답글은 원본 트윗의 스레드로 간다.
    // 상세 화면 안에서는 더 들어갈 곳이 없으므로 링크를 걸지 않는다.
    if (!opts.detail) {
      var target = item.kind === "me" ? item.id : (item.kind === "reply" ? item.replyTo : null);
      if (target) div.dataset.detail = target;
    }
    var who = item.author === "me" ? "나" : (item.name || item.author);
    var handle = item.author === "me" ? "@me" : item.author;
    var metrics = item.kind === "me"
      ? metricEl("heart", item.likes) + metricEl("repeat-2", item.rts) + metricEl("chart-column", item.views)
      : "";
    div.innerHTML =
      '<div class="avatar">' + Icons.svg(avatarIcon(item)) + "</div>" +
      '<div class="body"><span class="who"></span> <span class="handle"></span>' +
      '<div class="text"></div><div class="meta"><span>' + shortDate(item.day) + "</span>" + metrics + "</div></div>";
    div.querySelector(".who").textContent = who;
    div.querySelector(".handle").textContent = handle;
    div.querySelector(".text").textContent = item.text;
    return div;
  }

  // "밈수집가 님이" / "밈수집가 님과 불씨 님이" / "밈수집가 님 외 78명이"
  function actorPhrase(item) {
    var names = item.actors.map(function (a) { return a.name; });
    if (item.others > 0) return names[0] + " 님 외 " + item.others.toLocaleString() + "명이";
    if (names.length > 1) return names[0] + " 님과 " + names[1] + " 님이";
    return names[0] + " 님이";
  }

  // 반응 알림 3종. 팔로우엔 인용할 트윗이 없어서 미리보기 줄을 아예 안 만든다.
  var REACTIONS = {
    like: { icon: "heart", verb: " 내 게시물을 마음에 들어 합니다" },
    retweet: { icon: "repeat-2", verb: " 내 게시물을 재게시했습니다" },
    follow: { icon: "user-plus", verb: " 회원님을 팔로우하기 시작했습니다" }
  };

  function reactionEl(item) {
    var r = REACTIONS[item.kind];
    var div = document.createElement("div");
    div.className = "notif " + item.kind;
    var avatars = item.actors.map(function () {
      return '<div class="avatar small">' + Icons.svg("circle-user") + "</div>";
    }).join("");
    div.innerHTML =
      '<div class="notif-icon">' + Icons.svg(r.icon) + "</div>" +
      '<div class="notif-body"><div class="notif-avatars">' + avatars + "</div>" +
      '<div class="notif-line"><b class="who"></b><span class="verb"></span></div>' +
      (item.text ? '<div class="notif-preview"></div>' : "") + "</div>";
    div.querySelector(".who").textContent = actorPhrase(item);
    div.querySelector(".verb").textContent = r.verb + " · " + shortDate(item.day);
    if (item.text) div.querySelector(".notif-preview").textContent = item.text;
    return div;
  }

  // 주간 정산 카드. 엔진은 일차와 정수 원만 넘긴다 — 날짜 표기와 "원"은 여기서만 붙인다.
  function settlementEl(item) {
    var div = document.createElement("div");
    div.className = "settle" + (item.net < 0 ? " minus" : "");
    div.innerHTML =
      '<div class="settle-head">' + Icons.svg("wallet") +
      "<b></b><span class=\"settle-range\"></span></div>" +
      '<div class="settle-net"></div><div class="settle-rows"></div>';
    div.querySelector(".settle-head b").textContent = "크리에이터 수익 정산";
    div.querySelector(".settle-range").textContent =
      shortDate(item.from) + " ~ " + shortDate(item.to);
    div.querySelector(".settle-net").textContent =
      (item.net >= 0 ? "+" : "-") + statValue("돈", Math.abs(item.net));
    fillSettleRows(div.querySelector(".settle-rows"), item);
    return div;
  }

  // 피드 카드와 주급날 팝업이 같은 내역을 쓴다 — 한 곳에서 만들어야 숫자가 어긋나지 않는다
  function fillSettleRows(el, item) {
    el.innerHTML = "";
    [["주간 조회수", item.views.toLocaleString() + "회"],
     ["조회수 정산금", "+" + statValue("돈", item.payout)],
     ["프리미엄 결제료", "-" + statValue("돈", item.fee)]
    ].forEach(function (r) {
      var row = document.createElement("div");
      row.className = "settle-row";
      row.innerHTML = "<span></span><b></b>";
      row.querySelector("span").textContent = r[0];
      row.querySelector("b").textContent = r[1];
      el.appendChild(row);
    });
  }

  function feedItemEl(item) {
    if (item.kind === "settlement") return settlementEl(item);
    return REACTIONS[item.kind] ? reactionEl(item) : tweetEl(item);
  }

  function renderFeed(el, items, emptyText) {
    el.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = emptyText;
      el.appendChild(empty);
      return;
    }
    items.forEach(function (it) { el.appendChild(feedItemEl(it)); });
  }

  // 방금 올린 트윗의 반응이 밀려드는 연출. 표시만 건드리며 수치는 엔진이 정한 그대로다.
  function countUp(el, to, ms) {
    if (to <= 0) return;
    var start = null;
    el.textContent = "0";
    requestAnimationFrame(function step(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / ms, 1);
      // ease-out — 초반에 확 몰리고 끝에서 잦아든다
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    });
  }

  // 타임라인 맨 위 = 방금 쓴 트윗(engine이 feed를 최신순으로 쌓는다)
  function animateLatestMetrics() {
    var tweet = document.querySelector("#feed .tweet.me");
    if (!tweet) return;
    tweet.querySelectorAll(".metric .num").forEach(function (n, i) {
      countUp(n, Number(n.dataset.value), 1200 + i * 150);
    });
  }

  // ── 트윗 상세 ──────────────────────────────────
  var currentView = "home";
  var detailTweetId = null;
  var detailReturnView = "home";

  function openTweetDetail(id) {
    if (!id || id === detailTweetId) return;
    // 상세에서 상세로 넘어갈 때 원래 돌아갈 곳을 잃지 않는다
    if (currentView !== "tweet") detailReturnView = currentView;
    detailTweetId = id;
    switchView("tweet");
  }

  function closeTweetDetail() {
    detailTweetId = null;
    switchView(detailReturnView);
  }

  function renderTweetDetail(state) {
    if (!detailTweetId) return;
    var main = $("tweet-detail-main");
    main.innerHTML = "";
    var tweet = state.tweetLog.concat(state.feed).filter(function (t) {
      return t.id === detailTweetId;
    })[0];
    if (!tweet) {
      renderFeed(main, [], "게시물을 찾을 수 없습니다.");
      renderFeed($("tweet-detail-replies"), [], "");
      return;
    }
    main.appendChild(tweetEl(tweet, { detail: true }));
    var replies = state.feed.filter(function (f) {
      return f.kind === "reply" && f.replyTo === detailTweetId;
    });
    renderFeed($("tweet-detail-replies"), replies, "아직 답글이 없습니다.");
  }

  var profileTab = "posts";

  function setProfileTab(name) {
    profileTab = name;
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === name);
    });
  }

  function renderProfile(state) {
    $("profile-since").textContent = state.day + "일차";
    $("profile-tweet-count").textContent = state.tweetLog.length;
    $("profile-followers").textContent = state.followers.toLocaleString();
    if (profileTab === "posts") {
      renderFeed($("profile-tweets"), state.tweetLog.slice().reverse(), "아직 쓴 글이 없습니다.");
    } else {
      var replies = state.feed.filter(function (f) { return f.kind === "reply"; });
      renderFeed($("profile-tweets"), replies, "아직 받은 답글이 없습니다.");
    }
  }

  function renderAll(state) {
    $("day").textContent = state.day + "일차 · " + dateLabel(state.day);
    $("followers").textContent = "팔로워 " + state.followers.toLocaleString();
    var timeline = state.feed.filter(function (f) { return TIMELINE_KINDS.indexOf(f.kind) !== -1; });
    renderFeed($("feed"), timeline, "타임라인이 조용합니다. 첫 트윗을 써보세요.");
    renderProfile(state);
    renderTweetDetail(state);
    // 마운트 지점이 둘(데스크톱=사이드바, 모바일=상단 스트립) — CSS가 하나만 보여준다
    document.querySelectorAll("[data-stats]").forEach(function (panel) {
      panel.innerHTML = "";
      Object.keys(state.stats).forEach(function (k) {
        var style = STAT_STYLE[k] || { icon: "trending-up", tone: "ink" };
        var row = document.createElement("div");
        // 마이너스 통장은 눈에 띄어야 한다 — 게임 오버는 아니지만 갚아야 할 빚이다
        row.className = "stat-row tone-" + style.tone +
          (state.stats[k] < 0 ? " negative" : "");
        row.innerHTML = '<span class="stat-name">' + Icons.svg(style.icon) +
          "<span></span></span><b></b>";
        row.querySelector(".stat-name span").textContent = k;
        row.querySelector("b").textContent = statValue(k, state.stats[k]);
        panel.appendChild(row);
      });
    });
    var notifItems = state.feed.filter(function (f) { return NOTIF_KINDS.indexOf(f.kind) !== -1; });
    renderFeed($("notif-list"), notifItems, "아직 알림이 없습니다.");
    var badge = $("notif-badge");
    var pending = state.activeEvents.length;
    badge.textContent = pending;
    badge.classList.toggle("hidden", pending === 0);
  }

  // 돈만 원 단위로 표기한다 (엔진은 정수 원으로만 다룬다)
  function statValue(name, v) {
    return name === "돈" ? v.toLocaleString() + "원" : String(v);
  }

  // { 글빨: 2, 돈: -250000 } → "글빨 +2  돈 -250,000원"
  function effectsText(effects) {
    return Object.keys(effects || {}).map(function (k) {
      var v = effects[k];
      return k + " " + (v >= 0 ? "+" : "-") + statValue(k, Math.abs(v));
    }).join("  ");
  }

  function showActions(actions, onPick) {
    var list = $("action-list");
    list.innerHTML = "";
    actions.forEach(function (a) {
      var item = document.createElement("div");
      item.className = "action-item" + (a.kind === "event" ? " event" : "");
      var right = a.kind === "event"
        ? Icons.svg("zap") + "이벤트 대응"
        : effectsText(a.effects) || "—";
      item.innerHTML = '<span class="label"></span><span class="kind">' + right + "</span>";
      item.querySelector(".label").textContent = a.label;
      item.onclick = function () { onPick(a.id); };
      list.appendChild(item);
    });
    $("compose-modal").classList.remove("hidden");
  }

  function hideActions() { $("compose-modal").classList.add("hidden"); }

  // 행동을 고른 뒤 "이걸 트윗할까?" — preview는 engine.previewAction() 결과
  function openTweetPrompt(preview) {
    $("tweet-title").textContent = "‘" + preview.label + "’ — 트윗할까?";
    var gained = effectsText(preview.effects);
    var onPost = effectsText(preview.tweetEffects);
    $("tweet-preview").innerHTML =
      '<div class="preview-row"><span class="preview-label">한 일</span><b class="done"></b></div>' +
      '<div class="preview-row"><span class="preview-label">트윗하면</span><b class="post"></b></div>';
    $("tweet-preview").querySelector(".done").textContent = gained || "스탯 변화 없음";
    $("tweet-preview").querySelector(".post").textContent = onPost || "변화 없음";
    $("tweet-modal").classList.remove("hidden");
  }

  function closeTweetPrompt() { $("tweet-modal").classList.add("hidden"); }

  // 주급날 딤팝업. 날짜 전환은 조용히 넘어가고 정산일에만 이걸 띄운다 — 주 1회뿐이라
  // 자동으로 닫지 않는다(읽어야 하는 정보다). 확인 버튼이나 딤을 누르면 onDone.
  function showSettlement(item, onDone) {
    var modal = $("settle-modal");
    modal.querySelector(".card").classList.toggle("minus", item.net < 0);
    $("payday-range").textContent = dateLabel(item.from) + " ~ " + dateLabel(item.to);
    $("payday-amount").textContent =
      (item.net >= 0 ? "+" : "-") + statValue("돈", Math.abs(item.net));
    fillSettleRows($("payday-rows"), item);
    modal.classList.remove("hidden");
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      modal.onclick = null;
      $("payday-ok").onclick = null;
      modal.classList.add("hidden");
      if (onDone) onDone();
    }
    $("payday-ok").onclick = finish;
    modal.onclick = function (e) { if (e.target === modal) finish(); };
  }

  // 모바일 스탯 팝오버. 데스크톱에선 .stats-strip이 CSS로 계속 숨겨져 있어 아무 영향 없다.
  function setStatsOpen(open) {
    document.querySelector(".stats-strip").classList.toggle("open", open);
    $("stats-toggle").setAttribute("aria-expanded", String(open));
    $("stats-toggle").classList.toggle("active", open);
  }

  function toggleStats() {
    setStatsOpen(!document.querySelector(".stats-strip").classList.contains("open"));
  }

  function closeStats() { setStatsOpen(false); }

  // 계정 블록의 로그아웃 팝오버
  function setAccountMenuOpen(open) {
    $("account-menu").classList.toggle("hidden", !open);
    $("account").setAttribute("aria-expanded", String(open));
    $("account").classList.toggle("active", open);
  }

  function toggleAccountMenu() {
    setAccountMenuOpen($("account-menu").classList.contains("hidden"));
  }

  function closeAccountMenu() { setAccountMenuOpen(false); }

  function showEnding(ending, onNewGame) {
    var ov = $("ending-overlay");
    ov.innerHTML = '<div class="card"><div class="trophy">' + Icons.svg("trophy") +
      '</div><h1></h1><p></p><button class="btn-primary">새 게임</button></div>';
    ov.querySelector("h1").textContent = ending.title;
    ov.querySelector("p").textContent = ending.text;
    ov.querySelector("button").onclick = onNewGame;
    ov.classList.remove("hidden");
  }

  function switchView(name) {
    currentView = name;
    ["home", "profile", "notif", "tweet"].forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
    });
    // [data-view]로 한정 — 스탯 토글도 .nav-btn이지만 뷰가 없어서 여기 끼면 active가 꼬인다
    document.querySelectorAll(".nav-btn[data-view]").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === name);
    });
  }

  return { renderAll: renderAll, showActions: showActions, hideActions: hideActions,
    openTweetPrompt: openTweetPrompt, closeTweetPrompt: closeTweetPrompt,
    showSettlement: showSettlement, dateLabel: dateLabel,
    animateLatestMetrics: animateLatestMetrics,
    showEnding: showEnding, switchView: switchView,
    setProfileTab: setProfileTab, toggleStats: toggleStats, closeStats: closeStats,
    toggleAccountMenu: toggleAccountMenu, closeAccountMenu: closeAccountMenu,
    openTweetDetail: openTweetDetail, closeTweetDetail: closeTweetDetail };
})();
if (typeof module !== "undefined") module.exports = UI;
