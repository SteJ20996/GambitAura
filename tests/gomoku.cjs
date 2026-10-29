// Checks for 五子棋 Gomoku: rules and computer in Node, then the page in headless Chromium.
// Run a static server at the repo root first, e.g.
//   node /opt/node22/lib/node_modules/http-server/bin/http-server -p 8765 -c-1 -s .
// then:  node tests/gomoku.cjs   (BASE overrides the address; screenshots go to tests/out/gomoku-*.png;
//        UNIT_ONLY=1 skips the browser part)
const path = require('path');
const { pathToFileURL } = require('url');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

async function unit() {
  const E = await import(pathToFileURL(path.join(__dirname, '../gomoku/engine.js')).href);
  const AI = await import(pathToFileURL(path.join(__dirname, '../gomoku/ai.js')).href);
  const R = await import(pathToFileURL(path.join(__dirname, '../gomoku/renju.js')).href);
  const P = E.parseCell;
  const board = (blacks, whites = '') => {
    const b = new Int8Array(225).fill(-1);
    for (const c of blacks.split(' ').filter(Boolean)) b[P(c)] = E.BLACK;
    for (const c of whites.split(' ').filter(Boolean)) b[P(c)] = E.WHITE;
    return b;
  };
  const five = (blacks, at) => E.fiveLines(board(blacks), P(at));

  // five in a row, all four directions and at the edges
  ok(P('h8') === 112 && E.cellName(112) === 'h8' && E.cellName(0) === 'a15' && E.cellName(224) === 'o1', 'coordinates: h8 is the centre, a15 top left, o1 bottom right');
  ok(five('d8 e8 f8 g8 h8', 'f8').length === 1, 'five across');
  ok(five('h4 h5 h6 h7 h8', 'h4').length === 1, 'five down');
  ok(five('d4 e5 f6 g7 h8', 'g7').length === 1, 'five on the rising diagonal');
  ok(five('d12 e11 f10 g9 h8', 'd12').length === 1, 'five on the falling diagonal');
  ok(five('a1 b1 c1 d1 e1', 'a1').length === 1 && five('k1 l1 m1 n1 o1', 'o1').length === 1, 'five along the bottom edge, both corners');
  ok(five('o11 o12 o13 o14 o15', 'o15').length === 1 && five('a15 b14 c13 d12 e11', 'a15').length === 1, 'five on the right edge and on a corner diagonal');
  ok(five('k1 l2 m3 n4 o5', 'o5').length === 1, 'five on a short edge diagonal');
  ok(five('d8 e8 f8 g8', 'g8').length === 0 && five('d8 e8 g8 h8 i8', 'e8').length === 0, 'four, or five with a gap, is not a win');
  const six = five('c8 d8 e8 f8 g8 h8', 'f8');
  ok(six.length === 1 && six[0].length === 6, 'six in a row counts as a win (freestyle)');
  ok(five('d8 e8 f8 g8 h8 h4 h5 h6 h7', 'h8').length === 2, 'two fives through one stone are both found');
  ok(E.fiveLines(board('d8 e8 f8 g8', 'h8'), P('h8')).length === 0, 'mixed colours never make five');

  // Swap2 phase transitions
  const open3 = (opener) => {
    let s = E.initialState(opener, 'std');
    const seen = [];
    for (const c of ['h8', 'i9', 'g9']) { seen.push([E.actor(s), E.stoneColor(s)]); s = E.applyMove(s, { t: 'stone', i: P(c) }); }
    return { s, seen };
  };
  for (const opener of [0, 1]) {
    const second = 1 - opener;
    const { s: s3, seen } = open3(opener);
    ok(seen.every(([a]) => a === opener) && seen.map(([, c]) => c).join('') === '010', `opener ${opener}: the opener places black, white, black`);
    ok(s3.phase === 'swap' && E.actor(s3) === second && E.stoneColor(s3) === null && s3.colorOf === null, `opener ${opener}: then the other player chooses, colours still open`);
    let s = E.applyMove(s3, { t: 'choice', v: 'white' });
    ok(s.phase === 'play' && s.colorOf[second] === E.WHITE && s.colorOf[opener] === E.BLACK && s.turn === E.WHITE && E.actor(s) === second,
      `opener ${opener}: "white" makes the chooser White, and they place stone 4`);
    s = E.applyMove(s3, { t: 'choice', v: 'black' });
    ok(s.phase === 'play' && s.colorOf[second] === E.BLACK && s.colorOf[opener] === E.WHITE && s.turn === E.WHITE && E.actor(s) === opener,
      `opener ${opener}: "black" makes the chooser Black, and the opener places stone 4 as White`);
    s = E.applyMove(s3, { t: 'choice', v: 'two' });
    ok(s.phase === 'open2' && E.actor(s) === second && E.stoneColor(s) === E.BLACK, `opener ${opener}: "two": the chooser places a black stone first`);
    s = E.applyMove(s, { t: 'stone', i: P('h10') });
    ok(E.actor(s) === second && E.stoneColor(s) === E.WHITE, `opener ${opener}: then a white stone`);
    const s5 = E.applyMove(s, { t: 'stone', i: P('j10') });
    ok(s5.phase === 'pick' && E.actor(s5) === opener && s5.stones === 5, `opener ${opener}: then the opener picks a colour, five stones down`);
    s = E.applyMove(s5, { t: 'choice', v: 'black' });
    ok(s.colorOf[opener] === E.BLACK && s.turn === E.WHITE && E.actor(s) === second, `opener ${opener}: opener picks Black, the other player moves first as White`);
    s = E.applyMove(s5, { t: 'choice', v: 'white' });
    ok(s.colorOf[opener] === E.WHITE && s.turn === E.WHITE && E.actor(s) === opener, `opener ${opener}: opener picks White and moves first`);
    s = E.applyMove(s, { t: 'stone', i: P('a1') });
    ok(E.actor(s) === second && s.turn === E.BLACK, `opener ${opener}: turns then alternate`);
  }
  let threw = 0;
  const { s: s3 } = open3(0);
  try { E.applyMove(s3, { t: 'stone', i: P('a1') }); } catch { threw++; }
  try { E.applyMove(E.applyMove(s3, { t: 'choice', v: 'white' }), { t: 'stone', i: P('h8') }); } catch { threw++; }
  try { E.applyMove(E.applyMove(s3, { t: 'choice', v: 'white' }), { t: 'choice', v: 'black' }); } catch { threw++; }
  ok(threw === 3, 'stones during a choice, stones on stones and late choices are refused');
  {
    // a win through the engine: the opener (Black after "white") makes five
    let s = E.applyMove(s3, { t: 'choice', v: 'white' });
    for (const c of ['a1', 'h9', 'a2', 'h10', 'a3', 'h11', 'a4', 'h12']) s = E.applyMove(s, { t: 'stone', i: P(c) });
    ok(s.phase === 'over' && s.winner === 0 && s.lines.length === 1 && s.lines[0].length === 5, 'five ends the game and names the player who made it');
  }

  // the three rule sets
  {
    let s = E.initialState(0);
    ok(s.rule === 'free' && s.phase === 'play' && E.actor(s) === 0 && E.stoneColor(s) === E.BLACK, 'casual is the default: player 1 plays Black from the first stone');
    s = E.applyMove(s, { t: 'stone', i: P('h8') });
    ok(E.actor(s) === 1 && E.stoneColor(s) === E.WHITE, 'casual: then player 2 plays White; turns alternate');
    const six = board('c8 d8 e8 f8 g8 h8');
    ok(E.winLines(six, P('f8'), 'std').length === 0 && E.winLines(six, P('f8'), 'free').length === 1, 'pro gomoku: six is no win (it is in casual play)');
    ok(E.winLines(six, P('f8'), 'renju').length === 0, 'renju: six is no win for Black');
    const wsix = new Int8Array(225).fill(-1); for (const c of ['c8', 'd8', 'e8', 'f8', 'g8', 'h8']) wsix[P(c)] = E.WHITE;
    ok(E.winLines(wsix, P('f8'), 'renju').length === 1, 'renju: six wins for White');
  }
  {
    // renju forbidden points (board for renju.js: 0 empty, 1 black, 2 white)
    const rb = (bl, wh = '') => { const b = new Uint8Array(225); for (const c of bl.split(' ').filter(Boolean)) b[P(c)] = 1; for (const c of wh.split(' ').filter(Boolean)) b[P(c)] = 2; return b; };
    const why = (bl, wh, at) => R.forbiddenReason(rb(bl, wh), P(at));
    ok(why('g8 i8 h9 h7', '', 'h8') === R.DOUBLE_THREE, 'renju: two open threes are forbidden (three-three)');
    ok(why('f8 i8 h10 h11', '', 'h8') === R.DOUBLE_THREE, 'renju: split threes count too');
    ok(why('g8 i8 h9 h7', 'f8', 'h8') === 0, 'renju: a three blocked at one end is not open, so this is allowed');
    ok(why('g8 i8 j8 h10 h11 h12', '', 'h8') === R.DOUBLE_FOUR, 'renju: two fours are forbidden (four-four)');
    ok(why('e8 g8 i8 k8', '', 'h8') === R.DOUBLE_FOUR, 'renju: two fours on one line (X.XXX.X) are forbidden');
    ok(why('g8 i8 j8 h9 h10', 'f8', 'h8') === 0, 'renju: four-three is allowed');
    ok(why('d8 e8 f8 g8 i8', '', 'h8') === R.OVERLINE, 'renju: six or more is forbidden (overline)');
    ok(why('d8 e8 f8 g8 i8 h9 h10 h11 h12', '', 'h8') === 0 && why('d8 e8 f8 g8 h9 h7 i9 j10', '', 'h8') === 0, 'renju: making exactly five wins even with a forbidden shape');
    const walls = 'f6 f7 f9 f10 f11 j6 j7 j9 j10 j11';
    ok(why('g8 i8 h9 h7 ' + walls, '', 'h8') === 0, 'renju: a three whose extension points are forbidden is a false three');
    ok(why('g8 i8 h9 h7 f6 f7 f9 f10 f11', '', 'h8') === R.DOUBLE_THREE, 'renju: with one extension still legal, the three is real');
  }
  {
    // Taraguchi-10
    const mv = (s, ...xs) => { for (const x of xs) s = E.applyMove(s, typeof x === 'string' && x.length <= 3 ? { t: 'stone', i: P(x) } : { t: 'choice', v: x.v }); return s; };
    let s = E.initialState(0, 'renju');
    ok(s.phase === 'tplace' && E.canPlace(s, P('h8')) && !E.canPlace(s, P('i9')), 'Taraguchi-10: stone 1 on h8 only');
    s = mv(s, 'h8');
    ok(s.phase === 'tswap' && E.actor(s) === 1, 'Taraguchi-10: then the other player may swap');
    s = mv(s, { v: 'swap' });
    ok(E.actor(s) === 0 && s.colorOf[0] === E.WHITE && E.canPlace(s, P('g9')) && !E.canPlace(s, P('f9')), 'Taraguchi-10: after a swap the first player is White and places stone 2 inside 3 x 3');
    s = mv(s, 'g9', { v: 'keep' });
    ok(E.canPlace(s, P('f10')) && !E.canPlace(s, P('e10')), 'Taraguchi-10: stone 3 inside 5 x 5');
    s = mv(s, 'j7', { v: 'keep' });
    ok(E.canPlace(s, P('e11')) && !E.canPlace(s, P('d11')), 'Taraguchi-10: stone 4 inside 7 x 7');
    s = mv(s, 'k10');
    ok(s.phase === 'tfifth' && E.actor(s) === 1, 'Taraguchi-10: then the Black player chooses how stone 5 is played');
    let a = mv(s, { v: 'place' });
    ok(E.canPlace(a, P('d12')) && !E.canPlace(a, P('c12')), 'Taraguchi-10: stone 5 inside 9 x 9');
    a = mv(a, 'd12');
    ok(a.phase === 'tswap' && E.actor(a) === 0, 'Taraguchi-10: then White may swap once more');
    a = mv(a, { v: 'keep' });
    ok(a.phase === 'play' && a.turn === E.WHITE, 'Taraguchi-10: White plays stone 6');
    let t = mv(s, { v: 'ten' });
    for (const c of ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'i1', 'j1']) t = mv(t, c);
    ok(t.phase === 'tpick' && t.offers.length === 10 && E.actor(t) === 0, 'Taraguchi-10: ten offers, then White picks');
    t = mv(t, 'c1');
    ok(t.phase === 'play' && t.board[P('c1')] === E.BLACK && t.stones === 5 && t.offers.length === 0, 'Taraguchi-10: the pick becomes Black stone 5');
    let y = { ...E.initialState(0, 'renju'), phase: 'toffer', offers: [P('i9')], board: board('h8') };
    ok(E.offerClash(y, P('g7')) && !E.offerClash(y, P('i10')), 'Taraguchi-10: offers that mirror each other are refused');
  }
  {
    // the computer under the pro rules
    let r = AI.bestMove(board('b8 c8 d8 e8 g8 h9 h10 h11 h12', 'a8 a1 a3 a5 a11 a13 o1 o3 o5'), 0, 'hard', 1, 'std');
    ok(['h8', 'h13'].includes(E.cellName(r.move)), `pro gomoku: Black takes a real five (${E.cellName(r.move)}), not the six at f8`);
    r = AI.bestMove(board('b8 c8 d8 e8 g8', 'a8 a1 a3 a5 o9'), 0, 'hard', 1, 'std');
    ok(E.cellName(r.move) !== 'f8', 'pro gomoku: Black does not waste a move on a six');
    r = AI.bestMove(board('g8 i8 h9 h7 m2', 'e11 f10 g9 a1 a2'), 1, 'hard', 1, 'renju');
    ok(r.score > 1000000, 'renju: White sees a win by leaving Black only a forbidden block');
    const st = { ...E.initialState(0, 'renju'), phase: 'play', turn: E.BLACK, colorOf: [E.BLACK, E.WHITE], board: board('g8 i8 h9 h7', 'a1 a2 a3') };
    const d = AI.decide(st, 'hard', 1).move;
    ok(E.canPlace(st, d.i) && E.cellName(d.i) !== 'h8', `renju: Black never plays its forbidden point (played ${E.cellName(d.i)})`);
    for (const rule of ['free', 'std', 'renju']) {
      let g = E.initialState(0, rule);
      while (!E.isOver(g) && g.moves.length < 240) g = E.applyMove(g, AI.decide(g, 'normal', 2).move);
      ok(E.isOver(g), `${rule}: a computer-against-computer game ends with legal moves only (${g.stones} stones)`);
    }
  }

  // the computer
  const pick = (bl, wh, color, level) => E.cellName(AI.bestMove(board(bl, wh), color, level, 1).move);
  for (const lv of ['easy', 'normal', 'hard']) {
    ok(['f8', 'k8'].includes(pick('g8 h8 i8 j8', 'g9 h9 i9 a1', 0, lv)), `${lv}: takes a win in one (open four)`);
    ok(pick('a1 b1 c1 o15 o14', 'e5 f6 h8 i9', 1, lv) === 'g7', `${lv}: takes a win in one (broken four on a diagonal)`);
    ok(pick('g8 h8 i8 j8', 'f8 a1 b1', 1, lv) === 'k8', `${lv}: blocks a four`);
    ok(['f8', 'k8'].includes(pick('g8 h8 i8 j8 a15', 'a1 b1 c1', 1, lv)), `${lv}: blocks an open four (one end)`);
    ok(['f8', 'j8', 'e8', 'k8'].includes(pick('g8 h8 i8', 'g9 h10', 1, lv)), `${lv}: blocks an open three`);
  }
  ok(pick('h8 i8 g10 g11 a1', 'o15 o14 o13 n14 a15', 0, 'hard') === 'g8', 'hard: makes a double three');
  ok(pick('h8 i8 j8 k10 k11 a1', 'g8 o15 o14 n15 a15', 0, 'hard') === 'k8', 'hard: makes a four-three');
  {
    const b = board('h8 g9 i9 j10', 'i8 h9 g10 k11');
    const r1 = AI.bestMove(b, 0, 'hard', 3), r2 = AI.bestMove(b, 0, 'hard', 3);
    const e1 = AI.bestMove(b, 0, 'easy', 5), e2 = AI.bestMove(b, 0, 'easy', 5);
    ok(r1.move === r2.move && r1.score === r2.score && r1.nodes === r2.nodes, `determinism: hard gives the same move twice (${E.cellName(r1.move)}, ${r1.nodes} nodes)`);
    ok(e1.move === e2.move, 'determinism: easy (with its game-number wobble) gives the same move twice');
    const d1 = AI.decide(s3, 'normal', 2), d2 = AI.decide(s3, 'normal', 2);
    ok(d1.move.t === 'choice' && d1.move.v === d2.move.v, `determinism: the Swap2 choice repeats (${d1.move.v})`);
  }
  {
    // the computer as opener places its listed opening; as chooser it answers with a legal choice
    let s = E.initialState(1, 'std');
    for (let k = 0; k < 3; k++) s = E.applyMove(s, AI.decide(s, 'hard', 4).move);
    ok(s.phase === 'swap' && s.stones === 3 && [...s.board].filter((v) => v === 0).length === 2, 'computer opener places two black and one white');
    const choice = AI.decide(s, 'hard', 4).move;
    ok(choice.t === 'choice' && ['white', 'black', 'two'].includes(choice.v), `computer chooser picks a Swap2 option (${choice.v})`);
    let t = E.applyMove(s, { t: 'choice', v: 'two' });
    for (let k = 0; k < 2; k++) t = E.applyMove(t, AI.decide(t, 'normal', 4).move);
    ok(t.phase === 'pick' && t.stones === 5, 'computer places the two extra stones (black, white)');
    const pc = AI.decide(t, 'hard', 4).move;
    ok(pc.t === 'choice' && ['black', 'white'].includes(pc.v), `computer opener picks a colour (${pc.v})`);
  }
  {
    // hard: time per move over a short game against itself
    let s = E.applyMove(open3(0).s, { t: 'choice', v: 'black' });
    const times = [];
    for (let k = 0; k < 24 && s.phase === 'play'; k++) {
      const t0 = performance.now();
      const r = AI.decide(s, 'hard', 1);
      times.push(performance.now() - t0);
      s = E.applyMove(s, r.move);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length, max = Math.max(...times);
    ok(max < 1500, `hard replies in ${mean.toFixed(0)} ms on average, ${max.toFixed(0)} ms at most (Node, ${times.length} moves)`);
  }
}

