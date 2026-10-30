// Yut Nori 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: the mal-pan on its indigo cloth on an oiled-paper ondol floor, lacquered tokens, black lacquer trays, a crimson silk cushion
// with the four yut sticks. On board screens the camera is fitted to the layout's board rectangle and the cushion is placed under the
// layout's pad rectangle, so the 2D HUD, rings, labels and taps line up through v3.proj / v3.pick. No WebGL, ?flat=1 or a lost
// context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, rectWorld, GB, PAD, POINTS, TRAY } from '../src/layout.js';
import { HOME } from '../src/rules.js';
import { stickPose } from '../src/view.js';
import {
  U, CLOTH_H, TOK_H, TRAY_TOP, STICK, CUSHION, lx2x, ly2z, x2lx, z2ly,
  buildFloor, buildBoard, buildTrays, tokenKit, stickKit, buildCushion, buildRoom, buildBowl, buildLights, radialTex,
} from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 2048 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SETTLE = 0.36;
const TRAY_S = 0.74;                                   // tokens in the trays are a little smaller

// A landed token: two small damped rocks and a hair of rebound.
export function settlePose(t) {
  if (t >= SETTLE || t < 0) return { y: 0, tilt: 0 };
  const s = t / SETTLE, d = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 2)) * 0.3 * d, tilt: Math.sin(s * Math.PI * 4) * 0.1 * d };
}
// the title's board: a game in progress (a stack riding the diagonal, red tokens spread round the ring)
const TITLE_G = { wait: [1, 1], home: [1, 0], g: [[{ pos: 21, n: 2 }], [{ pos: 13, n: 1 }, { pos: 7, n: 1 }, { pos: 18, n: 1 }]], phase: 'throw', turn: 0, winner: -1 };

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140d0a);
  scene.fog = new THREE.Fog(0x140d0a, 260, 700);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildFloor(scene, tier < 2 ? 1 : 0);
  buildRoom(scene);
  await tick();
  let board = buildBoard(TIERS[tier].tex); scene.add(board);
  scene.add(buildTrays());
  const bowl = buildBowl(); bowl.position.set(lx2x(-90), 0, ly2z(330)); bowl.rotation.y = 0.6; scene.add(bowl);
  await tick();
  const tk = tokenKit(), pool = [[], []], CAP = 12;
  for (const team of [0, 1]) for (let i = 0; i < CAP; i++) { const m = tk.make(team); m.visible = false; scene.add(m); pool[team].push(m); }
  const sk = stickKit(), sticks = [0, 1, 2, 3].map((i) => { const m = sk.make(i); scene.add(m); return m; });
  const cushion = buildCushion(); scene.add(cushion);
  await tick();
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  // rings (legal points, selection, hints) as light lying on the paper
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 18, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.55, 'rgba(255,255,255,0.32)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(0.83, 'rgba(255,255,255,0.85)'); g.addColorStop(0.93, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const rings = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  // landing puffs: paper dust on the board, a soft lift of silk fluff on the cushion
  const dustT = radialTex('236,214,170', 0.85);
  const dust = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, y, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, y, z, s }; };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 56, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 120 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 7; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  // a virtual-unit screen point -> world point on the horizontal plane y = h (null above the horizon)
  function unproject(vx, vy, h, cam = camera) {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, cam); plane.constant = -h;
    return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null;
  }

  // ---------------------------------------------------------------- v3 hooks for the 2D layer
  v3.proj = (lx, ly, h = 0) => virt(toCss(camera, lx2x(lx), CLOTH_H + h, ly2z(ly)));
  v3.pick = (vx, vy) => { const w = unproject(vx, vy, CLOTH_H); return w ? { x: x2lx(w.x), y: z2ly(w.z) } : null; };

  // ---------------------------------------------------------------- the cushion: where the pad is, in world space
  const pad = { x: 0, z: 46, w: CUSHION.w, d: CUSHION.d, yaw: 0 };
  function placePadFromLayout(L) {
    const r = rectWorld(L.pad, PAD), top = CUSHION.h, mid = (x, y) => unproject(x, y, top);
    const c = mid(r.x + r.w / 2, r.y + r.h / 2), l = mid(r.x, r.y + r.h / 2), rr = mid(r.x + r.w, r.y + r.h / 2), t = mid(r.x + r.w / 2, r.y), b = mid(r.x + r.w / 2, r.y + r.h);
    if (!c || !l || !rr || !t || !b) return;
    pad.x = c.x; pad.z = c.z; pad.w = Math.hypot(rr.x - l.x, rr.z - l.z); pad.d = Math.hypot(b.x - t.x, b.z - t.z); pad.yaw = -Math.atan2(rr.z - l.z, rr.x - l.x);
  }
  function placePadFixed(x, z, w, yaw = 0) { pad.x = x; pad.z = z; pad.w = w; pad.d = w * CUSHION.d / CUSHION.w; pad.yaw = yaw; }
  // pad-local (the 2D pad art space) -> world on the cushion
  const padC = { x: PAD.x + PAD.w / 2, y: PAD.y + PAD.h / 2 };
  function padWorld(px, py) {
    const u = (px - padC.x) / PAD.w * pad.w, v = (py - padC.y) / PAD.h * pad.d, c = Math.cos(pad.yaw), s = Math.sin(pad.yaw);
    return { x: pad.x + u * c + v * s, z: pad.z - u * s + v * c };
  }

  // ---------------------------------------------------------------- tokens
  const used = [0, 0];
  const beginTok = () => { used[0] = used[1] = 0; };
  function tok(team, x, y, z, sc = 1, tiltX = 0, tiltZ = 0, yaw = 0) {
    if (used[team] >= CAP) return;
    const m = pool[team][used[team]++]; m.visible = true; m.position.set(x, y, z); m.scale.setScalar(sc); m.rotation.set(tiltX, yaw, tiltZ, 'YXZ');
  }
  const endTok = () => { for (const team of [0, 1]) for (let i = used[team]; i < CAP; i++) pool[team][i].visible = false; };
  function stack(team, lx, ly, n, base, o = {}) {
    const sc = o.sc ?? 1, x = lx2x(lx), z = ly2z(ly);
    for (let k = 0; k < n; k++) tok(team, x, base + (o.lift || 0) + k * TOK_H * sc * 1.01, z, sc, o.tx || 0, o.tz || 0, (k % 2 ? 0.06 : -0.04) + (o.yaw || 0));
  }

  let clock = 0, lastAnim = null;
  const settled = new Map();
  function drawTokens(state, g, boardScreen) {
    const a = boardScreen ? state.anim : null, calm = state.calm, t = state.t;
    if (a !== lastAnim) {
      if (lastAnim && !calm && lastAnim.to >= 0) { settled.set(lastAnim.to, clock); const p = POINTS[lastAnim.to]; puff(lx2x(p.x), CLOTH_H + 0.05, ly2z(p.y), 1); }
      lastAnim = a;
    }
    beginTok();
    // trays: waiting and home
    for (const team of [0, 1]) {
      const T = TRAY[team]; let waitN = g.wait[team], homeN = g.home[team];
      if (a) {
        if (a.team === team && a.from === -1) waitN += 1;
        if (a.cap && a.cap.team === team && a.t < a.capT) waitN -= a.cap.n;
        if (a.team === team && a.home && a.t < a.dur) homeN -= a.home;
      }
      if (state.scene === 'over' && team === g.winner) homeN = 0;
      for (let k = 0; k < Math.min(4, waitN); k++) { const p = T.wait(k); stack(team, p.x, p.y, 1, TRAY_TOP, { sc: TRAY_S }); }
      for (let k = 0; k < Math.min(4, homeN); k++) { const p = T.home(k); stack(team, p.x, p.y, 1, TRAY_TOP, { sc: TRAY_S }); }
    }
    const humanMove = boardScreen && state.scene !== 'autoplay' && g.phase === 'move' && !a && (state.two || g.turn === 0) && g.winner < 0;
    for (const team of [0, 1]) for (const s of g.g[team]) {
      let n = s.n;
      if (a && a.team === team && a.to === s.pos) n -= a.n;
      if (a && a.cap && a.cap.pos === s.pos && a.team !== team) continue;
      if (n <= 0) continue;
      const p = POINTS[s.pos], sel = state.sel === s.pos && team === g.turn && humanMove;
      const st = settled.has(s.pos) ? settlePose(clock - settled.get(s.pos)) : { y: 0, tilt: 0 };
      stack(team, p.x, p.y, n, CLOTH_H + st.y, { lift: sel ? 1.4 + (calm ? 0 : Math.sin(t * 4) * 0.3) : 0, tz: st.tilt });
    }
    for (const [i, t0] of settled) if (clock - t0 > SETTLE) settled.delete(i);
    if (state.scene === 'over' && g.winner >= 0) stack(g.winner, POINTS[0].x, POINTS[0].y, 4, CLOTH_H, { lift: calm ? 0 : 0.3 + Math.sin(t * 2.2) * 0.3 });
    if (a && a.cap) {
      const cp = POINTS[a.cap.pos], k = a.t - a.capT;
      if (a.t < a.capT) stack(a.cap.team, cp.x, cp.y, a.cap.n, CLOTH_H);
      else if (k < 0.5) {
        const f = sm(k / 0.5), to = TRAY[a.cap.team].wait(Math.max(0, g.wait[a.cap.team] - 1));
        stack(a.cap.team, cp.x + (to.x - cp.x) * f, cp.y + (to.y - cp.y) * f, a.cap.n, CLOTH_H + (TRAY_TOP - CLOTH_H) * f + Math.sin(f * Math.PI) * 9, { sc: 1 - f * (1 - TRAY_S), tx: f * 2.6 });
      }
    }
    if (a && a.t < a.dur) {
      const pts = [a.from === -1 ? TRAY[a.team].wait(g.wait[a.team]) : POINTS[a.from]].concat(a.path.map((p2) => (p2 === HOME || p2 === -1 ? POINTS[0] : POINTS[p2])));
      const per = a.dur / (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(a.t / per)), f = sm(Math.min(1, (a.t - i * per) / per));
      const p0 = pts[i], p1 = pts[i + 1], x = p0.x + (p1.x - p0.x) * f, y = p0.y + (p1.y - p0.y) * f;
      const lift = Math.sin(f * Math.PI) * (a.back ? 1.3 : 2.6) * (calm ? 0.6 : 1);
      const fromTray = a.from === -1 && i === 0, sc = fromTray ? TRAY_S + (1 - TRAY_S) * f : 1, base = fromTray ? TRAY_TOP + (CLOTH_H - TRAY_TOP) * f : CLOTH_H;
      const dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy) || 1, lean = calm ? 0 : 0.22 * Math.sin(Math.PI * f) * (f < 0.5 ? 1 : -0.5);
      stack(a.team, x, y, a.n, base, { lift, sc, tx: (dy / L) * lean, tz: -(dx / L) * lean });
    }
    endTok();
  }

  // ---------------------------------------------------------------- sticks
  const _e = new THREE.Euler();
  function putStick(i, px, py, rot, theta, hLocal, wob = 0) {
    const m = sticks[i], k = clamp((210 * pad.w / PAD.w) / STICK.L, 0.6, 1.1), w = padWorld(px, py);
    const c = Math.cos(theta), s = Math.sin(theta);
    const rest = (c > 0 ? c * 0.58 * STICK.H : -c * 0.42 * STICK.H) + Math.abs(s) * STICK.W * 0.5;
    m.scale.setScalar(k); m.visible = true;
    m.position.set(w.x, CUSHION.h + rest * k + hLocal * (pad.w / PAD.w) * 0.85, w.z);
    _e.set(wob, pad.yaw - rot, theta, 'YXZ'); m.quaternion.setFromEuler(_e);
  }
  const landed = [0, 0, 0, 0];
  function drawSticks(state, boardScreen) {
    const ta = boardScreen ? state.throwAnim : null;
    if (ta) {
      ta.sticks.forEach((st, i) => {
        const u = clamp((ta.t - st.d) / (ta.dur - 0.14), 0, 1), p = stickPose(st, u, ta.strength);
        const wob = p.h > 1 ? Math.sin(u * 17 + i) * 0.25 * Math.min(1, p.h / 60) : 0;
        putStick(i, p.x, p.y, p.rot, p.theta, p.h, wob);
        if (u >= 0.6 && landed[i] === 0 && !state.calm) { landed[i] = 1; const w = padWorld(p.x, p.y); puff(w.x, CUSHION.h + 0.1, w.z, 0.9); }
      });
      return;
    }
    landed.fill(0);
    if (boardScreen && state.grip) {
      for (let i = 0; i < 4; i++) putStick(i, state.grip.x + (i - 1.5) * 16, state.grip.y - 20 + Math.sin(state.t * 20 + i) * 1.5, (i - 1.5) * 0.12, Math.acos(clamp(Math.cos(i * 0.6 + 0.4), -1, 1)), 40);
      return;
    }
    if (boardScreen) { state.rest.forEach((st, i) => putStick(i, st.x, st.y, st.rot, st.flat ? 0 : Math.PI, 0)); return; }
    // title: an endless toss, seeded per cycle, the same pose function as a real throw
    const per = 4.4, cyc = Math.floor(clock / per), u = (clock - cyc * per) / 1.5;
    const r = (n) => { const v = Math.sin(cyc * 91.7 + n * 37.3) * 43758.5; return v - Math.floor(v); };
    for (let i = 0; i < 4; i++) {
      const st = { x0: 360 + (i - 1.5) * 14, y0: PAD.y + PAD.h + 60, xf: 360 + (i - 1.5) * 132 + (r(i) - 0.5) * 28, yf: PAD.y + PAD.h / 2 + (r(i + 4) - 0.5) * 52, rot0: (r(i + 8) - 0.5) * 2.2, rotf: (r(i + 12) - 0.5) * 0.84, turns: 2 + Math.floor(r(i + 16) * 2), flat: r(i + 20) < 0.5, d: 0 };
      const p = stickPose(st, clamp(u - i * 0.03, 0, 1), state.calm ? 0.3 : 0.9);
      putStick(i, p.x, p.y, p.rot, p.theta, p.h, p.h > 1 ? Math.sin(u * 17 + i) * 0.2 : 0);
    }
  }

  function drawRings(marks) {
    let k = 0;
    for (const mk of marks) {
      if (k >= rings.length) break;
      const r = rings[k++], s = mk.r * U * 2.6;
      r.visible = true; r.position.set(lx2x(mk.x), CLOTH_H + 0.06, ly2z(mk.y)); r.scale.set(s, 1, s);
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255);
      r.material.color.setRGB(cr * cr * 1.3, cg * cg * 1.3, cb * cb * 1.3); r.material.opacity = clamp(mk.a ?? 1, 0, 1);
    }
    for (; k < rings.length; k++) rings[k].visible = false;
  }

  // ---------------------------------------------------------------- framing per screen
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  const BOARD = new Set(['play', 'lesson', 'autoplay', 'puzzle']);
  const isBoard = (s) => BOARD.has(s.scene) && !(s.scene === 'puzzle' && s.pz?.status === 'making');
  const boardPts = [[26, 296], [694, 296], [26, 1070], [694, 1070]].map(([x, y]) => [lx2x(x), 0.5, ly2z(y)]);
  function framing(state, L) {
    const calm = state.calm, t = clock;
    if (isBoard(state)) {
      const rc = rectCss(rectWorld(L.board, GB));
      return { goal: fit(rc, boardPts, { yaw: 0, tilt: L.wide ? 48 : 51, fov: 30, tx: 0, ty: 0, tz: 0 }), board: true };
    }
    const drift = calm ? 0 : 1;
    if (state.scene === 'over') {
      const O = L.over, s = O.token.s, rc = rectCss({ x: O.token.x - 110 * s, y: O.token.y - 80 * s, w: 220 * s, h: 150 * s });
      const p0 = POINTS[0], cx = lx2x(p0.x) - 2, cz = ly2z(p0.y) - 3, pts = [[cx - 9, 0, cz - 9], [cx + 9, 0, cz + 9], [cx, TOK_H * 4 + 2, cz]];
      return { goal: fit(rc, pts, { yaw: -24 + 5 * Math.sin(t * TAU / 26) * drift, tilt: 26, fov: 30, tx: cx, ty: 2, tz: cz }), board: false };
    }
    // title, demo-limit, About / How to play: the hero view of the board and the cushion with the sticks in the air
    const T = L.title(!!state.saved), art = T.art;
    let r;
    if (art.panel) { const y0 = T.compact ? T.statsY + 18 : art.tagY + 30; r = { x: art.panel.x, y: y0, w: art.panel.w, h: art.panel.y + art.panel.h - y0 - 10 }; }
    else { const y0 = art.tagY + 40; r = T.rowsTop - 24 - y0 < 260 ? { x: 10, y: y0, w: L.w - 20, h: L.h - y0 - 30 } : { x: 10, y: y0, w: L.w - 20, h: T.rowsTop - 24 - y0 }; }
    const rc = rectCss(r);
    const pts = [[lx2x(40), 0, ly2z(380)], [lx2x(680), 0, ly2z(380)], [lx2x(26), 0, ly2z(1040)], [lx2x(694), 0, ly2z(1040)], [pad.x - pad.w / 2, 0, pad.z + pad.d / 2], [pad.x + pad.w / 2, 0, pad.z + pad.d / 2], [0, 14, pad.z]];
    return { goal: fit(rc, pts, { yaw: -14 + 7 * Math.sin(t * TAU / 32) * drift, tilt: 31 + 3 * Math.sin(t * TAU / 21) * drift, fov: 32, tx: 0, ty: 0, tz: 8 }), board: false };
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), boardScreen = isBoard(state);
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== boardScreen) { wasBoard = boardScreen; snap = true; }
    if (!boardScreen) placePadFixed(lx2x(470), ly2z(1038) + 22, 62, 0.12);
    const f = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || f.board ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(f.goal)) cur[key] += (f.goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    if (boardScreen) placePadFromLayout(L);
    v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState(), boardScreen = isBoard(state);
    if (!(state.scene === 'autoplay' && state.ap?.paused)) clock += dt;
    const g = boardScreen || state.scene === 'over' ? state.game : TITLE_G;
    drawTokens(state, g, boardScreen);
    cushion.position.set(pad.x, 0, pad.z); cushion.rotation.y = pad.yaw; cushion.scale.set(pad.w / CUSHION.w * 1.06, 1, pad.d / CUSHION.d * 1.08);
    const showPad = state.scene !== 'over'; cushion.visible = showPad;
    if (showPad) drawSticks(state, boardScreen); else for (const m of sticks) m.visible = false;
    drawRings(boardScreen ? v3.marks : state.scene === 'over' ? [{ x: POINTS[0].x, y: POINTS[0].y, rgb: '255,214,110', r: 58 + Math.sin(clock * 2.4) * 4, a: 0.85 }] : []);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (3 + f * 7) * u.s;
      m.visible = true; m.position.set(u.x, u.y + f * 0.6, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.5 * (1 - f) * (1 - f);
    }
    // the lantern light breathes a little
    lights.lamp.intensity = 1.2 * (state.calm ? 1 : 0.94 + 0.05 * Math.sin(clock * 3.1) + 0.03 * Math.sin(clock * 7.7));
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); scene.remove(board); board.userData.dispose(); board = buildBoard(TIERS[tier].tex); scene.add(board);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
