// Runs the Reversi computer player off the main thread.
import { search } from './ai.js';

self.onmessage = (e) => {
  const { id, board, side, level } = e.data;
  const r = search(board, side, level);
  self.postMessage({ id, move: r.move, score: r.score, depth: r.depth, nodes: r.nodes });
};
