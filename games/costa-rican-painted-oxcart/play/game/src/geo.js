// Geometry of the three things a workshop paints: a wheel (rings x sectors), a cart side panel and a yoke board (grids).
// A piece is a list of cells, each with a symmetry set ("orbit": the cells one brush stroke paints together), its ring or row,
// and the edges it shares with neighbours. Pure data and maths: no drawing here.
export const HUB = 0.17, RIM0 = 0.9;   // wheel frame: unit circle; painted rings run from HUB to RIM0, the timber tyre from RIM0 to 1
export const TAU = Math.PI * 2;

const ring = (n) => ((n % 1) + 1) % 1;

// geom: { kind:'wheel', rings, sectors, fold, mirror, hub } | { kind:'panel'|'yoke', cols, rows, mirrorX, mirrorY }
export function buildPiece(g) {
  return g.kind === 'wheel' ? wheel(g) : grid(g);
}

function wheel(g) {
  const R = g.rings, S = g.sectors, P = S / g.fold, cells = [], at = new Map();
  const dr = (RIM0 - HUB) / R;
  if (g.hub) { cells.push({ id: 0, shape: 'disc', r0: 0, r1: HUB, ring: -1, sector: 0, mid: [0, 0] }); }
  for (let r = 0; r < R; r++) {
    for (let s = 0; s < S; s++) {
      const a0 = (s / S) * TAU - Math.PI / 2, a1 = ((s + 1) / S) * TAU - Math.PI / 2, r0 = HUB + r * dr, r1 = r0 + dr, am = (a0 + a1) / 2, rm = (r0 + r1) / 2;
      const c = { id: cells.length, shape: 'sector', r0, r1, a0, a1, ring: r, sector: s, mid: [Math.cos(am) * rm, Math.sin(am) * rm] };
      cells.push(c); at.set(`${r},${s}`, c.id);
    }
  }
  const hub = g.hub ? 0 : -1;
  const adj = [];
  for (let r = 0; r < R; r++) for (let s = 0; s < S; s++) {
    const a = at.get(`${r},${s}`), b = at.get(`${r},${(s + 1) % S}`);
    const ang = ((s + 1) / S) * TAU - Math.PI / 2, rm = HUB + (r + 0.5) * dr;
    adj.push({ a, b, at: [Math.cos(ang) * rm, Math.sin(ang) * rm] });
    if (r + 1 < R) { const c = at.get(`${r + 1},${s}`), am = ((s + 0.5) / S) * TAU - Math.PI / 2, rr = HUB + (r + 1) * dr; adj.push({ a, b: c, at: [Math.cos(am) * rr, Math.sin(am) * rr] }); }
    if (r === 0 && hub >= 0) { const am = ((s + 0.5) / S) * TAU - Math.PI / 2; adj.push({ a: hub, b: a, at: [Math.cos(am) * HUB, Math.sin(am) * HUB] }); }
  }
  const key = (c) => {
    if (c.ring < 0) return 'h';
    let m = c.sector % P;
    if (g.mirror) m = Math.min(m, P - 1 - m);
    return `${c.ring}:${m}`;
  };
  return finish(g, cells, adj, key, { aspect: 1, rowCount: R, rowOf: (c) => c.ring, rowName: (r) => (r === R - 1 ? 'the rim ring' : r === 0 ? 'the inner ring' : `ring ${r + 1}`), fold: g.fold });
}

function grid(g) {
  const C = g.cols, Rr = g.rows, cells = [], at = (c, r) => r * C + c;
  for (let r = 0; r < Rr; r++) for (let c = 0; c < C; c++) cells.push({ id: at(c, r), shape: 'rect', x: c, y: r, w: 1, h: 1, ring: r, sector: c, mid: [c + 0.5, r + 0.5] });
  const adj = [];
  for (let r = 0; r < Rr; r++) for (let c = 0; c < C; c++) {
    if (c + 1 < C) adj.push({ a: at(c, r), b: at(c + 1, r), at: [c + 1, r + 0.5] });
    if (r + 1 < Rr) adj.push({ a: at(c, r), b: at(c, r + 1), at: [c + 0.5, r + 1] });
  }
  const key = (c) => `${g.mirrorY ? Math.min(c.ring, Rr - 1 - c.ring) : c.ring}:${g.mirrorX ? Math.min(c.sector, C - 1 - c.sector) : c.sector}`;
  return finish(g, cells, adj, key, { aspect: C / Rr, rowCount: Rr, rowOf: (c) => c.ring, rowName: (r) => `row ${r + 1}`, fold: 1 });
}

