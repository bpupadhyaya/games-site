// Bocce Roll 3D presenter (game-owned). It ONLY READS the game state (game.getState()); it never writes to it.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The 2D layer keeps all text, HUD, input, hit testing and the
// aiming guides; this draws the lit garden court, the balls, their shadows, the shell dust and the roll tracks.
//
// Camera: the play view uses the SAME pinhole the sim layout defines (cam.js: eye, forward, focal k, principal point ox/oy), so
// every 2D guide, ring and touch maps onto the 3D court exactly. The follow zoom and the hit shake of the 2D layer are applied
// to the projection as the same screen-space transform. Menus use a slow drifting hero camera low over the far end.
// Fallbacks: no WebGL / init failure -> not created (the baked 2D court stays); context lost -> v3.on = false (2D court) and
// restored -> rebuilt environment, crossfade back to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/ui.js';
import { layoutFor } from '../src/layout.js';
import { COURT, R_B, R_P } from '../src/sim.js';
import { TEAM } from '../src/art.js';
import { buildGarden, envScene, SUN_DIR, glowTexture, cvs, tex } from './court.js';
import { ballMaterial, PALLINO_PAL, sphere } from './balls.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// a pinhole pose in sim coordinates: eye, forward f, focal k (virtual px), principal point ox/oy
export function poseOf(eye, tgt, k, ox, oy) { const f = nrm(sub(tgt, eye)), r = nrm(crs(f, [0, 0, 1])), u = crs(r, f); return { eye, f, r, u, k, ox, oy }; }
// a hero pose that puts the sim point `anchor` at screen (ax, ay)
export function heroPose(eye, tgt, fovDeg, L, anchor, ax, ay) {
  const p = poseOf(eye, tgt, (L.h / 2) / Math.tan((fovDeg * Math.PI) / 360), 0, 0);
  const d = sub(anchor, eye), zc = dot(d, p.f), sx = dot(d, p.r) / zc, sy = -dot(d, p.u) / zc;
  p.ox = ax - sx * p.k; p.oy = ay - sy * p.k;
  return p;
}

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { ok: false };
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('keep') }); }
  catch (e) { console.warn('WebGL unavailable; 2D court kept', e); return noop; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xe9cfa6, 1);

  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ------------------------------------------------------------ scene and light: a garden at golden hour
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xead2aa, 34, 130);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  const hemi = new THREE.HemisphereLight(0xffe8cc, 0x6a7a40, 0.55);
  const key = new THREE.DirectionalLight(0xffd3a0, 2.5);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(0xa8bcff, 0.45);
  scene.add(hemi, key, key.target, fill);
  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
    scene.environment = pm.fromScene(envScene(), 0.02).texture;
    scene.environmentIntensity = 0.62;
    pm.dispose();
  }

  // ------------------------------------------------------------ the garden
  const nap = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const garden = await buildGarden(TIERS[tier].name, nap);
  scene.add(garden.root);
  let surfPal = 'shell';

  // ------------------------------------------------------------ balls
  const shadowTex = tex(cvs(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.45, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const balls = new Map();      // id -> entry
  let worldRef = null;
  const UPV = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function palFor(b) { return b.k ? PALLINO_PAL : TEAM[b.team] ?? TEAM[0]; }
  function makeEntry(b) {
    const pal = palFor(b), mat = ballMaterial(pal, b.k ? 7 : 11 + (b.id % 4) * 13, !!b.k);
    const mesh = new THREE.Mesh(sphere(b.r), mat); mesh.castShadow = true; mesh.receiveShadow = true;
    const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5, color: 0x1a1008 }));
    blob.renderOrder = 1;
    scene.add(mesh, blob);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(b.id * 1.3, b.id * 2.1, b.id * 0.7));
    return { mesh, blob, q, x: b.x, y: b.y, base: pal.base, wx: 0, wy: 0, seen: true, fadeMat: null };
  }
  function dropEntry(id) { const e = balls.get(id); scene.remove(e.mesh, e.blob); e.blob.material.dispose(); if (e.fadeMat) e.fadeMat.dispose(); balls.delete(id); }
  function placeBall(e, x, y, z, r, dt, alpha = 1) {
    // rolling: rotate about the axis perpendicular to the travel, by distance / radius (presentation only)
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy), onGround = z <= r + 0.012;
    if (d > 1e-6 && d < 1.5 && onGround) {
      tmpV.set(-dy, 0, -dx).normalize(); tmpQ.setFromAxisAngle(tmpV, d / r); e.q.premultiply(tmpQ);
      if (dt > 0) { const w = d / r / dt; e.wx = (-dy / d) * w; e.wy = (-dx / d) * w; }
    }
    if (!onGround && dt > 0 && (e.wx || e.wy)) { const w = Math.hypot(e.wx, e.wy); tmpV.set(e.wx / w, 0, e.wy / w); tmpQ.setFromAxisAngle(tmpV, w * dt); e.q.premultiply(tmpQ); e.wx *= 0.995; e.wy *= 0.995; }
    e.x = x; e.y = y;
    e.mesh.position.set(x, z, -y); e.mesh.quaternion.copy(e.q);
    const h = Math.max(0, z - r), s = r * (2.6 + h * 2.2);
    e.blob.position.set(x + 0.02, 0.003, -y + 0.03); e.blob.scale.set(s, 1, s);
    e.blob.material.opacity = (0.55 * alpha) / (1 + h * 5);
    e.mesh.visible = alpha > 0.01; e.blob.visible = alpha > 0.01;
    if (alpha < 0.999) {
      if (!e.fadeMat) { e.fadeMat = e.mesh.material.clone(); e.fadeMat.transparent = true; }
      e.fadeMat.opacity = alpha; e.mesh.material = e.fadeMat;
    }
  }
  function syncBalls(world, dt) {
    if (world !== worldRef) { for (const id of [...balls.keys()]) dropEntry(id); worldRef = world; clearTracks(); }
    for (const e of balls.values()) e.seen = false;
    if (world) for (const b of world.balls) {
      if (b.out && !b.dead && b.z < -1) continue;
      if ((b.out || b.dead) && b.fade > 1.2) continue;
      let e = balls.get(b.id);
      const pal = palFor(b);
      if (e && e.base !== pal.base) { dropEntry(b.id); e = null; }
      if (!e) { e = makeEntry(b); balls.set(b.id, e); }
      e.seen = true;
      const alpha = b.dead || b.out ? Math.max(0, 1 - b.fade * 1.6) : 1;
      placeBall(e, b.x, b.y, b.z, b.r, dt, alpha);
      if (alpha === 1 && b.z <= b.r + 0.01) addTrack(b.id, b.x, b.y, b.k);
    }
    for (const [id, e] of balls) if (!e.seen) dropEntry(id);
  }
  // the ball waiting at the foul line (the 2D layer draws the pull band and the gauge over it)
  const ready = { e: null, key: '' };
  function syncReady(state, dt) {
    const m = state.m;
    const show = state.scene === 'play' && m && (state.humanTurn || state.aiDrag) && (m.phase === 'aim' || m.phase === 'pallino');
    if (!show) { if (ready.e) { ready.e.mesh.visible = false; ready.e.blob.visible = false; } return; }
    const isP = m.phase === 'pallino', base = isP ? PALLINO_PAL.base : TEAM[m.turn].base, k2 = `${isP}|${m.turn}|${base}`;
    if (!ready.e || ready.key !== k2) {
      if (ready.e) scene.remove(ready.e.mesh, ready.e.blob);
      const fake = { id: 50 + (isP ? 9 : m.turn), k: isP, team: m.turn, r: isP ? R_P : R_B, x: state.rel, y: COURT.startY };
      ready.e = makeEntry(fake); ready.key = k2; ready.r = fake.r;
    }
    const r = ready.r, hover = state.drag || state.aiDrag ? 0 : 0.015 * Math.sin(state.t * 3);
    ready.e.wx = ready.e.wy = 0; ready.e.x = state.rel; ready.e.y = COURT.startY;
    tmpQ.setFromAxisAngle(UPV, dt * 0.6); ready.e.q.premultiply(tmpQ);   // a slow turn in the hand
    placeBall(ready.e, state.rel, COURT.startY, r + hover, r, 0);
  }

  // ------------------------------------------------------------ tracks left in the shell (raked smooth at each new end)
  const MAXT = 1400;
  const trackGeo = new THREE.PlaneGeometry(1, 1); trackGeo.rotateX(-Math.PI / 2);
  const trackTex = tex(cvs(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
  const tracks = new THREE.InstancedMesh(trackGeo, new THREE.MeshBasicMaterial({ map: trackTex, color: 0x4a3420, transparent: true, opacity: 0.16, depthWrite: false }), MAXT);
  tracks.count = 0; tracks.frustumCulled = false; tracks.renderOrder = 0; scene.add(tracks);
  let tN = 0, trackKey = '';
  const lastT = new Map(), m4 = new THREE.Matrix4(), eul = new THREE.Euler(), sc3 = new THREE.Vector3(), pos3 = new THREE.Vector3();
  function clearTracks() { tN = 0; tracks.count = 0; lastT.clear(); }
  function addTrack(id, x, y, pal) {
    const l = lastT.get(id);
    if (!l) { lastT.set(id, { x, y }); return; }
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < 0.06) return;
    if (d > 1.2) { l.x = x; l.y = y; return; }
    const a = Math.atan2(x - l.x, y - l.y);
    m4.compose(pos3.set((x + l.x) / 2, 0.0025, -(y + l.y) / 2), tmpQ.setFromEuler(eul.set(0, a, 0)), sc3.set(pal ? 0.035 : 0.06, 1, d * 1.3));
    tracks.setMatrixAt(tN % MAXT, m4); tN++; tracks.count = Math.min(MAXT, tN); tracks.instanceMatrix.needsUpdate = true;
    l.x = x; l.y = y;
  }

  // ------------------------------------------------------------ dust, shell grit, ripples
  const MAXP = 140;
  function pointsLayer(size) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXP * 4), 4));
    const mat = new THREE.PointsMaterial({ size, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.45)'), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
    const p = new THREE.Points(g, mat); p.frustumCulled = false; scene.add(p); return p;
  }
  const dust = pointsLayer(0.16), grit = pointsLayer(0.035);
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.86, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xfff8e6, transparent: true, depthWrite: false, opacity: 0 })); m.visible = false; m.renderOrder = 2; scene.add(m); rings.push(m); }
  const dustCol = { shell: [0.93, 0.87, 0.76], clay: [0.75, 0.42, 0.28], lawn: [0.55, 0.62, 0.42], sand: [0.92, 0.83, 0.64] };
  function syncParts(parts) {
    const dp = dust.geometry.attributes.position.array, dc = dust.geometry.attributes.color.array;
    const gp = grit.geometry.attributes.position.array, gc = grit.geometry.attributes.color.array;
    let nd = 0, ng = 0, nr = 0;
    const base = dustCol[surfPal] ?? dustCol.shell;
    if (parts) for (const q of parts) {
      const k = q.t / q.max;
      if (q.kind === 0 && nd < MAXP) {
        const c = q.col ? q.col.split(',').map((v) => Number(v) / 255) : base;
        dp[nd * 3] = q.x; dp[nd * 3 + 1] = q.z + 0.03; dp[nd * 3 + 2] = -q.y;
        dc[nd * 4] = c[0]; dc[nd * 4 + 1] = c[1]; dc[nd * 4 + 2] = c[2]; dc[nd * 4 + 3] = (1 - k) * 0.5 * (q.a ?? 1); nd++;
      } else if (q.kind === 1 && ng < MAXP) {   // a knock: chips of shell kicked up, not sparks
        gp[ng * 3] = q.x; gp[ng * 3 + 1] = q.z; gp[ng * 3 + 2] = -q.y;
        gc[ng * 4] = base[0] * 1.05; gc[ng * 4 + 1] = base[1] * 1.05; gc[ng * 4 + 2] = base[2] * 1.02; gc[ng * 4 + 3] = 1 - k * k; ng++;
      } else if (q.kind === 2 && nr < rings.length) {
        const m = rings[nr++], rr = 0.15 + k * 0.9; m.visible = true; m.position.set(q.x, 0.006, -q.y); m.scale.set(rr, 1, rr); m.material.opacity = (1 - k) * 0.55;
      }
    }
    for (let i = nr; i < rings.length; i++) rings[i].visible = false;
    dust.geometry.attributes.position.needsUpdate = dust.geometry.attributes.color.needsUpdate = true;
    grit.geometry.attributes.position.needsUpdate = grit.geometry.attributes.color.needsUpdate = true;
    dust.geometry.setDrawRange(0, nd); grit.geometry.setDrawRange(0, ng);
  }

  // ------------------------------------------------------------ camera
  let W = 0, H = 0, dprNow = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  const T4 = new THREE.Matrix4();
  function setPose(p, L, zoom = 1, cxv = 0, cyv = 0, tx = 0, ty = 0) {
    const f = p.f;
    camera.position.set(p.eye[0], p.eye[2], -p.eye[1]);
    camera.up.set(0, 1, 0);
    camera.lookAt(p.eye[0] + f[0], p.eye[2] + f[2], -(p.eye[1] + f[1]));
    camera.updateMatrixWorld(true);
    const n = 0.1, fa = 400, Wv = L.w, Hv = L.h, k = p.k;
    camera.projectionMatrix.set(
      (2 * k) / Wv, 0, -(2 * p.ox / Wv - 1), 0,
      0, (2 * k) / Hv, -(1 - 2 * p.oy / Hv), 0,
      0, 0, -(fa + n) / (fa - n), -(2 * fa * n) / (fa - n),
      0, 0, -1, 0,
    );
    // the 2D follow zoom (scale about a screen point) and the hit shake (translate), as a clip-space transform
    if (zoom !== 1 || tx || ty) {
      const cx = (2 * cxv) / Wv - 1, cy = 1 - (2 * cyv) / Hv;
      T4.set(zoom, 0, 0, (1 - zoom) * cx + (2 * tx) / Wv, 0, zoom, 0, (1 - zoom) * cy - (2 * ty) / Hv, 0, 0, 1, 0, 0, 0, 0, 1);
      camera.projectionMatrix.premultiply(T4);
    }
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  // menus: low over the far end, the balls of the attract game in the gap the menu leaves, drifting slowly
  function heroFor(state, L, t) {
    const dr = Math.sin(t * 0.11) * 0.55, lift = Math.sin(t * 0.07 + 1) * 0.08;
    const title = state.scene === 'title';
    let H0 = v3.hero; v3.hero = null;
    if (title && !H0 && !L.wide) H0 = { x: L.w / 2, y: L.h * 0.3, r: 34 };   // compact title (no emblem row): the balls sit behind the subtitle
    if (title && H0 && H0.r > 4) {
      // frame the attract game's balls where the title emblem sits, at the emblem's ball size, from a low front angle
      const k = (L.h / 2) / Math.tan((34 * Math.PI) / 360), dist = clamp((k * R_B) / (H0.r * 1.15), 2.6, 16);
      const yaw = Math.sin(t * 0.1) * 0.16 + 0.12, pitch = 0.3 + Math.sin(t * 0.07 + 1) * 0.03, an = [0.08, 12.45, 0.06];
      const eye = [an[0] - Math.sin(yaw) * dist * Math.cos(pitch), an[1] - Math.cos(yaw) * dist * Math.cos(pitch), an[2] + dist * Math.sin(pitch)];
      return heroPose(eye, [an[0], an[1] + 1.5, an[2] - 0.2], 34, L, an, H0.x, H0.y);
    }
    if (L.wide) {
      const ax = title ? L.w * 0.27 : L.w * 0.5, ay = title ? L.h * 0.8 : L.h * 0.62;
      return heroPose([2.6 + dr, 8.4, 1.35 + lift], [-0.2, 12.9, 0.05], 38, L, [0.05, 12.4, 0.05], ax, ay);
    }
    const ay = title ? L.h * 0.36 : L.h * 0.42;
    return heroPose([0.9 + dr, 7.2, 1.55 + lift], [0, 12.8, 0.1], 40, L, [0.05, 12.4, 0.05], L.w * 0.5, ay);
  }

  // ------------------------------------------------------------ quality
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }

  // ------------------------------------------------------------ one frame
  let clock = 0, lastNow = performance.now(), ema = 16, frames = 0, slow = 0, lost = false, first = true, force = null;
  const shTgt = new THREE.Vector3();
  function frame(state, view) {
    if (lost || !state) return;
    resize();
    const L = layoutFor(view?.width ?? 720, view?.height ?? 1280);
    const now = performance.now(), raw = Math.max(0, (now - lastNow) / 1000), dt = Math.min(0.1, raw); lastNow = now;
    ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
    if (frames > 90 && ema > 32 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
    if (raw > 0.3 && frames > 2 && tier < TIERS.length - 1 && ++slow >= 2) { tier = TIERS.length - 1; applyTier(); frames = 0; slow = 0; }
    const play = state.scene === 'play' && state.m && state.w;
    const pauseT = play && state.paused ? 0 : dt;
    clock += pauseT;
    const world = play || state.scene === 'result' ? state.w : state.att && state.att.w;
    const parts = play ? state.parts : state.scene === 'result' ? [] : state.att && state.att.parts;
    const pal = world && world.surf ? world.surf.pal : 'shell';
    if (pal !== surfPal) { surfPal = pal; garden.setSurface(pal); }
    if (play) { const k2 = `${state.m.frame}`; if (k2 !== trackKey) { clearTracks(); trackKey = k2; } }
    syncBalls(world, pauseT);
    syncReady(state, pauseT);
    syncParts(parts);
    // garden life: lemon trees sway, the string lights breathe
    const hideNear = !!(play && L.cam.side && !force);
    for (const s of garden.sway) s.pose(clock, hideNear);

    // camera
    let pose, zoom = 1, zx = 0, zy = 0, tx = 0, ty = 0, sh;
    if (force) { pose = heroPose(force.eye, force.tgt, force.fov ?? 30, L, force.anchor ?? force.tgt, L.w / 2, L.h / 2); sh = force.sh ?? { cx: force.tgt[0], cy: force.tgt[1], ext: 2.5 }; }
    else if (play) {
      const c = L.cam;
      pose = { eye: c.eye, f: c.fwd, k: c.k, ox: c.ox, oy: c.oy };
      const Z = state.zoom; if (Z && Z.z > 1.001) { zoom = Z.z; zx = Z.ax; zy = Z.ay; }
      if (state.shake) { const a = state.shake.amp * (1 - state.shake.t / state.shake.dur); tx = Math.sin(state.shake.t * 90) * a; ty = Math.cos(state.shake.t * 77) * a * 0.6; }
      sh = { cx: 0, cy: COURT.L * 0.55, ext: 11.5 };
    } else { pose = heroFor(state, L, clock); sh = { cx: 0, cy: 12.2, ext: 5 }; }
    garden.near.visible = !hideNear;
    setPose(pose, L, zoom, zx, zy, tx, ty);
    // the sun: low and warm, shadows fitted to what the camera sees
    shTgt.set(sh.cx, 0, -sh.cy);
    key.target.position.copy(shTgt); key.position.copy(shTgt).addScaledVector(force && force.sun ? new THREE.Vector3(...force.sun).normalize() : SUN_DIR, 30); key.target.updateMatrixWorld();
    Object.assign(key.shadow.camera, { left: -sh.ext, right: sh.ext, top: sh.ext, bottom: -sh.ext, near: 5, far: 60 }); key.shadow.camera.updateProjectionMatrix();
    for (const g of garden.glows) g.pose(clock, camera.position);
    fill.position.set(camera.position.x, camera.position.y + 3, camera.position.z);
    renderer.render(scene, camera);
    if (first) { first = false; window.__first3d = window.__first3d || performance.now(); canvas.style.opacity = '1'; }
    if (v3.on && v3.mix < 1) v3.mix = Math.min(1, v3.mix + Math.max(dt, 1 / 60) / 0.45);
  }

  // ------------------------------------------------------------ context loss
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.mix = 0; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch { /* still playable without reflections */ }
    lost = false; W = 0; first = true; v3.on = true; v3.mix = 0;
  });

  try {
    await nap(); buildEnv(); applyTier();
    // make the ball materials and compile every shader before the first visible frame, one slice each
    for (const pal of [TEAM[0], TEAM[1], PALLINO_PAL]) { await nap(); ballMaterial(pal, pal === PALLINO_PAL ? 7 : 11, pal === PALLINO_PAL); }
    await nap();
    const warm = [makeEntry({ id: 1, k: false, team: 0, r: R_B, x: 0, y: 12 }), makeEntry({ id: 2, k: false, team: 1, r: R_B, x: 0, y: 12 }), makeEntry({ id: 0, k: true, team: 0, r: R_P, x: 0, y: 12 })];
    camera.position.set(0, 3, 6); camera.lookAt(0, 0, -9); camera.updateMatrixWorld(true);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    for (const e of warm) { scene.remove(e.mesh, e.blob); e.blob.material.dispose(); }
    await nap();
  } catch (e) { console.warn('3D init failed; 2D court kept', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  v3.on = true; v3.mix = 0;

  return {
    ok: true, renderer, scene, camera, THREE, garden, frame,
    get tier() { return tier; },
    setTier(t) { tier = clamp(t, 0, TIERS.length - 1); applyTier(); },
    force(f) { force = f; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) { ext.loseContext(); setTimeout(() => ext.restoreContext(), 600); } return !!ext; },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tier: TIERS[tier].name, mix: v3.mix, on: v3.on }),
  };
}
