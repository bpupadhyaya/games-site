// Silk flag cloth: a small verlet grid hoisted along a pole. Pure presentation (reads the pole pose, never writes back).
//   * the hoist column is pinned to the pole, so the cloth whips and trails when the pole is thrown or swept;
//   * the air pushes along the surface normal (relative wind = breeze minus the cloth's own velocity), which gives folds, flutter and billow;
//   * a thin capsule keeps the cloth out of the pole, so a spinning flag winds a little round it;
//   * rendering is one double-sided mesh with a heraldic canvas texture (swallow-tailed, with a gold edge).
// Deterministic: everything is a function of the dt handed in and the seed given at creation.
import { THREE } from '../vendor3d/index.js';

const { Vector3 } = THREE;
const NX = 13, NY = 9;
const N = NX * NY;

export const FLAG_W = 0.98, FLAG_H = 0.72;            // metres: a bandiera is about a metre wide
export const POLE_LEN = 1.7;

function makeTexture(paint, w = 256, h = 188) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  paint(g, w, h);
  // silk weave and a soft sheen
  g.save(); g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.05; g.strokeStyle = '#000';
  for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.globalAlpha = 0.035; g.strokeStyle = '#fff';
  for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.restore();
  // gold braid along the top and bottom edge, hoist band, and the swallow-tail notch cut out
  g.save();
  g.fillStyle = 'rgba(231,190,90,0.95)';
  g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 1, w, 2); g.fillRect(0, h - 5, w, 2);
  g.fillStyle = 'rgba(40,24,6,0.35)'; g.fillRect(0, 6, w, 2); g.fillRect(0, h - 8, w, 2);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, 9, h); g.fillStyle = 'rgba(231,190,90,0.9)'; g.fillRect(0, 0, 4, h);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  g.beginPath(); g.moveTo(w + 2, -2); g.lineTo(w * 0.8, h / 2); g.lineTo(w + 2, h + 2); g.closePath(); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const texCache = new Map();
export function flagTexture(key, paint) {
  let t = texCache.get(key);
  if (!t) { t = makeTexture(paint); texCache.set(key, t); }
  return t;
}
export function clearFlagTextures() { texCache.clear(); }

