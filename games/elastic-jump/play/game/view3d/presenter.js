// 3D presenter: READS the engine state (game.getState()) and draws the schoolyard, the two holders, the elastic and the jumper.
// It never writes back. Contact discipline: the engine owns the beat and the tap times; motion.js turns them into landings.
import { Actor } from './actor.js';
import { JumperCtl, HX, LEVEL_H } from './motion.js';
import { jumperPose, holderPose } from './pose.js';
import { createBand } from './band.js';
import { buildYard, skyTexture } from './yard.js';
import { createDust } from './fx.js';
import { layoutFor } from '../src/layout.js';
import { JUDGE, TIMING } from '../src/moves.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEMO_SEQ = [1, 0, 1, 2, 1, 3, 1, 0, 2, 3, 2, 1];
const DEMO_BEAT = 0.6;

// Camera: looks from the far side of the band (so the jumper's face and both feet show), a quarter turn towards the holder on the right.
export const CAM = { az: 54, el: 28, fov: 26, target: [0, 0.72, 0.05] };
// the view turns with the shape of the room the HUD leaves: a tall room looks along the band, a wide one looks across it
const camFor = (aspect) => ({ az: clamp(54 - (aspect - 0.75) * 30, 34, 56), el: clamp(20 - (aspect - 0.75) * 8, 13, 22), fov: CAM.fov, target: CAM.target });
const FIT_FILL = 0.97;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

