// "Watch two full games": a named, title-screen-reachable AI vs AI demo. Two complete games are
// played end to end with the real search engine, at fixed, independently-seeded RNGs chosen so both
// reach a genuine terminal state (verified in test/game.test.js and by the scratch scripts recorded
// in STATUS.md) — one that showcases White winning, one that showcases Black winning, so a watcher
// sees both sides play (and win) across the pair. The seed is independent of env.config.seed so the
// demo is exactly reproducible on every device, matching the "reproducible" requirement.
import { createRng } from '../kit/rng.js';

// Seed 1 with these exact level pairings was verified (see test/game.test.js and STATUS.md) to
// reach checkmate deterministically: White mates in 85 plies with [4,2], Black mates in 38 plies
// with [2,4]. Changing either seed or level pairing requires re-verifying both still terminate.
export const DEMO_GAMES = [
  { name: 'Game 1 of 2 — White\'s Attack', seed: 1, levels: [4, 2] },
  { name: 'Game 2 of 2 — Black\'s Defence', seed: 1, levels: [2, 4] },
];
export const demoRng = (i) => createRng(DEMO_GAMES[i].seed);
