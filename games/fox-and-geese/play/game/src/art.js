// The table and the board: a cross-shaped slab lying on a moonlit snowfield. One light, from the upper left.
// Everything here is static and painted ONCE into a cached layer; falling snow (view.js) is the only thing that moves.
import { W, H, project, UNIT } from './layout.js';
import { onBoard, N } from './rules.js';

const TAU = Math.PI * 2;

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

// The outline of the cross, `m` board units outside the outermost points, in screen space (12 corners, clockwise from the top left).
const crossPoly = (m) => [[-1 - m, -m], [1 + m, -m], [1 + m, 2 - m], [3 + m, 2 - m], [3 + m, 4 + m], [1 + m, 4 + m], [1 + m, 6 + m], [-1 - m, 6 + m], [-1 - m, 4 + m], [-3 - m, 4 + m], [-3 - m, 2 - m], [-1 - m, 2 - m]].map(([u, v]) => project(u, v));

// Which points are joined: orthogonal neighbours, where both points exist.
export function boardSegments() {
  const seg = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!onBoard(x, y)) continue;
    if (onBoard(x + 1, y)) seg.push([x, y, x + 1, y]);
    if (onBoard(x, y + 1)) seg.push([x, y, x, y + 1]);
  }
  return seg;
}

// Board looks. frost is the default; slate and moss are cosmetic alternatives (unlocked by wins).
//   dark lines cut into a light face (frost), or light lines cut into a dark face (slate, moss)
export const BOARDS = {
  frost: { frame: ['#5d7488', '#3c5064', '#243444'], face: ['#eef6fb', '#cfe0ec', '#9db7cc'], sheen: 'rgba(255,255,255,0.5)', line: '#3d5b78', lineLit: 'rgba(255,255,255,0.85)', edge: ['#2a3a4b', '#0f1822'], bead: ['#ffffff', '#b6dcf2', '#4b86ac'], ring: '#2f4a63', grain: [255, 255, 255], ferns: true, stud: ['#f2f8fc', '#6c8296'] },
  slate: { frame: ['#4a4f58', '#30343c', '#1b1e24'], face: ['#79838f', '#586270', '#3b444f'], sheen: 'rgba(210,225,240,0.28)', line: '#d7e4f0', lineLit: 'rgba(0,0,0,0.5)', edge: ['#22262d', '#0c0e11'], bead: ['#f6fbff', '#a8c6dc', '#54728a'], ring: '#141a20', grain: [200, 214, 228], ferns: false, stud: ['#e6edf3', '#5c6670'] },
  moss: { frame: ['#5b4526', '#3f2f18', '#28200f'], face: ['#4d7c5a', '#376248', '#244632'], sheen: 'rgba(200,240,190,0.25)', line: '#e2d493', lineLit: 'rgba(0,0,0,0.5)', edge: ['#2e2412', '#120e06'], bead: ['#fff3c2', '#d9b552', '#7a5a14'], ring: '#12261b', grain: [190, 230, 180], ferns: false, stud: ['#fff0b8', '#8a6a1a'] },
};
export const BOARD_NAMES = { frost: 'Frost', slate: 'Slate', moss: 'Moss' };

