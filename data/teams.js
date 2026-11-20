// 팀 정보. logo 에 이미지 경로(예: "img/LG.png")를 넣으면 엠블럼이 그 이미지로 바뀝니다.
// 엠블럼은 네이버 스포츠 이미지 주소를 불러옵니다(저작권은 각 구단/네이버에 있음). 불러오지 못하면 팀 색상 원형 약칭으로 대체됩니다.
// 내려받은 이미지를 쓰려면 logo 에 "img/OB.png" 같은 로컬 경로를 넣으세요.
window.TEAMS = {
  DOO: { name: "두산 베어스", short: "두산", color: "#131230", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/OB.png" },
  LG:  { name: "LG 트윈스",   short: "LG",   color: "#C30452", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/LG.png" },
  KT:  { name: "KT 위즈",     short: "KT",   color: "#111111", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/KT.png" },
  SSG: { name: "SSG 랜더스",  short: "SSG",  color: "#CE0E2D", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/SK.png" },
  NC:  { name: "NC 다이노스", short: "NC",   color: "#315288", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/NC.png" },
  KIA: { name: "KIA 타이거즈", short: "KIA", color: "#EA0029", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/HT.png" },
  LOT: { name: "롯데 자이언츠", short: "롯데", color: "#041E42", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/LT.png" },
  SAM: { name: "삼성 라이온즈", short: "삼성", color: "#074CA1", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/SS.png" },
  HAN: { name: "한화 이글스", short: "한화", color: "#FC4E00", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/HH.png" },
  KIW: { name: "키움 히어로즈", short: "키움", color: "#820024", text: "#fff", logo: "https://sports-phinf.pstatic.net/team/kbo/default/WO.png" },
};
window.MY_TEAM = "DOO";
