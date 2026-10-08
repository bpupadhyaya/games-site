// 3D presenter: READS the simulation (game.getState().sim) and shows the fjord hill, the jumper and the weather. It never writes back.
// The simulation owns every position and time (the in-run, the flight, the landing); the jumper's poses are scrubbed to agree with them. The camera is a
// function of the live screen shape: portrait looks down the hill from behind, landscape tracks from the side.
import { buildWorld } from './world.js';
import { loadAthlete } from './athlete.js';
import { hillById, groundY, groundAngle, inrunAt } from '../src/hills.js';
import { createJump, makeWind, levelById } from '../src/jump.js';
import { createPilot } from '../src/pilot.js';
import { createRng } from '../kit/rng.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

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
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 10 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.3; stage.camera.far = 4200; stage.camera.fov = 50; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, ready: false, lost: false, lab: null };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  stage.setLighting('day', { exposure: 1.0, hemi: 0.72, keyI: 3.0, sky: 0x8fbdf0, fog: 0xcfe2f0 });
  stage._shadowOffset.set(-16, 26, -12);
  stage.lights.rim.intensity = 0.8;
  const world = buildWorld(V3, stage);
  P.world = world;

  // ---- the jumper (loaded in the background; the picture works without it)
  let A = null, curChar = 'athlete_m';
  const athletes = {}, pending = {};
  const lod = quality === 'high' ? 0 : 1;
  const showOnly = (ch) => { for (const [k, a] of Object.entries(athletes)) { const on = k === ch; a.h.root.visible = on; for (const sk of a.skis) sk.visible = on; } };
  const addAthlete = (ch, a) => { athletes[ch] = a; stage.add(a.h); stage.track(a.h); for (const sk of a.skis) stage.add(sk); };
  P.loading = loadAthlete(V3, { lod }).then((a) => {
    addAthlete('athlete_m', a); A = a; P.ready = true; stage.invalidate();
  }).catch((e) => { console.warn('athlete failed to load', e); P.ready = true; });
  // the woman jumper is loaded the first time she is chosen, then both figures stay and only one is shown
  function setCharacter(ch) {
    if (athletes[ch]) { curChar = ch; A = athletes[ch]; showOnly(ch); stage.invalidate(); return; }
    if (pending[ch] || !A) return;
    pending[ch] = true;
    loadAthlete(V3, { character: ch, lod }).then((a) => { addAthlete(ch, a); curChar = ch; A = a; showOnly(ch); stage.invalidate(); }).catch((e) => { console.warn('jumper failed to load', e); pending[ch] = false; curChar = ch; });
  }

  // ---- snow spray at the landing: a small pool of sprites
  const sprayTex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c; })());
  sprayTex.colorSpace = THREE.SRGBColorSpace;
  const spray = [];
  for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprayTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; stage.add(s); spray.push({ s, v: V(), life: 0, max: 1, size: 1 }); }
  let sprayN = 0;
  function emitSpray(p, vel, n, size = 0.7) {
    for (let i = 0; i < n; i++) {
      const sp = spray[sprayN++ % spray.length];
      sp.s.position.copy(p).add(V(Math.sin(i * 12.9898 + sprayN) * 0.3, 0.1, Math.cos(i * 78.233 + sprayN) * 0.3));
      sp.v.set(vel.x * 0.3 + Math.sin(i * 7.7 + sprayN * 1.3) * 3.2, 1.2 + Math.abs(Math.sin(i * 3.1 + sprayN)) * 3.0, vel.z * 0.35 + Math.cos(i * 5.3 + sprayN) * 2.0);
      sp.life = sp.max = 0.7 + Math.abs(Math.sin(i * 1.7 + sprayN)) * 0.6; sp.size = size * (0.6 + Math.abs(Math.cos(i * 2.9)) * 0.9); sp.s.visible = true;
    }
  }
  function stepSpray(dt) {
    for (const sp of spray) {
      if (sp.life <= 0) { sp.s.visible = false; continue; }
      sp.life -= dt; sp.v.y -= 6 * dt; sp.s.position.addScaledVector(sp.v, dt);
      const u = clamp(sp.life / sp.max, 0, 1); sp.s.material.opacity = u * 0.85; const sz = sp.size * (1.3 - u * 0.6); sp.s.scale.set(sz, sz, 1);
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

  // ---- the title-screen jumper: a private flight of the computer pilot, looped, so the menus have a living picture behind them
  const demo = { jp: null, pilot: null, wait: 0, n: 0, hill: null, acc: 0 };
  function demoStart(hill) {
    const rng = createRng(1000 + demo.n * 37); demo.n++;
    const lv = levelById(2), wind = makeWind(rng, hill, lv);
    wind.head = 0.6; wind.cross = 0.4;
    demo.jp = createJump({ hill, gate: 1, wind, level: 2, rng: rng.fork() });
    demo.pilot = createPilot(rng.fork(), 0.97); demo.wait = 0; demo.hill = hill; demo.acc = 0;
    for (let i = 0; i < 2400 && !(demo.jp.j.ph === 'air' && demo.jp.j.air > 0.25); i++) demo.jp.step(demo.pilot(demo.jp.j));
  }
  function demoStep(dt, hill) {
    if (!demo.jp || demo.hill !== hill) demoStart(hill);
    const j = demo.jp.j;
    if (j.ph === 'done') { demo.wait += dt; if (demo.wait > 2.8) demoStart(hill); return demo.jp.j; }
    demo.acc += Math.min(dt, 0.05);
    while (demo.acc >= 1 / 60) { demo.acc -= 1 / 60; if (demo.jp.j.ph !== 'done') demo.jp.step(demo.pilot(demo.jp.j)); }
    return demo.jp.j;
  }

  // ---- placing and posing the jumper -------------------------------------------------------------------------------------
  const qRoot = new THREE.Quaternion(), qSki = new THREE.Quaternion(), eul = new THREE.Euler(), tmpP = V(), tmpQ = new THREE.Quaternion();
  const feet = { pos: V(), pitch: 0, roll: 0 };
  const st = { land: '', touched: -1, afterT: 0 };
  function setBase(h, name, opts = {}) { const cur = h.layers.base.current; if (!cur || cur.clip.name !== name || cur.target === 0) h.play(name, { fade: 0.15, ...opts }); return h.layers.base.current; }
  function scrub(h, name, time) { const tr = setBase(h, name, { fade: 0.1, loop: false }); if (tr) { tr.speed = 0; tr.time = time; } }

  function poseJumper(j, hill, dt) {
    const h = A.h;
    let skiVee = 0;
    const playing = (n) => { const cur = h.layers.base.current; return cur && cur.clip.name === n; };
    if (j.ph === 'ready' || j.ph === 'slide') {
      const p = inrunAt(hill, j.s);
      feet.pos.set(0, p.y + 0.1, p.x); feet.pitch = -p.a; feet.roll = 0;
      scrub(h, 'sj_ground', clamp(j.tuck, 0, 1));
      st.land = ''; st.afterT = 0;
    } else if (j.ph === 'air') {
      feet.pos.set(j.z, j.y + 0.1, j.x);
      const gam = Math.atan2(j.vy, j.vx);
      feet.pitch = gam + j.alpha; feet.roll = j.beta;
      const prep = ss(0.95, 0.12, j.tg);
      const t = j.air < 0.45 ? j.air : 0.45 + 0.55 * prep;
      scrub(h, 'sj_air', clamp(t, 0, 1));
      skiVee = 0.3 * ss(0.15, 0.6, j.air) * (1 - 0.85 * prep);
      st.land = ''; st.afterT = 0;
    } else {
      // landing and sliding out: skis flat on the snow
      const th = groundAngle(hill, j.x);
      feet.pos.set(j.z, groundY(hill, j.x) + 0.1, j.x); feet.pitch = -th; feet.roll = 0;
      const key = `${j.contact ? j.contact.t.toFixed(3) : ''}:${j.res ? j.res.kind : ''}`;
      if (key !== st.land) {
        st.land = key;
        if (!j.res) h.play('sj_squat', { fade: 0.06, loop: false });
        else {
          const k = j.res.kind;
          if (k === 'fall') h.play('fall', { fade: 0.1, loop: false }); else h.play(k === 'telemark' ? 'sj_tele' : k === 'clean' ? 'sj_clean' : 'sj_rough', { fade: 0.12, loop: false, startTime: 0.08 });
        }
        if (j.contact && st.touched !== j.contact.t) {
          st.touched = j.contact.t;
          emitSpray(V(j.z, groundY(hill, j.x) + 0.15, j.x), V(0, 0, j.vx), 34, j.contact.vn > 6 ? 1.1 : 0.8);
        }
      }
      st.afterT += dt;
      if (j.res && j.ph === 'done' && st.afterT > 2.0 && !playing('sj_cheer') && j.res.kind !== 'fall') h.crossfade('sj_cheer', 0.4, { loop: true });
    }
    h.root.position.copy(feet.pos);
    h.root.rotation.set(-feet.pitch, 0, -feet.roll, 'YXZ');
    return { skiVee };
  }

  function placeSkis(skiVee) {
    const h = A.h;
    h.root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;                              // +X is the avatar's left
      const foot = h.bones[i === 0 ? 'Bip01_L_Foot' : 'Bip01_R_Foot'];
      foot.getWorldPosition(tmpP);
      h.root.getWorldQuaternion(qRoot);
      eul.set(0, side * skiVee, 0); tmpQ.setFromEuler(eul);
      qSki.copy(qRoot).multiply(tmpQ);
      const ski = A.skis[i];
      ski.quaternion.copy(qSki);
      const off = V(0, -0.115, 0.06).applyQuaternion(qSki);
      ski.position.copy(tmpP).add(off);
      ski.visible = true;
    }
  }

  // ---- cameras. The director returns where the camera wants to be for this moment; the frame smooths towards it.
  const cam = { pos: V(-6, 3, -12), look: V(0, 3, 0), fov: 50, init: false };
  function director(d, aspect, tReal) {
    const land = aspect > 1.1;
    const f = d.feet, vel = d.vel;
    let pos, look, fov = 50, k = 0.25, shift = 0;
    if (d.mode === 'title') {
      // a slow drift around the flying jumper, from the side, with the whole hill in the picture
      const a = -1.15 + Math.sin(tReal * 0.1) * 0.25;
      const R = land ? 16 : 12;
      pos = V(f.x + Math.sin(a) * R * 1.0 - 4, f.y + 3.0 + Math.sin(tReal * 0.13) * 0.8, f.z - Math.cos(a) * R * 0.25 + 4);
      look = V(f.x, f.y + (land ? -1.0 : 3.0), f.z + 7); fov = land ? 40 : 52; k = 0.4; shift = land ? -2.8 : 0;
    } else if (d.mode === 'ready') {
      const r = d.rear;
      if (land) { pos = V(f.x + 3.4, r.y + 1.6, r.z - 0.5); look = V(f.x, f.y + 0.8, f.z + 2.0); fov = 40; } else { pos = V(f.x + 0.5, r.y + 2.2, r.z); look = V(f.x, f.y + 0.4, f.z + 9); fov = 54; }
      k = 0.3;
    } else if (d.mode === 'slide') {
      const near = ss(1.1, 0.0, d.tl);
      const r = d.rear;
      if (land) { pos = V(f.x + 3.4, r.y + 1.5 + near * 0.8, r.z - 0.5 - near * 1.5); look = V(f.x, f.y + 0.5, f.z + 3 + near * 6); fov = 42; }
      else { pos = V(f.x + 0.5 + near * 1.0, r.y + 2.1 + near * 1.4, r.z - near * 1.2); look = V(f.x, f.y + 0.2 - near * 3.5, f.z + 9 + near * 12); fov = 54; }
      k = 0.12;
    } else if (d.mode === 'air') {
      const sp = Math.max(8, vel.length());
      if (land) { const lead = vel.z * (d.shot ? 0.01 : 0.1); pos = V(f.x - 10.5, f.y + 2.6, f.z + 1.0 + lead); look = V(f.x + 0.2, f.y - 0.5, f.z + 2.0 + lead); fov = 42; shift = -1.4; }
      else { pos = V(f.x + 1.6, f.y + 3.2, f.z - 7.5 - Math.min(d.air, 4) * 1.2); look = V(f.x, f.y - 3.5 - d.air * 0.3, f.z + 16 + sp * 0.5); fov = 56; }
      k = land ? 0.09 : 0.14;
    } else if (d.mode === 'land') {
      if (land) { pos = V(f.x - 11.5, groundY(d.hill, f.z) + 2.6, f.z - 3.5 + d.since * 2.2); look = V(f.x, f.y + 0.9, f.z + 2.5); fov = 40; }
      else { pos = V(f.x - 6.5, groundY(d.hill, f.z) + 3.0, f.z - 8.5 + d.since * 2.0); look = V(f.x, f.y + 0.9, f.z + 3.5); fov = 50; }
      k = 0.2;
    } else {
      // judging, standings, result: a slow orbit around the landing spot with the crowd behind
      const a = 0.9 + tReal * 0.15, R = land ? 10 : 12;
      pos = V(f.x + Math.sin(a) * R, f.y + 2.4, f.z + Math.cos(a) * R - 2); look = V(f.x, f.y + 1.2, f.z + 1); fov = land ? 40 : 48; k = 0.5; shift = land ? 2.4 : 0;
    }
    return { pos, look, fov, k, shift };
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------
  let tReal = 0, lastNow = 0, cheerHold = 0, lastEvId = 0, camSnap = 0;
  function replayJump(s, t) {
    const fr = s.jump.frames;
    let i = 0; while (i < fr.length - 2 && fr[i + 1][0] < t) i++;
    const a = fr[i], b = fr[i + 1], u = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1), dtf = Math.max(1e-6, b[0] - a[0]);
    let tLand = fr[fr.length - 1][0]; for (const f of fr) if (f[1] === 2) { tLand = f[0]; break; }
    const ph = a[1] === 0 ? 'slide' : a[1] === 1 ? 'air' : 'land';
    return { ph, s: lerp(a[2], b[2], u), x: lerp(a[3], b[3], u), y: lerp(a[4], b[4], u), alpha: lerp(a[5], b[5], u), beta: lerp(a[6], b[6], u), z: lerp(a[7], b[7], u), tuck: lerp(a[8], b[8], u), band: lerp(a[9], b[9], u), vx: (b[3] - a[3]) / dtf, vy: (b[4] - a[4]) / dtf, tg: Math.max(0, tLand - t), air: Math.max(0, t - s.jump.tLip), tl: 0, res: s.jump.res, contact: s.jump.contact, t };
  }
  function frame(G, view) {
    if (!P.ready || P.lost) return;
    const nowMs = performance.now(); let dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0; lastNow = nowMs;
    const frozen = !!(G.pauseMenu || (G.watch && G.watch.paused && G.mode === 'watch'));
    if (frozen) dt = 0;
    tReal += dt;
    const s = G.sim, scene = G.scene;
    { const want = G.settings && G.settings.jumper === 'f' ? 'athlete_f' : 'athlete_m'; if (want !== curChar) setCharacter(want); }
    stage.setVisible(true);
    const w = canvas.clientWidth || 720, h = canvas.clientHeight || 1280, aspect = w / h;
    sizeBudget(w, h);
    const lab = P.lab;
    const hillId = lab ? lab.hill || 'fjord' : s && (scene === 'play' || scene === 'result') ? s.hill : (G.setup && G.setup.hill) || 'fjord';
    const hill = hillById(hillId);
    world.setHill(hill);
    let d = { mode: 'title', feet: feet.pos, vel: V(), hill, air: 0, tl: 9, since: 0 };
    let sk = { skiVee: 0 };
    const wind = s && (scene === 'play' || scene === 'result') ? s.wind : { head: 0.6, cross: 0.4 };
    if (A) {
      let j = null;
      const live = s && (scene === 'play' || scene === 'result') && s.jump && !lab;
      if (lab) {
        const hh = A.h;
        scrub(hh, lab.clip || 'sj_air', lab.time || 0);
        feet.pos.set(lab.x || 0, lab.y || 0.1, lab.z || 0); hh.root.position.copy(feet.pos);
        hh.root.rotation.set(-(lab.pitch || 0) * Math.PI / 180, 0, -(lab.roll || 0) * Math.PI / 180, 'YXZ');
        sk = { skiVee: (lab.vee || 0) * Math.PI / 180 };
        hh.update(0.6);
        d = { mode: 'air', feet: feet.pos, vel: V(0, -1, 20), hill, air: 1, tl: 9, since: 0 };
      } else if (s && scene === 'play' && s.ph === 'gate' && !s.jump) {
        j = { ph: 'ready', s: hill.lin * [0.2, 0.1, 0][s.gate], tuck: 0.15, tl: 9, x: 0, y: 0, vx: 0, vy: 0 };
        sk = poseJumper(j, hill, dt); d.mode = 'ready';
      } else if (live) {
        j = s.jump;
        sk = poseJumper(j, hill, dt);
        if (s.ph === 'judge' || s.ph === 'board' || scene === 'result') d.mode = 'judge';
        else if (j.ph === 'ready') d.mode = 'ready';
        else if (j.ph === 'slide') d.mode = 'slide';
        else if (j.ph === 'air') d.mode = 'air';
        else d.mode = 'land';
        if (s.replay && s.jump.frames.length > 4) {
          const rj = replayJump(s, s.replay.t);
          sk = poseJumper(rj, hill, dt); j = rj;
          d.mode = rj.ph === 'air' ? 'air' : rj.ph === 'slide' ? 'slide' : 'land';
        }
      } else {
        j = demoStep(dt, hill);
        sk = poseJumper(j, hill, dt);
        d.mode = 'title';
      }
      if (j) { d.vel = V(0, j.vy || 0, j.vx || 0); d.air = j.air || 0; d.tl = j.tl === undefined ? 9 : j.tl; d.since = j.contact && j.t ? clamp(j.t - j.contact.t, 0, 3) : 0; }
      d.feet = feet.pos;
      if (j && (j.ph === 'ready' || j.ph === 'slide')) { const rp = inrunAt(hill, Math.max(0, j.s - 6.5)); d.rear = V(0, rp.y + 0.1, rp.x); }
      if (!lab) A.h.update(dt);
      placeSkis(sk.skiVee || 0);
      if (s && s.events.length) { const last = s.events[s.events.length - 1]; if (last.id !== lastEvId) { lastEvId = last.id; if (last.type === 'judge') cheerHold = last.fall ? 0 : last.kind === 'telemark' ? 5 : 2.4; } }
    }
    cheerHold = Math.max(0, cheerHold - dt);
    if (world.crowd) world.crowd.update(dt, cheerHold > 0 ? 1 : 0.12);
    world.setWind(wind, tReal);
    if (world.gates && s && scene === 'play') world.gates.forEach((l, i) => l.material.color.set(i === s.gate ? 0x38e07a : 0x555555));
    stepSpray(dt);
    d.shot = G.mode === 'shot';
    const dr = director(d, aspect, tReal);
    if (lab && lab.cam) { dr.pos = V(...lab.cam); dr.look = V(...lab.look); dr.fov = lab.fov || 40; dr.shift = 0; }
    const kk = dt > 0 ? 1 - Math.exp(-dt / Math.max(0.04, dr.k)) : 0;
    if (!cam.init || camSnap > 0 || lab) { cam.pos.copy(dr.pos); cam.look.copy(dr.look); cam.fov = dr.fov; cam.init = true; camSnap = Math.max(0, camSnap - 1); }
    else { cam.pos.lerp(dr.pos, kk); cam.look.lerp(dr.look, kk); cam.fov = lerp(cam.fov, dr.fov, kk); }
    const c = stage.camera;
    if (Math.abs(c.fov - cam.fov) > 1e-3 || Math.abs(c.aspect - aspect) > 1e-4) { c.fov = cam.fov; c.aspect = aspect; c.updateProjectionMatrix(); }
    c.position.copy(cam.pos); c.lookAt(cam.look);
    if (dr.shift) { const r = V(1, 0, 0).applyQuaternion(c.quaternion); c.position.addScaledVector(r, dr.shift); c.lookAt(cam.look.clone().addScaledVector(r, dr.shift)); }
    stage.setShadowTarget(feet.pos.x, feet.pos.y, feet.pos.z);
    stage.update(dt, { renderNow: false });
    if (!P.noRender) { stage.render(); perfTick(); }
  }

  // dev: pose lab. P.setLab({ clip, time, pitch, roll, vee, cam:[x,y,z], look:[x,y,z], fov, hill }) or P.setLab(null)
  P.setLab = (o) => { P.lab = o ? { ...o } : null; camSnap = 2; };
  P.frame = frame; P.getA = () => A; P.cam = cam;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      frame(game.getState(), view);
    };
    return game;
  };
  return P;
}
