// KBO 전 구단 2026 정규시즌 수집: node tools/fetch-all.js   (all-teams 폴더에서)
// 만드는 파일
//   data/schedule.js        : 전체 경기 목록(가벼움). 달력/스코어만 필요할 때 이것만 로드
//   data/game/<gameId>.js   : 경기 1개의 상세 기록. 경기를 열 때만 그 파일 1개를 로드
// 네이버 응답은 ../tools/cache 에 저장해 재사용합니다(두산 경기는 이미 받아둔 게 있음).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, "..", "tools", "cache");
const GAME_DIR = path.join(ROOT, "data", "game");
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(GAME_DIR, { recursive: true });

const CODE = { OB: "DOO", LG: "LG", KT: "KT", SK: "SSG", NC: "NC", HT: "KIA", LT: "LOT", SS: "SAM", HH: "HAN", WO: "KIW" };
const HEADERS = { "User-Agent": "Mozilla/5.0", Referer: "https://m.sports.naver.com/" };
const API = "https://api-gw.sports.naver.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const args = ["-s", "-f", "-m", "30"];
      for (const k in HEADERS) args.push("-H", `${k}: ${HEADERS[k]}`);
      const body = execFileSync("curl", [...args, url], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
      const j = JSON.parse(body);
      if (!j.success) throw new Error(j.message || "api error");
      return j.result;
    } catch (e) {
      if (i === tries - 1) throw new Error(url + " → " + e.message);
      await sleep(1000 * (i + 1));
    }
  }
}

async function fetchSchedule() {
  const games = [];
  for (let m = 3; m <= 11; m++) {
    const last = new Date(2026, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    games.push(...(await getJson(`${API}/schedule/games?fields=basic,schedule,baseball&upperCategoryId=kbaseball&categoryId=kbo&fromDate=2026-${mm}-01&toDate=2026-${mm}-${last}&size=500`)).games);
  }
  return games;
}

async function fetchRecord(id) {
  const f = path.join(CACHE, id + ".json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const rec = (await getJson(`${API}/schedule/games/${id}/record`)).recordData;
  fs.writeFileSync(f, JSON.stringify(rec));
  await sleep(250);
  return rec;
}

function convertBatters(list) {
  return list.map((b) => {
    const inn = [];
    for (let i = 1; i <= 12; i++) inn.push(b["inn" + i] || "");
    while (inn.length > 9 && inn[inn.length - 1] === "") inn.pop();
    return { order: b.batOrder, pos: b.pos, name: b.name, ab: num(b.ab), r: num(b.run), h: num(b.hit), rbi: num(b.rbi), hr: num(b.hr), bb: num(b.bb), so: num(b.kk), sb: num(b.sb), avg: b.hra ? Number(b.hra) : null, inn };
  });
}
function convertPitchers(list) {
  return list.map((p) => ({ name: p.name, dec: p.wls || "", ip: String(p.inn ?? ""), bf: num(p.bf), ab: num(p.ab), h: num(p.hit), hr: num(p.hr), bb: num(p.bbhp), so: num(p.kk), r: num(p.r), er: num(p.er), era: p.era || "" }));
}

(async () => {
  console.log("일정 가져오는 중...");
  const all = await fetchSchedule();
  const games = all
    .filter((g) => g.roundCode === "kbo_r" && g.statusCode === "RESULT" && !g.cancel && CODE[g.homeTeamCode] && CODE[g.awayTeamCode])
    .sort((a, b) => a.gameDateTime.localeCompare(b.gameDateTime) || a.gameId.localeCompare(b.gameId));
  console.log("정규시즌 종료 경기:", games.length);

  const schedule = [];
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    process.stdout.write(`\r[${i + 1}/${games.length}] ${g.gameId}   `);
    const rec = await fetchRecord(g.gameId);
    const bb = rec.battersBoxscore, sb = rec.scoreBoard;
    const lineup = {};
    for (const side of ["away", "home"]) {
      const seen = new Set();
      lineup[side] = bb[side].filter((b) => !seen.has(b.batOrder) && seen.add(b.batOrder)).map((b) => ({ order: b.batOrder, pos: b.pos, name: b.name }));
    }
    const tot = (s) => ({ r: num(sb.rheb[s].r), h: num(sb.rheb[s].h), e: num(sb.rheb[s].e), b: num(sb.rheb[s].b) });
    const detail = {
      inning: { away: sb.inn.away, home: sb.inn.home },
      total: { away: tot("away"), home: tot("home") },
      lineup,
      batters: { away: convertBatters(bb.away), home: convertBatters(bb.home) },
      pitchers: { away: convertPitchers(rec.pitchersBoxscore.away), home: convertPitchers(rec.pitchersBoxscore.home) },
      notes: (rec.etcRecords || []).map((e) => ({ how: e.how, result: e.result })),
    };
    fs.writeFileSync(path.join(GAME_DIR, g.gameId + ".js"), `(window.GAME_DATA=window.GAME_DATA||{})[${JSON.stringify(g.gameId)}]=${JSON.stringify(detail)};\n`);
    schedule.push({ id: g.gameId, date: g.gameDate, time: g.gameDateTime.slice(11, 16), away: CODE[g.awayTeamCode], home: CODE[g.homeTeamCode], stadium: g.stadium, ar: detail.total.away.r, hr: detail.total.home.r });
  }
  console.log();
  fs.writeFileSync(path.join(ROOT, "data", "schedule.js"), `// 전 구단 2026 정규시즌 경기 목록 (${new Date().toISOString().slice(0, 10)} 수집). tools/fetch-all.js 로 생성\nwindow.SCHEDULE = ${JSON.stringify(schedule)};\n`);
  console.log(`완료: ${schedule.length}경기, schedule.js ${(fs.statSync(path.join(ROOT, "data", "schedule.js")).size / 1024).toFixed(0)}KB`);
})().catch((e) => { console.error("\n실패:", e.message); process.exit(1); });
