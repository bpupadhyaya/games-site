// The andron: a lamplit dining room with a pebble-mosaic floor, a frescoed back wall (meanders, palmette chains, rosette tondi, no figures or
// symbols), fluted columns, timber beams and a dark ceiling that fades into the lamplight. Metres; floor y = 0; the action plane is z = 0.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { meanderPath, rosette, makeColumn } from './props.js';

const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const ctex = (c, { repeat, aniso = 8 } = {}) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; };

function palmetteChain(x, cx, cy, r, up) {
  const s = up ? 1 : -1;
  for (let k = -3; k <= 3; k++) {
    const a = k * 0.36;
    x.save(); x.translate(cx, cy); x.rotate(a * s);
    x.beginPath(); x.ellipse(0, -s * r * 0.62, r * 0.15, r * 0.52, 0, 0, TAU); x.fill();
    x.restore();
  }
  x.beginPath(); x.arc(cx, cy, r * 0.2, 0, TAU); x.fill();
}

export function wallTexture() {
  const W = 2048, H = 1024, c = cv(W, H), x = c.getContext('2d'), r = rng(21);
  // plaster field: warm ochre with soft mottling and a lime-wash gradient
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5e2412'); gr.addColorStop(0.5, '#8a3a1e'); gr.addColorStop(1, '#7a3318'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { const px = r() * W, py = r() * H, rr = 30 + r() * 150, g2 = x.createRadialGradient(px, py, 0, px, py, rr); g2.addColorStop(0, r() < 0.5 ? 'rgba(255,200,140,0.07)' : 'rgba(60,15,5,0.09)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  // dado: black band with a cream dot line and meander in terracotta
  const dado = H * 0.28;
  x.fillStyle = '#17110e'; x.fillRect(0, H - dado, W, dado);
  x.fillStyle = '#e9c46a'; x.fillRect(0, H - dado - 6, W, 6);
  x.strokeStyle = '#d98450'; x.lineWidth = 6; x.lineJoin = 'miter'; meanderPath(x, 0, H - dado + 40, W, 88, 118); x.stroke();
  x.fillStyle = '#f0e2c0'; for (let i = 0; i < 128; i++) { x.beginPath(); x.arc(8 + i * 16, H - 22, 3, 0, TAU); x.fill(); }
  // main field: panels framed by thin cream lines, each with a rosette tondo and flanking palmette chains
  const top = H * 0.22, bot = H - dado - 30, n = 6, pw = W / n;
  for (let i = 0; i < n; i++) {
    const px = i * pw + 22, w = pw - 44;
    x.fillStyle = i % 2 ? 'rgba(80,18,8,0.20)' : 'rgba(255,190,120,0.10)'; x.fillRect(px, top, w, bot - top);
    x.strokeStyle = 'rgba(23,17,14,0.75)'; x.lineWidth = 5; x.strokeRect(px, top, w, bot - top);
    x.strokeStyle = 'rgba(233,196,106,0.8)'; x.lineWidth = 2; x.strokeRect(px + 9, top + 9, w - 18, bot - top - 18);
    const cx = px + w / 2, cy = (top + bot) / 2 - 30, rr = Math.min(w, bot - top) * 0.15;
    x.fillStyle = '#17110e'; x.beginPath(); x.arc(cx, cy, rr * 1.12, 0, TAU); x.fill();
    x.strokeStyle = '#e9c46a'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, rr * 1.07, 0, TAU); x.stroke();
    rosette(x, cx, cy, rr, i % 2 ? '#d98450' : '#e9c46a', '#17110e');
    x.fillStyle = 'rgba(23,17,14,0.55)';
    for (let k = 0; k < 4; k++) palmetteChain(x, px + w * (0.2 + k * 0.2), bot - 70, w * 0.085, k % 2 === 0);
    for (let k = 0; k < 4; k++) palmetteChain(x, px + w * (0.2 + k * 0.2), top + 66, w * 0.085, k % 2 !== 0);
  }
  // frieze band at the top: black with terracotta meander and cream rosettes
  const fh = H * 0.19;
  x.fillStyle = '#17110e'; x.fillRect(0, 0, W, fh);
  x.fillStyle = '#e9c46a'; x.fillRect(0, fh, W, 7);
  x.strokeStyle = '#d98450'; x.lineWidth = 7; meanderPath(x, 0, 24, W, fh - 48, 112); x.stroke();
  x.fillStyle = 'rgba(0,0,0,0.0)';
  return ctex(c);
}

