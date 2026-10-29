// Browser check for 黑白棋 Reversi. Server at the repo root first: npx http-server -p 8765 -c-1 .
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/') + 'reversi/';
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); });
  await page.reload();
  await page.waitForTimeout(300);
  const st = () => page.evaluate(() => { const s = window.__game.state; return { ply: s.ply, turn: s.turn, over: s.over, winner: s.winner, busy: window.__game.busy }; });
  ok(await page.locator('#marks .legal').count() === 4, 'four legal moves at the start');
  ok(await page.locator('#discs .disc').count() === 4, 'four discs at the start');
  await page.click('#cells .cellbtn:nth-child(20)');   // d3
  await page.waitForFunction(() => window.__game.state.ply >= 2 && !window.__game.busy, null, { timeout: 15000 });
  ok((await st()).ply >= 2, 'computer replied');
  ok(await page.locator('#discs .disc').count() >= 6, 'discs placed and kept');
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + '/reversi-desktop.png' });
  // two players: play a whole game by clicking legal moves
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(150);
  for (let n = 0; n < 70; n++) {
    const s = await st();
    if (s.over) break;
    const i = await page.evaluate(async () => { const E = await import('./engine.js'); const s = window.__game.state; return E.legalMoves(s.board, s.turn)[0]; });
    await page.click(`#cells .cellbtn:nth-child(${i + 1})`);
  }
  const fin = await st();
  ok(fin.over, 'two-player game reached the end at ply ' + fin.ply);
  await page.waitForTimeout(900);
  ok(await page.locator('#overlay.show').count() === 1, 'result overlay shows');
  const sc = await page.evaluate(() => window.__game.score);
  ok(fin.winner === -1 ? sc[0] + sc[1] === 0 : sc[0] + sc[1] === 1, 'score counts the result');
  await page.screenshot({ path: OUT + '/reversi-end.png' });
  await page.click('#ovNext');
  await page.waitForTimeout(200);
  ok((await page.textContent('#round')).includes('2'), 'next game is game 2');
  ok((await page.textContent('#round')).includes('玩家二執黑'), 'player 2 holds Black in game 2');
  await page.click('[data-lang="en"]');
  ok((await page.textContent('[data-i18n="setup"]')) === 'Setup', 'English labels');
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(String(e)));
  await phone.goto(BASE);
  await phone.waitForTimeout(400);
  ok(await phone.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no sideways scroll on a phone');
  await phone.screenshot({ path: OUT + '/reversi-phone.png', fullPage: true });
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})();
