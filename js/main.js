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

  function refresh() { UI.renderAll(game.getState(), game); }

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

  // 게시하기 — 데스크톱은 사이드바 버튼, 모바일은 우하단 + 플로팅 버튼(같은 요소다).
  // 컴포즈 박스가 홈에만 있던 때와 달리 이제 어느 화면에서도 행동할 수 있다.
  document.getElementById("post-btn").onclick = function () {
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
  // 팝오버는 서로 배타적이다 — 하나를 열면 나머지는 닫는다
  function closePopovers() { UI.closeStats(); UI.closeAccountMenu(); UI.closeRtMenu(); }

  document.querySelectorAll(".nav-btn[data-view]").forEach(function (btn) {
    btn.onclick = function () {
      // 프로필 탭은 항상 내 프로필로 — 남의 프로필을 보다 눌렀을 때 그 계정이 남으면 안 된다
      if (btn.dataset.view === "profile") UI.openProfile(null);
      // 검색은 입력창에 포커스까지 줘야 바로 타이핑할 수 있다 (모바일의 유일한 입구)
      else if (btn.dataset.view === "search") { UI.openSearch(); focusSearch = true; }
      // 쪽지도 항상 목록으로 — 열어둔 대화방이 남아 있으면 어디로 들어왔는지 헷갈린다
      else if (btn.dataset.view === "dm") UI.openDm(null);
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
    if (UI.closeRtMenu()) refresh(); // 리트윗 메뉴는 렌더로 그려지므로 다시 그려야 사라진다
    UI.toggleStats();
  };

  document.getElementById("account").onclick = function (e) {
    e.stopPropagation();
    UI.closeStats();
    if (UI.closeRtMenu()) refresh();
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
    // 반응 버튼이 트윗 안에 있으므로 제일 먼저 본다 — 안 그러면 눌러도 트윗 상세로 새어나간다.
    // 하루를 소모하지 않으므로 resolveTurn을 거치지 않는다.
    // 리트윗은 실제 X처럼 바로 토글하지 않고 메뉴를 연다. 좋아요는 바로 토글.
    var rtBtn = e.target.closest('[data-react="rt"]');
    if (rtBtn) {
      // closePopovers()를 쓰면 안 된다 — 그게 리트윗 메뉴까지 닫아서
      // 같은 버튼을 다시 눌러도 항상 열리기만 한다.
      UI.closeStats();
      UI.closeAccountMenu();
      UI.toggleRtMenu(rtBtn.dataset.reactId);
      refresh();
      return;
    }
    var rtDo = e.target.closest("[data-rt-do]");
    if (rtDo) {
      var rtRes = game.toggleReaction(rtDo.dataset.rtId, "rt");
      UI.closeRtMenu();
      save(game.getState());
      refresh();
      // 렌더 뒤에 띄운다 — 토스트는 피드 바깥(#gain-toast)이라 지워지진 않지만
      // 배지의 흐려짐과 순서를 맞춘다.
      if (rtRes) UI.showGain(rtRes.gain, e.clientX, e.clientY);
      return;
    }
    // 메뉴 밖을 눌렀으면 닫는다. 그 클릭의 원래 동작(상세 이동 등)은 이어서 처리한다.
    var rtClosed = UI.closeRtMenu();

    // 쪽지: 대화방 열기(목록 행·프로필 버튼)와 말 걸기.
    // 방을 열면 읽은 것으로 처리한다 — 알림과 같은 규칙이다.
    // 스토리 선택. 기존 dm-say와 같은 data-dm-to를 쓰지만 속성이 달라 서로 안 겹친다.
    // 하루를 안 쓰므로 resolveTurn을 거치지 않는다(기존 DM과 같다).
    var storyBtn = e.target.closest("[data-story-idx]");
    if (storyBtn) {
      game.sendStory(storyBtn.dataset.dmTo, Number(storyBtn.dataset.storyIdx));
      save(game.getState());
      refresh();
      return;
    }
    var dmSay = e.target.closest("[data-dm-say]");
    if (dmSay) {
      game.sendDm(dmSay.dataset.dmTo, Number(dmSay.dataset.dmSay));
      save(game.getState());
      refresh();
      return;
    }
    var dmOpen = e.target.closest("[data-dm]");
    if (dmOpen) {
      closePopovers();
      game.markDmRead(dmOpen.dataset.dm);
      UI.openDm(dmOpen.dataset.dm);
      save(game.getState());
      refresh();
      return;
    }
    // 팔로우 버튼은 [data-account] 행 안에 있다 — 먼저 잡지 않으면 눌러도 프로필만 열린다
    // (반응 버튼·아바타와 같은 함정). 하루를 안 쓰므로 refresh만 하면 된다.
    var follow = e.target.closest("[data-follow]");
    if (follow) {
      game.toggleFollow(follow.dataset.follow);
      save(game.getState());
      refresh();
      return;
    }
    var react = e.target.closest("[data-react]");
    if (react) {
      var res = game.toggleReaction(react.dataset.reactId, react.dataset.react);
      save(game.getState());
      refresh();
      if (res) UI.showGain(res.gain, e.clientX, e.clientY);
      return;
    }
    var account = e.target.closest("[data-account]");
    if (account) {
      closePopovers();
      UI.openProfile(account.dataset.account);
      refresh();
      return;
    }
    var target = e.target.closest(".tweet[data-detail]");
    if (!target) { if (rtClosed) refresh(); return; }
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

  // 홈 타임라인 탭 (추천 / 팔로우 중)
  // 추천 탭은 누를 때마다 순서를 새로 섞는다(실제 X의 새로고침) — state가 필요하다.
  document.querySelectorAll(".home-tab").forEach(function (btn) {
    btn.onclick = function () {
      UI.setHomeTab(btn.dataset.htab, game.getState());
      refresh();
    };
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
  document.getElementById("dm-back").onclick = function () { UI.dmBack(); refresh(); };
  document.getElementById("profile-following-count").onclick = function () {
    UI.openFollowing(); refresh();
  };
  document.getElementById("following-back").onclick = function () {
    UI.closeFollowing(); refresh();
  };
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
