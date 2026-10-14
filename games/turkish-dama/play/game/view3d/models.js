// Turkish Dama 3D models: the inlaid Anatolian board, turned men and crowned kings, the tea-house table setting.
// Pure scene construction (no game state). World units: one board cell = 1. The playing surface is the plane y = TOP; the board is
// centred on the origin; +z points toward the player (screen bottom), +x to the right.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const TOP = 0.36;                 // y of the tile surface
export const HALF = 4.55;                // half of the outer board (4 cells + 0.55 frame)
const TAU = Math.PI * 2;
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const canvasTex = (c, o = {}) => { const t = new THREE.CanvasTexture(c); t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t; };
const phys = (params, extra = {}) => Object.assign(new THREE.MeshPhysicalMaterial(params), extra);
const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (v === undefined) { v = f(); cache.set(k, v); } return v; };
export const clearModelCache = () => { cache.clear(); B.disposeMaterialCache(); };

// ---------------------------------------------------------------- the three board looks (keys match art.js BOARDS)
export const LOOKS = {
  iznik:   { kind: 'glaze', a: ['#4fcfc6', '#2aa6a6'], b: ['#17707a', '#0c4a53'], frame: ['#6a3f1e', '#8a5a2c'], band: ['#f1d8a2', '#2a170b', '#e0b24a'], motif: 'rgba(225,255,250,0.16)' },
  saffron: { kind: 'wood',  a: ['#f3dfaa', '#e0bd78'], b: ['#b9803a', '#8d5a22'], frame: ['#5a2a1c', '#7a3b28'], band: ['#f0d089', '#2a120a', '#e0b24a'], motif: 'rgba(80,40,10,0.14)' },
  lapis:   { kind: 'lapis', a: ['#5b8be0', '#3a68c4'], b: ['#243f8e', '#162a68'], frame: ['#2b2538', '#443a58'], band: ['#d8c27a', '#120e1c', '#e6c25a'], motif: 'rgba(255,230,160,0.2)' },
};

