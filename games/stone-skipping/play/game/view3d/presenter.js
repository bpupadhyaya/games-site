// 3D presenter for Stone Skipping. It only READS the game state (the throw, the ripples, the wind, the pond, the aim) and draws the
// lakeshore, the water, the thrower, the stone and the splashes behind the transparent kit canvas. The kit canvas keeps the HUD,
// gauges, menus and input. Without WebGL2, with ?nogl, or while the context is lost, the 2D art plays and this layer takes over
// again when it is back.
import { meta } from '../src/layout.js';
import { GL } from '../src/glbridge.js';
import { STONES, PONDS, WINDUP, stoneAt } from '../src/sim.js';
import { buildWorld, landH } from './world.js';
import { makeStones, makeFx, STONE_VIS } from './fx.js';
import { Thrower, T_COIL, T_REL, T_END } from './actors.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const QS = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
export const FIG = { x: 0.5, z: -0.72 };           // where the thrower stands: his right hand is at x = 0 when the stone leaves

function pickQuality() {
  const m = QS.get('q'); if (m === 'low' || m === 'medium' || m === 'high') return m;
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
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 5, preserveDrawingBuffer: shotMode, fov: 38 }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  cam.near = 0.12; cam.far = 1500;

  const world = buildWorld(V3, stage, { quality });
  world.setTod(0);
  if (renderer.shadowMap.enabled) { const sc = stage.lights.key.shadow.camera; sc.left = -4.5; sc.right = 4.5; sc.top = 4.5; sc.bottom = -4.5; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix(); stage.lights.key.shadow.bias = -0.0005; stage.lights.key.shadow.normalBias = 0.02; stage.lights.key.shadow.radius = 4; }

  const P = { stage, THREE, world, ready: false, lost: false, quality, licenses: '', V3 };
  stage.onContextLost(() => { P.lost = true; GL.on = false; });
  stage.onContextRestored(() => { P.lost = false; P.cw = 0; world.setTod(world.tod); stage.resize(); stage.invalidate(); });

  // ---- the stone -----------------------------------------------------------------------------------------------------------------
  const stoneDefs = makeStones(THREE, STONES);
  const stoneRoot = new THREE.Group();            // world position
  const stoneTilt = new THREE.Group();            // nose up
  const stoneSpin = new THREE.Group();            // spin about its own axis
  const stoneMesh = new THREE.Mesh(stoneDefs[0].geo, stoneDefs[0].mat);
  stoneMesh.castShadow = true;
  stoneSpin.add(stoneMesh); stoneTilt.add(stoneSpin); stoneRoot.add(stoneTilt); stage.scene.add(stoneRoot);
  let stoneIdx = 0;
  const glowTex = (() => { const c = doc.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 1, 32, 32, 31); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.35, 'rgba(255,255,255,0.28)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0, fog: false }));
  glow.renderOrder = 9; stage.scene.add(glow);
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.renderOrder = 4; shadowBlob.frustumCulled = false; stage.scene.add(shadowBlob);
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  streak.rotation.x = -Math.PI / 2; streak.renderOrder = 9; streak.frustumCulled = false; stage.scene.add(streak);
  const fx = makeFx(THREE, stage.scene, { quality });

  function setStone(idx) {
    if (idx === stoneIdx) return;
    stoneIdx = idx; stoneMesh.geometry = stoneDefs[idx].geo; stoneMesh.material = stoneDefs[idx].mat;
  }

  // ---- the thrower ---------------------------------------------------------------------------------------------------------------
  let thrower = null;
  async function build() {
    const h = await loadHuman({ character: 'athlete_m', kit: { top: '#d9d2c2', bottoms: '#3b4a5c', socks: '#d9d2c2' }, skin: 'tan', hair: 'brown', lod: 'auto', quality });
    h.groundClamp = 'auto'; h.footPlanting = QS.has('fp');   // the feet are pinned by the clips' own foot IK (no planting pops)
    stage.add(h); stage.track(h);
    h.setLOD(0);
    h.setPosition(FIG.x, Math.max(0, landH(FIG.x, FIG.z)), FIG.z);
    h.setFacing(0);
    thrower = new Thrower(V3, h);
    P.thrower = thrower; P.human = h;
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- adaptive quality ----------------------------------------------------------------------------------------------------------
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

  // ---- the camera ----------------------------------------------------------------------------------------------------------------
  const V = { camPos: new THREE.Vector3(), tgt: new THREE.Vector3(), tmp: new THREE.Vector3(), hand: new THREE.Vector3(), relOff: new THREE.Vector3() };
  const CU = QS.get('cu') ? QS.get('cu').split(',').map(Number) : null;       // QA: ?cu=px,py,pz,tx,ty,tz[,fov] free camera
  function setCamera(rect, cw, ch, pos, tgt, vFovRect) {
    cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(tgt);
    // the vertical field of view applies to the rect; the full canvas is taller, with the principal point at the rect centre
    const k = meta.height / Math.max(1, rect.h);
    const vf = 2 * Math.atan(k * Math.tan(vFovRect * D2R / 2));
    cam.fov = vf / D2R; cam.aspect = cw / ch; cam.updateProjectionMatrix();
    const ndcX = 2 * (rect.x + rect.w / 2) / meta.width - 1, ndcY = 1 - 2 * (rect.y + rect.h / 2) / meta.height;
    const e = cam.projectionMatrix.elements; e[8] = -ndcX; e[9] = -ndcY;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);
  }

  // ---- the thrower's clip state --------------------------------------------------------------------------------------------------
  const Dd = { mode: 'idle', coil: 0, clipT: 0, which: 0, name: 'skipA', coilStart: 0, lastT: null, followT: 0, flSeen: null, relPos: null, tiltS: undefined };
  function playClip(name, fade) { thrower.h.play(name, { fade, loop: false }); Dd.name = name; }
  function scrub(t) {
    const tr = thrower.h.layers.base.current;
    if (tr && tr.clip && tr.clip.name === Dd.name) { tr.speed = 0; tr.time = clamp(t, 0, T_END - 1e-3); }
  }
  // One clip does everything: the crouch is its first frame, the pull scrubs toward the coil, the throw plays through and ends back on
  // the crouch. Nothing is cross-faded between clips except in the rare case of a new throw starting mid follow-through.
  function direct(ws, st, dt, isPlay) {
    const fl = ws.fly, A = st.aim;
    if (fl && fl !== Dd.flSeen) {                 // a new throw begins
      Dd.flSeen = fl; Dd.coilStart = isPlay ? Dd.coil : 0;
      if (Dd.mode === 'follow') { Dd.which ^= 1; playClip(thrower.clipNames[Dd.which], 0.25); Dd.relPos = null; }
      Dd.mode = 'throw'; Dd.relPos = null; Dd.tiltS = undefined;
    }
    if (Dd.mode === 'throw') {
      if (fl === Dd.flSeen && fl.t < 0) {
        let t;
        if (fl.t0 < -WINDUP - 1e-6 && fl.t < -WINDUP) { const u = clamp((fl.t - fl.t0) / (-WINDUP - fl.t0), 0, 1); t = T_COIL * smooth(u); }
        else {
          const u = clamp((fl.t + WINDUP) / WINDUP, 0, 1), c0 = fl.t0 < -WINDUP - 1e-6 ? T_COIL : Dd.coilStart;
          const k = WINDUP / Math.max(0.05, T_REL - c0), a3 = k - 2, b2 = 3 - k;      // eases out of the coil and arrives at the clip's own speed (C1 with the follow-through)
          t = c0 + (T_REL - c0) * (a3 * u * u * u + b2 * u * u);
        }
        Dd.clipT = t;
      } else { Dd.mode = 'follow'; Dd.followT = fl === Dd.flSeen ? T_REL + fl.t : Math.max(Dd.clipT, T_REL); Dd.clipT = Dd.followT; }
    } else if (Dd.mode === 'follow') {
      Dd.followT += dt; Dd.clipT = Dd.followT;
      if (Dd.followT >= T_END) { Dd.mode = 'idle'; Dd.coil = 0; Dd.clipT = 0; }
    }
    if (Dd.mode === 'idle' || Dd.mode === 'scrub') {
      const target = isPlay && st.run && st.run.phase === 'aim' && !fl ? clamp(A.pull, 0, 1) * T_COIL : 0;
      Dd.coil += (target - Dd.coil) * (dt > 0 ? 1 - Math.exp(-dt * 16) : 1);
      Dd.mode = Dd.coil > 0.004 ? 'scrub' : 'idle';
      Dd.clipT = Dd.coil;
    }
    if (Dd.name !== thrower.clipNames[Dd.which]) playClip(thrower.clipNames[Dd.which], 0);
    scrub(Dd.clipT);
  }
  // breathing and a slow weight shift, added on top of the pose after the animation update (the crouch has no idle motion of its own)
  const breathQ = new THREE.Quaternion(), breathE = new THREE.Euler();
  function breathe(t, amt) {
    const b = thrower.h.bones, k = amt;
    const add = (name, x, y, z) => { const bo = b[name]; if (!bo) return; breathE.set(x, y, z, 'XYZ'); breathQ.setFromEuler(breathE); bo.quaternion.multiply(breathQ); };
    const br = Math.sin(t * 1.65), sh = Math.sin(t * 0.55);
    add('Bip01_Spine1', 0, 0, 0.016 * br * k); add('Bip01_Spine2', 0, 0, 0.022 * br * k); add('Bip01_Neck', 0, 0, -0.012 * br * k);
    add('Bip01_R_Clavicle', 0, 0, 0.02 * br * k); add('Bip01_L_Clavicle', 0, 0, 0.02 * br * k);
    add('Bip01_Pelvis', 0, 0.018 * sh * k, 0.006 * br * k); add('Bip01_Head', 0.01 * Math.sin(t * 0.37) * k, 0.03 * Math.sin(t * 0.29 + 1) * k, 0);
  }

  // ---- one frame ----------------------------------------------------------------------------------------------------------------
  const rippleList = [];
  P.grip = QS.get('grip') ? QS.get('grip').split(',').map(Number) : [0.07, 0, 0, 0, 0, 1.57];
  const offM = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), Es = new THREE.Euler(), OP = new THREE.Vector3(), OS = new THREE.Vector3();
  let lastWall = null;
  function frame() {
    if (!P.ready || P.lost || P.off) { GL.on = false; stage.setVisible(false); return; }
    const views = GL.views, st = GL.state;
    const qa = P.qa;
    if ((!views.length && !qa) || !st) { GL.on = true; stage.setVisible(false); return; }
    GL.on = true;
    const view = qa ? { kind: 'att', rect: { x: 0, y: 0, w: meta.width, h: meta.height }, ws: qa.ws || st.ws } : views[views.length - 1];
    const isPlay = view.kind === 'play';
    const ws = view.ws || st.ws;
    const rect = view.rect;
    const now = globalThis.performance.now();
    const cw = (kitCanvas && kitCanvas.clientWidth) || canvas.clientWidth || 720, ch = (kitCanvas && kitCanvas.clientHeight) || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    stage.setVisible(true);
    let dt = Dd.lastT === null ? 0 : st.t - Dd.lastT; Dd.lastT = st.t;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);
    const wall = lastWall === null ? 0 : clamp((now - lastWall) / 1000, 0, 0.1); lastWall = now;

    const pond = ws.pond | 0;
    if (P.pond !== pond) { P.pond = pond; world.setTod(QS.get('tod') ? +QS.get('tod') : pond); P.cond = undefined; }
    const pdef = PONDS[pond];
    if (P.cond !== ws.cond) { P.cond = ws.cond; world.setPond(pond, pdef, ws.cond); }

    if (qa && !qa.camOnly) { if (qa.clip) { if (Dd.name !== qa.clip) { thrower.h.play(qa.clip, { fade: 0, loop: false }); Dd.name = qa.clip; } scrub(qa.t || 0); } Dd.mode = 'qa'; } else direct(ws, st, dt, isPlay);
    stage.update(dt > 0 ? dt : wall, { renderNow: false });
    if (!qa) breathe(st.t + (P.manualDt != null ? 0 : 0), Dd.mode === 'idle' || Dd.mode === 'scrub' ? 1 : 0.35);
    const fl = ws.fly;
    const idx = fl ? fl.idx : (isPlay && st.run && st.aim.tray ? st.aim.tray[st.aim.sel] : 0);
    setStone(idx);
    const def = stoneDefs[idx];
    const sc = STONE_VIS;
    const hb = thrower.h.bones.Bip01_R_Hand; hb.updateWorldMatrix(true, false);
    V.hand.setFromMatrixPosition(hb.matrixWorld);
    let sx = V.hand.x, sy = V.hand.y, sz = V.hand.z, flying = false, sunkNow = false;
    if (!fl || fl.t < 0) {
      // in the hand
      stoneRoot.matrixAutoUpdate = false;
      const grip = P.grip; Es.set(grip[3], grip[4], grip[5]); Q4.setFromEuler(Es); OP.set(grip[0], grip[1], grip[2]); OS.set(sc, sc, sc);
      offM.compose(OP, Q4, OS);
      stoneRoot.matrix.copy(hb.matrixWorld).multiply(offM);
      stoneRoot.matrixWorldNeedsUpdate = true;
      stoneTilt.rotation.set(0, 0, 0); stoneSpin.rotation.set(0, 0, 0);
      Dd.relPos = null;
      glow.material.opacity = 0; streak.material.opacity = 0;
    } else {
      stoneRoot.matrixAutoUpdate = true; stoneRoot.scale.setScalar(sc);
      const res = fl.res, s = stoneAt(res, fl.t);
      const sunk = fl.t > res.dur ? fl.t - res.dur : 0;
      if (!Dd.relPos) { Dd.relPos = V.hand.clone(); V.relOff.set(V.hand.x - 0, V.hand.y - 0.26, V.hand.z - 0); }
      const k = Math.exp(-fl.t / 0.055);
      sx = V.relOff.x * k; sz = s.z + V.relOff.z * k;
      sy = (sunk > 0 ? -sunk * 0.3 : s.y) + V.relOff.y * k;
      stoneRoot.position.set(sx, sy + (sunk > 0 ? 0 : def.T * sc), sz);
      const skipIdx = Math.min(s.f, res.skips.length);
      const tl = skipIdx > 0 ? res.skips[skipIdx - 1].tilt : res.tilt0;
      Dd.tiltS = Dd.tiltS === undefined ? tl : Dd.tiltS + (tl - Dd.tiltS) * (dt > 0 ? 1 - Math.exp(-dt * 14) : 1);
      const tilt = clamp(Dd.tiltS, -10, 45) * D2R;
      const spinA = fl.t * (res.spin0 || 0) * TAU * 0.5;
      stoneTilt.rotation.set(-tilt * 0.9, 0, 0);
      stoneSpin.rotation.set(0.04 * Math.sin(fl.t * 11), spinA, 0.05 * Math.cos(fl.t * 9));
      stoneRoot.rotation.set(0, 0, 0);
      flying = true; sunkNow = sunk > 0;
      const air = s.y > 0.01 && !sunkNow;
      glow.position.set(sx, stoneRoot.position.y + 0.02, sz); glow.scale.setScalar(0.3);
      glow.material.opacity = sunkNow ? 0 : air ? 0.4 : 0.18;
      const sp = Math.max(4, res.speed * 0.8);
      streak.position.set(sx, Math.max(0.01, stoneRoot.position.y), sz - sp * 0.012);
      streak.scale.set(0.07, sp * 0.026, 1); streak.material.opacity = sunkNow ? 0 : 0.26;
    }
    {
      const hgt = flying ? Math.max(0, stoneRoot.position.y) : 0.4;
      shadowBlob.position.set(flying ? sx : V.hand.x, 0.003, flying ? sz : V.hand.z);
      shadowBlob.scale.setScalar(0.16 + hgt * 0.5); shadowBlob.material.opacity = flying && !sunkNow ? clamp(0.38 - hgt * 0.5, 0, 0.38) : 0;
    }
    void sy;

    // ripples: rings in the water shader; crowns, spray and foam from the same ages
    rippleList.length = 0;
    const RU = world.uniforms.rip;
    let ri = 0;
    const rs = ws.ripples;
    for (let i = rs.length - 1; i >= 0 && ri < RU.length; i--) {
      const r = rs[i], age = ws.t - r.t0;
      if (age < 0 || age > 3.4) continue;
      RU[ri++].set(r.x || 0, r.z, age, r.s);
      rippleList.push({ x: r.x || 0, z: r.z, age, size: r.s, kind: r.s >= 1.3 ? 'sink' : 'skip' });
    }
    for (; ri < RU.length; ri++) RU[ri].set(0, 0, 0, 0);
    world.uniforms.water.uSwellC.value = pdef.c * Math.max(0, fl ? fl.t : 0) - (ws.cond ? ws.cond.phase : 0);
    fx.update(rippleList, 0xffffff);

    // camera: behind and to the right of the thrower, then chasing the stone
    const chase = isPlay && fl && fl.t > 0 ? smooth(clamp((Math.max(0, sz) - 3.0) / 9, 0, 1)) : 0;
    const base = isPlay ? ws.camZ : -7.4;
    const camZ = base + (isPlay ? lerp(0, 2.0, chase) : 0);
    const drift = isPlay ? 0 : 1;
    if (isPlay) V.camPos.set(lerp(-0.55, -0.35, chase), lerp(1.32, 0.92, chase), camZ);
    else V.camPos.set(-1.9 + Math.sin(st.t * 0.12) * 0.25, 1.55 + Math.sin(st.t * 0.17) * 0.05, camZ);
    const stoneZ = fl ? Math.max(0, sz) : 0;
    if (isPlay) V.tgt.set(lerp(rect.w > rect.h ? 1.05 : 0.78, 0.0, chase), lerp(0.55, 0.2, chase), lerp(2.2, Math.max(stoneZ, camZ + 5.0) + 2.5, chase));
    else V.tgt.set(0.5, 0.45, 3.0);
    void drift;
    if (qa && qa.cam) { V.camPos.set(qa.cam[0], qa.cam[1], qa.cam[2]); V.tgt.set(qa.cam[3], qa.cam[4], qa.cam[5]); }
    else if (CU) { V.camPos.set(CU[0], CU[1], CU[2]); V.tgt.set(CU[3], CU[4], CU[5]); }
    const vfov = qa && qa.cam && qa.cam[6] ? qa.cam[6] : CU && CU[6] ? CU[6] : isPlay ? lerp(38, 31, chase) : 40;
    V.camPos.y = Math.max(V.camPos.y, landH(V.camPos.x, V.camPos.z) + 0.5);
    setCamera(rect, cw, ch, V.camPos, V.tgt, vfov);
    P.camPos = V.camPos; GL.camZ = V.camPos.z;
    world.update(wall, { camPos: V.camPos });
    stage.setShadowTarget(FIG.x - 0.2, 0, FIG.z + 0.4);
    stage.lights.rim.position.set(FIG.x - 3, 3.2, FIG.z + 7);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    renderer.render(stage.scene, cam);
    stage.stats.renders++;
    GL.project = (x, y, z) => { V.tmp.set(x, y, z).project(cam); return [(V.tmp.x + 1) / 2 * meta.width, (1 - V.tmp.y) / 2 * meta.height, V.tmp.z]; };
    perfTick(now);
  }
  P.frame = frame; P.Dd = Dd; P.stoneRoot = stoneRoot;

  // ---- the app icon: a low, close shot of the stone mid-skip over its splash crown, the ring chain running back to the thrower ------------
  P.renderIcon = (opts = {}) => {
    const size = opts.size || 2048;
    const T = 0;
    world.setTod(opts.tod ?? 0);
    const U = world.uniforms.sky;
    U.uSunDir.value.set(...(opts.sun || [-0.12, 0.07, -0.99])).normalize();
    U.uTime.value = 3.0;
    world.setPond(0, PONDS[0], { wind: 0.5, phase: 0 });
    // thrower: follow-through, facing the camera
    Dd.mode = 'qa'; thrower.h.play('skipA', { fade: 0, loop: false }); Dd.name = 'skipA'; scrub(opts.pose ?? 0.84);
    thrower.h.update(0.001); stage.update(0.001, { renderNow: false });
    stoneIdx = -1; setStone(opts.stone ?? 4);
    const def = stoneDefs[opts.stone ?? 4];
    stoneRoot.matrixAutoUpdate = true; stoneRoot.scale.setScalar(1.3);
    const sp = opts.stonePos || [0.12, 0.12, 3.5];
    stoneRoot.position.set(sp[0], sp[1] + def.T * 1.3, sp[2]);
    stoneTilt.rotation.set(0.2, 0, 0.12); stoneSpin.rotation.set(0, 1.0, 0);
    // skips behind it: a ring chain back toward the thrower
    const chain = [[3.45, 0.07, 1.1], [2.7, 0.55, 1.0], [1.9, 1.1, 0.9], [1.1, 1.8, 0.85]];
    const RU = world.uniforms.rip; const list = [];
    chain.forEach((c, i) => { RU[i].set(0.12, c[0], c[1], c[2]); list.push({ x: 0.12, z: c[0], age: c[1], size: c[2] * (opts.crown || 1.5), kind: 'skip' }); });
    for (let i = chain.length; i < RU.length; i++) RU[i].set(0, 0, 0, 0);
    fx.update(list, 0xfff2e0);
    glow.material.opacity = 0.25; glow.position.set(sp[0], sp[1] + 0.02, sp[2]); glow.scale.setScalar(0.3);
    streak.material.opacity = 0; shadowBlob.material.opacity = 0;
    const cp = opts.cam || [0.3, 0.2, 4.2, 0.3, 0.62, -0.4, 34];
    V.camPos.set(cp[0], cp[1], cp[2]); V.tgt.set(cp[3], cp[4], cp[5]);
    cam.position.copy(V.camPos); cam.up.set(0, 1, 0); cam.lookAt(V.tgt); cam.fov = cp[6]; cam.aspect = 1; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    world.update(0, { camPos: V.camPos });
    stage.setShadowTarget(FIG.x - 0.2, 0, FIG.z + 0.6);
    stage.lights.key.position.set(FIG.x - 3.5, 2.6, FIG.z - 3);   // fills the figure from the camera side
    stage.lights.key.intensity = opts.keyI ?? 3.4; stage.lights.hemi.intensity = opts.hemi ?? 1.5;
    stage.lights.rim.position.set(2, 2.5, 8);
    stage.lights.rim.intensity = 3.0;
    P.freeze = true;
    return V3.board3d.renderIcon({ scene: stage.scene, camera: cam, size, renderer, background: '#10162a', bloom: opts.bloom ?? 0.35, vignette: opts.vignette ?? 0.45, exposure: opts.exposure ?? 0.95 });
  };

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; GL.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  // the 2D layer renders first (collecting the views it wants), then this layer draws them
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { GL.views.length = 0; r(ctx, view); if (P.freeze) return; frame(); };
    return game;
  };
  return P;
}
