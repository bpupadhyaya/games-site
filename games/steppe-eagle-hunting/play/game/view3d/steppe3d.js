// The 3D picture of Steppe Eagle Hunting. One WebGL scene (view3d stage) is rendered into an off-DOM canvas and blitted behind the 2D HUD by
// src/view.js / src/menus.js. Presentation only: frame() reads the sim state (hunt h, camera, clock) and never writes to it. When WebGL2 is
// missing, the context is lost, or ?fig=2d is set, the game keeps its 2D art (src/art.js, src/figures.js).
import { createStage, THREE as T } from '../vendor3d/index.js';
import { createWorld, C, terrainH, LOOKS } from './world3d.js';
import { createEagle } from './eagle3d.js';
import { createFox } from './fox3d.js';
import { createArm } from './arm3d.js';
import { PALETTES } from '../src/figures.js';
import { viewOf, vfovFor } from '../src/cam3d.js';
import { K } from '../src/sim.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
let SNAP = false;      // first frame after a reset: smoothed values jump to their targets (static store shots, scene changes)
const damp = (cur, target, rate, dt) => (SNAP ? target : cur + (target - cur) * (1 - Math.exp(-rate * dt)));
const dampA = (cur, target, rate, dt) => (SNAP ? target : cur + wrap(target - cur) * (1 - Math.exp(-rate * dt)));
const ARM_DIST = 4.0;       // how far the glove is from the camera (m)