async function browser() {
  const { chromium } = require('playwright');
  const br = await chromium.launch();
  const errors = [];
  const watch = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(String(e)));
  };
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  watch(page);
  const P = (n) => (15 - Number(n.slice(1))) * 15 + 'abcdefghijklmno'.indexOf(n[0]);
  const G = () => page.evaluate(() => {
    const g = window.__gomoku, s = g.state;
    return { phase: s.phase, actor: g.actor, busy: g.busy, stones: s.stones, colorOf: s.colorOf, winner: s.winner, moves: s.moves, gameNo: g.gameNo, last: s.last };
  });
  const click = (n) => page.click(`#cells .cellbtn[data-i="${typeof n === 'number' ? n : P(n)}"]`);
  // an empty point close to the centre (a quiet human move)
  const free = () => page.evaluate(() => {
    const b = window.__gomoku.state.board;
    let best = -1, bd = 1e9;
    for (let i = 0; i < 225; i++) {
      if (b[i] !== -1) continue;
      const d = Math.abs(Math.floor(i / 15) - 7) * 1.01 + Math.abs((i % 15) - 7);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  });
  const settle = () => page.waitForFunction(() => { const g = window.__gomoku; return !g.busy && (g.state.phase === 'over' || g.actor === 0 || g.mode === 'pvp'); }, null, { timeout: 30000 });

  await page.goto(BASE + 'gomoku/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ga-jielu-lang', 'zh'); localStorage.setItem('ga-gomoku-level', 'normal'); });
  await page.reload();
  await page.waitForTimeout(400);
  ok((await page.title()) === '五子棋 Gomoku · 罡曜 GambitAura', 'page title');
  ok(await page.locator('#cells .cellbtn').count() === 225 && await page.locator('#grid line').count() === 30 && await page.locator('#grid .star').count() === 5,
    '225 points, 15 + 15 grid lines, five star points');
  let g = await G();
  // --- casual is the default: you play Black, then the computer answers stone for stone ---
  ok((await page.textContent('#tag')) === '一般玩法' && (await page.textContent('.ga-crumb')).includes('Classic'), 'casual by default (tag 一般玩法) and Classic crumb');
  ok(g.phase === 'play' && g.actor === 0 && g.colorOf[0] === 0, 'casual: you play Black from the first stone');
  await click('h8');
  await settle();
  g = await G();
  ok(g.stones === 2 && g.moves[1].player === 1 && g.moves[1].color === 1, 'casual: the computer answers with one white stone');
  await click(await free());
  await settle();
  g = await G();
  ok(g.stones === 4 && g.moves.every((m, k) => m.player === k % 2), 'casual: one stone each, turn by turn');
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/gomoku-free.png' });
  // switch to pro gomoku (Swap2); a game in progress asks first
  await page.click('#ruleSeg button[data-v="std"]');
  await page.waitForTimeout(150);
  ok(await page.locator('#drawDlg[open]').count() === 1, 'changing rules mid-game asks first');
  await page.click('#drawOk');
  await page.waitForTimeout(250);
  g = await G();
  ok((await page.textContent('#tag')).includes('Swap2') && (await page.textContent('#fairNote')).includes('剛好五子'), 'pro gomoku: Swap2 tag, exactly-five note');
  ok(g.phase === 'open3' && g.actor === 0 && g.gameNo === 1, 'game 1: you open');

  // --- vs computer, you open ---
  await click('h8');
  await page.hover(`#cells .cellbtn[data-i="${P('i9')}"]`);
  ok(await page.locator('#marks .ghost.w').count() === 1, 'hover shows a ghost of the next colour (white)');
  await click('i9');
  await page.hover(`#cells .cellbtn[data-i="${P('g9')}"]`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/gomoku-opening.png' });
  await click('g9');
  await settle();
  g = await G();
  const cpuChoice = g.moves.find((m) => m.t === 'choice' && m.player === 1);
  ok(!!cpuChoice, 'the computer made a Swap2 choice (' + (cpuChoice && cpuChoice.v) + ')');
  if (g.phase === 'pick') {
    ok(g.stones === 5, 'computer chose "two" and added two stones; now you pick');
    await page.click('#choices button[data-v="white"]');
    await settle();
    g = await G();
  }
  ok(g.phase === 'play' && g.colorOf !== null, 'colours are settled after the opening');
  {
    const before = g.stones;
    await click(await free());
    await settle();
    g = await G();
    ok(g.stones === before + 2 && g.moves[g.moves.length - 1].player === 1, 'the computer replied to your stone');
  }
  ok(await page.locator('#marks .mark.last').count() === 1, 'last move has a ring');
  ok(await page.locator('#log li').count() === g.moves.length && (await page.textContent('#log')).includes('電腦'), 'log lists stones and the choice');
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/gomoku-ai-reply.png' });

  // --- vs computer, the computer opens; you choose "two" ---
  await page.evaluate(() => window.__gomoku.nextGame());
  await page.waitForFunction(() => window.__gomoku.state.phase === 'swap' && !window.__gomoku.busy, null, { timeout: 20000 });
  g = await G();
  ok(g.gameNo === 2 && g.moves.filter((m) => m.t === 'stone' && m.player === 1).length === 3, 'game 2: the computer opens with three stones');
  ok(await page.locator('#choices button').count() === 3 && (await page.textContent('#round')).includes('電腦開局'), 'three Swap2 buttons show; the scoreboard says the computer opens');
  ok(await page.locator('#sbMint .orb.tbd').count() === 1, 'scoreboard orbs show no colour yet');
  await page.waitForTimeout(900);   // smooth scroll to the choices, scoreboard underline fade
  const onLeft = await page.evaluate(() => document.getElementById('sbMint').classList.contains('on') && !document.getElementById('sbCoral').classList.contains('on'));
  const inView = await page.evaluate(() => document.getElementById('choices').getBoundingClientRect().bottom <= window.innerHeight + 1);
  ok(onLeft && inView, 'the chooser (you) is underlined and the choices were scrolled into view');
  await page.screenshot({ path: OUT + '/gomoku-swap-choice.png' });
  await page.click('#choices button[data-v="two"]');
  g = await G();
  ok(g.phase === 'open2' && g.actor === 0, 'after "two" you place two more stones');
  await click(await free());
  await click(await free());
  await settle();
  g = await G();
  const pickM = g.moves.find((m) => m.t === 'choice' && m.player === 1);
  ok(g.phase === 'play' && pickM && ['black', 'white'].includes(pickM.v), 'the computer picked a colour (' + (pickM && pickM.v) + ')');
  if (g.actor !== 0) { await settle(); g = await G(); }
  {
    const before = g.stones;
    await click(await free());
    await settle();
    g = await G();
    ok(g.stones === before + 2, 'play goes on: the computer replied');
  }

  // --- the computer opens; you play White ---
  await page.evaluate(() => { window.__gomoku.nextGame(); window.__gomoku.nextGame(); });
  await page.waitForFunction(() => window.__gomoku.state.phase === 'swap' && !window.__gomoku.busy, null, { timeout: 20000 });
  await page.click('#choices button[data-v="white"]');
  g = await G();
  ok(g.phase === 'play' && g.actor === 0 && g.colorOf[0] === 1, 'game 4: "white": you are White and place stone 4');
  ok(await page.locator('#sbMint .orb.white').count() === 1 && await page.locator('#sbCoral .orb.black').count() === 1, 'scoreboard orbs show the colours');
  await click(await free());
  await settle();
  g = await G();
  ok(g.stones === 5 && g.moves[g.moves.length - 1].player === 1, 'the computer (Black) replied');

  // --- restart asks first in the middle of a game ---
  await page.click('#restartBtn');
  ok(await page.locator('#drawDlg[open]').count() === 1, 'restart mid-game asks first');
  await page.screenshot({ path: OUT + '/gomoku-restart-dialog.png' });
  await page.click('#drawCancel');
  ok((await G()).stones === 5, 'cancel keeps the game');

  // --- the computer opens; you play Black; level hard for timing ---
  await page.click('#levelSeg button[data-v="hard"]');
  await page.evaluate(() => { window.__gomoku.nextGame(); window.__gomoku.nextGame(); });
  await page.waitForFunction(() => window.__gomoku.state.phase === 'swap' && !window.__gomoku.busy, null, { timeout: 20000 });
  await page.click('#choices button[data-v="black"]');
  await settle();
  g = await G();
  ok(g.stones === 4 && g.colorOf[1] === 1 && g.moves[4].player === 1, 'game 6: "black": the computer, as White, placed stone 4');
  for (let k = 0; k < 5 && g.phase === 'play'; k++) { await click(await free()); await settle(); g = await G(); }
  const st = (await page.evaluate(() => window.__gomoku.aiStats)).filter((x) => x.phase === 'play' && x.level === 'hard');
  const ms = st.map((x) => x.ms);
  ok(st.length >= 4 && Math.max(...ms) < 1500, `hard in the browser worker: ${ms.join(', ')} ms`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/gomoku-hard.png' });

  // --- two players: play to five ---
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(150);
  g = await G();
  ok(g.phase === 'open3' && g.gameNo === 1 && g.actor === 0 && (await page.textContent('#whoMint')) === '玩家一', 'two players: score reset, player 1 opens');
  for (const c of ['h8', 'a15', 'h9']) await click(c);
  await page.click('#choices button[data-v="black"]');
  g = await G();
  ok(g.actor === 0 && g.colorOf[0] === 1, 'player 2 took Black, player 1 plays White');
  for (const c of ['o1', 'h10', 'o2', 'h11', 'o3', 'h12']) await click(c);
  g = await G();
  ok(g.phase === 'over' && g.winner === 1, 'player 2 made five (h8 to h12)');
  ok(await page.locator('#winline line').count() === 3 && await page.locator('#stones .stone.won').count() === 5, 'winning line drawn through five glowing stones');
  await page.waitForTimeout(1300);
  ok(await page.locator('#overlay.show').count() === 1 && (await page.textContent('#ovBig')) === '玩家二勝', 'overlay: 玩家二勝');
  ok((await page.textContent('#ptsCoral')) === '1' && (await page.textContent('#ptsMint')) === '0', 'scoreboard counts the win for player 2');
  await page.screenshot({ path: OUT + '/gomoku-win.png' });
  await page.click('#ovLook');
  await page.waitForTimeout(1000);
  ok(await page.locator('#overlay.show').count() === 0, 'look at the board hides the overlay');
  await page.screenshot({ path: OUT + '/gomoku-win-board.png' });
  await page.click('#nextBtn');
  await page.waitForTimeout(150);
  g = await G();
  ok(g.gameNo === 2 && g.actor === 1 && g.phase === 'open3' && (await page.textContent('#round')).includes('玩家二開局'), 'next game: player 2 opens');

  // --- language ---
  await page.click('[data-lang="en"]');
  ok((await page.textContent('[data-i18n="setup"]')) === 'Setup' && (await page.textContent('#msg')) === 'Player 2 sets the opening'
    && (await page.getAttribute('html', 'lang')) === 'en', 'English labels and status');
  await page.click('details.rules summary');
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/gomoku-en.png', fullPage: true });
  await page.click('[data-lang="zh"]');
  ok((await page.textContent('[data-i18n="setup"]')) === '設定' && (await page.getAttribute('html', 'lang')) === 'zh-Hant', 'back to Chinese');
  const italicZh = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
    return /[一-鿿]/.test(t) && getComputedStyle(el).fontStyle === 'italic';
  }).map((el) => el.className || el.tagName));
  ok(italicZh.length === 0, 'no Chinese text in italic' + (italicZh.length ? ': ' + italicZh.join(', ') : ''));

  // --- keyboard: arrows move the focus point, Enter places ---
  await page.click('#modeSeg button[data-v="ai"]');
  await page.click('#modeSeg button[data-v="pvp"]');
  await page.waitForTimeout(150);
  await page.focus('#cells .cellbtn[tabindex="0"]');
  const startCell = await page.evaluate(() => Number(document.activeElement.dataset.i));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  const aimed = await page.evaluate(() => Number(document.activeElement.dataset.i));
  await page.keyboard.press('Enter');
  g = await G();
  ok(aimed === startCell - 16 && g.stones === 1 && g.last === aimed, 'keyboard: arrows move the focus, Enter places a stone');

  // --- pro renju, two players: Taraguchi-10 opening, then a forbidden point ---
  await page.click('#ruleSeg button[data-v="renju"]');
  await page.waitForTimeout(150);
  if (await page.locator('#drawDlg[open]').count()) await page.click('#drawOk');
  await page.waitForTimeout(250);
  g = await G();
  ok(g.phase === 'tplace' && (await page.textContent('#tag')).includes('Taraguchi-10'), 'pro renju: Taraguchi-10 opening');
  ok((await page.textContent('#sub')).includes('h8'), 'stone 1: the status says it goes on h8');
  const choose = async (v) => { await page.click(`#choices button[data-v="${v}"]`); await page.waitForTimeout(80); };
  await click('h8');
  ok(await page.locator('#choices button').count() === 2 && (await page.textContent('#msg')).includes('交換'), 'after stone 1: keep or swap');
  await choose('keep');
  ok(await page.locator('#marks .zone').count() === 1 && (await page.textContent('#sub')).includes('3 × 3'), 'stone 2: a gold frame shows the 3 × 3 square');
  await page.screenshot({ path: OUT + '/gomoku-renju-zone.png' });
  await click('i9'); await choose('swap');
  await click('g7'); await choose('keep');
  await click('k10');
  g = await G();
  ok(g.phase === 'tfifth' && await page.locator('#choices button').count() === 3, 'after stone 4: three ways to play stone 5');
  await choose('ten');
  for (const c of ['k7', 'e8', 'l5', 'c13', 'm12', 'f4', 'j3', 'n8', 'b9', 'g12']) await click(c);
  g = await G();
  ok(g.phase === 'tpick' && await page.locator('#marks .mark.offer').count() === 10, 'ten offered fifth stones are marked');
  await page.screenshot({ path: OUT + '/gomoku-renju-offers.png' });
  await click('k7');
  g = await G();
  ok(g.phase === 'play' && g.stones === 5 && (await page.textContent('#log')).includes('挑中'), 'White picked k7; it is Black stone 5');
  // Black builds k7 m7 and l6 l8, so l7 becomes a three-three for Black
  for (const c of ['a1', 'm7', 'a3', 'l8', 'a5', 'l6', 'a7']) await click(c);
  const banned = await page.evaluate(() => window.__gomoku.banned);
  ok(banned.includes(P('l7')) && await page.locator('#marks .mark.ban').count() >= 1, 'Black to move: l7 (three-three) is marked ×');
  ok((await page.textContent('#sub')).includes('禁手'), 'the status explains the × marks');
  const before = (await G()).stones;
  await click('l7');
  ok((await G()).stones === before, 'Black cannot play on a forbidden point');
  await page.screenshot({ path: OUT + '/gomoku-renju-ban.png' });

  // --- phone ---
  const phone = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await phone.newPage();
  watch(p2);
  await p2.goto(BASE + 'gomoku/');
  await p2.evaluate(() => { localStorage.setItem('ga-jielu-lang', 'zh'); localStorage.setItem('ga-gomoku-mode', 'ai'); localStorage.setItem('ga-gomoku-level', 'normal'); localStorage.setItem('ga-gomoku-rule', 'std'); });
  await p2.reload();
  await p2.waitForTimeout(500);
  const sw = await p2.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, 'no horizontal scroll on a 390 px phone (scrollWidth ' + sw + ')');
  const cellPx = await p2.evaluate(() => document.querySelector('#cells .cellbtn').getBoundingClientRect().width);
  ok(cellPx >= 21, `each point is a ${cellPx.toFixed(1)} px target on the phone`);
  await p2.screenshot({ path: OUT + '/gomoku-phone.png', fullPage: true });
  await p2.tap(`#cells .cellbtn[data-i="${P('h8')}"]`);
  let s2 = await p2.evaluate(() => window.__gomoku.state.stones);
  ok(s2 === 0 && await p2.locator('#marks .ghost.aim').count() === 1 && (await p2.textContent('#sub')).includes('h8'), 'phone: first tap aims (ghost stone, "tap again" hint)');
  await p2.screenshot({ path: OUT + '/gomoku-phone-aim.png' });
  await p2.tap(`#cells .cellbtn[data-i="${P('h8')}"]`);
  s2 = await p2.evaluate(() => window.__gomoku.state.stones);
  ok(s2 === 1, 'phone: second tap on the same point places the stone');
  for (const c of ['i9', 'g9']) { await p2.tap(`#cells .cellbtn[data-i="${P(c)}"]`); await p2.tap(`#cells .cellbtn[data-i="${P(c)}"]`); }
  await p2.waitForFunction(() => !window.__gomoku.busy && window.__gomoku.state.phase !== 'swap', null, { timeout: 20000 });
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: OUT + '/gomoku-phone-play.png', fullPage: true });
  const sw2 = await p2.evaluate(() => document.documentElement.scrollWidth);
  ok(sw2 <= 390, 'still no horizontal scroll after play (' + sw2 + ')');
  // the swap choices on a phone
  await p2.evaluate(() => window.__gomoku.nextGame());
  await p2.waitForFunction(() => window.__gomoku.state.phase === 'swap' && !window.__gomoku.busy, null, { timeout: 20000 });
  await p2.waitForTimeout(900);
  await p2.screenshot({ path: OUT + '/gomoku-phone-swap.png' });
  const sw3 = await p2.evaluate(() => document.documentElement.scrollWidth);
  ok(sw3 <= 390, 'Swap2 buttons fit the phone (' + sw3 + ')');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await br.close();
}

(async () => {
  await unit();
  if (!process.env.UNIT_ONLY) await browser();
})().catch((e) => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
