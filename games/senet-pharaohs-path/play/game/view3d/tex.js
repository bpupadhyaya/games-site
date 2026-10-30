// Procedural canvas textures for the Senet chamber (no image files): ivory tile atlas with the board's own ornaments, ebony grain,
// reed mat, dyed linen, faience speckle, stick faces, soft blobs/glows/flames. All seeded, so every run paints the same pixels.
import { lcg, rosette, diamond, zigzag, dots, goldGrad } from '../src/art.js';

const TAU = Math.PI * 2;
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

// ---- the 30 squares: an atlas of 6 x 5 tiles, each TW x TH px, tile i at column i % 6, row floor(i / 6) ----------------------------
export const ATLAS = { cols: 6, rows: 5, tw: 288, th: 192 };
export function atlasUv(i) { const { cols, rows } = ATLAS; return [1 / cols, 1 / rows, (i % cols) / cols, Math.floor(i / cols) / rows]; }
export function tileAtlas(numbers = true) {
  const { cols, rows, tw, th } = ATLAS, cv = mk(cols * tw, rows * th), c = cv.getContext('2d');
  for (let i = 0; i < 30; i++) { c.save(); c.translate((i % cols) * tw, Math.floor(i / cols) * th); paintTile(c, i, tw, th, numbers); c.restore(); }
  return cv;
}
function paintTile(c, i, w, h, numbers = true) {
  const R = lcg(100 + i), special = [14, 25, 26, 27, 28, 29].includes(i);
  // aged ivory / bone: warm, faintly banded, never pure white
  const g = c.createLinearGradient(0, 0, w * 0.5, h);
  g.addColorStop(0, i % 2 ? '#efe2c3' : '#f3e7cb'); g.addColorStop(1, i % 2 ? '#d9c79c' : '#ddcca5');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 26; k++) {   // growth lines of the bone, running lengthwise
    c.strokeStyle = `rgba(${R() < 0.6 ? '140,104,58' : '255,252,240'},${0.05 + R() * 0.09})`; c.lineWidth = 0.6 + R() * 1.4;
    const y = R() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 10, w * 0.7, y + (R() - 0.5) * 10, w, y + (R() - 0.5) * 8); c.stroke();
  }
  for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(110,80,40,${0.04 + R() * 0.06})`; c.beginPath(); c.arc(R() * w, R() * h, 0.6 + R() * 2.2, 0, TAU); c.fill(); }
  if (special) {
    const tint = i === 26 ? 'rgba(40,110,190,0.30)' : i === 14 || i === 25 ? 'rgba(220,170,60,0.22)' : 'rgba(205,150,60,0.16)';
    c.fillStyle = tint; c.fillRect(0, 0, w, h);
  }
  // incised border line + corner studs
  const m = 13;
  c.strokeStyle = 'rgba(70,44,18,0.55)'; c.lineWidth = 2.4; rr(c, m, m, w - 2 * m, h - 2 * m, 6); c.stroke();
  c.strokeStyle = 'rgba(255,250,230,0.55)'; c.lineWidth = 1.2; rr(c, m + 1.6, m + 1.6, w - 2 * m, h - 2 * m, 6); c.stroke();
  if (special) { c.strokeStyle = goldGrad(c, 0, h); c.lineWidth = 3; rr(c, m + 6, m + 6, w - 2 * m - 12, h - 2 * m - 12, 5); c.stroke(); }
  for (const [px, py] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) {
    const sg = c.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, 5); sg.addColorStop(0, '#fff2b8'); sg.addColorStop(0.6, '#d3a33c'); sg.addColorStop(1, '#7a5212');
    c.fillStyle = sg; c.beginPath(); c.arc(px, py, 4.6, 0, TAU); c.fill();
  }
  // ornaments either side of the middle, where a piece standing on the square never hides them
  const s = h / 88, cy = h / 2 + 4, lx = w / 2 - 92 * s * 0.62, rx = w / 2 + 92 * s * 0.62;
  c.save();
  if (i === 14 || i === 25) { const f = i === 14 ? rosette : diamond, r = (i === 14 ? 22 : 20) * s * 0.78; f(c, lx, cy, r); f(c, rx, cy, r); }
  else if (i === 26) { c.save(); c.translate(lx, cy); c.scale(s * 0.8, s * 0.8); zigzag(c, 0, 0, 40); c.restore(); c.save(); c.translate(rx, cy); c.scale(s * 0.8, s * 0.8); zigzag(c, 0, 0, 40); c.restore(); }
  else if (i >= 27) { const n = 30 - i; c.save(); c.translate(lx, cy); c.scale(s * 0.62, s * 0.62); dots(c, 0, 0, n); c.restore(); c.save(); c.translate(rx, cy); c.scale(s * 0.62, s * 0.62); dots(c, 0, 0, n); c.restore(); }
  c.restore();
  // the square number, inked into the bone (upper left)
  if (!numbers) return;
  c.font = `700 ${Math.round(h * 0.25)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; c.textBaseline = 'top'; c.textAlign = 'left';
  c.fillStyle = 'rgba(255,250,235,0.6)'; c.fillText(String(i + 1), m + 10, m + 9);
  c.fillStyle = 'rgba(78,46,18,0.86)'; c.fillText(String(i + 1), m + 9, m + 8);
}

