// Plate Spinning 3D presenter. READS the simulation (game.getState()) and never writes it. One WebGL canvas sits behind the kit's transparent 2D canvas:
// a lit theatre courtyard with a real 3D performer in silk, porcelain plates on bending bamboo poles, an audience, and a screen-space HUD scene (lacquer
// plaques and buttons) drawn in the same frame. No WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored ->
// back to 3D without a reload.
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { wobbleOf } from '../src/art.js';
import { urgency, TUNE } from '../src/engine.js';
import { PLATE_R, plateGeometry, plateMaterials, shardGeometry, createPole, createFoot, glowTexture, hash, TAU, THREE } from './models.js';
import { buildWorld } from './world.js';
import { createPerformer } from './performer.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TIERS = ['high', 'medium', 'low'];
const SPARK_COL = { perfect: '#fff0b0', good: '#ffc857', save: '#ff9a7a', early: '#9fc4ff' };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return touch || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) ? 'medium' : 'high';
}

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const noop = { wrap: (g) => g, ok: false };
  const qs = new URLSearchParams(globalThis.location.search);
  if (qs.has('flat')) return noop;
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return noop; }
  const { createStage, createCrowd3d } = V3;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let tier = Math.max(0, TIERS.indexOf(qs.get('tier') || quality));
  let stage;
  try { stage = createStage({ canvas, quality: TIERS[tier], dprCap: 2, lighting: 'night', mode: 'continuous', shadows: TIERS[tier] !== 'low' }); } catch (e) { canvas.remove(); return noop; }
  if (!stage.supported) { canvas.remove(); return noop; }
  const { renderer, scene, camera } = stage;
  for (const l of Object.values(stage.lights)) scene.remove(l);
  scene.remove(stage.lights.key.target);
  stage.setSky(0x0a0816, 0x1a0c1a, { near: 18, far: 52 });
  camera.near = 1; camera.far = 140;

  const P = { ok: false, lost: false };
  const world = buildWorld({ quality: TIERS[tier] });
  scene.add(world.group);
  scene.environmentIntensity = 0.5;

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- poles and plates
  const geoPlate = plateGeometry(56);
  const glow = glowTexture();
  const poles = [];
  const plateMat = {};
  const matFor = (type, i) => {
    const k = type + i;
    if (!plateMat[k]) { const m = plateMaterials(type); plateMat[k] = { sharp: m.sharp.clone(), still: m.still.clone() }; plateMat[k].sharp.map = m.sharp.map; plateMat[k].still.map = m.still.map; }
    return plateMat[k];
  };
  for (let i = 0; i < TUNE.maxPoles; i++) {
    const g = new THREE.Group(), foot = createFoot(); foot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const plateG = new THREE.Group(), spin = new THREE.Group();
    const mesh = new THREE.Mesh(geoPlate, plateMaterials('porcelain').sharp); mesh.castShadow = true; mesh.receiveShadow = true;
    const still = new THREE.Mesh(geoPlate, plateMaterials('porcelain').still);
    spin.add(mesh, still); plateG.add(spin);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffe27a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ map: glow, color: '#000', transparent: true, opacity: 0.55, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = 1;
    g.add(foot, plateG, halo, blob);
    scene.add(g);
    poles.push({ i, g, foot, plateG, spin, mesh, still, halo, blob, pole: null, height: 0, hTip: 2, x: 0, z: 0, r: PLATE_R, kx: 0, kz: 0, kvx: 0, kvz: 0, bendX: 0, bendZ: 0, type: '', fall: null, fallY0: null, tip: new THREE.Vector3() });
  }
  function ensurePole(P_, h) {
    if (P_.pole && Math.abs(P_.height - h) < 0.03) return;
    if (P_.pole) { P_.g.remove(P_.pole.mesh); P_.pole.geo.dispose(); }
    P_.pole = createPole(h); P_.g.add(P_.pole.mesh); P_.height = h;
  }

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- shards, sparks, dust
  const shardMats = {};
  const shardPool = [];
  const NSH = 56;
  const shardGeos = [];
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, w = 0.5 + hash(k) * 0.55, r0 = hash(k + 3) * 0.55, r1 = Math.min(1, r0 + 0.35 + hash(k + 8) * 0.4); shardGeos.push(shardGeometry(a, a + w, r0, r1, k)); }
  for (let i = 0; i < NSH; i++) { const m = new THREE.Mesh(shardGeos[i % shardGeos.length], plateMaterials('porcelain').sharp); m.visible = false; m.castShadow = true; scene.add(m); shardPool.push({ m, alive: false, v: new THREE.Vector3(), w: new THREE.Vector3(), age: 0, life: 3 }); }
  let shardN = 0;
  function spawnShards(pos, type, pw, n = 9) {
    const mats = plateMaterials(type);
    if (!shardMats[type]) { shardMats[type] = mats.sharp.clone(); shardMats[type].map = mats.sharp.map; shardMats[type].side = THREE.DoubleSide; }
    for (let i = 0; i < n; i++) {
      const s = shardPool[shardN++ % NSH];
      s.alive = true; s.age = 0; s.life = 2.8 + hash(shardN) * 1.2;
      s.m.material = shardMats[type]; s.m.geometry = shardGeos[(shardN * 7) % shardGeos.length];
      s.m.visible = true; s.m.scale.setScalar(PLATE_R * (0.8 + hash(shardN + 4) * 0.5));
      s.m.position.copy(pos).add(new THREE.Vector3((hash(shardN) - 0.5) * 0.08, 0.04 + hash(shardN + 1) * 0.1, (hash(shardN + 2) - 0.5) * 0.08));
      const a = hash(shardN + 5) * TAU, sp = 1.0 + hash(shardN + 6) * 2.4 * pw;
      s.v.set(Math.cos(a) * sp, 2.2 + hash(shardN + 7) * 2.6 * pw, Math.sin(a) * sp);
      s.w.set((hash(shardN + 8) - 0.5) * 22, (hash(shardN + 9) - 0.5) * 22, (hash(shardN + 10) - 0.5) * 22);
      s.m.rotation.set(hash(shardN) * 6, hash(shardN + 3) * 6, hash(shardN + 6) * 6);
    }
  }
  function stepShards(dt) {
    for (const s of shardPool) {
      if (!s.alive) continue;
      s.age += dt; s.v.y -= 9.8 * dt;
      s.m.position.addScaledVector(s.v, dt);
      if (s.m.position.y < 0.012) {
        s.m.position.y = 0.012;
        if (Math.abs(s.v.y) > 0.6) { s.v.y *= -0.32; s.v.x *= 0.62; s.v.z *= 0.62; s.w.multiplyScalar(0.6); dustAt(s.m.position, 0.7); } else { s.v.y = 0; s.v.x *= 0.9; s.v.z *= 0.9; s.w.multiplyScalar(0.88); }
      }
      s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
      if (s.age > s.life - 0.5) s.m.scale.multiplyScalar(Math.max(0.05, 1 - dt * 3));
      if (s.age >= s.life) { s.alive = false; s.m.visible = false; }
    }
  }
  const NS = 140;
  const sparkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }), NS);
  sparkMesh.frustumCulled = false; scene.add(sparkMesh);
  const sparks = []; const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  function sparkBurst(pos, n, col, speed = 1.6) {
    for (let i = 0; i < n; i++) { const a = hash(sparks.length + i * 3 + pos.x * 91) * TAU, e = hash(i + pos.y * 17) * 1.3 - 0.2; sparks.push({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * speed * (0.5 + hash(i)), vy: 0.8 + e * speed, vz: Math.sin(a) * speed * (0.5 + hash(i + 2)), age: 0, life: 0.5 + hash(i + 5) * 0.4, col }); }
    if (sparks.length > NS) sparks.splice(0, sparks.length - NS);
  }
  function stepSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.age += dt; p.vy -= 5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.age >= p.life) sparks.splice(i, 1); }
    for (let i = 0; i < NS; i++) {
      const p = sparks[i];
      if (!p) { _m4.makeScale(0, 0, 0); sparkMesh.setMatrixAt(i, _m4); continue; }
      const k = 1 - p.age / p.life; _p.set(p.x, p.y, p.z); _s.setScalar(0.35 + k * 0.8); _m4.compose(_p, _q, _s); sparkMesh.setMatrixAt(i, _m4); _c.set(p.col).multiplyScalar(0.45 + 0.4 * k); sparkMesh.setColorAt(i, _c);
    }
    sparkMesh.instanceMatrix.needsUpdate = true; if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  }
  const NDUST = 40, dustSprites = [], dust = [];
  for (let i = 0; i < NDUST; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#d8c4a0', transparent: true, depthWrite: false, opacity: 0, fog: true })); s.visible = false; scene.add(s); dustSprites.push(s); }
  function dustAt(pos, k = 1) { dust.push({ x: pos.x, y: pos.y + 0.03, z: pos.z, age: 0, life: 0.9 + hash(dust.length) * 0.4, vx: (hash(dust.length + 1) - 0.5) * 0.5, vz: (hash(dust.length + 2) - 0.5) * 0.5, s: 0.18 * k }); if (dust.length > NDUST) dust.shift(); }
  function stepDust(dt) {
    for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.age += dt; if (d.age >= d.life) dust.splice(i, 1); }
    dustSprites.forEach((s, i) => {
      const d = dust[i]; if (!d) { s.visible = false; return; }
      const u = d.age / d.life; s.visible = true; s.position.set(d.x + d.vx * d.age, d.y + u * 0.25, d.z + d.vz * d.age); s.scale.setScalar(d.s * (1 + u * 3)); s.material.opacity = 0.5 * (1 - u) * (u < 0.1 ? u / 0.1 : 1);
    });
  }

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- performer and crowd
  let perf = null, crowd = null;
  const loading = (async () => {
    try {
      perf = await createPerformer(V3, stage, { quality: TIERS[tier] });
      perf.teleport(0, 0.6); perf.setIdleYaw(0);
    } catch (e) { console.warn('performer failed', e); }
    try {
      const n = TIERS[tier] === 'low' ? 30 : TIERS[tier] === 'medium' ? 60 : 90;
      crowd = createCrowd3d(stage, {
        ring: { center: [0, 0, -3.2], radius: 6.6, rows: 3, rowGap: 0.9, count: n, arc: (qs.get('arc') || '0.58,1.42').split(',').map((v) => Number(v) * Math.PI), seated: false, face: 'in' },
        count: n, seed: 23, culture: 'east_asian', quality: TIERS[tier], cold: false,
        props: { flag: 0.0, phone: 0.0, child: 0.08 }, excitement: 0.35,
      });
    } catch (e) { console.warn('crowd3d unavailable', e && e.message); }
  })();

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- HUD plaques and lacquered buttons
  const hud = new THREE.Scene(), hudCam = new THREE.PerspectiveCamera();
  const hl1 = new THREE.DirectionalLight(0xffe9c8, 2.0); hl1.position.set(-500, 800, 1000);
  const hl2 = new THREE.DirectionalLight(0xaec4ff, 0.5); hl2.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x1a0808, 0.45), hl1, hl2);
  const syncHudEnv = () => { hud.environment = scene.environment; hud.environmentIntensity = 0.35; };
  syncHudEnv();
  function setHudProjection(Wp, Hp) { const n = 1, f = 2200, m = hudCam.projectionMatrix; m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1); hudCam.projectionMatrixInverse.copy(m).invert(); }
  const geoCache = new Map();
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = V3.board3d.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const lacq = (c, em, ei = 0.5, cc = 0.9) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.34, metalness: 0.04, clearcoat: cc, clearcoatRoughness: 0.14, envMapIntensity: 0.55, emissive: em, emissiveIntensity: ei });
  const goldM = new THREE.MeshStandardMaterial({ color: '#e8bf5c', roughness: 0.3, metalness: 0.9, envMapIntensity: 1.5 });
  const goldDim = new THREE.MeshStandardMaterial({ color: '#a8832e', roughness: 0.4, metalness: 0.85, envMapIntensity: 1.1 });
  const HM = {
    plaque: lacq('#240810', '#3a0c14', 0.4), doc: lacq('#1b0a14', '#26101c', 0.3), panel: lacq('#220914', '#340e1a', 0.35), chip: lacq('#2a0c16', '#4a1220', 0.6), banner: lacq('#3a0a14', '#7a1626', 0.7),
    primary: lacq('#c8202e', '#7a0c18', 0.7), on: lacq('#1f8a7a', '#0d4a42', 0.6), danger: lacq('#a4182e', '#5a0a18', 0.5), gold: lacq('#e0b246', '#7a5410', 0.5, 0.7),
    ghost: lacq('#2c0f19', '#3c1422', 0.45), quiet: lacq('#341420', '#4a1b2a', 0.5), disabled: lacq('#1c0f14', '#12090d', 0.15, 0.3),
  };
  const hudPanels = [], hudButtons = [];
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x07020a, transparent: true, opacity: 0, depthWrite: false })); hud.add(scrim);
  const ROT = Math.PI / 2;
  function placePanel(i, p) {
    let h = hudPanels[i];
    if (!h) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, goldM), body = new THREE.Mesh(flatQuad, HM.panel), inner = new THREE.Mesh(flatQuad, goldDim), top = new THREE.Mesh(flatQuad, HM.panel); g.add(outer, body, inner, top); hud.add(g); h = { g, outer, body, inner, top }; hudPanels.push(h); }
    const r = p.r, cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, big = p.kind !== 'chip', dep = big ? 14 : 8, ins = big ? 3.2 : 2;
    h.outer.geometry = slabG(r.w, r.h, dep, p.rad, 4); h.outer.rotation.x = ROT; h.outer.position.set(cx, cy, z);
    h.body.geometry = slabG(r.w - ins * 2, r.h - ins * 2, dep + 1.5, Math.max(3, p.rad - ins), 2.6); h.body.rotation.x = ROT; h.body.position.set(cx, cy, z); h.body.material = HM[p.kind] || HM.panel;
    const fine = big && r.w > 120 && r.h > 70;
    h.inner.visible = fine; h.top.visible = fine;
    if (fine) {
      h.inner.geometry = slabG(r.w - ins * 2 - 10, r.h - ins * 2 - 10, dep + 2.2, Math.max(2, p.rad - ins - 5), 1.2); h.inner.rotation.x = ROT; h.inner.position.set(cx, cy, z);
      h.top.geometry = slabG(r.w - ins * 2 - 14, r.h - ins * 2 - 14, dep + 3.4, Math.max(2, p.rad - ins - 7), 1.2); h.top.rotation.x = ROT; h.top.position.set(cx, cy, z); h.top.material = HM[p.kind] || HM.panel;
    }
    const sc = p.a !== undefined ? clamp(p.a * 1.4, 0, 1) : 1; h.g.scale.set(1, 1, sc || 0.001); h.g.visible = sc > 0.02;
  }
  function placeButton(i, b, pressed) {
    let h = hudButtons[i];
    if (!h) { const g = new THREE.Group(), rim = new THREE.Mesh(flatQuad, goldM), body = new THREE.Mesh(flatQuad, HM.ghost); g.add(rim, body); hud.add(g); h = { g, rim, body }; hudButtons.push(h); }
    const r = b.r, cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(b.rad || 18, r.h / 2.4), z = -400, dep = pressed ? 8 : 18;
    h.g.visible = true;
    h.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); h.rim.rotation.x = ROT; h.rim.position.set(cx, cy, z);
    h.rim.material = b.kind === 'disabled' ? goldDim : goldM;
    h.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(3, rad - 2), 6); h.body.rotation.x = ROT; h.body.position.set(cx, cy, z);
    h.body.material = HM[b.kind] || HM.ghost;
    h.g.position.set(0, pressed ? -3 : 0, 0);
  }

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- camera fit and projection
  let W = 1, H = 1, L_ = null, shakeAmt = 0, hudW = 0, hudH = 0;
  const tv = new THREE.Vector3(), orig = new THREE.Vector3(), ray = new THREE.Vector3();
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    if (w !== W || h !== H) { W = w; H = h; stage.setSize(w, h); }
  }
  const cfg = { pitch: Number(qs.get('pitch') || 16) * Math.PI / 180, dist: Number(qs.get('dist') || 14) };
  function fitCamera(anchor, K, L) {
    const vis = L.h / K;
    camera.clearViewOffset(); camera.aspect = W / H; camera.fov = (2 * Math.atan(vis / 2 / cfg.dist) * 180) / Math.PI; camera.updateProjectionMatrix();
    camera.position.set(0, Math.sin(cfg.pitch) * cfg.dist, Math.cos(cfg.pitch) * cfg.dist); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    tv.set(0, 0, 0).project(camera);
    const px0 = ((tv.x + 1) / 2) * W, py0 = ((1 - tv.y) / 2) * H, k = W / L.w;
    camera.setViewOffset(W, H, px0 - anchor.x * k, py0 - anchor.y * k, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function rayAt(vx, vy) { const nx = (vx / L_.w) * 2 - 1, ny = 1 - (vy / L_.h) * 2; orig.copy(camera.position); ray.set(nx, ny, 0.5).unproject(camera).sub(orig).normalize(); }
  function hitY(vx, vy, y, out) { rayAt(vx, vy); const t = (y - orig.y) / ray.y; return out.copy(orig).addScaledVector(ray, t); }
  function hitZ(vx, vy, z, out) { rayAt(vx, vy); const t = (z - orig.z) / ray.z; return out.copy(orig).addScaledVector(ray, t); }
  const toVirt = (p) => { tv.copy(p).project(camera); return { x: ((tv.x + 1) / 2) * L_.w, y: ((1 - tv.y) / 2) * L_.h }; };
  const ppmAt = (p) => { const a = toVirt(p); const q = p.clone(); q.x += 1; const b = toVirt(q); return Math.abs(b.x - a.x); };

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- scene state
  const hist = { seen: -1, lastCheer: -9 };
  const demo = { t: 0, pl: [], names: ['porcelain', 'lacquer', 'jade', 'gold', 'porcelain'], last: 0 };
  for (let i = 0; i < 5; i++) demo.pl.push({ type: demo.names[i], e: 0.95 - i * 0.12, ph: i, spinA: i, jolt: 0, flash: 0, charge: 0, st: 'spin', age: 9, fallT: 0 });
  const sim = { calm: false };
  const whipQ = [];                 // { pole, grade, t }
  const wp = new THREE.Vector3(), wq = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0), _axisX = new THREE.Vector3(1, 0, 0);

  function circleFor(i) {            // the wrist stirring circle for the whip in flight on pole i (shared by the pole bend and the hand target)
    const w = perf && perf.whip; if (!w || w.poleIdx !== i) return null;
    const u = w.t / w.dur, env = ss(0, 0.16, u) * (1 - ss(0.72, 1, u)), ph = w.t * TAU * 3.2, rad = 0.035 * env * (w.grade === 'perfect' ? 1.2 : 1);
    return { x: Math.cos(ph) * rad, z: Math.sin(ph) * rad * 0.8, env };
  }
  const GRIP_H = 1.15;
  function shaftPoint(i, h, out) {
    const P_ = poles[i], s = clamp(h / P_.hTip, 0, 1), b = Math.pow(Math.max(0, (s - 0.1) / 0.9), 2);
    const c = circleFor(i);
    out.set(P_.x + P_.bendX * b + (c ? c.x : 0), h, P_.z + P_.bendZ * b + (c ? c.z : 0));
    return out;
  }

  function syncPole(P_, pole, plate, dt, tNow, calm) {
    P_.g.visible = !!pole.on;
    if (!pole.on) return;
    P_.g.position.set(P_.x, 0, P_.z);
    ensurePole(P_, P_.hTip);
    const spin = plate && plate.st === 'spin';
    const aw = plate ? wobbleOf(plate.e, plate.jolt) * (calm ? 0.55 : 1) : 0;
    const th = plate ? plate.ph + 0.6 : 0;
    const k = Math.min(dt, 1 / 30);
    P_.kvx += (-P_.kx * 760 - P_.kvx * 15) * k; P_.kvz += (-P_.kz * 760 - P_.kvz * 15) * k; P_.kx += P_.kvx * k; P_.kz += P_.kvz * k;
    let tx = aw * 0.115 * Math.cos(th) + P_.kx, tz = aw * 0.095 * Math.sin(th) + P_.kz;
    if (plate && plate.st === 'fall') { const u = clamp(plate.fallT / TUNE.fallTime, 0, 1); tx *= 1 - u * 0.5; tz *= 1 - u * 0.5; }
    P_.bendX = tx; P_.bendZ = tz;
    const c = circleFor(P_.i);
    const gs = GRIP_H / P_.hTip;
    const gx = c ? c.x : 0, gz = c ? c.z : 0;
    const tip = P_.pole.update((s) => {
      const b = Math.pow(Math.max(0, (s - 0.1) / 0.9), 2), bm = c ? Math.exp(-Math.pow((s - gs) / 0.2, 2)) : 0;
      return { x: tx * b + gx * bm, z: tz * b + gz * bm, sag: (tx * tx + tz * tz) * 0.5 * s * s / Math.max(0.5, P_.hTip) };
    });
    P_.tip.copy(tip);
    if (!plate) { P_.plateG.visible = false; P_.halo.visible = false; P_.blob.visible = false; return; }
    const mats = matFor(plate.type, P_.i);
    if (P_.type !== plate.type) { P_.type = plate.type; P_.mesh.material = mats.sharp; P_.still.material = mats.still; }
    P_.plateG.visible = true;
    P_.plateG.scale.setScalar(P_.r);
    let px = tip.x, py = tip.y + 0.012, pz = tip.z, tilt = clamp(aw * 0.5 + Math.hypot(P_.kx, P_.kz) * 1.6, 0, 0.85), tph = th + 1.2, tumble = 0;
    if (plate.st === 'fall') {
      const u = clamp(plate.fallT / TUNE.fallTime, 0, 1), y0 = P_.fallY0 ?? (P_.fallY0 = tip.y), g = (2 * y0) / (TUNE.fallTime * TUNE.fallTime);
      const tt = plate.fallT;
      py = Math.max(0.03, y0 - 0.5 * g * tt * tt) + 0.01;
      const dirx = Math.cos(th + 0.4), dirz = Math.sin(th + 0.4), slide = 0.65 * ss(0, 1, u) + 0.35 * u;
      px = tip.x + dirx * slide; pz = tip.z + dirz * slide;
      tumble = u * u * 8.5; tilt = 0.5 + u * 1.2;
      P_.fall = { x: P_.x + px, z: P_.z + pz };
    } else P_.fallY0 = null;
    if (plate.age < 0.6 && spin) {     // launched: the performer sets it on the tip
      const u = 1 - Math.pow(1 - clamp(plate.age / 0.6, 0, 1), 2);
      py = 0.35 + (tip.y - 0.35) * u + Math.sin(u * Math.PI) * 0.25; tilt *= u; px = lerp(0, px, u);
    }
    P_.plateG.position.set(px, py, pz);
    const nx = Math.sin(tilt) * Math.cos(tph), ny = Math.cos(tilt), nz = Math.sin(tilt) * Math.sin(tph);
    P_.plateG.quaternion.setFromUnitVectors(_up, wq.set(nx, ny, nz).normalize());
    if (tumble) { _q.setFromAxisAngle(_axisX, tumble); P_.plateG.quaternion.multiply(_q); }
    P_.spin.rotation.y = plate.spinA;
    // spin blur: fast plates smear the painted pattern into rings; a slow plate shows its glaze pattern
    P_.still.material.opacity = clamp((plate.e - 0.45) * 1.3, 0, 0.72);
    mats.sharp.emissive.set('#fff2c8'); mats.sharp.emissiveIntensity = clamp(plate.flash, 0, 1) * 0.55;
    let gc = null, ga = 0;
    if (spin) {
      const zone = plate.e > TUNE.early ? 'fresh' : plate.e > TUNE.hi ? 'early' : plate.e >= TUNE.perfLo && plate.e <= TUNE.perfHi ? 'perfect' : plate.e >= TUNE.lo ? 'good' : 'late';
      const pulse = 0.5 + 0.5 * Math.sin(tNow * (zone === 'late' ? 14 : 8));
      if (zone === 'perfect') { gc = '#ffe27a'; ga = 0.45 + 0.3 * pulse; } else if (zone === 'good') { gc = '#ffa83a'; ga = 0.25 + 0.15 * pulse; } else if (zone === 'late') { gc = '#ff4a4a'; ga = 0.4 + 0.3 * pulse; }
    }
    P_.halo.visible = !!gc;
    if (gc) { P_.halo.material.color.set(gc); P_.halo.material.opacity = ga * 0.7; P_.halo.position.set(px, py + 0.02, pz - 0.2); P_.halo.scale.setScalar(P_.r * 4.2); }
    P_.blob.visible = true; P_.blob.position.set(px * 0.3, 0.014, pz * 0.3); P_.blob.scale.setScalar(P_.r * (plate.st === 'fall' ? 1.2 : 1.5));
    P_.blob.material.opacity = plate.st === 'fall' ? 0.5 * (1 - clamp((py - 0.1) / 2, 0, 1)) : 0.28;
  }
  function kickPole(i, amp, seed) { const P_ = poles[i], a = hash(seed * 3.1 + i) * TAU; P_.kvx += Math.cos(a) * amp; P_.kvz += Math.sin(a) * amp; }

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- performer director
  let side = 1;
  const lookS = new THREE.Vector3();
  const standFor = (i, from) => {
    const P_ = poles[i];
    const s = from < P_.x - 0.05 ? -1 : from > P_.x + 0.05 ? 1 : side;
    side = s;
    return { x: P_.x + s * 0.52, z: P_.z + 0.5, side: s };
  };
  function directPerformer(dt, show, evs, active) {
    if (!perf) return;
    perf.setMode(active ? 'ready' : 'relaxed');
    for (const e of evs) {
      if (e.k === 'whip' || e.k === 'half' || e.k === 'jolt') whipQ.push({ pole: e.pole, grade: e.k === 'jolt' ? 'jolt' : e.grade || 'good', t: 0, id: e.id || 0 });
      if (e.k === 'drop' || e.k === 'shatter') perf.react('flinch');
    }
    let goal = null;
    if (whipQ.length) {
      const w = whipQ[0], st = standFor(w.pole, perf.x);
      goal = st;
      const d = Math.hypot(perf.x - st.x, perf.z - st.z);
      w.t += dt;
      if (!perf.whip && (d < 0.45 || w.t > 0.9)) {
        perf.setIdleYaw(-st.side * 0.6); perf.idleYawWhip = -st.side * 0.6;
        perf.startWhip(st.side > 0 ? 'R' : 'L', w.grade, (t, out) => shaftPoint(w.pole, GRIP_H, out));
        perf.whip.poleIdx = w.pole;
        kickPole(w.pole, w.grade === 'jolt' ? 2.4 : w.grade === 'perfect' ? 1.0 : 1.5, w.id);
        whipQ.shift();
      } else if (!perf.whip && whipQ.length > 3) whipQ.splice(0, whipQ.length - 2);
    } else if (!perf.whip && active && show) {
      const u = urgency(show);
      if (u.length) { const st = standFor(u[0].pole, perf.x); goal = st; perf.setIdleYaw(-st.side * 0.6); perf.idleYawWhip = undefined; }
    } else if (!active) {
      const P_ = poles[2]; goal = { x: P_.x, z: P_.z + 1.5 }; perf.setIdleYaw(0);
    }
    if (goal && !perf.whip) perf.goTo(goal.x, goal.z);
    const lookPole = perf.whip ? perf.whip.poleIdx : (show ? (urgency(show)[0] || {}).pole : 2);
    if (lookPole !== undefined && poles[lookPole] && poles[lookPole].g.visible) {
      const P_ = poles[lookPole];
      // the gaze target is eased and kept within a soft cone of the body's facing, so the head turns smoothly and the spine never snaps at the limit
      const dx = P_.x + P_.bendX - perf.x, dz = P_.z + P_.bendZ - perf.z, ang = Math.atan2(dx, dz) - perf.yaw, a = Math.atan2(Math.sin(ang), Math.cos(ang));
      const c = 0.7 * Math.tanh(a / 0.7), yawT = perf.yaw + c;
      const tx = perf.x + Math.sin(yawT) * 3, tz = perf.z + Math.cos(yawT) * 3, ty = clamp(P_.tip.y, 1.2, 2.6);
      lookS.x += (tx - lookS.x) * (1 - Math.exp(-6 * dt)); lookS.y += (ty - lookS.y) * (1 - Math.exp(-6 * dt)); lookS.z += (tz - lookS.z) * (1 - Math.exp(-6 * dt));
      if (!lookS.init) { lookS.set(tx, ty, tz); lookS.init = true; }
      perf.lookAt(lookS, 0.8);
    } else perf.lookAt(null, 0);
    perf.update(dt);
  }

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- per-frame
  let clock = 0, lastT = 0, frames = 0, ema = 16;
  const dev = { fixedDt: 0 };
  const vigDiv = document.createElement('div');
  vigDiv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 52%, rgba(6,1,8,0.55) 100%)';
  canvas.after(vigDiv);

  function worldFromSlots(L) {
    const slots = L.play.slots;
    const front = slots.filter((s) => s.row === 0), s0 = front[0] || slots[0];
    const K = s0.rx / PLATE_R;
    fitCamera({ x: L.w / 2, y: s0.base }, K, L);
    for (const s of slots) {
      const P_ = poles[s.i];
      hitY(s.cx, s.base, 0, tv); const bz = tv.z;
      hitZ(s.cx, s.top, bz, tv); const tx = tv.x, ty = tv.y;
      P_.x = tx; P_.z = bz; P_.hTip = Math.max(0.8, ty - 0.012);
      wp.set(tx, ty, bz); P_.r = clamp(s.rx / ppmAt(wp), 0.08, 0.3);
    }
    return K;
  }
  function worldDemo(L) {
    const H0 = L.title.hero;                         // { x: centre, y: top, w, h }
    const K = Math.min(H0.w / 4.4, H0.h / 2.7);
    fitCamera({ x: H0.x, y: H0.y + H0.h - 6 }, K, L);
    L_ = L;
    const xs = [-1.44, -0.72, 0, 0.72, 1.44], zs = [0.1, -1.0, 0.1, -1.0, 0.1], hs = [2.1, 2.3, 2.2, 2.35, 2.05];
    for (let i = 0; i < 5; i++) { const P_ = poles[i]; P_.x = xs[i]; P_.z = zs[i]; P_.hTip = hs[i]; P_.r = PLATE_R * (zs[i] < 0 ? 0.95 : 1); }
    return K;
  }
  function stepDemo(dt) {
    demo.t += dt;
    const evs = [];
    demo.pl.forEach((pl, i) => {
      const k = [0.075, 0.095, 0.06, 0.12, 0.085][i];
      pl.e -= k * dt * (sim.calm ? 0.7 : 1); pl.age += dt; pl.flash = Math.max(0, pl.flash - dt * 4); pl.jolt = Math.max(0, pl.jolt - dt * 1.6);
      pl.ph += dt * (2.0 + (1 - Math.min(1, pl.e * 1.6)) * 7 + pl.jolt * 6); pl.spinA += dt * (4 + pl.e * 26);
      if (pl.e < 0.24) { pl.e = 1; pl.flash = 1; evs.push({ id: ++demo.last, k: 'whip', pole: i, grade: 'perfect', type: pl.type }); }
    });
    return evs;
  }

  function frame(state, L, dtRaw) {
    resize();
    L_ = L;
    const play = state.scene === 'play' && state.pl;
    const pl = play ? state.pl : null;
    const live = !!(play && !pl.over);
    const dt = pl && pl.paused ? 0 : dtRaw;
    sim.calm = !!state.prefs.calm;
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const tNow = clock;
    let evs = [];
    if (live) {
      worldFromSlots(L);
      for (const e of pl.evLog) if (e.id > hist.seen) { evs.push(e); hist.seen = e.id; }
    } else {
      worldDemo(L);
      evs = stepDemo(dt);
      if (pl && pl.evLog.length) hist.seen = pl.evLog[pl.evLog.length - 1].id;
    }
    for (let i = 0; i < TUNE.maxPoles; i++) {
      const P_ = poles[i];
      if (live) { const pole = pl.show.poles[i]; syncPole(P_, pole, pole.plate, dt, tNow, sim.calm); }
      else if (i < 5) syncPole(P_, { on: true }, demo.pl[i], dt, tNow, sim.calm);
      else P_.g.visible = false;
    }
    for (const e of evs) {
      const P_ = e.pole !== undefined ? poles[e.pole] : null;
      if (e.k === 'whip' && P_) {
        wp.set(P_.x + P_.bendX, P_.tip.y + 0.04, P_.z + P_.bendZ);
        if (!sim.calm) sparkBurst(wp, e.grade === 'perfect' ? 16 : 6, SPARK_COL[e.grade] || '#ffc857', e.grade === 'perfect' ? 1.9 : 1.2);
        if (e.grade === 'perfect' && crowd && tNow - hist.lastCheer > 1.1) { hist.lastCheer = tNow; try { crowd.react('cheer', { origin: [P_.x, 0, P_.z - 1], radius: 30, intensity: 0.5 }); } catch { /* optional */ } world.lanternFlare(0.8); }
      } else if (e.k === 'shatter' && P_ && P_.fall) {
        wp.set(P_.fall.x, 0.02, P_.fall.z); spawnShards(wp, e.type || 'porcelain', 1, 9); dustAt(wp, 1.6); dustAt(wp, 1.1);
        if (crowd) { try { crowd.react('gasp', { origin: [wp.x, 0, wp.z], radius: 30, intensity: 0.8 }); } catch { /* optional */ } }
        shakeAmt = 1;
      } else if (e.k === 'jolt' && P_) { wp.set(P_.x, P_.tip.y, P_.z); if (!sim.calm) sparkBurst(wp, 5, '#ff6b6b', 1.0); }
      else if (e.k === 'act' && crowd) { try { crowd.react('cheer', { origin: [0, 0, -2], radius: 40, intensity: 0.9 }); } catch { /* optional */ } world.lanternFlare(1); }
      else if (e.k === 'over' && crowd) { try { crowd.react('groan', { origin: [0, 0, -2], radius: 40, intensity: 0.8 }); } catch { /* optional */ } }
    }
    if (crowd) crowd.setExcitement(0.25 + (live ? clamp(pl.show.combo / 12, 0, 1) : 0.3) * 0.6);
    directPerformer(dt, live ? pl.show : null, evs, live);
    if (dev.cam) { camera.clearViewOffset(); camera.fov = dev.cam.fov || 30; camera.position.set(...dev.cam.pos); camera.lookAt(...dev.cam.look); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
    world.update(clock, sim.calm, dt);
    if (crowd && dt > 0) crowd.update(dt);
    stepShards(dt); stepSparks(dt); stepDust(dt);
    shakeAmt = Math.max(0, shakeAmt - dt * 3);
    if (live && pl.shake > 0 && !sim.calm) shakeAmt = Math.max(shakeAmt, pl.shake * 0.6);
    if (shakeAmt > 0 && !sim.calm) { const a = shakeAmt * 4; camera.setViewOffset(W, H, camera.view.offsetX + Math.sin(clock * 70) * a, camera.view.offsetY + Math.cos(clock * 83) * a * 0.8, W, H); camera.updateProjectionMatrix(); }
    stage.update(dt, { renderNow: false });
  }

  function present(L) {
    let n = 0;
    if (!dev.noHud) for (const p of v3.panels) placePanel(n++, p);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    if (!dev.noHud) for (const b of v3.buttons) { const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h && b.kind !== 'disabled'; placeButton(n++, b, pressed); }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -520);
    renderer.autoClear = true;
    stage.render();
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hud, hudCam);
    renderer.autoClear = true;
  }

  await tick();
  // ---------------------------------------------------------------------------------------------------------------- tiers, context loss
  function applyTier() {
    stage.setQuality(TIERS[tier]);
    const sz = TIERS[tier] === 'high' ? 2048 : TIERS[tier] === 'medium' ? 1024 : 0;
    world.setShadows(sz);
    renderer.shadowMap.enabled = sz > 0;
    if (crowd) { try { crowd.setQuality(TIERS[tier]); } catch { /* ignore */ } }
    W = 0;
  }
  stage.onContextLost(() => { P.lost = true; v3.on = false; });
  stage.onContextRestored(() => { P.lost = false; syncHudEnv(); scene.environmentIntensity = 0.5; W = 0; resize(); v3.on = true; });
  try { applyTier(); } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); vigDiv.remove(); v3.on = false; return noop; }
  P.ok = true; v3.on = true;

  return {
    ok: true, stage, scene, camera, renderer, poles, world, dev, demo, cfg, shaftPoint, loading, spawnShards, sparkBurst,
    get perf() { return perf; }, get crowd() { return crowd; }, get tier() { return TIERS[tier]; },
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) { const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null; return game.update(dt, input); },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
          const now = performance.now();
          let dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
          if (dev.fixedDt) dt = dev.fixedDt;
          clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 120 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          try { frame(state, L, dt); } catch (e) { console.warn('3D frame failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(L); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
