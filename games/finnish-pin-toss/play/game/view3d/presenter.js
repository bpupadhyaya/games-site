// 3D presenter for Finnish Pin Toss. It only READS the game state (the skittles, the pin, the turn, the pull) and draws the lakeside
// lawn, the numbered skittles, the pin and the thrower behind the transparent kit canvas. The kit canvas keeps the HUD, the aim guides,
// the rings, the menus and the input. Both layers use ONE camera: the same pinhole the 2D layer uses (art.js makeCam), expressed here as
// the projection matrix of the WebGL camera, so every 2D mark lands on the pixel it belongs to. Without WebGL2, with ?nogl, or when the
// context is lost, the 2D art plays and the 3D layer takes over again when it is back.
import { meta } from '../src/game.js';
import { GL } from '../src/glbridge.js';
import { HAND_Z, LINE_Y, SK_R, startSkittles } from '../src/sim.js';
import { buildWorld, Z3, M, SK_HM, SK_RM, PIN_RM } from './world.js';
import { loadThrower, dressSummer, P_WIND, P_REL, P_FOLLOW } from './actors.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const QS = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
const ICON = QS.has('icon');
const FIG_X = -0.62;      // the person stands this far to the left of the launch line, so the camera sees the bundle past his shoulder

// who is who: a look per rival (Aino, Jussi, Helmi, Eero) and two for people sharing the phone
const LOOKS = [
  { ch: 'athlete_f', skin: 'light', hair: 'blond', look: { top: '#c8473a', bottoms: '#6c7a58', hat: 'sunhat', hatColor: '#e9dcae', ribbon: '#c8473a', sleeves: null } },
  { ch: 'athlete_m', skin: 'light', hair: 'ginger', look: { top: '#eef1f2', bottoms: '#4d6240', hat: 'none', sleeves: null, trousers: false } },
  { ch: 'athlete_f', skin: 'light', hair: 'brown', look: { top: '#efc84c', bottoms: '#355a7c', hat: 'none', sleeves: null } },
  { ch: 'athlete_m', skin: 'light', hair: 'grey', look: { top: '#3c7e5c', bottoms: '#6b5a48', hat: 'none', sleeves: null, trousers: false } },
  { ch: 'athlete_m', skin: 'tan', hair: 'brown', look: { top: '#2f6db0', bottoms: '#3d4958', hat: 'none', sleeves: null, trousers: false } },
  { ch: 'athlete_f', skin: 'light', hair: 'black', look: { top: '#2f8f87', bottoms: '#4a5668', hat: 'none', sleeves: null } },
];

