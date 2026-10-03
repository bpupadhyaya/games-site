// One game in progress: the position, the throw in flight, the stone in flight and the short-lived display state (particles,
// messages, the result). All timing uses dt; randomness comes from the rng passed in. A throw is decided first and its position
// is applied when the sticks settle; a move is committed to the position at once and the stone then travels for display only, so
// taps, Undo, Auto Play and save/Continue share one path.
import { newGame, settle, applyThrow, applyMove, legalMoves, movesWith, clone, other, extraThrow, FLAT_TO_VALUE, WAIT, HOME, N, sideName } from './rules.js';
import { pickMove } from './ai.js';
import { planThrow, stickPose, impactTimes } from './sticks.js';

export const STEP_T = 1 / 60;

export function createMatch(o = {}) {
  const st = o.start ? clone(o.start) : newGame({ pieces: o.pieces ?? 7, first: o.first ?? 0 });
  return {
    level: o.level ?? 'skilled', human: o.human ?? 0, two: Boolean(o.two), lesson: o.lesson ?? null, auto: Boolean(o.auto), pieces: st.pos[0].length,
    st, log: [], hist: [], sel: null, hint: null, throwAnim: null, lastPlan: null, anim: null, parts: [], t: 0, over: null, overT: 0, winT: 0,
    events: [], flash: null, flashT: 0, msg: '', msgT: 0, aiT: 0.7, thinking: false, force: (o.force ?? []).slice(), pop: null, notice: null,
    pal: o.pal ?? null, freeze: false, lastMove: null, shotMode: false, pendingEnd: false, burst: false,
  };
}

export const isHumanSide = (M, p) => !M.auto && (M.two || p === M.human);
export const humanTurn = (M) => !M.over && !M.anim && !M.throwAnim && isHumanSide(M, M.st.turn);
export const canThrow = (M) => humanTurn(M) && M.st.phase === 'throw';
export const canPlay = (M) => humanTurn(M) && M.st.phase === 'move';
export const movesOf = (M) => {
  if (!M.lm || M.lm.st !== M.st) M.lm = { st: M.st, list: legalMoves(M.st) };
  return M.lm.list;
};
export const settled = (M) => !M.anim && !M.throwAnim;
export const canUndo = (M) => canPlay(M) && !M.lesson && M.hist.length > 0 && isHumanSide(M, M.st.turn);

const say = (M, s, t = 3) => { M.msg = s; M.msgT = t; };
export const flatsOf = (flats) => flats.filter(Boolean).length;

// ---- throwing ---------------------------------------------------------------------------------------------------------
export function startThrow(M, rng) {
  if (M.over || M.throwAnim || M.anim || M.st.phase !== 'throw') return false;
  let flats;
  if (M.force.length) {
    const n = M.force.shift();
    flats = [0, 1, 2, 3].map((i) => i < n);
    for (let i = flats.length - 1; i > 0; i--) { const j = rng.int(i + 1); [flats[i], flats[j]] = [flats[j], flats[i]]; }
  } else flats = [0, 1, 2, 3].map(() => rng.chance(0.5));
  const plan = planThrow(flats, rng);
  M.throwAnim = { plan, t: 0, flats, by: M.st.turn, ticks: plan.sticks.map(() => 0) };
  M.lastPlan = null; M.sel = null; M.hint = null; M.msg = ''; M.hist = []; M.pop = null; M.notice = null;
  M.events.push({ type: 'throw', by: M.st.turn });
  return true;
}

function resolveThrow(M) {
  const A = M.throwAnim, n = flatsOf(A.flats), v = FLAT_TO_VALUE[n];
  const before = M.st;
  M.log.push(['t', n]);
  M.st = applyThrow(before, n);
  M.lastPlan = { plan: A.plan, flats: A.flats };
  M.throwAnim = null;
  M.pop = { v, n, by: before.turn, t: 0, extra: extraThrow(v) };
  const passed = M.st.turn !== before.turn;
  M.events.push({ type: 'value', v, n, by: before.turn, extra: extraThrow(v), passed });
  if (passed) { M.notice = { kind: 'pass', who: before.turn }; M.aiT = 1.1; } else M.aiT = 0.8;
  checkEnd(M);
}

