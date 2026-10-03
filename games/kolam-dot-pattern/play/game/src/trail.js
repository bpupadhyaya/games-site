// The player's line: an open trail of arcs that grows from the glowing tip. Each time the tip passes through a gate for the first
// time the player decides it (touch or cross); a gate with a mark on it is already decided. The trail never changes the board: it only
// records arcs and the gate states they decide. Pure and deterministic.
import { partnerNode } from './board.js';
import { complete } from './solver.js';

export function newTrail(B, givens = null) {
  const giv = new Int8Array(B.gates.length).fill(-1);
  const dec = new Int8Array(B.gates.length).fill(-1);
  B.gates.forEach((g, i) => { if (g.ghost) { giv[i] = 0; dec[i] = 0; } });
  if (givens) for (const k of Object.keys(givens)) giv[Number(k)] = givens[k];
  return { B, giv, dec, arcs: [], dirs: [], decAt: [], alt: [], used: new Uint8Array(B.nArc), closed: false };
}

export const stateOf = (T, g) => (T.giv[g] >= 0 ? T.giv[g] : T.dec[g]);
export const tailNode = (T) => (T.arcs.length ? T.arcs[0] * 2 + T.dirs[0] : -1);
export const headNode = (T) => { const n = T.arcs.length - 1; return n < 0 ? -1 : T.arcs[n] * 2 + (1 - T.dirs[n]); };
export const headGate = (T) => (T.arcs.length ? T.B.gateOfNode[headNode(T)] : -1);

export function cloneTrail(T) {
  return { ...T, dec: Int8Array.from(T.dec), arcs: T.arcs.slice(), dirs: T.dirs.slice(), decAt: T.decAt.slice(), alt: T.alt.slice(), used: Uint8Array.from(T.used) };
}

export function startTrail(T, arc, dir) {
  T.arcs = [arc]; T.dirs = [dir]; T.decAt = [-1]; T.alt = [false]; T.used.fill(0); T.used[arc] = 1; T.closed = false;
  T.dec.fill(-1); T.B.gates.forEach((g, i) => { if (g.ghost) T.dec[i] = 0; });
}

// Where the tip can go next: [{ arc, dir, s, gate, closing, valid }]. A closing option joins the tip back to the start of the line.
export function exits(T) {
  if (!T.arcs.length) return [];
  const B = T.B, h = headNode(T), g = B.gateOfNode[h], G = B.gates[g];
  const st = stateOf(T, g);
  const out = [];
  for (const s of st >= 0 ? [st] : [0, 1, 2]) {
    const p = partnerNode(G, h, s);
    if (p < 0) continue;
    const arc = p >> 1, closing = p === tailNode(T);
    out.push({ arc, dir: (p & 1) === 0 ? 0 : 1, s, gate: g, closing, valid: closing || !T.used[arc] });
  }
  return out;
}

export const choicesOf = (opts) => opts.filter((o) => o.valid && !o.closing);

export function commit(T, o, hadChoice = false) {
  if (o.closing) {
    if (T.dec[o.gate] < 0 && T.giv[o.gate] < 0) T.dec[o.gate] = o.s;
    T.closed = T.arcs.length === T.B.nArc;
    return T.closed ? 'closed' : 'early';
  }
  let decided = -1;
  if (T.giv[o.gate] < 0 && T.dec[o.gate] < 0) { T.dec[o.gate] = o.s; decided = o.gate; }
  T.arcs.push(o.arc); T.dirs.push(o.dir); T.decAt.push(decided); T.alt.push(hadChoice); T.used[o.arc] = 1;
  return 'ok';
}

export function popLast(T) {
  if (!T.arcs.length) return null;
  const arc = T.arcs.pop(), dir = T.dirs.pop(), d = T.decAt.pop(); T.alt.pop();
  T.used[arc] = 0; T.closed = false;
  if (d >= 0) T.dec[d] = -1;
  // a closing decision made at the tail gate is released too when the line is reopened
  return { arc, dir };
}

// Pops back to just before the most recent arc that had a real choice (or everything). Returns the number of arcs removed.
export function undoChoice(T) {
  let n = 0;
  while (T.arcs.length) {
    const hadChoice = T.alt[T.arcs.length - 1];
    popLast(T); n++;
    if (hadChoice) break;
  }
  if (T.arcs.length === 0) { T.dec.fill(-1); T.B.gates.forEach((g, i) => { if (g.ghost) T.dec[i] = 0; }); }
  return n;
}

export function decidedArray(T, extra = null) {
  const a = new Int8Array(T.B.gates.length);
  for (let g = 0; g < a.length; g++) a[g] = stateOf(T, g);
  if (extra) a[extra.gate] = extra.s;
  return a;
}

// true when no single line can finish from here (exact search; an unfinished search counts as "possible")
export function doomed(T, extra = null, budget = 30000) {
  const r = complete(T.B, decidedArray(T, extra), { budget });
  return r.count === 0 && r.exhausted;
}

// A full solution (gate states) that fits the trail, or null.
export function completion(T, budget = 100000) {
  const r = complete(T.B, decidedArray(T), { budget });
  return r.solution;
}

// ------------------------------------------------------------------------------------------------ the plan (Think / Watch & Learn)
// From the tip, follows the solution: the next move is the arc at the next choice and the forced arcs after it, up to the next choice.
export function plan(T, S) {
  const B = T.B;
  const W = cloneTrail(T);
  const seg = [];
  let decision = null;
  if (!W.arcs.length) { // the line has not begun: begin at the first arc of the solution
    startTrail(W, 0, 0);
    seg.push({ arc: 0, dir: 0, gate: -1, s: -1, forced: true, start: true });
  }
  for (let guard = 0; guard < B.nArc + 4; guard++) {
    const valid = exits(W).filter((o) => o.valid && !(o.closing && W.arcs.length < B.nArc));
    if (!valid.length) break;
    const choice = valid.length >= 2 && stateOf(W, valid[0].gate) < 0;
    let pick = valid[0];
    if (choice) {
      pick = valid.find((o) => S[o.gate] === o.s) ?? valid[0];
      if (seg.length) break; // the next decision belongs to the next move
      decision = { gate: pick.gate, chosen: pick, others: valid.filter((o) => o !== pick) };
    }
    if (pick.closing) { seg.push({ ...pick, forced: true }); break; }
    commit(W, pick, choice);
    seg.push({ ...pick, forced: !choice, choice });
    if (W.arcs.length === B.nArc) {
      const c = exits(W).find((o) => o.valid && o.closing);
      if (c) { seg.push({ ...c, forced: true }); }
      break;
    }
  }
  return { seg, decision, result: W };
}

export const encodeTrail = (T) => ({ a: T.arcs.slice(), d: T.dirs.join('') });

// Rebuilds a trail from a save; returns null if it no longer fits the puzzle.
export function decodeTrail(B, givens, sv) {
  if (!sv || !Array.isArray(sv.a) || typeof sv.d !== 'string' || sv.a.length !== sv.d.length) return null;
  const T = newTrail(B, givens);
  if (!sv.a.length) return T;
  const a0 = sv.a[0];
  if (!Number.isInteger(a0) || a0 < 0 || a0 >= B.nArc) return null;
  startTrail(T, a0, sv.d[0] === '1' ? 1 : 0);
  for (let i = 1; i < sv.a.length; i++) {
    const opts = exits(T);
    const o = opts.find((q) => q.valid && !q.closing && q.arc === sv.a[i] && q.dir === (sv.d[i] === '1' ? 1 : 0));
    if (!o) return null;
    commit(T, o, choicesOf(opts).length >= 2);
  }
  return T;
}
