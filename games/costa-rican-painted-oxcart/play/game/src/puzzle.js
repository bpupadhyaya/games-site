// Commissions: generator (with a guaranteed solution), solver, rule evaluation and the teacher (hints and explanations).
// A design is `a`: one colour id per symmetry set ('' = bare timber). Pure functions of (piece, commission, a).
import { buildPiece } from './geo.js';

export const COLORS = ['red', 'yellow', 'blue', 'green', 'orange', 'white'];
export const COLOR_NAME = { red: 'red', yellow: 'yellow', blue: 'blue', green: 'green', orange: 'orange', white: 'cream' };
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// small seeded generator (the commission list must be identical for everyone, independent of env.rng)
export function prng(seed) {
  let t = (seed >>> 0) + 0x6d2b79f5;
  const next = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } };
}

const pieceCache = new Map();
export function pieceOf(geom) {
  const k = JSON.stringify(geom);
  let p = pieceCache.get(k);
  if (!p) { p = buildPiece(geom); pieceCache.set(k, p); if (pieceCache.size > 60) pieceCache.delete(pieceCache.keys().next().value); }
  return p;
}
export const sizeOf = (P, o) => P.orbits[o].cells.length;
export const emptyDesign = (P) => P.orbits.map(() => '');

// ---- constraints ------------------------------------------------------------------------------------------------------------------
// cons: { k:'forbid', c, row } | { k:'distinct', row }. Rule 1 (touching sets differ) is built in.
const forbids = (P, cons, o, c) => cons.some((x) => x.k === 'forbid' && x.c === c && P.orbits[o].rows.includes(x.row));
const left = (P, pots, a) => {
  const l = { ...pots };
  a.forEach((c, o) => { if (c && l[c] !== null && l[c] !== undefined) l[c] -= sizeOf(P, o); });
  return l;
};
function reasons(P, cons, pots, a, o, c, l = left(P, pots, a)) {
  const out = [];
  const nbs = P.nb[o].filter((n) => a[n] === c);
  if (nbs.length) out.push({ why: 'touch' });
  if (forbids(P, cons, o, c)) out.push({ why: 'forbid' });
  for (const x of cons) if (x.k === 'distinct' && P.orbits[o].rows.includes(x.row) && P.rows[x.row].some((q) => q !== o && a[q] === c)) { out.push({ why: 'distinct', row: x.row }); break; }
  if (l[c] !== null && l[c] !== undefined && l[c] < sizeOf(P, o)) out.push({ why: 'pot', have: Math.max(0, l[c]), need: sizeOf(P, o) });
  return out;
}
export const colourOk = (P, cons, pots, a, o, c) => reasons(P, cons, pots, a, o, c).length === 0;
// same test as reasons(...).length === 0 without building the reason list (the solver calls this millions of times)
function allowed(P, cons, a, o, c, l) {
  const nb = P.nb[o];
  for (let i = 0; i < nb.length; i++) if (a[nb[i]] === c) return false;
  const x = l[c];
  if (x !== null && x !== undefined && x < P.orbits[o].cells.length) return false;
  const rows = P.orbits[o].rows;
  for (let i = 0; i < cons.length; i++) {
    const k = cons[i];
    if (k.k === 'forbid') { if (k.c === c && rows.includes(k.row)) return false; }
    else if (k.k === 'distinct' && rows.includes(k.row)) { const r = P.rows[k.row]; for (let j = 0; j < r.length; j++) if (r[j] !== o && a[r[j]] === c) return false; }
  }
  return true;
}
function domain(P, cons, pots, a, o, colors, l) { return colors.filter((c) => allowed(P, cons, a, o, c, l)); }

