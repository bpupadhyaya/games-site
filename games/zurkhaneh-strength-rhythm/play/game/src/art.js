// Everything that is painted: palette, tiled surround, the octagonal pit, athletes seen from above, the drummer, move glyphs.
// Pure canvas drawing (no DOM). All positions are in virtual units.

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
export const PAL = {
  ink: '#0a1216', night: '#0d1c22', deep: '#12303a', wall: '#6d3f2a', wallHi: '#8f5a3c', bench: '#a8774a', clay: '#d9a468', clayLo: '#9a5f38',
  turq: '#35d0c0', turqLo: '#17806f', lapis: '#4a6bd8', lapisHi: '#8aa4ff', saffron: '#f4b942', copper: '#c8742f', coral: '#ff7a5c',
  cream: '#f6ead2', text: '#fbf3e2', dim: '#b9ad98', wood: '#d79a52', woodLo: '#7a4318', good: '#8ef0dc', miss: '#ff7d8f',
};
export const KIND_COL = { tap: '#f4b942', l: '#35d0c0', r: '#35d0c0', u: '#35d0c0', d: '#35d0c0', hold: '#8aa4ff', whirl: '#ff7a5c' };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
import { CAM, project } from './cam.js';
const TAU = Math.PI * 2;
const ease = (x) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const SKINS = ['#e3a974', '#c98a58', '#f0c096', '#b47244', '#d99a66', '#9c6038', '#eab98a', '#c17f4e'];
const HAIR = ['#1c1410', '#2a1c14', '#120d0a', '#33241a', '#1c1410', '#241913', '#0f0b08', '#2d2018'];
const CLOTH = [['#b3342a', '#f6ead2'], ['#1f4fa8', '#f6ead2'], ['#1f7a5a', '#f6ead2'], ['#c47a1c', '#2a1c14'], ['#7a2a5a', '#f6ead2'], ['#1c6c80', '#f6ead2'], ['#a63a1a', '#f6ead2'], ['#3a4aa0', '#f4b942']];

function octagon(ctx, cx, cy, r, rot = Math.PI / 8) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + (i * TAU) / 8; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
}

// ---- tiled surround ----------------------------------------------------------------------------------------------------------------
export function drawBackground(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1a20'); g.addColorStop(0.5, '#10303a'); g.addColorStop(1, '#0a161c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const S = 96, cols = Math.ceil(w / S) + 1, rows = Math.ceil(h / S) + 1;
  ctx.lineWidth = 2;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * S, y = j * S, hi = (i + j) % 2;
    ctx.strokeStyle = hi ? 'rgba(53,208,192,0.11)' : 'rgba(138,164,255,0.09)';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const r = k % 2 ? S * 0.22 : S * 0.43, a = (k * TAU) / 8 - Math.PI / 8; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.stroke();
  }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// ---- the pit -----------------------------------------------------------------------------------------------------------------------
export function pitSpot(pit, i, k = 0.7, hgt = 0) {
  const a = Math.PI / 2 + (i * TAU) / 8;
  if (pit.cam) { const p = project(pit.cam, Math.cos(a) * k * CAM.rw, hgt, Math.sin(a) * k * CAM.rw); return { x: p.x, y: p.y, a, k: p.k }; }
  return { x: pit.cx + Math.cos(a) * pit.R * k, y: pit.cy + Math.sin(a) * pit.R * k, a };
}
export const CUE_K = 0.4, ATH_K = 0.7, CUE_H = 1.0;   // CUE_H: height (m) of the cue marker above the floor when the pit is seen in 3D

