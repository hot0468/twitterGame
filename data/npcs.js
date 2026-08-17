var GAME_DATA = GAME_DATA || {};
GAME_DATA.npcs = [
  { handle: "@meme_bot99", name: "밈수집가", reactsTo: ["humor", "daily"],
    replies: ["ㅋㅋㅋㅋㅋ 미쳤네", "이거 완전 저장각", "RT 박고 갑니다"] },
  { handle: "@info_hunter", name: "정보사냥꾼", reactsTo: ["info"],
    replies: ["좋은 정보 감사합니다. 알티할게요", "북마크 완료. 늘 잘 보고 있어요"] },
  { handle: "@fire_starter", name: "불씨", reactsTo: ["bait"],
    replies: ["이건 좀 아니지 않나요?", "용기 있는 발언 응원합니다", "어그로 그만 끄세요"] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
