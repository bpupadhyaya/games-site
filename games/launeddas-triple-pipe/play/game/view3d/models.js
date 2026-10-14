// Launeddas Triple Pipe: the 3D models. Everything is procedural (canvas textures + analytic geometry). The pipes group is built in
// "art units" (the 620 x 380 box of the 2D art, y up, origin at its centre) so the presenter only scales and places it.
//
// Real-world scale (STATUS.md 'Scale'): a launeddas is three cane pipes about 20-45 cm long (the drone, "tumbu", is the longest,
// the "mancosa" and the "mancosedda" shorter), bound with waxed cord; the reed ("cabitzina") sits in a beeswax-wrapped collar.
// Here the longest pipe is 282 units, so 1 unit is about 1.4 mm; the finger holes are 11 units (about 15 mm). No enlargement.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

const TAU = Math.PI * 2;
export function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, { repeat, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---- textures ---------------------------------------------------------------------------------------------------------------------
/** Cane: warm pale gold, long fibres, mottling, and dark growth nodes at the given fractions (0 top .. 1 bottom). */
export function caneTextures(nodes, seed = 1) {
  const W = 128, H = 512, c = cv(W, H), x = c.getContext('2d'), b = cv(W, H), bx = b.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ecd08c'); g.addColorStop(0.5, '#dfb868'); g.addColorStop(1, '#c99a45');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const px = r() * W, a = 0.04 + r() * 0.12, dark = r() < 0.6, y0 = r() * H, len = 40 + r() * 260;
    x.strokeStyle = dark ? `rgba(90,52,16,${a})` : `rgba(255,244,205,${a})`; x.lineWidth = 0.6 + r() * 1.4;
    x.beginPath(); x.moveTo(px, y0); x.lineTo(px + (r() - 0.5) * 3, y0 + len); x.stroke();
    bx.strokeStyle = dark ? `rgba(0,0,0,${a * 1.4})` : `rgba(255,255,255,${a})`; bx.lineWidth = 1;
    bx.beginPath(); bx.moveTo(px, y0); bx.lineTo(px, y0 + len); bx.stroke();
  }
  for (let i = 0; i < 40; i++) { const px = r() * W, py = r() * H; x.fillStyle = `rgba(110,60,20,${0.05 + r() * 0.1})`; x.beginPath(); x.ellipse(px, py, 1 + r() * 3, 3 + r() * 8, 0, 0, TAU); x.fill(); }
  for (const f of nodes) {
    const y = f * H;
    const gr = x.createLinearGradient(0, y - 9, 0, y + 9);
    gr.addColorStop(0, 'rgba(70,36,10,0)'); gr.addColorStop(0.35, 'rgba(70,36,10,0.55)'); gr.addColorStop(0.5, 'rgba(40,18,4,0.8)'); gr.addColorStop(0.65, 'rgba(70,36,10,0.5)'); gr.addColorStop(1, 'rgba(70,36,10,0)');
    x.fillStyle = gr; x.fillRect(0, y - 9, W, 18);
    x.fillStyle = 'rgba(255,240,190,0.35)'; x.fillRect(0, y - 11, W, 2);
    const bg = bx.createLinearGradient(0, y - 8, 0, y + 8); bg.addColorStop(0, '#808080'); bg.addColorStop(0.5, '#e0e0e0'); bg.addColorStop(1, '#808080');
    bx.fillStyle = bg; bx.fillRect(0, y - 8, W, 16);
  }
  return { map: tex(c, { aniso: 8 }), bump: tex(b, { srgb: false }) };
}
function stoneTex(seed = 7) {
  const W = 512, H = 512, c = cv(W, H), x = c.getContext('2d'), b = cv(W, H), bx = b.getContext('2d'), r = rngOf(seed);
  x.fillStyle = '#5b4a52'; x.fillRect(0, 0, W, H); bx.fillStyle = '#707070'; bx.fillRect(0, 0, W, H);
  const rows = 9, rh = H / rows;
  for (let j = 0; j < rows; j++) {
    let px = -r() * 40;
    while (px < W) {
      const w = 50 + r() * 70, tone = 0.8 + r() * 0.4;
      const R = Math.round(120 * tone), G = Math.round(98 * tone), Bl = Math.round(100 * tone);
      x.fillStyle = `rgb(${R},${G},${Bl})`; x.fillRect(px + 1.5, j * rh + 1.5, w - 3, rh - 3);
      const gr = x.createLinearGradient(px, j * rh, px + w, (j + 1) * rh); gr.addColorStop(0, 'rgba(255,230,200,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)');
      x.fillStyle = gr; x.fillRect(px + 1.5, j * rh + 1.5, w - 3, rh - 3);
      bx.fillStyle = '#c0c0c0'; bx.fillRect(px + 2, j * rh + 2, w - 4, rh - 4);
      px += w;
    }
  }
  for (let i = 0; i < 3000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,220,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  const t = tex(c, { aniso: 4 }); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const bt = tex(b, { srgb: false }); bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
  return { map: t, bump: bt };
}
function cordTex() {
  const c = cv(64, 64), x = c.getContext('2d');
  x.fillStyle = '#b8321f'; x.fillRect(0, 0, 64, 64);
  for (let i = -64; i < 128; i += 10) { x.strokeStyle = 'rgba(40,6,2,0.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 40, 0); x.stroke(); x.strokeStyle = 'rgba(255,170,140,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(i + 4, 64); x.lineTo(i + 44, 0); x.stroke(); }
  const t = tex(c, { repeat: [6, 1] });
  return t;
}
function leatherTex() {
  const c = cv(256), x = c.getContext('2d'), r = rngOf(5), b = cv(256), bx = b.getContext('2d');
  const g = x.createRadialGradient(100, 90, 10, 128, 128, 190); g.addColorStop(0, '#e89a58'); g.addColorStop(1, '#8a4a1e');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); bx.fillStyle = '#808080'; bx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { const px = r() * 256, py = r() * 256; x.strokeStyle = `rgba(80,36,10,${0.05 + r() * 0.12})`; x.lineWidth = 0.8; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 20, py + r() * 30, px + 30, py - r() * 30, px + 50 + r() * 20, py + (r() - 0.5) * 30); x.stroke(); bx.strokeStyle = 'rgba(0,0,0,0.3)'; bx.stroke(); }
  for (let i = 0; i < 4000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.07)' : 'rgba(60,24,6,0.09)'; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); bx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'; bx.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = tex(c); return glowTex;
}
export function skyTexture(w = 4, h = 512) {
  const c = cv(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d0a26'); g.addColorStop(0.32, '#2e1d50'); g.addColorStop(0.52, '#6a2f62'); g.addColorStop(0.7, '#c4503f'); g.addColorStop(0.86, '#f28a4a'); g.addColorStop(1, '#ffc16a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return tex(c, { aniso: 1 });
}

// ---- the three pipes and the cheek reservoir ----------------------------------------------------------------------------------
export const PIPES = [
  { x: 235, top: 14, w: 40, nodes: 5, key: 'drone' },
  { x: 312, top: 78, w: 32, nodes: 3, key: 'low' },
  { x: 384, top: 50, w: 32, nodes: 4, key: 'high' },
];
const BOTTOM = 296;
export const HOLES = [
  { pipe: 1, y: 146, lane: 0 }, { pipe: 1, y: 192, lane: 1 },
  { pipe: 2, y: 118, lane: 2 }, { pipe: 2, y: 164, lane: 3 }, { pipe: 2, y: 210, lane: 4 },
];
export const LANE_HEX = ['#6fe0d0', '#6fe0d0', '#ffd36a', '#ffd36a', '#ffd36a'];
const ax = (x) => x - 310, ay = (y) => -(y - 190);

export function buildPipes() {
  const g = new THREE.Group(); g.name = 'pipes';
  const m = { holes: [], glows: [], rings: [], pipeMeshes: [], glow: [] };
  const brass = B.material('brass', { color: '#d9a948', color2: '#f4d98a', repeat: [1, 1], envIntensity: 1.8 });
  const cord = cordTex();
  const cordMat = new THREE.MeshStandardMaterial({ map: cord, roughness: 0.7, metalness: 0 });
  const waxMat = new THREE.MeshPhysicalMaterial({ color: '#f1dca0', roughness: 0.5, clearcoat: 0.3, emissive: '#3a2406', emissiveIntensity: 0.4 });
  const hornMat = new THREE.MeshPhysicalMaterial({ color: '#d98a2e', roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const holeMat = new THREE.MeshBasicMaterial({ color: '#150804' });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#7a4416', roughness: 0.6 });
  const nodeMat = new THREE.MeshStandardMaterial({ color: '#8a5a22', roughness: 0.55 });
  const blob = (w, h, op) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: op, depthWrite: false }));
    return mesh;
  };
  // ground shadow under the instrument
  const sh = blob(420, 60, 0.55); sh.position.set(0, ay(374), -30); g.add(sh);

  PIPES.forEach((p, i) => {
    const len = BOTTOM - p.top, r = p.w / 2, cx = ax(p.x), cy = ay((p.top + BOTTOM) / 2);
    const fr = []; for (let k = 1; k <= p.nodes; k++) fr.push(k / (p.nodes + 1));
    const T = caneTextures(fr, 3 + i * 7);
    const mat = new THREE.MeshPhysicalMaterial({ map: T.map, bumpMap: T.bump, bumpScale: 1.2, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.35, metalness: 0, envMapIntensity: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, len, 36, 1, false), mat);
    body.position.set(cx, cy, 0); g.add(body);
    // nodes: slightly proud rings
    for (const f of fr) {
      const yy = ay(p.top + f * len), rr = r * (0.9 + 0.1 * f) + 0.5;
      const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 1.3, 8, 32), nodeMat); t.rotation.x = Math.PI / 2; t.position.set(cx, yy, 0); g.add(t);
    }
    // the flare (horn bell) at the top, the beeswax collar and the reed
    const flare = new THREE.Mesh(B.lathe([[0, -3], [r * 0.9, -3], [r * 1.22, 2], [r * 1.18, 8], [r * 0.96, 11], [r * 0.5, 12], [0, 12]], 36), hornMat);
    flare.position.set(cx, ay(p.top) - 3, 0); g.add(flare);
    const rh = Math.max(12, p.w * 0.55), rw = p.w * 0.18;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(rw, rw * 1.08, rh, 20), waxMat); collar.position.set(cx, ay(p.top) + 9 + rh / 2, 0); g.add(collar);
    for (let k = 0; k < 3; k++) {
      const th = new THREE.Mesh(new THREE.TorusGeometry(rw * 1.09, 1.1, 6, 20), cordMat); th.rotation.x = Math.PI / 2; th.position.set(cx, ay(p.top) + 12 + k * rh * 0.28, 0); g.add(th);
    }
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(rw * 0.55, rw * 0.7, 9, 10), new THREE.MeshStandardMaterial({ color: '#8a6a30', roughness: 0.5 })); reed.position.set(cx, ay(p.top) + 9 + rh + 3, 0); g.add(reed);
    // sound glow at the mouth
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(r * 7, r * 7), new THREE.MeshBasicMaterial({ map: glowTexture(), color: i === 0 ? '#ffd890' : i === 1 ? '#7ff0df' : '#ffd36a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.set(cx, ay(p.top) + 8, r + 6); g.add(gl); m.glow[i] = gl;
    // binding cords
    for (const yy of [236, 262]) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r + 1.4, 3.2, 8, 36), cordMat); t.rotation.x = Math.PI / 2; t.position.set(cx, ay(yy), 0); g.add(t);
    }
    m.pipeMeshes.push(body);
  });
  // cords between the pipes
  for (const yy of [236, 262]) {
    const x0 = ax(PIPES[0].x), x1 = ax(PIPES[2].x);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, x1 - x0, 10), cordMat); c.rotation.z = Math.PI / 2; c.position.set((x0 + x1) / 2, ay(yy), 0); g.add(c);
  }
  // finger holes
  HOLES.forEach((h) => {
    const p = PIPES[h.pipe], r = p.w / 2, cx = ax(p.x), cy = ay(h.y);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), holeMat); disc.scale.set(p.w * 0.3, p.w * 0.22, 1); disc.position.set(cx, cy, r + 0.35); g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 6, 28), rimMat); rim.scale.set(p.w * 0.31, p.w * 0.23, 1); rim.position.set(cx, cy, r + 0.6); g.add(rim);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 2.1, p.w * 2.1), new THREE.MeshBasicMaterial({ map: glowTexture(), color: LANE_HEX[h.lane], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(cx, cy, r + 3); g.add(glow);
    const lit = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: LANE_HEX[h.lane], transparent: true, opacity: 0 }));
    lit.scale.set(p.w * 0.28, p.w * 0.2, 1); lit.position.set(cx, cy, r + 0.9); g.add(lit);
    m.holes[h.lane] = { disc, glow, lit };
  });
  // the cheek reservoir (the bag of air): leather sphere in front of the bottom of the pipes
  const L = leatherTex();
  const bagMat = new THREE.MeshPhysicalMaterial({ map: L.map, bumpMap: L.bump, bumpScale: 1.4, roughness: 0.5, clearcoat: 0.25, emissive: '#ff3a1a', emissiveIntensity: 0 });
  const bag = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), bagMat);
  bag.position.set(0, ay(326), 14); g.add(bag);
  const bagGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff5a30', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  bagGlow.position.set(0, ay(326), 30); g.add(bagGlow);
  // the dashed hint / squeeze ring is painted by the 2D layer
  // drone sound rings
  const ringGeo = new THREE.RingGeometry(0.93, 1, 48, 1, Math.PI * 0.15, Math.PI * 0.7);
  for (let i = 0; i < 3; i++) {
    const rg = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffe4a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    rg.position.set(ax(PIPES[0].x), ay(PIPES[0].top) + 18, 8); g.add(rg); m.rings.push(rg);
  }
  m.bag = bag; m.bagMat = bagMat; m.bagGlow = bagGlow; m.shadow = sh;
  g.userData = m;
  void brass;
  return g;
}

