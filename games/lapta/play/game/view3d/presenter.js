// 3D presenter for Lapta. It only READS the game (the turn: batter, server, six fielders, ball, runner) and draws the village green, the people and
// the ball behind the transparent kit canvas. The kit canvas keeps the HUD, the aim fan, the closing ring, landing marks, particles, menus and input.
// Both layers use ONE camera: the oblique projection the 2D layer uses (x across, depth foreshortened by ty, height straight up), written here as the
// projection matrix of the WebGL camera, so every 2D mark lands on the pixel it belongs to. Without WebGL2, with ?nogl, on context loss or while the
// assets load, the 2D art plays and the 3D layer takes over the moment it is ready.
//
// Animation follows the simulation: the swing clip is timed so the bat meets the ball on the tick the sim launches it, a fielder's throw releases the
// tick the sim throws, catches are timed to the ball's arrival, feet follow the sim speed (no sliding). The sim never reads any of this.
import { meta } from '../src/game.js';
import { GL } from '../src/glbridge.js';
import { K, tossAt } from '../src/sim.js';
import { geom, makeCam } from '../src/art.js';
import { buildWorld } from './world.js';
import { createSmoothing } from './smooth.js';
import { FIELDERS, SERVER, BATTER } from './actors.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const qs = (re) => { try { return re.exec(globalThis.location.search); } catch { return null; } };
const ICON = !!qs(/[?&]icon=1/);                 // QA: ?icon=1&shot=1 = the bare hero picture for the app icon art
const HIT_LAG = 10 / 60;                          // the library's batting clips reach the ball this long after they start
let BAT_YAW = Math.PI / 2 + 0.15;                  // side-on, chest turned a little toward the viewer so the swing reads; the server is on the bat's near hand

