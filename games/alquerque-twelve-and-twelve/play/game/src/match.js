// One game in progress: the position, its move history, and the short-lived animation state (pieces stepping and leaping,
// captured pieces fading, sparks). All timing uses dt; randomness comes only from the rng passed in. The board itself never moves:
// only pieces, rings and sparks do.
import { startState, applyMove, legalMoves, mustCapture, forwardOf, other, NN } from './rules.js';
import { thinkTask } from './ai.js';

export const STEP_T = 0.34, JUMP_T = 0.5, CAP_AT = 0.24, CAP_T = 0.5;

export function createMatch(o) {
  const st = o.start ? { ...o.start, cells: o.start.cells.slice() } : startState();
  return {
    level: o.level ?? 'skilled', human: o.human ?? 1, two: Boolean(o.two), lesson: o.lesson ?? null, auto: Boolean(o.auto),
    st, hist: [], sel: -1, cur: 12, hint: null, hintTask: null, task: null, anim: {}, ghosts: [], parts: [], t: 0, over: null, overT: 0, winT: 0,
    last: null, aiT: 0.7, flash: -1, flashT: 0, events: [], pal: o.pal ?? { 1: '240,225,190', 2: '200,110,60' }, thinking: false,
    freeze: false, gate: null,
  };
}

export const humanTurn = (M) => !M.over && !M.auto && (M.two || M.st.turn === M.human);
export const settled = (M) => !M.ghosts.length && Object.values(M.anim).every((a) => a.t >= (a.kind === 'jump' ? JUMP_T : STEP_T));

// Index into the history of the start of the human's most recent turn (any player's most recent turn in two-player mode).
export function undoTarget(M) {
  let idx = M.hist.length;
  while (idx > 0) {
    let g = idx - 1;
    const tn = M.hist[g].st.tn;
    while (g > 0 && M.hist[g - 1].st.tn === tn) g--;
    if (M.two || M.hist[g].st.turn === M.human) return g;
    idx = g;
  }
  return -1;
}
export const canUndo = (M) => !M.over && !M.auto && !M.lesson && !M.freeze && (M.two || M.st.turn === M.human) && undoTarget(M) >= 0;

export function undoMatch(M) {
  if (!canUndo(M)) return false;
  const g = undoTarget(M);
  M.st = M.hist[g].st;
  M.hist.length = g;
  M.anim = {}; M.ghosts = []; M.sel = -1; M.hint = null; M.hintTask = null; M.task = null; M.thinking = false;
  M.last = M.st.last ?? null; M.over = null; M.aiT = 0.5;
  M.events.push({ type: 'undo' });
  return true;
}

export const targetsOf = (M) => {
  const from = M.sel >= 0 ? M.sel : M.st.chain;
  if (from < 0) return [];
  return legalMoves(M.st).filter((m) => m.from === from);
};

// Make a move (already known to be legal). Returns the new state's `over`, if the game ended.
export function playMove(M, mv, silent = false) {
  const before = M.st;
  M.hist.push({ st: before, mv });
  M.st = applyMove(before, mv);
  M.sel = -1; M.hint = null; M.hintTask = null; M.last = M.st.last; M.thinking = false; M.task = null;
  const who = before.turn;
  if (!silent) {
    const jump = mv.cap >= 0;
    for (const k of Object.keys(M.anim)) if (Number(k) === mv.from) delete M.anim[k];
    M.anim[mv.to] = { t: 0, kind: jump ? 'jump' : 'step', from: mv.from, who };
    M.events.push({ type: jump ? 'jump' : 'step', who, at: mv.to, from: mv.from });
    if (jump) { M.ghosts.push({ cell: mv.cap, who: other(who), t: 0, fired: false }); M.events.push({ type: 'capturing' }); }
  }
  if (M.st.over) {
    M.over = M.st.over; M.overT = 0; M.winT = 0;
    M.events.push({ type: 'end', winner: M.over.winner, why: M.over.why });
  } else M.aiT = M.st.chain >= 0 ? 0.3 : 0.55;
  return M.over;
}

