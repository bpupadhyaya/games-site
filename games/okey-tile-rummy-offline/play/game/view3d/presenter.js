// Okey 3D presenter: a lit kahvehane (Turkish tea-house) table. READS the game state (game.getState()), never writes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The 2D code (src/view.js, src/art.js) keeps every position, animation and
// tap target and RECORDS each tile, tile back, rack frame and title letter as four CSS-pixel corners (src/v3.js); this file stands real
// ivory tiles with thickness, engraved numerals and a gold-rimmed okey exactly there, on a walnut table with a teal felt mat, a slanted
// walnut-and-brass rack, opponents' racks, a tea glass and lokum, in a room with Iznik tiles, a kilim and a mosaic lamp.
// A 2D point is cast through the live camera onto the table (or the rack's slanted plane) so every tile is exactly as big and as placed
// as the flat art would have it. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat painted table;
// a restored context returns to 3D without a reload.
import * as THREE from '../vendor3d/three.js';
import { v3, covers } from '../src/v3.js';
import { tulip, INK } from '../src/art.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tick = () => new Promise((r) => setTimeout(r, 0));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 256 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 192 }, { name: 'low', dpr: 1, shadow: 0, tex: 128 }];
const T0 = 1.2;                     // tile thickness (cm); a rack tile is about 2.9 cm wide
const FELT_Y = 0.22;                // top of the felt mat
const LEAN = 12;                    // degrees the rack's board leans back from vertical (the camera looks down about 42)

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function texOf(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
// a rounded polygon through four (x, z) corners (a screen rectangle cast onto the table is a trapezoid); `grow` pushes it outward from its centre
function quadShape(P, r, grow = 0) {
  const cx = P.reduce((a, p) => a + p.x, 0) / 4, cz = P.reduce((a, p) => a + p.z, 0) / 4;
  const Q = P.map((p) => { const dx = p.x - cx, dz = p.z - cz, l = Math.hypot(dx, dz) || 1; return { x: p.x + dx / l * grow, z: p.z + dz / l * grow }; });
  const s = new THREE.Shape();
  for (let i = 0; i < 4; i++) {
    const a = Q[(i + 3) % 4], b = Q[i], c = Q[(i + 1) % 4];
    const l1 = Math.hypot(a.x - b.x, a.z - b.z) || 1, l2 = Math.hypot(c.x - b.x, c.z - b.z) || 1, k1 = Math.min(r, l1 / 2) / l1, k2 = Math.min(r, l2 / 2) / l2;
    const p1 = { x: b.x + (a.x - b.x) * k1, y: b.z + (a.z - b.z) * k1 }, p2 = { x: b.x + (c.x - b.x) * k2, y: b.z + (c.z - b.z) * k2 };
    if (i === 0) s.moveTo(p1.x, p1.y); else s.lineTo(p1.x, p1.y);
    s.quadraticCurveTo(b.x, b.z, p2.x, p2.y);
  }
  s.closePath();
  return s;
}
function lathe(pts, seg = 40) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
function radialTex(rgb, a = 1) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return texOf(c);
}

// ---------------------------------------------------------------------------------------------------- procedural textures
function walnutTexture() {                        // dark walnut with long grain and a few cathedral figures
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(31);
  const g = x.createLinearGradient(0, 0, S, 0); g.addColorStop(0, '#5a3320'); g.addColorStop(0.5, '#6c4128'); g.addColorStop(1, '#52301c');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 220; k++) {
    const gx = r() * S, a = 0.05 + r() * 0.16, dark = r() < 0.6;
    x.strokeStyle = dark ? `rgba(20,8,2,${a})` : `rgba(220,160,100,${a * 0.6})`; x.lineWidth = 0.6 + r() * 2.4; x.beginPath();
    const ph = r() * TAU, fr = 0.003 + r() * 0.007, amp = 2 + r() * 9;
    for (let y = 0; y <= S; y += 12) { const xx = gx + Math.sin(y * fr + ph) * amp; if (y) x.lineTo(xx, y); else x.moveTo(xx, y); }
    x.stroke();
  }
  for (let i = 0; i < 9; i++) { const cx = r() * S, cy = r() * S; x.strokeStyle = 'rgba(25,10,3,0.18)'; x.lineWidth = 1.2; for (let k = 1; k < 5; k++) { x.beginPath(); x.ellipse(cx, cy, 8 * k, 30 * k, 0, 0, TAU); x.stroke(); } }
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,170,0.04)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1); }
  return c;
}
function feltTexture() {                          // teal felt with a faint tulip lattice (the game's own motif) and fibre noise
  const S = 512, c = cv(S), x = c.getContext('2d'), r = rng(5);
  x.fillStyle = '#17695f'; x.fillRect(0, 0, S, S);
  x.globalAlpha = 0.14; let row = 0;
  for (let y = 40; y < S + 60; y += 86) { for (let xx = (row % 2) * 64; xx < S + 64; xx += 128) tulip(x, xx, y, 30, '#a6ead9', '#a6ead9'); row++; }
  x.globalAlpha = 1;
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)'; x.fillRect(r() * S, r() * S, 1.4, 1.4); }
  return c;
}
function kilimTexture() {                         // a woven kilim: bands of red / indigo / ochre diamonds
  const S = 512, c = cv(S), x = c.getContext('2d'), r = rng(9);
  x.fillStyle = '#7a1f1a'; x.fillRect(0, 0, S, S);
  const cols = ['#e8c872', '#1f2f5c', '#d9a23a', '#c9482c', '#f1e6c8'];
  for (let band = 0; band < 8; band++) {
    const y0 = band * 64;
    x.fillStyle = band % 2 ? '#2a3a6e' : '#8f2a22'; x.fillRect(0, y0, S, 64);
    for (let i = 0; i < 8; i++) {
      const cx = i * 64 + 32, cy = y0 + 32;
      x.fillStyle = cols[(i + band) % 5]; x.beginPath(); x.moveTo(cx, cy - 26); x.lineTo(cx + 22, cy); x.lineTo(cx, cy + 26); x.lineTo(cx - 22, cy); x.closePath(); x.fill();
      x.fillStyle = cols[(i + band + 2) % 5]; x.beginPath(); x.moveTo(cx, cy - 12); x.lineTo(cx + 10, cy); x.lineTo(cx, cy + 12); x.lineTo(cx - 10, cy); x.closePath(); x.fill();
    }
    x.fillStyle = '#f1e6c8'; for (let i = 0; i < 32; i++) x.fillRect(i * 16 + 3, y0, 6, 4);
  }
  for (let i = 0; i < 8000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * S, r() * S, 2, 1); }
  return c;
}
function iznikTexture() {                         // cobalt and turquoise tulip tiles on cream, grouted
  const S = 512, c = cv(S), x = c.getContext('2d'), cell = S / 4;
  x.fillStyle = '#f4ecd6'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
    x.fillStyle = '#fbf6e6'; x.fillRect(i * cell + 3, j * cell + 3, cell - 6, cell - 6);
    x.fillStyle = '#1b4f9c'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; x.beginPath(); x.ellipse(cx + Math.cos(a) * cell * 0.22, cy + Math.sin(a) * cell * 0.22, cell * 0.2, cell * 0.1, a, 0, TAU); x.fill(); }
    x.fillStyle = '#1aa6a0'; x.beginPath(); x.arc(cx, cy, cell * 0.12, 0, TAU); x.fill();
    x.fillStyle = '#d33a2c'; x.beginPath(); x.arc(cx, cy, cell * 0.05, 0, TAU); x.fill();
  }
  x.strokeStyle = 'rgba(110,100,80,0.9)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * cell, 0); x.lineTo(i * cell, S); x.moveTo(0, i * cell); x.lineTo(S, i * cell); x.stroke(); }
  return c;
}
function lampGlassTexture() {                     // mosaic lamp glass: coloured triangles
  const c = cv(256, 128), x = c.getContext('2d'), r = rng(12), cols = ['#d62a2a', '#1f6fd0', '#16a085', '#f0a020', '#8e44ad', '#2ecc71'];
  x.fillStyle = '#1a0c05'; x.fillRect(0, 0, 256, 128);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) {
    const px = i * 16, py = j * 16;
    x.fillStyle = cols[Math.floor(r() * 6)]; x.beginPath(); x.moveTo(px + 1, py + 1); x.lineTo(px + 15, py + 1); x.lineTo(px + 8, py + 15); x.closePath(); x.fill();
    x.fillStyle = cols[Math.floor(r() * 6)]; x.beginPath(); x.moveTo(px + 1, py + 16); x.lineTo(px + 15, py + 16); x.lineTo(px + 8, py + 2); x.closePath(); x.fill();
  }
  return c;
}

