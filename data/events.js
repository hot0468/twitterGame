var GAME_DATA = GAME_DATA || {};
GAME_DATA.events = [
  { id: "viral_humor",
    trigger: { "유머": ">=15", chance: 0.25 },
    stages: [
      { feed: ["어제는 내 유머 포스팅이 트렌드 1위에 올랐다!"],
        choices: [
          { label: "겸손하게 감사 인사하기", effects: { "팔로워": 300, "글빨": 1 }, next: "end" },
          { label: "계속 유머 포스팅 밀어붙이기", effects: { "팔로워": "유머*30", "논란성": 3 }, next: "end" }
        ] }
    ] },
  { id: "backlash",
    trigger: { "논란성": ">=20", chance: 0.4 },
    stages: [
      { feed: ["비평가 불사자(@fire_starter)가 내 포스팅을 비판하며 \"이건 그냥 멍청한 짓\"이라고 댓글 달았다"],
        choices: [
          { label: "선처 요청하기", effects: { "팔로워": -200, "멘탈": -10, "논란성": -10 }, next: "end" },
          { label: "보상 리플 달기", requires: { "멘탈": 30 }, effects: { "논란성": 10, "멘탈": -5 }, next: 1 },
          { label: "무시하기", effects: { "팔로워": -50, "논란성": -5 }, next: "end" }
        ] },
      { feed: ["시간이 지나자 내 명확한 반박에 비평가들이 조용해졌다"],
        choices: [
          { label: "글로 분명히 반박하기", requires: { "글빨": 15 }, effects: { "팔로워": 500, "논란성": 5 }, next: "end" },
          { label: "감정적으로 대응", effects: { "팔로워": 200, "논란성": 20, "멘탈": -15 }, next: "end" }
        ] }
    ] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
