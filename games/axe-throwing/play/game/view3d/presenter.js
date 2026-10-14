// 3D presenter for Axe Throwing. It only READS the game state (the world, the flight, the stuck axes, the event queue) and draws the lodge,
// the lane, the target board, two real throwers, the axes and the wood chips behind the transparent kit canvas, which keeps the HUD, the
// reticle, the menus and every input. Without WebGL2, with ?nogl, or while the context is lost the 2D art plays and this layer takes over
// again when it is back.
//
// Framing: the camera looks straight down the lane (its image plane is parallel to the board) and its lens is shifted so the board's
// face lands EXACTLY on the board rectangle the 2D layer computed. Board coordinates, the reticle, the hint ring and the score pops
// therefore line up with the 3D board without any projection code in the 2D layer.
import { meta } from '../src/layout.js';
import { GL } from '../src/glbridge.js';
import { VENUES, RIVALS } from '../src/sim.js';
import { buildWorld, YC, KM } from './world.js';
import { createAxeKit } from './axe.js';
import { makeFx } from './fx.js';
import { Thrower, T_COIL, T_REL, T_END, RELEASE_DELAY } from './actors.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const QS = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
const CQ = (() => { try { return QS.get('cb') ? +QS.get('cb') : 6.0; } catch { return 6.0; } })();
export const CAM_BACK = CQ;        // the camera stands this far behind the throwing line
const HEAD_Y = 1.72;
const FACE_Z = 0.025;               // board face plane in board-group coordinates
const EMBED = 0.03;                 // how far the bit sinks into the wood
const SIDE_X = { you: -0.45, rival: 0.45 };

