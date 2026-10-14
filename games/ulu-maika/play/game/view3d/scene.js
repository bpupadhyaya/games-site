// Ulu Maika 3D scene (game-owned): stage + village world + two players + discs + crowd + dust, driven by a per-frame hand-off from the
// game (see src/glhook.js). It only READS the sim; nothing flows back. The same scene is used by the offline icon render.
//
// Frame order (per the view3d rules): stage.update(dt) -> thrower.afterUpdate (cloth, lei, grip point) -> place held disc and props ->
// camera -> render.
import { buildWorld, DISC_T } from './world.js';
import { createThrower, LINE_Z, REL } from './people.js';
import { scopeParams } from '../src/art.js';
import { DISC_R, V_MIN, V_MAX, RING_R, FAR_R } from '../src/sim.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

export async function createScene({ canvas, quality = 'high', transparent = true, preserve = false, people = true, crowdOn = true } = {}) {
  const V3 = await import(LIB);
  const { createStage, THREE, board3d: B } = V3;
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'evening', shadows: quality !== 'low', transparent, mode: 'continuous', preserveDrawingBuffer: preserve, fov: 30 });
  if (!stage.supported) return null;
  const { scene, camera, renderer } = stage;
  camera.near = 0.2; camera.far = 260;
  const realUpdate = camera.updateProjectionMatrix.bind(camera);
  camera.updateProjectionMatrix = () => {};
  stage.setLighting('evening', { hemi: 0, keyI: 0, rimI: 0, exposure: 1.02 });
  stage.setSky(null, 0xf0c597, { near: 34, far: 150 });
  scene.background = null;
  renderer.setClearColor(0x000000, transparent ? 0 : 1);

  const world = buildWorld(V3, { quality });
  scene.add(world.root);
  // the world's own key light carries the shadow map (a small box that follows the action)
  const key = world.lights.key;
  if (renderer.shadowMap.enabled) {
    key.castShadow = true; key.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 1, far: 40 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  }
  renderer.toneMappingExposure = 1.02;
  scene.fog = new THREE.Fog(world.fogColor, 34, 150);
  scene.fog.color.set(world.fogColor);

  // ------------------------------------------------------------------ people
  const P = { A: null, B: null };
  if (people) {
    [P.A, P.B] = await Promise.all([
      createThrower(V3, stage, { character: 'athlete_m', skin: 'tan', hair: 'black', left: false, quality, accent: '#b21f26', top: '#e6d6a8', seed: 1 }),
      createThrower(V3, stage, { character: 'athlete_m', skin: 'brown', hair: 'black', left: true, quality, accent: '#1f5f8c', top: '#c7a876', seed: 2 }),
    ]);
  }
  const throwers = [P.A, P.B];
  const baseX = [-REL.x, REL.x];

  // ------------------------------------------------------------------ discs, preview dots, path trace
  const discPool = [];
  const discs = new THREE.Group(); scene.add(discs);
  const getDisc = (i, side) => {
    while (discPool.length <= i) { const m = world.makeDisc(0); m.visible = false; discs.add(m); discPool.push(m); }
    const m = discPool[i];
    const want = world.discMats[side % 2];
    if (m.material !== want) m.material = want;
    return m;
  };
  const held = world.makeDisc(0); held.visible = false; discs.add(held);
  const rollDisc = world.makeDisc(0); rollDisc.visible = false; discs.add(rollDisc);
  const blobGeo = new THREE.CircleGeometry(0.05, 16); blobGeo.rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
  const dots = new THREE.InstancedMesh(blobGeo, dotMat, 160); dots.frustumCulled = false; dots.count = 0; dots.renderOrder = 4; scene.add(dots);
  const trace = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.55, depthWrite: false }), 200); trace.frustumCulled = false; trace.count = 0; trace.renderOrder = 4; scene.add(trace);
  const endRing = B.glowRing(0.2, '#ffe9a8'); endRing.visible = false; scene.add(endRing);
  const farRing = B.glowRing(RING_R * 0.98, '#ffe07a'); farRing.material.opacity = 0.0; farRing.visible = true; scene.add(farRing);
  const gateFlash = [0, 1, 2].map(() => { const r = B.glowRing(0.55, '#7dffd6'); r.visible = false; scene.add(r); return r; });
  const rollShadow = B.contactShadow(0.12, 0.55); rollShadow.visible = false; scene.add(rollShadow);
  const glowUnder = B.glowRing(0.16, '#ffe9a8'); glowUnder.visible = false; scene.add(glowUnder);

  // dust and sparks: a pool of sprites driven by the game's particle list
  const sprTex = (() => {
    const c = world.cvs(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return world.mkTex(c);
  })();
  const sprites = [];
  for (let i = 0; i < 56; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); sprites.push(s); }

  // ------------------------------------------------------------------ crowd: villagers on lauhala mats along both sides
  let crowd = null;
  const mats = new THREE.Group(); scene.add(mats);
  if (crowdOn) {
    const CUL = V3.CULTURES;
    CUL.hawaii = {
      skin: [['tan', 4], ['brown', 4], ['olive', 2], ['fair', 1], ['dark', 0.6]], hair: [['black', 7], ['dkbrown', 4], ['grey', 0.8]],
      hats: [[0, 6], [2, 2.4]], womenHat: [[0, 7], [2, 1.2]],
      garment: [[0, 7], [1, 1]], womanGarment: [[3, 7], [0, 2]],
      top: ['#d62f2f', '#1f9aa3', '#f6e9c8', '#f2b61e', '#e0558d', '#2f6fb3', '#ffffff', '#1f8a52'], bottom: ['#1f2a44', '#e9ddc0', '#7a2a2a', '#2f5a52'],
      scarf: 0, patterns: [[0, 3], [1, 2], [2, 2]], flag: ['#c8202a', '#ffffff', '#1f4a9a'],
    };
    const pts = [];
    const r = world.lcg(12), mc = world.cvs(128, 96), mg = mc.getContext('2d');
    mg.fillStyle = '#d6b36c'; mg.fillRect(0, 0, 128, 96);
    for (let i = 0; i < 128; i += 6) { mg.fillStyle = i % 12 ? 'rgba(120,80,30,0.5)' : 'rgba(250,230,170,0.45)'; mg.fillRect(i, 0, 3, 96); }
    for (let j = 0; j < 96; j += 6) { mg.fillStyle = j % 12 ? 'rgba(120,80,30,0.35)' : 'rgba(250,230,170,0.3)'; mg.fillRect(0, j, 128, 3); }
    mg.strokeStyle = '#8a1f26'; mg.lineWidth = 5; mg.strokeRect(4, 4, 120, 88);
    const matMat = new THREE.MeshStandardMaterial({ map: world.mkTex(mc), roughness: 1 });
    const matGeo = new THREE.PlaneGeometry(1.5, 1.1); matGeo.rotateX(-Math.PI / 2);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const y = 2.4 + i * 2.15 + (r() - 0.5) * 0.6, x = side * (3.55 + (i % 2) * 0.15 + r() * 0.2);
        const m = new THREE.Mesh(matGeo, matMat); m.position.set(x, 0.014, -y); m.rotation.y = (r() - 0.5) * 0.3; m.receiveShadow = true; mats.add(m);
        const n = 2 + (r() < 0.4 ? 1 : 0);
        for (let k = 0; k < n; k++) pts.push({ x: x + (k - (n - 1) / 2) * 0.1 + (r() - 0.5) * 0.2, y: -0.34, z: -y + (k - (n - 1) / 2) * 0.45, yaw: side < 0 ? Math.PI / 2 + (r() - 0.5) * 0.4 : -Math.PI / 2 + (r() - 0.5) * 0.4, seated: true });
      }
    }
    try {
      crowd = V3.createCrowd3d(stage, { points: pts, count: pts.length, seed: 9, culture: 'hawaii', quality: quality === 'high' ? 'medium' : 'low', props: { flag: 0, phone: 0.05, child: 0.06 }, excitement: 0.25 });
    } catch (e) { console.warn('crowd3d failed', e && e.message); crowd = null; }
  }

  // ------------------------------------------------------------------ camera
  const _look = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();
  const pinhole = (f, cx, hy, w, h) => {
    const n = 0.2, fa = 260;
    camera.projectionMatrix.set(
      (2 * f) / w, 0, -(2 * cx / w - 1), 0,
      0, (2 * f) / h, -(1 - 2 * hy / h), 0,
      0, 0, -(fa + n) / (fa - n), (-2 * fa * n) / (fa - n),
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  };

  // ------------------------------------------------------------------ per-frame state
  const S = {
    stage, world, scene, camera, renderer, THREE, throwers, crowd, time: 0, ready: true, V3, B,
    rollId: null, roll: null, restSettle: null, lastEvt: 0, heading: 0, spin: 0, lastGrip: new THREE.Vector3(),
    held: new THREE.Vector3(), cur: { rect: null }, rolled: new Map(), manualDt: null,
  };
  const seat = (i) => throwers[i];
  const sideFor = (turn) => turn;
  const _g = new THREE.Vector3(), _v = new THREE.Vector3();
  const gripOf = [new THREE.Vector3(), new THREE.Vector3()];

  // kinds of frames: F.mode = 'play' | 'hero'
  S.frame = function frame(F, dt) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    if (S.manualDt != null) dt = S.manualDt;
    S.time += dt;
    const t = S.time;
    const track = F.track;
    world.setTrack(track);
    const twoSides = F.sides !== 1;
    const turn = F.turn | 0;

    // ---- who is where
    const yawBase = Math.PI + (F.aim ? F.aim.ang : 0) * 0.9;     // facing up the lane (-Z), a little toward the sight
    for (let i = 0; i < 2; i++) {
      const T = throwers[i]; if (!T) continue;
      const on = (i === 0 || twoSides) && !F.noPeople && !(F.hide && F.hide[i]);
      T.show(on);
      if (!on) continue;
      const turnYaw = Math.PI + (F.aim ? F.aim.ang * (i === turn ? 0.9 : 0.35) : 0);
      T.place(baseX[i], LINE_Z, turnYaw, dt);
    }

    // ---- throwing states
    const rollNew = F.roll && F.roll.s && F.roll !== S.rollId;
    if (rollNew) {
      const side = F.roll.side | 0, T = throwers[side];
      S.rollId = F.roll;
      const v0 = F.roll.s.v0 || 3;
      const p = clamp((v0 - V_MIN) / (V_MAX - V_MIN), 0, 1);
      if (T) T.startSwing(p);
      const g = gripOf[side];
      S.roll = { side, x0: g.x, y0: g.y, z0: g.z, t: 0, dist: 0, px: F.roll.s.x, py: F.roll.s.y, spin: 0, lay: 0, heading: Math.atan2(F.roll.s.vx, F.roll.s.vy), settle: -1, wob: 0, v0 };
    }
    if (!F.roll && S.rollId) S.rollId = null;
    for (let i = 0; i < 2; i++) {
      const T = throwers[i]; if (!T || !T.root.visible) continue;
      const aimPhase = F.phase === 'aim' && i === turn;
      if (T.swinging()) { T.driveSwing(dt); continue; }
      if (aimPhase) {
        if (F.hold && F.hold.on) T.drive('wind', clamp(F.hold.power, 0, 1), dt, S.time);
        else if (F.humanTurn) T.drive('ready', 0, dt, S.time);
        else T.drive('rehearse', 0, dt, S.time);
      } else T.drive('watch', 0, dt, S.time);
    }
    // head attention: both watch the disc while it rolls, the waiting player watches the roller
    const focus = F.roll && F.roll.s ? { x: F.roll.s.x, y: 0.15, z: -F.roll.s.y } : { x: 0, y: 0.15, z: -2.5 };
    for (let i = 0; i < 2; i++) { const T = throwers[i]; if (T && T.root.visible) T.look(F.phase === 'roll' || F.phase === 'result' ? focus : { x: 0, y: 1.0, z: -4 }, 0.55, dt); }

    // ---- advance the people, then pose-dependent things
    stage.update(dt, { renderNow: false });
    for (let i = 0; i < 2; i++) { const T = throwers[i]; if (T && T.root.visible) T.afterUpdate(dt, t, 0.3, gripOf[i]); }
    if (crowd) crowd.update(dt);
    world.update(t, dt);

    // ---- events -> reactions
    for (const e of F.evts || []) {
      if (e.id <= S.lastEvt) continue;
      S.lastEvt = e.id;
      if (e.t === 'stake') { world.hitStake(e.x, e.y, e.vx || 0, e.vy || 1, e.v || 2); if (crowd) crowd.react('gasp', { origin: [e.x, 0, -e.y], radius: 14, intensity: 0.5 }); }
      else if (e.t === 'gate') { const r = gateFlash.find((g) => !g.visible) || gateFlash[0]; r.visible = true; r.position.set(e.x, 0.02, -e.y); r.userData = { t: 0 }; if (crowd) crowd.react('cheer', { origin: [e.x, 0, -e.y], radius: 16, intensity: 0.6 }); }
      else if (e.t === 'far') { farRing.userData.flash = 1; if (crowd) crowd.react('cheer', { origin: [track.far.x, 0, -track.far.y], radius: 22, intensity: 1 }); }
      else if (e.t === 'out') { if (crowd) crowd.react('groan', { origin: [e.x, 0, -e.y], radius: 14, intensity: 0.6 }); }
    }
    for (const r of gateFlash) if (r.visible) { r.userData.t += dt; const k = r.userData.t / 0.9; r.scale.setScalar(1 + k * 1.6); r.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) r.visible = false; }
    if (farRing.userData.flash > 0) { farRing.userData.flash = Math.max(0, farRing.userData.flash - dt * 1.1); }
    farRing.position.set(track.far.x, 0.016, -track.far.y); farRing.material.opacity = 0.18 + 0.7 * (farRing.userData.flash || 0) + (F.phase === 'aim' ? 0.12 + 0.06 * Math.sin(t * 2.4) : 0);

    // ---- discs
    // held disc in the active player's grip
    const showHeld = F.held && !F.roll && throwers[F.held.side | 0];
    if (showHeld) {
      const g = gripOf[F.held.side | 0];
      held.visible = true; held.material = world.discMats[(F.held.side | 0) % 2];
      const T = throwers[F.held.side | 0];
      held.position.set(g.x, g.y - 0.012, g.z);
      world.poseDisc(held, g.x, g.z, (F.aim ? F.aim.ang : 0), 0.4, 0, 0, 0); held.position.y = g.y - 0.01;
      void T;
    } else held.visible = false;

    // rolling disc
    const R = S.roll;
    if (F.roll && F.roll.s && R) {
      const s = F.roll.s, sp = Math.hypot(s.vx, s.vy);
      R.t += dt;
      if (sp > 0.2) R.heading = F.headingOverride !== undefined ? F.headingOverride : Math.atan2(s.vx, s.vy);
      const dx = s.x - R.px, dy = s.y - R.py; R.px = s.x; R.py = s.y;
      R.spin += Math.hypot(dx, dy) / DISC_R;
      const speedK = sstep(1.5, 0.12, sp);                                   // slowing: the disc starts to wobble and lean over
      const settling = s.rest || s.out;
      if (settling && R.settle < 0) R.settle = 0;
      if (R.settle >= 0) R.settle += dt;
      const lay = settling ? sstep(0, 0.45, R.settle) : speedK * 0.55;
      const wobAmp = settling ? 0.2 * Math.exp(-R.settle * 7) : 0.16 * speedK * (0.4 + 0.6 * speedK);
      const wob = Math.sin(t * (14 + 60 * speedK) + R.spin * 0.2) * wobAmp * (1 - lay * 0.6);
      const bl = 1 - sstep(0, 0.1, R.t);                                      // release blend: hand -> sim path
      rollDisc.visible = true; rollDisc.material = world.discMats[R.side % 2]; rollDisc.scale.setScalar(F.discScale || 1);
      const x = s.x + (R.x0 - 0) * bl, z = -s.y + (R.z0 - 0) * bl;
      world.poseDisc(rollDisc, x, z, R.heading, R.spin, lay, wob, (R.y0 - DISC_R) * bl * 0.9);
      R.lay = lay;
      // shadow + faint glow so a 13 cm disc still reads at 20 m
      rollShadow.visible = true; rollShadow.position.set(x, 0.007, z); rollShadow.scale.setScalar(1 + 0.25 * lay);
      const dist = Math.max(1, Math.hypot(x - camera.position.x, z - camera.position.z)), minR = 0.17 * Math.min(2.6, Math.max(1, dist / 6));
      glowUnder.visible = !settling; glowUnder.position.set(x, 0.014, z); glowUnder.material.opacity = 0.6; glowUnder.scale.setScalar((minR / 0.16) * (1 + 0.1 * Math.sin(t * 8)) * (F.discScale || 1) * 0.8);
      R.last = { x: s.x, y: s.y, heading: R.heading };
    } else { rollDisc.visible = false; rollShadow.visible = false; glowUnder.visible = false; }

    // resting discs
    let n = 0;
    for (const d of F.rests || []) {
      const m = getDisc(n++, d.side | 0); m.visible = true;
      const yaw = ((d.spin | 0) * 2.399 + d.x * 7) % TAU;
      world.poseDisc(m, d.x, -d.y, yaw, 0, 1, 0, 0);
    }
    for (let i = n; i < discPool.length; i++) discPool[i].visible = false;

    // aim preview dots + end ring
    const pv = F.preview;
    if (pv && pv.path && pv.path.length > 1) {
      const np = Math.min(pv.path.length, 160);
      const d = new THREE.Object3D();
      for (let i = 0; i < np; i++) { const q = pv.path[i]; d.position.set(q.x, 0.02, -q.y); d.scale.setScalar(0.5 + 0.5 * Math.min(1, i / 8)); d.updateMatrix(); dots.setMatrixAt(i, d.matrix); }
      dots.count = np; dots.instanceMatrix.needsUpdate = true; dots.material.opacity = pv.faint ? 0.35 : 0.95;
      const e = pv.path[pv.path.length - 1]; endRing.visible = true; endRing.position.set(e.x, 0.018, -e.y); endRing.material.opacity = pv.faint ? 0.4 : 0.95; endRing.pulse(t, 3);
    } else { dots.count = 0; endRing.visible = false; }
    if (F.pathTrace && F.pathTrace.length > 1) {
      const np = Math.min(F.pathTrace.length, 200), d = new THREE.Object3D();
      for (let i = 0; i < np; i++) { const q = F.pathTrace[i]; d.position.set(q.x, 0.018, -q.y); d.scale.setScalar(0.55); d.updateMatrix(); trace.setMatrixAt(i, d.matrix); }
      trace.count = np; trace.instanceMatrix.needsUpdate = true;
    } else trace.count = 0;

    // particles
    let si = 0;
    for (const q of F.parts || []) {
      if (si >= sprites.length) break;
      const sp = sprites[si++], a = clamp(1 - q.t / q.max, 0, 1);
      sp.visible = true; sp.position.set(q.x, 0.04 + q.z * 0.6, -q.y);
      const spark = q.kind === 1;
      sp.material.color.set(spark ? 0xffe9a0 : (q.col ? `rgb(${q.col})` : 0xd8bd8a));
      sp.material.opacity = a * (spark ? 0.95 : 0.55);
      sp.scale.setScalar((spark ? 0.05 : 0.1) * (q.size || 1) * (spark ? 1 : 1 + q.t * 2.4));
    }
    for (let i = si; i < sprites.length; i++) sprites[i].visible = false;

    // ---- shadow box follows the action
    const fx = F.cam ? F.cam.x : 0, fy = F.cam ? -F.cam.y : 0;
    key.target.position.set(fx * 0.5, 0, fy - 4.0);
    key.position.set(fx * 0.5 - 6, 7.5, fy - 4.0 + 8);
    key.target.updateMatrixWorld();

    // ---- camera
    S.setCamera(F);
  };

  S.setCamera = function setCamera(F) {
    const rect = F.rect;
    if (F.mode === 'hero') {
      const t = S.time, wide = rect.w > rect.h * 1.2;
      const p = F.hero || (wide
        ? { pos: [0.0, 1.75, 3.6], look: [0.0, 1.65, -20], f: 0.8 * rect.h / rect.w, hy: 0.33, cx: -0.2, drift: 0.3 }
        : { pos: [0.0, 1.75, 3.7], look: [0.0, 1.7, -20], f: 1.0, hy: 0.31, cx: 0, drift: 0.28 });
      const drift = Math.sin(t * 0.09) * (p.drift ?? 0.3);
      const pos = p.pos;
      camera.position.set(pos[0] + drift, pos[1] + Math.sin(t * 0.13) * 0.03, pos[2]);
      const lk = p.look;
      camera.up.set(0, 1, 0); camera.lookAt(lk[0] + drift * 0.15, lk[1], lk[2]);
      camera.updateMatrixWorld(true);
      pinhole((p.f ?? 1.0) * rect.w, rect.w / 2 + (p.cx || 0) * rect.w, rect.h * (p.hy ?? 0.4), rect.w, rect.h);
    } else {
      const sp = scopeParams({ x: 0, y: 0, w: rect.w, h: rect.h });
      const cam = F.cam || { x: 0, y: -4, yaw: 0 };
      camera.position.set(cam.x, sp.camH, -(cam.y - sp.extra));
      camera.rotation.set(0, -cam.yaw, 0);
      camera.updateMatrixWorld(true);
      pinhole(sp.f, sp.cx, sp.hy, rect.w, rect.h);
    }
  };

  // render into the CSS-pixel viewport (x, y from top-left, w, h); the rest of the canvas is left transparent
  S.render = function render(vp) {
    if (stage.contextLost) return false;
    const r = renderer;
    const W = canvas.clientWidth || vp.cw, H = canvas.clientHeight || vp.ch;
    r.setScissorTest(false); r.setViewport(0, 0, W, H); r.clear();
    r.setScissorTest(true);
    r.setViewport(vp.x, H - (vp.y + vp.h), vp.w, vp.h);
    r.setScissor(vp.x, H - (vp.y + vp.h), vp.w, vp.h);
    r.render(scene, camera);
    r.setScissorTest(false);
    void W;
    stage.stats.renders++;
    return true;
  };
  S.realUpdate = realUpdate;
  S.gripOf = gripOf;
  return S;
}
