// Procedural textures for the 3D board (no image files): teak grain, floorboards, the batik cloth, cowrie shells, glow rings, char.
import * as THREE from '../vendor3d/three.js';

const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
function tex(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Oiled teak / mahogany: long grain running down the board (canvas y = the boat's length), pores, a few darker heartwood streaks.
export function woodTex(c0, c1, seed = 7, size = 512) {
  const c = cv(size), x = c.getContext('2d'), b = cv(size), bx = b.getContext('2d'), r = rng(seed);
  const g = x.createLinearGradient(0, 0, size, 0); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c0);
  x.fillStyle = g; x.fillRect(0, 0, size, size); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  for (let i = 0; i < 14; i++) { const x0 = r() * size, w = 20 + r() * 60, gg = x.createLinearGradient(x0, 0, x0 + w, 0), col = r() < 0.6 ? '40,18,4' : '255,220,170', al = 0.03 + r() * 0.05; gg.addColorStop(0, `rgba(${col},0)`); gg.addColorStop(0.5, `rgba(${col},${al})`); gg.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gg; x.fillRect(x0, 0, w, size); }
  for (let i = 0; i < 190; i++) {
    const x0 = r() * size, amp = 1 + r() * 6, ph = r() * TAU, fr = 0.006 + r() * 0.02, w = 0.4 + r() * 1.8, a = 0.06 + r() * 0.2, dark = r() < 0.75;
    for (const [ctx, col] of [[x, dark ? `rgba(45,20,5,${a})` : `rgba(255,228,180,${a * 0.6})`], [bx, dark ? `rgba(0,0,0,${a * 1.5})` : `rgba(255,255,255,${a})`]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let s = 0; s <= size; s += 8) { const xx = x0 + Math.sin(s * fr + ph) * amp + Math.sin(s * fr * 3.1 + ph) * amp * 0.25; s ? ctx.lineTo(xx, s) : ctx.moveTo(xx, s); }
      ctx.stroke();
    }
  }
  for (let i = 0; i < 2600; i++) { const px = r() * size, py = r() * size; x.fillStyle = 'rgba(30,12,2,0.22)'; x.fillRect(px, py, 0.8, 2 + r() * 4); bx.fillStyle = 'rgba(0,0,0,0.35)'; bx.fillRect(px, py, 0.8, 3); }
  return { map: tex(c, { repeat: [0.22, 0.11] }), bump: tex(b, { repeat: [0.22, 0.11], srgb: false }) };
}

// Dark teak floorboards (the room the board sits in), planks across the view.
export function floorTex() {
  const size = 512, c = cv(size), x = c.getContext('2d'), r = rng(31), planks = 6, ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const tone = 40 + r() * 18; x.fillStyle = `rgb(${tone + 34},${tone + 14},${tone - 6})`; x.fillRect(0, p * ph, size, ph);
    for (let i = 0; i < 40; i++) { const y0 = p * ph + r() * ph, amp = 1 + r() * 3, f = 0.005 + r() * 0.02; x.strokeStyle = `rgba(${r() < 0.7 ? '15,6,2' : '200,150,100'},${0.08 + r() * 0.14})`; x.lineWidth = 0.5 + r() * 1.5; x.beginPath(); for (let s = 0; s <= size; s += 8) { const yy = y0 + Math.sin(s * f + i) * amp; s ? x.lineTo(s, yy) : x.moveTo(s, yy); } x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(0, p * ph, size, 2.5);
    const j = r() * size; x.fillRect(j, p * ph, 2, ph);
  }
  return tex(c, { repeat: [7, 7] });
}

// The batik runner under the board: kawung (four ovals) in cream and gold on indigo, with a parang border.
export function batikTex() {
  const w = 512, h = 1024, c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = '#18204a'; x.fillRect(0, 0, w, h);
  const R = 48;
  for (let j = -1; j * R < h + R; j++) for (let i = -1; i * R < w + R; i++) {
    const cx = i * R, cy = j * R, alt = (i + j) % 2 === 0;
    x.save(); x.translate(cx, cy);
    for (let k = 0; k < 4; k++) {
      x.save(); x.rotate(k * Math.PI / 2); x.beginPath(); x.ellipse(0, -R * 0.5, R * 0.3, R * 0.5, 0, 0, TAU);
      x.fillStyle = alt ? 'rgba(196,156,92,0.42)' : 'rgba(130,80,48,0.45)'; x.fill(); x.strokeStyle = 'rgba(232,210,166,0.55)'; x.lineWidth = 2; x.stroke();
      x.beginPath(); x.ellipse(0, -R * 0.5, R * 0.12, R * 0.27, 0, 0, TAU); x.strokeStyle = 'rgba(40,24,40,0.6)'; x.lineWidth = 1.4; x.stroke(); x.restore();
    }
    x.beginPath(); x.arc(0, 0, R * 0.1, 0, TAU); x.fillStyle = '#f2dfae'; x.fill(); x.restore();
  }
  const bd = 46;
  for (const [x0, y0, ww, hh] of [[0, 0, w, bd], [0, h - bd, w, bd], [0, 0, bd, h], [w - bd, 0, bd, h]]) {
    x.save(); x.beginPath(); x.rect(x0, y0, ww, hh); x.clip(); x.fillStyle = '#4a2410'; x.fillRect(x0, y0, ww, hh);
    x.strokeStyle = 'rgba(214,160,72,0.7)'; x.lineWidth = 2.5;
    for (let s = -h; s < h + w; s += 16) { x.beginPath(); x.moveTo(s, 0); x.lineTo(s - h, h); x.stroke(); }
    x.restore();
  }
  x.strokeStyle = '#e8c070'; x.lineWidth = 4; x.strokeRect(bd, bd, w - 2 * bd, h - 2 * bd);
  const vg = x.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, h * 0.65); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = vg; x.fillRect(0, 0, w, h);
  return tex(c);
}

