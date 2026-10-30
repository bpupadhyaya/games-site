// Sjoelen 3D presenter. It READS the simulation state (game.getState()) and the board scene view.js builds (discs, piles, queue,
// aim); it never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: the lit sjoelbak on a brown-cafe
// table with turned wooden discs, carved scoring beads, a candle, and a real hand that places and slides each disc. The 2D layer
// draws only text, plaques, buttons, guide lines and score pops (projected through the same camera).
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import * as V3D from '../vendor3d/index.js';
import { loadHands as buildHands } from './handrig.js';
import { v3 } from '../src/v3.js';
import { meta, bgLayout } from '../src/layout.js';
import { layoutOf, sceneOf } from '../src/view.js';
import { TW, TL, D, R, START_Y, LANE_PITCH, AW } from '../src/sim.js';
import { S, ZC, WX, WZ, DISC_R, DISC_H, FLOOR_Y, BOARD_HALF_X, BOARD_HALF_Z, buildBoard, buildWorld, makeDisc, makeBead, softTex, blobGeo } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: true, hand: true },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: true, hand: true },
  { name: 'low', dpr: 1, shadow: 0, fx: false, hand: false },
];

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x120a06, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- the scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  const rig = B.lightingRig(scene, 'warmIndoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 16, fog: { near: 50, far: 120 },
    overrides: { bg: 0x120a06, fog: 0x1a0f08, hemiSky: 0xffe2b8, hemiGround: 0x3a2412, hemi: 0.5, key: 0xffd49a, keyI: 3.0, keyPos: [-9, 11, 7], fill: 0x9db4ff, fillI: 0.35, fillPos: [8, 6, 8], rim: 0xffa860, rimI: 1.7, rimPos: [6, 6, -10], exposure: 1.0, env: 0.5 },
  });
  rig.key.shadow.camera.far = 60;
  // a cafe pendant lamp straight above the board: a warm pool of light that falls off toward the table edge
  const lamp = new THREE.SpotLight(0xffd9a0, 2600, 70, 0.62, 0.9, 1.7); lamp.position.set(0, 20, 3); lamp.target.position.set(0, 0, 0); scene.add(lamp, lamp.target);
  rig.hemi.intensity = 0.28; rig.key.intensity = 1.5; rig.config.keyI = 1.5;
  const env = B.createEnvironment(renderer, scene, { intensity: 0.5 });
  const world = buildWorld({ fx: TIERS[tier].fx }); scene.add(world.group);
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  const board = buildBoard(); boardRoot.add(board);
  const plates = [0, 1, 2, 3].map((k) => board.getObjectByName(`plate${k}`));
  const pivots = [0, 1, 2, 3].map((k) => board.getObjectByName(`platepivot${k}`));
  const RODY = board.userData.rodY, RODZ = board.userData.rodZ;

  const glowTex = softTex('255,255,255', 0.95), haloTex = softTex('255,236,200', 0.9, 256);
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 38, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(0.64, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const blobTex = softTex('0,0,0', 0.9), flat = blobGeo();

  // ---------------------------------------------------------------- disc pools
  const discRoot = new THREE.Group(); boardRoot.add(discRoot);
  const pools = [[], []];
  const used = [0, 0];
  function takeDisc(side) {
    const arr = pools[side], i = used[side]++;
    while (arr.length <= i) {
      const w = new THREE.Group(), m = makeDisc(side);
      const sh = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.75 })); sh.position.y = 0.012; sh.renderOrder = 2;
      w.add(sh, m); w.userData = { m, sh }; w.visible = false; discRoot.add(w); arr.push(w);
    }
    return arr[i];
  }
  const hideAll = () => { for (const a of pools) for (const w of a) w.visible = false; used[0] = used[1] = 0; };
  function placeDisc(side, x, y, o = {}) {
    const w = takeDisc(side), m = w.userData.m, sh = w.userData.sh, lift = o.lift ?? 0, base = o.base ?? 0;
    w.visible = true; w.position.set(WX(x), base, WZ(y));
    m.position.y = lift; m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    const up = o.shadowLift ?? lift;
    sh.position.y = 0.014; sh.scale.setScalar(DISC_R * 2.5 * (1 - clamp(up * 0.18, 0, 0.35)));
    sh.material.opacity = 0.75 * (1 - clamp(up * 0.4, 0, 0.6));
    return w;
  }

  // markers (glow rings) and powder puffs behind the sliding disc
  const markRoot = new THREE.Group(); boardRoot.add(markRoot);
  const markPool = []; let markN = 0;
  function mark(x, y, tex, color, op, size, h = 0.03) {
    let m = markPool[markN];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; markRoot.add(m); markPool.push(m); }
    markN++; m.visible = true; m.material.map = tex; m.material.color.set(color); m.material.opacity = clamp(op, 0, 1);
    m.position.set(WX(x), h, WZ(y)); m.scale.setScalar(size);
  }
  const NP = 40, puffs = [];
  for (let i = 0; i < NP; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xfff6e6, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; boardRoot.add(sp); puffs.push({ sp, life: 1, max: 1, x: 0, z: 0, h: 0, vx: 0, vz: 0, size: 0.5, a: 0.3 }); }
  let puffHead = 0;
  function puff(x, y, h, n, size = 0.5, a = 0.32, spread = 1) {
    for (let i = 0; i < n; i++) {
      const c = puffs[puffHead++ % NP], ang = puffHead * 2.4 + i * 1.7, sp = (0.2 + (i % 3) * 0.12) * spread;
      c.x = WX(x); c.z = WZ(y); c.h = h + 0.05; c.vx = Math.cos(ang) * sp; c.vz = Math.sin(ang) * sp; c.life = 0; c.max = 0.7 + (i % 4) * 0.12; c.size = size * (0.7 + (i % 3) * 0.25); c.a = a; c.sp.visible = true;
    }
  }
  function stepPuffs(dt) {
    for (const c of puffs) {
      if (c.life >= c.max) { c.sp.visible = false; continue; }
      c.life += dt; const u = c.life / c.max;
      c.x += c.vx * dt; c.z += c.vz * dt; c.h += 0.25 * dt;
      c.sp.position.set(c.x, c.h, c.z); c.sp.scale.setScalar(c.size * (0.5 + u * 1.5)); c.sp.material.opacity = c.a * (1 - u) * Math.min(1, u * 8);
    }
  }

  // ---------------------------------------------------------------- scoring beads (carved, slide along the rod as discs pass)
  const beadRoot = new THREE.Group(); boardRoot.add(beadRoot);
  const beads = [[], [], [], []], beadPos = [[], [], [], []];
  const BEAD_STEP = 0.2;
  function updateBeads(side, counts, dt) {
    const bd = makeBead(side);
    for (let k = 0; k < 4; k++) {
      const arr = beads[k];
      while (arr.length < 10) { const m = new THREE.Mesh(bd.geo, bd.mat); m.castShadow = true; m.userData.side = side; beadRoot.add(m); arr.push(m); beadPos[k].push(null); }
      const n = Math.min(10, counts[k]), cx = WX(k * LANE_PITCH + AW / 2), half = AW * S / 2 - 0.22;
      for (let i = 0; i < 10; i++) {
        const m = arr[i];
        if (m.userData.side !== side) { m.userData.side = side; m.material = bd.mat; m.geometry = bd.geo; }
        const tgt = i < n ? -half + i * BEAD_STEP : half - (9 - i) * BEAD_STEP;
        if (beadPos[k][i] === null) beadPos[k][i] = tgt;
        beadPos[k][i] += (tgt - beadPos[k][i]) * Math.min(1, dt * 14);
        m.position.set(cx + beadPos[k][i], RODY, RODZ);
      }
    }
  }

  // ---------------------------------------------------------------- camera and projection
  let W = 1, H = 1, dprNow = 1, clock = 0, lastT = 0, frames = 0, ema = 16, rotNow = false;
  const tmp = new THREE.Vector3();
  const BOX_Y = [FLOOR_Y - 0.7, 1.6];
  const cornersFor = (rot) => { const c = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of BOX_Y) { const lx = sx * BOARD_HALF_X, lz = sz * BOARD_HALF_Z; c.push(new THREE.Vector3(rot ? -lz : lx, y, rot ? lx : lz)); } return c; };
  const cornersP = cornersFor(false), cornersR = cornersFor(true);
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 1, rot = false) {
    const k = W / meta.width, tw = rect.w * k * fill, th = rect.h * k * fill, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180, corners = rot ? cornersR : cornersP;
    camera.fov = fov; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place = (d) => { camera.position.set(Math.sin(yw) * Math.cos(p) * d, 0.1 + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d); camera.lookAt(0, 0.1, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const extent = (d) => {
      place(d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmp.copy(c).project(camera); const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 6, hi = 150;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2, e = extent(mid); if (e.w > tw || e.h > th) lo = mid; else hi = mid; }
    if (scene.fog) { scene.fog.near = hi + 28; scene.fog.far = hi + 100; }
    const e = extent(hi), cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, e.cx - cxp, e.cy - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  // board-local (lx, h, lz) -> world, taking the board's 90 degree turn into account
  const toW = (lx, h, lz, out) => (rotNow ? out.set(-lz, h, lx) : out.set(lx, h, lz));
  const toVirt = (v) => { v.project(camera); return { x: ((v.x + 1) / 2) * meta.width, y: ((1 - v.y) / 2) * meta.height }; };
  const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3();
  v3.xf = (x, y, h = 0) => {
    const a = toVirt(toW(WX(x), h, WZ(y), _p0)), b = toVirt(toW(WX(x) + 0.5, h, WZ(y), _p1)), c = toVirt(toW(WX(x), h, WZ(y) + 0.5, _p2));
    return { x: a.x, y: a.y, s: (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - a.x, c.y - a.y)) / (2 * 0.5 / S) };
  };
  const ray = new THREE.Vector3(), orig = new THREE.Vector3();
  v3.toWorld = (vx, vy) => {
    orig.copy(camera.position); ray.set((vx / meta.width) * 2 - 1, 1 - (vy / meta.height) * 2, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return { x: TW / 2, y: START_Y };
    const t = (0.1 - orig.y) / ray.y, wx = orig.x + ray.x * t, wz = orig.z + ray.z * t;
    const lx = rotNow ? wz : wx, lz = rotNow ? -wx : wz;
    return { x: lx / S + TW / 2, y: lz / S + ZC };
  };

  // ---------------------------------------------------------------- hands
  // The modelled hand (handmesh.js) is built in the background after the board is up. Motion: while a disc is ready the pads rest on
  // its back rim (contact exact; the hand follows the disc exactly while you place it); on a slide the hand rides the disc for the first
  // few centimetres, lets go, follows through a little and lifts, then withdraws toward the player. Position, lift and tilt run on
  // critically damped springs (continuous velocity, no pops); a hand only hides when it is withdrawn off the near end.
  const hands = [null, null];
  let handsLoading = false;
  async function loadHands() {
    if (handsLoading) return; handsLoading = true;
    try { const hs = await buildHands(THREE); hs.forEach((h, i) => { scene.add(h.root); hands[i] = Object.assign(h, { x: TW / 2, y: START_Y + 170, h: 2, vx: 0, vy: 0, vh: 0, tilt: 0, vt: 0, hold: false, rel: null }); }); }
    catch (e) { console.warn('hand failed', e); }
  }
  const FOLLOW = 24, FOLLOW_T = 0.42, WITHDRAW_Y = START_Y + 170;   // sim units / s: follow-through ~5 cm; the rest point is off the near end
  const spring = (Hd, k, tgt, w, dt) => {             // critically damped spring on Hd[k] with velocity Hd['v' + k]
    const v = 'v' + (k === 'tilt' ? 't' : k), x = Hd[k] - tgt, e = Math.exp(-w * dt), vel = Hd[v];
    Hd[k] = tgt + (x + (vel + w * x) * dt) * e; Hd[v] = (vel - (vel + w * x) * w * dt) * e;
  };
  const _hp = new THREE.Vector3(), _hf = new THREE.Vector3();
  function driveHand(i, tgt, dt) {
    const Hd = hands[i]; if (!Hd) return;
    dt = Math.min(dt, 1 / 20);
    if (tgt.exact) {                                   // contact: on the disc exactly, velocity carried for the hand-off to the springs
      if (dt > 0) { Hd.vx = (tgt.x - Hd.x) / dt; Hd.vy = (tgt.y - Hd.y) / dt; Hd.vh = (0 - Hd.h) / dt; }
      Hd.x = tgt.x; Hd.y = tgt.y; Hd.h = 0; spring(Hd, 'tilt', 0, 18, dt);
    } else {
      spring(Hd, 'x', tgt.x, tgt.w, dt); spring(Hd, 'y', tgt.y, tgt.w, dt); spring(Hd, 'h', tgt.h, tgt.w, dt); spring(Hd, 'tilt', tgt.tilt || 0, tgt.w, dt);
      if (Hd.h < 0) { Hd.h = 0; Hd.vh = Math.max(0, Hd.vh); }   // never through the board
    }
    const on = TIERS[tier].hand && !(Hd.y > WITHDRAW_Y - 12 && tgt.y >= WITHDRAW_Y);
    Hd.root.visible = on;
    if (!on) return;
    toW(WX(Hd.x), 0, WZ(Hd.y), _hp); toW(0, 0, -1, _hf);
    Hd.place(_hp, _hf, 0.26, Hd.h, Hd.tilt);
  }

  // ---------------------------------------------------------------- per-disc motion memory (impacts make a disc chatter)
  const seen = new Map();            // id -> { x, y, sp, rock, ax, az }
  const pileSeen = [0, 0, 0, 0], pileDrop = [[], [], [], []];
  const fx = { trail: 0 };

  // ---------------------------------------------------------------- frame
  function present(state, dt, sc, playing) {
    hideAll(); markN = 0;
    const calm = !!state.calm;
    const alive = new Set();
    const put = (d, extra = {}) => {
      const id = d.id ?? -1, side = d.side ?? sc.side ?? 0;
      let mem = null;
      if (id >= 0) {
        mem = seen.get(id);
        if (!mem) { mem = { x: d.x, y: d.y, sp: 0, rock: 0, ax: 0, az: 0 }; seen.set(id, mem); }
        alive.add(id);
        const vx = (d.x - mem.x) / Math.max(dt, 1e-3), vy = (d.y - mem.y) / Math.max(dt, 1e-3), sp = Math.hypot(vx, vy), dv = Math.abs(sp - mem.sp);
        if (dt > 0.001 && dv > 140 && mem.sp < 900) { mem.rock = Math.min(1, 0.35 + dv / 900); const l = sp || 1; mem.ax = vy / l; mem.az = -vx / l; if (dv > 220) puff(d.x, d.y, 0, 2, 0.35, 0.22); }
        mem.x = d.x; mem.y = d.y; mem.sp = sp;
        mem.rock = Math.max(0, mem.rock - dt * 2.6);
      }
      let rx = 0, rz = 0;
      if (mem && mem.rock > 0) { const a = Math.sin((1 - mem.rock) * 26) * 0.13 * mem.rock; rx = a * mem.ax; rz = a * mem.az; }
      placeDisc(side, d.x, d.y, { ry: hash((id + 3) * 1.7) * TAU, rx, rz, ...extra });
    };
    for (const d of sc.table) put(d);
    if (sc.moving) put(sc.moving);
    // arch piles with a drop-in for each newly counted disc
    const side = sc.side ?? 0, pile = sc.pile || [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const n = pile[k];
      if (n > pileSeen[k]) for (let i = pileSeen[k]; i < n; i++) pileDrop[k].push({ i, t: 0 });
      if (n < pileSeen[k]) pileDrop[k].length = 0;
      pileSeen[k] = n;
      for (const a of pileDrop[k]) a.t += dt;
      pileDrop[k] = pileDrop[k].filter((a) => a.t < 0.5);
      const cx = k * LANE_PITCH + AW / 2, show = Math.min(n, 12);
      for (let i = 0; i < show; i++) {
        const h = hash(k * 31 + i * 7 + 1), g = hash(k * 17 + i * 5 + 2);
        const drop = pileDrop[k].find((a) => a.i === i);
        let lift = 0, rx = (g - 0.5) * 0.14, rz = (h - 0.5) * 0.14;
        if (drop) { const u = clamp(drop.t / 0.24, 0, 1); lift = (1 - ease(u)) * 0.8; if (drop.t > 0.24) { const w = (drop.t - 0.24) / 0.26; rx += Math.sin(w * 30) * 0.12 * (1 - w); } }
        placeDisc(side, cx + (h - 0.5) * 10, -31 + (g - 0.5) * 5, { base: FLOOR_Y + i * 0.27, lift, ry: h * TAU, rx, rz, shadowLift: 3 });
      }
      const p = state.pulse ? state.pulse[k] : 0;
      if (plates[k]) plates[k].children[0].material.emissive.setRGB(p * 0.9, p * 0.7, p * 0.3);
    }
    // discs still to slide wait in a row on the near end (a second layer on top for the last three)
    const waiting = Math.max(0, (sc.queue | 0) - (sc.ready ? 1 : 0));
    for (let i = 0; i < Math.min(waiting, 10); i++) {
      const row = i < 7 ? 0 : 1, c = i < 7 ? i : i - 7 + 2, x0 = (TW - 7 * R * 2) / 2 + R;
      placeDisc(side, x0 + c * R * 2, TL + 34, { lift: row * DISC_H, ry: hash(i + 9) * TAU });
    }
    // the disc in hand
    const aim = sc.aim;
    if (sc.ready && aim) {
      placeDisc(side, aim.x, START_Y, { lift: hands[side & 1] && TIERS[tier].hand ? 0 : 0.4 + Math.sin(clock * 2.2) * 0.02, ry: 0.4 });
      if (sc.readyGlow) mark(aim.x, START_Y, ringTex, '#ffe8a0', 0.5 + 0.2 * Math.sin(clock * 3), DISC_R * 2.9);
      if (sc.hint) { mark(sc.hint.x, START_Y, ringTex, '#ffd24a', 0.9, DISC_R * 2.9); mark(sc.hint.x, START_Y, glowTex, '#ffd24a', 0.45, DISC_R * 3.2); }
    }
    // powder trail behind the sliding disc
    if (sc.moving && !calm) {
      const m = sc.moving, sp = seen.get(m.id)?.sp ?? 0;
      if (sp > 60) { fx.trail += dt; if (fx.trail > 0.025) { fx.trail = 0; puff(m.x, m.y + 8, 0, 1, 1.1, 0.2, 0.3); } }
    }
    for (const id of seen.keys()) if (!alive.has(id)) seen.delete(id);
    for (let i = markN; i < markPool.length; i++) markPool[i].visible = false;
    updateBeads(side, pile, dt);

    // hands: one per side, at the player's end
    if (!hands[0] && !handsLoading && TIERS[tier].hand) loadHands();
    for (let i = 0; i < 2; i++) {
      const hd = hands[i]; if (!hd) continue;
      const mine = i === (side & 1);
      let t = { x: hd.x, y: WITHDRAW_Y, h: 2.2, tilt: -0.12, w: 5 };
      if (mine && !state.pass && (playing || sc.moving)) {
        if (sc.ready && aim) {
          hd.rel = null;
          const near = Math.hypot(hd.x - aim.x, hd.y - START_Y) < 0.4 && hd.h < 0.02;
          if (hd.hold || near) { hd.hold = true; t = { exact: true, x: aim.x, y: START_Y }; }
          else t = { x: aim.x, y: START_Y, h: 0, tilt: 0, w: 11 };
        } else if (sc.moving) {
          // the disc leaves the pads at once (the slide starts at full speed): the hand follows through after it, lifting a little,
          // then withdraws toward the player
          hd.hold = false;
          if (!hd.rel) hd.rel = { x: hd.x, y: hd.y, t: 0 };
          hd.rel.t += dt;
          t = hd.rel.t < FOLLOW_T ? { x: hd.rel.x + (sc.moving.x - hd.rel.x) * 0.15, y: hd.rel.y - FOLLOW, h: 0.35, tilt: 0, w: 13 } : { x: hd.rel.x, y: WITHDRAW_Y, h: 2.2, tilt: -0.12, w: 5 };
        }
      }
      if (!t.exact && hd.hold && !(sc.ready && aim)) hd.hold = false;
      driveHand(i, t, dt);
    }
    // ambience
    world.update(clock, calm, TIERS[tier].fx);
    stepPuffs(dt);
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
  }

  function prepare(state) {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    const playing = state.scene === 'play' && !!state.m;
    const L = playing ? layoutOf(state) : bgLayout();
    rotNow = !!L.rot;
    boardRoot.rotation.y = rotNow ? -Math.PI / 2 : 0; world.setLayout(rotNow);
    for (let k = 0; k < 4; k++) { pivots[k].rotation.y = rotNow ? Math.PI / 2 : 0; plates[k].rotation.x = rotNow ? 0.66 : 0.5; }   // numerals always face the viewer upright
    const sway = state.calm || playing ? 0 : 1;
    if (playing) fitCamera(L.rect, rotNow ? 50 : 60, 28, 0, 1, rotNow);
    else { const r = L.rect, dy = rotNow ? 0 : 70; fitCamera({ x: r.x, y: r.y + dy, w: r.w, h: r.h - dy }, rotNow ? 46 : 55, 30, sway * Math.sin(clock * 0.17) * 5, 1.0, rotNow); }
    return { L, playing };
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; applyTier(); v3.on = true; });   // B.createEnvironment rebuilds scene.environment itself

  try { applyTier(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, rig, env, hands, board, tierOf: () => tier,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          let info;
          try { info = prepare(state); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try {
            const sc = info.playing ? sceneOf(state) : (state.att && state.att.scene);
            if (sc) present(state, dt, sc, info.playing);
          } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
