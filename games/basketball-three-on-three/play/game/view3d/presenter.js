// 3D presenter: READS the simulation (game.getState().sim) and draws the hall, the ball and six mannequins. It never writes back.
// Contact discipline: the sim decides where and when the ball is touched; poses.js makes the right hand meet the ball at that moment.
import { Actor } from './actor.js';
import { buildHall, buildBall } from './court.js';
import { poseFor } from './poses.js';
import { CAM, CAMV, vfovOf } from '../src/camera.js';
import { HOOP } from '../src/consts.js';

const LIB = '../vendor3d/index.js';
import { SCALE_BALL, BR, ROLES } from '../src/consts.js';
const SKINS = ['tan', 'deep', 'peach', 'brown', 'clay', 'wood'];
const HAIRS = ['black', 'black', 'brown', 'black', 'brown', 'blond'];
export const MY_KITS = [
  { top: '#2467c9', bottoms: '#173c78', socks: '#f3f3f3', shoes: '#f3f3f3', trim: '#ffd23f' },
  { top: '#1f9d6a', bottoms: '#12583c', socks: '#f3f3f3', shoes: '#f3f3f3', trim: '#ffffff' },
  { top: '#7a45c2', bottoms: '#47257a', socks: '#f3f3f3', shoes: '#f3f3f3', trim: '#ffd23f' },
  { top: '#e8892f', bottoms: '#8a4a12', socks: '#f3f3f3', shoes: '#f3f3f3', trim: '#13283a' },
];
const KITS = [
  MY_KITS[0],
  { top: '#d6402f', bottoms: '#7a1d14', socks: '#f3f3f3', shoes: '#f3f3f3', trim: '#ffffff' },
];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) }; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', mode: 'continuous', shadows: false });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) }; }
  stage.camera.near = 0.5; stage.camera.far = 90; stage.camera.updateProjectionMatrix();
  stage.setLighting('indoor', { exposure: 0.95, hemi: 0.95, keyI: 2.4, rim: 0xcad8ff, rimI: 0.9 });
  stage.setSky('#101c2c', '#101c2c', { near: 40, far: 90 });
  const P = { stage, THREE, humans: [], actors: [], ball: null, hall: null, ready: false, lost: false, V3, exact: false, noRender: false, cam: { ...CAM } };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  // decals: ONE mesh with a quad per player shadow, one for the ball and one highlight ring under the player you control
  const dTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.lineWidth = 7; x.strokeStyle = 'rgba(255,214,64,0.98)'; x.beginPath(); x.arc(96, 32, 25, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(96, 32, 30, 0, Math.PI * 2); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const NQ = 8;
  const dPos = new Float32Array(NQ * 12), dUv = new Float32Array(NQ * 8), dIdx = new Uint16Array(NQ * 6);
  for (let q = 0; q < NQ; q++) {
    const ring = q === 7;
    const u0 = ring ? 0.5 : 0, u1 = ring ? 1 : 0.5;
    dUv.set([u0, 0, u1, 0, u1, 1, u0, 1], q * 8);
    dIdx.set([q * 4, q * 4 + 2, q * 4 + 1, q * 4, q * 4 + 3, q * 4 + 2], q * 6);
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3)); dGeo.setAttribute('uv', new THREE.BufferAttribute(dUv, 2)); dGeo.setIndex(new THREE.BufferAttribute(dIdx, 1));
  const decals = new THREE.Mesh(dGeo, new THREE.MeshBasicMaterial({ map: dTex, transparent: true, depthWrite: false }));
  decals.frustumCulled = false; decals.renderOrder = 1; stage.add(decals);
  const setDecal = (q, x, z, rx, rz) => {
    const o = q * 12, y = 0.012;
    dPos.set([x - rx, y, z + rz, x + rx, y, z + rz, x + rx, y, z - rz, x - rx, y, z - rz], o);
  };

  async function build() {
    P.ready = false;
    P.hall = buildHall(stage, { quality });
    P.ball = buildBall(SCALE_BALL); stage.add(P.ball);
    for (let i = 0; i < 6; i++) {
      const team = i < 3 ? 0 : 1, role = i % 3;
      const h = await loadHuman({ character: 'mannequin_m', kit: KITS[team], skin: SKINS[i], hair: HAIRS[i], legs: 'shorts' });
      h.groundClamp = 'auto'; h.footPlanting = true;
      h.play('ready_stance', { fade: 0, startTime: (i * 0.53) % 2.7 });
      const sc = ROLES[role].scale;
      h.root.scale.setScalar(sc);
      stage.add(h);
      stage.track(h);
      P.humans.push(h);
      const a = new Actor(h);
      P.actors.push({ a, h, i, team, role, sc, state: 'idle', phase: i * 0.37, seed: (i * 7919) % 97 / 97, lastAct: -1, yaw: team === 0 ? Math.PI : Math.PI, lock: null, hand: 'R', handW: 0, ctx: {} });
    }
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build();
  P.build = build;

  // ---- interpolation between 60 Hz sim ticks ----------------------------------------------------------------------------
  const IP = { tick: -1, prev: null, cur: null, w0: 0, dur: 16.7 };
  P.ip = IP;
  const snapOf = (s) => ({ t: s.t, p: s.players.map((p) => ({ x: p.x, z: p.z, vx: p.vx, vz: p.vz, face: p.face, jy: p.jy })), b: { x: s.ball.x, y: s.ball.y, z: s.ball.z, vx: s.ball.vx, vy: s.ball.vy, vz: s.ball.vz } });
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };
  function display(s) {
    const now = performance.now();
    if (P.exact || !IP.cur) { IP.cur = snapOf(s); IP.prev = IP.cur; IP.tick = s.tick; return { ...IP.cur, td: s.t }; }
    if (s.tick !== IP.tick) {
      const el = Math.min(3, Math.max(1, s.tick - IP.tick));
      // blend from the previous observed tick to this one (uniform motion at any display rate: 60, 90, 120 Hz)
      IP.prev = IP.cur; IP.cur = snapOf(s); IP.w0 = now; IP.dur = 16.7 * (s.tick < IP.tick ? 1 : el); IP.tick = s.tick;
    }
    const a = Math.min(1, (now - IP.w0) / IP.dur);
    const sh = { t: lerp(IP.prev.t, IP.cur.t, a), p: IP.cur.p.map((q, i) => { const o = IP.prev.p[i]; return { x: lerp(o.x, q.x, a), z: lerp(o.z, q.z, a), vx: q.vx, vz: q.vz, face: lerpAng(o.face, q.face, a), jy: lerp(o.jy, q.jy, a) }; }), b: { x: lerp(IP.prev.b.x, IP.cur.b.x, a), y: lerp(IP.prev.b.y, IP.cur.b.y, a), z: lerp(IP.prev.b.z, IP.cur.b.z, a), vx: IP.cur.b.vx, vy: IP.cur.b.vy, vz: IP.cur.b.vz } };
    // a teleport (new possession, free throws): no blending
    if (Math.hypot(IP.cur.b.x - IP.prev.b.x, IP.cur.b.z - IP.prev.b.z) > 3 || s.t < IP.prev.t) { sh.p = IP.cur.p; sh.b = IP.cur.b; sh.t = IP.cur.t; }
    IP.shown = sh;
    return { ...sh, td: sh.t };
  }

  // adaptive quality: when frames run long on a weak device, solve the arms more cheaply, then lower the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 21 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) { for (const pa of P.actors) pa.a.lite = true; }
        else { stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio())); }
        stage.invalidate();
      }
    }
  }
  const ballSpin = { x: 0, y: 0, z: 0 };
  let lastT = null;
  function frame(game, view) {
    if (!P.ready || P.lost) return;
    const G0 = game.getState();
    const s = G0.sim;
    { const ki = G0.settings ? G0.settings.kitIdx | 0 : 0, ci = G0.settings ? G0.settings.courtIdx | 0 : 0; if (ki !== P.kitIdx) { P.kitIdx = ki; for (let i = 0; i < 3; i++) P.humans[i].setKit(MY_KITS[Math.min(ki, MY_KITS.length - 1)]); } if (ci !== P.courtIdx && P.hall) { P.courtIdx = ci; P.hall.setCourt(ci); } }
    const show = !!s && (G0.scene === 'play' || G0.scene === 'title' || G0.scene === 'result' || G0.scene === 'setup' || G0.scene === 'settings' || G0.scene === 'learn' || G0.scene === 'lesson' || G0.scene === 'lessonresult' || G0.scene === 'quiz' || G0.scene === 'demolimit' || G0.scene === undefined);
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    const D = display(s);
    let dt = lastT === null ? 0 : D.t - lastT; lastT = D.t;
    if (dt < 0) dt = 0; dt = Math.min(dt, 0.1);
    // ---- players
    for (let i = 0; i < 6; i++) {
      const sp = s.players[i], d = D.p[i], pa = P.actors[i], H = pa.h;
      H.root.visible = !sp.out;
      if (sp.out) continue;
      H.root.position.set(d.x, 0, d.z);
      H.setFacing(d.face);
      pa.yaw = d.face;
      const speed = Math.hypot(d.vx, d.vz);
      poseFor(P, s, sp, d, pa, D, dt, speed);
    }
    // ---- ball
    const bm = P.ball, b = D.b, sb = s.ball;
    bm.position.set(b.x, b.y, b.z);
    {
      // roll on the floor, backspin in flight, a lazy turn when dribbled
      const sp = Math.hypot(b.vx, b.vz);
      if (sb.mode === 'held') { bm.rotation.y += dt * 0.6; }
      else if (sb.mode === 'loose' && b.y < 0.16) { const k = 1 / BR; bm.rotation.x += (b.vz * dt) * k; bm.rotation.z -= (b.vx * dt) * k; }
      else if (sp > 0.05) { const ax = Math.atan2(b.vx, b.vz); const w = 12 * dt; bm.rotateOnWorldAxis(V(Math.cos(ax), 0, -Math.sin(ax)), -w); }
    }
    bm.visible = true;
    // net
    P.hall.net.update(Math.abs(b.x) < 1 && b.y < 3.5 && b.y > 2.2 ? { x: b.x, y: b.y, z: b.z, r: BR } : null, Math.min(dt, 0.025));   // the net spring solver blows up with big steps (slow frames): cap it
    // decals
    for (let i = 0; i < 6; i++) { const sp = s.players[i], d = D.p[i]; if (sp.out) { setDecal(i, 0, 0, 0, 0); continue; } setDecal(i, d.x, d.z, 0.62 + d.jy * 0.1, 0.4 + d.jy * 0.06); }
    { const h = Math.max(0, b.y - 0.12); const k = 0.2 + h * 0.06; setDecal(6, b.x, b.z, k, k * 0.65); }
    if (s.humanId >= 0 && !s.players[s.humanId].out) { const d = D.p[s.humanId]; setDecal(7, d.x, d.z, 0.62, 0.42); } else setDecal(7, 0, 0, 0, 0);
    dGeo.attributes.position.needsUpdate = true;
    // ---- camera: fixed
    positionCamera();
    stage.setShadowTarget(0, 0, 3);
    if (!P.noRender) { stage.render(); perfTick(); }
  }
  // FLUID FRAMING: the camera position and direction never change; the field of view and a small principal-point shift are solved from the live
  // screen size (src/camera.js fitCamera, set by game.js each frame) so the whole half court fills the free part of the screen, never stretched.
  let camKey = '';
  function positionCamera() {
    const c = P.camOverride || P.cam, cam = stage.camera;
    const W = canvas.clientWidth || 720, Hh = canvas.clientHeight || 1280;
    const key = `${W}x${Hh}|${CAMV.key}`;
    if (key !== camKey) {
      camKey = key;
      const aspect = W / Hh;
      cam.aspect = aspect;
      if (P.camOverride) { cam.fov = (2 * Math.atan(Math.tan((c.hfov * Math.PI) / 360) / aspect) * 180) / Math.PI; cam.clearViewOffset(); }
      else {
        cam.fov = vfovOf(CAMV);
        // principal-point shift (NDC) -> a view offset in css pixels: content moves right by ox/2 * W, up by oy/2 * H
        cam.setViewOffset(W, Hh, (-CAMV.ox / 2) * W, (CAMV.oy / 2) * Hh, W, Hh);
      }
      cam.updateProjectionMatrix();
    }
    cam.position.set(c.x, c.y, c.z); cam.lookAt(c.lx, c.ly, c.lz);
  }

  // The 3D canvas sits exactly under the kit canvas's virtual rectangle (the whole screen; only beyond the kit's maximum aspect are there bars).
  function placeCanvas(view) {
    const cw = kitCanvas.clientWidth || globalThis.innerWidth, ch = kitCanvas.clientHeight || globalThis.innerHeight;
    const vw = (view && view.width) || 720, vh = (view && view.height) || 1280;
    const sc = Math.min(cw / vw, ch / vh), w = Math.round(vw * sc), h = Math.round(vh * sc);
    const key = `${cw}x${ch}|${w}x${h}`;
    if (key === P.placeKey) return;
    P.placeKey = key;
    const full = Math.abs(w - cw) <= 1 && Math.abs(h - ch) <= 1;
    canvas.style.cssText = full ? 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0'
      : `position:fixed;left:${Math.round((cw - w) / 2)}px;top:${Math.round((ch - h) / 2)}px;width:${w}px;height:${h}px;display:block;pointer-events:none;z-index:0`;
    stage.resize();
  }
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      placeCanvas(view);
      frame(game, view);
    };
    return game;
  };
  P.frame = frame;
  return P;
}
