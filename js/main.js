(function () {
  var SAVE_KEY = "twitterGame.save";

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY));
      return s && s.stats ? s : null;
    } catch (e) { return null; }
  }
  function save(state) { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

  Icons.mount();

  var game = Engine.create(GAME_DATA, load());
  // 새 게임이면 create()가 첫 타임라인(팔로우 계정·그들의 최근 트윗)을 만든다.
  // 바로 저장해두지 않으면 첫 턴을 돌리기 전에 새로고침할 때마다 다시 뽑혀서
  // 팔로우한 계정이 바뀐다. 시작 상태도 세이브의 일부다.
  save(game.getState());
  var pendingAction = null;

  function refresh() { UI.renderAll(game.getState()); }

  // 행동을 실제로 적용하고 하루를 넘긴다.
  // 날짜 전환은 팝업 없이 조용히 넘어간다 — 주급날에만 정산 팝업을 띄우고, 닫힌 뒤 연출·엔딩.
  function resolveTurn(actionId, doTweet) {
    var result = game.advanceTurn(actionId, doTweet);
    save(game.getState());
    refresh();
    // 트윗을 한 턴에만 카운트업 — 안 그러면 지난 트윗 숫자가 다시 올라간다
    var posted = result.feedItems.filter(function (f) { return f.kind === "me"; }).length > 0;
    function finish() {
      if (posted) UI.animateLatestMetrics();
      if (result.ending) UI.showEnding(result.ending, newGame);
    }
    if (result.settlement) UI.showSettlement(result.settlement, finish);
    else finish();
  }

  document.getElementById("compose").onclick = function () {
    if (game.getState().ending) return;
    UI.showActions(game.getActions(), function (actionId) {
      UI.hideActions();
      // 이벤트 대응은 그 자체가 반응이라 트윗 여부를 묻지 않는다
      if (actionId.indexOf("event:") === 0) { resolveTurn(actionId, false); return; }
      pendingAction = actionId;
      UI.openTweetPrompt(game.previewAction(actionId));
    });
  };

  document.getElementById("compose-close").onclick = function () { UI.hideActions(); };
  document.getElementById("compose-modal").onclick = function (e) {
    if (e.target === this) UI.hideActions(); // 딤 영역 클릭 시 닫기
  };

  // 트윗 여부는 반드시 골라야 한다(딤 클릭으로 안 닫힘) — 안 그러면 행동이 적용되지 않은 채 남는다
  document.getElementById("tweet-post").onclick = function () {
    UI.closeTweetPrompt();
    resolveTurn(pendingAction, true);
  };
  document.getElementById("tweet-skip").onclick = function () {
    UI.closeTweetPrompt();
    resolveTurn(pendingAction, false);
  };

  var focusSearch = false;
  function closePopovers() { UI.closeStats(); UI.closeAccountMenu(); }

  document.querySelectorAll(".nav-btn[data-view]").forEach(function (btn) {
    btn.onclick = function () {
      // 프로필 탭은 항상 내 프로필로 — 남의 프로필을 보다 눌렀을 때 그 계정이 남으면 안 된다
      if (btn.dataset.view === "profile") UI.openProfile(null);
      // 검색은 입력창에 포커스까지 줘야 바로 타이핑할 수 있다 (모바일의 유일한 입구)
      else if (btn.dataset.view === "search") { UI.openSearch(); focusSearch = true; }
      else UI.switchView(btn.dataset.view);
      closePopovers();
      // 알림을 열면 읽은 것으로 처리한다 — 뱃지가 사라지고 그 상태가 저장돼야 한다
      if (btn.dataset.view === "notif") {
        UI.markNotifsRead(game.getState());
        save(game.getState());
      }
      refresh();
      // 렌더가 끝난 뒤에 포커스를 준다 (숨어 있던 뷰는 focus를 못 받는다)
      if (focusSearch) { focusSearch = false; searchInput.focus(); }
    };
  });

  // 두 팝오버는 배타적 — 하나를 열면 다른 하나는 닫는다
  document.getElementById("stats-toggle").onclick = function (e) {
    e.stopPropagation();
    UI.closeAccountMenu();
    UI.toggleStats();
  };

  document.getElementById("account").onclick = function (e) {
    e.stopPropagation();
    UI.closeStats();
    UI.toggleAccountMenu();
  };

  // 팝오버 밖을 누르면 닫는다 (토글 버튼 자신은 위에서 stopPropagation)
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".stats-strip")) UI.closeStats();
    if (!e.target.closest(".account-menu")) UI.closeAccountMenu();
  });

  // 트윗·아바타 클릭 → 상세/프로필. 위임으로 걸어야 다시 렌더된 항목에도 계속 붙는다.
  // 아바타는 트윗 안에 있으므로 반드시 먼저 본다 — 안 그러면 아바타를 눌러도 트윗 상세로 새어나간다.
  document.addEventListener("click", function (e) {
    var account = e.target.closest("[data-account]");
    if (account) {
      closePopovers();
      UI.openProfile(account.dataset.account);
      refresh();
      return;
    }
    var target = e.target.closest(".tweet[data-detail]");
    if (!target) return;
    closePopovers();
    UI.openTweetDetail(target.dataset.detail);
    refresh();
  });

  document.getElementById("detail-back").onclick = function () { UI.closeTweetDetail(); };
  document.getElementById("profile-back").onclick = function () { UI.closeProfile(); };
  document.getElementById("rail-more").onclick = function () { UI.toggleRailMore(); refresh(); };

  // 프로필 탭만 — 검색 탭은 같은 .tab-btn 모양이지만 다른 핸들러를 쓴다
  document.querySelectorAll(".profile-tabs .tab-btn[data-tab]").forEach(function (btn) {
    btn.onclick = function () { UI.setProfileTab(btn.dataset.tab); refresh(); };
  });

  // ── 검색 ──
  var searchInput = document.getElementById("search-input");

  function gotoSearch() {
    UI.openSearch();
    refresh();
    searchInput.focus();
  }

  document.getElementById("rail-search").onclick = gotoSearch;
  document.getElementById("search-back").onclick = function () { UI.closeSearch(); refresh(); };
  // 입력할 때마다 바로 걸러준다. refresh()가 입력창 값을 건드리지 않으므로 포커스가 유지된다
  searchInput.oninput = function () { UI.setSearchQuery(searchInput.value); refresh(); };
  document.querySelectorAll(".search-tab").forEach(function (btn) {
    btn.onclick = function () { UI.setSearchTab(btn.dataset.stab); refresh(); };
  });

  function newGame() {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
  // 로그아웃 = 이 계정의 기록을 버리고 새 계정으로 시작. 되돌릴 수 없으므로 확인을 받는다
  document.getElementById("logout").onclick = function () {
    UI.closeAccountMenu();
    if (confirm("로그아웃하면 이 계정의 기록이 모두 사라지고 새 계정으로 시작합니다.\n계속할까요?")) newGame();
  };

  var st = game.getState();
  if (st.ending) {
    var hit = GAME_DATA.endings.list.filter(function (e) { return e.id === st.ending; })[0];
    UI.showEnding({ id: hit.id, title: hit.title, text: hit.text }, newGame);
  }
  refresh();
})();
