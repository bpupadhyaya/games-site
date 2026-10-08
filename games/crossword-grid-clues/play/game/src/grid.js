// Crossword engine: turns a stored grid into numbered slots with clues, and answers every question about a position.
// Pure and deterministic. A puzzle string is n*n characters, '#' for a block and A-Z for the answer letter.
import { WORDS, CATEGORIES } from './words.js';

export const ACROSS = 0, DOWN = 1;
export const DIR_NAME = ['Across', 'Down'];

// Build the puzzle structure. `flip` transposes the grid (across becomes down), which gives a fresh puzzle from the same data.
export function makePuzzle(str, n, flip = false) {
  const g = new Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g[(flip ? c * n + r : r * n + c)] = str[r * n + c];
  const block = g.map((ch) => ch === '#'), sol = g.map((ch) => (ch === '#' ? '' : ch));
  const at = (r, c) => (r >= 0 && c >= 0 && r < n && c < n ? r * n + c : -1);
  const num = new Array(n * n).fill(0), slots = [], acc = new Array(n * n).fill(-1), dwn = new Array(n * n).fill(-1);
  let k = 0;
  const runFrom = (r, c, dr, dc) => { const cells = []; while (at(r, c) >= 0 && !block[at(r, c)]) { cells.push(at(r, c)); r += dr; c += dc; } return cells; };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c;
    if (block[i]) continue;
    const startA = (c === 0 || block[i - 1]) && c + 1 < n && !block[i + 1];
    const startD = (r === 0 || block[i - n]) && r + 1 < n && !block[i + n];
    if (!startA && !startD) continue;
    k += 1; num[i] = k;
    for (const [on, dir, dr, dc] of [[startA, ACROSS, 0, 1], [startD, DOWN, 1, 0]]) {
      if (!on) continue;
      const cells = runFrom(r, c, dr, dc), word = cells.map((x) => sol[x]).join(''), e = WORDS.get(word);
      const slot = { id: slots.length, dir, num: k, cells, len: cells.length, word, clue: e ? e.clue : '(clue missing)', cat: e ? e.cat : 0 };
      slots.push(slot);
      for (const x of cells) (dir === ACROSS ? acc : dwn)[x] = slot.id;
    }
  }
  // clue order: all Across by number, then all Down by number
  const order = slots.slice().sort((a, b) => a.dir - b.dir || a.num - b.num).map((s) => s.id);
  return { n, str, flip, block, sol, num, slots, acc, dwn, order, white: block.filter((b) => !b).length };
}

export const slotOf = (pz, cell, dir) => {
  const a = pz.acc[cell], d = pz.dwn[cell];
  const want = dir === ACROSS ? a : d, other = dir === ACROSS ? d : a;
  return want >= 0 ? want : other;
};
export const slotName = (pz, id) => `${pz.slots[id].num} ${DIR_NAME[pz.slots[id].dir]}`;
// next/previous clue in clue order (wraps)
export function stepSlot(pz, id, step) {
  const o = pz.order, i = o.indexOf(id);
  return o[(i + step + o.length) % o.length];
}
// move to the nearest white cell in a direction, skipping blocks; stays put at the edge
export function moveCell(pz, cell, dr, dc) {
  const n = pz.n;
  let r = Math.floor(cell / n) + dr, c = (cell % n) + dc;
  while (r >= 0 && c >= 0 && r < n && c < n) { if (!pz.block[r * n + c]) return r * n + c; r += dr; c += dc; }
  return cell;
}
export const firstWhite = (pz) => pz.block.findIndex((b) => !b);

// Letters that are known for a slot: the correct letters already placed (wrong ones count as unknown).
export function pattern(v, pz, slot, gap = '_') {
  return slot.cells.map((c) => (v[c] && v[c] === pz.sol[c] ? v[c] : gap)).join('');
}
export const catOf = (idx) => CATEGORIES[idx] ?? '';

// How a word's topic reads in a hint.
export function topicPhrase(name) {
  switch (name) {
    case 'Actions': return 'an action word, a verb';
    case 'Describing words': return 'a describing word, an adjective';
    case 'Everyday words': return 'an everyday word';
    default: return `a word about ${name.toLowerCase()}`;
  }
}

// Notes about how the clue is written, used by hints and Watch and Learn to teach solving habits.
export function clueTips(slot) {
  const c = slot.clue, tips = [];
  if (c.includes('___')) tips.push('This is a fill-in-the-blank clue: say the phrase aloud and the missing word usually jumps out.');
  if (/\?\s*$/.test(c)) tips.push('A question mark at the end warns of wordplay: the clue is a pun or a joke, not a plain definition.');
  if (/\bBritish\b|\bBritain\b|\bUK\b/.test(c) && !/\bAmerican\b/.test(c)) tips.push('The clue names Britain, so think of the British word or spelling.');
  if (/\bAmerican\b|\bAmerica\b|\bUS\b/.test(c) && !/\bBritish\b/.test(c)) tips.push('The clue names America, so think of the American word or spelling.');
  if (/\bBritish\b/.test(c) && /\bAmerican\b/.test(c)) tips.push('British and American English differ: the clue tells you which side of the Atlantic to think about.');
  if (/\b(informally|slang|for short|casually)\b/i.test(c)) tips.push('A hint such as "informally" or "for short" means the answer is a casual or shortened form.');
  const last = c.replace(/[^A-Za-z ]/g, '').trim().split(' ').pop().toLowerCase();
  if (slot.word.endsWith('S') && !slot.word.endsWith('SS') && /s$/.test(last) && !/(ss|us|is)$/.test(last) && slot.len > 3) tips.push('The clue is plural, so the answer is plural too: expect an S at the end.');
  if (/\b(past|former|earlier)\b/i.test(c)) tips.push('The clue points to the past: think of a past tense or an earlier time.');
  return tips;
}

// Count of cells filled / correct
export const filledCount = (P) => P.v.reduce((a, ch) => a + (ch ? 1 : 0), 0);
