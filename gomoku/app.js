import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { N, SIZE, BLACK, WHITE } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    restart: '重新開始', next: '下一局（交換開局）',
    moves: '棋譜', noMoves: '還沒有落子。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '全部遊戲',
    color: ['黑', '白'], you: '你', cpu: '電腦', p: ['玩家一', '玩家二'],
    round: (n) => `第 ${n} 局`,
    opens: { free: (n) => `${n}執黑先下`, std: (n) => `${n}開局`, renju: (n) => `${n}先執黑` },
    ruleLbl: '規則', ruleFree: '一般', ruleStd: 'Swap2 職業', ruleRenju: '連珠職業',
    tag: { free: '一般玩法', std: 'Swap2 · 剛好五子', renju: '連珠 · Taraguchi-10' },
    ruleAsk: '換規則會重新開始這一局。', ruleNo: '繼續這一局', ruleYes: '換規則',
    stoneN: (n) => `第 ${n} 子`, endPly: (n) => `共 ${n} 手`,
    fair: {
      free: '<b>一般玩法。</b>黑棋先下，雙方輪流，五子以上連成一線就贏。先下的一方佔便宜：不加限制時，黑棋只要每步都下對就一定會贏（Allis，1994）。所以「下一局」會交換執黑的人。想下得更公平，可以選職業玩法。',
      std: '<b>職業五子棋。</b>五子棋世界錦標賽用的規則：要剛好五子才算贏，六子以上不算，棋局繼續。開局用 Swap2：一方先擺三子（兩黑一白），另一方看過再決定執黑、執白，或再擺兩子把選擇權交回去。這樣擺開局的人必須擺得均勢。Swap2 沒有被證明完全公平。',
      renju: '<b>職業連珠。</b>連珠世界錦標賽用的規則（國際連珠聯盟 RIF）。黑棋先下但有限制：要剛好五子才算贏，而且不能下禁手，也就是三三、四四和長連（六子以上）。白棋沒有限制，五子以上都算贏。開局用 Taraguchi-10：前五手要下在中央逐漸放大的範圍內，每一手之後對方都可以交換顏色。黑棋的禁手點會標上 ×。',
    },
    youOpen: '由你擺開局', pOpen: (n) => `${n}擺開局`, aiOpen: '電腦正在擺開局',
    open3Hint: (k, c) => `放三子：兩黑一白。之後對手會挑顏色，所以擺得越均勢越好。下一子：${c}（${k}/3）。`,
    youChoose: '輪到你選', pChoose: (n) => `輪到${n}選`, aiChoose: '電腦正在選擇',
    swapHint: '開局三子已經擺好。選一種做法：',
    opt: { white: '執白，我下第四子', black: '執黑，對手下第四子', two: '再下兩子，讓對手挑顏色' },
    youTwo: '再下兩子', pTwo: (n) => `${n}再下兩子`, aiTwo: '電腦正在加兩子',
    open2Hint: (k, c) => `先下一黑，再下一白。之後由對手挑顏色。下一子：${c}（${k}/2）。`,
    youPick: '由你挑顏色', pPick: (n) => `由${n}挑顏色`, aiPick: '電腦正在挑顏色',
    pickHint: '對手加了兩子。挑一個顏色，白棋先走。',
    pickOpt: { black: '執黑', white: '執白' },
    yourMove: (c) => `輪到你（${c}）`, pMove: (n, c) => `輪到${n}（${c}）`, aiMove: '電腦思考中',
    playHint: '白棋先走，剛好五子才算贏。',
    freeHint: '黑棋先下，雙方輪流，五子以上連成一線就贏。',
    youPlace: (n, c) => `下第 ${n} 手（${c}）`, pPlace: (p, n, c) => `${p}下第 ${n} 手（${c}）`, aiPlace: (n) => `電腦正在下第 ${n} 手`,
    zoneHint: (n, k) => (n === 1 ? '第一手固定下在天元 h8。下完後，對方可以選擇交換顏色。'
      : `第 ${n} 手要下在中央 ${k} × ${k} 的金框內。${n === 4 ? '下完後由執黑的一方決定第五手怎麼下' : '下完後對方可以選擇交換顏色'}，所以下得均勢最好。`),
    youSwapQ: '要不要交換顏色？', pSwapQ: (p) => `${p}決定要不要交換`, aiSwapQ: '電腦正在決定要不要交換',
    swapQ: (n, c, o) => (n === 5 ? '第五手已經下好。你可以繼續執白，下第六手，之後正常輪流；或交換成執黑，讓對方執白下第六手。'
      : `第 ${n} 手已經下好。你可以繼續執${c}，下第 ${n + 1} 手；或交換成執${o}，讓對方下第 ${n + 1} 手。`),
    keepOpt: (c, n) => `繼續執${c}，我下第 ${n} 手`, swapOpt: (o) => `交換，改執${o}`,
    youFifth: '第五手怎麼下？', pFifth: (p) => `${p}決定第五手`, aiFifth: '電腦正在決定第五手',
    fifthHint: '你執黑。可以在中央 9 × 9 內下第五手（之後白方可以交換）；可以先交換顏色，改由對方執黑下第五手；也可以在任何地方提出十個第五手，讓白方挑一個。',
    fifthOpt: { place: '在 9 × 9 內下第五手', swap: '交換顏色', ten: '提出十個第五手' },
    youOffer: (k) => `提出第五手（${k}/10）`, pOffer: (p, k) => `${p}提出第五手（${k}/10）`, aiOffer: '電腦正在提出第五手',
    offerHint: '在任何空點放下一個候選的第五手。和已提出的點對稱的位置不能用。白方會從十個裡挑一個。',
    youPick5: '挑一個第五手', pPick5: (p) => `${p}挑第五手`, aiPick5: '電腦正在挑第五手',
    pick5Hint: '黑方提出了十個第五手（金色虛圈）。點其中一個，它就成為黑棋的第五手，接著輪到白棋下第六手。',
    renjuPlay: '開局結束，白棋下第六手。黑棋要剛好五子才算贏，白棋五子以上都算。',
    banHint: '× 是黑棋的禁手點（三三、四四或長連），黑棋不能下。',
    offerLog: (c) => `提出 ${c}`, pickLog: (c, p) => `黑 ${c}（${p}挑中）`,
    chose: (n, v) => ({ white: `${n}選了執白`, black: `${n}選了執黑`, two: `${n}選了再下兩子`, keep: `${n}不交換`, swap: `${n}交換顏色`, place: `${n}選擇在 9 × 9 內下第五手`, ten: `${n}選擇提出十個第五手` })[v],
    stop: '。',
    tapAim: '點一下瞄準，再點一下落子。', tapAgain: (c) => `再點一次 ${c} 就落子。`,
    winYou: '你贏了', winAi: '電腦獲勝', winP: (n) => `${n}勝`,
    drawBig: '和局', drawEnd: '棋盤下滿了，沒有人連成五子。',
    endSmall: (c, n) => `${c}棋連成五子，共 ${n} 手`,
    look: '看一下棋盤',
    restartAsk: '重新開始會清掉這一局。', restartNo: '繼續這一局', restartYes: '重新開始',
    cell: { empty: '空', 0: '黑子', 1: '白子', ban: '黑棋禁手', offer: '候選第五手' }, boardLabel: '棋盤',
    rules: {
      free: `
      <ol>
        <li><b>目標：</b>讓自己的五顆棋子連成一直線，橫、直、斜都可以。六顆以上也算贏。</li>
        <li>棋子下在線的交叉點上，下了就不再移動。</li>
        <li>黑棋先下，之後雙方輪流，一次下一子。</li>
        <li>棋盤下滿還沒有人連成五子，就是和局。</li>
        <li>「下一局」會交換執黑的人。</li>
      </ol>`,
      std: `
      <ol>
        <li><b>目標：</b>剛好五顆棋子連成一直線，橫、直、斜都可以。六顆以上不算贏，棋局繼續。</li>
        <li><b>開局（Swap2）：</b>開局的一方先放三子：兩黑一白。</li>
        <li>另一方從三種做法選一種：執白，自己下第四子；執黑，由對方執白下第四子；或再下一黑一白，讓對方挑顏色。</li>
        <li>顏色定了以後，白棋先走，雙方輪流下。</li>
        <li>棋盤下滿還沒有人連成五子，就是和局。「下一局」會交換由誰開局。</li>
      </ol>`,
      renju: `
      <ol>
        <li><b>目標：</b>五顆棋子連成一直線。黑棋要剛好五子；白棋五子以上都算。</li>
        <li><b>黑棋的禁手：</b>黑棋不能一手同時做出兩個活三（三三）、兩個四（四四），也不能連成六子以上（長連）。只要這一手剛好連成五子，就算贏，不算禁手。棋盤上會用 × 標出禁手點。</li>
        <li>「活三」是再加一子就能變成兩頭都能連五的四。如果那一子本身是禁手，這個三不算活三。</li>
        <li><b>開局（Taraguchi-10）：</b>第一手黑棋下在天元 h8；第二手白棋在中央 3 × 3 內；第三手黑棋在 5 × 5 內；第四手白棋在 7 × 7 內。前三手每下一手，對方都可以選擇交換顏色。</li>
        <li><b>第五手：</b>執黑的一方可以在 9 × 9 內下第五手（之後白方可以交換）、先交換顏色，或在任何地方提出十個第五手（不能互相對稱），由白方挑一個。</li>
        <li>之後白棋下第六手，雙方輪流。棋盤下滿還沒有人連成五子，就是和局。</li>
      </ol>`,
    },
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    restart: 'Restart', next: 'Next game (swap opener)',
    moves: 'Moves', noMoves: 'No stones yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'All games',
    color: ['Black', 'White'], you: 'You', cpu: 'Computer', p: ['Player 1', 'Player 2'],
    round: (n) => `Game ${n}`,
    opens: {
      free: (n) => (n === 'You' ? 'You play Black first' : `${n} plays Black first`),
      std: (n) => (n === 'You' ? 'You open' : `${n} opens`),
      renju: (n) => (n === 'You' ? 'You start as Black' : `${n} starts as Black`),
    },
    ruleLbl: 'Rules', ruleFree: 'Casual', ruleStd: 'Pro gomoku', ruleRenju: 'Pro renju',
    tag: { free: 'Casual', std: 'Swap2 · exactly five', renju: 'Renju · Taraguchi-10' },
    ruleAsk: 'Changing the rules starts this game again.', ruleNo: 'Keep playing', ruleYes: 'Change rules',
    stoneN: (n) => `Stone ${n}`, endPly: (n) => `${n} moves`,
    fair: {
      free: '<b>Casual.</b> Black moves first, then you take turns. Five or more in a row wins. Moving first is an edge: with no extra rule, Black can always win with perfect play (Allis, 1994). So "Next game" swaps who plays Black. For fairer games, pick one of the pro rules.',
      std: '<b>Pro gomoku.</b> The rules of the Gomoku World Championship: exactly five wins, and six or more does not (play goes on). The opening is Swap2: one player lays three stones (two black, one white), and the other looks, then plays Black, plays White, or adds two more and hands the choice back. So the opener has to keep it even. Nobody has proven Swap2 perfectly fair.',
      renju: '<b>Pro renju.</b> The rules of the Renju World Championship (Renju International Federation). Black moves first but is restricted: only exactly five wins, and Black may not play a forbidden move: a double three, a double four or an overline (six or more). White has no limits, and five or more wins. The opening is Taraguchi-10: the first five stones go inside a central square that grows each move, and after each one the other player may swap colours. Black\'s forbidden points are marked ×.',
    },
    youOpen: 'You set the opening', pOpen: (n) => `${n} sets the opening`, aiOpen: 'The computer is setting the opening',
    open3Hint: (k, c) => `Place three stones: two black, one white. Your opponent then picks a colour, so keep it even. Next: ${c.toLowerCase()} (${k} of 3).`,
    youChoose: 'Your choice', pChoose: (n) => `${n} to choose`, aiChoose: 'The computer is choosing',
    swapHint: 'The three opening stones are down. Pick one:',
    opt: { white: 'Play White, I place stone 4', black: 'Play Black, they place stone 4', two: 'Place two more, they pick' },
    youTwo: 'Place two more stones', pTwo: (n) => `${n} places two more`, aiTwo: 'The computer is adding two stones',
    open2Hint: (k, c) => `One black, then one white. Then your opponent picks a colour. Next: ${c.toLowerCase()} (${k} of 2).`,
    youPick: 'Pick your colour', pPick: (n) => `${n} picks a colour`, aiPick: 'The computer is picking a colour',
    pickHint: 'Your opponent added two stones. Pick a colour. White moves first.',
    pickOpt: { black: 'Play Black', white: 'Play White' },
    yourMove: (c) => `Your move (${c})`, pMove: (n, c) => `${n} to move (${c})`, aiMove: 'Computer is thinking',
    playHint: 'White moves first. Exactly five in a row wins.',
    freeHint: 'Black moves first, then you take turns. Five or more in a row wins.',
    youPlace: (n, c) => `Place stone ${n} (${c.toLowerCase()})`, pPlace: (p, n, c) => `${p} places stone ${n} (${c.toLowerCase()})`, aiPlace: (n) => `The computer is placing stone ${n}`,
    zoneHint: (n, k) => (n === 1 ? 'Stone 1 always goes on the centre point, h8. Then the other player may swap colours.'
      : `Stone ${n} goes inside the central ${k} × ${k} square (gold frame). ${n === 4 ? 'Then the player holding Black decides how stone 5 is played' : 'Then the other player may swap colours'}, so keep it even.`),
    youSwapQ: 'Swap colours?', pSwapQ: (p) => `${p} decides whether to swap`, aiSwapQ: 'The computer is deciding whether to swap',
    swapQ: (n, c, o) => (n === 5 ? 'Stone 5 is down. Keep White and play stone 6, after which you take turns; or swap to Black and let the other player play stone 6 as White.'
      : `Stone ${n} is down. Keep ${c} and place stone ${n + 1}; or swap to ${o} and let the other player place stone ${n + 1}.`),
    keepOpt: (c, n) => `Keep ${c}, I place stone ${n}`, swapOpt: (o) => `Swap to ${o}`,
    youFifth: 'How is stone 5 played?', pFifth: (p) => `${p} decides on stone 5`, aiFifth: 'The computer is deciding on stone 5',
    fifthHint: 'You hold Black. Place stone 5 inside the central 9 × 9 (then White may swap); swap colours first, so the other player places stone 5 as Black; or offer ten fifth stones anywhere and let White pick one.',
    fifthOpt: { place: 'Place stone 5 in the 9 × 9', swap: 'Swap colours', ten: 'Offer ten fifth stones' },
    youOffer: (k) => `Offer a fifth stone (${k} of 10)`, pOffer: (p, k) => `${p} offers a fifth stone (${k} of 10)`, aiOffer: 'The computer is offering fifth stones',
    offerHint: 'Put a candidate fifth stone on any empty point. A point that mirrors one already offered is not allowed. White will pick one of the ten.',
    youPick5: 'Pick a fifth stone', pPick5: (p) => `${p} picks the fifth stone`, aiPick5: 'The computer is picking the fifth stone',
    pick5Hint: 'Black has offered ten fifth stones (gold dashed rings). Tap one: it becomes Black\'s fifth stone, and White plays stone 6.',
    renjuPlay: 'The opening is over; White plays stone 6. Black needs exactly five; for White five or more counts.',
    banHint: '× marks Black\'s forbidden points (double three, double four or overline). Black may not play there.',
    offerLog: (c) => `offers ${c}`, pickLog: (c, p) => `Black ${c} (picked by ${p})`,
    chose: (n, v) => ({ white: `${n} took White`, black: `${n} took Black`, two: `${n} chose to place two more`, keep: `${n} kept colours`, swap: `${n} swapped colours`, place: `${n} will place stone 5 in the 9 × 9`, ten: `${n} will offer ten fifth stones` })[v],
    stop: '. ',
    tapAim: 'Tap once to aim, then tap again to place.', tapAgain: (c) => `Tap ${c} again to place.`,
    winYou: 'You win', winAi: 'Computer wins', winP: (n) => `${n} wins`,
    drawBig: 'Draw', drawEnd: 'The board is full and nobody made five.',
    endSmall: (c, n) => `${c} made five in ${n} moves`,
    look: 'Look at the board',
    restartAsk: 'Restarting clears this game.', restartNo: 'Keep playing', restartYes: 'Restart',
    cell: { empty: 'empty', 0: 'black stone', 1: 'white stone', ban: 'forbidden for Black', offer: 'offered fifth stone' }, boardLabel: 'Board',
    rules: {
      free: `
      <ol>
        <li><b>Goal:</b> get five of your stones in a straight line: across, down or diagonal. Six or more also wins.</li>
        <li>Stones go where the lines cross. Once placed, a stone never moves.</li>
        <li>Black moves first, then you take turns, one stone each.</li>
        <li>If the board fills up and nobody has five, the game is a draw.</li>
        <li>"Next game" swaps who plays Black.</li>
      </ol>`,
      std: `
      <ol>
        <li><b>Goal:</b> exactly five of your stones in a straight line: across, down or diagonal. Six or more does not win, and play goes on.</li>
        <li><b>Opening (Swap2):</b> the opener places three stones: two black, one white.</li>
        <li>The other player picks one of three: play White and place stone 4; play Black, so the opener plays White and places stone 4; or place two more stones (one black, one white) and let the opener pick the colour.</li>
        <li>Once colours are set, White moves first and the players take turns.</li>
        <li>If the board fills up and nobody has five, the game is a draw. "Next game" swaps who opens.</li>
      </ol>`,
      renju: `
      <ol>
        <li><b>Goal:</b> five in a straight line. Black needs exactly five; for White five or more counts.</li>
        <li><b>Black's forbidden moves:</b> Black may not make two open threes at once (double three), two fours at once (double four), or six or more in a row (overline). A move that makes exactly five wins anyway. Forbidden points are marked × on the board.</li>
        <li>An open three is a three that one more stone turns into a four with both ends open. If that extra stone would itself be forbidden, it is not an open three.</li>
        <li><b>Opening (Taraguchi-10):</b> stone 1 (Black) goes on the centre, h8; stone 2 (White) inside the central 3 × 3; stone 3 (Black) inside 5 × 5; stone 4 (White) inside 7 × 7. After each of the first three, the other player may swap colours.</li>
        <li><b>Stone 5:</b> the player holding Black places it inside 9 × 9 (then White may swap), swaps colours first, or offers ten fifth stones anywhere (no two mirroring each other) and lets White pick one.</li>
        <li>White then plays stone 6 and the players take turns. If the board fills up and nobody has five, the game is a draw.</li>
      </ol>`,
    },
  },
};

