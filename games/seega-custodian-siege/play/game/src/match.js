// One game in progress: the position, its move history, and the short-lived animation state (stones dropping and sliding,
// captured stones fading, dust). All timing uses dt; randomness comes only from the rng passed in.
import { startState, applyMove, legalMoves, isPlacing, CENTRE, N, NN, other, isEnd, END_MOVE } from './rules.js';
import { thinkTask } from './ai.js';

export const DROP_T = 0.4, SLIDE_T = 0.42, CAP_AT = 0.34, CAP_T = 0.55;

export function createMatch(o) {
  const st = o.start ? { ...o.start, cells: o.start.cells.slice(), placed: o.start.placed.slice() } : startState();
  return {
    level: o.level ?? 'skilled', human: o.human ?? 1, two: Boolean(o.two), lesson: o.lesson ?? null, auto: Boolean(o.auto),
    st, hist: [], sel: -1, cur: CENTRE, hint: null, hintTask: null, task: null, anim: {}, ghosts: [], parts: [], t: 0, over: null, overT: 0, winT: 0,
    last: null, aiT: 0.7, shake: 0, flash: -1, flashT: 0, events: [], pal: o.pal ?? { 1: '240,225,190', 2: '200,110,60' }, thinking: false, notice: null, noticeT: 0,
    freeze: false, lessonDone: false, turnCaps: 0,
  };
}

export const humanTurn = (M) => !M.over && !M.auto && (M.two || M.st.turn === M.human);
export const settled = (M) => !M.ghosts.length && Object.values(M.anim).every((a) => a.t >= (a.kind === 'slide' ? SLIDE_T : DROP_T));

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
  M.last = M.st.last ?? null; M.over = null; M.aiT = 0.5; M.notice = null;
  M.events.push({ type: 'undo' });
  return true;
}

export const targetsOf = (M) => {
  if (M.st.phase !== 'move' || M.sel < 0) return [];
  return legalMoves(M.st).filter((m) => m.from === M.sel).map((m) => m.to);
};
// What sliding the selected stone to `to` would capture (shown before the player commits).
export const previewCaps = (M, to) => (M.sel >= 0 ? applyMove(M.st, { from: M.sel, to }).last.captured : []);

