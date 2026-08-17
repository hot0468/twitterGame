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
    ] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
