// One game in progress: the position, the move history and the short-lived animation state (the moving piece, particles,
// the result). All timing uses dt; randomness comes from the rng passed in. A move is committed to the position at once and
// the piece then travels for display only, so taps, Undo, Auto Play and save/Continue all share one path.
import { startState, applyMove, genMoves, result, captureRoute, routePoints, other, countOf } from './rules.js';
import { createSearch } from './ai.js';

export const STEP_T = 0.32;
export const FRAME_NODES = 6000; // nodes of search per frame while the computer thinks

export function createMatch(o) {
  const st = o.start ? { ...o.start, cells: o.start.cells.slice() } : startState();
  return {
    level: o.level ?? 'skilled', human: o.human ?? 1, two: Boolean(o.two), lesson: o.lesson ?? null, auto: Boolean(o.auto),
    st, start: { ...st, cells: st.cells.slice() }, hist: [], sel: -1, hint: null, anim: null, parts: [], t: 0, over: null, overT: 0, winT: 0,
    last: null, aiT: 0.6, thinking: false, search: null, events: [], flash: -1, flashT: 0, shake: 0, msg: '', msgT: 0,
    cur: 14, pal: o.pal ?? { 1: '255,244,200', 2: '255,110,100' }, lm: null, gate: null, freeze: false, autoLv: null,
  };
}

export const movesOf = (M) => {
  if (!M.lm || M.lm.st !== M.st) M.lm = { st: M.st, list: genMoves(M.st.cells, M.st.turn) };
  return M.lm.list;
};
export const settled = (M) => !M.anim;
export const humanTurn = (M) => !M.over && !M.auto && !M.anim && !M.search && (M.two || M.st.turn === M.human);
export const canUndo = (M) => !M.over && !M.auto && !M.lesson && !M.anim && M.hist.some((h) => M.two || h.st.turn === M.human);
export const targetsOf = (M) => (M.sel >= 0 ? movesOf(M).filter((m) => m.from === M.sel) : []);

function routeLen(route) {
  const p = routePoints(route);
  let len = 0;
  for (let i = 1; i < p.length; i++) len += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  return len;
}

// Make a move (already known to be legal). Returns the result when the game ended.
export function playMove(M, mv, silent = false) {
  const before = M.st;
  const who = before.turn;
  const cap = before.cells[mv.to] !== 0;
  let route = null;
  if (cap) route = captureRoute(before.cells, mv.from, mv.to, who);
  M.hist.push({ st: before, mv: { from: mv.from, to: mv.to, cap } });
  M.st = applyMove(before, mv);
  M.sel = -1; M.hint = null; M.last = { from: mv.from, to: mv.to, who, cap }; M.thinking = false; M.search = null; M.msg = '';
  if (!silent) {
    const len = route ? routeLen(route) : 1;
    const dur = cap ? Math.min(2.1, 0.6 + 0.085 * len) : STEP_T;
    M.anim = { from: mv.from, to: mv.to, who, cap, capWho: cap ? other(who) : 0, route, len, dur, t: 0, landed: false };
    M.events.push({ type: cap ? 'whoosh' : 'step', who, dur });
  }
  const r = result(M.st);
  if (r) { M.over = r; M.overT = 0; M.winT = 0; M.pendingEnd = true; if (silent) { M.events.push({ type: 'end', winner: r.winner, why: r.why }); M.pendingEnd = false; } }
  else M.aiT = 0.45;
  return r;
}

export function undoMatch(M) {
  if (!canUndo(M)) return false;
  while (M.hist.length) {
    const h = M.hist.pop();
    M.st = h.st;
    if (M.two || h.st.turn === M.human) break;
  }
  M.anim = null; M.sel = -1; M.hint = null; M.search = null; M.thinking = false; M.over = null; M.aiT = 0.5; M.msg = '';
  M.last = M.hist.length ? { ...M.hist[M.hist.length - 1].mv, who: M.hist[M.hist.length - 1].st.turn } : null;
  M.events.push({ type: 'undo' });
  return true;
}

const say = (M, s) => { M.msg = s; M.msgT = 3; };