// ---- woods, cloth, mat -------------------------------------------------------------------------------------------------------------
export function woodTex(seed, c0, c1, w = 512, h = 512, rings = 60) {
  const cv = mk(w, h), c = cv.getContext('2d'), R = lcg(seed);
  c.fillStyle = c0; c.fillRect(0, 0, w, h);
  for (let i = 0; i < rings; i++) {   // long grain, lengthwise along x, wrapping in y so the map tiles
    const y = R() * h, amp = 3 + R() * 9, ph = R() * TAU, lw = 0.6 + R() * 2.6;
    c.strokeStyle = R() < 0.5 ? c1 : `rgba(0,0,0,${0.15 + R() * 0.3})`; c.globalAlpha = 0.25 + R() * 0.45; c.lineWidth = lw;
    for (const dy of [-h, 0, h]) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + dy + Math.sin(x / w * TAU * 2 + ph) * amp); c.stroke(); }
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.12})`; c.fillRect(R() * w, R() * h, 1 + R() * 10, 1); }
  return cv;
}
export function matTex() {   // woven reed: 16 px cells in a 256 px tile (tiles seamlessly)
  const N = 256, S = 16, cv = mk(N, N), c = cv.getContext('2d'), R = lcg(19);
  for (let gy = 0; gy < N / S; gy++) for (let gx = 0; gx < N / S; gx++) {
    const x = gx * S, y = gy * S, horiz = (gx + gy) % 2 === 0, tone = 150 + R() * 40;
    const g = horiz ? c.createLinearGradient(0, y, 0, y + S) : c.createLinearGradient(x, 0, x + S, 0);
    g.addColorStop(0, `rgb(${tone + 34},${tone - 8},${tone - 72})`); g.addColorStop(0.5, `rgb(${tone + 8},${tone - 32},${tone - 92})`); g.addColorStop(1, `rgb(${tone - 40},${tone - 66},${tone - 112})`);
    c.fillStyle = g; c.fillRect(x, y, S, S);
    c.strokeStyle = 'rgba(40,22,8,0.45)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
    c.strokeStyle = 'rgba(255,225,160,0.22)'; c.beginPath();
    if (horiz) { c.moveTo(x + 2, y + 5); c.lineTo(x + S - 2, y + 5); } else { c.moveTo(x + 5, y + 2); c.lineTo(x + 5, y + S - 2); }
    c.stroke();
  }
  return cv;
}
export function linenTex() {
  const N = 256, cv = mk(N, N), c = cv.getContext('2d'), R = lcg(41);
  c.fillStyle = '#6a2618'; c.fillRect(0, 0, N, N);
  for (let x = 0; x < N; x += 4) { c.fillStyle = `rgba(255,190,140,${0.04 + R() * 0.07})`; c.fillRect(x, 0, 2, N); }
  for (let y = 0; y < N; y += 4) { c.fillStyle = `rgba(0,0,0,${0.06 + R() * 0.08})`; c.fillRect(0, y, N, 2); }
  return cv;
}
export function faienceTex(seed) {   // glaze speckle + fine crazing, mostly white so the material colour shows through
  const N = 256, cv = mk(N, N), c = cv.getContext('2d'), R = lcg(seed);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, N, N);
  for (let i = 0; i < 60; i++) {   // hand-made faience: soft mottling where the glaze ran thicker or thinner
    const x = R() * N, y = R() * N, r = 8 + R() * 30, g = c.createRadialGradient(x, y, 0, x, y, r), dark = R() < 0.6;
    g.addColorStop(0, dark ? 'rgba(0,40,50,0.16)' : 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; for (const dx of [-N, 0, N]) c.fillRect(x + dx - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 900; i++) { c.fillStyle = R() < 0.55 ? `rgba(255,255,255,${R() * 0.9})` : `rgba(10,30,40,${0.06 + R() * 0.16})`; c.beginPath(); c.arc(R() * N, R() * N, 0.4 + R() * 1.3, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(0,30,40,0.10)'; c.lineWidth = 0.7;
  for (let i = 0; i < 40; i++) { let x = R() * N, y = R() * N; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; c.lineTo(x, y); } c.stroke(); }
  // a band of darker glaze where it pooled toward the foot (v near 0 = bottom)
  const g = c.createLinearGradient(0, 0, 0, N); g.addColorStop(0, 'rgba(0,20,30,0.25)'); g.addColorStop(0.25, 'rgba(0,20,30,0)'); c.fillStyle = g; c.fillRect(0, 0, N, N);
  return cv;
}
// Stick faces (u along the length, v across). Light: bleached ivory-white wood with painted dark tips and two gilt bands; dark: ebony.
export function stickFaceTex() {
  const w = 512, h = 64, cv = mk(w, h), c = cv.getContext('2d'), R = lcg(11);
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f8efda'); g.addColorStop(0.5, '#efe1bf'); g.addColorStop(1, '#d9c495');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { c.strokeStyle = `rgba(130,96,50,${0.08 + R() * 0.12})`; c.lineWidth = 0.8; const y = R() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w / 3, y + (R() - 0.5) * 4, 2 * w / 3, y + (R() - 0.5) * 4, w, y); c.stroke(); }
  c.fillStyle = '#2a1a10'; c.fillRect(0, 0, 34, h); c.fillRect(w - 34, 0, 34, h);       // painted dark tips
  c.fillStyle = '#c9952e'; c.fillRect(92, 0, 7, h); c.fillRect(w - 99, 0, 7, h);            // gilt bands
  c.fillStyle = 'rgba(255,240,190,0.6)'; c.fillRect(92, 0, 2, h); c.fillRect(w - 99, 0, 2, h);
  return cv;
}
export function stickBackTex() {
  const cv = woodTex(12, '#2b1a11', 'rgba(150,110,80,0.6)', 512, 64, 18), c = cv.getContext('2d');
  c.fillStyle = 'rgba(232,200,120,0.85)'; c.fillRect(92, 0, 6, 64); c.fillRect(512 - 98, 0, 6, 64);
  for (let k = 0; k < 5; k++) c.fillRect(236 + k * 9, 0, 3, 64);   // carved notches across the back
  return cv;
}
// Soft radial blob (contact shadows: dark centre on white, for multiply) and glow (white centre on transparent, for add).
export function blobTex() {
  const N = 128, cv = mk(N, N), c = cv.getContext('2d'), g = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgb(70,58,48)'); g.addColorStop(0.45, 'rgb(140,124,110)'); g.addColorStop(1, 'rgb(255,255,255)');
  c.fillStyle = g; c.fillRect(0, 0, N, N); return cv;
}
export function glowTex() {
  const N = 128, cv = mk(N, N), c = cv.getContext('2d'), g = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, N, N); return cv;
}
// A rounded-rectangle glow ring for legal-move inlays (white, tinted per use).
export function inlayTex() {
  const w = 256, h = 176, cv = mk(w, h), c = cv.getContext('2d');
  for (let k = 0; k < 6; k++) { c.strokeStyle = `rgba(255,255,255,${0.12 + k * 0.06})`; c.lineWidth = 16 - k * 2.4; rr(c, 18, 18, w - 36, h - 36, 18); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,1)'; c.lineWidth = 3; rr(c, 20, 20, w - 40, h - 40, 16); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.10)'; rr(c, 22, 22, w - 44, h - 44, 14); c.fill();
  return cv;
}
export function flameTex() {
  const w = 64, h = 128, cv = mk(w, h), c = cv.getContext('2d');
  const g = c.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.5);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,205,110,0.95)'); g.addColorStop(0.6, 'rgba(255,130,40,0.5)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, 4); c.bezierCurveTo(w * 0.86, h * 0.45, w * 0.92, h * 0.8, w / 2, h - 4); c.bezierCurveTo(w * 0.08, h * 0.8, w * 0.14, h * 0.45, w / 2, 4); c.fill();
  return cv;
}
export function waterTex() {   // tiling ripple pattern: bright caustic lines on deep Nile blue
  const N = 256, cv = mk(N, N), c = cv.getContext('2d'), R = lcg(27);
  c.fillStyle = '#1f5a8c'; c.fillRect(0, 0, N, N);
  for (let i = 0; i < 70; i++) {
    const y = R() * N, amp = 3 + R() * 6, ph = R() * TAU;
    c.strokeStyle = `rgba(${R() < 0.5 ? '170,220,255' : '10,40,80'},${0.2 + R() * 0.4})`; c.lineWidth = 1 + R() * 2.5;
    for (const dy of [-N, 0, N]) { c.beginPath(); for (let x = 0; x <= N; x += 4) c.lineTo(x, y + dy + Math.sin(x / N * TAU * 3 + ph) * amp); c.stroke(); }
  }
  return cv;
}

// Screen vignette for multiply: white in the middle, warm dark at the corners.
export function vignetteTex() {
  const N = 256, cv = mk(N, N), c = cv.getContext('2d'), g = c.createRadialGradient(N / 2, N * 0.48, N * 0.22, N / 2, N / 2, N * 0.75);
  g.addColorStop(0, 'rgb(255,255,255)'); g.addColorStop(0.55, 'rgb(225,214,200)'); g.addColorStop(1, 'rgb(70,48,32)');
  c.fillStyle = g; c.fillRect(0, 0, N, N); return cv;
}

// Icon backdrop: a warm glow behind the subject fading to a deep chamber brown, with out-of-focus lamp lights.
export function iconBackTex() {
  const N = 1024, cv = mk(N, N), c = cv.getContext('2d'), R = lcg(5);
  const g = c.createRadialGradient(N * 0.62, N * 0.26, 10, N * 0.5, N * 0.45, N * 0.85);
  g.addColorStop(0, '#d98a3a'); g.addColorStop(0.35, '#7a3a14'); g.addColorStop(0.75, '#2a1206'); g.addColorStop(1, '#120603');
  c.fillStyle = g; c.fillRect(0, 0, N, N);
  for (let i = 0; i < 9; i++) {
    const x = N * (0.12 + R() * 0.8), y = N * (0.06 + R() * 0.3), r = N * (0.03 + R() * 0.06), b = c.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, `rgba(255,${190 + R() * 40 | 0},120,${0.25 + R() * 0.3})`); b.addColorStop(0.8, 'rgba(255,170,90,0.12)'); b.addColorStop(1, 'rgba(255,160,80,0)');
    c.fillStyle = b; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  return cv;
}
