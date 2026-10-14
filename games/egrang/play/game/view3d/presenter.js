// 3D presenter for Egrang. The 2D art keeps the sky, hills, road, terrain, rails, bunting and effects; this layer draws the PEOPLE as real 3D
// bodies (view3d athletes on bamboo stilts, a mannequin crowd) into a small off-screen WebGL canvas and composites them into the 2D scene at the
// right depth: the crowd before the fence and bunting, the racers after the road and terrain. The camera is the same oblique projection as the
// 2D art (same metres across, same lane offsets and lane scales), so shadows, landing rings, name tags and water line up exactly.
// If WebGL2 or the assets are missing (or the context is lost) createPresenter resolves with `ready === false` and the 2D figures keep playing.
import { LOOKS, groundH } from '../src/courses.js';
import { laneScale } from '../src/art.js';
import { PHYS } from '../src/sim.js';
import { WalkerRig } from './walker.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

const SHIRTS = ['#f3b21b', '#2fa79a', '#d9455f', '#6d4bd1', '#38a85a', '#e8791c', '#f06fa0', '#2c7fd1', '#fff3da'];
const SKINS = ['#b9774a', '#8a5532', '#d49a6a', '#a56a40', '#c68856', '#7a4a2c'];
const HAIRS = ['#1c120c', '#2a1a10', '#15100c', '#3a2314'];

