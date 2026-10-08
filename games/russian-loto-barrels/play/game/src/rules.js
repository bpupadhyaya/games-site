// Russian Loto rules engine: pure functions + constants, no state of its own. Everything the Rules page quotes is read from here.
//
// Cards: 3 rows x 9 columns, 15 numbers (5 per row). Column c holds the numbers of its decade (col 0 = 1-9, col 1 = 10-19 ... col 8 = 80-90).
// A set of six cards holds each of the 90 kegs exactly once. Cell index = row * 9 + col, 0 = blank.
export const COLS = 9, ROWS = 3, CELLS = 27, KEGS = 90, PER_CARD = 15, PER_ROW = 5, SET_SIZE = 6;
export const MAX_CARDS = 6, MAX_DUO_CARDS = 3;

export const colOf = (n) => (n >= 80 ? 8 : Math.floor(n / 10));
const SUMS = [9, 10, 10, 10, 10, 10, 10, 10, 11];
const colNumbers = (c) => {
  const lo = c === 0 ? 1 : c * 10, hi = c === 8 ? 90 : c * 10 + 9, out = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
};
export const decadeLabel = (c) => (c === 0 ? '1-9' : c === 8 ? '80-90' : `${c * 10}-${c * 10 + 9}`);

// ---- scoring (score-only: points are bragging rights, nothing else) --------------------------------------------------
export const SCORE = { mark: 10, speedMax: 8, wrong: -10, falseClaim: -25, row: 60, two: 120, loto: 250, comboStep: 4, comboMax: 4 };
export const LOCKOUT_SECS = 3;
export const HINTS_PER_ROUND = 3;
export const STAGES = ['row', 'two', 'loto'];
export const STAGE_POINTS = { row: SCORE.row, two: SCORE.two, loto: SCORE.loto };
export const GOALS = [
  { id: 'row', name: 'Quick game', blurb: 'The first row ends the round' },
  { id: 'ladder', name: 'Row ladder', blurb: 'Row, two rows, then the full card' },
  { id: 'full', name: 'Marathon', blurb: 'Only the full card counts' },
];
export const PACES = [
  { id: 'calm', name: 'Calm', secs: 5, window: 7 },
  { id: 'classic', name: 'Classic', secs: 3.6, window: 6 },
  { id: 'rapid', name: 'Rapid', secs: 2.6, window: 5 },
  { id: 'blitz', name: 'Blitz', secs: 1.8, window: 4 },
];
export const SKILLS = [
  { id: 'easy', name: 'Easy', react: [1.8, 3.6], miss: 0.07, slip: 0.12, wrong: 0.05, claim: [1.4, 2.8], cards: 0.7 },
  { id: 'normal', name: 'Normal', react: [1.1, 2.4], miss: 0.03, slip: 0.06, wrong: 0.02, claim: [0.7, 1.8], cards: 0.85 },
  { id: 'sharp', name: 'Sharp', react: [0.6, 1.5], miss: 0.01, slip: 0.03, wrong: 0.008, claim: [0.35, 1.0], cards: 1 },
];
export const byId = (list, id) => list.find((x) => x.id === id) ?? list[0];
export const CPU_NAMES = ['Misha', 'Galya', 'Tolya'];
export const NICKNAMES = { 11: 'Drumsticks', 22: 'Swans', 69: 'There and back', 77: 'Axes', 90: 'Grandfather' };

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
export const numberWord = (n) => (n < 20 ? WORDS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + WORDS[n % 10].toLowerCase() : ''));

// ---- card generation -------------------------------------------------------------------------------------------------
function genCounts(rng) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const c = Array.from({ length: SET_SIZE }, () => Array(COLS).fill(1)), rem = Array(SET_SIZE).fill(PER_CARD - COLS);
    let ok = true;
    for (let j = 0; j < COLS && ok; j++) {
      for (let e = 0; e < SUMS[j] - SET_SIZE; e++) {
        const pool = []; for (let i = 0; i < SET_SIZE; i++) if (c[i][j] < ROWS && rem[i] > 0) pool.push(i);
        if (!pool.length) { ok = false; break; }
        const i = rng.pick(pool); c[i][j]++; rem[i]--;
      }
    }
    if (ok && rem.every((v) => v === 0)) return c;
  }
  return null;
}
const SUBSETS = { 1: [[0], [1], [2]], 2: [[0, 1], [0, 2], [1, 2]], 3: [[0, 1, 2]] };
function placeRows(rng, counts) {
  const order = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]), left = [PER_ROW, PER_ROW, PER_ROW], pick = Array(COLS).fill(null);
  const dfs = (k) => {
    if (k === COLS) return left.every((v) => v === 0);
    const j = order[k];
    for (const sub of rng.shuffle(SUBSETS[counts[j]])) {
      if (sub.some((r) => left[r] === 0)) continue;
      sub.forEach((r) => left[r]--); pick[j] = sub;
      if (dfs(k + 1)) return true;
      sub.forEach((r) => left[r]++);
    }
    return false;
  };
  return dfs(0) ? pick : null;
}
// A set of six cards: every keg 1-90 appears on exactly one of them.
export function genSet(rng) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const counts = genCounts(rng); if (!counts) continue;
    const layouts = counts.map((cc) => placeRows(rng, cc));
    if (layouts.some((l) => !l)) continue;
    const cards = Array.from({ length: SET_SIZE }, () => Array(CELLS).fill(0));
    for (let j = 0; j < COLS; j++) {
      const nums = rng.shuffle(colNumbers(j)); let at = 0;
      for (let i = 0; i < SET_SIZE; i++) {
        const mine = nums.slice(at, at + counts[i][j]).sort((a, b) => a - b); at += counts[i][j];
        layouts[i][j].slice().sort((a, b) => a - b).forEach((r, k) => { cards[i][r * COLS + j] = mine[k]; });
      }
    }
    return cards;
  }
  throw new Error('card generation failed');
}
// n cards for one player: the first n of a fresh set (so the player's own cards never repeat a number).
export const dealCards = (rng, n) => genSet(rng).slice(0, n);
export const freshMarks = (n) => Array.from({ length: n }, () => Array(CELLS).fill(false));
export const newBag = (rng) => rng.shuffle(Array.from({ length: KEGS }, (_, i) => i + 1));

