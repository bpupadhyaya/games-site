// The whole rules engine: pure functions over plain data. Nothing here draws or touches time.
// Squares are numbered 1..100 from the bottom-left, snaking left-to-right then right-to-left.
// Square 0 means "not yet on the board". This file is the single source of truth: the Rules pages
// in content.js and every claim in them are cross-checked against it.

export const FINISH = 100;
export const BUMP_BACK = 3;        // bump-back option: the bumped pawn goes back this many squares
export const MAX_SIXES = 3;        // six-rolls-again option: at most this many sixes in a row

// ---- the classic board ---------------------------------------------------------------------------
export const CLASSIC_LADDERS = [[1, 38], [4, 14], [9, 31], [21, 42], [28, 84], [36, 44], [51, 67], [71, 91], [80, 100]];
export const CLASSIC_SNAKES = [[16, 6], [47, 26], [49, 11], [56, 53], [62, 19], [64, 60], [87, 24], [93, 73], [95, 75], [98, 78]];

// Good habits lift you (ladders), slips pull you down (serpents). Plain, kind, child-safe wording.
export const VIRTUES = ['Kindness', 'Honesty', 'Courage', 'Patience', 'Sharing', 'Gratitude', 'Curiosity', 'Hard work', 'Teamwork', 'Respect', 'Generosity', 'Forgiveness', 'Focus', 'Humility', 'Cheerfulness', 'Care'];
export const SLIPS = ['Anger', 'Greed', 'Laziness', 'A fib', 'Envy', 'Boasting', 'Carelessness', 'Rudeness', 'Impatience', 'Pride', 'Gossip', 'Grumbling', 'Teasing', 'Sulking', 'Hurry', 'Selfishness'];

export const DEFAULT_OPTS = { dice: 'one', exact: true, sixAgain: false, bump: false };

export function makeBoard(ladders, snakes, kind = 'classic') {
  const ls = ladders.slice().sort((a, b) => a[0] - b[0]).map(([a, b], i) => ({ from: a, to: b, name: VIRTUES[i % VIRTUES.length] }));
  const ss = snakes.slice().sort((a, b) => a[0] - b[0]).map(([a, b], i) => ({ from: a, to: b, name: SLIPS[i % SLIPS.length] }));
  const jump = {};
  for (const l of ls) jump[l.from] = l;
  for (const s of ss) jump[s.from] = s;
  // `kind` of each jump: ladder when it goes up, serpent when it goes down.
  return { kind, ladders: ls, snakes: ss, jump };
}
export const classicBoard = () => makeBoard(CLASSIC_LADDERS, CLASSIC_SNAKES, 'classic');

// ---- geometry of the numbering ---------------------------------------------------------------------
// col 0..9 left to right, row 0..9 bottom to top.
export function cellOf(n) {
  const row = Math.floor((n - 1) / 10), k = (n - 1) % 10;
  return { col: row % 2 === 0 ? k : 9 - k, row };
}
export function squareOf(col, row) { return row * 10 + (row % 2 === 0 ? col : 9 - col) + 1; }

// ---- seeded rng for daily / generated boards (deterministic, no Math.random) -------------------------
export function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), range: (a, b) => a + next() * (b - a) };
}

// ---- one move ----------------------------------------------------------------------------------------
// Where does a pawn on `pos` end up after moving `roll`? Pure; occupancy/bump is handled in applyMove.
export function resolveMove(board, opts, pos, roll) {
  let land = pos + roll;
  if (land > FINISH) {
    if (opts.exact) return { from: pos, roll, land: pos, to: pos, jump: null, over: true, win: false };
    land = FINISH;
  }
  const j = land < FINISH ? board.jump[land] : null;
  const to = j ? j.to : land;
  return { from: pos, roll, land, to, jump: j ? { kind: j.to > j.from ? 'ladder' : 'snake', name: j.name, from: j.from, to: j.to } : null, over: false, win: to === FINISH };
}

