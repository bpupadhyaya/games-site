// The turn loop as pure functions, shared by the game (one step at a time, with animation) and by tests
// (whole hands at once). Nothing here draws.
import { drawTile, discard, claim, passAll, declareWin, selfWin, makeKong, hasClaim } from './rules.js';
import { chooseDiscard, chooseClaim, chooseKong } from './ai.js';

// Priority: win > pung/kong > chow. Among several wins, the seat nearest after the discarder. `choices[q]` = {type,pair}|null.
export function settleClaims(s, from, choices) {
  const order = [1, 2, 3].map((d) => (from + d) % 4);
  for (const q of order) if (choices[q] && choices[q].type === 'win') return { q, ...choices[q] };
  for (const q of order) if (choices[q] && (choices[q].type === 'pung' || choices[q].type === 'kong')) return { q, ...choices[q] };
  for (const q of order) if (choices[q] && choices[q].type === 'chow') return { q, ...choices[q] };
  return null;
}

export function applyClaim(s, c) {
  if (c.type === 'win') return declareWin(s, c.q, 'discard');
  return claim(s, c.q, c.type, c.pair);
}

// The computer's turn after its draw: win, kong or discard. Returns { kind: 'win'|'kong'|'discard', ... }.
export function aiTurn(s, p, level, rng) {
  const w = selfWin(s, p);
  if (w && w.fan >= s.minFan) return { kind: 'win' };
  const kg = chooseKong(s, p, level);
  if (kg) return { kind: 'kong', kong: kg };
  const d = chooseDiscard(s, p, level, rng);
  return { kind: 'discard', tile: d.tile, note: d.note };
}

// Play one whole hand with computer players at `levels[p]` (seat 0 too). Returns the final rules state.
export function autoplay(s, levels, rng) {
  for (let guard = 0; guard < 2000 && s.phase !== 'over'; guard++) {
    if (s.phase === 'turn') { if (drawTile(s).ended) break; continue; }
    if (s.phase === 'discard') {
      const p = s.turn, a = aiTurn(s, p, levels[p], rng);
      if (a.kind === 'win') { declareWin(s, p, 'self'); break; }
      if (a.kind === 'kong') { if (makeKong(s, p, a.kong).ended) break; continue; }
      const opts = discard(s, a.tile), from = p, choices = [null, null, null, null];
      for (let q = 0; q < 4; q++) if (q !== from && hasClaim(opts[q])) choices[q] = chooseClaim(s, q, opts[q], levels[q], rng);
      const win = settleClaims(s, from, choices);
      if (win) { if (applyClaim(s, win)?.ended) break; } else passAll(s);
    }
  }
  return s;
}
