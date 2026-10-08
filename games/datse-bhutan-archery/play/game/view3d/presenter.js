// The 3D presenter: reads game.getState() (the match engine E, the scene, the layout rectangles) and draws the valley, the archers, the arrows and the sight lens.
// It never writes back. Animation advances by the sim clock difference, so it pauses with the game. The WebGL canvas sits behind the kit canvas; the sight lens
// is rendered into a corner of the same canvas and copied onto the 2D canvas inside a circle, after which the game paints the lens bezel and the reticle.
import { buildWorld, buildStreamer, groundH } from './world.js';
import { createFx } from './fx.js';
import { createArcher, poseShooter, putAway, updateRobe, makeRobe, makeSleeves, updateSleeves, followRobe, addArcheryClips, V } from './archer.js';
import { makeArrow } from './gear.js';
import { windAt, drawFrac, swayAt } from '../src/engine.js';
import { mainCam, lensCam, danceSpot, stand, fwd, rgt, V3, lerp, lerp3, smooth } from '../src/camera.js';
import { standX, standZ, boardZ, rightX } from '../src/ballistics.js';

const LIB = '../vendor3d/index.js';
const nowMs = () => globalThis.performance.now();
const QP = (k, d) => { try { const m = new RegExp('[?&]' + k + '=([-0-9.]+)').exec(globalThis.location.search); return m ? Number(m[1]) : d; } catch { return d; } };
const SKINS = ['tan', 'light', 'clay', 'wood', 'brown'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yawOfDir = (dir) => (dir > 0 ? 0 : Math.PI);
const DEFAULT_ROSTER = [['m', 'f', 'm'], ['f', 'm', 'f']];
const DEFAULT_KITS = [{ top: '#b3271f', trim: '#f2c14e' }, { top: '#1f6fb3', trim: '#f4f1e6' }];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality }) {
  quality = quality || pickQuality();
  const fallback = { stage: null, wrap: (g) => g, ready: () => false, busy: () => false };
  let V3L;
  try { V3L = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return fallback; }
  const { createStage, THREE } = V3L;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', shadowSize: 11 });
  if (!stage.supported) { canvas.remove(); return fallback; }
  if (quality !== 'high') stage.renderer.shadowMap.enabled = quality === 'medium';
  const renderer = stage.renderer, camera = stage.camera, scene = stage.scene;
  let lost = false;
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; sizeKey = ''; stage.invalidate(); });
  camera.far = 6500; camera.near = 0.25; camera.updateProjectionMatrix();
  stage.setLighting('day', { sky: 0xb7cfe6, fog: 0xb7cfe6, key: 0xfff1d6, keyI: 2.5, hemi: 0.85, rim: 0xcfe0ff, rimI: 0.9, exposure: 0.92 });
  stage.setSky(0xb7cfe6, 0xb7cfe6, { near: 450, far: 6800 });
  stage._shadowOffset.set(-7, 11, 5);
  const TIER = { high: { trees: 600, tufts: 600, grow: 1.08, clouds: 7, spectators: 16 }, medium: { trees: 340, tufts: 340, grow: 1.095, clouds: 4, spectators: 10 }, low: { trees: 150, tufts: 0, grow: 1.12, clouds: 2, spectators: 4 } }[quality] || { trees: 600, tufts: 600, grow: 1.08, clouds: 7, spectators: 16 };
  const world = buildWorld(THREE, { ...TIER }); stage.add(world.root);
  stage.setAutoLOD(true);
  const lensCamera = new THREE.PerspectiveCamera(10, 1, 3, 6500);
  const fx = createFx(THREE, stage);
  let seenEv = 0, boardWob = { b: null, t: 9 }, shake = 0;

  // ---- arrows --------------------------------------------------------------------------------------------------------------------------------------------
  const flightArrow = makeArrow(THREE, { len: 0.92 }); flightArrow.visible = false; stage.add(flightArrow);
  const stuckPool = Array.from({ length: 28 }, () => { const m = makeArrow(THREE); m.visible = false; stage.add(m); return m; });
  const glintTex = (() => { const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.7)'); gr.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glint.visible = false; stage.add(glint);
  const trail = []; const trailLine = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 40), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0.55 })); l.frustumCulled = false; l.visible = false; stage.add(l); return l; })();

  // ---- wind streamers ---------------------------------------------------------------------------------------------------------------------------------------
  const streamers = [], poleSpots = [];
  { const cols = [[0.86, 0.2, 0.15], [0.97, 0.78, 0.2], [0.95, 0.95, 0.92], [0.2, 0.5, 0.78]]; let k = 0;
    for (const z of [30, 60, 90, 120]) for (const sx of [-1, 1]) {
      const x = sx * (11 + (k % 3)); poleSpots.push([x, z]);
      const mesh = buildStreamer(THREE, cols[k % cols.length]); mesh.position.set(x, 5.15, z); stage.add(mesh);
      streamers.push({ mesh, phase: k * 1.7 }); k++;
    }
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 5.2, 5), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }), poleSpots.length), M = new THREE.Matrix4();
    poleSpots.forEach(([x, z], i) => { M.makeTranslation(x, 2.6, z); poles.setMatrixAt(i, M); }); poles.frustumCulled = false; stage.add(poles); }

  // ---- the people -------------------------------------------------------------------------------------------------------------------------------------------
  const slots = [];     // 6 archers: team * 3 + member
  const spotters = [];
  let loading = 0, ready = false, rosterKey = '';
  const makeKit = (tm) => ({ top: tm.top, bottoms: tm.top, socks: '#f4f1e6', trim: tm.trim });
  async function loadSlot(i, g, tm, look) {
    const old = slots[i];
    const a = await createArcher({ g, kit: makeKit(tm), skin: SKINS[look % SKINS.length], hair: look % 5 === 3 ? 'brown' : 'black', quality: quality === 'high' ? 'high' : 'low' });
    a.team = (i / 3) | 0; a.m = i % 3; a.g = g; a.pos = old ? old.pos.clone() : V(0, 0, -50); a.yaw = old ? old.yaw : 0; a.clip = ''; a.mode = 'idle'; a.snap = true; a.lower = 1; a.lowerT = 1;
    stage.add(a.h); stage.track(a.h); stage.add(a.bow); stage.add(a.arrow); stage.add(a.robe); stage.add(a.sleeves);
    a.h.root.visible = false; a.robe.visible = false; a.sleeves.visible = false;
    if (old) { stage.remove(old.h); stage.remove(old.bow); stage.remove(old.arrow); stage.remove(old.robe); stage.remove(old.sleeves); stage.humans.splice(stage.humans.indexOf(old.h), 1); }
    slots[i] = a;
  }
  async function loadSpotter(i) {
    const h = await V3L.loadHuman({ character: 'mannequin_m', kit: { top: i ? '#8a6a2a' : '#2f6a8c', bottoms: i ? '#8a6a2a' : '#2f6a8c', socks: '#f4f1e6' }, quality: 'low', castShadow: false, scale: 1 });
    h.groundClamp = 'auto'; stage.add(h); stage.track(h); h.play('idle_relaxed', { fade: 0 }); h.root.visible = false;
    const robe = makeRobe({ g: 'm', kit: { top: i ? '#8a6a2a' : '#2f6a8c', trim: '#f4f1e6' } }); stage.add(robe); robe.visible = false; spotters[i] = { h, clip: '', robe };
  }
  function rosterOf(E) { return E ? E.teams.map((t) => t.members.map((m) => m.g)) : DEFAULT_ROSTER; }
  function kitsOf(E) { return E ? E.teams : DEFAULT_KITS; }
  function wantRoster(E) { const r = rosterOf(E), k = kitsOf(E); return JSON.stringify([r, k.map((t) => [t.top, t.trim, t.valley])]) + (E ? E.teams.map((t) => t.members.map((m) => m.look).join('')).join('|') : ''); }
  async function applyRoster(E) {
    const key = wantRoster(E); if (key === rosterKey) return; rosterKey = key; loading++;
    try {
      const r = rosterOf(E), k = kitsOf(E);
      const jobs = [];
      for (let t = 0; t < 2; t++) for (let m = 0; m < 3; m++) {
        const i = t * 3 + m, tm = k[t] || k[0], g = (r[t] || r[0])[m], look = E && E.teams[t] ? E.teams[t].members[m].look : i + 1;
        jobs.push(loadSlot(i, g, tm, look));
      }
      await Promise.all(jobs);
      if (!spotters.length) await Promise.all([loadSpotter(0), loadSpotter(1)]);
      ready = true; stage.invalidate();
    } catch (e) { console.warn('3D people failed to load', e); } finally { loading--; }
  }
  applyRoster(null);
  // the people watching along the range: low-detail mannequins in the same robes (they cheer when a team scores near them)
  const spectators = [];
  async function loadSpectators() {
    while (!ready) await new Promise((r) => globalThis.setTimeout(r, 60));   // the archers first: the play screen must be ready quickly, the crowd follows
    const cols = ['#b3271f', '#1f6fb3', '#e0922b', '#2c8a5b', '#7a3f9e', '#26727a', '#8a2b4a', '#c8b04a'], trims = ['#f2c14e', '#f4f1e6', '#3a2a18'], skins = ['clay', 'wood', 'peach', 'ivory'];
    const spots = [];
    for (const z0 of [0, 145]) { const back = z0 ? 1 : -1; [[-13, 0], [-16, 6], [-11.5, -7], [14, 1], [12, 8], [17, -4], [-6.5, 7.5], [7, 9]].forEach(([x, dz], i) => spots.push({ x, z: z0 + (i >= 6 ? back * dz : dz), z0, i })); }
    const keep = Math.round(TIER.spectators / 2), chosen = spots.filter((s) => s.i < keep);
    await Promise.all(chosen.map(async (sp, n) => {
      const g = n % 3 === 1 ? 'f' : 'm', top = cols[(n * 5 + 1) % cols.length], trim = trims[n % trims.length];
      const h = await V3L.loadHuman({ character: g === 'f' ? 'mannequin_f' : 'mannequin_m', kit: { top, bottoms: top, socks: '#f4f1e6' }, skin: skins[n % skins.length], quality: 'low', castShadow: false, scale: 0.96 + (n % 4) * 0.025 });
      addArcheryClips(h); h.groundClamp = 'auto'; stage.add(h); stage.track(h);
      const robe = makeRobe({ g, kit: { top, trim } }); stage.add(robe);
      h.setPosition(sp.x, groundH(sp.x, sp.z), sp.z); h.setFacing(Math.atan2(-sp.x * 0.3, sp.z0 ? -1 : 1)); h.play(n % 2 ? 'idle_relaxed' : 'ar_ready', { fade: 0, startTime: (n * 0.7) % 2 });
      spectators.push({ h, robe, sp, clip: n % 2 ? 'idle_relaxed' : 'ar_ready', n });
    }));
    stage.invalidate();
  }
  loadSpectators().catch((e) => console.warn('spectators failed', e));

  // ---- sizes -----------------------------------------------------------------------------------------------------------------------------------------------
  let cssW = 0, cssH = 0, scaleV = 1, sizeKey = '', vw = 720, vh = 1280;
  const MAX_PIXELS = QP('maxpx', 3.2e6);
  function layout(w, h) {
    const r = kitCanvas.getBoundingClientRect();
    const cw = r.width || globalThis.innerWidth, ch = r.height || globalThis.innerHeight;
    const sk = `${cw}x${ch}|${w}x${h}`;
    if (sk !== sizeKey) {
      sizeKey = sk; cssW = cw; cssH = ch; stage.resize();
      const want = Math.max(1, Math.min(globalThis.devicePixelRatio || 1, QP('maxpx', 0) ? 3 : 2, Math.sqrt(MAX_PIXELS / Math.max(1, cw * ch))));
      if (Math.abs(renderer.getPixelRatio() - want) > 0.01 || renderer.domElement.width !== Math.round(cw * want)) { renderer.setPixelRatio(want); renderer.setSize(cw, ch, false); }
      stage.invalidate();
    }
    vw = w; vh = h; scaleV = Math.min(cw / w, ch / h);
  }

  // ---- camera ----------------------------------------------------------------------------------------------------------------------------------------------
  const cam = { pos: V3(0, 3, -6), look: V3(0, 1.4, 30), fov: 46, init: false };
  let lastPhase = '', lastEnd = -1, camK = 6;
  function applyMain(spec, region, dt, snap) {
    const k = snap || !cam.init ? 1 : 1 - Math.exp(-dt * camK);
    cam.pos = lerp3(cam.pos, spec.pos, k); cam.look = lerp3(cam.look, spec.look, k); cam.fov = lerp(cam.fov, spec.fov, k); cam.init = true;
    const cw = cssW, ch = cssH;
    camera.clearViewOffset?.();
    const sh = shake > 0 ? shake : 0; camera.position.set(cam.pos.x + sh * 0.05 * Math.sin(animT * 83), cam.pos.y + sh * 0.04 * Math.sin(animT * 71 + 1), cam.pos.z); camera.lookAt(cam.look.x, cam.look.y, cam.look.z);
    // the picture is composed for the region the HUD leaves free; the canvas shows the rest of the valley around it
    const rw = region.w * scaleV, rh = region.h * scaleV, rx = region.x * scaleV + (cw - vw * scaleV) / 2, ry = region.y * scaleV + (ch - vh * scaleV) / 2;
    const fullFov = (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (ch / Math.max(1, rh))) * 180) / Math.PI;
    camera.fov = Math.min(110, fullFov); camera.aspect = cw / ch;
    const dx = rx + rw / 2 - cw / 2, dy = ry + rh / 2 - ch / 2;
    if (camera.setViewOffset) camera.setViewOffset(cw, ch, -dx, -dy, cw, ch);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }

  // ---- people: movement and poses -----------------------------------------------------------------------------------------------------------------------
  const spotFor = (dir, t, m) => {
    const S = stand(dir), F = fwd(dir), R = rgt(dir);
    return V(S.x + F.x * (2.6 + 1.1 * m) + R.x * (-5.4 - 3.6 * t - 0.6 * (m % 2)), 0, S.z + F.z * (2.6 + 1.1 * m) + R.z * (-5.4 - 3.6 * t - 0.6 * (m % 2)));
  };
  function moveTo(a, want, yaw, dt, snap) {
    const h = a.h, dx = want.x - a.pos.x, dz = want.z - a.pos.z, d = Math.hypot(dx, dz);
    if (snap || d > 60) { a.pos.copy(want); a.yaw = yaw; h.setPosition(a.pos.x, 0, a.pos.z); h.setFacing(a.yaw); a.walking = false; return 0; }
    if (d > 0.05) {
      const sp = clamp(1.1 + d * 0.9, 1.3, 3.6), step = Math.min(d, sp * dt);
      a.pos.x += (dx / d) * step; a.pos.z += (dz / d) * step; a.walking = true;
      const target = Math.atan2(dx, dz); let dy = target - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 9);
      h.setPosition(a.pos.x, 0, a.pos.z); h.setFacing(a.yaw);
      return sp;
    }
    a.walking = false;
    let dy = yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 8);
    h.setPosition(a.pos.x, 0, a.pos.z); h.setFacing(a.yaw);
    return 0;
  }
  const play = (a, name, o = {}) => { if (a.clip !== name) { a.h.play(name, { fade: o.fade ?? 0.3, loop: o.loop, startTime: o.startTime }); a.clip = name; } };
  const lowerBow = (a, dt, to) => { a.lower += (to - a.lower) * Math.min(1, dt * 5); };

  const SHOW_STATS = QP('fps', 0) === 1;
  let lastFrameAt = 0, fpsSmooth = 60;
  function drawStats(ctx) {
    const n = nowMs(); if (lastFrameAt) fpsSmooth += ((1000 / Math.max(1, n - lastFrameAt)) - fpsSmooth) * 0.05; lastFrameAt = n;
    ctx.save(); ctx.font = '600 20px monospace'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(8, vh - 34, 560, 28); ctx.fillStyle = '#9fffa0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${fpsSmooth.toFixed(0)} fps  calls ${perf.mainCalls}+${perf.lensCalls}  tris ${(perf.mainTris / 1000).toFixed(0)}k+${(perf.lensTris / 1000).toFixed(0)}k  js ${(perf.sum / Math.max(1, perf.n)).toFixed(1)} ms`, 16, vh - 20); ctx.restore();
  }
  const perf = { n: 0, sum: 0, max: 0, mainCalls: 0, mainTris: 0, lensCalls: 0, lensTris: 0 };
  let animT = 0, lastSimT = null, wall = 0, showT = 0, fxE = null;
  function peopleFrame(s, E, dt, snapAll) {
    const play_ = s.scene === 'play' && E;
    const dir = E ? E.dir : 1, S = stand(dir), F = fwd(dir), R = rgt(dir);
    const phase = play_ ? E.phase : 'show';
    const cur = play_ ? E.cur : null;
    const dance = phase === 'dance' ? danceSpot(dir) : null;
    const last = E ? E.last : null;
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i]; if (!a) continue;
      const t = a.team, m = a.m, h = a.h; h.root.visible = true; a.robe.visible = true; a.sleeves.visible = true;
      const isCur = !!cur && cur.team === t && cur.m === m && ['aim', 'draw', 'flight', 'result', 'nock', 'dance', 'endscore'].includes(phase) && phase !== 'dance';
      let want = spotFor(dir, t, m), yaw = yawOfDir(dir), mode = 'wait';
      if (!play_) {
        const winner = s.scene === 'result' && s.over ? s.over.winner : null, ds = danceSpot(1);
        if (winner !== null && winner !== undefined) {          // the result screen: the winners dance, the others stand and clap
          if (t === winner) { want = V(ds.c.x + R.x * (m - 1) * 1.55, 0, ds.c.z + R.z * (m - 1) * 1.55); yaw = yawOfDir(1); mode = 'dance'; }
          else { want = V(ds.c.x + R.x * ((m - 1) * 1.7 + (m % 2 ? 0.8 : -0.8)), 0, ds.c.z - 3.2); yaw = yawOfDir(1); mode = 'cheer'; }
          if (winner < 0) mode = 'show';
        } else {   // title and menus: the first team stands in a row at the line, the second further back
          want = V(S.x + R.x * ((m - 1) * 1.9), 0, S.z + F.z * (t === 0 ? 0 : 5)); mode = 'show'; yaw = yawOfDir(dir);
        }
      } else if (isCur) { want = V(S.x, 0, S.z); yaw = -dir * Math.PI / 2; mode = 'shoot'; }
      else if (dance && last && last.team === t) { const c = dance.c; want = V(c.x + R.x * (m - 1) * 1.55, 0, c.z + R.z * (m - 1) * 1.55); yaw = yawOfDir(dir); mode = 'dance'; }
      else if (phase === 'endintro' && E.order && false) { mode = 'wait'; }
      // move
      const sp = moveTo(a, want, yaw, dt, snapAll || a.snap || (E && E.end !== a.lastEnd && phase === 'endintro'));
      a.snap = false; a.lastEnd = E ? E.end : -1;
      // clips and poses
      if (a.walking) { h.locomote(sp, { fade: 0.2 }); a.clip = 'loco'; putAway(a); a.bow.visible = true; carryBow(a, F, R); }
      else if (mode === 'shoot') {
        play(a, 'ar_stance');
        let p = 0, pull = 0, upk = 0, lowerTo = 0;
        if (phase === 'aim' || phase === 'nock') { p = 0; if (phase === 'nock') lowerTo = 0.6; }
        if (phase === 'draw' && E.draw) p = drawFrac(E.draw.t);
        if (phase === 'flight') { const k = (E.t - E.arrow.t0); p = 0; pull = Math.max(0, 0.22 * Math.exp(-k * 7)); upk = 0; }
        if (phase === 'result') { lowerTo = clamp((E.pt - 0.7) / 0.9, 0, 1); }
        if (phase === 'endscore') lowerTo = 1;
        a.lower = a.lowerT === undefined ? lowerTo : a.lower; a.lower += (lowerTo - a.lower) * Math.min(1, dt * 4);
        let sway = null;
        if (phase === 'draw' && E.draw && !E.draw.auto) { const w = swayAt(E.draw.ph, E.draw.t); sway = { dr: w.u * 0.004, dy: w.h * 0.004 }; }
        poseShooter(a, F, p, { sway, pull, lower: a.lower });
        a.arrow.visible = (phase === 'aim' || phase === 'draw' || phase === 'nock') && E.phase !== 'flight';
        if (phase === 'flight' || phase === 'result') a.arrow.visible = false;
        const nock = (phase === 'aim' || phase === 'draw');
        a.arrow.visible = nock;
        a.mode = mode;
      } else if (mode === 'cheer') {
        putAway(a); a.bow.visible = false; a.arrow.visible = false; play(a, m % 2 ? 'clap' : 'cheer', { startTime: m * 0.4 });
      } else if (mode === 'dance') {
        putAway(a); a.bow.visible = false; a.arrow.visible = false;
        const dn = ['dz_a', 'dz_b', 'dz_c', 'dz_d'][(m + (E ? E.end | 0 : 0)) % 4];
        play(a, dn, { startTime: m * 0.31 });
        const TAU = Math.PI * 2;   // the step carries the dancer: a side step for (a), a swing of the body for (d), a small circle for (c)
        if (dn === 'dz_a') { const o = 0.3 * Math.sin((TAU * animT) / 2.4 + 0.5 * m); h.setPosition(a.pos.x + R.x * o, 0, a.pos.z + R.z * o); }
        else if (dn === 'dz_d') h.setFacing(a.yaw + 0.45 * Math.sin((TAU * animT) / 2.0 + 0.4 * m));
        else if (dn === 'dz_c') { const o = 0.22 * Math.sin((TAU * animT) / 2.2 + m); h.setPosition(a.pos.x + R.x * o, 0, a.pos.z + R.z * o * 0.6); }
      } else {
        // waiting / watching
        a.arrow.visible = false;
        const react = reaction(E, a, phase, last);
        if (react) { putAway(a); a.bow.visible = false; play(a, react); }
        else { play(a, 'ar_ready', { startTime: (i * 0.7) % 3 }); a.lower = a.lower ?? 1; a.lower += (1 - a.lower) * Math.min(1, dt * 4); poseShooter(a, F, 0, { lower: 1 }); }
      }
    }
    // the crew at the far board
    for (let i = 0; i < spotters.length; i++) {
      const sp = spotters[i]; if (!sp) continue; const h = sp.h; h.root.visible = true; sp.robe.visible = true;
      const B = V(0, 0, boardZ(dir)), pos = V(B.x + R.x * (i ? 2.7 : -2.5), 0, B.z - F.z * (i ? 1.5 : 0.8));
      h.setPosition(pos.x, 0, pos.z); h.setFacing(yawOfDir(-dir));
      const hit = play_ && E.last && (phase === 'result' || phase === 'dance') && E.last.pts >= 2;
      const want = hit ? 'wave' : 'idle_relaxed';
      if (sp.clip !== want) { h.play(want, { fade: 0.3, loop: want !== 'wave' }); sp.clip = want; }
    }
  }
  function reaction(E, a, phase, last) {
    if (!E || !last || (phase !== 'result' && phase !== 'dance')) return null;
    if (a.team === last.team) return last.pts >= 2 ? (a.m === last.m ? 'celebrate_2' : 'cheer') : last.pts === 1 ? 'clap' : (a.m === last.m ? 'ar_shrug' : null);
    return last.pts >= 2 ? 'ar_nod' : null;
  }
  function carryBow(a, F, R) {
    a.bow.visible = true; const hand = a.h.bonePosition('L_Hand', a.tmp.a);
    a.bow.position.copy(hand); a.bow.rotation.set(0, F.z > 0 ? Math.PI : 0, 0); a.bow.rotateX(0.05); a.bow.position.y -= 0.02; a.bow.userData.setNock(V(0, 0, 0.11));
    a.arrow.visible = false; void R;
  }

  // ---- arrows in the world ---------------------------------------------------------------------------------------------------------------------------------------
  let stuckKey = '';
  function arrowsFrame(E, play_) {
    const ar = flightArrow, tmp = V(), dirv = V();
    if (play_ && E.arrow && E.arrow.alive) {
      const a = E.arrow, sp = Math.hypot(a.vx, a.vy, a.vz) || 1;
      ar.visible = true; ar.scale.setScalar(2.6); ar.position.set(a.x, a.y, a.z); dirv.set(a.vx / sp, a.vy / sp, a.vz / sp); ar.lookAt(tmp.copy(ar.position).add(dirv));
      glint.visible = true; glint.position.set(a.x, a.y, a.z); const d = camera.position.distanceTo(glint.position); glint.scale.setScalar(clamp(d * 0.0032, 0.02, 1.6));
      trail.push([a.x, a.y, a.z]); if (trail.length > 40) trail.shift();
      const p = trailLine.geometry.attributes.position.array; for (let i = 0; i < 40; i++) { const q = trail[Math.max(0, trail.length - 1 - i)] || [a.x, a.y, a.z]; p[i * 3] = q[0]; p[i * 3 + 1] = q[1]; p[i * 3 + 2] = q[2]; } trailLine.geometry.attributes.position.needsUpdate = true; trailLine.visible = true;
    } else { ar.visible = false; glint.visible = false; trailLine.visible = false; trail.length = 0; }
    const key = play_ ? E.stuck.map((s) => s.id).join(',') + '|' + E.end : '';
    if (key !== stuckKey) {
      stuckKey = key;
      stuckPool.forEach((m, i) => {
        const s = play_ ? E.stuck[i] : null;
        if (!s) { m.visible = false; return; }
        const sp = Math.hypot(s.vx, s.vy, s.vz) || 1, d = V(s.vx / sp, s.vy / sp, s.vz / sp), len = m.userData.len, emb = s.board ? 0.045 : 0.09;
        m.visible = true; m.position.set(s.x - d.x * (len - emb), s.y - d.y * (len - emb), s.z - d.z * (len - emb)); m.lookAt(V(m.position.x + d.x, m.position.y + d.y, m.position.z + d.z));
      });
    }
  }

  // ---- lens --------------------------------------------------------------------------------------------------------------------------------------------------------
  // The sight lens is a second viewport of the same WebGL canvas (scissored square under the HUD's round window): no canvas-to-canvas copy, so nothing can fail on iOS.
  // The 2D layer paints a plate over the four corners of the square and the bezel around the circle (view.drawLensOverlay).
  function renderLens(E, rect) {
    const L = lensCam(E);
    lensCamera.position.set(L.pos.x, L.pos.y, L.pos.z); lensCamera.fov = L.fov; lensCamera.aspect = 1; lensCamera.near = 6; lensCamera.updateProjectionMatrix(); lensCamera.lookAt(L.look.x, L.look.y, L.look.z); lensCamera.updateMatrixWorld(true);
    const ox = (cssW - vw * scaleV) / 2, oy = (cssH - vh * scaleV) / 2;
    const side = Math.max(32, Math.round(rect.w * scaleV)), x = Math.round(ox + rect.x * scaleV), y = Math.round(cssH - (oy + rect.y * scaleV) - side);
    renderer.setScissorTest(true); renderer.setViewport(x, y, side, side); renderer.setScissor(x, y, side, side);
    const sa = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    const hide = [];   // the archers' own bow sits at the lens; the narrow zooms see only grass and the board, so the heavy scenery is skipped
    for (const a of slots) if (a) for (const o of [a.h.root, a.bow, a.arrow, a.robe, a.sleeves]) if (o.visible) { o.visible = false; hide.push(o); }
    if (E.zoom >= 2) for (const o of world.heavy) if (o.visible) { o.visible = false; hide.push(o); }
    glint.scale.setScalar(clamp(145 * 0.0035, 0.2, 3));
    renderer.render(scene, lensCamera);
    for (const o of hide) o.visible = true;
    renderer.shadowMap.autoUpdate = sa; renderer.setScissorTest(false); renderer.setViewport(0, 0, cssW, cssH);
  }

  // ---- per frame ------------------------------------------------------------------------------------------------------------------------------------------------------
  let shown = false, lastE = null, simPrev = null;
  function frame(game, ctx) {
    const s = game.getState(), E = s.E;
    if (E && E !== lastE) { lastE = E; applyRoster(E); }
    else if (!E && lastE) { lastE = null; applyRoster(null); }
    if (!E && s.scene !== 'play') applyRoster(null);
    const active = ready && !lost && !s.hide3d && !(s.scene === 'rules' || s.scene === 'about' || s.scene === 'howto');
    if (!active) { if (shown) { canvas.style.visibility = 'hidden'; shown = false; game.setView3d?.(false); } simPrev = null; return; }
    if (!shown) { canvas.style.visibility = 'visible'; shown = true; game.setView3d?.(true); stage.invalidate(); }
    const w = s.layoutW || kitCanvas.width, h = s.layoutH || kitCanvas.height;
    layout(s.layoutW, s.layoutH);
    const play_ = s.scene === 'play' && E;
    // animation clock: sim time while playing (freezes with the game), wall time elsewhere
    let dt;
    if (play_ && !s.shot) { const t = E.t; dt = simPrev === null ? 0 : t - simPrev; simPrev = t; if (dt < 0 || dt > 0.25) dt = 0; if (s.paused) dt = 0; }
    else { simPrev = null; const n = nowMs(); dt = Math.min(0.05, wall ? (n - wall) / 1000 : 0); wall = n; if (s.paused) dt = 0; }
    if (!play_ || s.shot) wall = nowMs(); else wall = 0;
    showT += dt; animT += dt;
    // wind streamers
    if (E) { const ww = windAt(E, E.t); for (const st of streamers) st.mesh.userData.update(ww.x, ww.z, ww.s, animT, st.phase); } else for (const st of streamers) st.mesh.userData.update(1, 0.4, 1.5, animT, st.phase);
    for (const c of world.clouds) c.position.x += dt * c.userData.speed; 
    const aspectR = s.viewRect.w / Math.max(1, s.viewRect.h);
    const snap = !!E && (E.end !== lastEnd || (E.phase === 'endintro' && lastPhase !== 'endintro'));
    if (E) { lastEnd = E.end; } 
    let spec;
    if (play_) { spec = mainCam(E, aspectR); camK = E.phase === 'flight' ? 16 : E.phase === 'dance' || E.phase === 'result' ? 4 : E.phase === 'endintro' ? 30 : 5; }
    else if (s.scene === 'result' && s.over && s.over.winner >= 0) { const ds = danceSpot(1); spec = { pos: ds.cam, look: ds.look, fov: aspectR < 1 ? 50 : 36 }; }
    else spec = showCam(animT, aspectR);
    if (play_ && E.phase !== lastPhase && (E.phase === 'walk')) cam.init = false;
    lastPhase = play_ ? E.phase : '';
    applyMain(spec, s.viewRect, dt, snap || !play_ && false);
    peopleFrame(s, play_ ? E : null, dt, snap);
    arrowsFrame(E, play_);
    // reactions to what happened on the range
    if (E && E !== fxE) { fxE = E; seenEv = s.shot ? Math.max(0, (E.evId | 0) - 3) : (E.evId | 0); }
    if (shake > 0) shake = Math.max(0, shake - dt * 4);
    if (play_) for (const e of E.events) {
      if (e.id <= seenEv) continue; seenEv = e.id;
      if (e.type === 'release') shake = 1;
      const bz = boardZ(E.dir), brd = E.dir > 0 ? world.boards[0] : world.boards[1];
      if (e.type === 'karay' || e.type === 'hit') { fx.dust(e.gx ?? 0, e.y ?? 0.6, bz - E.dir * 0.2, 0.35); boardWob = { b: brd, t: 0 }; fx.cheerAt(animT, bz, e.type === 'karay' ? 5 : 3); }
      else if (e.type === 'near' || e.type === 'miss') fx.dust(e.gx, 0.1, e.gz, 0.9);
      else if (e.type === 'dance') { const d = danceSpot(E.dir); fx.burstPetals(d.c.x, d.c.z, 0, 0); }
    }
    if (boardWob.b) { boardWob.t += dt; const k = boardWob.t; boardWob.b.rotation.x = k < 1.6 ? 0.07 * Math.exp(-k * 3.2) * Math.sin(k * 26) : 0; if (k >= 1.6) boardWob.b = null; }
    { const w = E ? windAt(E, E.t) : { x: 1, z: 0.4, s: 1.4 }; fx.update(dt, animT, w, camera.position, groundH, camera.quaternion); }
    for (const sp of spectators) {
      const cheer = fx.cheering(animT, sp.sp.z), want = cheer ? (sp.n % 2 ? 'cheer' : 'clap') : (sp.n % 2 ? 'idle_relaxed' : 'ar_ready');
      if (sp.clip !== want) { sp.h.play(want, { fade: 0.3 }); sp.clip = want; }
      sp.h.root.visible = true; sp.robe.visible = true; followRobe(sp.h, sp.robe);
    }
    stage.update(dt, { renderNow: false });
    for (const a of slots) if (a) { updateRobe(a); updateSleeves(a); }
    for (const sp of spotters) if (sp) followRobe(sp.h, sp.robe);
    stage.setShadowTarget(play_ ? standX(E.dir) : -3, 0, play_ ? standZ(E.dir) : 0);
    // lens first (into the corner of the canvas), then the whole picture over it
    const lensRect = play_ && s.lensRect && s.lensOn ? s.lensRect : null;
    renderer.setViewport(0, 0, cssW, cssH);
    renderer.render(scene, camera);
    perf.mainCalls = renderer.info.render.calls; perf.mainTris = renderer.info.render.triangles;
    if (lensRect) renderLens(E, lensRect);
    perf.lensCalls = renderer.info.render.calls; perf.lensTris = renderer.info.render.triangles;
    if (lensRect && game.drawLens) game.drawLens(ctx, lensCam(E));
    if (SHOW_STATS) drawStats(ctx);
    void w; void h;
  }
  function showCam(t, aspect) {
    const tall = aspect < 1, S = stand(1);
    const a = t * 0.05;
    return { pos: V3(S.x + 6.5 + Math.sin(a) * 2.2, 1.35 + 0.25 * Math.sin(a * 1.7), S.z + 10 + Math.cos(a) * 1.2), look: V3(S.x - 0.4, 1.35, S.z - 0.4), fov: tall ? 54 : 38 };
  }

  return {
    stage, ready: () => ready, stats: () => { const i = renderer.info, o = { frames: perf.n, jsMsAvg: +(perf.sum / Math.max(1, perf.n)).toFixed(2), jsMsMax: +perf.max.toFixed(1), mainCalls: perf.mainCalls, mainTris: perf.mainTris, lensCalls: perf.lensCalls, lensTris: perf.lensTris, geometries: i.memory.geometries, textures: i.memory.textures, quality }; perf.n = 0; perf.sum = 0; perf.max = 0; return o; }, spectatorCount: () => spectators.length, busy: () => loading > 0 || !ready, frame, camera, THREE, world, slots, spotters,
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => { r(ctx, view); const t0 = nowMs(); try { frame(game, ctx); } catch (e) { console.warn('3D frame failed', e); } perf.n++; perf.sum += nowMs() - t0; perf.max = Math.max(perf.max, nowMs() - t0); };
      return game;
    },
  };
}
