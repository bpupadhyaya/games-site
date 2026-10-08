// The bracket: eight batters, three rounds. The player is batter 0. Other matches are played out by the same engine (simulateRound).
import { FIELD, YOU, LEVELS, lerp } from './core.js';
import { simulateRound } from './engine.js';

export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];

const better = (a, b) => (a.score !== b.score ? a.score - b.score : a.totalDist !== b.totalDist ? a.totalDist - b.totalDist : 0);

export function newBracket(R, level, park) {
  const opp = R.p.shuffle(FIELD).slice(0, 7);
  const players = [YOU, ...opp];
  const b = { level, park, players, rd: 0, mi: 0, over: false, champion: false, rounds: [], youOut: false };
  b.rounds.push(pairings([0, 1, 2, 3, 4, 5, 6, 7]));
  return b;
}
const pairings = (ids) => { const m = []; for (let i = 0; i < ids.length; i += 2) m.push({ a: ids[i], b: ids[i + 1], sa: null, sb: null, winner: null, swingoff: false }); return m; };

export const skillFor = (b, p, rd) => LEVELS[b.level].skill * lerp(0.86, 1.04, rd / 2);

function playOne(R, b, id, rd, swingOff) {
  const batter = b.players[id];
  return simulateRound({ level: b.level, round: rd, park: b.park, batter, swingOff, skill: skillFor(b, batter, rd), mode: 'bracket' }, { p: R.p.fork(), h: R.h.fork(), a: R.a.fork() });
}

/** Resolve a match between two simulated batters (swing-off if tied, coin flip by seed order as the last resort). */
function simMatch(R, b, m, rd) {
  m.sa = playOne(R, b, m.a, rd, false); m.sb = playOne(R, b, m.b, rd, false);
  if (better(m.sa, m.sb) === 0) {
    m.swingoff = true;
    const x = playOne(R, b, m.a, rd, true), y = playOne(R, b, m.b, rd, true);
    m.sa = { ...m.sa, so: x.score }; m.sb = { ...m.sb, so: y.score };
    m.winner = x.score !== y.score ? (x.score > y.score ? m.a : m.b) : (R.a.chance(0.5) ? m.a : m.b);
  } else m.winner = better(m.sa, m.sb) > 0 ? m.a : m.b;
}

export const youMatch = (b) => b.rounds[b.rd][0];
export const opponentOf = (b) => { const m = youMatch(b); return b.players[m.a === 0 ? m.b : m.a]; };

/** The player's round is done: simulate the opponent's round (and a swing-off request if tied). Returns { tie, opp }. */
export function settleYou(R, b, you) {
  const m = youMatch(b);
  const opp = playOne(R, b, m.b, b.rd, false);
  m.sa = you; m.sb = opp;
  const c = better(you, opp);
  if (c === 0) return { tie: true, opp };
  m.winner = c > 0 ? 0 : m.b;
  return { tie: false, opp };
}
export function settleSwingOff(R, b, youScore) {
  const m = youMatch(b);
  const opp = playOne(R, b, m.b, b.rd, true);
  m.swingoff = true; m.sa = { ...m.sa, so: youScore }; m.sb = { ...m.sb, so: opp.score };
  m.winner = youScore > opp.score ? 0 : youScore < opp.score ? m.b : (R.a.chance(0.5) ? 0 : m.b);
  return opp;
}

/** After the player's match is decided: play the other matches of this round and build the next. */
export function finishRound(R, b) {
  const rd = b.rd, ms = b.rounds[rd];
  for (let i = 1; i < ms.length; i++) simMatch(R, b, ms[i], rd);
  if (ms[0].winner !== 0) { b.over = true; b.youOut = true; b.outRound = rd; return b; }
  if (rd === 2) { b.over = true; b.champion = true; return b; }
  const next = ms.map((m) => m.winner);
  b.rounds.push(pairings(next));
  // keep the player first in the next round's list
  const idx = b.rounds[rd + 1].findIndex((m) => m.a === 0 || m.b === 0);
  if (idx > 0) { const t = b.rounds[rd + 1][0]; b.rounds[rd + 1][0] = b.rounds[rd + 1][idx]; b.rounds[rd + 1][idx] = t; }
  const mm = b.rounds[rd + 1][0]; if (mm.b === 0) { mm.b = mm.a; mm.a = 0; }
  b.rd = rd + 1;
  return b;
}
