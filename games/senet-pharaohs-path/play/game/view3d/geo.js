// Procedural geometry for the Senet scene: lathe (pieces, lamps), rounded bevelled slabs (board, tiles, tray), the half-round throw stick,
// planes and a merge. Every builder returns { pos, nrm, uv, idx } (plain typed arrays, analytic normals).
const TAU = Math.PI * 2;

function make(P, N, U, I) {
  return { pos: new Float32Array(P), nrm: new Float32Array(N), uv: new Float32Array(U), idx: P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I) };
}

// profile: [[r, y], ...] bottom to top; repeat a point for a hard edge. uvs: u around, v along the profile length.
export function lathe(profile, segs = 32, { capTop = false, capBottom = false } = {}) {
  const P = [], N = [], U = [], I = [];
  const n = profile.length;
  // per-point normals from neighbours (hard edges: a repeated point splits)
  const nrm2 = [];
  let len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  const total = len[n - 1] || 1;
  for (let i = 0; i < n; i++) {
    const same = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
    let a = profile[i - 1], b = profile[i + 1];
    if (same(a, profile[i])) a = null;   // hard edge: use only the side away from the duplicate
    if (same(b, profile[i])) b = null;
    const p0 = a || profile[i], p1 = b || profile[i];
    let tx = p1[0] - p0[0], ty = p1[1] - p0[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    nrm2.push([ty, -tx]);   // outward for a bottom-to-top profile
  }
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * TAU, c = Math.cos(a), sn = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const [r, y] = profile[i], [nr, ny] = nrm2[i];
      P.push(r * c, y, r * sn); N.push(nr * c, ny, nr * sn); U.push(s / segs, len[i] / total);
    }
  }
  for (let s = 0; s < segs; s++) for (let i = 0; i < n - 1; i++) {
    const a = s * n + i, b = (s + 1) * n + i;
    if (Math.abs(profile[i][0] - profile[i + 1][0]) < 1e-7 && Math.abs(profile[i][1] - profile[i + 1][1]) < 1e-7) continue;
    I.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const cap = (pi, up) => {
    const [r, y] = profile[pi]; if (r < 1e-5) return;
    const c0 = P.length / 3; P.push(0, y, 0); N.push(0, up ? 1 : -1, 0); U.push(0.5, 0.5);
    for (let s = 0; s <= segs; s++) { const a = (s / segs) * TAU; P.push(r * Math.cos(a), y, r * Math.sin(a)); N.push(0, up ? 1 : -1, 0); U.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)); }
    for (let s = 0; s < segs; s++) up ? I.push(c0, c0 + 2 + s, c0 + 1 + s) : I.push(c0, c0 + 1 + s, c0 + 2 + s);
  };
  if (capTop) cap(n - 1, true);
  if (capBottom) cap(0, false);
  return make(P, N, U, I);
}

// Rounded rectangle outline (centre 0,0), corner radius r, `k` points per corner, counter-clockwise seen from above (+y).
function rrect(w, d, r, k) {
  const out = []; r = Math.max(0, Math.min(r, w / 2, d / 2));
  const cs = [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, Math.PI / 2], [-w / 2 + r, -d / 2 + r, Math.PI], [w / 2 - r, -d / 2 + r, Math.PI * 1.5]];
  for (const [cx, cz, a0] of cs) for (let i = 0; i <= k; i++) { const a = a0 + (i / k) * Math.PI / 2; out.push([cx + r * Math.cos(a), cz + r * Math.sin(a), Math.cos(a), Math.sin(a)]); }
  return out;
}

// A rounded, bevelled slab: footprint w x d, height h (y 0..h), corner radius r, top bevel b (rounded). Top UVs are planar over w x d.
export function slab(w, d, h, r = 0.05, b = 0.02, { k = 5, bevelSteps = 4, bottom = false, sideUv = null } = {}) {
  const P = [], N = [], U = [], I = [];
  const ring0 = rrect(w, d, r, k), m = ring0.length;
  // profile rows: [inset, y, normal-out, normal-up]
  const rows = [[0, 0, 1, 0], [0, h - b, 1, 0]];
  for (let s = 1; s <= bevelSteps; s++) { const a = (s / bevelSteps) * Math.PI / 2; rows.push([b * (1 - Math.cos(a)), h - b + b * Math.sin(a), Math.cos(a), Math.sin(a)]); }
  let per = 0; const perim = [0];
  for (let i = 1; i < m; i++) { per += Math.hypot(ring0[i][0] - ring0[i - 1][0], ring0[i][1] - ring0[i - 1][1]); perim.push(per); }
  const base = P.length / 3;
  for (const [ins, y, no, nu] of rows) {
    for (let i = 0; i < m; i++) {
      const [x, z, nx, nz] = ring0[i];
      P.push(x - nx * ins, y, z - nz * ins); N.push(nx * no, nu, nz * no); if (sideUv) U.push(sideUv[0], sideUv[1]); else U.push(perim[i] / (per || 1) * 4, y / Math.max(h, 1e-6));
    }
  }
  for (let rI = 0; rI < rows.length - 1; rI++) for (let i = 0; i < m; i++) {
    const j = (i + 1) % m, a = base + rI * m + i, b2 = base + rI * m + j, c = base + (rI + 1) * m + i, dd = base + (rI + 1) * m + j;
    I.push(a, c, b2, b2, c, dd);
  }
  // top cap (flat, planar UV)
  const top = P.length / 3, ins = b;
  P.push(0, h, 0); N.push(0, 1, 0); U.push(0.5, 0.5);
  for (let i = 0; i < m; i++) { const [x, z, nx, nz] = ring0[i]; const px = x - nx * ins, pz = z - nz * ins; P.push(px, h, pz); N.push(0, 1, 0); U.push(px / w + 0.5, pz / d + 0.5); }
  for (let i = 0; i < m; i++) I.push(top, top + 1 + ((i + 1) % m), top + 1 + i);
  if (bottom) {
    const bt = P.length / 3; P.push(0, 0, 0); N.push(0, -1, 0); U.push(0.5, 0.5);
    for (let i = 0; i < m; i++) { const [x, z] = ring0[i]; P.push(x, 0, z); N.push(0, -1, 0); U.push(x / w + 0.5, z / d + 0.5); }
    for (let i = 0; i < m; i++) I.push(bt, bt + 1 + i, bt + 1 + ((i + 1) % m));
  }
  return make(P, N, U, I);
}

