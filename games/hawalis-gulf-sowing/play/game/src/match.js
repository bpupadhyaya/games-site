// One game in progress: the position, the move history, and the animation of a turn. A turn comes from the engine as an ordered
// list of events (pick, drop, capture, end); this file plays that list out as continuous motion: a "hand" glides from
// square to square dropping one stone at a time in a short arc, captured stones fly to the winner's pile. All timing uses dt.
// Nothing here moves the board: only stones and the hand move. Sounds and sparks are reported through M.fx for game.js.
import { startState, play, legalMoves, other, N } from './engine.js';
import { chooseMove } from './ai.js';
import { slotPos, CELLS, CELL_W } from './art.js';

export const DROP_T = 0.3;
const FLY_ARC = 30;

export const fromState = (st) => ({ cells: st.cells.slice(), pd: st.pd.slice() });

export function createMatch(o) {
  const st = o.start ? o.start : startState();
  return {
    st, start: st, hist: [], D: fromState(st), busy: false, A: null, fx: [], parts: [], t: 0, over: null, overT: 0,
    level: o.level ?? 'club', human: o.human ?? 1, two: Boolean(o.two), lesson: o.lesson ?? null, auto: Boolean(o.auto),
    sel: -1, hint: null, last: null, aiT: 0.7, thinking: false, flash: -1, flashT: 0, gate: null, pileTo: [[60, -60], [60, 440]],
    freeze: false, speed: 1, ringT: 0, ringCell: -1, cur: 14,
  };
}

export const humanTurn = (M) => !M.over && !M.busy && !M.auto && !M.freeze && (M.two || M.st.turn === M.human);
export const settled = (M) => !M.busy;
export const canUndo = (M) => !M.over && !M.busy && !M.auto && !M.lesson && M.hist.some((h) => M.two || h.st.turn === M.human);

// Starts the animation of a legal move. silent: just apply it (loading a saved game).
export function startMove(M, mv, silent = false) {
  const before = M.st;
  const { st, ev } = play(before, mv, true);
  M.hist.push({ st: before, mv });
  M.st = st; M.sel = -1; M.hint = null; M.last = mv; M.thinking = false;
  if (silent) { M.D = fromState(st); if (st.over) { M.over = st.over; } return; }
  M.capInfo = null;
  M.A = { ev, i: 0, t: 0, began: false, flights: [], hand: null, pend: Array(N).fill(0), dd: DROP_T, lap: 0 };
  M.busy = true;
}

export function undoMatch(M) {
  if (!canUndo(M)) return false;
  while (M.hist.length) {
    const h = M.hist.pop();
    M.st = h.st;
    if (M.two || h.st.turn === M.human) break;
  }
  M.D = fromState(M.st); M.A = null; M.busy = false; M.sel = -1; M.hint = null; M.over = null; M.aiT = 0.5; M.hand = null;
  M.last = M.hist.length ? M.hist[M.hist.length - 1].mv : null;
  M.fx.push({ t: 'undo' });
  return true;
}

// Tap on a hole: plays it when it is one of the mover's holes with seeds in it. Returns 'play' | 'refuse' | null.
export function tapCell(M, i) {
  if (!humanTurn(M)) return null;
  const mv = legalMoves(M.st).find((m) => m.cell === i);
  if (!mv) { M.flash = i; M.flashT = 0.45; M.fx.push({ t: 'refuse' }); return 'refuse'; }
  if (M.gate && !M.gate(mv)) return 'gate';
  startMove(M, mv);
  return 'play';
}

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// Position (0..1) along a step whose speed ramps up over the first `a` of it and down over the last `b`, constant between.
function trapezoid(u, a, b) {
  const c = 1 / (1 - a / 2 - b / 2);
  if (a > 0 && u < a) return c * u * u / (2 * a);
  if (b > 0 && u > 1 - b) { const w = 1 - u; return 1 - c * w * w / (2 * b); }
  return c * (u - a / 2);
}

function pileTarget(M, who) { return M.pileTo[who - 1]; }

