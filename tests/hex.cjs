// Checks for 六角連線 Hex: the rules and the computer player in Node, then the page in Chromium.
// Serve the repo root first:  npx http-server /path/to/repo -p 8771 -c-1
// then:  node tests/hex.cjs        (UNIT_ONLY=1 skips the browser; screenshots go to tests/out/hex-*.png)
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8771/';
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function unit() {
  const E = await import(pathToFileURL(path.join(__dirname, '../hex/engine.js')));
  const A = await import(pathToFileURL(path.join(__dirname, '../hex/ai.js')));
  const { JADE, AGATE } = E;
  const idx = (n, s) => (Number(s.slice(1)) - 1) * n + (s.charCodeAt(0) - 97);
  const boardOf = (n, jade = '', agate = '') => {
    const b = new Int8Array(n * n).fill(-1);
    for (const c of jade.split(' ').filter(Boolean)) b[idx(n, c)] = JADE;
    for (const c of agate.split(' ').filter(Boolean)) b[idx(n, c)] = AGATE;
    return b;
  };
  const isPath = (n, cells) => {
    const nb = E.neighbours(n);
    return cells.every((c, k) => k === 0 || nb[cells[k - 1]].includes(c));
  };
  const who = (b, n) => [E.connected(b, n, JADE), E.connected(b, n, AGATE)].join('/');

  // --- neighbours: six inside, the rhombus geometry at the corners
  {
    const nb = E.neighbours(7);
    ok(nb[idx(7, 'd4')].length === 6, 'an inner cell has six neighbours');
    ok(nb[idx(7, 'a1')].length === 2 && nb[idx(7, 'g7')].length === 2, 'sharp corners a1, g7 have two neighbours');
    ok(nb[idx(7, 'g1')].length === 3 && nb[idx(7, 'a7')].length === 3, 'wide corners g1, a7 have three neighbours');
    ok(!nb[idx(7, 'c3')].includes(idx(7, 'd4')), 'c3 and d4 do not touch (that is a bridge, not a link)');
  }

  // --- winner detection on hand-made 7×7 boards
  {
    const n = 7;
    let b = boardOf(n, 'd1 d2 d3 d4 d5 d6 d7');
    ok(who(b, n) === 'true/false' && E.winnerOf(b, n) === JADE, 'Jade straight column d1..d7 wins');
    b = boardOf(n, '', 'a4 b4 c4 d4 e4 f4 g4');
    ok(who(b, n) === 'false/true' && E.winnerOf(b, n) === AGATE, 'Agate straight row a4..g4 wins');
    const jb = 'g1 f2 e3 e4 f4 g4 g5 f6 f7'.split(' ');
    ok(isPath(n, jb.map((c) => idx(n, c))), '(test) the bent Jade line is a real chain');
    b = boardOf(n, jb.join(' '), 'a1 b1 c3 d3 a5 b5');
    ok(who(b, n) === 'true/false', 'Jade bent chain g1 f2 e3 e4 f4 g4 g5 f6 f7 wins');
    const ab = 'a7 b6 c5 c4 c3 d2 e2 f2 g2'.split(' ');
    ok(isPath(n, ab.map((c) => idx(n, c))), '(test) the bent Agate line is a real chain');
    b = boardOf(n, 'a1 b1 d4 e5', ab.join(' '));
    ok(who(b, n) === 'false/true', 'Agate bent chain a7 b6 c5 c4 c3 d2 e2 f2 g2 wins');
    b = boardOf(n, 'd1 d2 d3 e4 e5 e6 e7');
    ok(who(b, n) === 'false/false' && E.winnerOf(b, n) === null, 'a bridge gap (d3 to e4) does not count as joined');
    b = boardOf(n, 'd1 d2 d3 d5 d6 d7');
    ok(who(b, n) === 'false/false', 'a column with one hole is not joined');
    b = boardOf(n, '', 'a1 b1 c1 d1 e1 f1 g1');
    ok(who(b, n) === 'false/true', 'Agate along the top row joins left and right; the top row alone is not a Jade win');
    b = boardOf(n, 'a1 a2 a3 a4 a5 a6 a7');
    ok(who(b, n) === 'true/false', 'Jade down the left column joins top and bottom only');
    b = boardOf(n, 'g1 f2 e3 d4 c5 b6 a7');
    ok(who(b, n) === 'true/false', 'Jade on the short diagonal g1..a7 joins top and bottom');
    b = boardOf(n, '', 'g1 f2 e3 d4 c5 b6 a7');
    ok(who(b, n) === 'false/true', 'the same short diagonal in Agate joins left and right');
    b = boardOf(n, 'a1', 'b1');
    ok(E.winsAt(b, n, idx(n, 'a1')) === false, 'one corner stone touches two edges but wins nothing');

    // shortest chain, and place() ending the game
    b = boardOf(n, 'd1 d2 d3 d4 d5 d6 d7 e1 e2 c3 c4 b5');
    const ch = E.winningChain(b, n, JADE);
    ok(ch && ch.length === 7 && Math.floor(ch[0] / n) === 0 && Math.floor(ch[6] / n) === n - 1 && isPath(n, ch), 'winning chain is the shortest path, top to bottom (' + (ch && ch.map((i) => E.cellName(n, i)).join(' ')) + ')');
    let s = E.initialState(n);
    const jm = 'd1 d2 d3 d5 d6 d7'.split(' '), am = 'a1 a2 a3 a5 a6 a7'.split(' ');
    for (let k = 0; k < 6; k++) { s = E.place(s, idx(n, jm[k])); s = E.place(s, idx(n, am[k])); }
    ok(s.winner === null && E.winningCells(s.board, n, JADE).join() === String(idx(n, 'd4')), 'winningCells finds the one cell d4 that joins Jade');
    s = E.place(s, idx(n, 'd4'));
    ok(s.winner === JADE && s.chain.length === 7 && isPath(n, s.chain), 'placing d4 ends the game with a 7-stone chain');
    let threw = false;
    try { E.place(s, idx(n, 'g7')); } catch { threw = true; }
    ok(threw, 'no moves after the game is over');
    threw = false;
    try { E.place(E.place(E.initialState(n), 0), 0); } catch { threw = true; }
    ok(threw, 'an occupied cell is refused');
  }

  // --- swap rule
  {
    ok(E.reflect(7, idx(7, 'c2')) === idx(7, 'b3') && E.reflect(9, idx(9, 'a3')) === idx(9, 'c1'), 'reflection: c2 -> b3, a3 -> c1');
    let inv = true, fixed = 0;
    for (const n of E.SIZES) for (let i = 0; i < n * n; i++) {
      if (E.reflect(n, E.reflect(n, i)) !== i) inv = false;
      if (E.reflect(n, i) === i) fixed++;
    }
    ok(inv && fixed === 7 + 9 + 11, 'reflection is its own inverse and fixes only the long diagonal');
    const n = 9;
    const s1 = E.place(E.initialState(n), idx(n, 'c2'));
    ok(E.canSwap(s1), 'swap is offered right after the first stone');
    const s2 = E.swap(s1);
    ok(s2.board[idx(n, 'c2')] === -1 && s2.board[idx(n, 'b3')] === AGATE && s2.turn === JADE && s2.ply === 2, 'swap: c2 leaves, b3 turns Agate, Jade to move');
    ok(s2.moves[1].t === 'swap' && s2.moves[1].from === idx(n, 'c2') && s2.moves[1].to === idx(n, 'b3') && s2.last === idx(n, 'b3'), 'swap is recorded with from and to');
    ok(!E.canSwap(s2) && !E.canSwap(E.initialState(n)) && !E.canSwap(E.place(s1, idx(n, 'e5'))), 'swap only on that one turn');
    let threw = false;
    try { E.swap(s2); } catch { threw = true; }
    ok(threw, 'a second swap is refused');
    const d = E.swap(E.place(E.initialState(n), idx(n, 'e5')));
    ok(d.board[idx(n, 'e5')] === AGATE && d.board.filter((v) => v !== -1).length === 1, 'a stone on the long diagonal stays put and turns Agate');
    // reflecting a board and trading colours trades the winners
    const rnd = mulberry32(7);
    let mirrorOk = true;
    for (let t = 0; t < 1500; t++) {
      const m = E.SIZES[t % 3];
      const b = new Int8Array(m * m).map(() => (rnd() < 0.3 ? -1 : rnd() < 0.5 ? 0 : 1));
      const mb = new Int8Array(m * m).fill(-1);
      for (let i = 0; i < m * m; i++) if (b[i] !== -1) mb[E.reflect(m, i)] = 1 - b[i];
      if (E.connected(b, m, JADE) !== E.connected(mb, m, AGATE) || E.connected(b, m, AGATE) !== E.connected(mb, m, JADE)) mirrorOk = false;
    }
    ok(mirrorOk, 'mirror plus colour trade swaps who is joined (1500 random boards)');
  }

  // --- no draws: every full board has exactly one winner
  {
    const rnd = mulberry32(2026);
    let bad = 0, total = 0, jw = 0;
    for (const n of E.SIZES) {
      for (let t = 0; t < 2000; t++) {
        const b = new Int8Array(n * n);
        const bias = t % 4 === 0 ? rnd() : 0.5;   // also lopsided fills
        for (let i = 0; i < n * n; i++) b[i] = rnd() < bias ? JADE : AGATE;
        const j = E.connected(b, n, JADE), a = E.connected(b, n, AGATE);
        if (j === a) bad++;
        if (j) jw++;
        total++;
      }
    }
    ok(bad === 0, `full board always has exactly one winner (${total} random fills, Jade won ${jw})`);
  }

  // --- computer player
  {
    const n = 9;
    let s = E.initialState(n);
    for (const c of ['e5', 'd6', 'f3', 'c7']) s = E.place(s, idx(n, c));
    const pos = { n, board: Array.from(s.board), turn: s.turn, swap: false };
    for (const level of ['easy', 'normal', 'hard']) {
      const a = A.chooseMove(pos, level), b = A.chooseMove({ ...pos, board: Int8Array.from(pos.board) }, level);
      ok(JSON.stringify(a.move) === JSON.stringify(b.move), `AI is deterministic on ${level} (${E.cellName(n, a.move.i)} twice)`);
    }
    const p11 = E.place(E.place(E.initialState(11), idx(11, 'f6')), idx(11, 'e7'));
    const r1 = A.chooseMove({ n: 11, board: p11.board, turn: p11.turn, swap: false }, 'normal');
    const r2 = A.chooseMove({ n: 11, board: p11.board, turn: p11.turn, swap: false }, 'normal');
    ok(r1.move.i === r2.move.i, 'AI is deterministic on 11×11 too');

    // takes an immediate win, blocks an immediate loss
    const winB = boardOf(n, 'e1 e2 e3 e4 e6 e7 e8 e9', 'a1 a2 a3 b5 c5 d5 f5 g5');
    for (const level of ['easy', 'normal', 'hard']) {
      const r = A.chooseMove({ n, board: winB, turn: JADE, swap: false }, level);
      ok(r.move.i === idx(n, 'e5') && r.why === 'win', `${level}: takes the winning cell e5`);
    }
    const blockB = boardOf(n, 'b2 c2 h7 g8', 'a5 b5 c5 d5 f5 g5 h5 i5');
    for (const level of ['easy', 'normal', 'hard']) {
      const r = A.chooseMove({ n, board: blockB, turn: JADE, swap: false }, level);
      ok(r.move.i === idx(n, 'e5') && r.why === 'block', `${level}: blocks Agate's winning cell e5`);
    }
    // opening and swap
    const op = A.chooseMove({ n, board: new Int8Array(81).fill(-1), turn: JADE, swap: false }, 'hard');
    ok(op.move.t === 'place' && E.cellName(n, op.move.i) === 'a3', 'computer opens on a3');
    for (const level of ['easy', 'normal', 'hard']) {
      const c = E.place(E.initialState(n), idx(n, 'e5'));
      const r = A.chooseMove({ n, board: c.board, turn: AGATE, swap: true }, level);
      ok(r.move.t === 'swap', `${level}: swaps a centre opening (e5)`);
    }
    for (const cell of ['a1', 'a3']) {
      const c = E.place(E.initialState(n), idx(n, cell));
      const r = A.chooseMove({ n, board: c.board, turn: AGATE, swap: true }, 'hard');
      ok(r.move.t === 'place', `hard: keeps a weak opening (${cell}) and replies ${r.move.t === 'place' ? E.cellName(n, r.move.i) : ''}`);
    }
    // time per move on hard (worst case is early in the game)
    for (const m of E.SIZES) {
      let t = E.place(E.place(E.initialState(m), idx(m, 'c3')), idx(m, 'd4'));
      let max = 0;
      for (let k = 0; k < 3; k++) {
        const t0 = performance.now();
        const r = A.chooseMove({ n: m, board: t.board, turn: t.turn, swap: false }, 'hard');
        max = Math.max(max, performance.now() - t0);
        t = E.applyMove(t, r.move);
      }
      ok(max < 1500, `hard ${m}×${m}: slowest of 3 moves ${Math.round(max)} ms in Node`);
    }
  }
}