// ---- backdrop: sky, stars, sun, hills, the stone tower, ground ----------------------------------------------------------------
export function buildBackdrop() {
  const g = new THREE.Group(); g.name = 'backdrop';
  const o = { stars: null, sun: null, tower: null, tower2: null, hills: [], ground: null, door: null, sky: null, mote: null };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false, depthWrite: false }));
  sky.position.z = -1400; g.add(sky); o.sky = sky;
  // stars
  const n = 90, pos = new Float32Array(n * 3), r = rngOf(11);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 2; pos[i * 3 + 1] = r() * 0.6; pos[i * 3 + 2] = 0; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff4d8', size: 7, map: glowTexture(), sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
  stars.position.z = -1390; g.add(stars); o.stars = stars;
  // sun glow
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffb468', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.position.z = -1300; g.add(sun); o.sun = sun;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.9, fog: false }));
  disc.position.z = -1290; g.add(disc); o.disc = disc;
  // two far hill silhouettes
  const mk = (seed, col, z, amp) => {
    const rr = rngOf(seed), sh = new THREE.Shape();
    sh.moveTo(-1, -1);
    void rr;
    for (let i = 0; i <= 60; i++) { const x = -1 + (i / 60) * 2; sh.lineTo(x, 0.3 * amp * (Math.sin(i * 0.17 + seed) * 0.5 + Math.sin(i * 0.43 + seed * 2) * 0.22 + 0.45)); }
    sh.lineTo(1, -1); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col, fog: false }));
    m.position.z = z; g.add(m); return m;
  };
  o.hills.push(mk(3, '#8a3d58', -1100, 1), mk(8, '#5a2650', -700, 0.8));
  // the stone tower: truncated cone with an overhanging top (corbels), merlons, doorway and a lower side tower
  const st = stoneTex();
  const towerMat = new THREE.MeshStandardMaterial({ map: st.map, bumpMap: st.bump, bumpScale: 2, roughness: 0.9, color: '#d8b8b0' });
  const towerGeo = () => B.lathe([[0, 0], [0.5, 0], [0.45, 0.35], [0.31, 0.82], [0.31, 0.83], [0.4, 0.88], [0.4, 0.9], [0.34, 0.9], [0.34, 1], [0, 1]], 28);
  const mkTower = () => {
    const tg = new THREE.Group(), body = new THREE.Mesh(towerGeo(), towerMat); tg.add(body);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const mer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), towerMat); mer.position.set(Math.cos(a) * 0.32, 1.03, Math.sin(a) * 0.32); tg.add(mer); }
    return tg;
  };
  o.tower = mkTower(); o.tower.position.z = -240; g.add(o.tower);
  o.tower2 = mkTower(); o.tower2.position.z = -270; g.add(o.tower2);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), new THREE.MeshBasicMaterial({ color: '#ff9a3a', fog: false })); door.position.set(0, 0.13, 0.5); o.tower.add(door); o.door = door;
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff9a3a', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); doorGlow.position.set(0, 0.16, 0.52); o.tower.add(doorGlow);
  // ground
  const gt = cv(256, 64), gx = gt.getContext('2d'); const gg = gx.createLinearGradient(0, 0, 0, 64); gg.addColorStop(0, '#2e1820'); gg.addColorStop(1, '#120a0c'); gx.fillStyle = gg; gx.fillRect(0, 0, 256, 64);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(gt, { aniso: 1 }), fog: false }));
  ground.position.z = -20; g.add(ground); o.ground = ground;
  // fireflies / dust motes
  const fn = 36, fp = new Float32Array(fn * 3);
  for (let i = 0; i < fn; i++) { fp[i * 3] = r(); fp[i * 3 + 1] = r(); fp[i * 3 + 2] = r(); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fn * 3), 3));
  const fm = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#ffd890', size: 6, sizeAttenuation: false, map: glowTexture(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  fm.userData = { seed: fp, n: fn }; fm.position.z = 30; fm.frustumCulled = false; g.add(fm); o.mote = fm;
  g.userData = o;
  return g;
}

