// 3D presenter for Glima: READS the simulation (game.getState(): scene, B = the round, pose = the spring numbers, looks, ring) and shows two
// real athletes in the traditional hold on a ring that stays still while the camera circles a little. It never writes back.
//   - the sim owns weight, stance, hooks, falls; the figures' poses are scrubbed to those numbers (weight rail -> weight shift, hook progress
//     -> the hooking foot swings to the rival's leg, fall -> a soft sit-down, joy -> arms up);
//   - hands sit on the rival's belt (right hand) and thigh loop (left hand) with IK, feet are planted with IK so nothing skates;
//   - it only draws inside the stage rectangle the game's layout gives it (portrait and landscape, any size); the HUD stays on the 2D canvas.
import { loadAthlete, scrub } from './athlete.js';
import { buildWorld, RING_R } from './world.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const TAU = Math.PI * 2;
// dev only: ?cam=distance,azimuth,elevation,targetY (degrees, metres) for close-up checks of the figures
const DEVCAM = (() => { try { const m = /[?&]cam=([-0-9.,]+)/.exec(globalThis.location.search); if (!m) return null; const [d, az, el, ty] = m[1].split(',').map(Number); return { d, az, el, ty: ty ?? 0.95 }; } catch { return null; } })();

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const touch = (nav.maxTouchPoints || 0) > 0 && !(globalThis.matchMedia && globalThis.matchMedia('(hover: hover) and (pointer: fine)').matches);
  if (nav.deviceMemory && nav.deviceMemory <= 2) return 'low';
  const weak = touch || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

