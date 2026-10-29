// Browser check for 取石子 Nim. Server at the repo root first: npx http-server -p 8765 -c-1 .
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/') + 'nim/';
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); localStorage.setItem('ga-nim-level', 'hard'); });
  await page.reload();
  await page.waitForTimeout(300);
  const st = () => page.evaluate(() => { const s = window.__game.state; return { phase: s.phase, piles: s.piles.slice(), turn: s.turn, winner: s.winner, ply: s.ply }; });

  // game 1: you set up, the computer chooses
  ok((await st()).phase === 'setup', 'game 1 starts with your setup');
  ok(await page.isVisible('#setupBar'), 'setup bar shows');
  ok(await page.locator('#piles .pile').count() === 3, 'three piles to start');
  await page.click('#pilePlus');
  ok(await page.locator('#piles .pile').count() === 4, 'pile count goes up');
  await page.click('#pileMinus');
  // make 3 · 4 · 5 into 1 · 4 · 5 (nim-sum 0: a trap for a careless chooser)
  await page.click('#piles .pile:nth-child(1) .pm button:first-child');
  await page.click('#piles .pile:nth-child(1) .pm button:first-child');
  ok(JSON.stringify((await st()).piles) === '[1,4,5]', 'piles adjusted to 1 · 4 · 5');
  await page.screenshot({ path: OUT + '/nim-setup.png' });
  await page.click('#setupDone');
  await page.waitForFunction(() => window.__game.state.phase === 'play', null, { timeout: 5000 });
  ok((await st()).turn === 0, 'hard computer saw the zero nim-sum and let you go first');
  // play one stone at a time; the hard computer always answers correctly and wins
  for (let n = 0; n < 40; n++) {
    const s = await st();
    if (s.phase === 'over') break;
    if (s.turn !== 0) { await page.waitForFunction((p) => window.__game.state.ply > p || window.__game.state.phase === 'over', s.ply, { timeout: 5000 }); continue; }
    const i = s.piles.findIndex((p) => p > 0);
    const p = s.piles[i];
    await page.click(`#piles .pile:nth-child(${i + 1}) .slot.stone:nth-child(${p})`);
  }
  const g1 = await st();
  ok(g1.phase === 'over' && g1.winner === 1, 'hard computer won from a zero nim-sum');
  await page.waitForTimeout(900);
  ok(await page.locator('#overlay.show').count() === 1, 'result overlay shows');
  ok((await page.textContent('#ovSmall')).includes('最後一顆'), 'overlay says who took the last stone');
  await page.screenshot({ path: OUT + '/nim-end.png' });

  // game 2: the computer sets up, you choose
  await page.click('#ovNext');
  await page.waitForFunction(() => window.__game.state.phase === 'choose', null, { timeout: 5000 });
  ok((await page.textContent('#round')).includes('2'), 'game 2');
  ok(await page.isVisible('#chooseBar'), 'you get to choose the order');
  const piles2 = (await st()).piles;
  ok(piles2.reduce((a, b) => a ^ b, 0) === 0, 'hard computer set a trap (nim-sum 0): ' + piles2.join(' '));
  // teaching view shows the nim-sum
  await page.click('#teachSeg button[data-v="on"]');
  ok(await page.isVisible('#teach'), 'teaching row shows');
  ok((await page.textContent('#teach')).includes('尼姆和'), 'teaching row names the nim-sum');
  await page.click('#goSecond');
  await page.waitForFunction(() => window.__game.state.phase === 'play' && window.__game.state.turn === 0, null, { timeout: 5000 });
  ok(await page.locator('.slot.hintk').count() > 0, 'teaching view marks a winning move');
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + '/nim-teach.png' });
  // follow the hints to the end: you should win
  for (let n = 0; n < 40; n++) {
    const s = await st();
    if (s.phase === 'over') break;
    if (s.turn !== 0) { await page.waitForFunction((p) => window.__game.state.ply > p || window.__game.state.phase === 'over', s.ply, { timeout: 5000 }); continue; }
    const first = page.locator('.slot.hintk').first();
    await first.click();
  }
  const g2 = await st();
  ok(g2.phase === 'over' && g2.winner === 0, 'following the teaching view wins');
  ok(JSON.stringify(await page.evaluate(() => window.__game.score)) === '[1,1]', 'score 1 : 1');

  await page.click('[data-lang="en"]');
  ok((await page.textContent('[data-i18n="setup"]')) === 'Setup', 'English labels');
  ok((await page.textContent('#note')).includes('1901'), 'English fairness note');

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(String(e)));
  await phone.goto(BASE);
  await phone.waitForTimeout(400);
  ok(await phone.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no sideways scroll on a phone');
  await phone.screenshot({ path: OUT + '/nim-phone.png', fullPage: true });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
