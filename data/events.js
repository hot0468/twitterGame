var GAME_DATA = GAME_DATA || {};
GAME_DATA.events = [
  { id: "viral_humor",
    trigger: { "유머": ">=15", chance: 0.25 },
    stages: [
      { feed: ["어젯밤 내 유머 트윗이 알고리즘을 타고 퍼지기 시작했다!"],
        choices: [
          { label: "겸손하게 감사 트윗", effects: { "팔로워": 300, "글빨": 1 }, next: "end" },
          { label: "후속 드립 연달아 투척", effects: { "팔로워": "유머*30", "논란성": 3 }, next: "end" }
        ] }
    ] },
  { id: "backlash",
    trigger: { "논란성": ">=20", chance: 0.4 },
    stages: [
      { feed: ["빅계정 불씨(@fire_starter)가 내 트윗을 인용하며 저격했다: \"이 사람 말 다 틀렸음\""],
        choices: [
          { label: "사과문 올리기", effects: { "팔로워": -200, "멘탈": -10, "논란성": -10 }, next: "end" },
          { label: "맞받아치기", requires: { "멘탈": 30 }, effects: { "논란성": 10, "멘탈": -5 }, next: 1 },
          { label: "무시한다", effects: { "팔로워": -50, "논란성": -5 }, next: "end" }
        ] },
      { feed: ["설전이 실시간 트렌드에 올랐다. 구경꾼들이 몰려온다"],
        choices: [
          { label: "논리로 깔끔하게 마무리", requires: { "글빨": 15 }, effects: { "팔로워": 500, "논란성": 5 }, next: "end" },
          { label: "감정적으로 폭발", effects: { "팔로워": 200, "논란성": 20, "멘탈": -15 }, next: "end" }
        ] }
    ] },

  // ── 빚 이벤트 ──
  // 돈이 마이너스로 떨어지면 발동한다. 게임 오버는 없고, 대신 회생 수단과 그 대가를 고른다.
  // 각자 한 번만 발동하므로(eventHistory) 무한 구제책이 아니다 — 결국 계정을 키워야 한다.
  { id: "loan_offer",
    trigger: { "돈": "<0", chance: 0.5 },
    stages: [
      { feed: ["DM이 왔다: \"@me님, 크리에이터 전용 급전 대출 가능합니다. 정산금 담보로 당일 입금\""],
        choices: [
          // 목돈이 당장 들어오지만 이자 압박이 컨디션을 깎는다(멘탈은 성장 배수라 실제로 아프다)
          { label: "급전 대출을 받는다", effects: { "돈": 800000, "멘탈": -12 }, next: "end" },
          { label: "거절하고 알바로 버틴다", effects: { "돈": 80000, "멘탈": -6 }, next: "end" },
          // 빚을 소재로 쓰는 길. 돈은 안 들어오지만 사람이 붙는다
          { label: "빚졌다고 솔직하게 트윗한다", effects: { "팔로워": "팔로워*0.03 + 150", "논란성": 3 }, next: "end" }
        ] }
    ] },

  { id: "debt_deep",
    trigger: { "돈": "<=-500000", chance: 0.6 },
    stages: [
      { feed: ["대부업체가 공개 리플로 상환을 독촉했다: \"@me 님, 연락 좀 받으시죠\""],
        choices: [
          { label: "광고 트윗을 몰아서 올린다", effects: { "돈": "400000 + 팔로워*3", "논란성": 15, "멘탈": -8 }, next: "end" },
          { label: "계정을 잠그고 알바만 한다", effects: { "돈": 500000, "팔로워": "-(팔로워*0.05)", "멘탈": 10 }, next: "end" },
          { label: "무시하고 트윗을 계속한다", effects: { "멘탈": -15, "논란성": 5 }, next: "end" }
        ] }
    ] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