// Character, kit colours and looks for the six LOOKS the game has (index = look id): [you, Aino, Birna, Eirik, Sigrun, Magnus]
const ATH = [
  { female: false, skin: 'tan', hair: 'brown' },
  { female: true, skin: 'light', hair: 'blond' },
  { female: true, skin: 'tan', hair: 'black' },
  { female: false, skin: 'light', hair: 'ginger' },
  { female: true, skin: 'brown', hair: 'black' },
  { female: false, skin: 'brown', hair: 'black' },
];
const KIT = [
  { top: '#27466f', bottoms: '#3a4658' }, { top: '#4f8a52', bottoms: '#3e4a3a' }, { top: '#b8452d', bottoms: '#3a3d4a' },
  { top: '#d29b2f', bottoms: '#4a3f30' }, { top: '#7a5aa6', bottoms: '#3d3850' }, { top: '#2f8a93', bottoms: '#2f4650' },
];

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready: false, on: false, p3: null };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 3.2 });
  if (!stage.supported) { canvas.remove(); return none; }
  stage.camera.near = 0.2; stage.camera.far = 150; stage.camera.fov = 30; stage.camera.updateProjectionMatrix();
  stage.setVisible(false);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const P = { stage, THREE, ready: false, lost: false, on: false, p3: null, quality, firstFrameMs: 0 };
  stage.onContextLost(() => { P.lost = true; P.on = false; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  stage._shadowOffset.set(-3.2, 6.5, 4.2);
  stage.lights.key.shadow.camera.far = 20;
  const world = buildWorld(V3, stage, { quality }); stage.add(world.root);
  P.world = world;
  const t0 = performance.now();

  // ---- the athletes: [near (you), far (rival)], male and female sets loaded in the background
  const sets = { m: null, f: null };
  const mk = async (female, slot) => {
    const L = ATH[slot === 0 ? 0 : 1];
    return loadAthlete(V3, { character: female ? 'athlete_f' : 'athlete_m', kit: { ...KIT[slot === 0 ? 0 : 1] }, skin: L.skin, hair: L.hair, lod: quality === 'low' ? 1 : 0, scale: female ? 1.0 : 1.0 });
  };
  const loadSet = async (female) => {
    const a = await mk(female, 0), b = await mk(female, 1);
    for (const x of [a, b]) { stage.add(x.h); stage.track(x.h); x.h.root.visible = false; }
    return [a, b];
  };
  P.loading = (async () => {
    sets.m = await loadSet(false);
    P.firstFrameMs = performance.now() - t0;
    P.ready = true; stage.invalidate();
    try { if (/[?&]dev=1/.test(globalThis.location.search)) console.info(`3d ready after ${Math.round(P.firstFrameMs)} ms, quality ${quality}`); } catch { /* ignore */ }
    try { sets.f = await loadSet(true); } catch (e) { console.warn('female set', e); }
  })().catch((e) => { console.warn('figures failed to load', e); });

  // ---- budget: the canvas fills the whole screen; on big screens the pixel ratio is lowered so the buffer stays about phone-sized
  const PIXELS = 2.2e6;
  let sizeKey = '', budgetR = 1, perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function sizeBudget(w, h) {
    const k = `${w}x${h}|${perfLevel}`;
    if (k !== sizeKey) {
      sizeKey = k; stage.resize();
      const cap = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1;
      const dpr = Math.min(globalThis.devicePixelRatio || 1, cap, perfLevel ? 1.25 : 2);
      budgetR = Math.max(1, Math.min(dpr, Math.sqrt(PIXELS / Math.max(1, w * h))));
    }
    if (Math.abs(stage.renderer.getPixelRatio() - budgetR) > 0.01) { stage.renderer.setPixelRatio(budgetR); stage.invalidate(); }
  }
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 26 && perfLevel < 2) {
        perfLevel++; sizeKey = ''; stage.invalidate();
        if (perfLevel === 2) { try { stage.setQuality('low'); } catch { /* ignore */ } }
      }
    }
  }

  // ---- per-athlete foot anchors (world metres) and small steps
  const ROOT_Z = [0.32, -0.32], YAW = [Math.PI, 0], TOWARD = [-1, 1];
  const FOOT_X = 0.2, FOOT_Z = 0.06, ANKLE = 0.09;
  const feet = [0, 1].map(() => ({ L: { sx: 0, sz: 0, lift: 0, t: 1 }, R: { sx: 0, sz: 0, lift: 0, t: 1 } }));
  const st = { cur: null, set: null, ring: '', key: '', settle: 0, lastNow: 0, tReal: 0, camAz: 0, camInit: false, seedStep: 0 };
  const ownSide = (i, s) => (i === 0 ? (s < 0 ? 'L' : 'R') : (s < 0 ? 'R' : 'L'));   // picture side -> the athlete's own foot
  const tmpQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion();
  const up = V(0, 1, 0);

  function footBase(i, s, root) { return { x: root.x + s * FOOT_X + feet[i][ownSide(i, s)].sx, z: ROOT_Z[i] + TOWARD[i] * FOOT_Z + feet[i][ownSide(i, s)].sz }; }

  function poseBoth(B, pose, dtp, watching) {
    const A = st.set;
    const roots = [];
    for (let i = 0; i < 2; i++) {
      const p = pose[i], sd = B.side[i];
      const fk = ease(clamp(p.fall, 0, 1));
      const shk = p.shake ? Math.sin(st.tReal * 55 + i * 2) * 0.012 * p.shake : 0;
      const bob = Math.sin(st.tReal * 1.7 + i) * 0.003;
      const x = shk + p.dir * 0.3 * fk;
      const z = ROOT_Z[i] + TOWARD[i] * 0.0;
      roots.push({ x, y: bob, z, fk });
      void sd;
    }
    for (let i = 0; i < 2; i++) {
      const a = A[i], h = a.h, p = pose[i], sd = B.side[i], j = 1 - i;
      const r = roots[i], fk = r.fk;
      // advance the footwork
      for (const side of ['L', 'R']) { const f = feet[i][side]; if (f.t < 1) { f.t = Math.min(1, f.t + dtp / 0.22); f.lift = Math.sin(f.t * Math.PI) * 0.045; } else f.lift = 0; }
      // root
      let rz = r.z + TOWARD[i] * (0.02 * ease(clamp(p.hp, 0, 1)) * (B.side[i].hook ? 1 : 0.5));
      h.setPosition(r.x, r.y, rz); h.setFacing(YAW[i]);
      // the clip: weight number 0..1 on the athlete's own left..right foot
      const w = clamp(sd.w, -1, 1);
      const u = i === 0 ? (w + 1) / 2 : (1 - w) / 2;
      if (fk > 0.02) scrub(h, 'gl_sit', clamp(fk, 0, 1), 0.1);
      else if (p.joy > 0.03) scrub(h, 'gl_cheer', clamp(p.joy, 0, 1), 0.1);
      else scrub(h, 'gl_stance', clamp(u, 0, 1), 0.1);
      // hands on the rival's belt (my right hand, his left hip) and thigh loop (my left hand, his right thigh)
      const rv = A[j].h;
      const yawI = YAW[i], yawJ = YAW[j];
      const leftI = V(Math.cos(yawI), 0, -Math.sin(yawI)), leftJ = V(Math.cos(yawJ), 0, -Math.sin(yawJ));
      const fwdJ = V(Math.sin(yawJ), 0, Math.cos(yawJ));
      const pelJ = rv.bones.Bip01_Pelvis.getWorldPosition(V());
      const grip = 1 - Math.max(fk, ease(clamp(pose[j].fall, 0, 1)) * 0.9, clamp(p.joy * 1.6, 0, 1));
      const handR = pelJ.clone().addScaledVector(leftJ, 0.17).addScaledVector(fwdJ, -0.02); handR.y += 0.115;
      const handL = pelJ.clone().addScaledVector(leftJ, -0.14).addScaledVector(fwdJ, 0.05); handL.y -= 0.1;
      const shoR = h.bones.Bip01_R_UpperArm.getWorldPosition(V()), shoL = h.bones.Bip01_L_UpperArm.getWorldPosition(V());
      const poleR = shoR.clone().addScaledVector(leftI, -0.5); poleR.y -= 0.3; poleR.addScaledVector(V(Math.sin(yawI), 0, Math.cos(yawI)), -0.15);
      const poleL = shoL.clone().addScaledVector(leftI, 0.5); poleL.y -= 0.3; poleL.addScaledVector(V(Math.sin(yawI), 0, Math.cos(yawI)), -0.15);
      h.setReach('R', handR, { weight: grip, pole: poleR });
      h.setReach('L', handL, { weight: grip, pole: poleL });
      h.setFingers('R', grip > 0.3 ? 'fist' : 'open'); h.setFingers('L', grip > 0.3 ? 'fist' : 'open');
      // feet: planted on their anchors; the hooking foot swings to the rival's leg on the same side of the picture
      yawQ.setFromAxisAngle(up, yawI);
      for (const s of [-1, 1]) {
        const side = ownSide(i, s), f = feet[i][side];
        const base = footBase(i, s, roots[i]);
        let x = base.x, y = ANKLE + f.lift, zz = base.z;
        // keep planted feet where the athlete has them (the root shifts only on a fall)
        x = ROOT0x(i, s) + f.sx; zz = ROOT_Z[i] + TOWARD[i] * FOOT_Z + f.sz;
        const lv = clamp(-sd.w * s + 0.1, 0, 1);
        y += 0.02 * lv * (1 - fk);
        let wgt = 1 - clamp(fk * 1.4, 0, 1);
        const hooking = p.hs === s && p.hp > 0.02;
        if (hooking) {
          const rb = { x: ROOT0x(j, s) + feet[j][ownSide(j, s)].sx, z: ROOT_Z[j] + TOWARD[j] * FOOT_Z };
          const tx = rb.x + s * 0.0, tz = rb.z + TOWARD[i] * 0.16;
          const u2 = B.side[i].hook ? ease(clamp(p.hp, 0, 1)) * 0.78 : clamp(p.hp, 0, 1) * 0.78 * 0.5;
          x = lerp(x, tx, u2) + s * Math.sin(Math.min(1, u2 / 0.78) * Math.PI) * 0.1;
          zz = lerp(zz, tz, u2);
          y = ANKLE + 0.02 + Math.sin(Math.min(1, u2 / 0.78) * Math.PI) * 0.15 + 0.16 * u2;
          void y;
        }
        const q = tmpQ.copy(yawQ).multiply(h._restQ[`${side}_Foot`]);
        h.setReachFoot(side, V(x, y, zz), wgt, q);
      }
      // the head looks over the rival's right shoulder
      const headJ = rv.bones.Bip01_Head.getWorldPosition(V());
      h.lookAt(V(headJ.x, headJ.y, headJ.z), { weight: 0.55, maxYaw: 0.7, maxPitch: 0.4 });
    }
    void watching;
  }
  const ROOT0x = (i, s) => s * FOOT_X;   // feet anchors: centred on the ring axis

  // ---- the affine that carries the game's 800 x 800 overlay world onto the screen: footBase() of the 2D picture lands on the planted feet
  const pv = V();
  function overlayMap(rect) {
    const c = stage.camera;
    const to = (x, y, z) => { pv.set(x, y, z).project(c); return { x: rect.x + (pv.x * 0.5 + 0.5) * rect.w, y: rect.y + (1 - (pv.y * 0.5 + 0.5)) * rect.h }; };
    const zf = ROOT_Z[0] + TOWARD[0] * FOOT_Z, zr = ROOT_Z[1] + TOWARD[1] * FOOT_Z;
    const s00 = to(-FOOT_X, 0.04, zf), s01 = to(FOOT_X, 0.04, zf), s10 = to(-FOOT_X, 0.04, zr);
    const a = (s01.x - s00.x) / 160, b = (s01.y - s00.y) / 160, cc = (s00.x - s10.x) / 44, d = (s00.y - s10.y) / 44;
    return { a, b, c: cc, d, e: s00.x - a * 320 - cc * 422, f: s00.y - b * 320 - d * 422 };
  }

  // ---- the frame
  function frame(G, view) {
    if (!P.ready || P.lost || !st.set && !sets.m) return;
    const W = view?.width || 720, H = view?.height || 1280;
    const cssW = kitCanvas.clientWidth || window.innerWidth, cssH = kitCanvas.clientHeight || window.innerHeight;
    let src = null, rect = null, focus = 0.5, zoomOut = 1;
    const scene = G.scene;
    if (scene === 'play' && G.m && G.lay && G.lay.stage) {
      src = { B: G.B, pose: G.pose, looks: G.looks, ring: G.ring, live: true };
      rect = G.lay.stage;
    } else if (G.att && (scene === 'title' || scene === 'setup' || scene === 'settings' || scene === 'result' || scene === 'demolimit' || scene === 'howto' || scene === 'about' || scene === 'rules')) {
      src = { B: G.att.B, pose: G.att.pose, looks: G.att.looks, ring: ['turf', 'hall', 'snow'][G.att.ring], live: false };
      rect = { x: 0, y: 0, w: W, h: H };
      if (scene === 'title' && W >= H * 1.25 && W >= 760) rect = { x: 0, y: 0, w: Math.round(W * 0.5), h: H };   // the menu column is on the right
      focus = W >= H ? 0.52 : 0.7;
      zoomOut = W >= H ? 1 : 1.18;
    }
    if (!src) { stage.setVisible(false); P.on = false; P.p3 = null; return; }
    const nowMs = performance.now(); let dt = st.lastNow ? Math.min(0.05, (nowMs - st.lastNow) / 1000) : 0; st.lastNow = nowMs;
    const frozen = !!(G.paused || G.pauseMenu || G.reasonOpen);
    if (frozen) dt = 0;
    st.tReal += dt;
    // which pair of figures (female rival -> female pair when loaded)
    const female = !!(src.looks[1] && ATH[src.looks[1]].female) && !!sets.f;
    const want = female ? sets.f : sets.m;
    if (st.set !== want) {
      if (st.set) for (const a of st.set) a.h.root.visible = false;
      st.set = want; for (const a of st.set) a.h.root.visible = true; st.settle = 40;
      for (let i = 0; i < 2; i++) feet[i].L.sx = feet[i].R.sx = feet[i].L.sz = feet[i].R.sz = 0;
    }
    // looks: skin, hair, kit by look id
    const key = `${src.looks[0]}|${src.looks[1]}|${src.ring}|${female ? 'f' : 'm'}`;
    if (key !== st.key) {
      st.key = key; st.settle = 40;
      for (let i = 0; i < 2; i++) {
        const L = ATH[src.looks[i]] || ATH[0], K = KIT[src.looks[i]] || KIT[0], h = st.set[i].h;
        h.setKit({ top: K.top, bottoms: K.bottoms, socks: '#f2f2ea' }); h.setSkin(L.skin); h.setHair(L.hair);
        for (const g of Object.values(st.set[i].gear)) void g;
      }
      world.setRing(src.ring);
    }
    world.setRing(src.ring);
    stage.setVisible(true);
    sizeBudget(cssW, cssH);
    const B = src.B;
    // footwork on the sim's step events
    if (dt > 0 && B.ev) {
      for (const e of B.ev) {
        if (e.k !== 'foot') continue;
        const i = e.side, lighter = -B.side[i].w >= 0 ? 'R' : 'L';   // (picture) the foot without the weight takes the little step
        void lighter;
        const sd = B.side[i], s = (-sd.w) > 0 ? 1 : -1, side = ownSide(i, s), f = feet[i][side];
        if (f.t >= 1) { f.t = 0; st.seedStep++; f.sx = clamp(f.sx + (st.seedStep % 2 ? 0.02 : -0.02), -0.04, 0.04); f.sz = clamp(f.sz + (st.seedStep % 3 ? 0.012 : -0.012), -0.03, 0.03); }
      }
    }
    // settle: when a new scene appears, run the animation a little so IK and fades are in place before the first picture
    const n = st.settle > 0 ? st.settle : 1;
    for (let k = 0; k < n; k++) {
      const d = st.settle > 0 ? 1 / 30 : dt;
      poseBoth(B, src.pose, d, !src.live);
      stage.update(d, { renderNow: false });
    }
    st.settle = 0;
    // world: crowd cheers on a result
    const cheer = G.cheer || 0;
    world.update(st.tReal, B && B.over ? 0.7 : cheer, 0);
    // camera: behind the near athlete, a little to one side and above; it circles gently with the sim's ring angle
    const aspect = rect.w / rect.h;
    const el = (aspect < 0.8 ? 40 : aspect < 1.25 ? 34 : 28) * Math.PI / 180, az = (27 + 8 * Math.sin((B.ang || 0) * 0.5)) * Math.PI / 180;
    const tf = Math.tan(30 * Math.PI / 360);
    const halfH = 1.12, halfW = 0.9;
    const dist = Math.max(halfH / tf, halfW / (tf * aspect)) * zoomOut;
    const tgt = V(0, 0.9, 0);
    let distU = dist, azU = az, elU = el;
    if (DEVCAM) { distU = DEVCAM.d; azU = DEVCAM.az * Math.PI / 180; elU = DEVCAM.el * Math.PI / 180; tgt.y = DEVCAM.ty; }
    const pos = V(Math.sin(azU) * Math.cos(elU), Math.sin(elU), Math.cos(azU) * Math.cos(elU)).multiplyScalar(distU).add(tgt);
    const c = stage.camera;
    c.aspect = aspect; c.fov = 30; c.position.copy(pos); c.lookAt(tgt);
    if (Math.abs(focus - 0.5) > 0.001) {   // slide the picture so the pair sits at `focus` of the height (menus put text above)
      const visH = 2 * dist * tf, upv = V(0, 1, 0).applyQuaternion(c.quaternion);
      c.position.addScaledVector(upv, (focus - 0.5) * visH); c.lookAt(tgt.clone().addScaledVector(upv, (focus - 0.5) * visH));
    }
    c.updateProjectionMatrix(); c.updateMatrixWorld();
    stage.setShadowTarget(0, 0, 0);
    stage.update(0, { renderNow: false });
    // viewport: only the stage rectangle of the (virtual) screen
    const sx = cssW / W, sy = cssH / H;
    const r = stage.renderer;
    r.setScissorTest(true);
    const vx = Math.round(rect.x * sx), vw = Math.round(rect.w * sx), vh = Math.round(rect.h * sy), vy = Math.round(cssH - (rect.y + rect.h) * sy);
    r.setViewport(vx, vy, vw, vh); r.setScissor(vx, vy, vw, vh);
    r.render(stage.scene, c);
    r.setScissorTest(false);
    P.on = true;
    P.p3 = { rect, map: overlayMap(rect) };
    perfTick();
  }

  P.frame = frame;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { frame(game.getState(), view); r(ctx, view); };
    return game;
  };
  return P;
}
