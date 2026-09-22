// The mill family rule book. A "spec" describes one game of the family (points, lines, mills, cows, flying, ...) and
// createMillRules(spec) returns the whole rule book for it. Morabaraba is one spec (morabaraba.js); a Nine Men's Morris
// spec could reuse everything here and the bitboard engine (engine.js) unchanged. Pure and deterministic.
//
// spec = { name, n (points), adj: number[][], mills: number[][] (triples), cows, flyAt, minCows,
//          fullBoard: 'draw', drawPlies (moving plies without a shot = draw), repeats (same position this many times = draw) }
// Sides are 1 (dark, moves first) and 2 (light). board[i] is 0, 1 or 2.
// A full move is { type: 'place'|'move'|'fly', from (-1 when placing), to, take (-1 when nothing is shot) }.

export function createMillRules(spec) {
  const { n, adj, mills, cows } = spec;
  const millsOf = Array.from({ length: n }, () => []);
  mills.forEach((m, k) => m.forEach((p) => millsOf[p].push(k)));
  const other = (s) => 3 - s;
  const count = (g, s) => { let c = 0; for (let i = 0; i < n; i++) if (g.board[i] === s) c++; return c; };
  const total = (g, s) => g.hand[s] + count(g, s);

  const newGame = () => ({ board: new Array(n).fill(0), hand: [0, cows, cows], turn: 1, moves: 0, sinceShot: 0, winner: null, reason: '', seen: {}, shots: [0, 0, 0] });
  const clone = (g) => ({ ...g, board: g.board.slice(), hand: g.hand.slice(), seen: { ...g.seen }, shots: g.shots.slice() });
  const key = (g) => g.board.join('') + g.turn + g.hand[1] + '.' + g.hand[2];

  // 'place' while cows are in hand, 'fly' with exactly flyAt cows left and none in hand, else 'move'.
  const phase = (g, s) => (g.hand[s] > 0 ? 'place' : count(g, s) === spec.flyAt ? 'fly' : 'move');

  const inMillAt = (board, p, s) => { for (const k of millsOf[p]) { const m = mills[k]; if (board[m[0]] === s && board[m[1]] === s && board[m[2]] === s) return true; } return false; };
  // every mill (as index) currently held by side s
  const heldMills = (board, s) => { const out = []; mills.forEach((m, k) => { if (board[m[0]] === s && board[m[1]] === s && board[m[2]] === s) out.push(k); }); return out; };

  // Cows of side s that may be shot: those not in a mill, or all of them when every one stands in a mill.
  function shootable(g, s, board = g.board) {
    const all = [], free = [];
    for (let i = 0; i < n; i++) if (board[i] === s) { all.push(i); if (!inMillAt(board, i, s)) free.push(i); }
    return free.length ? free : all;
  }

  function basicMoves(g, s = g.turn) {
    const out = [], ph = phase(g, s);
    if (ph === 'place') { for (let i = 0; i < n; i++) if (!g.board[i]) out.push({ type: 'place', from: -1, to: i }); return out; }
    for (let i = 0; i < n; i++) {
      if (g.board[i] !== s) continue;
      if (ph === 'fly') { for (let j = 0; j < n; j++) if (!g.board[j]) out.push({ type: 'fly', from: i, to: j }); }
      else for (const j of adj[i]) if (!g.board[j]) out.push({ type: 'move', from: i, to: j });
    }
    return out;
  }
  // Would this basic move close a mill for the mover?
  function makesMill(g, m) {
    const s = g.turn, b = g.board.slice();
    if (m.from >= 0) b[m.from] = 0;
    b[m.to] = s;
    return inMillAt(b, m.to, s);
  }
  function legalMoves(g) {
    const out = [];
    for (const m of basicMoves(g)) {
      if (!makesMill(g, m)) { out.push({ ...m, take: -1 }); continue; }
      const b = g.board.slice(); if (m.from >= 0) b[m.from] = 0; b[m.to] = g.turn;
      for (const t of shootable(g, other(g.turn), b)) out.push({ ...m, take: t });
    }
    return out;
  }

  const sameMove = (a, b) => a.type === b.type && a.to === b.to && a.from === b.from && a.take === b.take;

  // Applies a full move (trusted: it must come from legalMoves). Sets winner/reason when the game ends.
  function apply(g, m) {
    const s = g.turn, o = other(s);
    if (m.type === 'place') g.hand[s] -= 1; else g.board[m.from] = 0;
    g.board[m.to] = s;
    g.moves += 1;
    const movingPhase = g.hand[1] === 0 && g.hand[2] === 0;
    if (m.take >= 0) { g.board[m.take] = 0; g.shots[s] += 1; g.sinceShot = 0; } else if (movingPhase) g.sinceShot += 1;
    g.turn = o;
    const name = (x) => (x === 1 ? 'Dark' : 'Light');
    if (total(g, o) < spec.minCows) { g.winner = s; g.reason = `${name(o)} has fewer than ${spec.minCows} cows left.`; return g; }
    if (g.hand[1] === 0 && g.hand[2] === 0 && g.board.every((c) => c)) { g.winner = 'draw'; g.reason = 'The board is full and no cow can move.'; return g; }
    if (basicMoves(g).length === 0) { g.winner = s; g.reason = `${name(o)} cannot move a cow.`; return g; }
    if (g.hand[1] === 0 && g.hand[2] === 0) {
      const k = key(g); g.seen[k] = (g.seen[k] || 0) + 1;
      if (g.seen[k] >= spec.repeats) { g.winner = 'draw'; g.reason = 'The same position came up three times.'; return g; }
      if (g.sinceShot >= spec.drawPlies) { g.winner = 'draw'; g.reason = `${spec.drawPlies} moves passed without a shot.`; return g; }
    }
    return g;
  }

  // ---- explanations for a human tap that is not a legal move ----
  const cnt = (k) => (k === 1 ? '1 cow' : `${k} cows`);
  function whyNotPlace(g, to) {
    if (g.board[to]) return 'That point is taken. Tap an empty point.';
    return '';
  }
  function whyNotMove(g, from, to) {
    const s = g.turn, ph = phase(g, s);
    if (ph === 'place') return `You still have ${cnt(g.hand[s])} to place. Cows only slide once every cow is placed.`;
    if (g.board[from] !== s) return 'That is not one of your cows.';
    if (g.board[to] === s) return 'That point already holds one of your cows.';
    if (g.board[to]) return 'That point is taken by the other side.';
    if (ph !== 'fly' && !adj[from].includes(to)) return `Cows slide one step along a line. That point is not next to this cow.${count(g, s) > spec.flyAt ? ` You may fly a cow anywhere only when you are down to ${spec.flyAt}.` : ''}`;
    return 'That move is not allowed.';
  }
  function whyNotTake(g, p) {
    const o = other(g.turn);
    if (g.board[p] === 0) return 'Tap one of the glowing cows to shoot it.';
    if (g.board[p] === g.turn) return 'That is your own cow. Tap a glowing cow of the other side.';
    if (inMillAt(g.board, p, o)) return 'That cow stands in a mill, so it is protected. Shoot a cow that is not in a mill.';
    return 'Tap one of the glowing cows.';
  }
  const canMoveFrom = (g, from) => basicMoves(g).filter((m) => m.from === from);

  return { spec, n, adj, mills, millsOf, other, count, total, newGame, clone, key, phase, inMillAt, heldMills, shootable, basicMoves, makesMill, legalMoves, apply, sameMove, whyNotPlace, whyNotMove, whyNotTake, canMoveFrom };
}
