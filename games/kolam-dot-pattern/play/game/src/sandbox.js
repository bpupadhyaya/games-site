// The Sandbox: free drawing of arcs with mirror symmetry, no goal. Pure state + logic; drawing is in view.js.
import { buildBoard, arcCurve, loopSeq } from './board.js';
import { dotsOf } from './shapes.js';
import { modesOf, copiesOf } from './symmetry.js';
import { solve, solveSymmetric } from './solver.js';
import { project } from './play.js';

export const SB_GRIDS = [
  { lat: 'sq', shape: ['rect', 5, 5], label: 'Square 5' }, { lat: 'sq', shape: ['rect', 7, 7], label: 'Square 7' },
  { lat: 'di', shape: ['rect', 5, 5], label: 'Diamond 5' }, { lat: 'di', shape: ['rect', 7, 7], label: 'Diamond 7' },
  { lat: 'hx', shape: ['hex', 3], label: 'Staggered 3' }, { lat: 'hx', shape: ['hex', 4], label: 'Staggered 4' },
  { lat: 'sq', shape: ['dia', 4], label: 'Diamond block' }, { lat: 'sq', shape: ['plus', 7, 3], label: 'Cross' },
];

export function makeSandbox(gridIdx = 0) {
  const g = SB_GRIDS[gridIdx] ?? SB_GRIDS[0];
  const B = buildBoard({ lat: g.lat, dots: dotsOf(g.shape) });
  const modes = [null, ...modesOf(B).filter((m) => !m.hidden)];
  return { gridIdx, B, modes, modeIdx: 0, drawn: new Uint8Array(B.nArc), born: new Float32Array(B.nArc), erase: false, undo: [], stroke: null, last: null, t: 0, wrapped: 0, states: null, version: 0 };
}

export const modeOf = (SB) => SB.modes[SB.modeIdx];
export const modeLabel = (SB) => (SB.modeIdx === 0 ? 'Off' : SB.modes[SB.modeIdx].label);

// Infers each gate's state from the arcs drawn around it so crossings and dips take shape as you draw.
export function inferStates(SB) {
  const B = SB.B, st = new Int8Array(B.gates.length);
  for (let g = 0; g < B.gates.length; g++) {
    const G = B.gates[g];
    if (G.ghost) continue;
    const d = [G.pi, G.mi, G.pj, G.mj].map((n) => SB.drawn[n >> 1]);
    const hug = (d[0] && d[1] ? 1 : 0) + (d[2] && d[3] ? 1 : 0);
    const cross = (d[0] && d[2] ? 1 : 0) + (d[1] && d[3] ? 1 : 0);
    const cup = (d[0] && d[3] ? 1 : 0) + (d[1] && d[2] ? 1 : 0);
    st[g] = cross >= hug && cross >= cup ? 1 : cup > hug ? 2 : 0;
  }
  return st;
}

export function curves(SB) {
  if (!SB.states || SB.statesV !== SB.version) { SB.states = inferStates(SB); SB.statesV = SB.version; }
  const B = SB.B, out = [];
  for (let a = 0; a < B.nArc; a++) {
    if (!SB.drawn[a]) continue;
    const A = B.arcs[a];
    out.push({ arc: a, dir: 0, c: arcCurve(B, A, SB.states[A.g0], SB.states[A.g1]), born: SB.born[a] });
  }
  return out;
}

export function countWrapped(SB) {
  const B = SB.B; let n = 0;
  for (let i = 0; i < B.dots.length; i++) { let all = true; for (let k = 0; k < B.D; k++) if (!SB.drawn[i * B.D + k]) { all = false; break; } if (all) n++; }
  return n;
}
export const drawnCount = (SB) => { let n = 0; for (const v of SB.drawn) if (v) n++; return n; };

function setArc(SB, arc, on, changed) {
  for (const a of copiesOf(modeOf(SB), arc)) if (SB.drawn[a] !== (on ? 1 : 0)) { SB.drawn[a] = on ? 1 : 0; SB.born[a] = SB.t; changed.push(a); }
}

