// Peralikatuma 3D presenter. It READS the simulation state (game.getState()) and the pieces / markers / effects that view.js records in
// v3 (virtual units); it never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a carved octagon board on
// a coir mat on a Sri Lankan verandah at dusk, brass oil lamps, banana plants, palms, paddy terraces beyond, drifting frangipani and
// fireflies. The 2D layer draws only text, plaques and buttons.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildScenery } from '../vendor3d/scenery3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites, SPR } from '../src/art.js';
import { newGame } from '../src/rules.js';
import { TOP, MAN_H, STAR_H, outline, MARGIN, buildBoard, buildFloor, buildRail, buildPillar, buildLamp, buildPlant, buildPot, buildPalm, buildFlower, buildCoconutBowl, flameTexture, makePiece, LOOKS } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: true, scenery: 'medium' },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: true, scenery: 'low' },
  { name: 'low', dpr: 1, shadow: 0, fx: false, scenery: 'low' },
];
const STYLES = ['faceted', 'cabochon'];

function softCanvas(rgb, a = 1, ring = false, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, ring ? size * 0.3 : 0, size / 2, size / 2, size / 2);
  if (ring) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.62, `rgba(${rgb},${a})`); g.addColorStop(0.74, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const gust = (t, k = 0) => 0.5 + 0.5 * Math.sin(t * 0.7 + k) * Math.sin(t * 0.23 + k * 2.1);   // slow wind gusts 0..1
const isPoint = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9 && Math.abs(c - 4) + Math.abs(r - 4) <= 5;

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x2a1d28, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- the scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 9, fog: { near: 34, far: 120 },
    overrides: { bg: 0x2a1d28, fog: 0x7a5a58, key: 0xffcf94, keyI: 2.1, keyPos: [-5.5, 10, 7], hemi: 0.5, hemiSky: 0xffd2a8, hemiGround: 0x2c2018, fillI: 0.35, fill: 0xa8b8ff, rimI: 1.5, rim: 0xffa36a, rimPos: [6, 5, -8], exposure: 0.98, env: 0.3 },
  });
  const env = B.createEnvironment(renderer, scene, { intensity: 0.3 });
  const glowTex = softCanvas('255,255,255', 0.95), ringTex = softCanvas('255,255,255', 0.95, true), haloTex = softCanvas('255,236,200', 0.9, false, 256);

  // distant world: paddy terraces at dusk (shared scenery kit), pushed down so the verandah floor stands above the ground
  let scenery = null;
  function loadScenery() {
    try {
      scenery = buildScenery({ preset: 'terraced-hills', timeOfDay: 'dusk', quality: TIERS[tier].scenery, wind: 0.5, clouds: 0.4, seed: 4 });
      scenery.group.position.y = -1.1; scene.add(scenery.group);
      scenery.ready.catch((e) => console.warn('scenery failed', e));
    } catch (e) { console.warn('scenery unavailable', e); scenery = null; }
  }
  loadScenery();

  scene.add(buildFloor());
  scene.add(buildRail(-11.8));
  for (const sx of [-1, 1]) { const p = buildPillar(); p.position.set(sx * 9.6, 0, -11.2); scene.add(p); }
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardGrp = null, boardLook = null;
  function ensureBoard(look) {
    if (boardGrp && boardLook === look) return;
    if (boardGrp) { boardRoot.remove(boardGrp); boardGrp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    boardGrp = buildBoard(LOOKS[look] ? look : 'satin'); boardRoot.add(boardGrp); boardLook = look;
  }

  // lamps: brass pahana with eight wick cups, flames flicker with the gusts
  const flameTex = flameTexture();
  const lamps = [];
  for (const [x, z, ry, sc] of [[-6.3, -4.9, 0.5, 1.15], [6.4, -5.2, -0.4, 1.1]]) {
    const l = buildLamp(); l.position.set(x, 0.012, z); l.rotation.y = ry; l.scale.setScalar(sc); scene.add(l);
    const flames = l.userData.flames.map(([fx, fy, fz], i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set(fx, fy + 0.13, fz); sp.scale.set(0.2, 0.4, 1); sp.center.set(0.5, 0.18); l.add(sp);
      return { sp, big: i === l.userData.flames.length - 1, ph: i * 1.7 + x };
    });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xffa860, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.position.set(0, 1.9, 0); halo.scale.setScalar(4.2); l.add(halo);
    const pl = new THREE.PointLight(0xffa850, 7, 17, 1.5); pl.position.set(x * 0.92, 2.7 * sc, z + 1.0); scene.add(pl);
    lamps.push({ g: l, flames, pl, halo, base: pl.intensity, seed: x });
  }
  // plants
  const plants = [];
  for (const [x, z, n, s, seed] of [[-8.4, -8.6, 7, 1.15, 3], [8.6, -9.2, 6, 1.0, 8], [-3.4, -10.6, 5, 0.9, 12]]) {
    const pot = buildPot(); pot.position.set(x, 0, z); pot.scale.setScalar(s); scene.add(pot);
    const pl = buildPlant('banana', n, seed); pl.position.set(x, 0.9 * s, z); pl.scale.setScalar(s); scene.add(pl); plants.push(pl);
  }
  const palms = [];
  for (const [x, z, s, ry] of [[-14, -16, 1.0, 0.3], [12, -19, 1.1, 1.2], [-4, -24, 1.2, 2.4]]) { const p = buildPalm(); p.position.set(x, -1.1, z); p.scale.setScalar(s); p.rotation.y = ry; scene.add(p); palms.push(p); }
  // flowers and a coconut-shell dish of tamarind seeds on the mat
  const flowerAt = [[-5.7, 4.9, 0.4], [-5.1, 5.6, 2.1], [5.9, 4.4, 1.0], [6.2, -2.0, 3.0], [-6.4, -1.2, 0.2], [5.1, 5.7, 4.1], [-6.0, 0.6, 5.2]];
  for (const [x, z, a] of flowerAt) { const f = buildFlower(); f.position.set(x, 0.012, z); f.rotation.y = a; f.scale.setScalar(1.15); scene.add(f); }
  const bowl = buildCoconutBowl(); bowl.position.set(-5.3, 0.012, 3.7); bowl.scale.setScalar(1.15); scene.add(bowl);
  const bowl2 = buildCoconutBowl(); bowl2.position.set(5.5, 0.012, 2.9); bowl2.rotation.y = 1.6; bowl2.scale.setScalar(1.0); scene.add(bowl2);

  // falling petals (instanced) and fireflies
  const NPT = 18;
  const petalGeo = new THREE.PlaneGeometry(0.2, 0.34);
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: '#fff0d8', side: THREE.DoubleSide, roughness: 0.6, emissive: '#3a2a12', emissiveIntensity: 0.3 }), NPT);
  petals.frustumCulled = false; scene.add(petals);
  const flies = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex, color: 0xd8ff80, size: 0.34, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
  { const n = 46, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (hash(i + 1) - 0.5) * 34; a[i * 3 + 1] = 0.7 + hash(i + 9) * 4.2; a[i * 3 + 2] = -5 - hash(i + 17) * 14; } flies.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); flies.userData.base = a.slice(); scene.add(flies); }

  // ---------------------------------------------------------------- piece pools, markers, particles
  const blobTex = softCanvas('0,0,0', 0.85);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  let style = 'faceted';
  const pools = new Map();
  function takePiece(code, i) {
    let arr = pools.get(code); if (!arr) { arr = []; pools.set(code, arr); }
    while (arr.length <= i) {
      const wrap = new THREE.Group(), model = makePiece(code, style);
      const sh = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 })); sh.position.y = 0.012; sh.renderOrder = 1;
      wrap.add(sh, model); wrap.userData = { model, sh, code }; wrap.visible = false; pieceRoot.add(wrap); arr.push(wrap);
    }
    return arr[i];
  }
  function setStyle(s) {
    if (s === style) return; style = s;
    for (const arr of pools.values()) for (const w of arr) pieceRoot.remove(w);
    pools.clear();
  }
  const used = new Map();
  const hideAll = () => { for (const arr of pools.values()) for (const w of arr) w.visible = false; used.clear(); };
  function place(code, X, Z, o = {}) {
    const i = used.get(code) || 0; used.set(code, i + 1);
    const w = takePiece(code, i), m = w.userData.model, sh = w.userData.sh, lift = o.y ?? 0, s = o.scale ?? 1, sq = o.squash || 0, base = o.floor ?? TOP;
    w.visible = true; w.position.set(X, base, Z);
    m.position.y = lift; m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); m.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    sh.position.y = 0.012 + (base - TOP);
    sh.scale.setScalar(1.45 * s * (1 - clamp(lift * 0.25, 0, 0.4)));
    sh.material.opacity = 0.85 * (1 - clamp(lift * 0.5, 0, 0.7));
    return w;
  }

  const markRoot = new THREE.Group(); scene.add(markRoot);
  const markPool = []; let markN = 0;
  function markQuad(x, z, tex, color, op, sx, sz = sx, rot = 0, y = TOP + 0.016) {
    let m = markPool[markN];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; markRoot.add(m); markPool.push(m); }
    markN++; m.visible = true; m.material.map = tex; m.material.color.set(color); m.material.opacity = clamp(op, 0, 1);
    m.position.set(x, y, z); m.scale.set(sx, 1, sz); m.rotation.y = rot;
  }

  // particles: golden sparks (instanced, fixed-step simulation)
  const NP = 80;
  const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NP);
  sparks.frustumCulled = false; sparks.instanceMatrix.setUsage?.(35048); scene.add(sparks);
  const cWarm = new THREE.Color('#ffd878'), cRed = new THREE.Color('#ff7a5a'), cPale = new THREE.Color('#fff4d8');
  for (let i = 0; i < NP; i++) sparks.setColorAt(i, i % 3 === 0 ? cRed : i % 3 === 1 ? cWarm : cPale);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  function burst(x, y, z, n, up = 1.7) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.7, sp = 0.8 + ((i * 37) % 10) * 0.12;
      parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up + ((i * 13) % 7) * 0.25, vz: Math.sin(a) * sp, life: 0, max: 0.6 + ((i * 7) % 5) * 0.1 });
    }
    if (parts.length > NP) parts.splice(0, parts.length - NP);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < TOP && p.vy < 0 && Math.hypot(p.x, p.z) < 4.6) { p.y = TOP; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.life >= p.max) parts.splice(i, 1);
    }
    for (let i = 0; i < NP; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q, _s); }
      sparks.setMatrixAt(i, _m);
    }
    sparks.instanceMatrix.needsUpdate = true;
    sparks.visible = tier < 2 || parts.length > 0;
  }

  // ---------------------------------------------------------------- camera
  let W = 1, H = 1, dprNow = 1, L_ = null, clock = 0, lastT = 0, frames = 0, ema = 16;
  const tmp = new THREE.Vector3();
  const corners = []; for (const [x, z] of outline(MARGIN + 0.06, 3)) for (const y of [0, 0.5]) corners.push(new THREE.Vector3(x, y, z));
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 1) {
    const k = W / L_.w, tw = rect.w * k * fill, th = rect.h * k * fill, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place = (d) => { camera.position.set(Math.sin(yw) * Math.cos(p) * d, 0.2 + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d); camera.lookAt(0, 0.2, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const extent = (d) => {
      place(d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmp.copy(c).project(camera); const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 4, hi = 140;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2, e = extent(mid); if (e.w > tw || e.h > th) lo = mid; else hi = mid; }
    const e = extent(hi), cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, e.cx - cxp, e.cy - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmp.set(x, y, z).project(camera); return { x: ((tmp.x + 1) / 2) * L_.w, y: ((1 - tmp.y) / 2) * L_.h }; };
  const cellXZ = (i) => { const r = (i / 9) | 0, c = i % 9, rr = L_.flip ? 8 - r : r, cc = L_.flip ? 8 - c : c; return { X: cc - 4, Z: rr - 4 }; };
  v3.sq = (i) => { const { X, Z } = cellXZ(i), a = toVirt(X, TOP, Z), b = toVirt(X + 0.5, TOP, Z), c = toVirt(X - 0.5, TOP, Z); return { x: a.x, y: a.y, s: Math.abs(b.x - c.x) }; };
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  v3.pick = (vx, vy) => {
    if (!L_) return -1;
    let best = -1, bd = 1e9;
    for (const q of v3.pieces) {
      if (q.cell === undefined || q.cell < 0 || q.drag) continue;
      const { X, Z } = cellXZ(q.cell), base = toVirt(X, TOP + 0.02, Z), top = toVirt(X, TOP + (q.code > 2 ? STAR_H : MAN_H), Z);
      const unit = Math.abs(toVirt(X + 0.5, TOP, Z).x - toVirt(X - 0.5, TOP, Z).x);
      const cy = (base.y + top.y) / 2, ry = Math.abs(base.y - top.y) / 2 + unit * 0.2, rx = unit * 0.5;
      const dx = (vx - base.x) / rx, dy = (vy - cy) / ry, dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bd) { bd = dd; best = q.cell; }
    }
    if (best >= 0) return best;
    orig.copy(camera.position); ray.set((vx / L_.w) * 2 - 1, 1 - (vy / L_.h) * 2, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return -1;
    const t = (TOP - orig.y) / ray.y; if (t < 0) return -1;
    hitV.copy(orig).addScaledVector(ray, t);
    const cc = Math.round(hitV.x + 4), rr = Math.round(hitV.z + 4);
    if (!isPoint(rr, cc) || Math.hypot(hitV.x - (cc - 4), hitV.z - (rr - 4)) > 0.62) return -1;
    return (L_.flip ? 8 - rr : rr) * 9 + (L_.flip ? 8 - cc : cc);
  };
  // virtual -> world on the board plane (the flat layout the 2D logic works in, centred on the board)
  let bcx = 0, bcy = 0, bcell = 1;
  const wx = (vx) => (vx - bcx) / bcell, wz = (vy) => (vy - bcy) / bcell;
  function dragWorld(vx, vy, h) {
    orig.copy(camera.position); ray.set((vx / L_.w) * 2 - 1, 1 - (vy / L_.h) * 2, 0.5).unproject(camera).sub(orig).normalize();
    const t = (h - orig.y) / (ray.y || -1e-5); hitV.copy(orig).addScaledVector(ray, t); return { X: hitV.x, Z: hitV.z };
  }

  // ---------------------------------------------------------------- hero demonstration (title and document screens)
  // On the real start position: a Ruby man leaps three Sapphire men in one chain and is crowned on the far row, forever.
  const HEROB = (() => { const b = newGame('classic').board.slice(); b[22] = 0; b[4] = 0; b[48] = 2; b[31] = 2; return b; })();
  const heroItems = [], HP = [56, 40, 22, 4], HV = [48, 31, 13];
  const at = (i) => ({ X: (i % 9) - 4, Z: ((i / 9) | 0) - 4 });
  function heroState(state) {
    heroItems.length = 0;
    const T = state.calm ? 4.5 : state.t % 9.5, start = 1.2, hop = 0.8, endT = start + hop * 3, resetT = 8.2;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.8) : 1, sc = 0.2 + 0.8 * ease(clamp(op, 0, 1));
    for (let i = 0; i < 81; i++) { const k = HEROB[i]; if (!k || i === HP[0] || HV.includes(i)) continue; heroItems.push({ code: k, ...at(i), scale: sc }); }
    HV.forEach((q, k) => {
      const tk = start + hop * (k + 0.5);
      if (T < tk) heroItems.push({ code: 2, ...at(q), scale: sc });
      else { const f = (T - tk) / 0.55; if (f < 1) heroItems.push({ code: 2, ...at(q), cap: f, id: k + 3, scale: sc }); }
    });
    let X, Z, lift = 0, squash = 0, spin = 0;
    if (T < start) { const p = at(HP[0]); X = p.X; Z = p.Z; lift = T > 0.7 ? clamp((T - 0.7) / 0.5, 0, 1) * 0.35 : 0; }
    else if (T >= endT) { const p = at(HP[3]); X = p.X; Z = p.Z; squash = Math.max(0, 1 - (T - endT) / 0.35) * 0.16 * Math.cos((T - endT) * 22); }
    else {
      const k = Math.min(2, Math.floor((T - start) / hop)), f = clamp(((T - start) - k * hop) / hop, 0, 1), e = ease(f), a = at(HP[k]), b = at(HP[k + 1]);
      X = a.X + (b.X - a.X) * e; Z = a.Z + (b.Z - a.Z) * e; lift = Math.sin(Math.PI * f) * 0.95 + 0.1; spin = f * 0.9;
    }
    const crowned = T > endT + 0.1;
    heroItems.push({ code: crowned ? 3 : 1, X, Z, lift, scale: sc * (crowned ? 1 + 0.12 * Math.max(0, 1 - (T - endT - 0.1) / 0.4) : 1), squash, ry: spin, mover: true });
    return { T, start, hop, endT, crowned };
  }

  // ---------------------------------------------------------------- frame
  const burstSeen = new Map();
  function present(state, L, dt) {
    const sc = state.scene, playing = !(sc === 'title' || sc === 'demo-limit' || sc === 'doc');
    hideAll(); markN = 0;
    const items = [];
    if (playing) {
      for (const q of v3.pieces) {
        if (q.drag) { const w = dragWorld(q.x, q.y, TOP + 0.75); items.push({ code: q.code, X: w.X, Z: w.Z, lift: 0.75, scale: 1.05, rz: q.tilt || 0 }); continue; }
        items.push({ code: q.code, X: wx(q.x), Z: wz(q.y), lift: q.lift * 0.9, scale: q.scale ?? 1, rz: q.tilt || 0, squash: q.squash || 0, ry: q.spin || 0 });
      }
      for (const m of v3.marks) {
        const X = wx(m.x), Z = wz(m.y), pu = m.a ?? 1;
        switch (m.kind) {
          case 'last': markQuad(X, Z, glowTex, '#ffd25a', 0.4, 1.05); break;
          case 'lastline': { const X0 = wx(m.x0), Z0 = wz(m.y0), d = Math.hypot(X - X0, Z - Z0), ang = Math.atan2(X - X0, Z - Z0); markQuad((X + X0) / 2, (Z + Z0) / 2, glowTex, '#ffd25a', 0.34, 0.18, d, ang); break; }
          case 'movable': markQuad(X, Z, glowTex, '#ffd25a', 0.18 + pu * 0.3, 1.05); markQuad(X, Z, ringTex, '#ffe9a0', 0.35 + pu * 0.35, 0.92); break;
          case 'sel': markQuad(X, Z, glowTex, '#ffe27a', 0.5 + pu * 0.3, 1.3); markQuad(X, Z, ringTex, '#ffd24a', 0.9, 1.02); break;
          case 'move': markQuad(X, Z, glowTex, '#fff2c8', 0.45 + pu * 0.3, 0.6); markQuad(X, Z, ringTex, '#fff2c8', 0.6 + pu * 0.3, 0.66); break;
          case 'cap': markQuad(X, Z, glowTex, '#ff4a2a', 0.38 + pu * 0.3, 1.2); markQuad(X, Z, ringTex, '#ff4a2a', 0.85 + pu * 0.15, 0.98); break;
          case 'hint': markQuad(X, Z, glowTex, '#5af09a', 0.3 + pu * 0.3, 1.15); markQuad(X, Z, ringTex, '#5af09a', 0.9, 1.02); break;
          case 'hintline': { const X0 = wx(m.x0), Z0 = wz(m.y0), d = Math.hypot(X - X0, Z - Z0), ang = Math.atan2(X - X0, Z - Z0); markQuad((X + X0) / 2, (Z + Z0) / 2, glowTex, '#5af09a', 0.5, 0.16, d, ang); break; }
          case 'lesson': markQuad(X, Z, ringTex, '#ff7a3a', 0.6 + pu * 0.4, 1.02); markQuad(X, Z, glowTex, '#ff7a3a', 0.25 + pu * 0.2, 1.0); break;
          case 'kb': markQuad(X, Z, ringTex, '#7dff9a', 1, 1.02); break;
        }
      }
      for (const f of v3.fx) {
        const X = wx(f.x), Z = wz(f.y);
        if (f.kind === 'cap') items.push({ code: f.code, X, Z, cap: f.f, id: f.id });
        else if (f.kind === 'crown') {
          const ff = f.f; markQuad(X, Z, ringTex, '#ffe08a', 0.9 * (1 - ff), 1.1 + 2.4 * ff);
          if (ff < 0.12 && burstSeen.get('c' + f.id) !== state.t) { burstSeen.set('c' + f.id, state.t); burst(X, TOP + 0.6, Z, 20, 2.3); }
        } else if (f.kind === 'land') { markQuad(X, Z, ringTex, '#fff3d0', 0.75 * (1 - f.f), 0.6 + 1.2 * f.f); }
      }
    } else {
      const hs = heroState(state);
      for (const h of heroItems) items.push(h);
      const burstAt = (k, t0, p, n) => { const key = k + Math.floor(state.t / 9.5); if (hs.T > t0 && hs.T < t0 + 0.2 && burstSeen.get(key) !== true) { burstSeen.set(key, true); burst(p.X, TOP + 0.35, p.Z, n); } };
      for (let i = 1; i < 4; i++) burstAt('h' + i, hs.start + i * hs.hop - 0.05, at(HP[i]), i === 3 ? 18 : 8);
    }
    for (const it of items) {
      if (it.cap !== undefined) {
        const f = it.cap, id = it.id || 0, ang0 = Math.atan2(it.Z, it.X) + ((id % 5) - 2) * 0.28;
        if (f < 0.2) { place(it.code, it.X, it.Z, { y: 0.14 * (f / 0.2), scale: 1 + 0.08 * (f / 0.2) }); continue; }
        const g = (f - 0.2) / 0.8, D = 3.4 + (id % 3) * 0.8, hz = D * (1 - (1 - g) ** 2);
        const X = it.X + Math.cos(ang0) * hz, Z = it.Z + Math.sin(ang0) * hz, off = Math.hypot(X, Z) > 4.5;
        const floor = off ? 0.026 : TOP, bounce = 1.5 * Math.abs(Math.sin(g * Math.PI * 1.8)) * (1 - g) ** 1.2 + 0.2 * Math.sin(Math.PI * Math.min(1, g * 3));
        const shrink = g > 0.8 ? clamp((1 - g) / 0.2, 0.001, 1) : 1;
        place(it.code, X, Z, { floor, y: bounce, scale: shrink * (it.scale ?? 1), rx: g * 7 * (id % 2 ? 1 : -1), rz: g * 5 });
        const key = 'k' + id + '|' + Math.round(it.X * 10) + '|' + Math.round(it.Z * 10);
        if (f < 0.35 && burstSeen.get(key) !== state.t) { burstSeen.set(key, state.t); burst(it.X, TOP + 0.3, it.Z, 12); }
        continue;
      }
      place(it.code, it.X, it.Z, { y: it.lift || 0, scale: it.scale ?? 1, rz: it.rz || 0, ry: it.ry || 0, squash: it.squash || 0 });
    }
    if (burstSeen.size > 400) burstSeen.clear();
    for (let i = markN; i < markPool.length; i++) markPool[i].visible = false;

    // ---- ambience: flames and lamp light flicker with the gusts, plants sway, petals and fireflies drift
    const t = clock, calm = state.calm, wind = calm ? 0.3 : gust(t, 0);
    lamps.forEach((l) => {
      let sum = 0;
      l.flames.forEach((f, i) => {
        const n = 0.5 + 0.5 * Math.sin(t * (9 + (i % 3) * 2.3) + f.ph) * Math.sin(t * 3.1 + f.ph * 1.3), lean = (wind - 0.5) * 0.35;
        const h = (f.big ? 0.5 : 0.36) * (0.8 + 0.32 * n);
        f.sp.scale.set((f.big ? 0.26 : 0.19) * (0.9 + 0.2 * (1 - n)), h, 1); f.sp.material.rotation = calm ? 0 : lean + Math.sin(t * 5 + f.ph) * 0.06; sum += n;
      });
      const fl = calm ? 0.5 : sum / l.flames.length;
      l.pl.intensity = l.base * (0.88 + 0.28 * fl); l.halo.material.opacity = 0.4 + 0.2 * fl;
    });
    rig.key.intensity = rig.config.keyI * (1 + (calm ? 0 : 0.03 * Math.sin(t * 6.1) + 0.02 * Math.sin(t * 11.3)));
    [...plants, ...palms].forEach((pl, pi) => { for (const h of pl.userData.fronds) { h.rotation.z = calm ? 0 : Math.sin(t * 1.3 + h.userData.ph + pi) * h.userData.amp * (0.5 + wind * 1.4); h.rotation.x = calm ? 0 : Math.cos(t * 0.9 + h.userData.ph) * h.userData.amp * 0.7; } });
    const vis = TIERS[tier].fx;
    petals.visible = vis;
    if (vis) {
      for (let i = 0; i < NPT; i++) {
        const per = 15 + hash(i + 3) * 8, u = ((t + hash(i) * per) % per) / per, side = hash(i + 7) < 0.5 ? -1 : 1;
        const x0 = side * (5.4 + hash(i + 5) * 3.5), z0 = -3 + hash(i + 11) * 9, y = 8 - u * 7.9;
        _p.set(x0 + Math.sin(u * 14 + i) * 0.8 + wind * 0.8, Math.max(0.03, y), z0 + Math.cos(u * 11 + i * 2) * 0.6);
        _e.set(u * 9 + i, u * 5 + i * 0.7, u * 7); _q.setFromEuler(_e);
        const sc2 = u > 0.97 ? (1 - u) / 0.03 : 1; _s.setScalar(sc2 * 0.9); _m.compose(_p, _q, _s); petals.setMatrixAt(i, _m);
      }
      petals.instanceMatrix.needsUpdate = true;
    }
    flies.visible = vis;
    if (vis && !calm) { const a = flies.geometry.attributes.position, b = flies.userData.base; for (let i = 0; i < a.count; i++) { a.array[i * 3] = b[i * 3] + Math.sin(t * 0.4 + i * 1.7) * 0.9; a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.55 + i) * 0.5; a.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * 0.33 + i * 2.1) * 0.8; } a.needsUpdate = true; flies.material.opacity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.2)); }
    stepParts(dt);
    if (scenery) scenery.update(calm ? 0 : dt, camera);
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
  }

  // ----- phase 1: before the 2D UI draws (camera, projection used by badges and picking)
  function prepare(state, L) {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    L_ = L;
    const look = LOOKS[state.wood] ? state.wood : 'satin';
    ensureBoard(look); setStyle(STYLES.includes(state.style) ? state.style : 'faceted');
    const sc = state.scene; v3.scene = sc;
    const B_ = L.board; bcell = B_.cell; bcx = B_.gx + 4.5 * B_.cell; bcy = B_.gy + 4.5 * B_.cell;
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.08, y: L.h * 0.42, w: L.w * 0.84, h: L.w * 0.7 };
      fitCamera(hr, L.land ? 42 : 40, 30, state.calm ? 0 : Math.sin(clock * 0.2) * 5, 0.97);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.04, y: L.h * 0.12, w: L.w * 0.92, h: L.h * 0.76 }, 40, 30, state.calm ? 0 : Math.sin(clock * 0.15) * 6, 0.9);
    } else {
      fitCamera({ x: B_.x, y: B_.y, w: B_.S, h: B_.S + B_.thick }, L.land ? 54 : 58, 28, 0, 1.03);
    }
  }

  // ---------------------------------------------------------------- 2D sprites for plates, trays, diagrams and the result card
  function buildSprites() {
    const SP = 320, sc = new THREE.Scene(), p = (30 * Math.PI) / 180, half = SPR.w / 2;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 40);
    const ty = (SPR.by - 0.5) * SPR.w / Math.cos(p);
    cam.position.set(0, ty + Math.sin(p) * 10, Math.cos(p) * 10); cam.lookAt(0, ty, 0); cam.updateMatrixWorld();
    const l1 = new THREE.DirectionalLight(0xfff0d6, 3.3); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xa8c8ff, 1.0); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3a30, 1.2), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.7;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    const shadowWas = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    for (const st of STYLES) for (const code of [1, 2, 3, 4]) {
      const g = makePiece(code, st); g.rotation.y = 0.25; g.scale.setScalar(1.05); sc.add(g);
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.map[`${st}|${code}`] = c; sc.remove(g);
    }
    renderer.setClearColor(0x2a1d28, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false); renderer.shadowMap.enabled = shadowWas;
    W = 0;
    sprites.ready = true;
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; applyTier(); v3.on = true; });   // B.createEnvironment rebuilds scene.environment itself

  try { ensureBoard('satin'); applyTier(); buildSprites(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, rig,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560, state.flip);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.pieces.length = 0; v3.marks.length = 0; v3.fx.length = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
