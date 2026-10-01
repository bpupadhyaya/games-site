// THE RULE BOOK for the three Greek tables games: Portes, Plakoto and Fevga. Pure and deterministic; nothing here draws or rolls dice.
//
// One board, 24 points, indexed 0..23 (index = point number - 1). board[i] > 0 = that many side-0 checkers on top of the point,
// < 0 = side-1 checkers. Side 0 is the player at the bottom of the screen; its home is points 1-6.
//
// Every checker has a "distance from off" (dist 1 = the last point before bearing off, dist 24 = the starting point). A side's
// path is a line from dist 24 down to dist 1; idxAt()/distAt() translate between a side's distance and the physical point.
//   Portes + Plakoto: side 0 travels 24 -> 1 (home 1-6); side 1 travels 1 -> 24 (home 19-24).
//   Fevga:            both sides travel the same way round the board. Side 0 starts on point 24, side 1 on point 12
//                     (and finishes in points 13-18).
//
// The three games (all share the dice, the "play as many dice as you can" rule and bearing off):
//   PORTES   : standard backgammon. Lone checkers can be hit and wait on the bar.
//   PLAKOTO  : no hitting. A lone checker can be PINNED: the opponent lands on it and it cannot move until that opponent leaves.
//   FEVGA    : no hitting at all; a point held by anyone is closed. One checker may leave the head per turn, and six points in a
//              row (a wall) may not be built unless an opposing checker has already got past it.
//
// A step is { from, to, die, hit, pin } with from = BAR when entering (Portes) and to = OFF when bearing off.
export const PORTES = 0, PLAKOTO = 1, FEVGA = 2;
export const BAR = 24, OFF = 25;
export const VARIANTS = [
  { id: 'portes', name: 'Portes', blurb: 'Hit lone checkers and send them to the bar.' },
  { id: 'plakoto', name: 'Plakoto', blurb: 'Pin lone checkers under your own.' },
  { id: 'fevga', name: 'Fevga', blurb: 'Never hit; build walls and run.' },
];
export const MATCH_ORDER = [PORTES, PLAKOTO, FEVGA];

// side's distance <-> physical index
export const idxAt = (v, side, dist) => (side === 0 ? dist - 1 : v === FEVGA ? (dist + 11) % 24 : 24 - dist);
export const distAt = (v, side, i) => (side === 0 ? i + 1 : v === FEVGA ? (((i - 11) % 24) + 24) % 24 || 24 : 24 - i);

export function newGame(v = PORTES) {
  const board = new Array(24).fill(0), pin = new Array(24).fill(0);
  const put = (pt, n, side) => { board[pt - 1] += side === 0 ? n : -n; };
  if (v === PORTES) { put(24, 2, 0); put(13, 5, 0); put(8, 3, 0); put(6, 5, 0); put(1, 2, 1); put(12, 5, 1); put(17, 3, 1); put(19, 5, 1); }
  else if (v === PLAKOTO) { put(24, 15, 0); put(1, 15, 1); }
  else { put(24, 15, 0); put(12, 15, 1); }
  return { v, board, pin, bar: [0, 0], off: [0, 0], turn: 0, moves: 0, hd: 0, hl: 1, fresh: [true, true] };
}
export const clone = (s) => ({ ...s, board: s.board.slice(), pin: s.pin.slice(), bar: s.bar.slice(), off: s.off.slice(), fresh: s.fresh.slice() });
export const key = (s) => s.board.join(',') + '|' + s.pin.join('') + '|' + s.bar.join(',') + '|' + s.off.join(',') + '|' + s.hd;