// ---------------------------------------------------------------------------------------------------- tile faces
function star(x, cx, cy, ro, ri, n) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro; if (i) x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); }
function pip(x, color, cx, cy, r, fill) {
  x.fillStyle = fill; x.beginPath();
  if (color === 0) x.arc(cx, cy, r, 0, TAU);
  else if (color === 1) { const q = r * 0.86; x.roundRect(cx - q, cy - q, q * 2, q * 2, q * 0.3); }
  else if (color === 2) { x.moveTo(cx, cy - r * 1.1); x.lineTo(cx + r * 1.05, cy + r * 0.8); x.lineTo(cx - r * 1.05, cy + r * 0.8); x.closePath(); }
  else { x.moveTo(cx, cy - r * 1.2); x.lineTo(cx + r * 0.9, cy); x.lineTo(cx, cy + r * 1.2); x.lineTo(cx - r * 0.9, cy); x.closePath(); }
  x.fill();
}
// The face painted for the 3D tile: clean (thickness, shadow and lighting are real now), numerals engraved with a soft highlight.
function paintFace3(x, w, h, key, fake, wild, letter) {
  const g = x.createLinearGradient(0, 0, w * 0.5, h); g.addColorStop(0, '#fffdf4'); g.addColorStop(0.6, '#f8f0da'); g.addColorStop(1, '#ede1c2');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = rng(key * 7 + 3);
  for (let i = 0; i < 260; i++) { x.fillStyle = r() < 0.5 ? 'rgba(160,130,70,0.05)' : 'rgba(255,255,255,0.18)'; x.fillRect(r() * w, r() * h, 1.5, 1.5); }
  const cx = w / 2;
  if (letter) {
    const c = letter.i;
    x.font = `900 ${h * 0.66}px Georgia,'Times New Roman',serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillText(letter.ch, cx + 1.5, h * 0.44 + 3); x.fillStyle = 'rgba(90,70,30,0.25)'; x.fillText(letter.ch, cx - 1, h * 0.44 - 1.5);
    x.fillStyle = INK[c]; x.fillText(letter.ch, cx, h * 0.44);
    pip(x, c, cx, h * 0.84, w * 0.075, INK[c]);
  } else if (fake) {
    x.strokeStyle = '#17604b'; x.lineWidth = w * 0.045; x.beginPath(); x.arc(cx, h * 0.45, w * 0.3, 0, TAU); x.stroke();
    star(x, cx, h * 0.45, w * 0.22, w * 0.09, 5); const sg = x.createLinearGradient(0, h * 0.2, 0, h * 0.7); sg.addColorStop(0, '#2c9a78'); sg.addColorStop(1, '#12503f'); x.fillStyle = sg; x.fill();
    x.fillStyle = '#17604b'; x.beginPath(); x.arc(cx, h * 0.83, w * 0.045, 0, TAU); x.fill(); x.beginPath(); x.arc(cx - w * 0.14, h * 0.83, w * 0.03, 0, TAU); x.arc(cx + w * 0.14, h * 0.83, w * 0.03, 0, TAU); x.fill();
  } else {
    const c = Math.floor(key / 13), n = (key % 13) + 1, fs = n >= 10 ? h * 0.42 : h * 0.52;
    x.font = `800 ${fs}px 'Trebuchet MS','Avenir Next','Segoe UI',Verdana,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const ny = h * 0.42;
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillText(String(n), cx + 1.4, ny + 2.6);          // engraved: light lip below-right, shade above-left
    x.fillStyle = 'rgba(70,50,20,0.28)'; x.fillText(String(n), cx - 1, ny - 1.4);
    x.fillStyle = INK[c]; x.fillText(String(n), cx, ny);
    pip(x, c, cx, h * 0.8, w * 0.1, INK[c]);
  }
  if (wild) {                                      // the okey of this deal: gold rim and a glint
    x.lineWidth = Math.max(3, w * 0.06); const gg = x.createLinearGradient(0, 0, w, h); gg.addColorStop(0, '#ffe58a'); gg.addColorStop(0.5, '#d9a21b'); gg.addColorStop(1, '#fff0a8');
    x.strokeStyle = gg; const m = w * 0.05; x.beginPath(); x.roundRect(m, m, w - 2 * m, h - 2 * m, w * 0.12); x.stroke();
    star(x, w * 0.2, h * 0.12, w * 0.1, w * 0.032, 4); x.fillStyle = '#d9a21b'; x.fill();
  }
}
function paintBack3(x, w, h) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1f8d80'); g.addColorStop(1, '#0b4742'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.lineWidth = w * 0.035; x.strokeStyle = '#e7bd62'; x.strokeRect(w * 0.1, w * 0.1, w * 0.8, h - w * 0.2);
  tulip(x, w / 2, h * 0.5, Math.min(w, h) * 0.3, 'rgba(244,201,106,0.95)', 'rgba(244,201,106,0.7)');
}