export function pressSb(SB, F) { SB.stroke = { changed: [], mode: null }; SB.last = null; return strokeTo(SB, F); }
export function moveSb(SB, F) { return strokeTo(SB, F); }
export function releaseSb(SB) {
  const st = SB.stroke; SB.stroke = null; SB.last = null;
  if (st && st.changed.length) { SB.undo.push(st.changed.map((a) => [a, SB.drawn[a] ? 0 : 1])); if (SB.undo.length > 60) SB.undo.shift(); SB.wrapped = countWrapped(SB); return true; }
  return false;
}

function strokeTo(SB, F) {
  if (!SB.stroke) return null;
  const pts = [];
  if (SB.last) { const dx = F[0] - SB.last[0], dy = F[1] - SB.last[1], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.12)); for (let i = 1; i <= n; i++) pts.push([SB.last[0] + (dx * i) / n, SB.last[1] + (dy * i) / n]); } else pts.push(F);
  SB.last = F;
  const B = SB.B; let hit = null;
  for (const p of pts) {
    let best = null;
    for (let a = 0; a < B.nArc; a++) {
      const A = B.arcs[a];
      if (Math.abs(A.mx - p[0]) > 0.8 || Math.abs(A.my - p[1]) > 0.8) continue;
      const pr = project(arcCurve(B, A, SB.states ? SB.states[A.g0] : 0, SB.states ? SB.states[A.g1] : 0), p);
      if (pr.d < 0.3 && (!best || pr.d < best.d)) best = { a, d: pr.d };
    }
    if (!best) continue;
    const st = SB.stroke;
    if (st.mode === null) st.mode = SB.erase ? 'erase' : SB.drawn[best.a] ? 'erase' : 'draw';
    const before = st.changed.length;
    setArc(SB, best.a, st.mode === 'draw', st.changed);
    if (st.changed.length > before) { hit = { arc: best.a, mode: st.mode }; SB.version++; }
  }
  return hit;
}

export function undoSb(SB) {
  const last = SB.undo.pop();
  if (!last) return false;
  for (const [a, v] of last) { SB.drawn[a] = v; SB.born[a] = SB.t - 5; }
  SB.version++; SB.wrapped = countWrapped(SB);
  return true;
}
export function clearSb(SB) { if (drawnCount(SB)) SB.undo.push(Array.from(SB.drawn.keys()).filter((a) => SB.drawn[a]).map((a) => [a, 1])); SB.drawn.fill(0); SB.version++; SB.wrapped = 0; }

// Weave: a complete one-line pattern (symmetric when a mirror is on), revealed along the line
export function weave(SB, rng) {
  const B = SB.B, mode = modeOf(SB);
  let sol = null;
  if (mode) for (let t = 0; t < 12 && !sol; t++) sol = solveSymmetric(B, mode.orbitGate, rng, { weights: [1, 3, 0.6], budget: 3000 });
  if (!sol) sol = solve(B, {}, { cap: 1, rng, budget: 100000 }).solution;
  if (!sol) return false;
  if (drawnCount(SB)) SB.undo.push(Array.from(SB.drawn.keys()).filter((a) => SB.drawn[a]).map((a) => [a, 1]));
  const seq = loopSeq(B, sol);
  SB.drawn.fill(0);
  seq.forEach((s, i) => { SB.drawn[s.arc] = 1; SB.born[s.arc] = SB.t + (i / seq.length) * 1.6; });
  SB.version++; SB.wrapped = countWrapped(SB);
  return true;
}

export const encodeSb = (SB) => ({ g: SB.gridIdx, m: SB.modeIdx, d: Array.from(SB.drawn).join('') });
export function decodeSb(sv) {
  if (!sv || !Number.isInteger(sv.g) || sv.g < 0 || sv.g >= SB_GRIDS.length) return null;
  const SB = makeSandbox(sv.g);
  if (typeof sv.d === 'string' && sv.d.length === SB.B.nArc) { for (let i = 0; i < sv.d.length; i++) SB.drawn[i] = sv.d[i] === '1' ? 1 : 0; SB.born.fill(-9); SB.states = null; SB.wrapped = countWrapped(SB); }
  if (Number.isInteger(sv.m) && sv.m >= 0 && sv.m < SB.modes.length) SB.modeIdx = sv.m;
  return SB;
}
