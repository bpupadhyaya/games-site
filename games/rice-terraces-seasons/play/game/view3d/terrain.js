// The mountainside as a height function (terraces with a sunken mud bed, a grassy bund around every field, a steep wall down to the next tier, a canal bench and a steep
// forested slope behind, a footpath of steps on the left and a valley floor below) and the meshes built from it. Presentation only.
import { PW, PD, STEP, HW, HD, plotX, plotZ, tierY } from '../src/geom.js';

export const BED = -0.3, BUND = 0.2;                              // bed and bund heights relative to the tier floor
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v); };
export const noise = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 5, z * 2.1 + 9) * 0.28 + vnoise(x * 4.7 + 1, z * 4.7 + 3) * 0.12;

export function makeTerrain(lv) {
  const R = lv.R, C = lv.C;
  const zc0 = plotZ(lv, 0) - HD, y0 = tierY(lv, 0), halfX = (C * PW) / 2;
  const xP = -(halfX + 2.6);
  const tiersBelow = 3;                                              // decor tiers below the last playable one before the valley floor
  const kValley = R + tiersBelow;
  // low places cut into the bunds where an open-able gate sits (side channels between fields, spill lips in the front bund)
  const notches = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (c < C - 1 && !lv.blocked.includes(`s${r}_${c}`)) notches.push({ k: 's', x: plotX(lv, c) + PW / 2, z: plotZ(lv, r) - 0.15, y: tierY(lv, r) });
    if (!lv.blocked.includes(`d${r}_${c}`)) notches.push({ k: 'd', x: plotX(lv, c), z: plotZ(lv, r) + HD - 0.1, y: tierY(lv, r) });
  }
  const yValley = y0 - kValley * STEP;
  const zWarp = (x) => { const ax = Math.abs(x), m = ss(halfX + 0.4, halfX + 9, ax); return m * (3.4 * Math.sin(ax * 0.13 + (x < 0 ? 1.3 : 0.2)) + 1.2 * Math.sin(ax * 0.31 + 1)); };
  // returns { h, kind, bed } : kind 0 mud bed, 1 bund/grass, 2 wall, 3 slope, 4 path, 5 valley
  function field(x, z) {
    const zz = z - zWarp(x);
    const u = (zz - zc0) / PD;
    const xm = (((x + (PW * (C - 1)) / 2) % PW) + PW) % PW, dx = xm > PW / 2 ? xm - PW : xm;
    const bx = 1 - ss(HW - 0.4, HW - 0.05, Math.abs(dx));
    if (u < 0) {
      // behind the top tier: the canal bench, then the steep mountain
      const zb = zc0 - zz;
      const bench = y0 + 0.5;
      let h;
      if (zb < 3.6) h = lerp(y0 + BUND + (BED - BUND) * bx, bench, ss(0, 0.6, zb));
      else h = bench + (zb - 3.6) * 0.62 + 2.4 * noise(x * 0.18, zz * 0.18) * ss(3.6, 14, zb);
      h += 0.5 * (noise(x * 0.5, zz * 0.5) - 0.5) * ss(2, 8, zb);
      return { h: h - (zb > 0.35 && zb < 1.5 ? 0.18 * Math.exp(-Math.pow((zb - 0.9) / 0.4, 2)) : 0), kind: zb < 0.6 ? 0 : zb < 3.6 ? 1 : 3, bed: zb < 0.6 ? bx : 0 };
    }
    const k = Math.floor(u), fr = (u - k) * PD;
    if (k >= kValley) {
      const zv = zc0 + kValley * PD;
      return { h: yValley - 0.012 * (z - zv) + 0.15 * (noise(x * 0.3, z * 0.3) - 0.5), kind: 5, bed: 0 };
    }
    const yk = y0 - k * STEP;
    let h, kind, bed = 0;
    if (fr < 2 * HD) {
      const bz = 1 - ss(2 * HD - 0.55, 2 * HD - 0.22, fr);
      bed = bx * bz;
      h = yk + BUND + (BED - BUND) * bed;
      kind = bed > 0.5 ? 0 : 1;
    } else {
      const t = (fr - 2 * HD) / (PD - 2 * HD);
      const bottom = yk - STEP + BUND + (BED - BUND) * (k + 1 >= kValley ? 0 : bx);
      h = lerp(yk + BUND, bottom, ss(0.0, 1.0, t) * 0.55 + t * 0.45);
      kind = 2;
    }
    for (const n of notches) {
      const ax = Math.abs(x - n.x), az = Math.abs(z - n.z);
      if (n.k === 's') { if (ax < 0.75 && az < 0.85) { const m = (1 - ss(0.3, 0.85, az)) * (1 - ss(0.25, 0.7, ax)); h = Math.min(h, lerp(h, n.y + BED + 0.2, m)); } }
      else if (ax < 0.75 && az < 0.7) { const m = (1 - ss(0.2, 0.7, az)) * (1 - ss(0.3, 0.75, ax)); h = Math.min(h, lerp(h, n.y + BED + 0.17, m)); }
    }
    // the footpath of steps on the left runs straight down the slope
    const pm = ss(1.15, 0.55, Math.abs(x - xP));
    if (pm > 0) {
      const hp = Math.max(yValley, y0 + 0.05 - (zz - zc0) * (STEP / PD) * 0.98);
      const step = Math.floor((zz - zc0) / 0.8) * 0.8;
      const hs = Math.max(yValley, y0 + 0.05 - (step + 0.4) * (STEP / PD) * 0.98);
      h = lerp(h, 0.3 * hp + 0.7 * hs, pm); if (pm > 0.5) kind = 4;
    }
    return { h, kind, bed };
  }
  const info = { field, height: (x, z) => field(x, z).h, halfX, zc0, y0, xP, yValley, kValley, zFront: zc0 + kValley * PD };
  return info;
}