export async function createSteppe3d({ quality = 'medium', transparent = false } = {}) {
  const doc = globalThis.document;
  const host = doc.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:8px;height:8px;overflow:hidden;pointer-events:none;visibility:hidden';
  doc.body.appendChild(host);
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:8px;height:8px;display:block';
  host.appendChild(canvas);
  const stage = createStage({ canvas, container: host, quality, dprCap: 2, shadows: true, lighting: 'day', fov: 46, shadowSize: 20, preserveDrawingBuffer: transparent, transparent });
  if (!stage.supported) { host.remove(); return null; }
  const { scene, renderer, camera } = stage;
  camera.near = 0.12; camera.far = 3600; camera.updateProjectionMatrix();
  scene.add(camera);
  const F = { ok: true, lost: false, off: false, ready: false, canvas, stage, quality, host, sized: '', cost: { ema: 0, n: 0 }, last: null };
  stage.onContextLost(() => { F.lost = true; });
  stage.onContextRestored(() => { F.lost = false; F.sized = ''; world.look && applyLook(world.look); });

  // ---- scene content
  const world = createWorld(T, { quality });
  scene.add(world.group);
  const eagle = createEagle(T, { PALETTES }); scene.add(eagle.root);
  const fox = createFox(T); scene.add(fox.root); fox.root.visible = false;
  const arm = createArm(T); camera.add(arm.root);
  const sk = stage.lights;
  sk.key.shadow.camera.far = 140; sk.key.shadow.camera.near = 1; sk.key.shadow.bias = -0.0003; sk.key.shadow.normalBias = 0.03;
  sk.key.shadow.camera.left = -26; sk.key.shadow.camera.right = 26; sk.key.shadow.camera.top = 26; sk.key.shadow.camera.bottom = -26;
  stage._shadowOffset.copy(world.sunDir).multiplyScalar(60);
  sk.rim.intensity = 0.0;
  // a soft warm key on the hero bird for the menus (the play scene is lit by the low sun alone)
  const hero = new T.DirectionalLight(0xffe2b8, 0); hero.position.set(-3, 2, 2); scene.add(hero, hero.target);

  function applyLook(L) {
    sk.key.color.set(L.sun); sk.key.intensity = L.sunI;
    sk.hemi.color.set(L.ambCol); sk.hemi.groundColor.set(L.gnd); sk.hemi.intensity = L.hemi;
    scene.fog = new T.FogExp2(L.fog, L.fogD);
    scene.background = null;
    renderer.toneMappingExposure = 0.92;
    scene.environmentIntensity = 0.22;
  }
  let lookIdx = -1;
  const setLookIdx = (i) => { if (i === lookIdx) return; lookIdx = i; applyLook(world.setLook(i)); };
  setLookIdx(1);

  // ---- smoothed presenter state (all derived from displayed motion, never from sim flags)
  const S = {
    t: 0, eagle: { p: new T.Vector3(), has: false, yaw: 0, pitch: 0, roll: 0, speed: 0, phase: 0, glide: 0, fold: 1, legs: 1, sweep: 0, spread: 0.2, tailFan: 0.3, tailPitch: 0, load: 0, lastT: 0, stretch: 0, stretchT: 0 },
    fox: { p: new T.Vector3(), has: false, yaw: 0, speed: 0, phase: 0, gait: 0, amp: 0, hy: 0, hp: 0, ear: 0, mode: '' },
    hunt: -1, puffed: false, armDip: 0, lastPh: '', perchedYaw: 0.7,
  };
  const tv = new T.Vector3(), tv2 = new T.Vector3(), tq = new T.Quaternion(), tm = new T.Matrix4();

  // ---- arm in camera space, eagle on the glove
  function placeArm(view, glove, t, dip, raise, dist = ARM_DIST) {
    // glove anchor (virtual px) -> a point in front of the camera
    const tanV = Math.tan(view.vfov / 2), tanH = tanV * (view.W / view.H);
    const nx = (glove.x - view.W / 2) / (view.W / 2), ny = -(glove.y - view.H / 2) / (view.H / 2);
    const P = new T.Vector3(nx * tanH * dist, ny * tanV * dist, -dist);
    // arm direction in camera space: from the lower left toward the fingers, pointing forward and a touch up and right
    const dir = new T.Vector3(0.42, 0.16, -1).normalize();
    const z = dir.clone(), x = new T.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    tm.makeBasis(x, y, z); tq.setFromRotationMatrix(tm);
    arm.setPose({ t, dip, raise });
    arm.root.quaternion.copy(tq);
    const off = new T.Vector3(arm.perch.x, arm.perch.y, arm.perch.z).applyQuaternion(tq);
    arm.root.position.copy(P).sub(off);
    arm.root.visible = true;
    return P;      // camera-space perch point
  }

  // The eagle's world transform when it sits on the glove: toes on the perch point, body turned toward the quarry.
  function perchEagle(P, yawRel, pitch, t, alert, breathe, extra) {
    camera.updateMatrixWorld(true);
    const hd = Math.atan2(-camera.matrixWorld.elements[8], -camera.matrixWorld.elements[10]);   // camera heading about Y (3D)
    void hd;
    // camera forward on the ground plane
    tv.set(0, 0, -1).transformDirection(camera.matrixWorld); const th = Math.atan2(tv.x, tv.z);
    eagle.root.rotation.set(0, th - yawRel, 0);
    eagle.root.position.set(0, 0, 0);
    eagle.setPose({ fold: 1, legs: 1, spread: 0.2, load: 0, pitch, roll: 0, headYaw: 0, headPitch: -0.1 - alert * 0.12, tailFan: 0.25, tailPitch: 0.2, t, ruffle: 0.2 + alert * 0.2, ...(extra || {}) });
    eagle.root.updateMatrixWorld(true);
    const a = new T.Vector3(), b = new T.Vector3();
    eagle.legs[0].foot.getWorldPosition(a); eagle.legs[1].foot.getWorldPosition(b); a.add(b).multiplyScalar(0.5);
    const target = P.clone(); camera.localToWorld(target);
    eagle.root.position.copy(target).sub(a);
    eagle.root.position.y += 0.012;
  }

  // ---- one frame
  F.frame = (s) => {
    const W = s.W, H = s.H, play = s.mode === 'play';
    SNAP = F.last === null;
    const dt = F.last === null ? 0 : clamp(s.t - F.last, 0, 0.1); F.last = s.t;
    S.t = s.t;
    const h = play ? s.h : null;
    const view = viewOf(W, H, s.cam, s.vfovOverride || vfovFor(W, H, play ? 'play' : 'menu'));
    // camera
    camera.fov = view.vfov * 180 / Math.PI; camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.set(view.pos[0], view.pos[1], view.pos[2]);
    camera.lookAt(view.pos[0] + view.fwd[0], view.pos[1] + view.fwd[1], view.pos[2] + view.fwd[2]);
    camera.updateMatrixWorld(true);
    // look
    setLookIdx(clamp(s.level ?? 1, 0, LOOKS.length - 1));
    const wind = s.wind || { x: 0, z: 0 };
    world.update(dt, camera, wind);
    // palette
    const pal = PALETTES[clamp(s.plum | 0, 0, PALETTES.length - 1)];
    if (S.pal !== pal) { S.pal = pal; eagle.setPalette(pal); }
    // den
    if (h) {
      const dx = -h.den.x * C, dz = h.den.z * C;
      world.parts.den.position.set(dx, terrainH(dx, dz), dz); world.parts.den.visible = true;
    } else { world.parts.den.position.set(-14, terrainH(-14, 40), 40); world.parts.den.visible = true; }

    // ---- fox
    const E = S.eagle, X = S.fox;
    if (h && h.fox.mode !== 'gone') {
      const f = h.fox, fx = -f.x * C, fz = f.z * C, fy = terrainH(fx, fz);
      fox.root.visible = true;
      if (!X.has || S.hunt !== h.seed + h.n * 7919) { X.p.set(fx, fy, fz); X.has = true; X.speed = 0; X.phase = 0; X.yaw = Math.atan2(-Math.sin(f.hd), Math.cos(f.hd)); }
      const dx = fx - X.p.x, dz = fz - X.p.z, d = Math.hypot(dx, dz), sp = dt > 0 ? d / dt : X.speed;
      X.speed = damp(X.speed, sp, 14, Math.max(dt, 1e-3));
      X.p.set(fx, fy, fz);
      if (X.speed > 0.35 && d > 1e-4) X.yaw = dampA(X.yaw, Math.atan2(dx, dz), 9, dt);
      const mode = f.mode;
      const run = X.speed > 0.35;
      const gallop = X.speed > 3.2;
      const stride = gallop ? 1.45 : X.speed > 1.7 ? 0.95 : 0.62;
      X.phase += (d / stride) * Math.PI * 2;
      X.amp = damp(X.amp, run ? (gallop ? 1.0 : X.speed > 1.7 ? 0.62 : 0.4) : 0, 10, dt);
      // head scan while still: slow sweeps (listening); ears twitch; head low while foraging
      const tt = s.t;
      const scan = !run ? Math.sin(tt * 0.9 + (h.seed % 7)) * 0.7 : Math.sin(tt * 2.2) * 0.12;
      X.hy = damp(X.hy, scan, 5, dt);
      const crouch = mode === 'warn' ? 1 : mode === 'bwarn' ? 0.5 : 0;
      X.crouch = damp(X.crouch || 0, crouch, 9, dt);
      // pounce: a leap with the nose dipping at the top (mousing)
      let bounce = run ? Math.abs(Math.sin(X.phase * 0.5)) * (gallop ? 0.06 : 0.025) : 0;
      let pitch = run && gallop ? Math.sin(X.phase) * 0.1 : 0;
      let stretchK = gallop ? 0.7 : 0;
      if (mode === 'pounce') {
        const u = clamp(1 - f.mt / 0.9, 0, 1);
        bounce = Math.sin(u * Math.PI) * 0.55; pitch = lerp(0.6, -0.9, sstep(0.2, 0.95, u)); stretchK = 1;
      }
      const roll = mode === 'dodge' ? clamp(Math.sin(X.phase * 0.5) * 0.3 + 0.2 * (f.side || 1), -0.5, 0.5) : 0;
      const dist = tv.set(fx, fy, fz).distanceTo(camera.position);
      const sc = clamp(lerp(1.6, 4.6, sstep(10, 70, dist)), 1.4, 4.8) * (s.foxScale || 1);
      fox.root.scale.setScalar(sc);
      fox.root.position.set(fx, fy, fz); fox.root.rotation.set(0, X.yaw, 0);
      fox.setPose({
        phase: X.phase, gait: run ? (gallop ? 2 : 1) : 0, amp: X.amp * (gallop ? 1.0 : 0.8), crouch: X.crouch, headYaw: X.hy, headPitch: run && !gallop ? 0.28 : mode === 'warn' ? 0.35 : -0.05,
        earBack: gallop || mode === 'bwarn' ? 1 : 0, earTwitch: Math.sin(tt * 7.3) > 0.97 ? 0.35 : 0, tailLift: gallop ? -0.8 : mode === 'warn' ? 0.2 : 0.1,
        tailSway: run ? 0.35 : 0.5, bounce, pitch, roll, stretch: stretchK, t: tt, tailYaw: Math.sin(tt * 1.6) * 0.5,
      });
    } else {
      fox.root.visible = false; X.has = false;
    }
    // the burst of snow where the fox slipped away
    if (h) {
      const key = h.seed + h.n * 7919;
      if (S.hunt !== key) { S.hunt = key; S.puffed = false; }
      if (!S.puffed && h.fox.mode === 'gone' && (h.fox.puff || h.res)) {
        S.puffed = true;
        const p = h.res && h.res.at ? h.res.at : h.fox;
        const px = -p.x * C, pz = p.z * C;
        world.puff(px, terrainH(px, pz) + 0.3, pz, h.res && h.res.kind === 'pass' ? 18 : 10, h.res && h.res.cls === 'perfect' ? 1.3 : 1);
      }
    }

    // ---- eagle
    const gl = s.glove || { x: W * 0.3, y: H * 0.7 };
    let perched = true, P = null;
    const ph = h ? h.ph : 'menu';
    const tt = s.t;
    // body breathing and a wing-stretch every so often while on the glove
    const alert = h && h.ph === 'track' ? clamp(h.lock * 1.4, 0, 1) : 0;
    const cyc = (tt % 13) / 13;
    const stretching = cyc > 0.82 && cyc < 0.9 && !(h && h.ph !== 'track' && h.ph);
    void stretching;
    let windLean = 0;
    if (h) {
      const e = h.eagle;
      let glideU = 1;      // 1 = fully on the glove, 0 = fully in the world
      const sim = new T.Vector3(-e.x * C, Math.max(0.05, e.alt * C) + terrainH(-e.x * C, e.z * C) * 0, e.z * C);
      let wing = null;
      if (ph === 'track') { perched = true; }
      else if (ph === 'fly' || ph === 'stoop' || ph === 'strike' || ph === 'recall' || ph === 'done') {
        perched = false;
        if (ph === 'fly' || ph === 'stoop') glideU = 1 - sstep(0, 0.75, (h.t - (h.rel ? h.rel.t : 0)));
        if (ph === 'strike') glideU = 0;
        if (ph === 'recall' || ph === 'done') {
          const R = K.RECALL, u = clamp((h.rc ? h.rc.t : R.total) / R.total, 0, 1);
          glideU = sstep(0.62, 1.0, u);
          if (ph === 'done' || u >= 0.985) { perched = true; glideU = 1; }
        }
        // sim position in 3D (recall uses the same loop the 2D picture draws)
        let pos = sim;
        if (ph === 'recall' || ph === 'done') {
          const u = clamp((h.rc ? h.rc.t : K.RECALL.total) / K.RECALL.total, 0, 1), k = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          const from = h.res && h.res.from ? h.res.from : { x: e.x, z: e.z };
          const swing = Math.sin(u * Math.PI * 2.2) * 26 * (1 - u);
          const rx = lerp(from.x, 0, k) + swing, rz = lerp(from.z, 3, Math.pow(k, 0.9)), ra = lerp(10, 2.2, k) + Math.sin(u * Math.PI) * 8;
          pos = new T.Vector3(-rx * C, ra * C, rz * C);
        } else if (ph === 'strike') {
          pos = new T.Vector3(-e.x * C, Math.min(8, e.alt + h.pt * 5) * C, e.z * C);
        }
        if (!perched || glideU < 1) {
          // gloved position (world) blended with the world position
          if (!P) { P = placeArm(view, gl, tt, S.armDip, 0, s.armDist || ARM_DIST); }
          const gw = P.clone(); camera.localToWorld(gw);
          // lift off the glove, then go
          const target = new T.Vector3().lerpVectors(pos, gw, glideU);
          if (!E.has) { E.p.copy(target); E.has = true; E.yaw = -e.hd; E.pitch = 0; }
          const dx = target.x - E.p.x, dy = target.y - E.p.y, dz = target.z - E.p.z, d3 = Math.hypot(dx, dy, dz), dh = Math.hypot(dx, dz);
          const spd = dt > 0 ? d3 / dt : E.speed;
          E.speed = damp(E.speed, spd, 10, Math.max(dt, 1e-3));
          E.p.copy(target);
          if (dh > 1e-4 && E.speed > 1.2) E.yaw = dampA(E.yaw, Math.atan2(dx, dz), ph === 'stoop' ? 8 : 5, dt);
          const climb = dt > 0 ? dy / dt : 0;
          const hv = dt > 0 ? dh / dt : 1;
          const fp = Math.atan2(climb, Math.max(hv, 3));
          E.pitch = damp(E.pitch, clamp(fp, -1.15, 0.8), 6, dt);
          E.roll = damp(E.roll, clamp(e.bank * 0.95, -0.7, 0.7) * (ph === 'recall' ? 0.5 : 1), 7, dt);
          const land = ph === 'recall' || ph === 'done' ? sstep(0.55, 0.97, clamp((h.rc ? h.rc.t : 5.6) / 5.6, 0, 1)) : 0;
          const stoopK = ph === 'stoop' ? sstep(0, 0.2, h.st.t) : ph === 'strike' ? 0.4 * (1 - sstep(0.25, 0.7, h.pt)) : 0;
          // wing-beat: flapping while climbing and in the return, glides between beats in cruise, none in the stoop
          const climbing = ph === 'fly' && (e.alt < 11 || glideU > 0.1);
          const freq = climbing ? 2.7 : ph === 'recall' ? 2.0 + land * 1.4 : 1.7;
          const beatOn = ph === 'stoop' ? 0 : (climbing || ph === 'recall') ? 1 : (Math.sin(tt * 0.55 + 1.3) > -0.25 ? 1 : 0.1);
          E.glide = damp(E.glide, beatOn, 3, dt);
          E.phase += dt * Math.PI * 2 * freq * (0.8 + 0.4 * E.glide);
          const amp = (climbing ? 0.78 : 0.3 + 0.35 * land) * E.glide * (1 - stoopK) + 0.04;
          const sinP = Math.sin(E.phase);
          const flap = sinP * amp + (climbing ? 0.1 : 0.08) - stoopK * 0.25;
          const lag = Math.sin(E.phase - 1.15) * amp;
          const nearGlove = glideU;
          wing = {
            flap: lerp(flap, 0.2 * Math.sin(tt * 1.4), nearGlove * 0.0),
            lag, sweep: clamp(stoopK * 1.0 + (ph === 'strike' ? 0.0 : 0) - land * 0.0, 0, 1), fold: clamp(nearGlove > 0.6 ? (nearGlove - 0.6) / 0.4 : 0, 0, 1) * (ph === 'recall' || ph === 'done' ? 1 : (ph === 'fly' ? 1 : 0)),
            spread: lerp(1, 0.12, stoopK) * (1 - 0.0), tailFan: lerp(0.35 + 0.35 * land, 0.05, stoopK) + (ph === 'strike' ? 0.5 : 0), tailPitch: -0.0 + land * 0.55,
            legs: ph === 'strike' ? 1 : land > 0.55 ? sstep(0.55, 0.9, land) : 0, load: lerp(0.65, 0.0, stoopK) + land * 0.4, ruffle: 0.2 + 0.6 * stoopK,
          };
          if (ph === 'recall' || ph === 'done') wing.fold = sstep(0.9, 1.0, clamp((h.rc ? h.rc.t : 5.6) / 5.6, 0, 1));
          if (ph === 'fly') wing.fold = glideU > 0.2 ? clamp((glideU - 0.2) / 0.8, 0, 1) : 0;
          const pitchBody = clamp(E.pitch * 0.9 + land * 0.55 - (ph === 'stoop' ? 0.25 * stoopK : 0), -1.25, 1.0);
          wing.pitch = pitchBody;
          wing.roll = E.roll;
          wing.headYaw = 0; wing.headPitch = -pitchBody * 0.5 + (ph === 'stoop' ? 0.1 : 0);
          eagle.root.position.copy(E.p);
          const dist = E.p.distanceTo(camera.position);
          const sc = perched && glideU >= 1 ? 1 : clamp(lerp(1.0, 2.6, sstep(8, 55, dist)), 1, 2.7) * (s.eagleScale || 1);
          eagle.root.scale.setScalar(sc);
          eagle.root.rotation.set(0, E.yaw, 0);
          eagle.setPose({ ...wing, t: tt });
          // the arm still shows while the eagle departs
        }
      }
      if (perched) { E.has = false; E.speed = 0; }
    }
    if (perched) {
      if (!P) P = placeArm(view, gl, tt, S.armDip, 0, s.armDist || ARM_DIST);
      // face the quarry
      let sFox = 0.3;
      if (h && h.fox.mode !== 'gone') { const pf = view.proj({ mpx: 1, unit: 1 }, h.fox.x, h.fox.z, 0); sFox = clamp((pf.x - W / 2) / (W / 2), -1, 1); }
      const yawTarget = h ? clamp(0.6 + 0.6 * sFox, -0.3, 1.2) : (s.perchYaw ?? 0.85) + 0.05 * Math.sin(tt * 0.3);
      S.perchedYaw = dampA(S.perchedYaw, yawTarget, 4, dt);
      const breathe = Math.sin(tt * 1.9) * 0.02;
      perchEagle(P, S.perchedYaw, (s.pose && s.pose.pitch !== undefined ? s.pose.pitch : 0.62) + breathe - alert * 0.12, tt, alert, breathe, s.pose);
      eagle.root.scale.setScalar(1);
    }
    arm.root.visible = true;
    // the arm kicks up as the bird pushes off and dips as it lands
    const target = (h && (h.ph === 'fly') && h.rel && h.t - h.rel.t < 0.4) ? -0.8 : (h && (h.ph === 'recall' || h.ph === 'done') && perched ? 0.7 : 0);
    S.armDip = damp(S.armDip, target, 10, dt);
    S.lastPh = ph;

    hero.intensity = play ? 0 : (s.heroLight ?? 1.9); if (!play) { hero.target.position.copy(eagle.root.position); hero.position.copy(eagle.root.position).add(tv.set(-2.4, 2.2, 3.2).transformDirection(camera.matrixWorld).multiplyScalar(4)); }
    // light + shadow box follow the action
    const fx = eagle.root.visible && !perched ? eagle.root.position : fox.root.visible ? fox.root.position : tv2.set(camera.position.x, 0, camera.position.z + 18);
    stage.setShadowTarget(fx.x, 0, fx.z);
    sk.key.shadow.camera.updateProjectionMatrix();
    return view;
  };

  F.size = (wPx, hPx) => {
    wPx = Math.max(2, Math.round(wPx)); hPx = Math.max(2, Math.round(hPx));
    const key = `${wPx}x${hPx}`;
    if (F.sized === key && renderer.domElement.width === wPx && renderer.domElement.height === hPx) return;
    F.sized = key;
    renderer.setPixelRatio(1);
    renderer.setSize(wPx, hPx, false);
  };
  F.render = () => {
    if (F.lost) return false;
    const t0 = globalThis.performance ? performance.now() : 0;
    renderer.render(scene, camera);
    if (t0) { const ms = performance.now() - t0; F.cost.ema = F.cost.n ? F.cost.ema * 0.93 + ms * 0.07 : ms; F.cost.n++; }
    return true;
  };
  F.setQuality = (q) => { if (F.quality === q) return; F.quality = q; stage.setQuality(q); };
  F.scene = scene; F.camera = camera; F.world = world; F.eagle = eagle; F.fox = fox; F.arm = arm; F.state = S;
  F.ready = true;
  return F;
}
