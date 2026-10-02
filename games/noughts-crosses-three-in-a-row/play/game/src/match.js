// One game in progress: the position, the move history, and the short-lived animation state (dropping and
// sliding marks, particles, the win line). All timing uses dt; randomness comes from the rng passed in.
import { startState, applyMove, legalMoves, result, keyOf, isPlacing, other, SPECS, countOf } from './rules.js';
import { chooseMove } from './ai.js';

export const DROP_T = 0.42, SLIDE_T = 0.5;

export function createMatch(o) {
  const st = o.start ? { ...o.start, cells: o.start.cells.slice() } : startState(o.mode);
  const M = {
    mode: o.mode, level: o.level ?? 'skilled', human: o.human ?? 1, two: Boolean(o.two), lesson: o.lesson ?? null, auto: Boolean(o.auto),
    st, start: { ...st, cells: st.cells.slice() }, hist: [], seen: {}, sel: -1, cur: Math.floor(SPECS[o.mode].n / 2),
    hint: null, anim: {}, parts: [], t: 0, over: null, overT: 0, winT: 0, last: null, aiT: 0.6, shake: 0, flash: -1, flashT: 0,
    events: [], pal: o.pal ?? { 1: '255,205,120', 2: '120,255,225' }, repeats: 0, thinking: false,
  };
  M.seen[keyOf(st)] = 1;
  return M;
}

export const humanTurn = (M) => !M.over && !M.auto && (M.two || M.st.turn === M.human);
export const settled = (M) => Object.values(M.anim).every((a) => a.t >= (a.kind === 'slide' ? SLIDE_T : DROP_T));
export const canUndo = (M) => !M.over && !M.auto && !M.lesson && M.hist.some((h) => M.two || h.st.turn === M.human);
export const targetsOf = (M) => (M.sel >= 0 ? legalMoves(M.st).filter((m) => m.from === M.sel).map((m) => m.to) : []);

export function recount(M) {
  M.seen = {};
  let s = M.start;
  M.seen[keyOf(s)] = 1;
  for (const h of M.hist) { s = applyMove(s, h.mv); const k = keyOf(s); M.seen[k] = (M.seen[k] ?? 0) + 1; }
}

// Make a move (already known to be legal). Returns the result, if the game ended.
export function playMove(M, mv, silent = false) {
  const before = M.st;
  M.hist.push({ st: before, mv });
  M.st = applyMove(before, mv);
  const k = keyOf(M.st);
  M.seen[k] = (M.seen[k] ?? 0) + 1;
  M.sel = -1; M.hint = null; M.last = mv; M.thinking = false;
  if (!silent) {
    M.anim[mv.to] = { t: 0, kind: mv.from >= 0 ? 'slide' : 'drop', from: mv.from, who: before.turn };
    if (mv.from >= 0) delete M.anim[mv.from];
    M.events.push({ type: mv.from >= 0 ? 'slide' : 'place', who: before.turn, at: mv.to, from: mv.from });
  }
  let r = result(M.st);
  if (!r && M.seen[k] >= 3) r = { winner: 0, line: null, why: 'repeat' };
  if (r) {
    M.over = r; M.overT = 0; M.winT = 0;
    M.events.push({ type: 'end', winner: r.winner, why: r.why });
  } else M.aiT = 0.45;
  return r;
}

export function undoMatch(M) {
  if (!canUndo(M)) return false;
  while (M.hist.length) {
    const h = M.hist.pop();
    M.st = h.st;
    if (M.two || h.st.turn === M.human) break;
  }
  M.anim = {}; M.sel = -1; M.hint = null; M.last = M.hist.length ? M.hist[M.hist.length - 1].mv : null; M.over = null; M.aiT = 0.5;
  recount(M);
  M.events.push({ type: 'undo' });
  return true;
}

