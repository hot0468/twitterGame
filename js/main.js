(function () {
  var SAVE_KEY = "twitterGame.save";

  function load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  }
  function save(state) { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

  var game = Engine.create(GAME_DATA, load());
  var turnDone = false;

  function refresh() {
    UI.renderAll(game.getState());
    UI.setTurnDone(turnDone);
  }

  document.getElementById("compose").onclick = function () {
    if (turnDone) return;
    UI.showActions(game.getActions(), function (actionId) {
      UI.hideActions();
      var result = game.advanceTurn(actionId);
      turnDone = true;
      save(game.getState());
      refresh();
      if (result.ending) {
        UI.showEnding(result.ending, newGame);
      }
    });
  };

  document.getElementById("next-day").onclick = function () {
    turnDone = false;
    refresh();
  };

  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.onclick = function () { UI.switchView(btn.dataset.view); };
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
