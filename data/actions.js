var GAME_DATA = GAME_DATA || {};
GAME_DATA.fills = {
  "밈소재": ["고양이가 키보드 밟은 썰", "지하철 빌런 목격담", "편의점 신상 리뷰", "오늘자 실트 근황"],
  "떡밥": ["민초 논쟁", "탕수육 부먹찍먹", "티켓팅 대란", "번역기 오역 사건"]
};

// 행동 하나 = 하루. effects는 행동만 해도 무조건 적용되고,
// tweet.effects는 "이걸 트윗할까?"에서 트윗을 택했을 때만 적용된다.
// 그래서 리스크(논란성·멘탈 소모)는 전부 tweet 쪽에 둔다 — 트윗하지 않으면 안전하지만 팔로워도 안 는다.
GAME_DATA.actions = [
  { id: "daily", label: "그냥 하루 보내기",
    effects: {},
    tweet: { category: "daily", effects: { "팔로워": "1 + 글빨" },
      templates: ["오늘 하루도 무사히 끝. {밈소재} 때문에 웃었다", "별일 없이 산다. 그게 제일 어렵다"] } },

  { id: "write", label: "글쓰기 연습",
    effects: { "글빨": 2 },
    tweet: { category: "daily", effects: { "팔로워": "글빨*2" },
      templates: ["오늘은 하루종일 필사했다. 손목 아파", "문장 100개 고쳐 썼다. 아직 마음에 안 든다"] } },

  { id: "meme", label: "밈 공부",
    effects: { "유머": 2 },
    tweet: { category: "humor", effects: { "팔로워": "유머*3 + 글빨" },
      templates: ["{밈소재} 실화냐 ㅋㅋㅋㅋ", "방금 {밈소재} 봤는데 아직도 웃고 있음"] } },

  { id: "trend", label: "트렌드 조사",
    effects: { "감각": 2 },
    tweet: { category: "info", effects: { "팔로워": "감각*3" },
      templates: ["실트 3시간 관찰 일지: 요즘 먹히는 소재 정리", "지금 타임라인 분위기 요약해봄"] } },

  { id: "archive", label: "자료 정리", requires: { "글빨": 10 },
    effects: { "글빨": 1 },
    tweet: { category: "info", effects: { "팔로워": "글빨*4" },
      templates: ["[정보] 알아두면 쓸모있는 꿀팁 정리 (1/n)", "이거 모르는 사람 많던데, 정리해드림"] } },

  { id: "beef_watch", label: "떡밥 지켜보기", requires: { "감각": 10 },
    effects: { "감각": 1 },
    tweet: { category: "bait", effects: { "팔로워": "감각*5 + 유머*2", "논란성": 5, "멘탈": -5 },
      templates: ["{떡밥}, 제 생각은 좀 다릅니다만", "{떡밥} 이거 다들 잘못 알고 있음"] } },

  { id: "rest", label: "휴식",
    effects: { "멘탈": 15 },
    tweet: { category: "daily", effects: { "팔로워": 1 },
      templates: ["오늘은 폰 끄고 쉼. 내일 봐요", "잠을 12시간 잤다. 인간이 됐다"] } }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
