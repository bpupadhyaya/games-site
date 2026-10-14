// The folk doll painter. A doll is a heavy round clay base, a bell-shaped painted body and a nodding head.
// Local units: 1 = the base radius R; the origin is the centre of the base circle, +y is down, the doll is about 4.3 tall.
// paint 0 = bare clay, 1 = body painted, 2 = face painted, 3 = gold trim and flowers (the collection fills in as you play).
import { PAL, TAU, hueShift, rgba, mixHex } from './art.js';
import { v3 } from './v3.js';

export const CHARS = [
  { name: 'Farmer', g: '#2f9a5f', sash: '#eaa91c', trim: '#fff1c0', skin: '#a8683a', hair: '#2b1a14', gear: 'turban', gc: '#e0562a' },
  { name: 'Weaver', g: '#c2247a', sash: '#ffd868', trim: '#ffe9a8', skin: '#c58552', hair: '#1c120f', gear: 'bun', gc: '#ffffff' },
  { name: 'Potter', g: '#b8742a', sash: '#2757a8', trim: '#fff1c0', skin: '#8d5530', hair: '#2b1a14', gear: 'cap', gc: '#d9402a' },
  { name: 'Drummer', g: '#2757a8', sash: '#ffd868', trim: '#fff1c0', skin: '#b9784a', hair: '#1c120f', gear: 'tall', gc: '#eaa91c' },
  { name: 'Piper', g: '#14958c', sash: '#d9402a', trim: '#fff1c0', skin: '#a8683a', hair: '#1c120f', gear: 'band', gc: '#ffd868' },
  { name: 'Fisher', g: '#e8f0f6', sash: '#2757a8', trim: '#2757a8', skin: '#8d5530', hair: '#2b1a14', gear: 'straw', gc: '#e9c26a' },
  { name: 'Grandmother', g: '#7a3fa8', sash: '#eaa91c', trim: '#ffe9a8', skin: '#b9784a', hair: '#f4f0ea', gear: 'granny', gc: '#f4f0ea' },
  { name: 'Child', g: '#e0402c', sash: '#14958c', trim: '#fff1c0', skin: '#c58552', hair: '#1c120f', gear: 'tufts', gc: '#ffd868' },
];
export const VARIANT_SHIFT = [0, 52, -58];

function bodyPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-1.0, 0);
  ctx.bezierCurveTo(-1.06, -0.9, -0.78, -1.5, -0.6, -2.05);
  ctx.quadraticCurveTo(-0.5, -2.36, -0.2, -2.42);
  ctx.lineTo(0.2, -2.42);
  ctx.quadraticCurveTo(0.5, -2.36, 0.6, -2.05);
  ctx.bezierCurveTo(0.78, -1.5, 1.06, -0.9, 1.0, 0);
  ctx.closePath();
}
const HEAD = { x: 0, y: -2.95, r: 0.62 };

function gearPath(ctx, kind) {
  ctx.beginPath();
  if (kind === 'turban') { ctx.ellipse(0, -3.42, 0.74, 0.46, 0, Math.PI, 0); ctx.closePath(); }
  else if (kind === 'cap') { ctx.ellipse(0, -3.4, 0.68, 0.42, 0, Math.PI, 0); ctx.closePath(); }
  else if (kind === 'tall') { ctx.moveTo(-0.6, -3.42); ctx.quadraticCurveTo(-0.5, -4.3, 0, -4.7); ctx.quadraticCurveTo(0.5, -4.3, 0.6, -3.42); ctx.closePath(); }
  else if (kind === 'straw') { ctx.ellipse(0, -3.45, 1.15, 0.22, 0, 0, TAU); }
  else { ctx.ellipse(0, -3.38, 0.64, 0.4, 0, Math.PI, 0); ctx.closePath(); }
}

