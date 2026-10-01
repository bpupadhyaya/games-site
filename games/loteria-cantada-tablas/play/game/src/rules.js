// The rules engine: pure data and functions, no drawing, no time. game.js owns state and calls these;
// the in-app Rules pages (content.js) read their numbers from the constants exported here.
import { DECK_SIZE } from './cards.js';

export const GRID = 4;
export const CELLS = GRID * GRID;        // 16 pictures on a tabla
export const POOL = 30;                  // cards in one round's deck, drawn from the 54
export const LOCKOUT_SECS = 5;           // after a false claim
export const SCORE = { bean: 5, wrong: -10, falseClaim: -30, win: 100, perCallSaved: 3 };
export const HINTS_PER_ROUND = 3;

// ---- win patterns ------------------------------------------------------------------------------------
const idx = (r, c) => r * GRID + c;
const rows = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => idx(r, c)));
const cols = [0, 1, 2, 3].map((c) => [0, 1, 2, 3].map((r) => idx(r, c)));
const diags = [[idx(0, 0), idx(1, 1), idx(2, 2), idx(3, 3)], [idx(0, 3), idx(1, 2), idx(2, 1), idx(3, 0)]];
export const PATTERNS = [
  { id: 'linea', es: 'Línea', en: 'Line', sets: [...rows, ...cols, ...diags], blurb: { en: 'Any row, column or diagonal of four.', es: 'Cualquier fila, columna o diagonal de cuatro.' } },
  { id: 'esquinas', es: 'Cuatro esquinas', en: 'Four corners', sets: [[idx(0, 0), idx(0, 3), idx(3, 0), idx(3, 3)]], blurb: { en: 'The four corner pictures.', es: 'Las cuatro imágenes de las esquinas.' } },
  { id: 'centro', es: 'Centro', en: 'Center', sets: [[idx(1, 1), idx(1, 2), idx(2, 1), idx(2, 2)]], blurb: { en: 'The four middle pictures.', es: 'Las cuatro imágenes del centro.' } },
  { id: 'marco', es: 'Marco', en: 'Frame', sets: [[0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]], blurb: { en: 'All twelve border pictures.', es: 'Las doce imágenes del borde.' } },
  { id: 'llena', es: 'Tabla llena', en: 'Full card', sets: [Array.from({ length: CELLS }, (_, i) => i)], blurb: { en: 'Every picture on the tabla.', es: 'Todas las imágenes de la tabla.' } },
  { id: 'sorpresa', es: 'Sorpresa', en: 'Surprise', sets: null, blurb: { en: 'A different pattern each round.', es: 'Un patrón distinto cada ronda.' } },
];
export const PATTERN_IDS = PATTERNS.map((p) => p.id);
export const CONCRETE = PATTERNS.filter((p) => p.sets);
export const patternOf = (id) => PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
export const setsOf = (id) => patternOf(id).sets ?? patternOf('linea').sets;

// ---- pace, skill, styles -------------------------------------------------------------------------------
// secs: seconds between calls; window: how many of the most recent calls can still be marked.
export const PACES = [
  { id: 'calm', es: 'Tranquilo', en: 'Calm', secs: 8, window: 4 },
  { id: 'fiesta', es: 'Fiesta', en: 'Fiesta', secs: 5.5, window: 3 },
  { id: 'rapido', es: 'Rápido', en: 'Rapid', secs: 3.6, window: 2 },
];
// How a computer player behaves: seconds to react to a call, chance to miss a card it could mark,
// seconds to shout after completing its pattern.
export const SKILLS = [
  { id: 'novice', es: 'Novato', en: 'Novice', react: [1.6, 4.4], miss: 0.12, claim: [1.6, 3.6] },
  { id: 'normal', es: 'Normal', en: 'Normal', react: [1.0, 3.2], miss: 0.07, claim: [1.0, 2.6] },
  { id: 'sharp', es: 'Ojo de águila', en: 'Eagle eye', react: [0.7, 2.2], miss: 0.04, claim: [0.6, 1.8] },
];
export const STYLES = [
  { id: 'easy', es: 'Fácil', en: 'Easy', sub: { en: 'Name shown with the riddle', es: 'Nombre junto a la adivinanza' } },
  { id: 'classic', es: 'Clásico', en: 'Classic', sub: { en: 'Name appears after a few seconds', es: 'El nombre aparece después' } },
  { id: 'pure', es: 'Puro', en: 'Pure', sub: { en: 'Riddle only; use Hint', es: 'Solo la adivinanza; usa la pista' } },
];
export const CLASSIC_REVEAL_SECS = 3;
export const CPU_NAMES = [
  { en: 'Doña Chela', es: 'Doña Chela' }, { en: 'Don Beto', es: 'Don Beto' }, { en: 'Tía Lupe', es: 'Tía Lupe' },
];
export const byId = (list, id) => list.find((x) => x.id === id) ?? list[0];

