// The rule book for Congklak (the Indonesian and Malay rules; Sungka is the Philippine cousin). Pure and deterministic.
//
// The board is a ring of 16 places. Places 0-6 are the player's seven houses (right-hand column on screen, bottom to top),
// place 15 is the player's own storehouse (bottom). Places 8-14 are the opponent's seven houses (left-hand column, top to
// bottom) and place 7 is the opponent's storehouse (top). Shells always travel 0 -> 1 -> ... -> 15 -> 0 (counter-clockwise),
// and a player's shells skip the OTHER player's storehouse. The house opposite house h is house 14 - h.
export const ROUNDS_OF = { single: 1, short: 3, full: 9 };
export const HOUSES = 7, PER_HOUSE = 7, TOTAL = 98, MAX_ROUNDS = 9, RELAY_LIMIT = 500;
export const STORE = [15, 7];
export const SEQ = [[0, 1, 2, 3, 4, 5, 6], [8, 9, 10, 11, 12, 13, 14]];       // each side's houses, nearest the own storehouse first is FILL_ORDER
export const FILL_ORDER = [[0, 1, 2, 3, 4, 5, 6], [8, 9, 10, 11, 12, 13, 14]];
export const sideOf = (pos) => (pos < 7 ? 0 : pos > 7 && pos < 15 ? 1 : -1);    // -1 = a storehouse
export const oppositeOf = (pos) => 14 - pos;
const NEXT = [0, 1].map((pl) => Array.from({ length: 16 }, (_, p) => { let q = (p + 1) % 16; if (q === STORE[1 - pl]) q = (q + 1) % 16; return q; }));

export function newGame(mode = 'full') {
  const b = new Array(16).fill(0);
  for (const h of [...SEQ[0], ...SEQ[1]]) b[h] = PER_HOUSE;
  return { b, burnt: new Array(16).fill(false), turn: 0, round: 1, mode, opening: true, phase: 'play', winner: null, moves: 0, extra: false, rounds: [], roundResult: null };
}
export const clone = (s) => ({ ...s, b: s.b.slice(), burnt: s.burnt.slice(), rounds: s.rounds.map((r) => ({ ...r })), roundResult: s.roundResult ? { ...s.roundResult } : null });
export const sideShells = (b, pl) => { let n = 0; for (const h of SEQ[pl]) n += b[h]; return n; };
export const openHouses = (s, pl) => SEQ[pl].filter((h) => !s.burnt[h]);
export const legalMoves = (s, pl = s.turn) => (s.phase !== 'play' ? [] : SEQ[pl].filter((h) => s.b[h] > 0 && !s.burnt[h]));

// ---- one player's sowing, one ACTION at a time (a lift or a single drop), so two hands can move side by side ------------
// A "machine" is one hand: { pos, hand, st: 'lift' | 'drop', end: null | 'store' | 'capture' | 'empty' | 'away' | 'limit' }.
export const machine = (start) => ({ pos: start, hand: 0, st: 'lift', end: null, steps: 0, gain: 0 });
export function step(s, pl, m, ev, beat) {
  const b = s.b;
  if (m.st === 'lift') { m.hand = b[m.pos]; b[m.pos] = 0;
    if (m.hand === 0) { m.end = 'empty'; return; }               // (opening only) the other hand captured this house meanwhile
    if (ev) ev.push({ b: beat, t: 'lift', p: pl, pos: m.pos, n: m.hand }); m.st = 'drop'; return; }
  let q = NEXT[pl][m.pos]; while (s.burnt[q]) q = NEXT[pl][q];
  m.pos = q; b[q]++; m.hand--; m.steps++;
  if (ev) ev.push({ b: beat, t: 'drop', p: pl, pos: q });
  if (m.hand > 0) return;
  if (q === STORE[pl]) { m.end = 'store'; return; }
  if (b[q] > 1) { if (m.steps > RELAY_LIMIT) m.end = 'limit'; else m.st = 'lift'; return; }              // the last shell fell in an occupied house: scoop it up and go on
  if (sideOf(q) === pl) {
    const o = oppositeOf(q);
    if (b[o] > 0) { const n = b[o] + 1; b[o] = 0; b[q] = 0; b[STORE[pl]] += n; m.gain = n; m.cap = { at: q, from: o, n }; if (ev) ev.push({ b: beat, t: 'cap', p: pl, pos: q, from: o, n }); m.end = 'capture'; }
    else m.end = 'empty';                                                                                // empty house of your own, nothing opposite: the shell stays
  } else m.end = 'away';                                                                                 // empty house on the other side: the shell stays, the turn ends
}

