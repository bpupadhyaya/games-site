// The 3D world for O An Quan, all procedural (no bitmaps): a red-brown clay board with ten carved square pits and two big half-round
// mandarin pits, glazed pebbles with real thickness and polished mandarin stones, two shallow capture trays, laid on a woven sedge
// mat (chieu) on a village veranda in warm morning light: leaf shadows moving over the mat, a conical leaf hat, a tea set with steam,
// bamboo posts beyond. Units are centimetres, y is up, the board is centred on the origin and board unit (lx, ly) maps to
// world x = (lx - BW/2) * K, z = (ly - BH/2) * K (row of player 2 is at -z, the far side).
import * as THREE from '../vendor3d/three.js';
import { BW, BH, CELLS } from '../src/art.js';
import { TRAY } from '../src/v3.js';

export const K = 0.0645;                       // cm per board unit: the board is 44.9 x 24.1 cm
export const MAT_Y = 0.35, BASE_TOP = 1.75, TOP = 3.15;
export const wx = (lx) => (lx - BW / 2) * K;
export const wz = (ly) => (ly - BH / 2) * K;
const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const cnv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, aniso = 8) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
export const radialTex = (rgb = '255,255,255', a = 1) => { const c = cnv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c); };

// Two clay palettes (the game's two themes): lacquer = deep red-brown terracotta, bamboo = sun-baked ochre clay.
export const PAL = {
  lacquer: { clay: ['#a4502d', '#6e3019'], floor: '#6a2e18', slip: '#ecce92', slip2: '#c89a52', quan: '#2fae8a', quanHi: '#b9fbe3', gold: '#e8b650', dan: ['#f4ecd8', '#e2d6b8', '#cdbf9c', '#e9dfc4', '#b8c4b0'] },
  bamboo: { clay: ['#bd8650', '#8a5a31'], floor: '#7a5028', slip: '#f2e2b0', slip2: '#6fb494', quan: '#c7473c', quanHi: '#ffc2b6', gold: '#f2d27a', dan: ['#fbf5e4', '#ece2c8', '#d9ceb0', '#f2ead4', '#c7d6c4'] },
};
export const palOf = (id) => PAL[id] || PAL.lacquer;

// ------------------------------------------------------------------------------------------------ shapes of the pits
// Rounded rectangle in board units as a Shape in the (x, y) plane with y = -z (so after rotateX(-PI/2) it lies on the board).
function rrShape(x, y, w, h, r, sh = new THREE.Shape()) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  const X0 = wx(x), X1 = wx(x + w), Y1 = -wz(y), Y0 = -wz(y + h), k = K;
  sh.moveTo(X0 + bl * k, Y0); sh.lineTo(X1 - br * k, Y0);
  if (br) sh.absarc(X1 - br * k, Y0 + br * k, br * k, -Math.PI / 2, 0, false);
  sh.lineTo(X1, Y1 - tr * k);
  if (tr) sh.absarc(X1 - tr * k, Y1 - tr * k, tr * k, 0, Math.PI / 2, false);
  sh.lineTo(X0 + tl * k, Y1);
  if (tl) sh.absarc(X0 + tl * k, Y1 - tl * k, tl * k, Math.PI / 2, Math.PI, false);
  sh.lineTo(X0, Y0 + bl * k);
  if (bl) sh.absarc(X0 + bl * k, Y0 + bl * k, bl * k, Math.PI, Math.PI * 1.5, false);
  return sh;
}
export const pitRadii = (r) => (r.mand ? (r.cx < BW / 2 ? [64, 26, 26, 64] : [26, 64, 64, 26]) : 34);
export const pitShape = (i, grow = 0) => { const r = CELLS[i]; return rrShape(r.x + 4 - grow, r.y + 4 - grow, r.w - 8 + grow * 2, r.h - 8 + grow * 2, pitRadii(r)); };

