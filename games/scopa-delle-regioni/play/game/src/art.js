// Art: the Italian suit pictures, the three court figures, the card back, a French-suit alternative, and the
// trattoria table. ALL of it is original vector drawing done here in code (no copied artwork). Faces and the
// table are painted once into cached layers; per frame we only blit.
import { W, H } from './layout.js';
import { suitOf, rankOf } from './rules.js';

export const CW = 200, CH = 320, TAU = Math.PI * 2, CS = 1.5;
const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? (() => { const c = new OffscreenCanvas(w, h); return { c, x: c.getContext('2d') }; })() : null);
const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rad = (c, x, y, r0, r1, stops, fx = x, fy = y) => { const g = c.createRadialGradient(fx, fy, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };

export const SUIT_COL = [
  { main: '#d8a232', dark: '#8a5a12', light: '#ffe9a0', robe: '#c9861f', robe2: '#7a4310' },   // coins
  { main: '#b3272d', dark: '#5e0e14', light: '#ff9a86', robe: '#b3272d', robe2: '#6c1218' },   // cups
  { main: '#3f66a8', dark: '#182b57', light: '#b9d3f2', robe: '#2f5297', robe2: '#16295a' },   // swords
  { main: '#4d8a3a', dark: '#22421a', light: '#c6e79a', robe: '#3d7a30', robe2: '#1d4416' },   // batons
];

// ---- the four suit pictures, each centred on (0,0) and fitting a box of size s -------------------------------
function coin(c, s) {
  const r = s / 2;
  c.save();
  c.fillStyle = 'rgba(40,20,0,0.28)'; ell(c, r * 0.07, r * 0.1, r, r); c.fill();
  c.fillStyle = lin(c, -r, -r, r, r, [[0, '#fff0b0'], [0.35, '#e6b23e'], [1, '#8a5a12']]); ell(c, 0, 0, r, r); c.fill();
  c.strokeStyle = '#6b420c'; c.lineWidth = r * 0.06; c.stroke();
  c.fillStyle = '#fff3c0';                                 // beaded rim
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; ell(c, Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.05, r * 0.05); c.fill(); }
  c.fillStyle = rad(c, 0, 0, r * 0.1, r * 0.78, [[0, '#f8d670'], [0.7, '#d9a02c'], [1, '#a9701a']], -r * 0.25, -r * 0.3); ell(c, 0, 0, r * 0.74, r * 0.74); c.fill();
  c.strokeStyle = 'rgba(110,64,10,0.8)'; c.lineWidth = r * 0.045; c.stroke();
  c.fillStyle = 'rgba(122,70,10,0.85)';                    // eight-petal rosette
  for (let i = 0; i < 8; i++) { c.save(); c.rotate((i / 8) * TAU); c.beginPath(); c.moveTo(0, -r * 0.1); c.quadraticCurveTo(r * 0.2, -r * 0.34, 0, -r * 0.62); c.quadraticCurveTo(-r * 0.2, -r * 0.34, 0, -r * 0.1); c.fill(); c.restore(); }
  c.fillStyle = '#fff0b0'; ell(c, 0, 0, r * 0.12, r * 0.12); c.fill(); c.strokeStyle = '#7a460a'; c.lineWidth = r * 0.03; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.5)'; ell(c, -r * 0.42, -r * 0.5, r * 0.22, r * 0.09, -0.7); c.fill();
  c.restore();
}
function cup(c, s) {
  const u = s / 100; c.save(); c.scale(u, u);
  c.fillStyle = 'rgba(40,10,0,0.26)'; ell(c, 5, 50, 34, 6); c.fill();
  const body = lin(c, -40, 0, 40, 0, [[0, '#7a1218'], [0.35, '#d24a4a'], [0.55, '#b3272d'], [1, '#5e0e14']]);
  // foot, stem, knop
  c.fillStyle = lin(c, -30, 0, 30, 0, [[0, '#8a5a12'], [0.4, '#f0c65a'], [1, '#7a4a0c']]);
  c.beginPath(); c.moveTo(-30, 46); c.quadraticCurveTo(-30, 36, -12, 33); c.lineTo(12, 33); c.quadraticCurveTo(30, 36, 30, 46); c.quadraticCurveTo(0, 51, -30, 46); c.fill();
  c.beginPath(); c.moveTo(-6, 33); c.lineTo(-5, 17); c.lineTo(5, 17); c.lineTo(6, 33); c.fill();
  ell(c, 0, 24, 11, 5); c.fill();
  // bowl
  c.fillStyle = body; c.beginPath(); c.moveTo(-42, -32); c.bezierCurveTo(-42, 4, -22, 18, -8, 18); c.lineTo(8, 18); c.bezierCurveTo(22, 18, 42, 4, 42, -32); c.closePath(); c.fill();
  c.strokeStyle = '#3e0810'; c.lineWidth = 2.2; c.stroke();
  c.fillStyle = lin(c, 0, -40, 0, -22, [[0, '#f8d670'], [1, '#c98a1f']]); ell(c, 0, -32, 42, 9); c.fill(); c.stroke();
  c.fillStyle = '#4a0a10'; ell(c, 0, -32, 36, 6); c.fill();
  c.strokeStyle = '#f0c65a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-38, -14); c.quadraticCurveTo(0, -4, 38, -14); c.stroke();   // gold band
  c.fillStyle = '#f0c65a'; for (let i = -2; i <= 2; i++) { ell(c, i * 14, -7 + (Math.abs(i) === 2 ? -2 : 0) * -1 + Math.abs(i) * 0.5, 3.2, 3.2); c.fill(); }
  c.strokeStyle = '#f0c65a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-40, -30); c.quadraticCurveTo(-62, -30, -50, -8); c.moveTo(40, -30); c.quadraticCurveTo(62, -30, 50, -8); c.stroke();  // handles
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(-24, -8, 5, 15, 0.3, 0, TAU); c.fill();
  c.restore();
}
function sword(c, s) {
  const u = s / 100; c.save(); c.scale(u, u);
  c.fillStyle = 'rgba(20,20,40,0.22)'; ell(c, 8, 4, 6, 60, 0.12); c.fill();
  // blade: a gently curved steel blade, point up
  c.fillStyle = lin(c, -8, 0, 12, 0, [[0, '#8fa3bd'], [0.45, '#f4f8ff'], [0.55, '#c7d3e4'], [1, '#5d6f8a']]);
  c.beginPath(); c.moveTo(-8, 18); c.bezierCurveTo(-9, -20, -6, -60, 5, -96); c.bezierCurveTo(14, -60, 12, -20, 9, 18); c.closePath(); c.fill();
  c.strokeStyle = '#2c3a55'; c.lineWidth = 2; c.stroke();
  c.strokeStyle = 'rgba(60,80,110,0.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(-1, -20, 1, -55, 5, -82); c.stroke();
  // crossguard
  c.fillStyle = lin(c, 0, 16, 0, 28, [[0, '#ffe08a'], [1, '#a8701a']]);
  c.beginPath(); c.moveTo(-30, 22); c.quadraticCurveTo(0, 12, 30, 22); c.quadraticCurveTo(0, 32, -30, 22); c.fill(); c.strokeStyle = '#5e3a08'; c.lineWidth = 1.8; c.stroke();
  for (const sx of [-30, 30]) { c.fillStyle = '#f7d36a'; ell(c, sx, 22, 5, 5); c.fill(); c.stroke(); }
  // grip and pommel
  c.fillStyle = lin(c, -5, 0, 5, 0, [[0, '#3c1a0c'], [0.5, '#8a4a26'], [1, '#3c1a0c']]); c.fillRect(-5, 27, 10, 28);
  c.strokeStyle = '#d8a232'; c.lineWidth = 1.6; for (let y = 31; y < 54; y += 6) { c.beginPath(); c.moveTo(-5, y); c.lineTo(5, y + 3); c.stroke(); }
  c.fillStyle = rad(c, 0, 60, 1, 9, [[0, '#fff0b0'], [1, '#a8701a']], -2, 57); ell(c, 0, 60, 8, 8); c.fill(); c.strokeStyle = '#5e3a08'; c.stroke();
  c.restore();
}
function baton(c, s) {
  const u = s / 100; c.save(); c.scale(u, u); c.rotate(0.0);
  c.fillStyle = 'rgba(20,30,0,0.22)'; ell(c, 8, 6, 12, 58, 0.1); c.fill();
  const wood = lin(c, -20, 0, 20, 0, [[0, '#4a2a10'], [0.4, '#b57a3c'], [0.6, '#96602a'], [1, '#3a200c']]);
  c.fillStyle = wood; c.beginPath();
  c.moveTo(-8, 62); c.bezierCurveTo(-10, 30, -14, 10, -22, -14); c.bezierCurveTo(-30, -40, -20, -70, 0, -74);
  c.bezierCurveTo(20, -70, 30, -40, 22, -14); c.bezierCurveTo(14, 10, 10, 30, 8, 62); c.quadraticCurveTo(0, 68, -8, 62); c.fill();
  c.strokeStyle = '#2a1408'; c.lineWidth = 2.4; c.stroke();
  // knots and bark ridges
  c.fillStyle = '#4a2a10'; for (const [x, y, r] of [[-6, -48, 6], [8, -22, 5], [-4, 2, 4.5], [3, 34, 3.5]]) { ell(c, x, y, r, r * 0.8, 0.4); c.fill(); }
  c.strokeStyle = 'rgba(40,20,6,0.55)'; c.lineWidth = 1.6; for (const dx of [-12, 12]) { c.beginPath(); c.moveTo(dx * 0.9, -52); c.quadraticCurveTo(dx * 0.5, -10, dx * 0.4, 50); c.stroke(); }
  c.fillStyle = 'rgba(255,225,170,0.4)'; c.beginPath(); c.ellipse(-12, -34, 3.5, 22, 0.1, 0, TAU); c.fill();
  // a leafy sprig
  c.fillStyle = '#5e9a3a'; c.strokeStyle = '#25491a'; c.lineWidth = 1.6;
  for (const [x, y, a] of [[6, 22, 0.9], [-4, 8, -2.4], [-8, 40, -2.2]]) { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -10, 24, -3); c.quadraticCurveTo(10, 8, 0, 0); c.fill(); c.stroke(); c.restore(); }
  c.fillStyle = '#d8a232'; c.fillRect(-9, 50, 17, 4); c.strokeRect(-9, 50, 17, 4);
  c.restore();
}
const SUIT_FN = [coin, cup, sword, baton];
export function suitPic(c, suit, s) { SUIT_FN[suit](c, s); }