// checkers of `side` on top of point i (the free ones: these are the ones that can move)
export const top = (s, side, i) => (side === 0 ? Math.max(s.board[i], 0) : Math.max(-s.board[i], 0));
// every checker of `side` on point i, including one pinned underneath (Plakoto)
export const mine = (s, side, i) => top(s, side, i) + (s.pin[i] === side + 1 ? 1 : 0);
// the stack height drawn on point i (top checkers + the pinned one)
export const height = (s, i) => Math.abs(s.board[i]) + (s.pin[i] ? 1 : 0);
export const distOf = (s, side, i) => distAt(s.v, side, i);
export function pips(s, side) {
  let p = s.bar[side] * 25;
  for (let i = 0; i < 24; i++) { const n = mine(s, side, i); if (n > 0) p += n * distAt(s.v, side, i); }
  return p;
}
export function allHome(s, side) {
  if (s.bar[side] > 0) return false;
  for (let i = 0; i < 24; i++) if (mine(s, side, i) > 0 && distAt(s.v, side, i) > 6) return false;
  return true;
}
export const isOver = (s) => s.off[0] === 15 || s.off[1] === 15;
export const winner = (s) => (s.off[0] === 15 ? 0 : s.off[1] === 15 ? 1 : -1);
// Plakoto can lock up when both sides have a checker pinned and everything else is home: no roll can move anything for either
// side. The game is then void (a draw) and replayed.
export function isDeadlocked(s) {
  if (s.v !== PLAKOTO || isOver(s)) return false;
  for (let side = 0; side < 2; side++) for (let d = 1; d <= 6; d++) if (stepsFor(s, side, d).length) return false;
  return true;
}
// 1 = a normal win, 2 = a "mars" (double win): the loser had not borne off a single checker
export const resultValue = (s, w) => (s.off[1 - w] > 0 ? 1 : 2);

// ---- Fevga: the six-point wall rule ------------------------------------------------------------------------------------------
// After `side` moves from -> to, would it hold a wall of 6+ points in a row along the opponent's path, with no opposing checker
// already past it?  (`from` is a physical index or BAR.)
function makesWall(s, side, from, to) {
  const o = 1 - side, v = s.v;
  const occ = new Array(25).fill(false);                     // indexed by the OPPONENT's distance 1..24
  for (let d = 1; d <= 24; d++) { const i = idxAt(v, o, d); occ[d] = top(s, side, i) > 0; }
  if (from !== BAR && top(s, side, from) === 1) occ[distAt(v, o, from)] = false;
  const td = distAt(v, o, to); occ[td] = true;
  let lo = td, hi = td;
  while (lo > 1 && occ[lo - 1]) lo--;
  while (hi < 24 && occ[hi + 1]) hi++;
  if (hi - lo + 1 < 6) return false;
  if (s.off[o] > 0) return false;
  for (let i = 0; i < 24; i++) if (top(s, o, i) > 0 && distAt(v, o, i) < lo) return false;     // an opposing checker is already past the wall
  return true;
}

// can `side` put a checker on point j? (hit / pin flags returned)
function landing(s, side, j) {
  const o = 1 - side, ot = top(s, o, j);
  if (s.v === PORTES) return ot <= 1 ? { ok: true, hit: ot === 1 } : { ok: false };
  if (s.v === PLAKOTO) {
    if (ot === 0) return { ok: true };
    if (ot === 1 && s.pin[j] === 0) return { ok: true, pin: true };
    return { ok: false };
  }
  return ot === 0 ? { ok: true } : { ok: false };
}

