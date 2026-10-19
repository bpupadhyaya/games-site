// Painted creatures and machines: Jatayu (white and gold plumage), the golden deer, birds, chariots.
import { TAU, sprite, blit, tinted, lin, rad, goldFill, pearl, gem, rosette, lighten, darken, rgba, limb, ramp, borderStrip } from './kit.js';
import { light } from '../stage.js';
import { relief, furCoat, insideOf, fillShapes } from './sculpt.js';

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- Jatayu: the great white-and-gold eagle ----
// Feathers are relief sprites (shaft ridge, barbs, luminous gold edge); a wing is built on a folding arm: primaries fan
// from the wrist, secondaries trail from the forearm, two rows of coverts overlap their bases, a downy leading edge on top.
const featherSp = (L, tone) => sprite(`feather${L}${tone}`, 44, L + 12, 22, L + 5, 3, (c) => {
  const w = L * 0.16, gold = tone === 'g';
  relief(c, { mat: 'feather', inflate: w * 0.7, depth: 2.2, bump: 1.8, aoR: 1.5, amb: [0.4, 0.38, 0.46], key: [1.0, 0.95, 0.84],
    blobs: [{ cap: [0, 0, 1, 0, -L * 0.95, 0.5], z: 0.9 }],
    paint(g) { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-w * 1.15, -L * 0.22, -w * 1.2, -L * 0.75, -w * 0.45, -L * 0.96); g.quadraticCurveTo(0, -L * 1.04, w * 0.4, -L * 0.97); g.bezierCurveTo(w * 0.9, -L * 0.75, w * 0.85, -L * 0.25, 0, 0); g.closePath();
      g.fillStyle = lin(g, 0, 0, 0, -L, [[0, '#e6dcc8'], [0.35, '#fbf6ea'], [0.72, gold ? '#fbe6a6' : '#fffaf0'], [0.9, gold ? '#eab64a' : '#f4e4bc'], [1, gold ? '#c98a22' : '#e6c478']]); g.fill();
      g.save(); g.clip(); g.strokeStyle = 'rgba(150,125,95,0.4)'; g.lineWidth = 0.45; for (let i = 1; i < 26; i++) { const y = -L * i / 27; g.beginPath(); g.moveTo(0, y); g.lineTo(-w * 1.2, y - L * 0.09); g.moveTo(0, y); g.lineTo(w * 1.1, y - L * 0.09); g.stroke(); } g.restore();
      g.strokeStyle = '#b89a62'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.95); g.stroke(); } });
});
const downSp = (k) => sprite('jatayuDown' + k, 70, 36, 8, 18, 3, (c) => {
  const shapes = [{ cap: [0, 0, 9 - k * 2, 54, 0, 5 - k] }];
  relief(c, { mat: 'feather', inflate: 6, depth: 5, bump: 1.2, amb: [0.5, 0.48, 0.52], paint(g) { fillShapes(g, shapes, '#efe6d2'); furCoat(g, { box: [-8, -12, 60, 12], inside: insideOf(shapes), n: 900, len: 6, wid: 0.9, seed: 3 + k, jitter: 0.3, cols: ['#d8ccb0', '#f4ecdc', '#ffffff'], flow: () => Math.PI * 0.62 }); } });
});
const eagleBody = () => sprite('jatayuBody', 230, 150, 110, 84, 3, (c) => {
  // legs and golden talons
  relief(c, { mat: 'gold', inflate: 2.4, depth: 2.2, bump: 1, paint(g) { g.strokeStyle = '#d9a238'; g.lineCap = 'round'; for (const dx of [-10, 12]) { g.lineWidth = 5.4; g.beginPath(); g.moveTo(dx, 14); g.lineTo(dx + 5, 40); g.stroke(); for (const tx of [-7, 0, 7]) { g.lineWidth = 3; g.beginPath(); g.moveTo(dx + 5, 40); g.quadraticCurveTo(dx + 5 + tx, 50, dx + 5 + tx * 1.4, 57); g.stroke(); } } } });
  const shapes = [{ x: -8, y: -2, rx: 52, ry: 25, rot: -0.08 }, { cap: [30, -8, 20, 66, -34, 12] }, { x: 80, y: -42, rx: 16, ry: 15 }, { cap: [-40, 2, 18, -66, 10, 8] }];
  relief(c, { mat: 'feather', inflate: 16, depth: 14, bump: 1.8, aoR: 4, amb: [0.38, 0.36, 0.46], key: [1.0, 0.95, 0.84],
    blobs: [{ x: 22, y: 4, rx: 26, ry: 18, z: 5 }, { x: 80, y: -46, rx: 12, ry: 9, z: 3 }, { cap: [70, -48, 3, 92, -46, 3], z: 2.4 }, { x: 85, y: -42.6, rx: 4.4, ry: 3.4, z: -2.6 }],
    paint(g) { fillShapes(g, shapes, '#f3ead8'); const ins = insideOf(shapes);
      // scalloped contour feathers, smaller toward the head; a golden breast and nape
      for (let r = 0; r < 16; r++) for (let i = 0; i < 40; i++) { const x = -70 + i * 4.4 + (r % 2) * 2.2, y = -62 + r * 6.2; if (!ins(x, y)) continue; const k = x > 56 ? 0.55 : 1, goldK = Math.max(0, 1 - Math.hypot((x - 34) / 30, (y - 8) / 22)); g.fillStyle = goldK > 0.25 ? (goldK > 0.6 ? '#f0c25a' : '#f8e2a4') : ((i + r) % 3 ? '#ffffff' : '#f4ead6'); g.beginPath(); g.ellipse(x, y, 3.6 * k, 4.6 * k, -0.5, 0, TAU); g.fill(); g.strokeStyle = 'rgba(170,140,95,0.5)'; g.lineWidth = 0.4; g.beginPath(); g.arc(x, y, 3.6 * k, 0.3, 2.6); g.stroke(); } },
    over(g) { // fierce golden eye under a heavy brow
      g.fillStyle = rad(g, 85.4, -42.6, 0, 3.6, [[0, '#ffd75a'], [0.6, '#e08a1a'], [1, '#5a2c06']]); g.beginPath(); g.ellipse(85.2, -42.6, 3.7, 3.1, 0, 0, TAU); g.fill(); g.fillStyle = '#0c0406'; g.beginPath(); g.arc(85.8, -42.6, 1.6, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(86.6, -43.6, 0.7, 0, TAU); g.fill();
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(78.6, -47.4); g.quadraticCurveTo(86, -48.6, 92, -44.2); g.stroke(); } });
  // crest
  for (let i = 0; i < 6; i++) { c.save(); c.translate(72 + i * 2.4, -54); c.rotate(-0.9 + i * 0.13); c.scale(0.34, 0.34); blit(c, featherSp(78, i % 2 ? 'g' : 'w')); c.restore(); }
  // hooked golden beak
  relief(c, { mat: 'gold', inflate: 4, depth: 4, blobs: [{ cap: [92, -46, 3, 108, -38, 2], z: 1.6 }],
    paint(g) { g.fillStyle = '#e6ac3a'; g.beginPath(); g.moveTo(92, -51); g.bezierCurveTo(112, -52, 120, -37, 109, -21); g.quadraticCurveTo(107, -31, 97, -33.4); g.quadraticCurveTo(90, -38, 92, -51); g.fill(); g.fillStyle = '#b8801e'; g.beginPath(); g.moveTo(95, -33); g.quadraticCurveTo(102, -30, 105, -25); g.quadraticCurveTo(98, -26, 93, -31); g.fill(); },
    over(g) { g.fillStyle = 'rgba(50,24,4,0.85)'; g.beginPath(); g.ellipse(99, -45, 1.5, 0.9, 0.3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(70,36,4,0.7)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(93, -36); g.quadraticCurveTo(101, -35, 108, -30); g.stroke(); } });
});
function wing(ctx, x, y, flap, dark, far) {
  const T = (sp) => (dark ? tinted(sp, '#5a3a6a', 0.3) : sp), k = far ? 0.9 : 1;
  const A = -2.15 - flap * 0.9, fold = 0.55 - flap * 0.35;                     // shoulder angle, wrist fold
  const ex = x + Math.cos(A) * 52 * k, ey = y + Math.sin(A) * 52 * k, A2 = A - fold, wx = ex + Math.cos(A2) * 62 * k, wy = ey + Math.sin(A2) * 62 * k;
  const put = (px, py, a, L, tone, sc = 1) => { ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2); ctx.scale(sc * k, sc * k); blit(ctx, T(featherSp(L, tone))); ctx.restore(); };
  const trail = A2 + Math.PI / 2 + 0.25;                                          // feathers trail behind the arm
  for (let i = 0; i < 10; i++) { const u = i / 9; put(wx - Math.cos(A2) * 6 * u, wy - Math.sin(A2) * 6 * u, trail - 1.75 * (1 - u) + flap * 0.25 * (1 - u), [132, 132, 126, 120, 114, 108, 102, 96, 90, 84][i], i % 3 === 0 ? 'g' : 'w'); }       // primaries
  for (let i = 0; i < 9; i++) { const u = (i + 0.6) / 9, inArm = u > 0.5, px = inArm ? x + (ex - x) * (1 - (u - 0.5) * 2) : wx + (ex - wx) * (u * 2), py = inArm ? y + (ey - y) * (1 - (u - 0.5) * 2) : wy + (ey - wy) * (u * 2); put(px, py, trail + 0.1 + u * 0.35, 84 - i * 3, i % 3 === 1 ? 'g' : 'w'); }   // secondaries
  for (const [n, L, off] of [[13, 48, 0.12], [12, 30, 0.2]]) for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, seg = u < 0.5, px = seg ? wx + (ex - wx) * (u * 2) : ex + (x - ex) * ((u - 0.5) * 2), py = seg ? wy + (ey - wy) * (u * 2) : ey + (y - ey) * ((u - 0.5) * 2); put(px, py, trail + off + u * 0.3 - (seg ? (1 - u * 2) * 0.9 : 0), L + 6, (i + n) % 4 === 0 ? 'g' : 'w', 0.9); }   // coverts
  for (const [px, py, a, kk] of [[x, y, A, 0], [ex, ey, A2, 1]]) { ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.scale(k * (kk ? 1.15 : 1), k); blit(ctx, T(downSp(kk))); ctx.restore(); }
}
export function eagle(ctx, x, y, s, t, dir = 1) {
  const flap = Math.sin(t * 5) * 0.5;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  // tail fan behind
  for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(-58, 8); ctx.rotate(-Math.PI / 2 - 0.42 + i * 0.105 - 0.06 * Math.sin(t * 3)); blit(ctx, featherSp(78, i % 2 ? 'w' : 'g')); ctx.restore(); }
  wing(ctx, 10, -12, flap * 0.85 + 0.42, true, true);
  blit(ctx, eagleBody());
  wing(ctx, 14, -14, flap, false, false);
  ctx.restore();
}
export function eagleBust(ctx, t = 0) { eagle(ctx, -52, 70, 1.3, t * 0.4, 1); }