// ---------- settings ----------
const store = makeStore('gomoku');
let lang = initialLang();
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';
// Casual play is the default: people expect Black and White to take turns from the first stone.
let rule = store.get('rule', 'free');
if (!E.RULES.includes(rule)) rule = 'free';

const HUMAN = 0;      // vs computer, the person is player 1 (left on the scoreboard)
let opener = 0;       // player 1 opens game 1; "Next game" swaps
let state = null;
let busy = false;
// Session score only, by player identity: a reload starts over.
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false;
let hover = -1, aim = -1, cursor = 112, pointer = 'mouse';
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

// ---------- board DOM ----------
const boardEl = $('board'), stonesL = $('stones'), marksL = $('marks'), cellsL = $('cells'), winSvg = $('winline');
const SVGNS = 'http://www.w3.org/2000/svg';
const place = (el, i) => { el.style.setProperty('--r', Math.floor(i / N)); el.style.setProperty('--c', i % N); };

(function drawGrid() {
  const g = $('grid');
  let s = `<rect class="field" x=".5" y=".5" width="14" height="14"/>`;
  for (let k = 0; k < N; k++) {
    const v = k + 0.5, cls = k === 0 || k === N - 1 ? ' class="edge"' : '';
    s += `<line${cls} x1="${v}" y1=".5" x2="${v}" y2="14.5"/><line${cls} x1=".5" y1="${v}" x2="14.5" y2="${v}"/>`;
  }
  for (const i of E.STARS) s += `<circle class="star" cx="${(i % N) + 0.5}" cy="${Math.floor(i / N) + 0.5}" r=".085"/>`;
  g.innerHTML = s;
})();

