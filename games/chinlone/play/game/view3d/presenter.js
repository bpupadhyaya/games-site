// 3D presenter: READS the simulation (game.getState().stage3d) and draws the plaza, the cane ball and six dancers. It never
// writes back. Contact discipline: the sim owns where and when the ball is touched; the pose layer (actor.js / skills.js) makes
// the exact body part meet the ball at that exact moment, and the ball only ever follows the sim's flights.
import { Actor } from './actor.js';
import { TECH, evalPose } from './skills.js';
import { buildPlaza, buildBall, buildShadowBlob, buildPuffs, dress, YARDS3D } from './plaza.js';
import { spot, TOUCHES, N } from '../src/sim.js';

const LIB = '../vendor3d/index.js';
// Six dancers: a mix of men and women in shirts and trousers or shorts in different colours (real-proportioned athlete characters).
const SKINTONE = { brown: '#a9784f', tan: '#c99a74' };
const DANCERS = [
  { ch: 'athlete_m', kit: { top: '#f4efe0', bottoms: '#1f5f8b', socks: '#e9e1c8' }, skin: 'brown', hair: 'black' },
  { ch: 'athlete_f', kit: { top: '#f6dbe3', bottoms: '#7a1f3d', socks: '#f0e6e0' }, skin: 'tan', hair: 'black' },
  { ch: 'athlete_m', kit: { top: '#e7efe2', bottoms: '#2f7d5b', socks: '#e9e1c8' }, skin: 'tan', hair: 'black' },
  { ch: 'athlete_f', kit: { top: '#f9edc8', bottoms: '#a8431f', socks: '#f0e6e0' }, skin: 'tan', hair: '#3a2416' },
  { ch: 'athlete_m', kit: { top: '#dde6f4', bottoms: '#43366b', socks: '#e9e1c8' }, skin: 'tan', hair: 'black' },
  { ch: 'athlete_f', kit: { top: '#fbf2f2', bottoms: '#c28a1f', socks: '#f0e6e0' }, skin: 'brown', hair: 'black' },
];

