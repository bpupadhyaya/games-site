// Procedural horse coats: per-vertex colours computed once from the rest pose (no texture needed, ~4k vertices). Muscle shading
// (lighter belly and flanks, darker armpits / inner thighs), points (dark lower legs, ears, muzzle), socks, blaze, pinto patches, dapples.
import * as THREE from './three.js';

export const HORSE_COATS = {
  bay:      { body: '#7b4220', points: '#1b1310', mane: '#1b1310', belly: 1.12 },
  darkbay:  { body: '#4c2a18', points: '#150f0c', mane: '#150f0c', belly: 1.08 },
  chestnut: { body: '#9b4c1f', points: '#8a4019', mane: '#8f4519', belly: 1.1, flaxen: false },
  liver:    { body: '#4f2514', points: '#4a2112', mane: '#4a2112', belly: 1.06 },
  grey:     { body: '#b9bcbf', points: '#8d9094', mane: '#d6d8da', belly: 1.04, dapple: 0.5 },
  palomino: { body: '#d3a24e', points: '#caa04e', mane: '#f0e6cb', belly: 1.1 },
  buckskin: { body: '#c4964f', points: '#1c1411', mane: '#1c1411', belly: 1.1 },
  black:    { body: '#211c1b', points: '#161212', mane: '#141010', belly: 1.1 },
  pinto:    { body: '#8a4a22', points: '#2a1b14', mane: '#2a1b14', belly: 1.08, patches: '#efece4' },
  cremello: { body: '#e8dcc2', points: '#e0d2b4', mane: '#f4efe2', belly: 1.04 },
};
const SOCK_LEGS = ['LF', 'RF', 'LH', 'RH'];

const lin = (hex) => new THREE.Color(hex);   // three converts hex input sRGB -> linear working space
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t); const u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
           l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** spec: { coat:'bay', socks:{LF:0.25,...}|number[], blaze:'none'|'star'|'stripe'|'blaze'|'bald', dapple, seed } */
export function coatSpec(spec) {
  const name = typeof spec === 'string' ? spec : (spec && spec.coat) || 'bay';
  const base = HORSE_COATS[name] || HORSE_COATS.bay;
  const s = typeof spec === 'object' && spec ? spec : {};
  return { name, ...base, socks: s.socks || {}, blaze: s.blaze || 'none', seed: s.seed || 1, body: s.body || base.body, points: s.points || base.points, mane: s.mane || base.mane };
}

