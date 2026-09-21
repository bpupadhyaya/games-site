// The forest floor and the hunt map. One light, from the upper left. Painted ONCE into a cached layer per board.
// The board is a map of the hunt (parchment on a leather mat) lying on the ground; the eleven points are clearings
// joined by worn trails. The pieces live in pieces.js.
import { W, H, project, UNIT } from './layout.js';
import { AX, LAT, STEPS } from './rules.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
const rect = (U, V0, V1) => [project(-U, V0), project(U, V0), project(U, V1), project(-U, V1)];

// Every line of the board once, as pairs of points.
export function boardSegments() {
  const out = [];
  for (let i = 0; i < 11; i++) for (const j of STEPS[i]) if (i < j) out.push([i, j]);
  return out;
}
const uv = (i) => [LAT[i] - 1, 4 - AX[i]];

// Board themes. `autumn` is the default; `winter` and `night` are cosmetic (unlocked by wins).
export const BOARDS = {
  autumn: {
    ground: ['#3a2f1b', '#2b2314', '#1c170d'], moss: '70,104,44', light: '255,214,140', leaves: ['#b5541c', '#d98a2b', '#8c3a16', '#c9a13a', '#6b4a1e', '#a13a1a', '#7c5a26'], leafA: 0.9,
    frame: ['#7a5236', '#5a3a24', '#3c2416'], edge: ['#3c2416', '#1d100a'], stitch: 'rgba(238,208,150,0.75)',
    paper: ['#f0dfae', '#e3cc92', '#c9ad70'], stain: '120,80,30', ink: '#3b2412', trail: ['#d6b878', '#c19c56'], ring: '#3b2412', glow: '255,236,150',
  },
  winter: {
    ground: ['#c9d5dc', '#aebcc6', '#8fa1ae'], moss: '240,246,252', light: '255,255,255', leaves: ['#7a5a3a', '#5a4a3a', '#9aa9b3', '#6d5a48'], leafA: 0.55,
    frame: ['#7c8994', '#59656f', '#3e4852'], edge: ['#3e4852', '#232b32'], stitch: 'rgba(220,235,248,0.8)',
    paper: ['#eef4f8', '#dbe6ee', '#bccbd8'], stain: '90,120,150', ink: '#33424f', trail: ['#f7fbfe', '#d3e0ea'], ring: '#33424f', glow: '255,244,190',
  },
  night: {
    ground: ['#12241f', '#0b1713', '#050b09'], moss: '40,88,84', light: '150,190,240', leaves: ['#1f4a44', '#2a5a52', '#3a4a6a', '#24403a'], leafA: 0.85,
    frame: ['#2f3d4a', '#1f2a35', '#121a22'], edge: ['#121a22', '#070b10'], stitch: 'rgba(170,200,230,0.7)',
    paper: ['#2c4258', '#22364a', '#182838'], stain: '10,20,30', ink: '#b9d0e3', trail: ['#4d7290', '#37566e'], ring: '#b9d0e3', glow: '150,220,255',
  },
};
export const BOARD_NAMES = { autumn: 'Autumn', winter: 'Winter', night: 'Night' };

function leafShape(ctx, x, y, size, rot, fill, vein, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a;
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(-size * 0.2, -size * 0.62, size, 0); ctx.quadraticCurveTo(-size * 0.2, size * 0.62, -size, 0); ctx.fill();
  ctx.strokeStyle = vein; ctx.lineWidth = Math.max(0.8, size * 0.06); ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size * 0.9, 0); ctx.stroke();
  ctx.restore();
}

