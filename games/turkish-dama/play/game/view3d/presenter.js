// Turkish Dama 3D presenter. It READS the simulation state (game.getState()) and the pieces / markers / effects that view.js records in
// v3 (virtual units); it never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: the lit tea-house table
// with the inlaid board, turned pieces, markers, particles, steam and lamps. The 2D layer draws only text, plaques and buttons.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites, SPR } from '../src/art.js';
import { TOP, HALF, MAN_H, KING_H, buildBoard, buildTable, buildTeaSet, buildLamp, makePiece, LOOKS } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: true },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: true },
  { name: 'low', dpr: 1, shadow: 0, fx: false },
];
const STYLES = ['classic', 'night'];

function softCanvas(rgb, a = 1, ring = false, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, ring ? size * 0.3 : 0, size / 2, size / 2, size / 2);
  if (ring) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.62, `rgba(${rgb},${a})`); g.addColorStop(0.74, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
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
  renderer.setClearColor(0x120a06, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- the scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
  const rig = B.lightingRig(scene, 'warmIndoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 8, fog: { near: 26, far: 80 },
    overrides: { bg: 0x120a06, fog: 0x160c07, key: 0xffd49a, keyI: 2.3, keyPos: [-4.5, 10, 6], hemi: 0.32, fillI: 0.3, rimI: 1.5, exposure: 0.92, env: 0.26 },
  });
  const env = B.createEnvironment(renderer, scene, { intensity: 0.28 });

  const glowTex = softCanvas('255,255,255', 0.95), ringTex = softCanvas('255,255,255', 0.95, true), haloTex = softCanvas('255,236,200', 0.9, false, 256);
  scene.add(buildTable());
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardGrp = null, boardLook = null;
  function ensureBoard(look) {
    if (boardGrp && boardLook === look) return;
    if (boardGrp) { boardRoot.remove(boardGrp); boardGrp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    boardGrp = buildBoard(LOOKS[look] ? look : 'iznik'); boardRoot.add(boardGrp); boardLook = look;
  }
  const tea = buildTeaSet(); tea.scale.setScalar(2.05); tea.position.set(5.9, 0.006, 3.4); tea.rotation.y = -0.5; scene.add(tea);
  const tea2 = buildTeaSet(); tea2.scale.setScalar(2.0); tea2.position.set(-6.2, 0.006, -3.6); tea2.rotation.y = 0.9; scene.add(tea2);
  // a brass tray under nothing: the second set stands on its own saucer; lamps hang far behind the table
  const lamps = [];
  [[-7.5, 5.2, -15, 1, 0.8], [3.2, 7.6, -21, 2, 1.1], [10.5, 4.6, -14, 3, 0.9]].forEach(([x, y, z, seed, sc], i) => {
    const hues = [['#e8442a', '#f2b232', '#f6e2a0', '#c8321c'], ['#1f8fa8', '#2f4fb8', '#f6e2a0', '#59c2d6'], ['#f2b232', '#e8442a', '#f6e2a0', '#a8321c']][i];
    const l = buildLamp(seed, hues); l.position.set(x, y, z); l.scale.setScalar(sc * 2.1); l.userData.base = { x, y, z }; scene.add(l); lamps.push(l);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: i === 1 ? 0x9fe8ff : 0xffb060, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.setScalar(7 * sc); halo.position.set(0, 0, 0); l.add(halo);
  });
  // warm pool of lamp light over the board
  const pool = new THREE.PointLight(0xffc27a, 8, 24, 1.6); pool.position.set(-1, 6.5, 1.5); scene.add(pool);

  await tick();
  // ---------------------------------------------------------------- piece pools, markers, particles
  const blobTex = softCanvas('0,0,0', 0.85);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  let style = 'classic';
  const pools = new Map();
  function takePiece(side, king, i) {
    const key = `${side}|${king ? 1 : 0}`; let arr = pools.get(key); if (!arr) { arr = []; pools.set(key, arr); }
    while (arr.length <= i) {
      const wrap = new THREE.Group(), model = makePiece(side, king, style);
      const sh = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 })); sh.position.y = 0.012; sh.renderOrder = 1;
      wrap.add(sh, model); wrap.userData = { model, sh, king }; wrap.visible = false; pieceRoot.add(wrap); arr.push(wrap);
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
  function place(side, king, X, Z, o = {}) {
    const key = `${side}|${king ? 1 : 0}`, i = used.get(key) || 0; used.set(key, i + 1);
    const w = takePiece(side, king, i), m = w.userData.model, sh = w.userData.sh, lift = o.y ?? 0, s = o.scale ?? 1, sq = o.squash || 0, base = o.floor ?? TOP;
    w.visible = true; w.position.set(X, base, Z);
    m.position.y = lift; m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); m.scale.set(s * (1 + sq * 0.4), s * (1 - sq), s * (1 + sq * 0.4));
    sh.position.y = 0.012 + (base - TOP) * 0 + (o.floor !== undefined ? 0 : 0);
    sh.scale.setScalar((king ? 1.55 : 1.35) * s * (1 - clamp(lift * 0.25, 0, 0.4)));
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

  // particles: golden sparks and pale chips (instanced, simulated with a fixed step so the look is stable)
  const NP = 72;
  const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NP);
  sparks.frustumCulled = false; sparks.instanceMatrix.setUsage?.(35048); scene.add(sparks);
  const cWarm = new THREE.Color('#ffd878'), cTeal = new THREE.Color('#5fe0d0'), cPale = new THREE.Color('#fff4d8');
  for (let i = 0; i < NP; i++) sparks.setColorAt(i, i % 3 === 0 ? cTeal : i % 3 === 1 ? cWarm : cPale);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
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
      if (p.y < TOP && p.vy < 0 && Math.abs(p.x) < 4.5 && Math.abs(p.z) < 4.5) { p.y = TOP; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
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

  // steam over the tea glasses and floating lamp dust
  const steam = [];
  for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xfff1de, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(sp); steam.push(sp); }
  const motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex, color: 0xffd9a0, size: 0.22, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  { const n = 70, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 24 - 12; a[i * 3 + 1] = 0.6 + ((Math.sin(i * 78.233) * 12345.6789) % 1 + 1) % 1 * 6; a[i * 3 + 2] = (Math.sin(i * 39.346) * 9876.54 % 1) * 20 - 10; } motes.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); motes.userData.base = a.slice(); scene.add(motes); }

  await tick();
  // ---------------------------------------------------------------- camera
  let W = 1, H = 1, dprNow = 1, L_ = null, clock = 0, lastT = 0, frames = 0, ema = 16;
  const tmp = new THREE.Vector3();
  const corners = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 0.3]) corners.push(new THREE.Vector3(sx * HALF, y, sz * HALF));
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 1) {
    const k = W / L_.w, tw = rect.w * k * fill, th = rect.h * k * fill, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place = (d) => { camera.position.set(Math.sin(yw) * Math.cos(p) * d, 0.2 + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d); camera.lookAt(0, 0.2, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const extent = (d) => {
      place(d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmp.copy(c).project(camera); const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 4, hi = 120;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2, e = extent(mid); if (e.w > tw || e.h > th) lo = mid; else hi = mid; }
    const e = extent(hi), cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, e.cx - cxp, e.cy - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmp.set(x, y, z).project(camera); return { x: ((tmp.x + 1) / 2) * L_.w, y: ((1 - tmp.y) / 2) * L_.h }; };
  const cellXZ = (i) => { const r = i >> 3, c = i & 7, rr = L_.flip ? 7 - r : r, cc = L_.flip ? 7 - c : c; return { X: cc - 3.5, Z: rr - 3.5 }; };
  v3.sq = (i) => { const { X, Z } = cellXZ(i), a = toVirt(X, TOP, Z), b = toVirt(X + 0.5, TOP, Z), c = toVirt(X - 0.5, TOP, Z); return { x: a.x, y: a.y, s: Math.abs(b.x - c.x) }; };
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  v3.pick = (vx, vy) => {
    if (!L_) return -1;
    let best = -1, bd = 1e9;
    for (const q of v3.pieces) {
      if (q.cell === undefined || q.cell < 0 || q.drag) continue;
      const { X, Z } = cellXZ(q.cell), base = toVirt(X, TOP + 0.02, Z), top = toVirt(X, TOP + (q.king ? KING_H : MAN_H), Z);
      const unit = Math.abs(toVirt(X + 0.5, TOP, Z).x - toVirt(X - 0.5, TOP, Z).x);
      const cy = (base.y + top.y) / 2, ry = Math.abs(base.y - top.y) / 2 + unit * 0.2, rx = unit * 0.46;
      const dx = (vx - base.x) / rx, dy = (vy - cy) / ry, dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bd) { bd = dd; best = q.cell; }
    }
    if (best >= 0) return best;
    orig.copy(camera.position); ray.set((vx / L_.w) * 2 - 1, 1 - (vy / L_.h) * 2, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return -1;
    const t = (TOP - orig.y) / ray.y; if (t < 0) return -1;
    hitV.copy(orig).addScaledVector(ray, t);
    const cc = Math.floor(hitV.x + 4), rr = Math.floor(hitV.z + 4);
    if (cc < 0 || cc > 7 || rr < 0 || rr > 7) return -1;
    return (L_.flip ? 7 - rr : rr) * 8 + (L_.flip ? 7 - cc : cc);
  };
  // virtual -> world on the board plane (the flat layout the 2D logic works in, centred on the board)
  let bcx = 0, bcy = 0, bcell = 1;
  const wx = (vx) => (vx - bcx) / bcell, wz = (vy) => (vy - bcy) / bcell;
  function dragWorld(vx, vy, h) {
    orig.copy(camera.position); ray.set((vx / L_.w) * 2 - 1, 1 - (vy / L_.h) * 2, 0.5).unproject(camera).sub(orig).normalize();
    const t = (h - orig.y) / (ray.y || -1e-5); hitV.copy(orig).addScaledVector(ray, t); return { X: hitV.x, Z: hitV.z };
  }

  await tick();
  // ---------------------------------------------------------------- hero demonstration (title and document screens)
  const heroItems = [];
  function heroState(state) {
    heroItems.length = 0;
    const T = state.calm ? 1.5 : state.t % 9, at = (r, c) => ({ X: c - 3.5, Z: r - 3.5 });
    const hops = [[6, 2], [4, 2], [4, 4], [2, 4]], caps = [[5, 2], [4, 3], [3, 4]];
    const t0 = 1.2, hopLen = 0.55, resetT = 6.6, appear = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    const sc = 0.25 + 0.75 * ease(clamp(appear, 0, 1));
    for (const [r, c] of [[6, 6], [3, 1], [0, 1], [0, 6], [1, 4], [2, 6], [3, 0]]) heroItems.push({ side: 2, ...at(r, c), scale: sc });
    for (const [r, c] of [[5, 5], [7, 0], [7, 3], [5, 7], [6, 5], [7, 6]]) heroItems.push({ side: 1, ...at(r, c), scale: sc });
    caps.forEach(([r, c], k) => {
      const tl = t0 + (k + 1) * hopLen;
      if (T < tl) heroItems.push({ side: 2, ...at(r, c), scale: sc });
      else { const f = (T - tl) / 0.6; if (f < 1) heroItems.push({ side: 2, ...at(r, c), cap: f, id: k + 3, scale: sc }); }
    });
    const hi = clamp(Math.floor((T - t0) / hopLen), -1, 2), f = clamp((T - t0) / hopLen - Math.max(0, hi), 0, 1);
    const a0 = T < t0 ? hops[0] : hops[Math.min(3, hi)], a1 = T < t0 ? hops[0] : hops[Math.min(3, hi + 1)], e = T >= t0 + 3 * hopLen ? 1 : ease(f);
    const p0 = at(a0[0], a0[1]), p1 = at(a1[0], a1[1]);
    const air = T >= t0 && T < t0 + 3 * hopLen;
    const X = T >= t0 + 3 * hopLen ? at(...hops[3]).X : p0.X + (p1.X - p0.X) * e, Z = T >= t0 + 3 * hopLen ? at(...hops[3]).Z : p0.Z + (p1.Z - p0.Z) * e;
    heroItems.push({ side: 1, X, Z, lift: air ? 0.18 + Math.sin(Math.PI * f) * 0.7 : T < t0 ? clamp((T - 0.6) / 0.5, 0, 1) * 0.12 : 0, scale: sc, mover: true });
    return { T, t0, hopLen, hops };
  }

  await tick();
  // ---------------------------------------------------------------- frame
  const burstSeen = new Map();
  function present(state, L, dt) {
    const sc = state.scene, playing = !(sc === 'title' || sc === 'demo-limit' || sc === 'doc');
    hideAll(); markN = 0;
    const items = [];
    if (playing) {
      for (const q of v3.pieces) {
        if (q.drag) { const w = dragWorld(q.x, q.y, TOP + 0.75); items.push({ side: q.side, king: q.king, X: w.X, Z: w.Z, lift: 0.75, scale: 1.04, rz: q.tilt || 0 }); continue; }
        items.push({ side: q.side, king: q.king, X: wx(q.x), Z: wz(q.y), lift: q.lift * 0.9, scale: q.scale ?? 1, rz: q.tilt || 0, cell: q.cell });
      }
      for (const m of v3.marks) {
        const X = wx(m.x), Z = wz(m.y), pu = m.a ?? 1;
        switch (m.kind) {
          case 'last': markQuad(X, Z, glowTex, '#ffd25a', 0.42, 1.15); break;
          case 'movable': markQuad(X, Z, glowTex, '#ffd25a', 0.2 + pu * 0.3, 1.1); markQuad(X, Z, ringTex, '#ffe9a0', 0.35 + pu * 0.35, 0.95); break;
          case 'sel': markQuad(X, Z, glowTex, '#ffe27a', 0.5 + pu * 0.3, 1.35); markQuad(X, Z, ringTex, '#ffd24a', 0.9, 1.05); break;
          case 'step': { markQuad(X, Z, glowTex, '#ffd24a', 0.5, 1.1);
            const X0 = wx(m.x0), Z0 = wz(m.y0), d = Math.hypot(X - X0, Z - Z0), ang = Math.atan2(X - X0, Z - Z0);
            markQuad((X + X0) / 2, (Z + Z0) / 2, glowTex, '#ffd24a', 0.55, 0.22, d, ang); break; }
          case 'move': markQuad(X, Z, glowTex, '#fff2c8', 0.45 + pu * 0.3, 0.55); markQuad(X, Z, ringTex, '#fff2c8', 0.6 + pu * 0.3, 0.62); break;
          case 'cap': markQuad(X, Z, glowTex, '#ff4a2a', 0.38 + pu * 0.3, 1.25); markQuad(X, Z, ringTex, '#ff4a2a', 0.85 + pu * 0.15, 1.02); break;
          case 'hint': markQuad(X, Z, glowTex, '#5af09a', 0.3 + pu * 0.3, 1.2); markQuad(X, Z, ringTex, '#5af09a', 0.9, 1.05); break;
          case 'lesson': markQuad(X, Z, ringTex, '#ffd24a', 0.6 + pu * 0.4, 1.05); break;
          case 'kb': markQuad(X, Z, ringTex, '#7dff9a', 1, 1.05); break;
        }
      }
      for (const f of v3.fx) {
        const X = wx(f.x), Z = wz(f.y);
        if (f.kind === 'cap') items.push({ side: f.side, king: f.king, X, Z, cap: f.f, id: f.id });
        else if (f.kind === 'crown') { const ff = f.f; markQuad(X, Z, ringTex, '#ffe08a', 0.9 * (1 - ff), 1.2 + 2.2 * ff); if (ff < 0.12 && burstSeen.get('c' + f.id) !== state.t) { burstSeen.set('c' + f.id, state.t); burst(X, TOP + 0.7, Z, 18, 2.2); } }
        else if (f.kind === 'land') { markQuad(X, Z, ringTex, '#fff3d0', 0.7 * (1 - f.f), 0.7 + 1.1 * f.f); }
        else if (f.kind === 'trail') { const X0 = wx(f.x0), Z0 = wz(f.y0), d = Math.hypot(X - X0, Z - Z0) + 0.001, ang = Math.atan2(X - X0, Z - Z0); markQuad((X + X0) / 2, (Z + Z0) / 2, glowTex, '#ffd878', 0.55, 0.5, d + 0.5, ang, TOP + 0.22); }
      }
    } else {
      const hs = heroState(state);
      for (const h of heroItems) items.push(h);
      const burstAt = (k, t0, X, Z, n) => { const key = k + Math.floor(state.t / 9); if (hs.T > t0 && hs.T < t0 + 0.2 && burstSeen.get(key) !== true) { burstSeen.set(key, true); burst(X, TOP + 0.45, Z, n); } };
      hs.hops.slice(1).forEach(([r, c], i) => burstAt('h' + i, hs.t0 + (i + 1) * hs.hopLen - 0.05, c - 3.5, r - 3.5, 8));
    }
    for (const it of items) {
      if (it.cap !== undefined) {
        const f = it.cap, id = it.id || 0, ang0 = Math.atan2(it.Z, it.X) + ((id % 5) - 2) * 0.28;
        if (f < 0.2) { place(it.side, it.king, it.X, it.Z, { y: 0.12 * (f / 0.2), scale: 1 + 0.08 * (f / 0.2) }); continue; }
        const g = (f - 0.2) / 0.8, D = 3.2 + (id % 3) * 0.7, hz = D * (1 - (1 - g) ** 2);
        const X = it.X + Math.cos(ang0) * hz, Z = it.Z + Math.sin(ang0) * hz, off = Math.abs(X) > HALF - 0.1 || Math.abs(Z) > HALF - 0.1;
        const floor = off ? 0.006 : TOP, bounce = 1.5 * Math.abs(Math.sin(g * Math.PI * 1.8)) * (1 - g) ** 1.2 + 0.2 * Math.sin(Math.PI * Math.min(1, g * 3));
        const shrink = g > 0.8 ? clamp((1 - g) / 0.2, 0.001, 1) : 1;
        place(it.side, it.king, X, Z, { floor, y: bounce, scale: shrink * (it.scale ?? 1), rx: g * 7 * (id % 2 ? 1 : -1), rz: g * 5 });
        const key = 'k' + id + '|' + Math.round(it.X * 10) + '|' + Math.round(it.Z * 10);
        if (f < 0.35 && burstSeen.get(key) !== state.t) { burstSeen.set(key, state.t); burst(it.X, TOP + 0.35, it.Z, 12); }
        continue;
      }
      place(it.side, it.king, it.X, it.Z, { y: it.lift || 0, scale: it.scale ?? 1, rz: it.rz || 0, ry: (it.side === 1 ? 0.15 : -0.15) });
    }
    if (burstSeen.size > 400) burstSeen.clear();
    for (let i = markN; i < markPool.length; i++) markPool[i].visible = false;
    // ambience: lamp flicker, swinging lamps, steam, motes, light pool
    const t = clock, calm = state.calm;
    rig.key.intensity = rig.config.keyI * (1 + (calm ? 0 : 0.035 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 13.1 + 1)));
    pool.intensity = 8 * (1 + (calm ? 0 : 0.05 * Math.sin(t * 6.1)));
    lamps.forEach((l, i) => { l.rotation.z = calm ? 0 : Math.sin(t * 0.55 + i * 1.7) * 0.035; l.rotation.x = calm ? 0 : Math.cos(t * 0.43 + i) * 0.02; });
    const vis = TIERS[tier].fx;
    steam.forEach((sp, i) => {
      const src = i < 7 ? tea : tea2, u = ((t * 0.28 + i * 0.137) % 1), seed = i * 3.7;
      sp.visible = vis; if (!vis) return;
      const sc2 = tea.scale.x;
      sp.position.set(src.position.x + Math.sin(u * 5 + seed) * 0.16 * sc2 * 0.5, src.position.y + (0.78 + u * 1.9) * (sc2 / 2.05), src.position.z + Math.cos(u * 4 + seed) * 0.12);
      sp.scale.setScalar(0.35 + u * 0.9); sp.material.opacity = Math.sin(u * Math.PI) * 0.2;
    });
    motes.visible = vis;
    if (vis && !calm) { const a = motes.geometry.attributes.position, b = motes.userData.base; for (let i = 0; i < a.count; i++) { a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.3 + i) * 0.35; a.array[i * 3] = b[i * 3] + Math.sin(t * 0.17 + i * 2) * 0.4; } a.needsUpdate = true; }
    stepParts(dt);
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
  }

  await tick();
  // ----- phase 1: before the 2D UI draws (camera, projection used by badges and picking)
  function prepare(state, L) {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    L_ = L;
    const look = LOOKS[state.wood] ? state.wood : 'iznik';
    ensureBoard(look); setStyle(STYLES.includes(state.style) ? state.style : 'classic');
    const sc = state.scene; v3.scene = sc;
    const B_ = L.board; bcell = B_.cell; bcx = B_.gx + 4 * B_.cell; bcy = B_.gy + 4 * B_.cell;
    pool.position.set(-1, 6.5, 1.5);
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.08, y: L.h * 0.42, w: L.w * 0.84, h: L.w * 0.7 };
      fitCamera(hr, L.land ? 44 : 42, 30, state.calm ? 0 : Math.sin(clock * 0.22) * 5, 0.97);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.04, y: L.h * 0.12, w: L.w * 0.92, h: L.h * 0.76 }, 40, 30, state.calm ? 0 : Math.sin(clock * 0.15) * 6, 0.9);
    } else {
      fitCamera({ x: B_.x, y: B_.y, w: B_.S, h: B_.S + B_.thick }, L.land ? 54 : 58, 28, 0, 1);
    }
  }

  await tick();
  // ---------------------------------------------------------------- 2D sprites for plates, trays, diagrams and the result card
  function buildSprites() {
    const SP = 320, sc = new THREE.Scene(), p = (30 * Math.PI) / 180, half = SPR.w / 2;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 40);
    const ty = (SPR.by - 0.5) * SPR.w / Math.cos(p);
    cam.position.set(0, ty + Math.sin(p) * 10, Math.cos(p) * 10); cam.lookAt(0, ty, 0); cam.updateMatrixWorld();
    const l1 = new THREE.DirectionalLight(0xfff0d6, 3.3); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 0.9); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3a30, 1.2), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.6;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    const shadowWas = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    for (const st of STYLES) for (const side of [1, 2]) for (const king of [false, true]) {
      const g = makePiece(side, king, st); g.rotation.y = 0.25; sc.add(g);
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.map[`${st}|${side}|${king ? 1 : 0}`] = c; sc.remove(g);
    }
    renderer.setClearColor(0x120a06, 1);
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

  try { ensureBoard('iznik'); applyTier(); buildSprites(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
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
