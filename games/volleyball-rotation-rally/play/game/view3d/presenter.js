// 3D presenter: READS the simulation (game.getState().sim) and draws the hall, the ball and twelve players. It never writes back.
// Contact discipline: the sim owns where and when the ball is touched; the pose layer (actor.js / skills.js) makes the exact body part
// (palm, forearm) meet the ball at that exact moment, and the ball only ever follows the sim's flights.
import { Actor } from './actor.js';
import { TECH, BALL_R } from './skills.js';
import { createPosing } from './posing.js';
import { buildCourt, buildBall } from './court.js';
import { initialCam, fovFor } from '../src/camera.js';

const LIB = '../vendor3d/index.js';
const SKINS = [['tan', 'brown', 'light', 'deep', 'peach', 'clay', 'wood'], ['peach', 'wood', 'deep', 'tan', 'brown', 'light', 'clay']];
const HAIRS = [['black', 'brown', 'black', 'black', 'blond', 'ginger', 'black'], ['brown', 'black', 'black', 'grey', 'black', 'blond', 'brown']];
const KITS = [
  { top: '#2b6fd6', bottoms: '#173a82', socks: '#f4f4f4', trim: '#f4f4f4' },
  { top: '#d8423a', bottoms: '#7f1e1a', socks: '#f4f4f4', trim: '#f4f4f4' },
];
const LIBERO = [{ top: '#ffd24a', bottoms: '#173a82', socks: '#f4f4f4', trim: '#173a82' }, { top: '#f2f2ec', bottoms: '#7f1e1a', socks: '#f4f4f4', trim: '#7f1e1a' }];
const SCALE = { m: 1.25, f: 1.19 };
const G = 9.81;
const STEP_MS = 1000 / 60;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, loadHuman, createBlobShadows, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', mode: 'continuous' });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const cam0 = initialCam();
  stage.camera.fov = 30; stage.camera.near = 1; stage.camera.far = 120; stage.camera.updateProjectionMatrix();

  const P = { stage, THREE, humans: [], actors: [], ball: null, court: null, blobs: null, ready: false, women: null, lost: false, quality, K: SCALE.m, alphaStamp: 0, noRender: false };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; fitKey = ''; stage.resize(); stage.invalidate(); });

  async function build(women) {
    P.ready = false;
    for (const h of P.humans) stage.remove(h);
    if (P.court) stage.remove(P.court);
    if (P.ball) stage.remove(P.ball);
    if (P.blobs) stage.remove(P.blobs.mesh);
    P.humans = []; P.actors = [];
    const K = women ? SCALE.f : SCALE.m;
    P.K = K;
    P.court = buildCourt(stage, { netHeight: women ? 2.24 : 2.43 });
    stage.setLighting('indoor', { exposure: 0.8, hemi: 0.7, keyI: 2.4 });
    stage.setSky('#0d1722', '#0d1722', { near: 40, far: 110 });
    P.ball = buildBall(BALL_R); stage.add(P.ball);
    const char = women ? 'mannequin_f' : 'mannequin_m';
    for (let team = 0; team < 2; team++) for (let tp = 0; tp < 7; tp++) {
      const kit = tp === 6 ? LIBERO[team] : KITS[team];
      const h = await loadHuman({ character: char, kit, skin: SKINS[team][tp], hair: HAIRS[team][tp], legs: 'shorts', lod: 'auto' });
      h.root.scale.setScalar(K);
      h.groundClamp = 'auto'; h.footPlanting = true;
      h.play('ready_stance', { fade: 0 });
      h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      h.setPosition(0, 0, 0);
      stage.add(h);
      P.humans.push(h);
      P.actors.push({ a: new Actor(h), lastAct: -1, prev: null, cur: null, lock: null, yaw: team === 0 ? 0 : Math.PI, state: 'idle', phase: (team * 7 + tp) * 0.713, seed: 1 + (team * 7 + tp) * 0.37 });
    }
    P.blobs = createBlobShadows(20, { radius: 0.62, opacity: 0.9 }); stage.add(P.blobs.mesh);
    P.women = women; P.ready = true;
    stage.invalidate();
  }
  P.build = build;
  P.ready_p = build(false);

  // adaptive quality: if frames run long, drop the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) { perfLevel++; stage.renderer.setPixelRatio(Math.max(1, Math.min(perfLevel === 1 ? 1.5 : 1.0, stage.renderer.getPixelRatio()))); stage.invalidate(); }
    }
  }
  const vec = (o) => V(o.x, o.y, o.z);

  const { poseFor } = createPosing(THREE, () => P.K);
  P.poseFor = poseFor;

  // ---------------------------------------------------------------- the frame
  let lastT = null, lastRally = -1;
  const snap = { cur: null, prev: null, curT: 0, prevT: 0 };
  function capture(s) {
    return { t: s.t, pl: s.players.map((p) => ({ x: p.x, z: p.z, jy: p.jy, face: p.face, vx: p.vx, vz: p.vz })), ball: { x: s.ball.x, y: s.ball.y, z: s.ball.z } };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };

  // The WebGL canvas covers the kit canvas exactly: the whole screen, or (beyond the kit's 2.4:1 cap, where the 2D layer is centred with
  // bars) the same centred region. Re-fitted whenever the size changes (rotation, window resize, split screen).
  let fitKey = '';
  function fitCanvas(winW, winH) {
    const long = Math.max(winW, winH), short = Math.min(winW, winH), cap = 2.4;
    let w = winW, h = winH;
    if (long / short > cap) { if (winW > winH) w = Math.round(winH * cap); else h = Math.round(winW * cap); }
    const key = `${winW}x${winH}`;
    if (key === fitKey) return;
    fitKey = key;
    canvas.style.cssText = (w === winW && h === winH)
      ? 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0'
      : `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:${w}px;height:${h}px;display:block;pointer-events:none;z-index:0`;
    stage.resize();
  }
  function frame(game, view) {
    if (!P.ready || P.lost) return;
    const G0 = game.getState();
    const s = G0.sim;
    if (!s) { stage.setVisible(false); return; }
    if (G0.women !== undefined && G0.women !== P.women && !P.building) { P.building = true; build(G0.women).finally(() => { P.building = false; }); return; }
    stage.setVisible(true);
    if (!snap.cur || s.t < snap.curT - 1e-9 || s.match.rallies < lastRally) { snap.cur = snap.prev = capture(s); snap.curT = snap.prevT = s.t; for (const pa of P.actors) { pa.lastAct = -1; pa.prev = null; pa.cur = null; } lastT = null; }
    else if (s.t !== snap.curT) { snap.prev = snap.cur; snap.prevT = snap.curT; snap.cur = capture(s); snap.curT = s.t; }
    lastRally = s.match.rallies;
    let alpha = 1;
    if (P.alphaStamp && !P.manual) alpha = Math.max(0, Math.min(1, (performance.now() - P.alphaStamp) / STEP_MS));
    if (G0.paused || G0.frozen) alpha = 1;
    const tR = lerp(snap.prevT, snap.curT, alpha);
    let dt = lastT === null ? 0 : tR - lastT;
    if (dt < 0) dt = 0;
    lastT = tR;
    dt = Math.min(dt, 0.1);
    const pb = snap.prev.ball, cb = snap.cur.ball;
    const ballPos = V(lerp(pb.x, cb.x, alpha), lerp(pb.y, cb.y, alpha), lerp(pb.z, cb.z, alpha));
    const bm = P.ball;
    const heldBy = s.ball.held === null || s.ball.held === undefined ? -1 : s.ball.held;
    let blobN = 0;
    for (let i = 0; i < 14; i++) {
      const sp = s.players[i], H = P.humans[i], pa = P.actors[i];
      if (!sp.onCourt || (P.focus !== undefined && P.focus !== null && P.focus !== i)) { H.root.visible = false; continue; }
      H.root.visible = true;
      const a0 = snap.prev.pl[i], a1 = snap.cur.pl[i];
      const px = lerp(a0.x, a1.x, alpha), pz = lerp(a0.z, a1.z, alpha), jy = lerp(a0.jy, a1.jy, alpha);
      const view_sp = { ...sp, x: px, z: pz, jy, vx: a1.vx, vz: a1.vz };
      H.root.position.set(px, 0, pz);
      let dy = lerpAng(a0.face, a1.face, alpha) - pa.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const inAct = sp.act && tR >= sp.act.tc - 0.45 && tR <= sp.act.t1;
      if (inAct) pa.yaw = lerpAng(a0.face, a1.face, alpha); else pa.yaw += dy * Math.min(1, dt * (Math.hypot(a1.vx, a1.vz) > 1.4 ? 12 : 8));
      H.setFacing(pa.yaw);
      const speed = Math.hypot(a1.vx, a1.vz);
      const after = s.phase === 'dead' && s.last && tR - s.last.t > 0.4;
      const want = speed >= 0.5 ? 'run' : after ? (sp.team === s.last.winner ? 'cheer' : 'calm') : 'idle';
      if (want === 'run') { pa.state = 'run'; H.locomote(speed); }
      else if (pa.state !== want) { H.crossfade(want === 'cheer' ? 'celebrate_2' : want === 'calm' ? 'idle_relaxed' : 'ready_stance', 0.3); pa.state = want; }
      const watching = s.ball.vis && s.phase !== 'dead';
      H.lookAt(watching ? ballPos : null, { weight: 0.7, maxYaw: 1.2, maxPitch: 0.7 });
      try { H.autoLOD(stage.camera, canvas.clientHeight || 844); } catch { /* no LOD meshes */ }
      H.update(dt);
      idleLayer(pa, tR, speed, want);
      const act = sp.act;
      if (act && act.id !== pa.lastAct) { pa.prev = pa.cur || null; pa.cur = act; pa.lastAct = act.id; pa.lock = null; }
      let used = false;
      for (const ac of [pa.cur, pa.prev]) {
        if (!ac || used) continue;
        if (!TECH[ac.tech]) continue;
        const r = poseFor(view_sp, ac, pa, ballPos, tR, s);
        if (r.pose) { pa.a.apply(r.pose, dt); pa.last = { ac, r }; used = true; if (ac === pa.prev && r.t > r.def.dur[1]) pa.prev = null; if (P.debugMarks && r.pose.fix) debugMark(r.pose.fix, pa); }
      }
      if (!used && pa.cur && tR - pa.cur.tc > 1.6) pa.cur = null;
      if (blobN < 20) P.blobs.set(blobN++, px, pz, 0.62 * (1 - Math.min(0.7, jy * 0.6)), 0.012);
    }
    // the ball: in the server's left hand before the toss, else on the sim's flight
    if (heldBy >= 0 && !s.ball.vis) {
      const pa = P.actors[heldBy];
      const pp = pa.a.palmPoint('L', P.K), fr = pa.a.handFrame('L');
      bm.position.copy(pp).addScaledVector(fr.n, BALL_R); bm.visible = true;
    } else { bm.visible = !!s.ball.vis; bm.position.copy(ballPos); }
    if (s.ball.vis && heldBy < 0) {
      const sp = Math.hypot(s.ball.vx, s.ball.vz);
      if (sp > 0.05 || Math.abs(s.ball.vy) > 0.5) { bm.rotation.x += (s.ball.vz * dt) / BALL_R * 0.5; bm.rotation.z -= (s.ball.vx * dt) / BALL_R * 0.5; }
    }
    if (bm.visible && blobN < 20) P.blobs.set(blobN++, bm.position.x, bm.position.z, 0.34 / (1 + 0.14 * Math.max(0, bm.position.y - BALL_R)), 0.012);   // smaller as the ball rises: the gap between ball and shadow tells the height
    P.blobs.mesh.count = blobN;
    // --- camera: fixed for the whole match at a given screen size. The frame (position, aim, field of view) comes from the game's layout
    // (the same one the 2D HUD projects with), so the picture fills the whole screen in portrait and landscape and the HUD sits on it exactly.
    fitCanvas(kitCanvas.clientWidth || 720, kitCanvas.clientHeight || 1280);
    const cam = stage.camera;
    const fr = G0.frame || { ...cam0, fov: 30 };
    const co = P.camOverride || fr;
    cam.position.set(co.x, co.y, co.z); cam.lookAt(co.lx, co.ly, co.lz);
    const fov = co.fov || fr.fov;
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    stage.setShadowTarget(0, 0, 0);
    if (!P.noRender) { stage.render(); perfTick(); }
  }

  // dev only: small spheres at the target contact point (green) and where the touching surface really is (red)
  const dbg = [];
  function debugMark(fx, pa) {
    while (dbg.length < 2) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: dbg.length ? 0xff2020 : 0x20ff40, depthTest: false })); m.renderOrder = 10; stage.add(m); dbg.push(m); }
    const K = P.K;
    let cp;
    if (fx.bone === 'palm') cp = pa.a.palmPoint(fx.side, K); else if (fx.bone === 'palms') cp = pa.a._fixPoint({ bone: 'palms', scale: K }); else cp = pa.a._fixPoint({ bone: 'fores', n: fx.n, frac: fx.frac, scale: K });
    dbg[0].position.copy(fx.target); dbg[1].position.copy(cp);
  }

  // Live idle layer: breathing, a slow weight shift, a slightly different arm hang per player, seeded so nobody mirrors anybody.
  const _axX = V(1, 0, 0), _axY = V(0, 1, 0), _axZ = V(0, 0, 1);
  const _q = new THREE.Quaternion();
  function nudge(bone, ax, ang) { if (!bone || Math.abs(ang) < 1e-5) return; _q.setFromAxisAngle(ax, ang); bone.quaternion.multiply(_q); }
  function idleLayer(pa, t, speed, state) {
    const b = pa.a.b, ph = pa.phase, sd = pa.seed;
    const calm = state === 'cheer' ? 0.2 : speed > 0.5 ? 0.25 : 1;
    const br = Math.sin(t * 2 * Math.PI * 0.27 + ph) * 0.012 * calm;
    const sway = Math.sin(t * 2 * Math.PI * 0.11 + ph * 1.7) * 0.03 * calm;
    nudge(b.spine1, _axX, br); nudge(b.spine2, _axX, br * 0.7);
    nudge(b.spine, _axZ, sway * 0.5); nudge(b.spine2, _axZ, -sway * 0.4);
    const asym = ((sd * 7.3) % 1) - 0.5;
    nudge(b.L.clav, _axZ, 0.02 * asym * calm + br * 0.5); nudge(b.R.clav, _axZ, -0.02 * asym * calm - br * 0.5);
    nudge(b.head, _axY, Math.sin(t * 2 * Math.PI * 0.07 + ph * 2.3) * 0.04 * calm);
    b.pelvis.updateWorldMatrix(false, true);
  }

  // main.js notes each sim update so rendering can interpolate between fixed steps
  P.noteUpdate = () => { P.alphaStamp = performance.now(); };
  P.wrap = (game) => {
    const r = game.render.bind(game), u = game.update.bind(game);
    game.update = (dt, input) => { P.noteUpdate(); return u(dt, input); };
    game.render = (ctx, view) => {
      const cv = kitCanvas;
      view.cssW = cv.clientWidth || 720; view.cssH = cv.clientHeight || 1280;
      r(ctx, view);
      frame(game, view);
    };
    return game;
  };
  return P;
}
