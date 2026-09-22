// THE RULE BOOK for Yut Nori. Pure and deterministic; nothing here draws or reads time.
// Board: outer ring 0..19 (0 = start/finish corner), diagonal A 5-20-21-22-23-24-15, diagonal B 10-25-26-22-27-28-home.
// Teams are 0 (the player's blue) and 1 (red). A team's tokens are: `wait` (off the board), `home`, and stacks
// g[team] = [{ pos, n, prev }]: n tokens standing together on point `pos`; `prev` is where they came from (for back-do).
export const HOME = 100;
export const NAMES = { '-1': 'Back-do', 1: 'Do', 2: 'Gae', 3: 'Geol', 4: 'Yut', 5: 'Mo' };
export const ANIMALS = { '-1': 'one step back', 1: 'the pig', 2: 'the dog', 3: 'the sheep', 4: 'the cow', 5: 'the horse' };
export const STEPS_TEXT = { '-1': '1 back', 1: '1 step', 2: '2 steps', 3: '3 steps', 4: '4 steps', 5: '5 steps' };
export const PROB = { '-1': 1 / 16, 1: 3 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 5: 1 / 16 };
export const THROW_VALUES = [-1, 1, 2, 3, 4, 5];
export const CORNERS = [0, 5, 10, 15];

export function newGame(first = 0) {
  return { turn: first, phase: 'throw', pending: [], owed: 0, winner: -1, wait: [4, 4], home: [0, 0], g: [[], []], moves: 0, throws: 0 };
}
export const clone = (s) => JSON.parse(JSON.stringify(s));

// One throw of the four sticks: flat[i] true = flat side up. Stick 0 carries the back-do mark.
export function throwSticks(rng) {
  const flat = [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)];
  return { flat, v: valueOf(flat) };
}
export function valueOf(flat) {
  const n = flat.filter(Boolean).length;
  if (n === 0) return 5;
  if (n === 1) return flat[0] ? -1 : 1;
  return n;
}
// The sticks that show a given result (used by lessons that force a throw)
export function sticksFor(v, rng) {
  if (v === 5) return [false, false, false, false];
  if (v === 4) return [true, true, true, true];
  if (v === -1) return [true, false, false, false];
  const n = v, idx = [0, 1, 2, 3], flat = [false, false, false, false];
  const order = rng.shuffle(v === 1 ? [1, 2, 3] : idx);
  for (let i = 0; i < n; i++) flat[order[i]] = true;
  return flat;
}

// ---- the track ------------------------------------------------------------------------------------------
function step(pos, lane) {
  if (pos === 22) return lane === 'A' ? [23, 'A'] : [27, 'B'];
  if (pos === 20) return [21, 'A'];
  if (pos === 21) return [22, 'A'];
  if (pos === 23) return [24, 'A'];
  if (pos === 24) return [15, 'R'];
  if (pos === 25) return [26, 'B'];
  if (pos === 26) return [22, 'B'];
  if (pos === 27) return [28, 'B'];
  if (pos === 28) return [HOME, 'B'];
  if (pos === 19) return [HOME, 'R'];
  return [pos + 1, 'R'];
}
function firstOptions(pos) {
  if (pos === -1) return [[1, 'R']];
  if (pos === 5) return [[6, 'R'], [20, 'A']];
  if (pos === 10) return [[11, 'R'], [25, 'B']];
  if (pos === 22) return [[27, 'B']];
  return [step(pos, 'R')];
}
const DEF_PREV = { 20: 5, 21: 20, 22: 21, 23: 22, 24: 23, 25: 10, 26: 25, 27: 22, 28: 27 };
const defPrev = (p) => (p === 1 ? -1 : DEF_PREV[p] ?? p - 1);

// Every legal move of `team` for throw value v. A move: { from (-1 = a waiting token), v, to (point | HOME | 'wait'),
// path (points visited), short (took a diagonal), back }
export function movesFor(s, team, v) {
  const out = [];
  if (v === -1) {
    for (const grp of s.g[team]) {
      const to = grp.prev === -1 ? 'wait' : grp.prev;
      out.push({ from: grp.pos, v, to, path: [to === 'wait' ? -1 : to], short: false, back: true });
    }
    return out;
  }
  const starts = [];
  if (s.wait[team] > 0) starts.push(-1);
  for (const grp of s.g[team]) starts.push(grp.pos);
  for (const from of starts) {
    for (const [p0, l0] of firstOptions(from)) {
      const path = [p0]; let p = p0, l = l0;
      for (let k = 1; k < v && p !== HOME; k++) { [p, l] = step(p, l); path.push(p); }
      out.push({ from, v, to: p, path, short: (from === 5 && p0 === 20) || (from === 10 && p0 === 25), back: false });
    }
  }
  return out;
}
export const moveKey = (m) => `${m.v}:${m.from}>${m.to}${m.short ? 's' : ''}`;