// every single-die step available right now (ignoring the "use both dice" rule)
export function stepsFor(s, side, die) {
  const out = [], v = s.v;
  if (v === PORTES && s.bar[side] > 0) {
    const to = idxAt(v, side, 25 - die), L = landing(s, side, to);
    if (L.ok) out.push({ from: BAR, to, die, hit: !!L.hit, pin: false });
    return out;
  }
  const home = allHome(s, side);
  for (let i = 0; i < 24; i++) {
    if (top(s, side, i) <= 0) continue;
    const d = distAt(v, side, i), nd = d - die;
    if (nd >= 1) {
      if (v === FEVGA && d === 24 && s.hd >= s.hl) continue;           // one checker per turn from the head
      const j = idxAt(v, side, nd), L = landing(s, side, j);
      if (!L.ok) continue;
      if (v === FEVGA && makesWall(s, side, i, j)) continue;
      out.push({ from: i, to: j, die, hit: !!L.hit, pin: !!L.pin });
    } else if (home) {
      if (nd === 0) out.push({ from: i, to: OFF, die, hit: false, pin: false });
      else {                                                             // a bigger die may bear off from the highest point only
        let higher = false;
        for (let k = 0; k < 24 && !higher; k++) if (mine(s, side, k) > 0 && distAt(v, side, k) > d) higher = true;
        if (!higher) out.push({ from: i, to: OFF, die, hit: false, pin: false });
      }
    }
  }
  return out;
}
export function applyStep(s, side, st) {
  const v = s.v, o = 1 - side, sg = side === 0 ? 1 : -1;
  if (st.from === BAR) s.bar[side] -= 1;
  else {
    if (v === FEVGA && distAt(v, side, st.from) === 24) s.hd += 1;
    s.board[st.from] -= sg;
    if (s.board[st.from] === 0 && s.pin[st.from]) {                      // the pinner leaves: the pinned checker is free again
      s.board[st.from] = s.pin[st.from] === 1 ? 1 : -1; s.pin[st.from] = 0;
    }
  }
  if (st.to === OFF) { s.off[side] += 1; return s; }
  if (st.hit) { s.board[st.to] = 0; s.bar[o] += 1; }
  else if (st.pin) { s.pin[st.to] = o + 1; s.board[st.to] = 0; }
  s.board[st.to] += sg;
  return s;
}
const without = (dice, d) => { const k = dice.indexOf(d); return dice.slice(0, k).concat(dice.slice(k + 1)); };

// the most dice that can be played from here (the "use as many dice as you can" rule)
export function maxPlay(s, side, dice, memo = new Map()) {
  if (!dice.length) return 0;
  const k = key(s) + '#' + side + dice.join('');
  const c = memo.get(k); if (c !== undefined) return c;
  let best = 0;
  for (const d of new Set(dice)) {
    const rest = without(dice, d);
    for (const st of stepsFor(s, side, d)) {
      const n = 1 + maxPlay(applyStep(clone(s), side, st), side, rest, memo);
      if (n > best) best = n;
      if (best === dice.length) { memo.set(k, best); return best; }
    }
  }
  memo.set(k, best); return best;
}

export const expandRoll = (r) => (r[0] === r[1] ? [r[0], r[0], r[0], r[0]] : r.slice());
// `dice` is the literal list of dice still to play (see expandRoll). Starts the turn: resets the Fevga head counter.
export function beginTurn(s, side, dice) {
  dice = dice.slice();
  s.hd = 0;
  s.hl = s.v === FEVGA && s.fresh[side] && dice.length === 4 && (dice[0] === 3 || dice[0] === 4) ? 2 : 1;
  const roll = dice, memo = new Map(), total = maxPlay(s, side, dice, memo);
  let mustHigh = 0;
  if (total === 1 && roll.length === 2 && roll[0] !== roll[1]) { const hi = Math.max(...roll); if (stepsFor(s, side, hi).length) mustHigh = hi; }
  return { dice, total, used: 0, mustHigh, memo };
}
// The steps that keep the turn legal (may start a full-length sequence).
export function legalSteps(s, side, turn) {
  const out = [];
  if (!turn.dice.length) return out;
  for (const d of new Set(turn.dice)) {
    if (turn.mustHigh && d !== turn.mustHigh) continue;
    const rest = without(turn.dice, d);
    for (const st of stepsFor(s, side, d)) {
      if (turn.used + 1 + maxPlay(applyStep(clone(s), side, st), side, rest, turn.memo) === turn.total) out.push(st);
    }
  }
  return out;
}
export function playStep(s, side, turn, st) {
  applyStep(s, side, st);
  turn.dice = without(turn.dice, st.die); turn.used += 1;
  s.moves += 1;
}
export const turnCopy = (t) => ({ dice: t.dice.slice(), total: t.total, used: t.used, mustHigh: t.mustHigh, memo: t.memo });
// The turn is over: this side has now played its first turn.
export function endTurn(s, side) { s.fresh[side] = false; s.hd = 0; }

