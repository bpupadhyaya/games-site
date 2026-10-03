// A match: the player's line growing from the glowing tip, driven by one finger. Everything is in board units (one dot spacing = 1) so the
// drawing code can scale it freely. Pure and deterministic; sound and effects are reported as events for game.js to play.
import { arcCurve, bezPoint, leaveDir } from './board.js';
import { newTrail, startTrail, exits, commit, popLast, undoChoice, stateOf, headGate, headNode, tailNode, plan, completion, decodeTrail, encodeTrail } from './trail.js';
import { optionProblem, explainRefusal, explainPlan } from './explain.js';

export const COMMIT_AT = 0.88;

export function makeMatch(puz, o = {}) {
  const B = puz.B;
  return {
    puz, B, T: newTrail(B, puz.marks), cur: null, start: null, held: false, disp: 0, shape: new Map(), tipX: 0, tipY: 0,
    flashes: [], parts: [], toast: null, toastT: 0, hint: null, hints: 0, mistakes: 0, undos: 0, fail: null, reveal: null, run: null,
    ev: [], lesson: o.lesson ?? null, daily: Boolean(o.daily), auto: Boolean(o.auto), refused: '', clearArm: 0, wrap: new Float32Array(B.dots.length),
    order: new Int32Array(B.dots.length).fill(-1), notes: 0, version: 0,
  };
}

const stFor = (M, gate, opt = null) => (opt && gate === opt.gate ? opt.s : (() => { const s = stateOf(M.T, gate); return s < 0 ? 0 : s; })());

// the curve (board units) an option would draw, oriented in its direction of travel
export function optCurve(M, o) {
  const a = M.B.arcs[o.arc];
  const c = arcCurve(M.B, a, stFor(M, a.g0, o), stFor(M, a.g1, o));
  return o.dir === 1 ? [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]] : c;
}
// the curve of a drawn arc in its travel direction, with the states known now
export function trailCurve(M, i) {
  const a = M.B.arcs[M.T.arcs[i]];
  const c = arcCurve(M.B, a, stFor(M, a.g0), stFor(M, a.g1));
  return M.T.dirs[i] === 1 ? [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]] : c;
}

// nearest point on a curve to F: { t, d }
export function project(c, F) {
  let best = 0, bd = 1e9;
  const N = 18;
  for (let i = 0; i <= N; i++) { const p = bezPoint(c, i / N); const d = (p[0] - F[0]) ** 2 + (p[1] - F[1]) ** 2; if (d < bd) { bd = d; best = i / N; } }
  let lo = Math.max(0, best - 1 / N), hi = Math.min(1, best + 1 / N);
  for (let k = 0; k < 6; k++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    const p1 = bezPoint(c, m1), p2 = bezPoint(c, m2);
    if ((p1[0] - F[0]) ** 2 + (p1[1] - F[1]) ** 2 < (p2[0] - F[0]) ** 2 + (p2[1] - F[1]) ** 2) hi = m2; else lo = m1;
  }
  const t = (lo + hi) / 2, p = bezPoint(c, t);
  return { t, d: Math.hypot(p[0] - F[0], p[1] - F[1]) };
}

export const len = (M) => M.T.arcs.length;
export const total = (M) => M.B.nArc;
const bump = (M) => { M.version++; };
export const push = (M, k, v = 0) => M.ev.push({ k, v });
export const toast = (M, msg, secs = 2.6) => { M.toast = msg; M.toastT = secs; };

function recount(M) {
  const B = M.B, D = B.D, cnt = new Uint8Array(B.dots.length);
  M.order.fill(-1);
  for (let i = 0; i < M.T.arcs.length; i++) { const d = B.arcs[M.T.arcs[i]].dot; cnt[d]++; if (M.order[d] < 0 || cnt[d] === D) M.order[d] = i; }
  for (let d = 0; d < cnt.length; d++) M.wrap[d] = cnt[d] / D;
}
export const wrappedDots = (M) => { let n = 0; for (const w of M.wrap) if (w >= 0.999) n++; return n; };

