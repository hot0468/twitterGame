var UI = (function () {
  function $(id) { return document.getElementById(id); }

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
      ? '<span class="metric">' + Icons.svg("heart", 15) + (item.likes || 0) + "</span>" +
        '<span class="metric">' + Icons.svg("repeat-2", 15) + (item.rts || 0) + "</span>"
      : "";
    div.innerHTML =
      '<div class="avatar">' + Icons.svg(avatarIcon(item), 24) + "</div>" +
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
    $("day").textContent = state.day + "일차";
    $("followers").textContent = "팔로워 " + state.followers.toLocaleString();
    renderFeed($("feed"), state.feed, "타임라인이 조용합니다. 첫 트윗을 써보세요.");
    renderProfile(state);
    var stats = $("stats-panel");
    stats.innerHTML = "";
    Object.keys(state.stats).forEach(function (k) {
      var row = document.createElement("div");
      row.className = "stat-row";
      row.innerHTML = "<span></span><b></b>";
      row.querySelector("span").textContent = k;
      row.querySelector("b").textContent = state.stats[k];
      stats.appendChild(row);
    });
    var notifItems = state.feed.filter(function (f) { return f.kind === "event" || f.kind === "system" || f.kind === "reply"; });
    renderFeed($("notif-list"), notifItems, "아직 알림이 없습니다.");
    var badge = $("notif-badge");
    var pending = state.activeEvents.length;
    badge.textContent = pending;
    badge.classList.toggle("hidden", pending === 0);
  }

  function showActions(actions, onPick) {
    var list = $("action-list");
    list.innerHTML = "";
    actions.forEach(function (a) {
      var item = document.createElement("div");
      item.className = "action-item" + (a.kind === "event" ? " event" : "");
      var kindIcon = a.kind === "event" ? "zap" : a.kind === "tweet" ? "pen-line" : "book-open";
      var kindText = a.kind === "event" ? "이벤트 대응" : a.kind === "tweet" ? "트윗" : "자기계발";
      item.innerHTML = '<span class="label"></span><span class="kind">' + Icons.svg(kindIcon, 14) + kindText + "</span>";
      item.querySelector(".label").textContent = a.label;
      item.onclick = function () { onPick(a.id); };
      list.appendChild(item);
    });
    list.classList.remove("hidden");
  }

  function hideActions() { $("action-list").classList.add("hidden"); }

  function setTurnDone(done) {
    $("next-day").disabled = !done;
    $("compose").style.opacity = done ? "0.4" : "1";
    $("compose").style.pointerEvents = done ? "none" : "auto";
  }

  function showEnding(ending, onNewGame) {
    var ov = $("ending-overlay");
    ov.innerHTML = '<div class="card"><div class="trophy">' + Icons.svg("trophy", 44) +
      "</div><h1></h1><p></p><button>새 게임</button></div>";
    ov.querySelector("h1").textContent = ending.title;
    ov.querySelector("p").textContent = ending.text;
    ov.querySelector("button").onclick = onNewGame;
    ov.classList.remove("hidden");
  }

  function switchView(name) {
    ["home", "profile", "notif"].forEach(function (v) {
      document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
    });
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === name);
    });
  }

  return { renderAll: renderAll, showActions: showActions, hideActions: hideActions,
    setTurnDone: setTurnDone, showEnding: showEnding, switchView: switchView,
    setProfileTab: setProfileTab };
})();
if (typeof module !== "undefined") module.exports = UI;
