// Browser check for 傾盤 Qingpan. Server at the repo root first: npx http-server -p 8765 -c-1 .
// The scripted lines (a quick win, a repetition) are found with the engine itself, so the test
// follows whatever opening engine.js ships.
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/') + 'qingpan/';
(async () => {
  const E = await import(pathToFileURL(path.join(__dirname, '../qingpan/engine.js')).href);
  const browser = await chromium.launch();
  const errors = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

  // engine facts used below
  const s0 = E.initialState(E.MINT);
  // a short line where Mint drops a piece into its own hole (Coral playing along), with a tilt in it
  let line = null;
  const dfs = (s, depth, seq) => {
    for (const m of E.legalMoves(s)) {
      const n = E.applyMove(s, m);
      if (n.winner !== null) { if (n.winner === E.MINT && n.reason === 'hole' && s.turn === E.MINT && [...seq, m].some((x) => x.t === 'tilt')) { line = [...seq, m]; return true; } continue; }
      if (n.draw || depth <= 1) continue;
      if (dfs(n, depth - 1, [...seq, m])) return true;
    }
    return false;
  };
  for (const d of [3, 5, 7]) if (dfs(s0, d, [])) break;
  ok(!!line, 'engine: found a short line where Mint drops a piece in its hole (' + (line || []).map(E.moveText).join(', ') + ')');
  // a 4-move cycle of steps back to the start, from Coral-first
  const c0 = E.initialState(E.CORAL);
  let cyc = null;
  const cdfs = (s, depth, seq) => {
    if (depth === 0) { if (s.m === c0.m && s.c === c0.c && s.last === null) { cyc = seq; return true; } return false; }
    for (const m of E.legalMoves(s)) {
      if (m.t !== 'step') continue;
      const n = E.step(s, m);
      if (n.winner !== null) continue;
      if (cdfs(n, depth - 1, [...seq, m])) return true;
    }
    return false;
  };
  cdfs(c0, 4, []);
  ok(!!cyc, 'engine: found a 4-move cycle back to the start (' + (cyc || []).map(E.moveText).join(', ') + ')');

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); });
  await page.reload();
  await page.waitForTimeout(900);
  const st = () => page.evaluate(() => { const s = window.__game.state; return { m: s.m, c: s.c, ply: s.ply, turn: s.turn, last: s.last, winner: s.winner, reason: s.reason, draw: s.draw, busy: window.__game.busy }; });
  const cellClick = (i) => page.click(`#hits rect:nth-child(${i + 1})`, { force: true });
  const arrow = (d) => page.click(`#arrows g:nth-child(${d + 1})`, { force: true });
  const move = async (m) => { if (m.t === 'tilt') await arrow(m.d); else { await cellClick(m.from); await cellClick(m.to); } await page.waitForTimeout(80); };

  ok((await st()).m === s0.m && (await st()).c === s0.c, 'the page starts from the shipped opening');
  ok(await page.locator('#pieces .piece').count() === 6 && await page.locator('#cells .pillar').count() === 2 && await page.locator('#holes .hole').count() === 2, 'six pieces, two pillars, two holes');
  const t0m = E.legalMoves(s0).find((m) => m.t === 'tilt');
  await page.hover(`#arrows g:nth-child(${t0m.d + 1})`, { force: true });
  await page.waitForTimeout(150);
  const nPaths = E.tilt(s0.m, s0.c, t0m.d).paths.length;
  ok(await page.locator('#ghosts circle').count() === nPaths, `hovering an arrow shows where the ${nPaths} moving pieces would go`);
  await page.screenshot({ path: OUT + '/qingpan-hover.png' });
  const st0 = E.legalMoves(s0).find((m) => m.t === 'step');
  await cellClick(st0.from);
  await page.waitForTimeout(150);
  const nDots = E.legalMoves(s0).filter((m) => m.t === 'step' && m.from === st0.from).length;
  ok(await page.locator('#dots circle.dot').count() === nDots, `selecting a piece shows its ${nDots} steps`);
  // vs computer: tilt, the computer answers
  const safeTilt = E.legalMoves(s0).find((m) => m.t === 'tilt' && E.applyMove(s0, m).winner === null && E.legalMoves(E.applyMove(s0, m)).every((r) => E.step(E.applyMove(s0, m), r).winner === null)) || t0m;
  await arrow(safeTilt.d);
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 15000 });
  ok((await st()).ply === 2, 'the computer replied');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/qingpan-desktop.png' });

  // two players: a tilt bans the way back; then the scripted win
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(300);
  ok((await st()).ply === 0, 'two-player game starts fresh');
  await arrow(safeTilt.d);
  await page.waitForTimeout(300);
  ok((await st()).last === safeTilt.d && await page.locator(`#arrows g:nth-child(${((safeTilt.d + 2) % 4) + 1}).off`).count() === 1, 'the tilt straight back is switched off');
  ok((await page.textContent('#sub')).includes('不能往'), 'the status explains the ban');
  const want = E.applyMove(s0, safeTilt);
  ok((await st()).m === want.m && (await st()).c === want.c, 'every piece slid where the engine says');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => [...document.querySelectorAll('#pieces .piece')].filter((g) => !g.classList.contains('gone')).length) === E.cellsOf(want.m).length + E.cellsOf(want.c).length, 'the drawing shows the same pieces');
  await page.click('#restartBtn');
  await page.waitForTimeout(300);
  for (const m of line) await move(m);
  ok((await st()).winner === E.MINT && (await st()).reason === 'hole', 'Mint wins by dropping a piece in its hole');
  await page.waitForTimeout(1500);
  ok(await page.locator('#overlay.show').count() === 1 && (await page.textContent('#ovBig')).includes('薄荷勝'), 'overlay: 薄荷勝');
  ok(await page.locator('#hole0.hit').count() === 1, 'the hole lights up');
  ok(JSON.stringify(await page.evaluate(() => window.__game.score)) === '[1,0]', 'score 1 : 0');
  await page.click('#ovLook');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/qingpan-win.png' });

  // next game: Coral first; going round the cycle twice asks first and ends in a draw
  await page.click('#nextBtn');
  await page.waitForTimeout(400);
  ok((await page.textContent('#round')).includes('珊瑚先手') && (await st()).turn === 1, 'game 2: Coral moves first');
  for (const m of cyc) await move(m);
  ok((await page.textContent('#sub')).includes('出現兩次'), 'back at the start: the status warns about the repetition');
  for (let k = 0; k < 3; k++) await move(cyc[k]);
  await cellClick(cyc[3].from);
  await page.waitForTimeout(150);
  ok(await page.locator('#dots text.tag').count() >= 1, 'the drawing move is marked 和');
  await cellClick(cyc[3].to);
  await page.waitForTimeout(300);
  ok(await page.locator('#drawDlg[open]').count() === 1, 'the third repetition asks first');
  await page.click('#drawOk');
  await page.waitForTimeout(300);
  ok((await st()).draw === true, 'accepting ends the game in a draw');

  // English
  await page.click('[data-lang="en"]');
  ok((await page.textContent('[data-i18n="setup"]')) === 'Setup', 'English labels');
  const copy = await page.evaluate(() => document.body.innerText);
  ok(!copy.includes('—'), 'no em dashes in the page copy');

  // hard computer speed in the worker
  await page.click('#modeSeg button[data-v="ai"]');
  await page.click('#levelSeg button[data-v="hard"]');
  await page.click('#restartBtn');
  await page.waitForTimeout(300);
  const t1 = Date.now(); await arrow(safeTilt.d);
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 30000 });
  ok(Date.now() - t1 < 5000, 'hard computer replied in ' + (Date.now() - t1) + ' ms');

  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(String(e)));
  await phone.goto(BASE);
  await phone.evaluate(() => localStorage.setItem('ga-jielu-lang', 'zh'));
  await phone.reload();
  await phone.waitForTimeout(800);
  ok(await phone.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no sideways scroll on a phone');
  const cell = await phone.locator('#hits rect').first().boundingBox();
  const arr = await phone.locator('#arrows g').first().boundingBox();
  ok(cell && cell.width >= 44 && arr && arr.width >= 44, `squares (${cell ? Math.round(cell.width) : 0} px) and arrows (${arr ? Math.round(arr.width) : 0} px) are big enough to tap on a phone`);
  await phone.screenshot({ path: OUT + '/qingpan-phone.png', fullPage: true });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