// A tap on a cell by the player whose turn it is. Returns 'move' | 'select' | 'deselect' | 'refuse' | null.
export function tapCell(M, i) {
  if (!humanTurn(M)) return null;
  const st = M.st, sp = SPECS[M.mode];
  const moves = legalMoves(st);
  if (!isPlacing(st) && sp.slide) {
    if (st.cells[i] === st.turn) {
      if (M.sel === i) { M.sel = -1; return 'deselect'; }
      if (moves.some((m) => m.from === i)) { M.sel = i; M.hint = null; M.events.push({ type: 'select' }); return 'select'; }
      refuse(M, i); return 'refuse';
    }
    if (M.sel >= 0) {
      const mv = moves.find((m) => m.from === M.sel && m.to === i);
      if (mv) { if (M.gate && !M.gate(mv)) return 'refuse'; playMove(M, mv); return 'move'; }
    }
    refuse(M, i); return 'refuse';
  }
  const mv = moves.find((m) => m.to === i);
  if (!mv) { refuse(M, i); return 'refuse'; }
  if (M.gate && !M.gate(mv)) return 'refuse';
  playMove(M, mv);
  return 'move';
}
function refuse(M, i) { M.flash = i; M.flashT = 0.45; M.shake = 0.3; M.events.push({ type: 'refuse' }); }

export function stepMatch(M, dt, rng) {
  M.t += dt;
  for (const k of Object.keys(M.anim)) {
    const a = M.anim[k]; a.t += dt;
    if (!a.landed && a.t >= (a.kind === 'slide' ? SLIDE_T * 0.8 : 0.24)) { a.landed = true; M.events.push({ type: 'land', at: Number(k), who: a.who }); }
    if (a.t > 1.2) delete M.anim[k];
  }
  if (M.flashT > 0) { M.flashT -= dt; if (M.flashT <= 0) M.flash = -1; }
  if (M.shake > 0) M.shake = Math.max(0, M.shake - dt);
  if (M.over) {
    M.overT += dt; M.winT += dt;
    if (!M.burst && M.winT >= 0.4) { M.burst = true; M.events.push({ type: 'burst' }); }
  }
  for (const q of M.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 900) * dt; q.vx *= (q.drag ?? 1); q.rot = (q.rot ?? 0) + (q.spin ?? 0) * dt;
    if (q.shape === 'ring') q.size += q.grow * dt;
  }
  M.parts = M.parts.filter((q) => q.life > 0);
  if (M.parts.length > 160) M.parts.splice(0, M.parts.length - 160);
  // the opponent
  if (!M.over && !M.auto && !M.freeze && !M.two && M.st.turn !== M.human && (!M.lesson || M.lesson.type === 'game')) {
    M.thinking = true;
    if (settled(M)) {
      M.aiT -= dt;
      if (M.aiT <= 0) { const mv = chooseMove(M.st, M.level, rng); if (mv) playMove(M, mv); }
    }
  }
}

// Spawn particles at a point (virtual units). Called by the game after it has looked up the cell centre.
export function spawn(M, rng, x, y, who, kind) {
  const col = `rgba(${M.pal[who] ?? M.pal[1]},1)`;
  if (kind === 'land') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 12, grow: 150, w: 5, life: 0.5, max: 0.5, color: col });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng.next() * 0.6, sp = 120 + rng.next() * 160;
      M.parts.push({ shape: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, g: 500, size: 3 + rng.next() * 3, life: 0.5 + rng.next() * 0.3, max: 0.8, color: col });
    }
  } else if (kind === 'win') {
    for (let i = 0; i < 26; i++) {
      const a = rng.next() * Math.PI * 2, sp = 160 + rng.next() * 420;
      M.parts.push({ shape: i % 3 ? 'chip' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, g: 800, drag: 0.992, size: 4 + rng.next() * 5, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 12, life: 1.2 + rng.next() * 0.8, max: 2, color: i % 2 ? col : 'rgba(255,240,190,1)' });
    }
  }
}

export { countOf, other };