// spectators: a seated row on the mats near the ring, then a standing row behind them, around the back and sides only
// (the open front is where the camera is)
function crowdPoints() {
  const pts = [];
  const rows = [{ r: 5.3, n: 17, seated: 1, span: 2.5 }, { r: 6.5, n: 20, seated: 0, span: 2.6 }, { r: 7.8, n: 22, seated: 0, span: 2.55 }];
  let s = 3;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const a = ((i + 0.5 + (rnd() - 0.5) * 0.5) / row.n - 0.5) * 2 * row.span, r = row.r + (rnd() - 0.5) * 0.5;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      pts.push({ x, z, y: 0, yaw: Math.atan2(-x, -z) + (rnd() - 0.5) * 0.5, seated: row.seated });
    }
  }
  return pts;
}

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, loadHuman, createCrowd3d, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous' });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.5; stage.camera.far = 120;

  const P = { stage, THREE, humans: [], actors: [], ball: null, plaza: null, yard: -1, ready: false, lost: false, shadow: null, puffs: null, crowd: null, tails: [] };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const _e = new THREE.Euler(), _qq = new THREE.Quaternion();
  P.onLoss = null;   // set by main.js: lets the game fall back to its flat 2D scene while the GL context is gone
  stage.onContextLost(() => { P.lost = true; if (P.onLoss) P.onLoss(true); });
  stage.onContextRestored(() => { P.lost = false; P.sized = ''; stage.resize(); stage.invalidate(); if (P.onLoss) P.onLoss(false); });

  async function build() {
    P.ready = false;
    P.ball = buildBall(); stage.add(P.ball);
    P.shadow = buildShadowBlob(); stage.add(P.shadow);
    P.puffs = buildPuffs(quality === 'low' ? 12 : 28); stage.add(P.puffs.group);
    for (let i = 0; i < N; i++) {
      const d = DANCERS[i];
      const h = await loadHuman({ character: d.ch, kit: d.kit, skin: d.skin, hair: d.hair });
      h.groundClamp = 'auto'; h.footPlanting = true;
      try { h.setKit({ shoes: SKINTONE[d.skin] || '#b98a5e', socks: SKINTONE[d.skin] || '#b98a5e' }); } catch { /* optional */ }   // festival dance is barefoot
      const cos = dress(h, i, d.ch === 'athlete_f');
      P.tails.push({ meshes: cos.tails, bone: h.bones.Bip01_Spine, prev: new THREE.Vector3(), vel: new THREE.Vector3(), ang: [0, 0], angV: [0, 0], init: false });
      h.play('idle_relaxed', { fade: 0 });
      if (quality !== 'high' && i >= 2 && i <= 4) h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });   // the far dancers are small
      const sp = spot(i);
      h.setPosition(sp.x, 0, sp.z); h.setFacing(sp.yaw);
      stage.add(h);
      P.humans.push(h);
      P.actors.push({ a: new Actor(h), cur: null, prev: null, yaw: sp.yaw, state: 'idle', phase: i * 0.37, lastKey: null });
    }
    try {
      P.crowd = createCrowd3d(stage, {
        points: crowdPoints(),
        count: quality === 'high' ? 60 : quality === 'medium' ? 40 : 22, seed: 5, culture: ['south_asian', 'east_asian'],
        quality: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low', excitement: 0.3, kids: 0.14, props: { flag: 0.02, phone: 0.03, child: 0.1 },
      });
    } catch (e) { console.warn('crowd3d failed', e); }
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build();

  function setYard(i) {
    if (P.yard === i) return;
    P.yard = i;
    const y = YARDS3D[i] || YARDS3D[0];
    if (P.plaza) stage.remove(P.plaza);
    P.plaza = buildPlaza(stage, y);
    stage.setLighting(y.light, y.lightExtra || {});
    stage.setSky(y.sky, y.fog, { near: 24, far: 70 });
    stage.invalidate();
  }

  // adaptive quality: if frames run long, first drop shadows, then lower the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false; else stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        stage.invalidate();
      }
    }
  }

  // The act a dancer is asked to perform next, read from the sim: the touch for the ball in flight, or the foot scoop that
  // starts (or restarts) the dance.
  function actFor(run, i) {
    const f = run.fl;
    if (run.phase === 'flight' && f && f.cue && f.cue.dancer === i) {
      const c = f.cue;
      return { key: `t${f.t1.toFixed(3)}${c.touch}${c.side}`, tc: f.t1, kind: TOUCHES[c.touch].id, side: c.side, C: c.C, d: c.d || { x: 0, y: 1, z: 0 } };
    }
    if ((run.phase === 'ready' || run.phase === 'settle') && run.serve && run.serve.dancer === i && run.cues[0]) {
      const b = run.ball, B = run.cues[0].C;
      const dx = B.x - b.x, dz = B.z - b.z, dl = Math.hypot(dx, dz) || 1;
      const spt = spot(i);
      const lat = (b.x - spt.x) * spt.rx + (b.z - spt.z) * spt.rz;
      return { key: `s${run.serve.tc.toFixed(3)}`, tc: run.serve.tc, kind: 'foot', side: lat >= 0 ? 1 : -1, C: { x: b.x, y: 0.1, z: b.z }, d: { x: (dx / dl) * 0.55, y: 0.85, z: (dz / dl) * 0.55 } };
    }
    return null;
  }

  function poseFor(sp, ac, pa, ballPos, tNow) {
    const def = TECH[ac.kind]({});
    const C = V(ac.C.x, ac.C.y, ac.C.z), d = V(ac.d.x, ac.d.y, ac.d.z).normalize();
    const t = tNow - ac.tc;
    const pelvisBase = pa.a.b.pelvis.getWorldPosition(V());
    const lock = { L: pa.a.lockFallback('L'), R: pa.a.lockFallback('R') };
    const ctx = { m: ac.side, C, d, yaw: sp.yaw, yawT: sp.yaw, x: sp.x, z: sp.z, jy: 0, pelvisBase, H0: pa.a.pelvisRest.y, lock, ground: 0, look: ballPos };
    return { pose: evalPose(def, ctx, t, pa.a), def, ctx, t };
  }
  P.poseFor = poseFor;
  // Snap guard: a bone that would jump more than ~29 degrees in one frame (a clip or pose switching on/off) is eased in over a few
  // frames instead (critically-damped follow); normal motion passes through untouched.
  function smoothBones(pa, H, dt) {
    const st = pa.sm || (pa.sm = new Map());
    for (const k in H.bones) {
      const b = H.bones[k]; if (!b || !b.quaternion) continue;
      let s = st.get(b);
      if (!s) { st.set(b, { q: b.quaternion.clone(), ease: false }); continue; }
      const tq = b.quaternion;
      const ang = 2 * Math.acos(Math.min(1, Math.abs(s.q.dot(tq))));
      if (ang > 0.5 || (s.ease && ang > 0.03)) { s.ease = true; s.q.slerp(tq, 1 - Math.exp(-16 * Math.max(dt, 1 / 120))); b.quaternion.copy(s.q); }
      else { s.ease = false; s.q.copy(tq); }
    }
  }

  const camKey = { v: '' };
  let lastT = null, lastRun = null;
  function frame(game) {
    if (!P.ready || P.lost) return;
    const G0 = game.getState(), S = G0.stage3d;
    if (!S || !S.run || !S.rig) { stage.setVisible(false); return; }
    const run = S.run, rig = S.rig;
    // keep the 3D canvas exactly on the virtual rectangle the kit draws (it letterboxes beyond its maximum aspect)
    const cw = kitCanvas.clientWidth || 720, ch = kitCanvas.clientHeight || 1280;
    const sc = Math.min(cw / rig.W, ch / rig.H), w3 = Math.round(rig.W * sc), h3 = Math.round(rig.H * sc);
    const left = Math.round((cw - w3) / 2), top = Math.round((ch - h3) / 2);
    const key = `${w3}x${h3}@${left},${top}`;
    if (P.sized !== key) {
      canvas.style.width = `${w3}px`; canvas.style.height = `${h3}px`; canvas.style.left = `${left}px`; canvas.style.top = `${top}px`;
      P.sized = key; stage.resize();
    }
    setYard(S.yard | 0);
    stage.setVisible(true);
    if (lastRun !== run) for (const pa of P.actors) { pa.cur = null; pa.prev = null; pa.lastKey = null; }
    let dt = lastT === null || lastRun !== run ? 0 : run.t - lastT;
    if (dt < 0) dt = 0;
    lastT = run.t; lastRun = run; P.lastT = run.t;
    dt = Math.min(dt, 0.1);
    const tNow = run.t, b = run.ball;
    const ballPos = V(b.x, b.y, b.z);
    const ending = run.phase === 'end';
    for (let i = 0; i < N; i++) {
      const sp = spot(i), H = P.humans[i], pa = P.actors[i];
      H.setPosition(sp.x, 0, sp.z);
      pa.yaw = sp.yaw;
      H.setFacing(pa.yaw);
      const want = ending ? 'cheer' : run.phase === 'settle' || run.phase === 'fall' ? 'calm' : 'idle';
      if (pa.state !== want) { H.crossfade(want === 'cheer' ? 'celebrate_2' : 'idle_relaxed', 0.35); pa.state = want; }
      H.lookAt(ballPos, { weight: 0.75, maxYaw: 1.2, maxPitch: 0.6 });
      H.update(dt);
      const act = actFor(run, i);
      if (act && act.key !== pa.lastKey) { pa.prev = pa.cur; pa.cur = act; pa.lastKey = act.key; }
      let used = false;
      for (const ac of [pa.cur, pa.prev]) {
        if (!ac || used) continue;
        const r = poseFor(sp, ac, pa, ballPos, tNow);
        if (r.pose) { pa.a.apply(r.pose, dt); pa.last = r; used = true; if (ac === pa.prev && r.t > r.def.dur[1]) pa.prev = null; }
      }
      if (!used && pa.cur && tNow - pa.cur.tc > 1.2) pa.cur = null;
      H.setFingers('L', 'relaxed'); H.setFingers('R', 'relaxed');
      if (!used) { H.root.rotation.y = pa.yaw; H.root.updateMatrixWorld(true); }
      smoothBones(pa, H, dt);
    }
    // ball: spins with its flight (rolls about the axis of travel), soft ground shadow and a halo
    const bm = P.ball;
    bm.position.copy(ballPos);
    const inner = bm.userData.ball;
    const sx = (b.vx || 0), sz = (b.vz || 0);
    inner.rotation.x += dt * 2.2 + sz * dt * 1.4; inner.rotation.z -= dt * 1.6 + sx * dt * 1.4;
    const k = Math.max(0.35, 1 - Math.max(0, b.y) * 0.25);
    P.shadow.position.set(b.x, 0.016, b.z); P.shadow.scale.set(0.3 * k, 0.3 * k, 1);
    // contact physics: a dust puff and cane flecks where a foot or heel meets the ball low, a knock of the crowd on a good touch
    const ev = run.last;
    if (ev && ev !== P.lastEv) {
      P.lastEv = ev;
      if (ev.type === 'touch' || ev.type === 'drop') {
        const sp2 = spot(ev.dancer), low = b.y < 0.7;
        P.puffs.emit(b.x, 0.05, b.z, ev.type === 'drop' ? 5 : low ? 3 : 1, ev.type === 'drop' ? 0.34 : 0.2, 0.5);
        if (P.crowd && ev.type === 'touch' && ev.q === 'perfect' && (run.streak % 6 === 5)) P.crowd.react('cheer', { origin: [sp2.x, 0, sp2.z], radius: 18, intensity: 0.6 });
        if (P.crowd && ev.type === 'drop') P.crowd.react('groan', { origin: [sp2.x, 0, sp2.z], radius: 16, intensity: 0.4 });
      }
    }
    if (ending && !P.ended) { P.ended = true; if (P.crowd) P.crowd.react('ovation', { origin: [0, 0, 0], radius: 30, intensity: 1 }); }
    if (!ending) P.ended = false;
    P.puffs.update(dt);
    if (P.crowd) P.crowd.update(dt);
    // secondary motion: sash tails lag behind the hip (pendulum with damping), the bunting and palms sway
    P.tClock = (P.tClock || 0) + dt;
    const an = P.plaza && P.plaza.userData.anim; if (an) for (const f of an) f(P.tClock);
    for (const T of P.tails) {
      const wp = T.bone.getWorldPosition(V());
      if (!T.init) { T.prev.copy(wp); T.init = true; }
      const vx = (wp.x - T.prev.x) / Math.max(dt, 1e-3), vz = (wp.z - T.prev.z) / Math.max(dt, 1e-3); T.prev.copy(wp);
      const tx = Math.max(-1.1, Math.min(1.1, -vz * 0.35)), tz = Math.max(-1.1, Math.min(1.1, vx * 0.35));
      const kk = 38, cc = 6.5;
      T.angV[0] += ((tx - T.ang[0]) * kk - T.angV[0] * cc) * dt; T.ang[0] += T.angV[0] * dt;
      T.angV[1] += ((tz - T.ang[1]) * kk - T.angV[1] * cc) * dt; T.ang[1] += T.angV[1] * dt;
      T.meshes.forEach((m, j) => {
        if (!m.userData.q0) m.userData.q0 = m.quaternion.clone();
        _e.set(T.ang[0] * (1 + j * 0.3) * 0.6, 0, T.ang[1] * (1 + j * 0.3) * 0.6); _qq.setFromEuler(_e);
        m.quaternion.copy(m.userData.q0).multiply(_qq);
      });
    }
    // camera
    const cam = stage.camera;
    const rk = `${rig.key}|${rig.fov}|${w3}`;
    const co = P.camOverride;           // dev tools only: a free camera for pose checks
    if (co) {
      cam.position.set(co.x, co.y, co.z); cam.lookAt(co.lx, co.ly, co.lz);
      if (cam.fov !== co.fov) { cam.fov = co.fov; cam.aspect = rig.aspect; cam.updateProjectionMatrix(); camKey.v = ''; }
    } else {
      cam.position.set(rig.pos.x, rig.pos.y, rig.pos.z); cam.lookAt(rig.target.x, rig.target.y, rig.target.z);
      if (camKey.v !== rk || cam.fov !== rig.fov) { cam.fov = rig.fov; cam.aspect = rig.aspect; cam.updateProjectionMatrix(); camKey.v = rk; }
      // lens shift so the ring sits in the middle of the free stage rectangle (same maths as src/camera.js)
      cam.projectionMatrix.elements[8] = -rig.ox; cam.projectionMatrix.elements[9] = -rig.oy;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
    stage.setShadowTarget(0, 0, 0);
    if (!P.noRender && !P.lost) { stage.render(); perfTick(); }
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { r(ctx, view); frame(game); };
    return game;
  };
  return P;
}
