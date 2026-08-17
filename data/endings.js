var GAME_DATA = GAME_DATA || {};
GAME_DATA.endings = {
  threshold: 10000,
  list: [
    { id: "cyber_wrecker", title: "사이버렉카", condition: { "논란성": ">=50" },
      text: "당신은 논란을 연료로 달리는 계정이 되었다. 팔로워는 많지만, 절반은 안티다." },
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