// ---- golden deer ----
const deerBody = (golden) => sprite('deerBody' + golden, 170, 190, 90, 175, 2.4, (c) => {
  const base = golden ? '#f2c25a' : '#a8703a', dk = golden ? '#c98a22' : '#5a3418', lt = golden ? '#fff0b0' : '#d8a468';
  c.beginPath(); c.moveTo(-42, -56); c.bezierCurveTo(-46, -84, 20, -88, 44, -72); c.bezierCurveTo(52, -58, 44, -44, 14, -42); c.bezierCurveTo(-10, -38, -36, -42, -42, -56); c.closePath();
  c.fillStyle = lin(c, 0, -90, 0, -38, [[0, lt], [0.5, base], [1, dk]]); c.fill(); c.strokeStyle = rgba(dk, 0.8); c.lineWidth = 1; c.stroke();
  c.save(); c.clip(); c.fillStyle = 'rgba(255,255,240,0.92)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(-34 + hash(i) * 74, -82 + hash(i + 9) * 34, 2.6, 1.9, 0, 0, TAU); c.fill(); } c.restore();
  // neck and head
  c.beginPath(); c.moveTo(30, -80); c.bezierCurveTo(44, -96, 50, -110, 54, -122); c.lineTo(72, -118); c.bezierCurveTo(70, -100, 62, -70, 44, -56); c.closePath(); c.fillStyle = lin(c, 30, -120, 70, -60, [[0, lt], [1, base]]); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(52, -124); c.bezierCurveTo(60, -134, 78, -132, 88, -122); c.quadraticCurveTo(92, -114, 84, -110); c.bezierCurveTo(72, -108, 60, -110, 52, -124); c.fillStyle = lin(c, 50, -130, 90, -108, [[0, lt], [1, base]]); c.fill(); c.stroke();
  c.fillStyle = '#2a1408'; c.beginPath(); c.ellipse(87, -117, 3.6, 2.6, 0.3, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(70, -122, 3.6, 2.6, 0.2, 0, TAU); c.fill(); c.fillStyle = '#1a0a04'; c.beginPath(); c.arc(70.6, -122, 2, 0, TAU); c.fill();
  c.fillStyle = base; c.beginPath(); c.moveTo(50, -128); c.quadraticCurveTo(38, -146, 46, -150); c.quadraticCurveTo(56, -142, 58, -128); c.fill(); c.stroke();
  // antlers with gilded tips
  c.strokeStyle = golden ? '#fff6c8' : '#3a2010'; c.lineWidth = 2.4;
  for (const d of [0, 8]) { c.beginPath(); c.moveTo(60 + d, -130); c.quadraticCurveTo(48 + d, -158, 62 + d, -178); c.moveTo(54 + d, -152); c.lineTo(42 + d, -166); c.moveTo(57 + d, -164); c.lineTo(72 + d, -172); c.stroke(); }
  c.fillStyle = '#fff'; for (const [x, y] of [[62, -178], [42, -166], [72, -172]]) { c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.fill(); }
  c.fillStyle = base; c.beginPath(); c.ellipse(-46, -66, 8, 4.5, -0.6, 0, TAU); c.fill(); c.stroke();
});
export function deer(ctx, x, y, s, t, dir = 1, golden = false, ink = null) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  if (golden) light(ctx, 0, -70, 150, '255,215,110', 0.65);
  const p = t * 9, base = golden ? '#f2c25a' : '#a8703a', pr = ramp(base);
  const leg = (sx, i) => { const a = Math.sin(p + i * 1.7) * 0.6, b = -Math.abs(a) * 0.7; ctx.save(); ctx.translate(sx, -48); ctx.rotate(-a); const u = deerLeg(golden, 0); blit(ctx, ink ? tinted(u, ink, 0.6) : u); ctx.translate(0, 28); ctx.rotate(-b); const l = deerLeg(golden, 1); blit(ctx, ink ? tinted(l, ink, 0.6) : l); ctx.restore(); };
  leg(-30, 0); leg(-22, 1);
  const bd = deerBody(golden); blit(ctx, ink ? tinted(bd, ink, 0.6) : bd);
  leg(30, 2); leg(38, 3);
  ctx.restore();
}
const deerLeg = (golden, low) => sprite(`deerLeg${golden}${low}`, 20, 40, 10, 6, 3, (c) => { const p = ramp(golden ? '#f2c25a' : '#a8703a'); limb(c, low ? 28 : 28, low ? [[0, 6], [0.3, 4.6], [1, 3.6]] : [[0, 10], [1, 5]], p, {}); if (low) { c.fillStyle = '#2a1408'; c.beginPath(); c.ellipse(0, 30, 3.4, 2.4, 0, 0, TAU); c.fill(); } });