function finishAnim(M) {
  M.D = fromState(M.st); M.A = null; M.busy = false;
  if (M.st.over && !M.over) { M.over = M.st.over; M.overT = 0; M.fx.push({ t: 'over' }); }
  else M.aiT = 0.5;
}

export function stepMatch(M, dt, rng) {
  M.t += dt;
  if (M.flashT > 0) { M.flashT -= dt; if (M.flashT <= 0) M.flash = -1; }
  if (M.ringT > 0) M.ringT -= dt;
  if (M.capT > 0) M.capT -= dt;
  if (M.over) M.overT += dt;
  for (const q of M.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 0) * dt; q.vx *= (q.drag ?? 1); if (q.shape === 'ring') q.size += q.grow * dt; }
  M.parts = M.parts.filter((q) => q.life > 0);
  if (M.parts.length > 120) M.parts.splice(0, M.parts.length - 120);
  if (M.busy && M.A) stepAnim(M, dt);
  // the computer's turn
  if (!M.over && !M.busy && !M.auto && !M.freeze && !M.two && M.st.turn !== M.human && (!M.lesson || M.lesson.type === 'game')) {
    M.thinking = true;
    M.aiT -= dt;
    if (M.aiT <= 0) { const mv = chooseMove(M.st, M.level, rng); if (mv) startMove(M, mv); }
  }
}

function stepAnim(M, dt) {
  const A = M.A, D = M.D;
  if (A.hand) { A.hand.px = A.hand.x; A.hand.py = A.hand.y; }
  // flights
  for (const f of A.flights) {
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.pt = f.t; f.t += dt;
    if (f.t >= f.dur && !f.done) {
      f.done = true;
      if (f.kind === 'drop') { D.cells[f.cell]++; A.pend[f.cell]--; M.fx.push({ t: 'land', cell: f.cell, k: f.k }); ring(M, f.to[0], f.to[1]); }
      else if (f.kind === 'pile') { D.pd[f.who - 1] += f.dan; if (f.last) M.fx.push({ t: 'pileclink', who: f.who }); }
      else if (f.kind === 'sweep') { D.pd[f.who - 1] += f.dan; }
    }
  }
  A.flights = A.flights.filter((f) => !f.done);
  const airborne = (kind) => A.flights.some((f) => !kind || f.kind === kind);
  if (A.i >= A.ev.length) { if (!A.flights.length) finishAnim(M); return; }
  const e = A.ev[A.i];
  A.t += dt;
  const next = () => { A.i++; A.t = 0; A.began = false; };
  if (e.t === 'pick') {
    const r = CELLS[e.cell];
    if (!A.began) {
      A.began = true; A.from = A.hand ? [A.hand.x, A.hand.y] : [r.cx, r.cy];
      if (!A.hand) A.hand = { x: r.cx, y: r.cy, n: 0, lift: 0 };
      A.lifted = false; A.lap++;
      A.pickT = Math.hypot(A.from[0] - r.cx, A.from[1] - r.cy) > 4 ? 0.3 : 0.12;
    }
    const k = ease(clamp01(A.t / A.pickT));
    A.hand.x = A.from[0] + (r.cx - A.from[0]) * k; A.hand.y = A.from[1] + (r.cy - A.from[1]) * k;
    if (!A.lifted && A.t >= A.pickT) {
      A.lifted = true; D.cells[e.cell] = 0; A.hand.n += e.n; A.lapN = e.n; M.fx.push({ t: 'pick', cell: e.cell, n: e.n });
      A.dd = Math.max(0.17, DROP_T - Math.max(0, e.n - 8) * 0.012);
    }
    if (A.t >= A.pickT + 0.16) next();
  } else if (e.t === 'drop') {
    const r = CELLS[e.cell];
    if (!A.began) {
      A.began = true; A.from = [A.hand.x, A.hand.y]; A.released = false;
      // the hand keeps the same on-screen speed on every step, so a long step (round the corner) takes proportionally longer
      const dist = Math.hypot(r.cx - A.from[0], r.cy - A.from[1]);
      A.cd = Math.max(0.09, Math.min(0.9, dist / (CELL_W / A.dd))) / M.speed;
      // the hand starts from rest on the first step of a lap and settles on the last one; in between it holds one steady speed
      const prevDrop = A.i > 0 && A.ev[A.i - 1].t === 'drop', nextDrop = A.i + 1 < A.ev.length && A.ev[A.i + 1].t === 'drop';
      A.ra = prevDrop ? 0 : 0.35; A.rb = nextDrop ? 0 : 0.35;
    }
    const dd = A.cd;
    const u = clamp01(A.t / dd), k = trapezoid(u, A.ra, A.rb);
    A.hand.x = A.from[0] + (r.cx - A.from[0]) * k; A.hand.y = A.from[1] + (r.cy - A.from[1]) * k;
    if (!A.released && A.t >= dd * 0.55) {
      A.released = true; A.hand.n--;
      const kk = D.cells[e.cell] + A.pend[e.cell];
      A.pend[e.cell]++;
      A.flights.push({ kind: 'drop', cell: e.cell, k: kk, from: [A.hand.x, A.hand.y - 30], to: slotPos(e.cell, kk), t: 0, dur: dd * 0.38 + 0.04, delay: 0, seed: e.cell * 53 + kk });
    }
    if (A.t >= dd) next();
  } else if (e.t === 'capture') {
    if (!A.began) {
      if (airborne('drop')) return;
      A.began = true; A.t = 0;
      const to = pileTarget(M, e.who);
      let jj = 0;
      for (const c of e.cells) {
        const n = D.cells[c], show = Math.min(n, 12);
        for (let j = 0; j < show; j++) {
          const w = Math.floor(n / show) + (j < n % show ? 1 : 0);
          A.flights.push({ kind: 'pile', who: e.who, dan: w, from: slotPos(c, j * Math.max(1, Math.floor(n / show))), to, t: 0, dur: 0.7, delay: 0.1 + jj * 0.035, seed: c * 53 + j, last: false });
          jj++;
        }
        D.cells[c] = 0;
      }
      const lastF = A.flights.filter((f) => f.kind === 'pile'); if (lastF.length) lastF[lastF.length - 1].last = true;
      M.ringCell = e.at; M.ringT = 0.9; M.capCells = e.cells; M.capT = 0.9;
      M.fx.push({ t: 'capture', cell: e.at, cells: e.cells, n: e.n, who: e.who }); M.capInfo = { n: e.n, who: e.who };
      A.waitT = 0;
    }
    if (!A.flights.some((f) => f.kind === 'pile') && A.t > 0.35) next();
  } else if (e.t === 'end') {
    if (airborne()) return;
    next();
  } else next();
}