// ------------------------------------------------------------------------------------------------ pointer
// F is a point in board units
export function pressAt(M, F, o = {}) {
  if (M.reveal || M.fail || M.run) return;
  M.hint = null;
  M.refused = '';
  if (!M.T.arcs.length && !M.cur) {
    // begin on an arc near the finger; which one is settled by the way the finger moves
    const cands = [];
    for (let a = 0; a < M.B.nArc; a++) {
      const A = M.B.arcs[a];
      if (Math.abs(A.mx - F[0]) > 0.9 || Math.abs(A.my - F[1]) > 0.9) continue;
      const c = arcCurve(M.B, A, stFor(M, A.g0), stFor(M, A.g1));
      const pr = project(c, F);
      if (pr.d < 0.5) cands.push({ arc: a, t0: pr.t, d: pr.d });
    }
    cands.sort((x, y) => x.d - y.d);
    if (cands.length) { M.start = { cands: cands.slice(0, 5), F: [F[0], F[1]], path: [[F[0], F[1]]] }; M.held = true; }
    else toast(M, o.startMsg ?? 'Touch near a dot and drag around it to begin.');
    return;
  }
  if (M.T.closed) return;
  const tip = tipPoint(M);
  if (Math.hypot(tip[0] - F[0], tip[1] - F[1]) < 1.15) { M.held = true; }
  else toast(M, 'Touch the glowing tip to carry on drawing.');
}

export function tipPoint(M) {
  if (M.cur) { const c = M.cur.c ?? curOptCurve(M); const p = bezPoint(c, M.cur.p); return p; }
  if (!M.T.arcs.length) return [M.B.cx, M.B.cy];
  const g = M.B.gates[headGate(M.T)];
  return [g.x, g.y];
}
const curOptCurve = (M) => optCurve(M, M.cur);

const angDiff = (a, b) => { let d = Math.abs(a - b) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d; return d; };

export function dragTo(M, F, check) {
  if (!M.held || M.reveal || M.fail || M.run) return;
  if (M.start) {
    const st = M.start;
    st.path.push([F[0], F[1]]);
    if (st.path.length > 40) st.path.shift();
    const moved = Math.hypot(F[0] - st.F[0], F[1] - st.F[1]);
    if (moved < 0.2) return;
    // the arc that fits the whole stroke so far
    let best = null;
    for (const cd of st.cands) {
      const A = M.B.arcs[cd.arc];
      const c = arcCurve(M.B, A, stFor(M, A.g0), stFor(M, A.g1));
      let sum = 0;
      for (const q of st.path) sum += project(c, q).d;
      const pr = project(c, F), p0 = project(c, st.F);
      if (Math.abs(pr.t - p0.t) < 0.04) continue;
      const score = sum / st.path.length;
      if (!best || score < best.score) best = { cd, pr, p0, score };
    }
    if (!best) return;
    const dir = best.pr.t > best.p0.t ? 0 : 1;
    M.cur = { arc: best.cd.arc, dir, s: -1, gate: -1, p: dir === 0 ? best.pr.t : 1 - best.pr.t, first: true };
    M.cur.c = optCurve(M, M.cur);
    M.start = null;
  }
  for (let iter = 0; iter < 12; iter++) {
    if (!M.cur) {
      if (!M.T.arcs.length || M.T.closed) return;
      if (steer(M, F, check) === 'cur') continue;
      return;
    }
    const pr = project(M.cur.c, F);
    if (pr.d > 1.0) return; // the finger wandered off: wait for it to come back
    M.cur.p = Math.max(0, Math.min(1, pr.t));
    if (pr.t >= COMMIT_AT) { finishArc(M); if (M.fail || M.reveal) return; continue; }
    if (!M.cur.first && !M.cur.choice) { /* a forced arc follows the finger */ }
    const g = M.cur.first ? null : M.B.gates[M.cur.gate];
    const nearGate = g ? Math.hypot(F[0] - g.x, F[1] - g.y) < 0.09 : false;
    if (pr.t < 0.04 || nearGate) { // back at the gate it left
      if (M.cur.first) { if (pr.t < 0.04) { M.cur = null; M.start = null; M.held = false; } return; }
      M.cur = null; bump(M); continue;
    }
    return;
  }
}