// a stable pseudo-random in [0,1)
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function createCloth({ seed = 1, w = FLAG_W, h = FLAG_H, material = {} } = {}) {
  const pos = new Float32Array(N * 3), prev = new Float32Array(N * 3), rest = [];
  const uv = new Float32Array(N * 2), idx = [];
  const dx = w / (NX - 1), dy = h / (NY - 1);
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const i = iy * NX + ix; uv[i * 2] = ix / (NX - 1); uv[i * 2 + 1] = 1 - iy / (NY - 1);
    if (ix < NX - 1 && iy < NY - 1) { idx.push(i, i + 1, i + NX, i + 1, i + NX + 1, i + NX); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), ...material });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.castShadow = true;

  // structural + shear + bend springs as pairs with rest lengths
  const pairs = [];
  const add = (a, b, k) => { pairs.push([a, b, k, 0]); };
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const i = iy * NX + ix;
    if (ix < NX - 1) add(i, i + 1, 1);
    if (iy < NY - 1) add(i, i + NX, 1);
    if (ix < NX - 1 && iy < NY - 1) { add(i, i + NX + 1, 0.8); add(i + 1, i + NX, 0.8); }
    if (ix < NX - 2) add(i, i + 2, 0.5);
    if (iy < NY - 2) add(i, i + 2 * NX, 0.5);
  }
  for (const p of pairs) {
    const ax = p[0] % NX, ay = (p[0] / NX) | 0, bx = p[1] % NX, by = (p[1] / NX) | 0;
    p[3] = Math.hypot((bx - ax) * dx, (by - ay) * dy);
  }

  const A = new Vector3(), B = new Vector3(), S = new Vector3(), tmp = new Vector3(), nrm = new Vector3(), wind = new Vector3(), rel = new Vector3();
  const cloth = {
    mesh, seed, time: 0, ready: false, side: 1, lastPole: new Vector3(), settle: 0,
    setDesign(tex) { if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; } },
    /** Re-seat the cloth flat along the pole (no velocity): call when a flag is (re)assigned. */
    reset(pole) { place(pole, true); cloth.ready = true; cloth.settle = 0; },
  };
  // pole: { base: Vector3, axis: Vector3 (unit, base -> tip), side: Vector3 (unit, direction the cloth streams), len, hoistTop (m from base to top edge of the cloth) }
  function place(pole, hard) {
    A.copy(pole.axis); B.copy(pole.base); S.copy(pole.side);
    for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
      const i = (iy * NX + ix) * 3;
      const t = pole.hoistTop - iy * dy;
      // a free end hangs slightly: lets the first frame look like cloth, not a plank
      const sag = ix * dx;
      tmp.copy(B).addScaledVector(A, t).addScaledVector(S, sag);
      tmp.y -= (pole.rest ?? 0.35) * sag * sag * 0.4;
      pos[i] = tmp.x; pos[i + 1] = tmp.y; pos[i + 2] = tmp.z;
      if (hard) { prev[i] = tmp.x; prev[i + 1] = tmp.y; prev[i + 2] = tmp.z; }
    }
  }
  const pin = (pole) => {
    for (let iy = 0; iy < NY; iy++) {
      const t = pole.hoistTop - iy * dy, i = (iy * NX) * 3;
      tmp.copy(pole.base).addScaledVector(pole.axis, t);
      pos[i] = tmp.x; pos[i + 1] = tmp.y; pos[i + 2] = tmp.z;
      // keep the pinned column's previous too, so it does not inject velocity into the neighbour
      prev[i] = tmp.x; prev[i + 1] = tmp.y; prev[i + 2] = tmp.z;
    }
  };

  /**
   * Advance by dt (seconds). pole as above; breeze: { x, y, z } base wind (m/s); gust 0..1 multiplier; stiff 0..1 (silk 0.3).
   */
  cloth.step = function (dt, pole, o = {}) {
    if (!cloth.ready) { cloth.reset(pole); }
    const gustAmp = o.gust ?? 1, calm = o.calm ? 0.35 : 1;
    if (!(dt > 1e-4)) { pin(pole); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); return; }
    const sub = Math.max(1, Math.min(4, Math.round(dt / (1 / 90))));
    const h2 = dt / sub;
    for (let s = 0; s < sub; s++) {
      cloth.time += h2;
      const t = cloth.time + seed * 3.1;
      // breeze: steady push from behind the cloth plus slow gusts and a faster flutter, each with its own phase
      const gust = (0.55 + 0.45 * Math.sin(t * 0.9) + 0.35 * Math.sin(t * 2.3 + 1.7)) * gustAmp;
      wind.set((o.wx ?? 3.2) * gust * calm * cloth.side, 0.25 * Math.sin(t * 1.3), (o.wz ?? 0.5) * Math.sin(t * 1.9 + seed));
      // aerodynamic push per particle
      for (let iy = 0; iy < NY; iy++) for (let ix = 1; ix < NX; ix++) {
        const i = iy * NX + ix, p = i * 3;
        const il = ix > 0 ? i - 1 : i, ir = ix < NX - 1 ? i + 1 : i, iu = iy > 0 ? i - NX : i, id = iy < NY - 1 ? i + NX : i;
        const ux = pos[ir * 3] - pos[il * 3], uy = pos[ir * 3 + 1] - pos[il * 3 + 1], uz = pos[ir * 3 + 2] - pos[il * 3 + 2];
        const vx = pos[id * 3] - pos[iu * 3], vy = pos[id * 3 + 1] - pos[iu * 3 + 1], vz = pos[id * 3 + 2] - pos[iu * 3 + 2];
        nrm.set(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        const nl = nrm.length() || 1; nrm.multiplyScalar(1 / nl);
        const vel = 1 / h2;
        rel.set(wind.x - (pos[p] - prev[p]) * vel, wind.y - (pos[p + 1] - prev[p + 1]) * vel, wind.z - (pos[p + 2] - prev[p + 2]) * vel);
        // turbulence along the length makes the flutter travel to the fly edge
        const fl = Math.sin(t * 6.5 - ix * 0.7 + iy * 0.35 + seed) * 0.9 * (ix / NX) * calm;
        const k = (rel.dot(nrm) + fl) * 0.95;
        const ax = nrm.x * k, ay = nrm.y * k - 3.2, az = nrm.z * k;         // silk: light, so gravity is only part of g
        const damp = 0.985;
        const nx = pos[p] + (pos[p] - prev[p]) * damp + ax * h2 * h2;
        const ny = pos[p + 1] + (pos[p + 1] - prev[p + 1]) * damp + ay * h2 * h2;
        const nz = pos[p + 2] + (pos[p + 2] - prev[p + 2]) * damp + az * h2 * h2;
        prev[p] = pos[p]; prev[p + 1] = pos[p + 1]; prev[p + 2] = pos[p + 2];
        pos[p] = nx; pos[p + 1] = ny; pos[p + 2] = nz;
      }
      pin(pole);
      // constraints
      for (let it = 0; it < 4; it++) {
        for (let k = 0; k < pairs.length; k++) {
          const pr = pairs[k], a = pr[0] * 3, b = pr[1] * 3;
          const ex = pos[b] - pos[a], ey = pos[b + 1] - pos[a + 1], ez = pos[b + 2] - pos[a + 2];
          const d = Math.hypot(ex, ey, ez) || 1e-6;
          const diff = (d - pr[3]) / d * 0.5 * pr[2];
          const aPinned = pr[0] % NX === 0, bPinned = pr[1] % NX === 0;
          const wa = aPinned ? 0 : bPinned ? 1 : 0.5, wb = bPinned ? 0 : aPinned ? 1 : 0.5;
          const f = diff * 2;
          if (!aPinned) { pos[a] += ex * f * wa; pos[a + 1] += ey * f * wa; pos[a + 2] += ez * f * wa; }
          if (!bPinned) { pos[b] -= ex * f * wb; pos[b + 1] -= ey * f * wb; pos[b + 2] -= ez * f * wb; }
        }
        // the pole: a capsule along the axis; particles are pushed out of it
        for (let ix = 1; ix < 4; ix++) for (let iy = 0; iy < NY; iy++) {
          const p = (iy * NX + ix) * 3;
          tmp.set(pos[p], pos[p + 1], pos[p + 2]).sub(pole.base);
          const along = tmp.dot(pole.axis);
          if (along < -0.02 || along > pole.len) continue;
          const perp = tmp.addScaledVector(pole.axis, -along);
          const dl = perp.length();
          const R = 0.026;
          if (dl < R) { perp.multiplyScalar(dl > 1e-5 ? (R / dl) : 0); if (dl <= 1e-5) perp.copy(pole.side).multiplyScalar(R); pos[p] = pole.base.x + pole.axis.x * along + perp.x; pos[p + 1] = pole.base.y + pole.axis.y * along + perp.y; pos[p + 2] = pole.base.z + pole.axis.z * along + perp.z; }
        }
      }
    }
    // normals for the lighting (folds)
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return cloth;
}

export { NX, NY, hash };