/** Writes a `color` attribute for a primitive of class `cls` ('body'|'light'|'muzzle'|'hoof'|'eye'|'eyewhite'). */
export function paintCoat(geometry, cls, cs) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  const out = new Float32Array(pos.count * 3);
  const body = lin(cs.body), points = lin(cs.points), white = lin('#f2efe8'), pinkNose = lin('#4a3330');
  const patches = cs.patches ? lin(cs.patches) : null;
  const c = new THREE.Color(), tmp = new THREE.Color();
  const sockH = { LF: 0, RF: 0, LH: 0, RH: 0 };
  if (Array.isArray(cs.socks)) SOCK_LEGS.forEach((k, i) => { sockH[k] = cs.socks[i] || 0; }); else for (const k of SOCK_LEGS) sockH[k] = (cs.socks && cs.socks[k]) || 0;
  const seed = cs.seed * 7.3;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nor.getY(i), nz = nor.getZ(i), nx = nor.getX(i);
    const ax = Math.abs(x);
    if (cls === 'eye') c.set('#07070a');
    else if (cls === 'eyewhite') c.set('#2a1a10');
    else if (cls === 'hoof') {
      c.set('#2d2520');
      const leg = (z > 0 ? 'F' : 'H'); const key = (x > 0 ? 'L' : 'R') + leg;
      if (sockH[key] > 0.02) c.set('#a89880');
    } else if (cls === 'muzzle') {
      c.copy(cs.name === 'grey' || cs.name === 'cremello' || cs.name === 'palomino' ? pinkNose : points);
      c.lerp(tmp.set('#2a1d1a'), 0.55);
    } else {
      c.copy(body);
      // low-frequency tone variation + fine mottling
      const n1 = vnoise(x * 3 + seed, y * 3, z * 3) - 0.5, n2 = vnoise(x * 11, y * 11 + seed, z * 11) - 0.5;
      let tone = 1 + n1 * 0.16 + n2 * 0.07;
      // light belly / flank underside, darker back top, dark armpits and inner thighs (muscle shading)
      tone *= 1 + (cs.belly - 1) * sm(0.0, -0.8, ny) * 1.2;
      tone *= 1 - 0.07 * sm(0.4, 1, ny);
      const inner = sm(0.16, 0.0, ax) * sm(1.15, 0.7, y);                    // between the legs
      tone *= 1 - 0.34 * inner;
      // muscle highlights: shoulder, forearm, gluteal, gaskin catch light, hollows behind them darken
      const g = (cx, cy, cz, rx, ry, rz) => { const dx = (ax - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz; return Math.exp(-(dx * dx + dy * dy + dz * dz)); };
      // light catches shoulder, forearm, gluteal and gaskin; creases (behind the elbow, flank fold, stifle, under the jaw) darken
      tone *= 1 + 0.10 * g(0.2, 1.25, 0.72, 0.16, 0.22, 0.2) + 0.08 * g(0.2, 0.9, 0.72, 0.1, 0.2, 0.1) + 0.11 * g(0.22, 1.35, -0.7, 0.2, 0.22, 0.25) + 0.07 * g(0.2, 0.8, -0.72, 0.1, 0.18, 0.15)
             + 0.06 * g(0.18, 1.2, 0.0, 0.2, 0.2, 0.3) - 0.14 * g(0.28, 1.05, 0.42, 0.14, 0.2, 0.08) - 0.12 * g(0.25, 1.1, -0.35, 0.12, 0.2, 0.1)
             - 0.14 * g(0.0, 1.78, 1.38, 0.1, 0.12, 0.1) - 0.08 * g(0.12, 1.88, 1.4, 0.06, 0.1, 0.12);
      // dapples (grey): clusters of lighter rings
      const dap = cs.dapple || 0;
      if (dap) { const d = vnoise(x * 16 + 3, y * 16, z * 16 + seed); tone *= 1 - dap * 0.2 * sm(0.62, 0.78, d) + dap * 0.08 * sm(0.3, 0.1, d); }
      c.multiplyScalar(tone);
      // points: lower legs from below the knee/hock, ears tips and muzzle edge
      let pk = sm(0.95, 0.55, y);
      const earZone = sm(2.3, 2.45, y) * (z > 1.1 ? 1 : 0);
      pk = Math.max(pk, earZone * 0.8);
      const faceZone = sm(1.62, 1.5, y) * sm(1.45, 1.6, z) * 0.55;
      pk = Math.max(pk, faceZone);
      if (cs.name !== 'chestnut' && cs.name !== 'palomino' && cs.name !== 'cremello') c.lerp(tmp.copy(points), pk);
      else c.lerp(tmp.copy(points).multiplyScalar(0.92), pk * 0.6);
      // socks
      for (const key of SOCK_LEGS) {
        const h = sockH[key]; if (h <= 0) continue;
        const isL = key[0] === 'L', isF = key[1] === 'F';
        if ((x > 0) !== isL || (z > 0.0) !== isF) continue;
        if (ax < 0.04 || ax > 0.4) continue;
        const k = sm(h + 0.03, h - 0.03, y) * (1 - 0.15 * vnoise(x * 40, y * 20, z * 40));
        c.lerp(white, k);
      }
      // facial markings (head: y > 1.6, z > 1.28)
      if (z > 1.3 && y > 1.62 && cs.blaze !== 'none') {
        const front = sm(0.1, 0.5, nz + ny * 0.3);
        const wBl = cs.blaze === 'blaze' ? 0.05 : cs.blaze === 'stripe' ? 0.022 : cs.blaze === 'bald' ? 0.1 : 0.0;
        if (wBl) { c.lerp(white, sm(wBl + 0.012, wBl - 0.012, ax) * front * sm(1.32, 1.4, z)); }
        if (cs.blaze === 'star' || cs.blaze === 'blaze') { const d = Math.hypot(x, (y - 2.04) * 0.9, (z - 1.42) * 1.1); c.lerp(white, sm(0.06, 0.03, d) * front * (cs.blaze === 'star' ? 1 : 0.0)); }
      }
      if (patches) {
        const pn = vnoise(x * 2.2 + 11, y * 2.2, z * 2.2 + 4) + 0.25 * vnoise(x * 6, y * 6, z * 6);
        c.lerp(patches, sm(0.66, 0.72, pn));
      }
      // nostril shadow
      { const dn = Math.hypot((ax - 0.045) * 1.2, (y - 1.76) * 1.1, (z - 1.7) * 1.4); c.multiplyScalar(1 - 0.5 * sm(0.05, 0.0, dn)); }
      if (cls === 'light') c.multiplyScalar(1.18);
    }
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
}