export function drawPit(ctx, pit, o = {}) {
  const { cx, cy, R } = pit, pulse = o.pulse ?? 0, glow = o.glow ?? 0;
  ctx.save();
  // outer shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; octagon(ctx, cx, cy + R * 0.03, R * 1.04); ctx.fill();
  // brick wall
  const wg = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.2, cx, cy, R);
  wg.addColorStop(0, PAL.wallHi); wg.addColorStop(1, '#4a2a1c');
  ctx.fillStyle = wg; octagon(ctx, cx, cy, R); ctx.fill();
  ctx.strokeStyle = 'rgba(20,8,4,0.55)'; ctx.lineWidth = R * 0.045; ctx.setLineDash([R * 0.11, R * 0.04]);
  octagon(ctx, cx, cy, R * 0.965); ctx.stroke();
  ctx.lineDashOffset = R * 0.075; octagon(ctx, cx, cy, R * 0.915); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.strokeStyle = rgba(PAL.turq, 0.55 + glow * 0.4); ctx.lineWidth = R * 0.012; octagon(ctx, cx, cy, R * 0.99); ctx.stroke();
  // bench step
  const bg = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
  bg.addColorStop(0, '#c18a55'); bg.addColorStop(1, '#8a5832');
  ctx.fillStyle = bg; octagon(ctx, cx, cy, R * 0.88); ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,8,0.6)'; ctx.lineWidth = R * 0.012; ctx.stroke();
  // sunken floor
  const fg = ctx.createRadialGradient(cx - R * 0.1, cy - R * 0.15, R * 0.05, cx, cy, R * 0.84);
  fg.addColorStop(0, '#f0c488'); fg.addColorStop(0.55, PAL.clay); fg.addColorStop(1, PAL.clayLo);
  ctx.fillStyle = fg; octagon(ctx, cx, cy, R * 0.8); ctx.fill();
  ctx.strokeStyle = 'rgba(60,28,12,0.7)'; ctx.lineWidth = R * 0.02; ctx.stroke();
  // inner shadow (the pit is sunken)
  const sh = ctx.createLinearGradient(cx, cy - R * 0.8, cx, cy - R * 0.55);
  sh.addColorStop(0, 'rgba(30,12,4,0.45)'); sh.addColorStop(1, 'rgba(30,12,4,0)');
  ctx.save(); octagon(ctx, cx, cy, R * 0.8); ctx.clip(); ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, R * 2, R * 0.6); ctx.restore();
  // floor inlay: the cue ring and a star
  ctx.strokeStyle = rgba(PAL.turqLo, 0.9); ctx.lineWidth = R * 0.016; octagon(ctx, cx, cy, R * 0.56); ctx.stroke();
  ctx.strokeStyle = rgba(PAL.cream, 0.28); ctx.lineWidth = R * 0.008; octagon(ctx, cx, cy, R * 0.6); ctx.stroke();
  ctx.strokeStyle = rgba('#5a2e14', 0.35); ctx.lineWidth = R * 0.01;
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * TAU) / 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.27, cy + Math.sin(a) * R * 0.27); ctx.lineTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); ctx.stroke(); }
  // beat pulse
  if (pulse > 0) { ctx.strokeStyle = rgba(PAL.saffron, pulse * 0.5); ctx.lineWidth = R * 0.02; ctx.beginPath(); ctx.arc(cx, cy, R * (0.26 + (1 - pulse) * 0.5), 0, TAU); ctx.stroke(); }
  // centre platform
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy + R * 0.02, R * 0.265, 0, TAU); ctx.fill();
  const pg = ctx.createRadialGradient(cx - R * 0.05, cy - R * 0.06, R * 0.02, cx, cy, R * 0.26);
  pg.addColorStop(0, '#e6b878'); pg.addColorStop(1, '#8a5424');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, R * 0.25, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(PAL.turq, 0.85); ctx.lineWidth = R * 0.014; ctx.beginPath(); ctx.arc(cx, cy, R * 0.225, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---- figures -----------------------------------------------------------------------------------------------------------------------
function club(ctx, S, ang, side, lift) {
  // pivot at the hand; the club points along `ang` (0 = forward). length ~ 2.1 S
  ctx.save();
  ctx.rotate(ang);
  const L = S * (1.9 + 0.5 * lift), w0 = S * 0.11, w1 = S * 0.36;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = S * 0.25; ctx.shadowOffsetY = S * 0.1 * (1 + lift);
  const g = ctx.createLinearGradient(-w1, 0, w1, 0);
  g.addColorStop(0, PAL.woodLo); g.addColorStop(0.42, '#f0be78'); g.addColorStop(1, '#6a380f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w0, S * 0.25);
  ctx.lineTo(-w0, -L * 0.45);
  ctx.bezierCurveTo(-w1 * 1.05, -L * 0.62, -w1, -L * 0.98, 0, -L);
  ctx.bezierCurveTo(w1, -L * 0.98, w1 * 1.05, -L * 0.62, w0, -L * 0.45);
  ctx.lineTo(w0, S * 0.25);
  ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(40,18,6,0.7)'; ctx.lineWidth = S * 0.05; ctx.stroke();
  ctx.fillStyle = PAL.copper; ctx.fillRect(-w0 * 1.5, -L * 0.42, w0 * 3, S * 0.07);
  ctx.fillRect(-w1 * 0.92, -L * 0.78, w1 * 1.84, S * 0.06);
  ctx.restore();
}

// pose: { cl, cr: club angles, lift: 0..1 (arms raised), board: 0..1 (shield lifted), bob: 0..1, spin: radians, ghost }
export function drawAthlete(ctx, x, y, S, face, i, pose = {}, o = {}) {
  const skin = SKINS[i % 8], hair = HAIR[i % 8], cloth = CLOTH[i % 8];
  const bob = pose.bob ?? 0, lift = pose.lift ?? 0, board = pose.board ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(face + Math.PI / 2 + (pose.spin ?? 0));
  const sc = 1 + lift * 0.1 + board * 0.12 - bob * 0.07;
  ctx.scale(sc, sc);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  // ground shadow
  ctx.fillStyle = 'rgba(30,10,2,0.38)'; ctx.beginPath(); ctx.ellipse(S * 0.08, S * 0.2 + lift * S * 0.15, S * 1.08, S * 0.74, 0, 0, TAU); ctx.fill();
  // you-marker ring
  if (o.you) { ctx.strokeStyle = rgba(PAL.saffron, 0.85); ctx.lineWidth = S * 0.08; ctx.beginPath(); ctx.arc(0, 0, S * 1.18, 0, TAU); ctx.stroke(); }
  if (o.glow) { ctx.fillStyle = rgba(o.glowColor ?? PAL.saffron, 0.22 * o.glow); ctx.beginPath(); ctx.arc(0, 0, S * 1.5, 0, TAU); ctx.fill(); }
  // clubs sit behind the body when low, on top when raised; draw arms first
  const hand = (side) => ({ x: side * S * 0.9, y: -S * 0.12 });
  const angs = [pose.cl ?? -0.42, pose.cr ?? 0.42];
  // trousers / waist cloth seen from above
  ctx.fillStyle = cloth[0]; ctx.beginPath(); ctx.ellipse(0, S * 0.22, S * 0.78, S * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = cloth[1]; ctx.fillRect(-S * 0.78, S * 0.2, S * 1.56, S * 0.07);
  // arms
  for (let k = 0; k < 2; k++) {
    const side = k === 0 ? -1 : 1, h = hand(side), a = angs[k];
    const hx = h.x + Math.sin(a) * S * 0.55, hy = h.y - Math.cos(a) * S * 0.55 - lift * S * 0.15;
    const ag = ctx.createLinearGradient(h.x, h.y, hx, hy);
    ag.addColorStop(0, skin); ag.addColorStop(1, shade(skin, 0.86));
    ctx.strokeStyle = ag; ctx.lineCap = 'round'; ctx.lineWidth = S * 0.34;
    ctx.beginPath(); ctx.moveTo(side * S * 0.62, -S * 0.02); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); club(ctx, S, a, side, lift); ctx.restore();
    ctx.fillStyle = shade(skin, 0.92); ctx.beginPath(); ctx.arc(hx, hy, S * 0.2, 0, TAU); ctx.fill();
  }
  // torso (shoulders from above)
  const tg = ctx.createRadialGradient(-S * 0.25, -S * 0.2, S * 0.1, 0, 0, S * 1.0);
  tg.addColorStop(0, shade(skin, 1.12)); tg.addColorStop(1, shade(skin, 0.82));
  ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.98, S * 0.52, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,16,4,0.35)'; ctx.lineWidth = S * 0.04; ctx.stroke();
  // head: hair seen from above, a band, ears
  ctx.fillStyle = shade(skin, 0.9); ctx.beginPath(); ctx.ellipse(-S * 0.4, -S * 0.04, S * 0.1, S * 0.17, 0, 0, TAU); ctx.ellipse(S * 0.4, -S * 0.04, S * 0.1, S * 0.17, 0, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(-S * 0.1, -S * 0.18, S * 0.05, 0, -S * 0.04, S * 0.46);
  hg.addColorStop(0, shade(hair, 2.6)); hg.addColorStop(0.5, hair); hg.addColorStop(1, shade(hair, 0.6));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, -S * 0.04, S * 0.4, S * 0.46, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(skin, 1.0); ctx.beginPath(); ctx.ellipse(0, -S * 0.46, S * 0.13, S * 0.07, 0, 0, TAU); ctx.fill(); // nose tip
  ctx.strokeStyle = rgba(cloth[0], 0.9); ctx.lineWidth = S * 0.09; ctx.beginPath(); ctx.ellipse(0, -S * 0.04, S * 0.37, S * 0.42, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  // shield (wooden board) lifted over the head
  if (board > 0) {
    const bw = S * 1.8, bh = S * 0.62, by = -S * 0.5 - board * S * 0.15;
    ctx.save(); ctx.globalAlpha *= clamp01(board * 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(-bw / 2 + S * 0.1, by - bh / 2 + S * 0.22, bw, bh, S * 0.14); ctx.fill();
    const sg = ctx.createLinearGradient(0, by - bh / 2, 0, by + bh / 2);
    sg.addColorStop(0, '#e8b270'); sg.addColorStop(1, '#a8672a');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(-bw / 2, by - bh / 2, bw, bh, S * 0.14); ctx.fill();
    ctx.strokeStyle = 'rgba(60,26,6,0.7)'; ctx.lineWidth = S * 0.05; ctx.stroke();
    ctx.strokeStyle = 'rgba(80,36,8,0.35)'; ctx.lineWidth = S * 0.025;
    for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(-bw * 0.42, by + q * bh * 0.16); ctx.lineTo(bw * 0.42, by + q * bh * 0.16); ctx.stroke(); }
    ctx.fillStyle = PAL.copper; ctx.beginPath(); ctx.arc(-bw * 0.36, by, S * 0.07, 0, TAU); ctx.arc(bw * 0.36, by, S * 0.07, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// The drummer at the centre, seated behind a goblet drum. hitL / hitR: 0..1 hand strike amounts. bell: 0..1 ring.
export function drawDrummer(ctx, pit, o = {}) {
  const { cx, cy, R } = pit, S = R * 0.115, hl = o.hitL ?? 0, hr = o.hitR ?? 0;
  ctx.save(); ctx.translate(cx, cy);
  // shoulders and head (seen from above), facing down-screen so the drum is nearest the player
  ctx.fillStyle = 'rgba(30,10,2,0.35)'; ctx.beginPath(); ctx.ellipse(S * 0.1, -S * 0.5, S * 1.15, S * 0.7, 0, 0, TAU); ctx.fill();
  const tg = ctx.createRadialGradient(-S * 0.2, -S * 0.8, S * 0.1, 0, -S * 0.5, S * 1.2);
  tg.addColorStop(0, '#6a8fe0'); tg.addColorStop(1, '#27408f');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(0, -S * 0.45, S * 1.08, S * 0.58, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(10,20,60,0.5)'; ctx.lineWidth = S * 0.05; ctx.stroke();
  const hg = ctx.createRadialGradient(-S * 0.1, -S * 0.7, S * 0.05, 0, -S * 0.5, S * 0.5);
  hg.addColorStop(0, '#4a3022'); hg.addColorStop(1, '#140c08');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, -S * 0.5, S * 0.42, S * 0.46, 0, 0, TAU); ctx.fill();
  // goblet drum
  const dr = S * 0.82;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(S * 0.08, S * 0.5, dr * 1.04, dr * 0.9, 0, 0, TAU); ctx.fill();
  const sg = ctx.createRadialGradient(-dr * 0.3, S * 0.3, dr * 0.1, 0, S * 0.45, dr);
  sg.addColorStop(0, '#fff3d6'); sg.addColorStop(1, '#c9955a');
  ctx.fillStyle = '#6a3a14'; ctx.beginPath(); ctx.arc(0, S * 0.45, dr, 0, TAU); ctx.fill();
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, S * 0.45, dr * 0.84, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(PAL.copper, 0.9); ctx.lineWidth = S * 0.07; ctx.beginPath(); ctx.arc(0, S * 0.45, dr * 0.93, 0, TAU); ctx.stroke();
  // hands
  const hand = (sx, k) => { const hx = sx * S * 0.55, hy = S * 0.1 + k * S * 0.35; ctx.strokeStyle = '#c98a58'; ctx.lineCap = 'round'; ctx.lineWidth = S * 0.3; ctx.beginPath(); ctx.moveTo(sx * S * 0.85, -S * 0.3); ctx.lineTo(hx, hy + S * 0.15); ctx.stroke(); ctx.fillStyle = '#d99a66'; ctx.beginPath(); ctx.arc(hx, hy + S * 0.2, S * 0.2, 0, TAU); ctx.fill(); if (k > 0.5) { ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = S * 0.05; ctx.beginPath(); ctx.arc(0, S * 0.45, dr * (0.5 + 0.45 * k), 0, TAU); ctx.stroke(); } };
  hand(-1, hl); hand(1, hr);
  // brass bell
  const bx = S * 1.55, by = -S * 0.3, b = o.bell ?? 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(bx + 3, by + 5, S * 0.34, 0, TAU); ctx.fill();
  const bgd = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, S * 0.36);
  bgd.addColorStop(0, '#fff0a8'); bgd.addColorStop(1, '#b8801c');
  ctx.fillStyle = bgd; ctx.beginPath(); ctx.arc(bx, by, S * 0.32, 0, TAU); ctx.fill();
  if (b > 0) { ctx.strokeStyle = rgba('#ffe28a', b * 0.7); ctx.lineWidth = S * 0.08; ctx.beginPath(); ctx.arc(bx, by, S * (0.4 + (1 - b) * 0.7), 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// ---- move glyphs -------------------------------------------------------------------------------------------------------------------
const DIR = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };
export function drawGlyph(ctx, x, y, r, kind, o = {}) {
  const col = KIND_COL[kind] ?? PAL.cream, a = o.alpha ?? 1;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  if (o.glow) { ctx.fillStyle = rgba(col, 0.25 * o.glow); ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#20414a'); g.addColorStop(1, '#0a161c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(3, r * 0.12); ctx.strokeStyle = col; ctx.stroke();
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = r * 0.2;
  if (DIR[kind]) {
    const [dx, dy] = DIR[kind];
    ctx.save(); ctx.rotate(Math.atan2(dy, dx));
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.42, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.12, -r * 0.36); ctx.lineTo(r * 0.52, 0); ctx.lineTo(r * 0.12, r * 0.36); ctx.stroke();
    ctx.restore();
  } else if (kind === 'tap') {
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.fill();
    for (let k = 0; k < 4; k++) { const an = Math.PI / 4 + (k * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.42, Math.sin(an) * r * 0.42); ctx.lineTo(Math.cos(an) * r * 0.62, Math.sin(an) * r * 0.62); ctx.stroke(); }
  } else if (kind === 'hold') {
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath(); ctx.roundRect(-r * 0.55, -r * 0.3, r * 1.1, r * 0.6, r * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.05); ctx.lineTo(r * 0.25, -r * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, r * 0.62); ctx.lineTo(0, r * 0.38); ctx.stroke();
  } else if (kind === 'whirl') {
    ctx.lineWidth = lw * 0.8; const dir = o.cw ?? 1, rot = o.spin ?? 0;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, rot, rot + dir * Math.PI * 1.55, dir < 0); ctx.stroke();
    const ea = rot + dir * Math.PI * 1.55, ex = Math.cos(ea) * r * 0.5, ey = Math.sin(ea) * r * 0.5, ta = ea + dir * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(ex + Math.cos(ta - 2.5) * r * 0.32, ey + Math.sin(ta - 2.5) * r * 0.32); ctx.lineTo(ex, ey); ctx.lineTo(ex + Math.cos(ta + 2.5) * r * 0.32, ey + Math.sin(ta + 2.5) * r * 0.32); ctx.stroke();
  }
  ctx.restore();
}

// Pose of one athlete from its current action. act = { kind, age, dur } (age counts up from the start of the move).
// Every channel eases from the idle stance into the action (first ~0.1 s) and back out (0.35 s after dur), so nothing snaps; a whirl
// accelerates from rest and coasts to the next full turn so the body never jumps back when the action ends.
const spinPos = (a) => (a < 0.25 ? 6.4 * a * a / 0.5 : 6.4 * (a - 0.125));
export function poseFor(act, faceRot, t, idx) {
  const sway = Math.sin(t * 2.2 + idx * 1.3) * 0.06;
  const idle = { cl: -0.5 + sway, cr: 0.5 - sway };
  const pose = { cl: idle.cl, cr: idle.cr, lift: 0, board: 0, bob: 0, spin: 0 };
  if (!act) return pose;
  const a = act.age, dur = act.dur || 0.38;
  const inK = ease(a / 0.1), outK = clamp01(1 - (a - dur) / 0.35), k = inK * outK;
  const to = { cl: idle.cl, cr: idle.cr, lift: 0 };
  if (act.kind === 'tap') {
    pose.bob = Math.sin(clamp01(a / 0.22) * Math.PI) * outK; to.cl = 0.22; to.cr = -0.22; to.lift = 0.1;
  } else if (act.kind === 'hold') {
    const up = ease(a / 0.25), kk = a > dur ? clamp01(1 - (a - dur) / 0.25) : up;
    pose.board = kk; to.lift = kk * 0.6; to.cl = -0.12; to.cr = 0.12;
  } else if (act.kind === 'whirl') {
    const cw = act.cw || 1, s0 = spinPos(dur);
    let sp = spinPos(a);
    if (a > dur) { const target = Math.ceil(s0 / TAU) * TAU; sp = s0 + (target - s0) * ease((a - dur) / 0.3); }
    pose.spin = sp * cw; to.cl = -1.25; to.cr = 1.25; to.lift = 0.35;
  } else if (DIR[act.kind]) {
    const [dx, dy] = DIR[act.kind], c = Math.cos(-faceRot), sn = Math.sin(-faceRot);
    const lx = dx * c - dy * sn, ly = dx * sn + dy * c;              // swipe direction in the athlete's own frame
    const ang = (vx, vy) => Math.atan2(vx, -vy);
    let a0 = ang(-lx, -ly), a1 = ang(lx, ly);
    if (Math.abs(a1 - a0) > Math.PI) a0 += a1 > a0 ? Math.PI * 2 : -Math.PI * 2;
    const cur = a0 + (a1 - a0) * ease(a / 0.32);
    to.cl = cur - 0.12; to.cr = cur + 0.12; to.lift = ly < -0.5 ? 0.9 : ly > 0.5 ? -0.1 : 0.25;
  }
  pose.cl = idle.cl + (to.cl - idle.cl) * k; pose.cr = idle.cr + (to.cr - idle.cr) * k; pose.lift = to.lift * k;
  return pose;
}

// ---- particles ---------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, color, speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = rng.range(40, 190) * speed;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rng.range(0.35, 0.8), age: 0, r: rng.range(2.5, 6), color });
  }
  if (parts.length > 160) parts.splice(0, parts.length - 160);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) { const k = 1 - p.age / p.life; ctx.fillStyle = rgba(p.color, k * 0.85); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k), 0, TAU); ctx.fill(); }
}
