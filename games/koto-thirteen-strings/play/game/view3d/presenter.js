// Koto 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas. Playing screens: a straight-down perspective camera SOLVED from the layout's instrument rectangle, so the strings, bridges and
// body land exactly on the 2D layout (cue circles, hit zones and touch mapping are unchanged) and the WHOLE koto is always in view.
// Menus: the koto as a hero object on tatami in a lamp-lit room, slowly drifting. No WebGL, ?flat=1 or a lost context: v3.on = false and
// every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { GEO } from '../src/music.js';
import { materials, buildKoto, poseString, buildTsume, buildRoom, buildMotes, buildLights } from './world.js';

const D2R = Math.PI / 180, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const PLAY_FOV = 34;
// Hero koto (title and menus), centimetres: a 180 cm instrument, about 25 cm wide.
export const HERO = { len: 164, sp: 3.0, m: 3.4, hS: 3.6, bodyH: 10, k: 1, detail: 1 };
const HERO_BU = [0.80, 0.755, 0.71, 0.665, 0.62, 0.575, 0.53, 0.485, 0.44, 0.395, 0.35, 0.305, 0.26];

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const vig = document.createElement('div'); vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 52%,rgba(8,5,16,0.62) 100%)'; kitCanvas.parentElement.insertBefore(vig, kitCanvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0d0c1c);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0c1c);
  const camera = new THREE.PerspectiveCamera(PLAY_FOV, 1, 2, 60000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.22; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const M = materials();
  await tick();
  const room = buildRoom(M); scene.add(room.group);
  const motes = buildMotes(); room.group.add(motes);
  await tick();
  const tsume = buildTsume(M); const tsumeRoot = new THREE.Group(); tsumeRoot.add(tsume); scene.add(tsumeRoot); tsumeRoot.visible = false;
  await tick();
  // koto instances: the hero (cm) and one per play geometry (layout units), built on demand
  const kotos = new Map();
  const root = new THREE.Group(); scene.add(root);
  function kotoFor(P, key) {
    let K = kotos.get(key);
    if (!K) {
      if (kotos.size > 5) { for (const [k2, v] of kotos) if (k2 !== 'hero') { root.remove(v.group); v.group.traverse((m) => m.geometry && m.geometry.dispose()); kotos.delete(k2); } }
      K = buildKoto(P, M); K.group.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); K.group.visible = false; root.add(K.group); kotos.set(key, K);
      K.floorY = K.footBottom - 0.2 * P.k; K.P = P;
    }
    return K;
  }
  const heroK = kotoFor(HERO, 'hero');
  HERO_BU.forEach((u, s) => heroK.placeBridge(s, u));
  for (let s = 0; s < HERO_BU.length; s++) poseString(heroK, s, HERO_BU[s], 0, 0, 0);
  heroK.group.position.set(-HERO.len * 0.5, 0, HERO.sp * 6.5);

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    motes.visible = tier < 2;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera helpers (same maths as the oud presenter)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const toCssX = (x) => x * cpu() + offX(), toCssY = (y) => y * cpu() + offY();
  const focal = (fov) => (cssH() / 2) / Math.tan(fov * D2R / 2);
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  function place(cam, p) {
    const W = cssW(), H = cssH();
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz); _v.set(p.dx, p.dy, p.dz).normalize();
    cam.position.copy(_t).addScaledVector(_v, p.dist); cam.up.set(p.ux, p.uy, p.uz); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 300 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 8; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const v of pts) { toCss(fitCam, v.x, v.y, v.z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  // the hero's body corners in the world (it is rotated about y)
  const heroPts = () => {
    heroK.group.updateMatrixWorld(true); const out = [], Kh = heroK;
    for (const x of [Kh.x0, Kh.x1]) for (const z of [Kh.z0, Kh.z1]) for (const y of [-Kh.bodyH - 4, Kh.hS]) out.push(new THREE.Vector3(x, y, z).applyMatrix4(heroK.group.matrixWorld));
    return out;
  };

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, clock = 0, viewKey = '', snap = true, F = null;
  const cur = { fov: 30, tx: 0, ty: 0, tz: 0, dist: 300, ox: 0, oy: 0, dx: 0, dy: 1, dz: 1, ux: 0, uy: 1, uz: 0 };

  function playGeom(inst) {
    const k = inst.len / 164, P = { len: inst.len, sp: inst.sp, m: inst.m, hS: inst.sp * 0.95, bodyH: inst.sp * 2.6, k, detail: tier ? 0.6 : 1 };
    return { P, key: `${Math.round(inst.len)}|${Math.round(inst.sp * 10)}|${Math.round(inst.m)}|${P.detail}`, k };
  }
  function framing(state, L) {
    const sc = state.scene;
    if ((sc === 'play' && state.pl) || (sc === 'free' && state.free)) {
      const inst = (sc === 'play' ? L.play : L.free).inst, { P, key, k } = playGeom(inst), K = kotoFor(P, key);
      const c = inst.pt(0.5, 6), px = toCssX(c.x), py = toCssY(c.y), dist = focal(PLAY_FOV) / cpu();
      const base = { fov: PLAY_FOV, tx: 0.5 * inst.len, ty: 0, tz: -6.5 * inst.sp, dist, ox: cssW() / 2 - px, oy: cssH() / 2 - py, dx: 0, dy: 1, dz: 0 };
      return { kind: 'play', K, k, inst, sess: sc === 'play' ? state.pl : state.free, cam: inst.vert ? { ...base, ux: -1, uy: 0, uz: 0 } : { ...base, ux: 0, uy: 0, uz: -1 } };
    }
    const S = L.S, t = clock, calm = state.prefs?.calm, drift = calm ? 0 : 1, T = L.title;
    const hr = sc === 'title' && v3.hero ? v3.hero : { r: { x: S.x + S.w * 0.06, y: S.y + S.h * 0.22, w: S.w * 0.88, h: S.h * 0.56 }, vert: L.vert };
    const yaw = 5 * D2R * Math.sin(t * TAU / 40) * drift, tilt = (50 + 3 * Math.sin(t * TAU / 27) * drift) * D2R;
    heroRoot_rot(hr.vert ? -Math.PI / 2 + 0.2 : hr.diag ? -0.62 : 0.2);
    const base = { fov: 30, tx: 0, ty: 0, tz: 0, dx: Math.sin(yaw) * Math.cos(tilt), dy: Math.sin(tilt), dz: Math.cos(yaw) * Math.cos(tilt), ux: 0, uy: 1, uz: 0 };
    const r = hr.r, rc = { x: toCssX(r.x), y: toCssY(r.y), w: r.w * cpu(), h: Math.max(40, r.h) * cpu() };
    return { kind: 'hero', cam: fit(rc, heroPts(), base), show: sc === 'title' };
  }
  function heroRoot_rot(r) { heroK.group.rotation.y += (r - heroK.group.rotation.y) * 1; }

  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height);
    const vk = `${cssW()}x${cssH()}|${state.scene === 'free' ? 'play' : state.scene}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    F = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const kk = snap || F.kind !== 'hero' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(F.cam)) cur[key] += (F.cam[key] - (cur[key] ?? F.cam[key])) * kk;
    snap = false;
    place(camera, cur);
  }

  const tz = { x: 0, z: 0, h: 3, on: 0 };
  function post() {
    if (!game || lost || !F) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = !!state.prefs?.calm;
    canvas.style.visibility = 'visible';
    for (const K of kotos.values()) K.group.visible = false;
    tsumeRoot.visible = false;
    let lit = 0.6, sc = 1, K;
    if (F.kind === 'play') {
      K = F.K; const inst = F.inst, k = F.k; sc = k; K.group.visible = true;
      K.group.position.set(0, 0, 0); K.group.rotation.set(0, 0, 0); K.group.scale.set(1, 1, 1);
      const bu = v3.bu || HERO_BU, ss = v3.ss || [];
      for (let s = 0; s < bu.length; s++) {
        K.placeBridge(s, bu[s]);
        const st = ss[s] || {};
        poseString(K, s, bu[s], calm ? 0 : (st.vib ?? 0) * inst.sp * 0.5, st.ph ?? 0, st.press ?? 0);
        const hot = (st.glow ?? 0) > 0.25; if (K.bridges[s].material !== (hot ? M.ivoryHot : M.ivory)) K.bridges[s].material = hot ? M.ivoryHot : M.ivory;
      }
      room.group.scale.setScalar(k); room.group.position.set(0.5 * inst.len, K.floorY, -6.5 * inst.sp - 300 * k); room.group.rotation.y = 0;
      const t = v3.tsume;
      if (t) {
        const ts = inst.sp * 0.5; tsumeRoot.visible = true; tsumeRoot.scale.setScalar(ts);
        const d = clamp(t.down, 0, 1); tz.x += ((GEO.uHit + 0.1) * inst.len - tz.x) * 0.5;
        tsumeRoot.position.set(tz.x + 2.2 * ts * (1 - d), 1.1 * ts + 3.2 * ts * (1 - d), -(t.sf + 0.5) * inst.sp);
        tsumeRoot.rotation.set(0, Math.PI / 2, 0.25 * (1 - d));
      }
      lit = state.scene === 'free' ? 0.6 : 0.5 + 0.5 * Math.min(1, (F.sess.ens || 0) / 3);
      const cx = 0.5 * inst.len, cz = -6.5 * inst.sp, L2 = inst.len;
      lights.key.position.set(cx - 0.5 * L2, 0.75 * L2, cz + 0.55 * L2); lights.key.target.position.set(cx, 0, cz);
      const sh = lights.key.shadow.camera; sh.left = -0.62 * L2; sh.right = 0.62 * L2; sh.top = 0.62 * L2; sh.bottom = -0.62 * L2; sh.near = 0.3 * L2; sh.far = 2.6 * L2;
      lights.rim.position.set(cx + 0.7 * L2, 0.4 * L2, cz - 0.7 * L2); lights.rim.target.position.set(cx, 0, cz);
      lights.fill.position.set(cx - 0.8 * L2, 0.3 * L2, cz + 0.7 * L2); lights.fill.target.position.set(cx, 0, cz);
    } else {
      K = heroK; K.group.visible = F.show; sc = 1;
      const hr = heroK.group.rotation.y; K.group.position.set(-Math.cos(hr) * HERO.len * 0.5 * 0 - 0, 0, 0);
      heroK.group.position.set(0, 0, 0);
      // centre the body on the origin
      heroK.group.position.x = -((heroK.x0 + heroK.x1) / 2) * Math.cos(hr); heroK.group.position.z = ((heroK.x0 + heroK.x1) / 2) * Math.sin(hr) + HERO.sp * 6.5 * Math.cos(hr);
      room.group.scale.setScalar(1); room.group.position.set(0, K.floorY, -60); room.group.rotation.y = 0;
      for (let s = 0; s < HERO_BU.length; s++) { const age = (clock * 0.6 + s * 0.31) % 7; poseString(K, s, HERO_BU[s], calm || age > 1.2 || s % 3 ? 0 : Math.exp(-age * 3) * 0.5, clock * 40, 0); }
      lit = 0.8;
      lights.key.position.set(-60, 220, 140); lights.key.target.position.set(0, 0, 0);
      const sh = lights.key.shadow.camera; sh.left = -130; sh.right = 130; sh.top = 130; sh.bottom = -130; sh.near = 80; sh.far = 520;
      lights.rim.position.set(160, 80, -170); lights.rim.target.position.set(0, 10, 0);
      lights.fill.position.set(-180, 60, 150); lights.fill.target.position.set(0, 0, 0);
    }
    lights.key.shadow.camera.updateProjectionMatrix();
    const flick = calm ? 1 : 1 + 0.05 * Math.sin(clock * 7.3) + 0.03 * Math.sin(clock * 13.1 + 1.3);
    lights.key.intensity = 2.4 + 1.0 * lit;
    room.lamp.intensity = 3000 * sc * sc * flick;
    lights.rim.intensity = 0.55; lights.fill.intensity = 0.3 + 0.2 * lit;
    if (motes.visible && !calm) {
      const p = motes.geometry.attributes.position, b = motes.userData.base;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, b[i * 3] + Math.sin(clock * 0.13 + i) * 6, b[i * 3 + 1] + ((clock * 2.2 + i * 7) % 60) - 30, b[i * 3 + 2] + Math.cos(clock * 0.11 + i * 1.3) * 6);
      p.needsUpdate = true;
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; });

  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    project(x, y, z) { const q = toCss(camera, x, y, z); return { x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() }; },
  };
}
