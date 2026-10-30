// Huarong Dao 3D world: the pass at night. Carved-lacquer blocks in the game's own role colours (a raised rim carved with a
// key fret, a diaper ground, the name and the general's weapon in relief, gold-filled), a black-lacquer tray with mother-of-pearl
// cloud inlay, a stone-paved road inside it with the goal inlaid in gold, an opening in the near rail (the gate) with two
// bronze-capped posts and warm torchlight spilling in from outside, a red brocade mat on a slate table. Title props: a bronze
// incense burner with rising smoke and a rolled map scroll. Everything is procedural (canvas textures, extruded shapes).
// Coordinates: X = virtual x, Z = virtual y (screen down), Y = height; 1 unit = 1 virtual px.
import * as THREE from '../vendor3d/three.js';
import { BLOCK, DISPLAY, CARVE } from '../src/art.js';

export const TILT = 33 * Math.PI / 180;          // camera tilt from straight down: the near walls of blocks and rails show
export const TAN = Math.tan(TILT);
export const T = 0.3;                            // block thickness in cells (a 2.5 cm cell -> 7.5 mm blocks)
export const RAIL = 0.27;                        // rail height above the road, in cells
export const BASE = 0.14;                        // tray base thickness under the road, in cells
const GAP = 0.04;                                // block inset from its cells, in cells (blocks never touch)
const BEV = 0.035;                               // block bevel, in cells