// Every distinct way to finish the turn (for the computer and for puzzles): [{ steps, after }]
export function allTurns(s, side, dice, limit = 4000) {
  const base = clone(s), t0 = beginTurn(base, side, dice), seen = new Set(), out = [], done = new Set();
  const go = (st, turn, steps) => {
    if (out.length >= limit) return;
    const ls = legalSteps(st, side, turn);
    if (!ls.length) { const k = key(st); if (!done.has(k)) { done.add(k); const after = clone(st); endTurn(after, side); out.push({ steps, after }); } return; }
    const vk = key(st) + '#' + turn.dice.join('');
    if (seen.has(vk)) return; seen.add(vk);
    for (const step of ls) { const n = clone(st), tt = turnCopy(turn); playStep(n, side, tt, step); go(n, tt, steps.concat([step])); }
  };
  go(base, t0, []);
  return out;
}

// Plain-language reason a player's attempted move (from -> to) is not allowed.
export function whyNot(s, side, turn, from, to) {
  const v = s.v, pt = (i) => i + 1;
  if (!turn.dice.length) return 'You have no dice left to play.';
  if (v === PORTES && s.bar[side] > 0 && from !== BAR) return 'A checker of yours is on the bar. It must enter the board before anything else moves.';
  if (from === BAR && to === OFF) return 'Bar checkers must enter the board first.';
  if (to === OFF) {
    if (!allHome(s, side)) return 'You can bear off only when all 15 of your checkers are in your home board (points 1 to 6).';
    const d = distAt(v, side, from);
    if (!turn.dice.some((x) => x >= d)) return `Bearing off from point ${pt(from)} needs a ${d} or more. Your dice: ${turn.dice.join(' and ')}.`;
    return 'A bigger die may bear off only from your highest point. Play the checker on the highest point first.';
  }
  if (from !== BAR && top(s, side, from) <= 0) {
    if (v === PLAKOTO && s.pin[from] === side + 1) return 'That checker is pinned under an opposing checker. It cannot move until the opposing checker leaves.';
    return 'There is no checker of yours on that point.';
  }
  const dist = from === BAR ? 25 - distAt(v, side, to) : distAt(v, side, from) - distAt(v, side, to);
  if (from !== BAR && dist <= 0) return 'Checkers only move forward, toward your home board. Move the other way.';
  const o = 1 - side, ot = top(s, o, to);
  if (ot >= 1) {
    if (v === PORTES && ot >= 2) return `Point ${pt(to)} is held by two or more opposing checkers. A held point is blocked: you cannot land there.`;
    if (v === PLAKOTO && ot >= 2) return `Point ${pt(to)} is held by two or more opposing checkers. A held point is blocked: you cannot land there.`;
    if (v === PLAKOTO && s.pin[to] === side + 1) return `Point ${pt(to)} already has a checker of yours pinned under an opposing checker, so it is closed.`;
    if (v === FEVGA) return `Point ${pt(to)} is occupied by the opponent. In Fevga nothing is ever hit, so an occupied point is closed.`;
  }
  if (!turn.dice.includes(dist)) {
    const sum = turn.dice.length > 1 ? `Your dice are ${turn.dice.join(' and ')}. ` : `Your die is ${turn.dice[0]}. `;
    return `That point is ${dist} away. ${sum}A checker moves exactly the number on a die.`;
  }
  if (v === FEVGA && from !== BAR && distAt(v, side, from) === 24 && s.hd >= s.hl) return 'Only one checker may leave the head (the starting point) in a turn.';
  if (v === FEVGA && from !== BAR && makesWall(s, side, from, to)) return 'That would build a wall of six points in a row, which is not allowed until an opposing checker has already passed it.';
  const legalMax = legalSteps(s, side, turn);
  if (legalMax.length && !legalMax.some((x) => x.die === dist)) {
    if (turn.mustHigh) return `You may play only one die this turn and it must be the larger: the ${turn.mustHigh}.`;
    return 'You must play as many dice as you can. That move would leave the other die with no legal play.';
  }
  return 'That move is not allowed.';
}
