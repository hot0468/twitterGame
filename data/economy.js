var GAME_DATA = GAME_DATA || {};
// 주인공은 트위터 프리미엄 결제자다. 일주일 치 트윗 조회수를 합쳐 정산금을 받고,
// 그 돈으로 생활비를 낸다. 팔로워가 적을 때는 정산금이 생활비를 못 덮으므로
// 알바·협찬으로 버텨야 하고, 계정이 커지면 정산금만으로 살 수 있게 된다.
// 밸런스 노브는 전부 여기 — 엔진은 이 수치를 읽기만 한다.
GAME_DATA.economy = {
  settleEvery: 7,            // 정산 주기(일)
  payoutPer1000Views: 150,   // 주간 조회수 1000회당 정산금(원)
  premiumFee: 10000,         // 정산할 때 같이 빠지는 프리미엄 결제료(원)
  livingCost: 10000          // 하루 생활비(원). 무슨 행동을 하든 나간다
};
if (typeof module !== "undefined") module.exports = GAME_DATA;
