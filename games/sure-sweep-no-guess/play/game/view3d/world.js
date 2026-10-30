// Sure Sweep 3D world: a navigator's chart desk. Everything is procedural (no bitmaps): a walnut tile tray with a brass-capped
// frame and a lattice of wells, glazed ceramic tiles, enamel-printed numbers, brass flag pins with cloth pennants, iron sea mines
// with brass horns, a nautical chart under the tray on a tooled leather desk, a brass compass, dividers and a pencil.
// Units are centimetres, y up. The board is centred on the origin, column -> +x, row -> +z (towards the player).
import * as THREE from '../vendor3d/three.js';

export const C = 4;            // cell pitch
export const TILE = 3.62;      // tile width incl. bevel
export const TILE_H = 1.35;    // tile height
export const BAR_H = 0.42;     // lattice bar height between the wells
export const MARGIN = 0.55;    // floor margin between the outer wells and the frame
export const FRAME_W = 2.6;    // frame width
export const FRAME_H = 1.75;   // frame top above the floor
export const BASE = 1.1;       // tray base below the floor (the desk is at y = -BASE)
export const half = (n) => (n * C) / 2 + MARGIN;           // half inner size
export const outer = (n) => half(n) + FRAME_W;            // half outer size
export const cellPos = (n, i) => { const c = i % n, r = (i - c) / n; return { x: (c - (n - 1) / 2) * C, z: (r - (n - 1) / 2) * C }; };

