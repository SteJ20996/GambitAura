// Browser check for 日影 Riying. Server at the repo root first: npx http-server -p 8765 -c-1 .
// The scripted lines (a quick win, a repetition) are found with the engine itself, so the test
// follows whatever opening engine.js ships.
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/') + 'riying/';
(async () => {
  const E = await import(pathToFileURL(path.join(__dirname, '../riying/engine.js')).href);
  const browser = await chromium.launch();
  const errors = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

  // engine facts used below
  const s0 = E.initialState(E.MINT);
  ok(E.legalMoves(s0).every((m) => E.step(s0, m).winner === null), 'engine: nobody wins on move one');
  // a short line where Mint walks a tower onto its target (Coral playing along)
  let line = null;
  const dfs = (s, depth, seq) => {
    for (const m of E.legalMoves(s)) {
      const n = E.applyMove(s, m);
      if (n.winner !== null) { if (n.winner === E.MINT && n.reason === 'target') { line = [...seq, m]; return true; } continue; }
      if (n.draw || depth <= 1) continue;
      if (dfs(n, depth - 1, [...seq, m])) return true;
    }
    return false;
  };
  for (const d of [5, 7, 9, 11]) if (dfs(s0, d, [])) break;
  ok(!!line, 'engine: found a short line where Mint reaches its target (' + (line || []).map(E.moveText).join(' ') + ')');
  // the shortest line to a turn where the side to move has a tower in shade
  let shadeLine = null;
  for (let frontier = [[s0, []]], d = 0; d < 5 && !shadeLine; d++) {
    const nextF = [];
    for (const [s, seq] of frontier) {
      if (E.frozen(s).some((f, t) => f && E.OWNER[t] === s.turn)) { shadeLine = seq; break; }
      for (const m of E.legalMoves(s)) { const n = E.step(s, m); if (n.winner === null) nextF.push([n, [...seq, m]]); }
    }
    frontier = nextF;
  }
  ok(!!shadeLine, 'engine: found a line to a tower stuck in shade (' + (shadeLine || []).map(E.moveText).join(' ') + ')');
  // an 8-move cycle back to the start (the sun needs 8 moves to come round), from Coral-first
  const c0 = E.initialState(E.CORAL);
  let cyc = null;
  const cdfs = (s, depth, seq) => {
    if (depth === 0) { if (s.towers.join() === c0.towers.join()) { cyc = seq; return true; } return false; }
    for (const m of E.legalMoves(s)) {
      const n = E.step(s, m);
      if (n.winner !== null) continue;
      // keep each tower within one step of home so the line closes
      if (n.towers.some((c, t) => Math.abs(Math.floor(c / 5) - Math.floor(c0.towers[t] / 5)) + Math.abs((c % 5) - (c0.towers[t] % 5)) > Math.ceil((depth - 1) / 2))) continue;
      if (cdfs(n, depth - 1, [...seq, m])) return true;
    }
    return false;
  };
  cdfs(c0, 8, []);
  ok(!!cyc, 'engine: found an 8-move cycle back to the start (' + (cyc || []).map(E.moveText).join(' ') + ')');

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); });
  await page.reload();
  await page.waitForTimeout(900);
  const st = () => page.evaluate(() => { const s = window.__game.state; return { towers: s.towers, sun: s.sun, ply: s.ply, turn: s.turn, winner: s.winner, reason: s.reason, draw: s.draw, busy: window.__game.busy }; });
  const cellClick = (i) => page.click(`#hits rect:nth-child(${i + 1})`, { force: true });
  const move = async (m) => { await cellClick(m.from); await cellClick(m.to); };

  ok(JSON.stringify((await st()).towers) === JSON.stringify(s0.towers) && (await st()).sun === E.START.sun, 'the page starts from the shipped opening');
  ok(await page.locator('#towers .tower').count() === 4, 'four towers are drawn');
  ok((await page.textContent('#tag')).includes('南'), 'the tag says where the sun is');
  const shadeCells = new Set(E.shades(s0.towers, s0.sun).flat()).size;
  ok(await page.locator('#shade rect').count() === shadeCells, `the ${shadeCells} shaded squares are darkened`);

  // select a tower: its moves appear as dots; hovering one previews the next shade
  const m0 = E.legalMoves(s0).find((m) => m.t === 1) || E.legalMoves(s0)[0];
  await cellClick(m0.from);
  await page.waitForTimeout(150);
  const nDots = E.legalMoves(s0).filter((m) => m.t === m0.t).length;
  ok(await page.locator('#dots circle.dot').count() === nDots, `selecting a tower shows its ${nDots} moves`);
  await page.hover(`#hits rect:nth-child(${m0.to + 1})`, { force: true });
  await page.waitForTimeout(150);
  ok(await page.locator('#preview rect').count() >= 1, 'hovering a move previews the shade the other side will face');
  await page.screenshot({ path: OUT + '/riying-select.png' });
  // vs computer: move, the computer answers
  await cellClick(m0.to);
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 15000 });
  ok((await st()).ply === 2 && (await st()).sun === (E.START.sun + 2) % 8, 'the computer replied and the sun moved two places');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/riying-desktop.png' });

  // two players: a tower in shade is veiled and explained
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(300);
  ok((await st()).ply === 0, 'two-player game starts fresh');
  let s = s0;
  for (const m of shadeLine) { await move(m); s = E.applyMove(s, m); }
  await page.waitForTimeout(500);
  const fzn = E.frozen(s).filter(Boolean).length;
  ok(await page.locator('#towers .tower.frozen').count() === fzn, `the ${fzn} tower(s) standing in shade are veiled`);
  ok((await page.textContent('#sub')).includes('在影子裡'), 'the status says which tower cannot move');
  await page.screenshot({ path: OUT + '/riying-shade.png' });
  // the scripted win from a fresh game
  await page.click('#restartBtn');
  await page.waitForTimeout(300);
  for (const m of line) await move(m);
  ok((await st()).winner === E.MINT && (await st()).reason === 'target', 'Mint wins by reaching c5');
  await page.waitForTimeout(1500);
  ok(await page.locator('#overlay.show').count() === 1 && (await page.textContent('#ovBig')).includes('薄荷勝'), 'overlay: 薄荷勝');
  ok(await page.locator('#tgt0.hit').count() === 1, 'the target lights up');
  ok(JSON.stringify(await page.evaluate(() => window.__game.score)) === '[1,0]', 'score 1 : 0');
  await page.click('#ovLook');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/riying-win.png' });

  // next game: Coral first; going round the cycle twice asks first and ends in a draw
  await page.click('#nextBtn');
  await page.waitForTimeout(400);
  ok((await page.textContent('#round')).includes('珊瑚先手') && (await st()).turn === 1, 'game 2: Coral moves first');
  for (let k = 0; k < 8; k++) await move(cyc[k]);
  ok((await page.textContent('#sub')).includes('出現兩次'), 'back at the start: the status warns about the repetition');
  for (let k = 0; k < 7; k++) await move(cyc[k]);
  await cellClick(cyc[7].from);
  await page.waitForTimeout(150);
  ok(await page.locator('#dots text.tag').count() >= 1, 'the drawing move is marked 和');
  await cellClick(cyc[7].to);
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
  const t0 = Date.now(); await move(m0);
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 30000 });
  ok(Date.now() - t0 < 5000, 'hard computer replied in ' + (Date.now() - t0) + ' ms');

  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(String(e)));
  await phone.goto(BASE);
  await phone.evaluate(() => localStorage.setItem('ga-jielu-lang', 'zh'));
  await phone.reload();
  await phone.waitForTimeout(800);
  ok(await phone.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no sideways scroll on a phone');
  const cell = await phone.locator('#hits rect').first().boundingBox();
  ok(cell && cell.width >= 44, `each square is a ${cell ? Math.round(cell.width) : 0} px target on the phone`);
  await phone.screenshot({ path: OUT + '/riying-phone.png', fullPage: true });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
