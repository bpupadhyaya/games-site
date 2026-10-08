// The Journey: a campaign from letters to graduate vocabulary. Pure rules and layout; state lives in game.js.
// Worlds 0-1 are special (alphabet, first 100 words), worlds 2-7 are the six word levels. Each world has stages of 10 words,
// then a checkpoint test. Stage words are an even sample of the level, so a world covers the whole range of that level.
import { ART_WORDS } from './art.js';
import { LETTERS, letterEntry } from './letters.js';
import * as lex from './lexicon.js';

// (kept off an `export` line: the shared check's 3D-import pattern matches the number word in quotes)
const FIRST100 = [...ART_WORDS, 'mother', 'father', 'baby', 'boy', 'girl', 'man', 'woman', 'friend', 'teacher', 'school', 'home', 'food', 'rice', 'tea', 'coffee', 'eat', 'drink', 'sleep', 'walk', 'run', 'sit', 'stand', 'open', 'close', 'big', 'small', 'hot', 'cold', 'happy', 'sad', 'good', 'bad', 'new', 'old', 'red', 'blue', 'green', 'yellow', 'black', 'white', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'day', 'night', 'morning', 'week', 'year', 'money', 'market', 'doctor', 'hand', 'head', 'eye', 'ear', 'mouth', 'foot', 'hospital', 'bus', 'road', 'farm', 'work', 'help', 'name'];
export { FIRST100 };
export const WORLDS = [
  { id: 0, k: 'letters', name: 'Letter Land', blurb: 'Meet every letter of the alphabet', color: '#ff9f1c', secs: 20, stages: 6 },
  { id: 1, k: 'first', name: 'First 100 Words', blurb: 'Pictures and everyday words', color: '#2ec4b6', secs: 18 },
  { id: 2, k: 'band', band: 0, name: 'Sunny Meadow', blurb: 'Elementary words', color: '#80ed99', secs: 14, stages: 8 },
  { id: 3, k: 'band', band: 1, name: 'Harbour Town', blurb: 'Middle school words', color: '#4cc9f0', secs: 12, stages: 8 },
  { id: 4, k: 'band', band: 2, name: 'Pine Forest', blurb: 'High school words', color: '#52b788', secs: 11, stages: 8 },
  { id: 5, k: 'band', band: 3, name: 'Crystal Mountain', blurb: 'Undergraduate words', color: '#b5a6ff', secs: 10, stages: 8 },
  { id: 6, k: 'band', band: 4, name: 'Summit', blurb: 'Graduate words', color: '#ff8fab', secs: 9, stages: 8 },
  { id: 7, k: 'band', band: 5, name: 'Sky Library', blurb: 'Professional words', color: '#ffd166', secs: 8, stages: 8 },
];
export const STAGE_QUESTIONS = 12, CHECK_QUESTIONS = 15, PASS_CHECK = 0.7, WORDS_PER_STAGE = 10;
export const stageId = (w, s) => `${w}.${s}`;
export const starsFor = (right, n) => { const a = n ? right / n : 0; return a >= 0.9 ? 3 : a >= 0.75 ? 2 : a >= 0.5 ? 1 : 0; };

let cache = { v: -1, first: [], bands: [] };
function build() {
  const v = lex.version(); if (cache.v === v) return cache;
  const first = FIRST100.map((w) => lex.entry(w)).filter((e) => e && e.gloss);
  const bands = [0, 1, 2, 3, 4, 5].map((b) => {
    const all = lex.all().filter((e) => e.band === b && e.gloss && e.gloss.length <= 90);
    const n = Math.min(80, all.length), out = [];
    for (let i = 0; i < n; i += 1) out.push(all[Math.floor((i * all.length) / n)]);
    return out;
  });
  cache = { v, first, bands }; return cache;
}
export function stageCount(w) {
  const W = WORLDS[w];
  if (W.k === 'first') return Math.max(1, Math.ceil(build().first.length / WORDS_PER_STAGE));
  return W.stages;
}
export function stageWords(w, s) {
  const W = WORLDS[w];
  if (W.k === 'letters') {
    const groups = [LETTERS.slice(0, 5), LETTERS.slice(5, 10), LETTERS.slice(10, 15), LETTERS.slice(15, 20), LETTERS.slice(20), LETTERS];
    return (groups[s] ?? LETTERS).map(letterEntry);
  }
  const list = W.k === 'first' ? build().first : build().bands[W.band];
  return list.slice(s * WORDS_PER_STAGE, s * WORDS_PER_STAGE + WORDS_PER_STAGE);
}
export const worldWords = (w) => { const out = []; for (let s = 0; s < stageCount(w); s += 1) out.push(...stageWords(w, s)); return out; };
export const stageTitle = (w, s) => (WORLDS[w].k === 'letters' ? ['A to E', 'F to J', 'K to O', 'P to T', 'U to Z', 'All letters'][s] : `Stage ${s + 1}`);

