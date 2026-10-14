// 3D presenter for Hoop Rolling Trundle (game-owned). It only READS what the 2D side hands over each frame (src/glhook.js): the road camera,
// the course items and, per racer, the simulation record. WebGL draws the whole village lane (road, cottages, hedgerows, gates, onlookers,
// children, hoops, dust) on a canvas BEHIND the kit canvas; the kit canvas stays transparent and keeps the HUD, menus and input. A pinhole
// matrix reproduces the 2D road camera exactly, so 2D marks (gold line, gate numbers, name chips) land on the 3D road.
// Without WebGL2, with ?nogl, on context loss, or while assets are slow (main.js waits 1.6 s) the illustrated 2D scene plays instead.
import { CAM_DIST } from '../src/art.js';
import { gl } from '../src/glhook.js';
import { ABOUT } from '../src/content.js';
import { Roller, SCALE } from './people.js';
import { createWorld } from './world.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SLOTS = [{ ch: 'athlete_m' }, { ch: 'athlete_m' }, { ch: 'athlete_m' }, { ch: 'athlete_f' }];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

// The About page lists the 3D layer's licences once they are loaded (long tokens broken so they wrap at 300 percent text).
function addCredits(text) {
  if (!text || ABOUT.blocks.some((b) => b.h === '3D scene and players')) return;
  const brk = (s) => s.replace(/\S{13,}/g, (m) => m.replace(/([/._-])/g, '$1 ').split(' ').map((w) => w.replace(/(.{12})(?=.)/g, '$1 ')).join(' '));
  const paras = String(text).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/^Credits and licences for the Arcforge/.test(x) && !/^Games that ship the 3D layer/.test(x));
  if (!paras.length) return;
  ABOUT.blocks.push({ h: '3D scene and players' }); paras.forEach((p) => ABOUT.blocks.push({ p: brk(p) }));
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  const pdb = /[?&](shot|pdb)=/.test(globalThis.location.search);
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 7, preserveDrawingBuffer: pdb, fov: 40 }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const cam = stage.camera;
  cam.updateProjectionMatrix = () => {};          // the projection below is ours (the 2D road camera as a pinhole)
  stage._shadowOffset = new THREE.Vector3(-6, 10, 5);
  const blobs = quality === 'low' && stage.enableBlobShadows ? stage.enableBlobShadows(12, { radius: 0.4, opacity: 0.55 }) : null;
  canvas.style.visibility = 'hidden';

  const world = createWorld({ THREE, stage, V3, quality });
  const P = { stage, THREE, ready: false, lost: false, world };
  stage.onContextLost(() => { P.lost = true; gl.active = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); try { world.fx.clear(); } catch { /* ignore */ } gl.active = P.ready; });
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { gl.licenses = t || ''; addCredits(t); }).catch(() => {}); } catch { /* ignore */ }

  const rollers = [];
  async function build() {
    const hs = await Promise.all(SLOTS.map((s) => loadHuman({ character: s.ch, kit: { top: '#f3b21b', bottoms: '#2a6f9e', socks: '#34302c', shoes: '#2d2018' }, skin: 'tan', hair: 'black', scale: SCALE, lod: quality === 'low' ? 2 : 1, quality })));
    hs.forEach((h, i) => { h.groundClamp = 'auto'; h.play('ready_stance', { fade: 0 }); stage.add(h); stage.track(h); const r = new Roller(h, stage.scene, THREE, world.fx, V3); r.hide(); r.female = SLOTS[i].ch === 'athlete_f'; rollers.push(r); });
    P.ready = true; gl.active = !P.lost; stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  const perfTick = (now) => {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 24 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) { stage.renderer.shadowMap.enabled = false; stage.lights.key.castShadow = false; stage.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
        else if (perfLevel === 2) stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        else { stage.renderer.setPixelRatio(1); try { world.crowd && world.crowd.setQuality('low'); } catch { /* ignore */ } }
        stage.invalidate();
      }
    }
  };

  // The 2D road camera as a pinhole: pixel = (cx + X F/Zc, hy + (camH - Y) F/Zc), Zc = distance ahead of the eye (CAM_DIST behind the hoop).
  function setCamera(F3) {
    const c = F3.cam, W = F3.w, H = F3.h, cx = c.cx + F3.shake.x, hy = c.hy + F3.shake.y, f = c.F, n = 0.25, fa = 400;
    cam.position.set(0, 0, 0); cam.quaternion.identity(); cam.updateMatrixWorld(true);
    cam.projectionMatrix.set(
      2 * f / W, 0, -(2 * cx / W - 1), 0,
      0, 2 * f / H, -(1 - 2 * hy / H), 0,
      0, 0, -(fa + n) / (fa - n), -2 * fa * n / (fa - n),
      0, 0, -1, 0,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.fov = 2 * Math.atan(H / (2 * f)) * 180 / Math.PI; cam.aspect = W / H;      // used by LOD and the crowd's culling
  }

  // Dev only: a hand-placed camera for the store icon and shots (page code sets P.icon = { at: [x,y,z], look: [x,y,z], fov } in the camera frame
  // relative to racer 0, or world coordinates when abs is true). Not used in play.
  const proto = Object.getPrototypeOf(cam);
  function setIconCamera() {
    const R0 = rollers[D.slot.get(0)], o = P.icon;
    const b = R0 && R0.h.root.visible ? R0.h.root.position : { x: 0, y: 0, z: 0 };
    const at = o.abs ? o.at : [b.x + o.at[0], b.y + o.at[1], b.z + o.at[2]], lk = o.abs ? o.look : [b.x + o.look[0], b.y + o.look[1], b.z + o.look[2]];
    cam.updateProjectionMatrix = proto.updateProjectionMatrix;
    cam.fov = o.fov || 38; cam.aspect = (kitCanvas.width / kitCanvas.height) || 1; cam.near = 0.15; cam.far = 500;
    cam.position.set(at[0], at[1], at[2]); cam.up.set(0, 1, 0); cam.lookAt(lk[0], lk[1], lk[2]);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  const D = { lastT: null, seen: new Map(), slot: new Map(), lastKey: '', me: null, clock: 0 };
  function assign(people) {
    // girls (look style 'long') use the one female body, everyone else the male bodies; stable per set of looks
    const key = people.map((p) => p.id + ':' + p.look.style).join('|');
    if (key === D.lastKey) return;
    D.lastKey = key; D.slot.clear();
    const m = [0, 1, 2], f = [3], used = new Set();
    for (const p of [...people].sort((a, b) => a.id - b.id)) {
      const wantF = p.look.style === 'long' && f.length;
      const pool = wantF ? f : m;
      const i = pool.length ? pool.shift() : [0, 1, 2, 3].find((q) => !used.has(q));
      used.add(i); D.slot.set(p.id, i);
    }
  }

  function frame(game) {
    if (!P.ready || P.lost) return;
    const F = gl.frame;
    if (!F) { canvas.style.visibility = 'hidden'; stage.setVisible(false); return; }
    canvas.style.visibility = 'visible';
    const rc = kitCanvas.getBoundingClientRect(), st = canvas.style, w = Math.round(rc.width), h = Math.round(rc.height);
    if (w > 0 && h > 0 && (st.width !== w + 'px' || st.height !== h + 'px' || st.left !== Math.round(rc.left) + 'px' || st.top !== Math.round(rc.top) + 'px')) {
      st.left = Math.round(rc.left) + 'px'; st.top = Math.round(rc.top) + 'px'; st.width = w + 'px'; st.height = h + 'px'; stage.resize();
    }
    stage.setVisible(true);
    const now = globalThis.performance.now();
    let dt = D.lastT === null ? 0 : F.t - D.lastT; D.lastT = F.t;
    if (dt < 0 || dt > 0.5) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);
    void game;
    setCamera(F);
    P.F = F;
    const c = F.cam;
    world.fx.setScale(c.F * (w / F.w) * stage.renderer.getPixelRatio());
    stage.setShadowTarget(0, -c.camH, -(CAM_DIST + 3));
    D.clock += dt;
    world.update(F, dt, D.clock);

    // ---- the racers
    assign(F.people);
    const used = new Set();
    const me = F.me;
    for (const e of F.people) {
      const si = D.slot.get(e.id); const R = rollers[si]; if (!R || used.has(si)) continue;
      used.add(si);
      if (e.z < -3.4 || e.z > 80) { R.hide(); continue; }
      const r = e.r, psc = r.psi * 0.6, cp = Math.cos(psc), sp = Math.sin(psc);
      const hp = world.wp(c, e.z, e.e), cpnt = world.wp(c, e.z - 0.85 * cp + 0.62 * sp, e.e - 0.85 * sp - 0.62 * cp);
      R.setLook(e.look, e.id === 0 ? '#e8472f' : e.look.shirt);
      const prev = D.seen.get(e.id) || { pud: r.lastPud };
      const splash = r.lastPud !== prev.pud && r.lastPud >= 0;
      prev.pud = r.lastPud; D.seen.set(e.id, prev);
      R.place({
        r, W: F.W, hoop: { x: hp.x, y: hp.y, z: hp.z, h: hp.h }, child: { x: cpnt.x, y: cpnt.y, z: cpnt.z, h: cpnt.h }, surf: r.surf || 'road', splash,
        onRoll: e.id === 0 && gl.sound ? (sp2, v) => { if (sp2 === 'cobble') gl.sound({ freq: 1500 + (v * 90) % 700, dur: 0.025, type: 'triangle', vol: 0.03 }); } : null,
        onClatter: e.id === 0 && gl.sound ? (k) => gl.sound({ freq: 1250 + Math.random() * 500, to: 900, dur: 0.07, type: 'triangle', vol: 0.07 * k }) : null,
      }, dt);
    }
    rollers.forEach((R, i) => { if (!used.has(i)) R.hide(); });
    if (blobs) {
      let bi = 0;
      rollers.forEach((R) => { if (R.h.root.visible) { blobs.set(bi++, R.h.root.position.x, R.h.root.position.z, 0.34, R.h.root.position.y + 0.012); blobs.set(bi++, R.hoop.position.x, R.hoop.position.z, 0.3, R.hoop.position.y + 0.012); } });
      blobs.mesh.count = bi;
    }

    // ---- onlookers react to what the player does
    if (me && world.crowd) {
      if (D.me && (me.gi < D.me.gi || me.falls < D.me.falls)) D.me = null;          // a new race
      const pv = D.me || (D.me = { gi: me.gi, falls: me.falls, fin: me.finished });
      const hpnt = world.wp(c, 0, me.d);
      if (me.gi > pv.gi && me.lastQ) {
        const q = me.lastQ;
        if (q === 'perfect') world.crowd.react('cheer', { origin: [hpnt.x, 0, hpnt.z], radius: 26, intensity: 0.9 });
        else if (q === 'good') world.crowd.react('cheer', { origin: [hpnt.x, 0, hpnt.z], radius: 16, intensity: 0.5 });
        else world.crowd.react('groan', { origin: [hpnt.x, 0, hpnt.z], radius: 14, intensity: 0.5 });
        if (q === 'perfect') world.fx.emit(hpnt.x, hpnt.y + 1.4, hpnt.z, 14, { size: 0.1, life: 0.9, r: 1, g: 0.85, b: 0.3, a: 0.95, up: 2.0, speed: 1.1, grav: 4, grow: 0.1 });
      }
      if (me.falls > pv.falls) world.crowd.react('gasp', { origin: [hpnt.x, 0, hpnt.z], radius: 20, intensity: 0.8 });
      if (me.finished && !pv.fin) world.crowd.react('ovation', { intensity: 1, duration: 4 });
      pv.gi = me.gi; pv.falls = me.falls; pv.fin = me.finished;
    }
    world.updateCrowd(c, dt);
    world.fx.update(dt);
    stage.update(dt, { renderNow: false });
    for (const R of rollers) R.smooth();
    stage.render();
    perfTick(now);
  }

  P.frame = frame; P.dbg = D;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    let warned = false;
    game.render = (ctx, view) => { r(ctx, view); try { frame(game); } catch (e) { if (!warned) { warned = true; console.error('3D frame failed', e && e.stack); } } };
    return game;
  };
  P.rollers = rollers;
  return P;
}
