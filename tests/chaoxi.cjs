// Browser check for 潮汐 Chaoxi. Server at the repo root first: npx http-server -p 8765 -c-1 .
// The scripted lines (a quick win, a repetition) are found with the engine itself, so the test
// follows whatever opening engine.js ships.
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/') + 'chaoxi/';
(async () => {
  const E = await import(pathToFileURL(path.join(__dirname, '../chaoxi/engine.js')).href);
  const browser = await chromium.launch();
  const errors = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

  // engine facts used below: shortest lines found by breadth-first search over steps only
  const s0 = E.initialState(E.MINT);
  const bfs = (start, goal, maxDepth) => {
    const seen = new Set([E.positionKey(start)]);
    let frontier = [[start, []]];
    for (let d = 0; d < maxDepth; d++) {
      const nextF = [];
      for (const [s, seq] of frontier) {
        for (const m of E.legalMoves(s)) {
          if (m.t !== 'step') continue;
          const n = E.step(s, m);
          if (goal(s, m, n)) return [...seq, m];
          if (n.winner !== null) continue;
          const k = E.positionKey(n);
          if (seen.has(k)) continue;
          seen.add(k);
          nextF.push([n, [...seq, m]]);
        }
      }
      frontier = nextF;
    }
    return null;
  };
  const line = bfs(s0, (s, m, n) => n.winner === E.MINT, 30);
  ok(!!line, 'engine: found a line where Mint reaches c5 (' + (line || []).length + ' moves)');
  const wetLine = bfs(s0, (s, m, n) => n.winner === null && E.stranded(n).some((w, t) => w && (t < 2 ? E.MINT : E.CORAL) === n.turn), 20);
  ok(!!wetLine, 'engine: found a line to a piece stuck in water (' + (wetLine || []).map(E.moveText).join(' ') + ')');
  // a cycle back to the start: the tide needs a multiple of 6 moves and each piece an even number of
  // steps, so the shortest is 12 moves: four shore moves (never flooded), three times
  const c0 = E.initialState(E.CORAL);
  const sq = (n) => (5 - +n[1]) * 5 + 'abcde'.indexOf(n[0]);
  const four = [['b5', 'c5'], ['d1', 'c1'], ['c5', 'b5'], ['c1', 'd1']].map(([f, t]) => ({ t: 'step', from: sq(f), to: sq(t) }));
  const cyc = [...four, ...four, ...four];
  let cs = c0, cycOk = true;
  for (const m of cyc) { if (!E.legalMoves(cs).some((x) => E.sameMove(x, m))) cycOk = false; cs = E.step(cs, m); }
  ok(cycOk && cs.pieces.join() === c0.pieces.join() && cs.phase === c0.phase, 'engine: a 12-move cycle of shore moves returns to the start');

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); });
  await page.reload();
  await page.waitForTimeout(900);
  const st = () => page.evaluate(() => { const s = window.__game.state; return { pieces: s.pieces, phase: s.phase, ply: s.ply, turn: s.turn, winner: s.winner, draw: s.draw, busy: window.__game.busy }; });
  const cellClick = (i) => page.click(`#hits rect:nth-child(${i + 1})`, { force: true });
  const move = async (m) => { await cellClick(m.from); await cellClick(m.to); await page.waitForTimeout(60); };

  ok(JSON.stringify((await st()).pieces) === JSON.stringify(s0.pieces) && (await st()).phase === E.START.phase, 'the page starts from the shipped opening');
  ok(await page.locator('#pieces .piece').count() === 4 && await page.locator('#gauge .gbar').count() === E.TIDE.length, 'four pieces and the six-step tide gauge');
  ok((await page.textContent('#gauge .gtext')).includes('潮位 0'), 'the gauge reads the tide now');
  const soon = E.HEIGHTS.filter((h, i) => !E.wet(i, s0.phase) && E.wet(i, (s0.phase + 1) % 6)).length;
  ok(await page.locator('#water .soon.on').count() === soon, `the ${soon} squares that flood after this move are dashed`);
  const m0 = E.legalMoves(s0).find((m) => m.t === 'step' && E.applyMove(s0, m).winner === null);
  await cellClick(m0.from);
  await page.waitForTimeout(150);
  ok(await page.locator('#dots circle.dot').count() === E.legalMoves(s0).filter((m) => m.from === m0.from).length, 'selecting a piece shows its moves');
  await page.screenshot({ path: OUT + '/chaoxi-select.png' });
  await cellClick(m0.to);
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 15000 });
  ok((await st()).ply === 2 && (await st()).phase === 2, 'the computer replied and the tide moved on two steps');
  ok(await page.locator('#water .water.on').count() === E.HEIGHTS.filter((h, i) => E.wet(i, 2)).length, 'the water covers every square below the tide');
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + '/chaoxi-desktop.png' });

  // two players: a piece stuck in water is veiled and explained
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(300);
  ok((await st()).ply === 0, 'two-player game starts fresh');
  for (const m of wetLine) await move(m);
  await page.waitForTimeout(500);
  const s1 = wetLine.reduce((s, m) => E.applyMove(s, m), s0);
  ok(await page.locator('#pieces .piece.wet').count() === E.stranded(s1).filter(Boolean).length, 'pieces standing in water are veiled');
  ok((await page.textContent('#sub')).includes('退潮前不能動'), 'the status says which piece cannot move');
  await page.screenshot({ path: OUT + '/chaoxi-stuck.png' });
  // the scripted win from a fresh game
  await page.click('#restartBtn');
  await page.waitForTimeout(300);
  for (const m of line) await move(m);
  ok((await st()).winner === E.MINT, 'Mint wins by reaching c5');
  await page.waitForTimeout(1500);
  ok(await page.locator('#overlay.show').count() === 1 && (await page.textContent('#ovBig')).includes('薄荷勝'), 'overlay: 薄荷勝');
  ok(await page.locator('#tgt0.hit').count() === 1, 'the target lights up');
  ok(JSON.stringify(await page.evaluate(() => window.__game.score)) === '[1,0]', 'score 1 : 0');
  await page.click('#ovLook');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/chaoxi-win.png' });

  // next game: Coral first; going round the cycle twice asks first and ends in a draw
  await page.click('#nextBtn');
  await page.waitForTimeout(400);
  ok((await page.textContent('#round')).includes('珊瑚先手') && (await st()).turn === 1, 'game 2: Coral moves first');
  for (const m of cyc) await move(m);
  ok((await page.textContent('#sub')).includes('出現兩次'), 'back at the start: the status warns about the repetition');
  for (let k = 0; k < 11; k++) await move(cyc[k]);
  await cellClick(cyc[11].from);
  await page.waitForTimeout(150);
  ok(await page.locator('#dots text.tag').count() >= 1, 'the drawing move is marked 和');
  await cellClick(cyc[11].to);
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
  const t1 = Date.now(); await move(m0);
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
  ok(cell && cell.width >= 44, `each square is a ${cell ? Math.round(cell.width) : 0} px target on the phone`);
  await phone.screenshot({ path: OUT + '/chaoxi-phone.png', fullPage: true });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