// ---- reading a card ----------------------------------------------------------------------------------------------------
export function rowDone(card, marks, r) {
  for (let c = 0; c < COLS; c++) { const i = r * COLS + c; if (card[i] && !marks[i]) return false; }
  return true;
}
export const rowsDone = (card, marks) => [0, 1, 2].filter((r) => rowDone(card, marks, r));
export const cardMarked = (card, marks) => card.reduce((s, v, i) => s + (v && marks[i] ? 1 : 0), 0);
// Highest stage reached by a player's cards, per stage, with the winning card/rows for highlighting.
export function reached(cards, marks) {
  const out = { row: null, two: null, loto: null };
  cards.forEach((card, ci) => {
    const rows = rowsDone(card, marks[ci]);
    if (rows.length >= 1 && !out.row) out.row = { card: ci, rows: [rows[0]] };
    if (rows.length >= 2 && !out.two) out.two = { card: ci, rows: rows.slice(0, 2) };
    if (rows.length === 3 && !out.loto) out.loto = { card: ci, rows };
  });
  return out;
}
export const activeStages = (goal) => (goal === 'full' ? ['loto'] : goal === 'row' ? ['row'] : STAGES);
export const endStage = (goal) => { const a = activeStages(goal); return a[a.length - 1]; };
// The best stage a player can claim right now: reached, not yet claimed by anyone, and (for the ladder) any order is allowed.
export function claimable(goal, cards, marks, claims) {
  const rc = reached(cards, marks);
  for (const s of ['loto', 'two', 'row']) if (activeStages(goal).includes(s) && rc[s] && !claims[s]) return s;
  return null;
}

// ---- the open window --------------------------------------------------------------------------------------------------
// A keg can be marked while it is among the last `window` kegs called.
export const isOpen = (called, n, window) => { const i = called.lastIndexOf(n); return i >= 0 && called.length - 1 - i < window; };
export const ageIdx = (called, n) => { const i = called.lastIndexOf(n); return i < 0 ? -1 : called.length - 1 - i; };
// What happens when a player taps cell i of a card: 'blank' | 'already' | 'mark' | 'early' (not called) | 'late' (window closed).
export function tapOutcome(card, marks, i, called, window) {
  const n = card[i];
  if (!n) return 'blank';
  if (marks[i]) return 'already';
  if (!called.includes(n)) return 'early';
  return isOpen(called, n, window) ? 'mark' : 'late';
}
// Cells that can never be marked any more (called, unmarked, window shut).
export function deadCells(card, marks, called, window) {
  const out = Array(CELLS).fill(false);
  for (let i = 0; i < CELLS; i++) if (card[i] && !marks[i] && called.includes(card[i]) && !isOpen(called, card[i], window)) out[i] = true;
  return out;
}
// A row/card is still possible if it has no dead cell.
export function stagePossible(cards, marks, called, window, stage) {
  return cards.some((card, ci) => {
    const dead = deadCells(card, marks[ci], called, window);
    const rowsOk = [0, 1, 2].filter((r) => { for (let c = 0; c < COLS; c++) if (dead[r * COLS + c]) return false; return true; });
    return stage === 'row' ? rowsOk.length >= 1 : stage === 'two' ? rowsOk.length >= 2 : rowsOk.length === 3;
  });
}
// Cells on the player's cards that match a keg (for hints and the Watch & Learn tutor).
export function cellsFor(cards, n) {
  const out = [];
  cards.forEach((card, ci) => { const i = card.indexOf(n); if (i >= 0) out.push({ ci, cell: i }); });
  return out;
}

// ---- scoring ---------------------------------------------------------------------------------------------------------------
export const markPoints = (age, secs, streak) => {
  const speed = Math.round(SCORE.speedMax * Math.max(0, 1 - age / (secs * 1.2)));
  const mult = 1 + Math.min(SCORE.comboMax, Math.floor(streak / SCORE.comboStep)) * 0.25;
  return { speed, pts: Math.round((SCORE.mark + speed) * mult), mult };
};
export const lotoBonus = (called) => Math.max(0, KEGS - called) * 2;   // finishing early pays
// How many cards a computer player holds when you hold n: fewer on easier skills, never more than 3.
export const cpuCards = (n, skillId) => Math.min(3, Math.max(1, Math.round(n * byId(SKILLS, skillId).cards)));
export const cpuReact = (rng, sk, nCards) => rng.range(sk.react[0], sk.react[1]) * (1 + 0.12 * (nCards - 1));
export const cpuClaimDelay = (rng, sk) => rng.range(sk.claim[0], sk.claim[1]);
