// The 3D world of the Royal Game of Ur (procedural: geometry + canvas-painted textures, no bitmaps shipped).
// Units are centimetres. The board follows the inlaid boards from Ur: a wooden case in three parts (a block of 3 x 4 squares, a
// two-square bridge, a block of 3 x 2), each square a shell plaque inlaid with lapis lazuli and red limestone, the case sides
// banded with a frieze of shell, red and lapis triangles. It sits on a dark cedar table lit by a clay oil lamp.
// BOARD space (layout.js, 720 x 1024 block around 360, 810) maps onto the table by bw()/bz(); squares become true squares.
import * as THREE from '../vendor3d/three.js';
import { slab, woodCanvas } from '../vendor3d/board3d.js';
import { rosette, PAL } from '../src/art.js';

export const C = 4.0;                    // square pitch (the boards from Ur have squares about 3.5-4 cm)
export const TILE = 3.62, BOX_H = 2.3, TILE_H = 0.34, TOP = BOX_H + TILE_H - 0.06;
export const PR = 1.22, PH = 0.52;       // counter radius and thickness (about 2.4 cm across)
export const DIE_R = 1.3;                // tetrahedron circumradius: edge about 2.1 cm
// x: the side trays are pushed GAP cm clear of the case, so they are not hidden under its overhang (the inverse maps the gap to the edge)
const EDGE = 240, GAP = 1.4, EW = (EDGE / 156) * C;
export const bw = (bx) => { const d = bx - 360, a = Math.abs(d); return a <= EDGE ? (d / 156) * C : Math.sign(d) * (EW + GAP + ((a - EDGE) / 156) * C); };
export const bz = (by) => ((by - 810) / 122) * C;
export const fromW = (x, z) => { const a = Math.abs(x); const d = a <= EW ? a : a <= EW + GAP ? EW : EDGE / 156 * C + (a - EW - GAP); return { x: 360 + Math.sign(x) * (d / C) * 156, y: 810 + (z / C) * 122 }; };
const TAU = Math.PI * 2;
const cellX = (lane) => (lane - 1) * C, cellZ = (c) => bz(1306 - c * 122 - 61);
export const cellPos = (lane, c) => ({ x: cellX(lane), z: cellZ(c) });
export const isPlayable = (lane, c) => lane === 1 || c <= 3 || c >= 6;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// ------------------------------------------------------------------ inlay painting (colour + a matching relief map)
function lapis(x, X, y, w, h, rnd) {
  const g = x.createLinearGradient(X, y, X + w, y + h); g.addColorStop(0, '#3561bd'); g.addColorStop(0.55, '#1f3f92'); g.addColorStop(1, '#13296a');
  x.fillStyle = g; x.fillRect(X, y, w, h);
  for (let k = 0; k < 140; k++) { x.fillStyle = `rgba(${200 + rnd() * 55},${170 + rnd() * 60},${80 + rnd() * 50},${0.25 + rnd() * 0.6})`; const s = 0.8 + rnd() * 2.2; x.fillRect(X + rnd() * w, y + rnd() * h, s, s); }    // pyrite flecks
  x.strokeStyle = 'rgba(200,220,255,0.12)'; x.lineWidth = 3;
  for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(X + rnd() * w, y); x.bezierCurveTo(X + rnd() * w, y + h * 0.3, X + rnd() * w, y + h * 0.7, X + rnd() * w, y + h); x.stroke(); }
}
function shellGround(x, X, y, w, h, rnd) {
  const g = x.createLinearGradient(X, y, X + w, y + h); g.addColorStop(0, '#fbf2dc'); g.addColorStop(0.6, '#ecdcb6'); g.addColorStop(1, '#d6c193');
  x.fillStyle = g; x.fillRect(X, y, w, h);
  x.strokeStyle = 'rgba(120,90,50,0.13)'; x.lineWidth = 1.2;                                   // growth lines + fine crazing of old shell
  for (let k = 0; k < 26; k++) { x.beginPath(); const yy = y + rnd() * h; x.moveTo(X, yy); x.bezierCurveTo(X + w * 0.3, yy + (rnd() - 0.5) * 30, X + w * 0.7, yy + (rnd() - 0.5) * 30, X + w, yy + (rnd() - 0.5) * 20); x.stroke(); }
  x.strokeStyle = 'rgba(90,60,30,0.18)'; x.lineWidth = 0.8;
  for (let k = 0; k < 40; k++) { let px = X + rnd() * w, py = y + rnd() * h; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 4; s++) { px += (rnd() - 0.5) * 30; py += (rnd() - 0.5) * 30; x.lineTo(px, py); } x.stroke(); }
}
function redStone(x, X, y, w, h, rnd) {
  const g = x.createLinearGradient(X, y, X + w, y + h); g.addColorStop(0, '#c95a3c'); g.addColorStop(0.6, '#a03f28'); g.addColorStop(1, '#712818');
  x.fillStyle = g; x.fillRect(X, y, w, h);
  for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(255,${190 + rnd() * 40},${150 + rnd() * 40},${0.08 + rnd() * 0.12})`; x.beginPath(); x.arc(X + rnd() * w, y + rnd() * h, 1 + rnd() * 3, 0, TAU); x.fill(); }
}
// one inlay shape drawn on both canvases: colour on c, a dark cut line on the relief map b
function cut(c, b, path, fill, lw = 5) {
  c.save(); path(c); c.fillStyle = fill; c.fill(); c.restore();
  b.save(); path(b); b.fillStyle = '#9a9a9a'; b.fill(); b.strokeStyle = '#000'; b.lineWidth = lw; b.stroke(); b.restore();
}
const disc = (cx, cy, r) => (x) => { x.beginPath(); x.arc(cx, cy, r, 0, TAU); };
// kinds: 0 lapis 'eyes' (five dots), 1 shell with red corners + lapis lozenge, 2 red with a shell eye, 3 lapis zigzags, 9 rosette (lapis), 10 central rosette
export function paintTile(kind, seed, S = 512) {
  const cv = canvas(S), bm = canvas(S), c = cv.getContext('2d'), b = bm.getContext('2d'), rnd = lcg(seed);
  b.fillStyle = '#bdbdbd'; b.fillRect(0, 0, S, S);
  const m = S * 0.05, w = S - 2 * m, cx = S / 2, cy = S / 2;
  // the shell frame of the plaque, then the inlaid field
  shellGround(c, 0, 0, S, S, rnd);
  const field = (fn) => { c.save(); c.beginPath(); c.roundRect(m, m, w, w, S * 0.05); c.clip(); fn(); c.restore(); b.save(); b.strokeStyle = '#000'; b.lineWidth = 6; b.beginPath(); b.roundRect(m, m, w, w, S * 0.05); b.stroke(); b.restore(); };
  const goldDot = (x, y, r) => { cut(c, b, disc(x, y, r), (() => { const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r); g.addColorStop(0, '#fff3c0'); g.addColorStop(0.5, '#e2b24a'); g.addColorStop(1, '#7a5010'); return g; })(), 4); };
  const shellDot = (x, y, r) => cut(c, b, disc(x, y, r), '#f7ecd2', 4);
  const lapDot = (x, y, r) => cut(c, b, disc(x, y, r), '#1f3f92', 4);
  if (kind === 0) {
    field(() => lapis(c, m, m, w, w, rnd));
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { shellDot(cx + sx * w * 0.3, cy + sy * w * 0.3, S * 0.075); lapDot(cx + sx * w * 0.3, cy + sy * w * 0.3, S * 0.03); }
    shellDot(cx, cy, S * 0.12); goldDot(cx, cy, S * 0.07);
  } else if (kind === 1) {
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const X = sx ? S - m : m, Y = sy ? S - m : m, dx = sx ? -1 : 1, dy = sy ? -1 : 1;
      cut(c, b, (x) => { x.beginPath(); x.moveTo(X, Y); x.lineTo(X + dx * w * 0.36, Y); x.lineTo(X, Y + dy * w * 0.36); x.closePath(); }, '#a64128');
    }
    cut(c, b, (x) => { x.beginPath(); x.moveTo(cx, cy - w * 0.3); x.lineTo(cx + w * 0.24, cy); x.lineTo(cx, cy + w * 0.3); x.lineTo(cx - w * 0.24, cy); x.closePath(); }, '#24479c');
    shellDot(cx, cy, S * 0.07); goldDot(cx, cy, S * 0.035);
  } else if (kind === 2) {
    field(() => redStone(c, m, m, w, w, rnd));
    cut(c, b, (x) => { x.beginPath(); x.ellipse(cx, cy, w * 0.36, w * 0.25, 0, 0, TAU); }, '#efe2c2');
    lapDot(cx, cy, S * 0.12); shellDot(cx - S * 0.035, cy - S * 0.035, S * 0.03);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) goldDot(cx + sx * w * 0.38, cy + sy * w * 0.38, S * 0.035);
  } else if (kind === 3) {
    field(() => lapis(c, m, m, w, w, rnd));
    for (let k = -1; k <= 1; k++) {
      const y0 = cy + k * w * 0.27;
      cut(c, b, (x) => { x.beginPath(); x.moveTo(cx - w * 0.36, y0 + w * 0.08); x.lineTo(cx - w * 0.18, y0 - w * 0.06); x.lineTo(cx, y0 + w * 0.08); x.lineTo(cx + w * 0.18, y0 - w * 0.06); x.lineTo(cx + w * 0.36, y0 + w * 0.08); x.lineTo(cx + w * 0.36, y0 + w * 0.15); x.lineTo(cx + w * 0.18, y0 + w * 0.01); x.lineTo(cx, y0 + w * 0.15); x.lineTo(cx - w * 0.18, y0 + w * 0.01); x.lineTo(cx - w * 0.36, y0 + w * 0.15); x.closePath(); }, '#efe2c2', 3);
    }
  } else {
    const central = kind === 10;
    field(() => lapis(c, m, m, w, w, rnd));
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) goldDot(cx + sx * w * 0.4, cy + sy * w * 0.4, S * 0.028);
    const r = w * (central ? 0.44 : 0.41);
    if (central) { c.strokeStyle = '#e2b24a'; c.lineWidth = S * 0.018; c.beginPath(); c.arc(cx, cy, r * 1.06, 0, TAU); c.stroke(); b.strokeStyle = '#000'; b.lineWidth = 6; b.beginPath(); b.arc(cx, cy, r * 1.06, 0, TAU); b.stroke(); }
    rosette(c, cx, cy, r, central, TAU / 16);
    // relief: petals and the heart are separate inlaid pieces
    b.save(); b.translate(cx, cy); b.rotate(TAU / 16); b.strokeStyle = '#000'; b.lineWidth = 4;
    for (let i = 0; i < 8; i++) { b.save(); b.rotate((i / 8) * TAU); b.beginPath(); b.moveTo(0, r * 0.28); b.quadraticCurveTo(r * 0.34, r * 0.64, 0, r); b.quadraticCurveTo(-r * 0.34, r * 0.64, 0, r * 0.28); b.fillStyle = '#a8a8a8'; b.fill(); b.stroke(); b.restore(); }
    b.beginPath(); b.arc(0, 0, r * 0.27, 0, TAU); b.fillStyle = '#d0d0d0'; b.fill(); b.stroke(); b.restore();
  }
  // wear: darker grime in the cuts, a soft polished centre where fingers slid the pieces for millennia
  const v = c.createRadialGradient(cx, cy, S * 0.1, cx, cy, S * 0.75); v.addColorStop(0, 'rgba(255,240,210,0.07)'); v.addColorStop(1, 'rgba(40,20,5,0.28)');
  c.fillStyle = v; c.fillRect(0, 0, S, S);
  return { map: tex(cv), bump: tex(bm, false) };
}
export const tileKind = (lane, c) => (lane === 1 && c === 3 ? 10 : (c === 0 || c === 6) && lane !== 1 ? 9 : (lane * 3 + c * 5) % 4);

// the frieze around the case sides: bitumen, a gold rule, a band of shell / red triangles on lapis, a second rule
function friezeTex() {
  const W = 512, H = 128, cv = canvas(W, H), x = cv.getContext('2d'), rnd = lcg(77);
  x.fillStyle = '#1a120b'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#c9a04a'; x.fillRect(0, H * 0.14, W, H * 0.05); x.fillRect(0, H * 0.8, W, H * 0.05);
  lapis(x, 0, H * 0.22, W, H * 0.55, rnd);
  const n = 8, tw = W / n;
  for (let k = 0; k < n; k++) {
    x.fillStyle = k % 2 ? '#a64128' : '#f1e4c4';
    x.beginPath(); x.moveTo(k * tw + 4, H * 0.75); x.lineTo(k * tw + tw / 2, H * 0.25); x.lineTo(k * tw + tw - 4, H * 0.75); x.closePath(); x.fill();
    x.fillStyle = '#f1e4c4'; x.beginPath(); x.arc(k * tw, H * 0.5, 5, 0, TAU); x.fill();
  }
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.18})`; x.fillRect(rnd() * W, rnd() * H, 2, 2); }
  const t = tex(cv, true, true); return t;
}