// Draws one doll standing on the shelf at (cx, gy). o: { th, lag, ch, variant, paint, alpha, ghost, glow, tap }
export function drawDoll(ctx, cx, gy, R, o) {
  if (v3.on && v3.capture) { v3.dolls.push({ cx, gy, R, o }); return; }
  const th = o.th ?? 0, ch = CHARS[o.ch ?? 0], paint = o.paint ?? 3, ghost = !!o.ghost;
  const x = cx + R * th;   // rolling on the shelf: the contact point moves as it leans
  ctx.save();
  if (!ghost) {
    // contact shadow and a warm halo when in time
    ctx.fillStyle = 'rgba(40,16,6,0.28)'; ctx.beginPath(); ctx.ellipse(x, gy + 2, R * (0.95 + Math.abs(th) * 0.4), R * 0.14, 0, 0, TAU); ctx.fill();
    if (o.glow > 0.01) {
      const g = ctx.createRadialGradient(x, gy - R * 1.4, R * 0.3, x, gy - R * 1.4, R * 3.4);
      g.addColorStop(0, `rgba(255,214,90,${0.5 * o.glow})`); g.addColorStop(1, 'rgba(255,214,90,0)');
      ctx.fillStyle = g; ctx.fillRect(x - R * 3.5, gy - R * 5.2, R * 7, R * 5.4);
    }
  }
  if (!ghost && v3.on && v3.sprite) {
    // a lit 3D render of this doll (cached by character / variant / paint) instead of the flat painter
    const sp = v3.sprite(o.ch ?? 0, o.variant ?? 0, paint);
    if (sp) {
      ctx.translate(x, gy - R); ctx.rotate(th);
      ctx.drawImage(sp, -1.6 * R, -5.7 * R, 3.2 * R, 6.8 * R);
      if (o.tap > 0) { ctx.scale(R, R); ctx.strokeStyle = rgba('#ffd868', Math.min(1, o.tap * 3)); ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI); ctx.stroke(); }
      ctx.restore();
      return;
    }
  }
  ctx.translate(x, gy - R); ctx.rotate(th); ctx.scale(R, R);
  const lw = 0.06;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (ghost) {
    ctx.globalAlpha = o.alpha ?? 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.strokeStyle = '#0b8a80'; ctx.lineWidth = 0.1; ctx.setLineDash([0.26, 0.15]);
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    bodyPath(ctx); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(0, -2.42); ctx.rotate((o.lag ?? 0)); ctx.translate(0, 2.42);
    ctx.beginPath(); ctx.arc(HEAD.x, HEAD.y, HEAD.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  const painted = paint >= 1;
  const base = painted ? '#c76a3c' : PAL.clay0;
  // ---- base: the heavy round bottom --------------------------------------------------------------------------------------------
  let g = ctx.createRadialGradient(-0.35, 0.35, 0.1, 0, 0.1, 1.15);
  g.addColorStop(0, painted ? '#f0a070' : '#ecb48a'); g.addColorStop(0.55, base); g.addColorStop(1, painted ? '#7e3418' : PAL.clay1);
  ctx.fillStyle = g; ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (painted) {
    ctx.strokeStyle = ch.sash; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.arc(0, 0, 0.8, 0.28, Math.PI - 0.28); ctx.stroke();
    ctx.fillStyle = PAL.cream;
    for (let i = 0; i < 7; i++) { const a = 0.45 + (i * (Math.PI - 0.9)) / 6; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.05, 0, TAU); ctx.fill(); }
  }
  // The painted body and head sway on the clay base about the waist (springy torso), so the figure reads as a jointed toy.
  const torso = o.torso ?? (o.lag ?? 0) * 0.4;
  ctx.save(); ctx.translate(0, -0.35); ctx.rotate(torso); ctx.translate(0, 0.35);
  // ---- body --------------------------------------------------------------------------------------------------------------------
  const clayTint = mixHex('#d49a72', ch.g, 0.32);
  const gcol = painted ? hueShift(ch.g, VARIANT_SHIFT[o.variant ?? 0] ?? 0) : clayTint;
  g = ctx.createLinearGradient(-1, 0, 1, 0);
  if (painted) { g.addColorStop(0, hueShift(ch.g, VARIANT_SHIFT[o.variant ?? 0] ?? 0, 1.28)); g.addColorStop(0.45, gcol); g.addColorStop(1, hueShift(ch.g, VARIANT_SHIFT[o.variant ?? 0] ?? 0, 0.58)); }
  else { g.addColorStop(0, mixHex('#ecbc96', ch.g, 0.3)); g.addColorStop(1, mixHex('#b57a52', ch.g, 0.4)); }
  ctx.fillStyle = g; bodyPath(ctx); ctx.fill();
  ctx.save(); bodyPath(ctx); ctx.clip();
  if (painted) {
    // hem band with dots, belt, pleats
    ctx.fillStyle = ch.sash; ctx.fillRect(-1.2, -0.42, 2.4, 0.4);
    ctx.fillStyle = PAL.cream; for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.arc(i * 0.19, -0.22, 0.045, 0, TAU); ctx.fill(); }
    ctx.fillStyle = ch.sash; ctx.fillRect(-1, -1.62, 2, 0.24);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-0.7, -2.4, 0.18, 2.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 0.035;
    for (const px of [-0.5, -0.18, 0.18, 0.5]) { ctx.beginPath(); ctx.moveTo(px * 0.85, -0.45); ctx.lineTo(px * 0.55, -1.6); ctx.stroke(); }
    if (paint >= 3) {
      ctx.fillStyle = PAL.goldHi;
      for (let i = -2; i <= 2; i++) { ctx.save(); ctx.translate(i * 0.3, -1.0); ctx.rotate(Math.PI / 4); ctx.fillRect(-0.06, -0.06, 0.12, 0.12); ctx.restore(); }
      ctx.strokeStyle = PAL.goldHi; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.62, -2.0); ctx.quadraticCurveTo(0, -1.8, 0.62, -2.0); ctx.stroke();
    }
  } else {
    ctx.strokeStyle = 'rgba(80,36,14,0.25)'; ctx.lineWidth = 0.04;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-1, -0.4 - i * 0.5); ctx.lineTo(1, -0.4 - i * 0.5); ctx.stroke(); }
  }
  ctx.restore();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; bodyPath(ctx); ctx.stroke();
  // granny's shawl
  if (painted && ch.gear === 'granny') {
    ctx.fillStyle = hueShift('#eaa91c', VARIANT_SHIFT[o.variant ?? 0] ?? 0); ctx.beginPath();
    ctx.moveTo(-0.66, -2.1); ctx.quadraticCurveTo(0, -1.55, 0.66, -2.1); ctx.lineTo(0.5, -1.3); ctx.quadraticCurveTo(0, -1.0, -0.5, -1.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // arms folded in front
  ctx.fillStyle = painted ? gcol : '#cc9068'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw * 0.9;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.5, -1.55, 0.2, 0.52, s * 0.35, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = painted ? ch.skin : '#d49a72'; ctx.beginPath(); ctx.arc(0, -1.18, 0.18, 0, TAU); ctx.fill(); ctx.stroke();
  // ---- head, nodding about the neck ----------------------------------------------------------------------------------------
  ctx.save(); ctx.translate(0, -2.42); ctx.rotate(o.lag ?? 0); ctx.translate(0, 2.42);
  const skin = painted && paint >= 2 ? ch.skin : painted ? '#d9a577' : '#d49a72';
  g = ctx.createRadialGradient(-0.2, HEAD.y - 0.2, 0.05, 0, HEAD.y, HEAD.r * 1.1);
  g.addColorStop(0, paint >= 2 ? hueShift(ch.skin, 0, 1.35) : '#ecbc96'); g.addColorStop(1, skin);
  ctx.fillStyle = g; ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(HEAD.x, HEAD.y, HEAD.r, 0, TAU); ctx.fill(); ctx.stroke();
  if (paint >= 3) { ctx.fillStyle = PAL.goldHi; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.62, HEAD.y + 0.12, 0.07, 0, TAU); ctx.fill(); ctx.stroke(); } }
  // headgear
  if (painted) {
    const gc = hueShift(ch.gc, ch.gear === 'granny' || ch.gear === 'bun' || ch.gear === 'straw' ? 0 : VARIANT_SHIFT[o.variant ?? 0] ?? 0);
    const hair = ch.hair;
    if (ch.gear === 'turban') {
      ctx.fillStyle = gc; gearPath(ctx, 'turban'); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.04; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 0.24, -3.38); ctx.quadraticCurveTo(i * 0.3, -3.6, i * 0.2 + 0.12, -3.82); ctx.stroke(); }
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.fillStyle = gc; ctx.beginPath(); ctx.ellipse(0.1, -3.75, 0.5, 0.34, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.goldHi; ctx.beginPath(); ctx.arc(0.1, -3.42, 0.09, 0, TAU); ctx.fill();
    } else if (ch.gear === 'bun' || ch.gear === 'granny') {
      ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -3.4, 0.64, 0.42, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -3.95, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
      if (ch.gear === 'bun') { ctx.fillStyle = '#ffffff'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 0.22, -3.58 + Math.abs(i) * 0.04, 0.1, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(58,22,32,0.5)'; ctx.lineWidth = 0.03; ctx.stroke(); } ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; }
    } else if (ch.gear === 'cap') {
      ctx.fillStyle = gc; gearPath(ctx, 'cap'); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.goldHi; ctx.fillRect(-0.7, -3.46, 1.4, 0.1);
    } else if (ch.gear === 'tall') {
      ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -3.4, 0.64, 0.38, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gc; gearPath(ctx, 'tall'); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hueShift(ch.sash, 0); ctx.fillRect(-0.58, -3.55, 1.16, 0.14);
      ctx.strokeStyle = PAL.goldHi; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(0.1, -4.6); ctx.quadraticCurveTo(0.55, -4.9, 0.35, -5.2); ctx.stroke(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    } else if (ch.gear === 'band') {
      ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -3.4, 0.66, 0.42, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hueShift(ch.sash, VARIANT_SHIFT[o.variant ?? 0] ?? 0); ctx.fillRect(-0.62, -3.42, 1.24, 0.14);
      ctx.strokeStyle = gc; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(0.4, -3.45); ctx.quadraticCurveTo(0.9, -3.8, 0.7, -4.3); ctx.stroke(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    } else if (ch.gear === 'straw') {
      ctx.fillStyle = gc; ctx.beginPath(); ctx.ellipse(0, -3.45, 1.15, 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -3.5, 0.6, 0.4, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ch.sash; ctx.fillRect(-0.58, -3.55, 1.16, 0.1);
    } else if (ch.gear === 'tufts') {
      ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -3.4, 0.64, 0.4, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.62, -3.45, 0.2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(s * 0.62, -3.3, 0.08, 0, TAU); ctx.fill(); ctx.fillStyle = hair; }
    }
  } else {
    ctx.fillStyle = '#c08058'; gearPath(ctx, 'cap'); ctx.fill(); ctx.stroke();
  }
  // face
  if (paint >= 2) {
    const ey = HEAD.y - 0.02;
    ctx.fillStyle = 'rgba(224,80,70,0.35)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.34, HEAD.y + 0.17, 0.12, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffffff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.22, ey, 0.115, 0.095, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#1b0e0c'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.22, ey + 0.01, 0.065, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 0.22 + 0.025, ey - 0.02, 0.022, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#1b0e0c'; ctx.lineWidth = 0.045;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.1, ey - 0.17); ctx.quadraticCurveTo(s * 0.24, ey - 0.27, s * 0.38, ey - 0.15); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(58,22,32,0.5)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0, ey + 0.05); ctx.quadraticCurveTo(0.05, ey + 0.17, -0.03, ey + 0.2); ctx.stroke();
    ctx.strokeStyle = '#b8201c'; ctx.lineWidth = 0.065; ctx.beginPath(); ctx.moveTo(-0.17, HEAD.y + 0.3); ctx.quadraticCurveTo(0, HEAD.y + 0.42, 0.17, HEAD.y + 0.3); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(80,36,14,0.35)'; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(-0.3, HEAD.y); ctx.lineTo(-0.12, HEAD.y); ctx.moveTo(0.12, HEAD.y); ctx.lineTo(0.3, HEAD.y); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  // lit highlight on the clay
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-0.5, 0.35, 0.18, 0.07, -0.7, 0, TAU); ctx.fill();
  if (o.tap > 0) { ctx.save(); ctx.translate(0, -0.35); ctx.rotate(torso); ctx.translate(0, 0.35); ctx.strokeStyle = rgba('#ffd868', Math.min(1, o.tap * 3)); ctx.lineWidth = 0.08; bodyPath(ctx); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}

// The height of a doll above its contact point, in base radii (head and tall hats included).
export const DOLL_H = 5.6;
