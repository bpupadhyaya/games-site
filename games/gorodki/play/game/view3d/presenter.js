// 3D presenter for Gorodki. It only READS the game state (the town, the bat, the turn, the wind-up) and draws the winter village, the
// packed-snow court, the wooden pins, the bat, the thrower and the onlookers behind the transparent kit canvas. The kit canvas keeps
// the HUD, the aim guides, the effect rings, the menus and the input. Both layers use ONE camera: the same pinhole the 2D layer
// uses (view.js makeCam), expressed here as the projection matrix of the WebGL camera, so every 2D mark lands on the pixel it belongs
// to. Without WebGL2, with ?nogl, or when the context is lost, the 2D art plays and the 3D layer takes over again when it is back.
import { meta } from '../src/game.js';
import { GL } from '../src/glbridge.js';
import { WIND_T } from '../src/sim.js';
import { buildWorld, PIN_H, PIN_RAD, BAT_LEN, BAT_RAD, Z3 } from './world.js';
import { Thrower, STYLE_INDEX, WIND_DUR, FOLLOW_DUR } from './actors.js';
import { dressWinter } from './gear.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
export const FIG = { x: -0.3, z: -4.0 };   // where the thrower stands (sim coordinates; the bat is thrown from his hand)
const QS = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
const ICON = QS.has('icon');              // QA / icon art: ?icon=1&shot=1 draws the hero picture without any 2D layer
const STYLE_ACROSS = { sweep: true, drive: false, smash: false };

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
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const shotMode = QS.has('shot');
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 6.5, preserveDrawingBuffer: shotMode }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera, key = stage.lights.key;
  renderer.autoClear = false;
  renderer.setClearColor(0xcfd9e4, 1);
  cam.near = 0.3; cam.far = 420;

  // ---- light: a low, cold winter sun behind the town, soft sky fill, bright snow bounce ---------------------------------------------------------
  stage.setLighting('day', { sky: 0xcfd9e4, fog: 0xdfe7ee, hemiSky: 0x4f7be8, hemiGround: 0xffb878, hemi: 0.8, key: 0xff8f30, keyI: 4.4, rim: 0x6a98ff, rimI: 1.5, exposure: 0.88 });
  stage.setSky(null, null);
  stage._shadowOffset.set(-6.0, 8.5, -4.0);   // low golden sun: long cold-blue shadows toward the camera
  stage.lights.rim.position.set(5, 4, 7);
  if (renderer.shadowMap.enabled) { const sc = key.shadow.camera; sc.left = -6.5; sc.right = 6.5; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix(); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 4; }
  stage.setShadowTarget(0, 0, 0.5);

  const world = buildWorld(V3, stage, { quality, THREE });
  if (quality === 'low' && stage.enableBlobShadows) stage.enableBlobShadows(12, { radius: 0.35, opacity: 0.6 });

  const P = { stage, THREE, world, ready: false, lost: false, quality, licenses: '' };
  stage.onContextLost(() => { P.lost = true; GL.on = false; });
  stage.onContextRestored(() => { P.lost = false; P.cw = 0; stage.resize(); stage.invalidate(); });

  // ---- the people ---------------------------------------------------------------------------------------------------------------------------
  const throwers = {};                    // m, f
  let crowd = null;
  const batHandM = world.makeBat(), batHandF = world.makeBat();
  { const gr = QS.get('grip') ? QS.get('grip').split(',').map(Number) : [0, 0, -1.05];   // the bat's attitude in the fist (QA: ?grip=rx,ry,rz)
    for (const b of [batHandM, batHandF]) { const m = b.children[0]; m.rotation.set(gr[0], gr[1], gr[2]); } }
  async function build() {
    const mk = (spec) => loadHuman({ ...spec, lod: 'auto', quality });
    const [m, f] = await Promise.all([
      mk({ character: 'athlete_m', kit: { top: '#2f4a7a', bottoms: '#2a2d36', socks: '#cfc9b8' }, skin: 'light', hair: 'brown' }),
      mk({ character: 'athlete_f', kit: { top: '#8a2f3c', bottoms: '#2a2d36', socks: '#cfc9b8' }, skin: 'light', hair: 'ginger' }),
    ]);
    for (const [id, h, look, bat] of [['m', m, { jacket: '#2f4a7a', scarf: '#b5342c', mitt: '#7a2a24' }, batHandM], ['f', f, { jacket: '#8a2f3c', scarf: '#e8d9a0', mitt: '#2f4a7a', fur: '#e6dccb' }, batHandF]]) {
      h.groundClamp = 'auto'; h.footPlanting = !QS.has('nofp');
      stage.add(h); stage.track(h);
      h.setLOD(0);
      h.root.visible = false;
      if (!QS.has('nogear')) dressWinter(V3, h, look);
      throwers[id] = new Thrower(V3, h, bat);
    }
    // onlookers: instanced cold-weather people in two rows behind the far board and along the sides
    try {
      crowd = V3.createCrowd3d(stage, {
        rows: [
          { from: [-3.0, 0, -5.4], to: [3.0, 0, -5.4], count: 7, face: 0 },
          { from: [-3.0, 0, -6.5], to: [3.0, 0, -6.5], count: 7, face: 0 },
          { from: [-3.4, 0, -2.0], to: [-3.4, 0, 1.0], count: 3, face: [0, 0, 0] },
          { from: [3.4, 0, -2.0], to: [3.4, 0, 1.0], count: 3, face: [0, 0, 0] },
        ],
        seed: 12, culture: 'european_village', quality: quality === 'high' ? 'high' : 'medium', cold: true, excitement: 0.15, viewportHeight: 800,
      });
    } catch (e) { console.warn('crowd unavailable', e); crowd = null; }
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- adaptive quality: if frames take too long, drop shadows and then resolution --------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 26 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) renderer.shadowMap.enabled = false;
        else renderer.setPixelRatio(perfLevel === 2 ? Math.min(1.25, renderer.getPixelRatio()) : 1);
        stage.scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- the 2D pinhole as the WebGL camera -------------------------------------------------------------------------------------------------------
  // 2D: screen x = cx + F x / d, screen y = cy - F up / d (virtual units); here the same in css px through the letterbox offset and scale.
  const lookAt = new THREE.Vector3();
  const CU = QS.get('cu') ? QS.get('cu').split(',').map(Number) : null;   // QA only: ?cu=px,py,pz,tx,ty,tz[,fov] free camera for close-ups
  function setCamera(c, cw, ch, kU, offX, offY) {
    if (CU) {
      cam.position.set(CU[0], CU[1], CU[2]); cam.lookAt(CU[3], CU[4], CU[5]); cam.fov = CU[6] || 30; cam.aspect = cw / ch; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); return;
    }
    const { H, Z, pitch } = c.pose;
    cam.position.set(0, H, -Z);
    lookAt.set(0, H - Math.sin(pitch), -Z - Math.cos(pitch));
    cam.up.set(0, 1, 0);
    cam.lookAt(lookAt);
    cam.updateMatrixWorld(true);
    const A = 2 * kU * c.F / cw, Bx = 2 * (offX + kU * c.cx) / cw - 1;
    const Ay = 2 * kU * c.F / ch, By = 1 - 2 * (offY + kU * c.cy) / ch;
    const n = cam.near, f = cam.far;
    cam.projectionMatrix.set(
      A, 0, -Bx, 0,
      0, Ay, -By, 0,
      0, 0, -(f + n) / (f - n), -2 * f * n / (f - n),
      0, 0, -1, 0,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // ---- pins -------------------------------------------------------------------------------------------------------------------------------------
  const pinLayer = new THREE.Group(); stage.scene.add(pinLayer);
  const pinViews = [];          // { g (yaw group), m (mesh), x, z, ang, fall, phi, lie, out0, sc }
  let pinsFor = null;
  function syncPins(w, t, dt) {
    if (pinsFor !== w) {
      pinsFor = w;
      while (pinViews.length > w.pins.length) { const v = pinViews.pop(); pinLayer.remove(v.g); }
      while (pinViews.length < w.pins.length) {
        const g = new THREE.Group(), m = world.makePin(0);
        g.add(m); pinLayer.add(g);
        pinViews.push({ g, m, x: 0, z: 0, ang: 0, fall: 0, phi: 0, lie: false, out0: -1, sc: 1 });
      }
      w.pins.forEach((p, i) => { const v = pinViews[i]; v.m.material = world.pinMats[p.id % world.pinMats.length]; v.x = p.x; v.z = p.z; v.ang = p.ang; v.fall = p.st === 'stand' ? 0 : 1; v.phi = 0; v.lie = p.st !== 'stand'; v.out0 = -1; v.sc = 1; v.g.visible = true; });
    }
    const k = dt > 0 ? 1 - Math.exp(-dt * 38) : 1;
    w.pins.forEach((p, i) => {
      const v = pinViews[i];
      v.x += (p.x - v.x) * k; v.z += (p.z - v.z) * k;
      const speed = Math.hypot(p.vx, p.vz);
      const lying = p.st !== 'stand';
      if (lying && !v.lie) { v.lie = true; v.fall = 0; v.phi = 0; }
      if (!lying) { v.lie = false; v.fall = 0; v.phi = 0; }
      if (lying) v.fall = Math.min(1, v.fall + dt / 0.24);
      // the fall: ease out with a little overshoot; a pin that flies along spins end over end, then settles flat
      const f = v.fall, tilt = lying ? (Math.PI / 2) * (f < 1 ? 1 - Math.pow(1 - f, 2.4) + Math.sin(f * Math.PI) * 0.12 : 1) : 0;
      if (lying) {
        if (speed > 1.0) v.phi += speed * dt * 7.5;
        else { const tgt = Math.round(v.phi / Math.PI) * Math.PI; v.phi += (tgt - v.phi) * (dt > 0 ? 1 - Math.exp(-dt * 12) : 0); }
      }
      let da = p.ang - v.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      v.ang += da * (dt > 0 ? 1 - Math.exp(-dt * 30) : 1);
      const a = tilt + v.phi;
      const half = (PIN_H / 2) * Math.abs(Math.cos(a)) + PIN_RAD * Math.abs(Math.sin(a));
      const air = lying ? clamp((speed - 1.2) * 0.045, 0, 0.26) * Math.abs(Math.sin(v.phi * 0.9 + 0.7)) : 0;
      const bounce = lying && v.fall < 1 ? Math.sin(Math.min(1, v.fall * 1.6) * Math.PI) * 0.035 : 0;
      v.g.position.set(v.x, half + air + bounce, Z3(v.z));
      v.g.rotation.y = lying ? v.ang : 0;
      v.m.rotation.z = -a;
      // a pin that is out of the square is gathered up: it shrinks away after a moment
      if (p.out) { if (v.out0 < 0) v.out0 = t; v.sc = clamp(1 - (t - v.out0 - 0.9) / 0.5, 0, 1); } else { v.out0 = -1; v.sc = 1; }
      v.g.scale.setScalar(Math.max(0.001, v.sc));
      v.g.visible = v.sc > 0.01;
    });
  }

  // ---- the bat in flight and at rest: fl > yawG > pivot > axisG > mesh (the mesh is centred on the pivot) -----------------------------------
  const fl = new THREE.Group(), yawG = new THREE.Group(), pivot = new THREE.Group(), axisG = new THREE.Group();
  const flyMesh = world.makeBat().children[0]; flyMesh.position.set(0, -BAT_LEN / 2, 0);
  axisG.add(flyMesh); pivot.add(axisG); yawG.add(pivot); fl.add(yawG); fl.visible = false; stage.scene.add(fl);
  const D = { lastT: null, lastWall: null, yaw: Math.PI, sinceRel: 99, holding: true, handPos: new THREE.Vector3(FIG.x + 0.2, 1.0, Z3(FIG.z) - 0.2), flyStart: null, flyFor: null, batW: null, batSeen: false, outFor: '' };
  function syncBat(w, holding) {
    const b = w.bat;
    if (b) {
      fl.visible = true; D.batW = w; D.batSeen = true;
      if (b.mode === 'fly') {
        const u = clamp(b.t / b.T, 0, 1);
        if (D.flyFor !== b) { D.flyStart = D.handPos.clone(); D.flyFor = b; }
        const s0 = D.flyStart;
        fl.position.set(s0.x + (b.lx - s0.x) * u, s0.y + (BAT_RAD - s0.y) * u + 4 * u * (1 - u) * 1.15, s0.z + (Z3(b.lz) - s0.z) * u);
        yawG.rotation.y = Math.atan2(b.dirz, b.dirx);
        const turns = Math.max(1, Math.round(22 * b.T / TAU)), phi = TAU * turns * u;
        if (STYLE_ACROSS[b.style]) { axisG.rotation.set(Math.PI / 2, 0, 0); pivot.rotation.set(phi, 0, 0); }
        else { axisG.rotation.set(0, 0, -Math.PI / 2); pivot.rotation.set(0, 0, -phi); }
      } else {
        fl.position.set(b.x, BAT_RAD, Z3(b.z));
        yawG.rotation.y = b.th; pivot.rotation.set(0, 0, 0); axisG.rotation.set(0, 0, -Math.PI / 2);
      }
    } else if (D.batSeen && D.batW === w && !holding) {
      fl.visible = true;      // the bat lies where it stopped until the thrower picks up the next one
    } else { fl.visible = false; D.flyFor = null; if (D.batW !== w) D.batSeen = false; }
  }

  // ---- the thrower: choose clip and facing from the state ---------------------------------------------------------------------------------------
  function directThrower(st, dt, w) {
    const play = st.scene === 'play' && st.turn && st.w;
    const att = play ? null : st.att;
    const who = play ? st.turn.who : 'attract';
    const id = who === 'you' || who === 'attract' ? 'm' : (String(who).length % 2 ? 'f' : 'm');
    const O = throwers[id === 'm' ? 'f' : 'm'];
    if (O && O.h.root.visible) { O.h.root.visible = false; O.setHolding(false); }
    const T = throwers[id], h = T.h;
    h.root.visible = true;
    h.setPosition(FIG.x, 0, Z3(FIG.z));
    let ph = 'aim', pend = null, tw = 0;
    if (play) { ph = st.turn.ph; pend = st.turn.pend; tw = st.turn.t; }
    else if (att && att.pend) { ph = 'wind'; pend = att.pend; tw = att.windT; }
    const style = pend ? pend.style : play ? st.aim.style : 'drive';
    const aimX = pend ? pend.x : play ? st.aim.x : 0, aimZ = pend ? pend.z : play ? st.aim.z : 1;
    const yaw = Math.atan2(aimX - FIG.x, -(aimZ - FIG.z));
    D.yaw += (yaw - D.yaw) * (dt > 0 ? 1 - Math.exp(-dt * 7) : 1);
    h.setFacing(D.yaw);
    const idx = STYLE_INDEX[style] ?? 0;
    // clip time since the throw began: the sim's wind-up clock, then our own clock for the follow-through
    let clipT = -1;
    if (ph === 'wind') { clipT = tw; D.sinceRel = 0; }
    else if (D.sinceRel < 90) { D.sinceRel += dt; clipT = WIND_DUR + D.sinceRel; }   // the follow-through always plays out, even if the next turn has begun
    const dur = WIND_DUR + FOLLOW_DUR;
    if (clipT >= dur) D.sinceRel = 99;
    if (clipT >= 0 && clipT < dur) {
      const name = T.throwClips[idx];
      if (T.mode !== name) { h.play(name, { fade: 0.22, loop: false }); T.mode = name; }
      const tr = h.layers.base.current;
      if (tr && tr.clip && tr.clip.name === name) { tr.speed = 0; tr.time = clamp(clipT, 0, dur - 1e-3); }
    } else if (T.mode !== 'idle') { h.play('idle_relaxed', { fade: 0.35 }); T.mode = 'idle'; }
    else h.ensure('idle_relaxed', { fade: 0.3 });
    // the bat is in the hand until it leaves it; a fresh one is picked up for the next throw
    const afterRelease = (ph === 'wind' && tw >= WIND_T) || !!w.bat || (D.sinceRel < 90 && ph !== 'wind') ;
    T.setHolding(!afterRelease);
    D.holding = !afterRelease;
    return T;
  }

  // ---- one frame -----------------------------------------------------------------------------------------------------------------------------------
  function frame() {
    if (!P.ready || P.lost || P.off) { GL.on = false; stage.setVisible(false); return; }
    const views = GL.views, st = GL.state;
    if (!views.length || !st) { GL.on = true; stage.setVisible(false); return; }
    GL.on = true;
    const v = views[0], S = v.S, c = v.cam, w = S.w;
    const now = globalThis.performance.now();
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    const kU = meta.cssPerUnit || cw / meta.width;
    const offX = (cw - meta.width * kU) / 2, offY = (ch - meta.height * kU) / 2;
    stage.setVisible(true);
    // the game's clock (it stops with the pause menu and with Watch & Learn's pause); the ambient scenery uses the wall clock
    const t = st.t;
    let dt = D.lastT === null ? 0 : t - D.lastT; D.lastT = t;
    if (P.manualDt != null) dt = P.manualDt;   // QA: fixed step for the smoothness gate
    dt = clamp(dt, 0, 0.1);
    const wall = D.lastWall === null ? 0 : clamp((now - D.lastWall) / 1000, 0, 0.1); D.lastWall = now;
    setCamera(c, cw, ch, kU, offX, offY);
    syncPins(w, t, dt);
    const T = directThrower(st, dt, w);
    stage.update(dt > 0 ? dt : wall, { renderNow: false });   // animation fades need time even while the game clock is frozen (pause)
    T.h.handPosition('R', D.handPos);
    syncBat(w, D.holding);
    // onlookers react when a throw has settled
    if (crowd) {
      if (!P.crowdGroup) P.crowdGroup = stage.scene.getObjectByName('crowd3d');
      if (P.crowdGroup) P.crowdGroup.visible = true;
      if (w.phase === 'done') { const key2 = `${w.throws}:${st.scene}`; if (D.outFor !== key2 && st.scene === 'play') { D.outFor = key2; crowd.react(w.outNow.length > 0 ? 'cheer' : 'groan', { origin: [0, 0, 0], radius: 40 }); } }
      crowd.update(wall);
    }
    P.clock = (P.clock || 0) + wall; if (world.update) world.update(wall, P.clock);
    if (world.scenery) world.scenery.update(wall, cam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    stage.setShadowTarget(0, 0, 0.5);
    renderer.render(stage.scene, cam);
    stage.stats.renders++;
    perfTick(now);
  }
  P.frame = frame;
  P.throwers = throwers; P.pinViews = pinViews; P.D = D;

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; GL.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  // the 2D layer renders first (collecting the views it wants), then this layer draws them
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { const keep = P.freeze ? GL.views.slice() : null; GL.views.length = 0; r(ctx, view); if (ICON) ctx.clearRect(0, 0, 1e5, 1e5); if (P.freeze) { if (!GL.views.length && keep) GL.views.push(...keep); return; } frame(); };   // P.freeze: QA gate drives frame() by hand
    return game;
  };
  return P;
}
