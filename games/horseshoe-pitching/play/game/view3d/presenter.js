// 3D presenter for Horseshoe Pitching. It READS the simulation (game.getState()) and shows a county-fair lawn with a real pitcher, steel shoes
// and the clay pit; it never writes back to the sim. One WebGL canvas sits BEHIND the kit's transparent 2D canvas (which keeps the HUD, the
// menus and every input). In play the same scene is drawn twice per frame into two viewports: the lane (a camera over the pitcher's
// shoulder that follows the shoe) and the pit board (a tilted top view; its inverse is what the aim drag uses).
// Without WebGL, or when the context is lost, the game keeps drawing its flat 2D lane and board.
import { buildWorld, CLAY_Y } from './world.js';
import { createShoeKit, createShoeMaterials, makeShoe, SHOE_T } from './shoe.js';
import { loadPitcher, P_WIND, P_REL, P_FOLLOW } from './pitcher.js';
import { LANE, SWING } from '../src/sim.js';
import { layoutFor } from '../src/layout.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TEAM_COL = [{ main: 0x2f80d6 }, { main: 0xdf3d33 }];
const CLAY_TINT = { clay: '#d6905e', sand: '#f0d9a2', hard: '#bf8467', daily: '#d49a68' };
const FRAME_TOP = 0.11;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE, board3d: B } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 8 });
  if (!stage.supported || stage.failed) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const P = { stage, THREE, ready: false, lost: false, quality, errors: 0, active: true, stats: { frames: 0 } };
  const scene = stage.scene, R = stage.renderer;
  const cam = new THREE.PerspectiveCamera(40, 1, 0.08, 400);
  stage.camera = cam;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---- light: low golden sun from the far left, soft sky fill, warm rim
  stage.setLighting('day', { exposure: 1.02, hemi: 0.82, keyI: 3.1, key: 0xffe2b0, rim: 0xffc98a, rimI: 0.9, sky: 0xbfd6ea, fog: 0xe9d8b4 });
  stage.setSky(0xa9c8e4, 0xe9d8b4, { near: 40, far: 150 });
  const key = stage.lights.key, rim = stage.lights.rim;
  key.position.set(-9, 8.5, 6); rim.position.set(7, 6, -16);
  if (key.shadow) key.shadow.camera.far = 60;
  scene.environmentIntensity = 0.6;

  // ---- world
  const world = buildWorld({ THREE, B, quality });
  scene.add(world.group);
  const kit = createShoeKit(THREE);
  const mats = createShoeMaterials(THREE, TEAM_COL);
  const sc = V3.buildScenery({
    layers: [
      { t: 'sky', id: 'sky-golden' },
      { t: 'backdrop', id: 'bd-meadow-day', mix: ['bd-alpine-day'], seed: 3 },
      { t: 'band', id: 'band-hills-green', r: 96, h: 24, arc: [-175, -5] },
      { t: 'band', id: 'band-birch', r: 62, h: 14, arc: [-170, -10] },
      { t: 'cutouts', id: 'tr-broad-tree', count: 5, r: [26, 46], scale: [5, 9], seed: 11, sway: 0.6, arc: [-160, -20] },
      { t: 'cutouts', id: 'st-farmhouse', count: 2, r: [40, 52], arc: [-150, -30], scale: [10, 12], seed: 2 },
    ],
    timeOfDay: 'day', quality: quality === 'high' ? 'high' : 'medium', radius: 120, wind: 0.5,
  });
  scene.add(sc.group);
  P.scenery = sc; P.world = world;
  const SCEN_FRONT = { lane: 0, side: Math.PI / 2 };   // the scenery's best view is its -Z front: turned a quarter for the side-on menu camera

  // ---- shoes: resting shoes (pooled by sim id), the flying shoe, shoes in hand
  const shoeObjs = new Map();
  const flyG = new THREE.Group(); flyG.visible = false; scene.add(flyG);
  const flyShoe = makeShoe(THREE, kit, mats, 0); flyShoe.position.z = 0.02; flyG.add(flyShoe);
  const flyTrail = [];
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.5, depthWrite: false }));
  trail.frustumCulled = false; trail.visible = false; scene.add(trail);
  const decalGeo = new THREE.CircleGeometry(0.11, 20);
  const decalMat = new THREE.MeshBasicMaterial({ color: 0x3a1c0a, transparent: true, opacity: 0.26, depthWrite: false });
  const ghost = new THREE.Group(); ghost.visible = false; scene.add(ghost);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  {
    const gm = makeShoe(THREE, kit, mats, 0);
    gm.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; o.receiveShadow = false; } });
    ghost.add(gm);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.092, 0.1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; ghost.add(ring); ghost.userData.ring = ring;
  }

  // ---- particles: dust puffs and sparks (sprite pool), a flash light and a shock ring for a ringer's clang
  const puffTex = world.T.puff;
  const POOL = 110, sprites = [];
  for (let i = 0; i < POOL; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; scene.add(s); sprites.push(s);
  }
  const flash = new THREE.PointLight(0xfff0c0, 0, 2.2, 2); scene.add(flash);
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  wave.rotation.x = -Math.PI / 2; wave.visible = false; scene.add(wave);
  let waveT = 9, flashT = 9;

  // ---- people: two pitchers (blue on the right platform, red on the left), loaded in the background
  const pit = { list: [], loading: null };
  const KITS = [{ top: '#2f6fc4', bottoms: '#e6e2d4', socks: '#f2f2f2' }, { top: '#d8453a', bottoms: '#2c3a4c', socks: '#f2f2f2' }];
  const lod = quality === 'high' ? 0 : 1;
  pit.loading = (async () => {
    for (let i = 0; i < 2; i++) {
      const A = await loadPitcher(V3, { character: i ? 'athlete_f' : 'athlete_m', kit: KITS[i], skin: i ? 'light' : 'tan', hair: i ? 'brown' : 'black', lod });
      A.h.root.position.set(i ? -0.8 : 0.8, 0.045, 0.05);
      A.h.setFacing(Math.PI + (i ? -0.1 : 0.1));
      stage.add(A.h); stage.track(A.h);
      A.heldShoe = makeShoe(THREE, kit, mats, i);
      A.attachShoe(A.heldShoe);
      A.i = i; A.look = V(0, 1, -LANE);
      pit.list.push(A);
      P.ready = pit.list.length === 2; stage.invalidate();
    }
  })().catch((e) => { console.warn('pitchers failed to load', e); });
  P.pitchers = pit;

  // ---- crowd: neighbours at the picnic tables and along the far fence (instanced real people), built after the pitchers
  const crowd = { c: null };
  P.crowdReady = (async () => {
    try {
      await pit.loading; await new Promise((r) => setTimeout(r, 400));
      const pts = [];
      const add = (x, zsim, tx, tzsim, seated = 0, y = 0) => pts.push({ x, y, z: -zsim, yaw: Math.atan2(tx - x, -tzsim + zsim), seated });
      add(-4.6, 1.55, -1.5, 3.0, 1); add(-5.2, 1.55, -1.5, 3.0, 1); add(-4.0, 3.2, -1.5, 3.0, 1);
      add(-5.4, 3.9, 0, 4.0); add(-3.6, 4.4, 0, 5.0); add(-6.1, 2.8, -1.0, 3.0);
      for (const [x, zs] of [[-3.2, LANE + 4.4], [-1.8, LANE + 4.9], [2.4, LANE + 4.7], [3.8, LANE + 4.2], [5.2, LANE + 4.9], [-6.0, LANE + 4.5]]) add(x, zs, 0, 0, 0);
      
      const n = quality === 'low' ? 6 : quality === 'medium' ? 10 : 14;
      crowd.c = V3.createCrowd3d({ scene, camera: cam }, { points: pts, count: n, seed: 21, culture: ['american_rural', 'european_village'], quality: quality === 'high' ? 'medium' : 'low', excitement: 0.2, props: { flag: 0.08, phone: 0.12, child: 0.08 }, flagColors: ['#d8362f', '#f6eed8', '#2f6fb4'] });
      stage.invalidate();
    } catch (e) { console.warn('crowd unavailable', e); }
  })();

  // ---- viewports: the stage's own render is replaced by one that draws each view into its rectangle
  const views = [];
  let cssW = 1, cssH = 1, lastScale = 1;
  const SHADOW = { lane: { cx: 0, cz: -5.5, ext: 9 }, board: { cx: 0, cz: -LANE, ext: 1.4 }, full: { cx: 0, cz: -4, ext: 9 } };
  function shadowView(v) {
    const s = SHADOW[v.shadow || 'lane'], sk = key.shadow;
    key.target.position.set(s.cx, 0, s.cz);
    key.position.set(s.cx - 9, 8.5, s.cz + 6);
    if (sk && sk.camera) { Object.assign(sk.camera, { left: -s.ext, right: s.ext, top: s.ext, bottom: -s.ext }); sk.camera.updateProjectionMatrix(); }
    key.target.updateMatrixWorld();
  }
  stage.render = () => {
    if (stage.contextLost || !views.length) return false;
    R.setScissorTest(false);
    R.setViewport(0, 0, cssW, cssH);
    R.setClearColor(0x0d1722, 1); R.clear();
    R.setScissorTest(true);
    for (const v of views) {
      R.setViewport(v.x, v.y, v.w, v.h); R.setScissor(v.x, v.y, v.w, v.h);
      cam.position.copy(v.pos); cam.fov = v.fov; cam.aspect = v.w / Math.max(1, v.h); cam.near = 0.08; cam.far = 400;
      cam.lookAt(v.look);
      if (v.offset) cam.setViewOffset(v.offset.fw, v.offset.fh, v.offset.x, v.offset.y, v.w, v.h); else cam.clearViewOffset();
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      shadowView(v);
      sc.group.visible = v.scenery !== false; sc.group.rotation.y = v.sceneYaw || 0;
      R.render(scene, cam);
    }
    R.setScissorTest(false);
    stage.stats.renders++; stage.dirty = false;
    return true;
  };
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });

  // ---- pixel budget + auto tier: the buffer stays about phone sized on big screens; slow devices step down
  const PIXELS = 2.4e6;
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0, budgetR = 1;
  function sizeBudget(w, h) {
    const k = `${w}x${h}|${perfLevel}`;
    if (k !== sizeKey) {
      sizeKey = k; stage.resize();
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2, perfLevel ? 1.25 : 2);
      budgetR = Math.max(1, Math.min(dpr, Math.sqrt(PIXELS / Math.max(1, w * h))));
    }
    if (Math.abs(R.getPixelRatio() - budgetR) > 0.01) { R.setPixelRatio(budgetR); stage.invalidate(); }
  }
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 26 && perfLevel < 2) {
        perfLevel++; sizeKey = '';
        if (perfLevel === 2) { R.shadowMap.enabled = false; key.castShadow = false; scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
        stage.invalidate();
      }
    }
  }

  // ---- state -> scene -------------------------------------------------------------------------------------------------------
  const restY = (s) => (s.dead ? ((Math.abs(s.x) > 0.5 || Math.abs(s.v) > 0.98) ? 0.0 : FRAME_TOP) : CLAY_Y);
  function syncShoes(list, dt) {
    const alive = new Set();
    const sorted = [...list].sort((a, b) => a.id - b.id);
    for (const s of sorted) {
      alive.add(s.id);
      let o = shoeObjs.get(s.id);
      if (!o) {
        const g = makeShoe(THREE, kit, mats, s.side);
        const d = new THREE.Mesh(decalGeo, decalMat); d.rotation.x = -Math.PI / 2; d.scale.set(1.0, 1.4, 1);
        scene.add(g); scene.add(d);
        o = { g, d, x: s.x, v: s.v, ang: s.ang, y: restY(s), init: true };
        shoeObjs.set(s.id, o);
      }
      let y = restY(s);
      for (const q of sorted) { if (q.id >= s.id) break; if (!q.dead && !s.dead && Math.hypot(q.x - s.x, q.v - s.v) < 0.1) y += SHOE_T * 0.9; }
      const k = 1 - Math.exp(-dt * 22);
      if (o.init) { o.init = false; o.x = s.x; o.v = s.v; o.ang = s.ang; o.y = y; }
      const dx = s.x - o.x, dv = s.v - o.v;
      o.x += dx * k; o.v += dv * k; o.ang += (s.ang - o.ang) * k; o.y += (y - o.y) * (1 - Math.exp(-dt * 16));
      const hop = clamp(Math.hypot(dx, dv) * 1.6, 0, 0.12);
      o.g.position.set(o.x, o.y + hop, -(LANE + o.v));
      o.g.rotation.set(0, -o.ang, 0);
      o.d.position.set(o.x, CLAY_Y + 0.0015, -(LANE + o.v)); o.d.rotation.z = -o.ang; o.d.visible = !s.dead && Math.abs(s.x) < 0.42;
    }
    for (const [id, o] of shoeObjs) if (!alive.has(id)) { scene.remove(o.g); scene.remove(o.d); shoeObjs.delete(id); }
  }

  const flyPos = V(), handOff = V();
  function syncFlight(fly) {
    if (!fly) { flyG.visible = false; trail.visible = false; flyTrail.length = 0; return; }
    flyG.visible = true;
    const k = fly.k, e = (1 - k) * (1 - k);
    flyPos.set(fly.pos.x + handOff.x * e, fly.pos.y + CLAY_Y * k + handOff.y * e, -fly.pos.z + handOff.z * e);
    if (flyPos.x !== flyPos.x || flyPos.y !== flyPos.y || flyPos.z !== flyPos.z) console.warn('NaN flight', JSON.stringify({ fly, handOff }));
    flyG.position.copy(flyPos);
    flyG.rotation.order = 'YXZ';
    flyG.rotation.set(fly.phi, -(fly.land ? fly.land.ang * k : 0), 0);
    flyG.scale.setScalar(1.3);
    flyShoe.userData.body.material = mats.paint[fly.team ?? 0];
    flyTrail.unshift(flyPos.clone()); if (flyTrail.length > 14) flyTrail.pop();
    const pos = trailGeo.attributes.position;
    for (let i = 0; i < 14; i++) { const p = flyTrail[Math.min(i, flyTrail.length - 1)]; pos.setXYZ(i, p.x, p.y, p.z); }
    trailGeo.computeBoundingSphere();
    pos.needsUpdate = true; trail.visible = true;
  }

  const dustCol = new THREE.Color(0xd9b48a);
  function syncParticles(list) {
    let n = 0;
    for (const q of list) {
      if (n >= POOL) break;
      const s = sprites[n++], u = clamp(q.t / q.max, 0, 1);
      s.visible = true; s.position.set(q.x, q.y + 0.03, -q.z);
      if (q.kind === 1) {
        s.material.color.setRGB(1, 0.86 - 0.2 * u, 0.5); s.material.blending = THREE.AdditiveBlending;
        s.material.opacity = (1 - u) * 0.95; const z = 0.035 * (1 - 0.4 * u); s.scale.set(z, z, 1);
      } else {
        s.material.color.copy(dustCol).multiplyScalar(0.9); s.material.blending = THREE.NormalBlending;
        s.material.opacity = (1 - u) * 0.5; const z = (0.1 + 0.34 * u) * (q.size || 1); s.scale.set(z, z, 1);
      }
    }
    for (let i = n; i < POOL; i++) sprites[i].visible = false;
  }

  // sim events -> small flourishes (clang flash, stake wobble, crowd reactions)
  let seenEv = 0, evInit = false;
  function playEvents(evq) {
    if (!evq) return;
    if (!evInit) { evInit = true; for (const e of evq) seenEv = Math.max(seenEv, e.id); return; }   // history before the first frame is not replayed
    for (const e of evq) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      const far = world.far;
      if (e.type === 'ring' || e.type === 'ringer') {
        flashT = 0; waveT = 0; far.wobble = 1; flash.position.set(0, 0.25, -LANE);
        if (crowd.c) crowd.c.react('cheer', { origin: [0, 0, -LANE], radius: 60, intensity: 1 });
      } else if (e.type === 'tink' || e.type === 'clank') {
        far.wobble = Math.max(far.wobble, e.type === 'clank' ? 0.85 : 0.5); flashT = 0.6; flash.position.set(e.x ?? 0, 0.2, -(LANE + (e.v ?? 0)));
        if (e.type === 'clank' && crowd.c) crowd.c.react('gasp', { origin: [0, 0, -LANE], radius: 40, intensity: 0.6 });
      } else if (e.type === 'out' && crowd.c) crowd.c.react('groan', { origin: [0, 0, -LANE], radius: 40, intensity: 0.7 });
    }
  }
  function stepFx(dt) {
    flashT += dt; waveT += dt;
    flash.intensity = flashT < 0.35 ? (1 - flashT / 0.35) * 6 : 0;
    if (waveT < 0.9) { wave.visible = true; wave.position.set(0, CLAY_Y + 0.004, -LANE); const w = 0.06 + waveT * 0.6; wave.scale.set(w, w, w); wave.material.opacity = (1 - waveT / 0.9) * 0.8; } else wave.visible = false;
    const far = world.far;
    if (far.wobble > 0.001) {
      far.wobble *= Math.exp(-dt * 4.2); far.wobT += dt * 38;
      far.stakeGroup.rotation.z = Math.sin(far.wobT) * 0.05 * far.wobble;
      far.stakeGroup.rotation.x = far.lean + Math.cos(far.wobT * 0.9) * 0.03 * far.wobble;
    } else { far.stakeGroup.rotation.z = 0; far.stakeGroup.rotation.x = far.lean; }
  }

  // ---- pitchers -------------------------------------------------------------------------------------------------------------
  const tmpH = V();
  function pFromArm(a) {
    const d = a.deg;
    if (a.phase === 'back') return P_WIND * clamp(-d / 70, 0, 1);
    if (a.phase === 'fwd') return d < 56 ? lerp(P_WIND, P_REL, clamp((d + 70) / 126, 0, 1)) : lerp(P_REL, P_FOLLOW, clamp((d - 56) / 14, 0, 1));
    if (a.phase === 'hold') return P_FOLLOW;
    return lerp(P_FOLLOW, 1.0, clamp(1 - d / SWING.A, 0, 1));
  }
  // progress toward the target through a critically damped spring with a speed cap: no pops, no phase snaps
  function stepPitchers(dt, ctx) {
    for (const A of pit.list) {
      const active = ctx.side === A.i;
      let target = 0, held = (ctx.left[A.i] ?? 0) > 0;
      if (active && ctx.arm && ctx.arm.live) target = pFromArm(ctx.arm);
      else if (active && ctx.afterRelease != null) {
        const u = ctx.afterRelease;
        target = u < 0.25 ? P_FOLLOW : lerp(P_FOLLOW, 1.0, ss(0.25, 1.5, u));
        if (u < 1.3) held = false;
      } else if (active && ctx.preRelease != null) target = ctx.preRelease;
      else if (A.p > 0.5) target = 1.0;
      if (A.p >= 0.995 && target < 0.2) { A.p = 0; A.pv = 0; }
      const w = 20, x = A.p - target;
      A.pv += (-2 * w * A.pv - w * w * x) * dt;
      A.pv = clamp(A.pv, -2.0, 2.0);
      A.p = clamp(A.p + A.pv * dt, 0, 1.0);
      A.setP(A.p);
      A.heldShoe.visible = held;
      if (A.wasHeld !== held) { A.wasHeld = held; A.h.setFingers('R', held ? A.GRIP : 'open', { rate: held ? 8 : 18 }); }
      if (ctx.lookAt) {
        A.look.lerp(ctx.lookAt, 1 - Math.exp(-dt * 8));
        A.h.lookAt({ x: A.look.x, y: A.look.y, z: A.look.z }, { weight: active && ctx.arm ? 0.2 : 0.8, maxYaw: 1.0, maxPitch: 0.6 });
      }
    }
  }

  // ---- cameras (sim space in, world out) ----------------------------------------------------------------------------------------
  const camS = { pos: V(3.4, 1.55, -3.1), look: V(0.25, 0.85, 4.8), fov: 34, init: false };
  function laneCamTarget(ctx, aspect) {
    const vf = clamp((2 * Math.atan(Math.tan((54 * Math.PI) / 360) / Math.max(0.6, aspect)) * 180) / Math.PI, 28, 56);
    const px = ctx.side === 1 ? -0.8 : 0.8;
    if (ctx.fly) {
      const k = ctx.fly.k, p = ctx.fly.pos, e = ss(0, 1, k);
      return { pos: V(lerp(3.8, 2.4, e), lerp(1.6, 1.9, e), lerp(-3.35, LANE * 0.4, e)), look: V(lerp(0.45, p.x * 0.6, e), lerp(0.9, Math.max(1.0, p.y * 0.7), e), lerp(3.2, p.z * 0.85 + 1.0, e * 0.9)), fov: vf };
    }
    if (ctx.landed) {
      const L = ctx.landed;
      return { pos: V(1.2, 0.95, LANE - 2.4), look: V(L.x * 0.5, 0.15, LANE + L.v * 0.4), fov: clamp(vf * 0.8, 24, 46) };
    }
    return { pos: V(px > 0 ? 3.8 : 3.4, 1.6, -3.35), look: V(px > 0 ? 0.45 : 0.1, 0.9, 3.2), fov: vf };
  }
  // Pit board camera: tilted top view fitted to the pit window (x +-0.5, v -0.66..0.66), looking away from the pitcher
  const board = { el: 56, pos: V(), look: V(), fov: 28, cam: new THREE.PerspectiveCamera(28, 1, 0.1, 50), ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -CLAY_Y) };
  const bc = V(0, CLAY_Y, -LANE), bdir = V(0, Math.sin((56 * Math.PI) / 180), Math.cos((56 * Math.PI) / 180)), bp = V();
  const CORNERS = [[-0.52, -0.7], [0.52, -0.7], [-0.52, 0.7], [0.52, 0.7]];
  function fitBoard(w, h) {
    const t = board.cam; t.aspect = w / Math.max(1, h); t.fov = board.fov;
    let D = 2.2;
    for (let it = 0; it < 6; it++) {
      t.position.copy(bc).addScaledVector(bdir, D); t.lookAt(bc); t.updateMatrixWorld(); t.updateProjectionMatrix();
      let m = 0;
      for (const [x, v] of CORNERS) { bp.set(x, CLAY_Y, -(LANE + v)).project(t); m = Math.max(m, Math.abs(bp.x), Math.abs(bp.y)); }
      D *= clamp(m / 0.97, 0.5, 2);
    }
    board.pos.copy(bc).addScaledVector(bdir, D); board.look.copy(bc);
    t.position.copy(board.pos); t.lookAt(bc); t.updateMatrixWorld(); t.updateProjectionMatrix();
  }
  const nd = V();
  function boardInv(rect, px, py) {
    if (!rect) return null;
    const nx = ((px - rect.x) / rect.w) * 2 - 1, ny = -(((py - rect.y) / rect.h) * 2 - 1);
    board.ray.setFromCamera({ x: nx, y: ny }, board.cam);
    if (!board.ray.ray.intersectPlane(board.plane, nd)) return null;
    return { x: nd.x, v: -nd.z - LANE };
  }

  // ---- the per-frame driver ---------------------------------------------------------------------------------------------------
  let lastT = null, attractCam = 0, handDone = false;
  function frame(game, view) {
    const s = game.getState();
    P.stats.frames++;
    let dt = lastT === null ? 0 : s.t - lastT; lastT = s.t;
    if (dt < 0 || dt > 0.25) dt = 0;
    cssW = canvas.clientWidth || globalThis.innerWidth; cssH = canvas.clientHeight || globalThis.innerHeight;
    sizeBudget(cssW, cssH); perfTick();
    const k = cssW / Math.max(1, view.width || cssW);
    lastScale = k;
    const L = layoutFor(view.width, view.height);
    views.length = 0;
    const play = s.scene === 'play' && s.m;
    const src = play ? s : (s.att || { shoes: [], fly: null, parts: [], anim: null });
    world.setClay(CLAY_TINT[play ? s.pit : 'clay'] || CLAY_TINT.clay);

    const ctx = { side: 0, left: [2, 2], arm: null, afterRelease: null, preRelease: null, lookAt: null, fly: null, landed: null };
    if (play) {
      const m = s.m;
      ctx.side = m.idx < 2 ? m.first : 1 - m.first; ctx.left = m.left; ctx.arm = s.arm;
      if (s.anim) { ctx.afterRelease = s.anim.t; if (s.anim.t < 0.95) ctx.fly = s.fly; else if (s.anim.plan) ctx.landed = s.anim.plan.land; }
    } else if (s.att) {
      const a = s.att;
      ctx.side = a.anim ? a.anim.side : a.n % 2;
      if (a.anim) { ctx.afterRelease = a.anim.t; if (a.anim.t < 0.95) ctx.fly = a.fly; else if (a.anim.plan) ctx.landed = a.anim.plan.land; }
      else ctx.preRelease = lerp(0, P_REL, ss(0, 1, 1 - clamp(a.wait / 1.25, 0, 1)));
    }
    // the hand hands the shoe to the flight: remember where the real hand was at the instant of release
    const A = pit.list[ctx.side];
    if (ctx.afterRelease == null) handDone = false;
    else if (!handDone && A && src.fly) {
      handDone = true;
      const hp = A.h.bonePosition('R_Hand', tmpH);
      if (hp && hp.x === hp.x && hp.y === hp.y && hp.z === hp.z) { handOff.set(hp.x - src.fly.pos.x, hp.y - src.fly.pos.y, hp.z + src.fly.pos.z); handOff.clampLength(0, 1.4); }
      else handOff.set(0, 0, 0);
    }
    ctx.lookAt = ctx.fly ? V(ctx.fly.pos.x, ctx.fly.pos.y, -ctx.fly.pos.z) : V(0, 0.3, -LANE);
    if (pit.list.length) stepPitchers(dt, ctx);
    world.update(s.t);
    sc.update(dt, cam);
    stepFx(dt);
    playEvents(src.evq);
    syncShoes(src.shoes || [], dt);
    syncFlight(src.fly || null);
    syncParticles(src.parts || []);

    const mk = (rect, over = {}) => ({ x: Math.round(rect.x * k), y: Math.round(cssH - (rect.y + rect.h) * k), w: Math.max(2, Math.round(rect.w * k)), h: Math.max(2, Math.round(rect.h * k)), ...over });
    s.gl = s.gl || {};
    if (play) {
      const Pl = L.play;
      const tg = laneCamTarget(ctx, Pl.lane.w / Pl.lane.h);
      const r = 1 - Math.exp(-dt * (ctx.fly ? 7 : 3.2));
      if (!camS.init) { camS.pos.copy(tg.pos); camS.look.copy(tg.look); camS.fov = tg.fov; camS.init = true; }
      camS.pos.lerp(tg.pos, r); camS.look.lerp(tg.look, r); camS.fov = lerp(camS.fov, tg.fov, r);
      views.push(mk(Pl.lane, { pos: V(camS.pos.x, camS.pos.y, -camS.pos.z), look: V(camS.look.x, camS.look.y, -camS.look.z), fov: camS.fov, shadow: 'lane' }));
      fitBoard(Pl.board.w * k, Pl.board.h * k);
      const showT = s.humanTurn || (s.think && s.think.phase !== 'think');
      if (showT && s.m.phase === 'aim') {
        ghost.visible = true;
        ghost.position.set(s.target.tx, CLAY_Y + 0.004, -(LANE + s.target.tv));
        ghostMat.color.setHex(TEAM_COL[ctx.side].main).lerp(new THREE.Color(0xffffff), 0.4);
        const rr = 0.1;
        ghost.userData.ring.scale.set(rr / 0.1, rr / 0.1, 1);
      } else ghost.visible = false;
      views.push(mk(Pl.board, { pos: board.pos, look: board.look, fov: board.fov, shadow: 'board', scenery: false }));
      s.gl.boardInv = (px, py) => boardInv(Pl.board, px, py);
    } else {
      ghost.visible = false; s.gl.boardInv = null;
      attractCam += dt;
      // The menus: a side-on view of the pitcher (low, a long lens) placed in the free window the hero sheet leaves, or centred behind the scrim.
      const W = view.width, H = view.height;
      const hw = s.scene === 'title' && s.heroWin ? s.heroWin : null;
      const win = hw || { x: W * 0.1, y: H * 0.25, w: W * 0.8, h: H * 0.5 };
      const sway = Math.sin(attractCam * 0.2), d = 9.5 + Math.sin(attractCam * 0.13) * 0.4;
      const subjH = Math.max(2.4, 2.6 * (win.w / win.h) / 2.2);        // metres of world that should fill the window height
      const fullH = subjH * (H / Math.max(1, win.h));
      const vf = clamp((2 * Math.atan(fullH / 2 / d) * 180) / Math.PI, 14, 70);
      const pos = V(0.7 + d, 1.25 + sway * 0.12, 0.35 + sway * 0.6), look = V(0.7, 1.0, -0.35 + sway * 0.2 - 1.0);
      const off = { fw: Math.round(W * k), fh: Math.round(H * k), x: Math.round((W / 2 - (win.x + win.w / 2)) * k), y: Math.round((H / 2 - (win.y + win.h / 2)) * k) };
      views.push(mk({ x: 0, y: 0, w: W, h: H }, { pos, look, fov: vf, shadow: 'full', offset: off, sceneYaw: SCEN_FRONT.side }));
    }
    s.gl.on = true;
    if (crowd.c) { cam.position.copy(views[0].pos); crowd.c.update(dt); }
    stage.update(dt);
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.gl = P.active && !P.lost && stage.ok && !stage.contextLost;
      if (view.gl) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
      r(ctx, view);
      if (!view.gl) { canvas.style.visibility = 'hidden'; const st = game.getState(); if (st.gl) st.gl.on = false; return; }
      canvas.style.visibility = 'visible';
      try { frame(game, view); } catch (e) { P.errors++; if (P.errors < 4) console.warn('3D frame failed', e); if (P.errors > 20) P.active = false; }
    };
    return game;
  };
  P.scale = () => lastScale;
  P.dbg = { ghost, wave, flash, trail, sprites, key, rim, world, scene, sc, views };
  return P;
}