// ---- French-suit shapes (accessibility alternative) --------------------------------------------------------------
const FR = [
  (c, s) => { const r = s / 2; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * 0.55, -r * 0.25, r * 0.72, 0); c.quadraticCurveTo(r * 0.55, r * 0.25, 0, r); c.quadraticCurveTo(-r * 0.55, r * 0.25, -r * 0.72, 0); c.quadraticCurveTo(-r * 0.55, -r * 0.25, 0, -r); c.fill(); },                                   // diamond
  (c, s) => { const r = s / 2; c.beginPath(); c.moveTo(0, r * 0.92); c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.7, -r * 1.0, 0, -r * 0.35); c.bezierCurveTo(r * 0.7, -r * 1.0, r * 1.3, -r * 0.1, 0, r * 0.92); c.fill(); },                      // heart
  (c, s) => { const r = s / 2; c.beginPath(); c.moveTo(0, -r); c.bezierCurveTo(r * 1.2, -r * 0.1, r * 0.9, r * 0.6, r * 0.3, r * 0.45); c.quadraticCurveTo(r * 0.3, r * 0.75, r * 0.5, r * 0.95); c.lineTo(-r * 0.5, r * 0.95); c.quadraticCurveTo(-r * 0.3, r * 0.75, -r * 0.3, r * 0.45); c.bezierCurveTo(-r * 0.9, r * 0.6, -r * 1.2, -r * 0.1, 0, -r); c.fill(); }, // spade
  (c, s) => { const r = s / 2; for (const [x, y] of [[0, -r * 0.5], [-r * 0.52, r * 0.2], [r * 0.52, r * 0.2]]) { ell(c, x, y, r * 0.42, r * 0.42); c.fill(); } c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0, r * 0.6, -r * 0.3, r * 0.95); c.lineTo(r * 0.3, r * 0.95); c.quadraticCurveTo(0, r * 0.6, 0, 0); c.fill(); ell(c, 0, 0, r * 0.3, r * 0.3); c.fill(); },  // club
];
const FR_COL = ['#c8202a', '#c8202a', '#161616', '#161616'];       // coins=diamonds, cups=hearts, swords=spades, batons=clubs
function frSuit(c, suit, s) { c.save(); c.fillStyle = FR_COL[suit]; FR[suit === 0 ? 0 : suit === 1 ? 1 : suit === 2 ? 2 : 3](c, s); c.restore(); }