// ---- expected turns to finish (used by the AI and by the hint) ------------------------------------------
const evCache = new Map();
const optsKey = (o) => `${o.dice}|${o.exact ? 1 : 0}|${o.sixAgain ? 1 : 0}`;
export function boardKey(board) { return board.ladders.map((l) => l.from + '-' + l.to).join(',') + ';' + board.snakes.map((l) => l.from + '-' + l.to).join(','); }
export function expectedTurns(board, opts) {
  const key = boardKey(board) + '#' + optsKey(opts);
  if (evCache.has(key)) return evCache.get(key);
  const E = new Array(FINISH + 1).fill(0);
  const nxt = (p, d) => resolveMove(board, opts, p, d).to;
  const cost = (d) => (opts.sixAgain && d === 6 ? 0 : 1);
  for (let it = 0; it < 400; it++) {
    let delta = 0;
    for (let p = 0; p < FINISH; p++) {
      let v = 0;
      if (opts.dice === 'two') {
        for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) v += Math.min(cost(a) + E[nxt(p, a)], cost(b) + E[nxt(p, b)]);
        v /= 36;
      } else {
        for (let d = 1; d <= 6; d++) v += cost(d) + E[nxt(p, d)];
        v /= 6;
      }
      delta = Math.max(delta, Math.abs(v - E[p])); E[p] = v;
    }
    if (delta < 1e-5) break;
  }
  if (evCache.size > 24) evCache.clear();
  evCache.set(key, E);
  return E;
}

// ---- generated boards ---------------------------------------------------------------------------------
// A fresh board must be fair: drawn at random, then kept only if the simulated expected game length falls in
// a sensible band and no serpent undoes a ladder end-to-end.
export function generateBoard(rng, kind = 'fresh') {
  for (let attempt = 0; attempt < 400; attempt++) {
    const used = new Set([100]);
    const take = (n) => { if (used.has(n)) return false; used.add(n); return true; };
    const ladders = [], snakes = [];
    const nl = 8 + rng.int(2), ns = 8 + rng.int(2);
    let guard = 0;
    while (ladders.length < nl && guard++ < 400) {
      const a = 1 + rng.int(90), len = 8 + rng.int(38), b = a + len;
      if (b > 99 || used.has(a) || used.has(b)) continue;
      take(a); take(b); ladders.push([a, b]);
    }
    guard = 0;
    while (snakes.length < ns && guard++ < 400) {
      const a = 12 + rng.int(87), len = 8 + rng.int(58), b = a - len;
      if (b < 2 || a > 99 || used.has(a) || used.has(b)) continue;
      take(a); take(b); snakes.push([a, b]);
    }
    if (ladders.length < nl || snakes.length < ns) continue;
    const board = makeBoard(ladders, snakes, kind);
    const e = expectedTurns(board, { ...DEFAULT_OPTS })[0];
    if (e >= 22 && e <= 40) return board;
  }
  return classicBoard();
}

// ---- a game ---------------------------------------------------------------------------------------------
export const COLORS = ['#c9372c', '#1f8f8b', '#e3a421', '#7a47a8'];
export const COLOR_NAMES = ['Ruby', 'Teal', 'Amber', 'Plum'];
export const AI_NAMES = ['Asha', 'Ravi', 'Meera'];

// cfg: { players: 2..4, vsComputers: bool, level: 1..3, board, opts }
export function newGame(cfg) {
  const n = Math.max(2, Math.min(4, cfg.players));
  const players = [];
  for (let i = 0; i < n; i++) {
    const ai = cfg.allAi ? true : cfg.vsComputers ? i > 0 : false;
    const name = ai ? AI_NAMES[(i - (cfg.allAi ? 0 : 1) + 3) % 3] : cfg.vsComputers ? 'You' : `Player ${i + 1}`;
    players.push({ pos: 0, ai, name, color: i, level: cfg.level ?? 2 });
  }
  return { board: cfg.board, opts: { ...DEFAULT_OPTS, ...cfg.opts }, players, turn: 0, sixes: 0, moves: 0, winner: -1, order: [] };
}

