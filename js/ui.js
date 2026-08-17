var UI = (function () {
  function $(id) { return document.getElementById(id); }

  // 스탯별 아이콘·색조. 프레젠테이션 전용 — 엔진은 스탯 이름만 안다.
  // 논란성만 위험색(hot)인 건 의도: 성장 가속 페달이자 리스크라는 걸 색으로 알린다.
  // 1일차 = 2026년 3월 2일(월). 엔진은 날짜를 모르고 day만 센다 — 표기는 UI 몫.
  var START = { year: 2026, monthIndex: 2, date: 2 };
  var WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

  function dateLabel(day) {
    var d = new Date(START.year, START.monthIndex, START.date + (day - 1));
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + WEEKDAY[d.getDay()] + ")";
  }

  var STAT_STYLE = {
    "글빨": { icon: "feather", tone: "ink" },
    "유머": { icon: "laugh", tone: "warm" },
    "감각": { icon: "trending-up", tone: "violet" },
    "멘탈": { icon: "battery-medium", tone: "calm" },
    "돈": { icon: "wallet", tone: "money" },
    "논란성": { icon: "flame", tone: "hot" }
  };

  function avatarIcon(item) {
    if (item.author === "me") return "circle-user";
    if (item.kind === "event") return "globe";
    if (item.kind === "system") return "triangle-alert";
    return "message-circle";
  }

  function tweetEl(item) {
    var div = document.createElement("div");
    div.className = "tweet " + item.kind;
    var who = item.author === "me" ? "나" : (item.name || item.author);
    var handle = item.author === "me" ? "@me" : item.author;
    var metrics = item.kind === "me"
      ? '<span class="metric">' + Icons.svg("heart") + (item.likes || 0) + "</span>" +
        '<span class="metric">' + Icons.svg("repeat-2") + (item.rts || 0) + "</span>"
      : "";
    div.innerHTML =
      '<div class="avatar">' + Icons.svg(avatarIcon(item)) + "</div>" +
      '<div class="body"><span class="who"></span> <span class="handle"></span>' +
      '<div class="text"></div><div class="meta"><span>' + item.day + "일차</span>" + metrics + "</div></div>";
    div.querySelector(".who").textContent = who;
    div.querySelector(".handle").textContent = handle;
    div.querySelector(".text").textContent = item.text;
    return div;
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
    items.forEach(function (it) { el.appendChild(tweetEl(it)); });
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
    renderFeed($("feed"), state.feed, "타임라인이 조용합니다. 첫 트윗을 써보세요.");
    renderProfile(state);
    // 마운트 지점이 둘(데스크톱=사이드바, 모바일=상단 스트립) — CSS가 하나만 보여준다
    document.querySelectorAll("[data-stats]").forEach(function (panel) {
      panel.innerHTML = "";
      Object.keys(state.stats).forEach(function (k) {
        var style = STAT_STYLE[k] || { icon: "trending-up", tone: "ink" };
        var row = document.createElement("div");
        row.className = "stat-row tone-" + style.tone;
        row.innerHTML = '<span class="stat-name">' + Icons.svg(style.icon) +
          "<span></span></span><b></b>";
        row.querySelector(".stat-name span").textContent = k;
        row.querySelector("b").textContent = statValue(k, state.stats[k]);
        panel.appendChild(row);
      });
    });
    var notifItems = state.feed.filter(function (f) { return f.kind === "event" || f.kind === "system" || f.kind === "reply"; });
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

  // 하루가 넘어갈 때 날짜를 띄운다. 탭하면 즉시, 아니면 1.4초 후 닫히고 onDone 호출.
  function showDayTransition(day, onDone) {
    var modal = $("day-modal");
    $("day-modal-num").textContent = day + "일차";
    $("day-modal-date").textContent = dateLabel(day);
    modal.classList.remove("hidden");
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      modal.onclick = null;
      modal.classList.add("hidden");
      if (onDone) onDone();
    }
    var timer = setTimeout(finish, 1400);
    modal.onclick = finish;
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
    ["home", "profile", "notif"].forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
    });
    // [data-view]로 한정 — 스탯 토글도 .nav-btn이지만 뷰가 없어서 여기 끼면 active가 꼬인다
    document.querySelectorAll(".nav-btn[data-view]").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === name);
    });
  }

  return { renderAll: renderAll, showActions: showActions, hideActions: hideActions,
    openTweetPrompt: openTweetPrompt, closeTweetPrompt: closeTweetPrompt,
    showDayTransition: showDayTransition, dateLabel: dateLabel,
    showEnding: showEnding, switchView: switchView,
    setProfileTab: setProfileTab, toggleStats: toggleStats, closeStats: closeStats };
})();
if (typeof module !== "undefined") module.exports = UI;
