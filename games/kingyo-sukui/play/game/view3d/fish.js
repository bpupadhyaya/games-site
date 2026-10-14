// Goldfish for the festival tub: a lofted body (scales painted on a canvas map), a translucent veil tail that ripples with its own
// lag, a sail dorsal fin, paddling pectoral fins and eyes (telescope eyes for the Demekin and the Black moor).
// Everything is rebuilt each frame from the swim phase (CPU, ~700 vertices per fish), so there is no skeleton and no asset.
// Coordinates (fish space, metres): +x = head, +y = up, +z = the fish's left. Length L = body length without the tail.
import * as THREE from '../vendor3d/three.js';
import { TAU, hash, clamp, mk, texOf } from './tex.js';

// wr: body width / length, hr: height / width, tl: tail length / L, tw: tail spread, dh: dorsal fin height / L (0 = none),
// pf: pectoral fin length / L, wen: head hood, eye: 'tele' | 'round'. cols: back, flank, belly, fin.
export const SPECIES = [
  { name: 'Wakin', wr: 0.34, hr: 1.15, tl: 0.62, tw: 0.9, dh: 0.2, pf: 0.17, eye: 'round', cols: ['#ff5230', '#ff8a5e', '#fff1e4', 'rgba(255,170,140,0.82)'], style: 'sarasa' },
  { name: 'Calico', wr: 0.36, hr: 1.2, tl: 0.62, tw: 1.0, dh: 0.2, pf: 0.17, eye: 'round', cols: ['#f4efe6', '#fff6ee', '#fffaf4', 'rgba(255,225,205,0.8)'], style: 'calico' },
  { name: 'Demekin', wr: 0.4, hr: 1.2, tl: 0.7, tw: 1.1, dh: 0.22, pf: 0.17, eye: 'tele', cols: ['#d63a1a', '#ec5a32', '#ffb08a', 'rgba(255,110,70,0.8)'], style: 'solid' },
  { name: 'Black moor', wr: 0.44, hr: 1.2, tl: 0.78, tw: 1.3, dh: 0.24, pf: 0.18, eye: 'tele', cols: ['#08080d', '#15151f', '#2c2c3c', 'rgba(40,40,70,0.86)'], style: 'velvet' },
  { name: 'Ranchu', wr: 0.58, hr: 1.05, tl: 0.5, tw: 1.0, dh: 0, pf: 0.15, eye: 'round', cols: ['#ff7a22', '#ff9a48', '#ffd9a8', 'rgba(255,180,100,0.8)'], style: 'hood', wen: 1 },
  { name: 'Tosakin', wr: 0.31, hr: 1.15, tl: 1.0, tw: 1.5, dh: 0.14, pf: 0.17, eye: 'round', cols: ['#dc2f26', '#f0574a', '#fff0e6', 'rgba(255,150,140,0.8)'], style: 'tosa' },
  { name: 'Pearl', wr: 0.66, hr: 1.0, tl: 0.5, tw: 1.0, dh: 0.1, pf: 0.14, eye: 'round', cols: ['#fff0dc', '#fff6ea', '#fffaf2', 'rgba(255,240,225,0.82)'], style: 'pearl' },
  { name: 'Gold Ogon', wr: 0.37, hr: 1.15, tl: 0.8, tw: 1.1, dh: 0.2, pf: 0.17, eye: 'round', cols: ['#ffb614', '#ffd23a', '#fff0a0', 'rgba(255,215,90,0.85)'], style: 'ogon' },
];

