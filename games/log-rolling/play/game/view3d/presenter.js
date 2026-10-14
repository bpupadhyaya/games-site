// 3D presenter for Log Rolling. It only READS game.getState() (the world being shown: the bout, or the attract bout on the menus) and draws
// the pond, the log and the two birlers behind the transparent kit canvas. The kit canvas keeps the HUD, menus and input; this layer hands
// it the camera projection (view.gl) so floating words sit on the right pixels. If WebGL2 or the assets are missing, createPresenter
// resolves with no stage and the game keeps its 2D art.
import { RIVALS } from '../src/sim.js';
import { meta } from '../src/layout.js';
import { buildScene, U, LOG_LEN } from './scene.js';
import { BirlerRig } from './birler.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const WL = 330;                                   // water line in scene units (layout.js SCENE.wl)

// who is who in 3D: body model, shirt/trim, trousers, hat (index 0 = you, 1..4 = the four rivals)
const PEOPLE = [
  { char: 'athlete_m', top: '#b3261e', trim: '#f0e6d2', pants: '#27406a', hat: 'toque', hatCol: '#f08a1a', hair: '#4a2c18', skin: 'tan' },
  { char: 'athlete_f', top: '#2f7a4a', trim: '#e8efe6', pants: '#3a3a44', hat: 'none', hair: '#6a3a1c', skin: 'light' },
  { char: 'athlete_m', top: '#2c5aa8', trim: '#e6ecf4', pants: '#5a4a34', hat: 'cap', hatCol: '#2a6a5a', hair: '#2a1a10', skin: 'tan' },
  { char: 'athlete_f', top: '#e0b324', trim: '#4a3410', pants: '#2e2e3c', hat: 'none', hair: '#1c1010', skin: 'brown' },
  { char: 'athlete_m', top: '#3a3a42', trim: '#9a2a22', pants: '#1e2230', hat: 'cap', hatCol: '#b3261e', hair: '#8a8a8a', skin: 'light' },
];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false), gl: null };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE, addCap, addWhites, createCrowd3d } = V3;
  await tick();
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 4.5 }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  await tick();
  stage.camera.fov = 20; stage.camera.near = 0.5; stage.camera.far = 260; stage.camera.updateProjectionMatrix();
  const world = buildScene(stage, THREE, { quality, createCrowd3d });
  stage._shadowOffset = V(4, 10, 8);
  const blobs = quality === 'low' && stage.enableBlobShadows ? stage.enableBlobShadows(2, { radius: 0.42, opacity: 0.8 }) : null;

  const P = { stage, THREE, rigs: [], ready: false, lost: false, licenses: '', gl: { on: false, ready: false } };
  stage.onContextLost(() => { P.lost = true; P.gl.on = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); });

  // ---- bodies: you, a male and a female rival body (the one that matches the rival is shown) ----------------------------------------------------
  const SLOT = [{ char: 'athlete_m', scale: 1.0 }, { char: 'athlete_f', scale: 1.0 }, { char: 'athlete_m', scale: 1.01 }];
  const dressed = [-1, -1, -1];
  const hats = [null, null, null];
  function putHat(slot, look) {
    if (hats[slot]) { hats[slot].remove(); hats[slot] = null; }
    const h = P.rigs[slot].h;
    if (look.hat === 'none') return;
    const hat = addCap(h, { color: new THREE.Color(look.hatCol).getHex() });
    if (look.hat === 'toque') {
      const g = hat.obj, dome = g.children[0], peak = g.children[g.children.length - 1];
      g.remove(peak);
      const R = 0.104;
      dome.geometry = new THREE.SphereGeometry(R * 1.06, 32, 18, 0, TAU, 0, Math.PI * 0.6);
      dome.scale.set(1.0, 1.08, 1.04); dome.position.y = 0.04;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.02, 10, 32), new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hatCol).multiplyScalar(0.78), roughness: 0.95 }));
      cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.006; g.add(cuff);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 1 }));
      pom.position.set(0, 0.04 + R * 1.19, 0); g.add(pom);
      for (const m of [pom, cuff]) m.castShadow = true;
    }
    hats[slot] = hat;
  }
  function dress(slot, pi) {
    if (dressed[slot] === pi) return;
    dressed[slot] = pi;
    const look = PEOPLE[pi], h = P.rigs[slot].h;
    h.setKit({ top: look.top, trim: look.trim, bottoms: look.pants, socks: '#e8e0d0', shoes: '#3a2414' });
    h.setSkin(look.skin); h.setHair(look.hair);
    putHat(slot, look);
  }
  async function build() {
    const humans = [];
    for (const s of SLOT) { humans.push(await loadHuman({ character: s.char, scale: s.scale, kit: { top: '#b3261e', bottoms: '#27406a', socks: '#e8e0d0' }, skin: 'tan', hair: 'black' })); await tick(); }
    for (let i = 0; i < humans.length; i++) {
      const h = humans[i];
      h.groundClamp = 'off'; h.footPlanting = false;
      h.play('ready_stance', { fade: 0 });
      const rig = new BirlerRig(h, SLOT[i].scale, i === 0 ? 0 : 1);
      stage.add(h);
      if (SLOT[i].char === 'athlete_m') { try { rig.trousers = addWhites(h, { color: new THREE.Color(PEOPLE[i === 0 ? 0 : 2].pants).getHex() }); } catch { /* ignore */ } }
      if (quality === 'low') h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      h.model.visible = false;
      P.rigs.push(rig);
      await tick();
    }
    try { if (stage.renderer.compileAsync) await stage.renderer.compileAsync(stage.scene, stage.camera); } catch { /* ignore */ }
    P.ready = true; P.gl.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- effects: pooled sprites for droplets, rings on the water ---------------------------------------------------------------------------------
  const mkTex = (draw, w = 64, h = 64) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const dropTex = mkTex((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(235,248,255,0.85)'); r.addColorStop(1, 'rgba(235,248,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const dropPool = [];
  for (let i = 0; i < 120; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTex, transparent: true, depthWrite: false })); s.visible = false; s.renderOrder = 6; stage.add(s); dropPool.push(s); }
  const ringTex = mkTex((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w * 0.3, 0, TAU); g.stroke(); }, 128, 128);
  const ringPool = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 5; stage.add(m); ringPool.push(m);
  }
  const parts = [], rings = [];
  let burstN = 0;
  function burst(x, z, power = 1, up = 1.0) {
    const n = Math.round(24 * power);
    for (let i = 0; i < n; i++) {
      const a = hash(burstN * 31 + i * 7) * TAU, sp = (0.5 + hash(burstN * 31 + i * 7 + 1) * 1.6) * power;
      parts.push({ x, y: 0.05, z, vx: Math.cos(a) * sp * 0.8, vy: (1.6 + hash(burstN * 31 + i * 7 + 2) * 2.2) * up * Math.min(1.2, power), vz: Math.sin(a) * sp * 0.8, t: 0, life: 0.7 + hash(burstN * 31 + i * 7 + 3) * 0.5, size: 0.08 + hash(burstN * 31 + i) * 0.1 });
    }
    for (let i = 0; i < 4 && power > 0.9; i++) parts.push({ x: x + (hash(burstN * 7 + i) - 0.5) * 0.4, y: 0.1, z: z + (hash(burstN * 7 + i + 9) - 0.5) * 0.3, vx: (hash(burstN * 7 + i + 3) - 0.5) * 0.6, vy: 1.3 + hash(burstN * 7 + i + 5) * 0.8, vz: (hash(burstN * 7 + i + 6) - 0.5) * 0.3, t: 0, life: 0.9, size: 0.5 + hash(burstN * 7 + i + 11) * 0.3, soft: true });
    rings.push({ x, z, t: 0, life: 1.1 * (0.7 + power * 0.4), size: 0.4 + power * 0.9 });
    burstN++;
  }
  function stepFx(dt) {
    for (const p of parts) { p.t += dt; p.vy -= (p.soft ? 3.5 : 9.8) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life || parts[i].y < -0.05) parts.splice(i, 1);
    for (const r of rings) r.t += dt;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].t > rings[i].life) rings.splice(i, 1);
    let si = 0;
    for (const p of parts) {
      if (si >= dropPool.length) break;
      const s = dropPool[si++]; s.visible = true; s.position.set(p.x, p.y, p.z);
      const k = p.t / p.life; s.material.opacity = Math.max(0, (p.soft ? 0.55 : 1) * (1 - k * k)); const gz = p.soft ? 1 + k * 1.2 : 1; s.scale.set(p.size * gz, p.size * gz, 1);
    }
    for (; si < dropPool.length; si++) dropPool[si].visible = false;
    let ri = 0;
    for (const r of rings) {
      if (ri >= ringPool.length) break;
      const m = ringPool[ri++], k = r.t / r.life; m.visible = true; m.position.set(r.x, 0.02, r.z);
      const s = r.size * (0.25 + k * 1.9); m.scale.set(s, s * 0.62, 1); m.material.opacity = 0.9 * (1 - k) * (1 - k);
    }
    for (; ri < ringPool.length; ri++) ringPool[ri].visible = false;
  }

  // ---- adaptive quality -----------------------------------------------------------------------------------------------------------------------------
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

  // ---- camera: the log centred in the band, the water line at the same place the 2D art puts it ---------------------------------------------
  const tmp = V(), proj = V();
  const map = { k: 1, left: 0, top: 0 };
  const toVirt = (v) => { proj.copy(v).project(stage.camera); const cx = (proj.x * 0.5 + 0.5) * P.cw, cy = (-proj.y * 0.5 + 0.5) * P.ch; return { x: (cx - map.left) / map.k, y: (cy - map.top) / map.k }; };
  try { const q = new URLSearchParams(globalThis.location.search); if (q.has('zoom')) P.zoom = +q.get('zoom') || 1; if (q.has('pitch')) P.pitchOverride = +q.get('pitch'); } catch { /* ignore */ }
  const CAM = { pitch: 9, vfov: 20, headRoom: 2.55, widthM: 4.55 };
  P.CAM = CAM;
  function placeCamera(band, camShake) {
    const portrait = band.h > band.w;
    const clearTop = band.clear ?? (portrait ? 78 : 70);                              // virtual px kept free above the heads for the balance bars
    const ppmW = (band.w / CAM.widthM) * (P.zoom || 1);
    // the water line sits as low as the picture allows so the people get the biggest size the width lets them have
    const wl = clamp((ppmW * CAM.headRoom + clearTop) / band.h, 0.55, portrait ? 0.7 : 0.76);
    const ppmH = (band.h * wl - clearTop) / CAM.headRoom;
    const ppm = clamp(Math.min(ppmW, ppmH), 30, 600);
    const c = stage.camera, aspect = band.w / band.h, vfov = CAM.vfov * Math.PI / 180;
    const hfov2 = Math.atan(Math.tan(vfov / 2) * aspect);
    const wm = band.w / ppm, d = (wm / 2) / Math.tan(hfov2);
    const pitch = (P.pitchOverride ?? CAM.pitch) * Math.PI / 180;
    const target = V(0, 1.0, 0);
    const dir = V(0, Math.sin(pitch), Math.cos(pitch));
    c.fov = CAM.vfov; c.near = Math.max(0.5, d * 0.5); c.far = d + 220;
    const want = target.clone().addScaledVector(dir, d);
    want.x += camShake.x; want.y += camShake.y;
    c.position.copy(want); c.lookAt(target.x + camShake.x * 0.5, target.y, target.z); c.updateMatrixWorld(true);
    // shift so the log centre (0, 0, 0) lands at (band centre x, water-line y)
    const wantPx = { x: map.left + (band.x + band.w * 0.5) * map.k, y: map.top + (band.y + band.h * wl) * map.k };
    const fw = band.w * map.k, fh = band.h * map.k;
    c.clearViewOffset(); c.aspect = fw / fh; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    tmp.set(0, 0, 0).project(c);
    const fullX = (tmp.x * 0.5 + 0.5) * fw, fullY = (-tmp.y * 0.5 + 0.5) * fh;
    c.setViewOffset(fw, fh, fullX - wantPx.x, fullY - wantPx.y, P.cw, P.ch);
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  }

  // ---- per frame ------------------------------------------------------------------------------------------------------------------------------------
  let wakeT = 0, overSeen = false;
  let lastT = null, lastWorld = null, lastNow = 0, logAngle = 0, lastTh = 0;
  const seenFlash = new WeakSet();
  const SURF = 0.9;                                 // metres of log surface per log unit (matches the feet cadence in birler.js)
  // One-time snapshots of the real 3D scene for the How to Play / About illustrations (so they show the same people and log as the game).
  function takeSnapshots() {
    P.gl.snaps = {};
    const specs = { log: { venue: 0, l: [0.12, -0.1], v: 0.4, th: 0.7 }, lean: { venue: 1, l: [0.72, 0], v: 0.2, th: 0.3 } };
    const cw = Math.max(320, P.cw || 720), ch = Math.max(240, P.ch || 1280);
    for (const [key, sp] of Object.entries(specs)) {
      const w = { venue: sp.venue, rival: sp.venue, l: sp.l, f: [sp.v, sp.v], ph: [0.6, 2.2], phase: 'go', fell: -1, fallT: 0, t: 5, wob: 0, lastKick: { by: -1, t: -9 }, th: sp.th, v: sp.v, bout: 1 };
      world.setVenue(w.venue);
      const rivalPi = 1 + clamp(w.rival, 0, RIVALS.length - 1), rivalSlot = PEOPLE[rivalPi].char === 'athlete_f' ? 1 : 2;
      dress(0, 0); dress(rivalSlot, rivalPi);
      P.rigs.forEach((rg, si) => { rg.h.model.visible = si === 0 || si === rivalSlot; });
      P.rigs[0].idx = 0; P.rigs[rivalSlot].idx = 1;
      const x0 = [(310 - 500) / U, (690 - 500) / U];
      for (let n = 0; n < 12; n++) { P.rigs[0].step(w, { dt: 1 / 30, t: 5 + n / 30, x0: x0[0], oppX: x0[1] }); P.rigs[rivalSlot].step(w, { dt: 1 / 30, t: 5 + n / 30, x0: x0[1], oppX: x0[0] }); }
      world.logGroup.rotation.x = sp.th * 2;
      world.update(5, w); world.updateCrowd(0, 0.3);
      const c = stage.camera; c.clearViewOffset();
      c.aspect = cw / ch; c.fov = 2 * Math.atan(Math.tan(16.5 * Math.PI / 180) / c.aspect) * 180 / Math.PI; c.near = 1; c.far = 240;
      c.position.set(0, 1.45, 9.2); c.lookAt(0, 1.25, 0); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
      stage.setShadowTarget(0, 0.4, 0);
      stage.render();
      const out = globalThis.document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
      out.getContext('2d').drawImage(canvas, 0, 0);
      P.gl.snaps[key] = out;
    }
    cam_reset = true;
  }
  let cam_reset = false;
  function frame(game) {
    if (!P.ready || P.lost) { P.gl.on = false; return; }
    if (!P.gl.snaps && P.cw) takeSnapshots();
    const G = game.getState(), band = G.glBand, w = G.glWorld;
    G.glBand = null; G.glWorld = null;
    if (!band || !w) { P.gl.on = false; stage.setVisible(false); return; }
    const now = globalThis.performance.now();
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    const rect = kitCanvas.getBoundingClientRect();
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    map.k = cw / meta.width; map.left = rect.left; map.top = rect.top;
    stage.setVisible(true);
    // the animation clock is the game's clock (it stops with the game)
    let dt = lastT === null ? 0 : (G.t - lastT);
    if (G.scene === 'play' && G.paused) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1); lastT = G.t;
    if (w !== lastWorld) { lastWorld = w; lastTh = w.th; for (const rg of P.rigs) { rg.s.prevFell = -1; rg.s.splashed = false; } parts.length = 0; rings.length = 0; }
    world.setVenue(w.venue);

    // who stands where
    const rivalPi = 1 + clamp(w.rival, 0, RIVALS.length - 1);
    const rivalSlot = PEOPLE[rivalPi].char === 'athlete_f' ? 1 : 2;
    dress(0, 0); dress(rivalSlot, rivalPi);
    P.rigs.forEach((rg, si) => { rg.h.model.visible = si === 0 || si === rivalSlot; });
    P.rigs[0].idx = 0; P.rigs[rivalSlot].idx = 1;
    const rigs = [P.rigs[0], P.rigs[rivalSlot]];
    const fx = G.fx || { flash: [], shake: 0 };
    const sh = fx.shake || 0;
    const camShake = V(Math.sin(G.t * 90) * sh * 0.03, Math.cos(G.t * 77) * sh * 0.025, 0);

    // the log: spins with the sim's angle
    const dth = w.th - lastTh; lastTh = w.th;
    logAngle += (clamp(dth, -0.5, 0.5) * SURF) / 0.31;
    world.logGroup.rotation.x = logAngle;

    placeCamera(band, camShake);
    stage.setShadowTarget(0, 0.4, 0);

    // birlers
    const x0 = [(310 - 500) / U, (690 - 500) / U];
    for (let q = 0; q < 2; q++) {
      const r = rigs[q].step(w, { dt, t: G.t, x0: x0[q], oppX: x0[1 - q] });
      if (r.splashAt) { const cr = world.crowd; if (cr) cr.react(q === 0 ? 'groan' : 'cheer', { intensity: 1 }); burst(r.splashAt.x, r.splashAt.z, 1.35, 1.0); burst(r.splashAt.x + 0.1, r.splashAt.z + 0.05, 0.7, 1.2); }
    }
    if (blobs) { blobs.set(0, x0[0], 0, 0.4, 0.012); blobs.set(1, x0[1], 0, 0.4, 0.012); blobs.mesh.count = 2; }

    // kick flashes from the game's list: a ring and a short spray at the log's waterline under the birler that is being tipped
    for (const f of fx.flash) {
      if (seenFlash.has(f)) continue; seenFlash.add(f);
      burst((f.x - 500) / U, 0.38, 0.55, 0.6);
      if (world.crowd) world.crowd.react('gasp', { intensity: 0.5, duration: 0.9 });
    }
    // wake: the spinning log pushes rings of water off both ends; faster spin, more often
    wakeT -= dt;
    const spin = Math.min(1, Math.abs(dth) / Math.max(dt, 1e-3) * 0.6);
    if (wakeT <= 0 && spin > 0.12 && dt > 0) { wakeT = 0.55 - spin * 0.3; for (const sgn of [-1, 1]) rings.push({ x: sgn * (LOG_LEN / 2 + 0.05), z: 0.02, t: 0, life: 1.5, size: 0.35 + spin * 0.45 }); }
    if (w.over && !overSeen) { overSeen = true; if (world.crowd) world.crowd.react('ovation', { intensity: 1 }); } else if (!w.over) overSeen = false;
    world.update(G.t, w);
    world.updateCrowd(dt || 0, w.phase === 'fall' || w.phase === 'over' ? 1 : 0.35 + Math.abs(w.v) * 0.5);
    stepFx(dt || 0);

    // hand the projection to the 2D HUD
    const gl = P.gl;
    if (!P.faded) {
      P.faded = true;
      // crossfade: freeze the last 2D frame behind the live HUD canvas and fade it out over the fresh 3D scene
      try {
        const o = globalThis.document.createElement('canvas'); o.width = kitCanvas.width; o.height = kitCanvas.height;
        o.getContext('2d').drawImage(kitCanvas, 0, 0);
        o.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:1;transition:opacity .45s ease-out';
        canvas.parentElement.insertBefore(o, kitCanvas);
        globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => { o.style.opacity = '0'; }));
        setTimeout(() => o.remove(), 700);
      } catch { /* ignore */ }
    }
    const p0 = toVirt(V(0, 0, 0)), p1 = toVirt(V(1, 0, 0));
    const ppm = Math.abs(p1.x - p0.x);
    gl.on = true; gl.ppm = ppm; gl.s = ppm / U;
    gl.sr = { x: p0.x - 500 * gl.s, y: p0.y - WL * gl.s, s: gl.s };
    gl.project = (xs, ys, z = 0) => toVirt(V((xs - 500) / U, (WL - ys) / U, z));
    gl.licenses = P.licenses;
    stage.update(0, { renderNow: false }); stage.render(); perfTick(now);
  }
  P.frame = frame;

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; P.gl.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view = view || {};
      view.gl = P.gl;
      r(ctx, view);
      frame(game);
    };
    return game;
  };
  return P;
}
