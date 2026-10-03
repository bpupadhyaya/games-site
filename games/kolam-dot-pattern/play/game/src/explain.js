// Plain-words reasons for Think, Watch & Learn and refused turns. Every claim here is backed by the exact solver or by counting.
import { headGate, doomed } from './trail.js';

export const STATE_WORD = ['Wrap', 'Cross', 'Dip'];
export const STATE_LONG = ['wrap round its own dot', 'cross over to the other side', 'dip into the gap and turn back'];

// Arcs that can no longer be reached from the tip through undrawn arcs (a quick, exact necessary condition for one loop).
export function cutOff(T, extra = null) {
  const B = T.B;
  if (!T.arcs.length) return 0;
  const gateArcs = B.gates.map((g) => g.nodes.map((n) => n >> 1));
  let unused = 0;
  for (let a = 0; a < B.nArc; a++) if (!T.used[a]) unused++;
  const seenArc = new Uint8Array(B.nArc), seenGate = new Uint8Array(B.gates.length);
  const stack = [];
  const visitGate = (g) => { if (seenGate[g]) return; seenGate[g] = 1; for (const a of gateArcs[g]) if (!T.used[a] && !seenArc[a]) { seenArc[a] = 1; stack.push(a); } };
  visitGate(headGate(T));
  if (extra) { /* the chosen exit's arc is entered next: it is reachable by definition */ if (!seenArc[extra.arc] && !T.used[extra.arc]) { seenArc[extra.arc] = 1; stack.push(extra.arc); } }
  let reached = 0;
  while (stack.length) {
    const a = stack.pop(); reached++;
    visitGate(B.arcs[a].g0); visitGate(B.arcs[a].g1);
  }
  return Math.max(0, unused - reached);
}

// why option `o` (an exit of the tip) cannot be used, or null when it is fine
export function optionProblem(T, o, budget = 30000) {
  if (o.closing && T.arcs.length < T.B.nArc) return { kind: 'early', arcs: T.arcs.length };
  if (!o.valid) return { kind: 'used' };
  if (doomed(T, { gate: o.gate, s: o.s }, budget)) return { kind: 'doomed', cut: cutOff(T, o) };
  return null;
}

const problemText = (name, p, T) => {
  if (p.kind === 'early') return `${name} would join the line back to its start after only ${p.arcs} of ${T.B.nArc} arcs.`;
  if (p.kind === 'used') return `${name} would run into the line you already drew.`;
  if (p.cut > 0) return `${name} would leave ${p.cut} ${p.cut === 1 ? 'arc' : 'arcs'} cut off from the rest.`;
  return `${name} would make a single loop impossible (checked by exhaustive search).`;
};

export function explainRefusal(T, o) {
  const p = optionProblem(T, o) ?? { kind: 'doomed', cut: 0 };
  return { head: 'Not that way', why: problemText(STATE_WORD[o.s], p, T), problem: p };
}

// The reason for the plan's first decision (or for the forced run). `pl` comes from trail.plan().
export function explainPlan(T, pl, o = {}) {
  const n = pl.seg.length;
  if (pl.seg.length && pl.seg[0].start) {
    return { head: 'Start anywhere', why: 'The line can begin on any arc. This start is part of a complete one-loop pattern (checked by the solver). The glowing arcs are the forced stretch up to the first choice.', ring: -1 };
  }
  if (pl.decision) {
    const d = pl.decision;
    const all = [d.chosen, ...d.others];
    const probs = d.others.map((x) => ({ o: x, p: optionProblem(T, x) }));
    const bad = probs.filter((x) => x.p);
    const lines = bad.map((x) => problemText(STATE_WORD[x.o.s], x.p, T));
    const head = `${STATE_WORD[d.chosen.s]} here`;
    let why;
    if (bad.length) why = `Only ${STATE_WORD[d.chosen.s]} keeps one loop possible. ${lines.join(' ')}`;
    else why = `${all.map((x) => STATE_WORD[x.s]).join(', ')} can all still be finished. ${STATE_WORD[d.chosen.s]} is part of a verified complete pattern.`;
    return { head, why, ring: d.gate, bad: bad.map((x) => x.o) };
  }
  if (!n) return { head: 'The line is complete', why: 'Every arc is drawn and the line is closed.', ring: -1 };
  return { head: 'Keep going', why: `For the next ${n} ${n === 1 ? 'arc' : 'arcs'} the line has no choice: the marks and the arcs already drawn decide the way. The glowing stretch shows it.`, ring: -1 };
}