function uvFromXZ(g, x0, z0, w, h) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - x0) / w; uv[i * 2 + 1] = 1 - (p.getZ(i) - z0) / h; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ------------------------------------------------------------------------------------------------ the board
function boardTexture(P, S) {
  const c = cnv(S, Math.round(S * BH / BW)), x = c.getContext('2d'), s = S / BW, r = rnd(7);
  const g = x.createLinearGradient(0, 0, c.width * 0.3, c.height); g.addColorStop(0, P.clay[0]); g.addColorStop(1, P.clay[1]);
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) { // mottling: uneven firing
    const px = r() * c.width, py = r() * c.height, rad = (25 + r() * 90) * s, light = r() < 0.5;
    const gg = x.createRadialGradient(px, py, 0, px, py, rad); gg.addColorStop(0, light ? `rgba(255,200,150,${0.05 + r() * 0.06})` : `rgba(40,10,0,${0.06 + r() * 0.08})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? `rgba(255,220,180,${0.05 + r() * 0.12})` : `rgba(30,8,0,${0.06 + r() * 0.14})`; const q = (0.25 + r() * 0.8) * s; x.fillRect(r() * c.width, r() * c.height, q, q); }
  x.save(); x.scale(s, s); x.lineCap = 'round'; x.lineJoin = 'round';
  // incised border: two rules in light slip
  x.strokeStyle = P.slip; x.globalAlpha = 0.85; x.lineWidth = 2.4; x.beginPath(); x.roundRect(5, 5, BW - 10, BH - 10, 24); x.stroke();
  x.globalAlpha = 0.45; x.lineWidth = 1.1; x.beginPath(); x.roundRect(9.5, 9.5, BW - 19, BH - 19, 20); x.stroke();
  // the river between the two rows, with a diamond at every square boundary
  const ry = 14 + 170 + 3, x0 = 14 + 96 + 4, w = BW - 2 * x0, cw = w / 5;
  x.globalAlpha = 0.9; x.lineWidth = 2.4; x.beginPath(); x.moveTo(x0 + 6, ry); x.lineTo(BW - x0 - 6, ry); x.stroke();
  x.fillStyle = P.slip;
  for (let i = 0; i <= 5; i++) { const dx = x0 + i * cw; x.beginPath(); x.moveTo(dx, ry - 5.5); x.lineTo(dx + 5.5, ry); x.lineTo(dx, ry + 5.5); x.lineTo(dx - 5.5, ry); x.closePath(); x.fill(); }
  // slip ring around the two mandarin pits
  for (const i of [0, 6]) { const q = CELLS[i], l = q.cx < BW / 2; x.strokeStyle = P.slip2; x.globalAlpha = 0.95; x.lineWidth = 3; x.beginPath(); x.roundRect(q.x - 3, q.y - 3, q.w + 6, q.h + 6, l ? [72, 32, 32, 72] : [32, 72, 72, 32]); x.stroke(); }
  // Dong Son style concentric circles in the four corners
  x.globalAlpha = 0.9; x.strokeStyle = P.slip;
  for (const [cx, cy] of [[10, 10], [BW - 10, 10], [10, BH - 10], [BW - 10, BH - 10]]) { x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, 5.2, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, 2.6, 0, 7); x.stroke(); x.fillStyle = P.slip; x.beginPath(); x.arc(cx, cy, 0.9, 0, 7); x.fill(); }
  x.restore();
  return tex(c, true, 8);
}
function noiseTex() { const c = cnv(256), x = c.getContext('2d'), r = rnd(3); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 5000; i++) { const v = 90 + Math.floor(r() * 90); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); } const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 4); return t; }

export function buildBoard(themeId, texSize) {
  const P = palOf(themeId), g = new THREE.Group(), disp = [];
  const map = boardTexture(P, texSize), bump = noiseTex(); disp.push(map, bump);
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.35, roughness: 0.62, metalness: 0.02 }); disp.push(mat);
  const bev = { bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.16, bevelSegments: 3, curveSegments: 14 };
  const mk = (shape, y0, h) => { const geo = new THREE.ExtrudeGeometry(shape, { ...bev, depth: h - 0.32 }); geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + 0.16, 0); uvFromXZ(geo, -BW * K / 2, -BH * K / 2, BW * K, BH * K); disp.push(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  g.add(mk(rrShape(0, 0, BW, BH, 28), MAT_Y, BASE_TOP - MAT_Y));
  const top = rrShape(0, 0, BW, BH, 28);
  for (let i = 0; i < 12; i++) top.holes.push(pitShape(i));
  g.add(mk(top, BASE_TOP, TOP - BASE_TOP));
  // pit floors: darker fired clay with soft occlusion at the walls
  const ao = cnv(128), a = ao.getContext('2d'), gr = a.createRadialGradient(64, 64, 12, 64, 64, 66); gr.addColorStop(0, 'rgba(255,170,110,0.16)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.0)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); a.fillStyle = P.floor; a.fillRect(0, 0, 128, 128); a.fillStyle = gr; a.fillRect(0, 0, 128, 128);
  const aoT = tex(ao); disp.push(aoT);
  const fm = new THREE.MeshStandardMaterial({ map: aoT, roughness: 0.85 }); disp.push(fm);
  for (let i = 0; i < 12; i++) {
    const geo = new THREE.ShapeGeometry(pitShape(i, -1), 14); geo.rotateX(-Math.PI / 2); geo.translate(0, BASE_TOP + 0.04, 0);
    const bb = new THREE.Box3().setFromBufferAttribute(geo.attributes.position); uvFromXZ(geo, bb.min.x, bb.min.z, bb.max.x - bb.min.x, bb.max.z - bb.min.z); disp.push(geo);
    const m = new THREE.Mesh(geo, fm); m.receiveShadow = true; g.add(m);
  }
  g.userData.dispose = () => { disp.forEach((d) => d.dispose && d.dispose()); };
  return g;
}

// Glowing outline + soft fill of a pit, one pair per square: additive, lying on the clay around the pit.
export function buildMarks() {
  const out = [];
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  for (let i = 0; i < 12; i++) {
    const outer = pitShape(i, 5), inner = pitShape(i, -1); outer.holes.push(inner);
    // ring = outer minus pit (an even-odd band around the opening)
    const rg = new THREE.ShapeGeometry(outer, 14); rg.rotateX(-Math.PI / 2);
    const fg = new THREE.ShapeGeometry(pitShape(i, 0), 14); fg.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(rg, ringMat()), fill = new THREE.Mesh(fg, ringMat());
    ring.position.y = TOP + 0.06; fill.position.y = BASE_TOP + 0.09; ring.renderOrder = 3; fill.renderOrder = 3; ring.visible = fill.visible = false;
    out.push({ ring, fill });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ stones
function pebble(seed) {
  const g = new THREE.SphereGeometry(1, 28, 20), p = g.attributes.position, r = rnd(seed * 97 + 5), ph = [r() * 6, r() * 6, r() * 6];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.07 * Math.sin(x * 2.3 + ph[0]) * Math.cos(z * 2.1 + ph[1]) + 0.05 * Math.sin(y * 3 + ph[2] + x);
    x *= n * (1 + (seed % 3) * 0.05); z *= n; y *= n * 0.66; if (y < 0) y *= 0.78;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}
export const PEB_H = 0.66;                       // half height of a unit pebble
export function pieceKit(themeId) {
  const P = palOf(themeId), geos = [pebble(1), pebble(2), pebble(3)];
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.46, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  const pts = [[0, 0], [2.2, 0], [2.32, 0.25], [2.18, 0.95], [1.72, 1.5], [1.0, 1.85], [0.36, 2.0], [0, 2.02]].map(([x, y]) => new THREE.Vector2(x, y));
  const qBody = new THREE.LatheGeometry(pts, 56);
  const qMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(P.quan), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.gold), roughness: 0.28, metalness: 0.9 });
  const ringG = new THREE.TorusGeometry(2.3, 0.2, 10, 56); ringG.rotateX(Math.PI / 2); ringG.translate(0, 0.26, 0);
  const knobG = new THREE.SphereGeometry(0.36, 16, 12); knobG.translate(0, 2.05, 0);
  const band = new THREE.TorusGeometry(1.9, 0.08, 8, 48); band.rotateX(Math.PI / 2); band.translate(0, 1.2, 0);
  return { geos, mat, qBody, qMat, gold, ringG, knobG, band, setTheme(id) { const Q = palOf(id); qMat.color.set(Q.quan); gold.color.set(Q.gold); } };
}
export const stoneColors = (themeId) => palOf(themeId).dan.map((h) => new THREE.Color(h).multiplyScalar(0.66));

// ------------------------------------------------------------------------------------------------ trays
export function buildTray(themeId, who) {
  const P = palOf(themeId), g = new THREE.Group(), y0 = (who === 2 ? -(TRAY.gap + TRAY.h) : TRAY.bh + TRAY.gap);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.clay[1]).multiplyScalar(0.95), roughness: 0.66 });
  const sh = rrShape(0, y0, BW, TRAY.h, 26); sh.holes.push(rrShape(12, y0 + 12, BW - 24, TRAY.h - 24, 18));
  const bev = { bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 2, curveSegments: 10 };
  const rim = new THREE.ExtrudeGeometry(sh, { depth: 1.2, ...bev }), base = new THREE.ExtrudeGeometry(rrShape(0, y0, BW, TRAY.h, 26), { depth: 0.5, ...bev });
  for (const [geo, y] of [[base, MAT_Y], [rim, MAT_Y + 0.62]]) { geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.userData.floor = MAT_Y + 0.9;
  g.userData.dispose = () => { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); mat.dispose(); };
  return g;
}

// ------------------------------------------------------------------------------------------------ lights
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x7a4a2a, 0.32); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a0, 3.1); sun.position.set(-55, 85, 55);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.near = 20; sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xa9c2ff, 0.45); fill.position.set(70, 50, -40); scene.add(fill);
  return { hemi, sun, fill };
}

// ------------------------------------------------------------------------------------------------ the veranda
function matTexture() {
  const W = 1536, H = 1024, c = cnv(W, H), x = c.getContext('2d'), r = rnd(21), pxcm = W / 120;
  x.fillStyle = '#d8c088'; x.fillRect(0, 0, W, H);
  const st = pxcm * 0.55;
  for (let j = 0; j * st < H; j++) for (let i = 0; i * st < W; i++) {
    const over = (i + j) % 4 < 2, v = (r() - 0.5) * 22;
    x.fillStyle = `rgb(${(over ? 224 : 196) + v},${(over ? 202 : 172) + v},${(over ? 146 : 118) + v})`;
    if (over) x.fillRect(i * st, j * st, st * 1.02, st * 0.5); else x.fillRect(i * st, j * st + st * 0.5, st * 0.5, st * 0.5);
  }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(90,60,20,${r() * 0.1})`; x.fillRect(r() * W, r() * H, 1 + r() * 14, 1); }
  const stripe = (off, wd, col) => { x.fillStyle = col; x.globalAlpha = 0.92; x.fillRect(off, 0, wd, H); x.fillRect(W - off - wd, 0, wd, H); x.fillRect(0, off * 0.75, W, wd * 0.75); x.fillRect(0, H - off * 0.75 - wd * 0.75, W, wd * 0.75); x.globalAlpha = 1; };
  stripe(pxcm * 5, pxcm * 2.4, '#a4261e'); stripe(pxcm * 8.2, pxcm * 0.9, '#2d6a44'); stripe(0, pxcm * 1.0, '#5c1612');
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 2, 2 + r() * 8); }
  return tex(c, true, 8);
}
function floorTexture() {
  const W = 1024, c = cnv(W), x = c.getContext('2d'), r = rnd(33), pl = W / 10;
  for (let j = 0; j < 10; j++) {
    const v = 0.85 + r() * 0.3; x.fillStyle = `rgb(${Math.round(112 * v)},${Math.round(72 * v)},${Math.round(40 * v)})`; x.fillRect(0, j * pl, W, pl);
    for (let k = 0; k < 26; k++) { x.strokeStyle = `rgba(30,12,0,${0.08 + r() * 0.12})`; x.lineWidth = 0.8 + r() * 1.6; x.beginPath(); const y0 = j * pl + r() * pl; x.moveTo(0, y0); for (let xx = 0; xx <= W; xx += 64) x.lineTo(xx, y0 + Math.sin(xx / 90 + k) * 3); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, j * pl, W, 3); x.fillStyle = 'rgba(255,220,170,0.08)'; x.fillRect(0, j * pl + 3, W, 2);
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(((j * 3.7) % 1) * W, j * pl, 3, pl);
  }
  const t = tex(c, true, 8); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function leafShadowTexture() {
  const c = cnv(1024, 768), x = c.getContext('2d'), r = rnd(5);
  x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 1024, 768); x.fillStyle = '#000';
  const leaf = (cx, cy, len, wid, ang) => {
    x.save(); x.translate(cx, cy); x.rotate(ang); x.beginPath(); x.moveTo(-len / 2, 0); x.bezierCurveTo(-len * 0.2, -wid, len * 0.3, -wid * 0.9, len / 2, 0); x.bezierCurveTo(len * 0.3, wid * 0.9, -len * 0.2, wid, -len / 2, 0); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(-len / 2, 0); x.lineTo(len / 2, 0); x.stroke();
    for (let k = -4; k <= 4; k++) { if (!k) continue; x.beginPath(); x.moveTo(k * len / 10, 0); x.lineTo(k * len / 10 + 14, wid * 0.8 * Math.sign(k + 0.1)); x.lineWidth = 1.6; x.stroke(); }
    x.restore(); x.globalCompositeOperation = 'source-over';
  };
  for (let i = 0; i < 22; i++) leaf(80 + r() * 860, 40 + r() * 680, 150 + r() * 130, 24 + r() * 16, r() * 6.28);
  x.filter = 'blur(3px)'; x.drawImage(c, 0, 0); x.filter = 'none';
  const t = tex(c, true, 4); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function strawTexture() {
  const c = cnv(512, 256), x = c.getContext('2d'), r = rnd(9);
  x.fillStyle = '#d8bf86'; x.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 5) { x.fillStyle = y % 10 ? 'rgba(120,80,30,0.16)' : 'rgba(255,240,190,0.18)'; x.fillRect(0, y, 512, 2); }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(90,60,20,${r() * 0.16})`; x.fillRect(r() * 512, r() * 256, 1 + r() * 20, 1); }
  const t = tex(c, true, 4); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
}
function bambooTexture() {
  const c = cnv(128, 512), x = c.getContext('2d'), r = rnd(12), g = x.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, '#8d9a3c'); g.addColorStop(0.35, '#c9c060'); g.addColorStop(0.65, '#a8a548'); g.addColorStop(1, '#5d6a26'); x.fillStyle = g; x.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(40,50,10,${r() * 0.12})`; x.fillRect(r() * 128, r() * 512, 1, 6 + r() * 30); }
  for (const y of [90, 270, 440]) { x.fillStyle = 'rgba(50,40,10,0.55)'; x.fillRect(0, y, 128, 5); x.fillStyle = 'rgba(255,255,200,0.2)'; x.fillRect(0, y + 5, 128, 3); }
  return tex(c, true, 4);
}

