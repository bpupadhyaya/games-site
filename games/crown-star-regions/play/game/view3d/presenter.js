// Crown Fields 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the enamel field board in a gilt frame on an ebony plinth, lying on a royal velvet table under a warm
// lamp; real gold crowns drop onto the tiles; a velvet cushion holds the crowns still to place and a gilt plaque carries one
// enamel stone per region. The camera is fitted to the layout's board rectangle (play) or hero rectangle (title), so the 2D HUD
// stays where it was and taps reach the tilted board through v3.pick. No WebGL, ?flat=1 or a lost context: v3.on = false and
// every screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3, covers } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { PALETTES } from '../src/palettes.js';
import { HERO } from '../src/view.js';
import {
  S, FR, FRAME_TOP, makeMaterials, clothTextures, patternTexture, crownGeometries, tileGeometry, inlayGeometry,
  buildBoardBase, buildCushion, buildPlaque, cabochonGeometry, regionRGB,
} from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const TOP = 2.04;                                            // tile top (bed 1.62 + tile 0.42)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const MAXC = 48;                                             // crowns drawn at once (board + cushion)
function bounceOut(f) {
  const n = 7.5625, d = 2.75;
  if (f < 1 / d) return n * f * f;
  if (f < 2 / d) return n * (f -= 1.5 / d) * f + 0.75;
  if (f < 2.5 / d) return n * (f -= 2.25 / d) * f + 0.9375;
  return n * (f -= 2.625 / d) * f + 0.984375;
}
function radialTex(rgb, a = 1, inner = 0) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  if (inner) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.15, `rgba(${rgb},${a})`); } else g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  await tick();
  // ---------------------------------------------------------------- scene, lamp, environment
  const scene = new THREE.Scene();
  const bgCol = new THREE.Color(0x0d0724);
  scene.background = bgCol; scene.fog = new THREE.Fog(0x0d0724, 120, 320);
  const camera = new THREE.PerspectiveCamera(28, 1, 4, 900);
  const lamp = new THREE.SpotLight(0xffe0b0, 3.9, 0, 0.4, 0.75, 0);
  lamp.position.set(-30, 92, 48); lamp.target.position.set(0, 0, -2);
  lamp.shadow.bias = -0.0003; lamp.shadow.normalBias = 0.03; lamp.shadow.radius = 5;
  Object.assign(lamp.shadow.camera, { near: 50, far: 220 });
  const hemi = new THREE.HemisphereLight(0xd8c8ff, 0x1a0d2a, 0.32);
  const rim = new THREE.DirectionalLight(0xa58cff, 1.1); rim.position.set(40, 38, -80);
  const fill = new THREE.DirectionalLight(0xffc48a, 0.35); fill.position.set(60, 26, 50);
  const sweep = new THREE.PointLight(0xfff2d0, 0, 26, 1.4);   // the band of light that crosses the plate now and then
  scene.add(lamp, lamp.target, hemi, rim, fill, sweep);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.42; } catch { /* no IBL */ } };
  buildEnv();

  await tick();
  // ---------------------------------------------------------------- materials, table, board base
  const mats = makeMaterials();
  const table = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ roughness: 0.95, bumpScale: 0.9 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  let clothKey = '';
  function setCloth(palette) {
    const bg = palette.bg, k = bg ? bg.join() : 'royal'; if (k === clothKey) return; clothKey = k;
    const c0 = bg ? new THREE.Color(bg[1]).multiplyScalar(0.75).getStyle() : '#4a2aa0', c1 = bg ? new THREE.Color(bg[2]).multiplyScalar(0.7).getStyle() : '#24125e';
    const t = clothTextures(c0, c1);
    if (table.material.map) { table.material.map.dispose(); table.material.bumpMap.dispose(); }
    table.material.map = t.map; table.material.bumpMap = t.bump; table.material.needsUpdate = true;
    const dark = bg ? new THREE.Color(bg[2]).multiplyScalar(0.35) : new THREE.Color(0x0d0724);
    bgCol.copy(dark); scene.fog.color.copy(dark);
  }
  const base = buildBoardBase(mats); scene.add(base);

  await tick();
  // ---------------------------------------------------------------- tiles (one instanced mesh per pattern), inlays, marks
  const tileGeos = new Map();
  const tileGeo = (n) => { if (!tileGeos.has(n)) { const g = tileGeometry(); const cs = S / n; g.scale(cs - 0.2, 1, cs - 0.2); tileGeos.set(n, g); } return tileGeos.get(n); };
  const tileMeshes = [];                                        // [kind] -> InstancedMesh
  for (let k = 0; k < 10; k++) {
    const m = new THREE.InstancedMesh(tileGeo(7), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1 }), 100);
    m.castShadow = false; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color()); scene.add(m); tileMeshes.push(m);
  }
  const inlay = new THREE.Mesh(new THREE.BufferGeometry(), mats.inlay); inlay.castShadow = true; inlay.receiveShadow = true; scene.add(inlay);
  // ruled-out marks: two cream bars per cell, laid on the enamel
  const xMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 0.16), mats.cream, 200); xMesh.count = 0; xMesh.frustumCulled = false; xMesh.receiveShadow = true; scene.add(xMesh);
  // crowns: five instanced parts
  const cg = crownGeometries();
  const crownParts = [[cg.gold, mats.gold], [cg.pearl, mats.pearl], [cg.ruby, mats.ruby], [cg.sapphire, mats.sapphire], [cg.velvet, mats.velvet]].map(([g, m]) => {
    const im = new THREE.InstancedMesh(g, m, MAXC); im.castShadow = true; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; scene.add(im); return im;
  });
  crownParts[0].setColorAt(0, new THREE.Color(0xffffff));
  // glows lying on the tiles: crown glow (warm) / conflict (red); rings: landing ring, Auto Play reveal (cyan); soft contact shadows
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const glows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('255,255,255', 0.95), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), MAXC);
  glows.count = 0; glows.frustumCulled = false; glows.renderOrder = 2; glows.setColorAt(0, new THREE.Color()); scene.add(glows);
  const rings = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('255,255,255', 0.95, 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 24);
  rings.count = 0; rings.frustumCulled = false; rings.renderOrder = 3; rings.setColorAt(0, new THREE.Color()); scene.add(rings);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), MAXC);
  blobs.count = 0; blobs.frustumCulled = false; blobs.renderOrder = 1; scene.add(blobs);

  // cushion + plaque (tall portrait play, and the title)
  const cushion = buildCushion(mats); scene.add(cushion);
  const plaque = buildPlaque(mats); scene.add(plaque);
  const cabs = new THREE.InstancedMesh(cabochonGeometry(), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }), 10);
  cabs.castShadow = true; cabs.count = 0; cabs.setColorAt(0, new THREE.Color()); plaque.add(cabs);
  const CUSHION_Z = -(S / 2 + FR + 1.2 + 4.2), PLAQUE_Z = S / 2 + FR + 1.2 + 7.5;
  cushion.position.set(0, 0, CUSHION_Z); plaque.position.set(0, 0, PLAQUE_Z); plaque.scale.setScalar(1.15);

  let sizeKey = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.32 : 0.55;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    sizeKey = '';
  }
  applyTier();

  await tick();
  // ---------------------------------------------------------------- the puzzle on the board (rebuilt when regions/palette change)
  let boardSig = '';
  const baseCols = [], tileOf = [];                           // per cell: base colour, [mesh kind, instance]
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const _c2 = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
  const cellXZ = (n, i) => { const cs = S / n; return { x: -S / 2 + (i % n) * cs + cs / 2, z: -S / 2 + Math.floor(i / n) * cs + cs / 2, cs }; };
  function setBoard(regions, n, palIdx) {
    const sig = `${n}|${palIdx}|${regions.join(',')}`; if (sig === boardSig) return; boardSig = sig;
    const pal = PALETTES[palIdx] ?? PALETTES[0], strong = pal.name === 'Colour-blind safe';
    const counts = new Array(10).fill(0);
    tileMeshes.forEach((m, k) => {
      if (m.geometry !== tileGeo(n)) m.geometry = tileGeo(n);
      const t = patternTexture(k, strong); if (m.material.map !== t) { m.material.map = t; m.material.needsUpdate = true; }
    });
    for (let i = 0; i < n * n; i++) {
      const id = regions[i] ?? 0, k = id % 10, j = counts[k]++, c = cellXZ(n, i);
      _p.set(c.x, 1.62, c.z); _q.identity(); _s.set(1, 1, 1); _m.compose(_p, _q, _s);
      tileMeshes[k].setMatrixAt(j, _m);
      baseCols[i] = regionRGB(pal, id, n, 50, baseCols[i] || new THREE.Color());
      tileOf[i] = [k, j];
    }
    tileMeshes.forEach((m, k) => { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; });
    inlay.geometry.dispose(); inlay.geometry = inlayGeometry(regions, n);
    // plaque stones: one per region, in region order
    const gap = Math.min(2.7, 27 / n), sc = Math.min(1.5, gap * 0.5);
    cabs.count = n;
    for (let r = 0; r < n; r++) { _p.set((r - (n - 1) / 2) * gap, 0.62, 0.1); _q.identity(); _s.set(sc, sc * 0.8, sc); _m.compose(_p, _q, _s); cabs.setMatrixAt(r, _m); }
    cabs.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- camera fitting (tilt/yaw/fov per screen; distance + off-axis shift fitted to a rectangle)
  const cur = { yaw: 0, tilt: 58, fov: 28, dist: 90, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snapNext = true;
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
  function fit(rc, pts, b) {
    const p = { ...b, ox: 0, oy: 0, dist: 100 }, q = { x: 0, y: 0 };
    let bb = null;
    for (let it = 0; it < 6; it++) {
      place(fitCam, p);
      bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  const O = S / 2 + FR;                                        // frame half-size
  const boardPts = [[-O, FRAME_TOP, -O], [O, FRAME_TOP, -O], [-O, FRAME_TOP, O], [O, FRAME_TOP, O]];

  // ---------------------------------------------------------------- v3 hooks for the 2D layer
  let camMode = '';
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.pt = (n, i, lift = 0) => {
    const c = cellXZ(n, i), y = TOP + lift * c.cs;
    const p = virt(toCss(camera, c.x, y, c.z, { x: 0, y: 0 }));
    toCss(camera, c.x - c.cs / 2, y, c.z, pa); toCss(camera, c.x + c.cs / 2, y, c.z, pb);
    p.s = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu();
    return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (vx, vy, n) => {
    if (!camMode.startsWith('play')) return -1;
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const cs = S / n, col = Math.floor((hit.x + S / 2) / cs), row = Math.floor((hit.z + S / 2) / cs);
    if (row < 0 || row >= n || col < 0 || col >= n) return -1;
    return row * n + col;
  };

  // ---------------------------------------------------------------- per-frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, viewKey = '';
  const slots = new Array(10).fill(0);                         // cushion slot fill 0..1 (eased)
  const iconMode = qs.has('icon');                             // offline store icon: a low close look at one crown on the enamel
  if (iconMode) kitCanvas.style.visibility = 'hidden';
  function framing(state, L) {
    if (iconMode) {
      const c = cellXZ(5, 7), cs = S / 5;
      const pts = [[c.x - cs * 0.85, TOP, c.z], [c.x + cs * 0.85, TOP, c.z], [c.x, TOP, c.z + cs * 0.75], [c.x, TOP + cs * 0.75, c.z - cs * 0.2]];
      return fit({ x: 0, y: 0, w: cssW(), h: cssH() }, pts, { yaw: -16, tilt: 30, fov: 30, tx: c.x, ty: TOP + cs * 0.2, tz: c.z });
    }
    if (state.scene !== 'title') {
      const b = L.play.board, r = { x: b.x - b.F, y: b.y - b.F, w: b.px + 2 * b.F, h: b.px + 2 * b.F };
      return fit(rectCss(r), boardPts, { yaw: 0, tilt: L.mode === 'wide' ? 64 : 58, fov: 24, tx: 0, ty: TOP, tz: 0 });
    }
    const h = L.title.hero, t = state.t, drift = calm ? 0 : 1;
    const r = h ? { x: h.x - h.px * 0.06, y: h.y - h.px * 0.1, w: h.px * 1.12, h: h.px * 1.16 } : { x: L.U.x0 + 40, y: L.U.y0 + L.U.h * 0.3, w: L.U.w - 80, h: L.U.h * 0.3 };
    const pts = [...boardPts, [-O, 0, O + 1.2], [O, 0, O + 1.2], [-14, 4, CUSHION_Z - 3.1], [14, 4, CUSHION_Z - 3.1]];
    return fit(rectCss(r), pts, { yaw: -9 + 6 * Math.sin(t * TAU / 24) * drift, tilt: 50 + 3 * Math.sin(t * TAU / 17) * drift, fov: 28, tx: 0, ty: TOP * 0.5, tz: -2 });
  }

  // Title hero: the same 5x5 story as the flat art (crowns drop one by one, the ruled-out tiles follow, then everything lifts away).
  function heroMarks(t) {
    const { regions, crowns } = HERO, phase = (t + 4.2) % 8.4, out = clamp01((phase - 7.6) / 0.6);
    const ages = crowns.map((c, k) => phase - (0.5 + k * 0.7)), xf = new Array(25).fill(0);
    for (let i = 0; i < 25; i++) {
      if (crowns.includes(i)) continue;
      let f = 0;
      crowns.forEach((c, k) => {
        const dr = Math.abs(Math.floor(i / 5) - Math.floor(c / 5)), dc = Math.abs((i % 5) - (c % 5));
        if (dr === 0 || dc === 0 || regions[i] === regions[c] || (dr <= 1 && dc <= 1)) f = Math.max(f, clamp01((ages[k] - 0.2 - Math.max(dr, dc) * 0.05) / 0.25));
      });
      xf[i] = f * (1 - out);
    }
    return { ages, xf, out };
  }

  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    if (!covers(state.scene)) return;
    const L = layoutFor(meta.width, meta.height);
    const mode = state.scene === 'title' ? 'title' : `play${state.size}`;
    const vk = `${cssW()}x${cssH()}|${L.key}`;
    if (vk !== viewKey || mode !== camMode) { viewKey = vk; camMode = mode; snapNext = true; }
    const goal = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const a = snapNext ? 1 : 1 - Math.exp(-dt * 8);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
    v3.tray = mode !== 'title' && L.mode === 'tall';
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState();
    if (!covers(state.scene)) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const pal = PALETTES[state.palette] ?? PALETTES[0];
    setCloth(pal);
    const title = state.scene === 'title', t = state.t;
    const n = title ? 5 : state.size;
    setBoard(title ? HERO.regions : state.regions, n, state.palette);
    const cs = S / n;
    // which cells hold crowns / Xs, and how old each mark is
    let crownCells, crownAge, xFade, out = 0, conflicts = new Set(), solved = false, wave = 0, target = -1, ptrCell = -1;
    if (title) {
      const h = heroMarks(t); out = h.out;
      crownCells = HERO.crowns.filter((c, k) => h.ages[k] > 0 && (!iconMode || c === 7)); crownAge = (i) => h.ages[HERO.crowns.indexOf(i)];
      xFade = (i) => (iconMode ? 0 : h.xf[i]);
    } else {
      crownCells = []; for (let i = 0; i < state.cells.length; i++) if (state.cells[i] === 'crown') crownCells.push(i);
      crownAge = (i) => t - (state.cellT[i] ?? -9);
      solved = state.scene === 'solved' || (state.scene === 'auto' && state.auto && state.auto.sub === 'over');
      xFade = (i) => (state.cells[i] !== 'x' ? 0 : solved ? 0.75 : clamp01((t - (state.cellT[i] ?? -9)) / 0.22));
      conflicts = new Set(state.conflicts);
      wave = solved ? clamp01(2.2 - state.sceneT * 0.5) : 0;
      if (state.scene === 'auto' && state.auto && state.auto.sub === 'reveal') target = state.auto.target;
      if (state.scene === 'playing' && state.ptr.down) ptrCell = v3.pick(state.ptr.x, state.ptr.y, n);
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    // tiles: base colour, dimmed under an X, lit under the finger, red under a clash, cyan for Auto Play's next crown
    for (let i = 0; i < n * n; i++) {
      const [k, j] = tileOf[i]; _c.copy(baseCols[i]);
      const xf = xFade(i); if (xf > 0) _c.multiplyScalar(1 - 0.42 * xf);
      if (i === ptrCell) _c.multiplyScalar(1.3);
      if (conflicts.has(i)) _c.lerp(_c2.setRGB(1, 0.25, 0.32), 0.35 + 0.25 * pulse);
      if (i === target) _c.lerp(_c2.setRGB(0.45, 0.9, 1), 0.3 + 0.3 * pulse);
      tileMeshes[k].setColorAt(j, _c);
    }
    tileMeshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    // X marks
    let nx = 0;
    for (let i = 0; i < n * n; i++) {
      const f = xFade(i); if (f <= 0.01) continue;
      const c = cellXZ(n, i), len = cs * 0.34 * (0.6 + 0.4 * f);
      for (const a of [Math.PI / 4, -Math.PI / 4]) { _p.set(c.x, TOP + 0.04, c.z); _q.setFromAxisAngle(_up, a); _s.set(len, 1, Math.max(0.6, cs / 4.3)); _m.compose(_p, _q, _s); xMesh.setMatrixAt(nx++, _m); }
    }
    xMesh.count = nx; xMesh.instanceMatrix.needsUpdate = true; mats.cream.opacity = title ? 0.85 * (1 - out) : 0.9;
    // crowns on the board
    let nc = 0, ng = 0, nb = 0, nr = 0;
    const k = cs * 0.36;
    for (const i of crownCells) {
      const age = crownAge(i), c = cellXZ(n, i);
      const f = clamp01(age / 0.5), b = bounceOut(f), lift = (1 - b) * cs * 1.8;
      const land = age > 0.17 && age < 0.36 ? Math.sin(((age - 0.17) / 0.19) * Math.PI) * 0.14 : 0;
      const bad = conflicts.has(i);
      const shake = bad && age < 0.45 ? Math.sin(age * 60) * 0.06 * cs * (1 - age / 0.45) : 0;
      const col = i % n, row = Math.floor(i / n);
      const hop = wave > 0 ? Math.max(0, Math.sin(state.sceneT * 5 - (col + row) * 0.55)) * cs * 0.32 * wave : 0;
      const up = lift + hop + out * cs * 1.2;
      const wob = age < 0.9 ? Math.sin(age * 22) * 0.12 * (1 - age / 0.9) : 0;
      _p.set(c.x + shake, TOP + up, c.z); _e.set(wob, 0.35 + (i % 3) * 0.25, wob * 0.6); _q.setFromEuler(_e); _s.set(k * (1 + land), k * (1 - land), k * (1 + land)); _m.compose(_p, _q, _s);
      for (const im of crownParts) im.setMatrixAt(nc, _m);
      crownParts[0].setColorAt(nc, bad ? _c.setRGB(1, 0.35 + 0.2 * pulse, 0.4) : _c.setRGB(1, 1, 1));
      nc++;
      // contact shadow and warm glow on the tile
      const shrink = 1 / (1 + up / cs);
      _p.set(c.x + 0.12 * cs, TOP + 0.03, c.z - 0.06 * cs); _q.identity(); _s.set(cs * 0.95 * shrink, 1, cs * 0.95 * shrink); _m.compose(_p, _q, _s); blobs.setMatrixAt(nb++, _m);
      _p.set(c.x, TOP + 0.05, c.z); _s.set(cs * 1.25, 1, cs * 1.25); _m.compose(_p, _q, _s); glows.setMatrixAt(ng, _m);
      const ga = Math.min(1, f * 3) * (title ? 1 - out : 1);
      glows.setColorAt(ng++, bad ? _c.setRGB(0.9 * ga, 0.15 * ga, 0.25 * ga) : _c.setRGB(0.45 * ga, 0.34 * ga, 0.12 * ga));
      // landing ring
      if (age > 0.15 && age < 0.6 && nr < 24) {
        const u = (age - 0.15) / 0.45, s = cs * (0.6 + u * 0.9);
        _p.set(c.x, TOP + 0.06, c.z); _s.set(s, 1, s); _m.compose(_p, _q, _s); rings.setMatrixAt(nr, _m); rings.setColorAt(nr++, _c.setRGB(1 - u, 0.86 * (1 - u), 0.5 * (1 - u)));
      }
    }
    // Auto Play: a cyan ring on the cell about to be crowned
    if (target >= 0 && nr < 24) { const c = cellXZ(n, target), s = cs * (1.05 + 0.08 * pulse); _p.set(c.x, TOP + 0.06, c.z); _q.identity(); _s.set(s, 1, s); _m.compose(_p, _q, _s); rings.setMatrixAt(nr, _m); rings.setColorAt(nr++, _c.setRGB(0.3, 0.8 + 0.2 * pulse, 1)); }
    // cushion: the crowns still to be placed (eased in and out of their slots)
    const showCushion = (title && !iconMode) || v3.tray;
    cushion.visible = showCushion; plaque.visible = !title && v3.tray;
    if (showCushion) {
      const remain = title ? HERO.crowns.length - crownCells.length : Math.max(0, n - crownCells.length);
      const total = title ? 5 : n, gap = Math.min(4.6, 24 / total), kk = Math.min(1.45, gap * 0.4);
      for (let s = 0; s < total; s++) {
        const goalF = s < remain ? 1 : 0; slots[s] += (goalF - slots[s]) * (1 - Math.exp(-dt * 10));
        if (slots[s] < 0.02) continue;
        const e = slots[s], x = (s - (total - 1) / 2) * gap;
        _p.set(x, 2.25 + (1 - e) * 2.5, CUSHION_Z - 0.2); _e.set(-0.1, 0.4 + s * 0.6, 0); _q.setFromEuler(_e); _s.setScalar(kk * e); _m.compose(_p, _q, _s);
        for (const im of crownParts) im.setMatrixAt(nc, _m);
        crownParts[0].setColorAt(nc++, _c.setRGB(1, 1, 1));
      }
    }
    if (plaque.visible) {
      const crowned = new Set(crownCells.map((i) => state.regions[i]));
      for (let r = 0; r < n; r++) {
        regionRGB(pal, r, n, crowned.has(r) ? 58 : 34, _c);
        if (crowned.has(r)) _c.multiplyScalar(1.4); else _c.multiplyScalar(0.7);
        cabs.setColorAt(r, _c);
      }
      if (cabs.instanceColor) cabs.instanceColor.needsUpdate = true;
    }
    for (const im of crownParts) { im.count = nc; im.instanceMatrix.needsUpdate = true; }
    if (crownParts[0].instanceColor) crownParts[0].instanceColor.needsUpdate = true;
    glows.count = ng; glows.instanceMatrix.needsUpdate = true; if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    rings.count = nr; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    // a band of light crossing the plate now and then (brighter on a solved board)
    const sw = ((t * 0.16) % 1) * 3 - 1;
    if (sw < 1.6 && !calm) { const u = clamp01(sw / 1.6); sweep.position.set(-S * 0.7 + u * S * 1.4, TOP + 7, -S * 0.5 + u * S * 0.9); sweep.intensity = (solved ? 220 : 90) * Math.sin(u * Math.PI); } else sweep.intensity = 0;

    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    const sk = `${cssW()}x${cssH()}|${tier}`;
    if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(cssW(), cssH(), false); }
    // fog follows the camera distance so the table fades into the dark at the edges
    scene.fog.near = cur.dist * 0.95; scene.fog.far = cur.dist * 2.3;
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clothKey = ''; boardSig = ''; applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; snapNext = true;
  });

  let loseExt = null;                                          // dev/test hooks: the same extension object must restore the context
  // warm up: upload the default look and compile shaders in slices before taking over
  await tick();
  setCloth(PALETTES[0]); setBoard(HERO.regions, 5, 0); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true,
    renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; snapNext = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return loseExt; },
    restoreContext() { loseExt?.restoreContext(); return loseExt; },
  };
}