const cellBtns = [];
for (let i = 0; i < SIZE; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cellbtn at';
  b.dataset.i = i;
  b.setAttribute('role', 'gridcell');
  place(b, i);
  b.addEventListener('click', () => onCell(i));
  cellsL.appendChild(b);
  cellBtns.push(b);
}
cellsL.addEventListener('pointerdown', (e) => { pointer = e.pointerType || 'mouse'; });
cellsL.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const i = Number(e.target.dataset?.i);
  if (Number.isInteger(i) && i !== hover) { hover = i; renderMarks(); }
});
cellsL.addEventListener('pointerleave', () => { if (hover !== -1) { hover = -1; renderMarks(); } });
// Keyboard: one cell is focusable; arrows move it, Enter or Space places.
cellsL.addEventListener('keydown', (e) => {
  const d = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  pointer = 'key';
  if (d === undefined) return;
  e.preventDefault();
  const r = Math.floor(cursor / N), c = cursor % N;
  const nr = r + (d === -N ? -1 : d === N ? 1 : 0), nc = c + (d === -1 ? -1 : d === 1 ? 1 : 0);
  if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
  setCursor(nr * N + nc, true);
});
function setCursor(i, focus) {
  cellBtns[cursor].tabIndex = -1;
  cursor = i;
  cellBtns[cursor].tabIndex = 0;
  if (focus) cellBtns[cursor].focus();
}

