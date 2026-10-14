// 3D presenter for Hornussen. It only READS game.getState(): the sim (src/rules.js + src/game.js) owns every position and outcome; this
// layer draws the meadow, the Bock, the striker's whip, the twenty fielders with their boards and the puck behind the transparent kit
// canvas, and hands the 2D HUD the camera projection (view.gl) so rings, labels and the aim marker sit on the right pixels.
// No WebGL2, ?nogl, or assets slower than the boot budget: createPresenter resolves with no stage and the game keeps its improved 2D art.
import { layoutFor } from '../src/layout.js';
import { ROWS, COLS, FIELDERS, BOARD, WHIP_T, flightAt, crossing } from '../src/rules.js';
import { TEAM } from '../src/art.js';
import { puckState } from '../src/view.js';
import { buildWorld } from './world.js';
import { StrikerRig, FielderRig, makePuck, STAND, SEAT, SKINS, HAIRS } from './people.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const CAMDEV = { cp: [-8.8, 2.7, -4.6], ct: [-0.7, 1.7, -1.8], cov: 1.3 };
try { const q = new URLSearchParams(globalThis.location.search); if (q.has('cp')) CAMDEV.cp = q.get('cp').split(',').map(Number); if (q.has('ct')) CAMDEV.ct = q.get('ct').split(',').map(Number); if (q.has('cov')) CAMDEV.cov = Number(q.get('cov')); } catch { /* ignore */ }

const ICON = (() => { try { return new URLSearchParams(globalThis.location.search).has('icon'); } catch { return false; } })();

const inMatchRoleField = (S0, m) => !!(m && S0.scene === 'play' && (S0.vb != null ? S0.vb : m.bat) === 1);

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

