// 3D presenter: READS the simulation (game.getState().sim) and shows the polder, the canal, the pole and the jumper. It never writes back.
// The simulation owns every position and time (the run, the plant, the pole angle, the let-go, the landing); the jumper is placed and posed to agree with
// them. The camera is a function of the live screen shape: portrait follows from the side with a tall frame, landscape shows the whole canal.
import { buildWorld } from './world.js';
import { loadAthlete } from './athlete.js';
import { venueById, STANDS } from '../src/venues.js';
import { createJump, makeWind, levelById, groundAt } from '../src/jump.js';
import { createPilot } from '../src/pilot.js';
import { createRng } from '../kit/rng.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RUNWAY_Y = 0.56;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return weak || touch ? 'medium' : 'high';   // touch devices default to medium: steady 60 fps first
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 12 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.3; stage.camera.far = 2600; stage.camera.fov = 50; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, ready: false, lost: false, lab: null };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  stage.setLighting('day', { exposure: 1.0, hemi: 0.78, keyI: 2.8, sky: 0x9cc6ee, fog: 0xdbe8ef });
  stage._shadowOffset.set(-14, 24, -10);
  stage.lights.rim.intensity = 0.6;
  const world = buildWorld(V3, stage);
  P.world = world;

  // ---- the jumper (loaded in the background; the picture works without it)
  let A = null, curChar = 'athlete_m';
  const athletes = {}, pending = {};
  const lod = quality === 'high' ? 0 : 1;
  const showOnly = (ch) => { for (const [k, a] of Object.entries(athletes)) a.h.root.visible = k === ch; };
  const addAthlete = (ch, a, first) => {
    athletes[ch] = a; stage.add(a.h); stage.track(a.h);
    if (first) { stage.add(a.pole.group); P.pole = a.pole; }
  };
  P.loading = loadAthlete(V3, { lod }).then((a) => {
    addAthlete('athlete_m', a, true); A = a; P.ready = true; stage.invalidate();
  }).catch((e) => { console.warn('athlete failed to load', e); P.ready = true; });
  // ---- real spectators: a few lifelike people (LOD'd, shared geometry) in front of the instanced far crowd; they idle, then cheer after a good jump
  const spec = { crowd: null, list: [], venue: '' };
  const KITS = ['#c0392b', '#2c5d8f', '#e8e4d8', '#d98a2b', '#4f7d5e', '#7a4f7c', '#b8c4cc', '#e0b13a', '#a83a3a', '#3d6f8f'];
  const BOTTOMS = ['#2a3340', '#3b3f4a', '#4a3a2c', '#1d3552', '#5a5a5a'];
  const SKINS = ['light', 'light', 'tan', 'brown', 'peach', 'deep', 'ivory'];
  const HAIRS = ['brown', 'black', 'blond', 'grey', 'ginger', 'brown'];
  P.spectators = (async () => {
    try {
      await P.loading; await new Promise((r) => setTimeout(r, 600));   // after the jumper, so the first playable frame is not delayed
      const n = quality === 'low' ? 10 : quality === 'medium' ? 18 : 26;
      spec.crowd = V3.createCrowd(stage, { farEvery: 3 });
      for (let i = 0; i < n; i++) {
        const female = i % 3 === 1;
        const h = await V3.loadHuman({ character: female ? 'athlete_f' : 'athlete_m', lod: 'auto', skin: SKINS[(i * 5) % SKINS.length], hair: HAIRS[(i * 7) % HAIRS.length],
          kit: { top: KITS[(i * 3) % KITS.length], bottoms: BOTTOMS[i % BOTTOMS.length], socks: '#e9eef2' } });
        h.groundClamp = 'off'; h.footPlanting = false; h.root.visible = false;
        h.play(i % 4 === 0 ? 'idle_relaxed' : 'idle', { fade: 0 });
        spec.crowd.add(h, { phase: (i * 0.37) % 1 });
        spec.list.push({ h, i, cheer: false });
        stage.invalidate();
      }
      spec.venue = '';
    } catch (e) { console.warn('spectators unavailable', e); }
  })();
  function placeSpectators(Vn) {
    if (spec.venue === Vn.id || !spec.list.length) return;
    spec.venue = Vn.id;
    const W = Vn.W, SL = Vn.sandLen || 11, n = spec.list.length;
    const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
    spec.list.forEach(({ h, i }) => {
      const grp = i % 4, k = Math.floor(i / 4), per = Math.ceil(n / 4), u = (k + 0.2 + hash(i, 1) * 0.6) / per;
      let x, z;
      if (grp === 0) { x = 3.4 + hash(i, 2) * 4.5; z = -21 + u * 17; }                        // behind the runway
      else if (grp === 1) { x = 4.2 + hash(i, 2) * 5; z = W + 1.6 + u * (SL - 3); }          // by the sand
      else if (grp === 2) { x = -9 + u * 20; z = W + SL + 2.5 + hash(i, 3) * 2.5; }           // a row on the far bank
      else { x = 6 + hash(i, 2) * 6; z = -26 + u * 22; }                                      // further back on the near bank
      h.root.position.set(x, 0.45, z);
      const zt = W * 0.5, face = Math.atan2(-x, zt - z);
      h.root.rotation.set(0, face + (hash(i, 4) - 0.5) * 0.5, 0);
      h.root.visible = true;
    });
  }
  function stepSpectators(dt, cheer) {
    if (!spec.crowd) return;
    for (const e of spec.list) {
      const want = cheer ? (e.i % 5 === 3 || e.i % 7 === 2 ? 'clap' : 'cheer') : (e.i % 4 === 0 ? 'idle_relaxed' : 'idle');
      if (e.pend !== want && e.want !== want) { e.pend = want; e.wait = ((e.i * 0.137) % 0.9) + 0.05; }   // each person reacts a beat apart
      if (e.pend) { e.wait -= dt; if (e.wait <= 0) { e.want = e.pend; e.pend = null; e.h.crossfade(e.want, 0.3, { loop: true }); } }
    }
    spec.crowd.update(dt);
  }
  function setCharacter(ch) {
    if (athletes[ch]) { curChar = ch; A = athletes[ch]; showOnly(ch); stage.invalidate(); return; }
    if (pending[ch] || !A) return;
    pending[ch] = true;
    loadAthlete(V3, { character: ch, lod }).then((a) => { addAthlete(ch, a, false); curChar = ch; A = a; showOnly(ch); stage.invalidate(); }).catch((e) => { console.warn('jumper failed to load', e); pending[ch] = false; curChar = ch; });
  }

  // ---- splash and sand puffs: a small pool of sprites
  const sprayTex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c; })());
  sprayTex.colorSpace = THREE.SRGBColorSpace;
  const spray = [];
  for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprayTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; stage.add(s); spray.push({ s, v: V(), life: 0, max: 1, size: 1 }); }
  let sprayN = 0;
  function emit(p, vel, n, size, color) {
    for (let i = 0; i < n; i++) {
      const sp = spray[sprayN++ % spray.length];
      sp.s.material.color.set(color);
      sp.s.position.copy(p).add(V(Math.sin(i * 12.9898 + sprayN) * 0.35, 0.1, Math.cos(i * 78.233 + sprayN) * 0.35));
      sp.v.set(Math.sin(i * 7.7 + sprayN * 1.3) * 2.2, 1.6 + Math.abs(Math.sin(i * 3.1 + sprayN)) * 3.4, vel.z * 0.3 + Math.cos(i * 5.3 + sprayN) * 1.8);
      sp.life = sp.max = 0.7 + Math.abs(Math.sin(i * 1.7 + sprayN)) * 0.7; sp.size = size * (0.6 + Math.abs(Math.cos(i * 2.9)) * 0.9); sp.s.visible = true;
    }
  }
  function stepSpray(dt) {
    for (const sp of spray) {
      if (sp.life <= 0) { sp.s.visible = false; continue; }
      sp.life -= dt; sp.v.y -= 7 * dt; sp.s.position.addScaledVector(sp.v, dt);
      const u = clamp(sp.life / sp.max, 0, 1); sp.s.material.opacity = u * 0.85; const sz = sp.size * (1.3 - u * 0.6); sp.s.scale.set(sz, sz, 1);
    }
  }

  // ---- water ripples: expanding rings where a body or the pole tip hits the canal
  const ripples = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; stage.add(m); ripples.push({ m, life: 0 });
  }
  let ripN = 0;
  function ripple(x, z) { for (let k = 0; k < 3; k++) { const r = ripples[ripN++ % ripples.length]; r.m.position.set(0, 0.04, z); r.life = 1.8 + k * 0.0; r.delay = k * 0.25; r.m.position.x = x; r.m.visible = true; } }
  function stepRipples(dt) {
    for (const r of ripples) {
      if (r.life <= 0) { r.m.visible = false; continue; }
      if (r.delay > 0) { r.delay -= dt; r.m.material.opacity = 0; continue; }
      r.life -= dt; const u = 1 - clamp(r.life / 1.8, 0, 1);
      const sc = 0.4 + u * 4.5; r.m.scale.set(sc, sc, sc); r.m.material.opacity = (1 - u) * 0.55;
    }
  }
  // ---- birds: a few swallows wheeling over the polder, wings beating
  const birds = [];
  { const bm = new THREE.MeshBasicMaterial({ color: 0x24303a, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(), wl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), bm), wr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), bm);
      wl.position.x = -0.25; wr.position.x = 0.25; const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); g.add(pl, pr);
      stage.add(g); birds.push({ g, pl, pr, ph: i * 1.3, rad: 22 + i * 7, h: 9 + i * 1.7, sp: 0.12 + i * 0.015 });
    } }
  function stepBirds(t, fz) {
    for (const b of birds) {
      const a = t * b.sp + b.ph;
      b.g.position.set(Math.cos(a) * b.rad * 0.7 - 6, b.h + Math.sin(a * 2) * 0.6, fz + 6 + Math.sin(a) * b.rad);
      b.g.rotation.y = -a + Math.PI / 2;
      const fl = Math.sin(t * 11 + b.ph * 3) * 0.7; b.pl.rotation.z = fl; b.pr.rotation.z = -fl;
    }
  }

  // ---- budget: the canvas fills the whole screen; on big screens the pixel ratio is lowered so the buffer stays about phone-sized
  const PIXELS = 2.1e6;
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
    if (perfN >= 90) { const avg = perfSum / perfN; perfN = 0; perfSum = 0; if (avg > 24 && perfLevel < 1) { perfLevel++; sizeKey = ''; stage.invalidate(); } }
  }

  // ---- the title-screen jumper: a private jump of the computer pilot, looped, so the menus have a living picture behind them
  const demo = { jp: null, pilot: null, wait: 0, n: 0, venue: null, acc: 0 };
  function demoStart(venue) {
    const rng = createRng(2000 + demo.n * 37); demo.n++;
    const wind = makeWind(rng, venue, levelById(2)); wind.head = 0.4; wind.cross = 0.3;
    demo.jp = createJump({ venue, wind, level: 2, rng: rng.fork(), stand: 1 });
    demo.pilot = createPilot(rng.fork(), 0.97); demo.wait = 0; demo.venue = venue.id; demo.acc = 0;
  }
  function demoStep(dt, venue) {
    if (!demo.jp || demo.venue !== venue.id) demoStart(venue);
    const j = demo.jp.j;
    if (j.ph === 'done') { demo.wait += dt; if (demo.wait > 2.4) demoStart(venue); return demo.jp; }
    demo.acc += Math.min(dt, 0.05);
    while (demo.acc >= 1 / 60) { demo.acc -= 1 / 60; if (demo.jp.j.ph !== 'done') demo.jp.step(demo.pilot(demo.jp)); }
    return demo.jp;
  }

  // ---- placing and posing the jumper -------------------------------------------------------------------------------------
  const st = { land: '', afterT: 0, poleTh: 0, poleW: 0, touched: -1, locoOn: false, gripOn: false, yaw: 0 };
  const upW = V(), gripToward = V();
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), fwdW = V();
  // tilt about the world X axis (head towards +z when positive) after a turn of `yaw` about the body's own up axis; the turn eases (about half a second) so it never snaps
  function setRoot(h, tilt, yawTarget, dt) {
    const d = yawTarget - st.yaw, m = Math.PI * 2 * dt;
    st.yaw += Math.abs(d) < m ? d : Math.sign(d) * m;
    qa.setFromAxisAngle(AX, tilt); qb.setFromAxisAngle(AY, st.yaw);
    h.root.quaternion.copy(qa).multiply(qb);
    return fwdW.set(0, 0, 1).applyQuaternion(h.root.quaternion);
  }
  const tmpA = V(), tmpB = V(), tmpC = V(), baseP = V(), uP = V(), nP = V(), rootP = V();
  function setBase(h, name, opts = {}) { const cur = h.layers.base.current; if (!cur || cur.clip.name !== name || cur.target === 0) h.play(name, { fade: 0.15, ...opts }); return h.layers.base.current; }
  function scrub(h, name, time) { const tr = setBase(h, name, { fade: 0.1, loop: false }); if (tr) { tr.speed = 0; tr.time = time; } }

  // The pole's current shape. `th` the angle, `bend` the bow in metres.
  function placePole(Vn, th, bend) {
    baseP.set(0, -Vn.depth, Vn.xb);
    uP.set(0, Math.cos(th), Math.sin(th));
    nP.set(0, -Math.sin(th), Math.cos(th));
    if (P.pole) P.pole.update(baseP, uP, nP, Vn.L, bend);
  }
  function clearReach(h) {
    h.setReach('L', null); h.setReach('R', null); h.setReachFoot('L', null); h.setReachFoot('R', null);
    if (st.gripOn) { h.setFingers('both', 'auto'); st.gripOn = false; }
  }
  // A real two-hand pole grip: the knuckle line (index to little finger) runs ALONG the pole, the palm sits on the body side with the fingers
  // wrapping round the far side, the thumb closes under. `pt` is the pole point the hand centre sits on, `u` the pole direction, `toward` the way from
  // the palm to the pole centre, `sgn` which way along the pole the index finger points.
  const gripQ = new THREE.Quaternion(), gripBasis = new THREE.Matrix4(), gA = V(), gP = V(), gC = V(), gOff = V(), gWrist = V(), gPole = V();
  const FIN = V3.FINGER_POSES;
  const scaleCurl = (p, k) => ({ curl: p.curl.map((r) => r.map((v) => v * k)), spread: p.spread });
  const gripPose = scaleCurl(FIN.batGrip, 0.92);
  const basisQuat = (x, y) => { gC.crossVectors(x, y).normalize(); const yy = new THREE.Vector3().crossVectors(gC, x).normalize(); return new THREE.Quaternion().setFromRotationMatrix(gripBasis.makeBasis(x, yy, gC)); };
  function gripHand(h, side, pt, u, toward, sgn, elbow, weight) {
    const fr = h.fingers[side];
    if (!fr || !fr.ok) { h.setReach(side, pt, { weight, pole: elbow }); return; }
    gA.copy(fr.across).normalize();
    gP.copy(fr.palmDir).addScaledVector(gA, -fr.palmDir.dot(gA)).normalize();
    const qLocal = basisQuat(gA.clone(), gP.clone());
    const a = u.clone().multiplyScalar(sgn).normalize();
    const p = toward.clone().addScaledVector(a, -toward.dot(a)).normalize();
    const qWorld = basisQuat(a, p);
    gripQ.copy(qWorld).multiply(qLocal.invert());
    gOff.copy(fr.knuckle).multiplyScalar(0.5).addScaledVector(fr.palmDir, 0.040).multiplyScalar(h.scale || 1).applyQuaternion(gripQ);
    gWrist.copy(pt).sub(gOff);
    h.setReach(side, gWrist, { weight, pole: elbow, quat: gripQ.clone() });
    if (weight > 0.5) { h.setFingers(side, gripPose, { rate: 14 }); st.gripOn = true; }
  }
  const on = (r, bend, Vn, out) => P.pole.at(baseP, uP, nP, Vn.L, bend, r, out);

  // mutates the athlete root and returns the camera mode
  function poseJumper(j, Vn, dt) {
    const h = A.h;
    h.root.visible = true;
    let mode = 'run';
    if (j.ph === 'ready') {
      clearReach(h);
      h.root.position.set(0, RUNWAY_Y, j.x); h.root.rotation.set(0, 0, 0); st.yaw = 0;
      setBase(h, 'cvp_ready', { fade: 0.2 }); st.locoOn = false; st.land = ''; st.poleTh = -Vn.lean0; st.poleW = 0;
      placePole(Vn, -Vn.lean0, 0.04);
      mode = 'ready';
    } else if (j.ph === 'run') {
      clearReach(h);
      h.root.position.set(0, RUNWAY_Y, j.x); h.root.rotation.set(0, 0, 0); st.yaw = 0;
      st.locoOn = true;
      h.locomote(Math.max(0, j.v));
      placePole(Vn, -Vn.lean0, 0.04);
      mode = 'run';
    } else if (j.ph === 'leap') {
      clearReach(h); st.locoOn = false;
      const u = clamp(j.tl / Math.max(0.1, j.leapT), 0, 1);
      const rg = (j.hg + Vn.depth) / Math.cos(Vn.lean0);
      const gz = Vn.xb - rg * Math.sin(Vn.lean0), gy = -Vn.depth + rg * Math.cos(Vn.lean0);
      const z = lerp(j.xL, gz - 0.05, u), y = lerp(RUNWAY_Y, gy - 1.5, u) + Math.sin(u * Math.PI) * 0.7;
      h.root.position.set(0, y, z); h.root.rotation.set(0.05 + 0.1 * u, 0, 0); st.yaw = 0;
      scrub(h, 'cvp_leap', u);
      placePole(Vn, -Vn.lean0, 0.04);
      mode = 'leap';
    } else if (j.ph === 'pole') {
      st.locoOn = false;
      const th = j.theta, r = j.r, bend = (j.bend || 0) * 1.5;
      placePole(Vn, th, bend);
      const c = r / 0.8, w1 = 0.1 * Math.sin(c * Math.PI * 2) * (j.climbing ? 1 : 0.15);
      // hanging from the grip: arms long overhead, the body below the hands, belly to the pole, legs trailing behind the swing
      const sw = Math.sin(tReal * 2.2) * 0.5 + 0.5, trail = ss(0.2, 1.4, th);
      on(r + 0.12, bend, Vn, tmpA);           // the upper hand
      on(r - 0.3, bend, Vn, tmpB);            // the lower hand, a hand-width and a bit below
      const phi = th * 0.55 - 0.04 * trail + 0.04 * sw;                        // the body hangs: it swings only part of the way with the pole
      const yawT = Math.PI * ss(-0.12, 0.38, th);                               // past the upright the jumper has turned to face the pole
      const fw = setRoot(h, phi, yawT, Math.max(dt, 1 / 60));
      upW.set(0, 1, 0).applyQuaternion(h.root.quaternion);
      rootP.copy(tmpA).addScaledVector(upW, -1.8).addScaledVector(fw, -0.24);
      h.root.position.copy(rootP);
      gripToward.copy(fw);
      setBase(h, 'cvp_hang', { fade: 0.2, loop: true });
      const elbowL = tmpA.clone().add(V(0.7, -0.35, 0)), elbowR = tmpB.clone().add(V(-0.7, -0.5, 0));
      gripHand(h, 'L', tmpA, uP, gripToward, 1, elbowL, 1);
      gripHand(h, 'R', tmpB, uP, gripToward, 1, elbowR, 1);
      h.setReachFoot('L', null); h.setReachFoot('R', null);
      st.poleTh = th; st.poleW = j.omega;
      mode = 'pole';
    } else if (j.ph === 'air' || j.ph === 'land' || j.ph === 'done') {
      clearReach(h); st.locoOn = false;
      st.poleTh = Math.min(1.5, st.poleTh + st.poleW * dt); st.poleW += (9.81 / Vn.L) * Math.sin(st.poleTh) * dt * 1.4;
      placePole(Vn, st.poleTh, 0.05);
      if (j.ph === 'air') {
        const u = clamp((j.lean || 0) / 4, 0, 1);
        h.root.position.set(0, j.py - 0.95, j.px + 0.1); setRoot(h, 0.1 + 0.1 * u, 0, dt);
        scrub(h, 'cvp_fly', clamp(0.15 + u * 0.85 * ss(0, 0.5, (j.air || 0) + 0.2), 0, 1));
        mode = 'air';
      } else {
        const c = j.contact, water = !!(c && c.water);
        const xFeet = c ? c.x : j.px;
        const key = `${c ? c.t.toFixed(3) : ''}:${j.res ? j.res.kind : ''}`;
        if (key !== st.land) {
          st.land = key; st.afterT = 0;
          if (water) h.play('fall', { fade: 0.1, loop: false });
          else h.play(j.res && j.res.kind === 'rough' ? 'cvp_rough' : 'cvp_land', { fade: 0.08, loop: false });
          if (c && st.touched !== c.t) {
            st.touched = c.t;
            if (water) { emit(V(0, 0.1, xFeet), V(0, 0, c.vx || 0), 44, 1.5, 0xe8f6ff); ripple(0, xFeet); }
            else emit(V(0, groundAt(Vn, xFeet) + 0.1, xFeet), V(0, 0, c.vx || 0), 28, 0.9, 0xe9d9a8);
          }
        }
        st.afterT += dt;
        const gy = groundAt(Vn, xFeet);
        if (water) {
          const sink = ss(0, 0.9, st.afterT);
          h.root.position.set(0, -0.95 * sink - 0.2 * (1 - sink), xFeet - (j.reach || 0) * 0.4);
          setRoot(h, 0.5 * sink, 0, dt);
        } else {
          h.root.position.set(0, gy, xFeet - (j.reach || 0) * 0.85); setRoot(h, 0, 0, dt);
        }
        if (!water && st.afterT > 2.0 && j.res && j.res.kind !== 'rough') { const cur = h.layers.base.current; if (!(cur && cur.clip.name === 'cvp_cheer')) h.crossfade('cvp_cheer', 0.4, { loop: true }); }
        mode = 'land';
      }
    }
    return mode;
  }

  // ---- cameras. The director returns where the camera wants to be for this moment; the frame smooths towards it.
  const cam = { pos: V(-14, 3, -22), look: V(0, 1.5, -18), fov: 50, init: false };
  function director(d, aspect, tReal) {
    const land = aspect > 1.1;
    const Vn = d.venue, f = d.feet;
    let pos, look, fov = 48, k = 0.3, shift = 0;
    const D = (needH) => (needH / 2) / Math.tan((fov * Math.PI / 180) / 2);
    if (d.mode === 'title') {
      const a = Math.sin(tReal * 0.12) * 0.2;
      const cz = land ? Vn.W * 0.5 + 1 : f.z + 1;
      const dist = land ? 26 : 17;
      pos = V(-Math.cos(a) * dist, land ? 5.0 : 3.5 + Math.sin(tReal * 0.15) * 0.5, cz - Math.sin(a) * dist * 0.6 - (land ? 4 : 0));
      look = V(0, land ? 3.2 : f.y + 2.2, cz + (land ? 2 : 1)); fov = land ? 40 : 52; k = 0.45; shift = land ? -2.6 : 0;
    } else if (d.mode === 'ready') {
      pos = V(land ? -9.5 : -8.2, 1.9, f.z + 1.0); look = V(0, land ? 1.2 : 4.0, f.z + 1.0); fov = land ? 40 : 52; k = 0.3; shift = land ? 2.2 : 0;
    } else if (d.mode === 'run' || d.mode === 'leap') {
      const near = ss(-16, -1, f.z);
      const dist = lerp(land ? 9 : 8.5, land ? 22 : 15.5, near);
      const lz = lerp(f.z + 1.0, Math.max(f.z, Vn.xb) - 0.5 + 2, near);
      pos = V(-dist, lerp(1.7, 4.2, near), lz); look = V(0, lerp(1.2, 4.8, near), lz);
      fov = land ? 42 : 52; k = 0.18; shift = land ? lerp(2.0, -1.0, near) : 0;
    } else if (d.mode === 'pole') {
      const midZ = lerp(Vn.xb, f.z, 0.5) + 1.5;
      fov = land ? 44 : 52;
      if (land) { pos = V(-D(17), 6.0, midZ - 0.5 + 3.5); look = V(0, 5.4, midZ + 3.0); k = 0.2; shift = -1.2; }
      else { pos = V(-D(9.5), f.y + 2.2, f.z + 0.6); look = V(0, f.y + 1.3, f.z + 1.0); k = 0.22; }   // portrait: close on the vaulter, the whole climb still in frame
    } else if (d.mode === 'air') {
      const lead = d.vel.z * 0.35;
      pos = V(-(land ? 20 : 15), Math.max(3.2, f.y + 1.2), f.z + 0.5 + lead * 0.5); look = V(0, Math.max(1.6, f.y - 0.6), f.z + 1.0 + lead * 0.5);
      fov = land ? 42 : 52; k = 0.14; shift = land ? -1.0 : 0;
    } else if (d.mode === 'land') {
      pos = V(-(land ? 12 : 9.5), 2.2, f.z - 0.5); look = V(0, 1.0, f.z + 0.2); fov = land ? 40 : 50; k = 0.25; shift = land ? 1.6 : 0;
    } else {
      const a = -1.2 + Math.sin(tReal * 0.14) * 0.35, R = land ? 14 : 11;
      pos = V(Math.sin(a) * R, 3.0, f.z + Math.cos(a) * R * 0.5 - 4); look = V(0, land ? 1.1 : 3.6, f.z + 0.5); fov = land ? 40 : 50; k = 0.5; shift = land ? 2.4 : 0;
    }
    return { pos, look, fov, k, shift };
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------
  let tReal = 0, lastNow = 0, cheerHold = 0, lastEvId = 0, camSnap = 0;
  function replayState(s, t) {
    // rebuilds a jump-like object from the recorded frames for the slow-motion replay
    const fr = s.jump.frames;
    let i = 0; while (i < fr.length - 2 && fr[i + 1][0] < t) i++;
    const a = fr[i], b = fr[i + 1], u = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
    const kind = a[1];
    const sj = s.jump;
    const o = { ph: kind === 0 ? 'run' : kind === 1 ? 'pole' : kind === 2 ? 'air' : 'land', t, tl: 0, hg: sj.hg, leapT: sj.leapT || 0.4, xL: sj.xL, res: sj.res, contact: sj.contact, reach: sj.reach || 0, air: 0 };
    if (kind === 0) { o.x = lerp(a[2], b[2], u); o.v = lerp(a[4], b[4], u); o.vx = o.v; }
    else if (kind === 1) { o.theta = lerp(a[2], b[2], u); o.r = lerp(a[3], b[3], u); o.omega = lerp(a[4], b[4], u); o.climbing = a[5] > 0.5; o.stam = a[6]; o.bend = a[7]; o.vx = 0; }
    else { o.px = lerp(a[2], b[2], u); o.py = lerp(a[3], b[3], u); o.vx = a[4]; o.vy = a[5]; o.lean = a[6]; o.air = 0.4; }
    return o;
  }
  function frame(G) {
    if (!P.ready || P.lost) return;
    const nowMs = performance.now(); let dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0; lastNow = nowMs;
    const frozen = !!(G.pauseMenu || (G.watch && G.watch.paused && G.mode === 'watch'));
    if (frozen) dt = 0;
    tReal += dt;
    const s = G.sim, scene = G.scene;
    { const want = G.settings && G.settings.jumper === 'f' ? 'athlete_f' : 'athlete_m'; if (want !== curChar) setCharacter(want); }
    stage.setVisible(true);
    const w = canvas.clientWidth || 720, hh = canvas.clientHeight || 1280, aspect = w / hh;
    sizeBudget(w, hh);
    const lab = P.lab;
    const venueId = lab && lab.venue ? lab.venue : s && (scene === 'play' || scene === 'result') ? s.venue : (G.setup && G.setup.venue) || 'canal';
    const Vbase = venueById(venueId);
    world.setVenue(Vbase);
    const stand = s && (scene === 'play' || scene === 'result') ? s.stand : 1;
    const SD = STANDS[lab && lab.stand !== undefined ? lab.stand : stand] || STANDS[1];
    const Vn = { ...Vbase, xb: Vbase.xb + SD.dx, lean0: SD.lean0 };
    const feet = V();
    let d = { mode: 'title', feet, vel: V(), venue: Vn, air: 0 };
    const wind = s && (scene === 'play' || scene === 'result') ? s.wind : { head: 0.4, cross: 0.3 };
    if (A && P.pole) {
      let j = null, mode;
      const live = s && (scene === 'play' || scene === 'result') && s.jump && !lab;
      if (lab) {
        j = lab.j; mode = poseJumper(j, Vn, dt);
        d = { mode: lab.mode || mode, feet: A.h.root.position, vel: V(0, j.vy || 0, j.vx || 0), venue: Vn, air: 0 };
      } else if (s && scene === 'play' && s.ph === 'setup' && !s.jump) {
        j = { ph: 'ready', x: -24, v: 0 };
        mode = poseJumper(j, Vn, dt); d.mode = 'ready';
      } else if (live) {
        j = s.jump;
        if (s.replay && j.frames.length > 4) j = replayState(s, s.replay.t);
        mode = poseJumper(j, Vn, dt);
        d.mode = (s.ph === 'judge' || s.ph === 'board' || scene === 'result') && !s.replay ? 'judge' : mode;
      } else {
        const dj = demoStep(dt, Vbase);
        j = dj.j;
        const stN = { ...Vbase, xb: Vbase.xb + STANDS[1].dx, lean0: STANDS[1].lean0 };
        mode = poseJumper(j, stN, dt);
        d.mode = 'title'; d.venue = stN;
      }
      d.feet = A.h.root.position;
      if (j) { d.vel = V(0, j.vy || 0, j.vx || (j.v || 0)); d.air = j.air || 0; }
      A.h.update(lab ? 0.6 : dt);
      if (s && s.events.length) { const last = s.events[s.events.length - 1]; if (last.id !== lastEvId) { lastEvId = last.id; if (last.type === 'judge') cheerHold = last.fall ? 0 : 2.6; } }
    }
    cheerHold = Math.max(0, cheerHold - dt);
    if (world.crowd) world.crowd.update(dt, cheerHold > 0 ? 1 : 0.12);
    placeSpectators(Vbase); stepSpectators(dt, cheerHold > 0);
    world.step(tReal, dt, wind);
    // the forecast flag
    if (world.flagMarker) {
      const lvl = s ? levelById(s.level) : null;
      const j = s && s.jump;
      const show = !!(s && lvl && lvl.guide && scene === 'play' && s.ph === 'run' && j && j.ph === 'pole' && j.pred && G.mode !== 'shot');
      world.flagMarker.visible = show;
      if (show) { const x = j.pred.x; world.flagMarker.position.set(0, groundAt(Vn, x), x); }
    }
    stepSpray(dt); stepRipples(dt); stepBirds(tReal, d.feet.z);
    const dr = director(d, aspect, tReal);
    if (lab && lab.cam) { dr.pos = V(...lab.cam); dr.look = V(...lab.look); dr.fov = lab.fov || 40; dr.shift = 0; }
    const kk = dt > 0 ? 1 - Math.exp(-dt / Math.max(0.04, dr.k)) : 0;
    if (!cam.init || camSnap > 0 || lab) { cam.pos.copy(dr.pos); cam.look.copy(dr.look); cam.fov = dr.fov; cam.init = true; camSnap = Math.max(0, camSnap - 1); }
    else { cam.pos.lerp(dr.pos, kk); cam.look.lerp(dr.look, kk); cam.fov = lerp(cam.fov, dr.fov, kk); }
    const c = stage.camera;
    if (Math.abs(c.fov - cam.fov) > 1e-3 || Math.abs(c.aspect - aspect) > 1e-4) { c.fov = cam.fov; c.aspect = aspect; c.updateProjectionMatrix(); }
    c.position.copy(cam.pos); c.lookAt(cam.look);
    if (dr.shift) { const r = V(0, 0, 1).applyQuaternion(c.quaternion); c.position.addScaledVector(r, dr.shift); c.lookAt(cam.look.clone().addScaledVector(r, dr.shift)); }
    const fp = A ? A.h.root.position : feet;
    stage.setShadowTarget(fp.x, fp.y, fp.z);
    stage.update(dt, { renderNow: false });
    if (!P.noRender) { stage.render(); perfTick(); }
  }

  // dev: pose lab. P.setLab({ j: { ph:'pole', theta, r, ... }, venue, stand, cam:[x,y,z], look:[x,y,z], fov }) or P.setLab(null)
  P.setLab = (o) => { P.lab = o ? { ...o } : null; camSnap = 2; };
  P.frame = frame; P.getA = () => A; P.cam = cam; P.st = st;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      view.noGL = P.lost;   // GL context lost (GPU reset, backgrounded tab): draw the flat picture until it is restored
      r(ctx, view);
      frame(game.getState());
    };
    return game;
  };
  return P;
}