// A flat plane on y = 0, w x d, uv 0..1 (scaled by uvScale).
export function plane(w, d, uvScale = [1, 1]) {
  return make([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [0, 0, uvScale[0], 0, uvScale[0], uvScale[1], 0, uvScale[1]], [0, 2, 1, 0, 3, 2]);
}
// A camera-facing quad in the XY plane (for flames, glows), centred at the origin.
export function quad(w = 1, h = 1, y0 = -0.5) {
  return make([-w / 2, y0 * h, 0, w / 2, y0 * h, 0, w / 2, (y0 + 1) * h, 0, -w / 2, (y0 + 1) * h, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 1, 1, 1, 1, 0, 0, 0], [0, 1, 2, 0, 2, 3]);
}

// The throw stick: a half-round stave along X (length L), flat face on y = 0 facing +y (the LIGHT face), the rounded back below (DARK),
// width w, back depth t, tapered rounded ends. Returns { face, back } so each side gets its own material.
export function stave(L = 3, w = 0.26, t = 0.13, { seg = 40, arc = 12 } = {}) {
  const ends = 0.12 * L;
  const sc = (x) => { const e = Math.abs(x) - (L / 2 - ends); if (e <= 0) return 1; const q = Math.min(1, e / ends); return Math.sqrt(Math.max(0.0, 1 - q * q)) * 0.85 + 0.15 * (1 - q); };
  const face = { P: [], N: [], U: [], I: [] }, back = { P: [], N: [], U: [], I: [] };
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, x = -L / 2 + u * L, s = Math.max(0.02, sc(x));
    // face: two points across the width
    face.P.push(x, 0.0005, -w / 2 * s, x, 0.0005, w / 2 * s); face.N.push(0, 1, 0, 0, 1, 0); face.U.push(u, 0, u, 1);
    for (let j = 0; j <= arc; j++) {
      const a = (j / arc) * Math.PI, cz = Math.cos(a), sy = Math.sin(a);
      back.P.push(x, -t * sy * s, w / 2 * cz * s);
      const nz = cz / w, ny = -sy / t, l = Math.hypot(nz, ny) || 1;
      back.N.push(0, ny / l, nz / l); back.U.push(u, j / arc);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2; face.I.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    for (let j = 0; j < arc; j++) { const p = i * (arc + 1) + j, q = (i + 1) * (arc + 1) + j; back.I.push(p, q, p + 1, p + 1, q, q + 1); }
  }
  // fix taper normals at the ends: tilt toward +-x
  for (let i = 0; i <= seg; i++) {
    const x = -L / 2 + (i / seg) * L, e = Math.abs(x) - (L / 2 - ends);
    if (e <= 0) continue;
    const tilt = Math.min(0.9, e / ends) * Math.sign(x);
    for (let j = 0; j <= arc; j++) { const k = (i * (arc + 1) + j) * 3; const ny = back.N[k + 1], nz = back.N[k + 2]; const l = Math.hypot(tilt, ny, nz); back.N[k] = tilt / l; back.N[k + 1] = ny / l; back.N[k + 2] = nz / l; }
  }
  return { face: make(face.P, face.N, face.U, face.I), back: make(back.P, back.N, back.U, back.I) };
}

// Merge geometries, each with an optional 4x4 transform (column-major) applied.
export function merge(list) {
  const P = [], N = [], U = [], I = [];
  for (const { geo, m } of list) {
    const base = P.length / 3;
    for (let i = 0; i < geo.pos.length; i += 3) {
      const x = geo.pos[i], y = geo.pos[i + 1], z = geo.pos[i + 2];
      const nx = geo.nrm[i], ny = geo.nrm[i + 1], nz = geo.nrm[i + 2];
      if (m) {
        P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        const tx = m[0] * nx + m[4] * ny + m[8] * nz, ty = m[1] * nx + m[5] * ny + m[9] * nz, tz = m[2] * nx + m[6] * ny + m[10] * nz, l = Math.hypot(tx, ty, tz) || 1;
        N.push(tx / l, ty / l, tz / l);
      } else { P.push(x, y, z); N.push(nx, ny, nz); }
    }
    for (let i = 0; i < geo.uv.length; i++) U.push(geo.uv[i]);
    for (let i = 0; i < geo.idx.length; i++) I.push(geo.idx[i] + base);
  }
  return make(P, N, U, I);
}
