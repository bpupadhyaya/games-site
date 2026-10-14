// Patolli 3D models: the carved stone cross, sculpted stone pieces, beans, the temple courtyard with torches.
// Pure construction (no sim state). The presenter positions them from the simulation state each frame.
import { board3d as B, THREE } from '../vendor3d/index.js';
import { LOOP_XY, SPINE_XY, QUARTER, GRID, isEntry, isTrap, isBoost } from '../src/engine.js';
import { pieceUV } from '../src/boardview.js';

const TAU = Math.PI * 2;
export const W = (u) => u - GRID / 2;                  // grid coordinate -> world x or z
export const Y = { floor: -0.24, dais: 0, base: 0.3, tray: 0.36, plate: 0.44, tile: 0.51 };
export const TILE_TOP = Y.tile;
const TRAY_CELL = [[6, 0], [6, 6], [0, 6], [0, 0]];
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const rnd = (s) => { let x = s >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };

export const SEAT3 = [
  { name: 'Jade', col: '#1fae74', hi: '#7ff0bd', glow: '#6dffc0', emis: '#04381f' },
  { name: 'Cochineal', col: '#d23a1c', hi: '#ff9a74', glow: '#ff8a5a', emis: '#4a0c02' },
  { name: 'Maya blue', col: '#2f86e6', hi: '#9fd0ff', glow: '#7fc0ff', emis: '#06284e' },
  { name: 'Amaranth', col: '#a8399c', hi: '#f0a0e6', glow: '#ff90ee', emis: '#3a0a34' },
];