function pickQuality() {
  const m = qs(/[?&]q=(low|medium|high)/); if (m) return m[1];
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}
const HERO_PTS = [[-6.5, 0, -0.6], [6.5, 0, -0.6], [-6.5, 0, -7.5], [6.5, 0, -7.5], [-6.5, 3, -4], [6.5, 3, -4]];
const exposed = (r) => (r.st === 'toFar' || r.st === 'back') && r.y > 1.2 && r.y < K.D - 0.25;
// sim heading (atan2(dx, dy), dy toward the far line) -> three yaw (+Z faces the viewer, +X the right)
const yawOfSim = (face) => Math.PI - face;
const humanSide = (m) => m.cfg.mode === 'solo' || m.cfg.mode === 'two' || (m.cfg.mode === 'ai' && m.side === 0);

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE, createCrowd3d, addCap, addBatClips, addThrowClips, addFieldClips, addSportClips } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const shotMode = !!qs(/[?&]shot=/);
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 24, preserveDrawingBuffer: shotMode }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera, key = stage.lights.key;
  renderer.autoClear = false;
  stage.setLighting('day', { hemi: 1.0, hemiSky: 0xdfeeff, hemiGround: 0x8aa860, key: 0xfff1d6, keyI: 2.7, rim: 0xcfe0ff, rimI: 0.5, exposure: 0.92 });
  stage.setSky(0x86b8ea, null);
  stage._shadowOffset = new THREE.Vector3(-7, 11, 7);
  cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true);
  const shadowsOn = () => renderer.shadowMap.enabled;
  if (quality === 'low' && stage.enableBlobShadows) stage.enableBlobShadows(24, { radius: 0.5, opacity: 0.8 });

  const world = buildWorld(V3, stage, { quality });
  const SM = createSmoothing(THREE);
  let curDt = 1 / 60;
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const handMid = (h) => { h.bonePosition('R_Hand', _v); h.bonePosition('L_Hand', _w); return _v.add(_w).multiplyScalar(0.5); };
  // smoothed IK target: starts at the effector, follows the live point without lag, swallows teleports
  const aim = (h, name, pt, start) => { const a = ((h.aims ||= {})[name] ||= new SM.Aim()); h.setTarget(name, a.step(pt, start ? start(h) : null, curDt)); };
  const P = { stage, THREE, world, ready: false, lost: false, quality, licenses: '', off: false };
  stage.onContextLost(() => { P.lost = true; GL.on = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); });

  // ---- locomotion: the stride follows the DISTANCE actually travelled -------------------------------------------------------------------------
  // speed = measured displacement of the figure (sim seconds), smoothed; the gait (walk / jog / sprint) is picked with hysteresis; the clip rate is
  // speed / the clip's own stride speed, so a planted foot moves with the ground and a standing figure never steps.
  const STRIDE = { walk: 1.4, jog_slow: 2.41, jog: 3.07, sprint: 5.84, run_ball_jog: 3.07, run_ball_sprint: 5.84 };
  const measure = (o, x, y, simDt) => {
    if (o.px === undefined) { o.px = x; o.py = y; o.v = 0; o.hd = null; }
    const ddx = x - o.px, ddy = y - o.py;
    if (!(simDt > 1e-5)) simDt = curDt;               // the sim is frozen (intro, summary): the picture still measures its own movement
    if (simDt > 1e-5) {
      const raw = Math.hypot(ddx, ddy) / simDt; o.v = 0.5 * (raw + (o.raw ?? raw)); o.raw = raw;
      // heading = where the figure actually goes (three yaw: +Z faces the viewer, so sim +y is -Z)
      if (raw > 0.9) { const h = Math.atan2(ddx, -ddy); o.hd = o.hd === null ? h : o.hd + Math.atan2(Math.sin(h - o.hd), Math.cos(h - o.hd)) * Math.min(1, simDt * 14); }
    }
    o.px = x; o.py = y;
    return o.v;
  };
  // The displayed position is the sim position, except when the sim teleports (a new turn re-spreads the field): then the figure RUNS there,
  // speed-limited, so no figure ever glides or pops across the green. Returns the position and the time base to measure speed with.
  const place = (o, tx, ty, simDt) => {
    if (o.dx === undefined) { o.dx = tx; o.dy = ty; }
    const lim = 7.5 * Math.max(simDt, curDt), ex = tx - o.dx, ey = ty - o.dy, d = Math.hypot(ex, ey);
    let catching = false;
    if (d > lim) { o.dx += ex / d * lim; o.dy += ey / d * lim; catching = true; } else { o.dx = tx; o.dy = ty; }
    return { x: o.dx, y: o.dy, dt: catching ? Math.max(simDt, curDt) : simDt };
  };
  function gait(h, speed, { ball = false, fade = 0.2 } = {}) {
    const g = (h.gait ||= { mode: 'walk' });
    // walk < 1.9 < jog_slow < 3.5 < jog < 4.9 < sprint, with 0.3 m/s of hysteresis either way
    const lo = { walk: 0, jog_slow: 1.6, jog: 3.2, sprint: 4.6 }, hi = { walk: 1.9, jog_slow: 3.5, jog: 4.9, sprint: 99 };
    let m = g.mode;
    if (speed > hi[m]) m = m === 'walk' ? 'jog_slow' : m === 'jog_slow' ? 'jog' : 'sprint';
    else if (speed < lo[m]) m = m === 'sprint' ? 'jog' : m === 'jog' ? 'jog_slow' : 'walk';
    g.mode = m;
    const name = ball && (m === 'jog' || m === 'sprint') ? `run_ball_${m}` : m;
    const cur = h.layers.base.current;
    if (!cur || cur.clip.name !== name || cur.target === 0) {
      const opts = { fade, loop: true };
      if (cur && cur.clip.loop && cur.clip.events.footL !== undefined && h.clips[name] && h.clips[name].events.footL !== undefined) {
        const a = cur.clip, b = h.clips[name];
        const ph = (((cur.time - a.events.footL) / a.dur) % 1 + 1) % 1;
        opts.startTime = ((b.events.footL + ph * b.dur) % b.dur);
      }
      h.play(name, opts);
    }
    const t = h.layers.base.current;
    t.speed = clamp(speed / STRIDE[name], 0.45, 1.6);
    return name;
  }

  // ---- the people ---------------------------------------------------------------------------------------------------------------------------
  const people = [];                       // every human (root scale, blob shadows)
  let batter = null, server = null, crowd = null; const fielders = [];
  const SOCKS = '#e6e1d2';
  async function person(spec, { clips = [], lod = 1 } = {}) {
    const h = await loadHuman({ character: spec.ch, kit: { top: spec.top, bottoms: spec.bottoms, socks: SOCKS }, skin: spec.skin, hair: spec.hair, lod: 'auto', quality });
    h.inert = new SM.Inertializer(h);
    h.groundClamp = 'auto'; h.footPlanting = true; h.turnRate = 6;
    for (const c of clips) ({ bat: addBatClips, throw: addThrowClips, field: addFieldClips, sport: addSportClips })[c](h);
    if (spec.cap && addCap) { try { const c = addCap(h, { color: spec.cap }); if (c && c.obj) c.obj.scale.setScalar(1.06); } catch { /* ignore */ } }
    stage.add(h); stage.track(h);
    h.setLOD(lod);
    h.root.visible = false;
    h.play('idle_relaxed', { fade: 0 });
    people.push(h);
    return h;
  }
  const ballProp = () => { const m = world.makeBall(1); m.visible = false; return m; };
  async function build() {
    const bh = await person({ ...BATTER, top: '#f1b91e', cap: 0x3a2a1c }, { clips: ['bat', 'sport'], lod: 0 });
    const bat = world.makeBat();
    bh.attach(bat, 'R', 'bat', { slide: 0.07 }); bh.holdTwoHanded(bat, 'L', { gap: 0.13 });
    batter = { h: bh, bat, held: true, look: '', swingKey: '', cur: '', outKey: '', hop: 0, dodge: null };
    const sh = await person(SERVER, { clips: ['throw', 'sport'], lod: 0 });
    const sb = ballProp(); sh.attach(sb, 'R', 'ball');
    server = { h: sh, ball: sb, tossKey: '' };
    const fs = await Promise.all(FIELDERS.map((s) => person(s, { clips: ['throw', 'field', 'sport'], lod: 0 })));
    fs.forEach((h, i) => { const b = ballProp(); h.attach(b, 'R', 'ball'); fielders.push({ h, ball: b, i, wasWind: false, sp: 0, catchKey: '', pickKey: '', pickAt: -9 }); });
    // the village: instanced, varied real-looking people standing behind the side fences and along the far fence
    try {
      const FX = K.FENCE_X, face = [0, 0, -11];
      crowd = createCrowd3d(stage, {
        rows: [
          { from: [-(FX + 1.7), 0, -2], to: [-(FX + 1.7), 0, -27], count: 11, face },
          { from: [-(FX + 3.1), 0, -4], to: [-(FX + 3.1), 0, -26], count: 9, face },
          { from: [FX + 1.7, 0, -3], to: [FX + 1.7, 0, -28], count: 11, face },
          { from: [FX + 3.1, 0, -5], to: [FX + 3.1, 0, -25], count: 9, face },
          { from: [-17, 0, -K.FENCE_Y - 1.4], to: [17, 0, -K.FENCE_Y - 1.4], count: 10, face },
        ],
        seed: 23, culture: 'european_village', quality: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low',
        excitement: 0.2, props: { phone: 0, flag: 0.08, child: 0.1 }, flagColors: ['#c8402f', '#f1e7c8'], kids: 0.12, blobShadows: true,
      });
    } catch (e) { console.warn('crowd3d failed', e); crowd = null; }
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
        stage.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
        if (perfLevel === 1 && stage.enableBlobShadows) { stage.enableBlobShadows(24, { radius: 0.5, opacity: 0.8 }); stage.blobs.mesh.visible = true; }
        stage.invalidate();
      }
    }
  }

  // ---- the camera: the 2D layer's perspective camera (art.js makeCam), written as the WebGL projection so every 2D mark lands on its pixel --------
  function setCamera(c, W, H) {
    const n = c.near, f = c.far;
    cam.position.set(c.pos[0], c.pos[1], c.pos[2]);
    cam.rotation.set(-c.pitch, 0, 0);
    cam.updateMatrixWorld(true);
    cam.projectionMatrix.set(
      2 * c.f / W, 0, 1 - 2 * c.cx / W, 0,
      0, 2 * c.f / H, 2 * c.cy / H - 1, 0,
      0, 0, -(f + n) / (f - n), -2 * f * n / (f - n),
      0, 0, -1, 0,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // ---- per-frame state kept by the director --------------------------------------------------------------------------------------------------------
  const D = { lastT: null, lastTT: 0, lastTRef: null, T: null, hist: [], heroT: 0, heroCyc: -1 };
  const curName = (h) => { const t = h.layers.base.current; return t ? t.clip.name : ''; };
  const curBusy = (h) => { const t = h.layers.base.current; return !!t && !t.clip.loop && !t.finished && t.target !== 0; };
  const playOnce = (h, name, o = {}) => h.play(name, { fade: 0.15, loop: false, ...o });

  // The ball as the picture shows it: the sim ball, except for a short "hit stop" (it stays at the bat until the bat reaches it, then catches up).
  function ballShown(T) {
    const b = T.ball;
    if (D.T !== T) { D.T = T; D.hist.length = 0; }
    const last = D.hist[D.hist.length - 1];
    if (!last || last.t !== T.t) { D.hist.push({ t: T.t, x: b.x, y: b.y, z: b.z }); if (D.hist.length > 90) D.hist.shift(); }
    let tau = T.t;
    if (T.swing && T.swing.hit) {
      const ts = T.t - T.swing.t;
      if (ts < HIT_LAG) tau = T.swing.t;
      else if (ts < HIT_LAG + 0.25) tau = T.t - HIT_LAG * (1 - (ts - HIT_LAG) / 0.25);
    }
    if (tau >= T.t - 1e-6) return { x: b.x, y: b.y, z: b.z };
    for (let i = D.hist.length - 1; i > 0; i--) {
      const a = D.hist[i - 1], c = D.hist[i];
      if (a.t <= tau && tau <= c.t) { const u = c.t > a.t ? (tau - a.t) / (c.t - a.t) : 0; return { x: lerp(a.x, c.x, u), y: lerp(a.y, c.y, u), z: lerp(a.z, c.z, u) }; }
    }
    const f = D.hist[0]; return f ? { x: f.x, y: f.y, z: f.z } : { x: b.x, y: b.y, z: b.z };
  }

  // ---- the batter ---------------------------------------------------------------------------------------------------------------------------------
  function directBatter(m, T, pal, human, zs, bw) {
    const B = batter, h = B.h, r = T.runner;
    h.root.visible = true;
    const kit = pal ? pal.shirt : '#f1b91e';
    if (B.look !== kit) { B.look = kit; h.setKit({ top: kit, bottoms: '#2c3550', socks: SOCKS }); }
    const bp0 = place(B, r.x, r.y, P.simDtNow);
    h.setPosition(bp0.x, 0, -bp0.y);
    const bspeed = measure(B, bp0.x, bp0.y, bp0.dt);
    h._mv = bspeed;
    const run = r.st === 'toFar' || r.st === 'back';
    const key = `${m.i}:${m.side}:${T.idx}`;
    let wantYaw = BAT_YAW;
    // the bat rides in the hand while running; the second hand is only on it for the stance and the swing
    const twoHand = !run && r.st !== 'out' && r.st !== 'safe' && r.st !== 'atFar';
    if (twoHand !== B.held) { B.held = twoHand; if (twoHand) h.holdTwoHanded(B.bat, 'L', { gap: 0.13 }); else h.releaseSecondHand(); }
    const cn = curName(h), swingBusy = cn.startsWith('bat_') && cn !== 'bat_stance' && cn !== 'bat_backlift' && curBusy(h);
    // the swing: starts the tick the sim swings; the library clip reaches the ball HIT_LAG later (the picture holds the ball at the bat until then)
    if (T.swing && B.swingKey !== `${key}:${T.swing.t}`) { B.swingKey = `${key}:${T.swing.t}`; B.cur = 'swing'; playOnce(h, 'bat_pull', { fade: 0.06 }); }
    if (!T.swing && B.cur === 'swing') B.cur = '';
    const tr = h.layers.base.current;
    if (T.swing && tr && tr.clip.name === 'bat_pull') {
      // the sweet spot meets the ball the picture shows (a miss passes half a metre early or late)
      const off = T.swing.hit ? 0 : (T.swing.d < 0 ? -0.5 : 0.5);
      aim(h, 'contact', { x: bw.x + off, y: bw.y, z: bw.z }, () => B.bat.localToWorld(_w.set(0, 0.7, 0)).clone());
    } else aim(h, 'contact', null);
    if (r.st === 'out') {
      wantYaw = r.y > K.HOME_Y + 1 ? Math.PI : BAT_YAW;
      if (B.outKey !== key) { B.outKey = key; playOnce(h, 'hit', { fade: 0.08 }); }
      else if (!curBusy(h) && cn !== 'idle_relaxed') h.play('idle_relaxed', { fade: 0.4, loop: true });
    } else if (run) {
      const speed = bspeed;
      wantYaw = r.st === 'toFar' ? Math.PI : 0;
      if (!swingBusy) { B.cur = 'run'; gait(h, Math.max(1.2, speed), { fade: 0.18 }); }
    } else if (r.st === 'atFar') {
      wantYaw = 0;
      if (B.cur !== 'far') { B.cur = 'far'; h.play('ready_stance', { fade: 0.35, loop: true }); }
    } else if (r.st === 'safe') {
      wantYaw = 0;
      if (B.cur !== 'safe') { B.cur = 'safe'; playOnce(h, T.pts >= K.PTS.far + K.PTS.home ? 'celebrate' : 'celebrate_2', { fade: 0.2 }); }
    } else if (bspeed > 0.8 && !swingBusy) {
      wantYaw = B.hd !== null && B.hd !== undefined ? B.hd : wantYaw;
      B.cur = 'walk'; gait(h, bspeed, { fade: 0.2 });
    } else if (!T.swing) {
      // at home: the bat comes back over the shoulder as the thumb draws the aim; the computer batters wind up as the ball comes
      const winding = T.ph === 'serve' && (m.aiming || (!human && T.t > T.tossT - 0.6));
      if (winding) { if (B.cur !== 'wind') { B.cur = 'wind'; playOnce(h, 'bat_backlift', { fade: 0.2, speed: 0.9 }); } }
      else if (B.cur !== 'stance' || (!curBusy(h) && cn !== 'bat_stance' && cn !== 'bat_backlift')) { B.cur = 'stance'; h.play('bat_stance', { fade: 0.25, loop: true }); }
    } else if (!swingBusy && B.cur === 'swing') { B.cur = 'stance'; h.play('bat_stance', { fade: 0.3, loop: true }); }
    h.setFacing(wantYaw, { snap: false });
    // the sidestep: a short hop and a lean into it (applied after the animation step)
    B.dodge = r.dT > 0 ? { k: 1 - r.dT / K.DODGE_T, dir: Math.sign(r.vx) || 1 } : null;
  }

  // ---- the server (a team-mate) ---------------------------------------------------------------------------------------------------------------------
  const HERO_SV = [2.4, 3.0];
  function directServer(m, T, human, hero, zs, rball) {
    const sv = server, h = sv.h;
    h.root.visible = true;
    const sx = hero ? HERO_SV[0] : 0, sy = hero ? HERO_SV[1] : K.THROW_Y;
    h.setPosition(sx, 0, -sy);
    h.setFacing(hero ? Math.atan2(-sx, sy - K.HOME_Y) : 0, { snap: false });
    const waiting = T.ph === 'serve' && T.t <= 1e-4;
    sv.ball.visible = waiting;
    sv.ball.scale.setScalar(rball * 0.75 / zs);
    if (!hero && T.ph === 'serve') {
      // time the toss so the ball leaves the hand on the tick the sim releases it (the end of the intro, or the end of the reveal)
      const key = `${m.i}:${m.side}:${T.idx}`;
      let eta = null;
      if (m.ph === 'intro' && human) eta = 1.0 - m.pt;
      else if (m.ph === 'reveal') eta = 2 - m.pt;
      else if (m.ph === 'play') eta = -T.t;
      if (eta !== null && sv.tossKey !== key) {
        sv.tossKey = key;
        if (eta <= 0) h.play('toss_underarm', { fade: 0.1, loop: false, startTime: clamp(0.3 - eta, 0, 0.6) });
        else h.playTimed('toss_underarm', 'release', eta, { fade: 0.2 });
      }
    }
    if (!curBusy(h) && curName(h) !== 'idle_relaxed' && !(hero && h.layers.base.current && h.layers.base.current.target === 0)) h.play('idle_relaxed', { fade: 0.3, loop: true });
  }

  // ---- the fielders -----------------------------------------------------------------------------------------------------------------------------------
  function directFielder(T, i, sf, zs, bw, rball, simDt) {
    const h = sf.h, st = T.fielders[i], b = T.ball, r = T.runner;
    h.root.visible = true;
    const pl = place(sf, st.x, st.y, simDt);
    h.setPosition(pl.x, 0, -pl.y);
    // speed from the displayed movement (sim seconds), so the feet match the ground
    sf.sp = measure(sf, pl.x, pl.y, pl.dt);
    const held = b.st === 'held' && T.holder === i;
    sf.ball.visible = held;
    if (held) sf.ball.scale.setScalar(rball * 0.75 / zs);
    const moving = sf.sp > 0.5, cn = curName(h), busy = curBusy(h);
    const dBall = Math.hypot(b.x - st.x, b.y - st.y);
    h._mv = sf.sp;
    // hands up on the run: no catch clip (it would plant the feet); the running legs and arm swing stay, the hands reach the ball with the IK
    // weight blended in and out over 0.15 s
    {
      let want = 0;
      if (T.t < (sf.rcUntil ?? -1) && T.idx === sf.rcIdx) {
        const vh0 = Math.hypot(b.vx, b.vy), eta0 = Math.max(0, (dBall - 0.5) / Math.max(2, vh0 * 0.8 + sf.sp * 0.5));
        want = held || b.st === 'held' ? 1 : clamp((0.5 - eta0) / 0.25, 0, 1);
      }
      sf.rw = (sf.rw || 0) + clamp(want - (sf.rw || 0), -curDt / 0.15, curDt / 0.15);
      if (sf.rw > 0.002) {
        const yw = h.root.rotation.y, ox = Math.cos(yw) * 0.05, oz = -Math.sin(yw) * 0.05, py = Math.max(0.45, bw.y);
        h.setReach('R', { x: bw.x - ox, y: py, z: bw.z - oz }, { weight: sf.rw * sf.rw * (3 - 2 * sf.rw) });
        h.setReach('L', { x: bw.x + ox, y: py, z: bw.z + oz }, { weight: sf.rw * sf.rw * (3 - 2 * sf.rw) });
      } else { h.setReach('R', null); h.setReach('L', null); }
    }
    let yaw;
    if (st.st === 'wind') yaw = yawOfSim(Math.atan2(r.x - st.x, r.y - st.y));
    else if (moving) yaw = sf.hd !== null && sf.hd !== undefined ? sf.hd : yawOfSim(st.face);
    else yaw = Math.atan2(b.x - st.x, -(b.y - st.y));
    h.turnRate = sf.sp > 1 ? 16 : 6;
    h.setFacing(yaw, { snap: false });
    // throw: the release lands on the tick the sim throws
    if (st.st === 'wind') {
      if (!sf.wasWind) {
        sf.wasWind = true;
        if (cn === 'field_pickup_throw' && busy && T.t - sf.pickAt < 0.7) h.timeWarpTo('release', Math.max(0.02, st.wind));
        else h.playTimed('throw_overarm', 'release', Math.max(0.03, st.wind), { fade: 0.12 });
      } else if (cn === 'field_pickup_throw' || cn === 'throw_overarm') h.timeWarpTo('release', Math.max(0.02, st.wind));
      return;
    }
    sf.wasWind = false;
    const trk = h.layers.base.current, relT = trk && trk.clip.events ? trk.clip.events.release : undefined;
    const followDone = (cn === 'throw_overarm' || cn === 'field_pickup_throw') && relT !== undefined && trk.time > relT + 0.14 && sf.sp > 1.0;
    if (busy && !followDone && (cn === 'throw_overarm' || cn === 'field_pickup_throw' || cn === 'catch_two_hand')) {
      if (cn === 'catch_two_hand') aim(h, 'catch', { x: bw.x, y: Math.max(0.3, bw.y), z: bw.z }, (hh) => handMid(hh).clone());
      if (cn === 'field_pickup_throw') aim(h, 'ball', { x: bw.x, y: Math.max(0.1, bw.y), z: bw.z }, (hh) => { hh.bonePosition('R_Hand', _v); return _v.clone(); });
      return;
    }
    aim(h, 'catch', null); aim(h, 'ball', null);
    const vh = Math.hypot(b.vx, b.vy);
    // catching: hands up for a ball dropping into reach, timed to its arrival
    if (b.st === 'air' && b.z > 0.25 && b.z < 3.2 && dBall < 7 && st.mode !== 'hold') {
      const toward = ((st.x - b.x) * b.vx + (st.y - b.y) * b.vy) / Math.max(1e-3, dBall * Math.max(vh, 0.1));
      const eta = (dBall - 0.5) / Math.max(2, vh * Math.max(0.2, toward) + sf.sp * 0.5);
      const ck = `${T.idx}:${Math.floor(T.t * 2)}`;
      if (toward > 0.3 && eta < 0.55 && sf.catchKey !== ck) {
        sf.catchKey = ck;
        if (sf.sp > 1.3) { sf.rcUntil = T.t + Math.max(eta, 0) + 0.3; sf.rcIdx = T.idx; }
        else { h.playTimed('catch_two_hand', 'catch', Math.max(0.05, eta), { fade: 0.12 }); return; }
      }
    }
    // gathering a ball off the ground and throwing at the runner
    if ((b.st === 'roll' || (b.st === 'air' && b.z < 0.9)) && dBall < 3.2 && exposed(r) && st.mode === 'chase') {
      const eta = Math.max(0.05, (dBall - 0.9) / Math.max(1.5, sf.sp + vh * 0.5));
      const pk = `${T.idx}`;
      if (eta < 0.45 && sf.pickKey !== pk) {
        sf.pickKey = pk; sf.pickAt = T.t + eta;
        h.playTimed('field_pickup_throw', 'pickup', eta, { fade: 0.12 });
        return;
      }
    }
    // on the move or ready
    if (moving) {
      const carrying = held && st.st === 'carry';
      gait(h, sf.sp, { fade: 0.2, ball: carrying });
    } else if (cn !== 'ready_stance' || !h.layers.base.current.clip.loop) h.play('ready_stance', { fade: 0.3, loop: true });
  }

  // ---- the spectators: one instanced crowd; it reacts to the cheer the game raises (far line, round trip) ----------------------------------------------
  let cheerPrev = 0;
  function directCrowd(cheer, vis, dt) {
    if (!crowd) return;
    crowd.group.visible = vis;
    if (!vis) return;
    const c = cheer ? 1 : 0;
    if (c && !cheerPrev) { try { crowd.react('cheer', { intensity: 0.9 }); crowd.setExcitement(0.7); } catch { /* ignore */ } }
    if (!c && cheerPrev) crowd.setExcitement(0.2);
    cheerPrev = c;
    crowd.update(dt);
  }

  // ---- the title hero: a small scripted rally (toss, swing, the fielder takes it) ------------------------------------------------------------------
  function directHero(v, dt, zs, rball) {
    const CYC = 5.2;
    D.heroT += dt;
    const t = D.heroT % CYC, cyc = Math.floor(D.heroT / CYC);
    const tossT = 1.25, rel = 0.55, tc = rel + tossT, flight = 1.35;
    const B = batter, sv = server, f0 = fielders[0], f1 = fielders[1];
    f0.h.root.visible = f1.h.root.visible = true;
    const FP = [[-3.9, 4.6], [4.3, 5.3]];
    [f0, f1].forEach((f, k) => { f.h.setPosition(FP[k][0], 0, -FP[k][1]); f.h.setFacing(Math.atan2(-FP[k][0], FP[k][1]), { snap: false }); f.ball.visible = false; });
    B.h.root.visible = true; B.h.setPosition(-0.4, 0, -K.HOME_Y); B.h.setFacing(BAT_YAW, { snap: false });
    const pal = v.pal; if (pal && B.look !== pal.shirt) { B.look = pal.shirt; B.h.setKit({ top: pal.shirt, bottoms: '#2c3550', socks: SOCKS }); }
    if (!B.held) { B.held = true; B.h.holdTwoHanded(B.bat, 'L', { gap: 0.13 }); }
    if (D.heroCyc !== cyc) {
      D.heroCyc = cyc; D.heroBat = false; D.heroCatch = false;
      sv.h.playTimed('toss_underarm', 'release', rel, { fade: 0.2 });
      B.h.play('bat_stance', { fade: 0.2, loop: true });
      for (const f of [f0, f1]) f.h.play('ready_stance', { fade: 0.3, loop: true });
    }
    directServer({ ph: 'x', pt: 0, i: 0, side: 0 }, { ph: 'x', t: 1 }, false, true, zs, rball);
    let ball = null;
    if (t < rel) sv.ball.visible = true;
    else if (t < tc) { const p = tossAt({ tossT }, t - rel), u = (t - rel) / tossT; ball = { x: lerp(HERO_SV[0], 0, u), y: lerp(HERO_SV[1], K.HOME_Y + 0.15, u), z: p.z }; }
    else if (t < tc + flight) {
      const u = (t - tc) / flight;
      ball = { x: lerp(0, FP[0][0], u), y: lerp(K.HOME_Y + 0.15, FP[0][1], u), z: 1.0 + Math.sin(u * Math.PI) * 4.4 * (1 - 0.25 * u) + 0.3 * u };
    } else { f0.ball.visible = true; f0.ball.scale.setScalar(rball * 0.75 / zs); }
    if (t >= tc - HIT_LAG && !D.heroBat) { D.heroBat = true; playOnce(B.h, 'bat_pull', { fade: 0.05 }); }
    if (D.heroBat && curName(B.h) === 'bat_pull') aim(B.h, 'contact', { x: 0, y: 1.0 * zs + rball, z: -(K.HOME_Y + 0.15) }, () => B.bat.localToWorld(_w.set(0, 0.7, 0)).clone()); else aim(B.h, 'contact', null);
    const arrive = tc + flight;
    if (!D.heroCatch && t > arrive - 0.4 && t < arrive) { D.heroCatch = true; f0.h.playTimed('catch_two_hand', 'catch', arrive - t, { fade: 0.12 }); }
    if (D.heroCatch && curName(f0.h) === 'catch_two_hand') aim(f0.h, 'catch', { x: FP[0][0], y: 1.2 * zs, z: -FP[0][1] }, (hh) => handMid(hh).clone());
    return ball;
  }

  // ---- the app icon: the batter at the instant of contact, filmed low from the front-left in golden light (?icon=1&shot=1, rendered offline) -------------------
  const ICON_T = Number((qs(/[?&]ict=([0-9.]+)/) || [0, 0.15])[1]);
  function frameIcon(cw, ch) {
    const B = batter, h = B.h;
    for (const f of fielders) { f.h.root.visible = false; f.ball.visible = false; }
    server.h.root.visible = false;
    if (crowd) crowd.group.visible = false;
    world.heroTrees.visible = true;
    h.root.visible = true; h.setPosition(0, 0, -0.8);
    h.setFacing(Number((qs(/[?&]icy=(-?[0-9.]+)/) || [0, 0.85])[1]), { snap: true });
    h.setKit({ top: decodeURIComponent((qs(/[?&]ick=(%23[0-9a-fA-F]{6})/) || [0, '%23f1b91e'])[1]), bottoms: '#2c3550', socks: SOCKS });
    if (!B.held) { B.held = true; h.holdTwoHanded(B.bat, 'L', { gap: 0.13 }); }
    if (!D.iconInit) { D.iconInit = true; h.play('bat_pull', { fade: 0, loop: false, startTime: ICON_T }); }
    // contact point: in front of the blade at chest height
    const hit = { x: 0.55, y: 1.12, z: -0.8 };
    stage.setLighting('day', { hemi: 0.75, hemiSky: 0xffe6c0, hemiGround: 0x6a8a40, key: 0xffd9a0, keyI: 3.2, rim: 0xcfe0ff, rimI: 1.1, exposure: 0.95 });
    stage.setSky(0x86b8ea, null);
    stage._shadowOffset = new THREE.Vector3(-5, 5.5, 4);
    aim(h, 'contact', hit, null);
    P.lastDt = 0; stage.update(0, { renderNow: false });
    h.inert.reset();
    world.ball.visible = true; world.ball.scale.setScalar(0.04); world.ball.position.set(hit.x + 0.02, hit.y + 0.02, hit.z);
    world.halo.visible = true; world.halo.position.copy(world.ball.position); world.halo.scale.setScalar(0.5);
    world.ballShadow.visible = false;
    world.clearTrail();
    for (let k = 0; k < world.trailN; k++) { const u = k / (world.trailN - 1); world.pushTrail(hit.x + 0.02 + (1 - u) * 1.5, hit.y + 0.02 + (1 - u) * (1 - u) * 0.0 + (1 - u) * 0.7, hit.z - (1 - u) * 2.8); }
    if (world.scenery) world.scenery.update(0, cam);
    cam.fov = Number((qs(/[?&]icf=([0-9.]+)/) || [0, 30])[1]); cam.aspect = cw / ch; cam.near = 0.3; cam.far = 600;
    const cp = (qs(/[?&]icc=(-?[0-9.]+),(-?[0-9.]+),(-?[0-9.]+)/) || [0, -2.1, 1.05, 3.1]).slice(1).map(Number), lk = (qs(/[?&]icl=(-?[0-9.]+),(-?[0-9.]+),(-?[0-9.]+)/) || [0, 0.18, 1.12, -0.8]).slice(1).map(Number);
    cam.position.set(cp[0], cp[1], cp[2]); cam.lookAt(lk[0], lk[1], lk[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, cw, ch); renderer.clear(true, true, true);
    stage.setShadowTarget(0, 0, -1);
    renderer.render(stage.scene, cam);
    stage.stats.renders++;
  }

  // ---- one frame --------------------------------------------------------------------------------------------------------------------------------------
  function frame() {
    if (!P.ready || P.lost || P.off) { GL.on = false; stage.setVisible(false); return; }
    GL.on = true;
    const game = P.game, S = game ? game.getState() : null;
    if (!S) { stage.setVisible(false); return; }
    const now = globalThis.performance.now();
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    const kU = meta.cssPerUnit || cw / meta.width;
    const offX = (cw - meta.width * kU) / 2, offY = (ch - meta.height * kU) / 2;
    if (ICON) { stage.setVisible(true); frameIcon(cw, ch); return; }
    const v = GL.views[0] || { kind: 'menu', g: geom({ x: 0, y: 0, w: meta.width, h: meta.height }), state: S };
    let g = v.g;
    if (v.kind === 'hero') {
      // frame the small green inside the hero rectangle the 2D title asked for
      const R = v.R, s = Math.max(14, Math.min(R.w / 11.5, (R.h * 0.97 - 120) / (0.8 * 6.2)));
      const hc = makeCam(R, HERO_PTS, { pitch: R.h / R.w > 0.9 ? 0.3 : 0.42, fov: 0.62, target: [0, 0.8, -3.2], fillX: 0.98, fillY: 0.98, anchorY: R.y + R.h * 0.97 });
      hc.pos = [hc.pos[0] + Math.sin(D.heroT * 0.28) * 0.55, hc.pos[1] + Math.sin(D.heroT * 0.19) * 0.12, hc.pos[2]];   // slow drift
      g = { ...g, cam: hc };
    }
    if (P.debugG) g = { ...g, ...P.debugG };
    const zs = g.zs || 1, rball = 0.037;
    stage.setVisible(true);
    const m = S.m, T = m ? m.T : null;
    const play = v.kind === 'play' && m && T;
    // animation clock: the sim's own time while a turn runs (so a fast-forwarded rival innings animates fast too), else the game clock
    let dt = D.lastT === null ? 0 : S.t - D.lastT; D.lastT = S.t;
    let simDt = 0;
    if (play) {
      if (D.lastTRef === T && T.t >= D.lastTT) simDt = T.t - D.lastTT;
      D.lastTRef = T; D.lastTT = T.t;
      if (m.ph === 'play' && T.ph !== 'done') dt = simDt;
    }
    if (P.manualDt != null) { dt = P.manualDt; simDt = dt; }
    P.simDtNow = simDt;
    dt = clamp(dt, 0, 0.12);
    const cheer = S.cheer > 0;
    // hide everyone, then show who the scene needs
    for (const f of fielders) f.h.root.visible = false;
    batter.h.root.visible = false; server.h.root.visible = false;
    for (const f of fielders) f.ball.visible = false;
    world.heroTrees.visible = v.kind === 'hero';
    world.motes.visible = v.kind !== 'play';
    D.bt = (D.bt || 0) + dt; world.updateBunting(D.bt); world.updatePuffs(dt);
    if (v.kind !== 'play') world.updateMotes((D.moteT = (D.moteT || 0) + dt));
    world.ball.visible = false; world.ballShadow.visible = false;
    let ball = null;
    if (v.kind === 'hero') {
      ball = directHero(v, dt, zs, rball);
      directCrowd(false, false, dt);
    } else if (play) {
      const bp = ballShown(T), human = humanSide(m);
      const bw = { x: bp.x, y: bp.z * zs + rball, z: -bp.y };
      directBatter(m, T, v.pal, human, zs, bw);
      directServer(m, T, human, false, zs, rball);
      for (let i = 0; i < fielders.length; i++) directFielder(T, i, fielders[i], zs, bw, rball, simDt);
      const inHand = T.ball.st === 'held' || (T.ph === 'serve' && T.t <= 1e-4);
      if (!inHand) ball = { x: bp.x, y: bp.y, z: bp.z };
      directCrowd(cheer, true, dt);
    } else {
      directCrowd(false, v.kind === 'menu', dt);
    }
    if (!ball) { world.halo.visible = false; world.clearTrail(); D.pz = undefined; }
    if (ball) {
      if (D.pz !== undefined && D.pz > 0.12 && ball.z <= 0.07 && (D.pvz === undefined || true)) world.puff(ball.x, 0.05, -ball.y, 3);
      D.pz = ball.z;
      world.halo.visible = true; world.halo.position.set(ball.x, ball.z + rball, -ball.y); world.halo.scale.setScalar(0.34 + 0.06 * Math.sin(D.hn = (D.hn || 0) + dt * 14));
      world.pushTrail(ball.x, ball.z + rball, -ball.y);
      world.ball.visible = true; world.ball.scale.setScalar(rball);
      world.ball.position.set(ball.x, ball.z * zs + rball, -ball.y);
      world.ball.rotation.x += dt * 9; world.ball.rotation.z += dt * 5;
      const sh = clamp(1 - ball.z / 6, 0.35, 1);
      world.ballShadow.visible = true; world.ballShadow.scale.setScalar(rball * 2.6 * sh);
      world.ballShadow.position.set(ball.x + rball * 0.5, 0.03, -ball.y);
    }
    { const lod = 0; if (P.lodNow !== lod) { P.lodNow = lod; batter.h.setLOD(lod); server.h.setLOD(lod); } }
    // the people's root scale (legible figures on small screens: the same factor the 2D layer uses for heights)
    for (const h of people) h.root.scale.setScalar(zs);
    P.lastDt = dt; curDt = dt;
    stage.update(dt, { renderNow: false });
    for (const h of people) { if (h.root.visible) { h.inert.apply(dt); if (h.limbSanity) h.limbSanity(); } else h.inert.reset(); }
    // planted-foot IK only while standing (a stride is matched to the ground by the clip rate; re-planting mid-stride is what pops)
    for (const h of people) {
      const cur = h.layers.base.current, loco = (!!cur && /^(walk|jog|sprint|run_ball)/.test(cur.clip.name)) || (h._mv || 0) > 0.9;
      if (h._locoNow !== loco) { h._locoNow = loco; h.footPlanting = !loco; if (loco) for (const leg of h.legs) { leg.planted = false; leg.w = 0; } }
    }
    if (world.scenery) world.scenery.update(dt, cam);
    if (play && batter.h.root.visible && batter.dodge) {
      const d = batter.dodge, s = Math.sin(d.k * Math.PI);
      batter.h.root.position.y += s * 0.35 * zs;
      batter.h.root.rotation.z = -d.dir * 0.32 * s;
    } else batter.h.root.rotation.z = 0;
    // blobs for the low tier (and after the adaptive step-down), the shadow map otherwise
    if (stage.blobs && stage.blobs.mesh.visible) {
      let n = 0;
      for (const h of people) { if (!h.root.visible) continue; const p = h.root.position; stage.blobs.set(n++, p.x, p.z, 0.55 * zs); }
      stage.blobs.mesh.count = n;
    }
    // draw
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    renderer.setViewport(offX, ch - offY - meta.height * kU, meta.width * kU, meta.height * kU);
    setCamera(g.cam, meta.width, meta.height);
    if (shadowsOn()) {
      const sc = key.shadow.camera, half = 26;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 90;
      sc.updateProjectionMatrix();
    }
    stage.setShadowTarget(0, 0, v.kind === 'hero' ? -5 : -12);
    renderer.render(stage.scene, cam);
    stage.stats.renders++;
    perfTick(now);
  }
  P.frame = frame;
  P.SM = SM; P.people = people; P.getBatter = () => batter; P.fielders = fielders; P.getServer = () => server;
  P.D = D;
  P.setBatYaw = (y) => { BAT_YAW = y; };

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; GL.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  // the 2D layer renders first (collecting the view it wants), then this layer draws it
  P.wrap = (game) => {
    P.game = game;
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      r(ctx, view);
      if (ICON) {
        ctx.clearRect(0, 0, 1e5, 1e5);
        const w = meta.width, h = meta.height;
        const gr = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.35, w * 0.5, h * 0.5, w * 0.78); gr.addColorStop(0, 'rgba(10,20,0,0)'); gr.addColorStop(1, 'rgba(20,28,6,0.5)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        const wm = ctx.createLinearGradient(0, 0, w, h * 0.4); wm.addColorStop(0, 'rgba(255,210,120,0.22)'); wm.addColorStop(0.5, 'rgba(255,210,120,0)');
        ctx.fillStyle = wm; ctx.fillRect(0, 0, w, h);
      }
      frame();
    };
    return game;
  };
  return P;
}