// ------------------------------------------------------------------ the board
export function buildBoard(tierTex = 512) {
  const g = new THREE.Group();
  const F = 0.55, xs = 1.5 * C + F, zA0 = cellZ(0) + C / 2 + F, zA1 = cellZ(3) - C / 2 - F, zB0 = cellZ(6) + C / 2 + F, zB1 = cellZ(7) - C / 2 - F, xb = C / 2 + F;
  // outline of the case (x, z): the big block, the bridge, the small block
  const outline = [[-xs, zA0], [xs, zA0], [xs, zA1], [xb, zA1], [xb, zB0], [xs, zB0], [xs, zB1], [-xs, zB1], [-xs, zB0], [-xb, zB0], [-xb, zA1], [-xs, zA1]];
  const shape = new THREE.Shape(); outline.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z))); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: BOX_H - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.22, bevelSegments: 3, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0.15, 0);
  // side UVs: run the frieze along the wall, its height across the wall
  { const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const ny = n.getY(i); if (Math.abs(ny) > 0.7) continue; const along = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? p.getZ(i) : p.getX(i); uv.setXY(i, along / 6.5, (p.getY(i) - 0.05) / (BOX_H - 0.1)); } }
  const fr = friezeTex();
  const topMat = new THREE.MeshStandardMaterial({ color: 0x1a120b, roughness: 0.55, metalness: 0 });
  const sideMat = new THREE.MeshPhysicalMaterial({ map: fr, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const box = new THREE.Mesh(geo, [topMat, sideMat]); box.castShadow = true; box.receiveShadow = true; g.add(box);
  // the twenty plaques
  const tileGeo = slab(TILE, TILE, TILE_H, 0.22, 0.07);
  const shellSide = new THREE.MeshPhysicalMaterial({ color: 0xe8d8b2, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color(0xfff2d8) });
  const decal = new THREE.PlaneGeometry(TILE - 0.16, TILE - 0.16); decal.rotateX(-Math.PI / 2);
  const mats = {};
  const matFor = (kind, seed) => {
    const key = kind; if (mats[key]) return mats[key];
    const T = paintTile(kind, seed, tierTex);
    return (mats[key] = new THREE.MeshPhysicalMaterial({ map: T.map, bumpMap: T.bump, bumpScale: 2.2, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.22, polygonOffset: true, polygonOffsetFactor: -2 }));
  };
  const tiles = [];
  for (let lane = 0; lane < 3; lane++) for (let c = 0; c < 8; c++) {
    if (!isPlayable(lane, c)) continue;
    const p = cellPos(lane, c), t = new THREE.Mesh(tileGeo, shellSide); t.position.set(p.x, BOX_H - 0.06 - 0.02, p.z); t.castShadow = false; t.receiveShadow = true; g.add(t);
    const d = new THREE.Mesh(decal, matFor(tileKind(lane, c), 2600 + lane * 8 + c)); d.position.set(p.x, TOP + 0.003, p.z); d.receiveShadow = true;
    if ((lane + c) % 2) d.rotation.y = Math.PI;                    // the same designs, not all facing one way (as on the real board)
    g.add(d); tiles.push(d);
  }
  g.userData = { dispose: () => { geo.dispose(); tileGeo.dispose(); decal.dispose(); fr.dispose(); for (const m of Object.values(mats)) { m.map.dispose(); m.bumpMap.dispose(); m.dispose(); } } };
  return g;
}

// shallow carved trays beside the board: where waiting pieces line up and where borne-off pieces gather (layout RESERVE_RECT / HOME_RECT)
export function buildTrays() {
  const g = new THREE.Group();
  const W2 = woodCanvas(256, '#4a2c16', '#6e4526', 5);
  const mat = new THREE.MeshPhysicalMaterial({ map: tex(W2.map), bumpMap: tex(W2.bump, false), bumpScale: 0.6, roughness: 0.5, clearcoat: 0.25 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x3a1410, roughness: 0.95 });
  const add = (rx, ry, rw, rh) => {
    const x0 = bw(rx), x1 = bw(rx + rw), z0 = bz(ry), z1 = bz(ry + rh), w = x1 - x0, d = z1 - z0;
    const rim = new THREE.Mesh(slab(w, d, 0.5, 0.6, 0.15), mat); rim.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); rim.castShadow = true; rim.receiveShadow = true; g.add(rim);
    const bed = new THREE.Mesh(slab(w - 0.5, d - 0.5, 0.52, 0.45, 0.04), felt); bed.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); bed.receiveShadow = true; g.add(bed);
  };
  for (const s of [0, 1]) { add(s === 0 ? 8 : 720 - 118, 1306 - 470, 110, 476); add(s === 0 ? 8 : 720 - 118, 330 - 4, 110, 250); }
  return g;
}
export const TRAY_Y = 0.54;              // bed height of the side trays

