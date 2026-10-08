// 3D presenter: READS the simulation (game.getState().sim) and shows the glen, the athlete and the three events. It never writes back.
// The simulation owns every position and time (the pole's frames, the stone's flight, the weight's circle); the athlete's clips are scrubbed or
// retimed to agree with them. Cameras are a function of the live screen shape: portrait looks from behind and above, landscape from the side.
import { buildGlen } from './glen.js';
import { loadAthlete } from './athlete.js';
import { makeCaber, makeStone, makeWeight } from './props.js';
import { CABERS, WT, BAR_HEIGHTS } from '../src/physics.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 9 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.3; stage.camera.far = 420; stage.camera.fov = 44; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, ready: false, lost: false };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  stage.setLighting('day', { exposure: 0.92, hemi: 0.85, keyI: 2.9, sky: 0x9cc6ee, fog: 0xcfdde6 });
  stage._shadowOffset.set(-14, 22, -9);
  stage.lights.rim.intensity = 0.7;
  const glen = buildGlen(V3, stage);
  P.glen = glen;
  glen.clock.visible = false; glen.range.visible = false; glen.barRig.visible = false;

  // ---- props
  const cabers = CABERS.map((c) => { const m = makeCaber(THREE, { L: c.L, rSmall: 0.075 + (c.L - 5.2) * 0.01, rBig: 0.17 + (c.L - 5.2) * 0.02 }); m.visible = false; stage.add(m); return m; });
  const stone = makeStone(THREE); stone.visible = false; stage.add(stone);
  const weight = makeWeight(THREE); weight.visible = false; stage.add(weight);
  stage.add(weight.userData.chain); weight.userData.chain.visible = false;

  // ---- the athlete (loaded in the background; the picture works without it)
  let A = null;
  P.loading = loadAthlete(V3, { lod: quality === 'high' ? 0 : 1 }).then((a) => { A = a; stage.add(a.h); stage.track(a.h); a.h.setFacing(0); P.ready = true; stage.invalidate(); }).catch((e) => { console.warn('athlete failed to load', e); P.ready = true; });

  // ---- budget: the canvas fills the whole screen; on big screens the pixel ratio is lowered so the buffer stays about phone-sized
  const PIXELS = 1.9e6;
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

  // ---- helpers
  const sampleFrames = (fr, t) => {
    if (!fr.length) return null;
    if (fr.length < 2) return fr[0];
    const x = clamp(t, 0, fr[fr.length - 1].t) * 60, i = Math.min(fr.length - 2, Math.floor(x)), k = x - i;
    const a = fr[i], b = fr[i + 1];
    const o = {}; for (const key of Object.keys(a)) o[key] = typeof a[key] === 'number' ? lerp(a[key], b[key], k) : a[key];
    return o;
  };
  const dirOf = (psiDeg) => { const a = (psiDeg * Math.PI) / 180; return V(-Math.sin(a), 0, Math.cos(a)); };
  const placeRod = (mesh, S, axis) => { mesh.position.copy(S); mesh.quaternion.setFromUnitVectors(V(0, 1, 0), axis.clone().normalize()); };
  const reach = (h, S, axis, up = 0.1) => {
    const a = axis.clone().normalize();
    const base = S.clone().addScaledVector(a, up);
    h.setReach('L', base.clone().add(V(0.115, -0.03, 0)), { weight: 1, pole: base.clone().add(V(0.6, -0.15, -0.5)) });
    h.setReach('R', base.clone().add(V(-0.115, -0.03, 0)), { weight: 1, pole: base.clone().add(V(-0.6, -0.15, -0.5)) });
  };

  // ---- cameras. The director returns where the camera wants to be for this moment; the frame smooths towards it.
  const cam = { pos: V(-6, 3, -12), look: V(0, 3, 0), fov: 44, init: false };
  function director(d, aspect, tReal) {
    const land = aspect > 1.1;
    let pos, look, fov = 44, k = 0.32, shift = 0;
    const za = d.za || 0;
    const rp = () => clamp((d.replayT + 0.9) / (d.replayEnd + 0.9), 0, 1);
    if (d.mode === 'idle') {
      const a = -0.55 + Math.sin(tReal * 0.12) * 0.5;
      const R = land ? 10.5 : 12;
      pos = V(Math.sin(a) * R, land ? 2.2 : 2.4, -Math.cos(a) * R); look = V(0, land ? 3.3 : 3.0, 0.2); fov = land ? 34 : 44; shift = land ? 2.6 : 0; k = 0.6;
    } else if (d.mode === 'end') {
      const a = 0.35 + tReal * 0.12;
      pos = V(Math.sin(a) * 6.2, 1.5, Math.cos(a) * 6.2 + za); look = V(0, 1.1, za); fov = 40; shift = land ? 2.2 : 0; k = 0.7;
    } else if (d.mode === 'caber') {
      if (d.replay) {
        const u = rp(), c = V(0, 1.7, za + Math.max(2.2, d.landF * 0.65)), az = lerp(-1.45, -0.15, ease(u)), Rr = land ? 15 : 17;
        pos = V(Math.sin(az) * Rr, 3.2 + 2.5 * u, c.z - Math.cos(az) * Rr); look = c; fov = land ? 36 : 44; k = 0.2;
      } else if (d.ph === 'fly' || d.ph === 'judge') {
        const lz = za + 4 + Math.min(d.landF || 6, 10) * 0.35;
        if (land) { pos = V(-21, 6.8, za + 3.8 + (d.landF || 6) * 0.25); look = V(0, 2.4, lz - 1); fov = 42; } else { pos = V(-7, 6.8, za - 11); look = V(0, 2.6, lz); fov = 54; }
        k = 0.45;
      } else {
        if (land) { pos = V(-13.5, 3.3, za + 1.6); look = V(0, 3.4, za + 1.6); fov = 38; } else { pos = V(-5.6, 3.5, za - 12.5); look = V(0.2, 3.1, za + 0.4); fov = 44; }
        k = d.ph === 'run' ? 0.22 : 0.4;
      }
    } else if (d.mode === 'stone') {
      const zs = d.stoneZ || 0.35, zc = clamp(zs * 0.55 + 2.5, 3, 9);
      if (d.replay) {
        const u = rp(), az = lerp(-1.4, -0.5, ease(u)), Rr = land ? 14 : 16;
        pos = V(Math.sin(az) * Rr, 3 + 2 * u, zc - Math.cos(az) * Rr); look = V(0, 1.6, zc); fov = land ? 38 : 46; k = 0.2;
      } else if (d.ph === 'fly' || d.ph === 'judge') {
        if (land) { pos = V(-18, 4.2, zc); look = V(0, 1.7, zc); fov = 40; k = 0.35; } else { pos = V(-5.2, 4.2, zc - 9.5); look = V(0, 1.2, zc + 3.5); fov = 52; k = 0.35; }
      } else if (land) { pos = V(-8.2, 1.9, -0.6); look = V(0, 1.45, 1.0); fov = 40; k = 0.4; } else { pos = V(-3.8, 2.2, -6.0); look = V(0.2, 1.4, 0.9); fov = 46; k = 0.4; }
    } else if (d.mode === 'weight') {
      if (d.replay) {
        const u = rp(), az = lerp(-1.3, -0.45, ease(u)), Rr = land ? 15 : 17;
        pos = V(Math.sin(az) * Rr, 3.6, -1.6 - Math.cos(az) * Rr); look = V(0, 3.6, -1.6); fov = land ? 38 : 46; k = 0.2;
      } else if (land) { pos = V(-14.5, 3.8, -4.2); look = V(0, 3.4, -1.6); fov = 40; k = 0.4; } else { pos = V(-16, 4.8, -12.5); look = V(0, 3.4, -1.5); fov = 46; k = 0.4; }
    }
    return { pos, look, fov, k, shift };
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------
  let tReal = 0, lastNow = 0, cheerHold = 0, lastEvId = 0, barFall = 0;
  const flags = { heave: '', put: '', toss: '', cele: '' };
  function frame(G, view) {
    if (!P.ready || P.lost) return;
    const nowMs = performance.now(); let dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0; lastNow = nowMs;
    const frozen = !!(G.pauseMenu || (G.watch && G.watch.paused && G.mode === 'watch'));
    if (frozen) dt = 0;
    tReal += dt;
    const s = G.sim, scene = G.scene;
    stage.setVisible(true);
    const d = describe(G, s, scene);
    const w = canvas.clientWidth || 720, h = canvas.clientHeight || 1280, aspect = w / h;
    sizeBudget(w, h);
    for (const m of cabers) m.visible = false;
    stone.visible = false; weight.visible = false; weight.userData.chain.visible = false;
    glen.clock.visible = d.mode === 'caber' && d.clock; glen.range.visible = d.mode === 'stone'; glen.barRig.visible = d.mode === 'weight';
    if (A) poseAthlete(d, s, dt);
    if (s && s.events.length) { const last = s.events[s.events.length - 1]; if (last.id !== lastEvId) { lastEvId = last.id; if (last.type === 'judge') cheerHold = last.pts >= 70 ? 4 : last.pts > 0 ? 1.6 : 0; } }
    cheerHold = Math.max(0, cheerHold - dt);
    glen.spectators.update(dt, d.mode === 'end' || cheerHold > 0 ? 1 : 0.1);
    const dr = director(d, aspect, tReal);
    const kk = dt > 0 ? 1 - Math.exp(-dt / Math.max(0.05, dr.k)) : 0;
    if (!cam.init) { cam.pos.copy(dr.pos); cam.look.copy(dr.look); cam.fov = dr.fov; cam.init = true; } else { cam.pos.lerp(dr.pos, kk); cam.look.lerp(dr.look, kk); cam.fov = lerp(cam.fov, dr.fov, kk); }
    const c = stage.camera;
    if (Math.abs(c.fov - cam.fov) > 1e-3 || Math.abs(c.aspect - aspect) > 1e-4) { c.fov = cam.fov; c.aspect = aspect; c.updateProjectionMatrix(); }
    c.position.copy(cam.pos); c.lookAt(cam.look);
    if (dr.shift) { const r = V(1, 0, 0).applyQuaternion(c.quaternion); c.position.addScaledVector(r, dr.shift); c.lookAt(cam.look.clone().addScaledVector(r, dr.shift)); }
    stage.setShadowTarget(0, 0, d.shadowZ || 0);
    stage.update(dt, { renderNow: false });
    if (!P.noRender) { stage.render(); perfTick(); }
  }

  // what is going on, in the presenter's terms
  function describe(G, s, scene) {
    const d = { mode: 'idle', ph: '', za: 0, clock: false };
    if (scene === 'result' && s) { d.mode = 'end'; d.za = s.cab && s.cab.xRel ? s.cab.xRel : 0; return d; }
    if (!s || !(scene === 'play' || scene === 'rules' || scene === 'howto' || scene === 'about')) return d;
    d.ph = s.ph; d.replay = !!s.replay; if (s.replay) { d.replayT = s.replay.t; d.replayEnd = s.replay.end; }
    if (s.event === 'caber') {
      d.mode = 'caber'; const c = s.cab;
      d.za = !c || s.ph === 'choose' ? 0 : s.ph === 'fly' || s.ph === 'judge' ? (c.xRel ?? c.x) : c.x; d.clock = !!c && (s.ph === 'heave' || s.ph === 'fly' || s.ph === 'judge'); d.landF = c && c.res ? c.res.landF : 6;
      d.shadowZ = d.za + 2;
    } else if (s.event === 'stone') {
      d.mode = 'stone'; const k = s.st;
      d.stoneZ = k && k.fly && (s.ph === 'fly' || s.replay) ? sampleFrames(k.fly.frames, s.replay ? s.replay.t : k.flyT).f : (k && k.fly ? k.fly.dist + 0.5 : 0.35); d.shadowZ = 3;
    } else { d.mode = 'weight'; d.shadowZ = -1; }
    return d;
  }

  // ---- athlete and props, per event --------------------------------------------------------------------------------
  const LOCO = { idle: 'a_carry', walk: 'a_walk', jog: 'a_jog', sprint: 'a_sprint' };
  function setBase(h, name, opts = {}) { const cur = h.layers.base.current; if (!cur || cur.clip.name !== name || cur.target === 0) h.play(name, { fade: 0.2, ...opts }); return h.layers.base.current; }
  function scrub(h, name, time) { const tr = setBase(h, name, { fade: 0.12, loop: false }); if (tr) { tr.speed = 0; tr.time = time; } }

  function poseAthlete(d, s, dt) {
    const h = A.h;
    h.setReach('L', null); h.setReach('R', null);
    const live = s && (d.mode === 'caber' || d.mode === 'stone' || d.mode === 'weight');
    if (d.mode === 'end') { setBase(h, 'celebrate_2', { loop: true }); h.root.position.set(0, 0, d.za); h.setFacing(0.4); return; }
    if (!live) {
      setBase(h, 'a_carry', { loop: true });
      h.root.position.set(0, 0, 0); h.setFacing(0);
      const C = cabers[1]; C.visible = true;
      const S = V(0, 1.12, 0.45), ax = V(Math.sin(Math.sin(tReal * 0.6) * 0.03), 1, 0.06 + Math.sin(tReal * 0.8) * 0.03);
      placeRod(C, S, ax); reach(h, S, ax);
      return;
    }
    if (d.mode === 'caber') return poseCaber(d, s, dt);
    if (d.mode === 'stone') return poseStone(d, s, dt);
    return poseWeight(d, s, dt);
  }

  function afterThrow(h, dt, key, good) {
    if (flags.cele !== key) { flags.cele = key; A.afterT = 1.2; A.afterGood = good; }
    if (A.afterT !== undefined) { A.afterT -= dt; if (A.afterT <= 0) { h.crossfade(A.afterGood ? 'celebrate_2' : 'idle_relaxed', 0.4, { loop: true }); A.afterT = undefined; } }
  }

  function poseCaber(d, s, dt) {
    const h = A.h, c = s.cab, ph = s.ph;
    h.setFacing(0);
    const idx = c ? CABERS.indexOf(c.cab) : Math.min(2, s.attempt);
    const C = cabers[Math.max(0, idx)]; C.visible = true;
    const cab = c ? c.cab : CABERS[Math.max(0, idx)];
    const key = `${s.attempt}:${ph}`;
    if (ph === 'choose' || !c) {
      setBase(h, 'a_carry', { loop: true }); h.root.position.set(0, 0, 0); flags.heave = '';
      const S = V(0, 1.12, 0.45), ax = V(0.0, 1, 0.07); placeRod(C, S, ax); reach(h, S, ax); return;
    }
    const lean = V(c.bz, 1, c.bx);
    if (ph === 'lift') {
      setBase(h, 'a_carry', { loop: true }); h.root.position.set(0, 0, 0); flags.heave = '';
      let ax = lean, S = V(0, 1.12, 0.45);
      if (c.dropT > 0) { const u = 1 - c.dropT / 1.4; S = V(0, lerp(1.12, 0.12, ease(u * 1.6)), 0.45 + 1.8 * ease(u)); ax = V(0, Math.cos(1.2 * ease(u)), Math.sin(1.2 * ease(u))); placeRod(C, S, ax); return; }
      placeRod(C, S, ax); reach(h, S, ax); return;
    }
    if (ph === 'run') {
      h.locomote(c.v, { set: LOCO });
      h.root.position.set(0, 0, c.x); flags.heave = '';
      const S = V(0, 1.14, c.x + 0.45), ax = lean;
      placeRod(C, S, ax); reach(h, S, ax); return;
    }
    if (ph === 'heave') {
      h.root.position.set(0, 0, c.x); flags.heave = '';
      const tr = setBase(h, 'a_heave', { loop: false }); if (tr) { tr.speed = 0; tr.time = clamp(c.sweepT > 0 ? c.tau : 0, 0, 1) * 0.5; }
      const th = 0.04 + 0.22 * c.tau + 0.8 * c.bx, crouch = ease(clamp(c.tau, 0, 1));
      const S = V(0, 1.12 - 0.22 * crouch, c.x + 0.45), ax = V(c.bz, Math.cos(th), Math.sin(th));
      placeRod(C, S, ax); reach(h, S, ax); return;
    }
    // fly / judge
    const za = c.xRel ?? c.x;
    h.root.position.set(0, 0, za);
    const res = c.res;
    if (!res) { placeRod(C, V(0, 0.12, za + 2.2), V(0, 0.2, 1)); afterThrow(h, dt, key, false); return; }
    const t = s.replay ? s.replay.t : c.flyT;
    if (flags.heave !== key) { flags.heave = key; h.play('a_heave', { fade: 0.05, loop: false, startTime: 0.5, speed: 1.35 }); }
    const tv = Math.max(0, t - 0.12);
    const fr = sampleFrames(res.frames, tv) || res.frames[0];
    const psiP = res.psiPlane;
    const u = res.tEnd > res.tFirst ? ease((tv - res.tFirst) / Math.max(0.2, res.tEnd - res.tFirst)) : 1;
    const psi = tv < res.tFirst ? psiP : psiP + (res.psi - psiP) * u;
    const dir = dirOf(psi);
    const fs = fr.f - cab.d * Math.sin(fr.th), ys = fr.y - cab.d * Math.cos(fr.th);
    const S = V(dir.x * fs, ys, za + dir.z * fs);
    const ax = V(dir.x * Math.sin(fr.th), Math.cos(fr.th), dir.z * Math.sin(fr.th));
    placeRod(C, S, ax);
    if (t < 0.12) reach(h, S, ax);
    glen.clock.position.set(0, 0, za);
    glen.wedge.visible = (ph === 'judge' || tv > res.tEnd - 0.05) && res.turned; glen.wedgeRoot.rotation.y = -(res.psi * Math.PI) / 180;
    if (ph === 'judge') afterThrow(h, dt, key, s.res && s.res.pts >= 60); else A.afterT = undefined;
  }

  function poseStone(d, s, dt) {
    const h = A.h, k = s.st, ph = s.ph;
    h.root.position.set(0, 0, -0.45); h.setFacing(0.0);
    stone.visible = true;
    if (!k) { scrub(h, 'a_put', 0); stone.position.set(-0.16, 1.5, 0.15); return; }
    const key = `${s.attempt}:${ph}`;
    const inHand = ph === 'angle' || ph === 'wind' || (ph === 'fly' && (!k.fly || k.flyT < 0));
    if (ph === 'angle' || ph === 'choose') scrub(h, 'a_put', 0);
    else if (ph === 'wind') scrub(h, 'a_put', k.wind ? 0.4 * clamp(k.windT / 1.2, 0, 1.15) : 0.02);
    else if (ph === 'fly') { if (flags.put !== key) { flags.put = key; if (k.fly) h.play('a_put', { fade: 0.05, loop: false, startTime: 0.4, speed: 1.22 }); else h.crossfade('fall', 0.15, { loop: false }); } }
    else if (ph === 'judge') afterThrow(h, dt, key, s.res && s.res.pts >= 60);
    if (inHand) {
      h.model.updateMatrixWorld(true);
      const neck = h.bones.Bip01_Neck.getWorldPosition(V());
      h.setReach('R', neck.add(V(-0.1, -0.1, 0.13)), { weight: 0.9 });
      stone.position.copy(h.bones.Bip01_R_Hand.getWorldPosition(V())).add(V(0, 0.07, 0.02));
    } else if (k.fly) {
      const t = s.replay ? s.replay.t : k.flyT;
      const q = sampleFrames(k.fly.frames, Math.max(0, t));
      stone.position.set(-0.17, q.y, q.f);
    } else stone.visible = false;
  }

  function poseWeight(d, s, dt) {
    const h = A.h, w = s.wt, ph = s.ph;
    h.root.position.set(0, 0, 0); h.setFacing(0);
    weight.visible = true;
    const rig = glen.barRig, H = w ? w.bar : BAR_HEIGHTS[1];
    rig.position.set(0, 0, WT.barF);
    rig.userData.bar.position.set(0, H, 0); rig.userData.rib.position.set(0, H + 0.01, 0);
    rig.userData.pegs.forEach((p, i) => { p.position.set(i % 2 ? 2.6 : -2.6, 1.6 + Math.floor(i / 2) * 1.5, 0); });
    if (!w) { setBase(h, 'a_spin', { loop: true }); weight.position.set(-0.28, 0.4, 0); return; }
    const key = `${s.attempt}:${ph}`;
    const RX = -0.3;
    const pivot = V(RX, WT.pivotY, 0);
    let wp, flying = false;
    if (ph === 'fly' || (ph === 'judge' && w.fly)) {
      const t = s.replay ? s.replay.t : w.flyT;
      const q = sampleFrames(w.fly.frames, Math.max(0, t));
      wp = V(RX, q.y, q.f); flying = true;
      if (flags.toss !== key) { flags.toss = key; h.play('a_toss', { fade: 0.05, loop: false, speed: 1.2 }); }
      if (ph === 'judge') afterThrow(h, dt, key, s.res && s.res.cleared); else A.afterT = undefined;
      if (ph === 'judge' && s.res && s.res.kind === 'knock') { barFall = Math.min(1, barFall + dt * 2.2); const by = H - barFall * (H - 0.1); rig.userData.bar.position.y = by; rig.userData.rib.position.y = by; rig.userData.bar.rotation.x = barFall * 0.5; } else { barFall = 0; rig.userData.bar.rotation.x = 0; }
    } else {
      setBase(h, 'a_spin', { loop: true });
      wp = V(RX, WT.pivotY - WT.R * Math.cos(w.a), -WT.R * Math.sin(w.a));
      const dirv = wp.clone().sub(pivot).normalize();
      h.setReach('R', pivot.clone().addScaledVector(dirv, 0.5), { weight: 1, pole: V(-0.7, 1.3, -0.1) });
    }
    weight.position.copy(wp);
    const toHand = flying ? V(0, 1, 0) : pivot.clone().sub(wp).normalize();
    weight.quaternion.setFromUnitVectors(V(0, 1, 0), toHand);
    const chain = weight.userData.chain; chain.visible = !flying;
    if (!flying) {
      const dirv = wp.clone().sub(pivot).normalize();
      const ringTop = wp.clone().addScaledVector(toHand, 0.2), hand = pivot.clone().addScaledVector(dirv, 0.5);
      chain.position.copy(ringTop.clone().add(hand).multiplyScalar(0.5)); chain.scale.set(1, ringTop.distanceTo(hand), 1); chain.quaternion.setFromUnitVectors(V(0, 1, 0), ringTop.clone().sub(hand).normalize());
    }
  }

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
