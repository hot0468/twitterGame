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

  function closePopovers() { UI.closeStats(); UI.closeAccountMenu(); }

  document.querySelectorAll(".nav-btn[data-view]").forEach(function (btn) {
    btn.onclick = function () {
      UI.switchView(btn.dataset.view);
      closePopovers();
      // 알림을 열면 읽은 것으로 처리한다 — 뱃지가 사라지고 그 상태가 저장돼야 한다
      if (btn.dataset.view === "notif") {
        UI.markNotifsRead(game.getState());
        save(game.getState());
      }
      refresh();
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

  // 트윗 클릭 → 상세. 위임으로 걸어야 다시 렌더된 트윗에도 계속 붙는다
  document.addEventListener("click", function (e) {
    var target = e.target.closest(".tweet[data-detail]");
    if (!target) return;
    closePopovers();
    UI.openTweetDetail(target.dataset.detail);
    refresh();
  });

  document.getElementById("detail-back").onclick = function () { UI.closeTweetDetail(); };

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.onclick = function () { UI.setProfileTab(btn.dataset.tab); refresh(); };
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
