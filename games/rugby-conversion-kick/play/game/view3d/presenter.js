// The 3D presenter: reads the sim (game.getState().sim: spot, aim, phase, ball, shot) and draws the stadium, the kicker and the ball from the one camera in
// src/camera.js. It never writes back: the strike time, the launch and the outcome belong to the sim; the kick clip is retimed (timeWarpTo) so the
// foot meets the ball on the sim's contact time, and the foot is steered onto the sim's ball.
import { buildStadium, buildBall, buildTee } from './field.js';
import { camFor } from '../src/camera.js';
import { bandOf } from '../src/hud.js';
import { windAt } from '../src/sim.js';
import { RUN_Q, CONTACT_LATE, TEE_Y, KICKER_LOOKS, TILTS } from '../src/consts.js';

const LIB = '../vendor3d/index.js';
const MAX_PIXELS = 2.4e6;
const BALL_R = 0.12;
const CONTACT = RUN_Q + CONTACT_LATE;
const KICK_LEAD = 1.133;                 // seconds from the start of the base `kick` clip to its contact event
const CLIP_START = 0.45;                 // the run-up starts moving here
const APPROACH = 0.95;                   // metres the kicker walks while the clip plays (the clips are in place)
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function pickQuality(q) {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  if (q) return q;
  const nav = globalThis.navigator || {};
  return (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4) ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, meta = { width: 720, height: 1280 }, quality }) {
  quality = pickQuality(quality);
  const fallback = { stage: null, wrap: (g) => g };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return fallback; }
  const { createStage, loadHuman, THREE, solveFootBall } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', shadows: false, mode: 'continuous' });
  if (!stage.supported) { canvas.remove(); return fallback; }
  let lost = false, cssW = 0, cssH = 0, pillar = '';
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; cssW = 0; pillar = ''; stage.resize(); stage.invalidate(); });
  const camera = stage.camera; camera.near = 0.3; camera.far = 420; camera.updateProjectionMatrix();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const stadium = buildStadium(stage);
  let groundIdx = -1;
  const ball = buildBall(); stage.add(ball);
  const tee = buildTee(); stage.add(tee);
  const blobs = stage.enableBlobShadows(4, { radius: 0.55, opacity: 0.8 });

  // ---- the kicker ----------------------------------------------------------------------------------------------------------------
  let K = null, loading = false, builtKind = '', ready = false;
  async function loadKicker(woman) {
    if (loading) return; loading = true;
    try {
      const look = KICKER_LOOKS.you;
      const h = await loadHuman({ character: woman ? 'athlete_f' : 'athlete_m', kit: { top: look.top, bottoms: look.bottoms, socks: look.socks }, skin: look.skin, hair: look.hair, quality });
      if (K) stage.remove(K.human);
      h.groundClamp = 'auto'; h.footPlanting = true; h.turnRate = 0;
      for (const sd of ['L', 'R']) solveFootBall(h, sd, V(), V(0, 0, 1), V(0, 0, 1), 'instep', 0.1);
      h.addLayer('live', { mask: 'all', additive: true, weight: 1 });
      if (h.hasClip('idle_relaxed')) h.play('idle_relaxed', { fade: 0, loop: true });
      stage.add(h);
      K = { human: h, who: 'you', n: -1, mode: '', clipOn: false, celebrated: -1, afterT: 0 };
      builtKind = woman ? 'f' : 'm'; ready = true;
      try { stage.renderer.compile?.(stage.scene, camera); } catch { /* optional */ }
    } catch (e) { console.warn('3D kicker failed to load; the picture stays without one', e); }
    loading = false;
  }
  loadKicker(false);
  // the referee: a second athlete in a hi-vis shirt who stands a few metres to the kicker's left, watching
  let REF = null;
  (async () => {
    try {
      const h = await loadHuman({ character: 'athlete_m', kit: { top: '#e9d12c', bottoms: '#15171c', socks: '#15171c' }, skin: 'light', hair: 'grey', quality });
      h.groundClamp = 'auto'; h.footPlanting = true; h.turnRate = 0;
      h.addLayer('live', { mask: 'all', additive: true, weight: 1 });
      h.play('idle_relaxed', { fade: 0, loop: true, startTime: 1.1 }); stage.add(h); REF = h;
    } catch (e) { console.warn('referee unavailable', e); }
  })();

  // ---- placing the picture -----------------------------------------------------------------------------------------------------
  function layoutCanvas() {
    const cw = kitCanvas.clientWidth || globalThis.innerWidth || 720, ch = kitCanvas.clientHeight || globalThis.innerHeight || 1280;
    const vw = meta.width || 720, vh = meta.height || 1280, k = Math.min(cw / vw, ch / vh), rw = Math.round(vw * k), rh = Math.round(vh * k);
    const rectKey = `${cw}x${ch}:${rw}x${rh}`;
    if (rectKey !== pillar) {
      pillar = rectKey;
      canvas.style.cssText = rw >= cw - 1 && rh >= ch - 1 ? 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0'
        : `position:fixed;left:${Math.round((cw - rw) / 2)}px;top:${Math.round((ch - rh) / 2)}px;width:${rw}px;height:${rh}px;display:block;pointer-events:none;z-index:0`;
      cssW = 0;
    }
    if (rw !== cssW || rh !== cssH) {
      cssW = rw; cssH = rh; stage.resize();
      const pr = stage.renderer.getPixelRatio();
      if (rw * rh * pr * pr > MAX_PIXELS * 1.02) stage.renderer.setPixelRatio(Math.sqrt(MAX_PIXELS / (rw * rh)));
    }
  }
  function placeCamera(G, s) {
    const w = meta.width || 720, h = meta.height || 1280;
    const cam = camFor(w, h, s, bandOf(G));
    const co = P.camOverride;
    const C = co ? [co.x, co.y, co.z] : [-cam.pos[0], cam.pos[1], cam.pos[2]];
    camera.position.set(C[0], C[1], C[2]);
    camera.lookAt(co ? co.lx : -cam.look[0], co ? co.ly : cam.look[1], co ? co.lz : cam.look[2]);
    if (co) { camera.clearViewOffset(); camera.fov = co.fov || 35; camera.aspect = w / h; camera.updateProjectionMatrix(); return; }
    const fov = 2 * Math.atan((h / 2) / cam.f) * 180 / Math.PI;
    if (Math.abs(camera.fov - fov) > 1e-3 || Math.abs(camera.aspect - w / h) > 1e-4) { camera.fov = fov; camera.aspect = w / h; }
    camera.setViewOffset(w, h, w / 2 - cam.cx, h / 2 - cam.cy, w, h);
    camera.updateProjectionMatrix();
  }

  // ---- one frame --------------------------------------------------------------------------------------------------------------------
  const P = { stage, THREE, camOverride: null, deterministic: false, noRender: false, ready: () => ready, ball, human: () => (K && K.human) };
  let lastTick = -1, lastTickMs = 0, lastFrameMs = 0, prevBall = null, curBall = null, tickGap = 1, lastT = null;
  const snapB = (b) => ({ x: b.x, y: b.y, z: b.z });
  const lerp = (a, b, t) => a + (b - a) * t;

  function frame(game) {
    const G = game.getState();
    if (lost) return;
    const s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    layoutCanvas();
    const want = G.settings && G.settings.women ? 'f' : 'm';
    if (want !== builtKind && !loading) loadKicker(want === 'f');
    const gi = G.ground ? G.ground.sky : 1;
    if (gi !== groundIdx) { groundIdx = gi; stadium.setGround(gi, stage); }
    placeCamera(G, s);
    const nowMs = globalThis.performance ? globalThis.performance.now() : 0;
    const catching = lastT === null || s.t < lastT - 1e-6 || Math.abs(s.t - lastT) > 0.5;
    if (s.tick !== lastTick) {
      tickGap = Math.max(1, s.tick - lastTick);
      prevBall = catching || !curBall ? snapB(s.ball) : curBall; curBall = snapB(s.ball);
      lastTick = s.tick; lastTickMs = nowMs;
    }
    const sinceTick = nowMs - lastTickMs;
    const moving = P.deterministic ? true : sinceTick < 120;
    let alpha = P.deterministic ? 1 : Math.min(1, sinceTick / (16.667 * Math.min(tickGap, 2)));
    if (!moving) alpha = 1;
    let dt = P.deterministic ? (lastT === null ? 0 : s.t - lastT) : moving ? Math.min(0.05, Math.max(0, nowMs - lastFrameMs) / 1000) : 0;
    if (catching) dt = 0;
    dt = Math.min(Math.max(dt, 0), 0.1);
    lastT = s.t; lastFrameMs = nowMs;
    const sub = P.deterministic ? 0 : (alpha - 1) / 60;      // the picture shows sim time plus the interpolated fraction of a step
    const wind = windAt(s.wind, s.clock);
    stadium.animate(wind, s.clock);

    // ball
    const B = s.ball, sp = s.spot;
    const bi = { x: lerp(prevBall.x, curBall.x, alpha), y: lerp(prevBall.y, curBall.y, alpha), z: lerp(prevBall.z, curBall.z, alpha) };
    const onTee = !B.fly;
    const tilt = TILTS[s.tilt], tiltAng = [1.2, 0.85, 0.5][s.tilt];       // rest angle of the long axis above the ground
    if (onTee) {
      const yaw = Math.atan2(-(s.aimX - sp.sx), sp.d);
      ball.position.set(-sp.sx, 0.1 + Math.hypot(0.155 * Math.sin(tiltAng), 0.095 * Math.cos(tiltAng)), -sp.d);
      ball.rotation.set(0, 0, 0); ball.quaternion.setFromEuler(new THREE.Euler(-tiltAng, yaw, 0, 'YXZ'));
      tee.visible = true; tee.position.set(-sp.sx, 0, -sp.d);
    } else {
      ball.position.set(-bi.x, bi.y, bi.z);
      const v = V(-B.vx, B.vy, B.vz), spd = v.length();
      if (spd > 1.5 && !B.rest) {
        ball.quaternion.setFromUnitVectors(V(0, 0, 1), v.normalize());
        ball.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(v, B.spin));
      } else ball.rotation.set(0.2, B.spin * 0.1, 0.3);
      tee.visible = true; tee.position.set(-sp.sx, 0, -sp.d);
    }

    // kicker
    if (K) driveKicker(s, G, dt, sub, bi);
    if (REF && K) {
      const fr = frameOf(s), rp = fr.ball.clone().addScaledVector(fr.left, 2.5).addScaledVector(fr.f, 5);
      REF.root.position.set(rp.x, 0, rp.z); REF.setFacing(Math.atan2(fr.ball.x - rp.x, fr.ball.z - rp.z - 1.5));
      REF.lookAt(s.ball.fly ? V(-bi.x, bi.y, bi.z) : fr.ball.clone().add(V(0, 0.5, 0)), { weight: 0.6, maxYaw: 1.2, maxPitch: 0.6 });
      REF.update(dt);
    }
    blobs.set(0, K ? K.human.root.position.x : 0, K ? K.human.root.position.z : 0, 0.6);
    blobs.set(1, ball.position.x, ball.position.z, 0.3 * Math.max(0.3, 1 - Math.min(1, Math.max(0, ball.position.y - 0.2) / 8)));
    blobs.mesh.count = 2;
    if (!P.noRender) stage.render();
  }

  function frameOf(s) {
    const sp = s.spot, dx = s.aimX - sp.sx, dz = sp.d, l = Math.hypot(dx, dz);
    const a = Math.atan2(-dx, dz);                       // three yaw
    const f = V(Math.sin(a), 0, Math.cos(a)), left = V(Math.cos(a), 0, -Math.sin(a));
    void l;
    return { a, f, left, ball: V(-sp.sx, TEE_Y, -sp.d) };
  }
  // where the root stands at contact: the plant foot beside the ball, a little behind it (tuned against the library kick clip)
  const KF = 0.12, KS = 0.30;
  function driveKicker(s, G, dt, sub, bi) {
    const h = K.human, fr = frameOf(s);
    if (s.n !== K.n || (G.sim && s.who !== K.who)) {   // a new kick: the kicker walks back to the start of his run-up
      K.n = s.n; K.clipOn = false; K.mode = ''; K.who = s.who; K.afterT = 0; K.react = '';
      const look = s.who === 'rival' ? KICKER_LOOKS.rival : KICKER_LOOKS.you;
      h.setKit({ top: look.top, bottoms: look.bottoms, socks: look.socks }); h.setSkin(look.skin); h.setHair(look.hair);
      h.play('idle_relaxed', { fade: 0.2, loop: true }); K.mode = 'idle';
    }
    const k0 = fr.ball.clone().addScaledVector(fr.f, -KF).addScaledVector(fr.left, KS);
    const rate = KICK_LEAD / (CONTACT - CLIP_START);
    const rc = s.rc + sub;                                   // sim time since the run-up began (0 while setting up)
    let root = k0.clone().addScaledVector(fr.f, -APPROACH);
    const running = s.phase !== 'ready' && s.rc > 0 || s.phase === 'runup';
    if (running && rc >= CLIP_START) {
      if (!K.clipOn) { h.play('kick', { fade: 0, speed: 0, loop: false }); K.clipOn = true; K.mode = 'kick'; }
      const tr = h.layers.base.current;
      if (K.clipOn && tr && tr.clip.name === 'kick') tr.time = Math.min(tr.clip.dur - 0.001, (rc - CLIP_START) * rate);
      const u = Math.min(1, (rc - CLIP_START) / (CONTACT - CLIP_START));
      root.copy(k0).addScaledVector(fr.f, -APPROACH * (1 - sstep(0, 1, u)));
    }
    h.root.position.set(root.x, 0, root.z);
    h.setFacing(fr.a);
    // eyes: the posts while setting up, the ball during the run-up, the flight afterwards
    const lookP = s.phase === 'ready' ? V(-s.aimX, 3.5, 0) : s.phase === 'runup' ? (rc < 1.3 ? V(-s.aimX, 3.5, 0) : fr.ball) : (s.ball.fly ? V(-bi.x, bi.y, bi.z) : V(-s.aimX, 3.5, 0));
    h.lookAt(lookP, { weight: 0.7, maxYaw: 1.1, maxPitch: 0.7 });
    // foot onto the ball at contact
    h.setReachFoot('R', null); h.setReachFoot('L', null);
    if (s.shot && s.phase !== 'ready' && K.clipOn) {
      const sh = s.shot, tc = CONTACT;
      const tt = rc;
      if (tt > tc - 0.16 && tt < tc + 0.16) {
        const w = tt <= tc ? sstep(tc - 0.16, tc - 0.02, tt) : 1 - sstep(tc + 0.03, tc + 0.16, tt);
        const dirv = V(-Math.sin(sh.yaw) * Math.cos(sh.elev), Math.sin(sh.elev), Math.cos(sh.yaw) * Math.cos(sh.elev));
        const kc = fr.ball.clone().add(V(0, 0.04, 0));
        try { const k = solveFootBall(h, 'R', kc, dirv, fr.f, 'instep', BALL_R); h.setReachFoot('R', k.ankle, w * 0.9, k.quat); } catch { /* ignore */ }
      }
    }
    // after the strike: a reaction
    if (s.phase === 'result' && s.resultT > 0.9 && K.react !== s.shot.outcome + s.n) {
      K.react = s.shot.outcome + s.n;
      if (s.shot.outcome === 'goal' && h.hasClip('celebrate_2')) { h.play('celebrate_2', { fade: 0.3, loop: true }); K.mode = 'celeb'; K.clipOn = false; }
    }
    if (K.mode === 'kick' && K.clipOn && s.phase !== 'runup' && rc > CLIP_START + h.clips.kick.dur / rate + 0.1) { h.play('idle_relaxed', { fade: 0.4, loop: true }); K.mode = 'idle'; K.clipOn = false; K.done = s.n; }
    h.layers.live.setWeight(K.mode === 'kick' ? 0.1 : 1, 0);
    h.update(dt);
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      try { frame(game); } catch (e) { console.warn('3D frame failed', e); }
    };
    return game;
  };
  P.frameFor = frame;
  return P;
}