export async function createPresenter({ quality = pickQuality() } = {}) {
  const P = { ready: false, lost: false, quality, licenses: '', stats: { racers: 0, crowd: 0 } };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D figures', e); return P; }
  const { createStage, loadHuman, addCap, THREE } = V3;
  const doc = globalThis.document;
  const canvas = doc.createElement('canvas');
  let stage;
  try { stage = createStage({ canvas, container: doc.body, quality, dprCap: 2, lighting: 'day', transparent: true, shadows: false, mode: 'ondemand' }); } catch (e) { return P; }
  if (!stage.supported) return P;
  stage.resize = () => stage;                       // the off-screen canvas is sized by drawRacers/drawCrowd
  stage.setLighting('day', { exposure: 1.0, hemi: 1.25, keyI: 2.6, rimI: 1.1 });
  stage.scene.background = null; stage.scene.fog = null;
  stage._shadowOffset = new THREE.Vector3(5, 9, 8);
  stage.setShadowTarget(0, 0, 0);
  const renderer = stage.renderer;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  // The bundled three.js has no OrthographicCamera: a PerspectiveCamera whose projection matrix is set to an orthographic one does the same job.
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, 0, 12); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
  const ortho = (l, r, t, b, n, f) => {
    cam.projectionMatrix.set(2 / (r - l), 0, 0, -(r + l) / (r - l), 0, 2 / (t - b), 0, -(t + b) / (t - b), 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  };
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  // ---- the people: racers (lane x sex) and a crowd of mannequins ---------------------------------------------------------------------
  const racers = new Map();     // `${lane}:${sex}` -> rig
  const crowdRows = [{ n: 22, sp: 0.6, off: 0.0, back: 0.16, scale: 0.6 }, { n: 22, sp: 0.62, off: 0.3, back: 0.0, scale: 0.57 }];
  const crowd = [];             // { h, row, j, key, clip }
  const racerGroup = new THREE.Group(), crowdGroup = new THREE.Group();
  stage.scene.add(racerGroup, crowdGroup);

  async function build() {
    const jobs = [];
    for (let lane = 0; lane < 4; lane++) for (const sex of ['m', 'f']) {
      jobs.push((async () => {
        const s = laneScale(lane);
        const h = await loadHuman({ character: sex === 'f' ? 'athlete_f' : 'athlete_m', scale: s, kit: { top: '#e8791c', bottoms: '#243a5e', socks: '#f2f2f2' }, skin: '#b9774a', hair: '#1c120c' });
        h.groundClamp = 'off'; h.footPlanting = false;
        h.play('idle', { fade: 0 });
        const rig = new WalkerRig(h, { lane, s });
        rig.sex = sex; rig.key = '';
        rig.setVisible(false);
        racerGroup.add(h.root, rig.poles.N, rig.poles.F);
        racers.set(`${lane}:${sex}`, rig);
      })());
    }
    await Promise.all(jobs);
    const per = quality === 'low' ? 11 : quality === 'medium' ? 16 : crowdRows[0].n;
    for (let row = 0; row < 2; row++) {
      const R = crowdRows[row];
      const hs = await Promise.all([...Array(per)].map((_, j) => loadHuman({ character: (j + row) % 3 === 1 ? 'mannequin_f' : 'mannequin_m', scale: R.scale, kit: { top: '#2c7fd1', bottoms: '#3a3a4a' }, skin: '#b9774a', hair: '#1c120c', legs: 'long' })));
      hs.forEach((h, j) => {
        h.groundClamp = 'off'; h.footPlanting = false; h.play('idle_relaxed', { fade: 0, startPhase: hash(j * 3 + row) });
        h.root.visible = false; crowdGroup.add(h.root);
        crowd.push({ h, row, j, key: '', clip: 'idle_relaxed', per });
      });
    }
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed; using the 2D figures', e && e.message, e && e.stack); P.ready = false; return false; });

  // ---- off-screen canvas sizing and the orthographic camera that reproduces the 2D mapping -------------------------------------------------
  let curW = 0, curH = 0;
  function frame(ctx, S, camera2d) {
    const sc = (ctx.getTransform && ctx.getTransform().a) || 1;                 // device pixels per virtual unit
    const k = clamp(sc, 0.5, quality === 'low' ? 1.0 : 2.0);
    const pw = Math.max(2, Math.round(S.w * k)), ph = Math.max(2, Math.round(S.h * k));
    if (pw !== curW || ph !== curH) { curW = pw; curH = ph; renderer.setSize(pw, ph, false); }
    const ppm = camera2d.ppm;
    // world y of the stage's top / bottom edge: screen y = gy - y * ppm
    ortho(camera2d.x, camera2d.x + S.w / ppm, (camera2d.gy - S.y) / ppm, (camera2d.gy - (S.y + S.h)) / ppm, 2, 40);
    return { pw, ph };
  }
  function present(ctx, S, pw, ph) {
    renderer.render(stage.scene, cam);
    ctx.drawImage(canvas, 0, 0, pw, ph, S.x, S.y, S.w, S.h);
  }

  // ---- racers ---------------------------------------------------------------------------------------------------------------------------
  const dressRacer = (rig, look, key) => {
    if (rig.key === key) return;
    rig.key = key;
    const h = rig.h;
    h.setKit({ top: look.shirt, bottoms: look.shorts, socks: '#f2f2f2' });
    h.setSkin(look.skin); h.setHair(look.hair);
    if (rig.acc) { rig.acc.remove(); rig.acc = null; }
    if (look.style === 'cap') { try { rig.acc = addCap(h, { color: parseInt(look.accent.slice(1), 16) }); } catch { /* optional */ } }
  };
  let lastWorld = null;
  P.drawRacers = (ctx, S, camera2d, C, list, W, t, o = {}) => {
    if (!P.ready || P.lost) return false;
    const { pw, ph } = frame(ctx, S, camera2d);
    const wt = W && W.t !== undefined ? W.t : t;
    const newWorld = W !== lastWorld; lastWorld = W;
    const used = new Set();
    const x0 = camera2d.x - 3, x1 = camera2d.x + S.w / camera2d.ppm + 3;
    let n = 0;
    for (const r of list) {
      const look = LOOKS[r.look] ?? LOOKS[0];
      const sex = look.style === 'long' ? 'f' : 'm';
      const rig = racers.get(`${r.lane}:${sex}`);
      if (!rig) continue;
      const dt = clamp(rig.lastT === undefined || newWorld ? 0 : wt - rig.lastT, 0, 0.1);
      rig.lastT = wt;
      if (newWorld || rig.rid !== r.id || rig.lastX === undefined || Math.abs(r.x - rig.lastX) > 6) { rig.initState(); rig.rid = r.id; }
      rig.lastX = r.x;
      if (o.fresh) rig.initState();
      if (r.x < x0 || r.x > x1) continue;
      dressRacer(rig, look, `${r.id}:${r.look}`);
      rig.setVisible(true); used.add(rig);
      const down = r.phase === 'down';
      // depth: nearer lanes in front (the rig works in x/y; z orders the lanes for the depth test)
      rig.step(r, C, { dt, laneDy: camera2d.laneDy, zb: (r.lane - 3) * 0.7, fallDur: down && W && W.mode === 'practice' && r.id === 0 ? PHYS.DOWN_T_PRACTICE : PHYS.DOWN_T });
      n++;
    }
    for (const rig of racers.values()) if (!used.has(rig)) rig.setVisible(false);
    for (const c of crowd) c.h.root.visible = false;
    P.stats.racers = n;
    present(ctx, S, pw, ph);
    return true;
  };

  // ---- crowd --------------------------------------------------------------------------------------------------------------------------
  let lastCrowdT = 0, cf = 0;
  P.drawCrowd = (ctx, S, camera2d, C, t, o = {}) => {
    if (!P.ready || P.lost) return false;
    const { pw, ph } = frame(ctx, S, camera2d);
    const dt = clamp(t - lastCrowdT, 0, 0.1); lastCrowdT = t;
    for (const rig of racers.values()) rig.setVisible(false);
    const exc = o.excite ?? 0.3;
    const x0 = camera2d.x - 1.5, x1 = camera2d.x + S.w / camera2d.ppm + 1.5;
    const laneDy = camera2d.laneDy;
    let shown = 0; cf++;
    for (const c of crowd) {
      const R = crowdRows[c.row], per = c.per;
      const base = Math.floor(camera2d.x / R.sp) - 1;
      const idx = base + (((c.j - base) % per) + per) % per;
      const mx = idx * R.sp + R.off;
      const hv = hash(idx * 1.9 + c.row * 17 + (C.seed || 0));
      if (hv < 0.12 || mx < -6 || mx > C.length + 8 || mx < x0 || mx > x1) { c.h.root.visible = false; continue; }
      const key = `${idx}:${c.row}`;
      if (c.key !== key) {
        c.key = key;
        const hh = hash(idx * 7.3 + c.row * 3);
        c.h.setKit({ top: SHIRTS[Math.floor(hv * 97) % SHIRTS.length], bottoms: hh > 0.5 ? '#3a4a6a' : '#6a5a3a' });
        c.h.setSkin(SKINS[Math.floor(hv * 53 + hh * 11) % SKINS.length]); c.h.setHair(HAIRS[Math.floor(hh * 31) % HAIRS.length]);
        c.kid = hv > 0.8; c.cheerW = hh;
        c.h.model.scale.setScalar(R.scale * (c.kid ? 0.72 : 1) * (0.94 + hh * 0.1));
      }
      const y = 3 * laneDy + 0.34 + R.back + groundH(C, mx) * laneScale(0);
      c.h.root.visible = true;
      c.h.root.position.set(mx, y, -4.2 - c.row * 0.6);
      c.h.setFacing((hv - 0.5) * 0.9);
      const want = exc > 0.3 && c.cheerW > 0.35 ? (c.cheerW > 0.7 ? 'cheer' : 'clap') : 'idle_relaxed';
      if (want !== c.clip) { c.clip = want; c.h.play(want, { fade: 0.3, loop: true }); }
      if ((cf + c.j) % 2 === 0) c.h.update(dt * 2);
      shown++;
    }
    P.stats.crowd = shown;
    present(ctx, S, pw, ph);
    return true;
  };

  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((tx) => { P.licenses = tx; }).catch(() => {}); } catch { /* ignore */ }
  P.stage = stage; P.THREE = THREE; P.racers = racers; P.crowd = crowd; P.cam = cam;
  return P;
}