const stoneEls = new Map();
function syncStones() {
  for (const m of state.moves) {
    if ((m.t !== 'stone' && m.t !== 'pick') || stoneEls.has(m.i)) continue;
    const el = document.createElement('div');
    el.className = 'stone at new ' + (m.color === BLACK ? 'b' : 'w');
    el.innerHTML = '<i></i>';
    place(el, m.i);
    stonesL.appendChild(el);
    stoneEls.set(m.i, el);
    setTimeout(() => el.classList.remove('new'), 400);
  }
}

function drawWinLines() {
  winSvg.innerHTML = '';
  for (const run of state.lines) {
    const a = run[0], z = run[run.length - 1];
    const x1 = (a % N) + 0.5, y1 = Math.floor(a / N) + 0.5, x2 = (z % N) + 0.5, y2 = Math.floor(z / N) + 0.5;
    for (const cls of ['glow', 'shade', 'core']) {
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('class', cls);
      ln.setAttribute('pathLength', '1');
      ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
      winSvg.appendChild(ln);
    }
    for (const i of run) stoneEls.get(i)?.classList.add('won');
  }
}

// ---------- game flow ----------
const over = () => E.isOver(state);
const isAiTurn = () => mode === 'ai' && !over() && E.actor(state) !== HUMAN;
const humanPlaces = () => !over() && !busy && !isAiTurn() && E.stoneColor(state) !== null;
const name = (p) => (mode === 'ai' ? (p === HUMAN ? T[lang].you : T[lang].cpu) : T[lang].p[p]);

