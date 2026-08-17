var GAME_DATA = GAME_DATA || {};
// reactsTo: 그 카테고리 트윗에 리플/좋아요로 반응하는 계정.
// 좋아요·리트윗 알림의 이름도 여기서 뽑으므로 수가 적으면 같은 이름만 반복된다.
GAME_DATA.npcs = [
  { handle: "@meme_bot99", name: "밈수집가", reactsTo: ["humor", "daily"],
    replies: ["ㅋㅋㅋㅋㅋ 미쳤네", "이거 완전 저장각", "RT 박고 갑니다"] },
  { handle: "@info_hunter", name: "정보사냥꾼", reactsTo: ["info"],
    replies: ["좋은 정보 감사합니다. 알티할게요", "북마크 완료. 늘 잘 보고 있어요"] },
  { handle: "@fire_starter", name: "불씨", reactsTo: ["bait"],
    replies: ["이건 좀 아니지 않나요?", "용기 있는 발언 응원합니다", "어그로 그만 끄세요"] },
  { handle: "@night_owl_kr", name: "야행성", reactsTo: ["daily", "humor"],
    replies: ["이 시간에 이런 거 보면 안 되는데", "왜 새벽에 이런 걸 올리세요"] },
  { handle: "@mutuals_only", name: "트친소", reactsTo: ["daily"],
    replies: ["오늘도 고생하셨어요", "저도 그런 하루였습니다..."] },
  { handle: "@numbers_guy", name: "데이터쟁이", reactsTo: ["info"],
    replies: ["출처가 궁금한데 혹시 있나요?", "이거 표로 정리하면 더 좋을 것 같아요"] },
  { handle: "@lurker_9", name: "조용한관찰자", reactsTo: ["daily", "info"],
    replies: ["말없이 보고 있었습니다", "조용히 알티만 하고 갑니다"] },
  { handle: "@argue_archive", name: "논쟁수집가", reactsTo: ["bait", "humor"],
    replies: ["또 시작이네 ㅋㅋ", "이 떡밥 아카이브에 넣겠습니다"] },
  { handle: "@dawn_feels", name: "새벽감성", reactsTo: ["daily"],
    replies: ["이런 글에 약해요", "괜히 마음이 찡하네요"] }
];
if (typeof module !== "undefined") module.exports = GAME_DATA;
