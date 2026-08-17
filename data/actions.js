var GAME_DATA = GAME_DATA || {};
GAME_DATA.fills = {
  "밈소재": ["고양이가 키보드 밟은 썰", "지하철 빌런 목격담", "편의점 신상 리뷰", "오늘자 실트 근황"],
  "떡밥": ["민초 논쟁", "탕수육 부먹찍먹", "티켓팅 대란", "번역기 오역 사건"]
};
GAME_DATA.actions = [
  { id: "tweet_daily", type: "tweet", category: "daily", label: "일상 트윗",
    effects: { "팔로워": "1 + 글빨" },
    templates: ["오늘 하루도 무사히 끝. {밈소재} 때문에 웃었다", "별일 없이 산다. 그게 제일 어렵다"] },
  { id: "tweet_humor", type: "tweet", category: "humor", label: "유머 트윗",
    effects: { "팔로워": "유머*3 + 글빨" },
    templates: ["{밈소재} 실화냐 ㅋㅋㅋㅋ", "방금 {밈소재} 봤는데 아직도 웃고 있음"] },
  { id: "tweet_info", type: "tweet", category: "info", label: "정보글 트윗",
    requires: { "글빨": 10 },
    effects: { "팔로워": "글빨*4" },
    templates: ["[정보] 알아두면 쓸모있는 꿀팁 정리 (1/n)", "이거 모르는 사람 많던데, 정리해드림"] },
  { id: "tweet_bait", type: "tweet", category: "bait", label: "떡밥 참전",
    requires: { "감각": 10 },
    effects: { "팔로워": "감각*5 + 유머*2", "논란성": 5, "멘탈": -5 },
    templates: ["{떡밥}, 제 생각은 좀 다릅니다만", "{떡밥} 이거 다들 잘못 알고 있음"] },
  { id: "train_writing", type: "train", label: "글쓰기 연습", effects: { "글빨": 2 },
    templates: ["오늘은 하루종일 필사했다. 손목 아파"] },
  { id: "train_meme", type: "train", label: "밈 공부", effects: { "유머": 2 },
    templates: ["인터넷 밈 아카이브 정주행 완료"] },
  { id: "train_trend", type: "train", label: "트렌드 조사", effects: { "감각": 2 },
    templates: ["실트 3시간 관찰 일지 작성 중"] },
  { id: "rest", type: "train", label: "휴식", effects: { "멘탈": 15 },
    templates: ["오늘은 폰 끄고 쉼. 내일 봐요"] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
