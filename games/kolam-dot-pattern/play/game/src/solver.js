import { PAIRS } from './board.js';
// The Kolam solver: finds the gate states (touch or cross) that make every arc part of ONE closed line. It is exact (backtracking with
// propagation), used to verify every shipped puzzle, to power Think and Watch & Learn, and to explain mistakes. Pure, deterministic.

// A union-find over arcs with rollback. Linking two arc ends that already belong to one component closes a loop; a loop is only
// allowed when it contains every arc.
export class Net {
  constructor(B) {
    this.B = B;
    this.parent = Int32Array.from({ length: B.nArc }, (_, i) => i);
    this.size = new Int32Array(B.nArc).fill(1);
    this.log = []; // child roots, most recent last
    this.states = new Int8Array(B.gates.length).fill(-1);
    this.order = []; // gates assigned, in order
    this.open = B.free.length;
    // ghost gates are fixed
    for (let g = 0; g < B.gates.length; g++) if (B.gates[g].ghost) { this.states[g] = 0; this.apply(g, 0); }
  }
  find(a) { while (this.parent[a] !== a) a = this.parent[a]; return a; }
  link(x, y) { // nodes; returns false if it closes a premature loop
    const a = this.find(x >> 1), b = this.find(y >> 1);
    if (a === b) return this.size[a] === this.B.nArc;
    if (this.size[a] < this.size[b]) { this.parent[a] = b; this.size[b] += this.size[a]; this.log.push(a); } else { this.parent[b] = a; this.size[a] += this.size[b]; this.log.push(b); }
    return true;
  }
  mark() { return this.log.length; }
  rollback(m) {
    while (this.log.length > m) {
      const c = this.log.pop(), p = this.parent[c];
      this.size[p] -= this.size[c]; this.parent[c] = c;
    }
  }
  // joins the two pairs of ends of gate g for state s. Returns false if a premature loop appears (the caller rolls back).
  apply(g, s) {
    const G = this.B.gates[g];
    if (G.ghost) return this.link(G.pi, G.mi);
    const n = [G.pi, G.mi, G.pj, G.mj];
    for (const [x, y] of PAIRS[s]) if (!this.link(n[x], n[y])) return false;
    return true;
  }
  tryAssign(g, s) {
    const m = this.mark();
    if (!this.apply(g, s)) { this.rollback(m); return false; }
    this.states[g] = s; this.order.push(g); this.open--;
    return true;
  }
  undoTo(len, m) {
    while (this.order.length > len) { const g = this.order.pop(); this.states[g] = -1; this.open++; }
    this.rollback(m);
  }
  canAssign(g, s) {
    const m = this.mark();
    const ok = this.apply(g, s);
    this.rollback(m);
    return ok;
  }
  // forces gates whose other state would close a premature loop. Returns false on contradiction (this.bad = the gate where both
  // states close a loop). `why` collects { gate, state }.
  propagate(why) {
    this.bad = -1;
    let changed = true;
    while (changed) {
      changed = false;
      for (const g of this.B.free) {
        if (this.states[g] >= 0) continue;
        let only = -1, n = 0;
        for (let s = 0; s < 3; s++) if (this.canAssign(g, s)) { n++; only = s; }
        if (n === 0) { this.bad = g; return false; }
        if (n === 1) {
          if (why) why.push({ gate: g, state: only });
          if (!this.tryAssign(g, only)) return false;
          changed = true;
        }
      }
    }
    return true;
  }
}

const shuffle3 = (rng) => { const a = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function lockGivens(net, givens) {
  for (const k of Object.keys(givens)) if (!net.tryAssign(Number(k), givens[k])) return false;
  return true;
}

// Counts solutions (up to `cap`) with `givens` = { gate: state }. Returns { count, nodes, solution, exhausted }.
export function solve(B, givens = {}, o = {}) {
  const cap = o.cap ?? 2, budget = o.budget ?? 200000, rng = o.rng ?? null;
  const net = o.net ?? new Net(B);
  const out = { count: 0, nodes: 0, solution: null, exhausted: true };
  if (!o.net && !lockGivens(net, givens)) return out;
  const pick = () => { for (const g of B.free) if (net.states[g] < 0) return g; return -1; };
  const rec = () => {
    if (out.count >= cap || !out.exhausted) return;
    if (++out.nodes > budget) { out.exhausted = false; return; }
    const len = net.order.length, m = net.mark();
    if (!net.propagate()) { net.undoTo(len, m); return; }
    const g = pick();
    if (g < 0) {
      out.count++;
      if (!out.solution) out.solution = Array.from(net.states);
      net.undoTo(len, m);
      return;
    }
    const vals = rng ? shuffle3(rng) : [0, 1, 2];
    for (const s of vals) {
      const l2 = net.order.length, m2 = net.mark();
      if (net.tryAssign(g, s)) rec();
      net.undoTo(l2, m2);
      if (out.count >= cap || !out.exhausted) break;
    }
    net.undoTo(len, m);
  };
  rec();
  return out;
}

export const countSolutions = (B, givens, cap = 2, budget = 200000) => solve(B, givens, { cap, budget });

// Assigns the gate states a partial trail has decided, then looks for a completion. `decided[g]` is -1 when undecided.
export function complete(B, decided, o = {}) {
  const net = new Net(B);
  for (let g = 0; g < decided.length; g++) if (decided[g] >= 0 && !B.gates[g].ghost) if (!net.tryAssign(g, decided[g])) return { count: 0, nodes: 0, solution: null, exhausted: true };
  return solve(B, {}, { ...o, net, cap: 1 });
}

// A solution in which every gate has the same state as its mirror copies (orbitGate from symmetry.js), or null. Weighted random order
// (weights per state) keeps patterns lively. Used by the puzzle generator and the Sandbox "Surprise".
export function solveSymmetric(B, orbitGate, rng, o = {}) {
  const w = o.weights ?? [1, 1, 1], budget = o.budget ?? 20000;
  const net = new Net(B);
  const members = new Map();
  for (const g of B.free) { const id = orbitGate[g]; if (!members.has(id)) members.set(id, []); members.get(id).push(g); }
  const reps = [...members.keys()];
  let nodes = 0;
  const assignOrbit = (id, s) => {
    const len = net.order.length, m = net.mark();
    for (const g of members.get(id)) if (net.states[g] >= 0 ? net.states[g] !== s : !net.tryAssign(g, s)) { net.undoTo(len, m); return false; }
    return true;
  };
  const rec = (k) => {
    if (++nodes > budget) return false;
    while (k < reps.length && net.states[members.get(reps[k])[0]] >= 0) k++;
    if (k >= reps.length) return true;
    const id = reps[k];
    const order = [0, 1, 2].map((s) => [s, -Math.log(1 - rng.next()) / w[s]]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    for (const s of order) {
      const len = net.order.length, m = net.mark();
      if (assignOrbit(id, s)) {
        // let the loop rule force what it can, keeping mirror copies equal
        const forced = [];
        let ok = net.propagate(forced);
        if (ok) for (const f of forced) if (!members.get(orbitGate[f.gate]).every((g) => net.states[g] < 0 || net.states[g] === f.state)) ok = false;
        if (ok && rec(k + 1)) return true;
      }
      net.undoTo(len, m);
      if (nodes > budget) return false;
    }
    return false;
  };
  if (!rec(0)) return null;
  // the final loop must be one loop through everything
  return Array.from(net.states);
}