function paintGround(ctx, T) {
  const rnd = lcg(20260921);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, T.ground[0]); bg.addColorStop(0.55, T.ground[1]); bg.addColorStop(1, T.ground[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const blob = (x, y, rx, ry, rgb, a) => { ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore(); };
  for (let i = 0; i < 26; i++) blob(rnd() * W, rnd() * H, 60 + rnd() * 120, 40 + rnd() * 90, T.moss, 0.16 + rnd() * 0.16);       // moss / snow drifts
  for (let i = 0; i < 16; i++) blob(rnd() * W, rnd() * H, 90 + rnd() * 150, 60 + rnd() * 110, '0,0,0', 0.16 + rnd() * 0.14);      // canopy shadow
  // twigs and needles
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * TAU, l = 20 + rnd() * 60;
    ctx.strokeStyle = `rgba(${T.ink === '#b9d0e3' ? '20,40,40' : '50,32,18'},${0.3 + rnd() * 0.3})`; ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // leaf litter: overlapping leaves, darker ones underneath
  for (let i = 0; i < 520; i++) {
    const size = 9 + rnd() * 22, f = T.leaves[Math.floor(rnd() * T.leaves.length)];
    leafShape(ctx, rnd() * W, rnd() * H, size, rnd() * TAU, f, 'rgba(30,14,4,0.45)', T.leafA * (0.55 + rnd() * 0.45));
  }
  // sun through the canopy: pools of light falling from the upper left, and a soft diagonal shaft
  for (let i = 0; i < 12; i++) blob(80 + rnd() * 560, 60 + rnd() * 1400, 80 + rnd() * 120, 50 + rnd() * 80, T.light, 0.10 + rnd() * 0.10);
  const sh = ctx.createLinearGradient(0, 0, W, H * 0.7); sh.addColorStop(0, `rgba(${T.light},0.18)`); sh.addColorStop(0.5, `rgba(${T.light},0)`); ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(360, 800, 300, 360, 800, 1000); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function pine(ctx, x, y, s, ink) {
  ctx.fillStyle = ink; ctx.globalAlpha = 0.55;
  for (let k = 0; k < 3; k++) { const w = s * (0.5 + k * 0.32), yy = y - s * 0.9 + k * s * 0.42; ctx.beginPath(); ctx.moveTo(x, yy - s * 0.5); ctx.lineTo(x - w, yy + s * 0.3); ctx.lineTo(x + w, yy + s * 0.3); ctx.closePath(); ctx.fill(); }
  ctx.fillRect(x - s * 0.06, y - s * 0.1, s * 0.12, s * 0.3); ctx.globalAlpha = 1;
}

function paintStatic(ctx, name) {
  const T = BOARDS[name] ?? BOARDS.autumn, rnd = lcg(777);
  paintGround(ctx, T);
  const outer = rect(1.5, -0.55, 4.55), inner = rect(1.37, -0.42, 4.42);
  // soft shadow of the mat on the ground, thrown down and to the right
  for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(0,0,0,0.075)'; poly(ctx, outer.map((p) => ({ x: p.x + 8 + i * 2.6 + (p.x > 360 ? i * 2 : -i), y: p.y + 26 + i * 4 }))); ctx.fill(); }
  // the front edge: the mat has thickness
  const TH = 30, front = ctx.createLinearGradient(0, outer[3].y, 0, outer[3].y + TH); front.addColorStop(0, T.edge[0]); front.addColorStop(1, T.edge[1]);
  ctx.fillStyle = front; poly(ctx, [outer[3], outer[2], { x: outer[2].x - 3, y: outer[2].y + TH }, { x: outer[3].x + 3, y: outer[3].y + TH }]); ctx.fill();
  // the leather mat
  const fr = ctx.createLinearGradient(outer[0].x, outer[0].y, outer[2].x, outer[2].y); fr.addColorStop(0, T.frame[0]); fr.addColorStop(0.5, T.frame[1]); fr.addColorStop(1, T.frame[2]);
  ctx.fillStyle = fr; ctx.lineJoin = 'round'; poly(ctx, outer); ctx.fill(); ctx.strokeStyle = fr; ctx.lineWidth = 10; ctx.stroke();
  ctx.save(); poly(ctx, outer); ctx.clip();                                                             // leather grain: many tiny pits and creases
  for (let n = 0; n < 900; n++) { const p = project(-1.5 + rnd() * 3, -0.55 + rnd() * 5.1); ctx.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.09})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, (1 + rnd() * 2.6) * p.s, (0.8 + rnd() * 1.6) * p.s, 0, 0, TAU); ctx.fill(); }
  for (let n = 0; n < 60; n++) { const p = project(-1.5 + rnd() * 3, -0.55 + rnd() * 5.1), q = project(-1.5 + rnd() * 3, -0.55 + rnd() * 5.1); ctx.strokeStyle = `rgba(255,236,200,${0.03 + rnd() * 0.05})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (q.x - p.x) * 0.12, p.y + (q.y - p.y) * 0.12); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,224,180,0.5)'; ctx.beginPath(); ctx.moveTo(outer[3].x - 4, outer[3].y); ctx.lineTo(outer[0].x - 4, outer[0].y - 4); ctx.lineTo(outer[1].x + 4, outer[1].y - 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(10,4,0,0.55)'; ctx.beginPath(); ctx.moveTo(outer[1].x + 5, outer[1].y); ctx.lineTo(outer[2].x + 5, outer[2].y + 3); ctx.stroke();
  // stitching just inside the mat's edge
  const st = rect(1.445, -0.5, 4.5); ctx.strokeStyle = T.stitch; ctx.lineWidth = 2; ctx.setLineDash([9, 7]); poly(ctx, st); ctx.stroke(); ctx.setLineDash([]);

  // the map: parchment, lit from the upper left, stained and creased
  ctx.save(); poly(ctx, inner); ctx.clip();
  const su = ctx.createLinearGradient(inner[0].x, inner[0].y, inner[2].x, inner[2].y); su.addColorStop(0, T.paper[0]); su.addColorStop(0.5, T.paper[1]); su.addColorStop(1, T.paper[2]);
  ctx.fillStyle = su; ctx.fillRect(0, inner[0].y - 10, W, inner[2].y - inner[0].y + 20);
  for (let n = 0; n < 9; n++) { const p = project(-1.4 + rnd() * 2.8, -0.4 + rnd() * 4.8); const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, (40 + rnd() * 90) * p.s); g.addColorStop(0, `rgba(${T.stain},${0.12 + rnd() * 0.12})`); g.addColorStop(1, `rgba(${T.stain},0)`); ctx.fillStyle = g; ctx.fillRect(p.x - 160, p.y - 160, 320, 320); }
  for (let n = 0; n < 500; n++) { const p = project(-1.4 + rnd() * 2.8, -0.4 + rnd() * 4.8); ctx.fillStyle = `rgba(${T.stain},${0.04 + rnd() * 0.08})`; ctx.fillRect(p.x, p.y, 1 + rnd() * 2, 1); }          // paper fibres
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1.5;                                                  // fold creases: one across, one along
  { const a = project(-1.4, 2), b = project(1.4, 2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const c = project(0, -0.4), d = project(0, 4.4); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; { const a = project(-1.4, 2), b = project(1.4, 2); ctx.beginPath(); ctx.moveTo(a.x, a.y + 2); ctx.lineTo(b.x, b.y + 2); ctx.stroke(); }
  // little ink drawings in the corners of the map: pines and hills
  for (const [u, v, s] of [[-1.05, 0.05, 1], [1.05, 0.05, 0.9], [-1.08, 4.0, 1.1], [1.08, 3.95, 1], [-1.15, 1.1, 0.7], [1.15, 2.95, 0.7], [-0.98, 0.7, 0.55], [1.0, 3.4, 0.55]]) { const p = project(u, v); pine(ctx, p.x, p.y, 34 * UNIT * p.s * s, T.ink); }
  ctx.strokeStyle = T.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
  for (const [u, v] of [[-1.0, 1.9], [1.05, 1.9], [-1.05, 3.05], [1.0, 1.05]]) { const p = project(u, v), w = 26 * UNIT * p.s; ctx.beginPath(); ctx.moveTo(p.x - w, p.y + w * 0.3); ctx.quadraticCurveTo(p.x - w * 0.3, p.y - w * 0.7, p.x, p.y - w * 0.2); ctx.quadraticCurveTo(p.x + w * 0.4, p.y - w * 0.9, p.x + w, p.y + w * 0.3); ctx.stroke(); }
  ctx.globalAlpha = 1;
  const sheen = ctx.createRadialGradient(200, inner[0].y + 40, 20, 260, inner[0].y + 140, 560); sheen.addColorStop(0, 'rgba(255,248,220,0.32)'); sheen.addColorStop(1, 'rgba(255,248,220,0)'); ctx.fillStyle = sheen; ctx.fillRect(0, inner[0].y - 10, W, 700);
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,12,2,0.55)'; poly(ctx, inner); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,236,190,0.4)'; ctx.beginPath(); ctx.moveTo(inner[1].x - 2, inner[1].y + 3); ctx.lineTo(inner[2].x - 3, inner[2].y - 2); ctx.lineTo(inner[3].x + 2, inner[3].y - 2); ctx.stroke();

  // trails: a worn path with darker edges and pebbles
  ctx.lineCap = 'round';
  for (const [i, j] of boardSegments()) {
    const [au, av] = uv(i), [bu, bv] = uv(j), a = project(au, av), b = project(bu, bv), w = 17 * UNIT * (a.s + b.s) / 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = w + 6; ctx.beginPath(); ctx.moveTo(a.x + 2, a.y + 3); ctx.lineTo(b.x + 2, b.y + 3); ctx.stroke();
    ctx.strokeStyle = T.ink; ctx.lineWidth = w + 3.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const tg = ctx.createLinearGradient(a.x, a.y, b.x + 1, b.y + 1); tg.addColorStop(0, T.trail[0]); tg.addColorStop(1, T.trail[1]);
    ctx.strokeStyle = tg; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,230,0.22)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(a.x - 1.2, a.y - 1.4); ctx.lineTo(b.x - 1.2, b.y - 1.4); ctx.stroke();
    for (let n = 0; n < 9; n++) { const t = rnd(), off = (rnd() - 0.5) * w * 0.6, x = a.x + (b.x - a.x) * t + off * 0.3, y = a.y + (b.y - a.y) * t + off * 0.5; ctx.fillStyle = `rgba(${T.stain},${0.25 + rnd() * 0.25})`; ctx.beginPath(); ctx.ellipse(x, y, (1 + rnd() * 1.6) * a.s, (0.8 + rnd() * 1.1) * a.s, 0, 0, TAU); ctx.fill(); }
  }
  // clearings at the eleven points: a ring of trodden earth; the two ends are marked (a burrow, a kennel arch)
  for (let i = 0; i < 11; i++) {
    const [u, v] = uv(i), p = project(u, v), rx = (i === 0 || i === 10 ? 33 : 27) * UNIT * p.s, ry = rx * 0.82;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 3, rx + 4, ry + 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = T.ring; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx + 3, ry + 3, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(p.x - rx * 0.35, p.y - ry * 0.4, 2, p.x, p.y, rx); g.addColorStop(0, T.trail[0]); g.addColorStop(1, T.trail[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${T.stain},0.5)`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * 0.62, ry * 0.62, 0, 0, TAU); ctx.stroke();
    if (i === 10) {                                                        // the burrow: a dark hollow under a lip of earth and grass
      ctx.fillStyle = '#120a05'; ctx.beginPath(); ctx.ellipse(p.x, p.y + ry * 0.1, rx * 0.66, ry * 0.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(60,110,50,0.9)'; ctx.lineWidth = 2; for (let n = 0; n < 9; n++) { const a = Math.PI + n * 0.4 - 0.2, x = p.x + Math.cos(a) * rx * 0.85, y = p.y + Math.sin(a) * ry * 0.55; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (n - 4) * 1.4, y - 9 * p.s * UNIT * 0.7); ctx.stroke(); }
    }
    if (i === 0) {                                                         // the kennel: a small arch and a paw print
      ctx.fillStyle = T.ink; ctx.globalAlpha = 0.7; const s = rx * 0.5; ctx.beginPath(); ctx.ellipse(p.x, p.y + ry * 0.28, s * 0.85, s * 0.62, 0, 0, TAU); ctx.fill();
      for (const [dx, dy] of [[-0.62, -0.34], [-0.2, -0.62], [0.2, -0.62], [0.62, -0.34]]) { ctx.beginPath(); ctx.ellipse(p.x + dx * s * 1.05, p.y + ry * 0.28 + dy * s, s * 0.2, s * 0.26, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  // brass rivets on the mat's corners
  for (const [u, v] of [[-1.44, -0.49], [1.44, -0.49], [1.44, 4.49], [-1.44, 4.49]]) {
    const p = project(u, v), r = 7 * UNIT * p.s; const g = ctx.createRadialGradient(p.x - r * 0.4, p.y - r * 0.4, 0.5, p.x, p.y, r); g.addColorStop(0, '#fff2c0'); g.addColorStop(1, '#8a5e16');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }
}

const layers = {};     // one cached layer per board, painted the first time it is needed
export function drawTableAndBoard(ctx, name = 'autumn') {
  if (!(name in layers)) {
    layers[name] = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(W * 2, H * 2), lctx = c.getContext('2d');
        lctx.scale(2, 2); paintStatic(lctx, name); layers[name] = c;
      }
    } catch { layers[name] = null; }
  }
  if (layers[name]) ctx.drawImage(layers[name], 0, 0, W, H); else paintStatic(ctx, name);
}
// A leaf for the drifting-leaves layer (a cached sprite, drawn a few per frame).
const leafSprites = {};
export function drawLeaf(ctx, x, y, size, rot, tone) {
  if (!(tone in leafSprites)) {
    leafSprites[tone] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(64, 40), l = c.getContext('2d'); const cols = ['#b5541c', '#d98a2b', '#c9a13a', '#8c3a16']; leafShape(l, 32, 20, 28, 0, cols[tone % 4], 'rgba(30,14,4,0.5)', 1); leafSprites[tone] = c; } } catch { leafSprites[tone] = null; }
  }
  const s = leafSprites[tone]; if (!s) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(s, -size, -size * 0.625, size * 2, size * 1.25); ctx.restore();
}
