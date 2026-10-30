// Sholo Guti 3D presenter. It READS the simulation state (game.getState()) and the stones / markers / effects that view.js records in
// v3 (virtual units); it never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: the lit courtyard with
// the chalk-lattice clay slab, pebble and glazed-clay stones, lamps, dust, fireflies. The 2D layer draws only text, plaques and buttons.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildScenery } from '../vendor3d/scenery3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites, SPR } from '../src/art.js';
import { POINTS } from '../src/rules.js';
import { TOP, PEB_H, CLAY_H, buildBoard, buildMat, buildWorld, makePiece, softTex, LOOKS, HEX_PTS } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: true, scenery: 'high' },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: true, scenery: 'medium' },
  { name: 'low', dpr: 1, shadow: 0, fx: false, scenery: 'low' },
];
const STYLES = ['classic', 'marigold'];
export const SCENERY_LAYERS = [
  { t: 'sky', id: 'sky-golden' },
  { t: 'backdrop', id: 'bd-rice' },
  { t: 'band', id: 'band-fields', r: 70, h: 11, arc: [-170, -10] },
];

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
  renderer.setClearColor(0x2a1a14, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- the scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 8, fog: { near: 38, far: 110 },
    overrides: { bg: 0xd9a070, fog: 0xc99468, hemiSky: 0xffd0a0, hemiGround: 0x4a3224, hemi: 0.5, key: 0xffc27a, keyI: 2.5, keyPos: [-6.5, 7.5, 5.5], fill: 0x8fa6e8, fillI: 0.35, fillPos: [6, 4, 6], rim: 0xffa860, rimI: 1.6, rimPos: [5, 4, -8], exposure: 0.9, env: 0.3 },
  });
  const env = B.createEnvironment(renderer, scene, { intensity: 0.3 });

  const glowTex = softTex('255,255,255', 0.95), haloTex = softTex('255,236,200', 0.9, 256);
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 38, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(0.64, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const world = buildWorld({ fx: TIERS[tier].fx }); scene.add(world.group);
  let sceneryObj = null;
  const mountScenery = () => {
    try {
      sceneryObj = buildScenery({ layers: SCENERY_LAYERS, culture: 'south-asian', timeOfDay: 'dusk', quality: TIERS[tier].scenery, wind: 0.5, radius: 120 });
      sceneryObj.group.position.y = -0.02; scene.add(sceneryObj.group);
      sceneryObj.ready?.catch?.((e) => console.warn('scenery failed', e));
    } catch (e) { console.warn('scenery unavailable', e); sceneryObj = null; }
  };
  mountScenery();

  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  boardRoot.add(buildMat());
  let boardGrp = null, boardLook = null;
  function ensureBoard(look) {
    if (boardGrp && boardLook === look) return;
    if (boardGrp) { boardRoot.remove(boardGrp); boardGrp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    boardGrp = buildBoard(LOOKS[look] ? look : 'clay'); boardRoot.add(boardGrp); boardLook = look;
  }

  // ---------------------------------------------------------------- stone pools, markers, particles
  const blobTex = softTex('0,0,0', 0.9);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  let style = 'classic';
  const pools = new Map();
  function takePiece(side, i) {
    let arr = pools.get(side); if (!arr) { arr = []; pools.set(side, arr); }
    while (arr.length <= i) {
      const wrap = new THREE.Group(), model = makePiece(side, false, style);
      const sh = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 })); sh.position.y = 0.012; sh.renderOrder = 2;
      wrap.add(sh, model); wrap.userData = { model, sh }; wrap.visible = false; pieceRoot.add(wrap); arr.push(wrap);
    }
    return arr[i];
  }
  function setStyle(s) { if (s === style) return; style = s; for (const arr of pools.values()) for (const w of arr) pieceRoot.remove(w); pools.clear(); }
  const used = new Map();
  const hideAll = () => { for (const arr of pools.values()) for (const w of arr) w.visible = false; used.clear(); };
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function place(side, X, Z, o = {}) {
    const i = used.get(side) || 0; used.set(side, i + 1);
    const w = takePiece(side, i), m = w.userData.model, sh = w.userData.sh, lift = o.y ?? 0, s = o.scale ?? 1, sq = o.squash || 0, base = o.floor ?? TOP;
    w.visible = true; w.position.set(X, base, Z);
    m.position.y = lift;
    if (o.q) m.quaternion.copy(o.q); else m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    m.scale.set(s * (1 + sq * 0.4), s * (1 - sq), s * (1 + sq * 0.4));
    const up = o.shadowLift ?? lift;
    sh.position.y = 0.012; sh.scale.setScalar(1.25 * s * (1 - clamp(up * 0.25, 0, 0.4)));
    sh.material.opacity = 0.8 * (1 - clamp(up * 0.5, 0, 0.7));
    return w;
  }

  const markRoot = new THREE.Group(); scene.add(markRoot);
  const markPool = []; let markN = 0;
  function markQuad(x, z, tex, color, op, sx, sz = sx, rot = 0, y = TOP + 0.045) {
    let m = markPool[markN];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; markRoot.add(m); markPool.push(m); }
    markN++; m.visible = true; m.material.map = tex; m.material.color.set(color); m.material.opacity = clamp(op, 0, 1);
    m.position.set(x, y, z); m.scale.set(sx, 1, sz); m.rotation.y = rot;
  }

  // particles: warm sparks (clay chips) and chalk dust puffs
  const NP = 72;
  const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NP);
  sparks.frustumCulled = false; scene.add(sparks);
  const cWarm = new THREE.Color('#ffd878'), cPale = new THREE.Color('#fff4d8'), cInd = new THREE.Color('#9fb4ff');
  for (let i = 0; i < NP; i++) sparks.setColorAt(i, i % 3 === 0 ? cInd : i % 3 === 1 ? cWarm : cPale);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function burst(x, y, z, n, up = 1.6) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + i * 0.7, sp = 0.7 + ((i * 37) % 10) * 0.11; parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up + ((i * 13) % 7) * 0.22, vz: Math.sin(a) * sp, life: 0, max: 0.55 + ((i * 7) % 5) * 0.1 }); }
    if (parts.length > NP) parts.splice(0, parts.length - NP);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < TOP && p.vy < 0 && Math.abs(p.x) < 4.8 && Math.abs(p.z) < 4.8) { p.y = TOP; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.life >= p.max) parts.splice(i, 1);
    }
    for (let i = 0; i < NP; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q, _s); }
      sparks.setMatrixAt(i, _m);
    }
    sparks.instanceMatrix.needsUpdate = true; sparks.visible = parts.length > 0;
  }
  // chalk dust: soft white puffs that bloom and drift up when a stone lands or is flicked off
  const NCH = 28, chalk = [];
  for (let i = 0; i < NCH; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xfff6e6, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; scene.add(sp); chalk.push({ sp, life: 1, max: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0, size: 0.5 }); }
  let chalkHead = 0;
  function puff(x, y, z, n, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const c = chalk[chalkHead++ % NCH], a = i * 2.4 + x * 3, sp = 0.18 + (i % 3) * 0.1;
      c.x = x; c.y = y + 0.04; c.z = z; c.vx = Math.cos(a) * sp; c.vz = Math.sin(a) * sp; c.life = 0; c.max = 0.8 + (i % 4) * 0.12; c.size = size * (0.7 + (i % 3) * 0.25); c.sp.visible = true;
    }
  }
  function stepChalk(dt) {
    for (const c of chalk) {
      if (c.life >= c.max) { c.sp.visible = false; continue; }
      c.life += dt; const u = c.life / c.max;
      c.x += c.vx * dt; c.z += c.vz * dt; c.y += 0.22 * dt;
      c.sp.position.set(c.x, c.y, c.z); c.sp.scale.setScalar(c.size * (0.5 + u * 1.5)); c.sp.material.opacity = 0.42 * (1 - u) * Math.min(1, u * 8);
    }
  }

  // ---------------------------------------------------------------- camera and projection
  let W = 1, H = 1, dprNow = 1, L_ = null, clock = 0, lastT = 0, frames = 0, ema = 16;
  const tmp = new THREE.Vector3();
  const cornersFor = (rot) => { const c = []; for (const [px, pz] of HEX_PTS) for (const y of [0, 0.5]) c.push(new THREE.Vector3(rot ? pz : px, y, rot ? px : pz)); return c; };
  const cornersP = cornersFor(false), cornersR = cornersFor(true);
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 1, rot = false) {
    const k = W / L_.w, tw = rect.w * k * fill, th = rect.h * k * fill, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180, corners = rot ? cornersR : cornersP;
    camera.fov = fov; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place2 = (d) => { camera.position.set(Math.sin(yw) * Math.cos(p) * d, 0.2 + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d); camera.lookAt(0, 0.2, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const extent = (d) => {
      place2(d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
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
  // virtual -> world on the board plane (the flat layout the 2D logic works in, centred on the board)
  let bcx = 0, bcy = 0, bcell = 1;
  const wx = (vx) => (vx - bcx) / bcell, wz = (vy) => (vy - bcy) / bcell;
  const ptW = (i) => { const p = L_.sq(i); return { X: wx(p.x), Z: wz(p.y) }; };
  v3.sq = (i) => { const { X, Z } = ptW(i), a = toVirt(X, TOP, Z), b = toVirt(X + 0.5, TOP, Z), c = toVirt(X - 0.5, TOP, Z); return { x: a.x, y: a.y, s: Math.abs(b.x - c.x) }; };
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  const rayHit = (vx, vy, h) => {
    orig.copy(camera.position); ray.set((vx / L_.w) * 2 - 1, 1 - (vy / L_.h) * 2, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (h - orig.y) / ray.y; if (t < 0) return null;
    return hitV.copy(orig).addScaledVector(ray, t);
  };
  v3.pick = (vx, vy) => {
    if (!L_) return -1;
    const h = rayHit(vx, vy, TOP + 0.12); if (!h) return -1;
    let best = -1, bd = 0.52 * 0.52;
    for (let i = 0; i < POINTS.length; i++) { const { X, Z } = ptW(i), d = (X - h.x) ** 2 + (Z - h.z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  function dragWorld(vx, vy, h) { const q = rayHit(vx, vy, h); return q ? { X: q.x, Z: q.z } : { X: 0, Z: 0 }; }

  // ---------------------------------------------------------------- hero demonstration (title and document screens)
  // the board lies on its side (rot): board point (px, py) -> world (py - 2, px - 2). Ivory jumps twice in one turn (22 -> 12 -> 4).
  const heroW = (i) => ({ X: POINTS[i][1] - 2, Z: POINTS[i][0] - 2 });
  const IVORY = [15, 16, 18, 20, 24, 31, 32, 33, 34, 35, 36], INDIGO = [0, 1, 2, 3, 6, 25, 26, 27, 28, 29, 30];
  const heroItems = [];
  function heroState(state) {
    heroItems.length = 0;
    const T = state.calm || state.frozen ? 3.2 : state.t % 7.4, t1 = 1.3, t2 = 2.2, seg = 0.8;
    const appear = T < 0.5 ? T / 0.5 : T > 6.8 ? Math.max(0, 1 - (T - 6.8) / 0.6) : 1, sc = 0.25 + 0.75 * ease(clamp(appear, 0, 1));
    for (const i of IVORY) heroItems.push({ side: 1, ...heroW(i), scale: sc, skip22: i === 22 });
    for (const i of INDIGO) heroItems.push({ side: 2, ...heroW(i), scale: sc });
    for (const [i, t0] of [[17, t1 + seg * 0.55], [8, t2 + seg * 0.55]]) {
      if (T < t0) heroItems.push({ side: 2, ...heroW(i), scale: sc });
      else { const f = (T - t0) / 0.7; if (f < 1) heroItems.push({ side: 2, ...heroW(i), cap: f, id: i, scale: sc }); }
    }
    const A = heroW(22), B1 = heroW(12), C = heroW(4);
    let X = A.X, Z = A.Z, lift = 0, f = 0;
    if (T >= t1 && T < t2) { f = clamp((T - t1) / seg, 0, 1); const e = ease(f); X = A.X + (B1.X - A.X) * e; Z = A.Z + (B1.Z - A.Z) * e; lift = Math.sin(Math.PI * f) * 0.9 + 0.1; }
    else if (T >= t2) { f = clamp((T - t2) / seg, 0, 1); const e = ease(f); X = B1.X + (C.X - B1.X) * e; Z = B1.Z + (C.Z - B1.Z) * e; lift = Math.sin(Math.PI * f) * 0.9 + 0.1; }
    else lift = T > 0.8 ? clamp((T - 0.8) / 0.4, 0, 1) * 0.35 : 0;
    heroItems.push({ side: 1, X, Z, lift, scale: sc });
    return { T, t1, t2, seg, B1, C };
  }

  // ---------------------------------------------------------------- frame
  const burstSeen = new Map();
  function present(state, L, dt) {
    const sc = state.scene, playing = !(sc === 'title' || sc === 'demo-limit' || sc === 'doc');
    hideAll(); markN = 0;
    const items = [];
    const hrot = playing ? L.rot : true;
    boardRoot.rotation.y = hrot ? Math.PI / 2 : 0;
    if (playing) {
      for (const q of v3.pieces) {
        if (q.drag) { const w = dragWorld(q.x, q.y, TOP + 0.7); items.push({ side: q.side, X: w.X, Z: w.Z, lift: 0.7, scale: 1.06, rz: q.tilt || 0 }); continue; }
        items.push({ side: q.side, X: wx(q.x), Z: wz(q.y), lift: q.lift * 0.8, scale: q.scale ?? 1, rz: q.tilt || 0, rock: q.rock });
      }
      for (const m of v3.marks) {
        const X = wx(m.x), Z = wz(m.y), pu = m.a ?? 1;
        switch (m.kind) {
          case 'last': markQuad(X, Z, glowTex, '#ffd25a', 0.38, 1.0); break;
          case 'sel': markQuad(X, Z, glowTex, '#ffe27a', 0.5 + pu * 0.3, 1.25); markQuad(X, Z, ringTex, '#ffd24a', 0.9, 0.98); break;
          case 'step': { markQuad(X, Z, glowTex, '#ffd24a', 0.5, 1.0);
            const X0 = wx(m.x0), Z0 = wz(m.y0), d = Math.hypot(X - X0, Z - Z0), ang = Math.atan2(X - X0, Z - Z0);
            markQuad((X + X0) / 2, (Z + Z0) / 2, glowTex, '#ffd24a', 0.55, 0.2, d, ang); break; }
          case 'move': markQuad(X, Z, glowTex, '#fff2c8', 0.5 + pu * 0.3, 0.6); markQuad(X, Z, ringTex, '#fff2c8', 0.6 + pu * 0.3, 0.7); break;
          case 'cap': markQuad(X, Z, glowTex, '#ff4a2a', 0.4 + pu * 0.3, 1.2); markQuad(X, Z, ringTex, '#ff4a2a', 0.85 + pu * 0.15, 0.98); break;
          case 'hint': markQuad(X, Z, glowTex, '#5af09a', 0.3 + pu * 0.3, 1.15); markQuad(X, Z, ringTex, '#5af09a', 0.9, 1.0); break;
          case 'lesson': markQuad(X, Z, ringTex, '#ff7a3a', 0.6 + pu * 0.4, 1.0); markQuad(X, Z, glowTex, '#ff9a4a', 0.25 + pu * 0.2, 1.0); break;
          case 'kb': markQuad(X, Z, ringTex, '#7dff9a', 1, 1.0); break;
        }
      }
      for (const f of v3.fx) {
        const X = wx(f.x), Z = wz(f.y);
        if (f.kind === 'cap') items.push({ side: f.side, X, Z, cap: f.f, id: f.id });
        else if (f.kind === 'land') {
          markQuad(X, Z, ringTex, '#fff3d0', 0.7 * (1 - f.f), 0.6 + 1.1 * f.f);
          const key = 'l' + f.id + Math.round(X * 4) + '|' + Math.round(Z * 4);
          if (f.f < 0.2 && burstSeen.get(key) !== state.t) { burstSeen.set(key, state.t); puff(X, TOP, Z, 5, 0.45); }
        }
      }
    } else {
      const hs = heroState(state);
      for (const h of heroItems) if (!h.skip22) items.push(h);
      const burstAt = (k, t0, X, Z) => { const key = k + Math.floor(state.t / 7.4); if (hs.T > t0 && hs.T < t0 + 0.25 && burstSeen.get(key) !== true) { burstSeen.set(key, true); puff(X, TOP, Z, 6, 0.5); burst(X, TOP + 0.2, Z, 6, 1.2); } };
      burstAt('a', hs.t1 + hs.seg - 0.05, hs.B1.X, hs.B1.Z); burstAt('b', hs.t2 + hs.seg - 0.05, hs.C.X, hs.C.Z);
    }
    for (const it of items) {
      if (it.cap !== undefined) {                                          // flicked off the slab: skids, stands on edge, rolls across the mud, wobbles flat
        const f = it.cap, id = it.id || 0, dir = Math.atan2(it.Z, it.X) + ((id % 5) - 2) * 0.3;
        const hx = Math.cos(dir), hz = Math.sin(dir), Rr = 0.33;
        if (f < 0.16) { const e = f / 0.16; place(it.side, it.X, it.Z, { y: 0.1 * e, scale: (1 + 0.08 * e) * (it.scale ?? 1) }); continue; }
        const g = (f - 0.16) / 0.84, D = 3.4 + (id % 3) * 0.8, dist = D * (1 - (1 - g) ** 2.2);
        const X = it.X + hx * dist, Z = it.Z + hz * dist;
        const lim = hrot ? [4.9, 2.55] : [2.55, 4.9], onBoard = Math.abs(X) < lim[0] && Math.abs(Z) < lim[1];
        const floor = onBoard ? TOP : (Math.abs(X) < 3.7 && Math.abs(Z) < 5.7 ? 0.035 : 0.0);
        let psi = g < 0.1 ? ease(g / 0.1) * Math.PI / 2 : Math.PI / 2;      // tip up quickly, roll, then fall over with a growing wobble
        if (g > 0.78) { const u = (g - 0.78) / 0.22; psi = (Math.PI / 2) * (1 - u * u) + Math.sin(u * 22) * 0.1 * (1 - u); }
        psi = Math.max(0, psi);
        _ax.set(hx, 0, hz); _q1.setFromAxisAngle(_ax, psi); _q2.setFromAxisAngle(_up, -(dist / Rr)); _q1.multiply(_q2);
        const lift = Math.sin(psi) * (Rr - 0.02) + (g < 0.18 ? Math.sin(g / 0.18 * Math.PI) * 0.12 : 0);
        place(it.side, X, Z, { floor, y: lift, q: _q1, scale: it.scale ?? 1, shadowLift: lift * 0.4 });
        const key = 'k' + id + '|' + Math.round(it.X * 10) + '|' + Math.round(it.Z * 10);
        if (f < 0.3 && burstSeen.get(key) !== state.t) { burstSeen.set(key, state.t); burst(it.X, TOP + 0.25, it.Z, it.side === 2 ? 12 : 8); puff(it.X, TOP, it.Z, 4, 0.4); }
        continue;
      }
      let rx = 0, rz = it.rz || 0;
      if (it.rock !== undefined && it.rock >= 0 && it.rock < 1) { const u = it.rock, a = Math.sin(u * 26) * 0.1 * (1 - u) * (1 - u); rx = a * 0.6; rz += a; }
      const sq = it.rock !== undefined && it.rock >= 0 && it.rock < 0.12 ? Math.sin((it.rock / 0.12) * Math.PI) * 0.1 : 0;
      place(it.side, it.X, it.Z, { y: it.lift || 0, scale: it.scale ?? 1, rx, rz, ry: it.side === 1 ? 0.3 : -0.2, squash: sq });
    }
    if (burstSeen.size > 400) burstSeen.clear();
    for (let i = markN; i < markPool.length; i++) markPool[i].visible = false;
    // ambience
    const t = clock, calm = state.calm, vis = TIERS[tier].fx;
    rig.key.intensity = rig.config.keyI * (1 + (calm ? 0 : 0.03 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 13.1 + 1)));
    world.update(t, calm, vis);
    if (sceneryObj) { try { sceneryObj.update(calm ? 0 : dt, camera); } catch { /* keep drawing */ } }
    stepParts(dt); stepChalk(dt);
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
  }

  // ----- phase 1: before the 2D UI draws (camera, projection used by badges and picking)
  function prepare(state, L) {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    L_ = L;
    ensureBoard(LOOKS[state.wood] ? state.wood : 'clay'); setStyle(STYLES.includes(state.style) ? state.style : 'classic');
    const sc = state.scene; v3.scene = sc;
    const B_ = L.board; bcell = B_.cell; bcx = B_.x + B_.w / 2; bcy = B_.y + B_.h / 2;
    const sway = state.calm ? 0 : 1;
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.08, y: L.h * 0.42, w: L.w * 0.84, h: L.w * 0.5 };
      fitCamera(hr, L.land ? 30 : 26, 36, sway * Math.sin(clock * 0.2) * 5, 0.93, true);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.04, y: L.h * 0.14, w: L.w * 0.92, h: L.h * 0.7 }, 38, 30, sway * Math.sin(clock * 0.15) * 7, 0.9, true);
    } else {
      if (!L.land && !L.rot) fitCamera({ x: L.w * 0.02, y: B_.y - 12, w: L.w * 0.96, h: B_.h + B_.thick + 24 }, 60, 28, 0, 0.98, false);   // portrait: the hexagon fills the width, steeper camera
      else fitCamera({ x: B_.x, y: B_.y, w: B_.w, h: B_.h + B_.thick }, L.rot ? 40 : 40, 28, 0, 0.96, L.rot);
    }
  }

  // ---------------------------------------------------------------- 2D sprites for plates, trays, diagrams and the result card
  function buildSprites() {
    const SP = 320, sc = new THREE.Scene(), p = (30 * Math.PI) / 180, half = SPR.w / 2;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 40);
    const ty = (SPR.by - 0.5) * SPR.w / Math.cos(p);
    cam.position.set(0, ty + Math.sin(p) * 10, Math.cos(p) * 10); cam.lookAt(0, ty, 0); cam.updateMatrixWorld();
    const l1 = new THREE.DirectionalLight(0xfff0d6, 3.4); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 1.0); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3a30, 1.2), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.7;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    const shadowWas = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    for (const st of STYLES) for (const side of [1, 2]) {
      const g = makePiece(side, false, st); g.rotation.y = 0.3; g.scale.setScalar(1.12); sc.add(g);
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.map[`${st}|${side}`] = c; sc.remove(g);
    }
    renderer.setClearColor(0x2a1a14, 1);
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

  try { ensureBoard('clay'); applyTier(); buildSprites(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, rig, env,
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
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; if (sceneryObj) { scene.remove(sceneryObj.group); mountScenery(); } }
          v3.pieces.length = 0; v3.marks.length = 0; v3.fx.length = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