// ---- textures (one per species, cached) ---------------------------------------------------------------------------------------------
const blotch = (g, x, y, rx, ry, col, soft = 0.5) => {
  g.save(); g.translate(x, y); g.scale(rx, ry);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1); rg.addColorStop(0, col); rg.addColorStop(soft, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
};
const texCache = new Map();
function bodyTexture(k) {
  if (texCache.has('b' + k)) return texCache.get('b' + k);
  const sp = SPECIES[k], W = 256, H = 128, c = mk(W, H), g = c.getContext('2d');
  // v: 0 = back, 0.5 = belly, 1 = back again (u: 0 snout .. 1 tail)
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, sp.cols[0]); gr.addColorStop(0.24, sp.cols[1]); gr.addColorStop(0.5, sp.cols[2]); gr.addColorStop(0.76, sp.cols[1]); gr.addColorStop(1, sp.cols[0]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const mirror = (fn) => { fn(0); g.save(); g.translate(0, H); g.scale(1, -1); fn(1); g.restore(); };   // paint the same patch on both flanks (v and 1 - v)
  if (sp.style === 'sarasa') mirror((s) => { for (let i = 0; i < 4; i++) blotch(g, W * (0.18 + hash(i, 1, s) * 0.62), H * (0.04 + hash(i, 2, s) * 0.2), W * (0.1 + hash(i, 3) * 0.1), H * 0.2, '#ff3416', 0.55); });
  if (sp.style === 'calico') {
    mirror((s) => {
      for (let i = 0; i < 6; i++) blotch(g, W * (0.1 + hash(i, 11, s) * 0.85), H * (0.02 + hash(i, 12, s) * 0.3), W * (0.05 + hash(i, 13) * 0.09), H * (0.1 + hash(i, 14) * 0.12), i % 3 === 0 ? '#ff3a1c' : i % 3 === 1 ? '#1b1b26' : '#ff8a30', 0.5);
      for (let i = 0; i < 4; i++) blotch(g, W * (0.15 + hash(i, 15, s) * 0.8), H * (0.06 + hash(i, 16, s) * 0.3), W * 0.04, H * 0.07, '#3b4a8a', 0.4);
    });
  }
  if (sp.style === 'hood') { blotch(g, W * 0.1, H * 0.02, W * 0.2, H * 0.22, '#fff3e2', 0.6); blotch(g, W * 0.1, H * 0.98, W * 0.2, H * 0.22, '#fff3e2', 0.6); }
  if (sp.style === 'tosa') { mirror(() => blotch(g, W * 0.2, H * 0.03, W * 0.2, H * 0.2, '#fff0e6', 0.5)); }
  if (sp.style === 'pearl') {
    mirror(() => { blotch(g, W * 0.08, H * 0.03, W * 0.12, H * 0.2, '#ff5a30', 0.5); });
    for (let r = 0; r < 7; r++) for (let q = 0; q < 16; q++) {
      const x = q * (W / 15) + (r % 2 ? W / 30 : 0), y = r * (H / 6.4) + 3, pr = 7.5;
      const pg = g.createRadialGradient(x - 2, y - 2, 0.5, x, y, pr); pg.addColorStop(0, 'rgba(255,255,255,0.95)'); pg.addColorStop(0.55, 'rgba(255,238,220,0.55)'); pg.addColorStop(1, 'rgba(190,150,130,0.35)');
      g.fillStyle = pg; g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fill();
    }
  }
  if (sp.style === 'ogon') {
    const sh = g.createLinearGradient(0, 0, W, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.35, 'rgba(255,255,230,0.5)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(0.8, 'rgba(255,235,150,0.35)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
  }
  // scales: rows of small arcs over the whole fish, fading toward the head; gill cover line
  g.lineWidth = 1;
  for (let r = 0; r < 12; r++) for (let q = 0; q < 34; q++) {
    const u = q / 34 + (r % 2 ? 0.015 : 0); if (u < 0.28) continue;
    const x = u * W, y = (r + 0.5) * (H / 12);
    g.strokeStyle = sp.style === 'velvet' ? 'rgba(120,130,170,0.18)' : 'rgba(255,255,255,0.2)';
    g.beginPath(); g.arc(x, y, 5.2, -1.2, 1.2); g.stroke();
    g.strokeStyle = 'rgba(40,10,10,0.1)'; g.beginPath(); g.arc(x + 1.2, y, 5.2, -1.2, 1.2); g.stroke();
  }
  g.strokeStyle = sp.style === 'velvet' ? 'rgba(0,0,0,0.5)' : 'rgba(70,20,10,0.34)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(W * 0.27, 0); g.lineTo(W * 0.27, H); g.stroke();
  const t = texOf(c, { wrap: false }); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  texCache.set('b' + k, t); return t;
}
function finTexture(k) {
  if (texCache.has('f' + k)) return texCache.get('f' + k);
  const sp = SPECIES[k], S = 128, c = mk(S, S), g = c.getContext('2d');
  // x across the fan (rays), y along it: root (top, more opaque) -> rim (bottom, clear and light)
  const col = sp.cols[3];
  const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, col); gr.addColorStop(0.55, col.replace(/[\d.]+\)$/, '0.5)')); gr.addColorStop(1, 'rgba(255,255,255,0.14)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 17; i++) { const x = (i / 16) * S; g.strokeStyle = `rgba(255,255,255,${0.2 + hash(i, 3) * 0.2})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(S / 2 + (x - S / 2) * 0.08, 0); g.lineTo(x, S); g.stroke(); }
  for (let i = 0; i < 17; i++) { const x = ((i + 0.5) / 16) * S; g.strokeStyle = 'rgba(60,10,10,0.1)'; g.lineWidth = 1; g.beginPath(); g.moveTo(S / 2 + (x - S / 2) * 0.08, 0); g.lineTo(x, S); g.stroke(); }
  const t = texOf(c, { wrap: false }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  texCache.set('f' + k, t); return t;
}

const prof = (u) => { const a = u < 0.36 ? (u - 0.36) / 0.36 : (u - 0.36) / 0.64; const p = Math.pow(Math.max(0, 1 - a * a), 0.7); return u < 0.36 ? p : Math.max(p, 0.15); };
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.12, metalness: 0.2 });
const eyeGeo = new THREE.SphereGeometry(1, 14, 10);

