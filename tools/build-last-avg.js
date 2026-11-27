// 선수별 "마지막 경기" 시즌 타율을 모아 data/lastavg.js 로 만듭니다.  실행: node tools/build-last-avg.js
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "data", "game");
const CODE = { OB: "DOO", LG: "LG", KT: "KT", SK: "SSG", NC: "NC", HT: "KIA", LT: "LOT", SS: "SAM", HH: "HAN", WO: "KIW" };
global.window = {};
const out = {};
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".js")).sort()) { // 파일명이 날짜순
  const id = f.replace(".js", "");
  eval(fs.readFileSync(path.join(DIR, f), "utf8"));
  const g = window.GAME_DATA[id];
  const team = { away: CODE[id.slice(8, 10)], home: CODE[id.slice(10, 12)] };
  for (const side of ["away", "home"]) {
    for (const b of g.batters[side] || []) if (b.avg != null) out[team[side] + ":" + b.name] = b.avg; // 뒤 경기가 덮어씀
  }
}
fs.writeFileSync(path.join(__dirname, "..", "data", "lastavg.js"), "window.LAST_AVG=" + JSON.stringify(out) + ";\n");
console.log("선수 수:", Object.keys(out).length);