async function browser() {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const errors = [];
  const watch = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(String(e)));
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  watch(page);
  const URL = BASE + 'hex/';
  const fresh = async (p, extra = {}) => {
    await p.goto(URL);
    await p.evaluate((x) => {
      localStorage.clear();
      localStorage.setItem('ga-jielu-lang', 'zh');
      for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
    }, extra);
    await p.reload();
    await p.waitForTimeout(400);
  };
  const st = (p = page) => p.evaluate(() => {
    const h = window.__hex, s = h.state;
    return { n: s.n, turn: s.turn, ply: s.ply, winner: s.winner, chain: s.chain, last: s.last, board: Array.from(s.board), moves: s.moves, busy: h.busy, score: h.score, p1Side: h.p1Side };
  });
  const idx = (n, c) => (Number(c.slice(1)) - 1) * n + (c.charCodeAt(0) - 97);
  const click = (n, c, p = page) => p.click(`#cells .hexcell:nth-child(${(typeof c === 'number' ? c : idx(n, c)) + 1})`);

  // load
  await fresh(page, { 'ga-hex-mode': 'ai', 'ga-hex-level': 'normal', 'ga-hex-size': '9' });
  ok((await page.title()) === '六角連線 Hex · 罡曜 GambitAura', 'page title');
  ok(await page.locator('#cells .hexcell').count() === 81, '81 hexagonal cells on 9×9');
  ok((await page.textContent('.ga-crumb')).includes('Classic'), 'header crumb says Classic');
  ok((await page.textContent('#ver')).includes('9 × 9'), 'size tag shows 9 × 9');
  ok((await st()).turn === 0 && (await page.textContent('#whoMint')) === '你', 'you move first as Jade vs computer');
  await page.screenshot({ path: OUT + '/hex-desktop.png' });

  // vs computer: a few moves, the computer replies each time
  for (const [k, c] of [[2, 'c3'], [4, 'd6'], [6, 'f4']]) {
    const s = await st();
    const cell = s.board[idx(9, c)] === -1 ? c : s.board.findIndex((v) => v === -1);
    await click(9, cell);
    await page.waitForFunction((k) => window.__hex.state.ply >= k && !window.__hex.busy, k, { timeout: 20000 });
  }
  const sAi = await st();
  ok(sAi.ply === 6 && (await page.locator('#log li').count()) === 6, 'three human moves, three computer replies in the log (' + (await page.$$eval('#log li', (l) => l.map((x) => x.textContent).join(' | '))) + ')');
  ok(await page.locator('#stones .stone').count() === sAi.board.filter((v) => v !== -1).length, 'one stone element per stone on the board');
  ok(await page.locator('#stones .stone.last').count() === 1, 'the last move has its ring');
  await page.hover(`#cells .hexcell:nth-child(${sAi.board.findIndex((v) => v === -1) + 1})`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/hex-ai.png' });

  // two players: swap through the button
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(150);
  ok((await st()).ply === 0 && (await page.textContent('#whoMint')) === '玩家一', 'two-player mode starts a fresh match');
  ok(!(await page.isVisible('#passBtn')), 'no swap button before the first stone');
  await click(9, 'c2');
  ok(await page.isVisible('#passBtn') && (await page.textContent('#passBtn')) === '交換', 'swap button offered to Agate');
  await page.hover('#passBtn');
  await page.waitForTimeout(300);
  ok(await page.locator(`#cells .hexcell:nth-child(${idx(9, 'b3') + 1}).peek`).count() === 1, 'hovering Swap shows the mirror cell b3');
  await page.screenshot({ path: OUT + '/hex-swap-offer.png' });
  await page.click('#passBtn');
  await page.waitForTimeout(600);
  let s = await st();
  ok(s.board[idx(9, 'c2')] === -1 && s.board[idx(9, 'b3')] === 1 && s.turn === 0 && s.ply === 2, 'after swap: c2 empty, b3 Agate, Jade to move');
  ok((await page.textContent('#log')).includes('交換 c2→b3'), 'swap is in the log');
  ok((await page.textContent('#sub')).includes('翻到 b3'), 'status explains the swap');
  ok(!(await page.isVisible('#passBtn')), 'swap button gone after use');
  await page.screenshot({ path: OUT + '/hex-swap.png' });

  // finish a scripted two-player game: Jade straight down column e
  for (let r = 1; r <= 9; r++) {
    await click(9, 'e' + r);
    if (r < 9) await click(9, 'a' + r);
  }
  s = await st();
  ok(s.winner === 0 && s.chain && s.chain.length === 9, 'Jade wins down column e with a 9-stone chain');
  await page.waitForTimeout(1600);
  ok(await page.locator('#overlay.show').count() === 1 && (await page.textContent('#ovBig')) === '青玉勝', 'result overlay shows 青玉勝');
  ok(await page.locator('#stones .stone.won').count() === 9, 'the nine chain stones are lit');
  ok(await page.locator('#thread polyline').count() === 2, 'a thread runs through the chain');
  ok((await page.textContent('#ptsMint')) === '1' && (await page.textContent('#ptsCoral')) === '0', 'player 1 scores 1');
  await page.screenshot({ path: OUT + '/hex-end.png' });
  await page.click('#ovLook');
  await page.waitForTimeout(900);
  ok(await page.locator('#overlay.show').count() === 0, 'look at the board hides the overlay');
  await page.screenshot({ path: OUT + '/hex-chain.png' });

  // next game: colours trade, player 2 moves first
  await page.click('#nextBtn');
  await page.waitForTimeout(150);
  s = await st();
  ok(s.p1Side === 1 && s.ply === 0, 'next game: player 1 now holds Agate');
  ok((await page.textContent('#round')).includes('第 2 局') && (await page.textContent('#round')).includes('玩家二先手'), 'round line: game 2, player 2 first');
  ok(await page.locator('#sbMint .orb.coral').count() === 1 && await page.locator('#sbCoral .orb.mint').count() === 1, 'scoreboard dots trade colours');

  // a random full two-player game to the end
  const rnd = mulberry32(99);
  for (let k = 0; k < 81; k++) {
    s = await st();
    if (s.winner !== null) break;
    const empt = s.board.map((v, i) => (v === -1 ? i : -1)).filter((i) => i >= 0);
    await click(9, empt[Math.floor(rnd() * empt.length)]);
  }
  s = await st();
  const nbOk = await page.evaluate((chain) => {
    const nb = window.__hex.E.neighbours(9);
    return chain.every((c, k) => k === 0 || nb[chain[k - 1]].includes(c));
  }, s.chain || []);
  ok(s.winner !== null && nbOk && s.chain.every((c) => s.board[c] === s.winner), `random game ends: ${s.winner === 0 ? 'Jade' : 'Agate'} wins at move ${s.ply} with a ${s.chain.length}-stone chain`);
  await page.waitForTimeout(1600);
  ok(await page.locator('#overlay.show').count() === 1, 'overlay after the random game');
  const sc = await page.evaluate(() => window.__hex.score);
  ok(sc[0] + sc[1] === 2 && sc[s.winner === s.p1Side ? 0 : 1] >= 1, 'score counts by player: ' + sc.join(':'));
  await page.click('#ovLook');
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/hex-random-end.png' });

  // language
  await page.click('[data-lang="en"]');
  ok((await page.textContent('[data-i18n="setup"]')) === 'Setup' && (await page.getAttribute('html', 'lang')) === 'en', 'English labels');
  ok((await page.textContent('#msg')).match(/Jade wins|Agate wins/), 'status in English: ' + (await page.textContent('#msg')));
  await page.click('#rules summary');
  ok((await page.textContent('#rulesBody')).includes('strategy-stealing'), 'rules explain the swap rule and Nash');
  const dash = await page.evaluate(() => document.body.innerText.includes('—'));
  ok(!dash, 'no em dashes in English copy');
  await page.click('#nextBtn');
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/hex-en.png', fullPage: true });
  await page.click('[data-lang="zh"]');
  ok((await page.textContent('[data-i18n="setup"]')) === '設定' && !(await page.evaluate(() => document.body.innerText.includes('—'))), 'back to Chinese, no em dashes');
  const italicZh = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).fontStyle === 'italic' && /[一-鿿]/.test([...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join(''))).map((el) => el.className || el.tagName));
  ok(italicZh.length === 0, 'no Chinese set in italic' + (italicZh.length ? ': ' + italicZh.join(', ') : ''));

  // size change asks first when a match is under way
  await click(9, 'e5');
  await page.click('#sizeSeg button[data-v="11"]');
  ok(await page.locator('#drawDlg[open]').count() === 1, 'changing size mid-match asks first');
  await page.click('#drawCancel');
  ok((await st()).n === 9 && (await st()).ply === 1, 'cancel keeps the 9×9 game');
  await page.click('#sizeSeg button[data-v="11"]');
  await page.click('#drawOk');
  await page.waitForTimeout(300);
  s = await st();
  ok(s.n === 11 && s.ply === 0 && s.score.join() === '0,0' && (await page.locator('#cells .hexcell').count()) === 121, '11×11: 121 cells, new match, score 0:0');
  ok((await page.textContent('#ver')).includes('11 × 11'), 'size tag shows 11 × 11');
  await click(11, 'f6'); await click(11, 'g5'); await click(11, 'e7');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/hex-11.png' });

  // vs computer, game 2: the computer opens a3, you may swap
  await fresh(page, { 'ga-hex-mode': 'ai', 'ga-hex-level': 'easy', 'ga-hex-size': '7' });
  for (let k = 0; k < 60; k++) {
    s = await st();
    if (s.winner !== null) break;
    if (s.busy || s.turn !== s.p1Side) { await page.waitForTimeout(150); continue; }
    const empt = s.board.map((v, i) => (v === -1 ? i : -1)).filter((i) => i >= 0);
    await click(7, empt[Math.floor(empt.length / 2)]);
    await page.waitForFunction(() => window.__hex.state.winner !== null || (!window.__hex.busy && window.__hex.state.turn === window.__hex.p1Side), null, { timeout: 20000 });
  }
  s = await st();
  ok(s.winner !== null, 'a 7×7 game vs the easy computer finished (' + (s.winner === s.p1Side ? 'you won' : 'computer won') + ')');
  await page.waitForTimeout(1500);
  await page.click('#ovNext');
  await page.waitForFunction(() => window.__hex.state.ply === 1 && !window.__hex.busy, null, { timeout: 20000 });
  s = await st();
  ok(s.p1Side === 1 && s.moves[0].i === idx(7, 'a3'), 'game 2: the computer (Jade) opens on a3');
  ok(await page.isVisible('#passBtn') && (await page.textContent('#whoMint')) === '你', 'you hold Agate and may swap');
  await page.click('#passBtn');
  await page.waitForFunction(() => window.__hex.state.ply === 3 && !window.__hex.busy, null, { timeout: 20000 });
  s = await st();
  ok(s.board[idx(7, 'a3')] !== 1 && s.board[idx(7, 'c1')] === 1 && s.moves[1].t === 'swap', 'you swapped: c1 is yours, and the computer replied ' + (s.moves[2] ? 'at ' + String.fromCharCode(97 + (s.moves[2].i % 7)) + (Math.floor(s.moves[2].i / 7) + 1) : ''));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/hex-ai-swap.png' });

  // browser timing for hard, on the page's thread (the worker runs the same code)
  const times = await page.evaluate(async () => {
    const { chooseMove } = await import('./ai.js');
    const E = window.__hex.E;
    const out = {};
    for (const n of [7, 9, 11]) {
      let s = E.place(E.place(E.initialState(n), 2 * n + 2), 3 * n + 3);
      let max = 0;
      for (let k = 0; k < 3; k++) {
        const t0 = performance.now();
        const r = chooseMove({ n, board: s.board, turn: s.turn, swap: false }, 'hard');
        max = Math.max(max, performance.now() - t0);
        s = E.applyMove(s, r.move);
      }
      out[n] = Math.round(max);
    }
    return out;
  });
  ok(Object.values(times).every((t) => t < 1500), 'hard in Chromium, slowest of 3 moves: ' + Object.entries(times).map(([n, t]) => `${n}×${n} ${t} ms`).join(', '));

  // phone width
  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await phone.newPage();
  watch(p2);
  for (const n of [7, 9, 11]) {
    await fresh(p2, { 'ga-hex-mode': 'pvp', 'ga-hex-size': String(n) });
    const sw = await p2.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= 390, `phone ${n}×${n}: no horizontal scroll (scrollWidth ${sw})`);
    if (n === 11) {
      await p2.tap(`#cells .hexcell:nth-child(${idx(11, 'f6') + 1})`);
      await p2.tap(`#cells .hexcell:nth-child(${idx(11, 'e5') + 1})`);
      ok((await st(p2)).ply === 2, 'phone 11×11: taps place stones');
      await p2.screenshot({ path: OUT + '/hex-phone-11.png' });
    }
  }
  await fresh(p2, { 'ga-hex-mode': 'pvp', 'ga-hex-size': '7' });
  for (let r = 1; r <= 7; r++) {
    await p2.tap(`#cells .hexcell:nth-child(${idx(7, 'd' + r) + 1})`);
    if (r < 7) await p2.tap(`#cells .hexcell:nth-child(${idx(7, 'a' + r) + 1})`);
  }
  await p2.waitForTimeout(1600);
  const ovBox = await p2.evaluate(() => {
    const o = document.getElementById('overlay').getBoundingClientRect();
    const btn = document.getElementById('ovLook').getBoundingClientRect();
    return { inside: btn.bottom <= o.bottom + 1 && btn.top >= o.top - 1, show: document.getElementById('overlay').classList.contains('show') };
  });
  ok(ovBox.show && ovBox.inside, 'phone: the result overlay fits on the board');
  await p2.screenshot({ path: OUT + '/hex-phone-end.png' });
  await fresh(p2, { 'ga-hex-mode': 'ai', 'ga-hex-size': '9', 'ga-hex-level': 'normal' });
  await p2.tap(`#cells .hexcell:nth-child(${idx(9, 'c3') + 1})`);
  await p2.waitForFunction(() => window.__hex.state.ply === 2 && !window.__hex.busy, null, { timeout: 20000 });
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: OUT + '/hex-phone.png', fullPage: true });
  ok((await p2.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'phone vs computer: still no horizontal scroll');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
}

(async () => {
  await unit();
  if (!process.env.UNIT_ONLY) await browser();
})().catch((e) => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
