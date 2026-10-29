// Runs the computer player off the main thread.
import { search } from './ai.js';

self.onmessage = (e) => {
  const { id, state, history, level } = e.data;
  const r = search(state, level, new Map(history));
  self.postMessage({ id, move: r.move, score: r.score, depth: r.depth, nodes: r.nodes });
};
