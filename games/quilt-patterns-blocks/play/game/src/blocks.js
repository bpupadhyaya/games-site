// The six traditional pieced blocks, as exact polygons on a unit square. Patches keep a fixed order, so a block can be
// turned (quarter turns) just by transforming the points. Each patch has a role (0 = A, 1 = B, 2 = C) that the player's
// fabric choices follow. Pure data; nothing here draws.
const P = (role, ...pts) => ({ role, pts });
const sq = (role, x, y, w, h) => P(role, [x, y], [x + w, y], [x + w, y + h], [x, y + h]);
const turn = (p) => [1 - p[1], p[0]];                       // quarter turn about the middle of the unit square
const rotPatch = (pt, k) => ({ role: pt.role, pts: pt.pts.map((p) => { let q = p; for (let i = 0; i < k; i++) q = turn(q); return q; }) });
export const rotPoint = (p, k) => { let q = p; for (let i = 0; i < (k & 3); i++) q = turn(q); return q; };

function ninePatch() {
  const out = [];
  for (let i = 0; i < 9; i++) { const cx = i % 3, cy = Math.floor(i / 3); out.push(sq((cx + cy) % 2 === 0 ? 1 : 0, cx / 3, cy / 3, 1 / 3, 1 / 3)); }
  return out;
}
function logCabin() {
  const u = 0.2, out = [sq(2, 2 * u, 2 * u, u, u)];
  let x0 = 2, y0 = 2, x1 = 3, y1 = 3;
  for (let k = 0; k < 8; k++) {
    const role = Math.floor(k / 2) % 2 === 0 ? 0 : 1; let r;
    if (k % 4 === 0) { r = [x1, y0, x1 + 1, y1]; x1 += 1; }
    else if (k % 4 === 1) { r = [x0, y1, x1, y1 + 1]; y1 += 1; }
    else if (k % 4 === 2) { r = [x0 - 1, y0, x0, y1]; x0 -= 1; }
    else { r = [x0, y0 - 1, x1, y0]; y0 -= 1; }
    out.push(sq(role, r[0] * u, r[1] * u, (r[2] - r[0]) * u, (r[3] - r[1]) * u));
  }
  return out;
}
function flyingGeese() {
  const out = [];
  for (let j = 0; j < 2; j++) {
    const y = j * 0.5, role = j === 0 ? 1 : 2;
    out.push(P(0, [0, y], [0.5, y], [0, y + 0.5]));
    out.push(P(role, [0, y + 0.5], [1, y + 0.5], [0.5, y]));
    out.push(P(0, [0.5, y], [1, y], [1, y + 0.5]));
  }
  return out;
}
function pinwheel() {
  const out = [];
  for (let k = 0; k < 4; k++) {
    out.push(rotPatch(P(1, [0, 0], [0.5, 0], [0.5, 0.5]), k));
    out.push(rotPatch(P(0, [0, 0], [0.5, 0.5], [0, 0.5]), k));
  }
  return out;
}
function ohioStar() {
  // True Ohio Star: four plain corners, a centre square, and four hourglass (quarter-square triangle) edge units.
  const t = 1 / 3, c = [0.5, t / 2], out = [sq(0, 0, 0, t, t), sq(0, 2 * t, 0, t, t), sq(0, 0, 2 * t, t, t), sq(0, 2 * t, 2 * t, t, t), sq(2, t, t, t, t)];
  for (let k = 0; k < 4; k++) {
    out.push(rotPatch(P(1, [t, 0], [2 * t, 0], c), k));        // outer star point
    out.push(rotPatch(P(0, [t, 0], [t, t], c), k));            // sky, left
    out.push(rotPatch(P(0, [2 * t, 0], [2 * t, t], c), k));    // sky, right
    out.push(rotPatch(P(1, [t, t], [2 * t, t], c), k));        // inner star point
  }
  return out;
}
function bearPaw() {
  const out = [sq(1, 0, 0.5, 0.5, 0.5), sq(0, 0.5, 0.5, 0.5, 0.5)];
  for (let i = 0; i < 4; i++) {
    const x = i * 0.25;
    out.push(P(0, [x, 0], [x + 0.125, 0], [x, 0.5]));
    out.push(P(2, [x, 0.5], [x + 0.25, 0.5], [x + 0.125, 0]));
    out.push(P(0, [x + 0.125, 0], [x + 0.25, 0], [x + 0.25, 0.5]));
  }
  return out;
}