// ------------------------------------------------------------------ the counters (shell with five lapis dots / jet with five shell dots)
function pieceTop(side, S = 256) {
  const cv = canvas(S), x = cv.getContext('2d'), rnd = lcg(91 + side), c = S / 2, r = S / 2;
  if (side === 0) { const g = x.createRadialGradient(c * 0.7, c * 0.6, 4, c, c, r); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, '#efe2c4'); g.addColorStop(1, '#cdb88c'); x.fillStyle = g; }
  else { const g = x.createRadialGradient(c * 0.7, c * 0.6, 4, c, c, r); g.addColorStop(0, '#4a4038'); g.addColorStop(0.6, '#221b16'); g.addColorStop(1, '#0d0907'); x.fillStyle = g; }
  x.fillRect(0, 0, S, S);
  x.strokeStyle = side ? 'rgba(255,255,255,0.05)' : 'rgba(120,90,50,0.12)'; x.lineWidth = 1;
  for (let k = 0; k < 20; k++) { x.beginPath(); x.arc(c + (rnd() - 0.5) * 30, c + (rnd() - 0.5) * 30, r * (0.2 + rnd() * 0.8), rnd() * TAU, rnd() * TAU + 1.5); x.stroke(); }
  x.strokeStyle = '#d9ad4e'; x.lineWidth = S * 0.035; x.beginPath(); x.arc(c, c, r * 0.9, 0, TAU); x.stroke();
  for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = c + dx * r * 0.4, py = c + dy * r * 0.4, pr = r * (dx || dy ? 0.15 : 0.19);
    x.fillStyle = side ? '#6d5a3a' : '#0f2560'; x.beginPath(); x.arc(px, py + 2, pr + 3, 0, TAU); x.fill();
    const g = x.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 1, px, py, pr);
    if (side) { g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#d8c7a0'); } else { g.addColorStop(0, '#4f7fe0'); g.addColorStop(1, '#1b3a8c'); }
    x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fill();
  }
  return tex(cv);
}
export function pieceKit() {
  // a turned counter: flat top with a soft rounded edge, slightly waisted side
  const prof = [[0, 0], [PR * 0.92, 0], [PR, PH * 0.12], [PR * 0.985, PH * 0.6], [PR * 0.95, PH * 0.9], [PR * 0.86, PH], [0, PH]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(prof, 40);
  const cap = new THREE.CircleGeometry(PR * 0.87, 40); cap.rotateX(-Math.PI / 2); cap.translate(0, PH + 0.004, 0);
  const sides = [0, 1].map((s) => ({
    body: new THREE.MeshPhysicalMaterial(s ? { color: 0x15100c, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.12 } : { color: 0xe9dcbf, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: new THREE.Color(0xfff0dc), iridescence: 0.25 }),
    top: new THREE.MeshPhysicalMaterial({ map: pieceTop(s), roughness: s ? 0.2 : 0.3, clearcoat: s ? 0.9 : 0.6, clearcoatRoughness: 0.15, transparent: true }),
  }));
  return { body, cap, sides };
}

// ------------------------------------------------------------------ pyramid dice: bone tetrahedra, two of the four tips inlaid with gold
export function dieKit() {
  // a regular tetrahedron (built by hand: the bundled three.js has no polyhedra), each face its own vertices for crisp flat facets
  const V = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(DIE_R));
  const pos = [];
  for (const f of [[0, 1, 2], [0, 2, 3], [0, 1, 3], [1, 2, 3]]) {
    const [A, B, Cc] = f.map((k) => V[k]), n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(Cc, A)), m = new THREE.Vector3().add(A).add(B).add(Cc);
    for (const v of n.dot(m) > 0 ? [A, B, Cc] : [A, Cc, B]) pos.push(v.x, v.y, v.z);           // counter-clockwise seen from outside
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  // soften the edges a little by shrinking each face toward its centre is costly; instead a slightly rounded look from flat shading + bevel-ish normals
  const p = geo.attributes.position, verts = [];
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); if (!verts.some((u) => u.distanceTo(v) < 1e-4)) verts.push(v); }
  const bone = new THREE.MeshPhysicalMaterial({ color: 0xead9b4, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5, flatShading: true });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xe8b84a, metalness: 1, roughness: 0.28 });
  const lap = new THREE.MeshPhysicalMaterial({ color: 0x23469c, roughness: 0.3, clearcoat: 0.6 });
  const tipGeo = new THREE.SphereGeometry(DIE_R * 0.24, 16, 10);
  const make = () => {
    const g = new THREE.Group(), m = new THREE.Mesh(geo, bone); m.castShadow = true; m.receiveShadow = true; g.add(m);
    verts.forEach((v, k) => { const t = new THREE.Mesh(tipGeo, k < 2 ? gold : lap); t.scale.setScalar(k < 2 ? 1 : 0.55); t.position.copy(v).multiplyScalar(k < 2 ? 0.84 : 0.9); g.add(t); });
    return g;
  };
  // orientations that put a marked (gold) tip up, or an unmarked tip up
  const up = new THREE.Vector3(0, 1, 0);
  const restQ = (marked, yaw) => { const v = verts[marked ? 0 : 2].clone().normalize(); const q = new THREE.Quaternion().setFromUnitVectors(v, up); return new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(q); };
  return { make, verts, restQ, low: DIE_R / 3, top: DIE_R * 0.9 };      // a resting tetrahedron's centre sits R/3 above the floor
}

