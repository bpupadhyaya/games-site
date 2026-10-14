// 3D presenter for Jukskei. It only READS the game state (the world, the swing, the throw animation, the aim) and draws the venue, the
// stake, the wooden pins, the thrower and the spectators behind the transparent kit canvas. The kit canvas keeps the HUD, the
// guides (ring, arc, ghost pins), menus and input. Both layers use ONE camera: the same side-on oblique projection the 2D layer
// uses (x along the lane, depth foreshortened by K, height straight up), expressed here as the projection matrix of the WebGL
// camera, so every 2D mark lands on the pixel it belongs to. Without WebGL2, with ?nogl, or while the assets load, the 2D art plays.
import { meta } from '../src/game.js';
import { GL } from '../src/glbridge.js';
import { K } from '../src/cam.js';
import { STAKE_H, PIN_LEN } from '../src/sim.js';
import { buildWorld } from './world.js';
import { Thrower, makePinProp, SPECTATORS, FIG_X } from './actors.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ICON = (() => { try { return new URLSearchParams(globalThis.location.search).has('icon'); } catch { return false; } })();   // QA: ?icon=1&shot=1 = the bare hero picture for the app icon art

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const shotMode = /[?&]shot=/.test(globalThis.location.search);
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 12, preserveDrawingBuffer: shotMode }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera, key = stage.lights.key;
  renderer.autoClear = false;
  renderer.setClearColor(0x2a1a0a, 1);
  cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true);
  const shadowsOn = () => renderer.shadowMap.enabled;

  const world = buildWorld(V3, stage, { quality });
  if (quality === 'low' && stage.enableBlobShadows) stage.enableBlobShadows(16, { radius: 0.4, opacity: 0.7 });

  const P = { stage, THREE, world, ready: false, lost: false, quality, licenses: '' };
  stage.onContextLost(() => { P.lost = true; GL.on = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); });

  // ---- the people -------------------------------------------------------------------------------------------------------------------------
  const throwers = {};                    // m, f
  const crowd = [];                       // { h, spec, i, cur }
  async function build() {
    const mk = (spec) => loadHuman({ ...spec, lod: 'auto', quality });
    const [m, f] = await Promise.all([
      mk({ character: 'athlete_m', kit: { top: '#e8892a', bottoms: '#2d3550', socks: '#e6e1d2' }, skin: 'tan', hair: 'black' }),
      mk({ character: 'athlete_f', kit: { top: '#e8892a', bottoms: '#2d3550', socks: '#e6e1d2' }, skin: 'tan', hair: 'black' }),
    ]);
    for (const [id, h] of [['m', m], ['f', f]]) {
      h.groundClamp = 'auto'; h.footPlanting = true;
      stage.add(h); stage.track(h);
      h.setLOD(0);
      h.root.visible = false;
      const prop = makePinProp(THREE, world.pinGeo, world.pinMats[0]);
      throwers[id] = new Thrower(V3, h, prop);
      if (V3.addCap) { try { const c = V3.addCap(h, { color: 0xcdb77f }); if (c && c.obj) c.obj.scale.setScalar(1.06); } catch { /* ignore */ } }
    }
    const hs = await Promise.all(SPECTATORS.map((s) => mk({ character: s.ch, kit: { top: s.top, bottoms: s.bottoms, socks: '#d8d4c6' }, skin: s.skin, hair: s.hair })));
    hs.forEach((h, i) => {
      const s = SPECTATORS[i];
      h.groundClamp = 'auto'; h.footPlanting = true;
      if (s.cap && V3.addCap) { try { const c = V3.addCap(h, { color: s.cap }); if (c && c.obj) c.obj.scale.setScalar(1.06); } catch { /* ignore */ } }
      stage.add(h); stage.track(h);
      h.setLOD(quality === 'low' ? 2 : 1);
      h.play(i % 3 === 0 ? 'idle' : 'idle_relaxed', { fade: 0 });
      const tr = h.layers.base.current; if (tr) tr.time = (i * 0.37) % tr.clip.dur;
      crowd.push({ h, spec: s, i, cur: i % 3 === 0 ? 'idle' : 'idle_relaxed' });
    });
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- adaptive quality: if frames take too long, drop shadows and then resolution ------------------------------------------------------------
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
        stage.invalidate();
      }
    }
  }

  const D = { lastT: null, th: null, lastStakeFallen: false, cheerT: 0, yaw: Math.PI / 2 };

  // the 2D projector as a camera: x -> screen x; height -> up; depth -> down the screen by K; depth buffer along the view ray
  function setProjection(R, s, cx) {
    const gy = R.gyF ?? 0.72, A = 2 * s / R.w, B = 2 * s / R.h, range = 140;
    cam.projectionMatrix.set(
      A, 0, 0, -cx * A,
      0, B, -K * B, 1 - 2 * gy,
      0, -K / range, -1 / range, 0,
      0, 0, 0, 1,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // ---- the thrower: choose clip and facing from the state ---------------------------------------------------------------------------------------
  function directThrower(S, dt, look, show) {
    const id = look.female ? 'f' : 'm', other = id === 'm' ? 'f' : 'm';
    const O = throwers[other];
    if (O && O.h.root.visible) { O.h.root.visible = false; O.setHolding(false); }
    const T = throwers[id], h = T.h;
    h.root.visible = show;
    if (!show) return T;
    T.dress(look);
    h.setPosition(FIG_X, 0, 0);
    // facing: the heading of the throw being made, or toward the ring while aiming
    let phi = 0;
    if (S.spec && S.throwAnim) phi = S.spec.theta;
    else if (S.aim && S.m) phi = Math.atan2(S.aim.y, S.aim.x - FIG_X);
    const yaw = Math.PI / 2 - phi;
    D.yaw += (yaw - D.yaw) * clamp(dt * 9, 0, 1);
    h.setFacing(D.yaw);
    const sw = S.swing, th = S.throwAnim;
    const style = S.spec && th ? S.spec.style : (S.aim ? S.aim.style : T.style);
    T.setHolding(!!S.holding, null);
    if (th && th !== D.th && S.holding && th.t < Math.max(0.12, th.dur * 0.6)) {
      // a throw begins: continue from wherever the arm is (the wind-up progress when the swing bar was released)
      D.th = th;
      const fromWind = sw !== null && sw !== undefined || T.mode === 'wind';
      const u = fromWind ? (T.lastU ?? 0.5) : 0;
      const name = T.makeThrow(style, u, Math.max(0.08, th.dur - th.t), th.dur > 0.4);
      h.play(name, { fade: 0.05, loop: false, startTime: 0 });
      T.mode = 'throw'; T.style = style; T.lastU = null;
    } else if (sw && sw.on) {
      if (T.mode !== 'wind' || T.style !== style) { h.play(T.wind[style], { fade: 0.2, loop: false }); T.mode = 'wind'; T.style = style; }
      const tr = h.layers.base.current;
      if (tr) { tr.speed = 0; tr.time = clamp(sw.u, 0, 1) * tr.clip.dur; }
      T.lastU = clamp(sw.u, 0, 1);
    } else if (T.mode === 'wind') {
      h.play('idle_relaxed', { fade: 0.3 }); T.mode = 'idle';
    } else if (T.mode === 'throw') {
      const tr = h.layers.base.current;
      if (!th || (tr && tr.finished && tr.clip.name.startsWith('throw'))) { h.play('idle_relaxed', { fade: 0.35 }); T.mode = 'idle'; }
    } else {
      h.ensure('idle_relaxed', { fade: 0.3 });
    }
    return T;
  }

  // ---- one frame ---------------------------------------------------------------------------------------------------------------------------------
  function frame() {
    if (!P.ready || P.lost || P.off) { GL.on = false; stage.setVisible(false); return; }
    GL.on = true;
    const views = GL.views;
    if (!views.length) { stage.setVisible(false); return; }
    const main = views[0], S = main.state;
    const now = globalThis.performance.now();
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    const kU = meta.cssPerUnit || cw / meta.width;
    const offX = (cw - meta.width * kU) / 2, offY = (ch - meta.height * kU) / 2;
    stage.setVisible(true);
    // animation clock = the game's clock (it stops with the pause menu and with Watch & Learn's pause)
    let dt = D.lastT === null ? 0 : S.t - D.lastT; D.lastT = S.t;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);
    const w = S.w;
    world.setPitch(w.pitch);
    world.setLook(w.pitch.sky);
    world.skyDrift = S.t * 0.002;
    world.syncStake(w, S.t);
    // the stake knocked down: everyone at the fence cheers for a moment
    if (w.stake.fallen && !D.lastStakeFallen) D.cheerT = 2.6;
    D.lastStakeFallen = w.stake.fallen;
    if (D.cheerT > 0) D.cheerT -= dt;
    for (const c of crowd) {
      const want = D.cheerT > 0 ? (c.i % 2 ? 'cheer' : 'clap') : (c.i % 3 === 0 ? 'idle' : 'idle_relaxed');
      if (c.cur !== want) { c.cur = want; c.h.play(want, { fade: 0.35 }); }
    }
    let wantFig = views.some((v) => !v.noFigure);
    let T;
    if (ICON) {
      // the icon hero: one close side-on view, the thrower at the moment of release with the pin in hand, stake and flag behind
      const rr = { x: 0, y: 0, w: meta.width, h: meta.height, gyF: 0.9 };
      views.length = 0; views.push({ R: rr, cam: { s: meta.height * 0.39, cx: FIG_X + 0.5 }, state: S, noFigure: false });
      wantFig = true;
      const look = { skin: 1, shirt: '#e8892a', female: false };
      T = throwers.m; throwers.f.h.root.visible = false;
      T.h.root.visible = true; T.dress(look); T.h.setPosition(FIG_X, 0, 0); T.h.setFacing(Math.PI / 2);
      T.setHolding(true, null); T.prop.scale.setScalar(1.7);
      if (!D.iconInit) { D.iconInit = true; const name = T.makeThrow(0, 0.85, 0.5, false); T.h.play(name, { fade: 0, loop: false, startTime: 0 }); }
      const tr = T.h.layers.base.current; if (tr) { tr.speed = 0; tr.time = 0.47; }
    } else T = directThrower(S, dt, main.look || { skin: 1, shirt: '#e8892a', female: false }, wantFig);
    stage.update(dt, { renderNow: false });
    // draw every view the 2D layer asked for
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    const sh = shadowsOn();
    views.forEach((v, vi) => {
      const R = v.R, s = P.debugCam ? P.debugCam.s : v.cam.s, cx = P.debugCam ? P.debugCam.cx : v.cam.cx;   // debugCam: QA close-ups only
      const full = R.w >= meta.width - 1 && R.h >= meta.height - 1;
      let x = offX + R.x * kU, y = offY + R.y * kU, ww = R.w * kU, hh = R.h * kU;
      if (!full && vi > 0) { x += 1.5; y += 1.5; ww -= 3; hh -= 3; }
      renderer.setViewport(x, ch - y - hh, ww, hh);
      renderer.setScissor(x, ch - y - hh, ww, hh);
      renderer.setScissorTest(true);
      renderer.clear(true, true, true);
      setProjection(R, s, cx);
      world.layoutView({ s, cx, R });
      // objects too small to read at this zoom are drawn a little larger (the same idea as the 2D art)
      world.syncPins(w, clamp(40 / (PIN_LEN * s), 1, 2.4), !sh);
      world.stake.scale.setScalar(clamp(28 / (STAKE_H * s), 1, 1.9));
      T.h.root.scale.setScalar(ICON ? 1 : clamp(66 / (1.75 * s), 1, 1.7));
      T.h.root.visible = !v.noFigure && wantFig;
      const near = world.far, f = near ? near.f : 1;
      for (const c of crowd) {
        const sp = c.spec, xx = typeof sp.x === 'number' ? sp.x : w.D + Number(sp.x.slice(1));
        const z = -Math.min(sp.d * f, (near ? near.yHor : 12) - 0.5);
        c.h.setPosition(xx, 0, z);
        const aimX = xx < w.D * 0.5 ? 4 : w.D;
        c.h.setFacing(Math.atan2((aimX - xx) * 0.5, -z * 2));
        c.h.root.scale.setScalar(Math.max(0.5, f));
        c.h.root.visible = !v.noFigure && !ICON;
      }
      world.tent.visible = !v.noFigure;
      if (sh) {
        const half = Math.max(4, R.w / (2 * s) * 1.1 + 1.5), sc = key.shadow.camera;
        sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 60;
        sc.updateProjectionMatrix();
      }
      stage.setShadowTarget(cx, 0, 0);
      renderer.render(stage.scene, cam);
    });
    renderer.setScissorTest(false);
    stage.stats.renders++;
    perfTick(now);
  }
  P.frame = frame;
  P.throwers = throwers;
  P.crowd = crowd;

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; GL.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  // the 2D layer renders first (collecting the views it wants), then this layer draws them
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { GL.views.length = 0; r(ctx, view); if (ICON) ctx.clearRect(0, 0, 1e5, 1e5); frame(); };
    return game;
  };
  return P;
}