// the finger is at the tip's gate with nothing started: start the option it heads into, or take the last arc back
function steer(M, F, check) {
  const T = M.T, G = M.B.gates[headGate(T)];
  const vx = F[0] - G.x, vy = F[1] - G.y, dist = Math.hypot(vx, vy);
  if (dist < 0.12) return 'idle';
  const th = Math.atan2(vy, vx);
  const last = T.arcs.length - 1;
  const lc = trailCurve(M, last);
  const cands = [{ type: 'back', ang: Math.atan2(lc[5] - lc[7], lc[4] - lc[6]) }];
  for (const o of exits(T)) {
    if (!o.valid || o.closing) continue;
    const c = optCurve(M, o);
    cands.push({ type: 'opt', o, ang: Math.atan2(c[3] - c[1], c[2] - c[0]) });
  }
  for (const c of cands) c.d = angDiff(c.ang, th);
  cands.sort((x, y) => x.d - y.d);
  const best = cands[0], second = cands[1];
  const margin = second ? second.d - best.d : 9;
  if (margin < 0.2 && dist < 0.36) return 'idle';
  if (best.type === 'back') {
    const pr = project(lc, F);
    if (pr.t < 0.8 && pr.d < 0.75) return takeBack(M, pr.t) ? 'cur' : 'idle';
    return 'idle';
  }
  if (best.d > 0.75 && dist > 0.3) { blockedFeedback(M, G); return 'idle'; }
  return startOption(M, best.o, F, check) ? 'cur' : 'idle';
}

function startOption(M, o, F, check) {
  const T = M.T;
  const choice = exits(T).filter((q) => q.valid && !q.closing).length >= 2;
  if (choice && check) {
    const key = `${M.version}:${o.arc}:${o.s}`;
    const p = optionProblem(T, o);
    if (p) {
      if (M.refused !== key) {
        M.refused = key; M.mistakes++;
        toast(M, explainRefusal(T, o).why, 4);
        M.flashes.push({ gate: headGate(T), t: 0, life: 1.4, kind: 'bad' });
        push(M, 'refuse');
      }
      return false;
    }
  }
  const c = optCurve(M, o);
  M.cur = { arc: o.arc, dir: o.dir, s: o.s, gate: o.gate, p: Math.max(0.02, project(c, F).t), choice, c, opt: o };
  return true;
}

function takeBack(M, t) {
  const T = M.T;
  const info = popLast(T);
  bump(M); recount(M); push(M, 'erase'); M.hint = null;
  if (!T.arcs.length) {
    M.cur = { arc: info.arc, dir: info.dir, s: -1, gate: -1, p: t, first: true };
    M.cur.c = optCurve(M, M.cur);
    return true;
  }
  const o = exits(T).find((q) => q.arc === info.arc && q.dir === info.dir && q.valid);
  if (!o) return false;
  M.cur = { arc: o.arc, dir: o.dir, s: o.s, gate: o.gate, p: t, choice: false, c: optCurve(M, o), opt: o };
  return true;
}

function blockedFeedback(M, G) {
  const key = `b:${M.version}`;
  if (M.refused === key) return;
  M.refused = key;
  const gi = headGate(M.T);
  const given = M.T.giv[gi];
  M.flashes.push({ gate: gi, t: 0, life: 1.2, kind: 'bad' });
  push(M, 'refuse');
  if (given >= 0) toast(M, `A mark on this gap makes the line ${['wrap round its own dot', 'cross over', 'dip into the gap'][given]}.`, 3);
  else toast(M, 'That way is already drawn.', 2.4);
}

function finishArc(M) {
  const cur = M.cur;
  M.cur = null;
  const T = M.T;
  if (cur.first) {
    startTrail(T, cur.arc, cur.dir);
  } else {
    const had = exits(T).filter((o) => o.valid && !o.closing).length >= 2;
    commit(T, cur.opt, had);
  }
  bump(M); recount(M);
  push(M, 'draw', T.arcs.length);
  afterCommit(M);
}

// the tip has arrived at a gate: close the loop, or notice a dead end
export function afterCommit(M) {
  const T = M.T, B = M.B;
  const opts = exits(T);
  const closing = opts.find((o) => o.closing && o.valid);
  if (T.arcs.length === B.nArc) {
    if (closing) {
      commit(T, closing);
      bump(M);
      M.reveal = { t: 0, notes: 0 };
      M.hint = null; M.held = false; M.cur = null; M.start = null;
      push(M, 'win');
      return 'closed';
    }
  }
  const real = opts.filter((o) => o.valid && !o.closing);
  if (!real.length) {
    M.fail = { t: 0, kind: closing ? 'early' : 'stuck', gate: headGate(T), n: T.arcs.length };
    M.held = false; M.hint = null;
    push(M, 'fail');
    toast(M, closing ? `The line closed after only ${T.arcs.length} of ${B.nArc} arcs.` : 'The line ran into itself: no way on.', 3.2);
    return 'fail';
  }
  return 'ok';
}