export const BLOCKS = [
  { id: 'nine-patch', name: 'Nine-Patch', roles: ['Plain squares', 'Print squares'], patches: ninePatch(), blurb: 'Nine squares in a checkerboard. The first block most quilters ever piece.' },
  { id: 'log-cabin', name: 'Log Cabin', roles: ['Light logs', 'Dark logs', 'Hearth centre'], patches: logCabin(), blurb: 'Strips ("logs") built round a small centre square, light on two sides and dark on the other two.' },
  { id: 'flying-geese', name: 'Flying Geese', roles: ['Sky', 'Upper goose', 'Lower goose'], patches: flyingGeese(), blurb: 'A tall triangle (the goose) between two small ones (the sky), twice over.' },
  { id: 'pinwheel', name: 'Pinwheel', roles: ['Background', 'Blades'], patches: pinwheel(), blurb: 'Four squares, each cut once on the diagonal, turned so the blades spin.' },
  { id: 'ohio-star', name: 'Ohio Star', roles: ['Sky and corners', 'Star points', 'Centre'], patches: ohioStar(), blurb: 'A nine-patch whose four edge squares are hourglass units, so the star points radiate from the centre square.' },
  { id: 'bear-paw', name: 'Bear Paw', roles: ['Background', 'Pad', 'Toes'], patches: bearPaw(), blurb: 'A square pad below a row of four pointed toes.' },
];
export const BLOCK_IDS = BLOCKS.map((b) => b.id);
export const blockOf = (id) => BLOCKS.find((b) => b.id === id) ?? BLOCKS[0];

const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const centroid = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };

// Do two patches share a stretch of seam? (Collinear edges that overlap by more than a hair.)
function share(a, b) {
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = a[(i + 1) % a.length], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    for (let j = 0; j < b.length; j++) {
      const r = b[j], s = b[(j + 1) % b.length];
      const c1 = Math.abs(dx * (r[1] - p[1]) - dy * (r[0] - p[0])) / len, c2 = Math.abs(dx * (s[1] - p[1]) - dy * (s[0] - p[0])) / len;
      if (c1 > 1e-6 || c2 > 1e-6) continue;
      const t1 = ((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / (len * len), t2 = ((s[0] - p[0]) * dx + (s[1] - p[1]) * dy) / (len * len);
      if (Math.min(1, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > 1e-6) return true;
    }
  }
  return false;
}
for (const b of BLOCKS) {
  b.area = b.patches.map((p) => area(p.pts));
  b.mid = b.patches.map((p) => centroid(p.pts));
  b.adj = [];
  for (let i = 0; i < b.patches.length; i++) for (let j = i + 1; j < b.patches.length; j++) if (share(b.patches[i].pts, b.patches[j].pts)) b.adj.push([i, j]);
  b.nRoles = 1 + Math.max(...b.patches.map((p) => p.role));
  b.byRole = Array.from({ length: b.nRoles }, (_, r) => b.patches.map((p, i) => (p.role === r ? i : -1)).filter((i) => i >= 0));
}

const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
// Which patch of the block holds the point (u, v) in unit coordinates? (-1 for none)
const segDist = (u, v, p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((u - p[0]) * dx + (v - p[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(u - p[0] - t * dx, v - p[1] - t * dy); };
const polyDist = (pts, u, v) => { let d = 9; for (let i = 0; i < pts.length; i++) d = Math.min(d, segDist(u, v, pts[i], pts[(i + 1) % pts.length])); return d; };
// Tap slop: small pieces (under 3% of the block) answer to a touch up to ~9 css px outside them on a phone, so thin triangles stay easy to hit.
export function pickPatch(block, u, v) {
  let hit = -1;
  for (let i = 0; i < block.patches.length; i++) if (inPoly(block.patches[i].pts, u, v)) { hit = i; break; }
  if (hit >= 0 && block.area[hit] < 0.03) return hit;
  let best = -1, bd = 0.035;
  for (let i = 0; i < block.patches.length; i++) if (i !== hit && block.area[i] < 0.03) { const d = polyDist(block.patches[i].pts, u, v); if (d < bd) { bd = d; best = i; } }
  return best >= 0 ? best : hit;
}