// ---- solver ---------------------------------------------------------------------------------------------------------------------
// Fills the unpainted sets so that every rule holds and every pot is used exactly. Returns { sols, exceeded }.
export function solve(P, cons, pots, a0, colors, { limit = 40000, want = 1, order = null } = {}) {
  const a = a0.slice(), sols = [];
  let nodes = 0, exceeded = false;
  const rec = () => {
    if (sols.length >= want || exceeded) return;
    if (++nodes > limit) { exceeded = true; return; }
    const l = left(P, pots, a);
    let best = -1, bd = null;
    for (let o = 0; o < a.length; o++) {
      if (a[o]) continue;
      const d = domain(P, cons, pots, a, o, colors, l);
      if (!d.length) return;
      if (!bd || d.length < bd.length || (d.length === bd.length && sizeOf(P, o) > sizeOf(P, best))) { best = o; bd = d; }
      if (d.length === 1) break;
    }
    if (best < 0) { if (colors.every((c) => (l[c] ?? 0) === 0)) sols.push(a.slice()); return; }
    const ds = order ? bd.slice().sort((x, y) => (order[best] === x ? -1 : 0) - (order[best] === y ? -1 : 0)) : bd;
    for (const c of ds) { a[best] = c; rec(); a[best] = ''; if (sols.length >= want || exceeded) return; }
  };
  rec();
  return { sols, exceeded };
}