// ---- dealing --------------------------------------------------------------------------------------------
export function newPool(rng, size = POOL) {
  const ids = rng.shuffle(Array.from({ length: DECK_SIZE }, (_, i) => i));
  return ids.slice(0, size);
}
export function dealTabla(rng, pool) {
  return rng.shuffle(pool).slice(0, CELLS);
}
export const emptyMarks = () => Array(CELLS).fill(false);

// ---- pattern queries ------------------------------------------------------------------------------------
// marks[i] true = bean on cell i; dead[i] true = that cell can no longer be marked this round.
export function isComplete(marks, patternId) {
  return setsOf(patternId).some((set) => set.every((i) => marks[i]));
}
// Fewest cells still to fill, counting only sets that are not already dead.
export function needed(marks, dead, patternId) {
  let best = Infinity;
  for (const set of setsOf(patternId)) {
    if (set.some((i) => dead[i] && !marks[i])) continue;
    best = Math.min(best, set.filter((i) => !marks[i]).length);
  }
  return best;
}
export const impossible = (marks, dead, patternId) => needed(marks, dead, patternId) === Infinity;
export function completedSet(marks, patternId) {
  return setsOf(patternId).find((set) => set.every((i) => marks[i])) ?? null;
}
// Cells of the set closest to completion (used to glow "needed" cells for the hint and for minis).
export function bestSet(marks, dead, patternId) {
  let best = null, bn = Infinity;
  for (const set of setsOf(patternId)) {
    if (set.some((i) => dead[i] && !marks[i])) continue;
    const n = set.filter((i) => !marks[i]).length;
    if (n < bn) { bn = n; best = set; }
  }
  return best;
}

// ---- marking rules ----------------------------------------------------------------------------------------
// Which called cards can still be marked right now: the last `window` calls.
export function markable(called, window) {
  return called.slice(Math.max(0, called.length - window));
}
// Outcome of tapping `cell`: 'bean' | 'already' | 'late' | 'wrong'.
export function tapOutcome(tabla, marks, cell, called, window) {
  if (marks[cell]) return 'already';
  const id = tabla[cell];
  if (markable(called, window).includes(id)) return 'bean';
  return called.includes(id) ? 'late' : 'wrong';
}
// Cells that just became dead: called, unmarked, no longer in the window.
export function refreshDead(tabla, marks, dead, called, window) {
  const ok = markable(called, window);
  for (let i = 0; i < tabla.length; i++) if (!marks[i] && !dead[i] && called.includes(tabla[i]) && !ok.includes(tabla[i])) dead[i] = true;
}

// ---- computer player ------------------------------------------------------------------------------------------
export function newCpu(rng, nameIdx, skillId, tabla) {
  return { name: nameIdx, skill: skillId, tabla, marks: emptyMarks(), dead: Array(CELLS).fill(false), pending: [], claimAt: -1 };
}
// A new card was called at time `now`: schedule this computer player's reaction (or its miss).
export function cpuHear(rng, cpu, cardId, now) {
  const sk = byId(SKILLS, cpu.skill), cell = cpu.tabla.indexOf(cardId);
  if (cell < 0 || cpu.marks[cell]) return;
  if (rng.chance(sk.miss)) return; // it simply does not notice; the cell dies when the window closes
  cpu.pending.push({ cell, at: now + rng.range(sk.react[0], sk.react[1]) });
}
// Computer claim delay once its pattern is complete.
export const cpuClaimDelay = (rng, cpu) => { const sk = byId(SKILLS, cpu.skill); return rng.range(sk.claim[0], sk.claim[1]); };

// ---- scoring -------------------------------------------------------------------------------------------------------
export const winPoints = (callsMade) => SCORE.win + Math.max(0, POOL - callsMade) * SCORE.perCallSaved;