// ---- moving -----------------------------------------------------------------------------------------------------------
export function playMove(M, mv, silent = false) {
  const before = M.st, p = before.turn;
  if (!silent) M.hist.push(before);
  M.log.push(['m', mv.from, mv.to, mv.v]);
  M.st = applyMove(before, mv);
  M.sel = null; M.hint = null; M.thinking = false; M.msg = ''; M.lastMove = { p, from: mv.from, to: mv.to };
  const waitAfter = before.pos[p].filter((x) => x === WAIT).length - (mv.from === WAIT ? 1 : 0);
  const homeBefore = before.pos[p].filter((x) => x === HOME).length;
  if (!silent) {
    const steps = mv.off ? Math.max(1, N - mv.from) : mv.from === WAIT ? 2 : mv.v;
    M.anim = { p, from: mv.from, to: mv.to, v: mv.v, cap: mv.cap, off: Boolean(mv.off), sq: mv.sq, t: 0, dur: Math.min(0.95, 0.34 + 0.075 * steps) + (mv.cap ? 0 : 0), capDur: mv.cap ? 0.6 : mv.off ? 0.3 : 0, waitAfter, homeBefore, landed: false };
    M.events.push({ type: mv.cap ? 'move-cap' : mv.off ? 'move-off' : mv.from === WAIT ? 'move-enter' : 'move', p, dur: M.anim.dur });
  } else M.pendingEnd = M.st.winner >= 0;
  const passed = M.st.turn !== p && M.st.winner < 0;
  if (passed && !silent) M.notice = { kind: 'next', who: M.st.turn };
  M.aiT = 0.65;
  if (silent) checkEnd(M, true); else if (M.st.winner >= 0) { /* the result is shown once the stone has landed */ }
}

function checkEnd(M, silent = false) {
  if (M.st.winner >= 0 && !M.over) { M.over = { winner: M.st.winner }; M.overT = 0; M.winT = 0; M.pendingEnd = !silent; if (silent) M.events.push({ type: 'end', winner: M.st.winner }); }
}

// Undo the last move of the current turn (the counts come back).
export function undoMatch(M) {
  if (!canUndo(M)) return false;
  M.st = M.hist.pop();
  // drop the last move from the log
  for (let i = M.log.length - 1; i >= 0; i--) { if (M.log[i][0] === 'm') { M.log.splice(i, 1); break; } }
  M.sel = null; M.hint = null; M.msg = ''; M.lm = null; M.lastMove = null; M.notice = null; M.over = null;
  M.events.push({ type: 'undo' });
  return true;
}

// ---- a tap on a stone or a square by a human --------------------------------------------------------------------------
// own: position index (-1 = a stone in the yard). Returns 'move' | 'select' | 'deselect' | 'refuse' | null.
export function tapStone(M, pos) {
  if (!canPlay(M)) return null;
  const st = M.st, moves = movesOf(M);
  if (M.sel === pos) { M.sel = null; return 'deselect'; }
  if (moves.some((m) => m.from === pos)) { M.sel = pos; M.hint = null; M.msg = ''; M.events.push({ type: 'select' }); return 'select'; }
  refuse(M, st.pos[st.turn].includes(pos) ? 'refuseNoMove' : 'refuseNoStone');
  return 'refuse';
}

// A tap on a destination square (own position `to`, or HOME). Plays the move when it is unambiguous.
export function tapTarget(M, to, gate) {
  if (!canPlay(M)) return null;
  const moves = movesOf(M);
  let cands = moves.filter((m) => m.to === to);
  if (M.sel !== null && M.sel !== undefined) cands = cands.filter((m) => m.from === M.sel);
  if (!cands.length) return null;
  const from = new Set(cands.map((m) => m.from));
  if (from.size > 1) { refuse(M, 'refuseWho'); return 'refuse'; }
  const mv = cands[0];
  if (gate && !gate(mv)) return 'refuse';
  playMove(M, mv);
  return 'move';
}
export function refuse(M, key) { M.flash = key; M.flashT = 0.45; say(M, key, 3); M.events.push({ type: 'refuse' }); }

