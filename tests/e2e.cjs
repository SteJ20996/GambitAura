// End-to-end check of the series page, the game and the fairness page.
// Run a static server at the repo root first:  npx http-server -p 8765 -c-1 .
// then:  node tests/e2e.cjs   (screenshots go to tests/out/)
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const cell = (n) => (n.charCodeAt(1) - 49) * 5 + (n.charCodeAt(0) - 65);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

  // landing
  await page.goto(BASE);
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/landing-desktop.png', fullPage: true });
  ok(await page.locator('a[href="jielu/"]').count() >= 1, 'landing play link');
  ok(await page.locator('a[href="zhuanhuan/"]').count() >= 1, 'hub links Game 02, 轉環');
  ok((await page.request.get(BASE + 'zhuanhuan/')).ok() && (await page.request.get(BASE + 'zhuanhuan/analysis/')).ok(), '轉環 and its fairness page are served');
  ok(await page.locator('a[href="guanglu/"]').count() >= 1, 'hub links Game 03, 光路');
  ok(await page.locator('#mGl path').count() === 20, '光路 mini board drawn from its engine (20 mirrors)');
  ok((await page.request.get(BASE + 'guanglu/')).ok() && (await page.request.get(BASE + 'guanglu/analysis/')).ok(), '光路 and its fairness page are served');
  ok(await page.locator('a[href="riying/"]').count() >= 1, 'hub links Game 04, 日影');
  ok(await page.locator('#mRy circle').count() >= 7, '日影 mini board drawn from its engine (towers, targets, sun)');
  ok((await page.request.get(BASE + 'riying/')).ok() && (await page.request.get(BASE + 'riying/analysis/')).ok(), '日影 and its fairness page are served');
  ok(await page.locator('a[href="qingpan/"]').count() >= 1, 'hub links Game 05, 傾盤');
  ok(await page.locator('#mQp circle').count() >= 10, '傾盤 mini board drawn from its engine (pieces, holes)');
  ok((await page.request.get(BASE + 'qingpan/')).ok() && (await page.request.get(BASE + 'qingpan/analysis/')).ok(), '傾盤 and its fairness page are served');
  ok(await page.locator('a[href="chaoxi/"]').count() >= 1, 'hub links Game 06, 潮汐');
  ok(await page.locator('#mCx rect').count() >= 25, '潮汐 mini board drawn from its engine (terrain, water)');
  ok((await page.request.get(BASE + 'chaoxi/')).ok() && (await page.request.get(BASE + 'chaoxi/analysis/')).ok(), '潮汐 and its fairness page are served');
  for (const g of ['hex/', 'reversi/', 'gomoku/', 'nim/']) {
    ok(await page.locator(`a.classic[href="${g}"]`).count() === 1, 'hub card for ' + g);
    const r = await page.request.get(BASE + g);
    ok(r.ok(), g + ' page is served');
  }

  // game, vs computer, standard opening
  await page.goto(BASE + 'jielu/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); });
  await page.reload();
  await page.waitForTimeout(300);
  const clickCell = (n) => page.click(`#cells .cellbtn:nth-child(${cell(n) + 1})`);
  const st = () => page.evaluate(() => { const s = window.__jielu.state; return { turn: s.turn, ply: s.ply, pieces: s.pieces, holes: s.holes, winner: s.winner, draw: s.draw, busy: window.__jielu.busy }; });
  ok((await st()).turn === 0, 'Mint moves first on load');
  ok((await page.textContent('#ver')) === '標準開局' && (await page.textContent('#layoutSeg')).includes('最初'), 'openings are named 標準 / 最初, not by version');
  await clickCell('B5');
  ok(await page.locator('#marks .mark.walk').count() === 2, 'two step targets for B5 (A5, B4)');
  await page.screenshot({ path: OUT + '/game-selected.png' });
  await clickCell('B4');
  await page.waitForFunction(() => window.__jielu.state.ply === 2 && !window.__jielu.busy, null, { timeout: 15000 });
  const s2 = await st();
  ok(s2.pieces[0].includes(cell('B4')), 'Mint piece now on B4');
  ok(await page.locator('#log li').count() === 2, 'log shows two moves (computer replied)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/game-after-ai.png' });

  // v0.4 floor move through the UI
  await page.click('#layoutSeg button[data-v="v04"]');
  await page.waitForTimeout(200);
  ok((await st()).ply === 0, 'switching opening restarts');
  ok(await page.locator('#marks .mark.lift').count() === 2, 'two liftable tiles (A5, E5) in v0.4');
  await clickCell('A5');
  ok(await page.locator('#marks .mark.drop').count() === 1, 'one drop target (B4)');
  await page.screenshot({ path: OUT + '/game-lift.png' });
  await clickCell('B4');
  await page.waitForTimeout(150);
  const s3 = await st();
  ok(!((s3.holes >> cell('B4')) & 1) && ((s3.holes >> cell('A5')) & 1), 'tile moved A5 -> B4');
  await page.waitForFunction(() => window.__jielu.state.ply === 2 && !window.__jielu.busy, null, { timeout: 15000 });

  // two players: repetition draw with confirm dialog (v0.5)
  await page.click('#layoutSeg button[data-v="v05"]');
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(200);
  const seq = [['B5', 'A5'], ['B1', 'A1'], ['A5', 'B5'], ['A1', 'B1'], ['B5', 'A5'], ['B1', 'A1'], ['A5', 'B5']];
  for (const [a, b] of seq) { await clickCell(a); await clickCell(b); await page.waitForTimeout(60); }
  ok((await page.textContent('#sub')).includes('兩次'), 'repetition warning shown (zh)');
  await clickCell('A1');
  ok(await page.locator('#marks .tag').count() === 1, 'draw tag on the repeating target');
  await page.screenshot({ path: OUT + '/game-drawtag.png' });
  await clickCell('B1');
  ok(await page.locator('#drawDlg[open]').count() === 1, 'draw confirm dialog opens');
  await page.screenshot({ path: OUT + '/game-drawdlg.png' });
  await page.click('#drawCancel');
  ok((await st()).ply === 7, 'cancel keeps the move unplayed');
  await clickCell('B1');
  await page.click('#drawOk');
  await page.waitForFunction(() => window.__jielu.state.draw, null, { timeout: 3000 }).catch(() => {});
  ok((await st()).draw === true, 'accepting ends in a draw');
  await page.waitForTimeout(900);
  ok((await page.textContent('#ovBig')) === '和局', 'draw overlay says 和局');
  await page.screenshot({ path: OUT + '/game-draw-overlay.png' });
  ok(await page.isVisible('#nextBtn'), 'next game button visible');
  await page.click('#nextBtn');
  await page.waitForTimeout(100);
  ok((await st()).turn === 1, 'next game: Coral moves first');

  // play a full random two-player game to the end through the UI
  for (let i = 0; i < 400; i++) {
    const s = await st();
    if (s.winner !== null || s.draw) break;
    // pick a random legal move from the engine and click it
    const pick = await page.evaluate(async () => {
      const E = await import('./engine.js');
      const s = window.__jielu.state;
      const ms = E.legalMoves(s);
      const m = ms.find((x) => x.win) || ms[Math.floor(Math.random() * ms.length)];
      return m;
    });
    const name = (c) => 'ABCDE'[c % 5] + (Math.floor(c / 5) + 1);
    if (pick.t === 'pass') { await page.click('#passBtn'); }
    else if (pick.t === 'walk') { await clickCell(name(pick.from)); await clickCell(name(pick.to)); }
    else { await clickCell(name(pick.src)); await clickCell(name(pick.dst)); }
    if (await page.locator('#drawDlg[open]').count()) await page.click('#drawOk');
  }
  const fin = await st();
  ok(fin.winner !== null || fin.draw, 'random two-player game reached an end (' + (fin.winner !== null ? 'winner ' + fin.winner : 'draw') + ', ply ' + fin.ply + ')');
  await page.waitForTimeout(900);
  ok(await page.locator('#overlay.show').count() === 1, 'result overlay shows');
  if (fin.winner !== null) {
    const sc = await page.evaluate(() => window.__jielu.score);
    ok(sc[fin.winner] === 1, 'scoreboard counted the win');
    ok((await page.textContent(fin.winner === 0 ? '#ptsMint' : '#ptsCoral')) === '1', 'scoreboard shows 1');
  }
  await page.screenshot({ path: OUT + '/game-end.png' });
  await page.click('#ovLook');
  await page.waitForTimeout(600);
  ok(await page.locator('#overlay.show').count() === 0, 'look at the board hides the overlay');
  await page.click('#nextBtn');
  await page.waitForTimeout(150);
  ok((await page.textContent('#round')).includes('3'), 'game counter moved on to game 3');

  // English
  await page.click('[data-lang="en"]');
  ok((await page.textContent('[data-i18n="setup"]')) === 'Setup', 'English labels');
  await page.click('#restartBtn');
  await page.screenshot({ path: OUT + '/game-en.png' });

  // phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await phone.newPage();
  p2.on('pageerror', (e) => errors.push(String(e)));
  await p2.goto(BASE + 'jielu/');
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: OUT + '/phone-game.png', fullPage: true });
  const sw = await p2.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, 'no horizontal scroll on phone (scrollWidth ' + sw + ')');
  await p2.goto(BASE);
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: OUT + '/phone-landing.png', fullPage: true });
  const sw2 = await p2.evaluate(() => document.documentElement.scrollWidth);
  ok(sw2 <= 390, 'landing: no horizontal scroll on phone (' + sw2 + ')');

  // analysis page
  await page.goto(BASE + 'jielu/analysis/');
  await page.click('[data-lang="zh"]');
  ok(await page.isVisible('article[data-l="zh"] h1'), 'analysis page shows Chinese article');
  ok(!(await page.isVisible('article[data-l="en"] h1')), 'English article hidden in zh');
  await page.screenshot({ path: OUT + '/analysis-zh.png', fullPage: false });
  await page.click('[data-lang="en"]');
  ok(await page.isVisible('article[data-l="en"] h1'), 'analysis page switches to English');
  // owner, 2026-10-29: no version numbers or proposal wording anywhere a player reads
  const BANNED = /v0\.\d|提案|建議|原版|[Pp]ropos|[Ss]uggest(ed|ion)|[Vv]ersion/;
  // owner, 2026-11-01: the originals carry short English names, never pinyin (lower-case folder
  // names in the fairness pages' commands, like zhuanhuan/analysis, are paths, not names)
  const PINYIN = /\b(Jielu|JIELU|Zhuanhuan|Guanglu|Riying|Qingpan|Chaoxi)\b/;
  for (const u of ['', 'jielu/', 'jielu/analysis/', 'zhuanhuan/', 'zhuanhuan/analysis/', 'guanglu/', 'guanglu/analysis/', 'riying/', 'riying/analysis/', 'qingpan/', 'qingpan/analysis/', 'chaoxi/', 'chaoxi/analysis/']) {
    for (const l of ['zh', 'en']) {
      await page.goto(BASE + u);
      await page.evaluate((l) => localStorage.setItem('ga-jielu-lang', l), l);
      await page.reload();
      await page.waitForTimeout(250);
      const txt = await page.evaluate(() => document.body.innerText + ' ' + document.title);
      const hit = txt.match(BANNED);
      ok(!hit, `no version or proposal wording on /${u} (${l})` + (hit ? ': ' + hit[0] : ''));
      const py = txt.match(PINYIN);
      ok(!py, `no pinyin game names on /${u} (${l})` + (py ? ': ' + py[0] : ''));
    }
  }
  // owner, 2026-11-01: the English pages show no Chinese at all (logo and game names in English
  // only). Text a reader or a screen reader meets, labels on visible elements and the tab title;
  // the one exception is the 中文 chip, the way back for a Chinese reader.
  const ALL = ['', 'jielu/', 'zhuanhuan/', 'guanglu/', 'riying/', 'qingpan/', 'chaoxi/', 'hex/', 'reversi/', 'gomoku/', 'nim/',
    'jielu/analysis/', 'zhuanhuan/analysis/', 'guanglu/analysis/', 'riying/analysis/', 'qingpan/analysis/', 'chaoxi/analysis/'];
  for (const u of ALL) {
    await page.goto(BASE + u);
    await page.evaluate(() => localStorage.setItem('ga-jielu-lang', 'en'));
    await page.reload();
    await page.waitForTimeout(250);
    const cjk = await page.evaluate(() => {
      const CJK = /[\u2e80-\u2fdf\u3000-\u303f\u3100-\u312f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;
      for (const d of document.querySelectorAll('details')) d.open = true;
      const seen = (el) => el.checkVisibility({ checkVisibilityCSS: true });   // true for .sr text too (clipped, not hidden)
      const out = [];
      if (CJK.test(document.title)) out.push('title: ' + document.title);
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        const el = n.parentElement;
        if (el.closest('script, style, [data-lang="zh"]') || !CJK.test(n.nodeValue) || !seen(el)) continue;
        out.push(n.nodeValue.trim().slice(0, 40));
      }
      for (const el of document.querySelectorAll('[aria-label], [title], [alt]')) {
        if (!seen(el)) continue;
        for (const a of ['aria-label', 'title', 'alt']) { const v = el.getAttribute(a); if (v && CJK.test(v)) out.push(a + ': ' + v); }
      }
      return out;
    });
    ok(cjk.length === 0, `no Chinese on the English /${u}` + (cjk.length ? ': ' + cjk.slice(0, 3).join(' | ') : ''));
  }
  await page.evaluate(() => localStorage.setItem('ga-jielu-lang', 'zh'));
  await page.goto(BASE);
  ok(await page.isVisible('.word .zh') && await page.isVisible('.ga-zh'), 'Chinese pages keep 罡曜 in the hero and the lockup');
  // owner, 2026-11-01: the Originals subtitle, the "solved" badge and the fairness button are off the hub
  const GONE = /我們自己設計的棋|已完整求解：雙方都無必勝|我們怎麼檢查公平|Games we design ourselves|Solved: no forced win|How we check fairness/;
  for (const l of ['zh', 'en']) {
    await page.evaluate((l) => localStorage.setItem('ga-jielu-lang', l), l);
    await page.reload();
    const t = await page.evaluate(() => document.body.innerText);
    const g = t.match(GONE);
    ok(!g && await page.locator('#games a[href$="analysis/"]').count() === 0, `hub (${l}) has no Originals subtitle, solved badge or fairness button` + (g ? ': ' + g[0] : ''));
  }
  await page.evaluate(() => localStorage.setItem('ga-jielu-lang', 'zh'));
  await p2.goto(BASE + 'jielu/analysis/');
  await p2.waitForTimeout(300);
  const sw3 = await p2.evaluate(() => document.documentElement.scrollWidth);
  ok(sw3 <= 390, 'analysis: no horizontal scroll on phone (' + sw3 + ')');
  await p2.screenshot({ path: OUT + '/phone-analysis.png' });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
