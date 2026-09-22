// The table and the inlaid board: painted ONCE into a cached layer (2x resolution). One lamp, from the upper left.
import { W, H, FRAME, IN, CH, SLOT, PLEN, TRAY, DICE, MID, pointGeom } from './layout.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };

// fine wood grain: many long, slightly wavy, translucent strokes inside a rectangle
function grain(c, x, y, w, h, { seed = 1, dark = 'rgba(40,18,6,', light = 'rgba(255,220,160,', n = 90, vertical = false, amp = 3, a = 0.13 } = {}) {
  const r = lcg(seed);
  c.save(); rr(c, x, y, w, h, 0); c.clip();
  for (let i = 0; i < n; i++) {
    const p = r(), q = r(), len = (vertical ? h : w) * (0.4 + r() * 0.9), start = (r() - 0.2) * (vertical ? h : w);
    const dk = r() < 0.6; c.strokeStyle = (dk ? dark : light) + (a * (0.4 + r())).toFixed(3) + ')'; c.lineWidth = 0.6 + r() * 1.8;
    c.beginPath();
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const u = start + t * len, wob = Math.sin(t * 5 + q * 9) * amp * (0.4 + q);
      if (vertical) { const px = x + p * w + wob, py = y + u; t === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }
      else { const px = x + u, py = y + p * h + wob; t === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }
    }
    c.stroke();
  }
  c.restore();
}

function star8(c, cx, cy, r, fills) {
  // an eight-pointed inlay star: two squares, a ring and a centre stone
  c.save(); c.translate(cx, cy);
  const sq = (rad, rot, fill, stroke) => { c.save(); c.rotate(rot); c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 1.2; c.beginPath(); c.rect(-rad, -rad, rad * 2, rad * 2); c.fill(); c.stroke(); c.restore(); };
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(1.5, 2.5, r * 1.02, 0, TAU); c.fill();
  c.fillStyle = fills[0]; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.strokeStyle = '#e6c56a'; c.lineWidth = 1.6; c.stroke();
  const k = r * 0.72;
  sq(k, 0, fills[1], 'rgba(0,0,0,0.5)'); sq(k, Math.PI / 4, fills[2], 'rgba(0,0,0,0.5)');
  c.fillStyle = fills[3]; c.beginPath(); c.arc(0, 0, r * 0.3, 0, TAU); c.fill(); c.strokeStyle = '#e6c56a'; c.lineWidth = 1.2; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(-r * 0.08, -r * 0.1, r * 0.08, 0, TAU); c.fill();
  c.restore();
}

function point(c, idx) {
  const g = pointGeom(idx), y0 = g.y - SLOT / 2 + 3, y1 = g.y + SLOT / 2 - 3, bx = g.edge, tx = g.edge + g.dir * PLEN;
  const teal = idx % 2 === 0;
  const path = (inset = 0) => {
    const d = g.dir, a = inset;
    c.beginPath();
    c.moveTo(bx, y0 + a * 0.5); c.lineTo(tx - d * (a * 2.4 + 4), g.y - 1.4); c.quadraticCurveTo(tx - d * a * 2.4, g.y, tx - d * (a * 2.4 + 4), g.y + 1.4); c.lineTo(bx, y1 - a * 0.5); c.closePath();
  };
  // soft shadow the inlay casts on the wood
  path(); c.save(); c.translate(2, 3); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill(); c.restore();
  path(); c.fillStyle = teal ? lin(c, bx, 0, tx, 0, [[0, '#1c5a62'], [0.6, '#27757a'], [1, '#38928c']]) : lin(c, bx, 0, tx, 0, [[0, '#8c3521'], [0.6, '#b0522f'], [1, '#c9713e']]); c.fill();
  // fine diagonal grain of the stained veneer
  c.save(); path(); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
  for (let k = -300; k < 300; k += 5) { c.beginPath(); c.moveTo(bx + g.dir * (k), y0); c.lineTo(bx + g.dir * (k + 60), y1); c.stroke(); }
  // lit edge on the side facing the lamp (upper left), shaded edge opposite
  c.strokeStyle = 'rgba(255,240,200,0.38)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, y0 + 1.5); c.lineTo(tx - g.dir * 8, g.y - 1.5); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.38)'; c.beginPath(); c.moveTo(bx, y1 - 1.5); c.lineTo(tx - g.dir * 8, g.y + 1.5); c.stroke();
  c.restore();
  path(); c.strokeStyle = 'rgba(30,12,4,0.65)'; c.lineWidth = 1.6; c.stroke();
  // gold inlay line and a diamond of bone at the base
  path(7); c.strokeStyle = 'rgba(232,196,106,0.72)'; c.lineWidth = 1.3; c.stroke();
  // a thin mother-of-pearl spine down the middle of the inlay
  const sp = c.createLinearGradient(bx, 0, tx, 0); sp.addColorStop(0, 'rgba(255,250,230,0.0)'); sp.addColorStop(0.25, 'rgba(255,250,230,0.5)'); sp.addColorStop(1, 'rgba(255,250,230,0.05)');
  c.strokeStyle = sp; c.lineWidth = 2.2; c.beginPath(); c.moveTo(bx + g.dir * 14, g.y); c.lineTo(tx - g.dir * 34, g.y); c.stroke();
  for (const f of [0.18, 0.34]) { c.fillStyle = 'rgba(255,246,214,0.75)'; c.beginPath(); c.arc(bx + g.dir * PLEN * f, g.y, 3, 0, TAU); c.fill(); c.strokeStyle = 'rgba(232,196,106,0.9)'; c.lineWidth = 1; c.stroke(); }
  const dx = bx + g.dir * (PLEN * 0.62);
  c.save(); c.translate(dx, g.y); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(240,226,190,0.9)'; c.fillRect(-4, -4, 8, 8); c.strokeStyle = 'rgba(60,30,10,0.6)'; c.lineWidth = 1; c.strokeRect(-4, -4, 8, 8); c.restore();
  c.fillStyle = 'rgba(232,196,106,0.85)'; c.beginPath(); c.arc(tx - g.dir * 26, g.y, 2.6, 0, TAU); c.fill();
  c.fillStyle = 'rgba(232,196,106,0.85)'; c.beginPath(); c.arc(dx - g.dir * 26, g.y, 2, 0, TAU); c.fill(); c.beginPath(); c.arc(dx + g.dir * 26, g.y, 2, 0, TAU); c.fill();
}