// ---- court figures: Fante (page), Cavallo (rider), Re (king). Original drawings, one per suit colour ------------
function face(c, cx, cy, r, skin = '#f0c9a0', mood = 0) {
  c.fillStyle = rad(c, cx, cy, 1, r * 1.1, [[0, '#ffe2c0'], [1, skin]], cx - r * 0.3, cy - r * 0.3); ell(c, cx, cy, r * 0.92, r); c.fill();
  c.strokeStyle = '#6a3c1c'; c.lineWidth = 1.8; c.stroke();
  c.fillStyle = 'rgba(225,110,90,0.35)'; ell(c, cx - r * 0.5, cy + r * 0.3, r * 0.22, r * 0.14); c.fill(); ell(c, cx + r * 0.5, cy + r * 0.3, r * 0.22, r * 0.14); c.fill();
  c.fillStyle = '#2a160c'; ell(c, cx - r * 0.32, cy - r * 0.05, r * 0.11, r * 0.15); c.fill(); ell(c, cx + r * 0.32, cy - r * 0.05, r * 0.11, r * 0.15); c.fill();
  c.strokeStyle = '#3a1e0c'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx - r * 0.55, cy - r * 0.3 - mood); c.lineTo(cx - r * 0.12, cy - r * 0.26); c.moveTo(cx + r * 0.55, cy - r * 0.3 - mood); c.lineTo(cx + r * 0.12, cy - r * 0.26); c.stroke();
  c.strokeStyle = '#9a5a3a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(cx + r * 0.16, cy + r * 0.22, cx - r * 0.02, cy + r * 0.26); c.stroke();
  c.strokeStyle = '#8a3030'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - r * 0.24, cy + r * 0.52); c.quadraticCurveTo(cx, cy + r * 0.62, cx + r * 0.24, cy + r * 0.52); c.stroke();
}
function held(c, suit, x, y, s, ang = 0) { c.save(); c.translate(x, y); c.rotate(ang); suitPic(c, suit, s); c.restore(); }
function hand(c, x, y) { c.fillStyle = '#f0c9a0'; ell(c, x, y, 7, 7); c.fill(); c.strokeStyle = '#6a3c1c'; c.lineWidth = 1.4; c.stroke(); }
function checkerFloor(c, y0, y1, a, b) {
  const n = 8, w = CW / n; c.fillStyle = a; c.fillRect(0, y0, CW, y1 - y0);
  for (let i = 0; i < n; i++) { c.fillStyle = (i % 2 ? a : b); c.fillRect(i * w, y0, w, (y1 - y0) / 2); c.fillStyle = (i % 2 ? b : a); c.fillRect(i * w, (y0 + y1) / 2, w, (y1 - y0) / 2); }
}
function fante(c, suit) {
  const P = SUIT_COL[suit];
  checkerFloor(c, 262, 296, '#e8d3a0', '#b9895a');
  c.save(); c.translate(100, 168);
  // legs in two colours, boots
  c.fillStyle = P.robe; c.fillRect(-26, 40, 22, 62); c.fillStyle = '#efe0b8'; c.fillRect(4, 40, 22, 62);
  c.strokeStyle = '#2a1408'; c.lineWidth = 2; c.strokeRect(-26, 40, 22, 62); c.strokeRect(4, 40, 22, 62);
  c.fillStyle = '#3a2010'; c.beginPath(); c.roundRect(-30, 96, 30, 14, 5); c.fill(); c.beginPath(); c.roundRect(2, 96, 30, 14, 5); c.fill();
  // tunic
  c.fillStyle = lin(c, -40, 0, 40, 0, [[0, P.robe2], [0.35, P.robe], [1, P.robe2]]);
  c.beginPath(); c.moveTo(-34, -20); c.lineTo(34, -20); c.lineTo(42, 52); c.quadraticCurveTo(0, 62, -42, 52); c.closePath(); c.fill(); c.strokeStyle = '#2a1408'; c.lineWidth = 2.2; c.stroke();
  c.fillStyle = '#f0c65a'; c.fillRect(-38, 22, 78, 8); c.fillStyle = '#fff0b0'; ell(c, 0, 26, 7, 7); c.fill();   // belt and buckle
  c.strokeStyle = '#f0c65a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-42, 52); c.quadraticCurveTo(0, 62, 42, 52); c.stroke();
  for (let i = -3; i <= 3; i++) { c.fillStyle = '#f0c65a'; ell(c, i * 12, 8, 2.4, 2.4); c.fill(); }
  // collar, arms
  c.fillStyle = '#f4ead0'; c.beginPath(); c.moveTo(-26, -20); c.lineTo(0, -8); c.lineTo(26, -20); c.lineTo(20, -30); c.lineTo(-20, -30); c.fill(); c.stroke();
  c.fillStyle = P.robe; c.beginPath(); c.moveTo(-34, -18); c.quadraticCurveTo(-58, 10, -52, 34); c.lineTo(-40, 34); c.quadraticCurveTo(-38, 8, -26, 0); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(34, -18); c.quadraticCurveTo(62, -14, 56, -48); c.lineTo(44, -48); c.quadraticCurveTo(46, -22, 26, -2); c.fill(); c.stroke();
  hand(c, -46, 38); hand(c, 50, -50);
  held(c, suit, 52, -84, suit === 2 ? 74 : 56, suit === 2 ? 0.15 : 0.1);
  // head with feathered beret
  face(c, 0, -52, 22);
  c.fillStyle = P.robe2; c.beginPath(); c.moveTo(-26, -66); c.quadraticCurveTo(-30, -96, 0, -98); c.quadraticCurveTo(34, -98, 30, -68); c.quadraticCurveTo(0, -80, -26, -66); c.fill(); c.strokeStyle = '#2a1408'; c.stroke();
  c.strokeStyle = '#f0c65a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-26, -68); c.quadraticCurveTo(0, -80, 30, -70); c.stroke();
  c.fillStyle = '#fff6e0'; c.strokeStyle = '#a8804a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(20, -90); c.bezierCurveTo(52, -120, 70, -96, 44, -74); c.bezierCurveTo(50, -92, 38, -100, 20, -90); c.fill(); c.stroke();
  c.fillStyle = '#f0c9a0'; c.fillStyle = '#5a2e12'; c.beginPath(); c.moveTo(-22, -60); c.quadraticCurveTo(-30, -44, -22, -30); c.quadraticCurveTo(-26, -50, -18, -62); c.fill();
  c.beginPath(); c.moveTo(22, -60); c.quadraticCurveTo(30, -44, 22, -30); c.quadraticCurveTo(26, -50, 18, -62); c.fill();
  c.restore();
}
function cavallo(c, suit) {
  const P = SUIT_COL[suit], coat = ['#9a5c2a', '#f1ece0', '#4a4a56', '#7a3f1c'][suit], coatD = ['#5e3212', '#b8b0a0', '#22222c', '#42200c'][suit];
  checkerFloor(c, 268, 300, '#e8d3a0', '#b9895a');
  c.save(); c.translate(96, 170);
  c.strokeStyle = '#1a0c04'; c.lineWidth = 2.2;
  // tail, legs
  c.strokeStyle = coatD; c.lineWidth = 9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-64, 30); c.bezierCurveTo(-96, 30, -90, 80, -84, 96); c.stroke();
  c.lineWidth = 12; for (const [x, y, x2, y2] of [[-44, 60, -50, 100], [-24, 64, -22, 100], [30, 62, 42, 96], [50, 56, 66, 92]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); }
  c.lineCap = 'butt'; c.fillStyle = '#231208'; for (const [x, y] of [[-50, 100], [-22, 100], [42, 96], [66, 92]]) { c.beginPath(); c.roundRect(x - 9, y - 2, 18, 10, 3); c.fill(); }
  // body, neck, head
  c.fillStyle = lin(c, 0, 10, 0, 70, [[0, coat], [1, coatD]]); c.strokeStyle = '#1a0c04'; c.lineWidth = 2.2;
  ell(c, 0, 42, 72, 34); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(34, 30); c.bezierCurveTo(56, 6, 62, -22, 66, -48); c.lineTo(88, -44); c.bezierCurveTo(100, -30, 96, -10, 78, 6); c.bezierCurveTo(70, 22, 66, 38, 62, 56); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(66, -50); c.bezierCurveTo(78, -66, 98, -58, 112, -40); c.bezierCurveTo(118, -32, 116, -22, 108, -24); c.bezierCurveTo(100, -28, 92, -34, 84, -40); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = coat; c.beginPath(); c.moveTo(70, -60); c.lineTo(74, -78); c.lineTo(82, -60); c.fill(); c.stroke();
  c.fillStyle = '#12080a'; ell(c, 84, -52, 3.2, 3.2); c.fill(); ell(c, 112, -32, 2.4, 2.4); c.fill();
  c.strokeStyle = P.main; c.lineWidth = 3; c.beginPath(); c.moveTo(98, -56); c.lineTo(108, -42); c.stroke();   // bridle
  c.fillStyle = coatD; c.beginPath(); c.moveTo(64, -50); c.bezierCurveTo(50, -46, 44, -20, 30, 6); c.lineTo(38, 10); c.bezierCurveTo(54, -12, 60, -30, 72, -44); c.fill();   // mane
  // saddle cloth
  c.fillStyle = P.robe2; c.beginPath(); c.moveTo(-34, 20); c.lineTo(34, 20); c.lineTo(38, 62); c.lineTo(-38, 62); c.closePath(); c.fill(); c.strokeStyle = '#1a0c04'; c.stroke();
  c.fillStyle = '#f0c65a'; c.fillRect(-38, 54, 76, 8); for (let i = -3; i <= 3; i++) { c.fillRect(i * 11 - 2, 62, 4, 9); }
  ell(c, 0, 40, 8, 8); c.fill();
  // rider
  c.fillStyle = lin(c, -26, 0, 26, 0, [[0, P.robe2], [0.4, P.robe], [1, P.robe2]]);
  c.beginPath(); c.moveTo(-18, -34); c.lineTo(18, -34); c.lineTo(24, 20); c.lineTo(-24, 20); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#f0c65a'; c.fillRect(-28, 4, 58, 7);
  c.fillStyle = '#efe0b8'; c.fillRect(30, 18, 14, 46); c.strokeRect(30, 18, 14, 46);   // leg
  c.fillStyle = '#3a2010'; c.beginPath(); c.roundRect(28, 60, 22, 12, 4); c.fill();
  c.fillStyle = P.robe; c.beginPath(); c.moveTo(20, -30); c.quadraticCurveTo(60, -24, 62, -6); c.lineTo(52, 0); c.quadraticCurveTo(46, -14, 18, -14); c.fill(); c.stroke();
  hand(c, 58, -6); held(c, suit, 62, -50, suit === 2 ? 80 : 56, suit === 2 ? 0.25 : 0.1);
  face(c, 0, -60, 20, '#f0c9a0', 1);
  // plumed helmet-hat
  c.fillStyle = P.main; c.beginPath(); c.moveTo(-24, -68); c.quadraticCurveTo(-26, -96, 0, -98); c.quadraticCurveTo(26, -96, 24, -68); c.quadraticCurveTo(0, -78, -24, -68); c.fill(); c.strokeStyle = '#1a0c04'; c.stroke();
  c.fillStyle = '#f0c65a'; c.beginPath(); c.moveTo(-26, -70); c.quadraticCurveTo(0, -82, 26, -70); c.lineTo(26, -74); c.quadraticCurveTo(0, -88, -26, -74); c.fill();
  c.fillStyle = '#fff6e0'; c.strokeStyle = '#a8804a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, -96); c.bezierCurveTo(-20, -130, -52, -118, -46, -92); c.bezierCurveTo(-40, -108, -22, -108, -6, -96); c.fill(); c.stroke();
  c.restore();
}
function re(c, suit) {
  const P = SUIT_COL[suit];
  c.fillStyle = 'rgba(80,40,10,0.18)'; c.beginPath(); c.moveTo(28, 300); c.lineTo(28, 120); c.quadraticCurveTo(100, 30, 172, 120); c.lineTo(172, 300); c.fill();          // throne arch
  c.strokeStyle = 'rgba(122,70,10,0.5)'; c.lineWidth = 3; c.stroke();
  checkerFloor(c, 268, 300, '#e8d3a0', '#b9895a');
  c.save(); c.translate(100, 170);
  // robe with ermine
  c.strokeStyle = '#1a0c04'; c.lineWidth = 2.2;
  c.fillStyle = lin(c, -60, 0, 60, 0, [[0, P.robe2], [0.4, P.robe], [1, P.robe2]]);
  c.beginPath(); c.moveTo(-42, -30); c.lineTo(42, -30); c.bezierCurveTo(74, 10, 78, 70, 82, 104); c.lineTo(-82, 104); c.bezierCurveTo(-78, 70, -74, 10, -42, -30); c.fill(); c.stroke();
  c.fillStyle = '#f2ecdc'; c.beginPath(); c.moveTo(-46, -34); c.quadraticCurveTo(0, -6, 46, -34); c.lineTo(58, -4); c.quadraticCurveTo(0, 26, -58, -4); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#231a18'; for (const [x, y] of [[-34, -12], [-14, 0], [8, 2], [30, -10], [46, -16], [-48, -16]]) { c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 3, y + 1); c.lineTo(x - 3, y + 1); c.fill(); }
  c.fillStyle = '#f2ecdc'; c.fillRect(-82, 92, 164, 14); c.strokeRect(-82, 92, 164, 14); c.fillStyle = '#231a18'; for (let x = -74; x < 80; x += 24) { c.beginPath(); c.moveTo(x, 94); c.lineTo(x + 3, 102); c.lineTo(x - 3, 102); c.fill(); }
  c.fillStyle = '#f0c65a'; c.fillRect(-4, 0, 8, 90); c.strokeRect(-4, 0, 8, 90);
  for (let y = 12; y < 86; y += 20) { c.fillStyle = '#fff0b0'; ell(c, 0, y, 6, 6); c.fill(); c.stroke(); }
  // sceptre (left) and the suit item (right)
  c.strokeStyle = '#6a4210'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-64, 84); c.lineTo(-60, -66); c.stroke(); c.lineCap = 'butt';
  c.fillStyle = lin(c, 0, -90, 0, -70, [[0, '#fff0b0'], [1, '#c98a1f']]); ell(c, -60, -74, 10, 10); c.fill(); c.strokeStyle = '#1a0c04'; c.lineWidth = 1.8; c.stroke();
  c.fillStyle = P.main; ell(c, -60, -74, 4, 4); c.fill();
  c.fillStyle = P.robe; c.beginPath(); c.moveTo(-36, -26); c.quadraticCurveTo(-64, -14, -62, 6); c.lineTo(-50, 6); c.quadraticCurveTo(-46, -8, -28, -10); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(36, -26); c.quadraticCurveTo(66, -10, 62, 20); c.lineTo(50, 20); c.quadraticCurveTo(50, -2, 28, -10); c.fill(); c.stroke();
  hand(c, -62, 6); hand(c, 56, 24);
  held(c, suit, 62, -14, suit === 2 ? 84 : 60, suit === 2 ? 0.2 : 0.12);
  // head: beard, crown
  c.fillStyle = '#d8d0c0'; c.beginPath(); c.moveTo(-20, -50); c.quadraticCurveTo(-30, -20, 0, -8); c.quadraticCurveTo(30, -20, 20, -50); c.closePath(); c.fill(); c.strokeStyle = '#7a6a5a'; c.lineWidth = 1.6; c.stroke();
  face(c, 0, -62, 21, '#efc59c', 0);
  c.fillStyle = '#d8d0c0'; c.beginPath(); c.moveTo(-17, -46); c.quadraticCurveTo(0, -36, 17, -46); c.quadraticCurveTo(0, -50, -17, -46); c.fill();   // moustache
  c.strokeStyle = '#1a0c04'; c.lineWidth = 2.2;
  c.fillStyle = lin(c, 0, -110, 0, -76, [[0, '#fff0b0'], [0.6, '#e6b23e'], [1, '#a8701a']]);
  c.beginPath(); c.moveTo(-26, -78); c.lineTo(-30, -108); c.lineTo(-14, -94); c.lineTo(0, -114); c.lineTo(14, -94); c.lineTo(30, -108); c.lineTo(26, -78); c.quadraticCurveTo(0, -70, -26, -78); c.fill(); c.stroke();
  for (const [x, y, col] of [[-30, -110, '#fff'], [0, -116, '#fff'], [30, -110, '#fff']]) { c.fillStyle = col; ell(c, x, y, 4.5, 4.5); c.fill(); c.stroke(); }
  c.fillStyle = P.main; for (const x of [-12, 0, 12]) { ell(c, x, -82, 4.2, 4.2); c.fill(); }
  c.restore();
}
const FACES = [null, null, null, null, null, null, null, null, fante, cavallo, re];

