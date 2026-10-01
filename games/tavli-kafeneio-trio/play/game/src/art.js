// The kafeneio table and the inlaid board: painted ONCE into a cached layer (2x resolution). One lamp, from the upper left.
// Palette: Aegean blue, limestone cream, terracotta clay, olive wood, walnut, bronze.
import { W, H, FRAME, IN, CH, SLOT, PLEN, TRAY, DICE, MID, pointGeom } from './layout.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
export const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };

// fine wood grain: many long, slightly wavy, translucent strokes inside a rectangle
function grain(c, x, y, w, h, { seed = 1, dark = 'rgba(30,16,6,', light = 'rgba(255,225,170,', n = 90, vertical = false, amp = 3, a = 0.13 } = {}) {
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

// A Greek key (meander) band along a horizontal or vertical strip. Drawn as a continuous stroked line of square hooks.
export function meander(c, x, y, len, h, { vertical = false, color = '#e8c56a', width = 1.6, shadow = true } = {}) {
  const u = h, n = Math.floor(len / (u * 1.5));
  const draw = (dx, dy, col, lw) => {
    c.save(); c.translate(x + dx, y + dy);
    if (vertical) { c.translate(h, 0); c.rotate(Math.PI / 2); }
    c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'miter'; c.lineCap = 'butt'; c.beginPath();
    for (let i = 0; i < n; i++) {
      const o = i * u * 1.5;
      // one hook: up the left, across the top, down to the middle, back left to the middle, then along the base to the next hook
      c.moveTo(o, h); c.lineTo(o, 0); c.lineTo(o + u, 0); c.lineTo(o + u, h * 0.66); c.lineTo(o + u * 0.34, h * 0.66); c.lineTo(o + u * 0.34, h * 0.34);
      c.moveTo(o + u, h); c.lineTo(o + u * 1.5, h);
    }
    c.moveTo(0, h); c.lineTo(n * u * 1.5 + 0, h);
    c.stroke(); c.restore();
  };
  if (shadow) draw(1, 1.5, 'rgba(0,0,0,0.45)', width);
  draw(0, 0, color, width);
}

function star8(c, cx, cy, r, fills) {
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
  const blue = idx % 2 === 0;
  const path = (inset = 0) => {
    const d = g.dir, a = inset;
    c.beginPath();
    c.moveTo(bx, y0 + a * 0.5); c.lineTo(tx - d * (a * 2.4 + 4), g.y - 1.4); c.quadraticCurveTo(tx - d * a * 2.4, g.y, tx - d * (a * 2.4 + 4), g.y + 1.4); c.lineTo(bx, y1 - a * 0.5); c.closePath();
  };
  path(); c.save(); c.translate(2, 3); c.fillStyle = 'rgba(0,0,0,0.32)'; c.fill(); c.restore();
  path(); c.fillStyle = blue ? lin(c, bx, 0, tx, 0, [[0, '#103e72'], [0.6, '#1c5f9f'], [1, '#2f80c2']]) : lin(c, bx, 0, tx, 0, [[0, '#7d2c1b'], [0.6, '#a9482a'], [1, '#c96a3e']]); c.fill();
  c.save(); path(); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
  for (let k = -300; k < 300; k += 5) { c.beginPath(); c.moveTo(bx + g.dir * (k), y0); c.lineTo(bx + g.dir * (k + 60), y1); c.stroke(); }
  c.strokeStyle = 'rgba(255,245,215,0.36)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, y0 + 1.5); c.lineTo(tx - g.dir * 8, g.y - 1.5); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.moveTo(bx, y1 - 1.5); c.lineTo(tx - g.dir * 8, g.y + 1.5); c.stroke();
  c.restore();
  path(); c.strokeStyle = 'rgba(18,10,4,0.7)'; c.lineWidth = 1.6; c.stroke();
  path(7); c.strokeStyle = 'rgba(240,214,140,0.8)'; c.lineWidth = 1.3; c.stroke();
  // a thin cream spine and a row of small beads (limestone and gold) down the middle of the inlay
  const sp = c.createLinearGradient(bx, 0, tx, 0); sp.addColorStop(0, 'rgba(255,250,230,0.0)'); sp.addColorStop(0.25, 'rgba(255,250,230,0.5)'); sp.addColorStop(1, 'rgba(255,250,230,0.05)');
  c.strokeStyle = sp; c.lineWidth = 2.2; c.beginPath(); c.moveTo(bx + g.dir * 14, g.y); c.lineTo(tx - g.dir * 34, g.y); c.stroke();
  for (const f of [0.16, 0.3, 0.44]) { c.fillStyle = 'rgba(255,246,222,0.8)'; c.beginPath(); c.arc(bx + g.dir * PLEN * f, g.y, 2.8, 0, TAU); c.fill(); c.strokeStyle = 'rgba(232,196,106,0.9)'; c.lineWidth = 1; c.stroke(); }
  const dx = bx + g.dir * (PLEN * 0.64);
  c.save(); c.translate(dx, g.y); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(244,232,200,0.92)'; c.fillRect(-4.5, -4.5, 9, 9); c.strokeStyle = 'rgba(60,30,10,0.6)'; c.lineWidth = 1; c.strokeRect(-4.5, -4.5, 9, 9); c.restore();
  c.fillStyle = 'rgba(232,196,106,0.9)'; c.beginPath(); c.arc(tx - g.dir * 26, g.y, 2.6, 0, TAU); c.fill();
}

function bronze(c, x, y, w, h, r = 4) {
  rr(c, x, y, w, h, r); c.fillStyle = lin(c, x, y, x, y + h, [[0, '#f0d28a'], [0.45, '#c08a3c'], [0.55, '#9a6a2a'], [1, '#dcae5c']]); c.fill();
  c.strokeStyle = 'rgba(60,30,5,0.7)'; c.lineWidth = 1.2; c.stroke();
}
function screw(c, x, y) { c.fillStyle = '#7b5518'; c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.fill(); c.strokeStyle = '#f4d98a'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.stroke(); c.strokeStyle = '#3a2508'; c.beginPath(); c.moveTo(x - 2, y + 1); c.lineTo(x + 2, y - 1); c.stroke(); }

// the wall behind the header: Aegean-blue painted plaster with a cream frieze
function wall(c) {
  c.fillStyle = lin(c, 0, 0, 0, 270, [[0, '#0b2d52'], [0.7, '#134a80'], [1, '#0e3a68']]); c.fillRect(0, 0, W, 270);
  const r = lcg(31);                                     // plaster mottling
  for (let i = 0; i < 380; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,10,30,0.07)'; const s = 6 + r() * 34; c.beginPath(); c.ellipse(r() * W, r() * 270, s, s * (0.3 + r() * 0.5), r() * 3, 0, TAU); c.fill(); }
  const lamp = c.createRadialGradient(150, 30, 10, 220, 160, 560); lamp.addColorStop(0, 'rgba(255,214,150,0.5)'); lamp.addColorStop(0.5, 'rgba(255,190,110,0.12)'); lamp.addColorStop(1, 'rgba(255,170,90,0)');
  c.fillStyle = lamp; c.fillRect(0, 0, W, 270);
  // cream frieze with a meander along the lower edge of the wall
  c.fillStyle = lin(c, 0, 236, 0, 262, [[0, '#f3e9cf'], [1, '#d9c9a0']]); c.fillRect(0, 238, W, 22);
  meander(c, 6, 241, W - 12, 16, { color: '#15487c', width: 1.8, shadow: false });
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 260, W, 4);
}