// Play the round-end and match logic after any move.
function afterMove(s) {
  if (s.phase !== 'play') return;
  if (sideShells(s.b, s.turn) === 0) finishRound(s);
}
function finishRound(s) {
  for (const pl of [0, 1]) for (const h of SEQ[pl]) { s.b[STORE[pl]] += s.b[h]; s.b[h] = 0; }
  const a = s.b[15], c = s.b[7];
  s.roundResult = { a, b: c, round: s.round };
  s.rounds.push({ a, b: c });
  const fill = (pl, st) => Math.min(openHouses(s, pl).length, Math.floor(st / PER_HOUSE));
  const cap = ROUNDS_OF[s.mode] ?? MAX_ROUNDS;
  if (fill(0, a) === 0 && fill(1, c) > 0) { s.phase = 'matchOver'; s.winner = 1; }          // out of houses: the match is lost
  else if (fill(1, c) === 0 && fill(0, a) > 0) { s.phase = 'matchOver'; s.winner = 0; }
  else if (s.round >= cap) {                                                              // the agreed number of rounds is played: most rounds won, then the last round
    const w0 = s.rounds.filter((r) => r.a > r.b).length, w1 = s.rounds.filter((r) => r.b > r.a).length;
    s.phase = 'matchOver'; s.winner = w0 > w1 ? 0 : w1 > w0 ? 1 : a > c ? 0 : a < c ? 1 : 'draw';
  }
  else s.phase = 'roundOver';
}
// Set up the next round: every player refills houses to seven, nearest the own storehouse first; houses that cannot be
// filled are burnt shut for the rest of the match. Shells that do not fill a house stay in the storehouse.
export function nextRound(s) {
  if (s.phase !== 'roundOver') return s;
  const burnt = [];
  for (const pl of [0, 1]) {
    let st = s.b[STORE[pl]]; const open = openHouses(s, pl); let f = Math.min(open.length, Math.floor(st / PER_HOUSE));
    for (const h of FILL_ORDER[pl]) { if (s.burnt[h]) continue; if (f > 0) { s.b[h] = PER_HOUSE; st -= PER_HOUSE; f--; } else { s.burnt[h] = true; burnt.push(h); } }
    s.b[STORE[pl]] = st;
  }
  s.round += 1; s.phase = 'play'; s.opening = true; s.turn = 0; s.extra = false; s.roundResult = null;
  return burnt;
}

// ---- the opening: both players choose a house and sow AT THE SAME TIME, one action each per beat --------------------
export function applyOpening(s, m0, m1) {
  const ev = [], M = [machine(m0), machine(m1)], done = [-1, -1];
  let beat = 0;
  while (M[0].end === null || M[1].end === null) {
    for (const pl of [0, 1]) if (M[pl].end === null) { step(s, pl, M[pl], ev, beat); if (M[pl].end !== null) done[pl] = beat; }
    beat++;
    if (beat > 2000) break;
  }
  const first = done[0] <= done[1] ? 0 : 1;              // whoever finished first plays next (the human on a tie)
  s.opening = false; s.turn = first; s.extra = false; s.moves += 1;
  const r = { opening: true, ev, ends: [M[0].end, M[1].end], gains: [M[0].gain, M[1].gain], first, beats: beat };
  afterMove(s);
  return r;
}

// ---- an ordinary move: pick one of your own houses and sow it, through every relay, to the end -----------------------
export function tryMove(s, house) {
  if (s.phase !== 'play') return { error: 'The round is over.' };
  if (s.opening) return { error: 'Both players choose a first house at the same time.' };
  if (sideOf(house) !== s.turn) return { error: 'That is your opponent’s house. TAP one of your own.' };
  if (s.burnt[house]) return { error: 'That house is burnt shut for this match. It cannot be used.' };
  if (s.b[house] === 0) return { error: 'That house is empty. There is nothing to sow. TAP a house that has shells.' };
  return { ok: true };
}
export function applyMove(s, house, wantEvents = true) {
  const pl = s.turn, ev = wantEvents ? [] : null, m = machine(house), before = s.b[STORE[pl]], n0 = s.b[house];
  let beat = 0;
  while (m.end === null) { step(s, pl, m, ev, beat); beat++; }
  s.moves += 1;
  const extra = m.end === 'store';
  s.extra = extra;
  if (!extra) s.turn = 1 - pl;
  const r = { player: pl, house, n: n0, ev, end: m.end, drops: m.steps, gain: s.b[STORE[pl]] - before, cap: m.cap || null, extra };
  afterMove(s);
  return r;
}
export const outcomeOf = (s, house) => { const c = clone(s); return applyMove(c, house, false); };
