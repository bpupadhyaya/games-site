// Courses: all measurements in metres. The handler's post is the origin, the course runs towards +z, +x is to the handler's right.
// Gates: centre (cx, cz), width w, pass direction (dx, dz) (the way the flock must cross). Pen: centre, inner size, mouth width; the mouth faces +z.
import { clamp, hyp, smooth } from './util.js';

const box = (x0, x1, z0, z1) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];

export const COURSES = {
  valley: {
    id: 'valley', name: 'Valley Paddock', blurb: 'Flat green ground, wide gates, four calm ewes.', n: 4, time: 420,
    b: { x0: -62, x1: 62, z0: -24, z1: 128 }, set: { x: 6, z: 88 },
    fetch: { cx: 0, cz: 46, w: 7, dx: 0, dz: -1 }, d1: { cx: -24, cz: 40, w: 6.5, dx: 0, dz: 1 }, d2: { cx: 10, cz: 56, w: 6.5, dx: 1, dz: 0 },
    pen: { cx: 28, cz: 12, size: 5, mouth: 3.4 },
    Z: 16, cohes: 1.15, bold: 0, skit: 0.12,
    terrain: { amp: 0.5, tilt: 0, p1: 0.4, p2: 1.1, p3: 2.0, outer: 10 },
    rocks: [], gorse: [], tone: 'meadow', stars: 1,
  },
  lowland: {
    id: 'lowland', name: 'Lowland Farm', blurb: 'Rolling fields and hedgerows, five ewes.', n: 5, time: 420,
    b: { x0: -64, x1: 64, z0: -24, z1: 138 }, set: { x: -6, z: 98 },
    fetch: { cx: 0, cz: 50, w: 6, dx: 0, dz: -1 }, d1: { cx: -26, cz: 44, w: 5.6, dx: 0, dz: 1 }, d2: { cx: 12, cz: 60, w: 5.6, dx: 1, dz: 0 },
    pen: { cx: 28, cz: 12, size: 5, mouth: 3.2 },
    Z: 17, cohes: 1.05, bold: 0, skit: 0.16,
    terrain: { amp: 1.4, tilt: 0.01, p1: 1.3, p2: 0.2, p3: 0.7, outer: 16 },
    rocks: [[-40, 70, 1.3], [44, 100, 1.6]], gorse: [], tone: 'farm', stars: 2,
  },
  hill: {
    id: 'hill', name: 'Hill Pasture', blurb: 'A sloping hill field. Uphill is slow work. Six ewes.', n: 6, time: 450,
    b: { x0: -66, x1: 66, z0: -24, z1: 148 }, set: { x: 10, z: 108 },
    fetch: { cx: 0, cz: 54, w: 5.2, dx: 0, dz: -1 }, d1: { cx: -28, cz: 48, w: 5.2, dx: 0, dz: 1 }, d2: { cx: 14, cz: 66, w: 5.2, dx: 1, dz: 0 },
    pen: { cx: 30, cz: 12, size: 5, mouth: 3.1 },
    Z: 19, cohes: 1.0, bold: 1, skit: 0.2,
    terrain: { amp: 3, tilt: 0.03, p1: 2.2, p2: 0.9, p3: 1.5, outer: 26 },
    rocks: [[-30, 84, 1.6], [34, 80, 1.9], [-48, 120, 2.2], [52, 126, 1.8]], gorse: [[24, 38, 2.4]], tone: 'hill', stars: 3,
  },
  upland: {
    id: 'upland', name: 'Upland Moor', blurb: 'Open moor with gorse, wind and seven lively ewes.', n: 7, time: 450,
    b: { x0: -68, x1: 68, z0: -24, z1: 158 }, set: { x: -12, z: 118 },
    fetch: { cx: 0, cz: 58, w: 4.6, dx: 0, dz: -1 }, d1: { cx: -30, cz: 50, w: 4.6, dx: 0, dz: 1 }, d2: { cx: 16, cz: 70, w: 4.6, dx: 1, dz: 0 },
    pen: { cx: 32, cz: 12, size: 5, mouth: 3.0 },
    Z: 20, cohes: 0.95, bold: 1, skit: 0.24,
    terrain: { amp: 4.2, tilt: 0.045, p1: 3.1, p2: 2.4, p3: 0.3, outer: 34 },
    rocks: [[-36, 92, 1.8], [40, 96, 2.0], [-52, 60, 1.6], [56, 140, 2.4]], gorse: [[-14, 76, 3], [22, 90, 3.4], [-4, 36, 2.2], [44, 54, 2.8]], tone: 'moor', stars: 4,
  },
  highland: {
    id: 'highland', name: 'Highland Crag', blurb: 'Steep ground, crags and tight gates. Eight wary ewes.', n: 8, time: 480,
    b: { x0: -70, x1: 70, z0: -24, z1: 168 }, set: { x: 14, z: 128 },
    fetch: { cx: 0, cz: 62, w: 4.0, dx: 0, dz: -1 }, d1: { cx: -32, cz: 52, w: 4.0, dx: 0, dz: 1 }, d2: { cx: 18, cz: 74, w: 4.0, dx: 1, dz: 0 },
    pen: { cx: 34, cz: 12, size: 5, mouth: 2.8 },
    Z: 21, cohes: 0.9, bold: 2, skit: 0.28,
    terrain: { amp: 6, tilt: 0.06, p1: 0.9, p2: 1.7, p3: 2.6, outer: 46 },
    rocks: [[-40, 100, 2.4], [38, 110, 2.6], [-58, 70, 2.0], [60, 90, 2.2], [0, 132, 2.8], [-24, 30, 1.6]], gorse: [[-18, 84, 3], [26, 96, 3.2], [8, 40, 2.4], [50, 60, 3]], tone: 'crag', stars: 5,
  },
  meadow: {
    id: 'meadow', name: 'Training Meadow', blurb: 'A small meadow for a young dog.', n: 3, time: 0, training: true,
    b: { x0: -36, x1: 36, z0: -16, z1: 70 }, set: { x: 0, z: 40 },
    fetch: { cx: 0, cz: 22, w: 8, dx: 0, dz: -1 }, d1: null, d2: null, pen: null,
    Z: 15, cohes: 1.2, bold: 0, skit: 0.1,
    terrain: { amp: 0.3, tilt: 0, p1: 0.2, p2: 0.4, p3: 0.8, outer: 8 },
    rocks: [], gorse: [], tone: 'meadow', stars: 0,
  },
};
export const COURSE_ORDER = ['valley', 'lowland', 'hill', 'upland', 'highland'];

