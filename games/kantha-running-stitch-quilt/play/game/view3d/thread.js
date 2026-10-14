// Thread geometry: tubes along polylines (parallel-transport frames), merged into one BufferGeometry, plus the stitch builder that lays
// a running-stitch dash on the cloth (it arches over the surface and dives into a hole at both ends).
import * as THREE from '../vendor3d/three.js';
import { dashesFor } from '../src/art.js';
import { UNIT } from '../src/v3.js';

// chains: [{ pts: [[x,y,z],...], r: radius, u0?: uv offset }]  (r may be an array per point)
export function tubesGeometry(chains, radial = 6, uPerMetre = 120, into = null) {
  let nv = 0, ni = 0;
  for (const c of chains) { if (c.pts.length < 2) continue; nv += c.pts.length * (radial + 1); ni += (c.pts.length - 1) * radial * 6; }
  const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), I = new Uint32Array(ni);
  let vo = 0, io = 0;
  const T = [0, 0, 0], Nx = [0, 0, 0], B = [0, 0, 0];
  for (const c of chains) {
    const pts = c.pts, n = pts.length;
    if (n < 2) continue;
    let len = c.u0 || 0, base = vo;
    // initial normal: any vector perpendicular to the first tangent
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      if (k === 0) {
        // pick the world axis least aligned with the tangent
        const ax = Math.abs(tx), ay = Math.abs(ty), az = Math.abs(tz);
        const w = ay <= ax && ay <= az ? [0, 1, 0] : ax <= az ? [1, 0, 0] : [0, 0, 1];
        // N = normalize(w - (w.t) t)
        const d = w[0] * tx + w[1] * ty + w[2] * tz;
        Nx[0] = w[0] - d * tx; Nx[1] = w[1] - d * ty; Nx[2] = w[2] - d * tz;
      } else {
        // parallel transport: project previous normal onto the plane perpendicular to the new tangent
        const d = Nx[0] * tx + Nx[1] * ty + Nx[2] * tz;
        Nx[0] -= d * tx; Nx[1] -= d * ty; Nx[2] -= d * tz;
      }
      const nl = Math.hypot(Nx[0], Nx[1], Nx[2]) || 1; Nx[0] /= nl; Nx[1] /= nl; Nx[2] /= nl;
      B[0] = ty * Nx[2] - tz * Nx[1]; B[1] = tz * Nx[0] - tx * Nx[2]; B[2] = tx * Nx[1] - ty * Nx[0];
      T[0] = tx; T[1] = ty; T[2] = tz;
      if (k > 0) { const p = pts[k - 1], q = pts[k]; len += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); }
      const r = Array.isArray(c.r) ? c.r[k] : c.r;
      for (let s = 0; s <= radial; s++) {
        const a = (s / radial) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const nx = Nx[0] * ca + B[0] * sa, ny = Nx[1] * ca + B[1] * sa, nz = Nx[2] * ca + B[2] * sa;
        const o = vo * 3;
        P[o] = pts[k][0] + nx * r; P[o + 1] = pts[k][1] + ny * r; P[o + 2] = pts[k][2] + nz * r;
        Nn[o] = nx; Nn[o + 1] = ny; Nn[o + 2] = nz;
        UV[vo * 2] = len * uPerMetre; UV[vo * 2 + 1] = s / radial;
        vo++;
      }
    }
    for (let k = 0; k < n - 1; k++) {
      for (let s = 0; s < radial; s++) {
        const a = base + k * (radial + 1) + s, b = a + 1, c2 = a + radial + 1, d = c2 + 1;
        I[io++] = a; I[io++] = c2; I[io++] = b; I[io++] = b; I[io++] = c2; I[io++] = d;
      }
    }
  }
  const g = into || new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  g.computeBoundingSphere();
  return g;
}

export const THREAD_R = 0.0016;   // metres: 4.8 mm thick (a doubled kantha cord, drawn bold so it reads at phone size)

// The centreline of one dash of a run, lying on the cloth. `h(x, y)` gives the cloth height in metres at cloth coords.
// upTo: arc length (sewing direction) reached so far; the dash is cut there.
export function dashChain(d, upTo, h, size, r = THREAD_R) {
  const p = d.pts, out = [], rr = [];
  const total = Math.max(1e-6, d.u1 - d.u0), cut = Math.min(d.u1, upTo);
  const full = cut >= d.u1 - 1e-6;
  // resample the dash evenly in arc length (the stored points are ~0.1 units apart: too coarse for the dive into the hole)
  const n = Math.max(3, Math.ceil(((cut - d.u0) / total) * 9));
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const u = d.u0 + ((cut - d.u0) * i) / n;
    while (j < p.length - 6 && p[j + 5] < u) j += 3;
    const u0 = p[j + 2], u1 = p[j + 5], t01 = u1 > u0 ? Math.max(0, Math.min(1, (u - u0) / (u1 - u0))) : 0;
    const x = p[j] + (p[j + 3] - p[j]) * t01, y = p[j + 1] + (p[j + 4] - p[j + 1]) * t01;
    const t = (u - d.u0) / total;   // 0..1 along the full dash
    // an arch over the cloth that dives into a hole at each end (the head end only dives once the dash is whole)
    const dipA = Math.exp(-t * 28), dipB = full ? Math.exp(-(1 - t) * 28) : 0;
    const arch = 0.8 + 0.2 * Math.sin(Math.PI * t) - 3.1 * (dipA + dipB);
    const wx = (x - size / 2) * UNIT, wz = (y - size / 2) * UNIT;
    const hh = Math.max(h(x, y), h(x + 0.12, y), h(x - 0.12, y), h(x, y + 0.12), h(x, y - 0.12));
    out.push([wx, hh + r * arch, wz]); rr.push(r * (0.94 + 0.1 * Math.sin(Math.PI * t)));
  }
  return { pts: out, r: rr };
}
