// A play session: the letters on the grid, pencil marks, checks, reveals, undo and redo, and the hint chooser.
// The session never knows about drawing; game.js drives it and view.js reads it.
import { ACROSS, DIR_NAME, pattern, clueTips, topicPhrase, catOf, slotName } from './grid.js';

export const GRADES = [
  null,
  { name: 'Mini', n: 5, par: 120, tag: 'Five by five', text: 'A quick one: short words and a handful of clues. Ready in a couple of minutes.' },
  { name: 'Quick', n: 7, par: 300, tag: 'Seven by seven', text: 'A compact grid with everyday words. A good coffee-break puzzle.' },
  { name: 'Classic', n: 9, par: 600, tag: 'Nine by nine', text: 'The classic size: longer answers that cross in many places.' },
  { name: 'Grand', n: 11, par: 960, tag: 'Eleven by eleven', text: 'A big, open grid with long answers. Plan your route through it.' },
  { name: 'Giant', n: 13, par: 1500, tag: 'Thirteen by thirteen', text: 'The largest grid, built for a long, relaxed sitting.' },
];
export const GRADE_COUNT = GRADES.length - 1;

export function newSession({ pz, level, kind = 'free', day = 0, seed = 0, id = '' }) {
  const N = pz.n * pz.n;
  return {
    pz, level, kind, day, seed, id,
    v: new Array(N).fill(''), pencil: new Array(N).fill(0), rev: new Array(N).fill(0), mark: new Array(N).fill(0),
    t: 0, errs: 0, hints: 0, reveals: 0, checks: 0, moves: 0, undo: [], redo: [], done: false,
    sdone: new Array(pz.slots.length).fill(0),
  };
}
const snap = (P, c) => ({ c, v: P.v[c], p: P.pencil[c], k: P.mark[c] });
const restore = (P, s) => { P.v[s.c] = s.v; P.pencil[s.c] = s.p; P.mark[s.c] = s.k; };
function push(P, ops) { if (!ops.length) return; P.undo.push(ops); if (P.undo.length > 400) P.undo.shift(); P.redo.length = 0; P.moves += 1; }

export const isWrong = (P, i) => !!P.v[i] && P.v[i] !== P.pz.sol[i];
export const locked = (P, i) => !!P.rev[i];
export const slotCorrect = (P, slot) => slot.cells.every((c) => P.v[c] === P.pz.sol[c]);
export const slotFilled = (P, slot) => slot.cells.every((c) => !!P.v[c]);
export const solved = (P) => P.pz.sol.every((ch, i) => !ch || P.v[i] === ch);
export const wrongCells = (P) => { const out = []; for (let i = 0; i < P.v.length; i++) if (isWrong(P, i)) out.push(i); return out; };
export const filled = (P) => P.v.reduce((a, ch) => a + (ch ? 1 : 0), 0);
export const remaining = (P) => P.pz.white - filled(P);

// Put a letter in a cell. Returns { ok, kind, bad, done: [slot ids that just became fully correct] }.
export function put(P, cell, ch, { pencil = false } = {}) {
  if (P.pz.block[cell] || locked(P, cell) || P.done) return { ok: false };
  const before = snap(P, cell);
  P.v[cell] = ch; P.pencil[cell] = pencil ? 1 : 0; P.mark[cell] = 0;
  push(P, [before]);
  const bad = !pencil && ch !== P.pz.sol[cell];
  if (bad) P.errs += 1;
  return { ok: true, kind: pencil ? 'pencil' : 'letter', bad, done: newlyDone(P, cell) };
}
export function erase(P, cell) {
  if (P.pz.block[cell] || locked(P, cell) || !P.v[cell] || P.done) return { ok: false };
  push(P, [snap(P, cell)]);
  P.v[cell] = ''; P.pencil[cell] = 0; P.mark[cell] = 0;
  return { ok: true };
}
function newlyDone(P, cell) {
  const out = [];
  for (const id of [P.pz.acc[cell], P.pz.dwn[cell]]) {
    if (id < 0) continue;
    const s = P.pz.slots[id];
    if (!P.sdone[id] && slotCorrect(P, s)) { P.sdone[id] = 1; out.push(id); }
    else if (P.sdone[id] && !slotCorrect(P, s)) P.sdone[id] = 0;
  }
  return out;
}
export function refreshDone(P) { P.pz.slots.forEach((s, id) => { P.sdone[id] = slotCorrect(P, s) ? 1 : 0; }); }
export function undo(P) {
  const ops = P.undo.pop();
  if (!ops) return false;
  const inv = ops.map((o) => snap(P, o.c));
  for (const o of ops.slice().reverse()) restore(P, o);
  P.redo.push(inv); refreshDone(P);
  return true;
}
export function redo(P) {
  const ops = P.redo.pop();
  if (!ops) return false;
  const inv = ops.map((o) => snap(P, o.c));
  for (const o of ops.slice().reverse()) restore(P, o);
  P.undo.push(inv); refreshDone(P);
  return true;
}

