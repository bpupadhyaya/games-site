// 3D presenter for Gumboot Throwing. It only READS the game state handed over by the 2D layer (the throw, the marks, the sky, the camera
// the 2D layer chose) and draws the village fair behind the transparent kit canvas: the thrower, the boot, the judge, the crowd, the lane.
// The kit canvas keeps the HUD, gauges, menus and input. Without WebGL2, with ?nogl, or while the context is lost the 2D art plays and this
// layer takes over again when it is back.
import { GL } from '../src/glbridge.js';
import { BOOTS, ARM_R, PIVOT_Y, LINE_X } from '../src/consts.js';
import { buildWorld, LOOKS, LANE_LEN } from './world.js';
import { makeBoot, BOOT_COM } from './boot.js';
import { Thrower, dressThrower, holdPoints, FIST_Z } from './actors.js';
import { makeFx, BootBody, qFromEuler } from './fx.js';

const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);
const D2R = Math.PI / 180;
const QS = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const BOOT_SCALE = [1.2, 1.0, 1.22, 1.16, 1.2];   // real size times at most 1.25 (readability), kids' boot smaller
const FOCAL = 1500;       // virtual px: the camera sits FOCAL / S metres from the lane so the lane plane keeps the 2D layer's scale exactly

function pickQuality() {
  const m = QS.get('q3d') || QS.get('q'); if (m === 'low' || m === 'medium' || m === 'high') return m;
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality(), standalone = false } = {}) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const doc = globalThis.document;
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  if (kitCanvas) { kitCanvas.parentElement.insertBefore(canvas, kitCanvas); kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1'; } else doc.body.appendChild(canvas);
  const shotMode = QS.has('shot') || QS.has('dev') || standalone;
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 8, preserveDrawingBuffer: shotMode, fov: 38 }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera, scene = stage.scene;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  cam.near = 0.3; cam.far = 1200;
  const keyL = stage.lights.key;
  if (renderer.shadowMap.enabled) { const sc = keyL.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 60; sc.updateProjectionMatrix(); keyL.shadow.bias = -0.0004; keyL.shadow.normalBias = 0.025; keyL.shadow.radius = 3; }

  const world = buildWorld({ V3, stage, quality });
  world.setLook(1); world.setSector(14);
  const fx = makeFx(THREE, scene, { puff: world.puff, quality });
  const P = { stage, THREE, world, fx, ready: false, lost: false, quality, licenses: '', V3 };
  stage.onContextLost(() => { P.lost = true; GL.on = false; });
  stage.onContextRestored(() => { P.lost = false; P.cw = 0; const l = world.look; world.look = -1; world.setLook(l); stage.resize(); stage.invalidate(); });

  // ---- the boots (one mesh per colour, built on demand) --------------------------------------------------------------------------------
  const bootCache = new Map();
  const bootRoot = new THREE.Group(); scene.add(bootRoot);
  let bootIdx = -1, bootMesh = null;
  function useBoot(idx) {
    if (idx === bootIdx) return;
    bootIdx = idx;
    if (bootMesh) bootRoot.remove(bootMesh);
    let m = bootCache.get(idx);
    if (!m) { const b = BOOTS[idx] || BOOTS[0]; m = makeBoot(THREE, { colour: b.col, sole: b.sole, mud: 0.35 + 0.12 * idx, seed: idx + 1, scale: BOOT_SCALE[idx] || 1 }); bootCache.set(idx, m); }
    bootMesh = m; bootRoot.add(m);
  }
  useBoot(0);
  const glowTex = world.puff;
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.renderOrder = 3; shadowBlob.frustumCulled = false; scene.add(shadowBlob);
  // a soft halo that keeps a small boot findable when the camera is far out (no enlarging of the boot itself)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0, color: 0xfff2c0, fog: false, blending: THREE.AdditiveBlending }));
  halo.renderOrder = 8; scene.add(halo);
  // contrail: soft dots along the flight
  const TR = 46;
  const trail = Array.from({ length: TR }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, fog: false })); s.visible = false; scene.add(s); return s; });
  // landing flag with the distance, pegs for the earlier throws
  const flagCv = doc.createElement('canvas'); flagCv.width = 256; flagCv.height = 160;
  const flagTex = new THREE.CanvasTexture(flagCv); flagTex.colorSpace = THREE.SRGBColorSpace;
  const flagG = new THREE.Group(); flagG.visible = false; scene.add(flagG);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xf4efe3, roughness: 0.5 })); flagPole.position.y = 0.8; flagG.add(flagPole);
  const flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.5, 8, 2), new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.8, side: THREE.DoubleSide }));
  flagCloth.geometry.translate(0.39, 0, 0); flagCloth.position.set(0.02, 1.32, 0); flagG.add(flagCloth);
  const flagBase = flagCloth.geometry.attributes.position.array.slice();
  const pegs = Array.from({ length: 12 }, () => {
    const g = new THREE.Group(); g.visible = false;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0xf4efe3 })); pole.position.y = 0.35; g.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshStandardMaterial({ color: 0xffd45a, side: THREE.DoubleSide, roughness: 0.8 })); fl.geometry.translate(0.15, 0, 0); fl.position.set(0.01, 0.6, 0); g.add(fl);
    g.userData.cloth = fl; scene.add(g); return g;
  });
  function paintFlag(text, good) {
    const g = flagCv.getContext('2d');
    g.fillStyle = good ? '#f2c14e' : '#d8362f'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = good ? '#1c2a44' : '#fff6e4'; g.font = '900 78px "Avenir Next", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 84, 232);
    g.strokeStyle = good ? '#c28a1a' : '#8a1d18'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 152);
    flagTex.needsUpdate = true;
  }

  // ---- people --------------------------------------------------------------------------------------------------------------------------
  const THR = { h: null, t: null, judge: null };
  P.thr = THR;
  async function build() {
    const h = await loadHuman({ character: QS.get('fig') === 'f' ? 'athlete_f' : 'athlete_m', kit: { top: '#b3261e', bottoms: '#2e4a74', socks: '#e9e4d6', shoes: '#2f6b36', trim: '#7e1a14' }, skin: 'light', hair: 'brown', lod: 'auto', quality, castShadow: true, scale: 1.05 });
    h.groundClamp = 'auto'; h.footPlanting = false;
    stage.add(h); stage.track(h); h.setLOD(0);
    THR.h = h; THR.t = new Thrower(V3, h);
    THR.dress = dressThrower(V3, h, {});
    h.setFingers('R', 'fist');
    P.ready = true; stage.invalidate();
    try {
      const j = await loadHuman({ character: 'athlete_f', kit: { top: '#f2c14e', bottoms: '#243a5c', socks: '#f4efe3', shoes: '#d8d4c8', trim: '#d9a21a' }, skin: 'tan', hair: 'black', lod: 'auto', quality, castShadow: true });
      j.groundClamp = 'auto'; j.footPlanting = false;
      stage.add(j); stage.track(j); j.setLOD(0);
      j.setPosition(2.3, 0, -2.5); j.setFacing(0.25);
      j.play('idle_relaxed', { fade: 0, loop: true });
      THR.judge = j;
      try { V3.addCap(j, { color: 0x243a5c }); } catch { /* optional */ }
    } catch (e) { console.warn('judge unavailable', e); }
    buildCrowd();
  }
  // crowd: real 3D spectators behind the far rope, kids and grown-ups, built after the thrower so the first frame is fast
  let crowd = null;
  function buildCrowd() {
    try {
      const n = quality === 'low' ? 26 : quality === 'medium' ? 46 : 70;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = 1.5 + u * 66 + (hash(i * 3.3) - 0.5) * 1.6;
        const z = -(x * Math.tan(16 * D2R) + 2.9 + hash(i * 7.7) * 1.4);
        pts.push({ x, y: 0, z, yaw: (hash(i + 5) - 0.5) * 0.8 + (hash(i * 2.2) < 0.3 ? 0.35 : 0), seated: 0 });
      }
      // a few by the table and the bales near the start
      for (const [x, z, yaw] of [[-0.4, -3.9, 0.3], [0.5, -4.1, -0.1], [-2.6, -4.6, 0.4], [4.6, -4.2, 0.0], [6.1, -4.8, -0.2]]) pts.push({ x, y: 0, z, yaw, seated: 0 });
      crowd = V3.createCrowd3d({ scene, camera: cam }, { points: pts, count: pts.length, seed: 21, culture: ['european_village', 'american_rural'], quality: quality === 'high' ? 'medium' : 'low', excitement: 0.25, props: { flag: 0.1, phone: 0.1, child: 0.12 }, flagColors: ['#d8362f', '#f6eed8', '#2f6fb4'] });
      P.crowd = crowd; stage.invalidate();
    } catch (e) { console.warn('crowd unavailable', e); }
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- adaptive quality ------------------------------------------------------------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 26 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) { renderer.shadowMap.enabled = false; }
        else renderer.setPixelRatio(perfLevel === 2 ? Math.min(1.25, renderer.getPixelRatio()) : 1);
        scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- camera -------------------------------------------------------------------------------------------------------------------------------
  const V = { tmp: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() };
  // lane-plane camera: world (x, y, 0) lands exactly at px = W/2 + (x - camX) * S, py = gy - y * S (the 2D layer's mapping)
  function laneCamera(c, S, camX, gy) {
    const W = c.W, H = c.H;
    const D = clamp(FOCAL / S, 8, 140);
    const camY = clamp(1.5 + (190 - S) / 190 * 2.6, 1.5, 4.3);
    const e5 = 2 * S * D / H;
    cam.position.set(camX, camY, D); cam.up.set(0, 1, 0); cam.lookAt(camX, camY, 0);
    cam.fov = 2 * Math.atan(1 / e5) / D2R; cam.aspect = W / H; cam.updateProjectionMatrix();
    const e = cam.projectionMatrix.elements;
    e[8] = 0; e[9] = -2 * S * camY / H - 1 + 2 * gy / H;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);
    return { D, camY };
  }
  // hero camera for the title: a three-quarter view of the thrower, framed into the open window the title layout leaves (virtual units)
  function heroCamera(c, t, win) {
    const W = c.W, H = c.H, asp = W / H;
    const has = win && win.h > 120 && win.w > 120;
    const rect = has ? win : { x: 0, y: H * 0.3, w: W, h: H * 0.35 };
    const fov = 30, figH = 2.7;
    const dist = clamp((figH * H / Math.max(80, rect.h)) / (2 * Math.tan(fov * D2R / 2)), 5.2, 16);
    const az = 0.2 + Math.sin(t * 0.17) * 0.06, ty = 1.12, tx = 0.5;
    cam.position.set(tx + Math.sin(az) * dist, ty + 0.5 + Math.sin(t * 0.21) * 0.03, Math.cos(az) * dist);
    cam.up.set(0, 1, 0); cam.lookAt(tx, ty, 0);
    cam.fov = fov; cam.aspect = asp; cam.updateProjectionMatrix();
    const e = cam.projectionMatrix.elements;
    const cx = (rect.x + rect.w / 2) / W, cy = (rect.y + rect.h / 2) / H;
    e[8] = -(2 * cx - 1); e[9] = -(1 - 2 * cy);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);
  }

  // ---- the throw: display state --------------------------------------------------------------------------------------------------------
  const body = new BootBody();
  const Dd = {
    run: null, mode: 'idle', phi: 0, vel: 0, corr: 0, ev: 0, theta: 0, thetaVel: 0, wob: 0,
    free: false, rel: null, landT: 0, flagT: -1, simT: -1, simWall: 0, lastPhase: '', releaseT: -9, cheerT: -9, handW: 1,
    bootPos: [0, 0.4, 0], lastBootPos: [0, 0.4, 0], lookAt: new THREE.Vector3(10, 1.2, 0), sprayAcc: 0,
  };
  P.Dd = Dd;
  const wrapPi = (a) => a - Math.round(a / TAU) * TAU;
  function newRun(s) {
    Dd.run = s; Dd.evSeen = 0; Dd.free = false; Dd.rel = null; Dd.flagT = -1; Dd.mode = 'idle';
    Dd.phi = wrapPi(Dd.phi); Dd.vel = 0; Dd.corr = 0; Dd.simT = -1; Dd.lastPhase = '';
    body.reset(); fx.clear(); flagG.visible = false;
    for (const t of trail) { t.visible = false; }
  }
  function onEvent(e, s, st) {
    const hand = Dd.bootPos;
    if (e.type === 'release' || e.type === 'slip') {
      Dd.releaseT = st.time;
      const sp = Math.max(2, (s.rel ? s.rel.v : 8));
      // mud shaken off the boot as it leaves the hand
      fx.spray(0, hand[0], hand[1], hand[2], s.b ? s.b.vx * 0.35 : 0, s.b ? s.b.vy * 0.2 : 0, s.b ? s.b.vz * 0.35 : 0, 10, 0.022, 0.9, e.id + 3);
      if (THR.h) THR.h.setFingers('R', 'open');
      if (crowd) crowd.react('gasp', { origin: [hand[0] + 8, 0, -4], radius: 40, intensity: clamp(sp / 18, 0.2, 0.7) });
    } else if (e.type === 'land') {
      Dd.landT = st.time;
      const x = s.landX, z = s.landZ, vx = s.b ? s.b.vx : 0, vz = s.b ? s.b.vz : 0, imp = s.b ? Math.abs(s.b.vy) : 8;
      Dd.flagT = 0;
      paintFlag(s.outcome === 'fair' ? `${s.dist.toFixed(1)} m` : 'NO THROW', s.outcome === 'fair');
      flagG.position.set(x, 0, z); flagG.visible = true;
      fx.setDivot(x, z, 0.5 + imp * 0.03, true);
      fx.spray(0, x, 0.05, z, vx * 0.18, 2.6 + imp * 0.1, vz * 0.18, 16, 0.04, 1.2, 40 + e.id);
      fx.spray(1, x, 0.05, z, vx * 0.2, 2.2, vz * 0.2, 18, 0.05, 1.4, 70 + e.id);
      fx.spray(2, x, 0.05, z, vx * 0.1, 1.6, vz * 0.1, 8, 0.03, 1.0, 90 + e.id);
      fx.puff(x, 0.18, z, vx * 0.1, 0.6, 0.9, 1.1, 0xcdbf9c, 2.0, 0.6);
      fx.puff(x + 0.1, 0.1, z, vx * 0.06, 0.3, 0.6, 0.8, 0xbfb18c, 1.6, 0.45);
      if (crowd) {
        if (e.outcome === 'fair') { crowd.react(e.dist > 25 ? 'ovation' : 'cheer', { origin: [x, 0, -6], radius: 60, intensity: clamp(e.dist / 40, 0.35, 1) }); crowd.setExcitement(clamp(0.25 + e.dist / 60, 0.25, 0.9)); }
        else { crowd.react('groan', { origin: [x, 0, -6], radius: 45, intensity: 0.8 }); crowd.setExcitement(0.2); }
      }
      if (THR.judge && e.outcome === 'fair') { THR.judge.play('clap', { fade: 0.25, loop: false, onDone: () => { try { THR.judge.play('idle_relaxed', { fade: 0.4, loop: true }); } catch { /* ignore */ } } }); }
      Dd.cheerT = st.time;
    }
  }

  // ---- one frame -----------------------------------------------------------------------------------------------------------------------
  let lastT = null, lastWall = null, amb = 0, landCamShake = 0;
  const offM = new THREE.Matrix4();
  function frame() {
    if (!P.ready || P.lost || P.off) { GL.on = false; stage.setVisible(false); return; }
    const views = GL.views;
    if (!views.length) { GL.on = true; stage.setVisible(false); return; }
    GL.on = true;
    const view = views[views.length - 1], st = view.st, c = view.c, s = st.run;
    const now = globalThis.performance.now();
    const cw = (kitCanvas && kitCanvas.clientWidth) || canvas.clientWidth || 720, ch = (kitCanvas && kitCanvas.clientHeight) || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    stage.setVisible(true);
    let dt = lastT === null || st.time < lastT ? 0 : st.time - lastT;
    if (dt > 0) { Dd.simWall = now; }
    lastT = st.time;
    dt = clamp(dt, 0, 0.1);
    const wall = lastWall === null ? 0 : clamp((now - lastWall) / 1000, 0, 0.1); lastWall = now;
    const extra = clamp((now - Dd.simWall) / 1000, 0, 1 / 60) * (dt > 0 ? 0 : 1) * (st.frozen ? 0 : 1);
    amb += dt;

    // look, sector, boot colour
    if (world.look !== (st.sky | 0)) { world.setLook(st.sky | 0); const k = world.cur.keyPos; stage._shadowOffset.set(k[0] * 18, k[1] * 18, k[2] * 18); }
    world.setSector(s ? s.sector : 14);
    useBoot(clamp(st.boot | 0, 0, BOOTS.length - 1));
    if (s !== Dd.run) newRun(s);

    // wind: the sim's wind vector (the flags, the sock) or a light breeze on the menu
    const wx = s ? s.wind.x : st.windX || 1.5, wz = s ? s.wind.z : 0;
    world.setWind(wx, wz, amb);

    // ---- display angle of the swinging arm ------------------------------------------------------------------------------------
    const phase = s ? s.phase : 'idle';
    if (s) for (const e of s.events) if (e.id >= (Dd.evSeen || 0)) { Dd.evSeen = e.id + 1; onEvent(e, s, st); }
    if (phase === 'swing') {
      if (Dd.mode !== 'swing') { Dd.corr = wrapPi(Dd.phi) - (s.phi % TAU); Dd.corr = wrapPi(Dd.corr); Dd.mode = 'swing'; }
      Dd.corr *= Math.exp(-dt / 0.09);
      Dd.phi = s.phi + Dd.corr + s.omega * extra;
      Dd.vel = s.omega;
    } else if (phase === 'flight' || phase === 'landed') {
      if (Dd.mode === 'swing') { Dd.mode = 'follow'; Dd.vel = s.rel ? s.rel.om : Dd.vel; Dd.relPhi = Dd.phi; }
      if (Dd.mode === 'follow') {
        Dd.vel *= Math.exp(-5.2 * dt); Dd.phi += Dd.vel * dt;
        if (Dd.vel < 0.9) { Dd.mode = 'return'; }
      } else if (Dd.mode === 'return') {
        const tgt = Math.round(Dd.phi / TAU) * TAU;
        const w0 = 4.5, x = Dd.phi - tgt;
        Dd.vel += (-w0 * w0 * x - 2 * w0 * Dd.vel) * dt; Dd.phi += Dd.vel * dt;
      }
    } else {
      // ready or the menu: the arm hangs and sways a little (breathing, shifting weight)
      const tgt = 0.07 * Math.sin(amb * 1.3) + 0.03 * Math.sin(amb * 0.5 + 1.0);
      const x = Dd.phi - Math.round(Dd.phi / TAU) * TAU, tg = tgt;
      Dd.vel += (-30 * (x - tg) - 11 * Dd.vel) * Math.min(dt, 0.033); Dd.phi += Dd.vel * Math.min(dt, 0.033);
      if (dt === 0) Dd.vel = 0;
      Dd.mode = 'idle';
    }
    if (P.qa && P.qa.phi != null) { Dd.phi = P.qa.phi; Dd.vel = P.qa.vel || 0; }
    const held = (!s || phase === 'ready' || phase === 'swing') || !!(P.qa && P.qa.phi != null);
    // boot angle: hangs along the radius with a little lag behind the arm when it speeds up
    const lag = clamp(-Dd.vel * 0.016, -0.2, 0.0);
    if (phase === 'swing') Dd.lagRel = lag;

    // ---- hand target and pose -----------------------------------------------------------------------------------------------------
    const h = THR.h, th = THR.t;
    const theta = Dd.phi + lag;
    const hp = holdPoints(Dd.phi, theta);
    if (h) {
      th.scrub(Dd.phi);
      const wantW = held || Dd.mode === 'follow' || Dd.mode === 'return' ? 1 : 0;
      Dd.handW += (wantW - Dd.handW) * (dt > 0 ? 1 - Math.exp(-dt * 8) : 0);
      const reachOn = Dd.handW > 0.02;
      if (reachOn) {
        const fing = held && phase !== 'flight' ? 'fist' : null;
        const n = V.a.set(0, 0, -1), fx3 = V.b.set(Math.sin(theta), -Math.cos(theta), 0);
        const sol = V3.solvePalmBall(h, 'R', V.tmp.set(hp.fist[0], hp.fist[1], hp.fist[2]), n, fx3, 0);
        const sh = h.bonePosition('R_UpperArm', new THREE.Vector3());
        h.setReach('R', sol.wrist, { weight: Dd.handW, pole: { x: sh.x - 0.1, y: sh.y, z: sh.z + 0.7 }, quat: QS.has('hq') ? sol.quat : null });
        if (fing && Dd.fing !== 'fist') { h.setFingers('R', 'fist'); Dd.fing = 'fist'; }
      } else { h.setReach('R', null); }
      if (!held && phase !== 'swing' && Dd.fing === 'fist' && Dd.handW < 0.98) { h.setFingers('R', 'relaxed'); Dd.fing = 'relaxed'; }
      if (!held && Dd.mode === 'follow' && st.time - Dd.releaseT > 0.25 && Dd.fing !== 'relaxed') { h.setFingers('R', 'relaxed'); Dd.fing = 'relaxed'; }
      if (held && Dd.fing !== 'fist') { h.setFingers('R', 'fist'); Dd.fing = 'fist'; }
      // the head follows the action
      let look;
      if (phase === 'flight' && s.b) look = V.tmp.set(s.b.x, s.b.y, s.b.z);
      else if (phase === 'landed') look = V.tmp.set(s.landX, 0.3, s.landZ);
      else if (phase === 'swing') look = V.tmp.set(14, 1.3, 0);
      else look = V.tmp.set(10, 1.0, 0.5);
      Dd.lookAt.lerp(look, st.frozen ? 0 : 1 - Math.exp(-Math.max(wall, 0.001) * 6));
      h.lookAt(Dd.lookAt, { weight: 0.85 });
      const j = THR.judge;
      if (j) {
        const tgt = phase === 'flight' && s.b ? V.tmp.set(s.b.x, s.b.y, s.b.z) : phase === 'landed' ? V.tmp.set(s.landX, 0.4, s.landZ) : V.tmp.set(9, 1.4, 0);
        j.lookAt(tgt, { weight: 0.8 });
      }
    }
    stage.update(dt > 0 ? dt : wall * 0, { renderNow: false });
    if (h && h.limbSanity) h.limbSanity();
    if (THR.judge && THR.judge.limbSanity) THR.judge.limbSanity();
    if (THR.dress && THR.dress.update) THR.dress.update();
    if (crowd) crowd.update(dt);
    // breathing on top of the pose
    if (h) {
      const b = h.bones, k = held && phase === 'ready' ? 1 : 0.5, br = Math.sin(amb * 1.7);
      const add = (name, x, y, z) => { const bo = b[name]; if (!bo) return; V.e.set(x, y, z, 'XYZ'); V.q.setFromEuler(V.e); bo.quaternion.multiply(V.q); };
      add('Bip01_Spine1', 0, 0, 0.012 * br * k); add('Bip01_Spine2', 0, 0, 0.016 * br * k); add('Bip01_Neck', 0, 0, -0.008 * br * k);
    }

    // ---- the boot --------------------------------------------------------------------------------------------------------------------
    const sc = BOOT_SCALE[bootIdx] || 1;
    const rot = (a, b2, ang) => [a * Math.cos(ang) - b2 * Math.sin(ang), a * Math.sin(ang) + b2 * Math.cos(ang)];
    let px = 0, py = 0, pz = 0, ang = theta, qx = 0, qy = 0, qz = 0, qw = 1, useQ = false;
    let showBoot = true;
    if (held) {
      px = ARM_R * Math.sin(theta - lag) ; py = PIVOT_Y - ARM_R * Math.cos(theta - lag); pz = 0;
      // flick the boot's wobble in the hand a little when the arm turns fast (it pivots about the grip)
      Dd.free = false;
    } else if (s && (phase === 'flight' || phase === 'landed') && s.b) {
      const b = s.b;
      if (!Dd.free) {
        // in the air: the sim position, tumbling about its centre of mass; wobble grows after release
        const tF = b.t + extra;
        const spin = (s.rel ? s.rel.om : 6) * 0.9;
        const relTheta = (s.rel ? s.rel.phi : Dd.phi) + (Dd.lagRel || 0);
        const th2 = relTheta + spin * tF;
        const wobA = 0.35 * (1 - Math.exp(-tF / 0.35)), wob = wobA * Math.sin(tF * 6.1 + 1.0);
        const q = qFromEuler(wob, wobA * 0.5 * Math.sin(tF * 4.3), th2);
        px = b.x + b.vx * extra; py = b.y + b.vy * extra; pz = b.z + b.vz * extra;
        // the sim's boot leaves at the speed of the whole body turn, about three times the hand's: ease the picture off the hand
        if (!Dd.v0 || Dd.v0run !== s) { Dd.v0 = [b.vx, b.vy, b.vz]; Dd.v0run = s; Dd.vh = [Math.cos(theta) * Dd.vel * ARM_R, Math.sin(theta) * Dd.vel * ARM_R, 0]; }
        {
          const tau = 0.075, T2 = 0.38, f = tau * (1 - Math.exp(-tF / tau)) * Math.exp(-tF / T2);
          px -= (Dd.v0[0] - Dd.vh[0]) * f; py -= (Dd.v0[1] - Dd.vh[1]) * f; pz -= (Dd.v0[2] - Dd.vh[2]) * f;
        }
        const low = BootBody.lowest([px, py, pz], q);
        if (low <= 0 && b.vy < 0) {
          // touches down: hand over to the rigid body (flops, bounces in the mud, settles)
          Dd.free = true; body.reset();
          body.p = [px, py - low + 0.002, pz]; body.v = [b.vx * 0.7, b.vy * 0.28, b.vz * 0.7]; body.q = q;
          body.w = [wobA * 5 * Math.cos(tF * 6.1 + 1.0), 0, spin * 0.9];
        } else { qx = q[0]; qy = q[1]; qz = q[2]; qw = q[3]; useQ = true; ang = th2; }
      }
      if (Dd.free) {
        // the rigid body integrates with the game clock (a paused game freezes it)
        const prevHits = body.hits;
        body.step(dt);
        px = body.p[0]; py = body.p[1]; pz = body.p[2]; qx = body.q[0]; qy = body.q[1]; qz = body.q[2]; qw = body.q[3]; useQ = true;
        if (body.impacts.length) {
          for (const im of body.impacts) {
            const k = clamp(im.v / 8, 0.2, 1);
            fx.puff(im.x, 0.08, im.z, im.vx * 0.05, 0.3, 0.35 + 0.35 * k, 0.7, 0xcdbf9c, 1.8, 0.4 * k);
            fx.spray(0, im.x, 0.06, im.z, im.vx * 0.1, 1.4 * k, im.vz * 0.1, Math.round(4 + 8 * k), 0.025, 0.9, body.hits + 7);
          }
          body.impacts.length = 0;
        }
        void prevHits;
      }
    } else showBoot = false;
    // the held boot: the pivot circle is the sim's; the boot's centre of mass sits on it
    let com = [px, py, pz];
    bootMesh.visible = showBoot;
    if (showBoot) {
      let rimX, rimY, rimZ;
      if (useQ) {
        // rim centre = COM - R * BOOT_COM
        const v = [BOOT_COM[0] * sc, BOOT_COM[1] * sc, BOOT_COM[2] * sc];
        const x = qx, y = qy, z = qz, w = qw;
        const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
        const rv = [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
        rimX = px - rv[0]; rimY = py - rv[1]; rimZ = pz - rv[2];
        bootMesh.quaternion.set(qx, qy, qz, qw);
      } else {
        const r = rot(BOOT_COM[0] * sc, BOOT_COM[1] * sc, ang);
        rimX = px - r[0]; rimY = py - r[1]; rimZ = pz;
        bootMesh.rotation.set(0, 0, ang);
      }
      bootMesh.position.set(rimX, rimY, rimZ);
      Dd.bootPos = com;
    }
    // shadow blob under a flying boot, contrail dots
    {
      const hgt = Math.max(0, py);
      const fly = showBoot && !held && !Dd.free;
      shadowBlob.position.set(px, 0.012, pz);
      shadowBlob.scale.setScalar(0.34 + hgt * 0.06);
      shadowBlob.material.opacity = showBoot && !held ? clamp(0.5 - hgt * 0.03, 0.05, 0.5) : 0;
      const trl = s && s.trail ? s.trail : null;
      for (let i = 0; i < TR; i++) {
        const sp = trail[i];
        if (!trl || !fly || phase !== 'flight') { sp.visible = false; continue; }
        const k = trl.length - 1 - i * 1;
        if (k < 0 || i > 40) { sp.visible = false; continue; }
        const p = trl[k]; sp.visible = true; sp.position.set(p[0], p[1], p[2]);
        const f = 1 - i / 40; sp.scale.setScalar(0.07 + 0.1 * f); sp.material.opacity = 0.5 * f * f;
      }
    }
    {
      const need = showBoot && !held && phase === 'flight' ? clamp(1 - view.S / 90, 0, 0.9) : 0;
      halo.position.set(px, py, pz); halo.scale.setScalar(clamp(34 / view.S, 0.4, 3)); halo.material.opacity = need * 0.55;
    }
    // landing flag cloth waves in the wind; pegs for earlier throws
    if (flagG.visible) {
      Dd.flagT += dt;
      const u = clamp(Dd.flagT / 0.3, 0, 1), up = 1 - Math.pow(1 - u, 3);
      { const m = clamp(46 / view.S, 1, 3.4); flagG.scale.set(m, (0.1 + 0.9 * up) * m, m); }
      const pa = flagCloth.geometry.attributes.position, sp2 = Math.min(1, Math.hypot(wx, wz) / 7);
      for (let i = 0; i < pa.count; i++) {
        const x0 = flagBase[i * 3], y0 = flagBase[i * 3 + 1];
        pa.setZ(i, Math.sin(amb * (4 + sp2 * 4) - x0 * 9) * 0.05 * (x0 / 0.78) * (0.4 + sp2));
        void y0;
      }
      pa.needsUpdate = true;
      flagCloth.rotation.y = wx >= 0 ? 0 : Math.PI;
    }
    const marks = st.marks || [];
    pegs.forEach((g, i) => {
      const m = marks[i];
      if (!m || (s && s.phase === 'landed' && i === marks.length - 1 && flagG.visible && Math.abs(m.x - s.landX) < 0.01)) { g.visible = false; return; }
      g.visible = true; g.position.set(m.x, 0, m.z || 0);
      g.userData.cloth.material.color.set(m.fair ? 0xffd45a : 0xd8362f);
      g.userData.cloth.rotation.z = Math.sin(amb * 3 + i) * 0.08;
    });

    fx.update(dt);
    // mud flung off a spinning boot
    if (held && phase === 'swing' && Math.abs(Dd.vel) > 5) {
      Dd.sprayAcc += dt * (Math.abs(Dd.vel) - 4) * 1.4;
      while (Dd.sprayAcc >= 1) {
        Dd.sprayAcc -= 1;
        const tang = [Math.cos(theta), Math.sin(theta)];
        fx.spray(0, px, py, pz, tang[0] * Dd.vel * 0.9 * ARM_R, tang[1] * Dd.vel * 0.9 * ARM_R, 0, 1, 0.016, 0.7, Math.floor(amb * 90));
      }
    }

    // ---- camera, light, render ---------------------------------------------------------------------------------------------------
    let cs = null;
    if (st.menu) { heroCamera(c, amb, st.heroWin); }
    else { cs = laneCamera(c, view.S, view.camX, view.gy); }
    if (QS.get('cu')) { const u = QS.get('cu').split(',').map(Number); cam.position.set(u[0], u[1], u[2]); cam.up.set(0, 1, 0); cam.lookAt(u[3], u[4], u[5]); cam.fov = u[6] || 38; cam.aspect = c.W / c.H; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); }
    void cs; void landCamShake; void offM; void lerp; void smooth;
    const shx = s && (phase === 'flight' || phase === 'landed') ? clamp(phase === 'landed' ? s.landX : (s.b ? s.b.x : 0), 0, 70) : st.menu ? 1 : 2.5;
    Dd.shX = Dd.shX === undefined ? shx : Dd.shX + (shx - Dd.shX) * (dt > 0 ? 1 - Math.exp(-dt * 4) : 0);
    stage.setShadowTarget(Dd.shX, 0, 0);
    world.update(dt, cam.position);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    stage.stats.renders++;
    const mw = c.W, mh = c.H;
    GL.project = (x, y, z) => { V.tmp.set(x, y, z).project(cam); return [(V.tmp.x + 1) / 2 * mw, (1 - V.tmp.y) / 2 * mh, V.tmp.z]; };
    perfTick(now);
  }
  P.frame = frame;

  // ---- the app icon: the thrower just let go, the boot tumbling away over the fair, rendered from this same scene -------------------------
  P.renderIcon = (opts = {}) => {
    const size = opts.size || 2048;
    P.freeze = true;
    world.setLook(opts.look ?? 2); world.setSector(14); world.setWind(2.5, 0.3, 3.2);
    const k = world.cur.keyPos; stage._shadowOffset.set(k[0] * 18, k[1] * 18, k[2] * 18);
    useBoot(opts.boot ?? 0);
    const h = THR.h, th = THR.t, phi = opts.phi ?? 1.75;
    Dd.phi = phi;
    th.scrub(phi);
    const hp = holdPoints(phi, phi);
    const sol = V3.solvePalmBall(h, 'R', new THREE.Vector3(hp.fist[0], hp.fist[1], hp.fist[2]), new THREE.Vector3(0, 0, -1), new THREE.Vector3(Math.sin(phi), -Math.cos(phi), 0), 0);
    const sh = h.bonePosition('R_UpperArm', new THREE.Vector3());
    h.setReach('R', sol.wrist, { weight: 1, pole: { x: sh.x - 0.1, y: sh.y - 0.15, z: sh.z + 0.7 }, quat: sol.quat });
    h.setFingers('R', 'open');
    h.lookAt(new THREE.Vector3(3.0, 2.0, 0.3), { weight: 1 });
    for (let i = 0; i < 6; i++) stage.update(0.05, { renderNow: false });
    if (THR.dress && THR.dress.update) THR.dress.update();
    // the boot, a little way ahead of the open hand, tumbling
    const bp = opts.bootPos || [hp.fist[0] + 0.75, hp.fist[1] + 0.5, 0.55], ang = opts.bootAng ?? 0.6;
    const sc = BOOT_SCALE[bootIdx] || 1, r = [BOOT_COM[0] * sc * Math.cos(ang) - BOOT_COM[1] * sc * Math.sin(ang), BOOT_COM[0] * sc * Math.sin(ang) + BOOT_COM[1] * sc * Math.cos(ang)];
    bootMesh.visible = true; bootMesh.rotation.set(0.12, 0, ang); bootMesh.position.set(bp[0] - r[0], bp[1] - r[1], bp[2]);
    bootMesh.scale.setScalar(sc * 1.25);
    fx.spray(0, bp[0], bp[1], bp[2], 1.5, 0.4, 0.2, 14, 0.026, 3, 5);
    fx.update(0.22);
    shadowBlob.material.opacity = 0;
    const cp = opts.cam || [2.6, 1.05, 3.2, 1.25, 1.55, 0.2, 40];
    cam.position.set(cp[0], cp[1], cp[2]); cam.up.set(0, 1, 0); cam.lookAt(cp[3], cp[4], cp[5]); cam.fov = cp[6]; cam.aspect = 1; cam.near = 0.2; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    stage.setShadowTarget(0.8, 0, 0);
    world.update(0.016, cam.position);
    renderer.setPixelRatio(1); renderer.setSize(size, size, false);
    renderer.toneMappingExposure = opts.exposure ?? 1.0;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, size, size); renderer.clear(true, true, true);
    renderer.render(scene, cam);
    window.__icon = () => renderer.domElement.toDataURL('image/png');
    doc.title = 'ready';
    return true;
  };

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; GL.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  // the 2D layer renders first (collecting the view it wants), then this layer draws it
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { GL.views.length = 0; r(ctx, view); if (P.freeze) return; frame(); };
    return game;
  };
  return P;
}
