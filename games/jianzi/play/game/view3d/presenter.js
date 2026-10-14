// 3D presenter for Jianzi (game-owned). It only READS what the 2D side hands over each frame (src/glhook.js): the camera, the yard,
// who stands where and the kick records. WebGL draws the painted courtyard (as the scene background), the chalk circle and real 3D
// players behind the transparent kit canvas; the kit canvas keeps the shuttle, effects, HUD, pads and input. One projective camera
// reproduces the 2D art's own pinhole map (art.js makeCam), so every 2D mark lands exactly on its 3D place at any size.
// Without WebGL2, with ?nogl, on context loss, or while assets are slow (main.js waits 1.6 s) the paper-cut 2D figures play instead.
import { COSTUMES, GROUND_K, PERSP_K, YARDS } from '../src/art.js';
import { gl } from '../src/glhook.js';
import { ABOUT } from '../src/content.js';
import { Person, SCALE } from './people.js';
import { buildCourtyard, BENCH_D, WALL_D } from './scene.js';
import { createShuttle } from './shuttle3d.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const LOOKS = [{ ch: 'athlete_m', skin: 'tan', hair: 'black' }, { ch: 'athlete_f', skin: 'light', hair: 'black' }, { ch: 'athlete_m', skin: 'brown', hair: 'black' }, { ch: 'athlete_f', skin: 'tan', hair: 'brown' }];
const kitOf = (i) => { const c = COSTUMES[i]; return { top: c.tunic, bottoms: c.trouser, socks: c.trim, shoes: '#f1ead9', trim: c.sash }; };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

