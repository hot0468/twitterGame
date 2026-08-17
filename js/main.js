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

  // 행동을 실제로 적용하고 하루를 넘긴다. 날짜 팝업이 닫힌 뒤 엔딩을 띄운다.
  function resolveTurn(actionId, doTweet) {
    var result = game.advanceTurn(actionId, doTweet);
    save(game.getState());
    refresh();
    UI.showDayTransition(game.getState().day, function () {
      if (result.ending) UI.showEnding(result.ending, newGame);
    });
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

  document.querySelectorAll(".nav-btn[data-view]").forEach(function (btn) {
    btn.onclick = function () { UI.switchView(btn.dataset.view); UI.closeStats(); };
  });

  document.getElementById("stats-toggle").onclick = function (e) {
    e.stopPropagation();
    UI.toggleStats();
  };

  // 팝오버 밖을 누르면 닫는다 (토글 버튼 자신은 위에서 stopPropagation)
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".stats-strip")) UI.closeStats();
  });

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.onclick = function () { UI.setProfileTab(btn.dataset.tab); refresh(); };
  });

  function newGame() {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
  document.getElementById("new-game").onclick = function () {
    if (confirm("저장된 게임을 지우고 새로 시작할까요?")) newGame();
  };

  var st = game.getState();
  if (st.ending) {
    var hit = GAME_DATA.endings.list.filter(function (e) { return e.id === st.ending; })[0];
    UI.showEnding({ id: hit.id, title: hit.title, text: hit.text }, newGame);
  }
  refresh();
})();
