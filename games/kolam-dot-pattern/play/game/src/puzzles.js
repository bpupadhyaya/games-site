// The puzzle library: 72 patterns in six chapters plus the Learn lessons. Every puzzle is the arrangement of dots, a few gap marks and
// one verified solution (a single closed line); any closed line through every arc that keeps the marks wins.
import { buildBoard } from './board.js';
import { dotsOf, shapeName } from './shapes.js';
import { PUZZLE_DATA, LESSON_DATA } from './puzzles-data.js';

export const CHAPTERS = [
  { id: 0, name: 'First Dots', blurb: 'Small arrangements to learn how the line wraps the dots.' },
  { id: 1, name: 'Square Grids', blurb: 'Rows and columns of dots, from 5 by 3 up to 8 by 8.' },
  { id: 2, name: 'Diamonds', blurb: 'The same grid turned on its corner, so the lines run straight.' },
  { id: 3, name: 'Staggered Grids', blurb: 'Every dot has six neighbours, like a honeycomb.' },
  { id: 4, name: 'Shapes', blurb: 'Crosses, frames, stairs and other outlines.' },
  { id: 5, name: 'Grand Patterns', blurb: 'The biggest arrangements: take your time.' },
];

const cache = new Map();

function build(d) {
  const hit = cache.get(d.id);
  if (hit) return hit;
  const B = buildBoard({ lat: d.lat, dots: dotsOf(d.sh) });
  const marks = {};
  const sol = new Int8Array(B.gates.length);
  B.free.forEach((g, i) => { sol[g] = Number(d.s[i]); if (d.m[i] !== '-') marks[g] = Number(d.m[i]); });
  const puz = { id: d.id, ch: d.c, lat: d.lat, shape: d.sh, B, marks, sol, name: shapeName(d.sh), dots: B.dots.length, nArc: B.nArc, free: B.free.length, markCount: Object.keys(marks).length, unique: Boolean(d.u) };
  cache.set(d.id, puz);
  return puz;
}

export const ALL_IDS = PUZZLE_DATA.map((d) => d.id);
export const TOTAL = PUZZLE_DATA.length;
export const puzzleById = (id) => {
  const d = PUZZLE_DATA.find((q) => q.id === id) ?? LESSON_DATA.find((q) => q.id === id);
  return d ? build(d) : null;
};
export const chapterIds = (ci) => PUZZLE_DATA.filter((d) => d.c === ci).map((d) => d.id);
export const chapterOf = (id) => { const d = PUZZLE_DATA.find((q) => q.id === id); return d ? d.c : -1; };
export const lessonPuzzle = (i) => puzzleById(LESSON_DATA[i].id);
export const LESSON_COUNT = LESSON_DATA.length;
export const orderOf = (id) => chapterIds(chapterOf(id)).indexOf(id) + 1;