const ai = new AIClient(new URL('./ai-worker.js', import.meta.url), onAiReply);

function newGame() {
  ai.cancel();
  busy = false;
  state = E.initialState(opener, rule);
  counted = false; overlayHidden = false; hover = -1; aim = -1;
  stonesL.innerHTML = ''; winSvg.innerHTML = '';
  stoneEls.clear();
  render();
  maybeAi();
}

function resetMatch() { score = [0, 0]; gameNo = 1; opener = 0; }

function play(m) {
  state = E.applyMove(state, m);
  aim = -1;
  syncStones();
  if (over()) {
    if (!counted) { counted = true; if (state.winner !== null) score[state.winner]++; }
    drawWinLines();
  }
  render();
  maybeAi();
}

function maybeAi() {
  if (!isAiTurn()) return;
  busy = true;
  render();
  ai.ask({ state, level, gameNo });
}

const aiStats = [];
function onAiReply({ move, ms, depth, nodes }) {
  busy = false;
  aiStats.push({ phase: state.phase, level, ms, depth, nodes });
  const ok = move && (move.t === 'stone' ? E.canPlace(state, move.i) : E.legalChoices(state).includes(move.v));
  if (ok && isAiTurn()) play(move); else render();
}

function onCell(i) {
  if (!humanPlaces() || !E.canPlace(state, i)) return;
  setCursor(i, false);
  // On a touch screen the points are small, so the first tap aims and the second places.
  if (pointer === 'touch' && aim !== i) { aim = i; render(); return; }
  play({ t: 'stone', i });
}