const FONT = '"Fredoka", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// merge non-indexed copies of several geometries (position, normal, uv)
export function merge(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += c;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return m;
}
const roundRect = (w, h, r) => {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y); return s;
};
// an extruded rounded block standing on y = 0 (extrusion goes up)
function block(w, d, h, r, bevel) {
  const g = new THREE.ExtrudeGeometry(roundRect(w - bevel * 2, d - bevel * 2, Math.max(0.05, r - bevel)), { depth: Math.max(0.01, h - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- textures
function woodTex(base, dark, w = 512, h = 512, seed = 3, rings = 26) {
  const c = canvas(w, h), x = c.getContext('2d'), R = rnd(seed);
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < rings * 6; i++) {
    const y0 = R() * h, a = 0.04 + R() * 0.1, lw = 0.5 + R() * 2.2;
    x.strokeStyle = `rgba(${dark},${a})`; x.lineWidth = lw; x.beginPath();
    for (let px = 0; px <= w; px += 16) x.lineTo(px, y0 + Math.sin(px * 0.012 + i) * 6 + Math.sin(px * 0.05 + i * 3) * 1.5);
    x.stroke();
  }
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${dark},${0.05 * R()})`; x.fillRect(R() * w, R() * h, 1 + R() * 6, 1); }
  return c;
}
// leather desk with a gold-tooled border, centred on the board
function leatherTex(col) {
  const s = 1024, c = canvas(s), x = c.getContext('2d'), R = rnd(17);
  x.fillStyle = col; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 9000; i++) { const v = R(); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.025 * R()})` : `rgba(0,0,0,${0.06 * R()})`; x.beginPath(); x.arc(R() * s, R() * s, 0.6 + R() * 2.2, 0, 7); x.fill(); }
  const g = x.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.72); g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  x.strokeStyle = 'rgba(214,170,84,0.75)'; x.lineWidth = 4; x.strokeRect(70, 70, s - 140, s - 140);
  x.strokeStyle = 'rgba(214,170,84,0.45)'; x.lineWidth = 1.5; x.strokeRect(84, 84, s - 168, s - 168);
  for (const [px, py] of [[70, 70], [s - 70, 70], [70, s - 70], [s - 70, s - 70]]) { x.fillStyle = 'rgba(214,170,84,0.7)'; x.save(); x.translate(px, py); x.rotate(Math.PI / 4); x.fillRect(-9, -9, 18, 18); x.restore(); }
  return c;
}
// a nautical chart: paper, graticule, depth contours, soundings and a compass rose
function chartTex() {
  const s = 1024, c = canvas(s), x = c.getContext('2d'), R = rnd(29);
  const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#efe3c4'); g.addColorStop(1, '#e2d1a8'); x.fillStyle = g; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(120,90,40,${0.05 * R()})`; x.fillRect(R() * s, R() * s, 1 + R() * 3, 1 + R() * 3); }
  x.strokeStyle = 'rgba(40,90,110,0.35)'; x.lineWidth = 1.2;
  for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * s / 8, 0); x.lineTo(i * s / 8, s); x.moveTo(0, i * s / 8); x.lineTo(s, i * s / 8); x.stroke(); }
  // shallow-water tint and contours around an island in one corner
  for (let k = 0; k < 9; k++) {
    x.beginPath(); const r0 = 90 + k * 34;
    for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2, r = r0 + Math.sin(t * 3 + k) * 14 + Math.sin(t * 7) * 6; x.lineTo(110 + Math.cos(t) * r, 120 + Math.sin(t) * r * 0.8); }
    x.closePath(); if (k < 3) { x.fillStyle = `rgba(110,170,180,${0.18 - k * 0.05})`; x.fill(); } x.strokeStyle = `rgba(40,100,120,${0.4 - k * 0.03})`; x.lineWidth = k === 0 ? 2.5 : 1; x.stroke();
  }
  x.fillStyle = '#c8b27a'; x.beginPath(); for (let a = 0; a <= 32; a++) { const t = (a / 32) * Math.PI * 2, r = 60 + Math.sin(t * 4) * 10; x.lineTo(110 + Math.cos(t) * r, 120 + Math.sin(t) * r * 0.8); } x.fill();
  x.fillStyle = 'rgba(40,80,100,0.55)'; x.font = '500 15px serif';
  for (let i = 0; i < 70; i++) x.fillText(String(3 + Math.floor(R() * 40)), R() * s, R() * s);
  // compass rose (bottom right)
  x.save(); x.translate(s * 0.8, s * 0.8); x.strokeStyle = 'rgba(120,40,40,0.55)'; x.lineWidth = 2;
  for (const r of [110, 96, 60]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, l = i % 8 === 0 ? 0 : i % 4 === 0 ? 20 : 8; x.beginPath(); x.moveTo(Math.cos(a) * 96, Math.sin(a) * 96); x.lineTo(Math.cos(a) * (110 - (i % 2 ? 6 : 0)), Math.sin(a) * (110 - (i % 2 ? 6 : 0))); x.stroke(); void l; }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, L = i % 2 ? 58 : 100; x.fillStyle = i % 2 ? 'rgba(40,80,100,0.6)' : 'rgba(150,40,40,0.65)'; x.beginPath(); x.moveTo(Math.cos(a) * L, Math.sin(a) * L); x.lineTo(Math.cos(a + 0.35) * 16, Math.sin(a + 0.35) * 16); x.lineTo(Math.cos(a - 0.35) * 16, Math.sin(a - 0.35) * 16); x.fill(); }
  x.restore();
  // a dashed course line
  x.setLineDash([14, 10]); x.strokeStyle = 'rgba(160,50,40,0.6)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(260, 240); x.lineTo(700, 520); x.lineTo(900, 980); x.stroke(); x.setLineDash([]);
  // worn edges
  const e = x.createRadialGradient(s / 2, s / 2, s * 0.35, s / 2, s / 2, s * 0.75); e.addColorStop(0, 'rgba(90,60,20,0)'); e.addColorStop(1, 'rgba(90,60,20,0.35)'); x.fillStyle = e; x.fillRect(0, 0, s, s);
  return c;
}
// the well floor: paper grain (grey, multiplied by the theme's cell colour) with a soft shade under each lattice bar
function floorTex(n) {
  const px = 64, s = n * px + 2 * Math.round((MARGIN / C) * px), c = canvas(s), x = c.getContext('2d'), R = rnd(5 + n), m = (s - n * px) / 2;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < s * s / 60; i++) { x.fillStyle = `rgba(110,90,60,${0.05 * R()})`; x.fillRect(R() * s, R() * s, 1 + R() * 2, 1 + R() * 2); }
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
    const gx = m + q * px, gy = m + r * px;
    const g = x.createLinearGradient(0, gy, 0, gy + px * 0.3); g.addColorStop(0, 'rgba(60,40,20,0.30)'); g.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = g; x.fillRect(gx, gy, px, px * 0.3);
    const h = x.createLinearGradient(gx, 0, gx + px * 0.18, 0); h.addColorStop(0, 'rgba(60,40,20,0.18)'); h.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = h; x.fillRect(gx, gy, px * 0.18, px);
  }
  return c;
}
export function radialTex(rgb, a = 1, s = 128) {
  const c = canvas(s), x = c.getContext('2d'), g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.55})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, s, s); return tex(c);
}
// a rounded-square ring of light (hints) and a circle ring (Auto Play's chosen move)
export function ringTex(round = false) {
  const s = 128, c = canvas(s), x = c.getContext('2d');
  x.strokeStyle = '#fff'; x.shadowColor = '#fff';
  for (const [lw, blur, a] of [[16, 14, 0.45], [7, 4, 1]]) {
    x.globalAlpha = a; x.lineWidth = lw; x.shadowBlur = blur; x.beginPath();
    if (round) x.arc(s / 2, s / 2, s * 0.4, 0, 7); else x.roundRect(s * 0.13, s * 0.13, s * 0.74, s * 0.74, s * 0.14);
    x.stroke();
  }
  return tex(c);
}
// a soft-edged rounded square (the opened cell that held the mine is stained red)
export function cellTex() {
  const s = 128, c = canvas(s), x = c.getContext('2d');
  x.filter = 'blur(3px)'; x.fillStyle = '#fff'; x.beginPath(); x.roundRect(s * 0.08, s * 0.08, s * 0.84, s * 0.84, s * 0.12); x.fill();
  return tex(c);
}
// digits 1..8 (+ index 9 = a red cross for a wrong flag) in one row: white glyph, coloured by the material
export function digitAtlas() {
  const w = 128, c = canvas(w * 10, w), x = c.getContext('2d');
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${w * 0.86}px ${FONT}`; x.fillStyle = '#fff';
  for (let d = 1; d <= 8; d++) x.fillText(String(d), d * w + w / 2, w * 0.54);
  x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineWidth = w * 0.13;
  x.beginPath(); x.moveTo(9 * w + w * 0.22, w * 0.22); x.lineTo(9 * w + w * 0.78, w * 0.78); x.moveTo(9 * w + w * 0.78, w * 0.22); x.lineTo(9 * w + w * 0.22, w * 0.78); x.stroke();
  const t = tex(c); t.anisotropy = 8; return t;
}
export function digitGeo(d, size) {
  const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (d + uv.getX(i)) / 10);
  return g;
}

// ---------------------------------------------------------------- pieces
export function tileGeo() { return block(TILE, TILE, TILE_H, 0.62, 0.3); }
export function tileMat() {
  return new THREE.MeshPhysicalMaterial({ color: 0x2fc7bd, roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
}
export function mineGeo(r = 1.2) {
  const parts = [new THREE.SphereGeometry(r, 28, 20)];
  const dirs = [];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; dirs.push([Math.cos(a), 0.12, Math.sin(a)]); }
  dirs.push([0, 1, 0], [0.5, 0.75, 0.43], [-0.5, 0.75, -0.43], [0.45, -0.6, -0.5], [-0.45, -0.6, 0.5]);
  for (const d of dirs) {
    const v = new THREE.Vector3(...d).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    const h = new THREE.CylinderGeometry(r * 0.1, r * 0.16, r * 0.5, 10); h.translate(0, r * 1.08, 0); h.applyQuaternion(q);
    const cap = new THREE.SphereGeometry(r * 0.15, 10, 8); cap.translate(0, r * 1.34, 0); cap.applyQuaternion(q);
    parts.push(h, cap);
  }
  return merge(parts);
}
export function mineMat() { return new THREE.MeshPhysicalMaterial({ color: 0x252c33, roughness: 0.42, metalness: 0.75, clearcoat: 0.3, clearcoatRoughness: 0.4 }); }
export const brassMat = () => new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.28, metalness: 1 });
export function bandGeo(r = 1.2) { const g = new THREE.TorusGeometry(r * 1.0, r * 0.07, 8, 40); g.rotateX(Math.PI / 2); return g; }
// flag: brass foot + pole (one geometry), pennant (separate, coloured) - local origin at the foot centre on the tile top
export function flagGeos() {
  const foot = new THREE.CylinderGeometry(0.58, 0.68, 0.22, 24); foot.translate(0, 0.11, 0);
  const knob = new THREE.SphereGeometry(0.16, 10, 8); knob.translate(-0.42, 3.05, 0);
  const pole = new THREE.CylinderGeometry(0.075, 0.09, 2.9, 10); pole.translate(-0.42, 1.55, 0);
  const metal = merge([foot, pole, knob]);
  // pennant: a gently curved cloth triangle, hinged on the pole (x = 0 at the pole)
  const pts = [], uv = [], cols = 10, rows = 4, L = 2.6, H = 1.75;
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) { const u = i / cols, v = j / rows; pts.push(u * L, (1 - u) * (v - 0.5) * H - u * 0.25, 0); uv.push(u, v); }
  const idx = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const a = i * (rows + 1) + j, b = a + rows + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const pen = new THREE.BufferGeometry(); pen.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); pen.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pen.setIndex(idx);
  pen.userData.base = pts.slice();
  pen.computeVertexNormals();
  return { metal, pen };
}
export const clothMat = () => new THREE.MeshStandardMaterial({ color: 0xd8312c, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });

// ---------------------------------------------------------------- the tray (one per board size)
export function buildTray(n) {
  const g = new THREE.Group(), H = half(n), O = outer(n);
  const wood = tex(woodTex('#5a3420', '30,14,6', 1024, 256, 7)); wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  const frameMat = new THREE.MeshPhysicalMaterial({ map: wood, color: 0xffffff, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  // frame: four mitred rails (extruded rounded blocks) standing on the desk
  const railL = O * 2, railW = FRAME_W + 0.15;
  const rails = [];
  for (let k = 0; k < 4; k++) {
    const r = block(railL, railW, FRAME_H + BASE, 0.45, 0.35); r.translate(0, -BASE, -(H + FRAME_W / 2));
    r.rotateY((k * Math.PI) / 2); rails.push(r);
  }
  const frame = new THREE.Mesh(merge(rails), frameMat); frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
  // floor (the paper of the wells) - its colour is the theme's opened-cell colour
  const floorMap = tex(floorTex(n));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(H * 2 + 0.02, BASE, H * 2 + 0.02), [0, 0, new THREE.MeshStandardMaterial({ map: floorMap, color: 0xf6ecd2, roughness: 0.88 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x3a2214 })));
  floor.position.y = -BASE / 2; floor.receiveShadow = true; g.add(floor);
  // lattice of thin walnut bars between the wells
  const bars = [], bw = C - TILE - 0.06;
  for (let i = 0; i <= n; i++) {
    const p = (i - n / 2) * C, L = n * C + bw;
    const a = new THREE.BoxGeometry(L, BAR_H, bw); a.translate(0, BAR_H / 2, p); bars.push(a);
    const b = new THREE.BoxGeometry(bw, BAR_H, L); b.translate(p, BAR_H / 2, 0); bars.push(b);
  }
  const lattice = new THREE.Mesh(merge(bars), new THREE.MeshStandardMaterial({ color: 0x4a2a17, roughness: 0.55 })); lattice.receiveShadow = true; lattice.castShadow = false; g.add(lattice);
  // brass corner caps and a brass inlay line on the rail tops
  const brass = brassMat(), caps = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cap = block(FRAME_W + 0.9, FRAME_W + 0.9, 0.3, 0.5, 0.1); cap.translate(sx * (O - FRAME_W / 2 + 0.05), FRAME_H - 0.02, sz * (O - FRAME_W / 2 + 0.05)); caps.push(cap);
    const stud = new THREE.SphereGeometry(0.32, 12, 8); stud.scale(1, 0.5, 1); stud.translate(sx * (O - FRAME_W / 2 + 0.05), FRAME_H + 0.28, sz * (O - FRAME_W / 2 + 0.05)); caps.push(stud);
  }
  for (let k = 0; k < 4; k++) { const s = new THREE.BoxGeometry(O * 2 - FRAME_W * 2.2, 0.06, 0.16); s.translate(0, FRAME_H + 0.02, -(H + FRAME_W / 2)); s.rotateY((k * Math.PI) / 2); caps.push(s); }
  const brassM = new THREE.Mesh(merge(caps), brass); brassM.castShadow = true; g.add(brassM);
  // a glowing inner lip: lights up red while Flag mode is on (the flat art's frame glow)
  const lipC = canvas(256), lx = lipC.getContext('2d');
  { const gr = lx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); lx.fillStyle = gr; lx.fillRect(0, 0, 256, 256); }
  const lipMat = new THREE.MeshBasicMaterial({ color: 0xff5040, map: tex(lipC), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lips = [];
  for (let k = 0; k < 4; k++) { const p = new THREE.PlaneGeometry(H * 2 + 0.4, 1.1); p.rotateX(-Math.PI / 2); p.translate(0, FRAME_H + 0.08, -(H + 0.25)); p.rotateY((k * Math.PI) / 2); lips.push(p); }
  const lip = new THREE.Mesh(merge(lips), lipMat); lip.renderOrder = 4; g.add(lip);
  g.userData = { floor: floor.material[2], lip: lipMat, frameMat, n };
  return g;
}

// ---------------------------------------------------------------- desk, chart and props
export function buildDesk(scene) {
  const g = new THREE.Group();
  const leatherC = leatherTex('#2d4a4c');
  const leather = new THREE.MeshStandardMaterial({ map: tex(leatherC), color: 0xffffff, roughness: 0.82 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), leather); top.rotation.x = -Math.PI / 2; top.position.y = -BASE - 0.05; top.receiveShadow = true; g.add(top);
  // walnut desk rim beyond the leather
  const deskWood = tex(woodTex('#3b2213', '20,8,3', 512, 512, 11)); deskWood.wrapS = deskWood.wrapT = THREE.RepeatWrapping; deskWood.repeat.set(6, 6);
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: deskWood, roughness: 0.6 })); rim.rotation.x = -Math.PI / 2; rim.position.y = -BASE - 0.12; rim.receiveShadow = true; g.add(rim);
  // the chart, a little skewed under the tray
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(60, 50), new THREE.MeshStandardMaterial({ map: tex(chartTex()), roughness: 0.9 }));
  chart.rotation.x = -Math.PI / 2; chart.rotation.z = 0.07; chart.position.set(3, -BASE - 0.02, -3); chart.receiveShadow = true; g.add(chart);
  scene.add(g);
  return { group: g, leather, leatherCanvas: leatherC, chart };
}
export function buildCompass() {
  const g = new THREE.Group(), brass = brassMat();
  const prof = [[0, 0], [5.6, 0], [6.2, 0.4], [6.3, 1.6], [5.9, 2.0], [5.5, 1.9], [5.4, 1.2], [0, 1.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), brass); bowl.castShadow = true; bowl.receiveShadow = true; g.add(bowl);
  const c = canvas(512), x = c.getContext('2d');
  x.fillStyle = '#f3ead2'; x.beginPath(); x.arc(256, 256, 256, 0, 7); x.fill();
  x.strokeStyle = '#3a2a18'; x.lineWidth = 3; for (const r of [240, 200]) { x.beginPath(); x.arc(256, 256, r, 0, 7); x.stroke(); }
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, l = i % 9 === 0 ? 34 : 14; x.lineWidth = i % 9 === 0 ? 3 : 1.5; x.beginPath(); x.moveTo(256 + Math.cos(a) * 240, 256 + Math.sin(a) * 240); x.lineTo(256 + Math.cos(a) * (240 - l), 256 + Math.sin(a) * (240 - l)); x.stroke(); }
  x.font = '700 44px serif'; x.fillStyle = '#7a1f18'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [['N', 0], ['E', 1], ['S', 2], ['W', 3]].forEach(([s, k]) => { const a = k * Math.PI / 2 - Math.PI / 2; x.fillText(s, 256 + Math.cos(a) * 168, 256 + Math.sin(a) * 168); });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, L = i % 2 ? 90 : 140; x.fillStyle = i % 2 ? '#2a4f5c' : (i === 0 ? '#a5281f' : '#3a2a18'); x.beginPath(); x.moveTo(256 + Math.cos(a) * L, 256 + Math.sin(a) * L); x.lineTo(256 + Math.cos(a + 0.4) * 22, 256 + Math.sin(a + 0.4) * 22); x.lineTo(256 + Math.cos(a - 0.4) * 22, 256 + Math.sin(a - 0.4) * 22); x.fill(); }
  const face = new THREE.Mesh(new THREE.CircleGeometry(5.45, 48), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.6 })); face.rotation.x = -Math.PI / 2; face.position.y = 1.22; g.add(face);
  const needle = new THREE.Group(); needle.position.y = 1.5; g.add(needle);
  const n1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 4.2), new THREE.MeshStandardMaterial({ color: 0xb02a20, roughness: 0.4, metalness: 0.3 })); n1.position.z = -2.0; n1.scale.x = 0.9;
  const n2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 4.2), new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.3, metalness: 0.6 })); n2.position.z = 2.0;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12), brass);
  needle.add(n1, n2, pin); n1.castShadow = n2.castShadow = true;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(5.5, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 0, transparent: true, opacity: 0.12, clearcoat: 1 }));
  glass.rotation.x = -Math.PI / 2; glass.position.y = 1.95; glass.renderOrder = 2; g.add(glass);
  g.userData.needle = needle;
  return g;
}
export function buildDividers() {
  const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.25, metalness: 1 }), brass = brassMat();
  const leg = (a) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.32, 14, 10), steel); m.geometry.translate(0, -7, 0); m.rotation.z = a; m.castShadow = true; return m; };
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.6, 20), brass); hinge.rotation.x = Math.PI / 2; hinge.castShadow = true;
  g.add(leg(Math.PI / 2 + 0.22), leg(Math.PI / 2 - 0.22 + Math.PI), hinge);
  g.children[0].rotation.z = 0.2; g.children[1].rotation.z = -0.2;
  // lying flat on the desk
  const wrap = new THREE.Group(); g.rotation.x = -Math.PI / 2; g.position.y = 0.4; wrap.add(g);
  return wrap;
}
export function buildPencil() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 15, 6), new THREE.MeshStandardMaterial({ color: 0x1f4b5a, roughness: 0.45 }));
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.08, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0xe6c79a, roughness: 0.8 })); wood.position.y = 8.4;
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.01, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 })); lead.position.y = 9.5;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 12), brassMat()); band.position.y = -7.9;
  const rub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0xc9707a, roughness: 0.9 })); rub.position.y = -8.8;
  g.add(body, wood, lead, band, rub); g.children.forEach((m) => { m.castShadow = true; });
  const wrap = new THREE.Group(); g.rotation.z = Math.PI / 2; g.position.y = 0.42; wrap.add(g);
  return wrap;
}
// the moored mine desk ornament for the title (the flat art's buoy mine): a mine on a small walnut plinth
export function buildOrnament(geo, mat, band) {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(block(9, 9, 1.6, 1.2, 0.35), new THREE.MeshPhysicalMaterial({ color: 0x4a2a17, roughness: 0.4, clearcoat: 0.6 })); plinth.castShadow = plinth.receiveShadow = true;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.2, 12), brassMat()); post.position.y = 3.1; post.castShadow = true;
  const m = new THREE.Mesh(geo, mat); m.scale.setScalar(3); m.position.y = 7.6; m.castShadow = true;
  const b = new THREE.Mesh(band, brassMat()); b.scale.setScalar(3); b.position.y = 7.6;
  g.add(plinth, post, m, b); g.userData.mine = m; g.userData.band = b;
  return g;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a2414, 0.38); scene.add(hemi);
  // the desk lamp: warm key from the upper left, soft shadows
  const lamp = new THREE.SpotLight(0xffe2b8, 7800, 0, 0.6, 0.7, 1.6);
  lamp.position.set(-62, 70, -46); lamp.target.position.set(2, 0, 4); scene.add(lamp, lamp.target);
  lamp.shadow.camera.near = 40; lamp.shadow.camera.far = 260; lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4;
  // cool rim from behind the board, a little bounce from the front
  const rim = new THREE.DirectionalLight(0x9fd8ff, 0.7); rim.position.set(40, 50, -90); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff0dd, 0.22); fill.position.set(20, 40, 90); scene.add(fill);
  // flash for a mine that goes off
  const flash = new THREE.PointLight(0xff8a50, 0, 60, 1.4); flash.position.set(0, 5, 0); scene.add(flash);
  return { hemi, lamp, rim, fill, flash };
}