function tileCanvas(look, dark, seed) {
  const L = LOOKS[look] || LOOKS.iznik, c = dark ? L.b : L.a, S = 256, cvs = cv(S), x = cvs.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); x.fillStyle = g; x.fillRect(0, 0, S, S);
  if (L.kind === 'wood') {
    for (let i = 0; i < 70; i++) { const y = r() * S, a = 0.05 + r() * 0.16; x.strokeStyle = r() < 0.7 ? `rgba(60,28,6,${a})` : `rgba(255,240,200,${a * 0.7})`; x.lineWidth = 0.6 + r() * 2.2; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 16, S * 0.7, y + (r() - 0.5) * 16, S, y + (r() - 0.5) * 10); x.stroke(); }
  } else if (L.kind === 'lapis') {
    for (let i = 0; i < 26; i++) { x.strokeStyle = r() < 0.45 ? 'rgba(255,255,255,0.13)' : 'rgba(8,16,60,0.25)'; x.lineWidth = 1 + r() * 4; x.beginPath(); let px = r() * S, py = r() * S; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.35) * 90; py += (r() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,214,110,${0.35 + r() * 0.5})`; x.fillRect(r() * S, r() * S, 1 + r() * 2.2, 1 + r() * 2.2); }
  } else {
    for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(0,30,40,0.10)'; x.lineWidth = 0.7; x.beginPath(); let px = r() * S, py = r() * S; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 60; py += (r() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); }
  }
  // a four-petal flower in the middle (Iznik tile work), barely there on the other looks
  x.fillStyle = L.motif;
  for (let q = 0; q < 4; q++) { x.save(); x.translate(S / 2, S / 2); x.rotate(q * Math.PI / 2 + (dark ? 0.4 : 0)); x.beginPath(); x.ellipse(0, -36, 14, 30, 0, 0, TAU); x.fill(); x.restore(); }
  x.strokeStyle = 'rgba(0,0,0,0.16)'; x.lineWidth = 4; x.strokeRect(5, 5, S - 10, S - 10);
  x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 2; x.strokeRect(9, 9, S - 18, S - 18);
  return cvs;
}

// the frame's top: walnut grain + a marquetry band (alternating diamonds in light wood, ebony and brass) + brass lines + tulips
function frameCanvas(look) {
  const L = LOOKS[look] || LOOKS.iznik, S = 2048, u = S / (HALF * 2), cvs = cv(S), x = cvs.getContext('2d');
  const w = B.woodCanvas(1024, L.frame[0], L.frame[1], 21, { lines: 220, knots: 1 });
  x.drawImage(w.map, 0, 0, S, S);
  const band0 = 0.1, band1 = 0.46;                                  // band between these distances (cells) in from the outer edge
  const line = (d, col, wd) => { x.strokeStyle = col; x.lineWidth = wd; x.strokeRect(d * u, d * u, S - 2 * d * u, S - 2 * d * u); };
  const ring = (a, b, col) => { x.fillStyle = col; x.beginPath(); x.rect(a * u, a * u, S - 2 * a * u, S - 2 * a * u); x.rect(b * u, b * u, S - 2 * b * u, S - 2 * b * u); x.fill('evenodd'); };
  ring(band0, band1, L.band[1]);
  // diamonds along the four sides
  const mid = (band0 + band1) / 2, n = 32, step = (S - 2 * band1 * u) / n, dh = (band1 - band0) * u * 0.46;
  const diamond = (cx, cy, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - dh); x.lineTo(cx + dh, cy); x.lineTo(cx, cy + dh); x.lineTo(cx - dh, cy); x.closePath(); x.fill(); };
  for (let i = 0; i < n; i++) {
    const p = band1 * u + (i + 0.5) * step, col = i % 2 ? L.band[0] : L.band[2], o = mid * u;
    diamond(p, o, col); diamond(p, S - o, col); diamond(o, p, col); diamond(S - o, p, col);
  }
  for (const k of [[band0, 'rgba(0,0,0,0.55)', 3], [band1, 'rgba(0,0,0,0.5)', 3]]) line(k[0], k[1], k[2]);
  line(band0 + 0.012, L.band[2], 5); line(band1 - 0.012, L.band[2], 5);
  // four corner rosettes in the band
  for (const [cx, cy] of [[band1, band1], [S / u - band1, band1], [band1, S / u - band1], [S / u - band1, S / u - band1]]) {
    x.save(); x.translate(cx * u, cy * u); x.fillStyle = L.band[2]; x.beginPath(); for (let k = 0; k < 16; k++) { const a = k * TAU / 16, rr = (k % 2 ? 0.1 : 0.2) * u; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill();
    x.fillStyle = L.band[1]; x.beginPath(); x.arc(0, 0, 0.07 * u, 0, TAU); x.fill(); x.restore();
  }
  // a faint polish: broad highlight
  const hl = x.createLinearGradient(0, 0, S, S); hl.addColorStop(0, 'rgba(255,235,190,0.10)'); hl.addColorStop(0.5, 'rgba(255,235,190,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.16)'); x.fillStyle = hl; x.fillRect(0, 0, S, S);
  return cvs;
}

export function buildBoard(look = 'iznik') {
  const g = new THREE.Group(); g.name = 'board';
  const L = LOOKS[look] || LOOKS.iznik;
  // the body: a bevelled walnut slab
  const body = new THREE.Mesh(B.slab(HALF * 2, HALF * 2, 0.3, 0.2, 0.07, { seg: 3, per: 6 }), B.material('darkWood', { color: L.frame[0], color2: L.frame[1], seed: 5, repeat: [3, 3] }));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  // the inlaid top (marquetry band)
  const topMat = phys({ map: canvasTex(frameCanvas(look)), roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.18 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 - 0.1, HALF * 2 - 0.1), topMat);
  top.rotation.x = -Math.PI / 2; top.position.y = 0.303; top.receiveShadow = true; g.add(top);
  // brass corner caps with a star inlay, and a brass lip round the playing field
  const brass = memo('brass', () => B.material('brass', { color: '#d9a93a', color2: '#f6dc8a', roughness: 0.28, seed: 3 }));
  const cap = B.slab(0.9, 0.9, 0.05, 0.16, 0.03);
  const star = B.inlay(B.starPoints(8, 0.3, 0.14, 0.2), 0.03);
  const dark = memo('capDark', () => new THREE.MeshStandardMaterial({ color: '#2a170b', roughness: 0.5 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = new THREE.Mesh(cap, brass); c.position.set(sx * (HALF - 0.43), 0.3, sz * (HALF - 0.43)); c.castShadow = true; c.receiveShadow = true; g.add(c);
    const s = new THREE.Mesh(star, dark); s.position.set(sx * (HALF - 0.43), 0.35, sz * (HALF - 0.43)); g.add(s);
  }
  const lipLong = B.roundedBox(8.2, 0.1, 0.07, 0.03), lipSide = B.roundedBox(0.07, 0.1, 8.2, 0.03);
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(lipLong, brass); a.position.set(0, 0.33, s * 4.07); a.castShadow = true; g.add(a);
    const b = new THREE.Mesh(lipSide, brass); b.position.set(s * 4.07, 0.33, 0); b.castShadow = true; g.add(b);
  }
  // the 8 x 8 field: a dark under-layer (grout) and 64 raised tiles
  const under = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 8.1), new THREE.MeshStandardMaterial({ color: '#0a0604', roughness: 0.9 }));
  under.rotation.x = -Math.PI / 2; under.position.y = 0.31; g.add(under);
  const mkTile = (dk) => {
    const map = canvasTex(tileCanvas(look, dk, dk ? 7 : 3));
    return phys({ map, roughness: L.kind === 'wood' ? 0.5 : 0.28, metalness: L.kind === 'lapis' ? 0.12 : 0, clearcoat: L.kind === 'wood' ? 0.45 : 0.85, clearcoatRoughness: L.kind === 'wood' ? 0.25 : 0.1 });
  };
  const tg = B.slab(0.97, 0.97, TOP - 0.31, 0.035, 0.016, { seg: 2, per: 3 }), tl = [], td = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const m = new THREE.Matrix4().makeTranslation(c - 3.5, 0.31, r - 3.5); ((r + c) % 2 ? td : tl).push({ geo: tg, m }); }
  for (const [parts, dk] of [[tl, false], [td, true]]) { const m = new THREE.Mesh(B.mergeGeos(parts), mkTile(dk)); m.receiveShadow = true; m.castShadow = false; g.add(m); }
  return g;
}

// ---------------------------------------------------------------- pieces
const manProfile = (R = 0.4, k = 1) => [
  [0, 0], [0.93, 0], [1, 0.02], [1, 0.06], [0.93, 0.078], [0.93, 0.088], [0.97, 0.108], [0.995, 0.135], [0.97, 0.162], [0.9, 0.19], [0.9, 0.3],
  [0.95, 0.322], [0.98, 0.345], [0.95, 0.368], [0.88, 0.39], [0.84, 0.418], [0.82, 0.44], [0.8, 0.462], [0.78, 0.44], [0.74, 0.44], [0.72, 0.462],
  [0.62, 0.462], [0.6, 0.44], [0.5, 0.44], [0.48, 0.462], [0.3, 0.466], [0.12, 0.47], [0, 0.472],
].map(([r, y]) => [r * R, y * k]);
export const MAN_H = 0.472, KING_H = 1.15;
const PIECE_MATS = {
  classic: { 1: () => B.material('ivory', { color: '#f6edd2', color2: '#dcc99a', seed: 6, roughness: 0.34 }), 2: () => B.material('lacquer', { color: '#b3111b', roughness: 0.2 }) },
  night:   { 1: () => B.material('ivory', { color: '#f5f8ff', color2: '#cdd8ea', seed: 8, roughness: 0.3 }), 2: () => B.material('lacquer', { color: '#17181f', roughness: 0.16 }) },
};
const brassBright = () => memo('brassB', () => B.material('brass', { color: '#e6b83e', color2: '#fbe38e', roughness: 0.22, seed: 9, envIntensity: 3.6 }));
const manGeo = () => memo('manGeo', () => B.lathe(manProfile(0.4), 64));
const capGeo = () => memo('capGeo', () => B.lathe(manProfile(0.31, 0.86), 56));
const inlayRing = () => memo('inlayRing', () => B.lathe([[0.2, 0], [0.235, 0], [0.235, 0.008], [0.2, 0.008]], 48));
const crownGeo = () => memo('crownGeo', () => {
  const parts = [{ geo: B.lathe([[0.19, 0], [0.22, 0], [0.22, 0.02], [0.21, 0.02], [0.21, 0.09], [0.22, 0.09], [0.22, 0.11], [0.2, 0.11], [0.2, 0.0]], 40) }];
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    const sp = B.lathe([[0, 0], [0.05, 0], [0.04, 0.05], [0.0, 0.17]], 12);
    parts.push({ geo: sp, m: new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.19, 0.1, Math.sin(a) * 0.19) });
    const tip = B.lathe([[0, 0], [0.035, 0.012], [0.04, 0.04], [0.03, 0.065], [0, 0.075]], 10);
    parts.push({ geo: tip, m: new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.19, 0.265, Math.sin(a) * 0.19) });
  }
  return B.mergeGeos(parts);
});
const bossGeo = () => memo('bossGeo', () => B.lathe([[0, 0], [0.1, 0], [0.1, 0.01], [0.085, 0.02], [0, 0.022]], 28));
const bandGeo = () => memo('bandGeo', () => new THREE.TorusGeometry(0.31, 0.03, 10, 48));

export function makePiece(side, king, style = 'classic') {
  const mats = PIECE_MATS[style] || PIECE_MATS.classic, body = memo(`pm|${style}|${side}`, () => mats[side]());
  const grp = new THREE.Group();
  const add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  add(manGeo(), body);
  if (!king) { add(bossGeo(), brassBright(), MAN_H - 0.004); add(inlayRing(), brassBright(), MAN_H * 0.93 - 0.006).scale.setScalar(1.0); }
  else {
    const band = add(bandGeo(), brassBright(), MAN_H - 0.012); band.rotation.x = Math.PI / 2;
    add(capGeo(), body, MAN_H - 0.012);
    add(crownGeo(), brassBright(), MAN_H + 0.472 * 0.86 - 0.06).scale.set(1.3, 1.45, 1.3);
  }
  grp.userData = { height: king ? KING_H : MAN_H };
  return grp;
}

// ---------------------------------------------------------------- the table: walnut top, a woven kilim under the board
function kilimCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rngOf(33);
  x.fillStyle = '#4e1411'; x.fillRect(0, 0, S, S);
  const band = (inset, w, col) => { x.fillStyle = col; x.beginPath(); x.rect(inset, inset, S - 2 * inset, S - 2 * inset); x.rect(inset + w, inset + w, S - 2 * (inset + w), S - 2 * (inset + w)); x.fill('evenodd'); };
  band(0, 36, '#131d3a'); band(36, 14, '#c9b684'); band(50, 40, '#64201a');
  // zig-zag guard stripe
  x.strokeStyle = '#e8d6a6'; x.lineWidth = 6; x.beginPath(); for (let i = 0; i <= 40; i++) { const px = 90 + (i / 40) * (S - 180), py = 112 + (i % 2 ? 12 : -12); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  // field: lozenges
  const n = 7, cell = (S - 260) / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = 130 + (i + 0.5) * cell, cy = 130 + (j + 0.5) * cell, k = (i + j) % 2;
    x.fillStyle = k ? '#131d3a' : '#a06c20'; x.beginPath(); x.moveTo(cx, cy - cell * 0.42); x.lineTo(cx + cell * 0.42, cy); x.lineTo(cx, cy + cell * 0.42); x.lineTo(cx - cell * 0.42, cy); x.closePath(); x.fill();
    x.fillStyle = k ? '#c9b684' : '#4e1411'; x.beginPath(); x.moveTo(cx, cy - cell * 0.2); x.lineTo(cx + cell * 0.2, cy); x.lineTo(cx, cy + cell * 0.2); x.lineTo(cx - cell * 0.2, cy); x.closePath(); x.fill();
  }
  // woven noise
  for (let i = 0; i < 26000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(r() * S, r() * S, 2 + r() * 3, 1); }
  for (let i = 0; i < S; i += 6) { x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(0, i, S, 2); }
  return c;
}
export function buildTable() {
  const g = new THREE.Group(); g.name = 'table';
  const top = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), B.material('darkWood', { color: '#3a1f10', color2: '#5a3820', seed: 12, repeat: [14, 14], roughness: 0.5 }));
  top.rotation.x = -Math.PI / 2; top.position.y = -0.002; top.receiveShadow = true; g.add(top);
  const kil = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 13.4), new THREE.MeshStandardMaterial({ map: canvasTex(kilimCanvas()), roughness: 0.96, bumpScale: 0.3 }));
  kil.rotation.x = -Math.PI / 2; kil.position.y = 0.006; kil.receiveShadow = true; g.add(kil);
  return g;
}

// ---------------------------------------------------------------- tea-house props
export function buildTeaSet() {
  const g = new THREE.Group(); g.name = 'tea';
  const porcelain = new THREE.MeshPhysicalMaterial({ color: '#f7f2e6', roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.08 });
  const gold = memo('goldRim', () => B.material('brass', { color: '#d9a93a', color2: '#f6dc8a', roughness: 0.25, seed: 4 }));
  const saucer = new THREE.Mesh(B.lathe([[0, 0.02], [0.22, 0.014], [0.45, 0.05], [0.56, 0.1], [0.58, 0.1], [0.58, 0.115], [0.56, 0.115], [0.44, 0.07], [0.22, 0.04], [0, 0.04]], 56), porcelain);
  saucer.castShadow = true; saucer.receiveShadow = true; g.add(saucer);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.575, 0.012, 8, 56), gold); rim.rotation.x = Math.PI / 2; rim.position.y = 0.108; g.add(rim);
  const glassMat = B.material('glass', { color: '#e4f2fa' });
  const outer = [[0, 0.04], [0.15, 0.04], [0.18, 0.055], [0.19, 0.1], [0.15, 0.2], [0.125, 0.3], [0.14, 0.42], [0.2, 0.55], [0.245, 0.66], [0.255, 0.7]];
  const glass = new THREE.Mesh(B.lathe(outer, 48), glassMat); glass.material.side = THREE.DoubleSide; glass.renderOrder = 2; g.add(glass);
  const tea = new THREE.Mesh(B.lathe([[0, 0.06], [0.14, 0.06], [0.17, 0.1], [0.14, 0.2], [0.115, 0.3], [0.13, 0.42], [0.175, 0.54], [0.18, 0.56], [0, 0.56]], 40),
    new THREE.MeshStandardMaterial({ color: '#b2531a', emissive: '#6a2a08', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.0 }));
  g.add(tea);
  const grim = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.01, 8, 48), gold); grim.rotation.x = Math.PI / 2; grim.position.y = 0.7; g.add(grim);
  // two sugar cubes on the saucer and a spoon
  const cube = B.roundedBox(0.14, 0.12, 0.14, 0.025), cm = new THREE.MeshStandardMaterial({ color: '#fbf7ee', roughness: 0.85 });
  for (const [x, z, ry] of [[0.36, 0.08, 0.3], [0.34, -0.1, -0.5]]) { const c = new THREE.Mesh(cube, cm); c.position.set(x, 0.14, z); c.rotation.y = ry; c.castShadow = true; g.add(c); }
  const spoon = new THREE.Mesh(B.roundedBox(0.5, 0.012, 0.06, 0.005), gold); spoon.position.set(-0.05, 0.09, 0.28); spoon.rotation.set(0, -0.5, 0.06); spoon.castShadow = true; g.add(spoon);
  g.userData.steamAt = new THREE.Vector3(0, 0.74, 0);
  return g;
}

function mosaicCanvas(seed, hues) {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), r = rngOf(seed);
  x.fillStyle = '#2a0e08'; x.fillRect(0, 0, S, S);
  const pts = []; for (let i = 0; i < 70; i++) pts.push([r() * S, r() * S, hues[Math.floor(r() * hues.length)]]);
  for (let py = 0; py < S; py += 3) for (let px = 0; px < S; px += 3) {
    let bi = 0, bd = 1e9; for (let i = 0; i < pts.length; i++) { const dx = Math.min(Math.abs(px - pts[i][0]), S - Math.abs(px - pts[i][0])), dy = py - pts[i][1], d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }
    x.fillStyle = pts[bi][2]; x.fillRect(px, py, 3, 3);
  }
  x.strokeStyle = 'rgba(30,10,4,0.6)'; x.lineWidth = 1; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(r() * S, r() * S, 10 + r() * 26, 0, TAU); x.stroke(); }
  return c;
}
// a Turkish mosaic lamp: glowing glass globe on a brass cap, hung on a chain
export function buildLamp(seed = 1, hues = ['#e8442a', '#f2b232', '#1f8fa8', '#2f4fb8', '#f6e2a0']) {
  const g = new THREE.Group();
  const prof = [[0.0, -0.62], [0.12, -0.6], [0.26, -0.45], [0.36, -0.2], [0.4, 0.05], [0.34, 0.28], [0.2, 0.42], [0.13, 0.5], [0.0, 0.5]];
  const globe = new THREE.Mesh(B.lathe(prof, 36), new THREE.MeshBasicMaterial({ map: canvasTex(mosaicCanvas(seed, hues)), fog: false }));
  g.add(globe);
  const brass = B.material('brass', { color: '#d9a93a', color2: '#f6dc8a', seed: 2 });
  const cap = new THREE.Mesh(B.lathe([[0, 0.5], [0.15, 0.5], [0.16, 0.56], [0.1, 0.64], [0.04, 0.7], [0, 0.72]], 24), brass); g.add(cap);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 6, 5), brass); chain.position.y = 3.7; g.add(chain);
  g.userData.hues = hues;
  return g;
}

// ---------------------------------------------------------------- the small piece sprites for the 2D layer (plates, trays, diagrams)
export function pieceBounds() { return { man: MAN_H, king: KING_H }; }
