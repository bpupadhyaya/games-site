// The picture library, grouped into chapters. Clues and the solution are computed from each picture, never stored separately.
import { PUZZLES } from './puzzles.js';
import { cluesOfGrid } from './solver.js';

export const CHAPTERS = [
  { id: 'c1', keys: ['CHAPTER5'], size: 5, name: ['First Marks', 'はじめの一歩'], blurb: ['Small 5 by 5 pictures. Learn how the clues work.', '5×5の小さな絵。ヒントの読み方を覚えます。'] },
  { id: 'c2', keys: ['CHAPTER7'], size: 7, name: ['Garden Path', '庭の小道'], blurb: ['7 by 7 pictures with a little more to think about.', '少し考えがいのある7×7の絵。'] },
  { id: 'c3', keys: ['CHAPTER10'], size: 10, name: ['Harbour Lights', '港の灯り'], blurb: ['10 by 10 pictures from the harbour and beyond.', '港やその先の景色、10×10の絵。'] },
  { id: 'c4', keys: ['CHAPTER12'], size: 12, name: ['Market Day', '市の日'], blurb: ['12 by 12 pictures of everyday things.', '身近なものを描いた12×12の絵。'] },
  { id: 'c5', keys: ['CHAPTER15', 'CHAPTER15B'], size: 15, name: ['Lantern Hills', '灯籠の丘'], blurb: ['Scenes in 15 by 15. Zoom in when you need to.', '15×15の風景。必要なときは拡大できます。'] },
  { id: 'c6', keys: ['CHAPTER20A', 'CHAPTER20B'], size: 20, name: ['Summit Views', '頂の眺め'], blurb: ['Large 20 by 20 scenes for a long, calm evening.', 'ゆったり楽しむ20×20の大きな風景。'] },
];

const build = (e) => {
  const c = cluesOfGrid(e.art);
  const sol = new Uint8Array(e.w * e.h);
  for (let r = 0; r < e.h; r++) for (let q = 0; q < e.w; q++) if (e.art[r][q] !== '.') sol[r * e.w + q] = 1;
  return { id: e.id, name: e.name, w: e.w, h: e.h, art: e.art, bg: e.bg, rows: c.rows, cols: c.cols, sol, filled: sol.reduce((a, b) => a + b, 0) };
};

const byId = new Map();
export const CHAPTER_PUZZLES = CHAPTERS.map((ch) => PUZZLES.filter((p) => ch.keys.includes(p.ch)).map((e) => { const p = build(e); byId.set(p.id, p); return p; }));
export const LESSON_PUZZLES = PUZZLES.filter((p) => p.ch === 'LESSONS').map((e) => { const p = build(e); byId.set(`lesson:${p.id}`, p); return p; });
export const ALL_BANK = CHAPTER_PUZZLES.flat();
export const puzzleById = (id) => byId.get(id) ?? null;
export const chapterOf = (id) => CHAPTER_PUZZLES.findIndex((list) => list.some((p) => p.id === id));
export const TOTAL = ALL_BANK.length;