// ---- stepping ---------------------------------------------------------------------------------------------------------
export function stepMatch(M, dt, rng) {
  M.t += dt;
  const A = M.throwAnim;
  if (A) {
    A.t += dt;
    A.plan.sticks.forEach((s, i) => {
      const ts = impactTimes(A.plan, i);
      while (A.ticks[i] < ts.length && A.t >= ts[A.ticks[i]]) {
        const k = A.ticks[i]++;
        const pose = stickPose(A.plan, i, ts[k]);
        M.events.push({ type: 'impact', i, k, x: pose.x, y: pose.y, big: k === 0 });
      }
    });
    if (A.t >= A.plan.dur) resolveThrow(M);
  }
  if (M.pop) { M.pop.t += dt; }
  if (M.anim) {
    M.anim.t += dt;
    if (!M.anim.landed && M.anim.t >= M.anim.dur) { M.anim.landed = true; M.events.push({ type: 'land', p: M.anim.p, sq: M.anim.sq, cap: M.anim.cap, off: M.anim.off }); }
    if (M.anim.t >= M.anim.dur + M.anim.capDur + 0.04) { M.anim = null; if (M.st.winner >= 0) checkEnd(M); }
  }
  if (M.flashT > 0) { M.flashT -= dt; if (M.flashT <= 0) M.flash = null; }
  if (M.msgT > 0) { M.msgT -= dt; if (M.msgT <= 0) M.msg = ''; }
  if (M.over && !M.anim && !M.throwAnim) {
    if (M.pendingEnd) { M.pendingEnd = false; M.events.push({ type: 'end', winner: M.over.winner }); }
    M.overT += dt; M.winT += dt;
    if (!M.burst && M.winT >= 0.3) { M.burst = true; M.events.push({ type: 'burst' }); }
  }
  for (const q of M.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 900) * dt; q.vx *= (q.drag ?? 1); q.rot = (q.rot ?? 0) + (q.spin ?? 0) * dt;
    if (q.shape === 'ring' || q.shape === 'dust') q.size += q.grow * dt;
  }
  M.parts = M.parts.filter((q) => q.life > 0);
  if (M.parts.length > 160) M.parts.splice(0, M.parts.length - 160);

  // the computer (and a lesson's opponent) throws and plays
  if (!M.over && !M.auto && !M.freeze && !M.anim && !M.throwAnim && !isHumanSide(M, M.st.turn) && (!M.lesson || M.lesson.type === 'game')) {
    M.thinking = true;
    M.aiT -= dt;
    if (M.aiT <= 0) {
      if (M.st.phase === 'throw') startThrow(M, rng);
      else if (M.st.phase === 'move') {
        const mv = pickMove(M.st, M.level, rng);
        if (mv) playMove(M, mv); else { const s = clone(M.st); s.pending = []; M.st = settle(s); }
      }
    }
  } else if (isHumanSide(M, M.st.turn) || M.over) M.thinking = false;
}

// Spawn particles at a point (screen units).
export function spawn(M, rng, x, y, kind, color = '255,240,200') {
  const col = `rgba(${color},1)`;
  if (kind === 'hit') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 10, grow: 240, w: 6, life: 0.55, max: 0.55, color: col });
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 6, grow: 130, w: 4, life: 0.4, max: 0.4, color: 'rgba(255,255,255,0.9)' });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng.next() * 0.5, sp = 160 + rng.next() * 260;
      M.parts.push({ shape: i % 3 ? 'dot' : 'chip', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 700, drag: 0.99, size: 3 + rng.next() * 4, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 14, life: 0.5 + rng.next() * 0.5, max: 1, color: i % 2 ? col : 'rgba(255,240,200,1)' });
    }
  } else if (kind === 'step') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 8, grow: 120, w: 3, life: 0.4, max: 0.4, color: col });
  } else if (kind === 'dust') {
    M.parts.push({ shape: 'dust', x, y, vx: 0, vy: 0, g: 0, size: 14, grow: 90, life: 0.45, max: 0.45 });
  } else if (kind === 'win') {
    for (let i = 0; i < 18; i++) {
      const a = rng.next() * Math.PI * 2, sp = 160 + rng.next() * 420;
      M.parts.push({ shape: i % 3 ? 'chip' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, g: 800, drag: 0.992, size: 4 + rng.next() * 5, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 12, life: 1.2 + rng.next() * 0.8, max: 2, color: i % 2 ? col : 'rgba(255,240,190,1)' });
    }
  }
}

export { other, sideName, movesWith };