// Cowrie: glossy cream back with a faint gold band and freckles; the belly (bottom rows) carries the long toothed aperture.
export function cowrieTex() {
  const w = 256, h = 128, c = cv(w, h), x = c.getContext('2d'), r = rng(5);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fbf1d6'); g.addColorStop(0.3, '#f1dcaa'); g.addColorStop(0.55, '#ddb980'); g.addColorStop(0.66, '#8a6038'); g.addColorStop(0.7, '#f3e6cc'); g.addColorStop(1, '#fbf3e4');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 420; i++) { x.fillStyle = `rgba(140,86,36,${0.1 + r() * 0.22})`; x.beginPath(); x.arc(r() * w, r() * h * 0.6, 0.6 + r() * 1.6, 0, TAU); x.fill(); }
  for (const u of [0, w / 2, w]) {
    x.fillStyle = '#4a2a12'; x.fillRect(u - 3, h * 0.76, 6, h * 0.24);
    x.strokeStyle = '#6a3e1c'; x.lineWidth = 1.8;
    for (let v = h * 0.78; v < h; v += 4) { x.beginPath(); x.moveTo(u - 10, v); x.lineTo(u + 10, v); x.stroke(); }
  }
  return tex(c);
}
export function ringTex() {
  const s = 128, c = cv(s), x = c.getContext('2d'), g = x.createRadialGradient(s / 2, s / 2, s * 0.22, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0.05)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.84, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s); return tex(c);
}
export function blobTex() {
  const s = 128, c = cv(s), x = c.getContext('2d'), g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s); return tex(c);
}
// A burnt house plug: charred wood, with (emissive version) thin glowing cracks.
export function charTex(glow) {
  const s = 128, c = cv(s), x = c.getContext('2d'), r = rng(glow ? 3 : 4);
  x.fillStyle = glow ? '#000' : '#1c120e'; x.fillRect(0, 0, s, s);
  if (!glow) for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '70,50,40' : '0,0,0'},0.4)`; x.fillRect(r() * s, r() * s, 2, 2); }
  x.strokeStyle = glow ? '#ff8a3a' : '#060302'; x.lineWidth = glow ? 1.4 : 2.2;
  for (let k = 0; k < 7; k++) { let px = s / 2, py = s / 2; x.beginPath(); x.moveTo(px, py); const a0 = (k / 7) * TAU; for (let j = 0; j < 6; j++) { px += Math.cos(a0 + (r() - 0.5)) * 10; py += Math.sin(a0 + (r() - 0.5)) * 10; x.lineTo(px, py); } x.stroke(); }
  return tex(c);
}
