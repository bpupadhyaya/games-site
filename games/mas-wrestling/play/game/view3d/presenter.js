// The 3D presenter: two real seated athletes, a board, a stick and the hall, drawn behind the kit canvas. It READS the 2D game's bridge
// (STAGE3D in src/view.js: the bout's sim state, the pose springs, the stage rectangle) and never writes back. While the models load, or when
// WebGL is missing or the context is lost, the game keeps drawing its own 2D picture, so nothing waits on this file.
import { STAGE3D, LOOKS } from '../src/view.js';
import { W as VW, H as VH } from '../src/layout.js';
import { createAthlete, GEOM } from './athlete.js';
import { buildHall, UPM } from './hall.js';

const LIB = '../vendor3d/index.js';
const nowMs = () => globalThis.performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const QS = (k) => { try { const m = new RegExp('[?&]' + k + '=([a-z]+)').exec(globalThis.location.search); return m ? m[1] : null; } catch { return null; } };

function pickQuality() {
  const q = QS('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  return weak ? 'medium' : 'high';
}

const FEMALE = new Set([2, 4]);          // LOOKS indices drawn with the female athlete (Tuyaara, Sardaana)
const MAX_PIXELS = 2.6e6;
const CAM = { D: 6.4, yaw: 9, pitch: 10, target: { x: 0, y: 0.5 } };

export async function createPresenter({ kitCanvas, quality }) {
  quality = quality || pickQuality();
  const fallback = { stage: null, wrap: (g) => g, ready: () => false, ok: false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D picture', e); window.__v3failed = true; return fallback; }
  const { createStage, THREE } = V3;
  const doc = globalThis.document;
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', shadowSize: 2.6 });
  if (!stage.supported) { canvas.remove(); window.__v3failed = true; return fallback; }
  let lost = false;
  const rigs = [];            // the two visible rigs (set once the male rigs are loaded)
  let sizeKey = '';
  stage.onContextLost(() => { lost = true; STAGE3D.on = false; });
  stage.onContextRestored(() => { try { const sc = stage.scene, old = sc.environment; if (old) { const pm = new THREE.PMREMGenerator(stage.renderer); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); if (old.dispose) old.dispose(); } } catch { /* keep the old light */ } // the image-based light dies with the context: rebuild it
    lost = false; sizeKey = ''; stage.invalidate(); if (rigs.length === 2) STAGE3D.on = true; });

  const hall = buildHall(THREE, stage, V3);
  stage.add(hall.root);
  hall.setHall('winter', true, quality);
  const camera = stage.camera;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---- athletes: two slots; a male and a female rig per slot, retinted per look --------------------------------------------------------------
  const slots = [{ m: null, f: null }, { m: null, f: null }];
  let loading = false;
  const kitOf = (L) => ({ top: L.kit, bottoms: L.pants, socks: L.trim, shoes: '#e9e5dc', trim: L.trim });
  async function make(side, kind) {
    const a = await createAthlete(V3, { side, character: kind === 'f' ? 'athlete_f' : 'athlete_m', kit: kitOf(LOOKS[side === 0 ? 0 : 1]), skin: LOOKS[0].skin, hair: LOOKS[0].hair, quality: quality === 'low' ? 'low' : 'high' });
    a.h.root.visible = false;
    stage.add(a.h);
    if (kind === 'm') stage.track(a.h);
    return a;
  }
  function wear(a, look) {
    const L = LOOKS[look];
    a.h.setKit(kitOf(L)); a.h.setSkin(L.skin); a.h.setHair(L.hair);
  }
  let look = ['', ''];
  async function loadAll() {
    if (loading) return; loading = true;
    try {
      const [a0, a1] = await Promise.all([make(0, 'm'), make(1, 'm')]);
      slots[0].m = a0; slots[1].m = a1;
      rigs[0] = a0; rigs[1] = a1;
      a0.h.root.visible = a1.h.root.visible = true;
      try { camera.updateMatrixWorld(true); stage.renderer.compile?.(stage.scene, camera); } catch { /* optional */ }
      STAGE3D.on = true; window.__v3ready = true; window.__v3ms = Math.round(nowMs());
      // the women's rigs load while the menu is up
      const [f0, f1] = await Promise.all([make(0, 'f'), make(1, 'f')]);
      slots[0].f = f0; slots[1].f = f1;
      // upload their textures and compile in one task (drawn once, then hidden and drawn again before anything is presented)
      try {
        f0.h.root.visible = f1.h.root.visible = true;
        stage.render();
        f0.h.root.visible = f1.h.root.visible = false;
        stage.render();
      } catch { /* optional */ }
      look = ['', ''];   // re-pick the rigs for the current looks
    } catch (e) { console.warn('3D athletes failed to load; keeping the 2D picture', e); STAGE3D.on = false; window.__v3failed = true; }
    loading = false;
  }
  loadAll();
  try { window.__v3 = { stage, camera, rigs, hall, THREE, STAGE3D, lab: null }; } catch { /* debug handle only */ }

  // ---- the camera: the bout picture's rectangle (virtual units) is the window the scene must fill ------------------------------------------------
  let cssW = 0, cssH = 0, camKey = '';
  function sizeCanvas() {
    const r = kitCanvas.getBoundingClientRect();
    const cw = r.width || globalThis.innerWidth, ch = r.height || globalThis.innerHeight;
    const sk = `${Math.round(cw)}x${Math.round(ch)}`;
    if (sk === sizeKey) return;
    sizeKey = sk; cssW = cw; cssH = ch; stage.resize();
    const want = Math.max(1, Math.min(globalThis.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / Math.max(1, cw * ch))));
    const rr = stage.renderer;
    if (Math.abs(rr.getPixelRatio() - want) > 0.01 || rr.domElement.width !== Math.round(cw * want)) { rr.setPixelRatio(want); rr.setSize(cw, ch, false); }
    camKey = ''; stage.invalidate();
  }
  function fitCamera(R) {
    const kv = Math.min(cssW / VW, cssH / VH);                 // css px per virtual unit
    const offX = (cssW - VW * kv) / 2, offY = (cssH - VH * kv) / 2;
    const key = `${cssW}|${cssH}|${VW}|${VH}|${R.sc.toFixed(3)}|${R.ox.toFixed(1)}|${R.oy.toFixed(1)}`;
    if (key === camKey) return;
    camKey = key;
    const D = CAM.D, yaw = CAM.yaw * Math.PI / 180, pitch = CAM.pitch * Math.PI / 180;
    const pxPerM = R.sc * UPM * kv;                            // css px per metre at the target
    const visH = cssH / pxPerM;
    camera.fov = 2 * Math.atan(visH / 2 / D) * 180 / Math.PI;
    camera.aspect = cssW / cssH;
    camera.near = 0.5; camera.far = 160;
    const tg = V(CAM.target.x, CAM.target.y, 0);
    camera.position.set(tg.x + D * Math.sin(yaw) * Math.cos(pitch), tg.y + D * Math.sin(pitch), D * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(tg);
    camera.updateMatrixWorld(true);
    // put the target at its 2D position (world unit mapping: x 500 is the middle of the board; the floor is at world y 410)
    const px = offX + (R.ox + 500 * R.sc) * kv, py = offY + (R.oy + (410 - CAM.target.y * UPM) * R.sc) * kv;
    camera.setViewOffset(cssW, cssH, -(px - cssW / 2), -(py - cssH / 2), cssW, cssH);
    camera.updateProjectionMatrix();
    stage.invalidate();
  }

  // ---- per frame ---------------------------------------------------------------------------------------------------------------------------------
  let seen = -1, lastT = null, slow = 0, avg = 4, tier = quality, lastB = null, settle = 0, bow = 0.004;
  const foe = [V(), V()];
  function chooseRigs(looks) {
    for (let i = 0; i < 2; i++) {
      const lk = looks[i], want = FEMALE.has(lk) && slots[i].f ? 'f' : 'm';
      const key = want + lk;
      if (look[i] === key) continue;
      look[i] = key;
      for (const k of ['m', 'f']) {
        const a = slots[i][k];
        if (!a) continue;
        a.h.root.visible = k === want;
        const at = stage.humans.indexOf(a.h);
        if (k === want && at < 0) stage.track(a.h);                     // only the two visible athletes are advanced and shadowed
        else if (k !== want && at >= 0) stage.humans.splice(at, 1);
      }
      rigs[i] = slots[i][want];
      wear(rigs[i], lk);
    }
  }
  // events read from the sim's numbers (edges), so a missed tick never drops a reaction
  const ev = { shake: [0, 0], over: false, dustT: [0, 0], breathT: [0.6, 1.3], block: 0, blockPh: 0, tHall: '' };
  function frame() {
    if (lost || !STAGE3D.on || rigs.length < 2) return;
    if (STAGE3D.frame === seen) { canvas.style.visibility = 'hidden'; return; }   // no bout picture this frame (a menu page)
    const R = STAGE3D;
    sizeCanvas();
    const lab = window.__v3 && window.__v3.lab;
    if (lab) {
      camera.clearViewOffset(); camera.fov = lab.fov || 30; camera.aspect = cssW / cssH; camera.near = 0.1; camera.far = 120;
      camera.position.set(...lab.pos); camera.lookAt(...lab.look); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); camKey = ''; stage.invalidate();
    } else fitCamera(R);
    let dt = lastT === null ? 0 : R.t - lastT;
    lastT = R.t;
    dt = clamp(dt, 0, 0.1);
    const prevSeen = seen;
    seen = R.frame;
    const B = R.B, P = R.pose;
    if (hall.hall !== R.hall) hall.setHall(R.hall, false, tier);
    chooseRigs(R.looks);
    // the stick, in metres: drawn toward the stronger puller, lifted and tilted by the lift gauge, bowed by the effort of both hands
    const dig = (P[0].dig + P[1].dig) * 0.5;
    const a = B.h * 0.2;
    const effort = (B.side[0].m + B.side[1].m) * 0.5;
    const c = { x: -B.x * GEOM.stickDraw, y: GEOM.stickY + 0.07 * Math.abs(B.h) - 0.04 * dig };
    const dir = { x: Math.cos(a), y: -Math.sin(a) };
    bow += ((0.004 + 0.022 * effort) - bow) * (1 - Math.exp(-dt * 8));
    hall.setStick(c, -a, bow);
    const over = B.over;
    for (let i = 0; i < 2; i++) foe[i].copy(rigs[1 - i].h.bonePosition('Head'));
    // a new bout, a new look or the first frame: let the smoothed values settle on the sim's numbers at once (no slide in from the last bout)
    if (B !== lastB || prevSeen !== R.frame - 1) { lastB = B; settle = 36; ev.over = !!over; ev.shake = [P[0].shake, P[1].shake]; }
    const pump = (n, step) => {
      for (let k = 0; k < n; k++) {
        for (let i = 0; i < 2; i++) {
          const s = B.side[i], p = P[i];
          rigs[i].pose({
            lean: 0.2 + p.lean, rise: p.rise, dig: p.dig, shake: p.shake, joy: p.joy, m: s.m, b: s.vec.b, u: s.vec.u, st: s.st,
            lose: over && over.win !== i ? 1 : 0, adv: i === 0 ? B.x : -B.x, t: R.t, stick: { c, dir }, foe: foe[i],
          }, step);
        }
      }
    };
    if (settle > 0) { pump(settle, 1 / 30); settle = 0; if (dt === 0) dt = 1 / 60; }
    pump(1, dt);
    canvas.style.visibility = 'visible';
    const t0 = nowMs();
    // ORDER: advance the humans (their IK reads the poses written above), then everything that hangs off them, then render
    stage.update(dt, { renderNow: false });
    // ---- reactions and effects (read-only from the sim)
    const cold = hall.cold();
    for (let i = 0; i < 2; i++) {
      const sh = P[i].shake;
      if (sh > 0.5 && ev.shake[i] <= 0.5) {
        const wob = 0.6 + 0.4 * B.side[i].snap;
        ev.block = Math.min(1, ev.block + 0.5 * wob);
        hall.emit((i === 0 ? -1 : 1) * 0.1, 0.12, 0.05, { vx: (i === 0 ? -1 : 1) * 0.25, vy: 0.35, size: 0.16, grow: 2.4, life: 0.7, a: 0.4 });
        hall.crowd && hall.crowd.react('gasp', { origin: [0, 1, 0], radius: 14 });
      }
      ev.shake[i] = sh;
      // the hips slide on the mat: dust drifts up behind them
      const sv = Math.abs(rigs[i].S.slideV);
      ev.dustT[i] -= dt;
      if (sv > 0.14 && ev.dustT[i] <= 0) {
        ev.dustT[i] = 0.09;
        const hx = rigs[i].root.position.x;
        hall.emit(hx + (i === 0 ? -0.05 : 0.05), 0.07, (Math.random() - 0.5) * 0.3, { vx: (i === 0 ? -0.12 : 0.12), vy: 0.1, size: 0.1, grow: 2.2, life: 0.8, a: 0.3, color: 0xd8cba8 });
      }
      // breath fog in a cold hall (faster and bigger the harder they work)
      if (cold) {
        ev.breathT[i] -= dt;
        if (ev.breathT[i] <= 0) {
          ev.breathT[i] = 1.9 - 1.1 * B.side[i].m + (i ? 0.3 : 0);
          const hp = rigs[i].h.bonePosition('Head');
          const dx = (i === 0 ? 1 : -1) * 0.12;
          hall.emit(hp.x + dx, hp.y - 0.05, 0.02, { vx: (i === 0 ? 1 : -1) * 0.14, vy: 0.1, size: 0.07 + 0.05 * B.side[i].m, grow: 3.2, life: 1.1, a: 0.32, color: 0xf2f6ff });
        }
      }
    }
    if (over && !ev.over) { hall.crowd && hall.crowd.react('ovation', { origin: [0, 1, 0], radius: 40 }); }
    ev.over = !!over;
    // the block creaks and shivers when a snap lands
    ev.block *= Math.exp(-dt * 4.5); ev.blockPh += dt * 38;
    hall.block.position.z = Math.sin(ev.blockPh) * 0.006 * ev.block;
    hall.block.rotation.z = Math.sin(ev.blockPh * 0.8 + 1) * 0.004 * ev.block;
    hall.update(dt, R.t, { excite: clamp(0.2 + R.cheer * 0.6 + effort * 0.35, 0, 1) });
    stage.invalidate();
    stage.render();
    // a fixed per-frame budget: if the average cost of a frame stays high, step the quality down one tier (shadows off, then blob shadows + 1x pixels)
    const cost = nowMs() - t0;
    avg += (cost - avg) * 0.05; window.__v3avg = Math.round(avg * 10) / 10; window.__v3tier = tier;
    if (avg > 9 && tier !== 'low' && ++slow > 90) { slow = 0; tier = tier === 'high' ? 'medium' : 'low'; stage.setQuality(tier); hall.setQuality(tier); for (const r of rigs) { if (r && r.h.setLOD) r.h.setLOD(0); } sizeKey = ''; avg = 6; }
  }

  return {
    stage, ok: true, hall,
    ready: () => rigs.length === 2 && STAGE3D.on,
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => {
        const c = ctx.canvas;
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#07191b'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.restore();
        r(ctx, view);
        try { frame(); } catch (e) { console.warn('3D picture stopped; using the 2D picture', e); STAGE3D.on = false; canvas.style.visibility = 'hidden'; }
      };
      return game;
    },
  };
}
