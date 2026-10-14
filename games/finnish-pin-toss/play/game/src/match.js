// Match rules on top of the engine: scoring a throw, the 50 rule, misses and elimination, turn order. Pure data + small
// functions; game.js owns the state object and calls these.
//
//   points: nothing 0, one skittle its number, several skittles their count.
//   exactly the target (50, or 30 in a Short match) wins; over it, the score falls back to half the target (25 / 15).
//   three misses in a row eliminate a player; the last player left wins.
//   a marathon cap ends a match that goes on too long: highest score wins.
import { pointsOf } from './sim.js';

export const LENGTHS = { classic: { target: 50, back: 25, name: 'Classic' }, short: { target: 30, back: 15, name: 'Short' } };
export const MAX_MISSES = 3;
export const MAX_ROUNDS = 40;

// cfg: { target, players: [{ name, ai: profileIndex | -1 }], solo }
export function newMatch(cfg) {
  const n = cfg.players.length;
  return {
    cfg, target: cfg.target, back: Math.floor(cfg.target / 2), n,
    players: cfg.players.map((p, i) => ({ id: i, name: p.name, ai: p.ai ?? -1, score: 0, misses: 0, out: false, throws: 0, history: [], best: 0 })),
    turn: cfg.first ?? 0, round: 0, over: null,
  };
}

export const need = (m, p) => m.target - p.score;
export const aliveCount = (m) => m.players.filter((p) => !p.out).length;

// Score a throw for the player whose turn it is. knocked = the numbers that went down.
// Returns { kind, pts, before, after, dropped, win, out }.
export function applyThrow(m, knocked) {
  const p = m.players[m.turn];
  const pts = pointsOf(knocked), before = p.score;
  p.throws++;
  const res = { kind: 'miss', pts, before, after: before, dropped: false, win: false, out: false, count: knocked.length, num: knocked.length === 1 ? knocked[0] : 0 };
  if (knocked.length === 0) {
    p.misses++;
    if (p.misses >= MAX_MISSES) { p.out = true; res.out = true; }
    p.history.push({ t: 'miss', out: res.out });
    return res;
  }
  p.misses = 0;
  p.best = Math.max(p.best, knocked.length);
  let after = before + pts;
  res.kind = knocked.length === 1 ? 'single' : 'multi';
  if (after === m.target) { res.win = true; }
  else if (after > m.target) { res.dropped = true; after = m.back; }
  p.score = after; res.after = after;
  p.history.push({ t: res.kind, pts, count: knocked.length, num: res.num, before, after, dropped: res.dropped, win: res.win });
  if (res.win) m.over = { win: p.id, why: 'exact' };
  return res;
}

// Advance to the next player still in the match. Returns { kind: 'next' | 'over' }.
export function nextTurn(m) {
  if (m.over) return { kind: 'over' };
  if (m.n > 1 && aliveCount(m) === 1) { m.over = { win: m.players.find((p) => !p.out).id, why: 'last' }; return { kind: 'over' }; }
  if (m.n === 1 && m.players[0].out) { m.over = { win: -1, why: 'out' }; return { kind: 'over' }; }
  let i = m.turn;
  for (let k = 0; k < m.n; k++) {
    i = (i + 1) % m.n;
    if (i === 0) m.round++;
    if (!m.players[i].out) break;
  }
  m.turn = i;
  if (m.round >= MAX_ROUNDS) {
    let best = -1, bi = -1, tie = false;
    for (const p of m.players) if (!p.out) { if (p.score > best) { best = p.score; bi = p.id; tie = false; } else if (p.score === best) tie = true; }
    m.over = { win: tie ? -1 : bi, why: 'cap' };
    return { kind: 'over' };
  }
  return { kind: 'next' };
}

// A short line that teaches the 50 rule for the player about to throw.
export function adviceFor(m, p) {
  const r = m.target - p.score;
  if (p.misses === 2) return `Two misses in a row. One more and you are out.`;
  if (r <= 0) return '';
  if (r <= 12) return `Needs ${r} for exactly ${m.target}: knock the ${r} alone, or exactly ${r} skittles. More than ${r} drops you to ${m.back}.`;
  if (r <= 24) return `Needs ${r}. Stay below ${m.target}: going over drops you to ${m.back}.`;
  return `Needs ${r} to reach exactly ${m.target}.`;
}
