// Kegeln 3D presenter. READS what the screens publish (v3.want) and never touches the game state. One WebGL canvas sits behind the kit's transparent 2D
// canvas: a German inn's skittle alley (honey-maple lane, ivory pins with red necks, a rosewood ball, plaster and timber walls, iron lanterns, a green felt
// scoreboard). The camera is fixed for a given screen layout (the playing surface never moves, as before); v3.project() projects lane points through it so
// the 2D overlays (aim path, target ring, dust) sit on the lane, and v3.map.to() maps a pointer through it back onto the lane so the 2D input code keeps
// working unchanged. No WebGL, ?flat=1 or a lost context: v3.on = false and the flat 2D art draws exactly as before.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/layout.js';
import { PIN_Z0, PIN_POS, BALL_R, BACK_Z, KING } from '../src/phys.js';
import { buildAlley, makePin, makeBall, blob, softDot, clearCaches, PIN_K } from './world.js';

const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 1024, lights: 4 }, { name: 'medium', dpr: 1.5, shadow: 512, lights: 3 }, { name: 'low', dpr: 1, shadow: 0, lights: 2 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const LAMP_I = 12;
const T3 = (x, y, z, out) => out.set(x, y, -z);      // lane metres -> THREE space

export async function createPresenter({ kitCanvas }) {
  const noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene and light: lantern light in a wooden room
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0705); scene.fog = new THREE.Fog(0x0b0705, 40, 95);
  const camera = new THREE.PerspectiveCamera(22, 1, 1, 160);
  const hemi = new THREE.HemisphereLight(0xffd7a0, 0x2a1a10, 0.32);
  const lamps = [];
  for (let i = 0; i < 4; i++) { const L = new THREE.PointLight(0xffb468, LAMP_I, 0, 2); L.position.set(i % 2 ? 1.2 : -1.2, 2.3, -(3 + i * 5.2)); scene.add(L); lamps.push(L); }
  const key = new THREE.SpotLight(0xffd9a0, 90, 0, 0.62, 0.6, 1.6);
  key.position.set(1.5, 3.0, -(PIN_Z0 - 1.6)); key.target.position.set(0, 0, -(PIN_Z0 + 0.6));
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; key.shadow.camera.near = 1; key.shadow.camera.far = 9;
  scene.add(hemi, key, key.target);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---------------------------------------------------------------- the alley, pins, ball
  const alley = buildAlley(); scene.add(alley);
  await tick();
  const halos = []; alley.traverse((o) => { if (o.isSprite) halos.push(o); });
  const pins = PIN_POS.map((p, i) => {
    const g = makePin(i === KING); g.traverse((o) => { if (o.material) o.material = o.material.clone(); });
    const mats = []; g.traverse((o) => { if (o.material) mats.push(o.material); });
    g.userData.mats = mats; scene.add(g);
    const sh = blob(0.34, 0.34, 0.5); scene.add(sh); g.userData.sh = sh; return g;
  });
  const ball = makeBall(), ballM = ball.mesh; scene.add(ballM);
  const ballSh = blob(0.34, 0.34, 0.65); scene.add(ballSh);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: softDot('255,214,130'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.012; glow.renderOrder = 3; scene.add(glow);
  // dust motes drifting in the lantern light
  const DN = 120, dpos = new Float32Array(DN * 3), dseed = Array.from({ length: DN }, (_, i) => (i * 7.31) % 100);
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: softDot('255,226,170'), size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b0 }));
  dust.frustumCulled = false; scene.add(dust);
  const updateDust = (t) => {
    for (let i = 0; i < DN; i++) { const sd = dseed[i]; dpos[i * 3] = -1.6 + ((sd * 37.1) % 3.2) + Math.sin(t * 0.25 + sd) * 0.15; dpos[i * 3 + 1] = 0.3 + ((t * 0.02 + sd * 0.137) % 1) * 2.6; dpos[i * 3 + 2] = -(((sd * 53.7) % 23) + Math.cos(t * 0.2 + sd * 2) * 0.2); }
    dgeo.attributes.position.needsUpdate = true;
  };
  await tick();

  let vk = '';
  function applyTier() {
    const t = TIERS[tier], on = t.shadow > 0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = on; key.castShadow = on;
    if (on) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    lamps.forEach((l, i) => { l.visible = i < t.lights; });
    pins.forEach((p) => p.traverse((o) => { if (o.isMesh) o.castShadow = on; }));
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    v3.dpr = Math.min(window.devicePixelRatio || 1, t.dpr); vk = '';
  }
  applyTier();
  await tick();

  // ---------------------------------------------------------------- camera: pitch / fov per screen; distance + off-axis shift fitted to a screen rectangle
  const cur = { yaw: 0, tilt: 10, fov: 22, dist: 40, ox: 0, oy: 0 };
  let snapNext = true, lastKind = '';
  const TARGET = new THREE.Vector3(0, 0.3, -9);
  const _v = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; cam.position.copy(TARGET).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(TARGET);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out) => { T3(x, y, z, _v).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  // Pose the camera so lane point A (z = az) lands at screen fraction fa of the rectangle and the pin deck at fp; try pitches from steep to shallow and
  // take the steepest one that still leaves the pins at least minPx css px per metre.
  function fit(rc, base, { az, fa, fp, minPx, tilts }) {
    const A = [0, 0.1, az], P = [0, 0.2, PIN_Z0 + 0.4], q = { x: 0, y: 0 }, q2 = { x: 0, y: 0 }; let best = null;
    for (const tilt of tilts) {
      const p = { ...base, tilt, ox: 0, oy: 0, dist: 40 };
      let lo = 6, hi = 140;
      for (let it = 0; it < 22; it++) {
        p.dist = (lo + hi) / 2; place(fitCam, p);
        const sep = toCss(fitCam, ...A, q).y - toCss(fitCam, ...P, q2).y;
        if (sep > (fa - fp) * rc.h) lo = p.dist; else hi = p.dist;
      }
      place(fitCam, p);
      toCss(fitCam, 0.5, 0.2, PIN_Z0 + 0.4, q); toCss(fitCam, -0.5, 0.2, PIN_Z0 + 0.4, q2);
      best = { ...p, px: Math.abs(q.x - q2.x) };
      if (best.px >= minPx) break;
    }
    place(fitCam, best);
    toCss(fitCam, ...P, q);
    best.ox = q.x - (rc.x + rc.w / 2); best.oy = q.y - (rc.y + fp * rc.h);
    return best;
  }

  // lane <-> screen
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
  v3.project = (x, y, z) => {
    const q = toCss(camera, x, y, z, { x: 0, y: 0 }), r = toCss(camera, x + 0.5, y, z, { x: 0, y: 0 }), l = toCss(camera, x - 0.5, y, z, { x: 0, y: 0 }), k = 1 / cpu();
    return { x: (q.x - offX()) * k, y: (q.y - offY()) * k, s: Math.abs(r.x - l.x) * k };
  };
  v3.map.to = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, -(((vy * cpu() + offY()) / cssH()) * 2 - 1)); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(floor, hit)) return { x: 0, z: BACK_Z, inside: false };
    return { x: hit.x, z: -hit.z, inside: true };
  };

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, lastPost = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false, cw = null;
  const _a = new THREE.Vector3();
  function poseSet(w) {
    for (const p of w.pins) {
      const m = pins[p.id], fx = w.pinFx && w.pinFx[p.id] || null;
      if (!m) continue;
      if (p.st < 0) { m.visible = false; m.userData.sh.visible = false; continue; }
      const th = p.st === 0 ? (p.wob || 0) * Math.sin(p.ph || 0) : p.th, sinT = Math.sin(th), dx = p.dx || 0, dz = p.dz || 1;
      const offFoot = p.st === 0 ? 0 : 0.19 * PIN_K * Math.sin(p.th), lift = fx ? fx.lift : 0, alpha = fx ? fx.alpha : 1;
      m.visible = alpha > 0.02;
      m.position.set(p.x - dx * offFoot, (p.st === 0 ? 0 : PIN_K * 0.062 * sinT) + lift, -(p.z - dz * offFoot));
      _a.set(-dz, 0, -dx).normalize();       // lean axis = up x lean direction, where the lean direction (dx, dz) is (dx, 0, -dz) in THREE space
      m.quaternion.setFromAxisAngle(_a, th);
      for (const mt of m.userData.mats) { const tr = alpha < 0.98; if (mt.transparent !== tr) { mt.transparent = tr; mt.needsUpdate = true; } mt.opacity = alpha; }
      const sh = m.userData.sh; sh.visible = m.visible && lift < 0.05;
      sh.position.set(p.x, 0.014, -p.z);
      if (p.st === 0) { sh.rotation.z = 0; sh.scale.set(0.5, 0.5, 1); sh.material.opacity = 0.4 * alpha; }
      else { sh.rotation.z = Math.atan2(-dx, dz); sh.scale.set(0.55, 0.5 + 1.4 * (0.2 + 0.32 * Math.sin(p.th)), 1); sh.material.opacity = 0.42 * alpha; }
    }
    const b = w.ball;
    if (b && b.on !== false) {
      const o = w.ballOpts || {}, lift = o.lift || 0;
      ballM.visible = true; ballM.position.set(b.x, BALL_R + 0.002 + lift, -b.z); ballM.rotation.set(-b.z / BALL_R, 0, -b.x / BALL_R);
      ballSh.visible = true; ballSh.position.set(b.x, 0.012, -b.z); ballSh.scale.setScalar(0.65 * (1 - lift * 0.8));
      glow.visible = !!o.glow; if (o.glow) { glow.position.set(b.x, 0.014, -b.z); glow.material.opacity = clamp(o.glow * 2.2, 0, 0.9); }
    } else { ballM.visible = false; ballSh.visible = false; glow.visible = false; }
  }

  // Called by the 2D screens (via v3.prepare) before they project anything: places the camera for this frame and poses the pins and ball.
  function setWant(want) {
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    if (dt > 0) { lastNow = now; clock += dt; }
    cw = want;
    if (want.kind !== lastKind) { snapNext = true; lastKind = want.kind; }
    const rc = rectCss(want.rect), hero = want.kind === 'hero';
    const goal = hero
      ? fit(rc, { yaw: 3.5 * Math.sin(clock * 6.2832 / 40), fov: 26 }, { az: 9, fa: 0.97, fp: 0.36, minPx: 0.5 * rc.w, tilts: [9, 7.5, 6, 5] })
      : fit(rc, { yaw: 0, fov: 22 }, { az: 0.1, fa: 0.93, fp: 0.22, minPx: 0.25 * rc.w, tilts: [16, 14, 12, 10, 8, 6.5] });
    const a = snapNext || !hero ? 1 : 1 - Math.exp(-dt * 4);
    for (const k of Object.keys(cur)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
    poseSet(want);
  }
  v3.prepare = (want) => { if (attached && !lost) setWant(want); };

  const renderInset = (iv) => {
    const rc = rectCss(iv.rect), W = cssW(), H = cssH();
    const cam2 = new THREE.PerspectiveCamera(34, rc.w / rc.h, 0.2, 60);
    cam2.position.set(0, 1.55, -(PIN_Z0 - 1.55)); cam2.lookAt(0, 0.1, -(PIN_Z0 + 0.45)); cam2.updateMatrixWorld(true);
    poseSet({ pins: iv.pins, ball: iv.ball && iv.ball.on ? iv.ball : null, pinFx: null, ballOpts: null });
    renderer.setScissorTest(true); renderer.setViewport(rc.x, H - rc.y - rc.h, rc.w, rc.h); renderer.setScissor(rc.x, H - rc.y - rc.h, rc.w, rc.h);
    renderer.clearDepth(); renderer.render(scene, cam2);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  };

  function post() {
    if (!attached || lost) return;
    const want = v3.want;
    if (!want || cw !== want) { canvas.style.visibility = 'hidden'; return; }
    const now = performance.now(), ft = lastPost ? now - lastPost : 16; lastPost = now;
    canvas.style.visibility = 'visible';
    // lantern flicker and halo breathing
    lamps.forEach((l, i) => { l.intensity = LAMP_I * (1 + 0.05 * Math.sin(clock * (5 + i * 1.7) + i) + 0.03 * Math.sin(clock * 13 + i * 3)); });
    halos.forEach((h, i) => { h.material.opacity = 0.8 + 0.12 * Math.sin(clock * (4 + (i % 4)) + i * 1.3); });
    dust.visible = want.kind === 'hero' || tier === 0; if (dust.visible) updateDust(clock);
    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + Math.min(ft, 50) / 1000 / 0.45); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    if (want.inset) renderInset(want.inset);
    frameAvg = frameAvg * 0.95 + Math.min(ft, 200) * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.map.active = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clearCaches(); applyTier();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.needsUpdate = true; if (m.bumpMap) m.bumpMap.needsUpdate = true; }); });
    fadeIn = 0; v3.fade = 0; v3.on = true; snapNext = true;
  });

  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene,
    attach() { attached = true; v3.on = true; v3.fade = 0; fadeIn = 0; snapNext = true; },
    post,
    setTier(n) { tier = clamp(n | 0, 0, 2); applyTier(); },
    get tier() { return TIERS[tier].name; },
    get camera() { return camera; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    restoreContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.restoreContext(); return ext; },
  };
}