function onChoice(v) {
  if (over() || busy || isAiTurn() || !E.legalChoices(state).includes(v)) return;
  play({ t: 'choice', v });
}

// ---------- rendering ----------
function render() {
  const L = T[lang];
  applyStatic(L, lang);
  setSeg('modeSeg', mode); setSeg('levelSeg', level);
  $('levelRow').hidden = mode !== 'ai';
  setSeg('ruleSeg', rule);
  $('tag').textContent = L.tag[rule];
  $('fairNote').innerHTML = L.fair[rule];
  $('rulesBody').innerHTML = L.rules[rule];
  cellsL.setAttribute('aria-label', L.boardLabel);
  const a = E.actor(state);
  boardEl.classList.toggle('turn-0', a === 0);
  boardEl.classList.toggle('turn-1', a === 1);
  boardEl.classList.toggle('over', over());
  const orb = (p) => (state.colorOf ? (state.colorOf[p] === BLACK ? 'black' : 'white') : 'tbd');
  renderScore({
    left: { name: name(0), pts: score[0], on: !over() && a === 0, orb: orb(0) },
    right: { name: name(1), pts: score[1], on: !over() && a === 1, orb: orb(1) },
    roundBold: L.round(gameNo),
    roundSmall: L.opens[rule](name(opener)),
  });
  for (const [id, p] of [['sbMint', 0], ['sbCoral', 1]]) $(id).title = state.colorOf ? L.color[state.colorOf[p]] : '';
  computeBanned();
  renderStatusLine();
  renderChoices();
  renderMoves();
  renderMarks();
  renderCells();
  renderResult();
  $('nextBtn').hidden = !over();
}