// All the ways the current player may use `values` (1 value in one-die mode, 2 in pick-of-two mode).
export function optionsFor(g, values) {
  const p = g.players[g.turn];
  return values.map((v, die) => ({ die, value: v, res: resolveMove(g.board, g.opts, p.pos, v) }));
}

// Apply one chosen option. Returns what happened so the view can animate it.
export function applyMove(g, opt) {
  const p = g.players[g.turn], res = opt.res;
  const ev = { player: g.turn, res, bumped: null, extra: false, win: false };
  p.pos = res.to; g.moves++;
  if (g.opts.bump && res.to > 0 && res.to < FINISH && !res.over) {
    for (let i = 0; i < g.players.length; i++) {
      if (i === g.turn) continue;
      const q = g.players[i];
      if (q.pos === res.to) { const back = Math.max(0, q.pos - BUMP_BACK); ev.bumped = { player: i, from: q.pos, to: back }; q.pos = back; break; }
    }
  }
  if (res.win) { ev.win = true; g.winner = g.turn; if (!g.order.includes(g.turn)) g.order.push(g.turn); return ev; }
  if (g.opts.sixAgain && opt.value === 6 && g.sixes < MAX_SIXES - 1 && !res.over) { g.sixes++; ev.extra = true; return ev; }
  g.sixes = 0; g.turn = (g.turn + 1) % g.players.length;
  return ev;
}

// ---- the AI --------------------------------------------------------------------------------------------------
// Lower score is better (expected turns still needed). A bump earns a bonus: the opponent loses ground.
export function scoreOption(g, opt) {
  const E = expectedTurns(g.board, g.opts);
  const res = opt.res;
  const cost = g.opts.sixAgain && opt.value === 6 ? 0 : 1;
  let s = cost + E[res.to];
  if (g.opts.bump && !res.over && res.to > 0 && res.to < FINISH) {
    for (let i = 0; i < g.players.length; i++) {
      if (i !== g.turn && g.players[i].pos === res.to) s -= Math.max(0, E[Math.max(0, res.to - BUMP_BACK)] - E[res.to]) * 0.6;
    }
  }
  return s;
}
// level 1 Easy, 2 Steady, 3 Sharp. Returns the chosen option.
export function aiPick(g, options, rng) {
  if (options.length === 1) return options[0];
  const level = g.players[g.turn].level;
  if (level === 1 && rng.chance(0.4)) return rng.pick(options);
  const scored = options.map((o) => ({ o, s: scoreOption(g, o) }));
  scored.sort((a, b) => a.s - b.s);
  // Steady is a touch fallible when the two choices are close; Sharp always takes the best.
  if (level === 2 && scored[1].s - scored[0].s < 0.6 && rng.chance(0.2)) return scored[1].o;
  return scored[0].o;
}

// A short, kind sentence explaining a choice or a roll. Used by Hint and by Watch & Learn.
export function describeOption(g, opt) {
  const r = opt.res;
  if (r.over) return `${opt.value}: too many to finish, you would stay on ${r.from}.`;
  if (r.jump) return r.jump.kind === 'ladder' ? `${opt.value}: lands on ${r.land}, ${r.jump.name} lifts you to ${r.to}.` : `${opt.value}: lands on ${r.land}, ${r.jump.name} slides you down to ${r.to}.`;
  if (r.win) return `${opt.value}: reaches ${FINISH}, you win.`;
  return `${opt.value}: lands on ${r.to}.`;
}
export function bestOption(g, options) {
  return options.slice().sort((a, b) => scoreOption(g, a) - scoreOption(g, b))[0];
}
// What lies ahead of a pawn on one die? Counts of lucky and unlucky faces, for the classic-mode hint.
export function lookAhead(g, pos) {
  const out = [];
  for (let d = 1; d <= 6; d++) out.push(resolveMove(g.board, g.opts, pos, d));
  return out;
}
