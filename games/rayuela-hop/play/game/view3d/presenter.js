// 3D presenter: READS the engine state (game.getState().sim) and draws the courtyard, the chalk course, two real-looking players, the tejo, the
// closing ring on the next square and the toss reticle. It never writes back. The engine owns every time; motion.js / pose.js turn those times
// into positions and poses. Camera: a high overview for the toss, a low chase camera behind the hopper for the run (display only, smoothed).
import { Actor } from './actor.js';
import { hopperPose } from './pose.js';
import { buildCourtyard, ringTexture, glowTexture, skyTexture } from './scene.js';
import { getCourse } from '../src/courses.js';
import { hopperAt, tejoAt, ringTarget } from '../src/motion.js';
import { reticle } from '../src/sim.js';
import { STEP, RING_DUR, TIMING, AIM_RANGE } from '../src/consts.js';
import { scr } from '../src/layout.js';

const LIB = '../vendor3d/index.js';
const KIT = [
  { top: '#e2503c', bottoms: '#2d5a8a', socks: '#fff3d6', trim: '#fff3d6', shoes: '#fff3d6' },
  { top: '#1f9d8f', bottoms: '#f2c14e', socks: '#fff3d6', trim: '#ffd98a', shoes: '#fff3d6' },
];
const LOOKS = {
  f: { character: 'athlete_f', scale: 0.8, skin: 'brown', hair: 'black', label: 'girl' },
  m: { character: 'athlete_m', scale: 0.9, skin: 'tan', hair: 'brown', label: 'boy' },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const lerpA = (a, b, u) => a + angDiff(a, b) * u;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  // touch devices (phones, tablets) default to the medium tier: a steady frame rate matters more than the last bit of shadow detail
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak || touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 3 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.camera.near = 0.2; stage.camera.far = 90; stage.camera.fov = 48; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 0.98, hemi: 0.95, keyI: 2.3 });
  stage.scene.background = skyTexture();
  stage.scene.fog = null;
  const yard = buildCourtyard(stage);
  yard.setCourse('classic');
  const blobs = stage.enableBlobShadows ? stage.enableBlobShadows(3, { radius: 0.38, opacity: 0.85 }) : null;

  // ---- overlay meshes: highlight under the next square(s), the closing ring, the toss reticle, the tejo, dust ---------------------------------
  const ringTex = ringTexture(), glowTex = glowTexture();
  const mkPlane = (tex, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex || null, color, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 5; stage.add(m); return m;
  };
  const hi = [mkPlane(null, 0xffc94d), mkPlane(null, 0xffc94d)];
  const ringM = mkPlane(ringTex, 0xffffff);
  const retV = mkPlane(null, 0xffe066), retH = mkPlane(null, 0xffe066), retDot = mkPlane(ringTex, 0xffffff);
  const targetGlow = mkPlane(null, 0x7fe8d6);
  const dust = []; for (let i = 0; i < 8; i++) dust.push({ m: mkPlane(glowTex, 0xfff4dc), t: -1, x: 0, z: 0, big: 1 });
  const tejoMats = [new THREE.MeshStandardMaterial({ color: '#d9552f', roughness: 0.6, metalness: 0.1 }), new THREE.MeshStandardMaterial({ color: '#1f9d8f', roughness: 0.6, metalness: 0.1 })];
  const tejo = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.026, 20), tejoMats[0]); tejo.castShadow = true; tejo.visible = false; stage.add(tejo);
  const tejoRim = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.006, 6, 24), new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.5 })); tejoRim.rotation.x = Math.PI / 2; tejo.add(tejoRim);

  const P = { stage, THREE, chars: [], ready: false, lost: false, idleT: 0, overlay: { head: null, tejo: null, hopper: null, next: null }, looks: ['f', 'm'] };
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; P.snapCam = true; P.dim = undefined; P.restored = (P.restored | 0) + 1; stage.resize(); stage.invalidate(); });

  async function build(look0) {
    P.ready = false;
    for (const c of P.chars) stage.remove(c.h);
    P.chars = [];
    const l0 = look0 === 'm' ? 'm' : 'f', l1 = l0 === 'm' ? 'f' : 'm';
    for (let i = 0; i < 2; i++) {
      const L = LOOKS[i === 0 ? l0 : l1];
      const h = await loadHuman({ character: L.character, kit: KIT[i], skin: L.skin, hair: i === 0 ? L.hair : (L.hair === 'black' ? 'brown' : 'black'), scale: L.scale, legs: 'shorts' });
      h.groundClamp = 'off'; h.footPlanting = false;
      h.play('idle_relaxed', { fade: 0 });
      if (quality === 'low') h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      stage.add(h);
      P.chars.push({ h, a: new Actor(h), k: L.scale, mode: 'clip', clip: 'idle_relaxed', x: 0, z: 0, yaw: 0, ph: i * 1.9, look: L.label, placed: false });
    }
    P.looks = [l0, l1];
    lastTurn = -1; hold.first = true;
    P.ready = true;
    stage.invalidate();
  }
  P.build = build;

  // adaptive quality
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false; else stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        stage.invalidate();
      }
    }
  }

  // ---- camera -----------------------------------------------------------------------------------------------------------------------------------
  const cam = { pos: V(0, 5, -5), look: V(0, 0, 0), fov: 48, init: false, key: '' };
  const proj = V();
  const map = { cw: 720, ch: 1280, sc: 1, ox: 0, oy: 0 };
  const project = (v) => { proj.copy(v).project(stage.camera); return { x: ((proj.x * 0.5 + 0.5) * map.cw - map.ox) / map.sc, y: ((-proj.y * 0.5 + 0.5) * map.ch - map.oy) / map.sc }; };
  const tmpA = V(), tmpB = V();
  // box (in NDC, y down) of world points as seen by the camera cv
  function boxAt(cv, pts, aspect) {
    cv.clearViewOffset(); cv.aspect = aspect; cv.updateProjectionMatrix(); cv.updateMatrixWorld(true);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { tmpA.copy(p).project(cv); x0 = Math.min(x0, tmpA.x); x1 = Math.max(x1, tmpA.x); y0 = Math.min(y0, tmpA.y); y1 = Math.max(y1, tmpA.y); }
    return { x0, y0: -y1, x1, y1: -y0 };
  }
  const bandNdc = (band, vw, vh, cw, ch) => {
    const sc = Math.min(cw / vw, ch / vh), ox = (cw - vw * sc) / 2, oy = (ch - vh * sc) / 2;
    return { sc, ox, oy, x0: ((ox + band.x * sc) / cw) * 2 - 1, x1: ((ox + (band.x + band.w) * sc) / cw) * 2 - 1, y0: ((oy + band.y * sc) / ch) * 2 - 1, y1: ((oy + (band.y + band.h) * sc) / ch) * 2 - 1 };
  };
  function overviewCam(C, band, vw, vh, cw, ch) {
    // fit the whole chalk course (and the start area) inside the band: bisection on the distance along a fixed direction
    const b = C.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const long = (b.z1 - b.z0) > (b.x1 - b.x0) * 1.5;
    const side = scr.land && long;                       // landscape + a long course: look along +x so the course runs left to right
    const el = side ? 56 : (long ? 66 : 58), az = side ? 90 : 26;
    const dir = V(-Math.sin(az * Math.PI / 180) * Math.cos(el * Math.PI / 180), Math.sin(el * Math.PI / 180), -Math.cos(az * Math.PI / 180) * Math.cos(el * Math.PI / 180)).normalize();
    const pts = [];
    for (const x of [b.x0 - 0.1, b.x1 + 0.1]) for (const z of [b.z0 - 0.05, b.z1 + 0.1]) { pts.push(V(x, 0, z)); pts.push(V(x, 0.8, z)); }
    const tgt = V(cx, 0, cz), bn = bandNdc(band, vw, vh, cw, ch);
    Object.assign(map, { cw, ch, sc: bn.sc, ox: bn.ox, oy: bn.oy });
    const c = stage.camera; c.fov = 40; const aspect = cw / ch;
    const bw = (bn.x1 - bn.x0) * 0.95, bh = (bn.y1 - bn.y0) * 0.95;
    let lo = 1.5, hi2 = 60;
    for (let k = 0; k < 26; k++) {
      const d = (lo + hi2) / 2;
      c.position.copy(tgt).addScaledVector(dir, d); c.lookAt(tgt); c.updateMatrixWorld(true);
      const bb = boxAt(c, pts, aspect);
      if (bb.x1 - bb.x0 <= bw && bb.y1 - bb.y0 <= bh) hi2 = d; else lo = d;
    }
    return { pos: tgt.clone().addScaledVector(dir, hi2), look: tgt, fov: 40, bn, pts, fit: true };
  }
  function followCam(hp, yaw, band, vw, vh, cw, ch) {
    const fov = 50, aspect = cw / ch, bn = bandNdc(band, vw, vh, cw, ch);
    const fr = clamp((band.w * bn.sc) / cw, 0.3, 1);
    const half = 1.05;                                          // wanted half-width of the course around the hopper (m)
    let d = (half / fr) / (Math.tan(fov * Math.PI / 360) * aspect);
    const frh = clamp((band.h * bn.sc) / ch, 0.15, 1);
    const dv = ((scr.land ? 1.3 : 1.7) / frh) / (2 * Math.tan(fov * Math.PI / 360) * Math.cos(36 * Math.PI / 180));
    d = clamp(Math.max(d, dv), scr.land ? 2.6 : 3.4, 14);
    const el = 36 * Math.PI / 180;
    const back = V(-Math.sin(yaw), 0, -Math.cos(yaw)), f = V(Math.sin(yaw), 0, Math.cos(yaw));
    const look = V(hp.x, 0.28, hp.z).addScaledVector(f, 0.55);
    const pos = look.clone().addScaledVector(back, d * Math.cos(el)).add(V(0, d * Math.sin(el), 0));
    return { pos, look, fov, fit: false, bn, focus: V(hp.x, 0.5, hp.z).addScaledVector(f, 0.2) };
  }
  function titleCam(C, band, vw, vh, cw, ch, sp) {
    // both players, feet to head, fitted into the band the menu leaves free; a gentle three-quarter view from low down
    const bn = bandNdc(band, vw, vh, cw, ch);
    Object.assign(map, { cw, ch, sc: bn.sc, ox: bn.ox, oy: bn.oy });
    const az = -24 * Math.PI / 180 + C.stops[0].yaw, el = 9 * Math.PI / 180;
    const dir = V(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    const pts = [];
    for (const p of [sp.start, sp.side]) for (const dx of [-0.3, 0.3]) { pts.push(V(p.x + dx, 0, p.z)); pts.push(V(p.x + dx, 1.85, p.z)); }
    const tgt = V((sp.start.x + sp.side.x) / 2, 0.85, (sp.start.z + sp.side.z) / 2);
    const c = stage.camera; c.fov = 40; const aspect = cw / ch;
    const bw = (bn.x1 - bn.x0) * 0.9, bh = (bn.y1 - bn.y0) * 0.9;
    let lo = 1.5, hi2 = 40;
    for (let k = 0; k < 24; k++) {
      const d = (lo + hi2) / 2;
      c.position.copy(tgt).addScaledVector(dir, d); c.lookAt(tgt); c.updateMatrixWorld(true);
      const bb = boxAt(c, pts, aspect);
      if (bb.x1 - bb.x0 <= bw && bb.y1 - bb.y0 <= bh) hi2 = d; else lo = d;
    }
    return { pos: tgt.clone().addScaledVector(dir, hi2), look: tgt, fov: 40, bn, pts, fit: true };
  }

  // ---- per-frame --------------------------------------------------------------------------------------------------------------------------------
  let lastSimT = null, updAt = 0, lastNow = 0, building = false, lastTurn = -1, lastTD = 0;
  const hold = { first: true, t0: 0, from: null };
  const spots = (C) => {
    const y0 = C.stops[0].yaw, f = [Math.sin(y0), Math.cos(y0)], l = [Math.cos(y0), -Math.sin(y0)];
    return {
      start: { x: C.start.x, z: C.start.z, yaw: y0 },
      side: { x: C.start.x - l[0] * 1.5 - f[0] * 0.35, z: C.start.z - l[1] * 1.5 - f[1] * 0.35, yaw: y0 + 0.5 },
    };
  };
  function puff(x, z, big = 1) { const d = dust.find((q) => q.t < 0) || dust[0]; d.t = 0; d.x = x; d.z = z; d.big = big; d.m.visible = true; }

  function frame(game, view, nowOverride) {
    if (!P.ready || P.lost) return;
    const G = game.getState();
    const s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    const C = getCourse(s.course);
    yard.setCourse(C.id);
    const look0 = (G.look && G.look.hero) === 'm' ? 'm' : 'f';
    if (look0 !== P.looks[0] && !building) { building = true; build(look0).finally(() => { building = false; }); return; }
    stage.setVisible(true);
    const dim = G.scene === 'play' || G.scene === 'result' || G.scene === 'title' || G.scene === 'learn' || G.scene === 'lesson' || G.scene === 'lessonresult' ? '' : 'brightness(0.62) saturate(0.9)';
    const now = nowOverride ?? globalThis.performance.now();
    const realDt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    P.idleT += realDt;
    if (lastSimT === null || s.t !== lastSimT) { lastSimT = s.t; updAt = now; }
    const adv = (now - updAt) < 45;
    const alpha = adv ? Math.min(1, (now - updAt) / (STEP * 1000)) : 0;
    const tD = P.fixedT !== undefined ? P.fixedT : s.t + alpha * STEP;
    P.tD = tD;
    const T = s.turn;
    const sp = spots(C);
    const cur = s.cur;
    const hc = P.chars[cur % 2], wc = P.chars[(cur + 1) % 2];

    // a new turn: the new hopper walks to the start line, the other one to the side (the first turn just places them)
    if (T && T.id !== lastTurn) {
      lastTurn = T.id;
      const first = !hc.placed || !wc.placed;
      hold.from = { h: { x: hc.x, z: hc.z, yaw: hc.yaw }, w: { x: wc.x, z: wc.z, yaw: wc.yaw } };
      hold.t0 = now; hold.first = first || (Math.hypot(hc.x - sp.start.x, hc.z - sp.start.z) < 0.05 && Math.hypot(wc.x - sp.side.x, wc.z - sp.side.z) < 0.05);
      if (first) { hc.x = sp.start.x; hc.z = sp.start.z; hc.yaw = sp.start.yaw; wc.x = sp.side.x; wc.z = sp.side.z; wc.yaw = sp.side.yaw; hc.placed = wc.placed = true; }
    }
    const H = hopperAt(s, C, tD);
    const introPhase = s.phase === 'intro' || s.phase === 'hold';
    const walkU = clamp(((now - hold.t0) / 1000) / 1.1, 0, 1);
    const walking = introPhase && !hold.first && walkU < 1;
    if (walking) {
      const u = smooth(walkU);
      for (const [c, f0, to] of [[hc, hold.from.h, sp.start], [wc, hold.from.w, sp.side]]) {
        const dx = to.x - f0.x, dz = to.z - f0.z, heading = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : f0.yaw;
        c.x = lerp(f0.x, to.x, u); c.z = lerp(f0.z, to.z, u);
        c.yaw = walkU < 0.8 ? heading : lerpA(heading, to.yaw, smooth((walkU - 0.8) / 0.2));
      }
    } else if (introPhase) {
      hc.x = sp.start.x; hc.z = sp.start.z; hc.yaw = sp.start.yaw; wc.x = sp.side.x; wc.z = sp.side.z; wc.yaw = sp.side.yaw;
    }
    hc.walking = walking; wc.walking = walking;

    P.chars.forEach((c) => {
      const isHopper = c === hc, h = c.h;
      if (isHopper && !walking) {
        if (c.mode !== 'actor') { c.mode = 'actor'; h.play('ready_stance', { fade: 0 }); }
        const st0 = introPhase ? { ...H, x: c.x, z: c.z, yaw: c.yaw } : H;
        if (!introPhase) { c.x = H.x; c.z = H.z; c.yaw = H.yaw; }
        h.setPosition(0, 0, 0); h.setFacing(0); h.update(realDt);
        const tj = tejoAt(s, C, tD);
        const running = s.phase === 'count' || s.phase === 'hop' || s.phase === 'foul' || s.phase === 'clean';
        const lookT = T && T.cell >= 0 && !running ? V(C.cells[T.cell].x, 0.05, C.cells[T.cell].z)
          : H.next ? V(H.next.pos.x, 0.0, H.next.pos.z) : V(c.x + Math.sin(c.yaw) * 2, 0.4, c.z + Math.cos(c.yaw) * 2);
        const tossStage = s.phase === 'aimX' || s.phase === 'aimZ' || s.phase === 'aimLock' || s.phase === 'flight' || s.phase === 'landed' || s.phase === 'tossEnd';
        const pose = hopperPose({ H: st0, A: c.a, k: c.k, ti: P.idleT, ph: c.ph, tejo: tj.vis && !tj.hand ? V(tj.x, tj.y, tj.z) : null, look: lookT, tD, stage: tossStage ? 'toss' : 'run' });
        smoothTargets(c, pose, realDt);
        c.a.apply(pose, realDt);
        h.setFingers('L', 'relaxed'); h.setFingers('R', tossStage ? 'ballGrip' : 'relaxed');
      } else {
        const want = c.walking ? 'walk' : (isHopper ? 'idle_relaxed' : watcherClip(s, T));
        if (c.mode !== 'clip') { c.mode = 'clip'; c.clip = ''; }
        if (c.clip !== want) { c.clip = want; h.play(want, { fade: 0.18, loop: true }); }
        if (!isHopper && !c.walking) {
          const hp = hc, want2 = Math.atan2(hp.x - c.x, hp.z - c.z);
          c.yaw += angDiff(c.yaw, want2) * Math.min(1, realDt * 3);
        }
        h.setPosition(c.x, 0, c.z); h.setFacing(c.yaw);
        h.update(realDt);
      }
    });
    const heads = P.chars.map((c) => c.h.bonePosition('Head'));

    // ---- tejo
    const tj = tejoAt(s, C, tD);
    if (tj.vis) {
      tejo.visible = true; tejo.material = tejoMats[cur % 2];
      if (tj.hand) { const hp = hc.h.bonePosition('R_Hand'); tejo.position.copy(hp).add(V(0, 0.02, 0)); tejo.rotation.set(0, 0, 0); }
      else { tejo.position.set(tj.x, tj.y, tj.z); tejo.rotation.set((tj.spin || 0) * 0.3, tj.spin || 0, (tj.spin || 0) * 0.2); }
    } else tejo.visible = false;

    // ---- overlays
    const hl = (m, cell, col, a) => { m.visible = a > 0.01; if (!m.visible) return; m.position.set(cell.x, 0.012, cell.z); m.rotation.set(-Math.PI / 2, 0, -cell.yaw); m.scale.set(cell.w * 0.96, cell.d * 0.96, 1); m.material.color.set(col); m.material.opacity = a; };
    hi[0].visible = false; hi[1].visible = false; ringM.visible = false; retV.visible = false; retH.visible = false; retDot.visible = false; targetGlow.visible = false;
    const pulse = 0.5 + 0.5 * Math.sin(P.idleT * 5);
    const st = ringTarget(s, tD);
    const tm = TIMING[s.cfg.timing];
    if (st && T) {
      const cells = [];
      if (st.k === 'one') cells.push(C.cells[C.stops[st.stop].cells[0]]);
      else if (st.k === 'open') cells.push(C.cells[C.stops[st.stop].cells.find((id) => C.cells[id].side === st.side)]);
      else if (st.k === 'both' || st.k === 'sky') for (const id of C.stops[st.stop].cells) cells.push(C.cells[id]);
      cells.forEach((cell, i2) => hl(hi[i2], cell, 0xffc94d, 0.2 + 0.12 * pulse));
      const dtb = st.t - tD, p = clamp(dtb / RING_DUR, -0.3, 1);
      ringM.visible = true;
      const near = Math.abs(dtb) <= tm.perfect ? 0x7fe8d6 : Math.abs(dtb) <= tm.ok ? 0xffe9a0 : 0xffffff;
      if (st.k === 'pick') { const mk = T.marker; ringM.position.set(mk.x, 0.02, mk.z); const r = lerp(0.17, 0.62, Math.max(0, p)); ringM.scale.set(r, r, 1); }
      else if (st.k === 'exit') { ringM.position.set(st.pos.x, 0.02, st.pos.z); const r = lerp(0.3, 0.9, Math.max(0, p)); ringM.scale.set(r, r, 1); }
      else { ringM.position.set(st.pos.x, 0.02, st.pos.z); const rt = st.k === 'both' || st.k === 'sky' ? 0.3 : 0.17, r = lerp(rt, rt + 0.62, Math.max(0, p)); ringM.scale.set(r, r, 1); }
      ringM.material.opacity = clamp(0.35 + 0.65 * (1 - Math.max(0, p)), 0.35, 1); ringM.material.color.set(near);
    }
    if (T && T.route.length && (s.phase === 'hop' || s.phase === 'count' || s.phase === 'foul' || s.phase === 'clean')) {
      for (const r of T.route) if (r.t > lastTD && r.t <= tD && r.k !== 'pick') puff(r.pos.x, r.pos.z, r.k === 'both' || r.k === 'sky' ? 1.3 : 1);
    }
    lastTD = tD;
    for (const d of dust) {
      if (d.t < 0) { d.m.visible = false; continue; }
      d.t += realDt; const u = d.t / 0.55;
      if (u >= 1) { d.t = -1; d.m.visible = false; continue; }
      d.m.visible = true; d.m.position.set(d.x, 0.04, d.z); const sc = (0.25 + 0.55 * u) * d.big; d.m.scale.set(sc, sc, 1); d.m.material.opacity = 0.55 * (1 - u);
    }
    if (T && T.cell >= 0 && (s.phase === 'aimX' || s.phase === 'aimLock' || s.phase === 'aimZ')) {
      const cell = C.cells[T.cell], rt = reticle(s);
      targetGlow.visible = true; targetGlow.position.set(cell.x, 0.011, cell.z); targetGlow.rotation.set(-Math.PI / 2, 0, -cell.yaw); targetGlow.scale.set(cell.w * 0.97, cell.d * 0.97, 1); targetGlow.material.opacity = 0.2 + 0.16 * pulse;
      const loc = (lx, lz) => ({ x: cell.x + Math.cos(cell.yaw) * lx + Math.sin(cell.yaw) * lz, z: cell.z - Math.sin(cell.yaw) * lx + Math.cos(cell.yaw) * lz });
      const mid = loc(rt.x, 0);
      retV.visible = true; retV.position.set(mid.x, 0.02, mid.z); retV.rotation.set(-Math.PI / 2, 0, -cell.yaw); retV.scale.set(0.05, AIM_RANGE.z * 2 + 0.4, 1); retV.material.opacity = 0.95; retV.material.color.set(rt.lockedX ? 0x4de8c8 : 0xffe066);
      if (s.phase === 'aimZ') {
        const mz = loc(0, rt.z);
        retH.visible = true; retH.position.set(mz.x, 0.02, mz.z); retH.rotation.set(-Math.PI / 2, 0, -cell.yaw); retH.scale.set(AIM_RANGE.x * 2 + 0.4, 0.05, 1); retH.material.opacity = 0.95;
        const dp = loc(rt.x, rt.z); retDot.visible = true; retDot.position.set(dp.x, 0.025, dp.z); retDot.rotation.set(-Math.PI / 2, 0, 0); retDot.scale.set(0.2, 0.2, 1); retDot.material.opacity = 0.95;
      }
    }
    if (blobs) { P.chars.forEach((c, i) => { const air = c === hc ? Math.max(0, H.y) : 0; blobs.set(i, c.x, c.z, 0.36 * c.k * 1.25 - air * 0.6, 0.012); }); blobs.mesh.count = 2; }

    // ---- camera
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    if (dim !== P.dim) { P.dim = dim; canvas.style.filter = dim; }
    const band = (game.camBand && game.camBand()) || { x: 0, y: 0, w: scr.vw, h: scr.vh };
    const running = T && (s.phase === 'count' || s.phase === 'hop' || s.phase === 'foul' || s.phase === 'clean');
    let want;
    if (G.scene === 'title' || G.scene === 'result' || G.scene === 'learn' || G.scene === 'lesson' || G.scene === 'lessonresult' || G.scene === 'demolimit') want = titleCam(C, band, scr.vw, scr.vh, cw, ch, sp);
    else if (running) want = followCam({ x: hc.x, z: hc.z }, H.yaw, band, scr.vw, scr.vh, cw, ch);
    else want = overviewCam(C, band, scr.vw, scr.vh, cw, ch);
    if (P.camRel) { const r = P.camRel, hy = hc.yaw, ca = Math.cos(hy), sa = Math.sin(hy); P.camDebug = { pos: [hc.x + r.d[0] * ca + r.d[2] * sa, r.d[1], hc.z - r.d[0] * sa + r.d[2] * ca], look: [hc.x, r.ly ?? 0.8, hc.z], fov: r.fov || 36 }; }
    if (P.camDebug) { const d = P.camDebug; want = { pos: V(...d.pos), look: V(...d.look), fov: d.fov || 40, fit: false, bn: want.bn, focus: V(...d.look) }; }
    const key = `${cw}x${ch}|${scr.vw}x${scr.vh}|${band.x.toFixed(1)},${band.y.toFixed(1)},${band.w.toFixed(1)},${band.h.toFixed(1)}|${C.id}|${scr.land ? 'L' : 'P'}`;
    const snap = !cam.init || key !== cam.key || P.snapCam;
    cam.key = key; P.snapCam = false; cam.init = true;
    const kk = snap ? 1 : 1 - Math.exp(-realDt * (running ? 7.5 : 3.2));
    cam.pos.lerp(want.pos, kk); cam.look.lerp(want.look, kk); cam.fov = lerp(cam.fov, want.fov, kk);
    const c = stage.camera, bn = want.bn;
    Object.assign(map, { cw, ch, sc: bn.sc, ox: bn.ox, oy: bn.oy });
    c.fov = cam.fov; c.aspect = cw / ch; c.position.copy(cam.pos); c.lookAt(cam.look); c.clearViewOffset(); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    // shift the picture so the interest point sits in the middle of the HUD's band
    let focusN;
    if (want.fit) { const bb = boxAt(c, want.pts, cw / ch); focusN = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 }; }       // y down
    else { tmpB.copy(want.focus).project(c); focusN = { x: tmpB.x, y: -tmpB.y }; }
    const tx = (bn.x0 + bn.x1) / 2, ty = want.fit ? (bn.y0 + bn.y1) / 2 : bn.y0 + (bn.y1 - bn.y0) * 0.68;
    c.setViewOffset(cw, ch, -(tx - focusN.x) * 0.5 * cw, -(ty - focusN.y) * 0.5 * ch, cw, ch);
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    stage.setShadowTarget(hc.x, 0, hc.z);
    P.overlay.head = project(heads[cur % 2].clone().add(V(0, 0.28, 0)));
    P.overlay.hopper = project(V(hc.x, 0.0, hc.z));
    P.overlay.tejo = tj.vis && !tj.hand ? project(V(tj.x, tj.y, tj.z)) : null;
    P.overlay.next = st ? project(V(st.pos.x, 0, st.pos.z)) : null;
    if (!P.noRender) { stage.render(); perfTick(now); }
  }
  P.frame = frame; P.over = { retV, retH, retDot, ringM, hi, targetGlow, tejo };

  function watcherClip(s, T) {
    if (!T) return 'idle_relaxed';
    if (s.phase === 'clean') return 'cheer';
    if (s.phase === 'over') return 'clap';
    return 'idle_relaxed';
  }
  // a change of supporting foot is eased so it never pops
  function smoothTargets(c, pose) {
    c.sm = c.sm || {};
    for (const side of ['L', 'R']) {
      const t = pose.legs[side]; if (!t) continue;
      const prev = c.sm[side];
      if (prev && Math.abs(prev[1] - t.p[1]) > 0.0005 && Math.hypot(prev[0] - t.p[0], prev[2] - t.p[2]) < 0.9) t.p = [lerp(prev[0], t.p[0], 0.55), lerp(prev[1], t.p[1], 0.55), lerp(prev[2], t.p[2], 0.55)];
      c.sm[side] = [...t.p];
    }
  }

  P.ready_p = build('f');
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      frame(game, view);
      view.overlay = P.overlay;
      r(ctx, view);
    };
    return game;
  };
  return P;
}