export function releaseFinger(M) {
  M.held = false; M.start = null; M.refused = '';
  if (M.cur) {
    if (M.cur.p >= 0.5 || M.cur.p >= COMMIT_AT) { M.cur.p = 1; finishArc(M); }
    else if (M.cur.first) { M.cur = null; }
    else M.cur = null;
  }
}

// ------------------------------------------------------------------------------------------------ buttons
export function undoMove(M) {
  if (M.reveal || M.fail || M.run) return false;
  if (!M.T.arcs.length && !M.cur) return false;
  M.cur = null; M.start = null; M.held = false;
  if (!M.T.arcs.length) return false;
  const n = undoChoice(M.T);
  M.undos++; M.hint = null; bump(M); recount(M);
  push(M, 'undo', n);
  return true;
}
export function clearAll(M) {
  if (M.reveal || M.run) return;
  M.T = newTrail(M.B, M.puz.marks); M.cur = null; M.start = null; M.held = false; M.hint = null; M.fail = null; M.shape.clear(); M.disp = 0;
  bump(M); recount(M); push(M, 'erase');
}

// Think: the next move of a verified complete pattern, with its reason. Returns false when there is nothing to show.
export function think(M, countIt = true) {
  if (M.reveal || M.fail || M.run) return false;
  M.cur = null; M.start = null; M.held = false;
  const T = M.T;
  const S = completion(T, 150000);
  if (!S) { M.hint = { head: 'No way to finish from here', why: 'The exact search finds no single loop that fits what is drawn. Undo a little and try another turn.', seg: [], ring: -1, none: true }; return true; }
  const pl = plan(T, S);
  const ex = explainPlan(T, pl);
  M.hint = { head: ex.head, why: ex.why, ring: ex.ring, seg: segCurves(M, T, pl, S), pl, S };
  if (countIt) M.hints++;
  push(M, 'hint');
  return true;
}

// A hint for the next stretch of a given full solution S (Watch & Learn); does not count as Think.
export function planHint(M, S) {
  const pl = plan(M.T, S);
  const ex = explainPlan(M.T, pl);
  return { head: ex.head, why: ex.why, ring: ex.ring, seg: segCurves(M, M.T, pl, S), pl, S };
}

// the curves of a plan's arcs, drawn with the solution's gate states
function segCurves(M, T, pl, S) {
  const B = M.B;
  const st = (g) => (stateOf(T, g) >= 0 ? stateOf(T, g) : S[g] >= 0 ? S[g] : 0);
  return pl.seg.filter((m) => !m.closing).map((m) => {
    const a = B.arcs[m.arc];
    let c = arcCurve(B, a, m.gate === a.g0 ? m.s : st(a.g0), m.gate === a.g1 ? m.s : st(a.g1));
    return { arc: m.arc, dir: m.dir, c, choice: Boolean(m.choice), start: Boolean(m.start) };
  });
}

// "Do it" / Watch & Learn: draw the planned stretch by itself
export function runPlan(M, pl, speed = 4.5) {
  M.run = { steps: pl.seg.slice(), i: 0, p: 0, speed };
  M.hint = null;
}
export function stepRun(M, dt) {
  const R = M.run;
  if (!R) return;
  const m = R.steps[R.i];
  if (!m) { M.run = null; return; }
  if (m.closing) { R.i++; M.run = null; return; } // the closing join happens by itself when the last arc lands
  if (!M.cur) {
    if (m.start) { M.cur = { arc: m.arc, dir: m.dir, s: -1, gate: -1, p: 0, first: true }; M.cur.c = optCurve(M, M.cur); }
    else {
      const o = exits(M.T).find((q) => q.valid && !q.closing && q.arc === m.arc && q.dir === m.dir);
      if (!o) { M.run = null; return; }
      M.cur = { arc: o.arc, dir: o.dir, s: o.s, gate: o.gate, p: 0, choice: false, c: optCurve(M, o), opt: o };
    }
  }
  M.cur.p = Math.min(1, M.cur.p + R.speed * dt);
  if (M.cur.p >= 1) {
    const r = finishRun(M);
    R.i++;
    if (r === 'closed' || r === 'fail' || R.i >= R.steps.length) M.run = null;
  }
}
function finishRun(M) {
  const cur = M.cur; M.cur = null;
  const T = M.T;
  if (cur.first) startTrail(T, cur.arc, cur.dir);
  else commit(T, cur.opt, exits(T).filter((o) => o.valid && !o.closing).length >= 2);
  bump(M); recount(M); push(M, 'draw', T.arcs.length);
  return afterCommit(M);
}

