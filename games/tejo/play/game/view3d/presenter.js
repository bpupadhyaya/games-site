// Tejo 3D presenter. It READS the simulation (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas: the golden-hour court, the clay box, steel discs, paper mechas and particles, plus onlookers (crowd3d). The camera is the
// thrower's eye, set so the clay face is exactly fronto-parallel: the 2D layer's linear mapping P(u, v) of box coordinates to
// the screen therefore still lands on the right pixels, so the HUD, the floating score text and the hit areas stay as they were.
// Fallback: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import { createStage, THREE, createCrowd3d } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { sprites } from '../src/art.js';
import { FR, setFrame, playLayout } from '../src/layout.js';
import { BOX, RING, DISC_R, TREMOR_START, sigmaAt } from '../src/sim.js';
import { baseSigma, T_FLY, isHuman, aimShown } from '../src/view.js';
import { buildCourt, buildBox, makeDisc, setDiscSide, softTexture, toLocal, THETA, BOX_Y, NORMAL, SLOPE, DISC } from './world.js';
import { createFx } from './fx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const FOV = 40;
const SIDE_COL = ['#f4b92e', '#3d78ff'];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, meta, quality = pickQuality() }) {
  const noop = { wrap: (g) => g, ok: false, stage: null };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'evening', mode: 'continuous', shadows: true, shadowSize: 2.6, transparent: true });
  if (!stage.supported) { canvas.remove(); return noop; }
  const { scene, camera, renderer } = stage;
  camera.fov = FOV; camera.near = 0.05; camera.far = 220; camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 0.92;

  // ---- light: low golden sun from the thrower's left, cool sky fill, a rim from behind the box
  const Lt = stage.lights;
  Lt.key.color.set('#ffd9a0'); Lt.key.intensity = 2.3; Lt.hemi.color.set('#9fb8e0'); Lt.hemi.groundColor.set('#6a4a30'); Lt.hemi.intensity = 0.55;
  Lt.rim.color.set('#7fb8ff'); Lt.rim.intensity = 0.9;
  stage._shadowOffset.set(-4.6, 3.6, 3.2);
  stage.setSky('#f0a870', '#d9a07c', { near: 28, far: 110 });
  stage.setShadowTarget(0, 0.5, 0.3);

  const P = { stage, THREE, ok: true, quality, lost: false };
  const world = buildCourt({ quality, scenery: true });
  scene.add(world.group);
  const box = buildBox({ low: quality === 'low' });
  const boxRoot = new THREE.Group(); boxRoot.position.set(0, BOX_Y, 0); boxRoot.rotation.x = THETA - Math.PI / 2; boxRoot.add(box.root); scene.add(boxRoot);
  const fx = createFx(scene, { quality });

  // ---- onlookers: real crowd3d people along both sides of the lane and behind the fence
  let crowd = null;
  try {
    const n = quality === 'high' ? 46 : quality === 'medium' ? 30 : 16;
    crowd = createCrowd3d(stage, {
      rows: [
        { from: [-2.6, 0, -0.9], to: [-3.0, 0, 1.4], count: Math.round(n * 0.2), face: [1, 0, -0.1] },
        { from: [-3.4, 0, -0.7], to: [-3.8, 0, 1.2], count: Math.round(n * 0.16), face: [1, 0, -0.1] },
        { from: [2.4, 0, -2.2], to: [3.1, 0, -0.9], count: Math.round(n * 0.14), face: [-1, 0, 0.3] },
        { from: [3.3, 0, -2.0], to: [3.8, 0, -1.0], count: Math.round(n * 0.1), face: [-1, 0, 0.3] },
        { from: [-3.0, 0, -4.2], to: [3.0, 0, -4.2], count: Math.round(n * 0.4), face: [0, 0, 1] },
      ],
      count: n, seed: 5, culture: 'latin_american', quality: quality === 'low' ? 'low' : quality, excitement: 0.25, props: { flag: 0.08, phone: 0.04, child: 0.06 }, flagColors: ['#f7c600', '#1f4fb8', '#d3272f'],
    });
  } catch (e) { console.warn('crowd3d failed', e); }

  // ---- the thrower (hero scenes only; in play the camera is his eye): loads in the background, the 2D/solid hero works without him
  let thrower = null, holdDisc = null;
  (async () => {
    try {
      const { createThrower } = await import('./thrower.js');
      const t = await createThrower({ lod: 0 });
      t.root.position.set(-0.85, 0, 2.3); t.human.setFacing(Math.PI + 0.38);
      scene.add(t.root); t.root.visible = false; stage.track(t.human);
      holdDisc = makeDisc(0); holdDisc.scale.setScalar(1);
      holdDisc.position.set(0.04, 0.0, 0.0); holdDisc.rotation.set(0, 0, 0); t.hold.add(holdDisc);
      thrower = t; stage.invalidate();
    } catch (e) { console.warn('thrower failed', e); }
  })();

  // ---- discs
  const discs = new Map();            // board disc id -> { g, disc, side }
  const dentGeo = new THREE.PlaneGeometry(0.12, 0.12);
  const dentMat = new THREE.MeshBasicMaterial({ map: box.dentTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  function boardDisc(id, side) {
    let e = discs.get(id);
    if (!e) {
      const g = new THREE.Group(), d = makeDisc(side); d.position.z = 0.0085; g.add(d);
      const dent = new THREE.Mesh(dentGeo, dentMat); dent.position.z = 0.0018; g.add(dent);
      g.rotation.z = (id * 2.399) % TAU; box.root.add(g);
      e = { g, disc: d, side }; discs.set(id, e);
    }
    if (e.side !== side) { setDiscSide(e.disc, side); e.side = side; }
    return e;
  }
  const flyDisc = makeDisc(0); flyDisc.visible = false; scene.add(flyDisc);
  const restDisc = makeDisc(0); restDisc.visible = false; scene.add(restDisc);
  const sinkDisc = makeDisc(0); sinkDisc.visible = false; box.root.add(sinkDisc);

  // ---- aim reticle, scatter ring, hint, candidates, bonus line (all lying on the clay)
  const mkRing = (r0, r1, color, o = 0.9) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 56), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.visible = false; m.position.z = 0.006; box.root.add(m); return m;
  };
  const reticle = mkRing(DISC_R / 100 * 0.94, DISC_R / 100 * 1.12, '#ffffff', 0.9);
  const tremor = mkRing(DISC_R / 100 * 1.3, DISC_R / 100 * 1.46, '#ff6a4a', 0.8);
  const hint = mkRing(DISC_R / 100 * 1.15, DISC_R / 100 * 1.4, '#7dffb0', 0.95);
  const cands = [0, 1, 2, 3].map((i) => mkRing(0.012 + 0.004 * (i === 0), 0.021 + 0.004 * (i === 0), i === 0 ? '#7dffb0' : '#ffffff', 0.9));
  const bonusRing = mkRing(DISC_R / 100 * 1.15, DISC_R / 100 * 1.4, '#ffe08a', 0.95);
  const cross = new THREE.Group(); cross.visible = false; box.root.add(cross);
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.0032), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    t.position.set(Math.cos(i * Math.PI / 2) * 0.062, Math.sin(i * Math.PI / 2) * 0.062, 0); t.rotation.z = i * Math.PI / 2; cross.add(t);
  }
  const dashN = 40;
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.011, 0.0034), new THREE.MeshBasicMaterial({ color: '#ffe28a', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), dashN);
  dashes.visible = false; dashes.frustumCulled = false; box.root.add(dashes);
  const bonusLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.006), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  bonusLine.visible = false; bonusLine.position.z = 0.006; box.root.add(bonusLine);
  const beadN = 18;
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0065, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c8', transparent: true, opacity: 0.85, depthWrite: false }), beadN);
  beads.visible = false; beads.frustumCulled = false; scene.add(beads);

  // ---- camera --------------------------------------------------------------------------------------------------------------------
  let W = 1, H = 1;
  const boxC = new THREE.Vector3(0, BOX_Y, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const cam = { f: 1, cx: 0, cy: 0, k: 1, d: 3, right: new THREE.Vector3(), up: new THREE.Vector3(), fwd: new THREE.Vector3() };
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    if (w !== W || h !== H) { W = w; H = h; stage.setSize(w, h); }
  }
  function basis() {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    cam.right.set(e[0], e[1], e[2]).normalize(); cam.up.set(e[4], e[5], e[6]).normalize(); cam.fwd.set(-e[8], -e[9], -e[10]).normalize();
  }
  // play camera: looks straight into the clay face; distance chosen so 1 m of clay spans exactly BOX * s layout units
  function fitPlay(Lp, shx, shy) {
    const s = Lp.board.s, f = (FR.h / 2) / Math.tan((FOV * Math.PI) / 360);
    const d = f / (BOX * s);
    camera.position.copy(boxC).addScaledVector(NORMAL, d); camera.up.copy(SLOPE); camera.lookAt(boxC);
    camera.fov = FOV; camera.aspect = W / H;
    const k = W / FR.w, cx = Lp.board.x + 50 * s + shx, cy = Lp.board.y + 50 * s + shy;
    camera.setViewOffset(W, H, W / 2 - cx * k, H / 2 - cy * k, W, H);
    camera.updateProjectionMatrix(); basis();
    Object.assign(cam, { f, cx, cy, k, d });
  }
  // hero camera (title, menus): a three-quarter view from behind the thrower; the framed subject sits at the centre of the hero rectangle
  const look = new THREE.Vector3(-0.15, 0.9, 1.0);
  function fitHero(rect, t, calm) {
    const sw = calm ? 0 : Math.sin(t * 0.21) * 0.35;
    camera.position.set(3.1 + sw, 1.35, 5.6); camera.up.set(0, 1, 0);
    camera.lookAt(look);
    const dist = camera.position.distanceTo(look), Hw = Math.max(2.5, (4.7 * rect.h) / rect.w);
    const f = (rect.h * dist) / Hw, fov = (2 * Math.atan((FR.h / 2) / f) * 180) / Math.PI;
    camera.fov = Math.min(110, fov); camera.aspect = W / H;
    const f2 = (FR.h / 2) / Math.tan((camera.fov * Math.PI) / 360);
    const k = W / FR.w, cx = rect.x + rect.w * 0.5, cy = rect.y + rect.h * 0.5;
    camera.setViewOffset(W, H, W / 2 - cx * k, H / 2 - cy * k, W, H);
    camera.updateProjectionMatrix(); basis();
    Object.assign(cam, { f: f2, cx, cy, k });
  }
  // the world point under layout position (sx, sy) at depth `dep` metres in front of the camera
  function unprojectTo(sx, sy, dep, out) {
    const x = ((sx - cam.cx) * dep) / cam.f, y = (-(sy - cam.cy) * dep) / cam.f;
    return out.copy(camera.position).addScaledVector(cam.fwd, dep).addScaledVector(cam.right, x).addScaledVector(cam.up, y);
  }
  const clayWorld = (u, v, z = 0, out = new THREE.Vector3()) => { const l = toLocal(u, v); return boxRoot.localToWorld(out.set(l.x, l.y, z)); };

  // ---- events -> effects ---------------------------------------------------------------------------------------------------------
  const wp = new THREE.Vector3(), wp2 = new THREE.Vector3();
  const scorchQ = [];
  let ringGlow = 0, seenEv = 0;
  const rimSpark = (u, v) => { fx.sparks(clayWorld(u, v, 0.02, wp), 16, { speed: 2.6, color: '#fff2b8' }); fx.puff(clayWorld(u, v, 0.03, wp), { kind: 'flash', size: 0.09, grow: 2.2, life: 0.22, opacity: 0.9 }); };
  function onEvent(e) {
    if (e.type === 'land') {
      const out = e.status === 'short' || e.status === 'long' || e.status === 'side';
      if (out) {
        clayWorld(e.u, e.v, 0, wp); wp.y = 0.03;
        fx.puff(wp, { kind: 'dust', size: 0.12, grow: 2.4, life: 0.8, rise: 0.25, opacity: 0.5 });
        crowd?.react('groan', { origin: [0, 0, 0], radius: 12, intensity: 0.5 });
        return;
      }
      clayWorld(e.u, e.v, 0.02, wp);
      for (let i = 0; i < 3; i++) fx.puff(wp, { kind: 'dust', size: 0.07 + 0.02 * i, grow: 2.6, life: 0.7 + 0.1 * i, rise: 0.3, opacity: 0.55 });
      fx.crumbs(wp, 16, { speed: 1.2, normal: NORMAL });
      if (e.kick) rimSpark(RING.u, RING.v);
      crowd?.react('gasp', { origin: [0, 0, 0], radius: 12, intensity: 0.6 });
    } else if (e.type === 'pop') {
      clayWorld(e.u, e.v, 0.045, wp);
      fx.puff(wp, { kind: 'flash', size: 0.2, grow: 2.6, life: 0.3, opacity: 1 });
      for (let i = 0; i < 5; i++) fx.puff(wp2.copy(wp).addScaledVector(NORMAL, 0.02 * i), { kind: 'smoke', size: 0.05 + 0.012 * i, grow: 4.2, life: 1.2 + 0.15 * i, rise: 0.35 + 0.1 * i, opacity: 0.5, tint: '#d8d4cc' });
      fx.sparks(wp, 18, { speed: 3.0 });
      fx.confetti(wp, 38, { speed: 2.6, up: 1.8 });
      scorchQ.push(e.i);
      crowd?.react('cheer', { origin: [0, 0, 0], radius: 30, intensity: 0.8 });
    } else if (e.type === 'ring') {
      clayWorld(RING.u, RING.v, 0.04, wp);
      fx.puff(wp, { kind: 'flash', size: 0.3, grow: 3, life: 0.45, opacity: 1 });
      fx.sparks(wp, 28, { speed: 3.4, color: '#ffe08a' });
      fx.confetti(wp, 70, { speed: 3.0, up: 2.4 });
      ringGlow = 1;
      crowd?.react('ovation', { origin: [0, 0, 0], radius: 40, intensity: 1 });
    } else if (e.type === 'reset') {
      for (const m of box.mechas) m.userData.grow = 0;
      for (const [, d] of discs) box.root.remove(d.g);
      discs.clear();
      for (const s of box.scorch) s.material.opacity = 0;
    }
  }

  // ---- tiers -------------------------------------------------------------------------------------------------------------------
  const TIERS = ['high', 'medium', 'low'];
  let tier = Math.max(0, TIERS.indexOf(quality)), frames = 0, ema = 16, lastNow = performance.now();
  try { const m = /[?&]tier=(\d)/.exec(globalThis.location.search); if (m) tier = clamp(Number(m[1]), 0, 2); } catch { /* ignore */ }

  // ---- per-frame state -> scene -----------------------------------------------------------------------------------------------------
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), m4 = new THREE.Matrix4(), eul = new THREE.Euler();
  const orient = (obj, spin, tiltX = 0, tiltY = 0) => {   // disc axis along the clay normal, spun about its own axis
    boxRoot.getWorldQuaternion(qa);
    qb.setFromAxisAngle(zAxis, spin); qa.multiply(qb);
    if (tiltX || tiltY) { qb.setFromEuler(eul.set(tiltX, tiltY, 0)); qa.multiply(qb); }
    obj.quaternion.copy(qa);
  };

  function syncDiscs(state) {
    const m = state.m, present = new Set();
    if (m) {
      const fl = m.fl, flyingNow = fl && fl.t < T_FLY + 0.02;
      for (const d of m.board.discs) {
        if (flyingNow && fl.id === d.id) continue;       // still in the air: drawn by the flight
        const e = boardDisc(d.id, d.side); present.add(d.id);
        const l = toLocal(d.du ?? d.u, d.dv ?? d.v);
        e.g.position.set(l.x, l.y, 0); e.g.visible = true;
      }
    }
    for (const [id, e] of discs) if (!present.has(id)) e.g.visible = false;
  }
  const restDepth = () => (DISC.r * cam.f) / 34;
  function placeRest(state, Lp, clock) {
    const m = state.m;
    const show = m && (m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act') && m.left[m.turn] > 0 && !m.fl;
    restDisc.visible = !!show;
    if (!show) return;
    if (restDisc.userData.side !== m.turn) setDiscSide(restDisc, m.turn);
    let tx = 0, ty = 0;
    if (m.drag && m.hold > TREMOR_START - 0.6) { const f = clamp((m.hold - (TREMOR_START - 0.6)) / 1.4, 0, 1); tx = Math.sin(clock * 38) * 2.2 * f; ty = Math.cos(clock * 31) * 1.8 * f; }
    unprojectTo(Lp.rest.x + tx, Lp.rest.y + ty, restDepth(), restDisc.position);
    restDisc.position.addScaledVector(cam.up, Math.sin(clock * 1.7) * 0.01);
    // held flat in the palm, its face turned toward the thrower's eye and tipped up a little
    restDisc.quaternion.setFromRotationMatrix(m4.makeBasis(cam.right, cam.up, tmp.copy(cam.right).cross(cam.up)));
    qb.setFromEuler(eul.set(-0.5 + Math.sin(clock * 1.3) * 0.03, 0, Math.sin(clock * 0.8) * 0.06)); restDisc.quaternion.multiply(qb);
  }
  function placeFlight(state, Lp, clock) {
    const m = state.m, fl = m && m.fl;
    flyDisc.visible = false; sinkDisc.visible = false;
    if (!fl) return;
    const res = fl.res, k = clamp(fl.t / T_FLY, 0, 1);
    if (fl.t < T_FLY + 0.02) {
      if (flyDisc.userData.side !== res.side) setDiscSide(flyDisc, res.side);
      const target = clayWorld(res.land.u, res.land.v, DISC.t * 0.5 + 0.004, wp2);
      if (res.status === 'short' || res.status === 'long' || res.status === 'side') target.y = Math.max(0.03, Math.min(target.y, 0.03));
      const from = unprojectTo(Lp.rest.x, Lp.rest.y, restDepth(), tmp2);
      const e = 1 - Math.pow(1 - k, 1.6), dist = from.distanceTo(target), arc = Math.min(1.1, 0.35 + dist * 0.28);
      flyDisc.position.lerpVectors(from, target, e);
      flyDisc.position.y += arc * 4 * k * (1 - k);
      orient(flyDisc, clock * 19, Math.sin(k * 9) * 0.07 + 0.2 * (1 - k), Math.cos(k * 7) * 0.06);
      flyDisc.visible = true;
    } else if (res.status === 'ring') {
      const t = clamp((fl.t - T_FLY) / 0.45, 0, 1);
      if (sinkDisc.userData.side !== res.side) setDiscSide(sinkDisc, res.side);
      const l = toLocal(RING.u, RING.v);
      sinkDisc.position.set(l.x, l.y, 0.0085 - 0.03 * t * t); sinkDisc.rotation.set(0, 0, clock * 3); sinkDisc.visible = t < 0.98;
    }
  }
  function hideOverlays() {
    for (const o of [reticle, tremor, hint, bonusRing, bonusLine, cross, dashes, beads]) o.visible = false;
    for (const c of cands) c.visible = false;
  }
  function syncOverlays(state, clock) {
    hideOverlays();
    const m = state.m;
    if (!m || state.scene !== 'play') return;
    const aimPhase = m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act';
    const showAim = aimPhase && m.turn >= 0 && !m.fl && ((m.ph === 'aim' && isHuman(m, m.turn)) || m.ph === 'act' || m.ph === 'reveal');
    const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
    if (showAim) {
      const a = aimShown(state), l = toLocal(a.u, a.v), out = a.u < 0 || a.u > BOX || a.v < 0 || a.v > BOX, col = out ? '#ff8a7a' : '#ffffff';
      reticle.visible = true; reticle.position.set(l.x, l.y, 0.006); reticle.material.color.set(col);
      cross.visible = true; cross.position.set(l.x, l.y, 0.006); for (const t of cross.children) t.material.color.set(col);
      if (state.settings.guide) {
        const sg = (sigmaAt(baseSigma(state, m.turn), clamp(a.v, 0, 100)) * 1.5) / 100;
        dashes.visible = true; dashes.position.set(l.x, l.y, 0.006); dashes.material.color.set(SIDE_COL[m.turn]);
        for (let i = 0; i < dashN; i++) {
          const ang = (i / dashN) * TAU + clock * 0.3; qa.setFromAxisAngle(zAxis, ang + Math.PI / 2);
          m4.compose(tmp.set(Math.cos(ang) * sg, Math.sin(ang) * sg, 0), qa, one); dashes.setMatrixAt(i, m4);
        }
        dashes.instanceMatrix.needsUpdate = true;
        if (restDisc.visible) {   // dotted arc from the held disc to the mark
          const A = restDisc.position, B2 = clayWorld(a.u, a.v, 0.02, wp2), mid = tmp2.copy(A).add(B2).multiplyScalar(0.5); mid.y += 0.25 + A.distanceTo(B2) * 0.18;
          for (let i = 0; i < beadN; i++) {
            const t = (i + 1) / (beadN + 1);
            tmp.set(0, 0, 0).addScaledVector(A, (1 - t) * (1 - t)).addScaledVector(mid, 2 * t * (1 - t)).addScaledVector(B2, t * t);
            m4.makeTranslation(tmp.x, tmp.y, tmp.z); beads.setMatrixAt(i, m4);
          }
          beads.instanceMatrix.needsUpdate = true; beads.visible = true;
        }
      }
      if (m.drag && m.hold > TREMOR_START - 0.6) {
        const f = clamp((m.hold - (TREMOR_START - 0.6)) / 1.4, 0, 1);
        tremor.visible = true; tremor.position.set(l.x, l.y, 0.006); tremor.material.opacity = 0.35 + 0.5 * f; tremor.scale.setScalar(1 + 0.08 * Math.sin(clock * 30) * f);
      }
    }
    if (state.hint && m.ph === 'aim') { const l = toLocal(state.hint.u, state.hint.v); hint.visible = true; hint.position.set(l.x, l.y, 0.006); hint.scale.setScalar(1 + 0.12 * pulse); }
    if (m.ph === 'reveal' && m.plan && m.plan.top) m.plan.top.forEach((c, i) => { const l = toLocal(c.u, c.v), r = cands[i]; if (r) { r.visible = true; r.position.set(l.x, l.y, 0.006); r.scale.setScalar(i === 0 ? 1.15 + 0.1 * pulse : 1); } });
    if (m.ph === 'bonus' && m.bonus) {
      const d = m.board.discs.find((q) => q.id === m.bonus.id);
      if (d) {
        const a = toLocal(RING.u, RING.v), b = toLocal(d.du ?? d.u, d.dv ?? d.v), len = Math.hypot(b.x - a.x, b.y - a.y);
        bonusLine.visible = true; bonusLine.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0.006); bonusLine.rotation.z = Math.atan2(b.y - a.y, b.x - a.x); bonusLine.scale.set(Math.max(0.001, len), 1, 1);
        bonusRing.visible = true; bonusRing.position.set(b.x, b.y, 0.006); bonusRing.material.color.set(SIDE_COL[d.side]); bonusRing.scale.setScalar(1 + 0.1 * pulse);
      }
    }
  }

  // ---- hero (title and menus): the real court with a throw that loops ------------------------------------------------------------------
  const hero = { t: 0, n: -1, shot: null, fired: false, mechas: [true, true], pitched: false, from: new THREE.Vector3() };
  const HERO_SHOTS = [{ u: 50, v: 54, kind: 'ring' }, { u: 44, v: 72, kind: 'plain' }, { u: 50, v: 60.4, kind: 'pop', slot: 0 }];
  const T0 = 0.7;                          // the pitch starts here; the disc leaves the hand 0.85 s later
  function heroFrame(dt) {
    hero.t += dt;
    const cyc = 6.8, n = Math.floor(hero.t / cyc), t = hero.t - n * cyc, tl = T0 + 0.85;
    if (n !== hero.n) {
      hero.n = n; hero.mechas = [true, true]; hero.pitched = false; hero.fired = false; hero.launched = false;
      for (const m of box.mechas) m.userData.grow = 0;
      for (const [, d] of discs) box.root.remove(d.g);
      discs.clear();
      for (const s of box.scorch) s.material.opacity = 0;
      hero.shot = HERO_SHOTS[n % HERO_SHOTS.length];
      if (thrower) thrower.human.play('tejo_ready', { fade: 0.25 });
    }
    const sh = hero.shot;
    flyDisc.visible = false; sinkDisc.visible = false; restDisc.visible = false;
    if (thrower) {
      thrower.root.visible = true;
      if (t >= T0 && !hero.pitched) { hero.pitched = true; thrower.human.play('tejo_pitch', { fade: 0.2, onDone: () => thrower.human.play('tejo_ready', { fade: 0.4 }) }); }
      holdDisc.visible = t < tl;
      thrower.update(dt);
    }
    if (t >= tl && !hero.launched) {
      hero.launched = true;
      if (thrower) { const b = thrower.human.bones.Bip01_R_Hand; b.getWorldPosition(hero.from); } else hero.from.set(0.0, 0.8, 3.0);
    }
    if (t >= tl && t < tl + T_FLY) {
      const k = (t - tl) / T_FLY, e = 1 - Math.pow(1 - k, 1.6);
      const target = clayWorld(sh.u, sh.v, DISC.t * 0.5 + 0.004, wp2);
      if (flyDisc.userData.side !== 0) setDiscSide(flyDisc, 0);
      flyDisc.position.lerpVectors(hero.from, target, e); flyDisc.position.y += 0.9 * 4 * k * (1 - k);
      orient(flyDisc, hero.t * 19, Math.sin(k * 9) * 0.07 + 0.2 * (1 - k), 0); flyDisc.visible = true;
    }
    if (t >= tl + T_FLY && !hero.fired) {
      hero.fired = true;
      onEvent({ type: 'land', u: sh.u, v: sh.v, status: 'box', kick: false });
      if (sh.kind === 'pop') { hero.mechas[sh.slot] = false; onEvent({ type: 'pop', i: sh.slot, u: sh.u, v: sh.v }); }
      if (sh.kind === 'ring') onEvent({ type: 'ring' });
      if (sh.kind === 'plain') { const e = boardDisc(9000 + n, 0), l = toLocal(sh.u, sh.v); e.g.position.set(l.x, l.y, 0); e.g.visible = true; }
    }
    if (sh.kind === 'ring' && t >= tl + T_FLY && t < tl + T_FLY + 0.5) {
      const l = toLocal(RING.u, RING.v), tt = (t - tl - T_FLY) / 0.45;
      if (sinkDisc.userData.side !== 0) setDiscSide(sinkDisc, 0);
      sinkDisc.position.set(l.x, l.y, 0.0085 - 0.03 * clamp(tt, 0, 1) ** 2); sinkDisc.visible = tt < 0.98;
    }
    for (const [id, e] of discs) e.g.visible = id >= 9000 && e.g.visible;
  }

  // ---- the per-frame pipeline ----------------------------------------------------------------------------------------------------------
  let clock = 0;
  const mechaAlive = [true, true];
  function frame(game) {
    const state = game.getState();
    const now = performance.now(), wall = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    const paused = state.paused && state.scene === 'play';
    const dt = paused ? 0 : wall;
    clock += dt;
    ema = ema * 0.95 + wall * 1000 * 0.05; frames++;
    if (frames > 90 && ema > 26 && tier < 2) { tier++; stage.setQuality(TIERS[tier]); crowd?.setQuality('low'); frames = 0; ema = 16; }
    resize();
    setFrame(meta.width, meta.height);
    const play = state.scene === 'play' && !!state.m;
    const Lp = playLayout();
    const shx = play ? Math.sin(state.t * 90) * state.shake * 6 : 0, shy = play ? Math.cos(state.t * 77) * state.shake * 5 : 0;
    const evs = state.evs || [];
    for (const e of evs) if (e.id > seenEv) { seenEv = e.id; if (play) onEvent(e); }
    if (play) {
      if (thrower) thrower.root.visible = false;
      fitPlay(Lp, shx, shy);
      const m = state.m;
      for (let i = 0; i < 2; i++) mechaAlive[i] = !!m.board.mechas[i];
      syncDiscs(state);
      placeRest(state, Lp, clock);
      placeFlight(state, Lp, clock);
      syncOverlays(state, clock);
    } else {
      const hr = v3.heroRect || { x: FR.w * 0.04, y: FR.h * 0.04, w: FR.w * 0.92, h: Math.min(FR.h * 0.4, 360) };
      fitHero(hr, clock, state.calm);
      heroFrame(dt);
      mechaAlive[0] = hero.mechas[0]; mechaAlive[1] = hero.mechas[1];
      hideOverlays();
    }
    // mechas: flutter in the breeze, glowing fuse tip, grow back after a reset, gone after a pop
    for (let i = 0; i < 2; i++) {
      const mm = box.mechas[i], g = mm.userData.grow ?? 1;
      mm.userData.grow = Math.min(1, g + dt * 3);
      mm.visible = mechaAlive[i]; mm.scale.setScalar(Math.max(0.01, mm.userData.grow));
      mm.rotation.x = Math.sin(clock * 2.1 + i * 2) * 0.035; mm.rotation.y = Math.sin(clock * 1.6 + i) * 0.03;
      const em = mm.userData.ember; if (em) em.scale.setScalar(0.8 + 0.5 * Math.abs(Math.sin(clock * 17 + i * 3)));
    }
    for (const i of scorchQ.splice(0)) box.scorch[i].material.opacity = 0.55;
    ringGlow = Math.max(0, ringGlow - dt * 1.6); box.glow.material.opacity = ringGlow * 0.9;
    world.sway.forEach((f, i) => { f.rotation.z = Math.sin(clock * 0.9 + i) * 0.012; });
    world.bulbs.forEach((b, i) => { b.material.opacity = 0.7 + 0.15 * Math.sin(clock * 3.1 + i * 1.7) + 0.08 * Math.sin(clock * 9 + i * 5); });
    stage.setShadowTarget(0, 0.5, 0.2);
    fx.update(dt);
    if (world.scenery) world.scenery.update(dt, camera);
    crowd?.update(dt);
    stage.update(0, { renderNow: true });
  }

  // ---- sprites: the real discs and the clay box, rendered once for the HUD icons and the rules diagrams ---------------------------------------
  function buildSprites() {
    const mk = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
    const keep = scene.children.map((o) => [o, o.visible]), bg = scene.background, fog = scene.fog;
    for (const o of scene.children) if (!o.isLight && o !== boxRoot) o.visible = false;
    scene.background = null; scene.fog = null;
    renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
    const snap = (n, cam) => { renderer.setSize(n, n, false); renderer.clear(); renderer.render(scene, cam); const c = mk(n); c.getContext('2d').drawImage(renderer.domElement, 0, 0, n, n); return c; };
    // the box, straight on
    const S = 640, cam = new THREE.PerspectiveCamera(20, 1, 0.1, 30), span = sprites.boxSpan;
    const d = (span / 2) / Math.tan((10 * Math.PI) / 180);
    cam.position.copy(boxC).addScaledVector(NORMAL, d); cam.up.copy(SLOPE); cam.lookAt(boxC); cam.updateMatrixWorld();
    for (const m of box.mechas) m.visible = true;
    sprites.box = snap(S, cam);
    for (const m of box.mechas) m.visible = false;
    sprites.boxBare = snap(S, cam);
    for (const m of box.mechas) m.visible = true;
    // the discs, seen from above with a slight tilt so the thickness reads
    boxRoot.visible = false;
    const dscene = [makeDisc(0), makeDisc(1)];
    for (let i = 0; i < 2; i++) {
      const dd = dscene[i]; dd.position.set(0, 0, -5); scene.add(dd);
      const dc = new THREE.PerspectiveCamera(12, 1, 0.1, 30), dist = (0.088 / sprites.discSpan / 2) / Math.tan((6 * Math.PI) / 180);
      dc.position.set(0.1 * dist, 0.16 * dist, -5 + dist); dc.lookAt(dd.position); dc.updateMatrixWorld();
      sprites.disc[i] = snap(192, dc); scene.remove(dd);
    }
    boxRoot.visible = true;
    for (const [o, v] of keep) o.visible = v;
    scene.background = bg; scene.fog = fog;
    renderer.setClearColor(0x000000, 1);
    sprites.ready = true; W = 0;
  }
  try { buildSprites(); } catch (e) { console.warn('sprites failed', e); sprites.ready = false; }

  // ---- context loss -> flat 2D, restore -> back to 3D ---------------------------------------------------------------------------------
  stage.onContextLost(() => { v3.on = false; P.lost = true; });
  stage.onContextRestored(() => { v3.on = true; P.lost = false; stage.invalidate(); W = 0; try { buildSprites(); } catch { /* keep the old pictures */ } });
  v3.on = true;

  Object.assign(P, { world, box, fx, camera, boxRoot, stats: () => ({ tier, ema }) });
  P.wrap = (game) => Object.assign({}, game, {
    render(ctx, view) {
      if (!v3.on) { game.render(ctx, view); return; }
      try { frame(game); } catch (e) { console.warn('3D frame failed; 2D fallback', e); v3.on = false; game.render(ctx, view); return; }
      ctx.clearRect(0, 0, view?.width ?? FR.w, view?.height ?? FR.h);
      game.render(ctx, view);
    },
  });
  return P;
}
