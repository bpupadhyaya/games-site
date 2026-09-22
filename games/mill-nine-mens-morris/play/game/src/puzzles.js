// The puzzle of the day: "Light (or Dark) to move: make a mill in N moves, whatever the enemy does."
// Every puzzle is PROVEN by exhaustive search and has exactly one correct first move (the enemy may not make a
// mill of their own first). Same puzzle for everyone on a given day: it grows from its own seeded random stream.
import { newGame, clone, legalMoves, applyMove, mvFrom, mvTo, mvTake, NONE, bit, pop, formsMill, MILLS, NAMES } from './rules.js';
import { createRng } from '../kit/rng.js';

// Can the side to move make a mill within n of its own moves, whatever the other side does? ctx = { nodes, limit }.
function wins(g, n, ctx) {
  if (++ctx.nodes > ctx.limit) throw ctx;
  const me = g.turn, ms = legalMoves(g, []), seen = new Set();
  for (const m of ms) if (mvTake(m) !== NONE) return true;
  if (n <= 1) return false;
  for (const m of ms) {
    const id = mvFrom(m) * 32 + mvTo(m); if (seen.has(id)) continue; seen.add(id);
    if (good(g, m, n, ctx)) return true;
  }
  return false;
}
function good(g, m, n, ctx) {                       // after non-mill move m, does every reply leave a mill within n-1?
  const me = g.turn, a = applyMove(clone(g), m);
  if (a.winner === me) return true; if (a.winner !== null) return false;
  for (const r of legalMoves(a, [])) {
    if (mvTake(r) !== NONE) return false;
    const b = applyMove(clone(a), r);
    if (b.winner !== null) return false;
    if (!wins(b, n - 1, ctx)) return false;
  }
  return true;
}
// Every first move (as from/to pairs, no take) that keeps the force alive. null = too hard to prove within the limit.
export function forcingMoves(g, n, limit = 30000) {
  const ctx = { nodes: 0, limit }, out = [], seen = new Set();
  try {
    for (const m of legalMoves(g, [])) {
      if (mvTake(m) !== NONE) { out.push(m); continue; }
      const id = mvFrom(m) * 32 + mvTo(m); if (seen.has(id)) continue; seen.add(id);
      if (n > 1 && good(g, m, n, ctx)) out.push(m);
    }
  } catch (e) { if (e !== ctx) throw e; return null; }
  return out;
}
export function puzzleGame(pz) {
  const g = newGame(); g.p = [pz.light.reduce((a, i) => a | bit(i), 0), pz.dark.reduce((a, i) => a | bit(i), 0)]; g.hand = [0, 0]; g.turn = pz.turn; return g;
}
export function puzzleText(pz) { return `${NAMES[pz.turn]} to move. Make a mill in ${pz.n} ${pz.n === 1 ? 'move' : 'moves'}, whatever ${NAMES[1 - pz.turn]} does.`; }

export function createPuzzleMaker(day) {
  const rng = createRng(0x51ed270b ^ (day * 2654435761 >>> 0)), dow = (((day % 7) + 11) % 7);   // 0 = Sunday-ish: any two days a week aim for 3 moves
  const want3 = dow === 0 || dow === 6;
  let tries = 0;
  return {
    get tries() { return tries; },
    step() {
      tries++;
      const n = want3 && tries < 400 ? 3 : 2;
      const a = 4 + rng.int(4), b = 4 + rng.int(4), pts = rng.shuffle(Array.from({ length: 24 }, (_, i) => i));
      const light = pts.slice(0, a), dark = pts.slice(a, a + b), turn = rng.int(2), pz = { light, dark, turn, n };
      const g = puzzleGame(pz);
      // no ready-made mills, and the mover must have room to move
      if (inMillsAny(g.p[0]) || inMillsAny(g.p[1])) return {};
      const easy = forcingMoves(g, n - 1, 6000);
      if (easy === null || easy.length) return {};                 // solvable faster: not a real N-move puzzle
      const sol = forcingMoves(g, n, n === 3 ? 26000 : 8000);
      if (!sol || sol.length !== 1) return {};
      pz.light.sort((x, y) => x - y); pz.dark.sort((x, y) => x - y);
      return { puzzle: pz };
    },
  };
}
const inMillsAny = (mask) => MILLS.some((L) => (mask & L) === L);
export const FALLBACK = { light: [1, 4, 10, 13, 18], dark: [0, 8, 12, 15, 21], turn: 0, n: 2 };