export function bird(ctx, x, y, s, t, ink = '#150a12') {
  const f = Math.sin(t * 8) * 10 * s;
  ctx.strokeStyle = ink; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 16 * s, y - f); ctx.quadraticCurveTo(x - 6 * s, y - 4 * s, x, y); ctx.quadraticCurveTo(x + 6 * s, y - 4 * s, x + 16 * s, y - f); ctx.stroke();
}

// ---- chariots ----
const carSp = (palace, open) => sprite('car' + palace + open, 400, 260, 170, 200, 2, (c) => {
  const G = (x0, y0, x1, y1) => goldFill(c, x0, y0, x1, y1);
  // hull: gold-edged crimson bowl
  c.beginPath(); c.moveTo(-130, -10); c.quadraticCurveTo(-120, 44, -40, 48); c.lineTo(70, 48); c.quadraticCurveTo(150, 40, 176, -34); c.quadraticCurveTo(140, -2, 96, -8); c.lineTo(-130, -10); c.closePath();
  c.fillStyle = lin(c, 0, -10, 0, 48, [[0, '#c0303a'], [1, '#5a0c1c']]); c.fill(); c.strokeStyle = G(-130, 0, 176, 0); c.lineWidth = 3; c.stroke();
  c.beginPath(); c.moveTo(176, -34); c.quadraticCurveTo(200, -70, 170, -86); c.quadraticCurveTo(178, -60, 160, -40); c.fillStyle = G(150, -90, 200, -30); c.fill();
  borderStrip(c, -118, 14, 250, 12, '#7a1424');
  for (let i = 0; i < 7; i++) gem(c, -96 + i * 32, 32, 3.4, i % 2 ? '#1fa872' : '#e8b030');
  const posts = open ? [] : palace ? [-100, -40, 20, 80] : [-96, 36];
  for (const px of posts) { c.fillStyle = lin(c, px - 4, 0, px + 4, 0, [[0, '#8a5a10'], [0.5, '#f6d070'], [1, '#8a5a10']]); c.fillRect(px - 3.4, -100, 6.8, 92); }
  if (open) { /* open war-car: no canopy */ } else if (palace) {
    for (let i = 0; i < 3; i++) { const cx = -70 + i * 60, top = -166 - (i === 1 ? 26 : 0); c.fillStyle = G(cx - 36, -110, cx + 36, -90); c.fillRect(cx - 38, -108, 76, 10);
      c.beginPath(); c.moveTo(cx - 28, -106); c.bezierCurveTo(cx - 34, -132, cx - 8, -138, cx, top); c.bezierCurveTo(cx + 8, -138, cx + 34, -132, cx + 28, -106); c.closePath(); c.fillStyle = lin(c, cx - 30, 0, cx + 30, 0, [[0, '#9a2a2a'], [0.5, '#e8a838'], [1, '#7a1a1a']]); c.fill(); c.strokeStyle = G(0, 0, 60, 0); c.lineWidth = 2; c.stroke(); pearl(c, cx, top - 3, 3);
      c.fillStyle = 'rgba(255,224,150,0.9)'; c.beginPath(); c.arc(cx, -118, 6, Math.PI, 0); c.fill(); }
  } else {
    c.beginPath(); c.moveTo(-116, -94); c.quadraticCurveTo(-30, -156, 56, -94); c.closePath(); c.fillStyle = lin(c, 0, -150, 0, -94, [[0, '#e8a838'], [1, '#b02030']]); c.fill(); c.strokeStyle = G(0, 0, 100, 0); c.lineWidth = 2; c.stroke();
    c.fillStyle = G(-34, -150, -26, -120); c.fillRect(-32, -152, 4, 32); pearl(c, -30, -154, 3.2);
  }
});
export function chariot(ctx, x, y, s, t, { dir = 1, palace = false, glint = -1, open = false } = {}) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2) * 6); ctx.scale(s * dir, s);
  if (!palace && !open) { ctx.fillStyle = 'rgba(255,220,140,0.9)'; ctx.beginPath(); ctx.moveTo(-28, -150); ctx.lineTo(-74 + Math.sin(t * 6) * 5, -140); ctx.lineTo(-28, -130); ctx.fill(); }
  blit(ctx, carSp(palace, open));
  if (!palace) [-70, 60].forEach((wx, i) => {
    if (glint === i) light(ctx, wx, 56, 110, '255,230,150', 0.95);
    ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(wx, 56, 40, 0, TAU); ctx.stroke();
    ctx.strokeStyle = glint === i ? '#fff2c0' : '#f0c050'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(wx, 56, 41, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#8a5a18'; ctx.lineWidth = 4; for (let k = 0; k < 8; k++) { const a = t * 4 + (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(wx, 56); ctx.lineTo(wx + Math.cos(a) * 38, 56 + Math.sin(a) * 38); ctx.stroke(); }
    rosette(ctx, wx, 56, 9, '#d8283a', 6);
  });
  else for (let i = 0; i < 5; i++) light(ctx, -110 + i * 60, 58 + Math.sin(t * 3 + i) * 5, 46, '255,210,130', 0.5);
  ctx.restore();
}