// ---- progress rules. j = { stars: {'2.3': 2}, checks: {'2': 85}, placed: 0 }
export const isWorldUnlocked = (j, w) => w <= 1 || (j.checks[w - 1] ?? 0) >= PASS_CHECK * 100 || (j.placed ?? 0) >= w;
export const isStageUnlocked = (j, w, s) => isWorldUnlocked(j, w) && (s === 0 || (j.stars[stageId(w, s - 1)] ?? 0) >= 1 || (j.placed ?? 0) > w);
export const worldStars = (j, w) => { let n = 0; for (let s = 0; s < stageCount(w); s += 1) n += j.stars[stageId(w, s)] ?? 0; return n; };
export const worldDone = (j, w) => { for (let s = 0; s < stageCount(w); s += 1) if ((j.stars[stageId(w, s)] ?? 0) < 1) return false; return true; };
export const checkReady = (j, w) => isWorldUnlocked(j, w) && (worldDone(j, w) || (j.placed ?? 0) > w);
export const totalStars = (j) => Object.values(j.stars).reduce((a, b) => a + b, 0);

// ---- placement: three words per level, easiest first
export function placementEntries() {
  const B = build().bands, out = [];
  B.forEach((list, b) => { for (const f of [0.2, 0.5, 0.8]) if (list.length) out.push({ band: b, e: list[Math.floor(list.length * f)] }); });
  return out;
}
export function estimateVocab(per) {            // per[b] = [right, asked]
  const size = [0, 0, 0, 0, 0, 0]; for (const e of lex.all()) if (e.band >= 0) size[e.band] += 1;
  let total = 0, v = 0;
  per.forEach(([r, n], b) => { const p = (r + 0.5) / (n + 1); total += p * size[b]; v += ((p * (1 - p)) / (n + 1)) * size[b] * size[b]; });
  const sd = Math.sqrt(v);
  return { total: Math.round(total / 100) * 100, lo: Math.max(0, Math.round((total - 1.5 * sd) / 100) * 100), hi: Math.round((total + 1.5 * sd) / 100) * 100 };
}
export function placedWorld(per) {              // first world to play: the level after the last one answered mostly right
  let top = -1; per.forEach(([r, n], b) => { if (n && r / n >= 0.6) top = b; });
  return top < 0 ? 2 : Math.min(7, top + 3);
}

// ---- the map: worlds stacked top to bottom, stage nodes in rows of four, the checkpoint at the end
export function mapLayout(width) {
  const items = []; let y = 10; const R = 44, cols = 4;
  for (const W of WORLDS) {
    const n = stageCount(W.id), rows = Math.ceil(n / cols);
    items.push({ type: 'world', world: W.id, y, h: 108 }); y += 118;
    for (let i = 0; i < n; i += 1) {
      const row = Math.floor(i / cols), c = i % cols, flip = row % 2 === 1, col = flip ? cols - 1 - c : c;
      items.push({ type: 'node', kind: 'stage', world: W.id, stage: i, x: width * (0.14 + (0.72 * col) / (cols - 1)), y: y + row * 128 + R + 10, r: R });
    }
    y += rows * 128;
    items.push({ type: 'node', kind: 'check', world: W.id, stage: -1, x: width / 2, y: y + 62, r: 56 }); y += 150;
  }
  return { items, height: y + 10 };
}
