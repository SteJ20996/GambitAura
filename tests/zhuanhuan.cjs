// Browser check for 轉環 Zhuanhuan. Server at the repo root first: npx http-server -p 8765 -c-1 .
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/') + 'zhuanhuan/';
const spot = (n) => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); });
  await page.reload();
  await page.waitForTimeout(400);
  const st = () => page.evaluate(() => { const s = window.__game.state; return { ply: s.ply, turn: s.turn, winner: s.winner, draw: s.draw, masks: s.masks, busy: window.__game.busy }; });
  const cell = (n) => page.click(`#cells button[data-s="${spot(n)}"]`);
  const turn = (ring, dir) => page.click(`#turnbar .tg:nth-child(${ring}) .tb:${dir > 0 ? 'last-of-type' : 'first-of-type'}`);

  // opening
  ok(await page.locator('#pieces .pc').count() === 6, 'six pieces on the board');
  ok(await page.locator('#pieces .pc.mint').count() === 3 && await page.locator('#pieces .pc.coral').count() === 3, 'three each');
  const s0 = await st();
  const mask = (ns) => ns.reduce((m, n) => m | (1 << spot(n)), 0);
  ok(s0.masks[0] === mask(['d1', 'e2', 'f3']) && s0.masks[1] === mask(['h1', 'a2', 'b3']), 'spiral opening: Mint d1 e2 f3, Coral h1 a2 b3');
  ok(await page.locator('#turnbar .tb:not([disabled])').count() === 6, 'all six ring turns open at the start');

  // vs computer: step e2 to f2, the computer answers
  await cell('e2');
  ok(await page.locator('#marks .mark.step').count() === 4, 'a selected piece shows its four steps');
  await page.screenshot({ path: OUT + '/zhuanhuan-select.png' });
  await cell('f2');
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 15000 });
  ok((await st()).ply === 2, 'computer replied');
  ok(await page.locator('#log li').count() === 2, 'two moves in the log');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/zhuanhuan-desktop.png' });

  // two players: the inner ring turned clockwise is a trap; Coral wins next move on spoke a
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(200);
  ok((await st()).ply === 0, 'two-player game starts fresh');
  await turn(1, 1);
  await page.waitForTimeout(300);
  ok(await page.locator('#turnbar .tg:nth-child(1) .tb:first-of-type').isDisabled(), 'Coral cannot turn the inner ring straight back');
  ok((await page.textContent('#sub')).includes('不能直接轉回'), 'status explains the ban');
  await turn(3, -1);
  const w = await st();
  ok(w.winner === 1, 'Coral wins by lining up a1 a2 a3');
  await page.waitForTimeout(1900);
  ok(await page.locator('#overlay.show').count() === 1, 'result overlay shows');
  ok((await page.textContent('#ovBig')).includes('珊瑚勝'), 'overlay names Coral');
  ok((await page.textContent('#ovSmall')).includes('雙方同時連成'), 'overlay explains that both lined up and the mover wins');
  ok(await page.locator('#pieces .pc.won').count() === 3, 'three winning pieces light up');
  ok((await page.getAttribute('#thread', 'class')).includes('on'), 'a thread is drawn through the line');
  ok(JSON.stringify(await page.evaluate(() => window.__game.score)) === '[0,1]', 'score 0 : 1');
  await page.screenshot({ path: OUT + '/zhuanhuan-end.png' });
  await page.click('#ovLook');
  await page.waitForTimeout(950);
  await page.screenshot({ path: OUT + '/zhuanhuan-line.png' });

  // next game: Coral moves first; then repeat a position three times
  await page.click('#nextBtn');
  await page.waitForTimeout(300);
  ok((await page.textContent('#round')).includes('珊瑚先手'), 'game 2: Coral first');
  ok((await st()).turn === 1, 'Coral to move');
  const shuffle = [['h1', 'g1'], ['d1', 'c1'], ['g1', 'h1'], ['c1', 'd1']];
  for (let rep = 0; rep < 2; rep++) for (const [a, b] of shuffle) {
    if (rep === 1 && a === 'c1') break;
    await cell(a); await cell(b);
  }
  ok((await page.textContent('#sub')).includes('出現兩次'), 'status warns about the repetition');
  await cell('c1');
  ok(await page.locator('#marks .mark.step .tag').count() === 1, 'the drawing step is marked 和');
  await cell('d1');
  await page.waitForTimeout(300);
  ok(await page.locator('#drawDlg[open]').count() === 1, 'the third repetition asks first');
  await page.click('#drawOk');
  await page.waitForTimeout(300);
  ok((await st()).draw === true, 'accepting ends the game in a draw');
  await page.waitForTimeout(900);
  ok((await page.textContent('#ovBig')).includes('和局'), 'overlay says draw');

  // English
  await page.click('[data-lang="en"]');
  ok((await page.textContent('[data-i18n="setup"]')) === 'Setup', 'English labels');
  ok((await page.textContent('#note')).includes('neither side can force a win'), 'English fairness note');
  const copy = await page.evaluate(() => document.body.innerText);
  ok(!copy.includes('—'), 'no em dashes in the page copy');

  // hard computer speed in the worker
  await page.click('#modeSeg button[data-v="ai"]');
  await page.click('#levelSeg button[data-v="hard"]');
  await page.click('#restartBtn');
  await page.waitForTimeout(200);
  await cell('e2'); const t0 = Date.now(); await cell('e3');
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 20000 });
  const ms = Date.now() - t0;
  ok(ms < 4000, 'hard computer replied in ' + ms + ' ms');

  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(String(e)));
  await phone.goto(BASE);
  await phone.evaluate(() => localStorage.setItem('ga-jielu-lang', 'zh'));
  await phone.reload();
  await phone.waitForTimeout(500);
  ok(await phone.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no sideways scroll on a phone');
  const tb = await phone.locator('#turnbar .tb').first().boundingBox();
  ok(tb && tb.width >= 34, 'turn buttons stay a usable size on a phone (' + Math.round(tb.width) + ' px)');
  await phone.screenshot({ path: OUT + '/zhuanhuan-phone.png', fullPage: true });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