// the pen: walls on three sides (west, south, east) and the north mouth, plus the gate leaf
export function penGeom(c) {
  const p = c.pen; if (!p) return null;
  const h = p.size / 2, x0 = p.cx - h, x1 = p.cx + h, z0 = p.cz - h, z1 = p.cz + h;
  const m = p.mouth / 2;
  // the north wall has a gap of `mouth` centred on the pen; the gate leaf hinges at the west end of the gap
  const hinge = { x: p.cx - m, z: z1 }, tip = { x: p.cx + m, z: z1 };
  return { cx: p.cx, cz: p.cz, x0, x1, z0, z1, m, hinge, tip, leaf: p.mouth, walls: [[x0, z0, x1, z0], [x0, z0, x0, z1], [x1, z0, x1, z1], [x0, z1, p.cx - m, z1], [p.cx + m, z1, x1, z1]], handler: { x: x0 - 1.6, z: z1 + 1.7 } };
}

export function courseWalls(c, penOpen) {
  const w = box(c.b.x0, c.b.x1, c.b.z0, c.b.z1).map((s) => ({ x0: s[0], z0: s[1], x1: s[2], z1: s[3] }));
  const g = penGeom(c);
  if (g) {
    for (const s of g.walls) w.push({ x0: s[0], z0: s[1], x1: s[2], z1: s[3] });
    // gate leaf: closed across the mouth; open it is folded back against the north wall (no obstacle)
    if (!penOpen) w.push({ x0: g.hinge.x, z0: g.hinge.z, x1: g.tip.x, z1: g.tip.z, leaf: true });
  }
  return w;
}
export function courseCircles(c) {
  const out = [];
  for (const [x, z, r] of c.rocks) out.push({ x, z, r: r * 0.8 });
  for (const [x, z, r] of c.gorse) out.push({ x, z, r: r * 0.7, soft: true });
  for (const k of ['fetch', 'd1', 'd2']) {
    const g = c[k]; if (!g) continue;
    const px = -g.dz, pz = g.dx;                 // along the gate line
    for (const sgn of [-1, 1]) out.push({ x: g.cx + px * sgn * g.w / 2, z: g.cz + pz * sgn * g.w / 2, r: 0.14, post: true });
  }
  return out;
}

// terrain height: gentle inside the field, rising into hills outside it. Shared by the simulation (slope) and the 3D presenter.
export function fieldH(c, x, z) {
  const t = c.terrain;
  return t.tilt * z + t.amp * (Math.sin(x * 0.045 + t.p1) * Math.cos(z * 0.035 + t.p2) + 0.5 * Math.sin(x * 0.09 - z * 0.07 + t.p3));
}
export function groundH(c, x, z) {
  const b = c.b;
  const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
  const d = hyp(x - cx, z - cz);
  let h = fieldH(c, cx, cz);
  if (d > 0) {
    const t = smooth(0, 70, d), a = Math.atan2(z - (b.z0 + b.z1) / 2, x);
    h += t * t * c.terrain.outer * (0.55 + 0.45 * Math.sin(a * 3 + 0.8) * Math.cos(x * 0.03 + z * 0.02)) + t * c.terrain.amp * Math.sin(x * 0.11 + z * 0.09);
  }
  return h;
}
// rate of rise along a unit direction (ux, uz) at (x, z): positive is uphill
export function slopeAlong(c, x, z, ux, uz) {
  const e = 1.2;
  return (fieldH(c, x + ux * e, z + uz * e) - fieldH(c, x - ux * e, z - uz * e)) / (2 * e);
}
