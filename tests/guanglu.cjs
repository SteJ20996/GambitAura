// Browser check for 光路 Guanglu. Server at the repo root first: npx http-server -p 8765 -c-1 .
// The scripted lines (a quick win, a repetition) are found with the engine itself, so the test
// follows whatever layout engine.js ships.
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/') + 'guanglu/';
(async () => {
  const E = await import(pathToFileURL(path.join(__dirname, '../guanglu/engine.js')).href);
  const browser = await chromium.launch();
  const errors = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

  // engine facts used below
  const s0 = E.initialState();
  const b0 = E.beams(s0.cfg, s0.design);
  const flips = (s) => E.legalMoves(s).filter((m) => m.t === 'flip').map((m) => m.i);
  ok(!b0[0].hit && !b0[1].hit, 'engine: neither beam starts on its target');
  // a short line where Mint wins (Coral playing along), found by a small search: 3, 5 or 7 moves
  let line = null;
  const dfs = (s, depth, seq) => {
    for (const k of flips(s)) {
      const n = E.applyMove(s, { t: 'flip', i: k });
      if (n.winner === E.MINT && s.turn === E.MINT) { line = [...seq, k]; return true; }
      if (n.winner !== null || depth <= 1) continue;
      if (dfs(n, depth - 1, [...seq, k])) return true;
    }
    return false;
  };
  for (const d of [3, 5, 7]) if (dfs(s0, d, [])) break;
  ok(!!line, 'engine: found a short line where Mint wins (' + (line || []).map(E.cellName).join(' ') + ')');
  // a repetition: x, y, x, y returns to the start with nobody winning
  let cyc = null;
  for (const x of flips(s0)) {
    const s1 = E.applyMove(s0, { t: 'flip', i: x });
    if (s1.winner !== null) continue;
    for (const y of flips(s1)) {
      let s = s1, good = true;
      for (const k of [y, x, y]) {
        if (!flips(s).includes(k)) { good = false; break; }
        s = E.applyMove(s, { t: 'flip', i: k });
        if (s.winner !== null) { good = false; break; }
      }
      if (good && s.cfg === s0.cfg) { cyc = [x, y]; break; }
    }
    if (cyc) break;
  }
  ok(!!cyc, 'engine: found a two-mirror repetition (' + (cyc || []).map(E.cellName).join(' ') + ')');

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); });
  await page.reload();
  await page.waitForTimeout(900);
  const st = () => page.evaluate(() => { const s = window.__game.state; return { cfg: s.cfg, ply: s.ply, turn: s.turn, winner: s.winner, draw: s.draw, ban: s.ban, busy: window.__game.busy }; });
  const flip = (i) => page.click(`#hits rect:nth-child(${i + 1})`, { force: true });

  ok((await st()).cfg === s0.cfg, 'the page starts from the shipped layout');
  ok(await page.locator('#beams polyline.core').count() === 2, 'two beams are drawn');
  const lit = flips(s0).length;
  ok(await page.locator('#hits rect.act').count() === lit && await page.locator('#mirrors .mir.lit').count() === lit, `the ${lit} mirrors on a beam are lit and clickable`);
  ok(await page.locator('#ports .src').count() === 2 && await page.locator('#ports .tgt').count() === 2, 'two sources and two targets on the rim');

  // vs computer: flip, the computer answers
  await page.hover(`#hits rect:nth-child(${flips(s0)[0] + 1})`, { force: true });
  await page.waitForTimeout(150);
  ok(await page.locator('#preview polyline').count() === 2, 'hovering a lit mirror previews both beams');
  await page.screenshot({ path: OUT + '/guanglu-hover.png' });
  await flip(flips(s0)[0]);
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 15000 });
  ok((await st()).ply === 2, 'the computer replied');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/guanglu-desktop.png' });

  // two players: the scripted win
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(300);
  ok((await st()).ply === 0, 'two-player game starts fresh');
  await flip(line[0]);
  ok((await st()).ban === line[0] && await page.locator('#mirrors .mir.ban').count() === 1, 'the mirror just flipped is banned for the reply (dashed)');
  ok((await page.textContent('#sub')).includes('不能翻回'), 'the status explains the ban');
  for (const k of line.slice(1)) await flip(k);
  ok((await st()).winner === 0, 'Mint wins when its beam reaches its target');
  await page.waitForTimeout(1800);
  ok(await page.locator('#overlay.show').count() === 1 && (await page.textContent('#ovBig')).includes('薄荷勝'), 'overlay: 薄荷勝');
  ok(await page.locator('#ports .tgt.hit').count() >= 1, 'the target lights up');
  ok(JSON.stringify(await page.evaluate(() => window.__game.score)) === '[1,0]', 'score 1 : 0');
  await page.click('#ovLook');
  await page.waitForTimeout(950);
  await page.screenshot({ path: OUT + '/guanglu-win.png' });

  // next game: Coral first; a repetition asks first and ends in a draw
  await page.click('#nextBtn');
  await page.waitForTimeout(400);
  ok((await page.textContent('#round')).includes('珊瑚先手') && (await st()).turn === 1, 'game 2: Coral moves first');
  // every position repeats each four moves; the ninth move makes the first third occurrence
  for (let k = 0; k < 8; k++) await flip(cyc[k % 2]);
  ok((await page.textContent('#sub')).includes('出現兩次'), 'the status warns about the repetition');
  ok(await page.locator('#hits text.tag').count() >= 1, 'the drawing mirror is marked 和');
  await flip(cyc[0]);
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
  const t0 = Date.now(); await flip(flips(s0)[0]);
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
  ok(cell && cell.width >= 44, `each mirror is a ${cell ? Math.round(cell.width) : 0} px target on the phone`);
  await phone.screenshot({ path: OUT + '/guanglu-phone.png', fullPage: true });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
