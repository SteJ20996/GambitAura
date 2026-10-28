// Runs the computer player off the main thread.
import { chooseMove } from './ai.js';

self.onmessage = (e) => {
  const { id, n, board, turn, swap, level } = e.data;
  const r = chooseMove({ n, board, turn, swap }, level);
  self.postMessage({ id, move: r.move, value: r.value, why: r.why });
};