// ------------------------------------------------------------------ the room: cedar table, an oil lamp, a mud-brick wall far behind
export function buildRoom(scene, q = 1) {
  const g = new THREE.Group(); scene.add(g);
  const woodC = woodCanvas(1024, '#2a170b', '#4b2c15', 23, { lines: 220, knots: 3 }); const woodT = tex(woodC.map, true, true), woodB = tex(woodC.bump, false, true); woodT.repeat.set(3, 3); woodB.repeat.set(3, 3);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshPhysicalMaterial({ map: woodT, bumpMap: woodB, bumpScale: 0.8, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.55 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; g.add(table);
  // a linen cloth under the board: a woven runner with a red-ochre border
  const cl = canvas(512, 1024), x = cl.getContext('2d'), rnd = lcg(5);
  x.fillStyle = '#6e573c'; x.fillRect(0, 0, 512, 1024);
  for (let k = 0; k < 1024; k += 3) { x.fillStyle = `rgba(80,55,30,${0.05 + rnd() * 0.08})`; x.fillRect(0, k, 512, 1); }
  for (let k = 0; k < 512; k += 3) { x.fillStyle = `rgba(255,240,210,${0.03 + rnd() * 0.05})`; x.fillRect(k, 0, 1, 1024); }
  x.fillStyle = '#8a3220'; x.fillRect(18, 0, 26, 1024); x.fillRect(512 - 44, 0, 26, 1024);
  x.fillStyle = '#2b3f7a'; x.fillRect(50, 0, 6, 1024); x.fillRect(512 - 56, 0, 6, 1024);
  const clothT = tex(cl); const cloth = new THREE.Mesh(new THREE.PlaneGeometry(34, 62), new THREE.MeshStandardMaterial({ map: clothT, roughness: 0.95 }));
  cloth.rotation.x = -Math.PI / 2; cloth.rotation.z = 0.035; cloth.position.set(0, 0.02, -1); cloth.scale.set(1.05, 1, 1); cloth.receiveShadow = true; g.add(cloth);
  // mud-brick wall + a niche, far behind the table (seen from the title's low camera)
  const wc = canvas(1024, 512), w = wc.getContext('2d'), r2 = lcg(9);
  w.fillStyle = '#6b4a2e'; w.fillRect(0, 0, 1024, 512);
  for (let row = 0; row < 16; row++) for (let k = -1; k < 12; k++) {
    const bx = k * 96 + (row % 2) * 48, by = row * 32, sh = 0.75 + r2() * 0.3;
    w.fillStyle = `rgb(${Math.round(150 * sh)},${Math.round(108 * sh)},${Math.round(68 * sh)})`; w.fillRect(bx + 3, by + 3, 90, 26);
    for (let s = 0; s < 6; s++) { w.fillStyle = `rgba(60,35,15,${r2() * 0.25})`; w.fillRect(bx + r2() * 90, by + r2() * 26, 3 + r2() * 8, 2); }
  }
  const wallT = tex(wc, true, true); wallT.repeat.set(4, 2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 140), new THREE.MeshStandardMaterial({ map: wallT, roughness: 1, emissive: 0xffffff, emissiveMap: wallT, emissiveIntensity: 0.16, fog: false }));
  wall.position.set(0, 70, -120); wall.receiveShadow = true; g.add(wall);
  // the oil lamp: a pinched clay saucer with a wick and a flame
  const lamp = new THREE.Group();
  const lp = [[0, 0], [2.2, 0.1], [3.4, 0.6], [3.7, 1.3], [3.3, 1.5], [2.6, 1.1], [0, 1.0]].map(([a, b]) => new THREE.Vector2(a, b));
  const clay = new THREE.MeshStandardMaterial({ color: 0xa8683a, roughness: 0.85 });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(lp, 28), clay); bowl.scale.set(1, 1, 1.25); bowl.castShadow = true; bowl.receiveShadow = true; lamp.add(bowl);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 2.2, 10), clay); spout.rotation.x = Math.PI / 2 - 0.15; spout.position.set(0, 1.25, -4.3); lamp.add(spout);
  const oil = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshPhysicalMaterial({ color: 0x2a1806, roughness: 0.1, clearcoat: 1 })); oil.rotation.x = -Math.PI / 2; oil.position.y = 1.05; oil.scale.set(1, 1.2, 1); lamp.add(oil);
  const fc = canvas(128, 256), fx = fc.getContext('2d'), fg = fx.createRadialGradient(64, 170, 4, 64, 150, 120);
  fg.addColorStop(0, 'rgba(255,255,235,1)'); fg.addColorStop(0.25, 'rgba(255,214,120,0.95)'); fg.addColorStop(0.6, 'rgba(255,130,30,0.45)'); fg.addColorStop(1, 'rgba(255,90,10,0)');
  fx.fillStyle = fg; fx.beginPath(); fx.moveTo(64, 10); fx.bezierCurveTo(118, 120, 104, 230, 64, 236); fx.bezierCurveTo(24, 230, 10, 120, 64, 10); fx.fill();
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(fc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flame.scale.set(1.5, 3.2, 1); flame.position.set(0, 3.3, -5.1); lamp.add(flame);
  const hc = canvas(128), hx = hc.getContext('2d'), hg = hx.createRadialGradient(64, 64, 0, 64, 64, 64); hg.addColorStop(0, 'rgba(255,200,110,0.55)'); hg.addColorStop(0.4, 'rgba(255,160,70,0.16)'); hg.addColorStop(1, 'rgba(255,140,60,0)'); hx.fillStyle = hg; hx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(hc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.set(16, 16, 1); halo.position.copy(flame.position); lamp.add(halo);
  lamp.position.set(12, 0, -27); lamp.rotation.y = 1.9; g.add(lamp);
  // a few loose beads (carnelian and lapis) and a small clay cup beside the board
  const bead = new THREE.SphereGeometry(0.45, 14, 10);
  const carn = new THREE.MeshPhysicalMaterial({ color: 0xc24a22, roughness: 0.15, transmission: 0.2, thickness: 0.5, clearcoat: 1 }), lap2 = new THREE.MeshPhysicalMaterial({ color: 0x23469c, roughness: 0.2, clearcoat: 1 });
  const goldM = new THREE.MeshPhysicalMaterial({ color: 0xe5b44c, metalness: 1, roughness: 0.25 });
  for (let k = 0; k < 11; k++) { const b = new THREE.Mesh(bead, k % 3 === 0 ? goldM : k % 3 === 1 ? carn : lap2); const a = 0.4 + k * 0.23; b.position.set(-17 + Math.cos(a) * 4.5, 0.42, -27 + Math.sin(a) * 3.2); b.scale.set(1, 1, k % 3 === 0 ? 0.7 : 1.3); b.rotation.y = a; b.castShadow = true; g.add(b); }
  const cupP = [[0, 0], [2.6, 0], [3.0, 0.4], [3.4, 3.4], [3.6, 4.2], [3.3, 4.2], [3.0, 3.5], [2.6, 0.7], [0, 0.7]].map(([a, b]) => new THREE.Vector2(a, b));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupP, 28), new THREE.MeshStandardMaterial({ color: 0x9b5e34, roughness: 0.8 })); cup.position.set(-9, 0, -34); cup.castShadow = true; cup.receiveShadow = true; g.add(cup);
  void q;
  return { group: g, lamp, flame, halo, flamePos: new THREE.Vector3(0, 3.3, -5.1).applyMatrix4(lamp.matrixWorld.compose(lamp.position, lamp.quaternion, lamp.scale)) };
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe2bc, 0x24140a, 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd2a0, 1.9);                     // the lamp side: warm, from the upper right
  key.position.set(28, 52, -18); key.castShadow = true;
  const sc = key.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 40; sc.bottom = -40; sc.near = 10; sc.far = 140;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 4; key.shadow.mapSize.set(2048, 2048);
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 0.7); rim.position.set(-30, 22, -40); scene.add(rim);    // cool night rim from the far left
  const fill = new THREE.DirectionalLight(0xffe8d0, 0.35); fill.position.set(-10, 30, 40); scene.add(fill);
  const flameL = new THREE.PointLight(0xff9a40, 260, 90, 1.6); scene.add(flameL);
  return { hemi, key, rim, fill, flameL };
}

export function radialTex(rgb, a = 1, S = 64) {
  const cv = canvas(S), x = cv.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(cv);
}
export function glowSquareTex(S = 128) {
  const cv = canvas(S), x = cv.getContext('2d');
  for (let k = 0; k < 10; k++) { x.strokeStyle = `rgba(255,255,255,${0.1 + k * 0.09})`; x.lineWidth = 3; x.beginPath(); x.roundRect(4 + k * 2.2, 4 + k * 2.2, S - 8 - k * 4.4, S - 8 - k * 4.4, 14); x.stroke(); }
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.6); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.05)'); x.fillStyle = g; x.fillRect(24, 24, S - 48, S - 48);
  return tex(cv);
}
export function trayFloorTex() {
  const cv = canvas(512, 256), x = cv.getContext('2d'), rnd = lcg(31);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#3a1912'); g.addColorStop(1, '#24100b'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 4000; k++) { x.fillStyle = `rgba(${rnd() > 0.5 ? '255,200,160' : '0,0,0'},${rnd() * 0.06})`; x.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 2, 1); }
  return tex(cv, true, true);
}
