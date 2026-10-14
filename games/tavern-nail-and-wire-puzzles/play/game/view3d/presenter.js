// Tavern Nail and Wire Puzzles: 3D presenter. READS what the flat UI layer hands over (v3.req: the wire scene + its rectangle), never the sim.
// One WebGL canvas sits behind the transparent kit canvas. The camera reproduces the flat renderer's orbit camera exactly (same fit, same
// zoom), so picking, the axis gizmo and the hint arrows keep working. No WebGL / context lost -> v3.on = false and the flat art draws.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { setup } from '../src/scene.js';
import { ROT } from '../src/wire.js';
import { buildBar, buildPiece, metalMat, pulseSel, clamp, hash } from './models.js';
import { createHands } from './hands.js';

const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const SGN = [-1, -1, 1];   // lattice right-handed turn about x, y, z -> three.js angle sign (z is mirrored)

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0a0502, 1);
  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0603, 30, 120);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  camera.matrixAutoUpdate = false;
  const bar = buildBar(); scene.add(bar);
  const { props, cs, tank } = bar.userData;
  const wireRoot = new THREE.Group(); scene.add(wireRoot);

  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x1a0e06, 0.32);
  const key = new THREE.DirectionalLight(0xffd9a0, 2.0);
  const rim = new THREE.DirectionalLight(0x8fb0ff, 0.5); rim.position.set(6, 5, -9);
  key.castShadow = true; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  scene.add(hemi, key, key.target, rim);

  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pm.dispose(); scene.environment = t; scene.environmentIntensity = 0.55;
  }

  // ---- the zone cage (the frame's footprint): thin emissive rods + a faint amber pool on the oak
  const zone = new THREE.Group(); scene.add(zone);
  const zoneMat = new THREE.MeshBasicMaterial({ color: 0xf1c15a, transparent: true, opacity: 0.8, fog: false });
  const edges = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), zoneMat); zone.add(m); edges.push(m); }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf1c15a, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pool.rotation.x = -Math.PI / 2; zone.add(pool);

  // ---- sparks (win, bump)
  const NS = 60, sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NS);
  sparks.frustumCulled = false; scene.add(sparks);
  const parts = []; const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const burst = (x, y, z, n, up = 2.2) => { for (let i = 0; i < n; i++) { const a = hash(i, parts.length, 3) * Math.PI * 2, sp = 0.8 + hash(i, 5) * 2.2; parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up * (0.5 + hash(i, 7)), vz: Math.sin(a) * sp, life: 0, max: 0.7 + hash(i, 9) * 0.6 }); } if (parts.length > NS) parts.splice(0, parts.length - NS); };
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max) parts.splice(i, 1); }
    for (let i = 0; i < NS; i++) { const p = parts[i]; if (!p) _m.makeScale(0, 0, 0); else { _p.set(p.x, p.y, p.z); _s.setScalar(0.6 + (1 - p.life / p.max)); _m.compose(_p, _q, _s); } sparks.setMatrixAt(i, _m); }
    sparks.instanceMatrix.needsUpdate = true;
  }

  // the hand lives in its own scene (own lights, no shadows) so a clipping plane can cut the arm without touching the wire
  const handScene = new THREE.Scene();
  const hKey = new THREE.DirectionalLight(0xffd9a0, 2.2), hFill = new THREE.HemisphereLight(0xffd9a8, 0x2a1608, 0.9);
  handScene.add(hKey, hKey.target, hFill);
  // ---- the hand (loads in the background; the game plays fine without it)
  let hands = null;
  if (!qs.has('nohand')) createHands(handScene).then((h) => { hands = h; }).catch((e) => console.warn('hand unavailable', e));
  const pivotV = new THREE.Vector3();

  // ---- pieces
  const slots = [];   // per scene piece: { group, key }
  const blob = new THREE.TextureLoader ? null : null; void blob;
  function ensurePiece(i, pc) {
    const anim = pc.anim && pc.anim.e < 1 ? pc.anim : null;
    const o = anim && anim.kind === 't' ? anim.from.o : pc.pose.o;
    const key = `${pc.metal}|${pc.sel ? 1 : 0}|${o}|${pc.kind || ''}|${pc.def ? 1 : 0}`;
    let s = slots[i];
    if (!s || s.key !== key || s.def !== pc.def) {
      if (s) wireRoot.remove(s.group);
      const g = new THREE.Group();
      g.add(buildPiece(pc.def, ROT[o], pc.kind, pc.metal, pc.sel ? 1 : 0));
      wireRoot.add(g);
      s = slots[i] = { group: g, key, def: pc.def, was: 0 };
    }
    return s;
  }

  // ---- camera from the flat renderer's orbit camera
  let W = 1, H = 1, dprNow = 1;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  const _mat = new THREE.Matrix4();
  function placeCamera(P, Lw, Lh) {
    // world->camera rows (see the derivation in STATUS.md): lattice (x,y,z) = three (X,Y,-Z)
    const { cyaw, syaw, cp, sp, D } = P, cx = P.c[0], cy = P.c[1], Zc = -P.c[2];
    const r0 = [cyaw, 0, -syaw], r1 = [-syaw * sp, cp, -cyaw * sp], r2 = [syaw * cp, sp, cyaw * cp];   // x1, y2, -z2
    const t = (r) => -(r[0] * cx + r[1] * cy + r[2] * Zc);
    _mat.set(r0[0], r0[1], r0[2], t(r0), r1[0], r1[1], r1[2], t(r1), r2[0], r2[1], r2[2], t(r2) - D, 0, 0, 0, 1);
    camera.matrixWorld.copy(_mat).invert();
    camera.matrix.copy(camera.matrixWorld); camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
    camera.matrixWorldNeedsUpdate = false; camera.matrixWorldInverse.copy(_mat);
    const n = 1, f = 400, m = camera.projectionMatrix;
    m.set(2 * P.f / Lw, 0, 1 - 2 * P.cx / Lw, 0, 0, 2 * P.f / Lh, 2 * P.cy / Lh - 1, 0, 0, 0, (f + n) / (n - f), (2 * f * n) / (n - f), 0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(m).invert();
  }

  let lookNow = '', clock = 0, lastT = 0, frames = 0, ema = 16, prevWin = 0;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  function present(Lw, Lh, dt) {
    resize();
    const req = v3.req;
    const sc = req ? req.sc : null;
    const view = sc ? sc.view : { c: [0, 0, 0], r: 6, matY: -3.2, zone: null };
    const cam = sc ? sc.cam : { yaw: 0.6 + Math.sin(clock * 0.12) * 0.15, pitch: 0.62, zoom: 1 };
    const rect = req ? req.rect : { x: 0, y: Lh * 0.1, w: Lw, h: Lw };
    const P = setup(cam, rect, view);
    placeCamera(P, Lw, Lh);
    if (lookNow !== v3.look) {   // the three looks: taproom oak, slate flagstone, chalk (pale scrubbed boards)
      lookNow = v3.look;
      const L = { taproom: [0x9c8672, 0.95, 0x0b0603], slate: [0x7f93b4, 0.9, 0x070a12], chalk: [0xe9dcc2, 1.15, 0x2a2118] }[lookNow] ?? [0x9c8672, 0.95, 0x0b0603];
      bar.userData.floor.material.color.setHex(L[0]); renderer.toneMappingExposure = L[1]; scene.fog.color.setHex(L[2]); renderer.setClearColor(L[2], 1);
    }
    const c = view.c, r = view.r, matY = view.matY, Zc = -c[2];
    // bar-top follows the mat height and the orbit centre (the oak is large and tiles under the view)
    bar.position.set(c[0], matY, Zc);
    bar.userData.dots.visible = !sc || sc.opts?.grid !== false;
    // props at the edges of the field, real size (1 lattice unit ~ 2.4 cm)
    const place = (obj, dx, dz, rot = 0) => { obj.position.set(c[0] - c[0] + dx, 0, dz); obj.rotation.y = rot; };
    place(tank, -Math.max(r * 1.6, 9.5), Math.max(r * 0.2, 1.5), 0.7);
    place(cs, Math.max(r * 0.85, 6), -Math.max(r * 1.7, 11));
    let ni = 0, ci = 0;
    const fig = !!(sc && sc.opts && sc.opts.hideGrip);
    for (const o of props.children) { const sl = o.userData.slot; if (sl && /^[NC]/.test(sl)) o.visible = !fig; }
    for (const o of props.children) {
      const s = o.userData.slot;
      if (s && s[0] === 'N') { const k = ni++; o.position.set(r * (0.7 + k * 0.28), 0.2, r * (1.3 + k * 0.1)); o.rotation.y = 0.5 + k * 1.9; o.position.x += Math.max(0, 3 - r) * 0; }
      if (s && s[0] === 'C') { const k = ci++; o.position.set(-r * 1.1 + k * 0.7, 0.05 + k * 0.1, r * (1.25 + k * 0.12)); o.rotation.set(0, k, k === 2 ? 0.2 : 0); }
    }
    // candle flicker
    const fl = 0.9 + 0.1 * Math.sin(clock * 11) + 0.06 * Math.sin(clock * 23.7 + 1) + 0.04 * Math.sin(clock * 37);
    const u = cs.userData; u.flame.scale.set(1.45 * (0.95 + 0.1 * Math.sin(clock * 13)), 2.3 * fl, 1); u.glow.scale.setScalar(8.5 * (0.94 + 0.06 * fl)); u.light.intensity = 140 * fl;
    cs.updateMatrixWorld();

    // key light (shadow box follows the field)
    const ext = r * 1.7 + 3;
    key.position.set(c[0] - r * 1.1, matY + r * 2.6 + 6, Zc + r * 1.4); key.target.position.set(c[0], matY, Zc);
    Object.assign(key.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: r * 8 + 40 }); key.shadow.camera.updateProjectionMatrix();
    pulseSel(0.35 + 0.3 * (0.5 + 0.5 * Math.sin(clock * 4)));

    // pieces
    const used = sc ? sc.pieces.length : 0;
    for (let i = 0; i < slots.length; i++) if (slots[i]) slots[i].group.visible = i < used;
    if (sc) sc.pieces.forEach((pc, i) => {
      const s = ensurePiece(i, pc), g = s.group, anim = pc.anim && pc.anim.e < 1 ? pc.anim : null;
      let x = pc.pose.x, y = pc.pose.y, z = pc.pose.z;
      g.quaternion.identity();
      if (anim && anim.kind === 's') { const k = 1 - anim.e; x += (anim.from.x - x) * k; y += (anim.from.y - y) * k; z += (anim.from.z - z) * k; }
      else if (anim && anim.kind === 't') { const ang = anim.e * Math.PI / 2 * (anim.turn & 1 ? -1 : 1), ax = anim.turn >> 1; g.quaternion.setFromAxisAngle(AX[ax], SGN[ax] * ang); }
      let sh = 0; if (pc.shake) sh = Math.sin(pc.shake * 60) * 0.1 * Math.min(1, pc.shake * 5);
      g.position.set(x + sh, y, -z);
      // a little hop-and-settle at the end of a slide, and sparks on a bump
      if (pc.shake && !s.was) burst(x, y, -z, 8, 1.4);
      s.was = pc.shake || 0;
    });

    // the hand follows the selected loose piece's grip point
    if (hands) {
      let sel = null; if (sc) sc.pieces.forEach((pc) => { if (pc.sel && pc._geo) sel = pc; });
      if (sel) { const v = sel._geo.pivot; pivotV.set(v[0], v[1], -v[2]); }
      hands.update(pivotV, camera.position, !!sel && !(sc.opts?.win > 0.01), dt, 0);
    }

    // zone cage
    const zb = view.zone, win = sc?.opts?.win || 0;
    zone.visible = !!zb && !!sc && sc.opts?.grid !== false;
    if (zb && zone.visible) {
      const x0 = zb.lo[0] - 0.5, x1 = zb.hi[0] + 0.5, y0 = zb.lo[1] - 0.5, y1 = zb.hi[1] + 0.5, z0 = -(zb.hi[2] + 0.5), z1 = -(zb.lo[2] - 0.5), w = 0.045;
      const X = (a, b, y, z, i) => { const m = edges[i]; m.position.set((a + b) / 2, y, z); m.scale.set(b - a, w, w); };
      const Y = (x, a, b, z, i) => { const m = edges[i]; m.position.set(x, (a + b) / 2, z); m.scale.set(w, b - a, w); };
      const Z = (x, y, a, b, i) => { const m = edges[i]; m.position.set(x, y, (a + b) / 2); m.scale.set(w, w, b - a); };
      X(x0, x1, y0, z0, 0); X(x0, x1, y0, z1, 1); X(x0, x1, y1, z0, 2); X(x0, x1, y1, z1, 3);
      Z(x0, y0, z0, z1, 4); Z(x1, y0, z0, z1, 5); Z(x0, y1, z0, z1, 6); Z(x1, y1, z0, z1, 7);
      Y(x0, y0, y1, z0, 8); Y(x1, y0, y1, z0, 9); Y(x0, y0, y1, z1, 10); Y(x1, y0, y1, z1, 11);
      pool.position.set((x0 + x1) / 2, matY + 0.02, (z0 + z1) / 2); pool.scale.set(x1 - x0, z1 - z0, 1);
      const good = win > 0.01; zoneMat.color.set(good ? 0x8fdc9f : 0xf1c15a); zoneMat.opacity = good ? 0.95 : 0.55 + 0.15 * Math.sin(clock * 2);
      pool.material.color.set(good ? 0x8fdc9f : 0xf1c15a);
      zone.position.y = 0;
      if (win > 0 && prevWin === 0) burst((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 40, 3.2);
    }
    prevWin = win;
    stepParts(dt);

    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
    if (hands && hands.root.visible) {
      handScene.environment = scene.environment; handScene.environmentIntensity = 0.55;
      hKey.position.copy(key.position); hKey.target.position.copy(key.target.position); hKey.target.updateMatrixWorld();
      renderer.autoClear = false; renderer.clippingPlanes = hands.planes;
      renderer.render(handScene, camera);
      renderer.clippingPlanes = []; renderer.autoClear = true;
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch (err) { /* reflections only */ }
    W = 0; applyTier(); resize(); v3.on = true;
  });

  try { buildEnv(); applyTier(); resize(); } catch (e) { console.warn('3D init failed; flat fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, bar, burst, get hands() { return hands; },
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          if (!v3.on) { v3.req = null; game.render(ctx, view); return; }
          v3.req = null;
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; v3.t = clock;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          game.render(ctx, view);
          try { present(view?.width ?? 720, view?.height ?? 1560, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
