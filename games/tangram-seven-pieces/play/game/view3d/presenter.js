// Tangram 3D presenter. READS the game state (game.peek()), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas: a lamp-lit walnut night table with an indigo velvet board (gilt frame, the silhouette inlaid in black lacquer), a walnut
// tray and the seven pieces in cloisonne enamel with gilt edges. The camera is orthographic and tilted 34 degrees, with its frustum
// scaled so that the board plane maps 1:1 onto the 2D layout; every piece is placed so its TOP face lands exactly where the 2D
// hit-testing expects it (z = screen y + height * tan(tilt)). Input code is untouched; ghosts, hints, the rotate handle, the
// selection outline, particles and every button stay on the 2D layer. The title shows the attract loop in 3D on a velvet mat
// beside a candle and a tea bowl. No WebGL, ?flat=1 or a lost context: v3.on = false and the flat art draws; a restored context
// rebuilds everything.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta, layout } from '../src/layout.js';
import { attractFrame } from '../src/view.js';
import { snapPreview, VIEW, pxPoly, levelGeo } from '../src/puzzle.js';
import { LEVELS } from '../src/levels.js';
import * as W from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const GLOW_FIT = new THREE.Color(0xffe2a0), GLOW_HINT = new THREE.Color(0xfff0b8);
const CARD_IDS = ['crane2', 'cat2', 'teapot2', 'runner2', 'duck', 'lantern'];

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
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene, camera, lights
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0604);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 9000);
  const D = 4000;
  camera.position.set(0, D * Math.cos(W.TILT), D * Math.sin(W.TILT));
  camera.up.set(0, Math.sin(W.TILT), -Math.cos(W.TILT));
  camera.lookAt(0, 0, 0);
  const lamp = new THREE.SpotLight(0xffd8a8, 3.0, 0, 0.6, 0.85, 0);
  lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.6; lamp.shadow.radius = 5;
  const hemi = new THREE.HemisphereLight(0xb8b4ff, 0x2a1408, 0.2);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.5);
  const flameLight = new THREE.PointLight(0xff9a48, 0, 0, 2);
  scene.add(lamp, lamp.target, hemi, rim, rim.target, flameLight);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.22; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  let glow = W.glowTex();
  W.materials(); await tick();

  // ---------------------------------------------------------------- persistent objects
  const world = new THREE.Group(); scene.add(world);
  let pieces = [];
  const buildPieces = () => { for (const p of pieces) world.remove(p.pivot); pieces = []; for (let k = 0; k < 7; k++) { const p = W.makePiece(k); world.add(p.pivot); pieces.push(p); } };
  buildPieces(); await tick();
  const snapMesh = new THREE.Mesh(new THREE.BufferGeometry(), W.materials().snap); snapMesh.renderOrder = 3; world.add(snapMesh);
  let snapKey = '';

  // dust motes in the lamp light (title only)
  const DN = 90, dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) dseed[i] = Math.random() * 100;
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: glow, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a8 }));
  dust.frustumCulled = false; scene.add(dust);

  // per-screen built parts (rebuilt when the layout or the level changes)
  let tableKey = '', table = null, inlayKey = '', inlayGrp = null, propsGrp = null, candle = null;
  const dropGroup = (g) => { if (!g) return; world.remove(g); W.disposeTree(g); g.traverse((c) => c.userData?.dispose?.()); };

  // ---------------------------------------------------------------- view mapping (virtual units <-> css)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  function viewRect() {
    const c = cpu(), ox = (cssW() - meta.width * c) / 2, oy = (cssH() - meta.height * c) / 2;
    return { x0: -ox / c, x1: (cssW() - ox) / c, y0: -oy / c, y1: (cssH() - oy) / c };
  }
  let lightKey = '';
  function fitCamera(R) {
    const cs = Math.cos(W.TILT);
    camera.left = R.x0; camera.right = R.x1; camera.top = -R.y0 * cs; camera.bottom = -R.y1 * cs;
    camera.updateProjectionMatrix();
    const k = `${R.x0.toFixed(1)}|${R.x1.toFixed(1)}|${R.y0.toFixed(1)}|${R.y1.toFixed(1)}`;
    if (k === lightKey) return; lightKey = k;
    const cx = (R.x0 + R.x1) / 2, cz = (R.y0 + R.y1) / 2, ext = Math.hypot(R.x1 - R.x0, R.y1 - R.y0) / 2;
    const dist = ext * 2.6;
    lamp.position.set(cx - dist * 0.5, dist, cz - dist * 0.55); lamp.target.position.set(cx, 0, cz + ext * 0.05);
    lamp.angle = Math.atan((ext * 1.15) / (dist * 1.25)); lamp.penumbra = 0.9;
    Object.assign(lamp.shadow.camera, { near: dist * 0.5, far: dist * 1.6 }); lamp.shadow.camera.updateProjectionMatrix();
    rim.position.set(cx + ext, ext, cz - ext * 2); rim.target.position.set(cx, 0, cz);
  }

  // ---------------------------------------------------------------- tiers
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

  // ---------------------------------------------------------------- builders
  function buildTable(R, mode, L) {
    const k = `${mode}|${L.key}|${R.x0.toFixed(0)}|${R.y0.toFixed(0)}|${R.x1.toFixed(0)}|${R.y1.toFixed(0)}`;
    if (k === tableKey) return;
    tableKey = k; dropGroup(table); dropGroup(propsGrp); propsGrp = null; candle = null; inlayKey = '';
    table = new THREE.Group();
    const pad = 400;
    table.add(W.desk(R.x0 - pad, R.y0 - pad, R.x1 - R.x0 + 2 * pad, R.y1 - R.y0 + 2 * pad + 200));
    if (mode === 'play') {
      table.add(W.board(L.board), W.tray(L.tray));
    } else {
      const Tt = L.title, c = (x, y) => [Tt.tx + x * Tt.k, Tt.ty + y * Tt.k];
      const [mx, mz] = c(360, 650); table.add(W.mat(mx, mz, 212 * Tt.k));
      // props, in title space (720 x 830), 1 cm = 22 title px: the same real scale as the pieces (a 12 cm square set)
      propsGrp = new THREE.Group();
      const cm = 22 * Tt.k, base = -W.BOARD_T;
      const at = (o, x, y) => { const [vx, vy] = c(x, y); o.position.set(vx, base, vy + base * W.TAN); propsGrp.add(o); return o; };
      candle = at(W.candle(cm, glow), 640, 470);
      const bowl = at(W.teaBowl(cm * 0.92), 70, 560); bowl.rotation.y = 0.4;
      const loopsOf = (ids) => ids.map((id) => levelGeo(LEVELS.find((l) => l.id === id) || LEVELS[0]).loops);
      const card = W.patternCard(230 * Tt.k, 160 * Tt.k, loopsOf(CARD_IDS.slice(0, 3)));
      at(card, 120, 860).rotation.y = 0.16; card.position.y = base + 0.6;
      const card2 = W.patternCard(230 * Tt.k, 160 * Tt.k, loopsOf(CARD_IDS.slice(3)));
      at(card2, 610, 880).rotation.y = -0.22; card2.position.y = base + 0.6;
      world.add(propsGrp);
    }
    world.add(table);
  }
  function buildInlay(key, loopsPx, guidesPx) {
    if (key === inlayKey) return;
    inlayKey = key; dropGroup(inlayGrp);
    inlayGrp = W.inlay(loopsPx, guidesPx); inlayGrp.position.z = 0.6 * W.TAN; world.add(inlayGrp);
  }

  // ---------------------------------------------------------------- per-frame pose
  // place a piece: centroid at virtual (x, y), rotation rot (45 degree steps, clockwise on screen), side f, s px per unit,
  // bottom at height y0, extra lift h, flip progress fl (1 = just flipped, shown mirrored), scale sc
  function placePiece(P, x, y, rot, f, s, y0, h, fl, sc) {
    const T = W.T_UNITS * s * sc, psi = Math.PI * fl, rise = Math.abs(Math.sin(psi)) * 0.75 * s;
    const cy = y0 + h + rise + T / 2, top = cy + T / 2;
    P.pivot.position.set(x, cy, y + top * W.TAN);
    P.pivot.rotation.set(0, -rot * Math.PI / 4, psi);
    P.pivot.scale.set(s * sc, s * sc, s * sc);
    P.meshes[0].visible = !f; P.meshes[1].visible = !!f;
    P.pivot.visible = true;
  }
  let game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function pre() {
    if (!game || lost) return;
    const S = game.peek(), L = layout(), R = viewRect();
    fitCamera(R);
    const play = (S.scene === 'play' || S.scene === 'auto') && S.puz;
    buildTable(R, play ? 'play' : 'title', L);
    const t = S.t, pulse = 0.5 + 0.5 * Math.sin(t * 5);
    if (play) {
      const puz = S.puz, g = puz.g, s = VIEW.s, auto = S.scene === 'auto' ? S.auto : null;
      buildInlay(`${puz.level.id}|${L.key}|${S.guides ? 1 : 0}`, g.loops.map((l) => l.map(g.toPx)), S.guides ? g.slots.map((q) => pxPoly(g, q)) : null);
      const rank = new Map(puz.order.map((i, r) => [i, r]));
      // the win: a warm wave of light runs across the finished figure, left to right (matches the 2D shimmer)
      const B = L.board, wave = puz.done ? ((puz.doneT * 0.8) % 2.2) / 1.2 : -1;
      for (const p of puz.pieces) {
        const P = pieces[p.kind], [x, y] = g.toPx([p.dx, p.dy]);
        let sc = 1 + 0.035 * p.lift; if (p.pop > 0) sc *= 1 + 0.07 * Math.sin(p.pop * Math.PI);
        placePiece(P, x, y, p.drot, p.f, s, 1 + rank.get(p.i) * 0.35, p.lift * 0.42 * s, p.flipT, sc);
        const hintPiece = puz.hint && puz.hint.piece === p.i, autoPiece = auto && auto.phase === 'reveal' && auto.target && auto.target.piece === p.i;
        let e = p.glow * 0.16, col = GLOW_FIT;
        if (hintPiece || autoPiece) { e = 0.16 + 0.22 * pulse; col = GLOW_HINT; }
        if (wave >= 0) { const d = Math.abs((x - B.x) / B.w - wave); e = Math.max(e, 0.32 * Math.exp(-d * d * 30)); col = GLOW_FIT; }
        P.mat.emissive.copy(col).multiplyScalar(e);
      }
      // snap preview: a soft glow on the board where the held piece will click in
      const prev = snapPreview(puz);
      const sk = prev ? prev.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(';') : '';
      if (sk !== snapKey) { snapKey = sk; snapMesh.geometry.dispose(); snapMesh.geometry = prev ? W.snapGeo(prev) : new THREE.BufferGeometry(); }
      snapMesh.visible = !!prev; snapMesh.position.set(0, 1.4, 1.4 * W.TAN); snapMesh.material.opacity = 0.22 + 0.14 * pulse;
    } else {
      snapMesh.visible = false;
      // title: the attract loop on the velvet mat; documents: the finished figure resting there
      const docs = S.scene !== 'title';
      const A = attractFrame(docs ? 5 : t), Tt = L.title, k = Tt.k, s = A.s * k;
      const c = (x, y) => [Tt.tx + x * k, Tt.ty + y * k];
      buildInlay(`title|${A.lv.id}|${L.key}`, A.g.loops.map((l) => l.map(([px, py]) => c(A.cx + (px - A.mid[0]) * A.s, A.cy + (py - A.mid[1]) * A.s))), null);
      for (const p of A.pieces) {
        const P = pieces[p.kind], [x, y] = c(p.x, p.y), q = clamp(p.pos, 0, 1);
        const y0 = -W.BOARD_T * (1 - q) + 1 + p.i * 0.3, hop = Math.sin(q * Math.PI) * 0.9 * s;
        placePiece(P, x, y, p.rot, p.f, s, y0, hop, 0, 1);
        P.mat.emissive.setRGB(0, 0, 0);
      }
    }
    // candle flicker
    if (candle) {
      const fl = 0.85 + 0.1 * Math.sin(t * 13.1) + 0.06 * Math.sin(t * 7.3 + 1) + 0.04 * Math.sin(t * 23.7);
      const u = candle.userData; u.flame.scale.y = u.flame.scale.x * (1.5 + 0.12 * Math.sin(t * 11)); u.flame.material.opacity = fl; u.halo.material.opacity = 0.28 * fl;
      flameLight.position.set(candle.position.x, candle.position.y + u.top, candle.position.z + u.top * W.TAN);
      flameLight.intensity = 9000 * fl * (L.title.k ** 2);
    } else flameLight.intensity = 0;
  }
  function updateDust(R, tt) {
    const w = R.x1 - R.x0, h = R.y1 - R.y0;
    for (let i = 0; i < DN; i++) {
      const sd = dseed[i], u = ((tt * 0.015 + sd * 0.137) % 1), y = 10 + u * 260;
      dpos[i * 3] = R.x0 + ((sd * 37.1) % 1) * w + Math.sin(tt * 0.3 + sd) * 12; dpos[i * 3 + 1] = y;
      dpos[i * 3 + 2] = R.y0 + ((sd * 53.7) % 1) * h + Math.cos(tt * 0.23 + sd * 2) * 12 + y * W.TAN;
    }
    dgeo.attributes.position.needsUpdate = true;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const S = game.peek();
    clock += dt;
    dust.visible = S.scene === 'title'; if (dust.visible) updateDust(viewRect(), clock);
    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    dropGroup(table); dropGroup(propsGrp); dropGroup(inlayGrp); table = propsGrp = inlayGrp = candle = null; tableKey = inlayKey = ''; snapKey = '';
    W.disposeAll(); glow.dispose(); glow = W.glowTex(); dust.material.map = glow;
    snapMesh.material = W.materials().snap; buildPieces();
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; lightKey = '';
  });

  return {
    ok: true, renderer, scene, camera, lamp,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
