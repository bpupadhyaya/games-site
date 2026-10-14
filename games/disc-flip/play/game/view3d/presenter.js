// Disc-flip 3D presenter. READS the simulation (game.getState(), theater.sceneOf), never writes. One WebGL canvas sits behind the
// kit's transparent 2D canvas: a walnut tray with a baize mat and brass cup, translucent winks and squidgers, in a Victorian club
// room. The 2D layer draws only text, buttons and the aim overlay. While the camera is up, `lens` routes screen <-> world through
// it so picking and the overlay land exactly on the tilted mat. No WebGL / context lost -> v3.on = false and the flat art draws.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { lens, W as LW, H as LH, syncSize, matBox } from '../src/layout.js';
import { layoutOf } from '../src/view.js';
import { sceneOf } from '../src/theater.js';
import { sprites } from '../src/art.js';
import { SQUIDGERS, WR, getWink } from '../src/sim.js';
import {
  S, MW, MH, FRAME, TRAY_H, FELT_Y, WINK_T, POT_R, SQ_R, wx, wz,
  buildTray, buildRoom, makeWink, makeSquidger, canvasTex, blobCanvas, ringCanvas, WINK_COL,
} from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const LIFT_CM = 2.6;
const WINK_R_ = 15 * S;
const VIS = 1.25;
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, q: 1, glass: true },
  { name: 'medium', dpr: 1.5, shadow: 1024, q: 0.8, glass: true },
  { name: 'low', dpr: 1, shadow: 0, q: 0.5, glass: false },
];

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  const noop = { wrap: (g) => g, ok: false };
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setClearColor(0x120a06, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene, lights
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0f0a);
  scene.fog = new THREE.Fog(0x1a0f0a, 260, 520);
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 800);
  const room = buildRoom({ quality: TIERS[tier].q });
  scene.add(room.group);
  const tray = buildTray(TIERS[tier].q); scene.add(tray);
  const env = B.createEnvironment(renderer, scene, { intensity: 0.35 });
  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x2a1810, 0.4);
  // the lamp over the table: a warm spot that pools on the tray and falls away into the dark room
  const key = new THREE.SpotLight(0xffdcaa, 3.6, 0, 0.5, 0.85, 0); key.position.set(-20, 74, 36); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { near: 30, far: 160, fov: 36 }); key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.04; key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xaec4ff, 0.5); fill.position.set(30, 22, 18);
  const rim = new THREE.DirectionalLight(0xffa860, 1.6); rim.position.set(14, 24, -40);
  scene.add(hemi, key, key.target, fill, rim);
  const keyBase = 3.6;

  // ---------------------------------------------------------------- pieces
  const root = new THREE.Group(); scene.add(root);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const ringTex = canvasTex(ringCanvas('255,255,255', 128, 0.72), {});
  const caustTex = canvasTex(blobCanvas('255,255,255', 0.8, 128), {});
  const pools = {};         // 'side tone' -> [wrap]
  const winkAt = (side, tone, i) => {
    const k = `${side}${tone}`, pool = pools[k] || (pools[k] = []);
    while (pool.length <= i) {
      const w = new THREE.Group(), m = makeWink(side, tone, TIERS[tier].glass);
      const c = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: caustTex, color: WINK_COL[side][tone][0], transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      c.renderOrder = 1; root.add(c); w.add(m); w.userData = { m, c }; root.add(w); w.visible = false; c.visible = false; pool.push(w);
    }
    return pool[i];
  };
  const used = {};
  const hideAll = () => { for (const k in pools) for (const w of pools[k]) { w.visible = false; w.userData.c.visible = false; } for (const k in used) used[k] = 0; };
  const take = (side, tone) => { const k = `${side}${tone}`; used[k] = used[k] || 0; return winkAt(side, tone, used[k]++); };

  const sqPool = { act: [0, 1, 2].map((i) => { const m = makeSquidger(i); m.visible = false; root.add(m); return m; }), aim: [0, 1, 2].map((i) => { const m = makeSquidger(i); m.visible = false; root.add(m); return m; }) };
  const hlPool = []; let hlN = 0;
  function hl(x, z, tx, color, opacity, size, y = FELT_Y + 0.03) {
    let m = hlPool[hlN];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; root.add(m); hlPool.push(m); }
    hlN++; m.visible = true; m.material.map = tx; m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }
  // potted winks lying in the well
  const well = { 0: [], 1: [] };
  const wellWink = (side, i) => {
    const a = well[side];
    while (a.length <= i) { const w = makeWink(side, i % 2, false); w.visible = false; root.add(w); a.push(w); }
    return a[i];
  };

  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  // orientation: yaw about Y, then a rotation of `ang` about the horizontal axis perpendicular to heading (hx, hz);
  // positive ang raises the heading side of the disc
  function orient(obj, yaw, hx, hz, ang) {
    _q.setFromAxisAngle(_up, yaw);
    if (ang) { _ax.set(-hz, 0, hx); if (_ax.lengthSq() < 1e-6) _ax.set(1, 0, 0); _ax.normalize(); _q2.setFromAxisAngle(_ax, ang); _q.premultiply(_q2); }
    obj.quaternion.copy(_q);
  }
  let clock = 0, fdt = 0.016;
  function placeWink(it) {
    const w = take(it.side, it.tone % 2); w.visible = true;
    const X = wx(it.x), Z = wz(it.y), h = hash(it.id * 7 + 1);
    const hxn = it.hx ?? 0, hyn = it.hy ?? -1, hl2 = Math.hypot(hxn, hyn) || 1, hx = hxn / hl2, hz = hyn / hl2;
    let Y = FELT_Y + (it.z || 0) * WINK_T * 1.02, yaw = h * TAU, lift = it.lift * LIFT_CM;
    const pileTilt = (it.z || 0) * 0.05 * Math.sin(it.id * 2.1);
    let ang = pileTilt;
    switch (it.kind) {
      case 'press': ang = it.k * 0.34; Y += Math.sin(ang) * WINK_R_ * 0.55; break;
      case 'hop': { const revs = it.D > 300 ? 2 : 1; ang = -it.k * revs * TAU; yaw += it.k * 2.4 * (h > 0.5 ? 1 : -1); break; }
      case 'land': ang = pileTilt + 0.26 * Math.exp(-it.u * 7) * Math.sin(it.u * 36); break;
      case 'scat': ang = -it.k * 1.5 * TAU; yaw += it.k * 3; break;
      case 'off': ang = 0.05 * Math.sin(it.u * 30); break;
      case 'pot': Y -= it.sink * (FELT_Y - 0.12); ang = 0.5 * it.sink * Math.sin(it.id); break;
      default: break;
    }
    if (it.kind === 'rest' && it.sel) lift += 0.22 + 0.06 * Math.sin(clock * 6);
    Y += lift;
    w.position.set(X, Y, Z);
    w.scale.setScalar(VIS);   // up to 1.3x the real size for readability at phone scale (stated in STATUS.md)
    orient(w, yaw, hx, hz, ang);
    // coloured light the acrylic throws on the felt
    const c = w.userData.c; c.visible = true;
    const sep = Math.max(0, Y - FELT_Y);
    c.position.set(X + 0.5 + sep * 0.25, FELT_Y + 0.025, Z - 0.3 - sep * 0.2);
    c.scale.setScalar(2.4 + sep * 0.4); c.material.opacity = it.kind === 'pot' ? 0.3 * (1 - it.sink) : 0.32 * (1 - clamp(sep * 0.25, 0, 0.7));
    if (it.sel) hl(X, Z, ringTex, '#fff2b8', 0.8 + 0.2 * Math.sin(clock * 6), 3.6);
  }

  // squidger: press 0..1 comes smoothed from the caller (a damped spring), so it never snaps
  const spr = { press: 0 };
  function placeSq(slot, sq, o = {}) {
    const m = sqPool[slot][sq.id]; m.visible = true;
    const R = SQ_R[sq.id], X = wx(sq.x), Z = wz(sq.y);
    const p = clamp(sq.press, 0, 1), away = sq.away || 0, hover = o.hover ?? 0;
    const Yc = FELT_Y + 0.02 + hover + 0.36 * p + Math.sin(0.2 * p) * R + away * 2.2;
    m.position.set(X - sq.dx * away * 1.8, Yc, Z - sq.dy * away * 1.8);
    orient(m, 0, sq.dx, sq.dy, -0.2 * p + (o.backTilt ?? 0) + away * 0.15);
  }

  // ---------------------------------------------------------------- camera
  let Wp = 1, Hp = 1, dprNow = 1, lw = 720, lh = 1280;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== Wp || h !== Hp || dpr !== dprNow) { Wp = w; Hp = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const v0 = new THREE.Vector3();
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function fitCamera(rect, rot, pitchDeg, fov, yawDeg = 0, lookAt = [0, 0, 0]) {
    const TW = (MW + 2 * FRAME) / 2, TH = (MH + 2 * FRAME) / 2, k = Wp / lw, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = Wp / Hp; camera.updateProjectionMatrix();
    let d = 90;
    const place = () => {
      const az = (rot ? Math.PI / 2 : 0) + yaw;
      camera.position.set(lookAt[0] + Math.sin(az) * Math.cos(p) * d, lookAt[1] + Math.sin(p) * d, lookAt[2] + Math.cos(az) * Math.cos(p) * d);
      camera.lookAt(lookAt[0], lookAt[1], lookAt[2]); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    const box = () => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [sx, sz] of corners) for (const yy of [FELT_Y, TRAY_H * 0.4]) {
        v0.set(sx * TW, yy, sz * TH).project(camera);
        const px = ((v0.x + 1) / 2) * Wp, py = ((1 - v0.y) / 2) * Hp;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { x0, x1, y0, y1 };
    };
    let bb = null;
    for (let it = 0; it < 6; it++) {
      place(); bb = box();
      d *= Math.max((bb.x1 - bb.x0) / (rect.w * k), (bb.y1 - bb.y0) / (rect.h * k));
    }
    place(); bb = box();
    const cxb = (bb.x0 + bb.x1) / 2, cyb = (bb.y0 + bb.y1) / 2, cxr = (rect.x + rect.w / 2) * k, cyr = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(Wp, Hp, cxb - cxr, cyb - cyr, Wp, Hp);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const ray = new THREE.Vector3(), orig = new THREE.Vector3();
  lens.to = (x, y) => {
    v0.set(wx(x), FELT_Y, wz(y)).project(camera);
    return { x: ((v0.x + 1) / 2) * lw, y: ((1 - v0.y) / 2) * lh };
  };
  lens.from = (sx, sy) => {
    const ndcx = (sx / lw) * 2 - 1, ndcy = 1 - (sy / lh) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (FELT_Y - orig.y) / ray.y; if (t < 0) return null;
    return { x: (orig.x + ray.x * t) / S + 300, y: (orig.z + ray.z * t) / S + 450 };
  };
  v3.sq = lens.to; v3.pick = lens.from;

  // ---------------------------------------------------------------- title hero: a looping demonstration at the cup
  // An amber wink is pressed by a honey-horn squidger, flips across the felt and drops into the brass cup; a fresh one is placed.
  const HERO_T = 8.2, SQ_ID = 1;
  function heroData(t, cycle) {
    const items = [], T = t % HERO_T;
    const rest = (id, side, tone, x, y, z = 0) => items.push({ id, side, tone, x, y, z, kind: 'rest', k: 0, lift: 0, u: 0 });
    rest(101, 1, 0, 372, 408); rest(102, 1, 1, 214, 470); rest(103, 0, 1, 360, 520); rest(104, 0, 0, 404, 468); rest(105, 1, 0, 408, 474, 1); rest(106, 0, 1, 232, 392);
    const sx = 300, sy = 640, base = { id: 107, side: 0, tone: 0, hx: 0, hy: -1, D: 190 };
    let sq = null, cupGlow = 0, potN = cycle % 5;
    if (T < 0.9) { /* the squidger is not yet down; the wink waits */ items.push({ ...base, x: sx, y: sy, z: 0, kind: 'rest', k: 0, lift: 0, u: 0 }); }
    else if (T < 1.7) { const a = (T - 0.9) / 0.8; items.push({ ...base, x: sx, y: sy, z: 0, kind: 'rest', k: 0, lift: 0, u: 0 }); sq = { id: SQ_ID, x: sx, y: sy + 52, dx: 0, dy: -1, back: 30 * (1 - a), press: 0, away: 1 - a * a * (3 - 2 * a) }; }
    else if (T < 2.1) { const a = (T - 1.7) / 0.4; items.push({ ...base, x: sx, y: sy, z: 0, kind: 'press', k: a, lift: 0, u: 0 }); sq = { id: SQ_ID, x: sx, y: sy + 52 - 8 * a, dx: 0, dy: -1, back: 0, press: Math.min(1, a * 1.6), away: 0 }; }
    else if (T < 2.85) { const k = (T - 2.1) / 0.75; items.push({ ...base, x: sx, y: sy + (450 - sy) * k, z: 0, kind: 'hop', k, lift: Math.sin(Math.PI * k) * 1.1, u: 0 }); sq = { id: SQ_ID, x: sx, y: sy + 44, dx: 0, dy: -1, back: 0, press: Math.max(0, 1 - (T - 2.1) * 6), away: Math.min(1, (T - 2.1) * 3) }; }
    else if (T < 3.6) { const u = T - 2.85; items.push({ ...base, x: 300, y: 450, z: 0, kind: 'pot', k: 1, lift: 0, sink: Math.min(1, u / 0.5), u }); cupGlow = Math.max(0, 1 - u * 1.3); potN++; }
    else { potN++; if (T > 7.0) { const u = T - 7.0, k = Math.min(1, u / 0.35); items.push({ ...base, x: sx, y: sy, z: 0, kind: 'land', k: 1, lift: (1 - k * k) * 2.2 * (u < 0.35 ? 1 : 0) + (u > 0.35 && u < 0.6 ? Math.sin(Math.PI * (u - 0.35) / 0.25) * 0.25 : 0), u: Math.max(0, u - 0.35) }); } }
    return { items, sq, cupGlow, potted: [Math.min(potN, 6), 0] };
  }
  function fitHero(land, sw) {
    const k = Wp / lw, p = ((land ? 30 : 27) * Math.PI) / 180, vfov = 30;
    const aspect = Wp / Hp, wantW = land ? 30 : 21;
    camera.fov = vfov; camera.clearViewOffset(); camera.aspect = aspect; camera.updateProjectionMatrix();
    const tanH = Math.tan((vfov * Math.PI) / 360) * aspect, d = wantW / 2 / tanH, az = (sw * Math.PI) / 180;
    camera.position.set(Math.sin(az) * Math.cos(p) * d, FELT_Y + 0.4 + Math.sin(p) * d, Math.cos(az) * Math.cos(p) * d);
    camera.lookAt(0, FELT_Y + 0.4, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    v0.set(0, FELT_Y, 0).project(camera);
    const px = ((v0.x + 1) / 2) * Wp, py = ((1 - v0.y) / 2) * Hp;
    const fx = land ? 0.27 : 0.5, fy = land ? 0.56 : 0.2;
    camera.setViewOffset(Wp, Hp, px - fx * Wp, py - fy * Hp, Wp, Hp);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    void k;
  }

  // ---------------------------------------------------------------- 2D sprites of winks and squidgers (HUD pips, illustrations)
  function buildSprites() {
    const SP = 192, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(12, 1, 2, 120);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.2); l1.position.set(-6, 18, 9);
    const l2 = new THREE.DirectionalLight(0xaec4ff, 0.9); l2.position.set(8, 6, -4);
    sc.add(new THREE.HemisphereLight(0xffe8cc, 0x4a3a2a, 1.0), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.6;
    const prevPR = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    const bg = scene.background; scene.background = null;
    const shoot = (obj, rad) => {
      sc.add(obj);
      const p = (74 * Math.PI) / 180, d = (rad * SP) / (150 * Math.tan((6 * Math.PI) / 180));
      cam.position.set(0, Math.sin(p) * d, Math.cos(p) * d); cam.lookAt(0, 0.12, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sc.remove(obj); return c;
    };
    for (const side of [0, 1]) for (const tone of [0, 1]) sprites.wink[`${side}${tone}`] = shoot(makeWink(side, tone, false), WINK_R_);
    for (let i = 0; i < 3; i++) sprites.sq[i] = shoot(makeSquidger(i), SQ_R[i]);
    scene.background = bg;
    renderer.setClearColor(0x120a06, 1); renderer.setPixelRatio(prevPR); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0;
    Wp = 0; sprites.ready = true;
  }

  // ---------------------------------------------------------------- tier
  let lastT = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    Wp = 0;
    for (const k in pools) for (const w of pools[k]) w.userData.m.userData.body.material = w.userData.m.userData.body.material;
    scene.traverse((o) => { if (o.material) { if (o.material.transmission !== undefined && o.material.transmission > 0 && !t.glass) o.material.transmission = 0; o.material.needsUpdate = true; } });
  }

  // ---------------------------------------------------------------- per frame
  const thFor = (state) => (state.scene === 'play' && state.m ? state.th : state.scene === 'result' ? state.th ?? state.att : state.att ?? state.th);
  function frame(state, dt) {
    syncSize(); lw = LW; lh = LH;
    resize();
    const playing = state.scene === 'play' && !!state.m;
    v3.scene = state.scene;
    const land = lw > lh;
    if (playing) {
      const L = layoutOf(state);
      fitCamera(matBox(L, 0), !!L.mat.rot, land ? 58 : 60, 28, 0);
      lens.on = true;
    } else {
      lens.on = false;
      const sw = Math.sin(clock * 0.11) * 4;
      if (state.scene === 'result') {
        if (land) fitCamera({ x: lw * 0.05, y: lh * 0.05, w: lw * 0.9, h: lh * 0.9 }, true, 44, 30, sw, [0, 0.5, 0]);
        else fitCamera({ x: lw * 0.03, y: lh * 0.2, w: lw * 0.94, h: lh * 0.64 }, false, 42, 30, sw, [0, 0.5, 0]);
      } else fitHero(land, sw);
    }
    hideAll(); hlN = 0;
    const th = thFor(state), hero = !playing && state.scene !== 'result';
    for (const m of sqPool.act) m.visible = false;
    for (const m of sqPool.aim) m.visible = false;
    let potted = [0, 0], cupGlow = 0;
    if (hero) {
      const hd = heroData(clock, Math.floor(clock / HERO_T));
      for (const it of hd.items) placeWink(it);
      if (hd.sq) { spr.press += (hd.sq.press - spr.press) * (1 - Math.exp(-fdt * 18)); placeSq('act', { ...hd.sq, press: spr.press }, { hover: 0.2 * Math.min(1, hd.sq.back / 30) }); }
      cupGlow = hd.cupGlow; potted = hd.potted;
    } else if (th) {
      const aimSel = playing && state.showAim && !state.act && state.aim.id >= 0 ? state.aim.id : null;
      const data = sceneOf(th, { sel: aimSel });
      for (const it of data.items) placeWink(it);
      if (data.sq) {
        const a = data.sq; spr.press += (a.press - spr.press) * (1 - Math.exp(-fdt * 18));
        placeSq('act', { ...a, press: spr.press }, { hover: 0.25 * Math.min(1, a.back / 30) });
      } else spr.press = 0;
      cupGlow = data.cupGlow;
      potted = th.act && !th.act.fired.land ? th.act.potBefore : th.mat.potted;
      if (playing && state.showAim && !state.act && state.aim.id >= 0 && state.preview) {
        const a = state.aim, w = getWink(th.mat, a.id);
        if (w && !w.pot) {
          const q = SQUIDGERS[a.sq], dx = Math.cos(a.angle), dy = Math.sin(a.angle), pull = a.power * 34, off = WR + q.r * 0.72 + pull;
          placeSq('aim', { id: a.sq, x: w.x - dx * off, y: w.y - dy * off, dx, dy, press: 0, away: 0 }, { hover: 0.22 + 0.3 * a.power, backTilt: 0.07 });
        }
      }
    }
    for (const side of [0, 1]) {
      const n = Math.min(14, potted[side] || 0), arr = well[side];
      for (let i = 0; i < Math.max(arr.length, n); i++) {
        if (i >= n) { if (arr[i]) arr[i].visible = false; continue; }
        const w = wellWink(side, i), a = hash(i * 3 + side * 11) * TAU + i * 2.4, r = (0.15 + 0.5 * hash(i + side * 5)) * (POT_R - WINK_R_ - 0.05);
        w.visible = true; w.position.set(Math.cos(a) * r, 0.04 + Math.floor(i / 3) * 0.3, Math.sin(a) * r);
        w.rotation.set(0.15 * Math.sin(i * 3), a, 0.15 * Math.cos(i * 2));
      }
    }
    tray.userData.flash.material.opacity = 0.85 * clamp(cupGlow, 0, 1);
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
    const fl = room.update(clock, false, dt);
    key.intensity = keyBase * (1 + fl * 0.04);
    if (th && th.shake > 0) camera.position.x += Math.sin(th.shake * 60) * 0.35 * th.shake;
    renderer.setViewport(0, 0, Wp, Hp);
    renderer.render(scene, camera);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; lens.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { try { env.rebuild(); } catch { /* keep going */ } Wp = 0; resize(); sprites.ready = sprites.wink['00'] != null; v3.on = true; });

  try { applyTier(); buildSprites(); applyTier(); } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, env, tray, room, root,
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { lens.on = false; game.render(ctx, view); return; }
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; fdt = Math.max(dt, 0.001);
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          try { frame(state, dt); } catch (e) { console.warn('3D frame failed', e); v3.on = false; lens.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
        },
      });
    },
  };
}
