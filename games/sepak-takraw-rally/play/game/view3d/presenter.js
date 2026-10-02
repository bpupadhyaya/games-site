// 3D presenter: READS the simulation (game.getState().sim) and draws the court, ball and six athletes. It never writes back.
// Contact discipline: the sim owns where and when the ball is touched; the pose layer (actor.js / skills.js) makes the exact
// body part meet the ball at that exact moment, and the ball only ever follows the sim's flights.
import { Actor } from './actor.js';
import { TECH, evalPose } from './skills.js';
import { buildCourt, buildBall } from './court.js';

const LIB = '../vendor3d/index.js';
const SKINS = ['peach', 'clay', 'wood', 'ivory', 'tan', 'brown'];
const HAIRS = ['black', 'brown', 'black', 'blond', 'brown', 'black'];
const KITS = [
  { top: '#d0342c', bottoms: '#f4f4f4', socks: '#f4f4f4' },
  { top: '#1f6fc4', bottoms: '#f4f4f4', socks: '#f4f4f4' },
];
const G = 9.81;

// Quality tier: 'high' (DPR 2, 2048 shadows), 'medium' (DPR 1.5, 1024) or 'low' (DPR 1, no shadows). ?q=low|medium|high overrides; weak devices start on medium.
function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', mode: 'continuous' });
  const quality_ = quality;
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.fov = 48; stage.camera.near = 0.3; stage.camera.far = 90; stage.camera.updateProjectionMatrix();

  const P = { stage, THREE, humans: [], actors: [], ball: null, court: null, ready: false, venue: null, women: null, lost: false };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  const blobMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.32, roughness: 1, depthWrite: false });
  const blobGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.01, 16);
  async function build(women, venue) {
    // rebuild the whole scene content (called at start and when the event / venue changes)
    P.ready = false;
    for (const h of P.humans) stage.remove(h);
    if (P.court) stage.remove(P.court);
    if (P.ball) stage.remove(P.ball);
    P.humans = []; P.actors = [];
    P.court = buildCourt(stage, { venue, netHeight: women ? 1.42 : 1.52 });
    stage.setLighting(venue === 'beach' ? 'day' : 'indoor', venue === 'beach' ? {} : { exposure: 0.72, hemi: 0.6, keyI: 2.3 });
    if (venue === 'hall') stage.setSky('#0c1824', '#0c1824', { near: 22, far: 70 });
    P.ball = buildBall(); stage.add(P.ball);
    const char = women ? 'mannequin_f' : 'mannequin_m';
    for (let i = 0; i < 6; i++) {
      const team = i < 3 ? 0 : 1;
      const h = await loadHuman({ character: char, kit: KITS[team], skin: SKINS[i], hair: HAIRS[i], legs: 'shorts' });
      h.groundClamp = 'auto'; h.footPlanting = true;
      h.play('ready_stance', { fade: 0 });
      if (quality !== 'high' && team === 1) h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });   // the far team is small: no shadow pass for it on medium / low
      h.setPosition(0, 0, 0);
      stage.add(h);
      P.humans.push(h);
      P.actors.push({ a: new Actor(h), lastAct: -1, prev: null, lock: null, yaw: team === 0 ? 0 : Math.PI, state: 'idle', phase: i * 0.37 });
    }
    P.women = women; P.venue = venue; P.ready = true;
    stage.invalidate();
  }
  P.build = build;
  P.ready_p = build(false, 'hall');

  // adaptive quality: if frames run long, first drop the far team's shadows, then lower the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) { stage.renderer.shadowMap.enabled = false; }
        else stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        stage.invalidate();
      }
    }
  }
  let lastT = null, lastRally = -1;
  const vec = (o) => V(o.x, o.y, o.z);

  function actCtx(sp, act, pa, H, ball) {
    let m = act.side === 'R' ? 1 : -1;
    if (act.kind === 'receive' || act.kind === 'set' || act.kind === 'free' || act.kind === 'dive') {
      // the touching side follows the final geometry: the ball relative to the body once it faces the target
      const tx = (act.to ? act.to.x : sp.x) - sp.x, tz = (act.to ? act.to.z : sp.z + 1) - sp.z, yf = Math.atan2(tx, tz);
      const lat = (act.c.x - sp.x) * Math.cos(yf) - (act.c.z - sp.z) * Math.sin(yf);
      m = lat > 0 ? -1 : 1;           // ball on the body's left -> use the left foot (m = -1 mirrors the right-foot technique)
    }
    const C = vec(act.c);
    if (act.fail && act.kind === 'dive') { const dx = C.x - sp.x, dz = C.z - sp.z, dl = Math.hypot(dx, dz) || 1; C.x -= dx / dl * 0.3; C.z -= dz / dl * 0.3; C.y = Math.max(C.y, 0.2); }
    const to = act.to || { x: sp.x, z: sp.z + (sp.team === 0 ? 3 : -3) };
    const hx = to.x - C.x, hz = to.z - C.z, hl = Math.hypot(hx, hz) || 1;
    let d;
    const kind = act.kind;
    if (kind === 'attack') { const T = Math.max(0.52, Math.hypot(hx, hz, C.y) / 14); d = V(hx / T, (0.07 - C.y) / T + 0.5 * G * T, hz / T); }
    else if (kind === 'serve') { const T = 0.9; d = V(hx / T, (0.07 - C.y) / T + 0.5 * G * T, hz / T); }
    else if (kind === 'block') { d = act.kill ? V(hx * 0.4, -3, hz * 0.4) : V(hx * 0.4, 3, hz * 0.4); }
    else if (kind === 'toss') { const T = 1.05; d = V(hx / T, (1.3 - C.y) / T + 0.5 * G * T, hz / T); }
    else { const T = 1.15; d = V(hx / T, (1.0 - C.y) / T + 0.5 * G * T, hz / T); }
    d.normalize();
    return { m, C, d, yawT: Math.atan2(hx, hz), hl };
  }
  const techName = (act) => {
    if (act.kind === 'serve') return 'serve';
    if (act.kind === 'toss') return 'toss';
    if (act.kind === 'block') return 'block';
    if (act.kind === 'attack') return { roll: 'roll', back: 'back', scissor: 'scissor', header: 'headA', foot: 'spikeFoot' }[act.atype] || 'roll';
    return { foot: 'foot', knee: 'knee', footHi: 'footHi', chest: 'chest', head: 'head', dive: 'lunge' }[act.tech] || 'foot';
  };

  // Pose for one act at sim time `tNow` (also used by the dev verification scripts).
  function poseFor(sp, ac, pa, ballPos, tNow) {
    const name = techName(ac);
    const ctx0 = actCtx(sp, ac, pa, null, null);
    const def = TECH[name]({ lift: Math.max(0, Math.min(0.4, (ac.c.y - 1.62) * 0.95)), lunge: ac.lunge || 0 });
    const t = tNow - ac.tc;
    const pelvisBase = pa.a.b.pelvis.getWorldPosition(V());
    // planted feet: follow the animated feet while the player is still arriving, freeze them once the player has stopped
    if (!pa.lock && tNow >= ac.tc - 0.15 && Math.hypot(sp.vx, sp.vz) < 0.25) pa.lock = { L: pa.a.lockFallback('L'), R: pa.a.lockFallback('R') };
    const lock = pa.lock || { L: pa.a.lockFallback('L'), R: pa.a.lockFallback('R') };
    const ctx = { ...ctx0, x: sp.x, z: sp.z, yaw: pa.yaw, jy: sp.jy, pelvisBase, H0: pa.a.pelvisRest.y, lock, ground: 0, look: ballPos };
    return { pose: evalPose(def, ctx, t, pa.a), def, ctx, t, name };
  }
  P.poseFor = poseFor;

  // ------------------------------------------------------------------ the frame
  let lastCamKey = '';
  function frame(game, view) {
    if (!P.ready || P.lost) return;
    const G0 = game.getState();
    const sim = G0.sim;
    if (!sim) { stage.setVisible(false); return; }
    const s = sim;
    if (G0.women !== undefined && (G0.women !== P.women || G0.venue !== P.venue) && !P.building) {
      P.building = true; build(G0.women, G0.venue).finally(() => { P.building = false; }); return;
    }
    stage.setVisible(true);
    let dt = lastT === null ? 0 : s.t - lastT;
    if (dt < 0 || s.match.rallies < lastRally) { dt = 0; for (const pa of P.actors) { pa.lastAct = -1; pa.prev = null; } }
    lastT = s.t; lastRally = s.match.rallies;
    dt = Math.min(Math.max(dt, 0), 0.1);
    const ballPos = vec(s.ball);
    // --- ball
    const bm = P.ball;
    let ballShown = s.ball.vis;
    // before the toss the feeder holds the ball
    const R = s.rally;
    const feeder = s.phase === 'ready' && R ? s.players[R.server * 3 + 2] : null;
    for (let i = 0; i < 6; i++) {
      const sp = s.players[i], H = P.humans[i], pa = P.actors[i];
      // base animation
      H.root.position.set(sp.x, 0, sp.z);
      let dy = sp.face - pa.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const inAct = sp.act && s.t >= sp.act.tc - 0.4 && s.t <= sp.act.t1;
      if (inAct) pa.yaw = sp.face; else pa.yaw += dy * Math.min(1, dt * (sp.act && s.t > sp.act.t0 ? 14 : 9));
      H.setFacing(pa.yaw);
      const speed = Math.hypot(sp.vx, sp.vz);
      const after = s.phase === 'dead' && s.last && s.t - s.last.t > 0.5;
      const want = speed >= 0.35 ? 'run' : after ? (sp.team === s.last.winner && s.last.reason !== 'drill' ? 'cheer' : 'calm') : 'idle';
      if (want === 'run') { pa.state = 'run'; H.locomote(speed); }
      else if (pa.state !== want) { H.crossfade(want === 'cheer' ? 'celebrate_2' : want === 'calm' ? 'idle_relaxed' : 'ready_stance', 0.3); pa.state = want; }
      const nearBall = s.ball.vis && !s.ball.free;
      H.lookAt(nearBall ? ballPos : null, { weight: 0.7, maxYaw: 1.1, maxPitch: 0.6 });
      H.update(dt);
      // --- action pose
      const act = sp.act;
      if (act && act.id !== pa.lastAct) { pa.prev = pa.cur || null; pa.cur = act; pa.lastAct = act.id; pa.lock = null; }
      let used = false;
      for (const ac of [pa.cur, pa.prev]) {
        if (!ac || used) continue;
        const r = poseFor(sp, ac, pa, ballPos, s.t);
        if (r.pose) { pa.a.apply(r.pose, dt); pa.last = { ac, r }; used = true; if (ac === pa.prev && r.t > r.def.dur[1]) pa.prev = null; }
      }
      if (!used && pa.cur && s.t - pa.cur.tc > 1.5) { pa.cur = null; }
      // fingers: the feeder cups the ball
      if (act && act.kind === 'toss' && s.t < act.tc) { H.setFingers('L', 'ballGrip'); H.setFingers('R', 'ballGrip'); } else { H.setFingers('L', 'auto'); H.setFingers('R', 'auto'); }
    }
    if (feeder && !s.ball.vis) {
      const hl = P.humans[feeder.id].bonePosition('L_Hand'), hr = P.humans[feeder.id].bonePosition('R_Hand');
      bm.position.set((hl.x + hr.x) / 2, (hl.y + hr.y) / 2 + 0.075, (hl.z + hr.z) / 2); bm.visible = true;
    } else {
      bm.visible = ballShown;
      bm.position.copy(ballPos);
      const sp = Math.hypot(s.ball.vx, s.ball.vz);
      if (sp > 0.05) { bm.rotation.x += (s.ball.vz * dt) / 0.067 * 0.6; bm.rotation.z -= (s.ball.vx * dt) / 0.067 * 0.6; }
    }
    // --- camera + lights. On screens wider than 9:16 the 3D picture is pillarboxed to the same rectangle as the HUD so both agree.
    const winW = kitCanvas.clientWidth || 720, winH = kitCanvas.clientHeight || 1280;
    const wantW = winW / winH > 0.5625 ? Math.round(winH * 0.5625) : 0;
    if (wantW !== P.pillar) {
      P.pillar = wantW;
      canvas.style.cssText = wantW ? `position:fixed;top:0;left:50%;transform:translateX(-50%);width:${wantW}px;height:100dvh;display:block;pointer-events:none;z-index:0` : 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
      stage.resize();
    }
    const cam = stage.camera, c = s.cam;
    const W = canvas.clientWidth || 720, H_ = canvas.clientHeight || 1280;
    const aspect = W / H_;
    const th = Math.tan((48 * Math.PI) / 360) * Math.max(1, 0.5625 / Math.max(0.2, aspect));
    const fov = (2 * Math.atan(th) * 180) / Math.PI;
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const co = P.camOverride;
    if (co) { cam.position.set(co.x, co.y, co.z); cam.lookAt(co.lx, co.ly, co.lz); if (co.fov && cam.fov !== co.fov) { cam.fov = co.fov; cam.updateProjectionMatrix(); } }
    else { cam.position.set(c.x, c.y, c.z); cam.lookAt(c.lx, c.ly, c.lz); }
    stage.setShadowTarget(0, 0, 0);
    if (!P.noRender) { stage.render(); perfTick(); }
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
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