function finish(g, cells, adj, keyOf, extra) {
  const orbitIds = new Map(), orbits = [];
  for (const c of cells) {
    const k = keyOf(c);
    if (!orbitIds.has(k)) { orbitIds.set(k, orbits.length); orbits.push({ id: orbits.length, cells: [], ring: c.ring, key: k }); }
    c.orbit = orbitIds.get(k); orbits[c.orbit].cells.push(c.id);
  }
  // touching pairs inside one symmetry set are the same stroke, so they are exempt (the seam of a mirror is one continuous colour)
  const edges = adj.filter((e) => cells[e.a].orbit !== cells[e.b].orbit).map((e) => ({ ...e, oa: cells[e.a].orbit, ob: cells[e.b].orbit }));
  const nb = orbits.map(() => new Set());
  for (const e of edges) { nb[e.oa].add(e.ob); nb[e.ob].add(e.oa); }
  const rows = [];
  for (let r = 0; r < extra.rowCount; r++) rows.push([...new Set(cells.filter((c) => c.ring === r).map((c) => c.orbit))]);
  for (const o of orbits) o.rows = [...new Set(o.cells.map((i) => cells[i].ring))].filter((r) => r >= 0);
  return { geom: g, kind: g.kind, cells, orbits, edges, nb: nb.map((s) => [...s]), rows, hubOrbit: g.kind === 'wheel' && g.hub ? cells[0].orbit : -1, aspect: extra.aspect, rowName: extra.rowName, fold: extra.fold, nRows: extra.rowCount, size: cells.length };
}

// Which cell is under the point (u, v) in the piece's own frame? Wheel: unit circle centred on 0; grid: cell units from the top-left.
export function cellAt(piece, u, v) {
  const g = piece.geom;
  if (g.kind === 'wheel') {
    const r = Math.hypot(u, v);
    if (r > RIM0 + 0.02) return -1;
    if (r < HUB) return g.hub ? 0 : -1;
    const ringI = Math.min(g.rings - 1, Math.floor(((r - HUB) / (RIM0 - HUB)) * g.rings));
    let a = Math.atan2(v, u) + Math.PI / 2; a = ((a % TAU) + TAU) % TAU;
    const s = Math.min(g.sectors - 1, Math.floor((a / TAU) * g.sectors));
    return piece.cells.find((c) => c.ring === ringI && c.sector === s)?.id ?? -1;
  }
  const c = Math.floor(u), r = Math.floor(v);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return -1;
  return r * g.cols + c;
}

export const WHEELS = {
  w1: { kind: 'wheel', rings: 2, sectors: 8, fold: 4, mirror: false, hub: true },
  w2: { kind: 'wheel', rings: 3, sectors: 8, fold: 2, mirror: false, hub: true },
  w3: { kind: 'wheel', rings: 3, sectors: 12, fold: 3, mirror: false, hub: true },
  w4: { kind: 'wheel', rings: 3, sectors: 12, fold: 2, mirror: true, hub: true },
  w5: { kind: 'wheel', rings: 4, sectors: 12, fold: 3, mirror: true, hub: true },
  w6: { kind: 'wheel', rings: 4, sectors: 16, fold: 4, mirror: true, hub: true },
  w7: { kind: 'wheel', rings: 4, sectors: 16, fold: 2, mirror: true, hub: true },
  w8: { kind: 'wheel', rings: 4, sectors: 12, fold: 2, mirror: false, hub: true },
  w9: { kind: 'wheel', rings: 3, sectors: 16, fold: 2, mirror: true, hub: true },
};
export const PANELS = {
  p1: { kind: 'panel', cols: 6, rows: 4, mirrorX: true, mirrorY: false },
  p2: { kind: 'panel', cols: 8, rows: 4, mirrorX: true, mirrorY: true },
  p3: { kind: 'panel', cols: 8, rows: 5, mirrorX: true, mirrorY: false },
  p4: { kind: 'panel', cols: 10, rows: 5, mirrorX: true, mirrorY: true },
  y1: { kind: 'yoke', cols: 10, rows: 2, mirrorX: true, mirrorY: false },
  y2: { kind: 'yoke', cols: 12, rows: 2, mirrorX: true, mirrorY: false },
  y3: { kind: 'yoke', cols: 12, rows: 3, mirrorX: true, mirrorY: false },
  y4: { kind: 'yoke', cols: 14, rows: 3, mirrorX: true, mirrorY: false },
};
export { ring };