// ---- number-card pip layouts: [x, y] in a 100x230 field (origin centre); big Ace drawn separately -----------
const PIPS = {
  2: [[0, -66], [0, 66]], 3: [[0, -74], [0, 0], [0, 74]],
  4: [[-38, -58], [38, -58], [-38, 58], [38, 58]],
  5: [[-38, -66], [38, -66], [0, 0], [-38, 66], [38, 66]],
  6: [[-38, -74], [38, -74], [-38, 0], [38, 0], [-38, 74], [38, 74]],
  7: [[-38, -80], [38, -80], [-38, 6], [38, 6], [-38, 84], [38, 84], [0, -38]],
};
const PIPSIZE = [58, 58, 62, 62];

function paper(c, dark) {
  c.fillStyle = lin(c, 0, 0, CW, CH, [[0, '#fff8e6'], [0.6, '#f6e8c4'], [1, '#ecd8a8']]); c.beginPath(); c.roundRect(0, 0, CW, CH, 16); c.fill();
  const rnd = lcg(3); for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(150,110,50,${0.03 + rnd() * 0.05})`; c.fillRect(rnd() * CW, rnd() * CH, 1 + rnd() * 2, 1); }
  c.strokeStyle = dark; c.lineWidth = 3; c.beginPath(); c.roundRect(1.5, 1.5, CW - 3, CH - 3, 15); c.stroke();
}
function frame(c, suit) {
  const P = SUIT_COL[suit];
  c.strokeStyle = P.dark; c.lineWidth = 2.4; c.beginPath(); c.roundRect(10, 10, CW - 20, CH - 20, 9); c.stroke();
  c.strokeStyle = '#d8a232'; c.lineWidth = 1.6; c.beginPath(); c.roundRect(15, 15, CW - 30, CH - 30, 6); c.stroke();
  c.fillStyle = P.main; for (const [x, y] of [[15, 15], [CW - 15, 15], [15, CH - 15], [CW - 15, CH - 15]]) { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-4, -4, 8, 8); c.restore(); }
}
function index(c, suit, rank, french) {
  const P = SUIT_COL[suit], lbl = french && rank > 7 ? 'JQK'[rank - 8] : rank === 1 ? 'A' : String(rank > 7 && !french ? ['F', 'C', 'R'][rank - 8] : rank);
  for (const flip of [false, true]) {
    c.save(); if (flip) { c.translate(CW, CH); c.rotate(Math.PI); }
    c.textAlign = 'center'; c.font = `700 36px ${FONT}`; c.fillStyle = french ? FR_COL[suit] : P.dark; c.fillText(lbl, 32, 58);
    if (french) { c.save(); c.translate(32, 78); frSuit(c, suit, 20); c.restore(); } else { c.save(); c.translate(32, 80); suitPic(c, suit, 22); c.restore(); }
    c.restore();
  }
}
function ace(c, suit) {
  const P = SUIT_COL[suit];
  c.save(); c.translate(CW / 2, CH / 2 - 4);
  c.strokeStyle = P.main; c.lineWidth = 3; c.fillStyle = P.light; c.globalAlpha = 0.35;
  ell(c, 0, 0, 74, 110); c.fill(); c.globalAlpha = 1; ell(c, 0, 0, 74, 110); c.stroke();
  c.strokeStyle = '#d8a232'; c.lineWidth = 2; ell(c, 0, 0, 68, 103); c.stroke();
  // leafy scrolls up both sides
  c.fillStyle = P.dark; for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) { const y = 70 - i * 22, x = sx * (70 - Math.sin(i / 6 * Math.PI) * 4); c.save(); c.translate(x, y); c.rotate(sx * (-0.9) + (i % 2 ? 0.5 : 0)); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -10, 22, -2); c.quadraticCurveTo(10, 8, 0, 0); c.fill(); c.restore(); }
  suitPic(c, suit, suit === 2 ? 168 : suit === 3 ? 150 : 128);
  c.restore();
  // ribbon
  c.fillStyle = P.main; c.strokeStyle = P.dark; c.lineWidth = 2; c.beginPath(); c.moveTo(34, 262); c.lineTo(166, 262); c.lineTo(154, 275); c.lineTo(166, 288); c.lineTo(34, 288); c.lineTo(46, 275); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#f0c65a'; for (let i = 0; i < 5; i++) { ell(c, 64 + i * 18, 275, 3, 3); c.fill(); }
}

function paintFace(c, id, french) {
  const suit = suitOf(id), rank = rankOf(id), P = SUIT_COL[suit];
  paper(c, french ? '#444' : P.dark);
  if (french) {
    c.strokeStyle = '#cbbf9a'; c.lineWidth = 2; c.beginPath(); c.roundRect(12, 12, CW - 24, CH - 24, 8); c.stroke();
    index(c, suit, rank, true);
    c.save(); c.translate(CW / 2, CH / 2);
    if (rank > 7) {
      c.fillStyle = 'rgba(0,0,0,0.05)'; c.beginPath(); c.roundRect(-56, -110, 112, 220, 10); c.fill();
      c.textAlign = 'center'; c.font = `700 120px ${FONT}`; c.fillStyle = FR_COL[suit]; c.fillText('JQK'[rank - 8], 0, 22);
      c.save(); c.translate(0, 62); frSuit(c, suit, 46); c.restore();
      c.save(); c.translate(0, -78); c.fillStyle = '#d8a232'; c.strokeStyle = '#6a4a10'; c.lineWidth = 2;
      if (rank === 10) { c.beginPath(); c.moveTo(-30, 12); c.lineTo(-34, -14); c.lineTo(-16, 0); c.lineTo(0, -20); c.lineTo(16, 0); c.lineTo(34, -14); c.lineTo(30, 12); c.closePath(); c.fill(); c.stroke(); }
      else if (rank === 9) { c.beginPath(); c.moveTo(-26, 12); c.lineTo(-20, -8); c.lineTo(0, 4); c.lineTo(20, -8); c.lineTo(26, 12); c.closePath(); c.fill(); c.stroke(); ell(c, 0, -14, 6, 6); c.fill(); }
      else { c.beginPath(); c.moveTo(-26, 12); c.quadraticCurveTo(-6, -22, 28, -6); c.quadraticCurveTo(6, 4, 26, 12); c.closePath(); c.fill(); c.stroke(); }
      c.restore();
    } else if (rank === 1) { frSuit(c, suit, 120); }
    else for (const [x, y] of PIPS[rank]) { c.save(); c.translate(x * 1.1, y); if (y > 0) c.rotate(Math.PI); frSuit(c, suit, 50); c.restore(); }
    c.restore();
    return;
  }
  frame(c, suit); index(c, suit, rank, false);
  if (rank > 7) {
    c.fillStyle = P.light; c.globalAlpha = 0.3; c.beginPath(); c.roundRect(32, 32, CW - 64, CH - 64, 6); c.fill(); c.globalAlpha = 1;
    c.save(); c.beginPath(); c.roundRect(32, 32, CW - 64, CH - 64, 6); c.clip(); c.translate(0, -4); c.scale(0.86, 0.86); c.translate(14, 22); FACES[rank](c, suit); c.restore();
    c.strokeStyle = P.dark; c.lineWidth = 1.8; c.beginPath(); c.roundRect(32, 32, CW - 64, CH - 64, 6); c.stroke();
  } else if (rank === 1) ace(c, suit);
  else {
    c.save(); c.translate(CW / 2 + 4, CH / 2);
    for (const [x, y] of PIPS[rank]) { c.save(); c.translate(x, y); const lean = suit === 2 ? (x < 0 ? -0.22 : x > 0 ? 0.22 : 0) : suit === 3 ? (x < 0 ? -0.5 : x > 0 ? 0.5 : 0) : 0; c.rotate(lean + (y > 0 && suit === 1 && false ? Math.PI : 0)); suitPic(c, suit, PIPSIZE[suit] * (suit === 2 ? 1.12 : suit === 3 ? 1.1 : 1)); c.restore(); }
    c.restore();
  }
}
function paintBack(c) {
  c.fillStyle = lin(c, 0, 0, CW, CH, [[0, '#8e1f2a'], [1, '#5a0f18']]); c.beginPath(); c.roundRect(0, 0, CW, CH, 16); c.fill();
  c.strokeStyle = '#f0d58a'; c.lineWidth = 3; c.beginPath(); c.roundRect(9, 9, CW - 18, CH - 18, 10); c.stroke();
  c.save(); c.beginPath(); c.roundRect(16, 16, CW - 32, CH - 32, 7); c.clip();
  c.strokeStyle = 'rgba(240,213,138,0.5)'; c.lineWidth = 2; for (let k = -12; k < 24; k++) { c.beginPath(); c.moveTo(k * 24, 0); c.lineTo(k * 24 + 320, 320); c.moveTo(k * 24 + 320, 0); c.lineTo(k * 24, 320); c.stroke(); }
  c.restore();
  c.translate(CW / 2, CH / 2);
  c.fillStyle = '#5a0f18'; ell(c, 0, 0, 52, 52); c.fill(); c.strokeStyle = '#f0d58a'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#f0d58a'; for (let i = 0; i < 8; i++) { c.save(); c.rotate((i / 8) * TAU); c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(12, -28, 0, -44); c.quadraticCurveTo(-12, -28, 0, -12); c.fill(); c.restore(); }
  ell(c, 0, 0, 8, 8); c.fill();
}

const faceCache = new Map(), scale = CS;
function bake(key, fn) {
  if (faceCache.has(key)) return faceCache.get(key);
  const L = mk(Math.round(CW * scale), Math.round(CH * scale)); if (!L) return null;
  L.x.scale(scale, scale); fn(L.x); faceCache.set(key, L.c); return L.c;
}
// Draw one card (face-up or back) with its centre at (x, y), width w. `french` picks the accessibility deck.
export function drawCard(ctx, id, x, y, w, rot = 0, opt = {}) {
  const k = w / CW, h = CH * k, img = id < 0 ? bake('back', paintBack) : bake((opt.french ? 'f' : 'i') + id, (c) => paintFace(c, id, opt.french));
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  if (opt.shadow !== false) { ctx.fillStyle = `rgba(20,6,0,${opt.lift ? 0.28 : 0.4})`; ctx.beginPath(); ctx.roundRect(-w / 2 + 2 + (opt.lift ? 6 : 0), -h / 2 + 5 + (opt.lift ? 12 : 0), w, h, 16 * k); ctx.fill(); }
  if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  else { ctx.fillStyle = '#f6e8c4'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16 * k); ctx.fill(); }
  ctx.restore();
}
export function warm(n, french) { let i = 0; for (; i < 4; i++) { const id = n + i; if (id < 40) bake((french ? 'f' : 'i') + id, (c) => paintFace(c, id, french)); } bake('back', paintBack); return n + 4; }
export function drawSuitIcon(ctx, suit, x, y, s, french) { ctx.save(); ctx.translate(x, y); if (french) frSuit(ctx, suit, s); else suitPic(ctx, suit, s); ctx.restore(); }

// ---- the trattoria table -----------------------------------------------------------------------------------------
let tableLayer = null, tableKey = '';
function paintTable(c) {
  const rnd = lcg(11);
  // night sky and rooftops of a small piazza
  c.fillStyle = lin(c, 0, 0, 0, 200, [[0, '#0f1330'], [0.55, '#3a2650'], [1, '#c8683c']]); c.fillRect(0, 0, W, 200);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,240,200,${0.25 + rnd() * 0.5})`; c.fillRect(rnd() * W, rnd() * 80, 1.6, 1.6); }
  const bld = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, 200 - y); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y, w, 4); };
  for (const [x, y, w, col] of [[0, 96, 90, '#2a1a30'], [80, 70, 74, '#33203a'], [150, 110, 96, '#241628'], [240, 60, 84, '#301c34'], [318, 92, 100, '#261730'], [412, 66, 80, '#341e38'], [488, 104, 90, '#241628'], [574, 74, 146, '#2e1a32']]) {
    bld(x, y, w, 0, col); c.fillStyle = col; c.fillRect(x, y, w, 200 - y);
    for (let wx = x + 12; wx < x + w - 14; wx += 26) for (let wy = y + 16; wy < 176; wy += 30) { const lit = rnd() < 0.55; c.fillStyle = lit ? 'rgba(255,196,96,0.9)' : 'rgba(20,10,30,0.7)'; c.fillRect(wx, wy, 11, 16); if (lit) { c.fillStyle = 'rgba(255,196,96,0.16)'; c.fillRect(wx - 4, wy - 3, 19, 22); } }
  }
  // wooden table: planks
  const wood = lin(c, 0, 190, 0, H, [[0, '#7a4524'], [0.5, '#5e3216'], [1, '#3e200c']]); c.fillStyle = wood; c.fillRect(0, 190, W, H - 190);
  for (let x = 0; x < W; x += 120) { c.fillStyle = 'rgba(0,0,0,0.32)'; c.fillRect(x, 190, 3, H - 190); c.fillStyle = 'rgba(255,200,140,0.1)'; c.fillRect(x + 3, 190, 2, H - 190); }
  for (let i = 0; i < 260; i++) { const x = rnd() * W, y = 200 + rnd() * (H - 200), l = 60 + rnd() * 260; c.strokeStyle = `rgba(${rnd() < 0.5 ? '30,12,2' : '255,200,140'},${0.05 + rnd() * 0.07})`; c.lineWidth = 1 + rnd() * 1.6; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 2, y + l * 0.3, x - 3, y + l * 0.6, x + 1, y + l); c.stroke(); }
  // the table's far edge
  c.fillStyle = lin(c, 0, 178, 0, 214, [[0, '#a56a38'], [0.25, '#7a4524'], [1, '#3a1e0c']]); c.fillRect(0, 178, W, 32);
  c.fillStyle = 'rgba(255,220,160,0.5)'; c.fillRect(0, 178, W, 3); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(0, 210, W, 8);
  // gingham cloth
  const CX = 26, CY = 356, CWd = 668, CHt = 674, sq = 38;
  c.save(); c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.roundRect(CX + 4, CY + 10, CWd, CHt, 26); c.fill();
  c.beginPath(); c.roundRect(CX, CY, CWd, CHt, 24); c.clip();
  c.fillStyle = '#f5ead0'; c.fillRect(CX, CY, CWd, CHt);
  c.fillStyle = 'rgba(190,36,44,0.62)'; for (let x = 0; x * sq < CWd; x++) c.fillRect(CX + x * sq, CY, sq, CHt);
  c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(190,36,44,0.0)'; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#f5ead0'; for (let y = 0; y * sq < CHt; y++) for (let x = 0; x * sq < CWd; x++) if ((x + y) % 2 === 0) c.fillRect(CX + x * sq, CY + y * sq, sq, sq);
  c.fillStyle = 'rgba(190,36,44,0.6)'; for (let y = 0; y * sq < CHt; y++) for (let x = 0; x * sq < CWd; x++) if ((x + y) % 2 === 1) c.fillRect(CX + x * sq, CY + y * sq, sq, sq);
  c.fillStyle = 'rgba(190,36,44,0.34)'; for (let y = 0; y * sq < CHt; y++) for (let x = 0; x * sq < CWd; x++) if ((x + y) % 2 === 0) { c.fillRect(CX + x * sq, CY + y * sq, sq, sq); }
  // weave
  for (let y = CY; y < CY + CHt; y += 3) { c.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.03})`; c.fillRect(CX, y, CWd, 1); }
  for (let x = CX; x < CX + CWd; x += 3) { c.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.03})`; c.fillRect(x, CY, 1, CHt); }
  // soft wrinkles / folds
  for (const [x0, y0, x1, y1] of [[CX, CY + 250, CX + CWd, CY + 220], [CX + 200, CY, CX + 240, CY + CHt]]) { c.strokeStyle = 'rgba(0,0,0,0.05)'; c.lineWidth = 14; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 6; c.beginPath(); c.moveTo(x0, y0 - 9); c.lineTo(x1, y1 - 9); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(120,20,26,0.9)'; c.lineWidth = 3.5; c.beginPath(); c.roundRect(CX + 12, CY + 12, CWd - 24, CHt - 24, 16); c.stroke();
  c.strokeStyle = 'rgba(255,240,210,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(CX + 18, CY + 18, CWd - 36, CHt - 36, 12); c.stroke();
  // light: warm pools from the festoon lights, dark vignette
  const g = rad(c, W / 2, 700, 40, 900, [[0, 'rgba(255,200,120,0.16)'], [0.5, 'rgba(255,170,90,0.04)'], [1, 'rgba(10,2,10,0.62)']]); c.fillStyle = g; c.fillRect(0, 190, W, H - 190);
  const v = rad(c, W / 2, H / 2, 500, 1100, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(6,0,10,0.55)']]); c.fillStyle = v; c.fillRect(0, 0, W, H);
}
export function drawTable(ctx, t = 0, calm = false) {
  if (!tableLayer) { const L = mk(Math.round(W * CS), Math.round(H * CS)); if (L) { L.x.scale(CS, CS); paintTable(L.x); tableLayer = L.c; } }
  if (tableLayer) ctx.drawImage(tableLayer, 0, 0, W, H); else { ctx.fillStyle = '#4a2810'; ctx.fillRect(0, 0, W, H); }
  // festoon lights: a swaying string of bulbs with a soft flicker, and a candle lantern flame
  for (let row = 0; row < 2; row++) {
    const y0 = 18 + row * 34;
    ctx.strokeStyle = 'rgba(20,10,10,0.9)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += 20) { const y = y0 + Math.sin((x / W) * Math.PI * (3 - row)) * 14 + 22 * (1 - Math.abs(x / W - 0.5) * 2) * 0; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    for (let x = 30 + row * 26; x < W; x += 52) {
      const y = y0 + Math.sin((x / W) * Math.PI * (3 - row)) * 14 + 8, f = calm ? 0.9 : 0.8 + 0.2 * Math.sin(t * 3 + x * 0.3 + row);
      ctx.fillStyle = rad(ctx, x, y, 1, 26, [[0, `rgba(255,224,150,${0.55 * f})`], [1, 'rgba(255,200,120,0)']]); ctx.fillRect(x - 26, y - 26, 52, 52);
      ctx.fillStyle = `rgba(255,${226 - row * 30},${150 - row * 30},1)`; ctx.beginPath(); ctx.ellipse(x, y, 5.2, 6.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x - 2, y - 4, 2, 2.6);
    }
  }
}