// unit tile: x in [-.5, .5], y in [-.5, .5] (face on top), z in [-1, 0] (body below the face); the caller scales x by the width, y by the height, z by the thickness
function tileGeometry() {
  const g = new THREE.ExtrudeGeometry(roundedShape(1, 1.22, 0.16), { depth: 0.8, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 3, curveSegments: 7 });
  g.computeBoundingBox(); const b = g.boundingBox, cxm = (b.min.x + b.max.x) / 2, cym = (b.min.y + b.max.y) / 2, sx = 1 / (b.max.x - b.min.x), sy = 1 / (b.max.y - b.min.y), sz = 1 / (b.max.z - b.min.z);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = (p.getX(i) - cxm) * sx, y = (p.getY(i) - cym) * sy; p.setXYZ(i, x, y, (p.getZ(i) - b.max.z) * sz); uv.setXY(i, x + 0.5, y + 0.5); }
  g.computeBoundingSphere(); p.needsUpdate = true;
  return g;
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const noop = { ok: false };
  const iconMode = qs.has('icon');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: iconMode }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = iconMode ? 0.95 : 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  await tick();
  // ---------------------------------------------------------------- scene, lights, environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1618); scene.fog = new THREE.Fog(0x0a1618, 160, 520);
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 1500);
  const key = new THREE.SpotLight(0xffe2b0, 1500, 0, 0.8, 0.9, 1.3);       // the afternoon sun through the window, low from the left
  key.position.set(-70, 130, 40); key.target.position.set(0, 0, 10);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 4; Object.assign(key.shadow.camera, { near: 60, far: 360 });
  const hemi = new THREE.HemisphereLight(0xfff0d8, 0x1a1208, 0.14);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.18); fill.position.set(60, 60, 90);
  const lampLight = new THREE.PointLight(0xffa860, 900, 380, 1.6); lampLight.position.set(0, 120, -60);
  scene.add(key, key.target, hemi, fill, lampLight);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.12; } catch { /* no IBL */ } };
  buildEnv();

  await tick();
  // ---------------------------------------------------------------- shared materials
  const walnut = new THREE.MeshPhysicalMaterial({ map: texOf(walnutTexture(), { repeat: [1, 1] }), roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3, color: 0xa08878 });
  const walnutSide = new THREE.MeshPhysicalMaterial({ map: texOf(walnutTexture(), { repeat: [0.4, 0.4] }), roughness: 0.5, clearcoat: 0.2, color: 0x806658 });
  const trayWood = new THREE.MeshPhysicalMaterial({ map: texOf(walnutTexture(), { repeat: [0.6, 0.6] }), roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25, color: 0x3d2c24 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a940, roughness: 0.28, metalness: 1 });
  const feltMat = new THREE.MeshStandardMaterial({ map: texOf(feltTexture(), { repeat: [1, 1] }), roughness: 0.95, color: 0xb4cfc8 });
  const boneSide = new THREE.MeshStandardMaterial({ color: 0xe6d7ab, roughness: 0.5 });

  // ---------------------------------------------------------------- the table: rounded walnut slab, rebuilt when the fitted size changes
  const tableGroup = new THREE.Group(); scene.add(tableGroup);
  let tblKey = '';
  function buildTable(x0, x1, z0, z1, rad) {
    const k = [x0, x1, z0, z1, rad].map((v) => v.toFixed(1)).join(); if (k === tblKey) return; tblKey = k;
    for (const o of [...tableGroup.children]) { tableGroup.remove(o); o.geometry?.dispose(); }
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = new THREE.ExtrudeGeometry(roundedShape(w, d, rad), { depth: 5, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3, curveSegments: 16 });
    g.rotateX(Math.PI / 2); g.translate(cx, -0.5, cz);
    const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - cx) / 40, (p.getZ(i) - cz) / 40);
    const m = new THREE.Mesh(g, [walnut, walnutSide]); m.receiveShadow = true; m.castShadow = true; tableGroup.add(m);
    const ring = roundedShape(w - 4, d - 4, Math.max(1, rad - 2)); ring.holes.push(roundedShape(w - 4.7, d - 4.7, Math.max(1, rad - 2.35)));    // brass inlay line near the rim
    const ig = new THREE.ShapeGeometry(ring, 16); ig.rotateX(-Math.PI / 2); ig.translate(cx, 0.03, cz);
    tableGroup.add(new THREE.Mesh(ig, brass));
  }

  await tick();
  // ---------------------------------------------------------------- the felt mat, its braid and the pile spots (shaped from 'frame' records)
  const mat = { felt: null, braid: null, key: '' };
  const flatGeo = (shape, y) => { const g = new THREE.ShapeGeometry(shape, 10); g.rotateX(Math.PI / 2); g.scale(1, 1, 1); g.translate(0, y, 0); return g; };
  function buildMat(P, r) {
    const k = P.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join() + r.toFixed(1); if (k === mat.key) return; mat.key = k;
    for (const o of [mat.felt, mat.braid]) if (o) { scene.remove(o); o.geometry.dispose(); }
    const g = new THREE.ExtrudeGeometry(quadShape(P, r), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.08, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(Math.PI / 2); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 22, p.getZ(i) / 22);
    mat.felt = new THREE.Mesh(g, [feltMat, boneSide]); mat.felt.receiveShadow = true; scene.add(mat.felt);
    const outer = quadShape(P, r + 0.3, 0.9); outer.holes.push(quadShape(P, r, 0.1));
    const bg = new THREE.ExtrudeGeometry(outer, { depth: 0.1, bevelEnabled: false, curveSegments: 10 }); bg.rotateX(Math.PI / 2);
    mat.braid = new THREE.Mesh(bg, brass); scene.add(mat.braid);
  }
  const spotMat = new THREE.MeshBasicMaterial({ color: 0x021a18, transparent: true, opacity: 0.3, depthWrite: false });
  const spots = [];
  function spotMesh(i, P, r) {
    let o = spots[i]; const k = P.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join();
    if (!o) { o = new THREE.Group(); spots[i] = o; scene.add(o); }
    if (o.userData.k !== k) {
      o.userData.k = k; for (const c of [...o.children]) { o.remove(c); c.geometry.dispose(); }
      const fill2 = new THREE.Mesh(flatGeo(quadShape(P, r), FELT_Y + 0.02), spotMat); fill2.renderOrder = 1;
      const ring = quadShape(P, r, 0.12); ring.holes.push(quadShape(P, Math.max(0.2, r - 0.1), -0.3));
      const rm = new THREE.Mesh(flatGeo(ring, FELT_Y + 0.045), brass);
      o.add(fill2, rm);
    }
    return o;
  }

  await tick();
  // ---------------------------------------------------------------- tiles: one unit geometry, pooled meshes, cached face materials
  const tileGeo = tileGeometry();
  const faceCache = new Map();
  function capMat(kind, id, wild, dim, letter) {
    const k = `${kind}|${id}|${wild ? 1 : 0}|${dim > 0.01 ? 1 : 0}|${TIERS[tier].tex}`; let m = faceCache.get(k); if (m) return m;
    const W = TIERS[tier].tex, H = Math.round(W * 1.22), c = cv(W, H), x = c.getContext('2d');
    if (kind === 'b') paintBack3(x, W, H); else paintFace3(x, W, H, id, kind === 'f', wild, letter);
    m = new THREE.MeshPhysicalMaterial({ map: texOf(c, { aniso: 4 }), roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.3, color: dim > 0.01 ? 0xa9b3b0 : 0xffffff });
    faceCache.set(k, m); return m;
  }
  const tilePool = [];
  function tileMesh(i) {
    if (!tilePool[i]) { const m = new THREE.Mesh(tileGeo, [boneSide, boneSide]); m.matrixAutoUpdate = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); tilePool[i] = m; }
    return tilePool[i];
  }

  await tick();
  // ---------------------------------------------------------------- trays: the player's slanted rack, opponents' low racks, the title showcase
  const trays = [];
  function trayMesh(i) {
    if (!trays[i]) {
      const g = new THREE.Group(), u = (m) => { m.castShadow = true; m.receiveShadow = true; return m; }, box = (m) => u(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m));
      g.userData = { board: box([trayWood, trayWood]), rails: [0, 1, 2, 3].map(() => box([trayWood, trayWood, trayWood, trayWood, brass, trayWood])), trim: [0, 1].map(() => box(brass)) };
      g.add(g.userData.board, ...g.userData.rails, ...g.userData.trim); scene.add(g); trays[i] = g;
    }
    return trays[i];
  }
  const ledgeMeshes = [];

  await tick();
  // ---------------------------------------------------------------- props: a tulip tea glass (istikan) on a saucer, a brass dish of lokum
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f6f8, roughness: 0.04, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const teaMat = new THREE.MeshPhysicalMaterial({ color: 0xb3361c, roughness: 0.1, transparent: true, opacity: 0.9, emissive: 0x6b1a08, emissiveIntensity: 0.55 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xcfd6dc, roughness: 0.25, metalness: 1 });
  const props = new THREE.Group(); scene.add(props);
  const teaA = new THREE.Group(); props.add(teaA);
  { const saucer = new THREE.Mesh(lathe([[0.01, 0], [3.4, 0.0], [5.5, 0.35], [5.9, 0.9], [5.7, 0.95], [5.3, 0.55], [3.4, 0.25], [0.01, 0.25]], 36), silver); saucer.castShadow = true; saucer.receiveShadow = true;
    const outline = [[0.01, 0.35], [1.9, 0.35], [2.0, 0.55], [2.1, 3], [1.65, 5.2], [1.75, 7.0], [2.5, 8.8], [2.62, 9.6], [2.5, 9.6], [2.4, 8.8], [1.6, 7.0], [1.5, 5.2], [1.95, 3], [1.85, 0.7], [0.01, 0.7]];
    const glass = new THREE.Mesh(lathe(outline, 36), glassMat); glass.renderOrder = 5;
    const tea = new THREE.Mesh(lathe([[0.01, 0.7], [1.85, 0.75], [1.9, 3], [1.5, 5.2], [1.6, 7], [2.3, 8.2], [0.01, 8.2]], 30), teaMat); tea.renderOrder = 4; tea.castShadow = true;
    const spoon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6.5, 6), silver); spoon.rotation.set(0, 0, 1.2); spoon.position.set(3.6, 1.6, 0.4); spoon.castShadow = true;
    teaA.add(saucer, glass, tea, spoon); teaA.scale.setScalar(0.72); }
  const steamTex = radialTex('255,255,255', 0.5), steam = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 7; s.scale.set(2.2, 2.2, 1); teaA.add(s); steam.push(s); }
  const lokum = new THREE.Group(); props.add(lokum); lokum.scale.setScalar(0.72);
  { const dish = new THREE.Mesh(lathe([[0.01, 0], [3.4, 0], [5.6, 1.6], [5.9, 1.6], [5.7, 1.9], [5.2, 1.9], [3.2, 0.5], [0.01, 0.5]], 32), brass); dish.castShadow = true; dish.receiveShadow = true; lokum.add(dish);
    const cols = [0xd9456a, 0xf3e9d2, 0x7fc4a0, 0xe8b040], r = rng(4);
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: cols[i % 4], roughness: 0.85 })); const a = r() * TAU, d = r() * 2.6; c.position.set(Math.cos(a) * d, 1.0 + (i > 5 ? 1.2 : 0), Math.sin(a) * d); c.rotation.y = r() * 3; c.castShadow = true; lokum.add(c); } }

  await tick();
  // ---------------------------------------------------------------- the room: kilim floor, Iznik wainscot, plaster wall, window light, mosaic lamps, chairs
  const FLOOR = -72, WALL_Z = 0, room = new THREE.Group(); scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ map: texOf(kilimTexture(), { repeat: [14, 14] }), roughness: 0.9, color: 0x9a8a80 })); floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; scene.add(floor);
  const wain = new THREE.Mesh(new THREE.PlaneGeometry(1800, 130), new THREE.MeshStandardMaterial({ map: texOf(iznikTexture(), { repeat: [70, 8] }), roughness: 0.35, color: 0xcfc8b8 })); wain.position.set(0, FLOOR + 65, WALL_Z); room.add(wain);
  const plaster = new THREE.Mesh(new THREE.PlaneGeometry(1800, 420), new THREE.MeshStandardMaterial({ color: 0x1d6f6a, roughness: 0.95 })); plaster.position.set(0, FLOOR + 130 + 210, WALL_Z); room.add(plaster);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(1800, 5, 6), brass); cornice.position.set(0, FLOOR + 131, WALL_Z + 3); room.add(cornice);
  const winGroup = new THREE.Group(); room.add(winGroup);
  { const lightM = new THREE.MeshBasicMaterial({ color: 0xfff0c8, fog: false }), pane = new THREE.Mesh(new THREE.PlaneGeometry(70, 130), lightM); pane.position.set(0, FLOOR + 220, WALL_Z + 1);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(35, 24, 0, Math.PI), lightM); arch.position.set(0, FLOOR + 285, WALL_Z + 1); winGroup.add(pane, arch);
    const frameM = new THREE.MeshStandardMaterial({ color: 0x3a2314, roughness: 0.6 });
    for (const [x, y, w, h] of [[0, FLOOR + 220, 3, 130], [0, FLOOR + 240, 70, 3], [0, FLOOR + 190, 70, 3], [-36, FLOOR + 220, 3, 130], [36, FLOOR + 220, 3, 130]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), frameM); b.position.set(x, y, WALL_Z + 2); winGroup.add(b); } }
  const shaftTex = (() => { const c = cv(64, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,230,170,0.5)'); g.addColorStop(1, 'rgba(255,230,170,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); return texOf(c); })();
  const shafts = [];
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(26, 300), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false, side: THREE.DoubleSide })); s.rotation.set(0, 0, -0.5); scene.add(s); shafts.push(s); }
  const lampGlass = texOf(lampGlassTexture(), { repeat: [2, 1] });
  function mosaicLamp() {
    const lamp = new THREE.Group();
    lamp.add(new THREE.Mesh(lathe([[0.01, -9], [3, -8.5], [6, -5], [8, -1], [8.3, 3], [6.5, 7], [3.5, 9.5], [0.01, 10]], 28), new THREE.MeshStandardMaterial({ map: lampGlass, emissiveMap: lampGlass, emissive: 0xffffff, emissiveIntensity: 1.8, roughness: 0.3, side: THREE.DoubleSide })));
    lamp.add(new THREE.Mesh(lathe([[0.01, 9.5], [3.2, 9.6], [2, 12], [0.8, 13], [0.01, 13]], 18), brass));
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 160, 4), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 1, roughness: 0.4 })); chain.position.y = 93; lamp.add(chain);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,170,90', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.scale.set(70, 70, 1); lamp.add(glow); lamp.userData.glow = glow;
    scene.add(lamp); return lamp;
  }
  const lamps = [mosaicLamp(), mosaicLamp()]; lamps[1].scale.setScalar(0.85);
  { const shelf = new THREE.Mesh(new THREE.BoxGeometry(220, 3, 14), walnut); shelf.position.set(150, FLOOR + 235, WALL_Z + 8); room.add(shelf);   // copper pots on a shelf
    const cop = new THREE.MeshStandardMaterial({ color: 0xc0703a, roughness: 0.3, metalness: 1 });
    for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(lathe([[0.01, 0], [6, 0], [8, 10], [6.5, 18], [4, 20], [0.01, 20]], 18), cop); p.position.set(75 + i * 36, FLOOR + 237, WALL_Z + 8); p.scale.setScalar(0.8 + (i % 3) * 0.15); room.add(p); } }
  const chairWood = new THREE.MeshPhysicalMaterial({ color: 0x6a3a20, roughness: 0.45, clearcoat: 0.5 }), rush = new THREE.MeshStandardMaterial({ color: 0xc9a259, roughness: 0.95 });
  const chairs = [0, 1, 2].map(() => {      // rush-seat chairs at the other three seats, empty: the players are the plates
    const g = new THREE.Group(), box = (w, h, d, x, y, z, m = chairWood) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    box(40, 4, 40, 0, -31, 0, rush); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(3.2, 42, 3.2, a * 17, -53, b * 17);
    box(40, 3, 3, 0, -6, -18); box(3, 26, 3, -17, -18, -18); box(3, 26, 3, 17, -18, -18); box(34, 3, 3, 0, -16, -18);
    scene.add(g); return g;
  });

  await tick();
  // ---------------------------------------------------------------- soft contact shadow blobs under table tiles
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobTex = (() => { const c = cv(64, 80), x = c.getContext('2d'); for (let i = 0; i < 10; i++) { const k = i * 1.4; x.fillStyle = 'rgba(0,0,0,0.09)'; x.beginPath(); x.roundRect(10 + k, 12 + k, 44 - 2 * k, 56 - 2 * k, 8 + k); x.fill(); } return texOf(c); })();
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.85 }), 160);
  blobs.count = 0; blobs.frustumCulled = false; blobs.renderOrder = 2; scene.add(blobs);

  // ---------------------------------------------------------------- tiers
  let sizeKey = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(iconMode ? 1 : Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    for (const m of faceCache.values()) m.map.dispose();
    faceCache.clear();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    sizeKey = '';
  }
  applyTier();

  // ---------------------------------------------------------------- camera and casting
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cur = { tilt: 42, fov: 30, dist: 100 };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _v = new THREE.Vector3();
  function placeCamera() {
    const dir = _v.set(0, Math.sin(cur.tilt * D2R), Math.cos(cur.tilt * D2R));
    camera.fov = cur.fov; camera.aspect = cssW() / cssH(); camera.position.copy(dir).multiplyScalar(cur.dist); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const tablePlane = (h) => new THREE.Plane(new THREE.Vector3(0, 1, 0), -h);
  function cast(px, py, plane, out = new THREE.Vector3()) {
    ndc.set((px / cssW()) * 2 - 1, 1 - (py / cssH()) * 2); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, out)) out.set(0, 0, 0);
    return out;
  }
  const mid = (q, a, b) => [(q[a][0] + q[b][0]) / 2, (q[a][1] + q[b][1]) / 2];
  const centre = (q) => [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
  // a leaning plane through the point where the bottom-centre of a quad meets the table
  function leanPlane(b, lean = LEAN, y = 0.8) {
    const A = cast(b[0], b[1], tablePlane(y)), n = new THREE.Vector3(0, Math.sin(lean * D2R), Math.cos(lean * D2R));
    return new THREE.Plane().setFromNormalAndCoplanarPoint(n, A);
  }
  const _M = new THREE.Matrix4(), _P = [0, 1, 2, 3].map(() => new THREE.Vector3()), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _C = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  // basis standing a unit-tile mesh exactly on a screen quad cast onto `plane` (face on the plane, body behind it)
  function quadMatrix(q, plane, lift, thick, out) {
    for (let i = 0; i < 4; i++) cast(q[i][0], q[i][1], plane, _P[i]);
    _X.copy(_P[1]).sub(_P[0]).add(_a.copy(_P[2]).sub(_P[3])).multiplyScalar(0.5);
    _Y.copy(_P[0]).sub(_P[3]).add(_b.copy(_P[1]).sub(_P[2])).multiplyScalar(0.5);      // up the screen
    const w = _X.length(), h = _Y.length();
    _Z.copy(plane.normal); _X.addScaledVector(_Z, -_X.dot(_Z)).normalize(); _Y.crossVectors(_Z, _X).normalize();
    _C.copy(_P[0]).add(_P[1]).add(_P[2]).add(_P[3]).multiplyScalar(0.25).addScaledVector(_Z, lift);
    out.makeBasis(_X.clone().multiplyScalar(w), _Y.clone().multiplyScalar(h), _Z.clone().multiplyScalar(thick)).setPosition(_C);
    return { w, h };
  }

  // ---------------------------------------------------------------- framing: a rack tile is about 2.9 cm wide, the table fills the screen
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, viewKey = '';
  if (iconMode) kitCanvas.style.visibility = 'hidden';
  function frame(mode) {
    const W = cssW(), H = cssH(), k2 = `${W}x${H}|${mode}`;
    if (k2 === viewKey) return; viewKey = k2;
    const land = W > H * 1.1;
    cur.tilt = land ? 44 : 42; cur.fov = 30;
    const tilePx = 62 * Math.min(W, H) / 720, s0 = 2.9 / tilePx;      // cm per css px at the screen centre
    cur.dist = s0 * H / (2 * Math.tan(cur.fov * D2R / 2));
    placeCamera();
    const yTop = H * (land ? 0.05 : 0.035), p0 = tablePlane(0);
    const zFar = cast(W / 2, yTop, p0).z, xFar = Math.abs(cast(0, yTop, p0).x), zNear = cast(W / 2, H, p0).z, xNear = Math.abs(cast(0, H, p0).x);
    const fx = Math.max(xNear * 1.03, xFar * (land ? 0.9 : 0.8)), rad = Math.min(fx * 0.62, (zNear - zFar) * 0.34);
    buildTable(-fx, fx, zFar, zNear + 14, rad);
    key.position.set(-fx * 0.7, 88, zNear * 0.05); key.target.position.set(fx * 0.05, 0, zNear * 0.3); key.target.updateMatrixWorld();
    lampLight.position.set(0, 120, zFar * 0.4);
    lamps[0].position.set(fx * 0.55, 48, zFar - 60); lamps[1].position.set(-fx * 0.45, 62, zFar - 80);
    room.position.set(0, 0, zFar - 100); winGroup.position.set(-fx * 0.75, 0, 0);
    shafts.forEach((s, i) => s.position.set(-fx * 0.75 + 20 + i * 24, FLOOR + 220 - 110, zFar - 100 + 70 + i * 18));
    chairs[0].position.set(0, 0, zFar - 38); chairs[0].rotation.y = 0;
    chairs[1].position.set(-fx - 34, 0, zFar * 0.4); chairs[1].rotation.y = Math.PI / 2; chairs[2].position.set(fx + 34, 0, zFar * 0.4); chairs[2].rotation.y = -Math.PI / 2;
    sizeKey = '';
  }

  // ---------------------------------------------------------------- per frame: stand everything where the 2D drew it
  function pre() { /* the camera is fixed per screen size; nothing to do before the 2D render */ }
  const feltPlane = tablePlane(FELT_Y), flatPlane = tablePlane(0), _bm = new THREE.Matrix4(), _tp = tablePlane(0), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState(), rec = v3.rec;
    if ((!covers(state.scene) || !rec) && !iconMode) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const t = state.t, title = state.scene === 'title';
    frame(title ? 'title' : 'play');
    const recs = rec || [], W = cssW(), H = cssH();
    const fr = { mat: null, rack: null, show: null, spots: [], opp: [], ledges: [] };
    for (const r of recs) if (r.kind === 'frame') { if (r.style === 'mat') fr.mat = r; else if (r.style === 'rack') fr.rack = r; else if (r.style === 'showcase') fr.show = r; else if (r.style === 'spot') fr.spots.push(r); else if (r.style === 'opp') fr.opp.push(r); else if (r.style === 'ledge') fr.ledges.push(r); }
    const castQuad = (q, plane) => q.map((p) => cast(p[0], p[1], plane, new THREE.Vector3()));
    // felt mat + pile spots
    if (mat.felt) { mat.felt.visible = !!fr.mat; mat.braid.visible = !!fr.mat; }
    if (fr.mat) { const P = castQuad(fr.mat.q, feltPlane), cmPerPx = Math.abs(P[1].x - P[0].x) / Math.max(1, fr.mat.q[1][0] - fr.mat.q[0][0]); buildMat(P, fr.mat.r * fr.mat.sc * cmPerPx); mat.felt.position.set(0, FELT_Y - 0.17, 0); mat.braid.position.set(0, FELT_Y - 0.05, 0); }
    spots.forEach((o) => { o.visible = false; });
    fr.spots.forEach((s, i) => { const P = castQuad(s.q, feltPlane), cmPerPx = Math.abs(P[1].x - P[0].x) / Math.max(1, s.q[1][0] - s.q[0][0]); const o = spotMesh(i, P, s.r * s.sc * cmPerPx); o.visible = true; });
    // planes the tiles stand on
    const planes = { table: feltPlane, rack: fr.rack ? leanPlane(mid(fr.rack.q, 2, 3)) : null, show: fr.show ? leanPlane(mid(fr.show.q, 2, 3)) : null, hero: null };
    { const L = recs.filter((r) => r.kind === 'letter'); if (L.length) { const b = [0, 0]; for (const r of L) { const m = mid(r.q, 2, 3); b[0] += m[0] / L.length; b[1] += m[1] / L.length; } planes.hero = leanPlane(b, 20, 0.5); } }
    const inRack = (q) => { if (!fr.rack) return false; const c = centre(q), f = fr.rack.q; return c[0] >= f[0][0] && c[0] <= f[1][0] && c[1] >= f[0][1] - 30 && c[1] <= f[2][1] + 10; };
    // trays: opponents' racks lie on the table (a low walnut box with brass), the player's rack and the showcase lean on their slanted plane
    let nTray = 0;
    const placeTray = (r, plane, lean) => {
      const g = trayMesh(nTray++), U = g.userData, P = castQuad(r.q, plane); g.visible = true;
      const wv = P[1].clone().sub(P[0]).add(P[2].clone().sub(P[3])).multiplyScalar(0.5), hv = P[0].clone().sub(P[3]).add(P[1].clone().sub(P[2])).multiplyScalar(0.5);
      const w = wv.length(), h = hv.length(), n = plane.normal.clone(), X = wv.clone().normalize(); X.addScaledVector(n, -X.dot(n)).normalize();
      const Y = new THREE.Vector3().crossVectors(n, X), C = P[0].clone().add(P[1]).add(P[2]).add(P[3]).multiplyScalar(0.25);
      g.matrixAutoUpdate = false; g.matrix.makeBasis(X, Y, n).setPosition(C); g.matrixWorldNeedsUpdate = true;
      const rail = lean ? 1.2 : 0.7, rh = lean ? T0 * 0.85 : 1.5, top = lean ? 0 : 0, fl = lean ? T0 : 1.5;
      U.board.scale.set(w + 1.6, h + 1.6, lean ? 1.6 : fl); U.board.position.set(0, 0, lean ? -T0 - 0.8 : -fl / 2 + 0.0 - 0);
      const rz = lean ? -T0 + rh / 2 : -fl + rh / 2 + 0.2, bs = U.rails;
      bs[0].scale.set(rail, h + 1.6, rh); bs[0].position.set(-w / 2 - rail / 2 + 0.2, 0, rz);
      bs[1].scale.set(rail, h + 1.6, rh); bs[1].position.set(w / 2 + rail / 2 - 0.2, 0, rz);
      bs[2].scale.set(w + 1.6, rail, rh); bs[2].position.set(0, h / 2 + rail / 2 - 0.2, rz);
      bs[3].scale.set(w + 1.6, rail, rh * 0.8); bs[3].position.set(0, -h / 2 - rail / 2 + 0.2, rz - rh * 0.1);
      U.trim[0].scale.set(w + 1.6 + 2 * rail, 0.18, 0.18); U.trim[0].position.set(0, h / 2 + rail, rz + rh / 2 + 0.02 + top);
      U.trim[1].scale.set(w + 1.6 + 2 * rail, 0.18, 0.18); U.trim[1].position.set(0, -h / 2 - rail, rz + rh * 0.4 + 0.02 + top);
    };
    for (const o of fr.opp) placeTray(o, feltPlane, false);
    if (fr.rack && planes.rack) placeTray(fr.rack, planes.rack, true);
    if (fr.show && planes.show) placeTray(fr.show, planes.show, true);
    for (let i = nTray; i < trays.length; i++) trays[i].visible = false;
    ledgeMeshes.forEach((m) => { m.visible = false; });
    if (planes.rack) fr.ledges.forEach((l, i) => {
      let m = ledgeMeshes[i]; if (!m) { m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [trayWood, trayWood, trayWood, trayWood, brass, trayWood]); m.matrixAutoUpdate = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); ledgeMeshes[i] = m; }
      quadMatrix(l.q, planes.rack, -T0 * 0.05, T0 * 0.95, _M); m.matrix.copy(_M); m.matrixWorldNeedsUpdate = true; m.visible = true;
    });
    // props at the table's top corners (anchored by screen position so they stay in view at every size)
    props.visible = !(title && W > H * 1.1);
    { const lnd = W > H * 1.1, sq = H / W < 1.6, yy = title ? 0.805 : lnd ? 0.3 : sq ? 0.27 : 0.2, xx = title ? 0.085 : lnd ? 0.27 : sq ? 0.11 : 0.13, a = cast(W * xx, H * yy, feltPlane), b = cast(W * (1 - xx), H * yy, feltPlane); teaA.position.copy(a); teaA.rotation.y = 0.5; lokum.position.copy(b); lokum.rotation.y = -0.3; }

    // tiles
    let nTile = 0, nBlob = 0;
    for (const r of recs) {
      if (r.kind !== 'tile' && r.kind !== 'back' && r.kind !== 'letter') continue;
      const q = r.q;
      let plane = planes.table, onRack = false, lift = 0;
      if (r.kind === 'letter') plane = planes.hero;
      else if (r.plane === 'rack') { plane = planes.rack; onRack = true; lift = (r.lift || 0) * T0 * 0.9; }
      else if (r.plane === 'show') plane = planes.show;
      else if (r.plane === 'drag' && inRack(q) && planes.rack) { plane = planes.rack; onRack = true; lift = (r.lift || 0) * T0 * 0.9; }
      if (!plane) continue;
      const flat = plane === planes.table;
      if (flat) { _tp.constant = -(FELT_Y + T0 * 0.98 + (r.lift || 0) * T0 * 0.9); plane = _tp; }
      const mesh = tileMesh(nTile++), thick = r.kind === 'back' ? T0 * 0.8 : T0;
      const d = quadMatrix(q, plane, flat ? 0 : lift, thick, _M);
      mesh.matrix.copy(_M); mesh.matrixWorldNeedsUpdate = true; mesh.visible = true;
      let cap;
      if (r.kind === 'letter') cap = capMat('l', 100 + r.i, false, 0, { ch: r.ch, i: r.i });
      else if (r.kind === 'back') cap = capMat('b', 0, false, 0);
      else { const fake = r.id >= 104, k = fake ? -1 : r.id % 52, wild = !fake && r.okey && k === r.okey.key; cap = capMat(fake ? 'f' : 't', fake ? 104 : k, wild, r.dim); }
      if (mesh.material[0] !== cap) mesh.material = [cap, boneSide];
      if (flat && nBlob < 160) {        // a soft contact blob on the felt, bigger and offset when the tile is lifted
        const c = cast(...centre(q), flatPlane), hgt = (r.lift || 0) * T0 * 0.9, k = 1.4 + hgt * 0.1;
        _q.setFromRotationMatrix(_M.extractRotation(_M)); _p.set(c.x + 0.3 + hgt * 0.4, FELT_Y + 0.04, c.z + 0.4 + hgt * 0.5); _s.set(d.w * k, 1, d.h * k);
        blobs.setMatrixAt(nBlob++, _bm.compose(_p, _q, _s));
      }
    }
    for (let i = nTile; i < tilePool.length; i++) tilePool[i].visible = false;
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;

    // idle life: steam over the tea, the lamps breathe, light shafts drift
    steam.forEach((s, i) => { const ph = ((t * 0.35 + i / steam.length) % 1); s.position.set(Math.sin(i * 2.1 + t) * 0.5, 10 + ph * 7, Math.cos(i * 1.3) * 0.4); s.material.opacity = calm ? 0 : 0.34 * Math.sin(ph * Math.PI); s.scale.setScalar(1.8 + ph * 2.4); });
    const br = calm ? 1 : 0.94 + Math.sin(t * 2.2) * 0.04; lamps.forEach((l, i) => { l.userData.glow.material.opacity = br - i * 0.05; }); lampLight.intensity = 900 * br;
    shafts.forEach((s, i) => { s.material.opacity = calm ? 0.42 : 0.38 + Math.sin(t * 0.5 + i * 2) * 0.1; });

    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; v3.flatA = Math.max(0, 1 - fadeIn); }
    const sk = `${cssW()}x${cssH()}|${tier}`;
    if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(cssW(), cssH(), false); }
    scene.fog.near = cur.dist * 1.8; scene.fog.far = cur.dist * 6;
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; viewKey = ''; });

  const iconBokeh = [];
  let loseExt = null;
  await tick();
  placeCamera(); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true,
    renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; v3.flatA = 1; fadeIn = 0; viewKey = ''; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    iconPng(size = 2048) {          // offline store icon (scratch tool, never called in play): a set of three sevens and the gold okey on the felt
      for (const m of tilePool) m.visible = false; for (const m of trays) m.visible = false; for (const m of ledgeMeshes) m.visible = false; spots.forEach((o) => { o.visible = false; });
      floor.visible = false; if (!iconBokeh.length) { const cols = ['255,170,90', '255,120,60', '90,200,190', '255,210,120', '230,90,70', '120,170,255']; for (let i = 0; i < 14; i++) { const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(cols[i % 6], 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); b.position.set(-26 + i * 4.3 + ((i * 7) % 5), 5 + ((i * 11) % 9) * 1.4, -26 - (i % 3) * 4); b.scale.setScalar(5 + (i % 4) * 2.2); scene.add(b); iconBokeh.push(b); } }
      blobs.count = 0; chairs.forEach((c) => { c.visible = false; }); lamps.forEach((l) => { l.visible = false; }); room.visible = false; shafts.forEach((x) => { x.visible = false; });
      scene.fog.near = 1000; scene.fog.far = 3000; scene.background = new THREE.Color(0x07100f);
      buildTable(-40, 40, -40, 40, 8);
      buildMat([{ x: -30, z: -30 }, { x: 30, z: -30 }, { x: 30, z: 30 }, { x: -30, z: 30 }], 4); mat.felt.visible = true; mat.braid.visible = true; mat.felt.position.set(0, FELT_Y - 0.17, 0); mat.braid.position.set(0, FELT_Y - 0.05, 0);
      props.visible = false;
      const set = [[6, 0, 0], [19, 0, 0], [32, 0, 0], [45, 1, 0]];       // 7 red, 7 blue, 7 black, the gold okey in front
      const W = 3.0, Hh = 3.7, L = 16 * D2R;
      set.forEach(([id, wild], i) => {
        const x = i === 3 ? 0.4 : -4.2 + i * 4.2, z = i === 3 ? 3.6 : -1.2, a = i === 3 ? 0.1 : (1 - i) * 0.14;
        const n = new THREE.Vector3(Math.sin(a) * Math.cos(L) * 0, Math.sin(L), Math.cos(L)).normalize(), X = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)); n.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        const Y = new THREE.Vector3().crossVectors(n, X).normalize(), sc = i === 3 ? 1.38 : 1, w = W * sc, h = Hh * sc, T = T0 * sc;
        const C = new THREE.Vector3(x, FELT_Y + (h / 2) * Y.y + T * n.y * 0.5 + 0.05, z - T * n.z * 0.2);
        const mesh = tileMesh(i); mesh.matrix.makeBasis(X.clone().multiplyScalar(w), Y.clone().multiplyScalar(h), n.clone().multiplyScalar(T)).setPosition(C); mesh.matrixWorldNeedsUpdate = true; mesh.visible = true;
        mesh.material = [capMat('t', id % 52, !!wild, 0), boneSide];
      });
      key.position.set(-16, 30, 18); key.target.position.set(0, 1.5, 0); key.intensity = 520; key.angle = 0.9; key.penumbra = 1; key.target.updateMatrixWorld();
      lampLight.position.set(10, 20, -24); lampLight.intensity = 90; hemi.intensity = 0.06; fill.intensity = 0.08;
      applyTier(); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { near: 5, far: 120 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.radius = 2;
      renderer.setPixelRatio(1); renderer.setSize(size, size, false);
      camera.fov = 30; camera.aspect = 1; renderer.toneMappingExposure = 0.78; camera.position.set(0.8, 7.2, 21.5); camera.up.set(0, 1, 0); camera.lookAt(0.3, 2.3, 0.6); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png');
    },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return loseExt; },
    restoreContext() { loseExt?.restoreContext(); return loseExt; },
  };
}