function renderStatusLine() {
  const L = T[lang];
  const a = E.actor(state), col = E.stoneColor(state), ai = isAiTurn();
  const you = mode === 'ai';
  let msg = '', sub = '';
  if (over()) {
    msg = state.winner === null ? L.drawBig : you ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winP(name(state.winner));
    renderStatus({ side: null, end: true, msg, ply: L.endPly(state.stones), sub: state.winner === null ? L.drawEnd : '' });
    return;
  }
  const ph = state.phase, n = state.stones + 1;
  const turnC = L.color[state.turn ?? 0], otherC = L.color[1 - (state.turn ?? 0)];
  const lastM = state.moves[state.moves.length - 1];
  if (ai) {
    msg = { open3: L.aiOpen, swap: L.aiChoose, open2: L.aiTwo, pick: L.aiPick, play: L.aiMove, tplace: L.aiPlace(n),
      tswap: L.aiSwapQ, tfifth: L.aiFifth, toffer: L.aiOffer, tpick: L.aiPick5 }[ph];
  } else if (ph === 'open3') {
    msg = you ? L.youOpen : L.pOpen(name(a));
    sub = L.open3Hint(state.placed + 1, L.color[col]);
  } else if (ph === 'swap') {
    msg = you ? L.youChoose : L.pChoose(name(a));
    sub = L.swapHint;
  } else if (ph === 'open2') {
    msg = you ? L.youTwo : L.pTwo(name(a));
    sub = L.open2Hint(state.placed + 1, L.color[col]);
  } else if (ph === 'pick') {
    msg = you ? L.youPick : L.pPick(name(a));
    sub = L.pickHint;
  } else if (ph === 'tplace') {
    msg = you ? L.youPlace(n, turnC) : L.pPlace(name(a), n, turnC);
    sub = L.zoneHint(n, 2 * state.stones + 1);
  } else if (ph === 'tswap') {
    msg = you ? L.youSwapQ : L.pSwapQ(name(a));
    sub = L.swapQ(state.stones, turnC, otherC);
  } else if (ph === 'tfifth') {
    msg = you ? L.youFifth : L.pFifth(name(a));
    sub = L.fifthHint;
  } else if (ph === 'toffer') {
    msg = you ? L.youOffer(state.offers.length + 1) : L.pOffer(name(a), state.offers.length + 1);
    sub = L.offerHint;
  } else if (ph === 'tpick') {
    msg = you ? L.youPick5 : L.pPick5(name(a));
    sub = L.pick5Hint;
  } else {
    msg = you ? L.yourMove(L.color[col]) : L.pMove(name(a), L.color[col]);
    if (rule === 'free') { if (state.stones === 0) sub = L.freeHint; }
    else if (rule === 'std') { if (lastM && lastM.t === 'choice') sub = L.chose(name(lastM.player), lastM.v) + L.stop + L.playHint; }
    else if (state.stones === 5 && lastM && lastM.t !== 'stone') sub = L.renjuPlay;
    if (rule === 'renju' && state.turn === BLACK && banned.length) sub = (sub ? sub + (lang === 'zh' ? '' : ' ') : '') + L.banHint;
  }
  if (ai && ph !== 'play') {
    // while the computer works through the opening, keep the rule of the step in view
    sub = ph === 'tplace' ? L.zoneHint(n, 2 * state.stones + 1) : '';
  }
  if (!ai && col !== null && ph !== 'tpick') {
    if (aim >= 0) sub = L.tapAgain(E.cellName(aim));
    else if (coarse && state.stones === 0) sub += (lang === 'zh' ? '' : ' ') + L.tapAim;
  }
  const showN = col !== null && ph !== 'toffer' && ph !== 'tpick';
  renderStatus({ side: col, end: false, msg, thinking: ai, ply: showN ? L.stoneN(n) : '', sub });
}

function choiceLabel(v) {
  const L = T[lang], ph = state.phase;
  if (ph === 'swap') return L.opt[v];
  if (ph === 'pick') return L.pickOpt[v];
  if (ph === 'tswap') return v === 'keep' ? L.keepOpt(L.color[state.turn], state.stones + 1) : L.swapOpt(L.color[1 - state.turn]);
  return L.fifthOpt[v];
}
function choiceIcon(v) {
  const ph = state.phase;
  if (ph === 'tswap') return v === 'keep' ? (state.turn === BLACK ? 'mini b' : 'mini w') : (state.turn === BLACK ? 'mini w' : 'mini b');
  if (ph === 'tfifth') return { place: 'mini b', swap: 'mini w', ten: 'mini pair' }[v];
  return { white: 'mini w', black: 'mini b', two: 'mini pair' }[v];
}

function renderChoices() {
  const box = $('choices');
  const show = !over() && !busy && !isAiTurn() && E.legalChoices(state).length > 0;
  const appearing = show && box.hidden;
  box.hidden = !show;
  box.innerHTML = '';
  if (!show) return;
  // the buttons sit under the board; bring them into view when a choice is due
  if (appearing) {
    requestAnimationFrame(() => {
      const r = box.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        box.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
      }
    });
  }
  for (const v of E.legalChoices(state)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ga-btn';
    b.dataset.v = v;
    b.innerHTML = `<i class="${choiceIcon(v)}" aria-hidden="true"></i><span>${choiceLabel(v)}</span>`;
    b.addEventListener('click', () => onChoice(v));
    box.appendChild(b);
  }
}

function renderMoves() {
  const L = T[lang];
  // In the pro openings one player may place stones of both colours, so those stones also say who
  // placed them: up to the Swap2 colour choice, or the first five stones of a renju game.
  const settled = rule === 'std' ? state.moves.findIndex((x) => x.t === 'choice' && x.v !== 'two') : -1;
  let stoneCount = 0;
  const rows = state.moves.map((m, k) => {
    if (m.t === 'choice') return { side: 0, choice: true, text: L.chose(name(m.player), m.v) };
    if (m.t === 'offer') return { side: 0, choice: true, text: `${name(m.player)} ${L.offerLog(E.cellName(m.i))}` };
    stoneCount++;
    const opening = rule === 'std' ? settled < 0 || k < settled : rule === 'renju' ? stoneCount <= 5 : false;
    if (m.t === 'pick') return { side: m.color, text: L.pickLog(E.cellName(m.i), name(m.player)) };
    const text = `${L.color[m.color]} ${E.cellName(m.i)}`;
    return { side: m.color, text: text + (opening ? ` <span class="who">· ${name(m.player)}</span>` : '') };
  });
  renderLog(rows, () => '');
  // stone numbers instead of row numbers; choices and offers get a small diamond
  const lis = $('log').querySelectorAll('li');
  let n = 0;
  rows.forEach((r, k) => {
    const li = lis[k];
    if (r.choice) { li.classList.add('choice'); li.querySelector('.n').textContent = ''; li.querySelector('.d').className = 'd choice'; }
    else li.querySelector('.n').textContent = ++n;
  });
}

