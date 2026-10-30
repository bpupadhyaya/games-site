// Oud 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas: the oud lying on a woven rug in a lamp-lit majlis. On the playing screens the camera is SOLVED from the layout's instrument
// geometry: the camera looks across the neck (its view direction is perpendicular to the neck), so every point on the neck's centre
// line is at the same depth and projects linearly onto exactly the 2D neck (rings, fingers, marks and the unchanged hit test line up).
// Menus show the oud as a slowly drifting hero. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat
// 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { materials, buildOud, buildRoom, buildMotes, buildLights, oudShadow, buildRisha, stringV } from './world.js';

const D2R = Math.PI / 180, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
export const PLAY_TILT = 62;            // degrees above the floor the play camera looks down from (across the neck)
const PLAY_FOV = 28;
// The hero oud (title and menus), in centimetres: about 36 wide with a 48 cm body; its neck is drawn a little long, like the one
// on the playing screens.
export const HERO = { Lneck: 30, Lbody: 48, bodyW: 36, nutW: 5.4, peg: 14 };

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x07100f);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07100f);
  const camera = new THREE.PerspectiveCamera(PLAY_FOV, 1, 4, 40000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.18; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const M = materials();
  await tick();
  const room = buildRoom(M); scene.add(room.group);
  const motes = buildMotes(); room.group.add(motes);
  await tick();
  const hero = buildOud(HERO, M, 1); hero.group.visible = false;
  const heroRoot = new THREE.Group(); heroRoot.add(hero.group); scene.add(heroRoot);
  hero.group.position.set(-(HERO.Lneck + HERO.Lbody) / 2, hero.dep + 0.3, 0);
  heroRoot.updateMatrixWorld(true);
  const heroLocal = []; { const b = new THREE.Box3().setFromObject(hero.group); for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) heroLocal.push(new THREE.Vector3(x, y, z)); }
  hero.group.add(oudShadow(HERO, hero.dep + 0.3));
  heroRoot.rotation.y = 0.42; heroRoot.position.set(-6, 0, 18);
  await tick();
  // the risha (plectrum): plays the strokes on the playing screens; on the menus it rests on the rug beside the oud
  const risha = buildRisha(M, 1); scene.add(risha.pivot);
  const rishaRest = buildRisha(M, 1); rishaRest.pivot.position.set(-4, 0.55, 30); rishaRest.pivot.rotation.set(0, 0.9, 0); heroRoot.add(rishaRest.pivot);
  const RQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.55, 0.62, 0.56).normalize());
  const rs = { z: 0, h: 1.2, vz: 0, vh: 0, side: 1, lastAge: 9, from: 1 };
  // play ouds: one per layout geometry (portrait / landscape / free play), built on demand and kept
  const ouds = new Map();
  const playRoot = new THREE.Group(); scene.add(playRoot);
  function oudFor(G) {
    const key = `${Math.round(G.Lneck)}|${Math.round(G.Lbody)}|${Math.round(G.bodyW)}|${Math.round(G.nutW)}|${G.peg}`;
    let o = ouds.get(key);
    if (!o) {
      if (ouds.size > 5) { for (const v of ouds.values()) { playRoot.remove(v.group); v.group.traverse((m) => m.geometry && m.geometry.dispose()); } ouds.clear(); }
      o = buildOud(G, M, G.bodyW / 36); o.group.add(oudShadow(G, o.dep + 0.3 * o.k)); o.group.visible = false; playRoot.add(o.group); ouds.set(key, o);
    }
    return o;
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    motes.visible = tier < 2;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera helpers
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const toCssX = (x) => x * cpu() + offX(), toCssY = (y) => y * cpu() + offY();
  const focal = (fov) => (cssH() / 2) / Math.tan(fov * D2R / 2);
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  // p = { tx,ty,tz (target), dx,dy,dz (target -> eye), ux,uy,uz (up), dist, fov, ox, oy (view offset, css px) }
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
  // Exact solve for the play screens. World x = u (the neck), z = v, y up; the strings' reference height is o.yS.
  // Wide: the eye is in front (+z) and above, screen right = +x. Portrait: the eye is to the side, camera up = -x so the neck runs down.
  const sT = Math.sin(PLAY_TILT * D2R), cT = Math.cos(PLAY_TILT * D2R);
  function playCam(G, o) {
    const uT = G.Lneck * 0.5 + G.Lbody * 0.35, dist = focal(PLAY_FOV) / cpu();
    const p = G.toScreen(uT, 0), px = toCssX(p.x), py = toCssY(p.y);
    const base = { fov: PLAY_FOV, tx: uT, ty: o.yS, tz: 0, dist, ox: cssW() / 2 - px, oy: cssH() / 2 - py, dx: 0, dy: sT, dz: cT };
    return G.wide ? { ...base, ux: 0, uy: 1, uz: 0 } : { ...base, ux: -1, uy: 0, uz: 0 };
  }
  // the hero oud's own box corners (in the oud's frame, so a diagonal oud is not framed by a loose world box)
  function heroPts() { heroRoot.updateMatrixWorld(true); return heroLocal.map((v) => v.clone().applyMatrix4(heroRoot.matrixWorld)); }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, clock = 0, viewKey = '', snap = true, F = null;
  const cur = { fov: 30, tx: 0, ty: 0, tz: 0, dist: 300, ox: 0, oy: 0, dx: 0, dy: 1, dz: 1, ux: 0, uy: 1, uz: 0 };
  let heroPluck = -9;

  function framing(state, L) {
    const t = clock, calm = state.prefs?.calm, drift = calm ? 0 : 1;
    if (state.scene === 'play' && state.pl) { const G = L.play.inst, o = oudFor(G); return { kind: 'play', G, o, cam: playCam(G, o), sess: state.pl }; }
    if (state.scene === 'free' && state.free) { const G = L.free.inst, o = oudFor(G); return { kind: 'play', G, o, cam: playCam(G, o), sess: state.free }; }
    const yaw = (-28 + 9 * Math.sin(t * TAU / 40) * drift) * D2R, tilt = (40 + 4 * Math.sin(t * TAU / 27) * drift) * D2R;
    const base = { fov: 30, tx: 0, ty: 8, tz: 0, dx: Math.sin(yaw) * Math.cos(tilt), dy: Math.sin(tilt), dz: Math.cos(yaw) * Math.cos(tilt), ux: 0, uy: 1, uz: 0 };
    let rc;
    const S = L.S;
    if (state.scene === 'title') {                // a big key-art oud: it may run behind the subtitle (the title has a shade behind it)
      const T = L.title, wide = L.mode === 'wide';
      const x0 = S.x + 12, x1 = wide ? T.play.x - 28 : S.x + S.w - 12, y0 = T.titleY + T.size * (wide ? 1.5 : 1.3), y1 = wide ? S.y + S.h - 40 : T.play.y - 6;
      rc = { x: toCssX(x0), y: toCssY(y0), w: (x1 - x0) * cpu(), h: Math.max(40, y1 - y0) * cpu() };
    } else rc = { x: toCssX(S.x + S.w * 0.1), y: toCssY(S.y + S.h * 0.25), w: S.w * 0.8 * cpu(), h: S.h * 0.5 * cpu() };
    return { kind: 'hero', cam: fit(rc, heroPts(), base) };
  }

  // Risha strokes alternate down and up across the six courses over the plucking zone (between the big rose and the bridge):
  // a quick stroke (70 ms, the tip dips to the strings mid-way), a small lift as follow-through, then it waits on the far side for the
  // next pluck. A critically damped spring follows the target so a new pluck mid-move never jumps. Units: centimetres, scaled by o.k.
  function stepRisha(o, G, sess, dt, calm) {
    const k = o.k, pa = sess.fx && sess.fx.pluckAt;
    risha.pivot.visible = true;
    const up = G.Lneck + G.Lbody * 0.56, A = Math.abs(stringV(G, 5, up) - stringV(G, 0, up)) / k * 0.62;
    const age = pa ? pa.age : 9;
    if (age < rs.lastAge - 1e-6) { rs.from = rs.side; rs.side = -rs.side; }      // a new pluck: stroke to the other side
    rs.lastAge = age;
    const u = clamp(age / 0.07, 0, 1), e = u * u * (3 - 2 * u);
    let tz = rs.from * A * (1 - 2 * e), th = 1.3 - 1.15 * Math.sin(Math.PI * u);
    if (age >= 0.07 && age < 0.4) th += 0.7 * Math.sin(Math.PI * (age - 0.07) / 0.33);
    if (age >= 9) tz = rs.side * A;
    if (calm) th = Math.max(th, 1);
    for (let n = 0, h = dt / 3; n < 3; n++) {
      const W = 55; rs.vz += (W * W * (tz - rs.z) - 2 * W * rs.vz) * h; rs.vh += (W * W * (th - rs.h) - 2 * W * rs.vh) * h;
      rs.z += rs.vz * h; rs.h += rs.vh * h;
    }
    risha.pivot.scale.setScalar(k);
    risha.pivot.position.set(up, o.yS + rs.h * k, (rs.z * k) / sT);
    risha.pivot.quaternion.copy(RQ);
  }
  function setStrings(o, amp, t) { for (const s of o.strings) { s.uni.uAmp.value = amp; s.uni.uT.value = t; } }

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

  function post() {
    if (!game || lost || !F) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = !!state.prefs?.calm;
    canvas.style.visibility = 'visible';
    for (const o of ouds.values()) o.group.visible = false;
    hero.group.visible = false;
    let lit = 0.6, pulse = 0, sc = 1;
    if (F.kind === 'play') {
      const o = F.o, G = F.G, sess = F.sess; o.group.visible = true;
      sc = o.k;                                                  // world units per centimetre on this screen
      o.group.scale.set(1, 1, 1 / sT);                           // across the neck, undo the camera's foreshortening so v maps 1:1
      room.group.scale.setScalar(sc); room.group.position.set(G.Lneck + G.Lbody * 0.45, -(o.dep + 0.3 * sc), 0); room.group.rotation.y = 0;
      const vib = sess.fx && sess.fx.vib && !calm ? sess.fx.vib : null;
      setStrings(o, vib ? Math.exp(-vib.age * 4.5) * 3.2 : 0, clock);
      stepRisha(o, G, sess, dt, calm);
      lit = state.scene === 'free' ? 0.6 : sess.mode === 'auto' ? 0.7 : Math.min(1, 0.35 + (sess.ens || 0) / 3 * 0.65);
      pulse = sess.fx ? sess.fx.pulse || 0 : 0;
      // key light: a warm pool from above the player's side, aimed at the body
      const cx = G.Lneck * 0.55 + G.Lbody * 0.3;
      lights.key.position.set(cx - 60 * sc, 260 * sc, 120 * sc); lights.key.target.position.set(cx + 6 * sc, 0, 0);
      lights.key.angle = 0.34; lights.key.penumbra = 0.85;
      lights.key.shadow.camera.near = 120 * sc; lights.key.shadow.camera.far = 480 * sc;
      lights.rim.position.set(cx + 200 * sc, 80 * sc, -150 * sc); lights.rim.target.position.set(cx, 0, 0);
      lights.fill.position.set(cx - 200 * sc, 60 * sc, 160 * sc); lights.fill.target.position.set(cx, 0, 0);
    } else {
      risha.pivot.visible = false;
      hero.group.visible = true; sc = 1;
      room.group.scale.setScalar(1); room.group.position.set(0, 0, 0);
      // the hero oud is plucked now and then: the strings shimmer
      if (!calm && clock - heroPluck > 3.2) heroPluck = clock;
      const age = clock - heroPluck; setStrings(hero, calm ? 0 : Math.exp(-age * 3) * 0.25, clock);
      lit = 0.75;
      lights.key.position.set(-50, 190, 110); lights.key.target.position.set(0, 0, 10);
      lights.key.angle = 0.5; lights.key.penumbra = 0.8;
      lights.key.shadow.camera.near = 80; lights.key.shadow.camera.far = 420;
      lights.rim.position.set(160, 70, -170); lights.rim.target.position.set(0, 10, 0);
      lights.fill.position.set(-180, 50, 150); lights.fill.target.position.set(0, 0, 0);
    }
    lights.key.shadow.camera.updateProjectionMatrix();
    const flick = calm ? 1 : 1 + 0.06 * Math.sin(clock * 7.3) + 0.04 * Math.sin(clock * 13.1 + 1.3);
    lights.key.intensity = (2.2 + 1.2 * lit) * (1 + 0.08 * pulse);
    room.lampLight.intensity = 2600 * sc * sc * flick * (0.6 + 0.6 * lit + 0.3 * pulse);
    room.halo.material.opacity = 0.55 * flick;
    lights.rim.intensity = 0.55; lights.fill.intensity = 0.3 + 0.2 * lit;
    // dust motes drift slowly in the light
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
    // layout point of a world point (for checks): the neck centre line must land on the layout's neck
    project(x, y, z) { const q = toCss(camera, x, y, z); return { x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() }; },
    get risha() { return rs; },
    get playOud() { return F && F.o ? { yS: F.o.yS } : null; },
  };
}