// ---- generator --------------------------------------------------------------------------------------------------------------------
// def: { geom, colors: [ids], forbid: n, distinct: bool, givens: n, seed }
// Written as a generator that yields between attempts so the game can spread a slow search over many frames (stepCommission);
// makeCommission runs it to the end in one go.
export function makeCommission(def) {
  const it = commissionSteps(def);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
export function* commissionSteps(def) {
  const P = pieceOf(def.geom), rng = prng(def.seed), n = P.orbits.length;
  for (let attempt = 0; attempt < 300; attempt++) {
    if (attempt) yield attempt;
    const colors = def.colors.slice(), cons = [];
    if (def.distinct) {
      const rows = P.rows.map((r, i) => [r.length, i]).filter(([len]) => len >= 2 && len <= colors.length);
      if (rows.length) cons.push({ k: 'distinct', row: rows[rng.int(rows.length)][1] });
    }
    for (let i = 0; i < def.forbid; i++) {
      const row = rng.int(P.nRows), c = colors[rng.int(colors.length)];
      if (!cons.some((x) => x.k === 'forbid' && x.c === c && x.row === row)) cons.push({ k: 'forbid', c, row });
    }
    // several random full designs satisfying everything; keep the one whose pots are most even
    let a = null, bestVar = Infinity, pots = null;
    const order0 = [...Array(n).keys()];
    for (let s = 0; s < 14; s++) {
      const t = emptyDesign(P), order = rng.shuffle(order0), free = Object.fromEntries(colors.map((c) => [c, null]));
      let ok = true;
      for (const o of order) {
        const d = rng.shuffle(domain(P, cons, free, t, o, colors, free));
        if (!d.length) { ok = false; break; }
        t[o] = d[0];
      }
      if (!ok || !colors.every((c) => t.includes(c))) continue;
      const cnt = Object.fromEntries(colors.map((c) => [c, 0]));
      t.forEach((c, o) => { cnt[c] += sizeOf(P, o); });
      const vals = Object.values(cnt), mean = vals.reduce((x, y) => x + y, 0) / vals.length, v = vals.reduce((x, y) => x + (y - mean) ** 2, 0) / vals.length;
      if (v < bestVar) { bestVar = v; a = t; pots = cnt; }
    }
    if (!a) continue;
    // reveal some sets; reveal more until the rest is (nearly) forced
    const pickOrder = rng.shuffle([...Array(n).keys()]).filter((o) => o !== P.hubOrbit), givens = new Set(pickOrder.slice(0, def.givens));
    let extra = 0, tried = 0;
    for (;;) {
      const start = emptyDesign(P); givens.forEach((o) => { start[o] = a[o]; });
      const r = solve(P, cons, pots, start, colors, { want: 2, limit: def.fast ? 1200 : 3000 });
      tried += 1;
      if (r.sols.length === 1 && !r.exceeded) break;
      if (r.sols.length === 0 || r.exceeded) { if (tried > 1) break; }
      if (extra >= Math.max(1, Math.round(n * 0.25)) || givens.size >= n - 2) break;
      const more = pickOrder.find((o) => !givens.has(o));
      if (more === undefined) break;
      givens.add(more); extra += 1;
    }
    const start = emptyDesign(P); givens.forEach((o) => { start[o] = a[o]; });
    const check = solve(P, cons, pots, start, colors, { want: 1, limit: def.fast ? 3000 : 30000 });
    if (!check.sols.length) continue;
    return { ...def, piece: P, geom: def.geom, colors, cons, pots, given: [...givens].sort((x, y) => x - y), start, sol: a };
  }
  throw new Error('commission generator failed');
}
export const freeCommission = (geom, colors = COLORS) => { const P = pieceOf(geom); return { id: 'free', title: 'Free painting', mode: 'free', geom, colors: colors.slice(), cons: [], pots: Object.fromEntries(colors.map((c) => [c, null])), given: [], start: emptyDesign(P), sol: null, piece: P }; };
// a commission can be stored as JSON; rebuild the piece reference when it comes back
export function revive(ch) { ch.piece = pieceOf(ch.geom); return ch; }

// ---- rules: live evaluation ---------------------------------------------------------------------------------------------------------
export function ruleText(P, c) {
  if (c.k === 'forbid') return `No ${COLOR_NAME[c.c]} on ${P.rowName(c.row)}.`;
  if (c.k === 'distinct') return `${cap(P.rowName(c.row))}: every set a different colour.`;
  return '';
}
export function evaluate(ch, a) {
  const P = ch.piece, conflicts = [];
  P.edges.forEach((e, i) => { if (a[e.oa] && a[e.oa] === a[e.ob]) conflicts.push(i); });
  const items = [];
  const painted = a.reduce((s, c, o) => s + (c ? sizeOf(P, o) : 0), 0);
  if (ch.mode !== 'free') {
    items.push({ text: 'No two touching segments in the same colour.', ok: !conflicts.length, detail: conflicts.length ? `${conflicts.length} touching pair${conflicts.length > 1 ? 's' : ''}` : '', rule: 'touch' });
    for (const c of ch.cons) {
      let bad = 0;
      if (c.k === 'forbid') bad = a.filter((x, o) => x === c.c && P.orbits[o].rows.includes(c.row)).length;
      else { const seen = new Map(); for (const o of P.rows[c.row]) if (a[o]) seen.set(a[o], (seen.get(a[o]) ?? 0) + 1); bad = [...seen.values()].filter((n) => n > 1).length; }
      items.push({ text: ruleText(P, c), ok: bad === 0, detail: bad ? 'broken' : '', rule: c.k, con: c });
    }
    items.push({ text: 'Use up all the paint.', ok: painted === P.size, detail: `${painted} of ${P.size} segments`, rule: 'fill' });
  }
  const complete = a.every(Boolean);
  const done = ch.mode !== 'free' && complete && items.every((i) => i.ok);
  return { items, conflicts, complete, done, painted };
}
// would painting set `o` with colour `c` break a rule right now? (used for the smudge count and refusals)
export function breaks(ch, a, o, c) {
  const rs = reasons(ch.piece, ch.cons, ch.pots, a, o, c).filter((r) => r.why !== 'pot');
  return rs.length > 0;
}
export function potLeft(ch, a) { return left(ch.piece, ch.pots, a); }

// ---- the teacher ----------------------------------------------------------------------------------------------------------------
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
// Viable colours for set o: those that still allow a finished piece (solver lookahead).
function viable(ch, a, o, dom) {
  const out = [];
  for (const c of dom) {
    const t = a.slice(); t[o] = c;
    const r = solve(ch.piece, ch.cons, ch.pots, t, ch.colors, { want: 1, limit: 4000 });
    if (r.sols.length || r.exceeded) out.push(c);
  }
  return out;
}
const consistentWith = (a, sol) => !!sol && a.every((c, o) => !c || c === sol[o]);

// -> { kind:'place', o, c, text:{look, why}, forced } | { kind:'stuck', o, c, text } | null (nothing left)
export function plan(ch, a) {
  const P = ch.piece, un = a.map((c, o) => (c ? -1 : o)).filter((o) => o >= 0);
  if (!un.length) return null;
  const l = left(P, ch.pots, a);
  // can the piece still be finished?
  let base = consistentWith(a, ch.sol) ? { sols: [ch.sol], exceeded: false } : solve(P, ch.cons, ch.pots, a, ch.colors, { want: 1, limit: 60000 });
  if (!base.sols.length && !base.exceeded) {
    // dead end: point at a set that differs from the master's design
    const sol = ch.sol, bad = a.map((c, o) => (c && !ch.given.includes(o) && sol && c !== sol[o] ? o : -1)).filter((o) => o >= 0);
    const o = bad.length ? bad[bad.length - 1] : a.findIndex((c, i) => c && !ch.given.includes(i));
    if (o < 0) return null;
    const want = sol ? sol[o] : '';
    return { kind: 'stuck', o, c: want, text: { look: 'Stop: the piece cannot be finished from here. One of your earlier strokes is the problem; look at the marked segment.', why: want ? `The master painted this one ${COLOR_NAME[want]}. Repaint it (the old paint goes back in its pot) and the rest will work out.` : 'Repaint it and try another colour.' } };
  }
  // choose the set with the fewest viable colours (ties: the one touching the most painted sets); examine the tightest few
  const cand = un.map((o) => ({ o, dom: domain(P, ch.cons, ch.pots, a, o, ch.colors, l), touch: P.nb[o].filter((n) => a[n]).length }))
    .sort((x, y) => x.dom.length - y.dom.length || y.touch - x.touch || sizeOf(P, y.o) - sizeOf(P, x.o));
  let pick = null;
  for (const cd of cand.slice(0, 7)) {
    if (!cd.dom.length) continue;
    const v = cd.dom.length === 1 ? cd.dom : viable(ch, a, cd.o, cd.dom);
    if (!v.length) continue;
    const rank = v.length * 100 - cd.touch * 3 - sizeOf(P, cd.o) * 0.1;
    if (!pick || rank < pick.rank) pick = { o: cd.o, dom: cd.dom, v, rank };
    if (v.length === 1) break;
  }
  if (!pick) { const o = un[0]; return { kind: 'stuck', o, c: '', text: { look: 'This segment has no colour that works.', why: 'Undo your last strokes and try another order.' } }; }
  const { o, dom, v } = pick, sol = base.sols[0], c = v.includes(sol?.[o]) ? sol[o] : v[0];
  return { kind: 'place', o, c, forced: v.length === 1, text: explain(ch, a, o, c, dom, v, l) };
}

function explain(ch, a, o, c, dom, v, l) {
  const P = ch.piece, n = sizeOf(P, o), cn = COLOR_NAME[c];
  const look = `This segment (it paints ${n} piece${n > 1 ? 's' : ''} at once): look at what touches it, which pots are low, and the rules.`;
  const nbc = [...new Set(P.nb[o].map((q) => a[q]).filter(Boolean))].map((x) => COLOR_NAME[x]);
  const out = [];
  if (nbc.length) out.push(`It touches ${list(nbc)}, so ${nbc.length > 1 ? 'those are' : 'that is'} out.`);
  const fb = ch.colors.filter((x) => forbids(P, ch.cons, o, x) && !nbc.includes(COLOR_NAME[x])).map((x) => COLOR_NAME[x]);
  if (fb.length) out.push(`The brief bans ${list(fb)} here.`);
  const dis = ch.colors.filter((x) => reasons(P, ch.cons, ch.pots, a, o, x, l).some((r) => r.why === 'distinct') && !nbc.includes(COLOR_NAME[x])).map((x) => COLOR_NAME[x]);
  if (dis.length) out.push(`${cap(list(dis))} ${dis.length > 1 ? 'are' : 'is'} already used in this row, and the brief wants them all different.`);
  const low = ch.colors.filter((x) => { const r = reasons(P, ch.cons, ch.pots, a, o, x, l); return r.length === 1 && r[0].why === 'pot'; }).map((x) => COLOR_NAME[x]);
  if (low.length) out.push(`The ${list(low)} pot${low.length > 1 ? 's do' : ' does'} not hold enough for ${n} piece${n > 1 ? 's' : ''}.`);
  const dead = dom.filter((x) => !v.includes(x)).map((x) => COLOR_NAME[x]);
  if (dead.length) out.push(`${cap(list(dead))} would look fine here but lead to a dead end later: a pot or a rule could not be met.`);
  if (v.length === 1) out.push(`Only ${cn} is left, so paint it ${cn}.`);
  else out.push(`${cap(list(v.map((x) => COLOR_NAME[x])))} ${v.length === 2 ? 'both' : 'all'} still work from here; ${cn} is the master's choice.`);
  return { look, why: out.join(' ') };
}

export function applyStep(a, step) { if (step && step.kind === 'place') a[step.o] = step.c; else if (step && step.kind === 'stuck') a[step.o] = ''; return a; }