let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// ------------------------------------------------------------------------------------------------ textures
function slateTex() {
  seed = 99;
  const t = canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#20272b'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = 30 + rnd() * 160, g = x.createRadialGradient(cx, cy, 0, cx, cy, r), lt = rnd() < 0.5;
      g.addColorStop(0, lt ? 'rgba(120,140,150,0.07)' : 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    x.lineCap = 'round';
    for (let i = 0; i < 18; i++) {   // faint quartz veins
      x.strokeStyle = `rgba(170,185,190,${0.05 + rnd() * 0.07})`; x.lineWidth = 0.8 + rnd() * 1.6;
      let px = rnd() * w, py = rnd() * h; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 14; k++) { px += (rnd() - 0.3) * 70; py += (rnd() - 0.5) * 50; x.lineTo(px, py); }
      x.stroke();
    }
    for (let i = 0; i < 30000; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(200,215,220,0.03)'; x.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function brocadeTex() {
  seed = 7;
  const t = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#5c1210'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40000; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(20,0,0,0.12)' : 'rgba(255,120,90,0.05)'; x.fillRect(rnd() * w, rnd() * h, 2, 1); }
    // woven roundels: a small cloud medallion in gold thread on a lattice
    x.strokeStyle = 'rgba(214,160,80,0.32)'; x.lineWidth = 2.2;
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const cx = gx * 128 + (gy % 2 ? 64 : 0) + 32, cy = gy * 128 + 64;
      for (const X of cx > w ? [cx - w] : [cx]) {
        x.beginPath(); x.arc(X, cy, 22, 0, Math.PI * 2); x.stroke();
        for (let a = 0; a < 4; a++) { const ax = X + Math.cos(a * Math.PI / 2 + 0.78) * 30, ay = cy + Math.sin(a * Math.PI / 2 + 0.78) * 30; x.beginPath(); x.arc(ax, ay, 7, a * Math.PI / 2, a * Math.PI / 2 + Math.PI * 1.4); x.stroke(); }
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// black lacquer with mother-of-pearl cloud scrolls and a gold border line (rail tops)
function pearlTex() {
  seed = 31;
  const t = canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#0d0909'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { x.fillStyle = 'rgba(255,240,230,0.012)'; x.fillRect(rnd() * w, rnd() * h, 3, 1); }
    const scroll = (cx, cy, s, d) => {
      x.beginPath();
      for (let a = 0; a <= Math.PI * 2.6; a += 0.1) { const r = s * (0.25 + a * 0.16); const px = cx + Math.cos(a * d) * r, py = cy + Math.sin(a * d) * r * 0.75; a ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    };
    for (let i = 0; i < 46; i++) {
      const cx = rnd() * w, cy = rnd() * h, s = 18 + rnd() * 26, hue = 150 + rnd() * 160;
      const g = x.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
      g.addColorStop(0, `hsla(${hue},55%,82%,0.9)`); g.addColorStop(0.5, `hsla(${hue + 60},40%,92%,0.95)`); g.addColorStop(1, `hsla(${hue + 120},55%,78%,0.9)`);
      x.strokeStyle = g; x.lineWidth = 3.5; x.lineCap = 'round';
      scroll(cx, cy, s, rnd() < 0.5 ? 1 : -1);
      x.lineWidth = 2.5; scroll(cx + s * 1.3, cy + s * 0.2, s * 0.7, -1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// The road inside the tray: 4 x 5 stone flags (one per cell), the goal square inlaid in gold, the way out through the gate.
// One texture over the whole board plus the gate opening below it: u 0..1 across 4 cells, v over 5 cells + 1 cell of path.
const FW = 128;
function roadDraw(x, w, h, mask) {
  seed = 4242;
  if (!mask) {
    x.fillStyle = '#7d766a'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
      const x0 = c * FW, y0 = r * FW, tone = rnd();
      x.fillStyle = `rgba(${tone < 0.5 ? '40,34,28' : '200,190,170'},${0.05 + rnd() * 0.1})`; x.fillRect(x0, y0, FW, FW);
      for (let i = 0; i < 6; i++) {
        const cx = x0 + rnd() * FW, cy = y0 + rnd() * FW, rr = 10 + rnd() * 40, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, rnd() < 0.5 ? 'rgba(30,26,20,0.12)' : 'rgba(230,220,200,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, 2 * rr, 2 * rr);
      }
    }
    for (let i = 0; i < 26000; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,250,235,0.06)'; x.fillRect(rnd() * w, rnd() * h, 1.2, 1.2); }
    // joints between the flags
    x.strokeStyle = 'rgba(22,18,14,0.75)'; x.lineWidth = 4;
    for (let c = 0; c <= 4; c++) { x.beginPath(); x.moveTo(c * FW, 0); x.lineTo(c * FW, 5 * FW); x.stroke(); }
    for (let r = 0; r <= 5; r++) { x.beginPath(); x.moveTo(0, r * FW); x.lineTo(w, r * FW); x.stroke(); }
    x.strokeStyle = 'rgba(255,245,225,0.12)'; x.lineWidth = 1.5;
    for (let c = 0; c < 4; c++) { x.beginPath(); x.moveTo(c * FW + 3, 0); x.lineTo(c * FW + 3, 5 * FW); x.stroke(); }
    // the path out of the gate: worn, lighter stones
    x.fillStyle = 'rgba(210,190,150,0.18)'; x.fillRect(FW, 5 * FW, 2 * FW, FW);
    x.strokeStyle = 'rgba(22,18,14,0.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(2 * FW, 5 * FW); x.lineTo(2 * FW, 6 * FW); x.stroke();
  } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
  // the goal: a gold inlaid frame around the two cells in front of the gate, small corner knots
  const gx = FW + 12, gy = 3 * FW + 12, gw = 2 * FW - 24, gh = 2 * FW - 24;
  x.strokeStyle = mask ? '#fff' : '#d7ae5c'; x.lineWidth = 6; x.strokeRect(gx, gy, gw, gh);
  x.lineWidth = 2.5; x.strokeRect(gx + 12, gy + 12, gw - 24, gh - 24);
  x.fillStyle = mask ? '#fff' : '#d7ae5c';
  for (const [cx, cy] of [[gx, gy], [gx + gw, gy], [gx, gy + gh], [gx + gw, gy + gh]]) { x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.fillRect(-9, -9, 18, 18); x.restore(); }
}
const roadTex = () => canvasTex(4 * FW, 6 * FW, (x, w, h) => roadDraw(x, w, h, false));
const roadMask = () => canvasTex(4 * FW, 6 * FW, (x, w, h) => roadDraw(x, w, h, true), false);
const roadMetal = () => canvasTex(4 * FW, 6 * FW, (x, w, h) => roadDraw(x, w, h, true), false);

export function glowTex() {
  return canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,190,100,0.5)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
}
export function smokeTex() {
  seed = 5;
  return canvasTex(128, 128, (x) => {
    for (let i = 0; i < 14; i++) {
      const cx = 64 + (rnd() - 0.5) * 50, cy = 64 + (rnd() - 0.5) * 50, r = 18 + rnd() * 30, g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(225,228,235,0.22)'); g.addColorStop(1, 'rgba(225,228,235,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
  });
}
// a soft rounded square for the landing-cell glows on the road
function cellGlowTex() {
  return canvasTex(128, 128, (x) => {
    x.filter = 'blur(6px)'; x.fillStyle = '#fff'; x.beginPath(); x.roundRect(16, 16, 96, 96, 18); x.fill(); x.filter = 'none';
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.roundRect(14, 14, 100, 100, 20); x.stroke();
  });
}

// ---- carved-lacquer block faces -----------------------------------------------------------------------------
const NAME_KEY = { 关羽: 'guan', 张飞: 'zhang', 赵云: 'zhao', 马超: 'ma', 黄忠: 'huang' };
const roleOf = (p) => (p.t === 'C' ? 'C' : p.t === 'S' ? 'S' : NAME_KEY[p.name.zh] || 'guan');
// the general's weapon (or emblem), drawn as strokes in a unit box centred at 0,0 (size s)
function emblem(x, role, s) {
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = s * 0.07;
  const L = (a, b, c, d) => { x.beginPath(); x.moveTo(a * s, b * s); x.lineTo(c * s, d * s); x.stroke(); };
  if (role === 'guan') {            // the crescent-blade glaive
    L(-0.42, 0.42, 0.28, -0.28);
    x.beginPath(); x.moveTo(0.2, -0.2); x.quadraticCurveTo(0.62, -0.18, 0.5, -0.52); x.quadraticCurveTo(0.36, -0.36, 0.26, -0.44); x.closePath(); x.fill();
  } else if (role === 'zhang') {    // the serpent spear: a wavy blade
    L(-0.45, 0.45, 0.12, -0.12);
    x.beginPath(); x.moveTo(0.12, -0.12);
    for (let i = 1; i <= 8; i++) { const u = i / 8, px = 0.12 + u * 0.36, py = -0.12 - u * 0.36, w = Math.sin(u * Math.PI * 3) * 0.06; x.lineTo(px + w, py + w * -1); }
    x.stroke();
  } else if (role === 'zhao') {     // spear with a tassel
    L(-0.45, 0.45, 0.35, -0.35);
    x.beginPath(); x.moveTo(0.35, -0.35); x.lineTo(0.5, -0.5); x.lineTo(0.3, -0.42); x.lineTo(0.42, -0.3); x.closePath(); x.fill();
    for (const d of [-0.06, 0, 0.06]) L(0.2, -0.2, 0.2 + d, -0.02 + Math.abs(d));
  } else if (role === 'ma') {       // plumed helmet
    x.beginPath(); x.arc(0, 0.1, 0.32 * s, Math.PI, 0); x.lineTo(0.36 * s, 0.22 * s); x.lineTo(-0.36 * s, 0.22 * s); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(0, -0.22 * s); x.quadraticCurveTo(0.1 * s, -0.55 * s, 0.4 * s, -0.5 * s); x.stroke();
  } else if (role === 'huang') {    // bow and arrow
    x.beginPath(); x.arc(-0.1 * s, 0, 0.42 * s, -1.2, 1.2); x.stroke();
    L(0.04, -0.39, 0.04, 0.39); L(-0.42, 0, 0.45, 0);
    x.beginPath(); x.moveTo(0.48 * s, 0); x.lineTo(0.34 * s, -0.08 * s); x.lineTo(0.34 * s, 0.08 * s); x.closePath(); x.fill();
  } else if (role === 'C') {        // the commander's seal: a crouching-tiger knob over a square seal
    x.strokeRect(-0.36 * s, -0.1 * s, 0.72 * s, 0.5 * s);
    x.beginPath(); x.moveTo(-0.3 * s, -0.1 * s); x.quadraticCurveTo(-0.2 * s, -0.48 * s, 0.12 * s, -0.4 * s); x.quadraticCurveTo(0.34 * s, -0.36 * s, 0.3 * s, -0.1 * s); x.closePath(); x.fill();
  } else {                          // soldier: crossed halberds
    L(-0.4, 0.4, 0.4, -0.4); L(0.4, 0.4, -0.4, -0.4);
    for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(0.4 * sx * s, -0.4 * s); x.lineTo(0.22 * sx * s, -0.44 * s); x.lineTo(0.36 * sx * s, -0.24 * s); x.closePath(); x.fill(); }
  }
  x.restore();
}
function fret(x, x0, y0, w, h, step) {
  // a running key fret along a rectangle band (centre line of the rim)
  x.beginPath();
  const edge = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(len / step)), ux = (bx - ax) / len, uy = (by - ay) / len, nx = -uy, ny = ux, k = step * 0.32;
    for (let i = 0; i < n; i++) {
      const sx = ax + ux * (i * len / n), sy = ay + uy * (i * len / n), q = len / n;
      x.moveTo(sx, sy); x.lineTo(sx + nx * k, sy + ny * k); x.lineTo(sx + ux * q * 0.6 + nx * k, sy + uy * q * 0.6 + ny * k); x.lineTo(sx + ux * q * 0.6 - nx * k * 0.2, sy + uy * q * 0.6 - ny * k * 0.2);
      x.lineTo(sx + ux * q * 0.3 - nx * k * 0.2, sy + uy * q * 0.3 - ny * k * 0.2); x.lineTo(sx + ux * q * 0.3 + nx * k * 0.45, sy + uy * q * 0.3 + ny * k * 0.45);
    }
  };
  edge(x0, y0, x0 + w, y0); edge(x0 + w, y0, x0 + w, y0 + h); edge(x0 + w, y0 + h, x0, y0 + h); edge(x0, y0 + h, x0, y0);
  x.stroke();
}
function nameLines(p, lang) {
  if (lang === 'zh') return { chars: [...p.name.zh], zh: true };
  const words = (p.name.en ?? p.name.zh).split(' ');
  return { chars: words, zh: false };
}
// draws one face layer: 'color' (lacquer, gold-filled carving) or 'bump' (height: rim high, ground low, relief high)
function drawFace(x, W, H, p, lang, layer) {
  const col = BLOCK[roleOf(p)], role = roleOf(p), U = Math.min(W, H) / 256;
  const isB = layer === 'bump';
  const ink = p.t === 'S' ? '#d9b062' : role === 'zhao' ? '#7a2a1c' : '#e8c46c';
  const rim = 20 * U, band = 26 * U;
  // ground
  if (isB) { x.fillStyle = '#6a6a6a'; x.fillRect(0, 0, W, H); } else {
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, col.base); g.addColorStop(1, col.base); x.fillStyle = g; x.fillRect(0, 0, W, H);
    seed = W * 7 + H + role.length * 131;
    for (let i = 0; i < 40; i++) {
      const cx = rnd() * W, cy = rnd() * H, r = 20 * U + rnd() * 70 * U, gg = x.createRadialGradient(cx, cy, 0, cx, cy, r), lt = rnd() < 0.5;
      gg.addColorStop(0, lt ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
  }
  // the raised rim band with its key fret carved in
  x.fillStyle = isB ? '#d8d8d8' : 'rgba(255,255,255,0.07)';
  x.beginPath(); x.roundRect(rim * 0.4, rim * 0.4, W - rim * 0.8, H - rim * 0.8, 18 * U); x.roundRect(rim + band, rim + band, W - 2 * (rim + band), H - 2 * (rim + band), 10 * U); x.fill('evenodd');
  x.lineWidth = 3.2 * U; x.strokeStyle = isB ? '#555' : 'rgba(0,0,0,0.38)';
  fret(x, rim + band * 0.5, rim + band * 0.5, W - 2 * rim - band, H - 2 * rim - band, 30 * U);
  if (!isB) { x.lineWidth = 1.4 * U; x.strokeStyle = p.t === 'C' ? 'rgba(255,214,120,0.8)' : 'rgba(255,214,120,0.38)'; fret(x, rim + band * 0.5 - 1, rim + band * 0.5 - 1, W - 2 * rim - band, H - 2 * rim - band, 30 * U); }
  // diaper ground in the field (small carved lozenges)
  const fx0 = rim + band + 4 * U, fy0 = fx0, fx1 = W - fx0, fy1 = H - fy0, st = 22 * U;
  x.save(); x.beginPath(); x.rect(fx0, fy0, fx1 - fx0, fy1 - fy0); x.clip();
  x.strokeStyle = isB ? '#4a4a4a' : 'rgba(0,0,0,0.16)'; x.lineWidth = 2 * U; x.beginPath();
  for (let d = -H; d < W + H; d += st) { x.moveTo(d, 0); x.lineTo(d + H, H); x.moveTo(d, H); x.lineTo(d + H, 0); }
  x.stroke(); x.restore();
  // a smooth cartouche behind the name, then the name and emblem in relief
  const cx = W / 2, cy = H / 2;
  const N = nameLines(p, lang);
  const tall = H > W * 1.4, wide = W > H * 1.4;
  let emb = null;     // emblem box
  let textBox;        // where the name goes
  if (p.t === 'S') { emb = null; textBox = { x: cx, y: cy, w: W * 0.6, h: H * 0.5 }; }
  else if (tall) { emb = { x: cx, y: fy0 + (fy1 - fy0) * 0.2, s: (fx1 - fx0) * 0.62 }; textBox = { x: cx, y: fy0 + (fy1 - fy0) * 0.63, w: (fx1 - fx0) * 0.86, h: (fy1 - fy0) * 0.58 }; }
  else if (wide) { emb = { x: fx0 + (fx1 - fx0) * 0.17, y: cy, s: (fy1 - fy0) * 0.66 }; textBox = { x: fx0 + (fx1 - fx0) * 0.6, y: cy, w: (fx1 - fx0) * 0.62, h: (fy1 - fy0) * 0.8 }; }
  else { emb = { x: cx, y: fy0 + (fy1 - fy0) * 0.2, s: (fx1 - fx0) * 0.3 }; textBox = { x: cx, y: fy0 + (fy1 - fy0) * 0.62, w: (fx1 - fx0) * 0.86, h: (fy1 - fy0) * 0.6 }; }
  // cartouche
  const cw = textBox.w + 16 * U, ch = textBox.h + 10 * U;
  x.fillStyle = isB ? '#7a7a7a' : col.base;
  x.beginPath(); x.roundRect(textBox.x - cw / 2, textBox.y - ch / 2, cw, ch, 14 * U); x.fill();
  if (!isB) { x.strokeStyle = 'rgba(255,214,120,0.32)'; x.lineWidth = 2 * U; x.stroke(); }
  const fill = isB ? '#ffffff' : ink;
  const relief = (fn) => {
    if (isB) { x.save(); x.filter = `blur(${2.2 * U}px)`; x.fillStyle = '#fff'; x.strokeStyle = '#fff'; fn(); x.restore(); x.fillStyle = fill; x.strokeStyle = fill; fn(); return; }
    x.save(); x.fillStyle = 'rgba(0,0,0,0.45)'; x.strokeStyle = 'rgba(0,0,0,0.45)'; x.translate(2 * U, 3 * U); fn(); x.restore();
    x.fillStyle = fill; x.strokeStyle = fill; fn();
  };
  if (emb) relief(() => { x.save(); x.translate(emb.x, emb.y); emblem(x, role, emb.s); x.restore(); });
  // the name
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (N.zh) {
    const n = N.chars.length, vertical = tall || (p.t === 'C' && false);
    const size = p.t === 'S' ? Math.min(textBox.w, textBox.h) * 1.1 : vertical ? Math.min(textBox.w * 0.95, textBox.h / n * 0.95) : Math.min(textBox.h * 0.9, textBox.w / n * 0.95);
    x.font = `900 ${size}px ${CARVE}`;
    relief(() => N.chars.forEach((c, i) => {
      const off = (i - (n - 1) / 2) * size * 1.02;
      x.fillText(c, textBox.x + (vertical ? 0 : off), textBox.y + (vertical ? off : 0) + size * 0.04);
    }));
  } else {
    const lines = N.chars;
    x.font = `900 100px ${DISPLAY}`;
    const widest = Math.max(...lines.map((l) => x.measureText(l).width)) / 100;
    const size = Math.min(textBox.w / widest, textBox.h / (lines.length * 1.05), p.t === 'S' ? 52 * U : 999);
    x.font = `900 ${size}px ${DISPLAY}`;
    relief(() => lines.forEach((l, i) => x.fillText(l, textBox.x, textBox.y + (i - (lines.length - 1) / 2) * size * 1.04 + size * 0.06)));
  }
}
const faceCache = new Map();
function faceTextures(p, lang) {
  const [w, h] = { C: [2, 2], V: [1, 2], H: [2, 1], S: [1, 1] }[p.t];
  const key = `${p.t}|${p.name.zh}|${lang}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const W = w * 256, H = h * 256;
  const map = canvasTex(W, H, (x) => drawFace(x, W, H, p, lang, 'color'));
  const bump = canvasTex(W, H, (x) => drawFace(x, W, H, p, lang, 'bump'), false);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1 / w, 1 / h); t.offset.set(0, 1); }
  const v = { map, bump }; faceCache.set(key, v); return v;
}

// ------------------------------------------------------------------------------------------------ materials
let M = null;
export function materials() {
  if (M) return M;
  const slate = slateTex(), pearl = pearlTex(), road = roadTex();
  const gm = roadMask();
  M = {
    slate: new THREE.MeshPhysicalMaterial({ map: slate, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    brocade: new THREE.MeshPhysicalMaterial({ map: brocadeTex(), roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xff9a70) }),
    lacquer: new THREE.MeshPhysicalMaterial({ color: 0x120c0b, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    railTop: new THREE.MeshPhysicalMaterial({ map: pearl, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.6, iridescenceIOR: 1.6 }),
    road: new THREE.MeshStandardMaterial({ map: road, roughness: 0.82, metalnessMap: roadMetal(), metalness: 1, emissiveMap: gm, emissive: 0x000000 }),
    roadSide: new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe0b863, metalness: 1, roughness: 0.28 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, metalness: 0.9, roughness: 0.42 }),
    verdigris: new THREE.MeshStandardMaterial({ color: 0x3f6a5a, metalness: 0.5, roughness: 0.6 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8c857a, roughness: 0.85 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.85 }),
    rod: new THREE.MeshPhysicalMaterial({ color: 0x3a1a10, roughness: 0.35, clearcoat: 0.8 }),
    cellGlow: new THREE.MeshBasicMaterial({ map: cellGlowTex(), color: 0xffd98a, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  M.side = {};
  for (const [k, v] of Object.entries(BLOCK)) M.side[k] = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(v.base).multiplyScalar(0.72), roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1 });
  return M;
}
export function disposeAll() {
  if (!M) return;
  const mats = [...Object.values(M).filter((v) => v && v.isMaterial), ...Object.values(M.side)];
  for (const m of mats) { for (const k of ['map', 'metalnessMap', 'emissiveMap', 'bumpMap']) m[k]?.dispose(); m.dispose(); }
  M = null;
  for (const v of faceCache.values()) { v.map.dispose(); v.bump.dispose(); }
  faceCache.clear(); geoCache.clear();
}

// ------------------------------------------------------------------------------------------------ geometry helpers
const shapeXZ = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; };
function rrPts(x, z, w, h, r, seg = 5) {
  r = Math.min(r, w / 2, h / 2);
  const out = [], C = [[x + w - r, z + r, -Math.PI / 2], [x + w - r, z + h - r, 0], [x + r, z + h - r, Math.PI / 2], [x + r, z + r, Math.PI]];
  for (const [cx, cz, a0] of C) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return out;
}
function extrude(shape, depth, bevel = 0, curve = 6) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: curve });
  g.rotateX(-Math.PI / 2);
  return g;
}
// a rounded slab from y0 to y0 + h over the rectangle x, z, w, d (in world units)
function slab(x, z, w, d, y0, h, r, mats, bevel = 0) {
  const g = extrude(shapeXZ(rrPts(x, z, w, d, r)), Math.max(0.01, h - 2 * bevel), bevel);
  g.translate(0, y0 + bevel, 0);
  const m = new THREE.Mesh(g, mats); m.castShadow = true; m.receiveShadow = true; return m;
}
const disposeTree = (o) => o.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
export { disposeTree };

// ------------------------------------------------------------------------------------------------ blocks
const geoCache = new Map();
function blockGeo(t) {
  if (geoCache.has(t)) return geoCache.get(t);
  const [w, h] = { C: [2, 2], V: [1, 2], H: [2, 1], S: [1, 1] }[t];
  // shape in cell units with the top-left at 0,0 (z down); UVs of the cap = (x, -z): the face texture maps with repeat 1/w,1/h, offset (0, 1)
  const g = extrude(shapeXZ(rrPts(GAP, GAP, w - 2 * GAP, h - 2 * GAP, t === 'S' ? 0.11 : 0.14)), T - 2 * BEV, BEV, 5);
  g.translate(0, BEV, 0);
  geoCache.set(t, g); return g;
}
// One block: a pivot at the block's top-left cell corner on the road; children are scaled by the cell size.
export function makeBlock(p, lang) {
  const m = materials(), role = roleOf(p), f = faceTextures(p, lang);
  const top = new THREE.MeshPhysicalMaterial({ map: f.map, bumpMap: f.bump, bumpScale: 2.2, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x000000 });
  const side = m.side[role].clone();
  const mesh = new THREE.Mesh(blockGeo(p.t), [top, side]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const pivot = new THREE.Group(); pivot.add(mesh);
  return { pivot, mesh, top, side, t: p.t, key: `${p.t}|${p.name.zh}|${lang}`, setFade(a) { for (const mt of [top, side]) { mt.transparent = a < 1; mt.opacity = a; mt.depthWrite = a > 0.5; } } };
}
export function blockKey(p, lang) { return `${p.t}|${p.name.zh}|${lang}`; }

// ------------------------------------------------------------------------------------------------ tray (frame + road + gate)
// F: the frame rectangle, B: the board (road) rectangle, both in virtual px; c: cell size. The road top is at y = 0.
export function tray(F, B, c) {
  const m = materials(), g = new THREE.Group();
  const yb = -BASE * c, yr = RAIL * c, r = Math.min(30, c * 0.2);
  // base slab under everything (black lacquer)
  g.add(slab(F.x - 2, F.y - 2, F.w + 4, F.h + 4, yb - 0.035 * c, 0.035 * c + 1, r, m.lacquer));
  // the road: one stone slab over the board and the gate opening
  const gx = B.x + c, gw = 2 * c, fb = F.y + F.h;
  const roadG = new THREE.BoxGeometry(B.w, -yb, B.h + (fb - (B.y + B.h)));
  roadG.translate(B.x + B.w / 2, yb / 2, B.y + (B.h + (fb - (B.y + B.h))) / 2);
  // remap the top face UVs: u across the 4 cells, v over 6 cells (the board + one cell of path)
  const uv = roadG.attributes.uv, pos = roadG.attributes.position, nrm = roadG.attributes.normal;
  for (let i = 0; i < uv.count; i++) if (nrm.getY(i) > 0.5) { uv.setXY(i, (pos.getX(i) - B.x) / (4 * c), 1 - (pos.getZ(i) - B.y) / (6 * c)); }
  const road = new THREE.Mesh(roadG, [m.roadSide, m.roadSide, m.road, m.roadSide, m.roadSide, m.roadSide]);
  road.receiveShadow = true; g.add(road);
  // rails: far, left, right, and the two near pieces either side of the gate (lacquer walls, pearl-inlaid tops)
  const mats = [m.railTop, m.lacquer];
  const bev = Math.min(5, c * 0.03);
  const parts = [
    [F.x, F.y, F.w, B.y - F.y],
    [F.x, B.y - 1, B.x - F.x, B.h + 2],
    [B.x + B.w, B.y - 1, F.x + F.w - B.x - B.w, B.h + 2],
    [F.x, B.y + B.h, gx - F.x, fb - B.y - B.h],
    [gx + gw, B.y + B.h, F.x + F.w - gx - gw, fb - B.y - B.h],
  ];
  for (const [x, z, w, d] of parts) {
    const s = slab(x, z, w, d, yb, yr - yb, 3, mats, bev);
    // pearl texture in world px
    g.add(s);
  }
  m.railTop.map.repeat.set(1 / 700, 1 / 700);
  // the outer rounded corners: a thin gold line around the top of the frame
  const lineH = 0.012 * c;
  for (const [x, z, w, d] of [[F.x + 6, F.y + 6, F.w - 12, 3], [F.x + 6, F.y + 6, 3, F.h - 12], [F.x + F.w - 9, F.y + 6, 3, F.h - 12], [F.x + 6, fb - 9, gx - F.x - 6, 3], [gx + gw, fb - 9, F.x + F.w - 6 - gx - gw, 3]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, lineH, d), m.gold); b.position.set(x + w / 2, yr + lineH / 2, z + d / 2); g.add(b);
  }
  // gate posts: square stone posts with bronze caps at both sides of the opening
  const ps = Math.min(c * 0.22, fb - B.y - B.h), ph = 0.2 * c;
  for (const px of [gx - ps * 0.15, gx + gw + ps * 0.15]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(ps, ph, ps), m.stone); post.position.set(px, yr + ph / 2, (B.y + B.h + fb) / 2); post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, ps * 0.78, ps * 0.5, 4, 1), m.gold); cap.rotation.y = Math.PI / 4; cap.position.set(px, yr + ph + ps * 0.25, (B.y + B.h + fb) / 2); cap.castShadow = true; g.add(cap);
  }
  return g;
}
// the brocade mat under the tray and the slate table under everything
export function table(x0, z0, w, h, F) {
  const m = materials(), g = new THREE.Group();
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.slate); pl.rotation.x = -Math.PI / 2; pl.position.set(x0 + w / 2, 0, z0 + h / 2); pl.receiveShadow = true;
  m.slate.map.repeat.set(w / 1400, h / 1400);
  g.add(pl);
  if (F) {
    const mw = F.w * 1.22, mh = F.h * 1.12;
    const mat = new THREE.Mesh(new THREE.BoxGeometry(mw, 2, mh), m.brocade); mat.position.set(F.x + F.w / 2, 1, F.y + F.h / 2 + F.h * 0.02); mat.receiveShadow = true;
    m.brocade.map.repeat.set(mw / 300, mh / 300);
    g.add(mat);
  }
  return g;
}
export function cellGlow() {
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0.5, 0, 0.5);
  const mm = new THREE.Mesh(g, materials().cellGlow.clone()); mm.renderOrder = 2; return mm;
}

// ------------------------------------------------------------------------------------------------ title props
// A bronze incense burner (ding): round belly on three legs, two upright handles, a lid with a knob. cm = units per cm.
export function incense(cm) {
  const m = materials(), g = new THREE.Group();
  const prof = [[0, 0], [3.2, 0.3], [4.2, 1.6], [4.4, 3.2], [3.9, 4.6], [4.3, 5.0], [4.3, 5.4], [0, 5.4]].map(([r, y]) => new THREE.Vector2(r * cm, y * cm));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), m.bronze); body.position.y = 2.2 * cm; body.castShadow = true; g.add(body);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.5, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * cm, 0.6 * cm, 2.6 * cm, 10), m.bronze);
    leg.position.set(Math.cos(a) * 2.8 * cm, 1.3 * cm, Math.sin(a) * 2.8 * cm); leg.castShadow = true; g.add(leg);
  }
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(1.1 * cm, 0.28 * cm, 8, 16, Math.PI), m.bronze); h.position.set(s * 3.4 * cm, 7.6 * cm, 0); h.rotation.y = Math.PI / 2; g.add(h);
  }
  const lid = new THREE.Mesh(new THREE.SphereGeometry(3.9 * cm, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), m.verdigris); lid.position.y = 7.4 * cm; lid.scale.y = 0.6; lid.castShadow = true; g.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.8 * cm, 12, 8), m.gold); knob.position.y = 9.6 * cm; g.add(knob);
  g.userData.top = 10.2 * cm;
  return g;
}
// a rolled map scroll with dark wooden rod ends
export function scroll(cm) {
  const m = materials(), g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(1.5 * cm, 1.5 * cm, 16 * cm, 20), m.paper); roll.rotation.z = Math.PI / 2; roll.position.y = 1.5 * cm; roll.castShadow = true; roll.receiveShadow = true; g.add(roll);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * cm, 0.75 * cm, 2.6 * cm, 12), m.rod); e.rotation.z = Math.PI / 2; e.position.set(s * 9 * cm, 1.5 * cm, 0); e.castShadow = true; g.add(e); }
  const tie = new THREE.Mesh(new THREE.TorusGeometry(1.55 * cm, 0.18 * cm, 6, 20), new THREE.MeshStandardMaterial({ color: 0x9a1c18, roughness: 0.7 })); tie.rotation.y = Math.PI / 2; tie.position.set(2 * cm, 1.5 * cm, 0); g.add(tie);
  return g;
}