// Black's forbidden points near the stones (renju, Black to move); recomputed each render.
let banned = [];
function computeBanned() {
  banned = [];
  if (rule !== 'renju' || state.phase !== 'play' || state.turn !== BLACK) return;
  for (let i = 0; i < SIZE; i++) if (state.board[i] === -1 && E.forbiddenAt(state, i)) banned.push(i);
}

function renderMarks() {
  marksL.innerHTML = '';
  if (state.last >= 0) addMark('mark last', state.last);
  if (state.phase === 'tplace' && state.stones > 0) {
    // the square stone n must go in
    const r = state.stones, z = document.createElement('div');
    z.className = 'zone';
    z.style.left = z.style.top = `${((7 - r) / N) * 100}%`;
    z.style.width = z.style.height = `${((2 * r + 1) / N) * 100}%`;
    marksL.appendChild(z);
  }
  state.offers.forEach((i, k) => { const d = addMark('mark offer', i); d.dataset.k = k + 1; });
  for (const i of banned) addMark('mark ban', i);
  if (!humanPlaces()) return;
  const col = E.stoneColor(state);
  const at = aim >= 0 ? aim : hover;
  if (at >= 0 && E.canPlace(state, at)) {
    const g = addMark('ghost ' + (col === BLACK ? 'b' : 'w') + (aim >= 0 ? ' aim' : ''), at);
    g.innerHTML = '<i></i>';
  }
}

function addMark(cls, i) {
  const d = document.createElement('div');
  d.className = cls + ' at';
  place(d, i);
  marksL.appendChild(d);
  return d;
}

function renderCells() {
  const L = T[lang];
  const can = humanPlaces();
  const ban = new Set(banned);
  for (let i = 0; i < SIZE; i++) {
    const b = cellBtns[i], v = state.board[i];
    b.classList.toggle('act', can && E.canPlace(state, i));
    const what = v !== -1 ? L.cell[v] : state.offers.includes(i) ? L.cell.offer : ban.has(i) ? L.cell.ban : L.cell.empty;
    b.setAttribute('aria-label', `${E.cellName(i)}, ${what}`);
    b.tabIndex = i === cursor ? 0 : -1;
  }
}

function renderResult() {
  const L = T[lang];
  if (!over()) { renderOverlay({ show: false }); return; }
  let big, small;
  if (state.winner === null) { big = L.drawBig; small = L.drawEnd; }
  else {
    big = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winP(name(state.winner));
    small = L.endSmall(L.color[state.colorOf[state.winner]], state.stones);
  }
  renderOverlay({ show: !overlayHidden, kind: 'draw', big, small, next: L.next, look: L.look });
}

// ---------- controls ----------
bindLang((v) => { lang = v; render(); });
onSeg('modeSeg', (v) => { if (v === mode) return; mode = v; store.set('mode', v); resetMatch(); newGame(); });
onSeg('levelSeg', (v) => { level = v; store.set('level', v); render(); });
onSeg('ruleSeg', async (v) => {
  if (v === rule) return;
  if (!over() && state.moves.length) {
    const L = T[lang];
    if (!(await confirmDialog(L.ruleAsk, L.ruleNo, L.ruleYes))) return;
  }
  rule = v; store.set('rule', v); resetMatch(); newGame();
});
$('restartBtn').onclick = async () => {
  if (!over() && state.moves.length) {
    const L = T[lang];
    if (!(await confirmDialog(L.restartAsk, L.restartNo, L.restartYes))) return;
  }
  newGame();
};
function nextGame() { opener = 1 - opener; gameNo++; newGame(); }
$('nextBtn').onclick = nextGame;
$('ovNext').onclick = nextGame;
$('ovLook').onclick = () => { overlayHidden = true; renderOverlay({ show: false }); };

newGame();

// exposed for automated tests
window.__gomoku = {
  get state() { return state; }, get busy() { return busy; }, get score() { return score.slice(); },
  get gameNo() { return gameNo; }, get mode() { return mode; }, get aiStats() { return aiStats.slice(); },
  get actor() { return E.actor(state); }, get rule() { return rule; }, get banned() { return banned.slice(); },
  nextGame,
};
