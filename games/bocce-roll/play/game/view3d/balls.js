// Bocce balls and the pallino: glossy resin spheres with the engraved line pattern of real tournament balls (three crossing
// grooves), subtle marbling in the resin and a clear-coat that mirrors the dusk sky and the string lights.
import * as THREE from '../vendor3d/three.js';
import { cvs, tex, rng } from './court.js';

// three great-circle grooves (the same pattern as the flat art), as normals of their planes
const RINGS = [[0, 0.6, 0.8], [0.82, -0.28, 0.5], [-0.5, 0.7, -0.5]].map((n) => { const l = Math.hypot(...n); return n.map((v) => v / l); });
const hex = (h) => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };

function ballCanvases(base, dark, hi, seed, grooves = true) {
  const W = 512, H = 256, r = rng(seed), b0 = hex(base), d0 = hex(dark), h0 = hex(hi);
  // marbling field: a few low-frequency sines, so each ball reads as cast resin and its spin is visible
  const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
  const map = cvs(W, H, () => {}), bump = cvs(W, H, () => {});
  const mg = map.getContext('2d'), bg = bump.getContext('2d');
  const mi = mg.createImageData(W, H), bi = bg.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const th = ((j + 0.5) / H) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W) * Math.PI * 2, x = -Math.cos(phi) * st, y = ct, z = Math.sin(phi) * st;
      let g = 0;
      if (grooves) for (const n of RINGS) { const d = Math.abs(x * n[0] + y * n[1] + z * n[2]); g = Math.max(g, d < 0.009 ? 1 : d < 0.02 ? (0.02 - d) / 0.011 : 0); }
      const mar = 0.5 + 0.5 * Math.sin(x * 3.1 + ph[0] + Math.sin(y * 4.3 + ph[1]) * 1.4 + Math.sin(z * 5.2 + ph[2]) * 0.8);
      const k = (j * W + i) * 4;
      let c0 = b0[0] + (h0[0] - b0[0]) * mar * 0.14, c1 = b0[1] + (h0[1] - b0[1]) * mar * 0.14, c2 = b0[2] + (h0[2] - b0[2]) * mar * 0.14;
      const dk = 0.12 + 0.18 * mar;
      c0 = c0 * (1 - dk * 0.25) + d0[0] * dk * 0.25; c1 = c1 * (1 - dk * 0.25) + d0[1] * dk * 0.25; c2 = c2 * (1 - dk * 0.25) + d0[2] * dk * 0.25;
      // the grooves are darker (cut through the polish)
      c0 = c0 * (1 - g * 0.4) + d0[0] * g * 0.4; c1 = c1 * (1 - g * 0.4) + d0[1] * g * 0.4; c2 = c2 * (1 - g * 0.4) + d0[2] * g * 0.4;
      mi.data[k] = c0; mi.data[k + 1] = c1; mi.data[k + 2] = c2; mi.data[k + 3] = 255;
      const bv = 200 - g * 200; bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = bv; bi.data[k + 3] = 255;
    }
  }
  mg.putImageData(mi, 0, 0); bg.putImageData(bi, 0, 0);
  return { map: tex(map, { aniso: 8 }), bump: tex(bump, { srgb: false }) };
}

const cache = new Map();
export function ballMaterial(pal, seed = 1, pallino = false) {
  const key = `${pal.base}|${pal.dark}|${seed}|${pallino}`;
  let m = cache.get(key);
  if (m) return m;
  const c = ballCanvases(pal.base, pal.dark, pal.hi, seed, true);
  m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.22, 1.22, 1.22), map: c.map, bumpMap: c.bump, bumpScale: pallino ? 0.6 : 1.4, roughness: pallino ? 0.28 : 0.2, metalness: 0,
    clearcoat: 1, clearcoatRoughness: pallino ? 0.12 : 0.06, envMapIntensity: 1.25,
  });
  cache.set(key, m);
  return m;
}
export const PALLINO_PAL = { base: '#f3d24c', dark: '#9a7410', hi: '#fff7c8' };

const geos = new Map();
export function sphere(r) {
  const k = r.toFixed(4);
  if (!geos.has(k)) geos.set(k, new THREE.SphereGeometry(r, 48, 32));
  return geos.get(k);
}