export function buildSet(scene, tierShadow) {
  const g = new THREE.Group(), anim = {};
  // sedge mat with binding
  const mat = new THREE.Mesh(new THREE.BoxGeometry(120, 0.35, 80), new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.95, color: 0xc9b8a0 })); mat.position.set(0, MAT_Y / 2, 0); mat.receiveShadow = true; g.add(mat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.2; floor.receiveShadow = true; g.add(floor);
  // moving leaf shadows over the mat
  const lt = leafShadowTexture(); const leaves = new THREE.Mesh(new THREE.PlaneGeometry(130, 98), new THREE.MeshBasicMaterial({ map: lt, transparent: true, opacity: 0.2, depthWrite: false, color: 0x1a0c00 })); leaves.rotation.x = -Math.PI / 2; leaves.position.y = MAT_Y + 0.02; leaves.renderOrder = 1; g.add(leaves); anim.leaves = lt;
  // conical leaf hat (non la)
  const st = strawTexture(), hat = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 15, 6.4, 72, 1, true), new THREE.MeshStandardMaterial({ map: st, roughness: 0.85, side: THREE.DoubleSide })); cone.position.y = 3.2; cone.castShadow = true; cone.receiveShadow = true; hat.add(cone);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(15, 0.28, 8, 72), new THREE.MeshStandardMaterial({ color: 0x6b3f1c, roughness: 0.7 })); rimT.rotation.x = Math.PI / 2; rimT.position.y = 0.2; hat.add(rimT);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.2, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xa3261e, roughness: 0.6 })); strap.position.set(0, 2.2, 6.6); strap.rotation.set(0.3, 0, Math.PI); hat.add(strap);
  hat.position.set(-47, MAT_Y, 13); hat.rotation.set(0.0, 0.5, 0); g.add(hat);
  // tea set on a bamboo tray: pot, two cups, steam
  const ts = new THREE.Group(); ts.position.set(47, MAT_Y, -17);
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.8, 0.7, 40), new THREE.MeshStandardMaterial({ map: strawTexture(), color: 0xc9a05c, roughness: 0.7 })); tray.position.y = 0.35; tray.castShadow = true; tray.receiveShadow = true; ts.add(tray);
  const glaze = new THREE.MeshPhysicalMaterial({ color: 0x5a3320, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  const potP = [[0, 0], [2.4, 0], [3.3, 1.2], [3.5, 2.6], [3.0, 3.9], [1.5, 4.5], [1.1, 4.9], [0, 4.9]].map(([a, b]) => new THREE.Vector2(a, b));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potP, 36), glaze); pot.position.set(-1.5, 0.7, 0.8); pot.castShadow = true; ts.add(pot);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 3.2, 12), glaze); spout.position.set(2.2, 3.1, 0.8); spout.rotation.z = -0.9; spout.castShadow = true; ts.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.32, 8, 20, Math.PI), glaze); handle.position.set(-4.6, 3.6, 0.8); handle.rotation.z = Math.PI * 0.55; handle.castShadow = true; ts.add(handle);
  const cupP = [[0, 0], [0.9, 0], [1.6, 0.3], [2.0, 1.4], [2.15, 2.3], [2.05, 2.3], [1.9, 1.5], [1.4, 0.55], [0, 0.45]].map(([a, b]) => new THREE.Vector2(a, b));
  [[3.2, 5.6], [-0.5, 6.4]].forEach(([cx, cz]) => { const cup = new THREE.Mesh(new THREE.LatheGeometry(cupP, 28), new THREE.MeshPhysicalMaterial({ color: 0xeee2c6, roughness: 0.25, clearcoat: 1, side: THREE.DoubleSide })); cup.position.set(cx, 0.7, cz); cup.castShadow = true; ts.add(cup); });
  g.add(ts);
  const steamT = radialTex('255,250,240', 0.8); anim.steam = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamT, transparent: true, depthWrite: false, opacity: 0, fog: true })); s.userData = { ph: i / 5 }; s.position.set(47 + 3.3, MAT_Y + 6, -16); g.add(s); anim.steam.push(s); }
  // bamboo posts and a rail beyond the mat
  const bt = bambooTexture(), bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.55 });
  for (const px of [-140, -50, 40, 130]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 150, 18), bm); p.position.set(px, 70, -150); p.castShadow = false; g.add(p); }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 300, 16), bm); rail.rotation.z = Math.PI / 2; rail.position.set(0, 42, -150); g.add(rail);
  const rail2 = rail.clone(); rail2.position.y = 8; g.add(rail2);
  // dust motes in the sunbeam
  const N = 70, pos = new Float32Array(N * 3), r = rnd(41); anim.motes = { base: new Float32Array(N * 3), N };
  for (let i = 0; i < N; i++) { anim.motes.base[i * 3] = (r() - 0.5) * 110; anim.motes.base[i * 3 + 1] = 2 + r() * 34; anim.motes.base[i * 3 + 2] = (r() - 0.5) * 70; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: radialTex('255,230,170', 1), size: 1.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false })); pts.frustumCulled = false; g.add(pts); anim.pts = pts;
  g.userData.update = (t) => {
    anim.leaves.offset.set(Math.sin(t * 0.21) * 0.012, Math.cos(t * 0.17) * 0.01); anim.leaves.needsUpdate = false;
    leaves.material.opacity = 0.17 + 0.04 * Math.sin(t * 0.6);
    for (const s of anim.steam) { const f = (t * 0.22 + s.userData.ph) % 1; s.position.set(50.3 + Math.sin(t * 0.7 + s.userData.ph * 9) * 0.5 * f, MAT_Y + 6 + f * 9, -16 + f * 0.8); const sc = 1.6 + f * 3.6; s.scale.set(sc, sc, 1); s.material.opacity = 0.34 * Math.sin(f * Math.PI) * (1 - f * 0.4); }
    const p = anim.pts.geometry.attributes.position, b = anim.motes.base;
    for (let i = 0; i < anim.motes.N; i++) { p.setXYZ(i, b[i * 3] + Math.sin(t * 0.15 + i) * 2.5, b[i * 3 + 1] + ((t * 0.9 + i * 3.1) % 34) * 0.12 + Math.sin(t * 0.4 + i * 2) * 0.8, b[i * 3 + 2] + Math.cos(t * 0.12 + i * 1.7) * 2.5); }
    p.needsUpdate = true;
  };
  void tierShadow;
  return g;
}
