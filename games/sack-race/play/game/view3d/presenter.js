// 3D presenter for Sack Race. It only READS game.getState() (the race, the attract race, the effects list) and draws the village green and
// the runners behind the transparent kit canvas. The kit canvas keeps the HUD, menus and input; this layer hands it the camera projection
// (view.gl) so the words, markers and names sit on the right pixels. If WebGL2 or the assets are missing, createPresenter resolves with
// no stage and the game keeps its 2D art.
import { SACKS, LOOKS, YOU_LOOK } from '../src/art.js';
import { meta } from '../src/layout.js';
import { ghostX } from '../src/sim.js';
import { buildScene, laneZ, LANE_W } from './scene.js';
import { RunnerRig } from './runner.js';

const LIB = '../vendor3d/index.js';
const tick = () => new Promise((r) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(() => r()) : setTimeout(r, 0)));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false), gl: null };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 5.5 }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.camera.near = 0.5; stage.camera.far = 220; stage.camera.fov = 22; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 1.0, hemi: 1.0, keyI: 2.7, sky: 0x7fb6e8, fog: 0xd5eaf3 });
  stage._shadowOffset = V(3, 10, 7);
  stage.scene.fog = null;                         // the scene sets its own fog and background
  await tick();
  const world = buildScene(stage, THREE, { quality, createCrowd3d: V3.createCrowd3d });
  await tick();
  world.prepare();
  await tick();
  const blobs = quality === 'low' && stage.enableBlobShadows ? stage.enableBlobShadows(6, { radius: 0.42, opacity: 0.8 }) : null;

  const P = { stage, THREE, rigs: [], ready: false, lost: false, licenses: '', gl: { on: false, ready: false } };
  stage.onContextLost(() => { P.lost = true; P.gl.on = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); });

  // ---- the five bodies: you, three rivals, the ghost ---------------------------------------------------------------------------------------------
  const SLOT = [
    { character: 'athlete_f', scale: 0.97 }, { character: 'athlete_m', scale: 0.98 }, { character: 'athlete_f', scale: 0.95 },
    { character: 'athlete_m', scale: 1.0 }, { character: 'athlete_m', scale: 0.98, ghost: true },
  ];
  async function build() {
    const humans = [];
    for (const s of SLOT) { humans.push(await loadHuman({ character: s.character, scale: s.scale, kit: { top: '#e23a62', bottoms: '#2d3a55', socks: '#f2f2f2' }, skin: 'tan', hair: 'black' })); await tick(); }
    humans.forEach((h, i) => {
      h.groundClamp = 'off'; h.footPlanting = false;
      h.play('ready_stance', { fade: 0 });
      const rig = new RunnerRig(h, SLOT[i].scale, SACKS[0], i);
      rig.ghost = !!SLOT[i].ghost; rig.key = '';
      stage.add(h); stage.add(rig.sack.group);
      if (quality === 'low') { h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; }); rig.sack.group.traverse((o) => { o.castShadow = false; }); }
      if (rig.ghost) {
        const ghostify = (o) => { if (o.material) for (const m of [].concat(o.material)) { m.transparent = true; m.opacity = 0.42; m.depthWrite = false; } };
        h.model.traverse(ghostify); rig.sack.group.traverse(ghostify);
        rig.sack.group.traverse((o) => { o.castShadow = false; }); h.model.traverse((o) => { o.castShadow = false; });
      }
      P.rigs.push(rig);
    });
    // compile every shader program before the first 3D frame so the crossfade has no hitch
    try { if (stage.renderer.compileAsync) await stage.renderer.compileAsync(stage.scene, stage.camera); } catch { /* ignore */ }
    for (const rg of P.rigs) rg.h.model.visible = rg.sack.group.visible = false;
    P.ready = true; P.gl.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- effects: pooled sprites for the game's particle list ------------------------------------------------------------------------------------
  const mkTex = (draw, w = 64, h = 64) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const softTex = mkTex((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.55, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const dotTex = mkTex((g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); g.fill(); });
  const ringTex = mkTex((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.42, h * 0.42, 0, 0, Math.PI * 2); g.stroke(); });
  const rectTex = mkTex((g, w, h) => { g.fillStyle = '#fff'; g.fillRect(w * 0.1, h * 0.3, w * 0.8, h * 0.4); });
  const fxPool = [];
  for (let i = 0; i < 150; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false })); s.visible = false; s.renderOrder = 6; stage.add(s); fxPool.push(s); }
  const col = new THREE.Color();

  // ---- adaptive quality --------------------------------------------------------------------------------------------------------------------------
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

  // ---- camera: reproduces the 2D framing (same metres across the field, same place for the runner on the screen) -------------------------------
  const cam = { key: '', pos: V(), look: V(), init: false };
  const tmp = V();
  const proj = V();
  const map = { k: 1, left: 0, top: 0 };
  const toVirt = (v) => { proj.copy(v).project(stage.camera); const cx = (proj.x * 0.5 + 0.5) * P.cw, cy = (-proj.y * 0.5 + 0.5) * P.ch; return { x: (cx - map.left) / map.k, y: (cy - map.top) / map.k, z: proj.z }; };
  let zMid = 0;
  try { const q = new URLSearchParams(globalThis.location.search); if (q.has('zoom')) P.zoom = +q.get('zoom') || 1; if (q.has('pitch')) P.pitchOverride = +q.get('pitch'); } catch { /* ignore */ }
  const CAM = { pitchP: 19, pitchL: 18, vfovP: 22, vfovL: 20, fxP: 0.36, fyP: 0.74, fxL: 0.30, fyL: 0.72 };
  P.CAM = CAM;

  function placeCamera(band, camX, n, dt) {
    const land = band.w > band.h * 1.05;
    const sPx = clamp(Math.min(band.w / (land ? 7.0 : 5.6), band.h / (land ? 4.0 : 5.0)), 26, 220);       // virtual px per metre (as in the 2D art)
    const wm = band.w / sPx / (P.zoom || (land ? 1.35 : 1.45));                                                                             // metres across the band
    const c = stage.camera;
    const aspect = band.w / band.h, vfov = (land ? CAM.vfovL : CAM.vfovP) * Math.PI / 180;
    const hfov2 = Math.atan(Math.tan(vfov / 2) * aspect);
    const d = (wm / 2) / Math.tan(hfov2);
    const pitch = (P.pitchOverride || (land ? CAM.pitchL : CAM.pitchP)) * Math.PI / 180;
    zMid = (laneZ(0, n) + laneZ(n - 1, n)) / 2;
    const target = V(camX, 0.0, laneZ(n - 1, n));
    const dir = V(0, Math.sin(pitch), Math.cos(pitch));
    c.fov = vfov * 180 / Math.PI; c.near = Math.max(0.5, d * 0.4); c.far = d + 170;
    const want = target.clone().addScaledVector(dir, d);
    const key = `${n}|${land ? 'L' : 'P'}|${band.w.toFixed(0)}x${band.h.toFixed(0)}|${P.cw}x${P.ch}`;
    if (!cam.init || key !== cam.key) { cam.pos.copy(want); cam.look.copy(target); cam.init = true; cam.key = key; }
    else { const kk = 1 - Math.exp(-dt * 14); cam.pos.lerp(want, kk); cam.look.lerp(target, kk); }
    c.position.copy(cam.pos); c.lookAt(cam.look); c.updateMatrixWorld(true);
    // shift so the point (camX, 0, zMid) lands where the 2D art puts the runner's ground line
    const fx = land ? CAM.fxL : CAM.fxP, fy = land ? CAM.fyL : CAM.fyP;
    const wantPx = { x: map.left + (band.x + band.w * fx) * map.k, y: map.top + (band.y + band.h * fy) * map.k };
    const fw = band.w * map.k, fh = band.h * map.k;
    c.clearViewOffset(); c.aspect = fw / fh; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    tmp.set(cam.look.x, 0, laneZ(n - 1, n)).project(c);
    const fullX = (tmp.x * 0.5 + 0.5) * fw, fullY = (-tmp.y * 0.5 + 0.5) * fh;
    c.setViewOffset(fw, fh, fullX - wantPx.x, fullY - wantPx.y, P.cw, P.ch);
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  }

  // ---- per-frame ------------------------------------------------------------------------------------------------------------------------------------
  const seen = new Map(); let reactRace = null;
  let lastT = null, lastRace = null, lastNow = 0, gl_laneMap = [];
  const lookOf = (id, race) => LOOKS[(id * 3 + (race.seed & 7)) % LOOKS.length];
  function sackFor(id, selSack) {
    const a = (id * 2 + 1) % SACKS.length;
    return SACKS[a === selSack ? (id * 2 + 2) % SACKS.length : a];
  }
  function dress(rig, lk, sack, key) {
    if (rig.key === key) return;
    rig.key = key;
    const h = rig.h;
    h.setKit({ top: lk.shirt, bottoms: '#2d3a55', socks: '#f2f2f2' });
    h.setSkin(lk.skin); h.setHair(lk.hair);
    rig.sack.setStyle(sack);
  }
  function ghostRacer(gx) {
    const u = ((gx / 1.2) % 1 + 1) % 1, hops = Math.floor(gx / 1.2);
    return u < 0.88 ? { id: 9, x: gx, v: 3, th: 0.16, om: 0, phase: 'air', pt: (u / 0.88) * 0.36, hops, finishT: null, fwdFall: true }
      : { id: 9, x: gx, v: 3, th: 0.12, om: 0, phase: 'ground', pt: (u - 0.88) * 0.8, hops, finishT: null, fwdFall: true };
  }

  function frame(game, view, nowOverride) {
    if (!P.ready || P.lost) { P.gl.on = false; return; }
    const G = game.getState();
    const playing = G.scene === 'play' && G.race;
    const race = playing ? G.race : G.att;
    if (!race) { P.gl.on = false; stage.setVisible(false); return; }
    const now = nowOverride ?? globalThis.performance.now();
    const realDt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    const rect = kitCanvas.getBoundingClientRect();
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    map.k = cw / meta.width; map.left = rect.left; map.top = rect.top;
    stage.setVisible(true);
    // the animation clock is the game's clock: it stops with the game
    let dt = lastT === null || race !== lastRace ? 0 : (G.t - lastT);
    if (playing && G.paused) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1); lastT = G.t;
    if (race !== lastRace) { lastRace = race; for (const rg of P.rigs) { rg.s.init = false; rg.s.fall = null; rg.key = ''; } cam.init = false; }
    const ghost = !!(playing && G.ghost && race.mode === 'clock');
    const off = ghost ? 1 : 0, n = race.racers.length + off;
    const band = (playing ? G.glBandPlay : G.glBandAtt) || { x: 0, y: 0, w: meta.width, h: meta.height };
    let camX = playing ? G.camX : G.attCam;
    camX -= 1.0;   // the 2D art keeps the leader about a metre behind the anchor; the 3D framing puts the runner on it
    if (P.zoom) camX = race.racers[race.you].x - 0.1;   // dev: close-up on the runner
    world.setRace(race, n);
    placeCamera(band, camX, n, realDt);
    stage.setShadowTarget(camX + 1.5, 0, zMid);

    // ---- runners
    const you = race.racers[race.you];
    const others = race.racers.filter((r) => r !== you).sort((a, b) => a.lane - b.lane);
    // the player always runs in the nearest lane (all lanes are identical), so no rival ever stands in front of the figure you are watching
    const laneMap = [];
    if (ghost) laneMap[0] = 0;
    others.forEach((r, i) => { laneMap[r.lane + off] = off + i; });
    if (you) laneMap[you.lane + off] = n - 1;
    gl_laneMap = laneMap;
    const used = new Set(), rigOf = new Map();
    const place = (rig, r, lane, lk, sack, key) => {
      used.add(rig); rigOf.set(r, rig);
      dress(rig, lk, sack, key);
      rig.h.model.visible = rig.sack.group.visible = true;
      rig.step(r, { dt, z: laneZ(lane, n), go: race.go, count: race.count, lookX: r.x + 4 });
    };
    if (you) place(P.rigs[0], you, laneMap[you.lane + off], YOU_LOOK, SACKS[G.record.sackSel || 0], `${race.seed}y`);
    others.forEach((r, i) => place(P.rigs[1 + i], r, laneMap[r.lane + off], lookOf(r.id, race), sackFor(r.id, G.record.sackSel), `${race.seed}r${r.id}`));
    if (ghost) {
      const gx = ghostX(G.ghost, Math.max(0, race.t)) ?? 0, rg = P.rigs[4];
      const gr = ghostRacer(gx);
      used.add(rg); dress(rg, YOU_LOOK, SACKS[G.record.sackSel || 0], 'ghost');
      rg.h.model.visible = rg.sack.group.visible = true;
      rg.step(gr, { dt, z: laneZ(0, n), go: true, count: 0, lookX: gx + 4 });
      rigOf.set({ id: 'ghost' }, rg);
    }
    for (const rg of P.rigs) if (!used.has(rg)) rg.h.model.visible = rg.sack.group.visible = false;
    if (blobs) { let bi = 0; for (const rg of P.rigs) if (used.has(rg)) blobs.set(bi++, rg.feet.x, rg.feet.z, 0.4, 0.012); blobs.mesh.count = bi; }

    // ---- scenery
    // the crowd reacts: a gasp at every fall, a cheer for each finisher
    if (race !== reactRace) { reactRace = race; seen.clear(); }
    for (const r of race.racers) {
      const pv = seen.get(r.id) || { ph: r.phase, fin: r.finishT != null };
      if (r.phase === 'down' && pv.ph !== 'down') world.react(r === you ? 'groan' : 'gasp', r.x, 8);
      if (r.finishT != null && !pv.fin) world.react(r === you ? 'ovation' : 'cheer', r.x, 14);
      seen.set(r.id, { ph: r.phase, fin: r.finishT != null });
    }
    world.updateCrowd(G.t, race.racers.map((r) => r.x), camX);
    const brokeM = {}; if (playing) for (const k of Object.keys(G.broke)) brokeM[laneMap[+k] ?? +k] = G.broke[k];
    world.updateTapes(brokeM, 0, n, G.t);
    world.updateClouds(G.t);

    // ---- effects
    const list = (playing ? G.fx : G.attFx) || [];
    let si = 0;
    for (const q of list) {
      if (si >= fxPool.length) break;
      const s = fxPool[si++], k = q.t / q.max, a = Math.max(0, 1 - k), z = laneZ(clamp(laneMap[q.lane] ?? q.lane, 0, n - 1), n);
      s.visible = true; col.set(q.col || '#ffffff');
      const m = s.material; m.color.copy(col); m.opacity = a; m.rotation = 0;
      s.position.set(q.x, Math.max(0.02, q.y), z + 0.15);
      if (q.kind === 0) { m.map = softTex; m.color.set('#e9dcc0'); m.opacity = 0.62 * a; const sz = q.size * (1 + k * 1.6) * 1.6; s.scale.set(sz, sz, 1); s.position.y = Math.max(0.05, q.y) + sz * 0.3; }
      else if (q.kind === 1) { m.map = softTex; const sz = Math.max(0.05, q.size * (1.2 - 0.6 * k) * 1.4); s.scale.set(sz, sz, 1); }
      else if (q.kind === 2) { m.map = ringTex; const sz = q.size * (0.2 + k) * 2.4; s.scale.set(sz, sz, 1); s.position.y = 0.05; }
      else if (q.kind === 3 || q.kind === 4) { m.map = rectTex; m.rotation = q.rot || 0; const sz = q.size * 1.8; s.scale.set(sz, sz, 1); }
      else { m.map = dotTex; const sz = Math.max(0.03, q.size * 1.3); s.scale.set(sz, sz, 1); }
    }
    for (; si < fxPool.length; si++) fxPool[si].visible = false;

    // ---- hand the projection to the HUD
    const heads = {};
    for (const [r, rg] of rigOf) {
      const hp = rg.h.bonePosition('Head', V());
      const p = toVirt(hp.add(V(0, 0.3, 0)));
      heads[r.id] = { x: p.x, y: p.y };
    }
    const gl = P.gl;
    gl.on = true; gl.n = n; gl.off = off; gl.heads = heads; gl.camX = camX;
    gl.scale = (lane) => { const z = laneZ(clamp(laneMap[lane] ?? lane, 0, n - 1), n), a = toVirt(V(camX, 0, z)), b = toVirt(V(camX + 1, 0, z)); return Math.abs(b.x - a.x); };
    gl.project = (x, y, lane) => toVirt(V(x, y, laneZ(clamp(laneMap[lane] ?? lane, 0, n - 1), n)));
    gl.licenses = P.licenses;
    if (!P.noRender) { stage.update(0, { renderNow: false }); stage.render(); perfTick(now); }
  }
  P.frame = frame;

  // the credits text for the About page
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; P.gl.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.gl = P.gl;
      r(ctx, view);
      frame(game, view);
    };
    return game;
  };
  P.laneW = LANE_W;
  return P;
}
