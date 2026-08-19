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

  // 트윗 속성 → 스탯. data/npcs.js의 reaction.attrStat과 같은 값이다
  // (ui.js는 표기만 담당하고 규칙은 엔진에 있다).
  var ATTR_STAT = { humor: "유머", info: "글빨", daily: "감각", bait: "논란성" };

  // 게이지 칸 수. data/npcs.js의 reaction.perPoint와 같아야 한다(표기용 복제).
  var GAIN_MAX = 5;

  // 실제 트위터처럼 답글은 홈 타임라인에 안 뜬다 — 알림에서 보거나 트윗 상세로 들어가야 한다
  // 정산은 주 1회뿐이고 이 게임의 심장이라 타임라인·알림 양쪽에 남긴다
  // npc = 팔로잉 계정들의 전용 트윗. 타임라인에만 흐르고 알림엔 안 뜬다(남의 트윗이니까)
  // 정산은 타임라인에 없다 — 실제 X도 수익 정산을 타임라인에 띄우지 않는다.
  // 주급날 팝업으로 보고, 기록은 알림에 남는다(NOTIF_KINDS에는 그대로 있다).
  var TIMELINE_KINDS = ["me", "npc", "event", "system"];
  var NOTIF_KINDS = ["like", "retweet", "follow", "reply", "event", "system", "settlement"];

  function notifItemsOf(state) {
    return state.feed.filter(function (f) { return NOTIF_KINDS.indexOf(f.kind) !== -1; });
  }

  // 안 읽은 알림 수. 옛 세이브 보정 탓에 음수가 나올 수 있어 0으로 자른다.
  function unreadNotifs(state) {
    return Math.max(0, notifItemsOf(state).length - (state.notifSeen || 0));
  }

  // 알림 화면을 열면 읽은 것으로 처리한다. 저장은 호출한 쪽(main.js)이 한다.
  function markNotifsRead(state) { state.notifSeen = notifItemsOf(state).length; }

  // 프로필 사진. 경로는 핸들에서 바로 나오므로 데이터에 파일명을 또 적지 않는다.
  // (@meme_bot99 → assets/avatars/meme_bot99.svg, 나 → me.svg)
  function pfpSrc(handle) {
    return "assets/avatars/" +
      (handle === "me" || handle === "@me" ? "me" : String(handle).replace("@", "")) + ".svg";
  }

  function pfp(handle) {
    return '<img class="pfp" alt="" src="' + pfpSrc(handle) + '">';
  }

  // 아바타를 누르면 그 계정 프로필로 간다. data-account를 클릭 위임이 읽는다(main.js).
  // 이벤트·시스템 항목은 계정이 아니라서 붙이지 않는다.
  function avatarAttr(item) {
    return item.kind === "event" || item.kind === "system"
      ? "" : ' data-account="' + item.author + '"';
  }

  // 플레이어 계정. NPC와 같은 모양으로 두면 renderProfile이 둘을 같은 코드로 그린다.
  var ME = { name: "나", handle: "@me",
    bio: "트위터에서 뭐라도 되어보려는 사람.\n오늘도 타임라인에 글을 하나 던집니다." };

  function npcByHandle(handle) {
    var list = (typeof GAME_DATA !== "undefined" && GAME_DATA.npcs) || [];
    return list.filter(function (n) { return n.handle === handle; })[0] || null;
  }

  // 계정(나·NPC)은 프로필 사진, 이벤트·시스템은 계정이 아니라서 아이콘을 쓴다
  function avatarInner(item) {
    if (item.kind === "event") return Icons.svg("globe");
    if (item.kind === "system") return Icons.svg("triangle-alert");
    return pfp(item.author);
  }

  // data-value에 최종 수치를 남긴다 — 카운트업이 textContent를 덮어써도 목표치를 잃지 않는다
  function metricEl(icon, n) {
    n = n || 0;
    return '<span class="metric">' + Icons.svg(icon) +
      '<span class="num" data-value="' + n + '">' + n.toLocaleString() + "</span></span>";
  }

  // 남의 트윗에 붙는 반응 버튼. 누른 상태는 state.reacted에 남는다.
  // 내가 누르면 표시 수치가 1 올라간다(실제 X와 동일) — 원본 수치는 그대로 두고 표시만 더한다.
  function reactBtn(id, kind, icon, base, on, extra) {
    var n = (base || 0) + (on ? 1 : 0);
    return '<button class="react ' + kind + (on ? " on" : "") +
      '" data-react="' + kind + '" data-react-id="' + id + '"' + (extra || "") +
      ' aria-pressed="' + (on ? "true" : "false") + '">' +
      Icons.svg(icon) + "<span>" + (n > 0 ? n.toLocaleString() : "") + "</span></button>";
  }

  // 리트윗 메뉴를 연 트윗의 id. 한 번에 하나만 열린다.
  var rtMenuFor = null;
  function toggleRtMenu(id) { rtMenuFor = rtMenuFor === id ? null : id; }
  // 닫혔는지 여부를 돌려준다 — 부르는 쪽이 다시 그릴지 정할 수 있게
  function closeRtMenu() { var was = rtMenuFor !== null; rtMenuFor = null; return was; }
  function rtMenuOpen() { return rtMenuFor; }

  // 실제 X처럼 리트윗 버튼은 바로 토글하지 않고 메뉴를 연다.
  // "인용하세요"는 넣지 않았다 — 인용은 내 트윗을 새로 쓰는 일이라 하루를 소모하는
  // 별개의 행동이고 지금은 그 경로가 없다. 모양만 있는 항목은 넣지 않는다.
  function rtMenu(id, on) {
    return '<div class="rt-menu" role="menu">' +
      '<button class="menu-item" role="menuitem" data-rt-do="1" data-rt-id="' + id + '">' +
      Icons.svg("repeat-2") + "<span>" + (on ? "재게시 취소" : "재게시") +
      "</span></button></div>";
  }

  // 내가 누른 반응. renderAll이 매 렌더 시작에 채운다 — tweetEl까지 인자로 흘리면
  // renderFeed·feedItemEl 서명이 전부 바뀌므로 렌더 범위 변수로 둔다.
  var reactedNow = {};
  var followingNow = {};
  // 쪽지 선택지와 안 읽은 수는 엔진이 정한다. ui가 다시 계산하면 규칙이 두 곳으로 갈라진다.
  var gameNow = null;

  // 반응은 id가 있는 남의 트윗만 — 답글은 자기 id가 없어서(replyTo만 있다) 대상이 아니고,
  // 내 트윗은 읽기 전용 수치를 보여준다.
  function reactRow(item) {
    if (item.kind !== "npc" || !item.id) return "";
    var r = reactedNow[item.id] || {};
    var open = rtMenuFor === item.id;
    // 메뉴는 버튼을 감싼 .rt-wrap 기준으로 뜬다 — 피드가 스크롤돼도 버튼을 따라간다
    return '<div class="actions">' +
      '<div class="rt-wrap">' +
      reactBtn(item.id, "rt", "repeat-2", item.rts, r.rt,
        ' aria-haspopup="menu" aria-expanded="' + (open ? "true" : "false") + '"') +
      (open ? rtMenu(item.id, r.rt) : "") + "</div>" +
      reactBtn(item.id, "like", "heart", item.likes, r.like) + "</div>";
  }

  // 남의 트윗 우상단 속성 배지. 내 트윗·답글·이벤트엔 붙지 않는다(NPC 트윗만 반응 대상).
  // 이미 센 트윗(gained)은 반투명 — 정보는 남으면서 아직 얻을 게 있는 트윗이 눈에 띈다.
  function attrBadge(item) {
    if (item.kind !== "npc" || !item.attr) return "";
    var stat = ATTR_STAT[item.attr];
    if (!stat) return "";
    var style = STAT_STYLE[stat] || { icon: "trending-up", tone: "ink" };
    var done = (reactedNow[item.id] || {}).gained ? " done" : "";
    return '<span class="attr-badge tone-' + style.tone + done + '" title="' + stat + '">' +
      Icons.svg(style.icon) + "</span>";
  }

  function tweetEl(item, opts) {
    opts = opts || {};
    var div = document.createElement("div");
    div.className = "tweet " + item.kind + (opts.detail ? " detail" : "");
    // 클릭하면 상세로: 답글은 원본 트윗의 스레드로, 나머지(내 트윗·남의 트윗)는 자기 스레드로.
    // 이벤트·시스템 항목은 id가 없어서 자동으로 제외된다.
    // 상세 화면 안에서는 더 들어갈 곳이 없으므로 링크를 걸지 않는다.
    if (!opts.detail) {
      var target = item.kind === "reply" ? item.replyTo : item.id;
      if (target) div.dataset.detail = target;
    }
    var who = item.author === "me" ? "나" : (item.name || item.author);
    var handle = item.author === "me" ? "@me" : item.author;
    // 내가 리트윗한 항목임을 위에 표시한다 (실제 X의 "회원님이 재게시했습니다")
    var rtLabel = item.retweetedByMe
      ? '<div class="rt-label">' + Icons.svg("repeat-2") + "<span>내가 재게시했습니다</span></div>"
      : "";
    var metrics = item.kind === "me"
      ? metricEl("heart", item.likes) + metricEl("repeat-2", item.rts) + metricEl("chart-column", item.views)
      : "";
    // 속성 배지: 무엇이 오를지 누르기 전에 보인다.
    // 날짜는 이름·핸들 옆에 둔다(실제 X 구조). .meta에는 내 트윗의 수치만 남는다.
    div.innerHTML =
      '<div class="avatar"' + avatarAttr(item) + ">" + avatarInner(item) + "</div>" +
      '<div class="body">' + rtLabel + attrBadge(item) +
      '<span class="who"></span> <span class="handle"></span>' +
      '<span class="stamp">· ' + shortDate(item.day) + "</span>" +
      '<div class="text"></div>' +
      (metrics ? '<div class="meta">' + metrics + "</div>" : "") +
      reactRow(item) + "</div>";
    div.querySelector(".who").textContent = who;
    div.querySelector(".handle").textContent = handle;
    div.querySelector(".text").textContent = item.text;
    return div;
  }

  // "짤줍 님이" / "짤줍 님과 할말은함 님이" / "짤줍 님 외 78명이"
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
    // 알림에도 실제 그 계정의 프로필 사진을 쓴다 — 누가 눌렀는지 얼굴로 보이고, 누르면 프로필로 간다
    var avatars = item.actors.map(function (a) {
      return '<div class="avatar small" data-account="' + a.handle + '">' + pfp(a.handle) + "</div>";
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
    // 보관함까지 뒤진다 — 남의 트윗은 내 피드에 흘러온 것만 feed에 있고,
    // 프로필·검색에서 누른 트윗은 보관함에만 있을 수 있다.
    var tweet = allTweets(state).filter(function (t) { return t.id === detailTweetId; })[0];
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

  // 내 트윗 + 모든 계정의 보관함 + 피드의 답글을 한 묶음으로. id로 중복을 없앤다
  // (보관함 항목은 피드에도 있다). 트윗 상세 조회와 검색이 같은 묶음을 쓴다.
  function allTweets(state) {
    var seen = {}, out = [];
    function add(list) {
      (list || []).forEach(function (t) {
        if (!t || !t.text) return;
        var key = t.id || t.author + "|" + t.day + "|" + t.text;
        if (seen[key]) return;
        seen[key] = true;
        out.push(t);
      });
    }
    add(state.tweetLog);
    var boxes = state.npcTweets || {};
    Object.keys(boxes).forEach(function (h) { add(boxes[h]); });
    add(state.feed.filter(function (f) {
      return f.kind === "me" || f.kind === "npc" || f.kind === "reply";
    }));
    return out;
  }

  // 홈 타임라인 탭. 추천 = 내 타임라인 전부, 팔로우 중 = 팔로우한 계정이 쓴 글만.
  // (내 트윗·이벤트를 빼고 남의 글만 읽고 싶을 때 쓰는 필터다)
  var homeTab = "all";

  // 추천 탭의 섞인 순서. 실제 X처럼 시간순이 아니라 알고리즘 순으로 보이게 한다.
  // 순서를 기억해두는 이유: 매 렌더마다 다시 섞으면 좋아요 하나만 눌러도 타임라인이
  // 통째로 재배열돼 읽던 자리를 잃는다. 탭을 누를 때만 새로 섞는다(= 새로고침).
  // 항목 id를 키로 순위를 매긴다 — 새 트윗은 id가 없으니 맨 위(시간순)로 간다.
  var shuffleRank = null;

  function reshuffle(state) {
    shuffleRank = {};
    var ids = [];
    (state.feed || []).forEach(function (f) { if (f.id) ids.push(f.id); });
    (state.tweetLog || []).forEach(function (t) { if (t.id) ids.push(t.id); });
    // Fisher-Yates. 엔진의 rand가 아니라 Math.random을 쓴다 —
    // 이건 표시 순서일 뿐이라 세이브에 남지 않고 회귀 테스트도 걸지 않는다.
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    ids.forEach(function (id, i) { shuffleRank[id] = i; });
  }

  function setHomeTab(name, state) {
    // 추천 탭을 (다시) 누르면 새로 섞는다. 실제 X도 새로고침해야 순서가 바뀐다.
    if (name === "all" && state) reshuffle(state);
    homeTab = name;
    document.querySelectorAll(".home-tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.htab === name);
    });
  }

  // 내가 리트윗한 남의 트윗을 내 타임라인용 항목으로 만든다.
  // state.reacted에서 파생하므로 리트윗을 취소하면 자동으로 사라진다 — 따로 지울 게 없다.
  // 원본은 복사만 하고 건드리지 않는다(원본도 타임라인에 그대로 남아 있을 수 있다).
  function myRetweets(state) {
    var reacted = state.reacted || {};
    var ids = Object.keys(reacted).filter(function (id) { return reacted[id].rt; });
    if (!ids.length) return [];
    var byId = {};
    allTweets(state).forEach(function (t) { if (t.id) byId[t.id] = t; });
    return ids.filter(function (id) { return byId[id]; }).map(function (id) {
      var copy = {};
      Object.keys(byId[id]).forEach(function (k) { copy[k] = byId[id][k]; });
      // 타임스탬프는 원본 트윗 날짜 그대로, 정렬만 리트윗한 날로 한다
      copy.retweetedDay = reacted[id].rtDay || byId[id].day;
      copy.retweetedByMe = true;
      return copy;
    });
  }

  // 리트윗 항목은 리트윗한 날 기준으로 줄을 선다
  function sortDay(t) { return t.retweetedDay != null ? t.retweetedDay : t.day; }

  // 계정 한 줄. 레일 목록과 검색 결과가 같은 모양을 쓴다.
  // data-account를 달면 기존 클릭 위임이 프로필로 보낸다.
  function accountRow(npc) {
    var row = document.createElement("div");
    row.className = "rail-account";
    row.dataset.account = npc.handle;
    // 오른쪽 자리는 하나뿐이다 — 팔로우 중이면 팔로워 수를, 아니면 팔로우 버튼을 둔다.
    // 좁은 레일(21rem)에 둘 다 넣으면 이름이 뭉개진다. 내 계정은 팔로우 대상이 아니다.
    var canFollow = npc.handle !== ME.handle && !followingNow[npc.handle];
    row.innerHTML = '<div class="avatar small">' + pfp(npc.handle) + "</div>" +
      '<div class="rail-id"><b></b><span></span></div>' +
      (canFollow
        ? '<button class="follow-btn small" data-follow="' + npc.handle + '">팔로우</button>'
        : '<span class="rail-count"></span>');
    row.querySelector("b").textContent = npc.name;
    row.querySelector(".rail-id span").textContent = npc.handle;
    if (!canFollow)
      row.querySelector(".rail-count").textContent = (npc.followers || 0).toLocaleString();
    return row;
  }

  // ── 검색 ───────────────────────────────────────
  var searchQuery = "";
  var searchTab = "tweets";
  var searchReturnView = "home";

  function openSearch() {
    if (currentView !== "search") searchReturnView = currentView;
    switchView("search");
  }

  function closeSearch() { switchView(searchReturnView); }

  function setSearchQuery(q) { searchQuery = q; }
  function setSearchTab(t) {
    searchTab = t;
    document.querySelectorAll(".search-tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.stab === t);
    });
  }

  function renderSearch(state) {
    var q = searchQuery.trim().toLowerCase();
    // 레일 버튼에도 현재 검색어를 보여준다 (입력창은 검색 화면에만 있으므로)
    $("rail-search-text").textContent = searchQuery.trim() || "검색";

    var box = $("search-results");
    if (!q) {
      renderFeed(box, [], "트윗 내용이나 계정 이름으로 검색해보세요.");
      return;
    }
    if (searchTab === "tweets") {
      var hits = allTweets(state).filter(function (t) {
        return t.text.toLowerCase().indexOf(q) !== -1;
      }).sort(function (a, b) { return b.day - a.day; });
      renderFeed(box, hits, "일치하는 트윗이 없습니다.");
      return;
    }
    // 계정 탭: 이미 만난 계정만 — 못 만난 계정은 프로필에 트윗이 하나도 없다
    var npcs = ((typeof GAME_DATA !== "undefined" && GAME_DATA.npcs) || [])
      .filter(function (n) { return state.npcSeen && state.npcSeen[n.handle] != null; })
      .filter(function (n) {
        return (n.name + " " + n.handle + " " + (n.bio || "")).toLowerCase().indexOf(q) !== -1;
      })
      .sort(function (a, b) { return (b.followers || 0) - (a.followers || 0); });

    box.innerHTML = "";
    // 내 계정도 검색된다
    if (("나 @me " + ME.bio).toLowerCase().indexOf(q) !== -1) {
      box.appendChild(accountRow({ handle: "@me", name: ME.name, followers: state.followers }));
    }
    npcs.forEach(function (n) { box.appendChild(accountRow(n)); });
    if (!box.children.length) renderFeed(box, [], "일치하는 계정이 없습니다.");
  }

  // ── 팔로우 중 목록 ─────────────────────────────
  // 프로필의 "팔로우 중" 숫자로 들어온다. 뒤로가면 온 화면으로 (상세와 같은 규칙).
  var followingReturnView = "profile";
  function openFollowing() {
    if (currentView !== "following") followingReturnView = currentView;
    switchView("following");
  }
  function closeFollowing() { switchView(followingReturnView); }

  // 프로필의 숫자와 이 목록은 반드시 같은 곳에서 나와야 한다. state.following의 키를
  // 그냥 세면, 지금 데이터에 없는 핸들이 세이브에 남았을 때 "4인데 목록엔 3개"가 된다.
  // 팔로워 수가 큰 순 — 레일 목록과 같은 정렬이라 순서가 왔다갔다 하지 않는다.
  function followingList() {
    return ((typeof GAME_DATA !== "undefined" && GAME_DATA.npcs) || [])
      .filter(function (n) { return followingNow[n.handle]; })
      .sort(function (a, b) { return (b.followers || 0) - (a.followers || 0); });
  }

  function renderFollowing(state) {
    var box = $("following-list");
    box.innerHTML = "";
    var list = followingList();
    if (!list.length) {
      var none = document.createElement("div");
      none.className = "rail-empty";
      none.textContent = "팔로우 중인 계정이 없습니다.";
      box.appendChild(none);
      return;
    }
    list.forEach(function (n) { box.appendChild(accountRow(n)); });
  }

  // ── 쪽지 ───────────────────────────────────────
  // 프로필과 같은 방식이다: dmHandle이 null이면 대화방 목록, 핸들이면 그 대화방.
  var dmHandle = null;
  var dmReturnView = "home";

  function openDm(handle) {
    if (currentView !== "dm") dmReturnView = currentView;
    dmHandle = handle || null;
    switchView("dm");
  }
  // 대화방에서 뒤로 = 목록으로. 목록에서 뒤로는 온 화면으로 (트윗 상세와 같은 규칙)
  function dmBack() {
    if (dmHandle) { dmHandle = null; return; }
    switchView(dmReturnView);
  }
  function dmOpenHandle() { return dmHandle; }

  function dmItem(handle, room) {
    var npc = npcByHandle(handle);
    var last = room.msgs[room.msgs.length - 1];
    var row = document.createElement("div");
    row.className = "dm-item" + (room.msgs.length - room.seen > 0 ? " unread" : "");
    row.dataset.dm = handle;
    row.innerHTML = '<div class="avatar small">' + pfp(handle) + "</div>" +
      '<div class="dm-id"><div class="dm-who"><b></b><span class="handle"></span>' +
      '<span class="dm-day"></span></div><p class="dm-last"></p></div>';
    row.querySelector("b").textContent = npc.name;
    row.querySelector(".handle").textContent = handle;
    row.querySelector(".dm-day").textContent = last ? shortDate(last.day) : "";
    // "나: "를 붙여야 마지막 말이 누구 것인지 목록에서 바로 읽힌다
    row.querySelector(".dm-last").textContent =
      last ? (last.me ? "나: " : "") + last.text : "아직 나눈 말이 없습니다.";
    return row;
  }

  function renderDm(state) {
    var accounts = gameNow ? gameNow.dmAccounts() : [];
    var rooms = state.dms || {};
    // 스토리가 시작된 계정도 대화방이 있다. dmAccounts()는 accounts(선택지 풀)만 세므로
    // state.dms에 방이 있는 계정을 합친다 — 스토리 계정은 goStory가 방을 만든다.
    Object.keys(rooms).forEach(function (h) {
      if (accounts.indexOf(h) === -1) accounts.push(h);
    });
    var room = function (h) { return rooms[h] || { msgs: [], seen: 0 }; };
    var inRoom = dmHandle && accounts.indexOf(dmHandle) !== -1;

    $("dm-back").classList.toggle("hidden", !inRoom && currentView !== "dm");
    $("dm-title").textContent = inRoom ? npcByHandle(dmHandle).name : "쪽지";
    $("dm-list").classList.toggle("hidden", !!inRoom);
    $("dm-room").classList.toggle("hidden", !inRoom);

    if (!inRoom) {
      var box = $("dm-list");
      box.innerHTML = "";
      if (!accounts.length) {
        var none = document.createElement("div");
        none.className = "rail-empty";
        // 만나야 열린다 — 첫날부터 대화방이 놓여 있으면 발견의 재미가 없다
        none.textContent = "아직 쪽지를 나눌 계정이 없습니다.";
        box.appendChild(none);
        return;
      }
      // 최근에 말이 오간 방부터. 아직 안 연 방은 뒤로 밀린다.
      accounts.slice().sort(function (a, b) {
        var la = room(a).msgs, lb = room(b).msgs;
        return (lb.length ? lb[lb.length - 1].day : -1) - (la.length ? la[la.length - 1].day : -1);
      }).forEach(function (h) { box.appendChild(dmItem(h, room(h))); });
      return;
    }

    var msgs = $("dm-msgs");
    msgs.innerHTML = "";
    // 날짜는 바뀔 때만 찍는다 — 같은 날 말풍선마다 붙으면 "3월 27일"만 열 번 읽힌다
    var lastDay = null;
    room(dmHandle).msgs.forEach(function (m) {
      var el = document.createElement("div");
      el.className = "dm-msg" + (m.me ? " me" : "");
      el.innerHTML = (m.me ? "" : '<div class="avatar small">' + pfp(dmHandle) + "</div>") +
        '<div class="dm-bubble"><p></p><span class="dm-day"></span></div>';
      el.querySelector("p").textContent = m.text;
      if (m.day !== lastDay) {
        el.querySelector(".dm-day").textContent = shortDate(m.day);
        lastDay = m.day;
      }
      msgs.appendChild(el);
    });

    // 자유 입력이 아니라 고를 말이다. 어느 말이 남았는지는 엔진이 안다.
    var ch = $("dm-choices");
    ch.innerHTML = "";
    // 스토리 계정이면 스토리 선택지를, 아니면 기존 선택지 풀을 쓴다.
    // 대기 중(행동을 기다리는 중)이면 스토리 쪽이 빈 배열을 주고, 그러면 아무것도 안 그린다 —
    // "기다리는 중" 같은 표시를 넣지 말 것. 침묵이 이 이야기의 연출이다.
    // 스토리 계정인지는 엔진에 묻는다. "선택지가 비었는가"로 가르면 안 된다 —
    // 대기·지연 중에도 빈 배열이라, 그걸로 판단하면 기존 getDmChoices로 넘어가서
    // accounts에 없는 스토리 계정에서 터진다(실제로 겪음).
    var isStory = !!(gameNow && gameNow.isStoryAccount(dmHandle));
    var choices = !gameNow ? []
      : (isStory ? gameNow.storyChoices(dmHandle) : gameNow.getDmChoices(dmHandle));
    if (!choices.length) {
      // 스토리가 대기·지연 중일 때는 이 침묵 자체가 연출이다 — "더 할 말이…" 문구를 넣지 않는다.
      if (isStory || (gameNow && gameNow.dmAccounts().indexOf(dmHandle) === -1)) return;
      var done = document.createElement("p");
      done.className = "dm-done";
      done.textContent = "더 할 말이 떠오르지 않는다.";
      ch.appendChild(done);
      return;
    }
    choices.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "dm-say";
      // 스토리 선택은 dmSay 대신 storyIdx를 단다 — 기존 sendDm 핸들러로 새면 안 된다
      if (isStory) b.dataset.storyIdx = c.idx;
      else b.dataset.dmSay = c.idx;
      b.dataset.dmTo = dmHandle;
      // 두 목록 다 { idx, label }이다 — 엔진이 형식을 맞춰준다
      b.textContent = c.label;
      ch.appendChild(b);
    });
  }

  // ── 우측 레일 ──────────────────────────────────
  var RAIL_LIMIT = 6;      // 처음엔 이만큼만 보이고 "더 보기"로 전부 펼친다
  var RAIL_TRENDS = 5;
  var railExpanded = false;

  function toggleRailMore() { railExpanded = !railExpanded; }

  // 팔로우 중인(=이미 만난) 계정만 보여준다. 아직 못 만난 계정을 띄우면 발견의 재미가 사라지고,
  // 그 계정 프로필에는 아직 트윗이 하나도 없어서 눌러도 빈 화면이 뜬다.
  function renderRailAccounts(state) {
    // 만난 계정을 팔로우 여부로 가른다 — 아래 박스가 곧 팔로우할 거리다.
    var seen = ((typeof GAME_DATA !== "undefined" && GAME_DATA.npcs) || [])
      .filter(function (n) { return state.npcSeen && state.npcSeen[n.handle] != null; })
      .sort(function (a, b) { return (b.followers || 0) - (a.followers || 0); });
    var list = seen.filter(function (n) { return followingNow[n.handle]; });
    var suggest = seen.filter(function (n) { return !followingNow[n.handle]; });

    var box = $("rail-accounts");
    box.innerHTML = "";
    if (!list.length) {
      var none = document.createElement("div");
      none.className = "rail-empty";
      none.textContent = seen.length
        ? "팔로우 중인 계정이 없습니다." : "아직 만난 계정이 없습니다.";
      box.appendChild(none);
    }
    (railExpanded ? list : list.slice(0, RAIL_LIMIT)).forEach(function (n) {
      box.appendChild(accountRow(n));
    });
    var more = $("rail-more");
    more.classList.toggle("hidden", list.length <= RAIL_LIMIT);
    more.textContent = railExpanded ? "접기" : "더 보기";

    // 만났지만 아직 팔로우 안 한 계정. 없으면 박스째 숨긴다(빈 박스를 모양으로 두지 않는다).
    var sbox = $("rail-suggest");
    sbox.innerHTML = "";
    suggest.slice(0, RAIL_LIMIT).forEach(function (n) { sbox.appendChild(accountRow(n)); });
    $("rail-suggest-box").classList.toggle("hidden", !suggest.length);
  }

  // 트렌드는 꾸밈이 아니라 실제 집계다 — data.fills의 소재가 몇 번 트윗됐는지 센다.
  // 내 피드가 아니라 "네트워크 전체"(모든 계정의 보관함 + 내 트윗)를 센다. 실제 트렌드도
  // 내가 본 것만 세지 않고, 피드만 세면 첫날엔 표본이 10개뿐이라 대개 0건으로 비어 버린다.
  // 보관함 항목이 피드에도 있으므로 피드는 빼야 중복 집계가 안 된다.
  function renderRailTrends(state) {
    var fills = (typeof GAME_DATA !== "undefined" && GAME_DATA.fills) || {};
    var boxes = state.npcTweets || {};
    var corpus = state.tweetLog.slice();
    Object.keys(boxes).forEach(function (h) { corpus = corpus.concat(boxes[h]); });

    var hits = [];
    Object.keys(fills).forEach(function (cat) {
      fills[cat].forEach(function (topic) {
        var n = corpus.filter(function (t) {
          return t.text && t.text.indexOf(topic) !== -1;
        }).length;
        if (n > 0) hits.push({ cat: cat, topic: topic, n: n });
      });
    });
    hits.sort(function (a, b) { return b.n - a.n; });

    var box = $("rail-trends");
    box.innerHTML = "";
    if (!hits.length) {
      var quiet = document.createElement("div");
      quiet.className = "rail-empty";
      quiet.textContent = "타임라인이 조용합니다.";
      box.appendChild(quiet);
      return;
    }
    hits.slice(0, RAIL_TRENDS).forEach(function (h) {
      var row = document.createElement("div");
      row.className = "rail-trend";
      row.innerHTML = '<span class="cat"></span><b></b><span class="cnt"></span>';
      row.querySelector(".cat").textContent = h.cat + " · 실시간 트렌드";
      row.querySelector("b").textContent = h.topic;
      row.querySelector(".cnt").textContent = "트윗 " + h.n.toLocaleString() + "건";
      box.appendChild(row);
    });
  }

  var profileTab = "posts";
  // null = 내 프로필. 남의 프로필을 보는 중이면 그 계정의 핸들이 들어간다.
  var profileHandle = null;
  var profileReturnView = "home";

  function setProfileTab(name) {
    profileTab = name;
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === name);
    });
  }

  // 아바타 클릭 → 그 계정 프로필. handle이 나(또는 null)면 내 프로필로 간다.
  function openProfile(handle) {
    var target = !handle || handle === "me" || handle === "@me" ? null : handle;
    if (target === profileHandle && currentView === "profile") return;
    // 상세에서 상세로 넘어갈 때 원래 돌아갈 곳을 잃지 않는다 (트윗 상세와 같은 규칙)
    if (currentView !== "profile") profileReturnView = currentView;
    profileHandle = target;
    setProfileTab("posts"); // 계정을 바꾸면 탭을 처음으로 — 남의 답글 탭이 열린 채 넘어가면 헷갈린다
    switchView("profile");
  }

  function closeProfile() {
    profileHandle = null;
    switchView(profileReturnView);
  }

  function renderProfile(state) {
    var npc = profileHandle ? npcByHandle(profileHandle) : null;
    var who = npc || ME;
    var handle = npc ? npc.handle : ME.handle;

    $("profile-head").classList.toggle("hidden", !npc);
    if (npc) $("profile-head-name").textContent = npc.name;
    $("profile-meta").classList.toggle("hidden", !!npc); // 활동 일차는 내 기록이다
    // 남의 프로필을 보는 중엔 사이드바 '프로필'을 활성으로 두지 않는다 (실제 X와 동일)
    if (currentView === "profile") {
      document.querySelector('.nav-btn[data-view="profile"]').classList.toggle("active", !npc);
    }

    // 팔로우 버튼은 남의 프로필에만 — 내 계정은 팔로우 대상이 아니다
    var fbtn = $("profile-follow");
    fbtn.classList.toggle("hidden", !npc);
    // 쪽지는 말을 튼 계정에만 — 전 계정에 열면 대사가 448개 트윗만큼 필요하다
    // 스토리가 시작된 계정도 방이 있다 — state.dms에 방이 생겼으면 들어갈 수 있다
    var canDm = !!npc && gameNow &&
      (gameNow.dmAccounts().indexOf(handle) !== -1 || !!(state.dms || {})[handle]);
    $("profile-dm").classList.toggle("hidden", !canDm);
    if (canDm) $("profile-dm").dataset.dm = handle;
    if (npc) {
      var on = !!followingNow[handle];
      // 팔로우 중일 땐 두 글자를 다 넣고 CSS가 hover에서 갈아 끼운다 (실제 X와 동일).
      // 빨갛게만 변하고 "팔로잉"이 그대로면 무슨 일이 일어날지 안 읽힌다.
      fbtn.innerHTML = on
        ? '<span class="f-on"></span><span class="f-off"></span>' : "";
      if (on) {
        fbtn.querySelector(".f-on").textContent = "팔로잉";
        fbtn.querySelector(".f-off").textContent = "언팔로우";
      } else fbtn.textContent = "팔로우";
      fbtn.classList.toggle("following", on);
      fbtn.dataset.follow = handle;
    }

    $("profile-pfp").src = pfpSrc(handle);
    $("profile-name").textContent = who.name;
    $("profile-handle").textContent = handle;
    $("profile-bio").textContent = who.bio;
    $("profile-since").textContent = state.day + "일차";

    // 남의 계정은 "내가 본 것"만 보여준다 — 타임라인에 흐른 트윗과 내게 달아준 답글.
    var byAuthor = function (kind) {
      return state.feed.filter(function (f) { return f.kind === kind && f.author === handle; });
    };
    // 생성형 계정은 보관함이 그 계정의 타임라인이다 — 발견 전 과거 트윗까지 여기 있고,
    // feed에는 내가 실제로 본 것만 있다. 고정 목록 계정은 feed에서 걸러 쓴다.
    var box = state.npcTweets && state.npcTweets[handle];
    var posts = npc
      ? (box ? box.slice().reverse() : byAuthor("npc"))
      // 내 프로필 게시물 = 내가 쓴 트윗 + 내가 리트윗한 트윗 (실제 X와 동일)
      : state.tweetLog.concat(myRetweets(state))
          .sort(function (a, b) { return sortDay(b) - sortDay(a); });
    var replies = npc ? byAuthor("reply")
      : state.feed.filter(function (f) { return f.kind === "reply"; });

    $("profile-tweet-count").textContent = posts.length.toLocaleString();
    $("profile-followers").textContent =
      (npc ? (npc.followers || 0) : state.followers).toLocaleString();
    // 내가 몇 계정을 팔로우하는지는 내 프로필에서만 안다 — 남이 누굴 팔로우하는지는 데이터가 없다
    $("profile-following-count").classList.toggle("hidden", !!npc);
    $("profile-following").textContent = followingList().length.toLocaleString();

    renderFeed($("profile-tweets"),
      profileTab === "posts" ? posts : replies,
      profileTab === "posts"
        ? (npc ? "아직 이 계정의 트윗을 못 봤습니다." : "아직 쓴 글이 없습니다.")
        : (npc ? "내 트윗에 답글을 단 적이 없습니다." : "아직 받은 답글이 없습니다."));
  }

  // 반응 게이지 토스트. 누른 자리 근처에 떠서 5칸 중 몇 칸이 찼는지 보여준다.
  // 게이지를 상시로 두면 화면이 지저분하고, 없으면 진행이 안 보인다 — 누른 순간에만.
  var gainTimer = null;

  function showGain(gain, x, y) {
    if (!gain) return; // 이미 센 트윗은 아무 일도 안 일어났으니 띄우지 않는다
    var el = $("gain-toast");
    var style = STAT_STYLE[gain.stat] || { icon: "trending-up", tone: "ink" };
    // leveled면 게이지가 꽉 찬 상태로 보여준다 — count는 이미 0으로 돌아갔다
    var filled = gain.leveled ? GAIN_MAX : gain.count;
    var cells = "";
    for (var i = 0; i < GAIN_MAX; i++)
      cells += '<span class="cell' + (i < filled ? " on" : "") + '"></span>';
    // hidden 클래스를 className 조립에 포함시켜야 한다 — 통째로 덮어쓰므로
    // classList.remove만 따로 하면 다음 렌더에서 다시 사라진다.
    el.className = "gain-toast tone-" + style.tone + (gain.leveled ? " leveled" : "");
    el.innerHTML = Icons.svg(style.icon) +
      '<span class="gain-bar">' + cells + "</span>" +
      '<span class="gain-label">' + gain.stat + (gain.leveled ? " +1" : "") + "</span>";

    // 위치는 클릭 지점 근처. 화면 밖으로 나가지 않게 안쪽으로 밀어 넣는다.
    // className에서 hidden을 뗀 뒤에(위에서 이미 했다) 재야 offsetWidth가 0이 아니다.
    var pad = 8, w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.min(Math.max(pad, x - w / 2), window.innerWidth - w - pad);
    var top = y - h - 12;
    if (top < pad) top = y + 20; // 위가 좁으면 아래로 편다
    el.style.left = left + "px";
    el.style.top = top + "px";

    // 연타하면 새로 만들지 않고 이 하나를 옮긴다 — 여러 장이 쌓이면 화면을 덮는다.
    if (gainTimer) clearTimeout(gainTimer);
    gainTimer = setTimeout(function () { el.classList.add("hidden"); },
      gain.leveled ? 1600 : 1000); // 스탯이 오른 순간은 조금 더 머문다
  }

  function renderAll(state, game) {
    gameNow = game || gameNow;
    reactedNow = state.reacted || {}; // 이 렌더 동안 tweetEl이 참조한다
    followingNow = state.following || {}; // 같은 이유로 accountRow·renderProfile이 참조한다
    $("day").textContent = state.day + "일차 · " + dateLabel(state.day);
    $("followers").textContent = "팔로워 " + state.followers.toLocaleString();
    // 내가 리트윗한 남의 트윗도 내 타임라인에 뜬다. 리트윗한 날 기준으로 줄을 세운다 —
    // feed는 이미 최신순이고 Array.sort는 안정 정렬이라 같은 날 안의 순서는 유지된다.
    // 원본이 이미 타임라인에 흘렀다면 그건 빼고 리트윗 항목만 남긴다 — 안 그러면
    // 같은 트윗이 두 번 보인다(실제 X도 이 경우 하나로 합친다).
    var mine = myRetweets(state);
    var rtIds = {};
    mine.forEach(function (t) { rtIds[t.id] = true; });
    var timeline = state.feed
      .filter(function (f) {
        return TIMELINE_KINDS.indexOf(f.kind) !== -1 && !(f.id && rtIds[f.id]);
      })
      .concat(mine)
      .sort(function (a, b) { return sortDay(b) - sortDay(a); });
    if (homeTab === "following") {
      // 팔로우한 계정이 쓴 글만 — 내 트윗·이벤트는 뺀다. 내 리트윗은 남의 글이라 남긴다.
      timeline = timeline.filter(function (f) { return f.kind === "npc"; });
    } else if (shuffleRank) {
      // 추천 탭은 실제 X처럼 시간순이 아니다. 탭을 누를 때 정한 순서를 그대로 쓴다 —
      // 매 렌더마다 다시 섞으면 좋아요 하나에도 타임라인이 재배열된다.
      // 순위가 없는 항목(그 뒤에 생긴 새 트윗)은 맨 위로 — 방금 올린 글이 안 보이면 안 된다.
      timeline = timeline.slice().sort(function (a, b) {
        var ra = a.id && shuffleRank[a.id] != null ? shuffleRank[a.id] : -1;
        var rb = b.id && shuffleRank[b.id] != null ? shuffleRank[b.id] : -1;
        return ra - rb;
      });
    }
    renderFeed($("feed"), timeline,
      homeTab === "following"
        ? "팔로우한 계정의 글이 아직 없습니다."
        : "타임라인이 조용합니다. 첫 트윗을 써보세요.");
    renderProfile(state);
    renderTweetDetail(state);
    renderRailAccounts(state);
    renderRailTrends(state);
    renderSearch(state);
    renderFollowing(state);
    renderDm(state);
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
    renderFeed($("notif-list"), notifItemsOf(state), "아직 알림이 없습니다.");
    // 안 읽은 알림이 있으면 점만 띄운다 (개수는 안 쓴다 — 뱃지는 빈 span이다)
    $("notif-badge").classList.toggle("hidden", unreadNotifs(state) === 0);
    $("dm-badge").classList.toggle("hidden", !gameNow || gameNow.unreadDms() === 0);
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

  // 행동 카드의 아이콘. 그 행동이 올리는 스탯과 같은 아이콘을 쓴다 —
  // 스탯 패널과 맞춰두면 무엇이 오르는지가 아이콘만으로 읽힌다(속성 배지와 같은 원리).
  var ACTION_ICON = {
    daily: "calendar", write: "feather", meme: "laugh", trend: "trending-up",
    archive: "book-open", beef_watch: "flame", rest: "battery-medium",
    walk: "footprints", parttime: "wallet", sponsor: "wallet", promo: "user-plus"
  };

  // 효과를 칩 하나씩으로 쪼갠다. 한 줄 문자열로 뭉치면 뭐가 오르고 뭐가 내리는지 안 읽힌다.
  function effectChips(effects) {
    return Object.keys(effects || {}).map(function (k) {
      var v = effects[k];
      var style = STAT_STYLE[k] || { icon: "trending-up", tone: "ink" };
      var sign = v >= 0 ? "+" : "-";
      var chip = document.createElement("span");
      chip.className = "chip tone-" + style.tone + (v < 0 ? " down" : "");
      chip.innerHTML = Icons.svg(style.icon) + "<b></b>";
      chip.querySelector("b").textContent = sign + statValue(k, Math.abs(v));
      chip.title = k;
      return chip;
    });
  }

  function showActions(actions, onPick) {
    var list = $("action-list");
    list.innerHTML = "";
    actions.forEach(function (a) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "action-card" + (a.kind === "event" ? " event" : "");

      var icon = a.kind === "event" ? "zap" : (ACTION_ICON[a.id] || "calendar");
      card.innerHTML =
        '<span class="a-icon">' + Icons.svg(icon) + "</span>" +
        '<span class="a-body"><span class="a-label"></span>' +
        '<span class="a-chips"></span></span>';
      card.querySelector(".a-label").textContent = a.label;

      var chips = card.querySelector(".a-chips");
      if (a.kind === "event") {
        var tag = document.createElement("span");
        tag.className = "chip event-chip";
        tag.textContent = "이벤트 대응";
        chips.appendChild(tag);
      } else {
        var made = effectChips(a.effects);
        if (!made.length) {
          var none = document.createElement("span");
          none.className = "chip none";
          none.textContent = "변화 없음";
          chips.appendChild(none);
        } else made.forEach(function (c) { chips.appendChild(c); });
      }

      card.onclick = function () { onPick(a.id); };
      list.appendChild(card);
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
    ["home", "profile", "notif", "tweet", "search", "dm", "following"].forEach(function (v) {
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
    setProfileTab: setProfileTab, setHomeTab: setHomeTab, markNotifsRead: markNotifsRead,
    toggleStats: toggleStats, closeStats: closeStats,
    toggleAccountMenu: toggleAccountMenu, closeAccountMenu: closeAccountMenu,
    openTweetDetail: openTweetDetail, closeTweetDetail: closeTweetDetail,
    openProfile: openProfile, closeProfile: closeProfile,
    toggleRailMore: toggleRailMore,
    toggleRtMenu: toggleRtMenu, closeRtMenu: closeRtMenu, rtMenuOpen: rtMenuOpen,
    openSearch: openSearch, closeSearch: closeSearch,
    setSearchQuery: setSearchQuery, setSearchTab: setSearchTab,
    openDm: openDm, dmBack: dmBack, dmOpenHandle: dmOpenHandle,
    openFollowing: openFollowing, closeFollowing: closeFollowing,
    showGain: showGain };
})();
if (typeof module !== "undefined") module.exports = UI;
