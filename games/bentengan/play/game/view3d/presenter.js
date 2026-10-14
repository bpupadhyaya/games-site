// 3D presenter for Bentengan. It only READS game.getState() (the round, the demo round on the title) and draws the village field and the
// eight players behind the transparent kit canvas. The kit canvas keeps the HUD, menus and input; this layer hands it the camera projection
// (view.gl) so rings, numbers and taps use the right pixels. Without WebGL2 (or with ?nogl) createPresenter resolves with no stage and the
// game keeps its 2D art; if the assets are slow the 2D art plays and the 3D layer takes over the moment it is ready.
import { layoutFor, CW, CH } from '../src/layout.js';
import { POLE, JAIL } from '../src/engine.js';
import { buildField, S, wx, wz, cx, cz, TEAM_COL } from './scene.js';
import { Figure } from './figure.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

const FIG_SCALE = 1.55;   // players are drawn a little larger than life so they read on a phone-sized field
// who is who: two teams of four, each a different build and look (all real skeletons, kit in the team colour)
const LOOKS = {
  H: [{ c: 'athlete_f', skin: 'tan', hair: 'black', s: 0.98 }, { c: 'athlete_m', skin: 'brown', hair: 'black', s: 1.0 }, { c: 'athlete_f', skin: 'light', hair: 'brown', s: 0.96 }, { c: 'athlete_m', skin: 'tan', hair: 'brown', s: 1.03 }],
  C: [{ c: 'athlete_m', skin: 'tan', hair: 'black', s: 1.0 }, { c: 'athlete_f', skin: 'deep', hair: 'black', s: 0.97 }, { c: 'athlete_m', skin: 'light', hair: 'ginger', s: 1.02 }, { c: 'athlete_f', skin: 'brown', hair: 'black', s: 0.99 }],
};

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false), gl: { on: false } };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 17, preserveDrawingBuffer: /[?&]shot=/.test(globalThis.location.search) }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.camera.near = 1; stage.camera.far = 220; stage.camera.fov = 24; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 1.0, hemi: 1.0, keyI: 2.7, sky: 0x7fb6e8, fog: 0xd5eaf3 });
  stage._shadowOffset = V(4, 11, 7);
  const world = buildField(stage, THREE, { quality });   // sets its own sky and fog
  const blobs = quality === 'low' && stage.enableBlobShadows ? stage.enableBlobShadows(10, { radius: 0.45, opacity: 0.8 }) : null;

  const P = { stage, THREE, figs: { H: [], C: [] }, ready: false, lost: false, licenses: '', gl: { on: false, ready: false } };
  stage.onContextLost(() => { P.lost = true; P.gl.on = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); });

  // ---- the eight players
  async function build() {
    for (const team of ['H', 'C']) {
      const T = TEAM_COL[team];
      const hs = await Promise.all(LOOKS[team].map((lk) => loadHuman({ character: lk.c, scale: lk.s * FIG_SCALE, kit: { top: T.main, bottoms: T.short, socks: '#f2f2f2' }, skin: lk.skin, hair: lk.hair })));
      hs.forEach((h, k) => {
        stage.add(h);
        const f = new Figure(h, (team === 'H' ? 0 : 4) + k, LOOKS[team][k].s * FIG_SCALE);
        h.model.visible = false;
        if (quality === 'low') h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
        P.figs[team].push(f);
      });
    }
    P.ready = true; P.gl.ready = true; stage.invalidate();
  }
  // ---- spectators: children and villagers behind the fence, who clap and cheer at tags, rescues and the pole touch
  const SPEC = [
    [-6.2, -12.0, 0.78, 'athlete_f', '#e8d56a', 'tan', 'black'], [-2.6, -12.4, 0.95, 'athlete_m', '#8a63c9', 'brown', 'black'], [1.3, -12.1, 0.74, 'athlete_f', '#e0b84a', 'light', 'brown'], [5.2, -12.3, 0.9, 'athlete_m', '#e08a3a', 'tan', 'black'],
    [-7.6, 12.2, 0.76, 'athlete_m', '#9c5a3a', 'deep', 'black'], [6.8, 12.3, 0.92, 'athlete_f', '#efe6d0', 'tan', 'black'],
    [-11.9, -4.0, 0.82, 'athlete_f', '#6a9a4a', 'light', 'ginger'], [-11.7, 3.2, 0.74, 'athlete_m', '#d8b43c', 'brown', 'black'], [11.9, -1.0, 0.88, 'athlete_m', '#4aa86a', 'tan', 'brown'], [11.8, 5.6, 0.75, 'athlete_f', '#c8a0d8', 'brown', 'black'],
  ];
  P.spec = [];
  async function buildSpectators() {
    const hs = await Promise.all(SPEC.map((q) => loadHuman({ character: q[3], scale: q[2], lod: 2, kit: { top: q[4], bottoms: '#3a4a6a', socks: '#f2f2f2' }, skin: q[5], hair: q[6] })));
    hs.forEach((h, i) => {
      const q = SPEC[i];
      h.groundClamp = 'auto'; h.footPlanting = false; h.setPosition(q[0], 0, q[1]); h.setFacing(Math.atan2(-q[0], -q[1]));
      h.play(i % 2 ? 'idle_relaxed' : 'idle', { fade: 0, startTime: i * 0.37 });
      stage.add(h);
      P.spec.push({ h, mode: 'idle', until: 0, ph: i * 1.3 });
    });
    stage.invalidate();
  }
  P.ready_p = build().then(() => { buildSpectators().catch((e) => console.warn('spectators', e)); return true; }).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- ground markers (in 3D so the figures stand in front of the parts of a ring that are behind them)
  const ringGeo = new THREE.RingGeometry(0.86, 1, 56), discGeo = new THREE.CircleGeometry(1, 40);
  const mkMark = (geo) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 4; stage.add(m); return m;
  };
  const rings = [], discs = [];
  for (let i = 0; i < 9; i++) rings.push(mkMark(ringGeo));
  for (let i = 0; i < 2; i++) discs.push(mkMark(discGeo));

  // ---- adaptive quality
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 24 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false;
        else if (perfLevel === 2) stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        else stage.renderer.setPixelRatio(1);
        stage.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- camera: the whole field (a footprint of 720 x 960 court units) fitted into the band the 2D layout reserves for it ----------------
  const map = { k: 1, left: 0, top: 0, cw: 1, ch: 1 };
  const proj = V(), ray = V(), ray2 = V();
  const FOOT = [[34, 56], [686, 56], [686, 920], [34, 920]].map(([X, Y]) => V(wx(X), 0, wz(Y))).concat([V(wx(34), 1.9, wz(56)), V(wx(686), 1.9, wz(56))]);
  let pitchOverride = 0, zoomOverride = 0, focusD = 9; P.focusId = -1;
  try { const q = new URLSearchParams(globalThis.location.search); if (q.has('pitch')) pitchOverride = +q.get('pitch'); if (q.has('zoom')) zoomOverride = +q.get('zoom'); if (q.has('focus')) P.focusId = +q.get('focus'); if (q.has('fd')) focusD = +q.get('fd'); } catch { /* ignore */ }
  const toPx = (v) => { proj.copy(v).project(stage.camera); return { x: (proj.x * 0.5 + 0.5) * map.cw, y: (-proj.y * 0.5 + 0.5) * map.ch }; };

  function placeCamera(region, shake) {
    const c = stage.camera, rot = region.rot;
    const bw = region.bw * map.k, bh = region.bh * map.k;
    const wantX = map.left + region.cx * map.k + (shake ? shake.x * map.k : 0), wantY = map.top + region.cy * map.k + (shake ? shake.y * map.k : 0);
    // tall bands (phones, tablets in portrait): tilt up toward top-down so the field fills the band instead of leaving empty ground above and below
    const tallDeg = !rot && region.kind !== 'title' ? clamp(Math.asin(Math.min(1, (bh / Math.max(1, bw)) * (720 / 920) * 0.82)) * 180 / Math.PI, 47, 64) : (rot ? 42 : 47);
    const pitch = (pitchOverride || tallDeg) * Math.PI / 180;
    const dirH = rot ? V(1, 0, 0) : V(0, 0, 1);   // from the target toward the camera, on the ground
    c.fov = 30; c.aspect = map.cw / map.ch; c.clearViewOffset(); c.updateProjectionMatrix();
    let d = 60;
    const place = () => {
      const pos = V().copy(dirH).multiplyScalar(d * Math.cos(pitch)); pos.y = d * Math.sin(pitch);
      c.position.copy(pos); c.lookAt(0, 0, 0); c.near = Math.max(1, d * 0.3); c.far = d + 200; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    };
    const bbox = () => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const v of FOOT) { const p = toPx(v); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      return { x0, x1, y0, y1 };
    };
    for (let i = 0; i < 5; i++) {
      place(); const b = bbox();
      const r = Math.max((b.x1 - b.x0) / bw, (b.y1 - b.y0) / bh);
      d = clamp(d * r / (zoomOverride || 1), 8, 140);
    }
    place(); const b = bbox();
    if (stage.scene.fog) { stage.scene.fog.near = d * 1.15; stage.scene.fog.far = d * 3.4; }
    // slide the picture so the footprint is centred in the band
    c.setViewOffset(map.cw, map.ch, (b.x0 + b.x1) / 2 - wantX, (b.y0 + b.y1) / 2 - wantY, map.cw, map.ch); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  }

  // ---- per-frame
  let lastT = null, lastW = null, lastNow = 0, cheerUntil = 0, wasRes = false, settle = false;
  const figOf = (p) => P.figs[p.team][p.k];
  function frame(game, view, nowOverride) {
    const gl = P.gl;
    if (!P.ready || P.lost) { gl.on = false; return; }
    const G = game.getState(), sc = G.scene;
    const W = view?.width ?? kitCanvas.width, H = view?.height ?? kitCanvas.height;
    let w = null, region = null;
    if (sc === 'title' && G.demo && G.demo.w) {
      const T = layoutFor(W, H, G.left).title(false);
      w = G.demo.w; region = { cx: T.hero.cx, cy: T.hero.cy, bw: CW * T.hero.sc, bh: CH * T.hero.sc, rot: false, kind: 'title' };
    } else if ((sc === 'play' || sc === 'auto') && G.w) {
      const Pl = layoutFor(W, H, G.left).play(sc);
      const A = Pl.area; w = G.w; region = { cx: A.x + A.w / 2, cy: A.y + A.h / 2, bw: A.w, bh: A.h, rot: Pl.rot, kind: sc };
    }
    if (!w || !region) { gl.on = false; stage.setVisible(false); return; }
    const now = nowOverride ?? globalThis.performance.now();
    lastNow = now;
    const rect = kitCanvas.getBoundingClientRect();
    const cw = canvas.clientWidth || globalThis.innerWidth || 720, ch = canvas.clientHeight || globalThis.innerHeight || 1280;
    if (cw !== map.cw || ch !== map.ch) { map.cw = cw; map.ch = ch; stage.resize(); }
    map.k = rect.width / (W || 720); map.left = rect.left; map.top = rect.top;
    stage.setVisible(true);

    // animation clock: the game's clock, frozen with the game (pause, menu) but running through the intro and the result cards
    let dt = lastT === null || w !== lastW ? 0 : (G.t - lastT);
    if ((sc === 'auto' && G.auto && G.auto.paused) || G.menu) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1); lastT = G.t;
    if (w !== lastW) { lastW = w; settle = true; for (const t of ['H', 'C']) for (const f of P.figs[t]) { f.yaw = null; f.yawCur = null; f.disp = null; f._lastYaw = undefined; f.gait = null; f.act = null; f.prevSt = 'fort'; f.reach = 0; } }

    placeCamera(region, G.shake);
    if (P.focusId >= 0 && w.players[P.focusId]) {   // dev: a close look at one player (?focus=<id>&fd=<metres>&pitch=<deg>)
      const q = w.players[P.focusId], c = stage.camera, pt = (pitchOverride || 22) * Math.PI / 180;
      c.clearViewOffset(); c.near = 0.3; c.far = 300; c.position.set(wx(q.x) + focusD * 0.35, 1.0 + focusD * Math.sin(pt), wz(q.y) + focusD * Math.cos(pt)); c.lookAt(wx(q.x), 0.9, wz(q.y)); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    }
    stage.setShadowTarget(0, 0, 0);
    world.update(G.t);

    // ---- figures
    const live = w.players, res = w.result;
    const poleOf = (team) => POLE[team === 'H' ? 'C' : 'H'];
    let bi = 0;
    for (const p of live) {
      const f = figOf(p); if (!f) continue;
      let near = null, nd = 420;   // nearest rival in the open: where the eyes and the stance point
      for (const e of live) if (e.team !== p.team && e.st === 'out') { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < nd) { nd = d; near = e; } }
      let touch = null;            // what the reaching arm is aimed at, if anything
      if (p.st === 'out' && p.goal) {
        const g = p.goal;
        if (g.kind === 'chase') { const e = live[g.id]; if (e && Math.hypot(e.x - p.x, e.y - p.y) < 62) touch = { x: wx(e.x), z: wz(e.y) }; }
        else if (g.kind === 'jail') { const j = JAIL[p.team]; if (Math.hypot(j.x - p.x, j.y - p.y) < 86) touch = { x: wx(j.x), z: wz(j.y) }; }
        else if (g.kind === 'pole') { const q = poleOf(p.team); if (Math.hypot(q.x - p.x, q.y - p.y) < 80) touch = { x: wx(q.x), z: wz(q.y) }; }
      }
      for (const v of live) if (v.st === 'jail' && v.hold > 0 && v.tagBy === p.id) touch = { x: wx(v.x), z: wz(v.y) };
      const q = poleOf(p.team);
      f.h.model.visible = true;
      const env = { dt, near, touch, result: res, winner: res ? res.winner : null, jailGate: p.team === 'H' ? -1 : 1, poleX: wx(q.x), poleZ: wz(q.y) };
      if (settle) {   // a new round or a still frame: let the blends and the stride settle before the first picture
        for (let i = 0; i < 16; i++) { f.step(p, { ...env, dt: 1 / 30 }); f.h.update(1 / 30); }
      } else { f.step(p, env); f.h.update(dt); }
      if (blobs) blobs.set(bi++, f.pos.x, f.pos.z, 0.42, 0.012);
    }
    if (blobs) blobs.mesh.count = bi;
    settle = false;

    // ---- the crowd: a cheer when something happens on the field, applause when a round is won
    if (G.fx && G.fx.some((f) => f.type === 'pop' && f.t < 0.12)) cheerUntil = G.t + 2.4;
    if (res && !wasRes) cheerUntil = G.t + 4.5;
    wasRes = !!res;
    for (const sp of P.spec) {
      const want = G.t < cheerUntil ? (sp.ph > 2.2 ? 'clap' : 'cheer') : ((G.t + sp.ph * 3) % 14 < 3.5 ? 'clap' : (sp.ph > 2.5 ? 'idle_relaxed' : 'idle'));
      if (sp.mode !== want) { sp.mode = want; sp.h.play(want, { fade: 0.3, loop: true }); }
      sp.h.update(dt);
    }

    // ---- ground markers: the picked player, who can tag whom, the goal, the hint
    let ri = 0, di = 0;
    const mark = (list, i, x, y, r, color, opacity) => {
      const m = list[i]; if (!m) return;
      m.visible = true; m.position.set(wx(x), 0.03, wz(y)); m.scale.set(r, r, r); m.material.color.set(color); m.material.opacity = opacity;
    };
    const sel = G.sel >= 0 && sc === 'play' ? live[G.sel] : null;
    if (sel && sel.st !== 'jail') mark(rings, ri++, sel.x, sel.y, 1.0, '#ffe678', 0.65 + 0.3 * Math.sin(G.t * 6));
    if (sel && sel.st === 'out' && G.guide) {
      for (const e of live) if (e.team !== sel.team && e.st === 'out') mark(rings, ri++, e.x, e.y, 0.8, sel.stamp > e.stamp ? '#9dff94' : '#ff6e6e', 0.9);
    }
    if (G.hint && live[G.hint.id]) {
      const hp = live[G.hint.id], g = G.hint.goal; let tg = null;
      if (g.kind === 'point') tg = { x: g.x, y: g.y }; else if (g.kind === 'home') tg = POLE[hp.team]; else if (g.kind === 'pole') tg = POLE[hp.team === 'H' ? 'C' : 'H'];
      else if (g.kind === 'jail') tg = JAIL[hp.team]; else if (g.kind === 'chase') { const e = live[g.id]; if (e) tg = { x: e.x, y: e.y }; }
      if (tg) { const a = Math.sin(G.t * 7); mark(discs, di++, tg.x, tg.y, 0.9, '#ffe678', 0.25 + 0.15 * a); mark(rings, ri++, tg.x, tg.y, 0.95, '#ffe678', 0.6 + 0.35 * a); }
    } else if (sel && sel.goal && sel.goal.kind === 'point') mark(rings, ri++, sel.goal.x, sel.goal.y, 0.5, '#ffe678', 0.9);
    for (; ri < rings.length; ri++) rings[ri].visible = false;
    for (; di < discs.length; di++) discs[di].visible = false;

    // ---- the projection handed to the HUD and to the pointer mapping (the camera is fixed for this frame)
    gl.on = true; gl.kind = region.kind; gl.region = region; gl.licenses = P.licenses;
    gl.project = (X, Y, hm = 0) => { const p = toPx(V(wx(X), hm, wz(Y))); return { x: (p.x - map.left) / map.k, y: (p.y - map.top) / map.k }; };
    gl.toCourt = (vx, vy) => {
      const nx = ((map.left + vx * map.k) / map.cw) * 2 - 1, ny = -(((map.top + vy * map.k) / map.ch) * 2 - 1);
      ray.set(nx, ny, -1).unproject(stage.camera); ray2.set(nx, ny, 1).unproject(stage.camera);
      const t = ray.y / (ray.y - ray2.y);
      return { x: cx(ray.x + (ray2.x - ray.x) * t), y: cz(ray.z + (ray2.z - ray.z) * t) };
    };
    gl.scaleAt = (X, Y) => { const a = gl.project(X, Y), b = gl.project(X + 40, Y); return Math.hypot(b.x - a.x, b.y - a.y) / 40; };   // virtual px per court unit
    if (!P.noRender) { stage.update(0, { renderNow: false }); stage.render(); perfTick(now); }
  }
  P.frame = frame;

  // the credits text for the About page
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; P.gl.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { frame(game, view); if (view) view.gl = P.gl; r(ctx, view); };
    return game;
  };
  return P;
}