export function floorTexture() {
  // stone slabs with a pebble-mosaic feel: dark terracotta tesserae in rough rows, light grout
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(8);
  x.fillStyle = '#2a1a12'; x.fillRect(0, 0, S, S);
  const tiles = 8, ts = S / tiles;
  for (let j = 0; j < tiles; j++) for (let i = 0; i < tiles; i++) {
    const shade = 0.7 + r() * 0.5, R = Math.round(120 * shade), G = Math.round(62 * shade), Bc = Math.round(36 * shade);
    x.fillStyle = `rgb(${R},${G},${Bc})`; x.fillRect(i * ts + 3, j * ts + 3, ts - 6, ts - 6);
    for (let k = 0; k < 90; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,170,0.07)' : 'rgba(20,6,0,0.12)'; x.fillRect(i * ts + 6 + r() * (ts - 12), j * ts + 6 + r() * (ts - 12), 2 + r() * 5, 2 + r() * 5); }
  }
  const t = ctex(c, { repeat: [5, 3] });
  return t;
}

export function mosaicTexture() {
  // the central mosaic panel under the action: black ground, cream border with a meander, a ring of dolphins' scales and a central rosette
  const W = 1536, H = 1024, c = cv(W, H), x = c.getContext('2d'), r = rng(31);
  x.fillStyle = '#17110e'; x.fillRect(0, 0, W, H);
  // tesserae noise
  for (let i = 0; i < 24000; i++) { const g = r(); x.fillStyle = g < 0.5 ? 'rgba(255,230,180,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * W, r() * H, 4, 4); }
  x.strokeStyle = '#f0e2c0'; x.lineWidth = 10; x.strokeRect(40, 40, W - 80, H - 80);
  x.strokeStyle = '#d98450'; x.lineWidth = 5; meanderPath(x, 70, 72, W - 140, 66, 92); x.stroke();
  x.save(); x.translate(0, H - 210); meanderPath(x, 70, 72, W - 140, 66, 92); x.stroke(); x.restore();
  x.strokeStyle = '#e9c46a'; x.lineWidth = 5; x.strokeRect(62, 160, W - 124, H - 370);
  // scale ring pattern
  x.strokeStyle = 'rgba(240,226,192,0.55)'; x.lineWidth = 3;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 36; i++) { x.beginPath(); x.arc(100 + i * 38 + (j % 2) * 19, 190 + j * 15, 18, 0, Math.PI); x.stroke(); }
  for (let j = 0; j < 5; j++) for (let i = 0; i < 36; i++) { x.beginPath(); x.arc(100 + i * 38 + (j % 2) * 19, H - 395 + j * 15, 18, Math.PI, TAU); x.stroke(); }
  rosette(x, W / 2, H / 2 - 20, 150, '#d98450', '#17110e');
  x.strokeStyle = '#e9c46a'; x.lineWidth = 6; x.beginPath(); x.arc(W / 2, H / 2 - 20, 168, 0, TAU); x.stroke();
  for (const sx of [-1, 1]) rosette(x, W / 2 + sx * 480, H / 2 - 20, 84, '#e9c46a', '#17110e');
  return ctex(c);
}

// builds the room into `root`; returns handles for animation (lamp flames)
export function buildRoom(root, { tier = 'high' } = {}) {
  const h = {};
  const wallH = 6.4, backZ = -3.4;
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.78, metalness: 0, bumpMap: null }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(1.4, 0, 1.2); floor.receiveShadow = true; root.add(floor);
  const mos = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 6.6), new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.55, metalness: 0 }));
  mos.rotation.x = -Math.PI / 2; mos.position.set(1.7, 0.003, -1.0); mos.receiveShadow = true; root.add(mos);
  // back wall (fresco)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, wallH), new THREE.MeshStandardMaterial({ map: (() => { const t = wallTexture(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2.4, 1); return t; })(), roughness: 0.92, metalness: 0, color: 0xcfc0b0 }));
  wall.position.set(1.7, wallH / 2, backZ); wall.receiveShadow = true; root.add(wall);
  // side walls (plain plaster, darker)
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x6a2c16, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(18, wallH), sideMat); w.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; w.position.set(1.7 + sx * 8.4, wallH / 2, 1.6); root.add(w);
  }
  // (no ceiling: the room is tall and falls into lamplit darkness above the frieze)
  // columns framing the room
  const cols = [[-2.5, -2.4], [5.6, -2.6]];
  h.columns = cols.map(([x, z]) => { const c = makeColumn(wallH - 0.35, 0.27); c.position.set(x, 0, z); root.add(c); return c; });
  // wall sconce-like stone plinth with the krater placed by the world
  return h;
}