function pickQuality() {
  const m = QS.get('q'); if (m === 'low' || m === 'medium' || m === 'high') return m;
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

// the way the thrower carries the axe: handle angle (radians about X, + = head leaning forward) against the clip time
const HELD = [[0, 0.12], [0.2, -0.2], [T_COIL, -0.7], [T_COIL + 0.07, -0.55], [T_REL - 0.05, 0.0], [T_REL, 0.4], [T_REL + 0.25, 1.1]];
function heldAngle(t) {
  if (t <= HELD[0][0]) return HELD[0][1];
  for (let i = 0; i < HELD.length - 1; i++) {
    const a = HELD[i], b = HELD[i + 1];
    if (t <= b[0]) return lerp(a[1], b[1], smooth((t - a[0]) / (b[0] - a[0])));
  }
  return HELD[HELD.length - 1][1];
}
const LOOKS = [{ rig: 'rf' }, { rig: 'rf' }, { rig: 'rm' }, { rig: 'rm' }];
const windNow = (V0, t) => (V0.wind ? V0.wind * (0.8 * Math.sin((t * TAU) / V0.windPeriod) + 0.2 * Math.sin((t * TAU) / (V0.windPeriod * 0.37) + 1)) : 0);
const boardOffsetNow = (V0, t) => (V0.rail ? V0.rail * Math.sin((t * TAU) / V0.railPeriod) : 0);

export async function createPresenter({ kitCanvas, quality = pickQuality(), standalone = false } = {}) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const doc = globalThis.document;
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  if (kitCanvas) { kitCanvas.parentElement.insertBefore(canvas, kitCanvas); kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1'; } else doc.body.appendChild(canvas);
  const shotMode = QS.has('shot') || QS.has('dev') || standalone;
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', mode: 'continuous', shadowSize: 4, preserveDrawingBuffer: shotMode, fov: 30 }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera, scene = stage.scene;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  cam.near = 0.2; cam.far = 90;

  const world = buildWorld(V3, stage, { quality });
  const kit = createAxeKit(V3, { quality });
  const fx = makeFx(THREE, scene, { quality, glowTex: world.glowTex });
  if (renderer.shadowMap.enabled) { const sc = stage.lights.key.shadow.camera; sc.left = -3.2; sc.right = 3.2; sc.top = 3.4; sc.bottom = -2.6; sc.near = 1; sc.far = 30; sc.updateProjectionMatrix(); stage.lights.key.shadow.bias = -0.0005; stage.lights.key.shadow.normalBias = 0.02; stage.lights.key.shadow.radius = 4; }

  const P = { stage, THREE, world, kit, fx, ready: false, lost: false, quality, licenses: '', V3, rigs: {}, camX: 0, cur: null, board: { amp: 0, t: 0 }, grip: QS.get('grip') ? QS.get('grip').split(',').map(Number) : [0.08, 0, 0] };
  stage.onContextLost(() => { P.lost = true; GL.on = false; });
  stage.onContextRestored(() => { P.lost = false; P.cw = 0; stage.resize(); stage.invalidate(); });

  // ---- the people -------------------------------------------------------------------------------------------------------------------
  let crowd = null;
  async function build() {
    const mk = async (character, top, skin, hair, x, nm) => {
      const h = await loadHuman({ character, kit: { top, bottoms: '#2d3b57', socks: '#d9d2c2' }, skin, hair, lod: 'auto', quality });
      h.groundClamp = 'auto'; h.footPlanting = false;
      stage.add(h); stage.track(h); h.setLOD(0); h.setPosition(x, 0, 0); h.setFacing(Math.PI);
      return { h, th: new Thrower(V3, h, nm), x };
    };
    P.rigs.you = await mk('athlete_m', '#d9a441', 'tan', 'brown', SIDE_X.you, 'throw-you');
    P.rigs.rf = await mk('athlete_f', '#35c9b6', 'light', 'ginger', SIDE_X.rival, 'throw-rf');
    P.rigs.rm = await mk('athlete_m', '#c0603c', 'brown', 'black', SIDE_X.rival, 'throw-rm');
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- adaptive quality ---------------------------------------------------------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0; P.avgMs = avg;
      if (avg > 26 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) renderer.shadowMap.enabled = false;
        else renderer.setPixelRatio(perfLevel === 2 ? Math.min(1.25, renderer.getPixelRatio()) : 1);
        scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- axes: a small pool per (kind, side) ---------------------------------------------------------------------------------------
  const pool = new Map();
  function takeAxe(kind, side, rivalIdx) {
    const key = `${kind}|${side}`;
    let list = pool.get(key); if (!list) { list = []; pool.set(key, list); }
    const a = list.pop() || kit.build(kind, side);
    a.userData.poolKey = key; a.visible = true;
    a.userData.band.color.set(side === 'you' ? '#ffb83a' : RIVALS[rivalIdx | 0].col);
    return a;
  }
  function giveAxe(a) {
    if (!a) return;
    a.visible = false; if (a.parent) a.parent.remove(a);
    const list = pool.get(a.userData.poolKey); if (list && !list.includes(a)) list.push(a);
  }
  const ghosts = [];
  const mkGhosts = (src) => { for (const g of ghosts) scene.remove(g); ghosts.length = 0; for (const op of [0.3, 0.18, 0.09]) { const g = kit.ghost(src, op); scene.add(g); ghosts.push(g); } };
  const hideGhosts = () => { for (const g of ghosts) g.visible = false; };

  const stuck = new Map();        // sim board entry -> { axe, a0, sag, ... }
  const falling = [];             // axes that bounced: tumble back and lie on the floor
  const live = { axe: null, kind: -1, side: '', fl: null, start: null, aEnd: 0, held: { pos: new THREE.Vector3(), a: 0 } };
  const T = { v: new THREE.Vector3(), v2: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() };
  const setRx = (obj, a, roll = 0) => { T.e.set(-a, 0, roll, 'XYZ'); obj.quaternion.setFromEuler(T.e); };

  // ---- the camera -----------------------------------------------------------------------------------------------------------------
  const CU = QS.get('cu') ? QS.get('cu').split(',').map(Number) : null;       // QA: ?cu=px,py,pz,tx,ty,tz[,fov] free camera
  function setCamera(br, cw, ch, cx, cy, D) {
    const Db = CAM_BACK + D, f = (br.s / KM) * Db;
    cam.position.set(cx, cy, CAM_BACK); cam.rotation.set(0, 0, 0); cam.up.set(0, 1, 0);
    cam.aspect = cw / ch; cam.fov = 2 * Math.atan((meta.height / 2) / f) / D2R; cam.updateProjectionMatrix();
    const bcx = br.x + br.w / 2, bcy = br.y + br.h / 2;
    const ppx = bcx - (f * (0 - cx)) / Db, ppy = bcy + (f * (YC - cy)) / Db;
    const e = cam.projectionMatrix.elements;
    e[8] = -(2 * ppx / meta.width - 1); e[9] = -(1 - 2 * ppy / meta.height);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);
  }

  // ---- one thrower's clip: the wind-up follows the finger, the swing meets the sim's launch ----------------------------------------
  const rigOf = (ws, side) => (side === 'you' ? P.rigs.you : P.rigs[LOOKS[ws.rival | 0].rig]);
  const Dd = { you: { clipT: 0, mode: 'idle', coil0: 0, fSeen: null }, rival: { clipT: 0, mode: 'idle', coil0: 0, fSeen: null } };
  function drive(ws, side, dt) {
    const d = Dd[side];
    const f = ws.f && ws.f.side === side ? ws.f : null;
    if (f && f !== d.fSeen) { d.fSeen = f; d.mode = 'swing'; d.coil0 = Math.min(d.clipT, T_COIL); }
    if (d.mode === 'swing') {
      if (f === d.fSeen && f.t < RELEASE_DELAY) { const u = clamp(f.t / RELEASE_DELAY, 0, 1); d.clipT = d.coil0 + (T_REL - d.coil0) * u * u; }
      else { d.mode = 'follow'; d.clipT = T_REL + (f === d.fSeen ? Math.max(0, f.t - RELEASE_DELAY) : 0.05); }
    } else if (d.mode === 'follow') {
      d.clipT += dt;
      if (d.clipT >= T_END - 1e-3) { d.mode = 'idle'; d.clipT = 0; }
    }
    if (d.mode === 'idle') {
      let p = 0;
      if (ws.phase === 'aim' && ws.side === side && !ws.over) {
        if (side === 'you') p = ws.aim.down ? clamp(ws.aim.mt / 0.42, 0, 1) : 0;
        else if (ws.rv) p = clamp((ws.rv.t - (ws.rv.dur - 0.62)) / 0.45, 0, 1);
      }
      const tgt = smooth(p) * T_COIL;
      d.clipT += (tgt - d.clipT) * (dt > 0 ? 1 - Math.exp(-dt * (tgt > d.clipT ? 12 : 7)) : 0);
      if (d.clipT < 1e-4) d.clipT = 0;
    }
    return d;
  }
  function scrub(rig, t) {
    const cur = rig.h.layers.base.current;
    if (!cur || !cur.clip || cur.clip.name !== rig.th.clipName) { rig.h.play(rig.th.clipName, { fade: 0, loop: false }); }
    const tr = rig.h.layers.base.current;
    if (tr && tr.clip) { tr.speed = 0; tr.time = clamp(t, 0, T_END - 1e-3); }
  }
  const bQ = new THREE.Quaternion(), bE = new THREE.Euler();
  function breathe(rig, t, amt) {
    const b = rig.h.bones;
    const add = (name, x, y, z) => { const bo = b[name]; if (!bo) return; bE.set(x, y, z, 'XYZ'); bQ.setFromEuler(bE); bo.quaternion.multiply(bQ); };
    const br = Math.sin(t * 1.7), sh = Math.sin(t * 0.5);
    add('Bip01_Spine1', 0, 0, 0.012 * br * amt); add('Bip01_Spine2', 0, 0, 0.016 * br * amt); add('Bip01_Neck', 0, 0, -0.01 * br * amt);
    add('Bip01_R_Clavicle', 0, 0, 0.015 * br * amt); add('Bip01_L_Clavicle', 0, 0, 0.015 * br * amt);
    add('Bip01_Pelvis', 0, 0.014 * sh * amt, 0.005 * br * amt); add('Bip01_Head', 0.008 * Math.sin(t * 0.37) * amt, 0.025 * Math.sin(t * 0.29 + 1) * amt, 0);
  }
  function placeHeld(rig, a, axe) {
    const hb = rig.h.bones.Bip01_R_Hand; hb.updateWorldMatrix(true, false);
    const g = P.grip;
    T.v.set(g[0], g[1], g[2]).applyMatrix4(hb.matrixWorld);
    setRx(axe, a, 0);
    T.v2.copy(axe.userData.grip).applyQuaternion(axe.quaternion);
    axe.position.copy(T.v).sub(T.v2);
  }

  // ---- reset when the displayed world changes (a new run, the menu match) --------------------------------------------------------
  function resetWorld(ws) {
    for (const [, e] of stuck) giveAxe(e.axe);
    stuck.clear();
    for (const q of falling) giveAxe(q.axe);
    falling.length = 0;
    if (live.axe) { giveAxe(live.axe); live.axe = null; }
    hideGhosts();
    world.clearScars(); fx.clear();
    live.fl = null; live.start = null;
    for (const k of ['you', 'rival']) { Dd[k].clipT = 0; Dd[k].mode = 'idle'; Dd[k].fSeen = null; }
    P.cur = ws; P.board.amp = 0; P.camSnap = true;
  }

  // ---- sim events -> flourishes ---------------------------------------------------------------------------------------------------
  let seenId = 0;
  function onEvent(e) {
    const D = world.dist;
    if (e.type === 'stick') {
      const big = e.ring === 0 || e.ring >= 10;
      fx.burst(e.sx * KM, YC - e.sy * KM, -D + 0.03, big ? 16 : 10, big ? 1.25 : 0.9, e.id);
      P.board.amp = Math.min(0.05, P.board.amp + (big ? 0.028 : 0.018)); P.board.t = 0;
      if (crowd) crowd.react(big ? 'ovation' : 'cheer', { origin: [0, 1.2, -D - 1.5], radius: 30, intensity: big ? 1 : 0.55 });
    } else if (e.type === 'bounce' || e.type === 'deflect' || e.type === 'miss') {
      fx.burst(e.sx * KM, YC - e.sy * KM, -D + 0.03, e.type === 'miss' ? 0 : 6, 0.7, e.id);
      if (e.type !== 'miss') { P.board.amp = Math.min(0.05, P.board.amp + 0.01); P.board.t = 0; }
      if (crowd) crowd.react('groan', { origin: [0, 1.2, -D - 1.5], radius: 30, intensity: 0.6 });
      if (live.axe && live.fl) {
        const dir = Math.sin(e.sx * 0.37 + e.sy * 0.11) > 0 ? 1 : -1;
        falling.push({ axe: live.axe, p: live.axe.position.clone(), a: live.aEnd, v: new THREE.Vector3(dir * 0.5, e.type === 'miss' ? 0.2 : 1.2, e.type === 'miss' ? 0.6 : 2.0), w: dir * (7 + (Math.abs(e.sx) % 5)), t: 0, bounces: 0, rest: false, hide: undefined });
        live.axe = null; hideGhosts();
      }
    } else if (e.type === 'round') {
      if (crowd) crowd.react('cheer', { origin: [0, 1.2, -D - 1.5], radius: 30, intensity: 0.3 });
    }
  }

  // ---- one frame ------------------------------------------------------------------------------------------------------------------
  let lastT = null, lastWall = null;
  function frame() {
    if (!P.ready || P.lost || P.off) { GL.on = false; stage.setVisible(false); return; }
    const views = GL.views, st = GL.state;
    if (!views.length || !st) { GL.on = true; stage.setVisible(false); return; }
    GL.on = true;
    const view = views[views.length - 1];
    const ws = view.ws, br = view.br, isPlay = view.kind === 'play';
    if (!ws || !br) { stage.setVisible(false); return; }
    const now = globalThis.performance.now();
    const cw = (kitCanvas && kitCanvas.clientWidth) || canvas.clientWidth || 720, ch = (kitCanvas && kitCanvas.clientHeight) || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); }
    stage.setVisible(true);
    let dt = lastT === null ? 0 : st.t - lastT; lastT = st.t;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);
    const wall = lastWall === null ? 0 : clamp((now - lastWall) / 1000, 0, 0.1); lastWall = now;
    const stepDt = isPlay && st.paused ? 0 : dt;

    if (P.cur !== ws) resetWorld(ws);
    world.setVenue(ws.venue | 0); buildCrowd(ws.venue | 0);
    const D = world.dist, V0 = VENUES[ws.venue | 0];

    // events (play world and attract world are tagged separately)
    const q = st.fxq || [];
    for (const e of q) { if (e.id > seenId) { seenId = e.id; if (e.world === (isPlay ? 'play' : 'att')) onEvent(e); } }

    // who is on the line, and the two people
    const active = ws.f ? ws.f.side : ws.solo ? 'you' : ws.side;
    const other = active === 'you' ? 'rival' : 'you';
    const dA = drive(ws, active, stepDt), dO = drive(ws, other, stepDt);
    const rA = rigOf(ws, active), rO = rigOf(ws, other);
    for (const r of [P.rigs.you, P.rigs.rf, P.rigs.rm]) r.h.root.visible = r === rA;
    scrub(rA, dA.clipT); scrub(rO, dO.clipT);
    stage.update(stepDt > 0 ? stepDt : 0.0001, { renderNow: false });
    breathe(rA, st.t, dA.mode === 'idle' && dA.clipT < 0.05 ? 1 : 0.35); breathe(rO, st.t + 1.7, 0.9);

    // the axe: in hand, in the air, or already on the board
    const fl = ws.f && ws.phase === 'flight' ? ws.f : null;
    const holdOn = !ws.over && (ws.phase === 'ready' || ws.phase === 'aim' || (fl && fl.t < RELEASE_DELAY));
    const kind = ws.axe | 0;
    if (holdOn || fl) {
      if (!live.axe || live.kind !== kind || live.side !== active) {
        if (live.axe) giveAxe(live.axe);
        live.axe = takeAxe(kind, active, ws.rival); live.kind = kind; live.side = active; scene.add(live.axe); mkGhosts(live.axe); live.fl = null;
      }
    } else if (live.axe && !stuck.size && ws.phase !== 'settle') { giveAxe(live.axe); live.axe = null; hideGhosts(); }
    if (live.axe && (holdOn || fl)) {
      const axe = live.axe, dd = Dd[live.side];
      if (!fl || fl.t < RELEASE_DELAY) {
        const a = heldAngle(dd.clipT);
        placeHeld(rigOf(ws, live.side), a, axe);
        live.held.pos.copy(axe.position); live.held.a = a; live.start = null; live.fl = null;
        axe.visible = true; hideGhosts();
      } else {
        if (live.fl !== fl) { live.fl = fl; live.start = { pos: live.held.pos.clone(), a: live.held.a }; }
        const air = Math.max(0.2, fl.dur - RELEASE_DELAY), u = clamp((fl.t - RELEASE_DELAY) / air, 0, 1);
        live.aEnd = TAU * fl.turns;
        const roll = Math.sin(fl.ix * 0.013 + fl.iy * 0.007) * 0.05;
        // the tumble plane is turned about 30 degrees off the line of flight at the start (a slightly cross-body throw: it lets the turn be
        // read from behind) and settles square to the board as the blade arrives, ending exactly at the pose the stuck axe keeps
        const angPred = (((ws.board.length * 0.61 + ws.turn * 0.37) % 1) - 0.5);
        const yawEnd = angPred * 0.9 + 0.12;
        const yawAt = (m) => yawEnd + (0.52 - yawEnd) * Math.pow(1 - m, 0.8);
        const a = lerp(live.start.a, live.aEnd, u);
        T.e.set(-a, yawAt(u), roll * u, 'YXZ'); axe.quaternion.setFromEuler(T.e);
        // the landing COM puts the bit's tip exactly on the hit point
        T.e.set(-live.aEnd, yawEnd, roll, 'YXZ'); T.q.setFromEuler(T.e);
        T.v2.copy(axe.userData.bit).applyQuaternion(T.q);
        const ex = fl.ix * KM - T.v2.x, ey = YC - fl.iy * KM - T.v2.y, ez = -D + FACE_Z - EMBED + 0.012 - T.v2.z;
        const arc = 0.26 * clamp(air / 0.7, 0.6, 1.5);
        const path = (m) => ({ x: lerp(live.start.pos.x, ex, m), y: lerp(live.start.pos.y, ey, m) + arc * 4 * m * (1 - m), z: lerp(live.start.pos.z, ez, m) });
        const p = path(u); axe.position.set(p.x, p.y, p.z);
        axe.visible = true;
        // rotation blur: the same axe a few degrees earlier, fainter each time
        ghosts.forEach((g, i) => {
          const uu = Math.max(0, u - (i + 1) * 0.035 * Math.min(1.6, fl.turns)), pp = path(uu);
          T.e.set(-lerp(live.start.a, live.aEnd, uu), yawAt(uu), roll * uu, 'YXZ'); g.quaternion.setFromEuler(T.e); g.position.set(pp.x, pp.y, pp.z);
          g.visible = u > 0.02 && u < 0.985;
        });
      }
    }

    // sync the stuck axes with the sim's board
    const seen = new Set();
    for (const en of ws.board) {
      seen.add(en);
      if (stuck.has(en)) continue;
      let axe, aEnd;
      if (live.axe && live.fl) { axe = live.axe; aEnd = live.aEnd; live.axe = null; live.fl = null; hideGhosts(); }
      else { axe = takeAxe(kind, en.side, ws.rival); aEnd = 0; }
      if (axe.parent) axe.parent.remove(axe);
      world.board.add(axe);
      let a0 = aEnd % TAU; if (a0 > Math.PI) a0 -= TAU; if (a0 < -Math.PI) a0 += TAU;
      stuck.set(en, { axe, a0, yaw: en.ang * 0.9 + 0.12, sag: 0.3 + (en.ang + 0.5) * 0.5, ph: en.x * 0.03 + en.y * 0.017, t0: st.t, amp: 0.1 + Math.abs(en.ang) * 0.1, ux: en.x, uy: en.y });
      axe.visible = true;
    }
    for (const [en, s] of stuck) {
      if (seen.has(en)) continue;
      world.addScar(s.ux, s.uy, (Math.abs(s.ph) % 1) * 0.5 - 0.25);   // the sim cleared the board: leave a cut in the wood
      giveAxe(s.axe); stuck.delete(en);
    }
    // the stuck axes pivot about the bit: the handle sags toward the thrower and the wedge hums
    for (const [, s] of stuck) {
      const age = Math.max(0, st.t - s.t0), ax = s.axe;
      const sagU = 1 - Math.exp(-age / 0.22);
      const wobble = s.amp * Math.exp(-age / 0.55) * Math.sin(age * 38 + s.ph);
      setRx(ax, Math.min(-0.08, s.a0 - s.sag * sagU) + wobble, 0);
      T.e.set(-(Math.min(-0.08, s.a0 - s.sag * sagU) + wobble), s.yaw, Math.sin(s.ph * 3) * 0.04, 'YXZ'); ax.quaternion.setFromEuler(T.e);
      T.v2.copy(ax.userData.bit).applyQuaternion(ax.quaternion);
      ax.position.set(s.ux * KM - T.v2.x, -s.uy * KM - T.v2.y, FACE_Z - EMBED + 0.012 - T.v2.z);
    }
    // the bounced axes tumble back and fall to the floor
    for (let i = falling.length - 1; i >= 0; i--) {
      const f2 = falling[i], ax = f2.axe;
      if (!f2.rest) {
        f2.t += stepDt;
        f2.v.y -= 9.8 * stepDt; f2.p.addScaledVector(f2.v, stepDt); f2.a += f2.w * stepDt;
        if (f2.p.y < 0.17 && f2.v.y < 0) { f2.p.y = 0.17; f2.v.y *= -0.32; f2.v.x *= 0.6; f2.v.z *= 0.55; f2.w *= 0.5; f2.bounces++; if (f2.bounces > 2 || Math.abs(f2.v.y) < 0.4) { f2.rest = true; f2.p.y = 0.04; } }
        setRx(ax, f2.a, 0); ax.position.copy(f2.p);
      } else {
        T.e.set(-Math.PI / 2, 0, ((f2.p.x * 7) % 1) * 1.2 - 0.6, 'XYZ'); ax.quaternion.setFromEuler(T.e); ax.position.copy(f2.p);
        if (f2.hide === undefined) f2.hide = st.t + 2.2;
      }
      if (f2.hide !== undefined && st.t > f2.hide) { giveAxe(ax); falling.splice(i, 1); }
    }

    // the room and the board
    world.update(st.t, { wind: windNow(V0, ws.t), boardX: boardOffsetNow(V0, ws.t) });
    P.board.t += stepDt; P.board.amp *= Math.exp(-stepDt * 3.4);
    const sh = P.board.amp * Math.sin(P.board.t * 46);
    world.board.rotation.x = sh; world.board.position.z = -D + sh * 0.2;
    fx.update(stepDt, 0.0, 0xe9d6b0);
    if (crowd) { crowd.setExcitement(clamp(0.2 + (ws.sc ? (ws.sc.you + ws.sc.rival) * 0.01 : 0), 0.15, 0.7)); crowd.update(stepDt); }

    // camera: straight down the lane. The active thrower stands left of the board's centre line (so the raised arm never covers the bull)
    // and the camera is right behind them; the board's face is lens-shifted onto br.
    const Db = CAM_BACK + D, f0 = (br.s / KM) * Db;
    const lat = QS.get('lat') ? +QS.get('lat') : 0.6;
    const xT = -lat * (1000 * KM) * CAM_BACK / Db;
    rA.h.setPosition(xT, 0, 0);
    const lane = Math.max(40, (view.rect.y + view.rect.h) - (br.y + br.h));
    const vt = br.y + br.h + clamp(lane * 0.3, 24, 220);
    const qv = (vt - (br.y + br.h / 2)) / f0;
    const cy = clamp((qv - YC / Db + HEAD_Y / CAM_BACK) / (1 / CAM_BACK - 1 / Db), 1.5, 3.7);
    const cx = xT + Math.sin(st.t * 0.21) * (isPlay ? 0.012 : 0.05);
    if (CU) { cam.position.set(CU[0], CU[1], CU[2]); cam.lookAt(CU[3], CU[4], CU[5]); cam.fov = CU[6] || 40; cam.aspect = cw / ch; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); }
    else setCamera(br, cw, ch, cx, cy + Math.sin(st.t * 0.17) * (isPlay ? 0.01 : 0.04), D);
    P.camPos = cam.position;
    stage.setShadowTarget(0, 0, -D * 0.4);
    stage.lights.key.position.set(-2.4, 4.6, 2.2);
    stage.lights.rim.position.set(3, 3.2, -D - 2);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    stage.stats.renders++;
    perfTick(now);
  }
  P.frame = frame; P.Dd = Dd; P.stuck = stuck;

  // ---- spectators: real 3D people behind the board ------------------------------------------------------------------------------------
  let crowdVenue = -1;
  function buildCrowd(v) {
    if (crowdVenue === v) return;
    crowdVenue = v;
    try {
      if (crowd) { crowd.dispose(); crowd = null; }
      const D = world.dist, pts = [];
      let seed = 3 + v;
      const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const n = v === 3 ? 22 : 14;
      for (let i = 0; i < n; i++) pts.push({ x: (i % 2 ? 1 : -1) * (0.95 + r() * 2.6), y: 0, z: -D - 0.9 - r() * 1.9, yaw: (r() - 0.5) * 0.7, seated: false });
      crowd = V3.createCrowd3d({ scene, camera: cam }, { points: pts, count: pts.length, seed: 11 + v, culture: [['american_rural', 'nordic'], ['nordic', 'european_village'], ['american_rural', 'latin_american'], ['european_village', 'east_asian']][v] || 'american_rural', quality: quality === 'high' ? 'medium' : 'low', excitement: 0.2, props: { flag: 0, phone: 0.12, child: 0 } });
      P.crowd = crowd;
    } catch (e) { console.warn('crowd unavailable', e); crowd = null; }
  }

  // ---- the app icon: the thrower just after the release, the axe tumbling toward the lit board, one axe already in the bull --------
  P.renderIcon = (opts = {}) => {
    const size = opts.size || 2048;
    P.freeze = true;
    world.setVenue(opts.venue ?? 1); buildCrowd(opts.venue ?? 1);
    const D = world.dist, rig = P.rigs.you;
    if (world.cage) world.cage.visible = false;
    for (const r of [P.rigs.you, P.rigs.rf, P.rigs.rm]) r.h.root.visible = r === rig;
    rig.h.setPosition(opts.fx ?? -0.55, 0, 0); rig.h.setFacing(Math.PI + (opts.fyaw ?? 0.12));
    scrub(rig, opts.pose ?? T_REL + 0.12); stage.update(0.001, { renderNow: false }); scrub(rig, opts.pose ?? T_REL + 0.12); stage.update(0.001, { renderNow: false });
    const mk = (side) => { const a = takeAxe(0, side, 0); scene.add(a); return a; };
    const fly = mk('you'); const ap = opts.axe || [-0.1, 1.95, -1.4];
    fly.position.set(ap[0], ap[1], ap[2]); T.e.set(-(opts.ar ?? 2.3), 0.35, 0.06, 'YXZ'); fly.quaternion.setFromEuler(T.e);
    const st2 = mk('you'); world.board.add(st2);
    T.e.set(0.35, -0.2, 0.04, 'YXZ'); st2.quaternion.setFromEuler(T.e);
    T.v2.copy(st2.userData.bit).applyQuaternion(st2.quaternion); st2.position.set(0.0 - T.v2.x, 0.02 - T.v2.y, FACE_Z - EMBED + 0.012 - T.v2.z);
    const st3 = mk('you'); world.board.add(st3);
    T.e.set(0.2, 0.3, 0.0, 'YXZ'); st3.quaternion.setFromEuler(T.e);
    T.v2.copy(st3.userData.bit).applyQuaternion(st3.quaternion); st3.position.set(0.13 - T.v2.x, 0.2 - T.v2.y, FACE_Z - EMBED + 0.012 - T.v2.z);
    fx.burst(0, YC + 0.02, -D + 0.03, 14, 1.2, 5); fx.update(0.25, 0);
    world.update(2, { wind: 0, boardX: 0 });
    const cp = opts.cam || [1.1, 1.75, 2.2, -0.15, 1.45, -D];
    cam.position.set(cp[0], cp[1], cp[2]); cam.up.set(0, 1, 0); cam.lookAt(cp[3], cp[4], cp[5]); cam.fov = cp[6] || 40; cam.aspect = 1; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    stage.lights.key.intensity = opts.keyI ?? 4.2; stage.lights.key.position.set(-2.4, 4.0, 2.4);
    stage.setShadowTarget(0, 0, -D * 0.4); stage.lights.key.position.set(-2.2, 4.2, 1.5);
    stage.update(0.001, { renderNow: false });
    return V3.board3d.renderIcon({ scene, camera: cam, size, renderer, background: '#1a0f08', bloom: opts.bloom ?? 0.3, vignette: opts.vignette ?? 0.45, exposure: opts.exposure ?? 1.0 });
  };
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; GL.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  // the 2D layer renders first (collecting the views it wants), then this layer draws them
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { GL.views.length = 0; r(ctx, view); if (P.freeze) return; frame(); };
    return game;
  };
  return P;
}
