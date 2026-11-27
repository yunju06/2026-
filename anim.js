// 결승타 다시보기 애니메이션
// 사용: PlayAnim.mount(박스요소, 경기데이터g)  -- g.notes 의 "결승타" 한 줄(예: 박건우(3회 1사 1,2루서 좌월 홈런))을 읽어서 장면을 재현합니다.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const TEAMS = () => window.TEAMS;
  const CANCEL = { cancel: true };

  // ----- 구장 좌표 (viewBox 0 -20 400 380) -----
  const BASE = [[200, 312], [276, 236], [200, 160], [124, 236], [200, 312]]; // 0=홈, 1,2,3루, 4=홈(득점)
  const BOX = [174, 314]; // 타석
  const MOUND = [200, 236];
  const FIELDERS = {
    P: [200, 236], C: [200, 336], B1: [264, 226], B2: [236, 184], SS: [164, 184],
    B3: [136, 226], LF: [92, 135], CF: [200, 100], RF: [308, 135],
  };
  // 타구 방향 키워드 -> [좌표, 홈런이면 담장 밖 좌표]
  const HR_TARGET = { "우중월": [285, 32], "좌중월": [115, 32], "중월": [200, 14], "좌월": [48, 92], "우월": [352, 92] };
  const LAND = [
    ["우중간", [268, 118]], ["좌중간", [132, 118]], ["좌전", [96, 166]], ["중전", [200, 134]], ["우전", [304, 166]],
    ["좌익수", [94, 122]], ["중견수", [200, 92]], ["우익수", [306, 122]],
    ["1루수", FIELDERS.B1], ["2루수", FIELDERS.B2], ["3루수", FIELDERS.B3], ["유격수", FIELDERS.SS], ["투수", FIELDERS.P], ["포수", [200, 322]],
  ];

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const SLOW = 2; // 2 = 0.5배속
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SLOW));

  // ----- 결승타 문장 해석 -----
  function parse(g) {
    const n = (g.notes || []).find((x) => x.how === "결승타");
    if (!n || !n.result.includes("(")) return null; // "없음" 등 기록 없는 경우
    const text = n.result;
    const m = text.match(/^(.+?)\((\d+)회\s*(무사|[12]사)\s*(만루|[123](?:,[123])*루)?서\s*(.+)\)$/);
    const out = { text, name: text.split("(")[0], inning: null, outs: 0, runners: [], detail: text };
    if (m) {
      out.name = m[1];
      out.inning = +m[2];
      out.outs = m[3] === "무사" ? 0 : +m[3][0];
      out.runners = !m[4] ? [] : m[4] === "만루" ? [1, 2, 3] : m[4].replace("루", "").split(",").map(Number);
      out.detail = m[5];
    }
    const d = out.detail;
    out.kind = /홈런/.test(d) ? "hr" : /3루타/.test(d) ? "3b" : /2루타/.test(d) ? "2b" : /희생플라이/.test(d) ? "sf"
      : /밀어내기|4구|사구/.test(d) ? "bb" : /희생번트/.test(d) ? "bunt" : /땅볼|병살|포스/.test(d) ? "gb"
      : /뜬공|플라이|라인드라이브/.test(d) ? "fo" : "1b";
    out.hrTarget = null;
    for (const k of ["우중월", "좌중월", "중월", "좌월", "우월"]) if (d.includes(k)) { out.hrTarget = HR_TARGET[k]; break; }
    out.land = null;
    for (const [k, p] of LAND) if (d.includes(k)) { out.land = p; out.infield = /루수|유격수|투수|포수/.test(k); break; }
    return out;
  }

  // 타자 이름이 어느 팀 소속인지 찾기(이름이 양쪽에 있으면 이긴 팀)
  function findSide(g, name) {
    const has = (s) => (g.batters[s] || []).find((b) => b.name === name);
    const a = has("away"), h = has("home");
    if (a && !h) return "away";
    if (h && !a) return "home";
    return g.total.home.r >= g.total.away.r ? "home" : "away";
  }

  // ----- 모두 같은 사람 모양, 유니폼 색만 다름 -----
  function person(color, scale) {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = `<g transform="scale(${scale || 1})">
      <ellipse cx="0" cy="0" rx="8" ry="2.6" fill="rgba(0,0,0,.28)"/>
      <rect x="-5.5" y="-11" width="4.2" height="11" rx="1.4" fill="#f5f5f5" stroke="#b9b9b9" stroke-width=".6"/>
      <rect x="1.3" y="-11" width="4.2" height="11" rx="1.4" fill="#f5f5f5" stroke="#b9b9b9" stroke-width=".6"/>
      <rect x="-10.5" y="-22" width="4" height="11" rx="2" fill="${color}" stroke="rgba(255,255,255,.5)" stroke-width=".6"/>
      <rect x="6.5" y="-22" width="4" height="11" rx="2" fill="${color}" stroke="rgba(255,255,255,.5)" stroke-width=".6"/>
      <rect x="-7.5" y="-24" width="15" height="15" rx="4.5" fill="${color}" stroke="rgba(255,255,255,.55)" stroke-width=".8"/>
      <circle cx="0" cy="-30" r="6.6" fill="#f6d3b0"/>
      <path d="M-7 -31 A7 7 0 0 1 7 -31 Z" fill="${color}" stroke="rgba(255,255,255,.5)" stroke-width=".6"/>
      <rect x="0" y="-32" width="9.5" height="2.6" rx="1.2" fill="${color}" stroke="rgba(255,255,255,.5)" stroke-width=".5"/>
    </g>`;
    return g;
  }

  // 결승타 기록이 없을 때: 이닝별 득점으로 결승 득점 상황을 글로 설명
  function winningRunText(g) {
    const ta = g.total.away.r, th = g.total.home.r;
    if (ta === th) return "무승부 경기라 결승 득점이 없습니다.";
    const w = ta > th ? "away" : "home", l = w === "away" ? "home" : "away";
    const need = g.total[l].r + 1;
    let cumW = 0, k = -1;
    for (let i = 0; i < g.inning[w].length; i++) { cumW += g.inning[w][i] || 0; if (cumW >= need) { k = i; break; } }
    if (k < 0) return "결승 득점 상황 정보가 없습니다.";
    const inn = k + 1;
    // 그 이닝에 나온 실책/폭투/보크/포일이 있으면 원인으로 표시
    let cause = "";
    for (const n of g.notes || []) {
      if (!/^(실책|폭투|보크|포일)$/.test(n.how) || cause) continue;
      const re = /([가-힣A-Za-z]+)\d*\(([^)]*)\)/g;
      let m;
      while ((m = re.exec(n.result))) {
        if ((m[2].match(/\d+/g) || []).map(Number).includes(inn)) { cause = `${m[1]} ${n.how}`; break; }
      }
    }
    const T = TEAMS();
    return `<b>결승 득점 상황</b><br>${inn}회${w === "away" ? "초" : "말"}${cause ? ` (${cause})` : ""} ${T[g[w]].short} ${g.inning[w][k]}점 득점`;
  }

  function mount(box, g) {
    const info = parse(g);
    if (!info) { box.innerHTML = `<div class="card play-card"><div class="play-text">${winningRunText(g)}</div></div>`; return; }
    const side = findSide(g, info.name);
    const bat = TEAMS()[g[side]], fld = TEAMS()[g[side === "home" ? "away" : "home"]];
    const player = (g.batters[side] || []).find((b) => b.name === info.name);
    const lastAvg = (window.LAST_AVG || {})[g[side] + ":" + info.name]; // 선수의 마지막 경기 시즌 타율
    const avgV = lastAvg != null ? lastAvg : player && player.avg != null ? player.avg : null;
    const avg = avgV == null ? "-" : avgV.toFixed(3).replace(/^0/, "");
    const runnersText = info.runners.length === 3 ? "만루" : info.runners.length ? info.runners.join(",") + "루" : "주자 없음";
    const cnt = (label, max, on, cls) => `<span class="cn"><i>${label}</i>${Array.from({ length: max }, (_, k) => `<u class="${cls}${k < on ? " on" : ""}"></u>`).join("")}</span>`;

    box.innerHTML = `
      <div class="card play-card">
        <div class="play-intro" tabindex="0" role="button" aria-label="결승타 장면 재생">⚾ 결승타 다시보기</div>
        <div class="play-stage" tabindex="0" role="button" aria-label="다시 보기" hidden>
          <svg viewBox="0 -20 400 380" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset="1" stop-color="#3b5a86"/></linearGradient>
              <pattern id="grassp" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#3d9a4b"/><rect width="14" height="28" fill="#44a653"/></pattern>
            </defs>
            <rect x="0" y="-20" width="400" height="380" fill="url(#skyg)"/>
            <path d="M200 316 L10 150 Q200 -46 390 150 Z" fill="url(#grassp)"/>
            <path d="M10 150 Q200 -46 390 150" fill="none" stroke="#14315c" stroke-width="9"/>
            <path d="M10 150 Q200 -46 390 150" fill="none" stroke="#f2c230" stroke-width="2" transform="translate(0,5)"/>
            <polygon points="200,322 288,236 200,148 112,236" fill="#c98f5a"/>
            <polygon points="200,300 268,236 200,172 132,236" fill="#44a653"/>
            <circle cx="200" cy="236" r="9" fill="#c98f5a"/>
            <path d="M200 316 L10 150 M200 316 L390 150" stroke="#fff" stroke-width="1.5" opacity=".8"/>
            <g fill="#fff" stroke="#9aa" stroke-width=".8">
              <rect x="270" y="230" width="12" height="12" transform="rotate(45 276 236)"/>
              <rect x="194" y="154" width="12" height="12" transform="rotate(45 200 160)"/>
              <rect x="118" y="230" width="12" height="12" transform="rotate(45 124 236)"/>
              <path d="M193 306 h14 v7 l-7 6 l-7 -6 z"/>
            </g>
            <g id="layer"></g>
          </svg>
          <div class="play-info">
            <div class="pi-top"><b>${info.inning ? info.inning + "회" : "결승타"}</b> <span>${runnersText}</span></div>
            <div class="pi-cnt">${cnt("B", 3, info.kind === "bb" ? 3 : 0, "b")}${cnt("S", 2, 0, "s")}${cnt("O", 2, info.outs, "o")}</div>
          </div>
          <button type="button" class="play-hide">숨기기 ✕</button>
          <div class="play-msg" hidden></div>
          <div class="play-who">
            <div class="pp-team"><span class="pp-dot" style="background:${bat.color}"></span>${bat.name}</div>
            <div class="pp-name">${info.name}</div>
            <div class="pp-avg">시즌 타율 <b>${avg}</b></div>
            <div class="pp-sub">${info.inning ? info.inning + "회 " : ""}${info.outs === 0 ? "무사" : info.outs + "사"} ${runnersText}<br>${info.detail}</div>
          </div>
        </div>
      </div>`;

    const stage = box.querySelector(".play-stage");
    const layer = box.querySelector("#layer");
    const intro = box.querySelector(".play-intro");
    const msg = box.querySelector(".play-msg");
    let run = 0, playing = false, finished = false;
    const alive = (id) => { if (id !== run || !box.isConnected) throw CANCEL; };

    // ----- 애니메이션 도구 -----
    function tween(id, ms, fn) {
      return new Promise((res, rej) => {
        const s = performance.now();
        (function f(now) {
          try { alive(id); } catch (e) { return rej(e); }
          const t = Math.min(1, (now - s) / (ms * SLOW));
          fn(t);
          t < 1 ? requestAnimationFrame(f) : res();
        })(s);
      });
    }
    const place = (el, x, y) => { el._x = x; el._y = y; el.setAttribute("transform", `translate(${x} ${y})`); };
    function moveTo(id, el, x, y, ms) {
      const x0 = el._x, y0 = el._y;
      return tween(id, ms, (t) => { const e = ease(t); place(el, lerp(x0, x, e), lerp(y0, y, e)); });
    }
    const add = (el) => { layer.appendChild(el); return el; };
    function floatText(id, text, x, y, color, size) {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", size || 16); t.setAttribute("font-weight", "800");
      t.setAttribute("fill", color || "#fff"); t.setAttribute("stroke", "rgba(0,0,0,.6)"); t.setAttribute("stroke-width", "3");
      t.setAttribute("paint-order", "stroke");
      t.textContent = text; add(t);
      return tween(id, 1100, (p) => { t.setAttribute("y", y - 24 * p); t.setAttribute("opacity", p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3); }).then(() => t.remove());
    }
    function say(html) { msg.innerHTML = html; msg.hidden = false; }

    // ----- 장면 준비 -----
    let ball, shadow, batter, batG, fielders, runners;
    function setup() {
      layer.innerHTML = "";
      stage.querySelectorAll(".gs").forEach((e) => e.remove());
      msg.hidden = true;
      fielders = {};
      for (const k in FIELDERS) { const p = add(person(fld.color, 0.95)); place(p, ...FIELDERS[k]); fielders[k] = p; }
      runners = info.runners.map((b) => { const p = add(person(bat.color, 0.95)); place(p, ...BASE[b]); p._b = b; return p; });
      batter = add(person(bat.color, 1.05));
      place(batter, ...BOX);
      const tag = document.createElementNS(NS, "text");
      tag.setAttribute("y", -44); tag.setAttribute("text-anchor", "middle"); tag.setAttribute("font-size", 11); tag.setAttribute("font-weight", "800");
      tag.setAttribute("fill", "#fff"); tag.setAttribute("stroke", "rgba(0,0,0,.7)"); tag.setAttribute("stroke-width", "3"); tag.setAttribute("paint-order", "stroke");
      tag.textContent = info.name; batter.appendChild(tag);
      batG = add(document.createElementNS(NS, "g"));
      batG.innerHTML = `<line x1="0" y1="0" x2="0" y2="-26" stroke="#d9a35b" stroke-width="3.4" stroke-linecap="round"/>`;
      batG._ang = -35; setBat(-35);
      shadow = add(document.createElementNS(NS, "ellipse"));
      shadow.setAttribute("rx", 4); shadow.setAttribute("ry", 1.6); shadow.setAttribute("fill", "rgba(0,0,0,.35)"); shadow.setAttribute("opacity", 0);
      ball = add(document.createElementNS(NS, "g"));
      ball.innerHTML = `<circle r="11" fill="rgba(255,235,0,.5)"/><circle r="6.5" fill="#fff" stroke="#111" stroke-width="1.6"/>
        <path d="M-3.6 -4.6 Q0 0 -3.6 4.6 M3.6 -4.6 Q0 0 3.6 4.6" fill="none" stroke="#e5143a" stroke-width="1.5" stroke-linecap="round"/>`;
      setBall(MOUND[0], MOUND[1] - 20, 0);
    }
    function setBat(a) { batG._ang = a; batG.setAttribute("transform", `translate(${BOX[0] + 8} ${BOX[1] - 16}) rotate(${a})`); }
    function setBall(x, y, h) {
      ball._x = x; ball._y = y;
      ball.setAttribute("transform", `translate(${x} ${y - h - 3}) scale(${info.kind === "hr" ? 1 + h / 70 : 1})`);
      shadow.setAttribute("cx", x); shadow.setAttribute("cy", y + 3); shadow.setAttribute("opacity", h > 2 ? 0.5 : 0);
    }
    function flyBall(id, to, ms, H) {
      const x0 = ball._x, y0 = ball._y;
      return tween(id, ms, (t) => setBall(lerp(x0, to[0], t), lerp(y0, to[1], t), Math.sin(Math.PI * t) * H));
    }
    function rollBall(id, to, ms) {
      const x0 = ball._x, y0 = ball._y;
      return tween(id, ms, (t) => setBall(lerp(x0, to[0], t), lerp(y0, to[1], t), Math.abs(Math.sin(t * Math.PI * 3)) * 5 * (1 - t)));
    }
    const nearest = (p) => Object.keys(FIELDERS).reduce((a, k) => (dist(FIELDERS[k], p) < dist(FIELDERS[a], p) ? k : a), "CF");
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

    // 주자 이동: 베이스 b 에서 e 까지(4=홈)
    async function runPath(id, el, from, to, ms) {
      for (let k = from + 1; k <= to; k++) await moveTo(id, el, BASE[k][0], BASE[k][1], ms);
    }
    function scored(id, el) {
      return tween(id, 300, (t) => el.setAttribute("opacity", 1 - t)).then(() => el.remove());
    }

    // ----- 재생 -----
    async function play(id) {
      const kind = info.kind;
      // 투구
      if (kind === "bb") {
        ball.setAttribute("opacity", 1);
        await tween(id, 480, (t) => setBall(lerp(MOUND[0], 232, t), lerp(MOUND[1] - 20, 304, t), 4));
        floatText(id, "볼!", 232, 290, "#9be7a0", 14);
        await sleep(450);
        batG.setAttribute("opacity", 0);
        const bruns = [];
        let n = 0; // 밀어내기: 1루부터 연달아 있는 주자만 한 베이스씩 밀림
        const order = [3, 2, 1];
        const moving = new Set();
        let need = 1; // 1루가 비어있지 않으면 밀림
        if (info.runners.includes(1)) { moving.add(1); if (info.runners.includes(2)) { moving.add(2); if (info.runners.includes(3)) moving.add(3); } }
        const pushed = runners.filter((r) => moving.has(r._b));
        const bt = runPath(id, batter, 0, 1, 450);
        const ps = pushed.map((r) => runPath(id, r, r._b, r._b + 1, 450).then(() => (r._b + 1 === 4 ? scored(id, r) : 0)));
        n = pushed.filter((r) => r._b === 3).length;
        await Promise.all([bt, ...ps]);
        return finish(id, n, "밀어내기 볼넷");
      }

      // 일반 타격: 공이 홈에 닿는 순간 스윙
      ball.setAttribute("opacity", 1);
      const pitch = tween(id, 520, (t) => setBall(lerp(MOUND[0], 200, t * t), lerp(MOUND[1] - 20, 296, t * t), 4));
      const swing = sleep(300).then(() => tween(id, 240, (t) => setBat(lerp(-35, 115, ease(t)))));
      await Promise.all([pitch, swing]);
      floatText(id, kind === "hr" ? "💥" : "✨", 204, 276, "#fff", 22);

      let land = kind === "hr" ? info.hrTarget || HR_TARGET["중월"] : info.land || (kind === "gb" || kind === "bunt" ? FIELDERS.SS : [200, 128]);
      const ground = kind === "bunt" || kind === "gb" || (kind === "1b" && info.infield);
      const isOut = kind === "sf" || kind === "fo";
      const isHit = !isOut && !ground && kind !== "hr";
      // 안타는 수비가 못 잡는 곳에 떨어짐: 수비수 바로 위면 그 앞(홈 쪽)으로 짧게 떨어뜨린다
      if (isHit) {
        const nf = FIELDERS[nearest(land)];
        if (!/중전/.test(info.detail) && dist(nf, land) < 46) land = [lerp(nf[0], BASE[0][0], 0.3), lerp(nf[1], BASE[0][1], 0.3)];
      }
      let adv = []; // [주자, 도착 베이스]
      let batterTo = 1, batterOut = false;
      if (kind === "hr") { batterTo = 4; adv = runners.map((r) => [r, 4]); }
      else if (kind === "3b") { batterTo = 3; adv = runners.map((r) => [r, 4]); }
      else if (kind === "2b") { batterTo = 2; adv = runners.map((r) => [r, 4]); }
      else if (kind === "1b") { batterTo = 1; adv = runners.map((r) => [r, r._b === 1 ? 3 : 4]); }
      else if (kind === "sf" || kind === "fo") { batterOut = true; adv = runners.filter((r) => r._b === 3).map((r) => [r, 4]); }
      else { batterOut = true; adv = runners.map((r) => [r, Math.min(4, r._b + 1)]); } // 땅볼·번트
      if (kind === "bunt") adv = runners.map((r) => [r, Math.min(4, r._b + 1)]);

      // 타구 + 수비수 움직임
      const fk = nearest(land);
      let chase = Promise.resolve();
      if (isOut) chase = moveTo(id, fielders[fk], land[0], land[1], 1000); // 뜬공은 잡는다
      else if (isHit) { // 안타: 절반쯤 쫓아가다 놓치고, 떨어진 뒤에 공을 줍는다
        const f = FIELDERS[fk];
        chase = moveTo(id, fielders[fk], lerp(f[0], land[0], 0.5), lerp(f[1], land[1], 0.5), 1000);
      }
      let ballFlight;
      if (ground) ballFlight = rollBall(id, kind === "bunt" ? [land[0], Math.max(land[1], 262)] : land, kind === "bunt" ? 650 : 750);
      else if (kind === "hr") ballFlight = flyBall(id, land, 1300, 130);
      else ballFlight = flyBall(id, land, 1000, kind === "sf" || kind === "fo" ? 110 : 80);

      // 타자·주자 달리기
      const movers = [];
      if (!batterOut) { movers.push(runPath(id, batter, 0, batterTo, kind === "hr" ? 360 : 400).then(() => (batterTo === 4 ? scored(id, batter) : 0))); }
      else if (kind === "gb" || kind === "bunt") { movers.push(runPath(id, batter, 0, 1, 440)); }
      let n = 0;
      if (kind === "hr") n = 1;
      for (const [r, to] of adv) {
        const wait = kind === "sf" || kind === "fo" ? 900 : 120; // 희생플라이는 포구 후 태그업
        movers.push(sleep(wait).then(() => runPath(id, r, r._b, to, kind === "hr" ? 360 : 400)).then(() => (to === 4 ? scored(id, r) : 0)));
        if (to === 4) n++;
      }
      batG.setAttribute("opacity", 1);
      sleep(120).then(() => setBat(115)).catch(() => {});
      await Promise.all([ballFlight, chase]);
      if (isHit) movers.push(moveTo(id, fielders[fk], land[0], land[1], 600));
      if (batterOut) {
        if (ground) {
          // 1루로 송구
          await flyBall(id, BASE[1], 320, 14);
          floatText(id, "OUT", BASE[1][0], BASE[1][1] - 40, "#ff9d9d", 16);
        } else floatText(id, "캐치!", land[0], land[1] - 36, "#ffe27a", 15);
      }
      await Promise.all(movers);
      if (batterOut) await tween(id, 300, (t) => batter.setAttribute("opacity", 1 - t * 0.7));
      return finish(id, n, info.detail);
    }

    async function finish(id, n, label) {
      const win = n > 0 ? `+${n}점` : "결승타";
      say(`<b>${info.name}</b> · ${label}<br><span class="pm-big">${n > 0 ? "🎉 " + win : "🏁 결승타"}</span>`);
      await sleep(100);
      finished = true;
    }

    // ----- 클릭 처리 -----
    function reset() { run++; playing = false; finished = false; setup(); stage.hidden = true; intro.hidden = false; }
    async function start() {
      if (playing) return;
      if (finished) { run++; finished = false; setup(); }
      playing = true;
      intro.hidden = true; stage.hidden = false;
      const id = ++run;
      try { await play(id); } catch (e) { if (e !== CANCEL) throw e; }
      playing = false;
      if (finished) {
        const h = document.createElement("div"); h.className = "pm-hint"; h.textContent = "↻ 다시 보려면 화면을 누르세요"; msg.appendChild(h);
      }
    }
    stage.querySelector(".play-hide").addEventListener("click", (e) => { e.stopPropagation(); reset(); });
    for (const el of [intro, stage]) {
      el.addEventListener("click", start);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } });
    }
    setup();
  }

  window.PlayAnim = { mount, parse };
})();