const KIT = {
  jumper: { char: 'athlete_f', kit: { top: '#ff4f8b', bottoms: '#20315f', socks: '#fff8ec' }, skin: 'tan', hair: 'black' },
  A: { char: 'athlete_m', kit: { top: '#ffcf3f', bottoms: '#2f6fe0', socks: '#f2f2f2' }, skin: 'original', hair: 'black' },
  B: { char: 'athlete_f', kit: { top: '#33c9a0', bottoms: '#6b3fc4', socks: '#f2f2f2' }, skin: 'brown', hair: 'black' },
};

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: false }; }
  const { createStage, loadHuman, THREE, buildScenery, createCrowd3d } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 3 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: false }; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.camera.near = 0.3; stage.camera.far = 90; stage.camera.fov = CAM.fov; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 0.98, hemi: 0.95, keyI: 2.3 });
  stage.scene.background = skyTexture();
  stage.scene.fog = null;
  stage._shadowOffset.set(-6, 11, -2);
  const yard = buildYard(stage);
  // far scenery: east-Asian hills and houses behind the school block; the kit's front is -z, our camera looks towards +z
  let scenery = null;
  try {
    scenery = buildScenery({ layers: [
      { t: 'sky', id: 'sky-day' }, { t: 'backdrop', id: 'bd-karst', seed: 3 },
      { t: 'band', id: 'band-karst-houses', r: 60, h: 17, arc: [-170, -10] },
      { t: 'cutouts', id: 'tr-broad-tree', count: 4, r: [26, 36], scale: [7, 10], seed: 5, sway: 0.5, arc: [-165, -15] },
    ], culture: 'east-asian', timeOfDay: 'day', quality: quality === 'high' ? 'high' : 'medium', clouds: 0.6, wind: 0.5, seed: 4 });
    scenery.group.rotation.y = Math.PI; stage.add(scenery.group);
    stage.scene.background = null;
  } catch (e) { console.warn('scenery failed', e); scenery = null; }
  // the children watching from the side of the yard (real 3D people, instanced), cheering at perfect hits
  let crowd = null;
  try {
    crowd = createCrowd3d(stage, { free: { area: [-4.6, 1.6, 4.6, 4.2], y: 0, count: quality === 'low' ? 8 : 14, avoid: (x, z) => Math.abs(x) < 2.0 && z < 3.2, face: [0, 0, 0] },
      count: quality === 'low' ? 8 : 14, seed: 21, culture: 'east_asian', quality: quality === 'high' ? 'medium' : 'low', kids: 0.85, excitement: 0.2, props: { flag: 0, phone: 0.0, child: 0 } });
  } catch (e) { console.warn('crowd3d failed', e); }
  const dust = createDust(stage.scene);
  const bandGroup = new THREE.Group(); bandGroup.name = 'band';
  const band = createBand(bandGroup);
  stage.add(bandGroup);
  const blobs = stage.enableBlobShadows ? stage.enableBlobShadows(4, { radius: 0.5, opacity: 0.9 }) : null;

  const P = { stage, THREE, humans: [], actors: [], ready: false, lost: false, overlay: { head: null }, idleT: 0, perf: 0, band, h: LEVEL_H[2], droop: 0, hInit: false };
  const ctlRun = new JumperCtl(), ctlDemo = new JumperCtl();
  P.ctlRun = ctlRun; P.ctlDemo = ctlDemo;
  const demo = { beat: DEMO_BEAT, moves: [], taps: [], winOk: 0.2, nextK: 2, cnt: 0 };
  let lastRun = null;
  let camKey = '';
  let landSeen = 0, lastCtl = null, popSeen = null;
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { try { const sc = stage.scene, old = sc.environment; if (old) { const pm = new THREE.PMREMGenerator(stage.renderer); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); if (old.dispose) old.dispose(); } } catch { /* keep the old light */ } // the image-based light dies with the context: rebuild it
    P.lost = false; camKey = ''; stage.resize(); stage.invalidate(); });

  async function build() {
    const defs = [KIT.jumper, KIT.A, KIT.B];
    for (let i = 0; i < 3; i++) {
      const d = defs[i];
      const h = await loadHuman({ character: d.char, kit: d.kit, skin: d.skin, hair: d.hair });
      h.groundClamp = 'off'; h.footPlanting = false;
      h.play('ready_stance', { fade: 0 });
      if (quality === 'low') h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      stage.add(h);
      h.setFingers('L', 'relaxed'); h.setFingers('R', 'relaxed');
      P.humans.push(h); P.actors.push(new Actor(h));
    }
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build();

  // adaptive quality: if frames run long, drop shadows, then the pixel ratio
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

  let lastNow = 0;
  const proj = V();
  const map = { cw: 720, ch: 1280, sc: 1, ox: 0, oy: 0 };
  function project(v) {
    proj.copy(v).project(stage.camera);
    return { x: ((proj.x * 0.5 + 0.5) * map.cw - map.ox) / map.sc, y: ((-proj.y * 0.5 + 0.5) * map.ch - map.oy) / map.sc };
  }
  const FIT_PTS = [];
  for (const x of [-0.55, 0.55]) for (const y of [0, 2.05]) for (const z of [-0.75, 0.8]) FIT_PTS.push(V(x, y, z));
  for (const sx of [-1, 1]) for (const dx of [-0.32, 0.32]) for (const y of [0, 1.92]) for (const z of [-0.4, 0.4]) FIT_PTS.push(V(sx * HX + dx, y, z));
  const tmp = V(), dirV = V(), tgtV = V();
  function boxAt(cam, dir, d, aspect, co) {
    cam.clearViewOffset(); cam.aspect = aspect; cam.fov = co.fov; cam.updateProjectionMatrix();
    cam.position.copy(tgtV).addScaledVector(dir, d); cam.lookAt(tgtV); cam.updateMatrixWorld(true);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of FIT_PTS) { tmp.copy(p).project(cam); x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x); y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y); }
    return { x0, y0: -y1, x1, y1: -y0 };
  }
  function fitCamera(co, bandR, vw, vh, cw, ch) {
    const cam = stage.camera, sc = Math.min(cw / vw, ch / vh), ox = (cw - vw * sc) / 2, oy = (ch - vh * sc) / 2;
    Object.assign(map, { cw, ch, sc, ox, oy });
    const aspect = cw / ch, az = (co.az * Math.PI) / 180, el = (co.el * Math.PI) / 180;
    tgtV.set(co.target[0], co.target[1], co.target[2]);
    dirV.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const bx0 = ((ox + bandR.x * sc) / cw) * 2 - 1, bx1 = ((ox + (bandR.x + bandR.w) * sc) / cw) * 2 - 1;
    const by0 = ((oy + bandR.y * sc) / ch) * 2 - 1, by1 = ((oy + (bandR.y + bandR.h) * sc) / ch) * 2 - 1;
    const bw = (bx1 - bx0) * FIT_FILL, bh = (by1 - by0) * FIT_FILL;
    let lo = 1.5, hi = 60;
    for (let k = 0; k < 30; k++) {
      const d = (lo + hi) / 2, b = boxAt(cam, dirV, d, aspect, co);
      if (b.x1 - b.x0 <= bw && b.y1 - b.y0 <= bh) hi = d; else lo = d;
    }
    const b = boxAt(cam, dirV, hi, aspect, co);
    const dx = ((bx0 + bx1) / 2 - (b.x0 + b.x1) / 2) * 0.5 * cw, dy = ((by0 + by1) / 2 - (b.y0 + b.y1) / 2) * 0.5 * ch;
    cam.setViewOffset(cw, ch, -dx, -dy, cw, ch);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    return hi;
  }

  function bandRect(G, L) {
    if (G.scene === 'play') return L.play.stage;
    if (G.scene === 'title') {
      const T = L.title;
      return L.mode === 'wide' ? { x: T.hero.x, y: T.hero.y + T.hero.h * 0.22, w: T.hero.w, h: T.hero.h * 0.78 } : { x: 0, y: T.hero.y + T.hero.h * 0.2, w: L.w, h: T.hero.h * 0.8 };
    }
    return { x: 0, y: L.h * 0.28, w: L.w, h: L.h * 0.72 };
  }

  const headTop = V();
  function frame(game, view, nowOverride) {
    if (!P.ready || P.lost) return false;
    const G = game.getState();
    stage.setVisible(true);
    const now = nowOverride ?? globalThis.performance.now();
    const realDt = P.fixedDt ? P.fixedDt : P.shot ? 1 / 60 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    if (!P.shot || P.fixedDt) P.idleT += realDt; else P.idleT = 1.7;
    const run = G.scene === 'play' ? G.run : null;
    const li = run ? run.li : G.scene === 'result' && G.result ? G.result.li : (G.scene === 'levels' || G.scene === 'prep') ? G.sel : 2;
    // ---- what drives the jumper: the real run, or a looping demo
    let ctl, ctx, T, stumble = 0, ripple = 0;
    if (run) {
      if (lastRun !== run) { ctlRun.reset(); lastRun = run; }
      const k = TIMING[G.prefs.timingIdx].k;
      ctx = { beat: run.rt.beat, moves: run.moves, winOk: JUDGE.ok * k + (G.prefs.lat || 0) / 1000, taps: run.taps || [] };
      ctl = ctlRun; T = run.t; stumble = run.jumper.stumble; ripple = 0.05 * stumble;
    } else {
      lastRun = null;
      const t = (P.fixedT !== undefined ? P.fixedT : G.t) + (P.demoOffset || 0);
      if (t < ctlDemo.t - 1e-6) { demo.nextK = 2; demo.taps.length = 0; }
      while (demo.nextK * DEMO_BEAT <= t) { const k = demo.nextK++; demo.taps.push({ t: k * DEMO_BEAT, pose: DEMO_SEQ[k % DEMO_SEQ.length], n: ++demo.cnt }); if (demo.taps.length > 8) demo.taps.shift(); }
      ctx = demo; ctl = ctlDemo; T = t;
    }
    ctl.advance(T, ctx);
    if (!P.shot) { if (scenery) scenery.update(realDt, stage.camera); if (crowd) crowd.update(realDt); }
    // landings: a puff of dust under the feet, scaled by the kind of hop; perfect hits make the onlookers cheer
    if (ctl.landCount < landSeen || ctl !== lastCtl) { landSeen = ctl.landCount; lastCtl = ctl; }
    if (ctl.landCount > landSeen) {
      landSeen = ctl.landCount;
      if (!P.shot) { const f = ctl.rest; dust.burst((f.L.x + f.R.x) / 2, (f.L.z + f.R.z) / 2, ctl.lastKind === 'step' ? 0.9 : 0.4); }
    }
    if (run && run.pops.length) {
      const lp = run.pops[run.pops.length - 1];
      if (lp !== popSeen) { popSeen = lp; if (crowd && !P.shot) crowd.react(/PERFECT|GOOD/.test(lp.text) ? 'cheer' : 'groan', { origin: [0, 0, 3], radius: 20, intensity: /PERFECT/.test(lp.text) ? 0.8 : 0.5 }); }
    }
    if (!P.shot) dust.update(realDt, stage.camera);
    if (yard && yard.userData.flags) yard.userData.flags.children.forEach((m, i) => { m.rotation.z = 0.12 * Math.sin(P.idleT * 2.1 + i * 0.7); });
    // ---- band height (smooth between levels), droop when the round was lost
    const hT = LEVEL_H[clamp(li | 0, 0, LEVEL_H.length - 1)];
    P.h = P.hInit ? P.h + (hT - P.h) * Math.min(1, realDt * 7) : hT; P.hInit = true;
    const dT = G.scene === 'result' && G.result && G.result.failed ? 1 : 0;
    P.droop += (dT - P.droop) * Math.min(1, realDt * 3.2);
    // ---- bodies
    const hj = P.humans[0], aj = P.actors[0];
    const celebrate = G.scene === 'result' && G.result ? (G.result.failed ? -1 : 1) : 0;
    hj.setPosition(0, 0, 0); hj.setFacing(Math.PI); hj.update(realDt);
    const pj = jumperPose({ ctl, actor: aj, idle: { phase: 0.6, t: P.idleT }, stumble, mode: G.scene, tReal: P.idleT, celebrate, dt: P.shot && !P.fixedDt ? 0 : realDt });
    aj.apply(pj, realDt);
    const jHead = hj.bonePosition('Head');
    const beatPos = ctx.beat ? T / ctx.beat : 0, bph = beatPos - Math.floor(beatPos);
    // the jumper's legs as capsules (hip-knee, knee-ankle): the band wraps/stretches round them (band.js legContact)
    const legs = [];
    for (const sd of ['L', 'R']) {
      const B = aj.b[sd], hip = B.thigh.getWorldPosition(V()), knee = B.calf.getWorldPosition(V()), ank = B.foot.getWorldPosition(V());
      legs.push({ a: [hip.x, hip.y, hip.z], b: [knee.x, knee.y, knee.z], r: 0.065 }, { a: [knee.x, knee.y, knee.z], b: [ank.x, ank.y, ank.z], r: 0.048 });
    }
    const pres = [ctl.strandPresses(0, T), ctl.strandPresses(1, T)];
    const bo = band.update({ h: P.h, hAnch: [P.h, P.h], presses: pres, ripple, ripplePh: P.idleT * 22, droop: P.droop > 0.01 ? P.droop : 0, legs, dt: realDt });
    const pull = clamp(bo.maxPress / 0.7, 0, 1);
    const hd = [{ h: P.humans[1], a: P.actors[1], side: -1, ph: 1.7 }, { h: P.humans[2], a: P.actors[2], side: 1, ph: 3.9 }];
    for (const d of hd) {
      d.h.setPosition(0, 0, 0); d.h.update(realDt);
      const hp = holderPose({ actor: d.a, side: d.side, h: P.h, pull, beatPhase: bph, idle: { phase: d.ph, t: P.idleT }, jumperHead: jHead.clone(), droop: P.droop });
      d.a.apply(hp, realDt);
      d.h.setFingers('L', 'relaxed'); d.h.setFingers('R', 'relaxed');
    }
    hj.setFingers('L', 'relaxed'); hj.setFingers('R', 'relaxed');
    // ---- shadows
    if (blobs) {
      const rj = Math.max(0, pj.out.rise);
      blobs.set(0, pj.pelvis.x, pj.pelvis.z, 0.5 - rj * 0.5, 0.012);
      blobs.set(1, -HX, 0, 0.5, 0.012); blobs.set(2, HX, 0, 0.5, 0.012);
      blobs.mesh.count = 3;
    }
    // ---- camera: fixed direction, distance + image shift solved from the live screen size and the band the HUD leaves
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    const vw = view.width, vh = view.height;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    const L = layoutFor(vw, vh), br = bandRect(G, L);
    const key = `${cw}x${ch}|${vw}x${vh}|${br.x.toFixed(1)},${br.y.toFixed(1)},${br.w.toFixed(1)},${br.h.toFixed(1)}`;
    const co = P.camOverride || camFor(br.w / Math.max(1, br.h));
    if (P.rawCam) {
      const c = P.rawCam, cam = stage.camera;
      cam.clearViewOffset(); cam.aspect = cw / ch; cam.fov = c.fov; cam.updateProjectionMatrix();
      cam.position.set(c.pos[0], c.pos[1], c.pos[2]); cam.lookAt(c.look[0], c.look[1], c.look[2]); cam.updateMatrixWorld(true);
      camKey = '';
    } else if (key !== camKey || P.camDirty) { camKey = key; P.camDirty = false; P.fit = fitCamera(co, br, vw, vh, cw, ch); }
    stage.setShadowTarget(0, 0, 0);
    stage.camera.updateMatrixWorld(true);
    // ---- overlay anchors for the HUD popups (head position in virtual units)
    headTop.copy(jHead); headTop.y += 0.14;
    const hp0 = project(headTop), hp1 = project(V(jHead.x, jHead.y - 0.1, jHead.z));
    P.overlay.head = { hcx: hp0.x, hcy: hp0.y - Math.abs(hp1.y - hp0.y) * 0.4, headR: Math.max(10, Math.abs(hp1.y - hp0.y) * 0.5) };
    if (!P.noRender) { stage.render(); perfTick(now); }
    return true;
  }
  P.frame = frame;
  P.crowd = crowd; P.scenery = scenery; P.dust = dust;
  // icon / store-shot helper: freeze the demo at time t, optionally with a raw camera, and let the onlookers cheer
  P.iconShot = (t, cam, cheer = true) => {
    P.shot = true; P.fixedT = t; P.rawCam = cam || null; P.demoOffset = 0;
    if (crowd) { if (cheer) crowd.react('cheer', { origin: [0, 0, 3], radius: 40, intensity: 1 }); for (let i = 0; i < 14; i++) crowd.update(0.1); }
    if (scenery) scenery.update(0.1, stage.camera);
    stage.invalidate();
  };

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      let ok = false;
      try { ok = frame(game, view); } catch (e) { if (!P.err) { P.err = e; console.warn('3D frame failed', e); } }
      view.gl3d = ok; view.overlay = P.overlay;
      if (!ok) { try { stage.setVisible(false); } catch { /* ignore */ } }
      r(ctx, view);
    };
    return game;
  };
  return P;
}