// A tap on a point by the player whose turn it is. Returns 'move' | 'select' | 'deselect' | 'refuse' | null.
export function tapPoint(M, i) {
  if (!humanTurn(M)) return null;
  const st = M.st, moves = movesOf(M);
  const v = st.cells[i];
  if (v === st.turn) {
    if (M.sel === i) { M.sel = -1; return 'deselect'; }
    if (moves.some((m) => m.from === i)) { M.sel = i; M.hint = null; M.msg = ''; M.events.push({ type: 'select' }); return 'select'; }
    refuse(M, i, 'That piece has no free point next to it and no capture path.'); return 'refuse';
  }
  if (M.sel >= 0) {
    const mv = moves.find((m) => m.from === M.sel && m.to === i);
    if (mv) { if (M.gate && !M.gate(mv)) return 'refuse'; playMove(M, mv); return 'move'; }
    if (v === 0) { refuse(M, i, 'A piece steps one point to a free neighbour. To go further it must capture along a circuit.'); return 'refuse'; }
    refuse(M, i, 'No capture there: the path must follow a circuit round at least one loop, over empty points.'); return 'refuse';
  }
  if (v !== 0) { refuse(M, i, 'Tap one of your own pieces first.'); return 'refuse'; }
  return null;
}
function refuse(M, i, msg) { M.flash = i; M.flashT = 0.45; M.shake = 0.25; say(M, msg); M.events.push({ type: 'refuse' }); }

export function stepMatch(M, dt, rng) {
  M.t += dt;
  if (M.anim) {
    M.anim.t += dt;
    if (M.anim.t >= M.anim.dur && !M.anim.landed) { M.anim.landed = true; M.events.push({ type: 'land', who: M.anim.who, at: M.anim.to, cap: M.anim.cap, capWho: M.anim.capWho }); }
    if (M.anim.t >= M.anim.dur + 0.05) M.anim = null;
  }
  if (M.flashT > 0) { M.flashT -= dt; if (M.flashT <= 0) M.flash = -1; }
  if (M.msgT > 0) { M.msgT -= dt; if (M.msgT <= 0) M.msg = ''; }
  if (M.shake > 0) M.shake = Math.max(0, M.shake - dt);
  if (M.over && !M.anim) {
    if (M.pendingEnd) { M.pendingEnd = false; M.events.push({ type: 'end', winner: M.over.winner, why: M.over.why }); }
    M.overT += dt; M.winT += dt;
    if (!M.burst && M.winT >= 0.3) { M.burst = true; M.events.push({ type: 'burst' }); }
  }
  for (const q of M.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 900) * dt; q.vx *= (q.drag ?? 1); q.rot = (q.rot ?? 0) + (q.spin ?? 0) * dt;
    if (q.shape === 'ring') q.size += q.grow * dt;
  }
  M.parts = M.parts.filter((q) => q.life > 0);
  if (M.parts.length > 200) M.parts.splice(0, M.parts.length - 200);
  // the opponent thinks in slices of FRAME_NODES so the screen never stalls
  if (!M.over && !M.auto && !M.freeze && !M.two && M.st.turn !== M.human && !M.anim && (!M.lesson || M.lesson.type === 'game')) {
    M.thinking = true;
    if (!M.search) {
      M.aiT -= dt;
      if (M.aiT <= 0) M.search = createSearch(M.st, M.level, rng);
    }
    if (M.search && M.search.step(FRAME_NODES)) {
      const mv = M.search.result().mv;
      M.search = null;
      if (mv) playMove(M, mv);
    }
  }
}

// Spawn particles at a point (screen units).
export function spawn(M, rng, x, y, who, kind) {
  const col = `rgba(${M.pal[who] ?? M.pal[1]},1)`;
  if (kind === 'hit') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 10, grow: 220, w: 6, life: 0.55, max: 0.55, color: col });
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 6, grow: 120, w: 4, life: 0.4, max: 0.4, color: 'rgba(255,255,255,0.9)' });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng.next() * 0.5, sp = 160 + rng.next() * 260;
      M.parts.push({ shape: i % 3 ? 'dot' : 'chip', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 700, drag: 0.99, size: 3 + rng.next() * 4, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 14, life: 0.5 + rng.next() * 0.5, max: 1, color: i % 2 ? col : 'rgba(255,240,200,1)' });
    }
  } else if (kind === 'step') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 8, grow: 110, w: 3, life: 0.4, max: 0.4, color: col });
  } else if (kind === 'win') {
    for (let i = 0; i < 18; i++) {
      const a = rng.next() * Math.PI * 2, sp = 160 + rng.next() * 420;
      M.parts.push({ shape: i % 3 ? 'chip' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, g: 800, drag: 0.992, size: 4 + rng.next() * 5, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 12, life: 1.2 + rng.next() * 0.8, max: 2, color: i % 2 ? col : 'rgba(255,240,190,1)' });
    }
  }
}

export { countOf, other };
