// Vallenato Accordion Trio 3D presenter. READS the simulation state (game.getState()) and the geometry the 2D layer reported in v3;
// never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas. The camera is pixel-aligned: the z = 0 plane
// maps 1:1 to the game's virtual units, so every 3D instrument, plaque and button sits exactly under its touch zone and the 2D text.
// A warm Colombian patio at dusk (plaster wall, string lights, lanterns, palms, fireflies) is the set behind everything.
// Loading: the 2D art draws immediately; this builds the scene in slices (await a frame between them), then crossfades.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor, cajaGeom, guaGeom } from '../src/layout.js';
import { mats, makeBellows, makePearlButton, makeKeyboard, makeCaja, makeGuacharaca, makeAccordion, makeLantern, makePalm, rngOf } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2 }, { name: 'medium', dpr: 1.5 }, { name: 'low', dpr: 1 }];
const tick = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function blobCanvas(rgb, a, size = 128) { const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, size, size); return c; }
function wallCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rngOf(7);
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#06222a'); g.addColorStop(0.5, '#0d4048'); g.addColorStop(1, '#17504f'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(180,255,240,0.035)'; x.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 4); }
  for (let i = 0; i < 9; i++) { const gx = r() * S, gy = r() * S, gr = S * (0.1 + r() * 0.2), gg = x.createRadialGradient(gx, gy, 0, gx, gy, gr); gg.addColorStop(0, 'rgba(0,0,0,0.12)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2); }
  // hand-painted diamond tiles, mango and coral, faint
  const s = 128; x.lineWidth = 3;
  for (let y = 0; y <= S; y += s) for (let xx = 0; xx <= S; xx += s) {
    const ox = ((y / s) % 2 ? s / 2 : 0);
    x.strokeStyle = 'rgba(255,214,150,0.10)'; x.beginPath(); x.moveTo(xx + ox, y - s / 2); x.lineTo(xx + ox + s / 2, y); x.lineTo(xx + ox, y + s / 2); x.lineTo(xx + ox - s / 2, y); x.closePath(); x.stroke();
    x.fillStyle = 'rgba(255,120,80,0.06)'; x.beginPath(); x.arc(xx + ox, y, 9, 0, TAU); x.fill();
  }
  return c;
}

export async function createPresenter({ kitCanvas, quality = 'high', onProgress }) {
  const noop = { wrap: (g) => g, ok: false };
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0;transition:opacity 0.45s ease';
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x04141a, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04141a);
  const camera = new THREE.PerspectiveCamera(30, 1, 200, 12000);
  const DIST = 3400;
  const M = mats();
  const envHandle = B.createEnvironment(renderer, scene, { intensity: 0.28 });
  await tick();

  // ---- lights ---------------------------------------------------------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x0a2a2e, 0.32);
  const key = new THREE.DirectionalLight(0xffe0b8, 1.9); key.position.set(-500, 900, 1300);
  const fill = new THREE.DirectionalLight(0x8fd8ff, 0.7); fill.position.set(700, -200, 800);
  const rim = new THREE.DirectionalLight(0x7fe3c2, 1.1); rim.position.set(0, 600, -700);
  scene.add(hemi, key, key.target, fill, rim);
  const warm = [0, 1].map((i) => { const l = new THREE.PointLight(i ? 0xff8a5c : 0xffc266, 900, 1400, 1.1); scene.add(l); return l; });

  // ---- the patio set (z < 0) ------------------------------------------------------------------------------------------------------
  const set = new THREE.Group(); scene.add(set);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex(wallCanvas()), roughness: 0.92, metalness: 0 }));
  wall.position.z = -420; set.add(wall);
  const glowTex = tex(blobCanvas('255,196,110', 1, 96));
  const bulbs = [];
  const cord = new THREE.Group(); set.add(cord);
  const bulbCols = ['#ffd166', '#ff8a5c', '#7fe3c2', '#ffe9b8'];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 14; i++) {
      const c = bulbCols[(i + row) % 4];
      const b = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), new THREE.MeshBasicMaterial({ color: c }));
      const gsp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      gsp.scale.setScalar(70);
      set.add(b, gsp); bulbs.push({ b, g: gsp, row, i });
    }
  }
  const wires = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.6 })); set.add(m); return m; });
  const lanterns = [makeLantern(120), makeLantern(100)];
  for (const l of lanterns) set.add(l);
  const palms = [makePalm(900, 4), makePalm(720, 9)];
  for (const p of palms) { p.position.z = -260; set.add(p); }
  const motes = (() => {
    const n = 60, pos = new Float32Array(n * 3), r = rngOf(77);
    for (let i = 0; i < n; i++) { pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, size: 22, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe9b0' }));
    p.frustumCulled = false; scene.add(p); return { p, seed: pos, n };
  })();
  await tick();

  // ---- the bench under the instruments (wood slab + brass edge) -------------------------------------------------------------------
  const benchKey = { w: 0, h: 0 };
  let bench = null;
  function placeBench(r) {
    if (!r) { if (bench) bench.visible = false; return; }
    if (!bench) { bench = new THREE.Group(); bench.userData.top = new THREE.Mesh(new THREE.BufferGeometry(), M.wood); bench.userData.edge = new THREE.Mesh(new THREE.BufferGeometry(), M.brass); bench.add(bench.userData.edge, bench.userData.top); scene.add(bench); }
    bench.visible = true;
    if (Math.abs(benchKey.w - r.w) > 0.5 || Math.abs(benchKey.h - r.h) > 0.5) {
      benchKey.w = r.w; benchKey.h = r.h;
      bench.userData.top.geometry.dispose(); bench.userData.edge.geometry.dispose();
      bench.userData.top.geometry = B.slab(r.w, r.h, 12, 26, 6, { seg: 3, per: 5 }); bench.userData.edge.geometry = B.slab(r.w + 8, r.h + 8, 9, 30, 3, { seg: 3, per: 5 });
    }
    bench.userData.top.rotation.x = bench.userData.edge.rotation.x = Math.PI / 2;
    bench.userData.top.position.set(r.x + r.w / 2, -(r.y + r.h / 2), 0); bench.userData.edge.position.set(r.x + r.w / 2, -(r.y + r.h / 2), -3);
  }

  // ---- HUD plaques and lacquered buttons --------------------------------------------------------------------------------------
  const ROT = Math.PI / 2;
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
  const flat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, envMapIntensity: 0.15 });
  const slateM = flat('#0a3038'), glassM = flat('#04161b'), signM = flat('#0d3c46');
  const BTN = {
    primary: phys('#ffb02e', { emissive: '#7a3a00', emissiveIntensity: 0.55, metalness: 0.2 }), gold: phys('#ffd166', { emissive: '#6a4a00', emissiveIntensity: 0.4 }),
    ghost: phys('#103c42'), quiet: phys('#12434a', { clearcoat: 0.5 }), on: phys('#35d6c6', { emissive: '#06504a', emissiveIntensity: 0.5 }),
    danger: phys('#ff6b57', { emissive: '#5a1008', emissiveIntensity: 0.4 }), coral: phys('#ff6b57', { emissive: '#5a1008', emissiveIntensity: 0.4 }),
    disabled: phys('#0a2226', { clearcoat: 0.2 }),
  };
  const PART_FILL = { acc: '#7a1226', caja: '#6a3a12', gua: '#0b4a46' };
  const hudPanels = [], hudButtons = [];
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(new THREE.BufferGeometry(), M.wood), trim = new THREE.Mesh(new THREE.BufferGeometry(), M.brass), inner = new THREE.Mesh(new THREE.BufferGeometry(), slateM); g.add(outer, trim, inner); scene.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, pn) {
    const p = panelAt(i), r = pn.r, rad = Math.min(pn.rad ?? 22, r.h / 2 - 1, r.w / 2 - 1); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = pn.top ? 300 : 8, dep = 10, ins = Math.max(4, Math.min(8, r.h * 0.07));
    const kind = pn.kind ?? 'slate';
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 4); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.outer.material = kind === 'part' ? new THREE.MeshStandardMaterial({ color: pn.col ?? '#444', roughness: 0.45, metalness: 0.2 }) : M.wood;
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.6, Math.max(3, rad - ins * 0.5), 1.4); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.4, r.h - ins * 2.4, dep + 3.2, Math.max(2, rad - ins), 2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = kind === 'ribbon' ? glassM : kind === 'sign' ? signM : slateM;
    if (kind === 'part') p.inner.material = flat(pn.fill ?? '#103c42');
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BufferGeometry(), BTN.ghost), rim2 = new THREE.Mesh(new THREE.BufferGeometry(), M.brass); g.add(rim2, body); scene.add(g); b = { g, body, rim: rim2 }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad ?? 20, r.h / 2 - 1, r.w / 2 - 1), z = bt.top ? 320 : 30, dep = pressed ? 7 : 16;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z - 4);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(2, rad - 3), 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z - 4);
    b.body.material = BTN[bt.kind] ?? BTN.ghost;
    b.g.position.set(0, pressed ? -2 : 0, 0);
  }
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x03121a, transparent: true, opacity: 0, depthWrite: false }));
  scrim.renderOrder = 0; scene.add(scrim);
  await tick();

  // ---- instruments --------------------------------------------------------------------------------------------------------------------
  const kb = { g: null, w: 0, h: 0, btns: [], rings: [] };
  const accHero = makeAccordion(1); accHero.visible = false; scene.add(accHero);
  const gKey = new THREE.Group(); scene.add(gKey); gKey.visible = false;
  function buildKeyboard(G) {
    const p = G.panel;
    if (kb.g && Math.abs(kb.w - p.w) < 0.5 && Math.abs(kb.h - p.h) < 0.5 && Math.abs(kb.r - G.r) < 0.5) return;
    if (kb.g) { gKey.remove(kb.g); kb.g.traverse((o) => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); }); }
    kb.w = p.w; kb.h = p.h; kb.r = G.r;
    const g = makeKeyboard(p.w, p.h); gKey.add(g); kb.g = g; kb.btns = []; kb.rings = [];
    const top = g.userData.top;
    for (const dy of [0.13, 0.87]) for (let i = 0; i < 7; i++) {
      const b = makePearlButton(Math.min(G.r * 0.28, 16)); b.position.set(-p.w / 2 + 12 + G.cell * (i + 0.5), (0.5 - dy) * p.h, top); b.scale.setScalar(0.95); g.add(b);
    }
    for (let i = 0; i < 7; i++) {
      const b = makePearlButton(G.r); g.add(b); kb.btns.push(b);
      const ring = B.glowRing(G.r * 1.5, '#ffb02e'); ring.rotation.x = 0; ring.position.z = top + 2; ring.visible = false; ring.material.opacity = 0; g.add(ring); kb.rings.push(ring);
    }
  }
  const bell = { g: null, w: 0, h: 0, pleats: null };
  const gBell = new THREE.Group(); scene.add(gBell); gBell.visible = false;
  const bellGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#35d6c6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  function buildBellows(pad) {
    if (bell.g && Math.abs(bell.w - pad.w) < 0.5 && Math.abs(bell.h - pad.h) < 0.5) return;
    if (bell.g) { gBell.remove(bell.g); bell.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    bell.w = pad.w; bell.h = pad.h;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(slabG(pad.w, pad.h, 22, 24, 6), M.lacquer); frame.rotation.x = ROT; g.add(frame);
    const chrome = new THREE.Mesh(slabG(pad.w - 14, pad.h - 14, 25, 18, 2), M.chrome); chrome.rotation.x = ROT; g.add(chrome);
    const well = new THREE.Mesh(slabG(pad.w - 22, pad.h - 22, 26, 14, 2), M.felt); well.rotation.x = ROT; g.add(well);
    const pl = makeBellows({ w: pad.w - 34, h: pad.h - 34, n: Math.max(10, Math.round(pad.w / 44)), depth: 1.3 }); pl.position.z = 30; g.add(pl);
    bell.pleats = pl; bell.g = g; gBell.add(g);
    g.add(bellGlow); bellGlow.scale.set(pad.w - 24, pad.h - 24, 1); bellGlow.position.z = 50;
  }
  let caja = null, cajaKey = '';
  const gCaja = new THREE.Group(); scene.add(gCaja); gCaja.visible = false;
  let gua = null, guaKey = '';
  const gGua = new THREE.Group(); scene.add(gGua); gGua.visible = false;
  const sparks = []; const sparkGeo = new THREE.SphereGeometry(1, 6, 5);
  for (let i = 0; i < 24; i++) { const s = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: '#fff0b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); sparks.push({ s, life: 0, vx: 0, vy: 0 }); }
  let sparkI = 0;
  const burst = (x, y, n, col, power = 1) => {
    for (let k = 0; k < n; k++) {
      const q = sparks[sparkI++ % sparks.length]; q.life = 0.5 + Math.random() * 0.3; q.s.visible = true; q.s.position.set(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 8, 70);
      q.vx = (Math.random() - 0.5) * 260 * power; q.vy = (80 + Math.random() * 220) * power; q.s.material.color.set(col); q.s.scale.setScalar(2.5 + Math.random() * 3);
    }
  };
  // caja: place the head at (cx, hy) with the playing ellipse the 2D layer used
  function placeCaja(G, fx, t, calm) {
    const L = G.tum, Rt = G.tak, x0 = L.x, w = Rt.x + Rt.w - L.x, y0 = L.y, h = L.h;
    const rx = Math.min(w * 0.5 - 8, h * 0.62), cx = x0 + w / 2, ry = Math.min(rx * 0.5, h * 0.3), hy = y0 + ry + 12, bottom = y0 + h - 6;
    const a = Math.acos(clamp(ry / rx, 0.2, 1)), len = Math.max(rx * 0.5, (bottom - hy) / Math.max(0.15, Math.sin(a)));
    const key2 = `${Math.round(rx)}|${Math.round(len)}`;
    if (key2 !== cajaKey) { if (caja) { gCaja.remove(caja); caja.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } caja = makeCaja(rx, len); gCaja.add(caja); cajaKey = key2; }
    gCaja.visible = true; gCaja.position.set(cx, -hy, rx * Math.sin(a) + 16); gCaja.rotation.x = -a;
    const U = caja.userData, tum = fx.tum || 0, tak = fx.tak || 0;
    U.tumFx.material.opacity = 0.12 + 0.6 * tum; U.takFx.material.opacity = 0.12 + 0.6 * tak;
    const dent = Math.max(tum, tak); U.head.scale.set(1, 1, 1 - dent * 0.35); U.local.position.y = 0;
    gCaja.scale.set(1, 1, 1);
    return { cx, hy, rx, ry };
  }
  function placeGua(G, st, t) {
    const r = G.tube, cx = r.x + r.w / 2, tw = r.w, th = r.h * 0.62, ty = r.y + r.h * 0.5 - th / 2;
    const len = tw - 40, rad = th * 0.5, k = `${Math.round(len)}|${Math.round(rad)}`;
    if (k !== guaKey) { if (gua) { gGua.remove(gua); gua.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } gua = makeGuacharaca(len, rad); gGua.add(gua); guaKey = k; }
    gGua.visible = true; gGua.position.set(cx, -(ty + th / 2), 30);
    const fk = gua.userData.fork, fx = (st.fork || 0) * (tw / 2 - 60);
    fk.position.x = fx; fk.rotation.z = -(st.lean || 0) * 0.35; fk.rotation.x = 0.35;
    return { fx: cx + fx, y: ty + th * 0.5 };
  }
  await tick();

  // ---- frame ---------------------------------------------------------------------------------------------------------------------
  let W = 1, H = 1, dprNow = 1, clock = 0, lastT = 0, frames = 0, ema = 16, setW = 0, setH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  function aim(L) {
    const fov = (2 * Math.atan(L.h / 2 / DIST) * 180) / Math.PI;
    camera.fov = fov; camera.aspect = L.w / L.h; camera.position.set(L.w / 2, -L.h / 2, DIST); camera.lookAt(L.w / 2, -L.h / 2, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function layoutSet(L, t, calm) {
    const sway = calm ? 0 : Math.sin(t * 0.35) * 10;
    set.position.x = sway * 0.4;
    wall.scale.set(L.w * 2.4, L.h * 2.2, 1); wall.position.x = L.w / 2; wall.position.y = -L.h / 2;
    // two sagging cords of bulbs across the top
    for (let row = 0; row < 2; row++) {
      const y0 = -(8 + row * 46) - 16, sag = 34 + row * 14, n = 14, pts = [];
      for (let i = 0; i <= 28; i++) { const u = i / 28; pts.push(new THREE.Vector3(-20 + u * (L.w + 40), y0 - Math.sin(u * Math.PI) * sag, -120)); }
      const c = new THREE.CatmullRomCurve3(pts);
      wires[row].geometry.dispose(); wires[row].geometry = new THREE.TubeGeometry(c, 40, 1.8, 4);
      for (const bl of bulbs.filter((q) => q.row === row)) {
        const u = (bl.i + 0.5) / n, p = c.getPoint(u);
        bl.b.position.set(p.x, p.y - 10, -112); bl.g.position.set(p.x, p.y - 10, -110);
        const pulse = 0.78 + 0.22 * (calm ? 1 : Math.sin(t * 1.6 + bl.i * 1.7 + row));
        bl.g.material.opacity = 0.85 * pulse; bl.g.scale.setScalar(64 * (0.9 + 0.2 * pulse));
      }
      warm[row].position.set(L.w * (row ? 0.72 : 0.28), -(40 + row * 40), 260);
      warm[row].intensity = 700 * (0.9 + 0.1 * (calm ? 1 : Math.sin(t * 3 + row)));
    }
    lanterns[0].position.set(L.w * 0.035, -L.h * 0.17, -150 + sway); lanterns[1].position.set(L.w * 0.965, -L.h * 0.2, -150 - sway);
    for (const [i, l] of lanterns.entries()) { l.visible = L.w > L.h * 1.1; l.rotation.z = calm ? 0 : Math.sin(t * 0.8 + i * 2) * 0.05; l.userData.body.material.emissiveIntensity = 1.5 + (calm ? 0 : 0.25 * Math.sin(t * 7 + i * 3) + 0.15 * Math.sin(t * 13.3)); }
    palms[0].position.x = L.w * 0.04; palms[0].position.y = -L.h * 1.04; palms[0].rotation.z = 0.12; palms[0].scale.setScalar(Math.max(0.5, L.h / 1500));
    palms[1].position.x = L.w * 0.98; palms[1].position.y = -L.h * 1.04; palms[1].rotation.z = -0.1; palms[1].scale.setScalar(Math.max(0.45, L.h / 1750));
    for (const [i, p] of palms.entries()) p.userData.crown.rotation.z = calm ? 0 : Math.sin(t * 0.6 + i) * 0.04;
    // fireflies
    const pos = motes.p.geometry.attributes.position;
    for (let i = 0; i < motes.n; i++) {
      const a = motes.seed[i * 3], b = motes.seed[i * 3 + 1], c = motes.seed[i * 3 + 2], ph = t * (0.06 + c * 0.1) + a * 20;
      pos.setXYZ(i, ((a + Math.sin(ph) * 0.03 + 1) % 1) * L.w, -(((b + (calm ? 0 : t * 0.01 * (0.5 + c)) ) % 1) * L.h), -60 - c * 200);
    }
    pos.needsUpdate = true; motes.p.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(t * 0.7));
    setW = L.w; setH = L.h;
  }

  function present(state, L, dt, tm) {
    const sc = state.scene, calm = !!state.prefs?.calm, inst = v3.inst;
    aim(L);
    layoutSet(L, tm, calm);
    key.position.set(L.w * 0.2 - 400, -L.h * 0.1 + 900, 1300); key.target.position.set(L.w / 2, -L.h / 2, 0);
    // HUD plaques and buttons
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h;
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2.6, L.h * 2.6, 1); scrim.position.set(L.w / 2, -L.h / 2, v3.scrimTop ? 200 : -2);
    // instruments
    placeBench(sc === 'play' ? v3.dock : null);
    gKey.visible = gBell.visible = gCaja.visible = gGua.visible = accHero.visible = false;
    if (sc === 'play' && inst) {
      if (inst.focus === 'acc') {
        const G = inst.acc.G; buildKeyboard(G); gKey.visible = true; gKey.position.set(G.panel.x + G.panel.w / 2, -(G.panel.y + G.panel.h / 2), 14);
        for (let i = 0; i < 7; i++) {
          const b = G.btns[i], f = inst.acc.flash[i] || 0, bt = kb.btns[i];
          bt.position.set(b.cx - (G.panel.x + G.panel.w / 2), -(b.cy - (G.panel.y + G.panel.h / 2)), kb.g.userData.top - f * G.r * 0.22);
          const s = 1 - 0.06 * f; bt.scale.set(s, s, 1);
          bt.userData.dome.material = f > 0.25 ? M.pearlLit : M.pearl;
          const ring = kb.rings[i], want = inst.acc.want === i;
          ring.visible = want; if (want) { ring.position.set(bt.position.x, bt.position.y, kb.g.userData.top + 3); ring.material.color.set(inst.acc.wantPull ? '#35d6c6' : '#ffb02e'); ring.material.opacity = 0.6 + 0.35 * Math.sin(tm * 9); ring.scale.setScalar(1 + 0.06 * Math.sin(tm * 9)); }
          if (f > 0.9 && !bt.userData.fired) { bt.userData.fired = true; burst(b.cx, -b.cy, 5, '#ffe9a8', 0.6); } else if (f < 0.3) bt.userData.fired = false;
        }
        if (!inst.bell.auto) {
          buildBellows(inst.bell.pad); const pad = inst.bell.pad; gBell.visible = true; gBell.position.set(pad.x + pad.w / 2, -(pad.y + pad.h / 2), 10);
          bell.pleats.userData.setOpen(clamp(inst.bell.pull, 0, 1));
          bellGlow.material.opacity = inst.bell.held ? 0.18 : 0;
        }
      } else if (inst.focus === 'caja') {
        placeCaja(inst.caja.G, inst.caja, tm, calm);
        const cj = inst.caja;
        if ((cj.tum || 0) > 0.9) burst(cj.G.tum.x + cj.G.tum.w * 0.75, -(cj.G.tum.y + cj.G.tum.h * 0.2), 2, '#ffb02e', 0.5);
        if ((cj.tak || 0) > 0.9) burst(cj.G.tak.x + cj.G.tak.w * 0.25, -(cj.G.tak.y + cj.G.tak.h * 0.2), 2, '#ff8a6a', 0.5);
      } else if (inst.focus === 'gua') {
        const gp = placeGua(inst.gua.G, inst.gua, tm);
        if ((inst.gua.glow || 0) > 0.4 && Math.random() < 0.5) burst(gp.fx, -gp.y, 1, '#fff0b0', 0.5);
      }
    } else if (sc === 'title' && v3.hero) {
      const H2 = v3.hero, s = H2.sc, tmm = H2.tm;
      const aw = 690 * s, cxx = H2.cx, cyy = H2.top + 420 * s;
      accHero.visible = true; accHero.scale.setScalar(aw); accHero.position.set(cxx, -cyy, 60);
      accHero.rotation.set(0.08, -0.2 + (calm ? 0 : Math.sin(tmm * 0.5) * 0.06), -0.03 + (calm ? 0 : Math.sin(tmm * 1.3) * 0.01));
      accHero.userData.setOpen(calm ? 0.5 : 0.5 + 0.4 * Math.sin(tmm * 1.3));
      const bw = 330 * s, by = H2.top + 560 * s, bh = 190 * s;
      const cg = cajaGeom({ x: cxx - bw - 14 * s, y: by, w: bw, h: bh }), gg = guaGeom({ x: cxx + 14 * s, y: by, w: bw, h: bh });
      placeCaja(cg, { tum: calm ? 0 : Math.max(0, Math.sin(tmm * 4.2 + 0.2)) ** 6, tak: calm ? 0 : Math.max(0, Math.sin(tmm * 4.2 + 2.1)) ** 6 }, tmm, calm);
      placeGua(gg, { fork: calm ? 0 : Math.sin(tmm * 4.2), lean: calm ? 0 : Math.cos(tmm * 4.2), glow: 1 }, tmm);
    }
    for (const q of sparks) {
      if (q.life <= 0) { q.s.visible = false; continue; }
      q.life -= dt; q.s.position.x += q.vx * dt; q.s.position.y += q.vy * dt; q.vy -= 500 * dt; q.s.material.opacity = clamp(q.life * 2.2, 0, 1);
    }
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envHandle.rebuild(); } catch (err) { /* no reflections, still playable */ }
    W = 0; resize(); scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
    v3.on = true;
  });

  await tick();
  v3.on = true;
  canvas.style.opacity = '1';
  const api = {
    ok: true, renderer, scene, camera,
    render(game, ctx, view) {
      const state = game.getState();
      const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
      const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += state.pl?.paused ? 0 : dt;
      ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
      if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; W = 0; frames = 0; ema = 16; }
      v3.panels.length = 0; v3.buttons.length = 0; v3.inst = null; v3.hero = null; v3.dock = null; v3.scrim = 0;
      resize();
      game.render(ctx, view);
      try { present(state, L, dt, clock); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
    },
  };
  void onProgress; void setW; void setH;
  return api;
}