// the title's looping demo: a short wind-up, the whip, the flight and the boards (same maths as the real game, nothing random per frame)
function demoState(t, venue) {
  const LOOP = 8.2, k = Math.floor(t / LOOP), u = t - k * LOOP;
  const h = (i) => { let x = Math.imul((k + 3) * 2654435761 + i * 40503, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
  const D = 80 + h(1) * 90, xL = (h(2) * 2 - 1) * 9, T = 2.2 + D * 0.021;
  const fl = { D, xL, cw: (h(3) - 0.5) * 2, T, H: 3 + D * 0.12 };
  const throws = [];
  for (let i = 0; i < ROWS.length; i++) {
    const c = crossing(fl, ROWS[i]); if (!c || c.y > BOARD.reach) continue;
    let best = 0, bd = 1e9; COLS.forEach((x, j) => { const d = Math.abs(x - c.x); if (d < bd) { bd = d; best = j; } });
    if (bd <= BOARD.half + BOARD.lat) throws.push({ id: i * COLS.length + best, th: Math.max(0.05, c.t - BOARD.peak + (h(4 + i) > 0.5 ? 0 : 0.55)), peak: clamp(c.y, 2.6, 11), sx: clamp(c.x - COLS[best], -BOARD.lat, BOARD.lat), who: 'ai' });
  }
  const HOLD = 1.7, S = { scene: 'title', ph: 'ready', t, setup: { venue }, m: null, fl: null, ft: 0, throws: [], stop: null, dropT: 0, hold: { tension: 0, aimX: 0, D: 100 }, swing: null, msg: '' };
  if (u < HOLD) { S.ph = 'hold'; S.hold.tension = smooth(u / HOLD) * 0.95; }
  else if (u < HOLD + WHIP_T) { S.ph = 'whip'; S.swing = { t: u - HOLD, t0: 0.95 }; }
  else if (u < LOOP - 0.3) { S.ph = 'flight'; S.fl = fl; S.ft = Math.min(u - HOLD - WHIP_T, T); S.throws = throws; S.swing = { t: 0.5, t0: 0.95 }; }
  S.rel = { t0: 0.95 };
  return S;
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false), gl: null };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, createBlobShadows, addCap, createCrowd3d, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 9 }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.camera.near = 0.4; stage.camera.far = 2600;
  stage.setLighting('day', { exposure: 1.02, hemi: 1.1, keyI: 2.6, sky: 0x9cc9ee, fog: 0xdcecf4 });
  stage._shadowOffset = V(10, 22, -12);
  stage.scene.fog = new THREE.Fog(0xdcecf4, 320, 900);
  const world = buildWorld(stage, THREE, { quality, venue: 'emmental', V3 });
  let crowd = null;
  const P = { stage, THREE, ready: false, lost: false, licenses: '', gl: { on: false, ready: false, licenses: '' }, cw: 0, ch: 0 };
  stage.onContextLost(() => { P.lost = true; P.gl.on = false; });
  stage.onContextRestored(() => { try { const sc = stage.scene, old = sc.environment; if (old) { const pm = new THREE.PMREMGenerator(stage.renderer); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); if (old.dispose) old.dispose(); } } catch { /* keep the old light */ } // the image-based light dies with the context: rebuild it
    P.lost = false; stage.resize(); stage.invalidate(); });
  const puck = makePuck(stage.scene);
  // soft contact discs under everybody (one draw call): used whenever shadow maps are off (low tier, or after the frame-time guard)
  const blobs = createBlobShadows(24, { radius: 0.62, opacity: 0.9 });
  stage.scene.add(blobs.mesh);

  // ---- the people --------------------------------------------------------------------------------------------------------------------------
  const KIT_BOTTOM = '#2b3042', KIT_SOCK = '#f1eddf';
  const SCALE_ROW = [1.75, 1.5, 1.3, 1.12, 1.0];   // distant lines are drawn a little larger so they stay readable at phone size
  let striker = null; const fielders = [];
  async function build() {
    const mk = (i, scale) => loadHuman({ character: 'athlete_m', scale, lod: 'auto', kit: { top: TEAM[1].shirt, bottoms: KIT_BOTTOM, socks: KIT_SOCK }, skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 5 + 1) % HAIRS.length] });
    const [sh, ...rest] = await Promise.all([mk(0, 1.0), ...FIELDERS.map((f, i) => mk(i + 1, SCALE_ROW[f.r]))]);
    sh.groundClamp = 'off'; sh.footPlanting = false; sh.play('ready_stance', { fade: 0 });
    // plain village-sport kit: a flat cap (the striker and the nearest line of fielders carry the extra mesh)
    try { addCap(sh, { color: 0x3a3228 }); } catch { /* ignore */ }
    striker = new StrikerRig(sh);
    stage.add(sh); stage.add(striker.rod);
    rest.forEach((h, i) => {
      h.groundClamp = 'off'; h.footPlanting = false; h.play('idle', { fade: 0 });
      if (FIELDERS[i].r === 4) { try { addCap(h, { color: 0x3a3228 }); } catch { /* ignore */ } }
      const rg = new FielderRig(h, FIELDERS[i], i, SCALE_ROW[FIELDERS[i].r]);
      stage.add(h); stage.add(rg.board);
      if (quality === 'low') h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      fielders.push(rg);
    });
    if (quality === 'low') sh.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
    stage.setAutoLOD(true);
    for (const h of [sh, ...rest]) stage.track(h);
    try {
      crowd = createCrowd3d(stage, { rows: world.crowdRows, count: quality === 'low' ? 60 : quality === 'medium' ? 120 : 190, seed: 21, culture: 'european_village', quality, kids: 0.12, props: { flag: 0.1, phone: 0.04 }, flagColors: ['#d93a2b', '#fff1d6'], cold: true });
    } catch (e) { console.warn('crowd3d unavailable', e); crowd = null; }
    try { await world.sceneryReady(); } catch (e) { console.warn('scenery failed', e); }
    P.ready = true; P.gl.ready = true; stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- adaptive quality ---------------------------------------------------------------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 26 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false;
        else if (perfLevel === 2) stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        else stage.renderer.setPixelRatio(1);
        stage.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- the camera ------------------------------------------------------------------------------------------------------------------------------
  const cam = { pos: V(), tgt: V(), fov: 40, init: false, key: '' };
  const map = { k: 1, left: 0, top: 0 };
  const _v = V(), _w = V();
  const toVirt = (x, y, z) => {
    _v.set(x, y, z).project(stage.camera);
    return { X: ((_v.x * 0.5 + 0.5) * P.cw - map.left) / map.k, Y: ((-_v.y * 0.5 + 0.5) * P.ch - map.top) / map.k, d: _v.z };
  };
  function project(x, y, z) {
    const a = toVirt(x, y, z), b = toVirt(x + 1, y, z);
    return { X: a.X, Y: a.Y, s: Math.abs(b.X - a.X) || 1, d: a.d };
  }
  function unproject(X, Y) {            // virtual px -> ground point (x, z) by casting a ray onto y = 0
    const nx = ((X * map.k + map.left) / P.cw) * 2 - 1, ny = -(((Y * map.k + map.top) / P.ch) * 2 - 1);
    _v.set(nx, ny, 0.5).unproject(stage.camera); _w.copy(stage.camera.position);
    const dy = _v.y - _w.y; if (Math.abs(dy) < 1e-6) return { x: 0, z: 0 };
    const u = -_w.y / dy;
    return { x: _w.x + (_v.x - _w.x) * u, z: _w.z + (_v.z - _w.z) * u };
  }
  const aimXAt = (px, D) => { const a = project(0, 0, D), b = project(1, 0, D); return (px - a.X) / ((b.X - a.X) || 1); };
  function blend(a, b, u) { return { pos: a.pos.clone().lerp(b.pos, u), tgt: a.tgt.clone().lerp(b.tgt, u), fov: lerp(a.fov, b.fov, u) }; }

  // camera shots. cov = metres of vertical coverage at the target distance (sets the field of view for the band)
  function shot(name, o) {
    const land = o.land, out = { pos: V(), tgt: V(), fov: 40 };
    if (name === 'strike') {
      // from the striker's right side and a little behind: the rod's whole arc is in profile, the puck leaves the Bock toward the Ries
      out.pos.set(...CAMDEV.cp); out.tgt.set(...CAMDEV.ct);
      const d = out.pos.distanceTo(out.tgt), cov = (land ? 4.6 : 7.0) * CAMDEV.cov * (o.title ? 0.82 : 1);
      out.fov = 2 * Math.atan(cov / 2 / d) * 180 / Math.PI;
    } else if (name === 'chase') {
      const p = o.puck;
      out.pos.set(clamp(p.x * 0.35, -9, 9) - 3.2, 6.0 + p.z * 0.045 + p.y * 0.12, p.z - 40);
      out.tgt.set(clamp(p.x, -16, 16) * 0.8, 1.4 + p.y * 0.45, p.z + 22);
      out.fov = land ? 24 : 34;
    } else {   // 'field': behind the last line of fielders, looking back at the Bock
      out.pos.set(0, land ? 15 : 20, 228); out.tgt.set(0, 0.5, land ? 128 : 150);
      out.fov = land ? 21 : 33;
    }
    return out;
  }

  // ---- per frame ------------------------------------------------------------------------------------------------------------------------------------
  let lastT = null, lastNow = 0, lastKey = '', cheerV = 0, lastPh = '';
  const headTmp = V();

  function frame(game, view) {
    if (!P.ready || P.lost) { P.gl.on = false; return; }
    // tracked humans are advanced (and LOD-picked) FIRST; the procedural poses below are applied after it, so nothing resets them before the draw
    stage.update(0, { renderNow: false });
    const S0 = game.getState();
    const now = globalThis.performance.now();
    const realDt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    const rect = kitCanvas.getBoundingClientRect();
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    const vw = view?.width || 720, vh = view?.height || 1280;
    map.k = cw / vw; map.left = rect.left; map.top = rect.top;
    const L = layoutFor(vw, vh);
    // what to show: the real match, or a looping demo behind the title
    const title = S0.scene === 'title';
    const S = title ? demoState(S0.t, S0.setup.venue) : S0;
    const m = S0.m;
    world.setVenue(m && !title ? m.venue : S0.setup.venue);
    world.setLaneTurned(inMatchRoleField(S0, m));
    const inMatch = !title && m && (S0.scene === 'play' || S0.scene === 'autoplay' || S0.scene === 'over' || S0.scene === 'autoplay-over');
    const batSide = inMatch ? (S0.vb != null ? S0.vb : m.bat) : 0;
    const role = inMatch && S0.scene === 'play' && batSide === 1 ? 'field' : 'bat';
    const wind = m ? m.wind : 0.9;
    // the band of the screen the picture should fill (the 2D HUD frames it)
    let band;
    if (title) {
      const T = L.title;
      band = L.land ? { x: L.U.x0, y: L.U.y0 + L.U.h * 0.06, w: T.plate.x - L.U.x0, h: L.U.h * 0.9 } : { x: L.U.x0, y: L.U.y0 + L.U.h * 0.16, w: L.U.w, h: Math.max(220, T.plate.y - (L.U.y0 + L.U.h * 0.16) + 20) };
    } else if (ICON) band = { x: 0, y: 0, w: vw, h: vh };
    else if (inMatch) band = L.play.scene;
    else band = { x: L.U.x0, y: L.U.y0, w: L.U.w, h: L.U.h };
    const land = band.w > band.h * 1.25 && !ICON;

    // ---- the time base: the sim clock (pauses with the game; identical in screenshots) ----------------------------------------------
    let dt = lastT === null ? 0 : (S.t - lastT);
    if (S0.scene === 'autoplay' && S0.ap && S0.ap.paused) dt = 0;
    lastT = S.t; dt = clamp(dt, 0, 0.1);
    const t = S.t, ph = S.ph;

    // ---- the striker --------------------------------------------------------------------------------------------------------------------
    const calm = !!(S0.prefs && S0.prefs.calm);
    let w = 0, tau = null;
    const k0 = (S.rel && S.rel.t0) || (S.hold && S.hold.tension) || 0.6;
    if (ph === 'hold' || ph === 'windup') w = S.hold ? S.hold.tension : 0;
    if (ph === 'whip') tau = S.swing ? S.swing.t : 0;
    else if (ph === 'flight' || ph === 'result') tau = WHIP_T + (S.ft || 0);
    const batTeam = title ? 0 : batSide, fieldTeam = 1 - batTeam;
    let pk = null;
    if ((ph === 'flight' || ph === 'result') && S.fl) pk = puckState(S);
    const puckPos = pk ? V(pk.x, pk.y, pk.z) : V(SEAT.x, SEAT.y, SEAT.z);
    striker.h.setKit({ top: TEAM[batTeam].shirt, bottoms: KIT_BOTTOM, socks: KIT_SOCK });
    striker.step({ w, tau, k0, tgt: pk ? puckPos : V(0, 0.75, 1.5), dt, t, rodK: ICON ? 1.9 : 1 });
    if (`${fieldTeam}` !== lastKey) { lastKey = `${fieldTeam}`; for (const f of fielders) f.h.setKit({ top: TEAM[fieldTeam].shirt, bottoms: KIT_BOTTOM, socks: KIT_SOCK }); }

    // ---- the fielders ---------------------------------------------------------------------------------------------------------------------------
    const byId = new Map(); for (const q of (S.throws || [])) if (!byId.has(q.id)) byId.set(q.id, q);
    const level = m ? m.level : 'normal', ft = S.ft || 0;
    const stopRecoil = S.stop ? Math.exp(-(S.dropT || 0) * 6) : 0;
    for (const rg of fielders) {
      const q = byId.get(rg.f.id);
      const tauF = q && (ph === 'flight' || ph === 'result') ? ft - q.th : null;
      const isStop = S.stop && S.stop.id === rg.f.id;
      rg.step({ dt, t, q, tau: tauF, level, puck: (ph === 'flight' || ph === 'result') && S.fl ? puckPos : null, recoil: isStop ? stopRecoil : 0 });
    }

    // ---- the camera ------------------------------------------------------------------------------------------------------------------------------
    const strikeCam = shot('strike', { land, title });
    const bFlight = (ph === 'flight' || ph === 'result') && S.fl;
    let want;
    if (title) want = ph === 'flight' ? blend(strikeCam, shot('chase', { land, puck: puckPos }), smooth(ft / 1.1)) : strikeCam;
    else if (!inMatch) want = strikeCam;
    else if (bFlight) {
      const tgtShot = role === 'field' ? shot('field', { land }) : shot('chase', { land, puck: puckPos });
      want = role === 'field' ? blend(strikeCam, tgtShot, smooth((ft - 0.2) / 0.8)) : blend(strikeCam, tgtShot, smooth(ft / 1.0));
    } else want = strikeCam;
    const key = `${role}|${land ? 'L' : 'P'}|${Math.round(band.w)}x${Math.round(band.h)}|${title ? 't' : inMatch ? 'm' : 'p'}`;
    if (!cam.init || key !== cam.key) { cam.pos.copy(want.pos); cam.tgt.copy(want.tgt); cam.fov = want.fov; cam.init = true; cam.key = key; }
    else {
      const far = cam.pos.distanceTo(want.pos) > 70;       // a long return from the end of the Ries is a cut, not a rush
      const kk = far ? 1 : 1 - Math.exp(-Math.max(realDt, 1 / 60) * (bFlight ? 14 : 7));
      cam.pos.lerp(want.pos, kk); cam.tgt.lerp(want.tgt, kk); cam.fov += (want.fov - cam.fov) * kk;
    }
    const c = stage.camera;
    c.position.copy(cam.pos); c.lookAt(cam.tgt);
    c.fov = cam.fov; c.aspect = Math.max(0.2, band.w / band.h);
    const bw = band.w * map.k, bh = band.h * map.k, bl = rect.left + band.x * map.k, bt = rect.top + band.y * map.k;
    c.setViewOffset(bw, bh, -bl, -bt, P.cw, P.ch);
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    stage.setShadowTarget(clamp(cam.tgt.x, -12, 12), 0, clamp(cam.tgt.z, -4, 205));

    // ---- the puck itself, its tracer and shadow ----------------------------------------------------------------------------------------------
    const flying = !!(pk && !pk.stopped && !pk.landed);
    puck.group.position.copy(puckPos);
    const dist = Math.max(3, puckPos.distanceTo(c.position));
    puck.group.scale.setScalar(1.3);   // real size (5.5 cm, 78 g); visibility comes from the halo and the tracer, never from a bigger puck
    puck.group.rotation.set(flying ? t * 9 : 0, 0, flying ? 0.35 : 0);
    puck.glow.visible = !!pk || ICON;
    puck.glow.position.copy(puckPos); puck.glow.scale.setScalar(clamp(dist * 0.03, 0.25, 9) * (flying ? 1 : ICON ? 1.4 : 0.5));
    puck.glow.material.opacity = flying ? 0.95 : ICON ? 0.85 : 0.45;
    puck.trail.forEach((s, i) => {
      if (!flying || calm) { s.visible = false; return; }
      const f = flightAt(S.fl, Math.max(0, ft - (i + 1) * 0.045));
      s.visible = true; s.position.set(f.x, f.y, f.z);
      const a = 1 - (i + 1) / (puck.trail.length + 1);
      s.material.opacity = 0.75 * a * a; s.scale.setScalar(clamp(dist * 0.024, 0.6, 7) * (0.35 + 0.65 * a));
    });
    puck.shadow.position.set(puckPos.x, 0.03, puckPos.z);
    puck.shadow.visible = !!pk;
    puck.shadow.scale.setScalar(clamp(dist * 0.004, 0.06, 1.2) * (1 + Math.min(1.5, puckPos.y * 0.04)));
    puck.shadow.material.opacity = clamp(0.5 - puckPos.y * 0.012, 0.18, 0.5);

    // ---- contact shadows when there are no shadow maps ----------------------------------------------------------------------------------
    blobs.mesh.visible = !stage.renderer.shadowMap.enabled;
    if (blobs.mesh.visible) {
      let bi = 0;
      blobs.set(bi++, striker.xz.x, striker.xz.z, 0.62, 0.012);
      for (const rg of fielders) blobs.set(bi++, rg.f.x + rg.sx, rg.f.z, 0.62 * rg.k, 0.012);
      blobs.mesh.count = bi;
    }

    // ---- scenery life ---------------------------------------------------------------------------------------------------------------------------
    if (crowd && ph !== lastPh) {
      if (ph === 'whip') crowd.react('gasp', { origin: [0, 0, 20], radius: 60 });
      if ((ph === 'result') && S.fl) { const f = S.fl; crowd.react(S.stop ? 'groan' : f.D >= 105 ? 'ovation' : 'cheer', { origin: [clamp(f.xL, -12, 12), 0, f.D], radius: 55 }); }
    }
    lastPh = ph;
    cheerV += ((ph === 'result' ? 1 : ph === 'flight' ? 0.35 : 0.1) - cheerV) * Math.min(1, realDt * 4);
    world.updateFlag(wind, t, calm);
    world.updateBells(t, cheerV, calm);
    world.updateScenery(dt, stage.camera);
    if (crowd) { crowd.setExcitement(clamp(cheerV, 0, 1)); crowd.update(calm ? 0 : dt); }
    stage.setVisible(true);

    // ---- hand the projection to the HUD ------------------------------------------------------------------------------------------------------------
    striker.h.bonePosition('Head', headTmp);
    const hp = project(headTmp.x, headTmp.y + 0.35, headTmp.z);
    const gl = P.gl;
    gl.on = true; gl.role = role; gl.project = project; gl.unproject = unproject; gl.aimX = aimXAt; gl.band = band;
    gl.strikerHead = { x: hp.X, y: hp.Y, s: hp.s };
    gl.scaleAt = (z) => project(0, 0, z).s;
    gl.fielder = (id) => { const f = FIELDERS[id], p = project(f.x, 1.1, f.z); return { X: p.X, Y: p.Y, s: p.s }; };
    gl.bock = project(SEAT.x, SEAT.y, SEAT.z);
    gl.licenses = P.licenses;
    if (!P.noRender) { stage.render(); perfTick(now); }
  }
  P.frame = frame;
  Object.defineProperty(P, 'striker', { get: () => striker }); Object.defineProperty(P, 'fielders', { get: () => fielders });

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; P.gl.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      frame(game, view);                  // first: the picture, so the HUD projects through THIS frame's camera
      view.gl = P.gl;
      if (ICON) { ctx.clearRect(0, 0, view.width, view.height); return; }   // ?icon=1: the bare picture, for the app icon art
      r(ctx, view);
    };
    return game;
  };
  return P;
}
