// Tractor Pull 3D: the whole pulling ground as one lit WebGL scene, composited into the 2D game canvas (presentation only).
// The 2D game owns the sim and the HUD; this module reads the world state { rigIdx, ground, track, p, parts, t, cheer } and draws the
// track, the stands with a real 3D crowd, the rig, the sled, the grip strips and the particles. The camera reproduces the 2D art's
// scale and anchor exactly (art.makeCam) so the HUD, the mini-map and the pull feel stay as they were built.
import { createStage, THREE, createCrowd3d } from '../vendor3d/index.js';
import { makeCam, PALS, rigLook } from '../src/art.js';
import { TRACK_M, FT, STRIP_FT, STRIPS } from '../src/sim.js';
import { buildRig, buildSled } from './rig3d.js';

const { Group, Mesh, Color, Fog, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, MeshStandardMaterial: MS, MeshBasicMaterial: MB,
  InstancedMesh, Object3D, Vector3, CanvasTexture, TextureLoader, SpotLight } = THREE;
const TAU = Math.PI * 2;
const D = 26;                                              // camera distance to the lane plane, metres
const MAXW = { low: 700, medium: 1000, high: 1400 };
let T0 = 0, TL = 0; const DBG = /[?&]t3d=1/.test(globalThis.location ? globalThis.location.search : '');
const tick = (name) => new Promise((r) => { if (DBG) { const n = performance.now(); console.log(`[3d] ${name || '-'} +${Math.round(n - TL)}ms`); TL = n; } setTimeout(r, 0); });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { let h = (Math.imul(n | 0, 2654435761) ^ 0x9e3779b9) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; return ((h >>> 0) % 10000) / 10000; };
const rgb = (s) => { const [r, g, b] = s.split(',').map(Number); return [r, g, b]; };

// Lighting and scenery per ground (index = GROUNDS index).
const GROUND = [
  { tod: 'day', sky: 'sky-day', back: 'bd-meadow-day', key: '#fff1da', keyI: 3.3, hemiSky: '#d2e6ff', hemiGround: '#7a6544', hemi: 0.95, exposure: 1.0, env: 0.55, fog: '#d9e5ee', keyOff: [-9, 12, 11], dirt: '#ffffff', lamp: false },
  { tod: 'dusk', sky: 'sky-dusk', back: 'bd-dusk-meadow', key: '#ffa062', keyI: 3.1, hemiSky: '#ffc9a6', hemiGround: '#5a4638', hemi: 0.75, exposure: 1.0, env: 0.45, fog: '#e2a77f', keyOff: [-16, 6, 9], dirt: '#f0cfae', lamp: true },
  { tod: 'night', sky: 'sky-dusk', back: 'bd-dusk-meadow', key: '#9bb2ff', keyI: 1.0, hemiSky: '#6076b4', hemiGround: '#232a3a', hemi: 0.55, exposure: 1.1, env: 0.3, fog: '#16213f', keyOff: [-8, 14, 9], dirt: '#cdb594', lamp: true, spot: true },
  { tod: 'day', sky: 'sky-overcast', back: 'bd-meadow-day', key: '#e3eaf1', keyI: 1.5, hemiSky: '#cfd8e2', hemiGround: '#5e6670', hemi: 1.25, exposure: 0.95, env: 0.4, fog: '#b9c1c9', keyOff: [-6, 14, 8], dirt: '#9d8a74', lamp: false, rain: true },
];