// colours
const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const PAL = {
  cordillera: { bed: 0x4a3a2c, bund: 0x5f9a35, wall: 0x7c705c, wallDark: 0x4d4538, slope: 0x2f6a2c, path: 0x8a7656, valley: 0x7ea04a },
  bali: { bed: 0x45382a, bund: 0x6fa335, wall: 0x7b6040, wallDark: 0x4a3a28, slope: 0x37772c, path: 0x9a8258, valley: 0x86a84a },
};
export function paletteFor(chapter) { return chapter === 1 ? PAL.bali : PAL.cordillera; }

export function buildTerrainGeometry(THREE, T, chapter) {
  const pal = paletteFor(chapter); const P = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, hex(v)]));
  const xMin = -T.halfX - 34, xMax = T.halfX + 22, zMin = T.zc0 - 40, zMax = T.zFront + 26;
  const fineX0 = -T.halfX - 3.2, fineX1 = T.halfX + 1.5, fineZ0 = T.zc0 - 5.5, fineZ1 = T.zc0 + (T.kValley - 1) * PD + 1;
  const pos = [], col = [], uv = [], idx = [];
  const push = (x, z, dropped) => {
    const f = T.field(x, z);
    const e = 0.18;
    const hx = T.height(x + e, z) - T.height(x - e, z), hz = T.height(x, z + e) - T.height(x, z - e);
    const slope = Math.hypot(hx, hz) / (2 * e);
    let c;
    const n = noise(x * 1.6, z * 1.6), n2 = noise(x * 6 + 3, z * 6 + 1);
    if (f.kind === 0 || (f.kind === 1 && f.bed > 0.2)) c = P.bed.map((v, i) => v * (0.85 + 0.3 * n2) * (i === 0 ? 1.04 : 1));
    else if (f.kind === 2) { const sl = Math.min(1, slope / 1.6); c = P.wall.map((v, i) => lerp(v * (0.8 + 0.5 * n2), P.wallDark[i] * (0.8 + 0.5 * n), 0.3 + 0.4 * (1 - sl))); if (chapter === 1) c = c.map((v, i) => lerp(v, P.bund[i] * 0.8, 0.28 * n)); }
    else if (f.kind === 3) c = P.slope.map((v, i) => v * (0.7 + 0.6 * n2) * (i === 1 ? 1.1 : 1));
    else if (f.kind === 4) c = P.path.map((v) => v * (0.85 + 0.25 * n2));
    else if (f.kind === 5) c = P.valley.map((v) => v * (0.8 + 0.4 * n));
    else c = P.bund.map((v, i) => v * (0.8 + 0.45 * n2) * (i === 1 ? 1 + 0.15 * n : 1));
    pos.push(x, f.h - (dropped ? 0.6 : 0), z); col.push(c[0], c[1], c[2]); uv.push(x / 3.2, z / 3.2);
  };
  // fine grid inside the playable area
  const grid = (x0, x1, z0, z1, step, skipInner) => {
    const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step), base = pos.length / 3;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) push(x0 + (i / nx) * (x1 - x0), z0 + (j / nz) * (z1 - z0), false);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (skipInner) {
        const cx = x0 + ((i + 0.5) / nx) * (x1 - x0), cz = z0 + ((j + 0.5) / nz) * (z1 - z0);
        if (cx > fineX0 && cx < fineX1 && cz > fineZ0 && cz < fineZ1) continue;
      }
      const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    return { base, nx, nz };
  };
  const outer = grid(xMin, xMax, zMin, zMax, 1.1, true);
  const g = grid(fineX0, fineX1, fineZ0, fineZ1, 0.22, false);
  // skirt under the fine grid's edges (hides the hairline cracks between fine and coarse cells)
  const sides = [
    Array.from({ length: g.nx + 1 }, (_, i) => g.base + i),
    Array.from({ length: g.nx + 1 }, (_, i) => g.base + g.nz * (g.nx + 1) + i),
    Array.from({ length: g.nz + 1 }, (_, j) => g.base + j * (g.nx + 1)),
    Array.from({ length: g.nz + 1 }, (_, j) => g.base + j * (g.nx + 1) + g.nx),
  ];
  for (const side of sides) {
    const lows = side.map((v) => { const k = pos.length / 3; pos.push(pos[v * 3], pos[v * 3 + 1] - 1.4, pos[v * 3 + 2]); col.push(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]); uv.push(uv[v * 2], uv[v * 2 + 1]); return k; });
    for (let i = 0; i < side.length - 1; i++) { idx.push(side[i], lows[i], side[i + 1], side[i + 1], lows[i], lows[i + 1]); idx.push(side[i], side[i + 1], lows[i], lows[i], side[i + 1], lows[i + 1]); }
  }
  void outer;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
