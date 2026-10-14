// Tiny signed-distance toolkit: smooth unions of ellipsoids and round cones, meshed once with naive surface nets (no lookup tables).
// Used to sculpt the husky's body, head and tail as single organic surfaces (muscle masses blend into each other) instead of stacked balls.
export const sdEllipsoid = (px, py, pz, cx, cy, cz, rx, ry, rz) => {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = Math.hypot(x, y, z);
  const k1 = Math.hypot(x / rx, y / ry, z / rz);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
};
export const sdCone = (px, py, pz, ax, ay, az, bx, by, bz, ra, rb) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
  let t = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t, qy = ay + dy * t, qz = az + dz * t;
  return Math.hypot(px - qx, py - qy, pz - qz) - (ra + (rb - ra) * t);
};
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// f(x,y,z) -> signed distance (negative inside). Returns { positions, normals, indices } for the zero surface inside [bmin, bmax].
export function surfaceNets(f, bmin, bmax, h) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1, ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1, nz = Math.ceil((bmax[2] - bmin[2]) / h) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[id(i, j, k)] = f(bmin[0] + i * h, bmin[1] + j * h, bmin[2] + k * h);
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const cid = (i, j, k) => i + cx * (j + cy * k);
  const pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { const v = val[id(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; cv[c] = v; if (v < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1, bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;
      sx += ax + (bx - ax) * t; sy += ay + (by - ay) * t; sz += az + (bz - az) * t; n++;
    }
    cell[cid(i, j, k)] = pos.length / 3;
    pos.push(bmin[0] + (i + sx / n) * h, bmin[1] + (j + sy / n) * h, bmin[2] + (k + sz / n) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = val[id(i, j, k)] < 0;
    if (i < nx - 1 && (val[id(i + 1, j, k)] < 0) !== v0) quad(cell[cid(i, j - 1, k - 1)], cell[cid(i, j, k - 1)], cell[cid(i, j, k)], cell[cid(i, j - 1, k)], v0);
    if (j < ny - 1 && (val[id(i, j + 1, k)] < 0) !== v0) quad(cell[cid(i - 1, j, k - 1)], cell[cid(i - 1, j, k)], cell[cid(i, j, k)], cell[cid(i, j, k - 1)], v0);
    if (k < nz - 1 && (val[id(i, j, k + 1)] < 0) !== v0) quad(cell[cid(i - 1, j - 1, k)], cell[cid(i, j - 1, k)], cell[cid(i, j, k)], cell[cid(i - 1, j, k)], v0);
  }
  const nor = new Float32Array(pos.length), e = h * 0.6;
  for (let p = 0; p < pos.length; p += 3) {
    const x = pos[p], y = pos[p + 1], z = pos[p + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; nor[p] = gx / l; nor[p + 1] = gy / l; nor[p + 2] = gz / l;
  }
  return { positions: new Float32Array(pos), normals: nor, indices: idx };
}
