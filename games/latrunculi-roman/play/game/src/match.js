// One game in progress: the position, its move history, and the short-lived animation state (pieces sliding, captured pieces
// fading, glints). All timing uses dt; randomness comes only from the rng passed in. The board itself never moves.
import { startState, applyMove, legalMoves, movesFrom, other, SIDE } from './rules.js';
import { thinkTask } from './ai.js';

export const CAP_T = 0.55;
// A slide takes longer the further it goes, at a steady speed (no slow-then-fast), eased only at both ends.
export const slideTime = (from, to) => { const d = Math.abs((from >> 3) - (to >> 3)) + Math.abs((from & 7) - (to & 7)); return Math.min(0.62, 0.2 + 0.055 * d); };

export function createMatch(o) {
  const st = o.start ? { ...o.start, cells: o.start.cells.slice() } : startState();
  return {
    level: o.level ?? 'skilled', human: o.human ?? 1, two: Boolean(o.two), lesson: o.lesson ?? null, auto: Boolean(o.auto), autoLevels: o.autoLevels ?? null,
    st, hist: [], sel: -1, cur: 52, hint: null, hintTask: null, task: null, anim: {}, ghosts: [], parts: [], t: 0, over: null, overT: 0, winT: 0,
    last: null, aiT: 0.7, flash: -1, flashT: 0, events: [], pal: o.pal ?? { 1: '240,225,190', 2: '120,200,230' }, thinking: false,
    freeze: false, enclose: null,
  };
}

export const humanTurn = (M) => !M.over && !M.auto && (M.two || M.st.turn === M.human);
export const settled = (M) => !M.ghosts.length && Object.values(M.anim).every((a) => a.t >= a.dur);

// Index into the history of the start of the human's most recent turn (any player's most recent turn in two-player mode).
export function undoTarget(M) {
  for (let g = M.hist.length - 1; g >= 0; g--) if (M.two || M.hist[g].st.turn === M.human) return g;
  return -1;
}
export const canUndo = (M) => !M.over && !M.auto && !M.lesson && !M.freeze && (M.two || M.st.turn === M.human) && undoTarget(M) >= 0;

export function undoMatch(M) {
  if (!canUndo(M)) return false;
  const g = undoTarget(M);
  M.st = M.hist[g].st;
  M.hist.length = g;
  M.anim = {}; M.ghosts = []; M.sel = -1; M.hint = null; M.hintTask = null; M.task = null; M.thinking = false;
  M.last = M.st.last ?? null; M.over = null; M.aiT = 0.5; M.enclose = null;
  M.events.push({ type: 'undo' });
  return true;
}

export const targetsOf = (M) => (M.sel < 0 ? [] : movesFrom(M.st, M.sel).map((m) => m.to));
// What moving the selected piece to `to` would take (shown before the player commits): { caps: [squares], dux: boolean }.
export function previewMove(M, to) {
  if (M.sel < 0) return { caps: [], dux: false };
  const n = applyMove(M.st, { from: M.sel, to });
  return { caps: n.last.captured, dux: n.last.duxTaken };
}

// Make a move (already known to be legal). Returns the new state's `over`, if the game ended.
export function playMove(M, mv, silent = false) {
  const before = M.st;
  M.hist.push({ st: before, mv });
  M.st = applyMove(before, mv);
  const last = M.st.last;
  M.sel = -1; M.hint = null; M.hintTask = null; M.last = last; M.thinking = false; M.task = null;
  if (!silent) {
    M.anim[mv.to] = { t: 0, from: mv.from, who: before.turn, dur: slideTime(mv.from, mv.to), kind: 'slide', piece: last.piece };
    delete M.anim[mv.from];
    M.events.push({ type: 'slide', who: before.turn, at: mv.to, from: mv.from, dist: Math.abs((mv.from >> 3) - (mv.to >> 3)) + Math.abs((mv.from & 7) - (mv.to & 7)) });
    const delay = slideTime(mv.from, mv.to) * 0.92;
    if (last.captured.length) {
      for (const c of last.captured) M.ghosts.push({ cell: c, code: before.cells[c], t: 0, delay, fired: false });
      M.events.push({ type: 'capturing', n: last.captured.length });
    }
    if (last.duxTaken) { M.enclose = { cell: last.duxAt, code: before.cells[last.duxAt], t: 0, delay }; }
  }
  if (M.st.over) {
    M.over = M.st.over; M.overT = 0; M.winT = 0;
    M.events.push({ type: 'end', winner: M.over.winner, why: M.over.why });
  } else M.aiT = 0.55;
  return M.over;
}