function paintStatic(ctx, look) {
  const B = BOARDS[look] ?? BOARDS.frost;
  const rnd = lcg(20260921);
  // ---- the snowfield at night ---------------------------------------------------------------------
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d2036'); bg.addColorStop(0.5, '#0a1a2c'); bg.addColorStop(1, '#050d17');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const moon = ctx.createRadialGradient(150, 60, 10, 210, 260, 900);
  moon.addColorStop(0, 'rgba(190,220,255,0.30)'); moon.addColorStop(0.45, 'rgba(140,180,230,0.10)'); moon.addColorStop(1, 'rgba(140,180,230,0)');
  ctx.fillStyle = moon; ctx.fillRect(0, 0, W, H);
  // drifts: long soft mounds of snow that catch the moon, heaped toward the corners
  for (const [x, y, rx, ry, a] of [[80, 1500, 420, 130, 0.5], [660, 1470, 380, 120, 0.42], [360, 1560, 520, 110, 0.5], [-20, 900, 200, 380, 0.22], [750, 760, 200, 400, 0.2], [600, 120, 420, 90, 0.16], [40, 200, 300, 80, 0.18]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(-rx * 0.2, -rx * 0.25, 4, 0, 0, rx);
    g.addColorStop(0, `rgba(226,240,255,${a})`); g.addColorStop(0.6, `rgba(150,182,222,${a * 0.5})`); g.addColorStop(1, 'rgba(120,150,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
  }
  // snow crystals glinting on the field
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W, y = rnd() * H, r = 0.5 + rnd() * 1.3;
    ctx.fillStyle = `rgba(220,236,255,${0.10 + rnd() * 0.42})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 34; i++) {
    const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 5;
    ctx.strokeStyle = `rgba(235,246,255,${0.25 + rnd() * 0.4})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  }

  const outer = crossPoly(0.62), inner = crossPoly(0.44), TH = 30;
  // soft shadow of the slab on the snow, thrown down and to the right
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(0,4,12,0.085)';
    poly(ctx, outer.map((p) => ({ x: p.x + 10 + i * 2.6, y: p.y + TH + 8 + i * 4.5 })));
    ctx.fill();
  }
  // the thickness of the slab: every outline edge extruded straight down; the top face covers what is hidden
  const side = ctx.createLinearGradient(0, 300, 0, 1400); side.addColorStop(0, B.edge[0]); side.addColorStop(1, B.edge[1]);
  ctx.fillStyle = side; ctx.strokeStyle = B.edge[1]; ctx.lineWidth = 1;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + TH); ctx.lineTo(a.x, a.y + TH); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // the lit rim of the lower edges
  ctx.strokeStyle = 'rgba(210,232,255,0.30)'; ctx.lineWidth = 2;
  for (let i = 0; i < outer.length; i++) { const a = outer[i], b = outer[(i + 1) % outer.length]; if (Math.abs(a.y - b.y) < 2 && a.y > 1000) { ctx.beginPath(); ctx.moveTo(a.x, a.y + TH - 1); ctx.lineTo(b.x, b.y + TH - 1); ctx.stroke(); } }
  // the frame: a band of cold metal all round
  const fr = ctx.createLinearGradient(outer[0].x, outer[0].y, outer[6].x, outer[6].y);
  fr.addColorStop(0, B.frame[0]); fr.addColorStop(0.5, B.frame[1]); fr.addColorStop(1, B.frame[2]);
  ctx.fillStyle = fr; ctx.lineJoin = 'round'; poly(ctx, outer); ctx.fill();
  // bevel: light catches the upper and left edges, the lower and right edges fall into shade
  ctx.lineWidth = 2.4;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length], dx = b.x - a.x, dy = b.y - a.y;
    ctx.strokeStyle = dy < -2 || (Math.abs(dy) <= 2 && dx > 0) ? 'rgba(220,238,255,0.55)' : 'rgba(6,14,24,0.5)';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // ---- the playing surface ------------------------------------------------------------------------
  ctx.save();
  poly(ctx, inner); ctx.clip();
  const su = ctx.createLinearGradient(inner[0].x, inner[0].y, inner[6].x, inner[6].y);
  su.addColorStop(0, B.face[0]); su.addColorStop(0.5, B.face[1]); su.addColorStop(1, B.face[2]);
  ctx.fillStyle = su; ctx.fillRect(0, 300, W, 1200);
  // a fine grain, running away from the player (rolled steel / frosted stone)
  for (let n = 0; n < 200; n++) {
    const u0 = -3.6 + rnd() * 7.2, drift = (rnd() - 0.5) * 0.14, amp = 0.01 + rnd() * 0.02, f = 0.6 + rnd() * 1.6, ph = rnd() * TAU;
    ctx.strokeStyle = `rgba(${B.grain[0]},${B.grain[1]},${B.grain[2]},${0.03 + rnd() * 0.08})`; ctx.lineWidth = 0.6 + rnd() * 1.2;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) { const v = -0.6 + (k / 24) * 7.2, p = project(u0 + amp * Math.sin(v * f + ph) + drift * (v / 6), v); if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
    ctx.stroke();
  }
  // speckle: tiny frost grains
  for (let i = 0; i < 1600; i++) {
    const u = -3.6 + rnd() * 7.2, v = -0.6 + rnd() * 7.2, p = project(u, v);
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.10 + rnd() * 0.3})` : `rgba(20,40,70,${0.05 + rnd() * 0.12})`;
    ctx.fillRect(p.x, p.y, 1 + rnd() * 1.4, 1 + rnd() * 1.1);
  }
  if (B.ferns) {
    // ice ferns: little branching crystals growing in from the edges and corners
    ctx.lineCap = 'round';
    const fern = (x, y, a, len, depth) => {
      if (depth < 0 || len < 3) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.strokeStyle = `rgba(255,255,255,${0.10 + depth * 0.05})`; ctx.lineWidth = 0.6 + depth * 0.35;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      fern(x2, y2, a + (rnd() - 0.5) * 0.5, len * 0.78, depth - 1);
      if (depth > 0) { fern(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, a + 0.9, len * 0.5, depth - 1); fern(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, a - 0.9, len * 0.5, depth - 1); }
    };
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i], b = inner[(i + 1) % inner.length];
      for (let k = 0; k < 4; k++) {
        const t = rnd(), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, cx = 360, cy = 940, ang = Math.atan2(cy - y, cx - x) + (rnd() - 0.5) * 0.9;
        fern(x, y, ang, 26 + rnd() * 30, 3);
      }
    }
  }
  // the moon on the slab: a broad sheen from the upper left, and a cool fall-off to the lower right
  const sheen = ctx.createRadialGradient(150, inner[0].y + 20, 20, 230, inner[0].y + 160, 640);
  sheen.addColorStop(0, B.sheen); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 300, W, 1200);
  const shade = ctx.createLinearGradient(0, 900, 720, 1400); shade.addColorStop(0, 'rgba(0,10,30,0)'); shade.addColorStop(1, 'rgba(0,10,30,0.22)');
  ctx.fillStyle = shade; ctx.fillRect(0, 300, W, 1200);
  ctx.restore();
  // inner lip where the surface meets the frame
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,16,28,0.6)'; poly(ctx, inner); ctx.stroke();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(230,244,255,0.4)';
  ctx.beginPath(); ctx.moveTo(inner[1].x - 2, inner[1].y + 3); ctx.lineTo(inner[2].x - 3, inner[2].y + 2); ctx.stroke();

  // ---- the lines: a groove cut into the surface, with a lit lower wall -----------------------------
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of boardSegments()) {
    const a = project(x0 - 3, y0), b = project(x1 - 3, y1), w = 5.4 * UNIT * (a.s + b.s) / 2;
    ctx.strokeStyle = B.lineLit; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x + 1.3, a.y + 1.7); ctx.lineTo(b.x + 1.3, b.y + 1.7); ctx.stroke();
    ctx.strokeStyle = B.line; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,10,24,0.4)'; ctx.lineWidth = w * 0.35; ctx.beginPath(); ctx.moveTo(a.x - 0.7, a.y - 0.8); ctx.lineTo(b.x - 0.7, b.y - 0.8); ctx.stroke();
  }
  // the fox's own point (the centre) is ringed
  { const c = project(0, 3), rx = 27 * UNIT * c.s, ry = rx * 0.82; ctx.strokeStyle = B.line; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = B.lineLit; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(c.x + 1, c.y + 1.4, rx, ry, 0, 0, TAU); ctx.stroke(); }
  // a bead set into each of the 33 points
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!onBoard(x, y)) continue;
    const p = project(x - 3, y), rx = 13.5 * UNIT * p.s, ry = rx * 0.84;
    ctx.fillStyle = B.ring; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx + 2.6, ry + 2.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(p.x + 0.8, p.y + 1.5, rx + 2.6, ry + 2.3, 0, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fill();
    const g = ctx.createRadialGradient(p.x - rx * 0.4, p.y - ry * 0.5, 1, p.x, p.y, rx);
    g.addColorStop(0, B.bead[0]); g.addColorStop(0.5, B.bead[1]); g.addColorStop(1, B.bead[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(p.x - rx * 0.35, p.y - ry * 0.4, rx * 0.28, ry * 0.2, -0.4, 0, TAU); ctx.fill();
  }
  // studs in the twelve corners of the frame
  for (const [u, v] of [[-1.53, -0.53], [1.53, -0.53], [1.53, 1.47], [3.53, 1.47], [3.53, 4.53], [1.53, 4.53], [1.53, 6.53], [-1.53, 6.53], [-1.53, 4.53], [-3.53, 4.53], [-3.53, 1.47], [-1.53, 1.47]]) {
    const p = project(u, v), r = 5.4 * UNIT * p.s;
    const g = ctx.createRadialGradient(p.x - r * 0.4, p.y - r * 0.4, 0.5, p.x, p.y, r);
    g.addColorStop(0, B.stud[0]); g.addColorStop(1, B.stud[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }
}

const layers = {};     // one cached layer per board look, painted the first time it is needed
export function drawTableAndBoard(ctx, look = 'frost') {
  if (!(look in layers)) {
    layers[look] = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(W * 2, H * 2), lctx = c.getContext('2d');
        lctx.scale(2, 2); paintStatic(lctx, look); layers[look] = c;
      }
    } catch { layers[look] = null; }
  }
  if (layers[look]) ctx.drawImage(layers[look], 0, 0, W, H); else paintStatic(ctx, look);
}
