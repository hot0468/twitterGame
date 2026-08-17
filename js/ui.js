var UI = (function () {
  function $(id) { return document.getElementById(id); }

  function tweetEl(item) {
    var div = document.createElement("div");
    div.className = "tweet " + item.kind;
    var who = item.author === "me" ? "나" : (item.name || item.author);
    var handle = item.author === "me" ? "@me" : item.author;
    var meta = item.kind === "me" ? "  ♥ " + (item.likes || 0) + "  🔁 " + (item.rts || 0) : "";
    div.innerHTML =
      '<div class="avatar">' + (item.author === "me" ? "😎" : item.kind === "event" ? "🌐" : item.kind === "system" ? "⚠️" : "🐤") + "</div>" +
      '<div class="body"><span class="who"></span> <span class="handle"></span>' +
      '<div class="text"></div><span class="meta">' + item.day + "일차" + meta + "</span></div>";
    div.querySelector(".who").textContent = who;
    div.querySelector(".handle").textContent = handle;
    div.querySelector(".text").textContent = item.text;
    return div;
  }

  function renderFeed(el, items) {
    el.innerHTML = "";
    items.forEach(function (it) { el.appendChild(tweetEl(it)); });
  }

  function renderAll(state) {
    $("day").textContent = state.day + "일차";
    $("followers").textContent = "팔로워 " + state.followers.toLocaleString();
    renderFeed($("feed"), state.feed);
    renderFeed($("profile-tweets"), state.tweetLog.slice().reverse());
    var stats = $("profile-stats");
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
    renderFeed($("notif-list"), notifItems);
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
      var kindLabel = a.kind === "event" ? "⚡ 이벤트 대응" : a.kind === "tweet" ? "트윗" : "자기계발";
      item.innerHTML = '<span class="label"></span><span class="kind">' + kindLabel + "</span>";
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
    ov.innerHTML = '<div class="card"><h1></h1><p></p><button>새 게임</button></div>';
    ov.querySelector("h1").textContent = "🏆 " + ending.title;
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
    setTurnDone: setTurnDone, showEnding: showEnding, switchView: switchView };
})();
if (typeof module !== "undefined") module.exports = UI;
