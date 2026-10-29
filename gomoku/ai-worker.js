// Runs the computer player off the main thread.
import { decide } from './ai.js';

self.onmessage = (e) => {
  const { id, state, level, gameNo } = e.data;
  const t0 = performance.now();
  const r = decide(state, level, gameNo);
  self.postMessage({ id, move: r.move, score: r.score, depth: r.depth, nodes: r.nodes, ms: Math.round(performance.now() - t0) });
};
