// The 3D presenter: reads the engine (game.getState().E: the play, the ball, the events) and draws the field and fourteen mannequins. It never writes back.
// Contact discipline: the sim owns where and when everything happens; hands are put on the ball and on opponents with setReach every frame, and every clip that has
// a moment of contact is retimed (playTimed) so that moment lands on the sim's time. The camera is fixed: one steady shot of the whole field, never moving.
import { buildField } from './field.js';
import { addFootballClips } from './clips.js';
import { buildFootball } from './gear.js';
import { createCtl, toWorld } from './actors.js';

const LIB = '../vendor3d/index.js';
const YD = 0.9144;
const BLOCK_OK = [];
for (const h of ['L hand', 'R hand', 'L forearm', 'R forearm']) for (const c of ['chest', 'chest2', 'abdomen', 'L shoulder', 'R shoulder', 'L upper arm', 'R upper arm', 'pelvis', 'L hand', 'R hand', 'L forearm', 'R forearm']) BLOCK_OK.push([h, c]);
let blockWorst = -9, blockWhy = '';
const STEP = 1 / 60;
const nowMs = () => globalThis.performance.now();
const QP = (k, d) => { try { const m = new RegExp('[?&]' + k + '=([0-9.]+)').exec(globalThis.location.search); return m ? Number(m[1]) : d; } catch { return d; } };