// ---- plaques (HUD panels and buttons): rounded-rectangle slabs with a bevel and a metal / wood rim ----------------------------
const geoCache = new Map();
export function plaqueGeo(w, h, rad, depth, bevel) {
  w = Math.max(4, Math.round(w)); h = Math.max(4, Math.round(h));
  const key = `${w}x${h}|${rad}|${depth}|${bevel}`;
  let g = geoCache.get(key);
  if (g) return g;
  const r = Math.max(1, Math.min(rad, w / 2 - bevel - 0.5, h / 2 - bevel - 0.5));
  const x0 = -w / 2 + bevel, x1 = w / 2 - bevel, y0 = -h / 2 + bevel, y1 = h / 2 - bevel;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 7 });
  if (geoCache.size > 160) { for (const [k, v] of geoCache) { v.dispose(); geoCache.delete(k); if (geoCache.size < 100) break; } }
  geoCache.set(key, g);
  return g;
}
function boardTex(c0, c1, seed = 3) {
  const S = 256, c = cv(S), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, c0); g.addColorStop(1, c1);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,225,190,0.035)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 14); }
  const t = tex(c, { aniso: 2 }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 260, 1 / 260);
  return t;
}
export function surfaceMats() {
  const phys = (o) => new THREE.MeshPhysicalMaterial({ envMapIntensity: 0.3, ...o });
  return {
    brass: phys({ color: '#c8993a', roughness: 0.3, metalness: 0.9, envMapIntensity: 1.1 }),
    copper: phys({ color: '#9a6430', roughness: 0.35, metalness: 0.85, envMapIntensity: 0.9 }),
    wood: phys({ map: boardTex('#2c170e', '#1a0c07', 4), color: '#ffffff', roughness: 0.78, clearcoat: 0 }),
    field: phys({ map: boardTex('#1c1010', '#0e0707', 8), color: '#ffffff', roughness: 0.7, clearcoat: 0 }),
    ivory: phys({ map: boardTex('#f1e2bb', '#dcc58f', 6), color: '#ffffff', roughness: 0.7, clearcoat: 0 }),
    red: phys({ color: '#b8301a', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    teal: phys({ color: '#14766e', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    slate: phys({ color: '#2a3340', roughness: 0.85 }),
    rimWood: phys({ map: boardTex('#7a4620', '#56300f', 9), color: '#ffffff', roughness: 0.7, clearcoat: 0 }),
  };
}
export const LAYER = { THREE };
