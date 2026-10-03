// 3D presenter: READS the simulation (game.getState().sim) and draws the field, the horses, the riders and the ball. It never writes back.
// Contact discipline: the sim owns where and when the ball is struck; the presenter retimes the stroke clip so its contact frame lands on the
// sim's contact tick and makes the mallet head meet the ball (setTarget('contact')). Display is interpolated between the two latest sim ticks.
import { createRider } from './rider.js';
import { Actor } from './actor.js';
import { HorseBatch, COATS, setHorseDetail } from './horse.js';
import { buildField, buildBlobs, buildPuffs } from './field.js';
import { CAM, fovFor, SHOW_CAM } from '../src/camera.js';
import { BALL_R, FIG, SPOTS } from '../src/consts.js';

const LIB = '../vendor3d/index.js';
const BALL_VIS = 1.65;      // the ball is DRAWN this much larger than the sim ball so it reads on a phone (22+ px radius near); contacts still use the sim ball centre
const DT = 1 / 60;
const SKINS = ['tan', 'peach', 'brown', 'clay', 'deep', 'ivory'];
const KITS = [
  { top: '#d0342c', trim: '#f6f1e6', bottoms: '#efe9dc', helmet: '#a9231c', cloth: '#d0342c' },
  { top: '#1f6fc4', trim: '#f6f1e6', bottoms: '#efe9dc', helmet: '#154f93', cloth: '#1f6fc4' },
];
const COAT = [['bay', 'chestnut', 'black'], ['grey', 'palomino', 'dun']];
const SC = { x: 200, z: 0 };
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: false });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 2; stage.camera.far = 300; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 1.0, hemi: 0.95, keyI: 2.6 });
  stage.setSky('#9fc8e6', '#c9deec', { near: 110, far: 260 });
  stage.lights.key.position.set(-14, 26, -12);

  const P = { stage, THREE, ready: false, lost: false, quality, contacts: [], events: [] };
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  buildField(stage);
  const blobs = buildBlobs(8); stage.add(blobs.mesh);
  const camQ = new THREE.Quaternion();
  setHorseDetail(quality);
  const batch = new HorseBatch(7); batch.S = FIG; batch.paintBall(); stage.add(batch.mesh);
  const ballQ = new THREE.Quaternion(), qa = new THREE.Quaternion(), ax = new THREE.Vector3();

  // camera
  const cam = stage.camera;
  cam.position.set(CAM.x, CAM.y, CAM.z); cam.lookAt(CAM.lx, CAM.ly, CAM.lz); cam.updateMatrixWorld(true);
  camQ.copy(cam.quaternion);
  const puffs = buildPuffs(48, camQ); stage.add(puffs.mesh);

  const actors = [];
  P.actors = actors; P.batch = batch;
  P.ready_p = (async () => {
    for (let i = 0; i < 6; i++) {
      const team = i < 3 ? 0 : 1, role = i % 3, K = KITS[team];
      const rider = await createRider({ top: K.top, trim: K.trim, bottoms: K.bottoms, helmet: K.helmet, skin: SKINS[(i * 5 + 1) % 6], lod: quality === 'high' ? 0 : quality === 'medium' ? 'medium' : 'light', seed: i + 1 });
      stage.add(rider.human); stage.track(rider.human);
      batch.paint(i, COATS[COAT[team][role]], K.cloth, K.trim);
      actors.push(new Actor(i, rider, THREE, i + 1));
    }
    // the showcase rider (a seventh horse far from the field): shown only through the transparent windows of the Rules pages
    const K0 = KITS[0];
    const sr = await createRider({ top: K0.top, trim: K0.trim, bottoms: K0.bottoms, helmet: K0.helmet, skin: 'brown', lod: quality === 'high' ? 0 : 'medium', seed: 9 });
    stage.add(sr.human); sr.human.root.visible = false;
    batch.paint(6, COATS.bay, K0.cloth, K0.trim);
    P.show = { actor: new Actor(0, sr, THREE, 9), t: 0, key: '', st: { riders: [{ x: -SC.x, z: SC.z, h: -Math.PI / 2, v: 0, w: 0 }], ball: { x: 0, z: 0, y: 0.3, vx: 0, vz: 0 } }, ballV: [0, 0], ballPos: null };
    P.ready = true; stage.invalidate();
  })();

  // ---- display interpolation: the two latest sim ticks
  let curSnap = null, prevSnap = null, curStamp = 0, lastTick = -1, lastSim = null, lastTr = 0, seen = -1;
  const nowMs = () => (P.clock ? P.clock() : performance.now());
  const snap = (s) => ({
    tick: s.tick, t: s.t,
    r: s.riders.map((r) => ({ x: r.x, z: r.z, h: r.h, v: r.v, w: r.w })),
    b: { x: s.ball.x, y: s.ball.y, z: s.ball.z, vx: s.ball.vx, vz: s.ball.vz, rot: s.ball.rot },
  });
  const ball3 = new THREE.Vector3();
  const rein = { x: 0.1, y: 1.7, z: 0.45 };

  function frame(game) {
    if (!P.ready || P.lost) return;
    const G = game.getState(), s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    if (s !== lastSim) { lastSim = s; curSnap = prevSnap = null; lastTick = -1; seen = s.evId - 1; lastTr = s.t; for (const a of actors) { a.mode = 'ride'; a.seat = ''; a.h.play('ride', { fade: 0 }); } }
    if (s.tick !== lastTick) { prevSnap = curSnap || snap(s); curSnap = snap(s); curStamp = nowMs(); lastTick = s.tick; if (prevSnap.tick > curSnap.tick || curSnap.tick - prevSnap.tick > 3) prevSnap = curSnap; }
    const alpha = curSnap === prevSnap ? 1 : Math.min(1, Math.max(0, (nowMs() - curStamp) / (DT * 1000)));
    const Tr = lerp(prevSnap.t, curSnap.t, alpha);
    let dt = Tr - lastTr; if (dt < 0 || dt > 0.1) dt = 0; lastTr = Tr;
    // interpolated state
    const R = curSnap.r.map((c, i) => { const p = prevSnap.r[i]; return { x: lerp(p.x, c.x, alpha), z: lerp(p.z, c.z, alpha), h: wrapA(p.h + wrapA(c.h - p.h) * alpha), v: lerp(p.v, c.v, alpha), w: lerp(p.w, c.w, alpha) }; });
    const fm = G.artRect && (G.artRect.key === 'field' || G.artRect.key === 'roles');
    if (fm) for (let i = 0; i < 6; i++) { const sp = SPOTS[i % 3], sg = i < 3 ? 1 : -1; Object.assign(R[i], { x: sp.x * sg, z: sp.z * sg, h: i < 3 ? 0 : Math.PI, v: 0, w: 0 }); }
    if (fm !== P.formation) { P.formation = fm; for (const a of actors) { a.mode = 'ride'; a.seat = ''; a.h.play('ride', { fade: 0 }); } }
    const pb = fm ? { x: 0, y: BALL_R, z: 0, vx: 0, vz: 0 } : prevSnap.b, cb = fm ? pb : curSnap.b;
    const B = { x: lerp(pb.x, cb.x, alpha), y: lerp(pb.y, cb.y, alpha), z: lerp(pb.z, cb.z, alpha) };
    ball3.set(-B.x, B.y, B.z);
    // events
    for (const e of s.events) {
      if (e.id <= seen) continue;
      seen = e.id;
      if (fm) continue;
      P.events.push(e); if (P.events.length > 60) P.events.shift();
      const a = actors[e.rider];
      if (e.type === 'wind' && a) a.onWind(e, s);
      else if (e.type === 'swing' && a) a.onSwing(e, Tr, s);
      else if (e.type === 'hook' && a) a.onHook(e, Tr);
      else if (e.type === 'hooked') actors[e.victim].onHooked();
      else if (e.type === 'swingEnd' && a) a.onCancel();
      else if (e.type === 'hit') { spawnHit(e, a); }
      else if (e.type === 'bounce') spawnBounce(e);
      else if (e.type === 'board' || e.type === 'post') spawnBounce(e, 0.6);
    }
    // actors
    for (let i = 0; i < 6; i++) {
      const a = actors[i];
      const sad = a.horse.saddle();
      rein.y = sad.y + 0.15; rein.z = sad.z + 0.42; rein.x = 0.1;
      a.update(R[i], s, Tr, dt, ball3, batch, i, rein);
      for (const fe of a.horse.footEvents) { if (R[i].v > 5.2 && quality !== 'low') puffAtHoof(a, fe.leg, R[i]); }
      a.h.update(dt);
      if (P.measure && a.mode === 'strike') measure(a, s, Tr);
      blobs.set(i, a.horse.x, a.horse.z, a.horse.heading, 1.35 * FIG, 0.62 * FIG);
    }
    const showing = runShowcase(G, s) && !fm;
    batch.commit();
    // ball
    const vx = (cb.x - pb.x) / DT, vz = (cb.z - pb.z) / DT;
    // rolling: rotate about the axis perpendicular to the (three-space) velocity
    { const wx = -vx, wz = vz, sp = Math.hypot(wx, wz); if (sp > 0.02 && dt > 0) { ax.set(wz, 0, -wx).normalize(); qa.setFromAxisAngle(ax, sp * dt / BALL_R); ballQ.premultiply(qa); } }
    if (showing && P.show.ballPos) batch.writeBall(P.show.ballPos[0], P.show.ballPos[1] + (BALL_VIS - 1) * BALL_R, P.show.ballPos[2], BALL_R * BALL_VIS, [0, 0, 0, 1]);
    else batch.writeBall(showing ? 0 : ball3.x, showing ? -5 : ball3.y + (BALL_VIS - 1) * BALL_R, showing ? 0 : ball3.z, BALL_R * BALL_VIS, [ballQ.x, ballQ.y, ballQ.z, ballQ.w]);
    const hgt = Math.max(0, B.y - BALL_R);
    blobs.set(6, ball3.x, ball3.z, 0, 0.3 + hgt * 0.1, 0.3 + hgt * 0.1, 0.03);
    puffs.update(dt);
    // camera and size
    const winW = kitCanvas.clientWidth || 720, winH = kitCanvas.clientHeight || 1280;
    const wantW = winW / winH > 0.5625 ? Math.round(winH * 0.5625) : 0;
    if (wantW !== P.pillar) {
      P.pillar = wantW;
      canvas.style.cssText = wantW ? `position:fixed;top:0;left:50%;transform:translateX(-50%);width:${wantW}px;height:100dvh;display:block;pointer-events:none;z-index:0` : 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
      stage.resize();
    }
    const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280;
    const fov = fovFor(W / H);
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    if (!P.noRender) { stage.render(); if (showing || fm) renderShowcase(G, W, H); P.drawCalls = stage.renderer.info.render.calls; P.tris = stage.renderer.info.render.triangles; }
  }

  // ---- the showcase (Rules pages): the real horse and rider in a window of the 2D page -------------------------------------------------
  const scCam = new THREE.PerspectiveCamera(32, 2, 0.3, 80);
  const RIDING = [[0, 0.3], [1.5, 0.3], [3, 1.6], [5, 1.6], [6.5, 4.0], [9, 4.0], [10.5, 7.0], [13, 7.0], [14.5, 10.4], [17.5, 10.4], [19, 0.3], [20, 0.3]];
  let scLast = 0;
  function runShowcase(G, s) {
    const S_ = P.show;
    const ar = G.artRect;
    if (S_ && ar && (ar.key === 'field' || ar.key === 'roles')) {
      S_.actor.rider.human.root.visible = false; S_.t = 0; scLast = 0;
      scCam.fov = SHOW_CAM.fov; scCam.position.set(SHOW_CAM.x, SHOW_CAM.y, SHOW_CAM.z); scCam.up.set(0, 1, 0); scCam.lookAt(SHOW_CAM.lx, SHOW_CAM.ly, SHOW_CAM.lz);
      return true;
    }
    if (!S_ || !ar) { if (S_) S_.actor.rider.human.root.visible = false; if (S_) S_.t = 0; scLast = 0; return false; }
    const now = nowMs(); let dt = scLast ? (now - scLast) / 1000 : 0; scLast = now; dt = Math.min(Math.max(dt, 0), 0.05);
    const a = S_.actor, st = S_.st, r = st.riders[0];
    if (S_.key !== ar.key) { S_.key = ar.key; S_.t = 0; a.h.play('ride', { fade: 0 }); a.mode = 'ride'; a.seat = ''; S_.phase = -1; }
    S_.t += dt;
    a.rider.human.root.visible = true;
    let v = 0;
    if (ar.key === 'riding') {
      const T = S_.t % 20; let i = 0; while (i < RIDING.length - 2 && T > RIDING[i + 1][0]) i++;
      const [t0, v0] = RIDING[i], [t1, v1] = RIDING[i + 1]; v = lerp(v0, v1, Math.min(1, Math.max(0, (T - t0) / (t1 - t0))));
      r.x -= v * dt; if (r.x < -SC.x - 12) r.x += 24;       // the horse rides along +x in three space (-x in sim) and wraps around; the camera follows
    } else { r.x = -SC.x; }
    r.z = SC.z; r.h = -Math.PI / 2; r.v = v; r.w = 0;
    // the stroke loop: wind-up, strike (contact on a tick), the ball rolls away, then a fresh ball is set where the next stroke will meet it
    const Tc = S_.t % 4.2, tickNow = Math.floor(S_.t * 60);
    if (ar.key === 'stroke') {
      const E = { lat: 0.9, f: 0.48 }, cyc = Math.floor(S_.t / 4.2), tc = Math.round((cyc * 4.2 + 1.5) * 60);
      if (S_.cycle !== cyc) { S_.cycle = cyc; S_.windDone = false; S_.swingDone = false; S_.ballV = [0, 0]; S_.ballFree = false; }
      const bx = r.x + (-E.lat) * Math.cos(r.h) * 1 + E.f * Math.sin(r.h) * 1, bz = r.z - (-E.lat) * Math.sin(r.h) + E.f * Math.cos(r.h);   // sim axes: the ball on the rider's right
      // rider's right in sim axes = (cos h, -sin h) * lat
      const rx = r.x + E.lat * Math.cos(r.h) + E.f * Math.sin(r.h), rz = r.z - E.lat * Math.sin(r.h) + E.f * Math.cos(r.h);
      void bx; void bz;
      if (!S_.ballFree) { st.ball.x = rx; st.ball.z = rz; }
      if (!S_.windDone && Tc > 0.6) { S_.windDone = true; a.onWind({ type: 'wind', rider: 0 }, st); }
      if (!S_.swingDone && Tc > 1.2) { S_.swingDone = true; a.onSwing({ type: 'swing', rider: 0, kind: 'R', tc: tc + 0, n: 10, q: 1 }, S_.t, st); S_.tcT = tc / 60; }
      if (S_.swingDone && !S_.ballFree && S_.t >= S_.tcT) { S_.ballFree = true; S_.ballV = [-Math.cos(r.h) * -1.2 + Math.sin(r.h) * 7.5, Math.cos(r.h) * 7.5 - Math.sin(r.h) * 1.2 * -1]; spawnHit({ speed: 10, x: st.ball.x, z: st.ball.z, rider: 0, tc }, a); }
      if (S_.ballFree) { st.ball.x += S_.ballV[0] * dt; st.ball.z += S_.ballV[1] * dt; S_.ballV = [S_.ballV[0] * 0.97, S_.ballV[1] * 0.97]; }
      S_.ballPos = [-st.ball.x, BALL_R, st.ball.z];
    } else S_.ballPos = null;
    const b3 = new THREE.Vector3(S_.ballPos ? S_.ballPos[0] : -r.x + 3, 0.3, r.z);
    a.update(r, st, S_.t, dt, b3, batch, 6, { x: 0.1, y: a.horse.saddle().y + 0.15, z: a.horse.saddle().z + 0.42 });
    a.h.update(dt);
    blobs.set(7, a.horse.x, a.horse.z, a.horse.heading, 1.35 * FIG, 0.62 * FIG);
    // the showcase camera
    const hx = a.horse.x, hz = a.horse.z;
    if (ar.key === 'riding') { scCam.fov = 24; scCam.position.set(hx, 1.7, hz + 7.4); scCam.up.set(0, 1, 0); scCam.lookAt(hx, 1.25, hz); }
    else if (ar.key === 'stroke') { scCam.fov = 30; scCam.position.set(hx - 4.6, 2.5, hz + 4.2); scCam.up.set(0, 1, 0); scCam.lookAt(hx + 0.4, 1.1, hz + 0.7); }
    else { scCam.fov = 26; scCam.position.set(hx, 9, hz); scCam.up.set(1, 0, 0); scCam.lookAt(hx, 0, hz); }
    return true;
  }
  function renderShowcase(G, W, H) {
    const ar = G.artRect, r = stage.renderer, ratio = r.getPixelRatio();
    const winW = kitCanvas.clientWidth || 720, winH = kitCanvas.clientHeight || 1280, sc = Math.min(winW / 720, winH / 1280);
    const left = P.pillar ? (winW - P.pillar) / 2 : 0;
    const u = (ar.x - 360) * sc + winW / 2 - left, v = (ar.y - 640) * sc + winH / 2, w = ar.w * sc, h = ar.h * sc;
    scCam.aspect = w / h; scCam.updateProjectionMatrix(); scCam.updateMatrixWorld(true);
    const cy0 = ((ar.c0 ?? ar.y) - 640) * sc + winH / 2, cy1 = ((ar.c1 ?? ar.y + ar.h) - 640) * sc + winH / 2;
    r.setScissorTest(true); r.setViewport(u, H - v - h, w, h); r.setScissor(u, H - cy1, w, Math.max(0, cy1 - cy0));
    r.render(stage.scene, scCam);
    r.setScissorTest(false); r.setViewport(0, 0, W, H); void ratio;
  }

  // ---- effects
  function spawnHit(e, a) {
    P.contacts.push({ id: e.id, rider: e.rider, tick: e.tc });
    if (quality === 'low') return;
    const n = 4 + Math.round(e.speed / 6);
    for (let i = 0; i < n; i++) { const ang = i / n * 6.283; puffs.spawn(-e.x + Math.cos(ang) * 0.1, 0.3, e.z + Math.sin(ang) * 0.1, Math.cos(ang) * 1.4, 0.8 + (i % 3) * 0.3, Math.sin(ang) * 1.4, 0.45, 0.25, 1.0); }
  }
  function spawnBounce(e, k = 1) {
    if (quality === 'low') return;
    puffs.spawn(-e.x, 0.15, e.z, 0, 0.5, 0, 0.35, 0.2, 0.55 * k * (0.5 + (e.p || 0.5)));
  }
  function puffAtHoof(a, leg, r) {
    const ang = -r.h, sx = Math.sin(ang), cx = Math.cos(ang);
    const lx = (leg === 0 || leg === 1 ? 0.2 : -0.2), lz = leg > 1 ? -0.6 : 0.6;
    puffs.spawn(a.horse.x + lx * cx + lz * sx, 0.1, a.horse.z - lx * sx + lz * cx, -sx * 0.6, 0.5, -cx * 0.6, 0.5, 0.2, 0.7);
  }
  // dev measurement: mallet head to the ball at the contact tick
  function measure(a, s, Tr) {
    if (Math.abs(Tr - a.tc * DT) > 0.12) return;
    const h = a.h; h.root.updateMatrixWorld(true);
    const m = h.props[0].prop; m.updateWorldMatrix(true, true);
    const hp = m.localToWorld(new THREE.Vector3(0, a.rider.mallet.userData.sweet, 0));
    P.measured = P.measured || [];
    P.measured.push({ rider: a.id, tc: a.tc, Tr, dtc: Tr - a.tc * DT, d: hp.distanceTo(ball3), q: a.q, kind: a.kind });
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      frame(game);
    };
    return game;
  };
  P.setClock = (f) => { P.clock = f; };
  return P;
}