const frac = (n) => ((Math.imul(n | 0, 2654435761) >>> 0) / 4294967296);
const KITS = [
  { top: '#2f6fd6', bottoms: '#f4f4f4', socks: '#f4f4f4', shoes: '#f4f4f4', trim: '#d6e4ff' },
  { top: '#d8453a', bottoms: '#f4f4f4', socks: '#f4f4f4', shoes: '#f4f4f4', trim: '#ffd9d3' },
];
const SKINS = [['clay', 'peach', 'wood', 'brown', 'tan', 'deep', 'peach'], ['brown', 'wood', 'peach', 'clay', 'deep', 'tan', 'ivory']];
const HAIRS = ['black', 'black', 'brown', 'black', 'grey', 'black', 'ginger'];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality }) {
  quality = quality || pickQuality();
  const fallback = { stage: null, wrap: (g) => g, ready: () => false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return fallback; }
  const { createStage, loadHuman, THREE, createBlobShadows, resolvePenetration } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', shadowSize: 34 });
  if (!stage.supported) { canvas.remove(); return fallback; }
  const shadowMaps = quality === 'high';
  if (!shadowMaps) stage.renderer.shadowMap.enabled = false;
  let lost = false;
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; });
  stage.setLighting('day');
  stage.setSky(0x0d1a14, 0x0d1a14, { near: 70, far: 170 });
  const camera = stage.camera;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---- the field ------------------------------------------------------------------------------------------------------------------------------------
  const field = buildField(THREE);
  stage.add(field);
  const ball = buildFootball(); ball.scale.setScalar(QP('bs', 1.6)); ball.visible = false; stage.add(ball);
  // ---- the fourteen players ---------------------------------------------------------------------------------------------------------------------------
  // one instanced draw call for the fourteen soft shadows and the ball's
  const blobs = createBlobShadows(15, { radius: 0.5, opacity: 1 }); stage.scene.add(blobs.mesh); blobs.mesh.count = 15; blobs.mesh.visible = true;
  for (let i = 0; i < 15; i++) blobs.set(i, 0, -50, 0.1);
  const PSCALE = QP('ps', 1.75);
  const ents = []; let ready = false, loading = false, womenLoaded = null, warmed = false, warmMs = 0;
  async function loadAll(women) {
    if (loading) return; loading = true; ready = false;
    for (const e of ents.splice(0)) { stage.remove(e.h); }
    const char = women ? 'mannequin_f' : 'mannequin_m';
    const hs = await Promise.all(Array.from({ length: 14 }, (_, id) => loadHuman({ character: char, kit: KITS[id < 7 ? 0 : 1], skin: SKINS[id < 7 ? 0 : 1][id % 7], hair: KITS[id < 7 ? 0 : 1].top, quality: quality === 'high' ? 'high' : 'low', scale: PSCALE, silhouette: 0.55, stripes: true })));
    hs.forEach((h, id) => {
      const team = id < 7 ? 0 : 1;
      addFootballClips(h);
      h.addLayer('live', { mask: 'all', additive: true, weight: 1 }); h.addLayer('lean', { mask: 'all', additive: true, weight: 0 });
      h.groundClamp = 'auto'; h.turnRate = 0;
      stage.add(h);
      h.play('ft_stance_def', { fade: 0 }); h.play('ft_live', { layer: 'live', fade: 0, loop: true, startTime: frac(id * 7 + 3) * 2.8, speed: 0.75 + frac(id * 11 + 5) * 0.5 });
      h.root.visible = false;
      ents.push({ h, ctl: createCtl(h, id, ball), id });
    });
    womenLoaded = women; ready = true; loading = false;
    // warm-up behind the menu: compile every shader and upload every texture while the players are visible to the renderer (three skips hidden objects), then hide them again
    try {
      for (const e of ents) e.h.root.visible = true;
      camera.updateMatrixWorld(true); stage.renderer.compile?.(stage.scene, camera);
      if (!warmed) { warmed = true; const t0 = nowMs(); stage.render(); warmMs = nowMs() - t0; }
      for (const e of ents) e.h.root.visible = false;
    } catch { /* optional */ }
    stage.invalidate();
  }
  loadAll(false).catch((e) => { loading = false; console.warn('3D players failed to load; keeping the 2D field', e); });

  // ---- the fixed camera: the whole field, seen from behind the user's end, high ---------------------------------------------------------------------------------
  const CAM = { h: QP('ch', 36), back: QP('cb', 11), look: 26 * YD, fovMargin: QP('fm', 0.97) };
  let cssW = 0, cssH = 0, scaleV = 1, fitKey = '', laidOut = null;
  function layout(viewRect) {
    const r = kitCanvas.getBoundingClientRect();
    const cw = r.width || globalThis.innerWidth, ch = r.height || globalThis.innerHeight;
    if (cw !== cssW || ch !== cssH) { cssW = cw; cssH = ch; stage.resize(); fitKey = ''; }
    scaleV = Math.min(cw / 720, ch / 1280);
    const ox = (cw - 720 * scaleV) / 2, oy = (ch - 1280 * scaleV) / 2;
    canvas.style.clipPath = `inset(${Math.max(0, oy)}px ${Math.max(0, ox)}px ${Math.max(0, oy)}px ${Math.max(0, ox)}px)`;
    const top = oy + viewRect.y * scaleV, h = viewRect.h * scaleV, w = 720 * scaleV;
    laidOut = { cw, ch, top, h, w, ox, oy };
    return laidOut;
  }
  // choose the fov that just fits every field corner (and the goal posts) inside the region, then show the region inside the full canvas with a view offset
  function fitCamera(L) {
    const key = `${L.cw}x${L.ch}:${Math.round(L.top)}:${Math.round(L.h)}`;
    if (key === fitKey) return;
    fitKey = key;
    camera.clearViewOffset?.();
    camera.position.set(0, CAM.h, -CAM.back);
    camera.lookAt(0, 0, CAM.look);
    camera.updateMatrixWorld(true);
    const aspect = L.w / L.h;
    const pts = [];
    for (const x of [-14, 14]) for (const z of [0, 52]) pts.push(V(x * YD, 0, z * YD));
    let lo = 8, hi = 80, best = 60;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      camera.fov = mid; camera.aspect = aspect; camera.updateProjectionMatrix();
      let m = 0;
      for (const p of pts) { const q = p.clone().project(camera); m = Math.max(m, Math.abs(q.x), Math.abs(q.y)); }
      if (m <= CAM.fovMargin) { best = mid; hi = mid; } else lo = mid;
    }
    const fovRegion = best;
    // the region is only part of the canvas: widen the vertical fov for the full canvas and offset the view so the picture lands inside the region
    const fullFov = (2 * Math.atan(Math.tan((fovRegion * Math.PI) / 360) * (L.ch / L.h)) * 180) / Math.PI;
    camera.fov = Math.min(110, fullFov); camera.aspect = L.cw / L.ch;
    const centre = L.top + L.h / 2;
    if (camera.setViewOffset) camera.setViewOffset(L.cw, L.ch, 0, -(centre - L.ch / 2), L.cw, L.ch);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  // ---- per frame ---------------------------------------------------------------------------------------------------------------------------------------------
  let markedP = null, lastE = null, lastP = null, lastSimT = -1, wallAt = 0, animT = 0, seen = 0, shown = false;
    const proj = V();
  const F = { P: null, E: null, alpha: 1, dt: 0, simT: 0, ball: null, ctl: [] };
  const vyAt = (b) => { const f = b.fly; if (!f) return 0; return (f.y1 - f.y0) / f.T; };
  const fakePlay = (E) => ({ phase: 'result', t: E.t, actors: E.m.actors, ball: { st: 'ground', holder: -1, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }, events: [], dead: true, deadReason: '', off: E.m.poss, dir: 1, losZ: 0, kick: null, try: false });

  function frame(game, ctx) {
    const s = game.getState();
    const E = s.E;
    // the look of the players (men / women) is switched behind the menus, never at the first live frame
    { const want = !!(s.settings && s.settings.women); if (ready && want !== womenLoaded && !loading) loadAll(want).catch(() => { loading = false; }); }
    const active = s.scene === 'play' && E && ready && !lost && !s.hide3d;
    if (!active) {
      if (shown) { canvas.style.visibility = 'hidden'; shown = false; game.setView3d?.(false); }
      lastSimT = -1;
      return;
    }
    const wantWomen = !!(s.settings && s.settings.women);
    if (wantWomen !== womenLoaded && !loading) loadAll(wantWomen).catch(() => { loading = false; });
    if (!shown) { canvas.style.visibility = 'visible'; shown = true; game.setView3d?.(true); stage.invalidate(); }
    const L = layout(s.viewRect || { x: 0, y: 176, w: 720, h: 900 });
    fitCamera(L);
    const M = E.m, P = E.P;
    const acts = P ? P.actors : M.actors;
    // sub-step blending: the sim runs in fixed 1/60 s steps, the screen at 60 or 120 Hz
    const simT = E.t;
    if (simT !== lastSimT) { lastSimT = simT; wallAt = nowMs(); }
    const alpha = s.headless ? 1 : s.paused ? 1 : Math.min(1, (nowMs() - wallAt) / (STEP * 1000));
    const target = simT + (s.headless ? 0 : alpha * STEP);
    let dt = animT > 0 ? target - animT : 0;
    if (dt < 0 || dt > 0.25) dt = 0;
    animT = target;
    F.P = P || fakePlay(E); F.E = E; F.alpha = alpha; F.dt = dt; F.simT = P ? P.t : E.t; F.ctl = ents.map((e) => e.ctl);
    // a new play or a new engine: forget what the previous one left behind
    if (P !== lastP || E !== lastE) { for (const e of ents) if (!(e.ctl.st.lying)) e.ctl.reset(); seen = 0; lastP = P; lastE = E; animT = target; dt = 0; F.dt = 0; }
    if (P) { for (const ev of P.events) { if (ev.id <= seen) continue; seen = ev.id; for (const e of ents) e.ctl.on(ev, F); } }
    const b = P ? P.ball : null;
    F.ball = b ? { x: b.px + (b.x - b.px) * alpha, y: b.py + (b.y - b.py) * alpha, z: b.pz + (b.z - b.pz) * alpha } : { x: 0, y: 0.5, z: 0 };
    ents.forEach((e) => {
      const a = acts[e.id];
      e.h.root.visible = true;
      e.ctl.update(F, a);
      e.h.update(dt);
      blobs.set(e.id, e.h.root.position.x, e.h.root.position.z, 0.5 * PSCALE);
    });
    // wrapped pairs: push the tackler out until no limb passes through the carrier (a few centimetres at most)
    for (const e of ents) { const tk = e.ctl.st.tackle; if (tk && tk.role === 'tackler') { const o = ents[tk.carrier]; if (o) { resolvePenetration(o.h, e.h, { move: 'b', tolerance: 0.004, iterations: 8 }); blobs.set(e.id, e.h.root.position.x, e.h.root.position.z, 0.5 * PSCALE); } } }
    // blocking pairs: the two hands on the other's chest are meant to touch; nothing else may pass through
    if (P && P.pairs && P.pairs.length) for (const pr of P.pairs) { const A = ents[pr.a], B = ents[pr.b]; if (A && B && !A.ctl.st.lying && !B.ctl.st.lying && !A.ctl.st.tackle && !B.ctl.st.tackle) { const w = resolvePenetration(A.h, B.h, { move: 'both', tolerance: 0.004, iterations: 60, ignore: BLOCK_OK }); if (w.depth > blockWorst) { blockWorst = w.depth; blockWhy = w.a + ' / ' + w.b + ' ' + A.id + ',' + B.id + ' ' + (A.ctl.st.clip) + '/' + (B.ctl.st.clip); } } }
    // ball mesh and its shadow
    if (b && (b.st !== 'ground' || P.phase !== 'lineup')) {
      const w = toWorld(F.ball.x, F.ball.z);
      ball.visible = true; ball.position.set(w.x, F.ball.y * YD, w.z);
      if (b.st === 'air' && b.fly) { ball.rotation.set(0, Math.atan2(-(b.fly.x1 - b.fly.x0), b.fly.z1 - b.fly.z0), 0); ball.rotateZ((F.simT - b.fly.t0) * (b.fly.lob > 0.4 ? 9 : 22)); }
      else if (b.holder >= 0) { const h = ents[b.holder].h; ball.rotation.set(0, h.facing, 0); ball.rotateX(0.35); }
      blobs.set(14, w.x, w.z, F.ball.y > 0.15 ? Math.max(0.2, 0.42 - F.ball.y * 0.03) : 0.001);
    } else { ball.visible = false; blobs.set(14, 0, -50, 0.1); }
    // the line of scrimmage and the first-down line are painted on the field texture, once per play
    if (P && P !== markedP) { markedP = P; field.userData.setMarks(P.kick ? null : P.losZ, P.kick || P.try ? null : (P.dir > 0 ? (P.losZ + Math.min(P.toGo, 40) < 46 ? P.losZ + Math.min(P.toGo, 40) : null) : (P.losZ - Math.min(P.toGo, 40) > 6 ? P.losZ - Math.min(P.toGo, 40) : null))); }
    else if (!P && markedP) { markedP = null; }
    camera.updateMatrixWorld(true);
    stage.setShadowTarget(0, 0, 26 * YD);
    stage.render();
    overlay(game, ctx, acts);
  }

  // screen position of a point, in the game's virtual units (for the 2D markers and tags)
  const toScreen = (wx, wy, wz) => {
    proj.set(wx, wy, wz).project(camera);
    return { x: (((proj.x * 0.5 + 0.5) * laidOut.cw) - laidOut.ox) / scaleV, y: (((-proj.y * 0.5 + 0.5) * laidOut.ch) - laidOut.oy) / scaleV, z: proj.z };
  };
  function overlay(game, ctx, acts) {
    if (!ctx || !game.drawOverlay || !laidOut) return;
    const pos = (id) => { const e = ents[id]; if (!e) return null; const hp = e.h.bonePosition('Head', proj); return toScreen(hp.x, hp.y + 0.34, hp.z); };
    const feet = (id) => { const a = acts[id]; const w = toWorld(a.x, a.z); return toScreen(w.x, 0.02, w.z); };
    game.drawOverlay(ctx, { pos, feet, scale: (id) => { const a = feet(id), b = pos(id); return a && b ? Math.max(8, a.y - b.y) : 20; } });
  }

  return {
    blockWorst: () => [blockWorst, blockWhy], warmMs: () => warmMs, stage, ready: () => ready, ents: () => ents, frame, camera, THREE,
    screen: toScreen,
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => { r(ctx, view); try { frame(game, ctx); } catch (e) { console.warn('3D frame failed', e); } };
      return game;
    },
  };
}
