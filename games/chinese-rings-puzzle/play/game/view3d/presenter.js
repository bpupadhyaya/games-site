// Chinese Rings 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a lamp-lit scholar's desk, a carved lattice window glowing behind it, and the puzzle as real lit metal on a lacquer base.
// On the play page the camera is fitted every frame so each ring's column lands exactly on the column the 2D layout uses for taps
// (layout.js ringAt), so the input code is untouched; hint arrows, the keyboard cursor, chips, lamps and buttons stay on the 2D layer.
// The title shows the four-ring puzzle solving itself under a slowly drifting camera with dust in the lamp light.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, host } from '../src/layout.js';
import { canMove } from '../src/rules.js';
import { ringPose, heroBits, heroFrame } from '../src/view.js';
import { S, desk, props, buildPuzzle, disposePuzzle, clearMaterialCache, clearNumberTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, f) => a + (b - a) * f;
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const GLOW_MOVE = new THREE.Color(0xffe2a8), GLOW_HINT = new THREE.Color(0x5ae6aa);

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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene, lights, environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140806); scene.fog = new THREE.Fog(0x140806, 90, 260);
  const camera = new THREE.PerspectiveCamera(24, 1, 2, 600);
  const lamp = new THREE.SpotLight(0xffcf98, 1700, 0, 0.5, 0.75, 1.6);
  lamp.position.set(-38, 62, 48); lamp.target.position.set(0, 2, 0);
  lamp.shadow.bias = -0.0002; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4;
  Object.assign(lamp.shadow.camera, { near: 40, far: 180 });
  const hemi = new THREE.HemisphereLight(0xf2d6b8, 0x1e0c08, 0.3);
  const rim = new THREE.DirectionalLight(0xc8d4ff, 0.45); rim.position.set(18, 80, -26);
  const fill = new THREE.DirectionalLight(0xff9a6a, 0.3); fill.position.set(50, 20, 40);
  scene.add(lamp, lamp.target, hemi, rim, fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  const world = new THREE.Group(); scene.add(world);
  let room = desk(); world.add(room); await tick();
  let deco = props(); world.add(deco); await tick();
  let puz = null;
  function ensurePuzzle(n, finish) {
    if (puz && puz.n === n && puz.finish === finish) return puz;
    if (puz) { world.remove(puz.group); disposePuzzle(puz); }
    puz = buildPuzzle(n, finish); world.add(puz.group); return puz;
  }
  // dust motes drifting through the lamp light (title, documents; off with Calm motion)
  const DN = 110, dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) dseed[i] = Math.random() * 100;
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dtex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,230,190,1)'); g.addColorStop(1, 'rgba(255,230,190,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: dtex, size: 0.32, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a8 }));
  dust.frustumCulled = false; scene.add(dust);
  function updateDust(t) {
    for (let i = 0; i < DN; i++) { const sd = dseed[i], u = ((t * 0.02 + sd * 0.137) % 1); dpos[i * 3] = -22 + ((sd * 37.1) % 40) + Math.sin(t * 0.3 + sd) * 1.5; dpos[i * 3 + 1] = 1 + u * 22; dpos[i * 3 + 2] = -14 + ((sd * 53.7) % 26) + Math.cos(t * 0.23 + sd * 2) * 1.5; }
    dgeo.attributes.position.needsUpdate = true;
  }
  let vk = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    vk = '';
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/elevation per screen; distance + off-axis shift fitted to 2D points
  const cur = { yaw: -24, el: 12, fov: 24, dist: 60, ox: 0, oy: 0, ty: 3 };
  let snapNext = true;
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.el * D2R), Math.sin(p.el * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.el * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(0, p.ty, 0);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  // Fit so the projected x-span of `wp` equals that of the css points `cp`, then shift so their centres coincide.
  function fitTo(wp, cp, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 60 }, q = { x: 0, y: 0 };
    let tx0 = 1e9, tx1 = -1e9, tmy = 0; for (const c of cp) { tx0 = Math.min(tx0, c.x); tx1 = Math.max(tx1, c.x); tmy += c.y; }
    const tmx = (tx0 + tx1) / 2; tmy /= cp.length;
    let mx = 0, my = 0;
    for (let it = 0; it < 12; it++) {
      place(fitCam, p); let x0 = 1e9, x1 = -1e9; my = 0;
      for (const [x, y, z] of wp) { toCss(fitCam, x, y, z, q); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); my += q.y; }
      mx = (x0 + x1) / 2; my /= wp.length;
      const s = (tx1 - tx0) / Math.max(1, x1 - x0);
      if (Math.abs(s - 1) < 0.0003) break;
      p.dist /= s;
    }
    p.ox = mx - tmx; p.oy = my - tmy;
    return p;
  }
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const css = (x, y) => ({ x: x * cpu() + offX(), y: y * cpu() + offY() });
  // world + css anchor points: the first and last ring centres, on the bar and off it
  function anchors(P, sc, shrink = 1) {
    const G = P.G, wp = [], cp = [];
    for (const i of [0, P.n - 1]) for (const pos of [1, 0]) {
      wp.push([P.X(G.ringX(i)), lerp(P.yOff, P.yOn, pos), 0]);
      cp.push(css(sc.ox + G.ringX(i) * sc.k, sc.oy + (G.yOff + (G.barY - G.yOff) * pos) * sc.k));
    }
    if (shrink !== 1) { const mx = (cp[0].x + cp[2].x) / 2; for (const c of cp) c.x = mx + (c.x - mx) * shrink; }
    return { wp, cp };
  }

  // ---------------------------------------------------------------- what to show per screen
  let game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, lastScene = '';
  const swing = { a: 0, v: 0 }; let lastMoving = 0;
  const isPlay = (sc) => sc === 'play' || sc === 'lesson' || sc === 'over';
  function shown(s) {
    const sc = s.scene, n = s.pz.bits.length, drift = s.calm ? 0 : 1;
    if (isPlay(sc)) {
      const L = layoutFor(meta.width, meta.height, n), over = sc === 'over';
      return { n, bits: s.pz.bits, anims: s.anim, sc: L.sc, el: 12, yaw: -20, assist: s.assist && !over && !s.autoMode, hint: s.hint && !over ? s.hint : null, shake: s.shake, play: true };
    }
    const hb = heroBits(s.t, s.calm);
    if (sc === 'title' || sc === 'demo-limit') {
      const L = layoutFor(meta.width, meta.height, n), HF = heroFrame(L.title(!!s.saved).hero, Math.max(12, 11 / (host.px || 0.6)));
      if (HF.sc) return { n: 4, bits: hb.bits, anims: hb.anims, sc: HF.sc, shrink: 0.84, el: 19 + 2 * Math.sin(s.t * TAU / 23) * drift, yaw: -26 + 7 * Math.sin(s.t * TAU / 31) * drift };
    }
    // documents: the puzzle resting on the desk behind the reading panel
    const L = layoutFor(meta.width, meta.height, 4), G = L.G, w = L.w * (L.land ? 0.62 : 0.86), k = w / G.W;
    return { n: 4, bits: [1, 0, 1, 1], anims: null, sc: { ox: (L.w - w) / 2, oy: L.h * 0.42 - G.H * k / 2, k, G }, el: 22, yaw: -30 + 4 * Math.sin(s.t * TAU / 40) * drift };
  }

  function pre() {
    if (!game || lost) return;
    const s = game.getState(), now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const v = shown(s), P = ensurePuzzle(v.n, s.finish);
    if (s.scene !== lastScene) { const was = lastScene; lastScene = s.scene; if (!was || isPlay(was) !== isPlay(s.scene)) snapNext = true; }
    const { wp, cp } = anchors(P, v.sc, v.shrink || 1);
    const asp = cssW() / cssH(), fov = clamp(2 * Math.atan(Math.tan(12 * D2R) / asp) / D2R, 12, 40);   // about 24 degrees across on every screen shape
    const goal = fitTo(wp, cp, { yaw: v.yaw, el: v.el, fov, ty: (P.yOn + P.yOff) / 2 });
    const a = snapNext || v.play ? 1 : 1 - Math.exp(-dt * 5);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
    scene.fog.near = cur.dist + 25; scene.fog.far = cur.dist + 170;      // the desk fades into the dark beyond the lamp, wherever the camera sits
    pose(v, P, s, dt);
  }
  function pose(v, P, s, dt) {
    const G = P.G, rp = ringPose(v.bits, v.anims), pulse = s.calm ? 0.6 : 0.5 + 0.5 * Math.sin(s.t * 4.5), R = G.R * S;
    let moving = 0;
    for (let i = 0; i < P.n; i++) {
      const r = P.rings[i], pos = rp.pos[i], sq = rp.squash[i], a = v.anims && v.anims[i];
      const sh = v.shake && v.shake[i] ? Math.sin(v.shake[i] * 28) * 7 * v.shake[i] * S : 0;
      const y = lerp(P.yOff, P.yOn, pos);
      r.pivot.position.set(r.x + sh, y, 0);
      // a travelling ring turns edge-on to slip past the bar and leans a little in the direction it goes, then settles square
      const dir = a ? Math.sign(a.to - a.from) : 0;
      r.pivot.rotation.set(0, -sq * 0.34, sq * 0.1 * dir);
      if (a) moving += 1;
      r.stem.position.y = y - R * 0.98; r.stem.scale.y = Math.max(0.01, y - R * 0.98 - P.BH + 0.02);
      let g = 0, col = GLOW_MOVE;
      if (v.assist && canMove(v.bits, i)) g = 0.5 + 0.3 * pulse;
      if (v.hint && v.hint.ring === i) { g = 1; col = GLOW_HINT; }
      r.glow.material.opacity = g * 0.55; r.glow.material.color.copy(col); r.glow.visible = g > 0.01;
      r.mesh.material.emissive.copy(col).multiplyScalar(g * 0.12);
    }
    // the tassel: a damped pendulum, kicked whenever a ring starts to move
    if (moving > lastMoving) swing.v += 1.6 * (moving - lastMoving);
    lastMoving = moving;
    if (!s.calm) { swing.v += (-38 * swing.a - 2.2 * swing.v) * dt; swing.a += swing.v * dt; } else { swing.a = 0; swing.v = 0; }
    const d = s.calm ? 0 : 1;
    P.tassel.rotation.set(Math.cos(s.t * 1.1) * 0.03 * d, 0, swing.a * 0.25 + Math.sin(s.t * 1.4) * 0.05 * d);
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const s = game.getState();
    clock += dt;
    dust.visible = !s.calm && !isPlay(s.scene); if (dust.visible) updateDust(clock);
    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clearNumberTex(); clearMaterialCache();
    world.remove(room); world.remove(deco); room = desk(); deco = props(); world.add(room, deco);
    if (puz) { world.remove(puz.group); disposePuzzle(puz); puz = null; }
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snapNext = true;
  });

  ensurePuzzle(4, 'steel'); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, lamp,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snapNext = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