// ------------------------------------------------------------------------------------------------ per-frame
export function tick(M, dt) {
  // the shapes of drawn arcs ease toward their final form once the gates they pass are decided
  const seqLen = M.T.arcs.length + (M.cur ? 1 : 0);
  const live = new Set();
  const want = (arc, c, instant) => {
    live.add(arc);
    const cp = M.shape.get(arc);
    if (!cp || instant) { M.shape.set(arc, c.slice()); return; }
    const k = 1 - Math.exp(-dt * 16);
    for (let i = 0; i < 8; i++) cp[i] += (c[i] - cp[i]) * k;
  };
  for (let i = 0; i < M.T.arcs.length; i++) {
    const a = M.B.arcs[M.T.arcs[i]];
    want(M.T.arcs[i], arcCurve(M.B, a, stFor(M, a.g0), stFor(M, a.g1)), false);
  }
  if (M.cur) { const a = M.B.arcs[M.cur.arc]; const c = arcCurve(M.B, a, stFor(M, a.g0, M.cur.opt ?? null), stFor(M, a.g1, M.cur.opt ?? null)); want(M.cur.arc, c, !M.shape.has(M.cur.arc)); }
  for (const k of [...M.shape.keys()]) if (!live.has(k)) M.shape.delete(k);
  // display length glides toward the true length
  const target = M.T.arcs.length + (M.cur ? M.cur.p : 0) + (M.T.closed ? 0 : 0);
  const d = target - M.disp;
  M.disp += Math.abs(d) < 0.002 ? d : d * (1 - Math.exp(-dt * (d < 0 ? 18 : 30)));
  // timers
  if (M.toastT > 0) { M.toastT -= dt; if (M.toastT <= 0) M.toast = null; }
  if (M.clearArm > 0) M.clearArm = Math.max(0, M.clearArm - dt);
  for (let i = M.flashes.length - 1; i >= 0; i--) { M.flashes[i].t += dt; if (M.flashes[i].t > M.flashes[i].life) M.flashes.splice(i, 1); }
  for (let i = M.parts.length - 1; i >= 0; i--) { const q = M.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) M.parts.splice(i, 1); }
  if (M.run) stepRun(M, dt);
  if (M.fail) {
    M.fail.t += dt;
    if (M.fail.t > 1.5) {
      const n = undoChoice(M.T);
      const gate = M.T.arcs.length ? headGate(M.T) : -1;
      M.mistakes++; M.fail = null; bump(M); recount(M);
      if (gate >= 0) M.flashes.push({ gate, t: 0, life: 2.2, kind: 'ring' });
      toast(M, 'Back to the last turn. Try a different way here.', 3);
      push(M, 'undo', n);
    }
  }
  if (M.reveal) M.reveal.t += dt;
}

export const progress = (M) => ({ arcs: Math.min(M.T.arcs.length, M.B.nArc), nArc: M.B.nArc, wrapped: wrappedDots(M), dots: M.B.dots.length });
export const saveOf = (M) => (M.T.arcs.length ? { ...encodeTrail(M.T), h: M.hints, m: M.mistakes, u: M.undos } : null);
export function restore(M, sv) {
  const T = decodeTrail(M.B, M.puz.marks, sv);
  if (!T) return false;
  M.T = T; M.hints = sv.h ?? 0; M.mistakes = sv.m ?? 0; M.undos = sv.u ?? 0; M.disp = T.arcs.length; M.shape.clear();
  recount(M); bump(M);
  return true;
}
// for store-screenshot staging and tests: put a trail straight onto the board
export const trailApi = { startTrail, exits, commit };
export function settle(M) {
  recount(M); bump(M); M.disp = M.T.arcs.length; M.shape.clear();
  if (M.T.arcs.length === M.B.nArc) { const c = exits(M.T).find((o) => o.closing && o.valid); if (c) commit(M.T, c); }
}
export { headNode, tailNode, leaveDir };
