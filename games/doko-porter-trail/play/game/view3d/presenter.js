// 3D presenter for Doko Porter Trail. It READS the sim (game.getState()) and shows the hillside, the trail and the porter as a real lit
// 3D scene behind the transparent kit canvas (which keeps all input and draws the HUD). It never writes back to the sim.
//
// Camera: a low three-quarter "behind and beside" view that follows the porter. The camera is a function of the live screen shape
// (rotation changes it without a reload). If WebGL2 is missing or the context is lost, `mode3d.on` is false and the 2D scene in
// src/scene.js is drawn instead.
import { mode3d } from '../src/mode3d.js';
import { groundY, slopeAt, segAt } from '../src/engine.js';
import { createFigure } from './porter3d.js';
import { buildWorld } from './world.js';
import { createWalkers } from './walkers.js';
import { softTexture, clamp, lerp, hash, smooth } from './art.js';

const LIB = '../vendor3d/index.js';

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const fail = { stage: null, wrap: (g) => g, ready: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return fail; }
  const { createStage, THREE } = V3;
  const doc = globalThis.document;
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 8 });
  if (!stage.supported) { canvas.remove(); return fail; }
  stage.camera.near = 0.3; stage.camera.far = 2400; stage.camera.fov = 50; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, ready: false, lost: false, quality, stats: {} };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  let hero = null, walkers = null, trailKey = null, sizeKey = '';
  const world = buildWorld({ stage, quality });
  P.world = world;
  stage.onContextLost(() => { P.lost = true; mode3d.on = false; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.invalidate(); mode3d.on = P.ready; });

  // ---- effects: dust puffs, sweat drops, spill poofs (a small sprite pool) ----------------------------------------------------------
  const puffTex = softTexture('222,205,170', 0.9);
  const pool = [];
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; stage.add(s); pool.push({ s, v: V(), life: 0, max: 1, size: 1, grow: 1, g: 0.4 });
  }
  let poolN = 0;
  function puff(p, n, { color = '#d9c5a0', size = 0.26, up = 0.5, spread = 0.5, life = 0.8, grow = 1.8, g = 0.4 } = {}) {
    for (let i = 0; i < n; i++) {
      const e = pool[poolN++ % pool.length], a = hash(poolN * 13) * 6.28;
      e.s.material.color.set(color); e.s.position.set(p.x + Math.cos(a) * 0.05, p.y + 0.03, p.z + Math.sin(a) * 0.05);
      e.v.set(Math.cos(a) * spread * (0.4 + hash(poolN * 7)), up * (0.5 + hash(poolN * 5)), Math.sin(a) * spread * (0.4 + hash(poolN * 3)));
      e.life = e.max = life * (0.7 + hash(poolN) * 0.6); e.size = size * (0.7 + hash(poolN * 11) * 0.6); e.grow = grow; e.g = g; e.s.visible = true;
    }
  }
  function stepPool(dt) {
    for (const e of pool) {
      if (e.life <= 0) { e.s.visible = false; continue; }
      e.life -= dt; e.v.y -= e.g * dt; e.v.multiplyScalar(Math.max(0, 1 - dt * 1.6)); e.s.position.addScaledVector(e.v, dt);
      const u = clamp(e.life / e.max, 0, 1); e.s.material.opacity = u * 0.55; const sz = e.size * (1 + (1 - u) * e.grow); e.s.scale.set(sz, sz, 1);
    }
  }

  // ---- falling goods -----------------------------------------------------------------------------------------------------------------
  const fallMeshes = [];
  function stepFalls(falls) {
    const n = falls ? falls.length : 0;
    for (let i = 0; i < Math.max(n, fallMeshes.length); i++) {
      const f = falls && falls[i];
      let r = fallMeshes[i];
      if (!f) { if (r) r.g.visible = false; continue; }
      if (!r || r.kind !== f.kind) {
        if (r) stage.remove(r.g);
        const g = new THREE.Group(); if (hero) g.add(hero.makeGood(f.kind, i));
        stage.add(g); r = fallMeshes[i] = { g, kind: f.kind };
      }
      r.g.visible = true;
      r.g.position.set(f.x / 100, f.y / 100 - 0.12, 0.12);
      r.g.rotation.set(0.3, f.rot * 0.4, -f.rot);
    }
  }

  // ---- budget ------------------------------------------------------------------------------------------------------------------------
  const PIXELS = 2.2e6;
  let budgetR = 1, perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function sizeBudget(w, h) {
    const k = `${w}x${h}|${perfLevel}`;
    if (k !== sizeKey) {
      sizeKey = k; stage.resize();
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2, perfLevel ? 1.25 : 2);
      budgetR = Math.max(1, Math.min(dpr, Math.sqrt(PIXELS / Math.max(1, w * h))));
    }
    if (Math.abs(stage.renderer.getPixelRatio() - budgetR) > 0.01) { stage.renderer.setPixelRatio(budgetR); stage.invalidate(); }
  }
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) { const avg = perfSum / perfN; perfN = 0; perfSum = 0; if (avg > 26 && perfLevel < 1) { perfLevel++; sizeKey = ''; stage.invalidate(); } }
  }

  // ---- loading: the porter first (playable frame), then the people around him ---------------------------------------------------------
  P.loading = createFigure(stage, { loadKind: 'sacks', items: 5, lod: quality === 'high' ? undefined : 'auto' }).then((h) => {
    hero = h; P.hero = h; P.ready = true; mode3d.on = true; stage.invalidate();
  }).catch((e) => { console.warn('porter failed to load', e); });
  P.ambient = (async () => {
    try { await P.loading; await new Promise((r) => setTimeout(r, 400)); walkers = await createWalkers({ stage, V3, world, quality, puff }); P.walkers = walkers; } catch (e) { console.warn('ambient people unavailable', e); }
  })();

  // ---- camera director ----------------------------------------------------------------------------------------------------------------
  const cam = { pos: V(), look: V(), init: false, fov: 50 };
  let tReal = 0, lastNow = 0, lastSimT = -1, simWall = 0, prevItems = -1, prevStep = -2, prevHalt = false, snapFrames = 0, lastX = null;

  function director(focusX, focusY, aspect) {
    const ds = smooth(1.9, 0.5, aspect);                              // 0 = wide landscape, 1 = tall portrait
    const back = lerp(3.8, 3.5, ds), out = lerp(6.0, 6.9, ds), up = lerp(1.4, 2.2, ds);
    return { pos: V(focusX - back, focusY + up, out), look: V(focusX + lerp(1.4, 1.2, ds), focusY + lerp(1.1, 0.9, ds), 0), fov: lerp(32, 54, ds) };
  }

  function frame(G) {
    if (!P.ready || P.lost) { mode3d.on = false; return; }
    const nowMs = performance.now(); const dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0; lastNow = nowMs;
    tReal += dt;
    const S = G.getState(), scene = S.scene;
    stage.setVisible(true);
    const w = canvas.clientWidth || 720, hh = canvas.clientHeight || 1280, aspect = w / hh, land = aspect >= 1;
    sizeBudget(w, hh);
    const run = (scene === 'play' || scene === 'over') ? S.run : null;
    const trail = run ? run.trail : S.menu.trail;
    const key = run ? `run:${trail.name}:${trail.seed}:${run.kind}` : 'menu';
    if (key !== trailKey) {
      trailKey = key; world.setTrail(trail, trail.theme ?? 0); snapFrames = 3; prevItems = -1; prevStep = -2; lastX = null;
      if (hero) hero.st.lastX = null;
    }
    let x, f, pose;
    if (run) {
      const R = run.R, slope = slopeAt(trail, R.x), paused = run.paused || (run.kind === 'auto' && run.auto && run.auto.paused);
      if (S.t !== lastSimT) { lastSimT = S.t; simWall = nowMs; }
      x = R.x + (paused ? 0 : R.v) * clamp((nowMs - simWall) / 1000, 0, 1 / 30);   // 120 Hz displays: extrapolate between sim ticks
      f = R.t / trail.dayLen;
      pose = { x, rest: run.restS, breath: R.breath, lean: 0.1 + slope * 0.6 + R.leanS * 0.16, load: R.a, stumble: R.stumble > 0 ? R.stumble : 0, halt: R.halt > 0, slope, t: S.t, items: R.items, kind: run.loadKind, gust: R.gust ? Math.sin(Math.PI * R.gust.t / R.gust.dur) * R.gust.dir : 0 };
    } else {
      const m = S.menu;
      if (lastX !== null && m.x < lastX - 5) { snapFrames = 3; if (hero) hero.st.lastX = null; }   // the menu loop wrapped around
      x = m.x; f = m.f;
      pose = { x, rest: 0, breath: 1, lean: m.pose ? m.pose.lean : 0.12, load: m.pose ? m.pose.load : 0, stumble: 0, halt: false, slope: slopeAt(trail, x), t: S.t, items: 5, kind: 'sacks', gust: 0 };
    }
    lastX = x;
    const y = groundY(trail, x);
    if (run && hero) {
      const R = run.R;
      if (prevItems >= 0 && R.items < prevItems) { const d = hero.dokoPivot || V(x, y + 1, 0); puff(V(d.x, d.y + 0.5, d.z), 8, { color: '#e8dcc0', size: 0.22, up: 1.3, spread: 0.9, life: 0.6, grow: 1.2 }); }
      prevItems = R.items;
      if (R.step !== prevStep) { if (prevStep !== -2 && R.step >= 0 && segAt(trail, R.x).t === 'steps') puff(V(x + 0.2, y + 0.1, 0.2), 5, { color: '#cfc7b8', size: 0.2, up: 0.8, spread: 0.7, life: 0.55 }); prevStep = R.step; }
      const halt = R.halt > 0;
      if (halt && !prevHalt) puff(V(x, y + 1.75, 0.3), 3, { color: '#cfe8ff', size: 0.07, up: -0.6, spread: 0.2, life: 0.8, grow: 0.3, g: 3 });
      prevHalt = halt;
    }
    if (hero) {
      hero.setLoad(pose.kind, pose.items);
      hero.update(dt, { ...pose, y, z: 0, snap: snapFrames > 0 });
      for (const ev of hero.footEvents) {
        const onSteps = segAt(trail, ev.x).t === 'steps';
        puff(V(ev.x, y + 0.02, ev.z), onSteps ? 3 : 2, { color: onSteps ? '#cfc7b8' : '#d9c5a0', size: onSteps ? 0.15 : 0.12, up: 0.35, spread: 0.35, life: 0.7 });
      }
      const heavy = run ? 1 - run.R.breath : 0;
      if (heavy > 0.55 && hero.forehead && ((tReal * 3) % 1) < dt * 3) puff(V(hero.forehead.x + 0.01, hero.forehead.y - 0.02, hero.forehead.z + 0.08), 1, { color: '#dff0ff', size: 0.05, up: -0.2, spread: 0.05, life: 0.7, grow: 0.2, g: 4 });
    }
    const sway = run ? run.R.bridgeSway || 0 : 0;
    const gust = run && run.R.gust ? { amt: Math.sin(Math.PI * run.R.gust.t / run.R.gust.dur), dir: run.R.gust.dir } : { amt: 0, dir: 1 };
    const wind = 0.25 + (run && run.trail.rain ? 0.3 : 0) + gust.amt * 0.7;
    world.update(dt, { x, fy: y, t: tReal, f, sway, wind, rain: run ? run.trail.rain : false, gustAmt: gust.amt, gustDir: gust.dir });
    if (walkers) walkers.update(dt, { x, y, t: tReal, trail, arrived: !!(run && run.R.ended === 'arrived'), snap: snapFrames > 0 });
    stepPool(dt);
    stepFalls(run ? run.falls : null);

    const dr = director(x, y, aspect);
    if (P.camOverride) { const o = P.camOverride; dr.pos.set(x + o.pos[0], y + o.pos[1], o.pos[2]); dr.look.set(x + o.look[0], y + o.look[1], o.look[2]); dr.fov = o.fov || 40; snapFrames = Math.max(snapFrames, 1); }
    const kk = dt > 0 ? 1 - Math.exp(-dt / 0.28) : 0;
    if (!cam.init || snapFrames > 0) { cam.pos.copy(dr.pos); cam.look.copy(dr.look); cam.fov = dr.fov; cam.init = true; }
    else {
      cam.pos.x = dr.pos.x; cam.look.x = dr.look.x;     // the porter keeps its place on screen
      cam.pos.y += (dr.pos.y - cam.pos.y) * kk; cam.look.y += (dr.look.y - cam.look.y) * kk;
      cam.pos.z += (dr.pos.z - cam.pos.z) * kk; cam.fov += (dr.fov - cam.fov) * kk;
    }
    let shx = 0, shy = 0;
    if (run && run.shake > 0 && !(S.prefs && S.prefs.assist)) { shx = Math.sin(tReal * 71) * run.shake * 0.035; shy = Math.cos(tReal * 63) * run.shake * 0.03; }
    const c = stage.camera;
    if (Math.abs(c.fov - cam.fov) > 1e-3 || Math.abs(c.aspect - aspect) > 1e-4) { c.fov = cam.fov; c.aspect = aspect; c.updateProjectionMatrix(); }
    c.position.set(cam.pos.x + shx, cam.pos.y + shy, cam.pos.z); c.lookAt(cam.look.x + shx, cam.look.y + shy, cam.look.z);
    // lens shift: the porter sits in the left third, in the band the HUD leaves free
    c.clearViewOffset(); c.updateMatrixWorld(true);
    if (!P.camOverride) {
      const wantX = land ? -0.42 : -0.3, wantY = land ? -0.52 : -0.4;
      const p = V(x, y + 1.0, 0).project(c);
      c.setViewOffset(w, hh, -(wantX - p.x) * w / 2, (wantY - p.y) * hh / 2, w, hh);
    }
    stage.setShadowTarget(x, y, 0);
    stage.update(dt, { renderNow: false });
    stage.render(); perfTick();
    if (snapFrames > 0) snapFrames--;
    mode3d.on = true;
  }

  P.frame = frame;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      r(ctx, view);
      try { frame(game); } catch (e) { if (!P.err) { P.err = e; console.warn('3D frame failed', e); } mode3d.on = false; }
    };
    return game;
  };
  P.get = () => ({ hero, world, walkers, stage });
  return P;
}