// Check: mark every wrong letter among `cells` (cleared again as soon as the cell changes). Returns the number marked.
export function check(P, cells) {
  let bad = 0;
  P.checks += 1;
  for (const c of cells) if (isWrong(P, c)) { P.mark[c] = 1; bad += 1; }
  return bad;
}
// Reveal: write the correct letters, lock them, and note it for the stars. Returns the cells that changed.
export function reveal(P, cells, count = true) {
  const ops = [], out = [];
  for (const c of cells) {
    if (P.pz.block[c] || P.rev[c]) continue;
    if (P.v[c] === P.pz.sol[c]) continue;
    ops.push(snap(P, c)); P.v[c] = P.pz.sol[c]; P.pencil[c] = 0; P.mark[c] = 0; P.rev[c] = 1; out.push(c);
  }
  if (out.length) { push(P, ops); if (count) P.reveals += out.length; refreshDone(P); }
  return out;
}

// ---- results -----------------------------------------------------------------------------------------------------------------------
export function starsFor(P) {
  const par = GRADES[P.level].par, help = P.hints + P.reveals;
  if (help === 0 && P.t <= par * 1.5) return 3;
  if (help <= Math.max(2, Math.round(P.pz.white / 14)) || P.t <= par * 2.5) return 2;
  return 1;
}
export const fmtTime = (t) => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };

// ---- hints and Watch and Learn ---------------------------------------------------------------------------------------------------
// The next answer a thoughtful solver would write in: the slot that is not finished and has the most letters already crossing it.
export function pickSlot(P) {
  const pz = P.pz;
  let best = null, bestScore = -1e9;
  for (const s of pz.slots) {
    if (slotCorrect(P, s)) continue;
    if (s.cells.some((c) => isWrong(P, c))) continue;
    const known = s.cells.filter((c) => P.v[c] === pz.sol[c]).length;
    if (known === s.len) continue;
    let score = (known / s.len) * 8 + (known > 0 ? 2 : 0) - s.len * 0.2 + (s.clue.includes('___') ? 2.5 : 0) + (s.clue.length < 22 ? 0.6 : 0);
    score -= s.id * 0.001;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}
export function explain(P, slot) {
  const pat = pattern(P.v, P.pz, slot), known = [...pat].filter((x) => x !== '_').length, name = slotName(P.pz, slot.id);
  const spaced = [...pat].join(' ');
  const look = `${name}, ${slot.len} letters.\nClue: ${slot.clue}\n` + (known ? `Letters you can already count on: ${spaced}` : 'No crossing letters yet. Start from the clue alone.');
  const parts = [`${name} is ${topicPhrase(catOf(slot.cat))}, ${slot.len} letters long.`];
  parts.push(known ? `The crossing words give you ${spaced}. Say the clue again and try to fit a word to that shape.` : 'No crossing letters help yet, so read the clue slowly and think of the shortest everyday word that fits.');
  parts.push(`It starts with ${slot.word[0]}.`);
  const tip = clueTips(slot)[0];
  if (tip) parts.push(tip);
  const lookBody = `${slot.clue}\n` + (known ? `You can already count on: ${spaced}` : 'No crossing letters yet. Start from the clue alone.');
  const reveal = `${slot.word} fits: ${slot.len} letters, ${known ? 'every crossing letter agrees,' : 'a clean fit,'} and it answers the clue.`;
  return { name, look, lookBody, why: parts.join(' '), reveal, tip: tip ?? '', pattern: pat };
}