// Apply a move for the team whose turn it is. Mutates s and returns what happened.
export function applyMove(s, m) {
  const t = s.turn, o = 1 - t, info = { capture: 0, home: 0, stack: false, entered: m.from === -1, back: m.back, to: m.to };
  let n, prev;
  if (m.from === -1) { s.wait[t] -= 1; n = 1; }
  else { const i = s.g[t].findIndex((x) => x.pos === m.from); n = s.g[t][i].n; s.g[t].splice(i, 1); }
  info.n = n;
  prev = m.back ? (m.to === 'wait' ? -1 : defPrev(m.to)) : m.path.length > 1 ? m.path[m.path.length - 2] : m.from;
  if (m.to === 'wait') s.wait[t] += n;
  else if (m.to === HOME) { s.home[t] += n; info.home = n; if (s.home[t] >= 4) { s.winner = t; s.phase = 'over'; } }
  else {
    const ei = s.g[o].findIndex((x) => x.pos === m.to);
    if (ei >= 0) { info.capture = s.g[o][ei].n; s.wait[o] += info.capture; s.g[o].splice(ei, 1); s.owed += 1; }
    const own = s.g[t].find((x) => x.pos === m.to);
    if (own) { own.n += n; own.prev = prev; info.stack = true; info.n = own.n; } else s.g[t].push({ pos: m.to, n, prev });
  }
  const pi = s.pending.indexOf(m.v); if (pi >= 0) s.pending.splice(pi, 1);
  s.moves += 1;
  return info;
}

// The sticks have been thrown: record the throw. Yut and mo keep the turn in the throwing phase.
export function recordThrow(s, v) {
  s.pending.push(v); s.throws += 1;
  s.phase = v === 4 || v === 5 ? 'throw' : 'move';
  return settle(s);
}
export const canUse = (s) => s.pending.some((v) => movesFor(s, s.turn, v).length > 0);
// After a throw or a move: throws nobody can use are dropped, then the turn moves on if nothing is left.
// Returns { dropped: [values], ended: bool }
export function settle(s) {
  const res = { dropped: [], ended: false };
  if (s.winner >= 0) { s.phase = 'over'; s.pending = []; return res; }
  if (s.phase === 'throw') return res;
  if (s.pending.length && !canUse(s)) { res.dropped = s.pending.slice(); s.pending = []; }
  if (s.pending.length) { s.phase = 'move'; return res; }
  if (s.owed > 0) { s.owed -= 1; s.phase = 'throw'; return res; }
  s.turn = 1 - s.turn; s.phase = 'throw'; s.owed = 0; res.ended = true;
  return res;
}

// Why a throw / token / point cannot be used: plain language for the refusal message.
export function whyNot(s, from, v, to) {
  const t = s.turn, name = NAMES[v];
  if (from === -1 && s.wait[t] === 0) return 'You have no tokens waiting to enter.';
  if (v === -1) {
    if (from === -1) return 'Back-do moves a token already on the board one step back. Tokens that have not entered cannot use it.';
    return 'Back-do moves that stack exactly one step back, along the way it came.';
  }
  const ms = movesFor(s, t, v).filter((m) => m.from === from);
  if (!ms.length) return `${name} cannot move that token.`;
  const at = (p) => (p === HOME ? 'home' : `point ${p}`);
  const dests = ms.map((m) => at(m.to));
  return `${name} moves ${STEPS_TEXT[v]}: from there it lands on ${dests.join(' or ')}. Tap a glowing point.`;
}

// Progress of one token, 0 (waiting) .. 22 (home): used by the computer and by the daily challenge score.
const REM = { 5: 6, 10: 6, 20: 5, 21: 4, 22: 3, 23: 7, 24: 6, 25: 5, 26: 4, 27: 2, 28: 1 };
export const remaining = (p) => REM[p] ?? 20 - p;
export const progress = (p) => (p === HOME ? 22 : p === -1 ? 0 : 20 - remaining(p));