// quality: 0 low (fewer rings), 1 medium, 2 high
export function createFish(k, quality = 2) {
  const sp = SPECIES[k];
  const N = quality === 0 ? 14 : 20, M = quality === 0 ? 9 : 13;      // body rings, points around
  const RAYS = quality === 0 ? 9 : 13, STEP = quality === 0 ? 6 : 9;  // tail
  // ---- body
  const bw = (M + 1) * (N + 1);
  const bPos = new Float32Array(bw * 3), bUv = new Float32Array(bw * 2), bIdx = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) { const n = i * (M + 1) + j; bUv[n * 2] = i / N; bUv[n * 2 + 1] = j / M; }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; bIdx.push(a, b, a + 1, a + 1, b, b + 1); }
  const bodyGeo = new THREE.BufferGeometry();
  const bAttr = new THREE.BufferAttribute(bPos, 3); bAttr.setUsage(35048);
  bodyGeo.setAttribute('position', bAttr); bodyGeo.setAttribute('uv', new THREE.BufferAttribute(bUv, 2)); bodyGeo.setIndex(bIdx);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: bodyTexture(k), roughness: sp.style === 'velvet' ? 0.62 : sp.style === 'pearl' ? 0.3 : 0.38, metalness: sp.style === 'ogon' ? 0.55 : 0,
    envMapIntensity: sp.style === 'ogon' ? 1.6 : 0.9,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat); body.castShadow = true; body.frustumCulled = false;

  // ---- fins: tail (two layers), dorsal, two pectorals in ONE geometry with the species fin texture
  const tailV = (RAYS + 1) * (STEP + 1), dorN = 11, dorR = 4, dorV = dorN * dorR, pecC = 5, pecR = 3, pecV = pecC * pecR;
  const nV = tailV * 2 + dorV + pecV * 2;
  const fPos = new Float32Array(nV * 3), fUv = new Float32Array(nV * 2), fIdx = [];
  let off = 0;
  const grid = (cols, rows, uvf) => {   // adds a (cols x rows) vertex grid; uvf(c,r) -> [u,v]
    const base = off;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const [u, v] = uvf(c, r); fUv[(off) * 2] = u; fUv[off * 2 + 1] = v; off++; }
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const a = base + r * cols + c, b = a + cols; fIdx.push(a, b, a + 1, a + 1, b, b + 1); }
    return base;
  };
  const tail0 = grid(RAYS + 1, STEP + 1, (c, r) => [c / RAYS, r / STEP]);
  const tail1 = grid(RAYS + 1, STEP + 1, (c, r) => [c / RAYS, r / STEP]);
  const dor0 = grid(dorN, dorR, (c, r) => [c / (dorN - 1), r / (dorR - 1)]);
  const pecL = grid(pecC, pecR, (c, r) => [r / (pecR - 1), c / (pecC - 1)]);
  const pecR0 = grid(pecC, pecR, (c, r) => [r / (pecR - 1), c / (pecC - 1)]);
  const finGeo = new THREE.BufferGeometry();
  const fAttr = new THREE.BufferAttribute(fPos, 3); fAttr.setUsage(35048);
  finGeo.setAttribute('position', fAttr); finGeo.setAttribute('uv', new THREE.BufferAttribute(fUv, 2)); finGeo.setIndex(fIdx);
  const finMat = new THREE.MeshStandardMaterial({ map: finTexture(k), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.55, envMapIntensity: 0.6 });
  const fins = new THREE.Mesh(finGeo, finMat); fins.frustumCulled = false; fins.renderOrder = 1;

  // ---- eyes
  const group = new THREE.Group();
  group.add(body, fins);
  const eyes = [1, -1].map(() => { const m = new THREE.Mesh(eyeGeo, eyeMat); group.add(m); return m; });
  // the spec (L and the shape numbers) are applied in pose(); scale of the eye spheres follows L
  const R = { L: 0.09, sp, k };

  const spine = (u, ph, amp) => amp * Math.pow(u, 1.25) * Math.sin(ph - u * 3.3);

  // L: body length (m); ph: swim phase; boost 0..1 how hard it swims; flap: 0..1 extra fin flutter (a fish out of the water on the paper)
  function pose(L, ph, boost = 0, flap = 0) {
    R.L = L;
    const wr = sp.wr, hw0 = (L * wr) / 2, amp = L * (0.055 + 0.05 * boost + 0.05 * flap);
    // body
    for (let i = 0; i <= N; i++) {
      const u = i / N, pf = prof(u), x = L * (0.5 - u), zc = spine(u, ph, amp);
      const hw = hw0 * pf, hh = hw * sp.hr;
      const wen = sp.wen ? 1 + 0.22 * Math.exp(-Math.pow((u - 0.16) / 0.1, 2)) : 1;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU, cy = Math.cos(a), sz = Math.sin(a);
        // flattened belly, rounded back (and the hood of the Ranchu on top of the head)
        const y = hh * (cy > 0 ? cy * wen : cy * 0.85) - hh * 0.0, z = hw * sz;
        const n = (i * (M + 1) + j) * 3; bPos[n] = x; bPos[n + 1] = y; bPos[n + 2] = z + zc;
      }
    }
    bAttr.needsUpdate = true; bodyGeo.computeVertexNormals();
    // tail
    const Tl = L * sp.tl * 0.78, spread = 0.46 + 0.1 * sp.tw, fork = 0.18 + 0.1 * sp.tw;
    const zRoot = spine(1, ph, amp), tilt = Math.atan2(spine(1, ph, amp) - spine(0.93, ph, amp), -L * 0.07) * 0.6;
    for (let layer = 0; layer < 2; layer++) {
      const base = layer ? tail1 : tail0, sc = layer ? 0.86 : 1, lag = layer ? 0 : 0.7;
      for (let r = 0; r <= RAYS; r++) {
        const c = (r / RAYS) * 2 - 1, ac = Math.abs(c);
        const a = c * spread * sc + tilt, len = Tl * sc * (1 - fork * (1 - ac) * 0.9) * (0.92 + 0.08 * Math.cos(c * 3));
        for (let s = 0; s <= STEP; s++) {
          const v = s / STEP, d = v * len;
          const wave = Math.sin(ph * 1.2 - 4.4 - lag - ac * 1.3 - v * 2.2) * (0.1 + 0.12 * boost + 0.1 * flap) * len * ac * Math.sign(c || 1) * v;
          const rip = sp.style === 'tosa' ? Math.sin(c * 9 + ph * 1.3) * len * 0.035 * v * v : Math.sin(c * 5 + ph) * len * 0.012 * v;
          const y = -0.1 * len * v * v + Math.sin(ph * 1.1 - v * 5 - ac * 2 - lag) * 0.07 * len * v + rip + (layer ? 0.002 : 0);
          const n = (base + r * 0 + s * (RAYS + 1) + r) * 3;
          fPos[n] = -L * 0.5 - Math.cos(a) * d; fPos[n + 1] = y; fPos[n + 2] = zRoot + Math.sin(a) * d + wave;
        }
      }
    }
    // dorsal fin (a sail rising from the back, tip trailing)
    if (sp.dh > 0) {
      const u0 = 0.3, u1 = 0.88, H = L * sp.dh * (1 + 0.15 * boost);
      for (let c = 0; c < dorN; c++) {
        const t = c / (dorN - 1), u = u0 + (u1 - u0) * t, pf = prof(u), hw = hw0 * pf, hh = hw * sp.hr;
        const shape = Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.35 * t);
        for (let r = 0; r < dorR; r++) {
          const q = r / (dorR - 1), n = (dor0 + r * dorN + c) * 3;
          fPos[n] = L * (0.5 - u) - q * H * 0.55 * shape; fPos[n + 1] = hh * 0.92 + q * H * shape; fPos[n + 2] = spine(u, ph, amp) + Math.sin(ph * 1.3 - u * 4 - q) * 0.03 * H * q;
        }
      }
    } else for (let q = 0; q < dorV; q++) { const n = (dor0 + q) * 3; fPos[n] = L * 0.1; fPos[n + 1] = 0; fPos[n + 2] = 0; }
    // pectoral fins (paddle back and out, flapping)
    const u = 0.3, hwp = hw0 * prof(u);
    for (const side of [1, -1]) {
      const base = side > 0 ? pecL : pecR0, Pl = L * sp.pf * 1.4, flapA = 0.5 + 0.28 * Math.sin(ph * 1.4 + side * 0.8) + 0.4 * flap * Math.sin(ph * 4 + side);
      const zr = spine(u, ph, amp) + side * hwp * 0.92, xr = L * (0.5 - u), yr = -hwp * sp.hr * 0.25;
      const dx = -Math.cos(flapA) * Pl, dz = side * Math.sin(flapA) * Pl, dy = -0.12 * Pl;
      for (let r = 0; r < pecR; r++) for (let c = 0; c < pecC; c++) {
        const t = c / (pecC - 1), w = (r / (pecR - 1)) * 2 - 1, wd = Math.sin(Math.PI * (0.15 + 0.85 * t)) * Pl * 0.28 * (1 - 0.3 * t), n = (base + r * pecC + c) * 3;
        fPos[n] = xr + dx * t + w * wd * 0.35; fPos[n + 1] = yr + dy * t + w * wd * 0.55 * 0.4; fPos[n + 2] = zr + dz * t;
      }
    }
    fAttr.needsUpdate = true; finGeo.computeVertexNormals();
    // eyes
    const eu = 0.095, ehw = hw0 * prof(eu), er = sp.eye === 'tele' ? L * 0.052 : L * 0.026;
    eyes.forEach((m, i) => {
      const side = i ? -1 : 1;
      m.position.set(L * (0.5 - eu), ehw * sp.hr * (sp.eye === 'tele' ? 0.42 : 0.45), side * (ehw * (sp.eye === 'tele' ? 0.98 : 0.8) + (sp.eye === 'tele' ? er * 0.5 : 0)));
      m.scale.set(er, er * (sp.eye === 'tele' ? 0.95 : 0.9), er);
    });
  }
  pose(0.09, 0, 0, 0);
  return {
    group, pose, spec: sp, k,
    dispose() { bodyGeo.dispose(); finGeo.dispose(); bodyMat.dispose(); finMat.dispose(); },
  };
}
export const fishLen = (len, size) => len * size * 0.00138;   // tank units -> metres (a little over real size so it reads on a phone)
export { clamp };
