// Kora 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D canvas:
// a lit kora (varnished calabash, nailed cowhide face, carved bridge, rosewood neck with leather rings, 21 nylon strings) in an evening
// courtyard (laterite floor, woven mat, painted wall and sky, string lamps, fireflies).
// Play / free play: the camera looks down the strings from the player's side and every string is placed so that it lies EXACTLY on the 2D lane
// line the game draws its beads, rings and taps on (each string is unprojected from the layout's bridge and far-end points onto the string
// plane), so input and timing code are untouched. Menus and text screens: the instrument stands upright, the camera drifts slowly.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, stringMap } from '../src/layout.js';
import { heroVib } from '../src/view.js';
import { STRING_COUNT } from '../src/music.js';
import { kora, heroSpec, courtyard, clearWorldCache } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
export const PLAY_R = 26, PLAY_H = 9, PITCH = 62, PLAY_FOV = 38;   // cm, cm, degrees below horizontal, vertical fov

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search), noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene, lights, environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c0b16);
  scene.fog = new THREE.Fog(0x1c0b16, 170, 720);
  const camera = new THREE.PerspectiveCamera(PLAY_FOV, 1, 4, 3000);
  const key = new THREE.SpotLight(0xffc98e, 11000, 0, 0.42, 0.75, 1.6);       // a lamp up and to the left: warm, soft shadows
  key.position.set(-120, 190, 110); key.target.position.set(0, 0, -10);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04; key.shadow.radius = 4; Object.assign(key.shadow.camera, { near: 40, far: 700 });
  const rim = new THREE.DirectionalLight(0x8fa8ff, 0.9); rim.position.set(160, 120, -260);          // cool dusk sky behind
  const hemi = new THREE.HemisphereLight(0xffd7b0, 0x2a120c, 0.32);
  const glowL = new THREE.PointLight(0xffb060, 0, 120, 1.6);                  // the bridge warms when strings sound
  scene.add(key, key.target, rim, hemi, glowL);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---------------------------------------------------------------- world
  const yard = courtyard(); scene.add(yard.group);
  await tick();
  const K = kora(); scene.add(K.group);
  const hero = heroSpec(PLAY_R);
  await tick();

  let vk = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    vk = '';
  }
  applyTier();

  // ---------------------------------------------------------------- css <-> virtual units (same mapping as the kit's fluid view)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const toCss = (x, y) => ({ x: x * cpu() + offX(), y: y * cpu() + offY() });

  // ---------------------------------------------------------------- play camera + string placement from the 2D stage
  const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLAY_H), _hit = new THREE.Vector3();
  function placePlayCam(cam, G, pitch) {
    const W = cssW(), Hh = cssH(), bc = toCss(G.cx, G.bridgeY), awCss = G.aw * cpu();
    const Wworld = PLAY_R / 0.56, pxPerCm = awCss / Wworld, D = (Hh / 2) / (Math.tan(PLAY_FOV * D2R / 2) * pxPerCm);
    cam.fov = PLAY_FOV; cam.aspect = W / Hh;
    cam.position.set(0, PLAY_H + Math.sin(pitch * D2R) * D, Math.cos(pitch * D2R) * D); cam.up.set(0, 1, 0); cam.lookAt(0, PLAY_H, 0);
    cam.setViewOffset(W, Hh, W / 2 - bc.x, Hh / 2 - bc.y, W, Hh); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  function unproject(cam, x, y) {
    _ndc.set(x / cssW() * 2 - 1, -(y / cssH() * 2 - 1)); _ray.setFromCamera(_ndc, cam);
    return _ray.ray.intersectPlane(_plane, _hit) ? _hit.clone() : null;
  }
  const specCache = new Map();
  function playSpec(G, piece) {
    const k = `${cssW()}x${cssH()}|${Math.round(G.ax)},${Math.round(G.laneTop)},${Math.round(G.bridgeY)},${Math.round(G.aw)}|${piece ? piece.id : '*'}|${cpu().toFixed(4)}`;
    if (specCache.has(k)) return specCache.get(k);
    const map = stringMap(G, piece);
    let pitch = PITCH, s = null;
    for (let tries = 0; tries < 6 && !s; tries++, pitch += 5) {
      placePlayCam(camera, G, pitch);
      const bx = [], tops = [];
      for (let i = 0; i < STRING_COUNT; i++) {
        const b = toCss(map.x[i], G.bridgeY), t = toCss(map.xt[i], G.laneTop);
        const pb = unproject(camera, b.x, b.y), pt = unproject(camera, t.x, t.y);
        if (!pb || !pt || pt.z > -10) { bx.length = 0; break; }
        bx.push(pb.x); tops.push(pt);
      }
      if (bx.length !== STRING_COUNT) continue;
      // the 2D lines all meet at one point, so the 3D lines do too: far.k = how much they have closed in at the lanes' far end
      let num = 0, den = 0; for (let i = 0; i < STRING_COUNT; i++) { num += tops[i].x * bx[i]; den += bx[i] * bx[i]; }
      const kk = clamp(num / Math.max(1e-6, den), 0.05, 0.96), zt = tops.reduce((a, p) => a + p.z, 0) / STRING_COUNT;
      if (kk > 0.95) continue;                                                     // strings would not converge: look down more steeply
      const zc = zt / (1 - kk);
      s = { R: PLAY_R, H: PLAY_H, bx, far: { z: zt, k: kk }, neckZ: zc * 0.99, neckR: 2.4, thick: 0.17, pitch, ringZ: null };
    }
    if (!s) s = { ...hero, pitch: PITCH };
    if (specCache.size > 12) specCache.clear();
    specCache.set(k, s); return s;
  }

  // ---------------------------------------------------------------- hero camera (upright instrument), fitted to a rectangle
  const fitCam = new THREE.PerspectiveCamera();
  const _v = new THREE.Vector3();
  // the calabash and the lower neck are fitted; the top of the neck may rise behind the title lettering
  const heroBox = (top = 3.3) => { const R = PLAY_R; return [[-R * 1.08, 0, 0], [R * 1.08, 0, 0], [0, 0, R * 0.3], [0, R * top, 0], [-R, R * 2.1, 0], [R, R * 2.1, 0]]; };
  function placeOrbit(cam, p) {
    const W = cssW(), Hh = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / Hh; cam.up.set(0, 1, 0);
    cam.position.set(p.tx, p.ty, p.tz).addScaledVector(dir, p.dist); cam.lookAt(p.tx, p.ty, p.tz);
    if (p.ox || p.oy) cam.setViewOffset(W, Hh, p.ox, p.oy, W, Hh); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 400 }; let bb = null;
    for (let it = 0; it < 10; it++) {
      placeOrbit(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { _v.set(x, y, z).project(fitCam); const qx = (_v.x + 1) / 2 * cssW(), qy = (1 - _v.y) / 2 * cssH(); bb.x0 = Math.min(bb.x0, qx); bb.x1 = Math.max(bb.x1, qx); bb.y0 = Math.min(bb.y0, qy); bb.y1 = Math.max(bb.y1, qy); }
      const sx = rc.w / Math.max(1, bb.x1 - bb.x0), sy = rc.h / Math.max(1, bb.y1 - bb.y0), s = Math.min(sx, sy);
      if (Math.abs(s - 1) < 0.0005) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }

  // ---------------------------------------------------------------- per-screen content
  let game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, lastMode = '', curSpec = null;
  const cur = { yaw: 0, tilt: 8, fov: 30, dist: 300, ox: 0, oy: 0, tx: 0, ty: 70, tz: 0 };
  let snapNext = true;
  const amps = new Array(STRING_COUNT).fill(0), dims = new Array(STRING_COUNT).fill(1);
  function setMode(mode) {
    if (mode === lastMode) return; lastMode = mode; snapNext = true;
    if (mode === 'play') {
      K.group.rotation.set(0, 0, 0); K.group.position.set(0, 0, 0);
      yard.group.position.set(0, -PLAY_R * 0.88, 0); yard.lamps.visible = false; yard.back.visible = false; yard.aura.visible = false;
      scene.fog.near = 260; scene.fog.far = 900;
    } else {
      K.group.rotation.set(Math.PI / 2 - 0.14, 0, 0); K.group.position.set(0, PLAY_R * 1.0 + 1, -PLAY_R * 0.12);
      yard.group.position.set(0, 0, 0); yard.lamps.visible = true; yard.back.visible = true; yard.aura.visible = true;
      scene.fog.near = 170; scene.fog.far = 720;
      if (curSpec !== hero) { K.setSpec(hero); curSpec = hero; }
    }
  }
  const cssR = (r) => { const a = toCss(r.x, r.y), b = toCss(r.x + r.w, r.y + r.h); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }; };
  function framingHero(s, L) {
    const drift = s.prefs.calm ? 0 : 1, t = clock, R = PLAY_R;
    const base = { yaw: (-14 + 9 * Math.sin(t * TAU / 26)) * drift + (drift ? 0 : -10), tilt: 6 + 3 * Math.sin(t * TAU / 19) * drift, fov: 34, tx: 0, ty: R * 2.2, tz: 0 };
    const S = L.S;
    if (s.scene === 'title') {
      // the neck may rise behind the title lettering; the calabash sits just above the Play button
      const T = L.title, top = T.titleY + T.size * (L.mode === 'compact' ? -0.2 : 0.7);
      const rc = L.mode === 'wide' ? { x: S.x + 20, y: top, w: T.col.x - S.x - 40, h: S.y + S.h - 120 - top } : { x: S.x + 10, y: top, w: S.w - 20, h: T.play.y - 8 - top };
      return fit(cssR(rc), heroBox(), base);
    }
    // text and list screens: the instrument large, to one side, behind the panels
    const rc = L.mode === 'wide' ? { x: S.x + S.w * 0.52, y: S.y + 20, w: S.w * 0.46, h: S.h - 40 } : { x: S.x + S.w * 0.18, y: S.y + S.h * 0.1, w: S.w * 0.8, h: S.h * 0.86 };
    return fit(cssR(rc), heroBox(4.75), { ...base, yaw: base.yaw - 8 });
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const s = game.getState(), sc = s.scene;
    if (sc === 'calib') { canvas.style.visibility = 'hidden'; return; }
    if (canvas.style.visibility !== 'visible') canvas.style.visibility = 'visible';
    const frozen = (s.pl && s.pl.paused);
    if (!frozen) clock += dt;
    const L = layoutFor(meta.width, meta.height);
    const play = sc === 'play' || sc === 'free';
    setMode(play ? 'play' : 'hero');
    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (play) {
      const sess = sc === 'play' ? s.pl : s.free, G = sc === 'play' ? L.play.stage : L.free.stage, piece = sc === 'play' && s.pl ? s.pl.piece : null;
      if (!sess) return;
      const spec = playSpec(G, piece);
      if (spec !== curSpec) { K.setSpec(spec); curSpec = spec; }
      placePlayCam(camera, G, spec.pitch);
      const map = stringMap(G, piece);
      for (let i = 0; i < STRING_COUNT; i++) { amps[i] = sess.sv[i].amp; dims[i] = piece ? (map.lane[i] >= 0 ? 1 : 0.35) : 1; }
      K.setAmps(amps, sess.t ?? clock, dims);
      glowL.position.set(0, PLAY_H + 6, 6); glowL.intensity = 900 * (sess.glow || 0);
      key.target.position.set(0, 0, -30);
    } else {
      const v = heroVib(s.scene === 'title' ? s.t : clock * 0.6);
      K.setAmps(s.prefs.calm ? amps.fill(0) : v.map((a) => a * 0.8), clock, null);
      glowL.intensity = 0;
      const goal = framingHero(s, L), a = snapNext ? 1 : 1 - Math.exp(-dt * 3);
      for (const kk of Object.keys(goal)) cur[kk] += (goal[kk] - cur[kk]) * a;
      placeOrbit(camera, cur);
      key.target.position.set(0, PLAY_R * 1.5, 0);
    }
    snapNext = false;
    yard.update(clock);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snapNext = true; curSpec = null; lastMode = '';
  });

  // warm up: hero instrument, shaders
  setMode('hero'); await tick();
  placeOrbit(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, kora: K,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snapNext = true; },
    post,
    get tier() { return TIERS[tier].name; },
    loseContext() { renderer.forceContextLoss(); return true; },
    restoreContext() { renderer.forceContextRestore(); },
    dispose() { clearWorldCache(); renderer.dispose(); },
  };
}