// Make a move (already known to be legal). Returns the new state's `over`, if the game ended.
export function playMove(M, mv, silent = false) {
  const before = M.st;
  M.hist.push({ st: before, mv });
  M.st = applyMove(before, mv);
  const last = M.st.last;
  M.sel = -1; M.hint = null; M.hintTask = null; M.last = last; M.thinking = false; M.task = null;
  if (!silent) {
    if (before.phase === 'place') {
      M.anim[mv.to] = { t: 0, kind: 'drop', who: before.turn };
      M.events.push({ type: 'place', who: before.turn, at: mv.to });
    } else if (isEnd(mv)) {
      M.events.push({ type: 'endturn', who: before.turn });
    } else {
      M.anim[mv.to] = { t: 0, kind: 'slide', from: mv.from, who: before.turn };
      delete M.anim[mv.from];
      M.events.push({ type: 'slide', who: before.turn, at: mv.to, from: mv.from });
      if (last.captured.length) {
        for (const c of last.captured) M.ghosts.push({ cell: c, who: other(before.turn), t: 0, fired: false });
        M.events.push({ type: 'capturing', n: last.captured.length });
      }
    }
    if (last.passed) { M.notice = { who: last.passed }; M.noticeT = 3.2; M.events.push({ type: 'pass', who: last.passed }); }
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
  const moves = legalMoves(st);
  if (isPlacing(st)) {
    const mv = moves.find((m) => m.to === i);
    if (!mv) { refuse(M, i, i === CENTRE ? 'centre' : 'taken'); return 'refuse'; }
    if (M.gate && !M.gate(mv)) return 'refuse';
    playMove(M, mv);
    return 'move';
  }
  if (st.chain >= 0) {
    if (i === st.chain) { if (M.gate && !M.gate(END_MOVE)) return 'refuse'; playMove(M, { ...END_MOVE }); return 'move'; }
    const mv = moves.find((m) => m.to === i && m.from === st.chain);
    if (mv) { if (M.gate && !M.gate(mv)) return 'refuse'; playMove(M, mv); return 'move'; }
    refuse(M, i, 'chain'); return 'refuse';
  }
  if (st.cells[i] === st.turn) {
    if (M.sel === i) { M.sel = -1; return 'deselect'; }
    if (moves.some((m) => m.from === i)) { M.sel = i; M.hint = null; M.events.push({ type: 'select' }); return 'select'; }
    refuse(M, i, 'stuck'); return 'refuse';
  }
  if (M.sel >= 0) {
    const mv = moves.find((m) => m.from === M.sel && m.to === i);
    if (mv) { if (M.gate && !M.gate(mv)) return 'refuse'; playMove(M, mv); return 'move'; }
  }
  refuse(M, i, st.cells[i] === 0 ? 'far' : 'foe'); return 'refuse';
}
function refuse(M, i, why) { M.flash = i; M.flashT = 0.45; M.shake = 0.3; M.events.push({ type: 'refuse', why }); }

export function stepMatch(M, dt, rng) {
  M.t += dt;
  for (const k of Object.keys(M.anim)) {
    const a = M.anim[k]; a.t += dt;
    if (!a.landed && a.t >= (a.kind === 'slide' ? SLIDE_T * 0.85 : 0.24)) { a.landed = true; M.events.push({ type: 'land', at: Number(k), who: a.who, kind: a.kind }); }
    if (a.t > 1.2) delete M.anim[k];
  }
  for (const g of M.ghosts) {
    g.t += dt;
    if (!g.fired && g.t >= CAP_AT) { g.fired = true; M.events.push({ type: 'capture', at: g.cell, who: g.who }); }
  }
  M.ghosts = M.ghosts.filter((g) => g.t < CAP_AT + CAP_T);
  if (M.flashT > 0) { M.flashT -= dt; if (M.flashT <= 0) M.flash = -1; }
  if (M.noticeT > 0) { M.noticeT -= dt; if (M.noticeT <= 0) M.notice = null; }
  if (M.shake > 0) M.shake = Math.max(0, M.shake - dt);
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

  // Think (the hint): spread over frames, one candidate per frame
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

// Spawn particles at a point (virtual units).
export function spawn(M, rng, x, y, who, kind) {
  const col = `rgba(${M.pal[who] ?? M.pal[1]},1)`;
  if (kind === 'land') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 10, grow: 130, w: 4, life: 0.45, max: 0.45, color: 'rgba(235,205,150,1)' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng.next() * 0.6, sp = 90 + rng.next() * 120;
      M.parts.push({ shape: 'dot', x, y: y + 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 40, g: 380, size: 2.5 + rng.next() * 3, life: 0.45 + rng.next() * 0.3, max: 0.75, color: 'rgba(226,196,140,1)' });
    }
  } else if (kind === 'capture') {
    for (let i = 0; i < 18; i++) {
      const a = rng.next() * Math.PI * 2, sp = 70 + rng.next() * 260;
      M.parts.push({ shape: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 70, g: 420, drag: 0.985, size: 3 + rng.next() * 5, life: 0.6 + rng.next() * 0.6, max: 1.2, color: i % 3 ? 'rgba(220,186,128,1)' : col });
    }
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 14, grow: 260, w: 6, life: 0.5, max: 0.5, color: col });
  } else if (kind === 'win') {
    for (let i = 0; i < 22; i++) {
      const a = rng.next() * Math.PI * 2, sp = 140 + rng.next() * 380;
      M.parts.push({ shape: i % 3 ? 'chip' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 240, g: 780, drag: 0.992, size: 4 + rng.next() * 5, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 12, life: 1.2 + rng.next() * 0.8, max: 2, color: i % 2 ? col : 'rgba(255,232,170,1)' });
    }
  }
}

export { N, NN };