function brass(c, x, y, w, h, r = 4) {
  rr(c, x, y, w, h, r); c.fillStyle = lin(c, x, y, x, y + h, [[0, '#f6dc8a'], [0.45, '#c8973a'], [0.55, '#a9772a'], [1, '#e2b85c']]); c.fill();
  c.strokeStyle = 'rgba(60,30,5,0.7)'; c.lineWidth = 1.2; c.stroke();
}
function screw(c, x, y) { c.fillStyle = '#7b5518'; c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.fill(); c.strokeStyle = '#f4d98a'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.stroke(); c.strokeStyle = '#3a2508'; c.beginPath(); c.moveTo(x - 2, y + 1); c.lineTo(x + 2, y - 1); c.stroke(); }

// a copper coffee pot (cezve), a cup on its saucer and a tulip glass: drawn small in the top corners
function coffeeSet(c) {
  // tray
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(78, 104, 76, 14, 0, 0, TAU); c.fill();
  c.fillStyle = lin(c, 0, 84, 0, 110, [[0, '#d9a057'], [1, '#8a4f1f']]); c.beginPath(); c.ellipse(78, 98, 72, 13, 0, 0, TAU); c.fill();
  c.strokeStyle = '#f0c684'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(78, 98, 62, 9, 0, 0, TAU); c.fill();
  // pot: wide base, narrow neck, flared lip, long handle
  const pot = () => { c.beginPath(); c.moveTo(24, 96); c.bezierCurveTo(22, 76, 34, 58, 42, 44); c.lineTo(38, 36); c.quadraticCurveTo(48, 30, 58, 36); c.lineTo(54, 44); c.bezierCurveTo(62, 58, 74, 76, 72, 96); c.closePath(); };
  pot(); c.fillStyle = lin(c, 22, 0, 74, 0, [[0, '#7a3612'], [0.3, '#e8a165'], [0.55, '#c26f33'], [1, '#6a2d0e']]); c.fill();
  c.strokeStyle = '#4a1f08'; c.lineWidth = 1.4; c.stroke();
  c.save(); pot(); c.clip(); c.strokeStyle = 'rgba(255,225,170,0.6)'; c.lineWidth = 1.2; for (const yy of [78, 86]) { c.beginPath(); c.moveTo(20, yy); c.quadraticCurveTo(48, yy + 5, 76, yy); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(36, 70, 3, 14, 0.2, 0, TAU); c.fill(); c.restore();
  c.fillStyle = 'rgba(30,10,0,0.75)'; c.beginPath(); c.ellipse(48, 35, 9, 3, 0, 0, TAU); c.fill();
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(70, 82); c.quadraticCurveTo(100, 82, 114, 52); c.stroke();
  c.strokeStyle = '#8a6a44'; c.lineWidth = 2; c.beginPath(); c.moveTo(70, 81); c.quadraticCurveTo(100, 81, 114, 51); c.stroke();
  // cup and saucer
  c.fillStyle = '#f4ecd8'; c.beginPath(); c.ellipse(128, 100, 22, 6, 0, 0, TAU); c.fill(); c.strokeStyle = '#c9a34e'; c.lineWidth = 1.2; c.stroke();
  c.beginPath(); c.moveTo(114, 84); c.quadraticCurveTo(114, 102, 128, 102); c.quadraticCurveTo(142, 102, 142, 84); c.closePath(); c.fillStyle = lin(c, 114, 0, 142, 0, [[0, '#e8dcc0'], [0.4, '#fffaf0'], [1, '#d8c9a4']]); c.fill(); c.strokeStyle = '#c9a34e'; c.stroke();
  c.fillStyle = '#4a2410'; c.beginPath(); c.ellipse(128, 84, 14, 3.4, 0, 0, TAU); c.fill(); c.strokeStyle = '#e8d49a'; c.stroke();
  c.strokeStyle = '#e8dcc0'; c.lineWidth = 2.4; c.beginPath(); c.arc(143, 90, 5, -1.3, 1.5); c.stroke();
  c.restore();
}

export function paintStatic(c) {
  // ---- the table under a warm lamp -------------------------------------------------------------------
  c.fillStyle = lin(c, 0, 0, 0, H, [[0, '#2c1a10'], [0.5, '#22130b'], [1, '#150b06']]); c.fillRect(0, 0, W, H);
  grain(c, 0, 0, W, H, { seed: 7, n: 240, amp: 5, a: 0.07 });
  const lamp = c.createRadialGradient(140, 40, 20, 240, 240, 820);
  lamp.addColorStop(0, 'rgba(255,200,120,0.45)'); lamp.addColorStop(0.5, 'rgba(255,170,90,0.12)'); lamp.addColorStop(1, 'rgba(255,170,90,0)');
  c.fillStyle = lamp; c.fillRect(0, 0, W, H);
  const vg = c.createRadialGradient(360, 780, 420, 360, 780, 1000); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  coffeeSet(c);

  // ---- the board: drop shadow, walnut frame, marquetry band ----------------------------------------------
  const F = FRAME;
  for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(0,0,0,0.07)'; rr(c, F.x + 6 + i * 2, F.y + 12 + i * 3, F.w, F.h, 22); c.fill(); }
  rr(c, F.x, F.y, F.w, F.h, 20); c.fillStyle = lin(c, F.x, F.y, F.x + F.w, F.y + F.h, [[0, '#7a4a2b'], [0.5, '#5a3320'], [1, '#3e2114']]); c.fill();
  grain(c, F.x, F.y, F.w, F.h, { seed: 11, n: 200, amp: 4, a: 0.16, vertical: true });
  c.strokeStyle = 'rgba(255,225,170,0.5)'; c.lineWidth = 2; rr(c, F.x + 1, F.y + 1, F.w - 2, F.h - 2, 19); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2; rr(c, F.x - 1, F.y - 1, F.w + 2, F.h + 2, 21); c.stroke();
  // mosaic band of bone and turquoise diamonds
  const band = (inset, half, step) => {
    const x0 = F.x + inset, y0 = F.y + inset, x1 = F.x + F.w - inset, y1 = F.y + F.h - inset; let k = 0;
    const tile = (x, y) => { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = k++ % 2 ? '#eadfc2' : '#2c8a8a'; c.fillRect(-half, -half, half * 2, half * 2); c.strokeStyle = 'rgba(40,20,8,0.7)'; c.lineWidth = 0.9; c.strokeRect(-half, -half, half * 2, half * 2); c.restore(); };
    for (let x = x0 + 8; x < x1 - 4; x += step) { tile(x, y0); tile(x, y1); }
    for (let y = y0 + 8; y < y1 - 4; y += step) { tile(x0, y); tile(x1, y); }
  };
  band(11, 4.4, 12.4);
  c.strokeStyle = 'rgba(232,196,106,0.85)'; c.lineWidth = 1.6; rr(c, F.x + 20, F.y + 20, F.w - 40, F.h - 40, 8); c.stroke();
  c.strokeStyle = 'rgba(232,196,106,0.5)'; c.lineWidth = 1; rr(c, F.x + 4, F.y + 4, F.w - 8, F.h - 8, 16); c.stroke();
  // brass corner plates
  for (const [cx, cy, sx, sy] of [[F.x + 8, F.y + 8, 1, 1], [F.x + F.w - 8, F.y + 8, -1, 1], [F.x + 8, F.y + F.h - 8, 1, -1], [F.x + F.w - 8, F.y + F.h - 8, -1, -1]]) {
    c.save(); c.translate(cx, cy); c.scale(sx, sy); c.beginPath(); c.moveTo(0, 0); c.lineTo(30, 0); c.quadraticCurveTo(12, 10, 0, 30); c.closePath(); c.fillStyle = lin(c, 0, 0, 30, 30, [[0, '#f6dc8a'], [1, '#a9772a']]); c.fill(); c.strokeStyle = 'rgba(60,30,5,0.75)'; c.stroke(); c.restore();
    screw(c, cx + sx * 8, cy + sy * 8);
  }

  // ---- the playing field: burl wood, recessed --------------------------------------------------------------
  const iw = IN.x1 - IN.x0, ih = IN.y1 - IN.y0;
  c.fillStyle = lin(c, IN.x0, IN.y0, IN.x1, IN.y1, [[0, '#a4713f'], [0.5, '#8c5a30'], [1, '#6f4424']]); c.fillRect(IN.x0, IN.y0, iw, ih);
  grain(c, IN.x0, IN.y0, iw, ih, { seed: 21, n: 130, amp: 6, a: 0.13, vertical: true });
  // burl knots
  const r = lcg(5); for (let i = 0; i < 14; i++) { const x = IN.x0 + r() * iw, y = IN.y0 + r() * ih; for (let k = 1; k < 5; k++) { c.strokeStyle = `rgba(50,22,8,${0.08 - k * 0.012})`; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, k * 9, k * 4.5, 0.4, 0, TAU); c.stroke(); } }
  // recess shading: dark on the top and left inner edges (lamp is upper left), light on the far edges
  const sh = (x0, y0, x1, y1, a) => { const gg = lin(c, x0, y0, x1, y1, [[0, `rgba(0,0,0,${a})`], [1, 'rgba(0,0,0,0)']]); c.fillStyle = gg; };
  sh(0, IN.y0, 0, IN.y0 + 22, 0.55); c.fillRect(IN.x0, IN.y0, iw, 22); sh(IN.x0, 0, IN.x0 + 20, 0, 0.5); c.fillRect(IN.x0, IN.y0, 20, ih);
  c.fillStyle = lin(c, 0, IN.y1, 0, IN.y1 - 10, [[0, 'rgba(255,220,160,0.25)'], [1, 'rgba(255,220,160,0)']]); c.fillRect(IN.x0, IN.y1 - 10, iw, 10);

  for (let i = 0; i < 24; i++) point(c, i);
  // point numbers, small and engraved, at the tip of each point
  c.font = '600 15px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) { const g = pointGeom(i), x = g.edge + g.dir * (PLEN + 15); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(String(i + 1), x + 0.8, g.y + 1); c.fillStyle = 'rgba(250,232,190,0.72)'; c.fillText(String(i + 1), x, g.y); }
  c.textBaseline = 'alphabetic';

  // ---- the bar: a dark walnut strip with inlaid stars and brass hinges -------------------------------------
  c.fillStyle = lin(c, CH.x0, 0, CH.x1, 0, [[0, '#2a150b'], [0.5, '#4a2914'], [1, '#2a150b']]); c.fillRect(CH.x0, IN.y0, CH.x1 - CH.x0, ih);
  grain(c, CH.x0, IN.y0, CH.x1 - CH.x0, ih, { seed: 33, n: 40, amp: 2, a: 0.16, vertical: true });
  for (const x of [CH.x0 + 5, CH.x1 - 5]) { c.strokeStyle = 'rgba(232,196,106,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, IN.y0 + 6); c.lineTo(x, IN.y1 - 6); c.stroke(); }
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.strokeRect(CH.x0, IN.y0, CH.x1 - CH.x0, ih);
  c.save(); c.beginPath(); c.rect(CH.x0 + 8, IN.y0 + 84, CH.x1 - CH.x0 - 16, ih - 168); c.clip();
  for (let y = IN.y0 + 90; y < IN.y1 - 80; y += 26) for (const dxx of [-16, 16]) { c.save(); c.translate(CH.cx + dxx, y + (dxx > 0 ? 13 : 0)); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(234,223,194,0.13)'; c.fillRect(-5, -5, 10, 10); c.strokeStyle = 'rgba(232,196,106,0.25)'; c.lineWidth = 0.8; c.strokeRect(-5, -5, 10, 10); c.restore(); }
  c.restore();
  star8(c, CH.cx, IN.y0 + 46, 30, ['#3a1f10', '#2c8a8a', '#eadfc2', '#c9713e']);
  star8(c, CH.cx, IN.y1 - 46, 30, ['#3a1f10', '#2c8a8a', '#eadfc2', '#c9713e']);
  for (const yy of [MID - 134, MID + 134]) { c.save(); c.translate(CH.cx, yy); c.rotate(Math.PI / 4); c.fillStyle = '#eadfc2'; c.fillRect(-6, -6, 12, 12); c.strokeStyle = '#e6c56a'; c.strokeRect(-6, -6, 12, 12); c.restore(); }
  // brass hinges on the top and bottom of the bar
  for (const y of [FRAME.y - 2, FRAME.y + FRAME.h - 26]) { brass(c, CH.cx - 44, y, 88, 28, 6); screw(c, CH.cx - 32, y + 14); screw(c, CH.cx + 32, y + 14); c.fillStyle = lin(c, CH.cx - 12, 0, CH.cx + 12, 0, [[0, '#8a5f1e'], [0.4, '#f8e4a0'], [1, '#8a5f1e']]); c.fillRect(CH.cx - 12, y + 3, 24, 22); }

  // ---- the two off-trays, recessed with felt --------------------------------------------------------------
  for (const T of [TRAY.opp, TRAY.me]) {
    rr(c, T.x - 6, T.y - 6, T.w + 12, T.h + 12, 12); c.fillStyle = lin(c, 0, T.y - 6, 0, T.y + T.h + 6, [[0, '#4a2914'], [1, '#2e180b']]); c.fill();
    c.strokeStyle = 'rgba(232,196,106,0.6)'; c.lineWidth = 1.2; c.stroke();
    rr(c, T.x, T.y, T.w, T.h, 8); c.fillStyle = lin(c, 0, T.y, 0, T.y + T.h, [[0, '#3a0f14'], [1, '#5e1c22']]); c.fill();
    c.fillStyle = lin(c, 0, T.y, 0, T.y + 12, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); rr(c, T.x, T.y, T.w, 12, 8); c.fill();
  }
  // ---- the dice tray: burgundy leather in a walnut rim ---------------------------------------------------
  const Dt = DICE;
  for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,0.08)'; rr(c, Dt.x + 4 + i, Dt.y + 8 + i * 2, Dt.w, Dt.h, 18); c.fill(); }
  rr(c, Dt.x - 10, Dt.y - 10, Dt.w + 20, Dt.h + 20, 20); c.fillStyle = lin(c, 0, Dt.y - 10, 0, Dt.y + Dt.h + 10, [[0, '#7a4a2b'], [1, '#3e2114']]); c.fill();
  c.strokeStyle = 'rgba(255,225,170,0.4)'; c.lineWidth = 1.5; c.stroke();
  rr(c, Dt.x, Dt.y, Dt.w, Dt.h, 12); c.fillStyle = lin(c, 0, Dt.y, 0, Dt.y + Dt.h, [[0, '#5a1219'], [1, '#7c222a']]); c.fill();
  const rp = lcg(3); c.fillStyle = 'rgba(0,0,0,0.13)'; for (let i = 0; i < 520; i++) c.fillRect(Dt.x + rp() * Dt.w, Dt.y + rp() * Dt.h, 1.6, 1.6);
  c.fillStyle = lin(c, 0, Dt.y, 0, Dt.y + 22, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); rr(c, Dt.x, Dt.y, Dt.w, 22, 12); c.fill();
  c.strokeStyle = 'rgba(232,196,106,0.7)'; c.lineWidth = 1.2; rr(c, Dt.x + 7, Dt.y + 7, Dt.w - 14, Dt.h - 14, 8); c.stroke();
}

// One cached layer. Falls back to painting directly where OffscreenCanvas does not exist (Node tests).
let layer = null;
export function drawStatic(ctx) {
  if (!layer && typeof OffscreenCanvas !== 'undefined') {
    try { const cv = new OffscreenCanvas(W * 2, H * 2), lc = cv.getContext('2d'); lc.scale(2, 2); paintStatic(lc); layer = cv; } catch { layer = null; }
  }
  if (layer) ctx.drawImage(layer, 0, 0, W, H); else paintStatic(ctx);
}