function pickQuality() {
  const m = QS.get('q'); if (m === 'low' || m === 'medium' || m === 'high') return m;
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const shotMode = QS.has('shot') || QS.has('icon');
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 3.6, preserveDrawingBuffer: shotMode }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera, key = stage.lights.key;
  renderer.autoClear = false;
  renderer.setClearColor(0xf2d9b4, 1);
  cam.near = 0.05; cam.far = 420;

  // ---- light: a low golden midsummer sun from the left behind the thrower, sky fill, warm rim from the lake --------------------------------
  stage.setLighting('day', { sky: 0xf0d8b0, fog: 0xf1dcb8, hemiSky: 0xbcd4ee, hemiGround: 0x9a8a4a, hemi: 0.95, key: 0xffe0a8, keyI: 3.3, rim: 0xffc890, rimI: 1.1, exposure: 0.95 });
  stage.setSky(null, null);
  stage._shadowOffset.set(-5.0, 6.6, 4.4);   // low sun: long shadows lean to the right and toward the lake
  stage.lights.rim.position.set(2, 3, -6);
  if (renderer.shadowMap.enabled) { const sc = key.shadow.camera; sc.left = -3.4; sc.right = 3.4; sc.top = 3.6; sc.bottom = -3.6; sc.near = 1; sc.far = 24; sc.updateProjectionMatrix(); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.012; key.shadow.radius = 3; }
  stage.setShadowTarget(0, 0, 1.0);

  const world = buildWorld(V3, stage, { quality, THREE });
  if (quality === 'low' && stage.enableBlobShadows) stage.enableBlobShadows(16, { radius: 0.12, opacity: 0.5 });

  const P = { stage, THREE, world, ready: false, lost: false, quality, licenses: '' };
  stage.onContextLost(() => { P.lost = true; GL.on = false; });
  stage.onContextRestored(() => { P.lost = false; P.cw = 0; stage.resize(); stage.invalidate(); });

  // ---- the skittles, the pin, effects -------------------------------------------------------------------------------------------------------
  const skLayer = new THREE.Group(); stage.scene.add(skLayer);
  const sk = [];     // index = number - 1 -> { g (placement group), m (mesh group), fall, lying, roll, a }
  for (let n = 1; n <= 12; n++) {
    const g = new THREE.Group(), m = world.makeSkittle(n);
    g.add(m); skLayer.add(g);
    sk.push({ g, m, fall: 0, lying: false, roll: 0, a: 0 });
  }
  const pinG = new THREE.Group(), pinM = world.makePin(); pinG.add(pinM); stage.scene.add(pinG); pinG.visible = false;
  const pinHand = world.makePin(); pinHand.visible = false;          // the pin in the thrower's fist (attached to the hand bone)
  const mkCanvasTex = (n, draw) => { const c = globalThis.document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); return new THREE.CanvasTexture(c); };
  const glowTex = mkCanvasTex(64, (g) => { const gr = g.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,90,0)'); gr.addColorStop(0.6, 'rgba(255,214,90,0.85)'); gr.addColorStop(1, 'rgba(255,214,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.006; glow.visible = false; stage.scene.add(glow);
  const POOL = 120, sprites = [];
  const chipTex = mkCanvasTex(32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const starTex = mkCanvasTex(64, (g) => { g.translate(32, 32); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = (i / 8) * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); });
  for (let i = 0; i < POOL; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: chipTex, transparent: true, depthWrite: false, opacity: 0, fog: false })); s.visible = false; stage.scene.add(s); sprites.push(s); }
  const parseCol = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c); if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] === undefined ? 1 : +m[4] }; const h = new THREE.Color(c); return { r: h.r, g: h.g, b: h.b, a: 1 }; };
  const rings = [];
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })); r.rotation.x = -Math.PI / 2; r.visible = false; stage.scene.add(r); rings.push(r); }

  // ---- people ---------------------------------------------------------------------------------------------------------------------------------
  const people = {};          // 'athlete_m' / 'athlete_f' -> thrower
  let crowd = null;
  async function build() {
    for (const ch of ['athlete_m', 'athlete_f']) {
      const A = await loadThrower(V3, { character: ch, kit: { top: '#2f6db0', bottoms: '#3d4958', socks: '#f2f2f2' }, skin: 'light', hair: 'brown' });
      stage.add(A.h); stage.track(A.h);
      A.h.root.visible = false; A.look = -1; A.gear = null;
      people[ch] = A;
    }
    // place each figure so that its right hand, at release, is at the sim's launch point (x 0, y = the line, height HAND_Z)
    for (const ch of Object.keys(people)) {
      const A = people[ch], h = A.h;
      h.setFacing(Math.PI); h.root.position.set(0, 0, 0);
      A.setP(P_REL); h.update(0); h.root.updateMatrixWorld(true);
      const v = new THREE.Vector3(); h.handPosition('R', v);
      A.off = { x: FIG_X - v.x, z: Z3(LINE_Y) - v.z };
      A.setP(0); h.update(0);
    }
    try {
      const pts = [], at = (x, z, tx, tz, seated = 0) => pts.push({ x, y: 0, z, yaw: Math.atan2(tx - x, tz - z), seated });
      at(2.5, 1.35, 0, 0, 1); at(3.0, 1.55, 0, 0, 1); at(-2.4, -1.5, 0, 0, 0); at(-1.95, -1.3, 0, 0, 0);
      if (quality !== 'low') { at(-3.9, 0.6, 0, 0, 0); at(3.6, -0.6, 0, 0, 0); }
      crowd = V3.createCrowd3d(stage, { points: pts, count: pts.length, seed: 12, culture: 'nordic', quality: quality === 'high' ? 'high' : 'medium', excitement: 0.12, props: { flag: 0, phone: 0.1, child: 0.0 }, viewportHeight: 800 });
    } catch (e) { console.warn('crowd unavailable', e); crowd = null; }
    // compile every material now (sprites, rings, the pin, both people) so the first throw does not hitch on a shader build
    try {
      const vis = [];
      stage.scene.traverse((o) => { if (o.isMesh || o.isSprite) { vis.push([o, o.visible]); o.visible = true; } });
      renderer.compile(stage.scene, cam);
      for (const [o, v] of vis) o.visible = v;
    } catch (e) { console.warn('warm-up skipped', e); }
    P.ready = true; stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });
  const lookFor = (st) => {
    if (st.scene === 'play' && st.m) {
      const p = st.m.players[st.m.turn];
      if (p.ai >= 0 && p.ai < 4) return p.ai;
      return p.name === 'You' ? 4 : 4 + (p.id % 2);
    }
    return 4;
  };
  const isPlay = (st) => st.scene === 'play' && !!st.m;

  // ---- adaptive quality ----------------------------------------------------------------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 26 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) { renderer.shadowMap.enabled = false; stage.lights.key.castShadow = false; }
        else renderer.setPixelRatio(perfLevel === 2 ? Math.min(1.25, renderer.getPixelRatio()) : 1);
        stage.scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- the 2D pinhole as the WebGL camera --------------------------------------------------------------------------------------------------------
  const CU = QS.get('cu') ? QS.get('cu').split(',').map(Number) : null;   // QA only: ?cu=px,py,pz,tx,ty,tz[,fov] free camera for close-ups
  const fwd = new THREE.Vector3(), lookAt = new THREE.Vector3();
  function setCamera(view, cw, ch, kU, offX, offY) {
    if (CU) { cam.position.set(CU[0], CU[1], CU[2]); cam.lookAt(CU[3], CU[4], CU[5]); cam.fov = CU[6] || 30; cam.aspect = cw / ch; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); return; }
    const c = view.cam, ps = c.pose;
    const cp = Math.cos(ps.pitch), sp = Math.sin(ps.pitch);
    const Cy = ps.y - ps.dist * cp, Cz = ps.dist * sp;
    cam.position.set(M(ps.x), M(Cz), -M(Cy));
    fwd.set(0, -sp, -cp);
    lookAt.copy(cam.position).add(fwd);
    cam.up.set(0, 1, 0); cam.lookAt(lookAt); cam.updateMatrixWorld(true);
    const A = 2 * kU * c.f / cw, Bx = 2 * (offX + kU * c.ax) / cw - 1;
    const Ay = 2 * kU * c.f / ch, By = 1 - 2 * (offY + kU * c.ay) / ch;
    const n = cam.near, f = cam.far;
    cam.projectionMatrix.set(
      A, 0, -Bx, 0,
      0, Ay, -By, 0,
      0, 0, -(f + n) / (f - n), -2 * f * n / (f - n),
      0, 0, -1, 0,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // ---- skittles ---------------------------------------------------------------------------------------------------------------------------------------
  const D = { lastT: null, lastWall: null, p: 0, pStart: null, sinceRel: 99, relSeen: null, yaw: Math.PI, who: -1, holding: true, holder: null, handPos: new THREE.Vector3(), flyStart: null, flyFor: null, clock: 0, reactFor: null };
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), RX = new THREE.Vector3(1, 0, 0);
  function syncSkittles(S, dt) {
    const items = new Map();
    if (S.bodies) { for (const b of S.bodies) if (b.kind === 0) items.set(b.num, b); }
    else if (S.sk) { for (const s of S.sk) items.set(s.num, { num: s.num, x: s.x, y: s.y, st: 0, a: 0, vx: 0, vy: 0, w: 0 }); }
    const rise = S.rise || [];
    for (let n = 1; n <= 12; n++) {
      const v = sk[n - 1], b = items.get(n);
      if (!b) { v.g.visible = false; continue; }
      v.g.visible = true;
      const lying = b.st === 1;
      if (lying && !v.lying) { v.lying = true; v.fall = 0; v.roll = 0; }
      if (!lying) { v.lying = false; v.fall = 0; }
      if (lying) v.fall = Math.min(1, v.fall + dt / 0.22);
      const speed = Math.hypot(b.vx || 0, b.vy || 0);
      if (!lying) {
        let hop = 0;
        const r = rise.find((q) => q.num === n);
        if (r) hop = 0.07 * Math.sin(Math.min(1, r.t / 0.45) * Math.PI);
        v.g.position.set(M(b.x), SK_HM / 2 + hop, Z3(b.y));
        v.g.quaternion.identity(); v.m.quaternion.identity();
      } else {
        // a toppled skittle: the cut end leads along the push direction a; the fall eases with a small overshoot, then it rolls with its speed
        const f = v.fall, tilt = (Math.PI / 2) * (f < 1 ? 1 - Math.pow(1 - f, 2.2) + Math.sin(f * Math.PI) * 0.1 : 1);
        if (f >= 1) v.roll += speed * dt / SK_R * 0.5;
        const half = (SK_HM / 2) * Math.cos(tilt) + SK_RM * Math.sin(tilt);
        const bounce = f < 1 ? Math.sin(Math.min(1, f * 1.5) * Math.PI) * 0.012 : 0;
        v.g.position.set(M(b.x), half + bounce, Z3(b.y));
        const dirx = Math.cos(b.a), dirz = -Math.sin(b.a);
        q1.setFromAxisAngle(UP, Math.atan2(dirx, dirz));       // local +z -> the fall direction
        q2.setFromAxisAngle(RX, tilt);                           // tip over: local +y swings toward +z
        v.g.quaternion.copy(q1).multiply(q2);
        q2.setFromAxisAngle(UP, v.roll); v.m.quaternion.copy(q2);
      }
    }
  }

  // ---- the thrower: pose from the pull, the swing, the release -----------------------------------------------------------------------------------
  function throwerFrame(st, dt) {
    const play = isPlay(st);
    const act = play ? st.act : (st.att && st.att.th ? st.att : null);
    const lk = lookFor(st), spec = LOOKS[lk];
    const A = people[spec.ch], O = people[spec.ch === 'athlete_m' ? 'athlete_f' : 'athlete_m'];
    if (!A || !O) return null;
    if (O.h.root.visible) O.h.root.visible = false;
    if (A.look !== lk) { if (A.gear) A.gear.remove(); A.gear = dressSummer(V3, A.h, spec.look); A.h.setSkin(spec.skin); A.h.setHair(spec.hair); A.look = lk; }
    A.h.root.visible = true;
    if (D.who !== lk) { D.who = lk; D.sinceRel = 99; D.p = 0; D.pStart = null; D.relSeen = null; }
    // aim direction (radians from straight ahead, + = toward +x)
    let psi = 0;
    if (play && st.aim && st.humanTurn) psi = Math.atan2(st.aim.x, st.aim.y - LINE_Y);
    else if (play && st.hint) psi = Math.atan2(st.hint.tx, st.hint.ty - LINE_Y);
    else if (act && act.th) psi = Math.atan2(act.th.f.x, act.th.f.y - LINE_Y);
    const yaw = Math.PI - psi;
    D.yaw += (yaw - D.yaw) * (dt > 0 ? 1 - Math.exp(-dt * 7) : 1);
    A.h.setFacing(D.yaw);
    A.h.root.position.set(A.off.x + (play ? 0 : 0.24), 0, A.off.z);   // play: the person stands further left so the skittles dominate; the menu backdrop keeps him in view
    // progress p
    let p = D.p;
    if (act && !act.released && act.wind > 0) {
      if (D.pStart === null) D.pStart = D.p;
      const e = act.windTot - act.wind, ant = act.ant || 0;
      if (e < ant) p = lerp(D.pStart, P_WIND, ss(clamp(e / Math.max(1e-3, ant), 0, 1)));
      else { const u = clamp((e - ant) / Math.max(1e-3, act.windTot - ant), 0, 1); const p0 = ant > 0 ? P_WIND : D.pStart; p = lerp(p0, P_REL, Math.pow(u, 1.7)); }
      D.sinceRel = 0; D.holding = true;
    } else if (act && act.released && D.relSeen !== act) {
      D.relSeen = act; D.sinceRel = 0; D.pStart = null; p = P_REL; D.holding = false;
    } else if (D.sinceRel < 90) {
      D.sinceRel += dt;
      const s = D.sinceRel;
      if (s < 0.3) p = lerp(P_REL, P_FOLLOW, 1 - Math.pow(1 - s / 0.3, 2));
      else if (s < 1.35) p = lerp(P_FOLLOW, 0, ss((s - 0.3) / 1.05));
      else { p = 0; D.sinceRel = 99; }
      D.holding = false;
    } else {
      // standing ready: while pulling the arm follows the pull; otherwise a slow breath
      D.pStart = null;
      let tgt = 0.012 + 0.01 * Math.sin(D.clock * 1.3);
      if (play && st.pull && st.humanTurn) tgt = P_WIND * clamp((st.pull.v - 270) / 740, 0, 1) * 0.95 + tgt * 0.3;
      p = D.p + (tgt - D.p) * (dt > 0 ? 1 - Math.exp(-dt * 12) : 1);
      D.holding = true;
    }
    D.p = p;
    A.setP(p);
    return { A, act };
  }

  // ---- the icon picture (?icon=1): a fixed hero scene, no game state ------------------------------------------------------------------------------
  const iq = (k, d) => (QS.has(k) ? Number(QS.get(k)) : d);
  function iconFrame() {
    const cw = kitCanvas.clientWidth || 1024, ch = kitCanvas.clientHeight || 1024;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    stage.setVisible(true);
    cam.fov = iq('fov', 36); cam.aspect = cw / ch;
    cam.position.set(iq('cx', 1.0), iq('cy', 1.05), iq('cz', 5.0));
    cam.lookAt(iq('tx', -0.1), iq('ty', 0.8), iq('tz', -1.0));
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // a bundle just hit: five skittles down, the rest standing
    const down = { 5: [-0.9, 1.3, 14], 9: [0.4, 1.9, 17], 12: [0.1, 1.6, 8], 6: [-0.2, 1.1, 3.4], 4: [0.2, 1.2, 3.0] };
    const bodies = startSkittles().map((s) => {
      const d = down[s.num];
      return d ? { kind: 0, num: s.num, st: 1, x: s.x + d[2] * 0.4, y: s.y - d[2] * 0.2, a: Math.atan2(-d[1], d[0]), vx: 0, vy: 0 } : { kind: 0, num: s.num, st: 0, x: s.x, y: s.y, a: 0, vx: 0, vy: 0 };
    });
    for (const v of sk) v.fall = 1;
    syncSkittles({ bodies, rise: [] }, 1);
    for (const v of sk) v.fall = 1;
    // the pin in the air, tumbling toward the bundle
    pinG.visible = true; pinHand.visible = false;
    pinG.position.set(iq('px', -0.12), iq('py', 0.62), iq('pz', 2.3));
    pinG.scale.setScalar(1.3);
    v2.set(0.2, 0.45, -0.85).normalize(); pinG.quaternion.setFromUnitVectors(UP, v2); pinM.quaternion.setFromAxisAngle(UP, 0.8);
    // the thrower at the release, behind the line
    const A = people.athlete_f, h = A.h;
    if (A.look !== 0) { if (A.gear) A.gear.remove(); A.gear = dressSummer(V3, h, LOOKS[0].look); h.setSkin('light'); h.setHair('blond'); A.look = 0; }
    h.root.visible = true; people.athlete_m.h.root.visible = false;
    h.setFacing(Math.PI - 0.0); h.root.position.set(A.off.x + 0.38, 0, A.off.z); A.setP(iq('p', 0.66));
    stage.update(0.0001, { renderNow: false });
    h.root.updateMatrixWorld(true);
    if (crowd) { const g = stage.scene.getObjectByName('crowd3d'); if (g) g.visible = false; }
    world.update(0, 3.0);
    if (world.scenery) world.scenery.update(0, cam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, cw, ch); renderer.clear(true, true, true);
    stage.setShadowTarget(0, 0, 1.2);
    renderer.render(stage.scene, cam);
    stage.stats.renders++;
  }

  // ---- one frame -----------------------------------------------------------------------------------------------------------------------------------
  function frame() {
    if (!P.ready || P.lost || P.off) { GL.on = false; stage.setVisible(false); return; }
    if (ICON) { GL.on = true; iconFrame(); return; }
    const views = GL.views, st = GL.state;
    if (!views.length || !st) { GL.on = true; stage.setVisible(false); return; }
    GL.on = true;
    const v = views[0], S = v.S;
    const now = globalThis.performance.now();
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    const kU = meta.cssPerUnit || cw / meta.width;
    const offX = (cw - meta.width * kU) / 2, offY = (ch - meta.height * kU) / 2;
    stage.setVisible(true);
    const tt = st.t;
    let dt = D.lastT === null ? 0 : tt - D.lastT; D.lastT = tt;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);
    const wall = D.lastWall === null ? 0 : clamp((now - D.lastWall) / 1000, 0, 0.1); D.lastWall = now;
    D.clock += wall;
    setCamera(v, cw, ch, kU, offX, offY);
    syncSkittles(S, dt > 0 ? dt : 0);
    const th = throwerFrame(st, dt);
    stage.update(dt > 0 ? dt : wall, { renderNow: false });
    if (th) {
      const { A, act } = th, h = A.h;
      h.root.updateMatrixWorld(true);
      h.handPosition('R', D.handPos);
      const released = !!(act && act.released);
      // the pin: in the hand until it leaves, then flying (the sim's arc plus the offset between hand and launch point, fading out), then lying
      if (!released && D.holding) {
        if (D.holder !== h) { if (D.holder) D.holder.detach(pinHand); h.attach(pinHand, 'R', { pos: [0.0, -0.02, 0.05], quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI / 2)).toArray(), pose: 'ballGrip' }); D.holder = h; }
        pinHand.visible = true;
      } else pinHand.visible = false;
      let pinShown = false;
      if (released) {
        if (S.flying && S.flying.P) {
          const F = S.flying, u = clamp((act.th.t || 0) / Math.max(1e-3, act.th.tl || 1), 0, 1);
          if (D.flyFor !== act) { D.flyFor = act; D.flyStart = D.handPos.clone(); }
          const launch = v1.set(0, M(HAND_Z), Z3(LINE_Y));
          const k = 1 - ss(clamp(u * 1.6, 0, 1));
          pinG.position.set(M(F.P.x) + (D.flyStart.x - launch.x) * k, M(F.P.z) + (D.flyStart.y - launch.y) * k, Z3(F.P.y) + (D.flyStart.z - launch.z) * k);
          v2.set(F.axis.x, F.axis.z, -F.axis.y).normalize();
          pinG.quaternion.setFromUnitVectors(UP, v2);
          q2.setFromAxisAngle(UP, (act.th.t || 0) * 8); pinM.quaternion.copy(q2);
          pinG.visible = true; pinShown = true;
        } else if (S.bodies) {
          const pb = S.bodies.find((b) => b.kind === 1);
          if (pb) {
            pinG.position.set(M(pb.x), PIN_RM, Z3(pb.y));
            q1.setFromUnitVectors(UP, v2.set(Math.cos(pb.a), 0, -Math.sin(pb.a))); pinG.quaternion.copy(q1);
            pinM.quaternion.identity();
            pinG.visible = true; pinShown = true;
          }
        }
      } else D.flyFor = null;
      if (!pinShown) pinG.visible = false;
    }
    // highlight (the hint's / the rival's target skittle)
    if (S.glow && sk[S.glow - 1] && sk[S.glow - 1].g.visible) { const g = sk[S.glow - 1]; glow.visible = true; glow.position.x = g.g.position.x; glow.position.z = g.g.position.z; glow.scale.setScalar(1.2 * (0.8 + 0.2 * Math.sin(D.clock * 5)) + 0.3); } else glow.visible = false;
    // particles: chips, dust, sparkles and rings from the sim's effect list
    {
      let si = 0, ri = 0;
      for (const q of S.parts || []) {
        const k = 1 - q.t / q.max; if (k <= 0) continue;
        if (q.kind === 1) {
          if (ri < rings.length) { const r = rings[ri++]; r.visible = true; r.position.set(M(q.x), 0.01, Z3(q.y)); r.scale.setScalar(Math.max(0.02, M(q.size * (1 - k * k) + 2))); const c = parseCol(q.col); r.material.color.setRGB(c.r, c.g, c.b); r.material.opacity = Math.min(1, k * 1.4) * 0.8; }
          continue;
        }
        if (si >= POOL) break;
        const sp = sprites[si++], c = parseCol(q.col);
        sp.visible = true; sp.position.set(M(q.x), M(q.z || 2), Z3(q.y));
        sp.material.map = q.kind === 3 ? starTex : chipTex;
        sp.material.blending = q.kind === 3 ? THREE.AdditiveBlending : THREE.NormalBlending;
        sp.material.color.setRGB(c.r, c.g, c.b); sp.material.opacity = clamp(k * 1.4, 0, 1) * c.a;
        sp.scale.setScalar(Math.max(0.012, M(q.size * 2.4) * (0.5 + 0.5 * k)));
      }
      for (; si < POOL; si++) sprites[si].visible = false;
      for (; ri < rings.length; ri++) rings[ri].visible = false;
    }
    if (crowd) {
      if (!P.crowdGroup) P.crowdGroup = stage.scene.getObjectByName('crowd3d');
      if (P.crowdGroup) P.crowdGroup.visible = true;
      if (st.last && D.reactFor !== st.last) { D.reactFor = st.last; const r = st.last.res; if (r) crowd.react(r.kind === 'miss' ? 'groan' : (r.win ? 'ovation' : 'cheer'), { origin: [0, 0, 0], radius: 12, intensity: r.win ? 1 : 0.6 }); }
      crowd.update(wall);
    }
    world.update(wall, D.clock);
    if (world.scenery) world.scenery.update(wall, cam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    stage.setShadowTarget(0, 0, 1.0);
    renderer.render(stage.scene, cam);
    stage.stats.renders++;
    perfTick(now);
  }
  P.frame = frame;
  P.people = people; P.sk = sk; P.D = D;

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; GL.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { const keep = P.freeze ? GL.views.slice() : null; GL.views.length = 0; r(ctx, view); if (ICON) ctx.clearRect(0, 0, 1e5, 1e5); if (P.freeze) { if (!GL.views.length && keep) GL.views.push(...keep); return; } frame(); };
    return game;
  };
  return P;
}
