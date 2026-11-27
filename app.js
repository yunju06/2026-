(function () {
  const T = window.TEAMS;
  const $ = (id) => document.getElementById(id);
  let ME = localStorage.getItem("kbo_team");
  if (!T[ME]) ME = "DOO";
  let GAMES = [], byDate = {}, minM = 2, maxM = 9, curM = 2;

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const today = new Date();
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // 선택한 팀의 경기만 골라서 준비 (schedule.js 는 전 구단 목록이라 가벼움, 상세 기록은 경기를 열 때 1개씩 로드)
  function setTeam(code) {
    ME = code;
    localStorage.setItem("kbo_team", code);
    GAMES = (window.SCHEDULE || [])
      .filter((s) => s.home === ME || s.away === ME)
      .map((s) => ({ ...s, status: "final", total: { away: { r: s.ar }, home: { r: s.hr } } }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    byDate = {};
    GAMES.forEach((g) => (byDate[g.date] = byDate[g.date] || []).push(g));
    const first = GAMES[0] ? GAMES[0].date : "2026-03-28";
    const last = GAMES[GAMES.length - 1] ? GAMES[GAMES.length - 1].date : "2026-10-31";
    minM = +first.slice(5, 7) - 1; maxM = +last.slice(5, 7) - 1;
    curM = clamp(today.getFullYear() === 2026 ? today.getMonth() : minM, minM, maxM);
    document.documentElement.style.setProperty("--navy", T[ME].color);
    document.title = T[ME].name + " 2026 일정·기록";
    $("teamSel").value = ME;
  }

  // 경기 상세 기록 지연 로딩: data/game/<id>.js 를 그 경기를 열 때만 불러옴
  const detailLoads = {};
  function loadDetail(g) {
    if (g.batters) return Promise.resolve(g);
    if (!detailLoads[g.id]) {
      detailLoads[g.id] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "data/game/" + g.id + ".js";
        s.onload = () => { Object.assign(g, window.GAME_DATA[g.id]); resolve(g); };
        s.onerror = () => { delete detailLoads[g.id]; reject(new Error("load fail " + g.id)); };
        document.head.appendChild(s);
      });
    }
    return detailLoads[g.id];
  }

  // ----- 헬퍼 -----
  function emblem(code, size) {
    const t = T[code];
    const fs = Math.round(size * (t.short.length > 2 ? 0.28 : 0.38));
    const fb = `<span class="fb" style="font-size:${fs}px">${t.short}</span>`;
    const inner = t.logo ? `<img src="${t.logo}" alt="${t.name}" onerror="this.parentNode.style.background='${t.color}';this.outerHTML=this.parentNode.dataset.fb">` : fb;
    return `<span class="emblem" title="${t.name}" data-fb='${fb}' style="width:${size}px;height:${size}px;background:${t.logo ? "#fff" : t.color};color:${t.text}">${inner}</span>`;
  }
  function result(g) {
    if (g.status !== "final") return null;
    const my = g.home === ME ? g.total.home.r : g.total.away.r;
    const op = g.home === ME ? g.total.away.r : g.total.home.r;
    return my > op ? "W" : my < op ? "L" : "D";
  }
  const RES_KO = { W: "승", L: "패", D: "무" };
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  // 네이버 포지션 표기 → 영문. 여러 글자("주좌" 등)는 경기 중 맡은 포지션 순서라서 글자마다 칸을 나눠 보여줌
  const POSMAP = { 포: "C", 一: "1B", 二: "2B", 三: "3B", 유: "SS", 좌: "LF", 중: "CF", 우: "RF", 지: "DH", 투: "P", 타: "PH", 주: "PR" };
  const posCells = (s) => `<span class="poss">${[...String(s || "")].map((ch) => `<span class="pos">${POSMAP[ch] || ch}</span>`).join("")}</span>`;

  // ----- 직관 기록 저장 (브라우저 localStorage) -----
  const lsKey = () => "att2026_" + ME; // 팀별로 따로 저장
  const loadAtt = () => {
    try {
      let v = JSON.parse(localStorage.getItem(lsKey()));
      if (!v && ME === "DOO") v = JSON.parse(localStorage.getItem("doosan2026_attended")); // 이전 두산 버전 기록 이어받기
      return v || [];
    } catch (e) { return []; }
  };
  const saveAtt = (a) => localStorage.setItem(lsKey(), JSON.stringify(a));
  const isAtt = (id) => loadAtt().includes(id);
  function toggleAtt(id) {
    const a = loadAtt(), i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1); else a.push(id);
    saveAtt(a);
  }

  // ----- 달력 -----
  function renderCalendar() {
    const y = 2026;
    $("monthTitle").textContent = `${y}년 ${curM + 1}월`;
    $("prevMonth").disabled = curM <= minM;
    $("nextMonth").disabled = curM >= maxM;

    const firstDow = new Date(y, curM, 1).getDay();
    const days = new Date(y, curM + 1, 0).getDate();
    let html = "";
    for (let i = 0; i < firstDow; i++) html += `<div class="cell empty"></div>`;
    let w = 0, l = 0, d = 0;
    for (let day = 1; day <= days; day++) {
      const ds = ymd(y, curM, day);
      const gs = byDate[ds];
      const cls = ds === todayStr ? " today" : "";
      if (!gs) { html += `<div class="cell noGame${cls}"><span class="day">${day}</span></div>`; continue; }
      const g = gs[0];
      const isHome = g.home === ME;
      const opp = isHome ? g.away : g.home;
      const r = result(g);
      if (r === "W") w++; else if (r === "L") l++; else if (r === "D") d++;
      const my = isHome ? (g.total && g.total.home.r) : (g.total && g.total.away.r);
      const op = isHome ? (g.total && g.total.away.r) : (g.total && g.total.home.r);
      html += `<div class="cell game ${isHome ? "home" : "away"}${cls}" data-id="${g.id}" tabindex="0" role="button" aria-label="${ds} ${T[opp].short}전">
        <span class="day">${day}</span>
        ${r ? `<span class="res ${r}">${RES_KO[r]}</span>` : ""}
        <span class="emblem-wrap">${emblem(opp, 38)}</span>
        ${r ? `<span class="score">${my} : ${op}</span>` : `<span class="time">${g.time}</span>`}
        <span class="where">${g.stadium}</span>
      </div>`;
    }
    $("calGrid").innerHTML = html;
    const played = w + l + d;
    $("monthSummary").innerHTML = played
      ? `이달 <b>${played}</b>경기 · <b>${w}승 ${l}패${d ? " " + d + "무" : ""}</b>`
      : "이달 예정된 경기";
  }

  $("prevMonth").onclick = () => { curM--; renderCalendar(); };
  $("nextMonth").onclick = () => { curM++; renderCalendar(); };
  $("calGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".cell.game");
    if (c) location.hash = "#/game/" + c.dataset.id;
  });
  $("calGrid").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const c = e.target.closest(".cell.game");
      if (c) { e.preventDefault(); location.hash = "#/game/" + c.dataset.id; }
    }
  });

  // ----- 경기 상세 -----
  function renderGame(g) {
    const dt = new Date(g.date + "T00:00:00");
    const r = result(g);
    const t = g.total;
    $("gameHead").innerHTML = `
      <div class="meta">${g.date.replace(/-/g, ".")} (${DOW[dt.getDay()]}) ${g.time} · ${g.stadium}</div>
      <div class="vs">
        <div class="side">${emblem(g.away, 56)}<b>${T[g.away].short}</b><span class="tag">원정</span></div>
        <div class="big">${t ? t.away.r : "-"} <small>:</small> ${t ? t.home.r : "-"}</div>
        <div class="side">${emblem(g.home, 56)}<b>${T[g.home].short}</b><span class="tag">홈</span></div>
      </div>
      ${r ? `<div class="meta" style="margin:10px 0 0">${T[ME].short} ${RES_KO[r]}</div>` : `<div class="meta" style="margin:10px 0 0">경기 예정</div>`}`;

    // 페이지 0 : 스코어 + 라인업
    if (g.status !== "final") {
      $("page0").innerHTML = `<div class="card empty-note">경기 시작 전입니다.<br>경기가 끝나면 스코어와 라인업이 표시됩니다.</div>`;
      $("page1").innerHTML = `<div class="card empty-note">아직 선수 기록이 없습니다.</div>`;
      return;
    }
    const N = Math.max(9, g.inning.away.length, g.inning.home.length);
    const innHead = Array.from({ length: N }, (_, i) => `<th>${i + 1}</th>`).join("");
    const row = (side) => {
      const cells = Array.from({ length: N }, (_, i) => {
        const v = g.inning[side][i];
        if (v === undefined) return `<td class="zero">${side === "home" && i === 8 && i === g.inning.home.length ? "X" : "-"}</td>`;
        return `<td class="${v ? "" : "zero"}">${v}</td>`;
      }).join("");
      return `<tr><td>${T[g[side]].short}</td>${cells}<td class="rhe">${t[side].r}</td><td class="rhe">${t[side].h}</td><td class="rhe">${t[side].e}</td><td class="rhe">${t[side].b}</td></tr>`;
    };
    const lineup = (side) => `
      <div class="card">
        <div class="tname">${emblem(g[side], 24)} ${T[g[side]].name}</div>
        <table><thead><tr><th>타순</th><th>포지션</th><th class="nm">선수</th></tr></thead><tbody>
        ${g.lineup[side].map((p) => `<tr><td>${p.order}</td><td>${posCells(p.pos)}</td><td class="nm">${p.name}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
    $("page0").innerHTML = `
      <div id="playBox"></div>
      <div class="card"><h3>이닝별 스코어</h3><div class="tbl-wrap"><table class="score-tbl">
        <thead><tr><th>팀</th>${innHead}<th>R</th><th>H</th><th>E</th><th>B</th></tr></thead>
        <tbody>${row("away")}${row("home")}</tbody></table></div></div>
      <h3 style="margin:14px 2px 8px">라인업</h3>
      <div class="lineups">${lineup("away")}${lineup("home")}</div>`;

    if (window.PlayAnim) PlayAnim.mount($("playBox"), g);

    // 페이지 1 : 선수 기록 (팀 선택)
    mountRecords($("page1"), g);
  }

  // 선수 기록지(팀 선택 + 타자/투수 표). 경기 상세 페이지와 직관 페이지에서 같이 씀
  function mountRecords(box, g) {
    box.innerHTML = `
      <div class="team-switch">
        ${["away", "home"].map((s) => `<button data-side="${s}">${emblem(g[s], 22)} ${T[g[s]].short}</button>`).join("")}
      </div>
      <div class="records"></div>`;
    const rec = box.querySelector(".records");
    const showSide = (side) => {
      box.querySelectorAll(".team-switch button").forEach((b) => b.classList.toggle("active", b.dataset.side === side));
      const bs = g.batters[side], ps = g.pitchers[side];
      const seen = new Set();
      const isSub = bs.map((b) => (seen.has(b.order) ? true : (seen.add(b.order), false))); // 같은 타순의 두 번째부터 교체 출전
      const sum = (k) => bs.reduce((a, b) => a + b[k], 0);
      const avg = (b) => (b.avg == null ? "-" : b.avg.toFixed(3).replace(/^0/, ""));
      const NI = Math.max(9, ...bs.map((b) => b.inn.length));
      const innTh = Array.from({ length: NI }, (_, i) => `<th class="ir">${i + 1}</th>`).join("");
      const innTd = (b) => Array.from({ length: NI }, (_, i) => `<td class="ir">${b.inn[i] || ""}</td>`).join("");
      const notes = (g.notes || []).map((n) => `<tr><th>${n.how}</th><td class="nm" style="white-space:normal">${n.result}</td></tr>`).join("");
      rec.innerHTML = `
        <div class="card"><h3>타자 기록</h3><div class="tbl-wrap"><table>
          <thead><tr><th>타순</th><th>포지션</th><th class="nm">선수</th><th>타수</th><th>득점</th><th>안타</th><th>타점</th><th>볼넷</th><th>삼진</th><th>홈런</th><th>도루</th><th>시즌 타율</th>${innTh}</tr></thead>
          <tbody>${bs.map((b, i) => `<tr class="${isSub[i] ? "subrow" : ""}"><td class="ord">${isSub[i] ? '<span class="up" title="교체 출전">↑</span>' : b.order}</td><td>${posCells(b.pos)}</td><td class="nm">${b.name}</td><td>${b.ab}</td><td>${b.r}</td><td>${b.h}</td><td>${b.rbi}</td><td>${b.bb}</td><td>${b.so}</td><td>${b.hr}</td><td>${b.sb}</td><td>${avg(b)}</td>${innTd(b)}</tr>`).join("")}
          <tr class="sum"><td colspan="3">합계</td><td>${sum("ab")}</td><td>${sum("r")}</td><td>${sum("h")}</td><td>${sum("rbi")}</td><td>${sum("bb")}</td><td>${sum("so")}</td><td>${sum("hr")}</td><td>${sum("sb")}</td><td></td><td colspan="${NI}"></td></tr>
          </tbody></table></div></div>
        <div class="card"><h3>투수 기록</h3><div class="tbl-wrap"><table>
          <thead><tr><th class="nm">선수</th><th>결과</th><th>이닝</th><th>피안타</th><th>실점</th><th>자책</th><th>볼넷</th><th>삼진</th><th>타자</th><th>평균자책</th></tr></thead>
          <tbody>${ps.map((p) => `<tr><td class="nm">${p.name}</td><td>${p.dec ? `<span class="dec ${p.dec}">${p.dec}</span>` : "-"}</td><td>${p.ip}</td><td>${p.h}</td><td>${p.r}</td><td>${p.er}</td><td>${p.bb}</td><td>${p.so}</td><td>${p.bf}</td><td>${p.era}</td></tr>`).join("")}</tbody>
        </table></div></div>
        ${notes ? `<div class="card"><h3>경기 기록</h3><table class="notes"><tbody>${notes}</tbody></table></div>` : ""}`;
    };
    box.querySelectorAll(".team-switch button").forEach((b) => (b.onclick = () => showSide(b.dataset.side)));
    showSide(g.home === ME ? "home" : "away");
  }

  // ----- 페이저(좌우 넘기기) -----
  const pager = $("pager");
  const tabs = document.querySelectorAll(".pager-tabs button");
  const goPage = (i) => pager.scrollTo({ left: i * pager.clientWidth, behavior: "smooth" });
  tabs.forEach((b) => (b.onclick = () => goPage(+b.dataset.page)));
  pager.addEventListener("scroll", () => {
    const i = Math.round(pager.scrollLeft / pager.clientWidth);
    tabs.forEach((b, k) => b.classList.toggle("active", k === i));
  });
  document.addEventListener("keydown", (e) => {
    if ($("gameView").hidden || e.target.closest("input,textarea")) return;
    const i = Math.round(pager.scrollLeft / pager.clientWidth);
    if (e.key === "ArrowRight") goPage(Math.min(1, i + 1));
    if (e.key === "ArrowLeft") goPage(Math.max(0, i - 1));
    if (e.key === "Escape") location.hash = "#/calendar";
  });

  // ----- 직관 페이지 -----
  const attended = () => loadAtt().map((id) => GAMES.find((g) => g.id === id)).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));

  function renderAttend(selId) {
    const list = attended();
    let w = 0, l = 0, d = 0, hw = 0, hl = 0, aw = 0, al = 0;
    list.forEach((g) => {
      const r = result(g), home = g.home === ME;
      if (r === "W") { w++; home ? hw++ : aw++; } else if (r === "L") { l++; home ? hl++ : al++; } else d++;
    });
    const pct = (x, y) => (x + y ? (x / (x + y)) * 100 : null);
    const rate = pct(w, l);
    const fmtP = (v) => (v == null ? "-" : v.toFixed(1) + "%");

    $("panelRate").innerHTML = `
      <h2 class="ph">직관 승률</h2>
      <div class="donut" style="--p:${rate == null ? 0 : rate}">
        <div class="donut-in"><b>${rate == null ? "-" : rate.toFixed(1)}<small>%</small></b><span>${list.length}경기 직관</span></div>
      </div>
      <div class="wld"><div><b>${w}</b><span>승</span></div><div><b>${l}</b><span>패</span></div><div><b>${d}</b><span>무</span></div></div>
      <table class="split"><tbody>
        <tr><th>홈 경기</th><td>${hw}승 ${hl}패</td><td>${fmtP(pct(hw, hl))}</td></tr>
        <tr><th>원정 경기</th><td>${aw}승 ${al}패</td><td>${fmtP(pct(aw, al))}</td></tr>
      </tbody></table>
      <p class="note">승률 = 승 ÷ (승+패), 무승부 제외</p>`;

    const items = list.map((g) => {
      const home = g.home === ME, opp = home ? g.away : g.home, r = result(g);
      const my = home ? g.total.home.r : g.total.away.r, op = home ? g.total.away.r : g.total.home.r;
      const dt = new Date(g.date + "T00:00:00");
      return `<li class="att-item ${g.id === selId ? "sel" : ""}" data-id="${g.id}" tabindex="0" role="button">
          <div class="ad">${g.date.slice(5).replace("-", ".")}<small>(${DOW[dt.getDay()]})</small></div>
          ${emblem(opp, 34)}
          <div class="am"><b>vs ${T[opp].short}</b><span>${home ? "홈" : "원정"} · ${g.stadium}</span></div>
          <div class="as">${my} : ${op}</div>
          <span class="res2 ${r}">${RES_KO[r]}</span>
          <button class="rm" data-rm="${g.id}" title="직관 기록 삭제" aria-label="삭제">✕</button>
        </li>`;
    }).join("");
    $("panelList").innerHTML = `
      <h2 class="ph">직관 기록 <small>${list.length}경기</small></h2>
      ${list.length ? `<ul class="att-list">${items}</ul>` : `<div class="empty-note">아직 직관 기록이 없어요.<br><a href="#/calendar">2026 일정·기록</a>에서 경기를 열고<br><b>직관</b> 버튼을 눌러 추가해 보세요.</div>`}`;

    const g = selId && list.find((x) => x.id === selId);
    const lay = $("attendLayout");
    if (g) {
      $("panelDetail").querySelector(".inner").innerHTML = `
        <div class="dh"><h2 class="ph">선수 기록</h2><button class="x" id="closeDetail" aria-label="닫기">✕</button></div>
        <div class="dsum">${emblem(g.away, 26)} <b>${T[g.away].short}</b> <span class="sc">${g.total.away.r} : ${g.total.home.r}</span> <b>${T[g.home].short}</b> ${emblem(g.home, 26)}
          <small>${g.date.replace(/-/g, ".")} · ${g.stadium}</small></div>
        <div class="dbody"></div>`;
      const box = $("panelDetail").querySelector(".dbody");
      box.innerHTML = '<div class="empty-note">불러오는 중...</div>';
      loadDetail(g).then(() => { if (box.isConnected) mountRecords(box, g); }).catch(() => { box.innerHTML = '<div class="empty-note">기록을 불러오지 못했어요.</div>'; });
      $("closeDetail").onclick = () => { location.hash = "#/attend"; };
      setTimeout(() => lay.classList.add("has-detail"), 40);
    } else {
      lay.classList.remove("has-detail");
    }
  }
  $("panelList").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      e.stopPropagation();
      toggleAtt(rm.dataset.rm);
      const m = location.hash.match(/^#\/attend\/(.+)$/);
      const cur = m && decodeURIComponent(m[1]);
      if (cur === rm.dataset.rm) location.hash = "#/attend"; else renderAttend(cur);
      return;
    }
    const it = e.target.closest(".att-item");
    if (it) location.hash = "#/attend/" + it.dataset.id;
  });
  $("panelList").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { const it = e.target.closest(".att-item"); if (it) { e.preventDefault(); location.hash = "#/attend/" + it.dataset.id; } }
  });

  // ----- 라우팅 -----
  let curGame = null;
  function syncAttendBtn() {
    const on = curGame && isAtt(curGame.id);
    const b = $("attendBtn");
    b.classList.toggle("on", !!on);
    b.textContent = on ? "✓ 직관 완료" : "+ 직관";
    b.title = on ? "누르면 직관 기록에서 삭제됩니다" : "직관 기록에 추가";
  }
  $("attendBtn").onclick = () => { if (curGame) { toggleAtt(curGame.id); syncAttendBtn(); } };
  $("backBtn").onclick = () => { location.hash = "#/calendar"; };

  function route() {
    const h = location.hash || "#/";
    const gm = h.match(/^#\/game\/(.+)$/);
    const am = h.match(/^#\/attend(?:\/(.+))?$/);
    const g = gm && GAMES.find((x) => x.id === decodeURIComponent(gm[1]));
    const isCal = h === "#/calendar" || (gm && !g);
    const view = g ? "game" : isCal ? "calendar" : "attend"; // 기본(첫 화면)은 직관 페이지
    $("calendarView").hidden = view !== "calendar";
    $("gameView").hidden = view !== "game";
    $("attendView").hidden = view !== "attend";
    document.querySelector("main").classList.toggle("wide", view === "attend");
    $("navAttend").classList.toggle("active", view === "attend");
    $("navCal").classList.toggle("active", view !== "attend");
    curGame = g || null;
    if (view === "game") {
      $("gameHead").innerHTML = '<div class="meta">불러오는 중...</div>';
      $("page0").innerHTML = ""; $("page1").innerHTML = "";
      loadDetail(g).then(() => { if (curGame === g) renderGame(g); })
        .catch(() => { if (curGame === g) $("gameHead").innerHTML = '<div class="meta">기록을 불러오지 못했어요.</div>'; });
      syncAttendBtn();
      pager.scrollLeft = 0;
      tabs.forEach((b, k) => b.classList.toggle("active", k === 0));
      window.scrollTo(0, 0);
    } else if (view === "calendar") {
      renderCalendar();
    } else {
      const id = am && am[1] ? decodeURIComponent(am[1]) : null;
      renderAttend(id && isAtt(id) ? id : null);
    }
  }
  // 팀 선택 (전 구단)
  $("teamSel").innerHTML = Object.keys(T).map((k) => `<option value="${k}">${T[k].name}</option>`).join("");
  $("teamSel").onchange = (e) => {
    setTeam(e.target.value);
    if (location.hash === "#/" || location.hash === "") route(); else location.hash = "#/";
  };
  setTeam(ME);
  window.addEventListener("hashchange", route);
  route();
})();
