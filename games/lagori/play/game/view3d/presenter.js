// 3D presenter for Lagori. It only READS game.getState() (the inning, the match, the event log, the ball trail) and draws the street court
// and the players behind the transparent kit canvas. The kit canvas keeps the HUD, menus and input; this layer hands it the camera
// projection (view.gl) so rings, marks and words sit on the right pixels, and turns pointer positions back into court units.
// Without WebGL2, with ?nogl, or when the assets are slow (main.js waits at most 1.6 s) the 2D art plays instead.
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { TOWER, THROWER, SPOT, LINE_Y, STONES, RUNNERS, holderPos } from '../src/engine.js';
import { wx, wz, simX, simY, hz, S, STONE_H, BALL_R, VIS } from './world.js';
import { buildScene } from './scene.js';
import { Person, V } from './people.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const TEAM_KIT = {
  H: { top: '#ffa81c', bottoms: '#243070', socks: '#f6f1e4', shoes: '#f4efe4', trim: '#fff2c8' },   // saffron
  C: { top: '#15b4a5', bottoms: '#25252f', socks: '#f6f1e4', shoes: '#f4efe4', trim: '#d8fff8' },   // teal
};
const LOOKS = [
  { ch: 'athlete_f', skin: 'tan', hair: 'black' }, { ch: 'athlete_m', skin: 'brown', hair: 'black' }, { ch: 'athlete_f', skin: 'light', hair: 'brown' },
  { ch: 'athlete_m', skin: 'tan', hair: 'brown' },
  { ch: 'athlete_m', skin: 'light', hair: 'black' }, { ch: 'athlete_f', skin: 'brown', hair: 'black' }, { ch: 'athlete_m', skin: 'deep', hair: 'black' }, { ch: 'athlete_f', skin: 'tan', hair: 'brown' },
];
const POST_W = (k) => [wx(110 + k * 56), wz(850)];
const OUT_W = (k) => [wx(520 + k * 52), wz(884)];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false), gl: null };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 9.5, preserveDrawingBuffer: /[?&]shot=/.test(globalThis.location.search) }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const cam = stage.camera;
  cam.near = 0.5; cam.far = 220;
  stage.setLighting('day', { exposure: 0.86, hemi: 0.85, hemiSky: 0xfff1de, hemiGround: 0x8a5a3a, key: 0xffd5a0, keyI: 2.3, rim: 0xb4cfff, rimI: 0.7 });
  stage._shadowOffset = V(-4.5, 11, 6.5);
  stage.setAutoLOD(true);
  const world = buildScene(stage, THREE, { quality, V3 });
  // ---- onlookers: the neighbours watch over the wall (instanced crowd3d humans: varied ages, clothes, idle motion, they react to the game) -------------
  let crowd = null;
  try {
    const n = quality === 'low' ? 10 : quality === 'medium' ? 18 : 26;
    crowd = V3.createCrowd3d(stage, { rows: [{ from: [-2.0, 0.44, world.FRONT_Z + 1.5], to: [2.0, 0.44, world.FRONT_Z + 1.5], count: quality === 'low' ? 3 : 5, face: [0, 0, -4], seated: true }], free: { area: [-5.4, world.WALL_Z - 1.85, 5.4, world.WALL_Z - 0.55], y: 0.5, count: n, walkers: 0, face: [0, 0, 6] }, count: n + 5, seed: 21, culture: 'south_asian', quality: quality === 'high' ? 'medium' : 'low', props: { child: 0.06, phone: 0.06 }, excitement: 0.25 });
  } catch (e) { console.warn('crowd unavailable', e); crowd = null; }
  const blobs = quality === 'low' && stage.enableBlobShadows ? stage.enableBlobShadows(10, { radius: 0.4, opacity: 0.75 }) : null;

  const P = { stage, THREE, ready: false, lost: false, gl: { on: false, k: 1, band: { x: 0, y: 0, w: 720, h: 1280 }, licenses: '', fielders: [], vis: { runners: [] } } };
  stage.onContextLost(() => { P.lost = true; P.gl.on = false; });
  stage.onContextRestored(() => { try { const sc = stage.scene, old = sc.environment; if (old) { const pm = new THREE.PMREMGenerator(stage.renderer); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); if (old.dispose) old.dispose(); } } catch { /* keep the old light */ } // the image-based light dies with the context: rebuild it
    P.lost = false; stage.resize(); stage.invalidate(); });

  // ---- the eight players: three runners, the thrower, four fielders ---------------------------------------------------------------------------
  const people = [];                       // 0-2 runners, 3 thrower, 4-7 fielders
  async function build() {
    const hs = await Promise.all(LOOKS.map((lk) => loadHuman({ character: lk.ch, kit: { ...TEAM_KIT.H }, skin: lk.skin, hair: lk.hair, lod: 'auto', quality })));
    hs.forEach((h, i) => {
      h.groundClamp = 'auto'; h.footPlanting = true;
      h.play('idle', { fade: 0 });
      stage.add(h); stage.track(h);
      const p = new Person(h, { x: 0, z: 4 });
      p.id = i; p.team = 'H';
      h.root.visible = false;
      people.push(p);
    });
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });
  const runners = () => people.slice(0, 3), thrower = () => people[3], fielders = () => people.slice(4, 8);

  // ---- adaptive quality ---------------------------------------------------------------------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 24 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false;
        else if (perfLevel === 2) stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        else stage.renderer.setPixelRatio(1);
        stage.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- camera: fit the whole court into the band the layout gives the play area ---------------------------------------------------------------------
  const tmp = V(), proj = V();
  const REGION = [[24, 104, 0], [696, 104, 0], [24, 934, 0], [696, 934, 0], [24, 100, 1.5], [696, 100, 1.5]].map(([x, y, h]) => V(wx(x), h, wz(y)));
  const HERO = [[-3.3, 0, -3.5], [3.3, 0, -3.5], [-3.6, 0, 5.1], [3.6, 0, 5.1], [-3.3, 2.4, -3.5], [3.3, 2.4, -3.5]].map(([x, h, z]) => V(x, h, z));
  const cf = { key: '', ndcX: 0, ndcY: 0, fw: 1, fh: 1, bx: 0, by: 0, pitch: 0 };
  const map = { k: 1, left: 0, top: 0, cw: 720, ch: 1280 };
  let REG = REGION;
  const CLOSE = /[?&]cam=close/.test(globalThis.location.search);   // dev: follow the active runner closely (review of the run, bend and carry)
  function fitCamera(band, hero = false, drift = 0) {
    const fw = band.w * map.k, fh = band.h * map.k, aspect = fw / Math.max(1, fh), ba = band.h / Math.max(1, band.w);
    const land = band.w > band.h * 1.15;
    const vfov = land ? 19 : 21;
    let pitch = clamp(30 + (ba - 0.55) * 30, 36, 56) * Math.PI / 180;
    let target = V(0, 0.4, wz(520));
    if (hero) { pitch = (land ? 24 : 29) * Math.PI / 180; target = V(0, 0.5, 0.9); }
    cam.fov = vfov; cam.aspect = aspect;
    cam.clearViewOffset();
    const place = (d) => { cam.position.set(Math.sin(drift) * Math.cos(pitch) * d, target.y + Math.sin(pitch) * d, target.z + Math.cos(drift) * Math.cos(pitch) * d); cam.lookAt(target); cam.near = Math.max(0.5, d * 0.3); cam.far = d + 120; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); };
    const extent = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of (hero ? HERO : REG)) { proj.copy(p).project(cam); x0 = Math.min(x0, proj.x); x1 = Math.max(x1, proj.x); y0 = Math.min(y0, proj.y); y1 = Math.max(y1, proj.y); }
      return { x0, x1, y0, y1 };
    };
    let lo = 3, hi = 120;
    for (let i = 0; i < 24; i++) { const d = (lo + hi) / 2; place(d); const e = extent(); if ((e.x1 - e.x0) / 2 <= 0.985 && (e.y1 - e.y0) / 2 <= 0.985) hi = d; else lo = d; }
    place(hi);
    const e = extent();
    Object.assign(cf, { ndcX: (e.x0 + e.x1) / 2, ndcY: (e.y0 + e.y1) / 2, fw, fh, bx: band.x * map.k, by: band.y * map.k, pitch: pitch * 180 / Math.PI });
  }
  function applyView(shake) {
    const sx = (shake ? shake.x : 0) * map.k, sy = (shake ? shake.y : 0) * map.k;
    cam.setViewOffset(cf.fw, cf.fh, cf.fw / 2 * cf.ndcX - cf.bx - sx, -cf.fh / 2 * cf.ndcY - cf.by - sy, map.cw, map.ch);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const toVirt = (v) => { proj.copy(v).project(cam); const cx = (proj.x * 0.5 + 0.5) * map.cw, cy = (-proj.y * 0.5 + 0.5) * map.ch; return { x: (cx - map.left) / map.k, y: (cy - map.top) / map.k }; };
  const project = (x, y, zm = 0) => toVirt(tmp.set(wx(x), zm, wz(y)));
  const ray = V(), ro = V();
  const unproject = (vx, vy) => {
    const cx = vx * map.k + map.left, cy = vy * map.k + map.top;
    ray.set(cx / map.cw * 2 - 1, -(cy / map.ch * 2 - 1), 0.5).unproject(cam);
    ro.copy(cam.position); ray.sub(ro);
    const t = ray.y !== 0 ? -ro.y / ray.y : 0;
    return { x: simX(ro.x + ray.x * t), y: simY(ro.z + ray.z * t) };
  };

  // ---- per-inning state -----------------------------------------------------------------------------------------------------------------------------
  const D = { inn: null, strike: '', lastEv: 0, lastT: null, ballOwner: null, prevMode: '', passStart: null, rel: null, relAge: 0, windKey: null, armKey: -1, lastBall: V(), out: [false, false, false], dodgeSeen: [0, 0, 0] };
  function dress(p, team, look) { if (p.team === team && p.look === look) return; p.team = team; p.look = look; p.h.setKit(TEAM_KIT[team]); }
  function resetInning(inn, strike, G) {
    D.inn = inn; D.strike = strike; D.lastEv = G.evId; D.ballOwner = null; D.passStart = null; D.rel = null; D.windKey = null; D.armKey = -1; D.out = [false, false, false]; D.prevMode = '';
    const field = strike === 'H' ? 'C' : 'H';
    people.forEach((p, i) => {
      const isStrike = i < 4;
      dress(p, isStrike ? strike : field, i);
      p.h.root.visible = true; p.busyUntil = 0; p.t = 0; p.mode = ''; p.dodgeWas = false; p.armed = null;
      p.h.setReach('L', null); p.h.setReach('R', null); p.setBend(0, 0);
      let x, z;
      if (i < 3) { [x, z] = POST_W(i); if (i === 0) { x = wx(110); z = wz(850); } }
      else if (i === 3) { x = wx(THROWER.x); z = wz(THROWER.y + 18); }
      else { const f = inn.fielders[i - 4]; x = wx(f.x); z = wz(f.y); }
      p.pos.set(x, 0, z); p.h.setPosition(x, 0, z); p.speedLP = 0; p.shX = undefined; p.shownSp = 0; p.offX = 0; p.offZ = 0;
      if (i < 3 && inn.runners[i].state === 'run') { p.pos.set(wx(inn.runners[i].x), 0, wz(inn.runners[i].y)); p.h.setPosition(p.pos.x, 0, p.pos.z); }
      if (i < 3 && inn.runners[i].state === 'out') { [x, z] = OUT_W(i); p.pos.set(x, 0, z); p.h.setPosition(x, 0, z); }
      p.h.play('idle', { fade: 0 });
    });
    for (let k = 0; k < 4; k++) fielders()[k].faceYaw(Math.PI, true);
    for (let k = 0; k < 4; k++) people[k].faceYaw(Math.PI, true);
    if (world.ball.parent !== world.root) world.root.add(world.ball);
  }

  const handPos = (p, out = V()) => p.h.bonePosition('R_Hand', out);
  function attachBall(p) {
    if (D.ballOwner === p) return;
    if (D.ballOwner) D.ballOwner.h.detach(world.ball);
    if (world.ball.parent !== world.root) world.root.add(world.ball);
    world.ball.scale.setScalar(1);
    if (p) { p.h.attach(world.ball, 'R', 'ball'); }
    D.ballOwner = p;
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------------------------------------
  let lastNow = 0;
  function frame(game) {
    const gl = P.gl;
    if (!P.ready || P.lost) { gl.on = false; return; }
    const G = game.getState(), sc = G.scene;
    const L = layoutFor(meta.width, meta.height, G.left);
    let inn = null, band = null, strike = 'H';
    if (sc === 'title') { inn = G.demo.inn; band = L.title(false).band; }
    else if (sc === 'play' || sc === 'auto') { inn = G.inn; band = L.play(sc).band; strike = inn && inn.strikerIsHuman ? 'H' : 'C'; }
    if (!inn || !band) { gl.on = false; stage.setVisible(false); return; }
    const now = globalThis.performance.now();
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, chh = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    const rect = kitCanvas.getBoundingClientRect();
    if (cw !== map.cw || chh !== map.ch) { map.cw = cw; map.ch = chh; stage.resize(); }
    map.k = cw / meta.width; map.left = rect.left; map.top = rect.top;
    stage.setVisible(true);
    // animation clock = the game's clock (stops with the pause menu and with Auto Play's pause)
    let dt = D.lastT === null ? 0 : G.t - D.lastT; D.lastT = G.t;
    if (G.menu || (G.auto && G.auto.paused)) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);
    if (G.shotTrack && !D.shotPlayed) {   // store screenshots: replay the recorded lead-in so the frozen frame is mid-action
      D.shotPlayed = true; const tr = G.shotTrack;
      resetInning(tr[0], strike, G); D.inn = inn; D.lastEv = G.shotEv0 ?? D.lastEv;
      for (const c of tr) { director(G, c, 1 / 30); stage.update(1 / 30, { renderNow: false }); }
      D.lastEv = G.evId;
    }
    if (inn !== D.inn) resetInning(inn, strike, G);
    // camera (fitted when the band or the canvas changes)
    if (CLOSE) { const a = inn.phase === 'throw' ? THROWER : inn.runners[inn.active], ax = a ? wx(a.x) : 0, az = a ? wz(a.y) : 0; REG = [[-2.2, 0, -2.6], [2.2, 0, -2.6], [-2.2, 0, 2.2], [2.2, 0, 2.2], [-2.2, 2.0, -2.6], [2.2, 2.0, 2.2]].map(([x, h, z]) => V(ax + x, h, az + z)); cf.key = ''; }
    const key = `${sc}|${band.x.toFixed(1)},${band.y.toFixed(1)},${band.w.toFixed(1)},${band.h.toFixed(1)}|${map.cw}x${map.ch}|${map.k.toFixed(4)}`;
    const heroMode = sc === 'title';
    if (heroMode) { fitCamera(band, true, Math.sin(G.t * 0.22) * 0.07); cf.key = 'hero'; }
    else if (key !== cf.key) { cf.key = key; fitCamera(band); }
    applyView(G.shake);
    director(G, inn, dt);
    stage.setShadowTarget(0, 0, 0.5);
    // hand the projection to the HUD
    gl.on = true; gl.band = band; gl.project = project; gl.unproject = unproject;
    { const a = project(360, 480, 0), b2 = project(361, 480, 0); gl.k = Math.max(0.2, Math.abs(b2.x - a.x)); }
    gl.licenses = P.licenses || '';
    if (blobs) { let bi = 0; for (const p of people) if (p.h.root.visible) blobs.set(bi++, p.pos.x, p.pos.z, 0.4, 0.012); blobs.mesh.count = bi; }
    world.update(dt, G.t); if (crowd) crowd.update(dt);
    if (!P.noRender) { stage.update(dt, { renderNow: false }); stage.render(); perfTick(now); }
    lastNow = now;
  }
  P.frame = frame; P.people = people;

  // ---- the director: reads the simulation, poses the players, places the props --------------------------------------------------------------------
  function director(G, inn, dt) {
    const R = inn.runners, b = inn.ball, st = G.stage, gl = P.gl;
    const act = R[inn.active], rebuild = inn.phase !== 'throw';
    const aimOn = !!G.aim && st === 'live';
    const humanStrikes = G.scene === 'play' && inn.strikerIsHuman, humanFields = G.scene === 'play' && !inn.strikerIsHuman;
    const ballSim = V(wx(b.x), 0, wz(b.y));
    const hold = fielders()[inn.holder];
    // ---- events from the engine log (rings and words are drawn by the HUD; here only bodies react)
    for (const e of G.evlog) {
      if (e.id <= D.lastEv) continue; D.lastEv = e.id;
      if (e.t === 'out') {
        if (crowd) crowd.react('groan', { origin: [0, 0.5, world.WALL_Z - 1], radius: 40, intensity: 0.6 }); const p = runners()[e.id]; if (p) { p.mode = 'hit'; p.once('hit', { fade: 0.05, dur: 0.55 }); D.out[e.id] = true; }
      } else if (e.t === 'dodge') {
        const p = runners()[e.id], r = R[e.id];
        if (p && r) { const dx = r.dvx, dz = r.dvy, l = Math.hypot(dx, dz) || 1, lx = Math.cos(p.yaw), lz = -Math.sin(p.yaw); const left = (dx * lx + dz * lz) / l > 0; p.once(left ? 'dodgeL' : 'dodgeR', { fade: 0.05, dur: 0.5 }); p.mode = 'dodge'; }
      } else if (e.t === 'throw') {
        const t3 = thrower(); if (!(t3.mode === 'throw' && t3.busy)) t3.throwIn(0.045, dt);
        D.rel = { off: handPos(t3).clone().sub(V(wx(THROWER.x), 0.75, wz(THROWER.y - 18))), age: 0 };
      } else if (e.t === 'fthrow') {
        const f = hold; if (!(f.mode === 'throw' && f.busy)) f.throwIn(0.045, dt);
        D.rel = { off: handPos(f).clone().sub(V(wx(e.x), hz(26) + BALL_R * VIS, wz(e.y))), age: 0 };
      } else if (e.t === 'knock') {
        if (crowd) crowd.react('gasp', { origin: [0, 0.5, world.WALL_Z - 1], radius: 40, intensity: 0.8 });
        world.puff(wx(TOWER.x), 0.05, wz(TOWER.y), { n: 9, speed: 0.9 + Math.min(1.6, (e.speed || 0) * 0.004), size: 0.55, life: 1.0, up: 0.5 });
      } else if (e.t === 'bounce' || e.t === 'place') {
        world.puff(wx(e.x ?? TOWER.x), 0.03, wz(e.y ?? TOWER.y), { n: 3, speed: 0.4, size: 0.28, life: 0.6, up: 0.3 });
      } else if (e.t === 'catch') {
        const f = hold; f.h.setTarget('catch', V(f.pos.x + Math.sin(f.yaw) * 0.3, 1.1, f.pos.z + Math.cos(f.yaw) * 0.3)); f.once('catch_two_hand', { fade: 0.14, dur: 0.55 }); f.mode = 'catch';
      }
    }
    // ---- the ball: where it is drawn (before the players, who chase and reach for it)
    let ballW = V(ballSim.x, hz(b.z) + BALL_R * VIS, ballSim.z), ownerHand = null, wantOwner = null;
    const ballInAir = b.mode === 'flight';
    if (b.mode === 'held') wantOwner = inn.phase === 'throw' ? thrower() : hold;
    if (b.mode === 'pass') {
      if (!D.passStart || D.prevMode !== 'pass') { const h = holderPos(inn); D.passStart = { x: b.x, y: b.y, total: Math.hypot(b.x - h.x, b.y - h.y) || 1 }; }
      const h = holderPos(inn), prog = clamp(1 - Math.hypot(b.x - h.x, b.y - h.y) / D.passStart.total, 0, 1), hand = handPos(hold);
      ballW.lerp(V(hand.x, Math.max(0.2, hand.y), hand.z), smooth(prog));
    }
    if (b.mode === 'flight' && D.rel) { D.rel.age += dt; ballW.addScaledVector(D.rel.off, Math.exp(-D.rel.age * 7)); }
    if (b.mode !== 'flight') D.rel = null;
    D.prevMode = b.mode;
    if (wantOwner !== D.ballOwner) attachBall(wantOwner);
    // ---- the players
    const r3 = runners(), f4 = fielders(), th = thrower();
    const over = !!inn.result || st === 'result' || st === 'over';
    // runners
    for (let k = 0; k < RUNNERS; k++) {
      const r = R[k], p = r3[k];
      if (!p) continue;
      let tx, tz;
      if (r.state === 'run') { tx = wx(r.x); tz = wz(r.y); } else if (r.state === 'wait') { [tx, tz] = POST_W(k); } else { [tx, tz] = OUT_W(k); }
      const sp = p.step(tx, tz, dt, r.state === 'run' ? 9 : 4.5);
      p.update(dt);
      let bendW = 0, reach = null, rw = 0;
      if (r.state === 'run') {
        const moving = p.speedLP > 0.35;
        if (moving && r.dodge <= 0) { const vx = r.vx, vy = r.vy; if (Math.abs(vx) + Math.abs(vy) > 5) p.faceYaw(Math.atan2(vx, vy)); }
        else if (!moving && r.dodge <= 0) p.faceTo(wx(TOWER.x), wz(TOWER.y));
        if (!p.busy) { if (moving) p.loco(clamp(p.speedLP, 0, 7)); else p.idle('ready_stance'); }
        if (r.carry >= 0) {
          const d = Math.hypot(r.x - SPOT.x, r.y - SPOT.y), u = smooth(1 - clamp((d - 8) / 90, 0, 1));
          const stackTop = stackHeight(inn);
          const base = V(p.pos.x + Math.sin(p.yaw) * 0.34, lerp(1.02, stackTop + STONE_H * 0.5 + 0.2, u), p.pos.z + Math.cos(p.yaw) * 0.34);
          D.carryPos = D.carryPos || []; D.carryPos[k] = base;
          reach = base; rw = 1; bendW = 0.2 + 0.7 * u;
        } else if (r.queue.length) {
          const s = inn.stones[r.queue[0]];
          if (s && s.state === 'ground') {
            const d = Math.hypot(r.x - s.x, r.y - s.y), u = smooth(1 - clamp(d / 78, 0, 1));
            reach = V(wx(s.x), 0.1, wz(s.y)); rw = u; bendW = 0.95 * u;
          }
        }
      } else if (r.state === 'wait') {
        p.faceTo(wx(THROWER.x), wz(THROWER.y - 120));
        if (!p.busy) { if (p.speedLP > 0.35) p.loco(p.speedLP); else if (over && inn.result && inn.result.kind === 'lagori' && D.strike) p.idle('celebrate_2'); else p.idle('idle_relaxed'); }
      } else {   // out
        if (!p.busy) {
          if (p.speedLP > 0.35) { p.loco(p.speedLP); p.faceYaw(Math.atan2(tx - p.pos.x, tz - p.pos.z)); }
          else { p.faceTo(wx(TOWER.x + 60), wz(TOWER.y + 200)); p.idle('idle_relaxed'); }
        }
      }
      p.setBend(bendW, 0.1);
      p.reachBoth(reach, rw, reach && r.carry >= 0 ? 0.17 : 0.12);
      void sp;
    }
    // thrower: on the line with the ball; the wind-up while a throw is being aimed
    {
      const [tx, tz] = [wx(THROWER.x), wz(THROWER.y + 18)];
      th.step(tx, tz, dt, 4); th.update(dt);
      let cock = false, eta = null;
      if (inn.phase === 'throw' && b.mode === 'held' && st === 'live') {
        if (humanStrikes && aimOn) cock = true;
        if (G.scene === 'play' && !inn.strikerIsHuman && G.cpuWait > 0) { cock = true; eta = (G.calm ? 0.66 : 1.1) - G.cpuWait; }
        if (G.scene === 'auto' && G.auto && G.auto.dec && G.auto.dec.kind === 'throw' && (G.auto.sub === 'think' || G.auto.sub === 'reveal')) { cock = true; eta = G.auto.sub === 'reveal' ? 2 - G.auto.timer : 99; }
      }
      if (inn.phase === 'throw') {
        const aimW = G.aim ? V(wx(G.aim.x), 0, wz(G.aim.y)) : V(wx(TOWER.x), 0, wz(TOWER.y));
        th.faceTo(aimW.x, aimW.z);
      } else th.faceTo(wx(act ? act.x : TOWER.x), wz(act ? act.y : TOWER.y));
      if (!th.busy) {
        if (eta !== null && eta < 0.34 && th.armed !== inn.throwsLeft) { th.armed = inn.throwsLeft; th.throwIn(Math.max(0.03, eta), dt); }
        else if (cock) th.idle('cock', 0.2);
        else if (over && inn.result) th.idle(inn.result.kind === 'lagori' ? 'celebrate_2' : 'idle_relaxed');
        else th.idle(inn.phase === 'throw' ? 'ready_stance' : 'idle_relaxed');
      }
    }
    // fielders: hold their posts, chase a loose ball, take it, wind up and throw
    const loose = rebuild && (b.mode === 'roll' || b.mode === 'rest' || b.mode === 'pass') && !b.hit;
    let chaser = -1;
    if (loose) {
      if (b.mode === 'pass') chaser = inn.holder;
      else { let bd = 1e9; inn.fielders.forEach((f, k) => { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd) { bd = d; chaser = k; } }); }
    }
    gl.fielders = [];
    f4.forEach((p, k) => {
      const f = inn.fielders[k];
      let tx = wx(f.x), tz = wz(f.y), speed = 4.1;
      if (k === chaser) { tx = ballW.x; tz = ballW.z; speed = 5.4; }
      const sp = p.step(tx, tz, dt, speed); p.update(dt);
      const isHolder = k === inn.holder && b.mode === 'held';
      // facing: the holder faces his target, the others watch the ball
      let fx = ballW.x, fz = ballW.z;
      if (act && act.state === 'run' && rebuild && (isHolder || b.mode === 'held')) { fx = wx(act.x); fz = wz(act.y); }
      if (isHolder && G.aim && humanFields && st === 'live') { fx = wx(G.aim.x); fz = wz(G.aim.y); }
      if (inn.phase === 'throw') { fx = wx(TOWER.x); fz = wz(TOWER.y); }
      if (p.speedLP > 0.5) p.faceYaw(Math.atan2(tx - p.pos.x, tz - p.pos.z)); else p.faceTo(fx, fz);
      if (!p.busy) {
        let cock = false, eta = null;
        if (isHolder && rebuild && st === 'live') {
          if (humanFields && G.aim) cock = true;
          if (inn.wind) { cock = true; eta = inn.wind.dur - inn.wind.t; }
          if (G.scene === 'auto' && G.auto && G.auto.dec && G.auto.dec.kind === 'field' && (G.auto.sub === 'think' || G.auto.sub === 'reveal')) { cock = true; eta = G.auto.sub === 'reveal' ? 2 - G.auto.timer : 99; }
        }
        const wk = inn.wind || (G.auto && G.auto.dec) || null;
        if (eta !== null && eta < 0.34 && D.windKey !== wk) { D.windKey = wk; p.throwIn(Math.max(0.03, eta), dt); }
        else if (p.speedLP > 0.4) p.loco(p.speedLP);
        else if (cock) p.idle('cock', 0.2);
        else if (over && inn.result && inn.result.kind !== 'lagori') p.idle('celebrate_2');
        else p.idle(inn.phase === 'throw' ? 'idle_relaxed' : 'field_ready');
      }
      void sp;
      gl.fielders[k] = { x: simX(p.pos.x), y: simY(p.pos.z) };
    });
    // nobody stands inside anybody else (display only, the walking position is untouched so nobody shuffles): the player on the court keeps
    // his place, the others are drawn a little to the side
    { const all = people, keep = r3[inn.active] && R[inn.active].state === 'run' ? r3[inn.active] : null, off = all.map(() => [0, 0]);
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], c = all[j], dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = 0.62;
        if (d >= m) continue;
        const ux = d < 1e-4 ? 1 : dx / d, uz = d < 1e-4 ? 0 : dz / d, px = ux * (m - d), pz = uz * (m - d);
        if (a === keep) { off[j][0] += px; off[j][1] += pz; } else if (c === keep) { off[i][0] -= px; off[i][1] -= pz; } else { off[i][0] -= px / 2; off[i][1] -= pz / 2; off[j][0] += px / 2; off[j][1] += pz / 2; }
      }
      // the nudge is eased (a person never jumps sideways), and what the feet really travel (sim motion + nudge) drives the locomotion clip and the
      // facing, so the legs only move when the position changes and the body points where it is going
      const k = 1 - Math.exp(-dt * 4.5);
      all.forEach((p, i) => {
        p.offX = (p.offX || 0) + (off[i][0] - (p.offX || 0)) * k; p.offZ = (p.offZ || 0) + (off[i][1] - (p.offZ || 0)) * k;
        const X = p.pos.x + p.offX, Z = p.pos.z + p.offZ;
        if (dt > 0 && p.shX !== undefined) {
          const dx = X - p.shX, dz = Z - p.shZ, sp = Math.hypot(dx, dz) / dt;
          p.shownSp = (p.shownSp || 0) + (Math.min(sp, 12) - (p.shownSp || 0)) * Math.min(1, dt * 12);
          if (sp > 0.8 && sp < 12) p.heading = Math.atan2(dx, dz);
        }
        p.shX = X; p.shZ = Z;
        p.h.setPosition(X, 0, Z);
        if (p.shownSp > 1.1 && p.heading !== undefined && !p.busy && p.mode !== 'dodge') p.faceYaw(p.heading);
      });
    }
    gl.vis.runners = r3.map((p) => ({ x: simX(p.pos.x), y: simY(p.pos.z) }));
    // ---- the ball mesh
    const bm = world.ball;
    if (D.ballOwner) { /* it is in the hand */ }
    else {
      bm.visible = true; bm.position.copy(ballW);
      bm.scale.setScalar(1); bm.position.y = Math.max(bm.position.y, BALL_R * VIS);
      if (b.mode === 'flight' || b.mode === 'roll') { bm.rotation.x += dt * (Math.hypot(b.vx, b.vy) * S * 14); bm.rotation.z += dt * 3; }
    }
    // ball shadow disc and trail
    {
      const sh = world.bShadow, bp = D.ballOwner ? handPos(D.ballOwner) : bm.position, hgt = Math.max(0, bp.y);
      sh.visible = !D.ballOwner; sh.position.set(bp.x, 0.012, bp.z); const s2 = 1 + hgt * 0.35; sh.scale.set(s2, s2, 1); sh.material.opacity = clamp(0.5 - hgt * 0.14, 0.12, 0.5);
    }
    const tr = G.trail || [];
    for (let i = 0; i < world.trail.length; i++) {
      const sp = world.trail[i], q = tr[i];
      if (!q) { sp.visible = false; continue; }
      const age = clamp(1 - (G.t - q.t) / 0.45, 0, 1);
      if (age <= 0.02) { sp.visible = false; continue; }
      sp.visible = true; sp.position.set(wx(q.x), hz(q.z) + BALL_R * VIS, wz(q.y));
      sp.material.color.set(q.hit ? 0xff9a6a : 0xfff4cf); sp.material.opacity = 0.9 * age; const sc2 = 0.16 + 0.3 * age; sp.scale.set(sc2, sc2, 1);
    }
    // ---- the stones
    placeStones(G, inn, dt);
    world.beacon.visible = inn.stones.some((q) => q.state === 'tower');
    // shake of the camera is applied through the view offset; a knock also tosses the lights a little (none)
  }
  function stackHeight(inn) { let n = 0; for (const s of inn.stones) if (s.state === 'tower' || s.state === 'placed') n++; return n * STONE_H; }
  const spin = [0, 0, 0, 0, 0, 0, 0];
  function placeStones(G, inn, dt) {
    const stack = inn.stones.filter((s) => s.state === 'tower' || s.state === 'placed').map((s) => s.i).sort((a, c) => a - c);
    inn.stones.forEach((s) => {
      const m = world.stones[s.i];
      m.visible = true; m.rotation.set(0, 0, 0);
      m.userData.pool.visible = s.state === 'ground';
      if (s.state === 'tower' || s.state === 'placed') {
        const k = stack.indexOf(s.i);
        m.position.set(wx(TOWER.x), STONE_H * (k + 0.5), wz(TOWER.y)); m.rotation.y = s.rot * 1.2;
      } else if (s.state === 'carried') {
        const k = s.by, cp = D.carryPos && D.carryPos[k];
        if (cp) { m.position.copy(cp); } else m.position.set(wx(s.x), 1.0, wz(s.y));
        m.rotation.y = runners()[k] ? runners()[k].yaw : 0; m.rotation.x = 0.12;
      } else {
        const mv = Math.hypot(s.vx, s.vy), lift = Math.min(0.55, mv * 0.0021);
        spin[s.i] += mv * dt * 0.012;
        m.position.set(wx(s.x), STONE_H * 0.5 + lift, wz(s.y));
        m.rotation.y = s.rot * 1.2 + spin[s.i] * 0.6;
        if (mv > 6) { m.rotation.x = Math.sin(spin[s.i] * 2.1 + s.i) * Math.min(0.9, mv * 0.006); m.rotation.z = Math.cos(spin[s.i] * 1.7 + s.i * 2) * Math.min(0.9, mv * 0.006); }
      }
    });
  }

  // the credits text for the About page
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; P.gl.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      frame(game);
      view.gl = P.gl;
      r(ctx, view);
    };
    return game;
  };
  return P;
}