function ring(M, x, y) {
  M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 6, grow: 70, w: 2.5, life: 0.32, max: 0.32, color: 'rgba(255,235,200,0.9)' });
}

// Sparks at a captured square (board units). Randomness comes from the rng passed in.
export function spark(M, rng, cell, big) {
  const r = CELLS[cell];
  const n = big ? 22 : 10;
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2, sp = 70 + rng.next() * (big ? 260 : 150);
    M.parts.push({ shape: 'dot', x: r.cx, y: r.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 260, drag: 0.985, size: 2.5 + rng.next() * 3, life: 0.5 + rng.next() * 0.5, max: 1, color: big ? 'rgba(255,225,130,1)' : 'rgba(255,240,200,1)' });
  }
  M.parts.push({ shape: 'ring', x: r.cx, y: r.cy, vx: 0, vy: 0, g: 0, size: 14, grow: big ? 260 : 170, w: 5, life: 0.55, max: 0.55, color: big ? 'rgba(255,215,120,1)' : 'rgba(255,240,210,1)' });
}

// Position of an in-flight stone (board units): a straight glide with a lift that peaks mid-flight. Screen speed follows the glide.
export function flightPos(f, alpha = 1) {
  const tt = f.pt === undefined ? f.t : f.pt + (f.t - f.pt) * alpha;
  const k = clamp01(tt / f.dur);
  const e = f.kind === 'drop' ? k : ease(k) * 0.2 + k * 0.8;
  const arc = f.kind === "drop" ? Math.sin(k * Math.PI) * 9 : Math.sin(k * Math.PI) * FLY_ARC * 1.6;
  return [f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e - arc, k];
}
export { other };