// Polished-stone textures for the four seats (jade veining, carnelian banding, turquoise matrix, violet obsidian).
function gemCanvas(kind) {
  const S = 512, c = cv(S), x = c.getContext('2d'), r = rnd(kind.length * 977 + 3);
  const P = { jade: ['#075c3c', '#1ea872', '#a8ffd8'], carnelian: ['#7a1606', '#d8451c', '#ffb488'], turquoise: ['#0d5fa8', '#2fa4ea', '#d4f2ff'], obsidian: ['#1c0a22', '#6a2370', '#ffb0f2'] }[kind];
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, P[0]); g.addColorStop(0.5, P[1]); g.addColorStop(1, P[0]); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { const gx = r() * S, gy = r() * S, rr = 30 + r() * 120, gr = x.createRadialGradient(gx, gy, 0, gx, gy, rr); gr.addColorStop(0, r() < 0.5 ? `${P[1]}aa` : `${P[0]}cc`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(gx - rr, gy - rr, rr * 2, rr * 2); }
  x.lineCap = 'round';
  for (let i = 0; i < (kind === 'turquoise' ? 26 : 14); i++) {
    x.strokeStyle = kind === 'turquoise' ? 'rgba(40,20,8,0.55)' : `rgba(${kind === 'obsidian' ? '255,170,240' : '255,255,255'},${0.18 + r() * 0.3})`; x.lineWidth = 0.8 + r() * 2.2;
    x.beginPath(); let px = r() * S, py = r() * S; x.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (r() - 0.5) * 110; py += (r() - 0.5) * 70; x.lineTo(px, py); } x.stroke();
  }
  if (kind === 'carnelian') for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(255,${190 + (r() * 40) | 0},120,${0.12 + r() * 0.1})`; x.fillRect(0, i * 56 + r() * 20, S, 10 + r() * 14); }
  for (let i = 0; i < 400; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, ...o });

// ---------------------------------------------------------------- textures
export function fretCanvas() {
  const S = 2048, c = cv(S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  const band = (px, py, w, h) => {      // stepped-fret (xicalcoliuhqui style) band: a plain geometric stair pattern
    const unit = h, n = Math.floor(w / (unit * 2.4));
    x.save(); x.beginPath(); x.rect(px, py, w, h); x.clip();
    x.strokeStyle = '#e8b645'; x.lineWidth = h * 0.12; x.lineJoin = 'miter';
    for (let i = 0; i < n; i++) {
      const x0 = px + i * (w / n), u = (w / n) / 6, s = h / 4;
      x.beginPath();
      x.moveTo(x0, py + h - s); x.lineTo(x0 + u, py + h - s); x.lineTo(x0 + u, py + s * 2); x.lineTo(x0 + u * 3, py + s * 2); x.lineTo(x0 + u * 3, py + s * 3); x.lineTo(x0 + u * 2, py + s * 3);
      x.moveTo(x0 + u * 3, py + h - s); x.lineTo(x0 + u * 4, py + h - s); x.lineTo(x0 + u * 4, py + s); x.lineTo(x0 + u * 6, py + s); x.lineTo(x0 + u * 6, py + h - s);
      x.stroke();
    }
    x.restore();
  };
  const m = S * 0.026, bh = S * 0.03;
  x.save();
  band(m, m, S - 2 * m, bh);
  x.translate(S, 0); x.rotate(Math.PI / 2); band(m, m, S - 2 * m, bh); x.restore();
  x.save(); x.translate(S, S); x.rotate(Math.PI); band(m, m, S - 2 * m, bh); x.restore();
  x.save(); x.translate(0, S); x.rotate(-Math.PI / 2); band(m, m, S - 2 * m, bh); x.restore();
  x.strokeStyle = 'rgba(232,182,69,0.9)'; x.lineWidth = 5; x.strokeRect(m * 0.5, m * 0.5, S - m, S - m); x.strokeRect(m + bh * 1.35, m + bh * 1.35, S - 2 * (m + bh * 1.35), S - 2 * (m + bh * 1.35));
  return c;
}
function flagCanvas(S = 1024) {
  const c = cv(S), x = c.getContext('2d'), r = rnd(11), b = cv(S), bx = b.getContext('2d');
  x.fillStyle = '#4a3f38'; x.fillRect(0, 0, S, S); bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  const n = 4, f = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const t = 0.82 + r() * 0.36, px = i * f, py = j * f;
    x.fillStyle = `rgb(${Math.round(74 * t)},${Math.round(60 * t)},${Math.round(54 * t)})`; x.fillRect(px + 5, py + 5, f - 10, f - 10);
    for (let k = 0; k < 400; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,220,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(px + r() * f, py + r() * f, 1 + r() * 3, 1 + r() * 3); }
    bx.fillStyle = '#9a9a9a'; bx.fillRect(px + 5, py + 5, f - 10, f - 10);
  }
  return { map: c, bump: b };
}
function skyCanvas() {
  const c = cv(4, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#0e0f2c'); g.addColorStop(0.45, '#3a2255'); g.addColorStop(0.8, '#9a4a52'); g.addColorStop(1, '#d9803c');
  x.fillStyle = g; x.fillRect(0, 0, 4, 256); return c;
}
function radial(rgb, a = 1, S = 128, stops = [[0, 1], [0.4, 0.45], [1, 0]]) {
  const c = cv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [o, al] of stops) g.addColorStop(o, `rgba(${rgb},${a * al})`);
  x.fillStyle = g; x.fillRect(0, 0, S, S); return c;
}
function flameCanvas() {
  const S = 128, c = cv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S * 0.62, 2, S / 2, S * 0.62, S * 0.5);
  g.addColorStop(0, 'rgba(255,248,200,1)'); g.addColorStop(0.25, 'rgba(255,190,70,0.95)'); g.addColorStop(0.6, 'rgba(255,100,20,0.45)'); g.addColorStop(1, 'rgba(255,60,0,0)');
  x.fillStyle = g; x.save(); x.translate(S / 2, S / 2); x.scale(0.6, 1); x.translate(-S / 2, -S / 2); x.fillRect(0, 0, S, S); x.restore();
  return c;
}
export const textures = {
  flame: () => memo('t:flame', () => tex(flameCanvas())),
  glow: () => memo('t:glow', () => tex(radial('255,190,110', 1))),
  white: () => memo('t:white', () => tex(radial('255,255,255', 1))),
  ring: () => memo('t:ring', () => { const S = 128, c = cv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, S * 0.34, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.28, 'rgba(255,255,255,1)'); g.addColorStop(0.62, 'rgba(255,255,255,1)'); g.addColorStop(0.85, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(c); }),
  sky: () => memo('t:sky', () => tex(skyCanvas())),
};

// ---------------------------------------------------------------- stone pieces
const GLYPH = {
  circle: (r) => Array.from({ length: 20 }, (_, k) => [Math.cos((k / 20) * TAU) * r, Math.sin((k / 20) * TAU) * r]),
  diamond: (r) => [[0, -r * 1.15], [r * 0.95, 0], [0, r * 1.15], [-r * 0.95, 0]],
  square: (r) => [[-r * 0.85, -r * 0.85], [r * 0.85, -r * 0.85], [r * 0.85, r * 0.85], [-r * 0.85, r * 0.85]],
  triangle: (r) => [[0, -r * 1.05], [r * 1.0, r * 0.8], [-r * 1.0, r * 0.8]],
};
const SHAPE = ['circle', 'diamond', 'square', 'triangle'];
export const PIECE_H = 0.56;
function pieceBodyGeo(seat) {
  return memo(`pg:${seat}`, () => {
    if (seat === 0) return B.lathe([[0, 0], [0.33, 0], [0.37, 0.03], [0.385, 0.12], [0.35, 0.28], [0.27, 0.42], [0.16, 0.52], [0.0, 0.56]], 56);
    if (seat === 1) { const g = B.lathe([[0, 0], [0.4, 0], [0.43, 0.04], [0.43, 0.16], [0.33, 0.34], [0.16, 0.5], [0.0, 0.56]], 4); g.rotateY(Math.PI / 4); return g; }
    if (seat === 2) return B.roundedBox(0.62, 0.5, 0.62, 0.09, 5);
    const g = B.lathe([[0, 0], [0.5, 0], [0.5, 0.06], [0.34, 0.3], [0.14, 0.5], [0, 0.56]], 3); g.rotateY(-Math.PI / 2); return g;
  });
}
function pieceMat(seat) {
  const s = SEAT3[seat];
  return memo(`pm:${seat}`, () => {
    const kind = ['jade', 'carnelian', 'turquoise', 'obsidian'][seat], map = tex(gemCanvas(kind), [1, 1]);
    if (seat === 0) return phys('#ffffff', { map, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.12, emissive: s.emis, emissiveIntensity: 0.5, envMapIntensity: 1.0 });
    if (seat === 1) return phys('#ffffff', { map, roughness: 0.22, flatShading: true, emissive: s.emis, emissiveIntensity: 0.4, envMapIntensity: 1.3 });
    if (seat === 2) return phys('#ffffff', { map, roughness: 0.2, emissive: s.emis, emissiveIntensity: 0.4, envMapIntensity: 1.3 });
    return phys('#ffffff', { map, roughness: 0.1, metalness: 0.1, flatShading: true, emissive: s.emis, emissiveIntensity: 0.5, envMapIntensity: 1.8 });
  });
}
const ivoryMat = () => memo('mat:ivory', () => B.material('ivory', {}));
const goldMat = () => memo('mat:gold', () => B.material('brass', {}));
export const goldMaterial = goldMat;
export function makePiece(seat) {
  const s = seat % 4, g = new THREE.Group(), rig = new THREE.Group();
  const body = new THREE.Mesh(pieceBodyGeo(s), pieceMat(s));
  body.castShadow = true; body.receiveShadow = true;
  if (s === 2) body.position.y = 0.25;
  rig.add(body);
  // inlaid cream mark on the top (each seat has its own shape: colour is never the only cue)
  const topY = s === 0 ? 0.56 : s === 1 ? 0.56 : s === 2 ? 0.5 : 0.56;
  const mark = new THREE.Mesh(B.inlay(GLYPH[SHAPE[s]](0.072), 0.03, { bevel: 0.004 }), ivoryMat());
  mark.position.y = topY - 0.004; mark.castShadow = false; rig.add(mark);
  // gold collar so the stones read as precious
  const collar = new THREE.Mesh(new THREE.TorusGeometry(s === 3 ? 0.36 : 0.38, 0.02, 8, s === 0 ? 48 : 4), goldMat());
  collar.rotation.x = Math.PI / 2; collar.position.y = 0.06; if (s === 1) collar.rotation.z = Math.PI / 4; if (s === 2) { collar.scale.set(0.92, 0.92, 0.92); }
  if (s === 3) collar.visible = false; if (s === 1 || s === 2) collar.visible = false;
  rig.add(collar);
  if (s === 0) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.356, 0.012, 8, 48), goldMat()); band.rotation.x = Math.PI / 2; band.position.y = 0.285; rig.add(band); }
  const shadow = B.contactShadow(0.46, 0.62);
  g.add(shadow, rig);
  g.userData = { rig, shadow, seat: s, body };
  return g;
}

// ---------------------------------------------------------------- beans
function beanMap() {
  return memo('t:bean', () => {
    const S = 256, c = cv(S), x = c.getContext('2d'), r = rnd(5);
    x.fillStyle = '#6a3b1c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,214,150,0.10)' : 'rgba(20,8,0,0.16)'; x.beginPath(); x.ellipse(r() * S, r() * S, 1 + r() * 6, 1 + r() * 3, r() * 3, 0, TAU); x.fill(); }
    for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(30,12,2,0.35)'; x.fillRect(r() * S, r() * S, 2, 2); }
    return tex(c);
  });
}
export function makeBean() {
  const g = new THREE.Group(), R = [0.5, 0.2, 0.31];
  const body = new THREE.Mesh(memo('bg', () => new THREE.SphereGeometry(1, 28, 18)), memo('bm', () => new THREE.MeshStandardMaterial({ map: beanMap(), roughness: 0.42, metalness: 0, color: '#d9b08a' })));
  body.scale.set(R[0], R[1], R[2]); body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  // the drilled face: a pale worked patch bent onto the bean's top, with the dark drill hole
  const patch = (rad, mat, lift) => {
    const geo = new THREE.CircleGeometry(rad, 28, 0, TAU); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i); p.setY(i, R[1] * Math.sqrt(Math.max(0.0001, 1 - (px / R[0]) ** 2 - (pz / R[2]) ** 2)) + lift); }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  g.add(patch(0.205, memo('bpm', () => new THREE.MeshStandardMaterial({ color: '#f4e7c6', roughness: 0.55 })), 0.004));
  g.add(patch(0.07, memo('bhm', () => new THREE.MeshStandardMaterial({ color: '#1a0c05', roughness: 0.9 })), 0.007));
  const shadow = B.contactShadow(0.62, 0.55); shadow.scale.set(1.2, 1, 0.8);
  return { group: g, body, shadow };
}

// ---------------------------------------------------------------- the cross
const CELL = 0.9;
function plusCells() {
  const out = [];
  for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) if ((gx >= 3 && gx <= 5) || (gy >= 3 && gy <= 5)) out.push([gx, gy]);
  return out;
}
const rotate = (pts, a) => pts.map(([x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]);
const GLYPHS = [
  // stair-step
  [[-0.3, 0.3], [-0.3, 0.12], [-0.12, 0.12], [-0.12, -0.06], [0.06, -0.06], [0.06, -0.24], [0.3, -0.24], [0.3, -0.1], [0.18, -0.1], [0.18, 0.06], [0, 0.06], [0, 0.24], [-0.12, 0.24], [-0.12, 0.3]],
  // plus
  [[-0.08, -0.3], [0.08, -0.3], [0.08, -0.08], [0.3, -0.08], [0.3, 0.08], [0.08, 0.08], [0.08, 0.3], [-0.08, 0.3], [-0.08, 0.08], [-0.3, 0.08], [-0.3, -0.08], [-0.08, -0.08]],
  // eight-point sun
  B.starPoints(8, 0.3, 0.13, Math.PI / 8),
];
const ring = (outer, inner) => {
  const sh = new THREE.Shape([[-outer, outer], [outer, outer], [outer, -outer], [-outer, -outer]].map(([x, z]) => new THREE.Vector2(x, -z)));
  const hole = new THREE.Path([[-inner, inner], [-inner, -inner], [inner, -inner], [inner, inner]].map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.holes.push(hole); return sh;
};
function sandMat(i) { return memo(`sand${i}`, () => B.material('stone', { color: '#a88a5a', color2: '#c9a972', seed: 21 + i, size: 256, roughness: 0.6 })); }

/** The carved board (rebuilt only when the seated arms change). armSeat[arm] = seat or null. Returns { group, glints }. */
export function buildBoard(armSeat) {
  const g = new THREE.Group();
  const glints = [];
  // dais steps and the base slab
  const step = new THREE.Mesh(B.slab(11.4, 11.4, 0.24, 0.5, 0.07), memo('daisM', () => B.material('stone', { color: '#6a5b4c', color2: '#8c7a66', seed: 4, repeat: [2, 2], roughness: 0.8 })));
  step.position.y = -0.24; step.receiveShadow = true; step.castShadow = true; g.add(step);
  const base = new THREE.Mesh(B.slab(9.7, 9.7, 0.3, 0.3, 0.07), memo('baseM', () => B.material('stone', { color: '#3a312a', color2: '#5b4b3c', seed: 8, repeat: [2, 2], roughness: 0.74 })));
  base.castShadow = true; base.receiveShadow = true; g.add(base);
  const fret = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), memo('fretM', () => new THREE.MeshStandardMaterial({ map: tex(fretCanvas()), transparent: true, metalness: 0.7, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })));
  fret.rotation.x = -Math.PI / 2; fret.position.y = Y.base + 0.003; g.add(fret);
  // the cross plate
  const plateM = memo('plateM', () => B.material('stone', { color: '#5e4a30', color2: '#7f6845', seed: 30, repeat: [2, 2], roughness: 0.7 }));
  const p1 = new THREE.Mesh(B.slab(3.3, 9.0, 0.14, 0.14, 0.05), plateM), p2 = new THREE.Mesh(B.slab(9.0, 3.3, 0.14, 0.14, 0.05), plateM);
  for (const p of [p1, p2]) { p.position.y = Y.base; p.castShadow = true; p.receiveShadow = true; g.add(p); }
  // corner trays: pits and home slots
  const trayM = memo('trayM', () => B.material('stone', { color: '#241c16', color2: '#3a2c22', seed: 12, roughness: 0.9 }));
  for (let arm = 0; arm < 4; arm++) {
    const [tx, ty] = TRAY_CELL[arm], seat = armSeat[arm], cx = W(tx + 1.5), cz = W(ty + 1.5);
    const tray = new THREE.Mesh(B.slab(2.84, 2.84, 0.06, 0.14, 0.02), trayM); tray.position.set(cx, Y.base, cz); tray.receiveShadow = true; g.add(tray);
    const colr = seat == null ? '#7a6a48' : SEAT3[seat % 4].col;
    const frame = new THREE.Mesh(B.inlay(ring(1.41, 1.33), 0.03, { bevel: 0.006 }), seat == null ? memo('dimGold', () => B.material('brass', { color: '#6f5d33', color2: '#8c7544' })) : phys(colr, { roughness: 0.25, emissive: colr, emissiveIntensity: 0.35 }));
    frame.position.set(cx, Y.tray, cz); g.add(frame);
    for (let j = 0; j < 6; j++) {
      const p = pieceUV(arm, j, 0), pit = new THREE.Mesh(new THREE.CircleGeometry(0.33, 28), memo('pitM', () => new THREE.MeshBasicMaterial({ map: tex(radial('0,0,0', 1, 128, [[0, 0.95], [0.78, 0.85], [1, 0]])), transparent: true, depthWrite: false })));
      pit.rotation.x = -Math.PI / 2; pit.position.set(W(p.x), Y.tray + 0.004, W(p.y)); g.add(pit);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.025, 8, 28), memo('lipM', () => new THREE.MeshStandardMaterial({ color: '#8c7757', roughness: 0.6 })));
      lip.rotation.x = Math.PI / 2; lip.position.set(W(p.x), Y.tray + 0.01, W(p.y)); g.add(lip);
      const hq = pieceUV(arm, j, 36), slot = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 24), goldMat());
      slot.rotation.x = Math.PI / 2; slot.position.set(W(hq.x), Y.tray + 0.012, W(hq.y)); g.add(slot);
    }
  }
  // tiles
  const loopAt = new Map(); LOOP_XY.forEach(([x, y], i) => loopAt.set(x * 16 + y, i));
  const spineArm = (gx, gy) => SPINE_XY.findIndex((sp) => sp.some(([x, y]) => x === gx && y === gy));
  const tileGeo = memo('tileG', () => B.slab(CELL, CELL, 0.075, 0.12, 0.03));
  let n = 0;
  for (const [gx, gy] of plusCells()) {
    const li = loopAt.get(gx * 16 + gy), cx = W(gx + 0.5), cz = W(gy + 0.5);
    const grp = new THREE.Group(); grp.position.set(cx, Y.plate, cz); g.add(grp);
    let mat = sandMat(n++ % 4), glyph = null;
    if (li !== undefined) {
      const arm = Math.floor(li / QUARTER), seat = armSeat[arm];
      if (isEntry(li) && seat != null) mat = phys(SEAT3[seat % 4].col, { roughness: 0.28, emissive: SEAT3[seat % 4].emis, emissiveIntensity: 0.4 });
    } else {
      const sa = spineArm(gx, gy), seat = sa >= 0 ? armSeat[sa] : null;
      if (gx === 4 && gy === 4) mat = memo('centreM', () => B.material('stone', { color: '#bda070', color2: '#d9c093', seed: 3 }));
      else if (seat != null) mat = phys(SEAT3[seat % 4].col, { roughness: 0.32, emissive: SEAT3[seat % 4].emis, emissiveIntensity: 0.3 });
      else { mat = memo('plainM', () => B.material('stone', { color: '#6e5a3c', color2: '#8a7249', seed: 40, size: 256, roughness: 0.7 })); glyph = (gx * 3 + gy) % 3; }
    }
    const tile = new THREE.Mesh(tileGeo, mat); tile.receiveShadow = true; tile.castShadow = true; grp.add(tile);
    const top = 0.075;
    if (li !== undefined) {
      const arm = Math.floor(li / QUARTER), seat = armSeat[arm];
      if (isEntry(li)) {   // safe square: gold frame (+ gold chevron when no one sits here)
        const fr = new THREE.Mesh(B.inlay(ring(0.43, 0.35), 0.035, { bevel: 0.006 }), goldMat()); fr.position.y = top - 0.006; grp.add(fr); glints.push(fr);
        if (seat == null) { const ch = new THREE.Mesh(B.inlay([[-0.18, -0.08], [0, 0.12], [0.18, -0.08], [0.18, 0.0], [0, 0.2], [-0.18, 0.0]], 0.02), goldMat()); ch.position.y = top - 0.004; grp.add(ch); }
      } else if (isTrap(li)) {
        const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 28), memo('trapM', () => phys('#0b0a0c', { roughness: 0.18, metalness: 0.3, emissive: '#3a0a04', emissiveIntensity: 0.9 })));
        pit.position.y = top + 0.005; grp.add(pit);
        const inner = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), memo('trapIn', () => new THREE.MeshBasicMaterial({ color: '#7a1608' })));
        inner.rotation.x = -Math.PI / 2; inner.position.y = top + 0.028; grp.add(inner);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU, tooth = new THREE.Mesh(memo('toothG', () => new THREE.CylinderGeometry(0, 0.055, 0.17, 5)), memo('toothM', () => new THREE.MeshStandardMaterial({ color: '#efe0bc', roughness: 0.45 })));
          tooth.position.set(Math.cos(a) * 0.33, top + 0.05, Math.sin(a) * 0.33); tooth.rotation.z = Math.cos(a) * 0.5; tooth.rotation.x = -Math.sin(a) * 0.5; tooth.castShadow = true; grp.add(tooth);
        }
      } else if (isBoost(li)) {
        const gem = new THREE.Mesh(memo('gemG', () => { const q = B.lathe([[0, 0], [0.3, 0.12], [0.34, 0.2], [0.2, 0.34], [0, 0.4]], 8); return q; }), memo('gemM', () => phys('#25c4cf', { roughness: 0.05, flatShading: true, emissive: '#0a6a78', emissiveIntensity: 0.9, envMapIntensity: 2 })));
        gem.position.y = top - 0.02; gem.castShadow = true; grp.add(gem); glints.push(gem);
      } else {
        // direction chevron towards the next square on the loop
        const nx = LOOP_XY[(li + 1) % LOOP_XY.length], dx = Math.sign(nx[0] - gx), dz = Math.sign(nx[1] - gy);
        const base = [[-0.16, 0.12], [0, -0.1], [0.16, 0.12], [0.16, 0.2], [0, 0.0], [-0.16, 0.2]];
        const ang = Math.atan2(dx, -dz) ;
        const ch = new THREE.Mesh(B.inlay(rotate(base, ang), 0.018, { bevel: 0.004 }), memo('chevM', () => new THREE.MeshStandardMaterial({ color: '#3a2610', roughness: 0.8 })));
        ch.position.y = top - 0.003; grp.add(ch);
      }
    } else if (gx === 4 && gy === 4) {
      // the centre: stepped squares of cream, obsidian and gold (the shrine every piece is racing for)
      [[0.38, '#f0dcae', 0.03], [0.28, '#17130f', 0.05], [0.18, '#e9d3a0', 0.07], [0.09, '#e8b645', 0.1]].forEach(([r, c, h], k) => {
        const m = new THREE.Mesh(B.slab(r * 2, r * 2, 0.04, 0.02, 0.012), k === 3 ? memo('centreGold', () => B.material('brass', {})) : memo('c' + k, () => phys(c, { roughness: 0.4, clearcoat: 0.5 })));
        m.position.y = top - 0.005 + h * 0.5; grp.add(m);
        if (k === 3) glints.push(m);
      });
    } else if (glyph !== null) {
      const gl = new THREE.Mesh(B.inlay(GLYPHS[glyph], 0.016, { bevel: 0.003 }), memo('glyphM', () => new THREE.MeshStandardMaterial({ color: '#e0b34a', roughness: 0.4, metalness: 0.7 })));
      gl.position.y = top - 0.002; grp.add(gl);
    } else if (armSeat[spineArm(gx, gy)] != null) {
      const ins = new THREE.Mesh(B.inlay([[-0.26, -0.26], [0.26, -0.26], [0.26, 0.26], [-0.26, 0.26]], 0.018, { bevel: 0.004 }), memo('spineIn', () => new THREE.MeshStandardMaterial({ color: '#f4ecd8', roughness: 0.5, transparent: true, opacity: 0.55 })));
      ins.position.y = top - 0.003; grp.add(ins);
    }
  }
  return { group: g, glints };
}

// ---------------------------------------------------------------- torches, floor, embers
export function makeTorch(h = 2.0) {
  const g = new THREE.Group();
  const stone = memo('torchStone', () => B.material('stone', { color: '#6a5b4c', color2: '#8c7a66', seed: 50, size: 256, roughness: 0.8 }));
  const post = new THREE.Mesh(B.lathe([[0, 0], [0.34, 0], [0.34, 0.12], [0.24, 0.2], [0.2, 0.5], [0.2, h - 0.35], [0.3, h - 0.28], [0.34, h - 0.12], [0.3, h - 0.06], [0.0, h - 0.06]], 24), stone);
  post.castShadow = true; g.add(post);
  const bowl = new THREE.Mesh(B.lathe([[0, 0], [0.18, 0.04], [0.32, 0.18], [0.36, 0.26], [0.0, 0.2]], 24), memo('bowlM', () => B.material('brass', { color: '#8a5e22', color2: '#c99a3a' })));
  bowl.position.y = h - 0.06; g.add(bowl);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.95), new THREE.MeshBasicMaterial({ map: textures.flame(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.y = h + 0.34; m.userData.k = i; g.add(m); flames.push(m);
  }
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ map: textures.glow(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.y = h + 0.3; g.add(halo);
  const light = new THREE.PointLight(0xff9a3c, 16, 22, 1.2); light.userData.base = 16; light.position.y = h + 0.5; g.add(light);
  g.userData = { flames, halo, light, h };
  return g;
}
export function updateTorch(t, time, camera, calm, phase = 0) {
  const { flames, halo, light, h } = t.userData, k = calm ? 0.25 : 1;
  const f = 1 + k * (0.1 * Math.sin(time * 9 + phase) + 0.07 * Math.sin(time * 15.3 + phase * 2) + 0.05 * Math.sin(time * 23 + phase));
  light.intensity = 16 * f; halo.scale.setScalar(0.92 + 0.12 * f); halo.material.opacity = 0.42 + 0.14 * f;
  flames.forEach((m, i) => {
    const w = 1 + k * 0.18 * Math.sin(time * (11 + i * 3) + i * 2 + phase);
    m.scale.set(0.9 * w * (1 - i * 0.18), (0.9 + 0.22 * f) * (1 - i * 0.1), 1);
    m.position.y = h + 0.3 + i * 0.05; m.position.x = k * 0.03 * Math.sin(time * 7 + i + phase);
    m.quaternion.copy(camera.quaternion);
  });
  halo.quaternion.copy(camera.quaternion);
}
export function buildCourtyard() {
  const g = new THREE.Group();
  const fl = flagCanvas();
  const floorMat = new THREE.MeshStandardMaterial({ map: tex(fl.map, [10, 10]), bumpMap: tex(fl.bump, [10, 10], false), bumpScale: 0.8, roughness: 0.85, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = Y.floor; floor.receiveShadow = true; g.add(floor);
  // a worn ceremonial ring in the paving round the dais
  const rc = cv(512), rx = rc.getContext('2d');
  rx.clearRect(0, 0, 512, 512); rx.strokeStyle = 'rgba(232,182,69,0.5)'; rx.lineWidth = 5;
  for (const r of [248, 236, 190]) { rx.beginPath(); rx.arc(256, 256, r, 0, TAU); rx.stroke(); }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; rx.save(); rx.translate(256 + Math.cos(a) * 214, 256 + Math.sin(a) * 214); rx.rotate(a); rx.fillStyle = 'rgba(232,182,69,0.45)'; rx.fillRect(-16, -5, 32, 10); rx.restore(); }
  const discM = new THREE.MeshBasicMaterial({ map: tex(rc), transparent: true, depthWrite: false, opacity: 0.8 });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), discM); disc.rotation.x = -Math.PI / 2; disc.position.y = Y.floor + 0.004; g.add(disc);
  // low carved stone blocks round the courtyard
  const blockM = memo('blockM', () => B.material('stone', { color: '#6a5b4c', color2: '#8c7a66', seed: 61, size: 256 }));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + 0.3, r = 12.5 + (k % 3) * 1.5, bw = 1.6 + (k % 4) * 0.5;
    const b = new THREE.Mesh(B.slab(bw, bw * 0.8, 1.0 + (k % 3) * 0.7, 0.1, 0.05), blockM);
    b.position.set(Math.cos(a) * r, Y.floor, Math.sin(a) * r * 0.9 - 2); b.rotation.y = a; b.castShadow = true; g.add(b);
  }
  return g;
}
