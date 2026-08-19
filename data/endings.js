var GAME_DATA = GAME_DATA || {};
// 목표는 100만 팔로워. 도달하는 순간 아래 목록에서 조건이 맞는 첫 항목이 엔딩이 된다
// (list 순서 = 우선순위, 마지막 항목은 조건이 없어야 무조건 하나는 나온다).
GAME_DATA.endings = {
  threshold: 1000000,
  list: [
    // 임계값 300: 어그로 전략(의도된 사이버렉카 경로)은 논란성 740까지 쌓아 여전히 도달하고,
    // bait 트윗을 우선 노려 반응(좋아요)만 그라인딩해도 233이 상한이라 도달하지 못한다.
    // 반응으로도 논란성이 쌓이게 되면서 예전 50은 bait 트윗을 챙겨보기만 해도 걸리는 값이라
    // topStat 엔딩 3종이 막혔다 — 두 경로를 실측(test/sim.js)하고 그 사이로 올렸다.
    //
    // 233을 실제로 누르는 건 dailyCap이 아니라 bait 계정 공급량이다: bait 계정 3개
    // (@fire_starter @argue_archive @ad_detector) × GAME_DATA.timeline.gen.perDay(2) =
    // 하루에 새로 생기는 bait 트윗 6개뿐이라 dailyCap(8) 슬롯이 남아돈다(dailyCap을 늘려도
    // 233은 거의 안 오른다 — 늘려서 실측할 것). 반응만으로 도달 가능한 이론상 최대는 273
    // (218일 × bait 6개 ÷ perPoint 5, 보관함 max:24 축출 전 기준)이고 실측 233은 그 축출 때문에
    // 낮다. **bait 계정 수를 늘리거나 perDay를 올리면** 하루 공급이 늘어 233이 올라가고
    // 결국 300을 넘을 수 있다 — 그 두 노브를 건드리면 test/sim.js의 반응그라인딩으로 반드시
    // 재측정할 것.
    { id: "cyber_wrecker", title: "사이버렉카", condition: { "논란성": ">=300" },
      text: "당신은 논란을 연료로 달리는 계정이 되었다. 팔로워는 많지만, 절반은 안티다." },
    // 빚은 게임 오버가 아니다 — 마이너스 통장으로도 100만은 찍을 수 있고, 그건 그것대로 엔딩이다
    { id: "debt_star", title: "빚쟁이 스타", condition: { "돈": "<0" },
      text: "팔로워 100만. 그리고 마이너스 통장. 다음 주 정산금은 이미 빚쟁이가 예약해뒀다." },
    { id: "author", title: "등단 작가", condition: { topStat: "글빨" },
      text: "출판사에서 DM이 왔다. 트위터 글쟁이에서 진짜 작가로." },
    { id: "comedian", title: "밈 장인", condition: { topStat: "유머" },
      text: "당신의 드립은 이제 초등학생도 쓴다. 인터넷 유머사의 한 페이지가 되었다." },
    { id: "trend_setter", title: "트렌드세터", condition: { topStat: "감각" },
      text: "당신이 언급하면 그게 곧 유행이 된다. 브랜드 협업 제안이 쏟아진다." },
    { id: "influencer", title: "그냥 유명한 사람",
      text: "특별한 건 없지만 어쨌든 유명해졌다. 그것도 재능이다." }
  ]
};
if (typeof module !== "undefined") module.exports = GAME_DATA;