// The About page lists the 3D layer's licences (one paragraph per item) once they are loaded.
function addCredits(text) {
  if (!text || ABOUT.some((s) => s.title === '3D players')) return;
  const paras = String(text).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/^Credits and licences for the Arcforge/.test(x) && !/^Games that ship the 3D layer/.test(x));
  // long tokens (URLs, package names) are broken into short pieces so they wrap at 300 percent text on a 360 px screen
  const brk = (s) => s.replace(/\S{13,}/g, (m) => m.replace(/([/._-])/g, '$1 ').split(' ').map((w) => w.replace(/(.{12})(?=.)/g, '$1 ')).join(' '));
  if (paras.length) ABOUT.push({ title: '3D players', p: paras.map(brk) });
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, createCrowd3d, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: true, shadowSize: 5, preserveDrawingBuffer: /[?&](shot|pdb)=/.test(globalThis.location.search) }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const cam = stage.camera;
  stage.scene.fog = null;
  cam.updateProjectionMatrix = () => {};          // the projection below is ours (the 2D art's pinhole map)
  cam.fov = 100;                                  // only used by the crowd's culling / LOD, which reads fov + aspect
  const blobs = stage.enableBlobShadows ? stage.enableBlobShadows(6, { radius: 0.5, opacity: 0.4 }) : null;
  stage.setShadowTarget(0, 0, -1.4);
  let lightKey = '';
  const light = (yardId) => {
    const k = yardId === 2 ? 'dusk' : yardId === 3 ? 'snow' : yardId === 1 ? 'park' : 'day';
    if (k === lightKey) return; lightKey = k;
    if (k === 'dusk') stage.setLighting('day', { exposure: 0.95, hemi: 0.55, hemiSky: 0xffc7a0, hemiGround: 0x5a4a78, key: 0xffa070, keyI: 2.2, rim: 0x9fb0ff, rimI: 1.1 });
    else if (k === 'snow') stage.setLighting('day', { exposure: 0.98, hemi: 1.0, hemiSky: 0xe8f0ff, hemiGround: 0xc0cad6, key: 0xfff4e4, keyI: 1.8, rim: 0xcfe0ff, rimI: 0.6 });
    else if (k === 'park') stage.setLighting('day', { exposure: 0.95, hemi: 0.85, hemiSky: 0xeef8f0, hemiGround: 0x8aa070, key: 0xfff6e0, keyI: 2.2, rim: 0xbcd4ff, rimI: 0.6 });
    else stage.setLighting('day', { exposure: 0.92, hemi: 0.8, hemiSky: 0xfff2d8, hemiGround: 0xa08a60, key: 0xffd9a0, keyI: 2.5, rim: 0xbcd4ff, rimI: 0.7 });
  };
  light(0); stage.scene.fog = null;

  const P = { stage, THREE, ready: false, lost: false };

  // ---- the set, the shuttle, the chalk circle, dust ------------------------------------------------------------------------------
  const yardSet = buildCourtyard(THREE, { quality });
  stage.scene.add(yardSet.root);
  const shuttle = createShuttle(THREE);
  stage.scene.add(shuttle.root);
  const glowTex = (() => { const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 1, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
  shadowDisc.rotation.x = -Math.PI / 2; shadowDisc.position.y = 0.006; stage.scene.add(shadowDisc);

  const chalk = { solo: new THREE.Group(), circle: new THREE.Group() };
  {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfffaf0, transparent: true, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mk = (grp, cx, cz, rx, rz, n, w) => {
      const dash = new THREE.RingGeometry(1 - w, 1, 6, 1, 0, (Math.PI * 2 / n) * 0.62);
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(dash, mat); m.rotation.z = (i / n) * Math.PI * 2; grp.add(m); }
      grp.rotation.x = -Math.PI / 2; grp.scale.set(rx, rz, 1); grp.position.set(cx, 0.004, cz);
      stage.scene.add(grp);
    };
    mk(chalk.solo, 0, 0, 1.5, 0.825, 34, 0.035);
    mk(chalk.circle, 0, -1.5, 3.35, 1.675, 48, 0.02);
  }
  // dust puffs (a small pool of soft sprites)
  const dust = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd9ccb0, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; stage.scene.add(m); dust.push({ m, t: 1, dur: 1, vx: 0, vy: 0, vz: 0, size: 0.2 });
  }
  const puff = (x, y, z, n = 4, size = 0.22, col = 0xd9ccb0, up = 0.35) => {
    for (let k = 0; k < n; k++) {
      const d = dust.find((q) => q.t >= q.dur) || dust[0];
      d.t = 0; d.dur = 0.55 + 0.35 * Math.random(); d.size = size * (0.7 + 0.6 * Math.random());
      d.vx = (Math.random() - 0.5) * 0.9; d.vy = up * (0.5 + Math.random()); d.vz = (Math.random() - 0.5) * 0.6;
      d.m.position.set(x + (Math.random() - 0.5) * 0.1, y, z + (Math.random() - 0.5) * 0.1); d.m.material.color.set(col); d.m.visible = true;
    }
  };

  stage.onContextLost(() => { P.lost = true; gl.active = false; });
  stage.onContextRestored(() => { P.lost = false; bgYard = -1; stage.resize(); stage.invalidate(); gl.active = P.ready; });
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { gl.licenses = t || ''; addCredits(t); }).catch(() => {}); } catch { /* ignore */ }

  let bgYard = -1;
  const setYard = (id) => {
    if (id === bgYard) return; bgYard = id;
    yardSet.setYard(id);
    light(id);                                   // setLighting also sets a flat sky colour and fog: put ours back after it
    stage.scene.background = yardSet.background; stage.scene.fog = null;
    stage.invalidate();
  };

  // ---- people --------------------------------------------------------------------------------------------------------------------------
  const people = [];
  let crowd = null;
  async function build() {
    const hs = await Promise.all(LOOKS.map((lk, i) => loadHuman({ character: lk.ch, kit: kitOf(i), skin: lk.skin, hair: lk.hair, scale: SCALE, lod: quality === 'low' ? 2 : 1, quality })));
    hs.forEach((h, i) => { h.groundClamp = 'auto'; h.footPlanting = true; h.play('ready_stance', { fade: 0 }); stage.add(h); stage.track(h); h.root.visible = false; people.push(new Person(h, i)); });
    // onlookers: a bench along the back wall (real 3D people, varied age and clothes) and a few standing ones
    try {
      const seat = (x, yaw = 0) => ({ x, y: 0.0, z: -BENCH_D + 0.02, yaw, seated: true });
      const stand = (x, d, yaw = 0) => ({ x, y: 0, z: -d, yaw, seated: false });
      crowd = createCrowd3d(stage, {
        points: [seat(-3.35, 0.1), seat(-2.65, 0), seat(-1.95, -0.1), seat(1.35, 0.05), seat(2.05, 0), seat(2.75, -0.1), seat(3.45, 0.1),
          stand(-4.1, 5.6, 0.45), stand(4.15, 5.3, -0.45), stand(-0.6, 6.95, 0), stand(0.55, 7.0, 0.1)],
        culture: ['east_asian', 'east_asian', 'east_asian', 'european_village'], count: 11, seed: 20261013, quality: quality === 'low' ? 'low' : quality,
        excitement: 0.15, viewportHeight: 800, props: { phone: 0.1, child: 0.0, flag: 0 },
      });
      crowd.group.traverse((o) => { o.castShadow = false; });
    } catch (e) { console.warn('crowd3d failed', e && e.message); crowd = null; }
    P.ready = true; gl.active = !P.lost; stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  const perfTick = (now) => {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) { const avg = perfSum / perfN; perfN = 0; perfSum = 0; if (avg > 24 && perfLevel < 2) { perfLevel++; stage.renderer.setPixelRatio(perfLevel === 1 ? Math.min(1.25, stage.renderer.getPixelRatio()) : 1); stage.invalidate(); } }
  };

  // ---- the camera: the 2D pinhole map as a projection matrix (view = identity; the viewer looks along -z, depth d = -z) -----------------------
  function setCamera(F) {
    const { s, cx, gy } = F.cam, W = F.W, H = F.H, K = PERSP_K, G = GROUND_K;
    cam.position.set(0, 0, 0); cam.quaternion.identity(); cam.updateMatrixWorld(true);
    cam.projectionMatrix.set(
      2 * s / W, 0, -K * (2 * cx / W - 1), 2 * cx / W - 1,
      0, 2 * s / H, -(K - 2 * gy * K / H + 2 * G * s / H), 1 - 2 * gy / H,
      0, 0, -0.07, 0.5,
      0, 0, -K, 1,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  const D = { lastT: null, runKey: null, over: false, streak: 0, shLie: 0, speedLP: new Map() };
  function frame(game) {
    if (!P.ready || P.lost) return;
    const G = game.getState(), F = gl.frame;
    if (!F) { stage.setVisible(false); return; }
    const rc = kitCanvas.getBoundingClientRect(), st = canvas.style, w = Math.round(rc.width), h = Math.round(rc.height);
    if (w > 0 && h > 0 && (st.width !== w + 'px' || st.height !== h + 'px' || st.left !== Math.round(rc.left) + 'px' || st.top !== Math.round(rc.top) + 'px')) {
      st.left = Math.round(rc.left) + 'px'; st.top = Math.round(rc.top) + 'px'; st.width = w + 'px'; st.height = h + 'px'; stage.resize();
    }
    stage.setVisible(true);
    const now = globalThis.performance.now();
    let dt = D.lastT === null ? 0 : G.t - D.lastT; D.lastT = G.t;
    if (G.paused || G.pauseMenu) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    if (P.labDt != null) dt = P.labDt;
    dt = clamp(dt, 0, 0.1);
    setYard(F.yard);
    setCamera(F);
    cam.aspect = Math.max(0.2, F.W / F.H);
    const run = F.run, snap = D.runKey !== run;
    D.runKey = run;
    if (snap) { D.over = false; D.streak = run.streak || 0; }
    chalk.solo.visible = !F.circle; chalk.circle.visible = !!F.circle;
    const used = new Set();
    for (const e of F.people) {
      const p = people[e.i]; if (!p) continue;
      used.add(e.i);
      // resting facing: in the circle everybody faces its centre (the back seat faces the viewer); solo: three quarters to the viewer
      let yaw;
      if (F.circle) { const cxz = { x: 0, z: 1.5 }; yaw = Math.atan2(cxz.x - e.x, -(cxz.z - e.z)); } else yaw = 0.4;
      p.drive(e, run, yaw, dt, snap);
    }
    people.forEach((p, i) => { if (!used.has(i)) p.h.root.visible = false; });
    stage.update(dt, { renderNow: false });                 // animated pose (clips, foot planting)
    for (const e of F.people) { const p = people[e.i]; if (p) { p.pose(dt, G.t); if (p.h.limbSanity) p.h.limbSanity(); } }   // procedural body layer over it, then clamp limbs
    // events: dust and the crowd
    for (const e of F.people) {
      const p = people[e.i]; if (!p) continue;
      for (const ev of p.takeEvents()) {
        if (ev.kind === 'scoop') puff(ev.C.x, 0.04, ev.C.z, 4, 0.2);
        else puff(p.pos.x + (Math.random() - 0.5) * 0.3, 0.03, p.pos.z, 3, 0.14, 0xd9ccb0, 0.25);
        if (crowd && ev.perfect) crowd.react('cheer', { intensity: 0.5, duration: 1.4 });
      }
    }
    if (crowd) {
      if (run.streak > D.streak && run.streak % 10 === 0 && run.streak > 0) crowd.react('cheer', { intensity: 0.9, duration: 2.4 });
      if (run.over && !D.over) crowd.react('groan', { intensity: 0.8 });
      crowd.setExcitement(Math.min(1, 0.15 + (run.streak || 0) * 0.02));
    }
    D.streak = run.streak || 0; D.over = !!run.over;
    // the shuttle
    const sh = run.sh;
    const lie = run.over && sh.y < 0.04 ? 1 : 0;
    D.shLie += (lie - D.shLie) * Math.min(1, dt * 8);
    shuttle.update({ ...sh, ang: sh.ang * (1 - D.shLie) }, G.t, dt, F.design);
    if (D.shLie > 0.01) { shuttle.root.rotation.z -= 1.35 * D.shLie; shuttle.root.position.y = 0.02 * D.shLie + 0.002; }
    shuttle.root.visible = F.shuttle !== false;
    const hh = Math.max(0, sh.y);
    shadowDisc.position.set(sh.x, 0.006, -sh.z);
    const ss = 0.13 + 0.06 * Math.min(2.5, hh);
    shadowDisc.scale.set(ss * 2, ss * 2, 1); shadowDisc.material.opacity = 0.42 * (1 - Math.min(0.6, hh * 0.25));
    if (lie && !D._landed) { puff(sh.x, 0.03, -sh.z, 4, 0.16); D._landed = true; } else if (!lie) D._landed = false;
    // dust animation
    for (const d of dust) {
      if (d.t >= d.dur) { d.m.visible = false; continue; }
      d.t += dt; const k = d.t / d.dur;
      d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt * (1 - k); d.m.position.z += d.vz * dt;
      const s = d.size * (0.6 + 1.6 * k); d.m.scale.set(s, s, 1); d.m.material.opacity = 0.5 * (1 - k) * (k < 0.1 ? k / 0.1 : 1);
    }
    // the set (leaves / snow, lanterns, sway) and the onlookers
    yardSet.update(dt, G.t, run.wx || 0);
    if (crowd) {
      const sc = (F.cam.s * 1.0) / Math.max(1, globalThis.devicePixelRatio ? 1 : 1);
      void sc;
      crowd.update(dt, cam);
    }
    if (blobs) { let bi = 0; people.forEach((p) => { if (p.h.root.visible) blobs.set(bi++, p.pos.x, p.pos.z, 0.4, 0.012); }); blobs.mesh.count = bi; }
    stage.render();
    perfTick(now);
  }

  P.people = people; P.crowd = () => crowd; P.shuttle = shuttle; P.yardSet = yardSet; P.puff = puff;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    let warned = false;
    game.render = (ctx, view) => { r(ctx, view); try { frame(game); } catch (e) { if (!warned) { warned = true; console.error('3D frame failed', e && e.stack); } } };
    return game;
  };
  return P;
}
