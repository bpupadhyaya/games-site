// Mirror and rotation symmetry of a board: which arcs and gates map onto which. Used by the Sandbox (draw once, get 2, 4, 6, 8 or 12
// copies) and by the puzzle generator (symmetric solutions look best). Pure maths.

const GEN = {
  mx: (x, y, c) => [2 * c.x - x, y],
  my: (x, y, c) => [x, 2 * c.y - y],
  diag: (x, y, c) => [c.x + (y - c.y), c.y + (x - c.x)],
  rot90: (x, y, c) => [c.x - (y - c.y), c.y + (x - c.x)],
  rot180: (x, y, c) => [2 * c.x - x, 2 * c.y - y],
  rot120: (x, y, c) => { const dx = x - c.x, dy = y - c.y, k = 2 * Math.PI / 3; return [c.x + dx * Math.cos(k) - dy * Math.sin(k), c.y + dx * Math.sin(k) + dy * Math.cos(k)]; },
  rot60: (x, y, c) => { const dx = x - c.x, dy = y - c.y, k = Math.PI / 3; return [c.x + dx * Math.cos(k) - dy * Math.sin(k), c.y + dx * Math.sin(k) + dy * Math.cos(k)]; },
};

export const MODE_SETS = {
  4: [{ n: 1, label: '2-fold', gens: ['mx'] }, { n: 2, label: '4-fold', gens: ['mx', 'my'] }, { n: 3, label: '8-fold', gens: ['mx', 'my', 'diag'] }, { n: 11, label: 'turn 2', gens: ['rot180'], hidden: true }, { n: 12, label: 'turn 4', gens: ['rot90'], hidden: true }],
  6: [{ n: 1, label: '2-fold', gens: ['mx'] }, { n: 2, label: '4-fold', gens: ['mx', 'my'] }, { n: 3, label: '6-fold', gens: ['rot60'] }, { n: 4, label: '12-fold', gens: ['rot60', 'mx'] }, { n: 11, label: 'turn 2', gens: ['rot180'], hidden: true }, { n: 13, label: 'turn 3', gens: ['rot120'], hidden: true }],
};

const keyOf = (x, y) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

function mapBy(points, f, c) {
  const idx = new Map();
  points.forEach((p, i) => idx.set(keyOf(p[0], p[1]), i));
  const out = new Int32Array(points.length).fill(-1);
  points.forEach((p, i) => { const q = f(p[0], p[1], c); const j = idx.get(keyOf(q[0], q[1])); if (j !== undefined) out[i] = j; });
  return out;
}

// maps for one generator: { arc: Int32Array, gate: Int32Array, ok }
export function genMaps(B, name) {
  const c = { x: B.cx, y: B.cy }, f = GEN[name];
  const arc = mapBy(B.arcs.map((a) => [a.mx, a.my]), f, c);
  const gate = mapBy(B.gates.map((g) => [g.x, g.y]), f, c);
  let ok = true;
  for (const v of arc) if (v < 0) ok = false;
  for (const v of gate) if (v < 0) ok = false;
  return { arc, gate, ok };
}

// the modes this board really supports: [{ n, label, gens: [maps], orbitsArc: Int32Array, orbitsGate: Int32Array }]
export function modesOf(B) {
  const sets = MODE_SETS[B.D] ?? [];
  const cache = {};
  const get = (n) => (cache[n] ??= genMaps(B, n));
  const out = [];
  for (const m of sets) {
    if (!m.gens.every((g) => get(g).ok)) continue;
    const maps = m.gens.map(get);
    out.push({ n: m.n, label: m.label, hidden: Boolean(m.hidden), gens: maps, orbitArc: orbits(B.nArc, maps.map((q) => q.arc)), orbitGate: orbits(B.gates.length, maps.map((q) => q.gate)) });
  }
  return out;
}

// orbit id (the lowest member) for each element under the generators
export function orbits(n, maps) {
  const p = Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; } return a; };
  for (const m of maps) for (let i = 0; i < n; i++) { const a = find(i), b = find(m[i]); if (a !== b) p[Math.max(a, b)] = Math.min(a, b); }
  return Int32Array.from({ length: n }, (_, i) => find(i));
}

// every arc that is a mirror copy of `arc` under the mode (including itself)
export function copiesOf(mode, arc) {
  if (!mode) return [arc];
  const id = mode.orbitArc[arc], out = [];
  for (let i = 0; i < mode.orbitArc.length; i++) if (mode.orbitArc[i] === id) out.push(i);
  return out;
}