// A tap on a point by the player whose turn it is. Returns 'move' | 'select' | 'deselect' | 'refuse' | null.
export function tapPoint(M, i) {
  if (!humanTurn(M) || M.freeze) return null;
  const st = M.st;
  const moves = legalMoves(st);
  if (st.chain >= 0) {
    const mv = moves.find((m) => m.to === i);
    if (mv) { if (M.gate && !M.gate(mv)) return 'refuse'; playMove(M, mv); return 'move'; }
    refuse(M, i, 'chain'); return 'refuse';
  }
  if (st.cells[i] === st.turn) {
    if (M.sel === i) { M.sel = -1; return 'deselect'; }
    if (moves.some((m) => m.from === i)) { M.sel = i; M.hint = null; M.events.push({ type: 'select' }); return 'select'; }
    refuse(M, i, mustCapture(st) ? 'must' : 'stuck'); return 'refuse';
  }
  if (M.sel >= 0) {
    const mv = moves.find((m) => m.from === M.sel && m.to === i);
    if (mv) { if (M.gate && !M.gate(mv)) return 'refuse'; playMove(M, mv); return 'move'; }
    if (mustCapture(st)) { refuse(M, i, 'must'); return 'refuse'; }
    if (st.cells[i] === 0) {
      const [r0, c0] = [Math.floor(M.sel / 5), M.sel % 5], [r1] = [Math.floor(i / 5)];
      void c0;
      refuse(M, i, (r1 - r0) * forwardOf(st.turn) < 0 ? 'back' : 'far'); return 'refuse';
    }
  }
  if (st.cells[i] === 0) { refuse(M, i, mustCapture(st) ? 'must' : 'pick'); return 'refuse'; }
  refuse(M, i, 'foe'); return 'refuse';
}
function refuse(M, i, why) { M.flash = i; M.flashT = 0.45; M.events.push({ type: 'refuse', why }); }

export function stepMatch(M, dt, rng) {
  M.t += dt;
  for (const k of Object.keys(M.anim)) {
    const a = M.anim[k]; a.t += dt;
    const dur = a.kind === 'jump' ? JUMP_T : STEP_T;
    if (!a.landed && a.t >= dur * 0.85) { a.landed = true; M.events.push({ type: 'land', at: Number(k), who: a.who, kind: a.kind }); }
    if (a.t > 1.2) delete M.anim[k];
  }
  for (const g of M.ghosts) {
    g.t += dt;
    if (!g.fired && g.t >= CAP_AT) { g.fired = true; M.events.push({ type: 'capture', at: g.cell, who: g.who }); }
  }
  M.ghosts = M.ghosts.filter((g) => g.t < CAP_AT + CAP_T);
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
  if (M.parts.length > 200) M.parts.splice(0, M.parts.length - 200);

  // Think (the hint): spread over frames, one root move per frame
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

// Spark particles at a point (virtual units).
export function spawn(M, rng, x, y, who, kind) {
  const col = `rgba(${M.pal[who] ?? M.pal[1]},1)`;
  if (kind === 'land') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 10, grow: 120, w: 3, life: 0.4, max: 0.4, color: 'rgba(240,215,160,1)' });
  } else if (kind === 'capture') {
    for (let i = 0; i < 16; i++) {
      const a = rng.next() * Math.PI * 2, sp = 70 + rng.next() * 240;
      M.parts.push({ shape: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 50, g: 420, drag: 0.985, size: 3 + rng.next() * 4, life: 0.5 + rng.next() * 0.5, max: 1, color: i % 3 ? 'rgba(255,226,160,1)' : col });
    }
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 14, grow: 250, w: 6, life: 0.5, max: 0.5, color: col });
  } else if (kind === 'win') {
    for (let i = 0; i < 20; i++) {
      const a = rng.next() * Math.PI * 2, sp = 140 + rng.next() * 380;
      M.parts.push({ shape: i % 3 ? 'chip' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 240, g: 780, drag: 0.992, size: 4 + rng.next() * 5, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 12, life: 1.2 + rng.next() * 0.8, max: 2, color: i % 2 ? col : 'rgba(255,232,170,1)' });
    }
  }
}
export { NN };