export function paintStatic(c) {
  // ---- wall and tabletop ------------------------------------------------------------------------------------------------
  c.fillStyle = lin(c, 0, 0, 0, H, [[0, '#2b1a0f'], [0.5, '#22140a'], [1, '#150b05']]); c.fillRect(0, 0, W, H);
  grain(c, 0, 1290, W, 280, { seed: 7, n: 220, amp: 5, a: 0.1, vertical: false });
  wall(c);
  const lampT = c.createRadialGradient(160, 1300, 20, 260, 1400, 700); lampT.addColorStop(0, 'rgba(255,200,130,0.22)'); lampT.addColorStop(1, 'rgba(255,200,130,0)'); c.fillStyle = lampT; c.fillRect(0, 1290, W, 270);
  const vg = c.createRadialGradient(360, 800, 460, 360, 800, 1050); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);

  // ---- the board: drop shadow, walnut frame, meander inlay ------------------------------------------------------------------
  const F = FRAME;
  for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(0,0,0,0.07)'; rr(c, F.x + 6 + i * 2, F.y + 12 + i * 3, F.w, F.h, 22); c.fill(); }
  rr(c, F.x, F.y, F.w, F.h, 20); c.fillStyle = lin(c, F.x, F.y, F.x + F.w, F.y + F.h, [[0, '#6e4325'], [0.5, '#4f2c1a'], [1, '#34190f']]); c.fill();
  grain(c, F.x, F.y, F.w, F.h, { seed: 11, n: 200, amp: 4, a: 0.16, vertical: true });
  c.strokeStyle = 'rgba(255,225,170,0.5)'; c.lineWidth = 2; rr(c, F.x + 1, F.y + 1, F.w - 2, F.h - 2, 19); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2; rr(c, F.x - 1, F.y - 1, F.w + 2, F.h + 2, 21); c.stroke();
  // blue inlay rails with a gold meander running all round the frame
  c.strokeStyle = '#14416f'; c.lineWidth = 19; rr(c, F.x + 17, F.y + 17, F.w - 34, F.h - 34, 10); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.5; rr(c, F.x + 7.5, F.y + 7.5, F.w - 15, F.h - 15, 14); c.stroke(); rr(c, F.x + 26.5, F.y + 26.5, F.w - 53, F.h - 53, 7); c.stroke();
  meander(c, F.x + 20, F.y + 9.5, F.w - 40, 15, { color: '#f1d98f', width: 1.5, shadow: false });
  meander(c, F.x + 20, F.y + F.h - 25, F.w - 40, 15, { color: '#f1d98f', width: 1.5, shadow: false });
  meander(c, F.x + 9.5, F.y + 20, F.h - 40, 15, { vertical: true, color: '#f1d98f', width: 1.5, shadow: false });
  meander(c, F.x + F.w - 25, F.y + 20, F.h - 40, 15, { vertical: true, color: '#f1d98f', width: 1.5, shadow: false });
  for (const [cx, cy, sx, sy] of [[F.x + 8, F.y + 8, 1, 1], [F.x + F.w - 8, F.y + 8, -1, 1], [F.x + 8, F.y + F.h - 8, 1, -1], [F.x + F.w - 8, F.y + F.h - 8, -1, -1]]) {
    c.save(); c.translate(cx, cy); c.scale(sx, sy); c.beginPath(); c.moveTo(0, 0); c.lineTo(30, 0); c.quadraticCurveTo(12, 10, 0, 30); c.closePath(); c.fillStyle = lin(c, 0, 0, 30, 30, [[0, '#f0d28a'], [1, '#9a6a2a']]); c.fill(); c.strokeStyle = 'rgba(60,30,5,0.75)'; c.stroke(); c.restore();
    screw(c, cx + sx * 8, cy + sy * 8);
  }

  // ---- the playing field: olive burl wood, recessed -------------------------------------------------------------------------
  const iw = IN.x1 - IN.x0, ih = IN.y1 - IN.y0;
  c.fillStyle = lin(c, IN.x0, IN.y0, IN.x1, IN.y1, [[0, '#b58f52'], [0.5, '#98733d'], [1, '#7a5a2c']]); c.fillRect(IN.x0, IN.y0, iw, ih);
  grain(c, IN.x0, IN.y0, iw, ih, { seed: 21, n: 130, amp: 6, a: 0.13, vertical: true });
  const r = lcg(5); for (let i = 0; i < 14; i++) { const x = IN.x0 + r() * iw, y = IN.y0 + r() * ih; for (let k = 1; k < 5; k++) { c.strokeStyle = `rgba(50,28,8,${0.08 - k * 0.012})`; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, k * 9, k * 4.5, 0.4, 0, TAU); c.stroke(); } }
  const sh = (x0, y0, x1, y1, a) => { c.fillStyle = lin(c, x0, y0, x1, y1, [[0, `rgba(0,0,0,${a})`], [1, 'rgba(0,0,0,0)']]); };
  sh(0, IN.y0, 0, IN.y0 + 22, 0.55); c.fillRect(IN.x0, IN.y0, iw, 22); sh(IN.x0, 0, IN.x0 + 20, 0, 0.5); c.fillRect(IN.x0, IN.y0, 20, ih);
  c.fillStyle = lin(c, 0, IN.y1, 0, IN.y1 - 10, [[0, 'rgba(255,225,170,0.25)'], [1, 'rgba(255,225,170,0)']]); c.fillRect(IN.x0, IN.y1 - 10, iw, 10);

  for (let i = 0; i < 24; i++) point(c, i);
  c.font = '600 15px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) { const g = pointGeom(i), x = g.edge + g.dir * (PLEN + 15); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(String(i + 1), x + 0.8, g.y + 1); c.fillStyle = 'rgba(250,236,196,0.74)'; c.fillText(String(i + 1), x, g.y); }
  c.textBaseline = 'alphabetic';

  // ---- the channel: dark walnut with a meander spine and two medallions ---------------------------------------------------------
  c.fillStyle = lin(c, CH.x0, 0, CH.x1, 0, [[0, '#26140a'], [0.5, '#46271a'], [1, '#26140a']]); c.fillRect(CH.x0, IN.y0, CH.x1 - CH.x0, ih);
  grain(c, CH.x0, IN.y0, CH.x1 - CH.x0, ih, { seed: 33, n: 40, amp: 2, a: 0.16, vertical: true });
  for (const x of [CH.x0 + 5, CH.x1 - 5]) { c.strokeStyle = 'rgba(240,214,140,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, IN.y0 + 6); c.lineTo(x, IN.y1 - 6); c.stroke(); }
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.strokeRect(CH.x0, IN.y0, CH.x1 - CH.x0, ih);
  c.fillStyle = 'rgba(20,65,111,0.85)'; c.fillRect(CH.cx - 14, IN.y0 + 84, 28, ih - 168);
  meander(c, CH.cx - 11, IN.y0 + 86, ih - 172, 22, { vertical: true, color: '#f1d98f', width: 1.5, shadow: false });
  star8(c, CH.cx, IN.y0 + 46, 30, ['#1a3a5e', '#2a73b8', '#f1e6c8', '#c96a3e']);
  star8(c, CH.cx, IN.y1 - 46, 30, ['#1a3a5e', '#2a73b8', '#f1e6c8', '#c96a3e']);
  for (const yy of [MID - 134, MID + 134]) { c.save(); c.translate(CH.cx, yy); c.rotate(Math.PI / 4); c.fillStyle = '#f1e6c8'; c.fillRect(-6, -6, 12, 12); c.strokeStyle = '#e6c56a'; c.strokeRect(-6, -6, 12, 12); c.restore(); }
  for (const y of [FRAME.y - 2, FRAME.y + FRAME.h - 26]) { bronze(c, CH.cx - 44, y, 88, 28, 6); screw(c, CH.cx - 32, y + 14); screw(c, CH.cx + 32, y + 14); c.fillStyle = lin(c, CH.cx - 12, 0, CH.cx + 12, 0, [[0, '#8a5f1e'], [0.4, '#f8e4a0'], [1, '#8a5f1e']]); c.fillRect(CH.cx - 12, y + 3, 24, 22); }

  // ---- the two off-trays, recessed with blue felt -------------------------------------------------------------------------------
  for (const T of [TRAY.opp, TRAY.me]) {
    rr(c, T.x - 6, T.y - 6, T.w + 12, T.h + 12, 12); c.fillStyle = lin(c, 0, T.y - 6, 0, T.y + T.h + 6, [[0, '#4a2914'], [1, '#2e180b']]); c.fill();
    c.strokeStyle = 'rgba(240,214,140,0.6)'; c.lineWidth = 1.2; c.stroke();
    rr(c, T.x, T.y, T.w, T.h, 8); c.fillStyle = lin(c, 0, T.y, 0, T.y + T.h, [[0, '#0a2540'], [1, '#164a7c']]); c.fill();
    c.fillStyle = lin(c, 0, T.y, 0, T.y + 12, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); rr(c, T.x, T.y, T.w, 12, 8); c.fill();
  }
  // ---- the dice tray: blue felt in a walnut rim ---------------------------------------------------------------------------------
  const Dt = DICE;
  for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,0.08)'; rr(c, Dt.x + 4 + i, Dt.y + 8 + i * 2, Dt.w, Dt.h, 18); c.fill(); }
  rr(c, Dt.x - 10, Dt.y - 10, Dt.w + 20, Dt.h + 20, 20); c.fillStyle = lin(c, 0, Dt.y - 10, 0, Dt.y + Dt.h + 10, [[0, '#6e4325'], [1, '#34190f']]); c.fill();
  c.strokeStyle = 'rgba(255,225,170,0.4)'; c.lineWidth = 1.5; c.stroke();
  rr(c, Dt.x, Dt.y, Dt.w, Dt.h, 12); c.fillStyle = lin(c, 0, Dt.y, 0, Dt.y + Dt.h, [[0, '#0c2d52'], [1, '#1a5896']]); c.fill();
  const rp = lcg(3); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 520; i++) c.fillRect(Dt.x + rp() * Dt.w, Dt.y + rp() * Dt.h, 1.6, 1.6);
  c.fillStyle = lin(c, 0, Dt.y, 0, Dt.y + 22, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); rr(c, Dt.x, Dt.y, Dt.w, 22, 12); c.fill();
  c.strokeStyle = 'rgba(240,214,140,0.7)'; c.lineWidth = 1.2; rr(c, Dt.x + 7, Dt.y + 7, Dt.w - 14, Dt.h - 14, 8); c.stroke();
}

// One cached layer. Falls back to painting directly where OffscreenCanvas does not exist (Node tests).
let layer = null;
export function drawStatic(ctx) {
  if (!layer && typeof OffscreenCanvas !== 'undefined') {
    try { const cv = new OffscreenCanvas(W * 2, H * 2), lc = cv.getContext('2d'); lc.scale(2, 2); paintStatic(lc); layer = cv; } catch { layer = null; }
  }
  if (layer) ctx.drawImage(layer, 0, 0, W, H); else paintStatic(ctx);
}