function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const glowTex = () => canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,248,214,1)'); r.addColorStop(0.3, 'rgba(255,236,170,0.55)'); r.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
// A seamless dirt texture drawn from seeded blobs, speckle and pebbles (the photo texture read as wood grain at this scale).
const dirtCanvas = (size = 512) => canvasTex(size, size, (g, w, h) => {
  let a = 1234567; const r = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  g.fillStyle = '#a58760'; g.fillRect(0, 0, w, h);
  const blob = (x, y, rad, col) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); } };
  for (let i = 0; i < 36; i++) { const l = r(); blob(r() * w, r() * h, 24 + r() * 60, l > 0.5 ? `rgba(${120 + r() * 50},${92 + r() * 40},${62 + r() * 30},0.28)` : `rgba(${60 + r() * 30},${42 + r() * 20},${26 + r() * 14},0.26)`); }
  for (let i = 0; i < 380; i++) { const x = r() * w, y = r() * h, rad = 0.7 + r() * 3, l = r(); g.fillStyle = l > 0.5 ? `rgba(220,190,150,${0.1 + r() * 0.2})` : `rgba(30,18,8,${0.14 + r() * 0.24})`; g.beginPath(); g.ellipse(x, y, rad * 1.5, rad, r() * 3, 0, 6.3); g.fill(); }
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, rad = 1 + r() * 2.4; g.fillStyle = `rgba(${110 + r() * 60},${95 + r() * 50},${80 + r() * 40},0.8)`; g.beginPath(); g.arc(x, y, rad, 0, 6.3); g.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 1.2, y + 1.4, rad * 0.9, 0, 6.3); g.fill(); }
});
// The sky: a long strip painted per time of day (gradient by elevation, soft layered clouds, sun or moon and stars), on a far plane.
const SKY = {
  day: { stops: [[0, '#cfe4f4'], [0.14, '#a6cdee'], [0.34, '#6fa9e2'], [1, '#2f6fc4']], cloud: [255, 255, 255], shade: [188, 204, 226], n: 46, sun: null },
  dusk: { stops: [[0, '#ffc56e'], [0.12, '#ff9a62'], [0.26, '#d8688a'], [0.5, '#6a4a8e'], [1, '#27255a']], cloud: [255, 170, 120], shade: [120, 70, 110], n: 38, sun: { x: 0.64, y: 0.1, r: 70, c: '255,214,150' } },
  night: { stops: [[0, '#26375f'], [0.14, '#162448'], [0.34, '#0b1634'], [1, '#040816']], cloud: [60, 76, 120], shade: [20, 30, 60], n: 22, sun: { x: 0.3, y: 0.28, r: 22, c: '235,240,255' }, stars: true },
  rain: { stops: [[0, '#cdd3d8'], [0.14, '#aab2ba'], [0.34, '#8a949e'], [1, '#5f6a75']], cloud: [200, 206, 212], shade: [110, 120, 130], n: 70, sun: null },
};
const skyCanvasTex = (kind) => {
  const W = 4096, H = 512, S = SKY[kind] || SKY.day;
  return canvasTex(W, H, (g, w, h) => {
    let a = kind === 'day' ? 91 : kind === 'dusk' ? 133 : kind === 'night' ? 17 : 211; const r = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
    const gr = g.createLinearGradient(0, h, 0, 0); for (const [t, c] of S.stops) gr.addColorStop(t, c); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (S.stars) for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`; const y = r() * h * 0.78; g.fillRect(r() * w, y, 1.4, 1.4); }
    if (S.sun) { const sx = w * S.sun.x, sy = h * (1 - S.sun.y), sg = g.createRadialGradient(sx, sy, 2, sx, sy, S.sun.r * 7); sg.addColorStop(0, `rgba(${S.sun.c},1)`); sg.addColorStop(0.12, `rgba(${S.sun.c},0.7)`); sg.addColorStop(0.4, `rgba(${S.sun.c},0.18)`); sg.addColorStop(1, `rgba(${S.sun.c},0)`); g.fillStyle = sg; g.fillRect(sx - S.sun.r * 7, sy - S.sun.r * 7, S.sun.r * 14, S.sun.r * 14); }
    const puff = (x, y, rad, k) => {
      for (const dx of [-w, 0, w]) {
        const gx = x + dx, grd = g.createRadialGradient(gx, y - rad * 0.2, rad * 0.1, gx, y, rad);
        grd.addColorStop(0, `rgba(${S.cloud[0]},${S.cloud[1]},${S.cloud[2]},${0.55 * k})`); grd.addColorStop(0.6, `rgba(${S.cloud[0] * 0.93 + S.shade[0] * 0.07 | 0},${S.cloud[1] * 0.93 + S.shade[1] * 0.07 | 0},${S.cloud[2] * 0.93 + S.shade[2] * 0.07 | 0},${0.3 * k})`); grd.addColorStop(1, `rgba(${S.shade[0]},${S.shade[1]},${S.shade[2]},0)`);
        g.fillStyle = grd; g.beginPath(); g.ellipse(gx, y, rad * 1.7, rad * 0.62, 0, 0, 6.3); g.fill();
      }
    };
    for (let i = 0; i < S.n; i++) {
      const cx = r() * w, cy = h * (0.5 + r() * 0.42), size = 28 + r() * 70, k = 0.55 + r() * 0.5;
      for (let j = 0; j < 7; j++) puff(cx + (r() - 0.5) * size * 2.6, cy + (r() - 0.5) * size * 0.5, size * (0.55 + r() * 0.6), k);
    }
    // a low haze band at the horizon
    const hz = g.createLinearGradient(0, h, 0, h * 0.78); hz.addColorStop(0, `rgba(${S.cloud[0]},${S.cloud[1]},${S.cloud[2]},0.35)`); hz.addColorStop(1, `rgba(${S.cloud[0]},${S.cloud[1]},${S.cloud[2]},0)`); g.fillStyle = hz; g.fillRect(0, h * 0.78, w, h * 0.22);
  });
};
const signTex = (txt, sub, hdr = '#c43a22') => canvasTex(256, 172, (g, w, h) => {
  g.fillStyle = '#f8f4ea'; g.fillRect(0, 0, w, h); g.fillStyle = hdr; g.fillRect(0, 0, w, 26);
  g.fillStyle = '#2b1d14'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 92px "Avenir Next Condensed","Arial Narrow",Arial,sans-serif'; g.fillText(txt, w / 2, 96);
  g.font = '700 30px Arial,sans-serif'; g.fillText(sub, w / 2, 148);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
});
const bannerTex = () => canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = '#f8f4ea'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 32; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) { g.fillStyle = '#1c1c1c'; g.fillRect(i * w / 32, j * 26, w / 32, 26); }
  g.fillStyle = '#c43a22'; g.fillRect(0, 78, w, h - 78);
  g.fillStyle = '#fff6e2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 112px "Avenir Next Condensed","Arial Narrow",Arial,sans-serif'; g.fillText('FULL PULL 300 FT', w / 2, 168);
});

export async function createTrack3d({ quality = 'medium', onProgress } = {}) {
  const doc = globalThis.document;
  TL = performance.now(); T0 = TL;
  const canvas = doc.createElement('canvas');
  const stage = createStage({ canvas, container: doc.body, quality, dprCap: 1, transparent: true, shadows: quality !== 'low', lighting: 'day', shadowSize: 16, fov: 30 });
  if (!stage.supported) return null;
  const { scene, camera, renderer } = stage;
  const api = { ok: true, lost: false, quality, stage, avgMs: 0, scale: 1, readyAt: 0, frames: 0 };
  const L = stage.lights;
  camera.near = 1; camera.far = 420;
  const loader = new TextureLoader();
  const SB = new URL('../assets3d/scenery/', import.meta.url).href;
  const loadTex = (name, rep = [1, 1], srgb = true) => new Promise((res) => {
    loader.load(SB + name, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); res(t); }, undefined, () => res(null));
  });

  const world = new Group(); scene.add(world);        // everything except lights (hidden when drawing a rig thumbnail)
  const X0 = -30, X1 = TRACK_M + 40, LEN = X1 - X0, CX = (X0 + X1) / 2;

  // ---------------------------------------------------------------- 1. ground: dirt lane, grip strips, ruts, chalk, clods
  const dirtTex = dirtCanvas(256); dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping; dirtTex.repeat.set(LEN / 2.2, 36 / 2.2); dirtTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const dirtMat = new MS({ map: dirtTex, bumpMap: dirtTex, bumpScale: 1.5, color: GROUND[0].dirt, roughness: 0.96, metalness: 0 });
  const dirt = new Mesh(new PlaneGeometry(LEN, 36), dirtMat); dirt.rotation.x = -Math.PI / 2; dirt.position.set(CX, 0, -3.3 + 18); dirt.receiveShadow = true; world.add(dirt);
  const grassTex = await loadTex('gr-grass.webp', [(LEN + 200) / 2.5, 60]);
  const grassMat = new MS({ map: grassTex || null, color: '#8fa96a', roughness: 1 });
  const grass = new Mesh(new PlaneGeometry(LEN + 200, 150), grassMat); grass.rotation.x = -Math.PI / 2; grass.position.set(CX, -0.01, -3.3 - 75); grass.receiveShadow = true; world.add(grass);
  await tick('ground');

  // grip strips: translucent tinted bands across the lane; dark = damp (more grip), pale = dusty
  const strips = [];
  const stripGeo = new PlaneGeometry(STRIP_FT / FT, 33.6);
  for (let i = 0; i < STRIPS; i++) {
    const mt = new MB({ color: '#000000', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false });
    const m = new Mesh(stripGeo, mt); m.rotation.x = -Math.PI / 2; m.position.set((i + 0.5) * STRIP_FT / FT, 0.004, -3.3 + 16.8); m.renderOrder = 1; world.add(m); strips.push(m);
    if (i > 0) { const ln = new Mesh(new PlaneGeometry(0.06, 33.6), new MB({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, fog: false })); ln.rotation.x = -Math.PI / 2; ln.position.set(i * STRIP_FT / FT, 0.006, -3.3 + 16.8); ln.renderOrder = 2; world.add(ln); }
  }
  // the prepared lane: a slightly darker, packed band the rigs run in
  { const lane = new Mesh(new PlaneGeometry(TRACK_M + 18, 3.8), new MB({ color: '#2a170a', transparent: true, opacity: 0.2, depthWrite: false, fog: false })); lane.rotation.x = -Math.PI / 2; lane.position.set(TRACK_M / 2 + 3, 0.003, 0); lane.renderOrder = 1; world.add(lane); }
  // lane chalk, start line, ruts of the tractor and the sled
  const chalkMat = new MB({ color: '#f4f0e4', transparent: true, opacity: 0.72, depthWrite: false, fog: false });
  for (const z of [-1.9, 1.9]) { const c = new Mesh(new PlaneGeometry(TRACK_M + 14, 0.09), chalkMat); c.rotation.x = -Math.PI / 2; c.position.set(TRACK_M / 2 + 3, 0.008, z); c.renderOrder = 3; world.add(c); }
  const startLine = new Mesh(new PlaneGeometry(0.22, 3.9), chalkMat); startLine.rotation.x = -Math.PI / 2; startLine.position.set(0, 0.009, 0); startLine.renderOrder = 3; world.add(startLine);
  const finLine = new Mesh(new PlaneGeometry(0.4, 3.9), new MB({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, fog: false })); finLine.rotation.x = -Math.PI / 2; finLine.position.set(TRACK_M, 0.009, 0); finLine.renderOrder = 3; world.add(finLine);
  const rutMat = new MB({ color: '#1a0e06', transparent: true, opacity: 0.4, depthWrite: false, fog: false });
  const ruts = [0.72, -0.72].map((z) => { const r = new Mesh(new PlaneGeometry(1, 0.4), rutMat); r.rotation.x = -Math.PI / 2; r.position.set(0, 0.011, z); r.renderOrder = 4; r.visible = false; world.add(r); return r; });
  const drag = new Mesh(new PlaneGeometry(1, 1.3), new MB({ color: '#2a170b', transparent: true, opacity: 0.22, depthWrite: false, fog: false })); drag.rotation.x = -Math.PI / 2; drag.position.set(0, 0.01, 0); drag.renderOrder = 4; drag.visible = false; world.add(drag);
  // scattered clods and stones along the lane edges (deterministic, instanced)
  {
    const n = 420, geo = new SphereGeometry(0.5, 6, 4), mt = new MS({ color: '#6a4a2c', roughness: 1 });
    const inst = new InstancedMesh(geo, mt, n); const o = new Object3D();
    for (let i = 0; i < n; i++) {
      const x = X0 + hash(i * 3 + 1) * LEN, side = hash(i * 7 + 2) > 0.5 ? 1 : -1;
      const z = side > 0 ? 2.1 + hash(i * 11 + 3) * 7 : -2.2 - hash(i * 11 + 3) * 0.8;
      const s = 0.05 + hash(i * 13 + 4) * 0.2;
      o.position.set(x, s * 0.3, z); o.scale.set(s * (1 + hash(i) * 0.6), s * 0.7, s); o.rotation.set(hash(i * 5) * 3, hash(i * 17) * 3, 0); o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
      inst.setColorAt(i, new Color().setHSL(0.07, 0.4, 0.18 + hash(i * 19) * 0.22));
    }
    inst.castShadow = true; inst.receiveShadow = true; world.add(inst);
  }

  // ---------------------------------------------------------------- 2. fence, markers, finish arch, bunting, floodlights
  const white = new MS({ color: '#f2ece0', roughness: 0.55 });
  const FZ = -3.3;
  {
    for (const y of [0.95, 0.5]) { const r = new Mesh(new BoxGeometry(LEN, 0.1, 0.07), white); r.position.set(CX, y, FZ); r.castShadow = true; world.add(r); }
    const n = Math.ceil(LEN / 3), posts = new InstancedMesh(new BoxGeometry(0.12, 1.15, 0.12), white, n), o = new Object3D();
    for (let i = 0; i < n; i++) { o.position.set(X0 + i * 3, 0.57, FZ); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }
    posts.castShadow = true; world.add(posts);
    // low concrete wall under the rail (the crowd stands behind it)
    const wall = new Mesh(new BoxGeometry(LEN, 0.35, 0.3), new MS({ color: '#9b9588', roughness: 0.9 })); wall.position.set(CX, 0.175, FZ - 0.05); wall.receiveShadow = true; world.add(wall);
  }
  const textObjs = [];
  const markers = [];
  for (let f = 50; f < 300; f += 50) {
    const g = new Group(); const tex = signTex(String(f), 'FEET');
    const board = new Mesh(new BoxGeometry(1.5, 1.0, 0.06), new MS({ map: tex, roughness: 0.6 })); board.position.set(0, 1.9, 0); board.castShadow = true; g.add(board); textObjs.push(board);
    for (const dx of [-0.6, 0.6]) { const p = new Mesh(new CylinderGeometry(0.04, 0.04, 2.1, 8), new MS({ color: '#5a4a38', roughness: 0.8 })); p.position.set(dx, 1.05, 0); p.castShadow = true; g.add(p); }
    g.position.set(f / FT, 0, -2.5); world.add(g); markers.push(g);
  }
  {
    // finish arch
    const g = new Group(), ph = 4.6;
    const postM = new MS({ color: '#e9e9e4', roughness: 0.5, metalness: 0.2 });
    for (const dx of [0, 4.2]) { const p = new Mesh(new BoxGeometry(0.3, ph, 0.3), postM); p.position.set(dx, ph / 2, 0); p.castShadow = true; g.add(p); }
    const ban = new Mesh(new BoxGeometry(4.4, 1.1, 0.12), new MS({ map: bannerTex(), roughness: 0.55 })); ban.position.set(2.1, ph + 0.2, 0); ban.castShadow = true; g.add(ban); textObjs.push(ban);
    g.position.set(TRACK_M, 0, -2.4); world.add(g);
  }
  // bunting: flags on sagging strings above the fence, fluttering
  const BUNT = 20, FL = 6, bunt = new InstancedMesh(new THREE.BufferGeometry(), new MB({ side: THREE.DoubleSide, vertexColors: false }), BUNT * FL);
  {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.5, 0], 3)); g.computeVertexNormals();
    bunt.geometry = g; const cols = ['#d94a3a', '#f2c14a', '#3a79c4', '#efe9d8'];
    for (let i = 0; i < BUNT * FL; i++) bunt.setColorAt(i, new Color(cols[i & 3]));
    bunt.frustumCulled = false; world.add(bunt);
    const strGeo = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < BUNT; i++) { const xa = X0 + i * 6, xb = xa + 6; for (let k = 0; k < 8; k++) { const u0 = k / 8, u1 = (k + 1) / 8; for (const u of [u0, u1]) sp.push(xa + (xb - xa) * u, 3.6 - 0.7 * 4 * (u - u * u), FZ); } }
    strGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); world.add(new THREE.LineSegments(strGeo, new THREE.LineBasicMaterial({ color: '#2a2018' })));
  }
  const buntM = new THREE.Matrix4(), buntQ = new THREE.Quaternion(), buntE = new THREE.Euler(), buntP = new Vector3(), buntS = new Vector3(1, 1, 1);

  // floodlight poles (lit at dusk and night)
  const lampMats = [], glows = [];
  {
    const gl = glowTex();
    for (let x = 6; x < X1; x += 30) {
      const g = new Group(), ph = 11;
      const pole = new Mesh(new CylinderGeometry(0.16, 0.24, ph, 10), new MS({ color: '#6c747d', metalness: 0.7, roughness: 0.5 })); pole.position.y = ph / 2; pole.castShadow = true; g.add(pole);
      const head = new Mesh(new BoxGeometry(3.4, 1.3, 0.35), new MS({ color: '#4a525b', metalness: 0.7, roughness: 0.5 })); head.position.set(0, ph + 0.7, 0.2); g.add(head);
      for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
        const lm = new MB({ color: '#fff3c0' }); lampMats.push(lm);
        const l = new Mesh(new SphereGeometry(0.2, 12, 8), lm); l.position.set(-1.2 + k * 0.8, ph + 0.4 + r * 0.55, 0.42); g.add(l);
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gl, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })); sp.scale.set(14, 9, 1); sp.position.set(0, ph + 0.9, 1); g.add(sp); glows.push(sp);
      g.position.set(x, 0, -17); world.add(g);
    }
  }
  await tick('fence+markers+lights');

  // ---------------------------------------------------------------- 3. grandstands: concrete tiers, roof; the crowd goes in below
  {
    const concrete = new MS({ color: '#a9a69c', roughness: 0.92 });
    const steelM = new MS({ color: '#8f99a3', metalness: 0.6, roughness: 0.5 });
    const roofM = new MS({ color: '#c9ced4', metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide });
    const fasTex = canvasTex(1024, 128, (g, w, h) => {
      g.fillStyle = '#7a1f14'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4e6c4'; g.fillRect(0, 8, w, 4); g.fillRect(0, h - 12, w, 4);
      g.fillStyle = '#fff1d0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 70px "Avenir Next Condensed","Arial Narrow",Arial,sans-serif';
      g.fillText('TRACTOR PULL', w * 0.28, h / 2 + 2); g.fillText('300 FT', w * 0.75, h / 2 + 2);
      g.fillStyle = '#e8b64a'; for (const x of [0.52, 0.03, 0.97]) { g.beginPath(); g.arc(w * x, h / 2, 9, 0, 6.3); g.fill(); }
    });
    const blocks = [];
    for (let x = 4; x < X1; x += 25) blocks.push(x);
    for (const cx of blocks) {
      const w = 22, rows = 5, rise = 0.5, depth = 0.9, z0 = -9;
      for (let r = 0; r < rows; r++) {
        const t = new Mesh(new BoxGeometry(w + 1, rise * (r + 1), depth), concrete); t.position.set(cx, rise * (r + 1) / 2, z0 - r * depth); t.receiveShadow = true; t.castShadow = r === rows - 1; world.add(t);
      }
      const roof = new Mesh(new BoxGeometry(w + 3, 0.18, 7.5), roofM); roof.position.set(cx, 5.6, z0 - 2.2); roof.rotation.x = 0.12; roof.castShadow = true; world.add(roof);
      for (const dx of [-w / 2 - 0.5, 0, w / 2 + 0.5]) { const p = new Mesh(new CylinderGeometry(0.1, 0.1, 5.6, 8), steelM); p.position.set(dx + cx, 2.8, z0 - 5.4); p.castShadow = true; world.add(p); }
      const fas = new Mesh(new BoxGeometry(w + 3, 0.95, 0.1), new MS({ map: fasTex, roughness: 0.6 })); fas.position.set(cx, 5.15, z0 + 1.45); world.add(fas); textObjs.push(fas);
      // back wall in shade, and an awning edge in a rig-neutral stripe
      const back = new Mesh(new BoxGeometry(w + 3, 5.4, 0.3), new MS({ color: '#4a4d52', roughness: 0.9 })); back.position.set(cx, 2.7, z0 - 5.9); world.add(back);
    }
  }
  // far scenery props: farmhouses and trees as upright cut-outs (photographic), spread along the whole track
  {
    const [farm, tree1, tree2] = await Promise.all([loadTex('st-farmhouse.webp'), loadTex('tr-round-tree.webp'), loadTex('tr-broad-tree.webp')]);
    const add = (tex, w, h, x, z) => {
      if (!tex) return;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.repeat.set(1, 1);
      const m = new Mesh(new PlaneGeometry(w, h), new MS({ map: tex, transparent: true, alphaTest: 0.35, roughness: 1, side: THREE.DoubleSide }));
      m.position.set(x, h / 2 - 0.2, z); world.add(m);
    };
    for (let i = 0; i < 9; i++) {
      const x = X0 + 6 + i * 16 + hash(i * 7) * 6;
      add(i % 3 === 1 ? tree1 : tree2, 5 + hash(i) * 2, 6.2 + hash(i + 9) * 2, x, -40 - hash(i * 5) * 16);
    }
    for (const x of [18, 70]) add(farm, 14, 10.6, x, -52);
  }
  await tick('stands+cutouts');

  // ---------------------------------------------------------------- 4. scenery (sky dome + a far panorama plane), built lazily per ground
  const scen = [];
  const GRADE = { day: [1, 1, 1], dusk: [1, 0.78, 0.66], night: [0.3, 0.38, 0.62] };
  const buildScen = async (gi) => {
    if (scen[gi]) return scen[gi];
    const G = GROUND[gi];
    const sky = new Mesh(new PlaneGeometry(900, 230), new MB({ map: skyCanvasTex(G.tod === 'dusk' ? 'dusk' : G.tod === 'night' ? 'night' : G.rain ? 'rain' : 'day'), depthWrite: false, fog: false, toneMapped: false }));
    sky.position.set(0, 90, -210); sky.renderOrder = -20;
    const s = { group: new Group(), update() {} };
    s.group.add(sky); s.group.visible = false; scene.add(s.group); s.sky = sky;
    // far hills: the photographic panorama on a flat plane at a distance, mirrored into a seamless strip (its own parallax)
    const bt = await loadTex(G.back + '.webp');
    const grp = new Group(); grp.visible = false;
    if (bt && bt.image) {
      const img = bt.image, iw = img.width, ih = img.height, c = doc.createElement('canvas'); c.width = iw * 2; c.height = ih;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.save(); g.translate(iw * 2, 0); g.scale(-1, 1); g.drawImage(img, 0, 0); g.restore();
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createLinearGradient(0, 0, 0, ih); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,1)'); gr.addColorStop(0.9, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      const tx = new CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      const Hb = 46, Wb = Hb * (c.width / c.height), horizon = 0.55;
      const gd = GRADE[G.tod] || GRADE.day, ov = gi === 3 ? [0.74, 0.8, 0.88] : [1, 1, 1];
      for (const k of [-1, 0, 1]) {
        const mt = new MB({ map: tx, transparent: true, depthWrite: false, fog: false, toneMapped: false });
        mt.color.setRGB(gd[0] * ov[0], gd[1] * ov[1], gd[2] * ov[2]);
        const m = new Mesh(new PlaneGeometry(Wb, Hb), mt); m.position.set(k * Wb, 3.4 - (1 - horizon) * Hb + Hb / 2, -115); m.renderOrder = -15; grp.add(m);
      }
      grp.userData.span = Wb;
    }
    scene.add(grp);
    s.back = grp;
    scen[gi] = s; return s;
  };
  await buildScen(0);
  await tick('scenery');

  // ---------------------------------------------------------------- 5. crowd: real 3D people, instanced (standing at the fence, seated in the stands)
  // One crowd object holds everything (its face and fabric textures are generated per object, so a second object would double the cost).
  let crowd = null, crowdRows = null;
  try {
    const stands = [];
    for (let x = 4; x < X1; x += 25) stands.push({ center: [x, 0.5, -9], yaw: 0, rows: 5, perRow: quality === 'low' ? 14 : 22, width: 22, rise: 0.5, rowDepth: 0.9, fill: 0.92, standing: 0.1 });
    const rows = [{ from: [X0, 0, FZ - 1.2], to: [X1, 0, FZ - 1.2], count: Math.round(LEN / (quality === 'low' ? 2.0 : 1.15)), face: 0 }];
    if (quality !== 'low') rows.push({ from: [X0 + 0.5, 0.0, FZ - 2.3], to: [X1, 0, FZ - 2.3], count: Math.round(LEN / 1.5), face: 0 });
    crowd = createCrowd3d(stage, {
      stands, rows, seed: 41, culture: ['american_rural', 'european_village'], quality: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low',
      excitement: 0.25, props: { flag: 0.03, phone: 0.05, child: 0.05 }, flagColors: ['#c43a22', '#f2f2f2', '#1f4a9a'], blobShadows: true,
    });
  } catch (e) { console.warn('crowd3d failed', e); crowd = null; }
  await tick('crowd');

  // ---------------------------------------------------------------- 6. rigs, sled, chain, particles, rain
  const rigs = [0, 1, 2, 3].map((i) => { const look = rigLook(i); const r = buildRig(look); r.root.scale.setScalar(look.s); r.root.visible = false; r.look = look; world.add(r.root); return r; });
  const sled = buildSled(); world.add(sled.root);
  // chain: instanced links following a sagging curve between the drawbar eye and the sled's front
  const NL = 14, links = new InstancedMesh(new THREE.TorusGeometry(0.07, 0.022, 6, 12), new MS({ color: '#9aa1a9', metalness: 0.9, roughness: 0.35 }), NL);
  links.castShadow = true; links.frustumCulled = false; world.add(links);
  const lo = new Object3D();

  // particles as one Points object with soft / hard / square sprites
  const MAXP = 360;
  const pg = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pCol = new Float32Array(MAXP * 4), pKind = new Float32Array(MAXP);
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  pg.setAttribute('aCol', new THREE.BufferAttribute(pCol, 4)); pg.setAttribute('aKind', new THREE.BufferAttribute(pKind, 1));
  pg.setDrawRange(0, 0);
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 800 } },
    vertexShader: 'uniform float uScale; attribute float aSize; attribute vec4 aCol; attribute float aKind; varying vec4 vCol; varying float vKind;\nvoid main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = max(1.0, aSize*uScale/(-mv.z)); vCol = aCol; vKind = aKind; }',
    fragmentShader: 'varying vec4 vCol; varying float vKind;\nvoid main(){ vec2 c = gl_PointCoord-0.5; float r = length(c)*2.0; vec4 o;\n if (vKind < 0.5) { o = vec4(vCol.rgb, vCol.a*smoothstep(1.0,0.15,r)); }\n else if (vKind < 1.5) { if (r > 1.0) discard; float sh = 0.55 + 0.6*(0.5 - 0.5*(c.x*0.7 - c.y*0.8)); o = vec4(vCol.rgb*sh, vCol.a); }\n else { o = vec4(vCol.rgb, vCol.a); }\n gl_FragColor = o; }',
  });
  const points = new THREE.Points(pg, pMat); points.frustumCulled = false; points.renderOrder = 10; world.add(points);
  // rain streaks near the camera
  const NR = 160, rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * 6), 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#dbe7f4', transparent: true, opacity: 0.55, depthWrite: false })); rain.frustumCulled = false; rain.visible = false; world.add(rain);
  // night spotlight that follows the pull
  const spot = new SpotLight('#fff1cf', 0, 80, 0.55, 0.7, 1.6); spot.position.set(0, 14, 10); scene.add(spot, spot.target);
  await tick('rigs+particles');

  // ---------------------------------------------------------------- state and helpers
  let curGround = -1;
  const S = { lastT: new WeakMap(), key: '', trackRef: null, wasCheer: false, dt: 0 };
  const applyGround = async (gi) => {
    applyGroundNow(gi);
    await buildScen(gi);
    showOnly();
  };
  const showOnly = () => { if (!scen[curGround]) return; for (let i = 0; i < scen.length; i++) if (scen[i]) { scen[i].group.visible = i === curGround; scen[i].back.visible = i === curGround; } };
  const applyGroundNow = (gi) => {
    const G = GROUND[gi], pal = PALS[gi];
    curGround = gi;
    showOnly();
    L.hemi.color.set(G.hemiSky); L.hemi.groundColor.set(G.hemiGround); L.hemi.intensity = G.hemi;
    L.key.color.set(G.key); L.key.intensity = G.keyI; L.rim.color.set('#ffe9c8'); L.rim.intensity = G.rain ? 0.2 : 0.6;
    stage._shadowOffset = new Vector3(...G.keyOff);
    renderer.toneMappingExposure = G.exposure; scene.environmentIntensity = G.env;
    scene.fog = new Fog(G.fog, 70, 280); scene.background = null;
    dirtMat.color.set(G.dirt); dirtMat.roughness = G.rain ? 0.55 : 0.96; dirtMat.needsUpdate = true;
    grassMat.color.set(gi === 1 ? '#8f8a52' : gi === 2 ? '#3a4a36' : gi === 3 ? '#56705a' : '#8fa96a');
    const on = G.lamp ? 1 : 0;
    for (const m of lampMats) m.color.set(on ? (gi === 2 ? '#ffffff' : '#fff0b0') : '#cfd2d6');
    for (const g of glows) g.material.opacity = gi === 2 ? 0.95 : gi === 1 ? 0.55 : 0;
    spot.intensity = G.spot ? 900 : 0;
    rain.visible = !!G.rain;
    S.key = '';
    void pal;
  };
  const applyTrack = (track, gi) => {
    const pal = PALS[gi], moist = rgb(pal.moist), dry = rgb(pal.dry);
    for (let i = 0; i < STRIPS; i++) {
      const d = track.strips[i] - 1, a = d >= 0 ? Math.min(0.62, Math.abs(d) * 3.4) : Math.min(0.62, Math.abs(d) * 3.4) * 0.95, c = d >= 0 ? moist : dry;
      strips[i].material.color.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); strips[i].material.opacity = a;
    }
  };

  // camera: reproduces the 2D art's scale and anchor; looks straight along -z so verticals stay vertical
  function frame(W, H, rect, cam, p) {
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    const k = W / rect.w, fpx = cam.s * k * D;
    camera.aspect = W / H; camera.fov = (2 * Math.atan(H / (2 * fpx)) * 180) / Math.PI;
    const ax = cam.ax - rect.x, gyl = cam.gy - rect.y;
    const cxm = p.x - (ax - rect.w / 2) / cam.s, cym = (gyl - rect.h / 2) / cam.s;
    camera.position.set(cxm, cym, D); camera.lookAt(cxm, cym, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    pMat.uniforms.uScale.value = fpx;
    return { cxm, cym, halfW: rect.w / cam.s / 2 + 2 };
  }

  let lost = false;
  stage.onContextLost(() => { lost = true; api.lost = true; });
  stage.onContextRestored(() => { lost = false; api.lost = false; S.key = ''; });

  // ---------------------------------------------------------------- the per-frame world update
  function updateWorld(ws, dt, view) {
    const p = ws.p, gi = ws.ground, t = ws.t;
    const rig = rigs[ws.rigIdx];
    for (const r of rigs) r.root.visible = r === rig;
    // rig + sled
    const k = rig.look.s;
    rig.root.position.set(p.x, 0, 0);
    rig.update(p, t, dt, GROUND[gi]);
    const hitchX = p.x - 1.45 * k, frontX = hitchX - 1.5;
    const u = clamp(p.x / TRACK_M, 0, 1), bob = p.phase === 'run' ? Math.sin(p.x * 7) * 0.02 : 0;
    sled.root.position.set(frontX, bob, 0); sled.slide(u);
    // chain with slack that tightens as the lever opens
    {
      const tension = clamp(0.15 + (p.thr || 0) * 0.9 + (p.phase === 'run' ? 0.4 : 0), 0, 1);
      const ax = hitchX, ay = 0.55 * k, bx = frontX, by = 0.58;
      const d = Math.hypot(ax - bx, ay - by), Lc = d + 0.2 * (1 - tension) + 0.02, sag = 0.55 * Math.sqrt(Math.max(0, Lc * Lc - d * d)) / 1.0;
      for (let i = 0; i < NL; i++) {
        const f = (i + 0.5) / NL; const x = ax + (bx - ax) * f, y0 = ay + (by - ay) * f, y = Math.max(0.05, y0 - sag * 4 * (f - f * f));
        const f2 = Math.min(1, f + 0.02), y2 = Math.max(0.05, ay + (by - ay) * f2 - sag * 4 * (f2 - f2 * f2));
        lo.position.set(x, y, 0); lo.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, Math.atan2(y2 - y, (bx - ax) * 0.02)); lo.updateMatrix(); links.setMatrixAt(i, lo.matrix);
      }
      links.instanceMatrix.needsUpdate = true;
    }
    // ruts follow the pull
    {
      const xe = Math.min(p.x, TRACK_M), len = Math.max(0.01, xe + 0.3);
      for (const r of ruts) { r.visible = xe > 0.2; r.scale.x = len; r.position.x = len / 2 - 0.3; }
      drag.visible = xe > 0.2; drag.scale.x = Math.max(0.01, xe - 0.3 - 4); drag.position.x = (xe - 4) / 2 - 0.3 + 0.0;
      if (drag.scale.x < 0.02) drag.visible = false;
    }
    // bunting flutter (cheaper than the wind: a small sway per flag)
    {
      const x0 = view.cxm - view.halfW, x1 = view.cxm + view.halfW;
      let idx = 0;
      for (let i = 0; i < BUNT; i++) for (let j = 0; j < FL; j++, idx++) {
        const xa = X0 + i * 6, u2 = (j + 0.5) / FL, x = xa + 6 * u2;
        if (x < x0 - 4 || x > x1 + 4) { buntM.compose(buntP.set(0, -50, 0), buntQ.identity(), buntS.set(0.001, 0.001, 0.001)); bunt.setMatrixAt(idx, buntM); continue; }
        const y = 3.6 - 0.7 * 4 * (u2 - u2 * u2) - 0.02;
        const sw = Math.sin(t * 2.2 + (i * FL + j) * 1.3) * 0.2 + Math.sin(t * 3.7 + j) * 0.06;
        buntE.set(sw * 0.4, sw * 0.8, sw); buntQ.setFromEuler(buntE);
        buntM.compose(buntP.set(x, y, FZ), buntQ, buntS.set(1, 1, 1)); bunt.setMatrixAt(idx, buntM);
      }
      bunt.instanceMatrix.needsUpdate = true;
    }
    // particles
    {
      const pal = PALS[gi], parts = ws.parts, n = Math.min(parts.length, MAXP);
      const dust = rgb(pal.dust);
      for (let i = 0; i < n; i++) {
        const q = parts[i], kk = q.t / q.life, z = q.k === 'conf' ? (q.r - 0.5) * 3 : 0.2 + q.r * 1.1;
        pPos[i * 3] = q.x; pPos[i * 3 + 1] = Math.max(0.03, q.y); pPos[i * 3 + 2] = z;
        let size = 0.2, kind = 0, c = dust, a = 0.5 * (1 - kk);
        if (q.k === 'smoke') { size = 2 * (0.08 + q.size * (0.3 + kk * 0.9)); c = q.r > 0.5 ? [36, 36, 40] : [70, 70, 76]; a = 0.55 * (1 - kk); }
        else if (q.k === 'dust') { size = 2 * (0.1 + q.size * (0.35 + kk * 1.0)); a = 0.5 * (1 - kk); }
        else if (q.k === 'clod') { size = 2 * (0.05 + q.size * 0.09); kind = 1; c = q.r > 0.5 ? [74, 47, 26] : [107, 69, 38]; a = 1; if (GROUND[gi].rain) c = [40, 28, 18]; }
        else if (q.k === 'conf') { size = 0.14; kind = 2; const cols = [[255, 211, 106], [224, 85, 44], [255, 255, 255], [88, 178, 74], [74, 134, 184]]; c = cols[Math.floor(q.r * 997) % cols.length]; a = 1 - kk * kk; }
        else if (q.k === 'spark') { size = 0.08; kind = 2; c = [255, 220, 120]; a = 1 - kk; }
        pSize[i] = size; pKind[i] = kind; pCol[i * 4] = c[0] / 255; pCol[i * 4 + 1] = c[1] / 255; pCol[i * 4 + 2] = c[2] / 255; pCol[i * 4 + 3] = a;
      }
      pg.setDrawRange(0, n);
      for (const a of ['position', 'aSize', 'aCol', 'aKind']) pg.attributes[a].needsUpdate = true;
    }
    // rain
    if (GROUND[gi].rain) {
      const pa = rainGeo.attributes.position;
      for (let i = 0; i < NR; i++) {
        const x = view.cxm - view.halfW + hash(i * 3 + 1) * view.halfW * 2, z = -2 + hash(i * 5 + 2) * 16;
        const y = 10 - ((hash(i * 7 + 3) * 10 + t * 13) % 10);
        pa.setXYZ(i * 2, x, y, z); pa.setXYZ(i * 2 + 1, x - 0.1, y + 0.55, z);
      }
      pa.needsUpdate = true;
    }
    // the crowd: cheers on a full pull, a little louder as the pull gets going
    if (crowd || crowdRows) {
      for (const c of [crowd, crowdRows]) {
        if (!c) continue;
        if (ws.cheer && !S.wasCheer) { c.react('cheer', { intensity: 1 }); c.setExcitement(0.85); }
        if (!ws.cheer && S.wasCheer) c.setExcitement(0.25);
        if (!ws.cheer) c.setExcitement(clamp(0.2 + (p.phase === 'run' ? 0.25 : 0) + Math.min(0.2, p.x / TRACK_M * 0.3), 0, 0.7));
        c.update(dt);
      }
      S.wasCheer = ws.cheer;
    }
    // lights follow the action
    stage.setShadowTarget(p.x - 2, 0, 0);
    spot.position.set(p.x + 8, 14, 10); spot.target.position.set(p.x - 1, 0, 0);
    const s = scen[gi]; if (s) {
      s.update(dt, camera);
      s.sky.position.x = view.cxm * 0.97;
      const sp = s.back.userData.span || 0; if (sp) s.back.position.x = view.cxm * 0.88;
    }
    if (S.key !== `${gi}`) { S.key = `${gi}`; }
    if (S.trackRef !== ws.track || S.trackGround !== gi) { applyTrack(ws.track, gi); S.trackRef = ws.track; S.trackGround = gi; }
  }

  // ---------------------------------------------------------------- draw into the 2D canvas
  api.draw = (ctx, rect, ws) => {
    if (lost || stage.contextLost || !ws || !ws.p) return false;
    const t0 = performance.now();
    if (curGround !== ws.ground) { applyGround(ws.ground); S.trackRef = null; }
    if (!scen[ws.ground] || !scen[ws.ground].group.visible) { /* the new sky is still loading: keep drawing with the previous one */ }
    const m = ctx.getTransform(), dpu = Math.hypot(m.a, m.b) || 1;
    let W = Math.round(rect.w * dpu), H = Math.round(rect.h * dpu);
    const cap = MAXW[quality] * api.scale; if (W > cap) { H = Math.round(H * cap / W); W = Math.round(cap); }
    W = Math.max(64, W); H = Math.max(64, H);
    const cam = makeCam(rect, ws.p);
    const view = frame(W, H, rect, cam, ws.p);
    const last = S.lastT.get(ws), dt = last === undefined || ws.t < last ? 0 : Math.min(0.1, ws.t - last); S.lastT.set(ws, ws.t);
    world.visible = true;
    updateWorld(ws, dt, view);
    renderer.setClearColor(0x000000, 1);
    stage.render();
    ctx.drawImage(renderer.domElement, rect.x, rect.y, rect.w, rect.h);
    // adaptive quality: slow frames shrink the live layer first, then drop shadows
    const ms = performance.now() - t0;
    api.avgMs = api.avgMs ? api.avgMs * 0.92 + ms * 0.08 : ms; api.frames++;
    if (api.frames % 45 === 0 && api.avgMs > 24) {
      if (api.scale > 0.6) api.scale *= 0.84;
      else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; L.key.castShadow = false; scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; }); }
    }
    return true;
  };

  // A still of one rig on a transparent background (garage cards, rules illustrations): cached per rig + lift.
  const thumbs = new Map();
  api.rigThumb = (rigIdx, lift = 0) => {
    if (lost || stage.contextLost) return null;
    const key = `${rigIdx}|${Math.round(lift * 10)}`;
    if (thumbs.has(key)) return thumbs.get(key);
    const TW = 640, TH = 400, rig = rigs[rigIdx];
    const prevBg = scene.background, prevFog = scene.fog;
    scene.background = null; scene.fog = null;
    const savedScene = scene.children.map((c) => [c, c.visible]);
    for (const c of scene.children) if (c !== world && !c.isLight) c.visible = false;
    const savedWorld = world.children.map((c) => [c, c.visible]);
    for (const c of world.children) c.visible = c === rig.root;
    world.visible = true; rig.root.visible = true; rig.root.position.set(0, 0, 0); rig.root.scale.setScalar(1);
    rig.update({ x: 0, v: 0, lift, wheel: 0.35, rpm: 0.3, phase: 'ready', thr: 0.2, dig: 0, shiftT: 0 }, 0, 0, GROUND[0]);
    const oc = new THREE.OrthographicCamera(-TW / 200, TW / 200, TH / 200, -TH / 200, 0.1, 100);
    oc.position.set(1.7, 1.3, 30); oc.lookAt(1.7, 1.3, 0);
    renderer.setPixelRatio(1); renderer.setSize(TW, TH, false); renderer.setClearColor(0x000000, 0);
    stage.setShadowTarget(1.5, 0, 0);
    renderer.render(scene, oc);
    const out = doc.createElement('canvas'); out.width = TW; out.height = TH; out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    for (const [c, v] of savedWorld) c.visible = v;
    for (const [c, v] of savedScene) c.visible = v;
    rig.root.scale.setScalar(rig.look.s); rig.root.visible = false;
    scene.background = prevBg; scene.fog = prevFog; renderer.setClearColor(0x000000, 1);
    thumbs.set(key, out);
    return out;
  };

  // A still of one ground (garage cards): the whole scene with a rig on it, cached. Returns null until that ground's sky is built.
  api.groundThumb = (gi) => {
    if (lost || stage.contextLost) return null;
    const key = `g${gi}`;
    if (thumbs.has(key)) return thumbs.get(key);
    if (!scen[gi]) { buildScen(gi).catch(() => {}); return null; }
    const TW = 480, TH = 270, rect = { x: 0, y: 0, w: TW, h: TH };
    const keep = { g: curGround, tr: S.trackRef, tg: S.trackGround };
    const ws = { rigIdx: 1, ground: gi, track: { strips: [1.12, 0.9, 1.1, 0.88, 1.15, 0.92, 1.1, 0.9, 1.12, 0.95, 1.08, 0.9] }, p: { x: 3.5, v: 0, lift: 0, wheel: 0.3, rpm: 0.3, phase: 'ready', thr: 0.1, dig: 0, shiftT: 0, load: 0 }, parts: [], t: 0, cheer: false };
    applyGroundNow(gi);
    const cam = { s: 19, ax: TW * 0.55, gy: TH * 0.8 }, view = frame(TW, TH, rect, cam, ws.p);
    updateWorld(ws, 0, view);
    renderer.setClearColor(0x000000, 1); stage.render();
    const out = doc.createElement('canvas'); out.width = TW; out.height = TH; out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    thumbs.set(key, out);
    if (keep.g >= 0) applyGroundNow(keep.g); curGround = keep.g; S.trackRef = null; S.trackGround = -1;
    return out;
  };
  // Offline icon / hero stills: set the world to a pulling moment and aim the camera freely. Returns what board3d.renderIcon needs.
  api.stillSetup = async ({ ground = 1, rig = 1, x = 18, lift = 0.8, cam = [x + 5.5, 1.5, 7.6], look = [x + 0.5, 1.55, 0], fov = 40, t = 3.1, dust = true } = {}) => {
    const ws = { rigIdx: rig, ground, track: { strips: [1.1, 0.95, 1.12, 0.9, 1.1, 0.92, 1.12, 0.9, 1.1, 0.95, 1.08, 0.9] },
      p: { x, v: 4.2, lift, wheel: 1.7, rpm: 0.78, phase: 'run', thr: 1, dig: 0.25, shiftT: 0, load: 0.5, slip: 0.2 }, parts: [], t, cheer: false };
    if (dust) {
      for (let i = 0; i < 90; i++) {
        const a = hash(i * 3 + 1), b = hash(i * 5 + 2), c = hash(i * 7 + 3), kind = i % 5 === 0 ? 'clod' : i % 7 === 0 ? 'smoke' : 'dust';
        ws.parts.push({ k: kind, x: x - 0.6 - a * 4.2, y: kind === 'clod' ? 0.2 + b * 2.4 : 0.15 + b * 1.2, vx: 0, vy: 0, t: a * 0.6, life: 1.2, size: 0.9 + c * 1.4, r: c });
      }
    }
    const fake = { s: 1, ax: 0, gy: 0 };
    await buildScen(ground);
    applyGroundNow(ground);
    for (const o of textObjs) o.visible = false;
    api.iconWs = ws;
    renderer.setPixelRatio(1);
    camera.near = 0.5; camera.far = 500; camera.fov = fov; camera.position.set(...cam); camera.lookAt(...look); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    pMat.uniforms.uScale.value = 1000;
    const view = { cxm: x, cym: 1.5, halfW: 22 };
    updateWorld(ws, 0, view);
    // still frame: sun low and from behind-left, strong rim
    L.rim.intensity = 1.6;
    stage.setShadowTarget(x - 1, 0, 0);
    void fake;
    return { scene, camera, renderer, ws, view, relight: () => { updateWorld(ws, 0, view); camera.position.set(...cam); camera.lookAt(...look); camera.updateMatrixWorld(true); } };
  };
  api.fade = () => clamp((performance.now() - api.readyAt) / 450, 0, 1);
  api.compile = async () => { try { await renderer.compileAsync(scene, camera); } catch { /* compile on first draw instead */ } };
  api.readyAt = performance.now();
  api.crowd = crowd; api.crowdRows = crowdRows; api.strips = strips; api.scene = scene; api.world = world;
  api.dispose = () => stage.dispose && stage.dispose();
  void onProgress;
  return api;
}