// A tap on a square by the player whose turn it is. Returns 'move' | 'select' | 'deselect' | 'refuse' | null.
export function tapCell(M, i) {
  if (!humanTurn(M) || M.freeze) return null;
  const st = M.st;
  if (SIDE[st.cells[i]] === st.turn) {
    if (M.sel === i) { M.sel = -1; return 'deselect'; }
    if (movesFrom(st, i).length) { M.sel = i; M.hint = null; M.hintTask = null; M.events.push({ type: 'select' }); return 'select'; }
    refuse(M, i, 'stuck'); return 'refuse';
  }
  if (M.sel >= 0) {
    const mv = movesFrom(st, M.sel).find((m) => m.to === i);
    if (mv) { if (M.gate && !M.gate(mv)) return 'refuse'; playMove(M, mv); return 'move'; }
  }
  refuse(M, i, st.cells[i] === 0 ? (M.sel >= 0 ? 'far' : 'empty') : 'foe'); return 'refuse';
}
function refuse(M, i, why) { M.flash = i; M.flashT = 0.45; M.events.push({ type: 'refuse', why }); }

export function stepMatch(M, dt, rng) {
  M.t += dt;
  for (const k of Object.keys(M.anim)) {
    const a = M.anim[k]; a.t += dt;
    if (!a.landed && a.t >= a.dur * 0.92) { a.landed = true; M.events.push({ type: 'land', at: Number(k), who: a.who }); }
    if (a.t > a.dur + 1) delete M.anim[k];
  }
  for (const g of M.ghosts) {
    g.t += dt;
    if (!g.fired && g.t >= g.delay) { g.fired = true; M.events.push({ type: 'capture', at: g.cell, code: g.code }); }
  }
  M.ghosts = M.ghosts.filter((g) => g.t < g.delay + CAP_T);
  if (M.enclose) { M.enclose.t += dt; if (!M.enclose.fired && M.enclose.t >= M.enclose.delay) { M.enclose.fired = true; M.events.push({ type: 'enclosed', at: M.enclose.cell }); } }
  if (M.flashT > 0) { M.flashT -= dt; if (M.flashT <= 0) M.flash = -1; }
  if (M.over) {
    M.overT += dt; M.winT += dt;
    if (!M.burst && M.winT >= 0.5) { M.burst = true; M.events.push({ type: 'burst' }); }
  }
  for (const q of M.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 900) * dt; q.vx *= (q.drag ?? 1); q.rot = (q.rot ?? 0) + (q.spin ?? 0) * dt;
    if (q.shape === 'ring') q.size += q.grow * dt;
  }
  M.parts = M.parts.filter((q) => q.life > 0);
  if (M.parts.length > 160) M.parts.splice(0, M.parts.length - 160);

  // Think (the hint): spread over frames
  if (M.hintTask) {
    const r = M.hintTask.gen.next();
    if (r.done) { const fin = M.hintTask.done; M.hintTask = null; fin(r.value); }
  }
  // the opponent
  if (!M.over && !M.auto && !M.freeze && !M.two && M.st.turn !== M.human && (!M.lesson || M.lesson.type === 'game')) {
    M.thinking = true;
    if (!M.task && settled(M)) {
      M.aiT -= dt;
      if (M.aiT <= 0) M.task = thinkTask(M.st, M.level, rng);
    }
    if (M.task) {
      const r = M.task.next();
      if (r.done) { const mv = r.value; M.task = null; if (mv) playMove(M, mv); }
    }
  }
}

// Spawn particles at a point (virtual units). Local only: nothing here moves the board.
export function spawn(M, rng, x, y, who, kind) {
  const col = `rgba(${M.pal[who] ?? M.pal[1]},1)`;
  if (kind === 'land') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 12, grow: 120, w: 3, life: 0.4, max: 0.4, color: 'rgba(255,246,220,0.9)' });
  } else if (kind === 'capture') {
    for (let i = 0; i < 12; i++) {
      const a = rng.next() * Math.PI * 2, sp = 60 + rng.next() * 220;
      M.parts.push({ shape: i % 3 ? 'dot' : 'glint', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 50, g: 300, drag: 0.985, size: 3 + rng.next() * 6, rot: rng.next() * 3, life: 0.6 + rng.next() * 0.6, max: 1.2, color: i % 2 ? col : 'rgba(255,248,226,1)' });
    }
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 16, grow: 240, w: 5, life: 0.5, max: 0.5, color: col });
  } else if (kind === 'win') {
    for (let i = 0; i < 20; i++) {
      const a = rng.next() * Math.PI * 2, sp = 120 + rng.next() * 340;
      M.parts.push({ shape: i % 3 ? 'glint' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, g: 640, drag: 0.992, size: 5 + rng.next() * 7, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 8, life: 1.2 + rng.next() * 0.8, max: 2, color: i % 2 ? col : 'rgba(255,232,170,1)' });
    }
  }
}
export { other };
